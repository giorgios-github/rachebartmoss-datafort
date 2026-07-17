// parts/store/vessel.js — pressure/fluid: dome + neck (bottle) or crimped cartridge;
// matter port only; burst score FIXED.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, G, QUANT } from '../lib.js';
const VOLS = [10, 25, 60];                                    // QUANTISED ml

export const meta = {
  id: 'vessel', bin: 'STORE', label: 'TANK / VESSEL',
  params: { vol: { def: 25, stock: VOLS }, style: { def: 'bottle', options: ['bottle', 'cartridge', 'conformal'] }, bar: { def: 6 }, outline: { def: null, note: 'closed polygon [[mm,mm],…] — custom area for conformal tanks' } },
  slots: [],
  functions: { provides: ['hold-fluid'], needs: [], rates: { ml: 25, bar: 6 } },
  envelope: { rated: 6, pushMax: 2, instabilityPerPush: 0.25 },
  pushedDraw: ['+1: over-pressure — second crimp ring demanded, burst score doubled', '+2: jacket strap COUNTED around belly, stencil struck'],
  graftsInto: ['STORE/magazine vial bay (reducer bushing)', 'ACT/micro-pump manifold (pigtail hose)'],
  variants: [
    { label: 'BOTTLE 25 ML', p: {} },
    { label: 'CARTRIDGE 10 ML', p: { vol: 10, style: 'cartridge' } },
    { label: 'CONFORMAL · AIRE CUSTOM', p: { style: 'conformal', outline: [[0, 0], [34, 0], [34, 10], [16, 10], [16, 24], [0, 24]] } }
  ]
};
const norm = p => ({ vol: QUANT.snap(p?.vol ?? 25, VOLS), style: ['cartridge', 'conformal'].includes(p?.style) ? p.style : 'bottle', bar: p?.bar ?? 6, outline: Array.isArray(p?.outline) && p.outline.length >= 3 ? p.outline : null });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.style === 'conformal') {
    // custom-area tank: closed poly wall + inner offset, matter port on the rightmost vertex
    const ptsMm = q.outline ?? [[0, 0], [30, 0], [30, 12], [0, 12]];
    const bb = G.bbox(ptsMm);
    const k2 = view.k ?? fitK(bb.w + 12, bb.h + 8, view.fit ?? 150);
    const pts = ptsMm.map(([x, y]) => [3 * k2 + (x - bb.x) * k2, 2 * k2 + (y - bb.y) * k2]);
    let o = POLY(pts, heavy ? W.cut : W.vis, true, '#fff');
    o += POLY(G.offsetInward(pts, 1.6 * k2), heavy ? W.vis : W.mid, true);
    let ri = 0;
    pts.forEach((pt, i) => { if (pt[0] > pts[ri][0]) ri = i; });
    const [px, py] = pts[ri];
    o += C(px + 2 * k2, py, 1.2 * k2, heavy ? W.vis : W.mid, '#fff') + L(px, py, px + 0.9 * k2, py, heavy ? W.vis : W.mid); // matter port
    if (!heavy) o += L(pts[0][0] + 2 * k2, pts[0][1] + 2.4 * k2, px - 2 * k2, py - 1 * k2, 0.5, DASH.cl);
    if (dens >= 3 && !heavy) o += TX(3 * k2 + bb.w * k2 / 2, 2 * k2 + bb.h * k2 + 12, 'CONFORMAL · FITS THE CAVITY', 8);
    return frame(bb.w * k2 + 8 * k2, bb.h * k2 + 4 * k2 + (dens >= 3 && !heavy ? 14 : 0), o);
  }
  const D = q.vol <= 10 ? 12 : q.vol <= 25 ? 18 : 26, len = D * 2.1; // QUANTISED from vol
  const k = view.k ?? fitK(len + 10, D + 6, view.fit ?? 160);
  const y0 = 2 * k, hpx = D * k, ry = y0 + hpx / 2, x0 = 2 * k, bl = len * k;
  let out = '';
  if (q.style === 'bottle') {
    // dome left (semicircle), neck right
    out += `<path d="M${(x0 + hpx / 2).toFixed(1)},${y0.toFixed(1)} A${(hpx / 2).toFixed(1)},${(hpx / 2).toFixed(1)} 0 0 0 ${(x0 + hpx / 2).toFixed(1)},${(y0 + hpx).toFixed(1)} M${(x0 + hpx / 2).toFixed(1)},${y0.toFixed(1)} H${(x0 + bl).toFixed(1)} M${(x0 + hpx / 2).toFixed(1)},${(y0 + hpx).toFixed(1)} H${(x0 + bl).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? W.cut : W.vis}"/>`;
    // shoulder + neck
    out += POLY([[x0 + bl, y0], [x0 + bl + 3 * k, ry - 2 * k], [x0 + bl + 5.5 * k, ry - 2 * k]], heavy ? W.cut : W.vis, false);
    out += POLY([[x0 + bl, y0 + hpx], [x0 + bl + 3 * k, ry + 2 * k], [x0 + bl + 5.5 * k, ry + 2 * k]], heavy ? W.cut : W.vis, false);
    for (let i = 1; i <= 2; i++) out += L(x0 + bl + 3.4 * k + i * 0.9 * k, ry - 2 * k, x0 + bl + 3.4 * k + i * 0.9 * k, ry + 2 * k, heavy ? 1.2 : 0.7); // neck thread
    // weld seam HL at dome tangent
    if (!heavy) out += L(x0 + hpx / 2, y0, x0 + hpx / 2, y0 + hpx, 0.8, DASH.hl);
  } else {
    out += RC(x0, y0, bl, hpx, heavy ? W.cut : W.vis, '#fff');
    for (const fx of [x0 + 1.6 * k, x0 + bl - 1.6 * k]) out += L(fx, y0 + 0.5 * k, fx, y0 + hpx - 0.5 * k, heavy ? W.vis : W.mid); // crimped flat ends
    out += C(x0 + bl - 4 * k, ry, 1 * k, heavy ? W.vis : W.mid); // pierce port
  }
  // burst score FIXED + fill CL
  if (!heavy) {
    out += L(x0 + bl * 0.35, y0 + 1.2 * k, x0 + bl * 0.55, y0 + 1.2 * k, 1.2);
    out += L(x0 + bl * 0.1, ry, x0 + bl * 0.9, ry, 0.5, DASH.cl);
    if (dens >= 3) out += TX(x0 + bl / 2, y0 + hpx + 12, `${q.vol} ML · ${q.bar} BAR · MATTER PORT ONLY`, 8);
  }
  return frame(x0 + bl + (q.style === 'bottle' ? 7 * k : 2 * k), y0 + hpx + (dens >= 3 && !heavy ? 16 : 4), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 54 }); }
export function binGlyph() { return thumb({}); }

// loom/hose termination: the matter port
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.style === 'conformal') {
    const pts = q.outline ?? [[0, 0], [30, 0], [30, 12], [0, 12]];
    const bb = G.bbox(pts);
    let ri = 0; pts.forEach((pt, i) => { if (pt[0] > pts[ri][0]) ri = i; });
    return { x: 3 * k + (pts[ri][0] - bb.x) * k + 2 * k, y: 2 * k + (pts[ri][1] - bb.y) * k };
  }
  const D2 = q.vol <= 10 ? 12 : q.vol <= 25 ? 18 : 26, len = D2 * 2.1;
  if (q.style === 'bottle') return { x: 2 * k + len * k + 4.5 * k, y: 2 * k + D2 * k / 2 };
  return { x: 2 * k + len * k - 4 * k, y: 2 * k + D2 * k / 2 };
}
