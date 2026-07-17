// parts/link/neural-jack.js — the interface port: keyed barrel, pin ring COUNTED, locking collar.
import { L, C, RC, TX, frame, fitK, W, G, QUANT, knurl } from '../lib.js';
const PINS = [8, 12, 20];                                     // QUANTISED contact count

export const meta = {
  id: 'neural-jack', bin: 'LINK', label: 'NEURAL JACK',
  params: { pins: { def: 12, stock: PINS }, locking: { def: true } },
  slots: [],
  functions: { provides: ['link-neural'], needs: ['power'], rates: { pins: 12 } },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable: signal-integrity part — pushing a jack means grafting a booster BEHIND it, never altering the interface'],
  graftsInto: ['never — the jack IS the standard; everything else grafts onto IT'],
  variants: [
    { label: '12-PIN · LOCKING', p: {} },
    { label: '20-PIN', p: { pins: 20 } },
    { label: '8-PIN · FRICTION', p: { pins: 8, locking: false } }
  ]
};
const norm = p => ({ pins: QUANT.snap(p?.pins ?? 12, PINS), locking: p?.locking !== false });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const D = q.pins <= 8 ? 9 : q.pins <= 12 ? 11 : 14;         // QUANTISED barrel Ø from pins
  const k = view.k ?? fitK(D + 8, D + 8, view.fit ?? 120);
  const r = D / 2 * k, c = r + 4 * k;
  let out = '';
  if (q.locking) { out += C(c, c, r + 2 * k, heavy ? W.vis : W.mid, '#fff'); out += knurl(c, c, r + 2 * k, 2 * k, 1.4 * k, heavy ? 1.1 : 0.7); } // collar
  out += C(c, c, r, heavy ? W.cut : W.vis, '#fff');            // barrel
  out += C(c, c, r * 0.72, heavy ? W.vis : W.mid);             // shroud
  // key nub (orientation is law)
  out += RC(c - 0.8 * k, c - r - 0.6 * k, 1.6 * k, 1.8 * k, heavy ? W.vis : W.mid, '#fff');
  // contact ring COUNTED
  const n = heavy ? 6 : q.pins, rp = r * 0.5;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + G.TAU * i / n;
    out += C(c + rp * Math.cos(a), c + rp * Math.sin(a), heavy ? 1.6 : 0.5 * k, heavy ? 0 : 0.7, heavy ? '#111' : 'none');
  }
  out += C(c, c, 0.9 * k, heavy ? W.vis : W.mid, '#fff');      // centre spigot
  if (dens >= 3 && !heavy) out += TX(c, 2 * c + 8, `${q.pins}-PIN · KEYED${q.locking ? ' · TWIST-LOCK' : ''}`, 8);
  return frame(2 * c, 2 * c + (dens >= 3 && !heavy ? 12 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 44 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands behind the centre spigot ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const D = q.pins <= 8 ? 9 : q.pins <= 12 ? 11 : 14;
  const c = D / 2 * k + 4 * k;
  return { x: c, y: c };
}
