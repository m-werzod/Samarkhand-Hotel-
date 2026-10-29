import {
  MAX_ADULTS_PER_SEARCH,
  MAX_CHILDREN_PER_SEARCH,
  MAX_ROOMS_PER_SEARCH,
  addDays,
  nightsBetween,
  todayIn,
} from './dates';

/**
 * Booking search criteria carried through the URL.
 *
 * Kept in a plain module rather than beside the search widget: the widget is
 * a Client Component, and `/rooms`, `/rooms/[slug]` and `/booking` are Server
 * Components that all need to read these criteria. A function exported from a
 * `'use client'` module cannot be called on the server — it throws at render
 * rather than at build, so the failure shows up as a broken page.
 */
export interface SearchCriteria {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
}

/** Serialise criteria into the query string the rooms page reads. */
export function criteriaToParams(criteria: SearchCriteria): URLSearchParams {
  return new URLSearchParams({
    checkIn: criteria.checkIn,
    checkOut: criteria.checkOut,
    adults: String(criteria.adults),
    children: String(criteria.children),
    rooms: String(criteria.rooms),
  });
}

/**
 * Read criteria out of a query string, with safe defaults.
 *
 * Never throws and never returns an incoherent range: anything missing,
 * malformed or out of bounds falls back to a sensible value, because a
 * visitor editing the URL by hand should get a usable page rather than a 500.
 */
export function criteriaFromParams(
  params: Record<string, string | string[] | undefined>,
  timeZone: string,
): SearchCriteria {
  const read = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const today = todayIn(timeZone);
  const checkIn = read('checkIn') ?? addDays(today, 1);
  const rawCheckOut = read('checkOut') ?? addDays(checkIn, 2);
  const checkOut =
    nightsBetween(checkIn, rawCheckOut) >= 1 ? rawCheckOut : addDays(checkIn, 1);

  const toInt = (value: string | undefined, fallback: number, max: number): number => {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, 0), max);
  };

  return {
    checkIn,
    checkOut,
    adults: Math.max(toInt(read('adults'), 2, MAX_ADULTS_PER_SEARCH), 1),
    children: toInt(read('children'), 0, MAX_CHILDREN_PER_SEARCH),
    rooms: Math.max(toInt(read('rooms'), 1, MAX_ROOMS_PER_SEARCH), 1),
  };
}
