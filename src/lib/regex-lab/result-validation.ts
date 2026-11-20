import {
  identifiesExecution,
  type LabExecutionRequest,
  type LabExecutionResult,
} from './contracts.ts';
import { limits, runtimes, type Runtime } from './interactive.ts';
import type { TraceObservation } from './trace.ts';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, max: number) =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= max;
const time = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const browserProviderIdentity = {
  providerId: 'interactive-browser-v1',
  kind: 'browser-local',
} as const;

const versions = {
  javascript: undefined,
  pcre2: /^10\.49(?: |$)/,
  pcre243: /^10\.43(?: |$)/,
  pcre242: /^10\.42(?: |$)/,
  python: /^3\.14\.\d+$/,
  python311: /^3\.11\.\d+$/,
  python311bytes: /^3\.11\.\d+$/,
} satisfies Record<Runtime, RegExp | undefined>;

function validResult(
  result: unknown,
  request: LabExecutionRequest,
  runtime: Runtime,
): result is LabExecutionResult {
  if (
    !object(result) ||
    !identifiesExecution(result, request, browserProviderIdentity)
  )
    return false;
  const { status, observation, timing } = result;
  const { unit, label } = runtimes[runtime];
  if (
    !object(timing) ||
    !time(timing.durationMs) ||
    (timing.compileMs !== undefined && !time(timing.compileMs)) ||
    (timing.executionMs !== undefined && !time(timing.executionMs)) ||
    !object(observation) ||
    observation.eligibility !== 'interactive-browser-v1' ||
    observation.providerVersion !== '1.0.0' ||
    observation.runtime !== label ||
    observation.indexUnit !== unit ||
    typeof observation.environment !== 'string' ||
    typeof observation.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(observation.observedAt))
  )
    return false;
  const version = versions[runtime];
  if (
    version &&
    !(
      typeof observation.runtimeVersion === 'string' &&
      version.test(observation.runtimeVersion)
    ) &&
    !(
      observation.runtimeVersion === undefined &&
      ['unsupported-operation', 'resource-terminated'].includes(String(status))
    )
  )
    return false;
  if (!version && observation.runtimeVersion !== undefined) return false;

  if (status === 'completed') {
    if ('matches' in result || 'error' in result) return false;
    if (request.operationId === 'search')
      return typeof result.output === 'boolean';
    if (
      request.operationId === 'replace' ||
      request.operationId === 'replace-all'
    )
      return (
        typeof result.output === 'string' &&
        result.output.length <= limits.output
      );
    return (
      request.operationId === 'split' &&
      Array.isArray(result.output) &&
      result.output.every(
        (part) => part === null || typeof part === 'string',
      ) &&
      JSON.stringify(result.output).length <= limits.output
    );
  }
  if (status === 'matched' || status === 'no-match') {
    if (
      'error' in result ||
      'output' in result ||
      !['first', 'scan', 'fullmatch'].includes(request.operationId) ||
      !Array.isArray(result.matches)
    )
      return false;
    if (status === 'no-match') return result.matches.length === 0;
    if (
      !result.matches.length ||
      result.matches.length >
        (request.operationId === 'scan' ? limits.matches : 1)
    )
      return false;
    const subject = subjectProjection(request.input, runtime);
    const ids = new Set<string>();
    return result.matches.every(
      (match, i) =>
        object(match) &&
        uniqueId(match.matchId, ids) &&
        match.ordinal === i + 1 &&
        subject.matches(
          match.span,
          match.value,
          request.operationId === 'fullmatch',
        ) &&
        Array.isArray(match.captures) &&
        match.captures.length <= limits.captures &&
        match.captures.every(
          (capture, j) =>
            object(capture) &&
            uniqueId(capture.captureId, ids) &&
            capture.index === j + 1 &&
            (capture.name === undefined || typeof capture.name === 'string') &&
            (capture.participation === 'participated'
              ? subject.matches(capture.span, capture.value)
              : ['unmatched', 'nonparticipating', 'unavailable'].includes(
                  String(capture.participation),
                ) &&
                capture.value === undefined &&
                capture.span === undefined),
        ),
    );
  }
  if (
    'matches' in result ||
    'output' in result ||
    ![
      'compile-rejection',
      'runtime-error',
      'resource-terminated',
      'unsupported-operation',
      'infrastructure-failure',
    ].includes(String(status)) ||
    !object(result.error) ||
    typeof result.error.message !== 'string'
  )
    return false;
  if (
    result.error.offset !== undefined &&
    (result.error.offsetUnit !== unit ||
      !integer(
        result.error.offset,
        subjectProjection(request.pattern, runtime).length,
      ))
  )
    return false;
  return (
    status !== 'resource-terminated' ||
    [
      'timeout',
      'memory',
      'step-limit',
      'output-limit',
      'cancelled',
      'other',
    ].includes(String(result.error.termination))
  );
}

function uniqueId(value: unknown, ids: Set<string>) {
  if (typeof value !== 'string' || !value || ids.has(value)) return false;
  ids.add(value);
  return true;
}

function validSpan(
  value: unknown,
  unit: string,
  length: number,
): value is { start: number; end: number; unit: string } {
  return (
    object(value) &&
    value.unit === unit &&
    integer(value.start, length) &&
    integer(value.end, length) &&
    (value.start as number) <= (value.end as number)
  );
}

function subjectProjection(input: string, runtime: Runtime) {
  const { unit } = runtimes[runtime];
  const bytes =
    unit === 'utf8-bytes' ? new TextEncoder().encode(input) : undefined;
  const scalars =
    unit === 'unicode-code-points' ? Array.from(input) : undefined;
  const length = bytes?.length ?? scalars?.length ?? input.length;
  const decoder = bytes
    ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    : undefined;
  return {
    length,
    matches(span: unknown, value: unknown, requireFullSpan = false) {
      if (!validSpan(span, unit, length) || typeof value !== 'string')
        return false;
      const { start, end } = span;
      if (requireFullSpan && (start !== 0 || end !== length)) return false;
      if (bytes) {
        const slice = bytes.subarray(start, end);
        if (runtime === 'python311bytes')
          return (
            value ===
            Array.from(slice, (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join('')
          );
        try {
          return decoder!.decode(slice) === value;
        } catch {
          return false;
        }
      }
      return (
        value ===
        (scalars ? scalars.slice(start, end).join('') : input.slice(start, end))
      );
    },
  };
}

function validTrace(
  trace: unknown,
  request: LabExecutionRequest,
  runtime: Runtime,
): trace is TraceObservation {
  if (
    !object(trace) ||
    trace.schema !== 'strling-lab-trace-v1' ||
    trace.instrumentation !== 'pcre2-interpreter-auto-callout-v1' ||
    !Array.isArray(trace.events) ||
    trace.events.length > 512 ||
    !validResult(trace.execution, request, runtime)
  )
    return false;
  const outcome =
    trace.execution.status === 'completed'
      ? trace.execution.output
        ? 'matched'
        : 'no-match'
      : trace.execution.status === 'resource-terminated'
        ? 'limit'
        : 'error';
  if (trace.termination !== outcome) return false;
  const subjectLength = new TextEncoder().encode(request.input).length;
  const patternLength = new TextEncoder().encode(request.pattern).length;
  let slots = 0;
  return trace.events.every(
    (event) =>
      object(event) &&
      validSpan(event.pattern, 'utf8-bytes', patternLength) &&
      integer(event.subjectPosition, subjectLength) &&
      integer(event.attemptStart, subjectLength) &&
      integer(event.callout, 255) &&
      integer(event.lastCapture, limits.captures) &&
      typeof event.backtrackSincePrevious === 'boolean' &&
      typeof event.newAttempt === 'boolean' &&
      Array.isArray(event.captures) &&
      event.captures.length <= limits.captures &&
      (slots += event.captures.length) <= 4096 &&
      event.captures.every(
        (capture) =>
          object(capture) &&
          integer(capture.index, limits.captures) &&
          validSpan(capture.span, 'utf8-bytes', subjectLength),
      ),
  );
}

export function validateBrowserReply(
  response: unknown,
  request: LabExecutionRequest,
  runtime: Runtime,
  trace: boolean,
) {
  if (trace && validTrace(response, request, runtime)) return response;
  if (
    validResult(response, request, runtime) &&
    (!trace || 'error' in response)
  )
    return response;
  throw new Error(
    'The worker returned a mismatched or invalid execution result.',
  );
}
