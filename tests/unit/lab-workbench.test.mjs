import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
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
  createContinuation,
  readContinuation,
  verifyContinuation,
} from '../../src/lib/regex-lab/continuation.ts';
import {
  inspection,
  verifyInspection,
} from '../../src/lib/regex-lab/inspection.ts';
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
  exportSession,
  importBundle,
  importFragment,
  initialSession,
  SessionArchive,
  shareFragment,
} from '../../src/lib/regex-lab/session.ts';
import { explainRegex } from '../../src/lib/regex-lab/structure.ts';

const sealedManifest = { schemaVersion: 1, mode: 'sealed' };

test('Netlify uses the explicit sealed mode and refuses a private adapter', async () => {
  const localFile = 'local-compiler-adapter.wasm';
  for (const context of ['production', 'deploy-preview', 'branch-deploy']) {
    const environment = { NETLIFY: 'true', CONTEXT: context };
    assert.equal(
      (await labCompilerTools(environment, sealedManifest)).integration,
      undefined,
    );
    await assert.rejects(
      () =>
        labCompilerTools(
          {
            ...environment,
            STRLING_LAB_TOOLS_CANDIDATE: localFile,
          },
          sealedManifest,
        ),
      /private Lab compiler adapter is only allowed in isolated builds/,
    );
  }
});

test('an isolated Lab build refuses a replacement compiler artifact or digest', async () => {
  const path = fileURLToPath(new URL('../../package.json', import.meta.url));
  const environment = { STRLING_LAB_TOOLS_CANDIDATE: path };
  await assert.rejects(
    () =>
      labCompilerTools(
        {
          ...environment,
          STRLING_LAB_TOOLS_SHA256: 'f'.repeat(64),
        },
        sealedManifest,
      ),
    /compiler digest differs from the pin/,
  );
  await assert.rejects(
    () => labCompilerTools(environment, sealedManifest),
    /artifact has the wrong size or digest/,
  );
});

const hash = (data) => createHash('sha256').update(data).digest('hex');
const shippingArtifact = {
  version: '0.1.0',
  protocol: 'strling.lab-compiler-tools@1.0.0-rc.1',
  sealedCompilerVersion: '4.0.3',
  sourceRevision: 'a'.repeat(40),
  baseRevision: 'b'.repeat(40),
  certifiedClosureSha256: 'c'.repeat(64),
  sha256: 'd'.repeat(64),
  size: 8,
  memoryBytes: 67_108_864,
  stackBytes: 2_097_152,
  url: 'https://github.com/strling-lang/strling/releases/download/lab-wasm-v0.1.0/strling_lab_wasm.wasm',
  evidence: {
    adapterTree: 'f'.repeat(40),
    certifiedSource: '1'.repeat(40),
    assets: Object.fromEntries(
      [
        'SHA256SUMS',
        'draft-sbom.spdx.json',
        'unsigned-provenance.json',
        'rebuild-1-receipt.json',
        'rebuild-2-receipt.json',
        'rc4-certification-attestation.json',
      ].map((name) => [name, { size: 8, sha256: 'e'.repeat(64) }]),
    ),
  },
};
const shipping = {
  schemaVersion: 1,
  mode: 'certified',
  artifact: shippingArtifact,
};
const { Response } = globalThis;
const wasmName = 'strling_lab_wasm.wasm';
const attestationName = 'rc4-certification-attestation.json';
const tag = 'lab-wasm-v0.1.0';
const releaseRoot = shippingArtifact.url.slice(0, -wasmName.length);

function releaseMetadata(artifact) {
  return {
    immutable: true,
    draft: false,
    prerelease: false,
    tag_name: tag,
    target_commitish: artifact.sourceRevision,
    assets: Object.entries({
      ...artifact.evidence.assets,
      [wasmName]: artifact,
    }).map(([name, pin]) => ({
      name,
      browser_download_url: releaseRoot + name,
      size: pin.size,
      digest: 'sha256:' + pin.sha256,
      state: 'uploaded',
    })),
  };
}

function commitMetadata(sha, tree = shippingArtifact.evidence.adapterTree) {
  return { sha, commit: { tree: { sha: tree } } };
}

const published = releaseMetadata(shippingArtifact);

test('shipping refuses an absent or unauthorized manifest before network access', async () => {
  const noNetwork = () =>
    assert.fail('Invalid configuration reached the network');
  for (const artifact of [
    undefined,
    { ...shippingArtifact, protocol: 'strling.interop@1.0.0' },
    { ...shippingArtifact, version: '0.1.0-rc.3' },
    { ...shippingArtifact, version: 'latest' },
    { ...shippingArtifact, certifiedClosureSha256: '' },
    { ...shippingArtifact, evidence: undefined },
  ]) {
    await assert.rejects(
      labCompilerTools({}, { ...shipping, artifact }, noNetwork),
      /approved compiler tools release manifest is required/,
    );
  }
  await assert.rejects(
    labCompilerTools(
      {},
      {
        ...shipping,
        artifact: {
          ...shippingArtifact,
          url: 'https://example.com/compiler.wasm',
        },
      },
      noNetwork,
    ),
    /outside the approved release coordinate/,
  );
  await assert.rejects(
    labCompilerTools(
      { STRLING_LAB_TOOLS_CANDIDATE: 'private.wasm' },
      shipping,
      noNetwork,
    ),
    /private Lab compiler adapter is only allowed in isolated builds/,
  );
});

test('shipping requires immutable metadata for the exact source, version and bytes', async () => {
  for (const [release, commit, tree] of [
    [{ ...published, immutable: false }, shippingArtifact.sourceRevision],
    [
      { ...published, tag_name: 'lab-wasm-v0.1.1' },
      shippingArtifact.sourceRevision,
    ],
    [published, 'e'.repeat(40)],
    [published, shippingArtifact.sourceRevision, 'e'.repeat(40)],
    [{ ...published, prerelease: true }, shippingArtifact.sourceRevision],
    [
      { ...published, target_commitish: 'e'.repeat(40) },
      shippingArtifact.sourceRevision,
    ],
    [
      { ...published, assets: published.assets.slice(1) },
      shippingArtifact.sourceRevision,
    ],
    [
      {
        ...published,
        assets: [...published.assets.slice(1), published.assets[1]],
      },
      shippingArtifact.sourceRevision,
    ],
    [
      {
        ...published,
        assets: [
          { ...published.assets[0], digest: 'sha256:' + '0'.repeat(64) },
          ...published.assets.slice(1),
        ],
      },
      shippingArtifact.sourceRevision,
    ],
  ]) {
    await assert.rejects(
      labCompilerTools({}, shipping, async (url) => {
        if (url.endsWith('/releases/tags/lab-wasm-v0.1.0'))
          return Response.json(release);
        if (url.endsWith('/commits/lab-wasm-v0.1.0'))
          return Response.json(commitMetadata(commit, tree));
        assert.fail('Unapproved release reached the download');
      }),
      /does not match its approved identity/,
    );
  }
});

test('shipping fails closed on a missing, redirected, oversized or replaced asset', async () => {
  for (const [failure, message] of [
    [new Response(null, { status: 404 }), /asset or metadata is unavailable/],
    [
      Response.redirect('https://example.com/substituted.wasm'),
      /unauthorized redirect/,
    ],
    [
      Response.redirect(
        'https://release-assets.githubusercontent.com/github-production-release-asset/1/wrong',
      ),
      /unauthorized redirect/,
    ],
    [new Response(new Uint8Array(9)), /exceeds its size limit/],
    [
      new Response(new Uint8Array(8), { headers: { age: '120' } }),
      /wrong size or digest/,
    ],
  ]) {
    await assert.rejects(
      labCompilerTools({}, shipping, async (url, options) => {
        assert.equal(options.credentials, 'omit');
        assert.equal(options.cache, 'no-store');
        if (url.endsWith('/releases/tags/lab-wasm-v0.1.0'))
          return Response.json(published);
        if (url.endsWith('/commits/lab-wasm-v0.1.0'))
          return Response.json(commitMetadata(shippingArtifact.sourceRevision));
        assert.equal(url, shippingArtifact.url);
        assert.equal(options.redirect, 'manual');
        return failure;
      }),
      message,
    );
  }
});
test('certified shipping rejects altered evidence and a closure with the wrong provenance', async () => {
  const wasm = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0);
  const artifact = {
    ...shippingArtifact,
    sha256: hash(wasm),
    evidence: { ...shippingArtifact.evidence, assets: {} },
  };
  const makeFixture = (fault) => {
    const contents = {
      [wasmName]: wasm,
      SHA256SUMS: Buffer.from(artifact.sha256 + '  ' + wasmName + '\n'),
      'draft-sbom.spdx.json': Buffer.from('{}'),
      'rebuild-1-receipt.json': Buffer.from('{}'),
      'rebuild-2-receipt.json': Buffer.from('{}'),
      'unsigned-provenance.json': Buffer.from(
        JSON.stringify({
          _type: 'https://in-toto.io/Statement/v1',
          predicateType: 'https://slsa.dev/provenance/v1',
          subject: [{ name: wasmName, digest: { sha256: artifact.sha256 } }],
          predicate: {
            buildDefinition: {
              resolvedDependencies: [
                {
                  uri: 'git+https://github.com/strling-lang/strling',
                  digest: {
                    gitCommit:
                      fault === 'wrong provenance'
                        ? '0'.repeat(40)
                        : artifact.sourceRevision,
                  },
                },
              ],
            },
          },
        }),
      ),
    };
    const rows = Object.entries(contents)
      .filter(([name]) => name !== wasmName)
      .map(([name, bytes]) => ({
        path: 'evidence/lab-wasm-preview-evidence/' + name,
        role: 'lab-wasm-preview-evidence',
        bytes: bytes.length,
        sha256: hash(bytes),
      }));
    contents[attestationName] = Buffer.from(
      JSON.stringify({
        signed_payload: {
          certification_state: 'LOCALLY_CERTIFIED',
          certified_source: {
            commit: artifact.evidence.certifiedSource,
            clean: true,
          },
          evidence_root_sha256:
            fault === 'wrong closure'
              ? '0'.repeat(64)
              : artifact.certifiedClosureSha256,
          evidence_files: fault === 'no signed metadata' ? rows.slice(1) : rows,
        },
      }),
    );
    artifact.evidence.assets = Object.fromEntries(
      Object.entries(contents)
        .filter(([name]) => name !== wasmName)
        .map(([name, bytes]) => [
          name,
          { size: bytes.length, sha256: hash(bytes) },
        ]),
    );
    return contents;
  };
  for (const [fault, message] of [
    ['wrong provenance', /release evidence does not match/],
    ['wrong closure', /release evidence does not match/],
    ['no signed metadata', /release evidence does not match/],
    ['tampered attestation', /wrong size or digest/],
    ['missing provenance', /asset or metadata is unavailable/],
    ['valid evidence', /ABI|unexpected host capability/],
  ]) {
    const fixture = makeFixture(fault);
    await assert.rejects(
      labCompilerTools(
        { NETLIFY: 'true' },
        { ...shipping, artifact },
        async (url) => {
          if (url.endsWith('/releases/tags/' + tag))
            return Response.json(releaseMetadata(artifact));
          if (url.endsWith('/commits/' + tag))
            return Response.json(commitMetadata(artifact.sourceRevision));
          const name = url.slice(releaseRoot.length);
          if (
            fault === 'missing provenance' &&
            name === 'unsigned-provenance.json'
          )
            return new Response(null, { status: 404 });
          if (fault === 'tampered attestation' && name === attestationName)
            return new Response(new Uint8Array(fixture[name].length));
          return new Response(fixture[name]);
        },
      ),
      message,
    );
  }
});

test('PCRE2 resumes a complete scan only after its exact consuming boundary', async () => {
  const bytes = await readFile(
    new URL('../../src/lib/regex-lab/wasm/pcre2-10.43.wasm', import.meta.url),
  );
  const pcre = await createPCRE2(Uint8Array.from(bytes).buffer);
  await assert.rejects(
    createPCRE2(Uint8Array.from(bytes).buffer, '0'.repeat(64)),
    /pinned digest/,
  );
  const options = { ...defaultOptions, operation: 'scan' };
  const pattern = '(?<word>é)|x';
  const input = 'é😀xé';
  const provenance = { format: 'regex', source: pattern };
  const request = runRequest('pcre243', pattern, input, options);
  const native = pcre.run(pattern, input, options).result;
  const result = {
    ...executionResult(request, native, observation('pcre243', pcre.version)),
    engineNativeMetadata: { providerBuild: pcre.build },
  };
  const cursor = await createContinuation(request, result, provenance, 1);
  assert.deepEqual(cursor.after, { ordinal: 1, start: 0, end: 2 });
  await verifyContinuation(cursor, request, provenance);
  assert.deepEqual(
    pcre
      .run(pattern, input, options, false, cursor.after)
      .result.matches.map(({ span }) => [span.start, span.end]),
    [
      [6, 7],
      [7, 9],
    ],
  );
  for (const mismatch of [
    runRequest('pcre243', pattern, 'é–xé', options),
    runRequest('pcre243', pattern, input, { ...options, flags: 'i' }),
    runRequest('pcre2', pattern, input, options),
    runRequest('pcre243', pattern, input, { ...options, operation: 'first' }),
  ]) {
    await assert.rejects(
      verifyContinuation(cursor, mismatch, provenance),
      /differs/,
    );
  }
  await assert.rejects(
    verifyContinuation(cursor, request, { ...provenance, compiler: 'changed' }),
    /provenance differs/,
  );
  await assert.rejects(
    verifyContinuation(
      { ...cursor, after: { ...cursor.after, end: 1 } },
      request,
      provenance,
    ),
    /outside a UTF-8 boundary/,
  );
  assert.throws(
    () => readContinuation({ ...cursor, state: 'cancelled' }),
    /Invalid saved/,
  );
  for (const after of [
    { ordinal: 2, start: 0, end: 2 },
    { ordinal: 3, start: 7, end: 9 },
  ]) {
    assert.equal(
      pcre.run(pattern, input, options, false, after).result.status,
      'unsupported-operation',
    );
  }
  const overLimit = pcre.run(
    '(?=(.{2000})).',
    'a'.repeat(3000),
    options,
    false,
    {
      ordinal: 1,
      start: 0,
      end: 1,
    },
  ).result;
  assert.equal(overLimit.status, 'resource-terminated');
  assert.equal(overLimit.error.termination, 'output-limit');
  assert.equal(
    await createContinuation(
      request,
      { ...result, status: 'output-limited' },
      provenance,
      1,
    ),
    undefined,
  );
  assert.equal(
    await createContinuation(request, result, provenance, 3),
    undefined,
  );
  const empty = executionResult(
    request,
    pcre.run('(?=é)|x', input, options).result,
    observation('pcre243', pcre.version),
  );
  assert.equal(
    await createContinuation(
      request,
      { ...result, matches: empty.matches },
      provenance,
      1,
    ),
    undefined,
  );

  const session = {
    ...initialSession('regex'),
    source: pattern,
    runtime: 'pcre243',
    datasets: [{ name: 'Synthetic', text: input }],
    continuation: cursor,
  };
  const full = exportSession(session);
  assert.deepEqual(importBundle(full).continuation, cursor);
  const legacy = {
    schema: 'strling-lab-bundle-v1',
    redaction: { source: true, samples: true, continuation: true },
    session,
  };
  assert.deepEqual(importBundle(JSON.stringify(legacy)).continuation, cursor);
  const excluded = importBundle(
    JSON.stringify({
      ...legacy,
      redaction: { ...legacy.redaction, source: false, samples: false },
      session: {
        ...session,
        source: '',
        datasets: [{ name: 'Sample', text: '' }],
      },
    }),
  );
  assert.equal(excluded.continuation, undefined);
  assert.equal(excluded.source, '');
  assert.equal(excluded.datasets[0].text, '');
  const fragment = importFragment('#lab=' + encodeURIComponent(full));
  assert.equal(fragment.continuation, undefined);
  assert.equal(fragment.source, '');
  assert.equal(fragment.datasets[0].text, '');
});

test('native pattern inspection rejects a wrong request, authority, version, and coordinate', () => {
  const request = runRequest('pcre2', 'éx', '', defaultOptions);
  const result = inspection(request, 'pcre2', '10.49', {
    disposition: 'partial',
    tree: {
      label: 'Native ranges',
      children: [
        {
          label: 'é',
          children: [],
          range: { start: 0, end: 2, unit: 'utf8-bytes' },
        },
      ],
    },
  });
  assert.ok(verifyInspection(result, request, 'pcre2'));
  for (const fields of [
    { requestId: 'late revision' },
    { profileReleaseId: 'different profile' },
    { authority: 'cpython-re-parser' },
    { version: '10.43' },
    {
      tree: {
        label: 'é',
        children: [],
        range: { start: 0, end: 1, unit: 'utf8-bytes' },
      },
    },
  ])
    assert.equal(
      verifyInspection({ ...result, ...fields }, request, 'pcre2'),
      false,
    );
});

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

test('archives, complete session files, and settings-only links retain their own state', () => {
  const data = new Map();
  const archive = new SessionArchive({
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  });
  const session = initialSession('regex');
  session.datasets[0].text = 'private subject';
  session.datasets.push({ name: 'Second sample', text: 'more data' });
  session.selected = 1;
  session.run = {
    ...defaultOptions,
    flags: 'u',
    replacement: 'private replacement',
  };
  session.recorded = {
    capturedAt: '2026-11-01T00:00:00.000Z',
    investigation: { comparison: { schema: 'strling-lab-comparison-v1' } },
  };
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
  const file = JSON.parse(exportSession(session));
  assert.equal(file.schema, 'strling-lab-session-v2');
  assert.deepEqual(file, session);
  assert.deepEqual(
    JSON.parse(JSON.stringify(importBundle(JSON.stringify(file)))),
    session,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(archive.list()[0].revisions[0].session)),
    session,
  );
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
  assert.equal(settings.run.flags, '');
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

test('complete files retain the alternate source draft and obey the UTF-8 file limit', () => {
  const session = initialSession('strling');
  session.drafts = { simply: '{"privateDraft":true}' };
  assert.deepEqual(importBundle(exportSession(session)).drafts, session.drafts);
  assert.equal(importFragment(shareFragment(session)).drafts, undefined);
  assert.throws(
    () => exportSession({ ...session, drafts: { simply: 'x'.repeat(8_193) } }),
    /source drafts/,
  );
  session.recorded = {
    capturedAt: '2026-11-01T00:00:00.000Z',
    investigation: {
      comparison: {
        schema: 'strling-lab-comparison-v1',
        sample: '界'.repeat(700_000),
      },
    },
  };
  assert.throws(
    () => exportSession(session),
    /complete session exceeds the 2 MB file limit/,
  );
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
