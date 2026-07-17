// parts/link/antenna.js — ONE part, four computed geometries: whip | stub | patch | dish.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, G, QUANT, keyPin, knurl } from '../lib.js';
const LEN = { whip: [40, 60, 90], stub: [12, 18], patch: [16, 24], dish: [24, 36] }; // QUANTISED

export const meta = {
  id: 'antenna', bin: 'LINK', label: 'ANTENNA',
  params: {
    geom: { def: 'stub', options: ['whip', 'stub', 'patch', 'dish'] },
    bare: { def: false, note: 'sans port — feed retracted inside the case' },
    size: { def: 18, note: 'snapped to the geometry’s stock' }
  },
  slots: [],
  functions: { provides: ['link-rf (radiator)'], needs: ['signal (feed)'], rates: { gain: 'geometry-bound' } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.06 },
  pushedDraw: ['+1: TX overdrive — choke ferrite ring demanded at feed', '+2: whip extended past stock — splice collar drawn (QUANTISED), stencil struck'],
  graftsInto: ['any RF feed one thread size off (reducer bushing)'],
  variants: [
    { label: 'WHIP 60', p: { geom: 'whip', size: 60 } },
    { label: 'PATCH 24', p: { geom: 'patch', size: 24 } },
    { label: 'DISH 36', p: { geom: 'dish', size: 36 } },
    { label: 'WHIP 60 · SANS PORT', p: { geom: 'whip', size: 60, bare: true } },
    { label: 'STUB 18 · SANS PORT', p: { bare: true } },
    { label: 'DISH 36 · SANS PORT', p: { geom: 'dish', size: 36, bare: true } }
  ]
};
const norm = p => { const g = LEN[p?.geom] ? p.geom : 'stub'; return { geom: g, size: QUANT.snap(p?.size ?? LEN[g][0], LEN[g]), bare: !!p?.bare }; };

// threaded feed base, shared by all four geometries (FIXED footprint = the interface)
function feedBase(x, y, k, heavy) {
  let out = RC(x - 2.5 * k, y, 5 * k, 4 * k, heavy ? W.cut : W.vis, '#fff');
  for (let i = 1; i <= 3; i++) out += L(x - 2.5 * k, y + i * k, x + 2.5 * k, y + i * k, heavy ? 1.2 : 0.7); // thread runs
  out += RC(x - 3.4 * k, y - 2 * k, 6.8 * k, 2 * k, heavy ? W.vis : W.mid, '#fff');                          // hex flat (side view)
  return out;
}

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  let out = '', wpx, hpx;
  if (q.geom === 'whip') {
    // telescopic: swivel knuckle at the base, nested sections of decreasing width
    const k = view.k ?? fitK(16, q.size + 14, view.fit ?? 190);
    const x = 8 * k;
    hpx = (q.size + 12) * k; wpx = 16 * k;
    if (!q.bare) out += feedBase(x, hpx - 4 * k, k, heavy);
    else out += L(x - 2 * k, hpx - 4 * k, x + 2 * k, hpx - 4 * k, heavy ? W.vis : W.mid); // base collar only
    // orienteur: pivot knuckle (circle + clamp screw) above the feed
    const py = hpx - 5.6 * k;
    out += C(x, py, 1.7 * k, heavy ? W.cut : W.vis, '#fff');
    out += C(x, py, 0.55 * k, heavy ? W.vis : W.mid, '#fff');
    if (!heavy) out += L(x + 1.7 * k, py, x + 3 * k, py, W.mid) + L(x + 3 * k, py - 0.8 * k, x + 3 * k, py + 0.8 * k, W.mid); // clamp screw
    // sections COUNTED: QUANTISED 3/4/5 from length, widths decreasing
    const nS = q.size <= 40 ? 3 : q.size <= 60 ? 4 : 5;
    const total = (q.size - 4) * k;
    let yTop = py - 1.7 * k;
    for (let i = 0; i < nS; i++) {
      const sh = total / nS, swd = (2.6 - i * (1.8 / nS)) * k;
      out += RC(x - swd / 2, yTop - sh, swd, sh, heavy ? W.cut : W.vis, '#fff');
      if (!heavy && i < nS - 1) out += L(x - swd / 2 - 0.4 * k, yTop - sh, x + swd / 2 + 0.4 * k, yTop - sh, W.mid); // collar
      yTop -= sh;
    }
    out += C(x, yTop - 0.7 * k, heavy ? 2 : 0.9 * k, heavy ? W.vis : W.mid, '#fff'); // tip ball
  } else if (q.geom === 'stub') {
    const k = view.k ?? fitK(12, q.size + 8, view.fit ?? 120);
    const x = 6 * k;
    hpx = (q.size + 6) * k; wpx = 12 * k;
    if (!q.bare) out += feedBase(x, hpx - 4 * k, k, heavy);
    else out += L(x - 2 * k, hpx - 4 * k, x + 2 * k, hpx - 4 * k, heavy ? W.vis : W.mid);
    out += RC(x - 1.8 * k, hpx - 4 * k - q.size * k * 0.88, 3.6 * k, q.size * k * 0.88, heavy ? W.cut : W.vis, '#fff', null, 1.6 * k);
    if (!heavy) for (let i = 1; i <= 3; i++) out += L(x - 1.8 * k, hpx - 4 * k - q.size * k * 0.88 * i / 4, x + 1.8 * k, hpx - 4 * k - q.size * k * 0.88 * i / 4, 0.6); // helix witness
  } else if (q.geom === 'patch') {
    const k = view.k ?? fitK(q.size + 4, q.size + 10, view.fit ?? 130);
    const s = q.size * k;
    wpx = s + 4 * k; hpx = s + 9 * k;
    out += RC(2 * k, 0, s, s, heavy ? W.cut : W.vis, '#fff');                                // ground plane
    out += RC(2 * k + s * 0.18, s * 0.18, s * 0.64, s * 0.64, heavy ? W.vis : W.mid, '#fff'); // radiator patch
    out += C(2 * k + s * 0.5, s * 0.66, heavy ? 2.4 : 1 * k, heavy ? W.vis : W.mid);          // feed via, offset = polarisation
    if (!heavy) for (const [mx, my] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) out += C(2 * k + s / 2 + mx * (s / 2 - 1.4 * k), s / 2 + my * (s / 2 - 1.4 * k), 0.7 * k, 0.6);
    if (!q.bare) out += feedBase(2 * k + s * 0.5, s + 2 * k, k, heavy);
  } else { // dish — bowl opens up-screen, feed at focus on a real stalk
    const k = view.k ?? fitK(q.size + 6, q.size * 0.8 + 10, view.fit ?? 150);
    const D = q.size * k, cx = D / 2 + 3 * k;
    wpx = D + 6 * k;
    // parabola (computed): vertex at yv, rim in the y = 2k aperture plane; f = D/4
    const f = D / 4, yv = 2 * k + f, pts2 = [];
    for (let i = 0; i <= 24; i++) { const x = -D / 2 + D * i / 24; pts2.push([cx + x, yv - (x * x) / (4 * f)]); }
    out += POLY(pts2, heavy ? W.cut : W.vis, false);
    out += L(pts2[0][0], pts2[0][1], pts2[24][0], pts2[24][1], heavy ? W.vis : 0.7, heavy ? null : DASH.hl); // aperture plane
    const fy = yv - f, fr = heavy ? 2.6 : 1.3 * k;              // focus: at f/D = 0.25 it sits in the aperture plane
    out += L(cx, yv, cx, fy + fr, heavy ? W.vis : W.mid);       // feed stalk, vertex → focus
    out += C(cx, fy, fr, heavy ? W.vis : W.mid, '#fff');        // feed horn
    out += L(cx, yv, cx, yv + 2 * k, heavy ? W.vis : W.mid);    // rear boss stub
    if (!q.bare) out += feedBase(cx, yv + 2 * k, k, heavy);
    hpx = yv + 6.2 * k;
  }
  if (dens >= 3 && !heavy) out += TX(wpx / 2, hpx + 10, `${q.geom.toUpperCase()} · ${q.size}`, 8);
  return frame(wpx, hpx + (dens >= 3 && !heavy ? 14 : 2), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 52 }); }
export function binGlyph() { return thumb({ geom: 'whip', size: 40 }); }
