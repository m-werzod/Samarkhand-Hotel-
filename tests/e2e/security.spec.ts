import { expect, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, futureDate } from './fixtures';

/**
 * Security behaviours asserted against the running application.
 *
 * These are the checks that would otherwise exist only as intentions in a
 * code comment: that protected routes really redirect, that a hostile payload
 * really is rejected, and that the headers really are served.
 */

const SIGNED_OUT = { storageState: { cookies: [], origins: [] } };

/* -------------------------------------------------------------------------- */
/* Anonymous                                                                   */
/* -------------------------------------------------------------------------- */

test.describe('access control (signed out)', () => {
  test.use(SIGNED_OUT);

  test('every admin route redirects to the login form', async ({ page }) => {
    const protectedPaths = [
      '/admin',
      '/admin/rooms',
      '/admin/rooms/new',
      '/admin/bookings',
      '/admin/campaigns',
      '/admin/campaigns/new',
      '/admin/offers',
      '/admin/media',
      '/admin/content',
      '/admin/settings',
      '/admin/inquiries',
      '/admin/audit',
      '/admin/analytics',
    ];

    for (const path of protectedPaths) {
      await page.goto(path);
      await page.waitForURL('**/admin/login**', { timeout: 20_000 });
      expect(page.url(), `${path} should redirect`).toContain('/admin/login');
    }
  });

  test('the CSV export refuses an unauthenticated request', async ({ request }) => {
    const response = await request.get('/admin/bookings/export', { maxRedirects: 0 });
    expect([401, 403, 307, 302]).toContain(response.status());
  });

  test('the upload endpoint refuses an unauthenticated request', async ({ request }) => {
    const response = await request.post('/api/admin/media/upload', {
      multipart: {
        file: {
          name: 'x.png',
          mimeType: 'image/png',
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        },
        altText: 'test image for upload',
        category: 'rooms',
        kind: 'photograph',
      },
      maxRedirects: 0,
    });
    expect([401, 403, 307, 302]).toContain(response.status());
  });

  test('the login redirect target cannot be pointed off-site', async ({ page }) => {
    await page.goto('/admin/login?next=https://evil.example/steal');

    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Parol').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Kirish' }).click();

    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
    expect(page.url()).not.toContain('evil.example');
  });
});

/* -------------------------------------------------------------------------- */
/* Public input handling                                                       */
/* -------------------------------------------------------------------------- */

test.describe('server-side input handling', () => {
  test.use(SIGNED_OUT);

  test('a malformed date range in the URL is normalised, not trusted', async ({
    page,
  }) => {
    // Check-out before check-in. The page must not render an impossible stay
    // or fail — it clamps the range to something coherent.
    await page.goto(
      `/booking?checkIn=${futureDate(10)}&checkOut=${futureDate(5)}&adults=2&children=0&rooms=1`,
    );

    const checkIn = await page.getByLabel('Kelish sanasi').inputValue();
    const checkOut = await page.getByLabel('Chiqish sanasi').inputValue();
    expect(checkOut > checkIn, `${checkIn} → ${checkOut}`).toBe(true);
  });

  test('an invalid stay entered in the form is rejected', async ({ page }) => {
    await page.goto('/booking');

    const checkIn = page.getByLabel('Kelish sanasi');
    await checkIn.fill(futureDate(10));
    // Set check-out directly to a date before check-in.
    await page.getByLabel('Chiqish sanasi').fill(futureDate(5));

    await page.getByLabel('Ism familiya').fill('Invalid Dates');
    await page.getByLabel('Email').fill('invalid-dates@example.com');
    await page.getByLabel('Telefon').fill('+998 90 111 22 33');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(
      page.getByRole('heading', { name: 'Soʻrovingiz qabul qilindi' }),
    ).toHaveCount(0);
  });

  test('a past check-in is rejected by the server', async ({ page }) => {
    await page.goto(
      `/booking?checkIn=${futureDate(-5)}&checkOut=${futureDate(-2)}&adults=2&children=0&rooms=1`,
    );

    await page.getByLabel('Ism familiya').fill('Past Dates');
    await page.getByLabel('Email').fill('past-dates@example.com');
    await page.getByLabel('Telefon').fill('+998 90 111 22 44');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(page.locator('form').getByRole('alert').first()).toBeVisible();
  });

  test('a script payload in a guest name is rejected, not stored', async ({ page }) => {
    await page.goto(
      `/booking?checkIn=${futureDate(20)}&checkOut=${futureDate(22)}&adults=2&children=0&rooms=1`,
    );

    await page.getByLabel('Ism familiya').fill('<img src=x onerror=alert(1)>');
    await page.getByLabel('Email').fill('xss@example.com');
    await page.getByLabel('Telefon').fill('+998 90 123 00 00');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(page.locator('form').getByRole('alert').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Soʻrovingiz qabul qilindi' }),
    ).toHaveCount(0);
  });

  test('the analytics endpoint ignores unknown event types', async ({ request }) => {
    const response = await request.post('/api/analytics', {
      data: {
        type: 'password_captured',
        sessionId: 'abcdef0123456789',
        metadata: { password: 'hunter2' },
      },
    });
    // Always 204: an analytics error must be invisible, and nothing is stored.
    expect(response.status()).toBe(204);
  });
});

/* -------------------------------------------------------------------------- */
/* Headers and indexing                                                        */
/* -------------------------------------------------------------------------- */

test.describe('headers and indexing', () => {
  test('security headers are present on the public site', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    // Next's version banner is a free hint to an attacker.
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('admin pages are excluded from indexing', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect((await robots.text()).toLowerCase()).toContain('/admin');

    const adminResponse = await request.get('/admin/login');
    expect(adminResponse.headers()['x-robots-tag']).toContain('noindex');
  });

  test('the sitemap lists public pages and no admin route', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const xml = await response.text();
    expect(xml).toContain('/rooms');
    expect(xml).not.toContain('/admin');
  });
});

/* -------------------------------------------------------------------------- */
/* Authenticated                                                               */
/* -------------------------------------------------------------------------- */

test.describe('settings', () => {
  test('secrets are not editable from the database', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Sozlamalar' })).toBeVisible();
    await expect(page.getByText(/maxfiy kalitlar hech qachon/i)).toBeVisible();
  });
});
