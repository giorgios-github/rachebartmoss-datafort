// js/techlab.js — the Techie's workshop: draw an enclosure, seat the guts, drop the
// ports and controls, read the budgets, ship the record. The drawing is a projection
// of the TechPart model (js/tech/*) — this file is only the editing gesture.
import * as G from './tech/geom.js';
import * as R from './tech/rules.js';
import * as M from './tech/model.js';
import { renderModule, standalone, placePorts, placePerimFeats, binThumb } from './tech/module.js';
import { defsBlock } from './tech/law.js';

const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'disabled') { if (v) e.setAttribute(k, ''); }
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const LS_KEY = 'bartmoss_techlab';

// ── state ──
const FRAME = { x: -16, y: -14, w: 178, h: 122 };   // drafting stage, mm
let K = 6;                                           // px per mm (responsive)
let part = null;
let view = { mode: 'section', density: 2, epistemic: 'resolved', dims: true };
let tool = { kind: 'select', sub: null };
let sel = null;                                      // {type:'port'|'gut'|'feat', i}
let sketch = [];                                     // outline draft (mm)
let hover = null;
let drag = null;                                     // {type,i,dx,dy}
let saveT = 0;

function store() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || { order: [], parts: {} }; } catch (e) { return { order: [], parts: {} }; } }
function setStore(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {} }
function autosave() { clearTimeout(saveT); saveT = setTimeout(() => { const s = store(); s.draft = M.toJSON(part); setStore(s); }, 400); }

// ── boot part ──
(function boot() {
  const s = store();
  if (s.draft) { try { part = M.fromJSON(s.draft); } catch (e) {} }
  if (!part) part = M.examples()[0];
})();

// ── stage ──
const stage = $('tk-stage');
function fitStage() {
  const wrap = $('tk-stage-wrap');
  K = Math.max(2.5, Math.min((wrap.clientWidth - 24) / FRAME.w, (wrap.clientHeight - 24) / FRAME.h));
  const w = Math.round(FRAME.w * K), h = Math.round(FRAME.h * K);
  stage.setAttribute('width', w); stage.setAttribute('height', h);
  stage.setAttribute('viewBox', `0 0 ${w} ${h}`);
}
function mmFromEvent(e) {
  const ctm = stage.getScreenCTM(); if (!ctm) return [0, 0];
  const p = stage.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const u = p.matrixTransform(ctm.inverse());
  return [u.x / K + FRAME.x, u.y / K + FRAME.y];
}
const mmToPx = (x, y) => [(x - FRAME.x) * K, (y - FRAME.y) * K];

function gridSvg() {
  let s = '';
  for (let x = Math.ceil(FRAME.x / 10) * 10; x < FRAME.x + FRAME.w; x += 10) {
    const [px] = mmToPx(x, 0);
    s += `<line x1="${px}" y1="0" x2="${px}" y2="${FRAME.h * K}" stroke="#ececec" stroke-width="${x % 50 === 0 ? 1 : 0.5}"/>`;
  }
  for (let y = Math.ceil(FRAME.y / 10) * 10; y < FRAME.y + FRAME.h; y += 10) {
    const [, py] = mmToPx(0, y);
    s += `<line x1="0" y1="${py}" x2="${FRAME.w * K}" y2="${py}" stroke="#ececec" stroke-width="${y % 50 === 0 ? 1 : 0.5}"/>`;
  }
  return `<g>${s}</g>`;
}
function overlaySvg() {
  let s = '';
  if (sketch.length) {
    const pts = (hover ? sketch.concat([hover]) : sketch).map(p => mmToPx(p[0], p[1]));
    s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="rgba(17,17,17,.04)" stroke="#111" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    sketch.forEach((p, i) => { const [x, y] = mmToPx(p[0], p[1]); s += `<circle cx="${x}" cy="${y}" r="${i === 0 ? 6 : 3.4}" fill="${i === 0 ? '#fff' : '#111'}" stroke="#111" stroke-width="1.6"/>`; });
  }
  if (sel && !sketch.length) {
    const acc = '#c0392b';
    if (sel.type === 'gut' && part.guts[sel.i]) {
      const g = part.guts[sel.i];
      const [x, y] = mmToPx(g.at[0], g.at[1]);
      s += `<rect x="${x - 3}" y="${y - 3}" width="${g.w * K + 6}" height="${g.h * K + 6}" fill="none" stroke="${acc}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    } else if (sel.type === 'port') {
      const pl = placePorts(part.outline, part.ports)[sel.i];
      if (pl) { const [x, y] = mmToPx(pl.x, pl.y); s += `<circle cx="${x}" cy="${y}" r="${(pl.spec.half + 3) * K}" fill="none" stroke="${acc}" stroke-width="1.4" stroke-dasharray="4 3"/>`; }
    } else if (sel.type === 'feat' && part.feats[sel.i]) {
      const f = part.feats[sel.i];
      if ((R.FEAT[f.k] || {}).perim) {
        const pf = placePerimFeats(part.outline, part.feats).find(q => q.i === sel.i);
        if (pf) { const [x, y] = mmToPx(pf.x, pf.y); s += `<circle cx="${x}" cy="${y}" r="${8 * K}" fill="none" stroke="${acc}" stroke-width="1.4" stroke-dasharray="4 3"/>`; }
      } else {
        const [x, y] = mmToPx(f.at[0], f.at[1]);
        const w = f.k === 'screen' ? (f.w || 16) : f.k === 'keypad' ? (f.cols || 3) * R.FEAT.keypad.pitch : 0;
        const h = f.k === 'screen' ? (f.h || 10) : f.k === 'keypad' ? (f.rows || 4) * R.FEAT.keypad.pitch : 0;
        if (w) s += `<rect x="${x - 3}" y="${y - 3}" width="${w * K + 6}" height="${h * K + 6}" fill="none" stroke="${acc}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
        else s += `<circle cx="${x}" cy="${y}" r="${6 * K}" fill="none" stroke="${acc}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
      }
    }
  }
  return `<g>${s}</g>`;
}
function render() {
  M.normalize(part);
  let figSvg;
  if (view.mode === 'exploded') {                       // exploded = presentation layout, view-only
    const fig = renderModule(part, { ...view, fitPx: Math.min(520, FRAME.w * K * 0.55) });
    const ox = (FRAME.w * K - fig.w) / 2, oy = Math.max(4, (FRAME.h * K - fig.h) / 2);
    figSvg = `<g transform="translate(${ox},${oy})">${fig.svg}</g>`;
  } else {
    figSvg = renderModule(part, { ...view, frame: FRAME, pxPerMm: K }).svg;
  }
  stage.innerHTML = defsBlock() + gridSvg() + figSvg + overlaySvg();
  renderSide();
  autosave();
}

// ── hit testing (mm) ──
function hitTest(x, y) {
  const pf = placePerimFeats(part.outline, part.feats);
  for (const f of pf) if (Math.hypot(f.x - x, f.y - y) < 8) return { type: 'feat', i: f.i };
  const pl = placePorts(part.outline, part.ports);
  for (let i = pl.length - 1; i >= 0; i--) { const p = pl[i]; if (Math.hypot(p.x + p.nx * 5 - x, p.y + p.ny * 5 - y) < p.spec.half + 5) return { type: 'port', i }; }
  for (let i = part.feats.length - 1; i >= 0; i--) {
    const f = part.feats[i];
    if ((R.FEAT[f.k] || {}).perim) continue;
    const w = f.k === 'screen' ? (f.w || 16) : f.k === 'keypad' ? (f.cols || 3) * R.FEAT.keypad.pitch : 5;
    const h = f.k === 'screen' ? (f.h || 10) : f.k === 'keypad' ? (f.rows || 4) * R.FEAT.keypad.pitch : 5;
    const cx = f.k === 'screen' || f.k === 'keypad' ? f.at[0] : f.at[0] - w / 2, cy = f.k === 'screen' || f.k === 'keypad' ? f.at[1] : f.at[1] - h / 2;
    if (x >= cx - 1 && x <= cx + w + 1 && y >= cy - 1 && y <= cy + h + 1) return { type: 'feat', i };
  }
  for (let i = part.guts.length - 1; i >= 0; i--) {
    const g = part.guts[i];
    if (x >= g.at[0] && x <= g.at[0] + g.w && y >= g.at[1] && y <= g.at[1] + g.h) return { type: 'gut', i };
  }
  return null;
}

// ── pointer ──
stage.addEventListener('mousedown', e => {
  const [x, y] = mmFromEvent(e);
  if (tool.kind !== 'select' || view.mode === 'exploded') return;
  const h = hitTest(x, y);
  sel = h;
  if (h) {
    if (h.type === 'gut') drag = { ...h, dx: part.guts[h.i].at[0] - x, dy: part.guts[h.i].at[1] - y };
    else if (h.type === 'feat' && !(R.FEAT[part.feats[h.i].k] || {}).perim) drag = { ...h, dx: part.feats[h.i].at[0] - x, dy: part.feats[h.i].at[1] - y };
    else drag = { ...h };                                // ports + perim feats slide along the edge
  }
  render();
});
stage.addEventListener('mousemove', e => {
  const [x, y] = mmFromEvent(e);
  hover = [x, y];
  if (drag) {
    if (drag.type === 'gut') { const g = part.guts[drag.i]; g.at = [Math.round((x + drag.dx) * 2) / 2, Math.round((y + drag.dy) * 2) / 2]; }
    else if (drag.type === 'port') { const P = G.perimeter(part.outline); part.ports[drag.i].t = G.closestS(part.outline, x, y) / P; }
    else if (drag.type === 'feat') {
      const f = part.feats[drag.i];
      if ((R.FEAT[f.k] || {}).perim) { const P = G.perimeter(part.outline); f.t = G.closestS(part.outline, x, y) / P; }
      else f.at = [Math.round((x + drag.dx) * 2) / 2, Math.round((y + drag.dy) * 2) / 2];
    }
    render(); return;
  }
  if (sketch.length) render();
});
window.addEventListener('mouseup', () => { if (drag) { drag = null; render(); } });
stage.addEventListener('click', e => {
  if (view.mode === 'exploded') return;
  const [x, y] = mmFromEvent(e);
  const P = G.perimeter(part.outline);
  if (tool.kind === 'outline') {
    if (sketch.length >= 3 && Math.hypot(x - sketch[0][0], y - sketch[0][1]) < 3.5) return commitSketch();
    sketch.push([Math.round(x), Math.round(y)]); render(); return;
  }
  if (tool.kind === 'port') { part.ports.push({ k: tool.sub, t: G.closestS(part.outline, x, y) / P }); sel = { type: 'port', i: part.ports.length - 1 }; setTool('select'); return; }
  if (tool.kind === 'feat') {
    const spec = R.FEAT[tool.sub];
    const f = { k: tool.sub };
    if (spec.perim) f.t = G.closestS(part.outline, x, y) / P;
    else if (tool.sub === 'screen' || tool.sub === 'keypad') f.at = [Math.round(x), Math.round(y)];
    else f.at = [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
    part.feats.push(f); M.normalize(part);
    sel = { type: 'feat', i: part.feats.length - 1 }; setTool('select'); return;
  }
  if (tool.kind === 'gut') {
    const d = R.GUT[tool.sub];
    part.guts.push({ k: tool.sub, at: [Math.round(x - d.w / 2), Math.round(y - d.h / 2)], w: d.w, h: d.h });
    sel = { type: 'gut', i: part.guts.length - 1 }; setTool('select'); return;
  }
});
stage.addEventListener('dblclick', e => { e.preventDefault(); if (tool.kind === 'outline' && sketch.length >= 3) commitSketch(); });
window.addEventListener('keydown', e => {
  const ae = document.activeElement;
  if (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) return;
  if (e.key === 'Escape') { sketch = []; sel = null; setTool('select'); return; }
  if (e.key === 'Enter' && tool.kind === 'outline' && sketch.length >= 3) return commitSketch();
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
    if (sel.type === 'port') part.ports.splice(sel.i, 1);
    else if (sel.type === 'gut') part.guts.splice(sel.i, 1);
    else if (sel.type === 'feat') part.feats.splice(sel.i, 1);
    sel = null; render();
  }
});
function commitSketch() {
  part.outline = sketch.slice();
  sketch = []; setTool('select'); render();
}
function stockOutline(kind) {
  const cx = FRAME.x + FRAME.w / 2, cy = FRAME.y + FRAME.h / 2;
  let o;
  if (kind === 'rrect') o = G.roundedRect(48, 30, 3);
  else if (kind === 'chamfer') o = G.chamferRect(46, 26, 4);
  else if (kind === 'pill') o = G.pill(42, 18);
  else o = G.blob(56, 38, G.shash(part.id) % 97);
  const bb = G.bbox(o);
  part.outline = G.translate(o, cx - bb.x - bb.w / 2, cy - bb.y - bb.h / 2);
  sketch = []; render();
}

// ── toolbar (left) ──
function setTool(kind, sub = null) { tool = { kind, sub }; renderTools(); hint(); }
function hint() {
  const h = $('tk-hint');
  const msgs = {
    select: 'click = select · drag = move (guts, controls; ports slide the edge) · Del = remove',
    outline: 'click = vertex · click 1st / Enter = close · Esc = cancel',
    port: `click the edge → drop a ${tool.sub || ''} port (snaps to a flat seat)`,
    gut: `click inside → seat a ${tool.sub || ''}`,
    feat: `click ${R.FEAT[tool.sub]?.perim ? 'the edge' : 'the lid'} → mount a ${tool.sub || ''}`,
  };
  h.textContent = view.mode === 'exploded' ? 'exploded view is read-only — switch to exterior/section to edit' : (msgs[tool.kind] || '');
}
function renderTools() {
  const t = $('tk-tools');
  t.innerHTML = '';
  const btn = (label, on, cb, title) => el('button', { class: 'tk-tool' + (on ? ' on' : ''), onclick: cb, ...(title ? { title } : {}) }, label);
  t.append(el('div', { class: 'tk-sect' }, 'tool'));
  t.append(btn('select / move', tool.kind === 'select', () => setTool('select')));
  t.append(el('div', { class: 'tk-sect' }, 'shell'));
  t.append(btn('draw outline', tool.kind === 'outline', () => { sketch = []; setTool('outline'); }));
  t.append(btn('▭ rounded box', false, () => stockOutline('rrect')));
  t.append(btn('◇ chamfer box', false, () => stockOutline('chamfer')));
  t.append(btn('⬭ pill', false, () => stockOutline('pill')));
  t.append(btn('~ organic', false, () => stockOutline('blob')));
  // parts BINS — trays you grab drawn parts from, not word-lists
  const bin = (title, cat, kinds, toolKind) => {
    t.append(el('div', { class: 'tk-sect' }, title));
    const tray = el('div', { class: 'tk-bin' });
    for (const k of kinds) {
      const cell = el('button', { class: 'tk-cell' + (tool.kind === toolKind && tool.sub === k ? ' on' : ''), title: k, onclick: () => setTool(toolKind, k) });
      cell.innerHTML = binThumb(cat, k, 42) + `<span>${k}</span>`;
      tray.append(cell);
    }
    t.append(tray);
  };
  bin('bin · ports', 'port', M.PORT_KINDS, 'port');
  bin('bin · controls', 'feat', M.FEAT_KINDS, 'feat');
  bin('bin · guts', 'gut', M.GUT_KINDS, 'gut');
}

// ── header (view controls + exports) ──
function renderBar() {
  const vm = $('tk-viewmode'); vm.innerHTML = '';
  vm.append(el('span', { class: 'tk-lab' }, 'view'));
  for (const m of ['exterior', 'section', 'exploded'])
    vm.append(el('button', { class: 'tk-btn' + (view.mode === m ? ' on' : ''), onclick: () => { view.mode = m; renderBar(); hint(); render(); } }, m));
  const vo = $('tk-viewopts'); vo.innerHTML = '';
  vo.append(el('span', { class: 'tk-lab' }, 'ink'));
  for (const d of [1, 2, 3])
    vo.append(el('button', { class: 'tk-btn' + (view.density === d ? ' on' : ''), onclick: () => { view.density = d; renderBar(); render(); } }, String(d)));
  vo.append(el('span', { class: 'tk-lab' }, 'know'));
  vo.append(el('button', { class: 'tk-btn' + (view.epistemic === 'ghosted' ? ' on' : ''), title: 'what an outside observer sees: internals unverified', onclick: () => { view.epistemic = view.epistemic === 'ghosted' ? 'resolved' : 'ghosted'; renderBar(); render(); } }, 'ghosted'));
  vo.append(el('button', { class: 'tk-btn' + (view.dims ? ' on' : ''), onclick: () => { view.dims = !view.dims; renderBar(); render(); } }, 'dims'));
  const ex = $('tk-exports'); ex.innerHTML = '';
  ex.append(el('button', { class: 'tk-btn', onclick: exportSvg }, 'export svg'));
}
function exportSvg() {
  const fig = renderModule(part, { ...view, frame: null, fitPx: 900, density: 3 });
  const blobU = new Blob([standalone(fig)], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blobU);
  a.download = `${(part.id || 'module').replace(/[^a-z0-9-]/gi, '_')}-${view.mode}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ── side panel ──
function renderSide() {
  const s = $('tk-side'); s.innerHTML = '';
  // fiche — the thumb IS the object
  const thumb = renderModule(part, { mode: 'exterior', lod: 'thumb', density: 2, fitPx: 250 });
  const B = M.budgets(part);
  const fiche = el('div', { class: 'tk-fiche' });
  fiche.innerHTML = `<svg viewBox="0 0 ${thumb.w} ${thumb.h}" style="background:#fff">${defsBlock()}${thumb.svg}</svg>` +
    `<div class="tk-fiche-cap"><b>${escph(part.label)}</b> · ${part.origin}${part.sealed ? ' · SEALED' : ''}<br>` +
    `T${B.tier} · wall ${B.wall} · ${escph(thumb.meta.mat)}<br>${escph(part.id)}</div>`;
  s.append(fiche);

  // identity
  s.append(el('h3', { class: 'tk-h' }, 'module'));
  s.append(field('label', el('input', { type: 'text', value: part.label, oninput: e => { part.label = e.target.value; autosave(); } })));
  const orig = el('select', { onchange: e => { part.origin = e.target.value; render(); } });
  for (const o of M.ORIGINS) orig.append(el('option', { value: o, ...(o === part.origin ? { selected: '' } : {}) }, o.toLowerCase()));
  s.append(field('origin', orig));
  const sealedRow = el('div', { class: 'tk-field' });
  sealedRow.append(el('label', {}, 'sealed'), el('input', { type: 'checkbox', checked: part.sealed, onchange: e => { part.sealed = e.target.checked; render(); } }),
    el('span', { style: 'font-size:10px;color:var(--text2)' }, 'potted (build state, not origin)'));
  s.append(sealedRow);
  s.append(field('heat', el('input', { type: 'number', min: '0', max: '9', value: part.heat, oninput: e => { part.heat = Math.max(0, +e.target.value || 0); render(); } })));
  s.append(field('screws', el('input', { type: 'number', min: '0', max: '12', value: part.fmax || 0, title: '0 = rule decides', oninput: e => { part.fmax = Math.max(0, +e.target.value || 0); render(); } })));

  // budgets
  const chips = el('div', { class: 'tk-budgets' });
  chips.append(chip(`${B.massG} g`), chip(`space ${B.spacePct}%`, B.spacePct > 100),
    chip(`pwr ${B.draw}/${B.supply}`, !B.powerOk), chip(`vents ${thumb.meta.vents}/${B.ventNeed}`, B.ventNeed > thumb.meta.vents), chip(`DC ${B.dc}`));
  s.append(chips);

  // contents
  s.append(el('h3', { class: 'tk-h' }, `contents · ${B.nParts} parts`));
  const wires = M.autoWires(part);
  const list = el('div', { class: 'tk-list' });
  part.ports.forEach((p, i) => list.append(row('port', `${p.k} @ ${Math.round(p.t * 100)}%`, sel?.type === 'port' && sel.i === i,
    () => { sel = { type: 'port', i }; render(); }, () => { part.ports.splice(i, 1); sel = null; render(); })));
  part.feats.forEach((f, i) => list.append(row('ctrl', f.k, sel?.type === 'feat' && sel.i === i,
    () => { sel = { type: 'feat', i }; render(); }, () => { part.feats.splice(i, 1); sel = null; render(); })));
  part.guts.forEach((g, i) => {
    const r = row('gut', '', sel?.type === 'gut' && sel.i === i, () => { sel = { type: 'gut', i }; render(); }, () => { part.guts.splice(i, 1); sel = null; render(); });
    r.insertBefore(el('span', {}, g.k), r.querySelector('.tk-x'));
    const wIn = el('input', { type: 'number', min: '3', value: g.w, oninput: e => { g.w = Math.max(3, +e.target.value || g.w); render(); } });
    const hIn = el('input', { type: 'number', min: '3', value: g.h, oninput: e => { g.h = Math.max(3, +e.target.value || g.h); render(); } });
    r.insertBefore(wIn, r.querySelector('.tk-x')); r.insertBefore(el('span', { style: 'font-size:10px' }, '×'), r.querySelector('.tk-x')); r.insertBefore(hIn, r.querySelector('.tk-x'));
    list.append(r);
  });
  s.append(list);
  s.append(el('div', { style: 'font-size:10px;color:var(--text2);margin-bottom:4px' }, `auto-loom · ${wires.length} leads (visible in section)`));

  // library
  s.append(el('h3', { class: 'tk-h' }, 'library'));
  const st = store();
  const libSel = el('select', { style: 'width:100%;font-family:var(--mono);font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);padding:3px' });
  libSel.append(el('option', { value: '' }, '— saved modules —'));
  for (const id of st.order) { try { const pj = JSON.parse(st.parts[id]); libSel.append(el('option', { value: id }, `${pj.label} (${id})`)); } catch (e) {} }
  libSel.addEventListener('change', () => { if (!libSel.value) return; try { part = M.fromJSON(st.parts[libSel.value]); sel = null; render(); } catch (e) {} });
  s.append(libSel);
  const libBtns = el('div', { style: 'display:flex;gap:4px;margin:5px 0 2px;flex-wrap:wrap' });
  libBtns.append(
    el('button', { class: 'tk-btn', onclick: () => { const st2 = store(); st2.parts[part.id] = M.toJSON(part); if (!st2.order.includes(part.id)) st2.order.push(part.id); setStore(st2); renderSide(); } }, 'save'),
    el('button', { class: 'tk-btn', onclick: () => { part = M.newPart(); sel = null; render(); } }, 'new'),
    el('button', { class: 'tk-btn', onclick: () => { part = M.fromJSON(M.toJSON(part)); part.id = M.newId('mod'); sel = null; render(); } }, 'dup'),
    el('button', { class: 'tk-btn', onclick: () => { const st2 = store(); delete st2.parts[part.id]; st2.order = st2.order.filter(x => x !== part.id); setStore(st2); renderSide(); } }, 'del'),
  );
  const exBtn = el('select', { style: 'font-family:var(--mono);font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);padding:3px' });
  exBtn.append(el('option', { value: '' }, 'examples…'));
  M.examples().forEach((ex2, i) => exBtn.append(el('option', { value: String(i) }, ex2.label.toLowerCase())));
  exBtn.addEventListener('change', () => { if (exBtn.value === '') return; part = M.examples()[+exBtn.value]; sel = null; render(); });
  libBtns.append(exBtn);
  s.append(libBtns);

  // the record — one line of data IS the object
  s.append(el('h3', { class: 'tk-h' }, 'record (one line)'));
  const ta = el('textarea', { class: 'tk-json', rows: '4', spellcheck: 'false' });
  ta.value = M.toJSON(part);
  s.append(ta);
  const jb = el('div', { style: 'display:flex;gap:4px;margin-top:4px' });
  jb.append(
    el('button', { class: 'tk-btn', onclick: () => { ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); } } }, 'copy'),
    el('button', { class: 'tk-btn', onclick: () => { try { part = M.fromJSON(ta.value); sel = null; render(); } catch (e) { ta.style.borderColor = 'var(--red)'; setTimeout(() => ta.style.borderColor = '', 900); } } }, 'import'),
  );
  s.append(jb);
}
function field(label, input) { const d = el('div', { class: 'tk-field' }); d.append(el('label', {}, label), input); return d; }
function chip(text, bad) { return el('span', { class: 'tk-chip' + (bad ? ' bad' : '') }, text); }
function row(kind, text, isSel, onSel, onDel) {
  const r = el('div', { class: 'tk-row' + (isSel ? ' sel' : ''), onclick: onSel });
  r.append(el('span', { class: 'tk-kind' }, kind), el('span', {}, text));
  r.append(el('button', { class: 'tk-x', onclick: e => { e.stopPropagation(); onDel(); } }, '✕'));
  return r;
}
function escph(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

// ── go ──
window.addEventListener('resize', () => { fitStage(); render(); });
fitStage(); renderTools(); renderBar(); hint(); render();
