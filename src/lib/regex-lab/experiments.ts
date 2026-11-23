import type { LabExecutionResult, LabMatch } from './contracts.ts';
import { coordinateMap, editorRange } from './offsets.ts';
import type { Expected } from './session.ts';

export function observationValue(result: LabExecutionResult) {
  if (result.status === 'completed')
    return { status: result.status, output: result.output };
  if ('error' in result) return { status: result.status, error: result.error };
  return { status: result.status, matches: result.matches };
}

export function expectedFrom(result: LabExecutionResult): Expected {
  if ('error' in result) return { kind: 'error', value: result.status };
  if ('matches' in result) {
    const captures = result.matches
      .flatMap((match) =>
        match.captures.slice(0, 8).map((capture) => ({
          match: match.ordinal,
          key:
            capture.name &&
            match.captures.filter((entry) => entry.name === capture.name)
              .length === 1
              ? capture.name
              : capture.index,
          value: capture.value ?? null,
        })),
      )
      .slice(0, 128);
    return { kind: 'matches', count: result.matches.length, captures };
  }
  if (typeof result.output === 'boolean')
    return { kind: 'boolean', value: result.output };
  if (typeof result.output === 'string')
    return { kind: 'replacement', value: result.output };
  return { kind: 'split', value: result.output };
}

export function assess(
  expected: Expected,
  actual: LabExecutionResult,
): string[] {
  const mismatch = (left: unknown, right: unknown, label: string) =>
    JSON.stringify(left) === JSON.stringify(right)
      ? []
      : [label + ' expected ' + display(left) + ', observed ' + display(right)];
  if (expected.kind === 'error')
    return mismatch(expected.value, actual.status, 'Status');
  if ('error' in actual) return [actual.status + ' · ' + actual.error.message];
  if (expected.kind !== 'matches') {
    return mismatch(
      expected.value,
      'output' in actual ? actual.output : actual.status,
      'Output',
    );
  }
  if (!('matches' in actual))
    return ['Expected match records, observed ' + actual.status];
  return [
    ...mismatch(expected.count, actual.matches.length, 'Match count'),
    ...(expected.captures ?? []).flatMap(({ match, key, value }) => {
      const captures = actual.matches[match - 1]?.captures.filter((entry) =>
        typeof key === 'string' ? entry.name === key : entry.index === key,
      );
      const capture =
        captures?.find((entry) => entry.participation === 'participated') ??
        captures?.[0];
      return mismatch(
        value,
        capture ? (capture.value ?? null) : undefined,
        'Match ' + match + ' capture ' + key,
      );
    }),
  ];
}

function display(value: unknown) {
  const json = JSON.stringify(value) ?? 'missing';
  return json.length > 160 ? json.slice(0, 160) + '…' : json;
}

export interface Difference {
  path: string;
  before: unknown;
  after: unknown;
}

export function compareObservations(
  before: LabExecutionResult,
  after: LabExecutionResult,
  subject: string,
): Difference[] {
  const left = observationValue(before);
  const right = observationValue(after);
  const differences: Difference[] = [];
  const add = (path: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before) !== JSON.stringify(after))
      differences.push({ path, before, after });
  };
  const normalize = (result: LabExecutionResult) => {
    if (!('matches' in result)) return new Map();
    const unit = result.observation?.indexUnit ?? result.matches[0]?.span.unit;
    const map =
      unit && unit !== 'utf16-code-units'
        ? coordinateMap(subject, unit)
        : undefined;
    const convert = (span: LabMatch['span']) =>
      editorRange(span, subject.length, map) ?? span;
    const identified = new Map<
      string,
      { ordinal: number; value: string; range: unknown; captures: unknown[] }
    >();
    const duplicateCounts = new Map<string, number>();
    for (const match of result.matches) {
      const range = convert(match.span);
      const key = JSON.stringify([range, match.value]);
      const duplicate = duplicateCounts.get(key) ?? 0;
      duplicateCounts.set(key, duplicate + 1);
      const captures = match.captures.map((capture) => ({
        ...captureValue(capture),
        range: capture.span && convert(capture.span),
      }));
      identified.set(key + ':' + duplicate, {
        ordinal: match.ordinal,
        value: match.value,
        range,
        captures,
      });
    }
    return identified;
  };
  add('status', left.status, right.status);
  if ('matches' in before && 'matches' in after) {
    const previous = normalize(before);
    const current = normalize(after);
    for (const [key, item] of previous) {
      const other = current.get(key);
      if (!other) add('removed match ' + item.ordinal, item, undefined);
      else {
        add(
          'match order at match ' + item.ordinal,
          item.ordinal,
          other.ordinal,
        );
        add(
          'match ' + item.ordinal + ' captures',
          item.captures,
          other.captures,
        );
      }
    }
    for (const [key, item] of current) {
      if (!previous.has(key))
        add('added match ' + item.ordinal, undefined, item);
    }
  } else {
    add('result', left, right);
  }
  return differences;
}

function captureValue(capture: LabMatch['captures'][number]) {
  return {
    index: capture.index,
    name: capture.name,
    participation: capture.participation,
    value: capture.value,
  };
}

export function summarizeTimings(values: number[]) {
  if (!values.length) return;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return {
    min: sorted[0]!,
    median:
      sorted.length % 2
        ? sorted[half]!
        : (sorted[half - 1]! + sorted[half]!) / 2,
    max: sorted.at(-1)!,
  };
}
