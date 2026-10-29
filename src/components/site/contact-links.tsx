'use client';

import * as React from 'react';
import { Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics/client';
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
  label: string;
  href: string;
  icon: React.ElementType;
  /** Opens in a new tab. */
  external: boolean;
}

export function buildContactChannels(settings: HotelSettings): ContactChannel[] {
  const channels: ContactChannel[] = [];

  if (settings.phone) {
    channels.push({
      key: 'phone',
      label: formatPhoneForDisplay(settings.phone),
      href: `tel:${settings.phone}`,
      icon: Phone,
      external: false,
    });
  }

  if (settings.email) {
    channels.push({
      key: 'email',
      label: settings.email,
      href: `mailto:${settings.email}`,
      icon: Mail,
      external: false,
    });
  }

  if (settings.whatsappNumber) {
    // wa.me requires digits only, no leading plus.
    const digits = settings.whatsappNumber.replace(/\D/g, '');
    channels.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/${digits}`,
      icon: MessageCircle,
      external: true,
    });
  }

  if (settings.social.telegram) {
    channels.push({
      key: 'telegram',
      label: 'Telegram',
      href: settings.social.telegram,
      icon: Send,
      external: true,
    });
  }

  if (settings.social.instagram) {
    channels.push({
      key: 'instagram',
      label: 'Instagram',
      href: settings.social.instagram,
      icon: InstagramGlyph,
      external: true,
    });
  }

  if (settings.address.mapsUrl) {
    channels.push({
      key: 'map',
      label: 'Xaritada koʻrish',
      href: settings.address.mapsUrl,
      icon: MapPin,
      external: true,
    });
  }

  return channels;
}

/**
 * Instagram's glyph is a brand asset rather than a generic icon, so it is
 * drawn here rather than substituted with a lookalike or an emoji.
 */
function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** +998901234567 -> +998 90 123 45 67 */
export function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return raw;
}

export function ContactChannelButtons({
  settings,
  variant = 'outline',
  className,
  size = 'md',
}: {
  settings: HotelSettings;
  variant?: 'outline' | 'onDark' | 'secondary';
  size?: 'md' | 'lg';
  className?: string;
}) {
  const channels = buildContactChannels(settings);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {channels.map((channel) => (
        <Button
          key={channel.key}
          asChild
          variant={variant}
          size={size}
          onClick={() =>
            trackEvent({
              type: 'contact_action_clicked',
              metadata: { channel: channel.key },
            })
          }
        >
          <a
            href={channel.href}
            {...(channel.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            <channel.icon aria-hidden="true" />
            {channel.label}
          </a>
        </Button>
      ))}
    </div>
  );
}

/** Compact icon-only row, for the footer. */
export function ContactIconRow({
  settings,
  className,
}: {
  settings: HotelSettings;
  className?: string;
}) {
  const channels = buildContactChannels(settings).filter((c) =>
    ['whatsapp', 'telegram', 'instagram'].includes(c.key),
  );

  if (channels.length === 0) return null;

  return (
    <ul className={cn('flex items-center gap-2', className)}>
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
              'border border-ivory-50/25 text-ivory-100',
              'transition-colors hover:border-gold-400 hover:text-gold-300',
            )}
          >
            <channel.icon className="size-5" aria-hidden="true" />
            <span className="sr-only">{channel.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
