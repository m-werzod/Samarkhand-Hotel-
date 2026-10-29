import { expect, test as setup } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE_FILE } from './fixtures';

/**
 * Signs in once and saves the session for the admin and security projects.
 *
 * Signing in per test would hammer the login rate limiter — 8 attempts per 15
 * minutes — and the suite would start failing on its own brute-force
 * protection. That protection working is a feature, so the tests adapt to it
 * rather than the other way round.
 *
 * This still exercises the real login form and the real cookie; only the
 * repetition is removed.
 */
setup('authenticate as administrator', async ({ page }) => {
  await page.goto('/admin/login');

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Parol').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Kirish' }).click();

  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();

  await page.context().storageState({ path: ADMIN_STATE_FILE });
});
