import { randomId } from '@/lib/utils';
import type { Booking, BookingStatus } from './types';
import { staysOverlap } from './dates';

/**
 * Booking lifecycle.
 *
 * A submitted request is an *inquiry*, not a reservation. It enters `pending`
 * and only a human with admin rights can move it to `confirmed`. Nothing in
 * this codebase auto-confirms, because the platform has no live inventory
 * feed and no payment capture — promising a guest a confirmed room on that
 * basis would be a lie the hotel has to clean up.
 */

export const BOOKING_REFERENCE_PREFIX = 'SMK';
const REFERENCE_BODY_LENGTH = 6;
export const BOOKING_REFERENCE_PATTERN = /^SMK-[A-HJ-NP-Z2-9]{6}$/;

/**
 * Generate a public booking reference, e.g. `SMK-7K2QD4`.
 *
 * The alphabet omits I, L, O, 0 and 1 so a guest reading the code down a
 * phone line cannot be misheard.
 */
export function generateBookingReference(): string {
  return `${BOOKING_REFERENCE_PREFIX}-${randomId(REFERENCE_BODY_LENGTH)}`;
}

export function isValidBookingReference(value: string): boolean {
  return BOOKING_REFERENCE_PATTERN.test(value.trim().toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* State machine                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Permitted status transitions.
 *
 * `completed` and `cancelled` are terminal: a stay that has happened or been
 * called off should not be edited back into the active pipeline, because the
 * dashboard's counts and the audit trail both depend on those being final.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export class BookingTransitionError extends Error {
  override name = 'BookingTransitionError';
  constructor(
    readonly from: BookingStatus,
    readonly to: BookingStatus,
  ) {
    super(`Cannot move a booking from "${from}" to "${to}"`);
  }
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (from === to) {
    throw new BookingTransitionError(from, to);
  }
  if (!canTransition(from, to)) {
    throw new BookingTransitionError(from, to);
  }
}

/** Statuses that still occupy the room for availability purposes. */
export const BLOCKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
];

export function isBlocking(status: BookingStatus): boolean {
  return BLOCKING_STATUSES.includes(status);
}

/* -------------------------------------------------------------------------- */
/* Availability                                                                */
/* -------------------------------------------------------------------------- */

export interface AvailabilityResult {
  /** True when at least `requestedRooms` units are free for the whole stay. */
  available: boolean;
  /** Units free on the tightest night of the range. */
  unitsFree: number;
  /**
   * False when the room has no inventory configured. The UI must then present
   * the result as an inquiry rather than as confirmed availability.
   */
  inventoryTracked: boolean;
}

/**
 * Check a room's remaining inventory across a date range.
 *
 * Counts overlapping blocking bookings per night and takes the worst night —
 * a stay is only bookable if every night of it has a unit free.
 *
 * When `inventoryCount` is 0 the hotel has not told us how many units exist,
 * so we report `inventoryTracked: false` and the caller must not claim
 * availability. This is the honest default for a new installation.
 */
export function checkAvailability(
  room: { id: string; inventoryCount: number },
  stay: { checkIn: string; checkOut: string; rooms: number },
  existingBookings: Pick<
    Booking,
    'roomId' | 'checkIn' | 'checkOut' | 'rooms' | 'status'
  >[],
): AvailabilityResult {
  if (room.inventoryCount <= 0) {
    return { available: false, unitsFree: 0, inventoryTracked: false };
  }

  const overlapping = existingBookings.filter(
    (booking) =>
      booking.roomId === room.id &&
      isBlocking(booking.status) &&
      staysOverlap(stay.checkIn, stay.checkOut, booking.checkIn, booking.checkOut),
  );

  // Sweep each night boundary and take the peak concurrent occupancy.
  const boundaries = new Set<string>([stay.checkIn]);
  for (const booking of overlapping) {
    if (booking.checkIn > stay.checkIn) boundaries.add(booking.checkIn);
  }

  let peak = 0;
  for (const night of boundaries) {
    const taken = overlapping
      .filter((b) => b.checkIn <= night && b.checkOut > night)
      .reduce((sum, b) => sum + b.rooms, 0);
    peak = Math.max(peak, taken);
  }

  const unitsFree = Math.max(room.inventoryCount - peak, 0);
  return {
    available: unitsFree >= stay.rooms,
    unitsFree,
    inventoryTracked: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                        */
/* -------------------------------------------------------------------------- */

export const BOOKING_STATUS_LABELS: Record<
  BookingStatus,
  { uz: string; tone: 'warning' | 'success' | 'danger' | 'info' }
> = {
  pending: { uz: 'Kutilmoqda', tone: 'warning' },
  confirmed: { uz: 'Tasdiqlangan', tone: 'success' },
  cancelled: { uz: 'Bekor qilingan', tone: 'danger' },
  completed: { uz: 'Yakunlangan', tone: 'info' },
};

/**
 * Strip staff-only fields before a booking record leaves the server for a
 * guest-facing response.
 */
export function toPublicBooking(booking: Booking): Omit<
  Booking,
  'internalNotes' | 'id'
> {
  const { internalNotes: _notes, id: _id, ...rest } = booking;
  return rest;
}
