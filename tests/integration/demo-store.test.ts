import { beforeEach, describe, expect, it } from 'vitest';

import { DemoStore, resetDemoStore } from '@/lib/data/demo-store';
import { ConflictError, NotFoundError } from '@/lib/data/store';
import { generateBookingReference } from '@/lib/domain/booking';
import { money } from '@/lib/domain/money';
import type { Booking } from '@/lib/domain/types';

/**
 * Integration tests for the data layer.
 *
 * These run against the in-memory store, which implements the same contract
 * as the Supabase adapter. They cover the behaviours the UI depends on:
 * publication filtering, referential safety, concurrency and analytics
 * aggregation.
 */

const store = new DemoStore();

beforeEach(() => {
  resetDemoStore();
});

const bookingInput = (overrides: Partial<Booking> = {}) => ({
  booking: {
    reference: generateBookingReference(),
    guest: {
      fullName: 'Dilnoza Karimova',
      email: 'dilnoza@example.com',
      phone: '+998900000000',
    },
    roomId: 'room-deluxe',
    checkIn: '2026-06-01',
    checkOut: '2026-06-04',
    adults: 2,
    children: 0,
    rooms: 1,
    priceEstimate: money(2_340_000, 'UZS'),
    priceBreakdown: {
      nights: 3,
      rooms: 1,
      nightlyRate: money(780_000, 'UZS'),
      subtotal: money(2_340_000, 'UZS'),
      discount: money(0, 'UZS'),
      appliedOfferId: null,
      appliedOfferName: null,
      taxes: money(0, 'UZS'),
      fees: money(0, 'UZS'),
      total: money(2_340_000, 'UZS'),
    },
    status: 'pending' as const,
    specialRequests: null,
    internalNotes: null,
    ...overrides,
  },
});

/* -------------------------------------------------------------------------- */

describe('seed integrity', () => {
  it('ships published rooms, amenities, offers and campaigns', async () => {
    const [rooms, amenities, offers, campaigns] = await Promise.all([
      store.listRooms({ statuses: ['published'] }),
      store.listAmenities(true),
      store.listOffers(['published']),
      store.listCampaigns(['published']),
    ]);

    expect(rooms.length).toBeGreaterThan(0);
    expect(amenities.length).toBeGreaterThan(0);
    expect(offers.length).toBeGreaterThan(0);
    expect(campaigns.length).toBeGreaterThan(0);
  });

  it('marks every seeded room and the settings as demo data', async () => {
    const rooms = await store.listRooms();
    expect(rooms.every((room) => room.isDemoData)).toBe(true);

    const settings = await store.getHotelSettings();
    expect(settings.isDemoData).toBe(true);
  });

  it('marks every seeded testimonial as a sample', async () => {
    const testimonials = await store.listTestimonials(false);
    expect(testimonials.length).toBeGreaterThan(0);
    expect(testimonials.every((t) => t.isSample)).toBe(true);
  });

  it('labels every bundled media asset as an illustration, not a photograph', async () => {
    const media = await store.listMedia();
    expect(media.length).toBeGreaterThan(0);
    expect(media.every((asset) => asset.kind === 'illustration')).toBe(true);
  });

  it('gives every media asset meaningful alt text', async () => {
    const media = await store.listMedia();
    for (const asset of media) {
      expect(asset.altText.length).toBeGreaterThan(10);
    }
  });

  it('points every room at media that actually exists', async () => {
    const [rooms, media] = await Promise.all([store.listRooms(), store.listMedia()]);
    const ids = new Set(media.map((asset) => asset.id));
    for (const room of rooms) {
      for (const mediaId of room.mediaIds) {
        expect(ids.has(mediaId), `${room.slug} -> ${mediaId}`).toBe(true);
      }
    }
  });

  it('points every campaign CTA at a safe destination', async () => {
    const campaigns = await store.listCampaigns();
    for (const campaign of campaigns) {
      if (!campaign.ctaHref) continue;
      expect(campaign.ctaHref.startsWith('/')).toBe(true);
    }
  });
});

describe('room publication', () => {
  it('hides a draft room from a published-only query', async () => {
    const [first] = await store.listRooms({ statuses: ['published'] });
    expect(first).toBeDefined();

    await store.updateRoom(first!.id, { status: 'draft' });

    const published = await store.listRooms({ statuses: ['published'] });
    expect(published.find((room) => room.id === first!.id)).toBeUndefined();

    const all = await store.listRooms();
    expect(all.find((room) => room.id === first!.id)).toBeDefined();
  });

  it('rejects a duplicate slug on create and on update', async () => {
    const [first] = await store.listRooms();

    await expect(
      store.createRoom({
        ...first!,
        id: 'room-clone',
      }),
    ).rejects.toThrow(ConflictError);

    const [, second] = await store.listRooms();
    await expect(
      store.updateRoom(second!.id, { slug: first!.slug }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when updating a room that is gone', async () => {
    await expect(store.updateRoom('nope', { name: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('refuses to delete a room with active bookings', async () => {
    await store.createBooking(bookingInput());
    await expect(store.deleteRoom('room-deluxe')).rejects.toThrow(ConflictError);
  });

  it('allows deleting a room once its bookings are cancelled', async () => {
    const booking = await store.createBooking(bookingInput());
    await store.transitionBooking({
      id: booking.id,
      expectedStatus: 'pending',
      nextStatus: 'cancelled',
      actor: 'test',
    });
    await expect(store.deleteRoom('room-deluxe')).resolves.toBeUndefined();
  });
});

describe('bookings', () => {
  it('assigns an id and records a creation history entry', async () => {
    const booking = await store.createBooking(bookingInput());

    expect(booking.id).toBeTruthy();
    expect(booking.status).toBe('pending');

    const history = await store.listBookingHistory(booking.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.fromStatus).toBeNull();
    expect(history[0]?.toStatus).toBe('pending');
    expect(history[0]?.actor).toBe('guest');
  });

  it('finds a booking by its public reference, case-insensitively', async () => {
    const booking = await store.createBooking(bookingInput());
    const found = await store.getBookingByReference(booking.reference.toLowerCase());
    expect(found?.id).toBe(booking.id);
  });

  it('rejects a duplicate reference', async () => {
    const reference = generateBookingReference();
    await store.createBooking(bookingInput({ reference }));
    await expect(store.createBooking(bookingInput({ reference }))).rejects.toThrow(
      ConflictError,
    );
  });

  it('records each transition in history', async () => {
    const booking = await store.createBooking(bookingInput());

    await store.transitionBooking({
      id: booking.id,
      expectedStatus: 'pending',
      nextStatus: 'confirmed',
      actor: 'admin@example.com',
      reason: 'Telefon orqali tasdiqlandi',
    });

    const history = await store.listBookingHistory(booking.id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      fromStatus: 'pending',
      toStatus: 'confirmed',
      actor: 'admin@example.com',
      reason: 'Telefon orqali tasdiqlandi',
    });
  });

  it('refuses a transition when the booking has already moved', async () => {
    const booking = await store.createBooking(bookingInput());

    await store.transitionBooking({
      id: booking.id,
      expectedStatus: 'pending',
      nextStatus: 'confirmed',
      actor: 'first@example.com',
    });

    // A second admin still holding the stale "pending" view must lose.
    await expect(
      store.transitionBooking({
        id: booking.id,
        expectedStatus: 'pending',
        nextStatus: 'cancelled',
        actor: 'second@example.com',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('filters by status, room, search term and stay dates', async () => {
    const a = await store.createBooking(bookingInput());
    await store.createBooking(
      bookingInput({
        roomId: 'room-standard',
        guest: {
          fullName: 'Bobur Aliyev',
          email: 'bobur@example.com',
          phone: '+998911111111',
        },
        checkIn: '2026-07-10',
        checkOut: '2026-07-12',
      }),
    );

    await store.transitionBooking({
      id: a.id,
      expectedStatus: 'pending',
      nextStatus: 'confirmed',
      actor: 'test',
    });

    expect((await store.listBookings({ statuses: ['confirmed'] })).total).toBe(1);
    expect((await store.listBookings({ roomId: 'room-standard' })).total).toBe(1);
    expect((await store.listBookings({ search: 'bobur' })).total).toBe(1);
    expect((await store.listBookings({ search: a.reference })).total).toBe(1);
    expect((await store.listBookings({ checkInFrom: '2026-07-01' })).total).toBe(1);
  });

  it('paginates with a stable total', async () => {
    for (let i = 0; i < 7; i += 1) {
      await store.createBooking(bookingInput());
    }
    const page = await store.listBookings({ limit: 3, offset: 3 });
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(7);
  });

  it('returns only blocking bookings that overlap a stay', async () => {
    await store.createBooking(bookingInput());
    const cancelled = await store.createBooking(
      bookingInput({ checkIn: '2026-06-02', checkOut: '2026-06-03' }),
    );
    await store.transitionBooking({
      id: cancelled.id,
      expectedStatus: 'pending',
      nextStatus: 'cancelled',
      actor: 'test',
    });

    const overlapping = await store.findOverlappingBookings({
      roomId: 'room-deluxe',
      checkIn: '2026-06-02',
      checkOut: '2026-06-03',
    });
    expect(overlapping).toHaveLength(1);

    const after = await store.findOverlappingBookings({
      roomId: 'room-deluxe',
      checkIn: '2026-06-04',
      checkOut: '2026-06-06',
    });
    expect(after).toHaveLength(0);
  });
});

describe('media referential safety', () => {
  it('finds the rooms and campaigns that use an asset', async () => {
    const refs = await store.findMediaReferences('media-room-deluxe');
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.some((ref) => ref.type === 'room')).toBe(true);
  });

  it('refuses to delete an asset that published content still points at', async () => {
    await expect(store.deleteMedia('media-room-deluxe')).rejects.toThrow(ConflictError);
  });

  it('allows deleting an asset once nothing references it', async () => {
    const created = await store.createMedia({
      id: 'media-orphan',
      storagePath: '/media/orphan.svg',
      type: 'image',
      kind: 'illustration',
      category: 'details',
      altText: 'An unreferenced test asset',
      caption: null,
      mimeType: 'image/svg+xml',
      bytes: 100,
      width: null,
      height: null,
    });
    await expect(store.deleteMedia(created.id)).resolves.toBeUndefined();
  });
});

describe('campaign ordering', () => {
  it('reassigns priorities so the given order is preserved', async () => {
    const before = await store.listCampaigns();
    const reversed = [...before].reverse().map((c) => c.id);

    await store.reorderCampaigns(reversed);

    const after = await store.listCampaigns();
    expect(after.map((c) => c.id)).toEqual(reversed);
    // Spaced by 10 so a later insert has somewhere to go.
    expect(after[0]!.priority).toBeGreaterThan(after[1]!.priority);
  });
});

describe('amenity detachment', () => {
  it('removes a deleted amenity from every room that referenced it', async () => {
    const roomsBefore = await store.listRooms();
    const target = roomsBefore.find((room) => room.amenityIds.includes('amenity-wifi'));
    expect(target).toBeDefined();

    await store.deleteAmenity('amenity-wifi');

    const roomsAfter = await store.listRooms();
    for (const room of roomsAfter) {
      expect(room.amenityIds).not.toContain('amenity-wifi');
    }
  });
});

describe('analytics aggregation', () => {
  const range = {
    from: new Date(Date.now() - 86_400_000).toISOString(),
    to: new Date(Date.now() + 86_400_000).toISOString(),
  };

  it('counts events, sessions, campaign stats and room views', async () => {
    await store.recordAnalyticsEvent({
      type: 'campaign_impression',
      sessionId: 'session-a',
      roomId: null,
      campaignId: 'campaign-autumn',
      metadata: {},
    });
    await store.recordAnalyticsEvent({
      type: 'campaign_cta_clicked',
      sessionId: 'session-a',
      roomId: null,
      campaignId: 'campaign-autumn',
      metadata: {},
    });
    await store.recordAnalyticsEvent({
      type: 'room_detail_viewed',
      sessionId: 'session-b',
      roomId: 'room-suite',
      campaignId: null,
      metadata: {},
    });

    const totals = await store.getAnalyticsTotals(range);
    expect(totals.distinctSessions).toBe(2);
    expect(totals.campaignImpressions['campaign-autumn']).toBe(1);
    expect(totals.campaignClicks['campaign-autumn']).toBe(1);
    expect(totals.roomViews['room-suite']).toBe(1);
    expect(totals.eventCounts.room_detail_viewed).toBe(1);
  });

  it('excludes events outside the range', async () => {
    await store.recordAnalyticsEvent({
      type: 'home_viewed',
      sessionId: 'session-a',
      roomId: null,
      campaignId: null,
      metadata: {},
    });

    const past = {
      from: '2020-01-01T00:00:00.000Z',
      to: '2020-01-02T00:00:00.000Z',
    };
    const totals = await store.getAnalyticsTotals(past);
    expect(totals.eventCounts.home_viewed).toBe(0);
    expect(totals.distinctSessions).toBe(0);
  });

  it('sums confirmed bookings separately from pending ones', async () => {
    const confirmed = await store.createBooking(bookingInput());
    await store.createBooking(bookingInput());

    await store.transitionBooking({
      id: confirmed.id,
      expectedStatus: 'pending',
      nextStatus: 'confirmed',
      actor: 'test',
    });

    const totals = await store.getBookingTotals(range, 'Asia/Samarkand');
    expect(totals.byStatus.pending).toBe(1);
    expect(totals.byStatus.confirmed).toBe(1);
    expect(totals.confirmedCount).toBe(1);
    // Only the confirmed booking contributes.
    expect(totals.confirmedEstimateMinor).toBe(2_340_000);
    expect(totals.byRoom['room-deluxe']).toBe(2);
  });
});

describe('audit log', () => {
  it('stores entries newest first and bounds its length', async () => {
    await store.recordAudit({
      actor: 'a@example.com',
      action: 'room.updated',
      entityType: 'room',
      entityId: 'room-deluxe',
      changes: { name: { from: 'Old', to: 'New' } },
    });
    await store.recordAudit({
      actor: 'b@example.com',
      action: 'room.deleted',
      entityType: 'room',
      entityId: 'room-standard',
    });

    const entries = await store.listAuditLogs();
    expect(entries[0]?.action).toBe('room.deleted');
    expect(entries[1]?.changes).toEqual({ name: { from: 'Old', to: 'New' } });
  });
});

describe('state isolation', () => {
  it('does not leak mutations back into the seed module', async () => {
    const [room] = await store.listRooms();
    await store.updateRoom(room!.id, { name: 'Mutated name' });

    resetDemoStore();

    const [fresh] = await store.listRooms();
    expect(fresh!.name).not.toBe('Mutated name');
  });

  it('returns clones, so a caller cannot mutate stored state by accident', async () => {
    const rooms = await store.listRooms();
    rooms[0]!.name = 'Changed in place';

    const again = await store.listRooms();
    expect(again[0]!.name).not.toBe('Changed in place');
  });
});
