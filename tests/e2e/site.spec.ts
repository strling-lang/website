import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { bindings } from '../../src/data/bindings';
import { fourthEdition, releaseLabel } from '../../src/data/release';

const regexProjection = JSON.parse(
  readFileSync(
    new URL('../../src/data/regex-docs/projection.json', import.meta.url),
    'utf8',
  ),
);
const regexCategoryRoutes = regexProjection.categories.map(
  (category: { route: string }) => category.route,
);
const regexFeatureRoutes = regexProjection.features.map(
  (feature: { route: string }) => feature.route,
);
const sampleRegexCategory = '/regex/docs/character-classes/';
const sampleRegexFeature = '/regex/docs/character-classes/word-class/';
const fundamentals = [
  '/learn/quickstart/',
  '/learn/from-regex/',
  '/learn/tour/',
];
const advancedLessons = [
  {
    route: '/learn/production-event-logs/',
    title: 'Production event logs',
    time: '30 minutes',
  },
  {
    route: '/learn/versioned-api-routes/',
    title: 'Versioned API routes',
    time: '35 minutes',
  },
  {
    route: '/learn/policy-driven-import-records/',
    title: 'Policy-driven import records',
    time: '40 minutes',
  },
];
const frontierRoute = '/learn/nested-sequence-hypotheses/';
const advancedRoutes = advancedLessons.map(({ route }) => route);
const knownMojibakeSequences = [
  '\u00e2\u2020\u2019',
  '\u00e2\u20ac\u201d',
  '\u00e2\u20ac\u201c',
  '\u00e2\u20ac\u2122',
  '\u00c2',
  '\u00c3',
  '\u00f0\u0178',
  '\ufffd',
];

const requiredRoutes = [
  '/',
  '/why-strling/',
  '/packages/',
  '/packages/typescript/',
  '/packages/python/',
  '/packages/rust/',
  '/docs/',
  '/docs/core-concepts/',
  '/docs/composition/',
  '/docs/lookarounds/',
  '/docs/compatibility/',
  '/lab/',
  '/regex/',
  '/regex/docs/',
  sampleRegexCategory,
  sampleRegexFeature,
  '/regex/lab/',
  '/regex/compatibility/',
  '/learn/',
  ...fundamentals,
  ...advancedRoutes,
  frontierRoute,
  '/project/',
];

test('package cards and detail pages display the same distribution and support', async ({
  page,
  request,
}) => {
  await page.goto('/packages/');
  await expect(page.locator('.package-card')).toHaveCount(bindings.length);
  for (const binding of bindings) {
    const route = `/packages/${binding.slug}/`;
    const card = page
      .locator('.package-card')
      .filter({ has: page.locator(`a[href="${route}"]`) });
    await expect(card.locator('.package-meta')).toContainText(
      binding.package.version,
    );
    await expect(card.locator('.package-meta')).toContainText(binding.support);
    const row = page
      .getByRole('row')
      .filter({ has: page.locator(`a[href="${route}"]`) });
    await expect(row).toContainText(binding.status);
    await expect(row).toContainText(binding.package.version);
    await expect(row).toContainText(binding.support);
    const detail = await request.get(route);
    expect(detail.ok(), route).toBe(true);
    expect(await detail.text(), route).toContain(binding.package.url);
  }
  await page.getByRole('link', { name: 'View Go binding' }).click();
  await expect(
    page.getByRole('heading', { name: 'STRling for Go' }),
  ).toBeVisible();
  await expect(page.locator('main pre code')).toHaveText(
    bindings.find((b) => b.slug === 'go')!.install!,
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test('TypeScript Preview links to post-publication release evidence', async ({
  page,
}) => {
  await page.goto('/packages/typescript/');
  await expect(
    page.getByText('The npm package declares Node.js >=22 <23.', {
      exact: false,
    }),
  ).toContainText('have no Supported guarantee');
  await page
    .getByRole('link', { name: 'release and verification status', exact: true })
    .click();
  await expect(page).toHaveURL(/\/project\/#release-status$/);
  const status = page.getByRole('region', {
    name: 'Release and verification status',
  });
  await expect(status).toContainText(
    '232 checks across the 16 distribution routes',
  );
  await expect(
    status.getByRole('link', {
      name: 'Completed independent public verification',
    }),
  ).toHaveAttribute('href', fourthEdition.verificationRun);
  await expect(
    status.getByRole('link', {
      name: 'Historical support matrix and runtime scopes',
    }),
  ).toHaveAttribute('href', new RegExp(fourthEdition.certificationClosure));
});

test.describe('routes', () => {
  for (const route of requiredRoutes) {
    test(`${route} renders static content`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).not.toBeEmpty();
    });
  }

  test('unknown routes use the custom 404', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'pattern did not match',
    );
  });

  test('the Fourth Edition route returns 404', async ({ request }) => {
    const response = await request.get('/fourth-edition/');
    expect(response.status()).toBe(404);
  });

  test('STRling Docs remains available documentation', async ({ page }) => {
    await page.goto('/docs/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'STRling documentation',
    );
    await expect(
      page.locator('main a[href="/docs/core-concepts/"]').first(),
    ).toBeVisible();
    await expect(page.getByText('Coming soon', { exact: true })).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  for (const [route, heading] of [
    ['/lab/', 'STRling Lab'],
    ['/regex/lab/', 'RegEx Lab'],
  ] as const) {
    test(`${route} opens an indexed Lab workbench`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(
        page.getByRole('button', { name: /^Run/ }).first(),
      ).toBeEnabled();
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }

  test('Regex Feature Catalog exposes canonical categories and searchable features', async ({
    page,
  }) => {
    await page.goto('/regex/docs/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Regex Feature Catalog',
    );
    await expect(
      page
        .locator('section:has(.regex-catalog-intro) + section')
        .getByRole('heading', { name: 'Find a feature', exact: true }),
    ).toBeVisible();
    const category = page.getByLabel('Category', { exact: true });
    await expect(category.locator('option:not([value=""])')).toHaveCount(
      regexCategoryRoutes.length,
    );
    await expect(page.locator('[data-regex-feature-item]')).toHaveCount(
      regexFeatureRoutes.length,
    );

    const search = page.getByLabel('Search the catalog');
    await search.fill('feature.word-boundary');
    await expect(page.locator('[data-regex-feature-item]:visible')).toHaveCount(
      1,
    );
    await expect(
      page.getByText(`Showing 1 of ${regexFeatureRoutes.length} features.`),
    ).toBeVisible();
    await search.press('Tab');
    await expect(category).toBeFocused();
  });

  test('all canonical Regex Feature Catalog routes render exactly once', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    testInfo.setTimeout(90_000);
    const routes = [...regexCategoryRoutes, ...regexFeatureRoutes];
    expect(new Set(routes).size).toBe(routes.length);
    expect(regexCategoryRoutes).toHaveLength(16);
    expect(regexFeatureRoutes).toHaveLength(269);
    for (let index = 0; index < routes.length; index += 20) {
      const batch = routes.slice(index, index + 20);
      const responses = await Promise.all(
        batch.map(async (route: string) => ({
          route,
          response: await request.get(route),
        })),
      );
      for (const { route, response } of responses) {
        expect(response.status(), route).toBe(200);
        const html = await response.text();
        expect(
          knownMojibakeSequences.filter((sequence) => html.includes(sequence)),
          route,
        ).toEqual([]);
      }
    }
  });

  test('category and feature pages expose canonical metadata and breadcrumbs', async ({
    page,
  }, testInfo) => {
    await page.goto(sampleRegexCategory);
    await expect(page.locator('[data-semantic-category-id]')).toHaveAttribute(
      'data-semantic-category-id',
      'character-classes',
    );
    await expect(page.locator('.regex-category-features')).toContainText(
      'Word-character shorthand class',
    );
    await expect(page.locator('.docs-shell')).toBeVisible();
    await expect(page.locator('.docs-sidebar')).toBeVisible();
    await expect(page.locator('.regex-category-page')).toBeVisible();
    if (testInfo.project.name.startsWith('mobile')) {
      await expect(page.locator('.docs-toc')).toBeHidden();
    } else {
      await expect(page.locator('.docs-toc')).toBeVisible();
    }
    await expect(page.locator('.regex-docs-sidebar')).toHaveCount(0);
    await expect(page.locator('.docs-sidebar details')).toHaveCount(0);

    const categoryNavigation = page.getByRole('navigation', {
      name: 'Regex feature categories',
    });
    await expect(categoryNavigation.getByRole('link')).toHaveCount(
      regexCategoryRoutes.length + 1,
    );
    await expect(
      categoryNavigation.getByRole('link', {
        name: 'Character classes (27)',
      }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      categoryNavigation.getByRole('link', {
        name: 'Approximate & multi-pattern (24)',
      }),
    ).toBeAttached();
    await expect(
      categoryNavigation.getByText(
        'Approximate, partial, streaming and multi-pattern',
      ),
    ).toHaveCount(0);
    await expect(
      page.locator('.docs-toc a[href="#category-organization"]'),
    ).toHaveAttribute('href', '#category-organization');

    await page.goto(sampleRegexFeature);
    await expect(page.locator('[data-semantic-feature-id]')).toHaveAttribute(
      'data-semantic-feature-id',
      'feature.word-class',
    );
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link'),
    ).toHaveCount(4);
    await expect(
      page.getByText(/Compatibility evidence is not yet available/),
    ).toBeVisible();
  });

  test('promoted source renders new categories, assertion concepts and moved features', async ({
    page,
    request,
  }) => {
    const route = '/regex/docs/lookaround/captured-substring-assertion/';
    await page.goto(route);
    await expect(page.locator('[data-semantic-feature-id]')).toHaveAttribute(
      'data-semantic-feature-id',
      'feature.captured-substring-assertion',
    );
    await expect(page.locator('[data-source-semantic-digest]')).toHaveAttribute(
      'data-source-semantic-digest',
      regexProjection.source.semanticDigest,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://strling-lang.netlify.app${route}`,
    );
    await expect(
      page.locator('section[aria-labelledby="test-concepts"] li'),
    ).toHaveCount(3);
    await expect(
      page.locator('section[aria-labelledby="test-concepts"]'),
    ).not.toContainText('undefined');
    const severe = (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(severe).toEqual([]);
    for (const path of [
      '/regex/docs/options-and-state/',
      '/regex/docs/options-and-state/scoped-modifier-group/',
      '/regex/docs/host-operations-and-results/reset-reported-match-start/',
      '/regex/docs/host-operations-and-results/reset-reported-match-end/',
    ])
      expect((await request.get(path)).status(), path).toBe(200);
  });

  test('RegEx hub links all three feature destinations', async ({ page }) => {
    await page.goto('/regex/');
    for (const route of [
      '/regex/docs/',
      '/regex/lab/',
      '/regex/compatibility/',
    ]) {
      await expect(
        page.locator(`main a[href="${route}"]`).first(),
      ).toBeVisible();
    }
  });
});

test.describe('advanced learning', () => {
  test('groups all seven lessons into ordered learning sections', async ({
    page,
  }) => {
    await page.goto('/learn/');
    const fundamentalSection = page.getByRole('region', {
      name: 'Learn the fundamentals',
    });
    const advancedSection = page.getByRole('region', {
      name: 'Compose patterns for real systems',
    });
    for (const [section, expected] of [
      [fundamentalSection, fundamentals],
      [advancedSection, advancedRoutes],
      [
        page.getByRole('region', {
          name: 'Make complex patterns communicable',
        }),
        [frontierRoute],
      ],
    ] as const) {
      const cards = section.locator('.package-card');
      await expect(cards).toHaveCount(expected.length);
      expect(
        await cards
          .getByRole('link')
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute('href')),
          ),
      ).toEqual(expected);
    }
    for (const [index, { title, time }] of advancedLessons.entries()) {
      const card = advancedSection.locator('.package-card').nth(index);
      await expect(card.locator('.feature-number')).toHaveText(`0${index + 4}`);
      await expect(card.getByText(`${time} · Advanced`)).toBeVisible();
      await expect(
        card.getByRole('link', { name: `Begin ${title}` }),
      ).toBeVisible();
    }
    await advancedSection
      .getByRole('link', { name: 'Begin Production event logs' })
      .click();
    await expect(page).toHaveURL(/\/learn\/production-event-logs\/$/);
  });

  test('cards and lesson headers share all seven classifications', async ({
    page,
    request,
  }, testInfo) => {
    for (const [route, time, label] of [
      ...fundamentals.map((route, i) => [
        route,
        [10, 15, 25][i] + ' minutes',
        'Beginner',
      ]),
      ...advancedLessons.map(({ route, time }) => [route, time, 'Advanced']),
      [frontierRoute, '60 minutes', 'Frontier'],
    ] as const) {
      await page.goto('/learn/');
      const card = page
        .locator('article')
        .filter({ has: page.locator(`a[href="${route}"]`) });
      await expect(card.getByText(`${time} · ${label}`)).toBeVisible();
      await card.getByRole('link').click();
      await expect(page.locator('.doc-header')).toContainText(
        `${time} · ${label}`,
      );
    }
    await expect(page.locator('h1')).toHaveText(
      'Communicating a nested sequence hypothesis',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://strling-lang.netlify.app' + frontierRoute,
    );
    const downloads = page.locator('main a[download]');
    await expect(downloads).toHaveCount(8);
    const links = page.locator(
      'main a[download], main nav[aria-label="Related pages"] a',
    );
    for (const href of await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')!),
    )) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.locator('h1').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('frontier-lesson.png') });
    const source = page.getByRole('link', {
      name: 'Witness evaluator',
      exact: true,
    });
    await source.focus();
    await expect(source).toBeFocused();
  });

  for (const { route, title } of advancedLessons) {
    test(`${title} has exact metadata and usable learning links`, async ({
      page,
      request,
    }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://strling-lang.netlify.app${route}`,
      );
      const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
      await expect(
        breadcrumb.getByRole('link', { name: 'Learn' }),
      ).toHaveAttribute('href', '/learn/');
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(
        title,
      );

      const related = page
        .getByRole('navigation', { name: 'Related pages' })
        .getByRole('link');
      expect(await related.count()).toBeGreaterThanOrEqual(3);
      for (const href of await related.evaluateAll((links) =>
        links.map((link) => link.getAttribute('href') ?? ''),
      )) {
        expect((await request.get(href)).status(), href).toBe(200);
      }

      const toc = page.locator('.docs-toc');
      const anchors = toc.locator('a');
      expect(await anchors.count()).toBeGreaterThanOrEqual(6);
      for (const id of await anchors.evaluateAll((links) =>
        links.map((link) => link.getAttribute('href')?.slice(1)),
      )) {
        await expect(page.locator(`main [id="${id}"]`)).toHaveCount(1);
      }
      if (await toc.isVisible()) {
        const link = anchors.first();
        await link.focus();
        await expect(link).toBeFocused();
        expect(
          await link.evaluate(
            (element) => getComputedStyle(element).outlineStyle,
          ),
        ).toBe('solid');
        await link.press('Enter');
        expect(new URL(page.url()).hash).toBe(await link.getAttribute('href'));
      }

      const code = page.locator('.prose pre');
      expect(await code.count()).toBeGreaterThanOrEqual(4);
      const sourcePath = `/examples/pattern-engineering/${route.split('/')[2]}.ts`;
      await expect(
        page.locator(`a[download][href="${sourcePath}"]`).first(),
      ).toBeVisible();
      expect((await request.get(sourcePath)).status()).toBe(200);
      expect(
        await code.evaluateAll((blocks) =>
          blocks.every((block) => {
            const { left, right } = block.getBoundingClientRect();
            return (
              left >= 0 &&
              right <= document.documentElement.clientWidth + 1 &&
              getComputedStyle(block).overflowX === 'auto'
            );
          }),
        ),
      ).toBe(true);
    });
  }
});

test.describe('metadata and discoverability', () => {
  for (const route of [
    '/',
    '/learn/',
    '/docs/composition/',
    sampleRegexFeature,
    '/packages/typescript/',
    ...advancedRoutes,
    frontierRoute,
  ]) {
    test(`${route} has complete metadata`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle(/STRling/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /.+/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /^https:\/\/strling-lang\.netlify\.app\//,
      );
      await expect(page.locator('link[rel="icon"]')).toHaveCount(2);
      await expect(
        page.locator('link[rel="icon"][href="/favicon.ico"]'),
      ).toHaveAttribute('sizes', '16x16 32x32 48x48');
      await expect(
        page.locator('link[rel="icon"][href="/favicon-32x32.png"]'),
      ).toHaveAttribute('type', 'image/png');
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        /STRling/,
      );
      await expect(
        page.locator('script[type="application/ld+json"]'),
      ).toHaveCount(1);
    });
  }

  test('SEO and AI artifacts are emitted', async ({ request }) => {
    for (const route of [
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/llms-full.txt',
    ]) {
      const response = await request.get(route);
      expect(response.status(), route).toBe(200);
      expect((await response.text()).length, route).toBeGreaterThan(50);
    }
    expect(await (await request.get('/llms.txt')).text()).toContain(
      `Fourth Edition: ${releaseLabel}, released ${fourthEdition.releaseDate}`,
    );
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const llms = await (await request.get('/llms-full.txt')).text();
    for (const route of [...advancedRoutes, frontierRoute]) {
      expect(sitemap).toContain(
        `<loc>https://strling-lang.netlify.app${route}</loc>`,
      );
      expect(llms).toContain(`https://strling-lang.netlify.app${route}`);
    }
    expect(sitemap).toContain('/regex/');
    expect(sitemap).toContain(sampleRegexCategory);
    expect(sitemap).toContain(sampleRegexFeature);
    for (const route of ['/lab/', '/regex/lab/']) {
      expect(sitemap).toContain(
        '<loc>https://strling-lang.netlify.app' + route + '</loc>',
      );
    }
    expect(sitemap).not.toContain('/lab/guide/');
    expect(sitemap).not.toContain('/regex/compatibility/');
  });

  test('the removed Lab Guide returns 404 and neither Lab links to it', async ({
    page,
    request,
  }) => {
    const removed = await request.get('/lab/guide/', { maxRedirects: 0 });
    expect(removed.status()).toBe(404);
    for (const route of ['/lab/', '/regex/lab/']) {
      await page.goto(route);
      await expect(page.locator('a[href*="/lab/guide"]')).toHaveCount(0);
    }
  });

  test('favicon assets are emitted with image content types', async ({
    request,
  }) => {
    const ico = await request.get('/favicon.ico');
    expect(ico.status()).toBe(200);
    expect(ico.headers()['content-type']).toMatch(
      /^image\/(vnd\.microsoft\.icon|x-icon)/,
    );
    expect((await ico.body()).length).toBeGreaterThan(1000);

    const png = await request.get('/favicon-32x32.png');
    expect(png.status()).toBe(200);
    expect(png.headers()['content-type']).toContain('image/png');
    expect((await png.body()).length).toBeGreaterThan(1000);
  });
});

test.describe('responsive interaction', () => {
  test('primary desktop navigation uses real routes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    await page.goto('/');
    const hrefs = await page
      .locator('.desktop-nav[data-primary-nav] a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).toContain('/learn/');
    expect(hrefs).toContain('/docs/');
    expect(hrefs).toContain('/lab/');
    expect(hrefs).toContain('/packages/');
    expect(hrefs).not.toContain('/fourth-edition/');
    expect(hrefs).toContain('/why-strling/');
    expect(hrefs.some((href) => href?.startsWith('#'))).toBe(false);

    const regexMenu = page.locator('.desktop-nav .regex-nav');
    await expect(regexMenu.locator('summary')).toHaveText(/RegEx/);
    await regexMenu.locator('summary').click();
    for (const label of ['RegEx Docs', 'RegEx Lab', 'Compatibility Check']) {
      await expect(regexMenu.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('RegEx desktop navigation is keyboard accessible and marks only the current page', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    await page.goto('/regex/lab/');
    const regexMenu = page.locator('.desktop-nav .regex-nav');
    const summary = regexMenu.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(regexMenu).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(
      regexMenu.getByRole('link', { name: 'RegEx overview' }),
    ).toBeFocused();
    await expect(summary).not.toHaveAttribute('aria-current', 'page');
    await expect(
      regexMenu.getByRole('link', { name: 'RegEx Lab' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('RegEx desktop navigation dismisses when clicking outside it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    await page.goto('/regex/');

    const regexMenu = page.locator('.desktop-nav .regex-nav');
    await regexMenu.locator('summary').click();
    await expect(regexMenu).toHaveAttribute('open', '');

    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await expect(regexMenu).not.toHaveAttribute('open', '');
  });

  test('mobile navigation opens and remains keyboard reachable', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'));
    await page.goto('/');
    const menu = page.locator('.mobile-nav');
    await expect(menu).toBeVisible();
    await menu.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(
      menu.getByRole('link', { name: 'Docs', exact: true }),
    ).toBeVisible();
    const regexGroup = menu.locator('.mobile-nav-group');
    await expect(
      regexGroup.getByRole('link', { name: 'RegEx', exact: true }),
    ).toBeVisible();
    for (const label of ['RegEx Docs', 'RegEx Lab', 'Compatibility Check']) {
      await expect(regexGroup.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('shared documentation asides remain stationary and scroll only their navigation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    await page.setViewportSize({ width: 1440, height: 400 });

    for (const route of ['/docs/anchors-and-boundaries/', '/learn/tour/']) {
      await page.goto(route);
      const asides = page.locator('.docs-sidebar, .docs-toc:visible');
      const count = await asides.count();
      expect(count, route).toBeGreaterThan(0);

      for (let index = 0; index < count; index += 1) {
        const aside = asides.nth(index);
        const persistentHeading = aside.locator(':scope > .eyebrow');
        const scroller = aside.locator(':scope > nav, :scope > ul');
        await expect(aside).toHaveCSS('position', 'sticky');
        await expect(scroller).toHaveCSS('overflow-y', 'auto');

        const initialAside = await aside.boundingBox();
        const initialHeading = await persistentHeading.boundingBox();
        expect(initialAside).not.toBeNull();
        expect(initialHeading).not.toBeNull();

        await page.evaluate(() => {
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo(0, 400);
        });
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(0);
        const stickyAside = await aside.boundingBox();
        expect(stickyAside).not.toBeNull();
        expect(Math.abs(stickyAside!.y - initialAside!.y)).toBeLessThanOrEqual(
          1,
        );
        expect(Math.abs(stickyAside!.x - initialAside!.x)).toBeLessThanOrEqual(
          1,
        );

        const scrollState = await scroller.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        if (scrollState.scrollHeight > scrollState.clientHeight) {
          await scroller.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await expect
            .poll(() => scroller.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
        }
        expect(
          Math.abs(
            (await persistentHeading.boundingBox())!.y - initialHeading!.y,
          ),
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  test('RegEx category page keeps the standard docs grid while its sidebar stays fixed in place', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    await page.setViewportSize({ width: 1440, height: 700 });
    const captureHorizontalLayout = async () => {
      const shell = page.locator('.docs-shell');
      const sidebar = page.locator('.docs-sidebar');
      const article = shell.locator('article');
      const toc = page.locator('.docs-toc');
      const sidebarBox = await sidebar.boundingBox();
      const articleBox = await article.boundingBox();
      const tocBox = await toc.boundingBox();
      expect(sidebarBox).not.toBeNull();
      expect(articleBox).not.toBeNull();
      expect(tocBox).not.toBeNull();
      return {
        articleWidth: articleBox!.width,
        columns: await shell.evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns,
        ),
        sidebarLeft: sidebarBox!.x,
        sidebarWidth: sidebarBox!.width,
        tocLeft: tocBox!.x,
      };
    };

    await page.goto('/docs/anchors-and-boundaries/');
    const standardDocsLayout = await captureHorizontalLayout();

    await page.goto('/regex/docs/grammar-and-composition/');
    const regexDocsLayout = await captureHorizontalLayout();
    expect(regexDocsLayout).toEqual(standardDocsLayout);

    const header = page.locator('.site-header');
    const sidebar = page.locator('.docs-sidebar');
    const categoryList = sidebar.getByRole('navigation', {
      name: 'Regex feature categories',
    });
    const catalogOverview = categoryList.getByRole('link', {
      name: 'Catalog overview',
    });
    await expect(sidebar).toHaveCSS('position', 'sticky');
    await expect(categoryList).toHaveCSS('overflow-y', 'auto');
    await expect(
      categoryList.getByRole('link', { name: 'Grammar & composition (21)' }),
    ).toHaveAttribute('aria-current', 'page');

    const initialSidebar = await sidebar.boundingBox();
    const initialOverview = await catalogOverview.boundingBox();
    expect(initialSidebar).not.toBeNull();
    expect(initialOverview).not.toBeNull();

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 900);
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    const stickySidebar = await sidebar.boundingBox();
    const stickyOverview = await catalogOverview.boundingBox();
    const headerBox = await header.boundingBox();
    expect(stickySidebar).not.toBeNull();
    expect(stickyOverview).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(Math.abs(stickySidebar!.x - initialSidebar!.x)).toBeLessThanOrEqual(
      1,
    );
    expect(
      Math.abs(stickySidebar!.width - initialSidebar!.width),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(stickySidebar!.y - initialSidebar!.y)).toBeLessThanOrEqual(
      1,
    );
    expect(stickySidebar!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height,
    );

    const listBox = await categoryList.boundingBox();
    expect(listBox).not.toBeNull();
    await page.mouse.move(
      listBox!.x + listBox!.width / 2,
      listBox!.y + listBox!.height / 2,
    );
    await page.mouse.wheel(0, 10_000);
    await expect
      .poll(() => categoryList.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await expect(categoryList.getByRole('link').last()).toBeInViewport();
    expect(
      Math.abs((await catalogOverview.boundingBox())!.y - stickyOverview!.y),
    ).toBeLessThanOrEqual(1);

    await page.mouse.wheel(0, -10_000);
    await expect
      .poll(() => categoryList.evaluate((element) => element.scrollTop))
      .toBeLessThanOrEqual(1);
    expect(
      Math.abs((await catalogOverview.boundingBox())!.y - initialOverview!.y),
    ).toBeLessThanOrEqual(1);
  });

  test('RegEx category navigation uses standard docs responsive flow', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'));
    await page.goto(sampleRegexCategory);

    const sidebar = page.locator('.docs-sidebar');
    const toc = page.locator('.docs-toc');
    const categoryList = sidebar.getByRole('navigation', {
      name: 'Regex feature categories',
    });

    await expect(sidebar).toHaveCSS('position', 'static');
    await expect(toc).toBeHidden();
    await expect(sidebar.locator('details')).toHaveCount(0);
    await expect(categoryList.getByRole('link')).toHaveCount(
      regexCategoryRoutes.length + 1,
    );

    const pageOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(1);

    await categoryList.getByRole('link').last().scrollIntoViewIfNeeded();
    await expect(categoryList.getByRole('link').last()).toBeInViewport();
  });

  for (const route of [
    '/',
    '/packages/',
    '/docs/composition/',
    '/learn/tour/',
    '/learn/',
    ...advancedRoutes,
    frontierRoute,
    '/lab/',
    '/regex/',
    '/regex/docs/',
    sampleRegexCategory,
    sampleRegexFeature,
    '/regex/compatibility/',
  ]) {
    test(`${route} has no horizontal page overflow`, async ({ page }) => {
      await page.goto(route);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('documentation navigation and code remain usable on mobile', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'));
    await page.goto('/docs/core-concepts/');
    await expect(page.locator('.docs-sidebar')).toBeVisible();
    await expect(page.locator('.prose pre').first()).toBeVisible();
    const preOverflow = await page
      .locator('.prose pre')
      .first()
      .evaluate((element) => element.scrollWidth >= element.clientWidth);
    expect(preOverflow).toBe(true);
  });
});

test.describe('related pages', () => {
  test('desktop grid items align and do not overflow', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));

    await page.goto('/learn/tour/');
    const related = page.getByRole('navigation', { name: 'Related pages' });
    const heading = related.getByRole('heading', { level: 2 });
    const items = related.locator('li');
    await expect(related).toBeVisible();
    await expect(items).toHaveCount(3);

    const [headingBox, firstBox, secondBox] = await Promise.all([
      heading.boundingBox(),
      items.nth(0).boundingBox(),
      items.nth(1).boundingBox(),
    ]);
    expect(headingBox).not.toBeNull();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(firstBox!.y - (headingBox!.y + headingBox!.height)).toBeGreaterThan(
      0,
    );
    expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThanOrEqual(1);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('mobile related pages collapse to one visible column', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'));

    await page.goto('/learn/tour/');
    const related = page.getByRole('navigation', { name: 'Related pages' });
    const heading = related.getByRole('heading', { level: 2 });
    const list = related.locator('ul');
    const links = related.getByRole('link');
    await expect(related).toBeVisible();
    await expect(links).toHaveCount(3);
    await expect(links.first()).toBeVisible();
    const [headingBox, firstBox] = await Promise.all([
      heading.boundingBox(),
      links.first().boundingBox(),
    ]);
    expect(headingBox).not.toBeNull();
    expect(firstBox).not.toBeNull();
    expect(firstBox!.y - (headingBox!.y + headingBox!.height)).toBeGreaterThan(
      0,
    );

    const columnCount = await list.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/)
          .length,
    );
    expect(columnCount).toBe(1);
  });
});

test.describe('accessibility', () => {
  for (const route of [
    '/',
    '/packages/',
    '/docs/core-concepts/',
    '/learn/quickstart/',
    '/learn/',
    ...advancedRoutes,
    frontierRoute,
    '/regex/',
    '/lab/',
    '/regex/docs/',
    sampleRegexCategory,
    sampleRegexFeature,
  ]) {
    test(`${route} has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const severe = results.violations.filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(severe).toEqual([]);
    });
  }

  test('skip link reaches main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});
