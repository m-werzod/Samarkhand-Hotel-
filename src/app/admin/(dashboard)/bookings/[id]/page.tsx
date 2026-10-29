import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import {
  BookingNotes,
  BookingStatusControls,
} from '@/components/admin/booking-controls';
import { PriceLine } from '@/components/site/price-display';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/surface';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { BOOKING_STATUS_LABELS } from '@/lib/domain/booking';
import { formatPhoneForDisplay, toTelHref } from '@/lib/domain/contact';
import { formatDateForDisplay, formatDateRange } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('viewer');
  const { id } = await params;

  const store = getStore();
  const booking = await store.getBookingById(id);
  if (!booking) notFound();

  const [room, history] = await Promise.all([
    store.getRoomById(booking.roomId),
    store.listBookingHistory(booking.id),
  ]);

  const status = BOOKING_STATUS_LABELS[booking.status];
  const breakdown = booking.priceBreakdown;

  return (
    <>
      <AdminPageHeader
        title={booking.reference}
        description={`Yuborilgan: ${formatDateForDisplay(booking.createdAt.slice(0, 10), 'uz', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <Button asChild variant="outline" size="md">
            <Link href="/admin/bookings">
              <ArrowLeft aria-hidden="true" />
              Roʻyxatga qaytish
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-3 lg:p-8">
        <div className="space-y-5 lg:col-span-2">
          {/* --- Status ------------------------------------------------ */}
          <Card tone="plain" className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-chocolate-800">Holat</h2>
                <Badge tone={status.tone} size="md" className="mt-2">
                  {status.uz}
                </Badge>
              </div>
            </div>
            <div className="mt-4 border-t border-sand-200 pt-4">
              <BookingStatusControls booking={booking} />
            </div>
          </Card>

          {/* --- Guest ------------------------------------------------- */}
          <Card tone="plain" className="p-5">
            <h2 className="font-display text-lg text-chocolate-800">Mehmon</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Ism" value={booking.guest.fullName} />
              <Row
                label="Telefon"
                value={
                  <a
                    href={toTelHref(booking.guest.phone)}
                    className="inline-flex items-center gap-1.5 text-brown-500 hover:underline"
                  >
                    <Phone className="size-3.5" aria-hidden="true" />
                    {formatPhoneForDisplay(booking.guest.phone)}
                  </a>
                }
              />
              <Row
                label="Email"
                value={
                  <a
                    href={`mailto:${booking.guest.email}`}
                    className="inline-flex items-center gap-1.5 break-all text-brown-500 hover:underline"
                  >
                    <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                    {booking.guest.email}
                  </a>
                }
              />
            </dl>
          </Card>

          {/* --- Stay -------------------------------------------------- */}
          <Card tone="plain" className="p-5">
            <h2 className="font-display text-lg text-chocolate-800">Qolish</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Xona" value={room?.name ?? booking.roomId} />
              <Row
                label="Sanalar"
                value={formatDateRange(booking.checkIn, booking.checkOut, 'uz')}
              />
              <Row label="Kechalar" value={String(breakdown.nights)} />
              <Row
                label="Mehmonlar"
                value={`${booking.adults} kattalar, ${booking.children} bola`}
              />
              <Row label="Xonalar soni" value={String(booking.rooms)} />
            </dl>

            {booking.specialRequests ? (
              <div className="mt-5 rounded-md bg-sand-200/60 p-4">
                <h3 className="text-sm font-medium text-chocolate-800">
                  Mehmon izohi
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-brown-400">
                  {booking.specialRequests}
                </p>
              </div>
            ) : null}
          </Card>

          <BookingNotes booking={booking} />
        </div>

        {/* --- Sidebar ------------------------------------------------- */}
        <div className="space-y-5">
          <Card tone="plain" className="p-5">
            <h2 className="font-display text-lg text-chocolate-800">
              Narx hisob-kitobi
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-brown-400">
              Soʻrov yuborilgan paytdagi hisob-kitob. Bu — toʻlov emas.
            </p>

            <div className="mt-3 border-t border-sand-200 pt-1">
              <PriceLine
                label={`${formatMoney(breakdown.nightlyRate)} × ${breakdown.nights} × ${breakdown.rooms}`}
                value={breakdown.subtotal}
              />
              {breakdown.discount.amount > 0 ? (
                <PriceLine
                  label={breakdown.appliedOfferName ?? 'Chegirma'}
                  value={`−${formatMoney(breakdown.discount)}`}
                />
              ) : null}
              {breakdown.taxes.amount > 0 ? (
                <PriceLine label="Soliq" value={breakdown.taxes} />
              ) : null}
              {breakdown.fees.amount > 0 ? (
                <PriceLine label="Xizmat haqi" value={breakdown.fees} />
              ) : null}
              <PriceLine label="Taxminiy jami" value={breakdown.total} emphasis />
            </div>
          </Card>

          <Card tone="plain" className="p-5">
            <h2 className="font-display text-lg text-chocolate-800">Tarix</h2>
            <ol className="mt-4 space-y-4">
              {history.map((entry) => (
                <li key={entry.id} className="relative pl-5">
                  <span
                    className="absolute left-0 top-1.5 size-2 rounded-full bg-brown-400"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-chocolate-800">
                    {entry.fromStatus
                      ? `${BOOKING_STATUS_LABELS[entry.fromStatus].uz} → ${BOOKING_STATUS_LABELS[entry.toStatus].uz}`
                      : `Yaratildi (${BOOKING_STATUS_LABELS[entry.toStatus].uz})`}
                  </p>
                  <p className="mt-0.5 text-xs text-brown-300">
                    {new Date(entry.createdAt).toLocaleString('uz-UZ')} · {entry.actor}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 text-xs italic text-brown-400">
                      {entry.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-brown-400">{label}</dt>
      <dd className="text-right font-medium text-chocolate-800">{value}</dd>
    </div>
  );
}
