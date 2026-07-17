// parts/sense/imu.js — motion unit, QUIET drawing: QFN body, pin-1, one Z-dot,
// one orientation arrow. Nothing else — an IMU is a sealed die, not a diagram.
import { L, C, RC, TX, frame, fitK, W, QUANT } from '../lib.js';
const SIZES = [7, 10];                                        // QUANTISED body mm

export const meta = {
  id: 'imu', bin: 'SENSE', label: 'IMU / MOTION',
  params: { body: { def: 7, stock: SIZES }, axes: { def: 6, options: [3, 6, 9] } },
  slots: [],
  functions: { provides: ['sense-motion'], needs: ['power', 'control'], rates: { axes: 6 } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.04 },
  pushedDraw: ['+1: sample-rate push — no drawable delta beyond stencil struck'],
  graftsInto: ['LOGIC/board IC socket (LOGIC-package body in a SENSE role — the orientation arrow is the wrong-bin read)'],
  variants: [
    { label: '7 MM · 6-AXIS', p: {} },
    { label: '10 MM · 9-AXIS', p: { body: 10, axes: 9 } },
    { label: '7 MM · 3-AXIS', p: { axes: 3 } }
  ]
};
const norm = p => ({ body: QUANT.snap(p?.body ?? 7, SIZES), axes: [3, 6, 9].includes(p?.axes) ? p.axes : 6 });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.body + 5, q.body + 5, view.fit ?? 95);
  const m = 2.2 * k, s = q.body * k;
  let out = RC(m, m, s, s, heavy ? W.cut : W.vis, '#fff');
  // QFN pads: 3 short ticks per side, at the edge only (quiet)
  if (!heavy) for (const [sx, sy] of [[0, -1], [0, 1], [-1, 0], [1, 0]])
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      if (sx === 0) out += L(m + s * t, sy < 0 ? m : m + s, m + s * t, (sy < 0 ? m : m + s) + sy * 0.8 * k, 0.8);
      else out += L(sx < 0 ? m : m + s, m + s * t, (sx < 0 ? m : m + s) + sx * 0.8 * k, m + s * t, 0.8);
    }
  out += C(m + 1.3 * k, m + 1.3 * k, 0.4 * k, heavy ? 0 : 0.8, heavy ? '#111' : 'none'); // pin 1
  // orientation arrow (filled, points N) + Z circled-dot centre — the whole story
  const cx = m + s / 2;
  out += `<path d="M${cx.toFixed(1)},${(m + s * 0.2).toFixed(1)} L${(cx - s * 0.09).toFixed(1)},${(m + s * 0.38).toFixed(1)} H${(cx + s * 0.09).toFixed(1)} Z" fill="#111" stroke="none"/>`;
  out += C(cx, m + s * 0.62, s * 0.1, heavy ? 2 : 1) + C(cx, m + s * 0.62, s * 0.032, 0, '#111');
  if (dens >= 3 && !heavy) out += TX(cx, m + s + 0.8 * k + 12, `${q.axes}-AXIS`, 8);
  return frame(s + 2 * m, s + 2 * m + (dens >= 3 && !heavy ? 14 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 40 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on pin 1 ──
export function wirePad(p, view = {}) {
  const k = view.k ?? 8;
  return { x: 2.2 * k + 1.3 * k, y: 2.2 * k + 1.3 * k };
}
