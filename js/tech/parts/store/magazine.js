// parts/store/magazine.js — the COUNTED-payload part: payload Ø FIXED, count COUNTED,
// stagger from width quanta, follower + spring, witness slot.
import { L, C, RC, TX, frame, fitK, W, DASH, R, QUANT } from '../lib.js';
const PAY = { round: 10, cell: 15, vial: 12, dose: 8 };       // FIXED Ø mm

export const meta = {
  id: 'magazine', bin: 'STORE', label: 'MAGAZINE / STACK',
  params: {
    payload: { def: 'cell', options: ['round', 'cell', 'vial', 'dose'] },
    count: { def: 4, min: 2, max: 10 },
    stagger: { def: false }
  },
  slots: [{ id: 'pay0', accepts: 'POWER/cell | ACT/injector (dose) | matter vials', keying: 'payload Ø FIXED', param: 'payload' }],
  functions: { provides: ['hold-payload'], needs: [], rates: { count: 'COUNTED from length' } },
  envelope: { rated: 1, pushMax: 1, instabilityPerPush: 0.06 },
  pushedDraw: ['+1: spring shimmed for +1 payload — follower drawn compressed past stop, witness slot overrun PH'],
  graftsInto: ['host mag-well one size off (mag-well adapter — the weapon-adjacent interface; host never drawn)'],
  variants: [
    { label: 'CELL × 4', p: {} },
    { label: 'ROUND × 8 · STAGGERED', p: { payload: 'round', count: 8, stagger: true } },
    { label: 'VIAL × 3', p: { payload: 'vial', count: 3 } }
  ]
};
const norm = p => ({ payload: PAY[p?.payload] ? p.payload : 'cell', count: Math.max(2, Math.min(10, p?.count ?? 4)), stagger: !!p?.stagger });

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  const D = PAY[q.payload];                                    // FIXED — never scales
  const wall = 1.6;
  const Wm = q.stagger ? D * 1.8 + 2 * wall : D + 2 * wall;   // double-stack interior = 1.8×Ø
  const pitch = q.stagger ? D * 0.62 : D + 0.6;
  const Hm = q.count * pitch + D * 0.5 + 10;                   // + follower/spring zone
  const k = view.k ?? fitK(Wm + 6, Hm, view.fit ?? 170);
  const wpx = Wm * k, hpx = Hm * k;
  let out = RC(0, 0, wpx, hpx, heavy ? W.cut : W.vis, '#fff');
  out += RC(wall * k, wall * k, wpx - 2 * wall * k, hpx - 2 * wall * k, heavy ? W.vis : W.mid);
  // payload COUNTED from top (feed end up)
  const r = D / 2 * k;
  for (let i = 0; i < q.count; i++) {
    const cy = (wall + D / 2 + 1) * k + i * pitch * k;
    const cx = q.stagger ? wpx / 2 + (i % 2 ? 1 : -1) * (Wm / 2 - wall - D / 2) * k : wpx / 2;
    if (q.payload === 'vial') { out += C(cx, cy, r * 0.92, heavy ? W.vis : W.mid, '#fff') + C(cx, cy, r * 0.5, heavy ? 1.4 : 0.7); }
    else if (q.payload === 'dose') { out += RC(cx - r * 0.9, cy - r * 0.55, r * 1.8, r * 1.1, heavy ? W.vis : W.mid, '#fff', null, r * 0.4); }
    else { out += C(cx, cy, r * 0.92, heavy ? W.vis : W.mid, '#fff'); if (!heavy && q.payload === 'round') out += C(cx, cy, r * 0.3, 0.7); }
  }
  // follower + spring below
  const fy = (wall + D / 2 + 1) * k + q.count * pitch * k - r * 0.4;
  out += L(wall * k + 1, fy + r * 0.8, wpx - wall * k - 1, fy + r * 0.8, heavy ? W.vis : W.mid);
  if (!heavy) {
    let d = `M${(wpx * 0.3).toFixed(1)},${(fy + r * 0.8 + 2).toFixed(1)} `;
    const zz = (hpx - wall * k - 2) - (fy + r * 0.8 + 2), nZ = 4;
    for (let i = 0; i < nZ; i++) d += `L${(wpx * (i % 2 ? 0.3 : 0.7)).toFixed(1)},${(fy + r * 0.8 + 2 + zz * (i + 1) / nZ).toFixed(1)} `;
    out += `<path d="${d}" fill="none" stroke="#111" stroke-width="0.8"/>`;
    // witness slot + count marks
    out += RC(-0.4 * k, hpx * 0.12, 0.8 * k, hpx * 0.7, W.mid, '#fff');
    for (let i = 0; i < q.count; i++) out += L(-1.6 * k, (wall + D / 2 + 1) * k + i * pitch * k, -0.4 * k, (wall + D / 2 + 1) * k + i * pitch * k, 0.7);
    if (dens >= 3) {
      out += TX(wpx / 2, hpx + 12, `Ø${D} FIXED × ${q.count}`, 8);
      if (q.stagger) out += TX(wpx / 2, hpx + 22, 'STAGGERED', 8);
    }
  }
  return frame(wpx + 4 * k, hpx + (dens >= 3 && !heavy ? 26 : 2), `<g transform="translate(${(2.4 * k).toFixed(1)},0)">${out}</g>`);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 54 }); }
export function binGlyph() { return thumb({ count: 3 }); }
