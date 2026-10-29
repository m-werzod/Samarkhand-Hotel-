/**
 * Domain entities for the Samarkhand Hotel platform.
 *
 * These types are the contract between the data layer (Supabase or the demo
 * store), the server actions and the UI. They intentionally use plain
 * serialisable values — ISO date strings rather than `Date` — so records cross
 * the server/client boundary without transformation.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';

export const CURRENCIES = ['UZS', 'USD', 'EUR'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/**
 * An amount in a currency's *minor* units (UZS has none, so minor === so'm;
 * USD/EUR are cents). Integers only — never floats, never strings.
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/** `YYYY-MM-DD`, always interpreted in the hotel's configured time zone. */
export type CalendarDate = string;

/** Full ISO-8601 timestamp with offset. */
export type Timestamp = string;

/* -------------------------------------------------------------------------- */
/* Publication + status enums                                                  */
/* -------------------------------------------------------------------------- */

export const PUBLICATION_STATUSES = ['draft', 'published', 'archived'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const INQUIRY_STATUSES = [
  'new',
  'in_progress',
  'resolved',
  'spam',
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const USER_ROLES = ['admin', 'editor', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

export const MEDIA_CATEGORIES = [
  'exterior',
  'lobby',
  'rooms',
  'amenities',
  'dining',
  'details',
  'campaigns',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

/**
 * Whether an asset is a real photograph of the property or concept artwork.
 * The public site labels illustrations so nothing is passed off as verified.
 */
export type MediaKind = 'photograph' | 'illustration';

export interface MediaAsset {
  id: string;
  /** Public URL (`/media/...`) or a Supabase Storage object path. */
  storagePath: string;
  type: 'image' | 'video';
  kind: MediaKind;
  category: MediaCategory;
  altText: string;
  caption: string | null;
  mimeType: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Amenities + rooms                                                           */
/* -------------------------------------------------------------------------- */

export interface Amenity {
  id: string;
  /** Stable key used to resolve the Lucide icon. */
  iconKey: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  /** Maximum paying occupancy (adults + children). */
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: string;
  /** Square metres, when the hotel has supplied it. */
  sizeSqm: number | null;
  basePrice: Money;
  status: PublicationStatus;
  sortOrder: number;
  /** How many of this room type exist. Drives availability when > 0. */
  inventoryCount: number;
  cancellationPolicy: string | null;
  /**
   * True while the record still holds seeded figures the hotel has not
   * confirmed. Drives the "namuna maʼlumot" marker in the UI.
   */
  isDemoData: boolean;
  amenityIds: string[];
  mediaIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A room joined with its resolved amenities and media, ready to render. */
export interface RoomWithRelations extends Room {
  amenities: Amenity[];
  media: MediaAsset[];
}

/* -------------------------------------------------------------------------- */
/* Offers + campaigns                                                          */
/* -------------------------------------------------------------------------- */

export interface Offer {
  id: string;
  name: string;
  description: string;
  discountType: DiscountType;
  /** Percent (0–90) for `percentage`, minor units for `fixed`. */
  discountValue: number;
  /** Empty means the offer applies to every published room. */
  eligibleRoomIds: string[];
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  minimumNights: number;
  conditions: string | null;
  status: PublicationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SlideTextAlign = 'left' | 'center' | 'right';
export type SlideOverlay = 'none' | 'light' | 'medium' | 'strong';

export interface Campaign {
  id: string;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  /** Desktop/landscape creative. */
  mediaId: string | null;
  /** Portrait creative used below the `sm` breakpoint. */
  mobileMediaId: string | null;
  ctaLabel: string | null;
  /** Site-relative path only — validated to block open redirects and js:. */
  ctaHref: string | null;
  offerId: string | null;
  roomId: string | null;
  status: PublicationStatus;
  /** Higher sorts first among eligible campaigns. */
  priority: number;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  textAlign: SlideTextAlign;
  overlay: SlideOverlay;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A campaign joined with the media and offer it references. */
export interface CampaignWithRelations extends Campaign {
  media: MediaAsset | null;
  mobileMedia: MediaAsset | null;
  offer: Offer | null;
}

/* -------------------------------------------------------------------------- */
/* Bookings                                                                    */
/* -------------------------------------------------------------------------- */

export interface BookingGuest {
  fullName: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  /** Public reference shown to the guest, e.g. `SMK-7K2QD4`. */
  reference: string;
  guest: BookingGuest;
  roomId: string;
  checkIn: CalendarDate;
  checkOut: CalendarDate;
  adults: number;
  children: number;
  rooms: number;
  /**
   * Server-computed estimate at the time of submission. Not a payment and not
   * recognised revenue — see docs/ANALYTICS.md.
   */
  priceEstimate: Money;
  /** Snapshot of how the estimate was reached, for later auditing. */
  priceBreakdown: PriceBreakdown;
  status: BookingStatus;
  specialRequests: string | null;
  /** Staff-only. Never serialised to a public response. */
  internalNotes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BookingStatusChange {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  /** Admin user id, or `system` for automated transitions. */
  actor: string;
  reason: string | null;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                     */
/* -------------------------------------------------------------------------- */

export interface PriceBreakdown {
  nights: number;
  rooms: number;
  /** Per-room, per-night rate before any discount. */
  nightlyRate: Money;
  subtotal: Money;
  discount: Money;
  appliedOfferId: string | null;
  appliedOfferName: string | null;
  taxes: Money;
  fees: Money;
  total: Money;
}

/* -------------------------------------------------------------------------- */
/* Contact inquiries                                                           */
/* -------------------------------------------------------------------------- */

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: InquiryStatus;
  internalNotes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Hotel settings + site content                                               */
/* -------------------------------------------------------------------------- */

export interface SocialLinks {
  instagram: string | null;
  telegram: string | null;
  whatsapp: string | null;
  facebook: string | null;
  youtube: string | null;
}

export interface HotelAddress {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  /** Decimal degrees. Null until the hotel supplies real coordinates. */
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
}

export interface HotelSettings {
  id: string;
  brandName: string;
  tagline: string;
  /** Primary contact phone in E.164. */
  phone: string;
  email: string;
  whatsappNumber: string | null;
  address: HotelAddress;
  social: SocialLinks;
  currency: CurrencyCode;
  timeZone: string;
  locale: Locale;
  /** Percent applied to the discounted subtotal. 0 disables tax lines. */
  taxRatePercent: number;
  /** Flat per-stay fee in minor units. 0 disables the fee line. */
  serviceFeeMinor: number;
  checkInTime: string;
  checkOutTime: string;
  seoTitle: string;
  seoDescription: string;
  /**
   * True while contact details, address and prices are still seeded values.
   * The public site shows demo markers while this is set.
   */
  isDemoData: boolean;
  updatedAt: Timestamp;
}

export interface SiteContent {
  heroHeadline: string;
  heroSubheadline: string;
  heroMediaId: string | null;
  heroVideoUrl: string | null;
  aboutTitle: string;
  aboutBody: string;
  benefits: { iconKey: string; title: string; description: string }[];
  footerBlurb: string;
  privacyPolicy: string;
  bookingTerms: string;
  galleryCategories: { key: MediaCategory; label: string }[];
  updatedAt: Timestamp;
}

/**
 * Explicitly labelled sample testimonials. The platform never fabricates a
 * verified review: these carry `isSample` and the UI says so.
 */
export interface Testimonial {
  id: string;
  authorLabel: string;
  body: string;
  /** 1–5, or null when no rating was given. */
  rating: number | null;
  isSample: boolean;
  isPublished: boolean;
  sortOrder: number;
}

/* -------------------------------------------------------------------------- */
/* Analytics + audit                                                           */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_EVENTS = [
  'home_viewed',
  'room_list_viewed',
  'room_detail_viewed',
  'booking_search_submitted',
  'booking_inquiry_started',
  'booking_inquiry_submitted',
  'contact_action_clicked',
  'campaign_impression',
  'campaign_cta_clicked',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  /** Rotating anonymous id. Never a user identifier, never a cookie of record. */
  sessionId: string;
  roomId: string | null;
  campaignId: string | null;
  /** Small, non-sensitive context only (channel name, result count, …). */
  metadata: Record<string, string | number | boolean>;
  createdAt: Timestamp;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Field-level before/after, with anything sensitive already stripped. */
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: Timestamp;
}

export interface AdminProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
}
