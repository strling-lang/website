---
title: 'Composition'
description: 'Compose maintainable regex with STRling sequences, alternatives, optional pieces, captures, and reusable Pattern values.'
summary: 'Composition is the center of STRling: build small Pattern values, give them domain names, and combine them without manually splicing RegEx strings.'
order: 2
category: 'Foundations'
keywords:
  [
    'composable regex',
    'maintainable regex',
    'regex composition',
    'regex alternative',
  ]
related: ['/docs/core-concepts/', '/docs/groups-and-captures/', '/learn/tour/']
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Sequence, choice, and optionality

`merge` places pieces in order. `anyOf` chooses a whole alternative. `may` makes its operand optional. In TypeScript, passing several pieces to `may` makes their sequence optional as a unit. Strings in those calls are literal text.

```typescript
const extension = s.anyOf('pdf', 'txt');
const draft = s.may('-', 'draft');
const pattern = s.merge(s.start(), 'report', draft, '.', extension, s.end());
const expression = compilePattern(pattern);
console.log(expression.test('report-draft.pdf')); // true
console.log(expression.test('report-.txt')); // false
```

## Reusable pieces and captures

Reuse named pieces to keep requirements visible. The TypeScript facade records a new operation for each occurrence of a reused fragment. A capture's logical identity differs from its name or eventual target slot. Two declarations of the same capture name can make the complete pattern invalid, even across alternatives. Put a named capture around the choice when both alternatives should populate the same field.

Composition remains subject to the target constraints of its parts. See [Groups and captures](/docs/groups-and-captures/) and [Compatibility](/docs/compatibility/).
