import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
    ['/regex/docs/', 'RegEx Docs'],
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
    expect(sitemap).not.toContain('/lab/');
    expect(sitemap).not.toContain('/regex/docs/');
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

  for (const route of [
    '/',
    '/packages/',
    '/docs/composition/',
    '/learn/tour/',
    '/fourth-edition/',
    '/lab/',
    '/regex/',
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
