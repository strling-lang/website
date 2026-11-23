import type { JsonObject } from '@strling-lang/strling';
import type { LabExecutionResult, LabRuntimeIdentity } from './contracts.ts';
import type { Compilation } from './compiler.ts';
import { summarizeTimings } from './experiments.ts';
import type { Runtime, RunOptions } from './interactive.ts';

export const timingRepetitions = 9;
export const timingSchema = 'strling-lab-timing-v2';

type Candidate = 'baseline' | 'current';

interface Sample extends Pick<
  LabExecutionResult,
  | 'requestId'
  | 'profileReleaseId'
  | 'operationId'
  | 'provider'
  | 'status'
  | 'timing'
  | 'observation'
> {
  wallMs: number;
  error?: Extract<LabExecutionResult, { error: unknown }>['error'];
}

export interface TimingSeries {
  candidate: Candidate;
  source: string;
  inputUnits: number;
  executionPattern?: string;
  compiler?: Pick<
    Compilation,
    'identity' | 'profile' | 'durationMs' | 'cached'
  >;
  artifact?: JsonObject;
  runtime?: Runtime;
  runtimeIdentity?: LabRuntimeIdentity;
  options?: RunOptions;
  warmup?: Sample;
  samples: Sample[];
  stats: ReturnType<typeof seriesStats>;
  issue?: string;
}

interface TimingRound {
  round: number;
  order: Candidate[];
  // Each index identifies the returned sample in that candidate's series.
  baseline?: number;
  current?: number;
  status: 'incomplete' | 'complete' | 'failed';
}

export interface TimingExperiment {
  schema: typeof timingSchema;
  dataset: string;
  multiplier: number;
  repetitions: number;
  timerResolutionMs?: number;
  status: 'running' | 'complete' | 'incomplete';
  issue?: string;
  order: Candidate[];
  series: TimingSeries[];
  rounds?: TimingRound[];
  comparison?: ReturnType<typeof compareTimingSeries>;
}

type Execute = (signal: AbortSignal) => Promise<LabExecutionResult>;

export async function runTimingExperiment(
  experiment: TimingExperiment,
  prepare: (entry: TimingSeries, signal: AbortSignal) => Promise<Execute>,
  signal: AbortSignal,
  progress: () => void,
  clock: () => number = () => performance.now(),
) {
  const prepared: { entry: TimingSeries; execute: Execute }[] = [];
  const measuredRun = async (execute: Execute): Promise<Sample> => {
    signal.throwIfAborted();
    const start = clock();
    const result = await execute(signal);
    signal.throwIfAborted();
    const {
      requestId,
      profileReleaseId,
      operationId,
      provider,
      status,
      timing,
      observation,
    } = result;
    return {
      requestId,
      profileReleaseId,
      operationId,
      provider,
      status,
      timing,
      observation,
      wallMs: clock() - start,
      error: 'error' in result ? result.error : undefined,
    };
  };
  let active: TimingSeries | undefined;
  let pair: TimingRound | undefined;
  try {
    for (const entry of experiment.series) {
      active = entry;
      signal.throwIfAborted();
      prepared.push({ entry, execute: await prepare(entry, signal) });
    }
    for (const { entry, execute } of prepared) {
      active = entry;
      entry.warmup = await measuredRun(execute);
      if (entry.warmup.error) {
        entry.issue = entry.warmup.error.message;
        return;
      }
    }
    for (let round = 1; round <= timingRepetitions; round++) {
      if (experiment.rounds) {
        pair = { round, order: [], status: 'incomplete' };
        experiment.rounds.push(pair);
      }
      for (const { entry, execute } of prepared) {
        signal.throwIfAborted();
        active = entry;
        pair?.order.push(entry.candidate);
        const sample = await measuredRun(execute);
        const index = entry.samples.push(sample) - 1;
        if (pair) pair[entry.candidate] = index;
        entry.stats = seriesStats(entry.samples);
        if (sample.error) {
          entry.issue = sample.error.message;
          if (pair) pair.status = 'failed';
          return;
        }
      }
      if (pair) pair.status = 'complete';
      progress();
    }
    signal.throwIfAborted();
    experiment.status = 'complete';
  } catch (error) {
    if (signal.aborted) interruptTiming(experiment);
    else {
      if (active)
        active.issue =
          error instanceof Error
            ? error.message
            : 'The timing run could not complete.';
      if (pair) pair.status = 'failed';
    }
  } finally {
    if (experiment.status === 'running') experiment.status = 'incomplete';
    const [baseline, current] = experiment.series;
    if (baseline && current)
      experiment.comparison = compareTimingSeries(baseline, current);
  }
}

export function interruptTiming(experiment: TimingExperiment) {
  if (experiment.status !== 'running') return;
  experiment.status = 'incomplete';
  experiment.issue = 'Cancelled or reached the time limit.';
}

function timingDifference(baseline?: TimingStats, current?: TimingStats) {
  if (!baseline || !current) return;
  const differenceMs = current.median - baseline.median;
  return {
    differenceMs,
    absoluteDifferenceMs: Math.abs(differenceMs),
    relativeDifferencePercent:
      baseline.median > 0 ? (differenceMs / baseline.median) * 100 : undefined,
  };
}

function compareTimingSeries(baseline: TimingSeries, current: TimingSeries) {
  return {
    wall: timingDifference(baseline.stats.wall, current.stats.wall),
    compile: timingDifference(baseline.stats.compile, current.stats.compile),
    execute: timingDifference(baseline.stats.execute, current.stats.execute),
  };
}

export function seriesStats(samples: Sample[]) {
  const completed = samples.filter((sample) => !sample.error);
  return {
    wall: summarizeTimings(completed.map((sample) => sample.wallMs)),
    compile: summarizeTimings(
      completed.flatMap((sample) => sample.timing.compileMs ?? []),
    ),
    execute: summarizeTimings(
      completed.flatMap((sample) => sample.timing.executionMs ?? []),
    ),
  };
}

export function estimateTimerResolution(
  clock: () => number = () => performance.now(),
) {
  let previous = clock();
  let observed = Infinity;
  let ticks = 0;
  for (let attempt = 0; attempt < 4096 && ticks < 8; attempt++) {
    const current = clock();
    if (current <= previous) continue;
    observed = Math.min(observed, current - previous);
    previous = current;
    ticks++;
  }
  return Number.isFinite(observed) ? observed : undefined;
}

type TimingStats = NonNullable<ReturnType<typeof summarizeTimings>>;

function timingStep(
  stats: TimingStats,
  resolution: number | undefined,
  count: number,
) {
  // Use a single, conservative scale for the median and range. Coarse or
  // unobserved ticks, wide variation and incomplete series all reduce precision.
  const scale = Math.max(
    resolution ?? 1,
    stats.median > 0 ? 10 ** (Math.floor(Math.log10(stats.median)) - 1) : 0,
    (stats.max - stats.min) / Math.min(timingRepetitions, Math.max(2, count)),
    0.001,
  );
  // Subtract a small tolerance for decimal timer ticks represented in binary.
  return 10 ** Math.ceil(Math.log10(scale) - 1e-9);
}

export function displayTiming(
  stats: TimingStats,
  resolution: number | undefined,
  count: number,
) {
  const step = timingStep(stats, resolution, count);
  const decimals = Math.max(0, -Math.round(Math.log10(step)));
  const format = (value: number) =>
    value < step && value > 0
      ? '<' + step.toFixed(decimals)
      : (Math.round(value / step) * step).toFixed(decimals);
  if (count < 2) return format(stats.median) + ' ms';
  return (
    format(stats.median) +
    ' ms median · ' +
    format(stats.min) +
    '–' +
    format(stats.max) +
    ' ms observed'
  );
}

export function displayTimingDifference(
  baseline: TimingStats,
  current: TimingStats,
  resolution: number | undefined,
  count: number,
) {
  const step = Math.max(
    timingStep(baseline, resolution, count),
    timingStep(current, resolution, count),
  );
  const difference = current.median - baseline.median;
  const decimals = Math.max(0, -Math.round(Math.log10(step)));
  if (Math.abs(difference) < step)
    return '<' + step.toFixed(decimals) + ' ms at display precision';
  const magnitude = (Math.round(Math.abs(difference) / step) * step).toFixed(
    decimals,
  );
  const direction = difference < 0 ? ' lower' : ' higher';
  if (baseline.median <= step) return magnitude + ' ms' + direction;
  const percentStep = Math.max(
    1,
    10 ** Math.ceil(Math.log10((step / baseline.median) * 100)),
  );
  const percent =
    Math.round(((Math.abs(difference) / baseline.median) * 100) / percentStep) *
    percentStep;
  return magnitude + ' ms' + direction + (percent ? ' (' + percent + '%)' : '');
}
