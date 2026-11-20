import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.STRLING_WEBSITE_PREVIEW_PORT ?? 4321);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Set STRLING_WEBSITE_PREVIEW_PORT to an available TCP port.');
}
const preview = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: preview,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Use the foreground API so Playwright owns the preview's lifetime.
    command: `"${process.execPath}" --input-type=module -e "import { preview } from 'astro'; await preview({ server: { host: '127.0.0.1', port: ${port} } });"`,
    url: preview,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
});
