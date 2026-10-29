import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

import { AmenityIcon } from '@/components/site/amenity-icon';
import { MediaImage } from '@/components/site/media-image';
import { PageIntro } from '@/components/site/page-intro';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Section, SectionHeading } from '@/components/ui/surface';
import { getActiveAmenities, getMediaIndex, getSettings } from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Qulayliklar',
  description:
    'Samarkhand Hotel qulayliklari: Wi-Fi, nonushta, avtoturargoh, konditsioner, restoran va boshqalar.',
  alternates: { canonical: '/amenities' },
};

export default async function AmenitiesPage() {
  const [amenities, settings, media] = await Promise.all([
    getActiveAmenities(),
    getSettings(),
    getMediaIndex(),
  ]);

  return (
    <>
      <PageIntro
        eyebrow="Qulayliklar"
        title="Mehmonxona xizmatlari"
        description="Quyida faqat yoqilgan xizmatlar koʻrsatiladi. Roʻyxat mehmonxona maʼmuri tomonidan boshqariladi, shuning uchun bu yerda koʻrinmagan xizmat hozircha taklif qilinmaydi."
        crumbs={[{ href: '/amenities', label: 'Qulayliklar' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content">
          {amenities.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((amenity) => (
                <li key={amenity.id}>
                  <Card tone="plain" className="h-full p-6">
                    <span className="flex size-12 items-center justify-center rounded-full bg-brown-500/10 text-brown-500">
                      <AmenityIcon iconKey={amenity.iconKey} className="size-6" />
                    </span>
                    <h2 className="mt-4 font-display text-xl text-chocolate-800">
                      {amenity.name}
                    </h2>
                    {amenity.description ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-brown-400">
                        {amenity.description}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Qulayliklar roʻyxati hali toʻldirilmagan"
              description="Mehmonxona maʼmuri xizmatlarni qoʻshgach, ular shu yerda koʻrinadi."
            />
          )}
        </div>
      </Section>

      <Section tone="sand">
        <div className="container-content grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <MediaImage
            asset={media.get('media-restaurant') ?? null}
            sizes="(min-width: 1024px) 560px, 100vw"
            aspect="4 / 3"
            className="rounded-xl shadow-[var(--shadow-card)]"
            showIllustrationNote
          />
          <div>
            <SectionHeading
              eyebrow="Kun tartibi"
              title="Kelish, nonushta va chiqish"
            />
            <dl className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="mt-1 size-5 shrink-0 text-brown-400" aria-hidden="true" />
                <div>
                  <dt className="font-medium text-chocolate-800">Kelish</dt>
                  <dd className="text-sm text-brown-400">
                    Soat {settings.checkInTime} dan. Kechroq kelsangiz, oldindan
                    xabar bering — qabulxona sutkasiga 24 soat ishlaydi.
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-1 size-5 shrink-0 text-brown-400" aria-hidden="true" />
                <div>
                  <dt className="font-medium text-chocolate-800">Chiqish</dt>
                  <dd className="text-sm text-brown-400">
                    Soat {settings.checkOutTime} gacha. Kechroq chiqish imkoniyati
                    band boʻlmagan kunlarda mavjud.
                  </dd>
                </div>
              </div>
            </dl>

            <Button asChild size="lg" className="mt-7">
              <Link href="/booking">
                Bron soʻrovi yuborish
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
