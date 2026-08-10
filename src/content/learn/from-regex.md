---
title: 'From RegEx to STRling'
description: 'Translate literals, character classes, sequencing, alternatives, optionality, repetition, captures, lookarounds, and anchors from RegEx into STRling.'
summary: 'Keep the RegEx concepts you already know and express them through readable Pattern constructors instead of dense punctuation.'
order: 2
time: '15 minutes'
keywords:
  [
    'RegEx vs STRling',
    'regex alternative',
    'readable regular expressions',
    'regex builder tutorial',
  ]
related:
  ['/docs/composition/', '/docs/groups-and-captures/', '/docs/lookarounds/']
---

## The translation model

STRling does not discard regular-expression concepts. It names them. A constructor produces a Pattern, composition combines Patterns, and the emitter produces target RegEx.

| RegEx intent        | TypeScript               | Python                   |
| ------------------- | ------------------------ | ------------------------ |
| literal text        | `s.lit("text")`          | `s.lit("text")`          |
| sequence            | `s.merge(a, b)`          | `s.merge(a, b)`          |
| alternatives        | `s.anyOf(a, b)`          | `s.any_of(a, b)`         |
| optional            | `s.may(value)`           | `s.may(value)`           |
| repeated class      | `s.digit(2, 4)`          | `s.digit(2, 4)`          |
| numbered capture    | `s.capture(value)`       | `s.capture(value)`       |
| named capture       | `s.group("name", value)` | `s.group("name", value)` |
| positive lookahead  | `s.ahead(value)`         | `s.ahead(value)`         |
| positive lookbehind | `s.behind(value)`        | `s.behind(value)`        |
| start/end           | `s.start()`, `s.end()`   | `s.start()`, `s.end()`   |

## Literals

Raw RegEx:

```regex
report\.pdf
```

STRling:

```typescript
const filename = s.merge('report', '.', 'pdf');
```

Strings in composition are literal. The generated RegEx escapes the dot.

## Digits and character classes

Raw RegEx:

```regex
[A-Z]\d{3}
```

STRling:

```typescript
const code = s.merge(s.between('A', 'Z'), s.digit(3));
```

For a custom one-character set, use `inChars`/`in_chars`:

```python
separator = s.in_chars("-._")
```

## Sequencing

RegEx concatenates tokens. STRling makes the sequence explicit:

```typescript
const isoDate = s.merge(s.digit(4), '-', s.digit(2), '-', s.digit(2));
```

Each part can become a named value before it is merged.

## Alternatives

Raw RegEx:

```regex
cat|dog
```

STRling:

```typescript
const pet = s.anyOf('cat', 'dog');
```

Alternatives choose whole Patterns. A character set chooses one character.

## Optionality

Raw RegEx:

```regex
https?
```

Readable intent:

```typescript
const protocol = s.merge('http', s.may('s'));
```

The `may` call shows exactly which Pattern is optional.

## Repetition

Raw RegEx:

```regex
\d{2,4}
```

STRling:

```python
digits = s.digit(2, 4)
```

Use a maximum of `0` for unbounded repetition in the public Simply API:

```python
one_or_more = s.digit(1, 0)
```

## Numbered and named captures

Raw numbered group:

```regex
(\d{3})
```

STRling:

```typescript
const area = s.capture(s.digit(3));
```

Raw named-group syntax changes by engine. STRling keeps the source call stable:

```typescript
const area = s.group('area', s.digit(3));
```

The target emitter is responsible for the appropriate RegEx spelling.

## Lookarounds

Raw positive lookahead:

```regex
[A-Za-z](?=\d)
```

STRling:

```typescript
const letterBeforeDigit = s.merge(s.letter(), s.ahead(s.digit()));
```

Raw positive lookbehind:

```regex
(?<=[A-Za-z])\d
```

STRling:

```python
digit_after_letter = s.merge(s.behind(s.letter()), s.digit())
```

Keep lookbehind fixed in length for current PCRE2 and ECMAScript portability.

## Anchors and boundaries

Raw full-value shape:

```regex
^\d{3}$
```

STRling:

```typescript
const exact = s.merge(s.start(), s.digit(3), s.end());
```

Use `bound()` around a word instead of embedding `\b` into a string.

## What not to translate mechanically

A direct token-for-token rewrite can preserve a hard-to-read design. Use the migration as a chance to name domain pieces, remove incidental captures, constrain repetition, and record target assumptions.

Next, read [Composition](/docs/composition/) or take the complete [Guided tour](/learn/tour/).
