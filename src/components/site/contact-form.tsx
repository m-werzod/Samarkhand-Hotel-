'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send, TriangleAlert } from 'lucide-react';

import { submitContactForm } from '@/app/actions/booking';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { contactFormSchema, type ContactFormInput } from '@/lib/validation/schemas';

/**
 * The contact form.
 *
 * On success the form is replaced by a confirmation rather than cleared in
 * place: a cleared form looks identical to one that silently failed, and the
 * guest has no way to tell which happened.
 */
export function ContactForm() {
  const { push } = useToast();
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      website: '',
    },
  });

  async function onSubmit(values: ContactFormInput) {
    setFormError(null);
    const response = await submitContactForm(values);

    if (!response.ok) {
      setFormError(response.message);
      for (const [field, message] of Object.entries(response.fieldErrors ?? {})) {
        setError(field as keyof ContactFormInput, { type: 'server', message });
      }
      push({ tone: 'error', title: response.message });
      return;
    }

    setSent(true);
    push({ tone: 'success', title: response.message });
  }

  if (sent) {
    return (
      <Card tone="raised" className="p-7 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-100 text-success-600">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl text-chocolate-800">
          Xabaringiz yuborildi
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brown-400">
          Mehmonxona jamoasi xabaringizni koʻrib chiqadi va imkon qadar tez
          javob beradi.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>
          Yana xabar yuborish
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact-name" label="Ism" required error={errors.name?.message}>
          {(aria) => <Input {...aria} autoComplete="name" {...register('name')} />}
        </Field>
        <Field id="contact-email" label="Email" required error={errors.email?.message}>
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
      </div>

      <Field
        id="contact-phone"
        label="Telefon"
        hint="Ixtiyoriy — telefon orqali javob olishni xohlasangiz."
        error={errors.phone?.message}
      >
        {(aria) => (
          <Input {...aria} type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
        )}
      </Field>

      <Field id="contact-subject" label="Mavzu" required error={errors.subject?.message}>
        {(aria) => <Input {...aria} {...register('subject')} />}
      </Field>

      <Field id="contact-message" label="Xabar" required error={errors.message?.message}>
        {(aria) => <Textarea {...aria} rows={5} {...register('message')} />}
      </Field>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">Veb-sayt</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

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
        size="lg"
        block
        loading={isSubmitting}
        loadingLabel="Yuborilmoqda…"
      >
        <Send aria-hidden="true" />
        Xabarni yuborish
      </Button>

      <p className="text-xs leading-relaxed text-brown-300">
        Yuborilgan maʼlumotlar faqat soʻrovingizga javob berish uchun ishlatiladi.
        Batafsil —{' '}
        <a href="/privacy" className="underline underline-offset-2">
          maxfiylik siyosati
        </a>
        .
      </p>
    </form>
  );
}
