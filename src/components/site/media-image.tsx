'use client';

import * as React from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/lib/domain/types';

/**
 * Renders a media asset with three things the raw `<Image>` does not give us:
 *
 *  1. A graceful failure state. A missing file shows a labelled placeholder
 *     rather than a broken-image glyph or an empty box.
 *  2. A reserved aspect box, so an image loading late never shifts the
 *     layout under a reader's thumb.
 *  3. An illustration marker. Concept artwork is labelled as such wherever
 *     the distinction could mislead, which is the rule the whole media
 *     pipeline is built around.
 */
export function MediaImage({
  asset,
  sizes,
  priority = false,
  className,
  imageClassName,
  aspect = '3 / 2',
  showIllustrationNote = false,
  fit = 'cover',
}: {
  asset: MediaAsset | null | undefined;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  aspect?: string;
  showIllustrationNote?: boolean;
  fit?: 'cover' | 'contain';
}) {
  const [failed, setFailed] = React.useState(false);

  if (!asset || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-sand-200 text-brown-300',
          className,
        )}
        style={{ aspectRatio: aspect }}
        role="img"
        aria-label={asset?.altText ?? 'Tasvir mavjud emas'}
      >
        <ImageOff className="size-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-sand-200', className)}
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={asset.storagePath}
        alt={asset.altText}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        onError={() => setFailed(true)}
        className={cn(
          fit === 'cover' ? 'object-cover' : 'object-contain',
          imageClassName,
        )}
      />
      {showIllustrationNote && asset.kind === 'illustration' ? (
        <span
          className={cn(
            'pointer-events-none absolute bottom-2 right-2 rounded-full',
            'bg-chocolate-900/70 px-2.5 py-1 text-[0.625rem] font-medium',
            'uppercase tracking-wide text-ivory-100 backdrop-blur-sm',
          )}
        >
          Illyustratsiya
        </span>
      ) : null}
    </div>
  );
}
