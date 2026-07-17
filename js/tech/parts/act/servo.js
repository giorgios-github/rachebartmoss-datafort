// parts/act/servo.js — rotary servo: spline disc, horn, PH sweep, ear mounts.
import { L, C, RC, TX, frame, fitK, W, DASH, G, QUANT, screwMini, flangeH } from '../lib.js';
const SIZES = [12, 20, 32];                                   // QUANTISED body mm

export const meta = {
  id: 'servo', bin: 'ACT', label: 'SERVO',
  params: { size: { def: 20, stock: SIZES }, sweep: { def: 180, options: [90, 180, 270] }, side: { def: false, note: 'side elevation' }, mounted: { def: false, note: 'trans-boîtier: shaft + horn only' } },
  slots: [],
  functions: { provides: ['actuate-rotary'], needs: ['power', 'control'], rates: { sweep: 180 } },
  envelope: { rated: 1, pushMax: 3, instabilityPerPush: 0.15 },
  pushedDraw: ['+1: torque push — gear case strap COUNTED', '+2: stop tabs milled — sweep arc extends PH past stops', '+3: coil overvolt — vent demanded, stencil struck'],
  graftsInto: ['STRUCTURE/rail clamp drive seat (jury-rig bracket)'],
  variants: [
    { label: '20 · 180° · PLAN', p: {} },
    { label: '32 · 270°', p: { size: 32, sweep: 270 } },
    { label: '12 · 90°', p: { size: 12, sweep: 90 } },
    { label: '20 · SIDE ELEVATION', p: { side: true } },
    { label: '20 · TRAVERSANT — ARBRE + HORN', p: { mounted: true } },
    { label: '20 · EXT SEUL — ARBRE + HORN', p: { mounted: 'exterior' } },
    { label: '32 · TRAVERSANT', p: { size: 32, mounted: true } },
    { label: '32 · EXT SEUL', p: { size: 32, mounted: 'exterior' } }
  ]
};
const norm = p => ({ size: QUANT.snap(p?.size ?? 20, SIZES), sweep: [90, 180, 270].includes(p?.sweep) ? p.sweep : 180, side: !!p?.side, mounted: p?.mounted === 'exterior' ? 'exterior' : !!p?.mounted });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted) return drawSide(q, view, q.mounted);  if (q.side) return drawSide(q, view, false);
  const Wm = q.size * 1.5, Hm = q.size;
  const k = view.k ?? fitK(Wm + 10, Hm + 8, view.fit ?? 150);
  const wpx = Wm * k, hpx = Hm * k, y0 = 4 * k;
  let out = RC(0, y0, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
  // ear tabs + bolt holes (FIXED)
  for (const sx of [-1, 1]) {
    const ex = sx < 0 ? -3.4 * k : wpx;
    out += RC(ex, y0 + hpx * 0.3, 3.4 * k, hpx * 0.4, heavy ? W.vis : W.mid, '#fff');
    out += C(ex + 1.7 * k, y0 + hpx * 0.5, 0.8 * k, heavy ? 1.4 : W.fine);
  }
  // output disc + spline holes COUNTED (4) + horn
  const cx = wpx * 0.32, cy = y0 + hpx * 0.5, r = hpx * 0.34;
  out += C(cx, cy, r, heavy ? W.vis : W.mid, '#fff');
  out += C(cx, cy, r * 0.3, heavy ? W.vis : W.mid, '#fff');
  if (!heavy) for (let i = 0; i < 4; i++) { const a = G.TAU * i / 4 + 0.4; out += C(cx + r * 0.65 * Math.cos(a), cy + r * 0.65 * Math.sin(a), 0.35 * k, 0.7); }
  // horn arm at 0°, sweep arc PH
  out += L(cx, cy, cx + r * 1.7, cy - r * 0.5, heavy ? W.cut : W.vis) + C(cx + r * 1.7, cy - r * 0.5, heavy ? 1.8 : 0.5 * k, heavy ? W.vis : W.mid, '#fff');
  if (!heavy) {
    const a0 = -0.29, a1 = a0 - q.sweep * Math.PI / 180, rr = r * 1.55;
    out += `<path d="M${(cx + rr * Math.cos(a0)).toFixed(1)},${(cy + rr * Math.sin(a0)).toFixed(1)} A${rr.toFixed(1)},${rr.toFixed(1)} 0 ${q.sweep > 180 ? 1 : 0} 0 ${(cx + rr * Math.cos(a1)).toFixed(1)},${(cy + rr * Math.sin(a1)).toFixed(1)}" fill="none" stroke="#111" stroke-width="0.7" stroke-dasharray="${DASH.ph}"/>`;
  }
  // gear head parting line + lead exit
  out += L(wpx * 0.58, y0, wpx * 0.58, y0 + hpx, heavy ? 1.4 : 0.7, heavy ? null : DASH.hl);
  if (!heavy) { for (let i = 0; i < 3; i++) out += L(wpx + 3.4 * k, y0 + hpx * (0.4 + 0.1 * i), wpx + 6 * k, y0 + hpx * (0.4 + 0.1 * i), W.mid); if (dens >= 3) out += TX(wpx / 2, y0 + hpx + 14, `${q.sweep}° SWEEP`, 8); }
  return frame(wpx + (heavy ? 0 : 7 * k) + 3.4 * k, y0 + hpx + (dens >= 3 && !heavy ? 18 : 4), `<g transform="translate(${(3.4 * k).toFixed(1)},0)">${out}</g>`);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 50 }); }
export function binGlyph() { return thumb({}); }

// side elevation: body / flange ears / gear head / shaft up / horn
function drawSide(q, view, mounted = false) {
  const heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (mounted === 'exterior') {
    // EXT SEUL: exact copy of what emerges above the case top — boss, spline, horn
    const k = view.k ?? fitK(q.size + 14, 12, view.fit ?? 130);
    const sx2 = 8 * k, base = 7 * k;
    let out = RC(sx2 - 1 * k, base - 2.4 * k, 2 * k, 2.4 * k, W.mid, '#fff');
    out += RC(sx2 - 0.5 * k, base - 4 * k, 1 * k, 1.6 * k, W.mid, '#fff');
    out += L(sx2 - 4.5 * k, base - 4 * k, sx2 + 6 * k, base - 4 * k, W.vis);
    for (const hx of [-3.4, 2.6, 5]) out += C(sx2 + hx * k, base - 4 * k, 0.4 * k, 0.7);
    if (dens >= 3) out += TX(sx2, base + 10, 'EXT SEUL', 8);
    return frame(sx2 + 8 * k, base + (dens >= 3 ? 14 : 4), out);
  }
  const Wm = q.size, Hm = q.size * 0.9;
  const k = view.k ?? fitK(Wm + 14, Hm + 12, view.fit ?? 150);
  const wpx = Wm * k, hpx = Hm * k, x0 = 5 * k, y0 = 7 * k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  let out = RC(x0, y0, wpx, hpx, swB, '#fff');
  // gear head band + flange with ear tabs
  out += L(x0, y0 + hpx * 0.28, x0 + wpx, y0 + hpx * 0.28, swM);
  const fy = y0 + hpx * 0.28;
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x0 - 3.2 * k : x0 + wpx;
    out += RC(ex, fy - 1.4 * k, 3.2 * k, 1.4 * k, swM, '#fff');
    out += C(ex + 1.6 * k, fy - 0.7 * k, 0.6 * k, heavy ? 1.2 : W.fine);
  }
  // shaft up + horn
  const sx2 = x0 + wpx * 0.3, mo = mounted ? 1.8 * k : 0;
  if (mounted) out += flangeH(sx2, y0 - 1.8 * k, 2 * k, k, heavy);              // wall-crossing signal — ON the case top
  out += RC(sx2 - 1 * k, y0 - 2.4 * k - mo, 2 * k, 2.4 * k, swM, '#fff');       // shaft boss
  out += RC(sx2 - 0.5 * k, y0 - 4 * k - mo, 1 * k, 1.6 * k, swM, '#fff');       // spline
  out += L(sx2 - 4.5 * k, y0 - 4 * k - mo, sx2 + 6 * k, y0 - 4 * k - mo, swB);  // horn bar
  if (!heavy) for (const hx of [-3.4, 2.6, 5]) out += C(sx2 + hx * k, y0 - 4 * k - mo, 0.4 * k, 0.7);
  // seam + lead exit bottom rear
  out += L(x0 + wpx * 0.62, fy, x0 + wpx * 0.62, y0 + hpx, heavy ? 1.2 : 0.7, heavy ? null : DASH.hl);
  if (!heavy) { for (let i = 0; i < 3; i++) out += L(x0 + wpx, y0 + hpx - (2 + i) * k, x0 + wpx + 2.6 * k, y0 + hpx - (2 + i) * k, W.mid); }
  if (dens >= 3 && !heavy) out += TX(x0 + wpx / 2, y0 + hpx + 14, 'SIDE · SHAFT UP', 8);
  return frame(x0 + wpx + 6 * k, y0 + hpx + (dens >= 3 && !heavy ? 18 : 3), out);
}

// ── mounting contract (trans-paroi side: flange centre on the case top; outward = -y) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.mounted === 'exterior' || view.exterior) return { x: 8 * k, y: 7 * k, axis: '-y' };
  return { x: 5 * k + q.size * k * 0.3, y: 7 * k - 0.9 * k, axis: '-y' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: 5 * k + q.size * k + 2.6 * k, y: 7 * k + q.size * 0.9 * k - 2 * k };
}
