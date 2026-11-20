import type {
  LabExecutionProvider,
  LabExecutionRequest,
  LabExecutionResult,
  LabRuntimeIdentity,
} from './contracts.ts';
import {
  executionResult,
  isPcreRuntime,
  limits,
  observation,
  runtimeFor,
  type EngineResult,
  type Runtime,
} from './interactive.ts';
import type { WorkerInput, WorkerOutput } from './execution.worker.ts';
import { verifyInspection } from './inspection.ts';
import {
  verifyContinuation,
  type ScanContinuation,
  type ScanProvenance,
} from './continuation.ts';
import {
  browserProviderIdentity,
  validateBrowserReply,
} from './result-validation.ts';
import type { LabTraceProvider, TraceObservation } from './trace.ts';
import { LabWorker, WorkerTimeout } from './worker-client';

export class BrowserLabProvider
  implements LabExecutionProvider, LabTraceProvider
{
  readonly kind = browserProviderIdentity.kind;
  readonly providerId = browserProviderIdentity.providerId;
  #runtime: Runtime | undefined;
  #worker = new LabWorker<WorkerInput, WorkerOutput>(
    () =>
      this.#runtime === 'python311' || this.#runtime === 'python311bytes'
        ? import.meta.env.DEV
          ? new Worker(new URL('./python-311.worker.ts', import.meta.url), {
              type: 'module',
            })
          : new Worker(new URL('./python-311.worker.ts', import.meta.url))
        : new Worker(new URL('./execution.worker.ts', import.meta.url), {
            type: 'module',
          }),
    limits.executeMs,
    () =>
      this.#runtime?.startsWith('python')
        ? limits.pythonInitializationMs
        : limits.initializationMs,
  );

  supports(runtime: LabRuntimeIdentity) {
    return runtimeFor({ runtime }) !== undefined;
  }

  async execute(
    request: LabExecutionRequest,
    { signal }: { signal: AbortSignal },
  ): Promise<LabExecutionResult> {
    const result = await this.#run(request, false, signal);
    if ('status' in result) return result;
    throw new Error('The worker returned an invalid execution response.');
  }

  async trace(
    request: LabExecutionRequest,
    signal: AbortSignal,
  ): Promise<TraceObservation> {
    const response = await this.#run(request, true, signal);
    if ('instrumentation' in response) return response;
    return {
      schema: 'strling-lab-trace-v1',
      instrumentation: 'pcre2-interpreter-auto-callout-v1',
      events: [],
      termination:
        response.status === 'resource-terminated' ? 'limit' : 'error',
      execution: response,
    };
  }

  async inspect(request: LabExecutionRequest, signal: AbortSignal) {
    const runtime = runtimeFor(request);
    if (!runtime || runtime === 'javascript')
      throw new Error(
        'Native structure inspection is unavailable for this runtime.',
      );
    this.#select(runtime);
    try {
      const reply = await this.#worker.run({ request, inspect: true }, signal);
      signal.throwIfAborted();
      if (!verifyInspection(reply, request, runtime))
        throw new Error('The worker returned a mismatched structure result.');
      return reply;
    } catch (error) {
      if (!signal.aborted) this.dispose();
      throw error;
    }
  }

  async resume(
    request: LabExecutionRequest,
    saved: ScanContinuation,
    provenance: ScanProvenance,
    signal: AbortSignal,
  ) {
    await verifyContinuation(saved, request, provenance);
    signal.throwIfAborted();
    const result = await this.#run(request, false, signal, saved);
    if (!('status' in result))
      throw new Error('The worker returned an unrelated scan result.');
    return result;
  }

  dispose() {
    this.#worker.dispose();
    this.#runtime = undefined;
  }

  #select(runtime: Runtime) {
    if (this.#runtime !== runtime) this.dispose();
    this.#runtime = runtime;
  }

  async #run(
    request: LabExecutionRequest,
    trace: boolean,
    signal: AbortSignal,
    continuation?: ScanContinuation,
  ): Promise<LabExecutionResult | TraceObservation> {
    const runtime = runtimeFor(request);
    if (!runtime || (trace && !isPcreRuntime(runtime))) {
      return executionResult(request, {
        status: 'unsupported-operation',
        error: {
          message:
            'This runtime does not expose the requested instrumentation or operation.',
        },
      });
    }
    this.#select(runtime);
    try {
      const reply = await this.#worker.run(
        { request, trace, continuation },
        signal,
      );
      const result = validateBrowserReply(reply, request, runtime, trace);
      if ('status' in result) {
        const completedScan =
          result.status === 'matched' || result.status === 'no-match';
        const resumedFrom = result.engineNativeMetadata?.resumedFrom;
        if (
          continuation && completedScan
            ? resumedFrom !== continuation.after.end ||
              result.engineNativeMetadata?.providerBuild !==
                continuation.build ||
              result.matches.some(
                (match) => match.span.start < continuation.after.end,
              )
            : resumedFrom !== undefined
        )
          throw new Error('The worker returned a mismatched continuation.');
      }
      return result;
    } catch (error) {
      if (signal.aborted) throw error;
      this.dispose();
      const details: EngineResult =
        error instanceof WorkerTimeout
          ? {
              status: 'resource-terminated',
              error: { termination: 'timeout', message: error.message },
            }
          : {
              status: 'infrastructure-failure',
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : 'The runtime worker is unavailable.',
              },
            };
      return executionResult(request, details, observation(runtime));
    }
  }
}
