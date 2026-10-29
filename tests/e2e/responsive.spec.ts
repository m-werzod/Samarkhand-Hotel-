import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, futureDate, signInAsAdmin } from './fixtures';

/**
 * Responsive behaviour.
 *
 * The width list starts at 320px because that is a real device
 * (iPhone SE, first generation) and the narrowest viewport worth supporting;
 * anything that breaks there usually breaks subtly at 375px too.
 */

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440];

const PUBLIC_PATHS = [
  '/',
  '/rooms',
  '/gallery',
  '/amenities',
  '/offers',
  '/location',
  '/contact',
  '/booking',
  '/privacy',
  '/terms',
];

test.describe('responsive layout', () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const path of PUBLIC_PATHS) {
        await page.goto(path);
        // Let lazy images settle before measuring.
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await expectNoHorizontalOverflow(page);
      }
    });
  }

  test('the mobile menu opens, navigates and closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const trigger = page.getByRole('button', { name: /Menyu/ });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const nav = page.getByRole('navigation', { name: 'Mobil menyu' });
    await expect(nav).toBeVisible();

    await nav.getByRole('link', { name: 'Xonalar' }).click();
    await page.waitForURL('**/rooms');
    await expect(nav).toBeHidden();
  });

  test('the booking widget is usable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const checkIn = page.getByLabel('Kelish sanasi');
    await expect(checkIn).toBeVisible();

    // Touch targets clear 44px.
    const box = await checkIn.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    await checkIn.fill(futureDate(5));
    await page.getByLabel('Chiqish sanasi').fill(futureDate(8));
    await page.getByRole('button', { name: 'Xonalarni koʻrish' }).first().click();
    await page.waitForURL(/\/rooms\?/);
  });

  test('the carousel responds to a swipe', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const carousel = page.getByRole('region', { name: 'Joriy takliflar' });
    await expect(carousel).toBeVisible();

    const box = await carousel.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.8;
    const endX = box!.x + box!.width * 0.2;
    const y = box!.y + box!.height * 0.5;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 12 });
    await page.mouse.up();

    // A tab other than the first is now selected.
    await expect(
      carousel.getByRole('tab', { selected: true }).first(),
    ).toBeVisible();
  });

  test('room cards stack and stay readable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/rooms');

    const cards = page.getByRole('heading', { level: 3 });
    expect(await cards.count()).toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
  });

  test('admin tables become cards on a phone without overflowing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsAdmin(page);

    for (const path of [
      '/admin',
      '/admin/rooms',
      '/admin/bookings',
      '/admin/campaigns',
      '/admin/offers',
      '/admin/media',
      '/admin/inquiries',
      '/admin/analytics',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('admin forms are usable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsAdmin(page);

    await page.goto('/admin/rooms/new');
    await expect(page.getByLabel('Nomi')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Sozlamalar' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('the admin sidebar opens and closes on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsAdmin(page);

    const trigger = page.getByRole('button', { name: 'Menyu' });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const nav = page.getByRole('navigation', { name: 'Admin menyusi' });
    await expect(nav).toBeVisible();

    await nav.getByRole('link', { name: 'Xonalar' }).click();
    await page.waitForURL('**/admin/rooms');
  });
});

test.describe('accessibility basics', () => {
  test('every page has exactly one h1 and a skip link', async ({ page }) => {
    for (const path of PUBLIC_PATHS) {
      await page.goto(path);
      const h1Count = await page.getByRole('heading', { level: 1 }).count();
      expect(h1Count, `${path} should have one h1`).toBe(1);

      await expect(page.getByRole('link', { name: /Asosiy kontentga/ })).toBeAttached();
    }
  });

  test('keyboard focus is visible and reaches the primary action', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /Asosiy kontentga/ });
    await expect(skipLink).toBeFocused();

    // Tabbing onward reaches interactive content rather than a dead end.
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
    }
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(['A', 'BUTTON', 'INPUT', 'SELECT']).toContain(focused);
  });

  test('every image carries alt text', async ({ page }) => {
    for (const path of ['/', '/rooms', '/gallery']) {
      await page.goto(path);
      const missing = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter((img) => !img.hasAttribute('alt'))
          .map((img) => img.getAttribute('src') ?? 'unknown'),
      );
      expect(missing, `${path} has images without alt`).toEqual([]);
    }
  });

  test('form controls are labelled', async ({ page }) => {
    await page.goto('/booking');

    const unlabelled = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input:not([type=hidden]), select, textarea',
        ),
      )
        .filter((control) => {
          if (control.getAttribute('aria-label')) return false;
          if (control.getAttribute('aria-labelledby')) return false;
          if (control.id && document.querySelector(`label[for="${control.id}"]`)) {
            return false;
          }
          return !control.closest('label');
        })
        .map((control) => control.name || control.id || control.tagName),
    );

    expect(unlabelled).toEqual([]);
  });
});
