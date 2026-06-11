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
      // C6: player gets the full toolkit served by the hub, plus a CONNECT
      // button (main.js injects it on ?player=1) to receive/send a sheet.
      location.href = 'index.html?player=1';
    }
  };
  window.switchRole = function () { try { localStorage.removeItem(ROLE_KEY); } catch (e) {} location.reload(); };

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
    ['view-campaigns', 'view-campaign', 'view-session'].forEach(function (v) {
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
    el('cd-body').innerHTML =
      '<div class="cd-actions">' +
        '<button class="app-btn" id="cd-new">+ New ' + type.replace(/s$/, '') + '</button>' +
        (hasFolder ? '<button class="app-btn" id="cd-folder">Import a folder…</button>' : '') +
      '</div>' +
      '<div class="cd-drop" id="cd-drop"><span class="cd-drop-tag">IMPORT BAY</span> Drag &amp; drop ' + type + ' files here</div>' +
      '<div class="cd-list">' + list + '</div>';

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
    showOverlay(name, '<iframe class="cdoc-frame" src="' + url + '"></iframe>');
  }
  function openTextEditor(id, name) {
    fetch('/__api/campaigns/' + encodeURIComponent(id) + '/documents/' + encodeURIComponent(name)).then(function (r) { return r.text(); }).then(function (txt) {
      showOverlay(name, '<textarea class="cdoc-textarea" id="cdoc-ta"></textarea>');
      var ta = el('cdoc-ta'); ta.value = txt; var t;
      ta.oninput = function () { clearTimeout(t); t = setTimeout(function () { fetch('/__api/campaigns/' + encodeURIComponent(id) + '/documents/' + encodeURIComponent(name), { method: 'PUT', body: ta.value }); }, 400); };
    });
  }
  function showOverlay(title, innerHtml) {
    var ov = document.createElement('div'); ov.className = 'cdoc-overlay'; ov.id = 'cdoc-overlay';
    ov.innerHTML = '<div class="cdoc-bar"><span class="cdoc-title">' + esc(title) + '</span><button class="app-btn" id="cdoc-close">Close</button></div>' + innerHtml;
    document.body.appendChild(ov);
    el('cdoc-close').onclick = function () { document.body.removeChild(ov); renderCampaignDetail(); };
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
  var sess = { camp: null, id: null, hosted: [], order: [], cols: {}, hub: null, mode: 'columns', active: null, panelOpen: true };
  try { var m = localStorage.getItem(SESS_MODE_KEY); if (m === 'tabs' || m === 'columns') sess.mode = m; } catch (e) {}
  function idOf(docName) { return String(docName).replace(/\.json$/i, ''); }
  function playerLink(sid) {
    var h = sess.hub || { host: location.hostname, port: location.port };
    return 'http://' + h.host + ':' + h.port + '/cs.html?campaign=' + encodeURIComponent(sess.id) + '&sheet=' + encodeURIComponent(sid);
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

  function openSession(id, hosted, order) {
    sess.id = id; sess.hosted = hosted; sess.order = order.slice(); sess.cols = {};
    sess.active = sess.order[0] || null;
    setMode('active');
    showView('view-session');
    el('app-crumbs').innerHTML = '<a id="crumb-home">Campaigns</a> <span class="crumb-sep">/</span> <a id="crumb-camp">' + esc(id) + '</a> <span class="crumb-sep">/</span> <span class="crumb-cur">session</span>';
    if (sess.camp) { try { sess.camp.destroy(); } catch (e) {} }
    sess.camp = window.BartmossSync.join({ url: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host, room: id, member: { name: 'GM', role: 'gm' } });
    // Fetch LAN host/port so the Share panel can hand real links to players.
    fetch('/__hubinfo').then(function (r) { return r.json(); }).then(function (h) { sess.hub = h; }).catch(function () {});
    renderSession();
    sess.camp.onPresence(updatePresence);
    sess.camp.onStatus(function (st) { var e = el('app-status'); if (e) { e.textContent = st === 'connected' ? 'Hub · live' : st; e.className = 'app-status' + (st === 'connected' ? ' on' : ''); } });
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
      '<div class="app-modal-body"><p style="font-size:12px;color:#666;margin:0 0 10px">Players on the same Wi-Fi open their link in a browser. Each sheet has its own link.</p>' +
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
  function setSessMode(mode) {
    sess.mode = mode; try { localStorage.setItem(SESS_MODE_KEY, mode); } catch (e) {}
    renderSession();
  }

  // Fill the PLAYERS side panel + the toggle count. Targeted DOM update — never
  // re-renders the session (which would reload every iframe).
  function updatePresence(peers) {
    peers = peers || [];
    var players = peers.filter(function (p) { return p && p.member && p.member.role === 'player'; });
    var n = players.length;
    var cnt = el('sess-pcount'); if (cnt) cnt.textContent = n;
    var listEl = el('sess-players-list'); if (!listEl) return;
    if (!n) { listEl.innerHTML = '<div class="sess-noone">No players connected yet.<br>Share a link to invite them.</div>'; return; }
    listEl.innerHTML = players.map(function (p) {
      var nm = (p.member && p.member.name) || 'Player';
      return '<div class="sess-player"><span class="sess-dot"></span><span class="sess-pname">' + esc(nm) + '</span><span class="sess-prole">PLAYER</span></div>';
    }).join('');
  }

  function frameSrc(sid) { return 'cs.html?campaign=' + encodeURIComponent(sess.id) + '&sheet=' + encodeURIComponent(sid) + '&as=gm'; }

  function renderSession() {
    var id = sess.id, paused = sess.camp && sess.camp.isPaused && sess.camp.isPaused();
    if (sess.order.indexOf(sess.active) < 0) sess.active = sess.order[0] || null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var body;
    if (sess.mode === 'tabs') {
      var tabs = sess.order.map(function (sid) {
        return '<div class="sess-tab' + (sid === sess.active ? ' active' : '') + '" data-sid="' + esc(sid) + '">' + esc(sid) + '</div>';
      }).join('');
      body = '<div class="sess-tabbar" id="sess-tabbar">' + tabs + '</div>' +
        '<div class="sess-tabbody">' + (sess.active ? '<iframe class="sess-col-frame" src="' + frameSrc(sess.active) + '"></iframe>' : '<div class="cd-empty">No sheets hosted.</div>') + '</div>';
    } else {
      var cols = sess.order.map(function (sid, i) {
        return '<div class="sess-col" data-sid="' + esc(sid) + '" draggable="true">' +
          '<div class="sess-col-head"><span class="sess-col-idx">' + pad(i + 1) + '</span><span class="sess-col-name">' + esc(sid) + '</span><span class="sess-col-grab">⠿</span></div>' +
          '<iframe class="sess-col-frame" src="' + frameSrc(sid) + '"></iframe></div>';
      }).join('');
      body = '<div class="sess-cols" id="sess-cols">' + (cols || '<div class="cd-empty">No sheets hosted.</div>') + '</div>';
    }
    el('view-session').innerHTML =
      '<div class="sess-bar">' +
        '<span class="sess-live">● LIVE</span>' +
        '<span class="sess-title">' + esc(id) + '</span>' +
        '<span style="flex:1"></span>' +
        '<button class="app-btn sess-pbtn" id="sess-players-toggle"><span class="sess-dot"></span> PLAYERS <span class="sess-pcount" id="sess-pcount">0</span></button>' +
        '<div class="sess-modes"><button class="app-btn sess-mode' + (sess.mode === 'columns' ? ' active' : '') + '" data-mode="columns">Columns</button>' +
          '<button class="app-btn sess-mode' + (sess.mode === 'tabs' ? ' active' : '') + '" data-mode="tabs">Tabs</button></div>' +
        '<button class="app-btn" id="sess-pause">' + (paused ? 'Resume' : 'Pause') + '</button>' +
        '<button class="app-btn app-btn-danger" id="sess-end">End session</button>' +
      '</div>' +
      '<div id="sess-banner">' + (paused ? '<div class="sess-paused">SESSION PAUSED — players see a PAUSED banner. Sync continues.</div>' : '') + '</div>' +
      '<div class="sess-stage' + (sess.panelOpen ? ' panel-open' : '') + '" id="sess-stage">' +
        '<div class="sess-main">' + body + '</div>' +
        '<aside class="sess-panel" id="sess-panel">' +
          '<div class="sess-panel-head">[ PLAYERS ]</div>' +
          '<div class="sess-players-list" id="sess-players-list"></div>' +
          '<button class="app-btn sess-panel-share" id="sess-share">⇄ Share links</button>' +
        '</aside>' +
      '</div>';
    var crumbH = el('crumb-home'); if (crumbH) crumbH.onclick = function () { renderCampaigns(); };
    var crumbC = el('crumb-camp'); if (crumbC) crumbC.onclick = function () { openCampaign(id); };
    el('view-session').querySelectorAll('.sess-mode').forEach(function (b) { b.onclick = function () { setSessMode(b.getAttribute('data-mode')); }; });
    el('sess-share').onclick = shareLinks;
    el('sess-players-toggle').onclick = function () {
      sess.panelOpen = !sess.panelOpen;
      el('sess-stage').classList.toggle('panel-open', sess.panelOpen);
    };
    // Toggle pause WITHOUT re-rendering (a full render reloads every iframe).
    el('sess-pause').onclick = function () {
      if (!(sess.camp && sess.camp.setPaused)) return;
      paused = !paused;
      sess.camp.setPaused(paused);
      saveSessionMeta(id, { paused: paused });
      el('sess-pause').textContent = paused ? 'Resume' : 'Pause';
      el('sess-banner').innerHTML = paused ? '<div class="sess-paused">SESSION PAUSED — players see a PAUSED banner. Sync continues.</div>' : '';
    };
    el('sess-end').onclick = function () { confirm1('End the session? Player sheets are already saved to the campaign.', function () { saveSessionMeta(id, { active: false }).then(function () { if (sess.camp && sess.camp.setPaused) sess.camp.setPaused(false); openCampaign(id); }); }); };
    if (sess.mode === 'tabs') {
      el('view-session').querySelectorAll('.sess-tab').forEach(function (t) {
        t.onclick = function () { sess.active = t.getAttribute('data-sid'); renderSession(); };
      });
    } else {
      wireColumnReorder();
    }
    updatePresenceFromCamp();
  }
  function updatePresenceFromCamp() { if (sess.camp && sess.camp.getPeers) updatePresence(sess.camp.getPeers()); }
  function endSessionConn() { if (sess.camp) { try { sess.camp.destroy(); } catch (e) {} sess.camp = null; } }

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

  /* ── boot ── */
  // Connection status for the header (shares the hub the app is served from).
  try {
    if (window.BartmossSync) {
      var c = window.BartmossSync.join({ url: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host, room: 'main', member: { name: 'GM', role: 'gm' } });
      c.onStatus(function (st) { var e = el('app-status'); if (e) { e.textContent = st === 'connected' ? 'Hub · live' : st; e.className = 'app-status' + (st === 'connected' ? ' on' : ''); } });
    }
  } catch (e) {}
  // pre-highlight last role
  try { var last = localStorage.getItem(ROLE_KEY); if (last) { var r = document.querySelector('.rc-role[onclick*="' + last + '"]'); if (r) r.style.borderColor = '#b8860b'; } } catch (e) {}
})();
