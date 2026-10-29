import type { Metadata } from 'next';

import { LoginForm } from '@/components/admin/login-form';
import { Logo } from '@/components/site/logo';
import { isAuthConfigured } from '@/lib/auth';
import { getRuntimeMode } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Admin kirish',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = params.next;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;

  const configured = isAuthConfigured();
  const mode = getRuntimeMode();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-chocolate-800 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variant="stackedOnDark" height={120} alt="Samarkhand Hotel" />
        </div>

        <div className="rounded-xl bg-ivory-50 p-6 shadow-[var(--shadow-overlay)] sm:p-7">
          <h1 className="font-display text-2xl text-chocolate-800">
            Boshqaruv paneli
          </h1>
          <p className="mt-1.5 text-sm text-brown-400">
            Davom etish uchun hisobingizga kiring.
          </p>

          {configured ? (
            <div className="mt-6">
              <LoginForm nextPath={next} />
            </div>
          ) : (
            /*
              No account exists yet, and the platform will not invent one.
              A default admin login shipped in source is a back door that
              survives into production.
            */
            <div className="mt-6 rounded-lg border border-warning-600/30 bg-warning-100 p-4">
              <h2 className="text-sm font-semibold text-warning-600">
                Administrator hisobi yaratilmagan
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-warning-600/90">
                Xavfsizlik uchun bu loyihada standart administrator hisobi yoʻq.
                Hisobni yaratish uchun quyidagi buyruqni ishga tushiring va
                chiqqan qiymatlarni muhit oʻzgaruvchilariga qoʻshing:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-chocolate-800 px-3 py-2.5 text-xs text-ivory-100">
                npm run admin:hash
              </pre>
              <p className="mt-3 text-xs leading-relaxed text-warning-600/90">
                Batafsil koʻrsatma: <code>docs/DEPLOYMENT.md</code>
              </p>
            </div>
          )}

          <p className="mt-6 border-t border-sand-300 pt-4 text-xs text-brown-300">
            Rejim: {mode === 'supabase' ? 'Supabase' : 'Demo (xotirada)'}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-ivory-100/50">
          <a href="/" className="underline underline-offset-2 hover:text-ivory-100/80">
            Saytga qaytish
          </a>
        </p>
      </div>
    </main>
  );
}
