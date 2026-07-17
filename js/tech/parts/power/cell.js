// parts/power/cell.js — chemistry × format × capacity. Payload of every powered thing.
import { L, C, RC, TX, POLY, frame, fitK, N, W, DASH, QUANT } from '../lib.js';
const CAPS = [1, 2, 4, 8];                                    // QUANTISED capacity quanta
// per-format stock dims indexed by capacity quantum
const DIMS = {
  prismatic: { 1: [12, 20], 2: [16, 26], 4: [22, 34], 8: [30, 44] },
  cylindrical: { 1: [8, 26], 2: [10, 34], 4: [14, 46], 8: [18, 60] }, // [Ø, len]
  coin: { 1: [10, 10], 2: [14, 14], 4: [20, 20], 8: [24, 24] }
};

export const meta = {
  id: 'cell', bin: 'POWER', label: 'CELL',
  params: {
    chem: { def: 'chem', options: ['chem', 'bio', 'supercap'] },
    format: { def: 'prismatic', options: ['prismatic', 'cylindrical', 'coin'] },
    cap: { def: 2, stock: CAPS }
  },
  slots: [],
  functions: { provides: ['store-power'], needs: [], rates: { quanta: 'cap 1–8' } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.2 },
  pushedDraw: ['+1: fast-drain tap — second terminal pair demanded', '+2: vent score doubled, strap COUNTED around body (swell hold-down)'],
  graftsInto: ['STORE/magazine payload bay (reducer bushing)', 'any PWR seat (pigtail)'],
  variants: [
    { label: 'CHEM · PRISMATIC · 2', p: {} },
    { label: 'BIO · CYLINDRICAL · 4', p: { chem: 'bio', format: 'cylindrical', cap: 4 } },
    { label: 'SUPERCAP · COIN · 1', p: { chem: 'supercap', format: 'coin', cap: 1 } }
  ]
};
const norm = p => ({ chem: p?.chem ?? 'chem', format: p?.format ?? 'prismatic', cap: QUANT.snap(p?.cap ?? 2, CAPS) });

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2, heavy = view.lod === 'thumb';
  const dim = DIMS[q.format][q.cap];
  let out = '', Wm, Hm, k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  if (q.format === 'prismatic') {
    Wm = dim[0]; Hm = dim[1];
    k = view.k ?? fitK(Wm, Hm + 5, view.fit ?? 130);
    out += RC(0, 3 * k, Wm * k, Hm * k, swB, '#fff');
    // terminals: FIXED 3×3 tabs, + keyed corner
    out += RC(2 * k, 0.6 * k, 3 * k, 2.4 * k, swM, '#fff') + RC(Wm * k - 5 * k, 0.6 * k, 3 * k, 2.4 * k, swM, '#fff');
    if (!heavy) out += TX(3.5 * k, 2.4 * k, '+', 3.2 * k);
    if (q.chem === 'chem') out += L(3 * k, (3 + Hm * 0.22) * k, (Wm - 3) * k, (3 + Hm * 0.22) * k, swM, '4 3'); // vent score
    if (q.chem === 'bio') { // pouch: membrane window, POT band
      out += RC(3 * k, (3 + Hm * 0.3) * k, (Wm - 6) * k, Hm * 0.4 * k, swM, 'url(#pot)');
      out += C(Wm / 2 * k, (3 + Hm * 0.82) * k, 1.5 * k, swM, '#fff'); // nutrient port
    }
    if (q.chem === 'supercap') for (const yy of [0.35, 0.5, 0.65]) out += L(3 * k, (3 + Hm * yy) * k, (Wm - 3) * k, (3 + Hm * yy) * k, yy === 0.5 ? swB : swM);
    Hm += 3;
  } else if (q.format === 'cylindrical') {
    Wm = dim[1]; Hm = dim[0];                                 // side elevation
    k = view.k ?? fitK(Wm + 4, Hm, view.fit ?? 150);
    out += RC(0, 0, Wm * k, Hm * k, swB, '#fff');
    // crimp rings near + terminal button (FIXED)
    for (const dx of [2.5, 4.5]) out += L((Wm - dx) * k, 0.5 * k, (Wm - dx) * k, (Hm - 0.5) * k, swM);
    out += RC(Wm * k, Hm * 0.3 * k, 1.8 * k, Hm * 0.4 * k, swM, '#fff');
    // wrap seam
    out += L(3 * k, Hm * 0.5 * k, (Wm - 7) * k, Hm * 0.5 * k, 0.6, DASH.hl);
    if (q.chem === 'bio') out += RC(3 * k, Hm * 0.22 * k, (Wm - 12) * k, Hm * 0.56 * k, 0, 'url(#pot)');
    if (q.chem === 'supercap') for (const dx of [6, 8]) out += L(dx * k, 0.5 * k, dx * k, (Hm - 0.5) * k, swM);
    if (q.chem === 'chem' && !heavy) out += C(2.5 * k, Hm * 0.5 * k, 0.9 * k, swM); // vent plug at base
  } else {                                                    // coin, plan view
    Wm = Hm = dim[0];
    k = view.k ?? fitK(Wm, Hm, view.fit ?? 110);
    const r = Wm / 2 * k, c = r;
    out += C(c, c, r, swB, '#fff') + C(c, c, r - 1.2 * k, swM);
    out += L(c - r * 0.3, c, c + r * 0.3, c, swM) + L(c, c - r * 0.3, c, c + r * 0.3, swM); // + on can
    if (q.chem === 'bio') out += C(c, c, r * 0.45, 0, 'url(#pot)');
    if (q.chem === 'supercap') out += C(c, c, r * 0.45, swM);
    if (q.chem === 'chem') { /* gasket ring already = identity */ }
  }
  if (dens >= 3 && !heavy) out += TX(Wm / 2 * k, Hm * k + 12, `${q.chem.toUpperCase()} · ${q.cap}Q`, 9);
  return frame(Wm * k + (q.format === 'cylindrical' ? 2 * k : 0), Hm * k + (dens >= 3 && !heavy ? 16 : 0), out);
}
export function thumb(p) { return draw({ ...norm(p ?? {}) }, { lod: 'thumb', density: 1, fit: 54 }); }
export function binGlyph() { return thumb({ format: 'cylindrical', cap: 2 }); }

// loom termination: the drawn terminal, not the centre
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8, dim = DIMS[q.format][q.cap];
  if (q.format === 'prismatic') return { x: 3.5 * k, y: 1.8 * k };
  if (q.format === 'cylindrical') return { x: dim[1] * k + 0.9 * k, y: dim[0] * 0.5 * k };
  return { x: dim[0] / 2 * k, y: dim[0] / 2 * k };
}
