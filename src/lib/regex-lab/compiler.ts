import {
  sourceCompileRequest,
  type JsonObject,
  type JsonValue,
  type WasmClient,
} from '@strling-lang/strling';
import ecmascript from './profiles/ecmascript-2024.json' with { type: 'json' };
import pcre243 from './profiles/pcre2-10.43.json' with { type: 'json' };
import pcre242 from './profiles/pcre2-10.42.json' with { type: 'json' };
import python from './profiles/python-re-3.11.json' with { type: 'json' };
import pythonBytes from './profiles/python-re-3.11-bytes.json' with { type: 'json' };
import {
  isScalarText,
  limits,
  type RunOptions,
  type Runtime,
} from './interactive.ts';
import { sameProfileReference } from './profile-binding.ts';

export const compilerIdentity = {
  package: '@strling-lang/strling',
  productVersion: '4.0.3',
  abi: 'strling.wasm-abi@1',
  protocol: '1.0.0',
};

export const targets = {
  ecmascript: { label: 'ECMAScript 2024', profile: ecmascript },
  pcre243: { label: 'PCRE2 10.43', profile: pcre243 },
  pcre242: { label: 'PCRE2 10.42', profile: pcre242 },
  python: { label: 'Python re 3.11 · text', profile: python },
  'python-bytes': { label: 'Python re 3.11 · bytes', profile: pythonBytes },
} as const;

export type Target = keyof typeof targets;
export type CompilerFormat = 'semantic' | 'simply';

const targetDigests: Record<Target, string> = {
  ecmascript:
    'd0f13d7b7b0af92f201dfd29270325d9c3cce50cf39a5969648b71c9c25905bc',
  pcre243: '56762a1d289d41d0811b007695464916fda0ca5c48c2f5569b4ec26983a24bff',
  pcre242: '57941ab3f2a5709d030c6f890b1911564513e0dd785710956d7b8af19711e9e2',
  python: 'b3d5e5cbce0a2cd1f0f236914b7d35abc6e7c7614ff9d80d4ee2b7c546d5f3cf',
  'python-bytes':
    '385ed4271e999db85dd0d4c1fd2894c50b2eb16e0d40a3c83b0306fb7fa1805c',
};

export function targetReference(target: Target): JsonObject {
  const { profile_id, profile_version } = targets[target].profile;
  return { profile_id, profile_version, sha256: targetDigests[target] };
}

export interface CompileInput {
  source: string;
  format: CompilerFormat;
  target: Target;
}

export interface Compilation {
  identity: typeof compilerIdentity;
  durationMs: number;
  timerResolutionMs?: number;
  cached?: boolean;
  result?: JsonObject;
  profile?: JsonObject;
  protocolResult?: JsonObject;
  failure?: string;
}

export const semanticExample = [
  'semantic strling 1.0;',
  'case sensitive;',
  '',
  'pattern capture word {',
  '    text "hello";',
  '}',
].join('\n');

export const simplyExample = JSON.stringify(
  {
    protocol_version: '1.1.0',
    contract_version: '1.0.0',
    specification_version: '1.0-draft.1',
    identity_namespace: 'lab',
    semantic_options: {
      case_matching: 'sensitive',
      text_model: 'unicode_scalar_values',
      builtin_character_domain: 'unicode',
      wildcard_line_terminators: 'exclude',
    },
    steps: [
      {
        step_id: 'literal-1',
        operation: 'literal',
        arguments: { text: 'hello' },
      },
    ],
    root_step_id: 'literal-1',
  },
  null,
  2,
);

export function jsonObject(
  value: JsonValue | undefined,
): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

const requestedOutputs = [
  'semantic',
  'analysis',
  'portability',
  'target_artifact',
] as const;

export function compile(client: WasmClient, input: CompileInput): Compilation {
  const started = performance.now();
  const finish = (
    details: Omit<Compilation, 'identity' | 'durationMs'>,
  ): Compilation => ({
    ...details,
    identity: compilerIdentity,
    durationMs: performance.now() - started,
  });
  if (input.source.length > limits.pattern || !isScalarText(input.source)) {
    return finish({
      failure:
        'Source exceeds the size limit or contains unpaired UTF-16 surrogates.',
    });
  }

  const target = targets[input.target].profile as unknown as JsonObject;
  const profile = jsonObject(client.inspectTargetProfile(target));
  const reference = jsonObject(profile?.profile_reference);
  if (
    !reference ||
    !sameProfileReference(reference, targetReference(input.target))
  )
    return finish({
      failure: 'The compiler did not resolve the exact target profile.',
    });

  const compilerOptions = {
    partial_semantics: 'forbid',
    diagnostic_policy: { minimum_severity: 'hint' },
  };
  try {
    const requestOptions = {
      sourceId: 'src:website.lab',
      requestedOutputs,
      compilerOptions,
      targetProfileReference: reference,
    };
    let result: JsonObject | undefined;
    let protocolResult: JsonObject | undefined;
    if (input.format === 'semantic') {
      result = jsonObject(
        client.compile(
          sourceCompileRequest(input.source, requestOptions),
          target,
        ),
      );
    } else {
      const builder = jsonObject(JSON.parse(input.source));
      if (!builder)
        return finish({
          failure: 'Enter a Simply 1.0 or 1.1 builder object in JSON.',
        });
      const suppliedProjection = jsonObject(builder.compile);
      protocolResult = jsonObject(
        client.simplyCompile(
          {
            ...builder,
            compile: {
              ...suppliedProjection,
              target_profile: reference,
              requested_outputs: requestedOutputs,
              compiler_options: compilerOptions,
            },
          },
          target,
        ),
      );
      result = jsonObject(protocolResult?.compile_result);
    }
    if (
      JSON.stringify(protocolResult ?? result ?? null).length > limits.output
    ) {
      return finish({
        failure: 'The compiler result exceeded the workbench output limit.',
      });
    }
    return finish({ result, protocolResult, profile: reference });
  } catch (error) {
    return finish({
      failure:
        error instanceof Error
          ? error.message
          : 'The compiler rejected this request.',
    });
  }
}

export interface GeneratedPattern {
  pattern: string;
  flags: string;
  artifact: JsonObject;
}

export function generatedPattern(
  compilation: Compilation | undefined,
): GeneratedPattern | undefined {
  if (compilation?.result?.outcome !== 'succeeded') return;
  const artifact = jsonObject(compilation.result.artifact);
  if (
    !sameProfileReference(
      jsonObject(artifact?.target_profile),
      compilation.profile,
    )
  )
    return;
  const pattern = jsonObject(artifact?.pattern);
  if (!artifact || typeof pattern?.text !== 'string') return;
  return {
    pattern: pattern.text,
    flags: Array.isArray(pattern.flags) ? pattern.flags.join('') : '',
    artifact,
  };
}

interface RunnablePattern extends GeneratedPattern {
  runtime: Runtime;
  options: Pick<RunOptions, 'flags' | 'pcreNewline'>;
}

export function runnableArtifact(
  compilation: Compilation | undefined,
): RunnablePattern | undefined {
  const generated = generatedPattern(compilation);
  if (!generated) return;
  const pattern = jsonObject(generated.artifact.pattern);
  const options = generated.artifact.engine_options;
  const requirements = generated.artifact.requirements;
  if (
    pattern?.syntax !== 'regex' ||
    pattern.encoding !== 'utf-8' ||
    !Array.isArray(options) ||
    !Array.isArray(requirements)
  )
    return;
  if (
    !requirements.every((value) => {
      const requirement = jsonObject(value);
      return (
        requirement?.status === 'native' ||
        requirement?.status === 'equivalent_rewrite'
      );
    })
  )
    return;
  const profile = compilation?.profile?.profile_id;
  if (
    profile === targets.ecmascript.profile.profile_id &&
    options.every((value) => {
      const option = jsonObject(value);
      return (
        option?.option_id === 'ecmascript.unicode_mode' &&
        option.stage === 'compile' &&
        (option.value === 'u' || option.value === 'v') &&
        generated.flags.includes(option.value)
      );
    })
  )
    return {
      ...generated,
      runtime: 'javascript',
      options: { flags: generated.flags },
    };
  if (
    profile === targets.pcre243.profile.profile_id ||
    profile === targets.pcre242.profile.profile_id
  ) {
    const is1043 = profile === targets.pcre243.profile.profile_id;
    const supported: Record<string, [string, string | boolean | number]> = {
      'pcre2.matcher_api': ['runtime', 'pcre2_match'],
      'pcre2.multiline': ['compile', true],
      'pcre2.newline': ['compile', 'any'],
      'pcre2.ucp': ['compile', true],
      'pcre2.utf': ['compile', true],
    };
    if (is1043) supported['pcre2.max_variable_lookbehind'] = ['compile', 255];
    const found = new Set<string>();
    for (const value of options) {
      const option = jsonObject(value);
      if (
        typeof option?.option_id !== 'string' ||
        !Object.hasOwn(supported, option.option_id)
      )
        return;
      const requirement = supported[option.option_id]!;
      if (option.stage !== requirement[0] || option.value !== requirement[1])
        return;
      found.add(option.option_id);
    }
    if (found.size !== Object.keys(supported).length) return;
    return {
      ...generated,
      runtime: is1043 ? 'pcre243' : 'pcre242',
      options: { flags: 'mp', pcreNewline: 'any' },
    };
  }
  if (
    profile === targets.python.profile.profile_id ||
    profile === targets['python-bytes'].profile.profile_id
  ) {
    const bytes = profile === targets['python-bytes'].profile.profile_id;
    const option = jsonObject(options[0]);
    if (
      options.length !== 1 ||
      option?.option_id !== 'python.pattern_kind' ||
      option.stage !== 'runtime' ||
      option.value !== (bytes ? 'bytes' : 'str')
    )
      return;
    return {
      ...generated,
      runtime: bytes ? 'python311bytes' : 'python311',
      options: { flags: generated.flags },
    };
  }
}
