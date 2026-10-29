'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Copy, Info, TriangleAlert } from 'lucide-react';

import { submitBookingInquiry, type BookingSuccess } from '@/app/actions/booking';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { PriceLine } from '@/components/site/price-display';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { trackEvent } from '@/lib/analytics/client';
import { formatDateRange, formatCalendarDate, parseCalendarDate } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { bookingInquiryShape } from '@/lib/validation/schemas';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';
import type { PriceBreakdown, RoomWithRelations } from '@/lib/domain/types';

type FormValues = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  fullName: string;
  email: string;
  phone: string;
  specialRequests?: string;
  acceptedTerms: true;
  website?: string;
};

/**
 * The booking inquiry form.
 *
 * It asks for the four things the hotel genuinely needs to call a guest back
 * — name, email, phone, and what they want — and nothing else. No address, no
 * date of birth, no card. Collecting data the hotel has no use for is both a
 * conversion cost and a liability.
 *
 * The success state shows the reference prominently and repeats, once more,
 * that nothing is confirmed yet.
 */
export function BookingForm({
  rooms,
  initialRoomId,
  initialCriteria,
  breakdownByRoom,
  currencyNote,
}: {
  rooms: RoomWithRelations[];
  initialRoomId: string | null;
  initialCriteria: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    rooms: number;
  };
  /** Server-computed estimates keyed by room id, for the live summary. */
  breakdownByRoom: Record<string, PriceBreakdown>;
  currencyNote: string;
}) {
  const dict = getDictionary();
  const { push } = useToast();
  const [result, setResult] = React.useState<BookingSuccess | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const defaultRoomId =
    initialRoomId && rooms.some((r) => r.id === initialRoomId)
      ? initialRoomId
      : (rooms[0]?.id ?? '');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(bookingInquiryShape),
    defaultValues: {
      roomId: defaultRoomId,
      checkIn: initialCriteria.checkIn,
      checkOut: initialCriteria.checkOut,
      adults: initialCriteria.adults,
      children: initialCriteria.children,
      rooms: initialCriteria.rooms,
      fullName: '',
      email: '',
      phone: '',
      specialRequests: '',
      website: '',
    },
  });

  const selectedRoomId = watch('roomId');
  const checkIn = watch('checkIn');
  const checkOut = watch('checkOut');
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const breakdown = breakdownByRoom[selectedRoomId] ?? null;

  // Record that a guest began the form — the denominator of the completion
  // rate the dashboard reports.
  React.useEffect(() => {
    trackEvent({
      type: 'booking_inquiry_started',
      roomId: defaultRoomId || null,
      dedupeKey: 'inquiry_started',
    });
  }, [defaultRoomId]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const response = await submitBookingInquiry(values);

    if (!response.ok) {
      setFormError(response.message);
      for (const [field, message] of Object.entries(response.fieldErrors ?? {})) {
        setError(field as keyof FormValues, { type: 'server', message });
      }
      push({ tone: 'error', title: response.message });
      return;
    }

    if (response.data) {
      setResult(response.data);
      trackEvent({
        type: 'booking_inquiry_submitted',
        roomId: values.roomId,
        metadata: { rooms: values.rooms, adults: values.adults },
      });
      push({ tone: 'success', title: dict.booking.successTitle });
    }
  }

  if (result) {
    return <BookingSuccessPanel result={result} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        {/* --- Stay ---------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-xl text-chocolate-800">
            1. Sanalar va xona
          </legend>

          <Field id="booking-room" label="Xona" required error={errors.roomId?.message}>
            {(aria) => (
              <Select {...aria} {...register('roomId')}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} — {room.maxOccupancy} mehmongacha
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="booking-check-in"
              label={dict.search.checkIn}
              required
              error={errors.checkIn?.message}
            >
              {(aria) => <Input {...aria} type="date" {...register('checkIn')} />}
            </Field>
            <Field
              id="booking-check-out"
              label={dict.search.checkOut}
              required
              error={errors.checkOut?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="date"
                  min={
                    checkIn
                      ? formatCalendarDate(
                          new Date(parseCalendarDate(checkIn).getTime() + 86_400_000),
                        )
                      : undefined
                  }
                  {...register('checkOut')}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field id="booking-adults" label={dict.common.adults} required error={errors.adults?.message}>
              {(aria) => (
                <Select {...aria} {...register('adults', { valueAsNumber: true })}>
                  {range(1, 16).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="booking-children" label={dict.common.children} error={errors.children?.message}>
              {(aria) => (
                <Select {...aria} {...register('children', { valueAsNumber: true })}>
                  {range(0, 12).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="booking-rooms" label={dict.common.rooms} required error={errors.rooms?.message}>
              {(aria) => (
                <Select {...aria} {...register('rooms', { valueAsNumber: true })}>
                  {range(1, 8).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </fieldset>

        {/* --- Guest --------------------------------------------------- */}
        <fieldset className="space-y-4 border-t border-sand-300 pt-6">
          <legend className="mb-3 font-display text-xl text-chocolate-800">
            2. Aloqa maʼlumotlari
          </legend>

          <Field
            id="booking-name"
            label={dict.booking.fullName}
            required
            error={errors.fullName?.message}
          >
            {(aria) => (
              <Input {...aria} autoComplete="name" {...register('fullName')} />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="booking-email"
              label={dict.booking.email}
              required
              error={errors.email?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  {...register('email')}
                />
              )}
            </Field>
            <Field
              id="booking-phone"
              label={dict.booking.phone}
              required
              hint="Masalan +998 90 123 45 67"
              error={errors.phone?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  {...register('phone')}
                />
              )}
            </Field>
          </div>

          <Field
            id="booking-requests"
            label={dict.booking.specialRequests}
            hint="Masalan: kech kelish, qoʻshimcha krovat, past qavat."
            error={errors.specialRequests?.message}
          >
            {(aria) => <Textarea {...aria} rows={3} {...register('specialRequests')} />}
          </Field>

          {/* Honeypot: off-screen, not hidden, so bots that skip
              display:none still fill it. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="booking-website">Veb-sayt</label>
            <input
              id="booking-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...register('website')}
            />
          </div>
        </fieldset>

        {/* --- Terms --------------------------------------------------- */}
        <fieldset className="border-t border-sand-300 pt-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 rounded border-sand-400 text-brown-500 focus:ring-2 focus:ring-gold-500/35"
              {...register('acceptedTerms')}
            />
            <span className="text-sm leading-relaxed text-chocolate-700">
              {dict.booking.acceptTerms}.{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-brown-500 underline underline-offset-2"
              >
                Shartlarni oʻqish
              </a>
            </span>
          </label>
          {errors.acceptedTerms ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger-600">
              {errors.acceptedTerms.message}
            </p>
          ) : null}
        </fieldset>

        {formError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-100 px-4 py-3 text-sm text-danger-600"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          size="xl"
          block
          loading={isSubmitting}
          loadingLabel={dict.booking.submitting}
        >
          {dict.booking.submit}
        </Button>
      </div>

      {/* --- Summary --------------------------------------------------- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card tone="sand" className="p-5">
          <h2 className="font-display text-xl text-chocolate-800">
            {dict.booking.estimateLabel}
          </h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-brown-400">Xona</dt>
              <dd className="text-right font-medium text-chocolate-800">
                {selectedRoom?.name ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-brown-400">Sanalar</dt>
              <dd className="text-right font-medium text-chocolate-800">
                {checkIn && checkOut && checkOut > checkIn
                  ? formatDateRange(checkIn, checkOut, 'uz')
                  : '—'}
              </dd>
            </div>
          </dl>

          {breakdown ? (
            <div className="mt-4 border-t border-sand-300 pt-2">
              <PriceLine
                label={`${formatMoney(breakdown.nightlyRate)} × ${breakdown.nights} kecha × ${breakdown.rooms} xona`}
                value={breakdown.subtotal}
              />
              {breakdown.discount.amount > 0 ? (
                <PriceLine
                  label={breakdown.appliedOfferName ?? 'Chegirma'}
                  value={`−${formatMoney(breakdown.discount)}`}
                />
              ) : null}
              {breakdown.taxes.amount > 0 ? (
                <PriceLine label="Soliq" value={breakdown.taxes} />
              ) : null}
              {breakdown.fees.amount > 0 ? (
                <PriceLine label="Xizmat haqi" value={breakdown.fees} />
              ) : null}
              <PriceLine label="Taxminiy jami" value={breakdown.total} emphasis />
            </div>
          ) : (
            <p className="mt-4 text-sm text-brown-400">
              Narxni koʻrish uchun xona va sanalarni tanlang.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-md bg-info-100 px-3 py-2.5 text-xs leading-relaxed text-info-600">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {dict.booking.estimateNote} {currencyNote}
            </span>
          </p>

          <p className="mt-2 flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-xs leading-relaxed text-warning-600">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{dict.booking.notConfirmedWarning}</span>
          </p>
        </Card>
      </aside>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function BookingSuccessPanel({ result }: { result: BookingSuccess }) {
  const dict = getDictionary();
  const { push } = useToast();

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(result.reference);
      push({ tone: 'success', title: 'Soʻrov raqami nusxalandi' });
    } catch {
      push({ tone: 'warning', title: 'Nusxalab boʻlmadi — raqamni qoʻlda yozib oling' });
    }
  }

  return (
    <Card tone="raised" className="mx-auto max-w-2xl p-7 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-100 text-success-600">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </span>

      <h2 className="mt-5 font-display text-3xl text-chocolate-800">
        {dict.booking.successTitle}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-brown-400">
        {dict.booking.successBody}
      </p>

      <div className="mt-6 rounded-lg border border-sand-300 bg-sand-200/60 p-5">
        <p className="text-xs uppercase tracking-wider text-brown-400">
          {dict.booking.referenceLabel}
        </p>
        <p className="mt-1 font-display text-3xl tracking-wide text-chocolate-800">
          {result.reference}
        </p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={copyReference}>
          <Copy aria-hidden="true" />
          Nusxalash
        </Button>
      </div>

      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-brown-400">Xona</dt>
          <dd className="font-medium text-chocolate-800">{result.roomName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brown-400">Sanalar</dt>
          <dd className="font-medium text-chocolate-800">
            {formatDateRange(result.checkIn, result.checkOut, 'uz')}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brown-400">{dict.booking.estimateLabel}</dt>
          <dd className="font-medium text-chocolate-800">
            {formatMoney({
              amount: result.totalMinor,
              currency: result.currency as 'UZS' | 'USD' | 'EUR',
            })}
          </dd>
        </div>
      </dl>

      <p
        className={cn(
          'mt-6 flex items-start gap-2 rounded-lg px-4 py-3 text-left text-sm leading-relaxed',
          'bg-warning-100 text-warning-600',
        )}
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{dict.booking.notConfirmedWarning}</span>
      </p>

      {/*
        Said only when true. If no provider is configured the server reports
        delivered: false, and the guest is told to expect a phone call rather
        than an email that is never coming.
      */}
      <p className="mt-3 text-sm text-brown-400">
        {result.notificationDelivered
          ? 'Tasdiq xabari emailingizga yuborildi.'
          : 'Email xabarnomasi sozlanmagan — mehmonxona siz bilan telefon orqali bogʻlanadi.'}
      </p>
    </Card>
  );
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
