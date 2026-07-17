// parts/overdrive/bypass-shunt.js — hot-wire: oversized busbar jumper, ring lugs,
// double tie-down. Oversize IS the tell (no wear, no scorch — design language only).
import { L, C, RC, TX, POLY, frame, fitK, W, QUANT } from '../lib.js';
const GAUGES = [3, 5, 8];                                     // QUANTISED bar width mm

export const meta = {
  id: 'bypass-shunt', bin: 'OVERDRIVE', label: 'BYPASS SHUNT',
  params: { gauge: { def: 5, stock: GAUGES }, span: { def: 16 } },
  slots: [],
  functions: { provides: ['condition-power (bypass — defeats the limiter path)'], needs: [], rates: { gauge: 5 } },
  envelope: { rated: 3, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['a shunt IS a push made permanent — it has no further register'],
  graftsInto: ['across any fuse/breaker or governor seat (ring lugs under the retention screws)'],
  variants: [
    { label: 'GAUGE 5 · SPAN 16', p: {} },
    { label: 'GAUGE 8', p: { gauge: 8 } },
    { label: 'GAUGE 3 · SPAN 12', p: { gauge: 3, span: 12 } }
  ]
};
const norm = p => ({ gauge: QUANT.snap(p?.gauge ?? 5, GAUGES), span: p?.span ?? 16 });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.span + 14, q.gauge + 14, view.fit ?? 80);
  const bw = q.gauge * k, span = q.span * k, y0 = 5 * k;
  const lugR = (q.gauge / 2 + 2) * k;
  let out = '';
  // busbar: raised bridge (two 45° jogs — the loom bend law applies to bars too)
  const yTop = y0 - 2.5 * k;
  out += POLY([[lugR, y0], [lugR + 3 * k, yTop], [lugR + span - 3 * k, yTop], [lugR + span, y0]], heavy ? W.cut : W.vis, false);
  out += POLY([[lugR, y0 + bw], [lugR + 3 * k, yTop + bw], [lugR + span - 3 * k, yTop + bw], [lugR + span, y0 + bw]], heavy ? W.cut : W.vis, false);
  // ring lugs both ends
  for (const cx of [lugR, lugR + span]) {
    out += C(cx, y0 + bw / 2, lugR, heavy ? W.cut : W.vis, '#fff');
    out += C(cx, y0 + bw / 2, lugR * 0.42, heavy ? W.vis : W.mid);
  }
  // double tie-down ticks mid-span (cable-tie witness ×2 — COUNTED, always 2)
  if (!heavy) for (const t of [0.42, 0.58]) {
    const tx = lugR + span * t;
    out += L(tx, yTop - 1.2 * k, tx, yTop + bw + 1.2 * k, W.mid);
    out += RC(tx - 0.8 * k, yTop - 2.4 * k, 1.6 * k, 1.2 * k, W.fine, '#fff');
  }
  if (dens >= 3 && !heavy) out += TX(lugR + span / 2, y0 + bw + lugR + 10, `GAUGE ${q.gauge}`, 8);
  return frame(2 * lugR + span, y0 + bw + lugR + (dens >= 3 && !heavy ? 14 : 2), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 54 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the near ring lug ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const lugR = (q.gauge / 2 + 2) * k;
  return { x: lugR, y: 5 * k + q.gauge * k / 2 };
}
