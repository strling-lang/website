import loaderUrl from 'pyodide311/pyodide.mjs?url';
import bridgeUrl from 'pyodide311/pyodide.asm.js?url';
import binaryUrl from 'pyodide311/pyodide.asm.wasm?url';
import libraryUrl from 'pyodide311/python_stdlib.zip?url';
import lockUrl from 'pyodide311/pyodide-lock.json?url';
import type { LabExecutionResult } from './contracts.ts';
import { inspection, type PatternInspection } from './inspection.ts';
import type { WorkerInput } from './execution.worker';
import {
  executionResult,
  observation,
  runtimeFor,
  validateExecution,
} from './interactive';
import { bindPython } from './python-bridge';
import { serveWorker } from './worker-client';

let python: ReturnType<typeof bindPython>;

serveWorker<WorkerInput, LabExecutionResult | PatternInspection>(
  async () => {
    if (python) return;
    // This pinned distribution ships a classic Emscripten worker bridge.
    if (import.meta.env.DEV) {
      const url = new URL('/__lab/pyodide311-bridge.mjs', location.origin).href;
      await import(/* @vite-ignore */ url);
    } else {
      const scope = globalThis as unknown as {
        importScripts(url: string): void;
      };
      scope.importScripts(new URL(bridgeUrl, location.href).href);
    }
    const loader = import.meta.env.DEV
      ? '/__lab/pyodide311-loader.mjs'
      : loaderUrl;
    const { loadPyodide } = (await import(
      /* @vite-ignore */ new URL(loader, location.href).href
    )) as typeof import('pyodide311');
    const api = await loadPyodide({
      indexURL: new URL('.', new URL(binaryUrl, location.href)).href,
      stdLibURL: new URL(libraryUrl, location.href).href,
      lockFileURL: new URL(lockUrl, location.href).href,
      jsglobals: { setTimeout: globalThis.setTimeout.bind(globalThis) },
    });
    python = bindPython(api, '3.11');
  },
  ({ request, inspect }) => {
    const runtime = runtimeFor(request);
    if (runtime !== 'python311' && runtime !== 'python311bytes') {
      return executionResult(request, {
        status: 'unsupported-operation',
        error: { message: 'This worker runs Python 3.11 operations.' },
      });
    }
    const options = validateExecution(request, runtime);
    if (inspect) {
      const body =
        'status' in options
          ? options
          : python.inspect(
              request.pattern,
              options.flags,
              runtime === 'python311bytes',
            );
      return 'status' in body
        ? inspection(
            request,
            runtime,
            python.version,
            { disposition: 'rejected' },
            executionResult(request, body),
          )
        : inspection(request, runtime, python.version, body);
    }
    const result =
      'status' in options
        ? options
        : python.run(
            request.pattern,
            request.input,
            options,
            runtime === 'python311bytes',
          );
    return executionResult(
      request,
      result,
      observation(runtime, python.version),
    );
  },
);
