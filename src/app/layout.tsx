import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost } from 'next/font/google';

import { ToastProvider } from '@/components/ui/toast';
import { getStore } from '@/lib/data';
import { getSiteUrl } from '@/lib/env';
import { getDictionary } from '@/lib/i18n/dictionaries';

import './globals.css';

/**
 * Cormorant Garamond for display, Jost for interface text.
 *
 * `latin-ext` is not optional here: Uzbek Latin uses the modifier letters in
 * oʻ and gʻ, and without that subset they fall back to a different face
 * mid-word. `display: swap` keeps text visible while the fonts load.
 */
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStore().getHotelSettings();
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: settings.seoTitle,
      template: `%s — ${settings.brandName}`,
    },
    description: settings.seoDescription,
    applicationName: settings.brandName,
    keywords: [
      'Samarkhand Hotel',
      'Samarqand mehmonxona',
      'hotel Samarkand',
      'Samarqandda bron',
    ],
    authors: [{ name: settings.brandName }],
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: settings.brandName,
      title: settings.seoTitle,
      description: settings.seoDescription,
      url: siteUrl,
      locale: 'uz_UZ',
    },
    twitter: {
      card: 'summary_large_image',
      title: settings.seoTitle,
      description: settings.seoDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    formatDetection: { telephone: true, address: false, email: true },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF7F0' },
    { media: '(prefers-color-scheme: dark)', color: '#2E1C12' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dict = getDictionary();

  return (
    <html lang="uz" className={`${cormorant.variable} ${jost.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only-focusable">
          {dict.nav.skipToContent}
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
