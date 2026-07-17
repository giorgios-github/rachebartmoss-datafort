// parts/structure/socket.js — panel socket: keyed bore + retention, accepts keyed-pin modules.
import { L, C, RC, TX, frame, fitK, W, DASH, G, QUANT, screwMini, seat } from '../lib.js';
const SIZES = [8, 12, 16];                                    // QUANTISED bore mm

export const meta = {
  id: 'socket', bin: 'STRUCTURE', label: 'SOCKET',
  params: { bore: { def: 12, stock: SIZES }, occupied: { def: false } },
  slots: [{ id: 'sk0', accepts: 'any part terminating in a keyed pin (loom law)', keying: 'top key slot', param: 'occupied' }],
  functions: { provides: ['mount', 'pass-signal'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable: structure'],
  graftsInto: ['a wrong-Ø pin seats only through a GRAFT reducer bushing — the ring is the tell'],
  variants: [
    { label: 'Ø12 · EMPTY', p: {} },
    { label: 'Ø12 · PIN SEATED', p: { occupied: true } },
    { label: 'Ø16 · EMPTY', p: { bore: 16 } }
  ]
};
const norm = p => ({ bore: QUANT.snap(p?.bore ?? 12, SIZES), occupied: !!p?.occupied });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const k = view.k ?? fitK(q.bore + 12, q.bore + 12, view.fit ?? 130);
  const r = q.bore / 2 * k, c = r + 6 * k;
  // square flange + 4 retention screws
  const fl = r + 4 * k;
  let out = RC(c - fl, c - fl, 2 * fl, 2 * fl, heavy ? W.cut : W.vis, '#fff');
  if (!heavy) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out += screwMini(c + sx * (fl - 1.6 * k), c + sy * (fl - 1.6 * k), 0.9 * k, 'cross');
  out += C(c, c, r + 1 * k, heavy ? W.vis : W.mid);            // counterbore
  out += C(c, c, r, heavy ? W.cut : W.vis, '#fff');            // bore
  // key slot at top (FIXED)
  out += RC(c - 0.8 * k, c - r - 0.8 * k, 1.6 * k, 1.8 * k, heavy ? W.vis : W.mid, '#fff');
  if (q.occupied) {
    out += C(c, c, r * 0.72, heavy ? W.cut : W.vis, '#fff');   // seated pin body
    out += C(c, c, r * 0.2, heavy ? 1.6 : 0.8, 0, '#111') + C(c, c, r * 0.2, 0, '#111');
    if (dens >= 3 && !heavy) out += TX(c, c + fl + 12, 'KEYED PIN SEATED', 8);
  } else {
    // empty state: dashed pin ghost + centre cross (seat law, radial flavour)
    if (!heavy) {
      out += `<circle cx="${c.toFixed(1)}" cy="${c.toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="none" stroke="#111" stroke-width="${W.mid}" stroke-dasharray="${DASH.hl}"/>`;
      out += L(c - 3, c, c + 3, c, 0.7) + L(c, c - 3, c, c + 3, 0.7);
      if (dens >= 3) out += TX(c, c + fl + 12, 'SOCKET · ACCEPTS KEYED PIN', 8);
    }
  }
  return frame(2 * c, 2 * c + (dens >= 3 && !heavy ? 14 : 0), out);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 46 }); }
export function binGlyph() { return thumb({ occupied: true }); }

// ── wire contract: the loom lands on the bore centre (pass-signal) ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const c = q.bore / 2 * k + 6 * k;
  return { x: c, y: c };
}
