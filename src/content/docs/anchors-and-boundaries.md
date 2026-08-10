---
title: 'Anchors and boundaries'
description: 'Use STRling start, end, word boundary, and non-boundary assertions with clear multiline and cross-engine behavior.'
summary: 'Anchors and boundaries match positions rather than characters. They define where a Pattern may start, end, or cross a word edge.'
order: 8
category: 'Assertions'
keywords:
  [
    'regex anchors',
    'regex word boundary',
    'start end regex',
    'STRling boundary',
  ]
related: ['/docs/lookarounds/', '/docs/compatibility/', '/docs/core-concepts/']
---

## Summary

`start()` and `end()` represent line anchors. `bound()` and `notBound()`/`not_bound()` represent word-boundary and non-boundary assertions. They consume no character.

## When to use it

Use anchors for full-value validation, line-oriented matching, and token boundaries. Without anchors, a matching runtime may find a valid substring inside otherwise invalid text.

## Start and end

```typescript
const threeDigits = s.merge(s.start(), s.digit(3), s.end());

console.assert(new RegExp(String(threeDigits)).test('123'));
console.assert(!new RegExp(String(threeDigits)).test('x123'));
```

The documented output shape is:

```regex
^\d{3}$
```

These are line anchors. Multiline mode changes where they can match.

## Word boundaries

```python
whole_word = s.merge(s.bound(), "cat", s.bound())
```

A word boundary is the position between a word character and a non-word character, or an appropriate string edge. It does not consume whitespace or punctuation.

Use the inverse boundary when the position must remain inside or outside the same word classification:

```typescript
const internal = s.merge('cat', s.notBound());
```

## Full-value validation

Anchoring a Pattern is necessary but not sufficient for domain validation. `^\d{4}$` confirms four digits, not that those digits form a valid year for your application.

```python
year_shape = s.merge(s.start(), s.digit(4), s.end())
```

Keep shape validation in the Pattern and domain constraints in application logic when RegEx would make the rule opaque.

## Interactions with flags

The canonical DSL defines a multiline flag. In multiline mode, `^` can match after a line terminator and `$` can match before one. Dot-all changes what `.` consumes; it does not change anchor positions. Treat these flags as separate decisions.

## Absolute anchors

The formal grammar includes engine-specific absolute anchors such as `\A`, `\Z`, and `\z` as extensions. They are not core cross-target constructs and are unavailable in ECMAScript. The high-level Simply API’s `start` and `end` should not be described as absolute anchors.

## Edge cases and errors

Line-ending conventions vary. A final newline can affect `$` in ways that differ by engine and mode. Word boundaries depend on the target’s definition of a word character; they are not a language-independent tokenizer.

Inside a raw character class, `\b` can mean backspace rather than word boundary. Using the boundary constructor avoids that ambiguous placement.

## Portability considerations

`^`, `$`, `\b`, and `\B` are widely recognized, but Unicode and multiline details differ. ECMAScript word characters are primarily ASCII-oriented even with Unicode mode, while other engines can use Unicode-aware word properties. For international text, define the token requirement explicitly and test representative scripts.
