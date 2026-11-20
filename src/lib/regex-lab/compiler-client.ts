import {
  compilerIdentity,
  jsonObject,
  targetReference,
  type CompileInput,
  type Compilation,
} from './compiler';
import { limits } from './interactive.ts';
import { LabWorker } from './worker-client';
import { sameProfileReference } from './profile-binding.ts';

export class LabCompiler {
  #worker = new LabWorker<CompileInput, Compilation>(
    () =>
      new Worker(new URL('./compiler.worker.ts', import.meta.url), {
        type: 'module',
      }),
    limits.compilerMs,
  );
  #cache = new Map<string, Compilation>();

  async run(input: CompileInput, signal: AbortSignal) {
    signal.throwIfAborted();
    const key = JSON.stringify([compilerIdentity, input]);
    const cached = this.#cache.get(key);
    if (cached) return { ...cached, cached: true };
    const result = await this.#worker.run(input, signal);
    signal.throwIfAborted();
    const expected = targetReference(input.target);
    if (
      !result ||
      result.identity?.package !== compilerIdentity.package ||
      result.identity.productVersion !== compilerIdentity.productVersion ||
      result.identity.abi !== compilerIdentity.abi ||
      result.identity.protocol !== compilerIdentity.protocol ||
      (result.result && !sameProfileReference(result.profile, expected)) ||
      [result.result?.artifact, result.result?.portability].some(
        (projection) =>
          projection !== undefined &&
          !sameProfileReference(
            jsonObject(jsonObject(projection)?.target_profile),
            expected,
          ),
      )
    ) {
      this.dispose();
      throw new Error(
        'The compiler returned an unrelated artifact or target profile.',
      );
    }
    if (result.result || result.protocolResult) {
      if (this.#cache.size >= 8)
        this.#cache.delete(this.#cache.keys().next().value!);
      this.#cache.set(key, result);
    }
    return { ...result, cached: false };
  }

  dispose() {
    this.#worker.dispose();
    this.#cache.clear();
  }
}
