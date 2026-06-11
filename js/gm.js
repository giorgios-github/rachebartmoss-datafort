/* GM dashboard — live roster + integrated tabbed editor.
   - "Roster" tab: one card per sheet (deduped by id) with player links.
   - One tab per sheet: embeds the full character sheet in joined mode (an
     iframe of cs.html?campaign&sheet), so the GM edits any sheet live, in sync
     with that player. Iframes are created lazily and kept alive when hidden. */
(function () {
  'use strict';

  var S = window.BartmossSync;
  var q = new URLSearchParams(location.search);
  var campaign = q.get('campaign') || 'main';
  var camp = null;
  var LINK_BASE = location.origin;       // replaced with LAN address from /__hubinfo
  var activeTab = 'roster';              // 'roster' | sheetId
  var frames = {};                       // sheetId -> iframe element

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function wsUrl() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host; }
  function playerLink(id) { return LINK_BASE + '/cs.html?campaign=' + encodeURIComponent(campaign) + '&sheet=' + encodeURIComponent(id); }
  function setStatus(txt, on) { var el = document.getElementById('gm-status'); if (el) { el.textContent = txt; el.className = 'gm-status' + (on ? ' on' : ''); } }

  function isJunkId(id) { return /^nc-/.test(String(id || '')); } // legacy Phase-0 mirror ids
  function sheetsDeduped() {
    var byId = {};
    (camp ? camp.allSheets() : []).forEach(function (r) { if (!isJunkId(r.id)) byId[r.id] = r; });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  /* ── tab strip ── */
  function renderTabs() {
    var strip = document.getElementById('gm-tabs'); if (!strip) return;
    var sheets = sheetsDeduped();
    var html = '<div class="gm-tab' + (activeTab === 'roster' ? ' active' : '') + '" data-tab="roster">Roster</div>';
    html += sheets.map(function (r) {
      return '<div class="gm-tab' + (activeTab === r.id ? ' active' : '') + '" data-tab="' + esc(r.id) + '">' + esc(r.name || r.id) + '</div>';
    }).join('');
    strip.innerHTML = html;
    strip.querySelectorAll('.gm-tab').forEach(function (t) { t.onclick = function () { showTab(t.getAttribute('data-tab')); }; });
  }

  function showTab(tab) {
    activeTab = tab;
    var roster = document.getElementById('gm-roster');
    roster.classList.toggle('active', tab === 'roster');
    // the iframe layer overlays the roster — only show it on a sheet tab
    document.getElementById('gm-frames').classList.toggle('active', tab !== 'roster');
    // lazily create + toggle iframes
    if (tab !== 'roster') ensureFrame(tab);
    Object.keys(frames).forEach(function (id) { frames[id].classList.toggle('active', id === tab); });
    renderTabs();
    if (tab === 'roster') renderRoster();
  }

  function ensureFrame(id) {
    if (frames[id]) return frames[id];
    var host = document.getElementById('gm-frames');
    var fr = document.createElement('iframe');
    fr.src = 'cs.html?campaign=' + encodeURIComponent(campaign) + '&sheet=' + encodeURIComponent(id);
    fr.setAttribute('title', 'sheet ' + id);
    host.appendChild(fr);
    frames[id] = fr;
    return fr;
  }

  /* ── roster cards ── */
  function sheetCard(rec) {
    var j = rec.json || {};
    var stats = j.stats || {};
    var statLine = ['INT', 'REF', 'TECH', 'COOL', 'ATT', 'LUCK', 'MA', 'BODY', 'EMP']
      .map(function (k) { return k + ' ' + (stats[k] != null ? stats[k] : '—'); }).join('  ');
    return '<div class="gm-card">' +
      '<div class="gm-card-head"><span class="gm-card-name">' + esc(rec.name || j.handle || j.name || '(unnamed)') + '</span>' +
        (j.role ? '<span class="gm-card-role">' + esc(j.role) + '</span>' : '') + '</div>' +
      '<div class="gm-card-stats">' + esc(statLine) + '</div>' +
      '<div class="gm-card-actions">' +
        '<button class="gm-btn" data-edit="' + esc(rec.id) + '">Edit here</button>' +
        '<a class="gm-btn" href="' + playerLink(rec.id) + '" target="_blank" rel="noopener">Open</a>' +
        '<button class="gm-btn" data-link="' + esc(rec.id) + '">Copy player link</button>' +
      '</div>' +
      '<div class="gm-card-id">' + esc(rec.id) + '</div></div>';
  }
  function renderRoster() {
    var host = document.getElementById('gm-roster-grid'); if (!host || !camp) return;
    var sheets = sheetsDeduped();
    if (!sheets.length) { host.innerHTML = '<div class="gm-empty">No sheets yet. Create one, or have a player join with a link.</div>'; return; }
    host.innerHTML = sheets.map(sheetCard).join('');
    host.querySelectorAll('button[data-edit]').forEach(function (b) { b.onclick = function () { showTab(b.getAttribute('data-edit')); }; });
    host.querySelectorAll('button[data-link]').forEach(function (b) {
      b.onclick = function () {
        var link = playerLink(b.getAttribute('data-link'));
        navigator.clipboard.writeText(link).then(
          function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy player link'; }, 1200); },
          function () { _gmCopyBox('Player link', link); });
      };
    });
  }

  function renderAll() { renderTabs(); if (activeTab === 'roster') renderRoster(); }

  function renderShare(info) {
    var el = document.getElementById('gm-share'); if (!el) return;
    el.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:8px;';
    el.innerHTML =
      '<span style="color:#666;font-size:11px;">Players join at <b>http://' + esc(info.host) + ':' + esc(info.port) + '</b></span>' +
      '<button class="gm-btn" id="gm-copyall">Copy all player links</button>';
    var btn = document.getElementById('gm-copyall');
    if (btn) btn.onclick = function () {
      var lines = sheetsDeduped().map(function (r) { return (r.name || r.id) + ': ' + playerLink(r.id); }).join('\n');
      navigator.clipboard.writeText(lines).then(
        function () { btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy all player links'; }, 1200); },
        function () { _gmCopyBox('Player links', lines); });
    };
  }

  /* In-app modal — Electron disables window.prompt, so we never use it. */
  function gmModalClose() { var ov = document.getElementById('gm-modal-ov'); if (ov) ov.parentNode.removeChild(ov); }
  function gmPrompt(title, placeholder, onOk) {
    gmModalClose();
    var ov = document.createElement('div');
    ov.id = 'gm-modal-ov'; ov.className = 'gm-modal-ov';
    ov.innerHTML = '<div class="gm-modal"><div class="gm-modal-head">' + esc(title) + '</div>' +
      '<input id="gm-modal-input" class="gm-modal-input" placeholder="' + esc(placeholder || '') + '">' +
      '<div class="gm-modal-actions"><button class="gm-btn" data-x>Cancel</button><button class="gm-btn gm-modal-ok" data-ok>OK</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) gmModalClose(); };
    document.body.appendChild(ov);
    var input = ov.querySelector('#gm-modal-input');
    input.focus();
    function commit() { var v = input.value; gmModalClose(); onOk(v); }
    ov.querySelector('[data-ok]').onclick = commit;
    ov.querySelector('[data-x]').onclick = gmModalClose;
    input.onkeydown = function (e) { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') gmModalClose(); };
  }
  function gmCopyBox(title, text) {
    gmModalClose();
    var ov = document.createElement('div');
    ov.id = 'gm-modal-ov'; ov.className = 'gm-modal-ov';
    ov.innerHTML = '<div class="gm-modal"><div class="gm-modal-head">' + esc(title) + '</div>' +
      '<textarea class="gm-modal-input" rows="4" readonly>' + esc(text) + '</textarea>' +
      '<div class="gm-modal-actions"><button class="gm-btn" data-x>Close</button></div></div>';
    ov.onclick = function (e) { if (e.target === ov) gmModalClose(); };
    document.body.appendChild(ov);
    var ta = ov.querySelector('textarea'); ta.focus(); ta.select();
    ov.querySelector('[data-x]').onclick = gmModalClose;
  }
  // expose for the copy fallbacks
  window._gmCopyBox = gmCopyBox;

  window.gmNewSheet = function () {
    if (!camp) return;
    gmPrompt('New character', 'character name', function (name) {
      var id = camp.createSheet((name || '').trim() || 'New character', {});
      setTimeout(function () { showTab(id); }, 150); // open the new sheet's editor
    });
  };

  function init() {
    if (!S) { setStatus('Sync library missing', false); return; }
    document.getElementById('gm-campaign').textContent = campaign;
    fetch('/__hubinfo').then(function (r) { return r.json(); }).then(function (info) {
      if (info && info.host) { LINK_BASE = 'http://' + info.host + ':' + info.port; renderShare(info); if (activeTab === 'roster') renderRoster(); }
    }).catch(function () {});

    camp = S.join({ url: wsUrl(), room: campaign, member: { name: 'GM', role: 'gm' } });
    setStatus('connecting…', false);
    camp.onStatus(function (st) { setStatus(st === 'connected' ? 'Live · connected' : st, st === 'connected'); });
    camp.onSynced(renderAll);
    camp.onSheetsChange(renderAll);
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
