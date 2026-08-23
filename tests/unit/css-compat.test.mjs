import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkCssCompatibility,
  checkProjectCss,
} from '../../scripts/check-css-compat.mjs';

test('project CSS satisfies the supported-browser compatibility floor', async () => {
  assert.deepEqual(await checkProjectCss(), []);
});

test('CSS gate rejects unsupported properties and discontinuous values', () => {
  const textWrapIssues = checkCssCompatibility(
    'h1 { text-wrap: balance; }',
    'text-wrap-fixture.css',
  );
  assert.equal(textWrapIssues.length, 1);
  assert.match(textWrapIssues[0].message, /Chrome 109/);
  assert.match(textWrapIssues[0].message, /Safari on iOS 16/);

  const minHeightIssues = checkCssCompatibility(
    'nav { min-height: auto; }',
    'min-height-fixture.css',
  );
  assert.equal(minHeightIssues.length, 1);
  assert.match(minHeightIssues[0].message, /browser-support gap/);
});

test('CSS gate accepts the compatible replacements', () => {
  assert.deepEqual(
    checkCssCompatibility(
      'h1 { overflow-wrap: anywhere; } nav { min-height: 0; }',
      'compatible-fixture.css',
    ),
    [],
  );
});
