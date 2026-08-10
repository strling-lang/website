import { access, readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const dist = resolve('dist');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function candidates(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!clean) return [join(dist, 'index.html')];
  if (extname(clean)) return [join(dist, clean)];
  return [
    join(dist, clean, 'index.html'),
    join(dist, `${clean}.html`),
    join(dist, clean),
  ];
}

const htmlFiles = await walk(dist);
const broken = [];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/href=["']([^"']+)["']/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(href)) continue;
    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (id && !html.includes(`id="${id}"`))
        broken.push(`${file}: missing #${id}`);
      continue;
    }
    const target = new URL(href, 'https://local.test/');
    if (
      !(await Promise.all(candidates(target.pathname).map(exists))).some(
        Boolean,
      )
    )
      broken.push(`${file}: ${href}`);
  }
}

if (broken.length) {
  console.error(
    `Broken internal links (${broken.length}):\n${broken.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Internal link check passed across ${htmlFiles.length} HTML files.`,
  );
}
