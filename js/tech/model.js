// js/tech/model.js — the TechPart data structure: the object IS this record, the
// drawing is a projection of it. Designed to be COMPACT — a generator can emit a
// whole part as one line of JSON (short keys, defaults everywhere, geometry derived).
//
//  part = {
//    id, label,
//    outline: [[mm,mm],…]           y-down, closed — the single size truth (CONTINUOUS)
//    origin: 'HANDMADE'|'SALVAGE'|'CORP PULL'|'FACTORY'   → design language
//    sealed: bool                    build state (potted) — NOT an origin
//    heat:   0..n                    → vent COUNT (zero heat, zero slots)
//    ports:  [{k:'power|data|mech|matter', t:0..1}]        t = perimeter arc position
//    feats:  [{k:'button|switch|led|dial|screen|keypad|antenna|rail', at:[x,y] | t, …}]
//    guts:   [{k:'board|cell|stack|mech|module', at:[x,y], w, h, label?}]
//    wires:  [['g0','p0'],…]         internal logic; refs g#/p#/f#; absent → autoWires()
//    fmax:   int                     fastener clamp (design intent)
//  }
//  (epistemic — resolved|ghosted — is a VIEW property: what the observer knows.)
import * as G from './geom.js';
import * as R from './rules.js';
import { byId as catParts } from './catalog.js';

export const ORIGINS = R.ORIGINS;
export const PORT_KINDS = Object.keys(R.PORT);
export const FEAT_KINDS = Object.keys(R.FEAT);
export const GUT_KINDS = Object.keys(R.GUT);

let _uid = 0;
export function newId(prefix) { return `${prefix}-${(++_uid).toString(36)}${Date.now().toString(36).slice(-4)}`; }

export function newPart(outline, opts = {}) {
  return normalize({
    id: opts.id || newId('mod'),
    label: opts.label || 'UNTITLED MODULE',
    outline: outline || G.roundedRect(48, 30, 3),
    origin: opts.origin || 'HANDMADE',
    sealed: !!opts.sealed,
    heat: opts.heat || 0,
    ports: opts.ports || [],
    feats: opts.feats || [],
    guts: opts.guts || [],
    wires: opts.wires || null,
    fmax: opts.fmax || 0,
  });
}

export function normalize(p) {
  p.ports = (p.ports || []).map(x => ({ k: x.k || x.type || 'data', t: x.t ?? 0.5 }));
  p.feats = (p.feats || []).map(x => {
    const spec = R.FEAT[x.k] || R.FEAT.button;
    const f = { k: x.k in R.FEAT ? x.k : 'button' };
    if (spec.perim) { f.t = x.t ?? 0.25; if (x.len) f.len = x.len; }
    else f.at = x.at || [0, 0];
    if (f.k === 'screen') { const [w, h] = R.screenSnap(x.w || 16, x.h || 10); f.w = w; f.h = h; }
    if (f.k === 'keypad') { f.rows = x.rows || R.FEAT.keypad.rows; f.cols = x.cols || R.FEAT.keypad.cols; }
    return f;
  });
  p.guts = (p.guts || []).map(x => {
    if (x.k === 'cat') {                                                   // catalogue part (DF-TO-C), params drive its geometry
      return {
        k: 'cat', cat: String(x.cat || 'cell'), params: (x.params && typeof x.params === 'object') ? x.params : {},
        at: x.at || [0, 0], w: x.w || 14, h: x.h || 12,
        ...(x.mount === 'face' || x.mount === 'wall' ? { mount: x.mount } : {}),  // 'in' (default) | 'face' (on the lid) | 'wall' (trans-paroi)
        ...(x.t != null ? { t: x.t } : {}),                                       // wall parts: perimeter position
        ...(x.rot ? { rot: ((x.rot % 360) + 360) % 360 } : {}),                   // R rotation, 90° steps
        ...(x.label ? { label: x.label } : {}),
        ...(x.push ? { push: Math.max(0, Math.min(3, x.push | 0)) } : {}),
        ...(x.donor ? { donor: String(x.donor) } : {}),
      };
    }
    const d = R.GUT[x.k] || R.GUT.board;
    return {
      k: x.k in R.GUT ? x.k : 'board', at: x.at || [0, 0], w: x.w || d.w, h: x.h || d.h,
      ...(x.label ? { label: x.label } : {}),
      ...(x.push ? { push: Math.max(0, Math.min(3, x.push | 0)) } : {}),   // OVERDRIVE: 0..3 beyond the rated envelope
      ...(x.donor ? { donor: String(x.donor) } : {}),                      // LINEAGE: where this part lived before
    };
  });
  p.events = Array.isArray(p.events) ? p.events.filter(s => typeof s === 'string' && s) : [];  // the object's history
  if (!Array.isArray(p.wires)) p.wires = null;
  return p;
}

// ---- transgression: pushing parts past their envelope. Gains rates, buys
// instability, and generates heat the vents must answer for.
export function pushSum(p) { return p.guts.reduce((s, g) => s + (g.push || 0), 0); }
export function effHeat(p) { return (p.heat || 0) + 0.7 * pushSum(p); }

// ---- internal logic: which lead goes where. Explicit part.wires wins; otherwise
// derive a sane loom — cell feeds board, ports land on their natural organ,
// signal-bearing surface features hang off the board.
export function autoWires(p) {
  if (p.wires) return p.wires;
  const gi = kind => p.guts.findIndex(g => g.k === kind);
  const first = p.guts.length ? 0 : -1;
  const board = gi('board') >= 0 ? gi('board') : first;
  const cell = gi('cell'), mech = gi('mech'), stack = gi('stack');
  const W2 = [];
  if (cell >= 0 && board >= 0 && cell !== board) W2.push([`g${cell}`, `g${board}`]);
  p.guts.forEach((g, i) => {
    if (board < 0 || i === board) return;
    if (g.k === 'module') { W2.push([`g${i}`, `g${board}`]); return; }
    if (g.k === 'cat') {                                     // wire only what NEEDS power/control
      const needs = (catParts[g.cat] && catParts[g.cat].meta.functions && catParts[g.cat].meta.functions.needs) || [];
      if (needs.length) W2.push([`g${i}`, `g${board}`]);
    }
  });
  p.ports.forEach((pt, i) => {
    let tgt = board;
    if (pt.k === 'power') tgt = cell >= 0 ? cell : board;
    else if (pt.k === 'mech') tgt = mech >= 0 ? mech : board;
    else if (pt.k === 'matter') tgt = stack >= 0 ? stack : (cell >= 0 ? cell : board);
    if (tgt >= 0) W2.push([`p${i}`, `g${tgt}`]);
  });
  p.feats.forEach((f, i) => {
    if (f.k === 'rail') return;                       // a mount is mechanical, not wired
    if (board >= 0) W2.push([`f${i}`, `g${board}`]);
  });
  return W2;
}

// ---- budgets: the engineer's ledger, derived. Mass/space/power/heat + build DC.
const DRAW = { board: 0.8, module: 0.5, screen: 1.2, keypad: 0.2, dial: 0.1, led: 0.1, button: 0.05, switch: 0.05, antenna: 0.4 };
const SUPPLY_PER_CELL_MM2 = 0.05;                     // a 10×6 cell ≈ 3.0 supply
const GUT_RHO = { board: 2.2, cell: 4.5, stack: 5.5, mech: 6.5, module: 3.5 };  // mg/mm² equiv
export function budgets(p) {
  const bb = G.bbox(p.outline);
  const tier = R.tierOf(Math.max(bb.w, bb.h));
  const wall = R.wallFor(tier), depth = R.depthFor(tier);
  const area = G.polyArea(p.outline), per = G.perimeter(p.outline);
  const shellG = (2 * area + per * depth) * wall * 1.7 / 1000;          // Mg alloy ≈1.7 g/cc
  let gutsG = 0, supply = 0, draw = 0;
  for (const g of p.guts) {
    gutsG += g.w * g.h * (GUT_RHO[g.k] || 3) * depth / 10 / 1000;
    const boost = 1 + 0.35 * (g.push || 0);                               // pushed = more juice, more thirst
    if (g.k === 'cat') {                                                  // catalogue: read its functions
      const fns = (catParts[g.cat] && catParts[g.cat].meta.functions) || {};
      if ((fns.provides || []).includes('store-power')) supply += g.w * g.h * SUPPLY_PER_CELL_MM2 * boost;
      else if ((fns.needs || []).length) draw += 0.5 * (1 + 0.3 * (g.push || 0));
    }
    else if (g.k === 'cell') supply += g.w * g.h * SUPPLY_PER_CELL_MM2 * boost;
    else if (DRAW[g.k]) draw += DRAW[g.k] * (1 + 0.3 * (g.push || 0));
  }
  for (const f of p.feats) draw += DRAW[f.k] || 0;
  const inner = G.offsetInward(p.outline, wall);
  const cavArea = Math.max(1, G.polyArea(inner));
  const used = p.guts.reduce((s, g) => s + g.w * g.h, 0);
  const push = pushSum(p);
  const ventNeed = R.ventCount(effHeat(p));
  const nParts = p.guts.length + p.ports.length + p.feats.length;
  return {
    tier, wall, depth,
    massG: Math.round(shellG + gutsG),
    spacePct: Math.min(999, Math.round(100 * used / cavArea)),
    supply: Math.round(supply * 10) / 10,
    draw: Math.round(draw * 10) / 10,
    powerOk: supply <= 0 ? draw <= 0 : draw <= supply,
    ventNeed,
    push,
    instability: push,                                                     // v1: instability = total overdrive
    dc: 8 + 2 * nParts + (p.sealed ? 4 : 0) + 2 * push,
    nParts,
  };
}

// ---- compact serialization: ONE LINE of JSON, mm rounded to 0.1 — a generator
// (or the sim) can emit/consume a whole tech object as a single record.
const r1 = n => Math.round(n * 10) / 10;
export function toJSON(p) {
  const o = {
    id: p.id, label: p.label,
    outline: p.outline.map(([x, y]) => [r1(x), r1(y)]),
    origin: p.origin,
  };
  if (p.sealed) o.sealed = 1;
  if (p.heat) o.heat = p.heat;
  if (p.ports.length) o.ports = p.ports.map(x => ({ k: x.k, t: Math.round(x.t * 1000) / 1000 }));
  if (p.feats.length) o.feats = p.feats.map(f => { const c = { k: f.k }; if (f.at) c.at = [r1(f.at[0]), r1(f.at[1])]; if (f.t != null) c.t = Math.round(f.t * 1000) / 1000; if (f.len) c.len = r1(f.len); if (f.w) { c.w = f.w; c.h = f.h; } if (f.rows) { c.rows = f.rows; c.cols = f.cols; } return c; });
  if (p.guts.length) o.guts = p.guts.map(g => ({ k: g.k, ...(g.k === 'cat' ? { cat: g.cat, ...(Object.keys(g.params || {}).length ? { params: g.params } : {}), ...(g.mount ? { mount: g.mount } : {}), ...(g.t != null ? { t: Math.round(g.t * 1000) / 1000 } : {}), ...(g.rot ? { rot: g.rot } : {}) } : {}), at: [r1(g.at[0]), r1(g.at[1])], w: r1(g.w), h: r1(g.h), ...(g.label ? { label: g.label } : {}), ...(g.push ? { push: g.push } : {}), ...(g.donor ? { donor: g.donor } : {}) }));
  if (p.events && p.events.length) o.events = p.events;
  if (p.wires) o.wires = p.wires;
  if (p.fmax) o.fmax = p.fmax;
  return JSON.stringify(o);
}
export function fromJSON(str) {
  const o = JSON.parse(str);
  return normalize({
    id: o.id || newId('mod'), label: o.label || 'IMPORTED', outline: o.outline,
    origin: R.ORIGINS.includes(o.origin) ? o.origin : 'HANDMADE',
    sealed: !!o.sealed, heat: o.heat || 0,
    ports: o.ports || [], feats: o.feats || [], guts: o.guts || [],
    events: o.events || [],
    wires: o.wires || null, fmax: o.fmax || 0,
  });
}

// ---- examples: four designs built FROM THE CATALOGUE — mounts, pushes, lineage, slots.
export function examples() {
  return [
    // 1 · the street bug — smart-core + coin cell, stub antenna through the shell
    normalize({
      id: 'tick-2', label: 'TICK', origin: 'HANDMADE', heat: 0, fmax: 2,
      outline: G.roundedRect(30, 19, 1.5),
      ports: [{ k: 'data', t: 0.52 }],
      feats: [{ k: 'led', at: [25.5, 5] }],
      guts: [
        { k: 'cat', cat: 'smart-core-ic', params: { body: 7 }, at: [4, 5], w: 11, h: 11 },
        { k: 'cat', cat: 'cell', params: { format: 'coin', cap: 1 }, at: [16.5, 6], w: 9, h: 9, donor: 'pried from a parking meter' },
        { k: 'cat', cat: 'antenna', params: { geom: 'stub', size: 12 }, mount: 'wall', t: 0.9 },
      ],
      events: ['lived three weeks taped behind a vending machine'],
    }),
    // 2 · the corpo optic-link — sealed sliver, face optic, an unexplained organ inside
    normalize({
      id: 'kiroshi-sl3', label: 'KIROSHI OPTIK-LINK SL-3', origin: 'CORP PULL', sealed: true, heat: 1,
      outline: G.chamferRect(48, 27, 4),
      ports: [{ k: 'data', t: 0.06 }, { k: 'power', t: 0.6 }],
      guts: [
        { k: 'cat', cat: 'optic', params: { grade: 'corpo', aperture: 8 }, mount: 'face', at: [5, 5.5], w: 15, h: 17 },
        { k: 'cat', cat: 'smart-core-ic', params: { body: 10 }, at: [23, 7.5], w: 13, h: 13 },
        { k: 'cat', cat: 'cell', params: { format: 'prismatic', cap: 1 }, at: [38, 6.5], w: 7, h: 14 },
      ],
      events: ['cracked open once — an unexplained organ found, left in place'],
    }),
    // 3 · the scratch PSU — pushed drone cell, coolant tracé, live scope on the lid
    normalize({
      id: 'psu-scratch', label: 'SCRATCH DECK PSU', origin: 'SALVAGE', heat: 3,
      outline: G.roundedRect(76, 46, 3),
      ports: [{ k: 'power', t: 0.03 }, { k: 'power', t: 0.5 }, { k: 'data', t: 0.68 }],
      feats: [{ k: 'switch', at: [10, 8] }, { k: 'dial', at: [22, 10] }],
      guts: [
        { k: 'cat', cat: 'cell', params: { format: 'cylindrical', cap: 8 }, at: [6, 24], w: 34, h: 12, push: 2, donor: 'pulled from a downed Militech drone' },
        { k: 'cat', cat: 'processor-board', params: { cores: 1, socket: 'occupied' }, at: [45, 24], w: 22, h: 17 },
        { k: 'cat', cat: 'coolant-loop', params: { path: [[0, 0], [40, 0], [40, 10], [12, 10], [12, 18], [0, 18]] }, at: [5, 4], w: 32, h: 16 },
        { k: 'cat', cat: 'screen', params: { displayType: 'scope-wave', bezel: 'raised', content: 'RAIL A' }, mount: 'face', at: [42, 5], w: 27, h: 14 },
      ],
      events: ['survived the Arasaka raid EMP', 'won back at the Kabuki table'],
    }),
    // 4 · the whisper pod — pushed wall emitter, rf brain with a seated stub, rail underside
    normalize({
      id: 'whisper-pod', label: 'WHISPER POD', origin: 'HANDMADE', heat: 1,
      outline: G.pill(58, 26),
      ports: [{ k: 'power', t: 0.55 }],
      guts: [
        { k: 'cat', cat: 'emitter', params: { d: 12, medium: 'ultrasonic' }, mount: 'wall', t: 0.98, push: 1, donor: 'ex-riot-wagon siren head' },
        { k: 'cat', cat: 'rf-transceiver', params: { band: 'HB', antenna: 'stub' }, at: [9, 5], w: 20, h: 16 },
        { k: 'cat', cat: 'cell', params: { format: 'prismatic', cap: 2 }, at: [33, 6], w: 12, h: 14 },
        { k: 'cat', cat: 'rail-clamp', params: { w: 14 }, mount: 'face', at: [17, 16], w: 22, h: 10 },
      ],
      events: ['sings at 19 kHz when the cell runs low'],
    }),
  ];
}
