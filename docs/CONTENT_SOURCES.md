# STRling website content sources

Last evidence review: 2026-08-22.

This policy keeps public user documentation factual. Website copy may summarize observable behavior; it must not turn internal plans or incomplete code into release guarantees.

## Authority by claim type

Authority follows the claim; the website does not merge these domains into one
source order.

1. [`strling-lang/strling`](https://github.com/strling-lang/strling) on its
   default branch is authoritative for STRling language, compiler, binding,
   grammar, formal semantic, fixture, and implementation behavior.
2. [`strling-lang/regex-conformance/semantic-corpus`](https://github.com/strling-lang/regex-conformance/tree/main/semantic-corpus)
   on its default branch is authoritative for canonical generic regex semantic
   identities, definitions, variants, aliases, manifestations, relations,
   operations, and source bindings.
3. Certified empirical observations in Regex Conformance will be authoritative
   for compatibility results once that evidence is available. Absence of
   evidence means unknown or not yet available; it does not mean unsupported.
4. Live package-registry records are authoritative for current public package
   availability. Established Python and JavaScript repository history supports
   descriptions of the existing public package line.
5. [`strling-lang/.github`](https://github.com/strling-lang/.github) is
   authoritative for organization-owned identity and contribution material.
6. Use explicit provisional language when controlling evidence is incomplete.

The website owns public presentation, explanation, navigation, examples,
accessibility, and discoverability. It is not semantic, compiler, package, or
empirical authority merely because a claim already appears in website copy.

## Sources reviewed

| Source                           | Public evidence used                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strling-lang/strling`           | 17 binding directories; Simply APIs; TypeScript and Python examples; manifests; feature registry; grammar; semantics; conformance fixtures; Apache License 2.0; distribution workflow                           |
| `strling-lang/regex-conformance` | Immutable Regex Semantic Feature Corpus snapshot; 14 canonical categories; 251 canonical features; variants, manifestations, relations, operations, and exact source bindings at the 2026-08-22 declared cutoff |
| `strling-lang/STRling.py`        | Established Python API/package history and PyPI identity                                                                                                                                                        |
| `strling-lang/STRling.js`        | Established JavaScript API/package history                                                                                                                                                                      |
| `strling-lang/.github`           | Organization identity and the remotely referenced silver bell mark                                                                                                                                              |
| PyPI                             | `STRling` public package, version 2.5.9 at review time                                                                                                                                                          |
| npm                              | `@strling-lang/strling` public package, version 3.0.0 at review time                                                                                                                                            |
| NuGet                            | `STRling` and `STRling.FSharp`, version 3.0.0 at review time                                                                                                                                                    |
| Pub.dev                          | `strling`, version 3.0.0 at review time                                                                                                                                                                         |
| RubyGems                         | `strling`, version 3.0.0 at review time                                                                                                                                                                         |
| Packagist and MetaCPAN           | No matching verified release at review time                                                                                                                                                                     |

Registry versions are time-sensitive evidence, not promises. Update `src/data/bindings.ts` only after rechecking the live record and repository ownership.

## Generic regex semantics and compatibility

The Regex Feature Catalog consumes the promoted immutable snapshot at
`semantic-corpus/snapshots/regex-semantic-features-2026-08-22.v1.json`. Its
reviewed semantic digest is
`350bfea4c3da07b3426d885aa8ff645ac55539bbb1294a2ea35dd5319541d6c7`.
The checked-in website lock and documentation projection are derived consumer
artifacts, not another taxonomy. Notion is not a machine source.

Feature pages may explain the corpus’s semantic definitions, typed relations,
variants, manifestations, operations, and test concepts. They must label syntax
and API forms as source-specific and must not infer empirical support from a
documented manifestation. Compatibility is modeled as the complete canonical
feature universe left-joined with certified evidence for an exact profile.

The nine unresolved legacy candidates remain research records upstream. They
are not canonical public feature pages unless a future reviewed semantic
snapshot promotes them.

## API examples

Prefer examples that exist in public binding README files or are direct compositions of exported functions whose behavior is covered by source and tests. Current safe examples use:

- `merge`, `may`, `capture`, `group`;
- `anyOf`/`any_of` and `inChars`/`in_chars`;
- `between` and negated range/set forms;
- `digit`, `letter`, `alphaNum`/`alpha_num`, whitespace and control patterns;
- `ahead`, `behind`, and negative lookarounds;
- `start`, `end`, `bound`, and inverse boundaries;
- Pattern repetition methods documented in source.

When output is shown as exact, it must come from authoritative documentation or a verified implementation run. Conceptual output should be labeled a “shape” rather than guaranteed byte-for-byte output.

## Install commands

Only two registry commands are currently displayed because they are explicitly documented in canonical source:

```text
pip install strling
npm install @strling-lang/strling
```

Other package pages link to source or a verified registry without inventing a command.

## Fourth Edition

The edition is pre-release. Public source supports discussion of shared binding vocabulary, specification/conformance infrastructure, target diagnostics, and distribution preparation. Final version, date, certified package matrix, complete compatibility guarantees, and migration guidance remain provisional.

## Website versus owning repositories

The website owns user learning, public explanation, navigation, examples,
accessibility, and discoverability. Owning repositories retain language,
semantic, empirical, implementation, architecture, governance, contribution,
and release authority. Website CI must fail when the current canonical Regex
Conformance snapshot drifts from the reviewed source lock.
