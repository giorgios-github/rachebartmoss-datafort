// js/tech/parts/lib.js — DF-TO-C parts-catalogue shared vocabulary. Pure, deterministic.
// All drawing in px; parts multiply mm by view.k themselves so FIXED px weights hold.
// Ported from the Claude Design catalogue (fonts remapped to the site's --head/--mono).
import * as G from '../geom.js';
import * as R from '../rules.js';
import { defsBlock } from '../law.js';
export { G, R, defsBlock };
export const N = G.fmt, W = R.W, DASH = R.DASH;

export const L = (x1, y1, x2, y2, w, dash) =>
  `<line x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}" stroke="#111" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
export const C = (cx, cy, r, w, fill = 'none') =>
  `<circle cx="${N(cx)}" cy="${N(cy)}" r="${N(r)}" fill="${fill}"${w ? ` stroke="#111" stroke-width="${w}"` : ' stroke="none"'}/>`;
export const RC = (x, y, w2, h2, sw, fill = 'none', dash, rx) =>
  `<rect x="${N(x)}" y="${N(y)}" width="${N(w2)}" height="${N(h2)}"${rx ? ` rx="${N(rx)}"` : ''} fill="${fill}"${sw ? ` stroke="#111" stroke-width="${sw}"` : ' stroke="none"'}${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
export const TX = (x, y, s, size = 10, anchor = 'middle', disp = false) =>
  `<text x="${N(x)}" y="${N(y)}" font-size="${size}" text-anchor="${anchor}" fill="#111" stroke="none" style="font-family:${disp ? 'var(--head,Eurostile,sans-serif)' : 'var(--mono,monospace)'};${disp ? 'letter-spacing:1.5px;' : ''}">${s}</text>`;
export const POLY = (pts, w, close = true, fill = 'none', dash) => {
  let d = '';
  pts.forEach((p, i) => { d += `${i ? 'L' : 'M'}${N(p[0])},${N(p[1])} `; });
  return `<path d="${d}${close ? 'Z' : ''}" fill="${fill}"${w ? ` stroke="#111" stroke-width="${w}"` : ' stroke="none"'}${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
};
export const PLINE = (pts, w, dash) => POLY(pts, w, false, 'none', dash);

// svg wrapper. wPx/hPx are the drawing extents (content coordinate space).
export function frame(wPx, hPx, inner, pad = 8) {
  const tw = wPx + 2 * pad, th = hPx + 2 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N(tw)} ${N(th)}" width="${N(tw)}" height="${N(th)}">${defsBlock()}<g transform="translate(${N(pad)},${N(pad)})" fill="none">${inner}</g></svg>`;
}
export const fitK = (wMm, hMm, fitPx = 200, min = 3, max = 14) =>
  Math.min(max, Math.max(min, fitPx / Math.max(wMm, hMm)));

// ---- SEVEN-SEG (FIXED proportions; digit renders the actual char passed in)
const SEG7 = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg',
  '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', 'A': 'abcefg', 'B': 'cdefg',
  'C': 'adef', 'D': 'bcdeg', 'E': 'adefg', 'F': 'aefg', 'H': 'bcefg', 'L': 'def',
  'P': 'abefg', 'U': 'bcdef', '-': 'g', ' ': '', '.': ''
};
export function seg7(x, y, h, ch, sw) {
  const w2 = 0.55 * h, g = 0.09 * h, m = h / 2, on = SEG7[String(ch).toUpperCase()] ?? SEG7['-'];
  const S = {
    a: [x + g, y, x + w2 - g, y], b: [x + w2, y + g, x + w2, y + m - g],
    c: [x + w2, y + m + g, x + w2, y + h - g], d: [x + g, y + h, x + w2 - g, y + h],
    e: [x, y + m + g, x, y + h - g], f: [x, y + g, x, y + m - g],
    g: [x + g, y + m, x + w2 - g, y + m]
  };
  let out = '';
  for (const s of on) { const c = S[s]; out += L(c[0], c[1], c[2], c[3], sw); }
  if (String(ch) === '.') out += C(x + w2 + 0.12 * h, y + h, sw * 0.9, 0, '#111');
  return out;
}
export const seg7W = h => 0.55 * h; // advance = seg7W + 0.35h

// ---- 5×7 DOT-MATRIX FONT (row bitmasks, MSB left)
const F57 = {
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12], 'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14], 'D': [28, 18, 17, 17, 17, 18, 28], 'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16], 'G': [14, 17, 16, 23, 17, 17, 15], 'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14], 'J': [7, 2, 2, 2, 2, 18, 12], 'K': [17, 18, 20, 24, 20, 18, 17],
  'L': [16, 16, 16, 16, 16, 16, 31], 'M': [17, 27, 21, 21, 17, 17, 17], 'N': [17, 17, 25, 21, 19, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14], 'P': [30, 17, 17, 30, 16, 16, 16], 'Q': [14, 17, 17, 17, 21, 18, 13],
  'R': [30, 17, 17, 30, 20, 18, 17], 'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14], 'V': [17, 17, 17, 17, 17, 10, 4], 'W': [17, 17, 17, 21, 21, 21, 10],
  'X': [17, 17, 10, 4, 10, 17, 17], 'Y': [17, 17, 17, 10, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
  '-': [0, 0, 0, 14, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ':': [0, 12, 12, 0, 12, 12, 0],
  '/': [1, 1, 2, 4, 8, 16, 16], ' ': [0, 0, 0, 0, 0, 0, 0]
};
// draws chars as lit dots; cell = dot pitch px. Returns {svg, w, h}.
export function matrixText(x, y, str, cell, rDot) {
  let out = '', cx = x;
  const s = String(str).toUpperCase();
  for (const ch of s) {
    const gl = F57[ch] ?? F57['-'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
      if (gl[r] & (16 >> c)) out += C(cx + c * cell, y + r * cell, rDot, 0, '#111');
    cx += 6 * cell;
  }
  return { svg: out, w: s.length * 6 * cell - cell, h: 7 * cell };
}
// unlit dot field (fine) — the matrix hardware is COUNTED
export function matrixField(x, y, cols, rows, cell) {
  let out = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    out += C(x + c * cell, y + r * cell, 0.16 * cell, 0.4);
  return out;
}

// ---- deterministic scope waveform seeded by the content string
export function wave(x, y, w2, h, seedStr, sw) {
  let seed = 0;
  for (let i = 0; i < String(seedStr).length; i++) seed = (seed * 31 + String(seedStr).charCodeAt(i)) | 0;
  const A = [0.42, 0.25, 0.14].map((a, i) => a * (0.7 + 0.6 * G.hash(seed, i)));
  const F = [1, 2, 3].map((f, i) => f + Math.round(G.hash(seed, i + 5) * 2));
  const P = [0, 1, 2].map(i => G.hash(seed, i + 9) * G.TAU);
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    let v = 0;
    for (let j = 0; j < 3; j++) v += A[j] * Math.sin(G.TAU * F[j] * t + P[j]);
    pts.push([x + w2 * t, y + h / 2 - v * h * 0.48]);
  }
  return PLINE(pts, sw);
}
export function graticule(x, y, w2, h, div) {
  let out = '';
  const nx = Math.max(2, Math.round(w2 / div)), ny = Math.max(2, Math.round(h / div));
  for (let i = 1; i < nx; i++) out += L(x + w2 * i / nx, y, x + w2 * i / nx, y + h, 0.4);
  for (let i = 1; i < ny; i++) out += L(x, y + h * i / ny, x + w2, y + h * i / ny, 0.4);
  return out;
}

// ---- shared component glyphs
export function screwMini(x, y, r, drive = 'torx') {
  let out = C(x, y, r, W.mid, '#fff');
  const rr = 0.55 * r;
  if (drive === 'slot') out += L(x - rr, y, x + rr, y, 1.1);
  else if (drive === 'cross') out += L(x - rr, y, x + rr, y, 1.1) + L(x, y - rr, x, y + rr, 1.1);
  else { const n = drive === 'tri' ? 3 : 6; for (let j = 0; j < n; j++) { const a = -Math.PI / 2 + G.TAU / n * j; out += L(x, y, x + rr * Math.cos(a), y + rr * Math.sin(a), 1.1); } }
  return out;
}
// solder pad: the organ-side termination (loom law)
export const pad = (x, y, r = 2.6) => C(x, y, r, W.mid, '#fff') + C(x, y, r * 0.38, 0, '#111');
// keyed pin: the port/control-side termination
export const keyPin = (x, y, s = 5) => RC(x - s / 2, y - s / 2, s, s, W.mid, '#fff') + C(x, y, s * 0.22, 0, '#111') + L(x - s / 2, y - s / 2, x - s / 2 + s * 0.3, y - s / 2, W.cut);
// EMPTY SLOT SEAT — dashed rect + keying notch + centre cross. Removal must be legible.
export function seat(x, y, w2, h, key = 'NE') {
  let out = RC(x, y, w2, h, W.mid, 'none', DASH.hl);
  const kx = key.includes('E') ? x + w2 : x, ky = key.includes('N') ? y : y + h;
  const s = Math.min(4, w2 * 0.22);
  out += POLY([[kx, ky + (key.includes('N') ? s : -s)], [kx + (key.includes('E') ? -s : s), ky]], W.mid, false);
  out += L(x + w2 / 2 - 3, y + h / 2, x + w2 / 2 + 3, y + h / 2, 0.7) + L(x + w2 / 2, y + h / 2 - 3, x + w2 / 2, y + h / 2 + 3, 0.7);
  return out;
}
// knurl ticks around a circle rim, COUNTED at FIXED arc pitch
export function knurl(cx, cy, r, arcPitchPx, len = 3, sw = 0.7) {
  const n = Math.max(8, Math.round(G.TAU * r / arcPitchPx));
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = G.TAU * i / n;
    out += L(cx + (r - len) * Math.cos(a), cy + (r - len) * Math.sin(a), cx + r * Math.cos(a), cy + r * Math.sin(a), sw);
  }
  return out;
}
export const QUANT = { snap: (v, stock) => { let b = stock[0]; for (const s of stock) if (Math.abs(s - v) < Math.abs(b - v)) b = s; return b; } };

// ---- WALL-CROSSING SIGNAL — the EMITTER grammar, used everywhere something
// straddles the case wall in profile: a panel flange (plate taller than the body)
// with TWO retaining screws. Interior left, exterior right, BOTH drawn solid.
// The "exterior only" view of the same part carries NO signal at all.
export function flangeV(x, cy, halfH, k, heavy = false) {
  let o = RC(x, cy - halfH - 1.8 * k, 1.8 * k, 2 * halfH + 3.6 * k, heavy ? W.vis : W.mid, '#fff');
  if (!heavy) o += screwMini(x + 0.9 * k, cy - halfH - 0.9 * k, 0.7 * k, 'cross') + screwMini(x + 0.9 * k, cy + halfH + 0.9 * k, 0.7 * k, 'cross');
  return o;
}
// Horizontal flange (same grammar, wall horizontal): plate + 2 screws around a shaft.
export function flangeH(cx, y, halfW, k, heavy = false) {
  let o = RC(cx - halfW - 1.8 * k, y, 2 * halfW + 3.6 * k, 1.8 * k, heavy ? W.vis : W.mid, '#fff');
  if (!heavy) o += screwMini(cx - halfW - 0.9 * k, y + 0.9 * k, 0.7 * k, 'cross') + screwMini(cx + halfW + 0.9 * k, y + 0.9 * k, 0.7 * k, 'cross');
  return o;
}
