import { loadPyodide } from 'pyodide';
import bridgeUrl from 'pyodide/pyodide.asm.mjs?url';
import binaryUrl from 'pyodide/pyodide.asm.wasm?url';
import libraryUrl from 'pyodide/python_stdlib.zip?url';
import lockUrl from 'pyodide/pyodide-lock.json?url';
import type { RunOptions } from './interactive.ts';
import { bindPython } from './python-bridge';

let python: ReturnType<typeof bindPython>;

export async function preparePython() {
  if (python) return;
  type ModuleFactory = NonNullable<
    NonNullable<Parameters<typeof loadPyodide>[0]>['createPyodideModule']
  >;
  const { default: create } = (await import(
    /* @vite-ignore */ new URL(bridgeUrl, location.href).href
  )) as { default: ModuleFactory };
  const api = await loadPyodide({
    // Pyodide's own streaming loader appends the unmodified WASM filename.
    indexURL: new URL('.', new URL(binaryUrl, location.href)).href,
    createPyodideModule: create,
    stdLibURL: new URL(libraryUrl, location.href).href,
    lockFileURL: new URL(lockUrl, location.href).href,
    enableRunUntilComplete: false,
    jsglobals: {},
  });
  python = bindPython(api, '3.14');
}

export function runPython(pattern: string, input: string, options: RunOptions) {
  return {
    result: python.run(pattern, input, options),
    version: python.version,
  };
}

export const pythonVersion = () => python.version;
export const inspectPython = (pattern: string, flags: string) =>
  python.inspect(pattern, flags);
