// js/tech/catalog.js — bridge between the DF-TO-C parts catalogue and the module
// renderer/editor: registry lookup, natural footprint, enclosure embedding, and the
// MOUNTING contracts (in / face / wall) with wall anchors + wire pads.
import { BINS, BIN_ORDER, allParts } from './parts/index.js';
import { defsBlock } from './law.js';
export { BINS, BIN_ORDER, allParts };

// default mount per part: 'in' (cavity) | 'face' (on the lid) | 'wall' (trans-paroi)
export const MOUNT = { emitter: 'wall', antenna: 'wall', screen: 'face' };
export const catMount = id => MOUNT[id] || 'in';

export const byId = {};
for (const p of allParts()) byId[p.meta.id] = p;

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
// embed a part into an enclosure drawing at (xPx,yPx), scaled to wPx×hPx (+ 90° rot steps)
export function catEmbed(id, params, xPx, yPx, wPx, hPx, density, lod, rot) {
  const f = catFigure(id, params, { k: FOOT_K, lod: lod || 'plate', density: density ?? 2 });
  if (!f) return '';
  const svg = f.svg.replace(/width="[\d.]+" height="[\d.]+"/,
    `x="${xPx.toFixed(2)}" y="${yPx.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" preserveAspectRatio="xMidYMid meet"`);
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
