import * as s from '@strling-lang/strling/simply';
import {
  asciiDigit,
  asciiHex,
  asciiLower,
  choices,
  decimalDate,
  fixedDigits,
} from './lexical.ts';

const timeOfDay = () =>
  s.merge(fixedDigits(2), ':', fixedDigits(2), ':', fixedDigits(2));

const timestamp = () =>
  s.group('timestamp', decimalDate(), 'T', timeOfDay(), 'Z');

const serviceIdentifier = () =>
  s.group(
    'service',
    asciiLower(),
    s.inChars(asciiLower(), asciiDigit(), '-').rep(0, 15),
  );

const eventPart = () =>
  s.merge(asciiLower(), s.inChars(asciiLower(), asciiDigit()).rep(0, 11));
const eventName = () => s.group('event', eventPart(), '.', eventPart());
const traceIdentifier = () => s.group('traceId', asciiHex().rep(8));

const durationField = () =>
  s.merge(' duration_ms=', s.group('durationMs', asciiDigit().rep(1, 7)));
const contextField = () =>
  s.merge(
    ' context=',
    s.group('context', s.inChars(asciiLower(), '-').rep(1, 12)),
  );
const requestIdField = () =>
  s.merge(' request_id=', s.group('requestId', asciiHex().rep(8)));

type Severity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'TRACE';

interface LogFormat {
  readonly levels: readonly [Severity, ...Severity[]];
  readonly allowsRequestId: boolean;
}

export const baseLogFormat = {
  levels: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
  allowsRequestId: false,
} as const satisfies LogFormat;

export const extendedLogFormat = {
  levels: [...baseLogFormat.levels, 'TRACE'],
  allowsRequestId: true,
} as const satisfies LogFormat;

export function buildEventLog(format: LogFormat = baseLogFormat): s.Pattern {
  const severity = s.group('severity', choices(format.levels));
  const optionalFields = [durationField(), contextField()];
  if (format.allowsRequestId) optionalFields.push(requestIdField());

  return s.merge(
    s.start(),
    timestamp(),
    ' level=',
    severity,
    ' service=',
    serviceIdentifier(),
    ' event=',
    eventName(),
    ' trace=',
    traceIdentifier(),
    ...optionalFields.map((field) => s.may(field)),
    s.end(),
  );
}
