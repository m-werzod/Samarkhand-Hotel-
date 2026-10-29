'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Menu, Phone, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LogoLink } from '@/components/site/logo';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
}

/**
 * The site header.
 *
 * Desktop gets the full navigation. Below `lg` it collapses to logo, a call
 * button and a menu trigger — the two things a phone visitor actually reaches
 * for — with the rest behind a full-height panel.
 *
 * The header is transparent over the homepage hero and gains a solid
 * background once scrolled, so the hero artwork is never clipped by a bar
 * while text stays legible the moment it would overlap.
 */
export function SiteHeader({ phone }: { phone: string }) {
  const dict = getDictionary();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // Only the homepage puts artwork behind the header; everywhere else the
  // bar is solid from the first paint.
  const transparentUntilScroll = pathname === '/';

  const items: NavItem[] = [
    { href: '/rooms', label: dict.nav.rooms },
    { href: '/amenities', label: dict.nav.amenities },
    { href: '/gallery', label: dict.nav.gallery },
    { href: '/offers', label: dict.nav.offers },
    { href: '/location', label: dict.nav.location },
    { href: '/contact', label: dict.nav.contact },
  ];

  React.useEffect(() => {
    if (!transparentUntilScroll) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparentUntilScroll]);

  // Close the panel on navigation.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock background scroll while the panel is open.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
          solid
            ? 'border-b border-sand-300/70 bg-ivory-50/95 backdrop-blur-md'
            : 'bg-transparent',
        )}
      >
        <div className="container-content flex h-16 items-center justify-between gap-4 lg:h-20">
          <LogoLink variant={solid ? 'primary' : 'onDark'} height={34} />

          <nav
            aria-label="Asosiy menyu"
            className="hidden items-center gap-1 lg:flex"
          >
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    solid
                      ? 'text-chocolate-700 hover:bg-brown-500/10'
                      : 'text-ivory-50/90 hover:bg-ivory-50/15 hover:text-ivory-50',
                    active &&
                      (solid
                        ? 'bg-brown-500/10 text-chocolate-800'
                        : 'bg-ivory-50/20 text-ivory-50'),
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant={solid ? 'ghost' : 'onDark'}
              size="iconSm"
              className="lg:hidden"
            >
              <a href={`tel:${phone}`} aria-label="Mehmonxonaga qoʻngʻiroq qilish">
                <Phone aria-hidden="true" />
              </a>
            </Button>

            <Button
              asChild
              variant={solid ? 'primary' : 'onDark'}
              size="md"
              className="hidden sm:inline-flex"
            >
              <Link href="/booking">
                <CalendarCheck aria-hidden="true" />
                {dict.nav.book}
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-md transition-colors lg:hidden',
                solid
                  ? 'text-chocolate-800 hover:bg-brown-500/10'
                  : 'text-ivory-50 hover:bg-ivory-50/15',
              )}
            >
              {open ? (
                <X className="size-6" aria-hidden="true" />
              ) : (
                <Menu className="size-6" aria-hidden="true" />
              )}
              <span className="sr-only">{open ? dict.nav.close : dict.nav.menu}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile panel. Rendered below the header so the close control stays
          visible and reachable with a thumb. */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-ivory-50 lg:hidden"
      >
        <nav aria-label="Mobil menyu" className="container-content py-6">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-13 items-center rounded-md px-4 font-display text-xl',
                      'transition-colors',
                      active
                        ? 'bg-brown-500/10 text-chocolate-800'
                        : 'text-chocolate-700 hover:bg-sand-200',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 space-y-3 border-t border-sand-300 pt-6">
            <Button asChild size="lg" block>
              <Link href="/booking">
                <CalendarCheck aria-hidden="true" />
                {dict.nav.book}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" block>
              <a href={`tel:${phone}`}>
                <Phone aria-hidden="true" />
                {phone}
              </a>
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
}
