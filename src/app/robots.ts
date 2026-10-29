import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The admin area and the API are not content. Excluding them keeps
        // crawl budget on pages that matter and keeps admin URLs out of
        // search results, though it is not a security control — the server
        // checks authorisation on every admin request regardless.
        disallow: ['/admin', '/admin/', '/api/', '/booking'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
