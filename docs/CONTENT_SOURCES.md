# STRling website content sources

Last evidence review: 2026-08-09.

This policy keeps public user documentation factual. Website copy may summarize observable behavior; it must not turn internal plans or incomplete code into release guarantees.

## Authority order

1. Public implementation, tests, formal grammar, and semantics in [`strling-lang/strling`](https://github.com/strling-lang/strling) on its default branch.
2. Live package-registry records when describing public availability.
3. Established Python and JavaScript repository history when explaining the existing public package line.
4. Organization-owned identity and contribution material in [`strling-lang/.github`](https://github.com/strling-lang/.github).
5. Explicit provisional language when evidence is incomplete.

The website repository itself is not a source for compiler behavior merely because a claim already appears in copy.

## Sources reviewed

| Source                    | Public evidence used                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `strling-lang/strling`    | 17 binding directories; Simply APIs; TypeScript and Python examples; manifests; feature registry; grammar; semantics; conformance fixtures; MIT license; distribution workflow |
| `strling-lang/STRling.py` | Established Python API/package history and PyPI identity                                                                                                                       |
| `strling-lang/STRling.js` | Established JavaScript API/package history                                                                                                                                     |
| `strling-lang/.github`    | Organization identity and the remotely referenced silver bell mark                                                                                                             |
| PyPI                      | `STRling` public package, version 2.5.9 at review time                                                                                                                         |
| npm                       | `@strling-lang/strling` public package, version 3.0.0 at review time                                                                                                           |
| NuGet                     | `STRling` and `STRling.FSharp`, version 3.0.0 at review time                                                                                                                   |
| Pub.dev                   | `strling`, version 3.0.0 at review time                                                                                                                                        |
| RubyGems                  | `strling`, version 3.0.0 at review time                                                                                                                                        |
| Packagist and MetaCPAN    | No matching verified release at review time                                                                                                                                    |

Registry versions are time-sensitive evidence, not promises. Update `src/data/bindings.ts` only after rechecking the live record and repository ownership.

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

## Website versus GitHub

The website owns user learning, observable API behavior, examples, errors, compatibility, and use cases. GitHub owns implementation, architecture, engineering governance, contribution workflow, and release mechanics.
