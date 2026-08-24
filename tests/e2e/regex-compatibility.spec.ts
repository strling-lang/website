import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  consumeCheckpoints,
  createEmptyConsumptionState,
  type SemanticSnapshotIdentity,
  validateCheckpointBundle,
} from '../../src/lib/regex-conformance/index.ts';
import {
  fixtureSemanticSnapshot,
  validCheckpointBundle,
} from '../fixtures/regex-conformance/checkpoints.mjs';

const validatedFixtures = validateCheckpointBundle(
  validCheckpointBundle(),
  fixtureSemanticSnapshot as SemanticSnapshotIdentity,
);
const fixtureCompatibilityState = consumeCheckpoints(
  createEmptyConsumptionState(),
  validatedFixtures,
  'compatibility',
).compatibility;

async function installFixtureCompatibility(page: Page): Promise<void> {
  await page.goto('/regex/compatibility/');
  await page.waitForFunction(
    () =>
      typeof (document.querySelector('regex-compatibility') as any)?.hydrate ===
      'function',
  );
  await page
    .locator('regex-compatibility')
    .evaluate((element, fixtureState) => {
      const script = element.querySelector<HTMLScriptElement>(
        '[data-compatibility-state]',
      );
      const productionState = JSON.parse(script?.textContent ?? '{}');
      (element as any).hydrate({
        ...productionState,
        ...fixtureState,
      });
    }, fixtureCompatibilityState);
  await expect(page.locator('[data-compatibility-body] tr')).toHaveCount(251);
}

test.describe('RegEx Compatibility foundation', () => {
  test('keeps production empty until a certified checkpoint is consumed', async ({
    page,
  }) => {
    await page.goto('/regex/compatibility/');
    await expect(page.locator('[data-compatibility-gate]')).toContainText(
      'Certified compatibility results are not yet available',
    );
    await expect(page.locator('[data-compatibility-search]')).toBeDisabled();
    await expect(page.locator('[data-compatibility-body] tr')).toHaveCount(0);
    await expect(page.locator('[data-compatibility-state]')).not.toContainText(
      'test-only',
    );
  });

  test('supports exact single-profile selection and canonical feature lookup', async ({
    page,
  }) => {
    await installFixtureCompatibility(page);
    await expect(page.locator('[data-compatibility-gate]')).toBeHidden();

    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('button', { name: 'Programming language' }).click();
    await page.getByRole('button', { name: '3.14' }).click();
    await expect(page.locator('[data-profile-name]')).toContainText('3.14');

    const search = page.locator('[data-compatibility-search]');
    await search.fill('feature.named-capture');
    await expect(page.locator('[data-compatibility-body] tr')).toHaveCount(1);
    const namedCapture = page.locator(
      '[data-feature-id="feature.named-capture"]',
    );
    await expect(namedCapture).toContainText('Supported');
    await expect(namedCapture).toContainText('Evidence available');

    await search.fill('');
    await page
      .locator('[data-compatibility-category]')
      .selectOption('anchors-and-boundaries');
    await expect(page.locator('[data-compatibility-body] tr')).toHaveCount(19);
  });

  test('adds environments progressively for comparison mode', async ({
    page,
  }) => {
    await installFixtureCompatibility(page);
    await page.getByLabel('Compare profiles').check();
    await expect(page.locator('[data-comparison-hint]')).toBeVisible();
    await page.getByRole('button', { name: 'Change' }).click();
    await expect(
      page.getByRole('heading', { name: 'Which release?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '3.13' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.locator('[data-profile-name]')).toContainText(
      '2 exact environments',
    );
    const namedCapture = page.locator(
      '[data-feature-id="feature.named-capture"]',
    );
    await expect(namedCapture.locator('td')).toHaveCount(2);
    await expect(namedCapture).toContainText('Unsupported');
    await expect(namedCapture).toContainText('Conditional');
  });

  test('renders all canonical states without Boolean collapsing', async ({
    page,
  }) => {
    await installFixtureCompatibility(page);
    await page.getByLabel('Compare profiles').check();
    await page.locator('regex-profile-resolver').evaluate((resolver) => {
      (resolver as any).selectProfiles([
        'test-only.cli.pcre2grep.10.46',
        'test-only.python.stdlib-re.cpython.3.13',
        'test-only.python.stdlib-re.cpython.3.14',
      ]);
    });
    for (const state of [
      'supported',
      'unsupported',
      'conditional',
      'not-applicable',
      'not-tested',
      'unknown-insufficient-evidence',
    ]) {
      await expect(
        page.locator(`[data-state="${state}"]`).first(),
      ).toBeVisible();
    }
  });

  test('resolves evidence details and distinguishes absent findings', async ({
    page,
  }) => {
    await installFixtureCompatibility(page);
    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('button', { name: 'Programming language' }).click();
    await page.getByRole('button', { name: '3.14' }).click();

    await page
      .locator('[data-compatibility-search]')
      .fill('feature.named-capture');

    await page
      .locator(
        '[data-feature-id="feature.named-capture"] .compatibility-state-button',
      )
      .click();
    const dialog = page.getByRole('dialog', {
      name: 'Named capture',
    });
    await expect(dialog).toContainText('Supported');
    await expect(dialog).toContainText('search-all');
    await expect(dialog).toContainText('test-only-checkpoint-0001');
    await expect(dialog).toContainText('sha256:');
    await page.getByRole('button', { name: 'Close evidence details' }).click();

    await page.locator('[data-compatibility-search]').fill('feature.wildcard');
    const wildcard = page.locator('[data-feature-id="feature.wildcard"]');
    await expect(wildcard).toContainText('Unknown / insufficient evidence');
    await expect(wildcard).toContainText('No certified finding');
    await wildcard.locator('.compatibility-state-button').click();
    await expect(page.getByRole('dialog', { name: 'Wildcard' })).toContainText(
      'No certified compatibility finding is present',
    );
    await expect(
      page.getByRole('dialog', { name: 'Wildcard' }),
    ).not.toContainText('Unsupported');
  });

  test('passes axe and contains wide comparisons without page overflow', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await installFixtureCompatibility(page);
    await page
      .locator('[data-compatibility-search]')
      .fill('feature.named-capture');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
