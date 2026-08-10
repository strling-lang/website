---
title: 'Composition'
description: 'Compose maintainable regex with STRling sequences, alternatives, optional pieces, captures, and reusable Pattern values.'
summary: 'Composition is the center of STRling: build small Pattern values, give them domain names, and combine them without manually splicing RegEx strings.'
order: 2
category: 'Foundations'
keywords:
  [
    'composable regex',
    'maintainable regex',
    'regex composition',
    'regex alternative',
  ]
related: ['/docs/core-concepts/', '/docs/groups-and-captures/', '/learn/tour/']
---

## Summary

Composition turns a dense regular expression into a set of smaller values. `merge` creates a sequence, `anyOf`/`any_of` creates alternatives, and `may` makes a piece optional. The result is another Pattern value, so composition can continue at any depth.

## When to use it

Compose patterns when individual parts have different responsibilities: a protocol, domain, separator, date field, capture, or assertion. Naming those parts makes reviews and later changes local.

## Sequence with `merge`

`merge` matches each argument in order. String arguments become literals.

```typescript
const year = s.digit(4);
const month = s.digit(2);
const day = s.digit(2);
const isoDate = s.merge(year, '-', month, '-', day);
```

The observable structure is four digits, a literal hyphen, two digits, another hyphen, and two digits:

```regex
\d{4}-\d{2}-\d{2}
```

This describes shape, not calendar validity. A RegEx that accepts `2026-99-99` still needs domain validation.

## Alternatives with `anyOf` and `any_of`

Use alternatives when one position can match one of several patterns:

```typescript
const imageExtension = s.anyOf('png', 'jpg', 'webp');
const filename = s.merge(s.letter(1, 0), '.', imageExtension);
```

Python uses the same idea:

```python
image_extension = s.any_of("png", "jpg", "webp")
filename = s.merge(s.letter(1, 0), ".", image_extension)
```

Do not confuse alternation with a character set. `anyOf("cat", "dog")` chooses a whole alternative; `inChars("cd")` matches one character from a set.

## Optional pieces with `may`

`may` wraps one or more pieces as a zero-or-one unit:

```typescript
const sign = s.may(s.anyOf('+', '-'));
const integer = s.merge(sign, s.digit(1, 0));
```

When `may` receives multiple arguments, they are treated as one optional sequence. Use separate calls when each piece should be independently optional.

## Reusable pieces

A Pattern is a normal host-language value:

```typescript
const separator = s.anyOf('-', '.', ' ');
const block3 = s.capture(s.digit(3));

const phone = s.merge(
  s.start(),
  block3,
  s.may(separator),
  s.capture(s.digit(3)),
  s.may(separator),
  s.capture(s.digit(4)),
  s.end(),
);
```

Reusable pieces should have names that describe the domain, not the RegEx token. `areaCode` is usually more useful than `threeDigits` once a pattern is application-specific.

## Interactions with groups and quantifiers

Composition controls ordering and choice. [Groups and captures](/docs/groups-and-captures/) control extraction, while [quantifiers](/docs/quantifiers/) control repetition. Apply a quantifier to the smallest Pattern that should repeat.

```python
label = s.group("label", s.letter(1, 0))
assignment = s.merge(label, s.may(s.whitespace()), "=", s.may(s.whitespace()), s.digit(1, 0))
```

## Edge cases and errors

All named groups inside a composed Pattern must be unique. The Python implementation explicitly checks `merge`, `may`, `any_of`, and capture constructors for duplicate group names and raises `STRlingError` when a name appears more than once.

Empty or incorrectly typed arguments can also fail binding validation. Keep component types narrow and test the generated RegEx as part of application behavior.

## Portability considerations

Sequence, alternation, and simple optionality are broadly portable. The pieces you compose may not be. A sequence containing lookbehind, atomic grouping, or a Unicode property still inherits that feature’s target constraints.
