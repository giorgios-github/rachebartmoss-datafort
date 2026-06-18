/* app.js — desktop app shell.
   C1: role chooser. C3: in-app GM Campaign Manager over the hub JSON API
   (/__api/campaigns…). Player → join flow (C6 will replace). English UI. */
(function () {
  'use strict';
  var ROLE_KEY = 'bartmoss_app_role';
  var TYPES = [
    { key: 'sheets', label: 'Sheets', ext: '.json', icon: '◈' },
    { key: 'npcs', label: 'NPCs', ext: '.json', icon: '☗' },
    { key: 'orgs', label: 'Orgs', ext: '.json', icon: '⬢' },
    { key: 'nightcity', label: 'Night City', ext: '.json', icon: '◰' },
    { key: 'documents', label: 'Documents', ext: '', icon: '▤' },
  ];
  function typeIcon(key) { var t = TYPES.filter(function (x) { return x.key === key; })[0]; return t ? t.icon : '·'; }
  var state = { campaignId: null, type: 'sheets' };
  // Which tool edits which doc type via the file-bridge (?cdoc). nightcity has no
  // adapter yet (view-only); documents use an inline textarea.
  var TOOL_FOR = { sheets: 'cs.html', npcs: 'npc-sheet.html', orgs: 'organisations.html' };

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(id) { return document.getElementById(id); }

  /* ── API ── */
  function api(method, path, body) {
    return fetch('/__api/' + path, {
      method: method,
      headers: body != null ? { 'content-type': 'application/json' } : {},
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }).then(function (r) { var ct = r.headers.get('content-type') || ''; return ct.indexOf('json') >= 0 ? r.json() : r.text(); });
  }

  /* ── Role chooser ── */
  window.chooseRole = function (role) {
    try { localStorage.setItem(ROLE_KEY, role); } catch (e) {}
    if (role === 'gm') {
      el('role-chooser').style.display = 'none';
      el('app-shell').hidden = false;
      renderCampaigns();
    } else {
      // Player pre-connect = the full site (offline: all tools + sourcebook
      // reader), with a CONNECT button (injected by main.js on ?player=1) that
      // joins a session (→ app.html?campaign&sheet session shell).
      location.href = 'index.html?player=1';
    }
  };
  window.switchRole = function () { try { localStorage.removeItem(ROLE_KEY); } catch (e) {} location.reload(); };

  // Global sourcebook reader — available from any screen (campaign manager,
  // session, …), as a full-screen overlay. Notebook/bookmarks are global.
  window.openReaderApp = function () {
    if (el('reader-overlay') || !window.SourcebookReader) return;
    var ov = document.createElement('div'); ov.id = 'reader-overlay'; ov.className = 'cdoc-overlay';
    ov.innerHTML = '<div class="cdoc-bar"><span class="cdoc-title">▤ SOURCEBOOKS</span><button class="app-btn" id="reader-close" style="margin-left:auto">Close</button></div><div class="reader-host" id="reader-host"></div>';
    document.body.appendChild(ov);
    var inst = null;
    fetch('/__api/books').then(function (r) { return r.json(); }).catch(function () { return { books: [] }; }).then(function (d) {
      inst = window.SourcebookReader.mount(el('reader-host'), { books: (d && d.books) || [] });
    });
    el('reader-close').onclick = function () { if (inst) { try { inst.destroy(); } catch (e) {} } ov.parentNode.removeChild(ov); };
  };

  /* Player connect — enter a campaign code + sheet id, or paste a GM link. */
  function renderPlayerConnect() {
    setMode('manage'); showView('view-pconnect');
    el('app-crumbs').innerHTML = '<span class="crumb-cur">Connect</span>';
    el('view-pconnect').innerHTML =
      '<div class="app-kicker">// JOIN A SESSION</div><h2 class="app-h">Connect to your GM</h2>' +
      '<div class="pc-card">' +
        '<label class="pc-l">Paste the link your GM gave you</label>' +
        '<input id="pc-link" class="pc-in" placeholder="http://192.168.1.42:8787/app.html?campaign=main&amp;sheet=Player_1">' +
        '<div class="pc-or">— or enter it —</div>' +
        '<div class="pc-row"><div><label class="pc-l">Campaign</label><input id="pc-camp" class="pc-in" value="main"></div>' +
        '<div><label class="pc-l">Your sheet id</label><input id="pc-sheet" class="pc-in" placeholder="Player_1"></div></div>' +
        '<button class="app-btn app-btn-go pc-go" id="pc-connect">⇄ CONNECT</button>' +
        '<div class="pc-err" id="pc-err"></div>' +
      '</div>';
    el('pc-connect').onclick = function () {
      var link = (el('pc-link').value || '').trim(), camp, sheet;
      if (link) {
        try { var u = new URL(link, location.href); camp = u.searchParams.get('campaign'); sheet = u.searchParams.get('sheet'); }
        catch (e) {}
        if (!camp || !sheet) { el('pc-err').textContent = 'That link is missing the campaign or sheet.'; return; }
      } else {
        camp = (el('pc-camp').value || 'main').trim(); sheet = (el('pc-sheet').value || '').trim();
        if (!sheet) { el('pc-err').textContent = 'Enter your sheet id, or paste the link.'; return; }
      }
      openPlayerSession(camp, sheet);
    };
  }

  /* ── Modal ── */
  function modalClose() { var ov = el('app-modal-ov'); if (ov) ov.parentNode.removeChild(ov); }
  function prompt1(title, label, placeholder, onOk) {
    modalClose();
    var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal"><div class="app-modal-head">' + esc(title) + '</div>' +
      '<div class="app-modal-body"><label style="font-size:11px;color:#666">' + esc(label) + '</label><input id="app-modal-in" placeholder="' + esc(placeholder || '') + '"></div>' +
      '<div class="app-modal-actions"><button class="app-btn" data-x>Cancel</button><button class="app-btn app-modal-ok" data-ok>OK</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) modalClose(); };
    document.body.appendChild(ov);
    var inp = el('app-modal-in'); inp.focus();
    function commit() { var v = inp.value; modalClose(); onOk(v); }
    ov.querySelector('[data-ok]').onclick = commit;
    ov.querySelector('[data-x]').onclick = modalClose;
    inp.onkeydown = function (e) { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') modalClose(); };
  }
  function confirm1(msg, onYes) {
    modalClose();
    var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal"><div class="app-modal-head">Confirm</div>' +
      '<div class="app-modal-body" style="font-size:13px">' + esc(msg) + '</div>' +
      '<div class="app-modal-actions"><button class="app-btn" data-x>Cancel</button><button class="app-btn app-modal-ok" data-ok>Yes</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) modalClose(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-ok]').onclick = function () { modalClose(); onYes(); };
    ov.querySelector('[data-x]').onclick = modalClose;
  }

  // Show exactly one top-level view; hide the others (prevents the ended-session
  // UI from bleeding through onto the campaign list — bug where view-session
  // stayed visible behind a transparent campaign view).
  function showView(which) {
    ['view-campaigns', 'view-campaign', 'view-session', 'view-pconnect'].forEach(function (v) {
      var e = el(v); if (e) e.hidden = (v !== which);
    });
  }

  // MANAGE (campaigns/detail) vs ACTIVE (live session) — the COMP/CON-style
  // mode duality. Flips the whole app chrome to a green "LIVE" state.
  function setMode(mode) {
    var shell = el('app-shell'); if (!shell) return;
    shell.classList.toggle('mode-active', mode === 'active');
  }

  /* ── Campaigns list ── */
  function renderCampaigns() {
    state.campaignId = null;
    endSessionConn();
    setMode('manage');
    showView('view-campaigns');
    el('app-crumbs').innerHTML = '<span class="crumb-cur">Campaigns</span>';
    api('GET', 'campaigns').then(function (d) {
      var cs = (d && d.campaigns) || [];
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var cards = cs.map(function (c, i) {
        return '<div class="cmp-card" data-id="' + esc(c.id) + '">' +
          '<div class="cmp-idx">' + pad(i + 1) + ' / ' + pad(cs.length) + '</div>' +
          '<div class="cmp-top"><h3>' + esc(c.name) + '</h3>' +
            '<div class="cmp-meta">' + c.sheets + ' sheet' + (c.sheets === 1 ? '' : 's') + '</div></div>' +
          '<div class="cmp-foot"><span class="cmp-open-hint">OPEN ▸</span>' +
            '<span class="cmp-del" data-del="' + esc(c.id) + '">delete</span></div></div>';
      }).join('');
      el('view-campaigns').innerHTML =
        '<div class="app-kicker">// CAMPAIGNS</div>' +
        '<h2 class="app-h">Operations roster</h2>' +
        (cs.length ? '' : '<div class="app-empty">No campaigns yet. Spin one up to start managing sheets, NPCs and sessions.</div>') +
        '<div class="cmp-grid">' +
        cards + '<div class="cmp-card cmp-new" id="cmp-new"><span class="cmp-new-plus">+</span> NEW CAMPAIGN</div></div>';
      el('cmp-new').onclick = function () {
        prompt1('New campaign', 'Campaign name', 'e.g. Night Heist', function (name) {
          name = (name || '').trim(); if (!name) return;
          api('POST', 'campaigns', { name: name }).then(function (r) { if (r && r.id) openCampaign(r.id); });
        });
      };
      el('view-campaigns').querySelectorAll('.cmp-card[data-id]').forEach(function (card) {
        card.onclick = function (e) { if (e.target.hasAttribute('data-del')) return; openCampaign(card.getAttribute('data-id')); };
      });
      el('view-campaigns').querySelectorAll('[data-del]').forEach(function (s) {
        s.onclick = function (e) { e.stopPropagation(); var id = s.getAttribute('data-del'); confirm1('Delete campaign "' + id + '" and all its files?', function () { api('DELETE', 'campaigns/' + encodeURIComponent(id)).then(renderCampaigns); }); };
      });
    });
  }

  /* ── Campaign detail ── */
  function openCampaign(id) {
    state.campaignId = id; state.type = 'sheets'; cdSessionOpen = null; cdHost = null;
    endSessionConn();
    var vs = el('view-session'); if (vs) vs.innerHTML = '';   // drop stale live panels (avoid id clashes)
    setMode('manage');
    showView('view-campaign');
    el('app-crumbs').innerHTML = '<a id="crumb-home">Campaigns</a> <span class="crumb-sep">/</span> <span class="crumb-cur">' + esc(id) + '</span>';
    renderCampaignDetail();
  }

  /* ── Campaign = Prep board (sidebar of prep modules) ── */
  var cdData = null, cdSection = 'overview', cdSessionOpen = null, cdEventSel = null, cdLootSel = null;
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function prep() {
    if (!cdData.meta) cdData.meta = {};
    var p = cdData.meta.prep || (cdData.meta.prep = {});
    ['events', 'squads', 'locations', 'clocks', 'loot'].forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
    // Migrate v1 → v2: agenda scenes → events; encounters → squads; flat loot → tree.
    if (Array.isArray(p.agenda) && !p.events.length) {
      p.events = p.agenda.map(function (s) { return { id: s.id || uid('ev'), title: s.title || '', preset: 'imagetext', image: '', text: s.notes || '', portrait: '', npcRef: '', trigger: null }; });
      delete p.agenda;
    }
    if (Array.isArray(p.encounters) && !p.squads.length) {
      p.squads = p.encounters.map(function (e) { return { id: e.id || uid('sq'), name: e.name || 'Squad', members: e.members || [], lootId: null, settings: e.settings }; });
      delete p.encounters;
    }
    p.loot.forEach(function (g) { if (!Array.isArray(g.nodes)) { g.nodes = (g.items || []).map(function (it) { return { id: uid('ln'), type: 'item', cat: 'custom', name: it, share: 'shared' }; }); if (g.eb) g.nodes.unshift({ id: uid('ln'), type: 'money', amount: g.eb, form: 'eddies', share: 'shared' }); } });
    return p;
  }
  function savePrep(then) { return saveCampaignMeta(state.campaignId, { prep: prep() }).then(then || function () {}); }
  // Persistent session records (journal). Distinct from the live meta.session.
  function sessions() {
    if (!cdData.meta) cdData.meta = {};
    if (!Array.isArray(cdData.meta.sessions)) cdData.meta.sessions = [];
    return cdData.meta.sessions;
  }
  function saveSessions(then) { return saveCampaignMeta(state.campaignId, { sessions: sessions() }).then(then || function () {}); }
  function newSession() { var n = sessions().length + 1; return { id: uid('ses'), name: 'Session ' + n, date: new Date().toISOString().slice(0, 10), notes: '', recap: '', log: [], attendance: [], createdAt: Date.now() }; }
  function fmtTime(ts) { try { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  var CD_SECTIONS = [
    { k: 'overview', label: 'Overview' }, { k: 'sessions', label: 'Sessions' }, { k: 'players', label: 'Players' },
    { k: 'locations', label: 'Locations' }, { k: 'events', label: 'Events' }, { k: 'squads', label: 'Squads' },
    { k: 'loot', label: 'Loot' }, { k: 'files', label: 'Files' },
  ];
  // Unified workspace: section identity (icon + group) shared by PREP and LIVE rails.
  var SECTION_META = {
    overview: { icon: '◎', grp: 'PLAY' }, sessions: { icon: '◷', grp: 'PLAY' }, players: { icon: '◈', grp: 'PLAY' },
    locations: { icon: '◰', grp: 'PLAY' }, events: { icon: '▸', grp: 'PLAY' }, squads: { icon: '⚔', grp: 'PLAY' },
    loot: { icon: '◆', grp: 'PLAY' }, livesheet: { icon: '◈', grp: 'PLAY' },
    tools: { icon: '⚙', grp: 'LIBRARY' }, files: { icon: '▤', grp: 'LIBRARY' },
  };
  function wsRail(sections, activeKey) {
    var order = [], byGrp = {};
    sections.forEach(function (s) { var g = (SECTION_META[s.k] && SECTION_META[s.k].grp) || 'PLAY'; if (!byGrp[g]) { byGrp[g] = []; order.push(g); } byGrp[g].push(s); });
    return order.map(function (g) {
      return '<div class="ws-rail-grp">' + g + '</div>' + byGrp[g].map(function (s) {
        var ic = (SECTION_META[s.k] && SECTION_META[s.k].icon) || '·';
        var btn = '<button class="sess-nav ws-nav' + (s.k === activeKey ? ' active' : '') + '" data-sec="' + s.k + '"><span class="ws-nav-ic">' + ic + '</span>' + esc(s.label) +
          (s.subs ? '<span class="ws-nav-exp" data-railexp="' + s.k + '">' + (sess.toolsExp ? '▾' : '▸') + '</span>' : '') + '</button>';
        if (s.subs) {
          btn += '<div class="ws-subnav" id="ws-sub-' + s.k + '"' + (sess.toolsExp ? '' : ' hidden') + '>' + s.subs.map(function (sub) {
            var act = (sub.kind === 'section' && sub.k === activeKey) ? ' active' : '';
            var attr = sub.kind === 'section' ? 'data-railsec="' + sub.k + '"' : 'data-railtool="' + esc(sub.kind === 'combat' ? 'combat' : (sub.url || '')) + '" data-raillabel="' + esc(sub.label) + '"';
            return '<button class="ws-subnav-item' + act + '" ' + attr + '><span class="ws-nav-ic">' + (sub.icon || '·') + '</span>' + esc(sub.label) + '</button>';
          }).join('') + '</div>';
        }
        return btn;
      }).join('');
    }).join('');
  }
  function renderCampaignDetail() {
    var id = state.campaignId;
    api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
      cdData = d; var meta = (d && d.meta) || {};
      el('view-campaign').innerHTML =
        '<div class="cd-head ws-top ws-top-prep">' +
          '<button class="app-btn cd-back" id="cd-back">← Campaigns</button>' +
          '<span class="ws-mode ws-mode-prep">PREP</span>' +
          '<div class="cd-titlewrap"><h2 class="app-h ws-title">' + esc(meta.name || id) + '</h2></div>' +
          '<span style="flex:1"></span>' +
          '<button class="app-btn app-btn-go" id="cd-session" title="Host the sheets for players">▶ GO LIVE</button></div>' +
        '<div class="sess-shell cd-shell"><nav class="sess-side ws-rail">' + wsRail(CD_SECTIONS, cdSection) + '</nav><div class="sess-content" id="cd-content"></div></div>';
      var crumb = el('crumb-home'); if (crumb) crumb.onclick = renderCampaigns;
      el('cd-back').onclick = renderCampaigns;
      el('cd-session').onclick = function () { goLive(id); };
      el('view-campaign').querySelectorAll('.sess-nav').forEach(function (b) { b.onclick = function () { cdSessionOpen = null; cdGoto(b.getAttribute('data-sec')); }; });
      cdGoto(cdSection);
    });
  }
  // Section renderers route through a HOST element so the same editors render in
  // both the PREP board (#cd-content) and a live session panel (workspace unity).
  var cdHost = null;
  function cdRenderSection(key, c) {
    if (!c) return;
    c.classList.toggle('cd-bleed', key === 'locations');   // full-bleed embedded tools
    if (key === 'overview') return cdOverview(c);
    if (key === 'sessions') return cdSessions(c);
    if (key === 'players') return cdPlayers(c);
    if (key === 'events') return cdEvents(c);
    if (key === 'squads') return cdSquads(c);
    if (key === 'locations') return cdLocations(c);
    if (key === 'loot') return cdLoot(c);
    if (key === 'files') return cdFiles(c);
  }
  function cdGoto(key) {
    cdSection = key; cdHost = el('cd-content'); if (!cdHost) return;
    el('view-campaign').querySelectorAll('.sess-nav').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sec') === key); });
    cdRenderSection(key, cdHost);
  }

  function statCard(value, label, hot) {
    return '<div class="cd-stat' + (hot ? ' cd-stat-hot' : '') + '"><b>' + value + '</b><span>' + esc(label) + '</span></div>';
  }
  function cdOverview(c) {
    var id = state.campaignId, meta = cdData.meta || {};
    var n = cdData.docs || {}, p = prep();
    var played = sessions().length;
    c.innerHTML =
      '<div class="cd-scroll">' +
      '<div class="ov-banner cd-ovbanner">' +
        '<div class="ov-banner-main"><div class="app-kicker">// CAMPAIGN</div><h2 class="ov-title">' + esc(meta.name || id) + '</h2></div>' +
        '<div class="ov-chips"><span class="ov-chip ov-chip-live"><b>' + played + '</b> session' + (played === 1 ? '' : 's') + ' played</span></div>' +
      '</div>' +
      '<div class="cd-ovgrid">' +
        '<div class="cd-ovmain"><div class="ov-block"><div class="ov-lbl">BRIEFING</div>' +
          '<textarea class="ov-edit cd-ovdesc" id="cd-desc" placeholder="What is this campaign about? (shown to players in the session Overview)…">' + esc(meta.description || '') + '</textarea></div></div>' +
        '<div class="cd-ovstats">' +
          statCard(played, 'sessions played', true) +
          statCard((n.sheets || []).length, 'sheets') +
          statCard((n.npcs || []).length, 'NPCs') +
          statCard((n.orgs || []).length, 'orgs') +
          statCard(p.locations.length, 'locations') +
          statCard(p.squads.length, 'squads') +
          statCard(p.loot.length, 'loot') +
          statCard(p.events.length, 'events') +
          statCard(p.clocks.length, 'clocks') +
        '</div>' +
      '</div></div>';
    el('cd-desc').onchange = function () { saveCampaignMeta(id, { description: el('cd-desc').value }); };
  }

  // Players — the campaign's player sheets; click one to edit it full-bleed (the
  // full Character Sheet, in-place).
  function cdPlayers(c) {
    var sheets = (cdData.docs && cdData.docs.sheets) || [];
    var cards = sheets.length ? sheets.map(function (d) {
      return '<button class="pl-card" data-sheet="' + esc(d.name) + '"><div class="pl-photo">◈</div><div class="pl-name">' + esc(idOf(d.name)) + '</div></button>';
    }).join('') : '<div class="cd-empty">No player sheets yet. Add one here or in Files.</div>';
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">Players</div><span style="flex:1"></span><button class="app-btn app-btn-go" id="cd-newpc">+ Sheet</button></div>' +
      '<div class="cd-scroll"><div class="pl-grid pl-grid-prep">' + cards + '</div></div>';
    el('cd-newpc').onclick = function () {
      prompt1('New character', 'Name', 'name', function (name) {
        name = (name || '').trim(); if (!name) return; if (!/\.json$/i.test(name)) name += '.json';
        api('POST', 'campaigns/' + encodeURIComponent(state.campaignId) + '/sheets', { name: name, json: {} }).then(function () { cdOpenDocInline('sheets', name); });
      });
    };
    c.querySelectorAll('[data-sheet]').forEach(function (b) { b.onclick = function () { cdOpenDocInline('sheets', b.getAttribute('data-sheet')); }; });
  }
  // Files — every campaign file (player sheets, NPCs, orgs, Night City, documents).
  // Editing a doc opens it full-bleed in the section (Character Sheet, etc.).
  function cdFiles(c) {
    if (['sheets', 'npcs', 'orgs', 'nightcity', 'documents'].indexOf(state.type) < 0) state.type = 'sheets';
    var tabs = TYPES.map(function (t) {
      var n = (cdData.docs && cdData.docs[t.key] ? cdData.docs[t.key].length : 0);
      return '<div class="cd-tab' + (t.key === state.type ? ' active' : '') + '" data-type="' + t.key + '"><span class="cd-tab-ico">' + t.icon + '</span>' + t.label + ' <span class="cd-count">' + n + '</span></div>';
    }).join('');
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">Files</div></div><div class="cd-scroll"><div class="cd-tabs">' + tabs + '</div><div id="cd-body"></div></div>';
    c.querySelectorAll('.cd-tab').forEach(function (t) {
      t.onclick = function () { state.type = t.getAttribute('data-type'); c.querySelectorAll('.cd-tab').forEach(function (x) { x.classList.remove('active'); }); t.classList.add('active'); renderType(cdData); };
    });
    renderType(cdData);
  }
  // Open a campaign doc full-bleed inside the Files section (vs the old overlay).
  function cdOpenDocInline(type, name) {
    var id = state.campaignId, c = el('cd-content'); if (!c) return;
    c.classList.add('cd-bleed');
    function back() { renderCampaignDetail(); }
    if (type === 'documents') {
      var docPath = 'campaigns/' + encodeURIComponent(id) + '/documents/' + encodeURIComponent(name);
      c.innerHTML = '<div class="cd-embed"><div class="cd-embed-bar"><button class="app-btn" id="cde-back">← Files</button><span class="cd-embed-name">' + esc(name) + '</span></div><textarea class="cd-embed-ta" id="cde-ta"></textarea></div>';
      fetch('/__api/' + docPath).then(function (r) { return r.text(); }).then(function (txt) { var ta = el('cde-ta'); ta.value = txt; var to; ta.oninput = function () { clearTimeout(to); to = setTimeout(function () { fetch('/__api/' + docPath, { method: 'PUT', body: ta.value }); }, 400); }; });
      el('cde-back').onclick = function () { var ta = el('cde-ta'); Promise.resolve(ta ? fetch('/__api/' + docPath, { method: 'PUT', body: ta.value }) : null).catch(function () {}).then(back); };
      return;
    }
    var tool = TOOL_FOR[type]; if (!tool) return;
    var url = tool + '?cdoc=1&cid=' + encodeURIComponent(id) + '&ctype=' + type + '&cname=' + encodeURIComponent(name);
    c.innerHTML = '<div class="cd-embed"><div class="cd-embed-bar"><button class="app-btn" id="cde-back">← Files</button><span class="cd-embed-name">' + esc(name) + '</span></div><iframe class="cd-embed-frame" id="cde-frame" src="' + esc(url) + '"></iframe></div>';
    el('cde-back').onclick = function () {
      var fr = el('cde-frame'), win = fr && fr.contentWindow, ad = win && win.__cdocAdapter, obj;
      try { obj = ad && ad.serialize(); } catch (e) { obj = null; }
      if (obj == null) return back();
      api('PUT', 'campaigns/' + encodeURIComponent(id) + '/' + type + '/' + encodeURIComponent(name), obj).then(back, back);
    };
  }
  // Re-render the current section into its current host (PREP container or live panel).
  function cdRerender() { if (cdHost) cdRenderSection(cdSection, cdHost); else cdGoto(cdSection); }

  /* Sessions — persistent records with a live journal. List → session page. */
  function cdSessions(c) {
    if (cdSessionOpen) return cdSessionPage(c, cdSessionOpen);
    var ss = sessions().slice().reverse();
    var live = cdData.meta.session || {};
    var activeId = (live.active && live.activeId) || null;
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">Sessions</div><span style="flex:1"></span><button class="app-btn app-btn-go" id="cd-add">+ Session</button></div>' +
      '<div class="cd-scroll"><div class="prep-list">' + (ss.length ? ss.map(function (s) {
        var isLive = activeId === s.id;
        return '<div class="prep-card sess-rec' + (isLive ? ' live' : '') + '" data-open="' + s.id + '">' +
          '<div class="prep-row"><span class="prep-tag">' + (isLive ? '●' : '◷') + '</span>' +
          '<span class="prep-name">' + esc(s.name || 'Session') + '</span>' +
          (s.date ? '<span class="prep-sub">' + esc(s.date) + '</span>' : '') +
          (isLive ? '<span class="sess-rec-live">LIVE</span>' : '') +
          '<span style="flex:1"></span><span class="prep-sub">' + (s.log || []).length + ' log · ' + (s.attendance || []).length + ' present</span>' +
          '<button class="prep-mini prep-del" data-del="' + s.id + '">✕</button></div>' +
          (s.recap ? '<div class="sess-rec-recap">' + esc(s.recap) + '</div>' : '') + '</div>';
      }).join('') : '<div class="cd-empty">No sessions yet. Each GO LIVE lets you resume one or start a new one — recaps, attendance and a live journal live here.</div>') + '</div></div>';
    el('cd-add').onclick = function () { var s = newSession(); sessions().push(s); saveSessions(function () { cdSessionOpen = s.id; cdRerender(); }); };
    c.querySelectorAll('[data-open]').forEach(function (card) { card.onclick = function (e) { if (e.target.hasAttribute('data-del')) return; cdSessionOpen = card.getAttribute('data-open'); cdRerender(); }; });
    c.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var did = b.getAttribute('data-del'); confirm1('Delete this session record (notes, recap, journal)?', function () { cdData.meta.sessions = sessions().filter(function (x) { return x.id !== did; }); saveSessions(cdRerender); }); }; });
  }
  function attendHtml(s) {
    var sheets = ((cdData.docs && cdData.docs.sheets) || []).map(function (d) { return idOf(d.name); });
    if (!sheets.length) return '<span class="cd-empty">No sheets in this campaign.</span>';
    var att = s.attendance || [];
    return sheets.map(function (sid) { return '<label class="ses-att"><input type="checkbox" data-att="' + esc(sid) + '"' + (att.indexOf(sid) >= 0 ? ' checked' : '') + '> ' + esc(sid) + '</label>'; }).join('');
  }
  // A session page mirrors the Overview structure (banner + recap/notes + journal).
  function cdSessionPage(c, sid) {
    var s = item(sessions(), sid);
    if (!s.id) { cdSessionOpen = null; return cdSessions(c); }
    var log = s.log || [];
    c.innerHTML =
      '<div class="cd-topbar"><button class="app-btn cd-back" id="ses-back">← Sessions</button><div class="cd-sectitle">Session</div><span style="flex:1"></span></div>' +
      '<div class="cd-scroll">' +
      '<div class="ov-banner cd-ovbanner"><div class="ov-banner-main">' +
        '<input class="ses-name" id="ses-name" value="' + esc(s.name || '') + '" placeholder="Session name">' +
        '<input class="ses-date" id="ses-date" type="date" value="' + esc(s.date || '') + '"></div>' +
        '<div class="ov-chips"><span class="ov-chip"><b>' + log.length + '</b> log</span><span class="ov-chip"><b>' + (s.attendance || []).length + '</b> present</span></div></div>' +
      '<div class="cd-ovgrid"><div class="cd-ovmain">' +
        '<div class="ov-block"><div class="ov-lbl">RECAP</div><textarea class="ov-edit ov-edit-sm" id="ses-recap" placeholder="One-paragraph recap (what happened last time)…">' + esc(s.recap || '') + '</textarea></div>' +
        '<div class="ov-block"><div class="ov-lbl">PREP NOTES</div><textarea class="ov-edit" id="ses-notes" placeholder="Your private notes for this session…">' + esc(s.notes || '') + '</textarea></div>' +
      '</div><div class="cd-ovside">' +
        '<div class="ov-block"><div class="ov-lbl">ATTENDANCE</div><div class="ses-attend">' + attendHtml(s) + '</div></div>' +
        '<div class="ov-block"><div class="ov-lbl">JOURNAL — LIVE LOG</div><div class="ses-log">' + (log.length ? log.slice().reverse().map(function (e) {
          return '<div class="ses-logrow"><span class="ses-logt">' + esc(fmtTime(e.ts)) + '</span> ' + esc(e.msg) + '</div>';
        }).join('') : '<span class="cd-empty">No entries yet. Going live records reveals, loot and combat here.</span>') + '</div></div>' +
      '</div></div></div>';
    el('ses-back').onclick = function () { cdSessionOpen = null; cdRerender(); };
    el('ses-name').onchange = function () { s.name = el('ses-name').value; saveSessions(); };
    el('ses-date').onchange = function () { s.date = el('ses-date').value; saveSessions(); };
    el('ses-recap').onchange = function () { s.recap = el('ses-recap').value; saveSessions(); };
    el('ses-notes').onchange = function () { s.notes = el('ses-notes').value; saveSessions(); };
    c.querySelectorAll('[data-att]').forEach(function (cb) {
      cb.onchange = function () {
        var asid = cb.getAttribute('data-att'), att = s.attendance || (s.attendance = []);
        if (cb.checked) { if (att.indexOf(asid) < 0) att.push(asid); }
        else s.attendance = att.filter(function (x) { return x !== asid; });
        saveSessions();
      };
    });
  }
  // GO LIVE — resume an existing session or start a new one, then pick sheets to host.
  function goLive(id) {
    var sheetDocs = (cdData.docs && cdData.docs.sheets) || [];
    if (!sheetDocs.length) { alert('Add at least one sheet to the campaign first.'); return; }
    var ssRev = sessions().slice().reverse();
    modalClose();
    var rows = ssRev.map(function (s, i) {
      return '<label class="cbs-row"><input type="radio" name="golive-ses" value="' + esc(s.id) + '"' + (i === 0 ? ' checked' : '') + '> ' +
        esc(s.name || 'Session') + (s.date ? ' · ' + esc(s.date) : '') + ' <span class="cbs-tag">' + (s.log || []).length + ' log</span></label>';
    }).join('');
    var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal"><div class="app-modal-head">▶ Go live — attach a session</div>' +
      '<div class="app-modal-body">' +
        (rows ? '<div class="app-kicker">// RESUME</div>' + rows : '') +
        '<label class="cbs-row" style="margin-top:8px"><input type="radio" name="golive-ses" value="__new__"' + (ssRev.length ? '' : ' checked') + '> Start a new session</label>' +
        '<input id="golive-newname" class="pc-in" value="Session ' + (sessions().length + 1) + '">' +
      '</div>' +
      '<div class="app-modal-actions"><button class="app-btn" data-x>Cancel</button><button class="app-btn app-modal-ok" data-ok>Continue ▸</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) modalClose(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = modalClose;
    ov.querySelector('[data-ok]').onclick = function () {
      var pick = (ov.querySelector('input[name="golive-ses"]:checked') || {}).value;
      var chosen;
      if (pick === '__new__' || !pick) {
        chosen = newSession(); var nm = (el('golive-newname').value || '').trim(); if (nm) chosen.name = nm;
        sessions().push(chosen);
      } else { chosen = item(sessions(), pick); }
      saveSessions(function () {
        modalClose();
        startSessionPicker(id, sheetDocs, (cdData.meta.session && cdData.meta.session.order) || [], chosen.id);
      });
    };
  }

  function item(arr, id) { return arr.filter(function (x) { return x.id === id; })[0] || {}; }
  function move(arr, id, d) { var i = arr.findIndex(function (x) { return x.id === id; }); var j = i + d; if (i < 0 || j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }

  /* Events — 2-pane editor: list + Silver Case preset canvas. Revealed live as a
     Film Window; can auto-trigger when a linked clock drops below a threshold. */
  // Events are a composition of BLOCKS (image/text). Quick layouts seed a set.
  function _blImg(src, size, cam, align) { return { id: uid('bl'), type: 'image', src: src || '', cam: cam || '', size: size || 'm', align: align || 'center' }; }
  function _blTxt(t, mode, size, speaker) { return { id: uid('bl'), type: 'text', text: t || '', mode: mode || 'panel', size: size || 'l', speaker: speaker || '', align: 'center' }; }
  var EV_TEMPLATES = [
    { k: 'imagetext', label: 'Image + dialogue', make: function () { return [_blImg('', 'l'), _blTxt('', 'dialogue', 'l')]; } },
    { k: 'call', label: 'Incoming call', make: function () { return [_blImg('', 'l', 'CAM 03 ● LIVE'), _blImg('', 's', 'ID ● CALLER', 'left'), _blTxt('', 'dialogue', 'l', 'INCOMING CALL')]; } },
    { k: 'dossier', label: 'Dossier', make: function () { return [_blImg('', 'l', 'ID ● FILE', 'left'), _blTxt('', 'panel', 'l')]; } },
    { k: 'triptych', label: 'Triptych', make: function () { return [_blImg('', 'l', 'CAM 02', 'right'), _blTxt('', 'panel', 'm'), _blImg('', 's', 'ID', 'left')]; } },
    { k: 'fullimage', label: 'Full image', make: function () { return [_blImg('', 'full')]; } },
    { k: 'textonly', label: 'Text panel', make: function () { return [_blTxt('', 'panel', 'xl')]; } },
  ];
  // Ensure an event carries a blocks array (migrate legacy preset/image/text/portrait once).
  function evBlocks(ev) {
    if (Array.isArray(ev.blocks)) return ev.blocks;
    var p = ev.preset, b = [];
    if (p === 'fullimage') { if (ev.image) b.push(_blImg(ev.image, 'full')); }
    else if (p === 'call') { if (ev.image) b.push(_blImg(ev.image, 'l', 'CAM 03 ● LIVE')); if (ev.portrait) b.push(_blImg(ev.portrait, 's', 'ID ● CALLER', 'left')); if (ev.text) b.push(_blTxt(ev.text, 'dialogue', 'l', 'INCOMING CALL')); }
    else if (p === 'dossier') { if (ev.portrait || ev.image) b.push(_blImg(ev.portrait || ev.image, 'l', 'ID ● FILE', 'left')); if (ev.text) b.push(_blTxt(ev.text, 'panel', 'l')); }
    else if (p === 'triptych') { if (ev.image) b.push(_blImg(ev.image, 'l', 'CAM 02', 'right')); if (ev.text) b.push(_blTxt(ev.text, 'panel', 'm')); if (ev.portrait) b.push(_blImg(ev.portrait, 's', 'ID', 'left')); }
    else if (p === 'textonly') { if (ev.text) b.push(_blTxt(ev.text, 'panel', 'xl')); }
    else { if (ev.image) b.push(_blImg(ev.image, 'l')); if (ev.text) b.push(_blTxt(ev.text, ev.image ? 'dialogue' : 'panel', 'l')); }
    ev.blocks = b;
    return b;
  }
  function readImage(file, cb) { var r = new FileReader(); r.onload = function () { cb(r.result); }; r.readAsDataURL(file); }
  function cdEvents(c) {
    var evs = prep().events, cls = prep().clocks;
    if (cdEventSel && !item(evs, cdEventSel).id && !item(cls, cdEventSel).id) cdEventSel = null;
    if (!cdEventSel) cdEventSel = (evs[0] && evs[0].id) || (cls[0] && cls[0].id) || null;
    var evItems = evs.map(function (e) {
      return '<div class="ev-li' + (e.id === cdEventSel ? ' active' : '') + '" data-sel="' + e.id + '"><span class="ev-li-ico">▸</span>' +
        '<span class="ev-li-name">' + esc(e.title || '(untitled event)') + '</span>' +
        '<span class="ev-li-preset">' + esc(e.preset || 'imagetext') + (e.trigger && e.trigger.clockId ? ' · ⏱' : '') + '</span>' +
        '<button class="prep-mini prep-del" data-del="' + e.id + '">✕</button></div>';
    }).join('');
    var clkItems = cls.map(function (k) {
      return '<div class="ev-li ev-li-clk' + (k.id === cdEventSel ? ' active' : '') + '" data-sel="' + k.id + '"><span class="ev-li-ico">⏱</span>' +
        '<span class="ev-li-name">' + esc(k.label || '(clock)') + '</span>' +
        '<span class="ev-li-preset">' + (k.value || 0) + '/' + (k.max || 6) + '</span>' +
        '<button class="prep-mini prep-del" data-del="' + k.id + '">✕</button></div>';
    }).join('');
    var listItems = (evs.length || cls.length)
      ? (evItems + (cls.length ? '<div class="ev-li-div">CLOCKS</div>' + clkItems : ''))
      : '<div class="cd-empty">No events or clocks yet.</div>';
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">Events</div><span style="flex:1"></span>' +
      '<button class="app-btn" id="cd-addclk">+ Clock</button><button class="app-btn app-btn-go" id="cd-add">+ Event</button></div>' +
      '<div class="cd-board"><div class="ev-list"><div class="cd-side-head">Timeline</div>' + listItems + '</div><div class="cd-boardmain"><div class="ev-canvas" id="ev-canvas"></div></div></div>';
    el('cd-add').onclick = function () { var e = { id: uid('ev'), title: '', preset: 'imagetext', image: '', text: '', portrait: '', npcRef: '', trigger: null }; evs.push(e); cdEventSel = e.id; savePrep(cdRerender); };
    el('cd-addclk').onclick = function () { var k = { id: uid('clk'), label: '', max: 6, value: 0, color: CLOCK_COLORS[cls.length % 4] }; cls.push(k); cdEventSel = k.id; savePrep(cdRerender); };
    c.querySelectorAll('[data-sel]').forEach(function (b) { b.onclick = function (e) { if (e.target.hasAttribute('data-del')) return; cdEventSel = b.getAttribute('data-sel'); cdRerender(); }; });
    c.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var did = b.getAttribute('data-del'); cdData.meta.prep.events = evs.filter(function (x) { return x.id !== did; }); cdData.meta.prep.clocks = cls.filter(function (x) { return x.id !== did; }); if (cdEventSel === did) cdEventSel = null; savePrep(cdRerender); }; });
    renderEventCanvas();
  }
  function renderEventCanvas() {
    var box = el('ev-canvas'); if (!box) return;
    var clk = item(prep().clocks, cdEventSel);
    if (clk.id) return renderClockCanvas(box, clk);
    var ev = item(prep().events, cdEventSel);
    if (!ev.id) { box.innerHTML = '<div class="cd-empty">Select or add an event or clock.</div>'; return; }
    var npcDocs = (cdData.docs && cdData.docs.npcs) || [];
    var clocks = prep().clocks;
    var blocks = evBlocks(ev);
    var SZ = ['s', 'm', 'l', 'xl', 'full'], AL = ['left', 'center', 'right'];
    var npcOpts = '<option value="">— NPC portrait —</option>' + npcDocs.map(function (d) { return '<option value="' + esc(d.name) + '">' + esc(idOf(d.name)) + '</option>'; }).join('');
    function selOf(name, idx, opts, cur) { return '<select data-' + name + '="' + idx + '">' + opts.map(function (o) { return '<option value="' + o + '"' + (cur === o ? ' selected' : '') + '>' + o.toUpperCase() + '</option>'; }).join('') + '</select>'; }
    function blockRow(b, i) {
      var head = '<div class="evb-head"><span class="evb-type">' + (b.type === 'image' ? '▣ Image' : '¶ Text') + '</span><span style="flex:1"></span>' +
        '<label class="evb-l">Size ' + selOf('bsize', i, SZ, b.size || 'm') + '</label>' +
        '<label class="evb-l">Align ' + selOf('balign', i, AL, b.align || 'center') + '</label>' +
        '<button class="prep-mini" data-bup="' + i + '" title="Up">▲</button><button class="prep-mini" data-bdn="' + i + '" title="Down">▼</button><button class="prep-mini prep-del" data-brm="' + i + '">✕</button></div>';
      var body;
      if (b.type === 'image') {
        body = '<div class="ev-media">' + (b.src ? '<img class="ev-thumb" src="' + esc(b.src) + '">' : '<span class="ev-noimg">no image</span>') +
          '<label class="app-btn ev-up">Upload<input type="file" accept="image/*" data-bimg="' + i + '" hidden></label>' +
          '<select data-bnpc="' + i + '">' + npcOpts + '</select>' +
          (b.src ? '<button class="app-btn" data-bclr="' + i + '">Clear</button>' : '') +
          '<input class="ev-cap" data-bcam="' + i + '" value="' + esc(b.cam || '') + '" placeholder="caption (CAM 03…)"></div>';
      } else {
        body = '<textarea class="ov-edit ev-text" data-btext="' + i + '" placeholder="What the players read…">' + esc(b.text || '') + '</textarea>' +
          '<div class="ev-media"><label class="evb-l">Mode <select data-bmode="' + i + '"><option value="panel"' + ((b.mode || 'panel') === 'panel' ? ' selected' : '') + '>Panel</option><option value="dialogue"' + (b.mode === 'dialogue' ? ' selected' : '') + '>Dialogue</option></select></label>' +
          '<input class="ev-cap" data-bspk="' + i + '" value="' + esc(b.speaker || '') + '" placeholder="speaker (optional)"></div>';
      }
      return '<div class="evb">' + head + body + '</div>';
    }
    var tplBtns = EV_TEMPLATES.map(function (t) { return '<button class="ev-preset" data-tpl="' + t.k + '">' + esc(t.label) + '</button>'; }).join('');
    box.innerHTML =
      '<div class="ev-row"><div class="ov-lbl">PREVIEW <span class="ev-prev-hint">— how players will see it</span></div><div class="ev-preview" id="ev-preview"></div></div>' +
      '<input class="ses-name ev-title" id="ev-title" value="' + esc(ev.title || '') + '" placeholder="Event title (e.g. INCOMING CALL)">' +
      '<div class="ev-row"><div class="ov-lbl">QUICK LAYOUTS</div><div class="ev-presets">' + tplBtns + '</div></div>' +
      '<div class="ev-row"><div class="ov-lbl">BLOCKS</div><div class="ev-blocks">' + (blocks.length ? blocks.map(blockRow).join('') : '<div class="cd-empty">No blocks yet. Add an image or text, or pick a quick layout.</div>') + '</div>' +
        '<div class="ev-addrow"><button class="app-btn" id="ev-addimg">+ Image</button><button class="app-btn" id="ev-addtext">+ Text</button></div></div>' +
      '<div class="ev-row"><div class="ov-lbl">AUTO-TRIGGER</div><div class="ev-trig">when clock ' +
        '<select id="ev-clk"><option value="">— none —</option>' + clocks.map(function (k) { return '<option value="' + k.id + '"' + (ev.trigger && ev.trigger.clockId === k.id ? ' selected' : '') + '>' + esc(k.label || 'clock') + '</option>'; }).join('') + '</select>' +
        ' drops below <input type="number" id="ev-below" min="0" style="width:56px" value="' + (ev.trigger ? (ev.trigger.below != null ? ev.trigger.below : 1) : 1) + '"></div></div>';
    el('ev-title').onchange = function () { ev.title = el('ev-title').value; savePrep(cdRerender); };
    box.querySelectorAll('[data-tpl]').forEach(function (b) { b.onclick = function () { var t = EV_TEMPLATES.filter(function (x) { return x.k === b.getAttribute('data-tpl'); })[0]; if (t) { ev.blocks = t.make(); savePrep(cdRerender); } }; });
    el('ev-addimg').onclick = function () { blocks.push(_blImg('', 'm')); savePrep(cdRerender); };
    el('ev-addtext').onclick = function () { blocks.push(_blTxt('', 'panel', 'l')); savePrep(cdRerender); };
    function bi(node, attr) { return blocks[+node.getAttribute(attr)]; }
    function refreshPreview() { if (window.FilmWindow && window.FilmWindow.preview) window.FilmWindow.preview(el('ev-preview'), eventReveal(ev)); }
    box.querySelectorAll('[data-bsize]').forEach(function (s) { s.onchange = function () { bi(s, 'data-bsize').size = s.value; savePrep(cdRerender); }; });
    box.querySelectorAll('[data-balign]').forEach(function (s) { s.onchange = function () { bi(s, 'data-balign').align = s.value; savePrep(cdRerender); }; });
    box.querySelectorAll('[data-bup]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-bup'); if (i > 0) { var t = blocks[i - 1]; blocks[i - 1] = blocks[i]; blocks[i] = t; savePrep(cdRerender); } }; });
    box.querySelectorAll('[data-bdn]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-bdn'); if (i < blocks.length - 1) { var t = blocks[i + 1]; blocks[i + 1] = blocks[i]; blocks[i] = t; savePrep(cdRerender); } }; });
    box.querySelectorAll('[data-brm]').forEach(function (b) { b.onclick = function () { blocks.splice(+b.getAttribute('data-brm'), 1); savePrep(cdRerender); }; });
    box.querySelectorAll('[data-bimg]').forEach(function (inp) { inp.onchange = function () { var f = inp.files[0]; if (f) readImage(f, function (u) { bi(inp, 'data-bimg').src = u; savePrep(cdRerender); }); }; });
    box.querySelectorAll('[data-bclr]').forEach(function (b) { b.onclick = function () { bi(b, 'data-bclr').src = ''; savePrep(cdRerender); }; });
    box.querySelectorAll('[data-bcam]').forEach(function (inp) { inp.onchange = function () { bi(inp, 'data-bcam').cam = inp.value; savePrep(); refreshPreview(); }; });
    box.querySelectorAll('[data-btext]').forEach(function (ta) { ta.onchange = function () { bi(ta, 'data-btext').text = ta.value; savePrep(); refreshPreview(); }; });
    box.querySelectorAll('[data-bmode]').forEach(function (s) { s.onchange = function () { bi(s, 'data-bmode').mode = s.value; savePrep(); refreshPreview(); }; });
    box.querySelectorAll('[data-bspk]').forEach(function (inp) { inp.onchange = function () { bi(inp, 'data-bspk').speaker = inp.value; savePrep(); refreshPreview(); }; });
    box.querySelectorAll('[data-bnpc]').forEach(function (sel) { sel.onchange = function () {
      var nm = sel.value, b = bi(sel, 'data-bnpc'); if (!nm) return;
      fetch('/__api/campaigns/' + encodeURIComponent(state.campaignId) + '/npcs/' + encodeURIComponent(nm)).then(function (r) { return r.json(); }).then(function (j) { b.src = (j && j.photo) || b.src || ''; if (!b.cam) b.cam = 'ID ● ' + idOf(nm); savePrep(cdRerender); }).catch(function () {});
    }; });
    function saveTrig() { var cid = el('ev-clk').value; ev.trigger = cid ? { clockId: cid, below: parseInt(el('ev-below').value, 10) || 0 } : null; savePrep(); }
    el('ev-clk').onchange = saveTrig; el('ev-below').onchange = saveTrig;
    if (window.FilmWindow && window.FilmWindow.preview) window.FilmWindow.preview(el('ev-preview'), eventReveal(ev));
  }
  function eventReveal(ev) { return { kind: 'event', title: ev.title || '', tabs: ev.tabs || null, blocks: evBlocks(ev), ts: Date.now() }; }
  function linkedEventsHtml(k) {
    var linked = (prep().events || []).filter(function (e) { return e.trigger && e.trigger.clockId === k.id; });
    return linked.length
      ? '<div class="ev-linked">' + linked.map(function (e) { return '<span class="ev-linkchip">▸ ' + esc(e.title || 'event') + ' · below ' + e.trigger.below + '</span>'; }).join('') + '</div>'
      : '<span class="cd-empty">No events trigger from this clock yet. Set a clock trigger on an event.</span>';
  }
  // Clock editor in the Events canvas (clocks live alongside events — they link).
  function renderClockCanvas(box, k) {
    var pct = Math.round(((k.value || 0) / (k.max || 1)) * 100);
    box.innerHTML =
      '<input class="ses-name ev-title" id="clk-label" value="' + esc(k.label || '') + '" placeholder="Clock name (Alarm / Heat / Countdown…)">' +
      '<div class="ev-row"><div class="ov-lbl">SEGMENTS (MAX)</div><div class="ev-trig"><button class="prep-mini" id="clk-maxm">−</button><span class="clock-val" id="clk-maxv">' + (k.max || 6) + '</span><button class="prep-mini" id="clk-maxp">+</button> &nbsp;segments</div></div>' +
      '<div class="ev-row"><div class="ov-lbl">FILLED</div><div class="ev-trig"><button class="prep-mini" id="clk-valm">−</button><span class="clock-val">' + (k.value || 0) + ' / ' + (k.max || 6) + '</span><button class="prep-mini" id="clk-valp">+</button></div>' +
        '<div class="clock-bar" style="margin-top:8px"><span style="width:' + pct + '%;background:' + (k.color || '#b8860b') + '"></span></div></div>' +
      '<div class="ev-row"><div class="ov-lbl">COLOR</div><div class="ev-colors">' + CLOCK_COLORS.map(function (col) { return '<button class="ev-color' + (k.color === col ? ' active' : '') + '" data-col="' + col + '" style="background:' + col + '"></button>'; }).join('') + '</div></div>' +
      '<div class="ev-row"><div class="ov-lbl">LINKED EVENTS</div>' + linkedEventsHtml(k) + '</div>';
    el('clk-label').onchange = function () { k.label = el('clk-label').value; savePrep(cdRerender); };
    el('clk-maxp').onclick = function () { k.max = (k.max || 6) + 1; savePrep(cdRerender); };
    el('clk-maxm').onclick = function () { k.max = Math.max(1, (k.max || 6) - 1); if (k.value > k.max) k.value = k.max; savePrep(cdRerender); };
    el('clk-valp').onclick = function () { k.value = Math.min(k.max || 6, (k.value || 0) + 1); savePrep(cdRerender); };
    el('clk-valm').onclick = function () { k.value = Math.max(0, (k.value || 0) - 1); savePrep(cdRerender); };
    box.querySelectorAll('[data-col]').forEach(function (b) { b.onclick = function () { k.color = b.getAttribute('data-col'); savePrep(cdRerender); }; });
  }

  function memberLabel(m) {
    if (m.kind === 'pc-all') return 'All player characters';
    if (m.kind === 'npcfile') return idOf(m.name);
    if (m.kind === 'archetype') return (window.NPCGen && ((m.params.tier || '') + ' ' + m.params.archetype)) || 'archetype';
    if (m.kind === 'mook') return (m.sheet && m.sheet.role) || 'mook';
    return '?';
  }
  /* Reusable drag-drop helpers (palette → bins/containers). Shared by Squads + Loot. */
  function makeDraggable(node, payload) {
    node.setAttribute('draggable', 'true');
    node.addEventListener('dragstart', function (e) { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', JSON.stringify(payload)); e.stopPropagation(); });
  }
  function makeDropZone(node, onDrop) {
    node.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); node.classList.add('dnd-over'); });
    node.addEventListener('dragleave', function () { node.classList.remove('dnd-over'); });
    node.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation(); node.classList.remove('dnd-over');
      var raw = e.dataTransfer.getData('text/plain'); if (!raw) return;
      var obj; try { obj = JSON.parse(raw); } catch (x) { return; }
      onDrop(obj);
    });
  }

  /* Squads — palette (NPC files + archetypes + PCs) drag-dropped into squad bins.
     Refs are resolved to combatants at combat launch. A squad can link a loot box. */
  function cdSquads(c) {
    var sq = prep().squads, npcDocs = (cdData.docs && cdData.docs.npcs) || [], loots = prep().loot;
    var palItems = [{ cls: 'sq-pc', label: '◈ All PCs', payload: { kind: 'pc-all' } }]
      .concat(npcDocs.map(function (d) { return { cls: '', label: '☗ ' + idOf(d.name), payload: { kind: 'npcfile', name: d.name, count: 1 } }; }))
      .concat(window.NPCGen ? window.NPCGen.list().map(function (a) { return { cls: 'sq-arch', label: '◆ ' + a.label, payload: { kind: 'archetype', params: { archetype: a.id, tier: 'average' }, count: 1 } }; }) : []);
    var palette = '<div class="cd-side-head">Palette</div><div class="cd-side-sub">Drag into a squad →</div><div class="sq-palette">' +
      palItems.map(function (p, i) { return '<div class="sq-pchip ' + p.cls + '" data-pi="' + i + '">' + esc(p.label) + '</div>'; }).join('') + '</div>';
    var bins = sq.length ? sq.map(function (s) {
      var lootOpts = '<option value="">— link loot —</option>' + loots.map(function (g) { return '<option value="' + g.id + '"' + (s.lootId === g.id ? ' selected' : '') + '>' + esc(g.name || 'Loot') + '</option>'; }).join('');
      return '<div class="sq-bin" data-bin="' + s.id + '">' +
        '<div class="sq-bin-head"><input class="prep-title sq-name" data-sqn="' + s.id + '" value="' + esc(s.name || '') + '" placeholder="Squad name">' +
          '<select class="run-sel" data-sqloot="' + s.id + '">' + lootOpts + '</select>' +
          (window.NPCGen ? '<button class="prep-mini" data-sqarch="' + s.id + '">◆ tune</button>' : '') +
          '<button class="prep-mini prep-del" data-sqdel="' + s.id + '">✕</button></div>' +
        '<div class="sq-members">' + ((s.members || []).length ? s.members.map(function (m, i) {
          return '<div class="sq-m"><span>' + esc(memberLabel(m)) + '</span>' + (m.kind !== 'pc-all' ? '<span class="sq-mc">×' + (m.count || 1) + '</span><button class="prep-mini" data-sqdec="' + s.id + ':' + i + '">−</button><button class="prep-mini" data-sqinc="' + s.id + ':' + i + '">+</button>' : '') +
            '<button class="prep-mini prep-del" data-sqrm="' + s.id + ':' + i + '">✕</button></div>';
        }).join('') : '<div class="cd-empty sq-drop-hint">Drop combatants here.</div>') + '</div></div>';
    }).join('') : '<div class="cd-empty">No squads. Add one, then drag combatants in.</div>';
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">Squads</div><span style="flex:1"></span><button class="app-btn app-btn-go" id="cd-add">+ Squad</button></div>' +
      '<div class="cd-board"><div class="sq-side">' + palette + '</div><div class="cd-boardmain"><div class="sq-bins" id="sq-bins">' + bins + '</div></div></div>';
    el('cd-add').onclick = function () { sq.push({ id: uid('sq'), name: 'Squad ' + (sq.length + 1), members: [], lootId: null }); savePrep(cdRerender); };
    c.querySelectorAll('[data-pi]').forEach(function (n) { makeDraggable(n, palItems[+n.getAttribute('data-pi')].payload); });
    c.querySelectorAll('[data-bin]').forEach(function (bin) {
      var s = item(sq, bin.getAttribute('data-bin'));
      makeDropZone(bin, function (m) { if (m.kind === 'pc-all' && (s.members || []).some(function (x) { return x.kind === 'pc-all'; })) return; (s.members || (s.members = [])).push(m); savePrep(cdRerender); });
    });
    c.querySelectorAll('[data-sqn]').forEach(function (inp) { inp.onchange = function () { item(sq, inp.getAttribute('data-sqn')).name = inp.value; savePrep(); }; });
    c.querySelectorAll('[data-sqloot]').forEach(function (sel) { sel.onchange = function () { item(sq, sel.getAttribute('data-sqloot')).lootId = sel.value || null; savePrep(); }; });
    c.querySelectorAll('[data-sqdel]').forEach(function (b) { b.onclick = function () { cdData.meta.prep.squads = sq.filter(function (x) { return x.id !== b.getAttribute('data-sqdel'); }); savePrep(cdRerender); }; });
    function memberAt(spec) { var p = spec.split(':'); return { s: item(sq, p[0]), i: +p[1] }; }
    c.querySelectorAll('[data-sqrm]').forEach(function (b) { b.onclick = function () { var r = memberAt(b.getAttribute('data-sqrm')); r.s.members.splice(r.i, 1); savePrep(cdRerender); }; });
    c.querySelectorAll('[data-sqinc]').forEach(function (b) { b.onclick = function () { var r = memberAt(b.getAttribute('data-sqinc')); var m = r.s.members[r.i]; m.count = Math.min(20, (m.count || 1) + 1); savePrep(cdRerender); }; });
    c.querySelectorAll('[data-sqdec]').forEach(function (b) { b.onclick = function () { var r = memberAt(b.getAttribute('data-sqdec')); var m = r.s.members[r.i]; m.count = Math.max(1, (m.count || 1) - 1); savePrep(cdRerender); }; });
    c.querySelectorAll('[data-sqarch]').forEach(function (b) { b.onclick = function () { var s = item(sq, b.getAttribute('data-sqarch')); archetypeGenModal({ onParams: function (p, count) { (s.members || (s.members = [])).push({ kind: 'archetype', params: p, count: count || 1 }); savePrep(cdRerender); } }); }; });
  }

  /* Locations — the Night City GM planner, campaign-scoped. Locations marked
     "public" (in the planner's place editor) push live to players in session. */
  function cdLocations(c) {
    c.innerHTML = '<iframe class="cd-ncframe-full" src="nightcity.html?campaign=' + encodeURIComponent(state.campaignId) + '&ncrole=gm"></iframe>';
  }
  // Pull the campaign's public NC places and push them to players via the overview.
  function pushCampaignLocations(id) {
    fetch('/__api/campaigns/' + encodeURIComponent(id) + '/nightcity/_campaign.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var g = d && d.GM, nb = g && g.list && g.list[Math.min(g.active || 0, (g.list.length || 1) - 1)];
      var places = nb ? (nb.entries || []).filter(function (e) { return e.public; }) : [];
      var byId = {}; ((g && g.maps) || []).forEach(function (m) { byId[m.id] = m; });
      var ord = (g && Array.isArray(g.order) && g.order.length) ? g.order : ['nc'].concat(((g && g.maps) || []).map(function (m) { return m.id; }));
      var maps = [];
      ord.forEach(function (mid) { if (mid === 'nc') return; var m = byId[mid]; if (!m) return; var pub = (m.entries || []).filter(function (e) { return e.public; }); if (pub.length) maps.push({ id: m.id, name: m.name, kind: m.kind, image: m.image, w: m.w, h: m.h, gmEntries: pub }); });
      var locOrder = ord.filter(function (mid) { return mid === 'nc' || maps.some(function (m) { return m.id === mid; }); });
      if (sess.camp && sess.camp.setOverview) sess.camp.setOverview({ locations: places, locMaps: maps, locOrder: locOrder });
    });
  }
  function openToolOverlay(url, title) {
    var ov = document.createElement('div'); ov.className = 'cdoc-overlay'; ov.id = 'tool-overlay';
    ov.innerHTML = '<div class="cdoc-bar"><span class="cdoc-title">' + esc(title) + '</span><button class="app-btn" id="tool-ov-close" style="margin-left:auto">Close</button></div><div style="flex:1;min-height:0"><iframe src="' + esc(url) + '" style="width:100%;height:100%;border:none"></iframe></div>';
    document.body.appendChild(ov);
    el('tool-ov-close').onclick = function () { ov.parentNode.removeChild(ov); };
  }

  /* Clocks live inside Events now (see renderClockCanvas). */
  var CLOCK_COLORS = ['#c0392b', '#b8860b', '#1a7a2e', '#7a5ab8'];

  /* Loot — palette (money / IP / objects from DBs / container) drag-dropped into
     nested container boxes. Level-0 nodes (and money, not IP) are unique or shared. */
  var LOOT_DBS = null;
  function loadLootDBs() {
    if (LOOT_DBS) return Promise.resolve(LOOT_DBS);
    var files = [['data/cp2020weapons.json', 'weapon'], ['data/cyberware.json', 'cyberware'], ['data/cp2020gear.json', 'gear'], ['data/cp2020-vehicles.json', 'vehicle'], ['data/cp2020decks.json', 'deck'], ['data/cp2020programs.json', 'program']];
    return Promise.all(files.map(function (f) { return fetch(f[0]).then(function (r) { return r.json(); }).catch(function () { return []; }); })).then(function (res) {
      var out = [];
      res.forEach(function (rows, i) { var cat = files[i][1]; (Array.isArray(rows) ? rows : (rows && rows.items) || []).forEach(function (row) { var nm = row.name || row.model || row.title; if (!nm) return; var c2 = (cat === 'gear' && row.category === 'ARMOR/CLOTHING') ? 'armor' : cat; out.push({ cat: c2, name: nm, data: Object.assign({ name: nm }, row) }); }); });
      LOOT_DBS = out; return out;
    });
  }
  function lootNodeLabel(n) {
    if (n.type === 'money') return '€$' + (n.amount || 0) + (n.form && n.form !== 'eddies' ? ' ' + n.form : '');
    if (n.type === 'ip') return (n.amount || 0) + ' IP';
    if (n.type === 'container') return (n.name || 'Container') + ' (' + (n.children || []).length + ')';
    return n.name || 'Item';
  }
  function findLootNode(arr, nid) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === nid) return { arr: arr, i: i, node: arr[i] }; if (arr[i].children) { var r = findLootNode(arr[i].children, nid); if (r) return r; } } return null; }
  function paletteToNode(pal, isTop) {
    var n = { id: uid('ln') };
    if (pal.kind === 'lootmoney') { n.type = 'money'; n.amount = 0; n.form = 'eddies'; }
    else if (pal.kind === 'lootip') { n.type = 'ip'; n.amount = 0; return n; }
    else if (pal.kind === 'lootcontainer') { n.type = 'container'; n.name = 'Container'; n.children = []; }
    else if (pal.kind === 'lootcustom') { n.type = 'item'; n.cat = 'custom'; n.name = 'Item'; }
    else { n.type = 'item'; n.cat = pal.cat; n.name = pal.name; n.data = pal.data; }
    if (isTop) n.share = 'shared';
    return n;
  }
  function lootNodeHtml(n, depth, boxId) {
    var top = depth === 0, uniq = n.share === 'unique';
    var shareBtn = (top && n.type !== 'ip') ? '<button class="prep-mini loot-share' + (uniq ? ' on' : '') + '" data-nshare="' + n.id + '" title="unique = one player; shared = everyone">' + (uniq ? 'UNIQUE' : 'shared') + '</button>' : '';
    var del = '<button class="prep-mini prep-del" data-nrm="' + n.id + '">✕</button>';
    if (n.type === 'money') return '<div class="loot-node"><span class="loot-ico">€$</span><input class="loot-amt" type="number" data-amt="' + n.id + '" value="' + (n.amount || 0) + '"><input class="loot-form" data-form="' + n.id + '" value="' + esc(n.form || 'eddies') + '" placeholder="form">' + shareBtn + del + '</div>';
    if (n.type === 'ip') return '<div class="loot-node"><span class="loot-ico">IP</span><input class="loot-amt" type="number" data-amt="' + n.id + '" value="' + (n.amount || 0) + '">' + del + '</div>';
    if (n.type === 'container') return '<div class="loot-node loot-cont"><span class="loot-ico">▣</span><input class="loot-cname" data-nname="' + n.id + '" value="' + esc(n.name || '') + '" placeholder="Container">' + shareBtn + del +
      '<div class="loot-tree loot-sub" data-drop="node:' + n.id + '">' + ((n.children || []).map(function (ch) { return lootNodeHtml(ch, depth + 1, boxId); }).join('') || '<span class="loot-hint">drop items here</span>') + '</div></div>';
    return '<div class="loot-node"><span class="loot-cat">' + esc(n.cat || 'item') + '</span><input class="loot-iname" data-nname="' + n.id + '" value="' + esc(n.name || '') + '">' + shareBtn + del + '</div>';
  }
  function cdLoot(c) {
    var lt = prep().loot, events = prep().events, squads = prep().squads;
    var boxes = lt.length ? lt.map(function (g) {
      var evOpts = '<option value="">— event —</option>' + events.map(function (e) { return '<option value="' + e.id + '"' + (g.linkedEventId === e.id ? ' selected' : '') + '>' + esc(e.title || 'event') + '</option>'; }).join('');
      var sqOpts = '<option value="">— squad —</option>' + squads.map(function (s) { return '<option value="' + s.id + '"' + (g.linkedSquadId === s.id ? ' selected' : '') + '>' + esc(s.name || 'squad') + '</option>'; }).join('');
      return '<div class="sq-bin loot-box" data-box="' + g.id + '">' +
        '<div class="sq-bin-head"><input class="prep-title" data-boxn="' + g.id + '" value="' + esc(g.name || '') + '" placeholder="Loot box name">' +
          '<select class="run-sel" data-boxev="' + g.id + '">' + evOpts + '</select><select class="run-sel" data-boxsq="' + g.id + '">' + sqOpts + '</select>' +
          '<button class="prep-mini prep-del" data-boxdel="' + g.id + '">✕</button></div>' +
        '<div class="loot-tree" data-drop="box:' + g.id + '">' + ((g.nodes || []).map(function (n) { return lootNodeHtml(n, 0, g.id); }).join('') || '<span class="loot-hint">Drag money, IP, objects or a container here.</span>') + '</div></div>';
    }).join('') : '<div class="cd-empty">No loot boxes. Add one, then drag rewards in.</div>';
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">Loot</div><span style="flex:1"></span><button class="app-btn app-btn-go" id="cd-add">+ Loot box</button></div>' +
      '<div class="cd-board"><div class="sq-side" id="loot-pal">' +
        '<div class="cd-side-head">Palette</div><div class="cd-side-sub">Drag into a box →</div><div class="sq-palette loot-palfix">' +
          '<div class="sq-pchip" data-pal=\'{"kind":"lootmoney"}\'>€$ Money</div>' +
          '<div class="sq-pchip" data-pal=\'{"kind":"lootip"}\'>IP</div>' +
          '<div class="sq-pchip" data-pal=\'{"kind":"lootcontainer"}\'>▣ Container</div>' +
          '<div class="sq-pchip" data-pal=\'{"kind":"lootcustom"}\'>＋ Custom item</div>' +
        '</div><input class="pc-in loot-search" id="loot-search" placeholder="Search weapons, gear, cyber…"><div class="loot-results" id="loot-results"></div>' +
      '</div><div class="cd-boardmain"><div class="sq-bins" id="loot-bins">' + boxes + '</div></div></div>';
    el('cd-add').onclick = function () { lt.push({ id: uid('loot'), name: 'Loot ' + (lt.length + 1), linkedEventId: null, linkedSquadId: null, nodes: [] }); savePrep(cdRerender); };
    c.querySelectorAll('#loot-pal [data-pal]').forEach(function (n) { makeDraggable(n, JSON.parse(n.getAttribute('data-pal'))); });
    // Wire each box: header, drop zones (root + containers), node edits.
    c.querySelectorAll('[data-box]').forEach(function (binEl) {
      var g = item(lt, binEl.getAttribute('data-box'));
      binEl.querySelectorAll('[data-drop]').forEach(function (zone) {
        var spec = zone.getAttribute('data-drop'), isTop = spec.indexOf('box:') === 0;
        makeDropZone(zone, function (pal) {
          var target = isTop ? (g.nodes || (g.nodes = [])) : (findLootNode(g.nodes, spec.slice(5)).node.children);
          target.push(paletteToNode(pal, isTop)); savePrep(cdRerender);
        });
      });
    });
    c.querySelectorAll('[data-boxn]').forEach(function (i) { i.onchange = function () { item(lt, i.getAttribute('data-boxn')).name = i.value; savePrep(); }; });
    c.querySelectorAll('[data-boxev]').forEach(function (s) { s.onchange = function () { item(lt, s.getAttribute('data-boxev')).linkedEventId = s.value || null; savePrep(); }; });
    c.querySelectorAll('[data-boxsq]').forEach(function (s) { s.onchange = function () { item(lt, s.getAttribute('data-boxsq')).linkedSquadId = s.value || null; savePrep(); }; });
    c.querySelectorAll('[data-boxdel]').forEach(function (b) { b.onclick = function () { cdData.meta.prep.loot = lt.filter(function (x) { return x.id !== b.getAttribute('data-boxdel'); }); savePrep(cdRerender); }; });
    function boxOf(binEl) { return item(lt, binEl.closest('[data-box]').getAttribute('data-box')); }
    c.querySelectorAll('[data-nrm]').forEach(function (b) { b.onclick = function () { var g = boxOf(b), r = findLootNode(g.nodes, b.getAttribute('data-nrm')); if (r) r.arr.splice(r.i, 1); savePrep(cdRerender); }; });
    c.querySelectorAll('[data-nshare]').forEach(function (b) { b.onclick = function () { var g = boxOf(b), r = findLootNode(g.nodes, b.getAttribute('data-nshare')); if (r) r.node.share = r.node.share === 'unique' ? 'shared' : 'unique'; savePrep(cdRerender); }; });
    c.querySelectorAll('[data-amt]').forEach(function (i) { i.onchange = function () { var g = boxOf(i), r = findLootNode(g.nodes, i.getAttribute('data-amt')); if (r) r.node.amount = parseInt(i.value, 10) || 0; savePrep(); }; });
    c.querySelectorAll('[data-form]').forEach(function (i) { i.onchange = function () { var g = boxOf(i), r = findLootNode(g.nodes, i.getAttribute('data-form')); if (r) r.node.form = i.value; savePrep(); }; });
    c.querySelectorAll('[data-nname]').forEach(function (i) { i.onchange = function () { var g = boxOf(i), r = findLootNode(g.nodes, i.getAttribute('data-nname')); if (r) r.node.name = i.value; savePrep(); }; });
    // Searchable DB palette.
    var search = el('loot-search'), results = el('loot-results');
    function renderResults(q) {
      q = (q || '').toLowerCase().trim();
      if (!q || !LOOT_DBS) { results.innerHTML = q ? '<span class="loot-hint">…</span>' : ''; return; }
      var hits = LOOT_DBS.filter(function (e) { return e.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 24);
      // Index-based payloads: item names may contain quotes/apostrophes that would
      // break a JSON-in-attribute and abort the drag wiring for items below.
      results.innerHTML = hits.length ? hits.map(function (e, i) { return '<div class="sq-pchip loot-res" data-ri="' + i + '"><span class="loot-cat">' + esc(e.cat) + '</span>' + esc(e.name) + '</div>'; }).join('') : '<span class="loot-hint">no match</span>';
      results.querySelectorAll('[data-ri]').forEach(function (n) { var e = hits[+n.getAttribute('data-ri')]; makeDraggable(n, { kind: 'lootitem', cat: e.cat, name: e.name, data: e.data }); });
    }
    loadLootDBs().then(function () { if (search && search.value) renderResults(search.value); });
    if (search) search.oninput = function () { renderResults(search.value); };
  }

  function renderType(detail) {
    var id = state.campaignId, type = state.type;
    var items = ((detail.docs && detail.docs[type]) || []).filter(function (it) { return !/^_/.test(it.name); });
    var hasFolder = !!(window.bartmoss && window.bartmoss.pickFolderFiles);
    var editable = TOOL_FOR[type] || type === 'documents';
    var ico = typeIcon(type);
    var list = items.length
      ? items.map(function (it) {
          return '<div class="cd-item"><span class="cd-item-ico">' + ico + '</span><span class="cd-name">' + esc(it.name) + '</span>' +
            '<span class="cd-sub">' + Math.round(it.size / 102.4) / 10 + ' KB</span>' +
            (editable ? '<span class="cd-edit" data-edit="' + esc(it.name) + '">edit</span>' : '') +
            '<a class="cd-open" href="/__api/campaigns/' + encodeURIComponent(id) + '/' + type + '/' + encodeURIComponent(it.name) + '" target="_blank">view</a>' +
            '<span class="cd-x" data-rm="' + esc(it.name) + '">remove</span></div>';
        }).join('')
      : '<div class="cd-empty">Nothing here yet. Drop files, import a folder, or create one.</div>';
    var archPanel = '';
    if (type === 'npcs' && window.NPCGen) {
      archPanel = '<div class="arch-panel"><div class="app-kicker">// BUILT-IN ARCHETYPES <span class="arch-note">generators — not counted</span></div>' +
        '<div class="arch-grid">' + window.NPCGen.list().map(function (a) {
          return '<button class="arch-tile" data-arch="' + esc(a.id) + '"><span class="arch-name">' + esc(a.label) + '</span><span class="arch-desc">' + esc(a.desc) + '</span></button>';
        }).join('') + '</div></div>';
    }
    el('cd-body').innerHTML =
      '<div class="cd-actions">' +
        '<button class="app-btn" id="cd-new">+ New ' + type.replace(/s$/, '') + '</button>' +
        (type === 'npcs' && window.NPCGen ? '<button class="app-btn app-btn-go" id="cd-gen">◆ Generate from archetype</button>' : '') +
        (type === 'orgs' && window.OrgGen ? '<button class="app-btn app-btn-go" id="cd-genorg">◆ Generate organisation</button>' : '') +
        (hasFolder ? '<button class="app-btn" id="cd-folder">Import a folder…</button>' : '') +
      '</div>' +
      '<div class="cd-drop" id="cd-drop"><span class="cd-drop-tag">IMPORT BAY</span> Drag &amp; drop ' + type + ' files here</div>' +
      '<div class="cd-list">' + list + '</div>' + archPanel;

    if (type === 'npcs' && window.NPCGen) {
      var saveBack = function (sheets) { saveGeneratedNPCs(id, sheets, renderCampaignDetail); };
      var gen = el('cd-gen'); if (gen) gen.onclick = function () { archetypeGenModal({ onSave: saveBack }); };
      el('cd-body').querySelectorAll('[data-arch]').forEach(function (t) {
        t.onclick = function () { archetypeGenModal({ preset: t.getAttribute('data-arch'), onSave: saveBack }); };
      });
    }
    if (type === 'orgs' && window.OrgGen) {
      var go = el('cd-genorg'); if (go) go.onclick = function () { orgGenModal(id); };
    }

    el('cd-new').onclick = function () {
      prompt1('New ' + type.replace(/s$/, ''), 'Name', type === 'documents' ? 'notes.md' : 'name', function (name) {
        name = (name || '').trim(); if (!name) return;
        if (type !== 'documents' && !/\.json$/i.test(name)) name += '.json';
        var payload = type === 'documents' ? { name: name, content: '' } : { name: name, json: {} };
        api('POST', 'campaigns/' + encodeURIComponent(id) + '/' + type, payload).then(renderCampaignDetail);
      });
    };
    if (hasFolder) el('cd-folder').onclick = function () {
      window.bartmoss.pickFolderFiles().then(function (files) {
        if (!files || !files.length) return;
        Promise.all(files.map(function (f) { return api('PUT', 'campaigns/' + encodeURIComponent(id) + '/' + type + '/' + encodeURIComponent(f.name), f.content); }))
          .then(renderCampaignDetail);
      });
    };
    el('cd-body').querySelectorAll('[data-rm]').forEach(function (s) {
      s.onclick = function () { var nm = s.getAttribute('data-rm'); confirm1('Remove ' + nm + '?', function () { api('DELETE', 'campaigns/' + encodeURIComponent(id) + '/' + type + '/' + encodeURIComponent(nm)).then(renderCampaignDetail); }); };
    });
    el('cd-body').querySelectorAll('[data-edit]').forEach(function (s) {
      s.onclick = function () { cdOpenDocInline(type, s.getAttribute('data-edit')); };
    });
    wireDrop(el('cd-drop'), id, type);
  }

  /* ── Doc editor overlay: tool via the file-bridge (?cdoc), or a textarea for documents ── */
  function openDocEditor(id, type, name) {
    if (type === 'documents') return openTextEditor(id, name);
    var tool = TOOL_FOR[type]; if (!tool) return;
    var url = tool + '?cdoc=1&cid=' + encodeURIComponent(id) + '&ctype=' + type + '&cname=' + encodeURIComponent(name);
    // onClose flushes the LATEST sheet from the iframe via a parent-side PUT so
    // closing never loses the last edits (the iframe's own save is debounced and
    // would be aborted when the iframe is removed).
    showOverlay(name, '<iframe class="cdoc-frame" id="cdoc-frame" src="' + url + '"></iframe>', function () {
      var fr = el('cdoc-frame'), win = fr && fr.contentWindow, ad = win && win.__cdocAdapter;
      var obj; try { obj = ad && ad.serialize(); } catch (e) { obj = null; }
      if (obj == null) return Promise.resolve();
      return api('PUT', 'campaigns/' + encodeURIComponent(id) + '/' + type + '/' + encodeURIComponent(name), obj);
    });
  }
  function openTextEditor(id, name) {
    var docPath = 'campaigns/' + encodeURIComponent(id) + '/documents/' + encodeURIComponent(name);
    fetch('/__api/' + docPath).then(function (r) { return r.text(); }).then(function (txt) {
      showOverlay(name, '<textarea class="cdoc-textarea" id="cdoc-ta"></textarea>', function () {
        var ta = el('cdoc-ta'); if (!ta) return Promise.resolve();
        return fetch('/__api/' + docPath, { method: 'PUT', body: ta.value });
      });
      var ta = el('cdoc-ta'); ta.value = txt; var t;
      ta.oninput = function () { clearTimeout(t); t = setTimeout(function () { fetch('/__api/' + docPath, { method: 'PUT', body: ta.value }); }, 400); };
    });
  }
  // onClose: optional () => Promise that saves before the overlay is torn down.
  function showOverlay(title, innerHtml, onClose) {
    var ov = document.createElement('div'); ov.className = 'cdoc-overlay'; ov.id = 'cdoc-overlay';
    ov.innerHTML = '<div class="cdoc-bar"><span class="cdoc-title">' + esc(title) + '</span><button class="app-btn" id="cdoc-close">Close</button></div>' + innerHtml;
    document.body.appendChild(ov);
    var closing = false;
    el('cdoc-close').onclick = function () {
      if (closing) return; closing = true;
      var btn = el('cdoc-close'); if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
      Promise.resolve(onClose ? onClose() : null).catch(function () {}).then(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        renderCampaignDetail();
      });
    };
  }

  function wireDrop(zone, id, type) {
    if (!zone) return;
    zone.ondragover = function (e) { e.preventDefault(); zone.classList.add('drag'); };
    zone.ondragleave = function () { zone.classList.remove('drag'); };
    zone.ondrop = function (e) {
      e.preventDefault(); zone.classList.remove('drag');
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (!files.length) return;
      Promise.all(files.map(function (file) {
        return new Promise(function (resolve) {
          var r = new FileReader();
          r.onload = function () { api('PUT', 'campaigns/' + encodeURIComponent(id) + '/' + type + '/' + encodeURIComponent(file.name), r.result).then(resolve, resolve); };
          r.readAsText(file);
        });
      })).then(renderCampaignDetail);
    };
  }

  /* ── Sessions ── */
  var SESS_MODE_KEY = 'bartmoss_sess_mode';
  var sess = { camp: null, id: null, role: 'gm', sheetId: null, section: 'overview', hosted: [], order: [], cols: {}, hub: null, mode: 'grid', active: null, panelOpen: true, activeSessionId: null, toolsExp: true };
  try { var m = localStorage.getItem(SESS_MODE_KEY); if (m === 'grid' || m === 'tabs' || m === 'columns') sess.mode = m; } catch (e) {}
  function idOf(docName) { return String(docName).replace(/\.json$/i, ''); }
  function playerLink(sid) {
    var h = sess.hub || { host: location.hostname, port: location.port };
    // Player link now opens the full session shell (app.html), with their sheet
    // pre-selected as the Live-sheet section.
    return 'http://' + h.host + ':' + h.port + '/app.html?campaign=' + encodeURIComponent(sess.id) + '&sheet=' + encodeURIComponent(sid);
  }

  function saveSessionMeta(id, session) {
    return api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
      var meta = (d && d.meta) || {}; meta.session = Object.assign({}, meta.session, session);
      return api('PUT', 'campaigns/' + encodeURIComponent(id), meta).then(function () { return meta; });
    });
  }

  function startSessionPicker(id, sheetDocs, prevOrder, activeSessionId) {
    if (!sheetDocs.length) { alert('Add at least one sheet to the campaign first.'); return; }
    modalClose();
    var rows = sheetDocs.map(function (d) {
      var sid = idOf(d.name);
      return '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0"><input type="checkbox" data-sid="' + esc(sid) + '" checked> ' + esc(sid) + '</label>';
    }).join('');
    var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal"><div class="app-modal-head">Start session — choose sheets to host</div>' +
      '<div class="app-modal-body">' + rows + '</div>' +
      '<div class="app-modal-actions"><button class="app-btn" data-x>Cancel</button><button class="app-btn app-modal-ok" data-ok>Start</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) modalClose(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = modalClose;
    ov.querySelector('[data-ok]').onclick = function () {
      var hosted = Array.prototype.slice.call(ov.querySelectorAll('input[data-sid]:checked')).map(function (c) { return c.getAttribute('data-sid'); });
      modalClose();
      if (!hosted.length) return;
      var order = (prevOrder || []).filter(function (x) { return hosted.indexOf(x) >= 0; });
      hosted.forEach(function (x) { if (order.indexOf(x) < 0) order.push(x); });
      saveSessionMeta(id, { active: true, paused: false, hosted: hosted, order: order, activeId: activeSessionId || null }).then(function () { openSession(id, hosted, order, activeSessionId || null); });
    };
  }

  /* ── Session shell (4-section sidebar, shared GM + player) ── */
  // Night City lives in the Locations section now, so it's dropped from Tools.
  var SESS_TOOLS = [
    { tool: 'npcsheet', label: 'NPC Sheet', url: 'npc-sheet.html', icon: '☗' },
    { tool: 'galmap', label: 'Galactic Map', url: 'galmap.html', icon: '✷' },
    { tool: 'orgs', label: 'Organisations', url: 'organisations.html', icon: '⬢' },
    { tool: 'outfit', label: 'Outfit Designer', url: 'outfit-designer.html', icon: '◈' },
  ];
  function wsBase() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host; }
  function saveCampaignMeta(id, fields) {
    return api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
      var meta = (d && d.meta) || {}; Object.assign(meta, fields);
      return api('PUT', 'campaigns/' + encodeURIComponent(id), meta).then(function () { return meta; });
    });
  }

  function openSession(id, hosted, order, activeSessionId) {
    sess.id = id; sess.role = 'gm'; sess.hosted = hosted; sess.order = order.slice(); sess.cols = {};
    sess.active = sess.order[0] || null; sess.section = 'overview';
    sess.activeSessionId = activeSessionId || null;
    // The GM keeps full prep powers in session: same campaign data + editors.
    state.campaignId = id; cdHost = null; cdData = null;
    var vc = el('view-campaign'); if (vc) vc.innerHTML = '';   // drop stale prep DOM (avoid id clashes)
    api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) { cdData = d; });
    setMode('active'); showView('view-session');
    el('app-crumbs').innerHTML = '<a id="crumb-home">Campaigns</a> <span class="crumb-sep">/</span> <a id="crumb-camp">' + esc(id) + '</a> <span class="crumb-sep">/</span> <span class="crumb-cur">session</span>';
    var crumbH = el('crumb-home'); if (crumbH) crumbH.onclick = function () { renderCampaigns(); };
    var crumbC = el('crumb-camp'); if (crumbC) crumbC.onclick = function () { openCampaign(id); };
    joinSession(id, { name: 'GM', role: 'gm' });
    logSession('● Session went live — hosting ' + hosted.length + ' sheet' + (hosted.length === 1 ? '' : 's') + '.');
    pushCampaignLocations(id);
    renderSessionShell();
  }
  // Append an entry to the live session's journal (meta.sessions[activeId].log).
  function logSession(msg) {
    if (!sess.activeSessionId || sess.role !== 'gm') return;
    api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) {
      var meta = (d && d.meta) || {}, ss = meta.sessions || [];
      var s = ss.filter(function (x) { return x.id === sess.activeSessionId; })[0];
      if (!s) return;
      if (!Array.isArray(s.log)) s.log = [];
      s.log.push({ ts: Date.now(), msg: msg });
      api('PUT', 'campaigns/' + encodeURIComponent(sess.id), meta);
    }).catch(function () {});
  }
  function openPlayerSession(id, sheetId) {
    sess.id = id; sess.role = 'player'; sess.sheetId = sheetId; sess.order = sheetId ? [sheetId] : [];
    sess.active = sheetId || null; sess.section = 'overview';
    setMode('active'); showView('view-session');
    el('app-crumbs').innerHTML = '<span class="crumb-cur">' + esc(id) + '</span>';
    joinSession(id, { name: sheetId || 'Player', role: 'player' });
    renderSessionShell();
  }
  function joinSession(id, member) {
    if (sess.camp) { try { sess.camp.destroy(); } catch (e) {} }
    sess.camp = window.BartmossSync.join({ url: wsBase(), room: id, member: member });
    fetch('/__hubinfo').then(function (r) { return r.json(); }).then(function (h) { sess.hub = h; }).catch(function () {});
    sess.camp.onPresence(updatePresence);
    sess.camp.onCombatChange(function () {
      syncCombatBtn();
      var m = sess.camp.combatMeta() || {};
      if (!m.active && el('cbt-overlay')) closeCombatStage();
      updateOverviewActions();
    });
    sess.camp.onStatus(function (st) { var e = el('app-status'); if (e) { e.textContent = st === 'connected' ? 'Hub · live' : st; e.className = 'app-status' + (st === 'connected' ? ' on' : ''); } });
    if (sess.camp.onOverview) sess.camp.onOverview(function () {
      refreshOverviewText();
      if (sess.role === 'player' && window.FilmWindow) window.FilmWindow.apply(ovGet().reveal);
      if (sess.role === 'player') ncSyncToFrame();
    });
    // Apply any reveal already present when the player joins.
    if (sess.role === 'player' && window.FilmWindow) setTimeout(function () { window.FilmWindow.apply(ovGet().reveal); }, 400);
  }

  // GM keeps the full prep section set live (create/edit events, loot… mid-game).
  var PREP_LIVE = { events: 1, squads: 1, loot: 1, locations: 1 };
  function sessSections() {
    if (sess.role !== 'gm') return [{ k: 'overview', label: 'Overview' }, { k: 'locations', label: 'Locations' }, { k: 'livesheet', label: 'Live-sheet' }, { k: 'tools', label: 'Tools' }, { k: 'files', label: 'Files' }];
    // GM Tools = quick access to the prep sections (edit live) + standalone tools + combat.
    var subs = [
      { kind: 'section', k: 'events', label: 'Events', icon: SECTION_META.events.icon },
      { kind: 'section', k: 'squads', label: 'Squads', icon: SECTION_META.squads.icon },
      { kind: 'section', k: 'loot', label: 'Loot', icon: SECTION_META.loot.icon },
      { kind: 'section', k: 'locations', label: 'Locations', icon: SECTION_META.locations.icon },
    ].concat(SESS_TOOLS.map(function (t) { return { kind: 'tool', url: t.url, label: t.label, icon: t.icon }; }))
     .concat([{ kind: 'combat', label: 'Combat', icon: '◆' }]);
    return [{ k: 'overview', label: 'Overview' }, { k: 'players', label: 'Players' }, { k: 'tools', label: 'Tools', subs: subs }, { k: 'files', label: 'Files' }];
  }
  function ensureCdData(cb) {
    if (cdData && state.campaignId === sess.id) return cb();
    state.campaignId = sess.id;
    api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) { cdData = d; cb(); }).catch(function () {});
  }
  function renderSessionShell() {
    var paused = sess.camp && sess.camp.isPaused && sess.camp.isPaused();
    var nav = wsRail(sessSections(), sess.section);
    var ctrls = sess.role === 'gm'
      ? '<button class="app-btn" id="sess-share">⇄ Share</button><button class="app-btn" id="sess-pause">' + (paused ? 'Resume' : 'Pause') + '</button><button class="app-btn app-btn-danger" id="sess-end">End</button>'
      : '<button class="app-btn app-btn-danger" id="sess-leave">Leave</button>';
    el('view-session').innerHTML =
      '<div class="sess-top ws-top ws-top-live"><span class="ws-mode ws-mode-live">● LIVE</span><span class="sess-title ws-title">' + esc(sess.id) + '</span>' +
        '<span style="flex:1"></span>' + ctrls + '</div>' +
      '<div class="ws-livebar" id="ws-livebar" hidden></div>' +
      '<div id="sess-paused-bar">' + (paused ? '<div class="sess-paused">SESSION PAUSED — players see a PAUSED banner. Sync continues.</div>' : '') + '</div>' +
      '<div class="sess-shell"><nav class="sess-side ws-rail">' + nav + '</nav><div class="sess-content" id="sess-content"></div></div>';
    el('view-session').querySelectorAll('.sess-nav').forEach(function (b) { b.onclick = function () { gotoSection(b.getAttribute('data-sec')); }; });
    // Tools rail: expand/collapse the quick-tool sub-list; jump straight to a tool.
    el('view-session').querySelectorAll('[data-railexp]').forEach(function (s) {
      s.onclick = function (e) { e.stopPropagation(); sess.toolsExp = !sess.toolsExp; var sub = el('ws-sub-' + s.getAttribute('data-railexp')); if (sub) sub.hidden = !sess.toolsExp; s.textContent = sess.toolsExp ? '▾' : '▸'; };
    });
    el('view-session').querySelectorAll('[data-railtool]').forEach(function (b) {
      b.onclick = function () {
        var tool = b.getAttribute('data-railtool'), lbl = b.getAttribute('data-raillabel');
        gotoSection('tools');
        if (tool === 'combat') sessCombat(); else openSessTool(tool, lbl);
      };
    });
    el('view-session').querySelectorAll('[data-railsec]').forEach(function (b) {
      b.onclick = function () { gotoSection(b.getAttribute('data-railsec')); };
    });
    if (sess.role === 'gm') {
      el('sess-share').onclick = shareLinks;
      el('sess-pause').onclick = function () {
        if (!(sess.camp && sess.camp.setPaused)) return;
        paused = !paused; sess.camp.setPaused(paused); saveSessionMeta(sess.id, { paused: paused });
        el('sess-pause').textContent = paused ? 'Resume' : 'Pause';
        el('sess-paused-bar').innerHTML = paused ? '<div class="sess-paused">SESSION PAUSED — players see a PAUSED banner. Sync continues.</div>' : '';
      };
      el('sess-end').onclick = function () { confirm1('End the session? Player sheets are already saved to the campaign.', function () { saveSessionMeta(sess.id, { active: false }).then(function () { if (sess.camp && sess.camp.setPaused) sess.camp.setPaused(false); openCampaign(sess.id); }); }); };
    } else {
      el('sess-leave').onclick = function () { endSessionConn(); renderPlayerConnect(); };
    }
    gotoSection(sess.section);
    updateOverviewActions();
  }
  function gotoSection(key) {
    sess.section = key;
    // Active state: top-level rail buttons + section sub-items (in the Tools menu).
    el('view-session').querySelectorAll('.sess-nav').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sec') === key); });
    el('view-session').querySelectorAll('[data-railsec]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-railsec') === key); });
    var content = el('sess-content'); if (!content) return;
    // Ensure a panel for the active key (it may live only in the Tools sub-menu).
    var panel = el('sec-' + key);
    if (!panel) { panel = document.createElement('div'); panel.id = 'sec-' + key; panel.className = 'sess-sec'; content.appendChild(panel); }
    content.querySelectorAll('.sess-sec').forEach(function (p) { p.hidden = (p.id !== 'sec-' + key); });
    if (key === 'overview') renderOverview(panel);          // always refresh (dynamic)
    else if (PREP_LIVE[key] && sess.role === 'gm') {        // live prep editor (create/edit mid-game)
      panel.classList.add('sess-sec-prep');
      ensureCdData(function () { cdSection = key; cdHost = panel; cdRenderSection(key, panel); });
    } else if (!panel.dataset.built) { buildSection(key, panel); panel.dataset.built = '1'; }
  }
  function buildSection(key, panel) {
    if (key === 'players') return renderPlayers(panel);
    if (key === 'livesheet') return renderLivesheet(panel);
    if (key === 'locations') return renderLocationsSection(panel);
    if (key === 'tools') return renderTools(panel);
    if (key === 'files') return renderFiles(panel);
  }
  // Player Locations — campaign NC map in player mode; receives public pins live.
  function renderLocationsSection(panel) {
    if (!panel) return;
    panel.classList.add('sess-sec-files');
    panel.innerHTML = '<iframe class="sess-livesheet" src="nightcity.html?campaign=' + encodeURIComponent(sess.id) + '&ncrole=player"></iframe>';
    var fr = panel.querySelector('iframe'); if (fr) fr.onload = ncSyncToFrame;
  }

  /* Overview — online players, actions in progress, campaign name/description,
     player-visible notes and pinned docs (GM edits, player reads). */
  function ovGet() { return (sess.camp && sess.camp.getOverview && sess.camp.getOverview()) || {}; }
  function ovVal(meta, ov, key) { return ov[key] != null ? ov[key] : (meta[key] != null ? meta[key] : ''); }
  function pinsHtml(pinned) {
    return (pinned || []).map(function (p) {
      return '<button class="ov-pin" data-pin="' + esc(p.type + '/' + p.name) + '">▤ ' + esc(idOf(p.name)) + '</button>';
    }).join('') || '<span class="cd-empty">No pinned documents.</span>';
  }
  function renderOverview(panel) {
    if (!panel) return;
    var id = sess.id, gm = sess.role === 'gm';
    api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
      var meta = (d && d.meta) || {};
      // Seed the synced overview from meta once (GM), so players get it live.
      if (gm && sess.camp && sess.camp.setOverview && !Object.keys(ovGet()).length) {
        sess.camp.setOverview({ description: meta.description || '', playerNotes: meta.playerNotes || '', pinned: meta.pinned || [] });
      }
      var ov = ovGet();
      var desc = ovVal(meta, ov, 'description'), notes = ovVal(meta, ov, 'playerNotes'), pinned = ov.pinned || meta.pinned || [];
      var paused = sess.camp && sess.camp.isPaused && sess.camp.isPaused();
      var nSheets = (sess.role === 'gm' ? sess.order.length : (meta.sheets || 0));
      panel.innerHTML =
        '<div class="ov-banner">' +
          '<div class="ov-banner-main"><div class="app-kicker">// CAMPAIGN</div><h2 class="ov-title">' + esc(meta.name || id) + '</h2></div>' +
          '<div class="ov-chips">' +
            '<span class="ov-chip ' + (paused ? 'ov-chip-warn' : 'ov-chip-live') + '">' + (paused ? '❚❚ PAUSED' : '● LIVE') + '</span>' +
            '<span class="ov-chip"><b id="ov-pcount">0</b> online</span>' +
            '<span class="ov-chip"><b>' + nSheets + '</b> sheet' + (nSheets === 1 ? '' : 's') + '</span>' +
            '<span class="ov-chip" id="ov-combat-chip" hidden>⚔ COMBAT</span>' +
          '</div>' +
        '</div>' +
        '<div class="ov-cols">' +
          '<div class="ov-col-main">' +
            '<div class="ov-block"><div class="ov-lbl">BRIEFING</div>' +
              (gm ? '<textarea class="ov-edit" id="ov-desc" placeholder="Campaign description (visible to players)…">' + esc(desc) + '</textarea>'
                  : '<div class="ov-read" id="ov-desc-read">' + (esc(desc) || '<span class="cd-empty">No description yet.</span>') + '</div>') + '</div>' +
            '<div class="ov-block"><div class="ov-lbl">NOTES TO PLAYERS</div>' +
              (gm ? '<textarea class="ov-edit ov-edit-sm" id="ov-notes" placeholder="Notes shown to players…">' + esc(notes) + '</textarea>'
                  : '<div class="ov-read" id="ov-notes-read">' + (esc(notes) || '<span class="cd-empty">—</span>') + '</div>') + '</div>' +
          '</div>' +
          '<div class="ov-col-side">' +
            '<div class="ov-block"><div class="ov-lbl">ONLINE</div><div id="ov-online" class="ov-online"></div></div>' +
            '<div class="ov-block"><div class="ov-lbl">IN PROGRESS</div><div id="ov-actions" class="ov-actions">—</div></div>' +
            '<div class="ov-block"><div class="ov-lbl">PINNED</div><div class="ov-pins" id="ov-pins">' + pinsHtml(pinned) + '</div></div>' +
            buildRun(meta, gm, ov, d.docs || {}) +
          '</div>' +
        '</div>';
      if (gm) {
        // Edit → persist to meta.json AND push live to the synced overview.
        var dsc = el('ov-desc'); if (dsc) dsc.oninput = function () { saveCampaignMeta(id, { description: dsc.value }); sess.camp.setOverview({ description: dsc.value }); };
        var nts = el('ov-notes'); if (nts) nts.oninput = function () { saveCampaignMeta(id, { playerNotes: nts.value }); sess.camp.setOverview({ playerNotes: nts.value }); };
        wireRun(panel, meta, id);
      }
      wirePins(panel);
      updatePresenceFromCamp(); updateOverviewActions();
    });
  }
  function playerClocksHtml(clocks) {
    clocks = clocks || [];
    return clocks.length ? clocks.map(function (k) {
      var pct = Math.round(((k.value || 0) / (k.max || 1)) * 100);
      return '<div class="run-clock"><div class="run-crow"><span>' + esc(k.label || 'Clock') + '</span><span class="run-cval">' + (k.value || 0) + '/' + (k.max || 6) + '</span></div>' +
        '<div class="clock-bar"><span style="width:' + pct + '%;background:' + (k.color || '#b8860b') + '"></span></div></div>';
    }).join('') : '<span class="cd-empty">—</span>';
  }
  // GM "run" panel (reveal events, advance/reveal clocks, give loot) or player clocks.
  function buildRun(meta, gm, ov, docs) {
    var p = (meta && meta.prep) || {}; docs = docs || {};
    if (!gm) return '<div class="ov-block" id="ov-clocks"><div class="ov-lbl">CLOCKS</div>' + playerClocksHtml(ov.clocks) + '</div>';
    var revIds = (ov.clocks || []).map(function (k) { return k.id; });
    var events = (p.events || []).length ? (p.events || []).map(function (s) {
      return '<div class="run-row"><span class="run-name">' + esc(s.title || '(untitled)') + '</span>' + (s.trigger && s.trigger.clockId ? '<span class="run-cval" title="auto-triggers">⏱</span>' : '') + '<button class="prep-mini" data-revevent="' + s.id + '">▸ reveal</button></div>';
    }).join('') : '<span class="cd-empty">No events prepared.</span>';
    var clocks = (p.clocks || []).length ? (p.clocks || []).map(function (k) {
      var on = revIds.indexOf(k.id) >= 0;
      return '<div class="run-row"><span class="run-name">' + esc(k.label || 'Clock') + '</span><span class="run-cval" id="runclkv-' + k.id + '">' + (k.value || 0) + '/' + (k.max || 6) + '</span>' +
        '<button class="prep-mini" data-clkm="' + k.id + '">−</button><button class="prep-mini" data-clkp="' + k.id + '">+</button>' +
        '<button class="prep-mini' + (on ? ' on' : '') + '" id="runclkrev-' + k.id + '" data-clkrev="' + k.id + '">' + (on ? '👁 shown' : 'reveal') + '</button></div>';
    }).join('') : '<span class="cd-empty">No clocks.</span>';
    var loot = (p.loot || []).length ? (p.loot || []).map(function (g) {
      return '<div class="run-row"><span class="run-name">' + esc(g.name || 'Loot') + '</span><span class="run-cval">' + lootSummary(g) + '</span>' +
        '<button class="prep-mini" data-lootgive="' + g.id + '">give</button></div>';
    }).join('') : '<span class="cd-empty">No loot.</span>';
    var npcs = (docs.npcs || []).length ? (docs.npcs || []).map(function (nf) {
      return '<div class="run-row"><span class="run-name">' + esc(idOf(nf.name)) + '</span><button class="prep-mini" data-npcpresent="' + esc(nf.name) + '">▸ present</button></div>';
    }).join('') : '<span class="cd-empty">No NPCs.</span>';
    return '<div class="ov-block"><div class="ov-lbl">RUN — EVENTS</div>' + events + '</div>' +
      '<div class="ov-block"><div class="ov-lbl">NPCS — present to players</div>' + npcs + '</div>' +
      '<div class="ov-block"><div class="ov-lbl">CLOCKS</div>' + clocks + '</div>' +
      '<div class="ov-block"><div class="ov-lbl">LOOT</div>' + loot + '</div>';
  }
  function wireRun(panel, meta, id) {
    var p = (meta.prep = meta.prep || {});
    function findIn(arr, idv) { return (arr || []).filter(function (x) { return x.id === idv; })[0]; }
    panel.querySelectorAll('[data-revevent]').forEach(function (b) {
      b.onclick = function () { var s = findIn(p.events, b.getAttribute('data-revevent')); if (!s) return; sess.camp.setOverview({ reveal: eventReveal(s) }); logSession('▸ Revealed event: ' + (s.title || 'Event')); b.textContent = '✓ sent'; setTimeout(function () { b.textContent = '▸ reveal'; }, 1000); };
    });
    function pushClocks() { sess.camp.setOverview({ clocks: (sess._revClocks || []) }); }
    function ov() { return (sess.camp.getOverview && sess.camp.getOverview()) || {}; }
    sess._revClocks = ov().clocks || [];
    // Debounced meta save so rapid clock ticks don't fire a GET+PUT each time.
    function saveClocksSoon() { clearTimeout(sess._clkSaveT); sess._clkSaveT = setTimeout(function () { saveCampaignMeta(id, { prep: p }); }, 600); }
    panel.querySelectorAll('[data-clkrev]').forEach(function (b) {
      b.onclick = function () {
        var k = findIn(p.clocks, b.getAttribute('data-clkrev')); if (!k) return;
        var cur = ov().clocks || []; var on = cur.some(function (x) { return x.id === k.id; });
        sess._revClocks = on ? cur.filter(function (x) { return x.id !== k.id; }) : cur.concat([{ id: k.id, label: k.label, value: k.value, max: k.max, color: k.color }]);
        pushClocks();   // instant (Yjs); no full re-render
        b.classList.toggle('on', !on); b.textContent = !on ? '👁 shown' : 'reveal';
      };
    });
    panel.querySelectorAll('[data-clkp],[data-clkm]').forEach(function (b) {
      var idv = b.getAttribute('data-clkp') || b.getAttribute('data-clkm'), up = b.hasAttribute('data-clkp');
      b.onclick = function () {
        var k = findIn(p.clocks, idv); if (!k) return;
        var before = k.value || 0;
        k.value = up ? Math.min(k.max || 6, before + 1) : Math.max(0, before - 1);
        saveClocksSoon();
        // If this clock is revealed, update the synced copy so players see it live.
        var cur = (ov().clocks || []).map(function (x) { return x.id === k.id ? { id: k.id, label: k.label, value: k.value, max: k.max, color: k.color } : x; });
        sess._revClocks = cur; pushClocks();
        var span = panel.querySelector('#runclkv-' + k.id); if (span) span.textContent = (k.value || 0) + '/' + (k.max || 6);
        // Clock-threshold auto-trigger: an event reveals when its clock drops below x.
        if (!up) (p.events || []).forEach(function (ev) {
          if (ev.trigger && ev.trigger.clockId === k.id && k.value < ev.trigger.below && before >= ev.trigger.below) {
            sess.camp.setOverview({ reveal: eventReveal(ev) }); logSession('⏱ Auto-revealed "' + (ev.title || 'Event') + '" (' + (k.label || 'clock') + ' < ' + ev.trigger.below + ')');
          }
        });
      };
    });
    panel.querySelectorAll('[data-lootgive]').forEach(function (b) {
      b.onclick = function () { var g = findIn(p.loot, b.getAttribute('data-lootgive')); if (g) grantLootBox(g, p, id, panel); };
    });
    // Present an NPC to players → a dossier Film Window (portrait + blurb).
    panel.querySelectorAll('[data-npcpresent]').forEach(function (b) {
      b.onclick = function () {
        var nm = b.getAttribute('data-npcpresent');
        fetch('/__api/campaigns/' + encodeURIComponent(id) + '/npcs/' + encodeURIComponent(nm)).then(function (r) { return r.json(); }).then(function (j) {
          j = j || {};
          var title = j.handle || j.role || idOf(nm);
          sess.camp.setOverview({ reveal: { kind: 'event', preset: 'dossier', title: title, portrait: j.photo || '', text: j.notes || j.role || '', ts: Date.now() } });
          logSession('▸ Presented NPC: ' + title);
          b.textContent = '✓ sent'; setTimeout(function () { b.textContent = '▸ present'; }, 1000);
        }).catch(function () {});
      };
    });
  }
  /* ── Loot grant (tree → player sheets) ── */
  function flattenLoot(node) { return node.type === 'container' ? (node.children || []).reduce(function (a, ch) { return a.concat(flattenLoot(ch)); }, []) : [node]; }
  function lootSummary(g) {
    var money = 0, ip = 0, items = 0;
    (g.nodes || []).forEach(function (n) { flattenLoot(n).forEach(function (x) { if (x.type === 'money') money += +x.amount || 0; else if (x.type === 'ip') ip += +x.amount || 0; else items++; }); });
    var parts = []; if (money) parts.push('€$' + money); if (ip) parts.push(ip + ' IP'); if (items) parts.push(items + ' item' + (items === 1 ? '' : 's'));
    return parts.join(' · ') || 'empty';
  }
  function connectedPlayers() { return sess.order.filter(function (sid) { var r = sess.camp.getSheet && sess.camp.getSheet(sid); return r && r.json; }); }
  function applyLootToPlayer(sid, leaves, label) {
    var rec = sess.camp.getSheet && sess.camp.getSheet(sid); if (!rec || !rec.json) return false;
    var json = rec.json;
    leaves.forEach(function (x) {
      if (x.type === 'money') json.money = (parseInt(json.money, 10) || 0) + (+x.amount || 0);
      else if (x.type === 'ip') json.ip = (parseInt(json.ip, 10) || 0) + (+x.amount || 0);
      else {
        var arr = x.cat === 'weapon' ? 'weapons' : x.cat === 'cyberware' ? 'cyberware' : x.cat === 'vehicle' ? 'vehicles' : x.cat === 'armor' ? 'armor' : 'gear';
        if (!Array.isArray(json[arr])) json[arr] = [];
        var obj = x.data ? JSON.parse(JSON.stringify(x.data)) : { name: x.name };
        if (arr === 'gear') { obj.category = obj.category || 'LOOT'; obj.notes = (obj.notes ? obj.notes + ' · ' : '') + 'from ' + (label || 'loot'); }
        json[arr].push(obj);
      }
    });
    sess.camp.publishSheet(sid, json.handle || json.name || sid, json);
    return true;
  }
  function grantLootBox(g, p, id, panel) {
    var players = connectedPlayers();
    if (!players.length) { alert('No players connected to receive loot.'); return; }
    var units = (g.nodes || []).map(function (n) { return { node: n, share: n.type === 'ip' ? 'shared' : (n.share || 'shared'), leaves: flattenLoot(n) }; });
    var uniques = units.filter(function (u) { return u.share === 'unique'; });
    var shared = units.filter(function (u) { return u.share !== 'unique'; });
    function doGrant(assign) {
      shared.forEach(function (u) { players.forEach(function (sid) { applyLootToPlayer(sid, u.leaves, g.name); }); });
      uniques.forEach(function (u, i) { var sid = assign[i]; if (sid) applyLootToPlayer(sid, u.leaves, g.name); });
      logSession('Loot "' + (g.name || 'reward') + '" given — ' + lootSummary(g) + (uniques.length ? ' (' + uniques.length + ' unique)' : ''));
    }
    if (!uniques.length) { doGrant([]); return; }
    // Unique items need a per-item player choice.
    var rows = uniques.map(function (u, i) {
      var opts = players.map(function (sid) { return '<option value="' + esc(sid) + '">' + esc(sid) + '</option>'; }).join('');
      return '<label class="cbs-row">' + esc(lootNodeLabel(u.node)) + ' → <select data-uniq="' + i + '">' + opts + '</select></label>';
    }).join('');
    var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal"><div class="app-modal-head">Give "' + esc(g.name || 'Loot') + '" — assign unique items</div>' +
      '<div class="app-modal-body">' + (shared.length ? '<p style="font-size:12px;color:#666;margin:0 0 8px">Shared items go to all ' + players.length + ' connected players.</p>' : '') + rows + '</div>' +
      '<div class="app-modal-actions"><button class="app-btn" data-x>Cancel</button><button class="app-btn app-modal-ok" data-ok>Give</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) modalClose(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = modalClose;
    ov.querySelector('[data-ok]').onclick = function () { var assign = uniques.map(function (u, i) { var s = ov.querySelector('[data-uniq="' + i + '"]'); return s && s.value; }); modalClose(); doGrant(assign); };
  }
  function wirePins(scope) {
    (scope || document).querySelectorAll('[data-pin]').forEach(function (b) {
      b.onclick = function () { var parts = b.getAttribute('data-pin').split('/'); openPinnedDoc(parts[0], parts.slice(1).join('/')); };
    });
  }
  // Live overview sync: refresh text/pins without clobbering a focused textarea.
  function refreshOverviewText() {
    if (sess.section !== 'overview') return;
    var ov = ovGet();
    var dr = el('ov-desc-read'); if (dr) dr.innerHTML = esc(ov.description || '') || '<span class="cd-empty">No description.</span>';
    var nr = el('ov-notes-read'); if (nr) nr.innerHTML = esc(ov.playerNotes || '') || '<span class="cd-empty">—</span>';
    var dt = el('ov-desc'); if (dt && document.activeElement !== dt && ov.description != null) dt.value = ov.description;
    var nt = el('ov-notes'); if (nt && document.activeElement !== nt && ov.playerNotes != null) nt.value = ov.playerNotes;
    var pp = el('ov-pins'); if (pp && ov.pinned) { pp.innerHTML = pinsHtml(ov.pinned); wirePins(pp.parentNode); }
    var oc = el('ov-clocks'); if (oc && sess.role === 'player') oc.innerHTML = '<div class="ov-lbl">CLOCKS</div>' + playerClocksHtml(ov.clocks);
  }
  function openPinnedDoc(type, name) { gotoSection('files'); /* Phase 2: open in reader; Phase 1: Files section */ }
  function updateOverviewActions() {
    var m = (sess.camp && sess.camp.combatMeta && sess.camp.combatMeta()) || {};
    var txt = '—';
    if (m.active) {
      var order = m.order || []; var actId = order[(m.turnIdx || 0) % (order.length || 1)];
      var c = sess.camp.getCombatant && sess.camp.getCombatant(actId);
      txt = '⚔ Combat — round ' + (m.round || 1) + (c ? ' · ' + (c.name || '') + "'s turn" : '');
    }
    var a = el('ov-actions'); if (a) a.textContent = txt;
    var lb = el('ws-livebar');
    if (lb) {
      if (m.active) { lb.hidden = false; lb.innerHTML = '<span class="chip chip-warn">⚔ COMBAT</span> <b>Round ' + (m.round || 1) + '</b>' + (c ? ' · <b>' + esc(c.name || '') + "</b>'s turn" : '') + '<span style="flex:1"></span><button class="app-btn" id="ws-lb-combat">Open combat ▸</button>'; var cb = el('ws-lb-combat'); if (cb) cb.onclick = function () { if (sess.role === 'gm') openCombatStage(); }; }
      else { lb.hidden = true; lb.innerHTML = ''; }
    }
    var cc = el('ov-combat-chip'); if (cc) cc.hidden = !m.active;
  }

  /* Players (GM) — grid (default) / tab / columns of the hosted sheets. */
  function frameSrc(sid) { return 'cs.html?campaign=' + encodeURIComponent(sess.id) + '&sheet=' + encodeURIComponent(sid) + '&as=gm'; }
  function sheetPhoto(sid) { var r = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid); return (r && r.json && r.json.photo) || ''; }
  function renderPlayers(panel) {
    if (!panel) return;
    panel.classList.add('sess-sec-bleed');
    var mode = sess.mode || 'grid';
    if (sess.order.indexOf(sess.active) < 0) sess.active = sess.order[0] || null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var bar = '<div class="pl-bar"><span class="pl-bar-title">PLAYERS</span><span style="flex:1"></span>' +
      '<div class="sess-modes">' +
        '<button class="sess-mode' + (mode === 'grid' ? ' active' : '') + '" data-mode="grid">Grid</button>' +
        '<button class="sess-mode' + (mode === 'tabs' ? ' active' : '') + '" data-mode="tabs">Tabs</button>' +
        '<button class="sess-mode' + (mode === 'columns' ? ' active' : '') + '" data-mode="columns">Columns</button>' +
      '</div></div>';
    var body;
    if (!sess.order.length) body = '<div class="cd-empty">No sheets hosted.</div>';
    else if (mode === 'grid') {
      body = '<div class="pl-grid">' + sess.order.map(function (sid) {
        var photo = sheetPhoto(sid);
        return '<button class="pl-card" data-open="' + esc(sid) + '">' +
          '<div class="pl-photo"' + (photo ? ' style="background-image:url(' + esc(photo) + ')"' : '') + '>' + (photo ? '' : '◈') + '</div>' +
          '<div class="pl-name">' + esc(sid) + '</div></button>';
      }).join('') + '</div>';
    } else if (mode === 'tabs') {
      var tabs = sess.order.map(function (sid) { return '<div class="sess-tab' + (sid === sess.active ? ' active' : '') + '" data-sid="' + esc(sid) + '">' + esc(sid) + '</div>'; }).join('');
      body = '<div class="sess-tabbar">' + tabs + '</div><div class="sess-tabbody">' + (sess.active ? '<iframe class="sess-col-frame" src="' + frameSrc(sess.active) + '"></iframe>' : '') + '</div>';
    } else {
      var cols = sess.order.map(function (sid, i) {
        return '<div class="sess-col" data-sid="' + esc(sid) + '" draggable="true">' +
          '<div class="sess-col-head"><span class="sess-col-idx">' + pad(i + 1) + '</span><span class="sess-col-name">' + esc(sid) + '</span><span class="sess-col-grab">⠿</span></div>' +
          '<iframe class="sess-col-frame" src="' + frameSrc(sid) + '"></iframe></div>';
      }).join('');
      body = '<div class="sess-cols" id="sess-cols">' + cols + '</div>';
    }
    panel.innerHTML = bar + '<div class="sess-stage-wrap">' + body + '</div>';
    panel.querySelectorAll('.sess-mode').forEach(function (b) { b.onclick = function () { setSessMode(b.getAttribute('data-mode')); }; });
    panel.querySelectorAll('[data-open]').forEach(function (c) { c.onclick = function () { sess.active = c.getAttribute('data-open'); setSessMode('tabs'); }; });
    if (mode === 'tabs') panel.querySelectorAll('.sess-tab').forEach(function (t) { t.onclick = function () { sess.active = t.getAttribute('data-sid'); rebuildPlayers(); }; });
    if (mode === 'columns') wireColumnReorder();
  }
  function rebuildPlayers() { var p = el('sec-players'); if (p) renderPlayers(p); }
  function setSessMode(mode) { sess.mode = mode; try { localStorage.setItem(SESS_MODE_KEY, mode); } catch (e) {} rebuildPlayers(); }

  /* Live-sheet (player) — their own synced sheet; combat auto-overlay via cs-join. */
  function renderLivesheet(panel) {
    if (!panel) return;
    panel.classList.add('sess-sec-files');   // full-bleed: the sheet fills the section
    panel.innerHTML = sess.sheetId
      ? '<iframe class="sess-livesheet" src="cs.html?campaign=' + encodeURIComponent(sess.id) + '&sheet=' + encodeURIComponent(sess.sheetId) + '"></iframe>'
      : '<div class="cd-empty">No sheet assigned. Ask your GM for your sheet link.</div>';
  }

  /* Tools — standalone tools as iframes; GM also gets Combat. */
  function renderTools(panel) {
    if (!panel) return;
    // Reuse the site's tool-card idiom (css/main.css) for visual consistency.
    var tiles = SESS_TOOLS.map(function (t) {
      return '<button class="tool-card" data-toolurl="' + esc(t.url) + '"><div class="tool-card-icon">' + t.icon + '</div><div class="tool-card-title">' + esc(t.label) + '</div></button>';
    }).join('');
    var combat = sess.role === 'gm'
      ? '<button class="tool-card tool-card-online" data-combat="1"><div class="tool-card-icon">◆</div><div class="tool-card-title" id="tool-combat-lbl">Combat</div><div class="tool-card-desc">Live · run a fight</div></button>'
      : '';
    panel.innerHTML = '<div class="tool-menu-grid sess-tools-grid">' + combat + tiles + '</div>' +
      '<div class="tools-frame" id="tools-frame" hidden>' +
        '<div class="tools-frame-bar"><span class="tools-frame-name" id="tools-frame-name"></span><button class="app-btn" id="tools-frame-close">✕ Close</button></div>' +
        '<div class="tools-frame-host" id="tools-frame-host"></div></div>';
    panel.querySelectorAll('[data-toolurl]').forEach(function (b) {
      b.onclick = function () { openSessTool(b.getAttribute('data-toolurl'), b.querySelector('.tool-card-title').textContent); };
    });
    // Close by removing the iframe node (setting src='about:blank' tripped an
    // Electron renderer debug scenario).
    el('tools-frame-close').onclick = function () { el('tools-frame-host').innerHTML = ''; el('tools-frame').hidden = true; };
    var cb = panel.querySelector('[data-combat]');
    if (cb) cb.onclick = sessCombat;
    syncCombatBtn();
  }
  // Open a tool iframe in the Tools section (used by the grid tiles AND the rail quick-links).
  function openSessTool(url, name) {
    var host = el('tools-frame-host'); if (!host) return;
    if (/nightcity/.test(url)) url += '?campaign=' + encodeURIComponent(sess.id) + '&ncrole=' + sess.role;
    el('tools-frame-name').textContent = name || '';
    host.innerHTML = '<iframe src="' + esc(url) + '"></iframe>';
    el('tools-frame').hidden = false;
    if (sess.role === 'player' && /nightcity/.test(url)) { var fr = host.querySelector('iframe'); if (fr) fr.onload = ncSyncToFrame; }
  }
  function sessCombat() { var m = (sess.camp && sess.camp.combatMeta && sess.camp.combatMeta()) || {}; if (m.active) openCombatStage(); else openCombatSetup(); }

  // Push synced public locations to any open player NC-map iframe (Locations
  // section or Tools) as an overlay layer.
  function ncSyncToFrame() {
    if (sess.role !== 'player') return;
    var vs = el('view-session'); if (!vs) return;
    var locs = ovGet().locations || [];
    var msg = { type: 'nc-sync-layers', layers: locs.length ? [{ id: 'sync-camp', name: 'Campaign locations', entries: locs }] : [], maps: ovGet().locMaps || [], order: ovGet().locOrder || [] };
    vs.querySelectorAll('iframe').forEach(function (fr) { if (/nightcity/.test(fr.src || '') && fr.contentWindow) fr.contentWindow.postMessage(msg, '*'); });
  }
  // GM edits public locations/maps in the embedded NC planner → push to players live.
  window.addEventListener('message', function (ev) {
    var d = ev.data; if (!d || d.type !== 'nc-gm-public') return;
    if (sess.role === 'gm' && sess.camp && sess.camp.setOverview && d.campaign === sess.id) sess.camp.setOverview({ locations: d.places || [], locMaps: d.maps || [], locOrder: d.order || [] });
  });

  /* Files — the "Établi" sourcebook reader, fed from the hub's local books folder. */
  var readerInst = null;
  function renderFiles(panel) {
    if (!panel) return;
    panel.classList.add('sess-sec-files');
    if (!window.SourcebookReader) { panel.innerHTML = '<div class="cd-empty">Reader not loaded.</div>'; return; }
    fetch('/__api/books').then(function (r) { return r.json(); }).catch(function () { return { books: [] }; }).then(function (d) {
      var books = (d && d.books) || [];
      if (readerInst) { try { readerInst.destroy(); } catch (e) {} readerInst = null; }
      panel.innerHTML = '';
      readerInst = window.SourcebookReader.mount(panel, { books: books });
    });
  }

  function shareLinks() {
    var rows = sess.order.map(function (sid) {
      var url = playerLink(sid);
      return '<div class="share-row"><span class="share-sid">' + esc(sid) + '</span>' +
        '<input class="share-url" readonly value="' + esc(url) + '">' +
        '<button class="app-btn" data-copy="' + esc(url) + '">Copy</button></div>';
    }).join('');
    var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal app-modal-wide"><div class="app-modal-head">Share with players</div>' +
      '<div class="app-modal-body"><p style="font-size:12px;color:#666;margin:0 0 10px">Players on the same Wi-Fi open their link in a browser → they get the session shell with their sheet.</p>' +
      (rows || '<div class="cd-empty">No sheets hosted.</div>') + '</div>' +
      '<div class="app-modal-actions"><button class="app-btn app-modal-ok" data-x>Done</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) modalClose(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = modalClose;
    ov.querySelectorAll('[data-copy]').forEach(function (b) {
      b.onclick = function () {
        var u = b.getAttribute('data-copy');
        try { navigator.clipboard.writeText(u); b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1200); }
        catch (e) { var inp = b.parentNode.querySelector('.share-url'); inp.focus(); inp.select(); }
      };
    });
  }

  // Online players → Overview list + header count. Targeted DOM update.
  function updatePresence(peers) {
    peers = peers || [];
    // Dedupe by member name: one player = shell connection + Live-sheet iframe.
    var seen = {}, names = [];
    peers.forEach(function (p) {
      if (!p || !p.member || p.member.role !== 'player') return;
      var nm = p.member.name || 'Player';
      if (!seen[nm]) { seen[nm] = 1; names.push(nm); }
    });
    var listEl = el('ov-online');
    if (listEl) {
      listEl.innerHTML = names.length
        ? names.map(function (nm) { return '<span class="ov-peer"><span class="sess-dot"></span>' + esc(nm) + '</span>'; }).join('')
        : '<span class="cd-empty">No players connected yet.</span>';
    }
    var pc = el('ov-pcount'); if (pc) pc.textContent = names.length;
  }
  function updatePresenceFromCamp() { if (sess.camp && sess.camp.getPeers) updatePresence(sess.camp.getPeers()); }
  function endSessionConn() {
    closeCombatStage();
    if (sess.camp) { try { sess.camp.destroy(); } catch (e) {} sess.camp = null; }
  }

  // Drag-reorder columns without reloading iframes (move DOM nodes).
  function wireColumnReorder() {
    var wrap = el('sess-cols'); if (!wrap) return;
    var dragSid = null;
    wrap.querySelectorAll('.sess-col').forEach(function (col) {
      col.addEventListener('dragstart', function (e) { dragSid = col.getAttribute('data-sid'); e.dataTransfer.effectAllowed = 'move'; });
      col.addEventListener('dragover', function (e) { e.preventDefault(); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!dragSid) return;
        var dragEl = wrap.querySelector('.sess-col[data-sid="' + dragSid + '"]');
        if (!dragEl || dragEl === col) return;
        var rect = col.getBoundingClientRect();
        var after = (e.clientX - rect.left) > rect.width / 2;
        wrap.insertBefore(dragEl, after ? col.nextSibling : col);
        sess.order = Array.prototype.slice.call(wrap.querySelectorAll('.sess-col')).map(function (c) { return c.getAttribute('data-sid'); });
        saveSessionMeta(sess.id, { order: sess.order });
        dragSid = null;
      });
    });
  }

  /* ── NPC archetype generator (built-in, hybrid kits from the real DBs) ── */
  var COMBAT_DBS = null;
  function loadCombatDBs() {
    if (COMBAT_DBS) return Promise.resolve(COMBAT_DBS);
    return Promise.all(['data/cp2020weapons.json', 'data/cyberware.json', 'data/cp2020gear.json'].map(function (u) {
      return fetch(u).then(function (r) { return r.json(); }).catch(function () { return []; });
    })).then(function (res) {
      COMBAT_DBS = { weapons: res[0] || [], cyber: res[1] || [], armor: (res[2] || []).filter(function (g) { return g && g.category === 'ARMOR/CLOTHING'; }) };
      return COMBAT_DBS;
    });
  }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  // ctx: { preset, onSave(sheets), onCombat(sheets) } — buttons shown per callback.
  function archetypeGenModal(ctx) {
    ctx = ctx || {};
    var G = window.NPCGen; if (!G) { alert('Generator not loaded.'); return; }
    var archs = G.list();
    var archOpts = archs.map(function (a) { return opt(a.id, a.label, ctx.preset); }).join('');
    var tierOpts = G.TIER_ORDER.map(function (t) { return opt(t, G.TIERS[t].label, 'average'); }).join('');
    var chromeOpts = [opt('auto', 'Auto (by tier)', 'auto')].concat(Object.keys(G.CHROME).map(function (c) { return opt(c, c, 'auto'); })).join('');
    var roleOpts = [opt('auto', 'Auto (archetype default)', 'auto')].concat(Object.keys(G.ROLES).map(function (r) { return opt(r, r, 'auto'); })).join('');
    var cpOpts = [opt('auto', 'Archetype default', 'auto'), opt('none', 'Generic (none)', 'auto')].concat(Object.keys(G.CP2020_ROLES).map(function (r) { return opt(r, r + ' — ' + G.CP2020_ROLES[r], 'auto'); })).join('');
    function genClose() { var x = el('gen-modal-ov'); if (x) x.parentNode.removeChild(x); }
    var ov = document.createElement('div'); ov.id = 'gen-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal app-modal-wide"><div class="app-modal-head">Generate NPC from archetype</div>' +
      '<div class="app-modal-body">' +
      '<div class="gen-grid">' +
        '<label>Archetype<select id="gen-arch">' + archOpts + '</select></label>' +
        '<label>Tier<select id="gen-tier">' + tierOpts + '</select></label>' +
        '<label>Chrome<select id="gen-chrome">' + chromeOpts + '</select></label>' +
        '<label>Playstyle<select id="gen-role">' + roleOpts + '</select></label>' +
        '<label>CP2020 role<select id="gen-cp">' + cpOpts + '</select></label>' +
        '<label>Scope<select id="gen-scope">' + opt('one', 'Single NPC', 'one') + opt('team', 'Coherent team', 'one') + '</select></label>' +
        '<label>Count <input type="number" id="gen-count" value="1" min="1" max="12"></label>' +
      '</div>' +
      '<button class="app-btn app-btn-go" id="gen-roll">' + (ctx.onParams ? '◆ Add to encounter' : '◆ Generate') + '</button>' +
      '<div id="gen-preview" class="gen-preview"></div>' +
      '</div>' +
      '<div class="app-modal-actions" id="gen-actions"><button class="app-btn" data-x>Close</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) genClose(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = genClose;
    var last = [];
    el('gen-roll').onclick = function () {
      var p = {
        archetype: el('gen-arch').value, tier: el('gen-tier').value,
        chrome: el('gen-chrome').value === 'auto' ? null : el('gen-chrome').value,
        role: el('gen-role').value === 'auto' ? null : el('gen-role').value,
        cp2020role: el('gen-cp').value === 'auto' ? null : (el('gen-cp').value === 'none' ? '' : el('gen-cp').value),
      };
      var scope = el('gen-scope').value, count = clampN(parseInt(el('gen-count').value, 10) || 1, 1, 12);
      // Encounter builder: store the params (resolved to NPCs at launch), don't generate now.
      if (ctx.onParams) { genClose(); ctx.onParams(p, count); return; }
      loadCombatDBs().then(function (DBs) {
        last = [];
        for (var i = 0; i < count; i++) {
          if (scope === 'team') last = last.concat(G.generateTeam(p, DBs));
          else last.push(G.generate(p, DBs));
        }
        renderGenPreview(last);
      });
    };
    function renderGenPreview(sheets) {
      el('gen-preview').innerHTML = '<div class="gen-plist">' + sheets.map(function (s) {
        var w = (s.weapons[0] || {}).name || '—', sp = (s.armor[0] || {}).notes || 'no armor';
        return '<div class="gen-row"><b>' + esc(s.role) + '</b> <span class="gen-tag">' + esc(s.notes) + '</span>' +
          '<span class="gen-meta">REF ' + s.stats.REF + ' BODY ' + s.stats.BODY + ' · ' + esc(w) + ' · ' + s.cyberware.length + ' cyber</span></div>';
      }).join('') + '</div>';
      var acts = el('gen-actions');
      acts.innerHTML = '<button class="app-btn" data-x>Close</button>' +
        (ctx.onCombat ? '<button class="app-btn app-btn-go" id="gen-tocombat">Add ' + sheets.length + ' to combat</button>' : '') +
        (ctx.onSave ? '<button class="app-btn app-modal-ok" id="gen-save">Save ' + sheets.length + ' as NPC' + (sheets.length > 1 ? 's' : '') + '</button>' : '');
      acts.querySelector('[data-x]').onclick = genClose;
      if (ctx.onCombat) el('gen-tocombat').onclick = function () { genClose(); ctx.onCombat(sheets); };
      if (ctx.onSave) el('gen-save').onclick = function () { genClose(); ctx.onSave(sheets); };
    }
  }
  function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function slugName(s) { return (s.role + '-' + (s.notes || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function saveGeneratedNPCs(id, sheets, done) {
    Promise.all(sheets.map(function (s, i) {
      var nm = slugName(s) + '-' + Date.now().toString(36) + (sheets.length > 1 ? '-' + (i + 1) : '') + '.json';
      return api('POST', 'campaigns/' + encodeURIComponent(id) + '/npcs', { name: nm, json: s });
    })).then(done || function () {});
  }

  /* Organisation generator modal */
  var ORG_CORPS = null;
  function loadOrgDBs() {
    return Promise.all([loadCombatDBs(), ORG_CORPS ? Promise.resolve(ORG_CORPS) : fetch('data/corporations.json').then(function (r) { return r.json(); }).catch(function () { return []; })])
      .then(function (res) { ORG_CORPS = res[1] || []; return { weapons: res[0].weapons, cyber: res[0].cyber, armor: res[0].armor, corps: ORG_CORPS }; });
  }
  function orgGenModal(id) {
    var G = window.OrgGen; if (!G) { alert('Org generator not loaded.'); return; }
    var kindOpts = G.list().map(function (k) { return opt(k.id, k.label, 'corporation'); }).join('');
    var scaleOpts = Object.keys(G.SCALE).map(function (s) { return opt(s, G.SCALE[s].label, 'local'); }).join('');
    function close() { var x = el('org-modal-ov'); if (x) x.parentNode.removeChild(x); }
    var ov = document.createElement('div'); ov.id = 'org-modal-ov'; ov.className = 'app-modal-ov';
    ov.innerHTML = '<div class="app-modal app-modal-wide"><div class="app-modal-head">Generate organisation</div>' +
      '<div class="app-modal-body"><div class="gen-grid">' +
        '<label>Kind<select id="org-kind">' + kindOpts + '</select></label>' +
        '<label>Scale<select id="org-scale">' + scaleOpts + '</select></label>' +
        '<label>Count <input type="number" id="org-count" value="1" min="1" max="8"></label>' +
      '</div><button class="app-btn app-btn-go" id="org-roll">◆ Generate</button><div id="org-prev" class="gen-preview"></div></div>' +
      '<div class="app-modal-actions" id="org-actions"><button class="app-btn" data-x>Close</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) close(); };
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').onclick = close;
    var last = [];
    el('org-roll').onclick = function () {
      var p = { kind: el('org-kind').value, scale: el('org-scale').value }, n = clampN(parseInt(el('org-count').value, 10) || 1, 1, 8);
      loadOrgDBs().then(function (DBs) {
        last = []; for (var i = 0; i < n; i++) last.push(G.generate(p, DBs));
        el('org-prev').innerHTML = '<div class="gen-plist">' + last.map(function (o) {
          return '<div class="gen-row"><b>' + esc(o.name) + '</b> <span class="gen-tag">' + esc(o.type) + '</span><span class="gen-meta">' + (o.hierarchy.nodes.length) + ' leaders · ' + esc(o.headquarters) + '</span></div>';
        }).join('') + '</div>';
        el('org-actions').innerHTML = '<button class="app-btn" data-x>Close</button><button class="app-btn app-modal-ok" id="org-save">Save ' + last.length + ' org' + (last.length > 1 ? 's' : '') + '</button>';
        el('org-actions').querySelector('[data-x]').onclick = close;
        el('org-save').onclick = function () {
          Promise.all(last.map(function (o) {
            var nm = (o.name || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36) + '.org.json';
            return api('POST', 'campaigns/' + encodeURIComponent(id) + '/orgs', { name: nm, json: o });
          })).then(function () { close(); renderCampaignDetail(); });
        };
      });
    };
  }

  /* ── Combat (GM side): setup picker + resorbable combat stage ── */
  var combatUI = null;

  function syncCombatBtn() {
    var b = el('tool-combat-lbl'); if (!b || !sess.camp || !sess.camp.combatMeta) return;
    var m = sess.camp.combatMeta() || {};
    b.textContent = m.active ? 'Combat LIVE' : 'Combat';
    var tile = b.closest('.tool-card'); if (tile) tile.classList.toggle('tool-card-active', !!m.active);
  }

  function openCombatSetup() {
    var id = sess.id;
    api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
      var npcDocs = (d && d.docs && d.docs.npcs) || [];
      var pcs = sess.order.map(function (sid) {
        return '<label class="cbs-row"><input type="checkbox" data-pc="' + esc(sid) + '" checked> ◈ ' + esc(sid) + ' <span class="cbs-tag">PC</span></label>';
      }).join('');
      var npcs = npcDocs.map(function (doc) {
        var nm = doc.name;
        return '<label class="cbs-row"><input type="checkbox" data-npc="' + esc(nm) + '"> ☗ ' + esc(idOf(nm)) +
          ' <span class="cbs-tag">NPC</span> ×<input type="number" class="cbs-count" data-count="' + esc(nm) + '" value="1" min="1" max="20"></label>';
      }).join('');
      var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
      ov.innerHTML = '<div class="app-modal app-modal-wide"><div class="app-modal-head">◆ Start combat</div>' +
        '<div class="app-modal-body">' +
        (((d.meta && d.meta.prep && d.meta.prep.squads) || []).length ? '<div class="app-kicker">// SQUAD</div><div class="cbs-mook">Squad <select id="cbs-enc"><option value="">— none —</option>' + (d.meta.prep.squads).map(function (e, i) { return '<option value="' + i + '">' + esc(e.name || 'Squad') + '</option>'; }).join('') + '</select><button class="app-btn" id="cbs-encload">Load</button></div>' : '') +
        '<div class="app-kicker">// COMBATANTS</div>' + pcs + (npcs || '<div class="cd-empty">No NPCs in this campaign.</div>') +
        (window.NPCGen ? '<div class="app-kicker" style="margin-top:10px">// ARCHETYPES</div>' +
          '<button class="app-btn app-btn-go" id="cbs-gen">◆ Generate archetype →</button><div id="cbs-gen-list" class="cbs-genlist"></div>' : '') +
        '<div class="app-kicker" style="margin-top:10px">// QUICK MOOK</div>' +
        '<div class="cbs-mook">Name <input id="cbs-mname" placeholder="Booster"> REF <input type="number" id="cbs-mref" value="6" style="width:50px"> BODY <input type="number" id="cbs-mbody" value="7" style="width:50px"> Dmg <input id="cbs-mdmg" value="2d6+1" style="width:70px"> ×<input type="number" id="cbs-mcount" value="1" min="1" max="20" style="width:50px"></div>' +
        '<div class="app-kicker" style="margin-top:10px">// RULES</div>' +
        '<div class="cbs-mook">Mode <select id="cbs-mode"><option value="hybrid">Hybrid — players act their turns</option><option value="gm">GM — GM resolves everything</option></select>' +
        ' NPC visibility <select id="cbs-vis"><option value="full">Full (default)</option><option value="status">Status only</option><option value="name">Name only</option></select></div>' +
        '</div>' +
        '<div class="app-modal-actions"><button class="app-btn" data-x>Cancel</button><button class="app-btn app-modal-ok" data-ok>◆ Roll initiative &amp; start</button></div></div>';
      ov.onclick = function (e) { if (e.target === ov) modalClose(); };
      document.body.appendChild(ov);
      ov.querySelector('[data-x]').onclick = modalClose;
      // Generated archetypes added straight into this encounter.
      var genExtra = [];
      function renderGenExtra() {
        var box = el('cbs-gen-list'); if (!box) return;
        box.innerHTML = genExtra.map(function (c, i) {
          return '<span class="cbs-genchip">' + esc(c.name) + ' <a data-rmgen="' + i + '">✕</a></span>';
        }).join('');
        box.querySelectorAll('[data-rmgen]').forEach(function (a) { a.onclick = function () { genExtra.splice(+a.getAttribute('data-rmgen'), 1); renderGenExtra(); }; });
      }
      // Load a prepared encounter → check PCs/NPCs + materialise archetypes/mooks.
      var encLoad = el('cbs-encload');
      if (encLoad) encLoad.onclick = function () {
        var idx = el('cbs-enc').value; if (idx === '') return;
        var enc = d.meta.prep.squads[+idx]; if (!enc) return;
        if (enc.settings) { el('cbs-mode').value = enc.settings.mode || 'hybrid'; el('cbs-vis').value = enc.settings.npcVis || 'full'; }
        window.CombatEngine && loadCombatDBs().then(function (DBs) {
          (enc.members || []).forEach(function (m) {
            if (m.kind === 'pc-all') { ov.querySelectorAll('input[data-pc]').forEach(function (c) { c.checked = true; }); }
            else if (m.kind === 'npcfile') { var c = ov.querySelector('input[data-npc="' + (window.CSS && CSS.escape ? CSS.escape(m.name) : m.name) + '"]'); if (c) { c.checked = true; var cnt = ov.querySelector('.cbs-count[data-count="' + (window.CSS && CSS.escape ? CSS.escape(m.name) : m.name) + '"]'); if (cnt) cnt.value = m.count || 1; } }
            else if (m.kind === 'archetype' && window.NPCGen) { for (var i = 0; i < (m.count || 1); i++) { var s = window.NPCGen.generate(m.params, DBs); genExtra.push(window.CombatEngine.makeCombatant({ id: 'enc-' + Date.now().toString(36) + '-' + genExtra.length, kind: 'npc', name: s.role, sheet: s })); } }
            else if (m.kind === 'mook') { for (var j = 0; j < (m.count || 1); j++) genExtra.push(window.CombatEngine.makeCombatant({ id: 'enc-' + Date.now().toString(36) + '-' + genExtra.length, kind: 'npc', name: (m.sheet && m.sheet.role) || 'Mook', sheet: m.sheet || {} })); }
          });
          renderGenExtra();
        });
      };
      var genBtn = el('cbs-gen');
      if (genBtn) genBtn.onclick = function () {
        archetypeGenModal({
          onCombat: function (sheets) {
            sheets.forEach(function (s, i) {
              var base = (s.role || 'NPC').replace(/\s+/g, '');
              genExtra.push(window.CombatEngine.makeCombatant({ id: 'gen-' + Date.now().toString(36) + '-' + genExtra.length + '-' + i, kind: 'npc', name: s.role, sheet: s }));
            });
            renderGenExtra();
          },
          onSave: function (sheets) { saveGeneratedNPCs(id, sheets); sheets.forEach(function (s, i) { genExtra.push(window.CombatEngine.makeCombatant({ id: 'gen-' + Date.now().toString(36) + '-' + genExtra.length + '-' + i, kind: 'npc', name: s.role, sheet: s })); }); renderGenExtra(); },
        });
      };
      ov.querySelector('[data-ok]').onclick = function () {
        var E = window.CombatEngine;
        var jobs = [];
        genExtra.forEach(function (c) { jobs.push(Promise.resolve(c)); });
        // PCs from hosted (live) sheets
        Array.prototype.slice.call(ov.querySelectorAll('input[data-pc]:checked')).forEach(function (cb) {
          var sid = cb.getAttribute('data-pc');
          var rec = sess.camp.getSheet(sid);
          var c = E.makeCombatant({ id: 'pc-' + sid, kind: 'pc', sheetId: sid, name: sid, sheet: (rec && rec.json) || {} });
          // Restore persisted combat state (wounds, armor ablation) from a prior fight.
          var pst = rec && rec.json && rec.json.combat;
          if (pst) { c.wounds = pst.wounds || 0; if (pst.armorDmg) c.armorDmg = Object.assign(c.armorDmg, pst.armorDmg); if (pst.status) c.status = Object.assign(c.status, pst.status); }
          jobs.push(Promise.resolve(c));
        });
        // NPCs from campaign files (×count)
        Array.prototype.slice.call(ov.querySelectorAll('input[data-npc]:checked')).forEach(function (cb) {
          var nm = cb.getAttribute('data-npc');
          var cnt = parseInt((ov.querySelector('.cbs-count[data-count="' + nm + '"]') || {}).value, 10) || 1;
          jobs.push(fetch('/__api/campaigns/' + encodeURIComponent(id) + '/npcs/' + encodeURIComponent(nm))
            .then(function (r) { return r.json(); }).catch(function () { return {}; })
            .then(function (sheet) {
              var base = idOf(nm);
              var out = [];
              for (var i = 0; i < cnt; i++) out.push(E.makeCombatant({ id: 'npc-' + base + '-' + (i + 1), kind: 'npc', name: cnt > 1 ? base + ' ' + (i + 1) : base, sheet: sheet }));
              return out;
            }));
        });
        // quick mooks
        var mname = (el('cbs-mname').value || '').trim();
        if (mname) {
          var mref = parseInt(el('cbs-mref').value, 10) || 6, mbody = parseInt(el('cbs-mbody').value, 10) || 7;
          var mdmg = el('cbs-mdmg').value || '2d6+1', mcount = parseInt(el('cbs-mcount').value, 10) || 1;
          var msheet = { stats: { REF: mref, BODY: mbody }, weapons: [{ name: 'Weapon', damage: mdmg, ammo: 30, rof: 2, range: 50 }] };
          for (var i = 0; i < mcount; i++) {
            jobs.push(Promise.resolve(window.CombatEngine.makeCombatant({ id: 'mook-' + mname.toLowerCase().replace(/\W+/g, '-') + '-' + (i + 1), kind: 'npc', name: mcount > 1 ? mname + ' ' + (i + 1) : mname, sheet: msheet })));
          }
        }
        var settings = { mode: el('cbs-mode').value, npcVis: el('cbs-vis').value };
        modalClose();
        Promise.all(jobs).then(function (results) {
          var list = [];
          results.forEach(function (r) { Array.isArray(r) ? list.push.apply(list, r) : list.push(r); });
          if (!list.length) return;
          sess.camp.clearCombat();
          list.forEach(function (c) { c.init = E.rollInitiative(c.ref, c.initBonus).total; sess.camp.putCombatant(c.id, c); });
          list.sort(function (a, b) { return (b.init || 0) - (a.init || 0); });
          sess.camp.setCombatMeta({ active: true, round: 1, turnIdx: 0, order: list.map(function (c) { return c.id; }), settings: settings, startedAt: Date.now() });
          sess.camp.logCombat({ msg: '◆ Combat begins — initiative: ' + list.map(function (c) { return c.name + ' ' + c.init; }).join(', ') });
          logSession('◆ Combat started — ' + list.length + ' combatant' + (list.length === 1 ? '' : 's') + '.');
          openCombatStage();
        });
      };
    });
  }

  function openCombatStage() {
    if (el('cbt-overlay')) return;
    var ov = document.createElement('div'); ov.className = 'cdoc-overlay'; ov.id = 'cbt-overlay';
    ov.innerHTML = '<div class="cdoc-bar"><span class="cdoc-title">◆ COMBAT — ' + esc(sess.id) + '</span>' +
      '<button class="app-btn" id="cbt-collapse" style="margin-left:auto">▾ Collapse</button></div>' +
      '<div id="cbt-mount" style="flex:1;min-height:0"></div>';
    document.body.appendChild(ov);
    combatUI = window.CombatUI.mount(el('cbt-mount'), { camp: sess.camp, role: 'gm' });
    el('cbt-collapse').onclick = closeCombatStage;
  }
  function closeCombatStage() {
    if (combatUI) { try { combatUI.destroy(); } catch (e) {} combatUI = null; }
    var ov = el('cbt-overlay'); if (ov) ov.parentNode.removeChild(ov);
    syncCombatBtn();
  }

  /* ── boot ── */
  // A GM "Share" link (app.html?campaign=&sheet=) drops a player straight into
  // the session shell, skipping the role chooser.
  (function () {
    var p = new URLSearchParams(location.search);
    var camp = p.get('campaign'), sheet = p.get('sheet');
    if (camp && sheet && window.BartmossSync) {
      try { localStorage.setItem(ROLE_KEY, 'player'); } catch (e) {}
      el('role-chooser').style.display = 'none';
      el('app-shell').hidden = false;
      openPlayerSession(camp, sheet);
      return;
    }
    // pre-highlight last role
    try { var last = localStorage.getItem(ROLE_KEY); if (last) { var r = document.querySelector('.rc-role[onclick*="' + last + '"]'); if (r) r.style.borderColor = '#b8860b'; } } catch (e) {}
  })();
})();
