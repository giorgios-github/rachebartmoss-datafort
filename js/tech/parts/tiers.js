// parts/tiers.js — INTEGRATION SERIES: one function stack (sense-optic + compute +
// link-rf) drawn at four integration levels. Integration IS the tier.
// T1 street: 3 discrete parts + adapters + loom. T3 corpo: one sealed sliver, 2 ports,
// potted, latent telemetry. T4 milspec: denser, captive one-way fasteners, kill-switch
// stub, wider rated envelope. T5 prototype: no bin, irregular computed geometry, no marks.
import { L, C, RC, TX, POLY, PLINE, frame, N, W, DASH, G, pad, keyPin, seat, screwMini } from './lib.js';
import { lead, loom } from './loom.js';

export const SERIES = [
  { tier: 'T1', label: 'STREET — DISCRETE + ADAPTERS + LOOM', env: 'rated 1.0 · push +1 · instab 0.3/push' },
  { tier: 'T3', label: 'CORPO — ONE SEALED SLIVER', env: 'rated 1.0 · push +2 · instab 0.12/push · latent telemetry' },
  { tier: 'T4', label: 'MILSPEC — DENSER, WIDER ENVELOPE', env: 'rated 1.5 · push +3 · instab 0.06/push · kill-switch' },
  { tier: 'T5', label: 'PROTOTYPE — NO BIN, NO MARKS', env: 'envelope UNKNOWN — drawn without a rating stencil' }
];

// T1: three discrete organs on a jury plate, adapter under the optic, loom between
export function drawT1(k = 3.2) {
  const Wp = 96 * k, Hp = 62 * k;
  let out = RC(0, 0, Wp, Hp, W.vis, '#fff');                          // street carrier plate
  for (const [mx, my] of [[3, 3], [93, 3], [93, 59], [3, 59]]) out += C(mx * k, my * k, 1 * k, W.fine);
  // optic (round, on an adapter plate — pattern mismatch drawn)
  const ox = 18 * k, oy = 20 * k;
  out += RC(ox - 9 * k, oy - 9 * k, 18 * k, 18 * k, W.mid, '#fff');   // adapter
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out += C(ox + sx * 7 * k, oy + sy * 7 * k, 0.8 * k, 0.7);
  out += C(ox, oy, 6.5 * k, W.cut, '#fff') + C(ox, oy, 3 * k, W.vis, '#fff') + C(ox, oy, 1.2 * k, W.mid, '#fff');
  // compute (QFP on carrier)
  const bx = 46 * k, by = 12 * k;
  out += RC(bx, by, 18 * k, 16 * k, W.vis, '#fff');
  out += RC(bx + 4 * k, by + 3.5 * k, 9 * k, 9 * k, W.vis, '#fff');
  for (let i = 0; i < 4; i++) { out += L(bx + 5.5 * k + i * 2 * k, by + 3.5 * k, bx + 5.5 * k + i * 2 * k, by + 2 * k, 0.7); out += L(bx + 5.5 * k + i * 2 * k, by + 12.5 * k, bx + 5.5 * k + i * 2 * k, by + 14 * k, 0.7); }
  // link-rf (can + stub antenna up)
  const rx = 76 * k, ry2 = 16 * k;
  out += RC(rx - 7 * k, ry2 - 6 * k, 14 * k, 12 * k, W.vis, '#fff');
  out += RC(rx - 5.5 * k, ry2 - 4.5 * k, 11 * k, 9 * k, 0.7);
  out += L(rx, ry2 - 6 * k, rx, ry2 - 11 * k, W.cut) + C(rx, ry2 - 11.8 * k, 0.9 * k, W.mid, '#fff');
  // loom: optic → compute → rf, one trunk each; pigtail lump on the rf leg (family mismatch)
  out += pad(ox + 7 * k, oy + 4 * k, 1.1 * k) + pad(bx - 1.5 * k, by + 8 * k, 1.1 * k);
  out += loom([[ox + 8 * k, oy + 4 * k], [bx - 2.5 * k, oy + 4 * k], [bx - 2.5 * k, by + 8 * k]], 4, k);
  out += pad(bx + 18 * k + 1.5 * k, by + 8 * k, 1.1 * k);
  out += lead([bx + 19.5 * k, by + 8 * k], [rx - 7 * k - 3.5 * k, ry2], 'x');
  out += RC(rx - 7 * k - 3.2 * k, ry2 - 1.5 * k, 2.6 * k, 3 * k, W.mid, '#fff', null, 0.8 * k); // pigtail lump = the graft tell
  // cell seat (external power, discrete again)
  out += seat(30 * k, 42 * k, 26 * k, 14 * k, 'NE');
  out += TX(43 * k, 51 * k, 'CELL SEAT', 8);
  return frame(Wp, Hp, out, 8);
}

// T3: one sealed sliver — pot field, 2 keyed ports, etched plate, latent organ ghost
export function drawT3(k = 3.2, resolved = false) {
  const Wp = 54 * k, Hp = 20 * k;
  let out = RC(0, 0, Wp, Hp, W.cut, '#fff', null, 2 * k);
  out += RC(1.6 * k, 1.6 * k, Wp - 3.2 * k, Hp - 3.2 * k, 0, 'url(#pot)');
  out += keyPin(-2.4 * k, Hp * 0.5, 4 * k) + keyPin(Wp + 2.4 * k, Hp * 0.5, 4 * k);
  // etched maker plate (die-molded lineage)
  out += RC(Wp / 2 - 7 * k, Hp - 4.6 * k, 14 * k, 3 * k, 0.7, '#fff');
  out += TX(Wp / 2, Hp - 2.4 * k, 'KIROSHI SL-3', 6.5);
  // the three functions exist only as faint organ outlines when resolved
  if (resolved) {
    out += C(10 * k, 8 * k, 4 * k, 0.7, 'none') + RC(20 * k, 4.5 * k, 9 * k, 7 * k, 0.7) + RC(34 * k, 4.5 * k, 8 * k, 7 * k, 0.7);
    // the LATENT organ: one unexplained extra, HL dashed
    out += RC(45 * k, 5 * k, 5.5 * k, 6 * k, 0.8, 'none', DASH.hl);
    out += TX(47.8 * k, 14.6 * k, '?', 9);
  }
  return frame(Wp + 10 * k, Hp, `<g transform="translate(${(5 * k).toFixed(1)},0)">${out}</g>`, 8);
}

// T4: denser still — smaller sliver, captive one-way screws, kill-switch stub, T4 stencil
export function drawT4(k = 3.2) {
  const Wp = 40 * k, Hp = 15 * k;
  let out = RC(0, 0, Wp, Hp, W.cut, '#fff');
  out += RC(1.2 * k, 1.2 * k, Wp - 2.4 * k, Hp - 2.4 * k, 0, 'url(#pot)');
  // captive one-way fasteners (tri-drive), COUNTED 2
  out += screwMini(3 * k, Hp / 2, 1.1 * k, 'tri') + screwMini(Wp - 3 * k, Hp / 2, 1.1 * k, 'tri');
  // 2 ports, one side (denser routing)
  out += keyPin(-2.2 * k, Hp * 0.32, 3.6 * k) + keyPin(-2.2 * k, Hp * 0.68, 3.6 * k);
  // kill-switch stub: recessed loop, top edge
  out += L(Wp * 0.62, 0, Wp * 0.62, -1.8 * k, W.mid) + L(Wp * 0.7, 0, Wp * 0.7, -1.8 * k, W.mid);
  out += L(Wp * 0.62, -1.8 * k, Wp * 0.7, -1.8 * k, W.mid);
  out += TX(Wp * 0.66, -2.8 * k, 'KILL', 6);
  // rating stencil: corner ticks + wider envelope figure
  for (const [cx2, cy2, dx, dy] of [[Wp * 0.18, Hp * 0.3, 1, 1], [Wp * 0.5, Hp * 0.3, -1, 1], [Wp * 0.5, Hp * 0.72, -1, -1], [Wp * 0.18, Hp * 0.72, 1, -1]]) {
    out += L(cx2, cy2, cx2 + dx * 1.6 * k, cy2, 0.8) + L(cx2, cy2, cx2, cy2 + dy * 1.2 * k, 0.8);
  }
  out += TX(Wp * 0.34, Hp * 0.58, 'RATED 1.5', 2.2 * k, 'middle', true);
  return frame(Wp + 9 * k, Hp + 3.5 * k, `<g transform="translate(${(4.5 * k).toFixed(1)},${(3 * k).toFixed(1)})">${out}</g>`, 8);
}

// T5: prototype register — irregular computed silhouette (hash-driven), no marks,
// no stencil, one unexplained port at an unquantised angle
export function drawT5(k = 3.2) {
  const cx = 26 * k, cy = 17 * k;
  const pts = [];
  const nV = 9;
  for (let i = 0; i < nV; i++) {
    const a = G.TAU * i / nV;
    const r = (13 + 6 * G.hash(41, i)) * k * (1 + 0.25 * Math.sin(3 * a));
    pts.push([cx + r * Math.cos(a) * 1.35, cy + r * Math.sin(a) * 0.75]);
  }
  let out = POLY(pts, W.cut, true, '#fff');
  // interior: two nested irregular offsets (unknown organs, resolved but unnamed)
  out += POLY(pts.map(([x, y]) => [cx + (x - cx) * 0.72, cy + (y - cy) * 0.72]), W.fine, true);
  out += POLY(pts.map(([x, y]) => [cx + (x - cx) * 0.4, cy + (y - cy) * 0.45]), 0.7, true, 'url(#pot)');
  // one port, off-axis (23° — no quantised angle)
  const pa = -0.4, px = cx + 21 * k * Math.cos(pa) * 1.32, py = cy + 21 * k * Math.sin(pa) * 0.78;
  out += L(cx + 14 * k * Math.cos(pa) * 1.32, cy + 14 * k * Math.sin(pa) * 0.78, px, py, W.mid);
  out += keyPin(px + 1.6 * k, py - 1 * k, 4 * k);
  return frame(56 * k, 34 * k, out, 8);
}
