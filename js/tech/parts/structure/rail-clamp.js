// parts/structure/rail-clamp.js — weapon-adjacent interface, cross-section, CLEAN:
// boss pattern / clamp body / claws / host rail (PH, never solid), each in its own band.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT, screwMini } from '../lib.js';
const WIDTHS = [14, 21];                                      // QUANTISED rail width

export const meta = {
  id: 'rail-clamp', bin: 'STRUCTURE', label: 'RAIL CLAMP',
  params: { w: { def: 21, stock: WIDTHS }, qd: { def: false } },
  slots: [{ id: 'top0', accepts: 'ANY module with FIXED boss pattern (optic, laser-link, led-array…)', keying: '2-bolt boss pattern', param: null }],
  functions: { provides: ['mount'], needs: [], rates: { pattern: '2-bolt FIXED' } },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable: structure — overtorque is drawn as a crushed rail PH, never sanctioned'],
  graftsInto: ['it IS the graft path: clamp + module = optic module / gun-cam / designator, host never drawn'],
  variants: [
    { label: 'W21 · CROSS-BOLT', p: {} },
    { label: 'W14', p: { w: 14 } },
    { label: 'W21 · QD LEVER', p: { qd: true } }
  ]
};
const norm = p => ({ w: QUANT.snap(p?.w ?? 21, WIDTHS), qd: !!p?.qd });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
    const k = view.k ?? fitK(q.w + 20, 26, view.fit ?? 150);
  const rw = q.w * k, cx = rw / 2 + 10 * k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  // vertical bands (top → bottom): bosses / body / jaw gap / rail phantom
  const bodyT = 6 * k, bodyB = 12.5 * k, railT = 14 * k, railH = 2.6 * k;
  const bhw = rw / 2 + 2.5 * k;                               // body half-width
  let out = '';
  // 1 · boss pattern (the slot): two bosses standing proud of the body top
  for (const s of [-1, 1]) {
    out += RC(cx + s * 4 * k - 1.3 * k, bodyT - 2.4 * k, 2.6 * k, 2.4 * k, swM, '#fff');
    out += C(cx + s * 4 * k, bodyT - 1.2 * k, 0.5 * k, heavy ? 1.2 : 0.7);
  }
  // 2 · clamp body
  out += RC(cx - bhw, bodyT, 2 * bhw, bodyB - bodyT, swB, '#fff');
  // cross bolt axis + head, or QD lever — outside the body, clear of everything
  if (q.qd) {
    out += C(cx + bhw + 1.4 * k, (bodyT + bodyB) / 2, 1.1 * k, swM, '#fff');                       // cam pivot
    out += L(cx + bhw + 1.4 * k, (bodyT + bodyB) / 2, cx + bhw + 5.5 * k, bodyT - 1 * k, swB);     // lever up = locked
  } else if (!heavy) {
    out += L(cx - bhw - 2.6 * k, (bodyT + bodyB) / 2, cx + bhw + 2.6 * k, (bodyT + bodyB) / 2, 0.7, DASH.cl); // bolt axis
    out += screwMini(cx + bhw + 1.6 * k, (bodyT + bodyB) / 2, 1 * k, 'hex');
  }
  // 3 · claws: from the body's bottom corners, down and hooking inward — clear gap to the rail
  for (const s of [-1, 1]) {
    out += POLY([
      [cx + s * bhw, bodyB], [cx + s * bhw, railT + 1.9 * k], [cx + s * (rw / 2 - 1.4 * k), railT + 1.9 * k], [cx + s * (rw / 2 - 1.4 * k), railT + 1.1 * k]
    ], swB, false);
  }
  // 4 · host rail: PH dovetail, its own band, never solid
  const dv = 2.4 * k;
  out += `<path d="M${(cx - rw / 2).toFixed(1)},${(railT + railH).toFixed(1)} H${(cx + rw / 2).toFixed(1)} V${(railT + 0.8 * k).toFixed(1)} L${(cx + rw / 2 - dv).toFixed(1)},${railT.toFixed(1)} H${(cx - rw / 2 + dv).toFixed(1)} L${(cx - rw / 2).toFixed(1)},${(railT + 0.8 * k).toFixed(1)} Z" fill="none" stroke="#111" stroke-width="0.8" stroke-dasharray="${DASH.ph}"/>`;
  if (dens >= 3 && !heavy) {
    out += TX(cx, bodyT - 3.6 * k, '2-BOLT BOSS · ANY MODULE', 7.5);
    out += TX(cx, railT + railH + 3 * k + 4, 'HOST RAIL · PH', 7.5);
  }
  return frame(2 * cx + (q.qd ? 2 * k : 0), railT + railH + (dens >= 3 && !heavy ? 4.4 * k : 1.5 * k), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 52 }); }
export function binGlyph() { return thumb({}); }
