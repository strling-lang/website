import type {
  LabExecutionRequest,
  LabExecutionResult,
  LabSpan,
} from './contracts.ts';

export interface TraceEvent {
  callout: number;
  pattern: LabSpan;
  subjectPosition: number;
  attemptStart: number;
  backtrackSincePrevious: boolean;
  newAttempt: boolean;
  lastCapture: number;
  captures: { index: number; span: LabSpan }[];
}

export interface TraceObservation {
  schema: 'strling-lab-trace-v1';
  instrumentation: 'pcre2-interpreter-auto-callout-v1';
  events: TraceEvent[];
  termination: 'matched' | 'no-match' | 'limit' | 'error';
  execution: LabExecutionResult;
}

export interface LabTraceProvider {
  trace(
    request: LabExecutionRequest,
    signal: AbortSignal,
  ): Promise<TraceObservation>;
}
