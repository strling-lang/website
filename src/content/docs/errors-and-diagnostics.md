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

## Summary

Errors can occur at three layers: host-language API validation, STRling compilation or emission, and the target RegEx runtime. Identify the layer before acting on the message.

## When to use this guide

Use this page when a constructor rejects an argument, a target does not support a feature, generated RegEx fails at runtime, or a pattern matches differently than expected.

## API validation

Simply constructors validate their own contracts. A reversed range is an example:

```python
invalid = s.between("z", "a")
```

The Python implementation raises `STRlingError` because the start must not be greater than the end. Other checked cases include incompatible range endpoints, composite Patterns inside a character set, and duplicate named groups.

## Canonical diagnostic categories

The public semantics define structured diagnostic codes for compiler and emitter workflows:

| Code                       | Meaning                                               |
| -------------------------- | ----------------------------------------------------- |
| `SYNTAX_ERROR`             | Input violates the STRling grammar                    |
| `UNSUPPORTED_FEATURE`      | The target does not implement the requested construct |
| `ENGINE_INCOMPATIBILITY`   | The feature exists but target semantics differ        |
| `AMBIGUOUS_ESCAPE`         | An escape could be interpreted differently            |
| `AMBIGUOUS_FLAG_SEMANTICS` | Requested flag behavior differs by target             |
| `REDOS_RISK`               | A pattern may have dangerous backtracking behavior    |
| `UNKNOWN_DIRECTIVE`        | Tooling encountered an unrecognized directive         |

The specification describes error, warning, and informational severities with source ranges. Do not assume every current binding exposes every diagnostic hook through the same public API.

## Debugging a mismatch

Work from structure to runtime:

1. Inspect each named Pattern value separately.
2. Print or log the generated RegEx in a development environment.
3. Confirm target engine and flags.
4. Reduce the input to the smallest failing case.
5. Check quantifier scope, alternation, and optional groups.
6. Test boundary cases and non-matches, not only the happy path.

```typescript
const pattern = s.merge(s.start(), s.digit(3), s.end());
console.log(String(pattern));
```

The output is evidence for the emitter stage. A valid output that matches unexpectedly is a runtime or requirement problem, not necessarily a compiler error.

## Interaction errors

Correct pieces can form an incorrect whole. An unbounded repetition inside another repetition can create backtracking risk. A named capture reused in two alternatives can violate uniqueness. A lookbehind containing a variable quantifier can be structurally valid but incompatible with the target.

## Error-message portability

Exception class names, message wording, and when validation occurs can differ by binding. Application code should not parse human-readable messages as a stable machine protocol unless that binding documents the format.

## Security and performance

No pattern builder can make every expression safe automatically. Avoid ambiguous nested repetitions, constrain untrusted input length, set runtime limits when available, and benchmark hostile cases. Treat a ReDoS warning as a prompt for review, not as a complete security proof.

## Reporting a problem

Include the binding and package version, target RegEx engine, STRling source, generated RegEx, input sample, expected result, and actual diagnostic. Compiler or binding behavior belongs in the [canonical compiler repository](https://github.com/strling-lang/strling/issues); website documentation issues belong in the [website repository](https://github.com/strling-lang/website/issues).
