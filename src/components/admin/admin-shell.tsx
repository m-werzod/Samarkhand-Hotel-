'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BedDouble,
  CalendarCheck,
  ExternalLink,
  FileText,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  ScrollText,
  Settings,
  Tag,
  X,
} from 'lucide-react';

import { logoutAction } from '@/app/admin/actions/auth';
import { Logo } from '@/components/site/logo';
import { Badge } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { AdminIdentity } from '@/lib/auth';

/**
 * Admin chrome: a persistent sidebar on desktop, a slide-over on mobile.
 *
 * The admin interface is deliberately plainer than the public site — denser
 * type, flatter surfaces, no decorative motifs. It is a tool someone uses for
 * hours a day, and the brand's warmth belongs on the guest-facing pages
 * rather than in a data table.
 */

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: React.ElementType; exact?: boolean }[];
}

const NAV: NavGroup[] = [
  {
    label: 'Umumiy',
    items: [
      { href: '/admin', label: 'Boshqaruv paneli', icon: LayoutDashboard, exact: true },
      { href: '/admin/analytics', label: 'Analitika', icon: BarChart3 },
    ],
  },
  {
    label: 'Mehmonlar',
    items: [
      { href: '/admin/bookings', label: 'Bron soʻrovlari', icon: CalendarCheck },
      { href: '/admin/inquiries', label: 'Xabarlar', icon: Mail },
    ],
  },
  {
    label: 'Kontent',
    items: [
      { href: '/admin/rooms', label: 'Xonalar', icon: BedDouble },
      { href: '/admin/offers', label: 'Takliflar', icon: Tag },
      { href: '/admin/campaigns', label: 'Kampaniyalar', icon: Megaphone },
      { href: '/admin/media', label: 'Media', icon: Images },
      { href: '/admin/content', label: 'Sayt matnlari', icon: FileText },
    ],
  },
  {
    label: 'Tizim',
    items: [
      { href: '/admin/settings', label: 'Sozlamalar', icon: Settings },
      { href: '/admin/audit', label: 'Audit jurnali', icon: ScrollText },
    ],
  },
];

export function AdminShell({
  identity,
  demoMode,
  children,
}: {
  identity: AdminIdentity;
  demoMode: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-sand-200/40">
      {/* --- Mobile top bar ------------------------------------------- */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-sand-300 bg-ivory-50 px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-nav"
          className="inline-flex size-10 items-center justify-center rounded-md text-chocolate-700 hover:bg-sand-200"
        >
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">Menyu</span>
        </button>
        <Logo variant="primary" height={26} priority={false} alt="Samarkhand Hotel" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex size-10 items-center justify-center rounded-md text-chocolate-700 hover:bg-sand-200"
          >
            <LogOut className="size-5" aria-hidden="true" />
            <span className="sr-only">Chiqish</span>
          </button>
        </form>
      </header>

      <div className="lg:flex">
        {/* --- Sidebar ------------------------------------------------ */}
        <nav
          id="admin-nav"
          aria-label="Admin menyusi"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-chocolate-800 text-ivory-100',
            'transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            <Link href="/admin" className="flex items-center">
              <Logo variant="onDark" height={28} priority={false} alt="Samarkhand Hotel" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-md text-ivory-100/70 hover:bg-ivory-50/10 lg:hidden"
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Yopish</span>
            </button>
          </div>

          {demoMode ? (
            <div className="mx-3 mb-3 rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2">
              <Badge tone="warning" size="sm">
                DEMO REJIM
              </Badge>
              <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-ivory-100/70">
                Maʼlumotlar bazasi ulanmagan. Oʻzgarishlar xotirada saqlanadi va
                server qayta ishga tushganda yoʻqoladi.
              </p>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {NAV.map((group) => (
              <div key={group.label} className="mb-5">
                <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-ivory-100/40">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                            active
                              ? 'bg-gold-400/15 font-medium text-gold-300'
                              : 'text-ivory-100/75 hover:bg-ivory-50/8 hover:text-ivory-50',
                          )}
                        >
                          <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-ivory-50/10 p-3">
            <Link
              href="/"
              target="_blank"
              className="mb-2 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-ivory-100/75 transition-colors hover:bg-ivory-50/8"
            >
              <ExternalLink className="size-4.5" aria-hidden="true" />
              Saytni koʻrish
            </Link>

            <div className="rounded-md bg-ivory-50/5 px-3 py-2.5">
              <p className="truncate text-sm text-ivory-50">{identity.email}</p>
              <p className="mt-0.5 text-xs capitalize text-ivory-100/50">
                {identity.role} · {identity.source === 'supabase' ? 'Supabase' : 'Demo'}
              </p>
            </div>

            <form action={logoutAction} className="mt-2">
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-ivory-100/75 transition-colors hover:bg-danger-600/20 hover:text-ivory-50"
              >
                <LogOut className="size-4.5" aria-hidden="true" />
                Chiqish
              </button>
            </form>
          </div>
        </nav>

        {/* Scrim: only on mobile, only while the sidebar is open. */}
        {open ? (
          <button
            type="button"
            aria-label="Menyuni yopish"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-chocolate-900/50 lg:hidden"
          />
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Page header used inside every admin screen. */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-sand-300 bg-ivory-50">
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-chocolate-800 sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brown-400">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
