// parts/act/linear-actuator.js — tube + rod + clevis; extended throw drawn PH.
// mounted=true: flange signal (emitter grammar) inserted where the rod crosses the wall.
// mounted='exterior': ONLY the emerged rod + clevis, no signal.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, pad, flangeV } from '../lib.js';
const STROKES = [10, 20, 40];                                 // QUANTISED mm

export const meta = {
  id: 'linear-actuator', bin: 'ACT', label: 'LINEAR ACTUATOR',
  params: { stroke: { def: 20, stock: STROKES }, mounted: { def: false, note: "true = flange signal before the rod; 'exterior' = rod + clevis only" } },
  slots: [],
  functions: { provides: ['actuate-linear'], needs: ['power', 'control'], rates: { stroke: 20 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.12 },
  pushedDraw: ['+1: overvolt — force up, duty stencil struck', '+2: end-stop bypass — PH throw extends past clevis stop, jam flag'],
  graftsInto: ['ACT/injector plunger seat (reducer bushing)'],
  variants: [
    { label: 'STROKE 20', p: {} },
    { label: 'STROKE 40', p: { stroke: 40 } },
    { label: 'TRAVERSANT — BRAS + CORPS', p: { mounted: true } },
    { label: 'EXT SEUL — BRAS', p: { mounted: 'exterior' } },
    { label: 'STROKE 40 · TRAVERSANT', p: { stroke: 40, mounted: true } },
    { label: 'STROKE 40 · EXT SEUL', p: { stroke: 40, mounted: 'exterior' } }
  ]
};
const norm = p => ({ stroke: QUANT.snap(p?.stroke ?? 20, STROKES), mounted: p?.mounted === 'exterior' ? 'exterior' : !!p?.mounted });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const ext = q.mounted === 'exterior', sig = q.mounted === true;
  const bodyL = q.stroke * 1.4 + 12, D = 8;                   // body from stroke, Ø FIXED
  const k = view.k ?? fitK((ext ? 6 : bodyL) + q.stroke + 12, D + 6, view.fit ?? (ext ? 110 : 170));
  const y0 = 2 * k, hpx = D * k, x0 = 3 * k, bl = ext ? 0 : bodyL * k;
  const ry = y0 + hpx / 2;
  let out = '';
  if (!ext) {
    out += RC(x0, y0, bl, hpx, heavy ? W.cut : W.vis, '#fff');
    out += L(x0 + bl * 0.25, y0, x0 + bl * 0.25, y0 + hpx, heavy ? 1.4 : 0.7, heavy ? null : DASH.hl); // motor cap
    out += C(x0 - 1.6 * k, ry, 1.6 * k, heavy ? W.cut : W.vis, '#fff') + C(x0 - 1.6 * k, ry, 0.7 * k, heavy ? W.vis : W.mid); // rear lug
    if (!heavy) out += pad(x0 + bl * 0.12, y0 - 1.6 * k, 1 * k);
  }
  let rx = x0 + bl;
  if (sig) { out += flangeV(rx, ry, hpx / 2 + 0.4 * k, k, heavy); rx += 1.8 * k; }    // wall-crossing signal, in-drawing
  const rodOut = 4 * k;
  out += RC(rx, ry - 1.2 * k, rodOut, 2.4 * k, heavy ? W.vis : W.mid, '#fff');        // rod, retracted
  if (!heavy) out += RC(rx, ry - 1.2 * k, rodOut + q.stroke * k, 2.4 * k, 0.7, 'none', DASH.ph); // throw PH
  const cxE = rx + rodOut + 2 * k;
  out += C(cxE, ry, 1.8 * k, heavy ? W.cut : W.vis, '#fff') + C(cxE, ry, 0.8 * k, heavy ? W.vis : W.mid); // clevis
  if (!heavy) out += `<circle cx="${(cxE + q.stroke * k).toFixed(1)}" cy="${ry.toFixed(1)}" r="${(1.8 * k).toFixed(1)}" fill="none" stroke="#111" stroke-width="0.7" stroke-dasharray="${DASH.ph}"/>`;
  if (!heavy && dens >= 3) {
    if (!ext) out += L(rx + rodOut, y0 + hpx + 2.2 * k, cxE + q.stroke * k, y0 + hpx + 2.2 * k, 0.7) + TX(rx + (rodOut + q.stroke * k) / 2, y0 + hpx + 2.2 * k + 10, `THROW ${q.stroke}`, 8);
    else out += TX(cxE, y0 + hpx + 12, 'EXT SEUL', 8);
  }
  return frame(cxE + q.stroke * k + 3 * k, y0 + hpx + (dens >= 3 && !heavy ? 4.4 * k + 8 : 2 * k), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 56 }); }
export function binGlyph() { return thumb({ stroke: 20 }); }

// ── mounting contract (trans-paroi: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const ry = 2 * k + 4 * k;
  if (q.mounted === 'exterior' || view.exterior) return { x: 3 * k, y: ry, axis: 'x' };
  const bodyL = q.stroke * 1.4 + 12;
  return { x: 3 * k + bodyL * k + 0.9 * k, y: ry, axis: 'x' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const bodyL = q.stroke * 1.4 + 12;
  return { x: 3 * k + bodyL * k * 0.12, y: 2 * k - 1.6 * k };
}
