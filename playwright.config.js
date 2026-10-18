import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build (`vite preview`) in Chromium, Firefox and WebKit.
 *   E2E_BROWSERS=chromium,webkit  run a subset of engines
 *   E2E_TARGET=dev                run against the Vite dev server instead of the build
 */
const ENGINES = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
};
const browsers = (process.env.E2E_BROWSERS ?? Object.keys(ENGINES).join(',')).split(',').map((b) => b.trim());
const dev = process.env.E2E_TARGET === 'dev';
const port = dev ? 5173 : 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: browsers.map((name) => {
    if (!ENGINES[name]) throw new Error(`Unknown browser "${name}" in E2E_BROWSERS (use ${Object.keys(ENGINES).join(', ')})`);
    return { name, use: { ...ENGINES[name] } };
  }),
  webServer: {
    command: dev ? 'npx vite' : 'npx vite preview',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
