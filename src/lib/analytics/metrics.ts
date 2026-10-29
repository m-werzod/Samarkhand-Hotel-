import 'server-only';

import { getStore } from '@/lib/data';
import type { AnalyticsTotals, BookingTotals } from '@/lib/data/store';
import type { BookingStatus, Money } from '@/lib/domain/types';

/**
 * Dashboard metrics.
 *
 * Every metric here has a stated formula and a stated source, and anything
 * the data cannot support returns `null` rather than a plausible number.
 * `null` renders as an explicit "not measurable yet" in the UI.
 *
 * The distinction the whole module is built around:
 *
 *   website activity  ≠  booking inquiries  ≠  confirmed bookings
 *                     ≠  paid bookings      ≠  recognised revenue
 *
 * This platform captures no payments, so the last two do not exist in it.
 * The nearest honest figure is the estimate attached to confirmed bookings,
 * which is named `confirmedEstimate` and labelled as a pipeline value — never
 * "revenue". See docs/ANALYTICS.md.
 */

export interface MetricValue {
  key: string;
  label: string;
  /** null means the data cannot support this metric yet. */
  value: number | null;
  /** How to render: a count, a percentage, or money in minor units. */
  format: 'count' | 'percent' | 'money';
  currency?: string;
  /** Shown under the figure, in the UI, verbatim. */
  formula: string;
  /** Why the value is null, when it is. */
  unavailableReason?: string;
}

export interface DashboardMetrics {
  range: { from: string; to: string };
  headline: MetricValue[];
  bookingsByStatus: Record<BookingStatus, number>;
  inquiriesByDate: { date: string; count: number }[];
  topRooms: { roomId: string; name: string; inquiries: number; views: number }[];
  campaignPerformance: {
    campaignId: string;
    title: string;
    impressions: number;
    clicks: number;
    ctr: number | null;
  }[];
  totals: { analytics: AnalyticsTotals; bookings: BookingTotals };
}

/** Resolve a range description into absolute ISO bounds. */
export function resolveRange(days: number, now = new Date()): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function getDashboardMetrics(days = 30): Promise<DashboardMetrics> {
  const store = getStore();
  const settings = await store.getHotelSettings();
  const range = resolveRange(days);

  const [analytics, bookings, rooms, campaigns] = await Promise.all([
    store.getAnalyticsTotals(range),
    store.getBookingTotals(range, settings.timeZone),
    store.listRooms(),
    store.listCampaigns(),
  ]);

  const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
  const campaignTitles = new Map(campaigns.map((c) => [c.id, c.title ?? c.id]));

  const totalInquiries = Object.values(bookings.byStatus).reduce((a, b) => a + b, 0);
  const started = analytics.eventCounts.booking_inquiry_started;
  const submitted = analytics.eventCounts.booking_inquiry_submitted;
  const sessions = analytics.distinctSessions;

  const headline: MetricValue[] = [
    {
      key: 'inquiries',
      label: 'Bron soʻrovlari',
      value: totalInquiries,
      format: 'count',
      formula: 'Davr ichida yaratilgan barcha bron soʻrovlari soni.',
    },
    {
      key: 'pending',
      label: 'Kutilayotgan',
      value: bookings.byStatus.pending,
      format: 'count',
      formula: 'Holati "pending" boʻlgan soʻrovlar soni.',
    },
    {
      key: 'confirmed',
      label: 'Tasdiqlangan',
      value: bookings.byStatus.confirmed,
      format: 'count',
      formula: 'Holati "confirmed" boʻlgan bronlar soni.',
    },
    {
      key: 'cancelled',
      label: 'Bekor qilingan',
      value: bookings.byStatus.cancelled,
      format: 'count',
      formula: 'Holati "cancelled" boʻlgan soʻrovlar soni.',
    },
    {
      key: 'completion_rate',
      label: 'Forma toʻldirish darajasi',
      // Guarded: with no starts the ratio is undefined, not 0%.
      value: started > 0 ? round1((submitted / started) * 100) : null,
      format: 'percent',
      formula:
        'Yuborilgan soʻrovlar ÷ boshlangan soʻrovlar × 100 (booking_inquiry_submitted / booking_inquiry_started).',
      unavailableReason:
        started === 0
          ? 'Hali hech kim bron formasini ochmagan — maxraj nolga teng.'
          : undefined,
    },
    {
      key: 'visit_to_inquiry',
      label: 'Tashrifdan soʻrovga',
      value: sessions > 0 ? round1((submitted / sessions) * 100) : null,
      format: 'percent',
      formula:
        'Yuborilgan soʻrovlar ÷ noyob anonim sessiyalar × 100. Sessiya — brauzer yorligʻi yopilguncha amal qiladigan anonim identifikator.',
      unavailableReason:
        sessions === 0 ? 'Davr ichida saytga tashrif qayd etilmagan.' : undefined,
    },
    {
      key: 'confirmed_estimate',
      label: 'Tasdiqlangan bronlar qiymati',
      value: bookings.confirmedCount > 0 ? bookings.confirmedEstimateMinor : null,
      format: 'money',
      currency: settings.currency,
      formula:
        'Tasdiqlangan va yakunlangan bronlarning taxminiy narxlari yigʻindisi. Bu — TUSHUM EMAS: platformada toʻlov qabul qilinmaydi.',
      unavailableReason:
        bookings.confirmedCount === 0 ? 'Davr ichida tasdiqlangan bron yoʻq.' : undefined,
    },
    {
      key: 'avg_booking_value',
      label: 'Oʻrtacha bron qiymati',
      value:
        bookings.confirmedCount > 0
          ? Math.round(bookings.confirmedEstimateMinor / bookings.confirmedCount)
          : null,
      format: 'money',
      currency: settings.currency,
      formula:
        'Tasdiqlangan bronlar qiymati ÷ tasdiqlangan bronlar soni. Taxminiy narxlarga asoslangan.',
      unavailableReason:
        bookings.confirmedCount === 0 ? 'Tasdiqlangan bron yoʻq.' : undefined,
    },
    {
      key: 'occupancy',
      label: 'Bandlik darajasi',
      /*
        Deliberately not computed. A real occupancy rate needs room-nights
        sold over room-nights available across a date range, which requires
        inventory on every room and a nightly expansion of every stay. The
        inventory half is optional in this schema, so the figure would be
        wrong for most installations. A wrong occupancy number is worse than
        no occupancy number — an operator would price against it.
      */
      value: null,
      format: 'percent',
      formula:
        'Sotilgan xona-kechalar ÷ mavjud xona-kechalar × 100.',
      unavailableReason:
        'Hisoblanmaydi: bu koʻrsatkich har bir xona uchun inventar soni va kechama-kecha hisob-kitobni talab qiladi. Xonalarga inventar soni kiritilgandan soʻng qoʻshiladi.',
    },
  ];

  const topRooms = Object.entries(bookings.byRoom)
    .map(([roomId, inquiries]) => ({
      roomId,
      name: roomNames.get(roomId) ?? roomId,
      inquiries,
      views: analytics.roomViews[roomId] ?? 0,
    }))
    .sort((a, b) => b.inquiries - a.inquiries || b.views - a.views)
    .slice(0, 6);

  const campaignPerformance = Object.keys({
    ...analytics.campaignImpressions,
    ...analytics.campaignClicks,
  })
    .map((campaignId) => {
      const impressions = analytics.campaignImpressions[campaignId] ?? 0;
      const clicks = analytics.campaignClicks[campaignId] ?? 0;
      return {
        campaignId,
        title: campaignTitles.get(campaignId) ?? campaignId,
        impressions,
        clicks,
        // CTR is undefined without impressions; it is not zero.
        ctr: impressions > 0 ? round1((clicks / impressions) * 100) : null,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);

  return {
    range,
    headline,
    bookingsByStatus: bookings.byStatus,
    inquiriesByDate: bookings.byDate,
    topRooms,
    campaignPerformance,
    totals: { analytics, bookings },
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Shape a money metric for the UI. */
export function metricMoney(metric: MetricValue): Money | null {
  if (metric.value === null || metric.format !== 'money') return null;
  return {
    amount: metric.value,
    currency: (metric.currency ?? 'UZS') as Money['currency'],
  };
}
