// js/tech/rules.js — quantisation tables + scale-class rules (DF-TO-R rev A).
// Scale classes (the central law): FIXED never changes size · QUANTISED snaps to
// stock · COUNTED repeats instead of growing · CONTINUOUS = outline + area only.
export const INK = '#111', PAPER = '#fff';
export const W = { cut: 3, vis: 2.2, mid: 1.4, fine: 0.7 };           // FIXED px
export const DASH = { cl: '18 4 4 4', hl: '7 4', ph: '12 4 3 4 3 4' }; // FIXED px

export function tierOf(maxDim) { return maxDim <= 25 ? 1 : maxDim <= 80 ? 2 : maxDim <= 160 ? 3 : 4; }
export const WALL_STOCK = [1.0, 1.6, 2.0, 2.5, 3.0];                  // QUANTISED mm
export function wallFor(tier) { return [1.0, 1.6, 2.5, 3.0][tier - 1]; }
export function wallSnap(v) { let b = WALL_STOCK[0]; for (const s of WALL_STOCK) if (Math.abs(s - v) < Math.abs(b - v)) b = s; return b; }
export function screwFor(wall) {                                       // QUANTISED
  if (wall <= 1.2) return { name: 'M2', d: 2 };
  if (wall <= 1.8) return { name: 'M2.5', d: 2.5 };
  if (wall <= 2.6) return { name: 'M3', d: 3 };
  return { name: 'M4', d: 4 };
}
export const pitchMax = s => 24 * s.d;                                 // COUNTED driver
export const edgeDist = (wall, s) => wall + 1.5 * s.d;                 // FIXED formula
export function filletFor(tier, origin) {
  const r = [1, 2, 3, 4][tier - 1];
  return { kind: origin === 'HANDMADE' ? 'chamfer' : 'fillet', r };
}
export function driveFor(origin, i) {
  if (origin === 'HANDMADE') return ['slot', 'cross', 'hex'][i % 3];   // mismatched drives = design language, not wear
  if (origin === 'SALVAGE') return i % 4 === 3 ? 'slot' : 'cross';     // donor screws
  if (origin === 'CORP PULL') return 'torx';
  return 'tri';                                                        // FACTORY: tri-point one-way
}
export const captive = origin => origin === 'FACTORY' || origin === 'CORP PULL';
export const PORT = {                                                   // FIXED mm
  power:  { out: 10.5, half: 5, keep: 6, label: 'PWR' },
  data:   { out: 9,    half: 4, keep: 5, label: 'DATA' },
  mech:   { out: 13,   half: 6, keep: 7, label: 'MECH' },
  matter: { out: 15,   half: 7, keep: 8, label: 'MATTER' },
};
export function ventFor(tier) { return { len: tier >= 3 ? 12 : 8, w: 1.5, pitch: 4 }; } // FIXED/QUANTISED
export function ventCount(heat) { return heat ? Math.ceil(heat * 1.5) : 0; }            // COUNTED — zero heat, zero slots
export function hatchFor(origin) { return (origin === 'FACTORY' || origin === 'CORP PULL') ? 'f45' : 'h45'; }
export function hatchOpp(id) { return { h45: 'f135', f45: 'h135', h135: 'f45', f135: 'h45' }[id]; }
export function depthFor(tier) { return [6, 10, 16, 22][tier - 1]; }    // QUANTISED mm
export function qfpFor(minDim) { return minDim > 20 ? 12 : minDim > 14 ? 10 : 7; } // QUANTISED
export function caseMat(origin) {
  return { HANDMADE: 'MS PLATE, BENT + BRAZED', SALVAGE: 'DONOR SHELL, RE-TAPPED', 'CORP PULL': 'Mg ALLOY, DE-BRANDED', FACTORY: 'Mg ALLOY DIE-CAST' }[origin];
}
export const BOARD_MIN = { w: 10, h: 8 };                               // FIXED
export const PLATE = { w: 16, h: 6 };                                   // FIXED data plate
export const ORIGINS = ['HANDMADE', 'SALVAGE', 'CORP PULL', 'FACTORY'];

// ---- SURFACE FEATURES — controls & interfaces on the shell. All FIXED mm
// (a button is a button whatever the box); arrays are COUNTED (keypad keys).
export const FEAT = {
  button:  { face: 1, r: 2.2, keep: 3.5 },
  switch:  { face: 1, w: 7, h: 3.6, keep: 5 },
  led:     { face: 1, r: 1.1, keep: 2.5 },
  dial:    { face: 1, r: 3.6, ticks: 8, keep: 5 },                     // ticks COUNTED
  screen:  { face: 1, stock: [[12, 8], [16, 10], [22, 14]], keep: 3 }, // QUANTISED window stock
  keypad:  { face: 1, key: 3.4, pitch: 4.6, rows: 4, cols: 3, keep: 3 }, // key FIXED, grid COUNTED
  antenna: { perim: 1, len: 14, coil: 3, keep: 4 },                     // whip len QUANTISED-ish, coil turns COUNTED
  rail:    { perim: 1, w: 15, keep: 4 },                                // mount: dovetail rail foot, FIXED profile
};
export function screenSnap(w, h) {                                      // QUANTISED
  let best = FEAT.screen.stock[0], bd = Infinity;
  for (const [sw, sh] of FEAT.screen.stock) { const d = Math.abs(sw - w) + Math.abs(sh - h); if (d < bd) { bd = d; best = [sw, sh]; } }
  return best;
}

// ---- archetype tables required by the parts catalogue (DF-TO-C) ----
export const BORE_STOCK = [2, 3, 5, 6, 8, 10, 14, 18];                  // QUANTISED mm
export function boreFor(od, wall) {
  const max = od - 2 * wall;
  let b = BORE_STOCK[0];
  for (const s of BORE_STOCK) if (s <= max * 0.8) b = s;
  return b;
}
export function threadFor(od) {                                          // QUANTISED
  const q = [8, 10, 12, 14, 18, 24, 32].reduce((a, s) => s <= od ? s : a, 8);
  return { name: `M${q}×${q >= 14 ? '1.5' : '1.0'}`, len: od <= 12 ? 6 : od <= 18 ? 8 : 10 };
}
export const ringPitch = 30;                                             // COUNTED driver
export function plateThick(tier) { return [2, 3, 4, 5][tier - 1]; }      // QUANTISED
export function plateSnap(v) { let b = 2; for (const s of [2, 3, 4, 5]) if (Math.abs(s - v) < Math.abs(b - v)) b = s; return b; }
export function pivotBore(tier) { return [2, 3, 4, 5][tier - 1]; }       // QUANTISED
export const PAYLOAD = { round: 10, cell: 15, vial: 12 };                // FIXED Ø mm
export function finBase(tier) { return [3, 4, 5, 6][tier - 1]; }         // QUANTISED
export function finHeight(tier) { return [8, 12, 16, 20][tier - 1]; }    // QUANTISED
export const FIN = { w: 1.5, pitch: 5 };                                 // FIXED
export function substrateFor(tier) { return tier === 1 ? 0.8 : tier === 2 ? 1.6 : 2.4; } // QUANTISED
export const FINGER = { pitch: 2.54, w: 1.4, len: 5 };                   // FIXED
export const PIN_PITCH = 0.8;                                            // FIXED
export function dieFor(body) { return body > 18 ? 8 : body > 10 ? 5 : 3; } // QUANTISED
export const CLIP_PITCH = 40;                                            // COUNTED driver
export const JACKET = 4;                                                 // FIXED Ø
export function vesselWall(tier, bar) { const w = wallFor(tier); return (bar || 0) >= 12 ? wallSnap(w + 1) : w; }

// ---- INTERIOR FURNITURE — default stock sizes (QUANTISED at placement, user-resizable)
export const GUT = {
  board:  { w: 14, h: 10, label: 'PCB' },
  cell:   { w: 10, h: 6,  label: 'CELL' },
  stack:  { w: 7,  h: 14, label: 'STACK' },
  mech:   { w: 12, h: 9,  label: 'MECH' },
  module: { w: 10, h: 8,  label: 'MODULE' },                            // nested sealed module
};
