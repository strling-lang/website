import type { JsonObject, JsonValue } from '@strling-lang/strling';
import { jsonObject } from './compiler.ts';

export const toolsIdentity = {
  protocol: 'strling.lab-compiler-tools@1.0.0-rc.1',
  version: '0.1.0-rc.1',
  baseRevision: '4e58730bbf67eaff683268e285e7084ccda5fadd',
  candidateSha256: import.meta.env.PUBLIC_LAB_TOOLS_CANDIDATE_SHA256 || '',
};
export const toolsPath = '/_strling-lab/compiler-tools-0.1.0-rc.1.wasm';

export type Destination = 'semantic_strling' | 'simply_builder';
export type ToolRequest =
  | { operation: 'format'; document: JsonObject }
  | { operation: 'convert'; program: JsonObject; destination: Destination }
  | {
      operation: 'explain';
      program: JsonObject;
      subject: string;
      target_profile?: JsonObject;
    };

export interface ToolOutput {
  identity: typeof toolsIdentity;
  operation: ToolRequest['operation'];
  result: JsonObject;
}

function has(value: JsonValue | undefined, allowed: readonly string[]) {
  return typeof value === 'string' && allowed.includes(value);
}

export function verifiedToolResult(
  reply: JsonObject,
  request: ToolRequest,
): JsonObject {
  const result = jsonObject(reply.result);
  if (
    reply.protocol !== toolsIdentity.protocol ||
    reply.operation !== request.operation ||
    !result
  ) {
    throw new Error(
      'The compiler tools reply failed its protocol or operation check.',
    );
  }
  switch (request.operation) {
    case 'format':
      if (
        (result.status === 'formatted' && typeof result.text === 'string') ||
        (result.status === 'rejected' && Array.isArray(result.diagnostics))
      )
        return result;
      break;
    case 'convert': {
      const proof = jsonObject(result.equivalence);
      const output = jsonObject(result.output);
      if (
        result.conversion_version === '1.0.0' &&
        result.destination === request.destination &&
        has(result.status, ['exact', 'partial', 'unsupported']) &&
        ((result.status === 'exact' &&
          proof?.status === 'proven' &&
          output?.kind === request.destination &&
          typeof proof.source_fingerprint === 'string' &&
          /^[a-f0-9]{64}$/.test(proof.source_fingerprint) &&
          proof.source_fingerprint === proof.reconstructed_fingerprint) ||
          (result.status === 'partial' &&
            proof?.status === 'not_proven' &&
            output?.kind === request.destination) ||
          (result.status === 'unsupported' &&
            proof?.status === 'not_applicable' &&
            output === undefined))
      )
        return result;
      break;
    }
    case 'explain': {
      const disposition = result.explanation_disposition;
      const outcome = result.outcome;
      if (
        result.model_version === '1.0.0' &&
        result.execution_mode === 'search' &&
        ((outcome === 'matched' && disposition === 'not_applicable') ||
          (outcome === 'no_match' && has(disposition, ['proven', 'likely'])) ||
          (outcome === 'unknown' && disposition === 'unknown') ||
          (outcome === 'unavailable' && disposition === 'unavailable')) &&
        Array.isArray(result.findings) &&
        result.findings.every((finding) => {
          const item = jsonObject(finding);
          return (
            typeof item?.reason_code === 'string' &&
            has(item.confidence, ['proven', 'likely', 'unknown', 'unavailable'])
          );
        }) &&
        jsonObject(result.subject) &&
        jsonObject(result.work)
      )
        return result;
      break;
    }
  }
  throw new Error(
    'The compiler tools reply failed its canonical result check.',
  );
}
