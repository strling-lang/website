import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const directory = '_strling-lab/';
const filename = 'compiler-tools-0.1.0-rc.1.wasm';

export function labCompilerTools() {
  const path = process.env.STRLING_LAB_TOOLS_CANDIDATE;
  if (!path) return { digest: '', integration: undefined };
  const digest = process.env.STRLING_LAB_TOOLS_SHA256;
  if (!digest || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(
      'Set STRLING_LAB_TOOLS_SHA256 to the exact candidate digest.',
    );
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
