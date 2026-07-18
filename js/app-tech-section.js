/* app-tech-section.js — TECH section orchestrator (cran 1).
   Three screens: BIBLIOTHÈQUE → ÉTABLI (dense console) → DOCUMENT. The press
   (window.TechPress) is the PLATE mode of the bench, not a screen.
   Exposes window.TechSection { render(tab, pane) } — the app-shell entry.
   Depends on TechArtifact (model), TechCatalog (content), TechPress (plate). */
(function () {
  'use strict';
  var M = window.TechArtifact, C = window.TechCatalog, P = window.TechPress, TR = window.TechTrees;
  var LS = 'bartmoss_tech_artifacts';
  var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var isKnown = function (d) { return C.isKnownDomain(d); };
  var DERIVE = function (a) { return M.derive(a, { isKnownDomain: isKnown, addonPrice: C.addonPrice }); };
  function addonEbTag(a, name) { var eb = M.addonEb(a, name, { addonPrice: C.addonPrice }); var e = C.addonPrice(name); var scaled = !!(e && e.mult != null); return '<span class="tk2-addeb" title="' + (scaled ? 'cost scales with the object’s complexity' : 'addon cost') + '">' + (scaled ? '~' : '') + eb + 'eb</span>'; }
  function addonPriceStr(a, name) { var eb = M.addonEb(a, name, { addonPrice: C.addonPrice }); var e = C.addonPrice(name); return ((e && e.mult != null) ? '~' : '') + eb + 'eb' + ((e && e.mult != null) ? ' · ∝ complexity' : ''); }
  function allAddonCount(a) { var n = a.addons.length; a.feats.forEach(function (f) { n += (f.addons || []).length; }); return n; }
  var GATE = function (a, skills) { return M.gate(a, skills, { skillForClass: C.skillForClass, skillForDomain: C.skillForDomain }); };
  // ── the BUILDER = the current player's OWN sheet (the one shown in /party/me),
  // picked up automatically from the session — no manual linking. GM = fiat. ──
  function builderInfo() { var B = window.Shell && window.Shell.bridge && window.Shell.bridge(); var sess = B && B.sess; return { role: (sess && sess.role) || 'gm', sheetId: sess && sess.sheetId }; }
  function skillMap(sk) { var m = {}; if (Array.isArray(sk)) sk.forEach(function (x) { if (x && x.name) m[x.name] = +(x.val != null ? x.val : x.level) || 0; }); else if (sk && typeof sk === 'object') for (var k in sk) m[k] = +sk[k] || 0; return m; }
  var STATS9 = ['INT', 'REF', 'TECH', 'COOL', 'ATT', 'LUCK', 'MA', 'BODY', 'EMP'];
  // Targets the "+ mod" picker can bind a wearer bonus to — read straight off the sheet.
  function sheetTargets(json) {
    json = json || {};
    var customStats = ((json.nativeExtras && json.nativeExtras['sec-stats:primary']) || []).map(function (f) { return f && f.label; }).filter(Boolean);
    var skills = Object.keys(json.skills || {}).concat(((json.customSkills || []).map(function (s) { return s && s.name; }))).filter(Boolean);
    var seen = {}, uniq = skills.filter(function (n) { var k = n.toLowerCase(); return seen[k] ? false : (seen[k] = 1); });
    return { stats: STATS9.slice(), customStats: customStats, skills: uniq.sort() };
  }
  function loadBuilder(pane, force) {
    var s = sec(pane); if (s.builderLoaded && !force) return; s.builderLoaded = true;
    var info = builderInfo();
    if (info.role === 'gm') { s.builder = { role: 'gm', targets: sheetTargets(null) }; refreshGate(pane); return; }
    if (!info.sheetId || !(window.Store && window.Store.resolve)) { s.builder = { role: 'player', none: true, targets: sheetTargets(null) }; refreshGate(pane); return; }
    if (force && window.Store.invalidate) window.Store.invalidate();   // bust a stale sheet cache so skill edits are seen
    window.Store.resolve({ type: 'sheet', id: info.sheetId }).then(function (hit) {
      s.builder = (hit && hit.json) ? { role: 'player', name: hit.json.handle || hit.json.name || 'you', skills: skillMap(hit.json.skills), targets: sheetTargets(hit.json) } : { role: 'player', none: true, targets: sheetTargets(null) };
      refreshGate(pane);
    }).catch(function () { s.builder = { role: 'player', none: true, targets: sheetTargets(null) }; refreshGate(pane); });
  }
  function gateStrip(a, builder) {
    if (!builder) return '<div class="tk2-gate is-load"><span class="tk2-mut">gating… (reading your sheet)</span></div>';
    if (builder.role === 'gm') return '<div class="tk2-gate is-gm"><span class="tk2-gate-v">GM · FIAT</span> <span class="tk2-mut">free build — gating applies to techie players</span></div>';
    if (builder.none) return '<div class="tk2-gate is-none"><span class="tk2-gate-v">?</span> no sheet — <span class="tk2-mut">requires: ' + esc(skillsRequired(a).join(' · ')) + '</span></div>';
    var g = GATE(a, builder.skills);
    var verdict = g.buildable ? (g.pushes.length ? '⚠ PUSH' : '✓ BUILDABLE') : '✗ LOCKED';
    var rows = g.rows.map(function (r) {
      var ic = r.status === 'ok' ? '✓' : r.status === 'push' ? '⚠ +' + r.push : '✗';
      return '<span class="tk2-gr tk2-gr-' + r.status + '">' + esc(r.skill) + ' <b>' + r.have + '</b>/' + r.need + ' ' + ic + (r.isClass ? ' <span class="tk2-mut">class</span>' : '') + '</span>';
    }).join('');
    var tail = g.locks.length ? '<span class="tk2-mut">missing: ' + esc(g.locks.join(', ')) + '</span>' : (g.instability ? '<span class="tk2-mut">instability +' + g.instability + '</span>' : '');
    return '<div class="tk2-gate tk2-gate-' + (g.buildable ? (g.pushes.length ? 'push' : 'ok') : 'locked') + '"><span class="tk2-gate-h">' + esc(builder.name || 'you') + '</span><span class="tk2-gate-v">' + verdict + '</span><span class="tk2-gate-rows">' + rows + '</span>' + tail + '</div>';
  }
  function refreshGate(pane) { var s = sec(pane); if (!s.art) return; var el = pane.querySelector('.tk2-gate-wrap'); if (el) el.innerHTML = gateStrip(s.art, s.builder); }
  // keep the gating in sync: a sheet save (skills edited) or a role/campaign change
  // re-reads the builder and refreshes the verdict — no manual reload.
  function watchBuilder(pane) {
    if (pane._techGateWatch || !(window.App && window.App.on)) return; pane._techGateWatch = 1;
    var reload = function () { if (!document.body.contains(pane)) return; loadBuilder(pane, true); };
    window.App.on('entity:saved', function (e) { if (e && e.type === 'sheet') reload(); });
    window.App.on('campaign', reload);
  }
  function help(t) { return '<div class="tk2-help">' + t + '</div>'; }
  var ORIGINS = [['HANDMADE', 'handmade — mismatched screws'], ['SALVAGE', 'salvaged — donor screws'], ['CORP PULL', 'ripped from a corp — torx'], ['FACTORY', 'factory — captive screws']];
  // ── EFFECT picker = pick a domain, then WALK its tree (tier = the old grade) ──
  function effectBody(a, pick) {
    pick = pick || {};
    if (!pick.treeDom) {
      var noStrike = function (d) { return d !== 'STRIKE'; };   // STRIKE is superseded by its weapon systems
      var sug = C.suggestFor(a.cls).domains.filter(noStrike);
      var ws = (TR.WEAPON_SYSTEMS || []);
      var row = function (d) { var an = C.anchorOf(d, 1); return '<button class="tk2-pk-row" data-treedom="' + d + '"><span class="tk2-pd-h">' + esc(d) + '</span> <span class="tk2-mut">· ' + (TR.has(d) ? 'tree' : 'ladder') + (an ? ' · ' + esc(an.skill) : '') + '</span></button>'; };
      var body = '';
      body += '<div class="tk2-pk-sec">WEAPON SYSTEMS <span class="tk2-mut">— STRIKE</span></div>' + ws.map(row).join('');
      if (sug.length) body += '<div class="tk2-pk-sec">SUGGESTED FOR ' + esc(a.cls.toUpperCase()) + '</div>' + sug.map(row).join('');
      body += '<div class="tk2-pk-sec">ALL EFFECTS</div>' + C.DOMAINS.filter(noStrike).map(row).join('');
      body += '<div class="tk2-pk-sec">EXOTIC DOMAIN</div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="domain name…"><button class="tk2-chip" data-pkcustom="effect">+ add (g1)</button></div>';
      return body;
    }
    var g = TR.get(pick.treeDom), path = pick.treePath || [];
    var crumbA = TR.crumbs(g, path);
    var crumb = crumbA.length ? crumbA.map(function (c) { return esc(c); }).join(' <span class="tk2-mut">+</span> ') : '<span class="tk2-mut">click a node to add it…</span>';
    var chips = TR.collect(g, path, 'act').map(function (x) { return '<span class="tk2-tchip act">▸ ' + esc(x) + '</span>'; }).join('') +
      TR.collect(g, path, 'tag').map(function (x) { return '<span class="tk2-tchip">unlocks +' + esc(x) + '</span>'; }).join('') +
      TR.collect(g, path, 'need').map(function (x) { return '<span class="tk2-tchip need">' + esc(x) + '</span>'; }).join('');
    var dials = TR.activeIds(path).map(function (id) { return g.nodes[id]; }).filter(function (n) { return n && n.scale; });
    var dialHtml = dials.map(function (n) { var v = TR.scaleOf(path, n.id) || 1; return '<span class="tk2-dial">' + esc(n.label) + ' ° <button class="tk2-dstep" data-dial="' + n.id + '" data-dd="-1">−</button><b>' + v + '</b><button class="tk2-dstep" data-dial="' + n.id + '" data-dd="1">+</button> <span class="tk2-mut">' + esc(n.scale.per || '') + ' — requires ×' + v + '</span></span>'; }).join('');
    return '<div class="tk2-tree-head"><button class="tk2-chip" data-treeback>← effects</button>' +
        '<span class="tk2-tree-dom">' + esc(pick.treeDom) + '</span>' + (TR.has(pick.treeDom) ? '' : ' <span class="tk2-mut">(ladder)</span>') +
        '<span class="tk2-tree-legend"><b>○</b> pick-one · <b>□</b> add · <b>◇</b> ° dial · <b>⬡</b> needs-all</span>' +
        '<span class="tk2-bar-sp"></span>' +
        '<button class="app-btn tk2-treeadd"' + (path.length ? '' : ' disabled') + '>' + (pick.editFi != null ? 'SET' : 'ADD') + ' · g' + TR.grade(g, path) + '</button></div>' +
      '<div class="tk2-tree-desc" data-treedesc><span class="tk2-mut">hover a node to read what it does</span></div>' +
      treeSvg(g, path) +
      '<div class="tk2-tree-crumb">' + crumb + '</div>' +
      (dialHtml ? '<div class="tk2-tree-dials">' + dialHtml + '</div>' : '') +
      (chips ? '<div class="tk2-tree-chips">' + chips + '</div>' : '');
  }
  function glyphSvg(kind, on) {
    var f = on ? '#111' : '#fff';
    if (kind === 'add') return '<rect class="tk2-tg" x="-6" y="-6" width="12" height="12" fill="' + f + '"/>';
    if (kind === 'dial') return '<rect class="tk2-tg" x="-6" y="-6" width="12" height="12" transform="rotate(45)" fill="' + f + '"/>';
    if (kind === 'conv') return '<polygon class="tk2-tg" points="0,-7 6,-3.5 6,3.5 0,7 -6,3.5 -6,-3.5" fill="' + f + '"/>';
    return '<circle class="tk2-tg" r="6" fill="' + f + '"/>';
  }
  function treeSvg(g, path) {
    var L = TR.layout(g), on = {}; TR.activeIds(path).forEach(function (id) { on[id] = 1; });
    on[g.root] = 1;   // the base is always "on" so the trunk to the chosen branch lights up
    var svg = '';
    for (var t = 1; t <= g.maxTier; t++) { var gy = L.padY + t * L.rowH; svg += '<text class="tk2-tree-g" x="8" y="' + (gy + 4).toFixed(0) + '">g' + t + '</text>'; }
    g.edges.forEach(function (e) { var A = L.pos[e.from], B = L.pos[e.to], lit = on[e.from] && on[e.to]; svg += '<line class="tk2-tedge' + (lit ? ' on' : '') + '" x1="' + A.x.toFixed(1) + '" y1="' + A.y.toFixed(1) + '" x2="' + B.x.toFixed(1) + '" y2="' + B.y.toFixed(1) + '"/>'; });
    // needsAll: dashed links from the convergence node to EVERY required node
    Object.keys(g.nodes).forEach(function (id) { var n = g.nodes[id]; if (!n.needsAll) return; var B = L.pos[id]; n.needsAll.forEach(function (r) { var A = L.pos[r]; if (!A) return; var lit = on[id] && on[r]; svg += '<line class="tk2-tedge-req' + (lit ? ' on' : '') + '" x1="' + A.x.toFixed(1) + '" y1="' + A.y.toFixed(1) + '" x2="' + B.x.toFixed(1) + '" y2="' + B.y.toFixed(1) + '"/>'; }); });
    var R = L.pos[g.root]; svg += '<text class="tk2-troot" x="' + R.x.toFixed(1) + '" y="' + (R.y - 12).toFixed(1) + '" text-anchor="middle">' + esc(g.nodes[g.root].label.toUpperCase()) + '</text>';
    svg += '<circle class="tk2-tbase" cx="' + R.x.toFixed(1) + '" cy="' + R.y.toFixed(1) + '" r="5"/>';   // the base, under the title — the trunk starts here
    Object.keys(g.nodes).forEach(function (id) {
      if (id === g.root) return;
      var n = g.nodes[id], p = L.pos[id], k = TR.kindOf(n), act = !!on[id];
      var blocked = n.needsAll && !n.needsAll.every(function (r) { return on[r]; });
      var st = act ? 'on' : blocked ? 'off' : 'ok';
      var tip = (n.cap || '') + (n.need ? (n.cap ? ' · ' : '') + 'needs ' + n.need : '') + (n.needsAll ? (n.cap || n.need ? ' · ' : '') + 'needs all: ' + n.needsAll.map(function (r) { return g.nodes[r] ? g.nodes[r].label : r; }).join(', ') : '');
      var dv = act && n.scale ? '<text class="tk2-tdialv" y="21" text-anchor="middle">×' + (TR.scaleOf(path, id) || 1) + '</text>' : '';
      svg += '<g class="tk2-tnode tk2-t-' + k + ' is-' + st + '" data-treenode="' + id + '" transform="translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')">' +
        (tip ? '<title>' + esc(tip) + '</title>' : '') +
        '<text class="tk2-tlabel" y="-13" text-anchor="middle">' + esc(n.label) + (n.scale ? '°' : '') + (n.act ? ' ▸' : '') + '</text>' +
        glyphSvg(k, act) + dv + '</g>';
    });
    return '<div class="tk2-tree-wrap"><svg class="tk2-tree" width="' + L.W.toFixed(0) + '" height="' + L.H.toFixed(0) + '" viewBox="0 0 ' + L.W.toFixed(0) + ' ' + L.H.toFixed(0) + '">' + svg + '</svg></div>';
  }
  // keep the tree's scroll across re-renders; center on the title on first open
  function saveTreeScroll(pane, s) { if (!s.pick) return; var tw = pane.querySelector('.tk2-tree-wrap'); if (tw) s.pick.treeScroll = { x: tw.scrollLeft, y: tw.scrollTop }; }
  function restoreTreeScroll(pane) { var s = sec(pane); if (!s.pick || !s.pick.treeDom) return; var tw = pane.querySelector('.tk2-tree-wrap'); if (!tw) return; if (s.pick.treeScroll) { tw.scrollLeft = s.pick.treeScroll.x; tw.scrollTop = s.pick.treeScroll.y; } else { tw.scrollLeft = Math.max(0, (tw.scrollWidth - tw.clientWidth) / 2); tw.scrollTop = 0; } }
  function tokenBody(a, tkind) {
    var T = C.TOKENS, groups = tkind === 'needs' ? [['ammo', 'ammo'], ['power', 'power'], ['consumables', 'consumable']] : [['mounts', 'mount'], ['ammo', 'ammo'], ['ports', 'port'], ['formats', 'format']];
    var tcell = function (t, kind) { return pickCell('data-pktok', t, kind + (C.isStandard(t) ? ' · shop' : ' · custom')); };
    var sugT = C.suggestFor(a.cls).tokens.filter(function (t) { return groups.some(function (g) { return T[g[1]].indexOf(t) >= 0; }); });
    var body = '';
    if (sugT.length) body += '<div class="tk2-pk-sec">SUGGESTED FOR ' + esc(a.cls.toUpperCase()) + '</div>' + pickGrid(sugT.map(function (t) { return tcell(t, tokenKind(t)); }).join(''));
    groups.forEach(function (g) { body += '<div class="tk2-pk-sec">' + g[0].toUpperCase() + '</div>' + pickGrid(T[g[1]].map(function (t) { return tcell(t, KIND_LABEL[g[1]]); }).join('')); });
    body += '<div class="tk2-pk-sec">CUSTOM</div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="custom token…"><button class="tk2-chip" data-pkcustom="token">+ add</button></div>';
    return body;
  }
  function classBody(a) {
    return C.CLASSES.map(function (cl) { var sug = C.suggestFor(cl).domains; return '<button class="tk2-pk-row' + (cl === a.cls ? ' is-sel' : '') + '" data-pkcls="' + cl + '"><span class="tk2-pd-h">' + cl + '</span> <span class="tk2-mut">· ' + esc(C.skillForClass(cl)) + (sug.length ? ' · ' + esc(sug.slice(0, 3).join(', ')) : '') + '</span></button>'; }).join('');
  }
  function originBody(a) {
    return ORIGINS.map(function (o) { return '<button class="tk2-pk-row' + (o[0] === a.origin ? ' is-sel' : '') + '" data-pkorigin="' + o[0] + '"><span class="tk2-pd-h">' + o[0] + '</span> <span class="tk2-mut">· ' + esc(o[1]) + '</span></button>'; }).join('');
  }
  // EFFECT-ADDON picker — the addon catalogue is scoped to what THIS effect does (its
  // domain) ; each proposed addon shows its computed price against the current object.
  function faddonBody(a, fi) {
    var f = a.feats[fi]; if (!f) return '';
    var fam = C.familyOfDomain(f.domain), list = C.addonsForDomain(f.domain);
    var body = '<div class="tk2-pk-sec">' + esc(f.domain) + (fam ? '' : ' · generic') + '</div>' + pickGrid(list.map(function (m) { return pickCell('data-pkfaddon', m, addonPriceStr(a, m)); }).join(''));
    body += '<div class="tk2-pk-sec">CUSTOM <span class="tk2-mut">— default ' + M.TUNING.addon.eb + 'eb</span></div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="custom addon…"><button class="tk2-chip" data-pkcustom="faddon">+ add</button></div>';
    return body;
  }
  // GENERIC-ADDON picker — the transverse addons (miniaturisation, durci…) with their
  // computed price (fixed, or ~proportional to the object's complexity) + a custom field.
  function gaddonBody(a) {
    var body = '<div class="tk2-pk-sec">GENERIC ADDONS</div>' + pickGrid(C.GENERIC_ADDONS.map(function (m) { return pickCell('data-pkgaddon', m, addonPriceStr(a, m)); }).join(''));
    body += '<div class="tk2-pk-sec">CUSTOM <span class="tk2-mut">— default ' + M.TUNING.addon.eb + 'eb</span></div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="custom addon…"><button class="tk2-chip" data-pkcustom="gaddon">+ add</button></div>';
    return body;
  }
  // WEARER-MOD picker — a bonus fed to the sheet, bound to one of the wearer's own
  // stats / custom stats / skills (read live off their sheet). Falls back to stats-only.
  function wmodBody(a, builder) {
    var T = (builder && builder.targets) || sheetTargets(null);
    var body = '<div class="tk2-pk-sec">STATS</div>' + pickGrid(T.stats.map(function (t) { return pickCell('data-pkwmod', t, 'stat'); }).join(''));
    if (T.customStats.length) body += '<div class="tk2-pk-sec">CUSTOM STATS</div>' + pickGrid(T.customStats.map(function (t) { return pickCell('data-pkwmod', t, 'custom stat'); }).join(''));
    if (T.skills.length) body += '<div class="tk2-pk-sec">SHEET SKILLS</div>' + pickGrid(T.skills.map(function (t) { return pickCell('data-pkwmod', t, 'skill'); }).join(''));
    else body += '<div class="tk2-pk-sec">SKILLS</div><div class="tk2-help">no sheet loaded — switch to a techie player or add a custom skill below.</div>';
    body += '<div class="tk2-pk-sec">CUSTOM SKILL</div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="skill name…"><button class="tk2-chip" data-pkcustom="wmod">+ add</button></div>';
    return body;
  }
  // effect PICKER (popup): every domain with its full grade ladder — you SEE what a
  // higher grade gives, and can pick that grade directly. Suggested-for-class on top.
  function domainTable(list) {
    var head = '<tr><th class="tk2-tcorner">DOMAIN</th>';
    for (var g = 1; g <= 6; g++) head += '<th>g' + g + '</th>';
    head += '</tr>';
    var rows = list.map(function (dm) {
      var an1 = C.anchorOf(dm, 1); if (!an1) return '';
      var cells = '';
      for (var g = 1; g <= 6; g++) { var an = C.anchorOf(dm, g); cells += '<td><button class="tk2-cell" data-pkdom="' + dm + '" data-pkg="' + g + '">' + esc(an.bar) + '</button></td>'; }
      return '<tr><th class="tk2-tdom">' + dm + '<span class="tk2-mut">' + esc(an1.skill) + '</span></th>' + cells + '</tr>';
    }).join('');
    return '<div class="tk2-etab-wrap"><table class="tk2-etab"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  }
  // substantial cards (name + note) in a responsive grid — for 1-D lists (tokens/mods)
  function pickCell(attr, val, sub) { return '<button class="tk2-pk-cell" ' + attr + '="' + esc(val) + '"><span class="tk2-pk-cn">' + esc(val) + '</span>' + (sub ? '<span class="tk2-mut">' + esc(sub) + '</span>' : '') + '</button>'; }
  function pickGrid(html) { return '<div class="tk2-pk-grid">' + html + '</div>'; }
  var KIND_LABEL = { ammo: 'ammo', mount: 'mount', power: 'power', port: 'port', format: 'format', consumable: 'consumable' };
  function tokenKind(t) { var T = C.TOKENS, k; for (k in T) if (T[k].indexOf(t) >= 0) return KIND_LABEL[k] || k; return 'custom'; }
  function pickerModal(a, pick, builder) {
    var title, body;
    if (pick.kind === 'effect') { title = 'PICK AN EFFECT <span class="tk2-mut">— walk the tree</span>'; body = effectBody(a, pick); }
    else if (pick.kind === 'token') { title = 'ADD <span class="tk2-mut">— ' + esc(pick.tkind) + '</span>'; body = tokenBody(a, pick.tkind); }
    else if (pick.kind === 'faddon') { title = 'ADDON <span class="tk2-mut">— tied to the effect</span>'; body = faddonBody(a, pick.fi); }
    else if (pick.kind === 'gaddon') { title = 'GENERIC ADDON <span class="tk2-mut">— cross-cutting</span>'; body = gaddonBody(a); }
    else if (pick.kind === 'wmod') { title = 'WEARER BONUS <span class="tk2-mut">— target a stat / a skill</span>'; body = wmodBody(a, builder); }
    else if (pick.kind === 'class') { title = 'OBJECT CLASS'; body = classBody(a); }
    else { title = 'ORIGIN'; body = originBody(a); }
    var wide = (pick.kind === 'effect' && pick.treeDom) ? ' tk2-modal-wide' : '';
    return '<div class="tk2-modal" data-pkscrim><div class="tk2-modal-box' + wide + '"><div class="tk2-modal-h">' + title + '<span class="tk2-bar-sp"></span><span class="tk2-modal-x" data-pkclose>✕</span></div><div class="tk2-modal-b">' + body + '</div></div></div>';
  }

  // ── store ──
  function base() { return { order: [], parts: {}, view: 'library', currentId: null }; }
  function store() { try { return JSON.parse(localStorage.getItem(LS)) || base(); } catch (e) { return base(); } }
  function save(st) { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} }
  function sec(pane) { if (!pane._sec) pane._sec = { st: store(), art: null, mode: null }; return pane._sec; }

  function openArtifact(pane, art) { var s = sec(pane); s.art = M.normalize(art); s.st.view = 'bench'; s.st.currentId = s.art.id; s.mode = null; s.pick = null; commit(pane); render(null, pane); }
  function commit(pane) { var s = sec(pane); if (s.art) { s.st.parts[s.art.id] = M.toJSON(s.art); if (s.st.order.indexOf(s.art.id) < 0) s.st.order.push(s.art.id); } save(s.st); }
  function backToLibrary(pane) { var s = sec(pane); s.st.view = 'library'; s.st.currentId = null; s.mode = null; save(s.st); render(null, pane); }

  // ── entry ──
  function render(tab, pane) {
    pane.className = 'tab-content tk2-pane';
    var s = sec(pane);
    if (s.mode === 'plate') return renderPlate(pane);
    if (s.mode === 'annotate') return renderAnnotate(pane);
    var view = s.st.view || 'library';
    if (view === 'bench' && s.art) { loadBuilder(pane, true); return renderBench(pane); }
    if (view === 'document' && s.art) return renderDocument(pane);
    return renderLibrary(pane);
  }

  // ══════════════ SCREEN A · LIBRARY ══════════════
  function libCard(a, kind) {
    var d = DERIVE(a), doms = a.feats.map(function (f) { return f.domain + ' g' + f.grade; }).join(' · ') || (Object.keys(a.stats).length ? 'stats only' : '—');
    return '<button class="tk2-card' + (a.plate ? ' has-fig' : '') + '" data-open="' + esc(a.id) + '" data-kind="' + kind + '">' +
      (a.plate ? '<span class="tk2-card-fig">' + plateFig(a, d) + '</span>' : '') +
      '<span class="tk2-card-h"><span class="tk2-card-n">' + esc(a.name) + '</span><span class="tk2-card-c">' + esc(a.cls) + ' · t' + a.tier + '</span></span>' +
      '<span class="tk2-card-d">' + esc(doms) + '</span>' +
      '<span class="tk2-card-m">DC ' + d.dcLineage + ' · OP ' + d.op + ' · ' + d.streetEb + 'eb</span></button>';
  }
  function renderLibrary(pane) {
    var s = sec(pane), st = s.st;
    var mine = st.order.map(function (id) { return M.fromJSON(st.parts[id]); }).filter(Boolean);
    pane.innerHTML =
      '<div class="tk2-bar"><span class="tk2-title">TECH WORKSHOP</span>' +
        '<span class="tk2-bar-sp"></span>' +
        '<input class="tk2-imp" placeholder="paste a one-line record…">' +
        '<button class="app-btn tk2-imp-go">IMPORT</button>' +
        '<button class="app-btn tk2-new">+ NEW OBJECT</button></div>' +
      '<div class="tk2-lib">' +
        '<div class="tk2-sect">YOUR OBJECTS <span class="tk2-count">' + mine.length + '</span></div>' +
        (mine.length ? '<div class="tk2-grid">' + mine.map(function (a) { return libCard(a, 'mine'); }).join('') + '</div>'
          : '<div class="tk2-empty">No objects. Start from a preset below, or make a blank one.</div>') +
        '<div class="tk2-sect">PRESETS <span class="tk2-count">' + C.PRESETS.length + '</span> <span class="tk2-hint">— open one to see how it’s built, then tinker</span></div>' +
        '<div class="tk2-grid">' + C.presets().map(function (a) { return libCard(a, 'preset'); }).join('') + '</div>' +
      '</div>';
    pane.querySelector('.tk2-new').onclick = function () { openArtifact(pane, M.blank()); };
    pane.querySelector('.tk2-imp-go').onclick = function () {
      var v = pane.querySelector('.tk2-imp').value.trim(); if (!v) return;
      var a = M.fromJSON(v); if (!a) { pane.querySelector('.tk2-imp').value = ''; return; }
      a.id = M.newId('art'); openArtifact(pane, a);
    };
    pane.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-open'), kind = b.getAttribute('data-kind');
        if (kind === 'preset') { var pr = C.presets().filter(function (x) { return x.id === id; })[0]; if (pr) { pr.id = M.newId('art'); pr.preset = false; openArtifact(pane, pr); } }
        else { var a = M.fromJSON(s.st.parts[id]); if (a) openArtifact(pane, a); }
      };
    });
  }

  // ══════════════ SCREEN B · BENCH (dense console) ══════════════
  function gradeMeter(g) { var o = ''; for (var i = 0; i <= 6; i++) o += '<span class="tk2-gc' + (i <= g ? ' on' : '') + '" data-g="' + i + '">' + (i <= g ? '■' : '□') + '</span>'; return o; }
  function skillsRequired(a) {
    var set = {}; set[C.skillForClass(a.cls)] = 1;
    a.feats.forEach(function (f) { set[C.skillForDomain(f.domain)] = 1; });
    return Object.keys(set);
  }
  function nomenclature(a, d) {
    var rows = [];
    d.ingredients.forEach(function (g) {
      var src = g.grade <= 2 ? 'shop / black market' : g.grade <= 3 ? 'black market (fixer)' : 'salvage / signature';
      rows.push('<tr><td>component ' + esc(g.domain) + ' g' + g.grade + '</td><td>' + src + (g.exotic ? ' · <b>exotic</b>' : '') + '</td><td class="tk2-r">☐</td></tr>');
    });
    a.ports.needs.forEach(function (n) {
      if (!n.token) return;
      rows.push('<tr><td>' + esc(n.token) + (n.rate ? ' <span class="tk2-mut">/' + esc(n.rate) + '</span>' : '') + '</td><td>' + (C.isStandard(n.token) ? 'shop <span class="tk2-mut">standard</span>' : 'custom · craft/salvage') + '</td><td class="tk2-r">' + (C.isStandard(n.token) ? '☐ ' + linkPend('order', 'order from a pinned shop — DATA cran') : '—') + '</td></tr>');
    });
    if (d.addonsEb > 0) rows.push('<tr><td>addons <span class="tk2-mut">×' + allAddonCount(a) + '</span></td><td>parts / grafts <span class="tk2-mut">(included above)</span></td><td class="tk2-r">+' + d.addonsEb + 'eb' + (d.addonDc ? ' · +' + d.addonDc + ' DC' : '') + '</td></tr>');
    rows.push('<tr><td>materials + addons</td><td>shop <span class="tk2-mut">pinned</span></td><td class="tk2-r">' + d.prodEb + 'eb</td></tr>');
    return rows.join('');
  }
  function addonChips(f, i, a) {
    return (f.addons || []).map(function (x, ai) { return '<span class="tk2-addchip">' + esc(x.name) + (a ? ' ' + addonEbTag(a, x.name) : '') + '<button class="tk2-addchip-x" data-delfaddon="' + i + '" data-ai="' + ai + '" title="remove">✕</button></span>'; }).join('');
  }
  // a walked-tree effect: breadcrumb + grade badge + unlocked actions; click to re-walk
  function featRowTree(f, i, a) {
    var g = TR.get(f.domain), crumb = TR.crumbs(g, f.path).join('  +  '), acts = TR.collect(g, f.path, 'act');
    return '<div class="tk2-feat" data-fi="' + i + '">' +
      '<div class="tk2-feat-top"><span class="tk2-fdom" data-editfeat="' + i + '">' + esc(f.domain) + '</span>' +
        '<span class="tk2-fg">g' + f.grade + '</span><span class="tk2-feat-sp"></span>' +
        '<button class="tk2-x" data-delfeat="' + i + '" title="remove">✕</button></div>' +
      '<div class="tk2-feat-cap tk2-fedit" data-editfeat="' + i + '">' + esc(crumb || '(empty)') + (acts.length ? ' <span class="tk2-mut">▸ ' + esc(acts.join(', ')) + '</span>' : '') + '</div>' +
      '<div class="tk2-feat-addons">' + addonChips(f, i, a) + '<button class="tk2-addchip-add" data-openpk data-pkkind="faddon" data-pkfi="' + i + '" title="addons tied to ' + esc(f.domain) + '">+ addon</button></div>' +
    '</div>';
  }
  function featRow(f, i, a) {
    if (f.path && f.path.length) return featRowTree(f, i, a);
    var an = C.anchorOf(f.domain, f.grade);
    var chips = addonChips(f, i, a);
    return '<div class="tk2-feat" data-fi="' + i + '">' +
      '<div class="tk2-feat-top">' +
        '<input class="tk2-fd" data-fi="' + i + '" list="tk2-domains" value="' + esc(f.domain) + '">' +
        '<span class="tk2-meter" data-fi="' + i + '">' + gradeMeter(f.grade) + '</span>' +
        '<span class="tk2-fg">g' + f.grade + '</span>' +
        '<span class="tk2-feat-sp"></span>' +
        '<button class="tk2-x" data-delfeat="' + i + '" title="remove">✕</button>' +
      '</div>' +
      '<div class="tk2-feat-cap">' + (an ? '<span class="tk2-cap">' + esc(an.bar) + '</span> <span class="tk2-mut">·</span> ' + skillLink(an.skill) : '<span class="tk2-mut">free domain (exotic) · Basic Tech</span>') + '</div>' +
      '<div class="tk2-feat-addons">' + chips + '<button class="tk2-addchip-add" data-openpk data-pkkind="faddon" data-pkfi="' + i + '" title="addons tied to ' + esc(f.domain) + '">+ addon</button></div>' +
    '</div>';
  }
  function tokenRow(kind, i, val, extra) {
    return '<span class="tk2-tok"><input list="tk2-tokens" data-tok="' + kind + '" data-ti="' + i + '" value="' + esc(val) + '" placeholder="token…">' +
      (extra || '') + '<button class="tk2-x" data-deltok="' + kind + '" data-ti="' + i + '">✕</button></span>';
  }

  function renderBench(pane) {
    var s = sec(pane), a = s.art, d = DERIVE(a);
    loadBuilder(pane); watchBuilder(pane);
    // adaptive plate: a slim strip when empty (no dead box), the image when set
    var plate = a.plate
      ? plateFig(a, d) + '<div class="tk2-plate-cap">plate anchored · <button class="app-btn tk2-annotate">⌖ ANNOTATE' + ((a.plate.pins || []).length ? ' (' + a.plate.pins.length + ')' : '') + '</button></div>'
      : '<div class="tk2-plate-slim"><span class="tk2-mut">PLATE</span><button class="app-btn tk2-press">PRESS</button></div>';
    // lignée: a LIVE link when the parent resolves to an artifact in the library
    var linLive = '';
    if (a.lineage && a.lineage.refines) {
      var ref = a.lineage.refines.toLowerCase();
      for (var li = 0; li < s.st.order.length; li++) { var pa = M.fromJSON(s.st.parts[s.st.order[li]]); if (pa && pa.id !== a.id && (pa.id.toLowerCase() === ref || pa.name.toLowerCase() === ref)) { linLive = ' ' + linkLive('artifact', pa.id, '→ open'); break; } }
    }
    pane.innerHTML =
      '<datalist id="tk2-domains">' + C.DOMAINS.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist>' +
      '<datalist id="tk2-tokens">' + C.allTokens().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<datalist id="tk2-genaddons">' + (C.GENERIC_ADDONS || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<div class="tk2-bar">' +
        '<button class="app-btn tk2-back">← LIBRARY</button>' +
        '<input class="tk2-name" data-f="name" value="' + esc(a.name) + '">' +
        '<button class="app-btn tk2-pill" data-openpk data-pkkind="class" title="class → crafting skill">' + esc(a.cls) + '</button>' +
        '<button class="app-btn tk2-pill" data-openpk data-pkkind="origin" title="build language">' + esc(a.origin) + '</button>' +
        '<label class="tk2-tier">tier <input type="number" min="1" max="6" data-f="tier" value="' + a.tier + '"></label>' +
        '<span class="tk2-bar-sp"></span>' +
        '<button class="app-btn tk2-doc">DOCUMENT</button>' +
        '<button class="app-btn tk2-copy">⧉ RECORD</button>' +
        '<button class="app-btn app-btn-danger tk2-del">DELETE</button>' +
      '</div>' +
      '<div class="tk2-body">' +
        '<div class="tk2-plate' + (a.plate ? '' : ' is-empty') + '">' + plate + '</div>' +
        '<div class="tk2-fiche">' +
          panel('EFFECTS', help('what the object DOES — ＋ effect picks a domain + grade; under each effect, its own addons (＋ addon).') +
            (a.feats.length ? a.feats.map(function (f, i) { return featRow(f, i, a); }).join('') : '<div class="tk2-empty-sm">No effect.</div>') +
            '<div class="tk2-effbtns"><button class="tk2-add tk2-add-eff" data-openpk data-pkkind="effect">＋ effect…</button><button class="tk2-add tk2-add-gen" data-openpk data-pkkind="gaddon" title="a generic / cross-cutting addon (miniaturization, hardened…) with its price">+ addon</button></div>' +
            (a.addons.length ? '<div class="tk2-genadd"><div class="tk2-genadd-h">generic addons</div>' + a.addons.map(function (x, i) { return '<div class="tk2-line"><input list="tk2-genaddons" data-addon="' + i + '" value="' + esc(x.name) + '" placeholder="generic addon…">' + (x.name ? addonEbTag(a, x.name) : '') + '<button class="tk2-x" data-deladdon="' + i + '">✕</button></div>'; }).join('') + '</div>' : ''), true) +
          panel('INTERFACES', help('what the object CONSUMES / HOSTS / what it slots into — pick standard tokens (buyable) or type a custom token.') + interfacesPanel(a)) +
          '<div class="tk2-details">' +
            '<div class="tk2-details-h">DETAILS</div>' +
            sub('flavor', '<textarea class="tk2-flavor" data-f="flavor" placeholder="the maker’s word — no mechanical effect…">' + esc(a.flavor) + '</textarea>') +
            '<div class="tk2-two">' +
              sub('limits', help('what holds it back — each limit lowers OP') + a.limits.map(function (l, i) { return '<div class="tk2-line"><input data-lim="' + i + '" value="' + esc(l.text) + '" placeholder="e.g. 30 min runtime"><button class="tk2-x" data-dellim="' + i + '">✕</button></div>'; }).join('') + '<button class="tk2-add" data-addlim>+ limit</button>') +
              sub('wearer mods', help('a bonus that flows onto the wearer’s sheet when the object is equipped') + a.mods.map(function (m, i) { return '<div class="tk2-line"><input class="tk2-mt" data-mod="' + i + '" data-k="target" value="' + esc(m.target) + '" placeholder="REF / Handgun…"><input class="tk2-mv" data-mod="' + i + '" data-k="value" value="' + esc(m.value) + '" placeholder="+3"><button class="tk2-x" data-delmod="' + i + '">✕</button></div>'; }).join('') + '<button class="tk2-add" data-openpk data-pkkind="wmod">＋ mod…</button>') +
            '</div>' +
            '<div class="tk2-two">' +
              sub('lineage', help('refine an existing object → DC drops each iteration') + '<div class="tk2-line"><input data-f="lin-ref" value="' + esc(a.lineage ? a.lineage.refines : '') + '" placeholder="refine… (name/ID)"><label class="tk2-tier">iter <input type="number" min="0" max="6" data-f="lin-steps" value="' + (a.lineage ? a.lineage.steps : 0) + '"></label></div><div class="tk2-mut">DC bonus −' + d.lineBonus + linLive + '</div>') +
              sub('latent · who knows', help('a secret hidden inside — check who’s in the know') + a.latent.map(latentRow).join('') + '<button class="tk2-add" data-addlat>+ latent</button>') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tk2-nomen"><div class="tk2-nomen-h">NOMENCLATURE</div><table class="tk2-nomen-t"><tbody>' + nomenclature(a, d) + '</tbody></table></div>' +
      '<div class="tk2-gate-wrap">' + gateStrip(a, s.builder) + '</div>' +
      productionBar(a, d) +
      (s.pick ? pickerModal(a, s.pick, s.builder) : '');

    // ── wiring ──
    pane.querySelector('.tk2-back').onclick = function () { commit(pane); backToLibrary(pane); };
    pane.querySelector('.tk2-doc').onclick = function () { commit(pane); s.st.view = 'document'; save(s.st); render(null, pane); };
    pane.querySelector('.tk2-copy').onclick = function () { try { navigator.clipboard.writeText(M.toJSON(a)); } catch (e) {} };
    pane.querySelector('.tk2-del').onclick = function () { var i = s.st.order.indexOf(a.id); if (i >= 0) s.st.order.splice(i, 1); delete s.st.parts[a.id]; backToLibrary(pane); };
    var pb = pane.querySelector('.tk2-press'); if (pb) pb.onclick = function () { s.mode = 'plate'; render(null, pane); };
    var ab = pane.querySelector('.tk2-annotate'); if (ab) ab.onclick = function () { s.mode = 'annotate'; s.pinSel = (a.plate && a.plate.pins && a.plate.pins.length) ? 0 : -1; render(null, pane); };

    // scalar fields (text) — update state + refresh derived only (keep focus)
    pane.querySelectorAll('[data-f]').forEach(function (inp) {
      inp.oninput = function () {
        var f = inp.getAttribute('data-f'), v = inp.value;
        if (f === 'tier') a.tier = Math.max(1, Math.min(6, +v || 1));
        else if (f === 'lin-ref') a.lineage = { refines: v, steps: a.lineage ? a.lineage.steps : 0 };
        else if (f === 'lin-steps') a.lineage = { refines: a.lineage ? a.lineage.refines : '', steps: Math.max(0, +v || 0) };
        else a[f] = v;
        commit(pane); refreshDerived(pane);   // no per-keystroke normalize (would replace a.ports)
      };
    });
    // feature domain text
    pane.querySelectorAll('.tk2-fd').forEach(function (inp) { inp.oninput = function () { a.feats[+inp.getAttribute('data-fi')].domain = inp.value.toUpperCase(); commit(pane); refreshDerived(pane); }; });
    // grade cells → structural re-render (anchor changes)
    pane.querySelectorAll('.tk2-meter .tk2-gc').forEach(function (c) {
      c.onclick = function () { var fi = +c.parentNode.getAttribute('data-fi'); a.feats[fi].grade = +c.getAttribute('data-g'); M.normalize(a); commit(pane); renderBench(pane); };
    });
    pane.querySelectorAll('[data-delfeat]').forEach(function (b) { b.onclick = function () { a.feats.splice(+b.getAttribute('data-delfeat'), 1); commit(pane); renderBench(pane); }; });
    // ── unified picker: any [data-openpk] opens the modal for its kind ──
    pane.querySelectorAll('[data-openpk]').forEach(function (b) { b.onclick = function () { s.pick = { kind: b.getAttribute('data-pkkind'), tkind: b.getAttribute('data-pktkind') || null, fi: b.hasAttribute('data-pkfi') ? +b.getAttribute('data-pkfi') : null }; renderBench(pane); }; });
    var pkc = pane.querySelector('[data-pkclose]'); if (pkc) pkc.onclick = function () { s.pick = null; renderBench(pane); };
    var scrim = pane.querySelector('[data-pkscrim]'); if (scrim) scrim.onclick = function (e) { if (e.target === scrim) { s.pick = null; renderBench(pane); } };
    var pickDone = function () { s.pick = null; M.normalize(a); commit(pane); renderBench(pane); };
    pane.querySelectorAll('[data-pkdom]').forEach(function (b) { b.onclick = function () { a.feats.push({ domain: b.getAttribute('data-pkdom'), grade: +b.getAttribute('data-pkg') }); pickDone(); }; });
    pane.querySelectorAll('[data-pktok]').forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-pktok'), k = s.pick && s.pick.tkind; if (k === 'needs') a.ports.needs.push({ token: v, rate: '' }); else if (k === 'fits') a.ports.fits.push(v); pickDone(); }; });
    pane.querySelectorAll('[data-pkcls]').forEach(function (b) { b.onclick = function () { a.cls = b.getAttribute('data-pkcls'); pickDone(); }; });
    pane.querySelectorAll('[data-pkorigin]').forEach(function (b) { b.onclick = function () { a.origin = b.getAttribute('data-pkorigin'); pickDone(); }; });
    var pushFaddon = function (name) { var fi = s.pick && s.pick.fi, f = a.feats[fi]; if (f) (f.addons || (f.addons = [])).push({ name: name, note: '' }); };
    pane.querySelectorAll('[data-pkfaddon]').forEach(function (b) { b.onclick = function () { pushFaddon(b.getAttribute('data-pkfaddon')); pickDone(); }; });
    pane.querySelectorAll('[data-pkgaddon]').forEach(function (b) { b.onclick = function () { a.addons.push({ name: b.getAttribute('data-pkgaddon'), note: '' }); pickDone(); }; });
    pane.querySelectorAll('[data-pkwmod]').forEach(function (b) { b.onclick = function () { a.mods.push({ target: b.getAttribute('data-pkwmod'), value: '', when: 'when worn' }); pickDone(); }; });
    pane.querySelectorAll('[data-pkcustom]').forEach(function (b) { b.onclick = function () { var box = b.parentNode.querySelector('.tk2-pk-cin'), v = box ? box.value.trim() : ''; if (!v) return; var kind = b.getAttribute('data-pkcustom'); if (kind === 'effect') a.feats.push({ domain: v.toUpperCase(), grade: 1 }); else if (kind === 'faddon') pushFaddon(v); else if (kind === 'gaddon') a.addons.push({ name: v, note: '' }); else if (kind === 'wmod') a.mods.push({ target: v, value: '', when: 'when worn' }); else { var k = s.pick && s.pick.tkind; if (k === 'needs') a.ports.needs.push({ token: v, rate: '' }); else if (k === 'fits') a.ports.fits.push(v); } pickDone(); }; });
    // ── effect-tree walk (inside the effect picker) ──
    pane.querySelectorAll('[data-treedom]').forEach(function (b) { b.onclick = function () { s.pick.treeDom = b.getAttribute('data-treedom'); s.pick.treePath = []; s.pick.treeScroll = null; renderBench(pane); }; });
    var tback = pane.querySelector('[data-treeback]'); if (tback) tback.onclick = function () { s.pick.treeDom = null; s.pick.treePath = []; s.pick.treeScroll = null; renderBench(pane); };
    pane.querySelectorAll('[data-treenode]').forEach(function (nd) { nd.onclick = function () { saveTreeScroll(pane, s); var g = TR.get(s.pick.treeDom); s.pick.treePath = TR.toggle(g, s.pick.treePath || [], nd.getAttribute('data-treenode')); renderBench(pane); }; });
    pane.querySelectorAll('[data-dial]').forEach(function (b) { b.onclick = function () { saveTreeScroll(pane, s); var g = TR.get(s.pick.treeDom), id = b.getAttribute('data-dial'), dd = +b.getAttribute('data-dd'), n = g.nodes[id], cur = TR.scaleOf(s.pick.treePath, id) || 1, mx = (n.scale && n.scale.max) || 3; s.pick.treePath = TR.setScale(s.pick.treePath, id, Math.max(1, Math.min(mx, cur + dd))); renderBench(pane); }; });
    var tdesc = pane.querySelector('[data-treedesc]');
    if (tdesc) pane.querySelectorAll('[data-treenode]').forEach(function (nd) { nd.onmouseenter = function () { var g = TR.get(s.pick.treeDom), n = g.nodes[nd.getAttribute('data-treenode')]; if (!n) return; tdesc.innerHTML = '<b>' + esc(n.label) + '</b>' + (n.cap ? ' — ' + esc(n.cap) : '') + (n.act ? ' <span class="tk2-tchip act">▸ ' + esc(n.act) + '</span>' : '') + (n.scale ? ' <span class="tk2-mut">◇ ° ' + esc(n.scale.per || 'dial') + '</span>' : '') + (n.add ? ' <span class="tk2-mut">□ stackable</span>' : '') + (n.tag ? ' <span class="tk2-mut">unlocks +' + esc(n.tag) + ' addons</span>' : '') + (n.need ? ' <span class="tk2-mut">(needs ' + esc(n.need) + ')</span>' : '') + (n.needsAll ? ' <span class="tk2-mut">⬡ needs all: ' + esc(n.needsAll.map(function (r) { return g.nodes[r] ? g.nodes[r].label : r; }).join(', ')) + '</span>' : ''); }; });
    var tadd = pane.querySelector('.tk2-treeadd'); if (tadd && !tadd.disabled) tadd.onclick = function () {
      var g = TR.get(s.pick.treeDom), path = s.pick.treePath || []; if (!path.length) return;
      var feat = { domain: s.pick.treeDom, grade: TR.grade(g, path), path: path };
      if (s.pick.editFi != null && a.feats[s.pick.editFi]) { feat.addons = a.feats[s.pick.editFi].addons || []; a.feats[s.pick.editFi] = feat; }
      else a.feats.push(feat);
      pickDone();
    };
    // click a walked-tree effect to re-open its tree, pre-walked
    pane.querySelectorAll('[data-editfeat]').forEach(function (el) { el.onclick = function () { var fi = +el.getAttribute('data-editfeat'), f = a.feats[fi]; s.pick = { kind: 'effect', treeDom: f.domain, treePath: (f.path || []).slice(), editFi: fi }; renderBench(pane); }; });
    // tokens (needs/fits/takes-accepts/holds simplified via interfacesPanel wiring)
    wireInterfaces(pane, a);
    // limits
    pane.querySelectorAll('[data-lim]').forEach(function (inp) { inp.oninput = function () { a.limits[+inp.getAttribute('data-lim')].text = inp.value; commit(pane); refreshDerived(pane); }; });
    pane.querySelector('[data-addlim]').onclick = function () { a.limits.push({ text: '' }); M.normalize(a); commit(pane); renderBench(pane); };
    pane.querySelectorAll('[data-dellim]').forEach(function (b) { b.onclick = function () { a.limits.splice(+b.getAttribute('data-dellim'), 1); commit(pane); renderBench(pane); }; });
    pane.querySelectorAll('[data-dellat]').forEach(function (b) { b.onclick = function () { a.latent.splice(+b.getAttribute('data-dellat'), 1); commit(pane); renderBench(pane); }; });
    // mods
    pane.querySelectorAll('[data-mod]').forEach(function (inp) { inp.oninput = function () { a.mods[+inp.getAttribute('data-mod')][inp.getAttribute('data-k')] = inp.value; commit(pane); refreshDerived(pane); }; });
    pane.querySelectorAll('[data-delmod]').forEach(function (b) { b.onclick = function () { a.mods.splice(+b.getAttribute('data-delmod'), 1); commit(pane); renderBench(pane); }; });
    // generic addons (object-level) — added via the gaddon popup, editable inline afterwards
    pane.querySelectorAll('[data-addon]').forEach(function (inp) { inp.oninput = function () { a.addons[+inp.getAttribute('data-addon')].name = inp.value; commit(pane); }; });
    pane.querySelectorAll('[data-deladdon]').forEach(function (b) { b.onclick = function () { a.addons.splice(+b.getAttribute('data-deladdon'), 1); commit(pane); renderBench(pane); }; });
    // per-effect addons (chips)
    pane.querySelectorAll('[data-delfaddon]').forEach(function (b) { b.onclick = function () { var fi = +b.getAttribute('data-delfaddon'), ai = +b.getAttribute('data-ai'), f = a.feats[fi]; if (f && f.addons) { f.addons.splice(ai, 1); if (!f.addons.length) delete f.addons; } commit(pane); renderBench(pane); }; });
    // latent
    pane.querySelectorAll('[data-lat]').forEach(function (inp) { inp.oninput = function () { a.latent[+inp.getAttribute('data-lat')].text = inp.value; commit(pane); }; });
    pane.querySelectorAll('[data-latwho]').forEach(function (cb) { cb.onchange = function () { var li = +cb.getAttribute('data-lat'), who = cb.getAttribute('data-latwho'), arrw = a.latent[li].who, k = arrw.indexOf(who); if (cb.checked && k < 0) arrw.push(who); if (!cb.checked && k >= 0) arrw.splice(k, 1); commit(pane); }; });
    pane.querySelector('[data-addlat]').onclick = function () { a.latent.push({ text: '', who: ['maker', 'GM'] }); M.normalize(a); commit(pane); renderBench(pane); };
    // hyperlink navigation — LIVE links (data-lk) resolve now; pending ones are inert
    pane.querySelectorAll('.tk2-link[data-lk]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.getAttribute('data-lk') === 'artifact') { var pa = M.fromJSON(s.st.parts[el.getAttribute('data-lid')]); if (pa) { commit(pane); openArtifact(pane, pa); } }
      });
    });
    restoreTreeScroll(pane);
  }

  function panel(title, inner, hero) { return '<div class="tk2-panel' + (hero ? ' hero' : '') + '"><div class="tk2-panel-h">' + title + '</div><div class="tk2-panel-b">' + inner + '</div></div>'; }
  function sub(title, inner) { return '<div class="tk2-sub"><div class="tk2-sub-h">' + title + '</div><div class="tk2-sub-b">' + inner + '</div></div>'; }
  // ── hyperlink system: two states. LIVE = solid + ↗, navigates now. PENDING =
  // dashed + ◇, target arrives in a later cran (tooltip says which). ──
  function linkLive(kind, id, label) { return '<a class="tk2-link" data-lk="' + kind + '" data-lid="' + esc(id) + '">' + esc(label) + '</a>'; }
  function linkPend(label, note) { return '<span class="tk2-link pending" title="' + esc(note) + '">' + esc(label) + '</span>'; }
  function skillLink(name) { return linkPend(name, 'link to the character sheet — cran 2'); }
  function latentRow(x, i) {
    var who = M.WHO;
    return '<div class="tk2-line"><input data-lat="' + i + '" value="' + esc(x.text) + '" placeholder="secret hidden inside…"><span class="tk2-who">' +
      who.map(function (w) { return '<label><input type="checkbox" data-lat="' + i + '" data-latwho="' + w + '"' + (x.who.indexOf(w) >= 0 ? ' checked' : '') + '>' + w + '</label>'; }).join('') + '</span><button class="tk2-x" data-dellat="' + i + '">✕</button></div>';
  }
  function interfacesPanel(a) {
    var p = a.ports, out = '';
    out += '<div class="tk2-if"><span class="tk2-if-l" title="consumables + prerequisites">needs</span>' + p.needs.map(function (n, i) { return tokenRow('needs', i, n.token, '<input class="tk2-rate" data-tok="needs-rate" data-ti="' + i + '" value="' + esc(n.rate) + '" placeholder="/40h">'); }).join('') + '<button class="tk2-add" data-openpk data-pkkind="token" data-pktkind="needs">＋ token</button></div>';
    out += '<div class="tk2-if"><span class="tk2-if-l" title="what THIS object slots into">fits</span>' + p.fits.map(function (t, i) { return tokenRow('fits', i, t); }).join('') + '<button class="tk2-add" data-openpk data-pkkind="token" data-pktkind="fits">＋ token</button></div>';
    out += '<div class="tk2-if"><span class="tk2-if-l">holds</span>' + p.holds.map(function (hd, i) { return '<span class="tk2-tok"><input data-tok="holds-kind" data-ti="' + i + '" value="' + esc(hd.kind) + '" placeholder="data/patients…"><input data-tok="holds-cap" data-ti="' + i + '" value="' + esc(hd.cap) + '" placeholder="40MU"><button class="tk2-x" data-deltok="holds" data-ti="' + i + '">✕</button></span>'; }).join('') + '<button class="tk2-add" data-addtok="holds">+</button></div>';
    out += '<div class="tk2-if"><span class="tk2-if-l">takes</span>' + p.takes.map(function (t, i) { return '<span class="tk2-tok"><input data-tok="takes-slot" data-ti="' + i + '" value="' + esc(t.slot) + '" placeholder="tube"><input data-tok="takes-accepts" data-ti="' + i + '" value="' + esc(t.accepts.join(', ')) + '" placeholder="he-84, thermo-84"><button class="tk2-x" data-deltok="takes" data-ti="' + i + '">✕</button></span>'; }).join('') + '<button class="tk2-add" data-addtok="takes">+</button></div>';
    return out;
  }
  function wireInterfaces(pane, a) {
    // NB: read a.ports LIVE at event time — never capture it; normalize() replaces
    // the ports object, so a stale capture would orphan every edit (review HIGH).
    var reNom = function () { commit(pane); refreshDerived(pane); };
    pane.querySelectorAll('[data-tok]').forEach(function (inp) {
      inp.oninput = function () {
        var p = a.ports, kind = inp.getAttribute('data-tok'), i = +inp.getAttribute('data-ti'), v = inp.value;
        if (kind === 'needs') p.needs[i].token = v;
        else if (kind === 'needs-rate') p.needs[i].rate = v;
        else if (kind === 'fits') p.fits[i] = v;
        else if (kind === 'holds-kind') p.holds[i].kind = v;
        else if (kind === 'holds-cap') p.holds[i].cap = v;
        else if (kind === 'takes-slot') p.takes[i].slot = v;
        else if (kind === 'takes-accepts') p.takes[i].accepts = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        reNom();
      };
    });
    pane.querySelectorAll('[data-addtok]').forEach(function (b) {
      b.onclick = function () {
        var p = a.ports, kind = b.getAttribute('data-addtok');
        if (kind === 'needs') p.needs.push({ token: '', rate: '' });
        else if (kind === 'fits') p.fits.push('');
        else if (kind === 'holds') p.holds.push({ kind: '', cap: '' });
        else if (kind === 'takes') p.takes.push({ slot: '', accepts: [], n: 1 });
        M.normalize(a); commit(pane); renderBench(pane);
      };
    });
    pane.querySelectorAll('[data-deltok]').forEach(function (b) {
      b.onclick = function () { var kind = b.getAttribute('data-deltok'), i = +b.getAttribute('data-ti'); a.ports[kind].splice(i, 1); commit(pane); renderBench(pane); };
    });
  }
  function productionBar(a, d) {
    var dcTxt = d.lineBonus ? (d.dc + ' → ' + d.dcLineage) : ('' + d.dc);
    return '<div class="tk2-prod"><span class="tk2-prod-l">PRODUCTION</span>' +
      '<span class="tk2-stat">DC ' + dcTxt + '</span>' +
      '<span class="tk2-stat">OP ' + d.op + '</span>' +
      '<span class="tk2-stat">PROD ' + d.prodEb + 'eb + ' + d.prodHours + 'h</span>' +
      '<span class="tk2-stat">STREET ' + d.streetEb + 'eb</span>' +
      '<span class="tk2-bar-sp"></span></div>';
  }
  function refreshDerived(pane) {
    var s = sec(pane), a = s.art; if (!a) return;
    var d = DERIVE(a);
    var nb = pane.querySelector('.tk2-nomen-t tbody'); if (nb) nb.innerHTML = nomenclature(a, d);
    var pr = pane.querySelector('.tk2-prod'); if (pr) pr.outerHTML = productionBar(a, d);
    refreshGate(pane);
  }

  // ══════════════ MODE · PLATE (the press) ══════════════
  // ══════════════ PINS (cran 4) — annotations anchored on the plate, live-bound to the record ══════════════
  // The curated set of record fields a pin can bind to (the presse↔fiche bridge). Single
  // source of truth: resolvePin() just looks a key up here.
  function pinFields(a, d) {
    var out = [
      { key: 'name', label: 'NAME', val: a.name },
      { key: 'cls', label: 'CLASS', val: a.cls },
      { key: 'tier', label: 'TIER', val: 'T' + a.tier },
      { key: 'd:street', label: 'STREET', val: d.streetEb + 'eb' },
      { key: 'd:prod', label: 'PROD', val: d.prodEb + 'eb' },
      { key: 'd:dc', label: 'DC', val: d.dcLineage },
      { key: 'd:op', label: 'OP', val: d.op },
    ];
    a.feats.forEach(function (f, i) {
      var an = C.anchorOf(f.domain, f.grade);
      out.push({ key: 'feat:' + i + ':g', label: f.domain + ' · grade', val: 'g' + f.grade });
      if (an) out.push({ key: 'feat:' + i + ':bar', label: f.domain + ' · bar', val: an.bar });
    });
    a.mods.forEach(function (m, i) { if (m.target) out.push({ key: 'mod:' + i, label: 'mod ' + m.target, val: (m.value || '') + ' ' + m.target }); });
    a.ports.needs.forEach(function (n, i) { if (n.token) out.push({ key: 'need:' + i, label: 'consumes', val: n.token }); });
    return out;
  }
  function resolvePin(a, d, field) { var hit = pinFields(a, d).filter(function (x) { return x.key === field; })[0]; return hit ? String(hit.val) : ''; }
  function pinValue(a, d, pin) { return pin.field ? resolvePin(a, d, pin.field) : pin.text; }
  function pinText(a, d, pin) { var v = pinValue(a, d, pin); return (pin.label ? pin.label + (v ? ' · ' : '') : '') + v; }

  // Point and label move independently. The leader is a cranked line — horizontal
  // stubs at each end, the slant confined to the MIDDLE THIRD (technical-callout look).
  var PIN_W = 1000;
  function plateH(a) { var ar = ((a.plate && a.plate.h) || 1) / ((a.plate && a.plate.w) || 1); return Math.max(200, Math.round(PIN_W * ar)); }
  function platePinsSvg(a, d, editable, sel) {
    if (!a.plate) return '';
    var pins = a.plate.pins || [], W = PIN_W, H = plateH(a), fs = Math.round(W * 0.026), r = W * 0.008, g = W * 0.007;
    var body = '';
    pins.forEach(function (p, i) {
      var px = p.x * W, py = p.y * H, lx = p.lx * W, ly = p.ly * H;
      var ax = px + (lx - px) / 3, bx = px + 2 * (lx - px) / 3;   // crank: slant lives in the middle third of x
      var pts = px.toFixed(1) + ',' + py.toFixed(1) + ' ' + ax.toFixed(1) + ',' + py.toFixed(1) + ' ' + bx.toFixed(1) + ',' + ly.toFixed(1) + ' ' + lx.toFixed(1) + ',' + ly.toFixed(1);
      var right = lx >= px, anchor = right ? 'start' : 'end', tx = lx + (right ? 1 : -1) * fs * 0.4;
      var isSel = editable && i === sel, txt = esc(pinText(a, d, p)) || '⋯';
      body += '<polyline class="tk2-pin-lead" data-pinlead="' + i + '" points="' + pts + '" fill="none"/>';
      body += '<text class="tk2-pin-txt' + (isSel ? ' is-sel' : '') + '" data-pintxt="' + i + '" x="' + tx.toFixed(1) + '" y="' + (ly + fs * 0.34).toFixed(1) + '" font-size="' + fs + '" text-anchor="' + anchor + '">' + txt + '</text>';
      if (editable) body += '<rect class="tk2-pin-grip' + (isSel ? ' is-sel' : '') + '" x="' + (lx - g).toFixed(1) + '" y="' + (ly - g).toFixed(1) + '" width="' + (2 * g).toFixed(1) + '" height="' + (2 * g).toFixed(1) + '" data-pinlabel="' + i + '" style="cursor:move"/>';
      body += '<circle class="tk2-pin-dot' + (isSel ? ' is-sel' : '') + '" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r.toFixed(1) + '"' + (editable ? ' data-pin="' + i + '" style="cursor:grab"' : '') + '/>';
    });
    var addSurface = editable ? '<rect class="tk2-pin-add" x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent" style="cursor:crosshair"/>' : '';
    return '<svg class="tk2-pin-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + addSurface + body + '</svg>';
  }
  // the plate rendered WITH its annotations baked on — used read-only wherever the
  // image shows (library card, bench, document). '' when there's no plate.
  function plateFig(a, d) { return a.plate ? '<span class="tk2-plate-wrap"><img class="tk2-plate-img" src="' + a.plate.png + '" alt="">' + platePinsSvg(a, d, false, -1) + '</span>' : ''; }

  // ── ANNOTATE mode: full plate + draggable pins + a small editor for the selected pin ──
  function renderAnnotate(pane) {
    var s = sec(pane), a = s.art, d = DERIVE(a);
    if (!a.plate) { s.mode = null; return render(null, pane); }
    if (s.pinSel == null || s.pinSel >= (a.plate.pins || []).length) s.pinSel = (a.plate.pins || []).length ? 0 : -1;
    var sel = s.pinSel, pin = sel >= 0 ? a.plate.pins[sel] : null;
    var fields = pinFields(a, d);
    var editor;
    if (!pin) {
      editor = '<div class="tk2-annot-ed tk2-mut">Click the image to drop a pin.</div>';
    } else {
      var opts = '<option value=""' + (pin.field ? '' : ' selected') + '>— free text —</option>' +
        fields.map(function (f) { return '<option value="' + esc(f.key) + '"' + (pin.field === f.key ? ' selected' : '') + '>' + esc(f.label) + ' (' + esc(String(f.val)) + ')</option>'; }).join('');
      editor = '<div class="tk2-annot-ed">' +
        '<div class="tk2-annot-ed-h">PIN ' + (sel + 1) + '/' + a.plate.pins.length + '</div>' +
        '<label class="tk2-annot-f">label <input class="tk2-annot-lab" value="' + esc(pin.label) + '" placeholder="ex. DMG"></label>' +
        '<label class="tk2-annot-f">value <select class="tk2-annot-bind">' + opts + '</select></label>' +
        (pin.field ? '<div class="tk2-mut">→ ' + esc(resolvePin(a, d, pin.field) || '—') + ' <span class="tk2-mut">(live)</span></div>'
                   : '<label class="tk2-annot-f">text <input class="tk2-annot-txt" value="' + esc(pin.text) + '" placeholder="free value"></label>') +
        '<div class="tk2-annot-btns"><button class="app-btn tk2-annot-align" title="straighten the label onto the point row">⇔ align</button><button class="app-btn app-btn-danger tk2-annot-del">remove</button></div>' +
      '</div>';
    }
    pane.innerHTML =
      '<div class="tk2-bar"><button class="app-btn tk2-annot-back">← SHEET</button><span class="tk2-title">ANNOTATE</span>' +
        '<span class="tk2-bar-sp"></span><span class="tk2-mut">click = drop · drag the point ● or the label ▪ (independent) · align = straighten</span></div>' +
      '<div class="tk2-annot">' +
        '<div class="tk2-annot-stage"><img class="tk2-annot-img" src="' + a.plate.png + '" alt="">' + platePinsSvg(a, d, true, sel) + '</div>' +
        editor +
      '</div>';
    wireAnnotate(pane);
  }
  function defaultLabelX(x) { return Math.max(0, Math.min(1, x + (x < 0.5 ? 0.16 : -0.16))); }
  function pinLeadPoints(a, p) {
    var W = PIN_W, H = plateH(a), px = p.x * W, py = p.y * H, lx = p.lx * W, ly = p.ly * H, ax = px + (lx - px) / 3, bx = px + 2 * (lx - px) / 3;
    return px.toFixed(1) + ',' + py.toFixed(1) + ' ' + ax.toFixed(1) + ',' + py.toFixed(1) + ' ' + bx.toFixed(1) + ',' + ly.toFixed(1) + ' ' + lx.toFixed(1) + ',' + ly.toFixed(1);
  }
  function wireAnnotate(pane) {
    var s = sec(pane), a = s.art, d = DERIVE(a);
    var back = pane.querySelector('.tk2-annot-back'); if (back) back.onclick = function () { s.mode = null; commit(pane); render(null, pane); };
    var svg = pane.querySelector('.tk2-pin-svg'); if (!svg) return;
    // repaint just the selected pin's label text in place (keeps input focus while typing)
    var repaintText = function () { var p = a.plate.pins[s.pinSel]; if (!p) return; var t = svg.querySelector('text[data-pintxt="' + s.pinSel + '"]'); if (t) t.textContent = pinText(a, d, p) || '⋯'; };
    // always read the LIVE svg (it survives the drag; robust to zero-size rects in tests)
    var normEv = function (e) { var el = pane.querySelector('.tk2-pin-svg'); if (!el) return { x: 0, y: 0 }; var r = el.getBoundingClientRect(), w = r.width || 1, h = r.height || 1, c = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; }; return { x: c((e.clientX - r.left) / w), y: c((e.clientY - r.top) / h) }; };
    // generic drag: move fn mutates the pin from event coords + repaints the affected els; commit on release
    var drag = function (i, move) {
      return function (e) {
        e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); s.pinSel = i;
        var lead = svg.querySelector('polyline[data-pinlead="' + i + '"]'), text = svg.querySelector('text[data-pintxt="' + i + '"]');
        var mv = function (ev) { move(a.plate.pins[i], normEv(ev), lead, text); };
        var up = function () { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); commit(pane); renderAnnotate(pane); };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      };
    };
    var addS = svg.querySelector('.tk2-pin-add');
    if (addS) addS.onclick = function (e) { var n = normEv(e); a.plate.pins.push({ x: n.x, y: n.y, lx: defaultLabelX(n.x), ly: n.y, label: '', field: '', text: '' }); s.pinSel = a.plate.pins.length - 1; commit(pane); renderAnnotate(pane); };
    svg.querySelectorAll('[data-pin]').forEach(function (dot) {
      var i = +dot.getAttribute('data-pin');
      dot.onmousedown = drag(i, function (p, n, lead) { p.x = n.x; p.y = n.y; dot.setAttribute('cx', (n.x * PIN_W).toFixed(1)); dot.setAttribute('cy', (n.y * plateH(a)).toFixed(1)); if (lead) lead.setAttribute('points', pinLeadPoints(a, p)); });
    });
    svg.querySelectorAll('[data-pinlabel]').forEach(function (grip) {
      var i = +grip.getAttribute('data-pinlabel'), g = PIN_W * 0.007, fs = Math.round(PIN_W * 0.026);
      grip.onmousedown = drag(i, function (p, n, lead, text) {
        p.lx = n.x; p.ly = n.y; var W = PIN_W, H = plateH(a), lx = n.x * W, ly = n.y * H, px = p.x * W;
        grip.setAttribute('x', (lx - g).toFixed(1)); grip.setAttribute('y', (ly - g).toFixed(1));
        if (lead) lead.setAttribute('points', pinLeadPoints(a, p));
        if (text) { var right = lx >= px; text.setAttribute('x', (lx + (right ? 1 : -1) * fs * 0.4).toFixed(1)); text.setAttribute('y', (ly + fs * 0.34).toFixed(1)); text.setAttribute('text-anchor', right ? 'start' : 'end'); }
      });
    });
    var lab = pane.querySelector('.tk2-annot-lab'); if (lab) lab.oninput = function () { a.plate.pins[s.pinSel].label = lab.value; repaintText(); commit(pane); };
    var bind = pane.querySelector('.tk2-annot-bind'); if (bind) bind.onchange = function () { a.plate.pins[s.pinSel].field = bind.value; commit(pane); renderAnnotate(pane); };
    var txt = pane.querySelector('.tk2-annot-txt'); if (txt) txt.oninput = function () { a.plate.pins[s.pinSel].text = txt.value; repaintText(); commit(pane); };
    // "align" straightens only Y (label back onto the point's row), keeping its X
    var alg = pane.querySelector('.tk2-annot-align'); if (alg) alg.onclick = function () { var p = a.plate.pins[s.pinSel]; if (!p) return; p.ly = p.y; commit(pane); renderAnnotate(pane); };
    var del = pane.querySelector('.tk2-annot-del'); if (del) del.onclick = function () { a.plate.pins.splice(s.pinSel, 1); s.pinSel = a.plate.pins.length ? 0 : -1; commit(pane); renderAnnotate(pane); };
  }

  function renderPlate(pane) {
    var s = sec(pane), a = s.art;
    P.mount(pane, {
      onAttach: function (plate) { a.plate = { png: plate.png, w: plate.w, h: plate.h }; if (a.name === 'UNTITLED ARTIFACT' && plate.name) a.name = plate.name.toUpperCase(); M.normalize(a); s.mode = null; commit(pane); render(null, pane); },
      onExit: function () { s.mode = null; render(null, pane); },
    });
  }

  // ══════════════ SCREEN C · DOCUMENT (generated card) ══════════════
  function renderDocument(pane) {
    var s = sec(pane), a = s.art, d = DERIVE(a);
    var plate = a.plate ? plateFig(a, d) : '<div class="tk2-plate-empty"><div>— no plate —</div></div>';
    var feats = a.feats.map(function (f) {
      var ad = (f.addons || []).map(function (x) { return esc(x.name); }).join(', '), body;
      if (f.path && f.path.length) {
        var g = TR.get(f.domain); body = esc(f.domain) + ' g' + f.grade + ' <span class="tk2-mut">— ' + esc(TR.crumbs(g, f.path).join('  +  ')) + '</span>';
        var acts = TR.collect(g, f.path, 'act'); if (acts.length) body += ' <span class="tk2-mut">▸ ' + esc(acts.join(', ')) + '</span>';
      } else { var an = C.anchorOf(f.domain, f.grade); body = esc(f.domain) + ' g' + f.grade + (an ? ' <span class="tk2-mut">— ' + esc(an.bar) + '</span>' : ''); }
      return '<div class="tk2-docfeat">' + body + (ad ? ' <span class="tk2-mut">+ ' + ad + '</span>' : '') + '</div>';
    }).join('') || '<div class="tk2-mut">stats only</div>';
    var gen = a.addons.map(function (x) { return esc(x.name); }).filter(Boolean).join(', ');
    var ifs = [];
    a.ports.needs.forEach(function (n) { if (n.token) ifs.push('consumes: ' + esc(n.token) + (n.rate ? ' /' + esc(n.rate) : '')); });
    a.ports.fits.forEach(function (t) { if (t) ifs.push('fits: ' + esc(t)); });
    a.ports.takes.forEach(function (t) { ifs.push('takes: ' + esc(t.slot) + ' [' + esc(t.accepts.join(', ')) + ']'); });
    a.ports.holds.forEach(function (hd) { ifs.push('holds: ' + esc(hd.kind) + ' ' + esc(hd.cap)); });
    var pub = a.latent.filter(function (x) { return x.who.indexOf('public') >= 0; });
    pane.innerHTML =
      '<div class="tk2-bar"><button class="app-btn tk2-back">← SHEET</button><span class="tk2-title">DOCUMENT</span>' +
        '<span class="tk2-bar-sp"></span><span class="tk2-mut">player view — non-public fields hidden</span></div>' +
      '<div class="tk2-doc-card">' +
        '<div class="tk2-doc-head"><span>' + esc(a.name) + '</span><span>' + esc(a.cls) + ' · tier ' + a.tier + '</span></div>' +
        '<div class="tk2-doc-plate">' + plate + '</div>' +
        (a.flavor ? '<div class="tk2-doc-flavor">' + esc(a.flavor) + '</div>' : '') +
        (gen ? '<div class="tk2-doc-flavor tk2-mut">addons: ' + gen + '</div>' : '') +
        '<div class="tk2-doc-body"><div class="tk2-doc-col">' + feats + '</div>' +
          '<div class="tk2-doc-col">' + (ifs.length ? ifs.map(function (x) { return '<div>' + x + '</div>'; }).join('') : '<span class="tk2-mut">no interface</span>') +
          (pub.length ? pub.map(function (x) { return '<div>latent: ' + esc(x.text) + '</div>'; }).join('') : '') + '</div></div>' +
        '<div class="tk2-doc-foot">DC ' + d.dcLineage + ' · OP ' + d.op + ' · PROD ' + d.prodEb + 'eb · STREET ' + d.streetEb + 'eb</div>' +
      '</div>';
    pane.querySelector('.tk2-back').onclick = function () { s.st.view = 'bench'; save(s.st); render(null, pane); };
  }

  window.TechSection = { render: render, _lib: { store: store, DERIVE: DERIVE, nomenclature: nomenclature, skillsRequired: skillsRequired } };
})();
