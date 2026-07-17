// parts/interface/keypad.js — rows×cols COUNTED keys at FIXED pitch; matrix-scan flex tail.
import { L, C, RC, TX, frame, fitK, N, W, DASH, QUANT } from '../lib.js';
const PITCH = 7, CAP = 6, MARGIN = 2;                       // FIXED mm
const LEGEND12 = ['1','2','3','4','5','6','7','8','9','*','0','#'];

export const meta = {
  id: 'keypad', bin: 'INTERFACE', label: 'KEYPAD',
  params: {
    rows: { def: 4, min: 1, max: 6 }, cols: { def: 3, min: 1, max: 6 },
    cap: { def: 'flat', options: ['flat', 'dome', 'chiclet'] }
  },
  slots: [],
  functions: { provides: ['input'], needs: ['control'], rates: { leads: 'rows+cols (matrix scan)' } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.05 },
  pushedDraw: ['+1: scan overclock — no drawable delta beyond stencil struck (input parts barely push)'],
  graftsInto: ['LOGIC/board GPIO header (connector pigtail)'],
  variants: [
    { label: '4×3 · FLAT', p: {} },
    { label: '4×4 · DOME', p: { cols: 4, cap: 'dome' } },
    { label: '2×6 · CHICLET', p: { rows: 2, cols: 6, cap: 'chiclet' } }
  ]
};
const norm = p => ({ rows: Math.max(1, Math.min(6, p?.rows ?? 4)), cols: Math.max(1, Math.min(6, p?.cols ?? 3)), cap: p?.cap ?? 'flat' });

function cap(x, y, s, style, sw) {
  if (style === 'dome') return RC(x, y, s, s, sw, '#fff') + C(x + s / 2, y + s / 2, s * 0.36, sw * 0.8);
  if (style === 'chiclet') return RC(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, sw, '#fff', null, s * 0.16);
  return RC(x, y, s, s, sw, '#fff') + L(x + s * 0.15, y + s * 0.85, x + s * 0.85, y + s * 0.85, sw * 0.5); // flat: skirt line
}

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2;
  const Wm = q.cols * PITCH + 2 * MARGIN, Hm = q.rows * PITCH + 2 * MARGIN;
  const k = view.k ?? fitK(Wm, Hm, view.fit ?? 170);
  const wpx = Wm * k, hpx = Hm * k;
  let out = RC(0, 0, wpx, hpx, W.vis, '#fff');
  for (let r = 0; r < q.rows; r++) for (let c = 0; c < q.cols; c++) {
    const x = (MARGIN + c * PITCH + (PITCH - CAP) / 2) * k, y = (MARGIN + r * PITCH + (PITCH - CAP) / 2) * k;
    out += cap(x, y, CAP * k, q.cap, W.mid);
    if (dens >= 3) {
      const i = r * q.cols + c;
      const lg = (q.cols === 3 && q.rows === 4) ? LEGEND12[i] : (i < 9 ? String(i + 1) : ['*', '0', '#', 'A', 'B', 'C', 'D'][(i - 9) % 7]);
      out += TX(x + CAP * k / 2, y + CAP * k / 2 + (q.cap === 'dome' ? 0 : 0.35) * k + 3, lg, Math.max(8, 1.6 * k));
    }
  }
  // mount holes, 4 corners FIXED Ø1.5
  for (const [mx, my] of [[1, 1], [Wm - 1, 1], [Wm - 1, Hm - 1], [1, Hm - 1]])
    out += C(mx * k, my * k, 0.75 * k, W.fine);
  // flex tail: rows+cols leads COUNTED at FIXED 1.27 pitch
  const nL = q.rows + q.cols, tw = nL * 1.27 + 1.6;
  const tx = (Wm - tw) / 2 * k, ty = hpx;
  out += RC(tx, ty, tw * k, 4 * k, W.mid, '#fff');
  for (let i = 0; i < nL; i++) {
    const lx = tx + (0.8 + 0.635 + i * 1.27) * k;
    out += L(lx, ty + 0.6 * k, lx, ty + 3.4 * k, 0.8);
  }
  if (dens >= 3) out += TX((Wm / 2) * k, ty + 5.6 * k, `${nL} LD SCAN`, 8);
  return frame(wpx, hpx + (dens >= 3 ? 6.4 : 4.2) * k, out);
}

export function thumb(p) {
  const q = norm(p ?? {});
  const Wm = q.cols * PITCH + 2 * MARGIN, Hm = q.rows * PITCH + 2 * MARGIN;
  const k = 56 / Math.max(Wm, Hm);
  let out = RC(0, 0, Wm * k, Hm * k, W.cut, '#fff');
  for (let r = 0; r < q.rows; r++) for (let c = 0; c < q.cols; c++)
    out += RC((MARGIN + c * PITCH + 0.5) * k, (MARGIN + r * PITCH + 0.5) * k, (CAP) * k, (CAP) * k, W.vis, '#fff');
  return frame(Wm * k, Hm * k, out, 4);
}
export function binGlyph() { return thumb({ rows: 3, cols: 3 }); }

// ── wire contract: the loom lands on the flex tail ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const Wm = q.cols * PITCH + 2 * MARGIN, Hm = q.rows * PITCH + 2 * MARGIN;
  return { x: (Wm / 2) * k, y: (Hm + 2) * k };
}
