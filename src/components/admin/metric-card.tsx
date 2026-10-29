import { Info, MinusCircle } from 'lucide-react';

import { Card } from '@/components/ui/surface';
import { formatMoney } from '@/lib/domain/money';
import { metricMoney, type MetricValue } from '@/lib/analytics/metrics';
import { cn } from '@/lib/utils';

/**
 * A single dashboard metric.
 *
 * A metric the data cannot support renders as an explicit, explained blank —
 * not a zero. "0 confirmed bookings" and "we cannot compute this yet" are
 * different statements, and an operator will act on them differently.
 *
 * The formula is attached to every card so there is no ambiguity about what
 * the number counts.
 */
export function MetricCard({
  metric,
  className,
}: {
  metric: MetricValue;
  className?: string;
}) {
  const money = metricMoney(metric);
  const unavailable = metric.value === null;

  const display = unavailable
    ? null
    : money
      ? formatMoney(money, { compact: true })
      : metric.format === 'percent'
        ? `${metric.value}%`
        : new Intl.NumberFormat('en-US').format(metric.value ?? 0).replace(/,/g, ' ');

  return (
    <Card tone="plain" className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-brown-400">
          {metric.label}
        </p>
        <span
          className="shrink-0 text-brown-300"
          title={metric.formula}
          aria-label={`Hisoblash usuli: ${metric.formula}`}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </span>
      </div>

      {unavailable ? (
        <div className="mt-2 flex items-center gap-2 text-brown-300">
          <MinusCircle className="size-5" aria-hidden="true" />
          <span className="font-display text-xl">Maʼlumot yetarli emas</span>
        </div>
      ) : (
        <p className="mt-1.5 font-display text-3xl tabular-nums text-chocolate-800">
          {display}
        </p>
      )}

      <p className="mt-2 text-[0.6875rem] leading-relaxed text-brown-300">
        {unavailable ? (metric.unavailableReason ?? metric.formula) : metric.formula}
      </p>
    </Card>
  );
}
