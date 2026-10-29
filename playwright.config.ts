import { defineConfig, devices } from '@playwright/test';

import { ADMIN_STATE_FILE } from './tests/e2e/fixtures';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * Runs against a production build, not the dev server: dev-only behaviour
 * (React Refresh, unminified bundles, different error overlays) is exactly
 * the kind of difference that lets a real bug through an E2E suite.
 *
 * Admin credentials are provisioned for the test run through environment
 * variables, so the suite exercises the real authentication path rather than
 * a bypass. The hash below is a throwaway generated for tests only.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'uz-UZ',
    timezoneId: 'Asia/Samarkand',
  },

  projects: [
    // Signs in once and saves the session. Everything that needs an
    // authenticated context depends on this, so the suite does not exhaust
    // the login rate limit it is also meant to be protected by.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    {
      name: 'public',
      testMatch: /guest-journey\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'admin',
      testMatch: /(admin|security|responsive)\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        storageState: ADMIN_STATE_FILE,
      },
    },
    {
      name: 'mobile',
      testMatch: /guest-journey\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NODE_ENV: 'production',
      E2E: '1',
      /*
       * Test-only credentials for a throwaway account that exists only while
       * the suite runs. This is a scrypt hash, not a password, and the
       * plaintext (`samarkhand-e2e-password`) is a known test fixture — both
       * live in `tests/e2e/fixtures.ts`. Nothing here is used by, or valid
       * for, any deployed environment.
       */
      ADMIN_EMAIL: 'e2e@samarkhand.test',
      ADMIN_PASSWORD_HASH:
        process.env.E2E_ADMIN_PASSWORD_HASH ??
        'scrypt$32768$8$1$gsOaziwnRfC+eFS5QUQycg==$6jsewhy90WNbMPbDnh3HoVnm56/OwVx7etEvcF38+d924cqJQuBqWhEew6Tu1NgtBSafsmgCv6tHIAJXM5ZZ5g==',
      ADMIN_SESSION_SECRET:
        process.env.E2E_SESSION_SECRET ?? 'e2e-only-session-secret-not-for-production-use',
    },
  },
});
