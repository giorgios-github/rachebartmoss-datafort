// parts/logic/crypto-module.js — potted brick: tamper mesh border, keyed pins only,
// no window. Carries the catalogue's exemplar LATENT function.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, keyPin } from '../lib.js';
const DIMS = { 1: [18, 12], 2: [24, 16] };                    // QUANTISED grade

export const meta = {
  id: 'crypto-module', bin: 'LOGIC', label: 'CRYPTO MODULE',
  params: { grade: { def: 1, options: [1, 2] }, origin: { def: 'CORP PULL' } },
  slots: [],
  functions: {
    provides: ['encrypt'], needs: ['power', 'control'], rates: { grade: 1 },
    latent: ['link-rf beacon: factory telemetry — CORP PULL only; at resolved internals it reads as one unexplained extra organ under the pot']
  },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable: potted build state — pushing means cutting the pot, which zeroes the tamper mesh (drawn as broken mesh + struck stencil)'],
  graftsInto: ['LINK/transceiver key seat (pigtail)'],
  variants: [
    { label: 'GRADE 1', p: {} },
    { label: 'GRADE 2', p: { grade: 2 } },
    { label: 'GRADE 1 · STREET RE-POT', p: { origin: 'HANDMADE' } }
  ]
};
const norm = p => ({ grade: p?.grade === 2 ? 2 : 1, origin: p?.origin ?? 'CORP PULL' });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const [Wm, Hm] = DIMS[q.grade];
  const k = view.k ?? fitK(Wm + 8, Hm, view.fit ?? 140);
  const wpx = Wm * k, hpx = Hm * k;
  let out = RC(0, 0, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
  // tamper mesh border band
  const b = 1.6 * k;
  out += `<path d="M0,0 H${wpx.toFixed(1)} V${hpx.toFixed(1)} H0 Z M${b.toFixed(1)},${b.toFixed(1)} V${(hpx - b).toFixed(1)} H${(wpx - b).toFixed(1)} V${b.toFixed(1)} Z" fill="url(#xmesh)" fill-rule="evenodd" stroke="none"/>`;
  out += RC(b, b, wpx - 2 * b, hpx - 2 * b, heavy ? W.vis : W.mid);
  // pot field inside — no window, ever
  out += RC(b, b, wpx - 2 * b, hpx - 2 * b, 0, 'url(#pot)');
  // keyed pins: 2 in, 1 out
  if (!heavy) {
    out += keyPin(-2.2 * k, hpx * 0.32, 4 * k) + keyPin(-2.2 * k, hpx * 0.68, 4 * k) + keyPin(wpx + 2.2 * k, hpx * 0.5, 4 * k);
    // lineage plate: CORP PULL etched frame vs street bare string
    if (q.origin === 'CORP PULL') { out += RC(wpx / 2 - 8 * k / 2, hpx - 3.4 * k, 8 * k, 2.2 * k, 0.7, '#fff'); if (dens >= 3) out += TX(wpx / 2, hpx - 1.8 * k, 'KX-' + q.grade, 6); }
    else if (dens >= 3) out += TX(wpx / 2, hpx - 1.8 * k, 'kx' + q.grade + ' repot', 6);
  } else {
    // thumb identity: brick + mesh corner + key
    out += C(wpx / 2, hpx / 2, 2.4 * k, W.vis, '#fff') + L(wpx / 2, hpx / 2, wpx / 2 + 2.4 * k, hpx / 2, W.vis);
  }
  return frame(wpx + (heavy ? 0 : 9 * k), hpx, heavy ? out : `<g transform="translate(${(4.5 * k).toFixed(1)},0)">${out}</g>`);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 48 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the IN pin ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const [, Hm] = DIMS[q.grade];
  return { x: 4.5 * k - 2.2 * k, y: Hm * k * 0.32 };
}
