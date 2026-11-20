import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.STRLING_WEBSITE_PREVIEW_PORT ?? 4321);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Set STRLING_WEBSITE_PREVIEW_PORT to an available TCP port.');
}
const cert = process.env.STRLING_WEBSITE_PREVIEW_CERT;
const key = process.env.STRLING_WEBSITE_PREVIEW_KEY;
if (Boolean(cert) !== Boolean(key)) {
  throw new Error('Set both local preview TLS file paths.');
}
const tls = Boolean(cert && key);
const preview = `${tls ? 'https' : 'http'}://127.0.0.1:${port}`;
const extraBrowsers = process.env.STRLING_WEBSITE_EXTRA_BROWSERS === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: preview,
    ignoreHTTPSErrors: tls,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Use the foreground API so Playwright owns the preview's lifetime.
    command: `"${process.execPath}" tests/preview.mjs`,
    url: preview,
    ignoreHTTPSErrors: tls,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    ...(extraBrowsers
      ? [
          { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
