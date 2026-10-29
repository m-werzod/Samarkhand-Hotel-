import 'server-only';

import { randomId } from '@/lib/utils';
import { isBlocking } from '@/lib/domain/booking';
import { staysOverlap } from '@/lib/domain/dates';
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
  MediaAsset,
  Offer,
  PublicationStatus,
  Room,
  SiteContent,
  Testimonial,
} from '@/lib/domain/types';
import { ANALYTICS_EVENTS, BOOKING_STATUSES } from '@/lib/domain/types';
import {
  seedAmenities,
  seedCampaigns,
  seedHotelSettings,
  seedMedia,
  seedOffers,
  seedRooms,
  seedSiteContent,
  seedTestimonials,
} from './seed';
import {
  ConflictError,
  NotFoundError,
  type AnalyticsRange,
  type AnalyticsTotals,
  type AuditInput,
  type BookingFilter,
  type BookingTotals,
  type CreateBookingInput,
  type DataStore,
  type InquiryFilter,
  type MediaFilter,
  type Paginated,
  type RoomFilter,
} from './store';

/**
 * In-memory data store used when no database is configured.
 *
 * This is a real implementation of the full contract, not a stub: every
 * query, filter, transition and analytics rollup behaves the way the Supabase
 * adapter does. What it does *not* do is persist. State lives in the Node
 * process, so it resets on restart and is not shared between serverless
 * instances.
 *
 * That limitation is surfaced to the operator in the admin dashboard rather
 * than hidden. It is why `docs/DEPLOYMENT.md` treats configuring Supabase as
 * a launch requirement rather than an optional upgrade.
 */

interface DemoState {
  settings: HotelSettings;
  content: SiteContent;
  amenities: Amenity[];
  rooms: Room[];
  media: MediaAsset[];
  offers: Offer[];
  campaigns: Campaign[];
  bookings: Booking[];
  bookingHistory: BookingStatusChange[];
  inquiries: ContactInquiry[];
  testimonials: Testimonial[];
  analytics: AnalyticsEvent[];
  audit: AuditLogEntry[];
}

function freshState(): DemoState {
  // Deep clone so a mutation can never write back into the seed module.
  return structuredClone({
    settings: seedHotelSettings,
    content: seedSiteContent,
    amenities: seedAmenities,
    rooms: seedRooms,
    media: seedMedia,
    offers: seedOffers,
    campaigns: seedCampaigns,
    bookings: [] as Booking[],
    bookingHistory: [] as BookingStatusChange[],
    inquiries: [] as ContactInquiry[],
    testimonials: seedTestimonials,
    analytics: [] as AnalyticsEvent[],
    audit: [] as AuditLogEntry[],
  });
}

/**
 * Survive Next.js dev-server hot reloads, which re-evaluate modules and would
 * otherwise wipe an operator's test edits on every file save.
 */
const globalForDemo = globalThis as unknown as { __samarkhandDemoState?: DemoState };

function state(): DemoState {
  globalForDemo.__samarkhandDemoState ??= freshState();
  return globalForDemo.__samarkhandDemoState;
}

/** Test-only: restore the seed. */
export function resetDemoStore(): void {
  globalForDemo.__samarkhandDemoState = freshState();
}

const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */

export class DemoStore implements DataStore {
  readonly mode = 'demo' as const;

  /* --- Settings + content --------------------------------------------- */

  async getHotelSettings(): Promise<HotelSettings> {
    return clone(state().settings);
  }

  async updateHotelSettings(patch: Partial<HotelSettings>): Promise<HotelSettings> {
    const s = state();
    s.settings = { ...s.settings, ...clone(patch), updatedAt: nowIso() };
    return clone(s.settings);
  }

  async getSiteContent(): Promise<SiteContent> {
    return clone(state().content);
  }

  async updateSiteContent(patch: Partial<SiteContent>): Promise<SiteContent> {
    const s = state();
    s.content = { ...s.content, ...clone(patch), updatedAt: nowIso() };
    return clone(s.content);
  }

  /* --- Amenities ------------------------------------------------------- */

  async listAmenities(activeOnly = false): Promise<Amenity[]> {
    return clone(
      state()
        .amenities.filter((a) => !activeOnly || a.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  async upsertAmenity(amenity: Amenity): Promise<Amenity> {
    const s = state();
    const index = s.amenities.findIndex((a) => a.id === amenity.id);
    if (index >= 0) s.amenities[index] = clone(amenity);
    else s.amenities.push(clone(amenity));
    return clone(amenity);
  }

  async deleteAmenity(id: string): Promise<void> {
    const s = state();
    s.amenities = s.amenities.filter((a) => a.id !== id);
    // Detach from rooms so no room points at a vanished amenity.
    for (const room of s.rooms) {
      room.amenityIds = room.amenityIds.filter((a) => a !== id);
    }
  }

  /* --- Rooms ----------------------------------------------------------- */

  async listRooms(filter: RoomFilter = {}): Promise<Room[]> {
    const search = filter.search ? normalise(filter.search) : null;
    return clone(
      state()
        .rooms.filter((room) => {
          if (filter.statuses && !filter.statuses.includes(room.status)) return false;
          if (
            search &&
            !normalise(room.name).includes(search) &&
            !normalise(room.slug).includes(search)
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    );
  }

  async getRoomById(id: string): Promise<Room | null> {
    const room = state().rooms.find((r) => r.id === id);
    return room ? clone(room) : null;
  }

  async getRoomBySlug(slug: string): Promise<Room | null> {
    const room = state().rooms.find((r) => r.slug === slug);
    return room ? clone(room) : null;
  }

  async createRoom(room: Omit<Room, 'createdAt' | 'updatedAt'>): Promise<Room> {
    const s = state();
    if (s.rooms.some((r) => r.slug === room.slug)) {
      throw new ConflictError(`A room with the slug "${room.slug}" already exists`);
    }
    const created: Room = { ...clone(room), createdAt: nowIso(), updatedAt: nowIso() };
    s.rooms.push(created);
    return clone(created);
  }

  async updateRoom(id: string, patch: Partial<Room>): Promise<Room> {
    const s = state();
    const index = s.rooms.findIndex((r) => r.id === id);
    if (index < 0) throw new NotFoundError('Room', id);
    if (patch.slug && s.rooms.some((r) => r.slug === patch.slug && r.id !== id)) {
      throw new ConflictError(`A room with the slug "${patch.slug}" already exists`);
    }
    const next: Room = {
      ...s.rooms[index]!,
      ...clone(patch),
      id,
      updatedAt: nowIso(),
    };
    s.rooms[index] = next;
    return clone(next);
  }

  async deleteRoom(id: string): Promise<void> {
    const s = state();
    if (s.bookings.some((b) => b.roomId === id && isBlocking(b.status))) {
      throw new ConflictError(
        'This room has active bookings. Archive it instead of deleting.',
      );
    }
    s.rooms = s.rooms.filter((r) => r.id !== id);
    for (const campaign of s.campaigns) {
      if (campaign.roomId === id) campaign.roomId = null;
    }
  }

  /* --- Media ----------------------------------------------------------- */

  async listMedia(filter: MediaFilter = {}): Promise<MediaAsset[]> {
    const search = filter.search ? normalise(filter.search) : null;
    return clone(
      state()
        .media.filter((asset) => {
          if (filter.category && asset.category !== filter.category) return false;
          if (filter.type && asset.type !== filter.type) return false;
          if (
            search &&
            !normalise(asset.altText).includes(search) &&
            !normalise(asset.storagePath).includes(search)
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async getMediaById(id: string): Promise<MediaAsset | null> {
    const asset = state().media.find((m) => m.id === id);
    return asset ? clone(asset) : null;
  }

  async createMedia(asset: Omit<MediaAsset, 'createdAt'>): Promise<MediaAsset> {
    const s = state();
    const created: MediaAsset = { ...clone(asset), createdAt: nowIso() };
    s.media.push(created);
    return clone(created);
  }

  async updateMedia(id: string, patch: Partial<MediaAsset>): Promise<MediaAsset> {
    const s = state();
    const index = s.media.findIndex((m) => m.id === id);
    if (index < 0) throw new NotFoundError('MediaAsset', id);
    const next: MediaAsset = { ...s.media[index]!, ...clone(patch), id };
    s.media[index] = next;
    return clone(next);
  }

  async deleteMedia(id: string): Promise<void> {
    const s = state();
    const references = await this.findMediaReferences(id);
    if (references.length > 0) {
      throw new ConflictError(
        `This asset is used by ${references.length} published record(s).`,
      );
    }
    s.media = s.media.filter((m) => m.id !== id);
  }

  async findMediaReferences(
    id: string,
  ): Promise<{ type: string; id: string; label: string }[]> {
    const s = state();
    const refs: { type: string; id: string; label: string }[] = [];

    for (const room of s.rooms) {
      if (room.mediaIds.includes(id)) {
        refs.push({ type: 'room', id: room.id, label: room.name });
      }
    }
    for (const campaign of s.campaigns) {
      if (campaign.mediaId === id || campaign.mobileMediaId === id) {
        refs.push({
          type: 'campaign',
          id: campaign.id,
          label: campaign.title ?? campaign.id,
        });
      }
    }
    if (s.content.heroMediaId === id) {
      refs.push({ type: 'content', id: 'hero', label: 'Bosh sahifa hero' });
    }
    return refs;
  }

  /* --- Offers ---------------------------------------------------------- */

  async listOffers(statuses?: PublicationStatus[]): Promise<Offer[]> {
    return clone(
      state()
        .offers.filter((o) => !statuses || statuses.includes(o.status))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async getOfferById(id: string): Promise<Offer | null> {
    const offer = state().offers.find((o) => o.id === id);
    return offer ? clone(offer) : null;
  }

  async createOffer(offer: Omit<Offer, 'createdAt' | 'updatedAt'>): Promise<Offer> {
    const s = state();
    const created: Offer = {
      ...clone(offer),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    s.offers.push(created);
    return clone(created);
  }

  async updateOffer(id: string, patch: Partial<Offer>): Promise<Offer> {
    const s = state();
    const index = s.offers.findIndex((o) => o.id === id);
    if (index < 0) throw new NotFoundError('Offer', id);
    const next: Offer = {
      ...s.offers[index]!,
      ...clone(patch),
      id,
      updatedAt: nowIso(),
    };
    s.offers[index] = next;
    return clone(next);
  }

  async deleteOffer(id: string): Promise<void> {
    const s = state();
    s.offers = s.offers.filter((o) => o.id !== id);
    for (const campaign of s.campaigns) {
      if (campaign.offerId === id) campaign.offerId = null;
    }
  }

  /* --- Campaigns ------------------------------------------------------- */

  async listCampaigns(statuses?: PublicationStatus[]): Promise<Campaign[]> {
    return clone(
      state()
        .campaigns.filter((c) => !statuses || statuses.includes(c.status))
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
    );
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const campaign = state().campaigns.find((c) => c.id === id);
    return campaign ? clone(campaign) : null;
  }

  async createCampaign(
    campaign: Omit<Campaign, 'createdAt' | 'updatedAt'>,
  ): Promise<Campaign> {
    const s = state();
    const created: Campaign = {
      ...clone(campaign),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    s.campaigns.push(created);
    return clone(created);
  }

  async updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
    const s = state();
    const index = s.campaigns.findIndex((c) => c.id === id);
    if (index < 0) throw new NotFoundError('Campaign', id);
    const next: Campaign = {
      ...s.campaigns[index]!,
      ...clone(patch),
      id,
      updatedAt: nowIso(),
    };
    s.campaigns[index] = next;
    return clone(next);
  }

  async deleteCampaign(id: string): Promise<void> {
    const s = state();
    s.campaigns = s.campaigns.filter((c) => c.id !== id);
  }

  async reorderCampaigns(orderedIds: string[]): Promise<void> {
    const s = state();
    // Highest priority first, spaced by 10 so a later insert has room.
    orderedIds.forEach((id, index) => {
      const campaign = s.campaigns.find((c) => c.id === id);
      if (campaign) {
        campaign.priority = (orderedIds.length - index) * 10;
        campaign.updatedAt = nowIso();
      }
    });
  }

  /* --- Bookings -------------------------------------------------------- */

  async listBookings(filter: BookingFilter = {}): Promise<Paginated<Booking>> {
    const search = filter.search ? normalise(filter.search) : null;

    const matched = state()
      .bookings.filter((booking) => {
        if (filter.statuses && !filter.statuses.includes(booking.status)) return false;
        if (filter.roomId && booking.roomId !== filter.roomId) return false;
        if (filter.createdFrom && booking.createdAt < filter.createdFrom) return false;
        if (filter.createdTo && booking.createdAt > filter.createdTo) return false;
        if (filter.checkInFrom && booking.checkIn < filter.checkInFrom) return false;
        if (filter.checkInTo && booking.checkIn > filter.checkInTo) return false;
        if (search) {
          const haystack = [
            booking.reference,
            booking.guest.fullName,
            booking.guest.email,
            booking.guest.phone,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return {
      items: clone(matched.slice(offset, offset + limit)),
      total: matched.length,
    };
  }

  async getBookingById(id: string): Promise<Booking | null> {
    const booking = state().bookings.find((b) => b.id === id);
    return booking ? clone(booking) : null;
  }

  async getBookingByReference(reference: string): Promise<Booking | null> {
    const target = reference.trim().toUpperCase();
    const booking = state().bookings.find((b) => b.reference === target);
    return booking ? clone(booking) : null;
  }

  async createBooking({ booking }: CreateBookingInput): Promise<Booking> {
    const s = state();
    if (s.bookings.some((b) => b.reference === booking.reference)) {
      throw new ConflictError('Booking reference collision');
    }
    const created: Booking = {
      ...clone(booking),
      id: `booking-${randomId(12).toLowerCase()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    s.bookings.push(created);
    s.bookingHistory.push({
      id: `history-${randomId(10).toLowerCase()}`,
      bookingId: created.id,
      fromStatus: null,
      toStatus: created.status,
      actor: 'guest',
      reason: null,
      createdAt: created.createdAt,
    });
    return clone(created);
  }

  async transitionBooking(args: {
    id: string;
    expectedStatus: BookingStatus;
    nextStatus: BookingStatus;
    actor: string;
    reason?: string | null;
  }): Promise<Booking> {
    const s = state();
    const index = s.bookings.findIndex((b) => b.id === args.id);
    if (index < 0) throw new NotFoundError('Booking', args.id);

    const current = s.bookings[index]!;
    // Optimistic concurrency: if someone else moved it first, refuse.
    if (current.status !== args.expectedStatus) {
      throw new ConflictError(
        `Booking is now "${current.status}", not "${args.expectedStatus}". Reload and try again.`,
      );
    }

    const next: Booking = {
      ...current,
      status: args.nextStatus,
      updatedAt: nowIso(),
    };
    s.bookings[index] = next;
    s.bookingHistory.push({
      id: `history-${randomId(10).toLowerCase()}`,
      bookingId: args.id,
      fromStatus: args.expectedStatus,
      toStatus: args.nextStatus,
      actor: args.actor,
      reason: args.reason ?? null,
      createdAt: next.updatedAt,
    });
    return clone(next);
  }

  async updateBookingNotes(id: string, notes: string): Promise<Booking> {
    const s = state();
    const index = s.bookings.findIndex((b) => b.id === id);
    if (index < 0) throw new NotFoundError('Booking', id);
    const next: Booking = {
      ...s.bookings[index]!,
      internalNotes: notes,
      updatedAt: nowIso(),
    };
    s.bookings[index] = next;
    return clone(next);
  }

  async listBookingHistory(bookingId: string): Promise<BookingStatusChange[]> {
    return clone(
      state()
        .bookingHistory.filter((h) => h.bookingId === bookingId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  }

  async findOverlappingBookings(args: {
    roomId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<Booking[]> {
    return clone(
      state().bookings.filter(
        (b) =>
          b.roomId === args.roomId &&
          isBlocking(b.status) &&
          staysOverlap(args.checkIn, args.checkOut, b.checkIn, b.checkOut),
      ),
    );
  }

  /* --- Contact inquiries ----------------------------------------------- */

  async listInquiries(filter: InquiryFilter = {}): Promise<Paginated<ContactInquiry>> {
    const search = filter.search ? normalise(filter.search) : null;
    const matched = state()
      .inquiries.filter((inquiry) => {
        if (filter.statuses && !filter.statuses.includes(inquiry.status)) return false;
        if (search) {
          const haystack = [inquiry.name, inquiry.email, inquiry.subject]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return {
      items: clone(matched.slice(offset, offset + limit)),
      total: matched.length,
    };
  }

  async getInquiryById(id: string): Promise<ContactInquiry | null> {
    const inquiry = state().inquiries.find((i) => i.id === id);
    return inquiry ? clone(inquiry) : null;
  }

  async createInquiry(
    inquiry: Omit<ContactInquiry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContactInquiry> {
    const s = state();
    const created: ContactInquiry = {
      ...clone(inquiry),
      id: `inquiry-${randomId(12).toLowerCase()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    s.inquiries.push(created);
    return clone(created);
  }

  async updateInquiry(
    id: string,
    patch: Partial<ContactInquiry>,
  ): Promise<ContactInquiry> {
    const s = state();
    const index = s.inquiries.findIndex((i) => i.id === id);
    if (index < 0) throw new NotFoundError('ContactInquiry', id);
    const next: ContactInquiry = {
      ...s.inquiries[index]!,
      ...clone(patch),
      id,
      updatedAt: nowIso(),
    };
    s.inquiries[index] = next;
    return clone(next);
  }

  /* --- Testimonials ---------------------------------------------------- */

  async listTestimonials(publishedOnly = true): Promise<Testimonial[]> {
    return clone(
      state()
        .testimonials.filter((t) => !publishedOnly || t.isPublished)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  /* --- Analytics ------------------------------------------------------- */

  async recordAnalyticsEvent(
    event: Omit<AnalyticsEvent, 'id' | 'createdAt'>,
  ): Promise<void> {
    const s = state();
    s.analytics.push({
      ...clone(event),
      id: `event-${randomId(12).toLowerCase()}`,
      createdAt: nowIso(),
    });
    // Bound memory growth in a long-running dev session.
    if (s.analytics.length > 20_000) {
      s.analytics = s.analytics.slice(-10_000);
    }
  }

  async getAnalyticsTotals(range: AnalyticsRange): Promise<AnalyticsTotals> {
    const inRange = state().analytics.filter(
      (e) => e.createdAt >= range.from && e.createdAt < range.to,
    );

    const eventCounts = Object.fromEntries(
      ANALYTICS_EVENTS.map((type) => [type, 0]),
    ) as Record<AnalyticsEventType, number>;
    const campaignImpressions: Record<string, number> = {};
    const campaignClicks: Record<string, number> = {};
    const roomViews: Record<string, number> = {};
    const sessions = new Set<string>();

    for (const event of inRange) {
      eventCounts[event.type] += 1;
      sessions.add(event.sessionId);

      if (event.campaignId) {
        if (event.type === 'campaign_impression') {
          campaignImpressions[event.campaignId] =
            (campaignImpressions[event.campaignId] ?? 0) + 1;
        } else if (event.type === 'campaign_cta_clicked') {
          campaignClicks[event.campaignId] =
            (campaignClicks[event.campaignId] ?? 0) + 1;
        }
      }
      if (event.roomId && event.type === 'room_detail_viewed') {
        roomViews[event.roomId] = (roomViews[event.roomId] ?? 0) + 1;
      }
    }

    return {
      eventCounts,
      distinctSessions: sessions.size,
      campaignImpressions,
      campaignClicks,
      roomViews,
    };
  }

  async getBookingTotals(
    range: AnalyticsRange,
    timeZone: string,
  ): Promise<BookingTotals> {
    const inRange = state().bookings.filter(
      (b) => b.createdAt >= range.from && b.createdAt < range.to,
    );

    const byStatus = Object.fromEntries(
      BOOKING_STATUSES.map((s) => [s, 0]),
    ) as Record<BookingStatus, number>;
    const byRoom: Record<string, number> = {};
    const dateCounts = new Map<string, number>();
    let confirmedEstimateMinor = 0;
    let confirmedCount = 0;

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    for (const booking of inRange) {
      byStatus[booking.status] += 1;
      byRoom[booking.roomId] = (byRoom[booking.roomId] ?? 0) + 1;

      const day = dateFormatter.format(new Date(booking.createdAt));
      dateCounts.set(day, (dateCounts.get(day) ?? 0) + 1);

      if (booking.status === 'confirmed' || booking.status === 'completed') {
        confirmedEstimateMinor += booking.priceEstimate.amount;
        confirmedCount += 1;
      }
    }

    return {
      byStatus,
      byDate: [...dateCounts.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byRoom,
      confirmedEstimateMinor,
      confirmedCount,
    };
  }

  /* --- Audit ----------------------------------------------------------- */

  async recordAudit(entry: AuditInput): Promise<void> {
    const s = state();
    s.audit.unshift({
      id: `audit-${randomId(12).toLowerCase()}`,
      actor: entry.actor,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes ?? null,
      createdAt: nowIso(),
    });
    if (s.audit.length > 2000) s.audit.length = 2000;
  }

  async listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
    return clone(state().audit.slice(0, limit));
  }
}
