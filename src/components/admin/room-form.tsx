'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, TriangleAlert } from 'lucide-react';

import { saveRoomAction } from '@/app/admin/actions/content';
import { AmenityIcon } from '@/components/site/amenity-icon';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { toMajorUnits } from '@/lib/domain/money';
import { roomInputSchema, type RoomInput } from '@/lib/validation/schemas';
import { slugify } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Amenity, MediaAsset, Room } from '@/lib/domain/types';

export function RoomForm({
  room,
  amenities,
  media,
  defaultCurrency,
}: {
  room: Room | null;
  amenities: Amenity[];
  media: MediaAsset[];
  defaultCurrency: 'UZS' | 'USD' | 'EUR';
}) {
  const router = useRouter();
  const { push } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(room));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoomInput>({
    resolver: zodResolver(roomInputSchema),
    defaultValues: room
      ? {
          name: room.name,
          slug: room.slug,
          shortDescription: room.shortDescription,
          description: room.description,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          maxOccupancy: room.maxOccupancy,
          bedConfiguration: room.bedConfiguration,
          sizeSqm: room.sizeSqm,
          basePriceMajor: toMajorUnits(room.basePrice),
          currency: room.basePrice.currency,
          status: room.status,
          sortOrder: room.sortOrder,
          inventoryCount: room.inventoryCount,
          cancellationPolicy: room.cancellationPolicy,
          isDemoData: room.isDemoData,
          amenityIds: room.amenityIds,
          mediaIds: room.mediaIds,
        }
      : {
          name: '',
          slug: '',
          shortDescription: '',
          description: '',
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 2,
          bedConfiguration: '',
          sizeSqm: null,
          basePriceMajor: 0,
          currency: defaultCurrency,
          status: 'draft',
          sortOrder: 0,
          inventoryCount: 0,
          cancellationPolicy: '',
          // A newly created room holds real figures by definition — the
          // operator is typing them — so it is not demo data.
          isDemoData: false,
          amenityIds: [],
          mediaIds: [],
        },
  });

  const name = watch('name');
  const selectedAmenities = watch('amenityIds');
  const selectedMedia = watch('mediaIds');
  const inventoryCount = watch('inventoryCount');

  // Derive the slug from the name until the operator edits it themselves.
  React.useEffect(() => {
    if (!slugTouched && name) {
      setValue('slug', slugify(name), { shouldValidate: false });
    }
  }, [name, slugTouched, setValue]);

  async function onSubmit(values: RoomInput) {
    setFormError(null);
    const result = await saveRoomAction(values, room?.id);

    if (!result.ok) {
      setFormError(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof RoomInput, { type: 'server', message });
      }
      push({ tone: 'error', title: result.message });
      return;
    }

    push({ tone: 'success', title: result.message });
    router.push('/admin/rooms');
    router.refresh();
  }

  function toggle(field: 'amenityIds' | 'mediaIds', id: string) {
    const current = (field === 'amenityIds' ? selectedAmenities : selectedMedia) ?? [];
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    setValue(field, next, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Asosiy maʼlumotlar</h2>

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="room-name" label="Nomi" required error={errors.name?.message}>
              {(aria) => <Input {...aria} {...register('name')} />}
            </Field>
            <Field
              id="room-slug"
              label="Slug"
              required
              hint="Sahifa manzili: /rooms/<slug>"
              error={errors.slug?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...register('slug')}
                  onChange={(event) => {
                    setSlugTouched(true);
                    register('slug').onChange(event);
                  }}
                />
              )}
            </Field>
          </div>

          <Field
            id="room-short"
            label="Qisqa tavsif"
            required
            hint="Xona kartochkasida koʻrinadi."
            error={errors.shortDescription?.message}
          >
            {(aria) => <Textarea {...aria} rows={2} {...register('shortDescription')} />}
          </Field>

          <Field
            id="room-description"
            label="Toʻliq tavsif"
            required
            error={errors.description?.message}
          >
            {(aria) => <Textarea {...aria} rows={6} {...register('description')} />}
          </Field>
        </div>
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Sigʻim va narx</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field id="room-adults" label="Kattalar (maks.)" required error={errors.maxAdults?.message}>
            {(aria) => (
              <Input {...aria} type="number" min={1} max={12} {...register('maxAdults', { valueAsNumber: true })} />
            )}
          </Field>
          <Field id="room-children" label="Bolalar (maks.)" required error={errors.maxChildren?.message}>
            {(aria) => (
              <Input {...aria} type="number" min={0} max={12} {...register('maxChildren', { valueAsNumber: true })} />
            )}
          </Field>
          <Field
            id="room-occupancy"
            label="Umumiy sigʻim"
            required
            hint="Kattalar sonidan kam va kattalar+bolalar yigʻindisidan koʻp boʻlmasligi kerak."
            error={errors.maxOccupancy?.message}
          >
            {(aria) => (
              <Input {...aria} type="number" min={1} max={20} {...register('maxOccupancy', { valueAsNumber: true })} />
            )}
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="room-bed" label="Krovat turi" required error={errors.bedConfiguration?.message}>
            {(aria) => <Input {...aria} {...register('bedConfiguration')} />}
          </Field>
          <Field id="room-size" label="Maydon (m²)" error={errors.sizeSqm?.message}>
            {(aria) => (
              <Input {...aria} type="number" min={5} max={1000} {...register('sizeSqm', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })} />
            )}
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field
            id="room-price"
            label="Bir kecha narxi"
            required
            hint="Asosiy birlikda kiriting (masalan 780000)."
            error={errors.basePriceMajor?.message}
          >
            {(aria) => (
              <Input {...aria} type="number" min={0} step={1000} {...register('basePriceMajor', { valueAsNumber: true })} />
            )}
          </Field>
          <Field id="room-currency" label="Valyuta" required error={errors.currency?.message}>
            {(aria) => (
              <Select {...aria} {...register('currency')}>
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            )}
          </Field>
          <Field
            id="room-inventory"
            label="Xonalar soni"
            required
            hint="0 boʻlsa bandlik tekshirilmaydi."
            error={errors.inventoryCount?.message}
          >
            {(aria) => (
              <Input {...aria} type="number" min={0} max={500} {...register('inventoryCount', { valueAsNumber: true })} />
            )}
          </Field>
        </div>

        {/*
          Inventory drives whether the site can say anything about
          availability at all, so the consequence of leaving it at 0 is
          stated here rather than discovered later.
        */}
        {Number(inventoryCount) === 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-info-100 px-3 py-2.5 text-xs leading-relaxed text-info-600">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Xonalar soni 0 — saytda bandlik tekshirilmaydi va har bir soʻrov
            mehmonxona tasdigʻiga yuboriladi.
          </p>
        ) : null}
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Qulayliklar</h2>
        <p className="mt-1 text-sm text-brown-400">
          Tanlangan: {selectedAmenities?.length ?? 0}
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.map((amenity) => {
            const checked = selectedAmenities?.includes(amenity.id) ?? false;
            return (
              <li key={amenity.id}>
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                    checked
                      ? 'border-brown-500 bg-brown-500/8 text-chocolate-800'
                      : 'border-sand-300 text-chocolate-700 hover:bg-sand-200/50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle('amenityIds', amenity.id)}
                    className="size-4 rounded border-sand-400 text-brown-500 focus:ring-2 focus:ring-gold-500/35"
                  />
                  <AmenityIcon iconKey={amenity.iconKey} className="size-4 text-brown-400" />
                  {amenity.name}
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Tasvirlar</h2>
        <p className="mt-1 text-sm text-brown-400">
          Birinchi tanlangan tasvir xona kartochkasida koʻrinadi. Tanlangan:{' '}
          {selectedMedia?.length ?? 0}
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {media.map((asset) => {
            const index = selectedMedia?.indexOf(asset.id) ?? -1;
            const checked = index >= 0;
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => toggle('mediaIds', asset.id)}
                  aria-pressed={checked}
                  className={cn(
                    'relative block w-full overflow-hidden rounded-md border-2 transition-colors',
                    checked ? 'border-brown-500' : 'border-transparent hover:border-sand-400',
                  )}
                >
                  <MediaImage asset={asset} sizes="160px" aspect="4 / 3" />
                  {checked ? (
                    <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-brown-500 text-xs font-semibold text-ivory-50">
                      {index + 1}
                    </span>
                  ) : null}
                  <span className="sr-only">{asset.altText}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Nashr va siyosat</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="room-status" label="Holat" required error={errors.status?.message}>
            {(aria) => (
              <Select {...aria} {...register('status')}>
                <option value="draft">Qoralama (saytda koʻrinmaydi)</option>
                <option value="published">Chop etilgan</option>
                <option value="archived">Arxivlangan</option>
              </Select>
            )}
          </Field>
          <Field id="room-sort" label="Tartib raqami" required error={errors.sortOrder?.message}>
            {(aria) => (
              <Input {...aria} type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} />
            )}
          </Field>
        </div>

        <Field
          id="room-policy"
          label="Bekor qilish shartlari"
          className="mt-4"
          error={errors.cancellationPolicy?.message}
        >
          {(aria) => <Textarea {...aria} rows={3} {...register('cancellationPolicy')} />}
        </Field>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-5 rounded border-sand-400 text-brown-500 focus:ring-2 focus:ring-gold-500/35"
            {...register('isDemoData')}
          />
          <span className="text-sm leading-relaxed text-chocolate-700">
            Namuna maʼlumot
            <span className="mt-0.5 block text-xs text-brown-400">
              Yoqilgan boʻlsa, saytda bu xona narxi yonida &ldquo;namuna
              maʼlumot&rdquo; belgisi koʻrinadi. Haqiqiy narx kiritilgach
              oʻchiring.
            </span>
          </span>
        </label>
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
          {room ? 'Oʻzgarishlarni saqlash' : 'Xona yaratish'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}
