---
title: 'Character sets'
description: 'Build readable regex character classes and ranges with STRling inChars, notInChars, between, and predefined character patterns.'
summary: 'Character-set constructors express one-character membership, negation, and ranges without requiring handwritten bracket syntax.'
order: 4
category: 'Pattern syntax'
keywords:
  [
    'regex character classes',
    'regex character sets',
    'character range regex',
    'STRling inChars',
  ]
related:
  [
    '/docs/predefined-patterns/',
    '/docs/quantifiers/',
    '/docs/literals-and-escaping/',
  ]
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Membership in one character position

`inChars` combines literal scalars and eligible set fragments. `notInChars` negates membership. Use `between` for an inclusive, ordered Unicode scalar range. A set consumes one character within the chosen domain. With alternatives, each branch may instead match a sequence.

```typescript
const separator = s.inChars('-', '.', '_');
const hex = s.inChars(s.between('0', '9'), s.between('A', 'F'));
const expression = compilePattern(
  s.merge(s.start(), hex.rep(2), separator, hex.rep(2), s.end()),
);
console.log(expression.test('A0.FF')); // true
console.log(expression.test('AG.FF')); // false
```

## Domain and validation

Use explicitly ordered scalar endpoints. The legacy same-case restriction does not describe the current Unicode scalar range contract. A sequence or quantified Pattern cannot serve as a literal set member. Use explicit ASCII ranges for protocol identifiers. Builtin classes and negation have a domain, and Unicode behavior is part of the target assessment.
