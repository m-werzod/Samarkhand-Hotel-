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
