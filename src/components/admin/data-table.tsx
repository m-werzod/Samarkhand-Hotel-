import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Admin data display.
 *
 * Two presentations of the same rows: a real `<table>` from `md` up, and a
 * stack of cards below it. Rather than letting a table scroll sideways on a
 * phone — which hides columns behind a gesture nobody discovers — the caller
 * supplies a card renderer for narrow screens.
 *
 * Both come from the same data, so they cannot drift.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Hidden below `lg`, for columns that are nice-to-have. */
  secondary?: boolean;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  renderCard,
  empty,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  /** Narrow-screen presentation. */
  renderCard: (row: T) => React.ReactNode;
  empty: React.ReactNode;
  caption?: string;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <>
      {/* Cards, below md */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)}>{renderCard(row)}</li>
        ))}
      </ul>

      {/* Table, md and up */}
      <div className="hidden overflow-hidden rounded-lg border border-sand-300 bg-ivory-50 md:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-sand-300 bg-sand-200/50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-brown-400',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.secondary && 'hidden lg:table-cell',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="transition-colors hover:bg-sand-200/30"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-chocolate-700',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.secondary && 'hidden lg:table-cell',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Toolbar above a table: search, filters, actions. */
export function TableToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Pagination that states the range rather than just page numbers. */
export function TablePagination({
  total,
  offset,
  limit,
  buildHref,
}: {
  total: number;
  offset: number;
  limit: number;
  buildHref: (offset: number) => string;
}) {
  if (total <= limit) return null;

  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav
      aria-label="Sahifalash"
      className="mt-4 flex items-center justify-between gap-4"
    >
      <p className="text-sm text-brown-400" aria-live="polite">
        {from}–{to} / {total}
      </p>
      <div className="flex gap-2">
        <PageLink
          href={buildHref(Math.max(offset - limit, 0))}
          disabled={!hasPrev}
          label="Oldingi"
        />
        <PageLink
          href={buildHref(offset + limit)}
          disabled={!hasNext}
          label="Keyingi"
        />
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  const classes =
    'inline-flex h-10 items-center rounded-md border border-sand-300 px-4 text-sm font-medium transition-colors';

  // A disabled control must not be a link: a focusable link that does nothing
  // is worse than one that is plainly inert.
  if (disabled) {
    return (
      <span className={cn(classes, 'cursor-not-allowed text-brown-300 opacity-60')}>
        {label}
      </span>
    );
  }

  return (
    <a href={href} className={cn(classes, 'text-chocolate-700 hover:bg-sand-200')}>
      {label}
    </a>
  );
}
