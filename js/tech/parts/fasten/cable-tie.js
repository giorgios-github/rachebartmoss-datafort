// parts/fasten/cable-tie.js — band + ratchet head, teeth COUNTED, cut-flush witness.
import { L, C, RC, TX, POLY, frame, fitK, W, QUANT } from '../lib.js';
const LENGTHS = [30, 50, 80];                                 // QUANTISED mm

export const meta = {
  id: 'cable-tie', bin: 'FASTEN', label: 'CABLE TIE',
  params: { len: { def: 50, stock: LENGTHS } },
  slots: [],
  functions: { provides: ['fasten'], needs: [], rates: { oneWay: true } },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable — one-way by design; removal is destruction (cut-flush witness drawn)'],
  graftsInto: ['everything — the street fastener of record'],
  variants: [
    { label: 'L50', p: {} },
    { label: 'L80', p: { len: 80 } },
    { label: 'L30', p: { len: 30 } }
  ]
};
const norm = p => ({ len: QUANT.snap(p?.len ?? 50, LENGTHS) });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.len + 12, 14, view.fit ?? 170);
  const y0 = 4 * k, bw = 2.2 * k;                              // band width FIXED
  const x0 = 3 * k, bl = q.len * k;
  // head: ratchet block
  let out = RC(x0, y0, 4 * k, 4.6 * k, heavy ? W.cut : W.vis, '#fff');
  out += RC(x0 + 1.1 * k, y0 - 0.8 * k, 1.8 * k, 0.8 * k, heavy ? W.vis : W.mid, '#fff'); // pawl window
  // band with teeth COUNTED @ FIXED pitch 1.6
  out += RC(x0 + 4 * k, y0 + 1.2 * k, bl, bw, heavy ? W.cut : W.vis, '#fff');
  if (!heavy) {
    const n = Math.floor(q.len / 1.6);
    for (let i = 1; i < n; i++) out += L(x0 + 4 * k + i * 1.6 * k, y0 + 1.2 * k, x0 + 4 * k + i * 1.6 * k, y0 + 1.2 * k + bw * 0.45, 0.5);
  }
  // tail taper + cut-flush witness at head
  out += POLY([[x0 + 4 * k + bl, y0 + 1.2 * k], [x0 + 4 * k + bl + 2.4 * k, y0 + 1.2 * k + bw / 2], [x0 + 4 * k + bl, y0 + 1.2 * k + bw]], heavy ? W.vis : W.mid, true, '#fff');
  if (!heavy) out += L(x0 - 0.8 * k, y0 - 1.4 * k, x0 + 1 * k, y0 + 0.4 * k, 0.8); // cut-flush tick
  if (dens >= 3 && !heavy) out += TX(x0 + 4 * k + bl / 2, y0 + 6 * k + 8, `ONE-WAY · ${Math.floor(q.len / 1.6)} TEETH`, 8);
  return frame(x0 + 4 * k + bl + 4 * k, y0 + 6 * k + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 56 }); }
export function binGlyph() { return thumb({ len: 30 }); }
