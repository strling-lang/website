---
title: 'Quantifiers'
description: 'Control optional, exact, bounded, unbounded, greedy, lazy, and possessive repetition in STRling and understand target compatibility.'
summary: 'Quantifiers repeat the smallest Pattern they wrap. STRling exposes count bounds and repetition modes through named methods and constructor arguments.'
order: 5
category: 'Pattern syntax'
keywords:
  [
    'regex quantifiers',
    'regex repetition',
    'greedy lazy regex',
    'possessive quantifier',
  ]
related:
  [
    '/docs/composition/',
    '/docs/compatibility/',
    '/docs/errors-and-diagnostics/',
  ]
---

## Summary

Quantifiers specify how many times a Pattern may repeat. STRling uses constructor bounds, `may`, and Pattern repetition methods rather than requiring handwritten `?`, `*`, `+`, or brace syntax.

## When to use it

Use repetition for fixed-width fields, bounded identifiers, lists, optional sections, and runs of a character class. Keep the repeated Pattern as small as the requirement allows.

## Static constructor bounds

Many predefined constructors accept `min` and `max` arguments:

```typescript
const exactlyThree = s.digit(3);
const twoToFour = s.letter(2, 4);
const oneOrMore = s.alphaNum(1, 0);
```

The public API uses `0` as the unbounded maximum. Omitting `max` means “exactly `min`” for these constructors.

| STRling call     | RegEx shape               | Meaning                  |
| ---------------- | ------------------------- | ------------------------ |
| `s.digit(3)`     | `\d{3}`                   | exactly three digits     |
| `s.letter(2, 4)` | letter class with `{2,4}` | two through four letters |
| `s.digit(1, 0)`  | `\d+`                     | one or more digits       |
| `s.may(value)`   | value with `?`            | zero or one occurrence   |

## Repeat any Pattern

Pattern values expose `rep` for repetition:

```typescript
const pair = s.merge(s.letter(), s.digit());
const fourPairs = pair.rep(4);
```

Grouping required for correct precedence is handled by the generated structure. This is one advantage of repeating a Pattern value instead of concatenating raw strings.

## Greedy and lazy repetition

Greedy repetition consumes as much as it can while allowing the rest of the pattern to match. Lazy repetition consumes as little as it can.

```typescript
const shortRun = s.letter().rep(1, 5).lazy();
```

Choose lazy mode because the matching requirement calls for the earliest viable boundary, not as a general performance fix.

## Possessive repetition

Possessive quantifiers do not backtrack after consuming text:

```typescript
const digits = s.digit().rep(1, 0).possessive();
```

This is an engine-sensitive feature. The formal feature registry marks possessive quantifiers as available for PCRE2 and Python targets and unavailable for ECMAScript.

## Interactions with captures

Repeating a numbered capture can affect how many capture slots or which captured value a runtime exposes. Named groups cannot safely be duplicated by repetition in the public Simply model. Repeat the content inside one group, or use numbered captures when repeated extraction is required.

## Edge cases and errors

Invalid bounds—negative counts, a minimum greater than a finite maximum, or a quantifier with no preceding Pattern—must be rejected. Exact error timing differs between fluent API validation, compiler validation, and the target runtime.

Nested unbounded quantifiers can create severe backtracking behavior. STRling’s diagnostic specification reserves structured warnings such as `REDOS_RISK`, but not every binding or code path should be assumed to diagnose every risky expression today.

## Portability considerations

Greedy and lazy forms are widely supported. Possessive quantifiers and atomic grouping are not supported by ECMAScript. Even portable syntax can have performance differences by engine, input, and surrounding alternatives. Benchmark critical patterns with realistic hostile and benign inputs.
