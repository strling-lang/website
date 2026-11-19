---
title: 'Core concepts'
description: 'Understand STRling frontends, Semantic IR, canonical compilation, exact target profiles, and runtime execution.'
summary: 'Author semantic intent in text or through Simply, compile for an explicit profile, and execute the resulting artifact in its target engine.'
order: 1
category: 'Foundations'
keywords:
  ['STRling core concepts', 'readable regex', 'regex builder', 'Pattern values']
related: ['/docs/composition/', '/learn/quickstart/', '/docs/compatibility/']
---

## From intent to execution

Write pattern intent in a textual frontend or construct it through a Simply binding. The canonical Rust compiler normalizes the input into Semantic IR, an intermediate representation of pattern meaning. It analyzes that representation and, when target output is requested, plans and lowers it against the exact target profile selected in the request. The result can contain diagnostics and requested artifacts. An emitted artifact can map generated spans back to the source. Your target RegEx engine executes the emitted pattern and flags against a subject.

Host-language adapters record operations or carry requests to the shared compiler. Their host-facing methods and argument checks can differ. They share the compiler for semantic analysis and target lowering.

## Source languages and version boundaries

- **Semantic STRling** is the keyword-and-block textual frontend. Its normative dialect is `strling.semantic@1.0.0`.
- **Regex compatibility** imports the versioned regex-shaped `strling.regex-compat@1.0.0` dialect. Input spelling alone does not select a target.
- **Simply** is a host-language construction frontend. The TypeScript facade records operations using `strling.simply-builder@1.1.0`. Protocol 1.1 retains 1.0 and adds the registry-backed `stdlib_helper` operation. Host method names are distinct from protocol operation names.

These contracts have authority within their declared scopes. The broader STRling Semantic Specification 1.0 remains an unratified draft. The compiler release, source dialects, builder protocol, serialization and interoperability contracts, target-profile revisions, and engine versions each have their own version identities. See the [pinned specification hub](https://github.com/strling-lang/strling/blob/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/README.md).

## Run the examples

Use Node.js 22.12 or later within the package's Node 22 range. In an ESM npm project, install the [pinned TypeScript package](/packages/typescript/) and save the <a href="/examples/pattern-engineering/compiler.ts" download>compiler helper</a> and its <a href="/examples/pattern-engineering/ecmascript-2024.json" download>ECMAScript target profile</a> alongside your example. Run the file with `node --experimental-strip-types example.ts`. The helper loads the bundled WebAssembly compiler, requests output for ECMAScript 2024 profile 1.3.0, checks the compile result, and constructs a JavaScript RegExp.

```typescript
import * as s from '@strling-lang/strling/simply';
import { loadPatternCompiler } from './compiler.ts';

const compilePattern = await loadPatternCompiler();
```

Add a fragment below this setup. `Pattern.compile(...)` sends a recorded Simply request to the compiler. The Fourth Edition adapter retired implicit string rendering, `Pattern.exec`, and `Pattern.toRegExp`.

```typescript
const pattern = s.merge(s.start(), 'report', s.may('.pdf'), s.end());
const expression = compilePattern(pattern);
console.log(expression.test('report.pdf')); // true
console.log(expression.test('report.pdf\n')); // false
```

## A textual program

This complete Semantic STRling program requests a case-sensitive literal. The source selector and statements end in semicolons. Sequence and choice use explicit blocks of at least two children. The compile request separately determines whether to request target output and which exact profile to use.

```text
semantic strling 1.0;
case sensitive;
pattern text "hello";
```

The [TypeScript binding's source example](https://github.com/strling-lang/strling/blob/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/bindings/typescript/README.md#node-use) shows how to submit it with `sourceCompileRequest`. The [dialect contract](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/frontends/semantic/1.0) defines strings, comments, escape sequences, and source diagnostics.

## What the compiler returns

A compile result reports its outcome and diagnostics. Request a target artifact to obtain the selected engine's pattern and flags when lowering succeeds. Structured explanations and conversions have their own contracts and scopes. Matching, capture values, and subject positions in a JavaScript RegExp result come from the engine. A failed search is separate from a failed compilation.

Continue with [Composition](/docs/composition/) and [Compatibility](/docs/compatibility/).
