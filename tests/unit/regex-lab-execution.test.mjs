import assert from 'node:assert/strict';
import test from 'node:test';

import { ReactiveLabExecutor } from '../../src/lib/regex-lab/index.ts';
import {
  DeterministicFixtureLabProvider,
  fixtureRequest,
} from '../fixtures/regex-lab/provider.mjs';

const settledResult = async (request) => {
  const provider = new DeterministicFixtureLabProvider();
  return provider.execute(request, { signal: new AbortController().signal });
};

test('fixture provider models multiple matches and capture participation', async () => {
  const result = await settledResult(fixtureRequest());
  assert.equal(result.status, 'matched');
  assert.equal(result.matches.length, 2);
  assert.deepEqual(
    result.matches[0].captures.map((capture) => [
      capture.name,
      capture.participation,
      capture.value,
    ]),
    [
      ['word', 'participated', 'alpha'],
      [undefined, 'nonparticipating', undefined],
      [undefined, 'unmatched', undefined],
    ],
  );
  assert.equal(result.matches[1].captures[1].participation, 'unavailable');
});

for (const [pattern, status] of [
  ['[', 'compile-rejection'],
  ['NO_MATCH', 'no-match'],
  ['RUNTIME_ERROR', 'runtime-error'],
  ['TIMEOUT', 'resource-terminated'],
  ['ZERO', 'matched'],
]) {
  test(`fixture provider returns ${status}`, async () => {
    const result = await settledResult(fixtureRequest({ pattern }));
    assert.equal(result.status, status);
    if (pattern === 'ZERO') {
      assert.deepEqual(result.matches[0].span, {
        start: 1,
        end: 1,
        unit: 'test fixture units',
      });
    }
  });
}

test('coordinator reacts to pattern and input changes after debounce', async () => {
  const states = [];
  const coordinator = new ReactiveLabExecutor(
    new DeterministicFixtureLabProvider(),
    {
      debounceMs: 1,
      onStateChange: (state) => states.push(state),
    },
  );
  coordinator.update(
    fixtureRequest({ requestId: 'pattern', pattern: 'NO_MATCH' }),
  );
  await coordinator.flush();
  coordinator.update(
    fixtureRequest({ requestId: 'text', pattern: 'MULTI', input: 'changed' }),
  );
  await coordinator.flush();
  assert.deepEqual(
    states
      .filter((state) => state.phase === 'settled')
      .map((state) => [state.request.requestId, state.result.status]),
    [
      ['pattern', 'no-match'],
      ['text', 'matched'],
    ],
  );
});

test('coordinator protects the UI from stale responses', async () => {
  const settled = [];
  const coordinator = new ReactiveLabExecutor(
    new DeterministicFixtureLabProvider(),
    {
      debounceMs: 0,
      onStateChange: (state) => {
        if (state.phase === 'settled') settled.push(state.result.requestId);
      },
    },
  );
  coordinator.update(fixtureRequest({ requestId: 'slow', pattern: 'SLOW' }));
  const slow = coordinator.flush();
  coordinator.update(fixtureRequest({ requestId: 'fast', pattern: 'MULTI' }));
  await coordinator.flush();
  await slow;
  assert.deepEqual(settled, ['fast']);
});

test('editing clears the old result before a compile rejection settles', async () => {
  const states = [];
  const coordinator = new ReactiveLabExecutor(
    new DeterministicFixtureLabProvider(),
    {
      debounceMs: 0,
      onStateChange: (state) => states.push(state),
    },
  );
  coordinator.update(fixtureRequest({ requestId: 'valid' }));
  await coordinator.flush();
  coordinator.update(fixtureRequest({ requestId: 'invalid', pattern: '[' }));
  const pending = states.at(-1);
  assert.equal(pending.phase, 'debouncing');
  assert.equal(pending.result, null);
  await coordinator.flush();
  assert.equal(states.at(-1).result.status, 'compile-rejection');
});

test('provider failures normalize to infrastructure failures', async () => {
  const results = [];
  const coordinator = new ReactiveLabExecutor(
    new DeterministicFixtureLabProvider(),
    {
      debounceMs: 0,
      onStateChange: (state) => {
        if (state.result) results.push(state.result);
      },
    },
  );
  coordinator.update(
    fixtureRequest({
      requestId: 'infrastructure',
      pattern: 'INFRASTRUCTURE_FAILURE',
    }),
  );
  await coordinator.flush();
  assert.equal(results[0].status, 'infrastructure-failure');
  assert.match(results[0].error.message, /transport failed/);
});

test('operation and profile changes are part of request identity', async () => {
  const results = [];
  const coordinator = new ReactiveLabExecutor(
    new DeterministicFixtureLabProvider(),
    {
      debounceMs: 0,
      onStateChange: (state) => {
        if (state.result) results.push(state.result);
      },
    },
  );
  coordinator.update(
    fixtureRequest({
      requestId: 'unsupported',
      operationId: 'test-only-unsupported',
    }),
  );
  await coordinator.flush();
  assert.equal(results[0].status, 'unsupported-operation');

  coordinator.update(
    fixtureRequest({
      requestId: 'profile',
      runtime: {
        profileId: 'not-a-fixture',
        releaseId: 'none',
        profileReleaseId: 'not-a-fixture.release',
        technicalLabel: 'not-a-fixture',
      },
    }),
  );
  await coordinator.flush();
  assert.equal(results[1].status, 'infrastructure-failure');
});
