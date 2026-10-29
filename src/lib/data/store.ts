import type {
  Amenity,
  AnalyticsEvent,
  AnalyticsEventType,
  AuditLogEntry,
  Booking,
  BookingStatus,
  BookingStatusChange,
  Campaign,
  ContactInquiry,
  HotelSettings,
  InquiryStatus,
  MediaAsset,
  MediaCategory,
  Offer,
  PublicationStatus,
  Room,
  SiteContent,
  Testimonial,
  Timestamp,
} from '@/lib/domain/types';

/**
 * The persistence contract.
 *
 * Both the Supabase adapter and the in-memory demo adapter implement this, so
 * every server action, page and test speaks to the same surface regardless of
 * what is behind it. Nothing above this layer knows which backend is live.
 *
 * All methods are async even where the demo store answers synchronously —
 * callers must not be written against one backend's timing.
 */

/* -------------------------------------------------------------------------- */
/* Query shapes                                                                */
/* -------------------------------------------------------------------------- */

export interface RoomFilter {
  /** Omit to return every status (admin); pass `['published']` for public. */
  statuses?: PublicationStatus[];
  search?: string;
}

export interface MediaFilter {
  category?: MediaCategory;
  type?: 'image' | 'video';
  search?: string;
}

export interface BookingFilter {
  statuses?: BookingStatus[];
  /** Matches reference, guest name, email or phone. */
  search?: string;
  /** Inclusive bounds on `createdAt`. */
  createdFrom?: Timestamp;
  createdTo?: Timestamp;
  /** Bounds on the stay itself. */
  checkInFrom?: string;
  checkInTo?: string;
  roomId?: string;
  limit?: number;
  offset?: number;
}

export interface InquiryFilter {
  statuses?: InquiryStatus[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface AnalyticsRange {
  /** Inclusive ISO timestamp. */
  from: Timestamp;
  /** Exclusive ISO timestamp. */
  to: Timestamp;
}

/** Raw counts the dashboard turns into metrics. Never pre-computed rates. */
export interface AnalyticsTotals {
  eventCounts: Record<AnalyticsEventType, number>;
  /** Distinct anonymous sessions that fired at least one event in range. */
  distinctSessions: number;
  /** Impressions and CTA clicks keyed by campaign id. */
  campaignImpressions: Record<string, number>;
  campaignClicks: Record<string, number>;
  /** Room detail views keyed by room id. */
  roomViews: Record<string, number>;
}

export interface BookingTotals {
  byStatus: Record<BookingStatus, number>;
  /** Inquiry counts bucketed by calendar date (hotel time zone). */
  byDate: { date: string; count: number }[];
  /** Counts per room id, across every status. */
  byRoom: Record<string, number>;
  /**
   * Sum of `priceEstimate` for confirmed + completed bookings only, in minor
   * units. This is an *estimate pipeline value*, not recognised revenue —
   * the platform captures no payments. See docs/ANALYTICS.md.
   */
  confirmedEstimateMinor: number;
  confirmedCount: number;
}

export interface CreateBookingInput {
  booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface AuditInput {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

/* -------------------------------------------------------------------------- */
/* The interface                                                               */
/* -------------------------------------------------------------------------- */

export interface DataStore {
  readonly mode: 'supabase' | 'demo';

  /* --- Settings + content --------------------------------------------- */
  getHotelSettings(): Promise<HotelSettings>;
  updateHotelSettings(patch: Partial<HotelSettings>): Promise<HotelSettings>;
  getSiteContent(): Promise<SiteContent>;
  updateSiteContent(patch: Partial<SiteContent>): Promise<SiteContent>;

  /* --- Amenities ------------------------------------------------------- */
  listAmenities(activeOnly?: boolean): Promise<Amenity[]>;
  upsertAmenity(amenity: Amenity): Promise<Amenity>;
  deleteAmenity(id: string): Promise<void>;

  /* --- Rooms ----------------------------------------------------------- */
  listRooms(filter?: RoomFilter): Promise<Room[]>;
  getRoomById(id: string): Promise<Room | null>;
  getRoomBySlug(slug: string): Promise<Room | null>;
  createRoom(room: Omit<Room, 'createdAt' | 'updatedAt'>): Promise<Room>;
  updateRoom(id: string, patch: Partial<Room>): Promise<Room>;
  deleteRoom(id: string): Promise<void>;

  /* --- Media ----------------------------------------------------------- */
  listMedia(filter?: MediaFilter): Promise<MediaAsset[]>;
  getMediaById(id: string): Promise<MediaAsset | null>;
  createMedia(asset: Omit<MediaAsset, 'createdAt'>): Promise<MediaAsset>;
  updateMedia(id: string, patch: Partial<MediaAsset>): Promise<MediaAsset>;
  deleteMedia(id: string): Promise<void>;
  /**
   * Which published records still point at this asset. The admin refuses to
   * delete media that is in use rather than leaving broken images behind.
   */
  findMediaReferences(id: string): Promise<{ type: string; id: string; label: string }[]>;

  /* --- Offers ---------------------------------------------------------- */
  listOffers(statuses?: PublicationStatus[]): Promise<Offer[]>;
  getOfferById(id: string): Promise<Offer | null>;
  createOffer(offer: Omit<Offer, 'createdAt' | 'updatedAt'>): Promise<Offer>;
  updateOffer(id: string, patch: Partial<Offer>): Promise<Offer>;
  deleteOffer(id: string): Promise<void>;

  /* --- Campaigns ------------------------------------------------------- */
  listCampaigns(statuses?: PublicationStatus[]): Promise<Campaign[]>;
  getCampaignById(id: string): Promise<Campaign | null>;
  createCampaign(c: Omit<Campaign, 'createdAt' | 'updatedAt'>): Promise<Campaign>;
  updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;
  /** Applies a new priority ordering in one pass, highest priority first. */
  reorderCampaigns(orderedIds: string[]): Promise<void>;

  /* --- Bookings -------------------------------------------------------- */
  listBookings(filter?: BookingFilter): Promise<Paginated<Booking>>;
  getBookingById(id: string): Promise<Booking | null>;
  getBookingByReference(reference: string): Promise<Booking | null>;
  createBooking(input: CreateBookingInput): Promise<Booking>;
  /**
   * Transition a booking and append to its history atomically. Implementations
   * must reject the change if `expectedStatus` no longer matches, so two
   * admins acting at once cannot both "win".
   */
  transitionBooking(args: {
    id: string;
    expectedStatus: BookingStatus;
    nextStatus: BookingStatus;
    actor: string;
    reason?: string | null;
  }): Promise<Booking>;
  updateBookingNotes(id: string, notes: string): Promise<Booking>;
  listBookingHistory(bookingId: string): Promise<BookingStatusChange[]>;
  /** Blocking bookings that overlap a stay, for availability checks. */
  findOverlappingBookings(args: {
    roomId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<Booking[]>;

  /* --- Contact inquiries ----------------------------------------------- */
  listInquiries(filter?: InquiryFilter): Promise<Paginated<ContactInquiry>>;
  getInquiryById(id: string): Promise<ContactInquiry | null>;
  createInquiry(
    inquiry: Omit<ContactInquiry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContactInquiry>;
  updateInquiry(id: string, patch: Partial<ContactInquiry>): Promise<ContactInquiry>;

  /* --- Testimonials ---------------------------------------------------- */
  listTestimonials(publishedOnly?: boolean): Promise<Testimonial[]>;

  /* --- Analytics ------------------------------------------------------- */
  recordAnalyticsEvent(
    event: Omit<AnalyticsEvent, 'id' | 'createdAt'>,
  ): Promise<void>;
  getAnalyticsTotals(range: AnalyticsRange): Promise<AnalyticsTotals>;
  getBookingTotals(range: AnalyticsRange, timeZone: string): Promise<BookingTotals>;

  /* --- Audit ----------------------------------------------------------- */
  recordAudit(entry: AuditInput): Promise<void>;
  listAuditLogs(limit?: number): Promise<AuditLogEntry[]>;
}

/** Thrown when a record the caller expected to exist does not. */
export class NotFoundError extends Error {
  override name = 'NotFoundError';
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
  }
}

/** Thrown when a write would violate a uniqueness or referential constraint. */
export class ConflictError extends Error {
  override name = 'ConflictError';
}
