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
  var _surface = 'nc';                                   // active map surface: 'nc' | <customMapId>
  // Custom-map places share the full Night City place shape (photos, security…).
  function _migrateCustomPlace(p) { var m = _migratePlace(p || {}); m.pin = (p && p.pin && typeof p.pin.x === 'number') ? { x: p.pin.x, y: p.pin.y } : (m.pin || null); return m; }
  function _migrateMap(m) {
    m = m || {};
    return { id: m.id || _uid(), name: m.name || 'Map', kind: m.kind === 'list' ? 'list' : 'map',
      image: m.image || null, w: m.w || 0, h: m.h || 0, entries: Array.isArray(m.entries) ? m.entries.map(_migrateCustomPlace) : [] };
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
  function _publicMaps() {   // public maps in the GM-chosen order
    _ncEnsureOrder();
    var byId = {}; GM.maps.forEach(function (m) { byId[m.id] = m; });
    var out = [];
    GM.order.forEach(function (id) {
      if (id === 'nc') return;
      var m = byId[id]; if (!m) return;
      var pub = (m.entries || []).filter(function (e) { return e.public; });
      if (pub.length) out.push({ id: m.id, name: m.name, kind: m.kind, image: m.image, w: m.w, h: m.h, gmEntries: pub });
    });
    return out;
  }
  function _postPublic() {
    if (window.parent === window) return;
    var maps = _publicMaps(), pubIds = maps.map(function (m) { return m.id; });
    var order = (GM.order || ['nc']).filter(function (id) { return id === 'nc' || pubIds.indexOf(id) >= 0; });
    try { window.parent.postMessage({ type: 'nc-gm-public', campaign: _CAMPAIGN, places: _publicPlaces(), maps: maps, order: order }, '*'); } catch (e) {}
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
  function ncRenderCtxBar() {
    var bar = document.getElementById('nc-ctxbar'); if (!bar) return;
    if (NC_MODE === 'player') {
      bar.style.display = 'flex';
      bar.innerHTML =
        '<span class="nc-ctx-title">PLAYER LOG</span>' +
        '<button class="nc-btn" onclick="ncExportPlayer()">⬇ Export log</button>' +
        '<label class="nc-btn nc-file">⬆ Import log<input type="file" accept=".json" onchange="ncImportPlayer(event)"></label>' +
        '<label class="nc-btn nc-file nc-btn-cy">＋ Import GM plan<input type="file" accept=".json" onchange="ncImportGmPlan(event)"></label>' +
        '<span class="nc-ctx-hint">' + PLAYER.entries.length + ' notes · ' + PLAYER.gmLayers.length + ' GM layer(s)</span>';
    } else if (NC_MODE === 'gm') {
      bar.style.display = 'flex';
      var tabs = GM.list.map(function (nb, i) {
        return '<div class="nc-gm-tab' + (i === GM.active ? ' active' : '') + '" onclick="ncGmSwitch(' + i + ')" ondblclick="ncGmRename(' + i + ')" title="Double-click to rename">' +
          '<span class="nc-gm-tab-label">' + _esc(nb.name) + '</span>' +
          (GM.list.length > 1 ? '<span class="nc-gm-tab-close" onclick="event.stopPropagation();ncGmClose(' + i + ')">✕</span>' : '') +
          '</div>';
      }).join('');
      bar.innerHTML =
        '<span class="nc-ctx-title">GM PLANNER</span>' +
        '<div class="nc-gm-tabs">' + tabs + '<div class="nc-gm-tab-add" onclick="ncGmNew()" title="New notebook">＋</div></div>' +
        '<button class="nc-btn" onclick="ncExportGm()">⬇ Export notebook</button>' +
        '<label class="nc-btn nc-file">⬆ Import notebook<input type="file" accept=".json" onchange="ncImportGmNotebook(event)"></label>';
    } else {
      bar.style.display = 'none';
      bar.innerHTML = '';
    }
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
      ? '<span class="nc-entry-act" onclick="ncCopyToLog(' + layerIdx + ',\'' + e.id + '\')">copy to my log →</span>'
      : '<span class="nc-entry-act" onclick="ncEntryModal(\'' + e.district + '\',\'' + e.id + '\')">edit</span>';
    return '<div class="nc-entry' + (e.visited ? ' nc-visited' : '') + '">' +
      '<div class="nc-entry-head">' +
        '<span class="nc-type-pill" style="background:' + col + '">' + _esc(typeLabel(e.type)) + '</span>' +
        '<span class="nc-entry-addr">' + addr + '</span>' +
        '<span class="nc-entry-name">' + (isHome ? '⌂ ' : '') + _esc(e.name || '(unnamed)') + '</span>' +
        (e.security !== '' && e.security != null ? '<span class="nc-entry-sec">SEC ' + _esc(e.security) + '</span>' : '') +
        (!readonly && NC_MODE === 'gm' && e.public ? '<span class="nc-entry-pub">PUBLIC</span>' : '') +
        '<span class="nc-entry-act-wrap">' + actions + '</span>' +
      '</div>' +
      (e.notes ? '<div class="nc-entry-notes">' + _esc(e.notes) + '</div>' : '') +
      ((photos || maps) ? '<div class="nc-thumbs">' + photos + maps + '</div>' : '') +
      '</div>';
  }

  /* ═══ ENTRY MODAL ═══ */
  var _modalEntryId = null, _modalDistrict = null, _modalDraft = null, _modalMapId = null, _modalReadonly = false;
  window.ncEntryModal = function (districtCode, entryId, pin) {
    _modalDistrict = districtCode;
    _modalEntryId = entryId || null;
    _modalMapId = null; _modalReadonly = false;
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
    var photos = (e.photos || []).map(function (src, i) { return '<div class="nc-mthumb"><img src="' + src + '"><span onclick="ncModalRmImg(\'p\',' + i + ')">✕</span></div>'; }).join('');
    var maps = (e.hackedMaps || []).map(function (m, i) { return '<div class="nc-mthumb"><img src="' + m.dataUrl + '"><span onclick="ncModalRmImg(\'m\',' + i + ')">✕</span></div>'; }).join('');
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
      (NC_MODE === 'gm' ? '<label class="nc-modal-check"><input type="checkbox" id="nc-m-public"' + (e.public ? ' checked' : '') + '> Public — visible to players in session</label>' : '') +
      '<div class="nc-modal-imgs"><div class="nc-modal-imgs-row">' +
        '<label class="nc-btn nc-file nc-btn-sm">＋ Photo<input type="file" accept="image/*" onchange="ncModalAddImg(\'p\',event)"></label>' +
        '<label class="nc-btn nc-file nc-btn-sm">＋ Hacked map<input type="file" accept="image/*" onchange="ncModalAddImg(\'m\',event)"></label>' +
      '</div><div class="nc-mthumbs">' + photos + maps + '</div></div>';
    var actions =
      '<div class="nc-modal-actions">' +
        ((_modalEntryId && !ro) ? '<button class="nc-btn nc-btn-danger" onclick="ncDeleteEntry()">Delete</button>' : '') +
        '<span style="flex:1"></span>' +
        '<button class="nc-btn" onclick="ncModalClose()">' + (ro ? 'Close' : 'Cancel') + '</button>' +
        (ro ? '' : '<button class="nc-btn nc-btn-cy" onclick="ncSaveEntry()">Save</button>') +
      '</div>';
    var body = (ro ? '<fieldset disabled style="border:none;margin:0;padding:0">' + fields + '</fieldset>' : fields) + actions;
    _ncModalOpen((_modalEntryId ? (ro ? 'Location' : 'Edit location') : 'New location'), body);
  }
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
  function _ncModalOpen(title, bodyHtml) {
    ncModalClose();
    var ov = document.createElement('div');
    ov.id = 'nc-modal-ov';
    ov.className = 'nc-modal-ov';
    ov.onclick = function (e) { if (e.target === ov) ncModalClose(); };
    ov.innerHTML = '<div class="nc-modal-card"><div class="nc-modal-head">' + _esc(title) + '</div><div class="nc-modal-body"></div></div>';
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
  window.ncPinInfo = function (id, layerIdx) {
    var L = PLAYER.gmLayers[layerIdx]; var e = L ? findEntry(L.entries, id) : null; if (!e) return;
    var body =
      '<div class="nc-modal-row"><b>' + _esc(e.district || '??') + '</b> · #' + _esc(e.building || '?') + (e.floor ? '·F' + _esc(e.floor) : '') +
        ' <span class="nc-type-pill" style="background:' + typeColor(e.type) + '">' + _esc(typeLabel(e.type)) + '</span></div>' +
      (e.notes ? '<div class="nc-entry-notes">' + _esc(e.notes) + '</div>' : '') +
      '<div class="nc-modal-actions"><span style="flex:1"></span>' +
        '<button class="nc-btn" onclick="ncModalClose()">Close</button>' +
        '<button class="nc-btn nc-btn-cy" onclick="ncCopyToLog(' + layerIdx + ',\'' + e.id + '\');ncModalClose();">copy to my log</button></div>';
    _ncModalOpen(e.name || '(unnamed)', body);
  };

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
    var order = (_mapOrder() || []).slice(); if (order.indexOf('nc') < 0) order.unshift('nc');
    src.forEach(function (m) { if (order.indexOf(m.id) < 0) order.push(m.id); });
    var out = [];
    order.forEach(function (id) { if (id === 'nc') out.push({ id: 'nc', name: 'Night City', kind: 'nc' }); else if (byId[id]) out.push({ id: id, name: byId[id].name, kind: byId[id].kind }); });
    return out;
  }
  function ncRenderMapsBar() {
    var bar = document.getElementById('nc-maps-bar'); if (!bar) return;
    var gm = NC_MODE === 'gm', player = NC_MODE === 'player';
    if (!gm && !player) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
    var maps = _perspectiveMaps();
    if (!gm && maps.length <= 1) { bar.style.display = 'none'; bar.innerHTML = ''; return; }   // player: only show if there are custom maps
    var tabs = maps.map(function (m) {
      var on = m.id === _surface;
      var ico = m.kind === 'list' ? '☰' : (m.id === 'nc' ? '◰' : '▦');
      var mv = (gm && m.id !== 'nc') ? '<span class="nc-mtab-mv" onclick="event.stopPropagation();ncMoveMap(\'' + m.id + '\',-1)">◂</span><span class="nc-mtab-mv" onclick="event.stopPropagation();ncMoveMap(\'' + m.id + '\',1)">▸</span>' : '';
      return '<div class="nc-mtab' + (on ? ' active' : '') + '" onclick="ncSelectMap(\'' + m.id + '\')">' + ico + ' ' + _esc(m.name) + mv + '</div>';
    }).join('');
    var add = gm ? '<button class="nc-mtab-add" onclick="ncAddMap(\'map\')">＋ Map</button><button class="nc-mtab-add" onclick="ncAddMap(\'list\')">＋ List</button>' : '';
    bar.style.display = 'flex'; bar.innerHTML = tabs + add;
  }
  window.ncSelectMap = function (id) {
    _surface = id;
    var ov = document.getElementById('overview'), dv = document.getElementById('district-view'), vc = document.getElementById('view-custom');
    // The Night City district sidebar belongs to NC only — hide it on custom maps.
    var sb = document.getElementById('sidebar'); if (sb) sb.style.display = (id === 'nc') ? '' : 'none';
    if (id === 'nc') {
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
    _modalMapId = mapId; _modalDistrict = ''; _modalEntryId = placeId || null;
    _modalReadonly = !!ex && !own;
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
    ncRenderMapsBar();
    if (typeof window.ncSetView === 'function') window.ncSetView('atlas');   // City view by default
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
    if (NC_MODE !== 'player') window.ncSetMode('player');
    else { ncRenderSidePanel(); ncRenderMapsBar(); ncAfterChange(); if (_surface !== 'nc') ncRenderCustomMap(_surface); }
  });
})();
