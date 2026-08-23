import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const fromRoot = (path) => new URL(path, root);

test('required documentation and learning topics exist', async () => {
  const docs = (await readdir(fromRoot('src/content/docs/'))).filter((name) =>
    name.endsWith('.md'),
  );
  const learn = (await readdir(fromRoot('src/content/learn/'))).filter((name) =>
    name.endsWith('.md'),
  );
  assert.deepEqual(docs.sort(), [
    'anchors-and-boundaries.md',
    'character-sets.md',
    'compatibility.md',
    'composition.md',
    'core-concepts.md',
    'errors-and-diagnostics.md',
    'groups-and-captures.md',
    'literals-and-escaping.md',
    'lookarounds.md',
    'predefined-patterns.md',
    'quantifiers.md',
  ]);
  assert.deepEqual(learn.sort(), ['from-regex.md', 'quickstart.md', 'tour.md']);
});

test('binding data represents exactly the 17 authoritative source directories', async () => {
  const source = await readFile(fromRoot('src/data/bindings.ts'), 'utf8');
  const slugs = [...source.matchAll(/slug: '([^']+)'/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(slugs, [
    'c',
    'cpp',
    'csharp',
    'dart',
    'fsharp',
    'go',
    'java',
    'kotlin',
    'lua',
    'perl',
    'php',
    'python',
    'r',
    'ruby',
    'rust',
    'swift',
    'typescript',
  ]);
});

test('official logo stays remote with only favicon derivatives local', async () => {
  const siteData = await readFile(fromRoot('src/data/site.ts'), 'utf8');
  assert.match(
    siteData,
    /raw\.githubusercontent\.com\/strling-lang\/\.github\/refs\/heads\/main\/strling_silver_bell\.png/,
  );

  const imageExtensions = /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i;
  async function findImages(path) {
    const entries = await readdir(path);
    const found = [];
    for (const entry of entries) {
      const full = new URL(entry, path);
      const info = await stat(full);
      if (info.isDirectory())
        found.push(...(await findImages(new URL(`${entry}/`, path))));
      else if (imageExtensions.test(entry)) found.push(full.pathname);
    }
    return found;
  }
  assert.deepEqual(await findImages(fromRoot('src/')), []);
  const publicImages = await findImages(fromRoot('public/'));
  assert.deepEqual(publicImages.map((path) => path.split('/').at(-1)).sort(), [
    'favicon-32x32.png',
    'favicon.ico',
  ]);
});

test('primary navigation contains only real routes', async () => {
  const navigation = await readFile(fromRoot('src/data/navigation.ts'), 'utf8');
  const primaryBlock = navigation.slice(
    navigation.indexOf('primaryNavigation'),
    navigation.indexOf('docsNavigation'),
  );
  assert.equal(primaryBlock.includes("href: '#"), false);
  for (const route of [
    '/learn/',
    '/packages/',
    '/fourth-edition/',
    '/why-strling/',
  ])
    assert.ok(primaryBlock.includes(route));
  assert.ok(primaryBlock.includes('surfaces.strlingDocs'));
  assert.ok(primaryBlock.includes('surfaces.strlingLab'));

  assert.ok(navigation.includes('regexSurfaces.map'));
});

test('major product surfaces have centralized routes and availability', async () => {
  const source = await readFile(fromRoot('src/data/surfaces.ts'), 'utf8');
  for (const route of [
    '/docs/',
    '/lab/',
    '/regex/docs/',
    '/regex/lab/',
    '/regex/compatibility/',
  ])
    assert.ok(source.includes(`route: '${route}'`));

  assert.match(source, /strlingDocs:[\s\S]*status: 'available'/);
  assert.match(source, /regexDocs:[\s\S]*status: 'available'/);
  assert.equal([...source.matchAll(/status: 'coming-soon'/g)].length, 3);
});
