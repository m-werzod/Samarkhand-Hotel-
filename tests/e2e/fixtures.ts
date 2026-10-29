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

/** Where `auth.setup.ts` saves the signed-in session. */
export const ADMIN_STATE_FILE = 'test-results/.auth/admin.json';

/**
 * Sign in through the real login form.
 *
 * Most admin tests inherit a saved session instead (see `auth.setup.ts`),
 * because signing in per test would exhaust the login rate limit. This helper
 * remains for the tests that are specifically about signing in.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Parol').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Kirish' }).click();

  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
}

/** A date `offset` days from today, as `YYYY-MM-DD`. */
export function futureDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Assert the page does not slide sideways under a reader's thumb.
 *
 * Two separate things are checked, because `scrollWidth > clientWidth` alone
 * is not the property that matters:
 *
 *  1. **The page cannot actually be scrolled horizontally.** Tested by trying
 *    to scroll and confirming the offset stays at zero. This is what a
 *    visitor experiences.
 *  2. **No element escapes the viewport unclipped.** A carousel track is
 *    wider than the screen by design and sits inside `overflow: hidden`;
 *    that is correct and must not fail. An element hanging over the edge
 *    with no clipping ancestor is a real layout break.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const before = window.scrollX;
    window.scrollTo(5000, window.scrollY);
    const scrolled = window.scrollX;
    window.scrollTo(before, window.scrollY);

    const limit = document.documentElement.clientWidth;
    const offenders: string[] = [];

    for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right <= limit + 1 && rect.left >= -1) continue;

      let clipped = false;
      let parent = element.parentElement;
      while (parent) {
        if (/hidden|clip|auto|scroll/.test(getComputedStyle(parent).overflowX)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (clipped) continue;

      const classes = String(element.className).split(' ').slice(0, 3).join('.');
      offenders.push(
        `${element.tagName.toLowerCase()}.${classes} → ${Math.round(rect.left)}…${Math.round(rect.right)} of ${limit}`,
      );
    }

    return { scrolled, offenders: offenders.slice(0, 5) };
  });

  expect(result.scrolled, 'page can be scrolled horizontally').toBe(0);
  expect(result.offenders, 'elements escape the viewport unclipped').toEqual([]);
}
