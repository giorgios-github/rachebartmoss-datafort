// parts/store/cartridge-bay.js — the bay family: one part, every payload class.
// frame 'full' (heavy card-guide frame) or 'rail' (SD-style: two thin rails + end stop).
// payloads: cartridge · capsule (luer line to an ACT/injector) · card (contacts or RFID).
import { L, C, RC, TX, POLY, frame, fitK, W, DASH, QUANT, seat, screwMini, flangeV } from '../lib.js';

export const meta = {
  id: 'cartridge-bay', bin: 'STORE', label: 'BAY',
  params: {
    payload: { def: 'cartridge', options: ['cartridge', 'capsule', 'card'] },
    frame: { def: 'full', options: ['full', 'rail'] },
    rfid: { def: false, note: 'card only: contactless — antenna zone instead of contacts' },
    occupied: { def: false },
    mounted: { def: false, note: 'trans-boîtier: only the lip + slot show outside' }
  },
  slots: [{ id: 'bay0', accepts: 'STORE (cartridge, capsule, card)', keying: 'SE chamfer / end stop', param: 'occupied' }],
  functions: { provides: ['hold-module', 'read-card (card payload)'], needs: [], rates: {} },
  envelope: { rated: 1, pushMax: 0, instabilityPerPush: 1 },
  pushedDraw: ['unpushable: structure — a bay pushed is a bay cracked'],
  graftsInto: ['accepts WRONG-bin payloads only through a GRAFT adapter plate — the stack is the tell'],
  variants: [
    { label: 'CARTRIDGE · FULL · EMPTY', p: {} },
    { label: 'CARTRIDGE · SEATED', p: { occupied: true } },
    { label: 'CARD · RAIL (SD) · SEATED', p: { payload: 'card', frame: 'rail', occupied: true } },
    { label: 'CAPSULE · RAIL → INJECTOR', p: { payload: 'capsule', frame: 'rail', occupied: true } },
    { label: 'CARD READER · CONTACTS', p: { payload: 'card', frame: 'rail' } },
    { label: 'CARD · RFID', p: { payload: 'card', frame: 'rail', rfid: true, occupied: true } },
    { label: 'TRAVERSANT — LÈVRE', p: { payload: 'card', mounted: true } },
    { label: 'EXT SEUL — LÈVRE + CARTE', p: { payload: 'card', mounted: 'exterior' } }
  ]
};
const norm = p => ({
  payload: ['capsule', 'card'].includes(p?.payload) ? p.payload : 'cartridge',
  frame: p?.frame === 'rail' ? 'rail' : 'full',
  rfid: !!p?.rfid, occupied: !!p?.occupied, mounted: p?.mounted === 'exterior' ? 'exterior' : !!p?.mounted
});

export function draw(p, view = {}) {
  const q = norm(p), heavy = view.lod === 'thumb', dens = view.density ?? 2;
  if (q.mounted) {
    // TRAVERSANT vu de haut (plan, horizontal): rails + carte inside, flange ON the wall,
    // lip + emerged card outside — glued to the flange. 'exterior' = emerged part only.
    const k = view.k ?? fitK(38, 26, view.fit ?? 195);
    const cy = 11 * k, ext = q.mounted === 'exterior';
    let out = '', x = 3 * k;
    if (!ext) {
      out += RC(x - 1.4 * k, cy - 9.8 * k, 1.4 * k, 19.6 * k, W.mid, '#fff');          // end stop
      for (const s of [-1, 1]) {
        out += RC(x, cy + (s < 0 ? -9.8 * k : 8.2 * k), 15 * k, 1.6 * k, W.mid, '#fff'); // rails, plan
        out += L(x + 1 * k, cy + s * 9 * k, x + 14 * k, cy + s * 9 * k, 0.6);          // guide groove
      }
      out += RC(x + 1.5 * k, cy - 7.8 * k, 13.5 * k, 15.6 * k, W.vis, '#fff');         // card, seated span (true portrait width)
      out += L(x + 1.5 * k, cy - 5.8 * k, x + 3.5 * k, cy - 7.8 * k, W.mid);           // chamfer key
      out += L(x + 4 * k, cy, x + 13 * k, cy, 0.6, DASH.hl);                           // travel
      x += 15 * k;
      out += flangeV(x, cy, 8.8 * k, k, heavy);
      x += 1.8 * k;
    }
    out += RC(x, cy - 9 * k, 1.2 * k, 18 * k, W.cut, '#fff');                          // lip bezel
    out += RC(x + 0.3 * k, cy - 8.2 * k, 0.6 * k, 16.4 * k, W.mid, '#fff');            // slot mouth
    out += RC(x + 1.2 * k, cy - 7.8 * k, 4.5 * k, 15.6 * k, W.vis, '#fff', null, 1 * k); // card, emerged
    if (dens >= 3 && !heavy) out += TX(x + 3 * k, cy + 10 * k + 8, ext ? 'EXT SEUL' : 'TRAVERSANT · PLAN', 8);
    return frame(x + 8 * k, cy + 10 * k + (dens >= 3 ? 12 : 0), out);
  }
  // card = portrait format; a credit-card-like object inserts PARTIALLY and sticks out the top
  const Wmm = q.payload === 'card' ? 20 : 22, Hmm = q.payload === 'card' ? 16 : 26;
  const cardOut = q.payload === 'card' && q.occupied ? 11 : 0;                       // mm sticking out
  const k = view.k ?? fitK(Wmm + 10, Hmm + 6, view.fit ?? 130);
  const wpx = Wmm * k, hpx = Hmm * k;
  const swB = heavy ? W.cut : W.vis, swM = heavy ? W.vis : W.mid;
  let out = '', inX, inY, inW, inH;
  if (q.frame === 'full') {
    const f = 2.2 * k;
    out += RC(0, 0, wpx, hpx, swB, '#fff') + RC(f, f, wpx - 2 * f, hpx - 2 * f, swM, '#fff');
    if (!heavy) for (const [sx, sy] of [[f / 2, f / 2], [wpx - f / 2, f / 2], [wpx - f / 2, hpx - f / 2], [f / 2, hpx - f / 2]]) out += screwMini(sx, sy, 0.8 * k, 'cross');
    inX = f + 1.4 * k; inY = f + 1 * k; inW = wpx - 2 * inX; inH = hpx - 2 * f - 3 * k;
  } else {
    // SD-style: two thin rails + end stop + eject notch — light
    for (const rx of [0, wpx - 1.6 * k]) {
      out += RC(rx, 0, 1.6 * k, hpx, swM, '#fff');
      out += L(rx + 0.8 * k, 1 * k, rx + 0.8 * k, hpx - 1 * k, heavy ? 1.2 : 0.6); // guide groove
    }
    out += RC(0, hpx - 1.4 * k, wpx, 1.4 * k, swM, '#fff');                        // end stop
    out += POLY([[wpx * 0.42, 0], [wpx * 0.46, -1.2 * k], [wpx * 0.54, -1.2 * k], [wpx * 0.58, 0]], swM, false); // eject notch
    inX = 2.4 * k; inY = 1 * k; inW = wpx - 4.8 * k; inH = hpx - 3.4 * k;
  }
  // payload (or lawful empty seat)
  if (!q.occupied) {
    out += seat(inX, inY, inW, inH, 'SE');
    if (dens >= 3 && !heavy) out += TX(wpx / 2, hpx + 14, `ACCEPTS ${q.payload.toUpperCase()}`, 8);
  } else if (q.payload === 'cartridge') {
    out += RC(inX, inY, inW, inH, swB, '#fff', null, 1 * k);
    out += L(inX + 2 * k, inY + 2.2 * k, inX + inW - 2 * k, inY + 2.2 * k, swM);   // shoulder
    if (dens >= 3 && !heavy) out += TX(wpx / 2, hpx + 14, 'CARTRIDGE SEATED', 8);
  } else if (q.payload === 'capsule') {
    // capsule: rounded cylinder in two saddles, luer taper out the bottom
    const cy = inY + inH / 2, cr = Math.min(inW * 0.32, inH * 0.4);
    out += RC(inX + inW / 2 - cr, cy - cr * 1.4, 2 * cr, 2.8 * cr, swB, '#fff', null, cr);
    for (const sy of [-0.9, 0.9]) out += L(inX + inW / 2 - cr - 0.8 * k, cy + sy * cr, inX + inW / 2 + cr + 0.8 * k, cy + sy * cr, swM); // saddles
    out += POLY([[wpx / 2 - 1 * k, hpx], [wpx / 2, hpx + 2 * k], [wpx / 2 + 1 * k, hpx]], swM, false); // luer taper
    if (!heavy) { out += L(wpx / 2, hpx + 2 * k, wpx / 2, hpx + 3.6 * k, W.mid); if (dens >= 3) out += TX(wpx / 2, hpx + 3.6 * k + 10, '→ INJECTOR', 8); }
  } else {
    // card: PORTRAIT format, credit-card proportions, inserted PARTIALLY — it sticks out
    const cw = inW * 0.78, cx0 = inX + (inW - cw) / 2, r = 1.6 * k;
    const cTop = -cardOut * k + 1 * k, cBot = inY + inH - 1 * k;
    out += RC(cx0, cTop, cw, cBot - cTop, swB, '#fff', null, r);
    if (q.rfid) {
      out += RC(cx0 + cw * 0.2, cTop + (cBot - cTop) * 0.3, cw * 0.6, (cBot - cTop) * 0.3, 0.8, 'none', DASH.hl); // antenna zone
      if (dens >= 3 && !heavy) out += TX(wpx / 2, hpx + 14, 'RFID · NO CONTACTS', 8);
    } else {
      const nCt = heavy ? 4 : 6;
      for (let i = 0; i < nCt; i++) out += RC(cx0 + cw * (0.16 + 0.68 * i / (nCt - 1)) - 0.4 * k, cBot - 2.8 * k, 0.8 * k, 2 * k, 0, '#111'); // contacts, seated end
      if (dens >= 3 && !heavy) out += TX(wpx / 2, hpx + 14, 'CONTACT ROW', 8);
    }
    // the reader owns the card where it is inserted: redraw rails/frame edge over it
    if (q.frame === 'rail') { for (const rx of [0, wpx - 1.6 * k]) { out += RC(rx, 0, 1.6 * k, hpx, swM, '#fff'); out += L(rx + 0.8 * k, 1 * k, rx + 0.8 * k, hpx - 1 * k, heavy ? 1.2 : 0.6); } out += RC(0, hpx - 1.4 * k, wpx, 1.4 * k, swM, '#fff'); }
    else out += L(0, 0, wpx, 0, swB);
  }
  const extra = q.payload === 'capsule' && q.occupied && !heavy ? 4.6 * k : 0;
  return frame(wpx, cardOut * k + hpx + extra + (dens >= 3 && !heavy ? 18 : 2 * k), `<g transform="translate(0,${(cardOut * k).toFixed(1)})">${out}</g>`, q.frame === 'rail' ? 10 : 8);
}
export function thumb(p) { return draw(norm(p ?? { occupied: true }), { lod: 'thumb', density: 1, fit: 48 }); }
export function binGlyph() { return thumb({ occupied: true }); }

// ── mounting contract (trans-paroi plan: flange centre; outward = local +x) ──
export function wallAnchor(p, view = {}) {
  const q = norm(p), k = view.k ?? 8;
  if (q.mounted === 'exterior' || view.exterior) return { x: 3 * k, y: 11 * k, axis: 'x' };
  return { x: 3 * k + 15 * k + 0.9 * k, y: 11 * k, axis: 'x' };
}
export function wirePad(p, view = {}) { const k = view.k ?? 8; return { x: 3 * k - 1.4 * k, y: 11 * k }; }
