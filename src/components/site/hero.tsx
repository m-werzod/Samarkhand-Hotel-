import Link from 'next/link';
import { ArrowRight, BedDouble } from 'lucide-react';

import { BookingSearch } from '@/components/site/booking-search';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import type { HotelSettings, MediaAsset, SiteContent } from '@/lib/domain/types';

/**
 * The homepage hero.
 *
 * Three decisions worth naming:
 *
 *  - It is an image, not a video. A full-bleed background video is the
 *    single most expensive thing a hotel site can put above the fold on a
 *    phone, and most of the audience arrives on one. When the hotel
 *    configures `heroVideoUrl`, a "watch" affordance appears instead — the
 *    video is something a guest opts into, never something they must sit
 *    through.
 *  - The booking widget is inside the hero on desktop and immediately below
 *    it on mobile, so the primary action is reachable without scrolling on
 *    either.
 *  - The scrim is a gradient rather than a flat tint, so the artwork stays
 *    visible at the top while the text at the bottom keeps its contrast.
 */
export function Hero({
  content,
  settings,
  heroMedia,
}: {
  content: SiteContent;
  settings: HotelSettings;
  heroMedia: MediaAsset | null;
}) {
  return (
    <section className="relative isolate" aria-labelledby="hero-title">
      <div className="relative min-h-[32rem] sm:min-h-[36rem] lg:min-h-[44rem]">
        <div className="absolute inset-0 -z-10">
          <MediaImage
            asset={heroMedia}
            sizes="100vw"
            aspect="auto"
            priority
            className="size-full"
            imageClassName="object-cover"
          />
          <div className="media-scrim absolute inset-0" aria-hidden="true" />
        </div>

        <div className="container-content flex min-h-[32rem] flex-col justify-end pb-10 pt-28 sm:min-h-[36rem] sm:pb-14 lg:min-h-[44rem] lg:pb-20 lg:pt-36">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gold-300">
              {settings.address.city}
              {settings.address.country ? ` · ${settings.address.country}` : ''}
            </p>

            <h1
              id="hero-title"
              className="text-4xl leading-[1.08] text-ivory-50 sm:text-5xl lg:text-6xl"
            >
              {content.heroHeadline}
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-ivory-100/85 sm:text-lg">
              {content.heroSubheadline}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/booking">
                  Xona bron qilish
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="onDark" size="lg">
                <Link href="/rooms">
                  <BedDouble aria-hidden="true" />
                  Xonalarni koʻrish
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/*
        The search panel overlaps the hero on desktop and sits below it on
        mobile, where overlapping would eat the headline.
      */}
      <div className="container-content relative z-10 -mt-px lg:-mt-16">
        <BookingSearch timeZone={settings.timeZone} />
      </div>
    </section>
  );
}
