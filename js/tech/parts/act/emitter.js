// parts/act/emitter.js — sealed emitter head (side view): body rings, panel flange,
// medium-specific mouth. Generic emit-* organ (IR flood, ultrasonic, EM chaff). NOT a weapon.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT, pad, screwMini } from '../lib.js';
const SIZES = [8, 12, 18];                                    // QUANTISED body Ø

export const meta = {
  id: 'emitter', bin: 'ACT', label: 'EMITTER',
  params: { d: { def: 12, stock: SIZES }, medium: { def: 'ir', options: ['ir', 'ultrasonic', 'em'] }, mounted: { def: false, note: 'trans-boîtier: mouth only' } },
  slots: [],
  functions: { provides: ['emit-field'], needs: ['power', 'control'], rates: { medium: 'ir' } },
  envelope: { rated: 1, pushMax: 3, instabilityPerPush: 0.22 },
  pushedDraw: ['+1: driver overvolt — heatsink collar demanded', '+2: duty pushed — coolant loop demanded', '+3: past rated class — guard shroud + struck stencil'],
  graftsInto: ['LINK/laser-link gimbal seat (same barrel family, shim set)'],
  variants: [
    { label: 'Ø12 · IR', p: {} },
    { label: 'Ø18 · ULTRASONIC', p: { d: 18, medium: 'ultrasonic' } },
    { label: 'Ø8 · EM', p: { d: 8, medium: 'em' } },
    { label: 'EXT SEUL — IR', p: { mounted: 'exterior' } },
    { label: 'EXT SEUL — ULTRASONIC', p: { d: 18, medium: 'ultrasonic', mounted: 'exterior' } },
    { label: 'EXT SEUL — EM', p: { d: 8, medium: 'em', mounted: 'exterior' } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 12, SIZES), medium: ['ultrasonic', 'em'].includes(p?.medium) ? p.medium : 'ir', mounted: p?.mounted === 'exterior' ? 'exterior' : !!p?.mounted });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted === 'exterior') {
    // EXT SEUL: exact copy of the emerged part — mouth bezel + face + CL
    const bodyL = q.d * 1.6;
    const k = view.k ?? fitK(bodyL * 0.5 + 12, q.d + 6, view.fit ?? 110);
    const hpx = q.d * k, y0 = 3 * k, ry = y0 + hpx / 2, bl = bodyL * k;
    const fx = 3 * k, fw = (view.wallMm ?? 1.8) * k, mx = fx + fw, ml = bl * 0.38 - fw + 4 * k;
    // the flange plate IS on the outside of the wall — it stays in the exterior view
    let out = RC(fx, y0 - 1.8 * k, fw, hpx + 3.6 * k, W.mid, '#fff');
    out += screwMini(fx + fw / 2, y0 - 0.9 * k, 0.7 * k, 'cross') + screwMini(fx + fw / 2, y0 + hpx + 0.9 * k, 0.7 * k, 'cross');
    out += RC(mx, y0 + 0.6 * k, ml, hpx - 1.2 * k, W.vis, '#fff');
    const faceX = mx + ml;
    if (q.medium === 'ir') { out += L(faceX, y0 + 0.6 * k, faceX, y0 + hpx - 0.6 * k, W.mid); out += L(faceX - 0.8 * k, y0 + 1 * k, faceX - 0.8 * k, y0 + hpx - 1 * k, 0.6); }
    else if (q.medium === 'ultrasonic') { for (let i = 1; i <= 3; i++) out += L(faceX - i * 1.1 * k, y0 + 1.4 * k, faceX - i * 1.1 * k, y0 + hpx - 1.4 * k, 0.9); }
    else out += RC(faceX - 1 * k, y0 + 0.6 * k, 1 * k, hpx - 1.2 * k, 0, 'url(#xmesh)');
    out += L(faceX + 1 * k, ry, faceX + 6.5 * k, ry, 0.7, DASH.cl);
    if (dens >= 3) out += TX(mx + ml / 2, y0 + hpx + 12, 'EXT SEUL', 8);
    return frame(faceX + 7.5 * k, y0 + hpx + (dens >= 3 ? 14 : 4), out);
  }  const bodyL = q.d * 1.6;
  const k = view.k ?? fitK(bodyL + 16, q.d + 8, view.fit ?? 130);
  const hpx = q.d * k, y0 = 3 * k, ry = y0 + hpx / 2, x0 = 4 * k, bl = bodyL * k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  // body (cylinder side view) + cooling rings COUNTED on the rear half
  let out = RC(x0, y0, bl, hpx, swB, '#fff');
  if (!heavy) for (let i = 1; i <= 3; i++) out += L(x0 + bl * 0.12 * i, y0 + 0.5 * k, x0 + bl * 0.12 * i, y0 + hpx - 0.5 * k, 0.7);
  // panel flange at the front third: taller disc + 2 screws
  const fw = (view.wallMm ?? 1.8) * k;
  const fx = x0 + bl * 0.62;
  out += RC(fx, y0 - 1.8 * k, fw, hpx + 3.6 * k, swM, '#fff');
  if (!heavy) { out += screwMini(fx + fw / 2, y0 - 0.9 * k, 0.7 * k, 'cross') + screwMini(fx + fw / 2, y0 + hpx + 0.9 * k, 0.7 * k, 'cross'); }
  // mouth: short bezel + medium-specific face
  const mx = fx + fw, ml = bl * 0.38 - fw + 4 * k;
  out += RC(mx, y0 + 0.6 * k, ml, hpx - 1.2 * k, swB, '#fff');
  const faceX = mx + ml;
  if (q.medium === 'ir') { // window: double line + glass tick
    out += L(faceX, y0 + 0.6 * k, faceX, y0 + hpx - 0.6 * k, swM);
    out += L(faceX - 0.8 * k, y0 + 1 * k, faceX - 0.8 * k, y0 + hpx - 1 * k, heavy ? 1.2 : 0.6); // inner window line
  } else if (q.medium === 'ultrasonic') { // slotted baffle mouth
    for (let i = 1; i <= (heavy ? 2 : 3); i++) out += L(faceX - i * 1.1 * k, y0 + 1.4 * k, faceX - i * 1.1 * k, y0 + hpx - 1.4 * k, heavy ? 1.6 : 0.9);
  } else { // EM: mesh cap
    out += RC(faceX - 1 * k, y0 + 0.6 * k, 1 * k, hpx - 1.2 * k, 0, 'url(#xmesh)');
  }
  // emission CL + rear pads
  out += L(faceX + 1 * k, ry, faceX + (heavy ? 4 : 6.5) * k, ry, heavy ? W.vis : 0.7, DASH.cl);
  if (!heavy) { out += pad(x0 - 2.2 * k, ry - 1.2 * k, 1 * k) + pad(x0 - 2.2 * k, ry + 1.2 * k, 1 * k); }
  if (dens >= 3 && !heavy) out += TX(x0 + bl / 2, y0 + hpx + 2.4 * k + 10, q.medium.toUpperCase() + ' · PANEL MOUNT', 8);
  return frame(faceX + 7.5 * k, y0 + hpx + 2.4 * k + (dens >= 3 && !heavy ? 14 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 52 }); }
export function binGlyph() { return thumb({}); }

// ── mounting contract (trans-paroi) ──
// wallAnchor: LOCAL drawing coords (no frame pad) of the point that must sit on the
// host WALL CENTRELINE + the local outward axis. wirePad: where the loom lands.
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const fw = (view.wallMm ?? 1.8) * k;
  const hpx = q.d * k, y0 = 3 * k;
  if (q.mounted === 'exterior' || view.exterior) return { x: 3 * k + fw / 2, y: y0 + hpx / 2, axis: 'x' };
  const bl = q.d * 1.6 * k;
  return { x: 4 * k + bl * 0.62 + fw / 2, y: y0 + hpx / 2, axis: 'x' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: 4 * k - 2.2 * k, y: 3 * k + q.d * k / 2 - 1.2 * k };
}
