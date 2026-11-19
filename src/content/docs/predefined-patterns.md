---
title: 'Predefined patterns'
description: 'Reference verified STRling predefined character patterns for digits, letters, alphanumerics, whitespace, line controls, and boundaries.'
summary: 'The Simply API provides common Pattern constructors so application code can name intent instead of spelling standard character classes repeatedly.'
order: 9
category: 'Reference'
keywords:
  [
    'STRling predefined patterns',
    'regex digit',
    'regex whitespace',
    'regex letter class',
  ]
related: ['/docs/character-sets/', '/docs/quantifiers/', '/docs/compatibility/']
---

The examples on this page use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Run each fragment with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Specify the alphabet

In the TypeScript facade, `letter()` records ASCII A–Z and a–z ranges. `digit()` and `whitespace()` record builtin classes with a Unicode domain. Use a literal range when your requirement is explicitly ASCII and inspect the plan and artifact when builtin domains matter. Position assertions such as `start()` and `end()` are separate from character constructors.

```typescript
const hex = s.inChars(s.between('0', '9'), s.between('A', 'F'));
const byte = compilePattern(s.merge(s.start(), hex.rep(2), s.end()));
console.log(byte.test('AF')); // true
console.log(byte.test('AＦ')); // false
```

## Registry-backed helpers

The canonical Essential-5 registry defines narrowly scoped helpers for email, URL, UUID, IP, and date-time shapes, with documented variants. The 4.0.3 TypeScript facade exposes these as `email`, `url`, `uuid`, `ip`, and `dateTime`. They record a governed helper identity and parameters using Simply 1.1. The Rust compiler constructs the canonical pattern. A helper declared as a lexical shape does not establish calendar validity, address reachability, or application policy compliance. Check the [versioned registry](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/stdlib/registry).
