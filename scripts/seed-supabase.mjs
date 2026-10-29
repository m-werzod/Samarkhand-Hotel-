#!/usr/bin/env node
/**
 * Loads the seed dataset into a configured Supabase project.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
 *
 * Uses the service-role key because seeding writes to tables Row Level
 * Security deliberately closes to everyone but staff. That is also why this is
 * an operator-run script rather than anything the application can trigger.
 *
 * The dataset is read from `src/lib/data/seed.ts` — the same module the
 * application uses — by bundling it in memory with esbuild. Keeping one source
 * of truth matters more here than avoiding a build step: a seed script with
 * its own copy of the data drifts, and the drift is only noticed when
 * production and development disagree about a price.
 *
 * Idempotent. Every write is an upsert on the primary key, so re-running
 * updates the seed rows in place. It never touches bookings, inquiries,
 * analytics or audit rows — those are real data.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '\nMissing configuration.\n\n' +
      '  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.\n' +
      '  See docs/DEPLOYMENT.md.\n',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Resolves the project's `@/` path alias for esbuild. */
const aliasPlugin = {
  name: 'tsconfig-alias',
  setup(buildApi) {
    buildApi.onResolve({ filter: /^@\// }, (args) => ({
      path: join(root, 'src', args.path.slice(2)),
    }));
  },
};

/** Bundle and evaluate `seed.ts`, returning its exports. */
async function loadSeedModule() {
  const result = await build({
    entryPoints: [join(root, 'src', 'lib', 'data', 'seed.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    plugins: [aliasPlugin],
    logLevel: 'silent',
  });

  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(dataUrl);
}

async function upsert(table, rows, label = table) {
  if (rows.length === 0) {
    console.info(`  ${label}: nothing to write`);
    return;
  }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`${label}: ${error.message}`);
  console.info(`  ${label}: ${rows.length} row(s)`);
}

/** Replace a join table's rows for one owner. */
async function relink(table, ownerColumn, ownerId, rows) {
  await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`${table} (${ownerId}): ${error.message}`);
}

async function main() {
  console.info('\nSeeding Samarkhand Hotel\n');

  const seed = await loadSeedModule();

  /* --- Media ---------------------------------------------------------- */
  await upsert(
    'media_assets',
    seed.seedMedia.map((asset) => ({
      id: asset.id,
      storage_path: asset.storagePath,
      type: asset.type,
      kind: asset.kind,
      category: asset.category,
      alt_text: asset.altText,
      caption: asset.caption,
      mime_type: asset.mimeType,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
    })),
  );

  /* --- Amenities ------------------------------------------------------- */
  await upsert(
    'amenities',
    seed.seedAmenities.map((amenity) => ({
      id: amenity.id,
      icon_key: amenity.iconKey,
      name: amenity.name,
      description: amenity.description,
      is_active: amenity.isActive,
      sort_order: amenity.sortOrder,
    })),
  );

  /* --- Settings + content ---------------------------------------------- */
  const settings = seed.seedHotelSettings;
  await upsert(
    'hotel_settings',
    [
      {
        id: 'settings',
        brand_name: settings.brandName,
        tagline: settings.tagline,
        phone: settings.phone,
        email: settings.email,
        whatsapp_number: settings.whatsappNumber,
        address: settings.address,
        social: settings.social,
        currency: settings.currency,
        time_zone: settings.timeZone,
        locale: settings.locale,
        tax_rate_percent: settings.taxRatePercent,
        service_fee_minor: settings.serviceFeeMinor,
        check_in_time: settings.checkInTime,
        check_out_time: settings.checkOutTime,
        seo_title: settings.seoTitle,
        seo_description: settings.seoDescription,
        is_demo_data: settings.isDemoData,
      },
    ],
    'hotel_settings',
  );

  const content = seed.seedSiteContent;
  await upsert(
    'site_content',
    [
      {
        id: 'content',
        hero_headline: content.heroHeadline,
        hero_subheadline: content.heroSubheadline,
        hero_media_id: content.heroMediaId,
        hero_video_url: content.heroVideoUrl,
        about_title: content.aboutTitle,
        about_body: content.aboutBody,
        benefits: content.benefits,
        footer_blurb: content.footerBlurb,
        privacy_policy: content.privacyPolicy,
        booking_terms: content.bookingTerms,
        gallery_categories: content.galleryCategories,
      },
    ],
    'site_content',
  );

  /* --- Rooms ------------------------------------------------------------ */
  await upsert(
    'rooms',
    seed.seedRooms.map((room) => ({
      id: room.id,
      slug: room.slug,
      name: room.name,
      short_description: room.shortDescription,
      description: room.description,
      max_occupancy: room.maxOccupancy,
      max_adults: room.maxAdults,
      max_children: room.maxChildren,
      bed_configuration: room.bedConfiguration,
      size_sqm: room.sizeSqm,
      base_price_minor: room.basePrice.amount,
      currency: room.basePrice.currency,
      status: room.status,
      sort_order: room.sortOrder,
      inventory_count: room.inventoryCount,
      cancellation_policy: room.cancellationPolicy,
      is_demo_data: room.isDemoData,
    })),
  );

  /* --- Offers + campaigns ----------------------------------------------- */
  await upsert(
    'offers',
    seed.seedOffers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      description: offer.description,
      discount_type: offer.discountType,
      discount_value: offer.discountValue,
      starts_at: offer.startsAt,
      ends_at: offer.endsAt,
      minimum_nights: offer.minimumNights,
      conditions: offer.conditions,
      status: offer.status,
    })),
  );

  await upsert(
    'campaigns',
    seed.seedCampaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      subtitle: campaign.subtitle,
      badge: campaign.badge,
      media_id: campaign.mediaId,
      mobile_media_id: campaign.mobileMediaId,
      cta_label: campaign.ctaLabel,
      cta_href: campaign.ctaHref,
      offer_id: campaign.offerId,
      room_id: campaign.roomId,
      status: campaign.status,
      priority: campaign.priority,
      starts_at: campaign.startsAt,
      ends_at: campaign.endsAt,
      text_align: campaign.textAlign,
      overlay: campaign.overlay,
    })),
  );

  await upsert(
    'testimonials',
    seed.seedTestimonials.map((testimonial) => ({
      id: testimonial.id,
      author_label: testimonial.authorLabel,
      body: testimonial.body,
      rating: testimonial.rating,
      is_sample: testimonial.isSample,
      is_published: testimonial.isPublished,
      sort_order: testimonial.sortOrder,
    })),
  );

  /* --- Join tables ------------------------------------------------------ */
  for (const room of seed.seedRooms) {
    await relink(
      'room_amenities',
      'room_id',
      room.id,
      room.amenityIds.map((amenity_id) => ({ room_id: room.id, amenity_id })),
    );
    await relink(
      'room_media',
      'room_id',
      room.id,
      room.mediaIds.map((media_id, index) => ({
        room_id: room.id,
        media_id,
        sort_order: index,
      })),
    );
  }
  console.info('  room_amenities / room_media: linked');

  for (const offer of seed.seedOffers) {
    await relink(
      'offer_rooms',
      'offer_id',
      offer.id,
      offer.eligibleRoomIds.map((room_id) => ({ offer_id: offer.id, room_id })),
    );
  }
  console.info('  offer_rooms: linked');

  console.info(
    '\nDone.\n\n' +
      'Everything written is flagged as demo data and is marked unverified on\n' +
      'the public site. Clear those flags in Admin → Settings once the real\n' +
      'details are in.\n',
  );
}

main().catch((error) => {
  console.error(`\nSeeding failed: ${error.message}\n`);
  process.exitCode = 1;
});
