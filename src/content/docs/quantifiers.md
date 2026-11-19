---
title: 'Quantifiers'
description: 'Control optional, exact, bounded, unbounded, greedy, lazy, and possessive repetition in STRling and understand target compatibility.'
summary: 'Quantifiers repeat the smallest Pattern they wrap. STRling exposes count bounds and repetition modes through named methods and constructor arguments.'
order: 5
category: 'Pattern syntax'
keywords:
  [
    'regex quantifiers',
    'regex repetition',
    'greedy lazy regex',
    'possessive quantifier',
  ]
related:
  [
    '/docs/composition/',
    '/docs/compatibility/',
    '/docs/errors-and-diagnostics/',
  ]
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Exact, bounded, and unbounded counts

`rep(3)` repeats exactly three times. `rep(2, 4)` permits two through four. In this TypeScript facade, a second argument of `0` denotes an unbounded maximum. In canonical Simply records the unbounded maximum is JSON `null`. In the Semantic STRling textual dialect it is the keyword `unbounded`. Keep those three forms separate.

```typescript
const unit = s.merge(s.between('A', 'Z'), s.between('0', '9'));
const expression = compilePattern(s.merge(s.start(), unit.rep(2, 3), s.end()));
console.log(expression.test('A1B2')); // true
console.log(expression.test('A1B2C3D4')); // false
```

## Repetition modes and capture effects

Greedy and lazy modes control which counts are tried first. A possessive repeat prevents backtracking into the repeat after it succeeds. The canonical contracts represent these modes. The TypeScript 4.0.3 convenience Pattern does not expose the legacy fluent `.lazy()` or `.possessive()` calls. Use the appropriate textual construct or an explicit Simply repeat operation, then check the target plan for the requested mode.

Repeat the unit whose count you intend. A repeated capture generally exposes one slot with runtime-specific update behavior. Ambiguous nested repetition can still be expensive. Measure execution with representative inputs in the actual engine.
