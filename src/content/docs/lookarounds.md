---
title: 'Lookarounds'
description: 'Express positive and negative lookahead and lookbehind with STRling, including fixed-length requirements and ECMAScript portability.'
summary: 'Lookarounds assert surrounding text without consuming it. Named constructors make direction and polarity explicit.'
order: 7
category: 'Assertions'
keywords:
  [
    'regex lookbehind',
    'regex lookahead',
    'STRling lookaround',
    'negative lookahead',
  ]
related:
  [
    '/docs/anchors-and-boundaries/',
    '/docs/compatibility/',
    '/docs/quantifiers/',
  ]
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Lookahead and lookbehind

A lookahead checks context at the current position without consuming it. Lookbehind checks context ending at that position. `ahead` and `behind` are positive assertions. Their `notAhead` and `notBehind` counterparts require the condition to fail.

```typescript
const label = s.merge(s.between('A', 'Z').rep(2), s.ahead(':'));
const match = compilePattern(label).exec('AB:123');
console.log(match?.[0]); // AB
```

## Target restrictions

A structurally valid lookbehind still needs to lower for the exact target. Fixed width is a useful starting constraint across targets, but engines and compiler profiles differ. Keep lookaround captures out of portability assumptions. A successful assertion leaves the overall match position unchanged. Captures inside the assertion can still be observable under the engine's rules.
