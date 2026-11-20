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
      const reply = await this.#worker.run({ request, trace }, signal);
      return validateBrowserReply(reply, request, runtime, trace);
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
