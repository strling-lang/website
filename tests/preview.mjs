import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { preview } from 'astro';

const host = '127.0.0.1';
const port = Number(process.env.STRLING_WEBSITE_PREVIEW_PORT ?? 4321);
const output = process.env.STRLING_WEBSITE_PREVIEW_OUT_DIR;
const cert = process.env.STRLING_WEBSITE_PREVIEW_CERT;
const key = process.env.STRLING_WEBSITE_PREVIEW_KEY;

if (cert && key) {
  const root = resolve(output ?? 'dist');
  const hosting = await readFile(
    new URL('../netlify.toml', import.meta.url),
    'utf8',
  );
  const csp = hosting.match(/Content-Security-Policy = "([^"]+)"/)?.[1];
  const cache = hosting.match(/Cache-Control = "([^"]+)"/)?.[1];
  if (!csp || !cache)
    throw new Error('The static hosting headers are required.');
  const types = {
    '.css': 'text/css',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.mjs': 'application/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
  };
  const server = createServer(
    {
      cert: await readFile(cert),
      key: await readFile(key),
    },
    async (request, response) => {
      const headers = {
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
      };
      try {
        const path = decodeURIComponent(
          new URL(request.url, 'https://' + host).pathname,
        );
        let file = resolve(root, '.' + path);
        if (file !== root && !file.startsWith(root + sep)) {
          response.writeHead(404, headers).end();
          return;
        }
        if ((await stat(file)).isDirectory())
          file = resolve(file, 'index.html');
        const body = await readFile(file);
        response
          .writeHead(200, {
            ...headers,
            'Content-Type': types[extname(file)] ?? 'application/octet-stream',
            'Content-Length': body.length,
            ...(path.startsWith('/_astro/') || path.startsWith('/_strling-lab/')
              ? { 'Cache-Control': cache }
              : {}),
          })
          .end(request.method === 'HEAD' ? undefined : body);
      } catch {
        const fallback = await readFile(resolve(root, '404.html')).catch(
          () => undefined,
        );
        response
          .writeHead(404, {
            ...headers,
            'Content-Type': 'text/html; charset=utf-8',
          })
          .end(request.method === 'HEAD' ? undefined : fallback);
      }
    },
  );
  server.listen(port, host);
} else {
  await preview({ outDir: output, server: { host, port } });
}
