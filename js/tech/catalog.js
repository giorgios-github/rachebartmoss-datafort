// js/tech/catalog.js — bridge between the DF-TO-C parts catalogue and the module
// renderer/editor: registry lookup, natural footprint, and enclosure embedding.
import { BINS, BIN_ORDER, allParts } from './parts/index.js';
export { BINS, BIN_ORDER, allParts };

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
// embed a part into an enclosure drawing at (xPx,yPx), scaled to wPx×hPx
export function catEmbed(id, params, xPx, yPx, wPx, hPx, density, lod) {
  const f = catFigure(id, params, { k: FOOT_K, lod: lod || 'plate', density: density ?? 2 });
  if (!f) return '';
  return f.svg.replace(/width="[\d.]+" height="[\d.]+"/,
    `x="${xPx.toFixed(2)}" y="${yPx.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" preserveAspectRatio="xMidYMid meet"`);
}
