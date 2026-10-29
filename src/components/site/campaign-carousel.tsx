'use client';

import * as React from 'react';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

import { Badge } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { MediaImage } from '@/components/site/media-image';
import { trackEvent } from '@/lib/analytics/client';
import { validateCtaHref } from '@/lib/domain/campaigns';
import { cn } from '@/lib/utils';
import type { CampaignWithRelations, SlideOverlay } from '@/lib/domain/types';

/**
 * The promotional carousel.
 *
 * Accessibility and restraint drive the behaviour here:
 *
 *  - Autoplay runs only when there is more than one slide AND the visitor has
 *    not asked for reduced motion. It stops on hover, on focus, on pointer
 *    interaction, and whenever the tab is hidden.
 *  - A visible pause control is always present while autoplay is possible вЂ”
 *    WCAG 2.2 requires a way to stop moving content, and a hidden one does
 *    not count.
 *  - Slides are a labelled group with `aria-roledescription`, so a screen
 *    reader announces position rather than reading three headings in a row.
 *  - Copy is real DOM text over the artwork, never baked into the image, so
 *    it stays translatable, selectable and readable.
 */

const OVERLAY_CLASS: Record<SlideOverlay, string> = {
  none: '',
  light: 'bg-chocolate-900/25',
  medium: 'bg-chocolate-900/45',
  strong: 'bg-chocolate-900/62',
};

const AUTOPLAY_DELAY = 7000;

export function CampaignCarousel({
  campaigns,
  className,
}: {
  campaigns: CampaignWithRelations[];
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const canAutoplay = campaigns.length > 1 && !reducedMotion;

  const autoplay = React.useRef(
    Autoplay({
      delay: AUTOPLAY_DELAY,
      // Stop for good once the visitor takes control; resuming under their
      // finger is the behaviour people find hostile.
      stopOnInteraction: true,
      stopOnMouseEnter: true,
      stopOnFocusIn: true,
    }),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: campaigns.length > 2, align: 'start', skipSnaps: false },
    canAutoplay ? [autoplay.current] : [],
  );

  const [selected, setSelected] = React.useState(0);
  const [playing, setPlaying] = React.useState(canAutoplay);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on('select', onSelect).on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect);
    };
  }, [emblaApi]);

  // Pause when the tab is hidden: animating off-screen wastes a phone's
  // battery and skips slides the visitor never saw.
  React.useEffect(() => {
    if (!canAutoplay) return;
    const plugin = autoplay.current;
    const onVisibility = () => {
      if (document.hidden) plugin.stop();
      else if (playing) plugin.play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [canAutoplay, playing]);

  // One impression per campaign per page view.
  React.useEffect(() => {
    const campaign = campaigns[selected];
    if (!campaign) return;
    trackEvent({
      type: 'campaign_impression',
      campaignId: campaign.id,
      dedupeKey: `impression:${campaign.id}`,
    });
  }, [selected, campaigns]);

  function togglePlay() {
    const plugin = autoplay.current;
    if (playing) {
      plugin.stop();
      setPlaying(false);
    } else {
      plugin.play();
      setPlaying(true);
    }
  }

  /** Arrow keys move slides when focus is inside the carousel. */
  function onKeyDown(event: React.KeyboardEvent) {
    if (!emblaApi) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      emblaApi.scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      emblaApi.scrollNext();
    }
  }

  if (campaigns.length === 0) return null;

  return (
    <section
      aria-roledescription="karusel"
      aria-label="Joriy takliflar"
      className={cn('relative', className)}
      onKeyDown={onKeyDown}
    >
      <div className="overflow-hidden rounded-xl" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {campaigns.map((campaign, index) => (
            <CampaignSlide
              key={campaign.id}
              campaign={campaign}
              index={index}
              total={campaigns.length}
              active={index === selected}
            />
          ))}
        </div>
      </div>

      {campaigns.length > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Oldingi slayd"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Keyingi slayd"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            {canAutoplay ? (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={togglePlay}
                aria-label={
                  playing ? 'Avtomatik aylanishni toʻxtatish' : 'Avtomatik aylanishni yoqish'
                }
              >
                {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </Button>
            ) : null}
          </div>

          {/* Indicators are real buttons, not decorative dots. */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slaydlar">
            {campaigns.map((campaign, index) => (
              <button
                key={campaign.id}
                type="button"
                role="tab"
                aria-selected={index === selected}
                aria-label={`${index + 1}-slayd: ${campaign.title ?? 'taklif'}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  'h-2.5 rounded-full transition-all duration-300',
                  index === selected
                    ? 'w-7 bg-brown-500'
                    : 'w-2.5 bg-sand-400 hover:bg-brown-300',
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CampaignSlide({
  campaign,
  index,
  total,
  active,
}: {
  campaign: CampaignWithRelations;
  index: number;
  total: number;
  active: boolean;
}) {
  const cta = campaign.ctaHref ? validateCtaHref(campaign.ctaHref) : null;
  const hasCta = Boolean(campaign.ctaLabel && cta?.ok);

  const align = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[campaign.textAlign];

  return (
    <div
      className="min-w-0 flex-[0_0_100%]"
      role="group"
      aria-roledescription="slayd"
      aria-label={`${index + 1} / ${total}`}
      // Inactive slides stay in the DOM for the swipe, but their controls
      // must not be reachable by Tab.
      inert={!active}
    >
      <div className="relative isolate overflow-hidden rounded-xl">
        {/* Portrait creative below sm, landscape above. */}
        <div className="sm:hidden">
          <MediaImage
            asset={campaign.mobileMedia ?? campaign.media}
            sizes="100vw"
            aspect="3 / 4"
            priority={index === 0}
          />
        </div>
        <div className="hidden sm:block">
          <MediaImage
            asset={campaign.media}
            sizes="(min-width: 1280px) 1200px, 100vw"
            aspect="16 / 7"
            priority={index === 0}
          />
        </div>

        <div
          className={cn('absolute inset-0', OVERLAY_CLASS[campaign.overlay])}
          aria-hidden="true"
        />

        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-end gap-3 p-6 sm:p-10 lg:p-14',
            align,
          )}
        >
          {campaign.badge ? (
            <Badge tone="gold" size="md" className="uppercase tracking-wider">
              {campaign.badge}
            </Badge>
          ) : null}

          {campaign.title ? (
            <h3 className="max-w-2xl text-3xl text-ivory-50 drop-shadow-sm sm:text-4xl lg:text-5xl">
              {campaign.title}
            </h3>
          ) : null}

          {campaign.subtitle ? (
            <p className="max-w-xl text-sm leading-relaxed text-ivory-100/90 sm:text-base">
              {campaign.subtitle}
            </p>
          ) : null}

          {hasCta && cta?.ok ? (
            <div className="mt-1">
              {cta.external ? (
                <Button asChild variant="gold" size="lg">
                  <a
                    href={cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackEvent({
                        type: 'campaign_cta_clicked',
                        campaignId: campaign.id,
                      })
                    }
                  >
                    {campaign.ctaLabel}
                    <ArrowRight aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <Button asChild variant="gold" size="lg">
                  <Link
                    href={cta.href}
                    onClick={() =>
                      trackEvent({
                        type: 'campaign_cta_clicked',
                        campaignId: campaign.id,
                      })
                    }
                  >
                    {campaign.ctaLabel}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Tracks the visitor's reduced-motion preference, reacting to changes. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
