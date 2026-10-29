'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Monitor, Save, Smartphone, TriangleAlert } from 'lucide-react';

import { saveCampaignAction } from '@/app/admin/actions/content';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import {
  CTA_VALIDATION_MESSAGES,
  campaignEligibility,
  validateCtaHref,
} from '@/lib/domain/campaigns';
import { campaignInputSchema, type CampaignInput } from '@/lib/validation/schemas';
import { cn } from '@/lib/utils';
import type { Campaign, MediaAsset, Offer, Room } from '@/lib/domain/types';

const OVERLAY_CLASS = {
  none: '',
  light: 'bg-chocolate-900/25',
  medium: 'bg-chocolate-900/45',
  strong: 'bg-chocolate-900/62',
} as const;

const ELIGIBILITY_COPY = {
  eligible: { tone: 'success' as const, text: 'Hozir saytda koʻrinadi' },
  not_published: { tone: 'neutral' as const, text: 'Chop etilmagan' },
  scheduled: { tone: 'info' as const, text: 'Rejalashtirilgan — hali boshlanmagan' },
  expired: { tone: 'danger' as const, text: 'Muddati tugagan — saytda koʻrinmaydi' },
};

/**
 * Campaign editor with a live preview.
 *
 * The preview renders the same overlay, alignment and media choices the
 * public carousel uses, at both desktop and phone proportions, so an operator
 * can see that their headline survives a portrait crop before publishing
 * rather than after a guest tells them it did not.
 *
 * Scheduling state is shown as a live verdict ("expired — not shown on the
 * site") rather than as two date fields the operator has to reason about.
 */
export function CampaignForm({
  campaign,
  media,
  offers,
  rooms,
}: {
  campaign: Campaign | null;
  media: MediaAsset[];
  offers: Offer[];
  rooms: Room[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<'desktop' | 'mobile'>('desktop');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CampaignInput>({
    resolver: zodResolver(campaignInputSchema),
    defaultValues: campaign
      ? {
          title: campaign.title,
          subtitle: campaign.subtitle,
          badge: campaign.badge,
          mediaId: campaign.mediaId,
          mobileMediaId: campaign.mobileMediaId,
          ctaLabel: campaign.ctaLabel,
          ctaHref: campaign.ctaHref,
          offerId: campaign.offerId,
          roomId: campaign.roomId,
          status: campaign.status,
          priority: campaign.priority,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          textAlign: campaign.textAlign,
          overlay: campaign.overlay,
        }
      : {
          title: '',
          subtitle: '',
          badge: '',
          mediaId: null,
          mobileMediaId: null,
          ctaLabel: '',
          ctaHref: '',
          offerId: null,
          roomId: null,
          status: 'draft',
          priority: 50,
          startsAt: null,
          endsAt: null,
          textAlign: 'left',
          overlay: 'medium',
        },
  });

  const values = watch();
  const desktopAsset = media.find((asset) => asset.id === values.mediaId) ?? null;
  const mobileAsset =
    media.find((asset) => asset.id === values.mobileMediaId) ?? desktopAsset;

  const eligibility = campaignEligibility({
    status: values.status,
    startsAt: values.startsAt ?? null,
    endsAt: values.endsAt ?? null,
  });

  const ctaCheck = values.ctaHref ? validateCtaHref(values.ctaHref) : null;

  async function onSubmit(input: CampaignInput) {
    setFormError(null);
    const result = await saveCampaignAction(
      {
        ...input,
        // Empty strings are the browser's way of saying "not set"; the
        // database wants null.
        title: input.title || null,
        subtitle: input.subtitle || null,
        badge: input.badge || null,
        ctaLabel: input.ctaLabel || null,
        ctaHref: input.ctaHref || null,
      },
      campaign?.id,
    );

    if (!result.ok) {
      setFormError(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof CampaignInput, { type: 'server', message });
      }
      push({ tone: 'error', title: result.message });
      return;
    }

    push({ tone: 'success', title: result.message });
    router.push('/admin/campaigns');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        {/* --- Copy ------------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Matn</h2>
          <p className="mt-1 text-xs leading-relaxed text-brown-400">
            Matn rasm ustiga alohida chiziladi — rasmga yozilmaydi. Shuning
            uchun u tarjima qilinadi va skrinriderlar oʻqiydi. Matnsiz slayd
            ham mumkin: sarlavhani boʻsh qoldiring.
          </p>

          <div className="mt-4 space-y-4">
            <Field id="c-badge" label="Belgi (badge)" error={errors.badge?.message}>
              {(aria) => <Input {...aria} {...register('badge')} placeholder="Masalan: 15% chegirma" />}
            </Field>
            <Field id="c-title" label="Sarlavha" error={errors.title?.message}>
              {(aria) => <Input {...aria} {...register('title')} />}
            </Field>
            <Field id="c-subtitle" label="Tavsif" error={errors.subtitle?.message}>
              {(aria) => <Textarea {...aria} rows={2} {...register('subtitle')} />}
            </Field>
          </div>
        </Card>

        {/* --- Media ------------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Tasvirlar</h2>
          <p className="mt-1 text-xs leading-relaxed text-brown-400">
            Mobil tasvir tanlanmasa, desktop tasviri ishlatiladi.
          </p>

          <MediaPicker
            label="Desktop tasvir (gorizontal)"
            media={media}
            value={values.mediaId ?? null}
            onChange={(id) => setValue('mediaId', id, { shouldDirty: true })}
          />
          {errors.mediaId ? (
            <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
              {errors.mediaId.message}
            </p>
          ) : null}

          <MediaPicker
            label="Mobil tasvir (vertikal)"
            media={media}
            value={values.mobileMediaId ?? null}
            onChange={(id) => setValue('mobileMediaId', id, { shouldDirty: true })}
            className="mt-5"
          />
        </Card>

        {/* --- CTA --------------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Tugma (CTA)</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="c-cta-label" label="Tugma matni" error={errors.ctaLabel?.message}>
              {(aria) => <Input {...aria} {...register('ctaLabel')} />}
            </Field>
            <Field
              id="c-cta-href"
              label="Havola"
              hint="Sayt ichidagi manzil (/rooms) yoki ruxsat etilgan https havola."
              error={errors.ctaHref?.message}
            >
              {(aria) => <Input {...aria} {...register('ctaHref')} placeholder="/rooms" />}
            </Field>
          </div>

          {/*
            Immediate verdict on the destination. The same validator runs on
            the server, so what is shown here is what will be enforced.
          */}
          {values.ctaHref ? (
            <p
              className={cn(
                'mt-3 rounded-md px-3 py-2 text-xs leading-relaxed',
                ctaCheck?.ok
                  ? 'bg-success-100 text-success-600'
                  : 'bg-danger-100 text-danger-600',
              )}
            >
              {ctaCheck?.ok
                ? ctaCheck.external
                  ? 'Tashqi havola — yangi oynada ochiladi.'
                  : 'Sayt ichidagi havola — toʻgʻri.'
                : CTA_VALIDATION_MESSAGES[
                    (ctaCheck as { reason: keyof typeof CTA_VALIDATION_MESSAGES }).reason
                  ]}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="c-offer" label="Bogʻlangan taklif" error={errors.offerId?.message}>
              {(aria) => (
                <Select {...aria} {...register('offerId')}>
                  <option value="">—</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="c-room" label="Bogʻlangan xona" error={errors.roomId?.message}>
              {(aria) => (
                <Select {...aria} {...register('roomId')}>
                  <option value="">—</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Card>

        {/* --- Layout + schedule ------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">
            Joylashuv va jadval
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="c-align" label="Matn joylashuvi" error={errors.textAlign?.message}>
              {(aria) => (
                <Select {...aria} {...register('textAlign')}>
                  <option value="left">Chapda</option>
                  <option value="center">Markazda</option>
                  <option value="right">Oʻngda</option>
                </Select>
              )}
            </Field>
            <Field id="c-overlay" label="Qoraytirish" error={errors.overlay?.message}>
              {(aria) => (
                <Select {...aria} {...register('overlay')}>
                  <option value="none">Yoʻq</option>
                  <option value="light">Yengil</option>
                  <option value="medium">Oʻrtacha</option>
                  <option value="strong">Kuchli</option>
                </Select>
              )}
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="c-starts"
              label="Boshlanish vaqti"
              hint="Boʻsh boʻlsa — darhol boshlanadi."
              error={errors.startsAt?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  defaultValue={toLocalInput(campaign?.startsAt ?? null)}
                  onChange={(event) =>
                    setValue('startsAt', fromLocalInput(event.target.value), {
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>
            <Field
              id="c-ends"
              label="Tugash vaqti"
              hint="Boʻsh boʻlsa — muddatsiz."
              error={errors.endsAt?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  defaultValue={toLocalInput(campaign?.endsAt ?? null)}
                  onChange={(event) =>
                    setValue('endsAt', fromLocalInput(event.target.value), {
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="c-status" label="Holat" required error={errors.status?.message}>
              {(aria) => (
                <Select {...aria} {...register('status')}>
                  <option value="draft">Qoralama</option>
                  <option value="published">Chop etilgan</option>
                  <option value="archived">Arxiv</option>
                </Select>
              )}
            </Field>
            <Field
              id="c-priority"
              label="Ustuvorlik"
              hint="Katta raqam — karuselda oldinroq."
              error={errors.priority?.message}
            >
              {(aria) => (
                <Input {...aria} type="number" min={0} max={1000} {...register('priority', { valueAsNumber: true })} />
              )}
            </Field>
          </div>

          <p className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-brown-400">Hozirgi holat:</span>
            <Badge tone={ELIGIBILITY_COPY[eligibility].tone} size="md">
              {ELIGIBILITY_COPY[eligibility].text}
            </Badge>
          </p>
        </Card>

        {formError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-100 px-4 py-3 text-sm text-danger-600"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={isSubmitting} loadingLabel="Saqlanmoqda…">
            <Save aria-hidden="true" />
            {campaign ? 'Saqlash' : 'Kampaniya yaratish'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
            Bekor qilish
          </Button>
        </div>
      </div>

      {/* --- Live preview --------------------------------------------- */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <Card tone="plain" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg text-chocolate-800">Koʻrinish</h2>
            <div className="flex gap-1 rounded-md bg-sand-200 p-1">
              <PreviewToggle
                active={preview === 'desktop'}
                onClick={() => setPreview('desktop')}
                icon={Monitor}
                label="Desktop"
              />
              <PreviewToggle
                active={preview === 'mobile'}
                onClick={() => setPreview('mobile')}
                icon={Smartphone}
                label="Mobil"
              />
            </div>
          </div>

          <div
            className={cn(
              'mx-auto mt-4 overflow-hidden rounded-lg',
              preview === 'mobile' ? 'max-w-[18rem]' : 'w-full',
            )}
          >
            <div className="relative isolate">
              <MediaImage
                asset={preview === 'mobile' ? mobileAsset : desktopAsset}
                sizes="(min-width: 1280px) 600px, 100vw"
                aspect={preview === 'mobile' ? '3 / 4' : '16 / 7'}
              />
              <div
                className={cn('absolute inset-0', OVERLAY_CLASS[values.overlay])}
                aria-hidden="true"
              />
              <div
                className={cn(
                  'absolute inset-0 flex flex-col justify-end gap-2 p-5',
                  values.textAlign === 'center' && 'items-center text-center',
                  values.textAlign === 'right' && 'items-end text-right',
                  values.textAlign === 'left' && 'items-start text-left',
                )}
              >
                {values.badge ? (
                  <Badge tone="gold" className="uppercase tracking-wider">
                    {values.badge}
                  </Badge>
                ) : null}
                {values.title ? (
                  <p
                    className={cn(
                      'font-display text-ivory-50',
                      preview === 'mobile' ? 'text-xl' : 'text-3xl',
                    )}
                  >
                    {values.title}
                  </p>
                ) : null}
                {values.subtitle ? (
                  <p className="max-w-sm text-xs leading-relaxed text-ivory-100/90">
                    {values.subtitle}
                  </p>
                ) : null}
                {values.ctaLabel && ctaCheck?.ok ? (
                  <span className="mt-1 inline-flex h-9 items-center rounded-md bg-gold-500 px-4 text-sm font-medium text-chocolate-900">
                    {values.ctaLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-brown-400">
            Bu — taxminiy koʻrinish. Haqiqiy karuselda matn oʻlchami ekran
            kengligiga qarab oʻzgaradi.
          </p>
        </Card>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function PreviewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors',
        active ? 'bg-ivory-50 text-chocolate-800 shadow-sm' : 'text-brown-400',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function MediaPicker({
  label,
  media,
  value,
  onChange,
  className,
}: {
  label: string;
  media: MediaAsset[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 mt-4 text-sm font-medium text-chocolate-700">{label}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <li>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className={cn(
              'flex aspect-[4/3] w-full items-center justify-center rounded-md border-2 text-xs text-brown-400 transition-colors',
              value === null ? 'border-brown-500 bg-sand-200' : 'border-sand-300 hover:bg-sand-200/50',
            )}
          >
            Yoʻq
          </button>
        </li>
        {media.map((asset) => (
          <li key={asset.id}>
            <button
              type="button"
              onClick={() => onChange(asset.id)}
              aria-pressed={value === asset.id}
              className={cn(
                'block w-full overflow-hidden rounded-md border-2 transition-colors',
                value === asset.id
                  ? 'border-brown-500'
                  : 'border-transparent hover:border-sand-400',
              )}
            >
              <MediaImage asset={asset} sizes="120px" aspect="4 / 3" />
              <span className="sr-only">{asset.altText}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ISO timestamp -> value a `datetime-local` input accepts, in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value -> ISO timestamp with offset, or null. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
