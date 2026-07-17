// parts/interface/button.js — tact/panel momentary. Body QUANTISED, plunger FIXED ratio.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, flangeV, pad } from '../lib.js';
const SIZES = [6, 9, 12];                                    // QUANTISED body mm

export const meta = {
  id: 'button', bin: 'INTERFACE', label: 'BUTTON',
  params: { size: { def: 6, stock: SIZES }, guarded: { def: false }, side: { def: null, options: [null, 'wall', 'exterior'], note: 'profile: wall = int+ext+flange signal; exterior = cap only, no signal' } },
  slots: [],
  functions: { provides: ['input'], needs: [], rates: { poles: 1 } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.02 },
  pushedDraw: ['+1: contact bridge for higher current — solder blob dot on both lugs'],
  graftsInto: ['any control seat (jury-rig bracket)'],
  variants: [
    { label: '6 mm TACT', p: {} },
    { label: '12 mm PANEL', p: { size: 12 } },
    { label: '9 mm GUARDED', p: { size: 9, guarded: true } },
    { label: '9 mm · TRAVERSANT', p: { size: 9, side: 'wall' } },
    { label: '9 mm · EXTÉRIEUR SEUL', p: { size: 9, side: 'exterior' } },
    { label: '6 mm · TRAVERSANT', p: { side: 'wall' } },
    { label: '6 mm · EXT SEUL', p: { side: 'exterior' } }
  ]
};
const norm = p => ({ size: QUANT.snap(p?.size ?? 6, SIZES), guarded: !!p?.guarded, side: ['wall', 'exterior'].includes(p?.side) ? p.side : null });

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2;
  if (q.side) {
    // profile: the cap is a straight rectangle; 'wall' adds body + flange signal
    const k = view.k ?? fitK(22, 13, view.fit ?? 115), heavy = view.lod === 'thumb';
    const s = q.size, cy = 6 * k;
    const capH = s * 0.62 * k, capW = 1.8 * k;
    const ext = q.side === 'exterior';
    let out = '', x = 3 * k;
    if (!ext) {
      out += pad(x + 1.1 * k, cy, 1.1 * k);                                           // cable origin (organ-side pad)
      out += L(x + 2.2 * k, cy, x + 3.4 * k, cy, heavy ? W.vis : W.mid);              // lead to the wall
      x += 3.4 * k;
      out += flangeV(x, cy, capH / 2, k, heavy);
      x += 1.8 * k;
    }
    out += RC(x, cy - capH / 2, capW, capH, W.cut, '#fff');                           // the cap
    if (dens >= 3) out += TX(x + capW / 2, cy + capH / 2 + 3.2 * k + 6, ext ? 'EXT SEUL' : 'TRAVERSANT', 8);
    return frame(x + capW + 3 * k, cy + capH / 2 + 3 * k + (dens >= 3 ? 10 : 0), out);
  }  const s = q.size, k = view.k ?? fitK(s + 6, s + 6, view.fit ?? 110);
  const spx = s * k, cx = spx / 2 + 3 * k, cy = spx / 2 + 3 * k;
  let out = '';
  // body square + plunger
  out += RC(cx - spx / 2, cy - spx / 2, spx, spx, W.vis, '#fff');
  out += C(cx, cy, spx * 0.3, W.vis, '#fff');
  if (dens >= 2) out += C(cx, cy, spx * 0.42, W.fine);       // travel skirt
  // 4 legs (gull) FIXED
  for (const [sx, sy] of [[-1, -0.55], [-1, 0.55], [1, -0.55], [1, 0.55]])
    out += L(cx + sx * spx / 2, cy + sy * spx / 2, cx + sx * (spx / 2 + 1.6 * k), cy + sy * spx / 2, W.mid);
  if (q.guarded) {                                            // guard walls, two sides
    for (const sy of [-1, 1])
      out += L(cx - spx * 0.62, cy + sy * spx * 0.62, cx + spx * 0.62, cy + sy * spx * 0.62, W.cut);
  }
  return frame(spx + 6 * k, spx + 6 * k, out, 4);
}
export function thumb(p) {
  const q = norm(p ?? {});
  if (q.side) return draw(q, { lod: 'thumb', density: 1, fit: 58 });
  const k = 44 / (q.size + 4);
  const spx = q.size * k, c = spx / 2 + 2 * k;
  let out = RC(c - spx / 2, c - spx / 2, spx, spx, W.cut, '#fff') + C(c, c, spx * 0.3, W.cut, '#fff');
  for (const [sx, sy] of [[-1, -0.55], [-1, 0.55], [1, -0.55], [1, 0.55]])
    out += L(c + sx * spx / 2, c + sy * spx / 2, c + sx * (spx / 2 + 1.4 * k), c + sy * spx / 2, W.vis);
  return frame(spx + 4 * k, spx + 4 * k, out, 4);
}
export function binGlyph() { return thumb({ size: 9 }); }

// ── mounting contract (trans-paroi profile: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.side === 'exterior' || view.exterior) return { x: 3 * k, y: 6 * k, axis: 'x' };
  return { x: 3 * k + 3.4 * k + 0.9 * k, y: 6 * k, axis: 'x' };
}
export function wirePad(p, view = {}) { const k = view.k ?? 8; return { x: 3 * k + 1.1 * k, y: 6 * k }; }
