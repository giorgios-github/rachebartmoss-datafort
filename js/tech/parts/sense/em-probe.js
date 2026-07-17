// parts/sense/em-probe.js — pickup loop on a stub: turns COUNTED, shield slit.
import { L, C, RC, TX, frame, fitK, W, G, QUANT, pad, DASH, flangeV } from '../lib.js';
const SIZES = [8, 12, 18];                                    // QUANTISED loop Ø

export const meta = {
  id: 'em-probe', bin: 'SENSE', label: 'EM PROBE',
  params: { d: { def: 12, stock: SIZES }, shielded: { def: true }, mounted: { def: false, note: 'trans-boîtier: loop outside, pads inside' } },
  slots: [],
  functions: { provides: ['sense-em'], needs: ['power'], rates: {} },
  envelope: { rated: 1, pushMax: 2, instabilityPerPush: 0.08 },
  pushedDraw: ['+1: preamp push — second turn demanded (COUNTED)', '+2: shield slit widened, stencil struck'],
  graftsInto: ['POWER/induction-coil seat (same footprint family, shim set)'],
  variants: [
    { label: 'Ø12 · SHIELDED', p: {} },
    { label: 'Ø18', p: { d: 18 } },
    { label: 'TRAVERSANT — BOUCLE', p: { mounted: true } },
    { label: 'EXT SEUL — BOUCLE', p: { mounted: 'exterior' } },
    { label: 'Ø18 · TRAVERSANT', p: { d: 18, mounted: true } },
    { label: 'Ø18 · EXT SEUL', p: { d: 18, mounted: 'exterior' } }
  ]
};
const norm = p => ({ d: QUANT.snap(p?.d ?? 12, SIZES), shielded: p?.shielded !== false, mounted: p?.mounted === 'exterior' ? 'exterior' : !!p?.mounted });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted) {
    // profile: preamp can inside + flange signal; the loop outside. 'exterior' = loop alone.
    const k = view.k ?? fitK(26, q.d + 8, view.fit ?? 130);
    const r = q.d / 2 * k * 0.8, cy = r + 4 * k, ext = q.mounted === 'exterior';
    let out = '', x = 3 * k;
    if (!ext) {
      out += RC(x, cy - 2.5 * k, 6 * k, 5 * k, W.vis, '#fff');                        // preamp can
      out += RC(x + 2 * k, cy + 2.5 * k, 2 * k, 1.2 * k, W.mid, '#fff');              // cable port
      out += L(x + 3 * k, cy + 3.7 * k, x + 3 * k, cy + 5 * k, W.mid);
      out += L(x + 6 * k, cy, x + 7 * k, cy, W.vis);                                  // stub to wall
      x += 7 * k;
      out += flangeV(x, cy, 2.6 * k, k);
      x += 1.8 * k;
    }
    out += L(x, cy, x + 1 * k, cy, W.vis);                                            // stub
    const ccx = x + 1 * k + r;
    out += C(ccx, cy, r * 0.72, W.mid) + C(ccx, cy, r * 0.56, 0.8);                   // turns
    const slit = 0.28;
    out += `<path d="M${(ccx + r * Math.cos(-Math.PI / 2 + slit)).toFixed(1)},${(cy + r * Math.sin(-Math.PI / 2 + slit)).toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 1 1 ${(ccx + r * Math.cos(-Math.PI / 2 - slit)).toFixed(1)},${(cy + r * Math.sin(-Math.PI / 2 - slit)).toFixed(1)}" fill="none" stroke="#111" stroke-width="${W.vis}"/>`; // slit shield
    if (dens >= 3) out += TX(ccx, cy + r + 14, ext ? 'EXT SEUL' : 'TRAVERSANT', 8);
    return frame(ccx + r + 3 * k, cy + r + (dens >= 3 ? 16 : 4), out);
  }  const k = view.k ?? fitK(q.d + 6, q.d + 12, view.fit ?? 120);
  const r = q.d / 2 * k, c = r + 2 * k;
  let out = '';
  // loop: 2 turns COUNTED; shield = outer ring with a slit at top
  out += C(c, c, r * 0.72, heavy ? W.vis : W.mid);
  out += C(c, c, r * 0.56, heavy ? W.vis : 0.8);
  if (q.shielded) {
    const slit = 0.28;                                        // rad half-angle, FIXED
    out += `<path d="M${(c + r * Math.cos(-Math.PI / 2 + slit)).toFixed(1)},${(c + r * Math.sin(-Math.PI / 2 + slit)).toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 1 1 ${(c + r * Math.cos(-Math.PI / 2 - slit)).toFixed(1)},${(c + r * Math.sin(-Math.PI / 2 - slit)).toFixed(1)}" fill="none" stroke="#111" stroke-width="${heavy ? W.cut : W.vis}"/>`;
  }
  // stub handle down to pads
  out += RC(c - 1.4 * k, c + r, 2.8 * k, 6 * k, heavy ? W.cut : W.vis, '#fff');
  for (let i = 1; i <= 2; i++) out += L(c - 1.4 * k, c + r + i * 2 * k, c + 1.4 * k, c + r + i * 2 * k, heavy ? 1.4 : 0.7);
  if (!heavy) { out += pad(c - 3 * k, c + r + 7.4 * k, 1 * k) + pad(c + 3 * k, c + r + 7.4 * k, 1 * k); if (dens >= 3) out += TX(c, c + r + 11 * k, q.shielded ? 'SLIT SHIELD' : 'BARE LOOP', 8); }
  return frame(2 * c, c + r + (heavy ? 7 : dens >= 3 ? 13 : 9) * k, out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 44 }); }
export function binGlyph() { return thumb({}); }

// ── mounting contract (trans-paroi profile: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k * 0.8, cy = r + 4 * k;
  if (q.mounted === 'exterior' || view.exterior) return { x: 3 * k, y: cy, axis: 'x' };
  return { x: 3 * k + 7 * k + 0.9 * k, y: cy, axis: 'x' };
}
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const r = q.d / 2 * k * 0.8, cy = r + 4 * k;
  return { x: 3 * k + 3 * k, y: cy + 5 * k };
}
