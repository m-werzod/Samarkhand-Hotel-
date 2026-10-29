import { describe, expect, it } from 'vitest';

import {
  MAX_DISCOUNT_PERCENT,
  PricingError,
  calculateStayPrice,
  discountFor,
  displayPriceForRoom,
  isOfferApplicable,
  selectBestOffer,
} from '@/lib/domain/pricing';
import { money } from '@/lib/domain/money';
import type { Offer, Room } from '@/lib/domain/types';

const NOW = new Date('2026-03-15T12:00:00.000Z');

const room = (overrides: Partial<Room> = {}): Room =>
  ({
    id: 'room-deluxe',
    slug: 'deluxe',
    name: 'Deluxe',
    shortDescription: '',
    description: '',
    maxOccupancy: 3,
    maxAdults: 2,
    maxChildren: 2,
    bedConfiguration: 'king',
    sizeSqm: 32,
    basePrice: money(1_000_000, 'UZS'),
    status: 'published',
    sortOrder: 1,
    inventoryCount: 5,
    cancellationPolicy: null,
    isDemoData: false,
    amenityIds: [],
    mediaIds: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }) as Room;

const offer = (overrides: Partial<Offer> = {}): Offer =>
  ({
    id: 'offer-a',
    name: 'Offer A',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    eligibleRoomIds: [],
    startsAt: null,
    endsAt: null,
    minimumNights: 1,
    conditions: null,
    status: 'published',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }) as Offer;

const NO_TAX = { taxRatePercent: 0, serviceFeeMinor: 0 };

/* -------------------------------------------------------------------------- */

describe('offer eligibility', () => {
  it('ignores unpublished offers', () => {
    expect(isOfferApplicable(offer({ status: 'draft' }), room(), 3, NOW)).toBe(false);
  });

  it('respects the minimum stay', () => {
    const o = offer({ minimumNights: 3 });
    expect(isOfferApplicable(o, room(), 2, NOW)).toBe(false);
    expect(isOfferApplicable(o, room(), 3, NOW)).toBe(true);
  });

  it('is not yet applicable before its start', () => {
    const o = offer({ startsAt: '2026-04-01T00:00:00.000Z' });
    expect(isOfferApplicable(o, room(), 1, NOW)).toBe(false);
  });

  it('stops applying at its end, which is exclusive', () => {
    const endsAt = NOW.toISOString();
    expect(isOfferApplicable(offer({ endsAt }), room(), 1, NOW)).toBe(false);
  });

  it('an empty room list means every room', () => {
    expect(isOfferApplicable(offer({ eligibleRoomIds: [] }), room(), 1, NOW)).toBe(true);
  });

  it('a non-empty room list excludes other rooms', () => {
    const o = offer({ eligibleRoomIds: ['room-suite'] });
    expect(isOfferApplicable(o, room({ id: 'room-deluxe' }), 1, NOW)).toBe(false);
    expect(isOfferApplicable(o, room({ id: 'room-suite' }), 1, NOW)).toBe(true);
  });
});

describe('discount calculation', () => {
  it('computes a percentage of the subtotal', () => {
    const result = discountFor(offer({ discountValue: 15 }), money(1_000_000, 'UZS'));
    expect(result.amount).toBe(150_000);
  });

  it('caps a percentage at the maximum, however it was configured', () => {
    const result = discountFor(
      offer({ discountValue: 500 }),
      money(1_000_000, 'UZS'),
    );
    expect(result.amount).toBe((1_000_000 * MAX_DISCOUNT_PERCENT) / 100);
  });

  it('never lets a fixed discount exceed the subtotal', () => {
    const result = discountFor(
      offer({ discountType: 'fixed', discountValue: 5_000_000 }),
      money(1_000_000, 'UZS'),
    );
    expect(result.amount).toBe(1_000_000);
  });

  it('treats a negative discount as zero', () => {
    const result = discountFor(
      offer({ discountType: 'fixed', discountValue: -100 }),
      money(1_000_000, 'UZS'),
    );
    expect(result.amount).toBe(0);
  });
});

describe('offer selection: discounts never stack', () => {
  it('picks the single offer worth most to the guest', () => {
    const offers = [
      offer({ id: 'small', discountValue: 10 }),
      offer({ id: 'big', discountValue: 25 }),
      offer({ id: 'mid', discountValue: 15 }),
    ];
    const best = selectBestOffer(offers, room(), money(1_000_000, 'UZS'), 1, NOW);
    expect(best?.offer.id).toBe('big');
    expect(best?.discount.amount).toBe(250_000);
  });

  it('prefers a percentage when two offers are worth the same today', () => {
    const offers = [
      offer({ id: 'fixed', discountType: 'fixed', discountValue: 100_000 }),
      offer({ id: 'percent', discountType: 'percentage', discountValue: 10 }),
    ];
    const best = selectBestOffer(offers, room(), money(1_000_000, 'UZS'), 1, NOW);
    expect(best?.offer.id).toBe('percent');
  });

  it('breaks a further tie by the earliest start, then deterministically by id', () => {
    const offers = [
      offer({ id: 'b', startsAt: '2026-02-01T00:00:00.000Z' }),
      offer({ id: 'a', startsAt: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(selectBestOffer(offers, room(), money(1_000_000, 'UZS'), 1, NOW)?.offer.id).toBe(
      'a',
    );

    const sameStart = [offer({ id: 'z' }), offer({ id: 'a' })];
    expect(
      selectBestOffer(sameStart, room(), money(1_000_000, 'UZS'), 1, NOW)?.offer.id,
    ).toBe('a');
  });

  it('returns null when nothing applies', () => {
    expect(selectBestOffer([], room(), money(1_000_000, 'UZS'), 1, NOW)).toBeNull();
    expect(
      selectBestOffer(
        [offer({ status: 'draft' })],
        room(),
        money(1_000_000, 'UZS'),
        1,
        NOW,
      ),
    ).toBeNull();
  });
});

describe('stay price calculation', () => {
  it('multiplies by nights and rooms', () => {
    const result = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-04', rooms: 2 },
      [],
      NO_TAX,
      NOW,
    );
    expect(result.nights).toBe(3);
    expect(result.subtotal.amount).toBe(6_000_000);
    expect(result.total.amount).toBe(6_000_000);
  });

  it('applies tax to the discounted amount, not the gross', () => {
    const result = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-02', rooms: 1 },
      [offer({ discountValue: 50 })],
      { taxRatePercent: 10, serviceFeeMinor: 0 },
      NOW,
    );
    expect(result.subtotal.amount).toBe(1_000_000);
    expect(result.discount.amount).toBe(500_000);
    // 10% of 500 000, not of 1 000 000.
    expect(result.taxes.amount).toBe(50_000);
    expect(result.total.amount).toBe(550_000);
  });

  it('adds the service fee after tax, so the fee is not taxed', () => {
    const result = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-02', rooms: 1 },
      [],
      { taxRatePercent: 10, serviceFeeMinor: 50_000 },
      NOW,
    );
    expect(result.taxes.amount).toBe(100_000);
    expect(result.fees.amount).toBe(50_000);
    expect(result.total.amount).toBe(1_150_000);
  });

  it('records which offer was applied, for later auditing', () => {
    const result = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-05', rooms: 1 },
      [offer({ id: 'early', name: 'Early bird', discountValue: 15 })],
      NO_TAX,
      NOW,
    );
    expect(result.appliedOfferId).toBe('early');
    expect(result.appliedOfferName).toBe('Early bird');
  });

  it('cannot produce a negative total even with an oversized fixed discount', () => {
    const result = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-02', rooms: 1 },
      [offer({ discountType: 'fixed', discountValue: 99_000_000 })],
      { taxRatePercent: 12, serviceFeeMinor: 0 },
      NOW,
    );
    expect(result.total.amount).toBe(0);
  });

  it('rejects a stay of less than one night', () => {
    expect(() =>
      calculateStayPrice(
        room(),
        { checkIn: '2026-04-01', checkOut: '2026-04-01', rooms: 1 },
        [],
        NO_TAX,
        NOW,
      ),
    ).toThrow(PricingError);
  });

  it('rejects a non-integer room count', () => {
    expect(() =>
      calculateStayPrice(
        room(),
        { checkIn: '2026-04-01', checkOut: '2026-04-02', rooms: 1.5 },
        [],
        NO_TAX,
        NOW,
      ),
    ).toThrow(PricingError);
  });

  it('only applies a long-stay offer once the stay is long enough', () => {
    const offers = [offer({ id: 'long', discountValue: 22, minimumNights: 7 })];

    const short = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-04', rooms: 1 },
      offers,
      NO_TAX,
      NOW,
    );
    expect(short.appliedOfferId).toBeNull();

    const long = calculateStayPrice(
      room(),
      { checkIn: '2026-04-01', checkOut: '2026-04-08', rooms: 1 },
      offers,
      NO_TAX,
      NOW,
    );
    expect(long.appliedOfferId).toBe('long');
  });
});

describe('display price', () => {
  it('shows the original price only when a discount applies', () => {
    const plain = displayPriceForRoom(room(), [], NOW);
    expect(plain.originalNightly).toBeNull();
    expect(plain.discountPercent).toBeNull();

    const discounted = displayPriceForRoom(room(), [offer({ discountValue: 20 })], NOW);
    expect(discounted.nightly.amount).toBe(800_000);
    expect(discounted.originalNightly?.amount).toBe(1_000_000);
    expect(discounted.discountPercent).toBe(20);
  });

  it('ignores offers that need more than one night', () => {
    const result = displayPriceForRoom(
      room(),
      [offer({ discountValue: 30, minimumNights: 5 })],
      NOW,
    );
    expect(result.originalNightly).toBeNull();
  });

  it('names the offer so the room page can say which one applied', () => {
    const result = displayPriceForRoom(
      room(),
      [offer({ name: 'Autumn', discountValue: 10 })],
      NOW,
    );
    expect(result.offerName).toBe('Autumn');
  });
});
