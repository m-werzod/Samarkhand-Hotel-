'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, TriangleAlert } from 'lucide-react';

import { loginAction } from '@/app/admin/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { adminLoginSchema, type AdminLoginInput } from '@/lib/validation/schemas';

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: AdminLoginInput) {
    setError(null);
    const result = await loginAction(values, nextPath);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // refresh() first so the layout re-renders with the new session before
    // the push lands; otherwise the dashboard can paint as signed out.
    router.refresh();
    router.push(result.redirectTo ?? '/admin');
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field id="admin-email" label="Email" required error={errors.email?.message}>
        {(aria) => (
          <Input
            {...aria}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            {...register('email')}
          />
        )}
      </Field>

      <Field id="admin-password" label="Parol" required error={errors.password?.message}>
        {(aria) => (
          <div className="relative">
            <Input
              {...aria}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-12"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-brown-400 transition-colors hover:bg-sand-200"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {showPassword ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
              </span>
            </button>
          </div>
        )}
      </Field>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger-100 px-3.5 py-3 text-sm leading-relaxed text-danger-600"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        block
        loading={isSubmitting}
        loadingLabel="Tekshirilmoqda…"
      >
        <LogIn aria-hidden="true" />
        Kirish
      </Button>
    </form>
  );
}
