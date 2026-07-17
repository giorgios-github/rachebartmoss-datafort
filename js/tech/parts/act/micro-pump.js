// parts/act/micro-pump.js — peristaltic: rollers COUNTED, barbs in/out, flow arrow.
import { L, C, RC, TX, frame, fitK, W, G, QUANT, pad } from '../lib.js';
const SIZES = [14, 20];                                       // QUANTISED housing Ø

export const meta = {
  id: 'micro-pump', bin: 'ACT', label: 'MICRO-PUMP',
  params: { d: { def: 14, stock: SIZES }, rollers: { def: 3, options: [3, 4] } },
  slots: [],
  functions: { provides: ['pump'], needs: ['power', 'control'], rates: { rollers: 3 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.14 },
  pushedDraw: ['+1: overspeed — second clamp screw demanded on tube race', '+2: tube fatigue — strap COUNTED, stencil struck'],
  graftsInto: ['SENSE/chem-sniffer inlet manifold (reducer bushing)'],
  variants: [
    { label: 'Ø14 · 3 ROLLERS', p: {} },
    { label: 'Ø20 · 4 ROLLERS', p: { d: 20, rollers: 4 } },
    { label: 'Ø14 · 4 ROLLERS', p: { rollers: 4 } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 14, SIZES), rollers: p?.rollers === 4 ? 4 : 3 });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.d + 10, q.d + 8, view.fit ?? 130);
  const r = q.d / 2 * k, c = r + 4 * k;
  let out = C(c, c, r, heavy ? W.cut : W.vis, '#fff');          // housing
  out += C(c, c, r * 0.82, heavy ? W.vis : 0.7);                // tube race
  // rotor + rollers COUNTED
  out += C(c, c, r * 0.3, heavy ? W.vis : W.mid, '#fff');
  for (let i = 0; i < q.rollers; i++) {
    const a = -Math.PI / 2 + G.TAU * i / q.rollers;
    out += C(c + r * 0.55 * Math.cos(a), c + r * 0.55 * Math.sin(a), r * 0.2, heavy ? W.vis : W.mid, '#fff');
  }
  // barbs: in bottom-left, out bottom-right (3 rings each)
  for (const sx of [-1, 1]) {
    const bx = c + sx * r * 0.72, by = c + r * 0.72;
    out += L(bx, by, bx + sx * 2.6 * k, by + 2.6 * k, heavy ? W.cut : W.vis);
    if (!heavy) for (let i = 1; i <= 3; i++) out += L(bx + sx * i * 0.7 * k - 0.7 * k, by + i * 0.7 * k, bx + sx * i * 0.7 * k + 0.7 * k, by + i * 0.7 * k, 0.8);
  }
  // flow arrow on rotor
  if (!heavy) out += `<path d="M${(c - r * 0.14).toFixed(1)},${(c - r * 0.05).toFixed(1)} L${(c + r * 0.14).toFixed(1)},${c.toFixed(1)} L${(c - r * 0.14).toFixed(1)},${(c + r * 0.05 + 2).toFixed(1)}" fill="#111" stroke="none"/>`;
  if (!heavy) { out += pad(c - r - 2.4 * k, c, 1 * k); if (dens >= 3) out += TX(c, c + r + 5 * k + 8, `${q.rollers} ROLLERS · CW`, 8); }
  return frame(2 * c, c + r + (dens >= 3 && !heavy ? 6 * k + 10 : 4 * k), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the drive pad ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k, c = r + 4 * k;
  return { x: c - r - 2.4 * k, y: c };
}
