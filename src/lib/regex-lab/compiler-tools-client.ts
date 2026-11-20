import type { JsonObject } from '@strling-lang/strling';
import {
  toolsIdentity,
  verifiedToolResult,
  type ToolOutput,
  type ToolRequest,
} from './compiler-tools';
import { limits } from './interactive.ts';
import { LabWorker } from './worker-client';

export class LabCompilerTools {
  #worker = new LabWorker<
    { request: ToolRequest; expectedTarget?: JsonObject },
    ToolOutput
  >(
    () =>
      new Worker(new URL('./compiler-tools.worker.ts', import.meta.url), {
        type: 'module',
      }),
    limits.compilerMs,
  );

  async run(
    request: ToolRequest,
    signal: AbortSignal,
    expectedTarget?: JsonObject,
  ): Promise<ToolOutput> {
    if (!toolsIdentity.candidateSha256)
      throw new Error('Compiler tools are unavailable in this build.');
    const reply = await this.#worker.run({ request, expectedTarget }, signal);
    signal.throwIfAborted();
    try {
      if (
        !reply ||
        reply.identity?.candidateSha256 !== toolsIdentity.candidateSha256 ||
        reply.identity?.baseRevision !== toolsIdentity.baseRevision ||
        reply.identity?.version !== toolsIdentity.version ||
        reply.identity?.protocol !== toolsIdentity.protocol
      ) {
        throw new Error(
          'The compiler tools worker returned a different build identity.',
        );
      }
      verifiedToolResult(
        {
          protocol: reply.identity.protocol,
          operation: reply.operation,
          result: reply.result,
        },
        request,
      );
      return reply;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  dispose() {
    this.#worker.dispose();
  }
}
