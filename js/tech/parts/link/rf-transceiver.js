// parts/link/rf-transceiver.js — the LINK organ with an ANTENNA PORT slot (accepts LINK/antenna).
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, keyPin, seat, flangeH } from '../lib.js';
import * as ant from './antenna.js';
const BANDS = { LB: [26, 18], MB: [22, 16], HB: [18, 14] };   // QUANTISED dims by band

export const meta = {
  id: 'rf-transceiver', bin: 'LINK', label: 'RF TRANSCEIVER',
  params: {
    band: { def: 'MB', options: ['LB', 'MB', 'HB'] },
    antenna: { def: 'empty', options: ['empty', 'stub', 'whip'] },
    mounted: { def: false, note: 'trans-boîtier: only the antenna port shows outside' }
  },
  slots: [{ id: 'ant0', accepts: 'LINK/antenna', keying: 'threaded feed collar', param: 'antenna' }],
  functions: { provides: ['link-rf'], needs: ['power', 'control'], rates: { band: 'LB/MB/HB' }, latent: ['factory telemetry beacon (CORP PULL only)'] },
  envelope: { rated: 1, pushMax: 3, instabilityPerPush: 0.16 },
  pushedDraw: ['+1: PA overdrive — shield can demanded over the PA corner', '+2: graft heatsink on the can', '+3: duty pushed — fuse demanded in the feed, stencil struck'],
  graftsInto: ['SENSE/em-probe stub seat (pigtail converter — RX only)'],
  variants: [
    { label: 'MB · ANT PORT EMPTY', p: {} },
    { label: 'MB · STUB SEATED', p: { antenna: 'stub' } },
    { label: 'LB · WHIP SEATED', p: { band: 'LB', antenna: 'whip' } },
    { label: 'TRAVERSANT — PORT', p: { mounted: true, antenna: 'stub' } },
    { label: 'EXT SEUL — PORT + STUB', p: { mounted: 'exterior', antenna: 'stub' } },
    { label: 'EXT SEUL — PORT VIDE', p: { mounted: 'exterior' } },
    { label: 'EXT SEUL — PORT + WHIP', p: { mounted: 'exterior', antenna: 'whip' } }
  ]
};
const norm = p => ({ band: BANDS[p?.band] ? p.band : 'MB', antenna: ['stub', 'whip'].includes(p?.antenna) ? p.antenna : 'empty', mounted: p?.mounted === 'exterior' ? 'exterior' : !!p?.mounted });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted === 'exterior') {
    // EXT SEUL: the antenna port exactly as drawn on the can — nothing else
    const k = view.k ?? fitK(16, q.antenna === 'whip' ? 26 : 18, view.fit ?? 110);
    const ax = 8 * k, pb = (q.antenna === 'whip' ? 22 : 15) * k;
    let out = RC(ax - 2.8 * k, pb - 3 * k, 5.6 * k, 3 * k, W.mid, '#fff');
    for (let i = 1; i <= 2; i++) out += L(ax - 2.8 * k, pb - i * k, ax + 2.8 * k, pb - i * k, 0.7);
    if (q.antenna === 'empty') out += L(ax, pb - 3 * k, ax, pb - 6.5 * k, W.mid, DASH.hl);
    else if (q.antenna === 'stub') {
      out += RC(ax - 1.6 * k, pb - 13 * k, 3.2 * k, 10 * k, W.vis, '#fff', null, 1.4 * k);
      for (let i = 1; i <= 2; i++) out += L(ax - 1.6 * k, pb - 13 * k + 10 * k * i / 3, ax + 1.6 * k, pb - 13 * k + 10 * k * i / 3, 0.6);
    } else {
      out += L(ax, pb - 3 * k, ax, pb - 20 * k, W.vis);
      out += RC(ax - 0.8 * k, pb - 12 * k, 1.6 * k, 1.5 * k, W.mid, '#fff');
      out += C(ax, pb - 20 * k, 1.1 * k, W.mid, '#fff');
    }
    if (dens >= 3) out += TX(ax, pb + 12, 'EXT SEUL', 8);
    return frame(2 * ax, pb + (dens >= 3 ? 14 : 4), out);
  }
    const [Wm, Hm] = BANDS[q.band];
  const k = view.k ?? fitK(Wm + 8, Hm + (q.antenna === 'empty' ? 8 : 16), view.fit ?? 165);
  const lift = q.mounted === true ? 1.8 * k : 0;
  const wpx = Wm * k, hpx = Hm * k, top = (q.antenna === 'empty' ? 7 : q.antenna === 'whip' ? 22 : 14) * k + lift;
  let out = RC(0, top, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
  // PA corner: hatched strip (the hot quarter)
  out += RC(wpx * 0.62, top + 1 * k, wpx * 0.34, hpx * 0.36, heavy ? W.vis : W.mid, heavy ? '#fff' : 'url(#f45)');
  // synth crystal + IC witness
  if (!heavy) {
    out += RC(wpx * 0.08, top + hpx * 0.14, wpx * 0.2, hpx * 0.22, W.mid, '#fff', null, 2);
    out += RC(wpx * 0.12, top + hpx * 0.52, wpx * 0.3, hpx * 0.3, W.mid, '#fff');
    out += C(wpx * 0.14, top + hpx * 0.55, 0.4 * k, 0, '#111');
  }
  // ANTENNA PORT (the slot): threaded collar on top edge
  const ax = wpx * 0.78, pb = top - lift;
  if (q.mounted === true) out += flangeH(ax, top - lift, 2.8 * k, k, heavy);          // wall-crossing signal, in-drawing
  out += RC(ax - 2.8 * k, pb - 3 * k, 5.6 * k, 3 * k, heavy ? W.vis : W.mid, '#fff');
  for (let i = 1; i <= 2; i++) out += L(ax - 2.8 * k, pb - i * k, ax + 2.8 * k, pb - i * k, heavy ? 1.2 : 0.7);
  if (q.antenna === 'empty') {
    // lawful empty seat: dashed radiator ghost + keying note
    out += L(ax, pb - 3 * k, ax, pb - 6.5 * k, W.mid, DASH.hl);
    if (dens >= 3 && !heavy) out += TX(ax, pb - 8 * k, 'ANT PORT · LINK', 7.5, 'end');
  } else if (q.antenna === 'stub') {
    out += RC(ax - 1.6 * k, pb - 13 * k, 3.2 * k, 10 * k, heavy ? W.cut : W.vis, '#fff', null, 1.4 * k);
    if (!heavy) for (let i = 1; i <= 2; i++) out += L(ax - 1.6 * k, pb - 13 * k + 10 * k * i / 3, ax + 1.6 * k, pb - 13 * k + 10 * k * i / 3, 0.6);
  } else {
    out += L(ax, pb - 3 * k, ax, pb - 20 * k, heavy ? W.cut : W.vis);
    out += RC(ax - 0.8 * k, pb - 12 * k, 1.6 * k, 1.5 * k, heavy ? W.vis : W.mid, '#fff');
    out += C(ax, pb - 20 * k, heavy ? 2 : 1.1 * k, heavy ? W.vis : W.mid, '#fff');
  }
  // power/data keyed pins on the left
  if (!heavy) { out += keyPin(-2.2 * k, top + hpx * 0.32, 4 * k) + keyPin(-2.2 * k, top + hpx * 0.68, 4 * k); }
  return frame(wpx + (heavy ? 0 : 6 * k), top + hpx + 2, heavy ? out : `<g transform="translate(${(4.5 * k).toFixed(1)},0)">${out}</g>`);
}
export function thumb(p) { return draw(norm(p ?? { antenna: 'whip' }), { lod: 'thumb', density: 1, fit: 52 }); }
export function binGlyph() { return thumb({ antenna: 'whip' }); }

// ── mounting contract (trans-paroi: the antenna port crosses; outward = local -y) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.mounted === 'exterior' || view.exterior) {
    const pb = (q.antenna === 'whip' ? 22 : 15) * k;
    return { x: 8 * k, y: pb - 1.5 * k, axis: '-y' };
  }
  const lift = 1.8 * k;                                       // full profile is the TRAVERSANT state
  const top = (q.antenna === 'empty' ? 7 : q.antenna === 'whip' ? 22 : 14) * k + lift;
  const [Wm] = BANDS[q.band];
  return { x: 4.5 * k + Wm * k * 0.78, y: top - lift + 0.9 * k, axis: '-y' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const lift = q.mounted === true ? 1.8 * k : 0;
  const top = (q.antenna === 'empty' ? 7 : q.antenna === 'whip' ? 22 : 14) * k + lift;
  const [, Hm] = BANDS[q.band];
  return { x: 4.5 * k - 2.2 * k, y: top + Hm * k * 0.32 };
}
