import type { LabExecutionResult } from './contracts.ts';
import type { Compilation } from './compiler.ts';
import { summarizeTimings } from './experiments.ts';
import type { Runtime, RunOptions } from './interactive.ts';

export const timingRepetitions = 8;

interface Sample {
  status: LabExecutionResult['status'];
  wallMs: number;
  timing: LabExecutionResult['timing'];
  observation?: LabExecutionResult['observation'];
  error?: Extract<LabExecutionResult, { error: unknown }>['error'];
}

export interface TimingSeries {
  source: string;
  inputUnits: number;
  executionPattern?: string;
  compiler?: Pick<
    Compilation,
    'identity' | 'profile' | 'durationMs' | 'cached'
  >;
  runtime?: Runtime;
  options?: RunOptions;
  warmup?: Sample;
  samples: Sample[];
  stats: ReturnType<typeof seriesStats>;
  issue?: string;
}

export interface TimingExperiment {
  schema: 'strling-lab-timing-v1';
  dataset: string;
  multiplier: number;
  repetitions: number;
  timerResolutionMs?: number;
  status: 'running' | 'complete' | 'incomplete';
  series: TimingSeries[];
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

export function displayTiming(
  stats: NonNullable<ReturnType<typeof summarizeTimings>>,
  resolution: number | undefined,
  count: number,
) {
  // Use a single, conservative scale for the median and range. Coarse or
  // unobserved ticks, wide variation and incomplete series all reduce precision.
  const scale = Math.max(
    resolution ?? 1,
    stats.median > 0 ? 10 ** (Math.floor(Math.log10(stats.median)) - 1) : 0,
    (stats.max - stats.min) / Math.min(8, Math.max(2, count)),
    0.001,
  );
  // Subtract a small tolerance for decimal timer ticks represented in binary.
  const exponent = Math.ceil(Math.log10(scale) - 1e-9);
  const step = 10 ** exponent;
  const decimals = Math.max(0, -exponent);
  const format = (value: number) =>
    value < step && value > 0
      ? '<' + step.toFixed(decimals)
      : (Math.round(value / step) * step).toFixed(decimals);
  if (count < 2) return format(stats.median) + ' ms';
  return (
    format(stats.median) +
    ' ms typical · ' +
    format(stats.min) +
    '–' +
    format(stats.max) +
    ' ms observed'
  );
}
