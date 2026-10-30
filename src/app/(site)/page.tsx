import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, Quote, Star } from 'lucide-react';

import { AmenityIcon } from '@/components/site/amenity-icon';
import { CampaignCarousel } from '@/components/site/campaign-carousel';
import { ContactChannelButtons } from '@/components/site/contact-links';
import { Hero } from '@/components/site/hero';
import { MediaImage } from '@/components/site/media-image';
import { PageView } from '@/components/site/page-view';
import { RoomCard } from '@/components/site/room-card';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  DemoBadge,
  EmptyState,
  Section,
  SectionHeading,
} from '@/components/ui/surface';
import {
  getActiveAmenities,
  getContent,
  getGalleryMedia,
  getLiveCampaigns,
  getMediaIndex,
  getPublishedTestimonials,
  getRoomsWithPricing,
  getSettings,
} from '@/lib/data/queries';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [
    settings,
    content,
    campaigns,
    roomsWithPricing,
    amenities,
    testimonials,
    gallery,
    mediaIndex,
  ] = await Promise.all([
    getSettings(),
    getContent(),
    getLiveCampaigns(),
    getRoomsWithPricing(),
    getActiveAmenities(),
    getPublishedTestimonials(),
    getGalleryMedia(),
    getMediaIndex(),
  ]);

  const heroMedia = content.heroMediaId
    ? (mediaIndex.get(content.heroMediaId) ?? null)
    : null;
  const featuredRooms = roomsWithPricing.slice(0, 3);
  const galleryPreview = gallery.slice(0, 6);
  const aboutMedia = mediaIndex.get('media-lobby-lounge') ?? null;

  return (
    <>
      <PageView event="home_viewed" />

      <Hero content={content} settings={settings} heroMedia={heroMedia} />

      {/* --- Campaigns ------------------------------------------------- */}
      {campaigns.length > 0 ? (
        <Section tone="ivory" className="pt-12 sm:pt-14 lg:pt-16">
          <div className="container-content">
            <SectionHeading
              eyebrow="Takliflar"
              title="Joriy kampaniyalar"
              description="Faol takliflarimiz. Har biri mehmonxona maʼmuri tomonidan boshqariladi."
              className="mb-8"
            />
            <CampaignCarousel campaigns={campaigns} />
          </div>
        </Section>
      ) : null}

      {/* --- Featured rooms --------------------------------------------- */}
      <Section tone="sand" id="rooms">
        <div className="container-content">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Xonalar"
              title="Qulay va sokin xonalar"
              description="Har bir xona tabiiy yorugʻlik, sifatli toʻshak va tinch muhit bilan tayyorlangan."
            />
            <Button asChild variant="outline" size="md">
              <Link href="/rooms">
                Barcha xonalar
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {featuredRooms.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRooms.map(({ room, price }, index) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  price={price}
                  priority={index === 0}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Hozircha xona qoʻshilmagan"
              description="Mehmonxona maʼmuri xonalarni qoʻshgach, ular shu yerda koʻrinadi."
            />
          )}
        </div>
      </Section>

      {/* --- About ------------------------------------------------------ */}
      <Section tone="ivory">
        <div className="container-content grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <SectionHeading
              eyebrow="Biz haqimizda"
              title={content.aboutTitle}
            />
            <div className="mt-5 space-y-4 text-base leading-relaxed text-brown-400">
              {content.aboutBody.split('\n\n').map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>

            {content.benefits.length > 0 ? (
              <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                {content.benefits.map((benefit) => (
                  <li key={benefit.title} className="flex gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brown-500/10 text-brown-500">
                      <AmenityIcon iconKey={benefit.iconKey} className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg text-chocolate-800">
                        {benefit.title}
                      </h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-brown-400">
                        {benefit.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="order-1 lg:order-2">
            <MediaImage
              asset={aboutMedia}
              sizes="(min-width: 1024px) 560px, 100vw"
              aspect="4 / 5"
              className="rounded-xl shadow-[var(--shadow-card)]"
              showIllustrationNote
            />
          </div>
        </div>
      </Section>

      {/* --- Amenities --------------------------------------------------- */}
      <Section tone="dark">
        <div className="container-content">
          <SectionHeading
            eyebrow="Qulayliklar"
            title="Har kuni kerak boʻladigan narsalar"
            description="Faqat mehmonxonada mavjud xizmatlar koʻrsatiladi. Roʻyxat maʼmur tomonidan boshqariladi."
            tone="dark"
            align="center"
            className="mb-12"
          />

          {amenities.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {amenities.map((amenity) => (
                <li
                  key={amenity.id}
                  className="rounded-lg border border-ivory-50/12 bg-ivory-50/5 p-5 transition-colors hover:border-gold-400/40"
                >
                  <AmenityIcon
                    iconKey={amenity.iconKey}
                    className="size-6 text-gold-400"
                  />
                  <h3 className="mt-3 font-display text-lg text-ivory-50">
                    {amenity.name}
                  </h3>
                  {amenity.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-ivory-100/65">
                      {amenity.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-ivory-100/70">
              Qulayliklar roʻyxati hali toʻldirilmagan.
            </p>
          )}

          <div className="mt-10 text-center">
            <Button asChild variant="gold" size="lg">
              <Link href="/amenities">
                Batafsil koʻrish
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* --- Gallery preview --------------------------------------------- */}
      <Section tone="ivory">
        <div className="container-content">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Galereya"
              title="Mehmonxona ichidan"
              description="Barcha tasvirlar — Samarqand meʼmorchiligidan ilhomlangan kontseptual illyustratsiyalar."
            />
            <Button asChild variant="outline" size="md">
              <Link href="/gallery">
                Galereyani ochish
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
            {galleryPreview.map((asset, index) => (
              <Link
                key={asset.id}
                href="/gallery"
                className="group overflow-hidden rounded-lg"
              >
                <MediaImage
                  asset={asset}
                  sizes="(min-width: 1024px) 380px, 50vw"
                  aspect={index === 0 ? '4 / 3' : '4 / 3'}
                  imageClassName="transition-transform duration-500 group-hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </div>
      </Section>

      {/* --- Testimonials ------------------------------------------------ */}
      {testimonials.length > 0 ? (
        <Section tone="sand">
          <div className="container-content">
            <SectionHeading
              eyebrow="Mehmonlar fikri"
              title="Nima deyishadi"
              align="center"
              className="mb-4"
            />

            {/*
              Said before the quotes, not after: these are written samples,
              not reviews from real guests. Presenting invented praise as
              genuine feedback is the line this project does not cross.
            */}
            {testimonials.some((t) => t.isSample) ? (
              <p className="mx-auto mb-10 flex max-w-xl flex-wrap items-center justify-center gap-2 text-center text-sm text-brown-400">
                <DemoBadge label="Namuna" />
                Quyidagi sharhlar namuna matnlar. Ular haqiqiy mehmonlar tomonidan
                yozilmagan va tasdiqlanmagan.
              </p>
            ) : null}

            <ul className="grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <li key={testimonial.id}>
                  <Card tone="plain" className="h-full p-6">
                    <Quote
                      className="size-7 text-gold-400"
                      aria-hidden="true"
                    />
                    <blockquote className="mt-3 text-base leading-relaxed text-chocolate-700">
                      {testimonial.body}
                    </blockquote>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <cite className="text-sm not-italic text-brown-400">
                        {testimonial.authorLabel}
                      </cite>
                      {testimonial.rating ? (
                        <span
                          className="flex items-center gap-0.5"
                          aria-label={`Baho: ${testimonial.rating} / 5`}
                        >
                          {Array.from({ length: testimonial.rating }, (_, i) => (
                            <Star
                              key={i}
                              className="size-3.5 fill-gold-400 text-gold-400"
                              aria-hidden="true"
                            />
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      {/* --- Location + contact ------------------------------------------ */}
      <Section tone="ivory" id="location">
        <div className="container-content grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Manzil"
              title="Bizni topish oson"
            />
            <address className="mt-5 space-y-1 text-base not-italic leading-relaxed text-brown-400">
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-1 size-5 shrink-0 text-brown-300" aria-hidden="true" />
                <span>
                  {settings.address.line1}
                  {settings.address.line2 ? (
                    <>
                      <br />
                      {settings.address.line2}
                    </>
                  ) : null}
                  <br />
                  {settings.address.city}
                  {settings.address.region ? `, ${settings.address.region}` : ''}
                  <br />
                  {settings.address.country}
                </span>
              </p>
            </address>

            {settings.isDemoData ? (
              <p className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-warning-100 px-4 py-3 text-sm text-warning-600">
                <DemoBadge />
                Manzil hali tasdiqlanmagan namuna maʼlumot.
              </p>
            ) : null}

            <div className="mt-6">
              <ContactChannelButtons settings={settings} />
            </div>
          </div>

          <Card tone="sand" className="flex flex-col justify-center p-8">
            <Badge tone="brown" size="md" className="self-start">
              Bron qilish
            </Badge>
            <h3 className="mt-4 font-display text-3xl text-chocolate-800">
              Sanalaringizni tanlang, qolganini biz hal qilamiz
            </h3>
            <p className="mt-3 text-base leading-relaxed text-brown-400">
              Soʻrov yuboring — mehmonxona siz bilan bogʻlanib, bronni tasdiqlaydi.
              Saytda toʻlov qabul qilinmaydi va karta maʼlumotlari soʻralmaydi.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/booking">
                  Bron soʻrovi yuborish
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/contact">Savol berish</Link>
              </Button>
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
