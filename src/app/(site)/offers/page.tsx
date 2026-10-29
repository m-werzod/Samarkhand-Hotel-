import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarRange, Tag } from 'lucide-react';

import { PageIntro } from '@/components/site/page-intro';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, Section } from '@/components/ui/surface';
import { formatMoney } from '@/lib/domain/money';
import { formatDateForDisplay } from '@/lib/domain/dates';
import { getPublishedOffers, getPublishedRooms, getSettings } from '@/lib/data/queries';
import type { Offer } from '@/lib/domain/types';

export const metadata: Metadata = {
  title: 'Takliflar',
  description:
    'Samarkhand Hotel joriy takliflari: erta bron chegirmasi, uzoq qolish va mavsumiy aksiyalar.',
  alternates: { canonical: '/offers' },
};

export default async function OffersPage() {
  const [offers, rooms, settings] = await Promise.all([
    getPublishedOffers(),
    getPublishedRooms(),
    getSettings(),
  ]);

  const now = new Date();

  // Scheduling is enforced here as well as in the store: an offer whose
  // window has closed must never appear as if it were live.
  const live = offers.filter((offer) => {
    if (offer.startsAt && new Date(offer.startsAt) > now) return false;
    if (offer.endsAt && new Date(offer.endsAt) <= now) return false;
    return true;
  });

  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  return (
    <>
      <PageIntro
        eyebrow="Takliflar"
        title="Joriy takliflar"
        description="Chegirmalar bron soʻrovi yuborilganda avtomatik hisoblanadi. Bir vaqtning oʻzida faqat bitta — siz uchun eng foydalisi — qoʻllanadi."
        crumbs={[{ href: '/offers', label: 'Takliflar' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content">
          {live.length > 0 ? (
            <ul className="grid gap-6 md:grid-cols-2">
              {live.map((offer) => (
                <li key={offer.id}>
                  <OfferCard
                    offer={offer}
                    roomNames={roomNames}
                    currency={settings.currency}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Tag />}
              title="Hozircha faol taklif yoʻq"
              description="Yangi takliflar paydo boʻlganda shu sahifada koʻrinadi."
              action={
                <Button asChild variant="outline">
                  <Link href="/rooms">Xonalarni koʻrish</Link>
                </Button>
              }
            />
          )}
        </div>
      </Section>
    </>
  );
}

function OfferCard({
  offer,
  roomNames,
  currency,
}: {
  offer: Offer;
  roomNames: Map<string, string>;
  currency: 'UZS' | 'USD' | 'EUR';
}) {
  const eligible =
    offer.eligibleRoomIds.length === 0
      ? 'Barcha xonalar'
      : offer.eligibleRoomIds
          .map((id) => roomNames.get(id))
          .filter(Boolean)
          .join(', ');

  const discountLabel =
    offer.discountType === 'percentage'
      ? `${offer.discountValue}% chegirma`
      : `${formatMoney({ amount: offer.discountValue, currency })} chegirma`;

  return (
    <Card tone="raised" className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-2xl text-chocolate-800">{offer.name}</h2>
        <Badge tone="gold" size="md" className="shrink-0">
          {discountLabel}
        </Badge>
      </div>

      <p className="mt-3 text-base leading-relaxed text-brown-400">
        {offer.description}
      </p>

      <dl className="mt-5 space-y-2.5 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-brown-300">Qoʻllaniladi:</dt>
          <dd className="text-chocolate-700">{eligible}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-brown-300">Eng kam muddat:</dt>
          <dd className="text-chocolate-700">{offer.minimumNights} kecha</dd>
        </div>
        {offer.startsAt || offer.endsAt ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-brown-300">
              <CalendarRange className="inline size-4" aria-hidden="true" />
              <span className="sr-only">Amal qilish muddati</span>
            </dt>
            <dd className="text-chocolate-700">
              {offer.startsAt
                ? formatDateForDisplay(offer.startsAt.slice(0, 10), 'uz', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
              {' → '}
              {offer.endsAt
                ? formatDateForDisplay(offer.endsAt.slice(0, 10), 'uz', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'muddatsiz'}
            </dd>
          </div>
        ) : null}
      </dl>

      {offer.conditions ? (
        <p className="mt-4 rounded-md bg-sand-200/70 px-3 py-2.5 text-xs leading-relaxed text-brown-400">
          {offer.conditions}
        </p>
      ) : null}

      <div className="mt-auto pt-5">
        <Button asChild variant="outline" block>
          <Link href="/rooms">
            Xonalarni koʻrish
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
