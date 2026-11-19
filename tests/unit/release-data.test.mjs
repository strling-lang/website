import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindings } from '../../src/data/bindings.ts';
import {
  fourthEdition,
  productTag,
  releasePolicy,
} from '../../src/data/release.ts';

const read = (path) =>
  readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const evidence = JSON.parse(await read('tests/fixtures/release-evidence.json'));

test('Fourth Edition agrees with the pinned upstream policy and independent verification', async () => {
  assert.equal(fourthEdition.version, evidence.policyVersion);
  assert.equal(productTag, `v${evidence.policyVersion}`);
  assert.equal(fourthEdition.productSource, evidence.source);
  assert.equal(fourthEdition.certificationClosure, evidence.policyCommit);
  assert.ok(
    fourthEdition.verificationRun.includes(
      `/runs/${evidence.verificationRunId}/`,
    ),
  );
  assert.ok(releasePolicy.includes(evidence.policyCommit));

  // The normal build uses the checked-in evidence. Reviewers can supply the
  // exact upstream policy bytes during a release audit.
  if (process.env.STRLING_RELEASE_POLICY_FILE) {
    const bytes = await readFile(process.env.STRLING_RELEASE_POLICY_FILE);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      evidence.policySha256,
    );
    assert.equal(JSON.parse(bytes).product.version, fourthEdition.version);
  }
});

test('distribution versions, paths, tiers and dependency pins agree with release evidence', async () => {
  const verifiedRoutes = bindings.filter(
    ({ status }) => status !== 'Direct build',
  );
  assert.deepEqual(
    Object.fromEntries(
      verifiedRoutes.map(({ slug, support }) => [slug, support]),
    ),
    evidence.verifiedRoutes,
  );
  assert.deepEqual(
    bindings
      .filter(({ status }) => status === 'Direct build')
      .map(({ slug }) => slug),
    evidence.deferredRoutes,
  );
  for (const binding of bindings) {
    assert.equal(
      binding.package.version,
      evidence.distributionVersions[binding.slug],
      binding.slug,
    );
    assert.equal(new URL(binding.package.url).protocol, 'https:');
    assert.ok(binding.sourcePath.includes(fourthEdition.productSource));
    if (binding.install) {
      assert.ok(
        binding.install.includes(binding.package.version.replace(/^v/, '')),
        binding.slug,
      );
    }
    if (binding.status === 'Git distribution') {
      assert.ok(
        binding.package.url.includes(binding.package.version),
        binding.slug,
      );
    }
  }
  const npm = bindings.find(({ slug }) => slug === 'typescript').package;
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(manifest.devDependencies[npm.name], npm.version);
  assert.equal(lock.packages[`node_modules/${npm.name}`].version, npm.version);
  for (const slug of ['production-event-logs', 'nested-sequence-hypotheses']) {
    assert.ok(
      (await read(`src/content/learn/${slug}.md`)).includes(
        `${npm.name}@${npm.version}`,
      ),
    );
  }
  const legacy = await read('src/content/learn/quickstart.md');
  assert.match(legacy, /legacy TypeScript 3\.0\.0 and Python 2\.5\.9/);
  assert.match(legacy, /npm install @strling-lang\/strling@3\.0\.0/);
  assert.match(legacy, /pip install STRling==2\.5\.9/);
});

test('static release surfaces share the product version and every binding coordinate', async () => {
  const [home, index, short, full] = await Promise.all(
    ['index.html', 'packages/index.html', 'llms.txt', 'llms-full.txt'].map(
      (path) => read(`dist/${path}`),
    ),
  );
  for (const html of [home, index, short, full]) {
    assert.ok(html.includes(`STRling ${fourthEdition.version}`));
    assert.doesNotMatch(
      html,
      /under certification|not yet certified|not certified|remains provisional/i,
    );
  }
  for (const binding of bindings) {
    const route = `/packages/${binding.slug}/`;
    assert.ok(index.includes(`href="${route}"`));
    const detail = await read(`dist${route}index.html`);
    assert.ok(detail.includes(binding.package.url), binding.slug);
    assert.ok(detail.includes(binding.package.version), binding.slug);
    assert.ok(detail.includes(binding.support), binding.slug);
    assert.ok(
      full.includes(
        `${binding.package.name} ${binding.package.version}; ${binding.distribution}; ${binding.status}; ${binding.support}.`,
      ),
      binding.slug,
    );
  }
});
