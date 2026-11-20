/* global TextEncoder, TextDecoder, WebAssembly */
export const compilerToolsProtocol = 'strling.lab-compiler-tools@1.0.0-rc.1';
export const compilerToolsMemoryBytes = 67_108_864;
export const compilerToolsStackBytes = 2_097_152;
const maxBytes = 1_048_576;
const maxJsonDepth = 272;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * @param {Uint8Array<ArrayBuffer>} bytes
 * @param {{ protocol: string; version: string; baseRevision: string }} identity
 * @param {() => number} clock
 */
export async function openCompilerTools(bytes, identity, clock) {
  const module = await WebAssembly.compile(bytes);
  const [hostImport, ...otherImports] = WebAssembly.Module.imports(module);
  if (
    otherImports.length !== 0 ||
    hostImport?.module !== 'strling_lab' ||
    hostImport.name !== 'monotonic_milliseconds' ||
    hostImport.kind !== 'function'
  ) {
    throw new Error(
      'The compiler tools WebAssembly asset requested an unexpected host capability.',
    );
  }
  const { exports } = await WebAssembly.instantiate(module, {
    strling_lab: { monotonic_milliseconds: clock },
  });
  const {
    memory,
    strling_lab_input_v1: inputPointer,
    strling_lab_output_v1: outputPointer,
    strling_lab_run_v1: run,
  } = exports;
  if (
    !(memory instanceof WebAssembly.Memory) ||
    typeof inputPointer !== 'function' ||
    typeof outputPointer !== 'function' ||
    typeof run !== 'function'
  ) {
    throw new Error('The compiler tools WebAssembly ABI is incomplete.');
  }

  /** @param {{ operation: string }} request */
  function invoke(request) {
    const input = encoder.encode(
      JSON.stringify({ protocol: identity.protocol, request }),
    );
    if (input.length > maxBytes)
      throw new Error('The compiler tools input exceeds 1 MiB.');
    const start = inputPointer();
    new Uint8Array(memory.buffer, start, input.length).set(input);
    const length = run(input.length);
    if (length <= 0 || length > maxBytes)
      throw new Error('The compiler tools response exceeded its bounds.');
    const pointer = outputPointer();
    const reply = JSON.parse(
      decoder.decode(new Uint8Array(memory.buffer, pointer, length)),
    );
    if (
      reply?.protocol !== identity.protocol ||
      reply.operation !== request.operation
    ) {
      throw new Error('The compiler tools returned an unrelated reply.');
    }
    if (reply.error === 'subject_too_large')
      throw new Error(
        'Canonical explanation accepts up to 4,096 Unicode scalars and 16 KiB of subject text.',
      );
    if (typeof reply.error === 'string')
      throw new Error(
        'Compiler tools rejected the request (' + reply.error + ').',
      );
    return reply;
  }

  const descriptor = invoke({ operation: 'describe' }).result;
  if (
    descriptor?.adapter_version !== identity.version ||
    descriptor.compiler_base_revision !== identity.baseRevision ||
    JSON.stringify(descriptor.operations) !==
      '["format","convert","explain"]' ||
    descriptor.max_request_bytes !== maxBytes ||
    descriptor.max_response_bytes !== maxBytes ||
    descriptor.max_json_depth !== maxJsonDepth
  ) {
    throw new Error(
      'The compiler tools WebAssembly identity does not match this build.',
    );
  }
  return { invoke, memory };
}
