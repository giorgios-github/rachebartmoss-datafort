// parts/graft/jury-rig-bracket.js — bent strip, slotted holes everywhere: adjustment
// range IS the admission that nothing lines up.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT } from '../lib.js';

export const meta = {
  id: 'jury-rig-bracket', bin: 'GRAFT', label: 'JURY-RIG BRACKET',
  params: { len: { def: 24, stock: [18, 24, 32] }, bend: { def: 90, options: [0, 45, 90] } },
  slots: [],
  functions: { provides: ['mount (approximately)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['unpushable — it is already the last resort'],
  graftsInto: ['anything with one screw and hope'],
  variants: [
    { label: 'L24 · 90°', p: {} },
    { label: 'L32 · 45°', p: { len: 32, bend: 45 } },
    { label: 'L18 · FLAT', p: { len: 18, bend: 0 } }
  ]
};
const norm = p => ({ len: QUANT.snap(p?.len ?? 24, [18, 24, 32]), bend: [0, 45, 90].includes(p?.bend) ? p.bend : 90 });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.len + 10, q.len * 0.7 + 10, view.fit ?? 140);
  const bw = 6 * k, l1 = q.len * 0.55 * k, l2 = q.len * 0.45 * k;
  const x0 = 3 * k, y0 = 3 * k;
  let out = '';
  const slot = (cx, cy, ang) => {
    const dx = Math.cos(ang) * 2 * k, dy = Math.sin(ang) * 2 * k;
    return `<path d="M${(cx - dx).toFixed(1)},${(cy - dy).toFixed(1)} L${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)}" stroke="#111" stroke-width="${heavy ? 3.4 : 2.6 * k * 0.55}" stroke-linecap="round" fill="none"/>` +
      `<path d="M${(cx - dx).toFixed(1)},${(cy - dy).toFixed(1)} L${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)}" stroke="#fff" stroke-width="${heavy ? 1.8 : 2.6 * k * 0.55 - 1.6}" stroke-linecap="round" fill="none"/>`;
  };
  // leg 1 horizontal
  out += RC(x0, y0, l1, bw, heavy ? W.cut : W.vis, '#fff');
  out += slot(x0 + l1 * 0.28, y0 + bw / 2, 0) + slot(x0 + l1 * 0.68, y0 + bw / 2, 0);
  if (q.bend === 0) {
    out += RC(x0 + l1, y0, l2, bw, heavy ? W.cut : W.vis, '#fff');
    out += slot(x0 + l1 + l2 * 0.5, y0 + bw / 2, 0);
  } else {
    const a = q.bend * Math.PI / 180;
    const bx = x0 + l1, by = y0 + (q.bend === 90 ? bw : bw);
    // fold line HL + bent leg (drawn in plan as foreshortened flap)
    out += L(bx, y0, bx, y0 + bw, heavy ? W.vis : 0.8, DASH.hl);
    const fl = l2 * Math.cos(a * 0.5);
    out += POLY([[bx, y0], [bx + fl, y0 + bw * 0.12], [bx + fl, y0 + bw * 0.88], [bx, y0 + bw]], heavy ? W.cut : W.vis, true, '#fff');
    out += slot(bx + fl * 0.55, y0 + bw / 2, a === Math.PI / 2 ? Math.PI / 2 : Math.PI / 4);
  }
  if (dens >= 3 && !heavy) out += TX(x0 + (l1 + l2) / 2, y0 + bw + 14, `BEND ${q.bend}° · SLOTTED`, 7.5);
  return frame(x0 + l1 + l2 + 3 * k, y0 + bw + (dens >= 3 && !heavy ? 18 : 3 * k), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 50 }); }
export function binGlyph() { return thumb({}); }
