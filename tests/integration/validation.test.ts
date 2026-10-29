import { describe, expect, it } from 'vitest';

import {
  bookingInquirySchema,
  bookingSearchSchema,
  campaignInputSchema,
  contactFormSchema,
  hotelSettingsSchema,
  offerInputSchema,
  roomInputSchema,
  analyticsEventSchema,
} from '@/lib/validation/schemas';

/**
 * Validation is the outermost line of defence on every write path, so these
 * tests push hostile and sloppy input at it rather than only happy paths.
 */

const validSearch = {
  checkIn: '2026-06-01',
  checkOut: '2026-06-04',
  adults: 2,
  children: 0,
  rooms: 1,
};

const validInquiry = {
  ...validSearch,
  roomId: 'room-deluxe',
  fullName: 'Dilnoza Karimova',
  email: 'Dilnoza@Example.COM',
  phone: '+998 90 123 45 67',
  specialRequests: 'Kech kelamiz',
  acceptedTerms: true as const,
};

describe('booking search', () => {
  it('accepts a valid search', () => {
    expect(bookingSearchSchema.safeParse(validSearch).success).toBe(true);
  });

  it('coerces numeric strings from a form submission', () => {
    const result = bookingSearchSchema.safeParse({
      ...validSearch,
      adults: '3',
      rooms: '2',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adults).toBe(3);
      expect(result.data.rooms).toBe(2);
    }
  });

  it('rejects check-out on or before check-in', () => {
    const result = bookingSearchSchema.safeParse({
      ...validSearch,
      checkOut: '2026-06-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['checkOut']);
    }
  });

  it('rejects more rooms than adults', () => {
    const result = bookingSearchSchema.safeParse({ ...validSearch, rooms: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    expect(
      bookingSearchSchema.safeParse({ ...validSearch, checkIn: '2026-02-30' }).success,
    ).toBe(false);
  });
});

describe('booking inquiry', () => {
  it('accepts a complete inquiry and normalises the email', () => {
    const result = bookingInquirySchema.safeParse(validInquiry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('dilnoza@example.com');
    }
  });

  it('requires the terms checkbox', () => {
    const result = bookingInquirySchema.safeParse({
      ...validInquiry,
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts the separators guests actually type in a phone number', () => {
    for (const phone of ['+998901234567', '998 90 123-45-67', '(90) 123 45 67']) {
      expect(
        bookingInquirySchema.safeParse({ ...validInquiry, phone }).success,
        phone,
      ).toBe(true);
    }
  });

  it('rejects a phone number with too few digits to call back', () => {
    expect(bookingInquirySchema.safeParse({ ...validInquiry, phone: '12345' }).success).toBe(
      false,
    );
  });

  it('rejects a name containing markup delimiters', () => {
    expect(
      bookingInquirySchema.safeParse({
        ...validInquiry,
        fullName: '<script>alert(1)</script>',
      }).success,
    ).toBe(false);
  });

  it('rejects control characters in free text', () => {
    expect(
      bookingInquirySchema.safeParse({
        ...validInquiry,
        specialRequests: 'line\u0000break',
      }).success,
    ).toBe(false);
  });

  it('enforces a length ceiling on special requests', () => {
    expect(
      bookingInquirySchema.safeParse({
        ...validInquiry,
        specialRequests: 'a'.repeat(1001),
      }).success,
    ).toBe(false);
  });

  it('trims surrounding whitespace from the name', () => {
    const result = bookingInquirySchema.safeParse({
      ...validInquiry,
      fullName: '  Dilnoza  ',
    });
    expect(result.success && result.data.fullName).toBe('Dilnoza');
  });
});

describe('contact form', () => {
  const valid = {
    name: 'Bobur',
    email: 'bobur@example.com',
    subject: 'Savol',
    message: 'Nonushta soat nechchida boshlanadi?',
  };

  it('accepts a valid message', () => {
    expect(contactFormSchema.safeParse(valid).success).toBe(true);
  });

  it('treats phone as optional and tolerates an empty string', () => {
    expect(contactFormSchema.safeParse({ ...valid, phone: '' }).success).toBe(true);
  });

  it('rejects a message that is too short to act on', () => {
    expect(contactFormSchema.safeParse({ ...valid, message: 'salom' }).success).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(contactFormSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(
      false,
    );
  });
});

describe('room input', () => {
  const valid = {
    name: 'Deluxe xona',
    slug: 'deluxe-xona',
    shortDescription: 'Kengaytirilgan maydon va ikki deraza.',
    description: 'Deluxe xona kengroq maydoni bilan ajralib turadi va yorugʻ.',
    maxAdults: 2,
    maxChildren: 2,
    maxOccupancy: 3,
    bedConfiguration: 'king-size',
    sizeSqm: 32,
    basePriceMajor: 780_000,
    currency: 'UZS' as const,
    status: 'published' as const,
    sortOrder: 1,
    inventoryCount: 6,
    cancellationPolicy: null,
    isDemoData: false,
    amenityIds: [],
    mediaIds: [],
  };

  it('accepts a coherent room', () => {
    expect(roomInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a slug with spaces or capitals', () => {
    expect(roomInputSchema.safeParse({ ...valid, slug: 'Deluxe Xona' }).success).toBe(false);
    expect(roomInputSchema.safeParse({ ...valid, slug: 'deluxe_xona' }).success).toBe(false);
  });

  it('rejects occupancy below the adult count', () => {
    expect(roomInputSchema.safeParse({ ...valid, maxOccupancy: 1 }).success).toBe(false);
  });

  it('rejects occupancy above adults plus children', () => {
    expect(roomInputSchema.safeParse({ ...valid, maxOccupancy: 5 }).success).toBe(false);
  });

  it('rejects a negative price', () => {
    expect(roomInputSchema.safeParse({ ...valid, basePriceMajor: -1 }).success).toBe(false);
  });

  it('rejects negative inventory', () => {
    expect(roomInputSchema.safeParse({ ...valid, inventoryCount: -1 }).success).toBe(false);
  });
});

describe('offer input', () => {
  const valid = {
    name: 'Erta bron',
    description: 'Uch kecha va undan koʻp qolishda chegirma.',
    discountType: 'percentage' as const,
    discountValue: 15,
    eligibleRoomIds: [],
    startsAt: null,
    endsAt: null,
    minimumNights: 3,
    conditions: null,
    status: 'published' as const,
  };

  it('accepts a valid percentage offer', () => {
    expect(offerInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a percentage above the cap', () => {
    expect(offerInputSchema.safeParse({ ...valid, discountValue: 95 }).success).toBe(false);
  });

  it('rejects a zero discount of either kind', () => {
    expect(offerInputSchema.safeParse({ ...valid, discountValue: 0 }).success).toBe(false);
    expect(
      offerInputSchema.safeParse({
        ...valid,
        discountType: 'fixed',
        discountValue: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects an end before the start', () => {
    expect(
      offerInputSchema.safeParse({
        ...valid,
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-05-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('campaign input', () => {
  const valid = {
    title: 'Kuzgi Samarqand',
    subtitle: null,
    badge: null,
    mediaId: 'media-campaign-autumn',
    mobileMediaId: null,
    ctaLabel: 'Xonalarni koʻrish',
    ctaHref: '/rooms',
    offerId: null,
    roomId: null,
    status: 'published' as const,
    priority: 100,
    startsAt: null,
    endsAt: null,
    textAlign: 'left' as const,
    overlay: 'medium' as const,
  };

  it('accepts a valid campaign', () => {
    expect(campaignInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a javascript: CTA destination', () => {
    expect(
      campaignInputSchema.safeParse({ ...valid, ctaHref: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('rejects a CTA to a host that is not allowlisted', () => {
    expect(
      campaignInputSchema.safeParse({ ...valid, ctaHref: 'https://evil.example' }).success,
    ).toBe(false);
  });

  it('rejects a CTA label with no destination — a dead button', () => {
    expect(
      campaignInputSchema.safeParse({ ...valid, ctaHref: null }).success,
    ).toBe(false);
  });

  it('rejects a slide with neither media nor a title', () => {
    expect(
      campaignInputSchema.safeParse({
        ...valid,
        mediaId: null,
        title: null,
        ctaLabel: null,
        ctaHref: null,
      }).success,
    ).toBe(false);
  });

  it('accepts a text-free slide that has media', () => {
    expect(
      campaignInputSchema.safeParse({
        ...valid,
        title: null,
        subtitle: null,
        ctaLabel: null,
        ctaHref: null,
      }).success,
    ).toBe(true);
  });
});

describe('hotel settings', () => {
  const valid = {
    brandName: 'Samarkhand Hotel',
    tagline: 'Samarqand mehmondoʻstligi',
    phone: '+998901234567',
    email: 'hello@example.com',
    whatsappNumber: '',
    address: {
      line1: 'Registon koʻchasi 1',
      line2: null,
      city: 'Samarqand',
      region: null,
      postalCode: null,
      country: 'Oʻzbekiston',
      latitude: 39.6547,
      longitude: 66.9597,
      mapsUrl: '',
    },
    social: {
      instagram: '',
      telegram: '',
      whatsapp: '',
      facebook: '',
      youtube: '',
    },
    currency: 'UZS' as const,
    timeZone: 'Asia/Samarkand',
    locale: 'uz' as const,
    taxRatePercent: 0,
    serviceFeeMajor: 0,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    seoTitle: 'Samarkhand Hotel — Samarqandda mehmonxona',
    seoDescription:
      'Samarqand markazida joylashgan mehmonxona. Standart, deluxe va lyuks xonalar.',
    isDemoData: false,
  };

  it('accepts valid settings', () => {
    expect(hotelSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an Instagram URL pointing somewhere else', () => {
    const result = hotelSettingsSchema.safeParse({
      ...valid,
      social: { ...valid.social, instagram: 'https://evil.example/profile' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a correct Instagram URL', () => {
    expect(
      hotelSettingsSchema.safeParse({
        ...valid,
        social: { ...valid.social, instagram: 'https://instagram.com/samarkhand' },
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed time', () => {
    expect(hotelSettingsSchema.safeParse({ ...valid, checkInTime: '25:00' }).success).toBe(
      false,
    );
  });

  it('rejects out-of-range coordinates', () => {
    expect(
      hotelSettingsSchema.safeParse({
        ...valid,
        address: { ...valid.address, latitude: 120 },
      }).success,
    ).toBe(false);
  });
});

describe('analytics events', () => {
  it('accepts a known event type', () => {
    expect(analyticsEventSchema.safeParse({ type: 'home_viewed' }).success).toBe(true);
  });

  it('rejects an unknown event type', () => {
    expect(analyticsEventSchema.safeParse({ type: 'password_entered' }).success).toBe(false);
  });

  it('caps the number of metadata keys', () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`k${i}`, i]),
    );
    expect(
      analyticsEventSchema.safeParse({ type: 'home_viewed', metadata }).success,
    ).toBe(false);
  });

  it('rejects nested metadata, which could smuggle in personal data', () => {
    expect(
      analyticsEventSchema.safeParse({
        type: 'home_viewed',
        metadata: { guest: { email: 'a@example.com' } },
      }).success,
    ).toBe(false);
  });
});
