import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BedDouble, Clock, Maximize2, ShieldCheck, Users } from 'lucide-react';

import { AmenityIcon } from '@/components/site/amenity-icon';
import { BookingSearch } from '@/components/site/booking-search';
import { criteriaFromParams, criteriaToParams } from '@/lib/domain/search-criteria';
import { PageIntro } from '@/components/site/page-intro';
import { PageView } from '@/components/site/page-view';
import { PriceDisplay, PriceLine } from '@/components/site/price-display';
import { RoomCard } from '@/components/site/room-card';
import { RoomGallery } from '@/components/site/room-gallery';
import { Button } from '@/components/ui/button';
import { Badge, Card, DemoBadge, Section } from '@/components/ui/surface';
import {
  getPublishedOffers,
  getRoomBySlug,
  getRoomsWithPricing,
  getSettings,
} from '@/lib/data/queries';
import { formatMoney, formatMoneyPlain } from '@/lib/domain/money';
import { calculateStayPrice, displayPriceForRoom } from '@/lib/domain/pricing';
import { nightsBetween } from '@/lib/domain/dates';
import { getSiteUrl } from '@/lib/env';

type Params = { slug: string };
type Search = Record<string, string | string[] | undefined>;

/*
 * Deliberately no `generateStaticParams`.
 *
 * Prerendering room pages would bake the price, description and availability
 * language at build time, and a page config like that overrides the layout's
 * `force-dynamic`. An administrator changing a nightly rate expects the room
 * page to say so, so these render per request like the rest of the site.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return { title: 'Xona topilmadi' };

  return {
    title: room.name,
    description: room.shortDescription,
    alternates: { canonical: `/rooms/${room.slug}` },
    openGraph: {
      title: room.name,
      description: room.shortDescription,
      type: 'website',
    },
  };
}

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);

  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const [settings, offers, allRooms] = await Promise.all([
    getSettings(),
    getPublishedOffers(),
    getRoomsWithPricing(),
  ]);

  const criteria = criteriaFromParams(search, settings.timeZone);
  const query = criteriaToParams(criteria).toString();
  const nights = nightsBetween(criteria.checkIn, criteria.checkOut);

  const displayPrice = displayPriceForRoom(room, offers);
  const breakdown =
    nights >= 1
      ? calculateStayPrice(
          room,
          {
            checkIn: criteria.checkIn,
            checkOut: criteria.checkOut,
            rooms: criteria.rooms,
          },
          offers,
          {
            taxRatePercent: settings.taxRatePercent,
            serviceFeeMinor: settings.serviceFeeMinor,
          },
        )
      : null;

  const related = allRooms.filter((item) => item.room.id !== room.id).slice(0, 3);

  /**
   * Structured data.
   *
   * Only facts the hotel has actually supplied are emitted. No aggregate
   * rating (there are no verified reviews), no availability claim (there is
   * no live inventory feed), and the address is omitted entirely while the
   * settings are still flagged as demo data — publishing an invented address
   * as structured data would put a wrong location into search results.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    name: room.name,
    description: room.shortDescription,
    url: `${getSiteUrl()}/rooms/${room.slug}`,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: room.maxOccupancy,
      unitCode: 'C62',
    },
    bed: { '@type': 'BedDetails', typeOfBed: room.bedConfiguration },
    ...(room.sizeSqm
      ? {
          floorSize: {
            '@type': 'QuantitativeValue',
            value: room.sizeSqm,
            unitCode: 'MTK',
          },
        }
      : {}),
    ...(room.isDemoData
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price: formatMoneyPlain(displayPrice.nightly),
            priceCurrency: displayPrice.nightly.currency,
          },
        }),
  };

  return (
    <>
      <PageView event="room_detail_viewed" roomId={room.id} />
      <script
        type="application/ld+json"
        // Serialised from values we control; `<` is escaped so the payload
        // cannot close the script tag early.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <PageIntro
        eyebrow="Xona"
        title={room.name}
        description={room.shortDescription}
        crumbs={[
          { href: '/rooms', label: 'Xonalar' },
          { href: `/rooms/${room.slug}`, label: room.name },
        ]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
          <div>
            <RoomGallery media={room.media} />

            <div className="mt-8">
              <h2 className="font-display text-2xl text-chocolate-800">
                Xona haqida
              </h2>
              <p className="mt-3 text-base leading-relaxed text-brown-400">
                {room.description}
              </p>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact icon={<Users />} label="Sigʻim" value={`${room.maxOccupancy} mehmon`} />
              <Fact icon={<BedDouble />} label="Krovat" value={room.bedConfiguration} />
              {room.sizeSqm ? (
                <Fact
                  icon={<Maximize2 />}
                  label="Maydon"
                  value={`${room.sizeSqm} m²`}
                />
              ) : null}
              <Fact
                icon={<Clock />}
                label="Kelish / chiqish"
                value={`${settings.checkInTime} / ${settings.checkOutTime}`}
              />
            </dl>

            {room.amenities.length > 0 ? (
              <div className="mt-10">
                <h2 className="font-display text-2xl text-chocolate-800">
                  Qulayliklar
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {room.amenities.map((amenity) => (
                    <li
                      key={amenity.id}
                      className="flex items-start gap-3 rounded-lg bg-sand-200/60 p-3.5"
                    >
                      <AmenityIcon
                        iconKey={amenity.iconKey}
                        className="mt-0.5 size-5 shrink-0 text-brown-500"
                      />
                      <div>
                        <p className="font-medium text-chocolate-800">{amenity.name}</p>
                        {amenity.description ? (
                          <p className="mt-0.5 text-sm text-brown-400">
                            {amenity.description}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {room.cancellationPolicy ? (
              <Card tone="sand" className="mt-10 flex gap-3 p-5">
                <ShieldCheck
                  className="size-5 shrink-0 text-brown-500"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-medium text-chocolate-800">
                    Bekor qilish va toʻlov
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-brown-400">
                    {room.cancellationPolicy}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-brown-400">
                    Toʻlov mehmonxonada amalga oshiriladi. Saytda karta maʼlumotlari
                    soʻralmaydi.
                  </p>
                </div>
              </Card>
            ) : null}
          </div>

          {/* --- Booking panel ------------------------------------------ */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card tone="raised" className="p-5">
              <div className="flex items-start justify-between gap-4">
                <PriceDisplay price={displayPrice} size="lg" />
                {displayPrice.discountPercent !== null ? (
                  <Badge tone="terracotta" size="md">
                    −{displayPrice.discountPercent}%
                  </Badge>
                ) : null}
              </div>

              {displayPrice.offerName ? (
                <p className="mt-2 text-sm text-success-600">
                  {displayPrice.offerName} qoʻllandi
                </p>
              ) : null}

              {room.isDemoData ? <DemoBadge className="mt-3" /> : null}

              <div className="mt-5 border-t border-sand-200 pt-4">
                <BookingSearch
                  timeZone={settings.timeZone}
                  initial={criteria}
                  variant="inline"
                />
              </div>

              {breakdown ? (
                <div className="mt-5 border-t border-sand-200 pt-2">
                  <PriceLine
                    label={`${formatMoney(breakdown.nightlyRate)} × ${breakdown.nights} kecha × ${breakdown.rooms} xona`}
                    value={breakdown.subtotal}
                  />
                  {breakdown.discount.amount > 0 ? (
                    <PriceLine
                      label={breakdown.appliedOfferName ?? 'Chegirma'}
                      value={`−${formatMoney(breakdown.discount)}`}
                    />
                  ) : null}
                  {breakdown.taxes.amount > 0 ? (
                    <PriceLine
                      label={`Soliq (${settings.taxRatePercent}%)`}
                      value={breakdown.taxes}
                    />
                  ) : null}
                  {breakdown.fees.amount > 0 ? (
                    <PriceLine label="Xizmat haqi" value={breakdown.fees} />
                  ) : null}
                  <PriceLine
                    label="Taxminiy jami"
                    value={breakdown.total}
                    emphasis
                    note="Yakuniy summa mehmonxona tomonidan tasdiqlanadi."
                  />
                </div>
              ) : null}

              <Button asChild size="lg" block className="mt-4">
                <Link href={`/booking?roomId=${room.id}&${query}`}>
                  Bron soʻrovi yuborish
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>

              <p className="mt-3 text-xs leading-relaxed text-brown-300">
                Bu — bron soʻrovi. Mehmonxona uni koʻrib chiqib, siz bilan
                bogʻlanadi va bronni tasdiqlaydi.
              </p>
            </Card>
          </aside>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section tone="sand">
          <div className="container-content">
            <h2 className="mb-8 font-display text-3xl text-chocolate-800">
              Boshqa xonalar
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <RoomCard
                  key={item.room.id}
                  room={item.room}
                  price={item.price}
                  searchQuery={query}
                />
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-sand-300 p-4">
      <span className="text-brown-300 [&_svg]:size-5">{icon}</span>
      <dt className="mt-2 text-xs uppercase tracking-wide text-brown-300">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-chocolate-800">{value}</dd>
    </div>
  );
}
