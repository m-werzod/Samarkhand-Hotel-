import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { BarList, StatusBreakdown, TrendChart } from '@/components/admin/charts';
import { MetricCard } from '@/components/admin/metric-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { getDashboardMetrics } from '@/lib/analytics/metrics';
import { requireRole } from '@/lib/auth';
import { BOOKING_STATUS_LABELS } from '@/lib/domain/booking';
import { cn } from '@/lib/utils';

const RANGES = [
  { days: 7, label: '7 kun' },
  { days: 30, label: '30 kun' },
  { days: 90, label: '90 kun' },
  { days: 365, label: '1 yil' },
] as const;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole('viewer');
  const params = await searchParams;

  const raw = Array.isArray(params.days) ? params.days[0] : params.days;
  const parsed = Number.parseInt(raw ?? '', 10);
  const days = RANGES.some((r) => r.days === parsed) ? parsed : 30;

  const metrics = await getDashboardMetrics(days);

  const events = metrics.totals.analytics.eventCounts;

  return (
    <>
      <AdminPageHeader
        title="Analitika"
        description="Sayt faolligi va bron soʻrovlari. Har bir koʻrsatkich ostida uning aniq taʼrifi berilgan."
        actions={
          <div className="flex gap-1 rounded-md bg-sand-200 p-1">
            {RANGES.map((range) => (
              <Button
                key={range.days}
                asChild
                variant={range.days === days ? 'primary' : 'ghost'}
                size="sm"
                className={cn(range.days === days && 'pointer-events-none')}
              >
                <Link href={`/admin/analytics?days=${range.days}`}>{range.label}</Link>
              </Button>
            ))}
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/*
          The vocabulary note sits above the numbers deliberately. These five
          things are routinely conflated, and conflating them is how a hotel
          ends up believing it has revenue it has not collected.
        */}
        <Card tone="plain" className="border-info-600/30 bg-info-100/50 p-5">
          <h2 className="font-medium text-info-600">Atamalar</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-medium text-chocolate-800">Sayt faolligi</dt>
              <dd className="text-xs leading-relaxed text-brown-400">
                Anonim sessiyalar va sahifa koʻrishlari.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-chocolate-800">Bron soʻrovi</dt>
              <dd className="text-xs leading-relaxed text-brown-400">
                Mehmon yuborgan forma. Tasdiqlangan bron emas.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-chocolate-800">Tasdiqlangan bron</dt>
              <dd className="text-xs leading-relaxed text-brown-400">
                Xodim qoʻlda tasdiqlagan soʻrov.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-chocolate-800">Toʻlangan bron</dt>
              <dd className="text-xs leading-relaxed text-brown-400">
                Bu platformada mavjud emas — toʻlov qabul qilinmaydi.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-chocolate-800">Tushum</dt>
              <dd className="text-xs leading-relaxed text-brown-400">
                Bu platformada hisoblanmaydi. Koʻrsatilgan summalar — taxminiy
                qiymat, tushum emas.
              </dd>
            </div>
          </dl>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.headline.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart
            data={metrics.inquiriesByDate}
            title="Soʻrovlar dinamikasi"
            description="Kun boʻyicha yaratilgan bron soʻrovlari."
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
            title="Xonalarga qiziqish"
            description="Soʻrovlar soni; qavs ichida — xona sahifasi koʻrishlari."
            data={metrics.topRooms.map((room) => ({
              label: room.name,
              value: room.inquiries,
              secondary: `${room.views} koʻrish`,
            }))}
          />
          <BarList
            title="Kampaniyalar"
            description="Koʻrsatishlar; qavs ichida — CTR."
            data={metrics.campaignPerformance.map((campaign) => ({
              label: campaign.title,
              value: campaign.impressions,
              secondary: campaign.ctr === null ? 'CTR —' : `CTR ${campaign.ctr}%`,
            }))}
          />
        </div>

        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Hodisalar</h2>
          <p className="mt-1 text-xs leading-relaxed text-brown-400">
            Xom hodisa hisoblari. Hech bir hodisa shaxsiy maʼlumot, IP manzil
            yoki brauzer satrini saqlamaydi.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(events).map(([type, count]) => (
              <div
                key={type}
                className="flex items-baseline justify-between gap-3 rounded-md bg-sand-200/50 px-3 py-2"
              >
                <dt className="truncate font-mono text-xs text-brown-400">{type}</dt>
                <dd className="shrink-0 font-display text-lg tabular-nums text-chocolate-800">
                  {count}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
