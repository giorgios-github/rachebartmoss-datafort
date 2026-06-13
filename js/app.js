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
    state.campaignId = id; state.type = 'sheets';
    endSessionConn();
    setMode('manage');
    showView('view-campaign');
    el('app-crumbs').innerHTML = '<a id="crumb-home">Campaigns</a> <span class="crumb-sep">/</span> <span class="crumb-cur">' + esc(id) + '</span>';
    renderCampaignDetail();
  }

  function renderCampaignDetail() {
    var id = state.campaignId;
    api('GET', 'campaigns/' + encodeURIComponent(id)).then(function (d) {
      var meta = (d && d.meta) || {};
      var tabs = TYPES.map(function (t) {
        var n = (d.docs && d.docs[t.key] ? d.docs[t.key].length : 0);
        return '<div class="cd-tab' + (t.key === state.type ? ' active' : '') + '" data-type="' + t.key + '">' +
          '<span class="cd-tab-ico">' + t.icon + '</span>' + t.label + ' <span class="cd-count">' + n + '</span></div>';
      }).join('');
      el('view-campaign').innerHTML =
        '<div class="cd-head">' +
          '<button class="app-btn cd-back" id="cd-back">← CAMPAIGNS</button>' +
          '<div class="cd-titlewrap"><div class="app-kicker">// CAMPAIGN</div><h2 class="app-h">' + esc(meta.name || id) + '</h2></div>' +
          '<span style="flex:1"></span>' +
          '<button class="app-btn app-btn-go" id="cd-session" title="Host the sheets for players">▶ GO LIVE</button></div>' +
        '<div class="cd-tabs">' + tabs + '</div>' +
        '<div id="cd-body"></div>';
      var crumb = el('crumb-home'); if (crumb) crumb.onclick = renderCampaigns;
      el('cd-back').onclick = renderCampaigns;
      el('view-campaign').querySelectorAll('.cd-tab').forEach(function (t) {
        t.onclick = function () {
          state.type = t.getAttribute('data-type');
          // Move the active highlight to the clicked tab (was stuck because the
          // tab strip wasn't re-rendered on a type switch).
          el('view-campaign').querySelectorAll('.cd-tab').forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
          renderType(d);
        };
      });
      el('cd-session').onclick = function () { startSessionPicker(id, (d.docs && d.docs.sheets) || [], (meta.session && meta.session.order) || []); };
      renderType(d);
    });
  }

  function renderType(detail) {
    var id = state.campaignId, type = state.type;
    var items = (detail.docs && detail.docs[type]) || [];
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
      s.onclick = function () { openDocEditor(id, type, s.getAttribute('data-edit')); };
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
  var sess = { camp: null, id: null, role: 'gm', sheetId: null, section: 'overview', hosted: [], order: [], cols: {}, hub: null, mode: 'grid', active: null, panelOpen: true };
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

  function startSessionPicker(id, sheetDocs, prevOrder) {
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
      saveSessionMeta(id, { active: true, paused: false, hosted: hosted, order: order }).then(function () { openSession(id, hosted, order); });
    };
  }

  /* ── Session shell (4-section sidebar, shared GM + player) ── */
  var SESS_TOOLS = [
    { tool: 'npcsheet', label: 'NPC Sheet', url: 'npc-sheet.html', icon: '☗' },
    { tool: 'ncmap', label: 'Night City', url: 'nightcity.html', icon: '◰' },
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

  function openSession(id, hosted, order) {
    sess.id = id; sess.role = 'gm'; sess.hosted = hosted; sess.order = order.slice(); sess.cols = {};
    sess.active = sess.order[0] || null; sess.section = 'overview';
    setMode('active'); showView('view-session');
    el('app-crumbs').innerHTML = '<a id="crumb-home">Campaigns</a> <span class="crumb-sep">/</span> <a id="crumb-camp">' + esc(id) + '</a> <span class="crumb-sep">/</span> <span class="crumb-cur">session</span>';
    var crumbH = el('crumb-home'); if (crumbH) crumbH.onclick = function () { renderCampaigns(); };
    var crumbC = el('crumb-camp'); if (crumbC) crumbC.onclick = function () { openCampaign(id); };
    joinSession(id, { name: 'GM', role: 'gm' });
    renderSessionShell();
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
    if (sess.camp.onOverview) sess.camp.onOverview(function () { refreshOverviewText(); });
  }

  function sessSections() {
    return sess.role === 'gm'
      ? [{ k: 'overview', label: 'Overview' }, { k: 'players', label: 'Players' }, { k: 'tools', label: 'Tools' }, { k: 'files', label: 'Files' }]
      : [{ k: 'overview', label: 'Overview' }, { k: 'livesheet', label: 'Live-sheet' }, { k: 'tools', label: 'Tools' }, { k: 'files', label: 'Files' }];
  }
  function renderSessionShell() {
    var paused = sess.camp && sess.camp.isPaused && sess.camp.isPaused();
    var nav = sessSections().map(function (s) {
      return '<button class="sess-nav' + (s.k === sess.section ? ' active' : '') + '" data-sec="' + s.k + '">' + s.label + '</button>';
    }).join('');
    var ctrls = sess.role === 'gm'
      ? '<button class="app-btn" id="sess-share">⇄ Share</button><button class="app-btn" id="sess-pause">' + (paused ? 'Resume' : 'Pause') + '</button><button class="app-btn app-btn-danger" id="sess-end">End</button>'
      : '<button class="app-btn app-btn-danger" id="sess-leave">Leave</button>';
    el('view-session').innerHTML =
      '<div class="sess-top"><span class="sess-live">● LIVE</span><span class="sess-title">' + esc(sess.id) + '</span>' +
        '<span class="sess-headact" id="sess-actions"></span><span style="flex:1"></span>' + ctrls + '</div>' +
      '<div id="sess-paused-bar">' + (paused ? '<div class="sess-paused">SESSION PAUSED — players see a PAUSED banner. Sync continues.</div>' : '') + '</div>' +
      '<div class="sess-shell"><nav class="sess-side">' + nav + '</nav><div class="sess-content" id="sess-content"></div></div>';
    el('view-session').querySelectorAll('.sess-nav').forEach(function (b) { b.onclick = function () { gotoSection(b.getAttribute('data-sec')); }; });
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
    el('view-session').querySelectorAll('.sess-nav').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sec') === key); });
    var content = el('sess-content'); if (!content) return;
    sessSections().forEach(function (s) {
      var pid = 'sec-' + s.k, panel = el(pid);
      if (!panel) { panel = document.createElement('div'); panel.id = pid; panel.className = 'sess-sec'; content.appendChild(panel); }
      panel.hidden = (s.k !== key);
    });
    var panel = el('sec-' + key);
    if (key === 'overview') renderOverview(panel);          // always refresh (dynamic)
    else if (!panel.dataset.built) { buildSection(key, panel); panel.dataset.built = '1'; }
  }
  function buildSection(key, panel) {
    if (key === 'players') return renderPlayers(panel);
    if (key === 'livesheet') return renderLivesheet(panel);
    if (key === 'tools') return renderTools(panel);
    if (key === 'files') return renderFiles(panel);
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
          '</div>' +
        '</div>';
      if (gm) {
        // Edit → persist to meta.json AND push live to the synced overview.
        var dsc = el('ov-desc'); if (dsc) dsc.oninput = function () { saveCampaignMeta(id, { description: dsc.value }); sess.camp.setOverview({ description: dsc.value }); };
        var nts = el('ov-notes'); if (nts) nts.oninput = function () { saveCampaignMeta(id, { playerNotes: nts.value }); sess.camp.setOverview({ playerNotes: nts.value }); };
      }
      wirePins(panel);
      updatePresenceFromCamp(); updateOverviewActions();
    });
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
    var h = el('sess-actions'); if (h) h.textContent = m.active ? '⚔ COMBAT' : '';
    var cc = el('ov-combat-chip'); if (cc) cc.hidden = !m.active;
  }

  /* Players (GM) — grid (default) / tab / columns of the hosted sheets. */
  function frameSrc(sid) { return 'cs.html?campaign=' + encodeURIComponent(sess.id) + '&sheet=' + encodeURIComponent(sid) + '&as=gm'; }
  function sheetPhoto(sid) { var r = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid); return (r && r.json && r.json.photo) || ''; }
  function renderPlayers(panel) {
    if (!panel) return;
    var mode = sess.mode || 'grid';
    if (sess.order.indexOf(sess.active) < 0) sess.active = sess.order[0] || null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var bar = '<div class="sess-secbar"><div class="app-kicker">// PLAYERS</div><span style="flex:1"></span>' +
      '<div class="sess-modes">' +
        '<button class="app-btn sess-mode' + (mode === 'grid' ? ' active' : '') + '" data-mode="grid">Grid</button>' +
        '<button class="app-btn sess-mode' + (mode === 'tabs' ? ' active' : '') + '" data-mode="tabs">Tabs</button>' +
        '<button class="app-btn sess-mode' + (mode === 'columns' ? ' active' : '') + '" data-mode="columns">Columns</button>' +
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
    panel.innerHTML = '<div class="app-kicker">// TOOLS</div><div class="tool-menu-grid sess-tools-grid">' + combat + tiles + '</div>' +
      '<div class="tools-frame" id="tools-frame" hidden>' +
        '<div class="tools-frame-bar"><span class="tools-frame-name" id="tools-frame-name"></span><button class="app-btn" id="tools-frame-close">✕ Close</button></div>' +
        '<div class="tools-frame-host" id="tools-frame-host"></div></div>';
    panel.querySelectorAll('[data-toolurl]').forEach(function (b) {
      b.onclick = function () {
        var url = b.getAttribute('data-toolurl'), name = b.querySelector('.tool-card-title').textContent;
        el('tools-frame-name').textContent = name;
        el('tools-frame-host').innerHTML = '<iframe src="' + esc(url) + '"></iframe>';
        el('tools-frame').hidden = false;
      };
    });
    // Close by removing the iframe node (setting src='about:blank' tripped an
    // Electron renderer debug scenario).
    el('tools-frame-close').onclick = function () { el('tools-frame-host').innerHTML = ''; el('tools-frame').hidden = true; };
    var cb = panel.querySelector('[data-combat]');
    if (cb) cb.onclick = function () { var m = (sess.camp && sess.camp.combatMeta && sess.camp.combatMeta()) || {}; if (m.active) openCombatStage(); else openCombatSetup(); };
    syncCombatBtn();
  }

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
      '<button class="app-btn app-btn-go" id="gen-roll">◆ Generate</button>' +
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
