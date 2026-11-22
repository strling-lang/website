import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

const status = (page: Page) => page.locator('[data-output="status"]');
const source = (page: Page) =>
  page.getByRole('textbox', { name: 'Pattern or STRling source' });
const subject = (page: Page) =>
  page.getByRole('textbox', { name: 'Subject text' });
const tab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true }).click();
// Explicit Run remains available via the keyboard even if automatic STRling
// compilation temporarily gives the primary button its Stop action.
const run = (page: Page) =>
  page.locator('[data-action="run"]').press('ControlOrMeta+Enter');
const executionWorker = /\/execution\.worker-[^/]+\.js$/;
const compilerAsset =
  /\/_strling-lab\/compiler-tools-[^/]+-[a-f0-9]{64}\.wasm$/;
const releaseManifest = JSON.parse(
  await readFile(
    new URL('../../scripts/lab-compiler-release.json', import.meta.url),
    'utf8',
  ),
);
const compilerToolsEnabled =
  releaseManifest.mode === 'certified' ||
  Boolean(process.env.STRLING_LAB_TOOLS_CANDIDATE);

async function edit(page: Page, editor: Locator, value: string) {
  const lines = value.split('\n');
  if (page.context().browser()?.browserType().name() === 'firefox') {
    // Firefox's contenteditable fill can apply the deletion without inserting.
    await editor.click();
    await page.keyboard.press('ControlOrMeta+KeyA');
    await page.keyboard.press('Backspace');
    await expect(editor).toHaveText('');
    await editor.pressSequentially(lines[0]!);
    for (const line of lines.slice(1)) {
      await page.keyboard.press('Enter');
      await editor.pressSequentially(line);
    }
  } else {
    await editor.fill(value);
  }
  if (lines.length > 1) {
    await expect(editor.locator('.cm-line')).toHaveText(lines);
  } else {
    await expect(editor).toHaveText(value);
  }
}

test('serves PCRE2 notices as same-origin downloads from the Lab guide', async ({
  page,
}) => {
  await page.goto('/lab/guide/');

  for (const version of ['10.42', '10.43', '10.49']) {
    const notice = page.getByRole('link', {
      name: `PCRE2 ${version}`,
      exact: true,
    });
    await expect(notice).toHaveAttribute('download', '');
    const href = await notice.getAttribute('href');
    expect(href).toMatch(/^\/_astro\/[^/]+\.txt$/);

    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    const source = new URL(
      `../../src/lib/regex-lab/wasm/PCRE2-${version}-LICENCE.txt`,
      import.meta.url,
    );
    expect(await response.body()).toEqual(await readFile(source));
  }
});

test('inspects PCRE2 compiled ranges and Python parser instructions under hosting CSP', async ({
  context,
  baseURL,
  page,
}) => {
  test.setTimeout(100_000);
  await useHostingCsp(context, baseURL!);
  await page.goto('/regex/lab/');
  await page.getByLabel('Live', { exact: true }).uncheck();
  const runtime = page.getByLabel('Runtime', { exact: true });
  const panel = page.getByRole('tabpanel', { name: 'Structure' });
  await runtime.selectOption('pcre2');
  await edit(page, source(page), '(?<word>é)(?=x)|[a-z]+');
  await tab(page, 'Structure');
  const inspect = panel.getByRole('button', {
    name: 'Inspect native structure',
  });
  await inspect.click();
  await expect(panel).toContainText(
    /pcre2-callout-enumeration · 10\.49.*partial/,
  );
  await expect(panel).toContainText('Group 1 · word');
  await expect(panel).toContainText('Native item ranges');
  const literal = panel
    .getByRole('button', { name: /Native pattern item · "é"/ })
    .first();
  await literal.click();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('é');

  for (const [engine, version] of [
    ['python', '3.14'],
    ['python311', '3.11'],
    ['python311bytes', '3.11'],
  ] as const) {
    await runtime.selectOption(engine);
    await edit(page, source(page), '(?P<word>[a-z]+)(?=x)');
    await inspect.click();
    await expect(panel).toContainText('cpython-re-parser · ' + version, {
      timeout: 35_000,
    });
    await expect(panel).toContainText('Group 1 · word');
    await expect(panel).toContainText('Greedy repetition');
    await expect(panel).toContainText('Positive lookahead');
  }
  await edit(page, source(page), 'é😀)');
  await inspect.click();
  await expect(panel).toContainText(/6 utf8-bytes/);
  await edit(page, source(page), '(?P<word>a)++(?(word)b|c)' + '.'.repeat(520));
  await inspect.click();
  await expect(panel).toContainText('Possessive repetition');
  await expect(panel).toContainText('Conditional · Group 1 · word');
  await expect(panel).toContainText(
    'Some parser details are unavailable or exceeded the inspection limit',
  );
});

test('resumes a saved PCRE2 boundary after STRling-to-RegEx handoff and reload', async ({
  context,
  baseURL,
  page,
}) => {
  await useHostingCsp(context, baseURL!);
  await page.goto('/lab/');
  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('pcre243');
  await edit(
    page,
    source(page),
    'semantic strling 1.0; case sensitive; pattern text "ab";',
  );
  await edit(page, subject(page), 'ab--ab');
  await run(page);
  await expect(status(page)).toHaveText('2 matches');
  await page.getByText('Scan continuation', { exact: true }).click();
  await page.getByRole('button', { name: 'Keep this boundary' }).click();
  await expect(status(page)).toContainText('Scan boundary kept at byte 2');
  await tab(page, 'Artifact');
  await page
    .getByRole('button', { name: 'Open with sample and cursor in RegEx Lab' })
    .click();
  await expect(page).toHaveURL(/\/regex\/lab\/$/);
  await expect(status(page)).toContainText('Select Run');
  await page.getByText('Scan continuation', { exact: true }).click();
  const resume = page.getByRole('button', { name: 'Resume saved scan' });
  await resume.click();
  await expect(status(page)).toHaveText('Resumed at byte 2 · 1 match');
  await expect(
    page.getByRole('button', { name: /\[4, 6\) utf8-bytes/ }),
  ).toBeVisible();

  await tab(page, 'Sessions');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await expect(status(page)).toHaveText('Revision saved in this browser.');
  for (const choice of [
    'Active source',
    'Sample data',
    'Original STRling source of generated patterns',
    'Saved scan cursor',
  ]) {
    await page.getByRole('checkbox', { name: choice, exact: true }).check();
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download session' }).click();
  const portable = await readFile(await (await download).path());
  expect(JSON.parse(portable.toString()).session.continuation.after.end).toBe(
    2,
  );
  await page.reload();
  await tab(page, 'Sessions');
  await page
    .getByRole('combobox', { name: 'Saved session' })
    .selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await tab(page, 'Results');
  await page.getByText('Scan continuation', { exact: true }).click();
  await resume.click();
  await expect(status(page)).toHaveText('Resumed at byte 2 · 1 match');
  await run(page);
  await expect(status(page)).toHaveText('2 matches');
  await expect(
    page.getByRole('button', { name: /\[0, 2\) utf8-bytes/ }),
  ).toBeVisible();
  await edit(page, subject(page), 'ab-😀-ab');
  await resume.click();
  await expect(status(page)).toContainText('differs from the saved scan');
  await expect(
    page.getByRole('button', { name: /\[4, 6\) utf8-bytes/ }),
  ).toHaveCount(0);
  await page.getByLabel('Runtime', { exact: true }).selectOption('pcre2');
  await resume.click();
  await expect(status(page)).toContainText(
    'runtime profile or operation differs',
  );
  await tab(page, 'Sessions');
  await page.getByLabel('Import session', { exact: true }).setInputFiles({
    name: 'portable-session.json',
    mimeType: 'application/json',
    buffer: portable,
  });
  await expect(status(page)).toContainText('Select Run');
  await expect(page.getByLabel('Live', { exact: true })).not.toBeChecked();
  await tab(page, 'Results');
  await resume.click();
  await expect(status(page)).toHaveText('Resumed at byte 2 · 1 match');
});

test('keeps an initialized browser-local JavaScript worker usable offline', async ({
  context,
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await context.setOffline(true);
  await page.getByLabel('Live', { exact: true }).uncheck();
  await edit(page, source(page), 'ab');
  await edit(page, subject(page), 'ab--ab');
  await run(page);
  await expect(status(page)).toHaveText('2 matches');
});

async function stallNextExecutionWorker(page: Page) {
  await page.route(
    executionWorker,
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `self.onmessage = ({ data }) => self.postMessage({ type: 'ready', exchange: data.exchange });`,
      }),
    { times: 1 },
  );
  return {
    closed: page
      .waitForEvent('worker', (worker) => executionWorker.test(worker.url()))
      .then((worker) => worker.waitForEvent('close')),
  };
}

async function useHostingCsp(context: BrowserContext, baseURL: string) {
  const config = await readFile(
    new URL('../../netlify.toml', import.meta.url),
    'utf8',
  );
  const csp = config.match(/Content-Security-Policy = "([^"]+)"/)?.[1];
  expect(csp).toContain('wasm-unsafe-eval');
  const origin = new URL(baseURL).origin;
  if (new URL(origin).protocol === 'https:') {
    const response = await context.request.get(origin + '/regex/lab/');
    expect(response.headers()['content-security-policy']).toBe(csp);
    return;
  }
  await context.route(
    (url) =>
      url.origin === origin &&
      /^\/(?:lab\/|regex\/lab\/|_astro\/|_strling-lab\/)/.test(url.pathname),
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'Content-Security-Policy': csp! },
      });
    },
  );
}

test('runs native providers, inspects captures, creates tests and records PCRE2 steps', async ({
  baseURL,
  context,
  page,
}) => {
  await useHostingCsp(context, baseURL!);
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  const capture = page.getByRole('button', { name: /Group 1 · word.*alpha/ });
  await expect(capture).toBeVisible();
  await capture.click();
  await expect(capture).toHaveAttribute('aria-pressed', 'true');

  await tab(page, 'Structure');
  await expect(
    page.getByRole('button', { name: 'Named capture word' }),
  ).toBeVisible();
  await tab(page, 'Tests');
  await page.getByRole('button', { name: 'Add from result' }).click();
  await page.getByRole('button', { name: 'Save test' }).click();
  await page.getByRole('button', { name: 'Run all' }).click();
  await expect(status(page)).toHaveText('1 of 1 tests passed.');

  await page.getByLabel('Live', { exact: true }).uncheck();
  await page.getByLabel('Runtime', { exact: true }).selectOption('pcre2');
  await edit(page, source(page), '(a|ab)c');
  await edit(page, subject(page), '😀abc');
  await run(page);
  await expect(status(page)).toHaveText('1 match');
  await expect(
    page.getByRole('button', { name: /utf8-bytes · editor/ }).first(),
  ).toBeVisible();
  await tab(page, 'Debugger');
  await page.getByRole('button', { name: 'Trace search' }).click();
  await expect(status(page)).toContainText('trace events · matched');
  await expect(page.getByRole('heading', { name: /^Step 1 of/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('heading', { name: /^Step 2 of/ })).toBeVisible();
});

test('compiles released Semantic STRling and Simply, maps diagnostics and transfers an artifact', async ({
  page,
}) => {
  await page.goto('/lab/');
  await expect(status(page)).toContainText('Compiler succeeded');
  await tab(page, 'Compiler');
  await expect(
    page.getByRole('heading', { name: 'Canonical Semantic IR' }),
  ).toBeVisible();
  await edit(
    page,
    source(page),
    'semantic strling 1.0; case sensitive; pattern bogus;',
  );
  await expect(
    page.getByRole('heading', { name: 'Diagnostics' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^STRL-DSL/ }).first(),
  ).toBeVisible();

  await page.getByLabel('Source format').selectOption('simply');
  await expect(status(page)).toContainText('Compiler succeeded');
  await tab(page, 'Artifact');
  await expect(
    page.getByText('ECMAScript 2024 · emitted flags u'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Run artifact' }).click();
  await expect(status(page)).toHaveText('2 matches');
  await tab(page, 'Artifact');
  await page
    .getByRole('button', { name: 'Open artifact and samples in RegEx Lab' })
    .click();
  await expect(page).toHaveURL(/\/regex\/lab\/$/);
  await expect(status(page)).toContainText('Session loaded');
  await expect(source(page)).toHaveText('hello');
  await run(page);
  await expect(status(page)).toHaveText('2 matches');
  await expect(page.getByText('Generated pattern origin')).toBeVisible();
});

test('executes and traces a STRling artifact in its exact PCRE2 target', async ({
  baseURL,
  context,
  page,
}) => {
  await useHostingCsp(context, baseURL!);
  await page.goto('/lab/');
  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('pcre243');
  await expect(status(page)).toContainText('Compiler succeeded');
  await tab(page, 'Artifact');
  await page.getByRole('button', { name: 'Run artifact' }).click();
  await expect(status(page)).toHaveText('2 matches');
  await expect(page.locator('[data-output="provenance"]')).toContainText(
    '10.43',
  );
  await tab(page, 'Debugger');
  await page.getByRole('button', { name: 'Trace search' }).click();
  await expect(status(page)).toContainText('trace events · matched');
  await expect(page.getByRole('heading', { name: /^Step 1 of/ })).toBeVisible();
});

test('runs Python 3.11 text and bytes artifacts under their matching provider', async ({
  baseURL,
  context,
  page,
}) => {
  test.setTimeout(80_000);
  await useHostingCsp(context, baseURL!);
  await page.goto('/lab/');
  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('python');
  await expect(status(page)).toContainText('Compiler succeeded');
  await run(page);
  await expect(status(page)).toHaveText('2 matches', { timeout: 35_000 });
  await expect(page.locator('[data-output="provenance"]')).toContainText(
    '3.11.',
  );
  await expect(
    page.getByRole('button', { name: 'Source for word' }).first(),
  ).toBeVisible();
  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('python-bytes');
  await expect(status(page)).toContainText('Compiler succeeded');
  await run(page);
  await expect(status(page)).toHaveText('2 matches', { timeout: 35_000 });
  await expect(page.locator('[data-output="provenance"]')).toContainText(
    'hexadecimal',
  );
  await expect(
    page.getByRole('button', { name: /Match 1 · "68656c6c6f"/ }),
  ).toBeVisible();
});

test('compares revisions, measures time and confines authored material to opt-in file sharing', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await tab(page, 'Sessions');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await expect(status(page)).toHaveText('Revision saved in this browser.');
  await edit(page, source(page), 'alpha');
  await expect(status(page)).toHaveText('1 match');
  await tab(page, 'Compare');
  await page
    .getByRole('combobox', { name: 'Baseline revision', exact: true })
    .selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Compare revision' }).click();
  await expect(status(page)).toHaveText('Comparison complete.');
  await expect(page.getByText(/Sample · [1-9] differences/)).toBeVisible();

  await tab(page, 'Timing');
  await page
    .getByRole('checkbox', { name: 'Include baseline revision' })
    .check();
  await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await expect(
    page.getByText('8 of 8 measured runs completed', { exact: true }),
  ).toHaveCount(2);
  const timings = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download timings' }).click();
  const experiment = JSON.parse(
    await readFile(await (await timings).path(), 'utf8'),
  );
  expect(experiment.status).toBe('complete');
  expect(
    experiment.series.map(
      (entry: { samples: unknown[] }) => entry.samples.length,
    ),
  ).toEqual([8, 8]);

  await tab(page, 'Sessions');
  const redactedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download session' }).click();
  const redactedFile = JSON.parse(
    await readFile(await (await redactedDownload).path(), 'utf8'),
  );
  expect(redactedFile.session.source).toBe('');
  expect(redactedFile.session.datasets[0].text).toBe('');
  expect(redactedFile.session).not.toHaveProperty('continuation');
  for (const option of [
    'Active source',
    'Sample data',
    'Tests',
    'Recorded outputs',
    'Original STRling source of generated patterns',
  ]) {
    await page.getByRole('checkbox', { name: option, exact: true }).check();
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download session' }).click();
  const file = JSON.parse(
    await readFile(await (await download).path(), 'utf8'),
  );
  expect(file.session.source).toBe('alpha');
  expect(file.session.datasets[0].text).toContain('beta-2');
  expect(file.session.recorded.investigation.comparison).toBeDefined();

  await page.getByRole('button', { name: 'Copy settings link' }).click();
  const url = await page.getByLabel('Share URL').inputValue();
  expect(decodeURIComponent(url)).not.toContain('alpha');
  expect(decodeURIComponent(url)).not.toContain('beta-2');
  expect(decodeURIComponent(url)).not.toContain('recordedAt');
  await page.goto(url);
  await expect(status(page)).toContainText('Session loaded');
  await expect(page.getByLabel('Live', { exact: true })).not.toBeChecked();
  await expect(source(page)).toHaveText('');
  await expect(subject(page)).toHaveText('');
  expect(new URL(page.url()).hash).toBe('');
  await edit(page, source(page), 'alpha');
  await run(page);
  await expect(status(page)).toHaveText('No match');

  const otherLab = new URL(url);
  otherLab.pathname = '/lab/';
  await page.goto(otherLab.href);
  await expect(status(page)).toContainText(
    'This session belongs in the other Lab.',
  );
  expect(new URL(page.url()).hash).toBe('');
});

for (const [pattern, text] of [
  ['AX', 'AXa AX AX'],
  ['BY', 'BYb BY BY'],
] as const) {
  test(`restores the ${pattern} revision as history and runs a fresh first match`, async ({
    page,
  }) => {
    await page.goto('/regex/lab/');
    await expect(status(page)).toHaveText('3 matches');
    await page.getByLabel('Live', { exact: true }).uncheck();
    await page.getByLabel('Operation', { exact: true }).selectOption('first');
    await edit(page, source(page), pattern);
    await edit(page, subject(page), text);
    await run(page);
    const firstMatch = page.getByRole('button', {
      name: `Match 1 · "${pattern}" · [0, 2) utf16-code-units`,
    });
    await expect(firstMatch).toBeVisible();

    await tab(page, 'Sessions');
    await page.getByRole('button', { name: 'Save revision' }).click();
    await expect(status(page)).toHaveText('Revision saved in this browser.');
    await edit(page, subject(page), 'changed');
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(subject(page)).toHaveText(text);
    await expect(status(page)).toHaveText(
      'Select Run or enable Live to execute this session.',
    );
    await page
      .getByText('Previously recorded outputs', { exact: true })
      .click();
    await expect(page.locator('[data-output="recording-json"]')).toContainText(
      '"start": 0',
    );
    await tab(page, 'Results');
    await expect(firstMatch).toHaveCount(0);
    await run(page);
    await expect(firstMatch).toBeVisible();
  });
}

test('loads Python and the STRling compiler under the hosting CSP', async ({
  baseURL,
  context,
  page,
}) => {
  test.setTimeout(60_000);
  await useHostingCsp(context, baseURL!);
  await page.goto('/regex/lab/');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await page.getByLabel('Runtime', { exact: true }).selectOption('python');
  await edit(page, source(page), '(?P<part>é+)');
  await edit(page, subject(page), '😀éé, é');
  await run(page);
  await expect(status(page)).toHaveText('2 matches', { timeout: 35_000 });
  await expect(
    page
      .getByRole('button', { name: /Group 1 · part.*unicode-code-points/ })
      .first(),
  ).toBeVisible();
  await page
    .getByLabel('Operation', { exact: true })
    .selectOption('replace-all');
  await page
    .getByRole('textbox', { name: 'Replacement', exact: true })
    .fill('\\g<part>!');
  await page
    .getByRole('combobox', { name: 'Replacement syntax', exact: true })
    .selectOption('native');
  await run(page);
  await expect(page.getByText('😀éé!, é!', { exact: true })).toBeVisible();
  await page.goto('/lab/');
  await expect(status(page)).toContainText('Compiler succeeded');
});

test('bounds execution and recovers after a worker timeout', async ({
  page,
}) => {
  const stalled = await stallNextExecutionWorker(page);
  await page.goto('/regex/lab/');
  await expect(status(page)).toContainText('time limit', { timeout: 10_000 });
  await stalled.closed;
  await page.getByLabel('Live', { exact: true }).uncheck();
  await edit(page, source(page), '(?:)');
  await edit(page, subject(page), 'a'.repeat(280));
  await run(page);
  await expect(status(page)).toContainText('resource terminated');
  await edit(page, source(page), '^a');
  await run(page);
  await expect(status(page)).toHaveText('1 match');
});

test('supports tab keyboard navigation, narrow layout and axe on both routes', async ({
  page,
}) => {
  for (const path of ['/regex/lab/', '/lab/']) {
    await page.goto(path);
    const results = page.getByRole('tab', { name: 'Results' });
    await results.focus();
    await results.press('ArrowRight');
    await expect(
      page.getByRole('tab', {
        name: path === '/lab/' ? 'Compiler' : 'Structure',
      }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page })
      .exclude('[data-test-axe-exclude]')
      .analyze();
    expect(
      axe.violations.filter((issue) =>
        ['serious', 'critical'].includes(issue.impact ?? ''),
      ),
    ).toEqual([]);
  }
});

test('requires an approved adapter and exercises the configured canonical tools under hosting CSP', async ({
  baseURL,
  context,
  page,
}) => {
  await useHostingCsp(context, baseURL!);
  const requests: { url: string; body: string | null; type: string }[] = [];
  context.on('request', (request) =>
    requests.push({
      url: request.url(),
      body: request.postData(),
      type: request.resourceType(),
    }),
  );
  await page.goto('/lab/');
  await expect(status(page)).toContainText('Compiler succeeded');
  if (!compilerToolsEnabled) {
    await expect(
      page.getByRole('button', { name: 'Format STRling', exact: true }),
    ).toBeHidden();
    await tab(page, 'Semantic tools');
    await expect(
      page.locator('[data-output="compiler-tools-status"]'),
    ).toContainText('Canonical tools require an approved compiler adapter.');
    await expect(
      page.getByRole('button', { name: 'Convert', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Explain current subject' }),
    ).toBeDisabled();
    expect(requests.some(({ url }) => url.includes('/_strling-lab/'))).toBe(
      false,
    );
    return;
  }
  await edit(
    page,
    source(page),
    'semantic strling 1.0; case sensitive; pattern capture word {text "héllo";}',
  );
  await page
    .getByRole('button', { name: 'Format STRling', exact: true })
    .click();
  await expect(
    page
      .getByText('Canonical STRling source formatted.', { exact: true })
      .first(),
  ).toBeVisible();
  const formatted = await source(page).innerText();
  expect(formatted).toContain('\n');
  await page
    .getByRole('button', { name: 'Format STRling', exact: true })
    .click();
  await expect(
    page.getByText('The source is already canonical.', { exact: true }).first(),
  ).toBeVisible();
  expect(await source(page).innerText()).toBe(formatted);

  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Canonical conversion · exact' }),
  ).toBeVisible();
  const evidence = page
    .locator('[data-output="compiler-tools"] details pre')
    .last();
  const proof = JSON.parse((await evidence.textContent())!).equivalence;
  expect(proof.status).toBe('proven');
  expect(proof.reconstructed_fingerprint).toBe(proof.source_fingerprint);
  await expect(
    page
      .getByRole('group', { name: 'Selected tab actions' })
      .getByRole('button', { name: 'Copy converted source', exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .locator('[data-panel="compiler-tools"]')
      .getByRole('button', { name: 'Copy converted source', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Use exact conversion' }).click();
  await expect(page.getByLabel('Source format')).toHaveValue('simply');
  await expect(status(page)).toContainText('Compiler succeeded');
  await page
    .getByLabel('Conversion destination')
    .selectOption('semantic_strling');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Canonical conversion · exact' }),
  ).toBeVisible();
  expect(
    JSON.parse((await evidence.textContent())!).equivalence.source_fingerprint,
  ).toBe(proof.source_fingerprint);

  await edit(page, subject(page), '😀héllo');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  const tools = page.locator('[data-output="compiler-tools"]');
  await expect(tools).toContainText('matched · not_applicable');
  expect(
    JSON.parse((await evidence.textContent())!).target.target_profile
      .profile_id,
  ).toBe('profile:ecmascript/2024');
  const privateText = 'private-subject-' + 'x'.repeat(20);
  await edit(page, subject(page), privateText);
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  await expect(tools).toContainText('no_match · proven');
  const explanation = (await evidence.textContent())!;
  expect(explanation).not.toContain(privateText);
  expect(JSON.parse(explanation).subject.utf8_bytes).toBe(privateText.length);
  expect(
    requests
      .filter(({ type }) => type !== 'image')
      .map(({ url }) => new URL(url).origin)
      .every((origin) => origin === new URL(baseURL!).origin),
  ).toBe(true);
  expect(requests.some(({ url }) => compilerAsset.test(url))).toBe(true);
  expect(JSON.stringify(requests)).not.toContain(privateText);
  await expect(page.locator('[data-output="workspace-status"]')).toHaveText(
    'Saved in this browser',
  );
  expect(
    await page.evaluate((secret) => {
      const workingKey = 'strling.labs.working.v1.strling';
      return {
        editableCopy: localStorage.getItem(workingKey)?.includes(secret),
        otherStorage:
          Object.entries(localStorage).some(
            ([key, text]) => key !== workingKey && text.includes(secret),
          ) ||
          Object.values(sessionStorage).some((text) => text.includes(secret)),
        address: location.href.includes(secret),
      };
    }, privateText),
  ).toEqual({ editableCopy: true, otherStorage: false, address: false });

  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('pcre243');
  await expect(status(page)).toContainText('Compiler succeeded');
  await edit(page, subject(page), '😀héllo');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  await expect(tools).toContainText('matched · not_applicable');
  expect(
    JSON.parse((await evidence.textContent())!).target.target_profile
      .profile_id,
  ).toBe('profile:pcre2/10.43');

  await page.getByLabel('Source format').selectOption('semantic');
  const invalidSource =
    'semantic strling 1.0; case sensitive; pattern sequence { text "é😀"; bogus; }';
  await edit(page, source(page), invalidSource);
  await page
    .getByRole('button', { name: 'Format STRling', exact: true })
    .click();
  await expect(status(page)).toHaveText(
    'The canonical formatter rejected the source.',
  );
  const diagnosticButton = tools.getByRole('button').first();
  const [diagnostic] = JSON.parse((await evidence.textContent())!);
  const location = diagnostic.primary_location;
  const byteOffset = Buffer.byteLength(invalidSource.split('bogus')[0]!) + 1;
  expect(location).toMatchObject({
    coordinate_system: 'utf8-bytes',
    start: byteOffset,
    end: byteOffset + 1,
  });
  await diagnosticButton.click();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('o');
  const axe = await new AxeBuilder({ page })
    .include('[data-panel="compiler-tools"]')
    .analyze();
  expect(
    axe.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    ),
  ).toEqual([]);
});

test('rejects missing and substituted compiler tools before recovering with the pinned asset', async ({
  browserName,
  context,
  baseURL,
  page,
}) => {
  test.skip(
    browserName !== 'chromium' || !compilerToolsEnabled,
    'Requires Chromium worker request interception and a configured adapter.',
  );
  await useHostingCsp(context, baseURL!);
  await page.goto('/lab/');
  await expect(status(page)).toContainText('Compiler succeeded');
  const original =
    'semantic strling 1.0; case sensitive; pattern text "release check";';
  await edit(page, source(page), original);
  const format = page.getByRole('button', {
    name: 'Format STRling',
    exact: true,
  });
  await context.route(
    compilerAsset,
    (route) => route.fulfill({ status: 404 }),
    {
      times: 1,
    },
  );
  await format.click();
  await expect(status(page)).toContainText('WebAssembly asset is unavailable');
  await expect(source(page)).toHaveText(original);

  await context.route(
    compilerAsset,
    (route) =>
      route.fulfill({
        contentType: 'application/wasm',
        body: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
      }),
    { times: 1 },
  );
  await format.click();
  await expect(status(page)).toContainText(
    'WebAssembly asset failed its integrity check',
  );
  await expect(source(page)).toHaveText(original);

  await format.click();
  await expect(
    page
      .getByText('Canonical STRling source formatted.', { exact: true })
      .first(),
  ).toBeVisible();
});

test('preserves canonical partial, unsupported, likely, unknown and unavailable in WebAssembly', async ({
  page,
}) => {
  test.setTimeout(90_000);
  test.skip(
    !compilerToolsEnabled,
    'Canonical adapter qualification requires a configured adapter.',
  );
  await page.goto('/lab/');
  await expect(status(page)).toContainText('Compiler succeeded');
  const requestedAsset = page.waitForRequest(compilerAsset);
  await page
    .getByRole('button', { name: 'Format STRling', exact: true })
    .click();
  const asset = new URL((await requestedAsset).url()).pathname;
  const results = await page.evaluate(async (asset) => {
    const response = await fetch(asset);
    expectSuccess(response.ok);
    const module = await WebAssembly.compile(await response.arrayBuffer());
    let simulatedTime: number | undefined;
    const instance = await WebAssembly.instantiate(module, {
      strling_lab: {
        monotonic_milliseconds: () =>
          simulatedTime === undefined
            ? performance.now()
            : (simulatedTime += 251),
      },
    });
    const wasm = instance.exports as unknown as {
      memory: WebAssembly.Memory;
      strling_lab_input_v1(): number;
      strling_lab_output_v1(): number;
      strling_lab_run_v1(length: number): number;
    };
    function expectSuccess(ok: boolean) {
      if (!ok) throw new Error('Candidate asset not served');
    }
    function send(
      request: object,
      protocol = 'strling.lab-compiler-tools@1.0.0-rc.1',
    ) {
      const bytes = new TextEncoder().encode(
        JSON.stringify({ protocol, request }),
      );
      const input = wasm.strling_lab_input_v1();
      new Uint8Array(wasm.memory.buffer, input, bytes.length).set(bytes);
      const size = wasm.strling_lab_run_v1(bytes.length);
      return JSON.parse(
        new TextDecoder().decode(
          new Uint8Array(
            wasm.memory.buffer,
            wasm.strling_lab_output_v1(),
            size,
          ),
        ),
      );
    }
    const literal = { node_id: 'node:literal', kind: 'literal', text: 'a' };
    const program = (root: object) => ({
      contract_version: '1.0.0',
      specification_version: '1.0-draft.1',
      normalization: 'canonical-v1',
      case_matching: 'sensitive',
      root,
    });
    const convert = (root: object) =>
      send({
        operation: 'convert',
        destination: 'semantic_strling',
        program: program(root),
      }).result;
    const explain = (root: object, subject: string) =>
      send({ operation: 'explain', program: program(root), subject }).result;
    const capture = {
      node_id: 'node:capture',
      kind: 'capture',
      capture_id: 'capture:one',
      body: literal,
    };
    const sequence = (items: object[]) => ({
      node_id: 'node:root',
      kind: 'sequence',
      items,
    });
    let tooDeep: unknown = true;
    for (let index = 0; index < 273; index++) tooDeep = [tooDeep];
    const verified = {
      partial: convert(capture),
      unsupported: convert(
        sequence([
          {
            node_id: 'node:forward',
            kind: 'backreference',
            capture_id: 'capture:one',
          },
          { ...capture, name: 'later' },
        ]),
      ),
      likely: explain(
        sequence([
          { node_id: 'node:start', kind: 'position', position: 'input_start' },
          literal,
        ]),
        'ba',
      ),
      subjectTooLarge: send({
        operation: 'explain',
        program: program(literal),
        subject: 'a'.repeat(6000),
      }).error,
      malformed: send({ operation: 'describe', extra: true }).error,
      nestedArrays: send({ operation: 'describe', extra: tooDeep }).error,
      wrongProtocol: send({ operation: 'describe' }, 'strling.interop@1.0.0')
        .error,
      oversized: wasm.strling_lab_run_v1(1_048_577),
    };
    simulatedTime = 0;
    const unknown = explain(literal, 'b');
    const pageBytes = 65_536;
    wasm.memory.grow(1_024 - wasm.memory.buffer.byteLength / pageBytes);
    let refusedExtraPage = false;
    try {
      wasm.memory.grow(1);
    } catch (error) {
      refusedExtraPage = error instanceof RangeError;
    }
    return {
      ...verified,
      unknown,
      memoryBytes: wasm.memory.buffer.byteLength,
      refusedExtraPage,
    };
  }, asset);
  expect(results.partial).toMatchObject({
    status: 'partial',
    equivalence: { status: 'not_proven' },
  });
  expect(results.partial.equivalence.reconstructed_fingerprint).toBeUndefined();
  expect(results.unsupported).toMatchObject({
    status: 'unsupported',
    equivalence: { status: 'not_applicable' },
  });
  expect(results.unsupported.output).toBeUndefined();
  expect(results.likely).toMatchObject({
    outcome: 'no_match',
    explanation_disposition: 'likely',
  });
  expect(results.unknown).toMatchObject({
    outcome: 'unknown',
    explanation_disposition: 'unknown',
  });
  expect(results.unknown.work.reached_limits).toContain('elapsed');
  expect(results.subjectTooLarge).toBe('subject_too_large');
  expect(results.malformed).toBe('invalid_request');
  expect(results.nestedArrays).toBe('request_too_deep');
  expect(results.wrongProtocol).toBe('unsupported_protocol');
  expect(results.oversized).toBe(0);
  expect(results.memoryBytes).toBe(64 * 1024 * 1024);
  expect(results.refusedExtraPage).toBe(true);

  await expect(status(page)).toContainText('Compiler succeeded');
  await edit(
    page,
    source(page),
    'semantic strling 1.0; case sensitive; pattern without backtracking { choice { text "a"; text "ab"; } }',
  );
  await tab(page, 'Semantic tools');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  await expect(page.locator('[data-output="compiler-tools"]')).toContainText(
    'unavailable · unavailable',
  );
  await page.getByLabel('Explanation scope').selectOption('semantic');
  await edit(page, subject(page), 'a');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  await expect(page.locator('[data-output="compiler-tools"]')).toContainText(
    'unknown · unknown',
  );
  const neutral = page.locator('[data-output="compiler-tools"] details pre');
  expect(JSON.parse((await neutral.textContent())!).target).toBeUndefined();
  const depth = 124;
  const captures = Array.from(
    { length: depth },
    (_, index) => 'capture x' + index + ' { ',
  ).join('');
  await edit(
    page,
    source(page),
    'semantic strling 1.0; case sensitive; pattern ' +
      captures +
      'text "a";' +
      ' }'.repeat(depth),
  );
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Canonical conversion · exact' }),
  ).toBeVisible();
});

test('rejects a mismatched worker exchange and recovers on a fresh worker', async ({
  page,
}) => {
  let corrupted = false;
  await page.route(/\/execution\.worker-[^/]+\.js$/, async (route) => {
    if (corrupted) return route.continue();
    corrupted = true;
    await route.fulfill({
      contentType: 'application/javascript',
      body: `self.onmessage = () => self.postMessage({ type: 'ready', exchange: 'past-revision' });`,
    });
  });
  await page.goto('/regex/lab/');
  await expect(status(page)).toContainText('did not match the active request');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await run(page);
  await expect(status(page)).toHaveText('3 matches');
});

test('binds assertions to duplicate PCRE2 capture names and clears revised evidence', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await page.getByLabel('Runtime', { exact: true }).selectOption('pcre2');
  await edit(page, source(page), '(?J)(?<part>a)|(?<part>b)');
  await edit(page, subject(page), 'b a');
  await run(page);
  await expect(status(page)).toHaveText('2 matches');
  await page.getByText('Extract matches or captures', { exact: true }).click();
  await page.getByLabel('Value to extract').selectOption('2');
  const extracted = page.locator('[data-output="extracted-values"]');
  expect(JSON.parse((await extracted.textContent())!)).toEqual(['b', null]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download extracted JSON' }).click();
  expect((await download).suggestedFilename()).toBe('lab-extraction.json');
  await tab(page, 'Tests');
  await page.getByRole('button', { name: 'Add from result' }).click();
  await page.getByRole('button', { name: 'Save test' }).click();
  await page.getByRole('button', { name: 'Run all' }).click();
  await expect(status(page)).toHaveText('1 of 1 tests passed.');
  await edit(page, subject(page), 'a');
  await expect(page.getByText('1 of 1 tests passed.')).toBeHidden();
});

test('observes multiline, full-match, replacement and split behavior in each runtime family', async ({
  page,
}) => {
  test.setTimeout(75_000);
  await page.goto('/regex/lab/');
  await page.getByLabel('Live', { exact: true }).uncheck();
  const runtime = page.getByLabel('Runtime', { exact: true });
  const flags = page.getByRole('textbox', { name: 'Flags', exact: true });
  const operation = page.getByRole('combobox', {
    name: 'Operation',
    exact: true,
  });
  const result = page.locator('[data-output="result-json"]');
  for (const [engine, unit, start] of [
    ['javascript', 'utf16-code-units', 3],
    ['pcre2', 'utf8-bytes', 5],
    ['python', 'unicode-code-points', 2],
  ] as const) {
    await runtime.selectOption(engine);
    await flags.fill(engine === 'javascript' ? 'mu' : 'm');
    await edit(page, source(page), '^a(.)$');
    await edit(page, subject(page), '😀\naé\nb');
    await operation.selectOption('scan');
    await run(page);
    await expect(status(page)).toHaveText('1 match', { timeout: 35_000 });
    expect(JSON.parse((await result.textContent())!).matches[0]).toMatchObject({
      value: 'aé',
      span: { start, unit },
      captures: [{ value: 'é' }],
    });

    await operation.selectOption('fullmatch');
    await run(page);
    await expect(status(page)).toHaveText('No match');

    await edit(page, source(page), '[,;]');
    await edit(page, subject(page), 'a,b;c');
    await operation.selectOption('replace-all');
    await page
      .getByRole('textbox', { name: 'Replacement', exact: true })
      .fill('|');
    await run(page);
    await expect(
      page.getByText('a|b|c', { exact: true }).first(),
    ).toBeVisible();

    await operation.selectOption('split');
    await run(page);
    await expect
      .poll(async () => {
        const text = await result.textContent();
        return text && JSON.parse(text).operationId;
      })
      .toBe('split');
    expect(JSON.parse((await result.textContent())!).output).toEqual([
      'a',
      'b',
      'c',
    ]);
  }
});

test('executes the PCRE2 10.42 artifact and preserves a Unicode empty-match boundary', async ({
  page,
}) => {
  await page.goto('/lab/');
  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('pcre242');
  await edit(
    page,
    source(page),
    'semantic strling 1.0; case sensitive; pattern empty;',
  );
  await edit(page, subject(page), '😀');
  await run(page);
  await expect(status(page)).toHaveText('2 matches');
  const results = page.locator('[data-panel="results"]');
  await expect(results).toContainText('10.42');
  await expect(
    results.getByRole('button', {
      name: /\[4, 4\) utf8-bytes · editor \[2, 2\)/,
    }),
  ).toBeVisible();
});

test('terminates the cancelled worker and retries after initialization failure', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await page.getByLabel('Live', { exact: true }).uncheck();
  const runtime = page.getByLabel('Runtime', { exact: true });
  await runtime.selectOption('pcre2');
  await edit(page, source(page), 'word');
  await edit(page, subject(page), 'one word');
  const stalled = await stallNextExecutionWorker(page);
  const created = page.waitForEvent('worker', (worker) =>
    executionWorker.test(worker.url()),
  );
  // Start the raw runtime with the visible Run button so this test exercises
  // the same pointer and scroll flow as the subsequent Stop interaction.
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await created;
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  await stop.evaluate((button) =>
    button.scrollIntoView({ block: 'start', behavior: 'instant' }),
  );
  await expect
    .poll(async () => {
      const header = await page.getByRole('banner').boundingBox();
      const button = await stop.boundingBox();
      return button!.y - (header!.y + header!.height);
    })
    .toBeGreaterThanOrEqual(0);
  await stop.click();
  await stalled.closed;
  await expect(status(page)).toHaveText('Stopped.');
  await run(page);
  await expect(status(page)).toHaveText('1 match');

  await page.route(executionWorker, (route) => route.abort(), {
    times: 1,
  });
  await runtime.selectOption('javascript');
  await run(page);
  await expect(status(page)).toContainText('The worker could not start');
  await run(page);
  await expect(status(page)).toHaveText('1 match');
});

test('autosaves working patterns and independent dataset copies without automatic execution on return', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await edit(page, source(page), 'original');
  await edit(page, subject(page), 'original sample');
  const save = page.locator('[data-output="workspace-status"]');
  await expect(save).toHaveText('Saved in this browser');
  const library = page.getByRole('combobox', { name: 'Saved working pattern' });
  await page.getByText('Manage patterns', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept('Copy for review'));
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(library.locator('option:checked')).toHaveText('Copy for review');
  await edit(page, source(page), 'another');
  await page.getByText('Manage datasets', { exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  const datasets = page.getByRole('combobox', { name: 'Dataset', exact: true });
  await expect(datasets.locator('option:checked')).toHaveText('Sample copy');
  await edit(page, subject(page), 'independent');
  await datasets.selectOption({ label: 'Sample' });
  await expect(subject(page)).toHaveText('original sample');
  await library.selectOption({ label: 'Sample pattern' });
  await expect(source(page)).toHaveText('original');
  await page.getByText('Manage datasets', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Copy saved dataset' })
    .selectOption({ label: 'Copy for review · Sample copy' });
  await expect(subject(page)).toHaveText('independent');
  await expect(save).toHaveText('Saved in this browser');
  await page.reload();
  await expect(status(page)).toContainText('Working copy restored');
  await expect(source(page)).toHaveText('original');
  await expect(subject(page)).toHaveText('independent');
  await expect(page.getByLabel('Live', { exact: true })).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Download', exact: true }),
  ).toBeDisabled();
  await page.getByText('Manage patterns', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept('Renamed pattern'));
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(library.locator('option:checked')).toHaveText('Renamed pattern');
  await page.getByText('Manage patterns', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept('Fresh pattern'));
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(source(page)).toHaveText('');
  await page.getByText('Manage patterns', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    library.locator('option', { hasText: 'Fresh pattern' }),
  ).toHaveCount(0);
});

test('restores separate Semantic and Simply drafts without running them', async ({
  page,
}) => {
  await page.goto('/lab/');
  await expect(status(page)).toContainText('Compiler succeeded');
  const format = page.getByLabel('Source format', { exact: true });
  const semantic =
    'semantic strling 1.0; case sensitive; pattern text "draft";';
  await edit(page, source(page), semantic);
  await format.selectOption('simply');
  await edit(page, source(page), '{"privateDraft":true}');
  await expect(page.locator('[data-output="workspace-status"]')).toHaveText(
    'Saved in this browser',
  );
  await page.reload();
  await expect(status(page)).toContainText('Working copy restored');
  await expect(format).toHaveValue('simply');
  await expect(source(page)).toHaveText('{"privateDraft":true}');
  await format.selectOption('semantic');
  await expect(source(page)).toHaveText(semantic);
  await expect(status(page)).toContainText('Select Run');
  await format.selectOption('simply');
  await expect(source(page)).toHaveText('{"privateDraft":true}');
});

test('keeps run controls stable, resizes both editors and exposes native selectable disclosures', async ({
  page,
  browserName,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(status(page)).toHaveText('3 matches');
  const tall = page.getByRole('button', { name: 'Tall editors', exact: true });
  const boxes = page.locator('[data-editor]');
  const heights = () =>
    boxes.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
  const before = await heights();
  await tall.press('Enter');
  await expect(tall).toHaveAttribute('aria-pressed', 'true');
  const expanded = await heights();
  expect(expanded[0]).toBe(expanded[1]);
  expect(expanded[0]).toBeGreaterThan(before[0]!);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBe(0);
  await tall.click();
  expect(await heights()).toEqual(before);
  await page.getByText('Structured result', { exact: true }).press('Enter');
  await page.getByText('Raw JSON', { exact: true }).press('Enter');
  const summary = page.getByText('Raw JSON', { exact: true });
  const json = page.locator('[data-output="result-json"]');
  await expect(json).toBeVisible();
  const selectionProperty =
    browserName === 'webkit' ? '-webkit-user-select' : 'user-select';
  await expect(summary).toHaveCSS(selectionProperty, 'none');
  await expect(json).toHaveCSS(selectionProperty, 'text');
  if (browserName === 'chromium') {
    await page.emulateMedia({ forcedColors: 'active' });
    await summary.focus();
    await expect(summary).toHaveCSS('outline-style', 'solid');
    await page.emulateMedia({ forcedColors: 'none' });
  }
  await summary.press('Enter');
  await expect(json).toBeHidden();
  const bar = page.getByRole('group', { name: 'Selected tab actions' });
  await expect(bar.getByRole('button').nth(0)).toHaveAccessibleName(
    'Copy result JSON',
  );
  if (browserName === 'chromium') {
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await bar.getByRole('button').nth(0).press('Enter');
    await expect(status(page)).toHaveText('Copied.');
    const rawResult = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    expect(rawResult.status).toBe('matched');
    expect(rawResult).not.toHaveProperty('result');
  }
  const downloaded = page.waitForEvent('download');
  await bar.getByRole('button').nth(1).press('Enter');
  const envelope = JSON.parse(
    await readFile(await (await downloaded).path(), 'utf8'),
  );
  expect(envelope).toMatchObject({
    schema: 'strling-lab-recorded-observation-v1',
    result: { status: 'matched' },
  });
  await tab(page, 'Debugger');
  await expect(bar.getByRole('button', { name: 'Download' })).toBeDisabled();
  await tab(page, 'Structure');
  await expect(
    bar.getByRole('button', { name: 'Copy structure data' }),
  ).toBeEnabled();
  await source(page).press('ControlOrMeta+KeyF');
  await expect(
    page.getByRole('textbox', { name: 'Find', exact: true }),
  ).toBeVisible();
});

test('preserves successful timing samples when a later real worker request is cancelled', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await page.evaluate(() => {
    const send = Worker.prototype.postMessage;
    let calls = 0;
    Worker.prototype.postMessage = function (
      message: { input?: { request?: unknown } },
      ...rest: unknown[]
    ) {
      if (message.input?.request && ++calls === 4) return;
      Reflect.apply(send, this, [message, ...rest]);
    };
  });
  await tab(page, 'Timing');
  await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await expect(
    page.getByText('Measuring · 2 of 8 measured runs completed'),
  ).toBeVisible();
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  const running = await stop.boundingBox();
  await stop.click();
  await expect(status(page)).toHaveText('Stopped.');
  await expect(page.getByLabel('Live', { exact: true })).not.toBeChecked();
  const idle = await page
    .getByRole('button', { name: 'Run', exact: true })
    .boundingBox();
  expect(idle?.width).toBe(running?.width);
  expect(idle?.x).toBe(running?.x);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download timings' }).click();
  const evidence = JSON.parse(
    await readFile(await (await pending).path(), 'utf8'),
  );
  expect(evidence.status).toBe('incomplete');
  expect(evidence.repetitions).toBe(8);
  expect(evidence.series[0].warmup).toBeDefined();
  expect(evidence.series[0].samples).toHaveLength(2);
});

test('requires explicit replacement inclusion and preserves native inspection across tabs', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await page.getByLabel('Runtime', { exact: true }).selectOption('pcre2');
  await tab(page, 'Structure');
  await page.getByRole('button', { name: 'Inspect native structure' }).click();
  await expect(
    page.getByText('PCRE2 compiled structure', { exact: true }),
  ).toBeVisible();
  await tab(page, 'Results');
  await tab(page, 'Structure');
  await expect(
    page.getByText('PCRE2 compiled structure', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download structure data' }),
  ).toBeEnabled();
  await page.getByRole('textbox', { name: 'Flags', exact: true }).fill('i');
  await expect(
    page.getByText('PCRE2 compiled structure', { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Download', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Operation', exact: true })
    .selectOption('replace-all');
  await page
    .getByRole('textbox', { name: 'Replacement', exact: true })
    .fill('private template');
  await tab(page, 'Sessions');
  const exported = async () => {
    const pending = page.waitForEvent('download');
    await page
      .getByRole('button', {
        name: 'Download session with selected inclusions',
      })
      .click();
    return JSON.parse(await readFile(await (await pending).path(), 'utf8'));
  };
  expect((await exported()).session.run.replacement).toBe('');
  await page.getByRole('checkbox', { name: 'Replacement text' }).check();
  expect((await exported()).session.run.replacement).toBe('private template');
  await page.getByRole('button', { name: 'Copy settings link' }).click();
  expect(
    decodeURIComponent(await page.getByLabel('Share URL').inputValue()),
  ).not.toContain('private template');
});

test('recovers unreadable or quota-refused working storage without modifying saved revisions', async ({
  page,
}) => {
  await page.goto('/regex/lab/');
  await expect(status(page)).toHaveText('3 matches');
  await tab(page, 'Sessions');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await expect(status(page)).toContainText('Revision saved');
  const archive = await page.evaluate(() => {
    localStorage.setItem('strling.labs.working.v1.regex', '{broken');
    return localStorage.getItem('strling.labs.archive.v1');
  });
  await page.reload();
  const save = page.locator('[data-output="workspace-status"]');
  await expect(save).toContainText('could not be read');
  await page.getByText('Manage patterns', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Reset working storage', exact: true })
    .click();
  await expect(save).toHaveText('Saved in this browser');
  await page.getByRole('checkbox', { name: 'Live', exact: true }).uncheck();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    document.documentElement.dataset.testRefuseWorkspace = 'yes';
    Storage.prototype.setItem = function (key, value) {
      if (
        key === 'strling.labs.working.v1.regex' &&
        document.documentElement.dataset.testRefuseWorkspace
      )
        throw new DOMException('Test quota limit', 'QuotaExceededError');
      write.call(this, key, value);
    };
  });
  await edit(page, source(page), 'surviving working edit');
  await expect(save).toContainText('could not save');
  await expect(source(page)).toHaveText('surviving working edit');
  await page.evaluate(() => {
    delete document.documentElement.dataset.testRefuseWorkspace;
  });
  await page.getByText('Manage patterns', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Retry autosave', exact: true })
    .click();
  await expect(save).toHaveText('Saved in this browser');
  expect(
    await page.evaluate(() => localStorage.getItem('strling.labs.archive.v1')),
  ).toEqual(archive);
  await page.reload();
  await expect(source(page)).toHaveText('surviving working edit');
  await expect(status(page)).toContainText('Working copy restored');
});
