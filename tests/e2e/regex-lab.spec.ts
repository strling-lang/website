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
const fixtureLabState = consumeCheckpoints(
  createEmptyConsumptionState(),
  validatedFixtures,
  'lab',
).lab;

async function installFixtureLab(page: Page): Promise<void> {
  await page.goto('/regex/lab/');
  await page.waitForFunction(
    () =>
      typeof (document.querySelector('regex-lab') as any)?.hydrate ===
      'function',
  );
  await page.locator('regex-lab').evaluate((element, state) => {
    const fixtureProvider = {
      providerId: 'test-only-e2e-provider',
      kind: 'fixture' as const,
      supports: () => true,
      execute: async (request: any) => {
        await new Promise((resolve) =>
          window.setTimeout(resolve, request.pattern === 'SLOW' ? 350 : 5),
        );
        const base = {
          schemaVersion: 'strling-regex-lab-execution-result-v1',
          requestId: request.requestId,
          profileReleaseId: request.runtime.profileReleaseId,
          operationId: request.operationId,
          provider: {
            providerId: 'test-only-e2e-provider',
            kind: 'fixture',
          },
          timing: { durationMs: request.pattern === 'SLOW' ? 350 : 5 },
          engineNativeMetadata: {
            observedPattern: request.pattern,
            observedInput: request.input,
            observedOptions: request.options,
          },
        };
        if (request.pattern === '[') {
          return {
            ...base,
            status: 'compile-rejection',
            error: { message: 'Fixture compile rejection.', offset: 0 },
          };
        }
        if (request.pattern === 'NO_MATCH') {
          return { ...base, status: 'no-match', matches: [] };
        }
        if (request.pattern === 'ZERO') {
          return {
            ...base,
            status: 'matched',
            matches: [
              {
                matchId: 'match-zero',
                ordinal: 1,
                value: '',
                span: { start: 1, end: 1, unit: 'fixture units' },
                captures: [],
              },
            ],
          };
        }
        if (request.pattern === 'SLOW' || request.pattern === 'FAST') {
          const value = request.pattern.toLowerCase();
          return {
            ...base,
            status: 'matched',
            matches: [
              {
                matchId: `match-${value}`,
                ordinal: 1,
                value,
                span: { start: 0, end: value.length, unit: 'fixture units' },
                captures: [],
              },
            ],
          };
        }
        return {
          ...base,
          status: 'matched',
          matches: [
            {
              matchId: 'match-1',
              ordinal: 1,
              value: 'alpha-1',
              span: { start: 0, end: 7, unit: 'fixture units' },
              captures: [
                {
                  captureId: 'capture-word-1',
                  index: 1,
                  name: 'word',
                  participation: 'participated',
                  value: 'alpha',
                  span: { start: 0, end: 5, unit: 'fixture units' },
                },
                {
                  captureId: 'capture-number-1',
                  index: 2,
                  participation: 'nonparticipating',
                },
                {
                  captureId: 'capture-unmatched-1',
                  index: 3,
                  participation: 'unmatched',
                },
              ],
            },
            {
              matchId: 'match-2',
              ordinal: 2,
              value: 'beta-2',
              span: { start: 8, end: 14, unit: 'fixture units' },
              captures: [
                {
                  captureId: 'capture-word-2',
                  index: 1,
                  name: 'word',
                  participation: 'participated',
                  value: 'beta',
                  span: { start: 8, end: 12, unit: 'fixture units' },
                },
                {
                  captureId: 'capture-number-2',
                  index: 2,
                  participation: 'unavailable',
                },
              ],
            },
          ],
        };
      },
    };
    const lab = element as any;
    lab.setProvider(fixtureProvider);
    lab.hydrate(state);
  }, fixtureLabState);
  await expect(page.locator('[data-lab-run-state]')).toContainText('matches');
}

test.describe('RegEx Lab foundation', () => {
  test('keeps production locked without a certified checkpoint', async ({
    page,
  }) => {
    await page.goto('/regex/lab/');
    await expect(page.locator('[data-lab-gate]')).toContainText(
      'Certified Lab profiles are not yet available',
    );
    await expect(page.locator('[data-lab-pattern]')).toBeDisabled();
    await expect(page.locator('[data-lab-state]')).not.toContainText(
      'test-only',
    );
  });

  test('hydrates profile-driven controls and reacts to every execution input', async ({
    page,
  }) => {
    await installFixtureLab(page);
    await expect(page.locator('[data-lab-gate]')).toBeHidden();
    await expect(page.locator('[data-lab-operation] option')).toHaveCount(2);
    await expect(page.locator('[data-lab-option]')).toHaveCount(2);

    await page.getByRole('button', { name: 'Change' }).click();
    await expect(
      page.getByRole('heading', { name: 'Where are you using RegEx?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Server / application' }).click();
    await expect(page.locator('[data-profile-name]')).toContainText(
      'Node.js 24',
    );

    const pattern = page.locator('[data-lab-pattern]');
    await pattern.fill('NO_MATCH');
    await expect(page.locator('[data-lab-run-state]')).toContainText(
      'No match',
    );
    await pattern.fill('[');
    await expect(page.locator('[data-lab-run-state]')).toContainText(
      'Pattern rejected',
    );
    await expect(page.locator('.lab-match-summary')).toHaveCount(0);

    await pattern.fill('MULTI');
    await expect(page.locator('.lab-match-summary')).toHaveCount(2);
    await page.locator('[data-lab-editor]').fill('alpha-1 beta-2 changed');
    await expect(page.locator('[data-lab-run-state]')).toContainText(
      '2 matches',
    );
    await page.getByLabel('Ignore case').check();
    await page.getByRole('tab', { name: 'Object' }).click();
    await expect(page.locator('[data-lab-raw-code]')).toContainText(
      '"ignore-case": true',
    );
    await expect(page.locator('[data-lab-raw-code]')).toContainText('changed');
  });

  test('protects against stale results and represents zero-width matches', async ({
    page,
  }) => {
    await installFixtureLab(page);
    const pattern = page.locator('[data-lab-pattern]');
    await pattern.fill('SLOW');
    await page.waitForTimeout(220);
    await pattern.fill('FAST');
    await expect(page.locator('.lab-match-summary code')).toHaveText('fast');
    await page.waitForTimeout(400);
    await expect(page.locator('.lab-match-summary code')).toHaveText('fast');

    await pattern.fill('ZERO');
    await expect(page.locator('.lab-zero-marker')).toHaveCount(1);
    await expect(page.locator('.lab-match-summary code')).toHaveText(
      '(zero-width)',
    );
  });

  test('synchronizes hover, pinning, keyboard clearing, and object-tree tabs', async ({
    page,
  }) => {
    await installFixtureLab(page);
    const firstMatch = page.locator('.lab-match-summary').first();
    await expect(page.locator('.lab-capture-summary').first()).toContainText(
      'word',
    );
    await expect(
      page.getByText('unmatched', { exact: true }).first(),
    ).toBeVisible();
    const decorated = page.locator(
      '[data-lab-editor] [data-inspection-refs~="match-1"]',
    );
    await firstMatch.hover();
    await expect(decorated.first()).toHaveClass(/is-inspected/);
    await firstMatch.click();
    await page.locator('h1').hover();
    await expect(decorated.first()).toHaveClass(/is-inspected/);
    await firstMatch.press('Escape');
    await expect(decorated.first()).not.toHaveClass(/is-inspected/);

    const decoratedCapture = page
      .locator('[data-lab-editor] [data-inspection-ref="capture-word-1"]')
      .first();
    await decoratedCapture.evaluate((element) => {
      const text = element.firstChild;
      if (!text) throw new Error('Expected decorated text node.');
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, Math.min(2, text.textContent?.length ?? 0));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      element.closest('[data-lab-editor]')?.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'ArrowRight',
          shiftKey: true,
          bubbles: true,
        }),
      );
    });
    await expect(
      page.locator(
        '.lab-capture-summary[data-inspection-ref="capture-word-1"]',
      ),
    ).toBeFocused();

    const objectTab = page.getByRole('tab', { name: 'Object' });
    await objectTab.click();
    await expect(
      page.locator('[data-lab-object-tree] details'),
    ).not.toHaveCount(0);
    await page
      .locator('[data-lab-object-tree] summary[data-tree-key="matches"]')
      .click();
    await page
      .locator('[data-lab-object-tree] summary[data-inspection-ref="match-1"]')
      .first()
      .click();
    await expect(decorated.first()).toHaveClass(/is-inspected/);
    await objectTab.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Matches' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('stacks in task order on narrow screens and passes axe', async ({
    page,
  }, testInfo) => {
    await installFixtureLab(page);
    const axe = await new AxeBuilder({ page })
      .exclude('[data-test-axe-exclude]')
      .analyze();
    expect(
      axe.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);

    if (testInfo.project.name.startsWith('mobile')) {
      const order = await page
        .locator('.lab-environment, .lab-pattern, .lab-text, .lab-results')
        .evaluateAll((nodes) =>
          nodes.map(
            (node) => (node as HTMLElement).getBoundingClientRect().top,
          ),
        );
      expect(order).toEqual([...order].sort((left, right) => left - right));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});
