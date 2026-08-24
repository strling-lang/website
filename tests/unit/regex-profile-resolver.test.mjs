import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeCheckpoints,
  createEmptyConsumptionState,
  validateCheckpointBundle,
} from '../../src/lib/regex-conformance/index.ts';
import {
  answerProfileQuestion,
  resolveProfiles,
  selectedProfileSummary,
} from '../../src/lib/regex-profiles/index.ts';
import {
  fixtureSemanticSnapshot,
  validCheckpointBundle,
} from '../fixtures/regex-conformance/checkpoints.mjs';

function consumedFixtureState() {
  const checkpoints = validateCheckpointBundle(
    validCheckpointBundle(),
    fixtureSemanticSnapshot,
  );
  let state = createEmptyConsumptionState();
  state = consumeCheckpoints(state, checkpoints, 'lab');
  return consumeCheckpoints(state, checkpoints, 'compatibility');
}

test('asks only values present among the remaining Lab profiles', () => {
  const profiles = consumedFixtureState().lab.profiles;
  const initial = resolveProfiles(profiles);
  assert.equal(initial.candidates.length, 3);
  assert.equal(initial.nextQuestion.dimensionId, 'context');
  assert.deepEqual(
    initial.nextQuestion.options.map((option) => option.valueId),
    ['programming-language', 'server-application'],
  );

  const programming = answerProfileQuestion(
    profiles,
    initial,
    'programming-language',
  );
  assert.equal(programming.candidates.length, 2);
  assert.equal(programming.nextQuestion.dimensionId, 'release');
  assert.deepEqual(
    programming.impliedAnswers.map((answer) => answer.dimensionId),
    ['language', 'api', 'runtime'],
  );
  assert.deepEqual(
    programming.nextQuestion.options.map((option) => option.valueLabel),
    ['3.13', '3.14'],
  );
});

test('terminates immediately when one candidate remains', () => {
  const profiles = consumedFixtureState().lab.profiles;
  const initial = resolveProfiles(profiles);
  const server = answerProfileQuestion(profiles, initial, 'server-application');
  assert.equal(server.nextQuestion, null);
  assert.equal(
    server.resolvedProfile.profileReleaseId,
    'test-only.server.node.regexp.24',
  );
  assert.match(
    selectedProfileSummary(server.resolvedProfile),
    /Node\.js · 24$/,
  );
});

test('selector dimensions appear and disappear with branch metadata', () => {
  const profiles = consumedFixtureState().compatibility.profiles;
  const commandLine = resolveProfiles(profiles, { context: 'command-line' });
  assert.equal(
    commandLine.resolvedProfile.profileReleaseId,
    'test-only.cli.pcre2grep.10.46',
  );
  assert.equal(
    commandLine.resolvedProfile.dimensions.some(
      (dimension) => dimension.dimensionId === 'language',
    ),
    false,
  );

  const programming = resolveProfiles(profiles, {
    context: 'programming-language',
  });
  assert.equal(programming.nextQuestion.dimensionId, 'release');
  assert.equal(
    programming.nextQuestion.options.some(
      (option) => option.valueId === '10.46',
    ),
    false,
  );
});

test('rejects an answer absent from the remaining candidates', () => {
  const profiles = consumedFixtureState().lab.profiles;
  const state = resolveProfiles(profiles, {
    context: 'programming-language',
    release: '10.46',
  });
  assert.deepEqual(state.invalidSelection, {
    dimensionId: 'release',
    valueId: '10.46',
  });
  assert.equal(state.candidates.length, 0);
});

test('reports ambiguous profiles rather than inventing another question', () => {
  const original = consumedFixtureState().lab.profiles[0];
  const duplicateDimensions = {
    ...structuredClone(original),
    profileReleaseId: 'test-only.ambiguous-profile',
    technicalLabel: 'test-only/ambiguous',
  };
  const state = resolveProfiles([original, duplicateDimensions]);
  assert.equal(state.nextQuestion, null);
  assert.equal(state.resolvedProfile, null);
  assert.equal(state.ambiguousProfiles.length, 2);
});

test('rejects conflicting dimension prompt metadata', () => {
  const profiles = structuredClone(
    consumedFixtureState().lab.profiles.slice(0, 2),
  );
  profiles[1].dimensions[0].question = 'Conflicting fixture question?';
  assert.throws(
    () => resolveProfiles(profiles),
    /conflicting question metadata/,
  );
});

test('eligible profiles and capabilities appear without component-specific code', () => {
  const state = consumedFixtureState();
  assert.deepEqual(
    state.lab.profiles.map((profile) => profile.profileReleaseId),
    [
      'test-only.cli.pcre2grep.10.46',
      'test-only.python.stdlib-re.cpython.3.13',
      'test-only.python.stdlib-re.cpython.3.14',
      'test-only.server.node.regexp.24',
    ].filter((profileId) => profileId !== 'test-only.cli.pcre2grep.10.46'),
  );
  for (const profile of state.lab.profiles) {
    assert.ok(profile.operations.length > 0);
    assert.ok(profile.options.length > 0);
  }
});
