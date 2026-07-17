// parts/act/siren.js — speaker/siren: basket spokes COUNTED, cone rings, magnet HL.
import { L, C, RC, TX, frame, fitK, W, DASH, G, QUANT, pad } from '../lib.js';
const SIZES = [16, 24, 36];                                   // QUANTISED cone Ø

export const meta = {
  id: 'siren', bin: 'ACT', label: 'SIREN / SPEAKER',
  params: { d: { def: 24, stock: SIZES }, sealed: { def: false } },
  slots: [],
  functions: { provides: ['sound'], needs: ['power', 'control'], rates: {} },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.1 },
  pushedDraw: ['+1: overdriven — surround doubled (second ring)', '+2: coil heat — vent demanded behind magnet, stencil struck'],
  graftsInto: ['SENSE/microphone seat (same footprint family — a speaker IS a mic pushed backward)'],
  variants: [
    { label: 'Ø24', p: {} },
    { label: 'Ø36', p: { d: 36 } },
    { label: 'Ø16 · SEALED', p: { d: 16, sealed: true } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 24, SIZES), sealed: !!p?.sealed });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.d + 6, q.d + 8, view.fit ?? 140);
  const r = q.d / 2 * k, c = r + 3 * k;
  let out = C(c, c, r, heavy ? W.cut : W.vis, '#fff');          // frame rim
  out += C(c, c, r * 0.86, heavy ? W.vis : 0.7);                // surround
  // cone rings COUNTED
  const nR = heavy ? 2 : 3;
  for (let i = 1; i <= nR; i++) out += C(c, c, r * (0.72 - 0.16 * i), heavy ? W.vis : 0.8);
  out += C(c, c, r * 0.18, heavy ? W.vis : W.mid, '#fff');      // dust cap
  // basket spokes COUNTED (4), magnet ring HL
  if (!heavy) {
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + G.TAU * i / 4; out += L(c + r * 0.86 * Math.cos(a), c + r * 0.86 * Math.sin(a), c + r * Math.cos(a), c + r * Math.sin(a), W.mid); }
    out += `<circle cx="${c.toFixed(1)}" cy="${c.toFixed(1)}" r="${(r * 0.42).toFixed(1)}" fill="none" stroke="#111" stroke-width="0.8" stroke-dasharray="${DASH.hl}"/>`; // magnet behind
    if (q.sealed) out += C(c, c, r + 1.2 * k, W.mid); // gasket bead
    // mount holes 4
    for (let i = 0; i < 4; i++) { const a = G.TAU * i / 4; out += C(c + (r + 1.6 * k) * Math.cos(a), c + (r + 1.6 * k) * Math.sin(a), 0.7 * k, 0.7); }
    out += pad(c - r - 2.6 * k, c + r * 0.5, 1 * k) + pad(c - r - 2.6 * k, c + r * 0.72, 1 * k);
    if (dens >= 3) out += TX(c, 2 * c + 8, q.sealed ? 'SEALED BEAD' : 'OPEN BASKET', 8);
  }
  return frame(2 * c, 2 * c + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the voice-coil pads ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k, c = r + 3 * k;
  return { x: c - r - 2.6 * k, y: c + r * 0.5 };
}
