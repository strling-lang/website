import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  initialSession,
  readSession,
} from '../../src/lib/regex-lab/session.ts';
import {
  displayTiming,
  displayTimingDifference,
  estimateTimerResolution,
  runTimingExperiment,
  seriesStats,
  timingRepetitions,
  timingSchema,
} from '../../src/lib/regex-lab/timing.ts';

const durations = {
  baseline: [1000, 90, 10, 60, 30, 70, 50, 20, 80, 40],
  current: [5000, 22, 2, 12, 18, 6, 14, 4, 16, 8],
};

async function experiment({
  paired = false,
  abortAt,
  timeoutAt,
  failPreparation,
} = {}) {
  const controller = new AbortController();
  const order = paired ? ['baseline', 'current'] : ['current'];
  const result = {
    schema: timingSchema,
    dataset: 'Example',
    multiplier: 1,
    repetitions: timingRepetitions,
    status: 'running',
    order,
    rounds: paired ? [] : undefined,
    series: order.map((candidate) => ({
      candidate,
      source: candidate,
      inputUnits: 7,
      samples: [],
      stats: seriesStats([]),
    })),
  };
  let time = 0;
  let running = false;
  const calls = [];
  await runTimingExperiment(
    result,
    async (entry, signal) => {
      assert.equal(signal, controller.signal);
      calls.push('prepare:' + entry.candidate);
      if (entry.candidate === failPreparation)
        throw new Error('Compiler refused the candidate');
      const runtime = entry.candidate === 'baseline' ? 'pcre2' : 'python';
      entry.runtime = runtime;
      entry.compiler = {
        identity: { productVersion: '4.0.3' },
        profile: { profile_id: runtime },
        durationMs: 73,
      };
      entry.artifact = { target_profile: { profile_id: runtime } };
      time += 73;
      let ordinal = 0;
      return async (signal) => {
        assert.equal(signal, controller.signal);
        assert.equal(running, false, 'execution overlapped another candidate');
        running = true;
        const id = entry.candidate + ':' + ordinal;
        calls.push(id);
        await setImmediate();
        const elapsed = durations[entry.candidate][ordinal++];
        time += elapsed;
        running = false;
        if (abortAt === id) controller.abort();
        return {
          requestId: id,
          status: id === timeoutAt ? 'resource-terminated' : 'matched',
          operationId: 'scan',
          profileReleaseId: 'interactive:' + runtime + '@1',
          provider: { kind: 'browser-local', providerId: 'test' },
          observation: {
            runtime,
            runtimeVersion: runtime === 'python' ? '3.14' : '10.49',
          },
          timing: { durationMs: elapsed, executionMs: elapsed / 2 },
          error:
            id === timeoutAt
              ? { message: 'Worker timed out', termination: 'timeout' }
              : undefined,
        };
      };
    },
    controller.signal,
    () => {},
    () => time,
  );
  return { result, calls };
}

test('runs one warmup and nine sequential single-candidate samples with a sorted median', async () => {
  const { result, calls } = await experiment();
  assert.equal(result.status, 'complete');
  assert.deepEqual(calls, [
    'prepare:current',
    ...Array.from({ length: 10 }, (_, index) => 'current:' + index),
  ]);
  assert.equal(result.rounds, undefined);
  const [entry] = result.series;
  assert.equal(entry.warmup.wallMs, 5000);
  assert.deepEqual(
    entry.samples.map((sample) => sample.wallMs),
    durations.current.slice(1),
  );
  assert.deepEqual(entry.stats.wall, { min: 2, median: 12, max: 22 });
  assert.equal(entry.samples[4].wallMs, 6);
});

test('prepares and warms both candidates before nine strict, sequential pairs and exports stable provenance', async () => {
  const { result, calls } = await experiment({ paired: true });
  const saved = JSON.parse(JSON.stringify(result));
  assert.equal(saved.status, 'complete');
  assert.equal(saved.repetitions, 9);
  assert.deepEqual(calls, [
    'prepare:baseline',
    'prepare:current',
    ...Array.from({ length: 10 }, (_, index) => [
      'baseline:' + index,
      'current:' + index,
    ]).flat(),
  ]);
  assert.deepEqual(
    saved.series.map(({ stats }) => stats.wall),
    [
      { min: 10, median: 50, max: 90 },
      { min: 2, median: 12, max: 22 },
    ],
  );
  assert.deepEqual(saved.comparison.wall, {
    differenceMs: -38,
    absoluteDifferenceMs: 38,
    relativeDifferencePercent: -76,
  });
  for (const [index, round] of saved.rounds.entries()) {
    assert.deepEqual(round, {
      round: index + 1,
      order: ['baseline', 'current'],
      baseline: index,
      current: index,
      status: 'complete',
    });
    assert.equal(
      saved.series[0].samples[round.baseline].requestId,
      `baseline:${round.round}`,
    );
    assert.equal(
      saved.series[1].samples[round.current].requestId,
      `current:${round.round}`,
    );
  }
  assert.equal(saved.series[0].samples[0].observation.runtimeVersion, '10.49');
  assert.equal(saved.series[1].samples[0].observation.runtimeVersion, '3.14');
  assert.equal(saved.series[0].compiler.identity.productVersion, '4.0.3');
  assert.equal(saved.series[1].artifact.target_profile.profile_id, 'python');
});

test('preserves a pending round and a returned timeout without inventing measurements, then recovers', async () => {
  const cancelled = await experiment({ paired: true, abortAt: 'current:2' });
  assert.equal(cancelled.result.status, 'incomplete');
  assert.match(cancelled.result.issue, /Cancelled/);
  assert.deepEqual(
    cancelled.result.series.map(({ samples }) => samples.length),
    [2, 1],
  );
  assert.deepEqual(cancelled.result.rounds[1], {
    round: 2,
    order: ['baseline', 'current'],
    status: 'incomplete',
    baseline: 1,
  });
  const timedOut = await experiment({ paired: true, timeoutAt: 'current:2' });
  assert.equal(timedOut.result.status, 'incomplete');
  assert.equal(timedOut.calls.at(-1), 'current:2');
  assert.equal(timedOut.result.rounds[1].status, 'failed');
  assert.equal(
    timedOut.result.series[1].samples[1].error.termination,
    'timeout',
  );
  assert.deepEqual(timedOut.result.series[1].stats.wall, {
    min: 22,
    median: 22,
    max: 22,
  });
  assert.equal((await experiment()).result.status, 'complete');
});

test('does not warm or measure either candidate when preparation fails', async () => {
  const { result, calls } = await experiment({
    paired: true,
    failPreparation: 'current',
  });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(calls, ['prepare:baseline', 'prepare:current']);
  assert.equal(result.rounds.length, 0);
  assert.match(result.series[1].issue, /Compiler refused/);
});

test('reports medians and differences at supported precision and retains prior recording schemas', () => {
  const tiny = { min: 2.01, median: 2.043, max: 2.09 };
  const wide = { min: 20.01, median: 52.432, max: 80.95 };
  assert.match(displayTiming(tiny, 1, 9), /^2 ms median/);
  assert.match(displayTiming(wide, 0.01, 9), /^50 ms median/);
  assert.doesNotMatch(displayTiming(tiny, 0.1, 1), /observed/);
  assert.equal(
    displayTimingDifference(
      { min: 100, median: 100, max: 100 },
      { min: 80, median: 80, max: 80 },
      1,
      9,
    ),
    '20 ms lower (20%)',
  );
  assert.equal(
    displayTimingDifference(tiny, tiny, 1, 9),
    '<1 ms at display precision',
  );
  assert.equal(
    estimateTimerResolution(() => 10),
    undefined,
  );
  let ticks = 0;
  assert.equal(
    estimateTimerResolution(() => Math.floor(ticks++ / 2) * 0.25),
    0.25,
  );
  for (const schema of ['strling-lab-timing-v1', timingSchema]) {
    const record = {
      capturedAt: '2026-10-01T00:00:00Z',
      investigation: { timing: { schema } },
    };
    const imported = readSession({
      ...initialSession('regex'),
      recorded: record,
    });
    assert.deepEqual(
      imported.recorded.investigation.timing,
      record.investigation.timing,
    );
  }
});
