---
title: 'Policy-driven import records'
description: 'Generate STRling record patterns from typed format policies, verify field captures, and validate dates and monetary amounts in application code.'
summary: 'Generate transaction-record patterns from typed field specifications, reusable formatting rules, and configurable record requirements.'
order: 6
time: '40 minutes'
difficulty: advanced
keywords:
  [
    'data validation',
    'configurable regex',
    'structured input formats',
    'typed pattern generation',
    'maintainable regular expressions',
  ]
related:
  [
    '/learn/versioned-api-routes/',
    '/docs/character-sets/',
    '/docs/compatibility/',
  ]
---

## 1. Specify the import format

A batch ingestion service receives three kinds of transaction records. It
reads one line at a time, removes the line delimiter, checks the shape, then
passes the captured fields to the transaction layer.

```text
PAY|2026-11-18|USD|acct-4821|125.50|ref-7F3A
REFUND|2026-11-18|USD|acct-4821|25.00|ref-7F3B
TRANSFER|2026-11-18|USD|acct-4821|500.00|ref-7F3C|to=acct-7351
```

Every field separator is one literal pipe. Fields are case sensitive and use
the ASCII forms below. Quoting and escaping are outside this format's grammar.
A backslash carries no special meaning, and an embedded pipe is always a field
boundary. Empty fields, whitespace padding, and trailing delimiters are invalid.
These are example application policies.

| Field                  | Lexical contract                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Kind                   | `PAY`, `REFUND`, or `TRANSFER`                                                                              |
| Date                   | `YYYY-MM-DD`, with exactly ten characters                                                                   |
| Currency               | One of the exact currency literals configured for the kind                                                  |
| Source and destination | `acct-` followed by 4–8 ASCII digits. The destination has a `to=` prefix and is required only for transfers |
| Amount                 | 1–8 ASCII digits, one decimal point, and exactly two fractional digits                                      |
| Reference              | `ref-` followed by 4–8 uppercase hexadecimal digits                                                         |
| Metadata               | When permitted, a final optional `meta=` field with 1–12 lowercase ASCII letters, digits, or hyphens        |

A conventional ECMAScript pattern for the base refund format could be written
as the following pattern text, with multiline mode off.

```regex
^(?<kind>REFUND)\|(?<date>[0-9]{4}-[0-9]{2}-[0-9]{2})\|(?<currency>USD)\|(?<sourceAccount>acct-[0-9]{4,8})\|(?<amount>[0-9]{1,8}\.[0-9]{2})\|(?<reference>ref-[0-9A-F]{4,8})(?![\s\S])
```

It makes the fixed grammar precise. Repeating the common account, amount, and
reference fragments in two more expressions makes it harder to review whether
each format has the same field bounds. The next steps assign common rules to
field factories and record the differences in a small catalog.

## 2. Build field factories with explicit captures

Reuse the lexical date and ranges from [Production event logs](/learn/production-event-logs/).
`decimalDate()` is capture-free, so a caller can use it in a timestamp or
name it `date` now. The configured currency list becomes literal choices;
the shared `choices` helper builds a single literal when the list has one
entry. Source and destination share one account rule, with separate names in
the final pattern.

```typescript
const dateField = () => s.group('date', decimalDate());
const currencyField = (currencies: RecordFormat['currencies']) =>
  s.group('currency', choices(currencies));
const accountField = (name: 'sourceAccount' | 'destinationAccount') =>
  s.group(name, 'acct-', asciiDigit().rep(4, 8));
const amountField = () =>
  s.group('amount', asciiDigit().rep(1, 8), '.', asciiDigit().rep(2));
const referenceField = () => s.group('reference', 'ref-', asciiHex().rep(4, 8));
const destinationField = () =>
  s.merge('to=', accountField('destinationAccount'));
```

Each factory returns a `Pattern`. Separators between fields belong to the
record generator. A prefix inside a field, such as `to=`, belongs with that
field. Captures store the value a downstream consumer needs, so the destination
capture contains `acct-7351` without its `to=` key.

## 3. Represent record policies in TypeScript

The application selects which currencies are admitted for each kind and when
suffixes occur. A nonempty tuple gives `choices` at least one literal to build.
The complete source uses a mapped type and `satisfies` to check that every
`RecordKind` has a catalog entry whose `kind` matches its key.

```typescript
type RecordKind = 'PAY' | 'REFUND' | 'TRANSFER';
type Currency = 'USD' | 'EUR' | 'GBP';

interface RecordFormat {
  readonly kind: RecordKind;
  readonly currencies: readonly [Currency, ...Currency[]];
  readonly requiresDestination: boolean;
  readonly allowsMetadata: boolean;
}

type FormatCatalog = {
  readonly [Kind in RecordKind]: RecordFormat & { readonly kind: Kind };
};
```

| Base format | Currencies   | Destination | Metadata   |
| ----------- | ------------ | ----------- | ---------- |
| `PAY`       | `USD`, `EUR` | Prohibited  | Prohibited |
| `REFUND`    | `USD`        | Prohibited  | Prohibited |
| `TRANSFER`  | `USD`, `GBP` | Required    | Prohibited |

Treat the object as trusted application configuration. If it comes from JSON
or a database, validate the kind keys, currencies, and field policies before
generating patterns. TypeScript types describe what callers may provide in
code and are erased when the program runs.

## 4. Generate and compile a pattern per kind

`buildRecordPattern` creates the required field list and appends a destination
if configured. Every required field gets a literal `|`. The optional metadata
branch wraps both the delimiter and the field, so omitting metadata never
leaves a dangling separator.

```typescript
export function buildRecordPattern(format: RecordFormat): s.Pattern {
  const requiredFields = [
    dateField(),
    currencyField(format.currencies),
    accountField('sourceAccount'),
    amountField(),
    referenceField(),
  ];
  if (format.requiresDestination) requiredFields.push(destinationField());

  return s.merge(
    s.start(),
    s.group('kind', format.kind),
    ...requiredFields.map((field) => s.merge('|', field)),
    ...(format.allowsMetadata ? [s.may('|', metadataField())] : []),
    s.end(),
  );
}
```

As in [Versioned API routes](/learn/versioned-api-routes/), the application
builds a catalog once. Here the key is the record kind. `compileRecords` walks
the format values, builds one pattern per kind, and compiles each through the
same exact target profile. `matchRecord` uses the text before the first pipe
to select the matcher, then executes it against the entire line. This preserves
all the validation and capture behavior of the anchored pattern.

Download the <a href="/examples/pattern-engineering/policy-driven-import-records.ts" download>complete import example</a>.
Reuse the [Node and compiler setup](/learn/production-event-logs/#5-compile-for-ecmascript-and-run-in-node)
with the same three shared files. Save this snippet as `example.ts`.

```typescript
import { loadPatternCompiler } from './compiler.ts';
import {
  compileRecords,
  formats,
  matchRecord,
  parseRecordValues,
} from './policy-driven-import-records.ts';

const catalog = compileRecords(formats, await loadPatternCompiler());
const line = 'TRANSFER|2026-11-18|USD|acct-4821|500.00|ref-7F3C|to=acct-7351';
const fields = matchRecord(catalog, line);
if (!fields?.date || !fields.amount) throw new Error('Invalid record shape');
const values = parseRecordValues(fields.date, fields.amount);
console.log(
  fields.kind,
  fields.destinationAccount,
  values.minorUnits.toString(),
);
```

This prints `TRANSFER acct-7351 50000`. The matching behavior comes from the
compiled ECMAScript artifact. `parseRecordValues` runs afterward in ordinary
application code.

## 5. Change two policies and retest the catalog

Suppose the payment feed starts accepting GBP. Add the currency to its row.
The refund feed also needs an optional channel tag, stored as bounded metadata.
The metadata factory is shown here with the two updated catalog entries.

```typescript
const metadataField = () =>
  s.merge(
    'meta=',
    s.group('metadata', s.inChars(asciiLower(), asciiDigit(), '-').rep(1, 12)),
  );

const formats = {
  ...baseFormats,
  PAY: { ...baseFormats.PAY, currencies: ['USD', 'EUR', 'GBP'] },
  REFUND: { ...baseFormats.REFUND, allowsMetadata: true },
} as const satisfies FormatCatalog;
```

The generator already knows where the optional field can go. The two revised
rows change which records match. For a new shape, give it a field factory and
make its required or optional position explicit in the model. Keep the previous
catalog around if two partners use different versions of the format, and
choose the catalog through feed configuration.

## 6. Exercise the fixtures at the runtime boundary

Use the three scenario lines as baselines. Assert named group values for a
match and a `null` result for rejected shapes. Run the baseline fixtures
against both policy catalogs.

| Fixture or change                                             | Expected result                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| The three baseline lines                                      | Match `PAY`, `REFUND`, and `TRANSFER`; only the transfer has a `destinationAccount` capture |
| Payment with `EUR`                                            | Match both catalogs                                                                         |
| Payment with `GBP`                                            | Match the updated catalog only                                                              |
| Refund with `\|meta=web-2`                                    | Match the updated catalog with `metadata` equal to `'web-2'`                                |
| Refund without metadata                                       | Match both catalogs; the updated matcher reports `metadata` as undefined                    |
| Account `acct-12345678`, reference `ref-7F3ABCDE`             | Match eight-character identifier bodies at their upper bounds                               |
| `CHARGEBACK` or refund with `EUR`                             | Reject unknown kind or excluded currency                                                    |
| Amount `125.5`, `-125.50`, or `125,50`                        | Reject malformed amount shapes                                                              |
| Replace a separator with `;` or omit the source account value | Reject incorrect field boundaries                                                           |
| Remove the transfer destination or add one to a payment       | Reject destination policy violations                                                        |
| Use `ref-7f3Z` or nine account digits                         | Reject character or field-length violations                                                 |
| Split `acct-4821` with an embedded pipe                       | Reject a broken field                                                                       |
| Append `\|extra=1`, a pipe, or a newline                      | Reject trailing input                                                                       |
| Use `2026-02-30` or `0.00`                                    | Match the lexical shape and reject when validating the captured values                      |

## 7. Validate domain rules on captured values

The example parses the date as UTC and compares the date portion of its ISO
round trip to the capture. A normalized February 30 therefore fails. It joins
the integral and fractional digits and passes them to `BigInt`. With the fixed
two-digit fraction, `125.50` becomes exactly `12550n` minor units. The application
checks positivity, the receiving system's amount range, and whether two minor
digits are appropriate for each configured currency and operation. Keep those
rules in code that sees the parsed amount and currency together.

Next, check account ownership and access, verify that the destination is
eligible, apply transaction limits, and enforce reference uniqueness in the
ingestion system. A RegEx match establishes the lexical fields; the transaction
layer owns the authorization and business decision.

## 8. Know when to move to a parser

To add a fourth operation with this same field order, extend the kind union,
add a required catalog row, and run the same fixture matrix against it. If a
feed starts supporting quoted delimiters, escaped quotes, embedded newlines, or
record types with independently versioned layouts, parse the stream with a
format-aware parser first. Apply smaller patterns to individual fields where
they still help. For RFC 4180 CSV, use a CSV parser and keep these lexical rules
at the field-validation boundary.
