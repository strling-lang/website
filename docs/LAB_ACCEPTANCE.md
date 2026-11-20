# STRling Lab and RegEx Lab acceptance

**Release decision — BLOCKED.** The compiler owner has admitted the
independently reproduced `0.1.0-rc.3` adapter for isolated website
qualification. Production distribution requires a separate governed artifact
and owner approval. Ordinary builds use the sealed 4.0.3 compiler and report
canonical formatting, semantic conversion and bounded no-match explanation as
unavailable. The follow-up adds bounded native PCRE2 and CPython structure
views and reproducible PCRE2 scan continuation.

## Revisions and compiler decision

| Component              | Evaluated identity                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website                | Integrated `main` at `674e06a70a8f86ae9a1cb18061111be949f8e785`. Source-only merge of website PR #1 without deployment authorization.                                                                                                                                                                                                                   |
| Published compiler     | `@strling-lang/strling@4.0.3`, source `d01ac3785736ad552c90f00b4ca13c0e2e5c9c62`, packaged WASM SHA-256 `6a24a334d5d7e78b17c09e6d9a62d33299d65ac79e52212c4f8db130250656d7`                                                                                                                                                                              |
| Historical adapter     | `strling-lab-wasm 0.1.0-rc.1`, source `3f1cf5faef7b6177e67adbe10147470cba47be8d`, based on `4e58730bbf67eaff683268e285e7084ccda5fadd`. WASM SHA-256 `640fd5c4c205cff8c69ca46c7933f1351194e3861306cef137d67e1354ea5d72`. Retained as earlier local evidence.                                                                                             |
| Historical adapter     | `strling-lab-wasm 0.1.0-rc.2`, source `8ba008b048d46c0ab209c5b15ca82fb2aaaeb110`, same compiler base and protocol `strling.lab-compiler-tools@1.0.0-rc.1`. Two local relocated builds produced the same SHA-256 `283ff9d319b4a28220aeac8b187834b12fc6634c9ad1beb9be3be4d4247cc04b`. The independent hosted Windows rebuild failed the digest assertion. |
| Pinned private adapter | `strling-lab-wasm 0.1.0-rc.3`, source `156a0b54186e1d457fd47696d9f088e2c8b23360`, same compiler base and protocol. Independent workspaces and named versus stable Rust 1.97.1 toolchains produced 2,548,656 bytes at SHA-256 `3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81`.                                                        |

The sealed `strling.interop@1.0.0` descriptor exposes only `describe`,
`compile`, `target_profile.inspect`, and `simply.compile`. Neither its
versioned ABI nor its published WASM exports offer another path to these
operations. The compiler-side adapter calls the existing parser and canonical
formatter, proof-carrying converter, semantic explanation builder, and
bounded evaluator. The kernel change supplies a monotonic clock in WASM
while retaining the native clock and the existing budget policy. The website
passes verified compile output to the adapter and presents the result.
The candidate has its own lock, descriptor, digest, worker, and asset path.
The hosted Windows rebuild of rc.2 found an artifact identity mismatch.
The successor extends path remapping to the Rust toolchain so embedded
panic locations are stable across build hosts.
Both hosted source matrices passed for rc.3. Compiler PR #151 admitted the
verified artifact for isolated Website qualification and merged into compiler
`main` at `d7808c59a50af3700914efabc24c7cd8ac43e109`.
[Released compiler source](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62)
· [Historical rc.2 digest check](https://github.com/strling-lang/strling/actions/runs/44801504660/job/136514535893)
· [Historical rc.2 browser evidence](https://github.com/strling-lang/website/blob/dc7317cedbfe87243a3ebd5fbc0e801d92dd2c23/docs/LAB_ACCEPTANCE.md#main-only-integration-qualification)
· [Pinned adapter qualification inputs](https://github.com/strling-lang/strling/blob/156a0b54186e1d457fd47696d9f088e2c8b23360/bindings/lab-wasm/qualification.json)
· [Independent hosted compiler qualification](https://github.com/strling-lang/strling/actions/runs/44803798988)
· [Compiler source admission](https://github.com/strling-lang/strling/commit/d7808c59a50af3700914efabc24c7cd8ac43e109)
· [Developer details](LAB_WORKBENCH.md).

## Feature and behavior matrix

**Verified** indicates direct Lab execution or a reproducible automated
check. **Deficient** identifies a concrete functionality gap. **By design**
identifies a product boundary. **Blocked** identifies a missing prerequisite.
Competitor observations are identified as live or documentation evidence.

| Capability                                                  | RegEx Lab                                                                                                                                                                                                                  | STRling Lab                                                                                                                                                                                                               | regex101                                                                                                                                      | RegExr                                                                                     | Local IDE/runtime                                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editing and syntax feedback                                 | **Verified** CodeMirror, multiline editor, engine compile feedback, ECMAScript structure and hover.                                                                                                                        | **Verified** Semantic STRling grammar, Simply JSON, compiler diagnostics with source selection, copy and editor find/replace.                                                                                             | Live pattern editing and named capture task. Documented token help, flag controls, and supported free-spacing formatting.                     | Public editor **blocked**. Project documents editing, highlighting and language reference. | VS Code documents regex Find/Replace, selections, and keyboard commands. IDE behavior is documentation evidence.                                 |
| Engine, version and options                                 | **Verified** Browser JS, PCRE2 10.42/10.43/10.49, CPython 3.11/3.14 and 3.11 bytes. Browser JS identifies the environment.                                                                                                 | **Verified** Five exact compiler profiles and artifact-eligible runtime selection, with flags, profile digest, and runtime version.                                                                                       | Live PCRE2 selector and documented JavaScript, Python and additional dialects.                                                                | Public editor **blocked**. Project documents JavaScript and PHP/PCRE modes.                | CPython 3.13.5 was identified and executed in the local shell. A source file can call `re` with explicit flags.                                  |
| Search, global iteration, replacement, split and extraction | **Verified** Search, full match, first, scan, literal and native replacement, split, and match/capture JSON extraction. PCRE2 split uses a documented host operation.                                                      | **Verified** Same controls for eligible artifacts. Python bytes show hex values.                                                                                                                                          | Live match results. Documented substitution, extraction/export and typed replacement. Split equivalence was unverified.                       | Public editor **blocked**. Project documents replace and lists of matches.                 | Local `re.finditer`, `fullmatch`, `sub`, and `split` were observed. Exporting capture values requires code.                                      |
| Highlighting, participation and coordinates                 | **Verified** Matches, numbered/named groups, duplicate name assertions by index, nonparticipation, native and editor offsets.                                                                                              | **Verified** Same capture inspector with compiler links where source mappings exist.                                                                                                                                      | Live group names and numeric start/end over two input tokens.                                                                                 | Public editor **blocked**. Project documents highlighted matches and hover details.        | The native Python run returned positions and named values. VS Code documents editor highlights. Generated artifact source maps are Lab-specific. |
| Unicode, multiline and zero-width behavior                  | **Verified** Native units, empty-match advancement, engine options and resource boundaries.                                                                                                                                | **Verified** PCRE2 10.42 zero-width offsets across an astral scalar, Python text scalar and bytes coordinates.                                                                                                            | Engines documented as distinct. Boundary behaviors were unverified in the live comparison.                                                    | Public test **blocked**.                                                                   | The local Python comparison confirmed scalar positions after an astral character. Border cases for the IDE search panel were unverified.         |
| Actual debugger                                             | **Verified** PCRE2 interpreter callouts with next/previous steps, capture state, backtracking flags and truncation. JS/Python stepping is **by design** unsupported.                                                       | **Verified** Same debugger for PCRE2 artifacts, with compiler mapping where available.                                                                                                                                    | Documented PCRE2 50-step preview, longer traces and capture views on paid plan.                                                               | Step debugger was unverified.                                                              | VS Code can debug host code. Python `re.DEBUG` documents compile debugging output. Interpreter-step UI was unverified.                           |
| Explanations and uncertainty                                | **Verified** ECMAScript syntax tree. **Verified** Native, partial PCRE2 compiled ranges and CPython optimized parser instructions with versioned diagnostics. A full source AST is outside the available engine contracts. | **Verified locally** Canonical Semantic IR and bounded outcomes for matched, no match, unknown and unavailable, with proven/likely distinctions. **Blocked** in the ordinary distribution until the adapter is qualified. | Token explanations displayed in editor. Pro documentation adds parser/graph capabilities. Canonical STRling proof is outside reference scope. | Public editor **blocked**. Project documents token explanations and quick reference.       | Vendor documentation and interpreter errors are separate evidence. The baseline offered no canonical STRling proof or explanation.               |
| Formatting, conversion and reconstruction                   | Raw regex transforms across dialects are **by design** unsupported.                                                                                                                                                        | **Verified locally** Idempotent formatting and UTF-8 diagnostics, both exact conversion directions and round trip, partial and unsupported with governed evidence. **Blocked** for distribution.                          | Documented regex formatting and dialect conversion. Equivalent canonical STRling reconstruction proof was unverified.                         | Canonical formatting or conversion was unverified.                                         | Text editing in VS Code and direct execution in Python. Canonical STRling reconstruction was outside this comparison.                            |
| Tests, revisions and timing                                 | **Verified** Named assertions, edge cases, same-subject and same-revision comparisons, downloadable witnesses, bounded warmup and timing.                                                                                  | **Verified** Shared test and comparison UI with compiler evidence and emitted artifacts.                                                                                                                                  | Unit tests documented. Benchmark is documented as paid. Local revision comparison was unverified.                                             | Public workflow **blocked**.                                                               | A saved Python script can repeat cases and local Git can compare revisions. Integrated workbench timing was unverified.                          |
| Samples, persistence, import/export and sharing             | **Verified** Multiple datasets, local archive, settings-only links, opt-in file export, inert import and reproducible scan continuation at eligible PCRE2 boundaries.                                                      | **Verified** Same session behavior. Explicit transfer to RegEx Lab can retain the sample, compiler provenance and an eligible PCRE2 boundary.                                                                             | Documented workspace save/share, separate Library publishing and file tooling.                                                                | Public workflow **blocked**. Project documents saved and shared expressions.               | Local source and fixture files. Session schema, redacted settings links, and explicit authoring import are specific to the Labs.                 |
| Keyboard and responsive interaction                         | **Verified** Keyboard tabs, narrow viewport, Chromium axe without serious or critical findings in tested routes.                                                                                                           | **Verified** Shared keyboard and mobile layout, including reachable semantic tool controls.                                                                                                                               | Desktop reference walkthrough. Full accessibility/mobile parity was unverified.                                                               | Public workflow **blocked**.                                                               | VS Code documents keyboard navigation and accessibility. Desktop IDE operation has no mobile web comparator.                                     |
| Isolation, timeouts and recovery                            | **Verified** Worker termination, stale replies rejected, recovery, bounded output and PCRE2 memory/work. JS and Python have no browser-enforced per-worker memory ceiling.                                                 | **Verified** Exact artifact/profile binding, isolated compiler/adapter workers, same-origin asset/digest checks, bounded evaluator and explicit subject privacy.                                                          | Matching is browser-local according to vendor docs. Runtime termination and memory policy were unverified.                                    | Public workflow **blocked**.                                                               | The local comparison ran benign cases in a separate process. It supplied no browser worker isolation or memory claims.                           |

## Competitive walkthrough

The regex101 live walkthrough used a named capture over two synthetic tokens
and checked full-match and group ranges. Substitution changed `a,b;c` to
`a|b|c` in the live editor. The recorded PCRE2 debugger preview displayed nine
steps for `(a|ab)c` on `abc` and the upgrade boundary for the full debugger.
Extraction applied `$1` and returned `alphabeta`. The editor also linked to
Unit Tests. Vendor documentation supplied debugger and benchmark limits.
The Labs exercised that
capture workflow, engine-specific coordinates, real backtracking, replacement,
selected capture extraction, repeatable assertions, local revisions and
timing in Chromium. The Labs' extraction selects a whole match or a numbered
group. Template pipelines and the public pattern library are outside the
workbench scope. [Editor](https://regex101.com/) ·
[Engines](https://docs.regex101.com/editor/engines/) ·
[Debugger](https://docs.regex101.com/application/regex101-pro/regex-debugger/) ·
[Unit tests](https://support.regex101.com/editor/unit-tests/) ·
[Pro scope](https://support.regex101.com/application/regex101-pro/).

PCRE2 structure inspection uses capture metadata and native callout ranges
from its compiled pattern. Its view is partial. CPython uses the optimized
instructions its own parser produces. Individual instructions have no source
spans. Compile diagnostics retain the engine's native offset. A complete
dialect syntax tree requires an additional authoritative parser with range
data. The regex101 parser offering has its own commercial license.
[PCRE2 callouts](https://www.pcre.org/current/doc/html/pcre2callout.html) ·
[CPython 3.11 parser](https://github.com/python/cpython/blob/3.11/Lib/re/_parser.py) ·
[CPython 3.14 parser](https://github.com/python/cpython/blob/3.14/Lib/re/_parser.py) ·
[Reference parser license](https://support.regex101.com/regex-parser/pricing/).

The current walkthrough observed regex101 web application 14.6.2 with PCRE2
(PHP) and `gm`. The input `AB-7 CD-42 stray` returned two matches with spans
[0, 4) and [5, 10) and named capture spans [0, 2) and [5, 7). The editor
displayed token explanations and access to the debugger. It did not expose
the engine patch in that view. [regex101 editor](https://regex101.com/).

The consolidation walkthrough also ran both study replacement forms in
regex101 14.6.2 with its JavaScript flavor. Replacement `$$$<id>` produced
`$07 $19 usd` and `$05 $81 fee`. The public RegExr editor still displayed its
maintenance page. These are comparator checks on synthetic tasks.
[regex101 editor](https://regex101.com/) · [RegExr](https://regexr.com/).

The local comparator paired reported VS Code 1.147.0 with CPython 3.13.5.
The Python run placed two `é` captures at scalar spans [1, 2) and [3, 4)
in `😀é é` and rejected a whole-input match. Splitting `a,b;c` produced
three fields, and substitution produced `a|b|c`. The IDE column uses official
documentation. Runtime observations came from the shell.
[VS Code Basic Editing](https://code.visualstudio.com/docs/editing/codebasics#_find-and-replace) ·
[Python 3.13 re](https://docs.python.org/3.13/library/re.html).

RegExr's public app returned a maintenance page on November 20, 2026.
The comparison uses the project's first-party descriptions for available
capabilities. Live parity remains unverified until the service returns.
[Public app](https://regexr.com/) · [Project source](https://github.com/gskinner/regexr).

The earlier walkthrough also covered RegexBuddy's published desktop debugger
and integration scope, RegexPilot's public demo and native macOS claims, and
a live Compiler Explorer compile that produced a constant return instruction.
The Lab provides a navigable structure tree, canonical artifacts and source
mappings. Desktop vendor workflows and visual graph editing remain outside
direct qualification. [RegexBuddy manual](https://www.regexbuddy.com/manual/RegexBuddy.pdf)
· [RegexPilot](https://regexpilot.com/) · [Compiler Explorer](https://godbolt.org/).

## Research feasibility findings

The Research Intelligence review demonstrated that the earlier workbench
accepted mismatched operation/provider results and lacked semantic validation
of result bodies. Every live worker exchange now uses an opaque request nonce
with an acknowledgement and a result. The interactive provider checks
execution request ID, provider and kind, operation, runtime and release,
result cardinality, error category, and match/capture values and coordinates
against the actual subject. The sealed compiler checks pinned profile hashes
before caching, including artifact and portability profile references. The
adapter checks its identity, result type, conversion destination and proof,
and explanation target and subject identity. Source, dataset, and target
edits cancel work and invalidate displayed comparison/timing evidence. Full
matches must cover the native subject. An inert test worker acknowledges a
request and holds the result, allowing Chromium to confirm the dedicated
worker closed after timeout or Stop. Fresh real engine runs verify recovery.

Application evidence covers mismatched requests, providers, operations,
profiles, native units and subject data, plus stale worker acknowledgements,
initialization failure, user cancellation, and recovery. Research findings,
interactive observations, canonical compiler output, and Regex Conformance
checkpoint evidence each retain their own provenance.

## Verification record

- Compiler focused Rust suites passed 18 tests and interop regression suites
  passed 22 tests, with zero failures or skips. The aggregate canonical
  contracts, focused Semantic STRling, semantic conversion, semantic
  explanation, bounded no-match, and interop checks passed. The existing
  no-match corpus covers 24 cases with all canonical outcomes.
- The candidate's dependency inventory and read-only lock verification
  passed. All 21 registry package records match the existing kernel lock.
- The compiler's pinned Linux inputs and build-capable Pull Request preflight
  passed in WSL. Scoped governance passed the candidate's contract, release
  policy, scope, and change declarations. Repository-wide architecture still
  flags the inherited immutable-verifier routing in
  `.github/workflows/certification-integrity.yml`. Repository hygiene still
  flags the inherited missing final newline in the sealed 4.0.3 publication
  request. Both paths match the compiler base revision.
- The previous website handoff reported 101 unit cases and 221 desktop/mobile
  Chromium cases with zero failures. There were 11 existing browser skips tied to project
  applicability. Relative to the previous baseline, this adds one unit
  test and 14 Chromium passes. Browser tests ran against a local production
  preview with real assets. The Windows run used Node 22.12.0,
  Playwright 1.62.1, and Chromium 151.0.7922.34.
- Both static builds in the previous handoff produced 333 pages. The default build excluded the
  development adapter asset. Astro and TypeScript reported zero errors,
  warnings, or hints. ESLint, CSS compatibility, RegEx documentation coverage
  (16 categories and 269 features), and the internal link check passed.
  Changed files passed Prettier. The repository-wide formatting check
  still reported the 100 baseline files outside the change set.
- Website build and regression testing use the pinned adapter digest. The CSP
  cases apply the checked-in response policy to the actual static assets and
  worker bundles. The no-match privacy test inspects requests, storage,
  address bar and canonical evidence for a synthetic subject. The shared
  header loads its existing decorative image from GitHub.
- A regression test converts a compiled program with 124 nested captures
  and separately checks that the transport rejects requests beyond its
  JSON nesting limit.
- Desktop/mobile keyboard, overflow, and axe checks passed for the tested
  routes and semantic controls. The scope is Chromium with desktop and
  mobile emulation.

## Initial isolated website qualification

The preserved Lab worktree was copied into its own review worktree with
snapshot tree `cb13a6b500c4a1cdee39208affe61313e4b6b7a3`. Qualification used
Windows x64, Node 22.23.5, npm 11.4.2, Playwright 1.62.1 and its pinned
Chromium 151.0.7922.34. The repository lockfile was installed with
`npm ci --ignore-scripts`. The prior Node 22.12.0 pin preceded the current
lock requirements of Undici and ESLint visitor keys. The site and CI now
pin a compatible Node 22 patch.
[Node 22.23.5 release](https://nodejs.org/en/blog/release/v22.23.5).

The first browser process reused an older preview on localhost. Results
from that preview do not qualify this tree. Playwright now runs the
foreground Astro API on a dedicated port and refuses reuse. The sealed
build omitted the candidate asset and passed six Chromium smoke
checks for disabled canonical tools, settings-only sharing, and the
Compatibility Check gate. The settings link was tested with all file
export choices selected. The download retained explicitly selected data,
while the URL contained no authored inputs and opened without executing.
The other Lab refused the link for the wrong authoring mode.

Restored revisions show historical results. Run starts a fresh operation
under the currently selected runtime. There is no stored cursor in the
request or session schema. Exact cursor-resumption comparisons, including
the Research Intelligence T8 fixture, remain unqualified. Native runtime
observations, canonical explanation evidence, and certified Compatibility
Check evidence keep their separate authorities.

The candidate and sealed static builds each rendered 333 pages. The final
candidate run passed 221 Chromium desktop/mobile checks with 11 existing
viewport-applicability skips and zero failures. Both candidate compiler
tool cases ran in both projects. Unit tests passed 101 of 101. Astro check,
ESLint, CSS compatibility, rendered RegEx Docs coverage (16 categories,
269 features), and the 333-page internal link check passed. The pinned
browser verified real runtime behavior under the configured CSP. Its
test-fixture timeout used a dedicated waiting worker. The recovery runs
used the actual configured engines.

Changed files passed Prettier. The original checkout's ordinary formatter
reported 100 warnings. The isolated CRLF checkout reported 136. Prettier
with `--end-of-line auto` passed the whole changed worktree. Managed
Windows left both Playwright preview processes listening after all
assertions. Stopping just those verified local test previews allowed
both suites to finish with exit code zero. Astro/Vite reports conditional
Node imports in Pyodide and the workbench chunk-size advisory during
both builds.

To reproduce, build once with neither adapter variable set and exercise the
default-build browser smoke tests. Build again with the candidate path and
SHA in [Lab workbench development](LAB_WORKBENCH.md). Run `npm run check`,
`npm run lint`, `npm test`, and `npm run test:e2e -- --workers=4` with
the candidate configuration. Match each browser suite to its build and set
`STRLING_WEBSITE_PREVIEW_PORT` when another preview is listening.

### Initial candidate asset digest manifest

This manifest describes the evaluated build. The packaged 4.0.3 WASM appears
under two generated asset names with identical content. The separate
candidate asset never replaces either released asset.

| Candidate build asset                                               | SHA-256                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `_astro/compiler-tools.worker-BWwOIYkt.js`                          | `03f36249e39dd9b570ee99230a3e04b6515e2249de83a973ffb765326163a0bc` |
| `_astro/compiler.worker-DgOW895j.js`                                | `f281dcdc0eaf5d7f302f8b7daadea795d34ebf28d9ed4fbeb1262a56d0c737f5` |
| `_astro/execution.worker-VkIgMO-r.js`                               | `ddbc6b83e8309c02346feefca355df53f162ca056227b8c98a1a08c68f53c0a3` |
| `_astro/pcre2-10.42-BatZwkgF.wasm`                                  | `f3b4275d0445c237afb6ab069901559a7db34e2dd8a1398388f2706690787a99` |
| `_astro/pcre2-10.43-3tLQlRXV.wasm`                                  | `6917bc09c17a49806f44e2f4488f4511e9b90761c175b696f2f01e60079d0889` |
| `_astro/pcre2-10.49-CYdZxDeO.wasm`                                  | `61edf7f27bb8f4253ee5fd88f2cadefd8216d4e06551de57704223e77df0d303` |
| `_astro/pyodide-0.25.1/pyodide.asm.wasm`                            | `aa920641c032c3db42eb1fb018eec611dbef96f0fa4dbdfa6fe3cb1b335aed3c` |
| `_astro/pyodide-314.0.8/pyodide.asm.wasm`                           | `e14d49ceca9b4a0e274ea918f3a898de2d3880b6e5573a6cfe1a2267ecc70329` |
| `_astro/python_stdlib-Ds4tH5sN.zip`                                 | `2bd3394a145bfbbe5bbc9d9d6ab9136abbb986c6fef6c142b3a2962227aa5c28` |
| `_astro/python_stdlib-DyULrpS-.zip`                                 | `52866039fa3097e549649b9a62ffae8a1125f01ace7b2d077f34e3cbaff8d0ca` |
| `_astro/python-311.worker-DuXhN83h.js`                              | `dc58370d02c3fa1f15f1d64c0eeed64b169a976d5430c93b97e9183ef511f72f` |
| `_astro/strling_interop-Dm6XojNL.wasm`                              | `6a24a334d5d7e78b17c09e6d9a62d33299d65ac79e52212c4f8db130250656d7` |
| `_astro/strling_interop.Dm6XojNL.wasm`                              | `6a24a334d5d7e78b17c09e6d9a62d33299d65ac79e52212c4f8db130250656d7` |
| `_astro/Workbench.astro_astro_type_script_index_0_lang.BhZImFr_.js` | `d56a0e4a8bf5b27aac3c9505182b761d8029f53ab42fc534d4059565f97d018f` |
| `_strling-lab/compiler-tools-0.1.0-rc.1.wasm`                       | `640fd5c4c205cff8c69ca46c7933f1351194e3861306cef137d67e1354ea5d72` |
| `lab/index.html`                                                    | `06eb01a4e9df19687dbebf3ab0a6f1124102480f6cb9ba683fe2f56b3f781e13` |
| `regex/lab/index.html`                                              | `56f2f28f28d312a28406fba1ae3a7714333a33039a9b75751b897b118096ebe0` |

## Main-only integration baseline

The Website PR opened against `main` at `3187d307e1d4707d706b1a7508f0cc5c067cadac`
and merged at `674e06a70a8f86ae9a1cb18061111be949f8e785`. The original worktree remains separate from the reviewed changes. Its
native-provider and exact-target trace cases now also exercise the hosting
CSP. Both study replay forms save and restore a local revision, inspect the
historical output, and run a fresh JavaScript Find first at UTF-16 `[0, 2)`.
The UI makes no cursor-resumption claim. In the candidate build, browser
checks exercise canonical matched outcomes for ECMAScript 2024 and PCRE2
10.43 and grow the adapter to 64 MiB before verifying refusal of another
page. The sealed build still serves only the published compiler.

The dependency audit found security advisories in the previous lockfile.
The compatible lock refresh includes Astro 7.4.13 and Vite 8.3.8. Astro's
content loader needs the YAML package's ES-module entry on this dependency
set. The final `npm audit --ignore-scripts --json` reported zero findings,
including development dependencies. `npm ci --ignore-scripts` installed the
reviewed lock with Node 22.23.5 and npm 11.4.2. Both builds passed 103 unit
tests, 333-page static rendering and link verification, CSS checks, and
RegEx Docs coverage. Astro type checking, ESLint and Prettier passed, with
line endings normalized for the Windows checkout.

Against fresh loopback previews, Playwright 1.62.1 and Chromium
151.0.7922.34 passed 225 desktop and mobile cases with 11 unchanged
applicability skips and no failures on the private candidate. The sealed
build passed all 10 smoke cases, including the six original cases and four
fresh replay checks. An occupied port prevented the first rc.3 preview from
producing test results. The complete rerun used an OS-selected free port. Managed Windows
left the verified preview process open after the assertions. Terminating
only that test process allowed Playwright to return its result.

The isolated static build emitted the compiler adapter byte for byte. Its
asset manifest, covering the two Lab pages, their shared workbench, workers,
and native runtime assets, had SHA-256
`068a37215ab6ceba6cf65996362288bb189f2eb6081633d6efe224a858937683`.
The compiler's standalone verifier passed against those Website-built bytes
and the sealed 4.0.3 npm package. It checked 12 formatter cases, 31 diagnostic
cases, three exact reconstructions, two non-exact conversions, and 17
no-match cases, including privacy, elapsed refusal, memory, and path identity.
Earlier and current builds emitted identical PCRE2, Pyodide, and sealed
compiler WASM digests. The selected current asset hashes are below.

| Asset                               | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| Private compiler adapter 0.1.0-rc.3 | `3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81` |
| Released 4.0.3 compiler             | `6a24a334d5d7e78b17c09e6d9a62d33299d65ac79e52212c4f8db130250656d7` |
| Canonical compiler tools worker     | `0bf2cc13ff75892b750a9d19455154ff09cd9d579591823a643cb6922e18d504` |
| Browser execution worker            | `0b625be839f11bca9d0101a77905bc1f4c5415d3000a009d9bab28e6ac006fc7` |
| Shared workbench browser script     | `6d111871c329ce4f57a42e71a201121a27e770c22cb52e03a4ad21ff9cfbe426` |

## Native inspection and continuation follow-up

The source changes were reconciled in a detached checkout against website
review `dc7317cedbfe87243a3ebd5fbc0e801d92dd2c23`. The final browser build used `dd6468e3df407ff92e0f87be3682a6a6b8a56f8e`. Its code and test changes were reapplied atop the merged website `main`. The earlier
`4759fede493b543fef9255615850339ed70be8f9` review remains in its history.
The candidate evaluated was the pinned `0.1.0-rc.2` from compiler source
`8ba008b048d46c0ab209c5b15ca82fb2aaaeb110`. The compiler verifier
independently checked the digest, all four sealed interop operations,
12 formatting cases, 31 diagnostic checks, 3 exact reconstructions,
2 non-exact conversions and 17 bounded explanation cases. It also checked
subject privacy, elapsed refusal and the 64 MiB memory limit.

The Research Intelligence T8 test compiles `ab` for PCRE2 10.43 and scans
`ab--ab` in STRling Lab. It explicitly transfers the saved cursor, repeats
the resume after reload and imports an explicitly selected portable bundle.
Each resumed run returns native byte range `[4,6)`. A deliberate fresh scan
starts at `[0,2)`. Changed bytes, a different profile, altered effective
options, incompatible compiler provenance, a cursor inside a scalar, and
a fabricated anchor are refusal cases. Empty matches, the final match and
incomplete scans do not produce a cursor. Browser JavaScript has no portable
engine build identity. Python does not expose a sufficient native cursor
contract for the supported scan semantics. Recorded-result viewing and
fresh reruns remain available for these providers.

PCRE2 inspection compiles using the selected engine and returns its capture
names and enumerated native item ranges. Python uses the selected version's
optimized `re` parser instructions, including repetitions, lookarounds and
conditionals. It reports native diagnostic offsets. PCRE2's view is partial,
Python nodes have no individual source spans, and work bounds are visible.
Benchmarks and comparisons still report local observations. The November 20
RegExr maintenance page is a gap in live competitor access. It does not gate
Lab release. [RegExr status](https://regexr.com/) ·
[regex101 editor and modes](https://regex101.com/) ·
[regex101 debugger scope](https://docs.regex101.com/application/regex101-pro/regex-debugger/).

The measured Chromium loopback sample used the synthetic pattern `ab`.
Navigation plus the default JavaScript scan took 494–608 ms. The first
selected run and warm repeat were 67/87 ms for JavaScript, 139/78 ms for
PCRE2 10.49, 3,448/71 ms for Pyodide 0.25.1, and 3,453/75 ms for
Pyodide 314.0.8. These are wall-clock UI samples from the first isolated
follow-up build and include automation overhead. The measured document
JavaScript heap after the warm runs was 5.5–5.8 MB. These figures exclude
worker heap and are neither memory high-water measurements nor performance
guarantees. The runtime payloads are 350,918 bytes for PCRE2 10.49,
11,325,330 bytes for the Python 3.11 WASM and standard library together,
and 12,143,442 bytes for Python 3.14, before transport compression.
The static page runs once loaded with the warm JavaScript worker offline.
Cold offline loading depends on normal browser caching. PCRE2 and the
canonical adapter declare 32 MiB and 64 MiB Wasm linear-memory maxima.
JavaScript and Python are bounded by input, output and worker termination
policies. Their worker memory high-water marks were unmeasured.

### Exact follow-up build identities

The lockfile uses Astro 7.4.13 and Vite 8.3.8. The test environment used
Windows x64, Node 22.23.5, npm 11.4.2 and Playwright 1.62.1.
The full lock audit reported zero advisories. Both builds rendered 333
routes. The sealed build excludes the private candidate resource. The
rc.2 build hashes below record the initial follow-up acceptance build. They
include the unchanged published 4.0.3 binary. The three PCRE2 hashes reproduced independently in the
reconciled worktree using Zig `0.14.0-dev.2456+a68119f8f`.

| Asset                                     | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Website `package-lock.json`               | `425049c6065bfd23f66bfae6533539dc9c5970e2a63f2b388860344431998a26` |
| Lab HTML `/lab/`                          | `4a08d76de81367e7b0502c88dd7e4de7c9492ad5bf18e08c7e6a22ad9f73e3f6` |
| Lab HTML `/regex/lab/`                    | `6b5f1acbf4b2331843c9ec60bc5451785b5bdca6e47277739a40871342b77d5f` |
| Browser workbench script                  | `794732be8f8c8582d1de5858378b593ec83f07469ddbbcf5594a02bf275702e4` |
| Browser execution worker                  | `e896e10b340c69be9f2ba10e7168f08fa12aa7d817f83382df8e7e6f695f7c9e` |
| Python 3.11 execution worker              | `c1b0c0d6566fa90f867ce2d62f24c6d97130248941922e3556fafe28590f3b1c` |
| Compiler worker                           | `e6ffe59281a056620c83424e07eb3735800426f2490ea9f753428481dc677236` |
| Canonical compiler tools worker           | `3e8aeff7efcaca406371975ca58ff92012cc4874bb2cab2482604e9d2d044424` |
| PCRE2 10.42 Wasm                          | `d9e187e1aa67f7203d01d0b66a95caabdbbc5ecdd46920ba4d93c439cc2be239` |
| PCRE2 10.43 Wasm                          | `f406df97453b316dc77061b7fafaf7a709be24129890ff19ea7fbe949c08f08e` |
| PCRE2 10.49 Wasm                          | `04edda7fcc7176ed3200d6d86b3e8f2a9eada4e1699a1317ad87b5dd2e28e96e` |
| Pyodide 0.25.1 Wasm                       | `aa920641c032c3db42eb1fb018eec611dbef96f0fa4dbdfa6fe3cb1b335aed3c` |
| Pyodide 0.25.1 standard library           | `52866039fa3097e549649b9a62ffae8a1125f01ace7b2d077f34e3cbaff8d0ca` |
| Pyodide 314.0.8 Wasm                      | `e14d49ceca9b4a0e274ea918f3a898de2d3880b6e5573a6cfe1a2267ecc70329` |
| Pyodide 314.0.8 standard library          | `2bd3394a145bfbbe5bbc9d9d6ab9136abbb986c6fef6c142b3a2962227aa5c28` |
| Sealed compiler 4.0.3 Wasm                | `6a24a334d5d7e78b17c09e6d9a62d33299d65ac79e52212c4f8db130250656d7` |
| Isolated compiler tools `0.1.0-rc.2` Wasm | `283ff9d319b4a28220aeac8b187834b12fc6634c9ad1beb9be3be4d4247cc04b` |

### Qualified compiler source and website pin

Compiler PR #151 merged reviewed head `156a0b54186e1d457fd47696d9f088e2c8b23360`
to compiler `main` at `d7808c59a50af3700914efabc24c7cd8ac43e109`.
The successful Windows source job built `strling-lab-wasm 0.1.0-rc.3` at
2,548,656 bytes and SHA-256
`3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81`.
The revised Windows build maps the Rust standard-library source paths to the
compiler commit identity. The independently reproduced hosted digest is also
the website's isolated build pin. The wire protocol stays
`strling.lab-compiler-tools@1.0.0-rc.1`. The qualification manifest scopes
these bytes to isolated website qualification. The complete-product candidate
and certified export jobs were skipped in the source merge.
[Merged compiler review](https://github.com/strling-lang/strling/pull/151) ·
[Hosted qualification](https://github.com/strling-lang/strling/actions/runs/44803915202) ·
[Artifact qualification manifest](https://github.com/strling-lang/strling/blob/d7808c59a50af3700914efabc24c7cd8ac43e109/bindings/lab-wasm/qualification.json).

The final rc.3 website build retained the same production lock, PCRE2
modules, Pyodide binaries and libraries, and sealed 4.0.3 WASM as the initial
follow-up build. The changed assets are below. The Python startup budget
allows 30 seconds after an observed Firefox cold initialization of 16.1
seconds. The startup budget for other workers is 15 seconds. The regex
execution deadline remains 1.5 seconds after acknowledgement.

| Changed candidate asset                   | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Lab HTML `/lab/`                          | `17a85b769d3e678e035688d2d05473e3b076fe0c25ed2e083bca09d235e54439` |
| Lab HTML `/regex/lab/`                    | `a42df3f894513f5c3f991599aff6552e58cb68bdfbaba57fcf0e62eba26af096` |
| Browser workbench script                  | `67b3075857d4fe017a43d0d0092347e1f777c2eb26bcb6067fbd2c8bc070c622` |
| Browser execution worker                  | `9a64a1baa233e414763da8e0cfb73f25bc8b6a373841d4075dfa74190253a3b3` |
| Python 3.11 execution worker              | `656519787597f9b79d6419963a6c686b733685123643f5ea5f7a2fee40b56fac` |
| Released compiler worker                  | `e00688cc846e7c0136c5480ec563c6c05dc193515f9022e3533550af447ed025` |
| Canonical compiler tools worker           | `0bf2cc13ff75892b750a9d19455154ff09cd9d579591823a643cb6922e18d504` |
| Isolated compiler tools `0.1.0-rc.3` Wasm | `3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81` |

### Final acceptance results

The detached checkout based on merged website `main` rebuilt all 433 static
files byte-for-byte against the rc.3 build exercised in the browser. Its
sorted SHA-256 inventory has digest
`3df3f554e074d061b2cf8c32a38ff28bd2e16ba2505eeff1b94e72fe8620923c`.
The separate sealed build also rendered 333 pages and emitted no private
compiler adapter. The browser runs used local HTTPS, the checked-in hosting
CSP, the immutable asset cache header, and the actual generated workers,
WASM files and standard libraries.

| Scope                                                                       | Passed | Failed | Skipped |
| --------------------------------------------------------------------------- | -----: | -----: | ------: |
| Unit suite on integrated website main base                                  |    105 |      0 |       0 |
| Chromium 151.0.7922.34 desktop, full candidate suite                        |    117 |      0 |       4 |
| Chromium 151.0.7922.34 mobile emulation, full candidate suite               |    114 |      0 |       7 |
| Firefox 153.0 desktop, focused candidate suite after fixture correction     |      9 |      0 |       0 |
| WebKit 26.5 desktop, focused candidate suite                                |      9 |      0 |       0 |
| Sealed static smoke, desktop and mobile Chromium                            |     16 |      0 |       0 |
| Canonical edge-case corpus rerun on merged main base, four browser projects |      4 |      0 |       0 |

Firefox's first focused run passed eight cases and failed the canonical
edge-case case when the contenteditable fixture lost the replacement source.
The corrected fixture used the same keyboard editing helper as the other
Firefox cases. The four-browser rerun covered canonical partial and
unsupported conversion, likely, unknown and unavailable explanations,
transport limits and a 124-capture exact reconstruction. The Firefox and
WebKit scope covers both Labs, native inspection, Python 3.11.3 text and bytes,
Python 3.14.2 startup, PCRE2 continuation and debugger, canonical operations,
offline warm JavaScript, and tested keyboard and accessibility behavior.

The 11 Chromium skips are inherited applicability cases. Mobile skips the
duplicate exhaustive catalog traversal, desktop primary navigation, two
desktop RegEx navigation interactions, two desktop fixed-aside layouts and the
desktop related-pages grid. Desktop skips mobile navigation, the mobile RegEx
category flow, mobile documentation overflow and the mobile related-pages
grid. The applicable projects ran all eleven.

Astro types, ESLint source checks, CSS compatibility, Prettier with Windows
line endings normalized, 16 RegEx Docs categories and 269 features, and
internal links across 333 rendered pages passed. The npm lock audit reported
zero findings. Browser tests exercised all five checked-in compiler profiles
and both Semantic STRling and Simply. The accessibility coverage includes
keyboard tabs and focus, result status semantics, and axe checks for serious
or critical findings. Mobile coverage uses device emulation. These interactive
results supply application evidence and leave Regex Conformance certification
to its separate governed index.

## Release-readiness revalidation

The source promotion preserves candidate
`d0c93bb46f2cdc162382c861cd2c2483134532fd` as a direct descendant of
the previously integrated website `main`
`674e06a70a8f86ae9a1cb18061111be949f8e785`. The follow-up test and report
changes leave the emitted application bytes unchanged.

A fresh lockfile installation used Node 22.23.5 and npm 11.4.2. It rebuilt
all 433 isolated qualification files byte for byte from the preserved
manifest at SHA-256
`3df3f554e074d061b2cf8c32a38ff28bd2e16ba2505eeff1b94e72fe8620923c`.
It also built a clean 333-page Netlify-style sealed configuration without
an adapter asset. Its 432-file inventory has SHA-256
`a0e2468393ee6f7369ba1f3912c80d6133ef37ce8a143167b5918758666083c5`.
HTTPS previews used separate loopback servers and browser
contexts, the checked-in CSP and immutable cache policy, and the real
runtime and compiler assets.

| Scope                                                                                 | Passed | Failed | Skipped |
| ------------------------------------------------------------------------------------- | -----: | -----: | ------: |
| Unit suite                                                                            |    105 |      0 |       0 |
| Isolated candidate, full Chromium baseline                                            |    231 |      0 |      11 |
| Isolated candidate, new adapter integrity and recovery test in both Chromium projects |      2 |      0 |       0 |
| Isolated candidate, focused Firefox and WebKit                                        |     18 |      0 |       0 |
| Corrected Firefox case repeated in fresh contexts                                     |      3 |      0 |       0 |
| Sealed build, full Chromium suite including all 16 smoke cases                        |    229 |      0 |      15 |
| Sealed build, focused Firefox and WebKit                                              |      8 |      0 |       0 |

The sealed run's 15 skips include the 11 inherited viewport applicability
exclusions and four isolated-adapter-only combinations. The new Chromium
test verified that a missing asset and a substituted WebAssembly module
leave the source untouched, report distinct errors, and allow retry with
the genuine pinned module. The existing browser corpus verified rejection
of an unrelated protocol. The original Firefox fixture failure involved
contenteditable input replacement. Its keyboard-driven correction passed
in the focused suite and all three repeated runs. The cross-browser scope
and mobile emulation boundaries above still apply.

The fresh type, lint, formatting, CSS, 16-category and 269-feature RegEx
Docs coverage, and 333-page link checks passed. The unchanged website
lockfile audit returned zero findings. These results establish website
source acceptance for the isolated and sealed configurations. A production
build with an authorized distribution adapter requires its own acceptance.

### Final packaging recheck

The exact-source rebuild exposed different rendered bytes under Git's two
checkout line-ending settings. The guide now emits stable same-origin
PCRE2 license downloads. Checkout attributes stabilize the emitted example
files, rendered learning Markdown, and Python source embedded in both worker
variants. The real-browser guide test checks the three notice links and
response bytes. [Vite static asset handling](https://vite.dev/guide/assets.html#explicit-inline-handling).

An isolated mobile Chromium rerun also caught the sticky header intercepting
the Stop button. The run controls now reserve header clearance when scrolled
into view. The cancellation case checks the button's viewport position, clicks
it, confirms that the worker terminates, and runs a fresh request.

The runtime source evaluated for these changes is
`ea7a235684f6e75585fd68aefb0a6ab1a4f0c4f3`. The sealed build reproduced all 434
files byte for byte between the independent LF and CRLF-configured
checkouts. Its SHA-256 inventory digest is
`7452211ed80f71a73ca10793352d21ce62c731ea0a6629d4627b7d4c40ba589d`.
The isolated build added the verified rc.3 adapter. Its 435-file inventory
digest is `a41e414b3e9bf039da20072c410ad017c6d7d724a9be1e9b599b0035bf46dbfd`.
Both builds contain 333 rendered pages. The unchanged Netlify `npm run build`
script reproduced all 434 sealed files in a local Windows PowerShell harness.

| Final scope                                                               | Passed | Failed | Skipped |
| ------------------------------------------------------------------------- | -----: | -----: | ------: |
| Unit suite                                                                |    105 |      0 |       0 |
| Isolated Chromium, 119 desktop and 116 mobile                             |    235 |      0 |      11 |
| Sealed Chromium, 117 desktop and 114 mobile, including all 16 smoke cases |    231 |      0 |      15 |
| Isolated Firefox and WebKit, ten focused cases in each                    |     20 |      0 |       0 |
| Sealed Firefox and WebKit, five focused cases in each                     |     10 |      0 |       0 |
| Mobile Chromium cancellation and recovery, three additional contexts      |      3 |      0 |       0 |

Under concurrent browser runs,
the sealed desktop Chromium suite reported one compiler-start assertion
timeout. Firefox reported one action timeout and two context teardown
timeouts. Both scopes passed their sequential reruns with fresh HTTPS previews
and separate browser batches. Reports and traces retain both attempts.

## Remaining release gate

### Production consumer

The website now defines an explicit sealed or certified mode in
`scripts/lab-compiler-release.json`. The committed manifest remains sealed.
The certified path checks immutable GitHub release metadata, the exact Git
source, asset identity and SHA-256, transport bounds, ABI, descriptor, and
memory ceiling before emitting a content-addressed same-origin asset. The
historical private adapter remains available only to isolated builds.
Consumer tests exercise missing and changed assets, unsupported identities,
and unauthorized redirects. A build using published certified bytes still
requires the compiler admission and publication described below.

The provisional transport test sent the real private RC4 Wasm through the
certified consumer's metadata, download, ABI checks, and static emission.
Its release metadata was a test fixture. The verification also rejected
the same Wasm presented with a different version or kernel-base revision.

| Consumer change verification          | Passed | Failed | Skipped |
| ------------------------------------- | -----: | -----: | ------: |
| Unit suite                            |    108 |      0 |       0 |
| Isolated Chromium, desktop and mobile |    235 |      0 |      11 |
| Sealed Chromium, desktop and mobile   |    231 |      0 |      15 |
| Isolated Firefox and WebKit, focused  |     20 |      0 |       0 |
| Sealed Firefox and WebKit, focused    |     10 |      0 |       0 |

Type, lint, CSS, documentation coverage and link checks passed. The final
sealed and isolated rebuilds reproduced the browser-tested files. The isolated
browser runs used the historical private RC3 pin. The
434-file sealed inventory has SHA-256
`5b1f081f33e957d30b3174c591d5d7f2a2fca76e2475a7a651e2e34f99bd26d2`.
The 435-file isolated inventory has SHA-256
`b53c9cadafcb0e2067b8429f403177dff9022e7dcd1adbd5ec4e8a3ca8d5d2d4`.

### Distribution record for owner review

Compiler `main` at `1cf698751e04d5b2130b0c2500358499657709fc` records
`strling-lab-wasm 0.1.0-rc.3` as independently versioned, private and
unpublished. Its isolated qualification manifest binds the exact
2,548,656-byte digest listed above. The existing complete-product Release
pipeline and signed 4.0.3 closure cover their registered artifacts. The
adapter has no production distribution entry in that artifact set.

The previously qualified bytes passed a fresh run of the compiler's
artifact verifier against the locked 4.0.3 package. Two fresh, locked
Windows builds from the preserved checkouts of reviewed source
`156a0b54186e1d457fd47696d9f088e2c8b23360` reproduced the qualified digest.
Both freshly compiled modules passed the verifier. Two fresh Windows
offline rebuilds from compiler `main` both produced SHA-256
`6df19a4a0c402cc4b88b98abaf3fcca23940276064ec9a0fcb02b5e73a0ee715`,
including a rebuild with the reviewed task-local Cargo cache. They had
the same size as the recorded rc.3 artifact. The current pin rejected them.
A separate Windows checkout of the same reviewed commit produced
`4acdb6413c9c494fdf7f5b4bc90bd5d79030bf414b0f14a08ec34d008b06445b`.
The mismatched modules omitted absolute Windows source paths, and the
tracked adapter and kernel input bytes matched across the compared
checkouts. The compiler release must reconcile reproducibility on its
chosen exact distribution source and pin the independently reproduced
output. The website retains the qualified digest for isolated testing.

The proposed distribution is a separate versioned WASM release asset under
the compiler repository. A new coordinate such as `strling-lab-wasm 0.1.0`
requires an owner decision and a fresh reproducible build. It would carry
the exact compiler source and toolchain revisions, adapter version, wire
protocol, compiler-base identity, asset size and SHA-256, SBOM and provenance,
and the exact signed evidence closure and verification run. The owner must
register the allowed destination and artifact set before freeze. The
existing `strling.lab-compiler-tools@1.0.0-rc.1` contract remains the website's
tested wire version and needs an explicit compatibility disposition in the
new record.

The compiler owner must admit the independent artifact to the production
evidence scope and authorize an exact source and version. A trusted
certifier must sign the same-source Full and independent no-reuse Release
evidence that includes those exact bytes. The protected P20-T05 publication
authorization must name the certified source, artifact, destination and run.
The website can then consume that immutable coordinate through a clean CI
build. [Compiler release policy](https://github.com/strling-lang/strling/blob/1cf698751e04d5b2130b0c2500358499657709fc/docs/release-policy.md) ·
[Certification profiles](https://github.com/strling-lang/strling/blob/1cf698751e04d5b2130b0c2500358499657709fc/governance/certification-profiles.md) ·
[Current adapter scope](https://github.com/strling-lang/strling/blob/1cf698751e04d5b2130b0c2500358499657709fc/bindings/lab-wasm/qualification.json) ·
[GitHub immutable release verification](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity).

The current release trust policy names
`strling-local-release-certifier-2026-01` in the
`strling-local-certification-v1` signature namespace. The current closure
under `tests/certification/release-candidate/1.0/current` is the historical
product closure. A new source-bound closure covering the distribution
adapter must be verified by the compiler's complete-product integrity
workflow. [Compiler release trust policy](https://github.com/strling-lang/strling/blob/1cf698751e04d5b2130b0c2500358499657709fc/governance/release-candidate-certification-trust.json).

| Owner                  | Required action                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compiler release owner | Authorize and qualify a distribution artifact for production with same-source signed Full and no-reuse Release evidence. Publish or otherwise supply the authorized immutable bytes under the compiler's release policy. |
| Website release owner  | After compiler admission, pin and package the immutable digest through an approved production artifact source. Rerun browser acceptance on that shipping build and approve deployment separately.                        |

The existing 4.0.3 registry coordinate and interop contract remain intact.
The compiler's scoped qualification runs against the exact private artifact.
Production builds follow their own release policy.
[Compiler candidate record](https://github.com/strling-lang/strling/blob/d7808c59a50af3700914efabc24c7cd8ac43e109/docs/migration/records/lab-compiler-tools-candidate.yaml).

On compiler review revision `cea7ec290a0dd0a959d97780fdd7518b4747e85e`,
the hosted Windows rebuild produced
`04dcd3b069d95ab824f80311ea757789a7c5c9040342b1b5219a802bf4a3c003`.
The verifier correctly refused it before executing the candidate because the
review pin is
`283ff9d319b4a28220aeac8b187834b12fc6634c9ad1beb9be3be4d4247cc04b`.
Linux source qualification and the historical certification preservation
checks passed at that revision. The merged rc.3 supersedes that failing build for isolated qualification.
[Hosted Windows mismatch](https://github.com/strling-lang/strling/actions/runs/44802098783) ·
[Compiler review](https://github.com/strling-lang/strling/pull/151).

The canonical Full profile and clean no-reuse Release aggregate were
launched separately at compiler source `1cf698751e04d5b2130b0c2500358499657709fc`
as unsigned diagnostics. The initial Full run failed at
`generated_integrity@repository` because the isolated runner lacked the
locked formatter. The retry installed the compiler lockfile's Prettier
3.3.3, passed the formatter check, and stopped at the missing generated Lua
rockspec. The retry's retained stage output has SHA-256
`5c2141abb3f5e47f4aff522566721eaf9dc4b78d13ef222a190127e690ad6c4c`.
A further diagnostic uses the registered Lua materialization command.
The independent Release
attempt uses run ID `1cf698751e04-20261120T212212Z` and reached generated
artifact preparation after locked setup and the interop build. The runs
produced no signed evidence for these Labs. The source registers the adapter for
isolated qualification only. A profile result from this source cannot
certify an adapter distribution. There is no signed Full or Release
evidence covering a production Lab adapter, and no shipping adapter
coordinate for website CI to consume.

## Source integration without deployment

Review commits and the PR title carry `[skip netlify]`. A source-only merge
must put `[skip netlify]` in the actual merge commit message as well.
[Website PR #2](https://github.com/strling-lang/website/pull/2) merged the
candidate into `main` at `9d720d09cfbc5b5e1747c2fedeee3ae4b94a4900`. The
remote tree matched reviewed source, strict Git integrity passed, and
Netlify still reported the preceding published deployment after the merge.
The final packaging and cancellation fixes and their acceptance evidence
follow through the same source-only workflow. [Website PR #3](https://github.com/strling-lang/website/pull/3).
The next unmarked push can include all skipped changes and requires
separate release approval.
The build refuses the private adapter on Netlify. Ordinary builds remain
available with the sealed compiler and report canonical tools unavailable.
[Netlify deploy controls](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy) ·
[Netlify build metadata](https://docs.netlify.com/build/configure-builds/environment-variables/#build-metadata).

### Production preparation and rollback

Netlify reports published production deployment
`6aff4b86748a3243796f055d` on `main` at
`3187d307e1d4707d706b1a7508f0cc5c067cadac`. A read-only public check
returned HTTP 200 for `/`, `/lab/` and `/regex/lab/`. Those responses
show the prior deployment's CSP. The next deployment must use the reviewed
`netlify.toml` headers and include the exact approved compiler adapter in
the static output.

Before asking for approval, rebuild the exact shipping commit from a fresh
lockfile install with the authorized artifact. Retain the generated file
manifest, the adapter producer evidence, and the test results. Check the
Netlify production branch, resolved build command, publish directory and
Node version against that commit. Have the release owner explicitly approve
the actual production deploy. Then verify the published deployment record
and compare the deployed adapter, worker and app asset digests with the
accepted manifest. Exercise both Labs, the guide and navigation, all runtime
families, compiler tools, safe session export, and the browser's security
and cache headers from the public origin.

If the live smoke or identity check fails and rollback is authorized,
republish successful deployment `6aff4b86748a3243796f055d` using **Publish
Deploy** on that exact deployment. Confirm its published ID and commit and
repeat the three public route checks. Keep subsequent Git-triggered
production publishing held until the incident is resolved. No rollback or
deployment is part of source integration.
[Published deployment record](https://app.netlify.com/projects/strling-lang/deploys/6aff4b86748a3243796f055d) ·
[Netlify rollback procedure](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#rollbacks).
