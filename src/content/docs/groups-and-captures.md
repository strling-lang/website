---
title: 'Groups and captures'
description: 'Use numbered captures, named capture groups, and non-capturing structure with STRling while avoiding duplicate names and portability mistakes.'
summary: 'Captures extract matched text. STRling makes the choice between numbered and named groups visible through capture and group constructors.'
order: 6
category: 'Pattern structure'
keywords:
  [
    'regex capture groups',
    'named regex groups',
    'STRling capture',
    'regex group',
  ]
related: ['/docs/composition/', '/docs/lookarounds/', '/learn/from-regex/']
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Logical captures and target slots

`capture` records an unnamed capture and `group(name, ...parts)` records a named capture over the supplied sequence. Canonical capture identities differ from source names and emitted group numbers. The emitted engine syntax determines how the host accesses those captures. In JavaScript, matched text comes from `RegExp.exec` and named values are available in `groups`.

```typescript
const digits = s.between('0', '9');
const pattern = s.merge(
  s.start(),
  s.group('year', digits.rep(4)),
  '-',
  s.group('month', digits.rep(2)),
  s.end(),
);
const match = compilePattern(pattern).exec('2026-11');
console.log(match?.groups?.month); // 11
```

## Repetition and optional captures

Repeating a capture does not allocate a new target slot per iteration. The value retained after repetition and the representation of nonparticipation depend on the engine and profile. For repeated extraction, consider iterating separate matches or capturing the entire run and processing its items in application code. Use unique names and check the runtime's absent-capture values.
