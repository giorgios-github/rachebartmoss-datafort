// parts/power/thermo-gen.js — TEG sandwich: hot plate / junction grid COUNTED / fin stack.
import { L, C, RC, TX, frame, fitK, W, QUANT, pad } from '../lib.js';
const SIZES = [15, 20, 30];                                   // QUANTISED square mm

export const meta = {
  id: 'thermo-gen', bin: 'POWER', label: 'THERMO-GEN',
  params: { s: { def: 20, stock: SIZES } },
  slots: [],
  functions: { provides: ['generate-power'], needs: ['heat (host)'], rates: { watts: 'ΔT-bound' } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.18 },
  pushedDraw: ['+1: ΔT forced — fin count doubled (COUNTED)', '+2: junction stress — strap across sandwich demanded'],
  graftsInto: ['OVERDRIVE/graft-heatsink stack (shim set)'],
  variants: [
    { label: '15 MM', p: { s: 15 } },
    { label: '20 MM', p: {} },
    { label: '30 MM', p: { s: 30 } }
  ]
};
const norm = p => ({ s: QUANT.snap(p?.s ?? 20, SIZES) });

// side elevation: the sandwich IS the identity
export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.s + 4, q.s * 0.9, view.fit ?? 130);
  const wpx = q.s * k;
  const hotH = 2 * k, jH = 4 * k, coldH = 2 * k, finH = q.s * 0.32 * k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  let out = '';
  let y = 0;
  out += RC(0, y, wpx, hotH, swB, heavy ? '#fff' : 'url(#f45)'); y += hotH;      // hot shoe
  // junction grid: columns COUNTED at FIXED 2.5 mm
  const n = Math.max(3, Math.floor(q.s / 2.5));
  out += RC(0, y, wpx, jH, swM, '#fff');
  for (let i = 1; i < n; i++) out += L(wpx * i / n, y, wpx * i / n, y + jH, heavy ? 1.6 : 0.8);
  y += jH;
  out += RC(0, y, wpx, coldH, swB, '#fff'); y += coldH;                           // cold shoe
  // fin stack COUNTED at FIXED pitch 2.2
  const nf = Math.max(4, Math.floor(q.s / 2.2));
  for (let i = 0; i <= nf; i++) out += L(wpx * i / nf, y, wpx * i / nf, y + finH, swM);
  out += L(0, y, 0, y + finH, swB) + L(wpx, y, wpx, y + finH, swB) + L(0, y + finH, wpx, y + finH, swM);
  // leads from junction layer
  if (!heavy) {
    out += L(wpx, hotH + jH / 2, wpx + 2.4 * k, hotH + jH / 2, W.mid) + pad(wpx + 3.4 * k, hotH + jH / 2, 1 * k);
    if (dens >= 3) out += TX(wpx / 2, y + finH + 11, 'HOT SIDE UP', 8);
  }
  return frame(wpx + (heavy ? 0 : 5 * k), y + finH + (dens >= 3 && !heavy ? 14 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({ s: 20 }); }

// ── wire contract: the loom lands on the junction lead pad ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: q.s * k + 3.4 * k, y: 2 * k + 2 * k };
}
