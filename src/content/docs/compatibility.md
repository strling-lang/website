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

## Choose an exact target

An authoring binding, a compiler target profile, and an executing RegEx engine are separate choices. A versioned target profile records specific capability and lowering facts. An unlisted feature does not inherit support by analogy. Compilation can reject a request when a semantic requirement cannot be preserved for the selected profile.

The Fourth Edition source includes profiles for ECMAScript 2024, PCRE2 10.42 and 10.43, and Python `re` 3.11 in Unicode-string and bytes modes. These are distinct profiles. See the [pinned profile data](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/targets/profiles) and the historical support matrix linked from [release and verification status](/project/#release-status) for governed evidence and scope.

## Practical portability workflow

1. Record engine, exact version, host, options, flags, and input domain.
2. Keep engine-sensitive requirements explicit. Check lookbehind width, atomicity, capture updates, Unicode classes, and line behavior in the exact profile.
3. Review compiler diagnostics and inspect the emitted artifact, including flags and emitted capture syntax.
4. Execute shared positive and negative fixtures under each deployment runtime.

## Evidence and availability

[Packages](/packages/) lists public distributions and binding tiers. The [TypeScript binding page](/packages/typescript/) distinguishes npm's declared Node range from observed runtime evidence. RegEx Docs describes generic feature meanings and source-specific manifestations. [RegEx Compatibility](/regex/compatibility/) surfaces certified Regex Conformance observations when an accepted checkpoint is configured. Those observations have their own exact scope and are separate from STRling target-lowering evidence.
