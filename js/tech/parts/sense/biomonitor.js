// parts/sense/biomonitor.js — skin pad: electrode pair, elastomer skirt, lead pair.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, pad } from '../lib.js';
const SIZES = [{ w: 22, h: 14 }, { w: 30, h: 18 }];           // QUANTISED

export const meta = {
  id: 'biomonitor', bin: 'SENSE', label: 'BIOMONITOR',
  params: { size: { def: 0, options: [0, 1] }, electrodes: { def: 2, options: [2, 3] } },
  slots: [],
  functions: { provides: ['sense-bio'], needs: ['power'], rates: { electrodes: 2 } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.05 },
  pushedDraw: ['+1: gain push — third electrode demanded (reference)'],
  graftsInto: ['INTERFACE/haptic pad cuff (adapter plate — same skirt family)'],
  variants: [
    { label: '22×14 · 2 EL', p: {} },
    { label: '30×18 · 3 EL', p: { size: 1, electrodes: 3 } },
    { label: '22×14 · 3 EL', p: { electrodes: 3 } }
  ]
};
const norm = p => ({ ...SIZES[p?.size === 1 ? 1 : 0], electrodes: p?.electrodes === 3 ? 3 : 2 });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.w, q.h + 5, view.fit ?? 140);
  const wpx = q.w * k, hpx = q.h * k, r = 2.5 * k;
  let out = RC(0, 0, wpx, hpx, heavy ? W.cut : W.vis, '#fff', null, r);
  // elastomer skirt band (soft part law: POT hatch, no fasteners)
  if (!heavy) out += RC(1.4 * k, 1.4 * k, wpx - 2.8 * k, hpx - 2.8 * k, 0.7, 'none', '3 2', r * 0.6);
  // electrodes COUNTED: discs in a row
  const n = q.electrodes, re = Math.min(hpx * 0.26, wpx / (2.6 * n));
  for (let i = 0; i < n; i++) {
    const ex = wpx * (i + 1) / (n + 1), ey = hpx / 2;
    out += C(ex, ey, re, heavy ? W.vis : W.mid, '#fff') + C(ex, ey, re * 0.4, heavy ? 1.6 : 0.8);
  }
  // lead pair exits right with strain notch
  if (!heavy) {
    out += L(wpx, hpx * 0.4, wpx + 2.6 * k, hpx * 0.4, W.mid) + L(wpx, hpx * 0.6, wpx + 2.6 * k, hpx * 0.6, W.mid);
    out += pad(wpx + 3.8 * k, hpx * 0.4, 1 * k) + pad(wpx + 3.8 * k, hpx * 0.6, 1 * k);
    if (dens >= 3) out += TX(wpx / 2, hpx + 12, `${n} ELECTRODES · SKIN SIDE DOWN`, 8);
  }
  return frame(wpx + (heavy ? 0 : 5.4 * k), hpx + (dens >= 3 && !heavy ? 16 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 48 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the lead pair pads ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: q.w * k + 3.8 * k, y: q.h * k * 0.4 };
}
