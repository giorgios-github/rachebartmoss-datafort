// parts/interface/haptic.js — clunky street buzzer: square slab, wide elastomer band,
// visible ERM puck with eccentric weight, fat pads, cable-tie tab. No corpo sleekness.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, pad } from '../lib.js';
const W_STOCK = [14, 20, 28], H_STOCK = [10, 14, 20];         // QUANTISED mm

export const meta = {
  id: 'haptic', bin: 'INTERFACE', label: 'HAPTIC PAD',
  params: { w: { def: 20, stock: W_STOCK }, h: { def: 14, stock: H_STOCK }, style: { def: 'street', options: ['street', 'corpo'] } },
  slots: [],
  functions: { provides: ['indicate'], needs: ['power', 'control'], rates: { powerMw: 300 } },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.1 },
  pushedDraw: ['+1: overvolt — second wave ring demanded', '+2: resonant drive — strap COUNTED across pad (delamination hold-down)'],
  graftsInto: ['SENSE/biomonitor cuff (adapter plate)'],
  variants: [
    { label: '20×14 · STREET', p: {} },
    { label: '28×20 · STREET', p: { w: 28, h: 20 } },
    { label: '14×10 · STREET', p: { w: 14, h: 10 } },
    { label: '20×14 · CORPO', p: { style: 'corpo' } },
    { label: '28×20 · CORPO', p: { w: 28, h: 20, style: 'corpo' } }
  ]
};
const norm = p => ({ w: QUANT.snap(p?.w ?? 20, W_STOCK), h: QUANT.snap(p?.h ?? 14, H_STOCK), style: p?.style === 'corpo' ? 'corpo' : 'street' });

// ERM puck: circle + filled eccentric half-weight + shaft dot
function puck(cx, cy, r, sw) {
  let out = C(cx, cy, r, sw, '#fff');
  out += `<path d="M${(cx - r * 0.62).toFixed(1)},${cy.toFixed(1)} A${(r * 0.62).toFixed(1)},${(r * 0.62).toFixed(1)} 0 0 1 ${(cx + r * 0.62).toFixed(1)},${cy.toFixed(1)} Z" fill="#111" stroke="none"/>`;
  out += C(cx, cy, r * 0.14, 0, '#111');
  return out;
}

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2, heavy = view.lod === 'thumb';
  if (q.style === 'corpo') return drawCorpo(q, view);
  const k = view.k ?? fitK(q.w + 8, q.h + 6, view.fit ?? 150);
  const wpx = q.w * k, hpx = q.h * k;
  // slab: square corners, heavy border
  let out = RC(0, 0, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
  // wide elastomer band (POT), square
  const b = 2.2 * k;
  out += `<path d="M0,0 H${wpx.toFixed(1)} V${hpx.toFixed(1)} H0 Z M${b.toFixed(1)},${b.toFixed(1)} V${(hpx - b).toFixed(1)} H${(wpx - b).toFixed(1)} V${b.toFixed(1)} Z" fill="url(#pot)" fill-rule="evenodd" stroke="none"/>`;
  out += RC(b, b, wpx - 2 * b, hpx - 2 * b, heavy ? W.vis : W.mid, '#fff');
  // ERM puck off-centre + wave arcs toward the far side
  const pr = Math.min(hpx * 0.24, wpx * 0.16), pcx = b + (wpx - 2 * b) * 0.3, pcy = hpx / 2;
  out += puck(pcx, pcy, pr, heavy ? W.vis : W.mid);
  for (let i = 1; i <= (heavy ? 2 : 3); i++) {
    const rr = pr + i * 1.6 * k;
    if (pcx + rr > wpx - b - 0.6 * k) break;                   // arcs stay inside the face
    out += `<path d="M${(pcx + rr * Math.cos(-0.8)).toFixed(1)},${(pcy + rr * Math.sin(-0.8)).toFixed(1)} A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 1 ${(pcx + rr * Math.cos(0.8)).toFixed(1)},${(pcy + rr * Math.sin(0.8)).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? 2.6 : W.mid}"/>`;
  }
  if (!heavy) {
    // fat leads out the flat right edge, mid-height — clear of the band corners
    for (const dy of [-1.1, 1.1]) out += L(wpx, hpx / 2 + dy * k, wpx + 2.6 * k, hpx / 2 + dy * k, W.vis);
    for (let i = 0; i < 2; i++) out += L(wpx + 0.6 * k + i * 0.9 * k, hpx / 2 - 2.2 * k, wpx + 0.6 * k + i * 0.9 * k, hpx / 2 + 2.2 * k, W.mid); // collar ticks
    out += pad(wpx + 4 * k, hpx / 2 - 1.1 * k, 1.1 * k) + pad(wpx + 4 * k, hpx / 2 + 1.1 * k, 1.1 * k);
    // cable-tie tab, bottom edge
    out += RC(wpx * 0.5 - 1.8 * k, hpx, 3.6 * k, 1.8 * k, W.mid, '#fff');
    out += RC(wpx * 0.5 - 0.9 * k, hpx + 0.5 * k, 1.8 * k, 0.8 * k, 0.7, '#fff');
    if (dens >= 3) out += TX(wpx / 2, hpx + 2.2 * k + 12, 'ERM PUCK · TIE-DOWN TAB', 8);
  }
  return frame(wpx + (heavy ? 0 : 6 * k), hpx + (heavy ? 0 : 2.2 * k) + (dens >= 3 && !heavy ? 16 : 0), out);
}
export function thumb(p) {
  const q = norm(p ?? {});
  const k = 52 / q.w, wpx = q.w * k, hpx = q.h * k;
  let out = RC(0, 0, wpx, hpx, W.cut, '#fff');
  out += RC(1.8 * k, 1.8 * k, wpx - 3.6 * k, hpx - 3.6 * k, W.vis, '#fff');
  out += puck(wpx * 0.34, hpx / 2, hpx * 0.22, W.vis);
  for (let i = 1; i <= 2; i++) {
    const rr = hpx * 0.22 + i * 2.4 * k;
    out += `<path d="M${(wpx * 0.34 + rr * Math.cos(-0.8)).toFixed(1)},${(hpx / 2 + rr * Math.sin(-0.8)).toFixed(1)} A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 1 ${(wpx * 0.34 + rr * Math.cos(0.8)).toFixed(1)},${(hpx / 2 + rr * Math.sin(0.8)).toFixed(1)}" fill="none" stroke="#111" stroke-width="3"/>`;
  }
  return frame(wpx, hpx, out, 4);
}
export function binGlyph() { return thumb({ w: 20, h: 14 }); }

// corpo: the old sleek register — rounded slab, wave arcs from centre, tail on the flat edge
function drawCorpo(q, view) {
  const heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.w + 8, q.h + 4, view.fit ?? 150);
  const wpx = q.w * k, hpx = q.h * k, r = 2 * k;
  let out = RC(0, 0, wpx, hpx, heavy ? W.cut : W.vis, '#fff', null, r);
  out += RC(1.7 * k, 1.7 * k, wpx - 3.4 * k, hpx - 3.4 * k, heavy ? W.vis : W.fine, 'none', null, r * 0.6);
  const cx = wpx / 2 - 1.5 * k, cy = hpx / 2;
  out += C(cx, cy, 0.5 * k, 0, '#111');
  for (let i = 1; i <= (heavy ? 2 : 3); i++) {
    const rr = i * 1.7 * k;
    if (cx + rr > wpx - 2.4 * k) break;
    out += `<path d="M${(cx + rr * Math.cos(-0.9)).toFixed(1)},${(cy + rr * Math.sin(-0.9)).toFixed(1)} A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 1 ${(cx + rr * Math.cos(0.9)).toFixed(1)},${(cy + rr * Math.sin(0.9)).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? 2.6 : W.mid}"/>`;
  }
  if (!heavy) {
    // slim leads out the flat right edge, mid-height — clear of the radius
    for (const dy of [-0.9, 0.9]) out += L(wpx, hpx / 2 + dy * k, wpx + 2.2 * k, hpx / 2 + dy * k, W.mid);
    if (dens >= 3) out += TX(wpx / 2, hpx + 12, 'CORPO · FLUSH', 8);
  }
  return frame(wpx + (heavy ? 0 : 3 * k), hpx + (dens >= 3 && !heavy ? 16 : 0), out);
}

// ── wire contract: the loom lands on the lead pads (right edge, mid-height) ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  return { x: q.w * k + (q.style === 'corpo' ? 2.2 : 4) * k, y: q.h * k / 2 };
}
