// js/tech/geom.js — planar geometry in mm, y-down. Pure + deterministic, no deps.
// Ported from the Claude Design rule engine (DF-TO-R rev A) + editor additions.
export const TAU = Math.PI * 2;
export const fmt = n => { const v = Math.round(n * 100) / 100; return Object.is(v, -0) ? '0' : String(v); };

export function hash(seed, k) {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(k | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// deterministic string hash (for id-keyed jitter)
export function shash(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function bbox(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export function centroid(p) {
  let sx = 0, sy = 0;
  for (const [x, y] of p) { sx += x; sy += y; }
  return [sx / p.length, sy / p.length];
}
export function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a) / 2;
}
export function perimeter(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return s;
}
export function cumlen(p) {
  const L = [0];
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; L.push(L[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  return L;
}
// point + outward normal at arc length s
export function pointAt(p, s) {
  const L = cumlen(p), P = L[p.length];
  s = ((s % P) + P) % P;
  let i = 0;
  while (i < p.length - 1 && L[i + 1] < s) i++;
  const a = p[i], b = p[(i + 1) % p.length];
  const l = Math.max(1e-9, L[i + 1] - L[i]), t = (s - L[i]) / l;
  const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
  const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
  let nx = ty, ny = -tx;
  const c = centroid(p);
  if ((x - c[0]) * nx + (y - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return { x, y, nx, ny, tx, ty };
}
// arc position of the boundary point closest to (x,y) — editor picking
export function closestS(p, x, y) {
  const P = perimeter(p);
  let bs = 0, bd = Infinity;
  for (let i = 0; i < 300; i++) {
    const s = P * i / 300, q = pointAt(p, s);
    const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
    if (d < bd) { bd = d; bs = s; }
  }
  let step = P / 300;
  for (let r = 0; r < 20; r++) { // golden-ish refine
    for (const sg of [-1, 1]) {
      const q = pointAt(p, bs + sg * step / 2);
      const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
      if (d < bd) { bd = d; bs = bs + sg * step / 2; }
    }
    step /= 2;
  }
  return ((bs % P) + P) % P;
}
function edgeNormal(p, i, c) {
  const a = p[i], b = p[(i + 1) % p.length];
  const l = Math.max(1e-9, Math.hypot(b[0] - a[0], b[1] - a[1]));
  let nx = (b[1] - a[1]) / l, ny = -(b[0] - a[0]) / l;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if ((mx - c[0]) * nx + (my - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
}
// inward offset via miter-clamped bisector (valid for star-shaped outlines);
// negative d offsets OUTWARD (bumper bands, flanges)
export function offsetInward(p, d) {
  const c = centroid(p), n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const nPrev = edgeNormal(p, (i - 1 + n) % n, c), nNext = edgeNormal(p, i, c);
    let bx = nPrev[0] + nNext[0], by = nPrev[1] + nNext[1];
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const cosHalf = Math.sqrt(Math.max(0.05, (1 + nPrev[0] * nNext[0] + nPrev[1] * nNext[1]) / 2));
    const m = Math.sign(d) * Math.min(Math.abs(d) / cosHalf, 3 * Math.abs(d));
    out.push([p[i][0] - bx * m, p[i][1] - by * m]);
  }
  return out;
}
// corner clusters: runs of vertices whose summed turn >= 45 deg. Returns
// [{x,y,ix,iy,s}] where (ix,iy) is the inward bisector and s the arc position.
export function cornerClusters(p, minTurn = 45) {
  const n = p.length, c = centroid(p), L = cumlen(p), turns = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], d = p[(i + 1) % n];
    const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - b[0], d[1] - b[1]];
    const lu = Math.hypot(u[0], u[1]) || 1, lv = Math.hypot(v[0], v[1]) || 1;
    const dot = Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)));
    turns.push(Math.acos(dot) * 180 / Math.PI);
  }
  // a cluster is a chain of turning vertices linked by SHORT edges (arc segments,
  // chamfer cuts) — a long straight edge always breaks the run. Start scanning at a
  // vertex whose incoming edge is long, so no cluster is split across the seam.
  const edgeLen = i => { const a = p[(i - 1 + n) % n], b = p[i]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  let i0 = 0;
  for (let i = 0; i < n; i++) if (edgeLen(i) > 8) { i0 = i; break; }
  const used = new Array(n).fill(false), clusters = [];
  for (let o = 0; o < n; o++) {
    const i = (i0 + o) % n;
    if (used[i] || turns[i] < 10) continue;
    let js = [i], j = (i + 1) % n;
    while (turns[j] >= 10 && !used[j] && edgeLen(j) <= 8 && js.length < n) { js.push(j); j = (j + 1) % n; }
    let sum = 0;
    for (const q of js) { sum += turns[q]; used[q] = true; }
    if (sum >= minTurn) {
      // angular MIDPOINT of the run — symmetric on rounded/chamfered corners
      let acc = 0, best = js[0];
      for (const q of js) { acc += turns[q]; if (acc >= sum / 2) { best = q; break; } }
      const b = p[best];
      const nPrev = edgeNormal(p, (best - 1 + n) % n, c), nNext = edgeNormal(p, best, c);
      let bx = nPrev[0] + nNext[0], by = nPrev[1] + nNext[1];
      const bl = Math.hypot(bx, by) || 1;
      clusters.push({ x: b[0], y: b[1], ix: -bx / bl, iy: -by / bl, s: L[best] });
    }
  }
  clusters.sort((a, b) => a.s - b.s);
  return clusters;
}
export function pointInPoly(p, x, y) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// largest centred rect inscribed in polygon (binary search, deterministic)
export function inscribedRect(p, pad = 0) {
  const c = centroid(p), bb = bbox(p);
  const test = f => {
    const hw = f * bb.w / 2 + pad, hh = f * bb.h / 2 + pad;
    for (let i = 0; i < 24; i++) {
      const t = i / 24, e = Math.floor(t * 4), u = t * 4 - e;
      let x, y;
      if (e === 0) { x = c[0] - hw + 2 * hw * u; y = c[1] - hh; }
      else if (e === 1) { x = c[0] + hw; y = c[1] - hh + 2 * hh * u; }
      else if (e === 2) { x = c[0] + hw - 2 * hw * u; y = c[1] + hh; }
      else { x = c[0] - hw; y = c[1] + hh - 2 * hh * u; }
      if (!pointInPoly(p, x, y)) return false;
    }
    return true;
  };
  let lo = 0, hi = 1;
  for (let i = 0; i < 36; i++) { const mid = (lo + hi) / 2; if (test(mid)) lo = mid; else hi = mid; }
  const hw = lo * bb.w / 2, hh = lo * bb.h / 2;
  return { x: c[0] - hw, y: c[1] - hh, w: 2 * hw, h: 2 * hh };
}
// max outward-normal deviation (deg) across a perimeter run of width w centred on s
export function flatness(pts, s, w) {
  const q0 = pointAt(pts, s);
  let max = 0;
  for (let j = -2; j <= 2; j++) {
    const q = pointAt(pts, s + (w * j) / 4);
    const d = Math.max(-1, Math.min(1, q.nx * q0.nx + q.ny * q0.ny));
    max = Math.max(max, (Math.acos(d) * 180) / Math.PI);
  }
  return max;
}
// nearest arc position whose run of width w is flat within tol — a chamfer edge
// longer than w qualifies (the "port fits entirely inside the chamfer" exception)
export function snapToFlat(pts, s, w, tol = 12) {
  const P = perimeter(pts);
  if (flatness(pts, s, w) <= tol) return ((s % P) + P) % P;
  const maxStep = Math.floor(P / 2);
  for (let step = 1; step <= maxStep; step++) {
    for (const sg of [1, -1]) {
      const s2 = s + sg * step;
      if (flatness(pts, s2, w) <= tol) return ((s2 % P) + P) % P;
    }
  }
  return ((s % P) + P) % P;
}

// ---- outline constructors (all CONTINUOUS inputs are still computed, never traced)
export function roundedRect(w, h, r, seg = 4) {
  const p = [], q = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) { const a = a0 + (Math.PI / 2) * (i / seg); p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  q(w - r, r, -Math.PI / 2); q(w - r, h - r, 0); q(r, h - r, Math.PI / 2); q(r, r, Math.PI);
  return p;
}
export function chamferRect(w, h, ch) {
  return [[ch, 0], [w - ch, 0], [w, ch], [w, h - ch], [w - ch, h], [ch, h], [0, h - ch], [0, ch]];
}
export function pill(w, h) { return roundedRect(w, h, Math.min(w, h) / 2 - 0.01, 7); }
export function blob(w, h, seed, n = 56) {
  const a = w / 2, b = h / 2, p = [];
  const amp = [0.10, 0.06, 0.045].map((v, i) => v * (0.6 + 0.8 * hash(seed, i + 10)));
  const ph = [0, 1, 2].map(i => hash(seed, i) * TAU);
  const kk = [2, 3, 5];
  for (let i = 0; i < n; i++) {
    const th = TAU * i / n;
    let f = 1;
    for (let j = 0; j < 3; j++) f += amp[j] * Math.sin(kk[j] * th + ph[j]);
    p.push([a + a * Math.cos(th) * f, b + b * Math.sin(th) * f]);
  }
  return p;
}
export function translate(p, dx, dy) { return p.map(([x, y]) => [x + dx, y + dy]); }
