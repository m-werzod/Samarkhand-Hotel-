import type { CurrencyCode, Money } from './types';

/**
 * Money is stored as an integer count of a currency's minor units. UZS has no
 * circulating subunit, so one minor unit is one so'm; USD and EUR use cents.
 *
 * Keeping everything in integers means no floating-point drift can creep into
 * a price a guest is shown.
 */
export const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { minorUnits: number; locale: string; symbol: string }
> = {
  UZS: { minorUnits: 0, locale: 'uz-UZ', symbol: "so'm" },
  USD: { minorUnits: 2, locale: 'en-US', symbol: '$' },
  EUR: { minorUnits: 2, locale: 'de-DE', symbol: '€' },
};

export class MoneyError extends Error {
  override name = 'MoneyError';
}

/** Construct a Money value, rejecting anything that is not a safe integer. */
export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new MoneyError(`Money amount must be an integer, received ${amount}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError('Money amount exceeds the safe integer range');
  }
  return { amount, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { amount: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      `Cannot combine ${a.currency} with ${b.currency}; convert first`,
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

/**
 * Multiply by an integer count (nights, rooms). Separate from `scaleMoney`
 * so the common case cannot silently introduce rounding.
 */
export function multiplyMoney(value: Money, factor: number): Money {
  if (!Number.isInteger(factor) || factor < 0) {
    throw new MoneyError(`Multiplier must be a non-negative integer, got ${factor}`);
  }
  return money(value.amount * factor, value.currency);
}

/**
 * Scale by an arbitrary ratio (a percentage, a tax rate).
 *
 * Rounds half away from zero — the convention guests expect, and the one that
 * never rounds a discount up into a larger discount than advertised.
 */
export function scaleMoney(value: Money, ratio: number): Money {
  if (!Number.isFinite(ratio)) {
    throw new MoneyError(`Scale ratio must be finite, got ${ratio}`);
  }
  const scaled = value.amount * ratio;
  const rounded =
    scaled < 0 ? -Math.round(Math.abs(scaled)) : Math.round(scaled);
  return money(rounded, value.currency);
}

/** Never let a computed amount fall below zero (e.g. an oversized discount). */
export function clampNonNegative(value: Money): Money {
  return value.amount < 0 ? zero(value.currency) : value;
}

export function minMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amount <= b.amount ? a : b;
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amount - b.amount;
}

/** Convert minor units to the major unit as a float — display only. */
export function toMajorUnits(value: Money): number {
  const { minorUnits } = CURRENCY_CONFIG[value.currency];
  return value.amount / 10 ** minorUnits;
}

/** Convert a major-unit figure (what an admin types) into storage form. */
export function fromMajorUnits(
  majorAmount: number,
  currency: CurrencyCode,
): Money {
  const { minorUnits } = CURRENCY_CONFIG[currency];
  const scaled = majorAmount * 10 ** minorUnits;
  return money(Math.round(scaled), currency);
}

/**
 * Format for display.
 *
 * UZS is rendered as `1 250 000 so'm` — the local convention places the unit
 * after the figure, and Intl's narrow symbol for UZS is not widely recognised.
 */
export function formatMoney(
  value: Money,
  options: { locale?: string; compact?: boolean; showCurrency?: boolean } = {},
): string {
  const config = CURRENCY_CONFIG[value.currency];
  const locale = options.locale ?? config.locale;
  const amount = toMajorUnits(value);

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: config.minorUnits,
    ...(options.compact && Math.abs(amount) >= 1_000_000
      ? { notation: 'compact' as const, maximumFractionDigits: 1 }
      : {}),
  }).format(amount);

  if (options.showCurrency === false) return formatted;

  return value.currency === 'UZS'
    ? `${formatted} ${config.symbol}`
    : `${config.symbol}${formatted}`;
}

/** Machine-readable form for structured data and CSV exports. */
export function formatMoneyPlain(value: Money): string {
  return toMajorUnits(value).toFixed(CURRENCY_CONFIG[value.currency].minorUnits);
}
