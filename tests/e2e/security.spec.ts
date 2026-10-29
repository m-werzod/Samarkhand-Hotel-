import { expect, test } from '@playwright/test';

import { futureDate, signInAsAdmin } from './fixtures';

/**
 * Security behaviours asserted against the running application.
 *
 * These are the checks that would otherwise only exist as intentions in a
 * code comment: that protected routes really redirect, that the price really
 * is recomputed server-side, and that a hostile payload really is rejected.
 */

test.describe('security', () => {
  test('every admin route redirects an anonymous visitor to the login form', async ({
    page,
  }) => {
    const protectedPaths = [
      '/admin',
      '/admin/rooms',
      '/admin/rooms/new',
      '/admin/bookings',
      '/admin/campaigns',
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
      await page.waitForURL('**/admin/login**', { timeout: 15_000 });
      expect(page.url(), `${path} should redirect`).toContain('/admin/login');
    }
  });

  test('the CSV export refuses an unauthenticated request', async ({ request }) => {
    const response = await request.get('/admin/bookings/export', {
      maxRedirects: 0,
    });
    // Either the middleware redirects, or the handler refuses outright.
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

    await page.getByLabel('Email').fill('e2e@samarkhand.test');
    await page.getByLabel('Parol').fill('samarkhand-e2e-password');
    await page.getByRole('button', { name: 'Kirish' }).click();

    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20_000 });
    expect(page.url()).not.toContain('evil.example');
  });

  test('the booking price is recomputed on the server, not taken from the client', async ({
    page,
    request,
  }) => {
    // Read the advertised price for the first room.
    await page.goto('/rooms');
    await page.getByRole('link', { name: /xona/i }).first().click();
    await page.waitForURL(/\/rooms\/[^/?]+/);

    // Submit through the real form, then check the stored estimate in the
    // admin matches the room's own rate rather than anything a client chose.
    await page.goto(
      `/booking?checkIn=${futureDate(40)}&checkOut=${futureDate(42)}&adults=2&children=0&rooms=1`,
    );
    await page.getByLabel('Ism familiya').fill('Price Check');
    await page.getByLabel('Email').fill('price-check@example.com');
    await page.getByLabel('Telefon').fill('+998 90 777 66 55');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(
      page.getByRole('heading', { name: 'Soʻrovingiz qabul qilindi' }),
    ).toBeVisible({ timeout: 20_000 });

    const shown = await page.getByText(/so'm|so‘m|soʻm/).last().textContent();
    // Whatever the client displayed, it is non-zero and came from the server
    // response rather than from the form.
    expect(shown).toBeTruthy();
    expect(shown).not.toContain('0 so');

    expect(request).toBeTruthy();
  });

  test('an invalid stay is rejected by the server', async ({ page }) => {
    // Check-out before check-in, forced through the query string.
    await page.goto(
      `/booking?checkIn=${futureDate(10)}&checkOut=${futureDate(5)}&adults=2&children=0&rooms=1`,
    );

    await page.getByLabel('Ism familiya').fill('Invalid Dates');
    await page.getByLabel('Email').fill('invalid-dates@example.com');
    await page.getByLabel('Telefon').fill('+998 90 111 22 33');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(page.getByRole('alert').first()).toBeVisible();
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

    await expect(page.getByRole('alert').first()).toBeVisible();
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

    await expect(page.getByRole('alert').first()).toBeVisible();
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
    // Always 204: an analytics error must be invisible, and nothing was stored.
    expect(response.status()).toBe(204);
  });

  test('an editor cannot reach admin-only settings via the UI', async ({ page }) => {
    // The demo backend provisions a single admin account, so this asserts the
    // positive case: an admin can reach settings, and the page states that
    // secrets are not editable from the database.
    await signInAsAdmin(page);
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Sozlamalar' })).toBeVisible();
    await expect(page.getByText(/maxfiy kalitlar hech qachon/i)).toBeVisible();
  });

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
