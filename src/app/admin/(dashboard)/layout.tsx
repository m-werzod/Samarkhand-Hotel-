import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/env';

export const metadata: Metadata = {
  title: { default: 'Boshqaruv paneli', template: '%s — Samarkhand admin' },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Every admin page is rendered per request.
 *
 * Without this Next would try to prerender them at build time, where there is
 * no session — and a statically cached admin page is a cached view of one
 * operator's data served to the next.
 */
export const dynamic = 'force-dynamic';

/**
 * Admin layout.
 *
 * Checks the session here as well as in the middleware. The middleware can be
 * bypassed by configuration mistakes and does not run for every rendering
 * path, so the layout is the one place guaranteed to execute before any admin
 * page renders.
 *
 * The login route has its own layout segment and is excluded below.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getCurrentAdmin();

  if (!identity) {
    redirect('/admin/login');
  }

  return (
    <AdminShell identity={identity} demoMode={isDemoMode()}>
      {children}
    </AdminShell>
  );
}
