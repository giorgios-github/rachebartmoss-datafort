// parts/link/laser-link.js — free-space head: collimator barrel + alignment gimbal.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, pad, screwMini } from '../lib.js';
const SIZES = [10, 14];                                       // QUANTISED barrel Ø

export const meta = {
  id: 'laser-link', bin: 'LINK', label: 'LASER LINK',
  params: { d: { def: 10, stock: SIZES }, gimballed: { def: true } },
  slots: [],
  functions: { provides: ['link-optical'], needs: ['power', 'control'], rates: { los: 'line-of-sight only' } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.2 },
  pushedDraw: ['+1: emitter overdrive — heatsink collar demanded on barrel', '+2: past eye-safe class — guard shroud + struck stencil demanded'],
  graftsInto: ['SENSE/optic mount ring (shim set — same barrel family)'],
  variants: [
    { label: 'Ø10 · GIMBALLED', p: {} },
    { label: 'Ø14', p: { d: 14 } },
    { label: 'Ø10 · FIXED BORESIGHT', p: { gimballed: false } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 10, SIZES), gimballed: p?.gimballed !== false });

// side elevation: barrel on gimbal yoke, beam axis drawn CL
export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.d * 2.6 + 8, q.d + 12, view.fit ?? 140);
  const bl = q.d * 2.2 * k, bh = q.d * k;
  const x0 = 4 * k, y0 = 6 * k;
  let out = RC(x0, y0, bl, bh, heavy ? W.cut : W.vis, '#fff');                 // barrel
  out += RC(x0 + bl, y0 + bh * 0.18, 1.6 * k, bh * 0.64, heavy ? W.vis : W.mid, '#fff'); // exit aperture ring
  if (!heavy) for (let i = 1; i <= 3; i++) out += L(x0 + bl * 0.16 * i, y0, x0 + bl * 0.16 * i, y0 + bh, 0.6); // collimator sections
  // beam axis CL
  out += L(x0 + bl + 1.6 * k, y0 + bh / 2, x0 + bl + (heavy ? 6 : 9) * k, y0 + bh / 2, heavy ? W.vis : 0.8, DASH.cl);
  if (q.gimballed) {
    const gy = y0 + bh + 1.2 * k, gc = x0 + bl * 0.5;
    out += `<path d="M${(gc - 4 * k).toFixed(1)},${(gy + 3.4 * k).toFixed(1)} A${(4.6 * k).toFixed(1)},${(4.6 * k).toFixed(1)} 0 0 1 ${(gc + 4 * k).toFixed(1)},${(gy + 3.4 * k).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? W.cut : W.vis}"/>`; // yoke
    out += C(gc, gy + 0.4 * k, 1.2 * k, heavy ? W.vis : W.mid, '#fff');        // trunnion
    out += RC(gc - 5 * k, gy + 3.4 * k, 10 * k, 1.8 * k, heavy ? W.vis : W.mid, '#fff'); // base
    if (!heavy) for (const sx of [-3.6, 3.6]) out += screwMini(gc + sx * k, gy + 4.3 * k, 0.8 * k, 'cross');
  } else {
    out += RC(x0 + bl * 0.3, y0 + bh, bl * 0.4, 2 * k, heavy ? W.vis : W.mid, '#fff');
  }
  if (!heavy) { out += pad(x0 - 2.2 * k, y0 + bh * 0.5, 1 * k); if (dens >= 3) out += TX(x0 + bl / 2, y0 + bh + (q.gimballed ? 7.4 : 4) * k + 8, q.gimballed ? '±15° GIMBAL' : 'FIXED BORESIGHT', 8); }
  return frame(x0 + bl + 10 * k, y0 + bh + (q.gimballed ? 6.4 : 3) * k + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 50 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the rear feed pad ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: 4 * k - 2.2 * k, y: 6 * k + q.d * k * 0.5 };
}
