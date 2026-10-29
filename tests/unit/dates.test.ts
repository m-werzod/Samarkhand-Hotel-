import { describe, expect, it } from 'vitest';

import {
  MAX_STAY_NIGHTS,
  addDays,
  compareCalendarDates,
  formatDateForDisplay,
  formatDateRange,
  isCalendarDate,
  nightsBetween,
  roomFitsOccupancy,
  staysOverlap,
  todayIn,
  validateOccupancy,
  validateStay,
} from '@/lib/domain/dates';

const TZ = 'Asia/Samarkand';

describe('calendar date parsing', () => {
  it('accepts well-formed dates', () => {
    expect(isCalendarDate('2026-03-15')).toBe(true);
  });

  it('rejects impossible days rather than rolling them over', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-00-10')).toBe(false);
  });

  it('rejects anything that is not YYYY-MM-DD', () => {
    expect(isCalendarDate('15/03/2026')).toBe(false);
    expect(isCalendarDate('2026-3-5')).toBe(false);
    expect(isCalendarDate(20260315)).toBe(false);
  });

  it('knows leap days', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2027-02-29')).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('counts nights between dates', () => {
    expect(nightsBetween('2026-03-01', '2026-03-04')).toBe(3);
    expect(nightsBetween('2026-03-04', '2026-03-01')).toBe(-3);
  });

  it('sorts ISO dates as plain strings', () => {
    expect(compareCalendarDates('2026-03-01', '2026-03-02')).toBeLessThan(0);
    expect(compareCalendarDates('2026-03-02', '2026-03-02')).toBe(0);
  });
});

describe('overlap detection', () => {
  it('treats check-out as exclusive, so same-day turnover is not an overlap', () => {
    expect(staysOverlap('2026-03-01', '2026-03-04', '2026-03-04', '2026-03-06')).toBe(false);
    expect(staysOverlap('2026-03-01', '2026-03-04', '2026-03-03', '2026-03-06')).toBe(true);
  });

  it('detects full containment in both directions', () => {
    expect(staysOverlap('2026-03-01', '2026-03-10', '2026-03-03', '2026-03-05')).toBe(true);
    expect(staysOverlap('2026-03-03', '2026-03-05', '2026-03-01', '2026-03-10')).toBe(true);
  });
});

describe('time zone handling', () => {
  it('resolves today in the hotel time zone, not the host one', () => {
    // 2026-03-15T20:00Z is already 2026-03-16 in Samarkand (UTC+5).
    const instant = new Date('2026-03-15T20:00:00.000Z');
    expect(todayIn(TZ, instant)).toBe('2026-03-16');
    expect(todayIn('UTC', instant)).toBe('2026-03-15');
  });

  it('does not reject a check-in that is only past on the visitor device', () => {
    // A guest in a time zone ahead of Samarkand booking "today" there.
    const instant = new Date('2026-03-15T20:00:00.000Z'); // 16 Mar in Samarkand
    const result = validateStay('2026-03-16', '2026-03-18', { timeZone: TZ, now: instant });
    expect(result.ok).toBe(true);
  });
});

describe('stay validation', () => {
  const now = new Date('2026-03-15T06:00:00.000Z');

  it('accepts a normal stay', () => {
    const result = validateStay('2026-03-20', '2026-03-23', { timeZone: TZ, now });
    expect(result.ok).toBe(true);
    expect(result.nights).toBe(3);
  });

  it('rejects a check-in in the past', () => {
    const result = validateStay('2026-03-01', '2026-03-03', { timeZone: TZ, now });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('check_in_in_past');
  });

  it('rejects a check-out that is not after check-in', () => {
    const result = validateStay('2026-03-20', '2026-03-20', { timeZone: TZ, now });
    expect(result.errors).toContain('check_out_not_after_check_in');
  });

  it('rejects a stay longer than the maximum', () => {
    const checkOut = addDays('2026-03-20', MAX_STAY_NIGHTS + 1);
    const result = validateStay('2026-03-20', checkOut, { timeZone: TZ, now });
    expect(result.errors).toContain('stay_too_long');
  });

  it('rejects a booking far beyond the horizon', () => {
    const result = validateStay('2030-01-01', '2030-01-03', { timeZone: TZ, now });
    expect(result.errors).toContain('too_far_ahead');
  });

  it('reports malformed dates without attempting arithmetic', () => {
    const result = validateStay('not-a-date', '2026-03-20', { timeZone: TZ, now });
    expect(result.errors).toEqual(['invalid_check_in']);
    expect(result.nights).toBe(0);
  });
});

describe('occupancy validation', () => {
  it('accepts a normal party', () => {
    expect(validateOccupancy({ adults: 2, children: 1, rooms: 1 }).ok).toBe(true);
  });

  it('requires at least one adult', () => {
    expect(validateOccupancy({ adults: 0, children: 2, rooms: 1 }).errors).toContain(
      'adults_too_few',
    );
  });

  it('requires an adult in every room', () => {
    const result = validateOccupancy({ adults: 2, children: 0, rooms: 3 });
    expect(result.errors).toContain('more_rooms_than_adults');
  });

  it('rejects non-integers', () => {
    expect(validateOccupancy({ adults: 1.5, children: 0, rooms: 1 }).ok).toBe(false);
  });
});

describe('room fit', () => {
  const room = { maxOccupancy: 3, maxAdults: 2, maxChildren: 2 };

  it('fits a party that divides across rooms', () => {
    expect(roomFitsOccupancy(room, { adults: 4, children: 2, rooms: 2 })).toBe(true);
  });

  it('rejects a party that exceeds per-room adults', () => {
    expect(roomFitsOccupancy(room, { adults: 3, children: 0, rooms: 1 })).toBe(false);
  });

  it('rejects a party that exceeds total occupancy per room', () => {
    expect(roomFitsOccupancy(room, { adults: 2, children: 2, rooms: 1 })).toBe(false);
  });
});

describe('display formatting', () => {
  it('writes Uzbek dates day-first with the month name', () => {
    expect(formatDateForDisplay('2026-10-30', 'uz')).toBe('30-oktabr');
    expect(formatDateForDisplay('2026-10-30', 'uz', { day: 'numeric', month: 'short' })).toBe(
      '30-okt',
    );
  });

  it('never falls back to ICU numeric months, which differ per runtime', () => {
    // Node's bundled ICU renders "M10" for uz-UZ short months.
    const formatted = formatDateForDisplay('2026-10-30', 'uz', {
      day: 'numeric',
      month: 'short',
    });
    expect(formatted).not.toContain('M10');
  });

  it('formats a range and includes the year once', () => {
    expect(formatDateRange('2026-10-30', '2026-11-01', 'uz')).toBe(
      '30-okt — 1-noy 2026',
    );
  });
});
