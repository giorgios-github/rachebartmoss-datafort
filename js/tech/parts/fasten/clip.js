// parts/fasten/clip.js — spring clip: C-profile, barb, seat groove witness.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT } from '../lib.js';
const SIZES = [4, 6, 10];                                     // QUANTISED grip Ø

export const meta = {
  id: 'clip', bin: 'FASTEN', label: 'CLIP',
  params: { grip: { def: 6, stock: SIZES } },
  slots: [],
  functions: { provides: ['fasten'], needs: [], rates: { grip: 6 } },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable — a sprung clip past its envelope is two clips'],
  graftsInto: ['everything at loom clip pitch'],
  variants: [
    { label: 'GRIP Ø6', p: {} },
    { label: 'GRIP Ø10', p: { grip: 10 } },
    { label: 'GRIP Ø4', p: { grip: 4 } }
  ]
};
const norm = p => ({ grip: QUANT.snap(p?.grip ?? 6, SIZES) });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
    const k = view.k ?? fitK(q.grip + 8, q.grip + 10, view.fit ?? 90);
  const r = q.grip / 2 * k, c = r + 4 * k;
  // C-profile: open at top, gap FIXED fraction
  const gap = 0.6;                                             // rad half-angle
  const a0 = -Math.PI / 2 + gap, a1 = -Math.PI / 2 - gap + Math.PI * 2;
  let out = `<path d="M${(c + r * Math.cos(a0)).toFixed(1)},${(c + r * Math.sin(a0)).toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 1 1 ${(c + r * Math.cos(a1)).toFixed(1)},${(c + r * Math.sin(a1)).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? W.cut : W.vis}"/>`;
  out += `<path d="M${(c + (r - 1.4 * k) * Math.cos(a0)).toFixed(1)},${(c + (r - 1.4 * k) * Math.sin(a0)).toFixed(1)} A${(r - 1.4 * k).toFixed(1)},${(r - 1.4 * k).toFixed(1)} 0 1 1 ${(c + (r - 1.4 * k) * Math.cos(a1)).toFixed(1)},${(c + (r - 1.4 * k) * Math.sin(a1)).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? W.vis : W.mid}"/>`;
  // entry flares at the gap
  for (const s of [1, -1]) {
    const a = -Math.PI / 2 + s * gap;
    out += L(c + r * Math.cos(a), c + r * Math.sin(a), c + (r + 1.8 * k) * Math.cos(a - s * 0.35), c + (r + 1.8 * k) * Math.sin(a - s * 0.35), heavy ? W.vis : W.mid);
  }
  // base stem + barb (push-in anchor)
  out += L(c, c + r, c, c + r + 3 * k, heavy ? W.cut : W.vis);
  out += POLY([[c - 1.2 * k, c + r + 3 * k], [c, c + r + 4.6 * k], [c + 1.2 * k, c + r + 3 * k]], heavy ? W.vis : W.mid, true, '#fff');
  if (dens >= 3 && !heavy) out += TX(c, c + r + 4.6 * k + 12, `GRIP Ø${q.grip} · PUSH-IN BARB`, 8);
  return frame(2 * c, c + r + 5 * k + (dens >= 3 && !heavy ? 14 : 2), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 40 }); }
export function binGlyph() { return thumb({}); }
