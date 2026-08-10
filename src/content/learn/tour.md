---
title: 'A guided tour of STRling'
description: 'Tour STRling Pattern values, building blocks, composition, choices, optionality, repetition, captures, assertions, reuse, and portability.'
summary: 'Build one pattern progressively and learn the mental model that transfers across STRling language bindings.'
order: 3
time: '25 minutes'
keywords:
  [
    'STRling tutorial',
    'composable regex',
    'maintainable regex',
    'regular expression compiler',
  ]
related: ['/docs/core-concepts/', '/docs/compatibility/', '/packages/']
---

## 1. Patterns are values

Start with a small requirement: a three-letter product prefix.

```typescript
import { simply as s } from '@strling-lang/strling';

const prefix = s.upper(3);
```

`prefix` is a Pattern value. It can be passed to a function, stored with a domain name, combined with other Patterns, or converted to generated RegEx.

## 2. Add building blocks

A product code also has four digits:

```typescript
const serial = s.digit(4);
```

The constructor and count expose the requirement without asking a reader to decode `{4}` in context.

## 3. Compose a sequence

Put the pieces in order with a literal separator:

```typescript
const productCode = s.merge(prefix, '-', serial);
```

The hyphen string is treated as literal text. `merge` creates another Pattern value.

## 4. Add choices

Suppose imported records use either a hyphen or a space:

```typescript
const separator = s.anyOf('-', ' ');
const flexibleCode = s.merge(prefix, separator, serial);
```

This is a choice between Patterns. For a one-character set, `inChars("- ")` is another explicit option.

## 5. Make a piece optional

If compact input may omit the separator:

```typescript
const optionalSeparator = s.may(separator);
const compactCode = s.merge(prefix, optionalSeparator, serial);
```

The optional scope is the `separator` Pattern, not an adjacent token chosen by punctuation precedence.

## 6. Control repetition

Allow a serial from four through six digits:

```typescript
const flexibleSerial = s.digit(4, 6);
```

For any Pattern, use `rep`:

```typescript
const pair = s.merge(s.upper(), s.digit());
const fourPairs = pair.rep(4);
```

Repeat the smallest meaningful unit. Review nested or unbounded repetition for backtracking risk.

## 7. Capture useful data

Give extracted fields names:

```typescript
const capturedCode = s.merge(
  s.group('prefix', s.upper(3)),
  s.may(s.anyOf('-', ' ')),
  s.group('serial', s.digit(4, 6)),
);
```

Named groups are for stable, unique fields. Numbered `capture(...)` groups are useful for repeated or positional data.

## 8. Anchor the whole value

Validation usually means the complete string must match:

```typescript
const validatedCode = s.merge(s.start(), capturedCode, s.end());
```

Without anchors, a runtime search may find a valid-looking code inside a longer string.

## 9. Add an assertion

Suppose the code may be followed by a colon in a larger parser, but the colon should not be consumed:

```typescript
const beforeColon = s.merge(capturedCode, s.ahead(':'));
```

The lookahead checks context. It is not part of the matched text.

## 10. Reuse domain patterns

Move reusable concepts behind functions or constants:

```typescript
const productPrefix = s.group('prefix', s.upper(3));
const productSerial = s.group('serial', s.digit(4, 6));

const productCode = s.merge(
  s.start(),
  productPrefix,
  s.may(s.anyOf('-', ' ')),
  productSerial,
  s.end(),
);
```

Avoid reusing the same named-group Pattern twice in one final Pattern, because names must remain unique.

## 11. Convert at the runtime boundary

```typescript
const regex = new RegExp(String(productCode));
const result = regex.exec('ABC-1234');

console.assert(result?.groups?.prefix === 'ABC');
console.assert(result?.groups?.serial === '1234');
```

Keep construction and matching conceptually separate. STRling builds; the target engine executes.

## 12. Plan for portability

This tour uses broadly available sequence, literals, repetition, captures, alternatives, and anchors. Even these can differ in Unicode and runtime APIs. Assertions and advanced repetition add more constraints.

Before sharing a Pattern across targets:

1. identify the actual RegEx engines;
2. inspect emitted output;
3. run the same positive and negative fixtures;
4. avoid engine extensions unless requirements justify them;
5. record any Unicode and line-ending assumptions.

## Where to go next

- Use [Core concepts](/docs/core-concepts/) as the reference model.
- Deepen your understanding of [Groups and captures](/docs/groups-and-captures/).
- Review [Errors and diagnostics](/docs/errors-and-diagnostics/).
- Choose a binding from [Packages](/packages/).
- Track certified release details in the [Fourth Edition center](/fourth-edition/).
