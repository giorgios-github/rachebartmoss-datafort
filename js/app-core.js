/* app-core.js — shared foundation for the reworked GM app shell.
   Exposes window.App: DOM/string helpers, hub API, event bus, campaign
   context, serialized meta writes (fixes the GET-merge-PUT race), per-campaign
   UI memory (meta.ui), and the section registry the Shell renders from.
   Loaded before every other app-*.js module; app.js (boot) consumes it. */
(function () {
  'use strict';

  /* ── helpers ── */
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(id) { return document.getElementById(id); }
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function reduceMotion() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function debounce(fn, ms) { var t = null; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }

  /* ── hub API ── */
  function api(method, path, body) {
    return fetch('/__api/' + path, {
      method: method,
      headers: body != null ? { 'content-type': 'application/json' } : {},
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      return ct.indexOf('json') >= 0 ? r.json() : r.text();
    });
  }

  /* ── event bus ── */
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return function () { off(ev, fn); }; }
  function off(ev, fn) { var l = listeners[ev]; if (!l) return; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
  function emit(ev, data) { (listeners[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error('[App bus] ' + ev, e); } }); }

  /* ── campaign context ── */
  var ctx = { cid: null, role: 'gm', meta: null };
  function setCampaign(cid, role) { ctx.cid = cid; ctx.role = role || 'gm'; ctx.meta = null; emit('campaign', { cid: cid, role: ctx.role }); }

  /* ── serialized meta writes ──
     saveCampaignMeta was GET-merge-PUT with no ordering: two overlapping saves
     could resurrect stale fields. All meta writes now chain on a per-campaign
     promise queue, and the merged meta is cached on ctx to spare a GET when we
     already hold a fresh copy. */
  var metaQueue = {};
  function saveMeta(fields, cid) {
    cid = cid || ctx.cid;
    if (!cid) return Promise.reject(new Error('no campaign'));
    var prev = metaQueue[cid] || Promise.resolve();
    var next = prev.then(function () {
      return api('GET', 'campaigns/' + encodeURIComponent(cid)).then(function (d) {
        var meta = (d && d.meta) || {};
        Object.assign(meta, typeof fields === 'function' ? fields(meta) : fields);
        return api('PUT', 'campaigns/' + encodeURIComponent(cid), meta).then(function () {
          if (cid === ctx.cid) ctx.meta = meta;
          return meta;
        });
      });
    });
    // Keep the chain alive even after a failure (log, don't wedge the queue).
    metaQueue[cid] = next.catch(function (e) { console.error('[App.saveMeta]', e); });
    return next;
  }
  function getMeta(force) {
    if (!ctx.cid) return Promise.reject(new Error('no campaign'));
    if (ctx.meta && !force) return Promise.resolve(ctx.meta);
    return api('GET', 'campaigns/' + encodeURIComponent(ctx.cid)).then(function (d) {
      ctx.meta = (d && d.meta) || {};
      return ctx.meta;
    });
  }

  /* ── per-campaign UI memory (meta.ui) ──
     Shape: { activeSection, sections:{key:{tabs:[…],active}}, dataTree:{expanded},
              viewState:{type:{mode,sort,filters}}, ficheScroll:{ref:px}, dataOrder:{} }
     Mutations go through uiSet(path, value); persistence is debounced and
     rides the serialized queue. uiGet reads the local copy synchronously. */
  var uiCache = null;
  function uiLoad(meta) { uiCache = (meta && meta.ui) || {}; return uiCache; }
  function uiGet(path, dflt) {
    var cur = uiCache || {};
    var parts = path ? path.split('.') : [];
    for (var i = 0; i < parts.length; i++) { if (cur == null || typeof cur !== 'object') return dflt; cur = cur[parts[i]]; }
    return cur === undefined ? dflt : cur;
  }
  var uiFlush = debounce(function () {
    var snapshot = uiCache;
    saveMeta(function (meta) { return { ui: Object.assign({}, meta.ui, snapshot) }; });
  }, 600);
  function uiSet(path, value) {
    if (!uiCache) uiCache = {};
    var parts = path.split('.'), cur = uiCache;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    uiFlush();
  }

  /* ── section registry ──
     Shell renders from this. def: { icon, label, order, roles:['gm','player'],
     render(host), disabled? } */
  var sections = {};
  function register(key, def) { sections[key] = Object.assign({ key: key, roles: ['gm'] }, def); }
  function sectionList(role) {
    return Object.keys(sections).map(function (k) { return sections[k]; })
      .filter(function (s) { return s.roles.indexOf(role || ctx.role) >= 0; })
      .sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
  }

  /* UI.modal-backed prompt — window.prompt() is disabled in Electron. */
  function promptModal(title, label, initial, cb) {
    if (!window.UI) { var v = null; try { v = window.prompt(label, initial || ''); } catch (e) {} if (v != null) cb(v); return; }
    window.UI.modal({
      title: title,
      body: '<label class="ui-field-label">' + esc(label) + '</label><input id="app-core-prompt" class="ui-input" value="' + esc(initial || '') + '">',
      actions: [
        { label: 'Cancel' },
        { label: 'OK', kind: 'primary', onClick: function (box) { cb(box.querySelector('#app-core-prompt').value); } },
      ],
      onShow: function (box) {
        var inp = box.querySelector('#app-core-prompt'); inp.focus(); inp.select();
        inp.onkeydown = function (e) { if (e.key === 'Enter') { var v = inp.value; window.UI.close(); cb(v); } };
      }
    });
  }

  window.App = {
    esc: esc, el: el, uid: uid, reduceMotion: reduceMotion, debounce: debounce,
    prompt: promptModal,
    api: api,
    on: on, off: off, emit: emit,
    ctx: ctx, setCampaign: setCampaign,
    saveMeta: saveMeta, getMeta: getMeta,
    uiLoad: uiLoad, uiGet: uiGet, uiSet: uiSet,
    register: register, sections: sections, sectionList: sectionList,
  };
})();
