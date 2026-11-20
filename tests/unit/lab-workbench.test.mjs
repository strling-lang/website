import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { loadBundledWasm } from '@strling-lang/strling/node';

import { labCompilerTools } from '../../scripts/lab-compiler-tools.mjs';
import {
  compile,
  generatedPattern,
  runnableArtifact,
  semanticExample,
  simplyExample,
  targets,
} from '../../src/lib/regex-lab/compiler.ts';
import { runtimeExample } from '../../src/lib/regex-lab/codegen.ts';
import {
  assess,
  compareObservations,
  expectedFrom,
} from '../../src/lib/regex-lab/experiments.ts';
import {
  defaultOptions,
  executionResult,
  interactiveIdentity,
  isScalarText,
  limits,
  observation,
  runRequest,
  runtimeFor,
  validateExecution,
} from '../../src/lib/regex-lab/interactive.ts';
import { runJavaScript } from '../../src/lib/regex-lab/javascript-engine.ts';
import { coordinateMap, editorRange } from '../../src/lib/regex-lab/offsets.ts';
import { createPCRE2 } from '../../src/lib/regex-lab/pcre-engine.ts';
import { validateBrowserReply } from '../../src/lib/regex-lab/result-validation.ts';
import { sameProfileReference } from '../../src/lib/regex-lab/profile-binding.ts';
import {
  bundleSession,
  importBundle,
  importFragment,
  initialSession,
  SessionArchive,
  shareFragment,
} from '../../src/lib/regex-lab/session.ts';
import { explainRegex } from '../../src/lib/regex-lab/structure.ts';

const saveAll = {
  samples: true,
  tests: true,
  observations: true,
  sourceOrigin: true,
};

test('Netlify builds use the sealed compiler and refuse an opt-in private adapter', () => {
  const localFile = 'local-compiler-adapter.wasm';
  for (const context of ['production', 'deploy-preview', 'branch-deploy']) {
    const environment = { NETLIFY: 'true', CONTEXT: context };
    assert.equal(labCompilerTools(environment).integration, undefined);
    assert.throws(
      () =>
        labCompilerTools({
          ...environment,
          STRLING_LAB_TOOLS_CANDIDATE: localFile,
        }),
      /private Lab compiler adapter is for isolated builds/,
    );
  }
});

test('an isolated Lab build refuses a replacement compiler artifact or digest', () => {
  const path = fileURLToPath(new URL('../../package.json', import.meta.url));
  const environment = { STRLING_LAB_TOOLS_CANDIDATE: path };
  assert.throws(
    () =>
      labCompilerTools({
        ...environment,
        STRLING_LAB_TOOLS_SHA256: 'f'.repeat(64),
      }),
    /compiler digest differs from the pin/,
  );
  assert.throws(
    () => labCompilerTools(environment),
    /candidate has the wrong size or digest/,
  );
});
const redact = {
  samples: false,
  tests: false,
  observations: false,
  sourceOrigin: false,
};

test('browser result validation rejects cross-request, operation, provider, profile and coordinate mismatches', () => {
  const options = { ...defaultOptions, flags: 'u' };
  const request = runRequest('javascript', '(?<part>é)', '😀é', options);
  const result = executionResult(
    request,
    runJavaScript(request.pattern, request.input, options),
    observation('javascript'),
  );
  const check = (outcome, active = request, trace = false) =>
    validateBrowserReply(outcome, active, 'javascript', trace);
  assert.equal(check(result), result);
  for (const changes of [
    { requestId: 'previous revision' },
    { operationId: 'search' },
    { profileReleaseId: 'another release' },
    { provider: { ...result.provider, providerId: 'different provider' } },
    { provider: { ...result.provider, kind: 'fixture' } },
    { observation: { ...result.observation, indexUnit: 'utf8-bytes' } },
    { output: false },
    { matches: [{ ...result.matches[0], value: 'different subject' }] },
    {
      matches: [
        {
          ...result.matches[0],
          captures: [
            {
              ...result.matches[0].captures[0],
              span: { start: 0, end: 1, unit: 'utf16-code-units' },
            },
          ],
        },
      ],
    },
  ])
    assert.throws(
      () => check({ ...result, ...changes }),
      /mismatched or invalid/,
    );
  assert.throws(
    () => check(result, { ...request, input: '😀x' }),
    /mismatched or invalid/,
  );
  assert.throws(() => check(result, request, true), /mismatched or invalid/);
  const fullMatch = runRequest('javascript', 'é', '😀é', {
    ...options,
    operation: 'fullmatch',
  });
  assert.throws(
    () =>
      check(
        {
          ...result,
          requestId: fullMatch.requestId,
          operationId: fullMatch.operationId,
        },
        fullMatch,
      ),
    /mismatched or invalid/,
  );
  const reference = {
    profile_id: 'profile:ecmascript/2024',
    profile_version: '1.3.0',
    sha256: 'x'.repeat(64),
  };
  assert.equal(sameProfileReference({ ...reference }, reference), true);
  for (const key of Object.keys(reference))
    assert.equal(
      sameProfileReference({ ...reference, [key]: 'other' }, reference),
      false,
    );
});

test('the interactive registry has its own identity and refuses certified profiles or unsupported options', () => {
  assert.equal(runtimeFor({ runtime: interactiveIdentity('pcre2') }), 'pcre2');
  assert.equal(
    runtimeFor({
      runtime: {
        ...interactiveIdentity('pcre2'),
        projectionDigest: 'sha256:test',
      },
    }),
    undefined,
  );
  const options = { ...defaultOptions, flags: 'iig' };
  assert.equal(
    validateExecution(runRequest('javascript', '', '', options), 'javascript')
      .status,
    'unsupported-operation',
  );
  assert.equal(
    validateExecution(
      runRequest('python', '\ud800', '', defaultOptions),
      'python',
    ).status,
    'unsupported-operation',
  );
  assert.equal(
    validateExecution(
      runRequest(
        'javascript',
        '',
        'x'.repeat(limits.input + 1),
        defaultOptions,
      ),
      'javascript',
    ).status,
    'resource-terminated',
  );
  assert.equal(isScalarText('😀\ud800'), false);
  assert.equal(isScalarText('a😀é'), true);
});

test('JavaScript executes operations, Unicode iteration and real capture participation', () => {
  const run = (pattern, input, operation, extra) =>
    runJavaScript(pattern, input, { ...defaultOptions, operation, ...extra });
  const found = run('(?<word>é)(?<optional>a)?', '😀é!', 'scan', {
    flags: 'u',
  });
  assert.equal(found.status, 'matched');
  assert.deepEqual(found.matches[0].span, {
    start: 2,
    end: 3,
    unit: 'utf16-code-units',
  });
  assert.equal(found.matches[0].captures[0].name, 'word');
  assert.equal(found.matches[0].captures[1].participation, 'unmatched');
  assert.equal(found.matches[0].captures[1].name, 'optional');
  assert.deepEqual(
    run('(?:)', '😀', 'scan', { flags: 'u' }).matches.map(
      (match) => match.span.start,
    ),
    [0, 2],
  );
  assert.equal(run('a|ab', 'ab', 'fullmatch').status, 'matched');
  assert.equal(
    run('a$', 'a\n', 'fullmatch', { flags: 'm' }).status,
    'no-match',
  );
  assert.equal(run('x', 'ax', 'search', { flags: 'y' }).output, false);
  assert.equal(
    run('(?<letter>a)', 'aa', 'replace-all', {
      replacementSyntax: 'native',
      replacement: '$<letter>!',
    }).output,
    'a!a!',
  );
  assert.equal(run('a', 'aa', 'replace', { replacement: '$&' }).output, '$&a');
  assert.deepEqual(run('(a)|(b)', 'ba', 'split').output, [
    '',
    null,
    'b',
    '',
    'a',
    null,
    '',
  ]);
  assert.equal(run('[', '', 'first').status, 'compile-rejection');
  assert.equal(
    run('(?:)', 'x'.repeat(limits.matches), 'scan').error.termination,
    'output-limit',
  );
  assert.equal(
    run('x', 'x'.repeat(limits.matches) + '!'.repeat(8192), 'replace-all', {
      replacementSyntax: 'native',
      replacement: "$'",
    }).error.termination,
    'output-limit',
  );
});

test('PCRE2 module reports native bytes, zero-width retry, errors, and actual interpreter events', async () => {
  const bytes = await readFile(
    new URL('../../src/lib/regex-lab/wasm/pcre2-10.49.wasm', import.meta.url),
  );
  const engine = await createPCRE2(Uint8Array.from(bytes).buffer);
  assert.match(engine.version, /^10\.49\b/);
  const matches = engine.run('(?<name>é)(a)?', '😀é', defaultOptions).result
    .matches;
  assert.deepEqual(matches[0].span, { start: 4, end: 6, unit: 'utf8-bytes' });
  assert.equal(matches[0].captures[0].name, 'name');
  assert.equal(matches[0].captures[1].participation, 'unmatched');
  assert.deepEqual(
    engine
      .run('|a', 'a', defaultOptions)
      .result.matches.map((match) => match.value),
    ['', 'a', ''],
  );
  assert.equal(
    engine.run('(?<letter>a)', 'aa', {
      ...defaultOptions,
      operation: 'replace-all',
      replacementSyntax: 'native',
      replacement: '$1!',
    }).result.output,
    'a!a!',
  );
  assert.equal(
    engine.run('a|ab', 'ab', { ...defaultOptions, operation: 'fullmatch' })
      .result.status,
    'matched',
  );
  assert.equal(
    engine.run('(', '', defaultOptions).result.status,
    'compile-rejection',
  );
  const trace = engine.run('(a|ab)c', 'abc', defaultOptions, true);
  assert.equal(trace.termination, 'matched');
  assert.ok(trace.events.some((event) => event.backtrackSincePrevious));
  assert.ok(
    trace.events.some((event) =>
      event.captures.some(
        (capture) => capture.index === 1 && capture.span.end === 2,
      ),
    ),
  );
  const bounded = engine.run(
    '(?:a){1000}',
    'a'.repeat(1000),
    defaultOptions,
    true,
  );
  assert.equal(bounded.termination, 'limit');
  assert.equal(bounded.events.length, 512);
});

test('the released compiler returns canonical output for every checked-in target and both Simply versions', async () => {
  const client = await loadBundledWasm();
  assert.deepEqual(client.describe().operations, [
    'describe',
    'compile',
    'target_profile.inspect',
    'simply.compile',
  ]);
  for (const target of Object.keys(targets)) {
    const result = compile(client, {
      source: semanticExample,
      format: 'semantic',
      target,
    });
    assert.equal(result.result.outcome, 'succeeded');
    assert.ok(result.profile.sha256);
    assert.ok(result.result.analysis);
    assert.ok(result.result.portability);
    assert.ok(generatedPattern(result).artifact.source_map.length > 0);
    assert.ok(runnableArtifact(result), target);
  }
  for (const version of ['1.0.0', '1.1.0']) {
    const builder = { ...JSON.parse(simplyExample), protocol_version: version };
    const result = compile(client, {
      source: JSON.stringify(builder),
      format: 'simply',
      target: 'ecmascript',
    });
    assert.equal(result.result?.outcome, 'succeeded', JSON.stringify(result));
    assert.equal(runnableArtifact(result).pattern, 'hello');
  }
  const malformed = compile(client, {
    source: 'semantic strling 1.0; case sensitive; pattern bogus;',
    format: 'semantic',
    target: 'ecmascript',
  });
  assert.equal(malformed.result.outcome, 'failed');
  assert.equal(
    malformed.result.diagnostics[0].primary_location.coordinate_system,
    'utf8-bytes',
  );
  for (const minor of [42, 43]) {
    const binary = '../../src/lib/regex-lab/wasm/pcre2-10.' + minor + '.wasm';
    const bytes = await readFile(new URL(binary, import.meta.url));
    const pcre = await createPCRE2(Uint8Array.from(bytes).buffer);
    const { pattern, options } = runnableArtifact(
      compile(client, {
        source: semanticExample,
        format: 'semantic',
        target: 'pcre2' + minor,
      }),
    );
    assert.equal(pcre.version.split(' ')[0], '10.' + minor);
    assert.equal(
      pcre.run(pattern, 'hello hello', { ...defaultOptions, ...options }).result
        .matches.length,
      2,
    );
    assert.deepEqual(
      pcre
        .run('|a', 'a', defaultOptions)
        .result.matches.map((match) => match.value),
      ['', 'a', ''],
    );
  }
});

test('offset conversion and concrete comparison preserve actual ranges across runtimes', async () => {
  const subject = '😀é';
  assert.deepEqual(
    editorRange(
      { start: 4, end: 6, unit: 'utf8-bytes' },
      subject.length,
      coordinateMap(subject, 'utf8-bytes'),
    ),
    { start: 2, end: 3 },
  );
  assert.equal(
    editorRange(
      { start: 1, end: 4, unit: 'utf8-bytes' },
      subject.length,
      coordinateMap(subject, 'utf8-bytes'),
    ),
    undefined,
  );
  assert.deepEqual(
    editorRange(
      { start: 1, end: 2, unit: 'unicode-code-points' },
      subject.length,
      coordinateMap(subject, 'unicode-code-points'),
    ),
    { start: 2, end: 3 },
  );
  const input = runRequest('javascript', '(é)', subject, defaultOptions);
  const javascript = executionResult(
    input,
    runJavaScript(input.pattern, subject, defaultOptions),
  );
  const bytes = await readFile(
    new URL('../../src/lib/regex-lab/wasm/pcre2-10.49.wasm', import.meta.url),
  );
  const pcre = await createPCRE2(Uint8Array.from(bytes).buffer);
  const other = (pattern) =>
    executionResult(
      runRequest('pcre2', pattern, subject, defaultOptions),
      pcre.run(pattern, subject, defaultOptions).result,
    );
  assert.deepEqual(compareObservations(javascript, other('(é)'), subject), []);
  assert.ok(
    compareObservations(javascript, other('(😀)'), subject).some(
      ({ path }) => path === 'removed match 1',
    ),
  );
  assert.deepEqual(assess(expectedFrom(javascript), javascript), []);
  assert.match(
    assess({ kind: 'matches', count: 0 }, javascript)[0],
    /Match count/,
  );
});

test('archive saves and deletes revisions and bundles validate, migrate, and redact data', () => {
  const data = new Map();
  const archive = new SessionArchive({
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  });
  const session = initialSession('regex');
  session.datasets[0].text = 'private subject';
  session.tests.push({
    id: 'test-1',
    name: 'test',
    group: 'private',
    text: 'private fixture',
    run: defaultOptions,
    expected: { kind: 'matches', count: 0 },
  });
  archive.save(session);
  archive.save({ ...session, source: 'changed' });
  assert.equal(archive.list()[0].revisions.length, 2);
  archive.deleteRevision(session.id, archive.list()[0].revisions[0].id);
  assert.equal(archive.list()[0].revisions[0].session.source, session.source);
  assert.deepEqual(
    importBundle(bundleSession(session, saveAll)).datasets,
    session.datasets,
  );
  const redacted = bundleSession(session, redact);
  assert.doesNotMatch(redacted, /private/);
  const settings = importFragment(
    shareFragment({
      ...session,
      name: 'private label',
      source: 'private pattern',
      run: {
        ...defaultOptions,
        operation: 'replace',
        replacement: 'private replacement',
      },
    }),
  );
  assert.doesNotMatch(JSON.stringify(settings), /private/);
  assert.equal(settings.source, '');
  assert.equal(settings.datasets[0].text, '');
  assert.equal(settings.run.replacement, '');
  assert.equal(settings.run.operation, 'replace');
  assert.throws(() => importBundle('{"schema":"wrong"}'), /malformed/);
  assert.throws(
    () => importBundle(JSON.stringify({ ...session, runtime: '__proto__' })),
    /malformed/,
  );
  assert.throws(() => importFragment('#lab=%'), URIError);
  assert.throws(
    () => importBundle(JSON.stringify({ ...session, selected: 9 })),
    /dataset/,
  );
  assert.equal(
    importBundle(
      JSON.stringify({
        ...session,
        schema: 'strling-lab-session-v1',
        input: 'old',
      }),
    ).datasets[0].text,
    'old',
  );
  archive.clear();
  assert.deepEqual(archive.list(), []);
});

test('structural explanations use parsed ECMAScript and generated JavaScript integration executes', () => {
  const parsed = explainRegex('(?<name>[a-z]+)(?=!)', 'u', 'javascript');
  assert.match(JSON.stringify(parsed), /Named capture name/);
  assert.match(JSON.stringify(parsed), /lookahead assertion/);
  assert.throws(
    () => explainRegex('(?P<name>.)', '', 'python'),
    /structural parser/,
  );
  const generated = runtimeExample('javascript', 'Your input here|Your', {
    ...defaultOptions,
    operation: 'fullmatch',
    flags: 'u',
  });
  const values = [];
  runInNewContext(generated, {
    console: { log: (value) => values.push(value[0]) },
  });
  assert.deepEqual(values, ['Your input here']);
});
