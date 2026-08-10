---
title: 'STRling quickstart'
description: 'Install a verified STRling package, build a readable phone-number pattern, generate RegEx, and use it in TypeScript or Python.'
summary: 'Go from package install to a working, anchored phone-number Pattern using public TypeScript and Python APIs.'
order: 1
time: '10 minutes'
keywords:
  [
    'STRling quickstart',
    'npm STRling',
    'pip install STRling',
    'readable regex tutorial',
  ]
related: ['/docs/core-concepts/', '/learn/tour/', '/packages/']
---

## Choose a verified package

The TypeScript package is published under the STRling organization scope:

```bash
npm install @strling-lang/strling
```

The established Python package is published on PyPI:

```bash
pip install strling
```

The public Python registry line and the newer canonical multi-binding source are not yet presented as one certified Fourth Edition release. Check [Python package status](/packages/python/) before migration-sensitive work.

## Build your first TypeScript Pattern

Create a phone-number shape with three captured fields and optional separators:

```typescript
import { simply as s } from '@strling-lang/strling';

const phone = s.merge(
  s.start(),
  s.capture(s.digit(3)),
  s.may(s.anyOf('-', '.', ' ')),
  s.capture(s.digit(3)),
  s.may(s.anyOf('-', '.', ' ')),
  s.capture(s.digit(4)),
  s.end(),
);
```

Read it from top to bottom:

1. start at the beginning;
2. capture three digits;
3. allow one optional separator;
4. capture three digits;
5. allow another optional separator;
6. capture four digits;
7. stop at the end.

## Generate and use the RegEx

Convert the Pattern to a string and give it to the built-in runtime:

```typescript
const regex = new RegExp(String(phone));

console.assert(regex.test('555-123-4567'));
console.assert(regex.test('555 123 4567'));
console.assert(!regex.test('call 555-123-4567 now'));
```

The documented generated RegEx is:

```regex
^(\d{3})[-. ]?(\d{3})[-. ]?(\d{4})$
```

The anchors explain the third assertion: this Pattern validates the entire string rather than searching inside it.

## The same concept in Python

Python uses snake_case where the host language expects it:

```python
import re
from STRling import simply as s

phone = s.merge(
    s.start(),
    s.capture(s.digit(3)),
    s.may(s.any_of("-", ".", " ")),
    s.capture(s.digit(3)),
    s.may(s.any_of("-", ".", " ")),
    s.capture(s.digit(4)),
    s.end(),
)

regex = re.compile(str(phone))
assert regex.match("555-123-4567")
```

The `Pattern` is responsible for construction. `RegExp` or `re` is responsible for matching.

## Name important captures

When a field has domain meaning, use a named group:

```typescript
const area = s.group('area', s.digit(3));
const exchange = s.group('exchange', s.digit(3));
const line = s.group('line', s.digit(4));
const namedPhone = s.merge(area, '-', exchange, '-', line);
```

Names must be unique within the final Pattern. Use numbered captures for repeated structures.

## Make one piece reusable

Move the separator into a named value:

```typescript
const separator = s.anyOf('-', '.', ' ');
const optionalSeparator = s.may(separator);
```

That is the central STRling habit: isolate a requirement, name it, then compose it.

## Next steps

- Read [Core concepts](/docs/core-concepts/) for the Pattern model.
- Take the [Guided tour](/learn/tour/) for choices, repetition, captures, and assertions.
- Use [From RegEx](/learn/from-regex/) to map familiar symbols to STRling calls.
- Check [Compatibility](/docs/compatibility/) before using engine-sensitive features.
