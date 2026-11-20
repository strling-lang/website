import { jsonObject } from './compiler';
import { openCompilerTools } from './compiler-tools-abi.mjs';
import {
  toolsIdentity,
  toolsPath,
  verifiedToolResult,
  type ToolOutput,
  type ToolRequest,
} from './compiler-tools';
import { serveWorker } from './worker-client';
import { sameProfileReference } from './profile-binding.ts';

const encoder = new TextEncoder();
let adapter: Awaited<ReturnType<typeof openCompilerTools>> | undefined;

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function prepare() {
  if (adapter) return;
  if (!toolsIdentity.sha256)
    throw new Error('The compiler tools are unavailable in this build.');
  const response = await fetch(toolsPath, {
    cache: 'no-store',
    credentials: 'same-origin',
    redirect: 'error',
  });
  if (!response.ok || !response.body)
    throw new Error('The compiler tools WebAssembly asset is unavailable.');
  const bytes = new Uint8Array(toolsIdentity.size);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes.length) {
        throw new Error(
          'The compiler tools WebAssembly asset failed its integrity check.',
        );
      }
      bytes.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (
    bytes.length !== offset ||
    (await sha256(bytes)) !== toolsIdentity.sha256
  ) {
    throw new Error(
      'The compiler tools WebAssembly asset failed its integrity check.',
    );
  }
  adapter = await openCompilerTools(bytes, toolsIdentity, () =>
    performance.now(),
  );
}

serveWorker<
  {
    request: ToolRequest;
    expectedTarget?: import('@strling-lang/strling').JsonObject;
  },
  ToolOutput
>(prepare, async ({ request, expectedTarget }) => {
  if (!adapter)
    throw new Error('The compiler tools are unavailable in this worker.');
  const reply = jsonObject(adapter.invoke(request));
  if (!reply)
    throw new Error('The compiler tools returned an unrelated reply.');
  const result = verifiedToolResult(reply, request);
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
