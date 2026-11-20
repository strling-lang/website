import type { LabExecutionRequest, LabExecutionResult } from './contracts.ts';
import {
  executionResult,
  isPcreRuntime,
  observation,
  runtimeFor,
  validateExecution,
} from './interactive.ts';
import { runJavaScript } from './javascript-engine';
import { inspection, type PatternInspection } from './inspection.ts';
import { readContinuation, type ScanContinuation } from './continuation.ts';
import type { TraceObservation } from './trace.ts';
import { serveWorker } from './worker-client';

export interface WorkerInput {
  request: LabExecutionRequest;
  trace?: boolean;
  inspect?: boolean;
  continuation?: ScanContinuation;
}

export type WorkerOutput =
  LabExecutionResult | TraceObservation | PatternInspection;

let pcre2: Awaited<ReturnType<typeof import('./pcre-engine').createPCRE2>>;
let python: typeof import('./python-engine');

const pcreAssets = {
  pcre242: {
    version: '10.42',
    sha256: 'd9e187e1aa67f7203d01d0b66a95caabdbbc5ecdd46920ba4d93c439cc2be239',
    asset: () => import('./wasm/pcre2-10.42.wasm?url'),
  },
  pcre243: {
    version: '10.43',
    sha256: 'f406df97453b316dc77061b7fafaf7a709be24129890ff19ea7fbe949c08f08e',
    asset: () => import('./wasm/pcre2-10.43.wasm?url'),
  },
  pcre2: {
    version: '10.49',
    sha256: '04edda7fcc7176ed3200d6d86b3e8f2a9eada4e1699a1317ad87b5dd2e28e96e',
    asset: () => import('./wasm/pcre2-10.49.wasm?url'),
  },
};

serveWorker<WorkerInput, WorkerOutput>(
  async ({ request }) => {
    const runtime = runtimeFor(request);
    if (
      (runtime === 'pcre2' || runtime === 'pcre242' || runtime === 'pcre243') &&
      !pcre2
    ) {
      const { asset, version, sha256 } = pcreAssets[runtime];
      const [{ createPCRE2 }, { default: url }] = await Promise.all([
        import('./pcre-engine'),
        asset(),
      ]);
      const response = await fetch(url);
      if (!response.ok)
        throw new Error('PCRE2 WebAssembly could not be loaded.');
      const engine = await createPCRE2(await response.arrayBuffer(), sha256);
      if (engine.version.split(' ')[0] !== version)
        throw new Error(
          'The loaded PCRE2 engine did not match the provider identity.',
        );
      pcre2 = engine;
    }
    if (runtime === 'python' && !python) {
      const module = await import('./python-engine');
      await module.preparePython();
      python = module;
    }
  },
  ({ request, trace, inspect, continuation }) => {
    const runtime = runtimeFor(request);
    if (!runtime)
      return executionResult(request, {
        status: 'unsupported-operation',
        error: {
          message: 'This runtime is outside interactive execution eligibility.',
        },
      });
    const options = validateExecution(request, runtime);
    if (inspect && runtime !== 'javascript') {
      const version = isPcreRuntime(runtime)
        ? pcre2.version
        : python.pythonVersion();
      const body =
        'status' in options
          ? options
          : isPcreRuntime(runtime)
            ? pcre2.inspect(request.pattern, options)
            : python.inspectPython(request.pattern, options.flags);
      return 'status' in body
        ? inspection(
            request,
            runtime,
            version,
            { disposition: 'rejected' },
            executionResult(request, body),
          )
        : inspection(request, runtime, version, body);
    }
    if ('status' in options)
      return executionResult(request, options, observation(runtime));
    const { pattern, input } = request;
    if (isPcreRuntime(runtime)) {
      const saved = readContinuation(continuation);
      if (
        saved &&
        (trace ||
          options.operation !== 'scan' ||
          saved.profileReleaseId !== request.runtime.profileReleaseId ||
          saved.runtimeVersion !== pcre2.version ||
          saved.build !== pcre2.build)
      ) {
        return executionResult(
          request,
          {
            status: 'unsupported-operation',
            error: {
              message:
                'The saved scan requires its original PCRE2 provider build and operation.',
            },
          },
          observation(runtime, pcre2.version),
        );
      }
      const { result, events, termination } = pcre2.run(
        pattern,
        input,
        options,
        trace,
        saved?.after,
      );
      const execution = executionResult(
        request,
        result,
        observation(runtime, pcre2.version),
      );
      return trace
        ? {
            schema: 'strling-lab-trace-v1',
            instrumentation: 'pcre2-interpreter-auto-callout-v1',
            events,
            termination,
            execution,
          }
        : execution;
    }
    if (runtime === 'python') {
      const { result, version } = python.runPython(pattern, input, options);
      return executionResult(request, result, observation(runtime, version));
    }
    return executionResult(
      request,
      runJavaScript(pattern, input, options),
      observation(runtime),
    );
  },
);
