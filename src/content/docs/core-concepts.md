---
title: 'Core concepts'
description: 'Understand STRling Pattern values, the Simply API, generated regular expressions, composition, and target-runtime use.'
summary: 'STRling represents regular-expression intent as Pattern values that can be named, combined, and converted into RegEx for a target runtime.'
order: 1
category: 'Foundations'
keywords:
  ['STRling core concepts', 'readable regex', 'regex builder', 'Pattern values']
related: ['/docs/composition/', '/learn/quickstart/', '/docs/compatibility/']
---

## Summary

The Simply API is STRling’s high-level, user-facing interface. Constructors such as `digit`, `letter`, `merge`, `may`, `capture`, and `group` return **Pattern values**. A Pattern describes matching intent; converting it to a string produces a regular expression for use with a host runtime.

STRling does not ask you to abandon RegEx engines. It changes the layer where a person writes and maintains the pattern.

## When to use it

Use a Pattern value when an expression has domain meaning, will be reused, needs review, or will change over time. A short one-off RegEx can still be the clearer choice.

Pattern values are especially useful when you want to:

- name subpatterns after their role;
- assemble a larger pattern from small pieces;
- expose intent to autocomplete and host-language tooling;
- keep captures and optional sections visible;
- review target compatibility before deployment.

## Import the Simply API

TypeScript exposes `simply` from the published package:

```typescript
import { simply as s } from '@strling-lang/strling';
```

Python exposes the corresponding module with snake_case names:

```python
from STRling import simply as s
```

The concepts match, but spelling follows each host language. TypeScript uses `anyOf` and `inChars`; Python uses `any_of` and `in_chars`.

## A complete Pattern value

This example is documented in the canonical TypeScript binding:

```typescript
const phone = s.merge(
  s.start(),
  s.capture(s.digit(3)),
  s.may(s.anyOf('-', '.', ' ')),
  s.capture(s.digit(3)),
  s.may(s.anyOf('-', '.', ' ')),
  s.capture(s.digit(4)),
  s.end(),
);

const regex = new RegExp(String(phone));
console.assert(regex.test('555-123-4567'));
```

The documented generated RegEx is:

```regex
^(\d{3})[-. ]?(\d{3})[-. ]?(\d{4})$
```

The anchors, digit counts, captures, and optional separators remain recognizable in source even before you inspect the output.

## Building blocks and composition

STRling constructors fall into a few practical groups:

| Purpose          | TypeScript               | Python                   |
| ---------------- | ------------------------ | ------------------------ |
| Literal          | `s.lit("text")`          | `s.lit("text")`          |
| Sequence         | `s.merge(a, b)`          | `s.merge(a, b)`          |
| Alternative      | `s.anyOf(a, b)`          | `s.any_of(a, b)`         |
| Optional         | `s.may(value)`           | `s.may(value)`           |
| Numbered capture | `s.capture(value)`       | `s.capture(value)`       |
| Named capture    | `s.group("name", value)` | `s.group("name", value)` |

Strings passed to composition constructors are converted to literal Pattern values. Use `lit` when an explicit literal boundary makes the code easier to read.

## Observable result

`String(pattern)` in TypeScript and `str(pattern)` in Python produce a RegEx string. Pass that string to the standard matching library for the host language:

```python
import re
from STRling import simply as s

word = s.merge(s.start(), s.letter(1, 0), s.end())
compiled = re.compile(str(word))
```

The RegEx runtime performs matching. STRling constructs and emits the pattern.

## Edge cases and errors

Public constructors validate their inputs. For example, ranges must use compatible endpoints, and named groups must remain unique inside a composed Pattern. Binding-specific exception types and exact messages can differ.

Generated RegEx can also be valid in one engine and unavailable in another. Atomic groups and possessive quantifiers are examples of features supported by PCRE2 but not ECMAScript.

## Portability considerations

The same Pattern vocabulary does not mean all RegEx engines have identical behavior. Lookbehind, Unicode word classes, absolute anchors, free-spacing, and possessive quantifiers have target-specific rules. Treat target selection as part of the pattern’s requirements and read [Compatibility](/docs/compatibility/) before relying on an engine-sensitive feature.

## Next steps

Continue with [Composition](/docs/composition/) to learn how Pattern values combine, or follow the [Quickstart](/learn/quickstart/) to install a verified package and run the phone-number example.
