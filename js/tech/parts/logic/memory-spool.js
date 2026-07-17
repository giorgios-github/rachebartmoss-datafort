// parts/logic/memory-spool.js — wound-tape archive: turns hatch, tangent tape exit.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, keyPin } from '../lib.js';
const SIZES = [14, 20, 28];                                   // QUANTISED Ø mm

export const meta = {
  id: 'memory-spool', bin: 'LOGIC', label: 'MEMORY SPOOL',
  params: { d: { def: 20, stock: SIZES }, fill: { def: 0.7 } },
  slots: [],
  functions: { provides: ['store-data'], needs: ['control'], rates: { fill: '0–1 drawn as wound band' } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.05 },
  pushedDraw: ['+1: read overspeed — brake shoe demanded at rim'],
  graftsInto: ['STORE/vessel bay (reducer bushing)'],
  variants: [
    { label: 'Ø20 · 70%', p: {} },
    { label: 'Ø28 · FULL', p: { d: 28, fill: 1 } },
    { label: 'Ø14 · 25%', p: { d: 14, fill: 0.25 } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 20, SIZES), fill: Math.max(0.1, Math.min(1, p?.fill ?? 0.7)) });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.d + 10, q.d + 4, view.fit ?? 140);
  const r = q.d / 2 * k, c = r + 2 * k;
  const rHub = 3 * k, rWound = rHub + (r - 0.4 * k - rHub) * q.fill;
  let out = C(c, c, r, heavy ? W.cut : W.vis, '#fff');          // flange
  // wound band: annulus hatched fine
  out += `<path d="M${(c + rWound).toFixed(2)},${c.toFixed(2)} A${rWound.toFixed(2)},${rWound.toFixed(2)} 0 1 0 ${(c - rWound).toFixed(2)},${c.toFixed(2)} A${rWound.toFixed(2)},${rWound.toFixed(2)} 0 1 0 ${(c + rWound).toFixed(2)},${c.toFixed(2)} Z M${(c + rHub).toFixed(2)},${c.toFixed(2)} A${rHub.toFixed(2)},${rHub.toFixed(2)} 0 1 1 ${(c - rHub).toFixed(2)},${c.toFixed(2)} A${rHub.toFixed(2)},${rHub.toFixed(2)} 0 1 1 ${(c + rHub).toFixed(2)},${c.toFixed(2)} Z" fill="${heavy ? '#111' : 'url(#pot)'}" fill-rule="evenodd" stroke="none"/>`;
  out += C(c, c, rWound, heavy ? 0 : W.mid);                    // crisp circular band edge
  // hub: drive cross
  out += C(c, c, rHub, heavy ? W.vis : W.mid, '#fff');
  out += L(c - rHub * 0.5, c, c + rHub * 0.5, c, heavy ? 1.6 : 0.8) + L(c, c - rHub * 0.5, c, c + rHub * 0.5, heavy ? 1.6 : 0.8);
  // tape exit tangent to head block
  if (!heavy) {
    out += L(c, c - rWound, c + r + 3.5 * k, c - rWound, W.mid);
    out += RC(c + r + 3.5 * k, c - rWound - 2 * k, 3 * k, 4 * k, W.mid, '#fff');  // head block
    out += keyPin(c + r + 5 * k, c - rWound + 4.6 * k, 3.6 * k);
    if (dens >= 3) out += TX(c, c + r + 12, `${Math.round(q.fill * 100)}% WOUND`, 8);
  }
  return frame(2 * c + (heavy ? 0 : 7 * k), 2 * c + (dens >= 3 && !heavy ? 14 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({ d: 20 }); }

// ── wire contract: the loom lands on the head-block key pin ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k, c = r + 2 * k;
  const rHub = 3 * k, rWound = rHub + (r - 0.4 * k - rHub) * q.fill;
  return { x: c + r + 5 * k, y: c - rWound + 4.6 * k };
}
