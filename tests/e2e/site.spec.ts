import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

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
  '/learn/quickstart/',
  '/learn/from-regex/',
  '/learn/tour/',
  '/fourth-edition/',
  '/project/',
];

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
    ['/regex/compatibility/', 'RegEx Compatibility Check'],
  ] as const) {
    test(`${route} is an honest coming-soon destination`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(
        page.getByText('Coming soon', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex,follow',
      );
    });
  }

  test('Regex Feature Catalog exposes canonical categories and searchable features', async ({
    page,
  }) => {
    await page.goto('/regex/docs/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Regex Feature Catalog',
    );
    await expect(page.locator('.regex-category-card')).toHaveCount(14);
    await expect(page.locator('[data-regex-feature-item]')).toHaveCount(251);

    const search = page.getByLabel('Search the catalog');
    await search.fill('feature.word-boundary');
    await expect(page.locator('[data-regex-feature-item]:visible')).toHaveCount(
      1,
    );
    await expect(page.getByText('Showing 1 of 251 features.')).toBeVisible();
    await search.press('Tab');
    await expect(page.getByLabel('Category')).toBeFocused();
  });

  test('all canonical Regex Feature Catalog routes render exactly once', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    const routes = [...regexCategoryRoutes, ...regexFeatureRoutes];
    expect(new Set(routes).size).toBe(routes.length);
    expect(regexCategoryRoutes).toHaveLength(14);
    expect(regexFeatureRoutes).toHaveLength(251);
    for (let index = 0; index < routes.length; index += 20) {
      const batch = routes.slice(index, index + 20);
      const responses = await Promise.all(
        batch.map(async (route: string) => ({
          route,
          response: await request.get(route),
        })),
      );
      for (const { route, response } of responses)
        expect(response.status(), route).toBe(200);
    }
  });

  test('category and feature pages expose canonical metadata and breadcrumbs', async ({
    page,
  }) => {
    await page.goto(sampleRegexCategory);
    await expect(page.locator('[data-semantic-category-id]')).toHaveAttribute(
      'data-semantic-category-id',
      'character-classes',
    );
    await expect(page.locator('.regex-category-features')).toContainText(
      'Word-character shorthand class',
    );

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

test.describe('metadata and discoverability', () => {
  for (const route of [
    '/',
    '/docs/composition/',
    sampleRegexFeature,
    '/packages/typescript/',
    '/fourth-edition/',
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
      'Pre-release',
    );
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/regex/');
    expect(sitemap).toContain(sampleRegexCategory);
    expect(sitemap).toContain(sampleRegexFeature);
    expect(sitemap).not.toContain('/lab/');
    expect(sitemap).not.toContain('/regex/lab/');
    expect(sitemap).not.toContain('/regex/compatibility/');
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
    expect(hrefs).toContain('/fourth-edition/');
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

  test('RegEx category selector stays sticky while only its category list scrolls', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'));
    await page.goto(sampleRegexCategory);

    const header = page.locator('.site-header');
    const sidebar = page.locator('.regex-docs-sidebar');
    const catalogOverview = sidebar.getByRole('link', {
      name: 'Catalog overview',
    });
    const categoryControl = sidebar.locator('summary');
    const categoryList = sidebar.getByRole('navigation', {
      name: 'Regex feature categories',
    });
    const categoryLinks = categoryList.getByRole('link');

    await expect(categoryLinks).toHaveCount(14);
    await expect(
      categoryList.getByRole('link', { name: /Character classes/ }),
    ).toHaveAttribute('aria-current', 'page');

    const initialSidebarBox = await sidebar.boundingBox();
    expect(initialSidebarBox).not.toBeNull();

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 600);
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);

    const headerBox = await header.boundingBox();
    const stickyBox = await sidebar.boundingBox();
    const stickyTop = await sidebar.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).top),
    );
    expect(headerBox).not.toBeNull();
    expect(stickyBox).not.toBeNull();
    expect(Math.abs(stickyBox!.x - initialSidebarBox!.x)).toBeLessThanOrEqual(
      1,
    );
    expect(
      Math.abs(stickyBox!.width - initialSidebarBox!.width),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(stickyBox!.y - initialSidebarBox!.y)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(stickyBox!.y - stickyTop)).toBeLessThanOrEqual(1);
    expect(stickyBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height,
    );

    const overviewBox = await catalogOverview.boundingBox();
    const controlBox = await categoryControl.boundingBox();
    expect(overviewBox).not.toBeNull();
    expect(controlBox).not.toBeNull();

    await page.evaluate(() => window.scrollBy(0, 600));
    await expect
      .poll(async () =>
        Math.abs((await sidebar.boundingBox())!.y - stickyBox!.y),
      )
      .toBeLessThanOrEqual(2);
    expect(
      Math.abs((await catalogOverview.boundingBox())!.y - overviewBox!.y),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs((await categoryControl.boundingBox())!.y - controlBox!.y),
    ).toBeLessThanOrEqual(2);

    const documentScrollTop = await page.evaluate(() => window.scrollY);
    const listBox = await categoryList.boundingBox();
    const firstLink = categoryLinks.first();
    const lastLink = categoryLinks.last();
    const firstLinkBox = await firstLink.boundingBox();
    expect(listBox).not.toBeNull();
    expect(firstLinkBox).not.toBeNull();

    await page.mouse.move(
      listBox!.x + listBox!.width / 2,
      listBox!.y + listBox!.height / 2,
    );
    await page.mouse.wheel(0, 10_000);
    await expect
      .poll(() => categoryList.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    const bottomScrollState = await categoryList.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }));
    const lastLinkBox = await lastLink.boundingBox();
    expect(
      bottomScrollState.scrollTop + bottomScrollState.clientHeight,
    ).toBeGreaterThanOrEqual(bottomScrollState.scrollHeight - 2);
    expect(lastLinkBox).not.toBeNull();
    expect(lastLinkBox!.y + lastLinkBox!.height).toBeLessThanOrEqual(
      listBox!.y + listBox!.height + 2,
    );
    expect((await firstLink.boundingBox())!.y).toBeLessThan(firstLinkBox!.y);
    expect(
      Math.abs((await catalogOverview.boundingBox())!.y - overviewBox!.y),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs((await categoryControl.boundingBox())!.y - controlBox!.y),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - documentScrollTop),
    ).toBeLessThanOrEqual(2);

    await page.mouse.wheel(0, -10_000);
    await expect
      .poll(() => categoryList.evaluate((element) => element.scrollTop))
      .toBeLessThanOrEqual(1);
    const restoredFirstLinkBox = await firstLink.boundingBox();
    expect(restoredFirstLinkBox).not.toBeNull();
    expect(restoredFirstLinkBox!.y).toBeGreaterThanOrEqual(listBox!.y - 2);
  });

  test('RegEx category selector returns to normal flow on mobile', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'));
    await page.goto(sampleRegexCategory);

    const sidebar = page.locator('.regex-docs-sidebar');
    const disclosure = sidebar.locator('details');
    const categoryList = sidebar.getByRole('navigation', {
      name: 'Regex feature categories',
    });

    await expect(sidebar).toHaveCSS('position', 'static');
    await expect(disclosure).not.toHaveAttribute('open', '');
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(categoryList).toHaveCSS('overflow-y', 'visible');

    const listOverflow = await categoryList.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    );
    const pageOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(listOverflow).toBeLessThanOrEqual(1);
    expect(pageOverflow).toBeLessThanOrEqual(1);

    await categoryList.getByRole('link').last().scrollIntoViewIfNeeded();
    await expect(categoryList.getByRole('link').last()).toBeInViewport();
    await disclosure.locator('summary').click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const route of [
    '/',
    '/packages/',
    '/docs/composition/',
    '/learn/tour/',
    '/fourth-edition/',
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
    '/fourth-edition/',
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
