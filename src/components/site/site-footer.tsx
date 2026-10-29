import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';

import { Logo } from '@/components/site/logo';
import { ContactIconRow, formatPhoneForDisplay } from '@/components/site/contact-links';
import { DemoBadge } from '@/components/ui/surface';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { HotelSettings, SiteContent } from '@/lib/domain/types';

export function SiteFooter({
  settings,
  content,
}: {
  settings: HotelSettings;
  content: SiteContent;
}) {
  const dict = getDictionary();
  const year = new Date().getFullYear();

  const addressLines = [
    settings.address.line1,
    settings.address.line2,
    [settings.address.postalCode, settings.address.city].filter(Boolean).join(' '),
    settings.address.country,
  ].filter((line): line is string => Boolean(line && line.length > 0));

  return (
    <footer className="bg-chocolate-800 text-ivory-100">
      <div className="container-content py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          {/* Brand */}
          <div>
            <Logo variant="onDark" height={38} priority={false} alt="Samarkhand Hotel" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory-100/70">
              {content.footerBlurb}
            </p>
            <ContactIconRow settings={settings} className="mt-5" />
          </div>

          {/* Navigation */}
          <nav aria-labelledby="footer-nav">
            <h2
              id="footer-nav"
              className="font-display text-lg text-ivory-50"
            >
              Sahifalar
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { href: '/rooms', label: dict.nav.rooms },
                { href: '/amenities', label: dict.nav.amenities },
                { href: '/gallery', label: dict.nav.gallery },
                { href: '/offers', label: dict.nav.offers },
                { href: '/location', label: dict.nav.location },
                { href: '/contact', label: dict.nav.contact },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-ivory-100/70 transition-colors hover:text-gold-300"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-labelledby="footer-legal">
            <h2
              id="footer-legal"
              className="font-display text-lg text-ivory-50"
            >
              Huquqiy
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-ivory-100/70 transition-colors hover:text-gold-300"
                >
                  Maxfiylik siyosati
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-ivory-100/70 transition-colors hover:text-gold-300"
                >
                  Bron shartlari
                </Link>
              </li>
              <li>
                <Link
                  href="/booking"
                  className="text-ivory-100/70 transition-colors hover:text-gold-300"
                >
                  {dict.nav.book}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h2 className="font-display text-lg text-ivory-50">Aloqa</h2>
            <address className="mt-4 space-y-3 text-sm not-italic text-ivory-100/70">
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden="true" />
                <span>
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-gold-400" aria-hidden="true" />
                <a
                  href={`tel:${settings.phone}`}
                  className="transition-colors hover:text-gold-300"
                >
                  {formatPhoneForDisplay(settings.phone)}
                </a>
              </p>
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-gold-400" aria-hidden="true" />
                <a
                  href={`mailto:${settings.email}`}
                  className="transition-colors hover:text-gold-300"
                >
                  {settings.email}
                </a>
              </p>
            </address>

            <p className="mt-4 text-xs leading-relaxed text-ivory-100/55">
              Qabul: {settings.checkInTime} · Chiqish: {settings.checkOutTime}
            </p>
          </div>
        </div>

        {/*
          The honesty notice. While the hotel has not replaced the seeded
          details, say so plainly in the footer rather than letting a visitor
          assume the address and phone number are real.
        */}
        {settings.isDemoData ? (
          <div className="mt-10 flex flex-wrap items-center gap-3 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-3">
            <DemoBadge label="Demo" />
            <p className="text-xs leading-relaxed text-ivory-100/80">
              Ushbu saytdagi manzil, telefon raqami, narxlar va sharhlar namuna
              maʼlumotlar. Ular mehmonxona maʼmuri tomonidan haqiqiy maʼlumotlar
              bilan almashtirilishi kerak. Tasvirlar — kontseptual illyustratsiyalar.
            </p>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 border-t border-ivory-50/12 pt-6 text-xs text-ivory-100/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.brandName}. Barcha huquqlar himoyalangan.
          </p>
          <p>{settings.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
