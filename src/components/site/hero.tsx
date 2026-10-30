import Link from 'next/link';
import { ArrowRight, BedDouble, Star } from 'lucide-react';

import { BookingSearch } from '@/components/site/booking-search';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import type { HotelSettings, MediaAsset, SiteContent } from '@/lib/domain/types';

/**
 * The homepage hero.
 *
 * Layout decisions worth naming:
 *
 *  - **The text block is constrained and bottom-anchored**, with the scrim
 *    strongest exactly where the copy sits. Centring a headline over a
 *    photograph puts it wherever the photograph's busiest region happens to
 *    be; anchoring it low keeps it over the darkest, calmest part of almost
 *    any image.
 *  - **The search panel overlaps the hero on desktop** and clears it on
 *    mobile, where overlapping would eat the headline.
 *  - **It is a photograph, not a video.** A full-bleed background video is
 *    the most expensive thing a hotel site can put above the fold on a phone,
 *    and most of this audience arrives on one. A configured `heroVideoUrl`
 *    becomes an opt-in affordance instead.
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
  const location = [settings.address.city, settings.address.country]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="relative isolate" aria-labelledby="hero-title">
      <div className="relative min-h-[34rem] sm:min-h-[38rem] lg:min-h-[46rem]">
        <div className="absolute inset-0 -z-10">
          <MediaImage
            asset={heroMedia}
            sizes="100vw"
            aspect="auto"
            priority
            className="size-full"
            imageClassName="object-cover"
          />
          {/*
            Two layers rather than one: a bottom-weighted gradient that carries
            the text, plus a light top wash so the fixed header's white logo
            and links stay legible against a bright sky.
          */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-chocolate-900/92 via-chocolate-900/45 to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-chocolate-900/55 to-transparent"
            aria-hidden="true"
          />
        </div>

        <div className="container-content flex min-h-[34rem] flex-col justify-end pb-12 pt-28 sm:min-h-[38rem] sm:pb-16 lg:min-h-[46rem] lg:pb-24 lg:pt-36">
          <div className="max-w-3xl">
            <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5 fill-gold-400 text-gold-400" aria-hidden="true" />
                Boutique
              </span>
              <span className="h-3 w-px bg-gold-300/40" aria-hidden="true" />
              <span>{location}</span>
            </p>

            <h1
              id="hero-title"
              className="text-[2.5rem] leading-[1.06] text-ivory-50 sm:text-6xl lg:text-7xl"
            >
              {content.heroHeadline}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ivory-100/85 sm:text-lg">
              {content.heroSubheadline}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="xl">
                <Link href="/booking">
                  Xona bron qilish
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="onDark" size="xl">
                <Link href="/rooms">
                  <BedDouble aria-hidden="true" />
                  Xonalarni koʻrish
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-content relative z-10 -mt-px lg:-mt-20">
        <BookingSearch timeZone={settings.timeZone} />
      </div>
    </section>
  );
}
