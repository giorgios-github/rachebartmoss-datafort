// parts/sense/chem-sniffer.js — THROUGH-WALL sense organ, same grammar as the injector:
// sampling tip OUTSIDE the host wall, membrane + chamber INSIDE, clean bore transition.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT, pad, flangeV } from '../lib.js';
const SIZES = [14, 20];                                       // QUANTISED body mm

export const meta = {
  id: 'chem-sniffer', bin: 'SENSE', label: 'CHEM SNIFFER',
  params: { s: { def: 14, stock: SIZES }, heated: { def: false }, mounted: { def: false, note: "'exterior' = sampling tip only, no signal" } },
  slots: [],
  functions: { provides: ['sense-chem'], needs: ['power', 'matter (air)'], rates: {} },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.14 },
  pushedDraw: ['+1: pump overspeed — second inlet ring demanded on the tip', '+2: heater push — vent demanded, stencil struck'],
  graftsInto: ['any wall bore Ø one size off (reducer bushing)'],
  variants: [
    { label: '14 MM', p: {} },
    { label: '20 MM · HEATED', p: { s: 20, heated: true } },
    { label: '14 MM · HEATED', p: { heated: true } },
    { label: 'EXT SEUL — POINTE', p: { mounted: 'exterior' } }
  ]
};
const norm = p => ({ s: QUANT.snap(p?.s ?? 14, SIZES), heated: !!p?.heated, mounted: p?.mounted === 'exterior' ? 'exterior' : false });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted === 'exterior') {
    // EXT SEUL: the sampling tip exactly as it emerges — snout, rings, mesh, CL
    const k = view.k ?? fitK(14, 8, view.fit ?? 85);
    const ry = 4 * k, nx = 3 * k, tipL = 5.5 * k;
    let out = POLY([[nx, ry - 1.8 * k], [nx + tipL, ry - 1 * k], [nx + tipL, ry + 1 * k], [nx, ry + 1.8 * k]], W.vis, true, '#fff');
    for (let i = 1; i <= 3; i++) out += L(nx + tipL * i / 4, ry - 1.5 * k + 0.14 * tipL * i / 4, nx + tipL * i / 4, ry + 1.5 * k - 0.14 * tipL * i / 4, 0.8);
    out += RC(nx + tipL, ry - 1 * k, 0.9 * k, 2 * k, 0, 'url(#xmesh)');
    out += L(nx + tipL + 1.5 * k, ry, nx + tipL + 4.5 * k, ry, 0.5, DASH.cl);
    if (dens >= 3) out += TX(nx + tipL / 2 + 1 * k, ry + 3.4 * k + 8, 'EXT SEUL', 8);
    return frame(nx + tipL + 6 * k, ry + 3.4 * k + (dens >= 3 ? 10 : 0), out);
  }
  const bodyL = q.s, D = q.s * 0.62;
  const k = view.k ?? fitK(bodyL + 20, D + 10, view.fit ?? 150);
  const hpx = D * k, y0 = 4 * k, ry = y0 + hpx / 2;
  const x0 = 4 * k, bl = bodyL * k, wallX = x0 + bl, wallT = 2.5 * k;
  let out = '';
  // WALL-CROSSING SIGNAL: emitter-grammar flange (plate + 2 screws)
  out += flangeV(wallX, ry, hpx / 2 + 0.6 * k, k, heavy);
  // INSIDE: body with membrane window (POT) + sample chamber
  out += RC(x0, y0, bl, hpx, heavy ? W.cut : W.vis, '#fff');
  out += RC(x0 + 1.4 * k, y0 + 1.2 * k, bl * 0.38, hpx - 2.4 * k, heavy ? W.vis : W.mid, 'url(#pot)'); // membrane
  out += C(x0 + bl * 0.72, ry, hpx * 0.3, heavy ? W.vis : W.mid, '#fff');                              // chamber
  if (q.heated && !heavy) out += RC(x0 + bl * 0.55, y0 + hpx - 1.6 * k, bl * 0.34, 1.1 * k, 0, 'url(#f45)'); // heater strip
  if (!heavy) { out += pad(x0 + bl * 0.25, y0 - 1.8 * k, 1 * k) + pad(x0 + bl * 0.5, y0 - 1.8 * k, 1 * k); }
  // OUTSIDE: sampling tip — tapered snout, inlet ring slots, mesh cap
  const nx = wallX + 1.8 * k, tipL = 5.5 * k;                // tip starts AT the flange — no gap
  out += POLY([[nx, ry - 1.8 * k], [nx + tipL, ry - 1 * k], [nx + tipL, ry + 1 * k], [nx, ry + 1.8 * k]], heavy ? W.cut : W.vis, true, '#fff');
  for (let i = 1; i <= (heavy ? 2 : 3); i++) out += L(nx + tipL * i / 4, ry - 1.5 * k + 0.14 * tipL * i / 4, nx + tipL * i / 4, ry + 1.5 * k - 0.14 * tipL * i / 4, heavy ? 1.4 : 0.8); // inlet rings
  out += RC(nx + tipL, ry - 1 * k, 0.9 * k, 2 * k, 0, 'url(#xmesh)');                                   // mesh cap
  out += L(nx + tipL + 1.5 * k, ry, nx + tipL + (heavy ? 3 : 4.5) * k, ry, 0.5, DASH.cl);
  if (dens >= 3 && !heavy) { out += TX(x0 + bl / 2, y0 + hpx + 4.6 * k + 8, q.heated ? 'MEMBRANE · HEATED' : 'MEMBRANE', 8); out += TX(nx + tipL / 2, y0 + hpx + 4.6 * k + 8, 'TIP OUT', 8); }
  return frame(nx + tipL + 9 * k, y0 + hpx + 4.2 * k + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 54 }); }
export function binGlyph() { return thumb({}); }

// ── mounting contract (trans-paroi: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.mounted === 'exterior' || view.exterior) return { x: 3 * k, y: 4 * k, axis: 'x' };
  const D = q.s * 0.62, ry = 4 * k + D * k / 2;
  return { x: 4 * k + q.s * k, y: ry, axis: 'x' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: 4 * k + q.s * k * 0.25, y: 4 * k - 1.8 * k };
}
