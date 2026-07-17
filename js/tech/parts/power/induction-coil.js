// parts/power/induction-coil.js — flat pancake receiver: turns COUNTED, ferrite backing.
import { L, C, RC, frame, fitK, W, G, QUANT, pad } from '../lib.js';
const SIZES = [16, 24, 36];                                   // QUANTISED Ø mm

export const meta = {
  id: 'induction-coil', bin: 'POWER', label: 'INDUCTION COIL',
  params: { d: { def: 24, stock: SIZES } },
  slots: [],
  functions: { provides: ['link-power'], needs: [], rates: { watts: 'Ø-bound' } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.12 },
  pushedDraw: ['+1: over-coupled — ferrite tile doubled (second dashed outline)', '+2: eddy heat — vent demanded in host lid over the coil'],
  graftsInto: ['SENSE/em-probe seat (shim set — same footprint family)'],
  variants: [
    { label: 'Ø16', p: { d: 16 } },
    { label: 'Ø24', p: {} },
    { label: 'Ø36', p: { d: 36 } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 24, SIZES) });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.d + 6, q.d + 8, view.fit ?? 140);
  const r = q.d / 2 * k, c = r + 3 * k;
  // ferrite backing tile (square, chamfered) behind
  const s = r * 1.05;
  let out = `<path d="M${(c - s + 2).toFixed(1)},${(c - s).toFixed(1)} H${(c + s - 2).toFixed(1)} L${(c + s).toFixed(1)},${(c - s + 2).toFixed(1)} V${(c + s - 2).toFixed(1)} L${(c + s - 2).toFixed(1)},${(c + s).toFixed(1)} H${(c - s + 2).toFixed(1)} L${(c - s).toFixed(1)},${(c + s - 2).toFixed(1)} V${(c - s + 2).toFixed(1)} Z" fill="#fff" stroke="#111" stroke-width="${heavy ? W.vis : W.mid}"/>`;
  // winding: turns COUNTED at FIXED radial pitch 1.4 mm
  const n = heavy ? 4 : Math.max(4, Math.floor((q.d / 2 - 3) / 1.4));
  for (let i = 0; i < n; i++) out += C(c, c, r - i * 1.4 * k * (heavy ? (r / k - 3) / (1.4 * 4) / ((q.d / 2 - 3) / 1.4) : 1), heavy ? W.vis : 0.8);
  out += C(c, c, 2.2 * k, heavy ? W.vis : W.mid, '#fff');       // hub
  // 2 leads out, pads
  if (!heavy) {
    out += L(c + r, c, c + r + 2.5 * k, c, W.mid) + pad(c + r + 3.6 * k, c, 1.1 * k);
    out += L(c + r * 0.2, c - 2.2 * k, c + r + 2.5 * k, c - 2.2 * k, W.mid) + pad(c + r + 3.6 * k, c - 2.2 * k, 1.1 * k);
  }
  return frame(2 * c + (heavy ? 0 : 5 * k), 2 * c, out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 48 }); }
export function binGlyph() { return thumb({ d: 24 }); }

// ── wire contract: the loom lands on the outer lead pad ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k, c = r + 3 * k;
  return { x: c + r + 3.6 * k, y: c };
}
