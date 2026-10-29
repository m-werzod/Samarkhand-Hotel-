import type { Metadata } from 'next';
import { MapPin, Navigation } from 'lucide-react';

import { ContactChannelButtons } from '@/components/site/contact-links';
import { MediaImage } from '@/components/site/media-image';
import { PageIntro } from '@/components/site/page-intro';
import { Button } from '@/components/ui/button';
import { Card, DemoBadge, Section } from '@/components/ui/surface';
import { getMediaIndex, getSettings } from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Manzil',
  description: 'Samarkhand Hotel manzili va yoʻnalish.',
  alternates: { canonical: '/location' },
};

export default async function LocationPage() {
  const [settings, media] = await Promise.all([getSettings(), getMediaIndex()]);
  const { address } = settings;

  const hasCoordinates = address.latitude !== null && address.longitude !== null;
  const mapsHref =
    address.mapsUrl ??
    (hasCoordinates
      ? `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`
      : null);

  return (
    <>
      <PageIntro
        eyebrow="Manzil"
        title="Qayerdamiz"
        description="Mehmonxona manzili va unga qanday yetib borish haqida."
        crumbs={[{ href: '/location', label: 'Manzil' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className="font-display text-2xl text-chocolate-800">Manzil</h2>
            <address className="mt-4 text-base not-italic leading-relaxed text-brown-400">
              <span className="flex items-start gap-3">
                <MapPin className="mt-1 size-5 shrink-0 text-brown-300" aria-hidden="true" />
                <span>
                  {address.line1}
                  {address.line2 ? (
                    <>
                      <br />
                      {address.line2}
                    </>
                  ) : null}
                  <br />
                  {address.city}
                  {address.region ? `, ${address.region}` : ''}
                  {address.postalCode ? ` ${address.postalCode}` : ''}
                  <br />
                  {address.country}
                </span>
              </span>
            </address>

            {settings.isDemoData ? (
              <Card tone="sand" className="mt-5 flex flex-wrap items-center gap-3 p-4">
                <DemoBadge />
                <p className="text-sm leading-relaxed text-brown-400">
                  Bu manzil namuna sifatida kiritilgan. Haqiqiy manzil mehmonxona
                  maʼmuri tomonidan kiritilgandan soʻng koʻrsatiladi.
                </p>
              </Card>
            ) : null}

            <div className="mt-7">
              <h3 className="font-display text-xl text-chocolate-800">Bogʻlanish</h3>
              <ContactChannelButtons settings={settings} className="mt-3" />
            </div>

            {mapsHref ? (
              <Button asChild size="lg" className="mt-6">
                <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden="true" />
                  Yoʻnalishni ochish
                </a>
              </Button>
            ) : (
              /*
                No invented map. Without verified coordinates or a map URL,
                dropping a pin somewhere plausible in Samarkand would send a
                guest to a building that is not the hotel.
              */
              <Card tone="sand" className="mt-6 p-5">
                <h3 className="font-medium text-chocolate-800">Xarita</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brown-400">
                  Xarita hali ulanmagan. Mehmonxona koordinatalari yoki Google
                  Maps havolasi admin panelda kiritilgandan soʻng, shu yerda
                  interaktiv xarita va yoʻnalish tugmasi paydo boʻladi.
                </p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <MediaImage
              asset={media.get('media-exterior-dusk') ?? null}
              sizes="(min-width: 1024px) 560px, 100vw"
              aspect="4 / 3"
              className="rounded-xl shadow-[var(--shadow-card)]"
              showIllustrationNote
            />
            <MediaImage
              asset={media.get('media-detail-arch') ?? null}
              sizes="(min-width: 1024px) 560px, 100vw"
              aspect="16 / 9"
              className="rounded-xl shadow-[var(--shadow-card)]"
              showIllustrationNote
            />
          </div>
        </div>
      </Section>
    </>
  );
}
