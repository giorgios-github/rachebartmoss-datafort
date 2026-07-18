/* app-tech-section.js — TECH section orchestrator (cran 1).
   Three screens: BIBLIOTHÈQUE → ÉTABLI (dense console) → DOCUMENT. The press
   (window.TechPress) is the PLATE mode of the bench, not a screen.
   Exposes window.TechSection { render(tab, pane) } — the app-shell entry.
   Depends on TechArtifact (model), TechCatalog (content), TechPress (plate). */
(function () {
  'use strict';
  var M = window.TechArtifact, C = window.TechCatalog, P = window.TechPress;
  var LS = 'bartmoss_tech_artifacts';
  var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var isKnown = function (d) { return C.isKnownDomain(d); };
  var DERIVE = function (a) { return M.derive(a, { isKnownDomain: isKnown, addonPrice: C.addonPrice }); };
  function addonEbTag(a, name) { var eb = M.addonEb(a, name, { addonPrice: C.addonPrice }); var e = C.addonPrice(name); var scaled = !!(e && e.mult != null); return '<span class="tk2-addeb" title="' + (scaled ? 'coût proportionnel à la complexité de l’objet' : 'coût de l’addon') + '">' + (scaled ? '~' : '') + eb + 'eb</span>'; }
  function addonPriceStr(a, name) { var eb = M.addonEb(a, name, { addonPrice: C.addonPrice }); var e = C.addonPrice(name); return ((e && e.mult != null) ? '~' : '') + eb + 'eb' + ((e && e.mult != null) ? ' · ∝ complexité' : ''); }
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
      s.builder = (hit && hit.json) ? { role: 'player', name: hit.json.handle || hit.json.name || 'toi', skills: skillMap(hit.json.skills), targets: sheetTargets(hit.json) } : { role: 'player', none: true, targets: sheetTargets(null) };
      refreshGate(pane);
    }).catch(function () { s.builder = { role: 'player', none: true, targets: sheetTargets(null) }; refreshGate(pane); });
  }
  function gateStrip(a, builder) {
    if (!builder) return '<div class="tk2-gate is-load"><span class="tk2-mut">gating… (lecture de ta feuille)</span></div>';
    if (builder.role === 'gm') return '<div class="tk2-gate is-gm"><span class="tk2-gate-v">MJ · FIAT</span> <span class="tk2-mut">construction libre — le gating s’applique aux joueurs techies</span></div>';
    if (builder.none) return '<div class="tk2-gate is-none"><span class="tk2-gate-v">?</span> aucune feuille — <span class="tk2-mut">requiert : ' + esc(skillsRequired(a).join(' · ')) + '</span></div>';
    var g = GATE(a, builder.skills);
    var verdict = g.buildable ? (g.pushes.length ? '⚠ PUSH' : '✓ CONSTRUCTIBLE') : '✗ VERROUILLÉ';
    var rows = g.rows.map(function (r) {
      var ic = r.status === 'ok' ? '✓' : r.status === 'push' ? '⚠ +' + r.push : '✗';
      return '<span class="tk2-gr tk2-gr-' + r.status + '">' + esc(r.skill) + ' <b>' + r.have + '</b>/' + r.need + ' ' + ic + (r.isClass ? ' <span class="tk2-mut">classe</span>' : '') + '</span>';
    }).join('');
    var tail = g.locks.length ? '<span class="tk2-mut">il te manque : ' + esc(g.locks.join(', ')) + '</span>' : (g.instability ? '<span class="tk2-mut">instabilité +' + g.instability + '</span>' : '');
    return '<div class="tk2-gate tk2-gate-' + (g.buildable ? (g.pushes.length ? 'push' : 'ok') : 'locked') + '"><span class="tk2-gate-h">' + esc(builder.name || 'toi') + '</span><span class="tk2-gate-v">' + verdict + '</span><span class="tk2-gate-rows">' + rows + '</span>' + tail + '</div>';
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
  var ORIGINS = [['HANDMADE', 'bricolé — visserie dépareillée'], ['SALVAGE', 'récupéré — vis de donneur'], ['CORP PULL', 'arraché au corpo — torx'], ['FACTORY', 'usine — visserie captive']];
  function effectBody(a) {
    var sug = C.suggestFor(a.cls).domains, body = '';
    if (sug.length) body += '<div class="tk2-pk-sec">SUGGÉRÉ POUR ' + esc(a.cls.toUpperCase()) + '</div>' + domainTable(sug);
    body += '<div class="tk2-pk-sec">TOUS LES EFFETS</div>' + domainTable(C.DOMAINS);
    body += '<div class="tk2-pk-sec">DOMAINE EXOTIQUE</div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="nom du domaine…"><button class="tk2-chip" data-pkcustom="effect">+ ajouter (g1)</button></div>';
    return body;
  }
  function tokenBody(a, tkind) {
    var T = C.TOKENS, groups = tkind === 'needs' ? [['munitions', 'ammo'], ['alimentation', 'power'], ['consommables', 'consumable']] : [['montures', 'mount'], ['munitions', 'ammo'], ['prises', 'port'], ['formats', 'format']];
    var tcell = function (t, kind) { return pickCell('data-pktok', t, kind + (C.isStandard(t) ? ' · shop' : ' · custom')); };
    var sugT = C.suggestFor(a.cls).tokens.filter(function (t) { return groups.some(function (g) { return T[g[1]].indexOf(t) >= 0; }); });
    var body = '';
    if (sugT.length) body += '<div class="tk2-pk-sec">SUGGÉRÉ POUR ' + esc(a.cls.toUpperCase()) + '</div>' + pickGrid(sugT.map(function (t) { return tcell(t, tokenKind(t)); }).join(''));
    groups.forEach(function (g) { body += '<div class="tk2-pk-sec">' + g[0].toUpperCase() + '</div>' + pickGrid(T[g[1]].map(function (t) { return tcell(t, KIND_LABEL[g[1]]); }).join('')); });
    body += '<div class="tk2-pk-sec">CUSTOM</div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="jeton custom…"><button class="tk2-chip" data-pkcustom="token">+ ajouter</button></div>';
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
    var body = '<div class="tk2-pk-sec">' + esc(f.domain) + (fam ? '' : ' · générique') + '</div>' + pickGrid(list.map(function (m) { return pickCell('data-pkfaddon', m, addonPriceStr(a, m)); }).join(''));
    body += '<div class="tk2-pk-sec">CUSTOM <span class="tk2-mut">— défaut ' + M.TUNING.addon.eb + 'eb</span></div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="addon custom…"><button class="tk2-chip" data-pkcustom="faddon">+ ajouter</button></div>';
    return body;
  }
  // GENERIC-ADDON picker — the transverse addons (miniaturisation, durci…) with their
  // computed price (fixed, or ~proportional to the object's complexity) + a custom field.
  function gaddonBody(a) {
    var body = '<div class="tk2-pk-sec">ADDONS GÉNÉRIQUES</div>' + pickGrid(C.GENERIC_ADDONS.map(function (m) { return pickCell('data-pkgaddon', m, addonPriceStr(a, m)); }).join(''));
    body += '<div class="tk2-pk-sec">CUSTOM <span class="tk2-mut">— défaut ' + M.TUNING.addon.eb + 'eb</span></div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="addon custom…"><button class="tk2-chip" data-pkcustom="gaddon">+ ajouter</button></div>';
    return body;
  }
  // WEARER-MOD picker — a bonus fed to the sheet, bound to one of the wearer's own
  // stats / custom stats / skills (read live off their sheet). Falls back to stats-only.
  function wmodBody(a, builder) {
    var T = (builder && builder.targets) || sheetTargets(null);
    var body = '<div class="tk2-pk-sec">STATS</div>' + pickGrid(T.stats.map(function (t) { return pickCell('data-pkwmod', t, 'stat'); }).join(''));
    if (T.customStats.length) body += '<div class="tk2-pk-sec">STATS CUSTOM</div>' + pickGrid(T.customStats.map(function (t) { return pickCell('data-pkwmod', t, 'stat custom'); }).join(''));
    if (T.skills.length) body += '<div class="tk2-pk-sec">SKILLS DE LA FEUILLE</div>' + pickGrid(T.skills.map(function (t) { return pickCell('data-pkwmod', t, 'skill'); }).join(''));
    else body += '<div class="tk2-pk-sec">SKILLS</div><div class="tk2-help">aucune feuille lue — passe en joueur techie ou ajoute un skill custom ci-dessous.</div>';
    body += '<div class="tk2-pk-sec">SKILL CUSTOM</div><div class="tk2-pk-custom"><input class="tk2-pk-cin" placeholder="nom du skill…"><button class="tk2-chip" data-pkcustom="wmod">+ ajouter</button></div>';
    return body;
  }
  // effect PICKER (popup): every domain with its full grade ladder — you SEE what a
  // higher grade gives, and can pick that grade directly. Suggested-for-class on top.
  function domainTable(list) {
    var head = '<tr><th class="tk2-tcorner">DOMAINE</th>';
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
  var KIND_LABEL = { ammo: 'munition', mount: 'monture', power: 'alimentation', port: 'prise', format: 'format', consumable: 'consommable' };
  function tokenKind(t) { var T = C.TOKENS, k; for (k in T) if (T[k].indexOf(t) >= 0) return KIND_LABEL[k] || k; return 'custom'; }
  function pickerModal(a, pick, builder) {
    var title, body;
    if (pick.kind === 'effect') { title = 'CHOISIR UN EFFET <span class="tk2-mut">— clique un grade</span>'; body = effectBody(a); }
    else if (pick.kind === 'token') { title = 'AJOUTER <span class="tk2-mut">— ' + esc(pick.tkind) + '</span>'; body = tokenBody(a, pick.tkind); }
    else if (pick.kind === 'faddon') { title = 'ADDON <span class="tk2-mut">— lié à l’effet</span>'; body = faddonBody(a, pick.fi); }
    else if (pick.kind === 'gaddon') { title = 'ADDON GÉNÉRIQUE <span class="tk2-mut">— transverse</span>'; body = gaddonBody(a); }
    else if (pick.kind === 'wmod') { title = 'BONUS AU PORTEUR <span class="tk2-mut">— cible une stat / un skill</span>'; body = wmodBody(a, builder); }
    else if (pick.kind === 'class') { title = 'CLASSE DE L’OBJET'; body = classBody(a); }
    else { title = 'ORIGINE'; body = originBody(a); }
    return '<div class="tk2-modal" data-pkscrim><div class="tk2-modal-box"><div class="tk2-modal-h">' + title + '<span class="tk2-bar-sp"></span><span class="tk2-modal-x" data-pkclose>✕</span></div><div class="tk2-modal-b">' + body + '</div></div></div>';
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
    var view = s.st.view || 'library';
    if (view === 'bench' && s.art) { loadBuilder(pane, true); return renderBench(pane); }
    if (view === 'document' && s.art) return renderDocument(pane);
    return renderLibrary(pane);
  }

  // ══════════════ SCREEN A · LIBRARY ══════════════
  function libCard(a, kind) {
    var d = DERIVE(a), doms = a.feats.map(function (f) { return f.domain + ' g' + f.grade; }).join(' · ') || (Object.keys(a.stats).length ? 'stats only' : '—');
    return '<button class="tk2-card" data-open="' + esc(a.id) + '" data-kind="' + kind + '">' +
      '<span class="tk2-card-h"><span class="tk2-card-n">' + esc(a.name) + '</span><span class="tk2-card-c">' + esc(a.cls) + ' · t' + a.tier + '</span></span>' +
      '<span class="tk2-card-d">' + esc(doms) + '</span>' +
      '<span class="tk2-card-m">DC ' + d.dcLineage + ' · OP ' + d.op + ' · ' + d.streetEb + 'eb</span></button>';
  }
  function renderLibrary(pane) {
    var s = sec(pane), st = s.st;
    var mine = st.order.map(function (id) { return M.fromJSON(st.parts[id]); }).filter(Boolean);
    pane.innerHTML =
      '<div class="tk2-bar"><span class="tk2-title">ATELIER TECH</span>' +
        '<span class="tk2-bar-sp"></span>' +
        '<input class="tk2-imp" placeholder="coller un record une-ligne…">' +
        '<button class="app-btn tk2-imp-go">IMPORTER</button>' +
        '<button class="app-btn tk2-new">+ NOUVEL OBJET</button></div>' +
      '<div class="tk2-lib">' +
        '<div class="tk2-sect">TES OBJETS <span class="tk2-count">' + mine.length + '</span></div>' +
        (mine.length ? '<div class="tk2-grid">' + mine.map(function (a) { return libCard(a, 'mine'); }).join('') + '</div>'
          : '<div class="tk2-empty">Aucun objet. Pars d’un preset ci-dessous, ou crée un objet vierge.</div>') +
        '<div class="tk2-sect">PRESETS <span class="tk2-count">' + C.PRESETS.length + '</span> <span class="tk2-hint">— ouvre-en un pour voir comment il est bâti, puis bidouille</span></div>' +
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
      var src = g.grade <= 2 ? 'shop / marché noir' : g.grade <= 3 ? 'marché noir (fixer)' : 'salvage / signature';
      rows.push('<tr><td>composant ' + esc(g.domain) + ' g' + g.grade + '</td><td>' + src + (g.exotic ? ' · <b>exotique</b>' : '') + '</td><td class="tk2-r">☐</td></tr>');
    });
    a.ports.needs.forEach(function (n) {
      if (!n.token) return;
      rows.push('<tr><td>' + esc(n.token) + (n.rate ? ' <span class="tk2-mut">/' + esc(n.rate) + '</span>' : '') + '</td><td>' + (C.isStandard(n.token) ? 'shop <span class="tk2-mut">standard</span>' : 'custom · craft/salvage') + '</td><td class="tk2-r">' + (C.isStandard(n.token) ? '☐ ' + linkPend('commander', 'commande vers un shop épinglé — cran DATA') : '—') + '</td></tr>');
    });
    if (d.addonsEb > 0) rows.push('<tr><td>addons <span class="tk2-mut">×' + allAddonCount(a) + '</span></td><td>pièces / greffes <span class="tk2-mut">(inclus ci-dessus)</span></td><td class="tk2-r">+' + d.addonsEb + 'eb' + (d.addonDc ? ' · +' + d.addonDc + ' DC' : '') + '</td></tr>');
    rows.push('<tr><td>matériaux + addons</td><td>shop <span class="tk2-mut">épinglé</span></td><td class="tk2-r">' + d.prodEb + 'eb</td></tr>');
    return rows.join('');
  }
  function featRow(f, i, a) {
    var an = C.anchorOf(f.domain, f.grade);
    var chips = (f.addons || []).map(function (x, ai) { return '<span class="tk2-addchip">' + esc(x.name) + (a ? ' ' + addonEbTag(a, x.name) : '') + '<button class="tk2-addchip-x" data-delfaddon="' + i + '" data-ai="' + ai + '" title="retirer">✕</button></span>'; }).join('');
    return '<div class="tk2-feat" data-fi="' + i + '">' +
      '<div class="tk2-feat-top">' +
        '<input class="tk2-fd" data-fi="' + i + '" list="tk2-domains" value="' + esc(f.domain) + '">' +
        '<span class="tk2-meter" data-fi="' + i + '">' + gradeMeter(f.grade) + '</span>' +
        '<span class="tk2-fg">g' + f.grade + '</span>' +
        '<span class="tk2-feat-sp"></span>' +
        '<button class="tk2-x" data-delfeat="' + i + '" title="retirer">✕</button>' +
      '</div>' +
      '<div class="tk2-feat-cap">' + (an ? '<span class="tk2-cap">' + esc(an.bar) + '</span> <span class="tk2-mut">·</span> ' + skillLink(an.skill) : '<span class="tk2-mut">domaine libre (exotique) · Basic Tech</span>') + '</div>' +
      '<div class="tk2-feat-addons">' + chips + '<button class="tk2-addchip-add" data-openpk data-pkkind="faddon" data-pkfi="' + i + '" title="addons liés à ' + esc(f.domain) + '">+ addon</button></div>' +
    '</div>';
  }
  function tokenRow(kind, i, val, extra) {
    return '<span class="tk2-tok"><input list="tk2-tokens" data-tok="' + kind + '" data-ti="' + i + '" value="' + esc(val) + '" placeholder="jeton…">' +
      (extra || '') + '<button class="tk2-x" data-deltok="' + kind + '" data-ti="' + i + '">✕</button></span>';
  }

  function renderBench(pane) {
    var s = sec(pane), a = s.art, d = DERIVE(a);
    loadBuilder(pane); watchBuilder(pane);
    // adaptive plate: a slim strip when empty (no dead box), the image when set
    var plate = a.plate
      ? '<img class="tk2-plate-img" src="' + a.plate.png + '" alt=""><div class="tk2-plate-cap">planche ancrée · annotations cran 5</div>'
      : '<div class="tk2-plate-slim"><span class="tk2-mut">PLANCHE</span><button class="app-btn tk2-press">PRESSER</button></div>';
    // lignée: a LIVE link when the parent resolves to an artifact in the library
    var linLive = '';
    if (a.lineage && a.lineage.refines) {
      var ref = a.lineage.refines.toLowerCase();
      for (var li = 0; li < s.st.order.length; li++) { var pa = M.fromJSON(s.st.parts[s.st.order[li]]); if (pa && pa.id !== a.id && (pa.id.toLowerCase() === ref || pa.name.toLowerCase() === ref)) { linLive = ' ' + linkLive('artifact', pa.id, '→ ouvrir'); break; } }
    }
    pane.innerHTML =
      '<datalist id="tk2-domains">' + C.DOMAINS.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist>' +
      '<datalist id="tk2-tokens">' + C.allTokens().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<datalist id="tk2-genaddons">' + (C.GENERIC_ADDONS || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<div class="tk2-bar">' +
        '<button class="app-btn tk2-back">← BIBLIOTHÈQUE</button>' +
        '<input class="tk2-name" data-f="name" value="' + esc(a.name) + '">' +
        '<button class="app-btn tk2-pill" data-openpk data-pkkind="class" title="classe → skill de craft">' + esc(a.cls) + '</button>' +
        '<button class="app-btn tk2-pill" data-openpk data-pkkind="origin" title="langage de fabrication">' + esc(a.origin) + '</button>' +
        '<label class="tk2-tier">tier <input type="number" min="1" max="6" data-f="tier" value="' + a.tier + '"></label>' +
        '<span class="tk2-bar-sp"></span>' +
        '<button class="app-btn tk2-doc">DOCUMENT</button>' +
        '<button class="app-btn tk2-copy">⧉ RECORD</button>' +
        '<button class="app-btn app-btn-danger tk2-del">SUPPRIMER</button>' +
      '</div>' +
      '<div class="tk2-body">' +
        '<div class="tk2-plate' + (a.plate ? '' : ' is-empty') + '">' + plate + '</div>' +
        '<div class="tk2-fiche">' +
          panel('EFFETS', help('ce que l’objet FAIT — ＋ effet pioche un domaine + grade ; sous chaque effet, ses addons propres (＋ addon).') +
            (a.feats.length ? a.feats.map(function (f, i) { return featRow(f, i, a); }).join('') : '<div class="tk2-empty-sm">Aucun effet.</div>') +
            '<div class="tk2-effbtns"><button class="tk2-add tk2-add-eff" data-openpk data-pkkind="effect">＋ effet…</button><button class="tk2-add tk2-add-gen" data-openpk data-pkkind="gaddon" title="un addon générique / transverse (miniaturisation, durci…) avec son prix">+ addon</button></div>' +
            (a.addons.length ? '<div class="tk2-genadd"><div class="tk2-genadd-h">addons génériques</div>' + a.addons.map(function (x, i) { return '<div class="tk2-line"><input list="tk2-genaddons" data-addon="' + i + '" value="' + esc(x.name) + '" placeholder="addon générique…">' + (x.name ? addonEbTag(a, x.name) : '') + '<button class="tk2-x" data-deladdon="' + i + '">✕</button></div>'; }).join('') + '</div>' : ''), true) +
          panel('INTERFACES', help('ce que l’objet CONSOMME / ACCUEILLE / dans quoi il s’insère — pioche des jetons standards (achetables) ou tape un jeton custom.') + interfacesPanel(a)) +
          '<div class="tk2-details">' +
            '<div class="tk2-details-h">DÉTAILS</div>' +
            sub('flavor', '<textarea class="tk2-flavor" data-f="flavor" placeholder="le mot du maker — aucun effet mécanique…">' + esc(a.flavor) + '</textarea>') +
            '<div class="tk2-two">' +
              sub('limites', help('ce qui le bride — chaque limite baisse l’OP') + a.limits.map(function (l, i) { return '<div class="tk2-line"><input data-lim="' + i + '" value="' + esc(l.text) + '" placeholder="ex. 30 min d’autonomie"><button class="tk2-x" data-dellim="' + i + '">✕</button></div>'; }).join('') + '<button class="tk2-add" data-addlim>+ limite</button>') +
              sub('wearer mods', help('un bonus qui rejaillit sur la feuille du porteur quand l’objet est équipé') + a.mods.map(function (m, i) { return '<div class="tk2-line"><input class="tk2-mt" data-mod="' + i + '" data-k="target" value="' + esc(m.target) + '" placeholder="REF / Handgun…"><input class="tk2-mv" data-mod="' + i + '" data-k="value" value="' + esc(m.value) + '" placeholder="+3"><button class="tk2-x" data-delmod="' + i + '">✕</button></div>'; }).join('') + '<button class="tk2-add" data-openpk data-pkkind="wmod">＋ mod…</button>') +
            '</div>' +
            '<div class="tk2-two">' +
              sub('lignée', help('raffine un objet existant → le DC baisse à chaque itération') + '<div class="tk2-line"><input data-f="lin-ref" value="' + esc(a.lineage ? a.lineage.refines : '') + '" placeholder="raffine… (nom/ID)"><label class="tk2-tier">itér <input type="number" min="0" max="6" data-f="lin-steps" value="' + (a.lineage ? a.lineage.steps : 0) + '"></label></div><div class="tk2-mut">bonus DC −' + d.lineBonus + linLive + '</div>') +
              sub('latent · qui sait', help('un secret caché dedans — coche qui est au courant') + a.latent.map(latentRow).join('') + '<button class="tk2-add" data-addlat>+ latent</button>') +
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
  }

  function panel(title, inner, hero) { return '<div class="tk2-panel' + (hero ? ' hero' : '') + '"><div class="tk2-panel-h">' + title + '</div><div class="tk2-panel-b">' + inner + '</div></div>'; }
  function sub(title, inner) { return '<div class="tk2-sub"><div class="tk2-sub-h">' + title + '</div><div class="tk2-sub-b">' + inner + '</div></div>'; }
  // ── hyperlink system: two states. LIVE = solid + ↗, navigates now. PENDING =
  // dashed + ◇, target arrives in a later cran (tooltip says which). ──
  function linkLive(kind, id, label) { return '<a class="tk2-link" data-lk="' + kind + '" data-lid="' + esc(id) + '">' + esc(label) + '</a>'; }
  function linkPend(label, note) { return '<span class="tk2-link pending" title="' + esc(note) + '">' + esc(label) + '</span>'; }
  function skillLink(name) { return linkPend(name, 'lien vers la feuille du perso — cran 2'); }
  function latentRow(x, i) {
    var who = M.WHO;
    return '<div class="tk2-line"><input data-lat="' + i + '" value="' + esc(x.text) + '" placeholder="secret caché dedans…"><span class="tk2-who">' +
      who.map(function (w) { return '<label><input type="checkbox" data-lat="' + i + '" data-latwho="' + w + '"' + (x.who.indexOf(w) >= 0 ? ' checked' : '') + '>' + w + '</label>'; }).join('') + '</span><button class="tk2-x" data-dellat="' + i + '">✕</button></div>';
  }
  function interfacesPanel(a) {
    var p = a.ports, out = '';
    out += '<div class="tk2-if"><span class="tk2-if-l" title="consommables + prérequis">needs</span>' + p.needs.map(function (n, i) { return tokenRow('needs', i, n.token, '<input class="tk2-rate" data-tok="needs-rate" data-ti="' + i + '" value="' + esc(n.rate) + '" placeholder="/40h">'); }).join('') + '<button class="tk2-add" data-openpk data-pkkind="token" data-pktkind="needs">＋ jeton</button></div>';
    out += '<div class="tk2-if"><span class="tk2-if-l" title="ce dans quoi CET objet s’insère">fits</span>' + p.fits.map(function (t, i) { return tokenRow('fits', i, t); }).join('') + '<button class="tk2-add" data-openpk data-pkkind="token" data-pktkind="fits">＋ jeton</button></div>';
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
    var plate = a.plate ? '<img class="tk2-plate-img" src="' + a.plate.png + '" alt="">' : '<div class="tk2-plate-empty"><div>— pas de planche —</div></div>';
    var feats = a.feats.map(function (f) { var an = C.anchorOf(f.domain, f.grade); var ad = (f.addons || []).map(function (x) { return esc(x.name); }).join(', '); return '<div class="tk2-docfeat">' + esc(f.domain) + ' g' + f.grade + (an ? ' <span class="tk2-mut">— ' + esc(an.bar) + '</span>' : '') + (ad ? ' <span class="tk2-mut">+ ' + ad + '</span>' : '') + '</div>'; }).join('') || '<div class="tk2-mut">stats seules</div>';
    var gen = a.addons.map(function (x) { return esc(x.name); }).filter(Boolean).join(', ');
    var ifs = [];
    a.ports.needs.forEach(function (n) { if (n.token) ifs.push('consumes: ' + esc(n.token) + (n.rate ? ' /' + esc(n.rate) : '')); });
    a.ports.fits.forEach(function (t) { if (t) ifs.push('fits: ' + esc(t)); });
    a.ports.takes.forEach(function (t) { ifs.push('takes: ' + esc(t.slot) + ' [' + esc(t.accepts.join(', ')) + ']'); });
    a.ports.holds.forEach(function (hd) { ifs.push('holds: ' + esc(hd.kind) + ' ' + esc(hd.cap)); });
    var pub = a.latent.filter(function (x) { return x.who.indexOf('public') >= 0; });
    pane.innerHTML =
      '<div class="tk2-bar"><button class="app-btn tk2-back">← FICHE</button><span class="tk2-title">DOCUMENT</span>' +
        '<span class="tk2-bar-sp"></span><span class="tk2-mut">vue joueur — champs non-publics masqués</span></div>' +
      '<div class="tk2-doc-card">' +
        '<div class="tk2-doc-head"><span>' + esc(a.name) + '</span><span>' + esc(a.cls) + ' · tier ' + a.tier + '</span></div>' +
        '<div class="tk2-doc-plate">' + plate + '</div>' +
        (a.flavor ? '<div class="tk2-doc-flavor">' + esc(a.flavor) + '</div>' : '') +
        (gen ? '<div class="tk2-doc-flavor tk2-mut">addons : ' + gen + '</div>' : '') +
        '<div class="tk2-doc-body"><div class="tk2-doc-col">' + feats + '</div>' +
          '<div class="tk2-doc-col">' + (ifs.length ? ifs.map(function (x) { return '<div>' + x + '</div>'; }).join('') : '<span class="tk2-mut">aucune interface</span>') +
          (pub.length ? pub.map(function (x) { return '<div>latent: ' + esc(x.text) + '</div>'; }).join('') : '') + '</div></div>' +
        '<div class="tk2-doc-foot">DC ' + d.dcLineage + ' · OP ' + d.op + ' · PROD ' + d.prodEb + 'eb · STREET ' + d.streetEb + 'eb</div>' +
      '</div>';
    pane.querySelector('.tk2-back').onclick = function () { s.st.view = 'bench'; save(s.st); render(null, pane); };
  }

  window.TechSection = { render: render, _lib: { store: store, DERIVE: DERIVE, nomenclature: nomenclature, skillsRequired: skillsRequired } };
})();
