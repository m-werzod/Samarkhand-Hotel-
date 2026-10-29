import { expect, type Page } from '@playwright/test';

/**
 * Shared end-to-end helpers.
 *
 * The admin credentials here match the throwaway account provisioned in
 * `playwright.config.ts`. They are valid only for the duration of a test run
 * against a locally built server.
 */
export const ADMIN_EMAIL = 'e2e@samarkhand.test';
export const ADMIN_PASSWORD = 'samarkhand-e2e-password';

/** Sign in through the real login form, not by forging a cookie. */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Parol').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Kirish' }).click();

  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
}

/** A date `offset` days from today, as `YYYY-MM-DD`. */
export function futureDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Assert that nothing on the page causes horizontal scrolling.
 *
 * A 1px tolerance absorbs sub-pixel rounding in the layout engine; anything
 * larger is a real overflow a visitor would feel as the page sliding under
 * their thumb.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
}
