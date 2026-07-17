// parts/sense/optic.js — lens barrel: aperture QUANTISED, iris blades COUNTED.
import { L, C, RC, TX, frame, fitK, W, G, QUANT, screwMini } from '../lib.js';
const APERTURES = [4, 8, 12];                                 // QUANTISED clear mm

export const meta = {
  id: 'optic', bin: 'SENSE', label: 'OPTIC',
  params: { aperture: { def: 8, stock: APERTURES }, irised: { def: true }, grade: { def: 'street', options: ['street', 'corpo', 'corpo-micro'] } },
  slots: [],
  functions: { provides: ['sense-optic'], needs: ['power', 'control'], rates: { aperture: 8 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.1 },
  pushedDraw: ['+1: gain push — iris pinned open (blades drawn retracted)', '+2: sensor overvolt — heatsink tab at rear, stencil struck'],
  graftsInto: ['weapon-rail optic module housing (rail clamp + shim set)'],
  variants: [
    { label: 'Ø8 · IRISED · STREET', p: {} },
    { label: 'Ø12 · STREET', p: { aperture: 12 } },
    { label: 'Ø4 · FIXED PUPIL', p: { aperture: 4, irised: false } },
    { label: 'CORPO Ø8 — SANS VIS, ARRONDI', p: { grade: 'corpo' } },
    { label: 'CORPO MICRO Ø4', p: { grade: 'corpo-micro', aperture: 4 } }
  ]
};
const norm = p => ({ aperture: QUANT.snap(p?.aperture ?? 8, APERTURES), irised: p?.irised !== false, grade: ['corpo', 'corpo-micro'].includes(p?.grade) ? p.grade : 'street' });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const corpo = q.grade !== 'street', micro = q.grade === 'corpo-micro';
  const D = q.aperture + (micro ? 3 : corpo ? 4 : 6);          // corpo: slimmer ring
  const k = view.k ?? fitK(D + 4, D + 8, view.fit ?? (micro ? 70 : 130));
  const r = D / 2 * k, c = r + 2 * k, ra = q.aperture / 2 * k;
  let out = '';
  if (!corpo) {
    // street: square mount flange + corner screws
    out += RC(c - r - 1 * k, c - r - 1 * k, 2 * (r + 1 * k), 2 * (r + 1 * k), heavy ? W.cut : W.mid, '#fff');
    if (!heavy) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out += screwMini(c + sx * (r - 0.2 * k), c + sy * (r - 0.2 * k), 0.9 * k, 'cross');
  } else if (!micro && !heavy) {
    out += C(c, c, r + 0.9 * k, W.fine);                       // corpo: smooth trim ring, no fasteners
  }
  out += C(c, c, r, heavy ? W.cut : W.vis, '#fff');            // barrel
  out += C(c, c, ra + 1 * k, heavy ? W.vis : W.mid);           // retainer ring
  out += C(c, c, ra, heavy ? W.vis : W.mid, '#fff');           // clear aperture
  if (q.irised && !heavy) {                                    // iris blades COUNTED (6)
    for (let i = 0; i < 6; i++) {
      const a = G.TAU * i / 6, a2 = a + 1.1;
      out += L(c + ra * Math.cos(a), c + ra * Math.sin(a), c + ra * 0.35 * Math.cos(a2), c + ra * 0.35 * Math.sin(a2), 0.7);
    }
    out += C(c, c, ra * 0.35, 0.7);
  } else if (!heavy) out += L(c - ra * 0.5, c + ra * 0.5, c + ra * 0.5, c - ra * 0.5, 0.6); // glass tick
  if (heavy) out += C(c, c, ra * 0.4, 0, '#111');              // pupil reads at 36px
  // flex tail
  if (!heavy && !micro) { out += RC(c - 1.6 * k, c + r + 1 * k, 3.2 * k, 3 * k, W.mid, '#fff', null, corpo ? 1 * k : 0); if (dens >= 3) out += TX(c, c + r + 7 * k, corpo ? `CORPO · Ø${q.aperture}` : `CLEAR Ø${q.aperture}`, 8); }
  if (!heavy && micro && dens >= 3) out += TX(c, 2 * c + 10, 'MICRO', 8);
  return frame(2 * c, 2 * c + (heavy ? 0 : 4.5 * k) + (dens >= 3 && !heavy ? 4 * k : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({}); }

// loom termination: the flex tail (centre for micro)
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const micro = q.grade === 'corpo-micro';
  const D = q.aperture + (micro ? 3 : q.grade === 'corpo' ? 4 : 6);
  const r = D / 2 * k, c = r + 2 * k;
  return micro ? { x: c, y: c } : { x: c, y: c + r + 2.5 * k };
}
