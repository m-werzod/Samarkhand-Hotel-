'use server';

import { headers } from 'next/headers';

import { getStore } from '@/lib/data';
import { ConflictError } from '@/lib/data/store';
import {
  checkAvailability,
  generateBookingReference,
} from '@/lib/domain/booking';
import { validateOccupancy, validateStay } from '@/lib/domain/dates';
import { calculateStayPrice } from '@/lib/domain/pricing';
import { roomFitsOccupancy } from '@/lib/domain/dates';
import {
  composeBookingGuestMessage,
  composeBookingStaffMessage,
  getGuestAdapter,
  notifyStaff,
} from '@/lib/notifications';
import { RATE_LIMITS, clientKey, rateLimit } from '@/lib/security/rate-limit';
import { bookingInquirySchema, contactFormSchema } from '@/lib/validation/schemas';

/**
 * Public mutations.
 *
 * Every one of these re-validates from scratch. The client has already run
 * the same Zod schema, but nothing it sends is trusted: the price in
 * particular is recomputed here from the stored room and offer records and
 * the submitted figure is ignored entirely, because a price that arrives
 * from a browser is a price an attacker chose.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  /** Message safe to show a guest. Never contains internals. */
  message: string;
  /** Field-level errors keyed by form field name. */
  fieldErrors?: Record<string, string>;
  data?: T;
}

export interface BookingSuccess {
  reference: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalMinor: number;
  currency: string;
  /** Whether a confirmation actually left the server. */
  notificationDelivered: boolean;
}

/* -------------------------------------------------------------------------- */
/* Booking inquiry                                                             */
/* -------------------------------------------------------------------------- */

export async function submitBookingInquiry(
  input: unknown,
): Promise<ActionResult<BookingSuccess>> {
  const requestHeaders = await headers();

  const limit = rateLimit(
    clientKey(requestHeaders, 'booking'),
    RATE_LIMITS.bookingInquiry,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Juda koʻp soʻrov yuborildi. ${Math.ceil(limit.retryAfter / 60)} daqiqadan soʻng urinib koʻring.`,
    };
  }

  const parsed = bookingInquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Formadagi maʼlumotlarni tekshiring.',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const data = parsed.data;

  // The honeypot is checked after parsing so a bot gets the same shape of
  // response as a human with a validation error — no oracle for probing.
  if (data.website && data.website.length > 0) {
    return { ok: false, message: 'Soʻrovni yuborib boʻlmadi.' };
  }

  const store = getStore();
  const settings = await store.getHotelSettings();

  const stay = validateStay(data.checkIn, data.checkOut, {
    timeZone: settings.timeZone,
  });
  if (!stay.ok) {
    return {
      ok: false,
      message: 'Tanlangan sanalar notoʻgʻri.',
      fieldErrors: { checkIn: 'Sanalarni qaytadan tanlang.' },
    };
  }

  const occupancy = validateOccupancy({
    adults: data.adults,
    children: data.children,
    rooms: data.rooms,
  });
  if (!occupancy.ok) {
    return {
      ok: false,
      message: 'Mehmonlar soni notoʻgʻri.',
      fieldErrors: { adults: 'Mehmonlar sonini tekshiring.' },
    };
  }

  const room = await store.getRoomById(data.roomId);
  if (!room || room.status !== 'published') {
    return {
      ok: false,
      message: 'Bu xona hozircha bron qilish uchun ochiq emas.',
      fieldErrors: { roomId: 'Boshqa xona tanlang.' },
    };
  }

  if (!roomFitsOccupancy(room, data)) {
    return {
      ok: false,
      message: 'Tanlangan xona bu mehmonlar soniga mos kelmaydi.',
      fieldErrors: { roomId: 'Kattaroq xona tanlang.' },
    };
  }

  // Availability is advisory here and authoritative inside the SQL function;
  // this check exists to give a clear message rather than a constraint error.
  if (room.inventoryCount > 0) {
    const existing = await store.findOverlappingBookings({
      roomId: room.id,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
    });
    const availability = checkAvailability(room, data, existing);
    if (availability.inventoryTracked && !availability.available) {
      return {
        ok: false,
        message: 'Tanlangan sanalarda bu xona band. Boshqa sana yoki xona tanlang.',
        fieldErrors: { checkIn: 'Bu sanalarda joy yoʻq.' },
      };
    }
  }

  // The authoritative price. Whatever the client sent is discarded.
  const offers = await store.listOffers(['published']);
  const breakdown = calculateStayPrice(
    room,
    { checkIn: data.checkIn, checkOut: data.checkOut, rooms: data.rooms },
    offers,
    {
      taxRatePercent: settings.taxRatePercent,
      serviceFeeMinor: settings.serviceFeeMinor,
    },
  );

  try {
    const booking = await store.createBooking({
      booking: {
        reference: generateBookingReference(),
        guest: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
        },
        roomId: room.id,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        adults: data.adults,
        children: data.children,
        rooms: data.rooms,
        priceEstimate: breakdown.total,
        priceBreakdown: breakdown,
        status: 'pending',
        specialRequests: data.specialRequests?.trim() || null,
        internalNotes: null,
      },
    });

    // Notifications run after the booking is safely persisted and can never
    // fail the request — the hotel has the record either way.
    const staffResults = await notifyStaff(
      composeBookingStaffMessage(booking, room),
      settings.email,
    );
    const guestResult = await getGuestAdapter()
      .send(composeBookingGuestMessage(booking, room, settings.brandName))
      .catch(() => ({ delivered: false }));

    await store.recordAudit({
      actor: 'guest',
      action: 'booking.created',
      entityType: 'booking',
      entityId: booking.id,
      changes: null,
    });

    return {
      ok: true,
      message: 'Soʻrovingiz qabul qilindi.',
      data: {
        reference: booking.reference,
        roomName: room.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalMinor: breakdown.total.amount,
        currency: breakdown.total.currency,
        notificationDelivered:
          guestResult.delivered || staffResults.some((r) => r.delivered),
      },
    };
  } catch (error) {
    if (error instanceof ConflictError) {
      const message =
        error.message === 'room_unavailable'
          ? 'Tanlangan sanalarda bu xona band.'
          : error.message === 'room_not_bookable'
            ? 'Bu xona hozircha bron qilish uchun ochiq emas.'
            : 'Soʻrovni saqlab boʻlmadi. Qaytadan urinib koʻring.';
      return { ok: false, message };
    }
    console.error('[booking] unexpected failure', error);
    return {
      ok: false,
      message: 'Soʻrovni yuborib boʻlmadi. Birozdan soʻng qayta urinib koʻring.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Contact form                                                                */
/* -------------------------------------------------------------------------- */

export async function submitContactForm(input: unknown): Promise<ActionResult> {
  const requestHeaders = await headers();

  const limit = rateLimit(
    clientKey(requestHeaders, 'contact'),
    RATE_LIMITS.contactForm,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Juda koʻp soʻrov yuborildi. ${Math.ceil(limit.retryAfter / 60)} daqiqadan soʻng urinib koʻring.`,
    };
  }

  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Formadagi maʼlumotlarni tekshiring.',
      fieldErrors: flattenZodErrors(parsed.error.issues),
    };
  }

  const data = parsed.data;
  if (data.website && data.website.length > 0) {
    return { ok: false, message: 'Xabarni yuborib boʻlmadi.' };
  }

  try {
    const store = getStore();
    const inquiry = await store.createInquiry({
      name: data.name,
      email: data.email,
      phone: data.phone?.trim() || null,
      subject: data.subject,
      message: data.message,
      status: 'new',
      internalNotes: null,
    });

    const settings = await store.getHotelSettings();
    const { composeInquiryStaffMessage } = await import('@/lib/notifications');
    await notifyStaff(composeInquiryStaffMessage(inquiry), settings.email);

    return { ok: true, message: 'Xabaringiz yuborildi. Tez orada javob beramiz.' };
  } catch (error) {
    console.error('[contact] unexpected failure', error);
    return {
      ok: false,
      message: 'Xabarni yuborib boʻlmadi. Birozdan soʻng qayta urinib koʻring.',
    };
  }
}

/* -------------------------------------------------------------------------- */

interface ZodLikeIssue {
  path: (string | number | symbol)[];
  message: string;
}

/** First error per field, in the shape react-hook-form expects. */
function flattenZodErrors(issues: ZodLikeIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
