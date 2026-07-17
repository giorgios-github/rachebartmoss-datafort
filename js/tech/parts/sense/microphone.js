// parts/sense/microphone.js — capsule: grille slots COUNTED, gasket ring, 2 pads.
import { L, C, RC, frame, fitK, W, G, QUANT, pad } from '../lib.js';
const SIZES = [6, 10, 14];                                    // QUANTISED capsule Ø

export const meta = {
  id: 'microphone', bin: 'SENSE', label: 'MICROPHONE',
  params: { d: { def: 10, stock: SIZES }, boom: { def: false } },
  slots: [],
  functions: { provides: ['sense-audio'], needs: ['power'], rates: {} },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.06 },
  pushedDraw: ['+1: gain push — second gasket ring demanded (isolation)'],
  graftsInto: ['INTERFACE/speaker seat (same footprint family, shim set)'],
  variants: [
    { label: 'Ø10', p: {} },
    { label: 'Ø6 · PINHOLE', p: { d: 6 } },
    { label: 'Ø14 · BOOM', p: { d: 14, boom: true } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 10, SIZES), boom: !!p?.boom });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.d + (q.boom ? 14 : 6), q.d + 4, view.fit ?? 110);
  const r = q.d / 2 * k, c = r + 2 * k;
  let out = C(c, c, r, heavy ? W.cut : W.vis, '#fff');
  out += C(c, c, r - 1 * k, heavy ? W.vis : 0.7);              // gasket ring
  // grille: hex-packed sound holes (COUNTED @ FIXED 1.8 mm pitch) — reads MIC
  const rg = r - 1.7 * k, hp = (heavy ? 2.6 : 1.8) * k, hr = (heavy ? 0.7 : 0.42) * k;
  for (let row = -Math.floor(rg / (hp * 0.87)); row <= Math.floor(rg / (hp * 0.87)); row++) {
    const y = c + row * hp * 0.87, off = (row % 2 ? hp / 2 : 0);
    for (let col = -Math.ceil(rg / hp) - 1; col <= Math.ceil(rg / hp) + 1; col++) {
      const x = c + col * hp + off;
      if (Math.hypot(x - c, y - c) <= rg - hr) out += C(x, y, hr, 0, '#111');
    }
  }
  if (q.boom && !heavy) {                                      // boom stalk + pivot
    out += L(c + r, c, c + r + 9 * k, c, W.vis) + C(c + r + 9 * k, c, 1.6 * k, W.mid, '#fff') + C(c + r + 9 * k, c, 0.5 * k, 0, '#111');
  }
  if (!heavy) { out += pad(c - 2 * k, c + r + 2.2 * k, 1 * k) + pad(c + 2 * k, c + r + 2.2 * k, 1 * k); }
  return frame(2 * c + (q.boom && !heavy ? 11 * k : 0), 2 * c + (heavy ? 0 : 3.6 * k), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 42 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the pad pair below the capsule ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k, c = r + 2 * k;
  return { x: c - 2 * k, y: c + r + 2.2 * k };
}
