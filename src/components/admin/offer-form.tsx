'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, TriangleAlert } from 'lucide-react';

import { saveOfferAction } from '@/app/admin/actions/content';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { formatMoney, toMajorUnits } from '@/lib/domain/money';
import { offerInputSchema, type OfferInput } from '@/lib/validation/schemas';
import { cn } from '@/lib/utils';
import type { CurrencyCode, Offer, Room } from '@/lib/domain/types';

export function OfferForm({
  offer,
  rooms,
  currency,
}: {
  offer: Offer | null;
  rooms: Room[];
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OfferInput>({
    resolver: zodResolver(offerInputSchema),
    defaultValues: offer
      ? {
          name: offer.name,
          description: offer.description,
          discountType: offer.discountType,
          discountValue:
            offer.discountType === 'fixed'
              ? toMajorUnits({ amount: offer.discountValue, currency })
              : offer.discountValue,
          eligibleRoomIds: offer.eligibleRoomIds,
          startsAt: offer.startsAt,
          endsAt: offer.endsAt,
          minimumNights: offer.minimumNights,
          conditions: offer.conditions,
          status: offer.status,
        }
      : {
          name: '',
          description: '',
          discountType: 'percentage',
          discountValue: 10,
          eligibleRoomIds: [],
          startsAt: null,
          endsAt: null,
          minimumNights: 1,
          conditions: '',
          status: 'draft',
        },
  });

  const discountType = watch('discountType');
  const discountValue = watch('discountValue');
  const selectedRooms = watch('eligibleRoomIds') ?? [];

  async function onSubmit(values: OfferInput) {
    setFormError(null);
    const result = await saveOfferAction(values, offer?.id);

    if (!result.ok) {
      setFormError(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof OfferInput, { type: 'server', message });
      }
      push({ tone: 'error', title: result.message });
      return;
    }

    push({ tone: 'success', title: result.message });
    router.push('/admin/offers');
    router.refresh();
  }

  function toggleRoom(id: string) {
    const next = selectedRooms.includes(id)
      ? selectedRooms.filter((roomId) => roomId !== id)
      : [...selectedRooms, id];
    setValue('eligibleRoomIds', next, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-6">
      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Taklif</h2>
        <div className="mt-4 space-y-4">
          <Field id="o-name" label="Nomi" required error={errors.name?.message}>
            {(aria) => <Input {...aria} {...register('name')} />}
          </Field>
          <Field id="o-description" label="Tavsif" error={errors.description?.message}>
            {(aria) => <Textarea {...aria} rows={3} {...register('description')} />}
          </Field>
        </div>
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Chegirma</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field id="o-type" label="Turi" required error={errors.discountType?.message}>
            {(aria) => (
              <Select {...aria} {...register('discountType')}>
                <option value="percentage">Foiz (%)</option>
                <option value="fixed">Qatʼiy summa</option>
              </Select>
            )}
          </Field>
          <Field
            id="o-value"
            label={discountType === 'percentage' ? 'Foiz' : `Summa (${currency})`}
            required
            hint={discountType === 'percentage' ? 'Koʻpi bilan 90%.' : undefined}
            error={errors.discountValue?.message}
          >
            {(aria) => (
              <Input
                {...aria}
                type="number"
                min={discountType === 'percentage' ? 1 : 1000}
                max={discountType === 'percentage' ? 90 : undefined}
                step={discountType === 'percentage' ? 1 : 1000}
                {...register('discountValue', { valueAsNumber: true })}
              />
            )}
          </Field>
          <Field
            id="o-min-nights"
            label="Eng kam kechalar"
            required
            error={errors.minimumNights?.message}
          >
            {(aria) => (
              <Input {...aria} type="number" min={1} max={30} {...register('minimumNights', { valueAsNumber: true })} />
            )}
          </Field>
        </div>

        {discountType === 'fixed' && Number(discountValue) > 0 ? (
          <p className="mt-3 text-xs text-brown-400">
            Mehmon {formatMoney({ amount: Math.round(Number(discountValue) * (currency === 'UZS' ? 1 : 100)), currency })} tejaydi.
          </p>
        ) : null}

        {/*
          Discounts never stack, and an operator setting up their third offer
          needs to know that before they wonder why two are not combining.
        */}
        <p className="mt-4 rounded-md bg-info-100 px-3 py-2.5 text-xs leading-relaxed text-info-600">
          Bir vaqtning oʻzida faqat bitta taklif qoʻllanadi — mehmon uchun eng
          foydalisi. Takliflar bir-biriga qoʻshilmaydi.
        </p>
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Qaysi xonalarga</h2>
        <p className="mt-1 text-xs text-brown-400">
          Hech biri tanlanmasa, taklif barcha chop etilgan xonalarga qoʻllanadi.
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {rooms.map((room) => {
            const checked = selectedRooms.includes(room.id);
            return (
              <li key={room.id}>
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors',
                    checked
                      ? 'border-brown-500 bg-brown-500/8 text-chocolate-800'
                      : 'border-sand-300 text-chocolate-700 hover:bg-sand-200/50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRoom(room.id)}
                    className="size-4 rounded border-sand-400 text-brown-500 focus:ring-2 focus:ring-gold-500/35"
                  />
                  {room.name}
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Muddat va holat</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="o-starts" label="Boshlanish" hint="Boʻsh — darhol." error={errors.startsAt?.message}>
            {(aria) => (
              <Input
                {...aria}
                type="datetime-local"
                defaultValue={toLocalInput(offer?.startsAt ?? null)}
                onChange={(e) => setValue('startsAt', fromLocalInput(e.target.value))}
              />
            )}
          </Field>
          <Field id="o-ends" label="Tugash" hint="Boʻsh — muddatsiz." error={errors.endsAt?.message}>
            {(aria) => (
              <Input
                {...aria}
                type="datetime-local"
                defaultValue={toLocalInput(offer?.endsAt ?? null)}
                onChange={(e) => setValue('endsAt', fromLocalInput(e.target.value))}
              />
            )}
          </Field>
        </div>

        <Field id="o-conditions" label="Shartlar" className="mt-4" error={errors.conditions?.message}>
          {(aria) => <Textarea {...aria} rows={2} {...register('conditions')} />}
        </Field>

        <Field id="o-status" label="Holat" required className="mt-4" error={errors.status?.message}>
          {(aria) => (
            <Select {...aria} {...register('status')}>
              <option value="draft">Qoralama</option>
              <option value="published">Chop etilgan</option>
              <option value="archived">Arxiv</option>
            </Select>
          )}
        </Field>
      </Card>

      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-100 px-4 py-3 text-sm text-danger-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={isSubmitting} loadingLabel="Saqlanmoqda…">
          <Save aria-hidden="true" />
          {offer ? 'Saqlash' : 'Taklif yaratish'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
