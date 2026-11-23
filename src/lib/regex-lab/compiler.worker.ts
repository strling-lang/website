import {
  instantiateWasmResponse,
  type WasmClient,
} from '@strling-lang/strling';
import compilerUrl from '@strling-lang/strling/strling_interop.wasm?url';
import { compile, type CompileInput, type Compilation } from './compiler';
import { serveWorker } from './worker-client';
import { estimateTimerResolution } from './timer-resolution';

let client: WasmClient | undefined;
let timerResolutionMs: number | undefined;
serveWorker<CompileInput, Compilation>(
  async () => {
    if (client) return;
    client = await instantiateWasmResponse(fetch(compilerUrl));
    timerResolutionMs = estimateTimerResolution();
  },
  (input) => ({ ...compile(client!, input), timerResolutionMs }),
);
