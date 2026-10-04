import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  canonicalFromSnapshot,
  discoverCanonicalSnapshot,
} from '../../scripts/check-regex-docs-coverage.mjs';
import { generateProjection } from '../../scripts/generate-regex-docs-projection.mjs';
import { readCanonicalSnapshot } from '../../scripts/regex-docs-snapshot.mjs';

const digest = 'a'.repeat(64);
const fields = [
  'definition',
  'capture_result',
  'replacement',
  'unicode_encoding',
  'diagnostic_error',
  'resource_termination',
];
const feature = {
  feature_id: 'feature.fixture',
  canonical_name: 'Fixture',
  category: 'character-classes',
  aliases: [],
  historical_names: [],
  manifestation_ids: [],
  modifier_ids: [],
  prerequisite_feature_ids: [],
  supported_operation_ids: [],
  feature_class: 'atom',
  abstract_grammar_form: '<fixture>',
  semantic_assertions: Object.fromEntries(
    fields.map((field) => [
      field,
      {
        statement: `Source-bound ${field}.`,
        scope: 'profile-dependent',
        state: 'known',
        source_ids: ['fixture-source'],
      },
    ]),
  ),
  semantic_variants: [
    {
      variant_id: 'variant.fixture',
      name: 'Fixture variant',
      semantic_assertion: {
        statement: 'Source-bound variant distinction.',
        source_ids: ['fixture-source'],
      },
    },
  ],
  semantic_revision: 4,
  typed_relations: [
    { relation_type: 'prerequisite', target_id: 'feature.other' },
  ],
  test_concepts: {
    positive: 'Positive fixture.',
    negative: 'Negative fixture.',
    boundary: 'Boundary fixture.',
    source_ids: ['fixture-source'],
  },
  unresolved_semantic_questions: [],
};
const snapshot = {
  schema_version: 'regex-semantic-corpus.v4',
  snapshot_id: 'fixture-v4',
  snapshot_digest_sha256: digest,
  authority: { cutoff: '2026-09-08T00:14:25Z' },
  status: 'frozen-declared-cutoff-semantic-universe',
  counts: { canonical_features: 2 },
  features: [
    feature,
    {
      ...feature,
      feature_id: 'feature.other',
      typed_relations: [],
      test_concepts: [
        'Distinguish the construct.',
        'Probe acceptance and rejection boundaries.',
      ],
    },
  ],
  manifestations: [],
  modifiers: [],
  operations: [],
  sources: [
    {
      source_id: 'fixture-source',
      title: 'Fixture source',
      authority: 'Fixture publisher',
      source_class: 'official-implementation-documentation',
      normative: false,
      url: 'https://example.org/fixture',
      version_or_revision: 'fixture',
      retrieved_on: '2026-09-08',
      scope: 'Fixture tests only',
    },
  ],
  carried_forward_by_reference: {
    typed_interactions:
      'semantic-corpus/snapshots/regex-semantic-features-2026-08-22.v1.json#/interactions',
  },
};

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'website-regex-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'semantic-corpus', 'snapshots');
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'regex-semantic-features-2026-09-08.v4.json');
  await writeFile(path, JSON.stringify(snapshot));
  await writeFile(
    join(directory, 'regex-semantic-features-2026-08-22.v1.json'),
    JSON.stringify({
      interactions: [
        {
          interaction_id: 'interaction.fixture',
          source_id: 'feature.other',
          target_id: 'feature.fixture',
          interaction_type: 'interacts-with',
        },
      ],
    }),
  );
  return { root, directory, path };
}

test('coverage reads legacy and current semantic digests and rejects missing digests', () => {
  assert.equal(canonicalFromSnapshot(snapshot).digest, digest);
  assert.equal(
    canonicalFromSnapshot({ ...snapshot, corpus_digest_sha256: digest }).digest,
    digest,
  );
  assert.throws(
    () =>
      canonicalFromSnapshot({ ...snapshot, snapshot_digest_sha256: undefined }),
    /valid SHA-256/,
  );
});

test('v4 projection retains source statements, scopes, variants and carried-forward relations', async (t) => {
  const { root, path } = await fixture(t);
  const { lock, projection } = await generateProjection({
    canonicalPath: path,
    outputDirectory: join(root, 'projection'),
    revision: 'fixture-revision',
  });
  const projected = projection.features.find(
    (item) => item.semanticFeatureId === 'feature.fixture',
  );
  assert.equal(lock.source.semanticDigest, digest);
  assert.equal(lock.source.cutoffDate, snapshot.authority.cutoff);
  assert.equal(
    projected.semanticDefinition,
    feature.semantic_assertions.definition.statement,
  );
  assert.equal(
    projected.captureResultSemantics,
    feature.semantic_assertions.capture_result.statement,
  );
  assert.equal(projected.provenance.claim_scope, 'profile-dependent');
  assert.deepEqual(projected.semanticAssertions, feature.semantic_assertions);
  assert.equal(
    projected.semanticVariants[0].distinguishing_rule,
    'Source-bound variant distinction.',
  );
  assert.equal(projected.testConcepts.edge, 'Boundary fixture.');
  assert.equal(projected.revision, 4);
  assert.equal(projected.authoritativeSources[0].sourceId, 'fixture-source');
  assert.equal(projected.featureRelations.length, 2);
  assert.ok(
    projected.featureRelations.some(
      (relation) => relation.direction === 'incoming',
    ),
  );
  assert.ok(
    projected.featureRelations.some(
      (relation) => relation.relationType === 'prerequisite',
    ),
  );
  assert.deepEqual(
    projection.features.find(
      (item) => item.semanticFeatureId === 'feature.other',
    ).testConcepts,
    snapshot.features[1].test_concepts,
  );
});

test('v4 projection rejects an assertion without source provenance', async (t) => {
  const { path } = await fixture(t);
  const malformed = structuredClone(snapshot);
  malformed.features[0].semantic_assertions.definition.source_ids = [];
  await writeFile(path, JSON.stringify(malformed));
  await assert.rejects(
    readCanonicalSnapshot(path),
    /requires source-bound definition/,
  );
});

test('canonical discovery follows promoted authority rather than a newer filename', async (t) => {
  const { root, directory, path } = await fixture(t);
  await writeFile(
    join(directory, 'regex-semantic-features-2099-01-01.v99.json'),
    '{}',
  );
  const authorityDirectory = join(root, 'semantic-corpus', 'authority');
  await mkdir(authorityDirectory);
  const authorityPath = join(authorityDirectory, 'current.v1.json');
  const authority = {
    schema_version: 'regex-semantic-authority-index.v1',
    current_snapshot: {
      path: 'semantic-corpus/snapshots/regex-semantic-features-2026-09-08.v4.json',
      digest_sha256: digest,
      id: snapshot.snapshot_id,
    },
  };
  await writeFile(authorityPath, JSON.stringify(authority));
  assert.equal((await discoverCanonicalSnapshot(root)).path, path);
  authority.current_snapshot.digest_sha256 = 'b'.repeat(64);
  await writeFile(authorityPath, JSON.stringify(authority));
  await assert.rejects(discoverCanonicalSnapshot(root), /does not match/);
  authority.current_snapshot.path = '../outside.json';
  await writeFile(authorityPath, JSON.stringify(authority));
  await assert.rejects(
    discoverCanonicalSnapshot(root),
    /Invalid promoted snapshot path/,
  );
});

test('canonical discovery still supports a legacy repository without an authority index', async (t) => {
  const { root, path } = await fixture(t);
  assert.equal((await discoverCanonicalSnapshot(root)).path, path);
});

test('reader rejects unknown schema and unsafe carried-forward paths', async (t) => {
  const { path } = await fixture(t);
  const unknown = { ...snapshot, schema_version: 'unknown' };
  await writeFile(path, JSON.stringify(unknown));
  await assert.rejects(
    readCanonicalSnapshot(path),
    /Unsupported canonical snapshot schema/,
  );
  const unsafe = structuredClone(snapshot);
  unsafe.carried_forward_by_reference.typed_interactions =
    '../outside.json#/interactions';
  await writeFile(path, JSON.stringify(unsafe));
  await assert.rejects(
    readCanonicalSnapshot(path),
    /Invalid canonical snapshot reference/,
  );
});

test('checked-in projection covers the reviewed promoted universe', async () => {
  const lock = JSON.parse(
    await readFile(
      new URL('../../src/data/regex-docs/source-lock.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(lock.canonicalFeatureCount, 269);
  assert.equal(lock.canonicalCategoryCount, 16);
  assert.equal(lock.source.schemaVersion, 'regex-semantic-corpus.v4');
  assert.equal(
    lock.source.semanticDigest,
    'e2c99c582ad9c8f2875060f9cb9d3ec0da8057f554ac09477f8e07b96da30b05',
  );
});
