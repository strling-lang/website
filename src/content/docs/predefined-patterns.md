---
title: 'Predefined patterns'
description: 'Reference verified STRling predefined character patterns for digits, letters, alphanumerics, whitespace, line controls, and boundaries.'
summary: 'The Simply API provides common Pattern constructors so application code can name intent instead of spelling standard character classes repeatedly.'
order: 9
category: 'Reference'
keywords:
  [
    'STRling predefined patterns',
    'regex digit',
    'regex whitespace',
    'regex letter class',
  ]
related: ['/docs/character-sets/', '/docs/quantifiers/', '/docs/compatibility/']
---

## Summary

Predefined patterns cover common character categories and position assertions. The canonical Python and TypeScript sources export matching positive and negative forms, with idiomatic naming.

## When to use them

Use a predefined constructor when its documented meaning matches the requirement. Prefer `digit()` over a handwritten class for ordinary RegEx digits; use an explicit range or Unicode property when the requirement is narrower or broader.

## Verified public constructors

| Intent                 | TypeScript     | Python          |
| ---------------------- | -------------- | --------------- |
| Alphanumeric           | `alphaNum`     | `alpha_num`     |
| Not alphanumeric       | `notAlphaNum`  | `not_alpha_num` |
| Letter                 | `letter`       | `letter`        |
| Uppercase ASCII letter | `upper`        | `upper`         |
| Lowercase ASCII letter | `lower`        | `lower`         |
| Hex digit              | `hexDigit`     | `hex_digit`     |
| Digit                  | `digit`        | `digit`         |
| Whitespace             | `whitespace`   | `whitespace`    |
| Newline                | `newline`      | `newline`       |
| Tab                    | `tab`          | `tab`           |
| Carriage return        | `carriage`     | `carriage`      |
| Word boundary          | `bound`        | `bound`         |
| Start/end              | `start`, `end` | `start`, `end`  |

Negative counterparts are also present, including `notDigit`/`not_digit`, `notWhitespace`/`not_whitespace`, and `notBound`/`not_bound`.

## Repetition arguments

Character constructors accept optional repetition bounds:

```typescript
const hexByte = s.hexDigit(2);
const identifier = s.alphaNum(1, 32);
```

```python
hex_byte = s.hex_digit(2)
identifier = s.alpha_num(1, 32)
```

Do not pass repetition arguments to a position assertion such as `start` or `end`.

## Build a reusable domain pattern

Predefined pieces become more valuable after receiving a domain name:

```typescript
const hexByte = s.hexDigit(2);
const macAddress = s.merge(
  hexByte,
  ':',
  hexByte,
  ':',
  hexByte,
  ':',
  hexByte,
  ':',
  hexByte,
  ':',
  hexByte,
);
```

This example checks the familiar colon-separated shape. It does not promise device-address normalization or alternative separator formats.

## Interactions with sets

Simple predefined character classes can participate in `inChars`/`in_chars` with literal characters. Composite or quantified Patterns cannot be inserted into a character set.

```python
identifier_char = s.in_chars(s.letter(), s.digit(), "_")
```

## Edge cases and errors

Names such as “letter” and “alphanumeric” need a documented alphabet. The current Simply implementation constructs explicit `A-Z` and `a-z` ranges for `letter`, while `digit` uses the RegEx digit shorthand. Do not silently treat these as every Unicode letter or decimal digit.

## Portability considerations

Shorthand classes can be engine- and flag-dependent. `\d`, `\s`, and word-boundary behavior may include different Unicode characters across targets. Use [Character sets](/docs/character-sets/) for explicit ASCII requirements and [Compatibility](/docs/compatibility/) for target differences.
