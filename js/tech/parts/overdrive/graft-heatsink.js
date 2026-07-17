// parts/overdrive/graft-heatsink.js — strap-on cooler, PLAN VIEW: an outlined surface
// with fin lines inside (never a rake). Custom area via w×h params.
import { L, C, RC, TX, frame, fitK, W, QUANT } from '../lib.js';
const STOCK = [12, 18, 26, 36];                               // QUANTISED side mm

export const meta = {
  id: 'graft-heatsink', bin: 'OVERDRIVE', label: 'GRAFT HEATSINK',
  params: { w: { def: 18, stock: STOCK }, h: { def: 18, stock: STOCK, note: 'custom area = w × h, snapped' } },
  slots: [],
  functions: { provides: ['cool (graft-on)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['it IS a push drawable: its presence on a part means that part runs past rated'],
  graftsInto: ['any flat face ≥ its area (straps through the tabs — no drilling)'],
  variants: [
    { label: '18 × 18', p: {} },
    { label: '36 × 12 · CUSTOM AREA', p: { w: 36, h: 12 } },
    { label: '12 × 26 · CUSTOM AREA', p: { w: 12, h: 26 } }
  ]
};
const norm = p => ({ w: QUANT.snap(p?.w ?? 18, STOCK), h: QUANT.snap(p?.h ?? 18, STOCK) });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.w + 10, q.h + 6, view.fit ?? 140);
  const wpx = q.w * k, hpx = q.h * k, x0 = 4 * k, y0 = 2 * k;
  // plan: base outline + fin lines running the long axis of the surface
  let out = RC(x0, y0, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
  const alongX = wpx >= hpx;                                   // fins across the short dim
  const n = Math.max(3, Math.round((alongX ? wpx : hpx) / (2.2 * k)));
  for (let i = 1; i < n; i++) {
    if (alongX) out += L(x0 + wpx * i / n, y0 + 1 * k, x0 + wpx * i / n, y0 + hpx - 1 * k, heavy ? 1.4 : 0.8);
    else out += L(x0 + 1 * k, y0 + hpx * i / n, x0 + wpx - 1 * k, y0 + hpx * i / n, heavy ? 1.4 : 0.8);
  }
  // strap tabs with slots, on the fin-end sides
  for (const s of [-1, 1]) {
    const tx = alongX ? (s < 0 ? x0 - 3 * k : x0 + wpx) : x0 + wpx / 2 - 1.5 * k + s * 0;
    if (alongX) {
      out += RC(tx, y0 + hpx / 2 - 1.5 * k, 3 * k, 3 * k, heavy ? W.vis : W.mid, '#fff');
      out += RC(tx + 0.9 * k, y0 + hpx / 2 - 0.8 * k, 1.2 * k, 1.6 * k, heavy ? 1.2 : 0.7, '#fff');
    } else {
      const tyy = s < 0 ? y0 - 3 * k : y0 + hpx;
      out += RC(x0 + wpx / 2 - 1.5 * k, tyy, 3 * k, 3 * k, heavy ? W.vis : W.mid, '#fff');
      out += RC(x0 + wpx / 2 - 0.8 * k, tyy + 0.9 * k, 1.6 * k, 1.2 * k, heavy ? 1.2 : 0.7, '#fff');
    }
  }
  if (dens >= 3 && !heavy) out += TX(x0 + wpx / 2, y0 + hpx + (alongX ? 1.4 : 4.4) * k + 10, 'PLAN · PAD UNDER', 8);
  const padB = alongX ? 0 : 3.4 * k;
  return frame(x0 + wpx + 4 * k, y0 + hpx + padB + (dens >= 3 && !heavy ? 16 : 3), out, 6);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({}); }
