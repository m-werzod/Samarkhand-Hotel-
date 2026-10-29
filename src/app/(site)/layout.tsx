import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { getContent, getSettings } from '@/lib/data/queries';

/**
 * Layout for every public page.
 *
 * The header is fixed and overlays the homepage hero on purpose, so top
 * clearance is each page's own business rather than something the layout
 * imposes. Interior pages open with `<PageIntro>`, which carries it.
 */
/**
 * Public pages render per request rather than at build time.
 *
 * The reason is correctness over caching: an administrator publishing a room
 * or a campaign expects to see it on the site immediately, and in demo mode
 * the store lives in process memory, so a build-time snapshot would freeze
 * the seed data forever.
 *
 * With Supabase configured and a stable content cadence, these routes can be
 * switched to ISR (`export const revalidate = 300`) — every mutation already
 * calls `revalidatePath` for the pages it touches. See docs/DEPLOYMENT.md.
 */
export const dynamic = 'force-dynamic';

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, content] = await Promise.all([getSettings(), getContent()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader phone={settings.phone} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} content={content} />
    </div>
  );
}
