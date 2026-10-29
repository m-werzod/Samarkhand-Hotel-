import type { Metadata } from 'next';
import { FileWarning } from 'lucide-react';

import { PageIntro } from '@/components/site/page-intro';
import { Prose } from '@/components/site/prose';
import { Card, Section } from '@/components/ui/surface';
import { getContent } from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Bron shartlari',
  description: 'Samarkhand Hotel bron qilish shartlari.',
  alternates: { canonical: '/terms' },
};

export default async function TermsPage() {
  const content = await getContent();

  return (
    <>
      <PageIntro
        eyebrow="Huquqiy"
        title="Bron shartlari"
        crumbs={[{ href: '/terms', label: 'Bron shartlari' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content">
          <Card tone="sand" className="mb-8 flex max-w-prose gap-3 p-5">
            <FileWarning className="size-5 shrink-0 text-warning-600" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-brown-400">
              Bu hujjat namuna shablon. Mehmonxona uni oʻz qoidalariga moslab
              tahrirlashi va tasdiqlashi kerak.
            </p>
          </Card>

          <Prose content={content.bookingTerms} />
        </div>
      </Section>
    </>
  );
}
