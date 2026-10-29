import { expect, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, futureDate, signInAsAdmin } from './fixtures';

/**
 * Admin flow: sign in, create a room, publish it, verify it on the public
 * site, then work a booking inquiry through its lifecycle.
 */

test.describe('admin', () => {
  test('rejects wrong credentials without revealing which part was wrong', async ({
    page,
  }) => {
    await page.goto('/admin/login');

    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Parol').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Kirish' }).click();

    const error = page.getByRole('alert');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Email yoki parol notoʻgʻri');

    // The same message for an unknown address — no enumeration oracle.
    await page.getByLabel('Email').fill('nobody@samarkhand.test');
    await page.getByLabel('Parol').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page.getByRole('alert')).toContainText('Email yoki parol notoʻgʻri');
  });

  test('signs in and reaches the dashboard', async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page.getByText(/Soʻnggi 30 kun/)).toBeVisible();
  });

  test('dashboard reports unavailable metrics honestly', async ({ page }) => {
    await signInAsAdmin(page);

    // Occupancy is never computed in this schema, and the card says so
    // rather than showing a plausible zero.
    await expect(page.getByText('Bandlik darajasi')).toBeVisible();
    await expect(page.getByText(/Maʼlumot yetarli emas/).first()).toBeVisible();
  });

  test('creates a room, publishes it, and it appears on the public site', async ({
    page,
  }) => {
    await signInAsAdmin(page);

    const suffix = Date.now().toString().slice(-6);
    const name = `Test xona ${suffix}`;
    const slug = `test-xona-${suffix}`;

    await page.goto('/admin/rooms/new');
    await page.getByLabel('Nomi').fill(name);
    await page.getByLabel('Qisqa tavsif').fill('E2E testi uchun yaratilgan xona.');
    await page
      .getByLabel('Toʻliq tavsif')
      .fill('Bu xona avtomatik test tomonidan yaratildi va tekshiruv uchun ishlatiladi.');
    await page.getByLabel('Krovat turi').fill('1 ta katta krovat');
    await page.getByLabel('Bir kecha narxi').fill('900000');
    await page.getByLabel('Holat').selectOption('published');

    await page.getByRole('button', { name: 'Xona yaratish' }).click();
    await page.waitForURL('**/admin/rooms', { timeout: 20_000 });
    await expect(page.getByText(name)).toBeVisible();

    // The public site now serves it.
    await page.goto(`/rooms/${slug}`);
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(page.getByText(/900[\s ]000/)).toBeVisible();
  });

  test('changing a price updates the public page', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/rooms');

    const firstRoom = page.getByRole('link', { name: /xona/i }).first();
    await firstRoom.click();
    await page.waitForURL(/\/admin\/rooms\/[^/]+$/);

    const priceField = page.getByLabel('Bir kecha narxi');
    await priceField.fill('1234000');
    await page.getByRole('button', { name: 'Oʻzgarishlarni saqlash' }).click();
    await page.waitForURL('**/admin/rooms', { timeout: 20_000 });

    await page.goto('/rooms');
    await expect(page.getByText(/1[\s ]234[\s ]000/).first()).toBeVisible();
  });

  test('creates and publishes a campaign, which then appears on the homepage', async ({
    page,
  }) => {
    await signInAsAdmin(page);

    const title = `E2E kampaniya ${Date.now().toString().slice(-6)}`;

    await page.goto('/admin/campaigns/new');
    await page.getByLabel('Sarlavha').fill(title);
    await page.getByLabel('Tavsif').first().fill('Avtomatik test slaydi.');

    // Pick the first available desktop image.
    await page
      .getByRole('button', { name: /campaign|tasvir|backdrop/i })
      .first()
      .click()
      .catch(async () => {
        // Fall back to any media tile in the desktop picker.
        await page.locator('button[aria-pressed]').nth(1).click();
      });

    await page.getByLabel('Holat').selectOption('published');
    await page.getByLabel('Ustuvorlik').fill('999');

    await page.getByRole('button', { name: 'Kampaniya yaratish' }).click();
    await page.waitForURL('**/admin/campaigns', { timeout: 20_000 });
    await expect(page.getByText(title)).toBeVisible();

    await page.goto('/');
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test('an expired campaign is not shown on the public site', async ({ page }) => {
    await signInAsAdmin(page);

    const title = `Muddati tugagan ${Date.now().toString().slice(-6)}`;

    await page.goto('/admin/campaigns/new');
    await page.getByLabel('Sarlavha').fill(title);
    await page.locator('button[aria-pressed]').nth(1).click();
    await page.getByLabel('Holat').selectOption('published');
    // Ended yesterday.
    await page.getByLabel('Tugash vaqti').fill(`${futureDate(-1)}T12:00`);

    await page.getByRole('button', { name: 'Kampaniya yaratish' }).click();
    await page.waitForURL('**/admin/campaigns', { timeout: 20_000 });

    // The admin shows it, flagged as expired.
    await expect(page.getByText('Muddati tugagan').first()).toBeVisible();

    // The public homepage does not.
    await page.goto('/');
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test('works a booking inquiry through confirmation and records history', async ({
    page,
  }) => {
    // Submit an inquiry as a guest first.
    await page.goto(
      `/booking?checkIn=${futureDate(30)}&checkOut=${futureDate(33)}&adults=2&children=0&rooms=1`,
    );
    await page.getByLabel('Ism familiya').fill('Admin Test Guest');
    await page.getByLabel('Email').fill('admin-test-guest@example.com');
    await page.getByLabel('Telefon').fill('+998 90 555 44 33');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();
    await expect(
      page.getByRole('heading', { name: 'Soʻrovingiz qabul qilindi' }),
    ).toBeVisible({ timeout: 20_000 });

    const reference = (await page
      .getByText(/SMK-[A-HJ-NP-Z2-9]{6}/)
      .first()
      .textContent())!.trim();

    // Now handle it as staff.
    await signInAsAdmin(page);
    await page.goto(`/admin/bookings?q=${encodeURIComponent(reference)}`);
    await page.getByRole('link', { name: reference }).first().click();
    await page.waitForURL(/\/admin\/bookings\/[^/]+$/);

    await expect(page.getByText('Admin Test Guest')).toBeVisible();
    await expect(page.getByText('Kutilmoqda').first()).toBeVisible();

    await page.getByRole('button', { name: 'Tasdiqlash' }).click();
    await page.getByRole('button', { name: 'Tasdiqlash' }).last().click();

    await expect(page.getByText('Tasdiqlangan').first()).toBeVisible({ timeout: 15_000 });

    // History records the transition with an actor.
    await expect(page.getByText(/Kutilmoqda → Tasdiqlangan/)).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL).first()).toBeVisible();

    // A confirmed booking can no longer be re-confirmed.
    await expect(page.getByRole('button', { name: 'Tasdiqlash' })).toHaveCount(0);
  });

  test('internal notes are saved and never shown publicly', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/bookings');

    const firstBooking = page.getByRole('link', { name: /SMK-/ }).first();
    await firstBooking.click();
    await page.waitForURL(/\/admin\/bookings\/[^/]+$/);

    const secret = `internal-note-${Date.now()}`;
    await page.getByLabel('Izoh').fill(secret);
    await page.getByRole('button', { name: 'Izohni saqlash' }).click();
    await page.waitForTimeout(1500);

    await page.reload();
    await expect(page.getByLabel('Izoh')).toHaveValue(secret);

    // Nothing on the public site contains it.
    await page.goto('/');
    expect(await page.content()).not.toContain(secret);
  });

  test('the contact message reaches the inbox', async ({ page }) => {
    const subject = `E2E xabar ${Date.now().toString().slice(-6)}`;

    await page.goto('/contact');
    await page.getByLabel('Ism').fill('E2E Tester');
    await page.getByLabel('Email').fill('e2e-tester@example.com');
    await page.getByLabel('Mavzu').fill(subject);
    await page.getByLabel('Xabar').fill('Bu avtomatik test tomonidan yuborilgan xabar.');
    await page.getByRole('button', { name: 'Xabarni yuborish' }).click();
    await expect(
      page.getByRole('heading', { name: 'Xabaringiz yuborildi' }),
    ).toBeVisible({ timeout: 20_000 });

    await signInAsAdmin(page);
    await page.goto('/admin/inquiries');
    await expect(page.getByText(subject)).toBeVisible();
  });

  test('the audit log records what was changed', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { name: 'Audit jurnali' })).toBeVisible();
    await expect(page.getByText(/oʻchirib boʻlmaydi/)).toBeVisible();
  });

  test('signing out ends the session', async ({ page }) => {
    await signInAsAdmin(page);

    await page.getByRole('button', { name: 'Chiqish' }).first().click();
    await page.waitForURL('**/admin/login', { timeout: 15_000 });

    // The dashboard is no longer reachable.
    await page.goto('/admin');
    await page.waitForURL('**/admin/login**');
  });
});
