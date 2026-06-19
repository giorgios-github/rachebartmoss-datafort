/* onboarding.js — GM-authored character-creation onboarding shown as a smart
   wizard around the Character Sheet.

   The GM, while editing a campaign sheet (cs.html?cdoc=1, or a live ?as=gm
   column), authors ordered STEPS; the data lives on window.CS.onboarding so it
   travels with the sheet (cs-join publish / campaign-doc PUT / hub disk) and is
   backward compatible (absent on old sheets). A player who opens the shared
   sheet (cs.html?campaign&sheet, no as=gm) sees a docked step-by-step panel:
   each step can reference sheet fields with {{tokens}} that scroll-to + spotlight
   the field. Player progress is kept in localStorage (no sync churn).

   Token grammar:  {{ref:<id>}} {{stat:<CODE>}} {{skill:<Name>}} {{sec:<name>}}
   Public API: window.CSOnboarding.{ boot, afterApply, spotlight, resolveTarget } */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var asGm = q.get('as') === 'gm';
  // Standalone = the plain site / localhost CS (no hub): a GM can author here and
  // share via sheet template / exported JSON; a player who loads one sees the wizard.
  function isStandalone() { return !window.__csJoined && !window.__cdoc; }
  // On the plain site the author chip is opt-in (Sheet settings → "Author onboarding"),
  // so a solo player isn't shown a GM tool. In hub GM contexts it's always available.
  function isAuthor() {
    if (window.__cdoc || (window.__csJoined && asGm)) return true;
    if (isStandalone()) { var cs = CSo(); return !!(cs && cs.settings && cs.settings.onbAuthor); }
    return false;
  }
  function isDisplay() {
    if (window.__csJoined && !asGm && !window.__cdoc) return true;          // hub player
    if (isStandalone()) { var o = ob(); return !!(o && o.enabled && o.steps && o.steps.length); }  // site: only when the sheet carries onboarding
    return false;
  }
  function esc(s) {
    if (typeof window._esc === 'function') return window._esc(s);
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function CSo() { return window.CS || null; }
  function ob() { var cs = CSo(); return cs && cs.onboarding && typeof cs.onboarding === 'object' ? cs.onboarding : null; }
  function obEnsure() {
    var cs = CSo(); if (!cs) return null;
    if (!cs.onboarding || typeof cs.onboarding !== 'object') cs.onboarding = { enabled: true, title: 'Build your character', steps: [] };
    if (!Array.isArray(cs.onboarding.steps)) cs.onboarding.steps = [];
    return cs.onboarding;
  }
  function uid() { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function persist() {
    if (typeof window.collectState === 'function') { try { window.collectState(); } catch (e) {} }
    if (typeof window._csPersist === 'function') { try { window._csPersist(); } catch (e) {} }
  }

  /* ─────────── Reference resolver (shared author + display) ─────────── */
  // Heading-like elements used as section sub-titles across the sheet.
  var SUBHEAD_SEL = 'h3,h4,h5,legend,.ls-q-head,.ls-sub-head,.ls-acc-sub-head,.ls-housing-head,.ls-bank-head,.ls-loan-card-head,.ls-fin-side-head,.fashion-head,.cyber-options-head,.lp-group-head,.net-sub,.ov-section-title,.cs-subhead';
  // A compact CSS path from el up to (but excluding) root, using nth-of-type so it
  // resolves the same element across re-renders — used to point at fields with no id.
  function cssPathWithin(el, root) {
    var parts = [];
    while (el && el !== root && el.nodeType === 1 && el.parentNode) {
      var p = el.parentNode;
      var sibs = Array.prototype.filter.call(p.children, function (c) { return c.tagName === el.tagName; });
      parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')');
      el = p;
    }
    return parts.join('>');
  }
  // A friendly label for an arbitrary field (placeholder / its <label> / nearby text).
  function fieldLabel(el) {
    var s = el.getAttribute && (el.getAttribute('placeholder') || '');
    if (!s && el.id) { var lab = document.querySelector('label[for="' + el.id + '"]'); if (lab) s = headingLabel(lab); }
    if (!s) { var l = el.closest && el.closest('label'); if (l) s = headingLabel(l); }
    if (!s && el.getAttribute) s = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    if (!s) { var prev = el.previousElementSibling; if (prev) s = (prev.textContent || '').replace(/\s+/g, ' ').trim(); }
    s = (s || (el.tagName || 'field').toLowerCase()).replace(/\s+/g, ' ').trim();
    return s.length > 40 ? s.slice(0, 40) : s;
  }
  // Build a resolvable token for any clicked element (id → ref; heading → sub; else pick path).
  function tokenForElement(node) {
    var ctrl = (node.closest && node.closest('input,select,textarea,button')) || node;
    if (ctrl.id) return 'ref:' + ctrl.id;
    var secEl = node.closest && node.closest('.cs-section');
    var name = secEl ? secEl.id.replace(/^sec-/, '') : '';
    var hd = node.closest && node.closest(SUBHEAD_SEL);
    if (hd && secEl) { var hl = headingLabel(hd); if (hl) return 'sub:' + name + ':' + hl; }
    return 'pick:' + name + '::' + cssPathWithin(ctrl, secEl || document) + '::' + fieldLabel(ctrl);
  }
  // The heading's own label only — strip nested controls (buttons/inputs/toggles)
  // and leading UI glyphs (▾ ▸ ⚄ +) so a ref reads "Life Events", not the whole widget.
  function headingLabel(hd) {
    var c = hd.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('button,input,select,textarea,svg,a,.toggle,.lp-roll,.lp-add'), function (n) { n.parentNode.removeChild(n); });
    return (c.textContent || '').replace(/\s+/g, ' ').replace(/^[\s▾▸▴▿►◄◆◎⚄+\-–—·•|]+/, '').replace(/[\s|+]+$/, '').trim();
  }
  function resolveTarget(token) {
    var m = /^(\w+):([\s\S]+)$/.exec((token || '').trim()); if (!m) return null;
    var kind = m[1], arg = m[2].trim(), el = null;
    if (kind === 'ref') el = document.getElementById(arg);
    else if (kind === 'sec') el = document.getElementById('sec-' + arg);
    else if (kind === 'stat') el = document.querySelector('#stats-grid input[data-stat="' + arg.replace(/[^A-Za-z]/g, '') + '"]');
    else if (kind === 'skill') {
      var ns = document.querySelectorAll('#skills-list .sk-name');
      for (var i = 0; i < ns.length; i++) {
        var t = (ns[i].getAttribute('title') || ns[i].textContent || '').split(' (')[0].trim();
        if (t === arg) { el = ns[i].closest('.skill-row'); break; }
      }
    } else if (kind === 'sub') {
      // sub:<sectionName>:<heading text> — find a sub-title by text within the section.
      var ci = arg.indexOf(':'); if (ci < 0) return null;
      var sec = document.getElementById('sec-' + arg.slice(0, ci).trim()), label = arg.slice(ci + 1).trim();
      if (sec) {
        var hs = sec.querySelectorAll(SUBHEAD_SEL);
        for (var j = 0; j < hs.length; j++) { var ht = headingLabel(hs[j]); if (ht === label || (label && ht.indexOf(label) === 0)) { el = hs[j]; break; } }
      }
    } else if (kind === 'pick') {
      // pick:<sectionName>::<cssPath>::<label> — points at an arbitrary field.
      // Resolve robustly: exact path → match by field label within the section →
      // degrade to the section itself (so the chip never dies as a dead red link).
      var seg = arg.split('::'), sname = seg[0], path = seg[1], label = seg[2];
      var root = sname ? document.getElementById('sec-' + sname) : null; root = root || document;
      if (path) { try { el = root.querySelector(':scope>' + path) || root.querySelector(path); } catch (e3) { el = null; } }
      if (!el && label) {
        var cand = root.querySelectorAll('input,select,textarea');
        for (var pi = 0; pi < cand.length; pi++) { if (fieldLabel(cand[pi]) === label) { el = cand[pi]; break; } }
      }
      if (!el && sname) el = document.getElementById('sec-' + sname);
    }
    return el ? { el: el, kind: kind, arg: arg } : null;
  }
  function clearSpots() { Array.prototype.forEach.call(document.querySelectorAll('.onb-spot'), function (e) { e.classList.remove('onb-spot'); }); }
  // Highlight one target. keep=true leaves earlier highlights in place (multi-spotlight).
  function spotlightOne(token, keep) {
    var t = resolveTarget(token); if (!t) return null;
    var sec = t.el.closest('.cs-section');
    if (sec && sec.classList.contains('collapsed')) { var h = sec.querySelector('.cs-section-head'); if (h && typeof window.toggleSec === 'function') window.toggleSec(h); }
    if (!keep) clearSpots();
    var hl = t.el;   // whole section for sec: targets, the element itself otherwise
    hl.classList.add('onb-spot');
    setTimeout(function () { hl.classList.remove('onb-spot'); }, 2600);
    return t.el;
  }
  function scrollTo(el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} } }
  function spotlight(token) { var el = spotlightOne(token, false); if (el) scrollTo(el); return !!el; }
  function spotlightTargets(tokens) {
    if (!tokens || !tokens.length) return;
    clearSpots(); var first = null;
    tokens.forEach(function (tok) { var el = spotlightOne(tok, true); if (el && !first) first = el; });
    if (first) scrollTo(first);
  }
  function targetList(s) { var t = s && s.target; if (!t) return []; return (Array.isArray(t) ? t : [t]).filter(Boolean); }
  var REF_LABELS = { 'cs-name': 'Name', 'cs-handle': 'Handle', 'cs-role': 'Role', 'cs-age': 'Age', 'cs-reputation': 'Reputation', 'cs-notes': 'Notes', 'skill-points': 'Skill points', 'ip-points': 'IP', 'cyber-hc-total': 'Humanity cost', 'wound-count': 'Health' };
  function prettyLabel(token) {
    var m = /^(\w+):([\s\S]+)$/.exec((token || '').trim()); if (!m) return token;
    var k = m[1], a = m[2].trim();
    if (k === 'ref') return REF_LABELS[a] || a;
    if (k === 'sec') return a.charAt(0).toUpperCase() + a.slice(1);
    if (k === 'sub') { var ci = a.indexOf(':'); return ci >= 0 ? a.slice(ci + 1).trim() : a; }
    if (k === 'pick') { var sg = a.split('::'); return sg[2] || sg[0] || a; }
    return a;
  }
  function renderBody(text) {
    return esc(text || '').replace(/\n/g, '<br>').replace(/\{\{([^}]+)\}\}/g, function (_m, tok) {
      tok = tok.trim(); var ok = !!resolveTarget(tok);
      return '<span class="onb-chip' + (ok ? '' : ' onb-chip-bad') + '" data-tok="' + esc(tok) + '">' + esc(prettyLabel(tok)) + '</span>';
    });
  }

  /* ─────────── Conditional steps (show a step only if a field is filled a certain way) ─────────── */
  // step.when = { token, op, val }. token is a field token (ref/stat/skill);
  // op ∈ filled | empty | eq | neq | contains | gte | lte. Evaluated live.
  function fieldValue(token) {
    var t = resolveTarget(token); if (!t) return '';
    var el = t.el;
    if (t.kind === 'skill') { var v = el.querySelector('.sk-val'); return v ? (v.value || '') : (el.textContent || ''); }
    if ('value' in el && el.value != null && el.tagName !== 'DIV') return el.value;
    return (el.textContent || '');
  }
  // when = { mode:'all'|'any', conds:[{token,op,val}] }  (legacy: {token,op,val}).
  function whenList(when) {
    if (!when) return [];
    if (Array.isArray(when.conds)) return when.conds.filter(function (c) { return c && c.token; });
    if (when.token) return [{ token: when.token, op: when.op, val: when.val }];
    return [];
  }
  function whenMode(when) { return when && when.mode === 'any' ? 'any' : 'all'; }
  // Unfiltered conditions (incl. blank rows) — for the author editor display.
  function whenListRaw(when) {
    if (!when) return [];
    if (Array.isArray(when.conds)) return when.conds;
    if (when.token) return [{ token: when.token, op: when.op, val: when.val }];
    return [];
  }
  function condOne(c) {
    if (!c || !c.token) return true;
    var raw = String(fieldValue(c.token)), v = raw.trim().toLowerCase();
    var cmp = String(c.val == null ? '' : c.val).trim().toLowerCase();
    switch (c.op) {
      case 'empty': return v === '' || v === '0';
      case 'eq': return v === cmp;
      case 'neq': return v !== cmp;
      case 'contains': return cmp !== '' && v.indexOf(cmp) >= 0;
      case 'gte': return parseFloat(raw) >= parseFloat(c.val);
      case 'lte': return parseFloat(raw) <= parseFloat(c.val);
      case 'filled': default: return v !== '' && v !== '0';
    }
  }
  function condMet(when) {
    var L = whenList(when); if (!L.length) return true;
    return whenMode(when) === 'any' ? L.some(condOne) : L.every(condOne);
  }
  // Steps the player should actually see right now (conditions resolved live).
  function visSteps() { var o = ob(); return o && o.steps ? o.steps.filter(function (s) { return condMet(s.when); }) : []; }
  var COND_OPS = [['filled', 'is filled'], ['empty', 'is empty'], ['eq', 'is'], ['neq', 'is not'], ['contains', 'contains'], ['gte', '≥'], ['lte', '≤']];

  /* ─────────── Anchor catalog (author target/insert pickers) ─────────── */
  // Built live from the sheet DOM so EVERY section, sub-title and key field is
  // referenceable (incl. custom content), not a hand-maintained list.
  function anchorGroups() {
    var g = [
      { grp: 'Identity fields', items: [['ref:cs-name', 'Name'], ['ref:cs-handle', 'Handle'], ['ref:cs-role', 'Role'], ['ref:cs-age', 'Age'], ['ref:cs-reputation', 'Reputation']] },
      { grp: 'Stats', items: ['INT', 'REF', 'TECH', 'COOL', 'ATT', 'LUCK', 'MA', 'BODY', 'EMP'].map(function (c) { return ['stat:' + c, c]; }) },
      { grp: 'Budgets / totals', items: [['ref:skill-points', 'Skill points'], ['ref:ip-points', 'IP'], ['ref:cyber-hc-total', 'Humanity cost'], ['ref:wound-count', 'Health']] },
    ];
    // Sections + their sub-titles, scanned from the live sheet.
    var secItems = [], subItems = [], seen = {};
    Array.prototype.forEach.call(document.querySelectorAll('.cs-section[id^="sec-"]'), function (sec) {
      var name = sec.id.replace(/^sec-/, '');
      var h2 = sec.querySelector('.cs-section-head h2'); var title = (h2 ? h2.textContent : name).trim();
      secItems.push(['sec:' + name, title]);
      Array.prototype.forEach.call(sec.querySelectorAll(SUBHEAD_SEL), function (hd) {
        var t = headingLabel(hd);
        if (!t || t.length > 44) return;
        var tok = 'sub:' + name + ':' + t; if (seen[tok]) return; seen[tok] = 1;
        subItems.push([tok, title + ' › ' + t]);
      });
    });
    if (secItems.length) g.push({ grp: 'Sections', items: secItems });
    if (subItems.length) g.push({ grp: 'Sub-sections', items: subItems });
    var sk = [];
    Array.prototype.forEach.call(document.querySelectorAll('#skills-list .sk-name'), function (n) {
      var t = (n.getAttribute('title') || '').split(' (')[0].trim(); if (t) sk.push(['skill:' + t, t]);
    });
    if (sk.length) g.push({ grp: 'Skills', items: sk });
    return g;
  }
  function targetSelectHtml(name, cur) {
    var html = '<select ' + name + '><option value="">— none —</option>';
    anchorGroups().forEach(function (grp) {
      html += '<optgroup label="' + esc(grp.grp) + '">';
      grp.items.forEach(function (it) { html += '<option value="' + esc(it[0]) + '"' + (cur === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>'; });
      html += '</optgroup>';
    });
    return html + '</select>';
  }

  /* ─────────── AUTHOR: chip in the Identity header + modal editor ─────────── */
  function authorChip() {
    var sec = document.getElementById('sec-identity'); if (!sec) return;
    var head = sec.querySelector('.cs-section-head'); if (!head) return;
    if (head.querySelector('.onb-edit-chip')) return;
    var chip = document.createElement('span');
    chip.className = 'onb-edit-chip'; chip.title = 'Character-creation onboarding';
    chip.textContent = '✎';
    chip.setAttribute('onclick', 'event.stopPropagation();CSOnboarding._edit();');
    var toggle = head.querySelector('.toggle');
    if (toggle) head.insertBefore(chip, toggle); else head.appendChild(chip);
  }
  function removeAuthorChip() { var c = document.querySelector('.onb-edit-chip'); if (c) c.parentNode.removeChild(c); }
  function syncAuthorChip() { if (isAuthor()) authorChip(); else { removeAuthorChip(); closeEditor(); } }
  // Spotlight = one or more targets highlighted when the step opens.
  function spotBlockHtml(i, s) {
    var ts = targetList(s); if (!ts.length) ts = [''];
    var rows = ts.map(function (tok, ti) {
      return '<div class="onb-ed-spotrow">' + targetSelectHtml('data-target="' + i + '_' + ti + '"', tok) +
        '<button class="onb-ed-mini onb-ed-del" data-tdel="' + i + '_' + ti + '" title="Remove">✕</button></div>';
    }).join('');
    return '<div class="onb-ed-spots" data-spots="' + i + '">' +
      '<div class="onb-ed-blockhdr"><span class="onb-ed-condlbl">Spotlight on open</span>' +
        '<button class="onb-ed-mini" data-taddspot="' + i + '">+ field</button></div>' +
      rows + '</div>';
  }
  // Conditions = compound show-only-if (match all / any).
  function condBlockHtml(i, s) {
    var L = whenListRaw(s.when); var mode = whenMode(s.when);
    var rows = (L.length ? L : [{}]).map(function (c, ci) {
      var ops = COND_OPS.map(function (o) { return '<option value="' + o[0] + '"' + (c.op === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
      return '<div class="onb-ed-cond">' + targetSelectHtml('data-ctoken="' + i + '_' + ci + '"', c.token || '') +
        '<select data-cop="' + i + '_' + ci + '">' + ops + '</select>' +
        '<input data-cval="' + i + '_' + ci + '" value="' + esc(c.val || '') + '" placeholder="value">' +
        '<button class="onb-ed-mini onb-ed-del" data-cdel="' + i + '_' + ci + '" title="Remove">✕</button></div>';
    }).join('');
    var modeSel = '<select class="onb-ed-cmode" data-cmode="' + i + '"><option value="all"' + (mode === 'all' ? ' selected' : '') + '>match all</option><option value="any"' + (mode === 'any' ? ' selected' : '') + '>match any</option></select>';
    return '<div class="onb-ed-conds" data-conds="' + i + '">' +
      '<div class="onb-ed-blockhdr"><span class="onb-ed-condlbl">Show only if</span>' + (L.length > 1 ? modeSel : '') +
        '<button class="onb-ed-mini" data-caddcond="' + i + '">+ condition</button></div>' +
      rows + '</div>';
  }
  function editorHtml() {
    var o = obEnsure();
    var steps = o.steps.map(function (s, i) {
      return '<div class="onb-ed-step" data-i="' + i + '">' +
        '<div class="onb-ed-row"><span class="onb-ed-n">' + (i + 1) + '</span>' +
          '<input class="onb-ed-title" data-i="' + i + '" value="' + esc(s.title || '') + '" placeholder="Step title">' +
          '<button class="onb-ed-mini" data-up="' + i + '">▲</button><button class="onb-ed-mini" data-dn="' + i + '">▼</button>' +
          '<button class="onb-ed-mini onb-ed-del" data-del="' + i + '">✕</button></div>' +
        '<textarea class="onb-ed-body" data-i="' + i + '" rows="3" placeholder="Instruction… insert field references below">' + esc(s.body || '') + '</textarea>' +
        '<div class="onb-ed-row2"><label>Insert ref ' + targetSelectHtml('data-ins="' + i + '"', '') + '</label>' +
          '<button class="onb-ed-mini onb-ed-pick" data-pick="' + i + '" title="Click a field on the sheet to insert it inline">⊹ Pick on sheet</button></div>' +
        spotBlockHtml(i, s) +
        condBlockHtml(i, s) +
        '</div>';
    }).join('') || '<div class="onb-ed-empty">No steps yet. Add the first creation step.</div>';
    return '<div class="onb-ed">' +
      '<label class="onb-ed-en"><input type="checkbox" id="onb-ed-enabled"' + (o.enabled ? ' checked' : '') + '> Show this onboarding to the player</label>' +
      '<input class="onb-ed-maintitle" id="onb-ed-title" value="' + esc(o.title || '') + '" placeholder="Panel title (e.g. Build your character)">' +
      '<div class="onb-ed-steps">' + steps + '</div>' +
      '<button class="onb-ed-add" id="onb-ed-add">+ Add step</button>' +
      '<div class="onb-ed-hint">References jump to & highlight the field on the player\'s sheet. “Spotlight” is the field shown when the step opens.</div>' +
      '</div>';
  }
  // Docked, NON-blocking side panel (not a modal) so the GM can scroll/explore
  // the sheet while authoring and pick which fields to reference.
  function editorEl() { return document.getElementById('onb-editor'); }
  function closeEditor() { var p = editorEl(); if (p) p.parentNode.removeChild(p); if (!isDisplay()) removePanel(); }
  function openEditor() {
    if (editorEl()) { closeEditor(); return; }   // ✎ toggles the panel
    var p = document.createElement('div'); p.id = 'onb-editor'; p.className = 'onb-editor';
    document.body.appendChild(p);
    renderEditor();
  }
  function renderEditor() {
    var p = editorEl(); if (!p) return;
    p.innerHTML =
      '<div class="onb-ed-head"><span class="onb-ed-htitle">Onboarding — author</span>' +
        '<button class="onb-ed-prev" id="onb-ed-prev" title="Preview the player wizard">' + (panelEl() ? '◉ Preview on' : '◎ Preview') + '</button>' +
        '<button class="onb-ed-x" id="onb-ed-x" title="Close">✕</button></div>' +
      '<div class="onb-ed-scroll" id="onb-ed-scroll">' + editorHtml() + '</div>';
    var x = document.getElementById('onb-ed-x'); if (x) x.onclick = closeEditor;
    var pv = document.getElementById('onb-ed-prev'); if (pv) pv.onclick = togglePreview;
    wireEditor();
  }
  function wireEditor() {
    var o = obEnsure();
    var en = document.getElementById('onb-ed-enabled'); if (en) en.onchange = function () { o.enabled = en.checked; persist(); };
    var ti = document.getElementById('onb-ed-title'); if (ti) ti.onchange = function () { o.title = ti.value; persist(); };
    var add = document.getElementById('onb-ed-add'); if (add) add.onclick = function () { o.steps.push({ id: uid(), title: '', body: '', target: '' }); persist(); renderEditor(); };
    var body = document.getElementById('onb-ed-scroll'); if (!body) return;
    body.querySelectorAll('.onb-ed-title').forEach(function (inp) { inp.onchange = function () { o.steps[+inp.getAttribute('data-i')].title = inp.value; persist(); }; });
    body.querySelectorAll('.onb-ed-body').forEach(function (ta) { ta.onchange = function () { o.steps[+ta.getAttribute('data-i')].body = ta.value; persist(); }; });
    // Insert reference at cursor.
    body.querySelectorAll('[data-ins]').forEach(function (sel) {
      sel.onchange = function () {
        var tok = sel.value; if (!tok) return; var i = +sel.getAttribute('data-ins');
        insertTokenIntoBody(i, tok, sel); sel.value = '';
      };
    });
    // Multi-spotlight targets.
    var readTargets = function (i) {
      var arr = [];
      body.querySelectorAll('[data-spots="' + i + '"] [data-target]').forEach(function (sel) { if (sel.value) arr.push(sel.value); });
      return arr;
    };
    var updTargets = function (i) { var st = o.steps[i]; if (!st) return; st.target = readTargets(i); persist(); };
    body.querySelectorAll('[data-target]').forEach(function (sel) { sel.onchange = function () { updTargets(+sel.getAttribute('data-target').split('_')[0]); }; });
    body.querySelectorAll('[data-taddspot]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-taddspot'); var st = o.steps[i]; st.target = readTargets(i).concat(['']); persist(); renderEditor(); }; });
    body.querySelectorAll('[data-tdel]').forEach(function (b) { b.onclick = function () { var p = b.getAttribute('data-tdel').split('_'), i = +p[0], ti = +p[1]; var arr = readTargets(i); arr.splice(ti, 1); o.steps[i].target = arr; persist(); renderEditor(); }; });
    body.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { startPick(+b.getAttribute('data-pick')); }; });
    // Compound conditions.
    var readConds = function (i) {
      var arr = [];
      body.querySelectorAll('[data-conds="' + i + '"] .onb-ed-cond').forEach(function (row) {
        var tk = row.querySelector('[data-ctoken]'), op = row.querySelector('[data-cop]'), cv = row.querySelector('[data-cval]');
        if (tk && tk.value) arr.push({ token: tk.value, op: op ? op.value : 'filled', val: cv ? cv.value : '' });
      });
      return arr;
    };
    var updWhen = function (i) {
      var st = o.steps[i]; if (!st) return;
      var L = readConds(i), modeEl = body.querySelector('[data-cmode="' + i + '"]');
      if (!L.length) delete st.when;
      else st.when = { mode: modeEl ? modeEl.value : 'all', conds: L };
      persist();
    };
    body.querySelectorAll('[data-ctoken],[data-cop],[data-cval],[data-cmode]').forEach(function (el) {
      el.onchange = function () {
        var key = el.getAttribute('data-cmode') != null ? el.getAttribute('data-cmode') : (el.getAttribute('data-ctoken') || el.getAttribute('data-cop') || el.getAttribute('data-cval'));
        updWhen(+String(key).split('_')[0]);
      };
    });
    body.querySelectorAll('[data-caddcond]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-caddcond'); var L = readConds(i); L.push({ token: '', op: 'filled', val: '' }); o.steps[i].when = { mode: whenMode(o.steps[i].when), conds: L }; persist(); renderEditor(); }; });
    body.querySelectorAll('[data-cdel]').forEach(function (b) { b.onclick = function () { var p = b.getAttribute('data-cdel').split('_'), i = +p[0], ci = +p[1]; var L = readConds(i); L.splice(ci, 1); if (L.length) o.steps[i].when = { mode: whenMode(o.steps[i].when), conds: L }; else delete o.steps[i].when; persist(); renderEditor(); }; });
    body.querySelectorAll('[data-up]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-up'); if (i > 0) { var t = o.steps[i - 1]; o.steps[i - 1] = o.steps[i]; o.steps[i] = t; persist(); renderEditor(); } }; });
    body.querySelectorAll('[data-dn]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-dn'); if (i < o.steps.length - 1) { var t = o.steps[i + 1]; o.steps[i + 1] = o.steps[i]; o.steps[i] = t; persist(); renderEditor(); } }; });
    body.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { o.steps.splice(+b.getAttribute('data-del'), 1); persist(); renderEditor(); }; });
  }

  function insertTokenIntoBody(i, tok) {
    var o = obEnsure(); var st = o.steps[i]; if (!st) return;
    var ta = document.querySelector('.onb-ed-body[data-i="' + i + '"]'); var ins = '{{' + tok + '}}';
    if (ta) {
      var start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      var end = ta.selectionEnd != null ? ta.selectionEnd : start;
      ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
      st.body = ta.value; persist(); ta.focus();
      try { ta.selectionStart = ta.selectionEnd = start + ins.length; } catch (e) {}
    } else {
      st.body = (st.body || '') + (st.body && !/\s$/.test(st.body) ? ' ' : '') + ins; persist(); renderEditor();
    }
  }
  // "Pick on sheet": GM clicks any field; we build a token for it and insert it inline.
  var _picking = null;
  function pickHint(show) {
    var h = document.getElementById('onb-pick-hint');
    if (!show) { if (h) h.parentNode.removeChild(h); return; }
    if (!h) { h = document.createElement('div'); h.id = 'onb-pick-hint'; document.body.appendChild(h); }
    h.textContent = 'Click a field on the sheet to insert it · Esc to cancel';
  }
  function startPick(i) {
    if (_picking != null) endPick();
    _picking = i; document.body.classList.add('onb-picking'); pickHint(true);
    document.addEventListener('click', onPickClick, true);
    document.addEventListener('keydown', onPickKey, true);
  }
  function endPick() {
    _picking = null; document.body.classList.remove('onb-picking'); pickHint(false);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('keydown', onPickKey, true);
  }
  function onPickKey(e) { if (e.key === 'Escape') { e.preventDefault(); endPick(); } }
  function onPickClick(e) {
    if (e.target.closest('#onb-editor') || e.target.closest('#onb-pick-hint')) return;  // ignore our own UI
    var cs = document.querySelector('.cs'); if (!cs || !cs.contains(e.target)) return;   // sheet only
    e.preventDefault(); e.stopPropagation();
    var i = _picking, tok = tokenForElement(e.target); endPick();
    if (i != null && tok) insertTokenIntoBody(i, tok);
  }
  function togglePreview() {
    if (panelEl()) removePanel(); else mountPanel(true);
    var pv = document.getElementById('onb-ed-prev'); if (pv) pv.textContent = panelEl() ? '◉ Preview on' : '◎ Preview';
  }

  /* ─────────── DISPLAY: docked step wizard (player) ─────────── */
  var curStep = 0, collapsed = false, progLoaded = false, _inputHooked = false, doneMap = {};
  function progKey() { return 'csOnb:' + (q.get('campaign') || 'local') + ':' + (q.get('sheet') || (CSo() && CSo().name) || 'sheet'); }
  function loadProg() { try { var p = JSON.parse(localStorage.getItem(progKey()) || 'null'); if (p) { curStep = p.curStep || 0; collapsed = !!p.collapsed; doneMap = p.done || {}; } } catch (e) {} progLoaded = true; }
  function saveProg() { try { localStorage.setItem(progKey(), JSON.stringify({ curStep: curStep, collapsed: collapsed, done: doneMap })); } catch (e) {} }
  function panelEl() { return document.getElementById('onb-panel'); }
  function removePanel() { var p = panelEl(); if (p) p.parentNode.removeChild(p); }
  function mountPanel(force) {
    var o = ob();
    if (!o || (!o.enabled && !force) || !o.steps || !o.steps.length) { removePanel(); return; }
    if (!progLoaded) loadProg();
    var p = panelEl();
    if (!p) { p = document.createElement('div'); p.id = 'onb-panel'; document.body.appendChild(p); wirePanel(p); }
    // Re-evaluate conditional steps as the player fills the sheet.
    if (!_inputHooked) { _inputHooked = true; document.addEventListener('input', function () { if (panelEl() && !collapsed) renderPanel(); }); }
    renderPanel();
  }
  function renderPanel() {
    var p = panelEl(), o = ob(); if (!p || !o) return;
    p.className = 'onb-panel' + (collapsed ? ' collapsed' : '');
    if (collapsed) { p.innerHTML = '<button class="onb-tab" data-act="expand">▸ ' + esc(o.title || 'Character creation') + '</button>'; return; }
    var vis = visSteps(), n = vis.length;        // conditional steps resolved live
    if (curStep >= n) curStep = n - 1; if (curStep < 0) curStep = 0;
    var s = vis[curStep] || {};
    var doneCount = vis.filter(function (st) { return st.id && doneMap[st.id]; }).length;
    var pct = n ? Math.round(doneCount / n * 100) : 0;
    var isDone = !!(s.id && doneMap[s.id]);
    var hasTargets = targetList(s).length > 0;
    p.innerHTML =
      '<div class="onb-head"><span class="onb-htitle">' + esc(o.title || 'Character creation') + '</span>' +
        '<span class="onb-progress">' + (n ? (curStep + 1) : 0) + ' / ' + n + '</span>' +
        '<button class="onb-min" data-act="collapse" title="Collapse">▾</button></div>' +
      '<div class="onb-bar" title="' + doneCount + ' / ' + n + ' done"><div class="onb-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="onb-step-title' + (isDone ? ' onb-step-done' : '') + '">' + esc(s.title || 'Step ' + (curStep + 1)) + '</div>' +
      '<div class="onb-step-body">' + renderBody(s.body) + '</div>' +
      '<label class="onb-done"><input type="checkbox" data-act="done"' + (isDone ? ' checked' : '') + '> Mark this step done</label>' +
      '<div class="onb-nav">' +
        '<button class="onb-btn" data-act="prev"' + (curStep === 0 ? ' disabled' : '') + '>‹ Prev</button>' +
        (hasTargets ? '<button class="onb-btn onb-btn-spot" data-act="spot">◎ Show</button>' : '') +
        '<button class="onb-btn" data-act="next"' + (curStep >= n - 1 ? ' disabled' : '') + '>Next ›</button>' +
      '</div>';
  }
  function go(d) { var n = visSteps().length; curStep = Math.max(0, Math.min(n - 1, curStep + d)); saveProg(); renderPanel(); spotCurrent(); }
  function spotCurrent() { var s = visSteps()[curStep]; if (s) spotlightTargets(targetList(s)); }
  function toggleDone() { var s = visSteps()[curStep]; if (!s || !s.id) return; if (doneMap[s.id]) delete doneMap[s.id]; else doneMap[s.id] = 1; saveProg(); renderPanel(); }
  function wirePanel(p) {
    p.addEventListener('click', function (e) {
      e.stopPropagation();   // don't trigger cs-join/campaign-doc publish on nav
      var b = e.target.closest('[data-act],[data-tok]'); if (!b) return;
      if (b.hasAttribute('data-tok')) { spotlight(b.getAttribute('data-tok')); return; }
      var act = b.getAttribute('data-act');
      if (act === 'next') go(1);
      else if (act === 'prev') go(-1);
      else if (act === 'spot') spotCurrent();
      else if (act === 'done') toggleDone();
      else if (act === 'collapse') { collapsed = true; saveProg(); renderPanel(); }
      else if (act === 'expand') { collapsed = false; saveProg(); renderPanel(); }
    });
  }

  /* ─────────── Default templates ("?" next to ⚙ Settings) ─────────── */
  // Ships as data/onboarding-default.<lang>.json (each holds quick + full). The "?"
  // shows ONLY when the sheet has no usable guide, so it never overwrites the GM's.
  var _defCache = {};
  function hasGuide() { var o = ob(); return !!(o && o.steps && o.steps.length); }
  function helpBtnEl() { return document.getElementById('onb-help-btn'); }
  function removeHelpButton() { var b = helpBtnEl(); if (b) b.parentNode.removeChild(b); }
  function syncHelpButton() {
    if (hasGuide()) { removeHelpButton(); return; }
    if (helpBtnEl()) return;
    var gear = document.querySelector('#topnav button[onclick*="csSettingsModal"]');
    if (!gear || !gear.parentNode) return;
    var b = document.createElement('button');
    b.id = 'onb-help-btn'; b.className = 'btn onb-help-btn'; b.type = 'button';
    b.title = 'Help me create my character'; b.textContent = '?';
    b.onclick = helpPopup;
    gear.parentNode.insertBefore(b, gear.nextSibling);
  }
  function defLang() { try { var v = localStorage.getItem('csOnbDefaultLang'); if (v) return v; } catch (e) {} return /^fr/i.test(navigator.language || '') ? 'fr' : 'en'; }
  function defVariant() { try { return localStorage.getItem('csOnbDefaultVariant') || 'quick'; } catch (e) { return 'quick'; } }
  function helpPopup() {
    if (typeof window._modalOpen !== 'function') return;
    var lang = defLang(), variant = defVariant();
    function seg(g, val, cur, label) { return '<button type="button" class="onb-seg' + (val === cur ? ' active' : '') + '" data-seg="' + g + '" data-val="' + val + '">' + label + '</button>'; }
    var html = '<div class="onb-help-pop">' +
      '<p class="onb-help-intro">Load a step-by-step character-creation guide onto this sheet. It walks you through the sheet in order and highlights each field as you go.</p>' +
      '<div class="onb-help-row"><span class="onb-help-lbl">Language</span><span class="onb-seg-grp" id="onb-seg-lang">' + seg('lang', 'en', lang, 'English') + seg('lang', 'fr', lang, 'Français') + '</span></div>' +
      '<div class="onb-help-row"><span class="onb-help-lbl">Length</span><span class="onb-seg-grp" id="onb-seg-variant">' + seg('variant', 'quick', variant, 'Quick Start') + seg('variant', 'full', variant, 'Full') + '</span></div>' +
      '<button type="button" class="onb-help-go" id="onb-help-go">Help me create my character</button>' +
      '</div>';
    window._modalOpen('Help me create my character', html);
    var sel = { lang: lang, variant: variant };
    var root = document.getElementById('cs-modal-body') || document;
    root.querySelectorAll('.onb-seg').forEach(function (btn) {
      btn.onclick = function () {
        var g = btn.getAttribute('data-seg'); sel[g] = btn.getAttribute('data-val');
        var grp = document.getElementById('onb-seg-' + g);
        if (grp) grp.querySelectorAll('.onb-seg').forEach(function (o) { o.classList.toggle('active', o === btn); });
      };
    });
    var go = document.getElementById('onb-help-go');
    if (go) go.onclick = function () { loadDefault(sel.lang, sel.variant); };
  }
  function loadDefault(lang, variant) {
    try { localStorage.setItem('csOnbDefaultLang', lang); localStorage.setItem('csOnbDefaultVariant', variant); } catch (e) {}
    var cs = CSo(); if (!cs) return;
    if (hasGuide() && !window.confirm('This sheet already has an onboarding guide. Replace it with the default template?')) return;
    function apply(data) {
      var tpl = data && data[variant];
      if (!tpl || !Array.isArray(tpl.steps)) { window.alert('Could not load the template.'); return; }
      cs.onboarding = { enabled: true, title: tpl.title || 'Create your character',
        steps: tpl.steps.map(function (s) {
          var st = { id: s.id || uid(), title: s.title || '', body: s.body || '', target: Array.isArray(s.target) ? s.target.slice() : (s.target || '') };
          var L = whenList(s.when); if (L.length) st.when = { mode: whenMode(s.when), conds: L.map(function (c) { return { token: c.token, op: c.op || 'filled', val: c.val || '' }; }) };
          return st;
        }) };
      persist();
      if (typeof window._modalClose === 'function') window._modalClose();
      removeHelpButton();
      curStep = 0; collapsed = false; saveProg();
      mountPanel(); spotCurrent();
    }
    if (_defCache[lang]) { apply(_defCache[lang]); return; }
    fetch('data/onboarding-default.' + lang + '.json').then(function (r) { return r.json(); })
      .then(function (d) { _defCache[lang] = d; apply(d); })
      .catch(function () { window.alert('Could not load the template file.'); });
  }

  /* ─────────── Lifecycle ─────────── */
  // Author chip and player wizard can coexist (e.g. standalone GM authoring a
  // sheet that already has onboarding), so evaluate both independently.
  function boot() { syncAuthorChip(); syncHelpButton(); if (isDisplay()) mountPanel(); }
  function afterApply() {
    syncAuthorChip();
    syncHelpButton();
    if (isDisplay()) mountPanel();   // onboarding may have just arrived via sync / template apply
    else removePanel();
  }
  // Called when the "Author onboarding" setting toggles (add/remove chip live).
  function refreshAuthor() { syncAuthorChip(); }

  window.CSOnboarding = { boot: boot, afterApply: afterApply, spotlight: spotlight, resolveTarget: resolveTarget, refreshAuthor: refreshAuthor, _edit: openEditor, _help: helpPopup };
})();
