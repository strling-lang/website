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
    testInfo.setTimeout(90_000);
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
    await expect(categoryNavigation.getByRole('link')).toHaveCount(15);
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
      categoryList.getByRole('link', { name: 'Grammar & composition (13)' }),
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
    await expect(categoryList.getByRole('link')).toHaveCount(15);

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
