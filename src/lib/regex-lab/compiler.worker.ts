import {
  instantiateWasmResponse,
  type WasmClient,
} from '@strling-lang/strling';
import compilerUrl from '@strling-lang/strling/strling_interop.wasm?url';
import { compile, type CompileInput, type Compilation } from './compiler';
import { serveWorker } from './worker-client';

let client: WasmClient;
serveWorker<CompileInput, Compilation>(
  async () => {
    client ??= await instantiateWasmResponse(fetch(compilerUrl));
  },
  (input) => compile(client, input),
);
