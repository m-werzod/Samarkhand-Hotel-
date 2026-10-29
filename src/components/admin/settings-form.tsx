'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Save, TriangleAlert, XCircle } from 'lucide-react';

import { saveSettingsAction } from '@/app/admin/actions/content';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { toMajorUnits } from '@/lib/domain/money';
import { hotelSettingsSchema, type HotelSettingsInput } from '@/lib/validation/schemas';
import type { IntegrationStatus } from '@/lib/env';
import type { HotelSettings } from '@/lib/domain/types';

export function SettingsForm({
  settings,
  integrations,
}: {
  settings: HotelSettings;
  integrations: IntegrationStatus[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HotelSettingsInput>({
    resolver: zodResolver(hotelSettingsSchema),
    defaultValues: {
      brandName: settings.brandName,
      tagline: settings.tagline,
      phone: settings.phone,
      email: settings.email,
      whatsappNumber: settings.whatsappNumber ?? '',
      address: {
        line1: settings.address.line1,
        line2: settings.address.line2 ?? '',
        city: settings.address.city,
        region: settings.address.region ?? '',
        postalCode: settings.address.postalCode ?? '',
        country: settings.address.country,
        latitude: settings.address.latitude,
        longitude: settings.address.longitude,
        mapsUrl: settings.address.mapsUrl ?? '',
      },
      social: {
        instagram: settings.social.instagram ?? '',
        telegram: settings.social.telegram ?? '',
        whatsapp: settings.social.whatsapp ?? '',
        facebook: settings.social.facebook ?? '',
        youtube: settings.social.youtube ?? '',
      },
      currency: settings.currency,
      timeZone: settings.timeZone,
      locale: settings.locale,
      taxRatePercent: settings.taxRatePercent,
      serviceFeeMajor: toMajorUnits({
        amount: settings.serviceFeeMinor,
        currency: settings.currency,
      }),
      checkInTime: settings.checkInTime,
      checkOutTime: settings.checkOutTime,
      seoTitle: settings.seoTitle,
      seoDescription: settings.seoDescription,
      isDemoData: settings.isDemoData,
    },
  });

  const isDemoData = watch('isDemoData');

  async function onSubmit(values: HotelSettingsInput) {
    setFormError(null);
    const result = await saveSettingsAction(values);

    if (!result.ok) {
      setFormError(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof HotelSettingsInput, { type: 'server', message });
      }
      push({ tone: 'error', title: result.message });
      return;
    }

    push({ tone: 'success', title: result.message });
    router.refresh();
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* --- Integration status (read-only) ------------------------- */}
      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Integratsiyalar</h2>
        <p className="mt-1 text-xs leading-relaxed text-brown-400">
          Bu holat muhit oʻzgaruvchilaridan oʻqiladi va shu yerdan oʻzgartirib
          boʻlmaydi — maxfiy kalitlar hech qachon maʼlumotlar bazasida saqlanmaydi.
        </p>

        <ul className="mt-4 space-y-3">
          {integrations.map((item) => (
            <li key={item.key} className="flex items-start gap-3">
              {item.configured ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success-600"
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="mt-0.5 size-4 shrink-0 text-warning-600"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-chocolate-800">{item.label}</p>
                <p className="text-xs leading-relaxed text-brown-400">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* --- Identity ------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Mehmonxona</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="s-brand" label="Nomi" required error={errors.brandName?.message}>
              {(aria) => <Input {...aria} {...register('brandName')} />}
            </Field>
            <Field id="s-tagline" label="Shior" error={errors.tagline?.message}>
              {(aria) => <Input {...aria} {...register('tagline')} />}
            </Field>
          </div>
        </Card>

        {/* --- Contact -------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Aloqa</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="s-phone" label="Telefon" required error={errors.phone?.message}>
              {(aria) => <Input {...aria} type="tel" {...register('phone')} />}
            </Field>
            <Field id="s-email" label="Email" required error={errors.email?.message}>
              {(aria) => <Input {...aria} type="email" {...register('email')} />}
            </Field>
            <Field
              id="s-whatsapp"
              label="WhatsApp raqami"
              hint="Faqat haqiqatan WhatsApp’ga ulangan raqamni kiriting — aks holda tugma mehmonni hech qayerga olib bormaydi."
              error={errors.whatsappNumber?.message}
            >
              {(aria) => <Input {...aria} type="tel" {...register('whatsappNumber')} />}
            </Field>
          </div>

          <h3 className="mt-6 text-sm font-medium text-chocolate-700">
            Ijtimoiy tarmoqlar
          </h3>
          <p className="mt-1 text-xs text-brown-400">
            Boʻsh qoldirilgan havola saytda umuman koʻrsatilmaydi.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field id="s-instagram" label="Instagram" error={errors.social?.instagram?.message}>
              {(aria) => (
                <Input {...aria} type="url" placeholder="https://instagram.com/..." {...register('social.instagram')} />
              )}
            </Field>
            <Field id="s-telegram" label="Telegram" error={errors.social?.telegram?.message}>
              {(aria) => (
                <Input {...aria} type="url" placeholder="https://t.me/..." {...register('social.telegram')} />
              )}
            </Field>
            <Field id="s-facebook" label="Facebook" error={errors.social?.facebook?.message}>
              {(aria) => <Input {...aria} type="url" {...register('social.facebook')} />}
            </Field>
            <Field id="s-youtube" label="YouTube" error={errors.social?.youtube?.message}>
              {(aria) => <Input {...aria} type="url" {...register('social.youtube')} />}
            </Field>
          </div>
        </Card>

        {/* --- Address --------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Manzil</h2>
          <div className="mt-4 space-y-4">
            <Field id="s-line1" label="Koʻcha va uy" required error={errors.address?.line1?.message}>
              {(aria) => <Input {...aria} {...register('address.line1')} />}
            </Field>
            <Field id="s-line2" label="Qoʻshimcha" error={errors.address?.line2?.message}>
              {(aria) => <Input {...aria} {...register('address.line2')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="s-city" label="Shahar" required error={errors.address?.city?.message}>
                {(aria) => <Input {...aria} {...register('address.city')} />}
              </Field>
              <Field id="s-region" label="Viloyat" error={errors.address?.region?.message}>
                {(aria) => <Input {...aria} {...register('address.region')} />}
              </Field>
              <Field id="s-country" label="Davlat" required error={errors.address?.country?.message}>
                {(aria) => <Input {...aria} {...register('address.country')} />}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                id="s-lat"
                label="Kenglik"
                hint="Xarita koʻrsatish uchun."
                error={errors.address?.latitude?.message}
              >
                {(aria) => (
                  <Input {...aria} type="number" step="any" {...register('address.latitude', { setValueAs: (v) => (v === '' ? null : Number(v)) })} />
                )}
              </Field>
              <Field id="s-lng" label="Uzunlik" error={errors.address?.longitude?.message}>
                {(aria) => (
                  <Input {...aria} type="number" step="any" {...register('address.longitude', { setValueAs: (v) => (v === '' ? null : Number(v)) })} />
                )}
              </Field>
              <Field id="s-maps" label="Google Maps havolasi" error={errors.address?.mapsUrl?.message}>
                {(aria) => <Input {...aria} type="url" {...register('address.mapsUrl')} />}
              </Field>
            </div>
          </div>
        </Card>

        {/* --- Operations ------------------------------------------ */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">Ish tartibi</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="s-currency" label="Valyuta" required error={errors.currency?.message}>
              {(aria) => (
                <Select {...aria} {...register('currency')}>
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              )}
            </Field>
            <Field
              id="s-timezone"
              label="Vaqt mintaqasi"
              required
              hint="IANA nomi, masalan Asia/Samarkand."
              error={errors.timeZone?.message}
            >
              {(aria) => <Input {...aria} {...register('timeZone')} />}
            </Field>
            <Field id="s-checkin" label="Kelish vaqti" required error={errors.checkInTime?.message}>
              {(aria) => <Input {...aria} type="time" {...register('checkInTime')} />}
            </Field>
            <Field id="s-checkout" label="Chiqish vaqti" required error={errors.checkOutTime?.message}>
              {(aria) => <Input {...aria} type="time" {...register('checkOutTime')} />}
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="s-tax"
              label="Soliq (%)"
              hint="0 boʻlsa, narxlarda soliq qatori koʻrsatilmaydi."
              error={errors.taxRatePercent?.message}
            >
              {(aria) => (
                <Input {...aria} type="number" min={0} max={100} step="0.01" {...register('taxRatePercent', { valueAsNumber: true })} />
              )}
            </Field>
            <Field
              id="s-fee"
              label="Xizmat haqi (har bir bron uchun)"
              hint="0 boʻlsa koʻrsatilmaydi."
              error={errors.serviceFeeMajor?.message}
            >
              {(aria) => (
                <Input {...aria} type="number" min={0} step={1000} {...register('serviceFeeMajor', { valueAsNumber: true })} />
              )}
            </Field>
          </div>
        </Card>

        {/* --- SEO -------------------------------------------------- */}
        <Card tone="plain" className="p-5">
          <h2 className="font-display text-lg text-chocolate-800">SEO</h2>
          <div className="mt-4 space-y-4">
            <Field
              id="s-seo-title"
              label="Sahifa sarlavhasi"
              required
              hint="60–70 belgi ideal."
              error={errors.seoTitle?.message}
            >
              {(aria) => <Input {...aria} maxLength={70} {...register('seoTitle')} />}
            </Field>
            <Field
              id="s-seo-desc"
              label="Tavsif"
              required
              hint="150–160 belgi ideal."
              error={errors.seoDescription?.message}
            >
              {(aria) => <Textarea {...aria} rows={3} maxLength={170} {...register('seoDescription')} />}
            </Field>
          </div>
        </Card>

        {/* --- Demo flag -------------------------------------------- */}
        <Card
          tone="plain"
          className={isDemoData ? 'border-warning-600/40 bg-warning-100/40 p-5' : 'p-5'}
        >
          <h2 className="font-display text-lg text-chocolate-800">
            Namuna maʼlumot rejimi
          </h2>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 rounded border-sand-400 text-brown-500 focus:ring-2 focus:ring-gold-500/35"
              {...register('isDemoData')}
            />
            <span className="text-sm leading-relaxed text-chocolate-700">
              Manzil, telefon va narxlar hali tasdiqlanmagan
              <span className="mt-1 block text-xs text-brown-400">
                Yoqilgan boʻlsa, saytning footer, aloqa va manzil boʻlimlarida
                &ldquo;namuna maʼlumot&rdquo; ogohlantirishi koʻrinadi. Haqiqiy
                maʼlumotlarni kiritib tekshirgandan soʻng bu belgini oʻchiring —
                u mehmonlarni chalgʻitmaslik uchun mavjud.
              </span>
            </span>
          </label>
        </Card>

        {formError ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-100 px-4 py-3 text-sm text-danger-600">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="lg" loading={isSubmitting} loadingLabel="Saqlanmoqda…">
          <Save aria-hidden="true" />
          Sozlamalarni saqlash
        </Button>
      </form>
    </div>
  );
}
