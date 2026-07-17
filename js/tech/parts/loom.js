// parts/loom.js — WIRING / LOOM CONVENTION + routing helper. Deterministic, px-space.
// Law: runs parallel to axes, 45° bends only; shared segments bundle into a jacketed
// loom with lacing marks (COUNTED); terminations: solder pad at the organ, keyed pin
// at ports/controls; strain relief where a lead exits a wall; crossings hop.
import { L, C, RC, TX, PLINE, POLY, frame, N, W, DASH, G, R, pad, keyPin } from './lib.js';

// axis+45 route: run along firstAxis for the excess, then one 45° reach.
export function routePts(a, b, firstAxis = 'x') {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 0.5 || ady < 0.5) return [a, b];
  const pts = [a];
  if ((firstAxis === 'x' && adx >= ady) || (firstAxis === 'y' && ady < adx)) {
    pts.push([b[0] - Math.sign(dx) * ady, a[1]]);
  } else {
    pts.push([a[0], b[1] - Math.sign(dy) * adx]);
  }
  pts.push(b);
  return pts;
}
export const lead = (a, b, firstAxis, sw = W.mid) => PLINE(routePts(a, b, firstAxis), sw);

function offsetOpen(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    out.push([pts[i][0] + (p1[1] - p0[1]) / l * d, pts[i][1] - (p1[0] - p0[0]) / l * d]);
  }
  return out;
}
// jacketed loom along a path: two outlines, lacing cross-ticks COUNTED @ FIXED pitch,
// fan ticks (one per lead) where leads enter/exit the jacket.
export function loom(pts, nLeads, k, lacePitchMm = 12) {
  const r = (2 + 0.35 * nLeads) * k / 2;               // jacket Ø: FIXED base + per-lead
  let out = PLINE(offsetOpen(pts, r), W.vis) + PLINE(offsetOpen(pts, -r), W.vis);
  const cl = [0]; // cumulative length
  for (let i = 1; i < pts.length; i++) cl.push(cl[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cl[cl.length - 1], pitch = lacePitchMm * k;
  const nL = Math.max(2, Math.floor(total / pitch));   // lacing COUNTED
  for (let j = 1; j < nL; j++) {
    const s = total * j / nL;
    let i = 1; while (i < cl.length - 1 && cl[i] < s) i++;
    const t = (s - cl[i - 1]) / (cl[i] - cl[i - 1] || 1);
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) || 1;
    const nx = (pts[i][1] - pts[i - 1][1]) / l, ny = -(pts[i][0] - pts[i - 1][0]) / l;
    out += L(x + nx * r, y + ny * r, x - nx * r, y - ny * r, 0.8);
    out += L(x + nx * r + 1.5, y + ny * r, x - nx * r + 1.5, y - ny * r, 0.8); // double tick = lacing
  }
  // fan ticks at both ends: lead count made COUNTED-legible
  for (const end of [0, pts.length - 1]) {
    const q = pts[end], q2 = pts[end === 0 ? 1 : pts.length - 2];
    const l = Math.hypot(q2[0] - q[0], q2[1] - q[1]) || 1;
    const ux = (q2[0] - q[0]) / l, uy = (q2[1] - q[1]) / l;
    for (let i = 0; i < nLeads; i++) {
      const off = (i - (nLeads - 1) / 2) * (2 * r / Math.max(1, nLeads));
      out += L(q[0] - uy * off, q[1] + ux * off, q[0] - uy * off + ux * 2.2 * k, q[1] + ux * off + uy * 2.2 * k, 0.7);
    }
  }
  return out;
}
// crossing convention: the LATER lead hops. Semicircle bump at (x,y) on a horizontal run.
export const hop = (x, y, k, sw = W.mid) =>
  `<path d="M${N(x - 1.6 * k)},${N(y)} A${N(1.6 * k)},${N(1.6 * k)} 0 0 1 ${N(x + 1.6 * k)},${N(y)}" fill="none" stroke="#111" stroke-width="${sw}"/>`;
// clip ticks along a run, COUNTED @ CLIP_PITCH (same max-pitch law as screws)
export function clips(pts, k) {
  let out = '';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / (R.CLIP_PITCH * k));
    for (let j = 1; j <= n; j++) {
      const t = j / (n + 1);
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const l = len || 1, nx = (b[1] - a[1]) / l, ny = -(b[0] - a[0]) / l;
      out += L(x + nx * 1.4 * k, y + ny * 1.4 * k, x - nx * 1.4 * k, y - ny * 1.4 * k, W.vis);
      out += C(x + nx * 2.1 * k, y + ny * 2.1 * k, 0.35 * k, 0.7);
    }
  }
  return out;
}
// strain relief: 3 shrinking collar rings where a lead exits through a wall at angle a (deg)
export function strainRelief(x, y, aDeg, k) {
  const a = aDeg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
  let out = '';
  for (let i = 0; i < 3; i++) {
    const d = (1 + i * 1.1) * k, h = (2.4 - i * 0.55) * k;
    out += L(x + ux * d - uy * h / 2, y + uy * d + ux * h / 2, x + ux * d + uy * h / 2, y + uy * d - ux * h / 2, W.mid);
  }
  return out;
}
export { pad, keyPin };

// ---- THE CONVENTION SHEET — one deterministic demo panel, 12-lead interior kept readable
export function conventionSheet(k = 3.4) {
  const Wp = 150 * k, Hp = 96 * k;
  let out = RC(0, 0, Wp, Hp, W.cut, '#fff');                       // host wall
  const lab = (x, y, s) => TX(x, y, s, 9, 'start');
  // organs
  const A = [16 * k, 16 * k, 34 * k, 22 * k];                      // controller
  const B = [16 * k, 62 * k, 26 * k, 20 * k];                      // cell
  const D = [104 * k, 14 * k, 32 * k, 24 * k];                     // display
  for (const o of [A, B, D]) out += RC(o[0], o[1], o[2], o[3], W.vis, '#fff');
  out += TX(A[0] + A[2] / 2, A[1] + A[3] / 2 + 3, 'CTRL', 10) + TX(B[0] + B[2] / 2, B[1] + B[3] / 2 + 3, 'CELL', 10) + TX(D[0] + D[2] / 2, D[1] + D[3] / 2 + 3, 'DISP', 10);
  // 1 · single lead, axis + 45 only, solder pads both ends
  const p1 = [B[0] + B[2], B[1] + 6 * k], p2 = [A[0] + 6 * k, A[1] + A[3]];
  out += pad(p1[0], p1[1], 1.3 * k) + pad(p2[0], p2[1], 1.3 * k);
  out += lead([p1[0] + 1.3 * k, p1[1]], [p2[0], p2[1] + 1.3 * k], 'x');
  out += lab(16 * k, 59 * k, '1 · AXIS RUNS, 45° BENDS ONLY · PAD AT THE ORGAN');
  // 2 · bundle: 6 leads share a trunk to the display
  const t0 = [A[0] + A[2], A[1] + 8 * k], t1 = [86 * k, A[1] + 8 * k], t2 = [96 * k, D[1] + 12 * k], t3 = [D[0], D[1] + 12 * k];
  out += loom([t0, t1, t2, t3], 6, k);
  out += lab(t0[0] + 6 * k, t0[1] - 3.5 * k, '2 · SHARED SEGMENT BUNDLES · LACING COUNTED @ 12');
  // 3 · crossing hop: a power lead crosses under the loom drop
  const c1 = [B[0] + B[2], B[1] + 14 * k], c2 = [128 * k, B[1] + 14 * k], c3 = [128 * k, D[1] + D[3]];
  out += pad(c1[0], c1[1], 1.3 * k);
  out += PLINE([[c1[0] + 1.3 * k, c1[1]], [91 * k - 1.6 * k, c1[1]]], W.mid);
  out += hop(91 * k, c1[1], k);
  out += PLINE([[91 * k + 1.6 * k, c1[1]], [c2[0] - 8 * k, c2[1]], [c2[0], c2[1] - 8 * k], [c3[0], c3[1] + 2 * k]], W.mid);
  out += lab(74 * k, 69.5 * k, '3 · LATER LEAD HOPS');
  out += clips([[c1[0] + 1.3 * k, c1[1]], [89 * k, c1[1]]], k);
  out += lab(46 * k, 82 * k, '4 · CLIPS COUNTED @ MAX PITCH');
  // 5 · exit through wall: keyed pin outside + strain relief inside
  const e = [Wp, 74 * k];
  out += PLINE([[c2[0], 74 * k], [e[0] - 5 * k, 74 * k]], W.mid);
  out += strainRelief(e[0] - 5 * k, e[1], 0, k);
  out += keyPin(e[0], e[1], 4.5 * k);
  out += lab(92 * k, 86.5 * k, '5 · WALL EXIT: RELIEF + KEYED PIN');
  return frame(Wp, Hp, out, 10);
}
