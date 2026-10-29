import 'server-only';

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { getServerClient, storagePublicUrl } from '@/lib/supabase/clients';
import { ANALYTICS_EVENTS, BOOKING_STATUSES } from '@/lib/domain/types';
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
  CurrencyCode,
  HotelSettings,
  MediaAsset,
  MediaCategory,
  Offer,
  PriceBreakdown,
  PublicationStatus,
  Room,
  SiteContent,
  Testimonial,
} from '@/lib/domain/types';
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
 * Supabase-backed implementation of the data contract.
 *
 * Reads go through the request-scoped client so Row Level Security applies —
 * a public page physically cannot read a draft room or another guest's
 * booking, regardless of what this code asks for.
 *
 * Booking creation and status transitions call the SQL functions from
 * migration 0003 rather than writing the tables directly, because both need
 * row locking to be correct under concurrency.
 */

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

interface RoomRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  max_occupancy: number;
  max_adults: number;
  max_children: number;
  bed_configuration: string;
  size_sqm: number | null;
  base_price_minor: number;
  currency: string;
  status: PublicationStatus;
  sort_order: number;
  inventory_count: number;
  cancellation_policy: string | null;
  is_demo_data: boolean;
  created_at: string;
  updated_at: string;
  room_amenities?: { amenity_id: string }[] | null;
  room_media?: { media_id: string; sort_order: number }[] | null;
}

interface BookingRow {
  id: string;
  reference: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  room_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms_count: number;
  price_estimate_minor: number;
  currency: string;
  price_breakdown: PriceBreakdown;
  status: BookingStatus;
  special_requests: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Error translation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Turn a Postgrest error into a domain error.
 *
 * The raw message can name columns, constraints and sometimes values, so it
 * is logged but never handed to a caller that might surface it to a guest.
 */
function translate(error: PostgrestError, entity: string): Error {
  // 23505 unique_violation, 23503 foreign_key_violation, 23514 check_violation
  if (['23505', '23503', '23514'].includes(error.code)) {
    return new ConflictError(`${entity}: the change conflicts with existing data.`);
  }
  if (error.message.includes('status_conflict')) {
    return new ConflictError(
      'This booking was changed by someone else. Reload and try again.',
    );
  }
  if (error.message.includes('room_unavailable')) {
    return new ConflictError('room_unavailable');
  }
  if (error.message.includes('room_not_bookable')) {
    return new ConflictError('room_not_bookable');
  }
  console.error(`[supabase-store] ${entity}:`, error.code, error.message);
  return new Error(`Could not complete the ${entity} operation.`);
}

function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  entity: string,
): T {
  if (result.error) throw translate(result.error, entity);
  if (result.data === null) throw new NotFoundError(entity, 'unknown');
  return result.data;
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

function toRoom(row: RoomRow): Room {
  const media = [...(row.room_media ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    maxOccupancy: row.max_occupancy,
    maxAdults: row.max_adults,
    maxChildren: row.max_children,
    bedConfiguration: row.bed_configuration,
    sizeSqm: row.size_sqm,
    basePrice: {
      amount: Number(row.base_price_minor),
      currency: row.currency as CurrencyCode,
    },
    status: row.status,
    sortOrder: row.sort_order,
    inventoryCount: row.inventory_count,
    cancellationPolicy: row.cancellation_policy,
    isDemoData: row.is_demo_data,
    amenityIds: (row.room_amenities ?? []).map((a) => a.amenity_id),
    mediaIds: media.map((m) => m.media_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    reference: row.reference,
    guest: {
      fullName: row.guest_name,
      email: row.guest_email,
      phone: row.guest_phone,
    },
    roomId: row.room_id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    adults: row.adults,
    children: row.children,
    rooms: row.rooms_count,
    priceEstimate: {
      amount: Number(row.price_estimate_minor),
      currency: row.currency as CurrencyCode,
    },
    priceBreakdown: row.price_breakdown,
    status: row.status,
    specialRequests: row.special_requests,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Postgrest returns
   loosely typed rows; each mapper below narrows one shape and is the only
   place `any` is permitted in this module. */
type Row = Record<string, any>;

function toMedia(row: Row): MediaAsset {
  return {
    id: row.id,
    storagePath: storagePublicUrl(row.storage_path),
    type: row.type,
    kind: row.kind,
    category: row.category as MediaCategory,
    altText: row.alt_text,
    caption: row.caption,
    mimeType: row.mime_type,
    bytes: row.bytes === null ? null : Number(row.bytes),
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

function toAmenity(row: Row): Amenity {
  return {
    id: row.id,
    iconKey: row.icon_key,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function toOffer(row: Row): Offer {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    eligibleRoomIds: (row.offer_rooms ?? []).map((r: Row) => r.room_id as string),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    minimumNights: row.minimum_nights,
    conditions: row.conditions,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCampaign(row: Row): Campaign {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    badge: row.badge,
    mediaId: row.media_id,
    mobileMediaId: row.mobile_media_id,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    offerId: row.offer_id,
    roomId: row.room_id,
    status: row.status,
    priority: row.priority,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    textAlign: row.text_align,
    overlay: row.overlay,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInquiry(row: Row): ContactInquiry {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    status: row.status,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSettings(row: Row): HotelSettings {
  return {
    id: row.id,
    brandName: row.brand_name,
    tagline: row.tagline,
    phone: row.phone,
    email: row.email,
    whatsappNumber: row.whatsapp_number,
    address: row.address,
    social: row.social,
    currency: row.currency as CurrencyCode,
    timeZone: row.time_zone,
    locale: row.locale,
    taxRatePercent: Number(row.tax_rate_percent),
    serviceFeeMinor: Number(row.service_fee_minor),
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    isDemoData: row.is_demo_data,
    updatedAt: row.updated_at,
  };
}

function toContent(row: Row): SiteContent {
  return {
    heroHeadline: row.hero_headline,
    heroSubheadline: row.hero_subheadline,
    heroMediaId: row.hero_media_id,
    heroVideoUrl: row.hero_video_url,
    aboutTitle: row.about_title,
    aboutBody: row.about_body,
    benefits: row.benefits ?? [],
    footerBlurb: row.footer_blurb,
    privacyPolicy: row.privacy_policy,
    bookingTerms: row.booking_terms,
    galleryCategories: row.gallery_categories ?? [],
    updatedAt: row.updated_at,
  };
}

/** camelCase patch -> snake_case row, dropping undefined keys. */
function snakeCase(patch: object): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value;
  }
  return out;
}

const ROOM_SELECT =
  '*, room_amenities(amenity_id), room_media(media_id, sort_order)';
const OFFER_SELECT = '*, offer_rooms(room_id)';

/* -------------------------------------------------------------------------- */

export class SupabaseStore implements DataStore {
  readonly mode = 'supabase' as const;

  private async db(): Promise<SupabaseClient> {
    return getServerClient();
  }

  /* --- Settings + content --------------------------------------------- */

  async getHotelSettings(): Promise<HotelSettings> {
    const db = await this.db();
    const result = await db
      .from('hotel_settings')
      .select('*')
      .eq('id', 'settings')
      .single();
    return toSettings(unwrap(result, 'hotel settings'));
  }

  async updateHotelSettings(patch: Partial<HotelSettings>): Promise<HotelSettings> {
    const db = await this.db();
    const result = await db
      .from('hotel_settings')
      .update(snakeCase(patch))
      .eq('id', 'settings')
      .select('*')
      .single();
    return toSettings(unwrap(result, 'hotel settings'));
  }

  async getSiteContent(): Promise<SiteContent> {
    const db = await this.db();
    const result = await db
      .from('site_content')
      .select('*')
      .eq('id', 'content')
      .single();
    return toContent(unwrap(result, 'site content'));
  }

  async updateSiteContent(patch: Partial<SiteContent>): Promise<SiteContent> {
    const db = await this.db();
    const result = await db
      .from('site_content')
      .update(snakeCase(patch))
      .eq('id', 'content')
      .select('*')
      .single();
    return toContent(unwrap(result, 'site content'));
  }

  /* --- Amenities ------------------------------------------------------- */

  async listAmenities(activeOnly = false): Promise<Amenity[]> {
    const db = await this.db();
    let query = db.from('amenities').select('*').order('sort_order');
    if (activeOnly) query = query.eq('is_active', true);
    const result = await query;
    return unwrap(result, 'amenities').map(toAmenity);
  }

  async upsertAmenity(amenity: Amenity): Promise<Amenity> {
    const db = await this.db();
    const result = await db
      .from('amenities')
      .upsert(snakeCase(amenity))
      .select('*')
      .single();
    return toAmenity(unwrap(result, 'amenity'));
  }

  async deleteAmenity(id: string): Promise<void> {
    const db = await this.db();
    const { error } = await db.from('amenities').delete().eq('id', id);
    if (error) throw translate(error, 'amenity');
  }

  /* --- Rooms ----------------------------------------------------------- */

  async listRooms(filter: RoomFilter = {}): Promise<Room[]> {
    const db = await this.db();
    let query = db.from('rooms').select(ROOM_SELECT).order('sort_order');
    if (filter.statuses?.length) query = query.in('status', filter.statuses);
    if (filter.search) query = query.ilike('name', `%${filter.search}%`);
    const result = await query;
    return (unwrap(result, 'rooms') as RoomRow[]).map(toRoom);
  }

  async getRoomById(id: string): Promise<Room | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('rooms')
      .select(ROOM_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw translate(error, 'room');
    return data ? toRoom(data as RoomRow) : null;
  }

  async getRoomBySlug(slug: string): Promise<Room | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('rooms')
      .select(ROOM_SELECT)
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw translate(error, 'room');
    return data ? toRoom(data as RoomRow) : null;
  }

  async createRoom(room: Omit<Room, 'createdAt' | 'updatedAt'>): Promise<Room> {
    const db = await this.db();
    const { amenityIds, mediaIds, basePrice, ...rest } = room;
    const result = await db
      .from('rooms')
      .insert({
        ...snakeCase(rest),
        base_price_minor: basePrice.amount,
        currency: basePrice.currency,
      })
      .select(ROOM_SELECT)
      .single();
    const created = toRoom(unwrap(result, 'room') as RoomRow);
    await this.syncRoomRelations(room.id, amenityIds, mediaIds);
    return { ...created, amenityIds, mediaIds };
  }

  async updateRoom(id: string, patch: Partial<Room>): Promise<Room> {
    const db = await this.db();
    const { amenityIds, mediaIds, basePrice, ...rest } = patch;
    const update: Row = snakeCase(rest);
    if (basePrice) {
      update.base_price_minor = basePrice.amount;
      update.currency = basePrice.currency;
    }

    const result = await db
      .from('rooms')
      .update(update)
      .eq('id', id)
      .select(ROOM_SELECT)
      .single();
    const updated = toRoom(unwrap(result, 'room') as RoomRow);

    if (amenityIds || mediaIds) {
      await this.syncRoomRelations(id, amenityIds, mediaIds);
      return {
        ...updated,
        amenityIds: amenityIds ?? updated.amenityIds,
        mediaIds: mediaIds ?? updated.mediaIds,
      };
    }
    return updated;
  }

  /**
   * Replace a room's amenity and media links.
   *
   * Delete-then-insert rather than a diff: the lists are short, the operation
   * runs behind an admin action, and a full replace cannot leave a stale row
   * behind the way a buggy diff can.
   */
  private async syncRoomRelations(
    roomId: string,
    amenityIds?: string[],
    mediaIds?: string[],
  ): Promise<void> {
    const db = await this.db();

    if (amenityIds) {
      await db.from('room_amenities').delete().eq('room_id', roomId);
      if (amenityIds.length > 0) {
        const { error } = await db
          .from('room_amenities')
          .insert(amenityIds.map((amenity_id) => ({ room_id: roomId, amenity_id })));
        if (error) throw translate(error, 'room amenities');
      }
    }

    if (mediaIds) {
      await db.from('room_media').delete().eq('room_id', roomId);
      if (mediaIds.length > 0) {
        const { error } = await db.from('room_media').insert(
          mediaIds.map((media_id, index) => ({
            room_id: roomId,
            media_id,
            sort_order: index,
          })),
        );
        if (error) throw translate(error, 'room media');
      }
    }
  }

  async deleteRoom(id: string): Promise<void> {
    const db = await this.db();
    const { count } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', id)
      .in('status', ['pending', 'confirmed']);

    if ((count ?? 0) > 0) {
      throw new ConflictError(
        'This room has active bookings. Archive it instead of deleting.',
      );
    }
    const { error } = await db.from('rooms').delete().eq('id', id);
    if (error) throw translate(error, 'room');
  }

  /* --- Media ----------------------------------------------------------- */

  async listMedia(filter: MediaFilter = {}): Promise<MediaAsset[]> {
    const db = await this.db();
    let query = db
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (filter.category) query = query.eq('category', filter.category);
    if (filter.type) query = query.eq('type', filter.type);
    if (filter.search) query = query.ilike('alt_text', `%${filter.search}%`);
    const result = await query;
    return unwrap(result, 'media').map(toMedia);
  }

  async getMediaById(id: string): Promise<MediaAsset | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('media_assets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw translate(error, 'media');
    return data ? toMedia(data) : null;
  }

  async createMedia(asset: Omit<MediaAsset, 'createdAt'>): Promise<MediaAsset> {
    const db = await this.db();
    const result = await db
      .from('media_assets')
      .insert(snakeCase(asset))
      .select('*')
      .single();
    return toMedia(unwrap(result, 'media'));
  }

  async updateMedia(id: string, patch: Partial<MediaAsset>): Promise<MediaAsset> {
    const db = await this.db();
    const result = await db
      .from('media_assets')
      .update(snakeCase(patch))
      .eq('id', id)
      .select('*')
      .single();
    return toMedia(unwrap(result, 'media'));
  }

  async deleteMedia(id: string): Promise<void> {
    const references = await this.findMediaReferences(id);
    if (references.length > 0) {
      throw new ConflictError(
        `This asset is used by ${references.length} published record(s).`,
      );
    }
    const db = await this.db();
    const { error } = await db.from('media_assets').delete().eq('id', id);
    if (error) throw translate(error, 'media');
  }

  async findMediaReferences(
    id: string,
  ): Promise<{ type: string; id: string; label: string }[]> {
    const db = await this.db();
    const refs: { type: string; id: string; label: string }[] = [];

    const [roomLinks, campaignLinks, content] = await Promise.all([
      db.from('room_media').select('room_id, rooms(name)').eq('media_id', id),
      db
        .from('campaigns')
        .select('id, title')
        .or(`media_id.eq.${id},mobile_media_id.eq.${id}`),
      db.from('site_content').select('hero_media_id').eq('id', 'content').maybeSingle(),
    ]);

    for (const link of roomLinks.data ?? []) {
      const row = link as Row;
      refs.push({
        type: 'room',
        id: row.room_id,
        label: row.rooms?.name ?? row.room_id,
      });
    }
    for (const campaign of campaignLinks.data ?? []) {
      const row = campaign as Row;
      refs.push({ type: 'campaign', id: row.id, label: row.title ?? row.id });
    }
    if (content.data?.hero_media_id === id) {
      refs.push({ type: 'content', id: 'hero', label: 'Bosh sahifa hero' });
    }
    return refs;
  }

  /* --- Offers ---------------------------------------------------------- */

  async listOffers(statuses?: PublicationStatus[]): Promise<Offer[]> {
    const db = await this.db();
    let query = db.from('offers').select(OFFER_SELECT).order('name');
    if (statuses?.length) query = query.in('status', statuses);
    const result = await query;
    return unwrap(result, 'offers').map(toOffer);
  }

  async getOfferById(id: string): Promise<Offer | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('offers')
      .select(OFFER_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw translate(error, 'offer');
    return data ? toOffer(data) : null;
  }

  async createOffer(offer: Omit<Offer, 'createdAt' | 'updatedAt'>): Promise<Offer> {
    const db = await this.db();
    const { eligibleRoomIds, ...rest } = offer;
    const result = await db
      .from('offers')
      .insert(snakeCase(rest))
      .select(OFFER_SELECT)
      .single();
    const created = toOffer(unwrap(result, 'offer'));
    await this.syncOfferRooms(offer.id, eligibleRoomIds);
    return { ...created, eligibleRoomIds };
  }

  async updateOffer(id: string, patch: Partial<Offer>): Promise<Offer> {
    const db = await this.db();
    const { eligibleRoomIds, ...rest } = patch;
    const result = await db
      .from('offers')
      .update(snakeCase(rest))
      .eq('id', id)
      .select(OFFER_SELECT)
      .single();
    const updated = toOffer(unwrap(result, 'offer'));
    if (eligibleRoomIds) {
      await this.syncOfferRooms(id, eligibleRoomIds);
      return { ...updated, eligibleRoomIds };
    }
    return updated;
  }

  private async syncOfferRooms(offerId: string, roomIds: string[]): Promise<void> {
    const db = await this.db();
    await db.from('offer_rooms').delete().eq('offer_id', offerId);
    if (roomIds.length > 0) {
      const { error } = await db
        .from('offer_rooms')
        .insert(roomIds.map((room_id) => ({ offer_id: offerId, room_id })));
      if (error) throw translate(error, 'offer rooms');
    }
  }

  async deleteOffer(id: string): Promise<void> {
    const db = await this.db();
    const { error } = await db.from('offers').delete().eq('id', id);
    if (error) throw translate(error, 'offer');
  }

  /* --- Campaigns ------------------------------------------------------- */

  async listCampaigns(statuses?: PublicationStatus[]): Promise<Campaign[]> {
    const db = await this.db();
    let query = db
      .from('campaigns')
      .select('*')
      .order('priority', { ascending: false });
    if (statuses?.length) query = query.in('status', statuses);
    const result = await query;
    return unwrap(result, 'campaigns').map(toCampaign);
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw translate(error, 'campaign');
    return data ? toCampaign(data) : null;
  }

  async createCampaign(
    campaign: Omit<Campaign, 'createdAt' | 'updatedAt'>,
  ): Promise<Campaign> {
    const db = await this.db();
    const result = await db
      .from('campaigns')
      .insert(snakeCase(campaign))
      .select('*')
      .single();
    return toCampaign(unwrap(result, 'campaign'));
  }

  async updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
    const db = await this.db();
    const result = await db
      .from('campaigns')
      .update(snakeCase(patch))
      .eq('id', id)
      .select('*')
      .single();
    return toCampaign(unwrap(result, 'campaign'));
  }

  async deleteCampaign(id: string): Promise<void> {
    const db = await this.db();
    const { error } = await db.from('campaigns').delete().eq('id', id);
    if (error) throw translate(error, 'campaign');
  }

  async reorderCampaigns(orderedIds: string[]): Promise<void> {
    const db = await this.db();
    await Promise.all(
      orderedIds.map((id, index) =>
        db
          .from('campaigns')
          .update({ priority: (orderedIds.length - index) * 10 })
          .eq('id', id),
      ),
    );
  }

  /* --- Bookings -------------------------------------------------------- */

  async listBookings(filter: BookingFilter = {}): Promise<Paginated<Booking>> {
    const db = await this.db();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    let query = db
      .from('bookings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter.statuses?.length) query = query.in('status', filter.statuses);
    if (filter.roomId) query = query.eq('room_id', filter.roomId);
    if (filter.createdFrom) query = query.gte('created_at', filter.createdFrom);
    if (filter.createdTo) query = query.lte('created_at', filter.createdTo);
    if (filter.checkInFrom) query = query.gte('check_in', filter.checkInFrom);
    if (filter.checkInTo) query = query.lte('check_in', filter.checkInTo);
    if (filter.search) {
      const term = filter.search.replace(/[%,()]/g, '');
      query = query.or(
        `reference.ilike.%${term}%,guest_name.ilike.%${term}%,guest_email.ilike.%${term}%,guest_phone.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) throw translate(error, 'bookings');
    return {
      items: (data as BookingRow[]).map(toBooking),
      total: count ?? 0,
    };
  }

  async getBookingById(id: string): Promise<Booking | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw translate(error, 'booking');
    return data ? toBooking(data as BookingRow) : null;
  }

  async getBookingByReference(reference: string): Promise<Booking | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('reference', reference.trim().toUpperCase())
      .maybeSingle();
    if (error) throw translate(error, 'booking');
    return data ? toBooking(data as BookingRow) : null;
  }

  /**
   * Create a booking through the SQL function so the availability check and
   * the insert share one transaction with the room row locked.
   */
  async createBooking({ booking }: CreateBookingInput): Promise<Booking> {
    const db = await this.db();
    const { data, error } = await db.rpc('create_booking_inquiry', {
      p_reference: booking.reference,
      p_guest_name: booking.guest.fullName,
      p_guest_email: booking.guest.email,
      p_guest_phone: booking.guest.phone,
      p_room_id: booking.roomId,
      p_check_in: booking.checkIn,
      p_check_out: booking.checkOut,
      p_adults: booking.adults,
      p_children: booking.children,
      p_rooms_count: booking.rooms,
      p_price_minor: booking.priceEstimate.amount,
      p_currency: booking.priceEstimate.currency,
      p_breakdown: booking.priceBreakdown,
      p_special_requests: booking.specialRequests,
    });
    if (error) throw translate(error, 'booking');
    return toBooking(data as BookingRow);
  }

  async transitionBooking(args: {
    id: string;
    expectedStatus: BookingStatus;
    nextStatus: BookingStatus;
    actor: string;
    reason?: string | null;
  }): Promise<Booking> {
    const db = await this.db();
    const { data, error } = await db.rpc('transition_booking', {
      p_booking_id: args.id,
      p_expected_status: args.expectedStatus,
      p_next_status: args.nextStatus,
      p_actor: args.actor,
      p_reason: args.reason ?? null,
    });
    if (error) throw translate(error, 'booking');
    return toBooking(data as BookingRow);
  }

  async updateBookingNotes(id: string, notes: string): Promise<Booking> {
    const db = await this.db();
    const result = await db
      .from('bookings')
      .update({ internal_notes: notes })
      .eq('id', id)
      .select('*')
      .single();
    return toBooking(unwrap(result, 'booking') as BookingRow);
  }

  async listBookingHistory(bookingId: string): Promise<BookingStatusChange[]> {
    const db = await this.db();
    const result = await db
      .from('booking_status_history')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at');
    return unwrap(result, 'booking history').map((row: Row) => ({
      id: row.id,
      bookingId: row.booking_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actor: row.actor,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  }

  async findOverlappingBookings(args: {
    roomId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<Booking[]> {
    const db = await this.db();
    const result = await db
      .from('bookings')
      .select('*')
      .eq('room_id', args.roomId)
      .in('status', ['pending', 'confirmed'])
      // Overlap test: existing.check_in < requested.check_out
      //           and existing.check_out > requested.check_in
      .lt('check_in', args.checkOut)
      .gt('check_out', args.checkIn);
    return (unwrap(result, 'bookings') as BookingRow[]).map(toBooking);
  }

  /* --- Contact inquiries ----------------------------------------------- */

  async listInquiries(filter: InquiryFilter = {}): Promise<Paginated<ContactInquiry>> {
    const db = await this.db();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    let query = db
      .from('contact_inquiries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter.statuses?.length) query = query.in('status', filter.statuses);
    if (filter.search) {
      const term = filter.search.replace(/[%,()]/g, '');
      query = query.or(
        `name.ilike.%${term}%,email.ilike.%${term}%,subject.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) throw translate(error, 'inquiries');
    return { items: (data ?? []).map(toInquiry), total: count ?? 0 };
  }

  async getInquiryById(id: string): Promise<ContactInquiry | null> {
    const db = await this.db();
    const { data, error } = await db
      .from('contact_inquiries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw translate(error, 'inquiry');
    return data ? toInquiry(data) : null;
  }

  async createInquiry(
    inquiry: Omit<ContactInquiry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContactInquiry> {
    const db = await this.db();
    const result = await db
      .from('contact_inquiries')
      .insert(snakeCase(inquiry))
      .select('*')
      .single();
    return toInquiry(unwrap(result, 'inquiry'));
  }

  async updateInquiry(
    id: string,
    patch: Partial<ContactInquiry>,
  ): Promise<ContactInquiry> {
    const db = await this.db();
    const result = await db
      .from('contact_inquiries')
      .update(snakeCase(patch))
      .eq('id', id)
      .select('*')
      .single();
    return toInquiry(unwrap(result, 'inquiry'));
  }

  /* --- Testimonials ---------------------------------------------------- */

  async listTestimonials(publishedOnly = true): Promise<Testimonial[]> {
    const db = await this.db();
    let query = db.from('testimonials').select('*').order('sort_order');
    if (publishedOnly) query = query.eq('is_published', true);
    const result = await query;
    return unwrap(result, 'testimonials').map((row: Row) => ({
      id: row.id,
      authorLabel: row.author_label,
      body: row.body,
      rating: row.rating,
      isSample: row.is_sample,
      isPublished: row.is_published,
      sortOrder: row.sort_order,
    }));
  }

  /* --- Analytics ------------------------------------------------------- */

  async recordAnalyticsEvent(
    event: Omit<AnalyticsEvent, 'id' | 'createdAt'>,
  ): Promise<void> {
    const db = await this.db();
    const { error } = await db.from('analytics_events').insert({
      type: event.type,
      session_id: event.sessionId,
      room_id: event.roomId,
      campaign_id: event.campaignId,
      metadata: event.metadata,
    });
    // Analytics must never break a page. Log and move on.
    if (error) console.warn('[analytics] insert failed:', error.message);
  }

  async getAnalyticsTotals(range: AnalyticsRange): Promise<AnalyticsTotals> {
    const db = await this.db();
    const { data, error } = await db
      .from('analytics_events')
      .select('type, session_id, room_id, campaign_id')
      .gte('created_at', range.from)
      .lt('created_at', range.to)
      // Bounded so a busy month cannot pull an unbounded result set.
      .limit(50_000);

    if (error) throw translate(error, 'analytics');

    const eventCounts = Object.fromEntries(
      ANALYTICS_EVENTS.map((t) => [t, 0]),
    ) as Record<AnalyticsEventType, number>;
    const campaignImpressions: Record<string, number> = {};
    const campaignClicks: Record<string, number> = {};
    const roomViews: Record<string, number> = {};
    const sessions = new Set<string>();

    for (const raw of data ?? []) {
      const row = raw as Row;
      const type = row.type as AnalyticsEventType;
      if (type in eventCounts) eventCounts[type] += 1;
      sessions.add(row.session_id);

      if (row.campaign_id) {
        if (type === 'campaign_impression') {
          campaignImpressions[row.campaign_id] =
            (campaignImpressions[row.campaign_id] ?? 0) + 1;
        } else if (type === 'campaign_cta_clicked') {
          campaignClicks[row.campaign_id] =
            (campaignClicks[row.campaign_id] ?? 0) + 1;
        }
      }
      if (row.room_id && type === 'room_detail_viewed') {
        roomViews[row.room_id] = (roomViews[row.room_id] ?? 0) + 1;
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
    const db = await this.db();
    const { data, error } = await db
      .from('bookings')
      .select('status, room_id, price_estimate_minor, created_at')
      .gte('created_at', range.from)
      .lt('created_at', range.to)
      .limit(20_000);

    if (error) throw translate(error, 'bookings');

    const byStatus = Object.fromEntries(
      BOOKING_STATUSES.map((s) => [s, 0]),
    ) as Record<BookingStatus, number>;
    const byRoom: Record<string, number> = {};
    const dateCounts = new Map<string, number>();
    let confirmedEstimateMinor = 0;
    let confirmedCount = 0;

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    for (const raw of data ?? []) {
      const row = raw as Row;
      const status = row.status as BookingStatus;
      byStatus[status] += 1;
      byRoom[row.room_id] = (byRoom[row.room_id] ?? 0) + 1;

      const day = formatter.format(new Date(row.created_at));
      dateCounts.set(day, (dateCounts.get(day) ?? 0) + 1);

      if (status === 'confirmed' || status === 'completed') {
        confirmedEstimateMinor += Number(row.price_estimate_minor);
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
    const db = await this.db();
    const { error } = await db.from('audit_logs').insert({
      actor: entry.actor,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      changes: entry.changes ?? null,
    });
    if (error) console.warn('[audit] insert failed:', error.message);
  }

  async listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
    const db = await this.db();
    const result = await db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return unwrap(result, 'audit logs').map((row: Row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      changes: row.changes,
      createdAt: row.created_at,
    }));
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
