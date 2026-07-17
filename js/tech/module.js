// js/tech/module.js — dress a TechPart into the DF-TO-000 look. The drawing is a
// PROJECTION of the model: nothing here is authored geometry, everything derives
// from the part record through the rule tables. Pure + deterministic.
//
// view = { pxPerMm? | fitPx?, frame?:{x,y,w,h},        frame = editor stage (mm) → stable coords
//          density:1|2|3, lod:'thumb'|'plate',          thumb hides ALL text/apparatus (the object itself)
//          mode:'exterior'|'section'|'exploded',
//          epistemic:'resolved'|'ghosted', dims?:bool }
import * as G from './geom.js';
import * as R from './rules.js';
import { defsBlock } from './law.js';
import { autoWires, effHeat } from './model.js';
import { catEmbed, catInner, catWallAnchor, catWirePad, catSlotAnchor, catSeatAnchor, catFigure, CAT_PAD } from './catalog.js';
const FOOT_K = 8;

const N = G.fmt;
const line = (x1, y1, x2, y2, w, dash) => `<line x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}" stroke="#111" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const circ = (cx, cy, r, w, fill = 'none', dash) => `<circle cx="${N(cx)}" cy="${N(cy)}" r="${N(Math.max(0.1, r))}" fill="${fill}" stroke="${w ? '#111' : 'none'}"${w ? ` stroke-width="${w}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const rect = (x, y, w2, h2, sw, fill = 'none', dash) => `<rect x="${N(x)}" y="${N(y)}" width="${N(Math.max(0.1, w2))}" height="${N(Math.max(0.1, h2))}" fill="${fill}" stroke="${sw ? '#111' : 'none'}"${sw ? ` stroke-width="${sw}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const txt = (x, y, s, size = 11, anchor = 'start', disp = false, extra = '') =>
  `<text x="${N(x)}" y="${N(y)}" font-size="${size}" text-anchor="${anchor}" fill="#111" stroke="none" style="font-family:${disp ? 'var(--head,Eurostile,sans-serif)' : 'var(--mono,monospace)'};${disp ? 'letter-spacing:2px;' : ''}"${extra}>${esc(s)}</text>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pathOf(pts, map) {
  let d = '';
  pts.forEach((p, i) => { const [x, y] = map(p); d += `${i ? 'L' : 'M'}${N(x)},${N(y)} `; });
  return d + 'Z';
}

// ---- fastener placement: corners first, then max pitch; ports & mounts win keep-outs
export function placeScrews(pts, wall, screw, part, keepPts) {
  const e = R.edgeDist(wall, screw);
  const P = G.perimeter(pts);
  if (part.screws && part.screws.length) {                     // MANUAL layout = design intent, verbatim
    return part.screws.map(({ t }) => {
      const s = (((t % 1) + 1) % 1) * P, q = G.pointAt(pts, s);
      return { x: q.x - q.nx * e, y: q.y - q.ny * e, s };
    }).sort((a, b) => a.s - b.s);
  }
  const corners = G.cornerClusters(pts);
  let cands = corners.map(c => ({ x: c.x + c.ix * e, y: c.y + c.iy * e, s: c.s }));
  const Pm = R.pitchMax(screw);
  if (cands.length >= 2) {
    const extra = [];
    for (let i = 0; i < cands.length; i++) {
      const a = cands[i], b = cands[(i + 1) % cands.length];
      const gap = ((b.s - a.s) + P) % P || P;
      const nIns = Math.floor(gap / Pm);
      for (let j = 1; j <= nIns; j++) {
        const q = G.pointAt(pts, a.s + gap * j / (nIns + 1));
        extra.push({ x: q.x - q.nx * e, y: q.y - q.ny * e, s: (a.s + gap * j / (nIns + 1)) % P });
      }
    }
    cands = cands.concat(extra);
  } else {
    const n = Math.max(2, Math.ceil(P / Pm));
    cands = [];
    for (let i = 0; i < n; i++) {
      const q = G.pointAt(pts, P * i / n);
      cands.push({ x: q.x - q.nx * e, y: q.y - q.ny * e, s: P * i / n });
    }
  }
  cands = cands.filter(c => !keepPts.some(pp => Math.hypot(pp.x - c.x, pp.y - c.y) < pp.keep + 1.5 * screw.d));
  cands.sort((a, b) => a.s - b.s);
  const max = part.fmax;
  if (max && cands.length > max) {
    const keep = [];
    for (let i = 0; i < Math.max(2, max); i++) keep.push(cands[Math.floor(i * cands.length / Math.max(2, max))]);
    cands = keep;
  }
  return cands;
}

// ---- ports: canonical t on the perimeter, snapped to a flat run (flat-seat rule)
export function placePorts(pts, ports) {
  const P = G.perimeter(pts);
  return (ports || []).map(sp => {
    const spec = R.PORT[sp.k] || R.PORT.data;
    const s = G.snapToFlat(pts, (sp.t ?? 0.5) * P, 2 * spec.half + 2);
    const q = G.pointAt(pts, s);
    return { ...sp, x: q.x, y: q.y, nx: q.nx, ny: q.ny, ang: Math.atan2(q.ny, q.nx) * 180 / Math.PI, keep: spec.keep, spec };
  });
}
// ---- perimeter-mounted features (antenna, rail) — placed like ports
export function placePerimFeats(pts, feats) {
  const P = G.perimeter(pts);
  return (feats || []).map((f, i) => {
    const spec = R.FEAT[f.k];
    if (!spec || !spec.perim) return { ...f, i, perim: false };
    const width = f.k === 'rail' ? spec.w : 6;
    const s = G.snapToFlat(pts, (f.t ?? 0.25) * P, width);
    const q = G.pointAt(pts, s);
    return { ...f, i, perim: true, x: q.x, y: q.y, nx: q.nx, ny: q.ny, tx: q.tx, ty: q.ty, ang: Math.atan2(q.ny, q.nx) * 180 / Math.PI, keep: spec.keep };
  });
}

// screws stay DISCREET: invisible at density 1, a fine circle at 2, full detail
// (captive ring + drive recess) only at 3 — hardware texture is opt-in ink.
function screwGlyph(x, y, dmm, k, origin, i, dens) {
  if (dens <= 1) return '';
  const r = (dens >= 3 ? 0.9 : 0.6) * dmm * k, out = [];
  out.push(circ(x, y, r, dens >= 3 ? R.W.mid : R.W.fine, '#fff'));
  if (dens >= 3 && R.captive(origin)) out.push(circ(x, y, 1.25 * dmm * k, R.W.fine));
  if (dens >= 3) {
    const g = R.driveFor(origin, i), rr = 0.55 * r;
    if (g === 'slot') out.push(line(x - rr, y, x + rr, y, 1.2));
    else if (g === 'cross') out.push(line(x - rr, y, x + rr, y, 1.2) + line(x, y - rr, x, y + rr, 1.2));
    else if (g === 'hex') {
      let d = '';
      for (let j = 0; j < 6; j++) { const a = Math.PI / 3 * j; d += `${j ? 'L' : 'M'}${N(x + rr * Math.cos(a))},${N(y + rr * Math.sin(a))} `; }
      out.push(`<path d="${d}Z" fill="none" stroke="#111" stroke-width="1"/>`);
    } else {
      const n = g === 'torx' ? 6 : 3;
      for (let j = 0; j < n; j++) {
        const a = -Math.PI / 2 + (Math.PI * 2 / n) * j;
        out.push(line(x, y, x + rr * Math.cos(a), y + rr * Math.sin(a), 1.2));
      }
    }
  }
  return out.join('');
}

function portGlyph(p, k, dens) {
  const g = [];
  const M = v => v * k;
  // local frame: +x outward
  if (p.k === 'power') {
    g.push(rect(0, -M(5), M(2.5), M(10), R.W.vis, '#fff'));
    g.push(circ(M(6.5), 0, M(4), R.W.vis, '#fff'));
    g.push(circ(M(6.5), 0, M(1), R.W.mid, '#fff'));
    g.push(line(M(6.5), -M(4), M(6.5), -M(2.2), 1));
  } else if (p.k === 'data') {
    g.push(rect(0, -M(4), M(8), M(8), R.W.vis, '#fff'));
    g.push(rect(M(8), -M(1.5), M(1.5), M(3), R.W.mid, '#fff'));
    for (let j = 0; j < 4; j++) g.push(line(M(2), -M(3) + M(2) * j, M(6), -M(3) + M(2) * j, 1));
  } else if (p.k === 'mech') {
    g.push(rect(0, -M(6), M(3), M(12), R.W.vis, '#fff'));
    g.push(circ(M(8), 0, M(5), R.W.vis, '#fff'));
    g.push(circ(M(8), 0, M(2.5), R.W.mid, '#fff'));
    g.push(line(M(8) - M(3.4), 0, M(8) + M(3.4), 0, 0.7, R.DASH.cl));
    g.push(line(M(8), -M(3.4), M(8), M(3.4), 0.7, R.DASH.cl));
  } else {
    g.push(rect(0, -M(7), M(2.5), M(14), R.W.vis, '#fff'));
    g.push(circ(M(9), 0, M(6), R.W.vis, '#fff'));
    g.push(circ(M(9), 0, M(3), R.W.mid, '#fff'));
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + Math.PI / 2 * j;
      g.push(circ(M(9) + M(4.6) * Math.cos(a), M(4.6) * Math.sin(a), 1.6, 0, '#111'));
    }
  }
  if (dens >= 3) g.push(rect(-M(p.keep), -M(p.keep), M(p.keep), M(2 * p.keep), R.W.fine, 'none', R.DASH.hl));
  return g.join('');
}

// ---- surface features: FIXED-size control glyphs. `hidden` = drawn HL (above the
// section plane); every feature keeps a wire pad the loom can land on.
function faceFeatGlyph(f, x, y, k, dens, hidden) {
  const M = v => v * k, out = [];
  const H = hidden ? R.DASH.hl : '';
  const wv = hidden ? R.W.fine : R.W.vis, wm = hidden ? R.W.fine : R.W.mid;
  if (f.k === 'button') {
    out.push(circ(x, y, M(R.FEAT.button.r), wv, hidden ? 'none' : '#fff', H));
    out.push(circ(x, y, M(1.35), wm, 'none', H));
    if (dens >= 3 && !hidden) out.push(circ(x, y, 1.1, 0, '#111'));
  } else if (f.k === 'switch') {
    const w = R.FEAT.switch.w, h = R.FEAT.switch.h;
    out.push(rect(x - M(w / 2), y - M(h / 2), M(w), M(h), wv, hidden ? 'none' : '#fff', H));
    out.push(circ(x - M(w / 4), y, M(1.15), wm, hidden ? 'none' : '#fff', H));
    if (dens >= 2 && !hidden) out.push(line(x + M(w / 4) - M(0.8), y - M(1), x + M(w / 4) + M(0.8), y + M(1), 0.8));
  } else if (f.k === 'led') {
    out.push(circ(x, y, M(R.FEAT.led.r), wm, hidden ? 'none' : '#fff', H));
    if (!hidden) out.push(circ(x, y, M(0.45), 0, '#111'));
  } else if (f.k === 'dial') {
    const r = R.FEAT.dial.r;
    out.push(circ(x, y, M(r), wv, hidden ? 'none' : '#fff', H));
    if (!hidden) out.push(line(x, y, x, y - M(r) + 1, R.W.mid));
    if (dens >= 2 && !hidden) for (let j = 0; j < R.FEAT.dial.ticks; j++) {   // ticks COUNTED
      const a = -Math.PI / 2 + (Math.PI * 2 / R.FEAT.dial.ticks) * j;
      out.push(line(x + M(r + 0.6) * Math.cos(a), y + M(r + 0.6) * Math.sin(a), x + M(r + 1.6) * Math.cos(a), y + M(r + 1.6) * Math.sin(a), 0.8));
    }
  } else if (f.k === 'screen') {
    const w = f.w || 16, h = f.h || 10;
    out.push(rect(x, y, M(w), M(h), wv, hidden ? 'none' : '#fff', H));
    if (dens >= 2 && !hidden) {
      out.push(rect(x + M(1.2), y + M(1.2), M(w - 2.4), M(h - 2.4), R.W.fine));
      const c = 1.1;   // corner register ticks
      for (const [qx, qy, sx, sy] of [[1.2, 1.2, 1, 1], [w - 1.2, 1.2, -1, 1], [1.2, h - 1.2, 1, -1], [w - 1.2, h - 1.2, -1, -1]])
        out.push(line(x + M(qx), y + M(qy), x + M(qx + sx * c), y + M(qy), 0.7) + line(x + M(qx), y + M(qy), x + M(qx), y + M(qy + sy * c), 0.7));
    }
    if (dens >= 3 && !hidden) out.push(line(x + M(2.4), y + M(h - 2), x + M(w * 0.45), y + M(2), 0.6));
  } else if (f.k === 'keypad') {
    const rows = f.rows || 4, cols = f.cols || 3, key = R.FEAT.keypad.key, pit = R.FEAT.keypad.pitch;
    const w = cols * pit + 1, h = rows * pit + 1;
    out.push(rect(x - M(0.8), y - M(0.8), M(w + 0.6), M(h + 0.6), wm, 'none', H));
    if (!hidden) for (let rI = 0; rI < rows; rI++) for (let cI = 0; cI < cols; cI++)
      out.push(rect(x + M(cI * pit + (pit - key) / 2), y + M(rI * pit + (pit - key) / 2), M(key), M(key), R.W.fine, '#fff'));
    if (dens >= 3 && !hidden) out.push(circ(x + M(pit * 1.5), y + M(pit * 3.5 - pit / 2 + (pit - key) / 2 + key / 2 - (pit - key) / 2) , 0.9, 0, '#111'));
  }
  return out.join('');
}
// wire pad (mm point) the loom lands on for a face feature
function featPadMm(f) {
  if (f.k === 'screen') return [f.at[0] + (f.w || 16) / 2, f.at[1] + (f.h || 10) / 2];
  if (f.k === 'keypad') return [f.at[0] + ((f.cols || 3) * R.FEAT.keypad.pitch) / 2, f.at[1] + ((f.rows || 4) * R.FEAT.keypad.pitch) / 2];
  return [f.at[0], f.at[1]];
}

// ---- perimeter features
function antennaGlyph(f, part, mapP, k, dens) {
  const spec = R.FEAT.antenna;
  const len = f.len || spec.len;
  const lean = (G.hash(G.shash(part.id), 40 + f.i) - 0.5) * (part.origin === 'FACTORY' ? 6 : 22) * Math.PI / 180; // street whips lean
  const a = Math.atan2(f.ny, f.nx) + lean;
  const [bx, by] = mapP(f.x, f.y);
  const out = [];
  out.push(rect(-3 * k, -1.2 * k, 6 * k, 2.4 * k, R.W.vis, '#fff'));                       // surface mount pad
  let d = '', px = 0, py = 0;
  for (let j = 0; j < spec.coil; j++) {                                                     // coupling coil, COUNTED turns
    const y0 = -(1.2 + j * 1.7) * k;
    d += `M${N(px + 1.6 * k)},${N(y0)} A${N(1.6 * k)},${N(0.85 * k)} 0 0 0 ${N(px - 1.6 * k)},${N(y0 - 1.7 * k * 0.5)} `;
  }
  out.push(`<path d="${d}" fill="none" stroke="#111" stroke-width="${R.W.mid}"/>`);
  const top = -(1.2 + spec.coil * 1.7) * k;
  out.push(line(0, top, 0, top - len * k, R.W.vis));
  out.push(circ(0, top - len * k - 1.2 * k, 1.2 * k, R.W.mid, '#fff'));
  const rot = a * 180 / Math.PI + 90;
  return `<g transform="translate(${N(bx)},${N(by)}) rotate(${N(rot)})">${out.join('')}</g>`;
}
function railGlyph(f, mapP, k, dens) {
  const w = R.FEAT.rail.w;
  const [bx, by] = mapP(f.x, f.y);
  const rot = Math.atan2(f.ny, f.nx) * 180 / Math.PI + 90;
  const out = [];
  out.push(rect(-w / 2 * k, 0, w * k, 2.2 * k, R.W.vis, '#fff'));                          // base plate on the surface
  // dovetail feet — the clamp that grabs the host rail
  const foot = `M0,0 L${N(1.6 * k)},0 L${N(2.6 * k)},${N(1.8 * k)} L${N(0.6 * k)},${N(3.4 * k)} L0,${N(3.4 * k)} Z`;
  out.push(`<g transform="translate(${N(-w / 2 * k + 1 * k)},${N(2.2 * k)})"><path d="${foot}" fill="#fff" stroke="#111" stroke-width="${R.W.vis}"/></g>`);
  out.push(`<g transform="translate(${N(w / 2 * k - 1 * k)},${N(2.2 * k)}) scale(-1,1)"><path d="${foot}" fill="#fff" stroke="#111" stroke-width="${R.W.vis}"/></g>`);
  if (dens >= 2) out.push(line(-w / 2 * k + 4 * k, 1.1 * k, w / 2 * k - 4 * k, 1.1 * k, R.W.fine));
  if (dens >= 3) for (let j = 0; j < 2; j++) out.push(circ((-w / 4 + j * w / 2) * k, 1.1 * k, 0.9 * k, R.W.fine, '#fff'));
  return `<g transform="translate(${N(bx)},${N(by)}) rotate(${N(rot)})">${out.join('')}</g>`;
}

// ---- interior furniture, drawn in section. All sub-features FIXED/COUNTED.
function gutGlyph(g, part, mapP, k, dens, ghost) {
  const [x, y] = mapP(g.at[0], g.at[1]);
  const w = g.w * k, h = g.h * k;
  const out = [];
  const dash = ghost ? R.DASH.ph : '';
  const wv = ghost ? 0.9 : R.W.mid;
  if (ghost) { out.push(rect(x, y, w, h, wv, '#fff', dash)); return out.join(''); }
  if (g.k === 'cat') {                                                                        // DF-TO-C catalogue part, embedded
    out.push(catEmbed(g.cat, g.params, x, y, w, h, dens, undefined, g.rot || 0));
  } else if (g.k === 'board') {
    out.push(rect(x, y, w, h, R.W.mid, '#fff'));
    const so = Math.min(2.5, g.w / 5) * k;
    if (dens >= 2) for (const [qx, qy] of [[so, so], [w - so, so], [so, h - so], [w - so, h - so]])
      out.push(circ(x + qx, y + qy, 1.1 * k, R.W.fine, '#fff'));
    const q = R.qfpFor(Math.min(g.w, g.h));
    if (q + 3 <= Math.min(g.w, g.h)) {
      const qx = x + w * 0.36 - q * k / 2, qy = y + h / 2 - q * k / 2;
      out.push(rect(qx, qy, q * k, q * k, R.W.mid, '#fff'));
      if (dens >= 3 && q * k > 14) {
        const nP2 = 4;
        for (let j = 1; j <= nP2; j++) {
          const o = j * q * k / (nP2 + 1);
          out.push(line(qx + o, qy - 2, qx + o, qy, 0.7) + line(qx + o, qy + q * k, qx + o, qy + q * k + 2, 0.7));
        }
        out.push(circ(qx + 2.2, qy + q * k - 2.2, 1.1, 0, '#111'));
      }
      if (dens >= 3) {
        const nP = Math.max(1, Math.min(6, Math.floor(g.w * g.h / 60)));                     // passives COUNTED
        for (let j = 0; j < nP; j++) {
          const gx = x + w * (0.6 + 0.3 * G.hash(G.shash(part.id) + 7, j)), gy = y + h * (0.15 + 0.7 * G.hash(G.shash(part.id) + 11, j));
          out.push(rect(gx - 1.7, gy - 1, 3.4, 2, 0.7, '#fff') + rect(gx - 1.7, gy - 1, 1.1, 2, 0, '#111') + rect(gx + 0.6, gy - 1, 1.1, 2, 0, '#111'));
        }
      }
    }
  } else if (g.k === 'cell') {
    out.push(rect(x, y, w, h, R.W.mid, '#fff'));
    if (dens >= 2) {                                                                          // wound-cell hint
      const r0 = Math.min(h / 2 - 2, 8);
      out.push(`<path d="M${N(x + r0 + 2)},${N(y + h / 2 - r0)} A${N(r0)},${N(r0)} 0 0 0 ${N(x + r0 + 2)},${N(y + h / 2 + r0)}" fill="none" stroke="#111" stroke-width="0.8"/>`);
      out.push(`<path d="M${N(x + r0 + 2)},${N(y + h / 2 - r0 * 0.55)} A${N(r0 * 0.55)},${N(r0 * 0.55)} 0 0 0 ${N(x + r0 + 2)},${N(y + h / 2 + r0 * 0.55)}" fill="none" stroke="#111" stroke-width="0.8"/>`);
    }
    out.push(rect(x + w, y + h / 2 - 1.2 * k, 1.4 * k, 2.4 * k, R.W.mid, '#fff'));            // terminal
    if (dens >= 3) out.push(line(x + w - 3.5 * k, y + 2.2 * k, x + w - 1.5 * k, y + 2.2 * k, 0.8) + line(x + w - 2.5 * k, y + 1.2 * k, x + w - 2.5 * k, y + 3.2 * k, 0.8));
  } else if (g.k === 'stack') {
    out.push(rect(x, y, w, h, R.W.mid, '#fff'));
    const pr = Math.min(g.w * 0.30, 2.4) * k;                                                 // payload COUNTED
    const n = Math.max(2, Math.floor((g.h - 4) / (2 * pr / k + 0.6)));
    for (let j = 0; j < n; j++) {
      const off = (j % 2 ? 1 : -1) * (g.w > 9 ? 0.16 * w : 0);
      out.push(circ(x + w / 2 + off, y + 2 * k + pr + j * (2 * pr + 0.6 * k), pr, R.W.fine, '#fff'));
    }
    if (dens >= 2) {                                                                          // follower spring
      let d = '';
      for (let j = 0; j < 3; j++) d += `M${N(x + w * 0.2)},${N(y + h - (2 + j * 1.6) * k)} A${N(w * 0.3)},${N(0.8 * k)} 0 0 ${j % 2} ${N(x + w * 0.8)},${N(y + h - (2 + j * 1.6) * k)} `;
      out.push(`<path d="${d}" fill="none" stroke="#111" stroke-width="0.8"/>`);
    }
  } else if (g.k === 'mech') {
    const prof = G.chamferRect(g.w, g.h, Math.min(2, g.w / 6));
    out.push(`<path d="${pathOf(prof.map(([px2, py2]) => [px2 + g.at[0], py2 + g.at[1]]), ([mx, my]) => mapP(mx, my))}" fill="#fff" stroke="#111" stroke-width="${R.W.mid}"/>`);
    const b1 = [x + w * 0.25, y + h * 0.5], b2 = [x + w * 0.75, y + h * 0.5];                 // pivot bores
    for (const [bx2, by2] of [b1, b2]) {
      out.push(circ(bx2, by2, 1.4 * k, R.W.mid, '#fff'));
      if (dens >= 2) out.push(line(bx2 - 2 * k, by2, bx2 + 2 * k, by2, 0.6, R.DASH.cl) + line(bx2, by2 - 2 * k, bx2, by2 + 2 * k, 0.6, R.DASH.cl));
    }
    if (dens >= 2) {                                                                          // coil spring between pivots
      let d = '';
      const n = 4;
      for (let j = 0; j < n; j++) {
        const xa = b1[0] + (b2[0] - b1[0]) * (j / n), xb = b1[0] + (b2[0] - b1[0]) * ((j + 1) / n);
        d += `M${N(xa)},${N(y + h * 0.5)} A${N((xb - xa) / 2)},${N(2.2 * k)} 0 0 ${j % 2} ${N(xb)},${N(y + h * 0.5)} `;
      }
      out.push(`<path d="${d}" fill="none" stroke="#111" stroke-width="0.8"/>`);
    }
  } else if (g.k === 'module') {                                                              // nested sealed module
    out.push(rect(x, y, w, h, 0, 'url(#pot)'));
    out.push(rect(x, y, w, h, R.W.vis, 'none'));
    out.push(rect(x - 1.4 * k, y + h / 2 - 1.2 * k, 1.4 * k, 2.4 * k, R.W.mid, '#fff'));      // its own port stub
    if (dens >= 2) out.push(txt(x + w / 2, y + h + 9, (g.label || 'SEALED').toUpperCase(), 8, 'middle'));
  }
  // PUSHED past the rated envelope — the transgression is drawn, never badged:
  // hot-wire bypass jumper over the governor pads + reinforcement straps (COUNTED
  // = overdrive level) + the maker's rating stencil struck through.
  if (g.push) {
    const jx1 = x + w - 2.2 * k, jx0 = x + w - 5.4 * k, jy = y - 0.8 * k;
    out.push(circ(jx0, jy, 0.8, 0.8, '#fff') + circ(jx1, jy, 0.8, 0.8, '#fff'));
    out.push(`<path d="M${N(jx0)},${N(jy)} Q${N((jx0 + jx1) / 2)},${N(jy - 3.5 * k)} ${N(jx1)},${N(jy)}" fill="none" stroke="#111" stroke-width="1"/>`);
    for (let j = 0; j < g.push; j++) {
      const sxp = x + w * (0.18 + 0.16 * j);
      out.push(rect(sxp, y - 1.2, 2.2 * k, h + 2.4, 0.8, 'url(#h45)'));
    }
    if (dens >= 2 && w > 22 * k / 2) {
      const tx0 = x + w * 0.66, ty0 = y + h + 8;
      out.push(txt(tx0, ty0, 'RATED', 7, 'middle'));
      out.push(line(tx0 - 11, ty0 - 2.5, tx0 + 11, ty0 - 2.5, 1));                            // struck through
    }
  }
  return out.join('');
}
function gutCenterMm(g) { return [g.at[0] + g.w / 2, g.at[1] + g.h / 2]; }

// ---- the renderer
export function renderModule(part, view = {}) {
  const pts = part.outline;
  const bb = G.bbox(pts);
  const padMm = 18;
  const lod = view.lod || 'plate';
  const dens = view.density || 2;                     // decoupled from lod (thumb+dense is legal)
  const mode = view.mode || 'exterior';
  const epis = view.epistemic || 'resolved';
  const tier = R.tierOf(Math.max(bb.w, bb.h));
  const wall = R.wallFor(tier);
  const screw = R.screwFor(wall);
  const depth = R.depthFor(tier);

  let k, map, wPx, hPx, padPx;
  if (view.frame) {                                   // editor stage: mm→px straight through
    k = view.pxPerMm || 6;
    map = ([x, y]) => [(x - view.frame.x) * k, (y - view.frame.y) * k];
    wPx = view.frame.w * k; hPx = view.frame.h * k; padPx = 0;
  } else {
    k = view.pxPerMm || (view.fitPx || 560) / (bb.w + 2 * padMm);
    padPx = padMm * k + (lod !== 'thumb' ? 34 : 6);
    map = ([x, y]) => [(x - bb.x) * k + padPx, (y - bb.y) * k + padPx];
    wPx = bb.w * k + 2 * padPx; hPx = bb.h * k + 2 * padPx;
  }
  const mapP = (x, y) => map([x, y]);

  const inner = G.offsetInward(pts, wall);
  const ports = placePorts(pts, part.ports);
  const pFeats = placePerimFeats(pts, part.feats).filter(f => f.perim);
  const fFeats = part.feats.map((f, i) => ({ ...f, i })).filter(f => !(R.FEAT[f.k] || {}).perim);
  const keepPts = ports.concat(pFeats);
  const screws = placeScrews(pts, wall, screw, part, keepPts);
  const zone = G.inscribedRect(pts, -(wall + 2));
  const cavRect = G.inscribedRect(inner, -2);
  const hat = R.hatchFor(part.origin), hatB = R.hatchOpp(hat);
  const vent = R.ventFor(tier);
  const needV = R.ventCount(effHeat(part));            // pushed parts run hot — the vents answer for it
  const perRow = Math.max(0, Math.floor((zone.w - 4) / vent.pitch));
  const nV = Math.min(needV, perRow * 2);
  const wires = autoWires(part);

  const outlineD = pathOf(pts, map), innerD = pathOf(inner, map);
  const L = [];

  const drawScrews = (holes = false) => screws.map((s2, i) => {
    const [sx, sy] = mapP(s2.x, s2.y);
    return holes ? circ(sx, sy, 0.6 * screw.d * k, R.W.mid, '#fff')
      : screwGlyph(sx, sy, screw.d, k, part.origin, i, dens);
  }).join('');
  const drawBosses = () => screws.map(s2 => {
    const [sx, sy] = mapP(s2.x, s2.y);
    return circ(sx, sy, 1.6 * screw.d * k, R.W.mid, `url(#${hatB})`) + circ(sx, sy, 0.55 * screw.d * k, R.W.mid, '#fff');
  }).join('');
  const drawPorts = () => ports.map(p => {
    const [px, py] = mapP(p.x, p.y);
    let s2 = `<g transform="translate(${N(px)},${N(py)}) rotate(${N(p.ang)})">${portGlyph(p, k, dens)}</g>`;
    if (lod !== 'thumb' && dens >= 3) {
      const off = p.spec.out + p.spec.half + 2;
      const [lx2, ly2] = mapP(p.x + p.nx * off, p.y + p.ny * off);
      s2 += txt(lx2, ly2 + 3.5, p.spec.label, 9, 'middle');
    }
    return s2;
  }).join('');
  const drawPerimFeats = () => pFeats.map(f =>
    f.k === 'antenna' ? antennaGlyph(f, part, mapP, k, dens) : railGlyph(f, mapP, k, dens)).join('');
  const drawFaceFeats = (hidden = false) => fFeats.map(f => {
    const [fx, fy] = mapP(f.at[0], f.at[1]);
    return faceFeatGlyph(f, fx, fy, k, dens, hidden);
  }).join('');
  const drawVents = () => {
    if (!nV || dens < 2) return '';
    const out = [];
    for (let i = 0; i < nV; i++) {
      const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, nV - row * perRow);
      const x0 = zone.x + (zone.w - inRow * vent.pitch) / 2;
      const [vx, vy] = mapP(x0 + col * vent.pitch, zone.y + 2 + row * (vent.len + 3));
      out.push(rect(vx, vy, vent.w * k, vent.len * k, R.W.fine, '#fff'));
    }
    return out.join('');
  };
  const drawLabels = () => {
    if (lod === 'thumb' || dens < 2) return '';
    const out = [];
    const [cx, cy] = mapP(zone.x + zone.w / 2, zone.y + zone.h * 0.78);
    const corp = part.origin === 'FACTORY' || part.origin === 'CORP PULL';
    if (corp && zone.w * k > 100) {
      out.push(`<g transform="translate(${N(cx)},${N(cy)}) scale(0.82,1)">${txt(0, 0, (part.label || part.id || '').toUpperCase(), Math.min(15, Math.max(10, zone.w * k / 15)), 'middle', true)}</g>`);
    } else if (zone.w * k > 60) {
      out.push(txt(cx, cy, (part.id || '').toUpperCase(), 8.5, 'middle'));    // street: bare hand-lettered id
    }
    return out.join('');
  };
  // ── catalogue parts by MOUNT: 'in' (cavity), 'face' (on the lid), 'wall' (trans-paroi) ──
  const isWallG = g => g.k === 'cat' && g.mount === 'wall';
  const isFaceG = g => g.k === 'cat' && g.mount === 'face';
  // shared wall alignment: the part's flange anchor sits ON the wall centreline,
  // its outward axis rotated onto the outward normal at t.
  const wallGutXform = (g, exterior) => {
    const P = G.perimeter(pts);
    const s = ((((g.t ?? 0.25) % 1) + 1) % 1) * P;
    const q = G.pointAt(pts, s);
    const nAng = Math.atan2(q.ny, q.nx) * 180 / Math.PI;
    const view2 = { k, density: Math.min(dens, 2), wallMm: wall, exterior };  // no caption noise inside a build
    const params2 = exterior ? { ...g.params, mounted: 'exterior' } : { ...g.params, mounted: true };  // section = the TRAVERSANT state
    const a = catWallAnchor(g.cat, params2, view2);
    if (!a) return null;
    return { q, a, rot: a.axis === 'x' ? nAng : nAng + 90, view2, params2, wallMid: [q.x - q.nx * wall / 2, q.y - q.ny * wall / 2] };
  };
  const drawCatWalls = exterior => part.guts.filter(isWallG).map(g => {
    const t2 = wallGutXform(g, exterior);
    if (!t2) return '';
    const fig = catInner(g.cat, t2.params2, t2.view2);
    if (!fig) return '';
    const [px, py] = mapP(t2.wallMid[0], t2.wallMid[1]);
    return `<g transform="translate(${N(px)},${N(py)}) rotate(${N(t2.rot)}) translate(${N(-(t2.a.x + CAT_PAD))},${N(-(t2.a.y + CAT_PAD))})">${fig.inner}</g>`;
  }).join('');
  const drawCatFaces = (hidden = false) => part.guts.filter(isFaceG).map(g => {
    const [x, y] = mapP(g.at[0], g.at[1]);
    if (hidden) return rect(x, y, g.w * k, g.h * k, 0.9, 'none', R.DASH.hl);       // lid furniture above the cut plane
    return catEmbed(g.cat, g.params, x, y, g.w * k, g.h * k, dens, undefined, g.rot || 0);
  }).join('');
  // ── COUPLING: a part seated in another part's slot (antenna → rf-transceiver ant0).
  // The seated object is drawn AT the host's slot anchor, bare (the collar belongs to
  // the host port), riding the host's own transform — wall or in-cavity, rotated or not.
  const isSeated = g => g.k === 'cat' && Number.isInteger(g.host);
  const hostSlotMm = (gH, exterior) => {
    if (isWallG(gH)) {
      const t2 = wallGutXform(gH, exterior);
      const sa = t2 && catSlotAnchor(gH.cat, t2.params2, t2.view2);
      if (!t2 || !sa) return null;
      const rad = t2.rot * Math.PI / 180, dx = sa.x - t2.a.x, dy = sa.y - t2.a.y;
      return { pt: [t2.wallMid[0] + (dx * Math.cos(rad) - dy * Math.sin(rad)) / k,
                    t2.wallMid[1] + (dx * Math.sin(rad) + dy * Math.cos(rad)) / k], ang: t2.rot };
    }
    const nat = catFigure(gH.cat, gH.params, { k: FOOT_K, density: 1 });
    const sa = catSlotAnchor(gH.cat, gH.params, { k: FOOT_K });
    if (!nat || !sa) return null;
    const natW = nat.wPx / FOOT_K, natH = nat.hPx / FOOT_K;
    const quarter = gH.rot === 90 || gH.rot === 270;
    const bw = quarter ? gH.h : gH.w, bh = quarter ? gH.w : gH.h;
    const s2 = Math.min(bw / natW, bh / natH);
    const ox2 = gH.at[0] + (gH.w - bw) / 2 + (bw - natW * s2) / 2;
    const oy2 = gH.at[1] + (gH.h - bh) / 2 + (bh - natH * s2) / 2;
    let px2 = ox2 + (sa.x + CAT_PAD) / FOOT_K * s2, py2 = oy2 + (sa.y + CAT_PAD) / FOOT_K * s2;
    if (gH.rot) {
      const cx2 = gH.at[0] + gH.w / 2, cy2 = gH.at[1] + gH.h / 2, r2 = gH.rot * Math.PI / 180;
      const rx3 = cx2 + (px2 - cx2) * Math.cos(r2) - (py2 - cy2) * Math.sin(r2);
      const ry3 = cy2 + (px2 - cx2) * Math.sin(r2) + (py2 - cy2) * Math.cos(r2);
      px2 = rx3; py2 = ry3;
    }
    return { pt: [px2, py2], ang: gH.rot || 0 };
  };
  const drawSeated = exterior => part.guts.filter(isSeated).map(g => {
    const gH = part.guts[g.host];
    if (!gH || gH.k !== 'cat') return '';
    if (exterior && !isWallG(gH)) return '';                // buried host — nothing shows outside
    const an = hostSlotMm(gH, exterior);
    if (!an) return '';
    const params2 = { ...g.params, bare: true };
    const view3 = { k, density: Math.min(dens, 2) };
    const fig = catInner(g.cat, params2, view3);
    const sa = catSeatAnchor(g.cat, params2, view3);
    if (!fig || !sa) return '';
    const [px, py] = mapP(an.pt[0], an.pt[1]);
    return `<g transform="translate(${N(px)},${N(py)}) rotate(${N(an.ang)}) translate(${N(-(sa.x + CAT_PAD))},${N(-(sa.y + CAT_PAD))})">${fig.inner}</g>`;
  }).join('');

  // wires — the internal logic made visible. Solid when resolved (knowledge).
  const wirePoint = ref => {
    const kind = ref[0], i = +ref.slice(1);
    if (kind === 'g' && part.guts[i]) {
      const g = part.guts[i];
      if (g.k !== 'cat') return gutCenterMm(g);
      if (isSeated(g) && part.guts[g.host]) {
        const an = hostSlotMm(part.guts[g.host], false);
        if (an) return an.pt;
      }
      if (isWallG(g)) {                                          // exact interior pad through the wall transform
        const t2 = wallGutXform(g, false);
        const wp = t2 && catWirePad(g.cat, t2.params2, t2.view2);
        if (t2 && wp) {
          const rad = t2.rot * Math.PI / 180, dx = wp.x - t2.a.x, dy = wp.y - t2.a.y;
          return [t2.wallMid[0] + (dx * Math.cos(rad) - dy * Math.sin(rad)) / k,
                  t2.wallMid[1] + (dx * Math.sin(rad) + dy * Math.cos(rad)) / k];
        }
        const P = G.perimeter(pts), q = G.pointAt(pts, (g.t ?? 0.25) * P);
        return [q.x - q.nx * (wall + 1.5), q.y - q.ny * (wall + 1.5)];
      }
      // in/face: land on the part's OWN pad, mapped through the meet-embed transform
      const nat = catFigure(g.cat, g.params, { k: FOOT_K, density: 1 });
      const wp = catWirePad(g.cat, g.params, { k: FOOT_K });
      if (nat && wp) {
        const natW = nat.wPx / FOOT_K, natH = nat.hPx / FOOT_K;  // natural size, mm
        const quarter = g.rot === 90 || g.rot === 270;
        const bw = quarter ? g.h : g.w, bh = quarter ? g.w : g.h; // unrotated content box (size preserved)
        const s2 = Math.min(bw / natW, bh / natH);
        const ox2 = g.at[0] + (g.w - bw) / 2 + (bw - natW * s2) / 2;
        const oy2 = g.at[1] + (g.h - bh) / 2 + (bh - natH * s2) / 2;
        let px2 = ox2 + (wp.x + CAT_PAD) / FOOT_K * s2, py2 = oy2 + (wp.y + CAT_PAD) / FOOT_K * s2;
        if (g.rot) {                                             // same pivot as the embed: the box centre
          const cx2 = g.at[0] + g.w / 2, cy2 = g.at[1] + g.h / 2, r2 = g.rot * Math.PI / 180;
          const rx3 = cx2 + (px2 - cx2) * Math.cos(r2) - (py2 - cy2) * Math.sin(r2);
          const ry3 = cy2 + (px2 - cx2) * Math.sin(r2) + (py2 - cy2) * Math.cos(r2);
          px2 = rx3; py2 = ry3;
        }
        return [px2, py2];
      }
      return gutCenterMm(g);
    }
    if (kind === 'p' && ports[i]) return [ports[i].x - ports[i].nx * (wall + 1.5), ports[i].y - ports[i].ny * (wall + 1.5)];
    if (kind === 'f') {
      const pf = pFeats.find(q => q.i === i);
      if (pf) return [pf.x - pf.nx * (wall + 1.5), pf.y - pf.ny * (wall + 1.5)];
      const ff = fFeats.find(q => q.i === i);
      if (ff) return featPadMm(ff);
    }
    return null;
  };
  // loom routing — drafting convention, not spaghetti: one axis run + one 45° bend
  // (PCB-trace manner), bend side alternating per lead, solder pad at the organ,
  // pin at the port/control, lacing clips COUNTED along the longest leg.
  const drawWires = () => {
    if (dens < 2) return '';
    const out = [];
    const coupled = (a, b) => a[0] === 'g' && b[0] === 'g' && part.guts[+a.slice(1)] && part.guts[+a.slice(1)].host === +b.slice(1);
    wires.forEach((w2, wi) => {
      if (coupled(w2[0], w2[1]) || coupled(w2[1], w2[0])) return;   // seated = the collar IS the connection
      const A = wirePoint(w2[0]), B = wirePoint(w2[1]);
      if (!A || !B) return;
      const [x1, y1] = mapP(A[0], A[1]), [x2, y2] = mapP(B[0], B[1]);
      const dx = x2 - x1, dy = y2 - y1;
      const dd = Math.min(Math.abs(dx), Math.abs(dy));
      const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
      let m1;
      if (wi % 2 === 0) m1 = [x1 + sx * dd, y1 + sy * dd];                       // diagonal first
      else if (Math.abs(dx) >= Math.abs(dy)) m1 = [x2 - sx * dd, y1];            // run first
      else m1 = [x1, y2 - sy * dd];
      out.push(`<path d="M${N(x1)},${N(y1)} L${N(m1[0])},${N(m1[1])} L${N(x2)},${N(y2)}" fill="none" stroke="#111" stroke-width="${R.W.mid}"/>`);
      // terminations: catalogue parts draw their OWN pads — the lead just lands on them
      const isCatEnd = ref => ref[0] === 'g' && part.guts[+ref.slice(1)] && part.guts[+ref.slice(1)].k === 'cat';
      if (!isCatEnd(w2[0])) out.push(rect(x1 - 1.7, y1 - 1.7, 3.4, 3.4, 0.9, '#fff'));                 // solder pad
      if (!isCatEnd(w2[1])) out.push(circ(x2, y2, 1.5, 0.9, '#fff') + circ(x2, y2, 0.6, 0, '#111'));   // pin
      if (dens >= 3) {
        const long = Math.hypot(m1[0] - x1, m1[1] - y1) > Math.hypot(x2 - m1[0], y2 - m1[1])
          ? [x1, y1, m1[0], m1[1]] : [m1[0], m1[1], x2, y2];
        const L2 = Math.hypot(long[2] - long[0], long[3] - long[1]);
        const nC = Math.floor(L2 / (14 * k));                                     // clip pitch 14 mm — COUNTED
        const ux = (long[2] - long[0]) / (L2 || 1), uy = (long[3] - long[1]) / (L2 || 1);
        for (let c = 1; c <= nC; c++) {
          const cx2 = long[0] + ux * (L2 * c / (nC + 1)), cy2 = long[1] + uy * (L2 * c / (nC + 1));
          out.push(line(cx2 - uy * 2.4, cy2 + ux * 2.4, cx2 + uy * 2.4, cy2 - ux * 2.4, 1));
        }
      }
    });
    return out.join('');
  };

  const interior = () => {
    const out = [];
    const ghost = epis === 'ghosted';
    if (ghost) {
      out.push(`<path d="${innerD}" fill="url(#pot)" stroke="none"/>`);
      const boxes = part.guts.length ? part.guts : [
        { at: [cavRect.x + cavRect.w * 0.08, cavRect.y + cavRect.h * 0.55], w: cavRect.w * 0.84, h: cavRect.h * 0.16 },
        { at: [cavRect.x + cavRect.w * 0.15, cavRect.y + cavRect.h * 0.2], w: cavRect.w * 0.3, h: cavRect.h * 0.25 },
        { at: [cavRect.x + cavRect.w * 0.55, cavRect.y + cavRect.h * 0.18], w: cavRect.w * 0.28, h: cavRect.h * 0.3 },
      ];
      for (const g of boxes) {
        const [x1, y1] = mapP(g.at[0], g.at[1]);
        out.push(rect(x1, y1, g.w * k, g.h * k, 0.9, '#fff', R.DASH.ph));
      }
      if (lod !== 'thumb' && dens >= 2) {
        const [tx2, ty2] = mapP(cavRect.x + cavRect.w / 2, cavRect.y + cavRect.h / 2);
        out.push(txt(tx2, ty2 + 4, 'PH — UNVERIFIED', 9, 'middle'));
      }
      return out.join('');
    }
    if (part.sealed) out.push(`<path d="${innerD}" fill="url(#pot)" stroke="none"/>`);       // potted but KNOWN: solid guts under pot
    else out.push(drawBosses());
    for (const g of part.guts) { if (isWallG(g) || isFaceG(g) || isSeated(g)) continue; out.push(gutGlyph(g, part, mapP, k, dens, false)); }
    out.push(drawWires());
    if (part.sealed && lod !== 'thumb' && dens >= 2) {
      const [tx2, ty2] = mapP(cavRect.x + cavRect.w / 2, cavRect.y + 1.5);
      out.push(txt(tx2, ty2, 'POTTED', 8, 'middle'));
    }
    return out.join('');
  };

  // overall dimensions (top width + left height) — the surveyor's frame
  const drawDims = () => {
    if (!view.dims || lod === 'thumb') return '';
    const out = [];
    const [x0, y0] = mapP(bb.x, bb.y), [x1, y1] = mapP(bb.x + bb.w, bb.y + bb.h);
    const dy = y0 - 12, dx = x0 - 12;
    out.push(line(x0, y0 - 3, x0, dy - 3, R.W.fine) + line(x1, y0 - 3, x1, dy - 3, R.W.fine));
    out.push(`<line x1="${N(x0)}" y1="${N(dy)}" x2="${N(x1)}" y2="${N(dy)}" stroke="#111" stroke-width="${R.W.fine}" marker-start="url(#ar)" marker-end="url(#ar)"/>`);
    out.push(txt((x0 + x1) / 2, dy - 4, `${N(Math.round(bb.w * 10) / 10)}`, 10, 'middle'));
    out.push(line(x0 - 3, y0, dx - 3, y0, R.W.fine) + line(x0 - 3, y1, dx - 3, y1, R.W.fine));
    out.push(`<line x1="${N(dx)}" y1="${N(y0)}" x2="${N(dx)}" y2="${N(y1)}" stroke="#111" stroke-width="${R.W.fine}" marker-start="url(#ar)" marker-end="url(#ar)"/>`);
    out.push(`<g transform="translate(${N(dx - 4)},${N((y0 + y1) / 2)}) rotate(-90)">${txt(0, 0, `${N(Math.round(bb.h * 10) / 10)}`, 10, 'middle')}</g>`);
    return out.join('');
  };

  if (mode === 'exterior') {
    L.push(`<path d="${outlineD}" fill="#fff" stroke="#111" stroke-width="${R.W.vis}"/>`);
    if (dens >= 2) L.push(`<path d="${innerD}" fill="none" stroke="#111" stroke-width="${R.W.fine}" stroke-dasharray="${R.DASH.hl}"/>`);   // parting seam
    L.push(drawVents());
    L.push(drawLabels());
    L.push(drawFaceFeats());
    L.push(drawCatFaces());                            // catalogue lid parts, visible outside
    L.push(drawCatWalls(true));                        // trans-paroi parts: EXT SEUL register
    L.push(drawSeated(true));                          // coupled parts riding a trans-paroi host
    L.push(drawPerimFeats());
    L.push(drawPorts());
    L.push(drawScrews());
    L.push(drawDims());
  } else if (mode === 'section') {
    L.push(`<path d="${outlineD} ${innerD}" fill-rule="evenodd" fill="url(#${hat})" stroke="none"/>`);
    L.push(`<path d="${outlineD}" fill="none" stroke="#111" stroke-width="${R.W.cut}"/>`);
    L.push(`<path d="${innerD}" fill="#fff" stroke="#111" stroke-width="${R.W.mid}"/>`);
    L.push(interior());
    if (dens >= 2) L.push(drawFaceFeats(true));       // lid furniture above the cut plane → hidden line
    if (dens >= 2) L.push(drawCatFaces(true));
    L.push(drawCatWalls(false));                       // trans-paroi parts: full profile crossing the wall
    L.push(drawSeated(false));                         // coupled parts, seated on their host slot
    L.push(drawPerimFeats());
    L.push(drawPorts());
    L.push(drawDims());
  } else {                                            // exploded — lid / chassis / base (fit layout only)
    const gapMm = Math.max(depth * 1.2, 26 / k);
    const dy1 = (bb.h + gapMm) * k, dy2 = 2 * dy1;
    hPx = (bb.h * 3 + 2 * gapMm) * k + 2 * padPx;
    for (const s2 of screws) {
      const [sx, sy] = mapP(s2.x, s2.y);
      L.push(line(sx, sy, sx, sy + dy2, R.W.fine, R.DASH.cl));
    }
    L.push(`<g><path d="${outlineD}" fill="#fff" stroke="#111" stroke-width="${R.W.vis}"/>` + drawVents() + drawLabels() + drawFaceFeats() + drawScrews() + `</g>`);
    L.push(`<g transform="translate(0,${N(dy1)})">` +
      `<path d="${outlineD} ${innerD}" fill-rule="evenodd" fill="url(#${hat})" stroke="none"/>` +
      `<path d="${outlineD}" fill="none" stroke="#111" stroke-width="${R.W.cut}"/>` +
      `<path d="${innerD}" fill="#fff" stroke="#111" stroke-width="${R.W.mid}"/>` +
      interior() + drawPerimFeats() + drawPorts() + `</g>`);
    L.push(`<g transform="translate(0,${N(dy2)})"><path d="${outlineD}" fill="#fff" stroke="#111" stroke-width="${R.W.vis}"/>` + drawScrews(true) + `</g>`);
    if (lod !== 'thumb' && dens >= 2) {
      const [lx] = mapP(bb.x, bb.y);
      L.push(txt(lx, padPx - 6, 'LID', 10) + txt(lx, padPx + dy1 - 6, 'CHASSIS', 10) + txt(lx, padPx + dy2 - 6, 'BASE', 10));
    }
  }

  return {
    svg: `<g>${L.join('')}</g>`, w: wPx, h: hPx, k, bb, part,
    ports, pFeats, screws,
    meta: { tier, wall, screw: screw.name, depth, mode, dens, epis, lod, mat: R.caseMat(part.origin), vents: nV, ventNeed: needV },
  };
}

export function standalone(fig) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${N(fig.w)}" height="${N(fig.h)}" viewBox="0 0 ${N(fig.w)} ${N(fig.h)}" font-family="monospace"><rect width="100%" height="100%" fill="#fff"/>${defsBlock()}${fig.svg}</svg>`;
}

// ---- bin thumbnails: the palette is a parts TRAY — each cell shows the actual
// drawn part, not a word. Same glyph code as the drawing (one source of truth).
export function binThumb(cat, kind, sizePx = 40) {
  let wMm, hMm;
  if (cat === 'gut') { const d = R.GUT[kind] || R.GUT.board; wMm = d.w; hMm = d.h; }
  else if (cat === 'port') { wMm = 17; hMm = 15; }
  else {
    const f = R.FEAT[kind] || R.FEAT.button;
    if (kind === 'screen') { wMm = 16; hMm = 10; }
    else if (kind === 'keypad') { wMm = 3 * R.FEAT.keypad.pitch + 2; hMm = 4 * R.FEAT.keypad.pitch + 2; }
    else if (kind === 'antenna') { wMm = 13; hMm = 22; }
    else if (kind === 'rail') { wMm = R.FEAT.rail.w + 2; hMm = 8; }
    else { wMm = 2 * (f.r || 4) + 4; hMm = wMm; }
  }
  const pad = 4;
  const k2 = (sizePx - 2 * pad) / Math.max(wMm, hMm);
  const ox = (sizePx - wMm * k2) / 2, oy = (sizePx - hMm * k2) / 2;
  const mapP = (x, y) => [ox + x * k2, oy + y * k2];
  const fake = { id: 'bin' };
  const S = [];
  if (cat === 'gut') S.push(gutGlyph({ k: kind, at: [0, 0], w: wMm, h: hMm }, fake, mapP, k2, kind === 'module' ? 1 : 2, false));
  else if (cat === 'port') {
    const spec = R.PORT[kind] || R.PORT.data;
    S.push(`<g transform="translate(${N(ox)},${N(sizePx / 2)})">${portGlyph({ k: kind, keep: spec.keep }, k2, 1)}</g>`);
  } else if (kind === 'antenna') S.push(antennaGlyph({ k: kind, i: 0, x: wMm / 2, y: hMm - 1.5, nx: 0, ny: -1, len: 9 }, fake, mapP, k2, 2));
  else if (kind === 'rail') S.push(railGlyph({ k: kind, x: wMm / 2, y: 1.5, nx: 0, ny: -1 }, mapP, k2, 2));
  else if (kind === 'screen') { const [fx, fy] = mapP(0, 0); S.push(faceFeatGlyph({ k: kind, w: 16, h: 10 }, fx, fy, k2, 2, false)); }
  else if (kind === 'keypad') { const [fx, fy] = mapP(1, 1); S.push(faceFeatGlyph({ k: kind, rows: 4, cols: 3 }, fx, fy, k2, 2, false)); }
  else { const [fx, fy] = mapP(wMm / 2, hMm / 2); S.push(faceFeatGlyph({ k: kind }, fx, fy, k2, 2, false)); }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}">${defsBlock()}${S.join('')}</svg>`;
}
