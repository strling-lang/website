import { readFile } from 'node:fs/promises';
import type { JsonObject } from '@strling-lang/strling';
import { loadBundledWasm } from '@strling-lang/strling/node';
import type {
  Pattern,
  SimplyCompileProjection,
} from '@strling-lang/strling/simply';

const exactTargetProfile: JsonObject = JSON.parse(
  await readFile(new URL('./ecmascript-2024.json', import.meta.url), 'utf8'),
);
const { profile_id, profile_version } = exactTargetProfile;
if (typeof profile_id !== 'string' || typeof profile_version !== 'string') {
  throw new Error('Expected a versioned STRling target profile');
}

// The reference digest comes from the canonical compile-request fixture.
export const compileProjection = {
  target_profile: {
    profile_id,
    profile_version,
    sha256: 'd0f13d7b7b0af92f201dfd29270325d9c3cce50cf39a5969648b71c9c25905bc',
  },
  requested_outputs: ['target_artifact'],
  compiler_options: {
    partial_semantics: 'forbid',
    diagnostic_policy: { minimum_severity: 'hint' },
  },
} satisfies SimplyCompileProjection;

export async function loadPatternCompiler() {
  const client = await loadBundledWasm();

  return (pattern: Pattern): RegExp => {
    const { compile_result: result } = pattern.compile(
      client,
      compileProjection,
      exactTargetProfile,
    );
    if (result.outcome !== 'succeeded') {
      throw new Error(`STRling compile failed: ${JSON.stringify(result)}`);
    }

    // The public adapter exposes compile_result as JSON. Check the fields used
    // at the JavaScript runtime boundary before constructing a RegExp.
    const artifact = result.artifact;
    const emitted =
      artifact && typeof artifact === 'object' && 'pattern' in artifact
        ? artifact.pattern
        : undefined;
    if (
      !emitted ||
      typeof emitted !== 'object' ||
      !('text' in emitted) ||
      typeof emitted.text !== 'string' ||
      !('flags' in emitted) ||
      !Array.isArray(emitted.flags) ||
      !emitted.flags.every((flag) => typeof flag === 'string')
    ) {
      throw new Error('Expected ECMAScript pattern text and flags');
    }
    return new RegExp(emitted.text, emitted.flags.join(''));
  };
}
