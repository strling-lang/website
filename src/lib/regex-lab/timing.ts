import type { JsonObject } from '@strling-lang/strling';
import type { LabExecutionResult, LabRuntimeIdentity } from './contracts.ts';
import type { Compilation } from './compiler.ts';
import { summarizeTimings } from './experiments.ts';
import type { Runtime, RunOptions } from './interactive.ts';

export const timingRepetitions = 9;
export const timingSchema = 'strling-lab-timing-v3';

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

export interface TimingExperiment {
  schema: typeof timingSchema;
  dataset: string;
  source: string;
  inputUnits: number;
  executionPattern?: string;
  compiler?: Pick<
    Compilation,
    'identity' | 'profile' | 'durationMs' | 'cached' | 'timerResolutionMs'
  >;
  artifact?: JsonObject;
  runtime?: Runtime;
  runtimeIdentity?: LabRuntimeIdentity;
  options?: RunOptions;
  repetitions: number;
  wallResolutionMs?: number;
  status: 'running' | 'complete' | 'incomplete';
  warmup?: Sample;
  samples: Sample[];
  stats: ReturnType<typeof seriesStats>;
  issue?: string;
}

type Execute = (
  signal: AbortSignal,
  probeTimer: boolean,
) => Promise<LabExecutionResult>;

export async function runTimingExperiment(
  experiment: TimingExperiment,
  prepare: (signal: AbortSignal) => Promise<Execute>,
  signal: AbortSignal,
  progress: () => void,
  clock: () => number = () => performance.now(),
) {
  try {
    signal.throwIfAborted();
    const execute = await prepare(signal);
    const measure = async (probeTimer: boolean): Promise<Sample> => {
      signal.throwIfAborted();
      const start = clock();
      const result = await execute(signal, probeTimer);
      const wallMs = clock() - start;
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
        wallMs,
        error: 'error' in result ? result.error : undefined,
      };
    };

    experiment.warmup = await measure(true);
    if (experiment.warmup.error) {
      experiment.issue = experiment.warmup.error.message;
      return;
    }
    for (let index = 0; index < timingRepetitions; index++) {
      const sample = await measure(false);
      experiment.samples.push(sample);
      experiment.stats = seriesStats(experiment.samples);
      if (sample.error) {
        experiment.issue = sample.error.message;
        return;
      }
      progress();
    }
    signal.throwIfAborted();
    experiment.status = 'complete';
  } catch (error) {
    if (signal.aborted) interruptTiming(experiment);
    else
      experiment.issue =
        error instanceof Error
          ? error.message
          : 'The timing run could not complete.';
  } finally {
    if (experiment.status === 'running') experiment.status = 'incomplete';
  }
}

export function interruptTiming(experiment: TimingExperiment) {
  if (experiment.status !== 'running') return;
  experiment.status = 'incomplete';
  experiment.issue = 'Cancelled or reached the time limit.';
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

type TimingStats = NonNullable<ReturnType<typeof summarizeTimings>>;
const minimumDisplayStepMs = 0.001;

function durationLabel(valueMs: number, stepMs: number) {
  const unit =
    valueMs >= 1000
      ? { scale: 0.001, label: 's' }
      : valueMs >= 1
        ? { scale: 1, label: 'ms' }
        : { scale: 1000, label: 'µs' };
  // Preserve steps like 0.25 ms without repeating binary-float noise or zeros.
  const step = Number((stepMs * unit.scale).toPrecision(2));
  const places = -Math.floor(Math.log10(step) + 1e-9);
  const decimals = Math.max(
    0,
    places + Number(Number(step.toPrecision(1)) !== step),
  );
  return Number((valueMs * unit.scale).toFixed(decimals)) + ' ' + unit.label;
}

export function formatDuration(
  valueMs: number,
  resolutionMs: number | undefined,
) {
  const clockStep =
    resolutionMs === undefined
      ? 1
      : Math.max(minimumDisplayStepMs, Number(resolutionMs.toPrecision(2)));
  if (valueMs < clockStep * (1 - 1e-9)) {
    if (resolutionMs === undefined)
      return valueMs === 0
        ? 'Below timer resolution (step unobserved)'
        : 'Sub-millisecond (timer step unobserved)';
    return '<' + durationLabel(clockStep, clockStep);
  }
  // Show at most about three significant digits, with no step finer than the
  // clock. Variability is communicated by the range, not by coarsening the median.
  const step = Math.max(clockStep, 10 ** (Math.floor(Math.log10(valueMs)) - 2));
  return durationLabel(Math.round(valueMs / step) * step, step);
}

export function displayTiming(
  stats: TimingStats,
  resolutionMs: number | undefined,
  count: number,
) {
  const median = formatDuration(stats.median, resolutionMs);
  if (count < 2) return median;
  const min = formatDuration(stats.min, resolutionMs);
  const max = formatDuration(stats.max, resolutionMs);
  const range = min === max ? min : min + ' – ' + max;
  return median + ' median · ' + range + ' observed';
}
