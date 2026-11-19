---
title: 'From RegEx to STRling'
description: 'Translate literals, character classes, sequencing, alternatives, optionality, repetition, captures, lookarounds, and anchors from RegEx into STRling.'
summary: 'Keep the RegEx concepts you already know and express them through readable Pattern constructors instead of dense punctuation.'
order: 2
time: '15 minutes'
difficulty: beginner
keywords:
  [
    'RegEx vs STRling',
    'regex alternative',
    'readable regular expressions',
    'regex builder tutorial',
  ]
related:
  ['/docs/composition/', '/docs/groups-and-captures/', '/docs/lookarounds/']
---

The examples use the [TypeScript 4.0.3 Preview adapter](/packages/typescript/). Start with the [Core concepts setup](/docs/core-concepts/#run-the-examples).

## Translate intent before syntax

Identify the input domain, boundaries, and captures you intend. Recreate that intent with Simply operations and compile for an explicit target profile. The table describes source intent. Inspect the artifact for the target's actual spelling and flags.

| RegEx intent            | TypeScript Simply          |
| ----------------------- | -------------------------- |
| Literal text            | `s.lit('report.pdf')`      |
| Sequence                | `s.merge(a, b)`            |
| Alternatives            | `s.anyOf(a, b)`            |
| Optional sequence       | `s.may(a, b)`              |
| Explicit ASCII digits   | `s.between('0', '9')`      |
| Two to four occurrences | `piece.rep(2, 4)`          |
| Named capture           | `s.group('serial', piece)` |
| Positive lookahead      | `s.ahead(piece)`           |
| Strict input boundaries | `s.start()`, `s.end()`     |

## Check the translated pattern

The expression accepts a literal label, an optional hyphen, and two through four ASCII digits. The capture contains only the digits. The host RegEx engine performs the match.

```typescript
const serial = s.between('0', '9').rep(2, 4);
const pattern = s.merge(
  s.start(),
  'ID',
  s.may('-'),
  s.group('serial', serial),
  s.end(),
);
const expression = compilePattern(pattern);
console.log(expression.exec('ID-042')?.groups?.serial); // 042
console.log(expression.test('ID-０４２')); // false
console.log(expression.test('ID-042\n')); // false
```

Use a character set for one position and alternatives for whole patterns. Keep lookaround width, Unicode classes, and matching mode in the portability review. To import raw source programmatically, use the versioned regex compatibility frontend and its documented accepted subset. See [Core concepts](/docs/core-concepts/#source-languages-and-version-boundaries) for the distinction between that import dialect and the Semantic STRling textual language.
