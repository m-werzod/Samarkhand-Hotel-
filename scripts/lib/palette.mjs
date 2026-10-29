/**
 * Single source of truth for the Samarkhand Hotel palette.
 *
 * These values are mirrored by the CSS custom properties in
 * `src/app/globals.css`. Keep the two in sync — the asset generator and the
 * stylesheet must agree or the illustrations will drift from the UI.
 */
export const palette = {
  // Core browns
  chocolate900: '#241309',
  chocolate800: '#2E1C12',
  chocolate700: '#3B2616',
  espresso600: '#4A2F1C',
  brown500: '#6B4226',
  brown400: '#8A5A33',
  brown300: '#A9784B',

  // Warm neutrals
  ivory50: '#FBF7F0',
  ivory100: '#F7F1E6',
  sand200: '#EFE4D2',
  sand300: '#E3D5BF',
  sand400: '#D2BFA3',

  // Accents
  gold500: '#C9A227',
  gold400: '#D8B65A',
  gold300: '#E6CE8E',
  terracotta500: '#B4603C',
  terracotta400: '#C97A55',

  // Supporting
  teal600: '#2F6B6A',
  teal500: '#3F8886',
  night: '#160C06',
};

/** Linear gradient stop helper. */
export const stop = (offset, color, opacity = 1) =>
  `<stop offset="${offset}" stop-color="${color}"${opacity === 1 ? '' : ` stop-opacity="${opacity}"`}/>`;

/** Builds a `<linearGradient>` definition. */
export const linearGradient = (id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.join('')}</linearGradient>`;

/** Builds a `<radialGradient>` definition. */
export const radialGradient = (id, stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.join('')}</radialGradient>`;
