import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const directory = '_strling-lab/';
const filename = 'compiler-tools-0.1.0-rc.3.wasm';
const digest =
  '3da8047dbbc6402885634b4eb49475ad06cdf894c1eced13fee62b400e23cc81';

export function labCompilerTools(environment = process.env) {
  const path = environment.STRLING_LAB_TOOLS_CANDIDATE;
  if (!path) return { digest: '', integration: undefined };
  if (environment.NETLIFY === 'true') {
    throw new Error('The private Lab compiler adapter is for isolated builds.');
  }
  const providedDigest = environment.STRLING_LAB_TOOLS_SHA256;
  if (providedDigest !== undefined && providedDigest !== digest) {
    throw new Error('The configured Lab compiler digest differs from the pin.');
  }
  const bytes = readFileSync(path);
  if (
    bytes.length > 8_388_608 ||
    createHash('sha256').update(bytes).digest('hex') !== digest
  ) {
    throw new Error(
      'The configured Lab compiler candidate has the wrong size or digest.',
    );
  }
  return {
    digest,
    /** @type {import('astro').AstroIntegration} */
    integration: {
      name: 'strling-lab-compiler-tools-candidate',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const assets = new URL(directory, dir);
          await mkdir(assets, { recursive: true });
          await writeFile(new URL(filename, assets), bytes);
        },
        'astro:server:setup': ({ server }) => {
          server.middlewares.use(
            '/' + directory + filename,
            (_request, response) => {
              response.setHeader('Content-Type', 'application/wasm');
              response.end(bytes);
            },
          );
        },
      },
    },
  };
}
