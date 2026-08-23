import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  canonicalFromLock,
  verifyCoverage,
} from '../../scripts/check-regex-docs-coverage.mjs';

const root = new URL('../../', import.meta.url);
const lock = JSON.parse(
  await readFile(new URL('src/data/regex-docs/source-lock.json', root), 'utf8'),
);
const projection = JSON.parse(
  await readFile(new URL('src/data/regex-docs/projection.json', root), 'utf8'),
);

const copy = (value) => structuredClone(value);
const hasIssue = (result, code) =>
  result.issues.some((issue) => issue.code === code);
const verify = (docs, canonical = canonicalFromLock(lock)) =>
  verifyCoverage({ canonical, lock, projection: docs });

test('regex documentation coverage baseline passes', async () => {
  const result = await verify(copy(projection));
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test('gate fails when one feature page record is deleted', async () => {
  const docs = copy(projection);
  docs.features.shift();
  const result = await verify(docs);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'WEBSITE_MISSING_FEATURES'), true);
});

test('gate fails when one extra feature page record is added', async () => {
  const docs = copy(projection);
  const extra = copy(docs.features[0]);
  extra.semanticFeatureId = 'feature.website-only';
  extra.canonicalName = 'Website-only feature';
  extra.slug = 'website-only';
  extra.route = `/regex/docs/${extra.semanticCategoryId}/website-only/`;
  docs.features.push(extra);
  const result = await verify(docs);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'WEBSITE_UNEXPECTED_FEATURES'), true);
});

test('gate fails for a duplicate canonical feature ID', async () => {
  const docs = copy(projection);
  docs.features.push(copy(docs.features[0]));
  const result = await verify(docs);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'DUPLICATE_FEATURE_IDS'), true);
});

test('gate fails for a website category mismatch', async () => {
  const docs = copy(projection);
  const original = docs.features[0].semanticCategoryId;
  docs.features[0].semanticCategoryId = docs.categories.find(
    (category) => category.semanticCategoryId !== original,
  ).semanticCategoryId;
  const result = await verify(docs);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'CATEGORY_MISMATCHES'), true);
});

test('gate fails when a website category is deleted', async () => {
  const docs = copy(projection);
  docs.categories.shift();
  const result = await verify(docs);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'WEBSITE_MISSING_CATEGORIES'), true);
});

test('gate fails when the documentation source digest changes', async () => {
  const docs = copy(projection);
  docs.source.semanticDigest = '0'.repeat(64);
  const result = await verify(docs);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'WEBSITE_DIGEST_MISMATCH'), true);
});

test('gate fails for a newly added upstream canonical feature', async () => {
  const canonical = copy(canonicalFromLock(lock));
  canonical.kind = 'upstream-snapshot';
  canonical.digest = '1'.repeat(64);
  canonical.features.push({
    id: 'feature.new-upstream-feature',
    name: 'New upstream feature',
    categoryId: canonical.features[0].categoryId,
  });
  const result = await verify(copy(projection), canonical);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'LOCK_MISSING_FEATURES'), true);
  assert.equal(hasIssue(result, 'WEBSITE_MISSING_FEATURES'), true);
});

test('gate fails when upstream removes a canonical feature', async () => {
  const canonical = copy(canonicalFromLock(lock));
  canonical.kind = 'upstream-snapshot';
  canonical.digest = '2'.repeat(64);
  canonical.features.shift();
  const result = await verify(copy(projection), canonical);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'LOCK_UNEXPECTED_FEATURES'), true);
  assert.equal(hasIssue(result, 'WEBSITE_UNEXPECTED_FEATURES'), true);
});

test('gate fails when upstream moves a feature to another category', async () => {
  const canonical = copy(canonicalFromLock(lock));
  canonical.kind = 'upstream-snapshot';
  canonical.digest = '3'.repeat(64);
  const original = canonical.features[0].categoryId;
  canonical.features[0].categoryId = canonical.features.find(
    (feature) => feature.categoryId !== original,
  ).categoryId;
  const result = await verify(copy(projection), canonical);
  assert.equal(result.ok, false);
  assert.equal(hasIssue(result, 'UPSTREAM_CATEGORY_MOVE'), true);
  assert.equal(hasIssue(result, 'CATEGORY_MISMATCHES'), true);
});
