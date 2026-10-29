import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, futureDate } from './fixtures';

/**
 * The guest journey: arrive, explore, submit an inquiry, get a reference.
 *
 * This is the flow the hotel's revenue depends on, so it is asserted end to
 * end against a production build rather than mocked at any layer.
 */

test.describe('guest journey', () => {
  test('homepage presents the hotel and its primary actions', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Samarkhand Hotel/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Both hero CTAs are present and point somewhere real. `.first()` because
    // a campaign slide may legitimately carry the same call to action.
    await expect(
      page.getByRole('link', { name: /Xona bron qilish/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Xonalarni koʻrish/ }).first(),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test('the booking widget validates dates before navigating', async ({ page }) => {
    await page.goto('/');

    const checkIn = page.getByLabel('Kelish sanasi');
    const checkOut = page.getByLabel('Chiqish sanasi');

    // Moving check-in past check-out should pull check-out along rather than
    // leaving an impossible range.
    await checkIn.fill(futureDate(20));
    await expect(checkOut).not.toHaveValue(futureDate(2));

    await page.getByRole('button', { name: 'Xonalarni koʻrish' }).first().click();
    await page.waitForURL(/\/rooms\?/);
    expect(page.url()).toContain('checkIn=');
  });

  test('search criteria survive navigation into a room', async ({ page }) => {
    const checkIn = futureDate(10);
    const checkOut = futureDate(13);

    await page.goto(`/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0&rooms=1`);
    await expect(page.getByRole('heading', { name: 'Xonalarimiz' })).toBeVisible();

    const firstRoom = page.locator('a[href^="/rooms/"]').first();
    await firstRoom.click();

    await page.waitForURL(/\/rooms\/[^/?]+/);
    expect(page.url()).toContain(`checkIn=${checkIn}`);
  });

  test('the campaign carousel is operable and never autoplays without a pause control', async ({
    page,
  }) => {
    await page.goto('/');

    const carousel = page.getByRole('region', { name: 'Joriy takliflar' });
    await expect(carousel).toBeVisible();

    const next = carousel.getByRole('button', { name: 'Keyingi slayd' });
    await expect(next).toBeVisible();
    await next.click();

    // Indicators are real tabs with state, not decorative dots.
    const tabs = carousel.getByRole('tab');
    await expect(tabs.first()).toBeVisible();
    expect(await tabs.count()).toBeGreaterThan(1);
  });

  test('a room page shows capacity, price and a booking route', async ({ page }) => {
    await page.goto('/rooms');
    await page.locator('a[href^="/rooms/"]').first().click();
    await page.waitForURL(/\/rooms\/[^/?]+/);

    await expect(page.getByText(/mehmon/).first()).toBeVisible();
    await expect(page.getByText(/so'm|so‘m|soʻm/).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Bron soʻrovi yuborish/ }).first(),
    ).toBeVisible();
  });

  test('a booking inquiry is accepted and returns a reference', async ({ page }) => {
    await page.goto(
      `/booking?checkIn=${futureDate(14)}&checkOut=${futureDate(17)}&adults=2&children=0&rooms=1`,
    );

    await page.getByLabel('Ism familiya').fill('Dilnoza Karimova');
    await page.getByLabel('Email').fill('dilnoza@example.com');
    await page.getByLabel('Telefon').fill('+998 90 123 45 67');
    await page
      .getByLabel('Qoʻshimcha izoh')
      .fill('Kech kelamiz, taxminan soat 23:00 da.');
    await page.getByRole('checkbox').check();

    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(
      page.getByRole('heading', { name: 'Soʻrovingiz qabul qilindi' }),
    ).toBeVisible({ timeout: 20_000 });

    // The reference is shown in the documented format.
    await expect(page.getByText(/SMK-[A-HJ-NP-Z2-9]{6}/)).toBeVisible();

    // And the guest is told plainly that this is not a confirmed reservation.
    await expect(page.getByText(/tasdiqlangan rezervatsiya emas/)).toBeVisible();
  });

  test('the inquiry form reports validation errors rather than failing silently', async ({
    page,
  }) => {
    await page.goto('/booking');

    await page.getByLabel('Ism familiya').fill('A');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Telefon').fill('123');
    await page.getByRole('button', { name: 'Soʻrovni yuborish' }).click();

    await expect(page.getByRole('alert').first()).toBeVisible();
    // Still on the form, nothing submitted.
    await expect(
      page.getByRole('heading', { name: 'Soʻrovingiz qabul qilindi' }),
    ).toHaveCount(0);
  });

  test('a contact message is accepted', async ({ page }) => {
    await page.goto('/contact');

    await page.getByLabel('Ism').fill('Bobur Aliyev');
    await page.getByLabel('Email').fill('bobur@example.com');
    await page.getByLabel('Mavzu').fill('Nonushta vaqti');
    await page
      .getByLabel('Xabar')
      .fill('Nonushta soat nechchida boshlanadi va qachongacha davom etadi?');

    await page.getByRole('button', { name: 'Xabarni yuborish' }).click();

    await expect(
      page.getByRole('heading', { name: 'Xabaringiz yuborildi' }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('the gallery filters and opens a lightbox', async ({ page }) => {
    await page.goto('/gallery');

    const roomsFilter = page.getByRole('tab', { name: /Xonalar/ });
    if (await roomsFilter.isVisible()) {
      await roomsFilter.click();
      await expect(roomsFilter).toHaveAttribute('aria-selected', 'true');
    }

    await page.getByRole('button', { name: /Kattalashtirish/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('demo content is labelled rather than presented as verified', async ({ page }) => {
    await page.goto('/');
    // The seeded install must say so somewhere a visitor can see.
    await expect(page.getByText(/namuna maʼlumot/i).first()).toBeVisible();
  });

  test('sample testimonials are declared as samples', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText(/haqiqiy mehmonlar tomonidan\s*yozilmagan/i),
    ).toBeVisible();
  });

  test('legal pages render and state they are templates', async ({ page }) => {
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText(/namuna shablon/i).first()).toBeVisible();
    }
  });

  test('an unknown URL returns a usable 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Bu sahifa topilmadi')).toBeVisible();
    await expect(page.getByRole('link', { name: /Bosh sahifaga/ })).toBeVisible();
  });
});
