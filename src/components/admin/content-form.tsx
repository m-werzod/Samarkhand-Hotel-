'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Trash2, TriangleAlert } from 'lucide-react';

import { saveContentAction } from '@/app/admin/actions/content';
import { AMENITY_ICON_KEYS } from '@/components/site/amenity-icon';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { siteContentSchema, type SiteContentInput } from '@/lib/validation/schemas';
import { cn } from '@/lib/utils';
import type { MediaAsset, SiteContent } from '@/lib/domain/types';

export function ContentForm({
  content,
  media,
}: {
  content: SiteContent;
  media: MediaAsset[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SiteContentInput>({
    resolver: zodResolver(siteContentSchema),
    defaultValues: {
      heroHeadline: content.heroHeadline,
      heroSubheadline: content.heroSubheadline,
      heroMediaId: content.heroMediaId,
      heroVideoUrl: content.heroVideoUrl ?? '',
      aboutTitle: content.aboutTitle,
      aboutBody: content.aboutBody,
      benefits: content.benefits,
      footerBlurb: content.footerBlurb,
      privacyPolicy: content.privacyPolicy,
      bookingTerms: content.bookingTerms,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'benefits' });
  const heroMediaId = watch('heroMediaId');

  async function onSubmit(values: SiteContentInput) {
    setFormError(null);
    const result = await saveContentAction(values);

    if (!result.ok) {
      setFormError(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof SiteContentInput, { type: 'server', message });
      }
      push({ tone: 'error', title: result.message });
      return;
    }

    push({ tone: 'success', title: result.message });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-4xl space-y-6">
      {/* --- Hero ---------------------------------------------------- */}
      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Bosh sahifa hero</h2>

        <div className="mt-4 space-y-4">
          <Field
            id="hero-headline"
            label="Sarlavha"
            required
            hint="Mehmon saytga kirganda birinchi oʻqiydigan jumla."
            error={errors.heroHeadline?.message}
          >
            {(aria) => <Input {...aria} {...register('heroHeadline')} />}
          </Field>
          <Field
            id="hero-sub"
            label="Qisqa tavsif"
            required
            error={errors.heroSubheadline?.message}
          >
            {(aria) => <Textarea {...aria} rows={2} {...register('heroSubheadline')} />}
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-chocolate-700">Hero tasviri</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {media.slice(0, 15).map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => setValue('heroMediaId', asset.id, { shouldDirty: true })}
                    aria-pressed={heroMediaId === asset.id}
                    className={cn(
                      'block w-full overflow-hidden rounded-md border-2 transition-colors',
                      heroMediaId === asset.id
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

          <Field
            id="hero-video"
            label="Hero video havolasi"
            hint="Ixtiyoriy. Kiritilsa, saytda 'Videoni koʻrish' tugmasi paydo boʻladi — video avtomatik ijro etilmaydi."
            error={errors.heroVideoUrl?.message}
          >
            {(aria) => <Input {...aria} type="url" {...register('heroVideoUrl')} />}
          </Field>
        </div>
      </Card>

      {/* --- About ---------------------------------------------------- */}
      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Biz haqimizda</h2>
        <div className="mt-4 space-y-4">
          <Field id="about-title" label="Sarlavha" required error={errors.aboutTitle?.message}>
            {(aria) => <Input {...aria} {...register('aboutTitle')} />}
          </Field>
          <Field
            id="about-body"
            label="Matn"
            required
            hint="Abzatslarni ajratish uchun ikki marta Enter bosing."
            error={errors.aboutBody?.message}
          >
            {(aria) => <Textarea {...aria} rows={7} {...register('aboutBody')} />}
          </Field>
        </div>
      </Card>

      {/* --- Benefits -------------------------------------------------- */}
      <Card tone="plain" className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-chocolate-800">Afzalliklar</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-brown-400">
              Faqat mehmonxona haqiqatan taklif qiladigan narsalarni yozing.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= 8}
            onClick={() =>
              append({ iconKey: 'heart-handshake', title: '', description: '' })
            }
          >
            <Plus aria-hidden="true" />
            Qoʻshish
          </Button>
        </div>

        <ul className="mt-4 space-y-3">
          {fields.map((field, index) => (
            <li key={field.id} className="rounded-lg border border-sand-300 p-4">
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Field id={`benefit-icon-${index}`} label="Ikonka">
                  {(aria) => (
                    <Select {...aria} {...register(`benefits.${index}.iconKey`)}>
                      {AMENITY_ICON_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  id={`benefit-title-${index}`}
                  label="Sarlavha"
                  error={errors.benefits?.[index]?.title?.message}
                >
                  {(aria) => <Input {...aria} {...register(`benefits.${index}.title`)} />}
                </Field>
              </div>
              <Field
                id={`benefit-desc-${index}`}
                label="Tavsif"
                className="mt-3"
                error={errors.benefits?.[index]?.description?.message}
              >
                {(aria) => (
                  <Textarea {...aria} rows={2} {...register(`benefits.${index}.description`)} />
                )}
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-danger-600 hover:bg-danger-100"
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden="true" />
                Oʻchirish
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {/* --- Footer + legal -------------------------------------------- */}
      <Card tone="plain" className="p-5">
        <h2 className="font-display text-lg text-chocolate-800">Footer va huquqiy matnlar</h2>

        <div className="mt-4 space-y-4">
          <Field id="footer-blurb" label="Footer matni" error={errors.footerBlurb?.message}>
            {(aria) => <Textarea {...aria} rows={2} {...register('footerBlurb')} />}
          </Field>

          <Field
            id="privacy"
            label="Maxfiylik siyosati"
            hint="Markdown: ## sarlavha, ### kichik sarlavha, - roʻyxat, **qalin**."
            error={errors.privacyPolicy?.message}
          >
            {(aria) => (
              <Textarea {...aria} rows={10} className="font-mono text-xs" {...register('privacyPolicy')} />
            )}
          </Field>

          <Field
            id="terms"
            label="Bron shartlari"
            hint="Markdown qoʻllab-quvvatlanadi."
            error={errors.bookingTerms?.message}
          >
            {(aria) => (
              <Textarea {...aria} rows={10} className="font-mono text-xs" {...register('bookingTerms')} />
            )}
          </Field>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-xs leading-relaxed text-warning-600">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Huquqiy matnlar namuna shablon. Mehmonxona ishga tushishidan oldin
          ularni yurist koʻrib chiqishi kerak.
        </p>
      </Card>

      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-100 px-4 py-3 text-sm text-danger-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={isSubmitting} loadingLabel="Saqlanmoqda…">
        <Save aria-hidden="true" />
        Matnlarni saqlash
      </Button>
    </form>
  );
}
