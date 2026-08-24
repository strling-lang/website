import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CheckpointValidationError,
  consumeCheckpoints,
  createEmptyConsumptionState,
  sha256Json,
  validateCheckpointBundle,
} from '../../src/lib/regex-conformance/index.ts';
import {
  duplicateCheckpointBundle,
  fixturePaths,
  fixtureSemanticSnapshot,
  malformedDigestCheckpointBundle,
  skippedCheckpointBundle,
  validCheckpointBundle,
} from '../fixtures/regex-conformance/checkpoints.mjs';

const hasIssue = (error, code) =>
  error instanceof CheckpointValidationError &&
  error.issues.some((issue) => issue.code === code);

const rejection = (bundle, code) => {
  assert.throws(
    () => validateCheckpointBundle(bundle, fixtureSemanticSnapshot),
    (error) => hasIssue(error, code),
  );
};

const redigestCheckpoint = (bundle, checkpointPath) => {
  const checkpoint = bundle.files[checkpointPath];
  const entry = bundle.index.checkpoints.find(
    (candidate) => candidate.path === checkpointPath,
  );
  entry.digest = sha256Json(checkpoint);
};

test('validates and normalizes a complete test-only checkpoint chain', () => {
  const result = validateCheckpointBundle(
    validCheckpointBundle(),
    fixtureSemanticSnapshot,
  );
  assert.equal(result.checkpoints.length, 2);
  assert.equal(result.checkpoints[0].labProjection.profiles.length, 3);
  assert.equal(
    result.checkpoints[0].compatibilityProjection.findings.length,
    6,
  );
  assert.deepEqual(
    new Set(
      result.checkpoints[0].compatibilityProjection.findings.map(
        (finding) => finding.state,
      ),
    ),
    new Set([
      'supported',
      'unsupported',
      'conditional',
      'not-applicable',
      'not-tested',
      'unknown-insufficient-evidence',
    ]),
  );
});

test('fails closed on unsupported schema versions', () => {
  const bundle = validCheckpointBundle();
  bundle.index.schemaVersion = 'future-schema';
  rejection(bundle, 'UNSUPPORTED_SCHEMA_VERSION');
});

test('fails closed on a broken sequence', () => {
  const bundle = validCheckpointBundle();
  bundle.index.checkpoints[1].sequence = 3;
  rejection(bundle, 'BROKEN_SEQUENCE');
});

test('fails closed on skipped predecessors', () => {
  rejection(skippedCheckpointBundle(), 'SKIPPED_PREDECESSOR');
});

test('fails closed on duplicate checkpoints', () => {
  rejection(duplicateCheckpointBundle(), 'DUPLICATE_CHECKPOINT');
});

test('fails closed on digest mismatch', () => {
  rejection(malformedDigestCheckpointBundle(), 'DIGEST_MISMATCH');
});

test('fails closed when a referenced projection is missing', () => {
  const bundle = validCheckpointBundle();
  delete bundle.files[fixturePaths.labOne];
  rejection(bundle, 'MISSING_REFERENCED_FILE');
});

test('fails closed on semantic snapshot incompatibility', () => {
  assert.throws(
    () =>
      validateCheckpointBundle(validCheckpointBundle(), {
        snapshotId: 'different-snapshot',
        digest: `sha256:${'f'.repeat(64)}`,
      }),
    (error) => hasIssue(error, 'SEMANTIC_SNAPSHOT_INCOMPATIBLE'),
  );
});

test('fails closed on duplicate profile identities', () => {
  const bundle = validCheckpointBundle();
  const checkpoint = bundle.files[fixturePaths.checkpointOne];
  checkpoint.profileReleases.push(
    structuredClone(checkpoint.profileReleases[0]),
  );
  redigestCheckpoint(bundle, fixturePaths.checkpointOne);
  rejection(bundle, 'DUPLICATE_PROFILE_IDENTITY');
});

test('fails closed on malformed compatibility states', () => {
  const bundle = validCheckpointBundle();
  const projection = bundle.files[fixturePaths.compatibilityOne];
  projection.findings[0].state = 'probably';
  const checkpoint = bundle.files[fixturePaths.checkpointOne];
  checkpoint.projections.compatibility.digest = sha256Json(projection);
  redigestCheckpoint(bundle, fixturePaths.checkpointOne);
  rejection(bundle, 'MALFORMED_COMPATIBILITY_STATE');
});

test('unsupported findings without evidence are rejected', () => {
  const bundle = validCheckpointBundle();
  const projection = bundle.files[fixturePaths.compatibilityOne];
  const unsupported = projection.findings.find(
    (finding) => finding.state === 'unsupported',
  );
  unsupported.evidence = null;
  const checkpoint = bundle.files[fixturePaths.checkpointOne];
  checkpoint.projections.compatibility.digest = sha256Json(projection);
  redigestCheckpoint(bundle, fixturePaths.checkpointOne);
  rejection(bundle, 'MALFORMED_COMPATIBILITY_STATE');
});

test('consumes Lab and Compatibility with independent cursors', () => {
  const validated = validateCheckpointBundle(
    validCheckpointBundle(),
    fixtureSemanticSnapshot,
  );
  const empty = createEmptyConsumptionState();
  const labOnly = consumeCheckpoints(empty, validated, 'lab');
  assert.equal(labOnly.lab.lastConsumedCheckpoint, 'test-only-checkpoint-0002');
  assert.equal(labOnly.lab.profiles.length, 3);
  assert.equal(labOnly.compatibility.lastConsumedCheckpoint, null);
  assert.equal(labOnly.compatibility.profiles.length, 0);

  const both = consumeCheckpoints(labOnly, validated, 'compatibility');
  assert.equal(
    both.compatibility.lastConsumedCheckpoint,
    'test-only-checkpoint-0002',
  );
  assert.equal(both.compatibility.profiles.length, 3);
  assert.equal(both.compatibility.findings.length, 6);
});

test('checkpoint replay is deterministic and idempotent', () => {
  const validated = validateCheckpointBundle(
    validCheckpointBundle(),
    fixtureSemanticSnapshot,
  );
  let state = createEmptyConsumptionState();
  state = consumeCheckpoints(state, validated, 'lab');
  state = consumeCheckpoints(state, validated, 'compatibility');
  const replayedLab = consumeCheckpoints(state, validated, 'lab');
  const replayedBoth = consumeCheckpoints(
    replayedLab,
    validated,
    'compatibility',
  );
  assert.deepEqual(replayedBoth, state);
});
