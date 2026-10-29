import type { CalendarDate } from './types';

/**
 * Calendar-date helpers.
 *
 * A hotel stay is counted in calendar nights in the *hotel's* time zone, not
 * the visitor's. A guest in Tokyo booking a Tashkent hotel must not be told
 * their check-in is in the past because their device has already rolled over.
 * Everything here therefore works on `YYYY-MM-DD` strings resolved against an
 * explicit time zone, never on a raw `Date`.
 */

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_STAY_NIGHTS = 30;
/** How far ahead a booking inquiry may be made. */
export const MAX_BOOKING_HORIZON_DAYS = 540;

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Reject impossible days like 2026-02-30 by round-tripping through UTC.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): CalendarDate {
  // `en-CA` formats as YYYY-MM-DD, which is exactly the shape we store.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Parse `YYYY-MM-DD` to a UTC-midnight Date, for arithmetic only. */
export function parseCalendarDate(date: CalendarDate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatCalendarDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = parseCalendarDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatCalendarDate(d);
}

/** Nights between two calendar dates. Negative if `checkOut` precedes. */
export function nightsBetween(
  checkIn: CalendarDate,
  checkOut: CalendarDate,
): number {
  const ms = parseCalendarDate(checkOut).getTime() - parseCalendarDate(checkIn).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  // Zero-padded ISO dates sort correctly as plain strings.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Do `[aIn, aOut)` and `[bIn, bOut)` share at least one night? */
export function staysOverlap(
  aIn: CalendarDate,
  aOut: CalendarDate,
  bIn: CalendarDate,
  bOut: CalendarDate,
): boolean {
  return aIn < bOut && bIn < aOut;
}

/* -------------------------------------------------------------------------- */
/* Stay validation                                                             */
/* -------------------------------------------------------------------------- */

export type StayValidationCode =
  | 'invalid_check_in'
  | 'invalid_check_out'
  | 'check_in_in_past'
  | 'check_out_not_after_check_in'
  | 'stay_too_long'
  | 'too_far_ahead';

export interface StayValidationResult {
  ok: boolean;
  nights: number;
  errors: StayValidationCode[];
}

/**
 * Validates a requested stay against the hotel's calendar.
 *
 * Pure and time-zone explicit so the same function runs on the client for
 * instant feedback and on the server as the authority.
 */
export function validateStay(
  checkIn: string,
  checkOut: string,
  options: { timeZone: string; now?: Date; maxNights?: number },
): StayValidationResult {
  const errors: StayValidationCode[] = [];
  const maxNights = options.maxNights ?? MAX_STAY_NIGHTS;

  if (!isCalendarDate(checkIn)) errors.push('invalid_check_in');
  if (!isCalendarDate(checkOut)) errors.push('invalid_check_out');
  if (errors.length > 0) return { ok: false, nights: 0, errors };

  const today = todayIn(options.timeZone, options.now ?? new Date());

  if (compareCalendarDates(checkIn, today) < 0) {
    errors.push('check_in_in_past');
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    errors.push('check_out_not_after_check_in');
  } else if (nights > maxNights) {
    errors.push('stay_too_long');
  }

  if (nightsBetween(today, checkIn) > MAX_BOOKING_HORIZON_DAYS) {
    errors.push('too_far_ahead');
  }

  return { ok: errors.length === 0, nights: Math.max(nights, 0), errors };
}

/* -------------------------------------------------------------------------- */
/* Occupancy validation                                                        */
/* -------------------------------------------------------------------------- */

export const MAX_ADULTS_PER_SEARCH = 16;
export const MAX_CHILDREN_PER_SEARCH = 12;
export const MAX_ROOMS_PER_SEARCH = 8;

export type OccupancyValidationCode =
  | 'adults_too_few'
  | 'adults_too_many'
  | 'children_negative'
  | 'children_too_many'
  | 'rooms_too_few'
  | 'rooms_too_many'
  | 'more_rooms_than_adults';

export function validateOccupancy(occupancy: {
  adults: number;
  children: number;
  rooms: number;
}): { ok: boolean; errors: OccupancyValidationCode[] } {
  const errors: OccupancyValidationCode[] = [];
  const { adults, children, rooms } = occupancy;

  if (!Number.isInteger(adults) || adults < 1) errors.push('adults_too_few');
  else if (adults > MAX_ADULTS_PER_SEARCH) errors.push('adults_too_many');

  if (!Number.isInteger(children) || children < 0) errors.push('children_negative');
  else if (children > MAX_CHILDREN_PER_SEARCH) errors.push('children_too_many');

  if (!Number.isInteger(rooms) || rooms < 1) errors.push('rooms_too_few');
  else if (rooms > MAX_ROOMS_PER_SEARCH) errors.push('rooms_too_many');

  // Every room needs at least one adult in it.
  if (errors.length === 0 && rooms > adults) {
    errors.push('more_rooms_than_adults');
  }

  return { ok: errors.length === 0, errors };
}

/** Can this room type hold the requested party across `rooms` units? */
export function roomFitsOccupancy(
  room: { maxOccupancy: number; maxAdults: number; maxChildren: number },
  occupancy: { adults: number; children: number; rooms: number },
): boolean {
  const perRoomAdults = Math.ceil(occupancy.adults / occupancy.rooms);
  const perRoomChildren = Math.ceil(occupancy.children / occupancy.rooms);
  return (
    perRoomAdults <= room.maxAdults &&
    perRoomChildren <= room.maxChildren &&
    perRoomAdults + perRoomChildren <= room.maxOccupancy
  );
}

/* -------------------------------------------------------------------------- */
/* Display formatting                                                          */
/* -------------------------------------------------------------------------- */

const LOCALE_TAGS: Record<string, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-GB',
};

export function formatDateForDisplay(
  date: CalendarDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? 'uz-UZ', {
    ...options,
    timeZone: 'UTC',
  }).format(parseCalendarDate(date));
}

export function formatDateRange(
  checkIn: CalendarDate,
  checkOut: CalendarDate,
  locale: string,
): string {
  const sameYear = checkIn.slice(0, 4) === checkOut.slice(0, 4);
  const from = formatDateForDisplay(checkIn, locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const to = formatDateForDisplay(checkOut, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${from} — ${to}`;
}
