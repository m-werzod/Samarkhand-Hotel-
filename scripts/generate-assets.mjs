#!/usr/bin/env node
/**
 * Generates the Samarkhand Hotel brand assets.
 *
 *   node scripts/generate-assets.mjs
 *
 * Scope note: this emits the identity only — logo lockups and the favicon.
 * Photography is a separate concern handled by `scripts/fetch-photos.mjs`.
 *
 * The logo stays generated vector rather than a hand-drawn file because every
 * variant (horizontal, stacked, monochrome, on-dark, favicon) is built from
 * one 64x64 geometry, so they cannot drift apart. The favicon variant
 * thickens its strokes so the mark survives rasterisation down to 16px.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logoPrimary, logoStacked, logomark, favicon, logoThemes } from './lib/logo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'public', 'brand');
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

async function main() {
  await mkdir(brandDir, { recursive: true });

  for (const [name, svg] of Object.entries(brandFiles)) {
    await writeFile(join(brandDir, name), minify(svg), 'utf8');
  }

  // Next.js picks up `src/app/icon.svg` automatically for the favicon.
  await writeFile(join(appDir, 'icon.svg'), minify(favicon()), 'utf8');

  console.info(`Generated ${Object.keys(brandFiles).length} brand files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
