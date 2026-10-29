'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Search, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { trackEvent } from '@/lib/analytics/client';
import {
  MAX_ADULTS_PER_SEARCH,
  MAX_CHILDREN_PER_SEARCH,
  MAX_ROOMS_PER_SEARCH,
  MAX_STAY_NIGHTS,
  addDays,
  formatDateRange,
  nightsBetween,
  todayIn,
  validateOccupancy,
  validateStay,
} from '@/lib/domain/dates';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';

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
 * The booking search widget.
 *
 * This is an *inquiry* form, not a live availability check, and it says so.
 * The submit label is "see rooms" rather than "check availability", because
 * the platform has no real-time inventory feed unless the hotel has
 * configured room counts — promising live availability it cannot deliver is
 * the single easiest way to lose a guest's trust.
 *
 * Validation mirrors `validateStay`/`validateOccupancy` so the feedback here
 * is identical to what the server will decide.
 */
export function BookingSearch({
  timeZone,
  initial,
  variant = 'panel',
  className,
  onSubmitted,
}: {
  timeZone: string;
  initial?: Partial<SearchCriteria>;
  variant?: 'panel' | 'inline';
  className?: string;
  onSubmitted?: (criteria: SearchCriteria) => void;
}) {
  const dict = getDictionary();
  const router = useRouter();

  const today = React.useMemo(() => todayIn(timeZone), [timeZone]);
  const defaultCheckIn = initial?.checkIn ?? addDays(today, 1);
  const defaultCheckOut = initial?.checkOut ?? addDays(defaultCheckIn, 2);

  const [checkIn, setCheckIn] = React.useState(defaultCheckIn);
  const [checkOut, setCheckOut] = React.useState(defaultCheckOut);
  const [adults, setAdults] = React.useState(initial?.adults ?? 2);
  const [children, setChildren] = React.useState(initial?.children ?? 0);
  const [rooms, setRooms] = React.useState(initial?.rooms ?? 1);
  const [touched, setTouched] = React.useState(false);

  /**
   * Keep check-out after check-in automatically.
   *
   * Guests move check-in forward far more often than they intend to clear
   * check-out, so nudging the second date is less friction than showing an
   * error and making them fix it.
   */
  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (value && checkOut <= value) {
      setCheckOut(addDays(value, 1));
    }
  }

  const stay = validateStay(checkIn, checkOut, { timeZone });
  const occupancy = validateOccupancy({ adults, children, rooms });

  const stayError = touched && stay.errors[0] ? dict.errors[stay.errors[0]] : undefined;
  const occupancyError =
    touched && occupancy.errors[0] ? dict.errors[occupancy.errors[0]] : undefined;

  const valid = stay.ok && occupancy.ok;
  const nights = stay.nights;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;

    const criteria: SearchCriteria = { checkIn, checkOut, adults, children, rooms };

    trackEvent({
      type: 'booking_search_submitted',
      metadata: { nights, adults, children, rooms },
    });

    onSubmitted?.(criteria);
    router.push(`/rooms?${criteriaToParams(criteria).toString()}`);
  }

  const panel = variant === 'panel';

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="booking-search-title"
      className={cn(
        panel && [
          'rounded-xl border border-sand-300/70 bg-ivory-50/97 p-4 backdrop-blur-md',
          'shadow-[var(--shadow-raised)] sm:p-5',
        ],
        className,
      )}
    >
      <h2
        id="booking-search-title"
        className={cn(
          'mb-4 flex items-center gap-2 font-display text-xl text-chocolate-800',
          !panel && 'sr-only',
        )}
      >
        <CalendarDays className="size-5 text-brown-400" aria-hidden="true" />
        {dict.search.title}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Field
          id="search-check-in"
          label={dict.search.checkIn}
          error={
            touched && (stay.errors.includes('invalid_check_in') ||
              stay.errors.includes('check_in_in_past') ||
              stay.errors.includes('too_far_ahead'))
              ? stayError
              : undefined
          }
        >
          {(aria) => (
            <Input
              {...aria}
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => handleCheckInChange(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          )}
        </Field>

        <Field
          id="search-check-out"
          label={dict.search.checkOut}
          error={
            touched && (stay.errors.includes('invalid_check_out') ||
              stay.errors.includes('check_out_not_after_check_in') ||
              stay.errors.includes('stay_too_long'))
              ? stayError
              : undefined
          }
        >
          {(aria) => (
            <Input
              {...aria}
              type="date"
              value={checkOut}
              min={addDays(checkIn || today, 1)}
              max={addDays(checkIn || today, MAX_STAY_NIGHTS)}
              onChange={(e) => setCheckOut(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          )}
        </Field>

        <Field id="search-adults" label={dict.common.adults}>
          {(aria) => (
            <Select
              {...aria}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            >
              {range(1, MAX_ADULTS_PER_SEARCH).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="search-children" label={dict.common.children}>
            {(aria) => (
              <Select
                {...aria}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              >
                {range(0, MAX_CHILDREN_PER_SEARCH).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            id="search-rooms"
            label={dict.common.rooms}
            error={occupancyError}
          >
            {(aria) => (
              <Select
                {...aria}
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
              >
                {range(1, MAX_ROOMS_PER_SEARCH).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="flex items-end lg:col-start-5">
          <Button type="submit" size="lg" block className="lg:w-auto">
            <Search aria-hidden="true" />
            {dict.search.submit}
          </Button>
        </div>
      </div>

      {/* Live summary: confirms what the guest chose before they commit. */}
      <p
        aria-live="polite"
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brown-400"
      >
        {valid ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {formatDateRange(checkIn, checkOut, 'uz')} · {nights} {dict.common.nights}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              {adults} {dict.common.adults.toLowerCase()}
              {children > 0 ? `, ${children} ${dict.common.children.toLowerCase()}` : ''}
              {' · '}
              {rooms} {dict.common.rooms.toLowerCase()}
            </span>
          </>
        ) : (
          <span>Sanalarni va mehmonlar sonini tanlang.</span>
        )}
      </p>

      {/*
        Said once, plainly, right where the guest decides: this is a request,
        not an instant confirmation.
      */}
      <p className="mt-2 text-xs leading-relaxed text-brown-300">
        Saytdagi forma — bron soʻrovi. Mehmonxona uni koʻrib chiqib tasdiqlaydi.
      </p>
    </form>
  );
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Read search criteria out of a URL query string, with safe defaults. */
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

  const toInt = (value: string | undefined, fallback: number, max: number) => {
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
