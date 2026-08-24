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
