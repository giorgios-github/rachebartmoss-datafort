/* campaign-doc.js — file-bridge for editing a campaign document in its tool.
   Activates when a tool page is opened with ?cdoc=1&cid=<campaign>&ctype=<type>&cname=<file>.
   Flow: GET the file from the hub API → hand it to the tool's adapter
   (window.__cdocAdapter = { load(obj), serialize() }) → on any change, PUT the
   serialized doc back (debounced, de-duped). No-op if the params/adapter aren't present.
   English UI. */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  if (q.get('cdoc') !== '1') return;
  var cid = q.get('cid'), ctype = q.get('ctype'), cname = q.get('cname');
  if (!cid || !ctype || !cname) return;
  window.__cdoc = true; // tools read this to skip their localStorage load/save

  var base = '/__api/campaigns/' + encodeURIComponent(cid) + '/' + encodeURIComponent(ctype) + '/' + encodeURIComponent(cname);
  var pendingJson = null, fetched = false, applied = false, lastSaved = null, saveTimer = null;

  function stable(o) { try { return JSON.stringify(o); } catch (e) { return null; } }

  function banner(text, ok) {
    var b = document.getElementById('cdoc-banner');
    if (!b) {
      b = document.createElement('div'); b.id = 'cdoc-banner';
      b.style.cssText = 'background:#1a7a2e;color:#fff;font-family:var(--mono,monospace);font-size:12px;letter-spacing:1px;padding:5px 14px;text-align:center;';
      document.body.insertBefore(b, document.body.firstChild);
    }
    b.style.background = ok === false ? '#c0392b' : (ok === 'idle' ? '#b8860b' : '#1a7a2e');
    b.textContent = text;
  }

  function save() {
    var ad = window.__cdocAdapter; if (!ad || !applied) return;
    var obj; try { obj = ad.serialize(); } catch (e) { return; }
    var s = stable(obj); if (s == null || s === lastSaved) return;
    lastSaved = s;
    banner('Editing "' + cname + '" · saving…', 'idle');
    fetch(base, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: s })
      .then(function (r) { banner('Editing "' + cname + '" · saved', r.ok); }, function () { banner('Editing "' + cname + '" · save failed', false); });
  }
  function schedule() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

  function maybeApply() {
    if (applied || !fetched || !window.__cdocAdapter) return;
    applied = true;
    try { window.__cdocAdapter.load(pendingJson || {}); } catch (e) {}
    try { lastSaved = stable(window.__cdocAdapter.serialize()); } catch (e) { lastSaved = null; }
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    document.addEventListener('click', schedule, true);
    document.addEventListener('keyup', schedule, true);
    setInterval(save, 2000); // safety net for programmatic changes
    banner('Editing "' + cname + '" · live to campaign');
  }

  function start() {
    banner('Loading "' + cname + '"…', 'idle');
    fetch(base).then(function (r) { return r.ok ? r.text() : ''; }).then(function (txt) {
      try { pendingJson = txt ? JSON.parse(txt) : {}; } catch (e) { pendingJson = {}; }
      fetched = true; maybeApply();
    }, function () { fetched = true; pendingJson = {}; maybeApply(); });
    // The tool registers window.__cdocAdapter at the end of its init — poll for it.
    var poll = setInterval(function () { if (window.__cdocAdapter) { maybeApply(); if (applied) clearInterval(poll); } }, 100);
    setTimeout(function () { clearInterval(poll); }, 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
