import {
  addMoney,
  clampNonNegative,
  minMoney,
  money,
  multiplyMoney,
  scaleMoney,
  subtractMoney,
  zero,
} from './money';
import { nightsBetween } from './dates';
import type {
  CalendarDate,
  Money,
  Offer,
  PriceBreakdown,
  Room,
  Timestamp,
} from './types';

/**
 * Price calculation.
 *
 * Two rules matter more than anything else here:
 *
 *  1. **Discounts never stack.** Exactly one offer applies to a stay — the one
 *     worth most to the guest. Stacking is how a hotel accidentally sells a
 *     room for nothing, and how a guest ends up seeing a price the hotel will
 *     not honour.
 *  2. **The server is the authority.** The client may compute a preview for
 *     responsiveness, but the figure persisted on a booking is always
 *     recomputed here from the stored room and offer records.
 */

export const MAX_DISCOUNT_PERCENT = 90;

export interface PricingSettings {
  taxRatePercent: number;
  serviceFeeMinor: number;
}

export interface StayRequest {
  checkIn: CalendarDate;
  checkOut: CalendarDate;
  rooms: number;
}

/* -------------------------------------------------------------------------- */
/* Offer eligibility                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Is this offer live and applicable to the given room and stay?
 *
 * An offer's window is checked against the moment of pricing, not the stay
 * dates: "book by 30 November for a December stay" is the common shape, and
 * the hotel controls stay restrictions through `minimumNights` and conditions.
 */
export function isOfferApplicable(
  offer: Offer,
  room: Pick<Room, 'id'>,
  nights: number,
  now: Date = new Date(),
): boolean {
  if (offer.status !== 'published') return false;
  if (nights < offer.minimumNights) return false;

  const nowMs = now.getTime();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > nowMs) return false;
  if (offer.endsAt && new Date(offer.endsAt).getTime() <= nowMs) return false;

  // An empty eligibility list means "every published room".
  if (offer.eligibleRoomIds.length > 0 && !offer.eligibleRoomIds.includes(room.id)) {
    return false;
  }

  return true;
}

/**
 * What a single offer is worth against a subtotal.
 *
 * Percentage discounts are capped at MAX_DISCOUNT_PERCENT and fixed discounts
 * can never exceed the subtotal, so a misconfigured offer cannot produce a
 * negative price.
 */
export function discountFor(offer: Offer, subtotal: Money): Money {
  if (offer.discountType === 'percentage') {
    const pct = Math.min(Math.max(offer.discountValue, 0), MAX_DISCOUNT_PERCENT);
    return scaleMoney(subtotal, pct / 100);
  }

  const fixed = money(
    Math.max(Math.round(offer.discountValue), 0),
    subtotal.currency,
  );
  return minMoney(fixed, subtotal);
}

/**
 * Pick the single best offer for a stay.
 *
 * Precedence, in order:
 *   1. Largest discount for the guest.
 *   2. On a tie, percentage beats fixed (it scales with longer stays).
 *   3. On a further tie, the offer that started earliest — the hotel's
 *      standing promise outranks a newer one worth the same.
 *   4. Finally by id, so the result is deterministic and testable.
 */
export function selectBestOffer(
  offers: Offer[],
  room: Pick<Room, 'id'>,
  subtotal: Money,
  nights: number,
  now: Date = new Date(),
): { offer: Offer; discount: Money } | null {
  const candidates = offers
    .filter((offer) => isOfferApplicable(offer, room, nights, now))
    .map((offer) => ({ offer, discount: discountFor(offer, subtotal) }))
    .filter((candidate) => candidate.discount.amount > 0);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.discount.amount !== b.discount.amount) {
      return b.discount.amount - a.discount.amount;
    }
    if (a.offer.discountType !== b.offer.discountType) {
      return a.offer.discountType === 'percentage' ? -1 : 1;
    }
    const aStart = startMs(a.offer.startsAt);
    const bStart = startMs(b.offer.startsAt);
    if (aStart !== bStart) return aStart - bStart;
    return a.offer.id.localeCompare(b.offer.id);
  });

  // Non-null: `candidates` is known non-empty above.
  return candidates[0]!;
}

function startMs(value: Timestamp | null): number {
  // A null start means "always on", which sorts before any dated offer.
  return value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
}

/* -------------------------------------------------------------------------- */
/* The calculation                                                             */
/* -------------------------------------------------------------------------- */

export class PricingError extends Error {
  override name = 'PricingError';
}

/**
 * Compute the full price breakdown for a stay.
 *
 * Order of operations is deliberate and matches how the total is explained to
 * the guest: subtotal, then discount, then tax on the discounted amount, then
 * flat fees. Taxing before the discount would overcharge; adding fees before
 * tax would tax the fee.
 */
export function calculateStayPrice(
  room: Pick<Room, 'id' | 'basePrice'>,
  stay: StayRequest,
  offers: Offer[],
  settings: PricingSettings,
  now: Date = new Date(),
): PriceBreakdown {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (nights < 1) {
    throw new PricingError('A stay must cover at least one night');
  }
  if (!Number.isInteger(stay.rooms) || stay.rooms < 1) {
    throw new PricingError('Room count must be a positive integer');
  }

  const currency = room.basePrice.currency;
  const nightlyRate = room.basePrice;
  const subtotal = multiplyMoney(nightlyRate, nights * stay.rooms);

  const best = selectBestOffer(offers, room, subtotal, nights, now);
  const discount = best ? best.discount : zero(currency);
  const discounted = clampNonNegative(subtractMoney(subtotal, discount));

  const taxRate = Math.max(settings.taxRatePercent, 0) / 100;
  const taxes = taxRate > 0 ? scaleMoney(discounted, taxRate) : zero(currency);

  const fees =
    settings.serviceFeeMinor > 0
      ? money(Math.round(settings.serviceFeeMinor), currency)
      : zero(currency);

  const total = addMoney(addMoney(discounted, taxes), fees);

  return {
    nights,
    rooms: stay.rooms,
    nightlyRate,
    subtotal,
    discount,
    appliedOfferId: best?.offer.id ?? null,
    appliedOfferName: best?.offer.name ?? null,
    taxes,
    fees,
    total,
  };
}

/* -------------------------------------------------------------------------- */
/* Display pricing (room cards, listings)                                      */
/* -------------------------------------------------------------------------- */

export interface DisplayPrice {
  /** What the guest pays per night after any offer. */
  nightly: Money;
  /** The pre-discount rate, present only when an offer applies. */
  originalNightly: Money | null;
  discountPercent: number | null;
  offerName: string | null;
}

/**
 * The headline "from" price for a room card: one night, one room.
 *
 * Shown without tax or fees, which is the convention for a nightly rate — the
 * booking summary then itemises everything before the guest commits.
 */
export function displayPriceForRoom(
  room: Pick<Room, 'id' | 'basePrice'>,
  offers: Offer[],
  now: Date = new Date(),
): DisplayPrice {
  const subtotal = room.basePrice;
  const best = selectBestOffer(offers, room, subtotal, 1, now);

  if (!best || best.discount.amount <= 0) {
    return {
      nightly: subtotal,
      originalNightly: null,
      discountPercent: null,
      offerName: null,
    };
  }

  const discounted = clampNonNegative(subtractMoney(subtotal, best.discount));
  const percent =
    subtotal.amount > 0
      ? Math.round((best.discount.amount / subtotal.amount) * 100)
      : null;

  return {
    nightly: discounted,
    originalNightly: subtotal,
    discountPercent: percent,
    offerName: best.offer.name,
  };
}
