import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pyodide from 'pyodide/package.json' with { type: 'json' };
import pyodide311 from 'pyodide311/package.json' with { type: 'json' };
import rehypeAccessibleTables from './src/utils/rehypeAccessibleTables.ts';
import { labCompilerTools } from './scripts/lab-compiler-tools.mjs';

const fallbackSite = 'https://strling-lang.netlify.app';
const compilerTools = labCompilerTools();

/** @type {import('vite').Plugin} */
const legacyPyodideDevBridge = {
  name: 'lab-legacy-pyodide-dev-bridge',
  configureServer(server) {
    const glue = readFileSync(
      new URL(import.meta.resolve('pyodide311/pyodide.asm.js')),
      'utf8',
    );
    // Vite serves worker source as ESM in development.
    const loader = readFileSync(
      new URL(import.meta.resolve('pyodide311/pyodide.mjs')),
      'utf8',
    );
    /** @param {string} route @param {string} source */
    const serveScript = (route, source) => {
      server.middlewares.use(route, (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.end(source);
      });
    };
    serveScript(
      '/__lab/pyodide311-bridge.mjs',
      glue + '\nglobalThis._createPyodideModule = _createPyodideModule;\n',
    );
    serveScript('/__lab/pyodide311-loader.mjs', loader);
  },
};

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? fallbackSite,
  output: 'static',
  integrations: compilerTools.integration ? [compilerTools.integration] : [],
  trailingSlash: 'always',
  markdown: {
    processor: unified({ rehypePlugins: [rehypeAccessibleTables] }),
    shikiConfig: { theme: 'github-dark-default', wrap: false },
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_LAB_TOOLS_CANDIDATE_SHA256': JSON.stringify(
        compilerTools.digest,
      ),
    },
    plugins: [legacyPyodideDevBridge],
    worker: {
      rollupOptions: {
        output: {
          assetFileNames: (asset) => {
            if (!asset.names.includes('pyodide.asm.wasm'))
              return '_astro/[name]-[hash][extname]';
            const legacy = asset.originalFileNames.some((name) =>
              name.replaceAll('\\', '/').includes('/pyodide311/'),
            );
            return (
              '_astro/pyodide-' +
              (legacy ? pyodide311.version : pyodide.version) +
              '/pyodide.asm.wasm'
            );
          },
        },
      },
    },
    resolve: {
      alias: [
        {
          find: 'picomatch',
          replacement: fileURLToPath(
            new URL('./scripts/picomatch-esm-bridge.mjs', import.meta.url),
          ),
        },
        {
          // Astro content sync evaluates this dependency as an ES module.
          find: /^yaml$/,
          replacement: fileURLToPath(
            new URL('../browser/index.js', import.meta.resolve('yaml')),
          ),
        },
      ],
    },
  },
});
