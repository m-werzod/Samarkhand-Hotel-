import 'server-only';

import { serverSecret } from '@/lib/env';
import { formatMoney } from '@/lib/domain/money';
import { formatPhoneForDisplay } from '@/lib/domain/contact';
import type { Booking, ContactInquiry, Room } from '@/lib/domain/types';

/**
 * Notification layer.
 *
 * Three adapters behind one interface. Which runs depends purely on what is
 * configured:
 *
 *  - **Resend** when `RESEND_API_KEY` is set.
 *  - **Telegram** when both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are.
 *  - **Console** otherwise.
 *
 * The console adapter is not a pretend success. It writes the message to the
 * server log and the result it returns says `delivered: false`, so the UI and
 * the admin dashboard can both say plainly that no message left the building.
 * Telling a guest "we have emailed you" when nothing was sent is the kind of
 * lie that costs a hotel a booking it thinks it has.
 */

export interface NotificationResult {
  channel: 'email' | 'telegram' | 'console';
  delivered: boolean;
  detail: string;
}

export interface NotificationAdapter {
  readonly channel: NotificationResult['channel'];
  send(message: NotificationMessage): Promise<NotificationResult>;
}

export interface NotificationMessage {
  subject: string;
  body: string;
  /** Email adapters only. */
  to?: string;
}

/* -------------------------------------------------------------------------- */
/* Adapters                                                                    */
/* -------------------------------------------------------------------------- */

class ConsoleAdapter implements NotificationAdapter {
  readonly channel = 'console' as const;

  async send(message: NotificationMessage): Promise<NotificationResult> {
    console.info(
      `[notification:not-sent] ${message.subject}\n${message.body}\n` +
        '(No provider configured — set RESEND_API_KEY or TELEGRAM_BOT_TOKEN. ' +
        'See docs/DEPLOYMENT.md.)',
    );
    return {
      channel: 'console',
      delivered: false,
      detail: 'Xabarnoma provayderi sozlanmagan — xabar yuborilmadi.',
    };
  }
}

class ResendAdapter implements NotificationAdapter {
  readonly channel = 'email' as const;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    if (!message.to) {
      return { channel: 'email', delivered: false, detail: 'No recipient.' };
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.body,
        }),
      });

      if (!response.ok) {
        // The provider's body can echo the recipient address, so it is logged
        // rather than returned.
        console.error('[notification:email] failed', response.status);
        return {
          channel: 'email',
          delivered: false,
          detail: `Email provider returned ${response.status}.`,
        };
      }
      return { channel: 'email', delivered: true, detail: 'Email yuborildi.' };
    } catch (error) {
      console.error('[notification:email] error', error);
      return { channel: 'email', delivered: false, detail: 'Email yuborilmadi.' };
    }
  }
}

class TelegramAdapter implements NotificationAdapter {
  readonly channel = 'telegram' as const;

  constructor(
    private readonly token: string,
    private readonly chatId: string,
  ) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: `${message.subject}\n\n${message.body}`,
            disable_web_page_preview: true,
          }),
        },
      );

      if (!response.ok) {
        console.error('[notification:telegram] failed', response.status);
        return {
          channel: 'telegram',
          delivered: false,
          detail: `Telegram returned ${response.status}.`,
        };
      }
      return {
        channel: 'telegram',
        delivered: true,
        detail: 'Telegram xabari yuborildi.',
      };
    } catch (error) {
      console.error('[notification:telegram] error', error);
      return {
        channel: 'telegram',
        delivered: false,
        detail: 'Telegram xabari yuborilmadi.',
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/** Adapters for messages addressed to hotel staff. */
export function getStaffAdapters(): NotificationAdapter[] {
  const adapters: NotificationAdapter[] = [];

  const telegramToken = serverSecret('TELEGRAM_BOT_TOKEN');
  const telegramChat = serverSecret('TELEGRAM_CHAT_ID');
  if (telegramToken && telegramChat) {
    adapters.push(new TelegramAdapter(telegramToken, telegramChat));
  }

  const resendKey = serverSecret('RESEND_API_KEY');
  const from = serverSecret('NOTIFICATION_FROM_EMAIL');
  if (resendKey && from) {
    adapters.push(new ResendAdapter(resendKey, from));
  }

  return adapters.length > 0 ? adapters : [new ConsoleAdapter()];
}

/** Adapter for messages addressed to a guest. Email only. */
export function getGuestAdapter(): NotificationAdapter {
  const resendKey = serverSecret('RESEND_API_KEY');
  const from = serverSecret('NOTIFICATION_FROM_EMAIL');
  if (resendKey && from) return new ResendAdapter(resendKey, from);
  return new ConsoleAdapter();
}

/* -------------------------------------------------------------------------- */
/* Message composition                                                         */
/* -------------------------------------------------------------------------- */

export function composeBookingStaffMessage(
  booking: Booking,
  room: Room | null,
): NotificationMessage {
  return {
    subject: `Yangi bron soʻrovi — ${booking.reference}`,
    body: [
      `Soʻrov raqami: ${booking.reference}`,
      `Mehmon: ${booking.guest.fullName}`,
      `Telefon: ${formatPhoneForDisplay(booking.guest.phone)}`,
      `Email: ${booking.guest.email}`,
      `Xona: ${room?.name ?? booking.roomId}`,
      `Sanalar: ${booking.checkIn} → ${booking.checkOut}`,
      `Mehmonlar: ${booking.adults} kattalar, ${booking.children} bola, ${booking.rooms} xona`,
      `Taxminiy narx: ${formatMoney(booking.priceEstimate)}`,
      booking.specialRequests ? `Izoh: ${booking.specialRequests}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function composeBookingGuestMessage(
  booking: Booking,
  room: Room | null,
  brandName: string,
): NotificationMessage {
  return {
    to: booking.guest.email,
    subject: `${brandName} — bron soʻrovingiz qabul qilindi (${booking.reference})`,
    body: [
      `Assalomu alaykum, ${booking.guest.fullName}.`,
      '',
      `Soʻrovingiz qabul qilindi. Soʻrov raqami: ${booking.reference}.`,
      '',
      `Xona: ${room?.name ?? ''}`,
      `Sanalar: ${booking.checkIn} → ${booking.checkOut}`,
      `Taxminiy narx: ${formatMoney(booking.priceEstimate)}`,
      '',
      'Diqqat: bu — bron soʻrovi, tasdiqlangan rezervatsiya emas.',
      'Mehmonxona siz bilan bogʻlanib, bronni tasdiqlaydi.',
      '',
      brandName,
    ].join('\n'),
  };
}

export function composeInquiryStaffMessage(
  inquiry: ContactInquiry,
): NotificationMessage {
  return {
    subject: `Yangi xabar — ${inquiry.subject}`,
    body: [
      `Ism: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      inquiry.phone ? `Telefon: ${formatPhoneForDisplay(inquiry.phone)}` : null,
      '',
      inquiry.message,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

/**
 * Fan out to every configured staff adapter.
 *
 * Never throws: a notification failure must not roll back a booking that is
 * already safely persisted. The results come back so the caller can report
 * what actually happened.
 */
export async function notifyStaff(
  message: NotificationMessage,
  staffEmail?: string,
): Promise<NotificationResult[]> {
  const adapters = getStaffAdapters();
  return Promise.all(
    adapters.map((adapter) =>
      adapter
        .send({ ...message, to: message.to ?? staffEmail })
        .catch((error: unknown): NotificationResult => {
          console.error('[notification] adapter threw', error);
          return {
            channel: adapter.channel,
            delivered: false,
            detail: 'Adapter error.',
          };
        }),
    ),
  );
}
