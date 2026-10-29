import { NextResponse } from 'next/server';

import { ForbiddenError, UnauthorizedError, requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { formatMoneyPlain } from '@/lib/domain/money';
import { BOOKING_STATUSES, type BookingStatus } from '@/lib/domain/types';

/**
 * CSV export of booking records.
 *
 * Two things this deliberately does NOT include:
 *
 *  - Internal notes. They are staff commentary about a guest, and an export
 *    is the most likely file to be forwarded outside the hotel.
 *  - Any row the caller's role does not already let them read in the UI; the
 *    same `requireRole` gate applies here, because a route handler is just
 *    another endpoint.
 *
 * Fields are escaped and any value starting with =, +, - or @ is prefixed
 * with an apostrophe, so a guest cannot put a formula in their name and have
 * it execute when the hotel opens the file in Excel.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNS = [
  'reference',
  'status',
  'guest_name',
  'guest_email',
  'guest_phone',
  'room',
  'check_in',
  'check_out',
  'adults',
  'children',
  'rooms',
  'price_estimate',
  'currency',
  'special_requests',
  'created_at',
] as const;

export async function GET(request: Request): Promise<Response> {
  let actor: string;
  try {
    actor = (await requireRole('editor')).email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    throw error;
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const status = BOOKING_STATUSES.includes(statusParam as BookingStatus)
    ? (statusParam as BookingStatus)
    : null;

  const store = getStore();
  const [result, rooms] = await Promise.all([
    store.listBookings({
      search: url.searchParams.get('q') ?? undefined,
      statuses: status ? [status] : undefined,
      checkInFrom: url.searchParams.get('from') ?? undefined,
      checkInTo: url.searchParams.get('to') ?? undefined,
      // Bounded so a large database cannot produce an unbounded response.
      limit: 5000,
    }),
    store.listRooms(),
  ]);

  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  const lines = [COLUMNS.join(',')];
  for (const booking of result.items) {
    lines.push(
      [
        booking.reference,
        booking.status,
        booking.guest.fullName,
        booking.guest.email,
        booking.guest.phone,
        roomNames.get(booking.roomId) ?? booking.roomId,
        booking.checkIn,
        booking.checkOut,
        booking.adults,
        booking.children,
        booking.rooms,
        formatMoneyPlain(booking.priceEstimate),
        booking.priceEstimate.currency,
        booking.specialRequests ?? '',
        booking.createdAt,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  // The BOM makes Excel read the file as UTF-8, which Uzbek names need.
  const body = `﻿${lines.join('\r\n')}\r\n`;
  const filename = `samarkhand-bookings-${new Date().toISOString().slice(0, 10)}.csv`;

  await store.recordAudit({
    actor,
    action: 'booking.exported',
    entityType: 'booking',
    entityId: 'bulk',
    changes: { count: { from: null, to: result.items.length } },
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Escape a CSV field and neutralise spreadsheet formula injection. */
function csvCell(value: string | number): string {
  const text = String(value ?? '');
  const neutralised = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${neutralised.replace(/"/g, '""')}"`;
}
