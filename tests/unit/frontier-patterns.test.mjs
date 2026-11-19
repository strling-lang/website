import assert from 'node:assert/strict';
import test from 'node:test';
import {
  H1,
  H2,
  reverseComplement,
  validate,
  statistics,
} from '../../public/examples/frontier/motif-model.ts';
import {
  compileModel,
  moduleAtDepth,
} from '../../public/examples/frontier/motif-patterns.ts';
import { fixtures as x } from '../../public/examples/frontier/motif-fixtures.ts';
import {
  recognize,
  witnesses,
} from '../../public/examples/frontier/motif-witness.ts';
import { scan } from '../../public/examples/frontier/motif-scan.ts';

const revisions = await Promise.all([compileModel(H1), compileModel(H2)]);
function verifyTree(text, node, minus = false) {
  const slice = text.slice(node.start, node.end);
  assert.equal(node.text, minus ? reverseComplement(slice) : slice);
  const children = node.children;
  if (!children.length) return;
  assert.equal(children.map((c) => c.text).join(''), node.text);
  let cursor = minus ? node.end : node.start;
  for (const c of children) {
    assert.equal(minus ? c.end : c.start, cursor);
    cursor = minus ? c.start : c.end;
    verifyTree(text, c, minus);
  }
  assert.equal(cursor, minus ? node.start : node.end);
}
function check(input, matchers, expected) {
  const hits = [];
  for (const m of matchers) {
    const trees = witnesses(input, m);
    assert.equal(m.regex.test(input), trees.length > 0);
    assert.deepEqual(recognize(input, m), trees);
    for (const tree of trees) {
      verifyTree(input, tree);
      hits.push(m.family + m.depth);
    }
  }
  assert.deepEqual(hits, expected);
}
test('compiled artifacts and independent witnesses agree for both revisions', () => {
  for (const ms of revisions) {
    const h2 = ms[0].model === H2;
    assert.equal(ms.length, 6);
    for (const [id, input] of Object.entries(x)) {
      const accepted = {
        minimalAlpha: ['Alpha0'],
        deepAlpha: ['Alpha3'],
        nestedBeta: ['Beta2'],
        revised: h2 ? ['Alpha3'] : [],
      };
      check(input, ms, accepted[id] ?? []);
    }
    for (const input of [
      '',
      x.deepAlpha + '\n',
      'A' + x.deepAlpha,
      x.deepAlpha + 'A',
      x.deepAlpha.toLowerCase(),
      x.deepAlpha.replace('GCA', 'GNA'),
      x.deepAlpha.replace('GCA', 'GGA'),
    ])
      check(input, ms, []);
    const alpha = ms.filter((m) => m.family === 'Alpha'),
      deep = alpha[3];
    assert.deepEqual(
      alpha.map((m) => m.count),
      h2 ? [2, 16, 352, 126016] : [2, 12, 192, 37632],
    );
    assert.equal(
      alpha.reduce((n, m) => n + m.count, 0),
      h2 ? 126386 : 37838,
    );
    assert.deepEqual(
      [deep.steps, deep.regex.source.length],
      [h2 ? 8053 : 3377, h2 ? 24491 : 10171],
    );
    assert.equal(deep.max, 119);
    assert.equal(ms.at(-1).max, 37);
    assert.deepEqual(
      { ...deep.regex.exec(x.deepAlpha).groups },
      {
        leftContext: 'TTAAAT',
        motif: x.deepAlpha.slice(6, 53),
        rightContext: 'TAGGCC',
      },
    );
    for (const [family, d, window, inner] of [
      ['Alpha', 0, x.minimalAlpha, [6, 11]],
      ['Beta', 2, x.nestedBeta, [5, 28]],
    ]) {
      const m = ms.find((m) => m.family === family && m.depth === d);
      const motif = recognize(window, m)[0].children[1];
      assert.deepEqual([motif.start, motif.end], inner);
    }
    const spans = [];
    function visit(n) {
      if (n.depth !== undefined) spans.push([n.rule, n.start, n.end]);
      n.children.forEach(visit);
    }
    visit(recognize(x.deepAlpha, deep)[0]);
    assert.deepEqual(spans, [
      ['pair.amber', 6, 53],
      ['join.tandem', 11, 48],
      ['pair.amber', 14, 27],
      ['seed.a', 18, 23],
      ['pair.indigo', 30, 45],
      ['seed.b', 35, 40],
    ]);
  }
});
test('vary lexical choices, context bounds, sibling structures and inner H2 spacers', () => {
  for (const ms of revisions) {
    for (const seed of ['ACGAT', 'ACGGT', 'TTCCA', 'TTCTA']) {
      for (const gap of ['A', 'AT']) {
        for (const [a, b] of [
          ['GCA', 'TGC'],
          ['CAG', 'CTG'],
        ]) {
          const child = a + gap + seed + 'T'.repeat(gap.length) + b;
          for (const left of ['AT', 'TATA'])
            for (const right of ['TT', 'ATTA']) {
              const context = (m) => 'TTAA' + left + m + right + 'GGCC';
              check(context(child), ms, ['Alpha1']);
              check(
                context(
                  'GGT' +
                    child +
                    'CCA' +
                    'GGT' +
                    seed +
                    'CCA' +
                    seed +
                    'ACC' +
                    'ACC',
                ),
                ms,
                ['Alpha2'],
              );
              check(context(child.slice(0, -3) + 'A' + b), ms, []);
            }
          if (seed.startsWith('TTC') && a === 'CAG')
            for (const gap of ['A', 'AT'])
              check('GGAA' + gap + child + 'T' + 'TTCC', ms, ['Beta1']);
        }
      }
    }
    const inner = 'CAGAAATTCCATTTCTG';
    check(
      'TTAAATGCAA' + inner + 'TTGCTTGGCC',
      ms,
      ms[0].model === H2 ? ['Alpha2'] : [],
    );
    check('GGAAA' + inner + 'TTTCC', ms, []);
  }
});
test('scan projects all leaves and keeps overlapping strand observations', () => {
  const ms = revisions[0];
  for (const [input, strand] of [
    ['CCG' + x.deepAlpha + 'GGA', '+'],
    [x.reverse, '-'],
  ]) {
    const hits = scan(input, ms, true);
    assert.equal(hits.length, 1);
    const hit = hits[0];
    assert.equal(hit.strand, strand);
    assert.deepEqual(hit.window, [3, 62]);
    assert.deepEqual(hit.motif, [9, 56]);
    verifyTree(input, hit.witnesses[0], strand === '-');
  }
  assert.deepEqual(
    scan(x.deepAlpha + 'A', ms).map((h) => h.window),
    [[0, 59]],
  );
  const overlap = x.minimalAlpha + reverseComplement(x.minimalAlpha).slice(4);
  assert.deepEqual(
    scan(overlap, ms, true).map((h) => [h.strand, h.window]),
    [
      ['+', [0, 17]],
      ['-', [13, 30]],
    ],
  );
  for (const invalid of ['N', 't', 'A\n', 'A T', 'A'.repeat(257)])
    assert.throws(() => scan(invalid, ms));
  assert.deepEqual(scan('', ms), []);
});
test('model validation precedes expansion', () => {
  for (const change of [
    { seeds: [] },
    { pairs: ['missing'] },
    { roots: [4] },
    { lengths: [0] },
    { lengths: [4] },
    { external: [4, 2] },
    { external: [1, Infinity] },
  ])
    assert.throws(() =>
      validate({
        ...H1,
        families: {
          ...H1.families,
          Alpha: { ...H1.families.Alpha, ...change },
        },
      }),
    );
  assert.throws(() =>
    validate({
      ...H1,
      pairs: { ...H1.pairs, amber: { open: 'GCA', close: 'CTG' } },
    }),
  );
  for (const depth of [-1, 0.5, 4, Infinity]) {
    assert.throws(() => moduleAtDepth(H1, H1.families.Alpha, depth));
    assert.throws(() => statistics(H1, H1.families.Alpha, depth));
  }
  assert.equal(H2.families.Beta, H1.families.Beta);
});

test('one engine capture tuple preserves all explanations and distinct endpoints', async () => {
  // Use a deliberately ambiguous vocabulary to exercise reporting, independent of H1/H2 results.
  const seed = { prefix: 'A', letters: 'A', suffix: 'A' };
  const model = {
    ...H1,
    seeds: { a: seed, b: seed },
    families: {
      ...H1.families,
      Alpha: { ...H1.families.Alpha, roots: [0], left: 'A', right: 'A' },
    },
  };
  const matchers = await compileModel(model);
  const input = 'A'.repeat(12);
  const hits = scan(input, matchers).filter((h) => h.window[0] === 0);
  assert.deepEqual([...new Set(hits.map((h) => h.window[1]))], [9, 10, 11, 12]);
  const longest = hits.filter((h) => h.window[1] === 12);
  assert.deepEqual(
    longest.map((h) => h.motif),
    [
      [4, 7],
      [5, 8],
    ],
  );
  for (const hit of longest)
    assert.deepEqual(
      hit.witnesses.map((w) => w.children[1].rule),
      ['seed.a', 'seed.b'],
    );
});

test('published examples and measurements agree with runnable source', async () => {
  const { readFile } = await import('node:fs/promises');
  const article = await readFile(
    new URL(
      '../../src/content/learn/nested-sequence-hypotheses.md',
      import.meta.url,
    ),
    'utf8',
  );
  const source = await readFile(
    new URL(
      '../../public/examples/frontier/motif-patterns.ts',
      import.meta.url,
    ),
    'utf8',
  );
  for (const text of [
    x.deepAlpha,
    x.revised,
    x.reverse,
    x.minimalAlpha,
    x.nestedBeta,
    x.deepAlpha.slice(6, 53),
  ])
    assert.ok(article.includes(text));
  const factory = source
    .slice(
      source.indexOf('export function moduleAtDepth'),
      source.indexOf('export async function compileModel'),
    )
    .trim();
  assert.ok(
    article.replaceAll('\r\n', '\n').includes(factory.replaceAll('\r\n', '\n')),
  );
  for (const ms of revisions) {
    const deep = ms.find((m) => m.family === 'Alpha' && m.depth === 3);
    for (const count of [deep.steps, deep.regex.source.length, deep.count])
      assert.ok(article.includes(count.toLocaleString('en-US')));
  }
});
