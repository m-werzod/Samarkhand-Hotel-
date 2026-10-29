/**
 * Reusable SVG geometry for the Samarkhand Hotel illustration set.
 *
 * Everything here is pure path maths so the artwork stays resolution
 * independent, tiny over the wire, and reproducible from source.
 */

/**
 * A four-centred pointed arch (the "Timurid" profile) as a closed path.
 *
 * @param {number} x      Left edge.
 * @param {number} y      Top of the springing line's bounding box (apex y).
 * @param {number} w      Width of the opening.
 * @param {number} h      Total height from apex to base.
 * @param {number} rise   0..1, how much of the height the arch head occupies.
 */
export function pointedArch(x, y, w, h, rise = 0.46) {
  const headH = h * rise;
  const springY = y + headH;
  const cx = x + w / 2;
  const k = w * 0.28;
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${springY}`,
    `C ${x} ${springY - headH * 0.55} ${cx - k} ${y + headH * 0.1} ${cx} ${y}`,
    `C ${cx + k} ${y + headH * 0.1} ${x + w} ${springY - headH * 0.55} ${x + w} ${springY}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * The arch head only (no jambs) — used for tympanum fills and logo marks.
 */
export function archHead(x, y, w, h) {
  const cx = x + w / 2;
  const k = w * 0.28;
  return [
    `M ${x} ${y + h}`,
    `C ${x} ${y + h * 0.45} ${cx - k} ${y + h * 0.1} ${cx} ${y}`,
    `C ${cx + k} ${y + h * 0.1} ${x + w} ${y + h * 0.45} ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * A ribbed melon dome with its drum, as used on Samarkand's mausolea.
 */
export function dome(cx, baseY, radius, height) {
  const r = radius;
  return [
    `M ${cx - r} ${baseY}`,
    `C ${cx - r} ${baseY - height * 0.72} ${cx - r * 0.62} ${baseY - height} ${cx} ${baseY - height}`,
    `C ${cx + r * 0.62} ${baseY - height} ${cx + r} ${baseY - height * 0.72} ${cx + r} ${baseY}`,
    'Z',
  ].join(' ');
}

/** Vertical rib lines across a dome, for the melon-fluting effect. */
export function domeRibs(cx, baseY, radius, height, count = 7) {
  const lines = [];
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const x = cx - radius + radius * 2 * t;
    const bulge = Math.sin(t * Math.PI);
    const topY = baseY - height * bulge * 0.98;
    lines.push(`M ${x} ${baseY} Q ${x} ${topY + height * 0.1} ${x} ${topY}`);
  }
  return lines.join(' ');
}

/** The finial spike that crowns a dome. */
export function finial(cx, topY, h = 26) {
  return `M ${cx} ${topY - h} L ${cx + 3.2} ${topY - h * 0.42} L ${cx} ${topY} L ${cx - 3.2} ${topY - h * 0.42} Z`;
}

/**
 * An eight-point girih star — the core motif of Samarkand tilework.
 */
export function girihStar(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/** A regular polygon, used for the girih field's connecting hexagons. */
export function polygon(cx, cy, r, sides, rotation = 0) {
  const pts = [];
  for (let i = 0; i < sides; i += 1) {
    const a = ((Math.PI * 2) / sides) * i + rotation;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

/**
 * A tileable girih pattern tile, emitted as a `<pattern>` definition.
 */
export function girihPattern(id, size, color, opacity = 0.5, strokeWidth = 1.1) {
  const h = size / 2;
  const star = girihStar(h, h, h * 0.62, h * 0.26);
  const corner = [
    girihStar(0, 0, h * 0.4, h * 0.17),
    girihStar(size, 0, h * 0.4, h * 0.17),
    girihStar(0, size, h * 0.4, h * 0.17),
    girihStar(size, size, h * 0.4, h * 0.17),
  ].join(' ');
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
    <path d="${star}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    <path d="${corner}" fill="none" stroke="${color}" stroke-opacity="${opacity * 0.7}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    <path d="${polygon(h, h, h * 0.26, 8, Math.PI / 8)}" fill="${color}" fill-opacity="${opacity * 0.18}"/>
  </pattern>`;
}

/** Muqarnas-style stepped corbelling tucked under an arch head. */
export function muqarnas(x, y, w, rows = 3, cellH = 11) {
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    const inset = (w * 0.08) * r;
    const rowW = w - inset * 2;
    const cells = Math.max(2, Math.round(rowW / (w / 7)));
    const cw = rowW / cells;
    for (let c = 0; c < cells; c += 1) {
      const cxx = x + inset + c * cw;
      const cyy = y + r * cellH;
      out.push(
        `M ${cxx} ${cyy + cellH} L ${cxx} ${cyy + cellH * 0.35} Q ${cxx + cw / 2} ${cyy - cellH * 0.25} ${cxx + cw} ${cyy + cellH * 0.35} L ${cxx + cw} ${cyy + cellH} Z`,
      );
    }
  }
  return out.join(' ');
}

/** Soft rounded rectangle path (avoids relying on rx for clipped shapes). */
export function roundedRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    'Z',
  ].join(' ');
}
