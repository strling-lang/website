---
title: 'Production event logs'
description: 'Decompose a fixed event-log grammar into reusable lexical patterns, compile it for ECMAScript, and verify named fields against real log fixtures.'
summary: 'Build a structured log-event parser from reusable timestamps, severity levels, identifiers, optional fields, and named captures.'
order: 4
time: '30 minutes'
difficulty: advanced
keywords:
  [
    'structured log parsing',
    'regex composition',
    'named captures',
    'maintainable log patterns',
    'STRling TypeScript tutorial',
  ]
related:
  [
    '/docs/composition/',
    '/docs/groups-and-captures/',
    '/learn/versioned-api-routes/',
  ]
---

## 1. Write down the log grammar

Suppose a platform team owns a line format used by billing and payments. An
ingester needs the timestamp, severity, service, event, and trace ID as separate
fields. Some producers can also report duration and request context.

```text
2026-11-18T21:34:05Z level=INFO service=billing event=invoice.created trace=4A92D61F duration_ms=19
2026-11-18T21:35:11Z level=ERROR service=payments event=charge.failed trace=9B4E283C
```

Treat each input as one line with no trailing newline. The stream reader removes
the record delimiter before handing over the line. The field order, key spelling,
and single ASCII spaces are part of the contract. The initial version accepts
`DEBUG`, `INFO`, `WARN`, and `ERROR`.

| Field     | Lexical contract                                                                                |
| --------- | ----------------------------------------------------------------------------------------------- |
| Timestamp | `YYYY-MM-DDTHH:MM:SSZ` with ASCII digits and a literal UTC suffix                               |
| Service   | 1–16 lowercase ASCII letters, digits, or hyphens, starting with a letter                        |
| Event     | Two dot-separated parts, each 1–12 lowercase ASCII letters or digits and starting with a letter |
| Trace ID  | Exactly eight uppercase hexadecimal characters                                                  |
| Duration  | Optional ` duration_ms=` followed by 1–7 ASCII digits                                           |
| Context   | Optional ` context=` followed by 1–12 lowercase ASCII letters or hyphens                        |

The optional fields can appear independently. If both appear, duration comes
first. The grammar has no quoting, free-text tail, or unconstrained key/value
section. Other producer formats need their own recognition rules.

### Compare the conventional RegEx pieces

Here are the equivalent conventional ECMAScript fragments, in sequence. The
last two fragments include the preceding space inside their optional group.

| Field     | RegEx fragment                                                         |
| --------- | ---------------------------------------------------------------------- |
| Timestamp | `(?<timestamp>[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)` |
| Level     | `\x20level=(?<severity>DEBUG\|INFO\|WARN\|ERROR)`                      |
| Service   | `\x20service=(?<service>[a-z][a-z0-9-]{0,15})`                         |
| Event     | `\x20event=(?<event>[a-z][a-z0-9]{0,11}\.[a-z][a-z0-9]{0,11})`         |
| Trace     | `\x20trace=(?<traceId>[0-9A-F]{8})`                                    |
| Duration  | `(?:\x20duration_ms=(?<durationMs>[0-9]{1,7}))?`                       |
| Context   | `(?:\x20context=(?<context>[a-z-]{1,12}))?`                            |

Wrap the sequence in `^` and `(?![\s\S])` for exact input boundaries with
multiline mode off. Named captures and a well-documented RegEx can already help.
The maintenance problem appears when a timestamp rule, field separator, or
identifier limit changes. A named component gives that rule one definition and
lets you exercise it through focused fixtures.

## 2. Name the lexical pieces

The shared <a href="/examples/pattern-engineering/lexical.ts" download>lexical module</a> names the
ASCII ranges and the fixed-width date. `inChars` combines ranges into a single
character set. The explicit ranges define this wire format's character policy.

```typescript
import * as s from '@strling-lang/strling/simply';

const asciiDigit = () => s.between('0', '9');
const asciiHex = () => s.inChars(asciiDigit(), s.between('A', 'F'));
const fixedDigits = (count: number) => asciiDigit().rep(count);
```

Capture-free patterns such as the digit range are reusable values. A function
is useful when callers supply a width or a capture name, or when you want to
keep the lexical rule separate from where the application captures it. Use
each capture name once in a complete pattern so `match.groups` has one field
for each name.

## 3. Assemble fields at their boundaries

Compose the date and time separately and capture the timestamp once. The
ingester can pass that value directly to a UTC date-time parser.

```typescript
const decimalDate = () =>
  s.merge(fixedDigits(4), '-', fixedDigits(2), '-', fixedDigits(2));
const timeOfDay = () =>
  s.merge(fixedDigits(2), ':', fixedDigits(2), ':', fixedDigits(2));
const timestamp = () =>
  s.group('timestamp', decimalDate(), 'T', timeOfDay(), 'Z');
```

That shape also matches a date such as `2026-02-30T21:34:05Z`. Validate calendar
dates and time ranges in the ingestion code. Keeping parsing after matching
lets a rejection report a specific problem with a captured value.

Use the same decomposition for identifiers. `eventPart` starts with a letter
and appends up to eleven letters or digits. The event name joins two such
parts around a literal dot. Likewise, the request-context field owns its key
and leading space so the optional wrapper can include or omit the whole field.

```typescript
const asciiLower = () => s.between('a', 'z');
const eventPart = () =>
  s.merge(asciiLower(), s.inChars(asciiLower(), asciiDigit()).rep(0, 11));
const eventName = () => s.group('event', eventPart(), '.', eventPart());
const traceIdentifier = () => s.group('traceId', asciiHex().rep(8));

const durationField = () =>
  s.merge(' duration_ms=', s.group('durationMs', asciiDigit().rep(1, 7)));
```

## 4. Compose the event pattern

In the <a href="/examples/pattern-engineering/production-event-logs.ts" download>complete log source</a>,
`choices(format.levels)` turns the configured severity labels into literal
alternatives. The field factories establish what can be captured. The final
sequence establishes field order and exact input boundaries.

```typescript
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
```

`optionalFields` initially contains `durationField()` and `contextField()` in
that order. `s.may` applies to each whole field. An absent duration therefore
leaves `durationMs` undefined and consumes no separator.

## 5. Compile for ECMAScript and run in Node

Run this example with Node.js 22 and the published STRling 4.0.3 TypeScript
Preview adapter. In a new npm project with `"type": "module"` in `package.json`,
install `@strling-lang/strling@4.0.3`. Save the <a href="/examples/pattern-engineering/production-event-logs.ts" download>log source</a>,
<a href="/examples/pattern-engineering/lexical.ts" download>lexical module</a>,
<a href="/examples/pattern-engineering/compiler.ts" download>compiler helper</a>, and
<a href="/examples/pattern-engineering/ecmascript-2024.json" download>target profile</a> beside an
`example.ts` file. Execute it with `node --experimental-strip-types example.ts`.

```typescript
import { compileProjection, loadPatternCompiler } from './compiler.ts';
import { buildEventLog } from './production-event-logs.ts';

const pattern = buildEventLog();
const request = pattern.buildRequest(compileProjection);
console.log(request.protocol_version, request.root_step_id);

const compile = await loadPatternCompiler();
const regex = compile(pattern);
console.log(regex.source, regex.flags);

const line =
  '2026-11-18T21:34:05Z level=INFO service=billing ' +
  'event=invoice.created trace=4A92D61F duration_ms=19';
const fields = regex.exec(line)?.groups;
if (!fields) throw new Error('Unrecognized event log');
console.log(
  fields.timestamp,
  fields.severity,
  fields.traceId,
  fields.durationMs,
);
```

The last line prints `2026-11-18T21:34:05Z INFO 4A92D61F 19`. Follow the three
boundaries in the compiler helper.

1. `buildRequest(compileProjection)` records Simply 1.1 operations and their
   root. That inspection call is optional. `Pattern.compile` records and
   submits its own request.
2. `loadBundledWasm()` loads the canonical compiler packaged with the Preview
   adapter. `pattern.compile(client, compileProjection, exactTargetProfile)`
   requests a target artifact for `profile:ecmascript/2024` version `1.3.0`.
   The projection supplies the fixture's canonical profile digest, and the
   third argument supplies the full verified profile. The helper checks the
   canonical `compile_result.outcome` before reading the artifact. See the
   [adapter source](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/bindings/typescript)
   and [target reference fixture](https://github.com/strling-lang/strling/blob/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/contracts/1.0/examples/compile-request/equivalence-explanation.json).
3. The helper constructs `new RegExp` from `compile_result.artifact.pattern.text`
   and `pattern.flags.join('')` on the same emitted object. Node owns the
   `regex.exec(line)` call and its named capture results. The example prints
   the pattern and flags returned by that execution path.

Compile once when you initialize the ingester and reuse the resulting RegEx
for every line with this format. Handle compiler diagnostics during setup and
unmatched lines during ingestion.

## 6. Verify the grammar with producer fixtures

Use both scenario lines as baselines. Each row changes one rule so a failure
identifies the field or boundary to inspect.

| Fixture or change                                      | Expected result                                       |
| ------------------------------------------------------ | ----------------------------------------------------- |
| INFO line with `duration_ms=19`                        | Match with `durationMs` equal to `'19'`               |
| ERROR line without the suffix                          | Match with `durationMs` undefined                     |
| ERROR line followed by ` context=api`                  | Match with `context` equal to `'api'`                 |
| INFO line followed by ` context=batch-web`             | Match with both optional values                       |
| Replace `INFO` with `NOTICE`                           | Reject unsupported severity                           |
| Replace `21:34:05` with `21:34`                        | Reject malformed timestamp shape                      |
| Remove the trace field                                 | Reject missing field                                  |
| Put `event=` before `service=`                         | Reject incorrect ordering                             |
| Append a newline or ` extra=1`                         | Reject trailing input                                 |
| Use `service=abcdefghijklmnopq` or `service=pay_ments` | Reject excessive length or disallowed character       |
| Use `event=Invoice.created`                            | Reject an uppercase event component                   |
| Use February 30 with the same digit shape              | Match lexically and reject during calendar validation |

## 7. Evolve the producer contract

Suppose one producer starts logging `TRACE` and adds an optional request ID.
Define a `requestIdField` that owns the literal prefix and captures eight
uppercase hexadecimal characters. Add it to the optional field list only when
the format permits it.

```typescript
const requestIdField = () =>
  s.merge(' request_id=', s.group('requestId', asciiHex().rep(8)));

const extendedLogFormat = {
  levels: [...baseLogFormat.levels, 'TRACE'],
  allowsRequestId: true,
} as const satisfies LogFormat;
```

`buildEventLog(extendedLogFormat)` accepts `TRACE` and a final
` request_id=AB12CD34`. The test suite runs the earlier fixtures against both
formats, verifies the `requestId` capture, and rejects the extension in the
base format. The anchored sequence, timestamp, and existing identifiers keep
their definitions. The choice of producer format belongs to the ingester.

Next, use these same boundaries to build a family of independently compiled
patterns in [Versioned API routes](/learn/versioned-api-routes/).
