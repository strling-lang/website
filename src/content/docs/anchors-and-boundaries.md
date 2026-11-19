---
title: 'Anchors and boundaries'
description: 'Use STRling start, end, word boundary, and non-boundary assertions with clear multiline and cross-engine behavior.'
summary: 'Anchors and boundaries match positions rather than characters. They define where a Pattern may start, end, or cross a word edge.'
order: 8
category: 'Assertions'
keywords:
  [
    'regex anchors',
    'regex word boundary',
    'start end regex',
    'STRling boundary',
  ]
related: ['/docs/lookarounds/', '/docs/compatibility/', '/docs/core-concepts/']
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Strict input positions

In the current TypeScript facade, `start()` and `end()` record strict input positions. They do not mean line start or line end. Raw `^` and `$` depend on engine and mode, including rules around final line terminators. The compiler lowers strict input positions according to the chosen profile.

```typescript
const pattern = s.merge(s.start(), s.between('0', '9').rep(3), s.end());
const expression = compilePattern(pattern);
console.log(expression.test('123')); // true
console.log(expression.test('123\n')); // false
console.log(expression.test('x123')); // false
```

## Word boundaries

Word-boundary assertions consume no character. Their behavior depends on the selected word domain and target support. In the TypeScript facade `bound()` and `notBound()` record word-boundary and inverse word-boundary intent. They do not segment natural-language words. Line positions and strict input positions are distinct operations. Whole-value matching confirms lexical shape and leaves application validation to the caller.
