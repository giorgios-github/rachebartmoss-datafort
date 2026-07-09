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
  function reduceMotion() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

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
      // Player pre-connect = the full site (offline: all tools + sourcebook reader), with a
      // CONNECT button (injected by main.js on ?player=1) whose popup lists the GM's hosted
      // characters to click. Unchanged entry point.
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
    setMode('manage'); var _sh = el('app-shell'); if (_sh) _sh.classList.remove('in-session'); showView('view-pconnect');
    el('app-crumbs').innerHTML = '<span class="crumb-cur">Connect</span>';
    el('view-pconnect').innerHTML =
      '<div class="app-kicker">// JOIN A SESSION</div><h2 class="app-h">Connect to your GM</h2>' +
      '<div class="pc-card">' +
        '<label class="pc-l">Paste the link your GM gave you</label>' +
        '<input id="pc-link" class="pc-in" placeholder="http://192.168.1.42:8787/app.html?campaign=main&amp;sheet=Player_1">' +
        '<div class="pc-or">— or enter it —</div>' +
        '<div class="pc-row"><div><label class="pc-l">Campaign</label><input id="pc-camp" class="pc-in" value="main"></div>' +
        '<div><label class="pc-l">Your sheet id</label><input id="pc-sheet" class="pc-in" placeholder="Player_1"></div></div>' +
        '<button class="app-btn app-btn-go pc-go" id="pc-connect">CONNECT</button>' +
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

  /* ── Modal ──
     Generic prompt/confirm use the shared UI.modal (css/ui.css). Bespoke modals
     elsewhere still build .app-modal markup inline and close via modalClose(),
     which now clears either overlay during the design-system migration. */
  function modalClose() {
    var ov = el('app-modal-ov'); if (ov) ov.parentNode.removeChild(ov);
    if (window.UI) UI.close();
  }
  function prompt1(title, label, placeholder, onOk) {
    UI.modal({
      title: title,
      body: '<label class="ui-field-label">' + esc(label) + '</label><input id="app-modal-in" class="ui-input" placeholder="' + esc(placeholder || '') + '">',
      actions: [
        { label: 'Cancel' },
        { label: 'OK', kind: 'primary', onClick: function (box) { onOk(box.querySelector('#app-modal-in').value); } }
      ],
      onShow: function (box) {
        var inp = box.querySelector('#app-modal-in'); inp.focus();
        inp.onkeydown = function (e) { if (e.key === 'Enter') { var v = inp.value; UI.close(); onOk(v); } };
      }
    });
  }
  function confirm1(msg, onYes) {
    UI.modal({
      title: 'Confirm',
      body: esc(msg),
      actions: [{ label: 'Cancel' }, { label: 'Yes', kind: 'primary', onClick: function () { onYes(); } }]
    });
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
  // New campaign + optional import of sheet/template .json files (onboarding travels with them).
  function newCampaignModal() {
    if (!window.UI) {
      prompt1('New campaign', 'Campaign name', 'e.g. Night Heist', function (name) {
        name = (name || '').trim(); if (!name) return;
        api('POST', 'campaigns', { name: name }).then(function (r) { if (r && r.id) openCampaign(r.id); });
      });
      return;
    }
    window.UI.modal({
      title: 'New campaign',
      body: '<label class="rt-field"><span class="rt-field-l">Campaign name</span><input class="rt-input" id="nc-name" placeholder="e.g. Night Heist"></label>' +
        '<label class="rt-field"><span class="rt-field-l">Import sheets / templates (.json, optional)</span><input class="rt-input" id="nc-files" type="file" accept=".json,application/json" multiple></label>' +
        '<p style="font-family:var(--mono);font-size:11px;color:var(--text2);line-height:1.5">Character sheets or templates exported from the sheet are added to the campaign. Any onboarding guide saved on them comes along.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: function (box) {
        var name = (box.querySelector('#nc-name').value || '').trim(); if (!name) return false;
        var files = box.querySelector('#nc-files').files;
        api('POST', 'campaigns', { name: name }).then(function (r) {
          if (!(r && r.id)) return;
          var id = r.id;
          if (!files || !files.length) { openCampaign(id); return; }
          var jobs = Array.prototype.map.call(files, function (f) {
            return f.text().then(function (txt) {
              var json; try { json = JSON.parse(txt); } catch (e) { return; }
              var nm = f.name.replace(/\.json$/i, '').replace(/[^\w.-]+/g, '_') || 'sheet';
              return api('POST', 'campaigns/' + encodeURIComponent(id) + '/sheets', { name: nm, json: json });
            });
          });
          Promise.all(jobs).then(function () { openCampaign(id); });
        });
      } }]
    });
  }
  function renderCampaigns() {
    state.campaignId = null;
    endSessionConn();
    removeMonitor(); removeQdb();
    var camp0 = el('app-camp'); if (camp0) camp0.innerHTML = '';
    var _sh = el('app-shell'); if (_sh) _sh.classList.remove('in-session');
    setMode('manage');
    showView('view-campaigns');
    el('app-crumbs').innerHTML = '<span class="crumb-cur">Campaigns</span>';
    api('GET', 'campaigns').then(function (d) {
      var cs = (d && d.campaigns) || [];
      var rows = cs.map(function (c) {
        return '<div class="roster-row" data-id="' + esc(c.id) + '" role="button" tabindex="0">' +
          '<span class="roster-name">' + esc(c.name) + '</span>' +
          '<span class="roster-meta">' + c.sheets + ' sheet' + (c.sheets === 1 ? '' : 's') + '</span>' +
          '<span class="roster-open">Open</span>' +
          '<button class="roster-del" data-del="' + esc(c.id) + '" aria-label="Delete campaign">delete</button></div>';
      }).join('');
      el('view-campaigns').innerHTML =
        '<div class="roster">' +
          '<header class="roster-brand">' +
            '<img class="roster-logo" src="img/RacheBartmoss.png" alt="Rache Bartmoss">' +
            '<span class="roster-wordmark">DATAFORT</span>' +
            '<div class="roster-brand-acts">' +
              '<button class="roster-act" id="cmp-books">Books</button>' +
              '<button class="roster-act" id="cmp-role">Switch role</button>' +
            '</div>' +
          '</header>' +
          '<div class="roster-head"><h2 class="roster-title">Campaigns</h2>' +
            (cs.length ? '<span class="roster-count">' + cs.length + '</span>' : '') +
            '<button class="roster-new" id="cmp-new">＋ New campaign</button></div>' +
          (cs.length
            ? '<div class="roster-list">' + rows + '</div>'
            : '<div class="roster-empty">No campaigns yet. Spin one up to start managing sheets, NPCs and sessions.</div>') +
        '</div>';
      el('cmp-new').onclick = newCampaignModal;
      var _b = el('cmp-books'); if (_b) _b.onclick = function () { if (window.openReaderApp) window.openReaderApp(); };
      var _r = el('cmp-role'); if (_r) _r.onclick = function () { if (window.switchRole) window.switchRole(); };
      el('view-campaigns').querySelectorAll('.roster-row[data-id]').forEach(function (card) {
        card.onclick = function (e) { if (e.target.hasAttribute('data-del')) return; openCampaign(card.getAttribute('data-id')); };
        card.onkeydown = function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.hasAttribute('data-del')) { e.preventDefault(); openCampaign(card.getAttribute('data-id')); } };
      });
      el('view-campaigns').querySelectorAll('[data-del]').forEach(function (s) {
        s.onclick = function (e) { e.stopPropagation(); var id = s.getAttribute('data-del'); confirm1('Delete campaign "' + id + '" and all its files?', function () { api('DELETE', 'campaigns/' + encodeURIComponent(id)).then(renderCampaigns); }); };
      });
    });
  }

  /* ── Open a campaign = enter the Run Table (no campaign/session dichotomy) ──
     The GM lands on the run table directly (Party), joined to the LAN room so
     presence works. "Go live" (setLive) flips on casting + The Table. */
  function openCampaign(id) {
    state.campaignId = id; state.type = 'sheets'; cdHost = null; cdData = null;
    endSessionConn();
    var vc = el('view-campaign'); if (vc) vc.innerHTML = '';   // drop stale prep DOM
    // v2 data layer: bind the campaign context, run the one-shot migration
    // (no-op once schemaVersion >= 2), then load the registries.
    var ready = Promise.resolve();
    if (window.App && window.Migrate) {
      App.setCampaign(id, 'gm');
      ready = Migrate.run(id).catch(function (e) { console.error('[Migrate]', e); })
        .then(function () { return App.getMeta(true); })
        .then(function (meta) {
          App.uiLoad(meta);
          if (window.Store) { Store.idIndexLoad(meta); Store.propsLoad(meta); Store.invalidate(); }
          if (window.Links) Links.invalidate();
        })
        .then(function () { if (window.Store) return refreshShopDocs(); })   // shops resolve synchronously in location/npc/org menus
        .catch(function (e) { console.error('[App boot]', e); });
    }
    ready.then(function () {
      return api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
        cdData = d;
        // Sheet IDs are the base filename WITHOUT extension (the hub appends .json on
        // save) — using the .json filename here caused Johny.json.json.json cascades.
        var order = ((d.docs && d.docs.sheets) || []).map(function (x) { return String(x.name).replace(/(\.json)+$/i, ''); });
        order = order.filter(function (v, i) { return order.indexOf(v) === i; });   // dedupe cascaded junk
        openRunTable(id, order);
      });
    }).catch(function () { openRunTable(id, []); });
  }
  function openRunTable(id, order) {
    sess.id = id; sess.role = 'gm'; sess.hosted = order.slice(); sess.order = order.slice(); sess.cols = {};
    sess.active = order[0] || null; sess.section = 'party'; sess.live = true; sess.activeSessionId = null;
    sess.tabs = null; sess.activeTab = null;   // Shell restores per-campaign tabs from meta.ui
    state.campaignId = id;
    var vc = el('view-campaign'); if (vc) vc.innerHTML = '';
    setMode('active'); showView('view-session');
    el('app-crumbs').innerHTML = '<a id="crumb-home">Campaigns</a> <span class="crumb-sep">/</span> <span class="crumb-cur">' + esc(id) + '</span>';
    var ch = el('crumb-home'); if (ch) ch.onclick = function () { renderCampaigns(); };
    joinSession(id, { name: 'GM', role: 'gm' });
    pushCampaignLocations(id);
    renderSessionShell();
  }
  // Always-live: the old GO LIVE toggle is gone — opening a campaign hosts it.

  /* ── Campaign = Prep board (sidebar of prep modules) ── */
  var cdData = null, cdSection = 'events', cdEventSel = null;
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

  // Run Table workspace: section identity (glyph + group), aligned to the Claude
  // Design handoff nav (GM: SESSION/CREATE/REFERENCE · Player: YOU/TABLE).
  // Legacy prep keys (events/squads/loot/locations/sessions/files/tools) kept so
  // the existing live-prep editors stay reachable during the migration.
  // Section renderers route through a HOST element so the same editors render in
  // both the PREP board (#cd-content) and a live session panel (workspace unity).
  var cdHost = null;
  // Only the Cast (events) editor still routes through here; the other prep-board
  // sections were retired when the campaign screen became the tabbed Run Table.
  function cdRenderSection(key, c) {
    if (!c) return;
    if (key === 'events') return cdEvents(c);
  }


  // Players — the campaign's player sheets; click one to edit it full-bleed (the
  // full Character Sheet, in-place).
  // Files — every campaign file (player sheets, NPCs, orgs, Night City, documents).
  // Editing a doc opens it full-bleed in the section (Character Sheet, etc.).
  // Open a campaign doc full-bleed inside the Files section (vs the old overlay).
  // Re-render the current section into its current host (PREP container or live panel).
  function cdRerender() { if (cdHost) cdRenderSection(cdSection, cdHost); }

  /* Sessions — persistent records with a live journal. List → session page. */
  // A session page mirrors the Overview structure (banner + recap/notes + journal).
  // GO LIVE — resume an existing session or start a new one, then pick sheets to host.

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
    var evs = prep().events;
    if (cdEventSel && !item(evs, cdEventSel).id) cdEventSel = null;
    if (!cdEventSel) cdEventSel = (evs[0] && evs[0].id) || null;
    var evItems = evs.map(function (e) {
      return '<div class="ev-li' + (e.id === cdEventSel ? ' active' : '') + '" data-sel="' + e.id + '"><span class="ev-li-ico">▸</span>' +
        '<span class="ev-li-name">' + esc(e.title || '(untitled reveal)') + '</span>' +
        '<span class="ev-li-preset">' + esc(e.preset || 'imagetext') + (e.trigger && e.trigger.clockId ? ' · ⏱' : '') + '</span>' +
        '<button class="prep-mini" data-rev="' + e.id + '" title="Cast to players">⇄</button>' +
        '<button class="prep-mini prep-del" data-del="' + e.id + '">✕</button></div>';
    }).join('');
    var listItems = evs.length ? evItems : '<div class="cd-empty">No reveals yet.</div>';
    c.innerHTML = '<div class="cd-topbar"><div class="cd-sectitle">cast</div><span style="flex:1"></span>' +
      '<button class="app-btn app-btn-go" id="cd-add">+ Reveal</button></div>' +
      '<div class="cd-board"><div class="ev-list"><div class="cd-side-head">Reveals</div>' + listItems + '</div><div class="cd-boardmain"><div class="ev-canvas" id="ev-canvas"></div></div></div>';
    el('cd-add').onclick = function () { var e = { id: uid('ev'), title: '', preset: 'imagetext', image: '', text: '', portrait: '', npcRef: '', trigger: null }; evs.push(e); cdEventSel = e.id; savePrep(cdRerender); };
    c.querySelectorAll('[data-sel]').forEach(function (b) { b.onclick = function (e) { if (e.target.hasAttribute('data-del') || e.target.hasAttribute('data-rev')) return; cdEventSel = b.getAttribute('data-sel'); cdRerender(); }; });
    c.querySelectorAll('[data-rev]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var ev = item(evs, b.getAttribute('data-rev')); if (ev.id && castReveal(eventReveal(ev))) { b.textContent = '✓'; setTimeout(function () { b.textContent = '⇄'; }, 900); } }; });
    c.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var did = b.getAttribute('data-del'); cdData.meta.prep.events = evs.filter(function (x) { return x.id !== did; }); if (cdEventSel === did) cdEventSel = null; savePrep(cdRerender); }; });
    renderEventCanvas();
  }
  function renderEventCanvas() {
    var box = el('ev-canvas'); if (!box) return;
    var ev = item(prep().events, cdEventSel);
    if (!ev.id) { box.innerHTML = '<div class="cd-empty">Select or add a reveal.</div>'; return; }
    var npcDocs = (cdData.docs && cdData.docs.npcs) || [];
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
        '<div class="ev-addrow"><button class="app-btn" id="ev-addimg">+ Image</button><button class="app-btn" id="ev-addtext">+ Text</button></div></div>';
      // AUTO-TRIGGER config removed — triggers are authored as CAST rule docs (RULES rail).
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
    if (window.FilmWindow && window.FilmWindow.preview) window.FilmWindow.preview(el('ev-preview'), eventReveal(ev));
  }
  function eventReveal(ev) { return { kind: 'event', title: ev.title || '', tabs: ev.tabs || null, blocks: evBlocks(ev), ts: Date.now() }; }
  // Clock editor in the Events canvas (clocks live alongside events — they link).

  /* Reusable drag-drop helpers (palette → bins/containers). Shared by Squads + Loot. */

  /* Squads — palette (NPC files + archetypes + PCs) drag-dropped into squad bins.
     Refs are resolved to combatants at combat launch. A squad can link a loot box. */

  /* Locations — the Night City GM planner, campaign-scoped. Locations marked
     "public" (in the planner's place editor) push live to players in session. */
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

  var CLOCK_COLORS = ['#c0392b', '#b8860b', '#1a7a2e', '#7a5ab8'];

  /* Loot — palette (money / IP / objects from DBs / container) drag-dropped into
     nested container boxes. Level-0 nodes (and money, not IP) are unique or shared. */
  var LOOT_DBS = null;
  function lootNodeLabel(n) {
    if (n.type === 'money') return '€$' + (n.amount || 0) + (n.form && n.form !== 'eddies' ? ' ' + n.form : '');
    if (n.type === 'ip') return (n.amount || 0) + ' IP';
    if (n.type === 'container') return (n.name || 'Container') + ' (' + (n.children || []).length + ')';
    return n.name || 'Item';
  }


  /* ── Doc editor overlay: tool via the file-bridge (?cdoc), or a textarea for documents ── */
  // onClose: optional () => Promise that saves before the overlay is torn down.


  /* ── Sessions ── */
  var SESS_MODE_KEY = 'bartmoss_sess_mode';
  var sess = { camp: null, id: null, role: 'gm', sheetId: null, section: 'overview', hosted: [], order: [], cols: {}, hub: null, mode: 'grid', active: null, panelOpen: true, activeSessionId: null, toolsExp: true };
  try { var m = localStorage.getItem(SESS_MODE_KEY); if (m === 'grid' || m === 'tabs' || m === 'columns') sess.mode = m; } catch (e) {}
  function idOf(docName) { return String(docName).replace(/\.json$/i, ''); }
  function playerLink(sid) {
    sid = idOf(sid);
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
    sheetId = sheetId ? idOf(sheetId) : sheetId;   // never carry a .json extension into the sheet doc id (avoids .json.json files)
    sess.id = id; sess.role = 'player'; sess.sheetId = sheetId; sess.order = sheetId ? [sheetId] : [];
    sess.active = sheetId || null; sess.section = 'mysheet'; sess.tabs = null; sess.activeTab = null;
    setMode('active'); showView('view-session');
    el('app-crumbs').innerHTML = '<span class="crumb-cur">' + esc(id) + '</span>';
    joinSession(id, { name: sheetId || 'Player', role: 'player' });
    // v2 read-only data layer for the player shell (public entities, links, props).
    // Players never migrate — if the GM hasn't opened the campaign in v2 yet, views are just empty.
    if (window.App) {
      App.setCampaign(id, 'player');
      App.getMeta(true).then(function (meta) {
        App.uiLoad({});   // players don't restore GM UI memory
        if (window.Store) { Store.idIndexLoad(meta); Store.propsLoad(meta); Store.invalidate(); }
        if (window.Links) Links.invalidate();
      }).then(function () { if (window.Store) return refreshShopDocs(); }).catch(function () {});
    }
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
      // Player: combat auto-opens when the GM launches it.
      if (sess.role !== 'gm') {
        if (m.active) openTool('combat');
        else if (window.Shell && Shell.activeToolId && Shell.activeToolId() === 'combat') openTool('sheet');
      }
      if (window.Shell && Shell.state && Shell.state().active === 'combat') Shell.renderTabContent();
      renderCombatPill();
      updateOverviewActions();
    });
    sess.camp.onStatus(function (st) { var e = el('app-status'); if (e) { e.textContent = st === 'connected' ? 'Hub · live' : st; e.className = 'app-status' + (st === 'connected' ? ' on' : ''); } });
    if (sess.camp.onOverview) sess.camp.onOverview(function () {
      refreshOverviewText();
      if (sess.role === 'player' && window.FilmWindow) window.FilmWindow.apply(ovGet().reveal);
      if (sess.role === 'gm') renderMonitor();
      if (sess.role === 'player') ncSyncToFrame();
    });
    // Apply any reveal already present when the player joins.
    if (sess.role === 'player' && window.FilmWindow) setTimeout(function () { window.FilmWindow.apply(ovGet().reveal); }, 400);
  }

  function ensureCdData(cb) {
    if (cdData && state.campaignId === sess.id) return cb();
    state.campaignId = sess.id;
    api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) { cdData = d; cb(); }).catch(function () {});
  }
  /* ════ Tabbed shell (top-tabs replace the rail) ════ */
  var TOOLS_GM = [
    { id: 'party', label: 'Party', glyph: '⧉', sub: 'Player sheets' },
    { id: 'cast', label: 'Cast', glyph: '⊡', sub: 'Reveal to players' },
    { id: 'map', label: 'Map', glyph: '▦', sub: 'Shared intel' },
    { id: 'combat', label: 'Combat', glyph: '◎', sub: 'Encounter & squads' },
    { id: 'clocks', label: 'Clocks', glyph: '◴', sub: 'Tension trackers' },
    { id: 'npc', label: 'NPC', glyph: '☺', sub: 'Bestiary & generators' },
    { id: 'org', label: 'ORG', glyph: '⌗', sub: 'Organisations' },
    { id: 'shop', label: 'Shop', glyph: '▣', sub: 'Storefronts & catalog' },
    { id: 'database', label: 'Database', glyph: '▤', sub: 'Reference & custom' },
    { id: 'log', label: 'Log', glyph: '☰', sub: 'Session history' },
  ];
  var TOOLS_PLAYER = [
    { id: 'sheet', label: 'Sheet', glyph: '⒜', sub: 'Your character' },
    { id: 'map', label: 'Map', glyph: '▦', sub: 'Shared intel' },
    { id: 'npc', label: 'NPC', glyph: '☺', sub: 'Contacts & public' },
    { id: 'org', label: 'ORG', glyph: '⌗', sub: 'Organisations' },
    { id: 'shop', label: 'Shop', glyph: '▣', sub: 'Buy gear & chrome' },
    { id: 'clocks', label: 'Clocks', glyph: '◴', sub: 'Public clocks' },
    { id: 'database', label: 'Database', glyph: '▤', sub: 'Reference' },
  ];
  var TOOL_ALIAS = { players: 'party', mysheet: 'sheet', table: 'cast', locations: 'map', encounter: 'combat', generators: 'combat', bestiary: 'npc', studio: 'npc' };
  var ENTITY_GLYPH = { sheet: '⒜', npc: '☺', org: '⌗', shop: '▣', location: '▦' };
  function toolDefs() { return sess.role === 'gm' ? TOOLS_GM : TOOLS_PLAYER; }
  function toolMeta(id) { var all = TOOLS_GM.concat(TOOLS_PLAYER); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return { id: id, label: id, glyph: '·' }; }
  function activeTab() { return window.Shell ? Shell.activeTab() : null; }
  function activeToolId() { return window.Shell ? Shell.activeToolId() : null; }

  function renderSessionShell() {
    // The six-section shell (js/app-shell.js) owns the session workspace.
    // app.js hands it a bridge into the internal renderers it still hosts.
    if (!window.Shell) return;
    Shell.bind({
      sess: sess,
      menuNav: !!(window.bartmoss && window.bartmoss.onNavShortcut),
      toolRender: toolRender,
      entityRender: entityRender,
      ensureCdData: ensureCdData,
      renderCrumbs: renderCrumbs,
      renderMonitor: renderMonitor,
      qdbEnsure: qdbEnsure,
      campName: campName,
      shareLinks: shareLinks,
      renderCampaigns: renderCampaigns,
      // Player leaves → back to the site (offline tools + the CONNECT popup), not the app card.
      leaveSession: function () { endSessionConn(); location.href = 'index.html?player=1'; },
      sessions: sessions,
      fmtTime: fmtTime,
      startNewSession: function (done) {
        var s = newSession(); sessions().push(s); sess.activeSessionId = s.id;
        saveSessions(function () { logSession('— new session —'); if (done) done(); });
      },
      castReveal: castReveal,
      archetypeGenModal: function (ctx) { archetypeGenModal(ctx); },
      orgGenModal: function (ctx) { orgGenModal(ctx); },
      clockViz: function (style, v, m, col, size) { return clockViz(style, v, m, col, size); },
      logSession: function (msg) { try { logSession(msg); } catch (e) {} },
      idOf: idOf,
      shopWriteItem: function (json, it) { return shopWriteItem(json, it); },
      openMyStore: function () { sess.shopMode = 'sell'; sess.shopSel = null; openTool('shop', true); },
    });
    Shell.mount();
    updateOverviewActions();
  }
  /* ── Tab/session machinery now lives in js/app-shell.js (six-section shell).
     Slim delegators keep every legacy call site + the palette contract working. ── */
  function renderTabs() { if (window.Shell) Shell.renderTabs(); }
  function activatePane() { if (window.Shell) Shell.activatePane(); }
  function renderTabContent() { if (window.Shell) Shell.renderTabContent(); }
  function paneEl(id) { return window.Shell ? Shell.paneEl(id) : null; }
  function activeHost() { return window.Shell ? Shell.activeHost() : null; }
  function navNewTab() { if (window.Shell) Shell.navNewTab(); }
  function navNthTab(n) { }   // ⌘1..9→tabs retired (⌘1..6 = sections); kept for palette compat
  function navCloseActive() { if (window.Shell) Shell.navCloseActive(); }
  function navReopen() { if (window.Shell) Shell.navReopen(); }
  function toolRender(tool, host) {
    host.innerHTML = '';
    if (tool === 'combat' && sess.role !== 'gm') {   // players: live combat view (auto-opened)
      host.className = 'tab-content sess-sec-files';
      host.innerHTML = '<div id="pcbt-mount" style="position:absolute;inset:0;overflow:auto"></div>';
      if (window.CombatUI) window.CombatUI.mount(el('pcbt-mount'), { camp: sess.camp, role: 'player' });
      return;
    }
    if (tool === 'party') return renderPlayers(host);
    if (tool === 'sheet') return renderLivesheet(host);
    if (tool === 'cast') return renderTheTable(host);
    if (tool === 'map') return renderMap(host);
    if (tool === 'combat') return renderCombatTab(host);
    if (tool === 'clocks') return renderClocks(host);
    if (tool === 'npc') return renderBestiary(host);
    if (tool === 'org') return renderOrgTab(host);
    if (tool === 'shop') return renderShop(host);
    if (tool === 'database') return renderDatabase(host);
    if (tool === 'log') return renderLog(host);
    host.innerHTML = '<div class="app-empty">Unknown tool.</div>';
  }
  // Open a tool: routed to its section by the Shell.
  function openTool(tool, force) {
    if (window.Shell) Shell.openTool(TOOL_ALIAS[tool] || tool, force);
  }
  // Open a specific ENTITY (sheet / npc / org) as its own persistent tab. Entity
  // panes are isolated iframes, so several can coexist with no fixed-id clashes.
  function openEntity(kind, ref, label) {
    if (window.Shell) Shell.openEntity(kind, ref, label || idOf(ref));
  }
  function entityRender(t, host) {
    host.className = 'tab-content sess-sec-files';
    var url;
    if (t.kind === 'sheet') url = frameSrc(t.ref);
    else if (t.kind === 'npc') url = 'npc-sheet.html?cdoc=1&cid=' + encodeURIComponent(sess.id) + '&ctype=npcs&cname=' + encodeURIComponent(t.ref);
    else if (t.kind === 'org') url = 'organisations.html?cdoc=1&cid=' + encodeURIComponent(sess.id) + '&ctype=orgs&cname=' + encodeURIComponent(t.ref);
    if (!url) { host.innerHTML = '<div class="app-empty">Unknown entity.</div>'; return; }
    host.innerHTML = '<iframe class="ent-frame" src="' + esc(url) + '"></iframe>';
  }
  function gotoSection(key) { openTool(key); }   // legacy callers → open a tab
  // Cross-nav: open the Shop tool focused on a shop linked to a given NPC / org / location.
  function shopsLinkedTo(type, ref) { return _shopDocs.map(function (r) { return r.json; }).filter(function (s) { return s.link && s.link.type === type && s.link.ref === ref; }); }
  function openShopFor(type, ref) {
    var matches = shopsLinkedTo(type, ref);
    if (matches.length) sess.shopSel = matches[0].id;
    openTool('shop', true);   // force re-render so the focused shop reflects the new selection
  }
  /* ── Run Table shared components (handoff DS, vanilla) ── */
  // Proper NPC names (street handle + real name) so generated NPCs aren't "Ganger \"Razor\"".
  var NPC_FIRST = ['Mireille', 'Tomas', 'Lin', 'Dée', 'Kazuo', 'Ana', 'Viktor', 'Sasha', 'Reiko', 'Diego', 'Nadia', 'Omar', 'Yuki', 'Cole', 'Inez', 'Marek', 'Priya', 'Dmitri', 'Lena', 'Theo'];
  var NPC_LAST = ['Vance', 'Vasquez', 'Okafor', 'Cassel', 'Tanaka', 'Reyes', 'Kowalski', 'Mbeki', 'Ferreira', 'Novak', 'Haddad', 'Sato', 'Brennan', 'Costa', 'Petrov', 'Singh', 'Dubois', 'Romano', 'Cruz', 'Adeyemi'];
  var NPC_HANDLE = ['Razor', 'Static', 'Vex', 'Ghost', 'Spike', 'Cinder', 'Onyx', 'Halo', 'Wire', 'Vault', 'Echo', 'Mantis', 'Drift', 'Cobra', 'Nyx', 'Patch', 'Zero', 'Hex', 'Slick', 'Talon'];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function npcName() { return pick(NPC_FIRST) + ' ' + pick(NPC_LAST); }
  function npcHandle() { return pick(NPC_HANDLE); }
  function rtHead(glyph, title, sub, acts) {
    return '<div class="rt-head"><span class="rt-head-title">' + esc(title) + '</span>' +
      (acts ? '<span class="rt-head-act">' + acts + '</span>' : '') + '</div>';
  }
  // Cast a reveal to the players — always live: the campaign being open IS the session.
  function castReveal(reveal) {
    if (sess.camp && sess.camp.setOverview) { reveal.ts = Date.now(); sess.camp.setOverview({ reveal: reveal }); renderMonitor(); }
    if (typeof logSession === 'function') { try { logSession('⇄ Cast : ' + (reveal.title || 'reveal')); } catch (e) {} }
    return true;
  }
  // GM ON AIR control monitor (bottom-right): a live scaled preview of the cast.
  var _monKey = null;
  function renderMonitor() {
    var existing = el('rt-monitor');
    if (sess.role !== 'gm' || activeToolId() === 'cast') { if (existing) existing.parentNode.removeChild(existing); _monKey = null; return; }
    var rev = ovGet().reveal, on = !!rev;
    // Same broadcast + same fold state → keep the DOM (activatePane calls this
    // on every tab switch; rebuilding remounted the preview each time).
    var key = (on ? 'on:' + (rev.ts || rev.title || '') : 'off') + (sess.monMin ? ':min' : '');
    if (existing && key === _monKey) return;
    _monKey = key;
    var m = existing || document.createElement('div');
    if (!existing) { m.id = 'rt-monitor'; document.body.appendChild(m); }
    var min = !!sess.monMin;
    m.className = 'rt-monitor' + (on ? ' on' : '') + (min ? ' min' : '');
    m.innerHTML = '<div class="rt-monitor-head"><span class="rt-monitor-dot"></span><span style="flex:1">' + (on ? 'ON AIR' : 'OFF AIR') + '</span>' +
      '<button class="rt-monitor-min" id="rt-mon-min" title="' + (min ? 'Expand' : 'Collapse') + '">' + (min ? '▴' : '▾') + '</button>' +
      '<button class="rt-monitor-x" id="rt-mon-x" title="Clear cast">✕</button></div>' +
      (min ? '' : '<div class="rt-monitor-screen" id="rt-mon-screen"></div>' +
      '<div class="rt-monitor-foot">' + (on ? esc(rev.title || 'Cast') : 'Nothing cast') + ' · control monitor</div>');
    el('rt-mon-min').onclick = function () { sess.monMin = !sess.monMin; renderMonitor(); };
    el('rt-mon-x').onclick = function () { if (sess.camp && sess.camp.setOverview) sess.camp.setOverview({ reveal: null }); renderMonitor(); };
    if (!min && on && window.FilmWindow && window.FilmWindow.preview) window.FilmWindow.preview(el('rt-mon-screen'), rev);
  }
  function removeMonitor() { var m = el('rt-monitor'); if (m) m.parentNode.removeChild(m); _monKey = null; }
  /* Quick database — retired in the aside shell (search + Corpus → Database
     cover it); keep only the teardown so no hidden DOM piles up per pane. */
  function qdbEnsure() {
    if (document.body.classList.contains('asd-live')) { removeQdb(); return; }
    var t = activeTab(), show = t && t.tool;
    if (!show) { removeQdb(); return; }
    if (el('qdb-btn')) return;
    var b = document.createElement('button'); b.id = 'qdb-btn'; b.className = 'qdb-btn'; b.title = 'Quick database'; b.textContent = 'db';
    b.onclick = qdbToggle; document.body.appendChild(b);
  }
  function removeQdb() { ['qdb-btn', 'qdb-pop'].forEach(function (i) { var e = el(i); if (e) e.parentNode.removeChild(e); }); }
  function qdbLoad(then) {
    if (DB_CACHE) return then();
    DB_CACHE = {};
    Promise.all(DB_DEFS.map(function (d) { return fetch(d[2]).then(function (r) { return r.json(); }).then(function (j) { DB_CACHE[d[0]] = Array.isArray(j) ? j : (j.items || j.roles || []); }).catch(function () { DB_CACHE[d[0]] = []; }); })).then(then);
  }
  function qdbToggle() {
    var p = el('qdb-pop'); if (p) { p.parentNode.removeChild(p); return; }
    p = document.createElement('div'); p.id = 'qdb-pop'; p.className = 'qdb-pop';
    p.innerHTML = '<div class="qdb-head">DATABASE<button class="qdb-x" id="qdb-x">✕</button></div>' +
      '<input class="rt-input" id="qdb-s" placeholder="search gear · cyber · corps…" style="margin:8px">' +
      '<div class="qdb-results" id="qdb-res"><div class="app-empty">Type to search.</div></div>';
    document.body.appendChild(p);
    el('qdb-x').onclick = function () { p.parentNode.removeChild(p); };
    el('qdb-s').oninput = function () { qdbSearch(el('qdb-s').value); };
    el('qdb-s').focus();
    qdbLoad(function () {});
  }
  function qdbSearch(q) {
    var res = el('qdb-res'); if (!res) return; q = (q || '').toLowerCase();
    if (!q) { res.innerHTML = '<div class="app-empty">Type to search.</div>'; return; }
    qdbLoad(function () {
      var hits = [];
      ['weapons', 'cyberware', 'gear', 'vehicles', 'decks', 'programs', 'corps'].forEach(function (cat) { (DB_CACHE[cat] || []).forEach(function (r) { if (JSON.stringify(r).toLowerCase().indexOf(q) >= 0) hits.push({ cat: cat, r: r }); }); });
      hits = hits.slice(0, 80);
      res.innerHTML = hits.length ? hits.map(function (h) { return '<div class="qdb-row"><span class="qdb-cat">' + h.cat + '</span><b>' + esc(h.r.name || '') + '</b><span class="qdb-d">' + esc(h.r.cost || h.r.damage || h.r.industry || h.r.hc || '') + '</span></div>'; }).join('') : '<div class="app-empty">No match.</div>';
    });
  }
  // Queue a generated NPC for the next combat (consumed by openCombatSetup).
  function addToCombat(sheet) {
    if (!window.CombatEngine) { alert('Combat engine not loaded.'); return 0; }
    var q = sess.pendingCombat || (sess.pendingCombat = []);
    q.push(window.CombatEngine.makeCombatant({ id: 'gen-' + Date.now().toString(36) + '-' + q.length, kind: 'npc', name: npcDocName(sheet), sheet: sheet }));
    return q.length;
  }

  /* ── Generators (CREATE) — Combatant wired to NPCGen ── */
  function renderGenerators(panel) {
    if (!panel) return;
    var tab = sess.genTab || 'combatant';
    panel.innerHTML = rtHead('⊞', 'Generators', 'Roll NPCs, squads & loot — semi-random', '') +
      '<div class="rt-tabs">' + [['combatant', 'Combatant'], ['squad', 'Squad'], ['loot', 'Loot']].map(function (t) {
        return '<button class="rt-tab' + (t[0] === tab ? ' active' : '') + '" data-gtab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><div id="gen-body"></div>';
    panel.querySelectorAll('[data-gtab]').forEach(function (b) { b.onclick = function () { sess.genTab = b.getAttribute('data-gtab'); renderGenerators(panel); }; });
    var body = panel.querySelector('#gen-body');
    if (tab === 'combatant') renderGenCombatant(body);
    else if (tab === 'squad') renderGenSquad(body);
    else renderGenLoot(body);
  }
  function renderGenCombatant(body) {
    var G = window.NPCGen; if (!G) { body.innerHTML = '<div class="app-empty">Generator not loaded.</div>'; return; }
    var archOpts = G.list().map(function (a) { return '<option value="' + a.id + '">' + esc(a.label) + '</option>'; }).join('');
    var tierOpts = G.TIER_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === 'average' ? ' selected' : '') + '>' + esc(G.TIERS[k].label) + '</option>'; }).join('');
    var chromeOpts = ['auto', 'none', 'light', 'moderate', 'heavy', 'borg'].map(function (c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('');
    var facOpts = ['—', 'Arasaka', 'Militech', 'Maelstrom', 'Tyger Claws', 'NCPD', 'Scavengers', 'Independent'].map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('');
    body.innerHTML = '<div class="rt-two">' +
      '<div class="rt-panel"><div class="rt-panel-head">Settings</div><div class="rt-panel-body">' +
        '<label class="rt-field"><span class="rt-field-l">Role</span><select class="rt-select" id="g-arch">' + archOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Threat</span><select class="rt-select" id="g-tier">' + tierOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Faction</span><select class="rt-select" id="g-fac">' + facOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Cyberware tier</span><select class="rt-select" id="g-chrome">' + chromeOpts + '</select></label>' +
        '<label class="rt-switch" style="margin:2px 0 14px"><input type="checkbox" id="g-named" checked><span class="rt-switch-track"></span> Named (not a mook)</label>' +
        '<button class="rt-btn rt-btn--green rt-btn--block" id="g-roll">Generate</button>' +
      '</div></div><div id="g-dossier"></div></div>';
    renderGenDossier(el('g-dossier'), sess.genSheet);
    el('g-roll').onclick = function () {
      loadCombatDBs().then(function (DBs) {
        var arch = el('g-arch').value, tier = el('g-tier').value, fac = el('g-fac').value, chrome = el('g-chrome').value, named = el('g-named').checked;
        var roleLabel = G.ARCHETYPES[arch] ? G.ARCHETYPES[arch].label : arch;
        var s = G.generate({ archetype: arch, tier: tier, chrome: chrome === 'auto' ? null : chrome, name: 'x' }, DBs);
        s.role = roleLabel;
        if (named) { s.handle = npcHandle(); s.name = npcName(); } else { s.handle = ''; s.name = roleLabel; }
        if (fac && fac !== '—') { s.faction = fac; s.notes = (s.notes || '') + ' · ' + fac; }
        sess.genSheet = s; renderGenDossier(el('g-dossier'), s);
      });
    };
  }
  function renderGenDossier(host, s) {
    if (!host) return;
    if (!s) { host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Generated combatant</div><div class="rt-panel-body"><div class="app-empty">Set parameters and Generate.</div></div></div>'; return; }
    var statKeys = ['INT', 'REF', 'TECH', 'COOL', 'BODY', 'MA'];
    var statsHtml = statKeys.map(function (k) { return '<div class="rt-stat"><div class="rt-stat-l">' + k + '</div><div class="rt-stat-v">' + (s.stats && s.stats[k] != null ? s.stats[k] : '—') + '</div></div>'; }).join('');
    var skills = (s.skills || []).slice().sort(function (a, b) { return b.val - a.val; }).slice(0, 5);
    var skillsHtml = skills.map(function (sk) { return '<div class="rt-rowline"><span>' + esc(sk.name) + '</span><span>' + sk.val + '</span></div>'; }).join('') || '<div class="app-empty">—</div>';
    var gear = [].concat(
      (s.weapons || []).map(function (w) { return { t: esc((w.name || w) + (w.damage ? ' (' + w.damage + ')' : '')), red: false }; }),
      (s.armor || []).map(function (a) { return { t: esc(a.name || a), red: false }; }),
      (s.cyberware || []).map(function (c) { return { t: esc(c.name || c), red: true }; }));
    var gearHtml = gear.map(function (g) { return '<div class="rt-rowline' + (g.red ? ' rt-rowline-red' : '') + '"><span>' + g.t + '</span></div>'; }).join('') || '<div class="app-empty">—</div>';
    var threat = (s.tier || '').charAt(0).toUpperCase() + (s.tier || '').slice(1);
    host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Generated combatant' +
      '<span class="rt-panel-act"><span class="rt-badge rt-badge--red">' + esc(threat || 'NPC') + '</span>' +
      '<button class="rt-btn" id="gd-combat">+ Add to combat</button></span></div>' +
      '<div class="rt-panel-body">' +
        '<div class="rt-dossier-top"><div class="rt-portrait"></div>' +
          '<div style="flex:1;min-width:0"><div class="rt-head-title" style="font-size:24px">' + esc(s.handle ? (s.name + ' “' + s.handle + '”') : (s.name || s.role || 'NPC')) + '</div>' +
          '<div class="rt-head-sub">' + esc((s.role || '') + (s.faction ? ' · ' + s.faction : '') + ' · ' + (s.chrome || '') + ' chrome') + '</div>' +
          '<div class="rt-stats" style="margin-top:12px">' + statsHtml + '</div></div></div>' +
        '<div class="rt-cols2"><div><div class="rt-field-l">Key skills</div>' + skillsHtml + '</div>' +
          '<div><div class="rt-field-l">Gear &amp; chrome</div>' + gearHtml + '</div></div>' +
        '<div style="display:flex;gap:14px;align-items:center;margin-top:16px">' +
          '<button class="rt-btn rt-btn--gold" id="gd-cast">Cast as reveal</button>' +
          '<button class="rt-link" id="gd-save">Save to roster</button></div>' +
      '</div></div>';
    el('gd-cast').onclick = function () { castReveal({ kind: 'event', preset: 'dossier', title: (s.handle ? (s.name + ' “' + s.handle + '”') : (s.name || s.role || 'NPC')), portrait: '', text: (s.notes || '') }); };
    el('gd-save').onclick = function () { saveGeneratedNPCs(sess.id, [s]); el('gd-save').textContent = 'Saved ✓'; };
    el('gd-combat').onclick = function () { var n = addToCombat(s); el('gd-combat').textContent = '✓ queued (' + n + ') — see Encounter'; };
  }
  // Generators — Squad (coherent team) + Loot (rolled rewards).
  function renderGenSquad(body) {
    var G = window.NPCGen; if (!G) { body.innerHTML = '<div class="app-empty">Generator not loaded.</div>'; return; }
    var archOpts = G.list().map(function (a) { return '<option value="' + a.id + '">' + esc(a.label) + '</option>'; }).join('');
    var tierOpts = G.TIER_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === 'average' ? ' selected' : '') + '>' + esc(G.TIERS[k].label) + '</option>'; }).join('');
    body.innerHTML = '<div class="rt-two">' +
      '<div class="rt-panel"><div class="rt-panel-head">Settings</div><div class="rt-panel-body">' +
        '<label class="rt-field"><span class="rt-field-l">Faction / archetype</span><select class="rt-select" id="sq-arch">' + archOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Base threat</span><select class="rt-select" id="sq-tier">' + tierOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Size</span><input class="rt-input" id="sq-size" type="number" value="4" min="2" max="8"></label>' +
        '<button class="rt-btn rt-btn--green rt-btn--block" id="sq-roll">Generate squad</button>' +
      '</div></div><div id="sq-out"></div></div>';
    el('sq-roll').onclick = function () {
      loadCombatDBs().then(function (DBs) {
        var team = G.generateTeam({ archetype: el('sq-arch').value, tier: el('sq-tier').value, size: clampN(parseInt(el('sq-size').value, 10) || 4, 2, 8) }, DBs);
        team.forEach(function (s, i) { s.handle = npcHandle(); s.name = npcName(); if (i === 0) s.role = s.role + ' (lead)'; });
        sess.genTeam = team;
        var rows = team.map(function (s, i) {
          var wpn = (s.weapons && s.weapons[0] && (s.weapons[0].name || s.weapons[0])) || '—';
          return '<div class="rt-rowline"><span>' + (i === 0 ? '★ ' : '') + esc(s.name + ' “' + s.handle + '”') + '</span>' +
            '<span style="color:var(--text2)">' + esc((s.role || '') + ' · REF ' + s.stats.REF + ' · BODY ' + s.stats.BODY + ' · ' + wpn) + '</span></div>';
        }).join('');
        el('sq-out').innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Squad (' + team.length + ')' +
          '<span class="rt-panel-act"><button class="rt-btn" id="sq-combat">+ Add to combat</button><button class="rt-btn" id="sq-lib">Save as squad</button><button class="rt-btn" id="sq-save">Save NPCs</button></span></div>' +
          '<div class="rt-panel-body">' + rows + '</div></div>';
        el('sq-save').onclick = function () { saveGeneratedNPCs(sess.id, team); el('sq-save').textContent = 'Saved ✓'; };
        // Persist the squad CONFIG to the library (squads/ docs) — loadable in combat setup.
        el('sq-lib').onclick = function () {
          if (!window.Store) return;
          var dflt = (G.list().filter(function (a) { return a.id === el('sq-arch').value; })[0] || {}).label || 'Squad';
          window.App.prompt('Save as squad', 'Squad name', dflt, function (name) {
            if (!name) return;
            Store.create('squad', { name: name, members: team.map(function (s) { return { kind: 'mook', sheet: s, count: 1 }; }), settings: {}, props: {} })
              .then(function () { var b = el('sq-lib'); if (b) b.textContent = 'Squad ✓'; });
          });
        };
        el('sq-combat').onclick = function () { var n = 0; team.forEach(function (s) { n = addToCombat(s); }); el('sq-combat').textContent = '✓ queued (' + n + ')'; };
      });
    };
  }
  // Loot pools as {name, detail} with a rarity weight; eddies rolled per source.
  var LOOT_TABLES = {
    Corpse: { eb: [1, 6, 100], items: [['Sidearm + 1 clip', '2d6 · P', 1], ['Agent', 'pocket comp', 1], ['Keycard', 'R1 access', 2], ['Stim', '1d6 heal', 1], ['Cyberdeck chip', '~800 €$', 3], ['Designer drug', 'street', 2]] },
    Stash: { eb: [2, 6, 100], items: [['Armorjack vest', 'SP 14', 1], ['Ammo crate', '×3 weapons', 1], ['Paydata shard', '~3k €$ fence', 3], ['Medkit ×2', '1d6 heal', 1], ['Smartgun link', 'cyber', 3], ['Grenade ×2', '7d6 frag', 2]] },
    Vault: { eb: [1, 10, 1000], items: [['Mil-spec rifle', '5d6 · RIF', 3], ['Corporate paydata', '~10k €$', 4], ['Prototype cyberware', 'rare', 4], ['Designer drug cache', 'high value', 3], ['Black-market deck', 'SP20', 4], ['Bearer credchip', '5k €$', 3]] },
    Vendor: { eb: [1, 6, 100], items: [['Cyberware (light)', '1d6 HC', 2], ['Ammo (any)', 'standard', 1], ['Armor piece', 'SP varies', 1], ['Tech tool', '+1 task', 1], ['Forged SIN', 'illegal', 3], ['Med supplies', 'restock', 1]] },
  };
  var RARITY_MAX = { Common: 1, Uncommon: 2, Rare: 3, 'Black-market': 4 };
  function roll(n, d, mult) { var t = 0; for (var i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * d); return t * (mult || 1); }
  // Non-portable containers grantable as loot (mirror of the sheet's CUSTOM_STORAGE_FIXED).
  var LOOT_CONTAINERS = [
    { name: 'Cardboard Box', slots: 8, wt: 0.3, cost: 1, notes: 'Disposable box.' },
    { name: 'Storage Bin', slots: 20, wt: 2, cost: 20, notes: 'Heavy-duty plastic bin.' },
    { name: 'Wooden Crate', slots: 24, wt: 6, cost: 25, notes: 'Nailed shipping crate.' },
    { name: 'Footlocker', slots: 20, wt: 8, cost: 45, notes: 'Military footlocker.' },
    { name: 'Lockbox', slots: 6, wt: 3, cost: 35, notes: 'Keyed steel box.' },
    { name: 'Strongbox', slots: 10, wt: 9, cost: 120, notes: 'Reinforced, combo lock. SP10.' },
    { name: 'Wall Safe', slots: 12, wt: 25, cost: 400, notes: 'Concealed safe. SP15.' },
    { name: 'Floor Vault', slots: 40, wt: 120, cost: 1500, notes: 'Bolt-down vault. SP25.' },
    { name: 'Gun Locker', slots: 16, wt: 35, cost: 250, notes: 'Long-gun cabinet. SP12.' },
    { name: 'Weapons Crate', slots: 24, wt: 10, cost: 60, notes: 'Mil-surplus arms crate.' },
    { name: 'Ammo Can', slots: 8, wt: 2.5, cost: 15, notes: 'Sealed steel ammo can.' },
    { name: 'Pelican Hard Case', slots: 18, wt: 6, cost: 180, notes: 'IP67 hard case. SP8.' },
    { name: 'Shipping Container', slots: 200, wt: 2200, cost: 3000, notes: '20ft container.' }
  ];
  function renderGenLoot(body) {
    var srcOpts = Object.keys(LOOT_TABLES).map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
    var rarOpts = Object.keys(RARITY_MAX).map(function (k) { return '<option value="' + k + '"' + (k === 'Rare' ? ' selected' : '') + '>' + k + '</option>'; }).join('');
    body.innerHTML = '<div class="rt-two">' +
      '<div class="rt-panel"><div class="rt-panel-head">Settings</div><div class="rt-panel-body">' +
        '<label class="rt-field"><span class="rt-field-l">Source</span><select class="rt-select" id="lt-src">' + srcOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Rarity ceiling</span><select class="rt-select" id="lt-rar">' + rarOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Items</span><input class="rt-input" id="lt-n" type="number" value="3" min="1" max="6"></label>' +
        '<button class="rt-btn rt-btn--green rt-btn--block" id="lt-roll">Roll loot</button>' +
        '<label class="rt-field" style="border-top:2px solid var(--ink);padding-top:12px;margin-top:14px"><span class="rt-field-l">Container as loot</span><select class="rt-select" id="lt-cont">' + LOOT_CONTAINERS.map(function (c, i) { return '<option value="' + i + '">' + esc(c.name) + ' · ' + c.slots + ' slots</option>'; }).join('') + '</select></label>' +
        '<button class="rt-btn rt-btn--block" id="lt-contadd">+ Add container to Loot</button>' +
      '</div></div><div id="lt-out"></div></div>';
    el('lt-contadd').onclick = function () {
      var c = LOOT_CONTAINERS[parseInt(el('lt-cont').value, 10) || 0]; if (!c) return;
      ensureCdData(function () {
        var box = { id: uid('loot'), name: c.name, nodes: [{ id: uid('ln'), type: 'item', cat: 'container', name: c.name, data: c, share: 'unique' }] };
        prep().loot.push(box);
        savePrep(function () { var b = el('lt-contadd'); if (b) { b.textContent = 'Added “' + c.name + '” ✓'; setTimeout(function () { b.textContent = '+ Add container to Loot'; }, 1200); } });
      });
    };
    el('lt-roll').onclick = function () {
      var src = el('lt-src').value, n = clampN(parseInt(el('lt-n').value, 10) || 3, 1, 6), max = RARITY_MAX[el('lt-rar').value] || 3;
      var tbl = LOOT_TABLES[src], pool = tbl.items.filter(function (it) { return it[2] <= max; }).slice();
      var picks = []; for (var i = 0; i < n && pool.length; i++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      var eb = roll(tbl.eb[0], tbl.eb[1], tbl.eb[2]);
      sess.genLoot = { src: src, eb: eb, picks: picks };
      el('lt-out').innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Loot · ' + esc(src) +
        '<span class="rt-panel-act"><button class="rt-btn" id="lt-save">Save to Loot</button><button class="rt-btn rt-btn--gold" id="lt-cast">Cast</button></span></div>' +
        '<div class="rt-panel-body"><div class="rt-rowline"><span style="color:var(--yellow);font-weight:700">€$ ' + eb.toLocaleString() + '</span><span>eddies</span></div>' +
          picks.map(function (p) { return '<div class="rt-rowline"><span>' + esc(p[0]) + '</span><span style="color:var(--text2)">' + esc(p[1]) + '</span></div>'; }).join('') + '</div></div>';
      el('lt-cast').onclick = function () { castReveal({ kind: 'event', title: 'Loot found', blocks: [{ type: 'text', mode: 'panel', size: 'xl', text: 'YOU FOUND\n\n€$ ' + eb.toLocaleString() + '\n' + picks.map(function (p) { return p[0] + ' — ' + p[1]; }).join('\n') }] }); };
      el('lt-save').onclick = function () { ensureCdData(function () { var box = { id: uid('loot'), name: src + ' loot', nodes: [{ id: uid('ln'), type: 'money', amount: eb, form: 'eddies', share: 'shared' }].concat(picks.map(function (p) { return { id: uid('ln'), type: 'item', cat: 'custom', name: p[0] + ' (' + p[1] + ')', share: 'shared' }; })) }; prep().loot.push(box); savePrep(function () { el('lt-save').textContent = 'Saved ✓'; }); }); };
    };
  }

  // Cast tool = the original rich block composer (hierarchical sizes / align /
  // presets / clock triggers / Film Window preview). Reuses the old cdEvents code.
  function renderTheTable(host) {
    if (!host) return;
    host.className = 'tab-content sess-cast';
    ensureCdData(function () { cdSection = 'events'; cdHost = host; cdEvents(host); });
  }

  /* ── Clocks — standalone tension trackers (meta.prep.clocks) ── */
  var CLOCK_VIZ = ['pie', 'bar', 'timer', 'tally', 'dial'];
  // 5 clock visualisations (handoff), dark-on-white.
  function clockViz(style, filled, total, color, size) {
    size = size || 80; total = Math.max(1, total); filled = Math.max(0, Math.min(filled, total));
    if (style === 'bar') {
      return '<div style="width:' + (size * 2.4) + 'px;max-width:100%"><div style="height:18px;border:2px solid #111;background:#fff"><div style="height:100%;width:' + Math.round(filled / total * 100) + '%;background:' + color + '"></div></div></div>';
    }
    if (style === 'timer') {
      var left = total - filled;
      return '<div style="font-family:var(--head);font-size:' + Math.round(size * 0.5) + 'px;color:' + color + ';letter-spacing:1px">T–' + left + '</div>';
    }
    if (style === 'tally') {
      var t = '';
      for (var i = 0; i < total; i++) t += '<span style="font-family:var(--head);font-size:' + Math.round(size * 0.34) + 'px;color:' + (i < filled ? color : '#ccc') + ';margin-right:4px">✕</span>';
      return '<div style="line-height:1.2;max-width:' + (size * 2.6) + 'px">' + t + '</div>';
    }
    var r = size / 2, cx = r, cy = r, ring = r - 3, s = '';
    if (style === 'dial') {
      var ang = (filled / total) * 2 * Math.PI - Math.PI / 2;
      s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + ring + '" fill="#fff" stroke="#111" stroke-width="2"/>';
      for (var j = 0; j < total; j++) { var a = (j / total) * 2 * Math.PI - Math.PI / 2; s += '<line x1="' + (cx + (ring - 5) * Math.cos(a)) + '" y1="' + (cy + (ring - 5) * Math.sin(a)) + '" x2="' + (cx + ring * Math.cos(a)) + '" y2="' + (cy + ring * Math.sin(a)) + '" stroke="#111" stroke-width="2"/>'; }
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + (ring - 8) * Math.cos(ang)) + '" y2="' + (cy + (ring - 8) * Math.sin(ang)) + '" stroke="' + color + '" stroke-width="3"/><circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + color + '"/>';
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + s + '</svg>';
    }
    for (var i2 = 0; i2 < total; i2++) {   // pie (default)
      var a0 = (i2 / total) * 2 * Math.PI - Math.PI / 2, a1 = ((i2 + 1) / total) * 2 * Math.PI - Math.PI / 2;
      var x0 = cx + ring * Math.cos(a0), y0 = cy + ring * Math.sin(a0), x1 = cx + ring * Math.cos(a1), y1 = cy + ring * Math.sin(a1);
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      s += '<path d="M ' + cx + ' ' + cy + ' L ' + x0 + ' ' + y0 + ' A ' + ring + ' ' + ring + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' Z" fill="' + (i2 < filled ? color : '#fff') + '" stroke="#111" stroke-width="2"/>';
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + s + '</svg>';
  }
  function renderClocks(panel) {
    if (!panel) return;
    if (sess.role !== 'gm') {   // players: read-only, public clocks only
      panel.innerHTML = rtHead('◴', 'Clocks', 'Live tension trackers', '') + '<div id="clk-p">Loading…</div>';
      api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) {
        var cls = (((d.meta || {}).prep || {}).clocks || []).filter(function (k) { return k.public; });
        el('clk-p').innerHTML = cls.length ? cls.map(function (k) {
          return '<div class="rt-panel" style="margin-bottom:12px"><div class="rt-panel-head">' + esc(k.label || 'Clock') + '<span class="rt-panel-act" style="font-family:var(--mono);font-size:12px">' + (k.value || 0) + ' / ' + (k.max || 6) + '</span></div>' +
            '<div class="rt-panel-body" style="display:flex;justify-content:center">' + clockViz(k.style || 'pie', k.value || 0, k.max || 6, k.color || CLOCK_COLORS[0], 96) + '</div></div>';
        }).join('') : '<div class="app-empty">No public clocks right now.</div>';
      }).catch(function () {});
      return;
    }
    ensureCdData(function () {
      var cls = prep().clocks;
      var cards = cls.length ? cls.map(function (k) {
        var v = k.value || 0, m = k.max || 6, col = k.color || CLOCK_COLORS[0], stl = k.style || 'pie';
        var styleOpts = CLOCK_VIZ.map(function (sv) { return '<option value="' + sv + '"' + (sv === stl ? ' selected' : '') + '>' + sv + '</option>'; }).join('');
        var colorBtns = CLOCK_COLORS.map(function (c) { return '<button class="ev-color' + (c === col ? ' active' : '') + '" data-ccol="' + k.id + '|' + c + '" style="background:' + c + '"></button>'; }).join('');
        return '<div class="rt-panel" data-clk="' + k.id + '" style="margin-bottom:12px"><div class="rt-panel-head">' + esc(k.label || 'Clock') +
          '<span class="rt-panel-act"><span style="font-family:var(--mono);font-size:12px;margin-right:4px">' + v + ' / ' + m + '</span>' +
          '<button class="rt-btn" data-cdec="' + k.id + '">−</button><button class="rt-btn rt-btn--green" data-cinc="' + k.id + '">+</button>' +
          '<button class="rt-btn" data-crst="' + k.id + '">Reset</button>' +
          '<button class="rt-btn' + (k.public ? ' rt-btn--gold' : '') + '" data-cpub="' + k.id + '" title="Visible to players">' + (k.public ? '◉ Public' : '◌ Public') + '</button>' +
          '<button class="rt-btn rt-btn--gold" data-ccast="' + k.id + '">Cast</button>' +
          '<button class="rt-link" data-cdel="' + k.id + '">✕</button></span></div>' +
          '<div class="rt-panel-body" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
            '<div style="min-width:84px;display:flex;justify-content:center">' + clockViz(stl, v, m, col, 80) + '</div>' +
            '<div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px">' +
              '<input class="rt-input" data-clabel="' + k.id + '" value="' + esc(k.label || '') + '" placeholder="Clock label">' +
              '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
                '<label class="rt-field-l" style="margin:0">Style</label><select class="rt-select" style="max-width:120px" data-cstyle="' + k.id + '">' + styleOpts + '</select>' +
                '<label class="rt-field-l" style="margin:0 0 0 8px">Max</label><input class="rt-input" type="number" min="1" max="24" style="width:72px" data-cmax="' + k.id + '" value="' + m + '">' +
                '<span style="display:inline-flex;gap:4px;margin-left:8px">' + colorBtns + '</span>' +
              '</div>' +
            '</div></div></div>';
      }).join('') : '<div class="app-empty">No clocks yet. Add one to track tension or progress.</div>';
      panel.innerHTML = rtHead('◴', 'Clocks', 'Tension & progress trackers', '<button class="rt-btn rt-btn--green" id="clk-add">+ Clock</button>') + cards;
      el('clk-add').onclick = function () { cls.push({ id: uid('clk'), label: 'New clock', max: 6, value: 0, color: CLOCK_COLORS[cls.length % 4], style: 'pie' }); savePrep(function () { renderClocks(panel); }); };
      function up() { savePrep(function () { renderClocks(panel); }); }
      function quiet() { savePrep(function () {}); }
      panel.querySelectorAll('[data-cinc]').forEach(function (b) { b.onclick = function () { var k = item(cls, b.getAttribute('data-cinc')); k.value = Math.min((k.value || 0) + 1, k.max || 6); up(); }; });
      panel.querySelectorAll('[data-cdec]').forEach(function (b) { b.onclick = function () { var k = item(cls, b.getAttribute('data-cdec')); k.value = Math.max((k.value || 0) - 1, 0); up(); }; });
      panel.querySelectorAll('[data-crst]').forEach(function (b) { b.onclick = function () { item(cls, b.getAttribute('data-crst')).value = 0; up(); }; });
      panel.querySelectorAll('[data-cdel]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-cdel'); cdData.meta.prep.clocks = cls.filter(function (x) { return x.id !== id; }); up(); }; });
      panel.querySelectorAll('[data-clabel]').forEach(function (e) { e.onchange = function () { item(cls, e.getAttribute('data-clabel')).label = e.value; quiet(); }; });
      panel.querySelectorAll('[data-cstyle]').forEach(function (e) { e.onchange = function () { item(cls, e.getAttribute('data-cstyle')).style = e.value; up(); }; });
      panel.querySelectorAll('[data-cmax]').forEach(function (e) { e.onchange = function () { var k = item(cls, e.getAttribute('data-cmax')); k.max = clampN(parseInt(e.value, 10) || 6, 1, 24); if (k.value > k.max) k.value = k.max; up(); }; });
      panel.querySelectorAll('[data-ccol]').forEach(function (b) { b.onclick = function () { var p = b.getAttribute('data-ccol').split('|'); item(cls, p[0]).color = p[1]; up(); }; });
      panel.querySelectorAll('[data-cpub]').forEach(function (b) { b.onclick = function () { var k = item(cls, b.getAttribute('data-cpub')); k.public = !k.public; up(); }; });
      panel.querySelectorAll('[data-ccast]').forEach(function (b) { b.onclick = function () { var k = item(cls, b.getAttribute('data-ccast')); castReveal({ kind: 'event', title: k.label || 'Clock', blocks: [{ type: 'text', mode: 'panel', size: 'xl', text: (k.label || 'CLOCK').toUpperCase() + '\n\n' + (k.value || 0) + ' / ' + (k.max || 6) }] }); }; });
    });
  }

  /* ── Studio org generator (used by the ORG tab) ── */
  function renderStudioOrg(body) {
    var G = window.OrgGen; if (!G) { studioCard(body, 'Organisation', 'Org generator not loaded.', [['Open Organisations editor', function () { studioNewDoc('orgs', 'organisations.html'); }]]); return; }
    var kindOpts = G.list().map(function (k) { return '<option value="' + k.id + '">' + esc(k.label) + '</option>'; }).join('');
    var scaleOpts = Object.keys(G.SCALE).map(function (s) { return '<option value="' + s + '"' + (s === 'local' ? ' selected' : '') + '>' + esc(G.SCALE[s].label) + '</option>'; }).join('');
    body.innerHTML = '<div class="rt-two">' +
      '<div class="rt-panel"><div class="rt-panel-head">Settings</div><div class="rt-panel-body">' +
        '<label class="rt-field"><span class="rt-field-l">Kind</span><select class="rt-select" id="og-kind">' + kindOpts + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Scale</span><select class="rt-select" id="og-scale">' + scaleOpts + '</select></label>' +
        '<button class="rt-btn rt-btn--green rt-btn--block" id="og-roll">Generate</button>' +
        '<button class="rt-btn rt-btn--block" id="og-edit" style="margin-top:8px">Open full editor</button>' +
      '</div></div><div id="og-out"></div></div>';
    el('og-edit').onclick = function () { studioNewDoc('orgs', 'organisations.html'); };
    el('og-roll').onclick = function () {
      loadCombatDBs().then(function (DBs) {
        var org = G.generate({ kind: el('og-kind').value, scale: el('og-scale').value }, DBs);
        sess.genOrg = org;
        var leaders = ((org.hierarchy && org.hierarchy.nodes) || []).map(function (n) {
          return '<div class="rt-rowline"><span>' + esc(n.label || '—') + '</span><span style="color:var(--text2)">' + esc(n.title || '') + '</span></div>';
        }).join('');
        el('og-out').innerHTML = '<div class="rt-panel"><div class="rt-panel-head">' + esc(org.name || 'Organisation') +
          '<span class="rt-panel-act"><span class="rt-badge rt-badge--gold">' + esc(org.scale || '') + '</span><button class="rt-btn" id="og-save">Save</button></span></div>' +
          '<div class="rt-panel-body"><div class="rt-head-sub" style="margin:0 0 10px">' + esc((org.type || '') + ' · ' + (org.tagline || '')) + '</div>' +
          '<div class="rt-rowline"><span>HQ</span><span>' + esc(org.headquarters || '—') + '</span></div>' +
          '<div class="rt-rowline"><span>Founded</span><span>' + esc(org.founded || '—') + '</span></div>' +
          '<div class="rt-rowline"><span>Ticker</span><span>' + esc((org.market && org.market.stockSymbol) || '—') + '</span></div>' +
          (org.general && org.general.publicSummary ? '<p style="font-family:var(--mono);font-size:12px;color:var(--text2);margin:10px 0;line-height:1.6">' + esc(org.general.publicSummary) + '</p>' : '') +
          '<div class="rt-field-l" style="margin-top:8px">Leadership</div>' + (leaders || '<div class="app-empty">—</div>') +
          '</div></div>';
        el('og-save').onclick = function () { api('POST', 'campaigns/' + encodeURIComponent(sess.id) + '/orgs', { name: org.name || 'org', json: org }).then(function () { el('og-save').textContent = 'Saved ✓'; }); };
      });
    };
  }
  function studioCard(body, title, sub, actions) {
    body.innerHTML = '<div class="rt-panel" style="max-width:640px"><div class="rt-panel-head">' + esc(title) + '</div>' +
      '<div class="rt-panel-body"><p style="font-family:var(--mono);font-size:13px;color:var(--text2);margin:0 0 14px;line-height:1.6">' + esc(sub) + '</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' + actions.map(function (a, i) { return '<button class="rt-btn' + (i === 0 ? ' rt-btn--green' : '') + '" data-sact="' + i + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>' +
      '<div id="studio-out" style="margin-top:14px"></div></div></div>';
    body.querySelectorAll('[data-sact]').forEach(function (b) { b.onclick = actions[+b.getAttribute('data-sact')][1]; });
  }
  // Open a full HTML tool to create a NEW doc, then persist via the cdoc adapter.
  // Embed a doc editor (cdoc bridge) full-page in the ACTIVE tab; ← Back re-renders the tab.
  function openDocEmbed(type, name, tool) {
    var host = activeHost(); if (!host) return;
    var backTool = activeToolId();
    var url = tool + '?cdoc=1&cid=' + encodeURIComponent(sess.id) + '&ctype=' + type + '&cname=' + encodeURIComponent(name);
    host.className = 'tab-content';
    host.innerHTML = '<div class="cd-embed"><div class="cd-embed-bar"><button class="app-btn" id="se-back">← Back</button><span class="cd-embed-name">' + esc(idOf(name)) + '</span></div><iframe class="cd-embed-frame" id="se-frame" src="' + esc(url) + '"></iframe></div>';
    el('se-back').onclick = function () {
      var fr = el('se-frame'), win = fr && fr.contentWindow, ad = win && win.__cdocAdapter, obj;
      try { obj = ad && ad.serialize(); } catch (e) { obj = null; }
      var done = function () { toolRender(backTool, host); };
      if (obj == null) return done();
      api('PUT', 'campaigns/' + encodeURIComponent(sess.id) + '/' + type + '/' + encodeURIComponent(name), obj).then(done, done);
    };
  }
  function openToolEmbed(url, name) {
    var host = activeHost(); if (!host) return;
    var backTool = activeToolId();
    host.className = 'tab-content';
    host.innerHTML = '<div class="cd-embed"><div class="cd-embed-bar"><button class="app-btn" id="se-back">← Back</button><span class="cd-embed-name">' + esc(name) + '</span></div><iframe class="cd-embed-frame" src="' + esc(url) + '"></iframe></div>';
    el('se-back').onclick = function () { toolRender(backTool, host); };
  }
  function studioNewDoc(type, tool) {
    prompt1('New ' + (type === 'orgs' ? 'organisation' : 'NPC'), 'Name', '', function (name) {
      name = (name || '').trim(); if (!name) return;
      api('POST', 'campaigns/' + encodeURIComponent(sess.id) + '/' + type, { name: name, json: {} }).then(function () { openDocEmbed(type, name, tool); });
    });
  }
  function studioOpenTool(url, name) { openToolEmbed(url, name); }

  /* ── Bestiary — saved campaign NPCs (list + dossier + reveal) ── */
  function renderBestiary(panel) {
    if (!panel) return;
    var gm = sess.role === 'gm';
    var acts = gm ? '<button class="rt-btn" id="be-gen">Generate</button><button class="rt-btn" id="be-out">Outfit</button><button class="rt-btn" id="be-new">+ New NPC</button>' : '';
    panel.innerHTML = rtHead('☺', 'NPC', gm ? 'Bestiary · generators · contacts' : 'Contacts & public NPCs', acts) +
      '<div class="rt-two" style="grid-template-columns:minmax(0,320px) minmax(0,1fr)">' +
        '<div class="rt-panel" style="min-height:calc(100vh - 250px)"><div class="rt-panel-head">Library <span class="rt-panel-act" id="be-count"></span></div>' +
          '<div class="rt-panel-body" style="overflow:auto;max-height:calc(100vh - 300px)"><input class="rt-input" id="be-search" placeholder="name or faction…" style="margin-bottom:10px"><div id="be-list"></div></div></div>' +
        '<div id="be-dossier"><div class="rt-panel"><div class="rt-panel-head">Dossier</div><div class="rt-panel-body"><div class="app-empty">Select an NPC.</div></div></div></div>' +
      '</div>';
    if (gm) {
      el('be-new').onclick = function () {
        prompt1('New NPC', 'Name', '', function (name) {
          name = (name || '').trim(); if (!name) return;
          api('POST', 'campaigns/' + encodeURIComponent(sess.id) + '/npcs', { name: name, json: {} }).then(function () { openDocEmbed('npcs', name, 'npc-sheet.html'); });
        });
      };
      el('be-gen').onclick = function () { archetypeGenModal({ onSave: function (sheets) { saveGeneratedNPCs(sess.id, sheets, function () { renderBestiary(panel); }); } }); };
      el('be-out').onclick = function () { openToolEmbed('outfit-designer.html', 'Outfit Designer'); };
    }
    api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) {
      var npcs = ((d.docs && d.docs.npcs) || []).filter(function (x) { return !/^_/.test(x.name); });
      var pub = (((d.meta || {}).prep || {}).npcPublic) || [];
      var contacts = [];
      if (!gm) {
        npcs = npcs.filter(function (n) { return pub.indexOf(n.name) >= 0; });
        // contacts from the player's own sheet
        var rec = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sess.sheetId);
        contacts = (rec && rec.json && rec.json.contacts) || [];
      }
      var order = (((d.meta || {}).prep || {}).npcOrder) || [];
      if (gm && order.length) npcs.sort(function (a, b) { var ia = order.indexOf(a.name), ib = order.indexOf(b.name); return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib); });
      el('be-count').textContent = npcs.length + (contacts.length ? ' + ' + contacts.length : '');
      function paint(filter) {
        var f = (filter || '').toLowerCase();
        var npcRows = npcs.filter(function (n) { return !f || idOf(n.name).toLowerCase().indexOf(f) >= 0; }).map(function (n) {
          var isPub = pub.indexOf(n.name) >= 0;
          if (gm) return '<div class="be-row" data-name="' + esc(n.name) + '" draggable="true"><span class="be-grab">⠿</span>' +
            '<button class="be-open" data-npc="' + esc(n.name) + '">' + esc(idOf(n.name)) + '</button>' +
            '<button class="rt-link be-act" data-bereveal="' + esc(n.name) + '" title="Cast reveal">⇄</button>' +
            '<button class="rt-link be-act' + (isPub ? ' on' : '') + '" data-bepub="' + esc(n.name) + '" title="Public to players">' + (isPub ? '◉' : '◌') + '</button>' +
            '<button class="rt-link be-act be-del" data-bedel="' + esc(n.name) + '" title="Delete">✕</button></div>';
          return '<button class="file-row" data-npc="' + esc(n.name) + '">' + esc(idOf(n.name)) + '</button>';
        }).join('');
        var contactRows = contacts.filter(function (c) { return !f || (c.name || '').toLowerCase().indexOf(f) >= 0; }).map(function (c, i) {
          return '<button class="file-row" data-contact="' + i + '">' + esc(c.name || 'Contact') + ' <span class="rt-badge rt-badge--grey" style="font-size:8px;padding:1px 4px">CONTACT</span></button>';
        }).join('');
        el('be-list').innerHTML = (npcRows + contactRows) || '<div class="app-empty">No NPC matches.</div>';
        function mark(b) { el('be-list').querySelectorAll('.file-row,.be-open').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); }
        el('be-list').querySelectorAll('[data-npc]').forEach(function (b) { b.onclick = function (e) { if (e.metaKey || e.ctrlKey) { peekNpc(b.getAttribute('data-npc')); return; } mark(b); if (gm) openEntity('npc', b.getAttribute('data-npc'), idOf(b.getAttribute('data-npc'))); else beDossier(b.getAttribute('data-npc')); }; });
        el('be-list').querySelectorAll('[data-contact]').forEach(function (b) { b.onclick = function () { mark(b); beContact(contacts[+b.getAttribute('data-contact')]); }; });
        el('be-list').querySelectorAll('[data-bereveal]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var nm = b.getAttribute('data-bereveal'); fetch('/__api/campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(nm)).then(function (r) { return r.json(); }).then(function (s) { castReveal({ kind: 'event', preset: 'dossier', title: idOf(nm), portrait: (s && s.photo) || '', text: (s && (s.notes || s.role)) || '' }); }); }; });
        el('be-list').querySelectorAll('[data-bepub]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var nm = b.getAttribute('data-bepub'); ensureCdData(function () { var p = prep().npcPublic || (prep().npcPublic = []); var i = p.indexOf(nm); if (i >= 0) p.splice(i, 1); else p.push(nm); savePrep(function () { renderBestiary(panel); }); }); }; });
        el('be-list').querySelectorAll('[data-bedel]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var nm = b.getAttribute('data-bedel'); confirm1('Delete NPC "' + idOf(nm) + '"?', function () { api('DELETE', 'campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(nm)).then(function () { renderBestiary(panel); }); }); }; });
        el('be-list').querySelectorAll('.be-row').forEach(function (r) {
          r.ondragstart = function (e) { e.dataTransfer.setData('text/plain', r.getAttribute('data-name')); };
          r.ondragover = function (e) { e.preventDefault(); };
          r.ondrop = function (e) { e.preventDefault(); reorderNpc(e.dataTransfer.getData('text/plain'), r.getAttribute('data-name'), npcs, panel); };
        });
        if (window.CtxMenu) el('be-list').querySelectorAll('[data-npc]').forEach(function (b) { CtxMenu.attach(b, function () { return bestiaryNpcMenu(b.getAttribute('data-npc'), panel); }); });
      }
      paint('');
      el('be-search').oninput = function () { paint(el('be-search').value); };
    });
  }
  function bestiaryNpcMenu(nm, panel) {
    if (!nm) return null;
    function fetchNpc(then) { fetch('/__api/campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(nm)).then(function (r) { return r.json(); }).then(then).catch(function () {}); }
    if (sess.role === 'gm') {
      var isPub = (prep().npcPublic || []).indexOf(nm) >= 0;
      var items = [
        { label: 'Peek', icon: '⊙', onClick: function () { peekNpc(nm); } },
        { label: 'Open (edit sheet)', icon: '⒝', onClick: function () { openEntity('npc', nm, idOf(nm)); } },
        { label: 'Reveal to players', icon: '⊡', onClick: function () { fetchNpc(function (s) { castReveal({ kind: 'event', preset: 'dossier', title: idOf(nm), portrait: (s && s.photo) || '', text: (s && (s.notes || s.role)) || '' }); }); } },
        { label: 'Add to combat', icon: '◎', onClick: function () { fetchNpc(function (s) { if (s) addToCombat(s); }); } },
        { label: isPub ? 'Make private' : 'Make public', icon: isPub ? '◉' : '◌', onClick: function () { ensureCdData(function () { var p = prep().npcPublic || (prep().npcPublic = []); var i = p.indexOf(nm); if (i >= 0) p.splice(i, 1); else p.push(nm); savePrep(function () { renderBestiary(panel); }); }); } }
      ];
      if (shopsLinkedTo('npc', idOf(nm))[0]) items.push({ label: 'Open linked shop', icon: '▣', onClick: function () { openShopFor('npc', idOf(nm)); } });
      items.push({ sep: true });
      items.push({ label: 'Delete NPC', icon: '✕', danger: true, onClick: function () { confirm1('Delete NPC "' + idOf(nm) + '"?', function () { api('DELETE', 'campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(nm)).then(function () { renderBestiary(panel); }); }); } });
      return items;
    }
    var pitems = [{ label: 'Peek', icon: '⊙', onClick: function () { peekNpc(nm); } }, { label: 'View dossier', icon: '⒝', onClick: function () { beDossier(nm); } }];
    if (shopsLinkedTo('npc', idOf(nm))[0]) pitems.push({ label: 'Open shop', icon: '▣', onClick: function () { openShopFor('npc', idOf(nm)); } });
    return pitems;
  }
  function beDossier(name) {
    var host = el('be-dossier'); if (!host) return;
    host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Dossier</div><div class="rt-panel-body"><div class="app-empty">Loading…</div></div></div>';
    fetch('/__api/campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (s) {
      s = s || {}; var statKeys = ['INT', 'REF', 'TECH', 'COOL', 'BODY', 'MA'];
      var statsHtml = (s.stats ? statKeys.map(function (k) { return '<div class="rt-stat"><div class="rt-stat-l">' + k + '</div><div class="rt-stat-v">' + (s.stats[k] != null ? s.stats[k] : '—') + '</div></div>'; }).join('') : '');
      var gear = [].concat((s.weapons || []).map(function (w) { return esc(w.name || w); }), (s.cyberware || []).map(function (c) { return esc(c.name || c); }));
      var gm = sess.role === 'gm';
      var linkedShop = shopsLinkedTo('npc', idOf(name))[0];
      var acts = gm ? '<button class="rt-btn rt-btn--gold" id="be-pub" title="Visible to players">◌ Public</button><button class="rt-btn rt-btn--red" id="be-reveal">Reveal</button><button class="rt-btn" id="be-edit">Open</button>' : '';
      if (linkedShop) acts += '<button class="rt-btn" id="be-shop" title="This NPC sells">▣ Shop</button>';
      host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Dossier<span class="rt-panel-act">' + acts + '</span></div>' +
        '<div class="rt-panel-body"><div class="rt-head-title" style="font-size:24px">' + esc(idOf(name)) + '</div>' +
        '<div class="rt-head-sub">' + esc((s.role || 'NPC') + (s.sa ? ' · ' + s.sa : '')) + '</div>' +
        (s.notes ? '<p style="font-family:var(--mono);font-size:13px;margin:10px 0;line-height:1.6">' + esc(s.notes) + '</p>' : '') +
        (statsHtml ? '<div class="rt-stats" style="margin:12px 0">' + statsHtml + '</div>' : '') +
        (gear.length ? '<div class="rt-field-l">Gear &amp; chrome</div>' + gear.map(function (g) { return '<div class="rt-rowline"><span>' + g + '</span></div>'; }).join('') : '') +
        '</div></div>';
      var bsh = el('be-shop'); if (bsh) bsh.onclick = function () { openShopFor('npc', idOf(name)); };
      if (gm) {
        el('be-reveal').onclick = function () { castReveal({ kind: 'event', preset: 'dossier', title: idOf(name), portrait: s.photo || '', text: (s.notes || s.role || '') }); };
        el('be-edit').onclick = function () { openDocEmbed('npcs', name, 'npc-sheet.html'); };
        ensureCdData(function () {
          var pub = prep().npcPublic || (prep().npcPublic = []), on = pub.indexOf(name) >= 0;
          var pb = el('be-pub'); if (pb) { pb.textContent = on ? '◉ Public' : '◌ Public'; pb.classList.toggle('rt-btn--gold', on);
            pb.onclick = function () { var i = pub.indexOf(name); if (i >= 0) pub.splice(i, 1); else pub.push(name); savePrep(function () { beDossier(name); }); }; }
        });
      }
    }).catch(function () { host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Dossier</div><div class="rt-panel-body"><div class="app-empty">Could not load.</div></div></div>'; });
  }
  function beContact(c) {
    var host = el('be-dossier'); if (!host || !c) return;
    host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Contact</div><div class="rt-panel-body">' +
      '<div class="rt-head-title" style="font-size:24px">' + esc(c.name || 'Contact') + '</div>' +
      '<div class="rt-head-sub">' + esc([c.type, c.org, c.attitude].filter(Boolean).join(' · ')) + '</div>' +
      (c.relationship ? '<div class="rt-rowline"><span>Relationship</span><span>' + esc(c.relationship) + '</span></div>' : '') +
      (c.description ? '<p style="font-family:var(--mono);font-size:13px;margin:10px 0;line-height:1.6">' + esc(c.description) + '</p>' : '') +
      '</div></div>';
  }
  // Open the REAL NPC sheet editor in the right pane (replaces the read-only dossier).
  function beOpen(name) {
    var host = el('be-dossier'); if (!host) return;
    var url = 'npc-sheet.html?cdoc=1&cid=' + encodeURIComponent(sess.id) + '&ctype=npcs&cname=' + encodeURIComponent(name);
    host.innerHTML = '<div class="rt-panel" style="min-height:calc(100vh - 250px)"><div class="rt-panel-head">' + esc(idOf(name)) +
      '<span class="rt-panel-act"><button class="rt-btn rt-btn--red" id="beo-reveal">Reveal</button><button class="rt-btn rt-btn--green" id="beo-save">Save</button></span></div>' +
      '<div class="rt-panel-body" style="padding:0"><iframe id="beo-frame" src="' + esc(url) + '" style="width:100%;height:calc(100vh - 304px);border:0;display:block"></iframe></div></div>';
    el('beo-save').onclick = function () {
      var fr = el('beo-frame'), win = fr && fr.contentWindow, ad = win && win.__cdocAdapter, obj;
      try { obj = ad && ad.serialize(); } catch (e) { obj = null; }
      if (obj != null) api('PUT', 'campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(name), obj).then(function () { var b = el('beo-save'); if (b) b.textContent = 'Saved ✓'; });
    };
    el('beo-reveal').onclick = function () { fetch('/__api/campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (s) { castReveal({ kind: 'event', preset: 'dossier', title: idOf(name), portrait: (s && s.photo) || '', text: (s && (s.notes || s.role)) || '' }); }); };
  }
  function reorderNpc(from, to, npcs, panel) {
    if (from === to) return;
    ensureCdData(function () {
      var names = npcs.map(function (n) { return n.name; });
      var fi = names.indexOf(from), ti = names.indexOf(to); if (fi < 0 || ti < 0) return;
      var m = names.splice(fi, 1)[0]; names.splice(ti, 0, m);
      cdData.meta.prep.npcOrder = names; savePrep(function () { renderBestiary(panel); });
    });
  }
  function studioOpenDocFrom(secKey, type, name, tool) { openDocEmbed(type, name, tool); }

  /* ── COMBAT section — one full-page setup surface (no tabs, no modal).
     FORCES on the left (party, campaign NPCs, squads, quick mook, generator),
     READY LIST + RULES on the right, one big START COMBAT. ── */
  function renderCombatTab(host) {
    var m = (sess.camp && sess.camp.combatMeta && sess.camp.combatMeta()) || {};
    if (m.active) {
      host.className = 'tab-content cb-page';
      host.innerHTML = '<div class="cb-topbar">COMBAT</div><div class="cb-live"><div class="cb-live-t">COMBAT IS LIVE</div>' +
        '<div class="cb-live-s">Round ' + (m.round || 1) + ' · ' + ((m.order || []).length) + ' combatants</div>' +
        '<button class="cb-start" id="cb-resume">RESUME COMBAT</button>' +
        '<button class="dt-btn" id="cb-end" style="margin-top:10px">End combat</button></div>';
      el('cb-resume').onclick = openCombatStage;
      el('cb-end').onclick = function () { if (sess.camp && sess.camp.setCombatMeta) { sess.camp.setCombatMeta({ active: false }); renderCombatTab(host); } };
      return;
    }
    host.className = 'tab-content cb-page';
    // POOL (main, left) = the encounter being built. SOURCES (right) = the
    // potential combatants you drag in. RULES = a compact strip above START.
    host.innerHTML = '<div class="cb-topbar">COMBAT</div><div class="cb-cols">' +
      '<div class="cb-pool-wrap">' +
        '<div class="cb-h">THE POOL <span id="cb-ready-n"></span><i class="cb-hint">the encounter — drag combatants in</i></div>' +
        '<div class="cb-pool" id="cb-pool"></div>' +
        '<div class="cb-rules-strip">' +
          '<label>MODE <select id="cbs-mode"><option value="hybrid">Hybrid — players act their turns</option><option value="gm">GM — GM resolves everything</option></select></label>' +
          '<label>NPC VIS <select id="cbs-vis"><option value="full">Full</option><option value="status">Status only</option><option value="name">Name only</option></select></label>' +
          '<button class="cb-start" id="cb-start">START COMBAT ▸</button>' +
        '</div>' +
      '</div>' +
      '<div class="cb-forces" id="cb-forces"><div class="app-empty">Loading…</div></div>' +
    '</div>';

    var ready = (sess.pendingCombat || []).slice(); sess.pendingCombat = [];
    var inPool = {};   // one pool entry per PC sheet
    var sqP = window.Store ? Store.index('squad').then(function (rows) { return rows.map(function (r) { return r.json; }); }).catch(function () { return []; }) : Promise.resolve([]);
    // NPCs through the Store: display the record's NAME, not its filename.
    var npcP = window.Store ? Store.index('npc').then(function (rows) {
      return rows.map(function (r) { return { name: r.file, label: Store.displayName(r) }; });
    }).catch(function () { return []; }) : Promise.resolve([]);
    Promise.all([api('GET', 'campaigns/' + encodeURIComponent(sess.id)), sqP, npcP]).then(function (res2) {
      var d = res2[0], squadDocs = res2[1], npcDocs = res2[2];
      var F = el('cb-forces'); if (!F) return;
      F.innerHTML =
        '<div class="cb-h">PARTY <i class="cb-hint">drag into the pool</i></div>' +
        (sess.order.map(function (sid) {
          return '<div class="cb-row" draggable="true" data-drag-pc="' + esc(sid) + '"><span class="cb-grip">⠿</span><span>' + esc(sheetLabel(sid)) + '</span><i>PC</i></div>';
        }).join('') || '<div class="cb-dim">No sheets hosted.</div>') +
        '<div class="cb-h">CAMPAIGN NPCS</div>' +
        (npcDocs.map(function (doc) {
          var nm = doc.name;
          return '<div class="cb-row" draggable="true" data-drag-npc="' + esc(nm) + '" data-label="' + esc(doc.label) + '"><span class="cb-grip">⠿</span><span>' + esc(doc.label) + '</span>' +
            '<i>×</i><input type="number" class="cb-count" data-count="' + esc(nm) + '" value="1" min="1" max="20"></div>';
        }).join('') || '<div class="cb-dim">No NPCs yet — DATA holds the bestiary.</div>') +
        (squadDocs.length ? '<div class="cb-h">SQUADS</div>' + squadDocs.map(function (sq, i) {
          return '<div class="cb-row" draggable="true" data-drag-sq="' + i + '"><span class="cb-grip">⠿</span><span>' + esc(sq.name || 'Squad') + '</span><i>' + ((sq.members || []).length) + '</i></div>';
        }).join('') : '') +
        '<div class="cb-h">GENERATE</div>' +
        '<div class="cb-genrow"><button class="dt-btn" id="cbs-gen1">＋ COMBATANT</button><button class="dt-btn" id="cbs-gengang">＋ GANG</button></div>';

      function paintReady() {
        var R = el('cb-pool'), n = el('cb-ready-n'); if (!R) return;
        if (n) n.textContent = ready.length ? '· ' + ready.length : '';
        R.innerHTML = ready.map(function (c, i) {
          return '<div class="cb-chip' + (c.kind === 'pc' ? ' cb-chip-pc' : '') + '">' + esc(c.name || 'NPC') +
            (c.kind === 'pc' ? '<i>PC</i>' : '') + '<b data-rm="' + i + '" title="Remove">×</b></div>';
        }).join('') || '<div class="cb-pool-empty">DRAG COMBATANTS HERE<br><span>party · NPCs · squads · mooks · generated</span></div>';
        R.classList.toggle('filled', !!ready.length);
        R.querySelectorAll('[data-rm]').forEach(function (b) {
          b.onclick = function () { var gone = ready.splice(+b.getAttribute('data-rm'), 1)[0]; if (gone && gone.kind === 'pc') delete inPool[gone.sheetId]; paintReady(); };
        });
      }
      paintReady();

      function poolPc(sid) {
        var E = window.CombatEngine; if (!E || inPool[sid]) return;
        var rec = sess.camp.getSheet(sid);
        var c = E.makeCombatant({ id: 'pc-' + sid, kind: 'pc', sheetId: sid, name: sheetLabel(sid), sheet: (rec && rec.json) || {} });
        var pst = rec && rec.json && rec.json.combat;
        if (pst) { c.wounds = pst.wounds || 0; if (pst.armorDmg) c.armorDmg = Object.assign(c.armorDmg, pst.armorDmg); if (pst.status) c.status = Object.assign(c.status, pst.status); }
        inPool[sid] = 1; ready.push(c); paintReady();
      }
      function poolNpc(nm, cnt, label) {
        var E = window.CombatEngine; if (!E) return;
        fetch('/__api/campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(nm))
          .then(function (r) { return r.json(); }).catch(function () { return {}; })
          .then(function (sheet) {
            var base = label || (sheet && (sheet.name || sheet.handle)) || idOf(nm);
            for (var i = 0; i < cnt; i++) ready.push(E.makeCombatant({ id: 'npc-' + idOf(nm) + '-' + Date.now().toString(36) + i, kind: 'npc', name: cnt > 1 ? base + ' ' + (i + 1) : base, sheet: sheet }));
            paintReady();
          });
      }
      function poolSquad(enc) {
        if (!enc) return;
        if (enc.settings) { el('cbs-mode').value = enc.settings.mode || 'hybrid'; el('cbs-vis').value = enc.settings.npcVis || 'full'; }
        window.CombatEngine && loadCombatDBs().then(function (DBs) {
          (enc.members || []).forEach(function (mm) {
            if (mm.kind === 'pc-all') { sess.order.forEach(poolPc); }
            else if (mm.kind === 'npcfile') { poolNpc(mm.name, mm.count || 1); }
            else if (mm.kind === 'archetype' && window.NPCGen) { for (var i = 0; i < (mm.count || 1); i++) { var s = window.NPCGen.generate(mm.params, DBs); ready.push(window.CombatEngine.makeCombatant({ id: 'enc-' + Date.now().toString(36) + '-' + ready.length, kind: 'npc', name: s.role, sheet: s })); } paintReady(); }
            else if (mm.kind === 'mook') { for (var jj = 0; jj < (mm.count || 1); jj++) ready.push(window.CombatEngine.makeCombatant({ id: 'enc-' + Date.now().toString(36) + '-' + ready.length, kind: 'npc', name: (mm.sheet && mm.sheet.role) || 'Mook', sheet: mm.sheet || {} })); paintReady(); }
          });
        });
      }

      /* drag wiring: sources → pool */
      F.querySelectorAll('[data-drag-pc]').forEach(function (r) {
        r.ondragstart = function (e) { e.dataTransfer.setData('text/plain', JSON.stringify({ pc: r.getAttribute('data-drag-pc') })); };
        r.ondblclick = function () { poolPc(r.getAttribute('data-drag-pc')); };
      });
      F.querySelectorAll('[data-drag-npc]').forEach(function (r) {
        r.ondragstart = function (e) {
          var nm = r.getAttribute('data-drag-npc');
          var cntEl = r.querySelector('.cb-count');
          e.dataTransfer.setData('text/plain', JSON.stringify({ npc: nm, count: parseInt(cntEl && cntEl.value, 10) || 1, label: r.getAttribute('data-label') || '' }));
        };
        r.ondblclick = function () { var cntEl = r.querySelector('.cb-count'); poolNpc(r.getAttribute('data-drag-npc'), parseInt(cntEl && cntEl.value, 10) || 1, r.getAttribute('data-label') || ''); };
      });
      F.querySelectorAll('[data-drag-sq]').forEach(function (r) {
        r.ondragstart = function (e) { e.dataTransfer.setData('text/plain', JSON.stringify({ squad: +r.getAttribute('data-drag-sq') })); };
        r.ondblclick = function () { poolSquad(squadDocs[+r.getAttribute('data-drag-sq')]); };
      });
      var pool = el('cb-pool');
      pool.ondragover = function (e) { e.preventDefault(); pool.classList.add('over'); };
      pool.ondragleave = function () { pool.classList.remove('over'); };
      pool.ondrop = function (e) {
        e.preventDefault(); pool.classList.remove('over');
        var d2; try { d2 = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
        if (!d2) return;
        if (d2.pc) poolPc(d2.pc);
        else if (d2.npc) poolNpc(d2.npc, d2.count || 1, d2.label || '');
        else if (d2.squad != null) poolSquad(squadDocs[d2.squad]);
      };

      function genToPool(sheets) { sheets.forEach(function (s, i) { ready.push(window.CombatEngine.makeCombatant({ id: 'gen-' + Date.now().toString(36) + '-' + ready.length + '-' + i, kind: 'npc', name: s.role, sheet: s })); }); paintReady(); }
      el('cbs-gen1').onclick = function () { archetypeGenModal({ scope: 'one', onCombat: genToPool, onSave: function (sh) { saveGeneratedNPCs(sess.id, sh); genToPool(sh); } }); };
      el('cbs-gengang').onclick = function () { archetypeGenModal({ scope: 'team', onCombat: genToPool, onSave: function (sh) { saveGeneratedNPCs(sess.id, sh); genToPool(sh); } }); };
      // START = pool only — the pool IS the encounter.
      el('cb-start').onclick = function () {
        var E = window.CombatEngine; if (!E || !ready.length) return;
        var settings = { mode: el('cbs-mode').value, npcVis: el('cbs-vis').value };
        var list = ready.slice();
        sess.camp.clearCombat();
        list.forEach(function (c) { c.init = E.rollInitiative(c.ref, c.initBonus).total; sess.camp.putCombatant(c.id, c); });
        list.sort(function (a, b) { return (b.init || 0) - (a.init || 0); });
        sess.camp.setCombatMeta({ active: true, round: 1, turnIdx: 0, order: list.map(function (c) { return c.id; }), settings: settings, startedAt: Date.now() });
        sess.camp.logCombat({ msg: '◆ Combat begins — initiative: ' + list.map(function (c) { return c.name + ' ' + c.init; }).join(', ') });
        logSession('◆ Combat started — ' + list.length + ' combatant' + (list.length === 1 ? '' : 's') + '.');
        openCombatStage();
      };
    });
  }

  /* ── ORG tab = saved orgs + generator + custom org ── */
  function renderOrgTab(host) {
    host.innerHTML = rtHead('⌗', 'Organisations', 'Saved orgs · generator · custom', '<button class="rt-btn" id="org-new">+ New org</button>') +
      '<div id="org-saved"></div><div id="org-gen" style="margin-top:14px"></div>';
    el('org-new').onclick = function () { studioNewDoc('orgs', 'organisations.html'); };
    api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) {
      var orgs = ((d.docs && d.docs.orgs) || []).filter(function (x) { return !/^_/.test(x.name); });
      var host2 = el('org-saved'); if (!host2) return;
      host2.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">Saved organisations</div><div class="rt-panel-body">' +
        (orgs.length ? orgs.map(function (n) { var hasShop = shopsLinkedTo('org', idOf(n.name))[0]; return '<div class="rt-rowline"><span>' + esc(idOf(n.name)) + '</span><span>' + (hasShop ? '<button class="rt-link" data-orgshop="' + esc(idOf(n.name)) + '">▣ shop</button> ' : '') + '<button class="rt-link" data-orgopen="' + esc(n.name) + '">open</button></span></div>'; }).join('') : '<div class="app-empty">No saved orgs yet — generate one below.</div>') + '</div></div>';
      host2.querySelectorAll('[data-orgopen]').forEach(function (b) { b.onclick = function () { openDocEmbed('orgs', b.getAttribute('data-orgopen'), 'organisations.html'); }; });
      host2.querySelectorAll('[data-orgshop]').forEach(function (b) { b.onclick = function () { openShopFor('org', b.getAttribute('data-orgshop')); }; });
    });
    if (sess.role === 'gm') renderStudioOrg(el('org-gen')); else { var g = el('org-gen'); if (g) g.innerHTML = ''; }
  }

  /* ── Database — gear / weapons / corporations reference ── */
  var DB_CACHE = null;
  var DB_DEFS = [
    ['weapons', 'Weapons', 'data/cp2020weapons.json'], ['cyberware', 'Cyberware', 'data/cyberware.json'],
    ['gear', 'Gear', 'data/cp2020gear.json'], ['vehicles', 'Vehicles', 'data/cp2020-vehicles.json'],
    ['decks', 'Cyberdecks', 'data/cp2020decks.json'], ['programs', 'Programs', 'data/cp2020programs.json'],
    ['skills', 'Skills', 'data/cp2020skills.json'], ['roles', 'Roles', 'data/cp2020rolesext.json'],
    ['corps', 'Corporations', 'data/corporations.json'],
  ];
  var DB_IDS = DB_DEFS.map(function (d) { return d[0]; });
  // All scalar columns present in the data (so nothing — ROF, conc, avail… — is dropped).
  function dbCols(rows) {
    var cols = [], seen = {};
    rows.slice(0, 60).forEach(function (r) { Object.keys(r || {}).forEach(function (k) { if (k === '_custom' || k === 'id' || k === 'cat' || seen[k]) return; var v = r[k]; if (v && typeof v === 'object') return; seen[k] = 1; cols.push(k); }); });
    if (!cols.length) cols = ['name'];
    var ni = cols.indexOf('name'); if (ni > 0) { cols.splice(ni, 1); cols.unshift('name'); }
    return cols;
  }
  // Sort DB rows by a column (numeric where both values parse as numbers; blanks sort last).
  function dbSortRows(arr) {
    var st = sess.dbSort; if (!st || !st.col) return arr;
    var col = st.col, dir = st.dir === 'desc' ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      var av = a[col], bv = b[col];
      var ae = av == null || av === '', be = bv == null || bv === '';
      if (ae && be) return 0; if (ae) return 1; if (be) return -1;   // blanks always last
      var an = parseFloat(av), bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn) && /^[\s$€eb\d.,\-+]+$/i.test(String(av)) && /^[\s$€eb\d.,\-+]+$/i.test(String(bv))) return (an - bn) * dir;
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }
  function renderDatabase(panel) {
    if (!panel) return;
    var tab = sess.dbTab || 'weapons';
    var refTab = DB_IDS.indexOf(tab) >= 0;
    var tabs = DB_DEFS.map(function (t) { return [t[0], t[1]]; }).concat([['npcs', 'NPCs'], ['orgs', 'Orgs']]);
    ensureCdData(function () {
      var custom = (prep().customDb || (prep().customDb = []));
      panel.innerHTML = rtHead('▤', 'Database', 'Reference + your saved & custom records',
        (refTab ? '<button class="rt-btn rt-btn--green" id="db-add">+ Custom</button>' : '')) +
        '<div class="rt-tabs">' + tabs.map(function (t) { return '<button class="rt-tab' + (t[0] === tab ? ' active' : '') + '" data-dbtab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">' +
          '<input class="rt-input" id="db-search" placeholder="search…" style="max-width:360px">' +
          (refTab ? '<label class="rt-switch"><input type="checkbox" id="db-custom"' + (sess.dbCustomOnly ? ' checked' : '') + '><span class="rt-switch-track"></span> Custom only</label>' : '') +
        '</div><div id="db-out"><div class="app-empty">Loading…</div></div>';
      panel.querySelectorAll('[data-dbtab]').forEach(function (b) { b.onclick = function () { sess.dbTab = b.getAttribute('data-dbtab'); renderDatabase(panel); }; });
      var addb = el('db-add'); if (addb) addb.onclick = function () { dbCustomForm(tab, panel); };
      var cb = el('db-custom'); if (cb) cb.onchange = function () { sess.dbCustomOnly = cb.checked; paintDb(); };
      var se = el('db-search'); if (se) se.oninput = paintDb;

      if (!refTab) { paintDocs(); return; }
      if (!DB_CACHE) {
        DB_CACHE = {};
        Promise.all(DB_DEFS.map(function (d) { return fetch(d[2]).then(function (r) { return r.json(); }).then(function (j) { DB_CACHE[d[0]] = Array.isArray(j) ? j : (j.items || j.roles || []); }).catch(function () { DB_CACHE[d[0]] = []; }); })).then(paintDb);
      } else paintDb();

      function paintDb() {
        var f = (el('db-search') && el('db-search').value || '').toLowerCase();
        var base = sess.dbCustomOnly ? [] : (DB_CACHE[tab] || []);
        var mine = custom.filter(function (c) { return c.cat === tab; });
        var cols = dbCols((DB_CACHE[tab] || []).concat(mine));
        var rows = dbSortRows(mine.concat(base).filter(function (r) { return !f || JSON.stringify(r).toLowerCase().indexOf(f) >= 0; })).slice(0, 600);
        var out = el('db-out'); if (!out) return;
        out.innerHTML = rows.length ? '<div class="rt-panel" style="min-height:calc(100vh - 250px)"><div style="overflow:auto;max-height:calc(100vh - 254px)"><table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12px">' +
          '<thead><tr>' + cols.map(function (c) { var st = sess.dbSort || {}; var ar = st.col === c ? (st.dir === 'desc' ? ' ▼' : ' ▲') : ''; return '<th data-dbsort="' + esc(c) + '" style="text-align:left;padding:7px 10px;background:var(--ink);color:#fff;font-family:var(--head);letter-spacing:1px;text-transform:uppercase;font-size:11px;position:sticky;top:0;cursor:pointer;user-select:none">' + c + ar + '</th>'; }).join('') + '<th style="background:var(--ink)"></th></tr></thead><tbody>' +
          rows.map(function (r, i) { return '<tr data-rowidx="' + i + '" style="border-bottom:1px solid #eee;cursor:context-menu' + (r._custom ? ';background:var(--acc-soft)' : '') + '">' + cols.map(function (c) { return '<td style="padding:6px 10px">' + esc(r[c] != null ? r[c] : '') + '</td>'; }).join('') + '<td style="padding:6px 10px;text-align:right">' + (r._custom ? '<span class="rt-badge rt-badge--gold" style="font-size:9px;padding:1px 5px">CUSTOM</span> <button class="rt-link" data-dbdel="' + r.id + '" style="padding:0 4px">✕</button>' : '') + '</td></tr>'; }).join('') +
          '</tbody></table></div></div>' : '<div class="app-empty">No records match your query.</div>';
        out.querySelectorAll('[data-dbdel]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-dbdel'); cdData.meta.prep.customDb = custom.filter(function (x) { return x.id !== id; }); savePrep(function () { renderDatabase(panel); }); }; });
        out.querySelectorAll('[data-dbsort]').forEach(function (th) { th.onclick = function () { var c = th.getAttribute('data-dbsort'); var st = sess.dbSort || {}; sess.dbSort = (st.col === c) ? { col: c, dir: st.dir === 'asc' ? 'desc' : 'asc' } : { col: c, dir: 'asc' }; paintDb(); }; });
        if (window.CtxMenu) out.querySelectorAll('tr[data-rowidx]').forEach(function (tr) { CtxMenu.attach(tr, function () { return dbRowMenu(rows[+tr.getAttribute('data-rowidx')], tab, panel); }); });
      }
      function paintDocs() {
        var out = el('db-out'); if (out) out.innerHTML = '<div class="app-empty">Loading…</div>';
        // Always fetch fresh so created/deleted/edited NPCs & orgs show immediately.
        api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) {
          var list = ((d.docs && d.docs[tab]) || []).filter(function (x) { return !/^_/.test(x.name); });
          var f = (el('db-search') && el('db-search').value || '').toLowerCase();
          var hits = list.filter(function (n) { return !f || idOf(n.name).toLowerCase().indexOf(f) >= 0; });
          out = el('db-out'); if (!out) return;
          out.innerHTML = hits.length ? '<div class="rt-panel" style="min-height:calc(100vh - 250px)"><div class="rt-panel-body" style="overflow:auto;max-height:calc(100vh - 254px)">' + hits.map(function (n) {
            return '<div class="rt-rowline"><span>' + esc(idOf(n.name)) + '</span><span><button class="rt-link" data-dbopen="' + esc(n.name) + '">open</button></span></div>';
          }).join('') + '</div></div>' : '<div class="app-empty">No saved ' + tab + ' yet.</div>';
          out.querySelectorAll('[data-dbopen]').forEach(function (b) { b.onclick = function () { openDocEmbed(tab, b.getAttribute('data-dbopen'), tab === 'orgs' ? 'organisations.html' : 'npc-sheet.html'); }; });
        });
      }
    });
  }
  /* ── Database right-click actions ── */
  function dbLootCat(cat) { return cat === 'weapons' ? 'weapon' : cat === 'cyberware' ? 'cyberware' : cat === 'vehicles' ? 'vehicle' : 'gear'; }
  function dbCastText(r) {
    var keys = Object.keys(r || {}).filter(function (k) { return k !== 'name' && k !== 'id' && k !== 'cat' && k !== '_custom' && k !== 'source' && r[k] != null && r[k] !== '' && typeof r[k] !== 'object'; }).slice(0, 8);
    return (r.name || '') + (keys.length ? '\n\n' + keys.map(function (k) { return k.toUpperCase() + ': ' + r[k]; }).join('\n') : '');
  }
  function dbAddToLoot(cat, r) {
    ensureCdData(function () { (prep().loot || (prep().loot = [])).push({ id: uid('loot'), name: r.name || 'Item', nodes: [{ id: uid('ln'), type: 'item', cat: dbLootCat(cat), name: r.name, data: r, share: 'shared' }] }); savePrep(function () {}); });
  }
  function dbAddToMySheet(cat, r) {
    if (sess.role !== 'player' || !sess.sheetId) { alert('No character sheet linked.'); return; }
    var sid = idOf(sess.sheetId), rec = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid);
    if (!rec || !rec.json) { alert('Your sheet isn’t loaded yet.'); return; }
    if (r && r.category === 'COMPUTER' && r.connection) {   // a net-capable computer → the device locker, not the gear list
      var j = rec.json; j.net = j.net || {}; j.net.owned = j.net.owned || [];
      var dev = JSON.parse(JSON.stringify(r)); dev.id = uid('dev'); delete dev.category;
      j.net.owned.push(dev); if (!j.net.computer) { j.net.computer = dev; j.net.activeDeviceId = dev.id; }
    } else shopWriteItem(rec.json, { cat: cat, name: r.name, data: r });
    sess.camp.publishSheet(sid, rec.json.handle || rec.json.name || sid, rec.json);
  }
  function dbRowMenu(r, cat, panel) {
    if (!r) return null;
    var itemCat = ['weapons', 'cyberware', 'gear', 'vehicles', 'decks', 'programs'].indexOf(cat) >= 0;
    var items = [
      { label: 'Copy name', icon: '⧉', onClick: function () { try { navigator.clipboard.writeText(r.name || ''); } catch (e) {} } },
      { label: 'Cast to players', icon: '⊡', onClick: function () { castReveal({ kind: 'event', title: r.name || 'Reference', blocks: [{ type: 'text', mode: 'panel', size: 'l', text: dbCastText(r) }] }); } }
    ];
    if (sess.role === 'gm' && itemCat) {
      var shops = allShopsGM().filter(function (s) { return !s._virtual; });
      items.push({ sep: true });
      items.push({ label: 'Add to a shop', icon: '▣', submenu: shops.length ? shops.map(function (s) { return { label: s.name || 'Shop', onClick: function () { shopAddFromPalette(s, cat, r.name); } }; }) : [{ label: 'No shops yet — create one', disabled: true }] });
      items.push({ label: 'Add to loot', icon: '❖', onClick: function () { dbAddToLoot(cat, r); } });
    } else if (sess.role === 'player' && itemCat && sess.sheetId) {
      items.push({ sep: true });
      items.push({ label: 'Add to my sheet', icon: '＋', onClick: function () { dbAddToMySheet(cat, r); } });
    }
    if (r._custom) { items.push({ sep: true }); items.push({ label: 'Delete custom entry', icon: '✕', danger: true, onClick: function () { ensureCdData(function () { prep().customDb = (prep().customDb || []).filter(function (x) { return x.id !== r.id; }); savePrep(function () { renderDatabase(panel); }); }); } }); }
    return items;
  }
  // Custom DB entry — complete form via the shared UI.modal.
  function dbCustomForm(cat, panel) {
    var cols = ((DB_CACHE && DB_CACHE[cat]) ? dbCols(DB_CACHE[cat]) : ['name', 'type', 'cost']).filter(function (c) { return c !== 'source'; });
    var body = cols.map(function (c) { return '<label class="rt-field"><span class="rt-field-l">' + c + '</span><input class="rt-input" data-cf="' + c + '"></label>'; }).join('') +
      '<label class="rt-field"><span class="rt-field-l">notes</span><textarea class="rt-input" data-cf="notes" rows="2"></textarea></label>';
    if (!window.UI) { alert('UI not loaded.'); return; }
    window.UI.modal({
      title: 'Custom ' + cat + ' entry', body: body,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: function (box) {
        var rec = { id: uid('cdb'), cat: cat, _custom: true };
        box.querySelectorAll('[data-cf]').forEach(function (i) { rec[i.getAttribute('data-cf')] = i.value; });
        if (!rec.name) { return false; }
        ensureCdData(function () { (prep().customDb || (prep().customDb = [])).push(rec); savePrep(function () { renderDatabase(panel); }); });
      } }]
    });
  }
  /* ── Shop — GM curates Database items into storefronts; players buy → item lands
     on their sheet + an unpaid line in the buy tray (no auto-deduction). Stock is
     shared and decrements on purchase. Shops link to a location / NPC / org / URL,
     a first step toward interconnecting the world. (meta.prep.shops) ── */
  var SHOP_CATS = [['weapons', 'Weapons', 500], ['gear', 'Gear', 300], ['cyberware', 'Cyberware', 600], ['vehicles', 'Vehicles', 12000], ['decks', 'Cyberdecks', 4000], ['programs', 'Programs', 500]];
  var SHOP_CAT_LABEL = { weapons: 'Weapons', gear: 'Gear', cyberware: 'Cyberware', vehicles: 'Vehicles', decks: 'Cyberdecks', programs: 'Programs' };
  function shopCatToArr(cat) { return cat === 'weapons' ? 'weapons' : cat === 'cyberware' ? 'cyberware' : cat === 'vehicles' ? 'vehicles' : 'gear'; }
  function shopPrice(r) { var v = r == null ? 0 : (r.cost != null ? r.cost : r.bookcost != null ? r.bookcost : r.bookPrice != null ? r.bookPrice : (r.type && r.type.cost != null ? r.type.cost : 0)); return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; }
  // Shops persist as Store('shop') docs — see saveShopDoc / Store.create / Store.del. (Legacy prep().shops is migrated once in app-migrate.js.)
  // Default "online" basic catalog — derived from the DB by availability + cost ceiling. Unlimited stock.
  function onlineCatalog() {
    var out = [];
    SHOP_CATS.forEach(function (pair) {
      var cat = pair[0], ceil = pair[2];
      (DB_CACHE[cat] || []).forEach(function (r) {
        var av = String(r.avail || r.availability || '').trim().toUpperCase();
        var cost = shopPrice(r); var common = !av || av[0] === 'E';
        if (common && cost > 0 && cost <= ceil) out.push({ id: 'on-' + cat + '-' + String(r.name || '').replace(/\W+/g, ''), cat: cat, name: r.name, price: cost, qty: null, data: r });
      });
    });
    return out;
  }
  function defaultOnlineShop() { return { id: '__online', name: 'Night Market (online)', kind: 'online', link: { type: 'url', url: '' }, public: true, _virtual: true, items: onlineCatalog() }; }
  function shopLoadDB(then) {
    if (DB_CACHE) return then();
    DB_CACHE = {};
    Promise.all(DB_DEFS.map(function (d) { return fetch(d[2]).then(function (r) { return r.json(); }).then(function (j) { DB_CACHE[d[0]] = Array.isArray(j) ? j : (j.items || j.roles || []); }).catch(function () { DB_CACHE[d[0]] = []; }); })).then(then);
  }
  /* ── Comparison engine: per-category numeric stats so a product can be ranked
     against the player's owned gear and the rest of the database. ── */
  function shopNum(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; }
  function shopDmgAvg(v) { var m = String(v || '').match(/(\d+)\s*d\s*(\d+)\s*([+\-]\s*\d+)?/i); if (!m) return shopNum(v); var n = +m[1], f = +m[2], b = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0; return n * (f + 1) / 2 + b; }
  var SHOP_STATS = {
    weapons: [['damage', 'DMG', shopDmgAvg, true], ['wa', 'WA', shopNum, true], ['rof', 'ROF', shopNum, true], ['range', 'Range', shopNum, true], ['shots', 'Shots', shopNum, true]],
    cyberware: [['hc', 'Humanity cost', shopNum, false]],
    vehicles: [['topspeed', 'Top speed', shopNum, true], ['sdp', 'SDP', shopNum, true], ['sp', 'SP', shopNum, true], ['accelerate', 'Accel', shopNum, true]],
    decks: [['mu', 'MU', shopNum, true], ['speed', 'Speed', shopNum, true], ['datawall', 'Data wall', shopNum, true]],
    programs: [['str', 'STR', shopNum, true]],
    gear: []
  };
  function shopStatList(cat) { return SHOP_STATS[cat] || []; }
  function shopPlayerJson() { if (!sess.sheetId) return null; var r = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sess.sheetId); return r && r.json; }
  function shopOwnedItems(cat) { var j = shopPlayerJson(); if (!j) return []; var a = j[shopCatToArr(cat)] || []; return a.slice(); }
  // All linkable locations: NC-map public places (synced) + custom maps + lists + prep fallbacks.
  function shopLocations() {
    var ov = ovGet(), out = [], seen = {};
    function add(nm, sub) { nm = (nm || '').trim(); if (!nm || seen[nm.toLowerCase()]) return; seen[nm.toLowerCase()] = 1; out.push({ name: nm, sub: sub || '' }); }
    (ov.locations || []).forEach(function (p) { add(p.name || (p.district ? p.district + ' #' + (p.building || '?') : ''), 'Night City' + (p.district ? ' · ' + p.district : '')); });
    (ov.locMaps || []).forEach(function (m) { (m.gmEntries || m.entries || []).forEach(function (e) { add(e.name || e.building, (m.kind === 'list' ? 'List' : 'Map') + ' · ' + (m.name || '')); }); });
    (prep().locations || []).forEach(function (p) { add(p.name || p.id, 'Prep'); });
    (prep().locbooks || []).forEach(function (b) { (b.places || []).forEach(function (p) { add(p.name || p.id, b.name || 'Prep'); }); });
    return out;
  }
  function renderShop(panel) {
    if (!panel) return;
    panel.classList.add('shop-tab', 'shop-fullbleed');
    // No header strip: the storefront fills the whole frame edge to edge.
    panel.innerHTML = '<div id="shop-body" class="shop-body-full"><div class="app-empty">Loading…</div></div>';
    shopLoadDB(function () {
      // Always fetch fresh so the GM's shops/stock show immediately for players.
      Promise.all([api('GET', 'campaigns/' + encodeURIComponent(sess.id)), refreshShopDocs()]).then(function (res2) {
        cdData = res2[0]; state.campaignId = sess.id;
        var body = el('shop-body'); if (!body) return;
        if (sess.role === 'gm') renderShopGM(body); else renderShopPlayer(body);
      }).catch(function () { var b = el('shop-body'); if (b) b.innerHTML = '<div class="app-empty">Could not load campaign.</div>'; });
    });
  }
  // Shops are docs now — cached rows [{ref, json}] refreshed on each shop render.
  var _shopDocs = [];
  function refreshShopDocs() {
    if (!window.Store) return Promise.resolve([]);
    return Store.index('shop', true).then(function (rows) { _shopDocs = rows; return rows; }).catch(function () { _shopDocs = []; return []; });
  }
  function shopDocRow(id) { return _shopDocs.filter(function (r) { return r.json.id === id; })[0] || null; }
  function saveShopDoc(id, then) {
    var row = shopDocRow(id);
    if (!row || !window.Store) { if (then) then(); return; }
    Store.put(row.ref, row.json).then(then || function () {}, then || function () {});
  }
  function allShopsGM() { return [defaultOnlineShop()].concat(_shopDocs.map(function (r) { return r.json; })); }
  function shopById(id) { if (id === '__online') return defaultOnlineShop(); var r = shopDocRow(id); return r ? r.json : null; }

  /* ════════ GM curation: shop rail + drag-and-drop catalog ════════ */
  function renderShopGM(body) {
    var shops = allShopsGM();
    var sel = sess.shopSel && shopById(sess.shopSel) ? sess.shopSel : (shops[0] && shops[0].id);
    sess.shopSel = sel;
    var railHtml = shops.map(function (s) {
      var n = (s.items || []).length;
      return '<button class="shop-card-rail' + (s.id === sel ? ' active' : '') + '" data-shopsel="' + esc(s.id) + '">' +
        '<span class="shop-card-rail-name">' + esc(s.name || 'Shop') + '</span>' +
        '<span class="shop-card-rail-meta">' + (s._virtual ? '<span class="rt-badge">auto</span>' : (s.public ? '<span class="rt-badge rt-badge--green">public</span>' : '<span class="rt-badge rt-badge--grey">draft</span>')) + ' <span class="shop-card-rail-n">' + n + '</span></span>' +
        (s.link && (s.link.ref || s.link.url) ? '<span class="shop-card-rail-link">' + esc(shopLinkLabel(s)) + '</span>' : '') +
      '</button>';
    }).join('');
    body.innerHTML = '<div class="shop-gm">' +
      '<aside class="shop-gm-rail">' + railHtml + '<button class="rt-btn rt-btn--green rt-btn--block" id="shop-new" style="margin-top:10px">+ New shop</button></aside>' +
      '<section class="shop-gm-edit" id="shop-edit"></section></div>';
    body.querySelectorAll('[data-shopsel]').forEach(function (b) { b.onclick = function () { sess.shopSel = b.getAttribute('data-shopsel'); renderShopGM(body); }; });
    el('shop-new').onclick = function () { shopNewModal(body); };
    renderShopEdit(el('shop-edit'), shopById(sel));
  }
  function shopNewModal(body) {
    if (!window.UI) { alert('UI not loaded.'); return; }
    var kindOpts = [['location', 'Location'], ['fixer', 'Fixer / NPC'], ['site', 'Organisation site'], ['online', 'Online']].map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('');
    window.UI.modal({
      title: 'New shop', body:
        '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="ns-name" placeholder="e.g. Kabuki black clinic"></label>' +
        '<label class="rt-field"><span class="rt-field-l">Kind</span><select class="rt-select" id="ns-kind">' + kindOpts + '</select></label>' +
        '<label class="rt-switch" style="margin-top:8px"><input type="checkbox" id="ns-pub"><span class="rt-switch-track"></span> Public to players</label>',
      actions: [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: function (box) {
        var name = (box.querySelector('#ns-name').value || '').trim(); if (!name) return false;
        var s = { id: uid('shop'), name: name, kind: box.querySelector('#ns-kind').value, link: { type: '', ref: '', url: '' }, public: box.querySelector('#ns-pub').checked, items: [] };
        if (!window.Store) return false;
        Store.create('shop', s).then(function (row) { _shopDocs.push(row); sess.shopSel = row.json.id; renderShopGM(body); });
      } }]
    });
  }
  function shopLinkLabel(s) {
    if (!s || !s.link || !s.link.type) return '';
    var t = s.link.type, ref = t === 'url' ? s.link.url : s.link.ref;
    if (!ref) return '';
    var ic = t === 'location' ? '◵' : t === 'npc' ? '☺' : t === 'org' ? '⌗' : '↗';
    return ic + ' ' + ref;
  }
  function renderShopEdit(host, s) {
    if (!host) return;
    if (!s) { host.innerHTML = '<div class="rt-panel"><div class="rt-panel-body"><div class="app-empty">Select or create a shop.</div></div></div>'; return; }
    if (s._virtual) {
      host.innerHTML = '<div class="rt-panel"><div class="rt-panel-head">' + esc(s.name) + ' <span class="rt-badge">auto</span></div><div class="rt-panel-body">' +
        '<p style="font-family:var(--mono);font-size:13px;color:var(--text2);line-height:1.7">Auto-generated basic catalog — common, affordable gear, weapons, chrome and vehicles, always available online to every player. Unlimited stock. To curate a custom storefront with limited stock and a location / fixer / org link, create a new shop.</p>' +
        '<div class="rt-rowline"><span>Items in catalog</span><b>' + (s.items || []).length + '</b></div>' +
        '</div></div>';
      return;
    }
    var player = shopIsPlayer(s);
    host.innerHTML =
      '<div class="shop-edit-head">' +
        '<div class="shop-edit-title" id="shop-name">' + esc(s.name) + '</div>' +
        '<div class="shop-edit-acts">' +
          (player ? '' : '<button class="shop-link-btn" id="shop-link">' + (s.link && (s.link.ref || s.link.url) ? esc(shopLinkLabel(s)) : '+ link to world') + '</button>') +
          '<label class="rt-switch"><input type="checkbox" id="shop-pub"' + (s.public ? ' checked' : '') + '><span class="rt-switch-track"></span> ' + (player ? 'Listed' : 'Public') + '</label>' +
          '<button class="rt-link" id="shop-ren">rename</button><button class="rt-link" id="shop-del">delete</button>' +
        '</div>' +
      '</div>' +
      '<div class="shop-curate">' +
        '<div class="shop-pal"><div class="shop-pal-head">' + (player ? 'Your inventory' : 'Database') + ' — drag onto the shelves →</div>' +
          '<div class="rt-tabs shop-pal-tabs" id="shop-pal-tabs"></div>' +
          '<input class="rt-input" id="shop-pal-search" placeholder="search…" style="margin:8px;width:calc(100% - 16px)">' +
          '<div class="shop-pal-list" id="shop-pal-list"></div>' +
        '</div>' +
        '<div class="shop-shelf" id="shop-shelf"><div class="shop-shelf-head">Shelves · <b id="shop-shelf-n">' + (s.items || []).length + '</b> items</div><div class="shop-shelf-grid" id="shop-shelf-grid"></div></div>' +
      '</div>';
    var lk = el('shop-link'); if (lk) lk.onclick = function () { shopLinkModal(s); };
    el('shop-pub').onchange = function () { s.public = el('shop-pub').checked; saveShopDoc(s.id, function () { shopReRender(s); }); };
    el('shop-ren').onclick = function () { prompt1('Rename shop', 'New name', s.name || '', function (v) { if (!v) return; s.name = v; saveShopDoc(s.id, function () { shopReRender(s); }); }); };
    el('shop-del').onclick = function () { confirm1('Delete this shop?', function () {
      var row = shopDocRow(s.id);
      var done = function () { _shopDocs = _shopDocs.filter(function (r) { return r.json.id !== s.id; }); sess.shopSel = null; shopReRender(s); };
      if (row && window.Store) Store.del(row.ref).then(done, done); else done();
    }); };
    paintShopPalette(s);
    paintShopShelf(s);
    // Shelf is a drop target for palette drags.
    var shelf = el('shop-shelf');
    shelf.addEventListener('dragover', function (e) { e.preventDefault(); shelf.classList.add('drop'); });
    shelf.addEventListener('dragleave', function () { shelf.classList.remove('drop'); });
    shelf.addEventListener('drop', function (e) {
      e.preventDefault(); shelf.classList.remove('drop');
      var raw; try { raw = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; }
      shopAddFromPalette(s, raw.cat, raw.name);
    });
  }
  function shopPalCats(s) { return shopIsPlayer(s) ? SHOP_CATS.filter(function (c) { return c[0] === 'weapons' || c[0] === 'gear' || c[0] === 'cyberware' || c[0] === 'vehicles'; }) : SHOP_CATS; }
  function paintShopPalette(s) {
    var cats = shopPalCats(s);
    var cat = sess.shopPalCat || 'weapons';
    if (!cats.some(function (c) { return c[0] === cat; })) cat = cats[0][0];
    sess.shopPalCat = cat;
    var tabs = el('shop-pal-tabs'); if (!tabs) return;
    tabs.innerHTML = cats.map(function (p) { return '<button class="rt-tab' + (p[0] === cat ? ' active' : '') + '" data-palcat="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    tabs.querySelectorAll('[data-palcat]').forEach(function (b) { b.onclick = function () { sess.shopPalCat = b.getAttribute('data-palcat'); paintShopPalette(s); }; });
    var se = el('shop-pal-search'); if (se) se.oninput = function () { paintPalList(s, cat); };
    paintPalList(s, cat);
  }
  function paintPalList(s, cat) {
    var host = el('shop-pal-list'); if (!host) return;
    var f = (el('shop-pal-search') && el('shop-pal-search').value || '').toLowerCase();
    var player = shopIsPlayer(s);
    var rows = shopPalPool(s, cat).filter(function (r) { return !f || JSON.stringify(r).toLowerCase().indexOf(f) >= 0; }).slice(0, 250);
    var have = {}; (s.items || []).forEach(function (it) { have[it.cat + ':' + it.name] = 1; });
    host.innerHTML = rows.length ? rows.map(function (r) {
      var added = have[cat + ':' + r.name];
      var own = player ? (r.qty > 0 ? Math.round(r.qty) : 1) : 0;
      return '<div class="shop-pal-row' + (added ? ' added' : '') + '" draggable="' + (added ? 'false' : 'true') + '" data-pname="' + esc(r.name) + '">' +
        '<span class="shop-pal-grip">⋮⋮</span><span class="shop-pal-name">' + esc(r.name || '') + (r._custom ? ' <span class="rt-badge rt-badge--gold">custom</span>' : '') + (player && own > 1 ? ' <span class="rt-badge">×' + own + '</span>' : '') + '</span>' +
        '<span class="shop-pal-price">' + shopPrice(r) + 'eb</span>' +
        (added ? '<span class="rt-badge rt-badge--green">in</span>' : '<button class="shop-pal-add" data-paladd="' + esc(r.name) + '" title="Add">+</button>') +
      '</div>';
    }).join('') : '<div class="app-empty">' + (player ? 'Nothing here to sell.' : 'No matches.') + '</div>';
    host.querySelectorAll('.shop-pal-row[draggable="true"]').forEach(function (row) {
      row.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', JSON.stringify({ cat: cat, name: row.getAttribute('data-pname') })); e.dataTransfer.effectAllowed = 'copy'; });
    });
    host.querySelectorAll('[data-paladd]').forEach(function (b) { b.onclick = function () { shopAddFromPalette(s, cat, b.getAttribute('data-paladd')); }; });
  }
  function shopAddFromPalette(s, cat, name) {
    if ((s.items || []).some(function (it) { return it.cat === cat && it.name === name; })) return;
    var r = shopPalPool(s, cat).filter(function (x) { return x.name === name; })[0]; if (!r) return;
    var player = shopIsPlayer(s), own = player ? shopOwnedQty(cat, name) : null;
    var data = JSON.parse(JSON.stringify(r)); ['buyId', '_forSale', '_invKey', 'qty'].forEach(function (k) { delete data[k]; });
    var item = { id: uid('si'), cat: cat, name: r.name, price: shopPrice(r), qty: player ? own : null, pitch: '', data: data };
    if (player) item._own = own;
    (s.items || (s.items = [])).push(item);
    saveShopDoc(s.id, function () { paintShopShelf(s); paintPalList(s, cat); var n = el('shop-shelf-n'); if (n) n.textContent = (s.items || []).length; });
  }
  /* ════════ Player storefront — the same curation UI, palette limited to the player's own inventory ════════ */
  function shopIsPlayer(s) { return !!(s && s.owner); }
  function shopPalPool(s, cat) {
    if (shopIsPlayer(s)) return shopOwnedItems(cat);                 // sell only what you own
    return (prep().customDb || []).filter(function (x) { return x.cat === cat; }).concat(DB_CACHE[cat] || []);
  }
  function shopOwnedQty(cat, name) {
    return shopOwnedItems(cat).filter(function (x) { return x.name === name; })
      .reduce(function (t, x) { return t + (x.qty > 0 ? Math.round(x.qty) : 1); }, 0);   // gear tracks qty; other cats are one unit per entry
  }
  function myShops() { var sid = idOf(sess.sheetId || ''); return _shopDocs.map(function (r) { return r.json; }).filter(function (s) { return s.owner && s.owner === sid; }); }
  function shopReRender(s) { var b = el('shop-body'); if (!b) return; if (shopIsPlayer(s)) renderPlayerStoreEditor(b); else renderShopGM(b); }
  function renderPlayerStoreEditor(body) {
    var shops = myShops();
    var sel = sess.shopSel && shops.filter(function (s) { return s.id === sess.shopSel; })[0] ? sess.shopSel : (shops[0] && shops[0].id);
    sess.shopSel = sel || null;
    var railHtml = shops.map(function (s) {
      var n = (s.items || []).length;
      return '<button class="shop-rail-shop' + (s.id === sel ? ' active' : '') + '" data-shopsel="' + esc(s.id) + '">' +
        '<span class="shop-rail-shop-name">' + esc(s.name || 'Storefront') + '</span>' +
        '<span class="shop-rail-shop-loc">' + (s.public ? 'public' : 'draft') + ' · ' + n + ' item' + (n === 1 ? '' : 's') + '</span>' +
      '</button>';
    }).join('');
    body.innerHTML = '<div class="shop-wrap">' +
      '<aside class="shop-rail">' +
        '<button class="shop-rail-shop shop-rail-nav" id="shop-back"><span class="shop-rail-shop-name">← Back to market</span></button>' +
        '<div class="shop-rail-h">Your storefronts</div>' +
        (railHtml || '<div class="shop-rail-empty">No storefront yet.</div>') +
        '<button class="shop-rail-shop shop-rail-add" id="shop-new"><span class="shop-rail-shop-name">＋ New storefront</span></button>' +
      '</aside>' +
      '<main class="shop-main shop-main-edit" id="shop-edit"></main>' +
    '</div>';
    body.querySelectorAll('[data-shopsel]').forEach(function (b) { b.onclick = function () { sess.shopSel = b.getAttribute('data-shopsel'); renderPlayerStoreEditor(body); }; });
    el('shop-back').onclick = function () { sess.shopMode = 'browse'; sess.shopSel = null; renderShopPlayer(body); };
    el('shop-new').onclick = function () { playerShopNewModal(body); };
    renderShopEdit(el('shop-edit'), shops.filter(function (s) { return s.id === sel; })[0] || null);
  }
  function playerShopNewModal(body) {
    if (!window.UI || !window.Store) return;
    if (!sess.sheetId) { alert('No character sheet linked.'); return; }
    window.UI.modal({
      title: 'New storefront', body:
        '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="ns-name" placeholder="e.g. Street doc surplus"></label>' +
        '<label class="rt-switch" style="margin-top:8px"><input type="checkbox" id="ns-pub" checked><span class="rt-switch-track"></span> Public — listed on your site</label>',
      actions: [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: function (box) {
        var name = (box.querySelector('#ns-name').value || '').trim(); if (!name) return false;
        var s = { id: uid('shop'), name: name, kind: 'player', owner: idOf(sess.sheetId), link: { type: '', ref: '', url: '' }, public: box.querySelector('#ns-pub').checked, items: [] };
        Store.create('shop', s).then(function (row) { _shopDocs.push(row); sess.shopSel = row.json.id; renderPlayerStoreEditor(body); });
      } }]
    });
  }
  function paintShopShelf(s) {
    var grid = el('shop-shelf-grid'); if (!grid) return;
    var items = s.items || [];
    if (!items.length) { grid.innerHTML = '<div class="shop-shelf-empty">Drag items here, or hit “+” in the ' + (shopIsPlayer(s) ? 'inventory' : 'database') + ' list.</div>'; return; }
    grid.innerHTML = items.map(function (it) {
      return '<div class="shop-shelf-card">' +
        '<div class="shop-shelf-card-top"><span class="rt-badge">' + esc(SHOP_CAT_LABEL[it.cat] || it.cat) + '</span><button class="shop-shelf-x" data-itemdel="' + esc(it.id) + '" title="Remove">✕</button></div>' +
        '<div class="shop-shelf-card-name">' + esc(it.name || '') + '</div>' +
        '<div class="shop-shelf-stats">' + shopStatChips(it) + '</div>' +
        '<div class="shop-shelf-fields">' +
          '<label class="shop-mini">eb<input class="rt-input shop-num" data-price="' + esc(it.id) + '" value="' + (it.price || 0) + '"></label>' +
          '<label class="shop-mini">stock<input class="rt-input shop-num" data-qty="' + esc(it.id) + '"' + (it._own != null ? ' min="0" max="' + it._own + '"' : '') + ' value="' + (it.qty == null ? '' : it.qty) + '" placeholder="' + (it._own != null ? 'max ' + it._own : '∞') + '"></label>' +
        '</div>' +
        '<input class="rt-input shop-pitch" data-pitch="' + esc(it.id) + '" placeholder="sales pitch (optional)…" value="' + esc(it.pitch || '') + '">' +
      '</div>';
    }).join('');
    grid.querySelectorAll('[data-price]').forEach(function (i) { i.onchange = function () { var it = items.filter(function (x) { return x.id === i.getAttribute('data-price'); })[0]; if (it) { it.price = parseInt(i.value, 10) || 0; saveShopDoc(s.id); } }; });
    grid.querySelectorAll('[data-qty]').forEach(function (i) { i.onchange = function () { var it = items.filter(function (x) { return x.id === i.getAttribute('data-qty'); })[0]; if (!it) return; var v = i.value === '' ? null : (parseInt(i.value, 10) || 0); if (v != null && it._own != null) { v = Math.max(0, Math.min(it._own, v)); i.value = v; } it.qty = v; saveShopDoc(s.id); }; });
    grid.querySelectorAll('[data-pitch]').forEach(function (i) { i.onchange = function () { var it = items.filter(function (x) { return x.id === i.getAttribute('data-pitch'); })[0]; if (it) { it.pitch = i.value; saveShopDoc(s.id); } }; });
    grid.querySelectorAll('[data-itemdel]').forEach(function (b) { b.onclick = function () { s.items = items.filter(function (x) { return x.id !== b.getAttribute('data-itemdel'); }); saveShopDoc(s.id, function () { paintShopShelf(s); paintShopPalette(s); var n = el('shop-shelf-n'); if (n) n.textContent = (s.items || []).length; }); }; });
  }
  // A compact stat-chip strip for a shop item (uses its DB data).
  function shopStatChips(it) {
    var d = it.data || {}, out = [];
    if (d.connection && d.reach != null && d.power != null && d.stealth != null) {
      out.push('<span class="shop-chip">REACH ' + esc(d.reach) + '</span>', '<span class="shop-chip">POWER ' + esc(d.power) + '</span>', '<span class="shop-chip">' + esc(String(d.connection).toUpperCase()) + '</span>', '<span class="shop-chip">STEALTH ' + esc(d.stealth || 0) + '</span>');
      if (d.perk) out.push('<span class="shop-chip shop-chip-gold">' + esc(String(d.perk).toUpperCase()) + '</span>');
      return out.join('');
    }
    shopStatList(it.cat).forEach(function (st) { var v = d[st[0]]; if (v != null && v !== '') out.push('<span class="shop-chip">' + st[1] + ' ' + esc(v) + '</span>'); });
    if (it.cat === 'weapons' && d.conc) out.push('<span class="shop-chip">CONC ' + esc(d.conc) + '</span>');
    if (d.avail || d.availability) out.push('<span class="shop-chip">AV ' + esc(d.avail || d.availability) + '</span>');
    return out.join('') || '<span class="shop-chip shop-chip-dim">no stats</span>';
  }
  /* ════════ Rich link picker (modal) ════════ */
  function shopLinkModal(s) {
    if (!window.UI) { alert('UI not loaded.'); return; }
    var type = (s.link && s.link.type) || 'location';
    var docs = cdData.docs || {};
    window.UI.modal({
      title: 'Link “' + (s.name || 'shop') + '” to the world', size: 'wide',
      body: '<div class="rt-tabs" id="lk-tabs">' + [['location', 'Location'], ['npc', 'NPC'], ['org', 'Org'], ['url', 'URL'], ['', 'None']].map(function (t) {
          return '<button class="rt-tab' + (t[0] === type ? ' active' : '') + '" data-lktype="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<input class="rt-input" id="lk-search" placeholder="search…" style="margin-bottom:10px">' +
        '<div id="lk-list" style="max-height:44vh;overflow:auto"></div>',
      actions: [{ label: 'Done', kind: 'primary' }]
    });
    var box = document.querySelector('.ui-modal') || document;
    function setLink(t, ref, url) { s.link = { type: t, ref: ref || '', url: url || '' }; saveShopDoc(s.id, function () { renderShopGM(el('shop-body')); }); }
    function paint() {
      var f = (box.querySelector('#lk-search').value || '').toLowerCase(), list = box.querySelector('#lk-list'), rows = [];
      var cur = (s.link && s.link.ref) || (s.link && s.link.url) || '';
      if (type === 'location') rows = shopLocations().map(function (p) { return { ref: p.name, label: p.name, sub: p.sub }; });
      else if (type === 'npc') rows = (docs.npcs || []).map(function (d) { return { ref: idOf(d.name), label: idOf(d.name), sub: 'NPC' }; });
      else if (type === 'org') rows = (docs.orgs || []).map(function (d) { return { ref: idOf(d.name), label: idOf(d.name), sub: 'Organisation' }; });
      if (type === 'url') { list.innerHTML = '<input class="rt-input" id="lk-url" placeholder="https://…" value="' + esc((s.link && s.link.url) || '') + '"><button class="rt-btn rt-btn--green" id="lk-url-go" style="margin-top:8px">Set URL</button>'; box.querySelector('#lk-url-go').onclick = function () { setLink('url', '', box.querySelector('#lk-url').value); UI.close(); }; return; }
      if (type === '') { list.innerHTML = '<button class="rt-btn rt-btn--red" id="lk-none">Remove link</button>'; box.querySelector('#lk-none').onclick = function () { setLink('', '', ''); UI.close(); }; return; }
      rows = rows.filter(function (r) { return !f || r.label.toLowerCase().indexOf(f) >= 0; });
      list.innerHTML = rows.length ? rows.map(function (r) {
        return '<button class="shop-lk-row' + (r.ref === cur && type === (s.link && s.link.type) ? ' active' : '') + '" data-lkref="' + esc(r.ref) + '"><span class="shop-lk-name">' + esc(r.label) + '</span><span class="shop-lk-sub">' + esc(r.sub) + '</span></button>';
      }).join('') : '<div class="app-empty">Nothing here yet' + (type === 'location' ? ' — open the Map and mark places public.' : '.') + '</div>';
      list.querySelectorAll('[data-lkref]').forEach(function (b) { b.onclick = function () { setLink(type, b.getAttribute('data-lkref'), ''); UI.close(); }; });
    }
    box.querySelectorAll('[data-lktype]').forEach(function (b) { b.onclick = function () { type = b.getAttribute('data-lktype'); box.querySelectorAll('[data-lktype]').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); paint(); }; });
    box.querySelector('#lk-search').oninput = paint;
    paint();
  }

  /* ════════ Player storefront: rail · card grid · detail drawer · cart ════════ */
  function shopAccessible() { return [defaultOnlineShop()].concat(_shopDocs.map(function (r) { return r.json; }).filter(function (s) { return (s.props && s.props.public) || s.public; })); }
  function renderShopPlayer(body) {
    if (sess.shopMode === 'sell') { renderPlayerStoreEditor(body); return; }
    var shops = shopAccessible();
    var sel = sess.shopSel && shops.filter(function (s) { return s.id === sess.shopSel; })[0] ? sess.shopSel : shops[0].id;
    sess.shopSel = sel;
    var cur = shops.filter(function (s) { return s.id === sel; })[0] || shops[0];
    var cats = []; (cur.items || []).forEach(function (it) { if (cats.indexOf(it.cat) < 0) cats.push(it.cat); });
    if (!sess.shopCat || (sess.shopCat !== 'all' && cats.indexOf(sess.shopCat) < 0)) sess.shopCat = 'all';
    var railShops = shops.map(function (s) {
      return '<button class="shop-rail-shop' + (s.id === sel ? ' active' : '') + '" data-pshop="' + esc(s.id) + '">' +
        '<span class="shop-rail-shop-name">' + esc(s.name || 'Shop') + '</span>' +
        (s.link && (s.link.ref || s.link.url) ? '<span class="shop-rail-shop-loc">' + esc(shopLinkLabel(s)) + '</span>' : (s._virtual ? '<span class="shop-rail-shop-loc">always online</span>' : '')) +
      '</button>';
    }).join('');
    var catChips = [['all', 'All']].concat(cats.map(function (c) { return [c, SHOP_CAT_LABEL[c] || c]; }))
      .map(function (c) { return '<button class="shop-catchip' + (c[0] === sess.shopCat ? ' active' : '') + '" data-pcat="' + c[0] + '">' + esc(c[1]) + '</button>'; }).join('');
    body.innerHTML = '<div class="shop-wrap">' +
      '<aside class="shop-rail"><div class="shop-rail-h">Storefronts</div>' + railShops +
        (sess.sheetId ? '<button class="shop-rail-shop shop-rail-sell" id="shop-sell"><span class="shop-rail-shop-name">✎ Sell your gear</span><span class="shop-rail-shop-loc">list your inventory →</span></button>' : '') +
      '</aside>' +
      '<main class="shop-main">' +
        '<div class="shop-main-head"><input class="rt-input" id="shop-psearch" placeholder="search this shop…"><div class="shop-catchips">' + catChips + '</div></div>' +
        '<div class="shop-grid" id="shop-grid"></div>' +
      '</main>' +
      '<div class="shop-drawer" id="shop-drawer"></div>' +
    '</div>' +
    '<div class="shop-cartbar" id="shop-cartbar"></div>';
    body.querySelectorAll('[data-pshop]').forEach(function (b) { b.onclick = function () { sess.shopSel = b.getAttribute('data-pshop'); sess.shopCat = 'all'; renderShopPlayer(body); }; });
    var sellB = el('shop-sell'); if (sellB) sellB.onclick = function () { sess.shopMode = 'sell'; sess.shopSel = null; renderPlayerStoreEditor(body); };
    body.querySelectorAll('[data-pcat]').forEach(function (b) { b.onclick = function () { sess.shopCat = b.getAttribute('data-pcat'); paintGrid(); body.querySelectorAll('[data-pcat]').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); }; });
    var se = el('shop-psearch'); if (se) se.oninput = paintGrid;
    function paintGrid() {
      var f = (el('shop-psearch') && el('shop-psearch').value || '').toLowerCase();
      var items = (cur.items || []).filter(function (it) { return (sess.shopCat === 'all' || it.cat === sess.shopCat) && (!f || (it.name || '').toLowerCase().indexOf(f) >= 0); });
      var grid = el('shop-grid'); if (!grid) return;
      grid.innerHTML = items.length ? items.map(function (it) { return shopProductCard(cur, it); }).join('') : '<div class="app-empty">Nothing for sale here.</div>';
      grid.querySelectorAll('[data-card]').forEach(function (c) { c.onclick = function (e) { if (e.target.closest('[data-cart]')) return; shopOpenDetail(cur, (cur.items || []).filter(function (x) { return x.id === c.getAttribute('data-card'); })[0]); }; });
      grid.querySelectorAll('[data-cart]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); shopCartAdd(cur, (cur.items || []).filter(function (x) { return x.id === b.getAttribute('data-cart'); })[0]); }; });
    }
    paintGrid();
    renderCartBar();
  }
  function shopProductCard(shop, it) {
    var out = it.qty != null && it.qty <= 0;
    return '<div class="shop-pcard' + (out ? ' sold' : '') + '" data-card="' + esc(it.id) + '">' +
      '<div class="shop-pcard-cat">' + esc(SHOP_CAT_LABEL[it.cat] || it.cat) + '</div>' +
      '<div class="shop-pcard-name">' + esc(it.name || '') + '</div>' +
      (it.pitch ? '<div class="shop-pcard-pitch">' + esc(it.pitch) + '</div>' : '') +
      '<div class="shop-pcard-chips">' + shopStatChips(it) + '</div>' +
      '<div class="shop-pcard-foot"><span class="shop-pcard-price">' + Math.round(it.price || 0) + 'eb</span>' +
        '<span class="shop-pcard-stock">' + (it.qty == null ? 'in stock' : (out ? 'sold out' : it.qty + ' left')) + '</span>' +
        (out ? '' : '<button class="shop-pcard-cart" data-cart="' + esc(it.id) + '" title="Add to cart">+ cart</button>') +
      '</div>' +
    '</div>';
  }
  function shopOpenDetail(shop, it) {
    if (!it) return;
    var d = el('shop-drawer'); if (!d) return;
    var out = it.qty != null && it.qty <= 0;
    d.innerHTML = '<div class="shop-drawer-in">' +
      '<button class="shop-drawer-x" id="shop-dx">✕</button>' +
      '<div class="shop-drawer-cat">' + esc(SHOP_CAT_LABEL[it.cat] || it.cat) + '</div>' +
      '<div class="shop-drawer-name">' + esc(it.name || '') + '</div>' +
      (it.pitch ? '<div class="shop-drawer-pitch">“' + esc(it.pitch) + '”</div>' : '') +
      '<div class="shop-drawer-price">' + Math.round(it.price || 0) + 'eb <span class="shop-drawer-stock">· ' + (it.qty == null ? 'unlimited stock' : (out ? 'sold out' : it.qty + ' in stock')) + '</span></div>' +
      '<div class="shop-drawer-acts">' +
        (out ? '<button class="rt-btn is-disabled" disabled>Sold out</button>'
             : '<button class="rt-btn rt-btn--green" id="shop-dbuy">Buy now</button><button class="rt-btn" id="shop-dcart">+ Add to cart</button>') +
      '</div>' +
      '<div class="shop-drawer-sec">Specs</div>' + shopSpecTable(it) +
      shopCompareBlock(it) +
    '</div>';
    d.classList.add('open');
    el('shop-dx').onclick = function () { d.classList.remove('open'); };
    var bb = el('shop-dbuy'); if (bb) bb.onclick = function () { shopBuy(shop, it, bb); };
    var cb = el('shop-dcart'); if (cb) cb.onclick = function () { shopCartAdd(shop, it); };
  }
  function shopSpecTable(it) {
    var d = it.data || {}, rows = [];
    var keys = Object.keys(d).filter(function (k) { return k !== 'name' && k !== 'cost' && k !== '_custom' && k !== 'id' && k !== 'cat' && d[k] != null && d[k] !== '' && typeof d[k] !== 'object'; });
    keys.forEach(function (k) { rows.push('<div class="shop-spec"><span class="shop-spec-k">' + esc(k) + '</span><span class="shop-spec-v">' + esc(d[k]) + '</span></div>'); });
    return '<div class="shop-specs">' + (rows.join('') || '<div class="app-empty">No detailed specs.</div>') + '</div>';
  }
  // A weapon's class so melee gear is never compared against firearms (and vice-versa).
  function shopWeaponClass(d) { return String((d && d.type) || '').toUpperCase() === 'MEL' ? 'melee' : 'ranged'; }
  function shopSameClass(cat, prodData, arr) {
    if (cat !== 'weapons') return (arr || []).slice();
    var pc = shopWeaponClass(prodData);
    return (arr || []).filter(function (x) { return shopWeaponClass(x) === pc; });
  }
  // Comparison vs the player's owned same-category items + the rest of the database.
  // Superior value = green, inferior = red (per stat, This vs Your best).
  function shopCompareBlock(it) {
    var stats = shopStatList(it.cat); if (!stats.length) return '';
    var pdata = it.data || it;
    var owned = shopSameClass(it.cat, pdata, shopOwnedItems(it.cat));
    var db = shopSameClass(it.cat, pdata, DB_CACHE[it.cat] || []);
    var wins = 0, tot = 0;
    var rows = stats.map(function (st) {
      var key = st[0], label = st[1], parse = st[2], hi = st[3];
      var mine = parse(pdata[key]);
      function best(arr) { var b = null, bn = null; (arr || []).forEach(function (x) { var v = parse(x[key]); if (v == null) return; if (bn == null || (hi ? v > bn : v < bn)) { bn = v; b = x; } }); return { v: bn, item: b }; }
      var yours = best(owned), cat = best(db);
      // Colour This vs Your best: better → green, worse → red.
      var thisCls = '', yourCls = '';
      if (mine != null && yours.v != null && mine !== yours.v) {
        var betterMine = hi ? mine > yours.v : mine < yours.v;
        thisCls = betterMine ? 'shop-cmp-up' : 'shop-cmp-down';
        yourCls = betterMine ? 'shop-cmp-down' : 'shop-cmp-up';
      }
      if (mine != null) { tot++; if (yours.v == null || (hi ? mine >= yours.v : mine <= yours.v)) wins++; }
      var num = function (v) { return v == null ? '—' : (Math.round(v * 10) / 10); };
      return '<tr><th>' + esc(label) + '</th>' +
        '<td class="' + thisCls + '">' + num(mine) + '</td>' +
        '<td class="' + yourCls + '">' + (yours.v == null ? '<span class="shop-cmp-dim">—</span>' : num(yours.v) + '<span class="shop-cmp-name">' + esc((yours.item && yours.item.name) || '') + '</span>') + '</td>' +
        '<td>' + (cat.v == null ? '—' : num(cat.v) + '<span class="shop-cmp-name">' + esc((cat.item && cat.item.name) || '') + '</span>') + '</td>' +
      '</tr>';
    }).join('');
    var kind = it.cat === 'weapons' ? (shopWeaponClass(pdata) === 'melee' ? 'melee weapons' : 'ranged weapons') : 'gear';
    var verdict = !owned.length ? 'You own no comparable ' + kind + ' yet.' : (wins === tot && tot ? 'Beats or matches your ' + kind + ' on every stat.' : wins ? 'Better on ' + wins + ' of ' + tot + ' stats vs your ' + kind + '.' : 'Your current ' + kind + ' are stronger.');
    return '<div class="shop-drawer-sec">Compare' + (it.cat === 'weapons' ? ' · ' + (shopWeaponClass(pdata) === 'melee' ? 'melee' : 'ranged') : '') + '</div>' +
      '<div class="shop-cmp-verdict">' + esc(verdict) + '</div>' +
      '<table class="shop-cmp"><thead><tr><th></th><th>This</th><th>Your best</th><th>Catalog best</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  /* ── Cart + checkout ── */
  function shopCart() { return sess.shopCartArr || (sess.shopCartArr = []); }
  function shopCartAdd(shop, it) {
    if (!it) return;
    if (it.qty != null && it.qty <= 0) { alert('Out of stock.'); return; }
    shopCart().push({ shopId: shop.id, virtual: !!shop._virtual, itemId: it.id, cat: it.cat, name: it.name, price: Math.round(it.price || 0), data: it.data });
    renderCartBar();
    var bar = el('shop-cartbar'); if (bar) { bar.classList.add('pulse'); setTimeout(function () { bar.classList.remove('pulse'); }, 300); }
  }
  function renderCartBar() {
    var bar = el('shop-cartbar'); if (!bar) return;
    var c = shopCart();
    if (!c.length) { bar.className = 'shop-cartbar'; bar.innerHTML = ''; return; }
    var total = c.reduce(function (t, x) { return t + (x.price || 0); }, 0);
    bar.className = 'shop-cartbar on';
    bar.innerHTML = '<span class="shop-cart-n">CART · ' + c.length + ' item' + (c.length > 1 ? 's' : '') + '</span>' +
      '<span class="shop-cart-total">' + total.toLocaleString() + 'eb</span>' +
      '<button class="rt-btn rt-btn--sm" id="shop-cart-clear">Clear</button>' +
      '<button class="rt-btn rt-btn--green rt-btn--sm" id="shop-cart-go">Checkout</button>';
    el('shop-cart-clear').onclick = function () { sess.shopCartArr = []; renderCartBar(); };
    el('shop-cart-go').onclick = shopCheckoutModal;
  }
  function shopCheckoutModal() {
    if (!window.UI) return;
    if (sess.role !== 'player' || !sess.sheetId) { alert('No character sheet linked.'); return; }
    var c = shopCart(); if (!c.length) return;
    var json = shopPlayerJson() || {};
    var ls = json.lifestyle || {};
    var cash = parseFloat(ls.cash != null ? ls.cash : (json.money || 0)) || 0;
    var accs = (ls.accounts || []).filter(function (a) { return !a.closed; });
    var total = c.reduce(function (t, x) { return t + (x.price || 0); }, 0);
    var srcOpts = '<option value="">Leave unpaid (buy-tray)</option><option value="cash">Cash (' + cash.toLocaleString() + 'eb)</option>' +
      accs.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + ' (' + (parseFloat(a.balance) || 0).toLocaleString() + 'eb)</option>'; }).join('');
    window.UI.modal({
      title: 'Checkout — ' + c.length + ' item' + (c.length > 1 ? 's' : ''),
      body: '<div class="shop-co-list">' + c.map(function (x, i) { return '<div class="rt-rowline"><span>' + esc(x.name) + ' <span class="rt-badge">' + (SHOP_CAT_LABEL[x.cat] || x.cat) + '</span></span><span>' + (x.price || 0).toLocaleString() + 'eb <button class="rt-link" data-corm="' + i + '">✕</button></span></div>'; }).join('') + '</div>' +
        '<div class="rt-rowline" style="border:0;font-size:15px;margin-top:6px"><b>Total</b><b>' + total.toLocaleString() + 'eb</b></div>' +
        '<label class="rt-field" style="margin-top:10px"><span class="rt-field-l">Pay from</span><select class="rt-select" id="co-src">' + srcOpts + '</select></label>',
      actions: [{ label: 'Cancel' }, { label: 'Confirm', kind: 'primary', onClick: function (box) {
        var src = box.querySelector('#co-src').value;
        shopCheckout(c, src);
      } }]
    });
    var box = document.querySelector('.ui-modal') || document;
    box.querySelectorAll('[data-corm]').forEach(function (b) { b.onclick = function () { c.splice(+b.getAttribute('data-corm'), 1); UI.close(); renderCartBar(); if (c.length) shopCheckoutModal(); }; });
  }
  function shopCheckout(cart, src) {
    var sid = idOf(sess.sheetId);
    var rec = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid); if (!rec || !rec.json) { alert('Could not load your sheet.'); return; }
    var json = rec.json, total = 0;
    cart.forEach(function (x) { shopWriteItem(json, x); total += (x.price || 0); });
    if (src) {
      // Pay now from the chosen source (deduct + ledger), no unpaid lines.
      if (src === 'cash') { json.lifestyle = json.lifestyle || {}; json.lifestyle.cash = (parseFloat(json.lifestyle.cash != null ? json.lifestyle.cash : (json.money || 0)) || 0) - total; }
      else { var acc = ((json.lifestyle && json.lifestyle.accounts) || []).filter(function (a) { return a.id === src; })[0]; if (acc) { acc.balance = (parseFloat(acc.balance) || 0) - total; acc.ledger = acc.ledger || []; acc.ledger.unshift({ id: 'sx-' + Date.now().toString(36), type: 'expense', label: 'Shop purchase (' + cart.length + ')', amount: total }); } }
    } else {
      // Leave as unpaid buy-tray lines.
      json.pending = json.pending || [];
      cart.forEach(function (x) { json.pending.push({ id: 'shop-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: x.name, cost: Math.round(x.price || 0), kind: x.cat }); });
    }
    sess.camp.publishSheet(sid, json.handle || json.name || sid, json);
    // Decrement shared stock for real (non-virtual) shop lines.
    var touched = false;
    var touchedIds = {};
    cart.forEach(function (x) { if (x.virtual) return; var row = shopDocRow(x.shopId); if (!row) return; var li = ((row.json.items) || []).filter(function (y) { return y.id === x.itemId; })[0]; if (li && li.qty != null) { li.qty = Math.max(0, li.qty - 1); touched = true; touchedIds[x.shopId] = 1; } });
    if (touched) Object.keys(touchedIds).forEach(function (sid) { saveShopDoc(sid); });
    logSession('Bought ' + cart.length + ' item' + (cart.length > 1 ? 's' : '') + ' — ' + total.toLocaleString() + 'eb' + (src ? ' (paid)' : ' (unpaid)'));
    sess.shopCartArr = [];
    renderShopPlayer(el('shop-body'));
  }
  function shopBuy(shop, it, btn) {
    if (sess.role !== 'player' || !sess.sheetId) { alert('No character sheet linked to receive the purchase.'); return; }
    if (it.qty != null && it.qty <= 0) { alert('Out of stock.'); return; }
    if (!applyPurchaseToSheet(sess.sheetId, it)) { alert('Could not write to your sheet — is it loaded?'); return; }
    if (it.qty != null && !shop._virtual) {
      var row = shopDocRow(shop.id);
      if (row) { var li = ((row.json.items) || []).filter(function (x) { return x.id === it.id; })[0]; if (li && li.qty != null) li.qty = Math.max(0, li.qty - 1); }
      saveShopDoc(shop.id);
    }
    logSession('Bought "' + (it.name || 'item') + '" — ' + Math.round(it.price || 0) + 'eb (on sheet · unpaid)');
    if (btn) { btn.textContent = '✓ on your sheet'; btn.disabled = true; }
    setTimeout(function () { renderShopPlayer(el('shop-body')); }, 650);
  }
  // Append one bought item to the right sheet array (shared writer for buy / cart).
  function shopWriteItem(json, it) {
    var arr = shopCatToArr(it.cat);
    if (!Array.isArray(json[arr])) json[arr] = [];
    var obj = it.data ? JSON.parse(JSON.stringify(it.data)) : { name: it.name };
    delete obj._custom; delete obj.cat; delete obj.id;
    if (arr === 'gear') obj.category = obj.category || (it.cat === 'decks' ? 'CYBERDECK' : it.cat === 'programs' ? 'PROGRAM' : (obj.category || 'GEAR'));
    json[arr].push(obj);
  }
  // Instant buy → item on the sheet + an unpaid buy-tray line (no auto-deduction).
  // The unpaid line carries NO buyId (the sheet re-normalizes items and strips it).
  function applyPurchaseToSheet(sid, it) {
    sid = idOf(sid);
    var rec = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid); if (!rec || !rec.json) return false;
    var json = rec.json;
    shopWriteItem(json, it);
    if (!Array.isArray(json.pending)) json.pending = [];
    json.pending.push({ id: 'shop-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), name: it.name || 'Item', cost: Math.round(it.price || 0), kind: it.cat });
    sess.camp.publishSheet(sid, json.handle || json.name || sid, json);
    return true;
  }
  // Map — role-aware Night City (GM planner / player overlay view).
  function renderMap(panel) {
    if (!panel) return;
    panel.classList.add('sess-sec-files');
    var role = sess.role === 'gm' ? 'gm' : 'player';
    panel.innerHTML = '<iframe class="sess-livesheet" src="nightcity.html?campaign=' + encodeURIComponent(sess.id) + '&ncrole=' + role + '"></iframe>';
    var fr = panel.querySelector('iframe'); if (fr) fr.onload = function () { ncSyncToFrame(); ncPostShopLocs(fr); };
  }
  // Tell the map which location names host a shop, so it can show an "open shop" affordance.
  // Post-migration this is a links-registry query: shop —[located at]→ location.
  function shopLocationNames() {
    if (!(window.Links && window.Store)) return Promise.resolve([]);
    return Links.loadAll().then(function (rows) {
      var locRefs = rows.filter(function (l) { return l.from && l.from.type === 'shop' && l.to && l.to.type === 'location'; }).map(function (l) { return l.to; });
      return Promise.all(locRefs.map(function (r) { return Store.resolve(r).then(function (hit) { return hit ? (hit.json.name || '') : ''; }).catch(function () { return ''; }); }));
    }).then(function (names) { return names.filter(Boolean); }).catch(function () { return []; });
  }
  function ncPostShopLocs(fr) {
    ensureCdData(function () {
      shopLocationNames().then(function (names) {
        try { fr.contentWindow.postMessage({ type: 'nc-shop-locs', names: names }, '*'); } catch (e) {}
      });
    });
  }
  // Log — session journal (meta.sessions[].log), newest first.
  function logTag(msg) {
    var m = msg || '';
    if (/reveal|cast|▸|⏱/i.test(m)) return ['CAST', 'var(--acc-danger)'];
    if (/combat|round|◆|damage/i.test(m)) return ['COMBAT', 'var(--ink)'];
    if (/loot|€|eddies|❖/i.test(m)) return ['LOOT', 'var(--yellow)'];
    if (/live|●|session/i.test(m)) return ['SESSION', 'var(--green)'];
    return ['LOG', 'var(--text2)'];
  }
  function renderLog(panel) {
    if (!panel) return;
    panel.innerHTML = rtHead('☰', 'Log', 'Session history — everything revealed & cast', '') +
      '<div class="rt-panel"><div class="rt-panel-head">Timeline</div><div class="rt-panel-body" id="log-scroll"><div class="app-empty">Loading…</div></div></div>';
    api('GET', 'campaigns/' + encodeURIComponent(sess.id)).then(function (d) {
      var ss = ((d && d.meta && d.meta.sessions) || []);
      var rows = [];
      ss.forEach(function (s) { (s.log || []).forEach(function (e) { rows.push({ ts: e.ts || 0, msg: e.msg || '' }); }); });
      rows.sort(function (a, b) { return b.ts - a.ts; });
      var host = el('log-scroll'); if (!host) return;
      host.innerHTML = rows.length ? rows.map(function (r) {
        var t = r.ts ? new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        var tag = logTag(r.msg);
        return '<div class="rt-rowline" style="border-bottom:1px solid #eee;gap:10px;align-items:center">' +
          '<span class="ses-logt" style="min-width:46px;color:var(--text2)">' + esc(t) + '</span>' +
          '<span class="rt-badge" style="background:' + tag[1] + ';border-color:' + tag[1] + ';color:#fff;font-size:9px;padding:2px 6px">' + tag[0] + '</span>' +
          '<span style="flex:1">' + esc(r.msg) + '</span></div>';
      }).join('') : '<div class="app-empty">No log entries yet. Going live and casting records history here.</div>';
    }).catch(function () {});
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
        '<button class="prep-mini' + (on ? ' on' : '') + '" id="runclkrev-' + k.id + '" data-clkrev="' + k.id + '">' + (on ? 'shown' : 'reveal') + '</button></div>';
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
        b.classList.toggle('on', !on); b.textContent = !on ? 'shown' : 'reveal';
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
        // Clock-threshold auto-trigger moved to the CAST reactive engine (rule docs) —
        // see js/app-cast.js + docs/cast-triggers-design.md §E. Legacy path removed.
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
      else if (x.cat === 'container') {
        // A looted stash lands as a functional non-portable container on the sheet.
        if (!Array.isArray(json.fashion)) json.fashion = [];
        var d = x.data || {};
        json.fashion.push({ name: x.name || d.name || 'Container', category: 'STORAGE', cost: d.cost || 0, wt: d.wt || 0, notes: (d.notes || '') + (label ? ' · from ' + label : ''), slots: d.slots || 8, isOutfit: false, isArmor: false, nonPortable: true, contents: [] });
      }
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
    // Columns is THE party display (horizontal scroll, vertical per sheet);
    // "tabs" survives as an accessibility fallback in the hamburger settings.
    // Grid is gone — the PJ card grid lives in DATA now.
    var mode = (window.App && App.uiGet('settings.partyMode', 'columns')) || 'columns';
    var colW = (window.App && App.uiGet('settings.partyCols', 1.5)) || 1.5;
    var colCls = colW === 1 ? 'w1' : colW === 2 ? 'w2' : colW === 3 ? 'w3' : 'w15';
    if (sess.order.indexOf(sess.active) < 0) sess.active = sess.order[0] || null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var bar = '<div class="pl-bar"><span class="pl-bar-title">PARTY</span><span style="flex:1"></span>' +
      '<button class="sess-mode sess-mode-add" id="pl-add" title="Add a blank character sheet">+ Sheet</button>' +
    '</div>';
    var body;
    if (!sess.order.length) body = '<div class="cd-empty">No sheets hosted.</div>';
    else if (mode === 'tabs') {
      var tabs = sess.order.map(function (sid) { return '<div class="sess-tab' + (sid === sess.active ? ' active' : '') + '" data-sid="' + esc(sid) + '">' + esc(sheetLabel(sid)) + '</div>'; }).join('');
      body = '<div class="sess-tabbar">' + tabs + '</div><div class="sess-tabbody">' + (sess.active ? '<iframe class="sess-col-frame" src="' + frameSrc(sess.active) + '"></iframe>' : '') + '</div>';
    } else {
      var cols = sess.order.map(function (sid, i) {
        return '<div class="sess-col sess-col-' + colCls + '" data-sid="' + esc(sid) + '" draggable="true">' +
          '<div class="sess-col-head"><span class="sess-col-idx">' + pad(i + 1) + '</span><span class="sess-col-name">' + esc(sheetLabel(sid)) + '</span><span class="sess-col-grab">⠿</span></div>' +
          '<iframe class="sess-col-frame" src="' + frameSrc(sid) + '"></iframe></div>';
      }).join('');
      body = '<div class="sess-cols" id="sess-cols">' + cols + '</div>';
    }
    panel.innerHTML = bar + '<div class="sess-stage-wrap">' + body + '</div>';
    var addb = el('pl-add'); if (addb) addb.onclick = addBlankSheet;
    if (mode === 'tabs') panel.querySelectorAll('.sess-tab').forEach(function (t) { t.onclick = function () { sess.active = t.getAttribute('data-sid'); rebuildPlayers(); }; });
    else wireColumnReorder();
  }
  function toolPane(tool) { var t = (sess.tabs || []).filter(function (x) { return x.tool === tool; })[0]; return t ? paneEl(t.id) : null; }
  function rebuildPlayers() { var p = toolPane('party') || activeHost() || el('sec-players'); if (p) renderPlayers(p); }
  // Display name for a hosted sheet: the character's handle/name, else the id.
  function sheetLabel(sid) {
    var r = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid), j = r && r.json;
    return (j && (j.handle || j.name)) || idOf(sid);
  }
  // Add a fresh blank character sheet to the campaign (hosted live; persists as its own file).
  function addBlankSheet() {
    if (!(sess.camp && sess.camp.createSheet)) { alert('Not connected to the campaign.'); return; }
    prompt1('New character sheet', 'Name', 'e.g. V', function (name) {
      name = (name || '').trim(); if (!name) return;
      var sid = sess.camp.createSheet(name, { name: name, handle: name });
      if (sess.order.indexOf(sid) < 0) sess.order.push(sid);
      if (sess.hosted.indexOf(sid) < 0) sess.hosted.push(sid);
      sess.active = sid;
      rebuildPlayers();
    });
  }
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
  function sessCombat() { var m = (sess.camp && sess.camp.combatMeta && sess.camp.combatMeta()) || {}; if (m.active) openCombatStage(); else if (window.Shell) Shell.switchSection('combat'); else openCombatSetup(); }

  // Push synced public locations to any open player NC-map iframe (Locations
  // section or Tools) as an overlay layer.
  function ncSyncToFrame() {
    if (sess.role !== 'player') return;
    var vs = el('view-session'); if (!vs) return;
    var locs = ovGet().locations || [];
    var msg = { type: 'nc-sync-layers', layers: locs.length ? [{ id: 'sync-camp', name: 'Campaign locations', entries: locs }] : [], maps: ovGet().locMaps || [], order: ovGet().locOrder || [], worldPlaces: ovGet().locWorld || [], worldCities: ovGet().locWorldCities || {} };
    vs.querySelectorAll('iframe').forEach(function (fr) { if (/nightcity/.test(fr.src || '') && fr.contentWindow) fr.contentWindow.postMessage(msg, '*'); });
  }
  // GM edits public locations/maps in the embedded NC planner → push to players live.
  window.addEventListener('message', function (ev) {
    var d = ev.data; if (!d) return;
    if (d.type === 'nav-key') {   // ⌘K / Esc relayed from a tool iframe (sheet/map)
      if (d.key === 'k' && window.Palette) window.Palette.toggle();
      else if (d.key === 'escape' && window.Palette && window.Palette.isOpen()) window.Palette.close();
      return;
    }
    if (d.type === 'nc-open-shop') { openShopFor('location', d.name); return; }
    if (d.type !== 'nc-gm-public') return;
    if (sess.role === 'gm' && sess.camp && sess.camp.setOverview && d.campaign === sess.id) sess.camp.setOverview({ locations: d.places || [], locMaps: d.maps || [], locOrder: d.order || [], locWorld: d.worldPlaces || [], locWorldCities: d.worldCities || {} });
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
        '<label>Scope<select id="gen-scope">' + opt('one', 'Single NPC', ctx.scope || 'one') + opt('team', 'Coherent gang', ctx.scope || 'one') + '</select></label>' +
        '<label>Count <input type="number" id="gen-count" value="' + (ctx.scope === 'team' ? 4 : 1) + '" min="1" max="12"></label>' +
      '</div>' +
      '<button class="app-btn app-btn-go" id="gen-roll">' + (ctx.onParams ? '◆ Add to encounter' : 'Generate') + '</button>' +
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
  // Readable doc name for a generated NPC (name + handle), not the archetype key.
  function npcDocName(s) { return (s && (s.handle ? (s.name + ' “' + s.handle + '”') : (s.name || s.role))) || 'NPC'; }
  function saveGeneratedNPCs(id, sheets, done) {
    Promise.all(sheets.map(function (s, i) {
      var nm = npcDocName(s) + (sheets.length > 1 ? ' ' + (i + 1) : '') + '.json';
      return api('POST', 'campaigns/' + encodeURIComponent(id) + '/npcs', { name: nm, json: s });
    })).then(done || function () {});
  }

  /* Organisation generator modal */
  var ORG_CORPS = null;
  function loadOrgDBs() {
    return Promise.all([loadCombatDBs(), ORG_CORPS ? Promise.resolve(ORG_CORPS) : fetch('data/corporations.json').then(function (r) { return r.json(); }).catch(function () { return []; })])
      .then(function (res) { ORG_CORPS = res[1] || []; return { weapons: res[0].weapons, cyber: res[0].cyber, armor: res[0].armor, corps: ORG_CORPS }; });
  }
  // ctx: { onSave(orgs) } — the caller owns persistence (Store docs). Without a
  // ctx.onSave the modal falls back to legacy name-files in the live campaign.
  function orgGenModal(ctx) {
    ctx = ctx && typeof ctx === 'object' ? ctx : {};
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
      '</div><button class="app-btn app-btn-go" id="org-roll">Generate</button><div id="org-prev" class="gen-preview"></div></div>' +
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
          if (ctx.onSave) { close(); ctx.onSave(last); return; }
          Promise.all(last.map(function (o) {
            var nm = (o.name || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36) + '.org.json';
            return api('POST', 'campaigns/' + encodeURIComponent(sess.id) + '/orgs', { name: nm, json: o });
          })).then(function () { close(); renderTabContent(); });
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
    // Squads are docs now (squads/) — fetched through the Store alongside the campaign.
    var sqP = window.Store ? Store.index('squad').then(function (rows) { return rows.map(function (r) { return r.json; }); }).catch(function () { return []; }) : Promise.resolve([]);
    Promise.all([api('GET', 'campaigns/' + encodeURIComponent(id)), sqP]).then(function (res2) {
      var d = res2[0], squadDocs = res2[1];
      var npcDocs = (d && d.docs && d.docs.npcs) || [];
      var pcs = sess.order.map(function (sid) {
        return '<label class="cbs-row"><span class="cbs-name">' + esc(sid) + ' <span class="cbs-tag">PC</span></span><input type="checkbox" data-pc="' + esc(sid) + '" checked></label>';
      }).join('');
      var npcs = npcDocs.map(function (doc) {
        var nm = doc.name;
        return '<label class="cbs-row"><span class="cbs-name">' + esc(idOf(nm)) + ' <span class="cbs-tag">NPC</span></span>' +
          '<span class="cbs-rt">×<input type="number" class="cbs-count" data-count="' + esc(nm) + '" value="1" min="1" max="20"><input type="checkbox" data-npc="' + esc(nm) + '"></span></label>';
      }).join('');
      var ov = document.createElement('div'); ov.id = 'app-modal-ov'; ov.className = 'app-modal-ov';
      ov.innerHTML = '<div class="app-modal app-modal-wide"><div class="app-modal-head">Start combat</div>' +
        '<div class="app-modal-body">' +
        (squadDocs.length ? '<div class="app-kicker">// SQUAD</div><div class="cbs-mook">Squad <select id="cbs-enc"><option value="">— none —</option>' + squadDocs.map(function (e, i) { return '<option value="' + i + '">' + esc(e.name || 'Squad') + '</option>'; }).join('') + '</select><button class="app-btn" id="cbs-encload">Load</button></div>' : '') +
        '<div class="app-kicker">// COMBATANTS</div>' + pcs + (npcs || '<div class="cd-empty">No NPCs in this campaign.</div>') +
        (window.NPCGen ? '<div class="app-kicker" style="margin-top:10px">// ARCHETYPES</div>' +
          '<button class="app-btn app-btn-go" id="cbs-gen">Generate archetype →</button><div id="cbs-gen-list" class="cbs-genlist"></div>' : '') +
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
      // Generated archetypes added straight into this encounter (incl. any queued
      // via "Add to combat" from Generators / Squad / Bestiary).
      var genExtra = (sess.pendingCombat || []).slice(); sess.pendingCombat = [];
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
        var enc = squadDocs[+idx]; if (!enc) return;
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
    renderCombatPill();
  }
  function closeCombatStage() {
    if (combatUI) { try { combatUI.destroy(); } catch (e) {} combatUI = null; }
    var ov = el('cbt-overlay'); if (ov) ov.parentNode.removeChild(ov);
    syncCombatBtn();
    // Refresh the COMBAT pane so it shows the live/resume screen, and surface a
    // persistent RESUME pill so a collapsed fight is always reachable.
    if (window.Shell && Shell.state().active === 'combat') Shell.renderTabContent();
    renderCombatPill();
  }
  // Floating RESUME pill — visible from any section while combat is live & collapsed.
  function renderCombatPill() {
    var m = (sess.camp && sess.camp.combatMeta && sess.camp.combatMeta()) || {};
    var show = sess.role === 'gm' && m.active && !el('cbt-overlay');
    var p = el('cbt-pill');
    if (!show) { if (p) p.parentNode.removeChild(p); return; }
    if (!p) { p = document.createElement('button'); p.id = 'cbt-pill'; p.className = 'cbt-pill'; document.body.appendChild(p); p.onclick = openCombatStage; }
    p.innerHTML = '◆ COMBAT LIVE · <b>Round ' + (m.round || 1) + '</b> — RESUME ▸';
  }

  /* ── Peek drawer: transient right-side preview of an entity. Esc closes,
     "Open as tab" promotes it to a real tab. One peek at a time. ── */
  var _peekEl = null;
  function ensurePeek() {
    if (_peekEl) return _peekEl;
    var d = document.createElement('div'); d.id = 'peek'; d.className = 'peek';
    d.innerHTML = '<div class="peek-back"></div>' +
      '<aside class="peek-panel" role="dialog" aria-modal="true">' +
      '<div class="peek-head"><span class="peek-kicker" id="peek-kicker"></span><button class="peek-x" id="peek-x" title="Close (Esc)">✕</button></div>' +
      '<div class="peek-body" id="peek-body"></div>' +
      '<div class="peek-foot"><button class="rt-btn rt-btn--gold" id="peek-open">Open as tab ▸</button></div></aside>';
    document.body.appendChild(d);
    d.querySelector('.peek-back').onclick = closePeek;
    el('peek-x').onclick = closePeek;
    _peekEl = d; return d;
  }
  function openPeek(opts) {
    ensurePeek();
    el('peek-kicker').textContent = opts.kicker || 'Peek';
    el('peek-body').innerHTML = opts.bodyHtml || '';
    var ob = el('peek-open');
    if (opts.onOpenTab) { ob.style.display = ''; ob.onclick = function () { var f = opts.onOpenTab; closePeek(); f(); }; } else ob.style.display = 'none';
    _peekEl.classList.add('open');
  }
  function closePeek() { if (_peekEl) _peekEl.classList.remove('open'); }
  function peekIsOpen() { return !!(_peekEl && _peekEl.classList.contains('open')); }
  function peekNpc(name) {
    openPeek({ kicker: 'NPC · ' + idOf(name), bodyHtml: '<div class="app-empty">Loading…</div>', onOpenTab: (sess.role === 'gm' ? function () { openEntity('npc', name, idOf(name)); } : function () { openTool('npc'); }) });
    fetch('/__api/campaigns/' + encodeURIComponent(sess.id) + '/npcs/' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (s) {
      s = s || {}; var statKeys = ['INT', 'REF', 'TECH', 'COOL', 'BODY', 'MA'];
      var statsHtml = s.stats ? statKeys.map(function (k) { return '<div class="rt-stat"><div class="rt-stat-l">' + k + '</div><div class="rt-stat-v">' + (s.stats[k] != null ? s.stats[k] : '—') + '</div></div>'; }).join('') : '';
      var gear = [].concat((s.weapons || []).map(function (w) { return esc(w.name || w); }), (s.cyberware || []).map(function (c) { return esc(c.name || c); }));
      var b = el('peek-body'); if (!b) return;
      b.innerHTML = '<div class="rt-head-title" style="font-size:22px">' + esc(idOf(name)) + '</div>' +
        '<div class="rt-head-sub">' + esc((s.role || 'NPC') + (s.sa ? ' · ' + s.sa : '')) + '</div>' +
        (s.notes ? '<p class="peek-notes">' + esc(s.notes) + '</p>' : '') +
        (statsHtml ? '<div class="rt-stats" style="margin:12px 0">' + statsHtml + '</div>' : '') +
        (gear.length ? '<div class="rt-field-l">Gear &amp; chrome</div>' + gear.map(function (g) { return '<div class="rt-rowline"><span>' + g + '</span></div>'; }).join('') : '');
    }).catch(function () { var b = el('peek-body'); if (b) b.innerHTML = '<div class="app-empty">Could not load.</div>'; });
  }
  function peekShop(id) {
    var s = (typeof shopById === 'function') ? shopById(id) : null; if (!s) return;
    var items = s.items || [];
    var meta = [s.kind === 'online' ? 'Online' : 'Physical', s.public ? 'Public' : 'Hidden'];
    if (s.link && s.link.type && s.link.type !== 'url' && s.link.ref) meta.push('@ ' + s.link.ref);
    var rows = items.slice(0, 16).map(function (it) {
      var price = it.price ? Math.round(it.price) + 'eb' : '';
      var stock = it.qty == null ? '' : (it.qty <= 0 ? 'sold out' : it.qty + ' left');
      return '<div class="rt-rowline"><span>' + esc(it.name || it.ref || 'Item') + '<span class="peek-dim"> · ' + esc(SHOP_CAT_LABEL[it.cat] || it.cat || '') + '</span></span>' +
        '<span>' + price + (stock ? ' <span class="peek-dim">' + stock + '</span>' : '') + '</span></div>';
    }).join('');
    openPeek({ kicker: 'Shop', onOpenTab: function () { sess.shopSel = id; openTool('shop', true); },
      bodyHtml: '<div class="rt-head-title" style="font-size:22px">' + esc(s.name || 'Shop') + '</div>' +
        '<div class="rt-head-sub">' + esc(meta.join(' · ')) + '</div>' +
        (s.pitch ? '<p class="peek-notes">' + esc(s.pitch) + '</p>' : '') +
        '<div class="rt-field-l">' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</div>' +
        (rows || '<div class="app-empty">No items yet.</div>') });
  }
  function peekLocation(name) {
    var l = shopLocations().filter(function (x) { return x.name === name; })[0] || { name: name };
    var linked = shopsLinkedTo('location', l.name) || [];
    openPeek({ kicker: 'Location', onOpenTab: function () { openTool('map'); },
      bodyHtml: '<div class="rt-head-title" style="font-size:22px">' + esc(l.name) + '</div>' +
        (l.sub ? '<div class="rt-head-sub">' + esc(l.sub) + '</div>' : '') +
        (linked.length ? '<div class="rt-field-l">Storefronts here</div>' + linked.map(function (s) { return '<div class="rt-rowline"><span>▣ ' + esc(s.name || 'Shop') + '</span></div>'; }).join('') : '<p class="peek-notes">No linked storefront.</p>') });
  }
  function peekSheet(sid) {
    var rec = sess.camp && sess.camp.getSheet && sess.camp.getSheet(idOf(sid)); var j = (rec && rec.json) || {};
    var statKeys = ['INT', 'REF', 'TECH', 'COOL', 'BODY', 'MA', 'EMP'];
    var statsHtml = j.stats ? statKeys.map(function (k) { return '<div class="rt-stat"><div class="rt-stat-l">' + k + '</div><div class="rt-stat-v">' + (j.stats[k] != null && j.stats[k] !== '' ? j.stats[k] : '—') + '</div></div>'; }).join('') : '';
    var cash = (j.lifestyle && j.lifestyle.cash != null) ? Math.round(parseFloat(j.lifestyle.cash) || 0) : null;
    var sub = [j.role, (j.handle && j.name) ? j.name : ''].filter(Boolean).join(' · ') || 'Character';
    openPeek({ kicker: 'Sheet', onOpenTab: function () { openEntity('sheet', idOf(sid), sheetLabel(sid)); },
      bodyHtml: '<div class="rt-head-title" style="font-size:22px">' + esc(sheetLabel(sid)) + '</div>' +
        '<div class="rt-head-sub">' + esc(sub) + '</div>' +
        (statsHtml ? '<div class="rt-stats" style="margin:12px 0">' + statsHtml + '</div>' : '') +
        '<div class="rt-rowline"><span>Eddies</span><span>' + (cash != null ? cash + 'eb' : '—') + '</span></div>' +
        '<div class="rt-rowline"><span>Weapons</span><span>' + (j.weapons || []).length + '</span></div>' +
        '<div class="rt-rowline"><span>Cyberware</span><span>' + (j.cyberware || []).length + '</span></div>' });
  }

  /* ── History (back/forward across tab focus) + breadcrumb ── */
  var _navJumping = false;
  function _navInit() { if (!sess.nav) sess.nav = { stack: [], i: -1 }; }
  function navRecord(id) { _navInit(); var n = sess.nav; if (n.stack[n.i] === id) return; n.stack = n.stack.slice(0, n.i + 1); n.stack.push(id); n.i = n.stack.length - 1; if (n.stack.length > 50) { n.stack.shift(); n.i--; } }
  function navCanBack() { _navInit(); return sess.nav.i > 0; }
  function navCanForward() { _navInit(); return sess.nav.i < sess.nav.stack.length - 1; }
  function _navGo(delta) {
    _navInit(); var n = sess.nav, ni = n.i, ids = (sess.tabs || []).map(function (x) { return x.id; });
    do { ni += delta; } while (ni >= 0 && ni < n.stack.length && ids.indexOf(n.stack[ni]) < 0);
    if (ni < 0 || ni >= n.stack.length) return;
    n.i = ni; _navJumping = true; sess.activeTab = n.stack[ni]; renderTabs(); _navJumping = false;
  }
  function navBack() { _navGo(-1); }
  function navForward() { _navGo(1); }
  function campName() { return (cdData && cdData.name) || (sess && sess.id) || ''; }
  function entityLabelFor(t) {
    if (!t) return '';
    if (t.kind) return t.label || idOf(t.ref);
    if (t.tool === 'party' && sess.active) return sheetLabel(sess.active);
    if (t.tool === 'shop' && sess.shopSel) { var s = shopById(sess.shopSel); return s ? s.name : ''; }
    return '';
  }
  function renderCrumbs() {
    var c = el('app-crumbs'); if (!c) return;
    if (!sess || !sess.id) { c.innerHTML = ''; return; }
    var t = activeTab();
    var toolLbl = t && t.kind ? (t.kind.charAt(0).toUpperCase() + t.kind.slice(1)) : (t && t.tool ? toolMeta(t.tool).label : (t ? 'New tab' : ''));
    var ent = entityLabelFor(t);
    var isGm = sess.role === 'gm';
    c.innerHTML = '<button class="crumb-arrow" id="crumb-b" title="Back (⌘[)"' + (navCanBack() ? '' : ' disabled') + '>‹</button>' +
      '<button class="crumb-arrow" id="crumb-f" title="Forward (⌘])"' + (navCanForward() ? '' : ' disabled') + '>›</button>' +
      '<' + (isGm ? 'a' : 'span') + ' class="crumb crumb-camp"' + (isGm ? ' id="crumb-home"' : '') + '>' + esc(campName()) + '</' + (isGm ? 'a' : 'span') + '>' +
      (toolLbl ? '<span class="crumb-sep">▸</span><span class="crumb">' + esc(toolLbl) + '</span>' : '') +
      (ent ? '<span class="crumb-sep">▸</span><span class="crumb crumb-ent">' + esc(ent) + '</span>' : '');
    if (el('crumb-b')) el('crumb-b').onclick = navBack;
    if (el('crumb-f')) el('crumb-f').onclick = navForward;
    if (el('crumb-home')) el('crumb-home').onclick = function () { renderCampaigns(); };
  }

  /* ── Command palette bridge + global keyboard shortcuts ── */
  // The palette (js/palette.js) is a standalone overlay; it pulls a fresh, flat
  // command list from here each time it opens. Selecting an item runs its `run`.
  /* One command list for BOTH the ⌘K palette and the sidebar search.
     Entities come from the Shell's live Store index (Shell.corpusEntities) —
     the same corpus the DATA section renders — never from legacy prep()/docs. */
  window.AppNav = {
    ready: function () { return !!(sess && sess.id); },
    commands: function () {
      var out = []; if (!sess || !sess.id) return out;
      if (window.Shell) Shell.sectionDefs().forEach(function (s, i) {
        if (s.disabled) return;
        out.push({ group: 'Sections', label: s.label, sub: '⌘' + (i + 1), run: function () { Shell.openSection(s.key); } });
      });
      if (window.Shell && Shell.openDataTab) {
        out.push({ group: 'Views', label: 'Contacts', sub: 'from the sheets', run: function () { Shell.openDataTab({ tool: 'data-view', dtype: 'npc', builtin: 'contacts', label: 'Contacts' }); } });
        out.push({ group: 'Views', label: 'Database', sub: 'lore reference', run: function () { Shell.openDataTab({ tool: 'data-db', label: 'DATABASE' }); } });
      }
      try {
        ((window.Shell && Shell.corpusEntities && Shell.corpusEntities()) || []).forEach(function (e) {
          out.push({ group: e.group, label: e.label, sub: e.sub, run: function () { Shell.openEntity(e.type, e.id, e.label); } });
        });
      } catch (e) {}
      try { (sess.order || []).forEach(function (sid) { out.push({ group: 'Sheets', label: sheetLabel(sid), sub: 'player sheet', run: function () { openEntity('sheet', idOf(sid), sheetLabel(sid)); }, peek: function () { peekSheet(sid); } }); }); } catch (e) {}
      out.push({ group: 'Actions', label: 'New tab', sub: '⌘T', run: navNewTab });
      out.push({ group: 'Actions', label: 'Journal', sub: 'session log', run: function () { if (window.Shell) Shell.openLogDrawer(); } });
      out.push({ group: 'Actions', label: 'Settings', sub: 'sidebar · party layout', run: function () { if (window.Shell) Shell.settingsModal(); } });
      out.push({ group: 'Actions', label: 'Keyboard shortcuts', sub: 'cheat sheet', run: function () { if (window.Shell && Shell.shortcutsModal) Shell.shortcutsModal(); } });
      out.push({ group: 'Actions', label: 'Sourcebooks', sub: 'PDF reader', run: function () { if (window.openReaderApp) window.openReaderApp(); } });
      if (sess.role === 'gm') {
        out.push({ group: 'Actions', label: 'Share player links', sub: 'join links', run: shareLinks });
        if (sess.camp && sess.camp.setPaused) out.push({ group: 'Actions', label: sess.camp.isPaused() ? 'Resume session' : 'Pause session', sub: 'players see a PAUSED banner', run: function () { var p = !sess.camp.isPaused(); sess.camp.setPaused(p); saveSessionMeta(sess.id, { paused: p }); renderSessionShell(); } });
      }
      return out;
    }
  };
  // In the Electron app, ⌘T/⌘W/⌘⇧T/⌘K come through the native menu (below) so they
  // aren't swallowed by window accelerators; in a plain browser we handle them here.
  var _menuNav = !!(window.bartmoss && window.bartmoss.onNavShortcut);
  if (_menuNav) window.bartmoss.onNavShortcut(function (action) {
    if (action === 'palette') { if (window.Palette) window.Palette.toggle(); return; }
    if (!sess || !sess.id) return;
    if (action === 'newtab') navNewTab(); else if (action === 'closetab') navCloseActive(); else if (action === 'reopen') navReopen();
  });
  // Keyboard is owned by the Shell (⌘1..6 sections, ⌃Tab tabs, ⌘T/W/⇧T, ⌘K).
  // Only the peek-drawer Escape stays here (peek internals live in this file).
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && peekIsOpen()) { closePeek(); return; }
  });

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
