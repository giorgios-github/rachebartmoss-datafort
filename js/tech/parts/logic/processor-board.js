// parts/logic/processor-board.js — THE SLOT EXEMPLAR: IC SOCKET accepts LOGIC.
// Empty socket drawn as the lawful dashed seat; occupied seats a smart-core in place.
import { L, C, RC, TX, frame, fitK, W, DASH, G, R, seat, QUANT } from '../lib.js';
import * as core from './smart-core-ic.js';
const DIMS = { 1: [28, 20], 2: [36, 24], 4: [46, 30] };       // QUANTISED by cores

export const meta = {
  id: 'processor-board', bin: 'LOGIC', label: 'PROCESSOR BOARD',
  params: {
    cores: { def: 2, options: [1, 2, 4] },
    shielding: { def: 'none', options: ['none', 'can'] },
    socket: { def: 'empty', options: ['empty', 'occupied'] }
  },
  slots: [{ id: 'ic0', accepts: 'LOGIC', keying: 'NE notch + pin-1 dot', param: 'socket' }],
  functions: { provides: ['compute', 'control'], needs: ['power'], rates: { cores: 2 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.14 },
  pushedDraw: ['+1: bus overclock — termination resistor row demanded along fingers', '+2: rail push — bypass caps doubled (COUNTED), stencil struck'],
  graftsInto: ['STORE/cartridge bay (jury-rig bracket) — a board is not a cartridge; the bracket is the tell'],
  variants: [
    { label: '2-CORE · SOCKET EMPTY', p: {} },
    { label: '2-CORE · SOCKET OCCUPIED', p: { socket: 'occupied' } },
    { label: '4-CORE · SHIELD CAN', p: { cores: 4, shielding: 'can', socket: 'occupied' } }
  ]
};
const norm = p => ({ cores: [1, 2, 4].includes(p?.cores) ? p.cores : 2, shielding: p?.shielding ?? 'none', socket: p?.socket ?? 'empty' });

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2, heavy = view.lod === 'thumb';
  const [Wm, Hm] = DIMS[q.cores];
  const k = view.k ?? fitK(Wm, Hm + 6, view.fit ?? 175);
  const wpx = Wm * k, hpx = Hm * k;
  const swB = heavy ? W.cut : W.vis;
  let out = RC(0, 0, wpx, hpx, swB, '#fff');
  // corner mount holes (COUNTED, 4)
  if (!heavy) for (const [mx, my] of [[2, 2], [Wm - 2, 2], [Wm - 2, Hm - 2], [2, Hm - 2]]) out += C(mx * k, my * k, 1 * k, W.fine);
  // core QFPs COUNTED in a row on the left half
  const cs = R.qfpFor(Hm) * 0.62;
  for (let i = 0; i < q.cores; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = (4 + col * (cs + 3)) * k, y = (4 + row * (cs + 3)) * k;
    out += core.glyph({ body: cs, pkg: 'qfp', decapped: false }, x, y, k, heavy);
  }
  // shield can over the core region
  if (q.shielding === 'can') {
    const cw = (4 + (q.cores > 1 ? 2 : 1) * (cs + 3)) * k, ch = (4 + (q.cores > 2 ? 2 : 1) * (cs + 3)) * k;
    out += RC(2.2 * k, 2.2 * k, cw, ch, swB, 'none');
    out += RC(2.9 * k, 2.9 * k, cw - 1.4 * k, ch - 1.4 * k, 0.6);
    if (!heavy) { const nw = Math.floor(cw / (6 * k)); for (let i = 0; i <= nw; i++) out += C(2.2 * k + cw * i / nw, 2.2 * k, 0.35 * k, 0, '#111'); } // spot welds COUNTED
  }
  // IC SOCKET (the slot): right side, body 10 seat + keying
  const ss = 10 * k, sx = wpx - ss - 4 * k, sy = (Hm / 2) * k - ss / 2;
  if (q.socket === 'empty') {
    out += seat(sx, sy, ss, ss, 'NE');
    if (dens >= 3 && !heavy) out += TX(sx + ss / 2, sy + ss + 10, 'ACCEPTS LOGIC', 8);
  } else {
    out += RC(sx - 0.8 * k, sy - 0.8 * k, ss + 1.6 * k, ss + 1.6 * k, W.mid, '#fff'); // socket frame
    out += core.glyph({ body: 10, pkg: 'qfp', decapped: false }, sx, sy, k, heavy);
    if (dens >= 3 && !heavy) out += TX(sx + ss / 2, sy + ss + 12, 'SMART-CORE SEATED', 8);
  }
  // passives COUNTED on hash grid between cores and socket
  if (!heavy) {
    const nP = 4 + 2 * q.cores;
    for (let i = 0; i < nP; i++) {
      const px = (Wm * 0.42 + G.hash(7, i) * Wm * 0.18) * k, py = (3 + G.hash(11, i) * (Hm - 6)) * k;
      G.hash(3, i) > 0.5 ? out += RC(px, py, 2 * k, 1 * k, 0.7, '#fff') : out += RC(px, py, 1 * k, 2 * k, 0.7, '#fff');
    }
  }
  // edge connector fingers, COUNTED at FIXED pitch
  const nF = Math.floor((Wm - 8) / R.FINGER.pitch);
  for (let i = 0; i < nF; i++) {
    const fx = (4 + R.FINGER.pitch * (i + 0.5)) * k;
    out += RC(fx - R.FINGER.w / 2 * k, hpx, R.FINGER.w * k, (heavy ? 2.4 : 3) * k, heavy ? 1.4 : 0.8, '#fff');
  }
  return frame(wpx, hpx + (dens >= 3 && !heavy ? 5.4 : 3.4) * k, out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 58 }); }
export function binGlyph() { return thumb({ cores: 1, socket: 'occupied' }); }

// loom termination: the edge-connector fingers
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8, [Wm, Hm] = DIMS[q.cores];
  return { x: Wm / 2 * k, y: Hm * k + 1.5 * k };
}
