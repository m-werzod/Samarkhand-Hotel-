import type { Metadata } from 'next';

import { BookingForm } from '@/components/site/booking-form';
import { criteriaFromParams } from '@/lib/domain/search-criteria';
import { PageIntro } from '@/components/site/page-intro';
import { EmptyState, Section } from '@/components/ui/surface';
import { getPublishedOffers, getPublishedRooms, getSettings } from '@/lib/data/queries';
import { calculateStayPrice } from '@/lib/domain/pricing';
import { nightsBetween } from '@/lib/domain/dates';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { PriceBreakdown } from '@/lib/domain/types';

export const metadata: Metadata = {
  title: 'Bron soʻrovi',
  description:
    'Samarkhand Hotel uchun bron soʻrovi yuboring. Mehmonxona soʻrovni koʻrib chiqib siz bilan bogʻlanadi.',
  alternates: { canonical: '/booking' },
  robots: { index: false, follow: true },
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const dict = getDictionary();

  const [settings, rooms, offers] = await Promise.all([
    getSettings(),
    getPublishedRooms(),
    getPublishedOffers(),
  ]);

  const criteria = criteriaFromParams(params, settings.timeZone);
  const roomIdParam = params.roomId;
  const initialRoomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam;

  /**
   * Estimates are computed on the server for every room up front.
   *
   * The alternative — recomputing in the browser as the guest switches rooms
   * — would mean shipping the pricing rules and the offer table to the
   * client, where neither can be trusted and both would drift from what the
   * server charges.
   */
  const nights = nightsBetween(criteria.checkIn, criteria.checkOut);
  const breakdownByRoom: Record<string, PriceBreakdown> = {};
  if (nights >= 1) {
    for (const room of rooms) {
      breakdownByRoom[room.id] = calculateStayPrice(
        room,
        {
          checkIn: criteria.checkIn,
          checkOut: criteria.checkOut,
          rooms: criteria.rooms,
        },
        offers,
        {
          taxRatePercent: settings.taxRatePercent,
          serviceFeeMinor: settings.serviceFeeMinor,
        },
      );
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Bron"
        title={dict.booking.inquiryTitle}
        description={dict.booking.inquiryIntro}
        crumbs={[{ href: '/booking', label: 'Bron soʻrovi' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content">
          {rooms.length > 0 ? (
            <BookingForm
              rooms={rooms}
              initialRoomId={initialRoomId ?? null}
              initialCriteria={criteria}
              breakdownByRoom={breakdownByRoom}
              currencyNote={`Narxlar ${settings.currency} valyutasida.`}
            />
          ) : (
            <EmptyState
              title="Hozircha bron qilish mumkin emas"
              description="Mehmonxona xonalarni qoʻshgach, bron soʻrovi yuborish imkoniyati ochiladi."
            />
          )}
        </div>
      </Section>
    </>
  );
}
