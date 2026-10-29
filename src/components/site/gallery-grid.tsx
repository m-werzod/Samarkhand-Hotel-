'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';

import { MediaImage } from '@/components/site/media-image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { MediaAsset, MediaCategory } from '@/lib/domain/types';

/**
 * Filterable gallery with a full-screen lightbox.
 *
 * The category filters are a horizontally scrollable rail on narrow screens.
 * The rail uses `scroll-rail`, which contains its own overflow — a filter row
 * that leaks page-wide horizontal scroll is the most common way a hotel site
 * breaks on a phone, and it is worth preventing structurally rather than
 * noticing later.
 *
 * Filters are real buttons in a tablist, not links, so filtering does not
 * cost a navigation.
 */
export function GalleryGrid({
  assets,
  categories,
}: {
  assets: MediaAsset[];
  categories: { key: MediaCategory; label: string }[];
}) {
  const [active, setActive] = React.useState<MediaCategory | 'all'>('all');
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const visible = React.useMemo(
    () => (active === 'all' ? assets : assets.filter((a) => a.category === active)),
    [assets, active],
  );

  // Only offer a filter that would actually show something.
  const usable = React.useMemo(
    () => categories.filter((c) => assets.some((a) => a.category === c.key)),
    [categories, assets],
  );

  const current = lightboxIndex === null ? null : visible[lightboxIndex];

  const go = React.useCallback(
    (delta: number) => {
      setLightboxIndex((i) => {
        if (i === null || visible.length === 0) return i;
        return (i + delta + visible.length) % visible.length;
      });
    },
    [visible.length],
  );

  React.useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, go]);

  return (
    <div>
      {usable.length > 1 ? (
        <div
          role="tablist"
          aria-label="Galereya boʻlimlari"
          className="scroll-rail -mx-4 gap-2 px-4 pb-2 sm:mx-0 sm:px-0"
        >
          <FilterChip
            label="Barchasi"
            count={assets.length}
            selected={active === 'all'}
            onSelect={() => setActive('all')}
          />
          {usable.map((category) => (
            <FilterChip
              key={category.key}
              label={category.label}
              count={assets.filter((a) => a.category === category.key).length}
              selected={active === category.key}
              onSelect={() => setActive(category.key)}
            />
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="Bu boʻlimda tasvir yoʻq"
          description="Boshqa boʻlimni tanlab koʻring."
          className="mt-8"
        />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          {visible.map((asset, index) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="group block w-full overflow-hidden rounded-lg"
                aria-label={`Kattalashtirish: ${asset.altText}`}
              >
                <MediaImage
                  asset={asset}
                  sizes="(min-width: 1024px) 380px, 50vw"
                  aspect="4 / 3"
                  imageClassName="transition-transform duration-500 group-hover:scale-105"
                  showIllustrationNote
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(open) => setLightboxIndex(open ? lightboxIndex : null)}
      >
        <DialogContent
          variant="full"
          className="flex flex-col bg-chocolate-900/98"
          aria-label="Galereya tasviri"
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
              {current?.caption ?? current?.altText}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="text-sm tabular-nums text-ivory-100/70"
                aria-live="polite"
              >
                {(lightboxIndex ?? 0) + 1} / {visible.length}
              </span>
              <LightboxButton onClick={() => go(-1)} label="Oldingi tasvir">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </LightboxButton>
              <LightboxButton onClick={() => go(1)} label="Keyingi tasvir">
                <ChevronRight className="size-5" aria-hidden="true" />
              </LightboxButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4',
        'text-sm font-medium transition-colors',
        selected
          ? 'bg-brown-500 text-ivory-50'
          : 'bg-sand-200 text-chocolate-700 hover:bg-sand-300',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs tabular-nums',
          selected ? 'bg-ivory-50/20' : 'bg-ivory-50/70 text-brown-400',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function LightboxButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-ivory-50/25 text-ivory-50 transition-colors hover:bg-ivory-50/15"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
