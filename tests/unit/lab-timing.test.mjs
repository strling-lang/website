import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  initialSession,
  readSession,
} from '../../src/lib/regex-lab/session.ts';
import { estimateTimerResolution } from '../../src/lib/regex-lab/timer-resolution.ts';
import {
  displayTiming,
  formatDuration,
  runTimingExperiment,
  seriesStats,
  timingRepetitions,
  timingSchema,
} from '../../src/lib/regex-lab/timing.ts';

const durations = [5000, 22, 2, 12, 18, 6, 14, 4, 16, 8];

async function experiment({
  abortAt,
  timeoutAt,
  failPreparation,
  progress,
} = {}) {
  const controller = new AbortController();
  const result = {
    schema: timingSchema,
    dataset: 'Example',
    source: 'current',
    inputUnits: 7,
    repetitions: timingRepetitions,
    wallResolutionMs: 0.1,
    status: 'running',
    samples: [],
    stats: seriesStats([]),
  };
  let time = 0;
  let running = false;
  const calls = [];
  await runTimingExperiment(
    result,
    async (signal) => {
      assert.equal(signal, controller.signal);
      calls.push('prepare');
      if (failPreparation) throw new Error('Compiler refused the pattern');
      result.runtime = 'python';
      result.compiler = {
        identity: { productVersion: '4.0.3' },
        profile: { profile_id: 'python' },
        durationMs: 73,
        timerResolutionMs: 0.25,
      };
      result.artifact = { target_profile: { profile_id: 'python' } };
      time += 73;
      let ordinal = 0;
      return async (signal, probeTimer) => {
        assert.equal(signal, controller.signal);
        assert.equal(running, false, 'execution overlapped another run');
        running = true;
        const id = ordinal++;
        calls.push(id);
        assert.equal(
          probeTimer,
          id === 0,
          'clock probing is limited to the warmup',
        );
        await setImmediate();
        const elapsed = durations[id];
        time += elapsed;
        running = false;
        if (abortAt === id) controller.abort();
        return {
          requestId: String(id),
          status: id === timeoutAt ? 'resource-terminated' : 'matched',
          operationId: 'scan',
          profileReleaseId: 'interactive:python@1',
          provider: { kind: 'browser-local', providerId: 'test' },
          observation: { runtime: 'python', runtimeVersion: '3.14' },
          timing: {
            durationMs: elapsed,
            executionMs: elapsed / 2,
            ...(probeTimer && { resolutionMs: 0.05 }),
          },
          error:
            id === timeoutAt
              ? { message: 'Worker timed out', termination: 'timeout' }
              : undefined,
        };
      };
    },
    controller.signal,
    () => progress?.(result),
    () => time,
  );
  return { result, calls };
}

test('warms once, runs nine sequential measurements and retains independent raw timings', async () => {
  const updates = [];
  const { result, calls } = await experiment({
    progress: (run) => updates.push(run.samples.length),
  });
  const saved = JSON.parse(JSON.stringify(result));
  assert.equal(saved.status, 'complete');
  assert.deepEqual(calls, [
    'prepare',
    ...Array.from({ length: 10 }, (_, index) => index),
  ]);
  assert.deepEqual(
    updates,
    Array.from({ length: 9 }, (_, index) => index + 1),
  );
  assert.equal(saved.warmup.wallMs, 5000);
  assert.deepEqual(
    saved.samples.map((sample) => sample.wallMs),
    durations.slice(1),
  );
  assert.deepEqual(saved.stats.wall, { min: 2, median: 12, max: 22 });
  assert.deepEqual(saved.stats.execute, { min: 1, median: 6, max: 11 });
  assert.equal(saved.samples[4].wallMs, 6);
  assert.equal(saved.samples[0].observation.runtimeVersion, '3.14');
  assert.equal(saved.warmup.timing.resolutionMs, 0.05);
  assert.equal(saved.wallResolutionMs, 0.1);
  assert.equal(saved.compiler.timerResolutionMs, 0.25);
  assert.equal(saved.compiler.identity.productVersion, '4.0.3');
  assert.equal(saved.artifact.target_profile.profile_id, 'python');
});

test('retains completed samples after cancellation or timeout and excludes failed timings from statistics', async () => {
  const cancelled = await experiment({ abortAt: 3 });
  assert.equal(cancelled.result.status, 'incomplete');
  assert.match(cancelled.result.issue, /Cancelled/);
  assert.deepEqual(
    cancelled.result.samples.map(({ wallMs }) => wallMs),
    [22, 2],
  );

  const timedOut = await experiment({ timeoutAt: 2 });
  assert.equal(timedOut.result.status, 'incomplete');
  assert.equal(timedOut.calls.at(-1), 2);
  assert.equal(timedOut.result.samples[1].error.termination, 'timeout');
  assert.deepEqual(timedOut.result.stats.wall, {
    min: 22,
    median: 22,
    max: 22,
  });
  assert.equal((await experiment()).result.status, 'complete');
});

test('keeps preparation failure details without inventing any measurements', async () => {
  const { result, calls } = await experiment({ failPreparation: true });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(calls, ['prepare']);
  assert.equal(result.warmup, undefined);
  assert.equal(result.samples.length, 0);
  assert.match(result.issue, /Compiler refused/);
});

test('adapts duration units and precision to the observed clock without reporting a false zero', () => {
  assert.equal(formatDuration(0, 0.1), '<100 µs');
  assert.equal(formatDuration(0.0132, 0.1), '<100 µs');
  assert.equal(formatDuration(0.10000000000002, 0.1), '100 µs');
  assert.equal(formatDuration(0.25, 0.25), '250 µs');
  assert.equal(formatDuration(0.054, 0.002), '54 µs');
  assert.equal(formatDuration(0.0012, 0.00005), '1 µs');
  assert.equal(formatDuration(0.253, 0.0001), '253 µs');
  assert.equal(formatDuration(4.247, 0.01), '4.25 ms');
  assert.equal(formatDuration(1.249, 0.25), '1.25 ms');
  assert.equal(formatDuration(4.247, 1), '4 ms');
  assert.equal(formatDuration(1503.1, 0.1), '1.5 s');
  assert.equal(formatDuration(2100, 1500), '1.5 s');
  assert.equal(
    formatDuration(0, undefined),
    'Below timer resolution (step unobserved)',
  );
  assert.equal(
    formatDuration(0.06, undefined),
    'Sub-millisecond (timer step unobserved)',
  );
  assert.equal(
    displayTiming({ min: 0, median: 0.075, max: 1.75 }, 0.025, 9),
    '75 µs median · <25 µs – 1.75 ms observed',
  );
  assert.equal(
    displayTiming({ min: 0, median: 0, max: 0.02 }, 0.05, 9),
    '<50 µs median · <50 µs observed',
  );
  assert.equal(
    displayTiming({ min: 0.04, median: 0.04, max: 0.04 }, 0.01, 1),
    '40 µs',
  );
});

test('estimates a typical clock tick and reports missing evidence for a frozen clock', () => {
  assert.equal(
    estimateTimerResolution(() => 10),
    undefined,
  );
  let index = 0;
  assert.equal(
    estimateTimerResolution(() => Math.floor(index++ / 2) * 0.25),
    0.25,
  );
  const values = [0, 0.01, 1.01, 2.01, 3.01, 4.01, 5.01, 30.01];
  assert.ok(Math.abs(estimateTimerResolution(() => values.shift()) - 1) < 1e-9);
});

test('restores old timing settings and paired observations as inert session history', () => {
  for (const schema of [
    'strling-lab-timing-v1',
    'strling-lab-timing-v2',
    timingSchema,
  ]) {
    const record = {
      capturedAt: '2026-10-01T00:00:00Z',
      investigation: {
        timing: {
          schema,
          multiplier: 0.5,
          rounds: [{ order: ['baseline', 'current'] }],
        },
      },
    };
    const restored = readSession({
      ...initialSession('regex'),
      recorded: record,
    });
    assert.deepEqual(
      restored.recorded.investigation.timing,
      record.investigation.timing,
    );
  }
});
