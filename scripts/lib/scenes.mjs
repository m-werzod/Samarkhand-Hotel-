import { palette as p } from './palette.mjs';
import {
  pointedArch,
  archHead,
  dome,
  domeRibs,
  finial,
  girihStar,
  girihPattern,
  muqarnas,
  roundedRect,
  polygon,
} from './shapes.mjs';

const W = 1600;
const H = 1067; // 3:2, the standard editorial crop

/** Wraps scene body markup in a sized SVG with a consistent finishing pass. */
function frame(title, defs, body, { w = W, h = H, vignette = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    ${defs}
    <radialGradient id="vig" cx="0.5" cy="0.44" r="0.78">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="${p.night}" stop-opacity="0.42"/>
    </radialGradient>
    <linearGradient id="warmth" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.gold300}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${p.terracotta500}" stop-opacity="0.06"/>
    </linearGradient>
  </defs>
  ${body}
  <rect width="${w}" height="${h}" fill="url(#warmth)"/>
  ${vignette ? `<rect width="${w}" height="${h}" fill="url(#vig)"/>` : ''}
</svg>
`;
}

/** A soft shaft of daylight falling across a scene. */
function lightShaft(x, topW, bottomW, h, opacity = 0.17) {
  return `<path d="M ${x} 0 L ${x + topW} 0 L ${x + bottomW + topW * 0.4} ${h} L ${x - bottomW * 0.3} ${h} Z"
    fill="${p.gold300}" opacity="${opacity}" style="mix-blend-mode:screen"/>`;
}

/* ------------------------------------------------------------------ */
/* Exterior                                                            */
/* ------------------------------------------------------------------ */

export function exterior() {
  const defs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1D2B3A"/>
      <stop offset="0.42" stop-color="#5B4B48"/>
      <stop offset="0.72" stop-color="${p.terracotta400}"/>
      <stop offset="1" stop-color="${p.gold300}"/>
    </linearGradient>
    <linearGradient id="facade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.brown400}"/>
      <stop offset="0.6" stop-color="${p.brown500}"/>
      <stop offset="1" stop-color="${p.chocolate700}"/>
    </linearGradient>
    <linearGradient id="domeG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.teal500}"/>
      <stop offset="0.55" stop-color="${p.teal600}"/>
      <stop offset="1" stop-color="#1F4A49"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.gold300}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${p.terracotta500}" stop-opacity="0.75"/>
    </linearGradient>
    ${girihPattern('girihFacade', 96, p.gold300, 0.26, 1.2)}
  `;

  const windows = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = 318 + col * 122;
      const y = 470 + row * 132;
      const lit = (row * 8 + col * 3) % 5 !== 0;
      windows.push(
        `<path d="${pointedArch(x, y, 64, 96, 0.5)}" fill="${lit ? 'url(#glow)' : p.chocolate900}" opacity="${lit ? 0.92 : 0.8}"/>`,
        `<path d="${pointedArch(x - 7, y - 7, 78, 110, 0.5)}" fill="none" stroke="${p.gold400}" stroke-opacity="0.4" stroke-width="2.5"/>`,
      );
    }
  }

  const body = `
  <rect width="${W}" height="${H}" fill="url(#sky)"/>

  <!-- stars in the upper night band -->
  ${Array.from({ length: 26 }, (_, i) => {
    const x = (i * 137) % W;
    const y = 20 + ((i * 53) % 190);
    const r = i % 4 === 0 ? 2.1 : 1.3;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.ivory100}" opacity="${0.18 + (i % 5) * 0.08}"/>`;
  }).join('')}

  <!-- distant skyline -->
  <path d="M 0 640 L 120 612 L 190 640 L 300 596 L 420 640 L 540 606 L 1600 640 L 1600 ${H} L 0 ${H} Z"
        fill="${p.chocolate800}" opacity="0.45"/>

  <!-- flanking minarets -->
  ${[168, 1432].map((cx) => `
    <rect x="${cx - 27}" y="250" width="54" height="500" fill="url(#facade)"/>
    <rect x="${cx - 27}" y="250" width="54" height="500" fill="url(#girihFacade)" opacity="0.5"/>
    <rect x="${cx - 36}" y="236" width="72" height="22" rx="6" fill="${p.brown400}"/>
    <path d="${dome(cx, 236, 34, 56)}" fill="url(#domeG)"/>
    <path d="${domeRibs(cx, 236, 34, 56, 6)}" stroke="${p.gold300}" stroke-opacity="0.35" stroke-width="1.6" fill="none"/>
    <path d="${finial(cx, 180, 30)}" fill="${p.gold400}"/>
  `).join('')}

  <!-- main block -->
  <rect x="236" y="382" width="1128" height="${H - 382}" fill="url(#facade)"/>
  <rect x="236" y="382" width="1128" height="${H - 382}" fill="url(#girihFacade)" opacity="0.4"/>

  <!-- crowning dome over the iwan -->
  <path d="${dome(800, 392, 150, 212)}" fill="url(#domeG)"/>
  <path d="${domeRibs(800, 392, 150, 212, 11)}" stroke="${p.gold300}" stroke-opacity="0.32" stroke-width="2.4" fill="none"/>
  <path d="${dome(800, 392, 150, 212)}" fill="none" stroke="${p.gold400}" stroke-opacity="0.5" stroke-width="3"/>
  <path d="${finial(800, 180, 42)}" fill="${p.gold400}"/>

  <!-- the great iwan (entrance portal) -->
  <rect x="612" y="372" width="376" height="${H - 372}" fill="${p.chocolate700}"/>
  <rect x="612" y="372" width="376" height="${H - 372}" fill="url(#girihFacade)" opacity="0.55"/>
  <path d="${pointedArch(660, 430, 280, 560, 0.52)}" fill="${p.chocolate900}"/>
  <path d="${pointedArch(660, 430, 280, 560, 0.52)}" fill="none" stroke="${p.gold400}" stroke-width="6"/>
  <path d="${muqarnas(676, 596, 248, 4, 15)}" fill="${p.gold400}" opacity="0.3"/>
  <path d="${pointedArch(716, 660, 168, 330, 0.5)}" fill="url(#glow)" opacity="0.9"/>

  ${windows.join('')}

  <!-- ground, reflection and approach -->
  <rect y="${H - 118}" width="${W}" height="118" fill="${p.chocolate900}"/>
  <path d="M 660 ${H - 118} L 940 ${H - 118} L 1010 ${H} L 590 ${H} Z" fill="${p.gold400}" opacity="0.16"/>
  <ellipse cx="800" cy="${H - 110}" rx="300" ry="20" fill="${p.gold300}" opacity="0.14"/>

  <!-- lantern posts -->
  ${[470, 1130].map((x) => `
    <rect x="${x - 4}" y="${H - 250}" width="8" height="132" fill="${p.chocolate900}"/>
    <path d="${polygon(x, H - 262, 17, 6, Math.PI / 6)}" fill="${p.gold400}" opacity="0.92"/>
    <circle cx="${x}" cy="${H - 262}" r="44" fill="${p.gold300}" opacity="0.12"/>
  `).join('')}
  `;

  return frame('Samarkhand Hotel exterior at dusk — concept illustration', defs, body);
}

/* ------------------------------------------------------------------ */
/* Lobby / reception                                                   */
/* ------------------------------------------------------------------ */

export function lobby() {
  const defs = `
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.sand300}"/>
      <stop offset="0.55" stop-color="${p.sand200}"/>
      <stop offset="1" stop-color="${p.sand400}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.brown400}"/>
      <stop offset="1" stop-color="${p.chocolate700}"/>
    </linearGradient>
    <linearGradient id="deskG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.brown400}"/>
      <stop offset="1" stop-color="${p.espresso600}"/>
    </linearGradient>
    ${girihPattern('girihWall', 110, p.brown400, 0.3, 1.3)}
  `;

  const arches = [160, 640, 1120].map((x) => `
    <path d="${pointedArch(x, 150, 320, 560, 0.45)}" fill="${p.ivory100}" opacity="0.5"/>
    <path d="${pointedArch(x, 150, 320, 560, 0.45)}" fill="none" stroke="${p.brown400}" stroke-width="4" stroke-opacity="0.65"/>
    <path d="${archHead(x + 36, 196, 248, 190)}" fill="${p.gold300}" opacity="0.22"/>
    <path d="${muqarnas(x + 30, 332, 260, 3, 14)}" fill="${p.brown400}" opacity="0.22"/>
  `).join('');

  const body = `
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  <rect width="${W}" height="${H}" fill="url(#girihWall)" opacity="0.5"/>
  ${arches}
  ${lightShaft(980, 150, 300, H, 0.2)}
  ${lightShaft(300, 110, 230, H, 0.13)}

  <!-- floor -->
  <path d="M 0 ${H - 330} L ${W} ${H - 330} L ${W} ${H} L 0 ${H} Z" fill="url(#floor)"/>
  <path d="M 0 ${H - 330} L ${W} ${H - 330}" stroke="${p.gold400}" stroke-width="3" stroke-opacity="0.4"/>
  ${Array.from({ length: 9 }, (_, i) => {
    const cx = 110 + i * 190;
    return `<path d="${girihStar(cx, H - 150, 54, 23)}" fill="${p.gold400}" opacity="0.1"/>`;
  }).join('')}

  <!-- reception desk -->
  <path d="${roundedRect(520, H - 430, 560, 190, 12)}" fill="url(#deskG)"/>
  <path d="${roundedRect(520, H - 446, 560, 26, 8)}" fill="${p.sand200}"/>
  <path d="${roundedRect(556, H - 392, 488, 106, 6)}" fill="none" stroke="${p.gold400}" stroke-opacity="0.45" stroke-width="2.5"/>
  ${Array.from({ length: 5 }, (_, i) =>
    `<path d="${girihStar(620 + i * 90, H - 339, 22, 9)}" fill="${p.gold400}" opacity="0.4"/>`,
  ).join('')}

  <!-- pendant lamps -->
  ${[330, 800, 1270].map((x, i) => `
    <line x1="${x}" y1="0" x2="${x}" y2="${210 + i * 26}" stroke="${p.chocolate700}" stroke-width="3" stroke-opacity="0.7"/>
    <path d="${polygon(x, 252 + i * 26, 44, 8, Math.PI / 8)}" fill="${p.gold400}" opacity="0.9"/>
    <path d="${polygon(x, 252 + i * 26, 44, 8, Math.PI / 8)}" fill="none" stroke="${p.chocolate800}" stroke-width="2.5" stroke-opacity="0.6"/>
    <circle cx="${x}" cy="${252 + i * 26}" r="130" fill="${p.gold300}" opacity="0.1"/>
  `).join('')}

  <!-- seating -->
  ${[180, 1300].map((x) => `
    <path d="${roundedRect(x - 90, H - 300, 180, 92, 16)}" fill="${p.terracotta500}" opacity="0.88"/>
    <path d="${roundedRect(x - 90, H - 350, 180, 62, 14)}" fill="${p.terracotta400}" opacity="0.88"/>
    <path d="${roundedRect(x - 60, H - 336, 54, 42, 8)}" fill="${p.gold300}" opacity="0.5"/>
  `).join('')}

  <!-- planters -->
  ${[440, 1160].map((x) => `
    <path d="${roundedRect(x - 32, H - 268, 64, 76, 8)}" fill="${p.espresso600}"/>
    ${Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 2 + (i - 2.5) * 0.3;
      return `<path d="M ${x} ${H - 268} Q ${x + Math.cos(a) * 60} ${H - 330 + Math.sin(a) * 30} ${x + Math.cos(a) * 96} ${H - 372 + Math.sin(a) * 40}" stroke="${p.teal600}" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/>`;
    }).join('')}
  `).join('')}
  `;

  return frame('Samarkhand Hotel reception and lobby — concept illustration', defs, body);
}

/* ------------------------------------------------------------------ */
/* Guest rooms                                                         */
/* ------------------------------------------------------------------ */

/**
 * Shared guest-room composer. Variants differ in palette temperature, bed
 * width, window treatment and the furniture that dresses the scene.
 */
function guestRoom({
  title,
  wallTop,
  wallBottom,
  accent,
  bedW,
  extras = '',
  windowCount = 2,
  rugColor,
}) {
  const defs = `
    <linearGradient id="rwall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${wallTop}"/>
      <stop offset="1" stop-color="${wallBottom}"/>
    </linearGradient>
    <linearGradient id="rfloor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.brown400}"/>
      <stop offset="1" stop-color="${p.espresso600}"/>
    </linearGradient>
    <linearGradient id="daylight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.ivory50}"/>
      <stop offset="0.6" stop-color="${p.gold300}"/>
      <stop offset="1" stop-color="${p.terracotta400}"/>
    </linearGradient>
    <linearGradient id="linen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.ivory50}"/>
      <stop offset="1" stop-color="${p.sand200}"/>
    </linearGradient>
    ${girihPattern('girihRoom', 120, accent, 0.22, 1.2)}
  `;

  const floorY = H - 300;
  const bedX = 800 - bedW / 2;
  const bedY = floorY - 110;

  const windows = Array.from({ length: windowCount }, (_, i) => {
    const gap = windowCount === 1 ? 0 : 300;
    const x = 800 - ((windowCount - 1) * gap) / 2 + i * gap - 110;
    return `
      <path d="${pointedArch(x, 150, 220, 460, 0.46)}" fill="url(#daylight)"/>
      <path d="${pointedArch(x, 150, 220, 460, 0.46)}" fill="none" stroke="${p.espresso600}" stroke-width="7"/>
      <path d="M ${x + 110} 150 V 610" stroke="${p.espresso600}" stroke-width="5" stroke-opacity="0.8"/>
      <path d="M ${x} 430 H ${x + 220}" stroke="${p.espresso600}" stroke-width="5" stroke-opacity="0.8"/>
      <path d="${pointedArch(x - 26, 126, 272, 500, 0.46)}" fill="none" stroke="${accent}" stroke-width="3" stroke-opacity="0.5"/>
    `;
  }).join('');

  const body = `
  <rect width="${W}" height="${H}" fill="url(#rwall)"/>
  <rect width="${W}" height="${H}" fill="url(#girihRoom)" opacity="0.55"/>
  ${windows}
  ${lightShaft(700, 220, 420, H, 0.16)}

  <!-- floor + rug -->
  <rect y="${floorY}" width="${W}" height="${H - floorY}" fill="url(#rfloor)"/>
  <path d="${roundedRect(380, floorY + 70, 840, 190, 10)}" fill="${rugColor}" opacity="0.85"/>
  <path d="${roundedRect(410, floorY + 86, 780, 158, 8)}" fill="none" stroke="${p.gold300}" stroke-width="2.5" stroke-opacity="0.55"/>
  ${Array.from({ length: 6 }, (_, i) =>
    `<path d="${girihStar(470 + i * 132, floorY + 165, 30, 13)}" fill="${p.gold300}" opacity="0.3"/>`,
  ).join('')}

  <!-- headboard -->
  <path d="${roundedRect(bedX - 40, bedY - 250, bedW + 80, 262, 18)}" fill="${p.espresso600}"/>
  <path d="${roundedRect(bedX - 18, bedY - 228, bedW + 36, 218, 12)}" fill="${accent}" opacity="0.32"/>
  ${Array.from({ length: 5 }, (_, i) =>
    `<path d="${archHead(bedX + 10 + i * ((bedW - 20) / 5), bedY - 212, (bedW - 20) / 5 - 18, 150)}" fill="none" stroke="${p.gold400}" stroke-width="2.6" stroke-opacity="0.55"/>`,
  ).join('')}

  <!-- bed -->
  <path d="${roundedRect(bedX, bedY, bedW, 150, 10)}" fill="url(#linen)"/>
  <path d="${roundedRect(bedX, bedY + 96, bedW, 54, 8)}" fill="${accent}" opacity="0.7"/>
  <path d="${roundedRect(bedX, bedY + 96, bedW, 10, 4)}" fill="${p.gold400}" opacity="0.6"/>
  ${Array.from({ length: bedW > 520 ? 4 : 2 }, (_, i) => {
    const pw = (bedW - 60) / (bedW > 520 ? 4 : 2) - 20;
    return `<path d="${roundedRect(bedX + 30 + i * (pw + 20), bedY + 12, pw, 56, 12)}" fill="${p.ivory50}" stroke="${p.sand300}" stroke-width="2"/>`;
  }).join('')}
  <path d="${roundedRect(bedX - 6, bedY + 150, bedW + 12, 26, 6)}" fill="${p.chocolate700}"/>

  <!-- nightstands + lamps -->
  ${[bedX - 130, bedX + bedW + 30].map((x) => `
    <path d="${roundedRect(x, floorY - 60, 100, 92, 8)}" fill="${p.espresso600}"/>
    <path d="${roundedRect(x + 14, floorY - 40, 72, 6, 3)}" fill="${p.gold400}" opacity="0.6"/>
    <rect x="${x + 46}" y="${floorY - 132}" width="8" height="74" fill="${p.chocolate800}"/>
    <path d="M ${x + 18} ${floorY - 132} L ${x + 82} ${floorY - 132} L ${x + 72} ${floorY - 186} L ${x + 28} ${floorY - 186} Z" fill="${p.gold300}" opacity="0.9"/>
    <circle cx="${x + 50}" cy="${floorY - 160}" r="76" fill="${p.gold300}" opacity="0.12"/>
  `).join('')}

  ${extras}
  `;

  return frame(title, defs, body);
}

export function roomStandard() {
  const floorY = H - 300;
  return guestRoom({
    title: 'Standard room — concept illustration',
    wallTop: p.sand200,
    wallBottom: p.sand400,
    accent: p.brown400,
    bedW: 440,
    windowCount: 1,
    rugColor: p.brown500,
    extras: `
      <path d="${roundedRect(120, floorY - 150, 180, 150, 10)}" fill="${p.espresso600}"/>
      <path d="${roundedRect(138, floorY - 132, 144, 60, 6)}" fill="${p.sand200}" opacity="0.5"/>
      <path d="${roundedRect(138, floorY - 62, 144, 46, 6)}" fill="${p.sand200}" opacity="0.35"/>
      <path d="${roundedRect(1330, floorY - 320, 150, 320, 10)}" fill="${p.espresso600}"/>
      <path d="M 1405 ${floorY - 320} V ${floorY}" stroke="${p.chocolate900}" stroke-width="3"/>
      <circle cx="1392" cy="${floorY - 160}" r="6" fill="${p.gold400}"/>
      <circle cx="1418" cy="${floorY - 160}" r="6" fill="${p.gold400}"/>
    `,
  });
}

export function roomDeluxe() {
  const floorY = H - 300;
  return guestRoom({
    title: 'Deluxe room — concept illustration',
    wallTop: p.sand300,
    wallBottom: p.brown300,
    accent: p.terracotta500,
    bedW: 560,
    windowCount: 2,
    rugColor: p.terracotta500,
    extras: `
      <!-- armchair and side table -->
      <path d="${roundedRect(150, floorY - 170, 190, 170, 20)}" fill="${p.teal600}" opacity="0.9"/>
      <path d="${roundedRect(170, floorY - 100, 150, 86, 14)}" fill="${p.teal500}" opacity="0.9"/>
      <path d="${roundedRect(196, floorY - 92, 98, 40, 10)}" fill="${p.gold300}" opacity="0.45"/>
      <circle cx="420" cy="${floorY - 70}" r="46" fill="${p.espresso600}"/>
      <rect x="414" y="${floorY - 70}" width="12" height="70" fill="${p.espresso600}"/>
      <!-- framed tilework art -->
      <path d="${roundedRect(1240, 250, 230, 300, 8)}" fill="${p.chocolate700}"/>
      <path d="${roundedRect(1256, 266, 198, 268, 4)}" fill="${p.teal600}" opacity="0.6"/>
      <path d="${girihStar(1355, 400, 76, 32)}" fill="${p.gold400}" opacity="0.75"/>
    `,
  });
}

export function suite() {
  const floorY = H - 300;
  return guestRoom({
    title: 'Suite — concept illustration',
    wallTop: p.ivory100,
    wallBottom: p.sand300,
    accent: p.gold500,
    bedW: 600,
    windowCount: 2,
    rugColor: p.brown400,
    extras: `
      <!-- lounge corner -->
      <path d="${roundedRect(100, floorY - 180, 300, 180, 22)}" fill="${p.terracotta500}" opacity="0.9"/>
      <path d="${roundedRect(124, floorY - 104, 252, 90, 16)}" fill="${p.terracotta400}" opacity="0.95"/>
      ${[150, 240, 330].map((x) => `<path d="${roundedRect(x, floorY - 166, 64, 58, 12)}" fill="${p.gold300}" opacity="0.5"/>`).join('')}
      <path d="${roundedRect(440, floorY - 64, 170, 64, 10)}" fill="${p.espresso600}"/>
      <path d="${roundedRect(470, floorY - 86, 40, 24, 4)}" fill="${p.gold400}" opacity="0.7"/>
      <!-- writing desk -->
      <path d="${roundedRect(1220, floorY - 120, 280, 24, 6)}" fill="${p.espresso600}"/>
      <rect x="1240" y="${floorY - 96}" width="14" height="96" fill="${p.espresso600}"/>
      <rect x="1466" y="${floorY - 96}" width="14" height="96" fill="${p.espresso600}"/>
      <path d="${roundedRect(1270, floorY - 146, 90, 26, 4)}" fill="${p.sand200}"/>
      <!-- chandelier -->
      <line x1="800" y1="0" x2="800" y2="120" stroke="${p.chocolate700}" stroke-width="4"/>
      <path d="${polygon(800, 172, 66, 8, Math.PI / 8)}" fill="${p.gold400}" opacity="0.85"/>
      <path d="${polygon(800, 172, 66, 8, Math.PI / 8)}" fill="none" stroke="${p.chocolate800}" stroke-width="3" stroke-opacity="0.5"/>
      <circle cx="800" cy="172" r="190" fill="${p.gold300}" opacity="0.1"/>
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Bathroom                                                            */
/* ------------------------------------------------------------------ */

export function bathroom() {
  const defs = `
    <linearGradient id="bwall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.ivory50}"/>
      <stop offset="1" stop-color="${p.sand300}"/>
    </linearGradient>
    <linearGradient id="marble" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.sand200}"/>
      <stop offset="0.5" stop-color="${p.ivory50}"/>
      <stop offset="1" stop-color="${p.sand300}"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.teal500}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${p.teal600}" stop-opacity="0.6"/>
    </linearGradient>
    ${girihPattern('girihBath', 84, p.teal600, 0.3, 1.1)}
  `;
  const floorY = H - 260;

  const body = `
  <rect width="${W}" height="${H}" fill="url(#bwall)"/>
  <rect x="0" y="0" width="${W}" height="${floorY}" fill="url(#girihBath)" opacity="0.4"/>

  <!-- tiled feature wall -->
  <rect x="860" y="0" width="740" height="${floorY}" fill="${p.teal600}" opacity="0.12"/>
  ${Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) =>
      `<path d="${girihStar(905 + c * 105, 70 + r * 105, 36, 15)}" fill="${p.teal600}" opacity="${0.1 + ((r + c) % 3) * 0.06}"/>`,
    ).join(''),
  ).join('')}

  ${lightShaft(220, 160, 300, floorY, 0.2)}
  <path d="${pointedArch(150, 120, 300, 520, 0.46)}" fill="${p.ivory50}" opacity="0.85"/>
  <path d="${pointedArch(150, 120, 300, 520, 0.46)}" fill="none" stroke="${p.brown400}" stroke-width="6" stroke-opacity="0.6"/>

  <!-- floor -->
  <rect y="${floorY}" width="${W}" height="${H - floorY}" fill="url(#marble)"/>
  <path d="M 0 ${floorY} H ${W}" stroke="${p.brown400}" stroke-width="3" stroke-opacity="0.35"/>

  <!-- freestanding tub -->
  <path d="${roundedRect(360, floorY - 210, 520, 210, 96)}" fill="url(#marble)" stroke="${p.brown400}" stroke-width="4" stroke-opacity="0.45"/>
  <path d="${roundedRect(392, floorY - 180, 456, 120, 70)}" fill="url(#water)"/>
  <path d="M 420 ${floorY - 150} q 60 -18 120 0 t 120 0 t 120 0" stroke="${p.ivory50}" stroke-width="3" fill="none" opacity="0.6"/>
  <path d="M 880 ${floorY - 300} v 86 q 0 22 -24 22 h -30" stroke="${p.gold500}" stroke-width="9" fill="none" stroke-linecap="round"/>

  <!-- vanity -->
  <path d="${roundedRect(1080, floorY - 150, 420, 34, 8)}" fill="${p.espresso600}"/>
  <path d="${roundedRect(1098, floorY - 116, 384, 116, 8)}" fill="${p.brown500}"/>
  <path d="${roundedRect(1130, floorY - 92, 150, 68, 6)}" fill="none" stroke="${p.gold400}" stroke-width="2.4" stroke-opacity="0.6"/>
  <path d="${roundedRect(1300, floorY - 92, 150, 68, 6)}" fill="none" stroke="${p.gold400}" stroke-width="2.4" stroke-opacity="0.6"/>
  <ellipse cx="1290" cy="${floorY - 150}" rx="104" ry="26" fill="${p.ivory50}" stroke="${p.sand300}" stroke-width="3"/>
  <path d="M 1290 ${floorY - 236} v 60" stroke="${p.gold500}" stroke-width="8" stroke-linecap="round"/>

  <!-- arched mirror -->
  <path d="${pointedArch(1180, 200, 220, 380, 0.46)}" fill="${p.teal600}" opacity="0.22"/>
  <path d="${pointedArch(1180, 200, 220, 380, 0.46)}" fill="none" stroke="${p.gold500}" stroke-width="5"/>

  <!-- folded towels -->
  ${[1120, 1420].map((x) => `
    <path d="${roundedRect(x, floorY - 196, 110, 26, 6)}" fill="${p.ivory50}" stroke="${p.sand300}" stroke-width="2"/>
    <path d="${roundedRect(x + 6, floorY - 222, 98, 26, 6)}" fill="${p.ivory50}" stroke="${p.sand300}" stroke-width="2"/>
  `).join('')}
  `;

  return frame('Bathroom and amenities — concept illustration', defs, body);
}

/* ------------------------------------------------------------------ */
/* Restaurant                                                          */
/* ------------------------------------------------------------------ */

export function restaurant() {
  const defs = `
    <linearGradient id="dwall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.chocolate700}"/>
      <stop offset="1" stop-color="${p.espresso600}"/>
    </linearGradient>
    <linearGradient id="dfloor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.espresso600}"/>
      <stop offset="1" stop-color="${p.chocolate900}"/>
    </linearGradient>
    ${girihPattern('girihDine', 100, p.gold400, 0.3, 1.2)}
  `;
  const floorY = H - 280;

  const tables = [280, 800, 1320].map((x, i) => {
    const scale = 1 - i * 0.03;
    const ty = floorY - 40 + i * 6;
    return `
      <ellipse cx="${x}" cy="${ty}" rx="${130 * scale}" ry="${34 * scale}" fill="${p.ivory100}"/>
      <path d="${roundedRect(x - 128 * scale, ty, 256 * scale, 110, 6)}" fill="${p.ivory100}" opacity="0.92"/>
      <path d="M ${x - 128 * scale} ${ty + 110} q ${128 * scale} 26 ${256 * scale} 0" fill="${p.sand200}" opacity="0.9"/>
      <!-- candle -->
      <rect x="${x - 6}" y="${ty - 54}" width="12" height="46" fill="${p.ivory50}"/>
      <ellipse cx="${x}" cy="${ty - 60}" rx="7" ry="11" fill="${p.gold300}"/>
      <circle cx="${x}" cy="${ty - 60}" r="54" fill="${p.gold300}" opacity="0.16"/>
      <!-- place settings -->
      <circle cx="${x - 62}" cy="${ty - 6}" r="26" fill="${p.sand300}" opacity="0.9"/>
      <circle cx="${x + 62}" cy="${ty - 6}" r="26" fill="${p.sand300}" opacity="0.9"/>
      <!-- chairs -->
      <path d="${roundedRect(x - 220, ty - 40, 52, 120, 12)}" fill="${p.terracotta500}" opacity="0.9"/>
      <path d="${roundedRect(x + 168, ty - 40, 52, 120, 12)}" fill="${p.terracotta500}" opacity="0.9"/>
    `;
  }).join('');

  const body = `
  <rect width="${W}" height="${H}" fill="url(#dwall)"/>
  <rect width="${W}" height="${H}" fill="url(#girihDine)" opacity="0.4"/>

  <!-- arcade of lit niches -->
  ${[70, 480, 890, 1300].map((x) => `
    <path d="${pointedArch(x, 120, 230, 480, 0.46)}" fill="${p.chocolate900}" opacity="0.6"/>
    <path d="${pointedArch(x, 120, 230, 480, 0.46)}" fill="none" stroke="${p.gold400}" stroke-width="3.5" stroke-opacity="0.65"/>
    <path d="${archHead(x + 44, 176, 142, 130)}" fill="${p.gold300}" opacity="0.3"/>
    <circle cx="${x + 115}" cy="420" r="16" fill="${p.gold300}" opacity="0.8"/>
    <circle cx="${x + 115}" cy="420" r="70" fill="${p.gold300}" opacity="0.1"/>
  `).join('')}

  <rect y="${floorY}" width="${W}" height="${H - floorY}" fill="url(#dfloor)"/>
  <path d="M 0 ${floorY} H ${W}" stroke="${p.gold400}" stroke-width="3" stroke-opacity="0.35"/>
  ${tables}

  <!-- hanging lanterns -->
  ${[280, 800, 1320].map((x, i) => `
    <line x1="${x}" y1="0" x2="${x}" y2="${150 + i * 18}" stroke="${p.chocolate900}" stroke-width="3"/>
    <path d="${polygon(x, 196 + i * 18, 40, 6, Math.PI / 6)}" fill="${p.gold400}" opacity="0.9"/>
    <circle cx="${x}" cy="${196 + i * 18}" r="120" fill="${p.gold300}" opacity="0.1"/>
  `).join('')}
  `;

  return frame('Restaurant and breakfast room — concept illustration', defs, body);
}

/* ------------------------------------------------------------------ */
/* Architectural details                                               */
/* ------------------------------------------------------------------ */

export function detailTilework() {
  const defs = `
    <linearGradient id="tileBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.teal600}"/>
      <stop offset="1" stop-color="#1C4342"/>
    </linearGradient>
  `;
  const grid = [];
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      const cx = 80 + c * 160;
      const cy = 90 + r * 148;
      grid.push(
        `<path d="${girihStar(cx, cy, 68, 29)}" fill="${p.gold400}" opacity="${0.5 + ((r + c) % 3) * 0.14}"/>`,
        `<path d="${polygon(cx, cy, 26, 8, Math.PI / 8)}" fill="${p.terracotta500}" opacity="0.85"/>`,
        `<path d="${polygon(cx + 80, cy + 74, 34, 6, Math.PI / 6)}" fill="${p.ivory100}" opacity="0.2"/>`,
      );
    }
  }
  return frame(
    'Samarkand-inspired girih tilework — concept illustration',
    defs,
    `<rect width="${W}" height="${H}" fill="url(#tileBg)"/>${grid.join('')}`,
  );
}

export function detailArch() {
  const defs = `
    <linearGradient id="aBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.sand200}"/>
      <stop offset="1" stop-color="${p.brown300}"/>
    </linearGradient>
    ${girihPattern('girihA', 90, p.brown500, 0.3, 1.2)}
  `;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#aBg)"/>
    <rect width="${W}" height="${H}" fill="url(#girihA)" opacity="0.5"/>
    ${lightShaft(620, 240, 420, H, 0.22)}
    <path d="${pointedArch(440, 90, 720, 977, 0.5)}" fill="${p.chocolate800}" opacity="0.92"/>
    <path d="${pointedArch(440, 90, 720, 977, 0.5)}" fill="none" stroke="${p.gold400}" stroke-width="9"/>
    <path d="${muqarnas(476, 470, 648, 5, 26)}" fill="${p.gold400}" opacity="0.35"/>
    <path d="${pointedArch(596, 560, 408, 507, 0.5)}" fill="${p.gold300}" opacity="0.5"/>
    <path d="${girihStar(800, 300, 96, 41)}" fill="${p.gold400}" opacity="0.75"/>
  `;
  return frame('Timurid arch detail — concept illustration', defs, body);
}

/* ------------------------------------------------------------------ */
/* Campaign creative                                                   */
/* ------------------------------------------------------------------ */

/**
 * Text-free campaign backdrops. Copy is rendered by the carousel component so
 * it stays translatable, selectable and readable by screen readers.
 */
export function campaign(variant, { w = 1920, h = 1080 } = {}) {
  const schemes = {
    autumn: {
      a: p.chocolate800,
      b: p.terracotta500,
      accent: p.gold400,
      title: 'Autumn stay campaign backdrop',
    },
    earlybird: {
      a: '#1F3B46',
      b: p.teal600,
      accent: p.gold300,
      title: 'Early booking campaign backdrop',
    },
    weekend: {
      a: p.espresso600,
      b: p.brown400,
      accent: p.gold400,
      title: 'Weekend escape campaign backdrop',
    },
  };
  const s = schemes[variant] ?? schemes.autumn;

  const defs = `
    <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${s.a}"/>
      <stop offset="1" stop-color="${s.b}"/>
    </linearGradient>
    ${girihPattern('cGirih', 140, s.accent, 0.3, 1.6)}
  `;

  const body = `
    <rect width="${w}" height="${h}" fill="url(#cbg)"/>
    <rect width="${w}" height="${h}" fill="url(#cGirih)" opacity="0.6"/>
    <g opacity="0.9">
      <path d="${dome(w * 0.5, h * 0.62, w * 0.17, h * 0.3)}" fill="${s.accent}" opacity="0.22"/>
      <path d="${pointedArch(w * 0.5 - w * 0.1, h * 0.3, w * 0.2, h * 0.7, 0.45)}" fill="none" stroke="${s.accent}" stroke-width="5" stroke-opacity="0.65"/>
      <path d="${girihStar(w * 0.5, h * 0.44, w * 0.055, w * 0.023)}" fill="${s.accent}" opacity="0.8"/>
    </g>
    ${[0.16, 0.84].map((fx) => `
      <path d="${pointedArch(w * fx - w * 0.07, h * 0.36, w * 0.14, h * 0.64, 0.45)}" fill="none" stroke="${s.accent}" stroke-width="3.5" stroke-opacity="0.4"/>
    `).join('')}
    <rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="${p.night}" opacity="0.35"/>
    <rect width="${w}" height="${h}" fill="url(#vig)"/>
  `;

  return frame(`${s.title} — concept illustration`, defs, body, { w, h, vignette: false });
}
