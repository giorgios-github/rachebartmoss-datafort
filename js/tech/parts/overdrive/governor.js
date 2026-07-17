// parts/overdrive/governor.js — the limiter. Its EMPTY SEAT is a first-class drawing:
// removal must be legible (sheared stubs, vacant bracket bores, dashed body ghost).
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, screwMini, pad } from '../lib.js';

export const meta = {
  id: 'governor', bin: 'OVERDRIVE', label: 'GOVERNOR / LIMITER',
  params: { state: { def: 'seated', options: ['seated', 'empty-seat'] } },
  slots: [],
  functions: { provides: ['limit (clamps host envelope to rated)'], needs: ['power'], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['a governor is not pushed — it is REMOVED. The empty seat IS the push drawing of the host.'],
  graftsInto: ['nothing — its absence is the graft'],
  variants: [
    { label: 'SEATED', p: {} },
    { label: 'EMPTY SEAT — REMOVAL LEGIBLE', p: { state: 'empty-seat' } },
    { label: 'SEATED (REAR VIEW = SAME LAW)', p: {} }
  ]
};
const norm = p => ({ state: p?.state === 'empty-seat' ? 'empty-seat' : 'seated' });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const Wm = 16, Hm = 10;
  const k = view.k ?? fitK(Wm + 8, Hm + 8, view.fit ?? 130);
  const wpx = Wm * k, hpx = Hm * k, x0 = 3 * k, y0 = 3 * k;
  let out = '';
  // bracket bores + solder pads: ALWAYS drawn (the seat outlives the part)
  for (const sx of [0.12, 0.88]) out += C(x0 + wpx * sx, y0 + hpx + 2 * k, 0.9 * k, heavy ? W.vis : W.fine);
  for (const sx of [0.3, 0.5, 0.7]) out += pad(x0 + wpx * sx, y0 + hpx + 2 * k, 1 * k);
  if (q.state === 'seated') {
    out += RC(x0, y0, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
    out += RC(x0 + 2 * k, y0 + 2 * k, wpx - 4 * k, hpx - 4 * k, heavy ? W.vis : W.mid);       // sealed lid
    if (!heavy) {
      out += L(x0 + 2 * k, y0 + 2 * k, x0 + wpx - 2 * k, y0 + hpx - 2 * k, 0.6);              // tamper seal diagonal
      for (const sx of [0.3, 0.5, 0.7]) out += L(x0 + wpx * sx, y0 + hpx, x0 + wpx * sx, y0 + hpx + 2 * k, W.mid); // legs to pads
      for (const sx of [0.12, 0.88]) out += screwMini(x0 + wpx * sx, y0 + hpx + 2 * k, 0.85 * k, 'tri');           // one-way screws
      if (dens >= 3) out += TX(x0 + wpx / 2, y0 + hpx / 2 + 3, 'GOV', 2.6 * k, 'middle', true);
    }
  } else {
    // ghost body PH + sheared stubs: the removal reads
    out += RC(x0, y0, wpx, hpx, 0.8, 'none', DASH.ph);
    if (!heavy) {
      for (const sx of [0.3, 0.5, 0.7]) {
        out += L(x0 + wpx * sx, y0 + hpx + 2 * k, x0 + wpx * sx, y0 + hpx + 0.8 * k, W.mid);  // stub
        out += L(x0 + wpx * sx - 0.7 * k, y0 + hpx + 0.6 * k, x0 + wpx * sx + 0.7 * k, y0 + hpx + 1 * k, W.mid); // shear tick
      }
      if (dens >= 3) out += TX(x0 + wpx / 2, y0 + hpx / 2 + 3, 'GOV REMOVED — SEAT REMAINS', 8);
    }
  }
  return frame(wpx + 6 * k, hpx + 6 * k + 2 * k, out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 48 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the middle seat pad ──
export function wirePad(p, view = {}) {
  const k = view.k ?? 8;
  return { x: 3 * k + 16 * k * 0.5, y: 3 * k + 10 * k + 2 * k };
}
