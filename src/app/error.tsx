'use client';

import * as React from 'react';
import Link from 'next/link';
import { Home, RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * `error.message` is deliberately not rendered. In production Next.js
 * replaces it with a generic string anyway, but in development it can carry
 * table names, query fragments and occasionally values — none of which
 * belongs on a guest's screen. The digest is shown instead so an operator can
 * correlate the report with a server log line.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[route-error]', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-danger-100 text-danger-600">
        <TriangleAlert className="size-8" aria-hidden="true" />
      </span>

      <h1 className="mt-6 font-display text-3xl text-chocolate-800 sm:text-4xl">
        Nimadir notoʻgʻri ketdi
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-brown-400">
        Sahifani yuklab boʻlmadi. Qaytadan urinib koʻring — muammo takrorlansa,
        mehmonxonaga telefon orqali bogʻlaning.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-brown-300">
          Xatolik kodi: {error.digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Qayta urinish
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">
            <Home aria-hidden="true" />
            Bosh sahifaga
          </Link>
        </Button>
      </div>
    </main>
  );
}
