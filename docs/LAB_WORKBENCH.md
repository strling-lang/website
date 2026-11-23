# Lab workbench development

Both routes use [Workbench.astro](../src/components/lab/Workbench.astro),
[labWorkbench.ts](../src/scripts/labWorkbench.ts), and the modules under
[src/lib/regex-lab](../src/lib/regex-lab/). Both Labs place runtime limits and
license links below the workbench panels, and test expectation examples in the
test editor. RegEx Lab lists the selected runtime's flags in the Flags input
placeholder and tooltip. The [feature inventory](LAB_FEATURE_INVENTORY.md)
describes the operations, saving, and sharing workflows.

## Ownership

| Boundary                   | Implementation                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authoring and presentation | CodeMirror 6, shared Astro markup, and accessible tool panels. Semantic STRling keywords come from the canonical 1.0 language catalog. JSON editing is constrained to Simply builder data.                                      |
| Canonical compiler         | The pinned 4.0.3 TypeScript Preview adapter explicitly initializes the packaged WebAssembly. The worker sends canonical compile requests and returns exact diagnostics, IR, analysis, portability decisions, and artifact data. |
| Interactive execution      | The browser provider checks eligibility and dispatches to a disposable worker. Operation behavior comes from the selected runtime and the documented host wrapper.                                                              |
| Investigation              | ECMAScript structure uses regexpp. Semantic structure uses compiler IR and source maps. PCRE2 traces are interpreter callouts with native positions and capture state.                                                          |
| Persistence                | Session schemas, portable bundles, redaction, and an origin-local archive. Saved observations are inert.                                                                                                                        |
| Certified evidence         | The Regex Conformance checkpoint parser, cursors, projections, and Compatibility Check keep their existing authority.                                                                                                           |

Profile JSON and the Semantic STRling keyword catalog are byte-for-byte mirrors
from the release source revision. The compiler validates and hashes target
profiles through its own inspection entrypoint. Semantic Specification
1.0-draft.1 remains a draft. [Canonical source profiles](https://github.com/strling-lang/strling/tree/d01ac3785736ad552c90f00b4ca13c0e2e5c9c62/spec/targets/profiles).

## Canonical compiler tools candidate

STRling 4.0.3's sealed interop interface exposes only its four registered
operations. The separate local adapter `strling-lab-wasm 0.1.0-rc.3` uses
`strling.lab-compiler-tools@1.0.0-rc.1` and base source
`4e58730bbf67eaff683268e285e7084ccda5fadd`. It calls Rust implementations of
Semantic STRling formatting, semantic conversion, semantic explanation, and
bounded no-match evaluation. The no-match clock uses `performance.now()`
in the worker, with the kernel retaining the 250 ms evaluator deadline and
its deterministic work limits.

For a local qualification build, use the exact compiler candidate recorded in
the [acceptance report](LAB_ACCEPTANCE.md) and its locked `bindings/lab-wasm`
instructions. Supply the file path. The website build and worker verify
SHA-256 `3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81`
against the checked-in pin.

```powershell
$env:STRLING_LAB_TOOLS_CANDIDATE = 'path/to/strling_lab_wasm.wasm'
npm run build
npm run test:e2e
```

The isolated build emits the WASM asset when the supplied file matches the
pin. Without the file the Lab uses released 4.0.3 and the semantic toolbar
reports canonical tools unavailable. Netlify builds refuse the private
adapter. Astro Preview serves the static worker
and WASM, and the development middleware serves the same opt-in asset.
Contract-specific browser cases run when the candidate is configured.
Consult the [acceptance report](LAB_ACCEPTANCE.md) for compiler ownership and
publication gates.

The build reads `scripts/lab-compiler-release.json`. Its current `sealed`
mode uses the released compiler alone. To switch to `certified`, verify the
compiler owner's signed closure and independently fetch the immutable release.
Pin the approved adapter version, source and kernel-base commits, protocol,
exact size and digest, closure digest, compatibility, limits, and asset URL.
The current consumer expects a dedicated immutable GitHub release under
`strling-lang/strling` with tag `lab-wasm-v<version>` and asset
`strling_lab_wasm.wasm`. The release owner must approve that coordinate.

Clean certified builds verify the published release's tag, immutability,
source and asset metadata without credentials. They fetch the bounded asset
over HTTPS, accept only the compiler repository's GitHub delivery redirect,
check the bytes, and verify the shared Wasm ABI, descriptor and memory ceiling.
Absent, changed or incompatible inputs fail the build. There is no local
override in certified mode. The emitted version-and-digest path is same-origin
and immutable. The worker independently checks its size, digest, imports,
descriptor, operation, profile and subject binding. The 4.0.3 compiler remains
the compilation provider and retains its own Wasm and protocol.
The [release and rollback checklist](LAB_ACCEPTANCE.md#production-preparation-and-rollback)
records the deployment boundary and required public verification.

Both Labs serve the PCRE2 license texts as same-origin static downloads.
Git pins these files to LF and each import disables inlining, keeping the
downloads reproducible across checkout settings.
The embedded Python engine source and downloadable example sources also use
LF so their bytes and the generated worker and page identities stay stable.

Formatting uses a canonical source document and byte-position diagnostics.
Conversion reads accepted Semantic IR and can apply only exact output with
matching reconstruction fingerprints. Partial output can be inspected and
copied for manual review. No-match explanation reads canonical semantic
evidence, evaluates Search mode and optionally projects to the selected
exact profile. It preserves outcome, disposition, confidence, evidence
class, native locations, and limit reports. Subject text is held in the
session and worker for evaluation. The canonical result records its digest,
lengths, and locations.

## Interactive provider qualification

The interactive identity namespace is separate from certified profiles.
Interactive execution requires the registered identity and excludes certified
projection digests. A new provider needs an identified runtime, supported
representations, operation semantics, cancellation, initialisation and
execution limits, native coordinates, and positive and negative runtime
tests. Existing checkpoint acceptance continues to require the checkpoint
governance path. [Conformance integration](REGEX_CONFORMANCE_INTEGRATION.md).

Each worker exchange acknowledges a unique nonce before supplying a result.
The execution provider validates request ID, provider, operation, runtime
version and coordinate units before accepting output. Match values are
verified against the submitted subject at the reported native coordinates.
Full-match results must also span the complete native subject. Responses with
the wrong compiler target or artifact profile are rejected before entering
the cache. Source and subject edits, target changes, and
session replacement abort outstanding work. The shared coordinator also
checks generation, provider and execution identity when a caller uses it.

| Provider                     | Evidence and scope                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser JavaScript           | Native RegExp. Browser-reported environment and provider version are recorded. The JS engine build is generally unavailable. Match indices are UTF-16 code units.                                                                                                        |
| PCRE2 10.42, 10.43 and 10.49 | Separate interpreter-only 8-bit WASM builds with runtime-checked engine version. UTF-8 mode is mandatory and backslash-C is prohibited. The capture vector and byte offsets come directly from PCRE2. The bridge accepts the canonical 10.42 and 10.43 artifact options. |
| Python re                    | Pinned Pyodide builds run CPython 3.11 and 3.14. Workers verify the actual runtime version. The fixed re bridge accepts JSON arguments, supports text spans in code points, and supports UTF-8 encoded bytes with native byte spans and hex output.                      |

PCRE2 Split is a Lab host operation over successive PCRE2 delimiters with
captured fields included. JavaScript and Python Split use their native host
APIs. The PCRE2 debugger records explicit and automatic callouts and the
runtime's start-attempt and backtrack flags. It uses a separately
instrumented first search with auto-possessification and start optimizations
disabled. These changes can make the trace differ from an ordinary optimized
search. [PCRE2 callouts](https://www.pcre.org/current/doc/html/pcre2callout.html).

Native structure inspection is a separate worker operation. It accepts a
pattern and its runtime options and compiles without a sample. PCRE2 checks
normal syntax first, reads the compiled name table, and enumerates native
automatic and explicit callouts in a separately instrumented compile. The
structure is marked partial because these compiled items omit directives and
some nesting and relationships. Python checks the pattern with the active
CPython `re.compile`, then projects the bundled `re._parser` instructions.
These are optimized parser instructions. Compile errors retain native
coordinates and individual tree nodes have no claimed source range.
Unrecognized instructions and truncation produce partial output. A missing
parser produces an unavailable result. The workers cap PCRE2 at 512 items
and Python at 510 projected instructions and 24 nesting levels. The host
verifies shape, request, selected version, authority and coordinate ranges.
[PCRE2 callouts](https://www.pcre.org/current/doc/html/pcre2callout.html) ·
[CPython 3.11 parser](https://github.com/python/cpython/blob/3.11/Lib/re/_parser.py) ·
[CPython 3.14 parser](https://github.com/python/cpython/blob/3.14/Lib/re/_parser.py).

## Isolation and limits

The sealed compiler, compiler tools, and execution provider each have one worker
lane. A newer task, an
aborted task, a crash, or a timeout terminates the relevant worker before it
can be reused. Initialization has a 15-second deadline, with up to 30 seconds
for the larger pinned Python runtime assets. Compiler execution has a 3-second
deadline and regex execution has a 1.5-second deadline. The
workbench also caps a suite, comparison, or timing action at 30 seconds.
Main-thread parsing of ECMAScript structure is capped at 8,192 editor units,
2,048 rendered constructs, and 100 hierarchy levels.

The workbench bounds pattern/source at 8,192 UTF-16 units, subject at 32,768,
replacement at 2,048, match and replacement iterations at 256 where scanned,
captures per match at 128, and serialized execution output at 524,288 units.
Native JS split also caps returned fields. The debugger retains at most 512
events and 4,096 capture slots. The PCRE2 reactor declares a 32 MiB memory
maximum and configures engine match, heap, and depth limits. Browsers do not
offer a general per-worker memory cap for RegExp or the Python interpreter.
The compiler tools adapter has a 64 MiB Wasm memory maximum, a 1 MiB
request and response limit, and a 272-level JSON nesting limit. Canonical no-match search accepts up to 4,096
Unicode scalars and 16 KiB of subject text. It can return unknown when a work
bound is reached. Inputs beyond the hard subject limits receive a size error.

All runtime assets are served from the website origin. Patterns and sample
data travel only in local messages to workers. The Python bridge does not
interpolate text into Python source. Browser document and worker CSP permits
same-origin worker scripts and WASM compilation. The checked-in hosting policy
does not enable general JavaScript eval. Imported documents, sessions, and
recorded objects are rendered through text nodes. Link fragments cannot
trigger automatic execution. [Site security policy](../SECURITY.md).

## Session and observation contracts

| Schema                                               | Contents                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| strling-lab-session-v2                               | Complete session snapshot with active source, alternate STRling draft when present, runtime and target, operation options, datasets and selection, tests, recordings, origin, and optional scan cursor. The v1 single-input form migrates to one named dataset. |
| strling-lab-archive-v1                               | Origin-local named sessions and timestamped immutable revisions.                                                                                                                                                                                                |
| strling-lab-bundle-v1                                | Legacy file envelope with inclusion metadata. Still readable and used for the existing settings-only link format.                                                                                                                                               |
| strling-regex-lab-execution-request-v1 and result-v1 | Exact raw pattern, input and config, identity, status, native spans, captures, timing, and optional interactive observation provenance.                                                                                                                         |
| strling-lab-tests-v1                                 | Named grouped assertions with independent subjects and operations.                                                                                                                                                                                              |
| strling-lab-trace-v1                                 | Instrumentation ID, bounded events, termination, and execution provenance.                                                                                                                                                                                      |
| strling-lab-comparison-v1                            | Runtime or revision comparison, source identity, witness inputs, native results, and normalized differences.                                                                                                                                                    |
| strling-lab-timing-v3                                | One full-sample experiment with a separate warmup, nine raw measurements, clock resolution estimates, runtime and compiler evidence, and completion status. Timing v1 and v2 remain readable as historical session data.                                        |

The explicit revision archive caps total serialized content at 2,000,000 UTF-16
units, with up to 12 sessions and 12 revisions per session. Save revision and
Download session capture the current session's complete available state.
Download writes a standalone session-v2 JSON file, including its replacement,
recorded outputs, original compiler source when available, and any saved scan
cursor. The file limit is 2,000,000 UTF-8 bytes. Import opens a separate working
copy with a fresh local session ID. Save a revision to keep the imported
recordings in the local archive.

A settings URL uses an allowlist of source format, runtime, target, and
operation selections. It excludes authored source, flags,
replacement text, user-defined labels, subjects, tests, and recordings.
Legacy fragments are size-limited and scrubbed from the address bar before
parsing. Imported files and links wait for explicit execution. Cross-Lab
imports refuse the other Lab's source format. An explicit artifact transfer
preserves the compiler origin in same-tab storage for a fresh RegEx run.

Restore makes historical observations visible. Run starts a fresh operation.
`strling-lab-continuation-v1` is an optional extension to session v2 for a
completed PCRE2 scan. It records the exact profile, runtime and provider
versions, Wasm digest, operation, match and output limits, native UTF-8
consuming-match boundary, and progression policy. Source, emitted pattern,
subject, effective options and compiler provenance are bound by SHA-256.
The browser checks these claims and the worker reconstructs the bounded prefix
using the same bridge as a fresh PCRE2 scan. Version 10.49 calls
`pcre2_next_match`. For 10.42 and 10.43 the bridge uses the native match
offsets and the engine's anchored, nonempty retry for empty matches. It
verifies that the saved match consumed input and that progression resumes
at its end with ordinary next-match options. It returns the suffix with native positions in the
original subject. The original request limits also apply to replay. The
same-tab STRling-to-RegEx transfer can explicitly preserve a checked boundary.
Changes to the subject bytes, selected provider or bound options cause a
refusal. Empty, final, partial, timed-out and cancelled scans provide no
eligible boundary at that point. JavaScript and Python offer fresh reruns
and recorded observations. [PCRE2 global matching](https://www.pcre.org/current/doc/html/pcre2_next_match.html).

## Working copies and interaction controls

RegEx and STRling each keep a separate versioned origin-local working store.
Changes are debounced at 380 ms and pending changes are flushed on page hide.
A working source owns an editable session snapshot and separate Semantic/Simply
text drafts. Its datasets can be duplicated locally or copied from a different
working source in the same Lab. Copying creates independent editable text.
An explicit session restore, import, settings link or artifact handoff opens a
separate working copy. A visit that restores work leaves Live off and waits for
explicit execution. Compiled responses, results, and investigations are not
promoted to current observations by loading local working storage.

The bounded working store uses localStorage so a small pending write can be
flushed synchronously when the page is hidden. Each mode is capped at 12 working
sources and 1,000,000 serialized UTF-16 units. IndexedDB would support larger
collections and async transaction semantics. The current limits and page-hide
flush favor the existing browser-local synchronous storage model. Failed writes
and stale-tab conflicts preserve the current editable copy and the previously
stored bytes. Corrupt working storage is reset only by explicit confirmation.
The separate revision archive and artifact handoff keep their existing formats.

The fixed primary control shows Stop after 250 ms of active work and returns
to Run as soon as the work ends. During the delay, pressing Run starts a fresh
execution. Stop cancels the active work and pauses Live. Ctrl/Command+Enter
retains explicit Run. Tall changes CSS
height for both editors without replacing either editor state. The tab strip
scrolls independently from its Copy and Download buttons. Specialized extraction,
integration-example, and conversion controls remain in their own panels.

The toolbar and panel rows align actions with the controls beneath any visible
label. They wrap without adding labels or changing focus order. The tab actions
stay centered at the edge of the scrolling tab list. Static and generated
technical disclosures share a padded body. Nested levels use a smaller inset,
including those that contain a single preformatted block. Native summaries
retain keyboard behavior and evidence text remains selectable.

Each editor header puts its saved-item selector first and Copy last. Manage
offers New, Rename, Duplicate, Delete, and Find / replace in editor. STRling
places its format action immediately before Copy. Copy writes the current
editor text to the clipboard. Sample text also offers **Use dataset from another
working copy** to bring in an independent copy of a dataset from the same Lab.

All editors share a compact Find and Replace panel. Search and replacement
treat regex syntax, backslashes, and dollar signs as literal text. Match Case
and Whole Word are independent options. Ctrl/Command+F opens the panel, Enter
and Shift+Enter navigate matches from the Find field, and Escape closes it.
F3 and the existing CodeMirror search shortcuts remain available. Find All
selects the matches for editing. Editor replacement is separate from the Lab's
runtime replacement operation.

Source links in Compiler, Structure, Artifact, Results, Semantic tools, and
Debugger use a dedicated CodeMirror decoration and a reveal effect. Validated
source spans produce one active range or point highlight without moving the
editing caret, changing a deliberate selection, or focusing the editor.
Clicking in the source or moving or extending its selection clears the linked
highlight and dismisses active search and diagnostic emphasis. The editor
keeps the native selection, search query, and diagnostic underlines. Explicit
navigation can reveal a new highlight. Document edits, unmapped steps, and
invalidated results clear the linked highlight as well. The Subject editor keeps
its match and capture behavior.

Compiler and RegEx structure lists share a wrapping row for the construct and
description. Nested lists stay inside their parent item. The first five levels
receive a visual inset so deeply nested patterns can still fit at narrow widths.
Descriptions longer than 90 characters remain available on the node tooltip.

Timing runs the current pattern against the full active sample. It reuses one
browser worker for one warmup and nine measured runs. The complete-series median
is the fifth value sorted numerically. A stopped or failed run keeps the
completed samples and any returned error. Existing time, input, and output
limits still apply. Compare remains the workflow for functional comparisons.

End-to-end timing uses the page clock and excludes compiler preparation and the
runtime initialization in the warmup. Worker compilation and execution use the
runtime worker clock, including CPython's performance counter for Python. The
STRling compiler reports its own clock and labels cached measurements. Bounded
clock probes take place before measured runs. The display selects seconds,
milliseconds, or microseconds, with a lower bound for values the clock or
display cannot distinguish. When the probe cannot estimate a step, the display
uses conservative precision. The expandable provenance and v3 export retain raw
values and resolution estimates. The runs describe this browser and do not
establish statistical significance.

The 8,192-unit source cap is retained. All three pinned PCRE2 reactors use
`MAX_PATTERN (8192 * 3)` bytes. A 32,768-unit ASCII pattern already exceeds
that buffer. Raising the shared limit would require new Wasm reactor artifacts
and independent validation of compiler, worker, structure, and persistence bounds.

## Build, qualification, and troubleshooting

1. Use the Node version in `.nvmrc` and install the locked dependencies with
   npm. The lock needs Node 22.23.4 or later, and the released compiler package
   declares Node 22.
2. Run npm run check, npm run lint, npm run format:check, npm test, and
   npm run test:e2e. The unit suite loads the published compiler and the real
   PCRE2 binaries. The Chromium suite checks both routes on desktop and mobile.
   Playwright owns its foreground preview lifecycle. Set
   `STRLING_WEBSITE_PREVIEW_PORT` to a free loopback port when another preview is
   running. The suite refuses to reuse an already running server. Set
   `STRLING_WEBSITE_EXTRA_BROWSERS=1` to add Firefox and WebKit. For
   an HTTPS preview, set `STRLING_WEBSITE_PREVIEW_CERT` and
   `STRLING_WEBSITE_PREVIEW_KEY` to a local loopback certificate and key.
   The local TLS preview applies the checked-in hosting CSP and accepts
   the test certificate in the local Playwright context. It serves the
   versioned assets with the configured immutable cache policy.
   `STRLING_WEBSITE_PREVIEW_OUT_DIR` selects a separately built static
   directory. Use it to keep sealed and qualification outputs separate.
3. If changing PCRE2, download the selected GitHub release-tag source archive.
   Invoke the following with Python 3.12 or later and Zig 0.14.0-dev.2456.
   The script validates the source SHA-256, rebuilds the interpreter and
   copies its upstream notice. Pin the resulting WASM SHA-256 in
   `execution.worker.ts`.

       python scripts/build-lab-pcre2.py pcre2-10.42.tar.gz --version 10.42
       python scripts/build-lab-pcre2.py pcre2-10.43.tar.gz --version 10.43
       python scripts/build-lab-pcre2.py pcre2-10.49.tar.gz --version 10.49

4. If Python startup fails in the built site, check the worker and the
   self-hosted Pyodide assets. Its binary needs the unmodified
   pyodide.asm.wasm basename under its versioned asset directory. Keep the
   bridge module, lockfile, and standard library from the same package. In
   development, Vite serves the old 3.11 glue in a module worker through a
   local adapter. The production build loads the pinned classic glue directly.
5. When a compiler target emits an artifact but Run artifact is unavailable,
   inspect the exact target, engine options, and requirements in Artifact.
   Add a dedicated eligibility mapping and tests before enabling a new target.
6. Run the browser CSP test after changing compiler or runtime assets. An
   Astro preview does not normally apply the repository's deployment headers.

If debugging a report, ask for the target, operation, environment, result
status, and a redacted minimal reproducer. Avoid logging raw inputs.

## Certified RC4 release input

The certified manifest pins the Preview artifact, its source and tree, the
separately certified compiler source, the independently verified attestation
and evidence root, and every file in the release inventory. The build requires
the exact immutable GitHub release and checks each asset's bytes, hashes,
and signed evidence references. The Wasm ABI, compiler base, and memory
guard still apply before the integration emits a content-addressed asset.

Release acceptance verifies the canonical compiler certificate and GitHub's
release attestation independently. A production build uses the public release
transport, including when built outside Netlify. A review build can exercise
the same loader with the frozen local release inventory through an external
test transport. That review only qualifies the artifacts it actually used.

The existing private development pin stays separate. The certified manifest
cannot use a private override. The stable 4.0.3 compiler continues to serve its
released interoperability operations.
