import type { Sha256Digest } from '../regex-conformance/contracts.ts';

export const LAB_EXECUTION_REQUEST_SCHEMA =
  'strling-regex-lab-execution-request-v1' as const;
export const LAB_EXECUTION_RESULT_SCHEMA =
  'strling-regex-lab-execution-result-v1' as const;

export type LabOptionValue = boolean | string | number | null;
export type LabProviderKind = 'browser-local' | 'remote-isolated' | 'fixture';

export interface LabRuntimeIdentity {
  profileId: string;
  releaseId: string;
  profileReleaseId: string;
  technicalLabel: string;
  projectionDigest?: Sha256Digest;
}

export interface LabExecutionRequest {
  schemaVersion: typeof LAB_EXECUTION_REQUEST_SCHEMA;
  requestId: string;
  runtime: LabRuntimeIdentity;
  operationId: string;
  pattern: string;
  options: Record<string, LabOptionValue>;
  input: string;
}

export interface LabSpan {
  start: number;
  end: number;
  unit: string;
}

export type CaptureParticipation =
  'participated' | 'nonparticipating' | 'unavailable';

export interface LabCapture {
  captureId: string;
  index: number;
  name?: string;
  participation: CaptureParticipation;
  value?: string;
  span?: LabSpan;
  engineNativeMetadata?: Record<string, unknown>;
}

export interface LabMatch {
  matchId: string;
  ordinal: number;
  value: string;
  span: LabSpan;
  captures: LabCapture[];
  engineNativeMetadata?: Record<string, unknown>;
}

export interface LabTiming {
  durationMs: number;
  compileMs?: number;
  executionMs?: number;
}

export interface LabExecutionError {
  message: string;
  code?: string;
  offset?: number;
  engineNativeMetadata?: Record<string, unknown>;
}

interface LabExecutionResultBase {
  schemaVersion: typeof LAB_EXECUTION_RESULT_SCHEMA;
  requestId: string;
  profileReleaseId: string;
  operationId: string;
  provider: { providerId: string; kind: LabProviderKind };
  timing: LabTiming;
  engineNativeMetadata?: Record<string, unknown>;
}

export interface LabMatchedResult extends LabExecutionResultBase {
  status: 'matched';
  matches: LabMatch[];
}

export interface LabNoMatchResult extends LabExecutionResultBase {
  status: 'no-match';
  matches: [];
}

export interface LabCompileRejectionResult extends LabExecutionResultBase {
  status: 'compile-rejection';
  error: LabExecutionError;
}

export interface LabRuntimeErrorResult extends LabExecutionResultBase {
  status: 'runtime-error';
  error: LabExecutionError;
}

export interface LabResourceTerminationResult extends LabExecutionResultBase {
  status: 'resource-terminated';
  error: LabExecutionError & {
    termination: 'timeout' | 'memory' | 'step-limit' | 'other';
  };
}

export interface LabUnsupportedOperationResult extends LabExecutionResultBase {
  status: 'unsupported-operation';
  error: LabExecutionError;
}

export interface LabInfrastructureFailureResult extends LabExecutionResultBase {
  status: 'infrastructure-failure';
  error: LabExecutionError;
}

export type LabExecutionResult =
  | LabMatchedResult
  | LabNoMatchResult
  | LabCompileRejectionResult
  | LabRuntimeErrorResult
  | LabResourceTerminationResult
  | LabUnsupportedOperationResult
  | LabInfrastructureFailureResult;

export interface LabExecutionContext {
  signal: AbortSignal;
}

export interface LabExecutionProvider {
  readonly providerId: string;
  readonly kind: LabProviderKind;
  supports(runtime: LabRuntimeIdentity): boolean;
  execute(
    request: LabExecutionRequest,
    context: LabExecutionContext,
  ): Promise<LabExecutionResult>;
}

export function createLabExecutionRequest(
  request: Omit<LabExecutionRequest, 'schemaVersion'>,
): LabExecutionRequest {
  return { schemaVersion: LAB_EXECUTION_REQUEST_SCHEMA, ...request };
}

export function infrastructureFailureResult(
  request: LabExecutionRequest,
  provider: Pick<LabExecutionProvider, 'providerId' | 'kind'>,
  error: unknown,
): LabInfrastructureFailureResult {
  return {
    schemaVersion: LAB_EXECUTION_RESULT_SCHEMA,
    requestId: request.requestId,
    profileReleaseId: request.runtime.profileReleaseId,
    operationId: request.operationId,
    provider: {
      providerId: provider.providerId,
      kind: provider.kind,
    },
    timing: { durationMs: 0 },
    status: 'infrastructure-failure',
    error: {
      message: error instanceof Error ? error.message : 'Execution failed.',
    },
  };
}
