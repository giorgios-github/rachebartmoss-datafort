// parts/power/psu.js — power conditioner. Plan view, clear zones, nothing crowds an edge.
// Heatsinks are drawn PLAN: an outlined surface with fin lines inside — never a rake.
import { L, C, RC, TX, frame, fitK, W, DASH, QUANT, screwMini, keyPin } from '../lib.js';
const WATTS = [5, 15, 40, 90];                                // QUANTISED
const DIM = { 5: [24, 16], 15: [32, 20], 40: [42, 28], 90: [56, 36] };

export const meta = {
  id: 'psu', bin: 'POWER', label: 'CONDITIONER',
  params: { watts: { def: 15, stock: WATTS }, isolated: { def: true } },
  slots: [],
  functions: { provides: ['condition-power'], needs: ['power'], rates: { watts: 15 } },
  envelope: { rated: 1, pushMax: 3, instabilityPerPush: 0.15 },
  pushedDraw: ['+1: pass bank paralleled — second bank drawn', '+2: heatsink plan over both banks + straps ×2', '+3: coolant barbs, stencil struck'],
  graftsInto: ['ACT servo driver seat (adapter plate)'],
  variants: [
    { label: '15 W · ISOLATED', p: {} },
    { label: '40 W', p: { watts: 40 } },
    { label: '90 W · HOT', p: { watts: 90, isolated: false } }
  ]
};
const norm = p => ({ watts: QUANT.snap(p?.watts ?? 15, WATTS), isolated: p?.isolated !== false });

// heatsink in PLAN: outline + fin lines inside the surface
export function sinkPlan(x, y, w2, h2, sw = W.vis) {
  let out = RC(x, y, w2, h2, sw, '#fff');
  const n = Math.max(3, Math.round(w2 / 7));
  for (let i = 1; i < n; i++) out += L(x + w2 * i / n, y + 1.5, x + w2 * i / n, y + h2 - 1.5, 0.8);
  return out;
}

export function draw(p, view = {}) {
  const q = norm(p), dens = view.density ?? 2, heavy = view.lod === 'thumb';
  const push = Math.min(3, Math.max(0, view.push ?? 0));
  const [Wm, Hm] = DIM[q.watts];
  const k = view.k ?? fitK(Wm + 10, Hm, view.fit ?? 160);
  const wpx = Wm * k, hpx = Hm * k, m = 3 * k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  let out = RC(0, 0, wpx, hpx, swB, '#fff');
  // transformer can, left column (leaves a bottom-left strip for the stencil)
  const tx = m, ty = m, tw = wpx * 0.28, th = hpx - 2 * m - 4 * k;
  out += RC(tx, ty, tw, th, swM, '#fff');
  for (let i = 1; i <= 3; i++) out += L(tx + tw * i / 4, ty + th * 0.12, tx + tw * i / 4, ty + th * 0.88, swM);
  if (q.isolated && !heavy) out += L(tx + tw + 1.2 * k, ty, tx + tw + 1.2 * k, hpx - m, 0.7, '3 2'); // isolation barrier
  // rating stencil, bottom-left strip
  if (!heavy && dens >= 3) out += TX(tx + tw / 2, hpx - m + 1 * k, `${q.watts}W`, 2.2 * k, 'middle', true);
  // reservoir caps: one row, top-right zone
  const zx = tx + tw + 2.6 * k;
  const nC = q.watts >= 40 ? 3 : 2;
  const rC = Math.min(0.13 * hpx, (wpx - m - zx) / (2.3 * nC));
  for (let i = 0; i < nC; i++) {
    const cx = zx + rC + i * 2.3 * rC, cy = m + rC;
    out += C(cx, cy, rC, swM, '#fff') + L(cx - rC * 0.5, cy, cx + rC * 0.5, cy, 0.7);
  }
  // pass bank: hatched strip, bottom-right, inset from both edges
  const pbX = zx, pbW = wpx - m - zx, pbH = 0.2 * hpx, pbY = hpx - m - pbH;
  out += RC(pbX, pbY, pbW, pbH, swM, heavy ? '#fff' : 'url(#f45)');
  if (q.watts >= 40 && !heavy && push < 2) out += sinkPlan(pbX + pbW * 0.55, pbY - 1 * k, pbW * 0.45, pbH + 2 * k, W.vis); // stock sink over hot half
  // PUSHED STATE — drawn, never badged
  if (push >= 1) out += RC(pbX, pbY - pbH - 1.6 * k, pbW, pbH, swM, heavy ? '#fff' : 'url(#f45)'); // +1 bank paralleled
  if (push >= 2 && !heavy) {
    out += sinkPlan(pbX - 0.8 * k, pbY - pbH - 2.4 * k, pbW + 1.6 * k, 2 * pbH + 4 * k, W.vis);    // +2 sink over both banks
    for (const sx of [pbX + pbW * 0.28, pbX + pbW * 0.72]) {                                        // straps ×2, wrap the module
      out += L(sx, -1.6 * k, sx, hpx + 1.6 * k, W.vis);
      out += RC(sx - 1.1 * k, -2.8 * k, 2.2 * k, 1.4 * k, W.mid, '#fff');                           // buckle
    }
  }
  if (push >= 3 && !heavy) {
    for (const ty2 of [0.16, 0.3]) { out += C(wpx + 1.4 * k, hpx * ty2, 0.8 * k, W.mid, '#fff'); out += L(wpx, hpx * ty2, wpx + 0.6 * k, hpx * ty2, W.mid); } // coolant barbs
    out += L(tx + tw * 0.1, hpx - m + 2 * k, tx + tw * 0.9, hpx - m - 1 * k, W.vis);               // stencil struck
    out += TX(tx + tw + 2 * k, hpx - m + 1.4 * k, '+3', 2.2 * k, 'start');
  }
  // corner screws + keyed pins, clear of everything
  if (dens >= 3 && !heavy) for (const [sx, sy] of [[1.5 * k, 1.5 * k], [wpx - 1.5 * k, hpx - 1.5 * k]]) out += screwMini(sx, sy, 0.8 * k, 'cross');
  out += keyPin(-2.6 * k, hpx * 0.5, heavy ? 5 * k : 4 * k) + keyPin(wpx + 2.6 * k, hpx * 0.6, heavy ? 5 * k : 4 * k);
  if (dens >= 3 && !heavy) { out += TX(-2.6 * k, hpx * 0.5 + 5 * k, 'IN', 8) + TX(wpx + 2.6 * k, hpx * 0.6 + 5 * k, 'OUT', 8); }
  return frame(wpx + 11 * k, hpx + (push >= 2 ? 3.2 * k : 0) + (dens >= 3 && !heavy ? 6 * k : 2 * k), `<g transform="translate(${(5.5 * k).toFixed(1)},${push >= 2 ? (3.2 * k).toFixed(1) : 0})">${out}</g>`);
}
export function thumb(p) { return draw(norm(p ?? {}), { lod: 'thumb', density: 1, fit: 50 }); }
export function binGlyph() { return thumb({ watts: 15 }); }

// ── wire contract: the loom lands on the IN pin ──
export function wirePad(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  const [, Hm] = DIM[q.watts];
  return { x: 5.5 * k - 2.6 * k, y: Hm * k * 0.5 };
}
