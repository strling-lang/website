# Lab workbench development

Both routes use [Workbench.astro](../src/components/lab/Workbench.astro),
[labWorkbench.ts](../src/scripts/labWorkbench.ts), and the modules under
[src/lib/regex-lab](../src/lib/regex-lab/). The [user guide](../src/pages/lab/guide.astro)
describes operations, test expectations, saving, and sharing.

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
operations. The separate local adapter `strling-lab-wasm 0.1.0-rc.2` uses
`strling.lab-compiler-tools@1.0.0-rc.1` and base source
`4e58730bbf67eaff683268e285e7084ccda5fadd`. It calls Rust implementations of
Semantic STRling formatting, semantic conversion, semantic explanation, and
bounded no-match evaluation. The no-match clock uses `performance.now()`
in the worker, with the kernel retaining the 250 ms evaluator deadline and
its deterministic work limits.

For a local qualification build, use the exact compiler candidate recorded in
the [acceptance report](LAB_ACCEPTANCE.md) and its locked `bindings/lab-wasm`
instructions. Supply the file path. The website build and worker verify
SHA-256 `283ff9d319b4a28220aeac8b187834b12fc6634c9ad1beb9be3be4d4247cc04b`
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

## Isolation and limits

The sealed compiler, compiler tools, and execution provider each have one worker
lane. A newer task, an
aborted task, a crash, or a timeout terminates the relevant worker before it
can be reused. Initialization has a 15-second deadline. Compiler execution has
a 3-second deadline and regex execution has a 1.5-second deadline. The
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

| Schema                                               | Contents                                                                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| strling-lab-session-v2                               | Source format, source, chosen runtime and target, flags and operation, current datasets, tests, optional derivation, optional recorded provenance. The v1 single-input form migrates to one named dataset. |
| strling-lab-archive-v1                               | Origin-local named sessions and timestamped immutable revisions.                                                                                                                                           |
| strling-lab-bundle-v1                                | One session and explicit redaction choices.                                                                                                                                                                |
| strling-regex-lab-execution-request-v1 and result-v1 | Exact raw pattern, input and config, identity, status, native spans, captures, timing, and optional interactive observation provenance.                                                                    |
| strling-lab-tests-v1                                 | Named grouped assertions with independent subjects and operations.                                                                                                                                         |
| strling-lab-trace-v1                                 | Instrumentation ID, bounded events, termination, and execution provenance.                                                                                                                                 |
| strling-lab-comparison-v1                            | Runtime or revision comparison, source identity, witness inputs, native results, and normalized differences.                                                                                               |
| strling-lab-timing-v1                                | Bounded raw measurements, warmup, environment, sample size, and distribution summary.                                                                                                                      |

The archive caps total serialized content at 2,000,000 UTF-16 units, with up
to 12 sessions and 12 revisions per session. Downloaded session files have the
same text limit. Downloads contain the active source and configuration. The
sample, test, recording and source-origin controls opt into additional data
for that file only. A settings URL uses an allowlist of source format, runtime,
target, and operation selections. It excludes authored source, flags,
replacement text, user-defined labels, subjects, tests, and recordings.
Legacy fragments are size-limited and scrubbed from the address bar before
parsing. Imported files and links wait for explicit execution. Cross-Lab
imports refuse the other Lab's source format. An explicit artifact transfer
preserves the compiler origin in same-tab storage for a fresh RegEx run.

Restore makes historical observations visible. Run uses the current provider
and fresh operation state. The request and session contracts do not encode a
resumable cursor, so exact cursor resumption and cross-provider replay are
outside the verified scope. This includes the cursor-resumption variant of
the Research Intelligence T8 task.

## Build, qualification, and troubleshooting

1. Use the Node version in `.nvmrc` and install the locked dependencies with
   npm. The lock needs Node 22.19 or later, and the released compiler package
   declares Node 22.
2. Run npm run check, npm run lint, npm run format:check, npm test, and
   npm run test:e2e. The unit suite loads the published compiler and the real
   PCRE2 binaries. The Chromium suite checks both routes on desktop and mobile.
   Playwright owns its foreground preview lifecycle. Set
   `STRLING_WEBSITE_PREVIEW_PORT` to a free loopback port when another preview is
   running. The suite refuses to reuse an already running server.
3. If changing PCRE2, download the selected GitHub release-tag source archive.
   Invoke the following with Python 3.12 or later and Zig 0.14.0-dev.2456.
   The script validates the source SHA-256, rebuilds the interpreter and
   copies its upstream notice.

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
