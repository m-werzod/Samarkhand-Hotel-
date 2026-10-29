import Link from 'next/link';
import { ArrowLeft, BedDouble } from 'lucide-react';

import { Logo } from '@/components/site/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <Logo variant="stacked" height={110} alt="Samarkhand Hotel" />

      <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-brown-400">
        404
      </p>
      <h1 className="mt-3 font-display text-4xl text-chocolate-800 sm:text-5xl">
        Bu sahifa topilmadi
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-brown-400">
        Siz izlagan sahifa oʻchirilgan yoki manzil notoʻgʻri kiritilgan boʻlishi
        mumkin.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Bosh sahifaga
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/rooms">
            <BedDouble aria-hidden="true" />
            Xonalarni koʻrish
          </Link>
        </Button>
      </div>
    </main>
  );
}
