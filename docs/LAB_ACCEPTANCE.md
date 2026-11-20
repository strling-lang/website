# STRling Lab and RegEx Lab acceptance

**Release decision — BLOCKED.** The isolated candidate exercises canonical
formatting, semantic conversion, and bounded no-match explanation. Delivery
to a production Website build requires separate release approval and an
authorized adapter supply. Ordinary Website builds use the sealed 4.0.3
compiler and report these three operations as unavailable. Cursor resumption,
exact historical replay, and raw PCRE2/Python syntax trees remain outside the
evaluated scope. All interactive results here are local observations.

## Revisions and compiler decision

| Component              | Evaluated identity                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website                | `dev` at `3187d307e1d4707d706b1a7508f0cc5c067cadac`, with the imported Lab tree on `codex/three-gap-labs-review`, followed by isolated qualification fixes                                                                                                                                                                                              |
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

| Capability                                                  | RegEx Lab                                                                                                                                                                  | STRling Lab                                                                                                                                                                                                               | regex101                                                                                                                                      | RegExr                                                                                     | Local IDE/runtime                                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editing and syntax feedback                                 | **Verified** CodeMirror, multiline editor, engine compile feedback, ECMAScript structure and hover.                                                                        | **Verified** Semantic STRling grammar, Simply JSON, compiler diagnostics with source selection, copy and editor find/replace.                                                                                             | Live pattern editing and named capture task. Documented token help, flag controls, and supported free-spacing formatting.                     | Public editor **blocked**. Project documents editing, highlighting and language reference. | VS Code documents regex Find/Replace, selections, and keyboard commands. IDE behavior is documentation evidence.                                 |
| Engine, version and options                                 | **Verified** Browser JS, PCRE2 10.42/10.43/10.49, CPython 3.11/3.14 and 3.11 bytes. Browser JS identifies the environment.                                                 | **Verified** Five exact compiler profiles and artifact-eligible runtime selection, with flags, profile digest, and runtime version.                                                                                       | Live PCRE2 selector and documented JavaScript, Python and additional dialects.                                                                | Public editor **blocked**. Project documents JavaScript and PHP/PCRE modes.                | CPython 3.13.5 was identified and executed in the local shell. A source file can call `re` with explicit flags.                                  |
| Search, global iteration, replacement, split and extraction | **Verified** Search, full match, first, scan, literal and native replacement, split, and match/capture JSON extraction. PCRE2 split uses a documented host operation.      | **Verified** Same controls for eligible artifacts. Python bytes show hex values.                                                                                                                                          | Live match results. Documented substitution, extraction/export and typed replacement. Split equivalence was unverified.                       | Public editor **blocked**. Project documents replace and lists of matches.                 | Local `re.finditer`, `fullmatch`, `sub`, and `split` were observed. Exporting capture values requires code.                                      |
| Highlighting, participation and coordinates                 | **Verified** Matches, numbered/named groups, duplicate name assertions by index, nonparticipation, native and editor offsets.                                              | **Verified** Same capture inspector with compiler links where source mappings exist.                                                                                                                                      | Live group names and numeric start/end over two input tokens.                                                                                 | Public editor **blocked**. Project documents highlighted matches and hover details.        | The native Python run returned positions and named values. VS Code documents editor highlights. Generated artifact source maps are Lab-specific. |
| Unicode, multiline and zero-width behavior                  | **Verified** Native units, empty-match advancement, engine options and resource boundaries.                                                                                | **Verified** PCRE2 10.42 zero-width offsets across an astral scalar, Python text scalar and bytes coordinates.                                                                                                            | Engines documented as distinct. Boundary behaviors were unverified in the live comparison.                                                    | Public test **blocked**.                                                                   | The local Python comparison confirmed scalar positions after an astral character. Border cases for the IDE search panel were unverified.         |
| Actual debugger                                             | **Verified** PCRE2 interpreter callouts with next/previous steps, capture state, backtracking flags and truncation. JS/Python stepping is **by design** unsupported.       | **Verified** Same debugger for PCRE2 artifacts, with compiler mapping where available.                                                                                                                                    | Documented PCRE2 50-step preview, longer traces and capture views on paid plan.                                                               | Step debugger was unverified.                                                              | VS Code can debug host code. Python `re.DEBUG` documents compile debugging output. Interpreter-step UI was unverified.                           |
| Explanations and uncertainty                                | **Verified** ECMAScript syntax tree. **Deficient** PCRE2 and Python expose engine diagnostics without a qualified dialect-wide AST.                                        | **Verified locally** Canonical Semantic IR and bounded outcomes for matched, no match, unknown and unavailable, with proven/likely distinctions. **Blocked** in the ordinary distribution until the adapter is qualified. | Token explanations displayed in editor. Pro documentation adds parser/graph capabilities. Canonical STRling proof is outside reference scope. | Public editor **blocked**. Project documents token explanations and quick reference.       | Vendor documentation and interpreter errors are separate evidence. The baseline offered no canonical STRling proof or explanation.               |
| Formatting, conversion and reconstruction                   | Raw regex transforms across dialects are **by design** unsupported.                                                                                                        | **Verified locally** Idempotent formatting and UTF-8 diagnostics, both exact conversion directions and round trip, partial and unsupported with governed evidence. **Blocked** for distribution.                          | Documented regex formatting and dialect conversion. Equivalent canonical STRling reconstruction proof was unverified.                         | Canonical formatting or conversion was unverified.                                         | Text editing in VS Code and direct execution in Python. Canonical STRling reconstruction was outside this comparison.                            |
| Tests, revisions and timing                                 | **Verified** Named assertions, edge cases, same-subject and same-revision comparisons, downloadable witnesses, bounded warmup and timing.                                  | **Verified** Shared test and comparison UI with compiler evidence and emitted artifacts.                                                                                                                                  | Unit tests documented. Benchmark is documented as paid. Local revision comparison was unverified.                                             | Public workflow **blocked**.                                                               | A saved Python script can repeat cases and local Git can compare revisions. Integrated workbench timing was unverified.                          |
| Samples, persistence, import/export and sharing             | **Verified** Multiple datasets, local archive, explicit settings links, opt-in file export, and fresh runs after import. Cursor resumption is unavailable.                 | **Verified** Same session behavior. Explicit artifact transfer preserves compiler provenance for a fresh run in RegEx Lab.                                                                                                | Documented workspace save/share, separate Library publishing and file tooling.                                                                | Public workflow **blocked**. Project documents saved and shared expressions.               | Local source and fixture files. Session schema, redacted settings links, and explicit authoring import are specific to the Labs.                 |
| Keyboard and responsive interaction                         | **Verified** Keyboard tabs, narrow viewport, Chromium axe without serious or critical findings in tested routes.                                                           | **Verified** Shared keyboard and mobile layout, including reachable semantic tool controls.                                                                                                                               | Desktop reference walkthrough. Full accessibility/mobile parity was unverified.                                                               | Public workflow **blocked**.                                                               | VS Code documents keyboard navigation and accessibility. Desktop IDE operation has no mobile web comparator.                                     |
| Isolation, timeouts and recovery                            | **Verified** Worker termination, stale replies rejected, recovery, bounded output and PCRE2 memory/work. JS and Python have no browser-enforced per-worker memory ceiling. | **Verified** Exact artifact/profile binding, isolated compiler/adapter workers, same-origin asset/digest checks, bounded evaluator and explicit subject privacy.                                                          | Matching is browser-local according to vendor docs. Runtime termination and memory policy were unverified.                                    | Public workflow **blocked**.                                                               | The local comparison ran benign cases in a separate process. It supplied no browser worker isolation or memory claims.                           |

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

The current PCRE2 and Python runtime APIs supply execution and diagnostic
positions. A raw token tree with trustworthy source ranges requires a
separately qualified dialect parser. regex101's parser covers both dialects
under a separate commercial distribution license. The Labs retain native
diagnostics for these engines and provide an interactive tree for ECMAScript
and canonical Semantic IR. [Reference parser license](https://support.regex101.com/regex-parser/pricing/).

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

## Main-only integration qualification

The Website PR uses `main` at `3187d307e1d4707d706b1a7508f0cc5c067cadac` as its
base. The original worktree remains separate from the reviewed changes. Its
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

## Remaining release gate

| Owner                  | Required action                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler release owner | The exact-source admission for isolated Website qualification is recorded. A separately distributed compiler release requires its own certification and publication authorization.                   |
| Website release owner  | Approve an explicit production adapter supply and Website release after reviewing qualification on the immutable candidate. Exact cursor resumption and raw dialect syntax trees remain unavailable. |

The existing 4.0.3 registry coordinate and interop contract remain intact.
The compiler's scoped qualification runs against the exact private artifact.
Production builds follow their own release policy.
[Compiler candidate record](https://github.com/strling-lang/strling/blob/156a0b54186e1d457fd47696d9f088e2c8b23360/docs/migration/records/lab-compiler-tools-candidate.yaml).

## Source integration without deployment

Review commits and the PR title carry `[skip netlify]`. A source-only merge
must put `[skip netlify]` in the actual merge commit message as well. Confirm
the current production deployment's commit after merging. The next unmarked
push can include all skipped changes and requires separate release approval.
The build refuses the private adapter on Netlify. Ordinary builds remain
available with the sealed compiler and report canonical tools unavailable.
[Netlify deploy controls](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy) ·
[Netlify build metadata](https://docs.netlify.com/build/configure-builds/environment-variables/#build-metadata).
