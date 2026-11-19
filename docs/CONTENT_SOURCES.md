# STRling website content sources

Last release and distribution evidence review: 2026-11-19.

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

| Source                                  | Public evidence used                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `strling-lang/strling`                  | 17 binding directories; Simply APIs; TypeScript and Python examples; manifests; feature registry; grammar; semantics; conformance fixtures; Apache License 2.0; distribution workflow                                                                  |
| `strling-lang/regex-conformance`        | Immutable Regex Semantic Feature Corpus snapshot; 16 canonical categories; 269 canonical features; variants, manifestations, relations, operations, and exact source bindings at the 2026-09-08 declared cutoff (semantic source rechecked 2026-10-04) |
| `strling-lang/STRling.py`               | Established Python API/package history and PyPI identity                                                                                                                                                                                               |
| `strling-lang/STRling.js`               | Established JavaScript API/package history                                                                                                                                                                                                             |
| `strling-lang/.github`                  | Organization identity and the remotely referenced silver bell mark                                                                                                                                                                                     |
| Product release and public verification | See [Fourth Edition](#fourth-edition) for pinned product and distribution authority.                                                                                                                                                                   |

Registry versions are time-sensitive evidence, not promises. Update `src/data/bindings.ts` only after rechecking the live record and repository ownership.

## Generic regex semantics and compatibility

The Regex Feature Catalog consumes the promoted immutable snapshot at
`semantic-corpus/snapshots/regex-semantic-features-2026-09-08.v4.json`. The
public `semantic-corpus/authority/current.v1.json` identifies it as current,
verified at revision `3285cc9fa8310df0af00fa50724d65531e0695d9`. Its
reviewed semantic digest is
`e2c99c582ad9c8f2875060f9cb9d3ec0da8057f554ac09477f8e07b96da30b05`.
The checked-in website lock and documentation projection are derived consumer
artifacts, not another taxonomy. Notion is not a machine source.

Feature pages may explain the corpus’s semantic definitions, typed relations,
variants, manifestations, operations, and test concepts. They must label syntax
and API forms as source-specific and must not infer empirical support from a
documented manifestation. Compatibility is modeled as the complete canonical
feature universe left-joined with certified evidence for an exact profile.

Only features in the promoted snapshot become canonical public feature pages.
Research candidates alone do not establish publication authority. The v4
consumer retains source-bound assertions and the typed interactions explicitly
carried forward from the immutable v1 snapshot.

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

The package directory uses versioned registry coordinates and source routes
verified against public distribution evidence. It renders these facts from
`src/data/bindings.ts`.

The TypeScript Learn examples pin published package versions to keep the two
API generations reproducible. The legacy quickstart uses TypeScript `3.0.0` and
Python `2.5.9`, and the legacy tour uses TypeScript `3.0.0`. The Advanced and
Frontier examples use the verified Fourth Edition TypeScript Preview adapter
on Node 22 with its bundled canonical WebAssembly compiler. The package
declares Node `>=22 <23`. Website lesson tests exercise that setup. The upstream
release evidence leaves Node 22 unexecuted, records a Node 24 observation
outside that range, and records browser WebAssembly at Preview tier. The examples use the
[ECMAScript 2024 profile](https://github.com/strling-lang/strling/blob/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/targets/profiles/ecmascript-2024.json)
and [profile reference](https://github.com/strling-lang/strling/blob/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/contracts/1.0/examples/compile-request/equivalence-explanation.json)
from the same canonical revision. `tests/unit/pattern-engineering.test.mjs`
runs the lesson fixtures against the compiler's emitted artifact. The results
cover that exact target and runtime.

## Fourth Edition

The [official release](https://github.com/strling-lang/strling/releases/tag/v4.0.3)
identifies the certified source and links the publication receipts. The
[independent verification run](https://github.com/strling-lang/strling/actions/runs/44580786117/attempts/1)
verified 232 obligations across the 16 routes authorized for initial publication.
Supported consumers were exercised in the reported platform scopes. Preview
verification covers public artifacts and associated evidence. The C++ ConanCenter
route was explicitly deferred. The release documents the direct CMake build.

The [website release-status addendum](https://strling-lang.netlify.app/project/#release-status)
records the post-publication result. Keep the certified support matrix pinned
as historical evidence. Its introductory publication language predates release,
and the GitHub release description predates the successful verification run.
Use the addendum and verification run when citing current publication status.

To synchronize after a release:

1. Check the latest public GitHub Release, its product tag and certified source
   commit against the upstream release policy. Review the policy, support
   matrix, publication receipts, and final independent verification report.
2. Check each exact registry coordinate against live metadata and artifact
   availability. Verify governed Git tags against the certified product SHA
   and confirm the ecosystem resolves each advertised install route.
3. Refresh the checked-in release evidence and shared binding data first. Update
   each package version independently of the product version. Preserve distinctions
   between registry publication, Git distribution, and the direct C++ build.
4. Check tutorial package pins separately. Run the compiler fixtures before
   changing a pin. Keep historical API pins explicit. Run the website checks,
   build, and package and discovery tests. Static builds use the checked-in
   evidence and need no network calls for this data. The reduced review record
   in `tests/fixtures/release-evidence.json` pins the upstream policy commit
   and SHA-256. To check the original policy during review, set
   `STRLING_RELEASE_POLICY_FILE` to a local copy of the exact upstream JSON bytes
   and run `npm test`.

## Website versus owning repositories

The website owns user learning, public explanation, navigation, examples,
accessibility, and discoverability. Owning repositories retain language,
semantic, empirical, implementation, architecture, governance, contribution,
and release authority. Website CI must fail when the current canonical Regex
Conformance snapshot drifts from the reviewed source lock.
