---
title: 'Character sets'
description: 'Build readable regex character classes and ranges with STRling inChars, notInChars, between, and predefined character patterns.'
summary: 'Character-set constructors express one-character membership, negation, and ranges without requiring handwritten bracket syntax.'
order: 4
category: 'Pattern syntax'
keywords:
  [
    'regex character classes',
    'regex character sets',
    'character range regex',
    'STRling inChars',
  ]
related:
  [
    '/docs/predefined-patterns/',
    '/docs/quantifiers/',
    '/docs/literals-and-escaping/',
  ]
---

## Summary

Use a character set when one position may contain one of several characters. STRling provides explicit constructors for included characters, excluded characters, and letter or digit ranges.

## When to use it

Character sets are appropriate for separators, constrained identifiers, hexadecimal digits, ASCII ranges, and “anything except” rules. Use alternatives when each choice can contain more than one character.

## Syntax and API

| Intent             | TypeScript               | Python                    |
| ------------------ | ------------------------ | ------------------------- |
| Include characters | `s.inChars("abc")`       | `s.in_chars("abc")`       |
| Exclude characters | `s.notInChars("abc")`    | `s.not_in_chars("abc")`   |
| Inclusive range    | `s.between("a", "z")`    | `s.between("a", "z")`     |
| Negated range      | `s.notBetween("a", "z")` | `s.not_between("a", "z")` |

The `between` endpoints must both be single letters of the same case or both be single digits.

## Simple examples

```typescript
const separator = s.inChars('-._');
const lowercase = s.between('a', 'z');
const notDigit = s.notBetween(0, 9);
```

The corresponding RegEx shapes are:

```regex
[-._]
[a-z]
[^0-9]
```

## Combine sets with repetition

Static constructors and ranges accept repetition bounds. This pattern matches two through eight lowercase ASCII letters:

```python
identifier = s.between("a", "z", 2, 8)
```

For a mixed identifier, compose set-like pieces:

```typescript
const first = s.inChars(s.letter(), '_');
const rest = s.inChars(s.alphaNum(), '_').rep(0, 0);
const identifier = s.merge(first, rest);
```

Here a maximum of `0` is the public API’s unbounded convention. Consult [Quantifiers](/docs/quantifiers/) before applying it broadly.

## Character set versus alternatives

`inChars("cat")` matches one character: `c`, `a`, or `t`. `anyOf("cat", "dog")` chooses one whole word. The difference is observable in repetition and capture behavior.

## Interactions with predefined patterns

`digit`, `letter`, `alphaNum`, `whitespace`, and their negated forms are predefined building blocks. They can be placed inside `inChars` when the binding accepts non-composite set patterns.

## Edge cases and errors

Reversed ranges such as `between("z", "a")` and mixed-case endpoints such as `between("a", "Z")` are invalid in the public implementations. Numeric endpoints are limited to single digits from 0 through 9.

Composite patterns—sequences, alternatives, groups, quantifiers, and lookarounds—do not belong inside `inChars`. Use `anyOf`/`any_of` for those.

## Portability considerations

ASCII ranges are predictable. Shorthands such as `\w` and Unicode properties can change meaning by engine and flags. A “letter” concept is not automatically the same as all Unicode letters in every target. State whether your requirement is ASCII, a particular script, or a Unicode property.
