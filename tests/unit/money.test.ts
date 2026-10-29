import { describe, expect, it } from 'vitest';

import {
  CURRENCY_CONFIG,
  MoneyError,
  addMoney,
  clampNonNegative,
  formatMoney,
  formatMoneyPlain,
  fromMajorUnits,
  money,
  multiplyMoney,
  scaleMoney,
  subtractMoney,
  toMajorUnits,
  zero,
} from '@/lib/domain/money';

describe('money construction', () => {
  it('accepts integer minor units', () => {
    expect(money(520_000, 'UZS')).toEqual({ amount: 520_000, currency: 'UZS' });
  });

  it('rejects fractional amounts, which is how float drift gets in', () => {
    expect(() => money(10.5, 'UZS')).toThrow(MoneyError);
  });

  it('rejects amounts beyond the safe integer range', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 2, 'UZS')).toThrow(MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts within a currency', () => {
    const a = money(1000, 'UZS');
    const b = money(250, 'UZS');
    expect(addMoney(a, b).amount).toBe(1250);
    expect(subtractMoney(a, b).amount).toBe(750);
  });

  it('refuses to mix currencies rather than silently converting', () => {
    expect(() => addMoney(money(100, 'UZS'), money(100, 'USD'))).toThrow(MoneyError);
  });

  it('multiplies only by non-negative integers', () => {
    expect(multiplyMoney(money(100, 'UZS'), 3).amount).toBe(300);
    expect(() => multiplyMoney(money(100, 'UZS'), 2.5)).toThrow(MoneyError);
    expect(() => multiplyMoney(money(100, 'UZS'), -1)).toThrow(MoneyError);
  });

  it('rounds half away from zero when scaling', () => {
    // 0.5 must round to 1, not to 0 (banker's rounding would give 0).
    expect(scaleMoney(money(1, 'UZS'), 0.5).amount).toBe(1);
    expect(scaleMoney(money(3, 'UZS'), 0.5).amount).toBe(2);
    expect(scaleMoney(money(-1, 'UZS'), 0.5).amount).toBe(-1);
  });

  it('clamps negatives to zero', () => {
    expect(clampNonNegative(money(-500, 'UZS'))).toEqual(zero('UZS'));
    expect(clampNonNegative(money(500, 'UZS')).amount).toBe(500);
  });
});

describe('major/minor unit conversion', () => {
  it('treats UZS as having no subunit', () => {
    expect(CURRENCY_CONFIG.UZS.minorUnits).toBe(0);
    expect(fromMajorUnits(780_000, 'UZS').amount).toBe(780_000);
    expect(toMajorUnits(money(780_000, 'UZS'))).toBe(780_000);
  });

  it('treats USD as cents', () => {
    expect(fromMajorUnits(12.34, 'USD').amount).toBe(1234);
    expect(toMajorUnits(money(1234, 'USD'))).toBe(12.34);
  });

  it('rounds a fractional major amount rather than truncating', () => {
    expect(fromMajorUnits(12.345, 'USD').amount).toBe(1235);
  });
});

describe('formatting', () => {
  it('puts the unit after the figure for UZS', () => {
    // Non-breaking spaces throughout, so a price never wraps mid-number.
    expect(formatMoney(money(1_250_000, 'UZS'))).toBe('1 250 000 so\'m');
  });

  it('puts the symbol before the figure for USD', () => {
    expect(formatMoney(money(123_456, 'USD'))).toBe('$1,234.56');
  });

  it('can omit the currency', () => {
    expect(formatMoney(money(1_000, 'UZS'), { showCurrency: false })).toBe('1 000');
  });

  it('compacts large amounts', () => {
    expect(formatMoney(money(2_500_000, 'UZS'), { compact: true })).toContain('mln');
  });

  it('is byte-identical regardless of the host ICU build', () => {
    // Regression guard: Intl.NumberFormat for uz-UZ differs between Node and
    // browsers, which caused a hydration mismatch. The output must not
    // depend on locale data at all.
    const formatted = formatMoney(money(1_000_000, 'UZS'));
    expect(formatted).toBe('1 000 000 so\'m');
    expect(formatted).not.toMatch(/[,.]/);
  });

  it('formats a machine-readable value for structured data', () => {
    expect(formatMoneyPlain(money(780_000, 'UZS'))).toBe('780000');
    expect(formatMoneyPlain(money(1234, 'USD'))).toBe('12.34');
  });

  it('formats zero without a sign', () => {
    expect(formatMoney(zero('UZS'))).toBe('0 so\'m');
  });
});
