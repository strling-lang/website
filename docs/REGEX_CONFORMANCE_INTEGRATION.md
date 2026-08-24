# Regex Conformance downstream integration

The website consumes certified Regex Conformance checkpoints. It does not own
profile, compatibility, semantic, or empirical truth.

## Version 1 consumer boundary

`src/lib/regex-conformance/parser.ts` is the protocol boundary. It validates a
versioned checkpoint index, coverage checkpoint manifests, Lab and
Compatibility projections, and an evidence manifest before returning
normalized typed records. Product code consumes only those normalized records.

The current adapter models paths equivalent to:

```text
downstream/checkpoints/index.v1.json
downstream/checkpoints/coverage-shard-XXXX.v1.json
downstream/lab/coverage-shard-XXXX.json
downstream/compatibility/coverage-shard-XXXX.json
```

Exact upstream serialization can change behind the parser without requiring a
Lab or Compatibility redesign.

`src/data/regexConformance.ts` exposes the website's current canonical semantic
snapshot identity from the existing RegEx Docs projection. A real checkpoint
must validate against that identity before either product state is generated.

The v1 digest contract is SHA-256 over canonical JSON: object keys are sorted
recursively, arrays retain order, and the digest is encoded as
`sha256:<lowercase hex>`. The first real checkpoint integration must confirm
that this byte/canonicalization contract matches the certified producer before
any cursor advances.

## Fail-closed validation

The consumer rejects unsupported schema versions, broken or duplicate
sequences, skipped predecessors, missing files, digest mismatches, semantic
snapshot drift, duplicate/conflicting profile identities, and malformed
compatibility states. Compatibility findings that claim supported,
unsupported, or conditional behavior require an evidence reference;
conditional findings also require conditions. Not-tested and unknown findings
require an explanation.

## Independent cursors

`RegexConsumptionState` holds separate Lab and Compatibility cursors. Each
product can consume the same validated checkpoint chain independently.
Replaying an already consumed chain is idempotent. The checked-in production
state keeps both cursors `null` until a real certified checkpoint is available.

All synthetic profiles, findings, evidence, and checkpoint payloads are under
`tests/fixtures/regex-conformance/`. Website source must never import those
fixtures.

## Progressive profile resolver

`src/lib/regex-profiles/resolver.ts` derives every question and answer from the
normalized profile metadata. It filters candidates after each answer, omits
dimensions already implied by the remaining candidates, stops as soon as one
exact profile remains, and reports ambiguous or invalid metadata without
inventing a choice. Lab and Compatibility share this resolver, so new profile
branches and deeper catalogs require checkpoint metadata rather than component
changes.

## Lab execution boundary

`src/lib/regex-lab/` defines versioned request/result unions and a provider
interface for browser-local or remote-isolated execution. Result states keep
no-match, compile rejection, runtime failure, resource termination,
unsupported operation, and infrastructure failure distinct. Optional spans,
captures, native metadata, and timing stay optional rather than becoming false
empty values.

The reactive coordinator owns debounce, abort signals, request generations,
and stale-response rejection. The fixture provider used to certify those
behaviors is test-only and is not imported by website source.

The Lab custom element accepts normalized Lab state and an execution provider.
Its controls are generated from checkpoint operations and options; the page has
no runtime-specific branches. Until a certified state and real provider are
wired at build time, the production page stays locked and `noindex`.

## Compatibility projection

`src/lib/regex-compatibility/` left-joins normalized findings onto the existing
canonical semantic feature catalog. It preserves all six states. A catalog
feature without a checkpoint finding is rendered as unknown/insufficient
evidence with an explicit absent-finding origin; it is never inferred to be
unsupported. The evidence surface retains exact profile and release IDs,
tested scope, checkpoint and semantic snapshot identity, evidence-manifest
identity, and observation/derived-finding references.

The Compatibility custom element supports one exact environment or a
multi-environment comparison using the shared progressive resolver. The
production page remains empty, locked, and `noindex` while the Compatibility
cursor is `null`.

## First-checkpoint integration runbook

1. Import or copy the certified downstream index and referenced files without
   changing their bytes or identities.
2. Adapt any upstream serialization changes only inside the protocol parser.
3. Validate the bundle against `regexConformanceSemanticSnapshot`.
4. Consume Lab and Compatibility independently, enabling only the projection
   present and ready for each product.
5. Configure eligible Lab profiles with a matching execution provider.
6. Run the focused contract, product, accessibility, and browser suites before
   advancing either production cursor.
