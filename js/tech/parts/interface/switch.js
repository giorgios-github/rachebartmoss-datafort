// parts/interface/switch.js — toggle/slide/rocker; alternate throw drawn PH phantom.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, G, flangeV, pad } from '../lib.js';

export const meta = {
  id: 'switch', bin: 'INTERFACE', label: 'SWITCH',
  params: { style: { def: 'toggle', options: ['toggle', 'slide', 'rocker'] }, poles: { def: 1, options: [1, 2] }, side: { def: false, note: 'side elevation (toggle only)' } },
  slots: [],
  functions: { provides: ['input'], needs: [], rates: { poles: 1 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.06 },
  pushedDraw: ['+1: contacts paralleled — both poles bridged, drawn as bus bar across lugs', '+2: arc risk — guard wall demanded'],
  graftsInto: ['OVERDRIVE/governor seat (as manual bypass — adapter plate)'],
  variants: [
    { label: 'TOGGLE SPST', p: {} },
    { label: 'SLIDE DPDT', p: { style: 'slide', poles: 2 } },
    { label: 'ROCKER SPST', p: { style: 'rocker' } },
    { label: 'TOGGLE · TRAVERSANT', p: { side: true } },
    { label: 'SLIDE · TRAVERSANT', p: { style: 'slide', side: true } },
    { label: 'ROCKER · TRAVERSANT', p: { style: 'rocker', side: true } },
    { label: 'TOGGLE · EXT SEUL', p: { side: 'exterior' } },
    { label: 'SLIDE · EXT SEUL', p: { style: 'slide', side: 'exterior' } },
    { label: 'ROCKER · EXT SEUL', p: { style: 'rocker', side: 'exterior' } }
  ]
};
const norm = p => ({ style: p?.style ?? 'toggle', poles: p?.poles === 2 ? 2 : 1, side: p?.side === 'exterior' ? 'exterior' : !!p?.side });

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2;
  if (q.side) return drawSide(q, view);
  const k = view.k ?? fitK(20, 14, view.fit ?? 150);
  let out = '', Wm = 20, Hm = 14;
  if (q.style === 'toggle') {
    const cx = 10 * k, cy = 6 * k, rB = 3.4 * k;
    // hex bezel nut + boss
    let hx = '';
    for (let j = 0; j < 6; j++) { const a = Math.PI / 6 + Math.PI / 3 * j; hx += `${j ? 'L' : 'M'}${(cx + 4.6 * k * Math.cos(a)).toFixed(2)},${(cy + 4.6 * k * Math.sin(a)).toFixed(2)} `; }
    out += `<path d="${hx}Z" fill="#fff" stroke="#111" stroke-width="${W.mid}"/>`;
    out += C(cx, cy, rB, W.vis, '#fff');
    // bat lever thrown to ON (right); alternate throw PH
    out += L(cx, cy, cx + 6 * k, cy - 3.4 * k, W.cut) + C(cx + 6 * k, cy - 3.4 * k, 1.1 * k, W.mid, '#fff');
    out += L(cx, cy, cx - 6 * k, cy - 3.4 * k, W.fine, DASH.ph) + C(cx - 6 * k, cy - 3.4 * k, 1.1 * k, W.fine, 'none');
    if (dens >= 3) { out += TX(cx + 7.4 * k, cy - 4.6 * k, 'ON', 9); out += TX(cx - 7.4 * k, cy - 4.6 * k, 'OFF', 9); }
    Hm = 12;
  } else if (q.style === 'slide') {
    const bw = 14 * k, bh = 6 * k, bx = 3 * k, by = 3 * k;
    out += RC(bx, by, bw, bh, W.vis, '#fff');
    out += RC(bx + 1.2 * k, by + 1.6 * k, bw - 2.4 * k, bh - 3.2 * k, W.fine);                   // track
    out += RC(bx + bw - 5.2 * k, by + 0.6 * k, 4 * k, bh - 1.2 * k, W.cut, '#fff');             // knob at pos B
    out += RC(bx + 1.2 * k, by + 0.6 * k, 4 * k, bh - 1.2 * k, W.fine, 'none', DASH.ph);        // phantom pos A
    Hm = 13;
  } else { // rocker
    const bw = 12 * k, bh = 8 * k, bx = 4 * k, by = 2 * k;
    out += RC(bx, by, bw, bh, W.vis, '#fff', null, 1.5 * k);
    out += L(bx + bw / 2, by, bx + bw / 2, by + bh, W.mid);                                     // pivot line
    out += RC(bx + bw / 2, by, bw / 2, bh, 0, 'url(#f45)');                                     // pressed half
    out += C(bx + bw * 0.25, by + bh / 2, 0.8 * k, W.mid);                                      // I/O marks
    out += L(bx + bw * 0.75, by + bh * 0.3, bx + bw * 0.75, by + bh * 0.7, W.mid);
    Hm = 13;
  }
  // solder lugs: 3 per pole, below — pitch clamped so the row stays inside the body span
  const nL = 3 * q.poles, lp = Math.min(4, 15 / Math.max(1, nL - 1)), lw = (nL - 1) * lp;
  for (let i = 0; i < nL; i++) {
    const lx = (10 - lw / 2 + i * lp) * k, ly = (Hm - 3) * k;
    out += RC(lx - 1 * k, ly, 2 * k, 3 * k, W.mid, '#fff') + C(lx, ly + 1.5 * k, 0.45 * k, 0.7);
  }
  return frame(20 * k, Hm * k, out, 5);
}
export function thumb(p) {
  const q = norm(p ?? {});
  if (q.side) return drawSide(q, { lod: 'thumb', density: 1, fit: 58 });
  const k = 3;
  const cx = 9 * k, cy = 8 * k;
  let out = C(cx, cy, 3.6 * k, W.cut, '#fff') + L(cx, cy, cx + 5.5 * k, cy - 3.2 * k, 4) + C(cx + 5.5 * k, cy - 3.2 * k, 1.2 * k, W.vis, '#fff');
  if (q.style === 'slide') { out = RC(2 * k, 5 * k, 14 * k, 6 * k, W.cut, '#fff') + RC(9.6 * k, 5.8 * k, 4.4 * k, 4.4 * k, 0, '#111'); }
  if (q.style === 'rocker') { out = RC(3 * k, 4 * k, 12 * k, 8 * k, W.cut, '#fff', null, 2 * k) + RC(9 * k, 4 * k, 6 * k, 8 * k, 0, 'url(#h45)') + L(9 * k, 4 * k, 9 * k, 12 * k, W.vis); }
  return frame(18 * k, 14 * k, out, 3);
}
export function binGlyph() { return thumb({ style: 'toggle' }); }

// The emerged actuator, drawn ONCE — both profile modes reuse it verbatim.
function extGlyph(style, x, cy, k) {
  let out = '';
  if (style === 'toggle') {
    out += RC(x, cy - 1.4 * k, 0.8 * k, 2.8 * k, W.mid, '#fff');                      // bushing boss
    out += L(x + 0.7 * k, cy - 0.2 * k, x + 3.1 * k, cy - 3 * k, 2.2);                // bat lever, thick
    out += C(x + 3.4 * k, cy - 3.3 * k, 1 * k, W.vis, '#fff');                        // ball end
    out += L(x + 0.7 * k, cy + 0.2 * k, x + 3.1 * k, cy + 3 * k, W.fine, DASH.ph);    // alt throw
  } else if (style === 'slide') {
    out += RC(x, cy - 3 * k, 0.7 * k, 6 * k, W.mid, '#fff');                          // low track plate
    out += RC(x + 0.7 * k, cy - 2.7 * k, 1.4 * k, 2.2 * k, W.cut, '#fff');            // knob at A
    out += RC(x + 0.7 * k, cy + 0.5 * k, 1.4 * k, 2.2 * k, 0.7, 'none', DASH.ph);     // pos B
  } else {
    out += POLY([[x + 0.4 * k, cy - 3 * k], [x + 1.2 * k, cy - 3 * k], [x + 2.6 * k, cy + 3 * k], [x + 1.8 * k, cy + 3 * k]], W.vis, true, '#fff'); // rocker cap edge-on, top pressed
    out += C(x + 1.5 * k, cy, 0.4 * k, 0, '#111');                                    // pivot
  }
  return out;
}
// profile: real body inside + flange signal; 'exterior' = extGlyph alone, no signal.
function drawSide(q, view) {
  const dens = view.density ?? 2, heavy = view.lod === 'thumb';
  const k = view.k ?? fitK(24, 16, view.fit ?? 125);
  const cy = 7 * k, ext = q.side === 'exterior';
  let out = '', x = 3 * k;
  if (!ext) {
    out += pad(x + 1.1 * k, cy, 1.1 * k);                                             // cable origin (organ-side pad)
    out += L(x + 2.2 * k, cy, x + 3.4 * k, cy, heavy ? W.vis : W.mid);                // lead to the wall
    x += 3.4 * k;
    out += flangeV(x, cy, 2.6 * k, k, heavy);
    x += 1.8 * k;
  }
  out += extGlyph(q.style, x, cy, k);
  if (dens >= 3) out += TX(x + 1.5 * k, cy + 5.4 * k + 6, ext ? 'EXT SEUL' : 'TRAVERSANT', 8);
  return frame(x + 6 * k, cy + 5 * k + (dens >= 3 ? 10 : 0), out);
}

// ── mounting contract (trans-paroi profile: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.side === 'exterior' || view.exterior) return { x: 3 * k, y: 7 * k, axis: 'x' };
  return { x: 3 * k + 3.4 * k + 0.9 * k, y: 7 * k, axis: 'x' };
}
export function wirePad(p, view = {}) { const k = view.k ?? 8; return { x: 3 * k + 1.1 * k, y: 7 * k }; }
