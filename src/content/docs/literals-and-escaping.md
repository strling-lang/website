---
title: 'Literals and escaping'
description: 'Use STRling literal patterns safely and understand host-language strings, RegEx metacharacter escaping, and character-class differences.'
summary: 'Literal Pattern values represent text to match as text. STRling handles RegEx metacharacter escaping, while the host language still controls string-literal escaping.'
order: 3
category: 'Pattern syntax'
keywords:
  [
    'regex escaping',
    'regex literal',
    'STRling lit',
    'escape regular expression',
  ]
related:
  [
    '/docs/character-sets/',
    '/docs/composition/',
    '/docs/errors-and-diagnostics/',
  ]
---

## Summary

Use `s.lit(value)` for an explicit literal Pattern. Composition constructors also accept strings and convert them to literals. Literal text is escaped for RegEx output so punctuation such as `.` keeps its textual meaning.

## When to use it

Use literals for fixed words, punctuation, delimiters, file extensions, protocol markers, and any text that should not be interpreted as RegEx syntax.

## Syntax and API

The API spelling is the same in Python and TypeScript:

```typescript
const dot = s.lit('.');
const filename = s.merge('report', dot, s.digit(1, 0));
```

```python
dot = s.lit(".")
filename = s.merge("report", dot, s.digit(1, 0))
```

Passing `"."` directly to `merge` has the same literal intent. `lit` is valuable when the boundary deserves emphasis or when a literal is reused.

## Simple example

```typescript
const version = s.merge('v', s.digit(1, 0), '.', s.digit(1, 0));
```

The dot is emitted as an escaped literal rather than the RegEx “any character” operator:

```regex
v\d+\.\d+
```

## Two escaping layers

There are two parsers involved:

1. Your programming language parses the source string.
2. The RegEx engine parses STRling’s generated expression.

For ordinary punctuation, `lit` keeps the second layer out of your source code. Control characters such as newline and tab still follow the host language’s string rules.

```python
line_break = s.lit("\n")  # Python creates a newline character.
```

If you need the two visible characters backslash and `n`, provide those characters according to the host language’s string syntax. Test the resulting value before assuming a raw string and a normal string are interchangeable.

## Literals inside character sets

A character set has different RegEx rules. Use `inChars`/`in_chars` to express one-of-these-characters intent instead of constructing a bracket expression manually.

```typescript
const separator = s.inChars('-._');
```

Hyphen, closing bracket, and leading caret are especially sensitive inside raw RegEx character classes. The set constructor keeps that context in the API.

## Interactions with composition

Strings passed to `merge`, `may`, `capture`, `group`, and alternatives are normalized as literal Pattern values. This makes a sequence such as `s.merge("https", "://")` readable without repeated `lit` calls.

Use [Composition](/docs/composition/) to decide where fixed text ends and a reusable Pattern begins.

## Edge cases and errors

An empty literal can produce an empty matching unit, which is rarely useful when quantified. Unknown or malformed escape sequences in the lower-level STRling DSL are specified as syntax errors; the Simply API normally avoids those by building structured nodes.

Never paste an untrusted string into a raw RegEx and assume it is literal. Build it through the binding’s literal API and verify the output for the target you use.

## Portability considerations

Basic escaped punctuation is widely portable. Unicode code points, control escapes, and how a target engine treats lone surrogates or invalid scalar values can differ. The canonical specification defines escape forms, but emitters remain responsible for rejecting unsupported target behavior.
