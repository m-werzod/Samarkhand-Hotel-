import type { Metadata } from 'next';

import { GalleryGrid } from '@/components/site/gallery-grid';
import { PageIntro } from '@/components/site/page-intro';
import { Section } from '@/components/ui/surface';
import { getContent, getGalleryMedia } from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Galereya',
  description:
    'Samarkhand Hotel galereyasi: tashqi koʻrinish, lobbi, xonalar, hammom va restoran tasvirlari.',
  alternates: { canonical: '/gallery' },
};

export default async function GalleryPage() {
  const [assets, content] = await Promise.all([getGalleryMedia(), getContent()]);

  return (
    <>
      <PageIntro
        eyebrow="Galereya"
        title="Mehmonxona tasvirlari"
        description="Barcha tasvirlar — Samarqand meʼmorchiligidan ilhomlangan kontseptual illyustratsiyalar. Ular haqiqiy fotosurat emas va mehmonxona ochilgach almashtiriladi."
        crumbs={[{ href: '/gallery', label: 'Galereya' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content">
          <GalleryGrid assets={assets} categories={content.galleryCategories} />
        </div>
      </Section>
    </>
  );
}
