import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const status = (page: Page) => page.locator('[data-output="status"]');
const source = (page: Page) =>
  page.getByRole('textbox', { name: 'Pattern or STRling source' });
const subject = (page: Page) =>
  page.getByRole('textbox', { name: 'Subject text' });
const tab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true }).click();
const run = (page: Page) =>
  page.getByRole('button', { name: /^Run Ctrl/ }).click();
const executionWorker = /\/execution\.worker-[^/]+\.js$/;

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
  await source(page).fill('(a|ab)c');
  await subject(page).fill('😀abc');
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
  await source(page).fill(
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
  await page.getByRole('button', { name: 'Open in RegEx Lab' }).click();
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
  test.setTimeout(45_000);
  await useHostingCsp(context, baseURL!);
  await page.goto('/lab/');
  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('python');
  await expect(status(page)).toContainText('Compiler succeeded');
  await run(page);
  await expect(status(page)).toHaveText('2 matches', { timeout: 20_000 });
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
  await expect(status(page)).toHaveText('2 matches', { timeout: 20_000 });
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
  await source(page).fill('alpha');
  await expect(status(page)).toHaveText('1 match');
  await tab(page, 'Compare');
  await page
    .getByRole('combobox', { name: 'Baseline revision', exact: true })
    .selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Compare revision' }).click();
  await expect(status(page)).toHaveText('Comparison complete.');
  await expect(page.getByText(/Sample · [1-9] differences/)).toBeVisible();

  await tab(page, 'Timing');
  await page.getByLabel('Repetitions').fill('2');
  await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await expect(page.getByText(/2 measured runs/)).toBeVisible();

  await tab(page, 'Sessions');
  for (const option of [
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
  await source(page).fill('alpha');
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
    await source(page).fill(pattern);
    await subject(page).fill(text);
    await run(page);
    const firstMatch = page.getByRole('button', {
      name: `Match 1 · "${pattern}" · [0, 2) utf16-code-units`,
    });
    await expect(firstMatch).toBeVisible();

    await tab(page, 'Sessions');
    await page.getByRole('button', { name: 'Save revision' }).click();
    await expect(status(page)).toHaveText('Revision saved in this browser.');
    await subject(page).fill('changed');
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
  test.setTimeout(45_000);
  await useHostingCsp(context, baseURL!);
  await page.goto('/regex/lab/');
  await page.getByLabel('Live', { exact: true }).uncheck();
  await page.getByLabel('Runtime', { exact: true }).selectOption('python');
  await source(page).fill('(?P<part>é+)');
  await subject(page).fill('😀éé, é');
  await run(page);
  await expect(status(page)).toHaveText('2 matches', { timeout: 22_000 });
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
  await source(page).fill('(?:)');
  await subject(page).fill('a'.repeat(280));
  await run(page);
  await expect(status(page)).toContainText('resource terminated');
  await source(page).fill('^a');
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
  if (!process.env.STRLING_LAB_TOOLS_CANDIDATE) {
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
  await source(page).fill(
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

  await subject(page).fill('😀héllo');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  const tools = page.locator('[data-output="compiler-tools"]');
  await expect(tools).toContainText('matched · not_applicable');
  expect(
    JSON.parse((await evidence.textContent())!).target.target_profile
      .profile_id,
  ).toBe('profile:ecmascript/2024');
  const privateText = 'private-subject-' + 'x'.repeat(20);
  await subject(page).fill(privateText);
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
  expect(
    requests.some(({ url }) =>
      url.endsWith('/_strling-lab/compiler-tools-0.1.0-rc.2.wasm'),
    ),
  ).toBe(true);
  expect(JSON.stringify(requests)).not.toContain(privateText);
  expect(
    await page.evaluate(
      (secret) =>
        location.href.includes(secret) ||
        Object.values(localStorage).some((value) => value.includes(secret)),
      privateText,
    ),
  ).toBe(false);

  await page
    .getByLabel('Compiler target', { exact: true })
    .selectOption('pcre243');
  await expect(status(page)).toContainText('Compiler succeeded');
  await subject(page).fill('😀héllo');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  await expect(tools).toContainText('matched · not_applicable');
  expect(
    JSON.parse((await evidence.textContent())!).target.target_profile
      .profile_id,
  ).toBe('profile:pcre2/10.43');

  await page.getByLabel('Source format').selectOption('semantic');
  const invalidSource =
    'semantic strling 1.0; case sensitive; pattern sequence { text "é😀"; bogus; }';
  await source(page).fill(invalidSource);
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

test('preserves canonical partial, unsupported, likely, unknown and unavailable in WebAssembly', async ({
  page,
}) => {
  test.skip(
    !process.env.STRLING_LAB_TOOLS_CANDIDATE,
    'Canonical adapter qualification requires the opt-in candidate build.',
  );
  await page.goto('/lab/');
  const results = await page.evaluate(async () => {
    const response = await fetch(
      '/_strling-lab/compiler-tools-0.1.0-rc.2.wasm',
    );
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
  });
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
  await source(page).fill(
    'semantic strling 1.0; case sensitive; pattern without backtracking { choice { text "a"; text "ab"; } }',
  );
  await tab(page, 'Semantic tools');
  await page.getByRole('button', { name: 'Explain current subject' }).click();
  await expect(page.locator('[data-output="compiler-tools"]')).toContainText(
    'unavailable · unavailable',
  );
  await page.getByLabel('Explanation scope').selectOption('semantic');
  await subject(page).fill('a');
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
  await source(page).fill(
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
  await source(page).fill('(?J)(?<part>a)|(?<part>b)');
  await subject(page).fill('b a');
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
  await subject(page).fill('a');
  await expect(page.getByText('1 of 1 tests passed.')).toBeHidden();
});

test('observes multiline, full-match, replacement and split behavior in each runtime family', async ({
  page,
}) => {
  test.setTimeout(50_000);
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
    await source(page).fill('^a(.)$');
    await subject(page).fill('😀\naé\nb');
    await operation.selectOption('scan');
    await run(page);
    await expect(status(page)).toHaveText('1 match', { timeout: 20_000 });
    expect(JSON.parse((await result.textContent())!).matches[0]).toMatchObject({
      value: 'aé',
      span: { start, unit },
      captures: [{ value: 'é' }],
    });

    await operation.selectOption('fullmatch');
    await run(page);
    await expect(status(page)).toHaveText('No match');

    await source(page).fill('[,;]');
    await subject(page).fill('a,b;c');
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
  await source(page).fill(
    'semantic strling 1.0; case sensitive; pattern empty;',
  );
  await subject(page).fill('😀');
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
  await source(page).fill('word');
  await subject(page).fill('one word');
  const stalled = await stallNextExecutionWorker(page);
  const created = page.waitForEvent('worker', (worker) =>
    executionWorker.test(worker.url()),
  );
  await run(page);
  await created;
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
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
