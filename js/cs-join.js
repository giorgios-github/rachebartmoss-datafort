/* cs-join — joined (campaign) mode for the character sheet.
   Activates only when cs.html is opened with ?campaign=<code>&sheet=<id> (the
   link the GM hands a player, or a GM dashboard editor iframe). Binds that one
   sheet to the live campaign: local edits publish to the hub, remote edits
   apply back. No-op in normal local mode. English UI.

   Ordering matters: main.js's init() runs AFTER an async loadData(), so it
   would clobber an early bind. We therefore bind only once BOTH are true:
   (1) main.js init done — it calls window.__csJoinReady(); and
   (2) the hub initial sync completed. */
(function () {
  'use strict';
  var S = window.BartmossSync;
  var q = new URLSearchParams(location.search);
  var campaign = q.get('campaign');
  var sheetId = q.get('sheet');
  if (!campaign || !sheetId || !S) return; // local mode

  var camp = null;
  var applyingRemote = false;
  var lastLocalAt = 0, lastAppliedAt = 0, pendingRemote = null, publishTimer = null;
  var mainReady = false, isSynced = false, bound = false;

  function wsUrl() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host; }
  function isEditingSheet() { var ae = document.activeElement; return !!(ae && ae.closest && ae.closest('.cs')); }

  function loadIntoApp(rec) {
    applyingRemote = true;
    var json = (rec && rec.json && Object.keys(rec.json).length) ? rec.json : window.makeBlankCS();
    json._id = sheetId;
    window.CS = json;
    window.SHEETS = [json];
    window.csActiveIdx = 0;
    if (typeof window.applyCS === 'function') window.applyCS();
    lastAppliedAt = (rec && rec.updatedAt) || Date.now();
    applyingRemote = false;
  }

  function publishLocal() {
    if (applyingRemote || !camp || !window.CS) return;
    if (typeof window.collectState === 'function') window.collectState();
    window.CS._id = sheetId;
    lastLocalAt = camp.publishSheet(sheetId, window.CS.handle || window.CS.name || 'PC', window.CS);
    lastAppliedAt = lastLocalAt;
  }
  function schedulePublish() { clearTimeout(publishTimer); publishTimer = setTimeout(publishLocal, 500); }

  function maybeApplyRemote() {
    if (!camp) return;
    var rec = camp.getSheet(sheetId);
    if (!rec || rec.updatedAt <= lastAppliedAt) return;   // our echo or stale
    if (isEditingSheet()) { pendingRemote = rec; return; } // don't clobber typing
    loadIntoApp(rec);
  }

  function doBind() {
    var rec = camp.getSheet(sheetId);
    if (!rec) { // genuinely new (GM hasn't created it / player pushing a build)
      var json = (window.CS && typeof window.CS === 'object') ? window.CS : window.makeBlankCS();
      json._id = sheetId;
      lastLocalAt = camp.publishSheet(sheetId, json.handle || json.name || 'PC', json);
      lastAppliedAt = lastLocalAt;
      rec = camp.getSheet(sheetId);
    }
    loadIntoApp(rec);
    camp.onSheetsChange(maybeApplyRemote);
    var cs = document.querySelector('.cs');
    if (cs) {
      cs.addEventListener('input', schedulePublish, true);
      cs.addEventListener('change', schedulePublish, true);
      cs.addEventListener('focusout', function () {
        if (pendingRemote && !isEditingSheet()) { var r = pendingRemote; pendingRemote = null; if (r.updatedAt > lastAppliedAt) loadIntoApp(r); }
      }, true);
    }
  }
  function tryBind() { if (bound || !mainReady || !isSynced) return; bound = true; doBind(); }

  function banner() {
    var b = document.createElement('div');
    b.id = 'cs-join-banner';
    b.style.cssText = 'background:#1a7a2e;color:#fff;font-family:var(--mono,monospace);font-size:12px;letter-spacing:1px;padding:5px 14px;text-align:center;';
    b.textContent = 'CONNECTED · campaign "' + campaign + '" · live sync';
    document.body.insertBefore(b, document.body.firstChild);
    var tabs = document.getElementById('cs-tabs'); if (tabs) tabs.style.display = 'none';
    document.querySelectorAll('#topnav button').forEach(function (btn) {
      var oc = btn.getAttribute('onclick') || '';
      if (oc.indexOf('csNew') >= 0 || oc.indexOf('cs-load') >= 0) btn.style.display = 'none';
    });
  }

  function start() {
    banner();
    camp = S.join({ url: wsUrl(), room: campaign, member: { name: 'Player', role: 'player' } });
    camp.onStatus(function (st) {
      var b = document.getElementById('cs-join-banner'); if (!b) return;
      if (st === 'connected') { b.style.background = '#1a7a2e'; b.textContent = 'CONNECTED · campaign "' + campaign + '" · live sync'; }
      else { b.style.background = '#b8860b'; b.textContent = (st || 'connecting') + ' · campaign "' + campaign + '"'; }
    });
    camp.onSynced(function () { isSynced = true; tryBind(); });
    setTimeout(function () { isSynced = true; tryBind(); }, 5000); // fallback: offline / hub down
  }

  // main.js calls this at the end of its init() in joined mode (deterministic).
  window.__csJoinReady = function () { mainReady = true; tryBind(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
