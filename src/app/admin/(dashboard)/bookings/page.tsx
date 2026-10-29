import Link from 'next/link';
import { CalendarCheck, Download } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { BookingFilters } from '@/components/admin/booking-filters';
import {
  DataTable,
  TablePagination,
  type Column,
} from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { BOOKING_STATUS_LABELS } from '@/lib/domain/booking';
import { formatDateRange } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { formatPhoneForDisplay } from '@/lib/domain/contact';
import { BOOKING_STATUSES, type Booking, type BookingStatus } from '@/lib/domain/types';

const PAGE_SIZE = 25;

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole('viewer');
  const params = await searchParams;

  const read = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? '';
  };

  const search = read('q');
  const statusParam = read('status');
  const status = BOOKING_STATUSES.includes(statusParam as BookingStatus)
    ? (statusParam as BookingStatus)
    : null;
  const from = read('from');
  const to = read('to');
  const offset = Math.max(Number.parseInt(read('offset'), 10) || 0, 0);

  const store = getStore();
  const [result, rooms] = await Promise.all([
    store.listBookings({
      search: search || undefined,
      statuses: status ? [status] : undefined,
      checkInFrom: from || undefined,
      checkInTo: to || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    store.listRooms(),
  ]);

  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  const buildHref = (nextOffset: number): string => {
    const query = new URLSearchParams();
    if (search) query.set('q', search);
    if (status) query.set('status', status);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (nextOffset > 0) query.set('offset', String(nextOffset));
    const qs = query.toString();
    return qs ? `/admin/bookings?${qs}` : '/admin/bookings';
  };

  const columns: Column<Booking>[] = [
    {
      key: 'reference',
      header: 'Soʻrov',
      render: (booking) => (
        <Link
          href={`/admin/bookings/${booking.id}`}
          className="font-mono text-sm font-medium text-chocolate-800 hover:underline"
        >
          {booking.reference}
        </Link>
      ),
    },
    {
      key: 'guest',
      header: 'Mehmon',
      render: (booking) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-chocolate-800">
            {booking.guest.fullName}
          </p>
          <p className="truncate text-xs text-brown-300">
            {formatPhoneForDisplay(booking.guest.phone)}
          </p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Xona',
      secondary: true,
      render: (booking) => roomNames.get(booking.roomId) ?? booking.roomId,
    },
    {
      key: 'dates',
      header: 'Sanalar',
      render: (booking) => (
        <span className="whitespace-nowrap text-sm">
          {formatDateRange(booking.checkIn, booking.checkOut, 'uz')}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Taxminiy',
      align: 'right',
      secondary: true,
      render: (booking) => (
        <span className="tabular-nums">{formatMoney(booking.priceEstimate)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      align: 'right',
      render: (booking) => {
        const label = BOOKING_STATUS_LABELS[booking.status];
        return <Badge tone={label.tone}>{label.uz}</Badge>;
      },
    },
  ];

  const exportHref = `/admin/bookings/export?${new URLSearchParams({
    ...(search ? { q: search } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString()}`;

  return (
    <>
      <AdminPageHeader
        title="Bron soʻrovlari"
        description="Mehmonlar yuborgan soʻrovlar. Holatni oʻzgartirish uchun soʻrovni oching."
        actions={
          <Button asChild variant="outline" size="md">
            <a href={exportHref}>
              <Download aria-hidden="true" />
              CSV yuklab olish
            </a>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <BookingFilters search={search} status={status} from={from} to={to} />

        <DataTable
          rows={result.items}
          columns={columns}
          getRowKey={(booking) => booking.id}
          caption="Bron soʻrovlari"
          renderCard={(booking) => {
            const label = BOOKING_STATUS_LABELS[booking.status];
            return (
              <Card tone="plain" className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="font-mono text-sm font-medium text-chocolate-800"
                    >
                      {booking.reference}
                    </Link>
                    <p className="mt-1 truncate font-medium text-chocolate-800">
                      {booking.guest.fullName}
                    </p>
                  </div>
                  <Badge tone={label.tone}>{label.uz}</Badge>
                </div>

                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-brown-400">Xona</dt>
                    <dd className="text-chocolate-700">
                      {roomNames.get(booking.roomId) ?? booking.roomId}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-brown-400">Sanalar</dt>
                    <dd className="text-chocolate-700">
                      {formatDateRange(booking.checkIn, booking.checkOut, 'uz')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-brown-400">Taxminiy</dt>
                    <dd className="tabular-nums text-chocolate-700">
                      {formatMoney(booking.priceEstimate)}
                    </dd>
                  </div>
                </dl>

                <Button asChild variant="outline" size="sm" block className="mt-3">
                  <Link href={`/admin/bookings/${booking.id}`}>Ochish</Link>
                </Button>
              </Card>
            );
          }}
          empty={
            <EmptyState
              icon={<CalendarCheck />}
              title={
                search || status || from || to
                  ? 'Filtrga mos soʻrov topilmadi'
                  : 'Hali bron soʻrovi yoʻq'
              }
              description={
                search || status || from || to
                  ? 'Filtrlarni oʻzgartirib koʻring.'
                  : 'Mehmon saytdan soʻrov yuborganda u shu yerda koʻrinadi.'
              }
              action={
                search || status || from || to ? (
                  <Button asChild variant="outline">
                    <Link href="/admin/bookings">Filtrlarni tozalash</Link>
                  </Button>
                ) : null
              }
            />
          }
        />

        <TablePagination
          total={result.total}
          offset={offset}
          limit={PAGE_SIZE}
          buildHref={buildHref}
        />
      </div>
    </>
  );
}
