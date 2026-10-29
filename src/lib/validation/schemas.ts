import { z } from 'zod';

import {
  BOOKING_STATUSES,
  CURRENCIES,
  DISCOUNT_TYPES,
  INQUIRY_STATUSES,
  LOCALES,
  MEDIA_CATEGORIES,
  PUBLICATION_STATUSES,
} from '@/lib/domain/types';
import {
  MAX_ADULTS_PER_SEARCH,
  MAX_CHILDREN_PER_SEARCH,
  MAX_ROOMS_PER_SEARCH,
  isCalendarDate,
} from '@/lib/domain/dates';
import { validateCtaHref } from '@/lib/domain/campaigns';
import { MAX_DISCOUNT_PERCENT } from '@/lib/domain/pricing';

/**
 * Zod schemas.
 *
 * These run on the server for every mutation, whether or not the client ran
 * them first. The client copy exists purely to give the guest fast feedback —
 * it is never the authority.
 *
 * Messages are in Uzbek because they surface directly in the UI.
 */

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                           */
/* -------------------------------------------------------------------------- */

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, { message: 'Sana notoʻgʻri kiritilgan.' });

/**
 * E.164-ish phone validation.
 *
 * Deliberately permissive about separators — guests type spaces, dashes and
 * parentheses — but strict about the digit count so the hotel can actually
 * call back.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, { message: 'Telefon raqami juda qisqa.' })
  .max(24, { message: 'Telefon raqami juda uzun.' })
  .refine(
    (value) => {
      const digits = value.replace(/[^\d]/g, '');
      return digits.length >= 7 && digits.length <= 15;
    },
    { message: 'Telefon raqamini toʻliq kiriting, masalan +998 90 123 45 67.' },
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, { message: 'Email manzilini kiriting.' })
  .max(254, { message: 'Email manzili juda uzun.' })
  .email({ message: 'Email manzili notoʻgʻri.' });

export const personNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Ismingizni kiriting.' })
  .max(120, { message: 'Ism juda uzun.' })
  // Blocks control characters and anything that reads as markup.
  .regex(/^[^<>{}\\\u0000-\u001f]+$/, {
    message: 'Ismda ruxsat etilmagan belgilar bor.',
  });

/** Free text from the public: length-bounded and stripped of control chars. */
export const freeTextSchema = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} ${max} belgidan oshmasligi kerak.` })
    .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/, {
      message: 'Matnda ruxsat etilmagan belgilar bor.',
    });

/** A site-relative path or allowlisted https URL, for CMS-controlled links. */
export const ctaHrefSchema = z.string().trim().superRefine((value, ctx) => {
  const result = validateCtaHref(value);
  if (!result.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Havola xavfsiz emas yoki ruxsat etilmagan domenga ishora qiladi.',
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Booking search                                                              */
/* -------------------------------------------------------------------------- */

export const occupancySchema = z.object({
  adults: z.coerce
    .number()
    .int()
    .min(1, { message: 'Kamida bitta kattalar boʻlishi kerak.' })
    .max(MAX_ADULTS_PER_SEARCH, {
      message: `Koʻpi bilan ${MAX_ADULTS_PER_SEARCH} kattalar.`,
    }),
  children: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_CHILDREN_PER_SEARCH, {
      message: `Koʻpi bilan ${MAX_CHILDREN_PER_SEARCH} bola.`,
    }),
  rooms: z.coerce
    .number()
    .int()
    .min(1, { message: 'Kamida bitta xona tanlang.' })
    .max(MAX_ROOMS_PER_SEARCH, {
      message: `Koʻpi bilan ${MAX_ROOMS_PER_SEARCH} xona.`,
    }),
});

/**
 * The plain object shape, kept separate from the refined schema so the
 * inquiry schema below can extend it. `.refine()` returns a ZodEffects, which
 * is no longer extendable.
 */
export const bookingSearchShape = occupancySchema.extend({
  checkIn: calendarDateSchema,
  checkOut: calendarDateSchema,
});

/**
 * Cross-field stay rules. Written out at each use site rather than factored
 * into a generic helper — Zod's inference through a wrapper loses the field
 * types, and two short refinements are clearer than the generic that would
 * preserve them.
 */
export const CHECK_OUT_AFTER_CHECK_IN = {
  message: 'Chiqish sanasi kirish sanasidan keyin boʻlishi kerak.',
  path: ['checkOut'] as const,
};
export const ADULT_PER_ROOM = {
  message: 'Har bir xonada kamida bitta kattalar boʻlishi kerak.',
  path: ['rooms'] as const,
};

export const bookingSearchSchema = bookingSearchShape
  .refine((data) => data.checkOut > data.checkIn, {
    message: CHECK_OUT_AFTER_CHECK_IN.message,
    path: ['checkOut'],
  })
  .refine((data) => data.rooms <= data.adults, {
    message: ADULT_PER_ROOM.message,
    path: ['rooms'],
  });

export type BookingSearchInput = z.infer<typeof bookingSearchShape>;

/* -------------------------------------------------------------------------- */
/* Booking inquiry                                                             */
/* -------------------------------------------------------------------------- */

export const bookingInquiryShape = bookingSearchShape.extend({
  roomId: z.string().min(1, { message: 'Xona tanlanmagan.' }),
  fullName: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  specialRequests: freeTextSchema(1000, 'Qoʻshimcha izoh').optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Shartlarni qabul qilishingiz kerak.' }),
  }),
  /** Anti-spam honeypot: real guests never fill this. */
  website: z.string().max(0).optional(),
});

export const bookingInquirySchema = bookingInquiryShape
  .refine((data) => data.checkOut > data.checkIn, {
    message: CHECK_OUT_AFTER_CHECK_IN.message,
    path: ['checkOut'],
  })
  .refine((data) => data.rooms <= data.adults, {
    message: ADULT_PER_ROOM.message,
    path: ['rooms'],
  });

export type BookingInquiryInput = z.infer<typeof bookingInquiryShape>;

/* -------------------------------------------------------------------------- */
/* Contact form                                                                */
/* -------------------------------------------------------------------------- */

export const contactFormSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  subject: freeTextSchema(140, 'Mavzu').min(3, {
    message: 'Mavzuni kiriting.',
  }),
  message: freeTextSchema(2000, 'Xabar').min(10, {
    message: 'Xabar kamida 10 ta belgidan iborat boʻlsin.',
  }),
  website: z.string().max(0).optional(),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

/* -------------------------------------------------------------------------- */
/* Admin: authentication                                                       */
/* -------------------------------------------------------------------------- */

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { message: 'Parolni kiriting.' })
    .max(200, { message: 'Parol juda uzun.' }),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/* -------------------------------------------------------------------------- */
/* Admin: rooms                                                                */
/* -------------------------------------------------------------------------- */

export const roomInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: 'Xona nomini kiriting.' })
      .max(120, { message: 'Nom juda uzun.' }),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug faqat kichik harflar, raqamlar va tire belgisidan iborat.',
      })
      .max(72),
    shortDescription: freeTextSchema(200, 'Qisqa tavsif').min(10, {
      message: 'Qisqa tavsifni kiriting.',
    }),
    description: freeTextSchema(4000, 'Tavsif').min(20, {
      message: 'Tavsifni kiriting.',
    }),
    maxAdults: z.coerce.number().int().min(1).max(12),
    maxChildren: z.coerce.number().int().min(0).max(12),
    maxOccupancy: z.coerce.number().int().min(1).max(20),
    bedConfiguration: z
      .string()
      .trim()
      .min(2, { message: 'Krovat turini kiriting.' })
      .max(120),
    sizeSqm: z.coerce.number().int().min(5).max(1000).nullable().optional(),
    /** Entered in major units (so'm), converted on the server. */
    basePriceMajor: z.coerce
      .number()
      .min(0, { message: 'Narx manfiy boʻlishi mumkin emas.' })
      .max(1_000_000_000, { message: 'Narx juda katta.' }),
    currency: z.enum(CURRENCIES),
    status: z.enum(PUBLICATION_STATUSES),
    sortOrder: z.coerce.number().int().min(0).max(9999),
    inventoryCount: z.coerce
      .number()
      .int()
      .min(0, { message: 'Xonalar soni manfiy boʻlishi mumkin emas.' })
      .max(500),
    cancellationPolicy: freeTextSchema(1500, 'Bekor qilish shartlari')
      .nullable()
      .optional(),
    isDemoData: z.boolean(),
    amenityIds: z.array(z.string()).max(40),
    mediaIds: z.array(z.string()).max(30),
  })
  .refine((data) => data.maxOccupancy >= data.maxAdults, {
    message: 'Umumiy sigʻim kattalar sonidan kam boʻlmasligi kerak.',
    path: ['maxOccupancy'],
  })
  .refine((data) => data.maxOccupancy <= data.maxAdults + data.maxChildren, {
    message: 'Umumiy sigʻim kattalar va bolalar yigʻindisidan oshmasligi kerak.',
    path: ['maxOccupancy'],
  });

export type RoomInput = z.infer<typeof roomInputSchema>;

/* -------------------------------------------------------------------------- */
/* Admin: offers                                                               */
/* -------------------------------------------------------------------------- */

export const offerInputSchema = z
  .object({
    name: z.string().trim().min(2, { message: 'Taklif nomini kiriting.' }).max(120),
    description: freeTextSchema(1000, 'Tavsif'),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.coerce.number().min(0),
    eligibleRoomIds: z.array(z.string()).max(100),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    minimumNights: z.coerce.number().int().min(1).max(30),
    conditions: freeTextSchema(1000, 'Shartlar').nullable().optional(),
    status: z.enum(PUBLICATION_STATUSES),
  })
  .refine(
    (data) =>
      data.discountType !== 'percentage' ||
      (data.discountValue > 0 && data.discountValue <= MAX_DISCOUNT_PERCENT),
    {
      message: `Chegirma foizi 1 va ${MAX_DISCOUNT_PERCENT} orasida boʻlishi kerak.`,
      path: ['discountValue'],
    },
  )
  .refine(
    (data) => data.discountType !== 'fixed' || data.discountValue > 0,
    { message: 'Chegirma summasi noldan katta boʻlsin.', path: ['discountValue'] },
  )
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt,
    { message: 'Tugash vaqti boshlanish vaqtidan keyin boʻlsin.', path: ['endsAt'] },
  );

export type OfferInput = z.infer<typeof offerInputSchema>;

/* -------------------------------------------------------------------------- */
/* Admin: campaigns                                                            */
/* -------------------------------------------------------------------------- */

export const campaignInputSchema = z
  .object({
    title: freeTextSchema(120, 'Sarlavha').nullable().optional(),
    subtitle: freeTextSchema(240, 'Tavsif').nullable().optional(),
    badge: freeTextSchema(40, 'Belgi').nullable().optional(),
    mediaId: z.string().nullable().optional(),
    mobileMediaId: z.string().nullable().optional(),
    ctaLabel: freeTextSchema(40, 'Tugma matni').nullable().optional(),
    ctaHref: ctaHrefSchema.nullable().optional(),
    offerId: z.string().nullable().optional(),
    roomId: z.string().nullable().optional(),
    status: z.enum(PUBLICATION_STATUSES),
    priority: z.coerce.number().int().min(0).max(1000),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    textAlign: z.enum(['left', 'center', 'right']),
    overlay: z.enum(['none', 'light', 'medium', 'strong']),
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt,
    { message: 'Tugash vaqti boshlanish vaqtidan keyin boʻlsin.', path: ['endsAt'] },
  )
  .refine((data) => Boolean(data.mediaId) || Boolean(data.title), {
    message: 'Slayd uchun rasm yoki sarlavha kerak.',
    path: ['mediaId'],
  })
  .refine((data) => !data.ctaLabel || Boolean(data.ctaHref), {
    message: 'Tugma matni kiritilgan boʻlsa, havola ham kerak.',
    path: ['ctaHref'],
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/* -------------------------------------------------------------------------- */
/* Admin: media                                                                */
/* -------------------------------------------------------------------------- */

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const;

export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm'] as const;

export const mediaMetadataSchema = z.object({
  altText: z
    .string()
    .trim()
    .min(4, { message: 'Alt matn kerak — bu skrinrider foydalanuvchilari uchun.' })
    .max(300),
  caption: freeTextSchema(300, 'Izoh').nullable().optional(),
  category: z.enum(MEDIA_CATEGORIES),
  kind: z.enum(['photograph', 'illustration']),
});

export type MediaMetadataInput = z.infer<typeof mediaMetadataSchema>;

/* -------------------------------------------------------------------------- */
/* Admin: bookings + inquiries                                                 */
/* -------------------------------------------------------------------------- */

export const bookingStatusUpdateSchema = z.object({
  bookingId: z.string().min(1),
  status: z.enum(BOOKING_STATUSES),
  reason: freeTextSchema(500, 'Sabab').optional(),
});

export const bookingNoteSchema = z.object({
  bookingId: z.string().min(1),
  internalNotes: freeTextSchema(2000, 'Ichki izoh'),
});

export const inquiryStatusUpdateSchema = z.object({
  inquiryId: z.string().min(1),
  status: z.enum(INQUIRY_STATUSES),
  internalNotes: freeTextSchema(2000, 'Ichki izoh').optional(),
});

/* -------------------------------------------------------------------------- */
/* Admin: settings + content                                                   */
/* -------------------------------------------------------------------------- */

/** Social handles are stored as full URLs; validated against known hosts. */
const socialUrlSchema = (host: string) =>
  z
    .string()
    .trim()
    .url({ message: 'Havola toʻliq URL boʻlishi kerak.' })
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname.endsWith(host);
      } catch {
        return false;
      }
    }, { message: `Havola https://${host} manziliga tegishli boʻlishi kerak.` })
    .nullable()
    .optional()
    .or(z.literal(''));

export const hotelSettingsSchema = z.object({
  brandName: z.string().trim().min(2).max(80),
  tagline: freeTextSchema(160, 'Shior'),
  phone: phoneSchema,
  email: emailSchema,
  whatsappNumber: phoneSchema.nullable().optional().or(z.literal('')),
  address: z.object({
    line1: z.string().trim().min(3).max(160),
    line2: z.string().trim().max(160).nullable().optional(),
    city: z.string().trim().min(2).max(80),
    region: z.string().trim().max(80).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    country: z.string().trim().min(2).max(80),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    mapsUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
  }),
  social: z.object({
    instagram: socialUrlSchema('instagram.com'),
    telegram: socialUrlSchema('t.me'),
    whatsapp: socialUrlSchema('wa.me'),
    facebook: socialUrlSchema('facebook.com'),
    youtube: socialUrlSchema('youtube.com'),
  }),
  currency: z.enum(CURRENCIES),
  timeZone: z.string().trim().min(3).max(64),
  locale: z.enum(LOCALES),
  taxRatePercent: z.coerce.number().min(0).max(100),
  serviceFeeMajor: z.coerce.number().min(0).max(100_000_000),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Vaqt HH:MM shaklida boʻlsin.',
  }),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Vaqt HH:MM shaklida boʻlsin.',
  }),
  seoTitle: freeTextSchema(70, 'SEO sarlavha').min(10),
  seoDescription: freeTextSchema(170, 'SEO tavsif').min(40),
  isDemoData: z.boolean(),
});

export type HotelSettingsInput = z.infer<typeof hotelSettingsSchema>;

export const siteContentSchema = z.object({
  heroHeadline: freeTextSchema(90, 'Sarlavha').min(6),
  heroSubheadline: freeTextSchema(220, 'Tavsif').min(10),
  heroMediaId: z.string().nullable().optional(),
  heroVideoUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
  aboutTitle: freeTextSchema(120, 'Sarlavha').min(4),
  aboutBody: freeTextSchema(3000, 'Matn').min(20),
  benefits: z
    .array(
      z.object({
        iconKey: z.string().trim().min(1).max(40),
        title: freeTextSchema(80, 'Sarlavha').min(2),
        description: freeTextSchema(240, 'Tavsif').min(4),
      }),
    )
    .max(8),
  footerBlurb: freeTextSchema(400, 'Matn'),
  privacyPolicy: freeTextSchema(20000, 'Maxfiylik siyosati'),
  bookingTerms: freeTextSchema(20000, 'Bron shartlari'),
});

export type SiteContentInput = z.infer<typeof siteContentSchema>;

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

export const analyticsEventSchema = z.object({
  type: z.enum([
    'home_viewed',
    'room_list_viewed',
    'room_detail_viewed',
    'booking_search_submitted',
    'booking_inquiry_started',
    'booking_inquiry_submitted',
    'contact_action_clicked',
    'campaign_impression',
    'campaign_cta_clicked',
  ]),
  roomId: z.string().max(64).nullable().optional(),
  campaignId: z.string().max(64).nullable().optional(),
  /**
   * Bounded, scalar-only metadata. Anything richer risks sweeping personal
   * data into the analytics table, which must stay non-identifying.
   */
  metadata: z
    .record(z.string().max(40), z.union([z.string().max(120), z.number(), z.boolean()]))
    .refine((value) => Object.keys(value).length <= 8, {
      message: 'Too many metadata keys',
    })
    .optional(),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
