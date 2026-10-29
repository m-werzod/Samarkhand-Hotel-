import { describe, expect, it } from 'vitest';

import {
  BOOKING_REFERENCE_PATTERN,
  BOOKING_TRANSITIONS,
  BookingTransitionError,
  assertTransition,
  canTransition,
  checkAvailability,
  generateBookingReference,
  isBlocking,
  isValidBookingReference,
  toPublicBooking,
} from '@/lib/domain/booking';
import { money } from '@/lib/domain/money';
import type { Booking, BookingStatus } from '@/lib/domain/types';

describe('booking references', () => {
  it('matches the documented shape', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateBookingReference()).toMatch(BOOKING_REFERENCE_PATTERN);
    }
  });

  it('omits characters that are misheard over the phone', () => {
    const sample = Array.from({ length: 200 }, () => generateBookingReference()).join('');
    // I, L, O, 0 and 1 are excluded on purpose.
    expect(sample).not.toMatch(/[ILO01]/);
  });

  it('is effectively unique across a realistic volume', () => {
    const seen = new Set(Array.from({ length: 2000 }, generateBookingReference));
    expect(seen.size).toBe(2000);
  });

  it('validates case-insensitively and tolerates surrounding space', () => {
    const reference = generateBookingReference();
    expect(isValidBookingReference(` ${reference.toLowerCase()} `)).toBe(true);
    expect(isValidBookingReference('SMK-ABC')).toBe(false);
    expect(isValidBookingReference('XXX-ABCDEF')).toBe(false);
  });
});

describe('status transitions', () => {
  it('allows a pending booking to be confirmed or cancelled', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('pending', 'completed')).toBe(false);
  });

  it('allows a confirmed booking to complete or cancel', () => {
    expect(canTransition('confirmed', 'completed')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
    expect(canTransition('confirmed', 'pending')).toBe(false);
  });

  it('treats cancelled and completed as terminal', () => {
    expect(BOOKING_TRANSITIONS.cancelled).toHaveLength(0);
    expect(BOOKING_TRANSITIONS.completed).toHaveLength(0);
  });

  it('rejects a no-op transition, which is almost always a double submit', () => {
    expect(() => assertTransition('pending', 'pending')).toThrow(BookingTransitionError);
  });

  it('names both ends of an illegal transition in the error', () => {
    try {
      assertTransition('cancelled', 'confirmed');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BookingTransitionError);
      expect((error as BookingTransitionError).from).toBe('cancelled');
      expect((error as BookingTransitionError).to).toBe('confirmed');
    }
  });

  it('counts pending and confirmed as occupying a room', () => {
    expect(isBlocking('pending')).toBe(true);
    expect(isBlocking('confirmed')).toBe(true);
    expect(isBlocking('cancelled')).toBe(false);
    expect(isBlocking('completed')).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

const existing = (
  overrides: Partial<Pick<Booking, 'roomId' | 'checkIn' | 'checkOut' | 'rooms' | 'status'>>,
) => ({
  roomId: 'room-a',
  checkIn: '2026-04-01',
  checkOut: '2026-04-05',
  rooms: 1,
  status: 'pending' as BookingStatus,
  ...overrides,
});

describe('availability', () => {
  const tracked = { id: 'room-a', inventoryCount: 3 };

  it('reports untracked inventory rather than claiming availability', () => {
    const result = checkAvailability(
      { id: 'room-a', inventoryCount: 0 },
      { checkIn: '2026-04-01', checkOut: '2026-04-03', rooms: 1 },
      [],
    );
    expect(result.inventoryTracked).toBe(false);
    expect(result.available).toBe(false);
  });

  it('counts free units against overlapping bookings', () => {
    const result = checkAvailability(
      tracked,
      { checkIn: '2026-04-02', checkOut: '2026-04-04', rooms: 1 },
      [existing({}), existing({ rooms: 1 })],
    );
    expect(result.unitsFree).toBe(1);
    expect(result.available).toBe(true);
  });

  it('refuses when every unit is taken', () => {
    const result = checkAvailability(
      tracked,
      { checkIn: '2026-04-02', checkOut: '2026-04-04', rooms: 1 },
      [existing({ rooms: 3 })],
    );
    expect(result.unitsFree).toBe(0);
    expect(result.available).toBe(false);
  });

  it('ignores cancelled and completed bookings', () => {
    const result = checkAvailability(
      tracked,
      { checkIn: '2026-04-02', checkOut: '2026-04-04', rooms: 1 },
      [
        existing({ rooms: 3, status: 'cancelled' }),
        existing({ rooms: 3, status: 'completed' }),
      ],
    );
    expect(result.unitsFree).toBe(3);
  });

  it('ignores bookings for other rooms', () => {
    const result = checkAvailability(
      tracked,
      { checkIn: '2026-04-02', checkOut: '2026-04-04', rooms: 1 },
      [existing({ roomId: 'room-b', rooms: 3 })],
    );
    expect(result.unitsFree).toBe(3);
  });

  it('uses the tightest night, not the average, across the range', () => {
    // Two units are taken only on 3–4 April; the request spans it.
    const result = checkAvailability(
      tracked,
      { checkIn: '2026-04-01', checkOut: '2026-04-06', rooms: 2 },
      [existing({ checkIn: '2026-04-03', checkOut: '2026-04-04', rooms: 2 })],
    );
    expect(result.unitsFree).toBe(1);
    expect(result.available).toBe(false);
  });

  it('allows a booking that starts exactly when another ends', () => {
    const result = checkAvailability(
      { id: 'room-a', inventoryCount: 1 },
      { checkIn: '2026-04-05', checkOut: '2026-04-07', rooms: 1 },
      [existing({ checkOut: '2026-04-05', rooms: 1 })],
    );
    expect(result.available).toBe(true);
  });
});

describe('public serialisation', () => {
  it('strips internal notes and the primary key', () => {
    const booking: Booking = {
      id: 'booking-1',
      reference: 'SMK-ABC234',
      guest: { fullName: 'A', email: 'a@example.com', phone: '+998900000000' },
      roomId: 'room-a',
      checkIn: '2026-04-01',
      checkOut: '2026-04-03',
      adults: 2,
      children: 0,
      rooms: 1,
      priceEstimate: money(1000, 'UZS'),
      priceBreakdown: {
        nights: 2,
        rooms: 1,
        nightlyRate: money(500, 'UZS'),
        subtotal: money(1000, 'UZS'),
        discount: money(0, 'UZS'),
        appliedOfferId: null,
        appliedOfferName: null,
        taxes: money(0, 'UZS'),
        fees: money(0, 'UZS'),
        total: money(1000, 'UZS'),
      },
      status: 'pending',
      specialRequests: null,
      internalNotes: 'Guest complained last time',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = toPublicBooking(booking);
    expect(result).not.toHaveProperty('internalNotes');
    expect(result).not.toHaveProperty('id');
    expect(result.reference).toBe('SMK-ABC234');
  });
});
