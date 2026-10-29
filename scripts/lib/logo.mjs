import { palette } from './palette.mjs';
import { archHead, girihStar, polygon } from './shapes.mjs';

/**
 * The Samarkhand logomark: a Timurid pointed arch enclosing an eight-point
 * girih star, resting on a plinth. Drawn on a 64x64 grid so every variant
 * shares identical geometry.
 */
function mark({ arch, star, plinth, ring }) {
  return `
    <path d="${archHead(10, 6, 44, 44)}" fill="none" stroke="${arch}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="${archHead(17.5, 14.5, 29, 32)}" fill="${ring}" fill-opacity="0.16"/>
    <path d="${girihStar(32, 30, 11.6, 4.9)}" fill="${star}"/>
    <path d="${polygon(32, 30, 4.4, 8, Math.PI / 8)}" fill="${arch}" fill-opacity="0.85"/>
    <path d="M 7 50.5 H 57" stroke="${arch}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M 12 56.5 H 52" stroke="${plinth}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.75"/>
  `;
}

const WORDMARK_FONT =
  "'Cormorant Garamond','Didot','Playfair Display','Hoefler Text',Georgia,serif";
const SUB_FONT = "'Jost','Inter','Helvetica Neue',Arial,sans-serif";

/** Horizontal lockup: mark + wordmark + descriptor. */
export function logoPrimary({ arch, star, plinth, ring, word, sub }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 332 72" role="img" aria-label="Samarkhand Hotel">
  <title>Samarkhand Hotel</title>
  <g transform="translate(0,4)">${mark({ arch, star, plinth, ring })}</g>
  <text x="80" y="40" font-family="${WORDMARK_FONT}" font-size="31" letter-spacing="1.1" fill="${word}">Samarkhand</text>
  <text x="81.5" y="58" font-family="${SUB_FONT}" font-size="11.5" letter-spacing="6.2" fill="${sub}">H O T E L</text>
</svg>
`;
}

/** Stacked lockup for narrow placements and the app splash. */
export function logoStacked({ arch, star, plinth, ring, word, sub }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 150" role="img" aria-label="Samarkhand Hotel">
  <title>Samarkhand Hotel</title>
  <g transform="translate(78,2)">${mark({ arch, star, plinth, ring })}</g>
  <text x="110" y="113" text-anchor="middle" font-family="${WORDMARK_FONT}" font-size="30" letter-spacing="1" fill="${word}">Samarkhand</text>
  <text x="110" y="133" text-anchor="middle" font-family="${SUB_FONT}" font-size="11" letter-spacing="6.4" fill="${sub}">H O T E L</text>
</svg>
`;
}

/** The bare mark, for avatars, stamps and tight corners. */
export function logomark({ arch, star, plinth, ring }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Samarkhand Hotel">
  <title>Samarkhand Hotel</title>
  ${mark({ arch, star, plinth, ring })}
</svg>
`;
}

/**
 * Favicon / app icon: the mark on a solid chocolate tile, with the geometry
 * thickened so it survives rasterisation down to 16px.
 */
export function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Samarkhand Hotel">
  <title>Samarkhand Hotel</title>
  <rect width="64" height="64" rx="14" fill="${palette.chocolate800}"/>
  <path d="${archHead(14, 11, 36, 34)}" fill="none" stroke="${palette.gold400}" stroke-width="4" stroke-linejoin="round"/>
  <path d="${girihStar(32, 32, 10.5, 4.4)}" fill="${palette.gold400}"/>
  <path d="M 12 51 H 52" stroke="${palette.gold400}" stroke-width="4" stroke-linecap="round"/>
</svg>
`;
}

export const logoThemes = {
  primary: {
    arch: palette.brown500,
    star: palette.gold500,
    plinth: palette.brown400,
    ring: palette.gold400,
    word: palette.chocolate800,
    sub: palette.brown400,
  },
  onDark: {
    arch: palette.gold400,
    star: palette.gold300,
    plinth: palette.gold400,
    ring: palette.gold300,
    word: palette.ivory100,
    sub: palette.gold300,
  },
  monoDark: {
    arch: palette.chocolate800,
    star: palette.chocolate800,
    plinth: palette.chocolate800,
    ring: palette.chocolate800,
    word: palette.chocolate800,
    sub: palette.chocolate800,
  },
  monoLight: {
    arch: palette.ivory100,
    star: palette.ivory100,
    plinth: palette.ivory100,
    ring: palette.ivory100,
    word: palette.ivory100,
    sub: palette.ivory100,
  },
};
