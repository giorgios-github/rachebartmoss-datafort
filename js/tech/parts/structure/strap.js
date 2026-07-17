// parts/structure/strap.js — soft part: POT elastomer band, buckle, holes COUNTED.
import { L, C, RC, TX, frame, fitK, W, QUANT } from '../lib.js';
const LENGTHS = [40, 60, 90];                                 // QUANTISED mm

export const meta = {
  id: 'strap', bin: 'STRUCTURE', label: 'STRAP',
  params: { len: { def: 60, stock: LENGTHS }, w: { def: 8 } },
  slots: [],
  functions: { provides: ['mount', 'hold-down'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable — but the strap IS the drawable of everyone else’s push: pushed parts demand straps COUNTED'],
  graftsInto: ['everything — the universal jury-rig retainer'],
  variants: [
    { label: 'L60 × 8', p: {} },
    { label: 'L90 × 8', p: { len: 90 } },
    { label: 'L40 × 8', p: { len: 40 } }
  ]
};
const norm = p => ({ len: QUANT.snap(p?.len ?? 60, LENGTHS), w: 8 });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.len + 8, q.w + 6, view.fit ?? 170);
  const wpx = q.len * k, hpx = q.w * k, y0 = 2 * k;
  // band: soft-part law — POT hatch, rounded ends, NO fasteners
  let out = RC(0, y0, wpx, hpx, heavy ? W.cut : W.vis, heavy ? '#fff' : 'url(#pot)', null, hpx / 2);
  // adjustment holes COUNTED @ FIXED pitch 6
  const n = Math.floor((q.len * 0.45) / 6);
  for (let i = 0; i < n; i++) out += C(wpx - (4 + i * 6) * k, y0 + hpx / 2, 0.9 * k, heavy ? W.vis : W.mid, '#fff');
  // buckle at left: frame + centre bar + tongue
  out += RC(-1.5 * k, y0 - 1.2 * k, 5 * k, hpx + 2.4 * k, heavy ? W.cut : W.vis, '#fff');
  out += L(1 * k, y0 - 1.2 * k, 1 * k, y0 + hpx + 1.2 * k, heavy ? W.vis : W.mid);
  out += L(1 * k, y0 + hpx / 2, 5.5 * k, y0 + hpx / 2, heavy ? W.vis : W.mid); // tongue
  if (dens >= 3 && !heavy) out += TX(wpx / 2, y0 + hpx + 14, `SOFT PART · NO FASTENERS · ${n} HOLES`, 8);
  return frame(wpx + 4 * k, y0 + hpx + (dens >= 3 && !heavy ? 18 : 3 * k), `<g transform="translate(${(2 * k).toFixed(1)},0)">${out}</g>`);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 56 }); }
export function binGlyph() { return thumb({ len: 40 }); }
