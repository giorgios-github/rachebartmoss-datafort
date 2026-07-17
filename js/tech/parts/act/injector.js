// parts/act/injector.js — a THROUGH-WALL module, not a syringe: threaded collar in a
// wall bore; needle side out, reservoir + activation signal pin inside. Clean transition.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT, keyPin, flangeV } from '../lib.js';
const DOSES = [1, 2, 5];                                      // QUANTISED ml

export const meta = {
  id: 'injector', bin: 'ACT', label: 'INJECTOR',
  params: { dose: { def: 2, stock: DOSES }, autoret: { def: true }, mounted: { def: false, note: "'exterior' = needle side only, no signal" } },
  slots: [{ id: 'res0', accepts: 'STORE/vessel capsule (via bay luer)', keying: 'luer taper', param: null }],
  functions: { provides: ['inject'], needs: ['control (activation signal)', 'matter (reservoir)'], rates: { ml: 2 } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.3 },
  pushedDraw: ['+1: overdose stop drilled — graduation scale extended PH, stencil struck'],
  graftsInto: ['any wall bore Ø one size off (reducer bushing)'],
  variants: [
    { label: '2 ML · AUTO-RET', p: {} },
    { label: '5 ML', p: { dose: 5 } },
    { label: '1 ML', p: { dose: 1, autoret: false } },
    { label: 'EXT SEUL — AIGUILLE', p: { mounted: 'exterior' } }
  ]
};
const norm = p => ({ dose: QUANT.snap(p?.dose ?? 2, DOSES), autoret: p?.autoret !== false, mounted: p?.mounted === 'exterior' ? 'exterior' : false });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted === 'exterior') {
    // EXT SEUL: taper + needle + CL, exactly the emerged part
    const k = view.k ?? fitK(16, 8, view.fit ?? 90);
    const ry = 4 * k, nx = 3 * k;
    let out = POLY([[nx, ry - 1 * k], [nx + 1.8 * k, ry - 0.5 * k], [nx + 1.8 * k, ry + 0.5 * k], [nx, ry + 1 * k]], W.mid, true, '#fff');
    out += L(nx + 1.8 * k, ry, nx + 7 * k, ry, W.vis);
    out += L(nx + 1 * k, ry, nx + 10 * k, ry, 0.5, DASH.cl);
    if (dens >= 3) out += TX(nx + 5 * k, ry + 3 * k + 8, 'EXT SEUL', 8);
    return frame(nx + 11 * k, ry + 3 * k + (dens >= 3 ? 10 : 0), out);
  }
  const bodyL = 12 + q.dose * 5, D = 7 + q.dose;              // inner body from dose
  const k = view.k ?? fitK(bodyL + 22, D + 10, view.fit ?? 160);
  const hpx = D * k, y0 = 5 * k, ry = y0 + hpx / 2;
  const wallX = (4 + bodyL) * k, wallT = 2.5 * k;             // wall plane
  const x0 = 4 * k, bl = bodyL * k;
  let out = '';
  // WALL-CROSSING SIGNAL: emitter-grammar flange (plate + 2 screws)
  out += flangeV(wallX, ry, hpx / 2 + 0.6 * k, k, heavy);
  // INSIDE (left of wall): body
  out += RC(x0, y0, bl, hpx, heavy ? W.cut : W.vis, '#fff');
  // reservoir window + graduations COUNTED
  const rwX = x0 + 1.5 * k, rwW = bl * 0.45;
  out += RC(rwX, y0 + 1.2 * k, rwW, hpx - 2.4 * k, heavy ? W.vis : W.mid, '#fff');
  if (!heavy) for (let i = 1; i < q.dose * 2; i++) out += L(rwX + rwW * i / (q.dose * 2), y0 + 1.2 * k, rwX + rwW * i / (q.dose * 2), y0 + 1.2 * k + hpx * 0.2, 0.7);
  // piston face + return spring witness
  out += L(x0 + bl * 0.62, y0 + 0.8 * k, x0 + bl * 0.62, y0 + hpx - 0.8 * k, heavy ? W.vis : W.mid);
  if (q.autoret && !heavy) out += L(x0 + bl * 0.66, ry, x0 + bl * 0.97, ry, 0.7); // return rod
  // activation signal: keyed pin on top of the body
  out += L(x0 + bl * 0.3, y0, x0 + bl * 0.3, y0 - 2 * k, heavy ? W.vis : W.mid);
  out += keyPin(x0 + bl * 0.3, y0 - 3.6 * k, heavy ? 4.5 * k : 3.6 * k);
  // OUTSIDE (right): needle + CL
  const nx = wallX + 1.8 * k;                              // tip starts AT the flange — no gap
  out += POLY([[nx, ry - 1 * k], [nx + 1.8 * k, ry - 0.5 * k], [nx + 1.8 * k, ry + 0.5 * k], [nx, ry + 1 * k]], heavy ? W.vis : W.mid, true, '#fff');
  out += L(nx + 1.8 * k, ry, nx + (heavy ? 5 : 7) * k, ry, heavy ? W.cut : W.vis);          // needle
  out += L(nx + 1 * k, ry, nx + (heavy ? 7 : 10) * k, ry, 0.5, DASH.cl);
  if (dens >= 3 && !heavy) {
    out += TX(x0 + bl / 2, y0 + hpx + 5.4 * k + 8, `${q.dose} ML · IN`, 8);
    out += TX(nx + 4 * k, y0 + hpx + 5.4 * k + 8, 'OUT', 8);
  }
  return frame(nx + 14 * k, y0 + hpx + 5 * k + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 56 }); }
export function binGlyph() { return thumb({}); }

// ── mounting contract (trans-paroi: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.mounted === 'exterior' || view.exterior) return { x: 3 * k, y: 4 * k, axis: 'x' };
  const bodyL = 12 + q.dose * 5, D = 7 + q.dose;
  return { x: (4 + bodyL) * k, y: 5 * k + D * k / 2, axis: 'x' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const bodyL = 12 + q.dose * 5;
  return { x: 4 * k + bodyL * k * 0.3, y: 5 * k - 3.6 * k };
}
