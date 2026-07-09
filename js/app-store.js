/* app-store.js — typed entity layer over the hub JSON API.
   Every campaign entity is a file under /campaigns/:cid/:type/. This layer
   gives the app one vocabulary: refs are {type, id}. Filenames stay
   human-readable; the id lives INSIDE the JSON and meta.idIndex maps
   "type:id" → filename so refs survive renames.
   Sheets are special: their JSON belongs to the Yjs sync — Store never
   writes into a sheet file; refs to sheets use {type:'sheet', id:<basename>}.
   Depends on window.App (app-core.js). */
(function () {
  'use strict';
  var App = window.App;

  // Entity types the Store manages (doc dir + whether Store may write files).
  var TYPES = {
    npc:      { dir: 'npcs',      writable: true },
    org:      { dir: 'orgs',      writable: true },
    location: { dir: 'locations', writable: true },
    shop:     { dir: 'shops',     writable: true },
    item:     { dir: 'items',     writable: true },
    cast:     { dir: 'casts',     writable: true },
    clock:    { dir: 'clocks',    writable: true },
    rule:     { dir: 'rules',     writable: true }, // CAST reactive triggers (docs/cast-triggers-design.md)
    squad:    { dir: 'squads',    writable: true },
    site:     { dir: 'sites',     writable: true },
    sheet:    { dir: 'sheets',    writable: false }, // Yjs owns the content
  };

  /* ── caches ──
     lists[type]  = { at, items:[{name,size,mtime}] }        (dir listing)
     docs["type/file"] = { mtime, json }                     (hydrated file)
     idIndex["type:id"] = filename          (persisted in meta.idIndex) */
  var lists = {}, docs = {}, idIndex = {};
  var LIST_TTL = 4000; // ms — cheap staleness guard; mtime does real invalidation

  function cid() { return App.ctx.cid; }
  function dirOf(type) { var t = TYPES[type]; if (!t) throw new Error('Store: unknown type ' + type); return t.dir; }
  function baseName(f) { return String(f || '').replace(/\.json$/i, ''); }
  function keyOf(ref) { return ref.type + ':' + ref.id; }
  function isSkip(name) { return name.charAt(0) === '_' || name.charAt(0) === '.'; }

  function listRaw(type, force) {
    var c = lists[type];
    if (c && !force && Date.now() - c.at < LIST_TTL) return Promise.resolve(c.items);
    return App.api('GET', 'campaigns/' + encodeURIComponent(cid()) + '/' + dirOf(type)).then(function (d) {
      var items = ((d && d.items) || []).filter(function (it) { return !isSkip(it.name); });
      lists[type] = { at: Date.now(), items: items };
      return items;
    });
  }

  function getFile(type, name) {
    var key = dirOf(type) + '/' + name;
    return listRaw(type).then(function (items) {
      var entry = items.filter(function (it) { return it.name === name; })[0];
      var cached = docs[key];
      if (cached && entry && cached.mtime === entry.mtime) return cached.json;
      return App.api('GET', 'campaigns/' + encodeURIComponent(cid()) + '/' + dirOf(type) + '/' + encodeURIComponent(name)).then(function (json) {
        if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { json = {}; } }
        docs[key] = { mtime: entry ? entry.mtime : Date.now(), json: json };
        return json;
      });
    });
  }

  function putFile(type, name, json) {
    if (!TYPES[type].writable) return Promise.reject(new Error('Store: ' + type + ' is read-only'));
    return App.api('PUT', 'campaigns/' + encodeURIComponent(cid()) + '/' + dirOf(type) + '/' + encodeURIComponent(name), JSON.stringify(json, null, 2))
      .then(function (r) {
        if (r && r.error) throw new Error('hub: ' + r.error + ' (hub trop ancien ? relancer le hub après mise à jour)');
        docs[dirOf(type) + '/' + name] = { mtime: Date.now(), json: json };
        lists[type] = null; // force re-list (new mtime)
        App.emit('entity:saved', { type: type, name: name, json: json });
        return json;
      });
  }

  /* ── idIndex ── */
  function idIndexLoad(meta) { idIndex = (meta && meta.idIndex) || {}; }
  function idIndexSet(ref, filename) {
    idIndex[keyOf(ref)] = filename;
    App.saveMeta(function (meta) {
      var ix = Object.assign({}, meta.idIndex);
      ix[keyOf(ref)] = filename;
      return { idIndex: ix };
    });
  }

  /* ── public: index / get / create / put / del / resolve ── */

  // index(type): hydrated list [{ref, name(file), json}] — batch-fetches only
  // files whose mtime changed. This is what Views renders from.
  function index(type, force) {
    return listRaw(type, force).then(function (items) {
      return Promise.all(items.map(function (it) {
        return getFile(type, it.name).then(function (json) {
          if (type === 'sheet') return { ref: { type: 'sheet', id: baseName(it.name) }, file: it.name, mtime: it.mtime || 0, json: json };
          return { ref: { type: type, id: json.id || null }, file: it.name, mtime: it.mtime || 0, json: json };
        }).catch(function () { return null; });
      })).then(function (rows) { return rows.filter(Boolean); });
    });
  }

  // resolve({type,id}) → {file, json} | null. idIndex fast path, then scan
  // (heals the index), then legacy name-fallback with a loud warning.
  function resolve(ref) {
    if (!ref || !ref.type) return Promise.resolve(null);
    if (ref.type === 'sheet') {
      var fname = ref.id + (/\.json$/i.test(ref.id) ? '' : '.json');
      return getFile('sheet', fname).then(function (json) { return { file: fname, json: json }; }).catch(function () { return null; });
    }
    var hinted = idIndex[keyOf(ref)];
    var attempt = hinted ? getFile(ref.type, hinted).then(function (json) {
      if (json && json.id === ref.id) return { file: hinted, json: json };
      return null;
    }).catch(function () { return null; }) : Promise.resolve(null);
    return attempt.then(function (hit) {
      if (hit) return hit;
      return index(ref.type).then(function (rows) {
        var row = rows.filter(function (r) { return r.json && r.json.id === ref.id; })[0];
        if (row) { idIndexSet(ref, row.file); return { file: row.file, json: row.json }; }
        // Legacy fallback: ref.id may be an old name-ref not yet converted.
        var byName = rows.filter(function (r) { return baseName(r.file) === ref.id || (r.json && r.json.name === ref.id); })[0];
        if (byName) { console.warn('[Store.resolve] name-fallback hit for', ref, '→', byName.file, '(ref should be migrated)'); return { file: byName.file, json: byName.json }; }
        return null;
      });
    });
  }

  function create(type, json) {
    json = json || {};
    if (!json.id) json.id = App.uid(type.slice(0, 3));
    if (!json.props || typeof json.props !== 'object') json.props = {};
    var nm = (json.name || json.handle || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
    var fname = nm + '-' + json.id + '.json';
    return putFile(type, fname, json).then(function () {
      idIndexSet({ type: type, id: json.id }, fname);
      return { ref: { type: type, id: json.id }, file: fname, json: json };
    });
  }

  function put(ref, json) {
    return resolve(ref).then(function (hit) {
      if (!hit) throw new Error('Store.put: unresolved ref ' + keyOf(ref));
      return putFile(ref.type, hit.file, json);
    });
  }

  function del(ref) {
    return resolve(ref).then(function (hit) {
      if (!hit) return false;
      return App.api('DELETE', 'campaigns/' + encodeURIComponent(cid()) + '/' + dirOf(ref.type) + '/' + encodeURIComponent(hit.file)).then(function () {
        delete docs[dirOf(ref.type) + '/' + hit.file];
        delete idIndex[keyOf(ref)];
        lists[ref.type] = null;
        App.emit('entity:deleted', { ref: ref });
        // Links sweep is owned by Links (app-links.js) via this event.
        return true;
      });
    });
  }

  /* ── display helpers ── */
  function displayName(row) {
    var j = row.json || {};
    return j.name || j.handle || (j.role ? j.role : '') || baseName(row.file);
  }
  function photoOf(row) {
    var j = row.json || {};
    return j.photo || j.logo || '';
  }

  /* ── typed custom properties (registry in meta.props) ── */
  var propsReg = null;
  function propsLoad(meta) {
    propsReg = Array.isArray(meta && meta.props) ? meta.props.slice() : [];
    if (!propsReg.some(function (p) { return p.key === 'contact'; })) {
      propsReg.unshift({ key: 'contact', type: 'bool', system: true });
    }
    if (!propsReg.some(function (p) { return p.key === 'public'; })) {
      propsReg.unshift({ key: 'public', type: 'bool', system: true });
    }
    return propsReg;
  }
  // Player-side visibility: public entities, plus contacts (a contact the party
  // has IS known to the party — that's what makes it a contact).
  function visibleToPlayers(json) {
    var p = (json && json.props) || {};
    return !!(p.public || p.contact);
  }
  function propsList() { return propsReg || []; }
  function propsAdd(key, type) {
    key = String(key || '').trim(); if (!key) return Promise.resolve(null);
    if (['bool', 'number', 'string'].indexOf(type) < 0) type = 'string';
    if (propsList().some(function (p) { return p.key === key; })) return Promise.resolve(null);
    var def = { key: key, type: type };
    propsReg.push(def);
    return App.saveMeta(function (meta) {
      var list = Array.isArray(meta.props) ? meta.props.slice() : [];
      if (!list.some(function (p) { return p.key === key; })) list.push(def);
      return { props: list };
    }).then(function () { App.emit('props:changed'); return def; });
  }
  function coerce(def, raw) {
    if (!def) return raw;
    if (def.type === 'bool') return raw === true || raw === 'true' || raw === 1;
    if (def.type === 'number') { var n = parseFloat(raw); return isNaN(n) ? null : n; }
    return raw == null ? '' : String(raw);
  }
  function setProp(ref, key, raw) {
    var def = propsList().filter(function (p) { return p.key === key; })[0];
    return resolve(ref).then(function (hit) {
      if (!hit) throw new Error('Store.setProp: unresolved ref');
      if (!hit.json.props || typeof hit.json.props !== 'object') hit.json.props = {};
      hit.json.props[key] = coerce(def, raw);
      return putFile(ref.type, hit.file, hit.json);
    });
  }

  function invalidate(type) { if (type) { lists[type] = null; } else { lists = {}; docs = {}; } }

  window.Store = {
    TYPES: TYPES,
    index: index, resolve: resolve, create: create, put: put, del: del,
    displayName: displayName, photoOf: photoOf,
    idIndexLoad: idIndexLoad, idIndexSet: idIndexSet,
    propsLoad: propsLoad, propsList: propsList, propsAdd: propsAdd, setProp: setProp, coerce: coerce,
    visibleToPlayers: visibleToPlayers,
    invalidate: invalidate,
  };
})();
