// parts/interface/led-array.js — n COUNTED lamps, FIXED Ø3 @ pitch 5; lit lamp radiates.
import { L, C, RC, TX, frame, fitK, W, G } from '../lib.js';
const D = 3, PITCH = 5;                                       // FIXED mm

export const meta = {
  id: 'led-array', bin: 'INTERFACE', label: 'LED ARRAY',
  params: { n: { def: 4, min: 1, max: 10 }, shape: { def: 'round', options: ['round', 'square'] }, lit: { def: 0 } },
  slots: [],
  functions: { provides: ['indicate'], needs: ['power', 'control'], rates: { powerMw: '20/lamp' } },
  envelope: { rated: 1, pushMax: 3, instabilityPerPush: 0.08 },
  pushedDraw: ['+1: overdriven — all lamps radiate', '+2: resistor bypassed — shunt dot at pads', '+3: heat — vent demanded in host lid'],
  graftsInto: ['any panel cutout (shim set)'],
  variants: [
    { label: '4 × ROUND', p: {} },
    { label: '8 × BARGRAPH', p: { n: 8, shape: 'square', lit: 5 } },
    { label: '1 × PILOT', p: { n: 1, lit: 0 } }
  ]
};
const norm = p => ({ n: Math.max(1, Math.min(10, p?.n ?? 4)), shape: p?.shape ?? 'round', lit: Math.max(0, p?.lit ?? 0) });

const radiate = (x, y, r, k, sw) => {
  let out = '';
  for (const a of [-Math.PI * 0.75, -Math.PI / 2, -Math.PI * 0.25])
    out += L(x + (r + 0.6 * k) * Math.cos(a), y + (r + 0.6 * k) * Math.sin(a), x + (r + 1.8 * k) * Math.cos(a), y + (r + 1.8 * k) * Math.sin(a), sw);
  return out;
};

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2;
  const Wm = q.n * PITCH + 2, Hm = 8;
  const k = view.k ?? fitK(Wm, Hm + 4, view.fit ?? 170);
  const wpx = Wm * k, hpx = Hm * k;
  let out = RC(0, 2 * k, wpx, hpx, W.vis, '#fff');            // carrier strip
  for (let i = 0; i < q.n; i++) {
    const x = (1 + PITCH / 2 + i * PITCH) * k, y = (2 + Hm / 2) * k, r = D / 2 * k;
    if (q.shape === 'square') out += RC(x - r, y - r, 2 * r, 2 * r, W.vis, i <= q.lit && q.n > 4 ? 'url(#f45)' : '#fff');
    else {
      out += C(x, y, r, W.vis, '#fff');
      out += L(x - r, y + r * 0.55, x - r, y - r * 0.55, W.cut); // cathode flat
    }
    if (i === q.lit && (q.shape === 'round' || q.n <= 4)) out += radiate(x, y - 0.2 * k, r, k, 1);
    if (dens >= 3) out += C(x, (2 + Hm - 1.2) * k, 0.4 * k, 0.6); // pad witness
  }
  // 2 solder pads per lamp implied by the tail: n+1 common-anode leads
  const nL = q.n + 1, tw = nL * 1.27 + 1.2, tx = (Wm - tw) / 2 * k, ty = (Hm + 2) * k;
  out += RC(tx, ty, tw * k, 3.4 * k, W.mid, '#fff');
  for (let i = 0; i < nL; i++) out += L(tx + (0.6 + 0.635 + i * 1.27) * k, ty + 0.5 * k, tx + (0.6 + 0.635 + i * 1.27) * k, ty + 2.9 * k, 0.8);
  if (dens >= 3) out += TX(wpx / 2, ty + 5.4 * k, `${nL} LD · COMMON A`, 8);
  return frame(wpx, (Hm + (dens >= 3 ? 7.6 : 5.6)) * k, out);
}
export function thumb(p) {
  const q = norm(p ?? {});
  const n = Math.min(q.n, 4);
  const Wm = n * PITCH + 2, k = 56 / Wm;
  let out = RC(0, 0, Wm * k, 8 * k, W.cut, '#fff');
  for (let i = 0; i < n; i++) {
    const x = (1 + PITCH / 2 + i * PITCH) * k, y = 4 * k, r = D / 2 * k;
    out += C(x, y, r, W.vis, i === 0 ? '#111' : '#fff');
  }
  return frame(Wm * k, 8 * k, out, 4);
}
export function binGlyph() { return thumb({ n: 3 }); }

// ── wire contract: the loom lands on the common tail ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: (q.n * PITCH + 2) / 2 * k, y: (8 + 2) * k };
}
