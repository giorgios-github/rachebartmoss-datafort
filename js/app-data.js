/* app-data.js — the DATA section.
   Layout: persistent tree sidebar (types · saved views · DATABASE) rendered in
   the Shell's #section-side, content in the section tabs:
     · {tool:'data-view', dtype}          → grid/table of a type (Views engine)
     · {tool:'data-view', view:<savedId>} → a saved custom view
     · {tool:'data-db', db?}              → the lore DATABASE screen (+ promotion)
     · {kind, ref}                        → a fiche (links band + editor)
   Fiches: npc/org → existing editors in a cdoc iframe; location/shop/item →
   native editors (shop upgrades to its own page in WS-G).
   Depends on App, Store, Links, Views, Shell (+ bridge extras via Shell). */
(function () {
  'use strict';
  var App = window.App, Store = window.Store, Links = window.Links, Views = window.Views;

  var TYPES = [
    { type: 'npc', label: 'NPC' },
    { type: 'org', label: 'ORG' },
    { type: 'location', label: 'LOCATIONS' },
    { type: 'shop', label: 'SHOPS' },
    { type: 'item', label: 'ITEMS' },
  ];
  var TYPE_LABEL = {}; TYPES.forEach(function (t) { TYPE_LABEL[t.type] = t.label; });

  /* lore database datasets (static site files) */
  var DB_DEFS = [
    ['weapons', 'Weapons', 'data/cp2020weapons.json', true],
    ['cyberware', 'Cyberware', 'data/cyberware.json', true],
    ['gear', 'Gear', 'data/cp2020gear.json', true],
    ['vehicles', 'Vehicles', 'data/cp2020-vehicles.json', true],
    ['decks', 'Cyberdecks', 'data/cp2020decks.json', true],
    ['programs', 'Programs', 'data/cp2020programs.json', true],
    ['corporations', 'Corporations', 'data/corporations.json', 'org'],
    ['skills', 'Skills', 'data/cp2020skills.json', false],
    ['roles', 'Roles', 'data/cp2020rolesext.json', false],
  ];
  var DB_CACHE = {};
  function dbLoad(key) {
    if (DB_CACHE[key]) return Promise.resolve(DB_CACHE[key]);
    var def = DB_DEFS.filter(function (d) { return d[0] === key; })[0];
    return fetch(def[2]).then(function (r) { return r.json(); }).then(function (j) {
      DB_CACHE[key] = Array.isArray(j) ? j : (j.items || j.roles || []);
      return DB_CACHE[key];
    }).catch(function () { DB_CACHE[key] = []; return []; });
  }

  /* per-type view state (mode/sort/filters) remembered in meta.ui */
  function viewState(dtype) { return App.uiGet('viewState.' + dtype, { mode: 'grid', sort: null, filters: {} }); }
  function setViewState(dtype, st) { App.uiSet('viewState.' + dtype, st); }

  function isPlayer() { return ((window.Shell && Shell.bridge() && Shell.bridge().sess) || {}).role === 'player'; }

  /* ═══ TREE SIDEBAR ═══ */
  function renderSide(host) {
    var counts = {};
    var player = isPlayer();
    host.innerHTML = '<div class="dt-side">' +
      '<div class="dt-head">CORPUS</div>' +
      '<div class="dt-types">' + TYPES.map(function (t) {
        return '<div class="dt-node" data-dtype="' + t.type + '"><span class="dt-l">' + t.label + '</span>' +
          '<span class="dt-n" data-count="' + t.type + '"></span>' + (player ? '' : '<button class="dt-plus" data-new="' + t.type + '" title="Create">＋</button>') + '</div>';
      }).join('') + '</div>' +
      '<div class="dt-head dt-head-mt">VIEWS</div>' +
      '<div class="dt-views">' +
        '<div class="dt-node dt-view" data-builtin="contacts"><span class="dt-l">Contacts</span><span class="dt-n">NPC</span>' +
          (player ? '' : '<button class="dt-plus" data-newcontact title="New contact">＋</button>') + '</div>' +
        (player ? '' : Views.savedViews().map(function (v) {
          return '<div class="dt-node dt-view" data-view="' + v.id + '"><span class="dt-l">' + App.esc(v.name) + '</span>' +
            '<span class="dt-n">' + (TYPE_LABEL[v.type] || v.type) + '</span><button class="dt-plus" data-newview-in="' + v.id + '" title="Create one matching this view">＋</button></div>';
        }).join('') +
        '<div class="dt-node dt-newview" data-mkview><span class="dt-l dt-dim">+ new view</span></div>') +
      '</div>' +
      '<button class="dt-db" data-db>DATABASE</button>';
    // counts — players only ever see (and count) what's visible to them
    TYPES.forEach(function (t) {
      Store.index(t.type).then(function (rows) {
        if (player) rows = rows.filter(function (r) { return Store.visibleToPlayers(r.json); });
        var n = host.querySelector('[data-count="' + t.type + '"]');
        if (n) { counts[t.type] = rows.length; n.textContent = rows.length; }
      }).catch(function () {});
    });
    host.querySelectorAll('[data-dtype]').forEach(function (d) {
      d.onclick = function (e) { if (e.target.hasAttribute('data-new')) return; openTypeView(d.getAttribute('data-dtype')); };
    });
    host.querySelectorAll('[data-new]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); newEntityFlow(b.getAttribute('data-new'), {}); };
    });
    host.querySelectorAll('[data-view]').forEach(function (d) {
      d.onclick = function (e) {
        if (e.target.hasAttribute('data-newview-in')) return;
        openSavedView(d.getAttribute('data-view'));
      };
      if (window.CtxMenu) CtxMenu.attach(d, function () {
        var id = d.getAttribute('data-view');
        return [{ label: 'Delete view', icon: '✕', danger: true, onClick: function () { Views.deleteView(id).then(refreshSide); } }];
      });
    });
    host.querySelectorAll('[data-newview-in]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var v = Views.savedViews().filter(function (x) { return x.id === b.getAttribute('data-newview-in'); })[0];
        if (v) newEntityFlow(v.type, Views.prefillFrom(v.filters));
      };
    });
    var mk = host.querySelector('[data-mkview]');
    if (mk) mk.onclick = function () { newViewModal(); };
    var bc = host.querySelector('[data-builtin="contacts"]');
    if (bc) bc.onclick = function (e) {
      if (e.target.hasAttribute('data-newcontact')) return;
      Shell.openDataTab({ tool: 'data-view', dtype: 'npc', builtin: 'contacts', label: 'Contacts' });
    };
    var nc = host.querySelector('[data-newcontact]');
    if (nc) nc.onclick = function (e) { e.stopPropagation(); newEntityFlow('npc', { props: { contact: true } }); };
    host.querySelector('[data-db]').onclick = function () { openDb(); };
  }
  function refreshSide() { var s = App.el('section-side'); if (s && window.Shell && Shell.state().active === 'data') renderSide(s); }
  App.on('views:changed', refreshSide);
  App.on('entity:deleted', function () { refreshSide(); });
  // On save: refresh the tree AND repaint the active view pane if it lists
  // that type (fixes e.g. a new org logo not appearing in the grid).
  App.on('entity:saved', function (e) {
    refreshSide();
    if (!window.Shell || Shell.state().active !== 'data') return;
    var act = Shell.activeTab();
    if (act && act.tool === 'data-view' && e && e.type && (act.dtype === e.type || act.view || act.builtin)) {
      var p = Shell.paneEl(act.id); if (p) { p._rendered = false; Shell.activatePane(); }
    }
  });

  /* ═══ tab openers ═══ */
  function openTypeView(dtype) { Shell.openDataTab({ tool: 'data-view', dtype: dtype, label: TYPE_LABEL[dtype] }); }
  function openSavedView(id) {
    var v = Views.savedViews().filter(function (x) { return x.id === id; })[0]; if (!v) return;
    Shell.openDataTab({ tool: 'data-view', view: id, dtype: v.type, label: v.name });
  }
  function openDb(dbKey) { Shell.openDataTab({ tool: 'data-db', db: dbKey || null, label: 'DATABASE' }); }

  /* ═══ VIEW PANE (grid/table of a type or saved view) ═══ */
  function renderViewPane(t, host) {
    var player = isPlayer();
    // contact fiche route (view = 'contact:<sheetId>:<contactId>')
    if (t.view && String(t.view).indexOf('contact:') === 0) return renderContactFiche(t, host);
    // built-in Contacts view: aggregated from the PLAYER SHEETS (+ contact-tagged NPCs)
    if (t.builtin === 'contacts') return renderContactsView(t, host);
    var saved = t.view ? Views.savedViews().filter(function (x) { return x.id === t.view; })[0] : null;
    var dtype = (saved && saved.type) || t.dtype || 'npc';
    // Player shop browsing = the storefront (buy flow), not the GM grid.
    if (player && dtype === 'shop') {
      var br2 = Shell.bridge();
      if (br2 && br2.toolRender) { br2.toolRender('shop', host); return; }
    }
    var st = saved ? { mode: saved.mode || 'grid', sort: saved.sort || null, filters: saved.filters || {} } : viewState(dtype);
    host.className = 'tab-content dt-pane';
    host.innerHTML =
      '<div class="dt-bar">' +
        '<span class="dt-title">' + App.esc(saved ? saved.name : TYPE_LABEL[dtype]) + '</span>' +
        '<input class="dt-search" placeholder="filter…" value="' + App.esc((st.filters && st.filters.text) || '') + '">' +
        '<span class="dt-filters" data-filterchips></span>' +
        '<button class="dt-btn" data-addfilter>+ filter</button>' +
        '<span class="dt-modes"><button class="dt-mode' + (st.mode === 'grid' ? ' on' : '') + '" data-m="grid">Grid</button>' +
        '<button class="dt-mode' + (st.mode === 'table' ? ' on' : '') + '" data-m="table">Table</button></span>' +
        (player ? '' :
          (saved ? '<button class="dt-btn" data-saveview title="Store sort/filters into this view">Save view</button>' : '<button class="dt-btn" data-mkview>+ view from these filters</button>') +
          '<button class="dt-btn dt-btn-new" data-newent>＋ New</button>') +
      '</div>' +
      '<div class="dt-body"></div>';
    var body = host.querySelector('.dt-body');

    function persistState() { if (player || (saved && saved._builtin)) return; if (saved) { saved.mode = st.mode; saved.sort = st.sort; saved.filters = st.filters; Views.saveView(saved); } else setViewState(dtype, st); }

    /* filter chips — every active prop/link filter is a removable chip */
    function paintChips() {
      var box = host.querySelector('[data-filterchips]'); if (!box) return;
      var chips = [];
      var fp = (st.filters && st.filters.props) || {};
      Object.keys(fp).forEach(function (k) {
        if (fp[k] === '' || fp[k] == null) return;
        chips.push('<span class="dt-fchip" data-fprop="' + App.esc(k) + '"><i>' + App.esc(k) + '</i>&nbsp;= ' + App.esc(String(fp[k])) + ' <b title="Remove">×</b></span>');
      });
      if (st.filters && st.filters.link && st.filters.link.label) {
        chips.push('<span class="dt-fchip" data-flink><i>link</i>&nbsp;' + App.esc(st.filters.link.label) + ' <b title="Remove">×</b></span>');
      }
      box.innerHTML = chips.join('');
      box.querySelectorAll('[data-fprop]').forEach(function (c) {
        c.querySelector('b').onclick = function () { delete st.filters.props[c.getAttribute('data-fprop')]; persistState(); paintChips(); paint(); };
      });
      var lc = box.querySelector('[data-flink]');
      if (lc) lc.querySelector('b').onclick = function () { delete st.filters.link; persistState(); paintChips(); paint(); };
    }
    function addFilterModal() {
      if (!window.UI) return;
      var defs = Store.propsList();
      Links.labelsFor().then(function (labels) {
        UI.modal({
          title: 'Add a filter',
          body:
            '<label class="rt-field"><span class="rt-field-l">Filter on</span><select class="rt-select" id="ft-key">' +
              defs.map(function (d) { return '<option value="p:' + App.esc(d.key) + '">' + App.esc(d.key) + ' (' + d.type + ')</option>'; }).join('') +
              labels.map(function (l) { return '<option value="l:' + App.esc(l) + '">link: ' + App.esc(l) + '</option>'; }).join('') +
            '</select></label>' +
            '<label class="rt-field"><span class="rt-field-l">Value</span><input class="rt-input" id="ft-val" placeholder="true · a number · text (ignored for links)"></label>',
          actions: [{ label: 'Cancel' }, { label: 'Add', kind: 'primary', onClick: function (box) {
            var sel = box.querySelector('#ft-key').value;
            var raw = box.querySelector('#ft-val').value;
            st.filters = st.filters || {};
            if (sel.indexOf('p:') === 0) {
              var key = sel.slice(2);
              var def = defs.filter(function (d) { return d.key === key; })[0];
              st.filters.props = st.filters.props || {};
              st.filters.props[key] = def && def.type === 'bool' ? (raw === '' || raw === 'true' || raw === '1') : (def && def.type === 'number' ? parseFloat(raw) : raw);
            } else {
              st.filters.link = { label: sel.slice(2) };
            }
            persistState(); paintChips(); paint();
          } }]
        });
      });
    }
    var af = host.querySelector('[data-addfilter]'); if (af) af.onclick = addFilterModal;
    paintChips();
    function paint() {
      var filters = st.filters || {};
      if (player) { filters = Object.assign({}, filters, { visibleToPlayers: true }); }
      Views.render(body, {
        type: dtype, mode: st.mode, filters: filters, sort: st.sort,
        onSort: function (s) { st.sort = s; persistState(); paint(); },
        onOpen: function (ref, newTab) { Shell.openEntity(ref.type, ref.id, null, newTab); },
        onNew: player ? null : function () { newEntityFlow(dtype, saved ? Views.prefillFrom(saved.filters) : {}); },
        actions: player ? null : function (row) { return rowActions(row); },
      });
    }
    host.querySelector('.dt-search').oninput = App.debounce(function (e) { st.filters = st.filters || {}; st.filters.text = e.target.value; persistState(); paint(); }, 200);
    host.querySelectorAll('[data-m]').forEach(function (b) {
      b.onclick = function () { st.mode = b.getAttribute('data-m'); persistState(); renderViewPane(t, host); };
    });
    var ne = host.querySelector('[data-newent]'); if (ne) ne.onclick = function () { newEntityFlow(dtype, saved ? Views.prefillFrom(saved.filters) : {}); };
    var sv = host.querySelector('[data-saveview]'); if (sv) sv.onclick = function () { persistState(); };
    var mkv = host.querySelector('[data-mkview]'); if (mkv) mkv.onclick = function () { newViewModal(dtype, st); };
    paint();
  }

  /* ═══ CONTACTS — pulled live from the player sheets ═══
     Every contact a player wrote on their sheet (Network & Gigs) appears here
     automatically, with the player's own written description up front.
     NPCs tagged `contact` are merged in (they open their full record). */
  function sheetContacts() {
    var br = Shell.bridge() || {}, sess = br.sess || {};
    var out = [];
    (sess.order || []).forEach(function (sid) {
      var rec = sess.camp && sess.camp.getSheet && sess.camp.getSheet(sid);
      var j = rec && rec.json;
      ((j && j.contacts) || []).forEach(function (c) {
        out.push({ sheet: sid, owner: (j.handle || j.name || sid), c: c });
      });
    });
    return out;
  }
  function renderContactsView(t, host) {
    host.className = 'tab-content dt-pane';
    host.innerHTML = '<div class="dt-bar"><span class="dt-title">CONTACTS</span>' +
      '<span class="dt-hint-inline">pulled live from the player sheets</span></div>' +
      '<div class="dt-body"><div class="vw vw-grid" id="ct-grid"></div></div>';
    var grid = host.querySelector('#ct-grid');
    var rows = sheetContacts();
    Store.index('npc').then(function (npcs) {
      var tagged = npcs.filter(function (r) { return r.json.props && r.json.props.contact; });
      var html = rows.map(function (e, i) {
        var c = e.c;
        return '<div class="vw-card ct-card" data-ct="' + i + '">' +
          '<div class="vw-card-body"><span class="vw-card-name">' + App.esc(c.name || 'Contact') + '</span>' +
          '<span class="vw-card-sub">' + App.esc([c.type, c.attitude, c.org].filter(Boolean).join(' · ')) + '</span>' +
          (c.description ? '<p class="ct-desc">' + App.esc(String(c.description).slice(0, 160)) + (String(c.description).length > 160 ? '…' : '') + '</p>' : '') +
          '<span class="ct-owner">FROM ' + App.esc(e.owner.toUpperCase()) + '’S SHEET</span></div></div>';
      }).join('');
      html += tagged.map(function (r, i) {
        return '<div class="vw-card ct-card" data-npc="' + App.esc(r.json.id) + '">' +
          '<div class="vw-card-ph">' + (Store.photoOf(r) ? '<img src="' + App.esc(Store.photoOf(r)) + '" loading="lazy">' : '<span class="vw-card-noph">' + App.esc((Store.displayName(r) || '?').slice(0, 2).toUpperCase()) + '</span>') + '</div>' +
          '<div class="vw-card-body"><span class="vw-card-name">' + App.esc(Store.displayName(r)) + '</span>' +
          '<span class="vw-card-sub">' + App.esc(r.json.role || '') + ' · NPC RECORD</span></div></div>';
      }).join('');
      grid.innerHTML = html || '<div class="app-empty">No contacts yet — they appear as soon as players write them on their sheets.</div>';
      grid.querySelectorAll('[data-ct]').forEach(function (d) {
        d.onclick = function () {
          var e = rows[+d.getAttribute('data-ct')];
          Shell.openDataTab({ tool: 'data-view', view: 'contact:' + e.sheet + ':' + (e.c.id || e.c.name), label: e.c.name || 'Contact' });
        };
      });
      grid.querySelectorAll('[data-npc]').forEach(function (d) {
        d.onclick = function () { Shell.openEntity('npc', d.getAttribute('data-npc')); };
      });
    });
  }
  function renderContactFiche(t, host) {
    var parts = String(t.view).split(':'); // contact:<sid>:<cid>
    var sid = parts[1], cid = parts.slice(2).join(':');
    var e = sheetContacts().filter(function (x) { return x.sheet === sid && String(x.c.id || x.c.name) === cid; })[0];
    host.className = 'tab-content dt-fiche';
    if (!e) { host.innerHTML = '<div class="app-empty">Contact not found — it may have been removed from the sheet.</div>'; return; }
    var c = e.c;
    t.label = c.name || 'Contact';
    host.innerHTML = '<div class="dtf ct-fiche">' +
      '<div class="ct-head"><span class="ct-name">' + App.esc(c.name || 'Contact') + '</span>' +
      '<span class="ct-meta">' + App.esc([c.type, c.attitude, c.org].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="ct-body">' +
        '<div class="ct-desc-full">' + (c.description ? App.esc(c.description) : '<span class="dt-dim">No description written yet.</span>') + '</div>' +
        '<div class="ct-src tx-grey">CONTACT OF <b>' + App.esc(e.owner.toUpperCase()) + '</b> — the description is the player’s own words, edited on their sheet.</div>' +
      '</div></div>';
    if (window.Shell) Shell.renderTabs();
  }

  function rowActions(row) {
    var items = [
      { label: 'Open', icon: '▸', onClick: function () { Shell.openEntity(row.ref.type, row.ref.id); } },
      { label: 'Open in a new tab', icon: '⊕', onClick: function () { Shell.openEntity(row.ref.type, row.ref.id, null, true); } },
      { label: 'Link…', icon: '∞', onClick: function () { Links.pickerModal(row.ref, refreshSide); } },
      { sep: true },
      { label: 'Cast to players', icon: '⇄', onClick: function () { castEntity(row); } },
      { label: (row.json.props && row.json.props.public) ? 'Make private' : 'Make public', icon: '◉', onClick: function () { Store.setProp(row.ref, 'public', !(row.json.props && row.json.props.public)).then(function () { if (window.Shell) Shell.renderTabContent(); }); } },
      { sep: true },
      { label: 'Delete', icon: '✕', danger: true, onClick: function () {
        if (window.UI) UI.modal({ title: 'Confirm', body: 'Delete "' + App.esc(Store.displayName(row)) + '"?', actions: [{ label: 'Cancel' }, { label: 'Delete', kind: 'primary', onClick: function () { Store.del(row.ref).then(function () { Shell.renderTabContent(); }); } }] });
      } },
    ];
    return items;
  }
  function castEntity(row) {
    var j = row.json, blocks = [];
    var photo = Store.photoOf(row);
    if (photo) blocks.push({ type: 'image', src: photo, cam: 'ID ● FILE', size: 'l', align: 'left' });
    blocks.push({ type: 'text', mode: 'panel', size: 'l', text: (Store.displayName(row) || '').toUpperCase() + (j.role ? '\n' + j.role : '') + (j.notes ? '\n\n' + j.notes : '') });
    var br = Shell.bridge();
    if (br && br.castReveal) br.castReveal({ kind: 'event', title: Store.displayName(row), blocks: blocks });
  }

  /* ═══ creation: Generate | Blank record ═══ */
  var TYPE_SINGULAR = { npc: 'NPC', org: 'org', location: 'location', shop: 'shop', item: 'item' };
  // Persist generator output into the corpus (the generators only ROLL — the
  // caller owns the save; forgetting this left "Save as NPC" writing nothing).
  function saveGenerated(dtype, sheets) {
    return Promise.all((sheets || []).map(function (s) {
      if (!s.props || typeof s.props !== 'object') s.props = {};
      if (!s.name && !s.handle) s.name = s.role || 'NPC';   // generated mooks carry only a role
      return Store.create(dtype, s);
    })).then(function () { Shell.renderTabContent(); refreshSide(); });
  }
  function newEntityFlow(dtype, prefill) {
    var br = Shell.bridge() || {};
    var canGen = (dtype === 'npc' && br.archetypeGenModal) || (dtype === 'org' && br.orgGenModal);
    if (!canGen) return createBlank(dtype, prefill);
    if (!window.UI) return createBlank(dtype, prefill);
    UI.modal({
      title: 'New ' + (TYPE_SINGULAR[dtype] || dtype),
      body: '<div class="dt-newchoice"><button class="dt-choice" data-c="gen"><b>Generate</b><span>Archetype, tier, chrome — ready to run.</span></button>' +
        '<button class="dt-choice" data-c="blank"><b>Blank record</b><span>Start from scratch in the editor.</span></button></div>',
      actions: [{ label: 'Cancel' }],
      onShow: function (box) {
        box.querySelector('[data-c="gen"]').onclick = function () {
          UI.close();
          if (dtype === 'npc') br.archetypeGenModal({ onSave: function (sheets) { saveGenerated('npc', sheets); } });
          else br.orgGenModal({ onSave: function (orgs) { saveGenerated('org', orgs); } });
        };
        box.querySelector('[data-c="blank"]').onclick = function () { UI.close(); createBlank(dtype, prefill); };
      }
    });
  }
  function createBlank(dtype, prefill) {
    prefill = prefill || {};
    if (!window.UI) return;
    UI.modal({
      title: 'New ' + (TYPE_SINGULAR[dtype] || dtype) + ' record',
      body: '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="ne-name" placeholder="name…"></label>',
      actions: [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: function (box) {
        var name = (box.querySelector('#ne-name').value || '').trim(); if (!name) return false;
        var json = { name: name, props: prefill.props || {} };
        if (dtype === 'npc') Object.assign(json, { role: '', stats: {}, skills: [], cyberware: [], weapons: [], armor: [], inventory: [], vehicles: [], notes: '' });
        if (dtype === 'org') Object.assign(json, { type: 'corporation' });
        if (dtype === 'location') Object.assign(json, { district: '', notes: '' });
        if (dtype === 'shop') Object.assign(json, { kind: 'storefront', items: [] });
        if (dtype === 'item') Object.assign(json, { kind: 'object', notes: '' });
        Store.create(dtype, json).then(function (made) {
          var after = prefill._pendingLink && prefill._pendingLink.ref
            ? Links.add(made.ref, prefill._pendingLink.ref, prefill._pendingLink.label, '')
            : Promise.resolve();
          after.then(function () { refreshSide(); Shell.openEntity(dtype, made.json.id, name); });
        });
      } }]
    });
  }
  function newViewModal(dtype, st) {
    if (!window.UI) return;
    UI.modal({
      title: 'New view',
      body:
        '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="nv-name" placeholder="Hostiles, Arasaka contacts…"></label>' +
        '<label class="rt-field"><span class="rt-field-l">Type</span><select class="rt-select" id="nv-type">' + TYPES.map(function (t) { return '<option value="' + t.type + '"' + (t.type === dtype ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') + '</select></label>' +
        '<p class="dt-hint">The view stores the current mode, sort and filters — editable afterwards.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: function (box) {
        var name = (box.querySelector('#nv-name').value || '').trim(); if (!name) return false;
        var type = box.querySelector('#nv-type').value;
        var base = (type === dtype && st) ? st : viewState(type);
        Views.saveView({ name: name, type: type, mode: base.mode || 'grid', sort: base.sort || null, filters: base.filters || {} })
          .then(function (v) { refreshSide(); openSavedView(v.id); });
      } }]
    });
  }

  /* ═══ FICHE PANE (links band + editor) ═══ */
  function renderFiche(t, host) {
    host.className = 'tab-content dt-fiche';
    host.innerHTML = '<div class="dt-fichebar"><div class="lk-band-host"></div>' +
      (isPlayer() ? '' : '<button class="dt-save" title="Consolidate this record into the database">SAVE</button>') +
      '</div><div class="dt-fiche-body"><div class="app-empty">…</div></div>';
    var bandHost = host.querySelector('.lk-band-host');
    var body = host.querySelector('.dt-fiche-body');
    // Explicit save — the "ink it into the datafort" gesture. cdoc editors get
    // a flush request; native fiches are already saved on edit, so the button
    // confirms. Feedback: SAVE → INKED for a beat.
    var saveBtn = host.querySelector('.dt-save');
    if (saveBtn) {
      var inked = function () { saveBtn.textContent = 'INKED'; saveBtn.classList.add('inked'); setTimeout(function () { saveBtn.textContent = 'SAVE'; saveBtn.classList.remove('inked'); }, 1400); };
      saveBtn.onclick = function () {
        var fr = body.querySelector('iframe.dt-fiche-frame');
        if (fr && fr.contentWindow) {
          var onSaved = function (e) { if (e.data && e.data.type === 'cdoc-saved') { window.removeEventListener('message', onSaved); inked(); } };
          window.addEventListener('message', onSaved);
          setTimeout(function () { window.removeEventListener('message', onSaved); }, 4000);
          try { fr.contentWindow.postMessage({ type: 'cdoc-save-now' }, '*'); } catch (e2) {}
        } else { inked(); }   // native fiches auto-save on edit
      };
    }
    var ref = { type: t.kind, id: t.ref };
    Store.resolve(ref).then(function (hit) {
      if (!hit) { body.innerHTML = '<div class="app-empty">Record not found (' + App.esc(t.kind + ':' + t.ref) + ').</div>'; return; }
      ref = { type: t.kind, id: hit.json.id || t.ref };
      Links.renderBand(bandHost, ref);
      // update the tab label with the real display name
      t.label = Store.displayName(hit);
      var PAGES = { npc: ['npc-sheet.html', 'npcs'], org: ['organisations.html', 'orgs'], location: ['location.html', 'locations'], shop: ['shop.html', 'shops'] };
      if (isPlayer()) {
        renderPlayerDossier(body, ref, hit);
      } else if (PAGES[t.kind]) {
        var cid = encodeURIComponent(App.ctx.cid);
        var url = PAGES[t.kind][0] + '?cdoc=1&cid=' + cid + '&ctype=' + PAGES[t.kind][1] + '&cname=' + encodeURIComponent(hit.file);
        body.innerHTML = '<iframe class="dt-fiche-frame" src="' + App.esc(url) + '"></iframe>';
      } else {
        renderItemFiche(body, ref, hit);
      }
      if (window.Shell) Shell.renderTabs();   // repaint label
    });
  }

  /* player read-only dossier — no editors, no PUT; just what the GM made public */
  function renderPlayerDossier(body, ref, hit) {
    var j = hit.json;
    var photo = j.photo || j.logo || '';
    body.innerHTML = '<div class="dtf pd">' +
      (photo ? '<div class="pd-photo"><img src="' + App.esc(photo) + '"></div>' : '') +
      '<div class="dtf-head"><span class="dtf-name" style="border-bottom:none">' + App.esc(j.name || j.handle || '?') + '</span></div>' +
      '<div class="pd-sub">' + App.esc(j.role || j.type || j.kind || '') + (j.district ? ' · ' + App.esc(j.district) : '') + '</div>' +
      (j.desc || j.notes ? '<p class="pd-notes">' + App.esc(j.desc || j.notes) + '</p>' : '') +
      ((j.items && j.items.length) ? '<div class="dtf-field"><span>Articles</span><div class="dtf-items">' + j.items.map(function (it) { return '<span class="dtf-item">' + App.esc(it.name) + '</span>'; }).join('') + '</div></div>' : '') +
      '</div>';
  }

  /* cdoc iframes ping the shell after each save — refresh caches & views */
  var CTYPE_TYPE = { npcs: 'npc', orgs: 'org', locations: 'location', shops: 'shop', items: 'item', casts: 'cast', clocks: 'clock', squads: 'squad' };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'cdoc-saved') return;
    var type = CTYPE_TYPE[d.ctype];
    if (type) { Store.invalidate(type); App.emit('entity:saved', { type: type, name: d.cname }); }
  });

  /* native minimal editors — legacy fallbacks (items use renderItemFiche) */
  function fieldRow(label, id, value, ph) {
    return '<label class="dtf-field"><span>' + label + '</span><input id="' + id + '" value="' + App.esc(value || '') + '" placeholder="' + App.esc(ph || '') + '"></label>';
  }
  function saver(ref, hit) {
    var deb = App.debounce(function () { Store.put(ref, hit.json).catch(function (e) { console.error(e); }); }, 500);
    return deb;
  }
  function renderLocationFiche(body, ref, hit) {
    var j = hit.json, save = saver(ref, hit);
    body.innerHTML = '<div class="dtf">' +
      '<div class="dtf-head"><input class="dtf-name" id="lf-name" value="' + App.esc(j.name || '') + '"></div>' +
      fieldRow('District', 'lf-district', j.district, 'Watson, Combat Zone…') +
      '<label class="dtf-field dtf-notes"><span>Description / notes</span><textarea id="lf-notes">' + App.esc(j.notes || '') + '</textarea></label>' +
      '<p class="dt-hint">This record also opens from the MAP.</p></div>';
    body.querySelector('#lf-name').oninput = function (e) { j.name = e.target.value; save(); };
    body.querySelector('#lf-district').oninput = function (e) { j.district = e.target.value; save(); };
    body.querySelector('#lf-notes').oninput = function (e) { j.notes = e.target.value; save(); };
  }
  function renderShopFicheNative(body, ref, hit) {
    var j = hit.json, save = saver(ref, hit);
    body.innerHTML = '<div class="dtf">' +
      '<div class="dtf-head"><input class="dtf-name" id="sf-name" value="' + App.esc(j.name || '') + '"></div>' +
      fieldRow('Type', 'sf-kind', j.kind, 'storefront, online, clinic…') +
      '<div class="dtf-field"><span>Articles</span><div class="dtf-items">' + ((j.items || []).map(function (it) { return '<span class="dtf-item">' + App.esc(it.name) + (it.qty != null ? ' ×' + it.qty : '') + '</span>'; }).join('') || '—') + '</div></div>' +
      '<p class="dt-hint">The full shop editor covers palette, shelf, prices and stock.</p></div>';
    body.querySelector('#sf-name').oninput = function (e) { j.name = e.target.value; save(); };
    body.querySelector('#sf-kind').oninput = function (e) { j.kind = e.target.value; save(); };
  }

  /* item fiche — container-aware, with the searchable DB sidebar (drag & drop) */
  function renderItemFiche(body, ref, hit) {
    var j = hit.json, save = saver(ref, hit);
    var isContainer = j.kind === 'container';
    body.innerHTML = '<div class="dtf dtf-split">' +
      '<div class="dtf-main">' +
        '<div class="dtf-head"><input class="dtf-name" id="if-name" value="' + App.esc(j.name || '') + '">' +
        '<select id="if-kind"><option value="object"' + (!isContainer ? ' selected' : '') + '>Object</option><option value="container"' + (isContainer ? ' selected' : '') + '>Container</option></select></div>' +
        '<label class="dtf-field dtf-notes"><span>Notes</span><textarea id="if-notes">' + App.esc(j.notes || '') + '</textarea></label>' +
        '<div id="if-nodes"></div>' +
      '</div>' +
      '<div class="dtf-db" id="if-db"></div>' +
    '</div>';
    body.querySelector('#if-name').oninput = function (e) { j.name = e.target.value; save(); };
    body.querySelector('#if-notes').oninput = function (e) { j.notes = e.target.value; save(); };
    body.querySelector('#if-kind').onchange = function (e) { j.kind = e.target.value; if (j.kind === 'container' && !Array.isArray(j.nodes)) j.nodes = []; save(); renderItemFiche(body, ref, hit); };
    if (isContainer) paintNodes();
    paintDbSidebar();

    /* Container contents — modeled after the player-sheet inventory: every
       container (root and nested, any depth) is a boxed section with its own
       item cards, its own drop zone and its own add row. */
    function findNode(nodes, nid) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nid) return { list: nodes, i: i, n: nodes[i] };
        if (nodes[i].type === 'container') {
          var hitC = findNode(nodes[i].children || (nodes[i].children = []), nid);
          if (hitC) return hitC;
        }
      }
      return null;
    }
    function listFor(cid2) {
      if (cid2 === 'root') return j.nodes || (j.nodes = []);
      var f = findNode(j.nodes || (j.nodes = []), cid2);
      return f && f.n.type === 'container' ? (f.n.children || (f.n.children = [])) : null;
    }
    function paintNodes() {
      var box = body.querySelector('#if-nodes');
      function containerHtml(cid2, name, nodes, depth) {
        var cards = nodes.map(function (n) {
          if (n.type === 'money') return '<div class="if-card if-card-res"><span class="if-card-name">' + App.esc(String(n.amount || 0)) + ' eb</span><span class="if-card-cat">MONEY</span><button class="dt-x" data-rm="' + n.id + '">✕</button></div>';
          if (n.type === 'ip') return '<div class="if-card if-card-res"><span class="if-card-name">' + App.esc(String(n.amount || 0)) + ' IP</span><span class="if-card-cat">IMPROVEMENT</span><button class="dt-x" data-rm="' + n.id + '">✕</button></div>';
          if (n.type === 'container') return containerHtml(n.id, n.name || 'Container', n.children || [], depth + 1);
          return '<div class="if-card"><span class="if-card-name">' + App.esc(n.name || '?') + '</span><span class="if-card-cat">' + App.esc((n.cat || '').toUpperCase()) + '</span>' +
            (n.data && n.data.cost ? '<span class="if-card-cost">' + App.esc(String(n.data.cost)) + '</span>' : '') +
            '<button class="dt-x" data-rm="' + n.id + '">✕</button></div>';
        }).join('');
        return '<div class="if-box' + (depth ? ' if-box-sub' : '') + '">' +
          '<div class="if-box-head"><span>' + App.esc(name) + '</span><i>' + nodes.length + '</i>' +
          (depth ? '<button class="dt-x" data-rm="' + cid2 + '" title="Remove container">✕</button>' : '') + '</div>' +
          '<div class="if-box-drop" data-drop="' + cid2 + '">' + (cards || '<span class="dt-dim">empty — drop objects here</span>') + '</div>' +
          '<div class="if-box-add"><button class="dt-btn" data-add-eb="' + cid2 + '">+ eb</button>' +
          '<button class="dt-btn" data-add-ip="' + cid2 + '">+ IP</button>' +
          '<button class="dt-btn" data-add-sub="' + cid2 + '">+ container</button></div></div>';
      }
      box.innerHTML = containerHtml('root', j.name || 'Contents', j.nodes || (j.nodes = []), 0);

      box.querySelectorAll('[data-drop]').forEach(function (drop) {
        drop.ondragover = function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); };
        drop.ondragleave = function () { drop.classList.remove('over'); };
        drop.ondrop = function (e) {
          e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
          try {
            var d = JSON.parse(e.dataTransfer.getData('text/plain'));
            var list = listFor(drop.getAttribute('data-drop'));
            if (d && d.__db && list) { list.push({ id: App.uid('ln'), type: 'item', cat: d.cat, name: d.name, data: d.data, share: 'shared' }); save(); paintNodes(); }
          } catch (err) {}
        };
      });
      box.querySelectorAll('[data-rm]').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var f = findNode(j.nodes || [], b.getAttribute('data-rm'));
          if (f) { f.list.splice(f.i, 1); save(); paintNodes(); }
        };
      });
      box.querySelectorAll('[data-add-eb]').forEach(function (b) {
        b.onclick = function () { App.prompt('Add money', 'Amount (eb)', '100', function (raw) { var v = parseInt(raw, 10), list = listFor(b.getAttribute('data-add-eb')); if (v && list) { list.push({ id: App.uid('ln'), type: 'money', amount: v, form: 'eddies', share: 'shared' }); save(); paintNodes(); } }); };
      });
      box.querySelectorAll('[data-add-ip]').forEach(function (b) {
        b.onclick = function () { App.prompt('Add IP', 'Improvement points', '10', function (raw) { var v = parseInt(raw, 10), list = listFor(b.getAttribute('data-add-ip')); if (v && list) { list.push({ id: App.uid('ln'), type: 'ip', amount: v, share: 'shared' }); save(); paintNodes(); } }); };
      });
      box.querySelectorAll('[data-add-sub]').forEach(function (b) {
        b.onclick = function () { App.prompt('New container', 'Name', 'Crate', function (nm) { var list = listFor(b.getAttribute('data-add-sub')); if (nm && list) { list.push({ id: App.uid('ln'), type: 'container', name: nm, children: [], share: 'shared' }); save(); paintNodes(); } }); };
      });
    }
    function paintDbSidebar() {
      var side = body.querySelector('#if-db');
      var cats = DB_DEFS.filter(function (d) { return d[3] === true; });
      side.innerHTML = '<div class="dt-head">DATABASE</div>' +
        '<select id="ifdb-cat">' + cats.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('') + '</select>' +
        '<input id="ifdb-q" placeholder="search…"><div id="ifdb-list" class="ifdb-list"></div>';
      var cat = cats[0][0];
      function paintList() {
        dbLoad(cat).then(function (rows) {
          var q = (body.querySelector('#ifdb-q').value || '').toLowerCase();
          var hits = rows.filter(function (r) { return !q || String(r.name || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
          var list = body.querySelector('#ifdb-list');
          list.innerHTML = hits.map(function (r, i) { return '<div class="ifdb-row" draggable="true" data-i="' + i + '">' + App.esc(r.name || '?') + '<small>' + App.esc(String(r.cost || '')) + '</small></div>'; }).join('') || '<div class="dt-dim">no matches</div>';
          list.querySelectorAll('.ifdb-row').forEach(function (rEl) {
            rEl.ondragstart = function (e) { var r = hits[+rEl.getAttribute('data-i')]; e.dataTransfer.setData('text/plain', JSON.stringify({ __db: true, cat: cat, name: r.name, data: r })); };
          });
        });
      }
      body.querySelector('#ifdb-cat').onchange = function (e) { cat = e.target.value; paintList(); };
      body.querySelector('#ifdb-q').oninput = App.debounce(paintList, 150);
      paintList();
    }
  }

  /* ═══ DATABASE PANE (lore datasets + promotion) ═══ */
  // Sort DB rows by a column (numeric where both values parse; blanks last).
  function dbSortRows(arr, sort) {
    if (!sort || !sort.col) return arr;
    var col = sort.col, dir = sort.dir === 'desc' ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      var av = a[col], bv = b[col], ae = av == null || av === '', be = bv == null || bv === '';
      if (ae && be) return 0; if (ae) return 1; if (be) return -1;
      var an = parseFloat(av), bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn) && /^[\s$eb\d.,+\-]+$/i.test(String(av)) && /^[\s$eb\d.,+\-]+$/i.test(String(bv))) return (an - bn) * dir;
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }
  function renderDbPane(t, host) {
    host.className = 'tab-content dt-pane';
    var cur = t.db || DB_DEFS[0][0];
    var def = DB_DEFS.filter(function (d) { return d[0] === cur; })[0];
    host.innerHTML =
      '<div class="dt-bar"><span class="dt-title">DATABASE</span>' +
      '<select class="dt-dbsel">' + DB_DEFS.map(function (d) { return '<option value="' + d[0] + '"' + (d[0] === cur ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select>' +
      '<input class="dt-search" placeholder="search…"><span class="dt-hint-inline">' + (isPlayer() ? 'reference' : (def[3] === false ? 'reference only' : def[3] === 'org' ? '＋ → campaign ORG record' : '＋ → campaign ITEMS')) + '</span></div>' +
      '<div class="dt-body"></div>';
    var body = host.querySelector('.dt-body');
    var sort = null;
    function paint() {
      dbLoad(cur).then(function (rows) {
        var q = (host.querySelector('.dt-search').value || '').toLowerCase();
        var filtered = rows.filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0; });
        var hits = dbSortRows(filtered, sort).slice(0, 3000);
        var d2 = DB_DEFS.filter(function (x) { return x[0] === cur; })[0];
        var promotable = d2[3] !== false && !isPlayer();
        var cols = Object.keys(hits[0] || { name: 1 }).filter(function (k) { return typeof (hits[0] || {})[k] !== 'object'; }).slice(0, 6);
        var tbl = document.createElement('table');
        tbl.className = 'vw-table';
        tbl.innerHTML = '<thead><tr>' + cols.map(function (c) { var ar = sort && sort.col === c ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''; return '<th data-sort="' + App.esc(c) + '" style="cursor:pointer;user-select:none">' + App.esc(c) + ar + '</th>'; }).join('') + (promotable ? '<th></th>' : '') + '</tr></thead><tbody>' +
          hits.map(function (r, i) {
            return '<tr data-i="' + i + '">' + cols.map(function (c) { return '<td>' + App.esc(String(r[c] == null ? '' : r[c])) + '</td>'; }).join('') +
              (promotable ? '<td class="vw-td-dots"><button class="dt-promote" data-p="' + i + '" title="Add to campaign">＋</button></td>' : '') + '</tr>';
          }).join('') + '</tbody>';
        body.innerHTML = ''; body.appendChild(tbl);
        tbl.querySelectorAll('[data-p]').forEach(function (b) {
          b.onclick = function () { promote(cur, hits[+b.getAttribute('data-p')], d2[3]); };
        });
        tbl.querySelectorAll('[data-sort]').forEach(function (th) { th.onclick = function () { var c = th.getAttribute('data-sort'); sort = (sort && sort.col === c) ? { col: c, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { col: c, dir: 'asc' }; paint(); }; });
      });
    }
    host.querySelector('.dt-dbsel').onchange = function (e) { t.db = e.target.value; renderDbPane(t, host); };
    host.querySelector('.dt-search').oninput = App.debounce(paint, 200);
    paint();
  }
  function promote(dbKey, row, mode) {
    if (mode === 'org') {
      // corporation → prefilled campaign ORG (copy; lore untouched)
      var org = {
        name: row.name || 'Corporation', type: 'corporation',
        tagline: row.motto || row.tagline || '', headquarters: row.hq || row.headquarters || '',
        general: { publicSummary: row.description || row.notes || '', privateSummary: '', keyMissions: [] },
        market: { publicData: { revenue: row.revenue || '', employees: row.employees || '', notes: '' } },
        source: { db: dbKey, key: row.name, custom: false },
        props: {},
      };
      Store.create('org', org).then(function (made) { refreshSide(); Shell.openEntity('org', made.json.id, org.name); });
    } else {
      Store.create('item', { name: row.name || 'Object', kind: 'object', notes: '', data: row, source: { db: dbKey, key: row.name || '' }, props: {} })
        .then(function (made) { refreshSide(); Shell.openEntity('item', made.json.id, row.name); });
    }
  }

  /* ═══ DATA HOME — the "vue totale" (types grid + saved views + database) ═══
     Replaces the old #section-side tree: it's now the default DATA tab pane. */
  /* Unicode glyphs (DS house rule: never SVG icon sets) */
  var DH_ICON = { npc: '☺', org: '⌗', location: '◰', shop: '▣', item: '◈', contacts: '⒞', view: '▦', database: '▤' };
  function dhSvg(name) { return '<span class="dh-ic" aria-hidden="true">' + (DH_ICON[name] || '·') + '</span>'; }
  function renderHome(t, host) {
    var player = isPlayer();
    host.className = 'tab-content dh';
    host.innerHTML =
      '<div class="dh-bar"><span class="dh-title">DATA</span></div>' +
      '<div class="dh-scroll">' +
        '<div class="dh-sec-h">Types</div>' +
        '<div class="dh-grid" id="dh-types">' +
          TYPES.map(function (ty) {
            return '<div class="dh-card" role="button" tabindex="0" data-dtype="' + ty.type + '">' +
              '<span class="dh-card-l">' + App.esc(ty.label) + '</span>' +
              '<span class="dh-card-n" data-count="' + ty.type + '">–</span>' +
              (player ? '' : '<button class="dh-card-new" data-new="' + ty.type + '" title="Create">＋</button>') +
              '</div>';
          }).join('') +
        '</div>' +
        '<div class="dh-sec-h">Views</div>' +
        '<div class="dh-grid dh-grid-v" id="dh-views">' +
          '<div class="dh-card dh-card-view" role="button" tabindex="0" data-builtin="contacts">' +
            '<span class="dh-card-l">Contacts</span><span class="dh-card-n">NPC</span></div>' +
          (player ? '' : Views.savedViews().map(function (v) {
            return '<div class="dh-card dh-card-view" role="button" tabindex="0" data-view="' + v.id + '">' +
              '<span class="dh-card-l">' + App.esc(v.name) + '</span>' +
              '<span class="dh-card-n">' + App.esc(TYPE_LABEL[v.type] || v.type) + '</span></div>';
          }).join('') +
          '<div class="dh-card dh-card-add" role="button" tabindex="0" data-mkview><span class="dh-card-l">＋ New view</span></div>') +
          '<div class="dh-card dh-card-db" role="button" tabindex="0" data-db><span class="dh-card-l">Database</span><span class="dh-card-n">lore</span></div>' +
        '</div>' +
        '<div id="dh-extra"></div>' +
      '</div>';
    // counts + the third band: starter actions on an empty corpus, RECENT once
    // records exist (the corpus home doubles as the datafort's progress board)
    Promise.all(TYPES.map(function (ty) {
      return Store.index(ty.type).then(function (rows) {
        return player ? rows.filter(function (r) { return Store.visibleToPlayers(r.json); }) : rows;
      }).catch(function () { return []; });
    })).then(function (all) {
      TYPES.forEach(function (ty, i) {
        var n = host.querySelector('[data-count="' + ty.type + '"]'); if (n) n.textContent = all[i].length;
      });
      var extra = host.querySelector('#dh-extra'); if (!extra) return;
      var flat = [];
      all.forEach(function (rows, i) { rows.forEach(function (r) { flat.push({ type: TYPES[i].type, row: r }); }); });
      if (!flat.length) {
        if (player) { extra.innerHTML = ''; return; }
        extra.innerHTML =
          '<div class="dh-sec-h">Start the datafort</div>' +
          '<div class="dh-start">' +
            '<button class="dh-start-a" data-start="npc">Generate an NPC</button>' +
            '<button class="dh-start-a" data-start="db">Promote lore from the Database</button>' +
            '<button class="dh-start-a" data-start="location">Write a location</button>' +
          '</div>';
        extra.querySelectorAll('[data-start]').forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-start');
            if (k === 'db') return openDb();
            newEntityFlow(k, {});
          };
        });
        return;
      }
      flat.sort(function (a, b) { return (b.row.mtime || 0) - (a.row.mtime || 0); });
      var rec = flat.slice(0, 8);
      extra.innerHTML = '<div class="dh-sec-h">Recent</div><div class="dh-recent">' + rec.map(function (e, i) {
        return '<button class="dh-rec" data-rec="' + i + '">' +
          '<span class="dh-rec-n">' + App.esc(Store.displayName(e.row)) + '</span>' +
          '<span class="dh-rec-t">' + App.esc(e.type) + '</span></button>';
      }).join('') + '</div>';
      extra.querySelectorAll('[data-rec]').forEach(function (b) {
        b.onclick = function () {
          var e = rec[+b.getAttribute('data-rec')];
          Shell.openEntity(e.type, e.row.json.id || e.row.ref.id, Store.displayName(e.row));
        };
      });
    });
    function activate(d) {
      if (d.hasAttribute('data-dtype')) return openTypeView(d.getAttribute('data-dtype'));
      if (d.hasAttribute('data-builtin')) return Shell.openDataTab({ tool: 'data-view', dtype: 'npc', builtin: 'contacts', label: 'Contacts' });
      if (d.hasAttribute('data-view')) return openSavedView(d.getAttribute('data-view'));
      if (d.hasAttribute('data-mkview')) return newViewModal();
      if (d.hasAttribute('data-db')) return openDb();
    }
    host.querySelectorAll('.dh-card').forEach(function (d) {
      d.onclick = function (e) { if (e.target.closest('[data-new]')) return; activate(d); };
      d.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(d); } };
    });
    host.querySelectorAll('[data-new]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); newEntityFlow(b.getAttribute('data-new'), {}); };
    });
  }

  window.DataSection = {
    renderSide: renderSide,
    renderHome: renderHome,
    renderViewPane: renderViewPane,
    renderDbPane: renderDbPane,
    renderFiche: renderFiche,
    openTypeView: openTypeView,
  };
})();
