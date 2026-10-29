import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Mail,
  Megaphone,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { BarList, StatusBreakdown, TrendChart } from '@/components/admin/charts';
import { MetricCard } from '@/components/admin/metric-card';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { getDashboardMetrics } from '@/lib/analytics/metrics';
import { getStore } from '@/lib/data';
import { requireRole } from '@/lib/auth';
import { getIntegrationStatuses } from '@/lib/env';
import { BOOKING_STATUS_LABELS } from '@/lib/domain/booking';
import { isCampaignLive } from '@/lib/domain/campaigns';
import { formatMoney } from '@/lib/domain/money';
import { formatDateRange } from '@/lib/domain/dates';

export default async function AdminDashboardPage() {
  await requireRole('viewer');

  const store = getStore();
  const [metrics, recentBookings, inquiries, campaigns] = await Promise.all([
    getDashboardMetrics(30),
    store.listBookings({ limit: 6 }),
    store.listInquiries({ statuses: ['new'], limit: 5 }),
    store.listCampaigns(),
  ]);

  const liveCampaigns = campaigns.filter((c) => isCampaignLive(c));
  const integrations = getIntegrationStatuses();
  const notConfigured = integrations.filter((i) => !i.configured);

  return (
    <>
      <AdminPageHeader
        title="Boshqaruv paneli"
        description="Soʻnggi 30 kun. Har bir koʻrsatkich ostida uning hisoblash usuli koʻrsatilgan."
        actions={
          <Button asChild variant="outline" size="md">
            <Link href="/admin/analytics">
              Toʻliq analitika
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* --- Configuration warnings ------------------------------- */}
        {notConfigured.length > 0 ? (
          <Card tone="plain" className="border-warning-600/30 bg-warning-100/60 p-5">
            <div className="flex items-start gap-3">
              <CircleAlert
                className="mt-0.5 size-5 shrink-0 text-warning-600"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="font-medium text-warning-600">
                  Sozlanmagan integratsiyalar ({notConfigured.length})
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {notConfigured.map((item) => (
                    <li key={item.key} className="text-sm leading-relaxed text-chocolate-700">
                      <strong className="font-medium">{item.label}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-brown-400">
                  Sozlash boʻyicha koʻrsatma: <code>docs/DEPLOYMENT.md</code>
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card tone="plain" className="flex items-center gap-3 border-success-600/30 bg-success-100/60 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-success-600" aria-hidden="true" />
            <p className="text-sm text-chocolate-700">
              Barcha integratsiyalar sozlangan.
            </p>
          </Card>
        )}

        {/* --- Headline metrics ------------------------------------- */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">
            Asosiy koʻrsatkichlar
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.headline.slice(0, 4).map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.headline.slice(4).map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
        </section>

        {/* --- Charts ------------------------------------------------ */}
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart
            data={metrics.inquiriesByDate}
            title="Bron soʻrovlari dinamikasi"
            description="Kun boʻyicha yaratilgan soʻrovlar soni (mehmonxona vaqt mintaqasida)."
          />
          <StatusBreakdown
            title="Soʻrovlar holati"
            data={Object.entries(metrics.bookingsByStatus).map(([key, value]) => ({
              key,
              label: BOOKING_STATUS_LABELS[key as keyof typeof BOOKING_STATUS_LABELS].uz,
              value,
            }))}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <BarList
            title="Eng koʻp qiziqish uygʻotgan xonalar"
            description="Soʻrovlar soni; qavs ichida — xona sahifasi koʻrishlari."
            data={metrics.topRooms.map((room) => ({
              label: room.name,
              value: room.inquiries,
              secondary: `${room.views} koʻrish`,
            }))}
            emptyMessage="Hali soʻrov yoʻq."
          />
          <BarList
            title="Kampaniyalar samaradorligi"
            description="Koʻrsatishlar soni; qavs ichida — CTR (bosishlar ÷ koʻrsatishlar × 100)."
            data={metrics.campaignPerformance.map((campaign) => ({
              label: campaign.title,
              value: campaign.impressions,
              secondary:
                campaign.ctr === null ? 'CTR —' : `CTR ${campaign.ctr}%`,
            }))}
            emptyMessage="Kampaniya statistikasi hali yigʻilmagan."
          />
        </div>

        {/* --- Recent activity --------------------------------------- */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card tone="plain" className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg text-chocolate-800">
                Soʻnggi bron soʻrovlari
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/bookings">
                  Barchasi
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>

            {recentBookings.items.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck />}
                title="Hali bron soʻrovi yoʻq"
                description="Mehmon saytdan soʻrov yuborganda u shu yerda koʻrinadi."
                className="mt-4 py-10"
              />
            ) : (
              <ul className="mt-4 divide-y divide-sand-200">
                {recentBookings.items.map((booking) => {
                  const status = BOOKING_STATUS_LABELS[booking.status];
                  return (
                    <li key={booking.id}>
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-sand-200/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-chocolate-800">
                            {booking.guest.fullName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-brown-400">
                            {booking.reference} ·{' '}
                            {formatDateRange(booking.checkIn, booking.checkOut, 'uz')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="hidden text-sm tabular-nums text-chocolate-700 sm:inline">
                            {formatMoney(booking.priceEstimate, { compact: true })}
                          </span>
                          <Badge tone={status.tone}>{status.uz}</Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            <Card tone="plain" className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg text-chocolate-800">
                  Yangi xabarlar
                </h2>
                <Badge tone={inquiries.total > 0 ? 'warning' : 'neutral'}>
                  {inquiries.total}
                </Badge>
              </div>

              {inquiries.items.length === 0 ? (
                <EmptyState
                  icon={<Mail />}
                  title="Yangi xabar yoʻq"
                  className="mt-4 py-8"
                />
              ) : (
                <ul className="mt-3 space-y-2">
                  {inquiries.items.map((inquiry) => (
                    <li key={inquiry.id}>
                      <Link
                        href={`/admin/inquiries?focus=${inquiry.id}`}
                        className="block rounded-md px-2 py-2 transition-colors hover:bg-sand-200/50"
                      >
                        <p className="truncate text-sm font-medium text-chocolate-800">
                          {inquiry.subject}
                        </p>
                        <p className="truncate text-xs text-brown-400">{inquiry.name}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card tone="plain" className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg text-chocolate-800">
                  Faol kampaniyalar
                </h2>
                <Badge tone={liveCampaigns.length > 0 ? 'success' : 'neutral'}>
                  {liveCampaigns.length}
                </Badge>
              </div>

              {liveCampaigns.length === 0 ? (
                <EmptyState
                  icon={<Megaphone />}
                  title="Faol kampaniya yoʻq"
                  className="mt-4 py-8"
                />
              ) : (
                <ul className="mt-3 space-y-2">
                  {liveCampaigns.slice(0, 4).map((campaign) => (
                    <li key={campaign.id}>
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="block truncate rounded-md px-2 py-2 text-sm text-chocolate-800 transition-colors hover:bg-sand-200/50"
                      >
                        {campaign.title ?? campaign.id}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
