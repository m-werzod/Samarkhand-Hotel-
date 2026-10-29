import type { MetadataRoute } from 'next';

import { getStore } from '@/lib/data';
import { getSiteUrl } from '@/lib/env';

/**
 * Sitemap.
 *
 * Only published rooms are listed, and the booking form is excluded — it is a
 * transactional page with query-string state, not something a search engine
 * should index as a landing page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/rooms`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/offers`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/amenities`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/gallery`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/location`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const rooms = await getStore().listRooms({ statuses: ['published'] });
    return [
      ...staticRoutes,
      ...rooms.map((room) => ({
        url: `${base}/rooms/${room.slug}`,
        lastModified: new Date(room.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
    ];
  } catch (error) {
    // A database hiccup must not produce a 500 for a crawler; the static
    // routes are still a valid sitemap.
    console.error('[sitemap] could not list rooms', error);
    return staticRoutes;
  }
}
