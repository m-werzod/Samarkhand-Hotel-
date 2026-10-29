'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';

import { TableToolbar } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { BOOKING_STATUS_LABELS } from '@/lib/domain/booking';
import { BOOKING_STATUSES, type BookingStatus } from '@/lib/domain/types';

/**
 * The booking list's filter bar.
 *
 * A Client Component by necessity, not by preference: `Field` takes a render
 * prop, and a function cannot cross the server/client boundary as a prop. The
 * page itself stays a Server Component and this is the only part that ships.
 *
 * It is a plain GET form, so the result is a shareable, bookmarkable URL and
 * it works with JavaScript disabled.
 */
export function BookingFilters({
  search,
  status,
  from,
  to,
}: {
  search: string;
  status: BookingStatus | null;
  from: string;
  to: string;
}) {
  const hasFilters = Boolean(search || status || from || to);

  return (
    <form method="get" action="/admin/bookings">
      <TableToolbar>
        <Field id="filter-q" label="Qidirish" className="sm:w-64">
          {(aria) => (
            <Input
              {...aria}
              name="q"
              defaultValue={search}
              placeholder="Raqam, ism, email yoki telefon"
            />
          )}
        </Field>

        <Field id="filter-status" label="Holat" className="sm:w-44">
          {(aria) => (
            <Select {...aria} name="status" defaultValue={status ?? ''}>
              <option value="">Barchasi</option>
              {BOOKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {BOOKING_STATUS_LABELS[value].uz}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field id="filter-from" label="Kelish (dan)" className="sm:w-40">
          {(aria) => <Input {...aria} type="date" name="from" defaultValue={from} />}
        </Field>

        <Field id="filter-to" label="Kelish (gacha)" className="sm:w-40">
          {(aria) => <Input {...aria} type="date" name="to" defaultValue={to} />}
        </Field>

        <div className="flex gap-2">
          <Button type="submit" size="md">
            <Search aria-hidden="true" />
            Filtrlash
          </Button>
          {hasFilters ? (
            <Button asChild variant="ghost" size="md">
              <Link href="/admin/bookings">Tozalash</Link>
            </Button>
          ) : null}
        </div>
      </TableToolbar>
    </form>
  );
}
