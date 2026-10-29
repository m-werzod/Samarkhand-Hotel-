import type { Metadata } from 'next';
import { BedDouble } from 'lucide-react';

import { BookingSearch } from '@/components/site/booking-search';
import { criteriaFromParams, criteriaToParams } from '@/lib/domain/search-criteria';
import { PageIntro } from '@/components/site/page-intro';
import { PageView } from '@/components/site/page-view';
import { RoomCard } from '@/components/site/room-card';
import { EmptyState, Section } from '@/components/ui/surface';
import { nightsBetween, roomFitsOccupancy } from '@/lib/domain/dates';
import { calculateStayPrice, displayPriceForRoom } from '@/lib/domain/pricing';
import { formatMoney } from '@/lib/domain/money';
import {
  getPublishedOffers,
  getRoomsWithPricing,
  getSettings,
} from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Xonalar',
  description:
    'Samarkhand Hotel xonalari: standart, deluxe, lyuks va oilaviy xonalar. Narxlar, sigʻim va qulayliklar.',
  alternates: { canonical: '/rooms' },
};

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [settings, roomsWithPricing, offers] = await Promise.all([
    getSettings(),
    getRoomsWithPricing(),
    getPublishedOffers(),
  ]);

  const criteria = criteriaFromParams(params, settings.timeZone);
  const query = criteriaToParams(criteria).toString();
  const nights = nightsBetween(criteria.checkIn, criteria.checkOut);

  // A search is "active" only when the visitor supplied dates themselves.
  // Otherwise the defaults are a convenience, not a filter, and showing
  // "2 of 4 rooms match" against dates nobody chose would be misleading.
  const hasSearch = typeof params.checkIn === 'string';

  const evaluated = roomsWithPricing.map(({ room, price }) => {
    const fits = roomFitsOccupancy(room, criteria);
    const stayPrice =
      nights >= 1
        ? calculateStayPrice(
            room,
            { checkIn: criteria.checkIn, checkOut: criteria.checkOut, rooms: criteria.rooms },
            offers,
            {
              taxRatePercent: settings.taxRatePercent,
              serviceFeeMinor: settings.serviceFeeMinor,
            },
          )
        : null;
    return { room, price: price ?? displayPriceForRoom(room, offers), fits, stayPrice };
  });

  const matching = hasSearch ? evaluated.filter((item) => item.fits) : evaluated;
  const nonMatching = hasSearch ? evaluated.filter((item) => !item.fits) : [];

  return (
    <>
      <PageView
        event="room_list_viewed"
        metadata={{ matching: matching.length, hasSearch }}
      />

      <PageIntro
        eyebrow="Xonalar"
        title="Xonalarimiz"
        description="Har bir xona turi uchun sigʻim, krovat turi, qulayliklar va narx koʻrsatilgan. Narxlar — taxminiy hisob-kitob."
        crumbs={[{ href: '/rooms', label: 'Xonalar' }]}
      >
        <BookingSearch timeZone={settings.timeZone} initial={criteria} />
      </PageIntro>

      <Section tone="ivory">
        <div className="container-content">
          {hasSearch ? (
            <p className="mb-6 text-sm text-brown-400" aria-live="polite">
              {matching.length > 0
                ? `${criteria.adults + criteria.children} mehmon va ${criteria.rooms} xona uchun ${matching.length} ta xona turi mos keladi.`
                : 'Tanlangan mehmonlar soniga mos xona topilmadi.'}
            </p>
          ) : null}

          {matching.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {matching.map(({ room, price, stayPrice }, index) => (
                <div key={room.id} className="flex flex-col">
                  <RoomCard
                    room={room}
                    price={price}
                    searchQuery={query}
                    priority={index < 2}
                    className="h-full"
                  />
                  {hasSearch && stayPrice ? (
                    <p className="mt-2 px-1 text-xs text-brown-400">
                      {nights} kecha × {criteria.rooms} xona ={' '}
                      <strong className="font-medium text-chocolate-700">
                        {formatMoney(stayPrice.total)}
                      </strong>{' '}
                      (taxminiy)
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BedDouble />}
              title="Mos xona topilmadi"
              description="Mehmonlar sonini yoki xonalar sonini oʻzgartirib koʻring."
            />
          )}

          {nonMatching.length > 0 ? (
            <div className="mt-14">
              <h2 className="font-display text-2xl text-chocolate-800">
                Boshqa xonalar
              </h2>
              <p className="mt-1.5 text-sm text-brown-400">
                Bu xonalar tanlangan mehmonlar soniga mos kelmaydi, ammo boshqa
                sanalarda qiziqtirishi mumkin.
              </p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {nonMatching.map(({ room, price }) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    price={price}
                    className="opacity-80"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Section>
    </>
  );
}
