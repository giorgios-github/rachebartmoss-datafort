// parts/graft/reducer-bushing.js — Ø-to-Ø ring: knurled outer, keyed inner, split.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, knurl } from '../lib.js';
const OUTS = [10, 14, 18];                                    // QUANTISED outer Ø

export const meta = {
  id: 'reducer-bushing', bin: 'GRAFT', label: 'REDUCER BUSHING',
  params: { outer: { def: 14, stock: OUTS }, inner: { def: 8 } },
  slots: [],
  functions: { provides: ['fit (Ø A seat ← Ø B part)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['unpushable — two bushings nested is the drawing that should worry you'],
  graftsInto: ['any round seat: cell → magazine bay, spool → vessel bay, pin → socket'],
  variants: [
    { label: 'Ø14 → Ø8', p: {} },
    { label: 'Ø18 → Ø10', p: { outer: 18, inner: 10 } },
    { label: 'Ø10 → Ø5', p: { outer: 10, inner: 5 } }
  ]
};
const norm = p => { const o = QUANT.snap(p?.outer ?? 14, OUTS); return { outer: o, inner: Math.min(p?.inner ?? 8, o - 3) }; };

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.outer + 6, q.outer + 6, view.fit ?? 120);
  const rO = q.outer / 2 * k, rI = q.inner / 2 * k, c = rO + 3 * k;
  let out = C(c, c, rO, heavy ? W.cut : W.vis, '#fff');
  out += knurl(c, c, rO, 1.8 * k, 1.6 * k, heavy ? 1.1 : 0.7);   // press-grip knurl
  out += C(c, c, rI + 1 * k, heavy ? W.vis : 0.7);               // shoulder
  out += C(c, c, rI, heavy ? W.cut : W.vis, '#fff');
  // split (spring compliance) + inner key
  out += L(c, c - rO, c, c - rI, heavy ? W.cut : W.vis);
  out += RC(c - 0.7 * k, c + rI - 0.2 * k, 1.4 * k, 1.4 * k, heavy ? W.vis : W.mid, '#fff');
  if (dens >= 3 && !heavy) {
    out += L(c - rO, c + rO + 2.4 * k, c + rO, c + rO + 2.4 * k, 0.7);
    out += TX(c, c + rO + 2.4 * k + 10, `Ø${q.outer} → Ø${q.inner} · SPLIT RING`, 8);
  }
  return frame(2 * c, 2 * c + (dens >= 3 && !heavy ? 4 * k + 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 44 }); }
export function binGlyph() { return thumb({}); }
