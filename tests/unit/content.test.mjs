import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const fromRoot = (path) => new URL(path, root);
const lessons = [
  ['quickstart', 1, '10 minutes', 'beginner'],
  ['from-regex', 2, '15 minutes', 'beginner'],
  ['tour', 3, '25 minutes', 'beginner'],
  ['production-event-logs', 4, '30 minutes', 'advanced'],
  ['versioned-api-routes', 5, '35 minutes', 'advanced'],
  ['policy-driven-import-records', 6, '40 minutes', 'advanced'],
  ['nested-sequence-hypotheses', 7, '60 minutes', 'frontier'],
];

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
  assert.deepEqual(learn.sort(), lessons.map(([slug]) => `${slug}.md`).sort());
});

test('Learn pages define seven explicitly classified lessons in order', async () => {
  const orders = new Set();
  for (const [slug, order, time, difficulty] of lessons) {
    const source = await readFile(
      fromRoot(`src/content/learn/${slug}.md`),
      'utf8',
    );
    const frontmatter = source.split(/^---\s*$/m)[1];
    assert.ok(frontmatter, slug);
    const actualOrder = Number(frontmatter.match(/^order:\s+(\d+)$/m)?.[1]);
    assert.equal(actualOrder, order, slug);
    assert.ok(
      !orders.has(actualOrder),
      `${slug} repeats lesson order ${actualOrder}`,
    );
    orders.add(actualOrder);
    assert.ok(frontmatter.includes(`time: '${time}'`), slug);
    assert.match(frontmatter, new RegExp(`^difficulty: ${difficulty}$`, 'm'));
    for (const field of [
      'title',
      'description',
      'summary',
      'keywords',
      'related',
    ]) {
      assert.match(frontmatter, new RegExp(`^${field}:\\s+\\S`, 'm'));
    }
  }
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
  for (const route of ['/learn/', '/packages/', '/why-strling/'])
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
  assert.equal([...source.matchAll(/status: 'coming-soon'/g)].length, 1);
});
