// parts/graft/shim-set.js — staggered stack, thickness QUANTISED per leaf, side elevation.
import { L, C, RC, TX, frame, fitK, W, QUANT } from '../lib.js';
const LEAVES = [0.5, 1, 2];                                   // QUANTISED thickness mm

export const meta = {
  id: 'shim-set', bin: 'GRAFT', label: 'SHIM SET',
  params: { w: { def: 16, stock: [12, 16, 22] } },
  slots: [],
  functions: { provides: ['fit (take up slack, tilt, offset)'], needs: [], rates: { leaves: '0.5 / 1 / 2' } },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['unpushable — but a shim stack taller than its screw engagement is drawn NON-CONFORMANT'],
  graftsInto: ['under anything that almost fits'],
  variants: [
    { label: 'W16 · 3 LEAVES', p: {} },
    { label: 'W22', p: { w: 22 } },
    { label: 'W12', p: { w: 12 } }
  ]
};
const norm = p => ({ w: QUANT.snap(p?.w ?? 16, [12, 16, 22]) });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.w + 10, 12, view.fit ?? 130);
  const wpx = q.w * k, x0 = 3 * k;
  let out = '', y = 3 * k;
  // three leaves, staggered so each thickness reads; slot notch on each
  LEAVES.slice().reverse().forEach((t, i) => {
    const th = Math.max(t * k, heavy ? 3 : 2), ox = i * 2.2 * k;
    out += RC(x0 + ox, y, wpx - i * 1.4 * k, th, heavy ? W.vis : W.mid, '#fff');
    // U-slot notch (slide-in without full disassembly — the shim law)
    out += RC(x0 + ox + (wpx - i * 1.4 * k) * 0.4, y - 0.001, (wpx - i * 1.4 * k) * 0.2, th, heavy ? W.vis : W.mid, '#fff');
    if (!heavy && dens >= 3) out += TX(x0 + ox - 1.4 * k, y + th / 2 + 3, String(t), 8, 'end');
    y += th + 1.2 * k;
  });
  if (dens >= 3 && !heavy) out += TX(x0 + wpx / 2, y + 8, 'U-SLOT · SLIDE-IN', 7.5);
  return frame(x0 + wpx + 4 * k, y + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 44 }); }
export function binGlyph() { return thumb({}); }
