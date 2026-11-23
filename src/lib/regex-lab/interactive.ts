import {
  createLabExecutionRequest,
  LAB_EXECUTION_RESULT_SCHEMA,
  type LabExecutionRequest,
  type LabExecutionResult,
  type LabRuntimeIdentity,
} from './contracts.ts';

export const limits = {
  pattern: 8_192,
  input: 32_768,
  replacement: 2_048,
  matches: 256,
  captures: 128,
  output: 524_288,
  executeMs: 1_500,
  compilerMs: 3_000,
  initializationMs: 15_000,
  pythonInitializationMs: 30_000,
} as const;

export const operations = {
  search: 'Search (yes or no)',
  fullmatch: 'Full match',
  first: 'Find first',
  scan: 'Find all / extract',
  replace: 'Replace first',
  'replace-all': 'Replace all',
  split: 'Split',
} as const;

export type Operation = keyof typeof operations;

export const runtimes = {
  javascript: {
    label: 'JavaScript · browser RegExp',
    flags: 'dgimsuvy',
    unit: 'utf16-code-units',
  },
  pcre2: {
    label: 'PCRE2 10.49 · WebAssembly',
    flags: 'imsxuUADp',
    unit: 'utf8-bytes',
  },
  pcre243: {
    label: 'PCRE2 10.43 · WebAssembly',
    flags: 'imsxuUADp',
    unit: 'utf8-bytes',
  },
  pcre242: {
    label: 'PCRE2 10.42 · WebAssembly',
    flags: 'imsxuUADp',
    unit: 'utf8-bytes',
  },
  python: {
    label: 'Python re 3.14 · WebAssembly',
    flags: 'aimsx',
    unit: 'unicode-code-points',
  },
  python311: {
    label: 'Python re 3.11 · text',
    flags: 'aimsx',
    unit: 'unicode-code-points',
  },
  python311bytes: {
    label: 'Python re 3.11 · bytes',
    flags: 'aimsx',
    unit: 'utf8-bytes',
  },
} as const;

export type Runtime = keyof typeof runtimes;
export type ReplacementSyntax = 'literal' | 'native';

export interface RunOptions {
  flags: string;
  operation: Operation;
  replacement: string;
  replacementSyntax: ReplacementSyntax;
  pcreNewline?: 'any';
}

export const defaultOptions: RunOptions = {
  flags: '',
  operation: 'scan',
  replacement: '',
  replacementSyntax: 'literal',
};

export function interactiveIdentity(runtime: Runtime): LabRuntimeIdentity {
  return {
    profileId: 'interactive:' + runtime,
    releaseId: 'interactive-browser-v1',
    profileReleaseId: 'interactive:' + runtime + '@1',
    technicalLabel: runtimes[runtime].label,
  };
}

export function runtimeFor(
  request: Pick<LabExecutionRequest, 'runtime'>,
): Runtime | undefined {
  return (Object.keys(runtimes) as Runtime[]).find((runtime) => {
    const identity = interactiveIdentity(runtime);
    return (
      request.runtime.profileReleaseId === identity.profileReleaseId &&
      request.runtime.profileId === identity.profileId &&
      request.runtime.releaseId === identity.releaseId &&
      request.runtime.projectionDigest === undefined
    );
  });
}

export function runRequest(
  runtime: Runtime,
  pattern: string,
  input: string,
  options: RunOptions,
) {
  const { operation, ...values } = options;
  return createLabExecutionRequest({
    requestId: crypto.randomUUID(),
    runtime: interactiveIdentity(runtime),
    operationId: operation,
    pattern,
    input,
    options: values,
  });
}

export type Observation = NonNullable<LabExecutionResult['observation']>;
type CoreResult = LabExecutionResult extends infer Result
  ? Result extends LabExecutionResult
    ? Omit<
        Result,
        | 'schemaVersion'
        | 'requestId'
        | 'profileReleaseId'
        | 'operationId'
        | 'provider'
        | 'observation'
        | 'timing'
      >
    : never
  : never;

export type EngineResult = CoreResult & {
  compileMs?: number;
  executionMs?: number;
};

export function observation(runtime: Runtime, version?: string): Observation {
  return {
    eligibility: 'interactive-browser-v1',
    providerVersion: '1.0.0',
    runtime: runtimes[runtime].label,
    runtimeVersion: version,
    environment: navigator.userAgent,
    indexUnit: runtimes[runtime].unit,
    observedAt: new Date().toISOString(),
  };
}

export function executionResult(
  request: LabExecutionRequest,
  details: EngineResult,
  provenance?: Observation,
  resolutionMs?: number,
): LabExecutionResult {
  const { compileMs, executionMs, ...result } = details;
  return {
    ...result,
    schemaVersion: LAB_EXECUTION_RESULT_SCHEMA,
    requestId: request.requestId,
    profileReleaseId: request.runtime.profileReleaseId,
    operationId: request.operationId,
    provider: { providerId: 'interactive-browser-v1', kind: 'browser-local' },
    observation: provenance,
    timing: {
      durationMs: (compileMs ?? 0) + (executionMs ?? 0),
      compileMs,
      executionMs,
      ...(resolutionMs !== undefined && { resolutionMs }),
    },
  };
}

export function validateExecution(
  request: LabExecutionRequest,
  runtime: Runtime,
): EngineResult | RunOptions {
  const { pattern, input, operationId, options } = request;
  const { flags, replacement, replacementSyntax, pcreNewline } = options;
  if (
    !Object.hasOwn(operations, operationId) ||
    typeof flags !== 'string' ||
    [...flags].some((flag) => !runtimes[runtime].flags.includes(flag)) ||
    new Set(flags).size !== flags.length ||
    typeof replacement !== 'string' ||
    (replacementSyntax !== 'literal' && replacementSyntax !== 'native') ||
    (pcreNewline !== undefined &&
      (pcreNewline !== 'any' || !isPcreRuntime(runtime)))
  ) {
    return {
      status: 'unsupported-operation',
      error: {
        message:
          'This operation, flag combination or replacement format is unavailable.',
      },
    };
  }
  if (
    pattern.length > limits.pattern ||
    input.length > limits.input ||
    replacement.length > limits.replacement
  ) {
    return {
      status: 'resource-terminated',
      error: {
        termination: 'other',
        message:
          'Pattern, subject or replacement exceeds the workbench size limit.',
      },
    };
  }
  const operation = operationId as Operation;
  if (
    runtime !== 'javascript' &&
    [pattern, input, replacement].some((text) => !isScalarText(text))
  ) {
    return {
      status: 'unsupported-operation',
      error: { message: 'This provider requires well-formed Unicode text.' },
    };
  }
  return { operation, flags, replacement, replacementSyntax, pcreNewline };
}

export function isPcreRuntime(runtime: Runtime) {
  return runtime === 'pcre2' || runtime === 'pcre243' || runtime === 'pcre242';
}

export function isScalarText(text: string) {
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (character.length === 1 && code >= 0xd800 && code <= 0xdfff)
      return false;
  }
  return true;
}

export class OutputLimitError extends Error {
  constructor() {
    super('The operation exceeded the match, capture or output limit.');
  }
}

export function runtimeFailure(error: unknown): EngineResult {
  return error instanceof OutputLimitError
    ? {
        status: 'resource-terminated',
        error: { message: error.message, termination: 'output-limit' },
      }
    : {
        status: 'runtime-error',
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'The runtime rejected the operation.',
        },
      };
}

export function checkOutput(value: unknown) {
  if (JSON.stringify(value).length > limits.output)
    throw new OutputLimitError();
}
