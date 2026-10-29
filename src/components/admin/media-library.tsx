'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Images, Save, Trash2, Upload } from 'lucide-react';

import {
  deleteMediaAction,
  updateMediaMetadataAction,
} from '@/app/admin/actions/content';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { MEDIA_CATEGORIES, type MediaAsset, type MediaCategory } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  exterior: 'Tashqi koʻrinish',
  lobby: 'Lobbi',
  rooms: 'Xonalar',
  amenities: 'Qulayliklar',
  dining: 'Restoran',
  details: 'Tafsilotlar',
  campaigns: 'Kampaniyalar',
};

export function MediaLibrary({
  assets,
  uploadsEnabled,
  canDelete,
}: {
  assets: MediaAsset[];
  uploadsEnabled: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [filter, setFilter] = React.useState<MediaCategory | 'all'>('all');
  const [editing, setEditing] = React.useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = React.useState<MediaAsset | null>(null);
  const [pending, setPending] = React.useState(false);

  const visible =
    filter === 'all' ? assets : assets.filter((asset) => asset.category === filter);

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const result = await deleteMediaAction(deleting.id);
    setPending(false);
    setDeleting(null);

    // The failure message names which records still use the asset, so it is
    // given a longer dwell than a routine toast.
    push({
      tone: result.ok ? 'success' : 'error',
      title: result.message,
      duration: result.ok ? 5000 : 12000,
    });
    if (result.ok) router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="scroll-rail gap-2">
          <FilterChip
            label="Barchasi"
            count={assets.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {MEDIA_CATEGORIES.map((category) => {
            const count = assets.filter((a) => a.category === category).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={category}
                label={CATEGORY_LABELS[category]}
                count={count}
                active={filter === category}
                onClick={() => setFilter(category)}
              />
            );
          })}
        </div>
      </div>

      {!uploadsEnabled ? (
        <Card tone="plain" className="mb-5 border-info-600/30 bg-info-100/60 p-4">
          <p className="text-sm leading-relaxed text-info-600">
            <strong className="font-medium">Fayl yuklash oʻchirilgan.</strong> Yuklash
            uchun Supabase Storage va <code>SUPABASE_SERVICE_ROLE_KEY</code> sozlanishi
            kerak. Hozircha loyiha bilan birga kelgan tasvirlardan foydalanishingiz
            mumkin — ularning matnlarini tahrirlash ishlaydi.
          </p>
        </Card>
      ) : (
        <UploadPanel onUploaded={() => router.refresh()} />
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="Bu boʻlimda fayl yoʻq"
          description="Boshqa boʻlimni tanlang."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((asset) => (
            <li key={asset.id}>
              <Card tone="plain" className="overflow-hidden">
                <MediaImage asset={asset} sizes="240px" aspect="4 / 3" />
                <div className="p-3">
                  <p className="line-clamp-2 text-xs leading-relaxed text-chocolate-700">
                    {asset.altText}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{CATEGORY_LABELS[asset.category]}</Badge>
                    {asset.kind === 'illustration' ? (
                      <Badge tone="warning">illyustratsiya</Badge>
                    ) : null}
                  </div>
                  {asset.bytes ? (
                    <p className="mt-1.5 text-[0.6875rem] text-brown-300">
                      {(asset.bytes / 1024).toFixed(0)} KB · {asset.mimeType}
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(asset)}
                      className="flex-1"
                    >
                      Tahrirlash
                    </Button>
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => setDeleting(asset)}
                        className="text-danger-600 hover:bg-danger-100"
                      >
                        <Trash2 aria-hidden="true" />
                        <span className="sr-only">Oʻchirish</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <MetadataDialog
          asset={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Fayl oʻchirilsinmi?"
        description="Agar fayl biror xona yoki kampaniyada ishlatilayotgan boʻlsa, tizim oʻchirishga ruxsat bermaydi."
        confirmLabel="Ha, oʻchirilsin"
        pending={pending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);

    try {
      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: new FormData(form),
      });
      const payload: { error?: string } = await response.json();

      if (!response.ok) {
        push({
          tone: 'error',
          title: payload.error ?? 'Yuklab boʻlmadi.',
          duration: 10000,
        });
        return;
      }

      push({ tone: 'success', title: 'Fayl yuklandi.' });
      formRef.current?.reset();
      onUploaded();
    } catch {
      push({ tone: 'error', title: 'Tarmoq xatosi. Qaytadan urinib koʻring.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="plain" className="mb-5 p-5">
      <h2 className="font-display text-lg text-chocolate-800">Yangi fayl yuklash</h2>
      <p className="mt-1 text-xs leading-relaxed text-brown-400">
        PNG, JPEG, WebP, AVIF (6 MB gacha) yoki MP4, WebM (40 MB gacha). Fayl turi
        mazmuniga qarab tekshiriladi, kengaytmasiga emas. SVG qabul qilinmaydi.
      </p>

      <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field id="upload-file" label="Fayl" required>
          {(aria) => (
            <input
              {...aria}
              type="file"
              name="file"
              required
              accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm"
              className={cn(
                'w-full rounded-md border border-sand-300 bg-ivory-50 p-2 text-sm',
                'file:mr-3 file:rounded file:border-0 file:bg-brown-500 file:px-3 file:py-2',
                'file:text-sm file:font-medium file:text-ivory-50',
              )}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="upload-alt"
            label="Alt matn"
            required
            hint="Tasvirda nima borligini tasvirlang — skrinriderlar shuni oʻqiydi."
          >
            {(aria) => <Input {...aria} name="altText" required minLength={4} />}
          </Field>
          <Field id="upload-caption" label="Izoh">
            {(aria) => <Input {...aria} name="caption" />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="upload-category" label="Boʻlim" required>
            {(aria) => (
              <Select {...aria} name="category" required defaultValue="rooms">
                {MEDIA_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="upload-kind"
            label="Turi"
            required
            hint="Haqiqiy fotosuratmi yoki kontseptual tasvir — bu saytda koʻrsatiladi."
          >
            {(aria) => (
              <Select {...aria} name="kind" required defaultValue="photograph">
                <option value="photograph">Fotosurat</option>
                <option value="illustration">Illyustratsiya</option>
              </Select>
            )}
          </Field>
        </div>

        <Button type="submit" size="md" loading={busy} loadingLabel="Yuklanmoqda…">
          <Upload aria-hidden="true" />
          Yuklash
        </Button>
      </form>
    </Card>
  );
}

function MetadataDialog({
  asset,
  onClose,
  onSaved,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [altText, setAltText] = React.useState(asset.altText);
  const [caption, setCaption] = React.useState(asset.caption ?? '');
  const [category, setCategory] = React.useState<MediaCategory>(asset.category);
  const [kind, setKind] = React.useState(asset.kind);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const result = await updateMediaMetadataAction(asset.id, {
      altText,
      caption: caption || null,
      category,
      kind,
    });
    setBusy(false);

    if (!result.ok) {
      push({ tone: 'error', title: result.message });
      return;
    }
    push({ tone: 'success', title: result.message });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>Fayl maʼlumotlari</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="overflow-hidden rounded-md">
            <MediaImage asset={asset} sizes="480px" aspect="4 / 3" />
          </div>

          <Field id="meta-alt" label="Alt matn" required>
            {(aria) => (
              <Textarea
                {...aria}
                rows={2}
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
            )}
          </Field>

          <Field id="meta-caption" label="Izoh">
            {(aria) => (
              <Input
                {...aria}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="meta-category" label="Boʻlim" required>
              {(aria) => (
                <Select
                  {...aria}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MediaCategory)}
                >
                  {MEDIA_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {CATEGORY_LABELS[item]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="meta-kind" label="Turi" required>
              {(aria) => (
                <Select
                  {...aria}
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as 'photograph' | 'illustration')
                  }
                >
                  <option value="photograph">Fotosurat</option>
                  <option value="illustration">Illyustratsiya</option>
                </Select>
              )}
            </Field>
          </div>

          <Button size="md" block loading={busy} loadingLabel="Saqlanmoqda…" onClick={save}>
            <Save aria-hidden="true" />
            Saqlash
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors',
        active ? 'bg-brown-500 text-ivory-50' : 'bg-sand-200 text-chocolate-700 hover:bg-sand-300',
      )}
    >
      {label}
      <span className={cn('text-xs tabular-nums', active ? 'opacity-80' : 'text-brown-400')}>
        {count}
      </span>
    </button>
  );
}
