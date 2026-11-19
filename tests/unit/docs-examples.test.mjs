import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { Compiler, sourceCompileRequest } from '@strling-lang/strling';
import { loadBundledWasm } from '@strling-lang/strling/node';
import * as s from '@strling-lang/strling/simply';
import {
  compileProjection,
  loadPatternCompiler,
} from '../../public/examples/pattern-engineering/compiler.ts';

const path = (name) => new URL('../../' + name, import.meta.url);
const read = (name) => readFile(path(name), 'utf8');
const compilePattern = await loadPatternCompiler();

test('current reference fragments execute with their published results', async () => {
  const names = (await readdir(path('src/content/docs/')))
    .filter((name) => name.endsWith('.md'))
    .map((name) => 'docs/' + name);
  names.push('learn/from-regex.md');
  let executed = 0;
  for (const name of names) {
    const doc = await read('src/content/' + name);
    for (const [, fragment] of doc.matchAll(
      /^```typescript\r?\n([\s\S]+?)^```/gm,
    )) {
      if (name === 'docs/core-concepts.md' && fragment.startsWith('import '))
        continue;
      const expected = Array.from(
        fragment.matchAll(/console\.log\(.+\); \/\/ (.+)\r?$/gm),
        ([, value]) => value.trim(),
      );
      const actual = [];
      assert.ok(expected.length, name);
      runInNewContext(
        fragment,
        {
          s,
          compilePattern,
          console: { log: (result) => actual.push(String(result)) },
        },
        { filename: name, timeout: 3000 },
      );
      assert.deepEqual(actual, expected, name);
      executed++;
    }
  }
  assert.equal(executed, 10);
});

test('published page comparisons display the exact ECMAScript expression and flags', async () => {
  for (const page of ['index', 'why-strling']) {
    const source = await read('src/pages/' + page + '.astro');
    const code = source
      .match(/const (?:phoneCode|composition) = \x60([\s\S]+?)\x60;/)[1]
      .replace(/^import .+\r?\n/, '');
    const expected = source.match(
      /result=\{String\.raw\x60([^\x60]+)\x60\}/,
    )[1];
    const regex = runInNewContext(
      code + '\ncompilePattern(phone)',
      { s, compilePattern },
      { filename: page, timeout: 3000 },
    );
    assert.equal(String(regex), expected, page);
  }
});

test('textual frontend source example compiles and malformed input fails before emission', async () => {
  const doc = await read('src/content/docs/core-concepts.md');
  const source = doc.match(/^```text\r?\n([\s\S]+?)^```/m)[1];
  const compiler = new Compiler(await loadBundledWasm());
  const result = compiler.compile(sourceCompileRequest(source));
  assert.equal(result.outcome, 'succeeded');
  assert.equal(result.specification_version, '1.0-draft.1');
  assert.equal(result.semantic_result.program.case_matching, 'sensitive');
  assert.equal(result.artifact, undefined);
  const malformed = compiler.compile(
    sourceCompileRequest(source.replace('pattern text', 'pattern bogus')),
  );
  assert.notEqual(malformed.outcome, 'succeeded');
  assert.ok(
    malformed.diagnostics.some((diagnostic) =>
      diagnostic.code.startsWith('STRL-DSL-'),
    ),
  );
  assert.equal(malformed.artifact, undefined);
});

test('current facade separates strict positions, Unicode classes and unbounded wire counts', () => {
  const word = s.merge(s.start(), s.digit().rep(1, 0), s.end());
  const request = word.buildRequest(compileProjection);
  assert.equal(request.protocol_version, '1.1.0');
  const repeated = request.steps.find((step) => step.operation === 'repeat');
  assert.equal(repeated.arguments.max, null);
  assert.equal(compilePattern(word).test('４２'), true);
  assert.equal(compilePattern(word).test('42\n'), false);
});

test('complete Advanced lesson runners print the advertised fixture results', async () => {
  const fixtures = {
    'production-event-logs': '2026-11-18T21:34:05Z INFO 4A92D61F 19',
    'versioned-api-routes': 'getEvent PRJ-0042 EVT-1907',
    'policy-driven-import-records': 'TRANSFER acct-7351 50000',
  };
  for (const [slug, expected] of Object.entries(fixtures)) {
    const doc = await read('src/content/learn/' + slug + '.md');
    const [, runner] = doc.match(
      /^\x60{3}typescript\r?\n(import \{[\s\S]+?)^\x60{3}/m,
    );
    const executable = runner.replace(
      /^import \{([\s\S]*?)\} from '\.\/([a-z-]+\.ts)';$/gm,
      (_, imports, file) =>
        'const {' +
        imports +
        '} = await import(' +
        JSON.stringify(
          path('public/examples/pattern-engineering/' + file).href,
        ) +
        ');',
    );
    const messages = [];
    const run = new Function(
      'console',
      'return (async () => {' + executable + '\n})();',
    );
    await run({ log: (...parts) => messages.push(parts.join(' ')) });
    assert.equal(messages.at(-1), expected, slug);
    assert.ok(doc.includes(expected), slug);
  }
});
