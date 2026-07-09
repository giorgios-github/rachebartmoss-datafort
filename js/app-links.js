/* app-links.js — the central links registry + the ONE fiche band.
   All cross-entity relations live in campaigns/:cid/links/_links.json:
     [{ id, from:{type,id}, to:{type,id}, label, inverseLabel }]
   Reciprocal & nameable: the band shows outgoing links with `label` and
   incoming ones with `inverseLabel` (falling back to "label" + ←).
   PJ (sheets) are linkable — the registry never touches sheet JSON.
   Links are also queryable as view properties (Links.labelsFor).
   Depends on window.App + window.Store. */
(function () {
  'use strict';
  var App = window.App, Store = window.Store;
  var FILE = '_links.json';
  var cache = null; // array | null

  function cid() { return encodeURIComponent(App.ctx.cid); }
  function sameRef(a, b) { return a && b && a.type === b.type && String(a.id) === String(b.id); }

  function loadAll(force) {
    if (cache && !force) return Promise.resolve(cache);
    return App.api('GET', 'campaigns/' + cid() + '/links/' + FILE).then(function (j) {
      if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { j = []; } }
      cache = Array.isArray(j) ? j : [];
      return cache;
    }).catch(function () { cache = []; return cache; });
  }
  function saveAll() {
    return App.api('PUT', 'campaigns/' + cid() + '/links/' + FILE, JSON.stringify(cache || [], null, 2))
      .then(function () { App.emit('links:changed'); return cache; });
  }

  /* linksOf(ref) → [{link, dir:'out'|'in', other:{type,id}, shownLabel}] */
  function linksOf(ref) {
    return loadAll().then(function (rows) {
      var out = [];
      rows.forEach(function (l) {
        if (sameRef(l.from, ref)) out.push({ link: l, dir: 'out', other: l.to, shownLabel: l.label || 'linked to' });
        else if (sameRef(l.to, ref)) out.push({ link: l, dir: 'in', other: l.from, shownLabel: l.inverseLabel || ((l.label || 'linked to') + ' ←') });
      });
      return out;
    });
  }

  function add(from, to, label, inverseLabel) {
    return loadAll().then(function () {
      var row = { id: App.uid('lk'), from: from, to: to, label: (label || '').trim() || 'linked to', inverseLabel: (inverseLabel || '').trim() };
      cache.push(row);
      return saveAll().then(function () { return row; });
    });
  }
  function remove(linkId) {
    return loadAll().then(function () {
      cache = cache.filter(function (l) { return l.id !== linkId; });
      return saveAll();
    });
  }
  // sweep: drop every link touching a deleted entity
  function sweep(ref) {
    return loadAll().then(function () {
      var before = cache.length;
      cache = cache.filter(function (l) { return !sameRef(l.from, ref) && !sameRef(l.to, ref); });
      return before === cache.length ? Promise.resolve(cache) : saveAll();
    });
  }
  App.on('entity:deleted', function (e) { if (e && e.ref) sweep(e.ref); });

  /* For Views: the set of link labels usable as filter/sort columns, and a
     per-ref summary {label: [otherRefs…]} resolved synchronously from cache. */
  function labelsFor() {
    return loadAll().then(function (rows) {
      var set = {};
      rows.forEach(function (l) { if (l.label) set[l.label] = 1; if (l.inverseLabel) set[l.inverseLabel] = 1; });
      return Object.keys(set).sort();
    });
  }
  function summaryFor(ref) {
    if (!cache) return {};
    var out = {};
    cache.forEach(function (l) {
      if (sameRef(l.from, ref)) (out[l.label || 'linked to'] = out[l.label || 'linked to'] || []).push(l.to);
      else if (sameRef(l.to, ref)) { var lb = l.inverseLabel || ((l.label || 'linked to') + ' ←'); (out[lb] = out[lb] || []).push(l.from); }
    });
    return out;
  }

  /* ── the fiche band ──
     One implementation for every entity type. Host is a container the shell
     provides above the fiche (iframe or native). Shows: link chips (both
     directions), typed props inline, "+ link" and "+ prop". Chips are pure
     typography (DS: no pictograms) — the target's TYPE reads from context. */

  function chipName(other) {
    // resolve lazily; render id first, patch text when resolved
    return Store.resolve(other).then(function (hit) {
      return hit ? Store.displayName(hit) : null;
    });
  }

  function renderBand(host, ref, opts) {
    opts = opts || {};
    var readOnly = opts.readOnly || (((window.Shell && Shell.bridge() && Shell.bridge().sess) || {}).role === 'player');
    host.classList.add('lk-band');
    host.innerHTML = '<span class="lk-band-title">LINKS</span><span class="lk-chips"></span>' +
      (readOnly ? '' : '<button class="lk-add" title="Add a link">+ link</button>') +
      '<span class="lk-props"></span>';
    var chipsEl = host.querySelector('.lk-chips');
    var propsEl = host.querySelector('.lk-props');

    linksOf(ref).then(function (rows) {
      if (!rows.length) chipsEl.innerHTML = '<span class="lk-none">—</span>';
      rows.forEach(function (r) {
        var chip = document.createElement('span');
        chip.className = 'lk-chip';
        chip.innerHTML = '<i class="lk-rel">' + App.esc(r.shownLabel) + '</i> <b>…</b>' +
          (readOnly ? '' : '<button class="lk-x" title="Remove link">×</button>');
        chipsEl.appendChild(chip);
        chipName(r.other).then(function (nm) {
          var b = chip.querySelector('b');
          if (nm) { b.textContent = nm; }
          else { chip.classList.add('lk-dead'); b.textContent = r.other.type + ':' + r.other.id + ' (gone)'; }
        });
        chip.querySelector('b').onclick = function () {
          if (chip.classList.contains('lk-dead')) return;
          App.emit('open:entity', { ref: r.other, newTab: false });
        };
        var xBtn = chip.querySelector('.lk-x');
        if (xBtn) xBtn.onclick = function (e) {
          e.stopPropagation();
          remove(r.link.id).then(function () { renderBand(host, ref, opts); });
        };
      });
    });

    var addBtn = host.querySelector('.lk-add');
    if (addBtn) addBtn.onclick = function () { pickerModal(ref, function () { renderBand(host, ref, opts); }); };

    // typed props inline (skip for casts/clock band if opts.noProps; players read-only → skipped)
    if (!opts.noProps && !readOnly && ref.type !== 'sheet') {
      Store.resolve(ref).then(function (hit) {
        if (!hit) return;
        var props = hit.json.props || {};
        var defs = Store.propsList();
        propsEl.innerHTML = defs.map(function (d) {
          var v = props[d.key];
          if (d.type === 'bool') return '<label class="lk-prop"><input type="checkbox" data-pk="' + App.esc(d.key) + '"' + (v ? ' checked' : '') + '> ' + App.esc(d.key) + '</label>';
          return '<label class="lk-prop">' + App.esc(d.key) + ' <input class="lk-prop-in" data-pk="' + App.esc(d.key) + '" type="' + (d.type === 'number' ? 'number' : 'text') + '" value="' + App.esc(v == null ? '' : v) + '"></label>';
        }).join('') + '<button class="lk-addprop" title="New property">+ prop</button>';
        propsEl.querySelectorAll('[data-pk]').forEach(function (inp) {
          inp.onchange = function () {
            var val = inp.type === 'checkbox' ? inp.checked : inp.value;
            Store.setProp(ref, inp.getAttribute('data-pk'), val);
          };
        });
        var ap = propsEl.querySelector('.lk-addprop');
        if (ap) ap.onclick = function () { propDefModal(function () { renderBand(host, ref, opts); }); };
      });
    }
  }

  /* picker modal — search across all Store types, name the relation (+ inverse) */
  function pickerModal(fromRef, done) {
    if (!window.UI) return;
    var types = Object.keys(Store.TYPES);
    window.UI.modal({
      title: 'New link',
      body:
        '<label class="rt-field"><span class="rt-field-l">Relation</span><input class="rt-input" id="lkm-label" placeholder="friend of, located at, employs…"></label>' +
        '<label class="rt-field"><span class="rt-field-l">Inverse relation (optional)</span><input class="rt-input" id="lkm-inv" placeholder="employed by…"></label>' +
        '<label class="rt-field"><span class="rt-field-l">To</span><input class="rt-input" id="lkm-q" placeholder="search an entity…" autocomplete="off"></label>' +
        '<div id="lkm-res" class="lk-picker-res"></div>',
      actions: [{ label: 'Cancel' }],
      onShow: function (box) {
        var q = box.querySelector('#lkm-q'), res = box.querySelector('#lkm-res');
        var all = [];
        Promise.all(types.map(function (t) {
          return Store.index(t).then(function (rows) {
            rows.forEach(function (r) { if (!sameRef(r.ref, fromRef) && r.ref.id) all.push({ ref: r.ref, name: Store.displayName(r) }); });
          }).catch(function () {});
        })).then(function () { paint(''); });
        function paint(f) {
          f = f.toLowerCase();
          var hits = all.filter(function (e) { return !f || e.name.toLowerCase().indexOf(f) >= 0; }).slice(0, 30);
          res.innerHTML = hits.map(function (e, i) {
            return '<button class="lk-picker-row" data-i="' + i + '">' + App.esc(e.name) + ' <small>' + e.ref.type + '</small></button>';
          }).join('') || '<div class="lk-none">no results</div>';
          res.querySelectorAll('[data-i]').forEach(function (b) {
            b.onclick = function () {
              var e = hits[+b.getAttribute('data-i')];
              add(fromRef, e.ref, box.querySelector('#lkm-label').value, box.querySelector('#lkm-inv').value)
                .then(function () { window.UI.close(); if (done) done(); });
            };
          });
        }
        q.oninput = function () { paint(q.value); };
        q.focus();
      }
    });
  }

  function propDefModal(done) {
    if (!window.UI) return;
    window.UI.modal({
      title: 'New property',
      body:
        '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="pd-key" placeholder="hostile, threat, district…"></label>' +
        '<label class="rt-field"><span class="rt-field-l">Type</span><select class="rt-select" id="pd-type"><option value="bool">Yes / no</option><option value="number">Number (sortable)</option><option value="string">Text</option></select></label>',
      actions: [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: function (box) {
        var k = box.querySelector('#pd-key').value.trim(); if (!k) return false;
        Store.propsAdd(k, box.querySelector('#pd-type').value).then(function () { if (done) done(); });
      } }]
    });
  }

  window.Links = {
    loadAll: loadAll, linksOf: linksOf, add: add, remove: remove, sweep: sweep,
    labelsFor: labelsFor, summaryFor: summaryFor,
    renderBand: renderBand, pickerModal: pickerModal,
    invalidate: function () { cache = null; },
  };
})();
