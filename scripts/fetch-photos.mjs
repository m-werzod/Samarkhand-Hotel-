#!/usr/bin/env node
/**
 * Downloads the hotel photography set from Pexels.
 *
 *   node scripts/fetch-photos.mjs
 *
 * Why these are downloaded rather than hot-linked: a remote URL in production
 * is a dependency on someone else's uptime and CDN policy, and a hot-linked
 * image that 404s is a broken hotel website. Storing them locally also lets
 * Next's image optimiser produce AVIF/WebP derivatives at build time.
 *
 * Licence: Pexels License — free for commercial use, no attribution required.
 * Photographer credit is recorded in the manifest anyway, because crediting
 * people whose work you are using is the decent default even when it is not
 * demanded. See https://www.pexels.com/license/
 *
 * Every download is verified against JPEG magic bytes before it is written.
 * A CDN that returns an HTML error page with a .jpeg name would otherwise
 * leave a file that renders as a broken image on the live site.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'photos');

/**
 * Crop sizes requested from the CDN, by the shape of the slot each photo
 * fills in the UI.
 *
 * Asking the CDN for an explicit width AND height matters: several of these
 * originals are portrait, and dropping a portrait photo into a 16:7 carousel
 * slot with `object-cover` shows a narrow horizontal band out of the middle —
 * usually the least interesting part of the picture. Letting the CDN crop to
 * the target ratio gives a composed result instead of an arbitrary slice.
 */
const CROPS = {
  hero: { w: 2400, h: 1350 }, // 16:9, full-bleed
  wide: { w: 1920, h: 840 }, //  ~16:7, carousel slides
  card: { w: 1600, h: 1200 }, //  4:3, room cards and gallery tiles
  portrait: { w: 1200, h: 1500 }, // 4:5, the about column
};

/**
 * The photography set.
 *
 * `role` is what the image is for in the product; the seed and the media
 * library key off the generated id. Alt text is written in Uzbek because the
 * site is Uzbek and alt text is read aloud to Uzbek speakers.
 */
const PHOTOS = [
  // --- Hero + exterior -------------------------------------------------
  {
    file: 'hero-samarkand-twilight.jpg',
    crop: 'hero',
    id: 19439196,
    category: 'exterior',
    alt: 'Gumbazli tarixiy madrasa oqshom chogʻida yoritilgan holda',
    caption: 'Samarqand — Tilla Qori madrasasi oqshomda',
  },
  {
    file: 'exterior-registan.jpg',
    id: 35220191,
    category: 'exterior',
    alt: 'Registon maydonidagi tarixiy masjid musaffo osmon ostida',
    caption: 'Registon maydoni',
  },
  {
    file: 'exterior-gur-e-amir.jpg',
    id: 40483708,
    category: 'exterior',
    alt: 'Goʻri Amir maqbarasining naqshinkor gumbazi va peshtoqi',
    caption: 'Goʻri Amir maqbarasi',
  },

  // --- Lobby -----------------------------------------------------------
  {
    file: 'lobby-lounge.jpg',
    crop: 'portrait',
    id: 29532567,
    category: 'lobby',
    alt: 'Mehmonxona lobbisi: yumshoq oʻtirgichlar va iliq yoritish',
    caption: 'Lobbi va dam olish burchagi',
  },
  {
    file: 'lobby-hall.jpg',
    id: 695193,
    category: 'lobby',
    alt: 'Keng mehmonxona zali, qandillar va yumshoq divanlar bilan',
    caption: 'Mehmonxona zali',
  },
  {
    file: 'reception-desk.jpg',
    id: 7512139,
    category: 'lobby',
    alt: 'Qabulxona peshtaxtasi va mehmonlarni kutib olayotgan xodim',
    caption: 'Qabulxona',
  },

  // --- Rooms -----------------------------------------------------------
  {
    file: 'room-standard.jpg',
    id: 27638174,
    category: 'rooms',
    alt: 'Standart xona: ikki kishilik krovat, yogʻoch devor va tabiiy yorugʻlik',
    caption: 'Standart xona',
  },
  {
    file: 'room-deluxe.jpg',
    id: 34496701,
    category: 'rooms',
    alt: 'Deluxe xona: keng maydon, zamonaviy jihoz va katta deraza',
    caption: 'Deluxe xona',
  },
  {
    file: 'room-suite.jpg',
    id: 36916378,
    category: 'rooms',
    alt: 'Lyuks xona: yumshoq toʻshak, devordagi suratlar va alohida oʻtirish joyi',
    caption: 'Lyuks xona',
  },
  {
    file: 'room-family.jpg',
    id: 39894350,
    category: 'rooms',
    alt: 'Oilaviy xona: yorugʻ, keng va qulay jihozlangan',
    caption: 'Oilaviy xona',
  },
  {
    file: 'room-detail.jpg',
    id: 28011238,
    category: 'rooms',
    alt: 'Xona burchagi: ish stoli va zamonaviy yoritish',
    caption: 'Xonadagi ish burchagi',
  },

  // --- Amenities -------------------------------------------------------
  {
    file: 'bathroom-tub.jpg',
    id: 9696595,
    category: 'amenities',
    alt: 'Hammom: alohida vanna va zamonaviy jihozlar',
    caption: 'Hammom',
  },
  {
    file: 'bathroom-marble.jpg',
    id: 27299153,
    category: 'amenities',
    alt: 'Marmar peshtaxtali hammom va katta koʻzgu',
    caption: 'Marmar hammom',
  },

  // --- Dining ----------------------------------------------------------
  {
    file: 'restaurant-dining.jpg',
    id: 29000046,
    category: 'dining',
    alt: 'Restoran zali: bezatilgan stollar va iliq yoritish',
    caption: 'Restoran',
  },
  {
    file: 'breakfast-buffet.jpg',
    id: 16199069,
    category: 'dining',
    alt: 'Nonushta stoli: yangi mahsulotlar va ichimliklar',
    caption: 'Nonushta',
  },

  // --- Details ---------------------------------------------------------
  {
    file: 'detail-tilework.jpg',
    id: 35301075,
    category: 'details',
    alt: 'Koʻk va feruza rangli islomiy koshin naqshlari yaqindan',
    caption: 'Koshin naqshlari',
  },
  {
    file: 'detail-mosaic.jpg',
    id: 19227922,
    category: 'details',
    alt: 'Madrasa peshtoqidagi mozaika naqshlari',
    caption: 'Mozaika tafsiloti',
  },
  {
    file: 'detail-shah-i-zinda.jpg',
    id: 19439173,
    category: 'details',
    alt: 'Shohi Zinda majmuasidagi naqshinkor gumbazlar',
    caption: 'Shohi Zinda',
  },

  // --- Campaign backdrops ----------------------------------------------
  {
    file: 'campaign-autumn.jpg',
    crop: 'wide',
    id: 32037656,
    category: 'campaigns',
    alt: 'Feruza gumbazli masjid peshtoqi — kampaniya foni',
    caption: 'Kuzgi kampaniya foni',
  },
  {
    file: 'campaign-earlybird.jpg',
    crop: 'wide',
    id: 16386337,
    category: 'campaigns',
    alt: 'Registon maydonidagi naqshinkor peshtoq — kampaniya foni',
    caption: 'Erta bron kampaniyasi foni',
  },
  {
    file: 'campaign-weekend.jpg',
    crop: 'wide',
    id: 5378693,
    category: 'campaigns',
    alt: 'Mehmonxona lobbisida dam olayotgan mehmonlar — kampaniya foni',
    caption: 'Dam olish kunlari kampaniyasi foni',
  },
];

/** JPEG files start FF D8 FF. Anything else is not the image we asked for. */
function isJpeg(bytes) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function download(photo) {
  const crop = CROPS[photo.crop ?? 'card'];
  const url =
    `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg` +
    `?auto=compress&cs=tinysrgb&fit=crop&w=${crop.w}&h=${crop.h}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (samarkhand-hotel asset fetch)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!isJpeg(bytes)) {
    throw new Error(
      `not a JPEG (got ${bytes.length} bytes starting ${[...bytes.slice(0, 4)]
        .map((b) => b.toString(16))
        .join(' ')})`,
    );
  }

  await writeFile(join(outDir, photo.file), bytes);
  return bytes.byteLength;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const manifest = [];
  const failures = [];
  let totalBytes = 0;

  for (const photo of PHOTOS) {
    try {
      const bytes = await download(photo);
      totalBytes += bytes;
      manifest.push({
        path: `/photos/${photo.file}`,
        type: 'image',
        kind: 'photograph',
        category: photo.category,
        alt: photo.alt,
        caption: photo.caption,
        bytes,
        mimeType: 'image/jpeg',
        source: 'pexels',
        sourceId: photo.id,
        sourceUrl: `https://www.pexels.com/photo/${photo.id}/`,
      });
      console.info(`  ok    ${photo.file.padEnd(32)} ${(bytes / 1024).toFixed(0)} KB`);
    } catch (error) {
      failures.push({ file: photo.file, reason: error.message });
      console.error(`  FAIL  ${photo.file.padEnd(32)} ${error.message}`);
    }
  }

  if (failures.length > 0) {
    // Partial sets produce a site with holes in it, so this is fatal.
    throw new Error(`${failures.length} download(s) failed; aborting without writing the manifest.`);
  }

  await writeFile(
    join(root, 'src', 'lib', 'photo-manifest.json'),
    `${JSON.stringify(
      {
        generatedBy: 'scripts/fetch-photos.mjs',
        licence: 'Pexels License — free for commercial use, no attribution required.',
        licenceUrl: 'https://www.pexels.com/license/',
        note:
          'Real photographs of other properties, used as representative imagery. Replace with photography of the actual hotel before launch.',
        photos: manifest,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.info(
    `\nDownloaded ${manifest.length} photographs (${(totalBytes / 1024 / 1024).toFixed(1)} MB).`,
  );
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exitCode = 1;
});
