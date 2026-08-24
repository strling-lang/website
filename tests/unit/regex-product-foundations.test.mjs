import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildCompatibilityRows,
  compatibilityEvidenceDetails,
} from '../../src/lib/regex-compatibility/index.ts';
import {
  consumeCheckpoints,
  createEmptyConsumptionState,
  validateCheckpointBundle,
} from '../../src/lib/regex-conformance/index.ts';
import {
  answerProfileQuestion,
  resolveProfiles,
} from '../../src/lib/regex-profiles/index.ts';
import {
  fixtureSemanticSnapshot,
  validCheckpointBundle,
} from '../fixtures/regex-conformance/checkpoints.mjs';

const validated = validateCheckpointBundle(
  validCheckpointBundle(),
  fixtureSemanticSnapshot,
);
let consumed = consumeCheckpoints(
  createEmptyConsumptionState(),
  validated,
  'lab',
);
consumed = consumeCheckpoints(consumed, validated, 'compatibility');

test('one validated checkpoint chain drives both products without profile code', () => {
  assert.deepEqual(
    consumed.lab.profiles.map((profile) => profile.profileReleaseId),
    [
      'test-only.python.stdlib-re.cpython.3.13',
      'test-only.python.stdlib-re.cpython.3.14',
      'test-only.server.node.regexp.24',
    ],
  );
  assert.deepEqual(
    consumed.compatibility.profiles.map((profile) => profile.profileReleaseId),
    [
      'test-only.cli.pcre2grep.10.46',
      'test-only.python.stdlib-re.cpython.3.13',
      'test-only.python.stdlib-re.cpython.3.14',
    ],
  );
});

test('Lab selector shape and runtime controls derive from checkpoint metadata', () => {
  let resolver = resolveProfiles(consumed.lab.profiles);
  assert.equal(resolver.nextQuestion.question, 'Where are you using RegEx?');
  assert.deepEqual(
    resolver.nextQuestion.options.map((option) => option.valueLabel),
    ['Programming language', 'Server / application'],
  );
  resolver = answerProfileQuestion(
    consumed.lab.profiles,
    resolver,
    'programming-language',
  );
  assert.equal(resolver.nextQuestion.question, 'Which release?');
  resolver = answerProfileQuestion(consumed.lab.profiles, resolver, '3.14');
  assert.equal(
    resolver.resolvedProfile.profileReleaseId,
    'test-only.python.stdlib-re.cpython.3.14',
  );
  assert.deepEqual(
    resolver.resolvedProfile.operations.map(
      (operation) => operation.operationId,
    ),
    ['search-all', 'search-first'],
  );
  assert.deepEqual(
    resolver.resolvedProfile.options.map((option) => option.optionId),
    ['ignore-case', 'line-mode'],
  );
});

test('Compatibility rows and evidence derive from projection plus canonical features', () => {
  const catalog = [
    {
      semanticFeatureId: 'feature.named-capture',
      name: 'Named capture',
      categoryId: 'groups-and-captures',
      categoryName: 'Groups and captures',
      route: '/regex/docs/groups-and-captures/named-capture/',
    },
    {
      semanticFeatureId: 'feature.wildcard',
      name: 'Wildcard',
      categoryId: 'grammar-and-composition',
      categoryName: 'Grammar and composition',
      route: '/regex/docs/grammar-and-composition/wildcard/',
    },
  ];
  const profile = consumed.compatibility.profiles.find(
    (candidate) =>
      candidate.profileReleaseId === 'test-only.python.stdlib-re.cpython.3.14',
  );
  assert.ok(profile);
  const rows = buildCompatibilityRows(
    catalog,
    consumed.compatibility.profiles,
    consumed.compatibility.findings,
    [profile.profileReleaseId],
  );
  assert.equal(rows[0].cells[0].state, 'supported');
  assert.equal(rows[1].cells[0].state, 'unknown-insufficient-evidence');
  assert.equal(rows[1].cells[0].origin, 'absent');
  const details = compatibilityEvidenceDetails(
    rows[0],
    rows[0].cells[0],
    profile,
  );
  assert.equal(details.checkpointId, 'test-only-checkpoint-0001');
  assert.equal(details.evidenceAvailability, 'available');
  assert.match(details.evidence.reference, /^test-fixture:/);
});

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.astro', '.js', '.mjs', '.ts'].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

test('test-only profiles and checkpoint fixtures cannot leak into production source', () => {
  for (const path of sourceFiles(
    fileURLToPath(new URL('../../src', import.meta.url)),
  )) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*tests[\\/]fixtures/);
    assert.doesNotMatch(source, /test-only\.[a-z0-9]/i);
  }
  const productionState = readFileSync(
    new URL('../../src/data/regexConformance.ts', import.meta.url),
    'utf8',
  );
  assert.match(productionState, /createEmptyConsumptionState\(\)/);
});
