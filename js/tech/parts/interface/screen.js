// parts/interface/screen.js — THE MODULARITY EXEMPLAR. A screen is a live readout.
import { L, C, RC, POLY, PLINE, frame, fitK, N, W, DASH, G, R, seg7, seg7W, matrixText, matrixField, wave, graticule, screwMini, QUANT } from '../lib.js';

const W_STOCK = [12, 18, 26, 38, 56], H_STOCK = [8, 12, 14, 18, 22, 30];
const BEZEL = { flush: 1.6, raised: 3, armored: 4.5 };          // QUANTISED mm by style

export const meta = {
  id: 'screen', bin: 'INTERFACE', label: 'SCREEN',
  params: {
    w: { def: 38, stock: W_STOCK }, h: { def: 18, stock: H_STOCK },
    displayType: { def: 'seven-seg', options: ['seven-seg', 'dot-matrix', 'text-lines', 'scope-wave', 'blank'] },
    bezel: { def: 'flush', options: Object.keys(BEZEL) },
    orientation: { def: 0, options: [0, 90] },
    content: { def: '2020' }
  },
  slots: [],
  functions: { provides: ['display'], needs: ['power', 'control'], rates: { powerMw: 40 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.12 },
  pushedDraw: ['+1: refresh overdrive — bezel vent slots demanded (COUNTED)', '+2: brightness burn — graft-on heatsink tab at rear, stencil struck'],
  graftsInto: ['STRUCTURE/bay (with adapter plate)', 'LINK/transceiver face (with shim set)'],
  variants: [
    { label: '38×18 · 7-SEG · FLUSH', p: {} },
    { label: '56×22 · SCOPE · ARMORED', p: { w: 56, h: 22, displayType: 'scope-wave', bezel: 'armored', content: 'CH1' } },
    { label: '26×14 · MATRIX · RAISED', p: { w: 26, h: 14, displayType: 'dot-matrix', bezel: 'raised', content: 'RDY' } }
  ]
};

const norm = p => {
  const q = { ...Object.fromEntries(Object.entries(meta.params).map(([k, v]) => [k, v.def])), ...p };
  q.w = QUANT.snap(q.w, W_STOCK); q.h = QUANT.snap(q.h, H_STOCK);
  if (q.orientation === 90) { const t = q.w; q.w = q.h; q.h = t; }
  return q;
};

function face(q, x, y, wpx, hpx, k, lod) {
  const heavy = lod === 'thumb';
  const sw = heavy ? 3 : 1.6;
  let out = '';
  const m = 1.2 * k;                                           // FIXED face margin
  const fx = x + m, fy = y + m, fw = wpx - 2 * m, fh = hpx - 2 * m;
  if (q.displayType === 'seven-seg') {
    const dh = fh * 0.9, adv = seg7W(dh) + 0.35 * dh;
    const nMax = Math.max(1, Math.floor((fw + 0.35 * dh) / adv));  // digit count COUNTED
    const s = String(q.content).slice(-nMax).padStart(nMax, ' ');
    const x0 = fx + fw - nMax * adv + 0.35 * dh;
    for (let i = 0; i < nMax; i++) out += seg7(x0 + i * adv, fy + (fh - dh) / 2, dh, s[i], Math.max(sw, 0.16 * dh));
  } else if (q.displayType === 'dot-matrix') {
    const cell = heavy ? fh / 8 : Math.max(2.2, 0.55 * k);     // FIXED dot pitch (px reg.)
    const cols = Math.floor(fw / cell), rows = Math.min(7, Math.floor(fh / cell));
    if (!heavy) out += matrixField(fx + cell / 2, fy + (fh - rows * cell) / 2 + cell / 2, cols, rows, cell);
    const t = matrixText(0, 0, q.content, cell, 0.34 * cell);
    const nCh = Math.max(1, Math.min(String(q.content).length, Math.floor(cols / 6)));
    const t2 = matrixText(fx + cell / 2, fy + (fh - 7 * cell) / 2 + cell / 2, String(q.content).slice(0, nCh), cell, 0.34 * cell);
    out += t2.svg;
  } else if (q.displayType === 'text-lines') {
    const pitch = heavy ? fh / 3.2 : Math.max(3, 1.1 * k);     // line pitch FIXED, count COUNTED
    const n = Math.max(2, Math.floor(fh / pitch));
    for (let i = 0; i < n; i++) {
      const ly = fy + pitch * (i + 0.7);
      const frac = [0.92, 0.6, 0.78, 0.45, 0.85, 0.55][i % 6]; // deterministic ragged right
      out += L(fx + 0.5 * k, ly, fx + 0.5 * k + (fw - k) * frac, ly, i === 0 ? sw + 0.6 : sw);
    }
    out += RC(fx + 0.5 * k + (fw - k) * 0.45 + 2, fy + pitch * (n - 1 + 0.25), heavy ? 4 : 0.9 * k, pitch * 0.7, 0, '#111'); // cursor block
  } else if (q.displayType === 'scope-wave') {
    if (!heavy) out += graticule(fx, fy, fw, fh, 2 * k);
    out += wave(fx, fy + fh * 0.05, fw, fh * 0.9, q.content, sw);
    if (!heavy) out += L(fx, fy + fh / 2, fx + fw, fy + fh / 2, 0.5, DASH.cl);
  } else { // blank — glass convention: two parallel diagonals
    out += L(fx + fw * 0.18, fy + fh * 0.85, fx + fw * 0.5, fy + fh * 0.15, 0.8);
    out += L(fx + fw * 0.3, fy + fh * 0.85, fx + fw * 0.62, fy + fh * 0.15, 0.8);
  }
  return out;
}

export function draw(p, view = {}) {
  const q = norm(p);
  const dens = view.density ?? 2, lod = view.lod ?? 'plate';
  const b = BEZEL[q.bezel] ?? BEZEL.flush;
  const Wm = q.w + 2 * b, Hm = q.h + 2 * b;
  const k = view.k ?? fitK(Wm, Hm, view.fit ?? 190);
  const wpx = Wm * k, hpx = Hm * k, bp = b * k;
  let out = '';
  // module outline
  out += RC(0, 0, wpx, hpx, q.bezel === 'armored' ? W.cut : W.vis, '#fff');
  // window
  out += RC(bp, bp, q.w * k, q.h * k, W.mid, '#fff');
  if (q.bezel === 'raised') out += RC(0.45 * bp, 0.45 * bp, wpx - 0.9 * bp, hpx - 0.9 * bp, W.fine); // bezel step
  if (q.bezel === 'armored') {
    // hatched guard band + corner screws (COUNTED, corners-first — 4 corners, no pitch extras at this size)
    out += `<path d="M0,0 H${N(wpx)} V${N(hpx)} H0 Z M${N(bp)},${N(bp)} V${N(hpx - bp)} H${N(wpx - bp)} V${N(bp)} Z" fill="url(#h45)" fill-rule="evenodd"/>`;
    const e = bp / 2;
    for (const [sx, sy] of [[e, e], [wpx - e, e], [wpx - e, hpx - e], [e, hpx - e]])
      out += screwMini(sx, sy, Math.min(0.4 * bp, 1.1 * k), 'torx');
  }
  if (q.bezel === 'flush' && dens >= 2) {
    // solder tabs on E/W edges (FIXED 3×2 mm), 2 per side
    for (const s of [-1, 1]) for (const t of [0.28, 0.72])
      out += RC(s < 0 ? -2 * k : wpx, hpx * t - 1.5 * k / 2, 2 * k, 1.5 * k, W.mid, '#fff');
  }
  out += face(q, bp, bp, q.w * k, q.h * k, k, lod);
  if (dens >= 3 && lod !== 'thumb') {
    // one dim: window width (the honest cote)
    const dy = hpx + 3.2 * k;
    out += L(bp, hpx + 1.2 * k, bp, dy, 0.7) + L(wpx - bp, hpx + 1.2 * k, wpx - bp, dy, 0.7);
    out += `<line x1="${N(bp)}" y1="${N(dy - 0.8 * k)}" x2="${N(wpx - bp)}" y2="${N(dy - 0.8 * k)}" stroke="#111" stroke-width="0.7" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
    out += `<text x="${N(wpx / 2)}" y="${N(dy + 0.6 * k)}" font-size="9" text-anchor="middle" fill="#111" style="font-family:var(--mono,monospace)">${N(q.w)}</text>`;
  }
  return frame(wpx, hpx + (dens >= 3 && lod !== 'thumb' ? 4.5 * k : 0), out);
}

export function thumb(p) {
  const q = norm(p);
  const b = Math.max(2.4, BEZEL[q.bezel] ?? 1.6);
  const Wm = q.w + 2 * b, Hm = q.h + 2 * b;
  const k = 60 / Math.max(Wm, Hm);
  const wpx = Wm * k, hpx = Hm * k, bp = b * k;
  let out = RC(0, 0, wpx, hpx, W.cut, '#fff') + RC(bp, bp, q.w * k, q.h * k, W.vis, '#fff');
  out += face({ ...q, content: q.displayType === 'seven-seg' ? '88' : q.content }, bp, bp, q.w * k, q.h * k, k, 'thumb');
  return frame(wpx, hpx, out, 4);
}

export function binGlyph() {
  return thumb({ w: 38, h: 18, displayType: 'scope-wave', bezel: 'raised', content: 'BIN' });
}
