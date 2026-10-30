'use client';

import * as React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';

import { BRAND_COLOURS, BRAND_ICONS, type BrandIconKey } from '@/components/site/brand-icons';
import { trackEvent } from '@/lib/analytics/client';
import {
  formatPhoneForDisplay,
  toTelHref,
  toWhatsAppDigits,
} from '@/lib/domain/contact';
import { cn } from '@/lib/utils';
import type { HotelSettings } from '@/lib/domain/types';

/**
 * Contact channels, built from configured values only.
 *
 * A channel that has not been configured is not rendered. The site never
 * shows an Instagram or Telegram button that leads nowhere, and never implies
 * an account exists before its URL has been set in the admin.
 *
 * WhatsApp is a special case: having a phone number does not mean that number
 * is registered with WhatsApp. It is therefore driven by its own
 * `whatsappNumber` field, which an operator sets deliberately.
 */

export interface ContactChannel {
  key: string;
  /** Short name, for the button face. */
  label: string;
  /** The actual address or handle, shown underneath. */
  detail: string;
  href: string;
  icon: React.ElementType;
  external: boolean;
  /** Platform colour, when the channel is a social network. */
  colour?: string;
}

export function buildContactChannels(settings: HotelSettings): ContactChannel[] {
  const channels: ContactChannel[] = [];

  if (settings.phone) {
    channels.push({
      key: 'phone',
      label: 'Telefon',
      detail: formatPhoneForDisplay(settings.phone),
      href: toTelHref(settings.phone),
      icon: Phone,
      external: false,
    });
  }

  if (settings.email) {
    channels.push({
      key: 'email',
      label: 'Email',
      detail: settings.email,
      href: `mailto:${settings.email}`,
      icon: Mail,
      external: false,
    });
  }

  if (settings.whatsappNumber) {
    channels.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      detail: formatPhoneForDisplay(settings.whatsappNumber),
      // wa.me requires digits only, no leading plus.
      href: `https://wa.me/${toWhatsAppDigits(settings.whatsappNumber)}`,
      icon: BRAND_ICONS.whatsapp,
      external: true,
      colour: BRAND_COLOURS.whatsapp,
    });
  }

  const socials: { key: BrandIconKey; url: string | null; label: string }[] = [
    { key: 'telegram', url: settings.social.telegram, label: 'Telegram' },
    { key: 'instagram', url: settings.social.instagram, label: 'Instagram' },
    { key: 'facebook', url: settings.social.facebook, label: 'Facebook' },
    { key: 'youtube', url: settings.social.youtube, label: 'YouTube' },
  ];

  for (const social of socials) {
    if (!social.url) continue;
    channels.push({
      key: social.key,
      label: social.label,
      detail: handleFromUrl(social.url),
      href: social.url,
      icon: BRAND_ICONS[social.key],
      external: true,
      colour: BRAND_COLOURS[social.key],
    });
  }

  if (settings.address.mapsUrl) {
    channels.push({
      key: 'map',
      label: 'Xarita',
      detail: 'Yoʻnalishni ochish',
      href: settings.address.mapsUrl,
      icon: MapPin,
      external: true,
    });
  }

  return channels;
}

/** `https://t.me/samarkhand` -> `@samarkhand`, for a readable second line. */
function handleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    return path ? `@${path.split('/')[0]}` : url;
  } catch {
    return url;
  }
}

/* -------------------------------------------------------------------------- */
/* Card grid — used on the contact and location pages                          */
/* -------------------------------------------------------------------------- */

/**
 * Contact channels as a card grid rather than a row of pill buttons.
 *
 * The previous row put the raw phone number and email address on the button
 * faces, which made them different widths, wrapped awkwardly, and read as a
 * jumble. A card gives each channel a consistent footprint with the platform
 * name on the first line and the address on the second, which is the order
 * someone scans.
 */
export function ContactChannelCards({
  settings,
  className,
}: {
  settings: HotelSettings;
  className?: string;
}) {
  const channels = buildContactChannels(settings);
  if (channels.length === 0) return null;

  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2', className)}>
      {channels.map((channel) => (
        <li key={channel.key}>
          <a
            href={channel.href}
            {...(channel.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            onClick={() =>
              trackEvent({
                type: 'contact_action_clicked',
                metadata: { channel: channel.key },
              })
            }
            className={cn(
              'group flex min-h-16 items-center gap-3.5 rounded-lg border border-sand-300',
              'bg-ivory-50 px-4 py-3 transition-all duration-200',
              'hover:-translate-y-0.5 hover:border-brown-300 hover:shadow-[var(--shadow-card)]',
            )}
          >
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                'bg-sand-200 text-brown-500 transition-colors',
                'group-hover:bg-brown-500 group-hover:text-ivory-50',
              )}
              style={
                channel.colour
                  ? ({ '--brand': channel.colour } as React.CSSProperties)
                  : undefined
              }
            >
              <channel.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-chocolate-800">
                {channel.label}
              </span>
              {/*
                Wrapped rather than truncated: a half-shown email address is
                worse than a two-line one, because the guest cannot read it
                and cannot tell that it has been cut.
              */}
              <span className="block break-all text-sm leading-snug text-brown-400">
                {channel.detail}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline button row — used where space is tight                               */
/* -------------------------------------------------------------------------- */

export function ContactChannelButtons({
  settings,
  className,
  tone = 'light',
}: {
  settings: HotelSettings;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const channels = buildContactChannels(settings);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {channels.map((channel) => (
        <a
          key={channel.key}
          href={channel.href}
          {...(channel.external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          onClick={() =>
            trackEvent({
              type: 'contact_action_clicked',
              metadata: { channel: channel.key },
            })
          }
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium',
            'transition-colors',
            tone === 'dark'
              ? 'border border-ivory-50/25 text-ivory-100 hover:border-gold-400 hover:text-gold-300'
              : 'border border-sand-300 text-chocolate-700 hover:border-brown-400 hover:bg-sand-200/60',
          )}
        >
          <channel.icon className="size-4" />
          {channel.label}
        </a>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer icon row                                                             */
/* -------------------------------------------------------------------------- */

export function ContactIconRow({
  settings,
  className,
}: {
  settings: HotelSettings;
  className?: string;
}) {
  const channels = buildContactChannels(settings).filter((channel) =>
    ['whatsapp', 'telegram', 'instagram', 'facebook', 'youtube'].includes(channel.key),
  );

  if (channels.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {channels.map((channel) => (
        <li key={channel.key}>
          <a
            href={channel.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent({
                type: 'contact_action_clicked',
                metadata: { channel: channel.key, placement: 'footer' },
              })
            }
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full',
              'border border-ivory-50/20 text-ivory-100/80',
              'transition-all duration-200 hover:scale-105 hover:border-transparent hover:text-ivory-50',
            )}
            style={{ ['--brand' as string]: channel.colour ?? '#C9A227' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = channel.colour ?? '#C9A227';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = '';
            }}
          >
            <channel.icon className="size-[1.125rem]" />
            <span className="sr-only">{channel.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export { formatPhoneForDisplay };
