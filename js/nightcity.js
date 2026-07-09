/* ═══════════════════════════════════════════════════════════════════════
   Night City Map — Player Log & GM Planner modes
   Layered on top of the existing read-only reference engine (inline DATA +
   selectDistrict/renderMapTab in nightcity.html). Loaded AFTER the inline
   script, so it shares the global scope and can read DATA / currentDistrict
   and wrap the reference render functions.

   Addressing model (no pixel pins): a "Place" = district + building number
   (the id printed on the district PNG) + floor. Player notes act as a legend.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Utilities ─── */
  function _uid() { return 'nc-' + Math.random().toString(36).substr(2, 9); }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ─── Location types (preset + custom) ─── */
  var TYPES = [
    { key: 'corpo',       label: 'Corporation',     color: '#c0392b' },
    { key: 'bar',         label: 'Bar',             color: '#b8860b' },
    { key: 'club',        label: 'Club',            color: '#8e44ad' },
    { key: 'shop',        label: 'Shop',            color: '#2980b9' },
    { key: 'ripperdoc',   label: 'Ripperdoc/Clinic',color: '#16a085' },
    { key: 'gang',        label: 'Gang turf',       color: '#7f2d2d' },
    { key: 'safehouse',   label: 'Safehouse',       color: '#27ae60' },
    { key: 'fixer',       label: 'Fixer',           color: '#d35400' },
    { key: 'resto',       label: 'Restaurant',      color: '#e67e22' },
    { key: 'hotel',       label: 'Hotel',           color: '#9b59b6' },
    { key: 'gov',         label: 'Gov / Police',    color: '#2c3e50' },
    { key: 'datafort',    label: 'Data fort',       color: '#1abc9c' },
    { key: 'nomad',       label: 'Nomad',           color: '#a0522d' },
    { key: 'media',       label: 'Media',           color: '#e84393' },
    { key: 'transport',   label: 'Transport',       color: '#34495e' },
    { key: 'blackmarket', label: 'Black market',    color: '#000000' },
    { key: 'combatzone',  label: 'Combat zone',     color: '#e74c3c' },
    { key: 'residential', label: 'Residential',     color: '#7f8c8d' },
    { key: 'other',       label: 'Other',           color: '#95a5a6' }
  ];
  function typeMeta(type) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === type) return TYPES[i];
    return null;
  }
  function typeLabel(type) { var m = typeMeta(type); return m ? m.label : (type || 'Other'); }
  function typeColor(type) {
    var m = typeMeta(type); if (m) return m.color;
    // custom type → stable hashed HSL
    var h = 0, s = String(type || 'other');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',55%,42%)';
  }

  /* ─── State ─── */
  var NC_MODE = 'ref';                                  // 'ref' | 'player' | 'gm'
  var PLAYER = { entries: [], home: null, gmLayers: [], districtExtras: {}, maps: [], mapOrder: ['nc'] }; // single player notebook
  var GM = { list: [], active: 0, maps: [], order: ['nc'] };  // notebooks (tabs) + custom maps
  var _surface = 'world';                                // active map surface: 'world' | 'nc' | <customMapId>
  var _shopLocs = {};                                    // lowercased location names that host a shop (from the app shell)
  // Open the shop linked to this location (the app shell handles the actual navigation).
  window.ncOpenShop = function (enc) { try { window.parent.postMessage({ type: 'nc-open-shop', name: decodeURIComponent(enc) }, '*'); ncModalClose(); } catch (e) {} };
  // Custom-map places share the full Night City place shape (photos, security…).
  function _migrateCustomPlace(p) { var m = _migratePlace(p || {}); m.pin = (p && p.pin && typeof p.pin.x === 'number') ? { x: p.pin.x, y: p.pin.y } : (m.pin || null); return m; }
  function _migrateMap(m) {
    m = m || {};
    return { id: m.id || _uid(), name: m.name || 'Map', kind: m.kind === 'list' ? 'list' : 'map',
      image: m.image || null, w: m.w || 0, h: m.h || 0, entries: Array.isArray(m.entries) ? m.entries.map(_migrateCustomPlace) : [],
      // Nested maps: a linked map hangs off a parent surface ('world'|'nc'|<mapId>) + the source location.
      parentMapId: m.parentMapId || null, parentLocId: m.parentLocId || null, srcName: m.srcName || '' };
  }
  var ncCurrentDistrict = null;
  var NC_GRID_ORDER = ['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','B6','C1','C2','C3','C4','C5','C6'];
  var _LS_PLAYER = 'bartmoss_nc_player';
  var _LS_GM = 'bartmoss_nc_gm';
  // App-embed: ?campaign=<id>&ncrole=gm|player. GM stores its plan in the
  // campaign (so it persists per-campaign and syncs); player keeps a local log.
  var _NCQS = new URLSearchParams(location.search);
  var _CAMPAIGN = _NCQS.get('campaign');
  var _NCROLE = _NCQS.get('ncrole');
  var _GM_API = !!_CAMPAIGN && _NCROLE === 'gm';
  function _campDocUrl() { return '/__api/campaigns/' + encodeURIComponent(_CAMPAIGN) + '/nightcity/_campaign.json'; }
  function _publicPlaces() { var nb = GM.list[GM.active]; return nb ? (nb.entries || []).filter(function (e) { return e.public; }) : []; }
  function _publicMaps() {   // public + linked (lore) maps in the GM-chosen order
    _ncEnsureOrder();
    var byId = {}; GM.maps.forEach(function (m) { byId[m.id] = m; });
    var ids = GM.order.filter(function (id) { return id !== 'nc' && byId[id]; });
    GM.maps.forEach(function (m) { if (ids.indexOf(m.id) < 0) ids.push(m.id); });
    var out = [];
    ids.forEach(function (id) {
      var m = byId[id]; if (!m) return;
      var pub = (m.entries || []).filter(function (e) { return e.public; });
      // Linked (nested) maps are canon lore → auto-shared even without public pins.
      if (!pub.length && !m.parentMapId) return;
      out.push({ id: m.id, name: m.name, kind: m.kind, image: m.image, w: m.w, h: m.h, gmEntries: pub,
        parentMapId: m.parentMapId || null, parentLocId: m.parentLocId || null, srcName: m.srcName || '' });
    });
    return out;
  }
  function _publicWorldCities() {   // GM city lore auto-shared (desc + linked map), never GM notes
    var cd = (GM.world && GM.world.cityData) || {}, out = {};
    Object.keys(cd).forEach(function (name) { var r = cd[name]; if (r && (r.desc || r.linkedMapId)) out[name] = { desc: r.desc || '', linkedMapId: r.linkedMapId || null }; });
    return out;
  }
  function _publicWorldPlaces() { return ((GM.world && GM.world.places) || []).filter(function (e) { return e.public; }); }
  function _postPublic() {
    if (window.parent === window) return;
    var maps = _publicMaps(), pubIds = maps.map(function (m) { return m.id; });
    var order = (GM.order || ['nc']).filter(function (id) { return id === 'nc' || pubIds.indexOf(id) >= 0; });
    try { window.parent.postMessage({ type: 'nc-gm-public', campaign: _CAMPAIGN, places: _publicPlaces(), maps: maps, order: order, worldPlaces: _publicWorldPlaces(), worldCities: _publicWorldCities() }, '*'); } catch (e) {}
  }

  /* ─── Persistence (debounced, quota-safe) ─── */
  var _saveTimer = null;
  function _schedSave() { clearTimeout(_saveTimer); _saveTimer = setTimeout(_flushSave, 600); }
  function _flushSave() {
    if (_GM_API) {
      try { fetch(_campDocUrl(), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ _kind: 'nc-campaign-gm', GM: GM }) }); } catch (e) {}
      _postPublic();   // live-update players with the current public locations
      return;
    }
    try {
      // Don't persist live session-synced data (re-pushed each session): synced
      // GM layers, and synced public pins (gmEntries) on custom maps.
      var persist = Object.assign({}, PLAYER, {
        gmLayers: PLAYER.gmLayers.filter(function (L) { return !L.synced; }),
        maps: (PLAYER.maps || []).map(function (m) { return Object.assign({}, m, { gmEntries: [] }); })
      });
      localStorage.setItem(_LS_PLAYER, JSON.stringify(persist));
      localStorage.setItem(_LS_GM, JSON.stringify(GM));
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        alert('Local storage is full (likely from imported map/photo images).\nExport your log/notebook to JSON to keep it safe, then remove some images.');
      }
    }
  }
  function _loadCampaignGM(cb) {
    fetch(_campDocUrl()).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      var g = d && d.GM;
      if (g && Array.isArray(g.list) && g.list.length) {
        GM.list = g.list.map(function (nb) { return { id: nb.id || _uid(), name: nb.name || 'Plan', entries: (nb.entries || []).map(_migratePlace), districtExtras: (nb.districtExtras && typeof nb.districtExtras === 'object') ? nb.districtExtras : {} }; });
        GM.active = Math.min(Math.max(0, g.active || 0), GM.list.length - 1);
        GM.maps = Array.isArray(g.maps) ? g.maps.map(_migrateMap) : [];
        GM.order = Array.isArray(g.order) ? g.order : ['nc'];
      }
      if (!GM.list.length) GM.list = [{ id: _uid(), name: 'Plan 1', entries: [], districtExtras: {} }];
      _ncEnsureOrder();
      cb();
    });
  }
  function _load() {
    try {
      var p = JSON.parse(localStorage.getItem(_LS_PLAYER) || 'null');
      if (p && typeof p === 'object') {
        PLAYER.entries = Array.isArray(p.entries) ? p.entries.map(_migratePlace) : [];
        PLAYER.home = p.home || null;
        PLAYER.gmLayers = Array.isArray(p.gmLayers) ? p.gmLayers : [];
        PLAYER.gmLayers.forEach(function (L) { L.entries = (L.entries || []).map(_migratePlace); if (L.hidden == null) L.hidden = false; });
        PLAYER.districtExtras = (p.districtExtras && typeof p.districtExtras === 'object') ? p.districtExtras : {};
        PLAYER.maps = Array.isArray(p.maps) ? p.maps.map(function (m) { var mm = _migrateMap(m); mm.gmEntries = Array.isArray(m.gmEntries) ? m.gmEntries.map(_migrateCustomPlace) : []; return mm; }) : [];
        PLAYER.mapOrder = Array.isArray(p.mapOrder) ? p.mapOrder : ['nc'];
      }
    } catch (e) { /* keep defaults */ }
    try {
      var g = JSON.parse(localStorage.getItem(_LS_GM) || 'null');
      if (g && Array.isArray(g.list)) {
        GM.list = g.list.map(function (nb) { return { id: nb.id || _uid(), name: nb.name || 'Plan', entries: (nb.entries || []).map(_migratePlace), districtExtras: (nb.districtExtras && typeof nb.districtExtras === 'object') ? nb.districtExtras : {} }; });
        GM.active = Math.min(Math.max(0, g.active || 0), Math.max(0, GM.list.length - 1));
        GM.maps = Array.isArray(g.maps) ? g.maps.map(_migrateMap) : [];
        GM.order = Array.isArray(g.order) ? g.order : ['nc'];
      }
    } catch (e) { /* keep defaults */ }
    if (!GM.list.length) GM.list = [{ id: _uid(), name: 'Plan 1', entries: [], districtExtras: {} }];
    _ncEnsureOrder();
  }
  /* District-scoped extras (Other tab) for the active doc: { notes, people:[{id,name,desc}] } */
  function activeExtrasStore() {
    if (NC_MODE === 'gm') { var nb = GM.list[GM.active]; if (!nb.districtExtras) nb.districtExtras = {}; return nb.districtExtras; }
    if (!PLAYER.districtExtras) PLAYER.districtExtras = {};
    return PLAYER.districtExtras;
  }
  function activeExtras(code) {
    var store = activeExtrasStore();
    if (!store[code]) store[code] = { notes: '', people: [] };
    if (!Array.isArray(store[code].people)) store[code].people = [];
    if (store[code].notes == null) store[code].notes = '';
    return store[code];
  }

  /* ─── Place factory / migration ─── */
  function makePlace(districtCode) {
    return { id: _uid(), district: districtCode || '', building: '', floor: '', name: '', type: 'other',
      notes: '', security: '', photos: [], hackedMaps: [], visited: false, public: false, createdAt: Date.now() };
  }
  function _migratePlace(p) {
    if (!p || typeof p !== 'object') return makePlace('');
    if (!p.id) p.id = _uid();
    if (p.district == null) p.district = '';
    if (p.building == null) p.building = '';
    if (p.floor == null) p.floor = '';
    if (p.name == null) p.name = '';
    if (!p.type) p.type = 'other';
    if (p.notes == null) p.notes = '';
    if (p.security == null) p.security = '';
    if (!Array.isArray(p.photos)) p.photos = [];
    if (!Array.isArray(p.hackedMaps)) p.hackedMaps = [];
    if (p.visited == null) p.visited = false;
    if (p.public == null) p.public = false;
    if (p.linkedMapId === undefined) p.linkedMapId = null;
    if (p.createdAt == null) p.createdAt = Date.now();
    return p;
  }

  /* ─── Which entries are editable in the current mode ─── */
  function activeEntries() {
    if (NC_MODE === 'player') return PLAYER.entries;
    if (NC_MODE === 'gm') { var nb = GM.list[GM.active]; return nb ? nb.entries : []; }
    return [];
  }
  function entriesForDistrict(arr, code) { return (arr || []).filter(function (e) { return e.district === code; }); }
  function findEntry(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  /* ═══ MODE SWITCH ═══ */
  window.ncSetMode = function (mode) {
    NC_MODE = mode;
    document.querySelectorAll('#nc-modebar .nc-mode').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.body.setAttribute('data-nc-mode', mode);
    ncApplyModeToDistrictView();
    ncRenderCtxBar();
    ncRenderSidePanel();
    ncRenderMapsBar();
    ncRefreshDistrict();
    // atlas legend depends on mode
    var atlas = document.getElementById('view-atlas');
    if (atlas && atlas.style.display !== 'none') ncRenderAtlas();
  };

  /* Refresh whatever district sub-views are live (legend + Other tab). */
  function ncRefreshDistrict() {
    if (!ncCurrentDistrict) return;
    ncAugmentLegend(ncCurrentDistrict);
    if (NC_MODE !== 'ref') ncRenderOtherTab(ncCurrentDistrict);
  }
  /* After any data change: refresh district sub-views + atlas legend if visible. */
  function ncAfterChange() {
    ncRefreshDistrict();
    var atlas = document.getElementById('view-atlas');
    if (atlas && atlas.style.display !== 'none') ncRenderAtlas();
  }

  function _activeTab() { var t = document.querySelector('.dv-tab.active'); return t ? t.dataset.tab : null; }
  /* In player/GM mode: hide reference Overview tab, expose the Other tab, keep Map first. */
  function ncApplyModeToDistrictView() {
    var ovBtn = document.querySelector('.dv-tab[data-tab="overview"]');
    var otherBtn = document.querySelector('.dv-tab[data-tab="other"]');
    var dv = document.getElementById('district-view');
    var inDistrict = dv && dv.style.display !== 'none';
    if (NC_MODE === 'ref') {
      if (ovBtn) ovBtn.style.display = '';
      if (otherBtn) otherBtn.style.display = 'none';
      if (inDistrict && _activeTab() === 'other' && typeof switchTab === 'function') switchTab('overview');
    } else {
      if (ovBtn) ovBtn.style.display = 'none';
      if (otherBtn) otherBtn.style.display = '';
      if (inDistrict && (_activeTab() === 'overview' || !_activeTab()) && typeof switchTab === 'function') switchTab('map');
    }
  }

  /* ═══ CONTEXT BAR (under #nav) ═══ */
  // The standalone GM PLANNER / PLAYER LOG top bar is gone — its controls (plans list, new plan,
  // import/export) now live in the maps-bar hamburger dropdown (ncPlannerMenu). This just hides the
  // legacy bar and, if the dropdown is open, rebuilds it so existing call-sites keep refreshing it.
  function ncRenderCtxBar() {
    var bar = document.getElementById('nc-ctxbar');
    if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
    if (document.getElementById('nc-planner-menu')) ncPlannerMenuBuild();
  }

  /* ═══ SIDE PANEL (under #district-list) ═══ */
  function ncRenderSidePanel() {
    var el = document.getElementById('nc-side-panel'); if (!el) return;
    if (NC_MODE === 'player' && PLAYER.gmLayers.length) {
      el.style.display = 'block';
      el.innerHTML = '<div class="nc-side-title">GM LAYERS</div>' + PLAYER.gmLayers.map(function (L, i) {
        return '<div class="nc-layer-row">' +
          '<label><input type="checkbox"' + (L.hidden ? '' : ' checked') + ' onchange="ncToggleLayer(' + i + ')"> ' + _esc(L.name) + '</label>' +
          '<span class="nc-layer-count">' + L.entries.length + '</span>' +
          '<span class="nc-layer-rm" onclick="ncRemoveLayer(' + i + ')" title="Remove layer">✕</span>' +
          '</div>';
      }).join('');
    } else if (NC_MODE === 'gm') {
      el.style.display = 'block';
      var nb = GM.list[GM.active];
      el.innerHTML = '<div class="nc-side-title">GM NOTEBOOK</div>' +
        '<div class="nc-side-note">Select a district, then “+ Add here” in its Map tab to place a typed location. Export the notebook to share it with players.</div>' +
        '<div class="nc-side-note">' + (nb ? nb.entries.length : 0) + ' location(s) in “' + _esc(nb ? nb.name : '') + '”.</div>';
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }

  /* ═══ LEGEND AUGMENTATION (#tab-map) ═══ */
  function ncAugmentLegend(code) {
    var legend = document.querySelector('#tab-map .map-legend');
    if (!legend) return;
    var extra = document.getElementById('nc-legend-extra');
    if (!extra) {
      extra = document.createElement('div');
      extra.id = 'nc-legend-extra';
      legend.appendChild(extra);
    }
    if (NC_MODE === 'ref') { extra.innerHTML = ''; extra.style.display = 'none'; return; }
    extra.style.display = 'block';

    var html = '';

    // Player mode: imported GM locations at the TOP under "Known Locations".
    if (NC_MODE === 'player') {
      var knownHtml = '';
      PLAYER.gmLayers.forEach(function (L, li) {
        if (L.hidden) return;
        var le = entriesForDistrict(L.entries, code);
        le.forEach(function (e) { knownHtml += entryCard(e, true, li); });
      });
      if (knownHtml) {
        html += '<div class="nc-legend-bar nc-legend-bar-gm"><span>KNOWN LOCATIONS</span></div>' + knownHtml;
      }
    }

    // Editable entries for the active doc + "Add here".
    html += '<div class="nc-legend-bar">' +
      '<span>' + (NC_MODE === 'player' ? 'MY NOTES' : 'GM LOCATIONS') + '</span>' +
      '<button class="nc-btn nc-btn-sm" onclick="ncEntryModal(\'' + code + '\')">+ Add here</button>' +
      '</div>';
    var mine = entriesForDistrict(activeEntries(), code);
    if (mine.length) html += mine.map(function (e) { return entryCard(e, false); }).join('');
    else html += '<div class="nc-empty">No entries in this district yet.</div>';

    extra.innerHTML = html;
  }

  /* ═══ "OTHER" TAB — district-scoped notes + Contacts (player) / Personalities (GM) ═══ */
  function ncRenderOtherTab(code) {
    var el = document.getElementById('tab-other'); if (!el) return;
    if (NC_MODE === 'ref') { el.innerHTML = ''; return; }
    var x = activeExtras(code);
    var peopleLabel = NC_MODE === 'gm' ? 'PERSONALITIES' : 'CONTACTS';
    var people = (x.people || []).map(function (p) {
      return '<div class="nc-person">' +
        '<div class="nc-person-head"><span class="nc-person-name">' + _esc(p.name || '(unnamed)') + '</span>' +
        '<span class="nc-person-act" onclick="ncEditPerson(\'' + code + '\',\'' + p.id + '\')">edit</span>' +
        '<span class="nc-person-rm" onclick="ncRemovePerson(\'' + code + '\',\'' + p.id + '\')">✕</span></div>' +
        (p.desc ? '<div class="nc-person-desc">' + _esc(p.desc) + '</div>' : '') +
        '</div>';
    }).join('') || '<div class="nc-empty">None yet.</div>';
    el.innerHTML =
      '<div class="nc-other-sec"><div class="nc-other-title">NOTES</div>' +
        '<textarea class="nc-other-notes" rows="5" placeholder="District notes…" oninput="ncExtraNotes(\'' + code + '\',this.value)">' + _esc(x.notes) + '</textarea></div>' +
      '<div class="nc-other-sec"><div class="nc-other-title">' + peopleLabel +
        ' <button class="nc-btn nc-btn-sm" onclick="ncAddPerson(\'' + code + '\')">+ Add</button></div>' +
        '<div class="nc-people">' + people + '</div></div>';
  }
  window.ncExtraNotes = function (code, val) { activeExtras(code).notes = val; _schedSave(); ncRenderSidePanel(); };

  /* Contact / Personality popup */
  var _personDistrict = null, _personId = null;
  function ncPersonModal(code, id) {
    _personDistrict = code; _personId = id || null;
    var p = id ? findEntry(activeExtras(code).people, id) : null;
    var label = NC_MODE === 'gm' ? 'Personality' : 'Contact';
    var body =
      '<label class="nc-modal-lbl">Name<input id="nc-p-name" value="' + _esc(p ? p.name : '') + '" placeholder="name"></label>' +
      '<label class="nc-modal-lbl">Description<textarea id="nc-p-desc" rows="6" placeholder="role, attitude, ties, notes…">' + _esc(p ? p.desc : '') + '</textarea></label>' +
      '<div class="nc-modal-actions">' +
        (id ? '<button class="nc-btn nc-btn-danger" onclick="ncPersonDelete()">Delete</button>' : '') +
        '<span style="flex:1"></span>' +
        '<button class="nc-btn" onclick="ncModalClose()">Cancel</button>' +
        '<button class="nc-btn nc-btn-cy" onclick="ncPersonSave()">Save</button>' +
      '</div>';
    _ncModalOpen((id ? 'Edit ' : 'New ') + label, body);
  }
  window.ncAddPerson = function (code) { ncPersonModal(code, null); };
  window.ncEditPerson = function (code, id) { ncPersonModal(code, id); };
  window.ncPersonSave = function () {
    var name = (document.getElementById('nc-p-name').value || '').trim();
    if (!name) { alert('Enter a name.'); return; }
    var desc = (document.getElementById('nc-p-desc').value || '').trim();
    var x = activeExtras(_personDistrict);
    if (_personId) { var p = findEntry(x.people, _personId); if (p) { p.name = name; p.desc = desc; } }
    else { x.people.push({ id: _uid(), name: name, desc: desc }); }
    _schedSave(); ncModalClose(); ncRenderOtherTab(_personDistrict);
  };
  window.ncPersonDelete = function () {
    if (!_personId) return; if (!confirm('Delete this entry?')) return;
    var x = activeExtras(_personDistrict); x.people = x.people.filter(function (p) { return p.id !== _personId; });
    _schedSave(); ncModalClose(); ncRenderOtherTab(_personDistrict);
  };
  window.ncRemovePerson = function (code, id) {
    if (!confirm('Delete this entry?')) return;
    var x = activeExtras(code); x.people = x.people.filter(function (p) { return p.id !== id; });
    _schedSave(); ncRenderOtherTab(code);
  };

  function entryCard(e, readonly, layerIdx) {
    var col = typeColor(e.type);
    var addr = '#' + _esc(e.building || '?') + (e.floor ? '·F' + _esc(e.floor) : '');
    var isHome = (NC_MODE === 'player' && PLAYER.home === e.id);
    var photos = (e.photos || []).map(function (src, i) { return '<img class="nc-thumb" src="' + src + '" onclick="ncLightbox(\'' + e.id + '\',\'p\',' + i + ')">'; }).join('');
    var maps = (e.hackedMaps || []).map(function (m, i) { return '<img class="nc-thumb nc-thumb-map" src="' + m.dataUrl + '" title="' + _esc(m.label || m.filename || 'hacked map') + '" onclick="ncLightbox(\'' + e.id + '\',\'m\',' + i + ')">'; }).join('');
    var actions = readonly
      ? '<span class="nc-entry-act" onclick="ncViewEntry(' + layerIdx + ',\'' + e.id + '\')">view</span> <span class="nc-entry-act" onclick="ncCopyToLog(' + layerIdx + ',\'' + e.id + '\')">copy →</span>'
      : '<span class="nc-entry-act" onclick="ncEntryModal(\'' + e.district + '\',\'' + e.id + '\')">open</span>';
    return '<div class="nc-entry' + (e.visited ? ' nc-visited' : '') + '">' +
      '<div class="nc-entry-head">' +
        '<span class="nc-type-pill" style="background:' + col + '">' + _esc(typeLabel(e.type)) + '</span>' +
        '<span class="nc-entry-addr">' + addr + '</span>' +
        '<span class="nc-entry-name">' + (isHome ? '⌂ ' : '') + _esc(e.name || '(unnamed)') + '</span>' +
        (e.security !== '' && e.security != null ? '<span class="nc-entry-sec">SEC ' + _esc(e.security) + '</span>' : '') +
        (!readonly && NC_MODE === 'gm' && e.public ? '<span class="nc-entry-pub">PUBLIC</span>' : '') +
        (e.name && _shopLocs[String(e.name).toLowerCase()] ? '<span class="nc-entry-shop" onclick="ncOpenShop(\'' + encodeURIComponent(e.name) + '\')" title="Open the shop here">▣ shop</span>' : '') +
        '<span class="nc-entry-act-wrap">' + actions + '</span>' +
      '</div>' +
      (e.notes ? '<div class="nc-entry-notes">' + _esc(e.notes) + '</div>' : '') +
      ((photos || maps) ? '<div class="nc-thumbs">' + photos + maps + '</div>' : '') +
      '</div>';
  }

  /* ═══ ENTRY MODAL ═══ */
  var _modalEntryId = null, _modalDistrict = null, _modalDraft = null, _modalMapId = null, _modalReadonly = false, _modalLayerIdx = null, _modalMode = 'view';
  window.ncModalEdit = function () { _modalMode = 'edit'; _renderModal(); };
  window.ncEntryModal = function (districtCode, entryId, pin) {
    _modalDistrict = districtCode;
    _modalEntryId = entryId || null;
    _modalMapId = null; _modalReadonly = false; _modalLayerIdx = null;
    _modalMode = entryId ? 'view' : 'edit';   // existing → view first; new → straight to the form
    var existing = entryId ? findEntry(activeEntries(), entryId) : null;
    _modalDraft = existing ? JSON.parse(JSON.stringify(existing)) : makePlace(districtCode);
    if (pin && !existing) _modalDraft.pin = { x: pin.x, y: pin.y };
    _renderModal();
  };
  window.ncModalClearPin = function () { if (_modalDraft) { _captureModal(); delete _modalDraft.pin; _renderModal(); } };
  function _renderModal() {
    var e = _modalDraft;
    var custom = !!_modalMapId, ro = !!_modalReadonly, isPlayer = NC_MODE === 'player';
    var code = _modalDistrict;
    var locs = (!custom && typeof DATA !== 'undefined' && DATA.districts[code]) ? DATA.districts[code].locations : [];
    var dlOpts = (locs || []).map(function (l) { return '<option value="' + l.id + '">' + _esc(l.name) + '</option>'; }).join('');
    var typeOpts = TYPES.map(function (t) { return '<option value="' + t.key + '"' + (e.type === t.key ? ' selected' : '') + '>' + t.label + '</option>'; }).join('');
    var isCustomType = !typeMeta(e.type);
    typeOpts += '<option value="__custom"' + (isCustomType ? ' selected' : '') + '>+ custom…</option>';
    var rmX = function (kind, i) { return ro ? '' : '<span class="nc-loc-img-x" onclick="ncModalRmImg(\'' + kind + '\',' + i + ')" title="Remove">✕</span>'; };
    var photos = (e.photos || []).map(function (src, i) { return '<figure class="nc-loc-img"><img src="' + src + '">' + rmX('p', i) + '</figure>'; }).join('');
    var maps = (e.hackedMaps || []).map(function (m, i) { return '<figure class="nc-loc-img nc-loc-img-map"><img src="' + m.dataUrl + '"><figcaption>' + _esc(m.label || m.filename || 'hacked map') + '</figcaption>' + rmX('m', i) + '</figure>'; }).join('');
    var gallery = (photos || maps) ? (photos + maps) : '<div class="nc-loc-noimg">NO VISUAL INTEL</div>';
    // Location header: districts/building on Night City; pin coords on custom maps.
    var locHeader;
    if (custom) {
      locHeader = e.pin ? '<div class="nc-modal-pin">📍 On map (' + Math.round(e.pin.x * 100) + '%, ' + Math.round(e.pin.y * 100) + '%)</div>' : '';
    } else {
      var distOpts = NC_GRID_ORDER.map(function (dc) {
        var dn = (typeof DATA !== 'undefined' && DATA.grid[dc]) ? DATA.grid[dc].name : '';
        return '<option value="' + dc + '"' + (dc === code ? ' selected' : '') + '>' + dc + ' — ' + _esc(dn) + '</option>';
      }).join('');
      var pinRow = e.pin
        ? '<div class="nc-modal-pin">📍 Pinned on city map (' + Math.round(e.pin.x * 100) + '%, ' + Math.round(e.pin.y * 100) + '%) <span class="nc-entry-act" onclick="ncModalClearPin()">clear pin</span></div>'
        : '';
      locHeader =
        '<label class="nc-modal-lbl">District<select id="nc-m-district" onchange="ncModalDistrictChange()">' + distOpts + '</select></label>' + pinRow +
        '<div class="nc-modal-grid">' +
          '<label class="nc-modal-lbl">Building #<input id="nc-m-building" list="nc-m-buildings" value="' + _esc(e.building) + '" placeholder="e.g. 5"></label>' +
          '<datalist id="nc-m-buildings">' + dlOpts + '</datalist>' +
          '<label class="nc-modal-lbl">Floor<input id="nc-m-floor" value="' + _esc(e.floor) + '" placeholder="opt."></label>' +
        '</div>';
    }
    // ── Header badges: type, address, security, status ──
    var addr = custom
      ? (e.pin ? '📍 ' + Math.round(e.pin.x * 100) + '%, ' + Math.round(e.pin.y * 100) + '%' : '—')
      : ('#' + _esc(e.building || '?') + (e.floor ? ' · F' + _esc(e.floor) : '') + (code ? ' · ' + _esc(code) : ''));
    var badges = '<div class="nc-loc-badges">' +
      '<span class="nc-type-pill" style="background:' + typeColor(e.type) + '">' + _esc(typeLabel(e.type)) + '</span>' +
      '<span class="nc-loc-addr">' + addr + '</span>' +
      (e.security !== '' && e.security != null ? '<span class="nc-loc-badge nc-loc-badge-sec">SEC ' + _esc(e.security) + '</span>' : '') +
      (NC_MODE === 'gm' && e.public ? '<span class="nc-loc-badge nc-loc-badge-pub">PUBLIC</span>' : '') +
      (e.visited ? '<span class="nc-loc-badge nc-loc-badge-vis">VISITED</span>' : '') +
      (isPlayer && !custom && PLAYER.home === e.id ? '<span class="nc-loc-badge">⌂ HOME</span>' : '') +
    '</div>';
    var isShop = e.name && _shopLocs[String(e.name).toLowerCase()];
    var shopBtn = isShop ? '<button class="nc-loc-shop" onclick="ncOpenShop(\'' + encodeURIComponent(e.name) + '\')">▣ Open this shop</button>' : '';
    // ── Editable form fields (right pane) ──
    var fields =
      locHeader +
      '<label class="nc-modal-lbl">Name<input id="nc-m-name" value="' + _esc(e.name) + '" placeholder="location name"></label>' +
      '<div class="nc-modal-grid">' +
        '<label class="nc-modal-lbl">Type<select id="nc-m-type" onchange="ncModalTypeChange()">' + typeOpts + '</select></label>' +
        '<label class="nc-modal-lbl" id="nc-m-customwrap" style="' + (isCustomType ? '' : 'display:none') + '">Custom type<input id="nc-m-customtype" value="' + (isCustomType ? _esc(e.type) : '') + '"></label>' +
      '</div>' +
      (NC_MODE === 'gm' ? '<label class="nc-modal-lbl">Security<input id="nc-m-sec" value="' + _esc(e.security) + '" placeholder="0–10 / note"></label>' : '') +
      '<label class="nc-modal-lbl">Notes<textarea id="nc-m-notes" rows="4" placeholder="legend / details…">' + _esc(e.notes) + '</textarea></label>' +
      (isPlayer ? '<label class="nc-modal-check"><input type="checkbox" id="nc-m-visited"' + (e.visited ? ' checked' : '') + '> Visited</label>' : '') +
      (isPlayer && !custom ? '<label class="nc-modal-check"><input type="checkbox" id="nc-m-home"' + (PLAYER.home === e.id ? ' checked' : '') + '> Set as home (⌂)</label>' : '') +
      (NC_MODE === 'gm' ? '<label class="nc-modal-check"><input type="checkbox" id="nc-m-public"' + (e.public ? ' checked' : '') + '> Public — visible to players in session</label>' : '');
    var editing = !ro && _modalMode === 'edit';
    var addImgs = !editing ? '' : '<div class="nc-loc-addimgs">' +
      '<label class="nc-btn nc-file nc-btn-sm">＋ Photo<input type="file" accept="image/*" onchange="ncModalAddImg(\'p\',event)"></label>' +
      '<label class="nc-btn nc-file nc-btn-sm">＋ Hacked map<input type="file" accept="image/*" onchange="ncModalAddImg(\'m\',event)"></label>' +
    '</div>';
    var main;
    if (editing) {
      // ── EDIT: the form ──
      // Link/open a nested map (GM, any saved location on a custom map) → deeper maps enchâssées.
      var linkRow = '';
      if (NC_MODE === 'gm' && _modalMapId && _modalEntryId) {
        var lmE = _linkedMapOf(e.linkedMapId);
        linkRow = lmE
          ? '<div class="wm-form-maprow">Linked map: <b>' + _esc(lmE.srcName || lmE.name) + '</b> <button class="nc-btn nc-btn-sm" onclick="ncModalOpenLinked()">Open</button> <button class="nc-btn nc-btn-sm nc-btn-danger" onclick="ncModalUnlinkMap()">Unlink</button></div>'
          : '<div class="wm-form-maprow"><button class="nc-btn nc-btn-sm" onclick="ncModalLinkMap()">＋ Link a map</button></div>';
      }
      var editActions = '<div class="nc-modal-actions">' +
        (_modalEntryId ? '<button class="nc-btn nc-btn-danger" onclick="ncDeleteEntry()">Delete</button>' : '') +
        '<span style="flex:1"></span>' +
        '<button class="nc-btn" onclick="ncModalClose()">Cancel</button>' +
        '<button class="nc-btn nc-btn-cy" onclick="ncSaveEntry()">Save</button></div>';
      main = '<div class="nc-loc-main">' + shopBtn + fields + linkRow + editActions + '</div>';
    } else {
      // ── VIEW: a real read-only layout (no inputs) ──
      var notesHtml = e.notes
        ? '<div class="nc-loc-notes">' + _esc(e.notes) + '</div>'
        : '<div class="nc-loc-notes nc-loc-empty">No details recorded.</div>';
      var lmV = _linkedMapOf(e.linkedMapId);
      var viewActions = '<div class="nc-modal-actions"><span style="flex:1"></span>' +
        (lmV ? '<button class="nc-btn" onclick="ncModalOpenLinked()">Open ' + _esc(lmV.srcName || lmV.name) + ' ▸</button>' : '') +
        '<button class="nc-btn" onclick="ncModalClose()">Close</button>' +
        (!ro ? '<button class="nc-btn nc-btn-cy" onclick="ncModalEdit()">✎ Edit</button>'
             : (_modalLayerIdx != null ? '<button class="nc-btn nc-btn-cy" onclick="ncCopyToLog(' + _modalLayerIdx + ',\'' + e.id + '\');ncModalClose();">copy to my log</button>' : '')) +
        '</div>';
      main = '<div class="nc-loc-main">' + badges + shopBtn + notesHtml + viewActions + '</div>';
    }
    var media = '<div class="nc-loc-media">' + gallery + addImgs + '</div>';
    var body = '<div class="nc-loc">' + media + main + '</div>';
    var title = (e.name || (_modalEntryId ? 'Location' : 'New location'));
    _ncModalOpen(editing ? (_modalEntryId ? '✎ ' + title : 'New location') : title, body, true);
  }
  window.ncModalOpenLinked = function () {
    if (!_modalDraft) return; var lm = _linkedMapOf(_modalDraft.linkedMapId);
    if (lm) { ncModalClose(); ncSelectMap(lm.id); }
  };
  window.ncModalLinkMap = function () {
    if (!_modalMapId || !_modalDraft) return;
    _captureModal(); var e = _modalDraft;
    _createLinkedMap(_modalMapId, e.id, e.name || 'Location', function (mapId) {
      e.linkedMapId = mapId;
      var m = _findMap(_modalMapId); if (m) { var ent = (m.entries || []).filter(function (x) { return x.id === e.id; })[0]; if (ent) ent.linkedMapId = mapId; }
      _schedSave(); _postPublic(); ncModalClose(); ncSelectMap(mapId);
    });
  };
  window.ncModalUnlinkMap = function () {
    if (!_modalDraft) return; var e = _modalDraft;
    if (e.linkedMapId) GM.maps = GM.maps.filter(function (m) { return m.id !== e.linkedMapId; });
    e.linkedMapId = null;
    var m = _findMap(_modalMapId); if (m) { var ent = (m.entries || []).filter(function (x) { return x.id === e.id; })[0]; if (ent) ent.linkedMapId = null; }
    _schedSave(); _postPublic(); ncRenderMapsBar(); _renderModal();
  };
  window.ncModalTypeChange = function () {
    var sel = document.getElementById('nc-m-type');
    document.getElementById('nc-m-customwrap').style.display = (sel.value === '__custom') ? '' : 'none';
  };
  /* Read the form fields into the draft (without committing) so re-renders don't lose input. */
  function _captureModal() {
    var e = _modalDraft; if (!e) return;
    var get = function (id) { var el = document.getElementById(id); return el ? el.value : undefined; };
    var b = get('nc-m-building'); if (b !== undefined) e.building = b.trim();
    var f = get('nc-m-floor'); if (f !== undefined) e.floor = f.trim();
    var n = get('nc-m-name'); if (n !== undefined) e.name = n.trim();
    var t = get('nc-m-type');
    if (t !== undefined) { if (t === '__custom') { var c = (get('nc-m-customtype') || '').trim(); e.type = c || 'other'; } else e.type = t; }
    var s = get('nc-m-sec'); if (s !== undefined) e.security = s.trim();
    var no = get('nc-m-notes'); if (no !== undefined) e.notes = no;
    var visEl = document.getElementById('nc-m-visited'); if (visEl) e.visited = visEl.checked;
    var pubEl = document.getElementById('nc-m-public'); if (pubEl) e.public = pubEl.checked;
    var d = get('nc-m-district'); if (d !== undefined) { e.district = d; _modalDistrict = d; }
  }
  window.ncModalDistrictChange = function () { _captureModal(); _renderModal(); };
  window.ncModalAddImg = function (kind, ev) {
    var f = ev.target.files[0]; if (!f) { return; }
    _captureModal();
    var r = new FileReader();
    r.onload = function (e2) {
      if (kind === 'p') { _modalDraft.photos.push(e2.target.result); }
      else {
        var img = new Image();
        img.onload = function () { _modalDraft.hackedMaps.push({ dataUrl: e2.target.result, w: img.naturalWidth, h: img.naturalHeight, filename: f.name, label: f.name }); _renderModal(); };
        img.src = e2.target.result; return;
      }
      _renderModal();
    };
    r.readAsDataURL(f);
    ev.target.value = '';
  };
  window.ncModalRmImg = function (kind, i) {
    _captureModal();
    if (kind === 'p') _modalDraft.photos.splice(i, 1); else _modalDraft.hackedMaps.splice(i, 1);
    _renderModal();
  };
  window.ncSaveEntry = function () {
    if (_modalReadonly) { ncModalClose(); return; }
    _captureModal();
    var e = _modalDraft;
    if (_modalMapId) {   // custom map: save to that map's own entries
      var m = _findMap(_modalMapId); if (!m) { ncModalClose(); return; }
      if (!Array.isArray(m.entries)) m.entries = [];
      var mi = m.entries.findIndex(function (x) { return x.id === e.id; });
      if (mi >= 0) m.entries[mi] = e; else m.entries.push(e);
      _schedSave(); ncModalClose(); ncRenderCustomMap(_modalMapId); ncRenderMapsBar();
      return;
    }
    var arr = activeEntries();
    if (_modalEntryId) {
      var idx = arr.findIndex(function (x) { return x.id === _modalEntryId; });
      if (idx >= 0) arr[idx] = e; else arr.push(e);
    } else { arr.push(e); }

    var homeEl = document.getElementById('nc-m-home');
    if (homeEl) { if (homeEl.checked) PLAYER.home = e.id; else if (PLAYER.home === e.id) PLAYER.home = null; }

    _schedSave();
    ncModalClose();
    ncAfterChange();
    ncRenderCtxBar(); ncRenderSidePanel();
  };
  window.ncDeleteEntry = function () {
    if (!_modalEntryId) return;
    if (!confirm('Delete this location?')) return;
    if (_modalMapId) {
      var cm = _findMap(_modalMapId); if (cm) cm.entries = (cm.entries || []).filter(function (x) { return x.id !== _modalEntryId; });
      _schedSave(); ncModalClose(); ncRenderCustomMap(_modalMapId); return;
    }
    var arr = activeEntries();
    var idx = arr.findIndex(function (x) { return x.id === _modalEntryId; });
    if (idx >= 0) arr.splice(idx, 1);
    if (PLAYER.home === _modalEntryId) PLAYER.home = null;
    _schedSave(); ncModalClose();
    ncAfterChange();
    ncRenderCtxBar(); ncRenderSidePanel();
  };

  /* ═══ GM-layer (imported) actions ═══ */
  window.ncToggleLayer = function (i) { var L = PLAYER.gmLayers[i]; if (!L) return; L.hidden = !L.hidden; _schedSave(); ncAfterChange(); };
  window.ncRemoveLayer = function (i) { if (!confirm('Remove this imported GM layer?')) return; PLAYER.gmLayers.splice(i, 1); _schedSave(); ncRenderSidePanel(); ncRenderCtxBar(); ncAfterChange(); };
  // Read-only detail popup for a synced GM location (so players can view + open its shop).
  window.ncViewEntry = function (layerIdx, entryId) {
    var L = PLAYER.gmLayers[layerIdx]; if (!L) return;
    var src = findEntry(L.entries, entryId); if (!src) return;
    _modalDistrict = src.district; _modalEntryId = entryId; _modalMapId = null; _modalReadonly = true; _modalLayerIdx = layerIdx; _modalMode = 'view';
    _modalDraft = JSON.parse(JSON.stringify(src));
    _renderModal();
  };
  window.ncCopyToLog = function (layerIdx, entryId) {
    var L = PLAYER.gmLayers[layerIdx]; if (!L) return;
    var src = findEntry(L.entries, entryId); if (!src) return;
    var clone = JSON.parse(JSON.stringify(src)); clone.id = _uid(); clone.createdAt = Date.now(); clone.visited = false;
    PLAYER.entries.push(clone);
    _schedSave();
    ncAfterChange();
    ncRenderCtxBar();
  };

  /* ═══ Lightbox (full image) ═══ */
  window.ncLightbox = function (entryId, kind, i) {
    // search editable + layers for the entry
    var e = findEntry(activeEntries(), entryId);
    if (!e) { PLAYER.gmLayers.forEach(function (L) { e = e || findEntry(L.entries, entryId); }); }
    if (!e) return;
    var src = kind === 'p' ? e.photos[i] : (e.hackedMaps[i] && e.hackedMaps[i].dataUrl);
    if (!src) return;
    var ov = document.createElement('div');
    ov.className = 'nc-lightbox';
    ov.onclick = function () { document.body.removeChild(ov); };
    ov.innerHTML = '<img src="' + src + '">';
    document.body.appendChild(ov);
  };

  /* ═══ GM notebook tabs ═══ */
  window.ncGmNew = function () { GM.list.push({ id: _uid(), name: 'Plan ' + (GM.list.length + 1), entries: [], districtExtras: {} }); GM.active = GM.list.length - 1; _schedSave(); ncRenderCtxBar(); ncRenderSidePanel(); ncRefreshDistrict(); };
  window.ncGmSwitch = function (i) { if (i < 0 || i >= GM.list.length) return; GM.active = i; _schedSave(); ncRenderCtxBar(); ncRenderSidePanel(); ncAfterChange(); };
  window.ncGmClose = function (i) { if (GM.list.length <= 1) return; if (!confirm('Close this GM notebook? Export it first to keep it.')) return; GM.list.splice(i, 1); if (GM.active >= GM.list.length) GM.active = GM.list.length - 1; else if (i < GM.active) GM.active--; _schedSave(); ncRenderCtxBar(); ncRenderSidePanel(); ncAfterChange(); };
  window.ncGmRename = function (i) { var nb = GM.list[i]; if (!nb) return; var n = prompt('Notebook name:', nb.name); if (n != null) { nb.name = n.trim() || nb.name; _schedSave(); ncRenderCtxBar(); } };

  /* ═══ Import / Export ═══ */
  function _download(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
  window.ncExportPlayer = function () { _download({ _kind: 'nc-player', entries: PLAYER.entries, home: PLAYER.home }, 'night-city-log.nclog.json'); };
  window.ncImportPlayer = function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function (e2) {
      try {
        var d = JSON.parse(e2.target.result);
        if (!d || !Array.isArray(d.entries)) throw new Error('not a player log');
        if (!confirm('Replace your current player log with the imported one?')) return;
        PLAYER.entries = d.entries.map(_migratePlace);
        PLAYER.home = d.home || null;
        _schedSave(); ncRenderCtxBar(); ncRenderSidePanel(); ncAfterChange();
      } catch (err) { alert('Invalid log file: ' + err.message); }
    };
    r.readAsText(f); ev.target.value = '';
  };
  window.ncExportGm = function () {
    var nb = GM.list[GM.active]; if (!nb) return;
    _download({ _kind: 'nc-gm', id: nb.id, name: nb.name, entries: nb.entries },
      (nb.name || 'plan').replace(/\s+/g, '_').toLowerCase() + '.ncplan.json');
  };
  window.ncImportGmNotebook = function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function (e2) {
      try {
        var d = JSON.parse(e2.target.result);
        if (!d || !Array.isArray(d.entries)) throw new Error('not a GM notebook');
        GM.list.push({ id: _uid(), name: (d.name || 'Imported plan'), entries: d.entries.map(_migratePlace) });
        GM.active = GM.list.length - 1;
        _schedSave(); ncRenderCtxBar(); ncRenderSidePanel(); ncAfterChange();
      } catch (err) { alert('Invalid notebook file: ' + err.message); }
    };
    r.readAsText(f); ev.target.value = '';
  };
  window.ncImportGmPlan = function (ev) {  // player imports a GM plan as a read-only layer
    var f = ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function (e2) {
      try {
        var d = JSON.parse(e2.target.result);
        if (!d || !Array.isArray(d.entries)) throw new Error('not a GM plan');
        PLAYER.gmLayers.push({ id: _uid(), name: (d.name || 'GM plan'), hidden: false, entries: d.entries.map(_migratePlace) });
        _schedSave(); ncRenderCtxBar(); ncRenderSidePanel(); ncAfterChange();
        alert('GM plan imported as a layer (' + d.entries.length + ' locations). Toggle it in the sidebar.');
      } catch (err) { alert('Invalid GM plan file: ' + err.message); }
    };
    r.readAsText(f); ev.target.value = '';
  };

  /* ═══ Minimal modal ═══ */
  function _ncModalOpen(title, bodyHtml, wide) {
    ncModalClose();
    var ov = document.createElement('div');
    ov.id = 'nc-modal-ov';
    ov.className = 'nc-modal-ov';
    ov.onclick = function (e) { if (e.target === ov) ncModalClose(); };
    ov.innerHTML = '<div class="nc-modal-card' + (wide ? ' nc-modal-card--wide' : '') + '"><div class="nc-modal-head">' + _esc(title) + '</div><div class="nc-modal-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.nc-modal-body').innerHTML = bodyHtml;
  }
  window.ncModalClose = function () { var ov = document.getElementById('nc-modal-ov'); if (ov) document.body.removeChild(ov); };

  /* ═══ ATLAS VIEW — composite of all 18 district maps + global legend by type ═══ */
  window.ncSetView = function (view) {
    var vm = document.getElementById('view-map'), vg = document.getElementById('view-grid'), va = document.getElementById('view-atlas');
    if (vm) vm.style.display = view === 'map' ? 'block' : 'none';
    if (vg) vg.style.display = view === 'grid' ? 'block' : 'none';
    if (va) va.style.display = view === 'atlas' ? 'block' : 'none';
    [['btn-map', 'map'], ['btn-grid', 'grid'], ['btn-atlas', 'atlas']].forEach(function (p) {
      var b = document.getElementById(p[0]); if (!b) return;
      var on = p[1] === view;
      b.style.background = on ? '#111' : '#fff';
      b.style.color = on ? '#fff' : '#111';
      b.classList.toggle('active', on);
    });
    if (view === 'atlas') ncRenderAtlas();
  };

  /* All "known" locations from the current perspective: known (GM layers / notebook) + my notes. */
  function ncGatherKnown() {
    var out = [];
    if (NC_MODE === 'gm') {
      var nb = GM.list[GM.active];
      (nb ? nb.entries : []).forEach(function (e) { out.push({ e: e, src: 'gm', layer: -1 }); });
    } else {
      // player + ref: my notes + visible imported GM layers
      PLAYER.entries.forEach(function (e) { out.push({ e: e, src: 'note', layer: -1 }); });
      PLAYER.gmLayers.forEach(function (L, li) { if (!L.hidden) L.entries.forEach(function (e) { out.push({ e: e, src: 'known', layer: li }); }); });
    }
    return out;
  }

  /* Approx. district from a normalized click on the full city map (6 cols × 3 rows). */
  function ncGuessDistrict(x, y) {
    var col = Math.max(0, Math.min(5, Math.floor(x * 6)));
    var row = Math.max(0, Math.min(2, Math.floor(y * 3)));
    return NC_GRID_ORDER[row * 6 + col];
  }
  var _placingId = null;   // when set, next map click sets this entry's pin (place existing entry)

  function ncRenderAtlas() {  // now the full-city PIN MAP (replaces the old collage atlas)
    var host = document.getElementById('nc-atlas'); if (!host) return;
    var known = ncGatherKnown();

    // Pins overlay (only entries that have a pin)
    var pins = known.filter(function (k) { return k.e.pin; }).map(function (k) {
      var e = k.e, ro = (k.src === 'known');
      var click = ro ? 'ncPinInfo(\'' + e.id + '\',' + k.layer + ')' : 'ncEntryModal(\'' + e.district + '\',\'' + e.id + '\')';
      return '<div class="nc-pin' + (ro ? ' nc-pin-ro' : '') + '" style="left:' + (e.pin.x * 100) + '%;top:' + (e.pin.y * 100) + '%;background:' + typeColor(e.type) + '" ' +
        'title="' + _esc((e.name || '(unnamed)') + ' — ' + typeLabel(e.type)) + '" onclick="event.stopPropagation();' + click + '"></div>';
    }).join('');

    // Legend grouped by type (all known incl. unplaced)
    var groups = {};
    known.forEach(function (k) { var t = k.e.type || 'other'; (groups[t] = groups[t] || []).push(k); });
    var orderKeys = TYPES.map(function (t) { return t.key; });
    Object.keys(groups).forEach(function (t) { if (orderKeys.indexOf(t) < 0) orderKeys.push(t); });
    var legend = '';
    orderKeys.forEach(function (t) {
      var items = groups[t]; if (!items || !items.length) return;
      legend += '<div class="nc-atlas-leg-group"><div class="nc-atlas-leg-head"><span class="nc-type-pill" style="background:' + typeColor(t) + '">' + _esc(typeLabel(t)) + '</span><span class="nc-atlas-leg-count">' + items.length + '</span></div>';
      legend += items.map(function (k) {
        var e = k.e, ro = (k.src === 'known');
        var addr = '#' + _esc(e.building || '?') + (e.floor ? '·F' + _esc(e.floor) : '');
        var placed = e.pin ? '📍 ' : '';
        var place = (!ro && NC_MODE !== 'ref') ? '<span class="nc-leg-place" onclick="event.stopPropagation();ncArmPlace(\'' + e.id + '\')">' + (e.pin ? 're-place' : 'place') + '</span>' : '';
        var open = ro ? 'ncPinInfo(\'' + e.id + '\',' + k.layer + ')' : 'ncEntryModal(\'' + e.district + '\',\'' + e.id + '\')';
        return '<div class="nc-atlas-leg-item"><span onclick="' + open + '">' + placed +
          '<span class="nc-atlas-leg-dist">' + _esc(e.district || '??') + '</span> ' +
          '<span class="nc-entry-addr">' + addr + '</span> ' + _esc(e.name || '(unnamed)') + '</span> ' + place + '</div>';
      }).join('');
      legend += '</div>';
    });
    if (!legend) legend = '<div class="nc-empty">No known locations yet. Click the map (Player/GM mode) to drop a pin.</div>';

    var hint = (NC_MODE === 'ref')
      ? '<div class="nc-city-hint">Reference view — switch to Player Log or GM Planner to drop pins.</div>'
      : (_placingId ? '<div class="nc-city-hint nc-city-arm">Click the map to place the selected location…</div>'
                    : '<div class="nc-city-hint">Click anywhere on the map to drop a new pin.</div>');

    host.innerHTML = '<div class="nc-atlas-wrap"><div class="nc-atlas-maps">' + hint +
      '<div class="nc-city-mapwrap' + (_placingId ? ' nc-arming' : '') + '" onclick="ncCityClick(event)">' +
        '<img id="nc-city-img" src="img/maps/fullnc.png" alt="Night City">' +
        '<div class="nc-city-pins">' + pins + '</div>' +
      '</div></div>' +
      '<div class="nc-atlas-legend"><div class="nc-atlas-legend-title">KNOWN LOCATIONS</div>' + legend + '</div></div>';
  }

  /* Click on the city map: place an armed entry, or open a new pinned entry. */
  window.ncCityClick = function (ev) {
    if (NC_MODE === 'ref') return;
    var wrap = document.getElementById('nc-city-img') || ev.currentTarget;
    var rect = wrap.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width;
    var y = (ev.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (_placingId) {
      var e = findEntry(activeEntries(), _placingId);
      if (e) { e.pin = { x: x, y: y }; _schedSave(); }
      _placingId = null; ncRenderAtlas();
      return;
    }
    ncEntryModal(ncGuessDistrict(x, y), null, { x: x, y: y });
  };
  window.ncArmPlace = function (id) { _placingId = id; ncRenderAtlas(); };
  // Clicking a pin opens the full read-only location popup (gallery + Open-shop button).
  window.ncPinInfo = function (id, layerIdx) { window.ncViewEntry(layerIdx, id); };

  /* ═══ Hook into the reference engine ═══ */
  function _installHooks() {
    if (typeof selectDistrict === 'function') {
      var _origSelect = selectDistrict;
      window.selectDistrict = function (code) {
        _origSelect(code);
        ncCurrentDistrict = code;
        ncApplyModeToDistrictView();
        ncRefreshDistrict();
      };
    }
    if (typeof renderMapTab === 'function') {
      var _origMapTab = renderMapTab;
      window.renderMapTab = function (code, d) {
        _origMapTab(code, d);
        ncCurrentDistrict = code;
        ncAugmentLegend(code);
      };
    }
    if (typeof showOverview === 'function') {
      var _origOverview = showOverview;
      window.showOverview = function () {
        _origOverview();
        ncCurrentDistrict = null;
      };
    }
  }

  /* ═══ CUSTOM MAPS (image + normalized pins) & off-NC LISTS ═══ */
  function _ncEnsureOrder() {
    if (!Array.isArray(GM.order)) GM.order = ['nc'];
    if (GM.order.indexOf('nc') < 0) GM.order.unshift('nc');
    GM.maps.forEach(function (m) { if (GM.order.indexOf(m.id) < 0) GM.order.push(m.id); });
    GM.order = GM.order.filter(function (id) { return id === 'nc' || GM.maps.some(function (m) { return m.id === id; }); });
  }
  function _mapSource() { return NC_MODE === 'gm' ? GM.maps : PLAYER.maps; }
  function _mapOrder() { return NC_MODE === 'gm' ? GM.order : (PLAYER.mapOrder || ['nc']); }
  function _findMap(id) { return (_mapSource() || []).filter(function (m) { return m.id === id; })[0] || null; }
  function _findPlace(m, id) { return (((m && m.entries) || []).concat((m && m.gmEntries) || [])).filter(function (p) { return p.id === id; })[0] || null; }
  function _allMapPlaces(m) {
    var gm = (m.gmEntries || []).map(function (p) { var c = Object.assign({}, p); c._ro = true; return c; });
    return gm.concat(m.entries || []);
  }
  function _perspectiveMaps() {
    var src = _mapSource() || [], byId = {}; src.forEach(function (m) { byId[m.id] = m; });
    var order = (_mapOrder() || []).slice();
    src.forEach(function (m) { if (order.indexOf(m.id) < 0) order.push(m.id); });
    var appMode = (NC_MODE === 'gm' || NC_MODE === 'player');
    var out = [];
    if (appMode) {
      // In the app, World is the root surface; Night City is subordinated to it —
      // it only appears once opened from the world map ("See map" → pinned).
      out.push({ id: 'world', name: 'World', kind: 'world' });
      if (_worldState().ncPinned) out.push({ id: 'nc', name: 'Night City', kind: 'nc' });
    } else {
      out.push({ id: 'nc', name: 'Night City', kind: 'nc' });   // public reference: NC is the root, unchanged
    }
    order.forEach(function (id) { if (id !== 'nc' && byId[id]) out.push({ id: id, name: byId[id].name, kind: byId[id].kind }); });
    return out;
  }
  var _mnCollapsed = {};
  window.ncMnToggle = function (id) { _mnCollapsed[id] = !_mnCollapsed[id]; ncRenderMapsBar(); };
  window.ncToggleHighlightCustom = function (on) {
    _worldState().highlightCustom = !!on; _schedSave();
    var vw = document.getElementById('view-world'); if (vw) vw.classList.toggle('wm-highlight-custom', !!on);
  };
  // Left sidebar map tree (replaces the old top maps-bar). Roots: NA (world) + Night City; nested
  // linked maps hang under their parent map, labelled by the source location.
  function ncRenderMapsBar() {
    var nav = document.getElementById('nc-mapnav'); if (!nav) return;
    var gm = NC_MODE === 'gm', player = NC_MODE === 'player';
    nav.className = 'on';   // the map tree is the navigation everywhere (app + public site)
    var src = _mapSource() || [];
    function childMaps(pid) { return src.filter(function (m) { return (m.parentMapId || null) === pid; }); }
    // Children of a tree node: its linked maps, plus Night City is a virtual child of NA.
    function treeChildren(id) {
      var kids = childMaps(id).map(function (m) { return { id: m.id, label: m.srcName || m.name, ico: (m.kind === 'list' ? '☰' : '▦'), movable: true }; });
      if (id === 'world') kids = [{ id: 'nc', label: 'Night City', ico: '◰', movable: false }].concat(kids);
      return kids;
    }
    var html = '';
    function node(id, label, ico, depth, movable) {
      var active = (id === _surface), kids = treeChildren(id), collapsed = !!_mnCollapsed[id];
      var tw = kids.length ? '<span class="mn-tw" onclick="event.stopPropagation();ncMnToggle(\'' + id + '\')">' + (collapsed ? '▸' : '▾') + '</span>' : '<span class="mn-tw"></span>';
      var mv = (movable && gm) ? '<span class="mn-mv" onclick="event.stopPropagation();ncMoveMap(\'' + id + '\',-1)">▴</span><span class="mn-mv" onclick="event.stopPropagation();ncMoveMap(\'' + id + '\',1)">▾</span>' : '';
      html += '<div class="mn-row' + (active ? ' active' : '') + (depth ? ' loc' : '') + '" style="padding-left:' + (4 + depth * 14) + 'px" onclick="ncSelectMap(\'' + id + '\')">' +
        tw + '<span class="mn-ico">' + ico + '</span><span class="mn-lbl">' + _esc(label) + '</span>' + mv + '</div>';
      if (!collapsed) kids.forEach(function (k) { node(k.id, k.label, k.ico, depth + 1, k.movable); });
    }
    node('world', 'NA', '◍', 0, false);
    childMaps(null).forEach(function (m) { node(m.id, m.name, m.kind === 'list' ? '☰' : '▦', 0, true); });
    var ham = '<button class="mn-ham" title="Mode & notebook" onclick="ncPlannerMenu(event)">☰</button>';
    var actions = gm ? '<div class="mn-actions"><button class="mn-act" onclick="ncAddMap(\'map\')">＋ Map</button><button class="mn-act" onclick="ncAddMap(\'list\')">＋ List</button></div>' : '';
    var hl = (_surface === 'world') ? '<label class="mn-toggle"><input type="checkbox"' + (_worldState().highlightCustom ? ' checked' : '') + ' onchange="ncToggleHighlightCustom(this.checked)"> Highlight custom</label>' : '';
    nav.innerHTML = '<div class="mn-head">' + ham + '<span class="mn-head-title">MAPS</span></div>' +
      '<div class="mn-tree">' + html + '</div>' + actions + hl;
    if (document.getElementById('nc-planner-menu')) ncPlannerMenuBuild();
  }
  // ── Planner dropdown (replaces the old GM PLANNER / PLAYER LOG top bar) ────
  function ncPlannerMenuBuild() {
    var m = document.getElementById('nc-planner-menu'); if (!m) return;
    // Mode switcher (Reference / Player Log / GM Planner) — hidden when the app embed locks the role.
    var locked = (_NCROLE === 'gm' || _NCROLE === 'player'), modeSwitch = '';
    if (!locked) {
      modeSwitch = '<div class="npm-h">MODE</div>' +
        [['ref', 'Reference'], ['player', 'Player Log'], ['gm', 'GM Planner']].map(function (md) {
          return '<button class="npm-mode' + (NC_MODE === md[0] ? ' active' : '') + '" onclick="ncSetMode(\'' + md[0] + '\')">' + md[1] + '</button>';
        }).join('') + (NC_MODE !== 'ref' ? '<div class="npm-sep"></div>' : '');
    }
    var content = '';
    if (NC_MODE === 'gm') {
      var plans = GM.list.map(function (nb, i) {
        return '<div class="npm-plan' + (i === GM.active ? ' active' : '') + '" onclick="ncGmSwitch(' + i + ')" ondblclick="ncGmRename(' + i + ')" title="Double-click to rename">' +
          '<span class="npm-plan-label">' + _esc(nb.name) + '</span>' +
          (GM.list.length > 1 ? '<span class="npm-x" onclick="event.stopPropagation();ncGmClose(' + i + ')" title="Close">✕</span>' : '') +
          '</div>';
      }).join('');
      content = '<div class="npm-h">PLANS</div>' + plans +
        '<button class="npm-item npm-new" onclick="ncGmNew()">＋ New plan</button>' +
        '<div class="npm-sep"></div>' +
        '<button class="npm-item" onclick="ncExportGm()">⬇ Export notebook</button>' +
        '<label class="npm-item npm-file">⬆ Import notebook<input type="file" accept=".json" onchange="ncImportGmNotebook(event)"></label>';
    } else if (NC_MODE === 'player') {
      content = '<div class="npm-h">PLAYER LOG</div>' +
        '<div class="npm-info">' + PLAYER.entries.length + ' notes · ' + PLAYER.gmLayers.length + ' GM layer(s)</div>' +
        '<div class="npm-sep"></div>' +
        '<button class="npm-item" onclick="ncExportPlayer()">⬇ Export log</button>' +
        '<label class="npm-item npm-file">⬆ Import log<input type="file" accept=".json" onchange="ncImportPlayer(event)"></label>' +
        '<label class="npm-item npm-file" onchange="">＋ Import GM plan<input type="file" accept=".json" onchange="ncImportGmPlan(event)"></label>';
    }
    m.innerHTML = modeSwitch + content;
  }
  window.ncPlannerMenu = function (e) {
    e.stopPropagation();
    if (document.getElementById('nc-planner-menu')) { ncPlannerMenuClose(); return; }
    var m = document.createElement('div'); m.id = 'nc-planner-menu'; m.className = 'nc-planner-menu';
    document.body.appendChild(m); ncPlannerMenuBuild();
    var r = e.currentTarget.getBoundingClientRect();
    m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
    setTimeout(function () { document.addEventListener('mousedown', ncPlannerMenuOutside); }, 0);
  };
  function ncPlannerMenuOutside(ev) {
    var m = document.getElementById('nc-planner-menu'); if (!m) return;
    if (m.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest('.nc-mtab-ham')) return;
    ncPlannerMenuClose();
  }
  window.ncPlannerMenuClose = function () {
    var m = document.getElementById('nc-planner-menu'); if (m) m.parentNode.removeChild(m);
    document.removeEventListener('mousedown', ncPlannerMenuOutside);
  };
  window.ncSelectMap = function (id) {
    _surface = id;
    var ov = document.getElementById('overview'), dv = document.getElementById('district-view'),
        vc = document.getElementById('view-custom'), vw = document.getElementById('view-world');
    // The Night City district sidebar belongs to NC only — hide it elsewhere.
    var sb = document.getElementById('sidebar'); if (sb) sb.style.display = (id === 'nc') ? '' : 'none';
    if (vw) vw.style.display = 'none';
    if (id === 'world') {
      if (vc) vc.style.display = 'none';
      if (dv) dv.style.display = 'none';
      if (ov) ov.style.display = 'none';
      if (vw) vw.style.display = 'block';
      ncRenderWorld();
    } else if (id === 'nc') {
      if (vc) vc.style.display = 'none';
      if (dv) dv.style.display = 'none';
      if (ov) ov.style.display = '';
      ncCurrentDistrict = null;
    } else {
      if (ov) ov.style.display = 'none';
      if (dv) dv.style.display = 'none';
      if (vc) vc.style.display = 'block';
      ncRenderCustomMap(id);
    }
    ncRenderMapsBar();
  };
  window.ncAddMap = function (kind) {
    if (kind === 'list') {
      var m = { id: _uid(), name: 'List ' + (GM.maps.length + 1), kind: 'list', image: null, w: 0, h: 0, entries: [] };
      GM.maps.push(m); _ncEnsureOrder(); _schedSave(); ncSelectMap(m.id); return;
    }
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var m = { id: _uid(), name: 'Map ' + (GM.maps.length + 1), kind: 'map', image: e.target.result, w: img.naturalWidth, h: img.naturalHeight, entries: [] };
          GM.maps.push(m); _ncEnsureOrder(); _schedSave(); ncSelectMap(m.id);
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(f);
    };
    inp.click();
  };
  // Create an image map nested under a location (GM only). onDone(mapId) fires after upload.
  function _createLinkedMap(parentMapId, locId, srcName, onDone) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var m = { id: _uid(), name: srcName || 'Map', kind: 'map', image: e.target.result, w: img.naturalWidth, h: img.naturalHeight, entries: [], parentMapId: parentMapId, parentLocId: locId, srcName: srcName || '' };
          GM.maps.push(m); _ncEnsureOrder(); _schedSave(); _postPublic();
          if (onDone) onDone(m.id);
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(f);
    };
    inp.click();
  }
  // ── Built-in NA city overlay data (GM lore + notes), keyed by the city name ──
  function _worldCityRec(name, create) {
    var st = _worldState(); if (!st.cityData) st.cityData = {};
    if (!st.cityData[name] && create) st.cityData[name] = { desc: '', gmNotes: '', notes: '', linkedMapId: null };
    return st.cityData[name] || null;
  }
  // Resolve a location's linked child map (from a world place, a city record, or a custom-map entry).
  function _linkedMapOf(linkedMapId) { return linkedMapId ? _findMap(linkedMapId) : null; }
  window.ncMoveMap = function (id, dir) {
    _ncEnsureOrder();
    var i = GM.order.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= GM.order.length) return;
    var t = GM.order[i]; GM.order[i] = GM.order[j]; GM.order[j] = t;
    _schedSave(); ncRenderMapsBar();
  };
  window.ncRenameMap = function (id, name) { var m = _findMap(id); if (m) { m.name = name; _schedSave(); ncRenderMapsBar(); } };
  window.ncDeleteMap = function (id) {
    if (!confirm('Delete this map and its locations?')) return;
    GM.maps = GM.maps.filter(function (m) { return m.id !== id; }); _ncEnsureOrder();
    _schedSave(); ncSelectMap('nc');
  };
  function _customListHtml(mapId, m) {
    var gm = NC_MODE === 'gm';
    var places = _allMapPlaces(m);
    var rows = places.length ? places.map(function (p, i) {
      var ed = p._ro ? '<span class="nc-entry-act" onclick="ncCustomPlaceModal(\'' + mapId + '\',\'' + p.id + '\')">view</span>' : '<span class="nc-entry-act" onclick="ncCustomPlaceModal(\'' + mapId + '\',\'' + p.id + '\')">edit</span>';
      return '<div class="nc-cm-row"><span class="legend-num">' + (i + 1) + '</span><span class="nc-cm-rname">' + _esc(p.name || '(unnamed)') + '</span>' +
        (gm && p.public ? '<span class="nc-entry-pub">PUBLIC</span>' : '') + (p._ro ? '<span class="nc-cm-ro">GM</span>' : '') + ed +
        (p.notes ? '<div class="nc-cm-rnotes">' + _esc(p.notes) + '</div>' : '') + '</div>';
    }).join('') : '<div class="nc-cm-empty">No locations yet.</div>';
    var add = (NC_MODE !== 'ref') ? '<button class="nc-btn nc-btn-sm" onclick="ncCustomPlaceModal(\'' + mapId + '\',null)">＋ Add location</button>' : '';
    return rows + '<div style="margin-top:8px">' + add + '</div>';
  }
  /* ═══════════════════ World map surface (hybrid: raster base + live icon vector) ═══════════════════
     North-America map (USA_Layered.svg). Cartography + place-names are baked to crisp images
     (Inkscape LOD tile pyramid in img/maps/tiles/, Terminal Grotesque); the city + transport icons stay live
     vector (usa-icons.svg) on top for hover-grow, click→info, and per-group toggles. Leaflet
     drives pan/zoom. Night City's icon opens the NC map as a pinned tab. */
  var _worldMap = null, _worldFitBounds = null, _worldLegendSvg = null;
  var _worldIconsSvg = null, _worldLayers = null, _worldIconsEl = null;
  var _worldMarkerGroups = null, _worldCityByName = null;
  function _worldState() {
    var st = (NC_MODE === 'gm') ? GM : PLAYER;
    if (!st.world) st.world = { hidden: {}, ncPinned: false, places: [] };
    if (!st.world.hidden) st.world.hidden = {};
    if (!Array.isArray(st.world.places)) st.world.places = [];
    return st.world;
  }
  // GM public world locations pushed to a player during a live session (read-only, not persisted).
  var _worldGmPlaces = [];
  var _worldGmCityData = {};   // synced GM city lore (desc + linkedMapId) keyed by city name
  var _WM_LOC = null;   // { types:[{id,label,vb,body}], marker:{vb,body} } — custom-location icon art
  function ncRenderWorld() {
    var vw = document.getElementById('view-world'); if (!vw) return;
    if (_worldIconsSvg == null || _WM_LOC == null) {
      vw.innerHTML = '<div class="wm-msg">Loading map…</div>';
      Promise.all([
        fetch('img/maps/usa-icons.svg').then(function (r) { return r.text(); }),
        fetch('img/maps/loc-icons.json').then(function (r) { return r.json(); }).catch(function () { return { types: [], marker: null }; })
      ]).then(function (res) {
        _worldIconsSvg = res[0]; _WM_LOC = res[1];
        if (_surface === 'world') _worldPaint(vw);
      }).catch(function () { vw.innerHTML = '<div class="wm-msg">Could not load the map.</div>'; });
      return;
    }
    _worldPaint(vw);
  }
  function _worldLocType(id) { return (_WM_LOC && _WM_LOC.types || []).filter(function (t) { return t.id === id; })[0] || null; }
  // All world locations visible in the current mode: the user's own + (player) synced GM publics.
  function _worldAllPlaces() {
    var own = _worldState().places || [];
    if (NC_MODE === 'player' && _worldGmPlaces.length) {
      var ro = _worldGmPlaces.map(function (p) { var c = Object.assign({}, p); c._ro = true; return c; });
      return own.concat(ro);
    }
    return own;
  }
  function makeWorldPlace(kind, vx, vy) {
    return { id: _uid(), kind: kind, vx: vx, vy: vy, name: '', cityType: (kind === 'city' ? 'new' : ''),
      type: '', population: '', notes: '', security: '', corp: '', photos: [], hackedMaps: [], public: false, linkedMapId: null, createdAt: Date.now() };
  }
  /* Hybrid map: cartography + place-names baked to crisp images (Terminal Grotesque), while the
     city / transport icons stay LIVE vector on top (hover-grow, click → info; per-group toggles).
     The SVG's native viewBox already equals the framed North-America crop. */
  var _WM_VB = { x: 0, y: 0, w: 1569.5205, h: 1476.9324 }, _WM_NS = 'http://www.w3.org/2000/svg';
  var _WM_TREE = [
    { id: 'carto', label: 'Cartography', kind: 'png' },
    { id: 'text', label: 'Place names', kind: 'png' },
    { id: 'layer1', label: 'City icons', kind: 'svg' },
    { id: 'g9', label: 'Transportation', kind: 'svg', children: [
      { id: 'g10', label: 'Ports', kind: 'svg', children: [
        { id: 'g13', label: 'Deepwater', kind: 'svg' },
        { id: 'g12', label: 'Neopanamax', kind: 'svg' }] },
      { id: 'g11', label: 'Airports', kind: 'svg' },
      { id: 'g14', label: 'Spaceports', kind: 'svg' }] }
  ];
  function _worldPaint(vw) {
    if (_worldMap) { try { _worldMap.remove(); } catch (e) {} _worldMap = null; }
    vw.innerHTML =
      '<div class="wm-map" id="wm-map"></div>' +
      '<div class="wm-overctrls">' +
        '<button class="wm-cbtn" title="Reset view" onclick="ncWorldReset()">⊙</button>' +
        '<button class="wm-cbtn" title="Layers" onclick="ncWorldToggleLayers()">▦</button>' +
        '<button class="wm-cbtn" title="Legend" onclick="ncWorldToggleLegend()">⊞</button>' +
      '</div>' +
      '<div class="wm-layers" id="wm-layers" style="display:none"></div>' +
      '<div class="wm-legend" id="wm-legend" style="display:none"></div>' +
      '<div class="wm-hint" id="wm-hint">drag = pan · scroll = zoom · hover & click the city icons</div>';
    _worldBuildMap(vw);
  }
  // LOD tile pyramid (built by scripts/build-map-tiles.mjs). These constants MUST match it.
  var _WM_TILE = { W: 8192, H: 7709, Z: 5 };
  var _WM_BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  // Continuous smooth wheel-zoom handler (adapted from Leaflet.SmoothWheelZoom, MIT). Eases the zoom
  // toward a goal each animation frame via map._move, keeping the cursor point fixed. Registered once.
  var _smoothZoomInstalled = false;
  function _worldEnsureSmoothZoom() {
    if (_smoothZoomInstalled || !window.L || L.Map.SmoothWheelZoom) { _smoothZoomInstalled = true; return; }
    _smoothZoomInstalled = true;
    L.Map.mergeOptions({ smoothWheelZoom: true, smoothSensitivity: 1 });
    L.Map.SmoothWheelZoom = L.Handler.extend({
      addHooks: function () { L.DomEvent.on(this._map._container, 'wheel', this._onWheelScroll, this); },
      removeHooks: function () { L.DomEvent.off(this._map._container, 'wheel', this._onWheelScroll, this); },
      _onWheelScroll: function (e) { if (!this._isWheeling) this._onWheelStart(e); this._onWheeling(e); },
      _onWheelStart: function (e) {
        var map = this._map;
        this._isWheeling = true;
        this._wheelMousePosition = map.mouseEventToContainerPoint(e);
        this._centerPoint = map.getSize()._divideBy(2);
        this._startLatLng = map.containerPointToLatLng(this._centerPoint);
        this._wheelStartLatLng = map.containerPointToLatLng(this._wheelMousePosition);
        this._startZoom = map.getZoom();
        this._moved = false; this._zooming = true;
        map._stop(); if (map._panAnim) map._panAnim.stop();
        this._goalZoom = map.getZoom();
        this._prevCenter = map.getCenter(); this._prevZoom = map.getZoom();
        this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
      },
      _onWheeling: function (e) {
        var map = this._map;
        this._goalZoom = this._goalZoom - e.deltaY * 0.003 * map.options.smoothSensitivity;
        if (this._goalZoom < map.getMinZoom() || this._goalZoom > map.getMaxZoom()) this._goalZoom = map._limitZoom(this._goalZoom);
        this._wheelMousePosition = map.mouseEventToContainerPoint(e);
        clearTimeout(this._timeoutId);
        this._timeoutId = setTimeout(this._onWheelEnd.bind(this), 200);
        L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e);
      },
      _onWheelEnd: function () { this._isWheeling = false; cancelAnimationFrame(this._zoomAnimationId); this._map._moveEnd(true); },
      _updateWheelZoom: function () {
        var map = this._map;
        if (!map.getCenter().equals(this._prevCenter) || map.getZoom() != this._prevZoom) return;
        this._zoom = map.getZoom() + (this._goalZoom - map.getZoom()) * 0.3;
        this._zoom = Math.floor(this._zoom * 100) / 100;
        var delta = this._wheelMousePosition.subtract(this._centerPoint);
        if (delta.x === 0 && delta.y === 0) { this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this)); return; }
        var center = map.unproject(map.project(this._wheelStartLatLng, this._zoom).subtract(delta), this._zoom);
        map._move(center, this._zoom);
        this._prevCenter = map.getCenter(); this._prevZoom = map.getZoom();
        this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
      }
    });
    L.Map.addInitHook('addHandler', 'smoothWheelZoom', L.Map.SmoothWheelZoom);
  }
  function _worldBuildMap(vw) {
    var ws = _worldState(), T = _WM_TILE;
    _worldEnsureSmoothZoom();
    // Continuous (per-frame) wheel zoom instead of Leaflet's stepped zoom → smooth, no palier.
    var map = L.map('wm-map', { crs: L.CRS.Simple, zoomSnap: 0, minZoom: 0, maxZoom: T.Z + 2, attributionControl: false, maxBoundsViscosity: 0.9, scrollWheelZoom: false, smoothWheelZoom: true, smoothSensitivity: 1.3 });
    _worldMap = map;
    var bounds = L.latLngBounds(map.unproject([0, T.H], T.Z), map.unproject([T.W, 0], T.Z));
    function tl(name, zi) { return L.tileLayer('img/maps/tiles/' + name + '/{z}/{x}/{y}.png', { tileSize: 256, minZoom: 0, maxNativeZoom: T.Z, maxZoom: T.Z + 2, bounds: bounds, noWrap: true, errorTileUrl: _WM_BLANK, keepBuffer: 2, zIndex: zi }); }
    // z-order: cartography (opaque white) at the BOTTOM, place-names above it.
    _worldLayers = { carto: tl('carto', 1), text: tl('text', 2) };
    if (!ws.hidden.carto) _worldLayers.carto.addTo(map);
    if (!ws.hidden.text) _worldLayers.text.addTo(map);
    map.setMaxBounds(bounds.pad(0.05));
    _worldFitBounds = bounds; map.fitBounds(bounds, { animate: false });
    map.setMinZoom(map.getZoom() - 0.5);
    // Icons are individual Leaflet markers (one DOM node per city) — positioned by latlng so they
    // align exactly with the tiles, and small enough that the compositor never runs out of tile memory.
    _worldBuildMarkers(map, ws);
    _worldRenderTree(vw, ws);
    setTimeout(function () { if (_worldMap === map) map.invalidateSize(); }, 60);
  }
  // ── Marker-based icon layer ───────────────────────────────────────────────
  // Measure every icon's bbox ONCE in an offscreen (hidden, never painted) copy of the SVG rendered
  // 1:1 with its viewBox, mapping screen rects → viewBox units via getBoundingClientRect (robust, no
  // getCTM ambiguity). Each icon becomes a constant-screen-size L.marker positioned by its geographic
  // centre — Leaflet owns positioning so alignment is exact at every zoom, and there's no per-frame
  // CSS transform to drift/jitter. Discarding the measuring SVG means no full-map element survives
  // (no compositor tile-memory overflow). Hover grows a single inner div around its own centre.
  function _worldBuildMarkers(map, ws) {
    _worldMarkerGroups = {}; _worldCityByName = {};
    if (!_worldIconsSvg) return;
    var T = _WM_TILE, PPU = T.W / _WM_VB.w, NS = _WM_NS;
    var box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none';
    box.innerHTML = _worldIconsSvg;
    var svg = box.querySelector('svg'); if (!svg) return;
    // Render 1:1 with the viewBox so screen px == viewBox units (measured via getBoundingClientRect).
    svg.setAttribute('width', _WM_VB.w); svg.setAttribute('height', _WM_VB.h);
    document.body.appendChild(box);
    var sref = svg.getBoundingClientRect();
    var sx = _WM_VB.w / (sref.width || _WM_VB.w), sy = _WM_VB.h / (sref.height || _WM_VB.h);
    function vbBox(el) {
      var r = el.getBoundingClientRect(); if (!r.width || !r.height) return null;
      return { x: _WM_VB.x + (r.left - sref.left) * sx, y: _WM_VB.y + (r.top - sref.top) * sy, w: r.width * sx, h: r.height * sy };
    }
    function ll(cx, cy) { return map.unproject([cx * PPU, cy * PPU], T.Z); }
    function mtx(m) { return 'matrix(' + m.a + ',' + m.b + ',' + m.c + ',' + m.d + ',' + m.e + ',' + m.f + ')'; }
    function makeMarker(el, label, interactive) {
      var bb = vbBox(el); if (!bb) return null;
      // Icon rendered at its NATIVE map size (px at deepest zoom Z); the .wm-cm-z wrapper is scaled
      // per-zoom by a CSS var so the icon grows/shrinks exactly with the cartography. Anchored at the
      // icon's geographic centre → aligned at every zoom.
      var Wp = bb.w * PPU, Hp = bb.h * PPU;
      // el.outerHTML keeps el's OWN transform but drops its ANCESTORS' (e.g. Spaceports g14 carries a
      // translate). Bake the parent's full matrix so the icon lands where bb (root space) expects it.
      var pm = (el.parentNode && el.parentNode.getCTM) ? el.parentNode.getCTM() : null;
      var open = pm ? '<g transform="' + mtx(pm) + '">' : '', close = pm ? '</g>' : '';
      var inner = '<div class="wm-cm-z"><div class="wm-cm-h"' + (label ? ' data-name="' + _esc(label) + '"' : '') + '>' +
        '<svg xmlns="' + NS + '" viewBox="' + bb.x + ' ' + bb.y + ' ' + bb.w + ' ' + bb.h + '" width="' + Wp + '" height="' + Hp + '" style="display:block;overflow:visible">' +
        open + el.outerHTML + close + '</svg></div></div>';
      var icon = L.divIcon({ html: inner, className: 'wm-cm', iconSize: [Wp, Hp], iconAnchor: [Wp / 2, Hp / 2] });
      return L.marker(ll(bb.x + bb.w / 2, bb.y + bb.h / 2), { icon: icon, interactive: !!interactive, keyboard: false, riseOnHover: !!interactive });
    }
    function growEl(mk, on) { var el = mk.getElement && mk.getElement(); if (!el) return; var h = el.querySelector('.wm-cm-h') || el; if (h) h.classList.toggle('grow', on); }
    // City icons (layer1) — interactive, hover-grow + click → info window.
    var layer1 = svg.querySelector('#layer1'), cityGrp = L.layerGroup();
    if (layer1) {
      Array.prototype.forEach.call(layer1.querySelectorAll('g'), function (g) {
        var label = g.getAttribute('data-name') || g.getAttribute('inkscape:label'); if (!label) return;
        var mk = makeMarker(g, label, true); if (!mk) return;
        cityGrp.addLayer(mk);
        (_worldCityByName[label] = _worldCityByName[label] || []).push(mk);
        var together = /Metroplex|Plex/i.test(label);   // same-name plexes grow together; agri/cities grow alone
        mk.on('mouseover', function () { if (together) (_worldCityByName[label] || []).forEach(function (m) { growEl(m, true); }); else growEl(mk, true); });
        mk.on('mouseout', function () { if (together) (_worldCityByName[label] || []).forEach(function (m) { growEl(m, false); }); else growEl(mk, false); });
        mk.on('click', function (e) { _worldCityClick(map, e, label); });
      });
    }
    _worldMarkerGroups.layer1 = cityGrp;
    // Transport icons (layer3) — non-interactive, toggleable by leaf category.
    [['g13'], ['g12'], ['g11'], ['g14']].forEach(function (pair) {
      var grp = L.layerGroup(), node = svg.querySelector('#' + pair[0]);
      if (node) Array.prototype.forEach.call(node.children, function (ic) { var mk = makeMarker(ic, null, false); if (mk) grp.addLayer(mk); });
      _worldMarkerGroups[pair[0]] = grp;
    });
    document.body.removeChild(box);   // drop the measuring SVG — nothing full-map-sized persists
    // Add the groups that aren't hidden (parent toggles roll down to leaves in _worldApplyMarkerVis).
    _worldApplyMarkerVis(map, ws);
    // Scale every icon with the zoom via ONE CSS var on the marker pane (icons sized to native px at
    // zoom Z, so var = 2^(zoom-Z) makes them track the cartography). Cheap: one style write per zoom.
    function setScale() { var p = map.getPanes && map.getPanes().markerPane; if (p) p.style.setProperty('--wm-iscale', Math.pow(2, map.getZoom() - T.Z)); }
    map.on('zoom', setScale); map.on('zoomend', setScale); setScale();
    // Custom logged locations (cities + numbered points) sit in their own group, always visible.
    _worldRenderLocMarkers();
    // Highlight-custom mode: dim the built-in map icons so logged locations stand out.
    var vw0 = document.getElementById('view-world'); if (vw0) vw0.classList.toggle('wm-highlight-custom', !!ws.highlightCustom);
    // Click empty map → log a new location (GM and player both can).
    map.on('click', _worldMapClick);
  }
  // ── Custom logged locations (cities of a chosen type + numbered "other" points) ───────────────
  var _worldLocGroup = null;
  function _worldPPU() { return _WM_TILE.W / _WM_VB.w; }
  function _worldLL(vx, vy) { return _worldMap.unproject([vx * _worldPPU(), vy * _worldPPU()], _WM_TILE.Z); }
  function _worldLocIconHtml(place, number) {
    var vb, body;
    if (place.kind === 'city') {
      var t = _worldLocType(place.cityType) || _worldLocType('new') || (_WM_LOC && _WM_LOC.types[0]);
      if (!t) return null; vb = t.vb; body = t.body;
    } else {
      if (!_WM_LOC || !_WM_LOC.marker) return null;
      vb = _WM_LOC.marker.vb;
      var vbn = vb.split(/\s+/).map(Number), cx = vbn[0] + vbn[2] / 2, cy = vbn[1] + vbn[3] / 2;
      body = _WM_LOC.marker.body +
        '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" ' +
        'style="font:700 ' + (vbn[3] * 0.5) + 'px var(--mono,monospace);fill:#000">' + (number || 1) + '</text>';
    }
    var vbn2 = vb.split(/\s+/).map(Number), Wp = vbn2[2] * _worldPPU(), Hp = vbn2[3] * _worldPPU();
    return { vb: vb, body: body, Wp: Wp, Hp: Hp };
  }
  function _worldRenderLocMarkers() {
    if (!_worldMap || !_WM_LOC) return;
    if (_worldLocGroup) { try { _worldLocGroup.remove(); } catch (e) {} }
    _worldLocGroup = L.layerGroup();
    var places = _worldAllPlaces(), NS = _WM_NS, n = 0;
    places.forEach(function (p) {
      var num = (p.kind === 'city') ? 0 : (++n);
      var art = _worldLocIconHtml(p, num); if (!art) return;
      var inner = '<div class="wm-cm-z"><div class="wm-cm-h" data-name="' + _esc(p.name || (p.kind === 'city' ? 'City' : 'Location')) + '">' +
        '<svg xmlns="' + NS + '" viewBox="' + art.vb + '" width="' + art.Wp + '" height="' + art.Hp + '" style="display:block;overflow:visible">' + art.body + '</svg>' +
        '</div></div>';
      var icon = L.divIcon({ html: inner, className: 'wm-cm wm-cm-loc', iconSize: [art.Wp, art.Hp], iconAnchor: [art.Wp / 2, art.Hp / 2] });
      var mk = L.marker(_worldLL(p.vx, p.vy), { icon: icon, interactive: true, keyboard: false, riseOnHover: true });
      mk.on('mouseover', function () { var el = mk.getElement && mk.getElement(); var h = el && el.querySelector('.wm-cm-h'); if (h) h.classList.add('grow'); });
      mk.on('mouseout', function () { var el = mk.getElement && mk.getElement(); var h = el && el.querySelector('.wm-cm-h'); if (h) h.classList.remove('grow'); });
      mk.on('click', function (e) { if (e.originalEvent) L.DomEvent.stop(e.originalEvent); _worldPlaceView(p, e); });
      _worldLocGroup.addLayer(mk);
    });
    _worldLocGroup.addTo(_worldMap);
  }
  function _worldMapClick(e) {
    if (!e || !e.latlng || !_WM_LOC) return;
    var pt = _worldMap.project(e.latlng, _WM_TILE.Z), ppu = _worldPPU();
    _worldTypePopup(pt.x / ppu, pt.y / ppu);
  }
  // Popup 1 — pick a location type: any city type (icon grid) or a numbered "Other" point.
  var _worldPending = null;
  function _worldTypePopup(vx, vy) {
    if (!_WM_LOC) return;
    _worldPending = { vx: vx, vy: vy };
    var cells = (_WM_LOC.types || []).map(function (t) {
      return '<button class="wm-typecell" onclick="ncWorldPickType(\'city\',\'' + t.id + '\')">' +
        '<span class="wm-typeic"><svg viewBox="' + t.vb + '">' + t.body + '</svg></span>' +
        '<span class="wm-typelbl">' + _esc(t.label) + '</span></button>';
    }).join('');
    var other = _WM_LOC.marker ? '<button class="wm-typecell wm-typecell-other" onclick="ncWorldPickType(\'other\',\'\')">' +
      '<span class="wm-typeic"><svg viewBox="' + _WM_LOC.marker.vb + '">' + _WM_LOC.marker.body + '</svg></span>' +
      '<span class="wm-typelbl">Other location</span></button>' : '';
    _ncModalOpen('New location — pick a type', '<div class="wm-typegrid">' + cells + other + '</div>');
  }
  window.ncWorldPickType = function (kind, cityType) {
    if (!_worldPending) return;
    var p = makeWorldPlace(kind, _worldPending.vx, _worldPending.vy);
    if (kind === 'city') p.cityType = cityType;
    _worldPending = null;
    _worldPlaceModal(p, true);
  };
  // Popup 2 — details form (city fields vs. generic place fields), same design as the other maps.
  var _worldDraft = null, _worldDraftNew = false;
  function _worldPlaceModal(place, isNew) {
    _worldDraft = place; _worldDraftNew = isNew;
    var e = place, city = e.kind === 'city', ct = city ? _worldLocType(e.cityType) : null;
    var head = '<div class="wm-form-type">' +
      (city && ct ? '<span class="wm-typeic wm-typeic-sm"><svg viewBox="' + ct.vb + '">' + ct.body + '</svg></span>' : '') +
      '<span class="wm-form-typelbl">' + _esc(city ? ((ct && ct.label) || 'City') : 'Other location') + '</span></div>';
    var body = '<div class="wm-form">' + head +
      '<label class="nc-modal-lbl">Name<input id="wm-f-name" value="' + _esc(e.name) + '" placeholder="Location name"></label>';
    if (city) {
      body += '<label class="nc-modal-lbl">Population<input id="wm-f-pop" value="' + _esc(e.population) + '" placeholder="e.g. 2.3M"></label>' +
        '<label class="nc-modal-lbl">Dominant corp / power<input id="wm-f-corp" value="' + _esc(e.corp) + '" placeholder="opt."></label>';
    } else {
      body += '<label class="nc-modal-lbl">Type<input id="wm-f-type" value="' + _esc(e.type) + '" placeholder="e.g. Safehouse, Ruin, Base"></label>' +
        '<label class="nc-modal-lbl">Security<input id="wm-f-sec" value="' + _esc(e.security) + '" placeholder="opt."></label>';
    }
    body += '<label class="nc-modal-lbl">Description<textarea id="wm-f-notes" rows="4" placeholder="Notes…">' + _esc(e.notes) + '</textarea></label>';
    if (NC_MODE === 'gm') body += '<label class="nc-modal-check"><input type="checkbox" id="wm-f-public"' + (e.public ? ' checked' : '') + '> Public — visible to players in session</label>';
    if (NC_MODE === 'gm' && !isNew) {
      var lm = _linkedMapOf(e.linkedMapId);
      body += lm
        ? '<div class="wm-form-maprow">Linked map: <b>' + _esc(lm.srcName || lm.name) + '</b> <button class="nc-btn nc-btn-sm" onclick="ncWorldOpenMap(\'' + lm.id + '\')">Open</button> <button class="nc-btn nc-btn-sm nc-btn-danger" onclick="ncWorldPlaceUnlink()">Unlink</button></div>'
        : '<button class="nc-btn" onclick="ncWorldPlaceLinkMap()">＋ Link a map</button>';
    }
    body += '<div class="wm-form-actions">' +
      (isNew ? '' : '<button class="nc-btn nc-btn-danger" onclick="ncWorldDeletePlace()">Delete</button>') +
      '<span class="wm-form-spacer"></span>' +
      '<button class="nc-btn" onclick="ncModalClose()">Cancel</button>' +
      '<button class="nc-btn nc-btn-cy" onclick="ncWorldSavePlace()">Save</button></div></div>';
    _ncModalOpen(isNew ? 'New location' : 'Edit location', body);
  }
  window.ncWorldSavePlace = function () {
    var e = _worldDraft; if (!e) return;
    var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    e.name = v('wm-f-name'); e.notes = v('wm-f-notes');
    if (e.kind === 'city') { e.population = v('wm-f-pop'); e.corp = v('wm-f-corp'); }
    else { e.type = v('wm-f-type'); e.security = v('wm-f-sec'); }
    var pubEl = document.getElementById('wm-f-public'); if (pubEl) e.public = pubEl.checked;
    if (_worldDraftNew) _worldState().places.push(e);
    _schedSave(); _postPublic();
    ncModalClose(); _worldRenderLocMarkers();
  };
  window.ncWorldDeletePlace = function () {
    var e = _worldDraft; if (!e) return;
    if (!confirm('Delete this location?')) return;
    var st = _worldState(); st.places = (st.places || []).filter(function (x) { return x.id !== e.id; });
    _schedSave(); _postPublic();
    ncModalClose(); _worldRenderLocMarkers();
  };
  // Click a logged location → redesigned info window. Own locations get Edit; linked maps get Open.
  function _worldPlaceView(place, e) {
    var city = place.kind === 'city', ct = city ? _worldLocType(place.cityType) : null;
    var typeLbl = city ? (((ct && ct.label) || 'City') + ' city') : (place.type || 'Location');
    var own = !place._ro && (_worldState().places || []).some(function (x) { return x.id === place.id; });
    var lm = _linkedMapOf(place.linkedMapId);
    var rows = [];
    if (city && place.population) rows.push('<div class="wm-cpop-row"><b>Population</b> ' + _esc(place.population) + '</div>');
    if (city && place.corp) rows.push('<div class="wm-cpop-row"><b>Power</b> ' + _esc(place.corp) + '</div>');
    if (!city && place.security) rows.push('<div class="wm-cpop-row"><b>Security</b> ' + _esc(place.security) + '</div>');
    var actions = '';
    if (lm) actions += '<button class="wm-cpop-btn" onclick="ncWorldOpenMap(\'' + lm.id + '\')">Open ' + _esc(lm.srcName || lm.name) + ' ▸</button>';
    if (own) actions += '<button class="wm-cpop-btn wm-cpop-btn2" onclick="ncWorldEditFromPopup(\'' + place.id + '\')">Edit ✎</button>';
    var html = _worldInfoHtml({ name: place.name || (city ? 'Unnamed city' : 'Location'), type: typeLbl,
      color: city ? '#2b6cb0' : '#555', desc: place.notes, emptyDesc: 'No description yet.', rows: rows, actions: actions });
    var ll = (e && e.latlng) ? e.latlng : _worldLL(place.vx, place.vy);
    L.popup({ className: 'wm-cpop-wrap', offset: [0, -8], minWidth: 220, maxWidth: 290 }).setLatLng(ll).setContent(html).openOn(_worldMap);
  }
  window.ncWorldEditFromPopup = function (id) {
    var p = (_worldState().places || []).filter(function (x) { return x.id === id; })[0]; if (!p) return;
    try { _worldMap.closePopup(); } catch (e) {}
    _worldPlaceModal(p, false);
  };
  window.ncWorldPlaceLinkMap = function () {
    var e = _worldDraft; if (!e) return;
    _createLinkedMap('world', e.id, e.name || 'Location', function (mapId) {
      e.linkedMapId = mapId; _schedSave(); _postPublic(); ncModalClose(); _worldRenderLocMarkers(); ncSelectMap(mapId);
    });
  };
  window.ncWorldPlaceUnlink = function () {
    var e = _worldDraft; if (!e) return;
    if (e.linkedMapId) GM.maps = GM.maps.filter(function (m) { return m.id !== e.linkedMapId; });
    e.linkedMapId = null; _schedSave(); _postPublic(); _worldPlaceModal(e, false);
  };
  // Resolve the tree's hidden-state (parents g9/g10 cascade to leaves) → add/remove marker groups.
  function _worldApplyMarkerVis(map, ws) {
    if (!_worldMarkerGroups) return;
    var leafHidden = {
      layer1: !!ws.hidden.layer1,
      g13: !!(ws.hidden.g9 || ws.hidden.g10 || ws.hidden.g13),
      g12: !!(ws.hidden.g9 || ws.hidden.g10 || ws.hidden.g12),
      g11: !!(ws.hidden.g9 || ws.hidden.g11),
      g14: !!(ws.hidden.g9 || ws.hidden.g14)
    };
    Object.keys(_worldMarkerGroups).forEach(function (id) {
      var grp = _worldMarkerGroups[id]; if (!grp) return;
      if (leafHidden[id]) { if (map.hasLayer(grp)) grp.remove(); }
      else if (!map.hasLayer(grp)) grp.addTo(map);
    });
  }
  function _cityInfo(label) {
    if (/Agri-Communities/i.test(label)) return { title: 'Agri-Community', type: 'Agri-Community', blurb: 'Automated agricultural settlement that feeds the metroplexes.' };
    if (/Corporate Communities/i.test(label)) return { title: 'Corporate Community', type: 'Corporate Community', blurb: 'Company-owned, company-run enclave.' };
    if (/Metroplex/i.test(label)) return { title: label, type: 'Metroplex', blurb: '' };
    if (/Plex/i.test(label)) return { title: label, type: 'Plex', blurb: '' };
    return { title: label, type: 'City', blurb: '' };
  }
  function _cityTypeColor(type) {
    if (/Metroplex/i.test(type)) return '#c0392b';
    if (/Plex/i.test(type)) return '#b8860b';
    if (/Agri/i.test(type)) return '#1a7a2e';
    if (/Corporate/i.test(type)) return '#2b6cb0';
    return '#555';
  }
  // Merge a built-in city's data: GM sees its own record; a player sees synced GM lore + own notes.
  function _worldCityMerged(label) {
    var own = _worldCityRec(label, false) || {};
    if (NC_MODE === 'player') {
      var lore = (_worldGmCityData && _worldGmCityData[label]) || {};
      return { desc: lore.desc || '', linkedMapId: lore.linkedMapId || null, gmNotes: '', notes: own.notes || '' };
    }
    return { desc: own.desc || '', linkedMapId: own.linkedMapId || null, gmNotes: own.gmNotes || '', notes: own.notes || '' };
  }
  // Shared renderer for the redesigned info window (name on black, type in colour, diegetic body).
  function _worldInfoHtml(opts) {
    var color = opts.color || '#555';
    var lore = opts.desc ? '<div class="wm-cpop-lore">' + _esc(opts.desc) + '</div>'
      : '<div class="wm-cpop-lore wm-cpop-empty">' + _esc(opts.emptyDesc || 'No intel logged.') + '</div>';
    var rows = (opts.rows || []).filter(Boolean).join('');
    var notes = '';
    if (opts.gmNotes) notes += '<div class="wm-cpop-note wm-cpop-note-gm"><span class="wm-cpop-note-k">GM</span>' + _esc(opts.gmNotes) + '</div>';
    if (opts.notes) notes += '<div class="wm-cpop-note"><span class="wm-cpop-note-k">Notes</span>' + _esc(opts.notes) + '</div>';
    return '<div class="wm-cpop wm-cpop2">' +
      '<div class="wm-cpop-name">' + _esc(opts.name) + '</div>' +
      '<div class="wm-cpop-sub" style="color:' + color + '">' + _esc(opts.type) + '</div>' +
      (rows ? '<div class="wm-cpop-stats">' + rows + '</div>' : '') +
      lore + notes +
      (opts.actions ? '<div class="wm-cpop-actions">' + opts.actions + '</div>' : '') +
      '</div>';
  }
  function _worldCityClick(map, e, label) {
    var info = _cityInfo(label), nc = /night city/i.test(label), rec = _worldCityMerged(label);
    var ll = (e && e.latlng) ? e.latlng : (e && e.target && e.target.getLatLng ? e.target.getLatLng() : map.getCenter());
    var lm = _linkedMapOf(rec.linkedMapId);
    var esc = label.replace(/'/g, "\\'");
    var actions = '';
    if (nc) actions += '<button class="wm-cpop-btn" onclick="ncOpenNightCity()">Open Night City map ▸</button>';
    if (lm) actions += '<button class="wm-cpop-btn" onclick="ncWorldOpenMap(\'' + lm.id + '\')">Open ' + _esc(lm.srcName || lm.name) + ' ▸</button>';
    if (NC_MODE === 'gm') actions += '<button class="wm-cpop-btn wm-cpop-btn2" onclick="ncCityEdit(\'' + esc + '\')">Edit city ✎</button>';
    else actions += '<button class="wm-cpop-btn wm-cpop-btn2" onclick="ncCityAddNote(\'' + esc + '\')">Add a note +</button>';
    var html = _worldInfoHtml({ name: info.title, type: info.type, color: _cityTypeColor(info.type),
      desc: rec.desc || info.blurb, emptyDesc: 'No intel logged.', gmNotes: rec.gmNotes, notes: rec.notes, actions: actions });
    L.popup({ className: 'wm-cpop-wrap', offset: [0, -8], minWidth: 220, maxWidth: 290 }).setLatLng(ll).setContent(html).openOn(map);
  }
  window.ncWorldOpenMap = function (id) { try { _worldMap.closePopup(); } catch (e) {} ncSelectMap(id); };
  // GM city editor — description, GM notes, and link/replace a nested map.
  window.ncCityEdit = function (label) {
    var rec = _worldCityRec(label, true), lm = _linkedMapOf(rec.linkedMapId);
    try { _worldMap.closePopup(); } catch (e) {}
    var mapRow = lm
      ? '<div class="wm-form-maprow">Linked map: <b>' + _esc(lm.srcName || lm.name) + '</b> <button class="nc-btn nc-btn-sm" onclick="ncWorldOpenMap(\'' + lm.id + '\')">Open</button> <button class="nc-btn nc-btn-sm nc-btn-danger" onclick="ncCityUnlink(\'' + label.replace(/'/g, "\\'") + '\')">Unlink</button></div>'
      : '<button class="nc-btn" onclick="ncCityLinkMap(\'' + label.replace(/'/g, "\\'") + '\')">＋ Link a map</button>';
    var body = '<div class="wm-form">' +
      '<label class="nc-modal-lbl">Description<textarea id="wm-c-desc" rows="4" placeholder="Canon lore — shared with players">' + _esc(rec.desc) + '</textarea></label>' +
      '<label class="nc-modal-lbl">GM notes (private)<textarea id="wm-c-gmn" rows="3" placeholder="GM-only">' + _esc(rec.gmNotes) + '</textarea></label>' +
      mapRow +
      '<div class="wm-form-actions"><span class="wm-form-spacer"></span><button class="nc-btn" onclick="ncModalClose()">Cancel</button><button class="nc-btn nc-btn-cy" onclick="ncCitySave(\'' + label.replace(/'/g, "\\'") + '\')">Save</button></div></div>';
    _ncModalOpen(label, body);
  };
  window.ncCitySave = function (label) {
    var rec = _worldCityRec(label, true);
    var d = document.getElementById('wm-c-desc'), g = document.getElementById('wm-c-gmn');
    if (d) rec.desc = d.value.trim(); if (g) rec.gmNotes = g.value.trim();
    _schedSave(); _postPublic(); ncModalClose();
  };
  window.ncCityLinkMap = function (label) {
    _createLinkedMap('world', 'city:' + label, label, function (mapId) {
      var rec = _worldCityRec(label, true); rec.linkedMapId = mapId; _schedSave(); _postPublic();
      ncModalClose(); ncSelectMap(mapId);
    });
  };
  window.ncCityUnlink = function (label) {
    var rec = _worldCityRec(label, true); if (rec.linkedMapId) { GM.maps = GM.maps.filter(function (m) { return m.id !== rec.linkedMapId; }); }
    rec.linkedMapId = null; _schedSave(); _postPublic(); ncModalClose(); ncRenderMapsBar();
  };
  window.ncCityAddNote = function (label) {
    var rec = _worldCityRec(label, true);
    try { _worldMap.closePopup(); } catch (e) {}
    var body = '<div class="wm-form"><label class="nc-modal-lbl">Your note<textarea id="wm-c-note" rows="5" placeholder="Private note…">' + _esc(rec.notes) + '</textarea></label>' +
      '<div class="wm-form-actions"><span class="wm-form-spacer"></span><button class="nc-btn" onclick="ncModalClose()">Cancel</button><button class="nc-btn nc-btn-cy" onclick="ncCityNoteSave(\'' + label.replace(/'/g, "\\'") + '\')">Save</button></div></div>';
    _ncModalOpen('Note — ' + label, body);
  };
  window.ncCityNoteSave = function (label) {
    var rec = _worldCityRec(label, true), n = document.getElementById('wm-c-note');
    if (n) rec.notes = n.value.trim(); _schedSave(); ncModalClose();
  };
  // Nested layer-toggle tree in the Layers panel.
  function _worldRenderTree(vw, ws) {
    var panel = vw.querySelector('#wm-layers'); if (!panel) return;
    function row(node, depth) {
      var h = '<label class="wm-lrow" style="padding-left:' + (4 + depth * 16) + 'px"><input type="checkbox" data-wl="' + node.id + '"' + (ws.hidden[node.id] ? '' : ' checked') + '><span>' + _esc(node.label) + '</span></label>';
      if (node.children) node.children.forEach(function (c) { h += row(c, depth + 1); });
      return h;
    }
    panel.innerHTML = '<div class="wm-panel-h">LAYERS</div>' + _WM_TREE.map(function (n) { return row(n, 0); }).join('');
    panel.querySelectorAll('[data-wl]').forEach(function (cb) {
      cb.onchange = function () {
        var id = cb.getAttribute('data-wl'), on = cb.checked;
        if (on) delete ws.hidden[id]; else ws.hidden[id] = true; _schedSave();
        if (id === 'carto' || id === 'text') { var ly = _worldLayers && _worldLayers[id]; if (ly) { if (on) ly.addTo(_worldMap); else ly.remove(); } }
        else if (_worldMap) { _worldApplyMarkerVis(_worldMap, ws); }
      };
    });
  }
  window.ncWorldReset = function () { if (_worldMap && _worldFitBounds) _worldMap.fitBounds(_worldFitBounds); };
  window.ncOpenNightCity = function () {
    var ws = _worldState(); ws.ncPinned = true; _schedSave();
    if (_worldMap) { try { _worldMap.closePopup(); } catch (e) {} }
    ncSelectMap('nc');
  };
  window.ncCloseNightCity = function () {
    var ws = _worldState(); ws.ncPinned = false; _schedSave();
    if (_surface === 'nc') ncSelectMap('world'); else ncRenderMapsBar();
  };
  window.ncWorldToggleLayers = function () {
    var p = document.getElementById('wm-layers'); if (p) p.style.display = (p.style.display === 'none') ? 'block' : 'none';
    var lg = document.getElementById('wm-legend'); if (lg) lg.style.display = 'none';
  };
  window.ncWorldToggleLegend = function () {
    var lg = document.getElementById('wm-legend'); if (!lg) return;
    var ly = document.getElementById('wm-layers'); if (ly) ly.style.display = 'none';
    if (lg.style.display !== 'none') { lg.style.display = 'none'; return; }
    lg.style.display = 'block';
    if (_worldLegendSvg) { lg.innerHTML = _worldLegendSvg; _worldFitLegend(lg); return; }
    lg.innerHTML = '<div class="wm-msg">Loading legend…</div>';
    fetch('img/maps/legend.svg').then(function (r) { return r.text(); })
      .then(function (t) { _worldLegendSvg = t; lg.innerHTML = t; _worldFitLegend(lg); })
      .catch(function () { lg.innerHTML = '<div class="wm-msg">Could not load legend.</div>'; });
  };
  function _worldFitLegend(lg) { var s = lg.querySelector('svg'); if (s) { s.removeAttribute('width'); s.removeAttribute('height'); s.style.width = '100%'; s.style.height = 'auto'; s.style.display = 'block'; } }

  function ncRenderCustomMap(id) {
    var vc = document.getElementById('view-custom'); if (!vc) return;
    var m = _findMap(id);
    if (!m) { vc.innerHTML = '<div class="nc-cm-empty">Map not found.</div>'; return; }
    var gm = NC_MODE === 'gm';
    var head = '<div class="nc-cm-head">' +
      (gm ? '<input class="nc-cm-name" value="' + _esc(m.name) + '" onchange="ncRenameMap(\'' + id + '\',this.value)">' : '<span class="nc-cm-title">' + _esc(m.name) + '</span>') +
      (gm ? '<button class="nc-btn nc-btn-sm nc-btn-danger" onclick="ncDeleteMap(\'' + id + '\')">Delete</button>' : '') + '</div>';
    var body;
    if (m.kind === 'list' || !m.image) {
      body = '<div class="nc-cm-listonly">' + _customListHtml(id, m) + '</div>';
    } else {
      var pins = _allMapPlaces(m).filter(function (p) { return p.pin; }).map(function (p, i) {
        return '<div class="nc-cm-pin' + (p._ro ? ' ro' : '') + (p.public ? ' pub' : '') + '" style="left:' + (p.pin.x * 100) + '%;top:' + (p.pin.y * 100) + '%" onclick="event.stopPropagation();ncCustomPlaceModal(\'' + id + '\',\'' + p.id + '\')"><span>' + (i + 1) + '</span></div>';
      }).join('');
      body = '<div class="nc-cm-stage"><div class="nc-cm-imgwrap" onclick="ncCustomMapClick(\'' + id + '\',event)"><img src="' + m.image + '">' + pins + '</div>' +
        '<div class="nc-cm-side">' + _customListHtml(id, m) + '</div></div>';
    }
    vc.innerHTML = head + body;
  }
  window.ncCustomMapClick = function (id, ev) {
    if (NC_MODE === 'ref') return;
    if (ev.target.closest && ev.target.closest('.nc-cm-pin')) return;
    var wrap = ev.currentTarget, img = wrap.querySelector('img'); if (!img) return;
    var r = img.getBoundingClientRect();
    var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    ncCustomPlaceModal(id, null, { x: x, y: y });
  };
  // Custom-map locations reuse the full Night City place modal (same fields:
  // type, security, notes, photos, hacked maps, public). Read-only for players
  // viewing a synced GM pin.
  window.ncCustomPlaceModal = function (mapId, placeId, pin) {
    var m = _findMap(mapId);
    var ex = placeId ? _findPlace(m, placeId) : null;
    var own = ex && (m.entries || []).some(function (p) { return p.id === placeId; });
    _modalMapId = mapId; _modalDistrict = ''; _modalEntryId = placeId || null; _modalLayerIdx = null;
    _modalReadonly = !!ex && !own;
    _modalMode = placeId ? 'view' : 'edit';
    _modalDraft = ex ? JSON.parse(JSON.stringify(ex)) : makePlace('');
    if (pin && !ex) _modalDraft.pin = { x: pin.x, y: pin.y };
    _renderModal();
  };

  /* ═══ INIT ═══ */
  function _afterLoad() {
    _installHooks();
    // App-embed: lock to the given role and hide the mode switcher.
    if (_NCROLE === 'gm' || _NCROLE === 'player') {
      NC_MODE = _NCROLE;
      var mb = document.getElementById('nc-modebar'); if (mb) mb.style.display = 'none';
      var back = document.querySelector('#nav .back'); if (back) back.style.display = 'none';
    }
    document.body.setAttribute('data-nc-mode', NC_MODE);
    ncApplyModeToDistrictView();
    ncRenderCtxBar();
    ncRenderSidePanel();
    if (typeof window.ncSetView === 'function') window.ncSetView('atlas');   // prime NC City view
    // NA (world) is the root surface everywhere — the app and the public reference site — with
    // Night City nested under it in the map tree.
    ncSelectMap('world');
  }
  function init() {
    if (_GM_API) { _loadCampaignGM(_afterLoad); }
    else { _load(); _afterLoad(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Live session overlays: the app shell (player) pushes public campaign locations.
  // They appear as a toggleable GM layer, not persisted to localStorage.
  window.addEventListener('message', function (ev) {
    var d = ev.data; if (!d || d.type !== 'nc-sync-layers') return;
    PLAYER.gmLayers = PLAYER.gmLayers.filter(function (L) { return !L.synced; });
    (d.layers || []).forEach(function (L) {
      PLAYER.gmLayers.push({ id: L.id || _uid(), name: L.name || 'Campaign', hidden: false, synced: true, entries: (L.entries || []).map(_migratePlace) });
    });
    // Synced custom maps: keep the player's own pins, replace the GM public pins.
    if (Array.isArray(d.maps)) {
      var ownById = {}; (PLAYER.maps || []).forEach(function (m) { ownById[m.id] = m.entries || []; });
      PLAYER.maps = d.maps.map(function (m) { var mm = _migrateMap(m); mm.gmEntries = (m.gmEntries || []).map(_migrateCustomPlace); mm.entries = ownById[m.id] || []; return mm; });
      PLAYER.mapOrder = Array.isArray(d.order) && d.order.length ? d.order : ['nc'].concat(d.maps.map(function (m) { return m.id; }));
    }
    // Synced public world locations + city lore (GM → players), read-only on the world map.
    _worldGmPlaces = Array.isArray(d.worldPlaces) ? d.worldPlaces : [];
    _worldGmCityData = (d.worldCities && typeof d.worldCities === 'object') ? d.worldCities : {};
    if (NC_MODE !== 'player') window.ncSetMode('player');
    else { ncRenderSidePanel(); ncRenderMapsBar(); ncAfterChange(); if (_surface !== 'nc') ncRenderCustomMap(_surface); if (_surface === 'world') _worldRenderLocMarkers(); }
  });
  // App shell tells the map which locations host a shop → show an "open shop" chip.
  window.addEventListener('message', function (ev) {
    var d = ev.data; if (!d || d.type !== 'nc-shop-locs') return;
    _shopLocs = {}; (d.names || []).forEach(function (n) { if (n) _shopLocs[String(n).toLowerCase()] = 1; });
    try { ncRenderSidePanel(); } catch (e) {}
    try { ncAfterChange(); } catch (e) {}
    try { if (_surface !== 'nc') ncRenderCustomMap(_surface); } catch (e) {}
  });
})();

/* Relay ⌘K up to the app shell so the command palette opens even when the map
   iframe has focus. */
window.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && window.parent && window.parent !== window) {
    e.preventDefault(); try { window.parent.postMessage({ type: 'nav-key', key: 'k' }, '*'); } catch (_) {}
  }
});
