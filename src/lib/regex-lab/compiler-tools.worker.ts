import { jsonObject } from './compiler';
import {
  toolsIdentity,
  toolsPath,
  verifiedToolResult,
  type ToolOutput,
  type ToolRequest,
} from './compiler-tools';
import { serveWorker } from './worker-client';
import { sameProfileReference } from './profile-binding.ts';

interface ToolsExports {
  memory: WebAssembly.Memory;
  strling_lab_input_v1(): number;
  strling_lab_run_v1(length: number): number;
  strling_lab_output_v1(): number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const maxBytes = 1_048_576;
let adapter: ToolsExports;

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function invoke(request: ToolRequest | { operation: 'describe' }) {
  const input = encoder.encode(
    JSON.stringify({ protocol: toolsIdentity.protocol, request }),
  );
  if (input.length > maxBytes)
    throw new Error('The compiler tools input exceeds 1 MiB.');
  const start = adapter.strling_lab_input_v1();
  new Uint8Array(adapter.memory.buffer, start, input.length).set(input);
  const length = adapter.strling_lab_run_v1(input.length);
  if (length <= 0 || length > maxBytes)
    throw new Error('The compiler tools response exceeded its bounds.');
  const pointer = adapter.strling_lab_output_v1();
  const output = jsonObject(
    JSON.parse(
      decoder.decode(new Uint8Array(adapter.memory.buffer, pointer, length)),
    ),
  );
  if (
    !output ||
    output.protocol !== toolsIdentity.protocol ||
    output.operation !== request.operation
  ) {
    throw new Error('The compiler tools returned an unrelated reply.');
  }
  if (output.error === 'subject_too_large')
    throw new Error(
      'Canonical explanation accepts up to 4,096 Unicode scalars and 16 KiB of subject text.',
    );
  if (typeof output.error === 'string')
    throw new Error(
      'Compiler tools rejected the request (' + output.error + ').',
    );
  return output;
}

async function prepare() {
  if (adapter) return;
  if (!toolsIdentity.candidateSha256)
    throw new Error('The compiler tools are unavailable in this build.');
  const response = await fetch(toolsPath, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok)
    throw new Error('The compiler tools WebAssembly asset is unavailable.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.length > 8_388_608 ||
    (await sha256(bytes)) !== toolsIdentity.candidateSha256
  ) {
    throw new Error(
      'The compiler tools WebAssembly asset failed its integrity check.',
    );
  }
  const module = await WebAssembly.compile(bytes);
  const imports = WebAssembly.Module.imports(module);
  if (
    imports.length !== 1 ||
    imports[0]?.module !== 'strling_lab' ||
    imports[0].name !== 'monotonic_milliseconds' ||
    imports[0].kind !== 'function'
  ) {
    throw new Error(
      'The compiler tools WebAssembly asset requested an unexpected host capability.',
    );
  }
  const instance = await WebAssembly.instantiate(module, {
    strling_lab: { monotonic_milliseconds: () => performance.now() },
  });
  adapter = instance.exports as unknown as ToolsExports;
  const info = jsonObject(invoke({ operation: 'describe' }).result);
  if (
    info?.adapter_version !== toolsIdentity.version ||
    info.compiler_base_revision !== toolsIdentity.baseRevision ||
    JSON.stringify(info.operations) !== '["format","convert","explain"]' ||
    info.max_request_bytes !== maxBytes ||
    info.max_response_bytes !== maxBytes ||
    info.max_json_depth !== 272
  ) {
    throw new Error(
      'The compiler tools WebAssembly identity does not match this build.',
    );
  }
}

serveWorker<
  {
    request: ToolRequest;
    expectedTarget?: import('@strling-lang/strling').JsonObject;
  },
  ToolOutput
>(prepare, async ({ request, expectedTarget }) => {
  const result = verifiedToolResult(invoke(request), request);
  if (request.operation === 'explain') {
    const target = jsonObject(result.target);
    if (
      expectedTarget
        ? !sameProfileReference(
            jsonObject(target?.target_profile),
            expectedTarget,
          )
        : target !== undefined
    ) {
      throw new Error(
        'The compiler explanation does not belong to the selected target.',
      );
    }
    const bytes = encoder.encode(request.subject);
    const subject = jsonObject(result.subject);
    if (
      subject?.sha256 !== (await sha256(bytes)) ||
      subject.utf8_bytes !== bytes.length ||
      subject.unicode_scalars !== [...request.subject].length
    ) {
      throw new Error(
        'The compiler explanation does not belong to the current subject.',
      );
    }
  }
  return { identity: toolsIdentity, operation: request.operation, result };
});
