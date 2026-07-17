// parts/graft/adapter-plate.js — two hole patterns on one plate: the graft made visible.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, screwMini } from '../lib.js';
const SIZES = [20, 28];                                       // QUANTISED plate mm

export const meta = {
  id: 'adapter-plate', bin: 'GRAFT', label: 'ADAPTER PLATE',
  params: { s: { def: 20, stock: SIZES } },
  slots: [],
  functions: { provides: ['mount (pattern A ⇄ pattern B)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['a plate is never pushed — stacking a second plate IS the drawing (and the warning)'],
  graftsInto: ['it is HOW things graft: wrong-bin seat + plate = legal drawing, legible crime'],
  variants: [
    { label: 'S20 · A→B', p: {} },
    { label: 'S28 · A→B', p: { s: 28 } },
    { label: 'S20 · STACKED ×2', p: { stacked: true } }
  ]
};
const norm = p => ({ s: QUANT.snap(p?.s ?? 20, SIZES), stacked: !!p?.stacked });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.s + 6, q.s + 6, view.fit ?? 130);
  const s = q.s * k, x0 = 3 * k, y0 = 3 * k;
  let out = '';
  if (q.stacked && !heavy) out += RC(x0 + 1.6 * k, y0 - 1.6 * k, s, s, W.mid, '#fff'); // second plate behind
  out += RC(x0, y0, s, s, heavy ? W.cut : W.vis, '#fff');
  // pattern A: 4 round bores, wide square (the host)
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    out += C(x0 + s / 2 + sx * s * 0.36, y0 + s / 2 + sy * s * 0.36, 1.1 * k, heavy ? W.vis : W.mid);
  // pattern B: 2 counter-sunk slots, tight pitch, rotated 45° (the graft)
  for (const sx of [-1, 1]) {
    const cx = x0 + s / 2 + sx * s * 0.16, cy = y0 + s / 2 - sx * s * 0.16;
    out += RC(cx - 1.6 * k, cy - 0.8 * k, 3.2 * k, 1.6 * k, heavy ? W.vis : W.mid, '#fff', null, 0.8 * k);
    if (!heavy) out += C(cx, cy, 0.5 * k, 0.7);
  }
  // mismatch witness: A axis vs B axis CL
  if (!heavy) {
    out += L(x0 + s * 0.14, y0 + s * 0.14, x0 + s * 0.86, y0 + s * 0.86, 0.5, DASH.cl);
    if (dens >= 3) out += TX(x0 + s / 2, y0 + s + 14, q.stacked ? 'STACK OF 2 — THE TELL DOUBLES' : 'PATTERN A ⇄ PATTERN B', 8);
  }
  return frame(s + 6 * k, s + 6 * k + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({}); }
