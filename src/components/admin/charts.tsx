import { Card, EmptyState } from '@/components/ui/surface';
import { formatDateForDisplay } from '@/lib/domain/dates';
import { cn } from '@/lib/utils';

/**
 * Charts, drawn as inline SVG.
 *
 * A charting library would add roughly 100KB of JavaScript to an admin page
 * that shows two charts of at most ninety points each. These render on the
 * server, ship no JavaScript at all, and are readable without it.
 *
 * Every chart carries a table-shaped accessible alternative: a visually
 * hidden `<table>` with the same numbers, because a chart with only a
 * summary label is not an equivalent for someone using a screen reader.
 */

const PALETTE = {
  line: '#6B4226',
  fill: 'rgba(107, 66, 38, 0.12)',
  grid: '#E3D5BF',
  axis: '#A9784B',
};

/* -------------------------------------------------------------------------- */
/* Trend                                                                       */
/* -------------------------------------------------------------------------- */

export function TrendChart({
  data,
  title,
  description,
  emptyMessage = 'Bu davr uchun maʼlumot yoʻq.',
}: {
  data: { date: string; count: number }[];
  title: string;
  description?: string;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return (
      <Card tone="plain" className="p-5">
        <ChartHeading title={title} description={description} />
        <EmptyState title={emptyMessage} className="mt-4 py-10" />
      </Card>
    );
  }

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 28, left: 36 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.count), 1);
  // Round the axis up to something readable rather than to the raw maximum.
  const ceiling = niceCeiling(max);

  const x = (index: number) =>
    padding.left + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value: number) => padding.top + plotH - (value / ceiling) * plotH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.count)}`).join(' ');
  const area = `${line} L ${x(data.length - 1)} ${padding.top + plotH} L ${x(0)} ${padding.top + plotH} Z`;

  const ticks = [0, ceiling / 2, ceiling];

  return (
    <Card tone="plain" className="p-5">
      <ChartHeading title={title} description={description} />

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. Eng yuqori qiymat: ${max}.`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={PALETTE.grid}
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill={PALETTE.axis}
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        <path d={area} fill={PALETTE.fill} />
        <path
          d={line}
          fill="none"
          stroke={PALETTE.line}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={y(d.count)} r="3" fill={PALETTE.line} />
        ))}

        {/* Only first, middle and last labels: more would overlap. */}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1]
          .filter((i, idx, arr) => arr.indexOf(i) === idx && data[i])
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill={PALETTE.axis}
            >
              {formatDateForDisplay(data[i]!.date, 'uz', {
                day: 'numeric',
                month: 'short',
              })}
            </text>
          ))}
      </svg>

      <AccessibleTable
        caption={title}
        head={['Sana', 'Soni']}
        rows={data.map((d) => [
          formatDateForDisplay(d.date, 'uz', { day: 'numeric', month: 'long' }),
          String(d.count),
        ])}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Horizontal bars                                                             */
/* -------------------------------------------------------------------------- */

export function BarList({
  data,
  title,
  description,
  valueLabel = 'Soni',
  emptyMessage = 'Maʼlumot yoʻq.',
}: {
  data: { label: string; value: number; secondary?: string }[];
  title: string;
  description?: string;
  valueLabel?: string;
  emptyMessage?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card tone="plain" className="p-5">
      <ChartHeading title={title} description={description} />

      {data.length === 0 ? (
        <EmptyState title={emptyMessage} className="mt-4 py-10" />
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-chocolate-800">{item.label}</span>
                <span className="shrink-0 tabular-nums text-brown-400">
                  {item.value}
                  {item.secondary ? (
                    <span className="ml-2 text-xs text-brown-300">{item.secondary}</span>
                  ) : null}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand-200"
                role="img"
                aria-label={`${item.label}: ${item.value} ${valueLabel}`}
              >
                <div
                  className="h-full rounded-full bg-brown-500"
                  style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Status breakdown                                                            */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-600',
  confirmed: 'bg-success-600',
  cancelled: 'bg-danger-600',
  completed: 'bg-info-600',
};

export function StatusBreakdown({
  data,
  title,
}: {
  data: { key: string; label: string; value: number }[];
  title: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card tone="plain" className="p-5">
      <ChartHeading title={title} />

      {total === 0 ? (
        <EmptyState
          title="Hali bron soʻrovi yoʻq"
          description="Birinchi soʻrov kelganda bu yerda taqsimot koʻrinadi."
          className="mt-4 py-10"
        />
      ) : (
        <>
          <div
            className="mt-4 flex h-3 overflow-hidden rounded-full bg-sand-200"
            role="img"
            aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}
          >
            {data
              .filter((d) => d.value > 0)
              .map((d) => (
                <div
                  key={d.key}
                  className={cn('h-full', STATUS_COLORS[d.key] ?? 'bg-brown-400')}
                  style={{ width: `${(d.value / total) * 100}%` }}
                />
              ))}
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.map((d) => (
              <li key={d.key}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      STATUS_COLORS[d.key] ?? 'bg-brown-400',
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-brown-400">{d.label}</span>
                </div>
                <p className="mt-0.5 font-display text-xl tabular-nums text-chocolate-800">
                  {d.value}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function ChartHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="font-display text-lg text-chocolate-800">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-xs leading-relaxed text-brown-400">{description}</p>
      ) : null}
    </div>
  );
}

/** The non-visual equivalent of a chart. */
function AccessibleTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Round an axis maximum up to 1/2/5 × 10^n so gridlines land on round numbers. */
function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}
