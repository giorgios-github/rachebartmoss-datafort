/* app-views.js — the view engine of the DATA section.
   Renders any entity list as GRID (photo + name + role, default) or TABLE
   (sortable columns). Filter/sort material comes from three families:
     · intrinsic fields (per type: role, kind, district…)
     · typed custom props (Store.propsList(): bool / number / string)
     · links (Links.summaryFor: label → [refs])
   Saved views live in meta.views: [{id, name, type, mode, filters, sort, cols}].
   A view's "+" creates a pre-filled entity from its active filters.
   Depends on window.App, window.Store, window.Links. */
(function () {
  'use strict';
  var App = window.App, Store = window.Store, Links = window.Links;

  /* intrinsic columns per type: [key, label, get(row), sortable] */
  var INTRINSIC = {
    npc: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['role', 'Role', function (r) { return r.json.role || r.json.type || ''; }],
      ['sa', 'SA', function (r) { return r.json.saVal || null; }],
    ],
    org: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['kind', 'Type', function (r) { return r.json.type || ''; }],
      ['hq', 'HQ', function (r) { return r.json.headquarters || ''; }],
    ],
    location: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['district', 'District', function (r) { return r.json.district || ''; }],
      ['notes', 'Notes', function (r) { return r.json.notes || ''; }],
    ],
    shop: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['kind', 'Type', function (r) { return r.json.kind || ''; }],
      ['n', 'Items', function (r) { return (r.json.items || []).length; }],
    ],
    item: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['kind', 'Nature', function (r) { return r.json.kind || 'object'; }],
      ['src', 'Source', function (r) { return r.json.source ? (r.json.source.db || 'custom') : '—'; }],
    ],
    sheet: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['role', 'Role', function (r) { return r.json.role || ''; }],
    ],
    cast: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['nature', 'Nature', function (r) { return r.json.nature || 'free'; }],
    ],
    clock: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['value', 'Value', function (r) { return (r.json.value || 0) + ' / ' + (r.json.max || 6); }],
    ],
    squad: [
      ['name', 'Name', function (r) { return Store.displayName(r); }],
      ['n', 'Members', function (r) { return (r.json.members || []).length; }],
    ],
  };
  function intrinsicCols(type) { return INTRINSIC[type] || INTRINSIC.item; }

  /* ── filtering / sorting ──
     filter: { props: {key: value}, text: '', link: {label, ref?} } */
  function matches(row, filters, linkSum) {
    if (!filters) return true;
    if (filters.visibleToPlayers && !Store.visibleToPlayers(row.json)) return false;
    if (filters.text) {
      var t = filters.text.toLowerCase();
      var hay = (Store.displayName(row) + ' ' + JSON.stringify(row.json.props || {})).toLowerCase();
      if (hay.indexOf(t) < 0) return false;
    }
    if (filters.props) {
      var props = row.json.props || {};
      for (var k in filters.props) {
        var want = filters.props[k];
        if (want === '' || want == null) continue;
        var have = props[k];
        if (typeof want === 'boolean') { if (!!have !== want) return false; }
        else if (String(have == null ? '' : have).toLowerCase().indexOf(String(want).toLowerCase()) < 0) return false;
      }
    }
    if (filters.link && filters.link.label) {
      var sum = linkSum[row.json.id] || {};
      var arr = sum[filters.link.label];
      if (!arr || !arr.length) return false;
      if (filters.link.ref && !arr.some(function (o) { return o.type === filters.link.ref.type && o.id === filters.link.ref.id; })) return false;
    }
    return true;
  }
  function sortRows(rows, sort, type) {
    if (!sort || !sort.key) return rows;
    var col = intrinsicCols(type).filter(function (c) { return c[0] === sort.key; })[0];
    var def = Store.propsList().filter(function (p) { return p.key === sort.key; })[0];
    function val(r) {
      if (col) return col[2](r);
      if (def) return (r.json.props || {})[sort.key];
      return null;
    }
    var dir = sort.dir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  /* ── saved views (meta.views) ── */
  function savedViews() { return (App.ctx.meta && App.ctx.meta.views) || []; }
  function saveView(view) {
    if (!view.id) view.id = App.uid('vw');
    return App.saveMeta(function (m) {
      var list = (m.views || []).filter(function (v) { return v.id !== view.id; });
      list.push(view);
      return { views: list };
    }).then(function () { App.emit('views:changed'); return view; });
  }
  function deleteView(id) {
    return App.saveMeta(function (m) { return { views: (m.views || []).filter(function (v) { return v.id !== id; }) }; })
      .then(function () { App.emit('views:changed'); });
  }

  /* ── render ──
     cfg: { type, mode:'grid'|'table', filters, sort, onOpen(ref, newTab),
            actions(row) → CtxMenu items, onNew(prefill), title } */
  function render(host, cfg) {
    host.innerHTML = '<div class="vw-loading">…</div>';
    Promise.all([Store.index(cfg.type), Links.loadAll()]).then(function (res) {
      var rows = res[0];
      var linkSum = {};
      rows.forEach(function (r) { if (r.json.id) linkSum[r.json.id] = Links.summaryFor(r.ref); });
      var visible = sortRows(rows.filter(function (r) { return matches(r, cfg.filters, linkSum); }), cfg.sort, cfg.type);
      host.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'vw vw-' + (cfg.mode || 'grid');
      host.appendChild(wrap);
      if (!visible.length) {
        var filtered = cfg.filters && (cfg.filters.text || (cfg.filters.props && Object.keys(cfg.filters.props).length) || cfg.filters.link);
        var msg = filtered ? 'no records match these filters' : 'no records yet';
        if (cfg.onNew) {
          // the empty state IS the create affordance — no hunting for a distant +
          var btn = document.createElement('button');
          btn.className = 'app-empty vw-empty-new';
          btn.innerHTML = App.esc(msg) + ' — <b>ink the first one</b>';
          btn.onclick = function () { cfg.onNew(); };
          wrap.appendChild(btn);
        } else wrap.innerHTML = '<div class="app-empty">' + App.esc(msg) + '.</div>';
        return;
      }
      if ((cfg.mode || 'grid') === 'grid') renderGrid(wrap, visible, cfg, linkSum);
      else renderTable(wrap, visible, cfg, linkSum);
    }).catch(function (e) {
      host.innerHTML = '<div class="app-empty">Failed to load: ' + App.esc(e.message || e) + '</div>';
    });
  }

  function wireRowActions(node, row, cfg) {
    var dots = node.querySelector('[data-dots]');
    if (dots) dots.onclick = function (e) {
      e.stopPropagation();
      if (!window.CtxMenu || !cfg.actions) return;
      var r = e.target.getBoundingClientRect();
      CtxMenu.open(r.left, r.bottom + 4, cfg.actions(row));
    };
    if (window.CtxMenu && cfg.actions) CtxMenu.attach(node, function () { return cfg.actions(row); });
    node.onclick = function (e) {
      if (e.target.hasAttribute('data-dots')) return;
      if (cfg.onOpen) cfg.onOpen(row.ref, e.metaKey || e.ctrlKey);
    };
  }

  function renderGrid(wrap, rows, cfg, linkSum) {
    rows.forEach(function (row, i) {
      var d = document.createElement('div');
      d.className = 'vw-card';
      if (!App.reduceMotion()) d.style.animationDelay = Math.min(i * 16, 240) + 'ms';
      var photo = Store.photoOf(row);
      var sub = intrinsicCols(cfg.type)[1];
      var pub = row.json.props && row.json.props.public;
      d.innerHTML =
        '<div class="vw-card-ph">' + (photo ? '<img src="' + App.esc(photo) + '" loading="lazy">' : '<span class="vw-card-noph">' + App.esc((Store.displayName(row) || '?').slice(0, 2).toUpperCase()) + '</span>') + '</div>' +
        '<div class="vw-card-body"><span class="vw-card-name">' + App.esc(Store.displayName(row)) + '</span>' +
        '<span class="vw-card-sub">' + App.esc(String(sub ? sub[2](row) || '' : '')) + (pub ? ' · <i class="vw-pub">public</i>' : '') + '</span></div>' +
        (cfg.actions ? '<button class="vw-dots" data-dots title="Actions">…</button>' : '');
      wireRowActions(d, row, cfg);
      wrap.appendChild(d);
    });
    if (cfg.onNew) {
      var add = document.createElement('button');
      add.className = 'vw-card vw-card-new';
      add.innerHTML = '<span class="vw-new-plus">＋</span><span class="vw-new-l">New record</span>';
      add.onclick = function () { cfg.onNew(); };
      wrap.appendChild(add);
    }
  }

  function renderTable(wrap, rows, cfg, linkSum) {
    var cols = intrinsicCols(cfg.type).slice();
    var propCols = Store.propsList().map(function (p) { return ['prop:' + p.key, p.key, function (r) { var v = (r.json.props || {})[p.key]; return p.type === 'bool' ? (v ? '●' : '◌') : (v == null ? '' : v); }, p]; });
    var linkCol = ['links', 'Links', function (r) {
      var sum = linkSum[r.json.id] || {}, bits = [];
      Object.keys(sum).forEach(function (lb) { bits.push('<i>' + App.esc(lb) + '</i> ' + sum[lb].length); });
      return bits.join(' · ') || '—';
    }];
    var all = cols.concat(propCols, [linkCol]);
    var t = document.createElement('table');
    t.className = 'vw-table';
    var sortKey = cfg.sort && cfg.sort.key, sortDir = cfg.sort && cfg.sort.dir;
    t.innerHTML = '<thead><tr>' + all.map(function (c) {
      var key = c[0], active = key === sortKey || ('prop:' + sortKey) === key;
      return '<th data-col="' + App.esc(key) + '" class="' + (active ? 'sorted' : '') + '">' + App.esc(c[1]) + (active ? (sortDir === 'desc' ? ' ▴' : ' ▾') : '') + '</th>';
    }).join('') + '<th></th></tr></thead><tbody></tbody>';
    var tb = t.querySelector('tbody');
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML = all.map(function (c) { var v = c[2](row); return '<td>' + (c === linkCol ? v : App.esc(String(v == null ? '' : v))) + '</td>'; }).join('') +
        '<td class="vw-td-dots">' + (cfg.actions ? '<button class="vw-dots" data-dots>…</button>' : '') + '</td>';
      wireRowActions(tr, row, cfg);
      tb.appendChild(tr);
    });
    t.querySelectorAll('th[data-col]').forEach(function (th) {
      th.onclick = function () {
        var key = th.getAttribute('data-col').replace(/^prop:/, '');
        var dir = (cfg.sort && cfg.sort.key === key && cfg.sort.dir !== 'desc') ? 'desc' : 'asc';
        if (cfg.onSort) cfg.onSort({ key: key, dir: dir });
      };
    });
    wrap.appendChild(t);
    if (cfg.onNew) {
      var add = document.createElement('button');
      add.className = 'vw-table-new';
      add.textContent = '+ new record';
      add.onclick = function () { cfg.onNew(); };
      wrap.appendChild(add);
    }
  }

  /* Prefill from a view's filters: bool/string props applied, link pre-created after save. */
  function prefillFrom(filters) {
    var out = { props: {} };
    if (filters && filters.props) Object.keys(filters.props).forEach(function (k) {
      var v = filters.props[k];
      if (v !== '' && v != null) out.props[k] = v;
    });
    if (filters && filters.link) out._pendingLink = filters.link;
    return out;
  }

  window.Views = {
    render: render,
    intrinsicCols: intrinsicCols,
    savedViews: savedViews, saveView: saveView, deleteView: deleteView,
    prefillFrom: prefillFrom,
  };
})();
