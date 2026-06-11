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
  var mode = q.get('mode'); // 'send' = push local sheet; else receive GM's copy
  if (!campaign || !sheetId || !S) return; // local mode

  var camp = null;
  var applyingRemote = false;
  var lastLocalAt = 0, lastAppliedAt = 0, pendingRemote = null, publishTimer = null;
  var mainReady = false, isSynced = false, bound = false;
  var lastPublishedJson = null; // last serialized CS we sent — skip no-op publishes

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
    try { lastPublishedJson = JSON.stringify(window.CS); } catch (e) { lastPublishedJson = null; }
    applyingRemote = false;
  }

  function publishLocal() {
    if (applyingRemote || !camp || !window.CS) return;
    if (typeof window.collectState === 'function') window.collectState();
    window.CS._id = sheetId;
    var s; try { s = JSON.stringify(window.CS); } catch (e) { s = null; }
    if (s !== null && s === lastPublishedJson) return; // nothing actually changed
    lastPublishedJson = s;
    lastLocalAt = camp.publishSheet(sheetId, window.CS.handle || window.CS.name || 'PC', window.CS);
    lastAppliedAt = lastLocalAt;
  }
  // Debounced; short so any interaction reflects within ~300ms.
  function schedulePublish() { clearTimeout(publishTimer); publishTimer = setTimeout(publishLocal, 300); }

  function maybeApplyRemote() {
    if (!camp) return;
    var rec = camp.getSheet(sheetId);
    if (!rec || rec.updatedAt <= lastAppliedAt) return;   // our echo or stale
    if (isEditingSheet()) { pendingRemote = rec; return; } // don't clobber typing
    loadIntoApp(rec);
  }

  function doBind() {
    var rec = camp.getSheet(sheetId);
    if (mode === 'send' && window.CS && typeof window.CS === 'object') {
      // "Send my sheet": push the player's local build, overwriting any GM copy,
      // then sync live. main.js loaded the local active sheet into window.CS.
      window.CS._id = sheetId;
      lastLocalAt = camp.publishSheet(sheetId, window.CS.handle || window.CS.name || 'PC', window.CS);
      lastAppliedAt = lastLocalAt;
      try { lastPublishedJson = JSON.stringify(window.CS); } catch (e) { lastPublishedJson = null; }
    } else {
      if (!rec) { // genuinely new (GM hasn't created it) → seed from what we have
        var json = (window.CS && typeof window.CS === 'object') ? window.CS : window.makeBlankCS();
        json._id = sheetId;
        lastLocalAt = camp.publishSheet(sheetId, json.handle || json.name || 'PC', json);
        lastAppliedAt = lastLocalAt;
        rec = camp.getSheet(sheetId);
      }
      loadIntoApp(rec); // receive / default: the GM's copy wins on connect
    }
    camp.onSheetsChange(maybeApplyRemote);
    // Listen at the DOCUMENT level (capture) so EVERY interaction triggers a
    // publish — including ones outside .cs: settings modal, lifestyle controls,
    // any button-driven mutation, dropdowns, etc. publishLocal() no-ops when
    // nothing actually changed, so over-triggering is cheap.
    // 'input' covers all text/number/checkbox edits; 'change' covers selects;
    // 'click' covers button-driven mutations (add skill, lifestyle, etc.).
    // 'keyup' was redundant with 'input' and just doubled the event volume.
    document.addEventListener('input', schedulePublish, true);
    document.addEventListener('change', schedulePublish, true);
    document.addEventListener('click', schedulePublish, true);
    document.addEventListener('focusout', function () {
      if (pendingRemote && !isEditingSheet()) { var r = pendingRemote; pendingRemote = null; if (r.updatedAt > lastAppliedAt) loadIntoApp(r); }
    }, true);
    // Safety net for purely programmatic CS changes (timers, async) that emit no
    // DOM event. publishLocal() no-ops when nothing changed, so a relaxed 4s
    // interval is plenty and keeps idle sheets cheap.
    setInterval(publishLocal, 4000);
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
    // GM-side editor iframes pass ?as=gm so they aren't counted as players.
    var asRole = q.get('as') === 'gm' ? 'gm' : 'player';
    camp = S.join({ url: wsUrl(), room: campaign, member: { name: asRole === 'gm' ? 'GM' : 'Player', role: asRole } });
    camp.onStatus(function (st) {
      var b = document.getElementById('cs-join-banner'); if (!b) return;
      if (st === 'connected') { b.style.background = '#1a7a2e'; b.textContent = 'CONNECTED · campaign "' + campaign + '" · live sync'; }
      else { b.style.background = '#b8860b'; b.textContent = (st || 'connecting') + ' · campaign "' + campaign + '"'; }
    });
    camp.onSynced(function () { isSynced = true; tryBind(); });
    setTimeout(function () { isSynced = true; tryBind(); }, 5000); // fallback: offline / hub down
    // GM can pause the session — show a prominent banner (sync keeps running).
    if (camp.onPaused) camp.onPaused(showPaused);
  }

  function showPaused(paused) {
    var id = 'cs-paused-overlay';
    var ex = document.getElementById(id);
    if (!paused) { if (ex) ex.parentNode.removeChild(ex); return; }
    if (ex) return;
    var o = document.createElement('div');
    o.id = id;
    o.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b8860b;color:#111;font-family:var(--head,sans-serif);letter-spacing:6px;font-size:18px;text-align:center;padding:8px;box-shadow:0 2px 10px rgba(0,0,0,.4);';
    o.textContent = 'PAUSED';
    document.body.insertBefore(o, document.body.firstChild);
  }

  // main.js calls this at the end of its init() in joined mode (deterministic).
  window.__csJoinReady = function () { mainReady = true; tryBind(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
