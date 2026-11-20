import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { TextDecoder } from 'node:util';
import {
  compilerToolsMemoryBytes,
  compilerToolsProtocol,
  compilerToolsStackBytes,
  openCompilerTools,
} from '../src/lib/regex-lab/compiler-tools-abi.mjs';
import release from './lab-compiler-release.json' with { type: 'json' };

const compilerRepository = 'strling-lang/strling';
const releaseOrigin = 'https://github.com/' + compilerRepository;
const apiOrigin = 'https://api.github.com/repos/' + compilerRepository;
const deliveryPrefix = '/github-production-release-asset/832885277/';
const memoryPageSize = 65_536;
const maxAssetSize = 8_388_608;
const sha40 = /^[a-f0-9]{40}$/;
const sha64 = /^[a-f0-9]{64}$/;
const candidate = {
  protocol: compilerToolsProtocol,
  version: '0.1.0-rc.3',
  baseRevision: '4e58730bbf67eaff683268e285e7084ccda5fadd',
  sourceRevision: '156a0b54186e1d457fd47696d9f088e2c8b23360',
  sha256: '3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81',
  size: 2_548_656,
};
const sealed = {
  ...candidate,
  version: '',
  sha256: '',
  size: 0,
  sourceRevision: '',
  baseRevision: '',
};

/** @param {Uint8Array} bytes */
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * @param {Response} response
 * @param {number} limit
 */
async function readBounded(response, limit) {
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    throw new Error(
      'The compiler tools release asset or metadata is unavailable.',
    );
  }
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) > limit) {
    await response.body.cancel();
    throw new Error('The compiler tools release exceeds its size limit.');
  }
  const buffer = new Uint8Array(limit);
  const stream = response.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) return buffer.subarray(0, offset);
      if (offset + value.length > limit)
        throw new Error('The compiler tools release exceeds its size limit.');
      buffer.set(value, offset);
      offset += value.length;
    }
  } finally {
    await stream.cancel();
    stream.releaseLock();
  }
}

/**
 * @param {typeof candidate} identity
 * @param {Uint8Array<ArrayBuffer>} bytes
 */
async function verifyAsset(identity, bytes) {
  if (bytes.length !== identity.size || digest(bytes) !== identity.sha256)
    throw new Error(
      'The configured Lab compiler artifact has the wrong size or digest.',
    );

  const { memory } = await openCompilerTools(bytes, identity, () =>
    performance.now(),
  );
  const maximumPages = compilerToolsMemoryBytes / memoryPageSize;
  memory.grow(maximumPages - memory.buffer.byteLength / memoryPageSize);
  try {
    memory.grow(1);
  } catch (error) {
    if (error instanceof RangeError) return;
    throw error;
  }
  throw new Error(
    'The compiler tools WebAssembly memory limit does not match this build.',
  );
}

/**
 * The source-controlled manifest is the website's admission boundary. It is
 * filled in only after independent public and signed closure verification.
 * @param {unknown} manifest
 */
function shippingRelease(manifest) {
  const input = /** @type {Partial<{
    schemaVersion: number;
    mode: string;
    artifact: typeof candidate & {
      url: string;
      sealedCompilerVersion: string;
      certifiedClosureSha256: string;
      memoryBytes: number;
      stackBytes: number;
    };
  }>} */ (manifest);
  if (
    input?.schemaVersion === 1 &&
    input.mode === 'sealed' &&
    !('artifact' in input)
  )
    return undefined;
  const artifact = input?.artifact;
  if (
    input?.schemaVersion !== 1 ||
    input.mode !== 'certified' ||
    !artifact ||
    typeof artifact.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:[.-][a-z0-9]+)*)?$/.test(
      artifact.version,
    ) ||
    artifact.version === candidate.version ||
    artifact.protocol !== compilerToolsProtocol ||
    ![artifact.sourceRevision, artifact.baseRevision].every(
      (sha) => typeof sha === 'string' && sha40.test(sha),
    ) ||
    ![artifact.sha256, artifact.certifiedClosureSha256].every(
      (sha) => typeof sha === 'string' && sha64.test(sha),
    ) ||
    artifact.sha256 === candidate.sha256 ||
    artifact.sealedCompilerVersion !== '4.0.3' ||
    !Number.isSafeInteger(artifact.size) ||
    artifact.size <= 0 ||
    artifact.size > maxAssetSize ||
    artifact.memoryBytes !== compilerToolsMemoryBytes ||
    artifact.stackBytes !== compilerToolsStackBytes
  ) {
    throw new Error(
      'A complete, approved compiler tools release manifest is required.',
    );
  }
  const tag = 'lab-wasm-v' + artifact.version;
  const name = 'strling_lab_wasm.wasm';
  const url = releaseOrigin + '/releases/download/' + tag + '/' + name;
  if (artifact.url !== url)
    throw new Error(
      'The compiler tools release URL is outside the approved release coordinate.',
    );
  return { artifact, tag, name };
}

/**
 * @param {NonNullable<ReturnType<typeof shippingRelease>>} approved
 * @param {typeof fetch} fetchRelease
 */
async function fetchApprovedRelease({ artifact, tag, name }, fetchRelease) {
  const transport = {
    cache: 'no-store',
    credentials: 'omit',
    signal: globalThis.AbortSignal.timeout(30_000),
  };
  /** @param {string} url */
  async function metadata(url) {
    const response = await fetchRelease(url, {
      ...transport,
      redirect: 'error',
      headers: { Accept: 'application/vnd.github+json' },
    });
    return JSON.parse(
      new TextDecoder().decode(await readBounded(response, 131_072)),
    );
  }
  const [published, commit] = await Promise.all([
    metadata(apiOrigin + '/releases/tags/' + tag),
    metadata(apiOrigin + '/commits/' + tag),
  ]);
  const asset = Array.isArray(published?.assets)
    ? published.assets.find((entry) => entry?.name === name)
    : undefined;
  if (
    published?.immutable !== true ||
    published.draft !== false ||
    published.tag_name !== tag ||
    commit?.sha !== artifact.sourceRevision ||
    asset?.browser_download_url !== artifact.url ||
    asset.size !== artifact.size ||
    asset.digest !== 'sha256:' + artifact.sha256 ||
    asset.state !== 'uploaded'
  )
    throw new Error(
      'The published compiler tools release does not match its approved identity.',
    );

  let response = await fetchRelease(artifact.url, {
    ...transport,
    redirect: 'manual',
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    await response.body?.cancel();
    const next = location ? new URL(location) : undefined;
    if (
      next?.origin !== 'https://release-assets.githubusercontent.com' ||
      next.username ||
      next.password ||
      next.hash ||
      !next.pathname.startsWith(deliveryPrefix) ||
      !/^[a-z0-9-]+$/.test(next.pathname.slice(deliveryPrefix.length))
    )
      throw new Error(
        'The compiler tools asset returned an unauthorized redirect.',
      );
    response = await fetchRelease(next.href, {
      ...transport,
      redirect: 'error',
    });
  }
  return readBounded(response, artifact.size);
}

/**
 * @param {NodeJS.ProcessEnv} environment
 * @param {unknown} manifest
 * @param {typeof fetch} fetchRelease
 */
export async function labCompilerTools(
  environment = process.env,
  manifest = release,
  fetchRelease = globalThis.fetch,
) {
  const path = environment.STRLING_LAB_TOOLS_CANDIDATE;
  const approved = shippingRelease(manifest);
  if (path && (approved || environment.NETLIFY === 'true'))
    throw new Error(
      'A private Lab compiler adapter is only allowed in isolated builds.',
    );
  if (!path && !approved) return { identity: sealed, integration: undefined };

  let identity = candidate;
  let bytes;
  if (approved) {
    const { version, protocol, sourceRevision, baseRevision, size, sha256 } =
      approved.artifact;
    identity = {
      version,
      protocol,
      sourceRevision,
      baseRevision,
      size,
      sha256,
    };
    bytes = await fetchApprovedRelease(approved, fetchRelease);
  } else {
    const expected = environment.STRLING_LAB_TOOLS_SHA256;
    if (expected !== undefined && expected !== candidate.sha256)
      throw new Error(
        'The configured Lab compiler digest differs from the pin.',
      );
    bytes = await readFile(/** @type {string} */ (path));
  }
  await verifyAsset(identity, bytes);

  const filename =
    'compiler-tools-' + identity.version + '-' + identity.sha256 + '.wasm';
  const staticPath = '_strling-lab/' + filename;
  return {
    identity,
    path: '/' + staticPath,
    /** @type {import('astro').AstroIntegration} */
    integration: {
      name: 'strling-lab-compiler-tools',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          await mkdir(new URL('_strling-lab/', dir), { recursive: true });
          await writeFile(new URL(staticPath, dir), bytes);
        },
        'astro:server:setup': ({ server }) => {
          server.middlewares.use('/' + staticPath, (_request, response) => {
            response.setHeader('Content-Type', 'application/wasm');
            response.end(bytes);
          });
        },
      },
    },
  };
}
