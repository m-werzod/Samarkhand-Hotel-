import type { Metadata } from 'next';
import { FileWarning } from 'lucide-react';

import { PageIntro } from '@/components/site/page-intro';
import { Prose } from '@/components/site/prose';
import { Card, Section } from '@/components/ui/surface';
import { getContent } from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Maxfiylik siyosati',
  description: 'Samarkhand Hotel maxfiylik siyosati.',
  alternates: { canonical: '/privacy' },
};

export default async function PrivacyPage() {
  const content = await getContent();

  return (
    <>
      <PageIntro
        eyebrow="Huquqiy"
        title="Maxfiylik siyosati"
        crumbs={[{ href: '/privacy', label: 'Maxfiylik siyosati' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content">
          {/*
            Legal text is a template until a lawyer has read it. Saying so on
            the page itself is more honest than letting it look reviewed.
          */}
          <Card tone="sand" className="mb-8 flex max-w-prose gap-3 p-5">
            <FileWarning className="size-5 shrink-0 text-warning-600" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-brown-400">
              Bu hujjat namuna shablon boʻlib, huquqiy maslahat emas. Mehmonxona
              ishga tushirilishidan oldin yurist tomonidan koʻrib chiqilishi va
              tasdiqlanishi shart.
            </p>
          </Card>

          <Prose content={content.privacyPolicy} />
        </div>
      </Section>
    </>
  );
}
