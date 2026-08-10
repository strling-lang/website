---
title: 'Lookarounds'
description: 'Express positive and negative lookahead and lookbehind with STRling, including fixed-length requirements and ECMAScript portability.'
summary: 'Lookarounds assert surrounding text without consuming it. Named constructors make direction and polarity explicit.'
order: 7
category: 'Assertions'
keywords:
  [
    'regex lookbehind',
    'regex lookahead',
    'STRling lookaround',
    'negative lookahead',
  ]
related:
  [
    '/docs/anchors-and-boundaries/',
    '/docs/compatibility/',
    '/docs/quantifiers/',
  ]
---

## Summary

Lookarounds test what appears before or after the current position without consuming that text. STRling exposes positive and negative forms through named functions.

## When to use it

Use a lookaround when a match depends on context that should not be part of the returned match: a digit preceded by a currency sign, a word not followed by a suffix, or a token before a delimiter.

## Syntax and API

| Intent              | TypeScript       | Python            | RegEx form |
| ------------------- | ---------------- | ----------------- | ---------- |
| Positive lookahead  | `s.ahead(p)`     | `s.ahead(p)`      | `(?=...)`  |
| Negative lookahead  | `s.notAhead(p)`  | `s.not_ahead(p)`  | `(?!...)`  |
| Positive lookbehind | `s.behind(p)`    | `s.behind(p)`     | `(?<=...)` |
| Negative lookbehind | `s.notBehind(p)` | `s.not_behind(p)` | `(?<!...)` |

## Lookahead example

Match a letter only when a digit follows:

```typescript
const letterBeforeDigit = s.merge(s.letter(), s.ahead(s.digit()));
const match = new RegExp(String(letterBeforeDigit)).exec('A1');
console.assert(match?.[0] === 'A');
```

The digit satisfies the assertion but is not consumed by this Pattern.

## Lookbehind example

Match a digit only when a letter precedes it:

```python
digit_after_letter = s.merge(s.behind(s.letter()), s.digit())
match = re.search(str(digit_after_letter), "A1")
assert match.group(0) == "1"
```

## Negative assertions

Use a negative assertion when the surrounding text must not match:

```typescript
const notPlural = s.merge(s.lit('cat'), s.notAhead('s'));
```

This describes “`cat` not immediately followed by `s`.” It does not add `s` to the match.

## Interactions with composition

A lookaround is a zero-width Pattern and can be placed inside `merge`. It can contain composed Patterns, subject to target restrictions. Captures inside lookarounds can be difficult to reason about and should be tested against the actual runtime before application code depends on them.

## Fixed-length lookbehind

The canonical semantics require lookbehind to have deterministic length for PCRE2 and ECMAScript targets. A fixed literal or fixed digit count is suitable; an unbounded repetition is not.

```typescript
const valid = s.behind(s.digit(3));
const notPortable = s.behind(s.digit(1, 0));
```

The second Pattern has variable length and should produce a diagnostic or rejection for targets with fixed-length requirements.

## Edge cases and errors

An assertion can succeed at a position where the consuming part later fails. Debug the whole sequence, not just the assertion. Multiple nested assertions can also be correct but harder to maintain than a simpler capture-and-check workflow.

Unsupported lookbehind should never be silently rewritten into different behavior. The specification calls for an unsupported-feature or engine-incompatibility diagnostic.

## Portability considerations

ECMAScript supports lookbehind in modern engines, but environment age still matters. The formal feature registry treats lookbehind as supported for current PCRE2, Python, and ECMAScript targets, with fixed-length constraints. Verify the actual browsers or server runtimes in your support matrix.
