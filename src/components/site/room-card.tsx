import Link from 'next/link';
import { ArrowRight, BedDouble, Maximize2, Users } from 'lucide-react';

import { AmenityIcon } from '@/components/site/amenity-icon';
import { MediaImage } from '@/components/site/media-image';
import { PriceDisplay } from '@/components/site/price-display';
import { Badge, Card, DemoBadge } from '@/components/ui/surface';
import type { DisplayPrice } from '@/lib/domain/pricing';
import type { RoomWithRelations } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * A room card.
 *
 * The information order is chosen for scanning on a phone: picture, name,
 * capacity and bed, then price, then the action. Capacity sits above price
 * deliberately — "will my family fit" is the question that disqualifies a
 * room, and a guest should not have to read a price to find out it is the
 * wrong room.
 *
 * The whole card is clickable via a stretched link on the title, so the touch
 * target is the card rather than a small line of text, while the markup stays
 * a single accessible link.
 */
export function RoomCard({
  room,
  price,
  searchQuery,
  priority = false,
  className,
}: {
  room: RoomWithRelations;
  price: DisplayPrice;
  /** Preserved search criteria, appended to the detail link. */
  searchQuery?: string;
  priority?: boolean;
  className?: string;
}) {
  const href = searchQuery
    ? `/rooms/${room.slug}?${searchQuery}`
    : `/rooms/${room.slug}`;
  const topAmenities = room.amenities.slice(0, 4);

  return (
    <Card
      tone="raised"
      interactive
      className={cn('group relative flex flex-col overflow-hidden', className)}
    >
      <div className="relative">
        <MediaImage
          asset={room.media[0]}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          aspect="4 / 3"
          priority={priority}
          showIllustrationNote
        />
        {price.discountPercent !== null ? (
          <Badge
            tone="terracotta"
            size="md"
            className="absolute left-3 top-3 shadow-[var(--shadow-subtle)]"
          >
            −{price.discountPercent}%
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl text-chocolate-800">
          {/* Stretched link: the card is the target, the title is the label. */}
          <Link href={href} className="after:absolute after:inset-0">
            {room.name}
          </Link>
        </h3>

        <p className="mt-1.5 text-sm leading-relaxed text-brown-400">
          {room.shortDescription}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-chocolate-700">
          <div className="flex items-center gap-1.5">
            <Users className="size-4 text-brown-300" aria-hidden="true" />
            <dt className="sr-only">Sigʻim</dt>
            <dd>{room.maxOccupancy} mehmon</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <BedDouble className="size-4 text-brown-300" aria-hidden="true" />
            <dt className="sr-only">Krovat</dt>
            <dd>{room.bedConfiguration}</dd>
          </div>
          {room.sizeSqm ? (
            <div className="flex items-center gap-1.5">
              <Maximize2 className="size-4 text-brown-300" aria-hidden="true" />
              <dt className="sr-only">Maydon</dt>
              <dd>
                {room.sizeSqm} m<sup>2</sup>
              </dd>
            </div>
          ) : null}
        </dl>

        {topAmenities.length > 0 ? (
          <ul className="mb-5 mt-4 flex flex-wrap gap-2">
            {topAmenities.map((amenity) => (
              <li
                key={amenity.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-sand-200 px-2.5 py-1 text-xs text-chocolate-700"
              >
                <AmenityIcon iconKey={amenity.iconKey} className="size-3.5" />
                {amenity.name}
              </li>
            ))}
            {room.amenities.length > topAmenities.length ? (
              <li className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-brown-400">
                +{room.amenities.length - topAmenities.length}
              </li>
            ) : null}
          </ul>
        ) : null}

        {/*
          `mt-auto` pins the price and action to the bottom of the card. Room
          types carry different numbers of amenity chips, so without it the
          price sits at a different height on every card in the row and the
          grid reads as ragged.
        */}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-sand-200 pt-4">
          <div>
            <PriceDisplay price={price} size="md" />
            {room.isDemoData ? <DemoBadge className="mt-1.5" /> : null}
          </div>
          {/* Visual affordance only — the stretched link above is the control,
              so this must not be a second focusable target. */}
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-11 items-center gap-1.5 rounded-md px-4',
              'bg-brown-500 text-sm font-medium text-ivory-50',
              'transition-colors group-hover:bg-chocolate-700',
            )}
          >
            Batafsil
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Loading placeholder matching the card's geometry, to avoid layout shift. */
export function RoomCardSkeleton() {
  return (
    <Card tone="raised" className="overflow-hidden">
      <div className="skeleton aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-7 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-4/5" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
        <div className="flex items-end justify-between pt-3">
          <div className="skeleton h-9 w-32" />
          <div className="skeleton h-11 w-28" />
        </div>
      </div>
    </Card>
  );
}
