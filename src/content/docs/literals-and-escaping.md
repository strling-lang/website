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

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Host strings, source literals, and target escaping

Pass literal text to `lit` or the string arguments of composition functions. The host first decodes its own string syntax. STRling records the resulting text and escapes it when emitting for the chosen target. Pre-escaping it for RegEx can accidentally introduce a literal backslash.

```typescript
const pattern = s.merge(s.start(), s.lit('report.pdf'), s.end());
const expression = compilePattern(pattern);
console.log(expression.test('report.pdf')); // true
console.log(expression.test('reportXpdf')); // false
```

## Which textual grammar applies?

Semantic STRling `1.0.0` has its own quoted strings and closed escape list. The regex compatibility dialect `1.0.0` has separate syntax and import rules. A target RegEx string has a third syntax and may require host-language escaping when placed in source code. Start from the dialect contract linked in [Core concepts](/docs/core-concepts/), especially when comparing backslashes or Unicode escapes.
