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
  if (sheetId) sheetId = sheetId.replace(/(\.json)+$/i, '');   // never publish a .json-suffixed doc id (avoids Foo.json.json files)
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
    try {
      // Merge whatever the remote has onto a full blank template, so a partial sheet (e.g. a GM
      // Party seed of just {name,handle}) always arrives structurally complete — otherwise applyCS
      // throws on the missing skills map and live publishing stalls.
      var base = window.makeBlankCS();
      var json = (rec && rec.json && Object.keys(rec.json).length) ? Object.assign(base, rec.json) : base;
      json._id = sheetId;
      window.CS = json;
      window.SHEETS = [json];
      window.csActiveIdx = 0;
      if (typeof window.applyCS === 'function') window.applyCS();
      lastAppliedAt = (rec && rec.updatedAt) || Date.now();
      try { lastPublishedJson = JSON.stringify(window.CS); } catch (e) { lastPublishedJson = null; }
    } finally {
      // CRITICAL: never leave this stuck true — if applyCS() throws, publishLocal() would
      // early-return forever and the sheet would silently stop saving.
      applyingRemote = false;
    }
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
    // Joining mid-combat: the initial sync may have landed before our observer —
    // check once now so the player transitions straight into the combat view.
    syncCombatState();
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
    // Players use their sheet id as the presence name so the session shell and
    // this Live-sheet iframe (two connections from one player) dedupe to one.
    var asRole = q.get('as') === 'gm' ? 'gm' : 'player';
    camp = S.join({ url: wsUrl(), room: campaign, member: { name: asRole === 'gm' ? 'GM' : sheetId, role: asRole } });
    camp.onStatus(function (st) {
      var b = document.getElementById('cs-join-banner'); if (!b) return;
      if (st === 'connected') { b.style.background = '#1a7a2e'; b.textContent = 'CONNECTED · campaign "' + campaign + '" · live sync'; }
      else { b.style.background = '#b8860b'; b.textContent = (st || 'connecting') + ' · campaign "' + campaign + '"'; }
    });
    camp.onSynced(function () { isSynced = true; tryBind(); });
    setTimeout(function () { isSynced = true; tryBind(); }, 5000); // fallback: offline / hub down
    // GM can pause the session — show a prominent banner (sync keeps running).
    if (camp.onPaused) camp.onPaused(showPaused);
    // Combat: when the GM starts one, every player transitions to the combat
    // overlay (resorbable — collapse back to the sheet, reopen via the button).
    if (camp.onCombatChange) camp.onCombatChange(syncCombatState);
    // Expose the campaign-wide media marketplace (Control Room offers) to the Press Card.
    if (camp.getOverview) {
      var pushMarket = function () {
        try { window.__mediaMarket = (camp.getOverview() || {}).regie || null; } catch (e) {}
        var sec = document.getElementById('press-section');
        var focused = sec && document.activeElement && sec.contains(document.activeElement);
        if (window.renderPress && !focused) { try { window.renderPress(); } catch (e) {} }
      };
      pushMarket();
      if (camp.onOverview) camp.onOverview(pushMarket);
    }
  }

  /* ── Combat overlay (player) ── */
  var combatUI = null, combatWasActive = false;
  function combatActive() {
    var m = (camp && camp.combatMeta && camp.combatMeta()) || {};
    return !!m.active;
  }
  function syncCombatState() {
    // GM session-dashboard columns (?as=gm) keep showing the normal sheet — the
    // GM runs combat from the main stage, so these editing iframes must NOT
    // auto-flip to the combat overlay (otherwise collapsing combat would reveal
    // combat overlays in every column instead of the players' sheets).
    if (q.get('as') === 'gm') return;
    var active = combatActive();
    var btn = document.getElementById('cs-combat-btn');
    if (active) {
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'cs-combat-btn';
        btn.textContent = '◆ COMBAT';
        btn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9000;background:#c0392b;color:#fff;border:2px solid #7e2419;font-family:var(--head,sans-serif);letter-spacing:2px;font-size:14px;padding:10px 18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4);';
        btn.onclick = openCombatOverlay;
        document.body.appendChild(btn);
      }
      if (!combatWasActive) openCombatOverlay(); // auto-transition on combat start
    } else {
      if (btn) btn.parentNode.removeChild(btn);
      closeCombatOverlay();
    }
    combatWasActive = active;
  }
  function openCombatOverlay() {
    if (document.getElementById('cs-combat-overlay') || !window.CombatUI) return;
    var ov = document.createElement('div');
    ov.id = 'cs-combat-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9500;background:var(--bg,#efefef);display:flex;flex-direction:column;';
    ov.innerHTML = '<div style="background:#111;color:#fff;display:flex;align-items:center;gap:12px;padding:8px 14px;flex-shrink:0;">' +
      '<span style="font-family:var(--head,sans-serif);letter-spacing:3px;font-size:14px;color:#e07b6f">◆ COMBAT</span>' +
      '<span style="font-size:11px;color:#999;letter-spacing:1px">campaign "' + campaign + '"</span>' +
      '<button id="cs-combat-collapse" style="margin-left:auto;font-family:var(--mono,monospace);font-size:12px;padding:5px 12px;border:1px solid #555;background:#1a1a1a;color:#ddd;cursor:pointer">▾ Back to my sheet</button></div>' +
      '<div id="cs-combat-mount" style="flex:1;min-height:0"></div>';
    document.body.appendChild(ov);
    combatUI = window.CombatUI.mount(document.getElementById('cs-combat-mount'), { camp: camp, role: 'player', selfSheetId: sheetId });
    document.getElementById('cs-combat-collapse').onclick = closeCombatOverlay;
  }
  function closeCombatOverlay() {
    if (combatUI) { try { combatUI.destroy(); } catch (e) {} combatUI = null; }
    var ov = document.getElementById('cs-combat-overlay'); if (ov) ov.parentNode.removeChild(ov);
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
