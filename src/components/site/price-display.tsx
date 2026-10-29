import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/domain/money';
import type { DisplayPrice } from '@/lib/domain/pricing';
import type { Money } from '@/lib/domain/types';

/**
 * A nightly rate, with the pre-discount figure struck through when an offer
 * applies.
 *
 * The original price is marked up with `<s>` and given an explicit
 * screen-reader label, because a strikethrough communicates nothing to a
 * non-visual reader — "was 780 000, now 663 000" has to be said in words.
 */
export function PriceDisplay({
  price,
  size = 'md',
  tone = 'light',
  className,
}: {
  price: DisplayPrice;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const discounted = price.originalNightly !== null;

  const sizes = {
    sm: { main: 'text-lg', sub: 'text-xs' },
    md: { main: 'text-2xl', sub: 'text-xs' },
    lg: { main: 'text-3xl sm:text-4xl', sub: 'text-sm' },
  }[size];

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {discounted && price.originalNightly ? (
        <s
          className={cn(
            sizes.sub,
            tone === 'dark' ? 'text-ivory-100/55' : 'text-brown-300',
          )}
        >
          <span className="sr-only">Avvalgi narx:</span>
          {formatMoney(price.originalNightly)}
        </s>
      ) : null}

      <p
        className={cn(
          'font-display leading-none',
          sizes.main,
          tone === 'dark' ? 'text-ivory-50' : 'text-chocolate-800',
        )}
      >
        {discounted ? <span className="sr-only">Chegirmali narx:</span> : null}
        {formatMoney(price.nightly)}
      </p>

      <p
        className={cn(
          sizes.sub,
          tone === 'dark' ? 'text-ivory-100/65' : 'text-brown-400',
        )}
      >
        bir kecha uchun
      </p>
    </div>
  );
}

/** A single itemised line in the booking summary. */
export function PriceLine({
  label,
  value,
  emphasis = false,
  note,
}: {
  label: string;
  value: Money | string;
  emphasis?: boolean;
  note?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-2',
        emphasis && 'border-t border-sand-300 pt-3 font-medium',
      )}
    >
      <span
        className={cn(
          emphasis ? 'text-base text-chocolate-800' : 'text-sm text-brown-400',
        )}
      >
        {label}
        {note ? (
          <span className="mt-0.5 block text-xs text-brown-300">{note}</span>
        ) : null}
      </span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          emphasis
            ? 'font-display text-xl text-chocolate-800'
            : 'text-sm text-chocolate-700',
        )}
      >
        {typeof value === 'string' ? value : formatMoney(value)}
      </span>
    </div>
  );
}
