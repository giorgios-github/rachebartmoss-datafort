// parts/overdrive/fuse.js — PLAN VIEW (looking down on the holder), compact.
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT } from '../lib.js';
const AMPS = [1, 5, 15];                                      // QUANTISED

export const meta = {
  id: 'fuse', bin: 'OVERDRIVE', label: 'FUSE / BREAKER',
  params: { amps: { def: 5, stock: AMPS }, style: { def: 'fuse', options: ['fuse', 'breaker'] } },
  slots: [],
  functions: { provides: ['limit (sacrificial / resettable)'], needs: [], rates: { amps: 5 } },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 0 },
  pushedDraw: ['a fuse is not pushed — it is SHUNTED (see bypass-shunt); the shunt across its clips is the drawing'],
  graftsInto: ['any feed line (clips at loom pitch)'],
  variants: [
    { label: 'FUSE 5A', p: {} },
    { label: 'BREAKER 15A', p: { amps: 15, style: 'breaker' } },
    { label: 'FUSE 1A', p: { amps: 1 } }
  ]
};
const norm = p => ({ amps: QUANT.snap(p?.amps ?? 5, AMPS), style: p?.style === 'breaker' ? 'breaker' : 'fuse' });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(18, 8, view.fit ?? 85);            // small part, small drawing
  let out = '', wpx, hpx;
  if (q.style === 'fuse') {
    const bl = 12 * k, bh = 4 * k, x0 = 2 * k, y0 = 1.5 * k, cy = y0 + bh / 2;
    wpx = bl + 4 * k; hpx = bh + 3 * k;
    // holder base plate (plan)
    out += RC(x0 - 1 * k, y0 - 1 * k, bl + 2 * k, bh + 2 * k, heavy ? W.vis : W.fine, '#fff');
    // clips seen from above: two rects gripping the ends
    for (const cx of [x0 + 1 * k, x0 + bl - 1 * k]) out += RC(cx - 1 * k, y0 - 0.5 * k, 2 * k, bh + 1 * k, heavy ? W.vis : W.mid, '#fff');
    // cartridge (plan of a cylinder = rect), end caps + element in the middle window
    out += RC(x0, y0, bl, bh, heavy ? W.cut : W.vis, '#fff');
    out += L(x0 + 2.4 * k, y0, x0 + 2.4 * k, y0 + bh, heavy ? W.vis : W.mid) + L(x0 + bl - 2.4 * k, y0, x0 + bl - 2.4 * k, y0 + bh, heavy ? W.vis : W.mid);
    let d = `M${(x0 + 2.4 * k).toFixed(1)},${cy.toFixed(1)} `;
    const nz = heavy ? 3 : 4;
    for (let i = 0; i < nz; i++) d += `L${(x0 + 2.4 * k + (i + 0.5) * (bl - 4.8 * k) / nz).toFixed(1)},${(cy + (i % 2 ? 1 : -1) * bh * 0.22).toFixed(1)} `;
    d += `L${(x0 + bl - 2.4 * k).toFixed(1)},${cy.toFixed(1)}`;
    out += `<path d="${d}" fill="none" stroke="#111" stroke-width="${heavy ? 1.8 : 0.9}"/>`;
    if (dens >= 3 && !heavy) out += TX(x0 + bl / 2, y0 + bh + 2 * k + 8, `${q.amps} A`, 8);
  } else {
    const bw = 8 * k, bh2 = 12 * k, x0 = 4 * k, y0 = 1.5 * k;
    wpx = bw + 8 * k; hpx = bh2 + 2 * k;
    out += RC(x0, y0, bw, bh2, heavy ? W.cut : W.vis, '#fff');   // body, plan
    // slide toggle seen from above: track + knob at ON, PH at OFF
    out += RC(x0 + bw * 0.28, y0 + bh2 * 0.2, bw * 0.44, bh2 * 0.44, heavy ? W.vis : W.fine);
    out += RC(x0 + bw * 0.28, y0 + bh2 * 0.2, bw * 0.44, bh2 * 0.2, heavy ? W.vis : W.mid, '#fff');
    if (!heavy) out += RC(x0 + bw * 0.28, y0 + bh2 * 0.44, bw * 0.44, bh2 * 0.2, 0.7, 'none', DASH.ph);
    out += C(x0 + bw / 2, y0 + bh2 * 0.8, 0.9 * k, heavy ? W.vis : W.mid, '#fff'); // trip test
    if (!heavy) for (const tyy of [y0 - 1 * k, y0 + bh2]) out += RC(x0 + bw / 2 - 1 * k, tyy, 2 * k, 1 * k, W.mid, '#fff'); // terminals
    if (dens >= 3 && !heavy) out += TX(x0 + bw / 2, hpx + 8, `${q.amps} A · RESET`, 8);
  }
  return frame(wpx, hpx + (dens >= 3 && !heavy ? 10 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 48 }); }
export function binGlyph() { return thumb({}); }

// ── wire contract: the loom lands on the near clip/terminal ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.style === 'breaker') return { x: 4 * k + 4 * k, y: 1.5 * k - 1 * k };
  return { x: 2 * k + 1 * k, y: 1.5 * k + 2 * k };
}
