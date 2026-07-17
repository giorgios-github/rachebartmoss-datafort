// parts/interface/dial.js — knob Ø QUANTISED, knurl + detent ticks COUNTED, D-shaft FIXED.
import { L, C, RC, TX, frame, fitK, W, DASH, G, knurl, QUANT, flangeV, pad } from '../lib.js';
const SIZES = [12, 16, 22];                                   // QUANTISED knob Ø mm

export const meta = {
  id: 'dial', bin: 'INTERFACE', label: 'DIAL',
  params: { d: { def: 16, stock: SIZES }, detents: { def: 11, min: 0, max: 24 }, side: { def: false, note: 'side elevation' } },
  slots: [],
  functions: { provides: ['input'], needs: [], rates: { detents: 11 } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.02 },
  pushedDraw: ['+1: stop pin removed — sweep arc extends past MAX tick, drawn PH'],
  graftsInto: ['OVERDRIVE/governor trim seat (reducer bushing)'],
  variants: [
    { label: 'Ø16 · 11 DETENTS', p: {} },
    { label: 'Ø22 · 24 DETENTS', p: { d: 22, detents: 24 } },
    { label: 'Ø12 · SMOOTH', p: { d: 12, detents: 0 } },
    { label: 'Ø16 · TRAVERSANT', p: { side: true } },
    { label: 'Ø16 · EXT SEUL', p: { side: 'exterior' } },
    { label: 'Ø22 · TRAVERSANT', p: { d: 22, side: true } },
    { label: 'Ø22 · EXT SEUL', p: { d: 22, side: 'exterior' } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 16, SIZES), detents: Math.max(0, Math.min(24, p?.detents ?? 11)), side: p?.side === 'exterior' ? 'exterior' : !!p?.side });

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2;
  if (q.side) {
    // profile: cable origin inside + flange signal; knob outside. 'exterior' = knob alone.
    const k = view.k ?? fitK(26, q.d + 8, view.fit ?? 130), heavy = view.lod === 'thumb';
    const kh = q.d * k * 0.9, kw2 = q.d * 0.5 * k, cy = kh / 2 + 3 * k;
    const ext = q.side === 'exterior';
    let out = '', x = 3 * k;
    if (!ext) {
      out += pad(x + 1.1 * k, cy, 1.1 * k);                                           // cable origin (organ-side pad)
      out += L(x + 2.2 * k, cy, x + 3.4 * k, cy, heavy ? W.vis : W.mid);              // lead to the wall
      x += 3.4 * k;
      out += flangeV(x, cy, kh * 0.28, k, heavy);
      x += 1.8 * k;
    }
    out += RC(x, cy - kh / 2, kw2, kh, W.cut, '#fff');                                // knob profile
    const n = Math.max(5, Math.round(kh / (1.8 * k)));
    for (let i = 1; i < n; i++) out += L(x + 0.5 * k, cy - kh / 2 + kh * i / n, x + kw2 - 0.5 * k, cy - kh / 2 + kh * i / n, 0.7); // knurl
    out += L(x + kw2, cy, x + kw2 + 1.4 * k, cy, W.cut);                              // pointer
    if (dens >= 3) out += TX(x + kw2 / 2, cy + kh / 2 + 12, ext ? 'EXT SEUL' : 'TRAVERSANT', 8);
    return frame(x + kw2 + 4 * k, cy + kh / 2 + (dens >= 3 ? 14 : 4), out);
  }  const k = view.k ?? fitK(q.d + 10, q.d + 10, view.fit ?? 150);
  const r = q.d / 2 * k, cx = r + 5 * k, cy = r + 5 * k;
  let out = C(cx, cy, r, W.vis, '#fff');
  out += knurl(cx, cy, r, 1.8 * k, 2.2 * k * 0.55, 0.7);      // knurl COUNTED @ FIXED 1.8mm arc
  out += C(cx, cy, r * 0.55, W.fine);                          // skirt
  // D-shaft
  out += C(cx, cy, 3 * k / 2, W.mid, '#fff') + L(cx - 1.1 * k, cy - 1 * k, cx + 1.1 * k, cy - 1 * k, W.mid);
  // pointer at 40% of a 270° sweep from SW
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, a = a0 + 0.4 * sweep;
  out += L(cx + r * 0.55 * Math.cos(a), cy + r * 0.55 * Math.sin(a), cx + r * 0.96 * Math.cos(a), cy + r * 0.96 * Math.sin(a), W.cut);
  // panel detent ticks COUNTED over the sweep
  if (q.detents > 0) for (let i = 0; i < q.detents; i++) {
    const ai = a0 + sweep * i / (q.detents - 1 || 1);
    const major = i === 0 || i === q.detents - 1;
    out += L(cx + (r + 1 * k) * Math.cos(ai), cy + (r + 1 * k) * Math.sin(ai), cx + (r + (major ? 2.6 : 1.9) * k) * Math.cos(ai), cy + (r + (major ? 2.6 : 1.9) * k) * Math.sin(ai), major ? W.mid : 0.7);
  }
  if (dens >= 3 && q.detents > 0) {
    out += TX(cx + (r + 4.4 * k) * Math.cos(a0), cy + (r + 4.4 * k) * Math.sin(a0) + 3, 'MIN', 8);
    out += TX(cx + (r + 4.4 * k) * Math.cos(a0 + sweep), cy + (r + 4.4 * k) * Math.sin(a0 + sweep) + 3, 'MAX', 8);
  }
  return frame(2 * cx, 2 * cy, out, 2);
}
export function thumb(p) {
  const q = norm(p ?? {});
  if (q.side) return draw(q, { lod: 'thumb', density: 1, fit: 56 });
  const k = 44 / (q.d + 6), r = q.d / 2 * k, c = r + 3 * k;
  const a = Math.PI * 0.75 + 0.4 * Math.PI * 1.5;
  let out = C(c, c, r, W.cut, '#fff') + knurl(c, c, r, 2.6 * k, 2 * k, 1.1);
  out += L(c, c, c + r * 0.92 * Math.cos(a), c + r * 0.92 * Math.sin(a), 3.4);
  return frame(2 * c, 2 * c, out, 3);
}
export function binGlyph() { return thumb({ d: 16 }); }

// ── mounting contract (trans-paroi profile: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const kh = q.d * k * 0.9, cy = kh / 2 + 3 * k;
  if (q.side === 'exterior' || view.exterior) return { x: 3 * k, y: cy, axis: 'x' };
  return { x: 3 * k + 3.4 * k + 0.9 * k, y: cy, axis: 'x' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: 3 * k + 1.1 * k, y: q.d * k * 0.45 + 3 * k };
}
