---
title: 'Errors and diagnostics'
description: 'Understand STRling API validation, syntax errors, target incompatibility, structured diagnostics, and practical debugging workflows.'
summary: 'STRling can reject invalid API inputs before matching and the formal compiler contract defines structured errors and warnings for syntax and target compatibility.'
order: 10
category: 'Operations'
keywords:
  [
    'regex errors',
    'STRling diagnostics',
    'regex debugging',
    'regex compatibility error',
  ]
related:
  ['/docs/compatibility/', '/docs/quantifiers/', '/docs/literals-and-escaping/']
---

## Locate the failure

Host-side argument errors and adapter loading, ABI, or transport errors can occur before a compiler result is available. Source parsing, semantic validation, planning, and target lowering can return a structured compile failure. Once an artifact has been returned and loaded, the RegEx engine is responsible for execution. A valid pattern may produce no match.

## Use structured results

Inspect the outcome, diagnostic codes, stages, and any applicable source spans. Diagnostic identifiers depend on the contract and route. For example, the Semantic STRling dialect uses `STRL-DSL-*` identities. Its source spans are half-open UTF-8 byte ranges. The [canonical contract suite](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/contracts/1.0) defines diagnostic data, and each frontend's contract defines its own source failures. Use structured fields instead of parsing human-readable messages.

## Investigate a mismatch

1. Record the input dialect or builder protocol and the exact binding and package version.
2. Inspect the compile outcome and requested artifact before executing it.
3. Reproduce with the exact target profile, emitted flags, engine version, and matching mode.
4. Compare positive and negative fixtures, including boundaries and optional captures.

The [TypeScript walkthrough](/learn/production-event-logs/) checks the compile result before constructing a RegExp. Use runtime input budgets and performance measurements where execution risk matters. A successful compilation is no guarantee about the cost of a match.
