// js/tech/catalog.js — bridge between the DF-TO-C parts catalogue and the module
// renderer/editor: registry lookup, natural footprint, enclosure embedding, and the
// MOUNTING contracts (in / face / wall) with wall anchors + wire pads.
import { BINS, BIN_ORDER, allParts, HIDDEN } from './parts/index.js';
import { defsBlock } from './law.js';
export { BINS, BIN_ORDER, allParts };

// default mount per part: 'in' (cavity) | 'face' (on the lid) | 'wall' (trans-paroi)
export const MOUNT = { emitter: 'wall', antenna: 'wall', injector: 'wall', 'chem-sniffer': 'wall', screen: 'face', 'rail-clamp': 'face', keypad: 'face', button: 'face', switch: 'face', dial: 'face', 'led-array': 'face', socket: 'face', 'neural-jack': 'face' };
export const catMount = id => MOUNT[id] || 'in';

export const byId = {};
for (const p of allParts()) byId[p.meta.id] = p;
for (const p of HIDDEN) byId[p.meta.id] = p;

const FOOT_K = 8; // render scale used to measure a part's natural size
export function catFigure(id, params, view) {
  const mod = byId[id];
  if (!mod) return null;
  const svg = mod.draw(params || {}, view || {});
  const m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  return { svg, wPx: m ? +m[1] : 100, hPx: m ? +m[2] : 60 };
}
// natural footprint in mm (includes the part's own frame padding — seat it honestly)
export function catFootprint(id, params) {
  const f = catFigure(id, params, { k: FOOT_K, lod: 'plate', density: 1 });
  if (!f) return { w: 12, h: 10 };
  return { w: Math.max(4, Math.round(f.wPx / FOOT_K)), h: Math.max(4, Math.round(f.hPx / FOOT_K)) };
}
// embed a part into an enclosure drawing at (xPx,yPx), scaled to wPx×hPx (+ 90° rot steps).
// UNIFORM INK: the part is rendered at the EFFECTIVE k (so its FIXED px stroke weights
// match the enclosure's — never drawn small and blown up, never drawn big and shrunk).
// SIZE IS PRESERVED under rotation: content fitted to the UNSWAPPED box, then rotated.
export function catEmbed(id, params, xPx, yPx, wPx, hPx, density, lod, rot) {
  const probe = catFigure(id, params, { k: FOOT_K, lod: 'thumb', density: 1 });
  if (!probe) return '';
  const natW = probe.wPx / FOOT_K, natH = probe.hPx / FOOT_K;              // natural size, mm
  const quarter = rot === 90 || rot === 270;
  const w2 = quarter ? hPx : wPx, h2 = quarter ? wPx : hPx;
  const kEff = Math.max(0.8, Math.min(w2 / natW, h2 / natH));
  const f = catFigure(id, params, { k: kEff, lod: lod || 'plate', density: Math.min(density ?? 2, 2) });
  if (!f) return '';
  const x2 = xPx + (wPx - w2) / 2, y2 = yPx + (hPx - h2) / 2;
  const svg = f.svg.replace(/width="[\d.]+" height="[\d.]+"/,
    `x="${x2.toFixed(2)}" y="${y2.toFixed(2)}" width="${w2.toFixed(2)}" height="${h2.toFixed(2)}" preserveAspectRatio="xMidYMid meet"`);
  if (!rot) return svg;
  const cx = xPx + wPx / 2, cy = yPx + hPx / 2;
  return `<g transform="rotate(${rot} ${cx.toFixed(2)} ${cy.toFixed(2)})">${svg}</g>`;
}
// transformable inner fragment (root <svg> + duplicated defs stripped); the frame pad
// (8px) stays inside as a translate — anchors are LOCAL coords, add PAD when aligning.
export const CAT_PAD = 8;
export function catInner(id, params, view) {
  const mod = byId[id];
  if (!mod) return null;
  const svg = mod.draw(params || {}, view || {});
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(defsBlock(), '');
  return { inner, wPx: m ? +m[1] : 100, hPx: m ? +m[2] : 60 };
}
export function catWallAnchor(id, params, view) { const mod = byId[id]; return mod && mod.wallAnchor ? mod.wallAnchor(params || {}, view || {}) : null; }
export function catWirePad(id, params, view) { const mod = byId[id]; return mod && mod.wirePad ? mod.wirePad(params || {}, view || {}) : null; }
export function catSlotAnchor(id, params, view) { const mod = byId[id]; return mod && mod.slotAnchor ? mod.slotAnchor(params || {}, view || {}) : null; }
export function catSeatAnchor(id, params, view) { const mod = byId[id]; return mod && mod.seatAnchor ? mod.seatAnchor(params || {}, view || {}) : null; }
// which parts SEAT INTO which hosts (the coupling table)
export const SEATS_IN = { antenna: 'rf-transceiver' };
