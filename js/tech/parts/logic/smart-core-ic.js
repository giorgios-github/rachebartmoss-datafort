// parts/logic/smart-core-ic.js — the organ that seats in the board's IC SOCKET.
import { L, C, RC, TX, frame, fitK, W, G, R, QUANT } from '../lib.js';
const BODIES = [7, 10, 12];                                   // QUANTISED mm (QFP register)

export const meta = {
  id: 'smart-core-ic', bin: 'LOGIC', label: 'SMART-CORE IC',
  params: {
    body: { def: 10, stock: BODIES },
    pkg: { def: 'qfp', options: ['qfp', 'qfn', 'dip'] },
    decapped: { def: false }
  },
  slots: [],
  functions: { provides: ['compute'], needs: ['power'], rates: { pins: 'COUNTED from side @ FIXED pitch' }, latent: ['factory telemetry (CORP PULL only)'] },
  envelope: { rated: 1, pushMax: 3, instabilityPerPush: 0.1 },
  pushedDraw: ['+1: clock push — stencil struck', '+2: graft heatsink tab on lid', '+3: lid off, forced-air demanded (decap state drawn)'],
  graftsInto: ['any DIP/QFP seat one size off (shim set)'],
  variants: [
    { label: 'QFP 10', p: {} },
    { label: 'DIP 12', p: { body: 12, pkg: 'dip' } },
    { label: 'QFP 10 · DECAPPED', p: { decapped: true } }
  ]
};
const norm = p => ({ body: QUANT.snap(p?.body ?? 10, BODIES), pkg: p?.pkg ?? 'qfp', decapped: !!p?.decapped });

// draws at (x,y) top-left in px; exported so processor-board can seat it in its socket
export function glyph(q, x, y, k, heavy = false) {
  const s = q.body * k;
  const swB = heavy ? W.cut : W.vis;
  let out = RC(x, y, s, s, swB, '#fff');
  const pinN = heavy ? 4 : Math.max(3, Math.floor(q.body / (q.pkg === 'dip' ? 2.54 : R.PIN_PITCH * 2)));
  const pl = (q.pkg === 'dip' ? 1.6 : 1) * k;
  const sides = q.pkg === 'dip' ? [[0, -1], [0, 1]] : [[0, -1], [0, 1], [-1, 0], [1, 0]];
  if (q.pkg !== 'qfn') for (const [sx, sy] of sides) for (let i = 0; i < pinN; i++) {
    const t = (i + 0.5) / pinN;
    if (sx === 0) out += L(x + s * t, sy < 0 ? y : y + s, x + s * t, (sy < 0 ? y : y + s) + sy * pl, heavy ? 1.6 : 0.8);
    else out += L(sx < 0 ? x : x + s, y + s * t, (sx < 0 ? x : x + s) + sx * pl, y + s * t, heavy ? 1.6 : 0.8);
  }
  else for (const [sx, sy] of sides) for (let i = 0; i < pinN; i++) { // QFN: pads under, HL dashed
    const t = (i + 0.5) / pinN;
    if (sx === 0) out += L(x + s * t, (sy < 0 ? y : y + s) - sy * 0.2 * k, x + s * t, (sy < 0 ? y : y + s) + sy * 0.9 * k, 0.8, '2 1.4');
    else out += L((sx < 0 ? x : x + s) - sx * 0.2 * k, y + s * t, (sx < 0 ? x : x + s) + sx * 0.9 * k, y + s * t, 0.8, '2 1.4');
  }
  out += C(x + 1.4 * k, y + 1.4 * k, 0.45 * k, heavy ? 0 : 0.8, heavy ? '#111' : 'none'); // pin 1
  if (q.decapped) {
    // lid removed: die + bond wires COUNTED (DF-TO-203 register)
    const d = R.dieFor(q.body) * k, dx = x + (s - d) / 2, dy = y + (s - d) / 2;
    out += RC(x + 0.15 * s, y + 0.15 * s, 0.7 * s, 0.7 * s, 0.7, 'none', '3 2'); // cavity rim
    out += RC(dx, dy, d, d, W.mid, '#fff');
    const nb = heavy ? 3 : 5;
    for (const [ex, ey] of [[0, -1], [0, 1], [-1, 0], [1, 0]])
      for (let i = 0; i < nb; i++) {
        const t = (i + 0.5) / nb;
        if (ex === 0) out += L(dx + d * t, ey < 0 ? dy : dy + d, x + s * (0.18 + 0.64 * t), y + (ey < 0 ? 0.15 : 0.85) * s, 0.5);
        else out += L(ex < 0 ? dx : dx + d, dy + d * t, x + (ex < 0 ? 0.15 : 0.85) * s, y + s * (0.18 + 0.64 * t), 0.5);
      }
  } else {
    // lidded state: ceramic lid seam, pin-1 chamfer, ejector marks, engraved marking
    const in1 = 0.16 * s;
    out += RC(x + in1, y + in1, s - 2 * in1, s - 2 * in1, heavy ? W.vis : 0.7);
    out += L(x + in1, y + in1 + 1.5 * k, x + in1 + 1.5 * k, y + in1, heavy ? 1.6 : 0.9); // pin-1 lid chamfer
    if (!heavy) {
      out += C(x + s - in1 - 0.9 * k, y + in1 + 0.9 * k, 0.32 * k, 0.5);          // mold ejector marks
      out += C(x + in1 + 0.9 * k, y + s - in1 - 0.9 * k, 0.32 * k, 0.5);
      out += TX(x + s / 2, y + s * 0.47, `SC-${Math.round(q.body)}`, Math.max(6, 1.5 * k), 'middle', true); // engraved id
      out += L(x + s * 0.32, y + s * 0.58, x + s * 0.68, y + s * 0.58, 0.6);      // lot bar
      out += L(x + s * 0.38, y + s * 0.66, x + s * 0.62, y + s * 0.66, 0.6);      // date bar
    } else {
      out += L(x + 0.26 * s, y + 0.74 * s, x + 0.74 * s, y + 0.26 * s, 2);        // thumb facet keeps the read
    }
  }
  return out;
}

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb';
  const k = view.k ?? fitK(q.body + 5, q.body + 5, view.fit ?? 110);
  const m = 2.2 * k;
  return frame(q.body * k + 2 * m, q.body * k + 2 * m, glyph(q, m, m, k, heavy));
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', fit: 42 }); }
export function binGlyph() { return thumb({}); }

// loom termination: pin 1
export function wirePad(p, view = {}) { const k = view.k ?? 8, m = 2.2 * k; return { x: m + 1.4 * k, y: m + 1.4 * k }; }
