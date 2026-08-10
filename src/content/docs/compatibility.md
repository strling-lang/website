---
title: 'Compatibility and portability'
description: 'Plan portable STRling patterns across PCRE2, Python, and ECMAScript, including lookbehind, Unicode, anchors, atomic groups, and quantifiers.'
summary: 'STRling shares a pattern-building model across languages, while target RegEx engines still define feature support and matching details.'
order: 11
category: 'Operations'
keywords:
  [
    'regex compatibility',
    'portable regex',
    'regex lookbehind',
    'Unicode regex',
    'PCRE2 vs JavaScript',
  ]
related: ['/docs/lookarounds/', '/docs/anchors-and-boundaries/', '/packages/']
---

## Summary

Portability has two dimensions: the STRling binding that builds the Pattern and the RegEx engine that executes the output. A familiar Simply API does not erase differences among PCRE2, Python `re`, ECMAScript `RegExp`, and other engines.

## When to use this guide

Review compatibility before sharing a Pattern across services, switching bindings, supporting multiple browsers, or using lookbehind, Unicode properties, atomic groups, possessive quantifiers, absolute anchors, or free-spacing.

## Verified feature registry

The canonical feature registry currently records:

| Feature               | PCRE2     | Python    | ECMAScript    |
| --------------------- | --------- | --------- | ------------- |
| Atomic group          | Supported | Supported | Not supported |
| Possessive quantifier | Supported | Supported | Not supported |
| Lookbehind            | Supported | Supported | Supported     |
| Named capture group   | Supported | Supported | Supported     |

“Supported” is not a promise that every historical runtime version implements the feature. Establish your actual runtime floor.

## Important semantic differences

| Concern                   | PCRE2                        | ECMAScript                               |
| ------------------------- | ---------------------------- | ---------------------------------------- |
| Lookbehind                | Fixed-length constraints     | Modern engines; fixed-length constraints |
| Atomic groups             | Available                    | Unavailable                              |
| Possessive quantifiers    | Available                    | Unavailable                              |
| Absolute `\A`, `\Z`, `\z` | Available as extensions      | Unavailable                              |
| Free-spacing `x`          | Available                    | Unavailable                              |
| Named captures            | Available                    | Available in modern engines              |
| Unicode properties        | Available with configuration | Available with Unicode modes             |

Python behavior is close to PCRE-style syntax in some areas but is its own runtime. Let the Python emitter choose named-group syntax and test the installed Python version.

## Unicode

`letter()` in the current Simply sources is built from ASCII letter ranges. `digit()` uses the target shorthand, whose Unicode behavior can vary. Word boundaries depend on the engine’s definition of a word character.

For international text, define the requirement precisely:

- ASCII identifiers;
- Unicode general categories;
- a particular script;
- locale-sensitive case behavior;
- grapheme clusters rather than code points.

A RegEx engine matching code points does not automatically understand user-perceived characters.

## Lookbehind

Keep lookbehind deterministic in length. A fixed literal or exact repetition is more portable than alternation with different lengths or an unbounded quantifier.

```typescript
const fixed = s.behind(s.digit(3));
```

Even where syntax is supported, older browser or embedded JavaScript runtimes may lack lookbehind.

## Flags and line behavior

Multiline changes anchors; dot-all changes dot; Unicode modes change properties and sometimes case folding. Inline modifiers are explicitly disallowed by the canonical grammar; the DSL uses directives. Host-language binding APIs may expose target configuration separately.

## Practical portability workflow

1. Name the intended target engines and minimum versions.
2. Prefer core sequence, alternation, literals, simple classes, captures, and fixed quantifiers.
3. Isolate target-sensitive pieces behind a domain name.
4. Inspect emitted RegEx for each target.
5. Run shared positive and negative fixtures in every deployment runtime.
6. Treat warnings as release blockers when semantics could change.

## Current limitations

The Fourth Edition compatibility matrix is not yet certified. Binding source and some registry packages exist, but package publication does not by itself prove edition-wide parity. Consult [Packages](/packages/) for current distribution state and the [Fourth Edition center](/fourth-edition/) for provisional status.
