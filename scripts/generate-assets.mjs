#!/usr/bin/env node
/**
 * Generates the Samarkhand Hotel brand and media assets.
 *
 * Everything written here is original vector artwork produced from the
 * geometry in `scripts/lib/`. Nothing is downloaded, nothing is licensed from
 * a third party, and no file depends on a remote URL that could break.
 *
 * These scenes are ILLUSTRATIONS, not photographs. The UI labels them as
 * concept imagery, and `media-manifest.json` records that for every asset so
 * the distinction survives into the admin CMS.
 *
 *   node scripts/generate-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logoPrimary, logoStacked, logomark, favicon, logoThemes } from './lib/logo.mjs';
import * as scenes from './lib/scenes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'public', 'brand');
const mediaDir = join(root, 'public', 'media');
const appDir = join(root, 'src', 'app');

/** Collapses redundant whitespace so the committed SVGs stay compact. */
function minify(svg) {
  return svg
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n/g, '')
    .trim();
}

const brandFiles = {
  'logo-primary.svg': logoPrimary(logoThemes.primary),
  'logo-primary-on-dark.svg': logoPrimary(logoThemes.onDark),
  'logo-stacked.svg': logoStacked(logoThemes.primary),
  'logo-stacked-on-dark.svg': logoStacked(logoThemes.onDark),
  'logo-mono-dark.svg': logoPrimary(logoThemes.monoDark),
  'logo-mono-light.svg': logoPrimary(logoThemes.monoLight),
  'logomark.svg': logomark(logoThemes.primary),
  'logomark-on-dark.svg': logomark(logoThemes.onDark),
  'favicon.svg': favicon(),
};

/**
 * Media library seed. `kind: 'illustration'` is carried through to the
 * database so nothing is ever presented as a verified photograph.
 */
const mediaFiles = [
  {
    file: 'exterior-dusk.svg',
    svg: scenes.exterior(),
    category: 'exterior',
    alt: "Samarkhand Hotel's illuminated facade at dusk, with a ribbed turquoise dome above the entrance portal",
    caption: 'Mehmonxona tashqi ko‘rinishi — kontseptual tasvir',
  },
  {
    file: 'lobby-reception.svg',
    svg: scenes.lobby(),
    category: 'lobby',
    alt: 'Hotel lobby with pointed arches, a long reception desk and octagonal brass pendant lamps',
    caption: 'Qabulxona va lobbi — kontseptual tasvir',
  },
  {
    file: 'room-standard.svg',
    svg: scenes.roomStandard(),
    category: 'rooms',
    alt: 'Standard room with a double bed, arched window and a carved wooden wardrobe',
    caption: 'Standart xona — kontseptual tasvir',
  },
  {
    file: 'room-deluxe.svg',
    svg: scenes.roomDeluxe(),
    category: 'rooms',
    alt: 'Deluxe room with a wide bed, twin arched windows, a teal armchair and framed tilework',
    caption: 'Deluxe xona — kontseptual tasvir',
  },
  {
    file: 'room-suite.svg',
    svg: scenes.suite(),
    category: 'rooms',
    alt: 'Suite with a separate lounge corner, writing desk and a brass chandelier',
    caption: 'Lyuks xona — kontseptual tasvir',
  },
  {
    file: 'bathroom.svg',
    svg: scenes.bathroom(),
    category: 'amenities',
    alt: 'Marble bathroom with a freestanding tub, arched mirror and turquoise patterned tiling',
    caption: 'Hammom va qulayliklar — kontseptual tasvir',
  },
  {
    file: 'restaurant.svg',
    svg: scenes.restaurant(),
    category: 'dining',
    alt: 'Restaurant with candlelit tables set between lamp-lit arched niches',
    caption: 'Restoran va nonushta zali — kontseptual tasvir',
  },
  {
    file: 'detail-tilework.svg',
    svg: scenes.detailTilework(),
    category: 'details',
    alt: 'Close detail of eight-point girih stars in gold over deep turquoise',
    caption: 'Girih naqshi — kontseptual tasvir',
  },
  {
    file: 'detail-arch.svg',
    svg: scenes.detailArch(),
    category: 'details',
    alt: 'A tall Timurid arch with muqarnas corbelling catching warm daylight',
    caption: 'Timuriylar ravog‘i — kontseptual tasvir',
  },
  {
    file: 'campaign-autumn.svg',
    svg: scenes.campaign('autumn'),
    category: 'campaigns',
    alt: 'Warm brown and terracotta campaign backdrop with an arch and girih motif',
    caption: 'Kuzgi kampaniya foni',
  },
  {
    file: 'campaign-earlybird.svg',
    svg: scenes.campaign('earlybird'),
    category: 'campaigns',
    alt: 'Deep teal campaign backdrop with an arch and girih motif',
    caption: 'Erta bron kampaniyasi foni',
  },
  {
    file: 'campaign-weekend.svg',
    svg: scenes.campaign('weekend'),
    category: 'campaigns',
    alt: 'Espresso brown campaign backdrop with an arch and girih motif',
    caption: 'Dam olish kunlari kampaniyasi foni',
  },
  {
    file: 'campaign-autumn-mobile.svg',
    svg: scenes.campaign('autumn', { w: 900, h: 1200 }),
    category: 'campaigns',
    alt: 'Portrait campaign backdrop in warm brown for mobile carousels',
    caption: 'Kuzgi kampaniya foni (mobil)',
  },
  {
    file: 'campaign-earlybird-mobile.svg',
    svg: scenes.campaign('earlybird', { w: 900, h: 1200 }),
    category: 'campaigns',
    alt: 'Portrait campaign backdrop in deep teal for mobile carousels',
    caption: 'Erta bron kampaniyasi foni (mobil)',
  },
  {
    file: 'campaign-weekend-mobile.svg',
    svg: scenes.campaign('weekend', { w: 900, h: 1200 }),
    category: 'campaigns',
    alt: 'Portrait campaign backdrop in espresso brown for mobile carousels',
    caption: 'Dam olish kunlari kampaniyasi foni (mobil)',
  },
];

async function main() {
  await Promise.all([
    mkdir(brandDir, { recursive: true }),
    mkdir(mediaDir, { recursive: true }),
  ]);

  for (const [name, svg] of Object.entries(brandFiles)) {
    await writeFile(join(brandDir, name), minify(svg), 'utf8');
  }

  // Next.js picks up `src/app/icon.svg` automatically for the favicon.
  await writeFile(join(appDir, 'icon.svg'), minify(favicon()), 'utf8');

  const manifest = [];
  for (const item of mediaFiles) {
    const body = minify(item.svg);
    await writeFile(join(mediaDir, item.file), body, 'utf8');
    manifest.push({
      path: `/media/${item.file}`,
      type: 'image',
      kind: 'illustration',
      category: item.category,
      alt: item.alt,
      caption: item.caption,
      bytes: Buffer.byteLength(body, 'utf8'),
      mimeType: 'image/svg+xml',
    });
  }

  const manifestBody = {
    generatedBy: 'scripts/generate-assets.mjs',
    note:
      'Original vector artwork created for this project. These are concept ILLUSTRATIONS, not photographs of a real property. Replace them with licensed photography before a real launch.',
    brand: Object.keys(brandFiles).map((name) => `/brand/${name}`),
    media: manifest,
  };

  await writeFile(
    join(root, 'src', 'lib', 'media-manifest.json'),
    `${JSON.stringify(manifestBody, null, 2)}\n`,
    'utf8',
  );

  const totalKb = (
    manifest.reduce((sum, m) => sum + m.bytes, 0) / 1024
  ).toFixed(1);
  console.info(
    `Generated ${Object.keys(brandFiles).length} brand files and ${manifest.length} media files (${totalKb} KB total).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
