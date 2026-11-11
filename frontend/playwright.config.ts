import { defineConfig } from '@playwright/test';

/**
 * End-to-end regression tests for layout bugs that jsdom cannot see
 * (canvas growing during a hold on a high-DPR phone). Specs live in `e2e/`;
 * Vitest does not pick them up (its `include` is `tests/**`).
 *
 * Both projects emulate a Galaxy S24+ class Android Chrome: touch, mobile
 * viewport, device pixel ratio 3 or higher. Service workers are blocked so a
 * cached bundle can never hide a regression.
 */
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/130.0.0.0 Mobile Safari/537.36';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    userAgent: ANDROID_UA,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  },
  projects: [
    {
      name: 'galaxy-s24-384x832-dpr3',
      use: { viewport: { width: 384, height: 832 }, deviceScaleFactor: 3 },
    },
    {
      name: 'galaxy-s24plus-412x915-dpr3.5',
      use: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5 },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
