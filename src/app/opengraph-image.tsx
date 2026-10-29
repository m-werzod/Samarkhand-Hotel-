import { ImageResponse } from 'next/og';

import { getStore } from '@/lib/data';

/**
 * The social sharing card.
 *
 * Rendered at request time rather than shipped as a static file so it picks
 * up the hotel's current brand name and tagline from settings — an operator
 * renaming the hotel should not have to regenerate an image by hand.
 *
 * Drawn with plain divs and inline SVG because `next/og` runs Satori, which
 * supports a flexbox subset and no external CSS.
 */
export const runtime = 'nodejs';
export const alt = 'Samarkhand Hotel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  let brandName = 'Samarkhand Hotel';
  let tagline = 'Samarqand mehmondoʻstligi, zamonaviy qulaylik bilan';
  let city = 'Samarqand';

  try {
    const settings = await getStore().getHotelSettings();
    brandName = settings.brandName;
    tagline = settings.tagline;
    city = settings.address.city;
  } catch {
    // Fall back to the defaults above rather than failing the image: a
    // missing OG card degrades a share, a 500 breaks it.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: 'linear-gradient(135deg, #241309 0%, #4A2F1C 55%, #6B4226 100%)',
          color: '#FBF7F0',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <svg width="92" height="92" viewBox="0 0 64 64">
            <path
              d="M 10 50 C 10 26 20 12 32 6 C 44 12 54 26 54 50 Z"
              fill="none"
              stroke="#D8B65A"
              strokeWidth="3.6"
              strokeLinejoin="round"
            />
            <path
              d="M 32 18 L 35.5 27 L 45 24.5 L 40 32 L 45 39.5 L 35.5 37 L 32 46 L 28.5 37 L 19 39.5 L 24 32 L 19 24.5 L 28.5 27 Z"
              fill="#C9A227"
            />
            <path d="M 7 55 H 57" stroke="#D8B65A" strokeWidth="3.6" strokeLinecap="round" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, letterSpacing: 1 }}>{brandName}</div>
            <div
              style={{
                fontSize: 20,
                letterSpacing: 8,
                color: '#E6CE8E',
                marginTop: 4,
              }}
            >
              {city.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ width: 120, height: 4, background: '#C9A227' }} />
          <div style={{ fontSize: 44, lineHeight: 1.25, maxWidth: 900 }}>{tagline}</div>
        </div>
      </div>
    ),
    size,
  );
}
