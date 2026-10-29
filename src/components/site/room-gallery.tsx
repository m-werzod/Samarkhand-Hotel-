'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { MediaImage } from '@/components/site/media-image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/lib/domain/types';

/**
 * Room image gallery: one large image with thumbnails, and a full-screen
 * lightbox on click.
 *
 * Arrow keys move between images whenever the lightbox is open, and the
 * current position is announced, so the gallery is usable without a pointer.
 */
export function RoomGallery({ media }: { media: MediaAsset[] }) {
  const [index, setIndex] = React.useState(0);
  const [lightbox, setLightbox] = React.useState(false);

  const count = media.length;
  const current = media[index];

  const go = React.useCallback(
    (delta: number) => {
      setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count));
    },
    [count],
  );

  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, go]);

  if (count === 0 || !current) {
    return (
      <MediaImage asset={null} sizes="(min-width: 1024px) 720px, 100vw" aspect="4 / 3" />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="block w-full overflow-hidden rounded-xl"
        aria-label={`Tasvirni kattalashtirish: ${current.altText}`}
      >
        <MediaImage
          asset={current}
          sizes="(min-width: 1024px) 720px, 100vw"
          aspect="4 / 3"
          priority
          showIllustrationNote
        />
      </button>

      {count > 1 ? (
        <ul className="scroll-rail mt-3 gap-2" aria-label="Xona tasvirlari">
          {media.map((asset, i) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'block w-24 overflow-hidden rounded-md border-2 transition-colors sm:w-28',
                  i === index
                    ? 'border-brown-500'
                    : 'border-transparent hover:border-brown-300',
                )}
              >
                <MediaImage asset={asset} sizes="112px" aspect="4 / 3" />
                <span className="sr-only">{asset.altText}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent
          variant="full"
          className="flex flex-col bg-chocolate-900/98"
          aria-label="Tasvirlar"
        >
          <div className="flex flex-1 items-center justify-center p-4 sm:p-10">
            <MediaImage
              asset={current}
              sizes="100vw"
              aspect="4 / 3"
              fit="contain"
              className="max-h-[78vh] w-full bg-transparent"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-4 pb-6 sm:px-10">
            <p className="min-w-0 flex-1 text-sm text-ivory-100/80">
              {current.caption ?? current.altText}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums text-ivory-100/70" aria-live="polite">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => go(-1)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-ivory-50/25 text-ivory-50 transition-colors hover:bg-ivory-50/15"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
                <span className="sr-only">Oldingi tasvir</span>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-ivory-50/25 text-ivory-50 transition-colors hover:bg-ivory-50/15"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
                <span className="sr-only">Keyingi tasvir</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
