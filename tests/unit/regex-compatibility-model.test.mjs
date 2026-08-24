import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCompatibilityRows,
  compatibilityCoverage,
  compatibilityEvidenceDetails,
  compatibilityStatePresentation,
  filterCompatibilityRows,
} from '../../src/lib/regex-compatibility/index.ts';
import * as checkpointConsumer from '../../src/lib/regex-conformance/index.ts';
import {
  fixtureSemanticSnapshot,
  validCheckpointBundle,
} from '../fixtures/regex-conformance/checkpoints.mjs';

const catalog = [
  {
    semanticFeatureId: 'feature.named-capture',
    name: 'Named capture',
    categoryId: 'groups-and-captures',
    categoryName: 'Groups and captures',
    route: '/regex/docs/groups-and-captures/named-capture/',
  },
  {
    semanticFeatureId: 'feature.word-boundary',
    name: 'Word boundary',
    categoryId: 'anchors-and-boundaries',
    categoryName: 'Anchors and boundaries',
    route: '/regex/docs/anchors-and-boundaries/word-boundary/',
  },
  {
    semanticFeatureId: 'feature.wildcard',
    name: 'Wildcard',
    categoryId: 'grammar-and-composition',
    categoryName: 'Grammar and composition',
    route: '/regex/docs/grammar-and-composition/wildcard/',
  },
];

const validated = checkpointConsumer.validateCheckpointBundle(
  validCheckpointBundle(),
  fixtureSemanticSnapshot,
);
const consumed = checkpointConsumer.consumeCheckpoints(
  checkpointConsumer.createEmptyConsumptionState(),
  validated,
  'compatibility',
).compatibility;

test('exposes every canonical non-Boolean compatibility state', () => {
  assert.deepEqual(Object.keys(compatibilityStatePresentation).sort(), [
    'conditional',
    'not-applicable',
    'not-tested',
    'supported',
    'unknown-insufficient-evidence',
    'unsupported',
  ]);
});

test('published profiles and feature rows appear directly from checkpoint data', () => {
  assert.deepEqual(
    consumed.profiles.map((profile) => profile.profileReleaseId),
    [
      'test-only.cli.pcre2grep.10.46',
      'test-only.python.stdlib-re.cpython.3.13',
      'test-only.python.stdlib-re.cpython.3.14',
    ],
  );
  const rows = buildCompatibilityRows(
    catalog,
    consumed.profiles,
    consumed.findings,
    consumed.profiles.map((profile) => profile.profileReleaseId),
  );
  assert.equal(rows.length, catalog.length);
  assert.deepEqual(
    new Set(rows.flatMap((row) => row.cells.map((cell) => cell.state))),
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

test('single-profile and comparison selections preserve exact identity', () => {
  const single = buildCompatibilityRows(
    catalog,
    consumed.profiles,
    consumed.findings,
    ['test-only.python.stdlib-re.cpython.3.14'],
  );
  assert.equal(single[0].cells.length, 1);
  assert.equal(single[0].cells[0].state, 'supported');

  const comparison = buildCompatibilityRows(
    catalog,
    consumed.profiles,
    consumed.findings,
    [
      'test-only.python.stdlib-re.cpython.3.14',
      'test-only.python.stdlib-re.cpython.3.13',
    ],
  );
  assert.deepEqual(
    comparison[0].cells.map((cell) => cell.state),
    ['supported', 'conditional'],
  );
});

test('feature lookup searches canonical name, semantic ID, and category', () => {
  const rows = buildCompatibilityRows(
    catalog,
    consumed.profiles,
    consumed.findings,
    [consumed.profiles[0].profileReleaseId],
  );
  assert.equal(
    filterCompatibilityRows(rows, 'feature.word-boundary').length,
    1,
  );
  assert.equal(filterCompatibilityRows(rows, 'Named').length, 1);
  assert.equal(
    filterCompatibilityRows(rows, '', 'grammar-and-composition').length,
    1,
  );
});

test('evidence details resolve checkpoint, scope, digests, and references', () => {
  const profile = consumed.profiles.find(
    (item) =>
      item.profileReleaseId === 'test-only.python.stdlib-re.cpython.3.14',
  );
  assert.ok(profile);
  const row = buildCompatibilityRows(
    catalog,
    consumed.profiles,
    consumed.findings,
    [profile.profileReleaseId],
  )[0];
  const details = compatibilityEvidenceDetails(row, row.cells[0], profile);
  assert.equal(details.checkpointId, 'test-only-checkpoint-0001');
  assert.equal(details.testedScope.operationId, 'search-all');
  assert.match(details.evidence.digest, /^sha256:/);
  assert.equal(details.evidence.observationReferences.length, 1);
  assert.match(details.sourceSemanticSnapshot.digest, /^sha256:/);
  assert.match(details.evidenceManifest.digest, /^sha256:/);
});

test('an absent finding stays unknown and never becomes unsupported', () => {
  const rows = buildCompatibilityRows(
    catalog,
    consumed.profiles,
    consumed.findings,
    ['test-only.python.stdlib-re.cpython.3.14'],
  );
  const wildcard = rows.find(
    (row) => row.feature.semanticFeatureId === 'feature.wildcard',
  );
  assert.ok(wildcard);
  assert.equal(wildcard.cells[0].state, 'unknown-insufficient-evidence');
  assert.equal(wildcard.cells[0].origin, 'absent');
  assert.equal(wildcard.cells[0].evidenceAvailability, 'not-provided');
  assert.deepEqual(compatibilityCoverage(rows), {
    findingCount: 2,
    evidenceCount: 1,
    absentCount: 1,
  });
});
