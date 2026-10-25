import { defineConfig, devices } from '@playwright/test';

const PORT = 4193;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * The suite runs against the real production bundle (`vite build` + `vite preview`),
 * so what is tested is exactly what ships to GitHub Pages.
 *
 * Two projects keep the assertions honest per form factor:
 *  - `desktop-chromium` runs the full workbench suite at 1440×900;
 *  - `iphone-13` runs the touch/layout suite with real iPhone 13 metrics
 *    (390×844 CSS px, DPR 3, touch input, iOS Safari user agent). Chromium is
 *    used as the rendering engine so the suite needs a single browser download;
 *    the metric, media-query and touch behaviour under test is engine-agnostic.
 *  - `responsive-matrix` resizes a single Chromium context across 10 widths
 *    (320 → 1920) and asserts the author badge placement plus the absence of
 *    horizontal overflow at every one of them.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /workbench\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'iphone-13',
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'responsive-matrix',
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'samples',
      testMatch: /samples\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
