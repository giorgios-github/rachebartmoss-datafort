// parts/overdrive/coolant-loop.js — pump + reservoir + tube circuit. The circuit
// follows a CUSTOM closed path (mm waypoints) — it conforms to the build, not the reverse.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, G, QUANT } from '../lib.js';

export const meta = {
  id: 'coolant-loop', bin: 'OVERDRIVE', label: 'COOLANT LOOP',
  params: {
    span: { def: 40, stock: [28, 40, 56] },
    path: { def: null, note: 'closed polygon [[mm,mm],…] — custom tracé; null = rectangle from span' }
  },
  slots: [],
  functions: { provides: ['cool (circulated)'], needs: ['power'], rates: {} },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.2 },
  pushedDraw: ['+1: pump overvolt — second reservoir bulb demanded (expansion), stencil struck'],
  graftsInto: ['wraps any part wearing a graft-heatsink (tube clips at loom pitch)'],
  variants: [
    { label: 'SPAN 40 · RECT', p: {} },
    { label: 'TRACÉ CUSTOM · L-SHAPE', p: { path: [[0, 0], [44, 0], [44, 14], [20, 14], [20, 30], [0, 30]] } },
    { label: 'TRACÉ CUSTOM · CHICANE', p: { path: [[0, 0], [50, 0], [50, 10], [12, 10], [12, 20], [50, 20], [50, 30], [0, 30]] } }
  ]
};
const norm = p => ({ span: QUANT.snap(p?.span ?? 40, [28, 40, 56]), path: Array.isArray(p?.path) && p.path.length >= 3 ? p.path : null });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  // waypoints in mm (closed): custom path or rectangle from span
  const ptsMm = q.path ?? [[0, 0], [q.span, 0], [q.span, q.span * 0.5], [0, q.span * 0.5]];
  const bb = G.bbox(ptsMm);
  const k = view.k ?? fitK(bb.w + 16, bb.h + 14, view.fit ?? 150);
  const x0 = 5 * k, y0 = 4 * k;
  const pts = ptsMm.map(([x, y]) => [x0 + (x - bb.x) * k, y0 + (y - bb.y) * k]);
  // tube: two concentric offsets of the closed path (miter offset — the loom of fluids)
  let out = POLY(G.offsetInward(pts, -0.7 * k), heavy ? W.vis : W.mid, true);
  out += POLY(G.offsetInward(pts, 0.7 * k), heavy ? W.vis : W.mid, true);
  // pump: disc at the first vertex
  const [pcx, pcy] = pts[0];
  out += C(pcx, pcy, 2.8 * k, heavy ? W.cut : W.vis, '#fff');
  out += C(pcx, pcy, 0.9 * k, heavy ? W.vis : W.mid, '#fff');
  if (!heavy) out += `<path d="M${(pcx - 0.8 * k).toFixed(1)},${(pcy - 1.6 * k).toFixed(1)} L${(pcx + 1.3 * k).toFixed(1)},${(pcy - 0.5 * k).toFixed(1)} L${(pcx - 0.8 * k).toFixed(1)},${(pcy + 0.6 * k).toFixed(1)}" fill="#111" stroke="none"/>`;
  // reservoir bulb: midpoint of the longest run
  let bi = 0, bl = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > bl) { bl = l; bi = i; }
  }
  const ra = pts[bi], rb = pts[(bi + 1) % pts.length];
  const rcx = (ra[0] + rb[0]) / 2, rcy = (ra[1] + rb[1]) / 2;
  out += C(rcx, rcy, 2.4 * k, heavy ? W.cut : W.vis, '#fff');
  if (!heavy) out += L(rcx - 1.6 * k, rcy - 0.6 * k, rcx + 1.6 * k, rcy - 0.6 * k, 0.7, DASH.cl); // fill line
  if (dens >= 3 && !heavy) out += TX(x0 + bb.w * k / 2, y0 + bb.h * k + 4 * k + 8, q.path ? 'TRACÉ CUSTOM' : 'CLOSED LOOP', 8);
  return frame(x0 + bb.w * k + 4 * k, y0 + bb.h * k + 4 * k + (dens >= 3 && !heavy ? 10 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 54 }); }
export function binGlyph() { return thumb({}); }
