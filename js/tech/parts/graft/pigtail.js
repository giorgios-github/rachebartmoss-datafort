// parts/graft/pigtail.js — connector converter: keyed pin A ← lead → keyed pin B (smaller).
import { L, C, RC, TX, frame, fitK, W, QUANT, keyPin, pad } from '../lib.js';

export const meta = {
  id: 'pigtail', bin: 'GRAFT', label: 'PIGTAIL CONVERTER',
  params: { fromS: { def: 6, stock: [5, 6] }, toS: { def: 4, stock: [3.6, 4] } },
  slots: [],
  functions: { provides: ['pass-signal (family A ⇄ family B)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['unpushable — a chain of pigtails is the drawing (each hop halves your dignity)'],
  graftsInto: ['between any two keyed-pin families; the inline lump is the tell'],
  variants: [
    { label: '6 → 4', p: {} },
    { label: '5 → 3.6', p: { fromS: 5, toS: 3.6 } },
    { label: '6 → 4 · DOUBLED', p: { doubled: true } }
  ]
};
const norm = p => ({ fromS: QUANT.snap(p?.fromS ?? 6, [5, 6]), toS: QUANT.snap(p?.toS ?? 4, [3.6, 4]), doubled: !!p?.doubled });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(34, 14, view.fit ?? 150);
  const y = 6 * k, x0 = 5 * k, span = 22 * k;
  let out = keyPin(x0, y, q.fromS * k);
  // lead with one lawful 45° jog + moulded inline converter lump
  out += L(x0 + q.fromS * k / 2, y, x0 + span * 0.3, y, heavy ? W.vis : W.mid);
  out += L(x0 + span * 0.3, y, x0 + span * 0.42, y - 2 * k, heavy ? W.vis : W.mid);
  out += RC(x0 + span * 0.42, y - 2 * k - 1.6 * k, span * 0.18, 3.2 * k, heavy ? W.cut : W.vis, '#fff', null, 1 * k); // converter lump
  out += L(x0 + span * 0.6, y - 2 * k, x0 + span * 0.72, y, heavy ? W.vis : W.mid);
  out += L(x0 + span * 0.72, y, x0 + span - q.toS * k / 2, y, heavy ? W.vis : W.mid);
  out += keyPin(x0 + span, y, q.toS * k);
  if (q.doubled && !heavy) { // second pigtail chained — the shame drawing
    out += L(x0 + span + q.toS * k / 2, y, x0 + span + 4 * k, y, W.mid);
    out += keyPin(x0 + span + 6 * k, y, q.fromS * 0.8 * k);
  }
  if (dens >= 3 && !heavy) out += TX(x0 + span / 2, y + 5 * k + 6, `KEY ${q.fromS} ⇄ KEY ${q.toS} · LUMP = TELL`, 8);
  return frame(x0 + span + (q.doubled ? 10 * k : 5 * k), y + 5 * k + (dens >= 3 && !heavy ? 10 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 56 }); }
export function binGlyph() { return thumb({}); }
