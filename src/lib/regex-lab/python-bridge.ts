import engineSource from './python-engine.py?raw';
import { limits, type EngineResult, type RunOptions } from './interactive.ts';

interface PythonAPI {
  globals: object;
  runPython(source: string): unknown;
}

export function bindPython(api: PythonAPI, version: string) {
  api.runPython(engineSource);
  const globals = api.globals as { get(name: string): unknown };
  const runtimeVersion = globals.get('_RUNTIME_VERSION');
  const invoke = globals.get('run_lab');
  if (
    typeof invoke !== 'function' ||
    typeof runtimeVersion !== 'string' ||
    !runtimeVersion.startsWith(version + '.')
  ) {
    throw new Error(
      'The loaded Python engine did not match the provider identity.',
    );
  }
  return {
    version: runtimeVersion,
    run(
      pattern: string,
      input: string,
      options: RunOptions,
      bytes = false,
    ): EngineResult {
      return JSON.parse(
        invoke(JSON.stringify({ pattern, input, options, limits, bytes })),
      );
    },
  };
}
