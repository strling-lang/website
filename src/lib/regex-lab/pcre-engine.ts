import type { LabMatch, LabSpan } from './contracts.ts';
import {
  checkOutput,
  limits,
  OutputLimitError,
  runtimeFailure,
  type EngineResult,
  type RunOptions,
} from './interactive.ts';
import type { TraceEvent, TraceObservation } from './trace.ts';

interface Bridge {
  memory: WebAssembly.Memory;
  _initialize(): void;
  reset(): void;
  compile(
    length: number,
    flags: number,
    trace: number,
    anyNewline: number,
  ): number;
  match(length: number, start: number, flags: number): number;
  next(): number;
  substitute(length: number, replacementLength: number, flags: number): number;
  version(): number;
  explain_error(code: number): number;
  names(): number;
  name_count(): number;
  name_size(): number;
  pattern_buffer(): number;
  subject_buffer(): number;
  replacement_buffer(): number;
  output_buffer(): number;
  message_buffer(): number;
  offset_buffer(): number;
  output_size(): number;
  error_offset(): number;
  next_start(): number;
  next_options(): number;
  capture_count(): number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const span = (start: number, end: number): LabSpan => ({
  start,
  end,
  unit: 'utf8-bytes',
});
const flags: Record<string, number> = {
  i: 0x00000008,
  m: 0x00000400,
  s: 0x00000020,
  x: 0x00000080,
  u: 0x00080000,
  U: 0x00040000,
  A: 0x80000000,
  D: 0x00000010,
  p: 0x00020000,
};

const FULL_MATCH = 0xa0000000;
const REPLACE_GLOBAL = 0x100;
const REPLACE_LITERAL = 0x8000;
const UNSET = 0xffffffff;

export async function createPCRE2(source: ArrayBuffer) {
  let events: TraceEvent[] = [];
  const { instance } = await WebAssembly.instantiate(source, {
    lab: {
      record(
        callout: number,
        bits: number,
        position: number,
        length: number,
        subjectPosition: number,
        attemptStart: number,
        captureTop: number,
        lastCapture: number,
        offsets: number,
      ) {
        const captures: TraceEvent['captures'] = [];
        const vector = new Uint32Array(
          bridge.memory.buffer,
          offsets,
          captureTop * 2,
        );
        for (let index = 1; index < captureTop; index++) {
          const start = vector[index * 2]!;
          const end = vector[index * 2 + 1]!;
          if (start !== UNSET && end !== UNSET)
            captures.push({ index, span: span(start, end) });
        }
        events.push({
          callout,
          pattern: span(position, position + length),
          subjectPosition,
          attemptStart,
          lastCapture,
          captures,
          backtrackSincePrevious: Boolean(bits & 2),
          newAttempt: Boolean(bits & 1),
        });
      },
    },
    wasi_snapshot_preview1: {
      random_get(pointer: number, size: number) {
        crypto.getRandomValues(
          new Uint8Array(bridge.memory.buffer, pointer, size),
        );
        return 0;
      },
    },
  });
  const bridge = instance.exports as unknown as Bridge;
  bridge._initialize();

  const read = (pointer: number, size: number) =>
    decoder.decode(new Uint8Array(bridge.memory.buffer, pointer, size));
  const write = (pointer: number, text: Uint8Array) =>
    new Uint8Array(bridge.memory.buffer, pointer, text.length).set(text);
  const version = read(bridge.message_buffer(), bridge.version() - 1);

  const explain = (code: number) => {
    const size = bridge.explain_error(code);
    return size > 0
      ? read(bridge.message_buffer(), size)
      : 'PCRE2 error ' + code;
  };
  const failure = (code: number, compilation: boolean): EngineResult => {
    const error = { message: explain(code), code: String(code) };
    if (code === -1001 || code === -1002)
      return runtimeFailure(new OutputLimitError());
    if (
      code === -47 ||
      code === -53 ||
      code === -63 ||
      code === -48 ||
      code === -37
    ) {
      return {
        status: 'resource-terminated',
        error: {
          ...error,
          message:
            code === -37
              ? 'The trace reached its event or capture-state limit.'
              : error.message,
          termination: code === -63 || code === -48 ? 'memory' : 'step-limit',
        },
      };
    }
    return compilation
      ? {
          status: 'compile-rejection',
          error: {
            ...error,
            offset: bridge.error_offset(),
            offsetUnit: 'utf8-bytes',
          },
        }
      : { status: 'runtime-error', error };
  };

  function groupNames() {
    const names = new Map<number, string>();
    const size = bridge.name_size();
    for (let i = 0; i < bridge.name_count(); i++) {
      const pointer = bridge.names() + i * size;
      const bytes = new Uint8Array(bridge.memory.buffer, pointer, size);
      names.set(
        bytes[0]! * 256 + bytes[1]!,
        decoder.decode(bytes.subarray(2, bytes.indexOf(0, 2))),
      );
    }
    return names;
  }

  function execute(
    subject: Uint8Array,
    options: RunOptions,
    trace: boolean,
  ): EngineResult {
    const { operation, replacementSyntax } = options;
    const length = subject.length;
    write(bridge.subject_buffer(), subject);
    if (!trace && (operation === 'replace' || operation === 'replace-all')) {
      const replacement = encoder.encode(options.replacement);
      write(bridge.replacement_buffer(), replacement);
      const bits =
        (operation === 'replace-all' ? REPLACE_GLOBAL : 0) |
        (replacementSyntax === 'literal' ? REPLACE_LITERAL : 0);
      const result = bridge.substitute(length, replacement.length, bits);
      return result < 0
        ? failure(result, false)
        : {
            status: 'completed',
            output: read(bridge.output_buffer(), bridge.output_size()),
          };
    }

    let result = bridge.match(
      length,
      0,
      !trace && operation === 'fullmatch' ? FULL_MATCH : 0,
    );
    if (trace || operation === 'search') {
      if (result < -1) return failure(result, false);
      return { status: 'completed', output: result > 0 };
    }

    const matches: LabMatch[] = [];
    const parts: (string | null)[] = [];
    const names = groupNames();
    let splitStart = 0;
    let count = 0;
    let size = 0;
    while (result > 0) {
      if (++count > limits.matches) throw new OutputLimitError();
      const offsets = new Uint32Array(
        bridge.memory.buffer,
        bridge.offset_buffer(),
        (bridge.capture_count() + 1) * 2,
      );
      const [start, end] = offsets as unknown as [number, number];
      const id = 'match-' + count;
      const value =
        start > end ? '' : decoder.decode(subject.subarray(start, end));
      const captures: LabMatch['captures'] = Array.from(
        { length: bridge.capture_count() },
        (_, offset) => {
          const index = offset + 1;
          const start = offsets[index * 2]!;
          const end = offsets[index * 2 + 1]!;
          const participated = start !== UNSET;
          return {
            captureId: id + '-' + index,
            index,
            name: names.get(index),
            participation: participated ? 'participated' : 'unmatched',
            value: participated
              ? decoder.decode(subject.subarray(start, end))
              : undefined,
            span: participated ? span(start, end) : undefined,
          };
        },
      );
      if (operation === 'split') {
        if (start < splitStart || end < start) {
          return {
            status: 'unsupported-operation',
            error: {
              message:
                'The reported PCRE2 delimiter range cannot be used to split the subject.',
            },
          };
        }
        const fields = [
          decoder.decode(subject.subarray(splitStart, start)),
          ...captures.map((capture) => capture.value ?? null),
        ];
        size += JSON.stringify(fields).length;
        parts.push(...fields);
        splitStart = end;
      } else {
        const item = {
          matchId: id,
          ordinal: count,
          span: span(start, end),
          value,
          captures,
        };
        size += JSON.stringify(item).length;
        matches.push(item);
      }
      if (size > limits.output) throw new OutputLimitError();
      if (operation === 'first' || operation === 'fullmatch' || !bridge.next())
        break;
      result = bridge.match(length, bridge.next_start(), bridge.next_options());
    }
    if (result < -1) return failure(result, false);
    if (operation === 'split')
      return {
        status: 'completed',
        output: [...parts, decoder.decode(subject.subarray(splitStart))],
      };
    return matches.length
      ? { status: 'matched', matches }
      : { status: 'no-match', matches: [] };
  }

  return {
    version,
    run(pattern: string, subject: string, options: RunOptions, trace = false) {
      const active = performance.now();
      events = [];
      const source = encoder.encode(pattern);
      try {
        write(bridge.pattern_buffer(), source);
        const code = bridge.compile(
          source.length,
          [...options.flags].reduce((bits, flag) => bits | flags[flag]!, 0),
          Number(trace),
          Number(options.pcreNewline === 'any'),
        );
        const compileMs = performance.now() - active;
        if (code) {
          const result = failure(code, code > 0);
          return {
            result: { ...result, compileMs },
            events,
            termination:
              result.status === 'resource-terminated'
                ? ('limit' as const)
                : ('error' as const),
          };
        }
        const started = performance.now();
        let result: EngineResult;
        try {
          result = execute(encoder.encode(subject), options, trace);
          checkOutput(result);
        } catch (error) {
          result = runtimeFailure(error);
        }
        let termination: TraceObservation['termination'] = 'error';
        if (result.status === 'completed')
          termination = result.output ? 'matched' : 'no-match';
        if (result.status === 'resource-terminated') termination = 'limit';
        return {
          result: {
            ...result,
            compileMs,
            executionMs: performance.now() - started,
          },
          events,
          termination,
        };
      } finally {
        bridge.reset();
      }
    },
  };
}
