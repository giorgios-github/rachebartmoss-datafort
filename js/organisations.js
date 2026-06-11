/* ═══════════════════════════════════════════════
   ORGANISATIONS.JS  —  Rache Bartmoss' Datafort
   ═══════════════════════════════════════════════ */

/* ─── State ─── */
var _orgs        = [];
var _activeId    = null;
var _activeTab   = 'general';
var _privateMode = false;
var _catCollapsed = {};
var _viewMode    = false;

/* Bundled (read-only, always loaded from file, never persisted to localStorage) */
var _BUNDLED_IDS = [];

/* Hierarchy state */
var _hierSelected    = null;   // selected node id
var _hierDragState   = null;   // { type:'node'|'pan', ... }
var _hierConnectFrom = null;   // node id being connected from
var _hierPan         = { x: 40, y: 40 };
var _hierZoom        = 1;
var _stockRange      = '1M';
var _hierAllNodes    = [];     // current org's nodes, kept in sync for _groupRect lookups
var _hierAllGroups   = [];     // current org's groups, kept in sync for nested-group lookups

/* Grid layout constants */
var _GRID_CELL_W    = 174;  // cell width (NODE_W=148 + margins)
var _GRID_CELL_H    = 132;  // cell height (large enough to fit the biggest card with margin)
var _GRID_NODE_Y_OFF = 24;  // baseline vertical offset of node inside cell

/* Multi-selection state */
var _hierSelection      = [];    // ids of selected nodes (multi-select)
var _hierRubberBand     = null;  // { x0,y0,x1,y1 } rubber-band in progress (node-space)
var _hierDragTargetCell = null;  // { col, row } target cell during drag
var _hierSelectedGroup  = null;  // id of currently selected group (for highlight + edit panel)

/* ─── Utilities ─── */
function _uid() { return 'id-' + Math.random().toString(36).substr(2,9); }
function _getActive() { return _orgs.filter(function(o){ return o.id === _activeId; })[0] || null; }
function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* Seeded RNG (Lehmer LCG) */
function _seededRng(seed) {
  var s = 0;
  for (var i = 0; i < (seed||'x').length; i++) s = ((s * 31) + (seed||'x').charCodeAt(i)) | 0;
  s = (s >>> 0) || 1;
  return function() {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 4294967296;
  };
}

/* ─── Blank org factory ─── */
function makeBlankOrg(name, type) {
  var t = type || 'corporation';
  return {
    id: _uid(),
    name: name || 'New Organization',
    type: t,
    logo: '',
    tagline: '',
    founded: '',
    headquarters: '',
    activeTabs: { general:true, hierarchy:true, offices:true, products:true, market: t!=='groupe', jobs:true, funds: t==='groupe' },
    hierarchyMode: 'tree',
    general: { publicSummary:'', privateSummary:'', keyMissions:[] },
    hierarchy: { nodes:[], edges:[] },
    offices: {
      locations: [],
      typicalOffices: [],
      regions: [],
      mapType: t === 'groupe' ? 'nightcity' : 'world'
    },
    products: { items:[] },
    market: {
      stockSymbol: '',
      basePrice: 50 + Math.floor(Math.random()*200),
      publicData:  { revenue:'', employees:'', founded:'', notes:'' },
      privateData: { realRevenue:'', margins:'', capitalAllocation:'', covertBudget:'', notes:'' }
    },
    jobs: { openings:[] },
    // Groupe-specific
    reputation: {
      publicSummary:'', privateSummary:'', homeDistrict:'', streetCred:'', history:'', rivals:'', allies:'',
      color: '#c44', colors: { primary:'#c44', secondary:'' }, tag: { image:null, description:'' },
      cyberpsychos: { registered:0, onEdge:0 }, demographics:''
    },
    runs: { mo:[], items:[] },
    influence: { publicNotes:'', privateNotes:'', districts:{} },
    philosophy: { code:'', specialization:'', membershipRequirements:'' },
    relations: { hq: { name:'', location:'', type:'', description:'' }, selectedBusinesses:[] },
    funds: { sources:[], publicNotes:'', privateNotes:'' },
    // Agency-specific
    budget: { publicNotes:'', privateNotes:'', annualBudget:'', fundingSource:'', departments:[] }
  };
}

/* ─── localStorage persistence ─── */
var _LS_KEY = 'bartmoss_orgs';
var _saveTimer = null;

function _schedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 600);
}
function _flushSave() {
  if (window.__cdoc) return; // file-bridge mode: campaign-doc.js owns persistence
  // Never persist bundled orgs — they're always loaded fresh from their source files
  try { localStorage.setItem(_LS_KEY, JSON.stringify(_orgs.filter(function(o){ return !o._bundled; }))); } catch(e) {}
}
function _loadFromStorage() {
  try {
    var raw = localStorage.getItem(_LS_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    // Safety: strip any bundled orgs that may have slipped into localStorage
    data = data.filter(function(o){ return !o._bundled; });
    data.forEach(function(org) { _migrateOrg(org); });
    _orgs = data;
  } catch(e) {}
}

/* ─── Save / Load ─── */
function newOrg() {
  var modal = document.createElement('div');
  modal.className = 'org-modal-overlay';
  modal.innerHTML =
    '<div class="org-modal" style="max-width:420px">' +
      '<div class="org-modal-head">New Organisation <span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span></div>' +
      '<div class="org-modal-body">' +
        '<div class="org-field"><label>Name</label><input id="new-org-name" class="org-input" placeholder="Organisation name..." autofocus></div>' +
        '<div class="org-field" style="margin-top:12px"><label>Type</label>' +
          '<div style="display:flex;gap:8px;margin-top:6px">' +
            ['corporation','groupe','agency'].map(function(t) {
              var desc = { corporation:'Corporate entity, market presence, formal hierarchy.', groupe:'Gang, crew, or collective. Street reputation, runs, turf.', agency:'Official body — police, government, military, services.' }[t];
              var col = { corporation:'#111', groupe:'#c44', agency:'#3a7bd5' }[t];
              return '<div class="new-org-type-btn" onclick="document.querySelectorAll(\'.new-org-type-btn\').forEach(function(b){b.classList.remove(\'selected\')});this.classList.add(\'selected\');document.getElementById(\'new-org-type\').value=\''+t+'\'" style="flex:1;cursor:pointer;border:2px solid #ddd;padding:10px 8px;text-align:center;border-radius:2px">' +
                '<div style="font-family:var(--head);font-size:13px;letter-spacing:1px;font-weight:bold;color:'+col+';margin-bottom:4px">'+t.toUpperCase()+'</div>' +
                '<div style="font-size:11px;color:#888;line-height:1.4">'+desc+'</div>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<input type="hidden" id="new-org-type" value="corporation">' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;justify-content:flex-end;gap:6px">' +
          '<button class="btn" onclick="this.closest(\'.org-modal-overlay\').remove()">Cancel</button>' +
          '<button class="btn btn-cy" onclick="_confirmNewOrg()">Create</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target===modal) modal.remove(); });
  // Pre-select corporation
  setTimeout(function(){ var first = modal.querySelector('.new-org-type-btn'); if (first) first.classList.add('selected'); }, 0);
}
function _confirmNewOrg() {
  var nameEl = document.getElementById('new-org-name');
  var typeEl = document.getElementById('new-org-type');
  var name = (nameEl ? nameEl.value : '').trim();
  var type = typeEl ? typeEl.value : 'corporation';
  if (!name) { if (nameEl) nameEl.focus(); return; }
  var overlay = nameEl ? nameEl.closest('.org-modal-overlay') : null;
  if (overlay) overlay.remove();
  var org = makeBlankOrg(name, type);
  _orgs.push(org);
  _flushSave();
  selectOrg(org.id);
}

function exportOrg(id) {
  var org = id ? _orgs.filter(function(o){ return o.id===id; })[0] : _getActive();
  if (!org) return;
  var blob = new Blob([JSON.stringify(org, null, 2)], { type:'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (org.name||'org').replace(/\s+/g,'_').toLowerCase() + '.org.json';
  a.click();
}

function importOrgFile(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var org = JSON.parse(ev.target.result);
      _migrateOrg(org);
      var idx = _orgs.map(function(o){return o.id;}).indexOf(org.id);
      if (idx >= 0) _orgs[idx] = org; else _orgs.push(org);
      _flushSave();
      selectOrg(org.id);
    } catch(err) { alert('Invalid JSON: ' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
}

function _migrateOrg(org) {
  if (!org.id) org.id = _uid();
  // Migrate old types to new
  if (org.type === 'gang' || org.type === 'syndicate' || org.type === 'other') org.type = 'groupe';
  if (!org.type || ['corporation','groupe','agency'].indexOf(org.type) < 0) org.type = 'corporation';
  if (!org.activeTabs) org.activeTabs = { general:true, hierarchy:true, offices:true, products:true, market:true, jobs:true };
  if (org.type === 'groupe' && org.activeTabs.funds === undefined) org.activeTabs.funds = true;
  if (org.type === 'groupe') org.activeTabs.market = false;
  if (org.hierarchyMode === undefined) org.hierarchyMode = 'tree';
  if (!org.general)   org.general   = { publicSummary:'', privateSummary:'', keyMissions:[] };
  if (!org.hierarchy) org.hierarchy = { nodes:[], edges:[] };
  if (!org.offices)   org.offices   = { locations:[], typicalOffices:[], regions:[] };
  if (!org.offices.regions) org.offices.regions = [];
  if (!org.offices.mapType) org.offices.mapType = org.type === 'groupe' ? 'nightcity' : 'world';
  // Groupe fields
  if (!org.reputation) org.reputation = { publicSummary:'', privateSummary:'', homeDistrict:'', streetCred:'', history:'', rivals:'', allies:'', color:'#c44', colors:{primary:'#c44',secondary:''}, tag:{image:null,description:''}, cyberpsychos:{registered:0,onEdge:0}, demographics:'' };
  if (org.reputation && org.reputation.color === undefined) org.reputation.color = '#c44';
  if (org.reputation && org.reputation.colors === undefined) org.reputation.colors = { primary:'#c44', secondary:'' };
  if (org.reputation && org.reputation.tag === undefined) org.reputation.tag = { image:null, description:'' };
  if (org.reputation && org.reputation.cyberpsychos === undefined) org.reputation.cyberpsychos = { registered:0, onEdge:0 };
  if (org.reputation && org.reputation.demographics === undefined) org.reputation.demographics = '';
  if (!org.runs)       org.runs       = { mo:[], items:[] };
  if (!org.runs.mo)    org.runs.mo    = [];
  if (!org.funds)      org.funds      = { sources:[], publicNotes:'', privateNotes:'' };
  if (!org.influence)  org.influence  = { publicNotes:'', privateNotes:'', districts:{} };
  if (!org.philosophy) org.philosophy = { code:'', specialization:'', membershipRequirements:'' };
  if (!org.relations)  org.relations  = { hq:{ name:'', location:'', type:'', description:'' }, selectedBusinesses:[] };
  // Agency fields
  if (!org.budget) org.budget = { publicNotes:'', privateNotes:'', annualBudget:'', fundingSource:'', departments:[] };
  if (!org.offices.typicalOffices) {
    org.offices.typicalOffices = [];
    var _old = org.offices.typicalOffice;
    if (_old && (_old.description || _old.staffStructure || _old.security)) {
      org.offices.typicalOffices.push({ id:_uid(), name:'Standard Office',
        description:_old.description||'', staffStructure:_old.staffStructure||'',
        security:_old.security||'', image:'', floorPlan:'', departmentId:null, mapPoints:[] });
    }
    delete org.offices.typicalOffice;
  }
  // Migrate per-entry mapX/mapY → mapPoints
  (org.offices.typicalOffices||[]).forEach(function(t) {
    if (!t.mapPoints) {
      t.mapPoints = (t.mapX != null) ? [{ id:_uid(), x:t.mapX, y:t.mapY }] : [];
      delete t.mapX; delete t.mapY;
    }
  });
  if (!org.products)  org.products  = { items:[] };
  (org.products.items||[]).forEach(function(p){
    if (p.subcat    === undefined) p.subcat    = '';
    if (p.image     === undefined) p.image     = '';
    if (p.coverage  === undefined) p.coverage  = '';
  });
  if (!org.market)    org.market    = { stockSymbol:'', basePrice:100, publicData:{}, privateData:{} };
  if (!org.jobs)      org.jobs      = { openings:[] };
  (org.jobs.openings||[]).forEach(function(j){
    if (j.grade     === undefined) j.grade     = '';
    if (j.equipment === undefined) j.equipment = '';
  });
  (org.hierarchy.nodes||[]).forEach(function(n){
    if (!n.id) n.id = _uid();
    if (n.x == null) n.x = 100;
    if (n.y == null) n.y = 100;
    if (n.type === 'role' && n.npcSheet === undefined) n.npcSheet = null;
    if (n.characterSheet === undefined) n.characterSheet = null;
  });

  // ─── Hierarchy groups migration ───
  // Convert legacy type='team'/'department' nodes into entries of org.hierarchy.groups[].
  // Leaf nodes' teamId or edge-parent (for dept) becomes groupId. Old group nodes are removed.
  if (!org.hierarchy.groups) org.hierarchy.groups = [];
  var _hNodes = org.hierarchy.nodes || [];
  var _hEdges = org.hierarchy.edges || [];
  var _toRemove = {};
  var _byId = {};
  _hNodes.forEach(function(n) { _byId[n.id] = n; });

  _hNodes.forEach(function(n) {
    if (n.type !== 'team' && n.type !== 'department') return;
    // Skip if already migrated (defensive)
    var existsAlready = org.hierarchy.groups.filter(function(g){ return g.id === n.id; }).length > 0;
    if (existsAlready) { _toRemove[n.id] = true; return; }

    var group = {
      id: n.id,
      type: n.type,             // 'team' | 'department'
      name: n.label || ('New ' + n.type),
      color: n.color || null,
      headcount: n.headcount || null,
      clearance: n.clearance || null,
      privateOnly: !!n.privateOnly,
      notes: n.notes || ''
    };
    org.hierarchy.groups.push(group);

    if (n.type === 'team') {
      // teamId → groupId
      _hNodes.forEach(function(m) {
        if (m.teamId === n.id) m.groupId = n.id;
      });
    } else {
      // department: edge children become members
      _hEdges.forEach(function(e) {
        if (e.from === n.id) {
          var child = _byId[e.to];
          if (child) child.groupId = n.id;
        }
      });
      // Remove edges originating from or terminating at the dept node
      org.hierarchy.edges = org.hierarchy.edges.filter(function(e) {
        return e.from !== n.id && e.to !== n.id;
      });
    }
    _toRemove[n.id] = true;
  });

  if (Object.keys(_toRemove).length) {
    org.hierarchy.nodes = _hNodes.filter(function(n) { return !_toRemove[n.id]; });
  }

  // Migrate type='special' → 'unit'
  org.hierarchy.nodes.forEach(function(n) {
    if (n.type === 'special') n.type = 'unit';
    // Clean up legacy teamId field (now replaced by groupId)
    if (n.teamId !== undefined) {
      if (n.groupId === undefined && n.teamId) n.groupId = n.teamId;
      delete n.teamId;
    }
    if (n.groupId === undefined) n.groupId = null;
  });
}

function deleteOrg(id) {
  if (!confirm('Delete this organization?')) return;
  _orgs = _orgs.filter(function(o){ return o.id !== id; });
  if (_activeId === id) _activeId = _orgs.length ? _orgs[0].id : null;
  _flushSave();
  renderSidebar(); renderMain();
}

function duplicateOrg(id) {
  var src = _orgs.filter(function(o){ return o.id===id; })[0]; if (!src) return;
  var copy = JSON.parse(JSON.stringify(src));
  copy.id   = _uid();
  copy.name = src.name + ' (copy)';
  _orgs.push(copy);
  _flushSave();
  selectOrg(copy.id);
}

/* ─── Sidebar ─── */
var _ORG_TYPES  = ['corporation','groupe','agency'];
var _TYPE_LABEL = { corporation:'Corporations', groupe:'Groups', agency:'Agencies' };

/* ─── Tab labels per org type ─── */
var TAB_LABELS = {
  corporation: { general:'General', hierarchy:'Hierarchy', offices:'Offices & Facilities', products:'Products', market:'Market', jobs:'Jobs' },
  groupe:      { general:'Reputation', hierarchy:'Hierarchy', offices:'Territory & Relations', products:'M.O. & Famous Runs', market:'Identity & Influence', jobs:'Recruitment', funds:'Funds' },
  agency:      { general:'General', hierarchy:'Hierarchy', offices:'Jurisdiction', products:'Services', market:'Budget', jobs:'Positions' }
};

function renderSidebar() {
  var el = document.getElementById('org-sidebar-list'); if (!el) return;
  var q  = ((document.getElementById('org-search')||{}).value||'').trim().toLowerCase();
  var html = '';
  _ORG_TYPES.forEach(function(type) {
    var list = _orgs.filter(function(o){ return o.type===type && (!q || o.name.toLowerCase().indexOf(q)>=0); });
    var open = !_catCollapsed[type];
    html += '<div class="org-cat-head" onclick="toggleCat(\''+type+'\')">' +
      '<span class="org-cat-toggle">'+(open?'▼':'▶')+'</span>'+
      _TYPE_LABEL[type]+
      '<span class="org-cat-count">'+list.length+'</span>'+
    '</div>';
    if (open && list.length) {
      html += '<div class="org-cat-body">' + list.map(function(o) {
        var active = o.id === _activeId;
        return '<div class="org-list-item'+(active?' active':'')+'" onclick="selectOrg(\''+o.id+'\')">' +
          '<span class="org-list-name">'+_esc(o.name)+'</span>' +
          '<div class="org-list-actions">' +
            '<span onclick="event.stopPropagation();duplicateOrg(\''+o.id+'\')" title="Duplicate">⧉</span>' +
            '<span onclick="event.stopPropagation();exportOrg(\''+o.id+'\')" title="Export">↓</span>' +
            '<span onclick="event.stopPropagation();deleteOrg(\''+o.id+'\')" title="Delete">✕</span>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
  });
  if (!html) html = '<div class="org-sidebar-empty">No organisations yet.</div>';
  el.innerHTML = html;
}

function toggleCat(type) { _catCollapsed[type] = !_catCollapsed[type]; renderSidebar(); }

function selectOrg(id) {
  _activeId        = id;
  _activeTab       = 'general';
  _hierSelected    = null;
  _hierConnectFrom = null;
  _privateMode     = false;
  // Bundled orgs open in view mode; user-created orgs open in edit mode
  _viewMode        = _BUNDLED_IDS.indexOf(id) >= 0;
  _hierPan         = { x:40, y:40 };
  _hierZoom        = 1;
  renderSidebar();
  renderMain();
}

/* ─── Main ─── */
function renderMain() {
  var el  = document.getElementById('org-main'); if (!el) return;
  var org = _getActive();
  if (!org) {
    el.innerHTML = '<div class="org-welcome"><div class="org-welcome-icon">⬡</div><div class="org-welcome-title">ORGANISATIONS</div><div class="org-welcome-sub">Create a new org or import a JSON file.</div></div>';
    return;
  }
  el.innerHTML = _renderHeader(org) + _renderTabBar(org) + '<div id="org-tab-content"></div>';
  renderTabContent();
}

function _typeColor(type) {
  return { corporation:'#111', groupe:'#c44', agency:'#3a7bd5' }[type] || '#111';
}

function _renderHeader(org) {
  var col = _typeColor(org.type);
  return '<div class="org-header">' +
    '<div class="org-header-left">' +
      (org.logo
        ? '<img class="org-logo" src="'+_esc(org.logo)+'" onclick="document.getElementById(\'org-logo-input\').click()" title="Click to change logo">'
        : '<div class="org-logo-placeholder" style="border-color:'+col+'" onclick="document.getElementById(\'org-logo-input\').click()" title="Click to upload logo">LOGO</div>') +
      '<div class="org-header-info">' +
        '<div class="org-header-name" contenteditable="true" spellcheck="false" onblur="orgSet(\'name\',this.textContent.trim())">'+_esc(org.name)+'</div>' +
        '<div class="org-header-sub">' +
          '<span class="org-type-badge" style="background:'+col+'">'+org.type.toUpperCase()+'</span>' +
          (org.headquarters ? '<span class="org-hq">'+_esc(org.headquarters)+'</span>' : '') +
          (org.founded ? '<span class="org-founded">Est. '+_esc(org.founded)+'</span>' : '') +
        '</div>' +
        (org.tagline ? '<div class="org-tagline">'+_esc(org.tagline)+'</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="org-header-right">' +
      '<div class="org-privacy-toggle'+(_viewMode?' priv-on':'')+'" onclick="toggleViewMode()" style="'+(  _viewMode?'background:#3a7bd5;border-color:#3a7bd5':'')+'">'+
        (_viewMode ? '👁 VIEW' : '✎ EDIT') +
      '</div>' +
      '<div class="org-privacy-toggle'+(_privateMode?' priv-on':'')+'" onclick="togglePrivate()">'+
        (_privateMode ? '🔒 PRIVATE' : '🌐 PUBLIC') +
      '</div>' +
      (!_viewMode ? '<button class="btn btn-sm" onclick="openOrgSettings()">⚙ Settings</button>' : '') +
      '<button class="btn btn-sm btn-cy" onclick="exportOrg()">Export JSON</button>' +
    '</div>' +
  '</div>';
}

function _renderTabBar(org) {
  var labels = TAB_LABELS[org.type] || TAB_LABELS.corporation;
  var productsLabel = labels.products;
  if (org.type === 'groupe' && !_privateMode) productsLabel = 'M.O. & Famous Runs';
  if (org.type === 'groupe' && _privateMode)  productsLabel = 'Contracts & Runs';
  var tabs = [
    { id:'general',    label: labels.general },
    { id:'hierarchy',  label: labels.hierarchy },
    { id:'offices',    label: labels.offices },
    { id:'products',   label: productsLabel },
    { id:'market',     label: org.type === 'corporation' ? (_privateMode ? 'Market Strategy' : 'Market Report') : labels.market },
    { id:'jobs',       label: labels.jobs }
  ];
  // Groupe-only extra tabs
  if (org.type === 'groupe') {
    tabs.push({ id:'funds', label: labels.funds || 'Funds' });
  }
  return '<div class="org-tab-bar">' +
    tabs.filter(function(t){ return org.activeTabs[t.id] !== false; }).map(function(t) {
      return '<div class="org-tab'+(t.id===_activeTab?' org-tab-active':'')+'" onclick="setOrgTab(\''+t.id+'\')">'+t.label+'</div>';
    }).join('') +
    '<div class="org-tab-settings" onclick="openOrgSettings()" title="Settings">⚙</div>' +
  '</div>';
}

function setOrgTab(tab) {
  _activeTab = tab;
  _hierSelected = null;
  _hierConnectFrom = null;
  var org = _getActive(); if (!org) return;
  // Re-render header + tabs (market label changes with private mode)
  var el = document.getElementById('org-main');
  if (el) el.innerHTML = _renderHeader(org) + _renderTabBar(org) + '<div id="org-tab-content"></div>';
  renderTabContent();
}

function togglePrivate() {
  _privateMode = !_privateMode;
  renderMain();
}

function toggleViewMode() {
  _viewMode = !_viewMode;
  _hierSelected = null;
  _hierConnectFrom = null;
  renderMain();
}

function orgSet(field, val) {
  var org = _getActive(); if (!org) return;
  org[field] = val;
  if (field === 'name') renderSidebar();
  _schedSave();
}

function renderTabContent() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive();
  var type = org ? org.type : 'corporation';
  // Per-tab dispatch by org type
  var dispatch = {
    general:    { corporation:renderGeneral,    groupe:renderReputation,   agency:renderGeneral    },
    hierarchy:  { corporation:renderHierarchy,  groupe:renderHierarchy,    agency:renderHierarchy  },
    offices:    { corporation:renderOffices,           groupe:renderTerritoryRelations, agency:renderJuridiction },
    products:   { corporation:renderProducts,          groupe:renderRuns,               agency:renderServices   },
    market:     { corporation:renderMarket,            groupe:renderIdentityInfluence,  agency:renderBudget     },
    jobs:       { corporation:renderJobs,              groupe:renderRecruitment,        agency:renderPostes     },
    funds:      { groupe:renderFunds }
  };
  var tabFns = dispatch[_activeTab];
  if (tabFns && tabFns[type]) { tabFns[type](); return; }
  if (tabFns && tabFns.corporation) { tabFns.corporation(); return; }
  el.innerHTML = '<div class="org-tab-body"><div class="org-empty-hint">Coming soon.</div></div>';
}

/* ─── Settings modal ─── */
function openOrgSettings() {
  var org = _getActive(); if (!org) return;
  var tl = TAB_LABELS[org.type] || TAB_LABELS.corporation;
  var tabLabels = { general:tl.general, hierarchy:tl.hierarchy, offices:tl.offices, products:tl.products, market:tl.market, jobs:tl.jobs };
  if (org.type === 'groupe') { tabLabels.funds = tl.funds || 'Funds'; }
  var modal = document.createElement('div');
  modal.className = 'org-modal-overlay';
  modal.innerHTML =
    '<div class="org-modal">' +
      '<div class="org-modal-head">Organisation Settings <span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span></div>' +
      '<div class="org-modal-body">' +
        _settingsField('Name',        'text',   org.name,         'orgSet("name",this.value);document.querySelector(".org-header-name").textContent=this.value;renderSidebar()') +
        _settingsField('Type',        'select', org.type,         'orgSet("type",this.value);renderMain()', ['corporation','groupe','agency']) +
        _settingsField('Tagline',     'text',   org.tagline||'',  'orgSet("tagline",this.value)') +
        _settingsField('Headquarters','text',   org.headquarters||'','orgSet("headquarters",this.value)') +
        _settingsField('Founded',     'text',   org.founded||'',  'orgSet("founded",this.value)') +
        '<div class="org-field"><label>Logo</label>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<button class="btn btn-sm" onclick="document.getElementById(\'org-logo-input\').click()">Upload File…</button>' +
            (org.logo ? '<button class="btn btn-sm btn-red" onclick="orgSet(\'logo\',\'\');renderMain();this.closest(\'.org-modal-overlay\').remove();openOrgSettings()">Remove</button>' : '') +
          '</div>' +
          '<input class="org-input" style="margin-top:4px" placeholder="…or paste URL" value="'+_esc(org.logo||'')+'" onchange="orgSet(\'logo\',this.value);renderMain()">' +
        '</div>' +
        _settingsField('Stock Symbol','text',   org.market.stockSymbol||'', 'orgSet_nested("market","stockSymbol",this.value)') +
        '<div class="org-settings-section">Active Tabs</div>' +
        Object.keys(tabLabels).map(function(k) {
          return '<label class="org-settings-row"><input type="checkbox"'+(org.activeTabs[k]?' checked':'')+
            ' onchange="orgToggleTab(\''+k+'\',this.checked)"> '+tabLabels[k]+'</label>';
        }).join('') +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function _settingsField(label, type, val, onchange, options) {
  var input;
  if (type === 'select') {
    input = '<select class="org-select" style="width:100%" onchange="'+onchange+'">' +
      (options||[]).map(function(o){ return '<option value="'+o+'"'+(val===o?' selected':'')+'>'+o.charAt(0).toUpperCase()+o.slice(1)+'</option>'; }).join('') +
    '</select>';
  } else {
    input = '<input class="org-input" type="text" value="'+_esc(val)+'" onchange="'+onchange+'">';
  }
  return '<div class="org-field"><label>'+label+'</label>'+input+'</div>';
}

function orgToggleTab(tab, val) {
  var org = _getActive(); if (!org) return;
  org.activeTabs[tab] = val;
  if (!val && _activeTab === tab) _activeTab = 'general';
  _flushSave();
  renderMain();
}

function orgLogoUpload(e) {
  var f = e.target.files[0]; if (!f) return;
  var org = _getActive(); if (!org) { e.target.value=''; return; }
  var r = new FileReader();
  r.onload = function(ev) {
    org.logo = ev.target.result;
    _flushSave();
    renderMain();
  };
  r.readAsDataURL(f);
  e.target.value = '';
}

function orgSet_nested(section, field, val) {
  var org = _getActive(); if (!org) return;
  if (!org[section]) org[section] = {};
  org[section][field] = val;
  _schedSave();
}

/* ═══════════════════════════════════════════════
   GENERAL TAB
   ═══════════════════════════════════════════════ */
function renderGeneral() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;

  var topFigures = (org.hierarchy.nodes||[]).filter(function(n){
    return n.type === 'person' && (_privateMode || !n.privateOnly);
  }).slice(0,6);

  var figuresHtml = topFigures.length ? topFigures.map(function(n) {
    var cs = n.characterSheet;
    return '<div class="gen-person-card">' +
      (cs && cs.photo ? '<img class="gen-person-photo" src="'+_esc(cs.photo)+'">'
        : '<div class="gen-person-avatar">'+(n.label||'?')[0].toUpperCase()+'</div>') +
      '<div><div class="gen-person-name">'+_esc(n.label||'')+'</div><div class="gen-person-title">'+_esc(n.title||'')+'</div></div>' +
    '</div>';
  }).join('') : '<div class="org-empty-hint">Add people in the Hierarchy tab.</div>';

  var keyLocs = (org.offices.locations||[]).filter(function(l){ return l.isHQ || l.isKey; }).slice(0,4);

  el.innerHTML = '<div class="org-tab-body">' +
    // Overview
    '<div class="org-section">' +
      '<div class="org-section-head">Overview</div>' +
      '<div class="org-section-body">' +
        (_viewMode
          ? '<div class="org-view-text">'+_esc(org.general.publicSummary||'')+'</div>'
          : '<textarea class="org-textarea" placeholder="Public summary — visible to all..." oninput="orgSet_nested(\'general\',\'publicSummary\',this.value)">'+_esc(org.general.publicSummary||'')+'</textarea>') +
        (_privateMode ? (_viewMode
          ? '<div class="org-view-text org-view-text-private">'+_esc(org.general.privateSummary||'')+'</div>'
          : '<textarea class="org-textarea org-textarea-private" placeholder="GM notes — private only..." oninput="orgSet_nested(\'general\',\'privateSummary\',this.value)">'+_esc(org.general.privateSummary||'')+'</textarea>') : '') +
      '</div>' +
    '</div>' +
    // Top figures
    '<div class="org-section">' +
      '<div class="org-section-head">Key Figures</div>' +
      '<div class="org-section-body"><div class="gen-persons-row">'+figuresHtml+'</div></div>' +
    '</div>' +
    // Key locations
    (keyLocs.length ? '<div class="org-section"><div class="org-section-head">Key Locations</div><div class="org-section-body" style="flex-direction:row;flex-wrap:wrap;gap:6px;">' +
      keyLocs.map(function(l){ return '<div class="gen-loc-chip"><span class="gen-loc-name">'+_esc(l.name)+'</span>'+(l.city?'<span class="gen-loc-city">'+_esc(l.city)+'</span>':'')+'</div>'; }).join('') +
    '</div></div>' : '') +
    // Key missions
    '<div class="org-section">' +
      '<div class="org-section-head">Key Missions '+(!_viewMode?'<span class="org-section-add" onclick="addGenMission()">＋</span>':'')+'</div>' +
      '<div class="org-section-body" id="gen-missions-list">'+(_viewMode?_renderGenMissionsView(org):_renderGenMissions(org))+'</div>' +
    '</div>' +
  '</div>';
}

function _renderGenMissions(org) {
  var ms = org.general.keyMissions || [];
  if (!ms.length) return '<div class="org-empty-hint">No missions listed.</div>';
  return ms.map(function(m,i) {
    return '<div class="gen-mission-item">' +
      '<input class="org-input" style="max-width:180px" value="'+_esc(m.title||'')+'" placeholder="Title" onchange="_getActive().general.keyMissions['+i+'].title=this.value">' +
      '<input class="org-input" value="'+_esc(m.description||'')+'" placeholder="Description" onchange="_getActive().general.keyMissions['+i+'].description=this.value">' +
      '<span class="org-rm" onclick="removeGenMission('+i+')">✕</span>' +
    '</div>';
  }).join('');
}
function addGenMission() {
  var org = _getActive(); if (!org) return;
  org.general.keyMissions = org.general.keyMissions || [];
  org.general.keyMissions.push({ title:'', description:'' });
  var el = document.getElementById('gen-missions-list');
  if (el) el.innerHTML = _renderGenMissions(org);
}
function removeGenMission(i) {
  var org = _getActive(); if (!org) return;
  org.general.keyMissions.splice(i,1);
  var el = document.getElementById('gen-missions-list');
  if (el) el.innerHTML = _renderGenMissions(org);
}
function _renderGenMissionsView(org) {
  var ms = org.general.keyMissions || [];
  if (!ms.length) return '<div class="org-empty-hint">No missions listed.</div>';
  return ms.map(function(m) {
    return '<div class="gen-mission-item">' +
      '<span style="font-family:var(--head);font-size:12px;font-weight:bold;min-width:140px">'+_esc(m.title||'')+'</span>' +
      '<span style="font-family:var(--mono);font-size:12px;color:#555">'+_esc(m.description||'')+'</span>' +
    '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════
   HIERARCHY TAB — SVG canvas
   ═══════════════════════════════════════════════ */
var _NODE_W    = 148;
var _TITLE_H   = 30;
var _PERSON_H  = 44;
var _BADGE_R   = 9;   // badge half-size (badge = 18×18, centered on corner)
var _DEPT_HPAD = 16;  // horizontal padding for spanning dept header
var _NODE_H    = _TITLE_H; // kept for rubber-band compat

var _TEAM_LABEL_H = 20;  // height of external label box above outline
var _TEAM_PAD_TOP = 10;  // padding inside outline above first child
var _TEAM_PAD_BOT = 12;  // padding inside outline below last child
var _TEAM_PAD_H   = 12;  // horizontal padding inside outline

function _nodeHasPerson(n) { return !!(n.npcSheet || n.type === 'person'); }
/* Legacy helpers — kept as no-ops; teams/departments are no longer node types */
function _isTeamNode(n) { return false; }

/* Fixed title bar height — same across all cards so they align in rows.
   Labels longer than 2 lines are ellipsized inside the bandeau via CSS. */
var _TITLE_FIXED_H = 40;
function _titleH(n) { return _TITLE_FIXED_H; }

/* Color code by leaf-node type */
var _TYPE_COLORS = {
  person: '#3a7bd5',  // blue
  role:   '#666',     // grey
  unit:   '#c44'      // red
};
function _typeColor(n) {
  return n.color || _TYPE_COLORS[n.type] || '#111';
}

/* All cards are two-tier: title bandeau + person/info bottom card */
function _nodeH(n) {
  return _titleH(n) + _PERSON_H;
}

function _nodeColor(n) { return n.color || '#111'; }
/* No more group node types — groups are stored separately in org.hierarchy.groups */
function _isGroupNode(n) { return false; }

/* Bounding rect of a group outline — recursive: a group's rect spans its
   direct leaf members AND the rects of any child groups (groups nested inside).
   Top-y derived from contents so the outline always wraps them. */
function _groupRect(g) {
  // Direct leaf members
  var leafMembers = _hierAllNodes.filter(function(m){ return m.groupId === g.id; });
  // Child groups
  var groups = (_hierAllGroups || []).filter(function(c){ return c.groupId === g.id; });
  var childRects = groups.map(function(c){ return _groupRect(c); }).filter(Boolean);
  if (!leafMembers.length && !childRects.length) return null;

  var xs = [], xrs = [], ys = [], ybs = [];
  leafMembers.forEach(function(k){
    xs.push(k.x); xrs.push(k.x + _NODE_W);
    ys.push(k.y); ybs.push(k.y + _nodeH(k));
  });
  childRects.forEach(function(r){
    // Include child group label box (sits above the outline)
    xs.push(r.x); xrs.push(r.x + r.w);
    ys.push(r.y - _TEAM_LABEL_H); ybs.push(r.y + r.h);
  });
  var ox   = Math.min.apply(null, xs)  - _TEAM_PAD_H;
  var or_x = Math.max.apply(null, xrs) + _TEAM_PAD_H;
  var ot   = Math.min.apply(null, ys)  - _TEAM_PAD_TOP;
  var ob   = Math.max.apply(null, ybs) + _TEAM_PAD_BOT;
  return { x: ox, y: ot, w: or_x - ox, h: ob - ot };
}

/* Recursive collect of all leaf node ids reachable from a group (including nested). */
function _groupAllLeafIds(g, allGroups, allNodes) {
  var ids = [];
  allNodes.forEach(function(n){ if (n.groupId === g.id) ids.push(n.id); });
  allGroups.forEach(function(c){
    if (c.groupId === g.id) ids = ids.concat(_groupAllLeafIds(c, allGroups, allNodes));
  });
  return ids;
}
/* Legacy stub */
function _teamRect(n) {
  return { x: n.x || 0, y: n.y || 0, w: _NODE_W + _TEAM_PAD_H*2, h: _TEAM_PAD_TOP + _PERSON_H + _TEAM_PAD_BOT };
}

/* Visual height of a node (teams include their outline height) */
function _nodeVisH(n) {
  if (_isTeamNode(n)) {
    var r = _teamRect(n);
    return r.h;
  }
  return _nodeH(n);
}

/* All nodes are leaves now (groups are not nodes). Kept for code-clarity. */
function _isLeafNode(n) { return true; }

/* Center-x of a column in SVG node-space */
function _colToSvgX(col) { return col * _GRID_CELL_W; }
/* Top-y of a row in SVG node-space */
function _rowToSvgY(row) { return (row - 1) * _GRID_CELL_H; }

/* SVG node-space → nearest grid cell. svgX/svgY should be the CENTER of the card. */
function _svgToGridCell(svgX, svgY) {
  return {
    col: Math.round(svgX / _GRID_CELL_W),
    row: Math.max(1, Math.round(svgY / _GRID_CELL_H + 0.5))
  };
}

/* Apply gridCol/gridRow → n.x, n.y for all nodes that have grid coords.
   Cards are centered horizontally and vertically within their cell.
   excludeIds: { id: true } map of nodes to skip (currently dragged). */
function _applyGridPositions(nodes, excludeIds) {
  nodes.forEach(function(n) {
    if (excludeIds && excludeIds[n.id]) return;
    if (n.gridCol === undefined || n.gridRow === undefined) return;
    var cardH = _nodeH(n);
    n.x = Math.round(n.gridCol * _GRID_CELL_W - _NODE_W / 2);
    n.y = Math.round((n.gridRow - 1) * _GRID_CELL_H + (_GRID_CELL_H - cardH) / 2);
  });
}

/* Returns true if cell (col, row) is occupied by a leaf node (excluding excludeIds). */
function _hierCellOccupied(col, row, excludeIds, nodes) {
  return nodes.some(function(n) {
    if (excludeIds && excludeIds[n.id]) return false;
    if (!_isLeafNode(n)) return false;
    return n.gridCol === col && n.gridRow === row;
  });
}

/* Bounding columns/rows of all leaf nodes with grid coords. */
function _getGridBounds(nodes) {
  var leafs = nodes.filter(function(n) { return _isLeafNode(n) && n.gridCol !== undefined; });
  if (!leafs.length) return { minCol: -2, maxCol: 2, minRow: 1, maxRow: 3 };
  var cols = leafs.map(function(n) { return n.gridCol; });
  var rows = leafs.map(function(n) { return n.gridRow; });
  return {
    minCol: Math.min.apply(null, cols) - 1,
    maxCol: Math.max.apply(null, cols) + 1,
    minRow: 1,
    maxRow: Math.max.apply(null, rows) + 1
  };
}

/* Render SVG grid background (lines + labels). Returns HTML string. */
function _renderGridBackground(bounds) {
  var minC = bounds.minCol, maxC = bounds.maxCol;
  var maxR = bounds.maxRow;
  var html = '<g pointer-events="none" style="-webkit-user-select:none;user-select:none">';
  var gridColor  = '#e8e8e8';
  var labelColor = '#c0c0c0';
  var fs = 10;

  var bgX = (minC - 0.5) * _GRID_CELL_W;
  var bgW = (maxC - minC + 1) * _GRID_CELL_W;
  var bgY = -20, bgH = maxR * _GRID_CELL_H + 40;
  html += '<rect x="'+bgX+'" y="'+bgY+'" width="'+bgW+'" height="'+bgH+'" fill="#fafafa" rx="2"/>';

  for (var c = minC; c <= maxC + 1; c++) {
    var lx = (c - 0.5) * _GRID_CELL_W;
    html += '<line x1="'+lx+'" y1="-30" x2="'+lx+'" y2="'+(maxR * _GRID_CELL_H + 10)+'" stroke="'+gridColor+'" stroke-width="1"/>';
  }
  for (var r = 0; r <= maxR; r++) {
    var ly = r * _GRID_CELL_H;
    html += '<line x1="'+((minC-0.5)*_GRID_CELL_W)+'" y1="'+ly+'" x2="'+((maxC+0.5)*_GRID_CELL_W)+'" y2="'+ly+'" stroke="'+gridColor+'" stroke-width="1"/>';
  }

  for (var c = minC; c <= maxC; c++) {
    html += '<text x="'+(c*_GRID_CELL_W)+'" y="-10" text-anchor="middle" font-family="Space Mono,monospace" font-size="'+fs+'" fill="'+labelColor+'">'+c+'</text>';
  }
  for (var r = 1; r <= maxR; r++) {
    var lrY = (r - 0.5) * _GRID_CELL_H + 4;
    var lrX = (minC - 0.5) * _GRID_CELL_W - 6;
    html += '<text x="'+lrX+'" y="'+lrY+'" text-anchor="end" font-family="Space Mono,monospace" font-size="'+fs+'" fill="'+labelColor+'">'+r+'</text>';
  }

  var col0X = -0.5 * _GRID_CELL_W;
  html += '<rect x="'+col0X+'" y="0" width="'+_GRID_CELL_W+'" height="'+(maxR*_GRID_CELL_H)+'" fill="rgba(0,0,0,0.015)" rx="0"/>';
  html += '</g>';
  return html;
}

/* Highlight of the target cell during drag. */
function _renderDragTargetHighlight(col, row) {
  var x = (col - 0.5) * _GRID_CELL_W;
  var y = (row - 1) * _GRID_CELL_H;
  return '<rect x="'+x+'" y="'+y+'" width="'+_GRID_CELL_W+'" height="'+_GRID_CELL_H+'" fill="rgba(58,123,213,0.08)" stroke="#3a7bd5" stroke-width="1.5" stroke-dasharray="4,3" rx="2" pointer-events="none"/>';
}

/* Rubber-band selection rectangle. */
function _renderRubberBand() {
  if (!_hierRubberBand) return '';
  var rb = _hierRubberBand;
  var x = Math.min(rb.x0, rb.x1), y = Math.min(rb.y0, rb.y1);
  var w = Math.abs(rb.x1 - rb.x0), h = Math.abs(rb.y1 - rb.y0);
  return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="rgba(58,123,213,0.06)" stroke="#3a7bd5" stroke-width="1" stroke-dasharray="4,3" pointer-events="none"/>';
}

/* Migration: nodes without gridCol/gridRow → approximate from x/y. */
function _migrateNodesToGrid(nodes) {
  nodes.forEach(function(n) {
    if (n.gridCol !== undefined && n.gridRow !== undefined) return;
    n.gridCol = Math.round((n.x || 0) / _GRID_CELL_W);
    n.gridRow = Math.max(1, Math.round(((n.y || 0) - _GRID_NODE_Y_OFF) / _GRID_CELL_H) + 1);
  });
}

function _clearanceColor(level) {
  var c = ['','#1a7a2e','#3d7a10','#7a7400','#c87c00','#c85800','#c83000','#c41000','#8a0000','#111'];
  return c[parseInt(level)] || '#555';
}

function _fmtHeadcount(n) {
  if (n >= 1000000) return Math.round(n / 1000000) + 'M';
  if (n >= 1000)    return Math.round(n / 1000) + 'k';
  return String(n);
}

/* Dept spanning span: leftX and width based on direct children positions */
function _deptSpan(n, edges, byId) {
  var kids = edges.filter(function(e){ return e.from === n.id; }).map(function(e){ return byId[e.to]; }).filter(Boolean);
  if (!kids.length) return null;
  var xs = kids.map(function(k){ return k.x; });
  var left  = Math.min.apply(null, xs) - _DEPT_HPAD;
  var right = Math.max.apply(null, xs.map(function(k){ return k; }));
  // right = rightmost child's x + that child's width
  var rightKid = kids.reduce(function(a, k){ return k.x > a.x ? k : a; }, kids[0]);
  right = rightKid.x + _NODE_W + _DEPT_HPAD;
  return { left: left, width: right - left, cx: (left + right) / 2 };
}

/* Center-x of a node (teams and departments use computed span center) */
function _nodeCX(n, edges, byId) {
  if (_isTeamNode(n)) {
    var r = _teamRect(n);
    return r.x + r.w / 2;
  }
  if (_isGroupNode(n) && edges && byId) {
    var sp = _deptSpan(n, edges, byId);
    if (sp) return sp.cx;
  }
  return n.x + _NODE_W / 2;
}

function renderHierarchy() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;

  var connectStatus = _hierConnectFrom
    ? '<span class="hier-connect-status">Connecting from: '+_esc(_hierNodeLabel(_hierConnectFrom, org))+' — click target node or <b onclick="hierCancelConnect()">cancel</b></span>'
    : '';

  var isNetwork = org.hierarchyMode === 'network';
  el.innerHTML =
    '<div class="hier-tab-wrap">' +
      '<div class="hier-toolbar">' +
        (!_viewMode ? '<button class="btn btn-sm" onclick="addHierNode(\'person\')">+ Person</button>' +
          '<button class="btn btn-sm" onclick="addHierNode(\'role\')">+ Role</button>' +
          '<button class="btn btn-sm" onclick="addHierNode(\'unit\')">+ Unit</button>' +
          '<div class="hier-toolbar-sep"></div>' +
          (!isNetwork ? '<button class="btn btn-sm" onclick="hierAutoLayout()">Auto Layout</button>' : '') : '') +
        '<button class="btn btn-sm'+(isNetwork?' btn-cy':'')+'" onclick="hierToggleNetworkMode()" title="'+(isNetwork?'Mode arbre':'Mode réseau')+'">'+(isNetwork?'⊟ Arbre':'⊞ Réseau')+'</button>' +
        '<button class="btn btn-sm" onclick="hierZoom(1.1)">＋</button>' +
        '<button class="btn btn-sm" onclick="hierZoom(0.91)">－</button>' +
        '<button class="btn btn-sm" onclick="_hierPan={x:40,y:40};_hierZoom=1;_drawHierSVG()">Reset</button>' +
        (!_viewMode ? connectStatus : '') +
      '</div>' +
      '<div class="hier-canvas-wrap">' +
        '<div class="hier-svg-container" id="hier-svg-container">' +
          '<svg class="hier-svg" id="hier-svg" xmlns="http://www.w3.org/2000/svg"></svg>' +
        '</div>' +
        '<div class="hier-edit-panel" id="hier-edit-panel">' +
          '<div class="hier-edit-empty">Click a node to edit it.</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  _drawHierSVG();
  _attachHierEvents();
}

function _hierNodeLabel(id, org) {
  var n = (org.hierarchy.nodes||[]).filter(function(n){ return n.id===id; })[0];
  return n ? (n.label||'?') : '?';
}

/* Build {byId, childMap} tree structure */
function _hierTree(org) {
  var byId = {};
  (org.hierarchy.nodes||[]).forEach(function(n){ byId[n.id]=n; });
  var childMap = {};
  (org.hierarchy.nodes||[]).forEach(function(n) {
    var pid = n.parentId && byId[n.parentId] ? n.parentId : '__root__';
    if (!childMap[pid]) childMap[pid] = [];
    childMap[pid].push(n);
  });
  return { byId:byId, childMap:childMap };
}

/* Compute bbox for a department recursively (memoized in `cache`) */
function _computeDeptBbox(deptNode, childMap, cache) {
  if (cache[deptNode.id]) return cache[deptNode.id];
  var children = childMap[deptNode.id] || [];
  if (!children.length) {
    return cache[deptNode.id] = { x: deptNode.x, y: deptNode.y, w: _NODE_W, h: _DEPT_H };
  }
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  children.forEach(function(c) {
    var cb = _isGroupNode(c)
      ? _computeDeptBbox(c, childMap, cache)
      : { x: c.x, y: c.y, w: _NODE_W, h: _nodeH(c) };
    if (cb.x < minX) minX = cb.x;
    if (cb.y < minY) minY = cb.y;
    if (cb.x + cb.w > maxX) maxX = cb.x + cb.w;
    if (cb.y + cb.h > maxY) maxY = cb.y + cb.h;
  });
  return cache[deptNode.id] = {
    x: minX - _DEPT_PAD,
    y: minY - _DEPT_PAD - _DEPT_HEADER,
    w: (maxX - minX) + 2 * _DEPT_PAD,
    h: (maxY - minY) + 2 * _DEPT_PAD + _DEPT_HEADER
  };
}

/* Get all descendants (any depth) of a node */
function _getDescendants(nodeId, childMap) {
  var result = [];
  var queue = (childMap[nodeId] || []).slice();
  while (queue.length) {
    var n = queue.shift();
    result.push(n);
    if (childMap[n.id]) queue = queue.concat(childMap[n.id]);
  }
  return result;
}

/* Check if candidateId is a descendant of ancestorId */
function _isDescendant(byId, candidateId, ancestorId) {
  var n = byId[candidateId];
  var safety = 0;
  while (n && n.parentId && safety < 100) {
    if (n.parentId === ancestorId) return true;
    n = byId[n.parentId];
    safety++;
  }
  return false;
}

/* Compute depth of a node (distance from root via parentId) */
function _nodeDepth(n, byId) {
  var d = 0, cur = n, safety = 0;
  while (cur && cur.parentId && byId[cur.parentId] && safety < 100) {
    d++; cur = byId[cur.parentId]; safety++;
  }
  return d;
}

function _drawHierSVG() {
  var svg = document.getElementById('hier-svg'); if (!svg) return;
  var org = _getActive(); if (!org) return;
  var nodes = org.hierarchy.nodes || [];
  var edges = org.hierarchy.edges || [];
  var tx = _hierPan.x, ty = _hierPan.y, z = _hierZoom;
  var isNetworkMode = org.hierarchyMode === 'network';

  // Build byId and sync globals (needed by _groupRect for nested lookups)
  var byId = {};
  nodes.forEach(function(n) { byId[n.id] = n; });
  _hierAllNodes  = nodes;
  _hierAllGroups = org.hierarchy.groups || [];

  // Grid: migrate legacy nodes, compute excludeIds (dragged nodes), apply positions
  _migrateNodesToGrid(nodes);
  var excludeIds = {};
  if (_hierDragState && _hierDragState.type === 'node') {
    (_hierDragState.moving || []).forEach(function(m) { excludeIds[m.id] = true; });
  }
  _applyGridPositions(nodes, excludeIds);
  var gridBounds  = _getGridBounds(nodes);
  var gridBgHtml  = _renderGridBackground(gridBounds);

  // Redacted: private nodes with public incoming edges → show as REDACTED box
  // Hidden: all their descendants → completely invisible
  var redactedIds = {}, hiddenIds = {};
  if (!_privateMode) {
    nodes.filter(function(n){ return n.privateOnly; }).forEach(function(n) {
      if (edges.some(function(e){ return e.to === n.id; })) redactedIds[n.id] = n;
    });
    // BFS descendants of redacted → hidden (not shown at all)
    var bfsQ = Object.keys(redactedIds).slice();
    var bfsVis = {};
    while (bfsQ.length) {
      var cur = bfsQ.shift();
      if (bfsVis[cur]) continue;
      bfsVis[cur] = true;
      edges.forEach(function(e) {
        if (e.from !== cur) return;
        var child = byId[e.to];
        if (child && !redactedIds[child.id] && !hiddenIds[child.id]) {
          hiddenIds[child.id] = true;
          bfsQ.push(child.id);
        }
      });
    }
  }

  var edgesHtml = isNetworkMode
    ? _renderEdgesNetwork(nodes, edges, byId, hiddenIds)
    : _renderEdgesStepLines(nodes, edges, byId, hiddenIds);

  var visibleNodes = nodes.filter(function(n) {
    return _privateMode || ((!n.privateOnly || redactedIds[n.id]) && !hiddenIds[n.id]);
  });

  // ─── Render groups first (outlines behind their members) ───
  // Parents BEFORE children so nested group labels paint on top of parent outlines
  var nodesHtml = '';
  var allGroups = (org.hierarchy.groups || []).filter(function(g) {
    if (_privateMode) return true;
    return !g.privateOnly;
  });
  // Topological-ish order: groups whose parent is missing/null first, then descendants
  var groupDepth = {};
  function gDepth(g) {
    if (groupDepth[g.id] !== undefined) return groupDepth[g.id];
    var p = g.groupId ? allGroups.filter(function(x){ return x.id === g.groupId; })[0] : null;
    return groupDepth[g.id] = p ? (gDepth(p) + 1) : 0;
  }
  allGroups.forEach(gDepth);
  var groupsOrdered = allGroups.slice().sort(function(a,b){ return groupDepth[a.id] - groupDepth[b.id]; });
  groupsOrdered.forEach(function(g) {
    nodesHtml += _renderGroupOutline(g);
  });

  // ─── Then render all leaf nodes ───
  visibleNodes.forEach(function(n) {
    if (redactedIds[n.id]) {
      var th = _titleH(n);
      nodesHtml += '<g transform="translate('+n.x+','+n.y+')" style="cursor:default">'
        + '<rect width="'+_NODE_W+'" height="'+th+'" fill="#ececec" stroke="#aaa" stroke-width="1.5" stroke-dasharray="5,3"/>'
        + '<text x="'+(_NODE_W/2)+'" y="'+(th/2+4)+'" text-anchor="middle" font-family="Eurostile,sans-serif" font-size="9" font-weight="bold" fill="#bbb" letter-spacing="3" style="pointer-events:none;user-select:none">REDACTED</text>'
        + '</g>';
      return;
    }
    nodesHtml += _renderLeafNodeSvg(n);
  });

  var rubberBand = '<line id="hier-rubber" x1="0" y1="0" x2="0" y2="0" stroke="#3a7bd5" stroke-width="1.5" stroke-dasharray="6,3" display="none" pointer-events="none"/>';

  svg.innerHTML =
    '<g id="hier-g" transform="translate('+tx+','+ty+') scale('+z+')">' +
      gridBgHtml +
      (_hierDragTargetCell ? _renderDragTargetHighlight(_hierDragTargetCell.col, _hierDragTargetCell.row) : '') +
      edgesHtml + nodesHtml +
      _renderRubberBand() +
    '</g>' +
    rubberBand;
}

function _hierBadges(n, w) {
  var cl = parseInt(n.clearance) || 0;
  var hc = parseInt(n.headcount) || 0;
  var R  = _BADGE_R; // 9 — half-size, badge = 18×18 centered on corner
  var clBadge = cl ? (
    '<rect x="'+(-R)+'" y="'+(-R)+'" width="'+(R*2)+'" height="'+(R*2)+'" fill="'+_clearanceColor(cl)+'" stroke="#111" stroke-width="1" style="pointer-events:none"/>'
    + '<text x="0" y="4" text-anchor="middle" font-family="Space Mono,monospace" font-size="9" font-weight="bold" fill="#fff" style="pointer-events:none;-webkit-user-select:none;user-select:none">'+cl+'</text>'
  ) : '';
  var hcBadge = hc ? (
    '<rect x="'+(w-R)+'" y="'+(-R)+'" width="'+(R*2)+'" height="'+(R*2)+'" fill="#fff" stroke="#111" stroke-width="1" style="pointer-events:none"/>'
    + '<text x="'+w+'" y="4" text-anchor="middle" font-family="Space Mono,monospace" font-size="9" fill="#111" style="pointer-events:none;-webkit-user-select:none;user-select:none">'+_fmtHeadcount(hc)+'</text>'
  ) : '';
  return clBadge + hcBadge;
}

/* Render one leaf node = two-tier card.
   Top: black bandeau with LABEL (white text).
   Bottom: white box with black outline, contents depend on whether a person
   sheet is attached. */
function _renderLeafNodeSvg(n) {
  var sel  = n.id === _hierSelected || _hierSelection.indexOf(n.id) >= 0;
  var sw   = sel ? '2.5' : '1.5';
  var dash = n.privateOnly ? 'stroke-dasharray="5,3"' : '';
  var th   = _titleH(n);
  var W    = _NODE_W;
  var bodyH = _PERSON_H;
  var totalH = th + bodyH;
  var bandColor = _typeColor(n);

  // ── Top: colored label bandeau (type-coded: person=blue, role=gold, unit=red) ──
  var topBar =
      '<rect width="'+W+'" height="'+th+'" fill="'+bandColor+'" stroke="#111" stroke-width="'+sw+'" '+dash+'/>'
    + '<foreignObject x="4" y="2" width="'+(W-8)+'" height="'+(th-4)+'" style="pointer-events:none">'
      + '<div xmlns="http://www.w3.org/1999/xhtml" style="height:'+(th-4)+'px;display:flex;align-items:center;justify-content:center;text-align:center;-webkit-user-select:none;user-select:none;overflow:hidden">'
        + '<div style="font-family:Eurostile,sans-serif;font-size:12px;font-weight:bold;color:#fff;letter-spacing:1px;text-transform:uppercase;word-break:break-word;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+_esc(n.label||'')+'</div>'
      + '</div>'
    + '</foreignObject>';

  // ── Bottom: white outlined card ──
  var bottomBox = '<rect x="0" y="'+th+'" width="'+W+'" height="'+bodyH+'" fill="#fff" stroke="#111" stroke-width="'+sw+'" '+dash+'/>';
  var bottomContent = _nodeHasPerson(n)
    ? _renderPersonSection(n, th)
    : _renderInfoSection(n, th);

  var connectBtn = !_viewMode
    ? '<circle cx="'+(W/2)+'" cy="'+totalH+'" r="6" fill="#fff" stroke="#bbb" stroke-width="1.5" onclick="event.stopPropagation();hierStartConnect(\''+n.id+'\')" style="cursor:crosshair"/>'
      + '<text x="'+(W/2)+'" y="'+(totalH+4)+'" text-anchor="middle" font-size="9" fill="#aaa" style="pointer-events:none;-webkit-user-select:none;user-select:none">+</text>'
    : '';

  return '<g class="hier-node" data-id="'+n.id+'" transform="translate('+n.x+','+n.y+')" '
    + 'onmousedown="hierNodeDown(event,\''+n.id+'\')" '
    + 'onclick="hierSelectNode(\''+n.id+'\',event.shiftKey)" '
    + 'style="cursor:pointer;-webkit-user-select:none;user-select:none">'
    + topBar + bottomBox + bottomContent + _hierBadges(n, W) + connectBtn
    + '</g>';
}

/* Bottom card for nodes WITHOUT a person sheet: title + short notes excerpt */
function _renderInfoSection(n, yOff) {
  var title = n.title || '';
  var notes = (n.notes || '').trim();
  if (notes.length > 80) notes = notes.slice(0, 78) + '…';
  var pH = _PERSON_H - 2;
  return '<foreignObject x="6" y="'+(yOff+4)+'" width="'+(_NODE_W-12)+'" height="'+(pH)+'" style="pointer-events:none">'
    + '<div xmlns="http://www.w3.org/1999/xhtml" style="height:'+pH+'px;display:flex;flex-direction:column;justify-content:flex-start;-webkit-user-select:none;user-select:none">'
      + (title ? '<div style="font-family:Space Mono,monospace;font-size:11px;font-weight:bold;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(title)+'</div>' : '')
      + (notes ? '<div style="font-family:Space Mono,monospace;font-size:10px;color:#555;margin-top:2px;line-height:1.25;overflow:hidden">'+_esc(notes)+'</div>' : '')
    + '</div>'
    + '</foreignObject>';
}

function _renderPersonSection(n, yOff) {
  var ns    = n.npcSheet;
  var cs    = n.characterSheet;
  var photo = (ns && ns.photo) || (cs && cs.photo) || n.photo;

  var name = '', lines = [];

  if (n.type === 'person') {
    // Person node: show character name (skip if same as label to avoid duplication)
    name = cs ? (cs.name || cs.handle || '') : '';
    if (name && name === (n.label || '')) name = '';
    if (cs && cs.role)  lines.push(cs.role);
    if (n.title)        lines.push(n.title);
  } else if (ns) {
    // Role/unit with NPC sheet: show NPC info
    name = ns.type || '';
    if (ns.role) lines.push(ns.role);
    if (ns.sa)   lines.push('SA: ' + ns.sa);
    if (n.pay)   lines.push(n.pay);
  }

  var pH = _PERSON_H - 2;
  var pW = photo ? pH : 0;
  var textX = pW ? (pW + 6) : 7;
  var textW = _NODE_W - textX - 5;

  return (photo
    ? '<image href="'+_esc(photo)+'" x="1" y="'+(yOff+1)+'" width="'+pW+'" height="'+pH+'" preserveAspectRatio="xMidYMid slice" style="pointer-events:none"/>'
      + '<line x1="'+pW+'" y1="'+yOff+'" x2="'+pW+'" y2="'+(yOff+_PERSON_H)+'" stroke="#ddd" stroke-width="1" style="pointer-events:none"/>'
    : '')
    + '<foreignObject x="'+textX+'" y="'+(yOff+4)+'" width="'+textW+'" height="'+(_PERSON_H-8)+'" style="pointer-events:none">'
      + '<div xmlns="http://www.w3.org/1999/xhtml" style="height:'+(_PERSON_H-8)+'px;display:flex;flex-direction:column;justify-content:center;-webkit-user-select:none;user-select:none">'
        + (name ? '<div style="font-family:Space Mono,monospace;font-size:12px;font-weight:bold;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(name)+'</div>' : '')
        + lines.slice(0,2).map(function(l){
            return '<div style="font-family:Space Mono,monospace;font-size:10px;color:#666;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(l)+'</div>';
          }).join('')
      + '</div>'
    + '</foreignObject>';
}

/* Unified group outline renderer (team = dashed, department = solid).
   The label box (top-left, outside the outline) is the only interactive part:
   click = select+edit, drag = move all members. */
function _renderGroupOutline(g) {
  var r = _groupRect(g);
  if (!r) return ''; // no members → no rendering
  var sel  = _hierSelectedGroup === g.id;
  var sw   = sel ? '2.5' : '1.5';
  var stroke = g.color || '#111';
  // team = dashed, department = solid
  var dashAttr = (g.type === 'team') ? 'stroke-dasharray="6,4"' : '';
  // private overrides the dash pattern with a different one
  if (g.privateOnly) dashAttr = 'stroke-dasharray="5,3"';

  // Label box at top-left (outside the outline) — width adapts to text length
  var labelText = g.name || '';
  var labelW = Math.max(60, labelText.length * 7 + 16);

  var labelBox =
    '<g class="hier-group-label" data-gid="'+g.id+'" '
      + 'onmousedown="hierGroupDown(event,\''+g.id+'\')" '
      + 'onclick="event.stopPropagation();hierSelectGroup(\''+g.id+'\',event.shiftKey)" '
      + 'style="cursor:move;-webkit-user-select:none;user-select:none">'
    + '<rect x="0" y="'+(-_TEAM_LABEL_H)+'" width="'+labelW+'" height="'+_TEAM_LABEL_H+'" fill="'+stroke+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>'
    + '<foreignObject x="3" y="'+(-_TEAM_LABEL_H+2)+'" width="'+(labelW-6)+'" height="'+(_TEAM_LABEL_H-4)+'" style="pointer-events:none">'
      + '<div xmlns="http://www.w3.org/1999/xhtml" style="height:'+(_TEAM_LABEL_H-4)+'px;display:flex;align-items:center">'
        + '<div style="font-family:Eurostile,sans-serif;font-size:11px;font-weight:bold;color:#fff;letter-spacing:1px;text-transform:uppercase;white-space:nowrap">'+_esc(labelText)+'</div>'
      + '</div>'
    + '</foreignObject>'
    + '</g>';

  var hc = parseInt(g.headcount) || 0;
  var R  = _BADGE_R;
  var hcBadge = hc
    ? '<rect x="'+(r.w-R)+'" y="'+(-R)+'" width="'+(R*2)+'" height="'+(R*2)+'" fill="#fff" stroke="'+stroke+'" stroke-width="1" style="pointer-events:none"/>'
      + '<text x="'+r.w+'" y="4" text-anchor="middle" font-family="Space Mono,monospace" font-size="9" fill="#111" style="pointer-events:none;-webkit-user-select:none;user-select:none">'+_fmtHeadcount(hc)+'</text>'
    : '';

  return '<g class="hier-group" data-gid="'+g.id+'" transform="translate('+r.x+','+r.y+')">'
    + '<rect x="0" y="0" width="'+r.w+'" height="'+r.h+'" fill="rgba(0,0,0,0.015)" stroke="'+stroke+'" stroke-width="'+sw+'" '+dashAttr+' pointer-events="none"/>'
    + labelBox
    + hcBadge
    + '</g>';
}

function _renderEdgesStepLines(nodes, edges, byId, hiddenIds) {
  var V_DROP = 22;
  var edgesByParent = {};
  edges.forEach(function(e) {
    if (!_privateMode && e.privateOnly) return;
    if (hiddenIds && (hiddenIds[e.from] || hiddenIds[e.to])) return;
    var fn = byId[e.from], tn = byId[e.to];
    if (!fn || !tn) return;
    if (!edgesByParent[e.from]) edgesByParent[e.from] = [];
    edgesByParent[e.from].push(e);
  });

  var html = '';
  Object.keys(edgesByParent).forEach(function(pid) {
    var pEdges = edgesByParent[pid];
    var pn     = byId[pid]; if (!pn) return;
    var px     = _nodeCX(pn, edges, byId);
    var py     = pn.y + _nodeVisH(pn);
    var midY   = py + V_DROP;

    var valid = pEdges.map(function(e){ return { n: byId[e.to], e: e }; }).filter(function(c){ return !!c.n; });
    if (!valid.length) return;

    if (valid.length === 1) {
      var c = valid[0], priv = c.e.privateOnly;
      var cx = _nodeCX(c.n, edges, byId), cy = c.n.y;
      var d1 = 'M'+px+','+py+' L'+px+','+midY+' L'+cx+','+midY+' L'+cx+','+cy;
      // Invisible thick hit-area + thin visible stroke
      html += '<path d="'+d1+'" fill="none" stroke="transparent" stroke-width="10" pointer-events="stroke"'
        + ' onclick="event.stopPropagation();hierClickEdge(\''+c.e.id+'\')" style="cursor:pointer"/>';
      html += '<path d="'+d1+'" fill="none" stroke="'+(priv?'#c44':'#111')+'" stroke-width="1.5" pointer-events="none"'
        + (priv?' stroke-dasharray="5,3"':'') + '/>';
    } else {
      var childXs = valid.map(function(c){ return _nodeCX(c.n, edges, byId); });
      var allXs = [px].concat(childXs);
      var lx = Math.min.apply(null, allXs), rx = Math.max.apply(null, allXs);
      // Parent stub + horizontal bar (non-clickable, shared bars)
      html += '<line x1="'+px+'" y1="'+py+'" x2="'+px+'" y2="'+midY+'" stroke="#111" stroke-width="1.5" pointer-events="none"/>';
      html += '<line x1="'+lx+'" y1="'+midY+'" x2="'+rx+'" y2="'+midY+'" stroke="#111" stroke-width="1.5" pointer-events="none"/>';
      valid.forEach(function(c) {
        var priv = c.e.privateOnly;
        var cx = _nodeCX(c.n, edges, byId), cy = c.n.y;
        // Hit-area + visible drop line
        html += '<line x1="'+cx+'" y1="'+midY+'" x2="'+cx+'" y2="'+cy+'" stroke="transparent" stroke-width="10" pointer-events="stroke"'
          + ' onclick="event.stopPropagation();hierClickEdge(\''+c.e.id+'\')" style="cursor:pointer"/>';
        html += '<line x1="'+cx+'" y1="'+midY+'" x2="'+cx+'" y2="'+cy+'" stroke="'+(priv?'#c44':'#111')+'" stroke-width="1.5" pointer-events="none"'
          + (priv?' stroke-dasharray="5,3"':'') + '/>';
      });
    }
  });
  return html;
}

function _renderEdgesNetwork(nodes, edges, byId, hiddenIds) {
  return edges.map(function(e) {
    if (!_privateMode && e.privateOnly) return '';
    if (hiddenIds && (hiddenIds[e.from] || hiddenIds[e.to])) return '';
    var fn = byId[e.from], tn = byId[e.to];
    if (!fn || !tn) return '';
    var x1 = fn.x + _NODE_W/2, y1 = fn.y + _nodeH(fn)/2;
    var x2 = tn.x + _NODE_W/2, y2 = tn.y + _nodeH(tn)/2;
    return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="transparent" stroke-width="10" pointer-events="stroke"'
      + ' onclick="event.stopPropagation();hierClickEdge(\''+e.id+'\')" style="cursor:pointer"/>'
      + '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(e.privateOnly?'#c44':'#999')+'" stroke-width="1.5" pointer-events="none"'
      + (e.privateOnly?' stroke-dasharray="5,3"':'') + '/>';
  }).join('');
}

function _attachHierEvents() {
  var svg = document.getElementById('hier-svg'); if (!svg) return;
  svg.addEventListener('mousedown',  hierSvgDown);
  svg.addEventListener('mousemove',  hierSvgMove);
  svg.addEventListener('mouseup',    hierSvgUp);
  svg.addEventListener('mouseleave', hierSvgUp);
  svg.addEventListener('click',      hierSvgClick);
  svg.addEventListener('contextmenu', hierShowContextMenu);
  function _hierWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    // Slow zoom: 3% per wheel notch, scaled by deltaY magnitude
    var dir = e.deltaY < 0 ? 1 : -1;
    var step = Math.min(0.06, Math.abs(e.deltaY) * 0.0005 + 0.02);
    var factor = 1 + dir * step;
    _hierZoom = Math.max(0.1, Math.min(5, _hierZoom * factor));
    var g = document.getElementById('hier-g');
    if (g) g.setAttribute('transform', 'translate('+_hierPan.x+','+_hierPan.y+') scale('+_hierZoom+')');
  }
  svg.addEventListener('wheel', _hierWheel, { passive: false });
  // Also catch wheel on the container (iframe quirks)
  var container = document.getElementById('hier-svg-container');
  if (container && !container.__hierWheelBound) {
    container.__hierWheelBound = true;
    container.addEventListener('wheel', _hierWheel, { passive: false });
  }
}

function _getSvgPt(e) {
  var svg = document.getElementById('hier-svg'); if (!svg) return {x:0,y:0};
  var pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  var m = svg.getScreenCTM();
  if (!m) return { x: e.clientX, y: e.clientY };
  var p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

function _svgToNode(svgPt) {
  // Convert SVG-space coords to node-space (accounting for pan + zoom)
  return {
    x: (svgPt.x - _hierPan.x) / _hierZoom,
    y: (svgPt.y - _hierPan.y) / _hierZoom
  };
}

function hierNodeDown(e, id) {
  if (e.button !== 0) return;
  if (_viewMode) return;
  if (_hierConnectFrom) return; // in connect mode, clicks are handled by hierSelectNode
  e.stopPropagation();
  var org = _getActive(); if (!org) return;
  var node = org.hierarchy.nodes.filter(function(n){ return n.id===id; })[0]; if (!node) return;

  var moving = [{ id: id, origX: node.x, origY: node.y, origGridCol: node.gridCol, origGridRow: node.gridRow }];

  // NOTE: do NOT call hierSelectNode here — the trailing 'click' event will
  // call it, and if shiftKey is set, calling it twice would toggle the node
  // into and then back out of the multi-selection. Drag still works because
  // _hierDragState.moving identifies what to drag independently of selection.
  var svgPt = _getSvgPt(e);
  _hierDragState = { type:'node', id:id, moving:moving, startX:svgPt.x, startY:svgPt.y, moved:false };
}

/* mousedown on group label → start dragging the whole group (recursive: all
   leaf members including those inside nested child groups). */
function hierGroupDown(e, gid) {
  if (e.button !== 0) return;
  if (_viewMode) return;
  if (_hierConnectFrom) return;
  e.stopPropagation();
  var org = _getActive(); if (!org) return;
  var allGroups = org.hierarchy.groups || [];
  var g = allGroups.filter(function(x){ return x.id === gid; })[0];
  if (!g) return;
  var leafIds = _groupAllLeafIds(g, allGroups, org.hierarchy.nodes || []);
  var members = (org.hierarchy.nodes || []).filter(function(m){ return leafIds.indexOf(m.id) >= 0; });
  if (!members.length) return;

  var moving = members.map(function(m) {
    return { id: m.id, origX: m.x, origY: m.y, origGridCol: m.gridCol, origGridRow: m.gridRow };
  });
  var svgPt = _getSvgPt(e);
  _hierDragState = { type:'node', id:gid, isGroupDrag:true, gid:gid, moving:moving, startX:svgPt.x, startY:svgPt.y, moved:false };
}

function hierSvgDown(e) {
  if (e.button !== 0) return;
  if (_hierDragState) return; // already dragging a node
  if (_hierConnectFrom) return;
  var svgPt  = _getSvgPt(e);
  var nodePt = _svgToNode(svgPt);
  // "Empty" = not inside a node or a group label/outline
  var onNode = e.target.closest && (
    e.target.closest('.hier-node') ||
    e.target.closest('.hier-group-label') ||
    e.target.closest('.hier-group')
  );
  if (!onNode) {
    _hierRubberBand = { x0: nodePt.x, y0: nodePt.y, x1: nodePt.x, y1: nodePt.y };
    _hierDragState = { type:'pan', startX:svgPt.x, startY:svgPt.y, origPanX:_hierPan.x, origPanY:_hierPan.y };
  }
}

function hierSvgMove(e) {
  if (!_hierDragState) {
    // Update rubber band if connecting
    if (_hierConnectFrom) {
      var svgPt = _getSvgPt(e);
      var org   = _getActive(); if (!org) return;
      var fn    = org.hierarchy.nodes.filter(function(n){ return n.id===_hierConnectFrom; })[0];
      var rb    = document.getElementById('hier-rubber'); if (!rb || !fn) return;
      rb.setAttribute('display','');
      rb.setAttribute('x1', fn.x * _hierZoom + _hierPan.x + _NODE_W/2 * _hierZoom);
      rb.setAttribute('y1', fn.y * _hierZoom + _hierPan.y + _nodeH(fn) * _hierZoom);
      rb.setAttribute('x2', svgPt.x);
      rb.setAttribute('y2', svgPt.y);
    }
    return;
  }
  var svgPt = _getSvgPt(e);
  if (_hierDragState.type === 'pan') {
    _hierPan.x = _hierDragState.origPanX + (svgPt.x - _hierDragState.startX);
    _hierPan.y = _hierDragState.origPanY + (svgPt.y - _hierDragState.startY);
    var g = document.getElementById('hier-g');
    if (g) g.setAttribute('transform','translate('+_hierPan.x+','+_hierPan.y+') scale('+_hierZoom+')');
    // Update rubber-band if active
    if (_hierRubberBand) {
      var nodePt2 = _svgToNode(svgPt);
      _hierRubberBand.x1 = nodePt2.x;
      _hierRubberBand.y1 = nodePt2.y;
      _drawHierSVG();
    }
  } else if (_hierDragState.type === 'node') {
    var dx = (svgPt.x - _hierDragState.startX) / _hierZoom;
    var dy = (svgPt.y - _hierDragState.startY) / _hierZoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _hierDragState.moved = true;
    if (!_hierDragState.moved) return;
    var org = _getActive(); if (!org) return;
    _hierDragState.moving.forEach(function(m) {
      var n = org.hierarchy.nodes.filter(function(x){ return x.id === m.id; })[0];
      if (n) { n.x = m.origX + dx; n.y = m.origY + dy; }
    });
    // Update drag target cell highlight (use first leaf node in moving set)
    var firstLeaf = _hierDragState.moving.filter(function(m) {
      var n = org.hierarchy.nodes.filter(function(x){ return x.id === m.id; })[0];
      return n && _isLeafNode(n);
    })[0];
    if (firstLeaf) {
      var fn2 = org.hierarchy.nodes.filter(function(x){ return x.id === firstLeaf.id; })[0];
      if (fn2) _hierDragTargetCell = _svgToGridCell(fn2.x + _NODE_W/2, fn2.y + _GRID_NODE_Y_OFF/2);
    }
    // Full redraw — needed because dept bboxes recompute from children
    _drawHierSVG();
  }
}

function hierSvgUp(e) {
  if (_hierDragState && _hierDragState.type === 'node' && _hierDragState.moved) {
    var org = _getActive();
    if (org) {
      var movingIds = {};
      _hierDragState.moving.forEach(function(m) { movingIds[m.id] = true; });
      var rejected = false;

      // First pass: check all target cells for leaf nodes
      _hierDragState.moving.forEach(function(m) {
        var n = org.hierarchy.nodes.filter(function(x) { return x.id === m.id; })[0];
        if (!n || !_isLeafNode(n)) return;
        var cell = _svgToGridCell(n.x + _NODE_W/2, n.y + _nodeH(n)/2);
        if (_hierCellOccupied(cell.col, cell.row, movingIds, org.hierarchy.nodes)) {
          rejected = true;
        }
      });

      if (rejected) {
        // Revert all nodes to original grid positions
        _hierDragState.moving.forEach(function(m) {
          var n = org.hierarchy.nodes.filter(function(x) { return x.id === m.id; })[0];
          if (!n) return;
          n.gridCol = m.origGridCol;
          n.gridRow = m.origGridRow;
        });
      } else {
        // Apply snap for all moved nodes (all are leaves now)
        _hierDragState.moving.forEach(function(m) {
          var n = org.hierarchy.nodes.filter(function(x) { return x.id === m.id; })[0];
          if (!n) return;
          var cell = _svgToGridCell(n.x + _NODE_W/2, n.y + _nodeH(n)/2);
          n.gridCol = cell.col;
          n.gridRow = Math.max(1, cell.row);
        });
      }
    }
    _hierDragTargetCell = null;
    _schedSave();
    _drawHierSVG();
  } else if (_hierDragState && _hierDragState.type === 'node' && !_hierDragState.moved) {
    // No movement — already handled select in hierNodeDown
  }

  // Rubber-band selection finalize — only redraw if there was actual rubber-band
  // movement, otherwise we kill the click event on whatever was clicked (e.g.
  // an edge path), preventing edge deletion etc.
  if (_hierRubberBand) {
    var rb = _hierRubberBand;
    var x0 = Math.min(rb.x0, rb.x1), x1 = Math.max(rb.x0, rb.x1);
    var y0 = Math.min(rb.y0, rb.y1), y1 = Math.max(rb.y0, rb.y1);
    var rbMoved = (x1-x0 > 5 || y1-y0 > 5);
    var orgRb = _getActive();
    if (orgRb && rbMoved) {
      _hierSelection = (orgRb.hierarchy.nodes || []).filter(function(n) {
        return n.x >= x0 && n.x + _NODE_W <= x1 && n.y >= y0 && n.y + _nodeH(n) <= y1;
      }).map(function(n) { return n.id; });
      _hierSelected = _hierSelection.length === 1 ? _hierSelection[0] : null;
    }
    _hierRubberBand = null;
    if (rbMoved) _drawHierSVG();
  }

  _hierDragState = null;
}

function hierSvgClick(e) {
  // Click on empty SVG
  if (_hierConnectFrom) { hierCancelConnect(); return; }
  var onNode = e.target.closest && (
    e.target.closest('.hier-node') ||
    e.target.closest('.hier-group-label') ||
    e.target.closest('.hier-group')
  );
  if (!onNode) {
    _hierSelection = [];
    _hierSelectedGroup = null;
    hierSelectNode(null);
  }
}

function hierSelectNode(id, shiftKey) {
  if (_viewMode && id) { _hierOpenNodeCard(id); return; }
  if (_hierConnectFrom && id && id !== _hierConnectFrom) {
    hierFinishConnect(id);
    return;
  }
  if (shiftKey && id) {
    // Toggle id in _hierSelection; absorb the previously-selected single node so
    // a click+shift-click flow correctly builds a multi-selection
    if (_hierSelected && _hierSelection.indexOf(_hierSelected) < 0) {
      _hierSelection.push(_hierSelected);
    }
    var idx = _hierSelection.indexOf(id);
    if (idx >= 0) _hierSelection.splice(idx, 1);
    else _hierSelection.push(id);
    _hierSelected = null;
    _hierSelectedGroup = null;
    _updateHierSelectionVisuals();
    return;
  }
  // Normal select: clear multi-selection + group selection
  _hierSelection = [];
  _hierSelectedGroup = null;
  _hierSelected = id;
  _updateHierSelectionVisuals();
  _renderHierEditPanel(id);
}

/* Group label click → select group + open edit panel */
function hierSelectGroup(gid, shiftKey) {
  if (_viewMode) return;
  _hierSelected = null;
  _hierSelection = [];
  _hierSelectedGroup = gid;
  _updateHierSelectionVisuals();
  if (gid) {
    _renderHierEditPanelForGroup(gid);
  } else {
    var el = document.getElementById('hier-edit-panel');
    if (el) el.innerHTML = '<div class="hier-edit-empty">Click a node to edit it.</div>';
  }
}

/* Update stroke widths in-place to reflect current selection state, WITHOUT
   redrawing the whole SVG. This is critical: a full redraw between mousedown
   and click would prevent the click event from firing on the connect dot etc. */
function _updateHierSelectionVisuals() {
  var svgEl = document.getElementById('hier-svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('.hier-node rect').forEach(function(r) {
    r.setAttribute('stroke-width', '1.5');
  });
  svgEl.querySelectorAll('.hier-group-label rect, .hier-group > rect').forEach(function(r) {
    r.setAttribute('stroke-width', '1.5');
  });
  function highlight(sel) {
    var node = svgEl.querySelector(sel);
    if (node) node.querySelectorAll('rect').forEach(function(r){ r.setAttribute('stroke-width','3'); });
  }
  if (_hierSelected) highlight('[data-id="'+_hierSelected+'"]');
  _hierSelection.forEach(function(sid){ highlight('[data-id="'+sid+'"]'); });
  if (_hierSelectedGroup) {
    var ggLbl = svgEl.querySelector('.hier-group-label[data-gid="'+_hierSelectedGroup+'"]');
    if (ggLbl) ggLbl.querySelectorAll('rect').forEach(function(r){ r.setAttribute('stroke-width','3'); });
    var ggOut = svgEl.querySelector('.hier-group[data-gid="'+_hierSelectedGroup+'"] > rect');
    if (ggOut) ggOut.setAttribute('stroke-width','3');
  }
}

function hierStartConnect(fromId) {
  // If already connecting and clicking another node's connect dot, complete it
  if (_hierConnectFrom && _hierConnectFrom !== fromId) {
    hierFinishConnect(fromId);
    return;
  }
  _hierConnectFrom = fromId;
  var toolbar = document.querySelector('.hier-toolbar');
  if (toolbar) {
    var existing = toolbar.querySelector('.hier-connect-status');
    var org = _getActive();
    var label = org ? _hierNodeLabel(fromId, org) : fromId;
    var span = document.createElement('span');
    span.className = 'hier-connect-status';
    span.innerHTML = 'Connecting from: <b>'+_esc(label)+'</b> — click target node or <b style="cursor:pointer" onclick="hierCancelConnect()">cancel</b>';
    if (existing) toolbar.replaceChild(span, existing);
    else toolbar.appendChild(span);
  }
}

function hierFinishConnect(toId) {
  var org = _getActive(); if (!org) return;
  var from = _hierConnectFrom;
  _hierConnectFrom = null;
  // Remove rubber band
  var rb = document.getElementById('hier-rubber');
  if (rb) rb.setAttribute('display','none');
  // Remove duplicate
  var exists = (org.hierarchy.edges||[]).some(function(e){ return e.from===from && e.to===toId; });
  if (!exists && from !== toId) {
    org.hierarchy.edges.push({ id:_uid(), from:from, to:toId, privateOnly:false });
    _schedSave();
  }
  _drawHierSVG();
  // re-attach events after full redraw
  _attachHierEvents();
  var toolbar = document.querySelector('.hier-toolbar .hier-connect-status');
  if (toolbar) toolbar.remove();
}

function hierCancelConnect() {
  _hierConnectFrom = null;
  var rb = document.getElementById('hier-rubber');
  if (rb) rb.setAttribute('display','none');
  var toolbar = document.querySelector('.hier-toolbar .hier-connect-status');
  if (toolbar) toolbar.remove();
}

function hierHideContextMenu() {
  var m = document.getElementById('hier-ctx-menu');
  if (m) m.remove();
}

function hierShowContextMenu(e) {
  e.preventDefault();
  hierHideContextMenu();
  var org = _getActive(); if (!org) return;
  var selectedIds = _hierSelection.slice();
  if (_hierSelected && selectedIds.indexOf(_hierSelected) < 0) selectedIds.push(_hierSelected);
  if (!selectedIds.length) return;

  var selectedNodes = selectedIds.map(function(sid) {
    return org.hierarchy.nodes.filter(function(n) { return n.id === sid; })[0];
  }).filter(Boolean);

  var anyGrouped = selectedNodes.some(function(n) { return !!n.groupId; });

  var menu = document.createElement('div');
  menu.id = 'hier-ctx-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #ccc;box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:4px 0;font-family:var(--mono,monospace);font-size:13px;min-width:180px';
  menu.style.left = e.clientX + 'px';
  menu.style.top  = e.clientY + 'px';

  function addItem(label, enabled, onclick) {
    var li = document.createElement('div');
    li.style.cssText = 'padding:6px 14px;cursor:'+(enabled?'pointer':'default')+';color:'+(enabled?'#111':'#aaa');
    li.textContent = label;
    if (enabled) li.addEventListener('click', function() { hierHideContextMenu(); onclick(); });
    menu.appendChild(li);
  }

  addItem('Group as Department', true, function() { hierGroupSelected('department'); });
  addItem('Group as Team',       true, function() { hierGroupSelected('team'); });
  if (anyGrouped) {
    addItem('Remove from group', true, function() { hierDissociateSelected(); });
  }

  document.body.appendChild(menu);
  document.addEventListener('mousedown', function closeMenu(ev) {
    if (!menu.contains(ev.target)) { hierHideContextMenu(); document.removeEventListener('mousedown', closeMenu); }
  });
}

/* Create a new group (team/department) from currently-selected leaf nodes */
function hierGroupSelected(type) {
  var org = _getActive(); if (!org) return;
  if (!org.hierarchy.groups) org.hierarchy.groups = [];
  var selectedIds = _hierSelection.slice();
  if (_hierSelected && selectedIds.indexOf(_hierSelected) < 0) selectedIds.push(_hierSelected);
  if (!selectedIds.length) return;

  var memberNodes = selectedIds.map(function(sid) {
    return org.hierarchy.nodes.filter(function(x) { return x.id === sid; })[0];
  }).filter(Boolean);
  if (!memberNodes.length) return;

  var group = {
    id: _uid(),
    type: type,                       // 'team' | 'department'
    name: 'New ' + (type === 'team' ? 'Team' : 'Department'),
    color: null,
    headcount: null,
    clearance: null,
    privateOnly: false,
    notes: ''
  };
  org.hierarchy.groups.push(group);

  // Detach members from any previous group, attach to new one
  memberNodes.forEach(function(n) { n.groupId = group.id; });

  _hierSelection = [];
  _hierSelected = null;
  _hierSelectedGroup = group.id;
  _schedSave();
  _drawHierSVG();
  _attachHierEvents();
  _renderHierEditPanelForGroup(group.id);
}

/* Remove selected nodes from their groups (does not delete the group itself) */
function hierDissociateSelected() {
  var org = _getActive(); if (!org) return;
  var selectedIds = _hierSelection.slice();
  if (_hierSelected && selectedIds.indexOf(_hierSelected) < 0) selectedIds.push(_hierSelected);
  selectedIds.forEach(function(sid) {
    var n = org.hierarchy.nodes.filter(function(x) { return x.id === sid; })[0];
    if (n) n.groupId = null;
  });
  // Remove any group that ended up empty (no direct leaf members AND no child groups)
  org.hierarchy.groups = (org.hierarchy.groups || []).filter(function(g) {
    var hasLeaves = org.hierarchy.nodes.some(function(n) { return n.groupId === g.id; });
    var hasChildGroups = (org.hierarchy.groups || []).some(function(c) { return c.groupId === g.id; });
    return hasLeaves || hasChildGroups;
  });
  _hierSelection = [];
  _schedSave();
  _drawHierSVG();
  _attachHierEvents();
}

function hierClickEdge(edgeId) {
  if (!confirm('Delete this connection?')) return;
  var org = _getActive(); if (!org) return;
  org.hierarchy.edges = org.hierarchy.edges.filter(function(e){ return e.id !== edgeId; });
  _schedSave();
  _drawHierSVG(); _attachHierEvents();
}

/* Edit panel for a group (team or department) */
function _renderHierEditPanelForGroup(gid) {
  var el = document.getElementById('hier-edit-panel'); if (!el) return;
  var org = _getActive(); if (!org) return;
  var g = (org.hierarchy.groups || []).filter(function(x){ return x.id === gid; })[0];
  if (!g) { el.innerHTML = '<div class="hier-edit-empty">Group not found.</div>'; return; }
  var gIdx = org.hierarchy.groups.indexOf(g);
  var membersCount = (org.hierarchy.nodes || []).filter(function(n){ return n.groupId === gid; }).length;

  el.innerHTML =
    '<div class="hier-edit-head">Edit ' + (g.type === 'team' ? 'Team' : 'Department') +
      ' <span class="hier-edit-close" onclick="hierSelectGroup(null)">×</span></div>' +
    '<div class="hier-edit-body">' +
      '<div class="org-field"><label>Name</label>' +
        '<input class="org-input" value="'+_esc(g.name||'')+'" oninput="hierGroupSet('+gIdx+',\'name\',this.value)">' +
      '</div>' +
      '<div class="org-field"><label>Type</label>' +
        '<select class="org-select" style="width:100%" onchange="hierGroupSet('+gIdx+',\'type\',this.value)">' +
          '<option value="team"'+(g.type==='team'?' selected':'')+'>Team (dashed outline)</option>' +
          '<option value="department"'+(g.type==='department'?' selected':'')+'>Department (solid outline)</option>' +
        '</select>' +
      '</div>' +
      (function() {
        // Parent-group selector: a group can be nested in another group.
        // Exclude self + any descendant (avoid cycles).
        var descendants = {};
        function markDescendants(parentId) {
          (org.hierarchy.groups||[]).forEach(function(x) {
            if (x.groupId === parentId && !descendants[x.id]) {
              descendants[x.id] = true; markDescendants(x.id);
            }
          });
        }
        descendants[g.id] = true;
        markDescendants(g.id);
        var candidates = (org.hierarchy.groups||[]).filter(function(x){ return !descendants[x.id]; });
        if (!candidates.length) return '';
        return '<div class="org-field"><label>Parent group (optional)</label>' +
          '<select class="org-select" style="width:100%" onchange="hierGroupSet('+gIdx+',\'groupId\',this.value||null)">' +
            '<option value="">— None (top-level) —</option>' +
            candidates.map(function(x){
              return '<option value="'+_esc(x.id)+'"'+(g.groupId===x.id?' selected':'')+'>'+_esc(x.name||x.id)+' ('+x.type+')</option>';
            }).join('') +
          '</select>' +
        '</div>';
      })() +
      '<div class="org-field-row">' +
        '<div class="org-field"><label>Clearance</label>' +
          '<select class="org-select" style="width:100%" onchange="hierGroupSet('+gIdx+',\'clearance\',this.value?parseInt(this.value):null)">' +
            '<option value="">—</option>' +
            [1,2,3,4,5,6,7,8,9].map(function(l){
              return '<option value="'+l+'"'+(g.clearance===l?' selected':'')+'>'+l+'</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="org-field"><label>Headcount</label>' +
          '<input type="number" min="0" class="org-input" value="'+_esc(String(g.headcount||''))+'" oninput="hierGroupSet('+gIdx+',\'headcount\',this.value?parseInt(this.value):null)">' +
        '</div>' +
      '</div>' +
      '<div class="org-field"><label>Color</label>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<input type="color" value="'+_esc(g.color||'#111')+'" onchange="hierGroupSet('+gIdx+',\'color\',this.value)">' +
          (g.color ? '<span class="org-rm" onclick="hierGroupSet('+gIdx+',\'color\',null)" title="Reset">↺</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="org-field"><label>Private only</label>' +
        '<input type="checkbox"'+(g.privateOnly?' checked':'')+' onchange="hierGroupSet('+gIdx+',\'privateOnly\',this.checked)">' +
      '</div>' +
      '<div class="org-field"><label>Notes</label>' +
        '<textarea class="org-textarea" style="min-height:60px" oninput="hierGroupSet('+gIdx+',\'notes\',this.value)">'+_esc(g.notes||'')+'</textarea>' +
      '</div>' +
      '<div style="margin-top:6px;font-size:13px;color:#888;font-family:var(--mono,monospace)">Members: '+membersCount+'</div>' +
      '<div style="margin-top:10px"><button class="btn btn-sm" onclick="hierDeleteGroup(\''+gid+'\')">Delete Group</button></div>' +
    '</div>';
}

function hierGroupSet(idx, field, val) {
  var org = _getActive(); if (!org) return;
  var g = (org.hierarchy.groups || [])[idx]; if (!g) return;
  g[field] = val;
  _schedSave();
  _drawHierSVG();
  _attachHierEvents();
}

function hierDeleteGroup(gid) {
  if (!confirm('Delete this group? Members will be detached but kept.')) return;
  var org = _getActive(); if (!org) return;
  // Detach leaf members
  (org.hierarchy.nodes || []).forEach(function(n) {
    if (n.groupId === gid) n.groupId = null;
  });
  // Promote nested child groups to the deleted group's parent (or top-level)
  var deleted = (org.hierarchy.groups || []).filter(function(g){ return g.id === gid; })[0];
  var newParent = deleted ? (deleted.groupId || null) : null;
  (org.hierarchy.groups || []).forEach(function(g) {
    if (g.groupId === gid) g.groupId = newParent;
  });
  org.hierarchy.groups = (org.hierarchy.groups || []).filter(function(g) { return g.id !== gid; });
  _hierSelectedGroup = null;
  _schedSave();
  _drawHierSVG();
  _attachHierEvents();
  var el = document.getElementById('hier-edit-panel');
  if (el) el.innerHTML = '<div class="hier-edit-empty">Click a node to edit it.</div>';
}

function _renderHierEditPanel(id) {
  var el = document.getElementById('hier-edit-panel'); if (!el) return;
  if (!id) { el.innerHTML = '<div class="hier-edit-empty">Click a node to edit it.</div>'; return; }
  var org = _getActive(); if (!org) return;
  var node = org.hierarchy.nodes.filter(function(n){ return n.id===id; })[0];
  if (!node) { el.innerHTML = '<div class="hier-edit-empty">Node not found.</div>'; return; }

  var nodeIdx = org.hierarchy.nodes.indexOf(node);
  var cs = node.characterSheet;

  // Photo section (persons only)
  var photoSection = '';
  if (node.type === 'person') {
    photoSection = '<div class="hier-edit-section">Photo</div>' +
      (node.photo
        ? '<div style="display:flex;align-items:center;gap:6px"><img src="'+_esc(node.photo)+'" style="width:48px;height:48px;object-fit:cover;border:1px solid #111"><button class="btn btn-sm" onclick="hierUploadPhoto('+nodeIdx+')">Change</button><span class="org-rm" onclick="hierClearPhoto('+nodeIdx+')">✕</span></div>'
        : '<button class="btn btn-sm" style="width:100%" onclick="hierUploadPhoto('+nodeIdx+')">Upload Photo…</button>');
  }

  // Role-specific fields
  var roleFields = '';
  if (node.type === 'role') {
    roleFields = '<div class="hier-edit-section">Role Details</div>' +
      '<div class="org-field"><label>Pay</label><input class="org-input" value="'+_esc(node.pay||'')+'" oninput="hierNodeSet('+nodeIdx+',\'pay\',this.value)"></div>' +
      '<div class="org-field"><label>Uniform</label><input class="org-input" value="'+_esc(node.uniform||'')+'" oninput="hierNodeSet('+nodeIdx+',\'uniform\',this.value)"></div>' +
      '<div class="org-field"><label>Mission</label><textarea class="org-textarea" style="min-height:50px" oninput="hierNodeSet('+nodeIdx+',\'mission\',this.value)">'+_esc(node.mission||'')+'</textarea></div>' +
      '<div class="org-field"><label>Assignments</label><textarea class="org-textarea" style="min-height:50px" oninput="hierNodeSet('+nodeIdx+',\'assignments\',this.value)">'+_esc(node.assignments||'')+'</textarea></div>' +
      (function() {
        var org = _getActive(); if (!org) return '';
        var typs = org.offices.typicalOffices || [];
        if (!typs.length) return '';
        var opts = '<option value="">— None —</option>' + typs.map(function(t){
          return '<option value="'+t.id+'"'+(node.facilityTypeId===t.id?' selected':'')+'>'+_esc(t.name||'?')+'</option>';
        }).join('');
        return '<div class="org-field"><label>Facility Type (TLLO)</label><select class="org-select" style="width:100%" onchange="hierNodeSet('+nodeIdx+',\'facilityTypeId\',this.value)">'+opts+'</select></div>';
      })()
      + '<div class="org-field"><label>Card Image</label>' +
          (node.roleCardImage
            ? '<div style="display:flex;align-items:center;gap:6px"><img src="'+_esc(node.roleCardImage)+'" style="height:40px;object-fit:cover;border:1px solid #ddd"><button class="btn btn-sm" onclick="hierUploadRoleCardImage('+nodeIdx+')">Change</button><span class="org-rm" onclick="hierNodeSet('+nodeIdx+',\'roleCardImage\',null)">✕</span></div>'
            : '<button class="btn btn-sm" style="width:100%" onclick="hierUploadRoleCardImage('+nodeIdx+')">Upload Card Image…</button>') +
        '</div>'
      ;
  }

  el.innerHTML =
    '<div class="hier-edit-head">Edit Node <span class="hier-edit-close" onclick="hierSelectNode(null)">×</span></div>' +
    '<div class="hier-edit-body">' +
      '<div class="org-field"><label>Label / Name</label>' +
        '<input class="org-input" value="'+_esc(node.label||'')+'" oninput="hierNodeSet('+nodeIdx+',\'label\',this.value)">' +
      '</div>' +
      (node.type !== 'role' ? '<div class="org-field"><label>Title / Subtitle</label>' +
        '<input class="org-input" value="'+_esc(node.title||'')+'" oninput="hierNodeSet('+nodeIdx+',\'title\',this.value)">' +
      '</div>' : '') +
      '<div class="org-field-row">' +
        '<div class="org-field"><label>Clearance</label>' +
          '<select class="org-select" style="width:100%" onchange="hierNodeSet('+nodeIdx+',\'clearance\',this.value?parseInt(this.value):null)">' +
            '<option value="">—</option>' +
            [1,2,3,4,5,6,7,8,9].map(function(l){
              return '<option value="'+l+'"'+(node.clearance===l?' selected':'')+'>'+l+'</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="org-field"><label>Headcount</label>' +
          '<input type="number" min="0" class="org-input" value="'+_esc(String(node.headcount||''))+'" oninput="hierNodeSet('+nodeIdx+',\'headcount\',this.value?parseInt(this.value):null)">' +
        '</div>' +
      '</div>' +
      '<div class="org-field"><label>Type</label>' +
        '<select class="org-select" style="width:100%" onchange="hierNodeSet('+nodeIdx+',\'type\',this.value)">' +
          ['person','role','unit'].map(function(t){
            return '<option value="'+t+'"'+(node.type===t?' selected':'')+'>'+t.charAt(0).toUpperCase()+t.slice(1)+'</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      (function(){
        var groups = org.hierarchy.groups || [];
        if (!groups.length) return '';
        return '<div class="org-field"><label>Group</label>' +
          '<select class="org-select" style="width:100%" onchange="hierNodeSet('+nodeIdx+',\'groupId\',this.value||null)">' +
            '<option value="">— No group —</option>' +
            groups.map(function(g){
              return '<option value="'+_esc(g.id)+'"'+(node.groupId===g.id?' selected':'')+'>'+_esc(g.name||g.id)+(g.type?' ('+g.type+')':'')+'</option>';
            }).join('') +
          '</select>' +
        '</div>';
      })() +
      '<div class="org-field"><label>Color</label>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<input type="color" value="'+_esc(node.color||({'person':'#3a7bd5','role':'#666','unit':'#c44'}[node.type]||'#111'))+'" onchange="hierNodeSet('+nodeIdx+',\'color\',this.value)">' +
          (node.color ? '<span class="org-rm" onclick="hierNodeSet('+nodeIdx+',\'color\',null)" title="Reset to default">↺</span>' : '') +
        '</div>' +
      '</div>' +
      photoSection +
      roleFields +
      '<div class="org-field"><label>Notes</label>' +
        '<textarea class="org-textarea" style="min-height:60px" oninput="hierNodeSet('+nodeIdx+',\'notes\',this.value)">'+_esc(node.notes||'')+'</textarea>' +
      '</div>' +
      '<label class="org-settings-row"><input type="checkbox"'+(node.privateOnly?' checked':'')+' onchange="hierNodeSet('+nodeIdx+',\'privateOnly\',this.checked)"> Private (GM only)</label>' +
      (node.type === 'role' ?
        '<div class="hier-edit-section">Outfit</div>' +
        (node.outfit
          ? '<div style="font-family:var(--mono);font-size:12px;padding:4px 0">' + _esc(node.outfit.name||'Outfit') + ' <span class="org-rm" onclick="hierNodeSet('+nodeIdx+',\'outfit\',null)">✕</span></div>'
          : '<button class="btn btn-sm" style="width:100%" onclick="hierUploadOutfit('+nodeIdx+')">Link Outfit JSON…</button>')
        : '') +
      '<div class="hier-edit-section">Person assigned</div>' +
      (node.npcSheet
        ? (function() {
            var ns = node.npcSheet;
            var photoHtml = ns.photo
              ? '<img src="'+_esc(ns.photo)+'" style="width:32px;height:32px;object-fit:cover;border:1px solid #ddd;flex-shrink:0">'
              : '<div style="width:32px;height:32px;background:#555;display:flex;align-items:center;justify-content:center;font-family:var(--head);font-size:14px;color:#fff;flex-shrink:0">'+(ns.type||'?')[0].toUpperCase()+'</div>';
            return '<div class="hier-sheet-card">' +
              photoHtml +
              '<div><div class="hier-sheet-name">'+_esc(ns.type||'NPC')+'</div><div class="hier-sheet-role">'+_esc(ns.role||'')+'</div></div>' +
              '<span class="org-rm" style="margin-left:auto" onclick="hierUnlinkNpcSheet('+nodeIdx+')">✕</span>' +
            '</div>';
          })()
        : '<button class="btn btn-sm" style="width:100%" onclick="hierLinkNpcSheet('+nodeIdx+')">Link NPC Sheet…</button>') +
      (node.type === 'person' ?
        '<div class="hier-edit-section">Character Sheet</div>' +
        (cs ?
          '<div class="hier-sheet-card">' +
            (cs.photo ? '<img class="hier-sheet-photo" src="'+_esc(cs.photo)+'">' : '<div class="gen-person-avatar" style="width:32px;height:32px;font-size:14px">'+(cs.name||'?')[0]+'</div>') +
            '<div><div class="hier-sheet-name">'+_esc(cs.name||cs.handle||'')+'</div><div class="hier-sheet-role">'+_esc(cs.role||'')+'</div></div>' +
            '<span class="org-rm" style="margin-left:auto" onclick="hierUnlinkSheet('+nodeIdx+')">✕</span>' +
          '</div>'
          : '<button class="btn btn-sm" style="width:100%" onclick="hierLinkSheet('+nodeIdx+')">Link Character Sheet…</button>')
        : '') +
      '<div style="margin-top:auto;padding-top:12px;border-top:1px solid #eee;">' +
        '<button class="btn btn-sm btn-red" style="width:100%" onclick="hierDeleteNode(\''+id+'\')">Delete Node</button>' +
      '</div>' +
    '</div>';
}

function hierNodeSet(idx, field, val) {
  var org = _getActive(); if (!org) return;
  if (field === 'parentId' && val === '') val = null;
  org.hierarchy.nodes[idx][field] = val;
  _drawHierSVG();
  if (field === 'type' || field === 'parentId') {
    _renderHierEditPanel(org.hierarchy.nodes[idx].id);
  }
  _schedSave();
}

function hierUploadPhoto(nodeIdx) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      var org = _getActive(); if (!org) return;
      org.hierarchy.nodes[nodeIdx].photo = ev.target.result;
      _schedSave();
      _drawHierSVG();
      _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
    };
    r.readAsDataURL(f);
  };
  input.click();
}

function hierClearPhoto(nodeIdx) {
  var org = _getActive(); if (!org) return;
  org.hierarchy.nodes[nodeIdx].photo = null;
  _schedSave();
  _drawHierSVG();
  _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
}

function hierLinkSheet(nodeIdx) {
  var input = document.getElementById('char-sheet-import'); if (!input) return;
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      try {
        var cs = JSON.parse(ev.target.result);
        var org = _getActive(); if (!org) return;
        _schedSave();
        // Store full CS JSON for iframe loading
        org.hierarchy.nodes[nodeIdx].characterSheet = cs;
        _drawHierSVG(); _attachHierEvents();
        _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
      } catch(err) { alert('Invalid character sheet JSON'); }
    };
    r.readAsText(f);
    input.value = '';
  };
  input.click();
}

function hierLinkNpcSheet(nodeIdx) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      try {
        var npc = JSON.parse(ev.target.result);
        var org = _getActive(); if (!org) return;
        org.hierarchy.nodes[nodeIdx].npcSheet = npc;
        _schedSave();
        _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
      } catch(err) { alert('Invalid NPC sheet JSON'); }
    };
    r.readAsText(f);
  };
  input.click();
}

function hierUnlinkNpcSheet(nodeIdx) {
  var org = _getActive(); if (!org) return;
  org.hierarchy.nodes[nodeIdx].npcSheet = null;
  _schedSave();
  _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
}

function hierUnlinkSheet(nodeIdx) {
  var org = _getActive(); if (!org) return;
  org.hierarchy.nodes[nodeIdx].characterSheet = null;
  _schedSave();
  _drawHierSVG(); _attachHierEvents();
  _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
}

/* ─── Sheet modals ─── */
function _openCSModal(nodeId) {
  var org = _getActive(); if (!org) return;
  var node = org.hierarchy.nodes.filter(function(n){ return n.id===nodeId; })[0];
  if (!node || !node.characterSheet) return;
  var key = 'cs-' + _uid();
  sessionStorage.setItem(key, JSON.stringify(node.characterSheet));
  var overlay = document.createElement('div');
  overlay.className = 'org-modal-overlay';
  overlay.innerHTML =
    '<div class="org-modal" style="width:92vw;max-width:1140px;height:90vh;display:flex;flex-direction:column;padding:0;overflow:hidden">' +
      '<div class="org-modal-head" style="flex-shrink:0">' +
        _esc(node.label||'Character Sheet') +
        '<span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span>' +
      '</div>' +
      '<iframe src="cs.html?key='+encodeURIComponent(key)+'" style="flex:1;border:none;min-height:0;display:block;"></iframe>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
}

function _openNPCModal(nodeId) {
  var org = _getActive(); if (!org) return;
  var node = org.hierarchy.nodes.filter(function(n){ return n.id===nodeId; })[0];
  if (!node || !node.npcSheet) return;
  var key = 'npc-' + _uid();
  sessionStorage.setItem(key, JSON.stringify(node.npcSheet));
  var overlay = document.createElement('div');
  overlay.className = 'org-modal-overlay';
  overlay.innerHTML =
    '<div class="org-modal" style="width:92vw;max-width:1140px;height:90vh;display:flex;flex-direction:column;padding:0;overflow:hidden">' +
      '<div class="org-modal-head" style="flex-shrink:0">' +
        _esc(node.label||'NPC Sheet') +
        '<span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span>' +
      '</div>' +
      '<iframe src="npc-sheet.html?key='+encodeURIComponent(key)+'" style="flex:1;border:none;min-height:0;display:block;"></iframe>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
}

/* ─── View mode node info card ─── */
function _hierOpenNodeCard(id) {
  var org = _getActive(); if (!org) return;
  var node = org.hierarchy.nodes.filter(function(n){ return n.id===id; })[0]; if (!node) return;
  var existing = document.querySelector('.hier-node-card-overlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.className = 'hier-node-card-overlay org-modal-overlay';
  overlay.innerHTML = '<div class="org-modal hier-node-card" style="max-width:560px;width:90vw">' +
    '<div class="org-modal-head">'+_esc(node.label||'Node')+
      '<span class="org-modal-close" onclick="this.closest(\'.hier-node-card-overlay\').remove()">×</span>'+
    '</div>' +
    '<div class="org-modal-body" style="padding:0">'+_renderNodeCard(node, org)+'</div>'+
  '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
}

function _renderNodeCard(node, org) {
  var col = _nodeColor(node);
  var type = node.type;

  // Header strip
  var header = '<div style="display:flex;align-items:stretch;min-height:120px;">';

  // Photo / body image
  var photo = node.photo || (node.characterSheet && node.characterSheet.photo);
  if (photo && type === 'person') {
    header += '<div style="width:120px;min-width:120px;flex-shrink:0;overflow:hidden;border-right:2px solid #111;">' +
      '<img src="'+_esc(photo)+'" style="width:120px;height:100%;object-fit:cover;display:block;">'+
    '</div>';
  } else if (type === 'role' && node.roleCardImage) {
    header += '<div style="width:120px;min-width:120px;flex-shrink:0;overflow:hidden;border-right:2px solid #111;">' +
      '<img src="'+_esc(node.roleCardImage)+'" style="width:120px;height:100%;object-fit:cover;display:block;">'+
    '</div>';
  } else {
    header += '<div style="width:48px;min-width:48px;background:'+col+';display:flex;align-items:center;justify-content:center;flex-shrink:0;border-right:2px solid #111;">' +
      '<span style="font-family:var(--head);font-size:20px;color:#fff">'+{'person':'◉','role':'◎','department':'◼','team':'◧','special':'★'}[type]+'</span>'+
    '</div>';
  }

  // Info column
  header += '<div style="flex:1;padding:14px;display:flex;flex-direction:column;gap:6px;">';
  header += '<div style="font-family:var(--head);font-size:15px;letter-spacing:1px">'+_esc(node.label||'')+'</div>';
  if (node.title) header += '<div style="font-family:var(--mono);font-size:12px;color:var(--text2)">'+_esc(node.title)+'</div>';
  header += '<div><span style="font-family:var(--head);font-size:10px;letter-spacing:2px;color:#fff;padding:2px 7px;background:'+col+'">'+type.toUpperCase()+'</span></div>';

  if (type === 'person') {
    if (node.notes) header += '<div style="font-family:var(--mono);font-size:12px;color:#555;margin-top:4px">'+_esc(node.notes)+'</div>';
  }
  if (type === 'role') {
    if (node.pay) header += '<div style="font-family:var(--mono);font-size:13px;color:#1a7a2e;font-weight:bold">'+_esc(node.pay)+' eb</div>';
  }
  header += '</div></div>';

  var body = '';

  // Person: character sheet display
  if (type === 'person') {
    var cs = node.characterSheet;
    if (_privateMode && cs) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:14px;">';
      body += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
      body += '<span style="font-family:var(--head);font-size:11px;letter-spacing:2px;color:var(--text2)">CHARACTER SHEET</span>';
      body += '<button class="btn btn-sm" onclick="_openCSModal(\''+_esc(node.id)+'\')">Open Full Sheet</button>';
      body += '</div>';
      body += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
      if (cs.name)   body += _ncChip('Name',   cs.name);
      if (cs.handle) body += _ncChip('Handle', cs.handle);
      if (cs.role)   body += _ncChip('Role',   cs.role);
      if (cs.stats && Object.keys(cs.stats).length) {
        var statKeys = Object.keys(cs.stats);
        statKeys.forEach(function(k) { if (cs.stats[k]) body += _ncChip(k, cs.stats[k]); });
      }
      body += '</div></div>';
    } else if (node.notes) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:14px;">' +
        '<div style="font-family:var(--mono);font-size:13px;line-height:1.5;white-space:pre-wrap">'+_esc(node.notes)+'</div></div>';
    }
  }

  // Role: outfit display + info + NPC sheet button
  if (type === 'role') {
    var roleInfo = '';
    if (node.mission) roleInfo += '<div style="margin-bottom:6px"><span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">MISSION</span><div style="font-family:var(--mono);font-size:12px;margin-top:2px;white-space:pre-wrap">'+_esc(node.mission)+'</div></div>';
    if (node.assignments) roleInfo += '<div style="margin-bottom:6px"><span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">ASSIGNMENTS</span><div style="font-family:var(--mono);font-size:12px;margin-top:2px;white-space:pre-wrap">'+_esc(node.assignments)+'</div></div>';
    if (node.notes) roleInfo += '<div style="margin-bottom:6px"><span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">NOTES</span><div style="font-family:var(--mono);font-size:12px;margin-top:2px;white-space:pre-wrap">'+_esc(node.notes)+'</div></div>';

    var outfitHtml = '';
    if (node.outfit && node.outfit.items && node.outfit.items.length) {
      outfitHtml = _renderRoleOutfitBody(node.outfit);
    }

    if (roleInfo || outfitHtml) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:14px;display:flex;gap:20px;flex-wrap:wrap;">';
      if (outfitHtml) body += '<div style="flex-shrink:0">'+outfitHtml+'</div>';
      if (roleInfo) body += '<div style="flex:1;min-width:160px">'+roleInfo+'</div>';
      body += '</div>';
    }

    // NPC sheet link in private mode
    if (_privateMode && node.npcSheet) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:10px 14px;display:flex;align-items:center;gap:10px;">' +
        '<span style="font-family:var(--head);font-size:11px;letter-spacing:2px;color:var(--text2)">NPC SHEET</span>' +
        '<button class="btn btn-sm" onclick="_openNPCModal(\''+_esc(node.id)+'\')">Open NPC Sheet</button>' +
      '</div>';
    }
  }

  // Team / Department / Special: notes
  if (type === 'team' || type === 'department' || type === 'special') {
    var members = (org.hierarchy.nodes||[]).filter(function(n){ return n.parentId === node.id && (_privateMode || !n.privateOnly); });
    if (members.length) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:14px;">';
      body += '<div style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2);margin-bottom:8px">MEMBERS</div>';
      body += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      members.forEach(function(m) {
        var mPhoto = m.photo || (m.characterSheet && m.characterSheet.photo);
        body += '<div style="display:flex;align-items:center;gap:6px;border:1px solid #e0e0e0;padding:4px 8px;">' +
          (mPhoto ? '<img src="'+_esc(mPhoto)+'" style="width:24px;height:24px;object-fit:cover;">' :
            '<div style="width:24px;height:24px;background:'+_nodeColor(m)+';display:flex;align-items:center;justify-content:center;font-family:var(--head);font-size:13px;color:#fff;">'+(m.label||'?')[0]+'</div>') +
          '<div><div style="font-family:var(--head);font-size:12px;">'+_esc(m.label||'')+'</div><div style="font-family:var(--mono);font-size:10px;color:var(--text2)">'+_esc(m.type)+'</div></div>' +
        '</div>';
      });
      body += '</div></div>';
    }
    if (node.notes) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:14px;">' +
        '<div style="font-family:var(--mono);font-size:13px;line-height:1.5;white-space:pre-wrap">'+_esc(node.notes)+'</div></div>';
    }
  }

  // TLLO facility link
  if (type === 'role' && node.facilityTypeId) {
    var tllo = (org.offices.typicalOffices||[]).filter(function(t){ return t.id===node.facilityTypeId; })[0];
    if (tllo) {
      body += '<div style="border-top:1px solid #e0e0e0;padding:10px 14px;display:flex;align-items:center;gap:8px;">' +
        '<span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">FACILITY TYPE</span>' +
        '<span style="font-family:var(--head);font-size:12px">'+_esc(tllo.name)+'</span>'+
      '</div>';
    }
  }

  return header + body;
}

function _ncChip(label, val) {
  return '<div style="display:flex;flex-direction:column;min-width:60px;">' +
    '<span style="font-family:var(--head);font-size:9px;letter-spacing:1px;color:var(--text2)">'+_esc(label)+'</span>' +
    '<span style="font-family:var(--mono);font-size:13px;font-weight:bold">'+_esc(String(val))+'</span>' +
  '</div>';
}

function _renderRoleOutfitBody(outfit) {
  var items = outfit.items || [];
  var LOCS = ['head','torso','rarm','larm','rleg','lleg'];
  var LOC_NAMES = { head:'Head', torso:'Torso', rarm:'R.Arm', larm:'L.Arm', rleg:'R.Leg', lleg:'L.Leg' };
  // SP per location
  var spByLoc = {};
  LOCS.forEach(function(loc){ spByLoc[loc] = 0; });
  items.forEach(function(it) {
    if (!it.locs) return;
    LOCS.forEach(function(loc){ if (it.locs[loc] && it.sp) spByLoc[loc] += it.sp; });
  });
  // Zone positions scaled to 120px wide body
  var zones = [
    { loc:'head',  top:3,   left:null, right:null, center:true },
    { loc:'torso', top:64,  left:null, right:null, center:true },
    { loc:'rarm',  top:55,  left:1,    right:null, center:false },
    { loc:'larm',  top:55,  left:null, right:1,    center:false },
    { loc:'rleg',  top:145, left:19,   right:null, center:false },
    { loc:'lleg',  top:145, left:null, right:19,   center:false }
  ];
  var overlays = zones.map(function(z) {
    var sp = spByLoc[z.loc];
    var col = sp > 0 ? 'rgba(58,123,213,0.55)' : 'rgba(0,0,0,0.08)';
    var pos = 'position:absolute;top:'+z.top+'px;';
    if (z.center) pos += 'left:50%;transform:translateX(-50%);text-align:center;';
    else if (z.left != null) pos += 'left:'+z.left+'px;';
    else pos += 'right:'+z.right+'px;text-align:right;';
    return '<div style="'+pos+'background:'+col+';padding:1px 3px;font-family:var(--head);font-size:9px;letter-spacing:1px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none">' +
      (sp > 0 ? LOC_NAMES[z.loc]+' SP'+sp : '') +
    '</div>';
  }).join('');

  var itemList = items.map(function(it) {
    var coveredLocs = LOCS.filter(function(loc){ return it.locs && it.locs[loc]; });
    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #f5f5f5;">' +
      '<span style="font-family:var(--mono);font-size:12px;flex:1">'+_esc(it.name||'')+'</span>' +
      (it.sp ? '<span style="font-family:var(--head);font-size:11px;color:#3a7bd5;font-weight:bold">SP'+it.sp+'</span>' : '') +
      (coveredLocs.length ? '<span style="font-family:var(--mono);font-size:10px;color:#aaa">'+coveredLocs.map(function(l){ return LOC_NAMES[l]; }).join('·')+'</span>' : '') +
    '</div>';
  }).join('');

  return '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">' +
    '<div style="position:relative;width:120px;height:225px;flex-shrink:0;">' +
      '<img src="img/body2.png" style="position:absolute;top:4px;left:50%;transform:translateX(-50%);height:212px;opacity:0.15;pointer-events:none;">' +
      overlays +
    '</div>' +
    (items.length ? '<div style="flex:1;min-width:140px;"><div style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2);margin-bottom:4px">'+_esc(outfit.name||'Outfit')+'</div>'+itemList+'</div>' : '') +
  '</div>';
}

function hierUploadOutfit(nodeIdx) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      try {
        var outfit = JSON.parse(ev.target.result);
        var org = _getActive(); if (!org) return;
        org.hierarchy.nodes[nodeIdx].outfit = { name: outfit.name||'Outfit', items: outfit.items||[] };
        _schedSave();
        _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
      } catch(err) { alert('Invalid outfit JSON'); }
    };
    r.readAsText(f);
  };
  input.click();
}

function hierUploadRoleCardImage(nodeIdx) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      var org = _getActive(); if (!org) return;
      org.hierarchy.nodes[nodeIdx].roleCardImage = ev.target.result;
      _schedSave();
      _renderHierEditPanel(org.hierarchy.nodes[nodeIdx].id);
    };
    r.readAsDataURL(f);
  };
  input.click();
}

function addHierNode(type) {
  var org = _getActive(); if (!org) return;
  // Only valid leaf types
  if (type !== 'person' && type !== 'role' && type !== 'unit') {
    console.warn('addHierNode: unknown type', type); return;
  }
  var n = { id:_uid(), type:type, label:'New '+type, title:'', notes:'', privateOnly:false, characterSheet:null, parentId:null, photo:null,
    clearance:null, headcount:null, npcSheet:null, groupId:null,
    x: 100 + Math.random()*200, y: 100 + Math.random()*100 };
  if (type === 'role') { n.pay = ''; n.uniform = ''; n.mission = ''; n.assignments = ''; n.facilityTypeId = null; n.outfit = null; n.roleCardImage = null; }

  // Assign a default grid position (free cell near col 0 at bottom)
  var existingNodes = org.hierarchy.nodes;
  var allRows = existingNodes.filter(function(x) { return x.gridRow !== undefined; });
  var maxRow = allRows.length ? Math.max.apply(null, allRows.map(function(x) { return x.gridRow; })) : 1;
  var col = 0;
  var attempts = 0;
  while (_hierCellOccupied(col, maxRow, null, existingNodes) && attempts < 20) {
    col = attempts % 2 === 0 ? Math.ceil(attempts/2) : -Math.ceil(attempts/2);
    attempts++;
  }
  if (_hierCellOccupied(col, maxRow, null, existingNodes)) { maxRow++; col = 0; }
  n.gridCol = col;
  n.gridRow = maxRow;

  org.hierarchy.nodes.push(n);
  _schedSave();
  _drawHierSVG();
  hierSelectNode(n.id);
}

function hierDeleteNode(id) {
  if (!confirm('Delete this node?')) return;
  var org = _getActive(); if (!org) return;
  // Promote children to top-level (don't cascade-delete)
  org.hierarchy.nodes.forEach(function(n){ if (n.parentId === id) n.parentId = null; });
  org.hierarchy.nodes = org.hierarchy.nodes.filter(function(n){ return n.id!==id; });
  org.hierarchy.edges = org.hierarchy.edges.filter(function(e){ return e.from!==id && e.to!==id; });
  _hierSelected = null;
  _schedSave();
  _drawHierSVG();
  var el = document.getElementById('hier-edit-panel');
  if (el) el.innerHTML = '<div class="hier-edit-empty">Click a node to edit it.</div>';
}

function hierZoom(factor) {
  _hierZoom = Math.max(0.1, Math.min(5, _hierZoom * factor));
  var g = document.getElementById('hier-g');
  if (g) g.setAttribute('transform','translate('+_hierPan.x+','+_hierPan.y+') scale('+_hierZoom+')');
}

function hierAutoLayout() {
  var org = _getActive(); if (!org) return;
  var nodes = org.hierarchy.nodes || [];
  var edges = org.hierarchy.edges || [];
  if (!nodes.length) return;

  var H_GAP   = 28;
  var V_GAP   = 70;
  var V_PAD   = 40;
  var H_GAP_I = 8; // gap between team members inside outline

  var byId = {};
  nodes.forEach(function(n){ byId[n.id] = n; });
  _hierAllNodes = nodes;

  // Build adjacency from edges
  var children = {}, hasParent = {};
  nodes.forEach(function(n) { children[n.id] = []; });
  edges.forEach(function(e) {
    if (children[e.from] && children[e.from].indexOf(e.to) < 0) {
      children[e.from].push(e.to);
      hasParent[e.to] = true;
    }
  });

  // Roots = nodes with no incoming edges
  var roots = nodes.filter(function(n) { return !hasParent[n.id]; });
  if (!roots.length && nodes.length) roots = [nodes[0]];

  // Subtree width in grid cells (1 cell per leaf)
  var stW = {};
  function computeStW(id) {
    var kids = children[id] || [];
    if (!kids.length) return stW[id] = 1;
    var total = 0;
    kids.forEach(function(k) { total += computeStW(k); });
    return stW[id] = total;
  }
  roots.forEach(function(r) { computeStW(r.id); });

  // Compute depth (= gridRow)
  var depth = {};
  function computeDepth(id, d) {
    depth[id] = d;
    (children[id] || []).forEach(function(k) { computeDepth(k, d + 1); });
  }
  roots.forEach(function(r) { computeDepth(r.id, 1); });

  // Assign gridCol by distributing subtree widths
  var gridColMap = {};
  function assignGridCol(id, startCol) {
    gridColMap[id] = startCol + Math.floor((stW[id] || 1) / 2);
    var sc = startCol;
    (children[id] || []).forEach(function(k) {
      assignGridCol(k, sc);
      sc += stW[k] || 1;
    });
  }
  var totalW = roots.reduce(function(acc, r) { return acc + (stW[r.id] || 1); }, 0);
  var startGridCol = -Math.floor(totalW / 2);
  roots.forEach(function(r) {
    assignGridCol(r.id, startGridCol);
    startGridCol += stW[r.id] || 1;
  });

  nodes.forEach(function(n) {
    n.gridCol = gridColMap[n.id] !== undefined ? gridColMap[n.id] : 0;
    n.gridRow = depth[n.id] !== undefined ? depth[n.id] : 1;
  });

  _schedSave();
  _drawHierSVG();
  _attachHierEvents();
}

/* ═══════════════════════════════════════════════
   OFFICES & FACILITIES TAB — world map + sidebar
   ═══════════════════════════════════════════════ */
var _offDrag      = null;   // { id } — sidebar→map drag
var _markerDrag   = null;   // { id, moved } — marker drag on map
var _regionDraw   = null;   // { startX, startY, curX, curY } — region drawing
var _regionMode   = false;
var _typOffPlace  = null;   // typical office id being placed on map

function _hexRgba(hex, alpha) {
  hex = String(hex||'').replace('#','');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r = parseInt(hex.substr(0,2),16) || 0;
  var g = parseInt(hex.substr(2,2),16) || 0;
  var b = parseInt(hex.substr(4,2),16) || 0;
  return 'rgba('+r+','+g+','+b+','+alpha+')';
}

function _getHierDeptColor(departmentId) {
  if (!departmentId) return null;
  var org = _getActive(); if (!org) return null;
  var g = (org.hierarchy.groups||[]).filter(function(g){ return g.id === departmentId; })[0];
  return g ? (g.color || '#111') : null;
}

function _renderTlloRoleLink(t, field, label) {
  var org = _getActive(); if (!org) return '';
  var roles = (org.hierarchy.nodes||[]).filter(function(n){ return n.type === 'role'; });
  if (_viewMode) {
    var linked = roles.filter(function(n){ return n.id === t[field]; })[0];
    if (!linked) return '';
    return '<div class="typ-off-role-row">'
      + '<span class="typ-off-role-label">'+label+'</span>'
      + '<span style="font-family:var(--head);font-size:12px">'+_esc(linked.label||'?')+'</span>'
      + '</div>';
  }
  var opts = '<option value="">— None —</option>' + roles.map(function(n){
    return '<option value="'+n.id+'"'+(t[field]===n.id?' selected':'')+'>'+_esc(n.label||'?')+'</option>';
  }).join('');
  return '<div class="typ-off-role-row">'
    + '<span class="typ-off-role-label">'+label+'</span>'
    + '<select class="org-select" style="flex:1;font-size:11px" onchange="typOffSet(\''+t.id+'\',\''+field+'\',this.value)">'+opts+'</select>'
    + '</div>';
}

function _renderTlloViewEntry(t, col) {
  var imgPreview = t.image
    ? '<img src="'+_esc(t.image)+'" style="max-width:120px;max-height:80px;object-fit:cover;border:1px solid #ddd;display:block;margin-top:4px">'
    : '';
  var planPreview = (_privateMode && t.floorPlan)
    ? '<img src="'+_esc(t.floorPlan)+'" style="max-width:120px;max-height:80px;object-fit:cover;border:1px solid #ddd;display:block;margin-top:4px">'
    : '';
  var ptCount = (t.mapPoints||[]).length;
  var roleLinks = _renderTlloRoleLink(t,'roleManager','Manager') + _renderTlloRoleLink(t,'roleEmployee','Employee') + _renderTlloRoleLink(t,'roleSecurity','Security');
  return '<div class="typ-off-entry" style="border-left:3px solid '+col+'">' +
    '<div class="typ-off-entry-head">' +
      '<span class="typ-off-dot-sm" style="background:'+col+'"></span>' +
      '<span style="font-family:var(--head);font-size:13px;flex:1">'+_esc(t.name||'')+'</span>' +
    '</div>' +
    '<div class="typ-off-entry-body">' +
      '<div class="org-field-row">' +
        (t.description ? '<div class="org-field"><label>Description</label><div class="org-view-text">'+_esc(t.description)+'</div></div>' : '') +
        (t.staffStructure ? '<div class="org-field"><label>Staff Structure</label><div class="org-view-text">'+_esc(t.staffStructure)+'</div></div>' : '') +
        (t.security ? '<div class="org-field"><label>Security</label><div class="org-view-text">'+_esc(t.security)+'</div></div>' : '') +
      '</div>' +
      ((imgPreview || planPreview) ? '<div class="org-field-row" style="margin-top:6px">' +
        (imgPreview ? '<div class="org-field"><label>Image</label>'+imgPreview+'</div>' : '') +
        (planPreview ? '<div class="org-field"><label>Floor Plan</label>'+planPreview+'</div>' : '') +
      '</div>' : '') +
      (ptCount ? '<div style="font-family:var(--mono);font-size:11px;color:var(--text2);padding:6px 0">'+ptCount+' map point'+(ptCount>1?'s':'')+'</div>' : '') +
      (roleLinks ? '<div class="typ-off-roles">'+roleLinks+'</div>' : '') +
    '</div>' +
  '</div>';
}

function renderOffices(context) {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.offices.regions) org.offices.regions = [];
  if (!org.offices.typicalOffices) org.offices.typicalOffices = [];
  if (!org.offices.mapType) org.offices.mapType = org.type === 'groupe' ? 'nightcity' : 'world';

  var isTerritoire = context === 'territoire';
  var isAgency     = context === 'agency';
  var facilLabel   = isTerritoire ? 'HIDEOUTS & POINTS' : isAgency ? 'STATIONS & POSTS' : 'FACILITIES';
  var typLabel     = isTerritoire ? 'TERRAIN TYPES'     : isAgency ? 'PATROL ZONES'        : 'TYPICAL OFFICES';
  var mapImg       = org.offices.mapType === 'nightcity' ? 'img/nightcity-map.png' : 'img/orgmap.png';

  var locs = org.offices.locations || [];
  var visible = locs.filter(function(l){ return _privateMode || !l.privateOnly; });
  var typs = org.offices.typicalOffices;

  // ── Sidebar top: Facilities ──
  var facSideHtml = visible.length ? visible.map(function(l) {
    var realIdx = locs.indexOf(l);
    var num = realIdx + 1;
    var placed = l.mapX != null && l.mapY != null;
    return '<div class="off-side-item' + (placed ? ' placed' : ' unplaced') + '" '
      + (!_viewMode ? 'draggable="true" ondragstart="officesItemDragStart(event,\''+l.id+'\')" ' : '')
      + 'onclick="officesEdit(\''+l.id+'\')">'
      + '<span class="off-side-num">'+num+'</span>'
      + '<span class="off-side-name">'+_esc(l.name||'Unnamed')+'</span>'
      + (l.isHQ ? '<span class="off-side-badge hq">HQ</span>' : '')
      + (l.privateOnly ? '<span class="off-side-badge priv">P</span>' : '')
      + (!_viewMode && !placed ? '<span class="off-side-drag-hint">drag →</span>' : '')
      + '</div>';
  }).join('') : '<div class="org-empty-hint" style="padding:10px 8px">No facilities yet.</div>';

  // ── Sidebar bottom: Typical offices (colored by dept group) ──
  var depts = (org.hierarchy.groups||[]).filter(function(g){ return g.type === 'department'; });
  var typSideHtml = typs.length ? typs.map(function(t) {
    var col = _getHierDeptColor(t.departmentId) || '#555';
    var ptCount = (t.mapPoints||[]).length;
    var isPlacing = _typOffPlace === t.id;
    return '<div class="off-side-item off-side-typ'+(ptCount?' placed':' unplaced')+(isPlacing?' placing':'')+'" '
      + 'style="border-left:3px solid '+col+'" '
      + 'onclick="typOffOpenEdit(\''+t.id+'\')">'
      + '<span class="off-side-typ-dot" style="background:'+col+'"></span>'
      + '<span class="off-side-name">'+_esc(t.name||'Unnamed')+'</span>'
      + (ptCount ? '<span style="font-family:var(--mono);font-size:11px;color:#888;flex-shrink:0">×'+ptCount+'</span>' : '')
      + (!_viewMode ? '<span class="off-side-place-btn" title="'+(isPlacing?'Stop placing':'Place on map — click to add dots')+'" '
        + 'onclick="event.stopPropagation();typOffTogglePlace(\''+t.id+'\')">'+(isPlacing?'✕':'⊕')+'</span>' : '')
      + '</div>';
  }).join('') : '<div class="org-empty-hint" style="padding:10px 8px">No typical offices.</div>';

  // ── Map: regular markers ──
  var markersHtml = locs.map(function(l, i) {
    if (l.mapX == null || l.mapY == null) return '';
    if (!_privateMode && l.privateOnly) return '';
    var num = i + 1;
    return '<div class="map-marker'+(l.isHQ?' hq':l.isKey?' key':'')+'" data-id="'+l.id+'" '
      + 'style="left:'+l.mapX+'%;top:'+l.mapY+'%" '
      + 'onmousedown="markerMouseDown(event,\''+l.id+'\')" '
      + 'onclick="event.stopPropagation();officesEdit(\''+l.id+'\')" '
      + 'title="'+_esc(l.name||'')+'">'+num+'</div>';
  }).join('');

  // ── Map: typical office dots (colored, multiple per entry) ──
  var typDotsHtml = typs.map(function(t) {
    var col = _getHierDeptColor(t.departmentId) || '#555';
    return (t.mapPoints||[]).map(function(pt, pi) {
      return '<div class="map-typ-dot" data-id="'+t.id+'" data-pt="'+pi+'" '
        + 'style="left:'+pt.x+'%;top:'+pt.y+'%;background:'+col+';border-color:'+col+'" '
        + 'onmousedown="typDotMouseDown(event,\''+t.id+'\','+pi+')" '
        + 'oncontextmenu="typDotRemove(event,\''+t.id+'\','+pi+')" '
        + 'title="'+_esc(t.name||'')+' (right-click to remove)"><span class="map-typ-dot-x">×</span></div>';
    }).join('');
  }).join('');

  // ── Map: regions ──
  var regionsHtml = (org.offices.regions||[]).map(function(r) {
    var col = r.color || '#3a7bd5';
    return '<div class="map-region" data-id="'+r.id+'" '
      + 'style="left:'+r.x+'%;top:'+r.y+'%;width:'+r.w+'%;height:'+r.h+'%;'
      + 'background:'+_hexRgba(col,0.12)+';border-color:'+col+';" '
      + 'onclick="event.stopPropagation();officesEditRegion(\''+r.id+'\')">'
      + '<span class="map-region-name" style="background:'+col+'">'+_esc(r.name||'')+'</span>'
      + '</div>';
  }).join('');

  var canvasMode = _regionMode ? ' region-mode' : (_typOffPlace ? ' place-mode' : '');
  var toolbarHint = _viewMode ? 'read only'
    : _regionMode ? 'click and drag to draw a region'
    : _typOffPlace ? 'click on the map to place — ✕ in sidebar to cancel'
    : 'drag facilities from sidebar • drag markers to reposition';

  // ── Typical offices bottom list ──
  var typListHtml = _viewMode
    ? typs.map(function(t) {
        var col = _getHierDeptColor(t.departmentId) || '#555';
        return _renderTlloViewEntry(t, col);
      }).join('')
    : typs.map(function(t) {
      var col = _getHierDeptColor(t.departmentId) || '#555';
      var deptOpts = '<option value="">— No department —</option>' +
        depts.map(function(d){ return '<option value="'+d.id+'"'+(t.departmentId===d.id?' selected':'')+'>'+_esc(d.name||'?')+'</option>'; }).join('');
      var imgPreview = t.image
        ? '<img src="'+_esc(t.image)+'" style="max-width:120px;max-height:80px;object-fit:cover;border:1px solid #ddd;display:block;margin-top:4px">'
        : '';
      var planPreview = t.floorPlan
        ? '<img src="'+_esc(t.floorPlan)+'" style="max-width:120px;max-height:80px;object-fit:cover;border:1px solid #ddd;display:block;margin-top:4px">'
        : '';
      return '<div class="typ-off-entry" style="border-left:3px solid '+col+'">' +
        '<div class="typ-off-entry-head">' +
          '<span class="typ-off-dot-sm" style="background:'+col+'"></span>' +
          '<input class="org-input" style="flex:1" value="'+_esc(t.name||'')+'" placeholder="Office type name" onchange="typOffSet(\''+t.id+'\',\'name\',this.value)">' +
          '<select class="org-select" style="min-width:120px;font-size:11px" onchange="typOffSet(\''+t.id+'\',\'departmentId\',this.value)">'+deptOpts+'</select>' +
          '<span class="org-rm" style="margin-left:4px" onclick="typOffDelete(\''+t.id+'\')">✕</span>' +
        '</div>' +
        '<div class="typ-off-entry-body">' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Description</label><textarea class="org-textarea" style="min-height:60px" oninput="typOffSet(\''+t.id+'\',\'description\',this.value)">'+_esc(t.description||'')+'</textarea></div>' +
            '<div class="org-field"><label>Staff Structure</label><textarea class="org-textarea" style="min-height:60px" oninput="typOffSet(\''+t.id+'\',\'staffStructure\',this.value)">'+_esc(t.staffStructure||'')+'</textarea></div>' +
            '<div class="org-field"><label>Security</label><textarea class="org-textarea" style="min-height:60px" oninput="typOffSet(\''+t.id+'\',\'security\',this.value)">'+_esc(t.security||'')+'</textarea></div>' +
          '</div>' +
          '<div class="org-field-row" style="margin-top:6px">' +
            '<div class="org-field">' +
              '<label>Image</label>' +
              '<button class="btn btn-sm" onclick="typOffUpload(\''+t.id+'\',\'image\')">'+(t.image?'Change…':'Upload…')+'</button>' +
              (t.image ? '<span class="org-rm" onclick="typOffSet(\''+t.id+'\',\'image\',\'\')">✕</span>' : '') +
              imgPreview +
            '</div>' +
            '<div class="org-field">' +
              '<label>Floor Plan</label>' +
              '<button class="btn btn-sm" onclick="typOffUpload(\''+t.id+'\',\'floorPlan\')">'+(t.floorPlan?'Change…':'Upload…')+'</button>' +
              (t.floorPlan ? '<span class="org-rm" onclick="typOffSet(\''+t.id+'\',\'floorPlan\',\'\')">✕</span>' : '') +
              planPreview +
            '</div>' +
            '<div class="org-field">' +
              '<label>Map points</label>' +
              ((t.mapPoints||[]).length
                ? '<span style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+(t.mapPoints.length)+' point'+(t.mapPoints.length>1?'s':'')+' placed</span><br>' +
                  '<a href="#" style="font-family:var(--mono);font-size:11px" onclick="typOffClearPoints(\''+t.id+'\');event.preventDefault()">clear all</a>'
                : '<span style="font-family:var(--mono);font-size:11px;color:#bbb">None — use ⊕ in sidebar</span>') +
            '</div>' +
          '</div>' +
          '<div class="typ-off-roles">' +
            _renderTlloRoleLink(t, 'roleManager',  'Manager') +
            _renderTlloRoleLink(t, 'roleEmployee', 'Employee') +
            _renderTlloRoleLink(t, 'roleSecurity', 'Security') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

  var mapToggleHtml = (isTerritoire || isAgency) ? '<div class="map-type-toggle">' +
    ['world','nightcity'].map(function(mt) {
      var label = mt === 'nightcity' ? 'Night City' : 'World';
      return '<button class="map-type-btn'+(org.offices.mapType===mt?' active':'')+'" onclick="setMapType(\''+mt+'\')">'+label+'</button>';
    }).join('') +
  '</div>' : '';

  var tlloHead = isTerritoire ? 'Terrain Types'    : isAgency ? 'Patrol Zones'        : 'Typical Low-Level Offices';

  el.innerHTML = '<div class="offices-outer"><div class="offices-map-layout">' +
    // ── Sidebar ──
    '<div class="offices-side">' +
      '<div class="offices-side-head"><span>'+facilLabel+'</span>'+(!_viewMode?'<button class="btn btn-sm" onclick="officesAddFacility()">+</button>':'')+'</div>' +
      '<div class="offices-side-list">'+facSideHtml+'</div>' +
      '<div class="offices-side-head" style="border-top:2px solid #111"><span>'+typLabel+'</span>'+(!_viewMode?'<button class="btn btn-sm" onclick="addTypicalOffice()">+</button>':'')+'</div>' +
      '<div class="offices-side-list">'+typSideHtml+'</div>' +
    '</div>' +
    // ── Map ──
    '<div class="offices-map-wrap">' +
      '<div class="offices-map-toolbar">' +
        mapToggleHtml +
        (!_viewMode ? '<button class="btn btn-sm'+(_regionMode?' btn-cy':'')+'" onclick="toggleRegionMode()">'+(_regionMode?'✕ Cancel region':'+ Region')+'</button>' : '') +
        '<span style="font-size:11px;color:var(--text2);margin-left:8px">'+toolbarHint+'</span>' +
      '</div>' +
      '<div class="offices-map-canvas'+canvasMode+'" ondragover="officesMapDragOver(event)" ondrop="officesMapDrop(event)">' +
        '<div class="offices-map-fallback">[ map image missing ]</div>' +
        '<div class="map-image-wrap" id="map-image-wrap" '
          + 'onmousedown="officesMapMouseDown(event)" onmousemove="officesMapMouseMove(event)" '
          + 'onmouseup="officesMapMouseUp(event)" onmouseleave="officesMapMouseUp(event)">' +
          '<img src="'+mapImg+'" class="offices-map-img" '
            + 'onload="this.parentElement.classList.add(\'loaded\')" '
            + 'onerror="this.style.display=\'none\'">' +
          regionsHtml + markersHtml + typDotsHtml +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>' +
  // ── Bottom: typical offices list ──
  '<div class="offices-bottom">' +
    '<div class="org-section">' +
      '<div class="org-section-head">'+tlloHead+(!_viewMode?'<span class="org-section-add" onclick="addTypicalOffice()">＋</span>':'')+'</div>' +
      '<div class="org-section-body tllo-grid">' +
        (typs.length ? typListHtml : '<div class="org-empty-hint">No types defined.</div>') +
      '</div>' +
    '</div>' +
  '</div>' +
'</div>';
}

function setMapType(mt) {
  var org = _getActive(); if (!org) return;
  org.offices.mapType = mt;
  _schedSave();
  var type = org.type;
  if (type === 'groupe') renderTerritoryRelations(); else if (type === 'agency') renderJuridiction(); else renderOffices();
}

function officeSet(idx, field, val) { var org = _getActive(); if (!org) return; org.offices.locations[idx][field]=val; _schedSave(); }

function facilityUpload(idx, field) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      var org = _getActive(); if (!org) return;
      org.offices.locations[idx][field] = ev.target.result;
      // Refresh modal preview
      var overlay = document.querySelector('.org-modal-overlay');
      if (overlay) { overlay.remove(); officesEdit(org.offices.locations[idx].id); }
    };
    r.readAsDataURL(f);
  };
  input.click();
}

function officesAddFacility() {
  var name = prompt('Facility name:'); if (!name) return;
  var org = _getActive(); if (!org) return;
  org.offices.locations = org.offices.locations || [];
  org.offices.locations.push({ id:_uid(), name:name, city:'', country:'', type:'', description:'',
    staffCount:'', securityLevel:'', isHQ:false, isKey:false, privateOnly:false, mapX:null, mapY:null });
  renderOffices();
}

function officesDeleteFacility(id) {
  var org = _getActive(); if (!org) return;
  org.offices.locations = (org.offices.locations||[]).filter(function(l){ return l.id !== id; });
  renderOffices();
}

function officesEdit(id) {
  var org = _getActive(); if (!org) return;
  var idx = (org.offices.locations||[]).map(function(l){return l.id;}).indexOf(id);
  if (idx < 0) return;
  var l = org.offices.locations[idx];

  // View mode: show static info card
  if (_viewMode) {
    _facilityViewCard(l);
    return;
  }

  var modal = document.createElement('div');
  modal.className = 'org-modal-overlay';
  modal.innerHTML = '<div class="org-modal" style="max-width:600px">' +
    '<div class="org-modal-head">Facility — '+_esc(l.name||'Unnamed')+'<span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span></div>' +
    '<div class="org-modal-body" style="padding:0">' +
    '<div style="display:flex;gap:0;min-height:160px">' +
      '<div class="facility-img-panel" onclick="facilityUpload('+idx+',\'image\')" title="Click to upload image">' +
        (l.image
          ? '<img src="'+_esc(l.image)+'" style="width:100%;height:100%;object-fit:cover">'
          : '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#ccc;font-family:var(--head);font-size:10px;letter-spacing:1px;gap:4px"><span style="font-size:20px">⊞</span><span>IMAGE</span></div>') +
      '</div>' +
      '<div style="flex:1;padding:14px;display:flex;flex-direction:column;gap:8px">' +
        '<div class="org-field-row">' +
          '<div class="org-field"><label>Name</label><input class="org-input" value="'+_esc(l.name||'')+'" onchange="officeSet('+idx+',\'name\',this.value);renderOffices()"></div>' +
          '<div class="org-field"><label>City</label><input class="org-input" value="'+_esc(l.city||'')+'" onchange="officeSet('+idx+',\'city\',this.value)"></div>' +
          '<div class="org-field"><label>Country</label><input class="org-input" value="'+_esc(l.country||'')+'" onchange="officeSet('+idx+',\'country\',this.value)"></div>' +
        '</div>' +
        '<div class="org-field-row">' +
          '<div class="org-field"><label>Type</label><input class="org-input" value="'+_esc(l.type||'')+'" placeholder="HQ / Lab / Safe house..." onchange="officeSet('+idx+',\'type\',this.value)"></div>' +
          '<div class="org-field"><label>Staff Count</label><input class="org-input" value="'+_esc(l.staffCount||'')+'" onchange="officeSet('+idx+',\'staffCount\',this.value)"></div>' +
          '<div class="org-field"><label>Security</label><input class="org-input" value="'+_esc(l.securityLevel||'')+'" onchange="officeSet('+idx+',\'securityLevel\',this.value)"></div>' +
        '</div>' +
        '<div class="org-field"><label>Description</label><textarea class="org-textarea" oninput="officeSet('+idx+',\'description\',this.value)">'+_esc(l.description||'')+'</textarea></div>' +
        '<div class="org-field"><label>Floor Plan</label>' +
          '<button class="btn btn-sm" onclick="facilityUpload('+idx+',\'floorPlan\')">'+(l.floorPlan?'Change…':'Upload…')+'</button>' +
          (l.floorPlan ? ' <span class="org-rm" onclick="officeSet('+idx+',\'floorPlan\',\'\');renderOffices()">✕</span><br><img src="'+_esc(l.floorPlan||'')+'" style="max-width:140px;max-height:90px;object-fit:cover;border:1px solid #ddd;display:block;margin-top:4px">' : '') +
        '</div>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap">' +
          '<label class="org-settings-row"><input type="checkbox"'+(l.isHQ?' checked':'')+' onchange="officeSet('+idx+',\'isHQ\',this.checked);renderOffices()"> Headquarters</label>' +
          '<label class="org-settings-row"><input type="checkbox"'+(l.isKey?' checked':'')+' onchange="officeSet('+idx+',\'isKey\',this.checked);renderOffices()"> Key Facility</label>' +
          '<label class="org-settings-row"><input type="checkbox"'+(l.privateOnly?' checked':'')+' onchange="officeSet('+idx+',\'privateOnly\',this.checked);renderOffices()"> Private (GM only)</label>' +
        '</div>' +
        (l.mapX != null
          ? '<div style="font-family:var(--mono);font-size:11px;color:var(--text2);margin-top:6px">Map position: '+l.mapX.toFixed(1)+'%, '+l.mapY.toFixed(1)+'% — <a href="#" onclick="officeSet('+idx+',\'mapX\',null);officeSet('+idx+',\'mapY\',null);this.closest(\'.org-modal-overlay\').remove();renderOffices();return false">remove from map</a></div>'
          : '<div style="font-family:var(--mono);font-size:11px;color:var(--text2);margin-top:6px">Not placed on map. Drag from sidebar to position.</div>') +
        '<div class="org-card-actions">' +
          '<button class="btn btn-sm btn-red" onclick="if(confirm(\'Delete this facility?\')){officesDeleteFacility(\''+id+'\');this.closest(\'.org-modal-overlay\').remove()}">Delete</button>' +
        '</div>' +
      '</div>' + // close inner fields div
    '</div>' +   // close two-column row
    '</div>';    // close modal body
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
}

function _facilityViewCard(l) {
  var modal = document.createElement('div');
  modal.className = 'org-modal-overlay';
  var imgPanel = l.image
    ? '<div style="width:160px;min-width:160px;height:160px;flex-shrink:0;overflow:hidden;border-right:2px solid #111;">' +
        '<img src="'+_esc(l.image)+'" style="width:160px;height:160px;object-fit:cover;display:block;">'+
      '</div>'
    : '';
  var floorPlan = (_privateMode && l.floorPlan)
    ? '<div style="border-top:1px solid #e0e0e0;padding:12px;"><div style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2);margin-bottom:6px">FLOOR PLAN</div><img src="'+_esc(l.floorPlan)+'" style="max-width:100%;max-height:200px;object-fit:contain;border:1px solid #ddd;display:block;"></div>'
    : '';
  modal.innerHTML = '<div class="org-modal" style="max-width:560px;width:90vw">' +
    '<div class="org-modal-head">'+_esc(l.name||'Facility')+
      (l.isHQ ? '<span style="font-family:var(--head);font-size:10px;letter-spacing:1px;background:#c44;color:#fff;padding:2px 6px;margin-left:8px">HQ</span>' : '') +
      '<span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span>' +
    '</div>' +
    '<div class="org-modal-body" style="padding:0">' +
      '<div style="display:flex;align-items:stretch;min-height:'+(l.image?'160px':'0px')+';">' +
        imgPanel +
        '<div style="flex:1;padding:14px;display:flex;flex-direction:column;gap:8px;">' +
          (l.type ? '<div><span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">TYPE</span> <span style="font-family:var(--head);font-size:12px">'+_esc(l.type)+'</span></div>' : '') +
          (l.city || l.country ? '<div style="font-family:var(--mono);font-size:13px">'+[l.city,l.country].filter(Boolean).map(_esc).join(', ')+'</div>' : '') +
          (l.staffCount ? '<div><span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">STAFF</span> <span style="font-family:var(--mono);font-size:13px">'+_esc(l.staffCount)+'</span></div>' : '') +
          (l.securityLevel ? '<div><span style="font-family:var(--head);font-size:10px;letter-spacing:1px;color:var(--text2)">SECURITY</span> <span style="font-family:var(--mono);font-size:13px">'+_esc(l.securityLevel)+'</span></div>' : '') +
          (l.description ? '<div style="font-family:var(--mono);font-size:13px;line-height:1.5;color:#555;white-space:pre-wrap">'+_esc(l.description)+'</div>' : '') +
        '</div>' +
      '</div>' +
      floorPlan +
    '</div>' +
  '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
}

/* Region edit modal */
function officesEditRegion(id) {
  if (_viewMode) return;
  var org = _getActive(); if (!org) return;
  var idx = (org.offices.regions||[]).map(function(r){return r.id;}).indexOf(id);
  if (idx < 0) return;
  var r = org.offices.regions[idx];

  var modal = document.createElement('div');
  modal.className = 'org-modal-overlay';
  modal.innerHTML = '<div class="org-modal">' +
    '<div class="org-modal-head">Edit Region<span class="org-modal-close" onclick="this.closest(\'.org-modal-overlay\').remove()">×</span></div>' +
    '<div class="org-modal-body">' +
      '<div class="org-field"><label>Name</label><input class="org-input" value="'+_esc(r.name||'')+'" onchange="_getActive().offices.regions['+idx+'].name=this.value;renderOffices()"></div>' +
      '<div class="org-field"><label>Color</label><input type="color" value="'+_esc(r.color||'#3a7bd5')+'" onchange="_getActive().offices.regions['+idx+'].color=this.value;renderOffices()"></div>' +
      '<div class="org-card-actions">' +
        '<button class="btn btn-sm btn-red" onclick="if(confirm(\'Delete region?\')){_getActive().offices.regions.splice('+idx+',1);renderOffices();this.closest(\'.org-modal-overlay\').remove()}">Delete</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
}

/* Drag from sidebar onto map */
function officesItemDragStart(e, id) {
  _offDrag = { id: id };
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', id); } catch(_) {}
}
function officesMapDragOver(e) {
  if (!_offDrag) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function officesMapDrop(e) {
  if (_viewMode) return;
  if (!_offDrag) return;
  e.preventDefault();
  var wrap = document.getElementById('map-image-wrap'); if (!wrap) { _offDrag = null; return; }
  var rect = wrap.getBoundingClientRect();
  var x = (e.clientX - rect.left) / rect.width  * 100;
  var y = (e.clientY - rect.top)  / rect.height * 100;
  if (x < 0 || x > 100 || y < 0 || y > 100) { _offDrag = null; return; }
  var org = _getActive(); if (!org) { _offDrag = null; return; }
  var idx = org.offices.locations.map(function(l){return l.id;}).indexOf(_offDrag.id);
  if (idx >= 0) { org.offices.locations[idx].mapX = x; org.offices.locations[idx].mapY = y; }
  _offDrag = null;
  _schedSave();
  renderOffices();
}

/* Marker drag on map */
function markerMouseDown(e, id) {
  if (_viewMode) return;
  if (e.button !== 0) return;
  if (_regionMode || _typOffPlace) return;
  e.stopPropagation();
  _markerDrag = { id: id, moved: false };
}

/* Map mouse handlers (region drawing & marker drag movement/end) */
function officesMapMouseDown(e) {
  if (_viewMode) return;
  if (e.button !== 0) return;
  var wrap = document.getElementById('map-image-wrap'); if (!wrap) return;
  var rect = wrap.getBoundingClientRect();
  var x = (e.clientX - rect.left) / rect.width  * 100;
  var y = (e.clientY - rect.top)  / rect.height * 100;
  if (_typOffPlace) {
    // Place a new point for this typical office type
    var org = _getActive(); if (!org) return;
    var t = (org.offices.typicalOffices||[]).filter(function(t){ return t.id===_typOffPlace; })[0];
    if (t) { if (!t.mapPoints) t.mapPoints=[]; t.mapPoints.push({ id:_uid(), x:x, y:y }); _schedSave(); }
    renderOffices();
    return;
  }
  if (!_regionMode) return;
  _regionDraw = { startX:x, startY:y, curX:x, curY:y };
}
function officesMapMouseMove(e) {
  var wrap = document.getElementById('map-image-wrap'); if (!wrap) return;
  var rect = wrap.getBoundingClientRect();
  var x = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width  * 100));
  var y = Math.max(0, Math.min(100, (e.clientY - rect.top)  / rect.height * 100));

  if (_markerDrag) {
    _markerDrag.moved = true;
    var org = _getActive(); if (!org) return;
    if (_markerDrag.isTyp) {
      var t = (org.offices.typicalOffices||[]).filter(function(t){ return t.id===_markerDrag.id; })[0];
      if (t && t.mapPoints[_markerDrag.ptIdx]) { t.mapPoints[_markerDrag.ptIdx].x = x; t.mapPoints[_markerDrag.ptIdx].y = y; }
      var dot = wrap.querySelector('.map-typ-dot[data-id="'+_markerDrag.id+'"][data-pt="'+_markerDrag.ptIdx+'"]');
      if (dot) { dot.style.left = x+'%'; dot.style.top = y+'%'; }
    } else {
      var idx = org.offices.locations.map(function(l){return l.id;}).indexOf(_markerDrag.id);
      if (idx < 0) return;
      org.offices.locations[idx].mapX = x;
      org.offices.locations[idx].mapY = y;
      var marker = wrap.querySelector('.map-marker[data-id="'+_markerDrag.id+'"]');
      if (marker) { marker.style.left = x+'%'; marker.style.top = y+'%'; }
    }
  } else if (_regionDraw) {
    _regionDraw.curX = x; _regionDraw.curY = y;
    var preview = document.getElementById('region-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'region-preview';
      preview.className = 'map-region-preview';
      wrap.appendChild(preview);
    }
    var minX = Math.min(_regionDraw.startX, x);
    var minY = Math.min(_regionDraw.startY, y);
    preview.style.left   = minX + '%';
    preview.style.top    = minY + '%';
    preview.style.width  = Math.abs(x - _regionDraw.startX) + '%';
    preview.style.height = Math.abs(y - _regionDraw.startY) + '%';
  }
}
function officesMapMouseUp(e) {
  if (_markerDrag) {
    var moved = _markerDrag.moved;
    _markerDrag = null;
    if (moved) { _schedSave(); renderOffices(); }
    return;
  }
  if (!_regionDraw) return;
  var rd = _regionDraw; _regionDraw = null;
  var preview = document.getElementById('region-preview');
  if (preview) preview.remove();
  var minX = Math.min(rd.startX, rd.curX), minY = Math.min(rd.startY, rd.curY);
  var w = Math.abs(rd.curX - rd.startX), h = Math.abs(rd.curY - rd.startY);
  if (w < 2 || h < 2) { _regionMode = false; renderOffices(); return; }
  var name = prompt('Region name:');
  if (!name) { _regionMode = false; renderOffices(); return; }
  var org = _getActive(); if (!org) return;
  var palette = ['#3a7bd5','#c44','#1a7a2e','#b8860b','#7b4','#777','#5a4','#a45'];
  var color = palette[(org.offices.regions||[]).length % palette.length];
  org.offices.regions = org.offices.regions || [];
  org.offices.regions.push({ id:_uid(), name:name, color:color, x:minX, y:minY, w:w, h:h });
  _regionMode = false;
  _schedSave();
  renderOffices();
}
function toggleRegionMode() { _regionMode = !_regionMode; _typOffPlace = null; renderOffices(); }

/* ── Typical office functions ── */
function addTypicalOffice() {
  var org = _getActive(); if (!org) return;
  if (!org.offices.typicalOffices) org.offices.typicalOffices = [];
  org.offices.typicalOffices.push({ id:_uid(), name:'New Office Type', description:'', staffStructure:'', security:'', image:'', floorPlan:'', departmentId:null, mapPoints:[] });
  _schedSave();
  renderOffices();
}

function typOffSet(id, field, val) {
  var org = _getActive(); if (!org) return;
  var t = (org.offices.typicalOffices||[]).filter(function(x){ return x.id===id; })[0]; if (!t) return;
  t[field] = val;
  _schedSave();
  if (field === 'departmentId' || field === 'image' || field === 'floorPlan') renderOffices();
}

function typOffDelete(id) {
  if (!confirm('Delete this office type?')) return;
  var org = _getActive(); if (!org) return;
  org.offices.typicalOffices = (org.offices.typicalOffices||[]).filter(function(t){ return t.id!==id; });
  if (_typOffPlace === id) _typOffPlace = null;
  _schedSave();
  renderOffices();
}

function typOffUpload(id, field) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) { typOffSet(id, field, ev.target.result); };
    r.readAsDataURL(f);
  };
  input.click();
}

function typOffTogglePlace(id) {
  _typOffPlace = (_typOffPlace === id) ? null : id;
  _regionMode = false;
  renderOffices();
}
function typOffClearPoints(id) {
  var org = _getActive(); if (!org) return;
  var t = (org.offices.typicalOffices||[]).filter(function(x){ return x.id===id; })[0]; if (!t) return;
  t.mapPoints = [];
  _schedSave();
  renderOffices();
}

function typOffOpenEdit(id) {
  // Scroll to the entry in the bottom list
  var entries = document.querySelectorAll('.typ-off-entry');
  var org = _getActive(); if (!org) return;
  var idx = (org.offices.typicalOffices||[]).map(function(t){return t.id;}).indexOf(id);
  if (idx >= 0 && entries[idx]) entries[idx].scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* Typical office dot drag on map */
function typDotMouseDown(e, typId, ptIdx) {
  if (_viewMode) return;
  if (e.button !== 0) return;
  if (_regionMode || _typOffPlace) return;
  e.stopPropagation();
  _markerDrag = { id: typId, ptIdx: ptIdx, moved: false, isTyp: true };
}
function typDotRemove(e, typId, ptIdx) {
  e.preventDefault(); e.stopPropagation();
  var org = _getActive(); if (!org) return;
  var t = (org.offices.typicalOffices||[]).filter(function(t){ return t.id===typId; })[0]; if (!t) return;
  t.mapPoints.splice(ptIdx, 1);
  _schedSave();
  renderOffices();
}

/* ═══════════════════════════════════════════════
   MISSIONS & PRODUCTS TAB
   ═══════════════════════════════════════════════ */
var _AVAIL = ['Common','Uncommon','Rare','Restricted','Illegal'];

function renderProducts() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;

  var allItems = org.products.items || [];
  var visible  = allItems.filter(function(p){ return _privateMode || !p.isPrivate; });

  // Collect unique named subcats
  var seen = {}, subcatOrder = [];
  visible.forEach(function(p){
    var s = (p.subcat||'').trim();
    if (s && !seen[s]) { seen[s]=true; subcatOrder.push(s); }
  });
  subcatOrder.sort();

  // Datalist for subcat autocomplete
  var datalist = '<datalist id="prod-subcat-list">'+subcatOrder.map(function(s){
    return '<option value="'+_esc(s)+'">';
  }).join('')+'</datalist>';

  function _prodCard(p) {
    var realIdx = allItems.indexOf(p);
    var availClass = p.availability==='Illegal'?'illegal':p.availability==='Restricted'?'restricted':'';

    if (_viewMode) {
      return '<div class="prod-card'+(p.isPrivate?' prod-private':'')+(p.image?' prod-has-img':'')+'">' +
        (p.image ? '<div class="prod-card-img-wrap"><img class="prod-card-img" src="'+_esc(p.image)+'" alt=""></div>' : '') +
        '<div class="prod-card-body">' +
          '<div class="prod-card-name">'+_esc(p.name||'—')+'</div>' +
          (p.category ? '<div class="prod-card-cat">'+_esc(p.category)+'</div>' : '') +
          (p.description ? '<div class="prod-card-desc">'+_esc(p.description)+'</div>' : '') +
          '<div class="prod-card-footer">' +
            (p.price ? '<span class="prod-card-price">'+_esc(p.price)+'</span>' : '<span></span>') +
            '<span class="prod-avail '+availClass+'">'+_esc(p.availability||'')+'</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return '<div class="prod-card prod-card-edit'+(p.isPrivate?' prod-private':'')+(p.image?' prod-has-img':'')+'">' +
      '<div class="prod-card-img-wrap">' +
        (p.image
          ? '<img class="prod-card-img" src="'+_esc(p.image)+'" alt="">' +
            '<div class="prod-card-img-actions">' +
              '<button class="btn btn-sm" style="font-size:10px;padding:2px 5px" onclick="prodUploadImage('+realIdx+')">↺</button>' +
              '<span class="org-rm" style="background:#fff;border-radius:2px;padding:1px 4px" onclick="prodSet('+realIdx+',\'image\',\'\');renderProducts()">✕</span>' +
            '</div>'
          : '<div class="prod-card-img-placeholder" onclick="prodUploadImage('+realIdx+')"><span>+ Image</span></div>'
        ) +
      '</div>' +
      '<div class="prod-card-body">' +
        '<input class="prod-card-name-edit" value="'+_esc(p.name||'')+'" placeholder="Name" oninput="prodSet('+realIdx+',\'name\',this.value)">' +
        '<input class="prod-card-cat-edit" value="'+_esc(p.category||'')+'" placeholder="Category / Type" oninput="prodSet('+realIdx+',\'category\',this.value)">' +
        '<textarea class="prod-card-desc-edit" placeholder="Description" oninput="prodSet('+realIdx+',\'description\',this.value)">'+_esc(p.description||'')+'</textarea>' +
        '<div class="prod-card-price-row">' +
          '<input class="prod-card-price-edit" value="'+_esc(p.price||'')+'" placeholder="Price" oninput="prodSet('+realIdx+',\'price\',this.value)">' +
          '<select class="prod-avail-select" onchange="prodSet('+realIdx+',\'availability\',this.value)">'+_AVAIL.map(function(a){ return '<option'+(p.availability===a?' selected':'')+'>'+a+'</option>'; }).join('')+'</select>' +
        '</div>' +
        '<div class="prod-card-edit-row">' +
          '<input class="prod-card-subcat-edit" list="prod-subcat-list" value="'+_esc(p.subcat||'')+'" placeholder="Département..." oninput="prodSet('+realIdx+',\'subcat\',this.value)">' +
          (_privateMode ? '<label class="prod-private-lbl"><input type="checkbox"'+(p.isPrivate?' checked':'')+' onchange="prodSet('+realIdx+',\'isPrivate\',this.checked);renderProducts()"> Privé</label>' : '') +
          '<span class="org-rm" onclick="removeProd('+realIdx+')">✕</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _prodGroup(subcat, items) {
    var label = subcat || 'General';
    var head = '<div class="prod-group-head">' +
      '<span class="prod-group-label">'+_esc(label)+'</span>' +
      (!_viewMode ? '<span class="org-section-add" style="margin-left:8px;font-size:15px" onclick="addProdToGroup(\''+_esc(subcat)+'\')">＋</span>' : '') +
    '</div>';
    var cards = items.map(_prodCard).join('');
    return '<div class="prod-group">' + head +
      '<div class="prod-grid">'+cards+'</div>' +
    '</div>';
  }

  var groups = '';
  var uncat = visible.filter(function(p){ return !(p.subcat||'').trim(); });
  if (uncat.length || !subcatOrder.length || !_viewMode) {
    groups += _prodGroup('', uncat);
  }
  subcatOrder.forEach(function(s){
    groups += _prodGroup(s, visible.filter(function(p){ return (p.subcat||'').trim()===s; }));
  });

  el.innerHTML = datalist +
    '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Products & Services' +
        (!_viewMode ? '<span class="org-section-add" onclick="addProdToGroup(\'\')">＋</span>' : '') +
      '</div>' +
      '<div class="org-section-body" style="padding:14px">' +
        (visible.length || !_viewMode
          ? '<div class="prod-groups">'+groups+'</div>'
          : '<div class="org-empty-hint">No products listed.</div>') +
      '</div>' +
    '</div>' +
    '</div>';
}
function prodSet(idx, field, val) { var org = _getActive(); if (!org) return; org.products.items[idx][field]=val; _schedSave(); }
function addProd() { addProdToGroup(''); }
function addProdToGroup(subcat) {
  var org = _getActive(); if (!org) return;
  org.products.items.push({ id:_uid(), name:'', category:'', description:'', price:'', availability:'Common', isPrivate:false, image:'', subcat:subcat||'' });
  renderProducts();
}
function removeProd(idx) { var org = _getActive(); if (!org) return; org.products.items.splice(idx,1); renderProducts(); }
function prodUploadImage(idx) {
  var input = document.createElement('input');
  input.type='file'; input.accept='image/*';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(ev) {
      var org = _getActive(); if (!org) return;
      org.products.items[idx].image = ev.target.result;
      _schedSave(); renderProducts();
    };
    r.readAsDataURL(f);
  };
  input.click();
}

/* ═══════════════════════════════════════════════
   MARKET REPORT / STRATEGY TAB
   ═══════════════════════════════════════════════ */
function renderMarket() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  var pub = org.market.publicData  || {};
  var prv = org.market.privateData || {};

  var rangeBtns = ['1W','1M','3M','1Y','5Y'].map(function(r) {
    return '<div class="market-range-btn'+(r===_stockRange?' active':'')+'" onclick="setStockRange(\''+r+'\')">'+r+'</div>';
  }).join('');

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="market-wrap">' +
      '<div class="market-chart-section">' +
        '<div class="market-chart-head">' +
          '<span class="market-symbol">'+_esc(org.market.stockSymbol||org.name.slice(0,4).toUpperCase())+'</span>' +
          '<span class="market-price" id="mkt-price">—</span>' +
          '<span class="market-change" id="mkt-change"></span>' +
        '</div>' +
        '<div class="market-range-btns">'+rangeBtns+'</div>' +
        '<canvas id="market-canvas" width="560" height="220"></canvas>' +
      '</div>' +
      '<div class="market-data-section">' +
        '<div class="org-section-head" style="margin-bottom:8px">Public Data</div>' +
        (_viewMode?_mktRowView('Revenue',   pub.revenue||''):_mktRow('Revenue',   'revenue',   pub.revenue   || '', false)) +
        (_viewMode?_mktRowView('Employees', pub.employees||''):_mktRow('Employees', 'employees', pub.employees || '', false)) +
        (_viewMode?_mktRowView('Founded',   pub.founded||''):_mktRow('Founded',   'founded',   pub.founded   || '', false)) +
        (_viewMode
          ? (pub.notes ? '<div class="org-field" style="margin-top:8px"><label>Notes</label><div class="org-view-text">'+_esc(pub.notes)+'</div></div>' : '')
          : '<div class="org-field" style="margin-top:8px"><label>Notes</label><textarea class="org-textarea" style="min-height:60px" oninput="org.market.publicData.notes=this.value">'+_esc(pub.notes||'')+'</textarea></div>') +
        (_privateMode ? '<div class="market-private-section" style="margin-top:12px">' +
          '<div class="market-private-head">🔒 Strategy (GM Only)</div>' +
          (_viewMode?_mktRowView('Real Revenue',       prv.realRevenue||''):_mktRow('Real Revenue',       'realRevenue',       prv.realRevenue||'',       true)) +
          (_viewMode?_mktRowView('Margins',            prv.margins||''):_mktRow('Margins',            'margins',           prv.margins||'',           true)) +
          (_viewMode?_mktRowView('Capital Allocation', prv.capitalAllocation||''):_mktRow('Capital Allocation', 'capitalAllocation', prv.capitalAllocation||'', true)) +
          (_viewMode?_mktRowView('Covert Budget',      prv.covertBudget||''):_mktRow('Covert Budget',      'covertBudget',      prv.covertBudget||'',      true)) +
          (_viewMode
            ? (prv.notes ? '<div class="org-field" style="margin-top:8px"><label>Private Notes</label><div class="org-view-text org-view-text-private">'+_esc(prv.notes)+'</div></div>' : '')
            : '<div class="org-field" style="margin-top:8px"><label>Private Notes</label><textarea class="org-textarea org-textarea-private" style="min-height:60px" oninput="org.market.privateData.notes=this.value">'+_esc(prv.notes||'')+'</textarea></div>') +
        '</div>' : '') +
      '</div>' +
    '</div>' +
  '</div>';

  _drawStockChart(org);
}

function _mktRow(label, field, val, isPrivate) {
  var path = isPrivate ? 'org.market.privateData' : 'org.market.publicData';
  return '<div class="market-data-row">' +
    '<span class="market-data-label">'+label+'</span>' +
    '<input class="org-input" style="text-align:right;max-width:120px;font-weight:bold" value="'+_esc(val)+'" onchange="'+path+'.'+field+'=this.value">' +
  '</div>';
}
function _mktRowView(label, val) {
  return '<div class="market-data-row">' +
    '<span class="market-data-label">'+label+'</span>' +
    '<span style="font-family:var(--mono);font-size:13px;font-weight:bold;text-align:right">'+_esc(val||'—')+'</span>' +
  '</div>';
}

function setStockRange(r) { _stockRange = r; var org = _getActive(); _drawStockChart(org); var btns = document.querySelectorAll('.market-range-btn'); btns.forEach(function(b){ b.classList.toggle('active', b.textContent===r); }); }

function _generateStock(seed, days, base) {
  var rng = _seededRng(seed);
  var price = base || 100;
  var data  = [price];
  var mu = 0.0003, sigma = 0.013;
  for (var i = 1; i < days; i++) {
    var u1 = Math.max(1e-10, rng()), u2 = rng();
    var z = Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2);
    price *= Math.exp((mu - sigma*sigma/2) + sigma*z);
    if (rng() < 0.015) price *= (1 + (rng()-0.5)*0.12);
    price = Math.max(0.5, price);
    data.push(Math.round(price*100)/100);
  }
  return data;
}

function _drawStockChart(org) {
  var canvas = document.getElementById('market-canvas'); if (!canvas) return;
  var ctx    = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var rangeDays = { '1W':7, '1M':30, '3M':90, '1Y':365, '5Y':1825 };
  var days      = rangeDays[_stockRange] || 30;
  var seed      = (org.name||'x') + (org.market.stockSymbol||'');
  var fullData  = _generateStock(seed, 1825, org.market.basePrice||100);
  var data      = fullData.slice(fullData.length - days);

  ctx.clearRect(0,0,W,H);

  var pad = { t:10, r:50, b:30, l:10 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var volH = cH * 0.18;
  var priceH = cH - volH - 8;

  var mn = Math.min.apply(null, data), mx = Math.max.apply(null, data);
  var range = mx - mn || 1;

  function toX(i) { return pad.l + (i/(data.length-1))*cW; }
  function toY(v) { return pad.t + priceH - ((v-mn)/range)*priceH; }

  // Grid
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1;
  for (var gi = 0; gi <= 4; gi++) {
    var gy = pad.t + (gi/4)*priceH;
    ctx.beginPath(); ctx.moveTo(pad.l,gy); ctx.lineTo(pad.l+cW,gy); ctx.stroke();
    var gv = mx - (gi/4)*range;
    ctx.fillStyle='#999'; ctx.font='9px Space Mono,monospace';
    ctx.textAlign='left'; ctx.fillText(gv.toFixed(1), pad.l+cW+4, gy+3);
  }

  // Gradient fill
  var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t+priceH);
  var isUp = data[data.length-1] >= data[0];
  grad.addColorStop(0, isUp ? 'rgba(26,122,46,0.18)' : 'rgba(192,57,43,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(toX(0), pad.t+priceH);
  data.forEach(function(v,i){ ctx.lineTo(toX(i), toY(v)); });
  ctx.lineTo(toX(data.length-1), pad.t+priceH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Price line
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(data[0]));
  data.forEach(function(v,i){ ctx.lineTo(toX(i), toY(v)); });
  ctx.strokeStyle = isUp ? '#1a7a2e' : '#c0392b';
  ctx.lineWidth = 1.5; ctx.stroke();

  // Volume bars (fake: proportional to |price change|)
  var volBase = pad.t + priceH + 8;
  var maxVol  = 0;
  var vols    = data.map(function(v,i){ var d = i>0?Math.abs(v-data[i-1]):0; maxVol=Math.max(maxVol,d); return d; });
  ctx.fillStyle = 'rgba(100,100,100,0.3)';
  var barW = Math.max(1, cW/data.length - 1);
  vols.forEach(function(v,i) {
    var bh = maxVol > 0 ? (v/maxVol)*volH : 0;
    ctx.fillRect(toX(i)-barW/2, volBase+volH-bh, barW, bh);
  });

  // Date labels
  ctx.fillStyle='#bbb'; ctx.font='9px Space Mono,monospace'; ctx.textAlign='center';
  [0, Math.floor(data.length/2), data.length-1].forEach(function(i) {
    var daysAgo = data.length-1-i;
    var d = new Date(); d.setDate(d.getDate()-daysAgo);
    var label = _stockRange==='5Y'||_stockRange==='1Y'
      ? d.toLocaleDateString('en',{month:'short',year:'2-digit'})
      : d.toLocaleDateString('en',{month:'short',day:'numeric'});
    ctx.fillText(label, toX(i), H-8);
  });

  // Update price display
  var last = data[data.length-1], first = data[0];
  var pct  = ((last-first)/first*100);
  var pEl  = document.getElementById('mkt-price'), cEl = document.getElementById('mkt-change');
  if (pEl) pEl.textContent = last.toFixed(2) + ' eb';
  if (cEl) {
    cEl.textContent = (pct>=0?'+':'') + pct.toFixed(2) + '%';
    cEl.className   = 'market-change ' + (pct>=0?'up':'down');
  }
}

/* ═══════════════════════════════════════════════
   JOB OPENINGS TAB
   ═══════════════════════════════════════════════ */
var _jobOpen = {};
var _RISK    = ['Low','Medium','High','Extreme'];
var _PAY_PERIOD = ['per mission','per week','per month','per year'];

function renderJobs() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  var jobs = (org.jobs.openings||[]).filter(function(j){ return _privateMode || !j.isPrivate; });

  var cardsHtml = jobs.length ? jobs.map(function(j) {
    var realIdx = org.jobs.openings.indexOf(j);
    var open    = !!_jobOpen[j.id];
    var riskCls = (j.risk||'low').toLowerCase();
    var cardBody = _viewMode
      ? '<div class="job-card-body'+(open?' open':'')+'">' +
          '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">' +
            (j.department ? '<div><label>Department</label><div class="org-view-text">'+_esc(j.department)+'</div></div>' : '') +
            (j.pay ? '<div><label>Pay</label><div class="org-view-text">'+_esc(j.pay)+' eb '+(j.payPeriod?_esc(j.payPeriod):'')+'</div></div>' : '') +
            (j.duration ? '<div><label>Duration</label><div class="org-view-text">'+_esc(j.duration)+'</div></div>' : '') +
          '</div>' +
          (j.requirements ? '<div class="org-field"><label>Requirements</label><div class="org-view-text">'+_esc(j.requirements)+'</div></div>' : '') +
          (j.description ? '<div class="org-field"><label>Description</label><div class="org-view-text">'+_esc(j.description)+'</div></div>' : '') +
        '</div>'
      : '<div class="job-card-body'+(open?' open':'')+'">' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Title</label><input class="org-input" value="'+_esc(j.title||'')+'" onchange="jobSet('+realIdx+',\'title\',this.value)"></div>' +
            '<div class="org-field"><label>Department</label><input class="org-input" value="'+_esc(j.department||'')+'" onchange="jobSet('+realIdx+',\'department\',this.value)"></div>' +
          '</div>' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Pay (eb)</label><input class="org-input" value="'+_esc(j.pay||'')+'" onchange="jobSet('+realIdx+',\'pay\',this.value)"></div>' +
            '<div class="org-field"><label>Pay Period</label><select class="org-select" style="width:100%" onchange="jobSet('+realIdx+',\'payPeriod\',this.value)">'+_PAY_PERIOD.map(function(p){ return '<option'+(j.payPeriod===p?' selected':'')+'>'+p+'</option>'; }).join('')+'</select></div>' +
            '<div class="org-field"><label>Risk</label><select class="org-select" style="width:100%" onchange="jobSet('+realIdx+',\'risk\',this.value)">'+_RISK.map(function(r){ return '<option'+(j.risk===r?' selected':'')+'>'+r+'</option>'; }).join('')+'</select></div>' +
          '</div>' +
          '<div class="org-field"><label>Requirements</label><textarea class="org-textarea" style="min-height:50px" oninput="jobSet('+realIdx+',\'requirements\',this.value)">'+_esc(j.requirements||'')+'</textarea></div>' +
          '<div class="org-field"><label>Description</label><textarea class="org-textarea" oninput="jobSet('+realIdx+',\'description\',this.value)">'+_esc(j.description||'')+'</textarea></div>' +
          '<div class="org-field"><label>Duration</label><input class="org-input" value="'+_esc(j.duration||'')+'" placeholder="e.g. One night, Ongoing..." onchange="jobSet('+realIdx+',\'duration\',this.value)"></div>' +
          (_privateMode ? '<label class="org-settings-row"><input type="checkbox"'+(j.isPrivate?' checked':'')+' onchange="jobSet('+realIdx+',\'isPrivate\',this.checked)"> Covert / Private</label>' : '') +
          '<div class="org-card-actions"><button class="btn btn-sm btn-red" onclick="removeJob('+realIdx+')">Delete</button></div>' +
        '</div>';
    return '<div class="job-card'+(j.isPrivate?' job-private':'')+'">' +
      '<div class="job-card-head" onclick="toggleJob(\''+j.id+'\')">' +
        '<span class="job-title">'+_esc(j.title||'Untitled Position')+'</span>' +
        (j.department ? '<span style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+_esc(j.department)+'</span>' : '') +
        (j.pay ? '<span class="job-pay">'+_esc(j.pay)+' eb</span>' : '') +
        '<span class="job-risk '+riskCls+'">'+(j.risk||'Low')+'</span>' +
        '<span style="font-size:13px;color:#bbb;margin-left:4px">'+(open?'▲':'▼')+'</span>' +
      '</div>' +
      cardBody +
    '</div>';
  }).join('') : '<div class="org-empty-hint">No openings listed.</div>';

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Job Openings '+(!_viewMode?'<span class="org-section-add" onclick="addJob()">＋</span>':'')+'</div>' +
      '<div class="org-section-body">'+cardsHtml+'</div>' +
    '</div>' +
  '</div>';
}
function toggleJob(id) { _jobOpen[id] = !_jobOpen[id]; renderJobs(); }
function jobSet(idx, field, val) { var org = _getActive(); if (!org) return; org.jobs.openings[idx][field]=val; _schedSave(); }
function addJob() {
  var org = _getActive(); if (!org) return;
  var j = { id:_uid(), title:'', department:'', pay:'', payPeriod:'per mission', risk:'Low', requirements:'', description:'', duration:'', isPrivate:false };
  org.jobs.openings.push(j);
  _jobOpen[j.id] = true;
  renderJobs();
}
function removeJob(idx) { if (!confirm('Delete this job?')) return; var org = _getActive(); if (!org) return; org.jobs.openings.splice(idx,1); renderJobs(); }

/* ═══════════════════════════════════════════════
   HIERARCHY — NETWORK MODE
   ═══════════════════════════════════════════════ */
function hierToggleNetworkMode() {
  var org = _getActive(); if (!org) return;
  org.hierarchyMode = org.hierarchyMode === 'network' ? 'tree' : 'network';
  _schedSave();
  renderHierarchy();
}

/* ═══════════════════════════════════════════════
   GROUPE — RÉPUTATION
   ═══════════════════════════════════════════════ */
function renderReputation() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  var rep = org.reputation || {};
  var gangColor = (rep.colors && rep.colors.primary) || rep.color || '#c44';

  var topFigures = (org.hierarchy.nodes||[]).filter(function(n){
    return n.type === 'person' && (_privateMode || !n.privateOnly);
  }).slice(0,6);
  var figuresHtml = topFigures.length ? topFigures.map(function(n) {
    var cs = n.characterSheet;
    return '<div class="gen-person-card">' +
      (cs && cs.photo ? '<img class="gen-person-photo" src="'+_esc(cs.photo)+'">'
        : '<div class="gen-person-avatar">'+(n.label||'?')[0].toUpperCase()+'</div>') +
      '<div><div class="gen-person-name">'+_esc(n.label||'')+'</div><div class="gen-person-title">'+_esc(n.title||'')+'</div></div>' +
    '</div>';
  }).join('') : '<div class="org-empty-hint">Add people in the Hierarchy tab.</div>';

  // Cyberpsycho bar
  var cyber = rep.cyberpsychos || { registered:0, onEdge:0 };
  var regPct = Math.min(100, Math.max(0, parseInt(cyber.registered)||0));
  var edgePct = Math.min(100, Math.max(0, parseInt(cyber.onEdge)||0));
  var totalPct = Math.min(100, regPct + edgePct);
  // Color: 0-30 = green, 31-60 = orange, 61-100 = red
  var barColor = totalPct <= 30 ? '#2a9d4e' : totalPct <= 60 ? '#e07b00' : '#c44';
  var dangerBadge = totalPct > 50 ? '<span class="cyber-danger-badge">⚠ UNSTABLE</span>' : '';
  var cyberBar = '<div class="cyber-bar-wrap">' +
    '<div class="cyber-bar-track"><div class="cyber-bar-fill" style="width:'+totalPct+'%;background:'+barColor+'"></div></div>' +
    '<div class="cyber-bar-labels">' +
      '<span class="cyber-bar-stat" style="color:'+barColor+'">'+regPct+'% registered</span>' +
      '<span class="cyber-bar-dot">•</span>' +
      '<span class="cyber-bar-stat" style="color:'+barColor+'">'+edgePct+'% on edge</span>' +
      dangerBadge +
    '</div>' +
  '</div>';

  // Gang color swatch + tag display for view mode
  var colorSwatchView = '<div class="gang-color-swatch-row">' +
    '<div class="gang-color-swatch" style="background:'+_esc(gangColor)+'"></div>' +
    '<span class="gang-color-value" style="font-family:var(--mono);font-size:13px">'+_esc(gangColor)+'</span>' +
    (rep.colors && rep.colors.secondary ? '<div class="gang-color-swatch" style="background:'+_esc(rep.colors.secondary)+'"></div>' : '') +
  '</div>';

  el.innerHTML = '<div class="org-tab-body">' +

    // ── VISUAL IDENTITY ──
    '<div class="org-section">' +
      '<div class="org-section-head">Visual Identity</div>' +
      '<div class="org-section-body">' +
        '<div class="org-field-row">' +
          '<div class="org-field">' +
            '<label>Gang Colors</label>' +
            (_viewMode ? colorSwatchView :
              '<div class="gang-color-row">' +
                '<div class="gang-color-swatch" id="gang-color-preview-1" style="background:'+_esc(gangColor)+'"></div>' +
                '<input class="org-input gang-color-hex" value="'+_esc(gangColor)+'" maxlength="9" placeholder="#c44" ' +
                  'oninput="orgSet_rep_color(\'primary\',this.value);document.getElementById(\'gang-color-preview-1\').style.background=this.value">' +
                '<div class="gang-color-swatch" id="gang-color-preview-2" style="background:'+_esc((rep.colors&&rep.colors.secondary)||'#eee')+'"></div>' +
                '<input class="org-input gang-color-hex" value="'+_esc((rep.colors&&rep.colors.secondary)||'')+'" maxlength="9" placeholder="secondary…" ' +
                  'oninput="orgSet_rep_color(\'secondary\',this.value);document.getElementById(\'gang-color-preview-2\').style.background=this.value">' +
              '</div>') +
          '</div>' +
          '<div class="org-field">' +
            '<label>Tag / Symbol</label>' +
            (_viewMode ?
              '<div class="gang-tag-view">' +
                ((rep.tag && rep.tag.image) ? '<img class="gang-tag-img" src="'+_esc(rep.tag.image)+'">' : '') +
                '<div class="org-view-text">'+_esc((rep.tag&&rep.tag.description)||'—')+'</div>' +
              '</div>' :
              '<div style="display:flex;gap:6px;align-items:flex-start">' +
                ((rep.tag && rep.tag.image) ? '<img class="gang-tag-img" src="'+_esc(rep.tag.image)+'" onclick="orgRemoveTagImg()" title="Click to remove">' : '') +
                '<div style="flex:1">' +
                  '<div style="display:flex;gap:4px;margin-bottom:4px">' +
                    '<button class="btn btn-sm" onclick="document.getElementById(\'gang-tag-input\').click()">Upload image</button>' +
                    '<input type="file" id="gang-tag-input" accept="image/*" style="display:none" onchange="orgLoadTagImg(event)">' +
                  '</div>' +
                  '<input class="org-input" value="'+_esc((rep.tag&&rep.tag.description)||'')+'" placeholder="Describe the tag/symbol…" oninput="orgSet_rep_tag(\'description\',this.value)">' +
                '</div>' +
              '</div>') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── IDENTITY ──
    (function(){
      var credVal = Math.min(10, Math.max(0, parseInt(rep.streetCred)||0));
      var credPct = credVal * 10;
      var credColor = credVal >= 8 ? '#b8860b' : credVal >= 5 ? gangColor : '#888';
      var credLabels = ['Unknown','Rumored','Noticed','Known','Respected','Feared','Notorious','Legend','Icon','Myth','Ghost'];
      var credBar = '<div class="street-cred-wrap">' +
        '<div class="street-cred-track">' +
          [0,1,2,3,4,5,6,7,8,9,10].map(function(i){
            return '<div class="street-cred-pip'+(i<=credVal?' active':'')+'" style="'+(i<=credVal?'background:'+credColor:'')+'"></div>';
          }).join('') +
        '</div>' +
        '<div class="street-cred-labels">' +
          '<span class="street-cred-num" style="color:'+credColor+'">'+credVal+'/10</span>' +
          '<span class="street-cred-label" style="color:'+credColor+'">'+credLabels[credVal]+'</span>' +
        '</div>' +
      '</div>';
      return '<div class="org-section">' +
        '<div class="org-section-head">Identity</div>' +
        '<div class="org-section-body">' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Home District</label>' + (_viewMode ? '<div class="org-view-text">'+_esc(rep.homeDistrict||'—')+'</div>' : '<input class="org-input" value="'+_esc(rep.homeDistrict||'')+'" oninput="orgSet_rep(\'homeDistrict\',this.value)">') + '</div>' +
            '<div class="org-field">' +
              '<label>Street Cred</label>' +
              credBar +
              (!_viewMode ? '<input type="range" min="0" max="10" value="'+credVal+'" style="width:100%;margin-top:6px;accent-color:'+credColor+'" oninput="orgSet_rep_cred(parseInt(this.value))">' : '') +
            '</div>' +
          '</div>' +
          '<div class="org-field"><label>Public Summary</label>' +
            (_viewMode ? '<div class="org-view-text">'+_esc(rep.publicSummary||'')+'</div>' : '<textarea class="org-textarea" oninput="orgSet_rep(\'publicSummary\',this.value)">'+_esc(rep.publicSummary||'')+'</textarea>') +
          '</div>' +
          (_privateMode ? '<div class="org-field"><label>GM Notes (private)</label>' +
            (_viewMode ? '<div class="org-view-text org-view-text-private">'+_esc(rep.privateSummary||'')+'</div>' : '<textarea class="org-textarea org-textarea-private" oninput="orgSet_rep(\'privateSummary\',this.value)">'+_esc(rep.privateSummary||'')+'</textarea>') +
          '</div>' : '') +
        '</div>' +
      '</div>';
    }()) +

    // ── CREW PROFILE ──
    '<div class="org-section">' +
      '<div class="org-section-head">Crew Profile</div>' +
      '<div class="org-section-body">' +
        '<div class="org-field">' +
          '<label>Cyberpsychosis Risk</label>' +
          (_viewMode ? cyberBar :
            '<div>' + cyberBar +
              '<div style="display:flex;gap:8px;margin-top:8px">' +
                '<div class="org-field" style="flex:1"><label style="font-size:11px">% Registered Cyberpsychos</label><input type="number" class="org-input" min="0" max="100" value="'+regPct+'" oninput="orgSet_rep_cyber(\'registered\',this.value)"></div>' +
                '<div class="org-field" style="flex:1"><label style="font-size:11px">% On Edge</label><input type="number" class="org-input" min="0" max="100" value="'+edgePct+'" oninput="orgSet_rep_cyber(\'onEdge\',this.value)"></div>' +
              '</div>' +
            '</div>') +
        '</div>' +
        '<div class="org-field"><label>Member Demographics</label>' +
          (_viewMode ? '<div class="org-view-text">'+_esc(rep.demographics||'—')+'</div>' :
            '<textarea class="org-textarea" style="min-height:50px" placeholder="Age range, education, gender, background…" oninput="orgSet_rep(\'demographics\',this.value)">'+_esc(rep.demographics||'')+'</textarea>') +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── HISTORY ──
    '<div class="org-section">' +
      '<div class="org-section-head">History</div>' +
      '<div class="org-section-body">' +
        (_viewMode ? '<div class="org-view-text">'+_esc(rep.history||'')+'</div>' : '<textarea class="org-textarea" style="min-height:90px" placeholder="Origins, founding events, evolution…" oninput="orgSet_rep(\'history\',this.value)">'+_esc(rep.history||'')+'</textarea>') +
      '</div>' +
    '</div>' +

    // ── KEY MEMBERS ──
    '<div class="org-section">' +
      '<div class="org-section-head">Key Members</div>' +
      '<div class="org-section-body"><div class="gen-persons-row">'+figuresHtml+'</div></div>' +
    '</div>' +

    // ── PHILOSOPHY ──
    (function(){
      if (!org.philosophy) org.philosophy = { code:'', specialization:'', membershipRequirements:'' };
      var ph = org.philosophy;
      var specBadge = ph.specialization ? '<div class="spec-badge" style="background:'+_esc(gangColor)+'">'+_esc(ph.specialization)+'</div>' : '';
      return '<div class="org-section">' +
        '<div class="org-section-head">Specialization</div>' +
        '<div class="org-section-body">' +
          (_viewMode ? (specBadge || '<div class="org-empty-hint">No specialization defined.</div>') :
            '<div style="display:flex;gap:8px;align-items:center">' +
              '<input class="org-input" style="flex:1" value="'+_esc(ph.specialization||'')+'" placeholder="Blades, Protection, Music, Combat, Vigilante…" oninput="orgSet_phil(\'specialization\',this.value)">' +
              (ph.specialization ? specBadge : '') +
            '</div>') +
        '</div>' +
      '</div>' +
      '<div class="org-section">' +
        '<div class="org-section-head">Code &amp; Rules</div>' +
        '<div class="org-section-body">' +
          (_viewMode ? (ph.code ? '<div class="phil-code-view">'+_esc(ph.code).replace(/\n/g,'<br>')+'</div>' : '<div class="org-empty-hint">No code defined.</div>') :
            '<textarea class="org-textarea phil-code-edit" style="min-height:100px;border-left:3px solid '+_esc(gangColor)+'" placeholder="The rules, values and laws of the group…" oninput="orgSet_phil(\'code\',this.value)">'+_esc(ph.code||'')+'</textarea>') +
        '</div>' +
      '</div>' +
      '<div class="org-section">' +
        '<div class="org-section-head">Membership Requirements</div>' +
        '<div class="org-section-body">' +
          (_viewMode ? (ph.membershipRequirements ? '<div class="phil-req-list">'+ph.membershipRequirements.split('\n').filter(Boolean).map(function(l){ return '<div class="phil-req-item"><span class="phil-req-bullet" style="color:'+gangColor+'">&#9654;</span>'+_esc(l.replace(/^[\-\*•]\s*/,''))+'</div>'; }).join('')+'</div>' : '<div class="org-empty-hint">No requirements defined.</div>') :
            '<textarea class="org-textarea" style="min-height:60px" placeholder="One requirement per line…" oninput="orgSet_phil(\'membershipRequirements\',this.value)">'+_esc(ph.membershipRequirements||'')+'</textarea>') +
        '</div>' +
      '</div>';
    }()) +

  '</div>';
}
function orgSet_rep(field, val) {
  var org = _getActive(); if (!org) return;
  if (!org.reputation) org.reputation = {};
  org.reputation[field] = val;
  _schedSave();
}
function orgSet_rep_color(key, val) {
  var org = _getActive(); if (!org) return;
  if (!org.reputation) org.reputation = {};
  if (!org.reputation.colors) org.reputation.colors = { primary:'#c44', secondary:'' };
  org.reputation.colors[key] = val;
  org.reputation.color = org.reputation.colors.primary;
  _schedSave();
}
function orgSet_rep_cyber(key, val) {
  var org = _getActive(); if (!org) return;
  if (!org.reputation) org.reputation = {};
  if (!org.reputation.cyberpsychos) org.reputation.cyberpsychos = { registered:0, onEdge:0 };
  org.reputation.cyberpsychos[key] = parseInt(val)||0;
  renderReputation();
  _schedSave();
}
function orgSet_rep_cred(val) {
  var org = _getActive(); if (!org) return;
  if (!org.reputation) org.reputation = {};
  org.reputation.streetCred = Math.min(10, Math.max(0, parseInt(val)||0));
  renderReputation();
  _schedSave();
}
function orgSet_rep_tag(key, val) {
  var org = _getActive(); if (!org) return;
  if (!org.reputation) org.reputation = {};
  if (!org.reputation.tag) org.reputation.tag = { image:null, description:'' };
  org.reputation.tag[key] = val;
  _schedSave();
}
function orgLoadTagImg(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) { orgSet_rep_tag('image', ev.target.result); renderReputation(); };
  r.readAsDataURL(f);
  e.target.value = '';
}
function orgRemoveTagImg() {
  orgSet_rep_tag('image', null); renderReputation();
}

/* ═══════════════════════════════════════════════
   GROUPE — PHILOSOPHY & CODE
   ═══════════════════════════════════════════════ */
function renderPhilosophy() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.philosophy) org.philosophy = { code:'', specialization:'', membershipRequirements:'' };
  var ph = org.philosophy;
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';

  // Specialization badge display
  var specBadge = ph.specialization
    ? '<div class="spec-badge" style="background:'+_esc(gangColor)+'">'+_esc(ph.specialization)+'</div>'
    : '';

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Specialization</div>' +
      '<div class="org-section-body">' +
        (_viewMode
          ? (specBadge || '<div class="org-empty-hint">No specialization defined.</div>')
          : '<div style="display:flex;gap:8px;align-items:center">' +
              '<input class="org-input" style="flex:1" value="'+_esc(ph.specialization||'')+'" placeholder="e.g. Blades, Protection, Music, Combat, Vigilante…" oninput="orgSet_phil(\'specialization\',this.value)">' +
              (ph.specialization ? '<div class="spec-badge" style="background:'+_esc(gangColor)+'">'+_esc(ph.specialization)+'</div>' : '') +
            '</div>') +
      '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Code & Rules</div>' +
      '<div class="org-section-body">' +
        '<div class="phil-code-wrap">' +
          (_viewMode
            ? (ph.code ? '<div class="phil-code-view">'+_esc(ph.code).replace(/\n/g,'<br>')+'</div>'
                       : '<div class="org-empty-hint">No code defined.</div>')
            : '<textarea class="org-textarea phil-code-edit" style="min-height:120px;border-left:3px solid '+_esc(gangColor)+'" placeholder="The rules, values, and laws of the group. What do members swear by? What is forbidden?" oninput="orgSet_phil(\'code\',this.value)">'+_esc(ph.code||'')+'</textarea>') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Membership Requirements</div>' +
      '<div class="org-section-body">' +
        (_viewMode
          ? (ph.membershipRequirements
              ? '<div class="phil-req-list">'+ph.membershipRequirements.split('\n').filter(Boolean).map(function(l){ return '<div class="phil-req-item"><span class="phil-req-bullet" style="color:'+gangColor+'">▶</span>'+_esc(l.replace(/^[\-\*\•]\s*/,''))+'</div>'; }).join('')+'</div>'
              : '<div class="org-empty-hint">No requirements defined.</div>')
          : '<textarea class="org-textarea" style="min-height:80px" placeholder="One requirement per line…\ne.g. Must have at least 2 cyberware implants\nMust prove loyalty with a run" oninput="orgSet_phil(\'membershipRequirements\',this.value)">'+_esc(ph.membershipRequirements||'')+'</textarea>') +
      '</div>' +
    '</div>' +
  '</div>';
}
function orgSet_phil(field, val) {
  var org = _getActive(); if (!org) return;
  if (!org.philosophy) org.philosophy = {};
  org.philosophy[field] = val;
  _schedSave();
}

/* ═══════════════════════════════════════════════
   GROUPE — RELATIONS (HQ + BUSINESSES)
   ═══════════════════════════════════════════════ */
var _REL_TYPES = ['protected','ally','client','partner','neutral','hostile'];
var _REL_COLORS = { protected:'#c44', ally:'#3a7bd5', client:'#888', partner:'#b8860b', neutral:'#555', hostile:'#7a1a1a' };
var _REL_ICONS  = { protected:'🛡', ally:'🤝', client:'💼', partner:'⚡', neutral:'◦', hostile:'✕' };
var _relView = 'network'; // 'network' or 'map'

function setRelView(v) { _relView = v; renderRelations(); }

function renderRelations() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.relations) org.relations = { hq:{ name:'', location:'', type:'', description:'' }, selectedBusinesses:[] };
  var rel = org.relations;
  var hq  = rel.hq || {};
  var biz = rel.selectedBusinesses || [];
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';

  // ── HQ section ──
  var hqHtml = '<div class="org-section">' +
    '<div class="org-section-head">Headquarters</div>' +
    '<div class="org-section-body">' +
      '<div class="rel-hq-card" style="border-left:3px solid '+_esc(gangColor)+'">' +
        (_viewMode
          ? '<div class="rel-hq-name">'+(hq.name ? _esc(hq.name) : '<span class="org-empty-hint" style="margin:0">No HQ defined.</span>')+'</div>' +
            (hq.location ? '<div class="rel-hq-loc">📍 '+_esc(hq.location)+'</div>' : '') +
            (hq.type ? '<div class="rel-hq-type">'+_esc(hq.type)+'</div>' : '') +
            (hq.description ? '<div class="org-view-text" style="margin-top:6px">'+_esc(hq.description)+'</div>' : '')
          : '<div class="org-field-row">' +
              '<div class="org-field"><label>Name</label><input class="org-input" value="'+_esc(hq.name||'')+'" placeholder="e.g. Barley\'s Building, Kitty Liquor basement…" oninput="orgSet_hq(\'name\',this.value)"></div>' +
              '<div class="org-field"><label>Location</label><input class="org-input" value="'+_esc(hq.location||'')+'" placeholder="District or address…" oninput="orgSet_hq(\'location\',this.value)"></div>' +
            '</div>' +
            '<div class="org-field-row">' +
              '<div class="org-field"><label>Type</label><input class="org-input" value="'+_esc(hq.type||'')+'" placeholder="building, basement, hotel room…" oninput="orgSet_hq(\'type\',this.value)"></div>' +
            '</div>' +
            '<div class="org-field"><label>Description</label><textarea class="org-textarea" style="min-height:50px" oninput="orgSet_hq(\'description\',this.value)">'+_esc(hq.description||'')+'</textarea></div>') +
      '</div>' +
    '</div>' +
  '</div>';

  // ── View toggle ──
  var toggleHtml = '<div class="rel-view-toggle">' +
    '<button class="rel-view-btn'+(_relView==='network'?' active':'')+'" onclick="setRelView(\'network\')">⬡ Network</button>' +
    '<button class="rel-view-btn'+(_relView==='map'?' active':'')+'" onclick="setRelView(\'map\')">🗺 Night City</button>' +
    (!_viewMode ? '<button class="rel-view-btn" onclick="addBusiness()" style="margin-left:auto">＋ Add</button>' : '') +
  '</div>';

  // ── Network graph view ──
  var networkHtml = '';
  if (_relView === 'network') {
    if (!biz.length && !hq.name) {
      networkHtml = '<div class="org-empty-hint">No HQ or businesses defined yet.</div>';
    } else {
      networkHtml = '<div class="rel-network-wrap"><svg id="rel-network-svg" class="rel-network-svg"></svg><div id="rel-network-labels" class="rel-network-labels"></div></div>';
    }
  }

  // ── Map view ──
  var mapHtml = '';
  if (_relView === 'map') {
    var markerHtml = '';
    if (hq.name || hq.location) {
      markerHtml += '<div class="rel-map-marker rel-hq-marker" style="background:'+_esc(gangColor)+'" title="HQ: '+_esc(hq.name||'')+(hq.location?' — '+_esc(hq.location):'')+'">⬟</div>';
    }
    biz.forEach(function(b,i) {
      var bc = _REL_COLORS[b.relationshipType] || '#888';
      markerHtml += '<div class="rel-map-marker" style="background:'+bc+'" title="'+_esc(b.name||'')+(b.location?' — '+_esc(b.location):'')+(b.relationshipType?' ['+b.relationshipType+']':'')+'">' + (_REL_ICONS[b.relationshipType]||'◦') + '</div>';
    });
    mapHtml = '<div class="rel-map-wrap"><img class="rel-map-img" src="img/nightcity-map.png" alt="Night City"><div class="rel-map-legend">' +
      _REL_TYPES.map(function(t){ return '<span class="rel-legend-item"><span class="rel-legend-dot" style="background:'+_REL_COLORS[t]+'"></span>'+_REL_ICONS[t]+' '+t+'</span>'; }).join('') +
    '</div></div>';
  }

  // ── Business list ──
  var bizListHtml = '<div class="org-section">' +
    '<div class="org-section-head">Selected Businesses' + (!_viewMode ? '<span class="org-section-add" onclick="addBusiness()">＋</span>' : '') + '</div>' +
    '<div class="org-section-body">' +
      (biz.length ? biz.map(function(b,i) {
        var bc = _REL_COLORS[b.relationshipType] || '#888';
        var icon = _REL_ICONS[b.relationshipType] || '◦';
        return '<div class="rel-biz-card" style="border-left:3px solid '+bc+'">' +
          '<div class="rel-biz-header">' +
            '<span class="rel-biz-icon">'+icon+'</span>' +
            '<span class="rel-biz-name">'+_esc(b.name||'Unnamed business')+'</span>' +
            '<span class="rel-biz-type-badge" style="background:'+bc+'">'+_esc(b.relationshipType||'neutral')+'</span>' +
            (!_viewMode ? '<span class="rel-biz-del" onclick="removeBusiness('+i+')" title="Remove">✕</span>' : '') +
          '</div>' +
          (_viewMode
            ? (b.location ? '<div class="rel-biz-loc">📍 '+_esc(b.location)+'</div>' : '') +
              (b.type ? '<div class="rel-biz-biztype">'+_esc(b.type)+'</div>' : '') +
              (b.notes ? '<div class="org-view-text" style="margin-top:4px;font-size:12px">'+_esc(b.notes)+'</div>' : '')
            : '<div class="org-field-row" style="margin-top:8px">' +
                '<div class="org-field"><label>Name</label><input class="org-input" value="'+_esc(b.name||'')+'" placeholder="Business name…" oninput="setBiz('+i+',\'name\',this.value)"></div>' +
                '<div class="org-field"><label>Location</label><input class="org-input" value="'+_esc(b.location||'')+'" placeholder="District…" oninput="setBiz('+i+',\'location\',this.value)"></div>' +
              '</div>' +
              '<div class="org-field-row">' +
                '<div class="org-field"><label>Type</label><input class="org-input" value="'+_esc(b.type||'')+'" placeholder="bar, hospital, shop…" oninput="setBiz('+i+',\'type\',this.value)"></div>' +
                '<div class="org-field"><label>Relationship</label><select class="org-select" style="width:100%" onchange="setBiz('+i+',\'relationshipType\',this.value)">'+
                  _REL_TYPES.map(function(t){ return '<option'+(b.relationshipType===t?' selected':'')+'>'+t+'</option>'; }).join('') +
                '</select></div>' +
              '</div>' +
              '<div class="org-field"><label>Notes</label><input class="org-input" value="'+_esc(b.notes||'')+'" placeholder="Why this relationship exists…" oninput="setBiz('+i+',\'notes\',this.value)"></div>') +
        '</div>';
      }).join('') : '<div class="org-empty-hint">No businesses listed.</div>') +
    '</div>' +
  '</div>';

  el.innerHTML = '<div class="org-tab-body">' +
    hqHtml +
    '<div class="org-section">' +
      '<div class="org-section-head">Network View</div>' +
      '<div class="org-section-body" style="padding:0">' +
        toggleHtml +
        networkHtml + mapHtml +
      '</div>' +
    '</div>' +
    bizListHtml +
  '</div>';

  // Draw network graph after DOM is ready
  if (_relView === 'network' && (biz.length || hq.name)) {
    setTimeout(function(){ _drawRelNetwork(org, gangColor); }, 0);
  }
}

function _drawRelNetwork(org, gangColor) {
  var svg = document.getElementById('rel-network-svg'); if (!svg) return;
  var rel = org.relations || {};
  var hq = rel.hq || {};
  var biz = rel.selectedBusinesses || [];
  var W = svg.clientWidth || 460, H = svg.clientHeight || 300;
  var cx = W/2, cy = H/2;
  var r = Math.min(W, H) * 0.35;

  var nodes = [{ label: hq.name || 'HQ', isHQ: true, color: gangColor, x: cx, y: cy }];
  biz.forEach(function(b, i) {
    var angle = (2 * Math.PI * i / biz.length) - Math.PI/2;
    nodes.push({ label: b.name||'?', isHQ:false, color: _REL_COLORS[b.relationshipType]||'#888', icon: _REL_ICONS[b.relationshipType]||'◦', x: cx + r*Math.cos(angle), y: cy + r*Math.sin(angle) });
  });

  var svgHtml = '<defs><filter id="rel-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  // Edges
  nodes.slice(1).forEach(function(n) {
    svgHtml += '<line x1="'+cx+'" y1="'+cy+'" x2="'+n.x+'" y2="'+n.y+'" stroke="'+n.color+'" stroke-width="1.5" stroke-opacity="0.4" stroke-dasharray="4,3"/>';
  });
  // HQ node
  svgHtml += '<circle cx="'+cx+'" cy="'+cy+'" r="24" fill="'+gangColor+'" filter="url(#rel-glow)"/>';
  svgHtml += '<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-family="var(--head)" font-size="9" fill="#fff" letter-spacing="1">⬟ HQ</text>';
  // Business nodes
  nodes.slice(1).forEach(function(n) {
    svgHtml += '<circle cx="'+n.x+'" cy="'+n.y+'" r="16" fill="'+n.color+'" opacity="0.9"/>';
    svgHtml += '<text x="'+n.x+'" y="'+(n.y+4)+'" text-anchor="middle" font-size="12" fill="#fff">'+n.icon+'</text>';
    // Label below
    var lx = n.x, ly = n.y + 28;
    var shortName = (n.label||'').length > 12 ? n.label.slice(0,11)+'…' : n.label;
    svgHtml += '<text x="'+lx+'" y="'+ly+'" text-anchor="middle" font-family="var(--head)" font-size="8" fill="#555" letter-spacing="0.5">'+_esc(shortName)+'</text>';
  });
  // HQ label
  svgHtml += '<text x="'+cx+'" y="'+(cy+40)+'" text-anchor="middle" font-family="var(--head)" font-size="8" fill="#555" letter-spacing="0.5">'+_esc((hq.name||'HQ').length>14?(hq.name||'HQ').slice(0,13)+'…':(hq.name||'HQ'))+'</text>';

  svg.innerHTML = svgHtml;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
}

function _rerenderRelationsTab() {
  if (_activeTab === 'offices') renderTerritoryRelations();
  else renderRelations();
}
function addBusiness() {
  var org = _getActive(); if (!org) return;
  if (!org.relations) org.relations = { hq:{name:'',location:'',type:'',description:''}, selectedBusinesses:[] };
  org.relations.selectedBusinesses.push({ name:'', location:'', type:'', relationshipType:'neutral', notes:'' });
  _schedSave(); _rerenderRelationsTab();
}
function removeBusiness(idx) {
  var org = _getActive(); if (!org) return;
  if (!org.relations) return;
  org.relations.selectedBusinesses.splice(idx,1);
  _schedSave(); _rerenderRelationsTab();
}
function setBiz(idx, field, val) {
  var org = _getActive(); if (!org) return;
  if (!org.relations || !org.relations.selectedBusinesses[idx]) return;
  org.relations.selectedBusinesses[idx][field] = val;
  _schedSave();
}
function orgSet_hq(field, val) {
  var org = _getActive(); if (!org) return;
  if (!org.relations) org.relations = { hq:{}, selectedBusinesses:[] };
  if (!org.relations.hq) org.relations.hq = {};
  org.relations.hq[field] = val;
  _schedSave();
}

/* ═══════════════════════════════════════════════
   GROUPE — CONTRATS & RUNS
   ═══════════════════════════════════════════════ */
var _RUN_TYPES   = ['Trafficking','Extraction','Protection','Sabotage','Intelligence','Elimination','Theft','Escort','Other'];
var _RUN_STATUS  = ['Planned','Active','Completed','Abandoned'];
var _RUN_RISK    = ['Low','Medium','High','Extreme'];
var _runOpen     = {};

function renderRuns() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.runs) org.runs = { mo:[], items:[] };
  if (!org.runs.mo) org.runs.mo = [];
  var moItems = org.runs.mo || [];

  // MO grid
  var moCardsHtml = moItems.length ? moItems.map(function(m, i) {
    if (_viewMode) {
      return '<div class="mo-card">' +
        '<div class="prod-card-name" style="font-family:var(--head);font-size:12px;letter-spacing:0.5px">'+_esc(m.name||'—')+'</div>' +
        (m.description ? '<div class="prod-card-desc">'+_esc(m.description)+'</div>' : '') +
      '</div>';
    }
    return '<div class="mo-card">' +
      '<input class="prod-card-name-edit" value="'+_esc(m.name||'')+'" placeholder="M.O. name…" oninput="moSet('+i+',\'name\',this.value)">' +
      '<textarea class="prod-card-desc-edit" placeholder="Description…" oninput="moSet('+i+',\'description\',this.value)">'+_esc(m.description||'')+'</textarea>' +
      '<div style="text-align:right;margin-top:4px"><span class="org-rm" onclick="removeMo('+i+')">&#10005;</span></div>' +
    '</div>';
  }).join('') : '<div class="org-empty-hint">No M.O. defined.</div>';

  var moSectionHtml = '<div class="org-section">' +
    '<div class="org-section-head">Modus Operandi' + (!_viewMode ? '<span class="org-section-add" onclick="addMo()">&#65291;</span>' : '') + '</div>' +
    '<div class="org-section-body"><div class="mo-grid">'+moCardsHtml+'</div></div>' +
  '</div>';

  var items = (org.runs.items||[]).filter(function(r){ return _privateMode || !r.isPrivate; });

  var filterHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">' +
    '<select id="run-filter-type" class="org-select" style="width:120px" onchange="renderRuns()"><option value="">All types</option>'+
    _RUN_TYPES.map(function(t){ return '<option>'+t+'</option>'; }).join('') + '</select>' +
    '<select id="run-filter-status" class="org-select" style="width:120px" onchange="renderRuns()"><option value="">All status</option>'+
    _RUN_STATUS.map(function(s){ return '<option>'+s+'</option>'; }).join('') + '</select>' +
  '</div>';

  var ft = (document.getElementById('run-filter-type')||{}).value||'';
  var fs = (document.getElementById('run-filter-status')||{}).value||'';
  var visible = items.filter(function(r){
    return (!ft || r.type===ft) && (!fs || r.status===fs);
  });

  var cardsHtml = visible.length ? visible.map(function(r) {
    var realIdx = org.runs.items.indexOf(r);
    var open = !!_runOpen[r.id];
    var riskCls = (_RUN_RISK.indexOf(r.risk||'Medium') > 1) ? 'high' : 'low';
    var statusColor = { 'Active':'#3a7bd5', 'Completed':'#1a7a2e', 'Abandoned':'#999', 'Planned':'#b8860b' }[r.status||'Planned'] || '#888';
    var body = _viewMode
      ? '<div class="job-card-body'+(open?' open':'')+'">' +
          '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px">' +
            (r.type ? '<div><label>Type</label><div class="org-view-text">'+_esc(r.type)+'</div></div>' : '') +
            (r.pay ? '<div><label>Payment</label><div class="org-view-text">'+_esc(r.pay)+'</div></div>' : '') +
            (r.contractor ? '<div><label>Client</label><div class="org-view-text">'+_esc(r.contractor)+'</div></div>' : '') +
            (r.location ? '<div><label>Location</label><div class="org-view-text">'+_esc(r.location)+'</div></div>' : '') +
            (r.date ? '<div><label>Date</label><div class="org-view-text">'+_esc(r.date)+'</div></div>' : '') +
          '</div>' +
          (r.description ? '<div class="org-field"><label>Description</label><div class="org-view-text">'+_esc(r.description)+'</div></div>' : '') +
        '</div>'
      : '<div class="job-card-body'+(open?' open':'')+'">' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Type</label><select class="org-select" style="width:100%" onchange="runSet('+realIdx+',\'type\',this.value)">'+_RUN_TYPES.map(function(t){ return '<option'+(r.type===t?' selected':'')+'>'+t+'</option>'; }).join('')+'</select></div>' +
            '<div class="org-field"><label>Status</label><select class="org-select" style="width:100%" onchange="runSet('+realIdx+',\'status\',this.value)">'+_RUN_STATUS.map(function(s){ return '<option'+(r.status===s?' selected':'')+'>'+s+'</option>'; }).join('')+'</select></div>' +
            '<div class="org-field"><label>Risk</label><select class="org-select" style="width:100%" onchange="runSet('+realIdx+',\'risk\',this.value)">'+_RUN_RISK.map(function(v){ return '<option'+(r.risk===v?' selected':'')+'>'+v+'</option>'; }).join('')+'</select></div>' +
          '</div>' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Payment</label><input class="org-input" value="'+_esc(r.pay||'')+'" placeholder="Ex: 2000 eb" oninput="runSet('+realIdx+',\'pay\',this.value)"></div>' +
            '<div class="org-field"><label>Client</label><input class="org-input" value="'+_esc(r.contractor||'')+'" oninput="runSet('+realIdx+',\'contractor\',this.value)"></div>' +
          '</div>' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Location</label><input class="org-input" value="'+_esc(r.location||'')+'" oninput="runSet('+realIdx+',\'location\',this.value)"></div>' +
            '<div class="org-field"><label>Date</label><input class="org-input" value="'+_esc(r.date||'')+'" placeholder="Ex: Nov 2045" oninput="runSet('+realIdx+',\'date\',this.value)"></div>' +
          '</div>' +
          '<div class="org-field"><label>Description / Briefing</label><textarea class="org-textarea" oninput="runSet('+realIdx+',\'description\',this.value)">'+_esc(r.description||'')+'</textarea></div>' +
          (_privateMode ? '<label class="org-settings-row"><input type="checkbox"'+(r.isPrivate?' checked':'')+' onchange="runSet('+realIdx+',\'isPrivate\',this.checked)"> GM Only</label>' : '') +
          '<div class="org-card-actions"><button class="btn btn-sm btn-red" onclick="removeRun('+realIdx+')">Supprimer</button></div>' +
        '</div>';
    return '<div class="job-card'+(r.isPrivate?' job-private':'')+'">' +
      '<div class="job-card-head" onclick="toggleRun(\''+r.id+'\')">' +
        '<span class="job-title">'+_esc(r.title||'Untitled Run')+'</span>' +
        '<span style="font-size:11px;padding:1px 5px;border-radius:2px;color:#fff;background:'+statusColor+'">'+_esc(r.status||'Planned')+'</span>' +
        (r.pay ? '<span class="job-pay">'+_esc(r.pay)+'</span>' : '') +
        '<span class="job-risk '+riskCls+'">'+_esc(r.risk||'Medium')+'</span>' +
        '<span style="font-size:13px;color:#bbb;margin-left:4px">'+(open?'▲':'▼')+'</span>' +
      '</div>' +
      body +
    '</div>';
  }).join('') : '<div class="org-empty-hint">No runs or contracts recorded.</div>';

  el.innerHTML = '<div class="org-tab-body">' +
    moSectionHtml +
    '<div class="org-section">' +
      '<div class="org-section-head">Contracts &amp; Runs' + (!_viewMode ? '<span class="org-section-add" onclick="addRun()">&#65291;</span>' : '') + '</div>' +
      '<div class="org-section-body">' + filterHtml + cardsHtml + '</div>' +
    '</div>' +
  '</div>';
}
function toggleRun(id) { _runOpen[id] = !_runOpen[id]; renderRuns(); }
function runSet(idx, field, val) { var org = _getActive(); if (!org) return; org.runs.items[idx][field]=val; _schedSave(); }
function addRun() {
  var org = _getActive(); if (!org) return;
  if (!org.runs) org.runs = { items:[] };
  var r = { id:_uid(), title:'', type:'Other', status:'Planned', risk:'Medium', pay:'', contractor:'', location:'', date:'', description:'', isPrivate:false };
  org.runs.items.push(r);
  _runOpen[r.id] = true;
  renderRuns();
}
function removeRun(idx) { if (!confirm('Supprimer ce run ?')) return; var org = _getActive(); if (!org) return; org.runs.items.splice(idx,1); renderRuns(); }
function moSet(idx, field, val) { var org = _getActive(); if (!org) return; if (!org.runs.mo[idx]) return; org.runs.mo[idx][field]=val; _schedSave(); }
function addMo() { var org = _getActive(); if (!org) return; if (!org.runs.mo) org.runs.mo=[]; org.runs.mo.push({ id:_uid(), name:'', description:'' }); renderRuns(); }
function removeMo(idx) { var org = _getActive(); if (!org) return; org.runs.mo.splice(idx,1); renderRuns(); }

/* ═══════════════════════════════════════════════
   GROUPE — INFLUENCE
   ═══════════════════════════════════════════════ */
var _NC_DISTRICTS = ['Little Italy','Northside District','City Center','Upper Eastside','Upper Marina','East Marina','Westhill Gardens','Corp. Center','Bank Block','Old Downtown','New Harbor Area','Night City Univ.','Lake Park','Eastpark & Japantown','Little China','Studio City','Charter Hill'];

function renderInfluence() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.influence) org.influence = { publicNotes:'', privateNotes:'', districts:{} };
  var inf = org.influence;
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';

  // Parse gang color to RGB for mixing
  function hexToRgb(h) {
    h = h.replace('#','');
    if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) };
  }
  var gc = hexToRgb(gangColor) || { r:196, g:68, b:68 };

  function distCellColor(val) {
    if (!val) return '#f4f4f4';
    var t = val / 10; // 0-1
    var r = Math.round(244 + (gc.r - 244) * t);
    var g = Math.round(244 + (gc.g - 244) * t);
    var b = Math.round(244 + (gc.b - 244) * t);
    return 'rgb('+r+','+g+','+b+')';
  }
  function distTextColor(val) { return val >= 6 ? '#fff' : '#333'; }

  // Heatmap grid
  var heatHtml = '<div class="infl-heatmap">' +
    _NC_DISTRICTS.map(function(d) {
      var val = parseInt(inf.districts[d]||0);
      var bg = distCellColor(val);
      var tc = distTextColor(val);
      return '<div class="infl-heat-cell" style="background:'+bg+';color:'+tc+'" ' +
        'onclick="inflCellClick(\''+_esc(d.replace(/'/g,"\\'"))+'\')" ' +
        'title="'+_esc(d)+': '+val+'/10">' +
        '<span class="infl-heat-name">'+_esc(d)+'</span>' +
        '<span class="infl-heat-val">'+val+'</span>' +
      '</div>';
    }).join('') +
  '</div>';

  // Slider list (edit mode)
  var sliderHtml = !_viewMode ? '<div class="infl-slider-list">' +
    _NC_DISTRICTS.map(function(d) {
      var val = parseInt(inf.districts[d]||0);
      var bg = distCellColor(val);
      return '<div class="infl-district-row">' +
        '<span class="infl-district-name">'+_esc(d)+'</span>' +
        '<input type="range" min="0" max="10" value="'+val+'" class="infl-slider" ' +
          'style="accent-color:'+gangColor+'" oninput="inflSet(\''+d.replace(/'/g,"\\'").replace(/\./g,'\\.')+'\',this.value)">' +
        '<span class="infl-val" id="infl-val-'+_esc(d.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,''))+'">'+val+'</span>' +
      '</div>';
    }).join('') +
  '</div>' : '';

  // Legend
  var legendHtml = '<div class="infl-legend">' +
    [0,2,4,6,8,10].map(function(v) {
      return '<div class="infl-legend-item"><div class="infl-legend-dot" style="background:'+distCellColor(v)+'"></div><span>'+v+'</span></div>';
    }).join('') +
    '<span class="infl-legend-label">No presence → Total control</span>' +
  '</div>';

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Influence by District</div>' +
      '<div class="org-section-body">' +
        legendHtml + heatHtml + sliderHtml +
      '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Notes</div>' +
      '<div class="org-section-body">' +
        '<div class="org-field"><label>Resources & contacts (public)</label>' +
          (_viewMode ? '<div class="org-view-text">'+_esc(inf.publicNotes||'')+'</div>' : '<textarea class="org-textarea" style="min-height:70px" oninput="orgSet_nested(\'influence\',\'publicNotes\',this.value)">'+_esc(inf.publicNotes||'')+'</textarea>') +
        '</div>' +
        (_privateMode ? '<div class="org-field"><label>GM Notes (private)</label>' +
          (_viewMode ? '<div class="org-view-text org-view-text-private">'+_esc(inf.privateNotes||'')+'</div>' : '<textarea class="org-textarea org-textarea-private" style="min-height:70px" oninput="orgSet_nested(\'influence\',\'privateNotes\',this.value)">'+_esc(inf.privateNotes||'')+'</textarea>') +
        '</div>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}
function inflCellClick(district) {
  if (_viewMode) return;
  // Flash focus to the slider for that district
  var safeId = district.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  var row = document.querySelector('.infl-district-row .infl-district-name');
  var rows = document.querySelectorAll('.infl-district-row');
  rows.forEach(function(r) {
    var nm = r.querySelector('.infl-district-name');
    if (nm && nm.textContent === district) {
      r.classList.add('infl-row-highlight');
      var sl = r.querySelector('.infl-slider');
      if (sl) sl.focus();
      setTimeout(function(){ r.classList.remove('infl-row-highlight'); }, 1200);
    }
  });
}
function inflSet(district, val) {
  var org = _getActive(); if (!org) return;
  if (!org.influence) org.influence = { districts:{} };
  org.influence.districts[district] = parseInt(val)||0;
  _schedSave();
  // Live-update heatmap cell without full re-render
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';
  function hexToRgb(h) { h=h.replace('#',''); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
  var gc = hexToRgb(gangColor)||{r:196,g:68,b:68};
  var v = parseInt(val)||0, t = v/10;
  var bg = v ? 'rgb('+ Math.round(244+(gc.r-244)*t)+','+ Math.round(244+(gc.g-244)*t)+','+ Math.round(244+(gc.b-244)*t)+')' : '#f4f4f4';
  var tc = v >= 6 ? '#fff' : '#333';
  document.querySelectorAll('.infl-heat-cell').forEach(function(cell) {
    var nm = cell.querySelector('.infl-heat-name');
    if (nm && nm.textContent === district) {
      cell.style.background = bg; cell.style.color = tc;
      var vEl = cell.querySelector('.infl-heat-val'); if (vEl) vEl.textContent = v;
    }
  });
  // Update val label
  var safeId = district.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  var valEl = document.getElementById('infl-val-'+safeId);
  if (valEl) valEl.textContent = v;
}

/* ═══════════════════════════════════════════════
   GROUPE — TERRITORY & RELATIONS
   ═══════════════════════════════════════════════ */
function renderTerritoryRelations() {
  renderOffices('territoire');
  var el = document.getElementById('org-tab-content');
  var org = _getActive(); if (!el || !org) return;
  var rel = org.relations || {};
  var hq  = rel.hq || {};
  var biz = rel.selectedBusinesses || [];
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';

  // ── 1. Inject Contacts section into sidebar ──
  var sideEl = el.querySelector('.offices-side');
  if (sideEl) {
    var contactsHead = document.createElement('div');
    contactsHead.className = 'offices-side-head';
    contactsHead.style.borderTop = '2px solid #111';
    contactsHead.innerHTML = '<span>Contacts</span>' +
      (!_viewMode ? '<button class="btn btn-sm" onclick="addBusiness()">+</button>' : '');
    sideEl.appendChild(contactsHead);

    var contactsList = document.createElement('div');
    contactsList.className = 'offices-side-list';
    contactsList.id = 'contacts-side-list';

    // HQ pin
    if (hq.name || hq.location) {
      var hqPin = document.createElement('div');
      hqPin.className = 'offices-side-item contacts-side-item';
      hqPin.style.borderLeft = '3px solid ' + gangColor;
      hqPin.innerHTML =
        '<span class="contacts-side-badge" style="background:'+_esc(gangColor)+'">HQ</span>' +
        '<span class="contacts-side-name">'+_esc(hq.name || hq.location || '—')+'</span>';
      contactsList.appendChild(hqPin);
    }

    // Business pins
    biz.forEach(function(b) {
      var bc = _REL_COLORS[b.relationshipType] || '#888';
      var icon = _REL_ICONS[b.relationshipType] || '◦';
      var pin = document.createElement('div');
      pin.className = 'offices-side-item contacts-side-item';
      pin.style.borderLeft = '3px solid ' + bc;
      pin.innerHTML =
        '<span class="contacts-side-icon">'+icon+'</span>' +
        '<span class="contacts-side-name">'+_esc(b.name || '—')+'</span>' +
        (b.location ? '<span class="contacts-side-loc">'+_esc(b.location)+'</span>' : '');
      contactsList.appendChild(pin);
    });

    if (!hq.name && !hq.location && !biz.length) {
      var empty = document.createElement('div');
      empty.className = 'org-empty-hint';
      empty.style.cssText = 'padding:6px 8px;font-size:11px';
      empty.textContent = 'No contacts.';
      contactsList.appendChild(empty);
    }

    sideEl.appendChild(contactsList);
  }

  // ── 2. Append HQ+Contacts details, Network graph, Influence heatmap below map ──
  var bottomEl = el.querySelector('.offices-bottom');
  if (!bottomEl) return;

  // HQ details card
  var hqCardHtml = '<div class="rel-hq-card" style="border-left:3px solid '+_esc(gangColor)+';margin-bottom:10px">' +
    (_viewMode
      ? '<div class="rel-hq-name">'+(hq.name ? _esc(hq.name) : '<span style="color:#bbb;font-style:italic">No HQ defined</span>')+'</div>' +
        (hq.location ? '<div class="rel-hq-loc">📍 '+_esc(hq.location)+'</div>' : '') +
        (hq.type    ? '<div class="rel-hq-type">'+_esc(hq.type)+'</div>' : '') +
        (hq.description ? '<div class="org-view-text" style="margin-top:6px">'+_esc(hq.description)+'</div>' : '')
      : '<div class="org-field-row">' +
          '<div class="org-field"><label>Name</label><input class="org-input" value="'+_esc(hq.name||'')+'" placeholder="Barley\'s Building…" oninput="orgSet_hq(\'name\',this.value)"></div>' +
          '<div class="org-field"><label>Location</label><input class="org-input" value="'+_esc(hq.location||'')+'" placeholder="District or address…" oninput="orgSet_hq(\'location\',this.value)"></div>' +
        '</div>' +
        '<div class="org-field-row">' +
          '<div class="org-field"><label>Type</label><input class="org-input" value="'+_esc(hq.type||'')+'" placeholder="building, basement…" oninput="orgSet_hq(\'type\',this.value)"></div>' +
        '</div>' +
        '<div class="org-field"><label>Description</label><textarea class="org-textarea" style="min-height:50px" oninput="orgSet_hq(\'description\',this.value)">'+_esc(hq.description||'')+'</textarea></div>') +
  '</div>';

  // Business contact cards
  var bizCardsHtml = biz.length ? biz.map(function(b, i) {
    var bc   = _REL_COLORS[b.relationshipType] || '#888';
    var icon = _REL_ICONS[b.relationshipType]  || '◦';
    return '<div class="rel-biz-card" style="border-left:3px solid '+bc+'">' +
      '<div class="rel-biz-header">' +
        '<span class="rel-biz-icon">'+icon+'</span>' +
        '<span class="rel-biz-name">'+_esc(b.name||'Unnamed business')+'</span>' +
        '<span class="rel-biz-type-badge" style="background:'+bc+'">'+_esc(b.relationshipType||'neutral')+'</span>' +
        (!_viewMode ? '<span class="rel-biz-del" onclick="removeBusiness('+i+')" title="Remove">✕</span>' : '') +
      '</div>' +
      (_viewMode
        ? (b.location ? '<div class="rel-biz-loc">📍 '+_esc(b.location)+'</div>' : '') +
          (b.type     ? '<div class="rel-biz-biztype">'+_esc(b.type)+'</div>' : '') +
          (b.notes    ? '<div class="org-view-text" style="margin-top:4px;font-size:12px">'+_esc(b.notes)+'</div>' : '')
        : '<div class="org-field-row" style="margin-top:8px">' +
            '<div class="org-field"><label>Name</label><input class="org-input" value="'+_esc(b.name||'')+'" placeholder="Business name…" oninput="setBiz('+i+',\'name\',this.value)"></div>' +
            '<div class="org-field"><label>Location</label><input class="org-input" value="'+_esc(b.location||'')+'" placeholder="District…" oninput="setBiz('+i+',\'location\',this.value)"></div>' +
          '</div>' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>Type</label><input class="org-input" value="'+_esc(b.type||'')+'" placeholder="bar, hospital…" oninput="setBiz('+i+',\'type\',this.value)"></div>' +
            '<div class="org-field"><label>Relationship</label><select class="org-select" style="width:100%" onchange="setBiz('+i+',\'relationshipType\',this.value)">'+
              _REL_TYPES.map(function(t){ return '<option'+(b.relationshipType===t?' selected':'')+'>'+t+'</option>'; }).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="org-field"><label>Notes</label><input class="org-input" value="'+_esc(b.notes||'')+'" placeholder="Why this relationship exists…" oninput="setBiz('+i+',\'notes\',this.value)"></div>') +
    '</div>';
  }).join('') : '<div class="org-empty-hint">No business contacts.</div>';

  // Network graph
  var networkInner = (biz.length || hq.name)
    ? '<div class="rel-network-wrap"><svg id="rel-network-svg" class="rel-network-svg"></svg></div>'
    : '<div class="org-empty-hint">Add a HQ or contacts to see the network graph.</div>';

  // Influence heatmap
  if (!org.influence) org.influence = { publicNotes:'', privateNotes:'', districts:{} };
  var inf = org.influence;
  function hexToRgb(h) { h=h.replace('#',''); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
  var gc = hexToRgb(gangColor)||{r:196,g:68,b:68};
  function distCellColor(val) { if(!val)return'#f4f4f4'; var t=val/10; return'rgb('+Math.round(244+(gc.r-244)*t)+','+Math.round(244+(gc.g-244)*t)+','+Math.round(244+(gc.b-244)*t)+')'; }
  function distTextColor(val) { return val>=6?'#fff':'#333'; }
  var heatHtml = '<div class="infl-heatmap">' +
    _NC_DISTRICTS.map(function(d) {
      var val = parseInt(inf.districts[d]||0);
      return '<div class="infl-heat-cell" style="background:'+distCellColor(val)+';color:'+distTextColor(val)+'" ' +
        'onclick="inflCellClick(\''+d.replace(/'/g,"\\'")+'\') " title="'+_esc(d)+': '+val+'/10">' +
        '<span class="infl-heat-name">'+_esc(d)+'</span><span class="infl-heat-val">'+val+'</span></div>';
    }).join('') +
  '</div>';
  var sliderHtml = !_viewMode ? '<div class="infl-slider-list">' +
    _NC_DISTRICTS.map(function(d) {
      var val = parseInt(inf.districts[d]||0);
      var safeId = d.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      return '<div class="infl-district-row">' +
        '<span class="infl-district-name">'+_esc(d)+'</span>' +
        '<input type="range" min="0" max="10" value="'+val+'" class="infl-slider" style="accent-color:'+gangColor+'" oninput="inflSet(\''+d.replace(/'/g,"\\'").replace(/\./g,'\\.')+'\',this.value)">' +
        '<span class="infl-val" id="infl-val-'+safeId+'">'+val+'</span>' +
      '</div>';
    }).join('') + '</div>' : '';
  var legendHtml = '<div class="infl-legend">' +
    [0,2,4,6,8,10].map(function(v){ return '<div class="infl-legend-item"><div class="infl-legend-dot" style="background:'+distCellColor(v)+'"></div><span>'+v+'</span></div>'; }).join('') +
    '<span class="infl-legend-label">No presence → Total control</span></div>';

  // Build and append extra sections
  var extra = document.createElement('div');
  extra.innerHTML =
    '<div class="org-section">' +
      '<div class="org-section-head">HQ &amp; Contacts' + (!_viewMode ? '<span class="org-section-add" onclick="addBusiness()">＋</span>' : '') + '</div>' +
      '<div class="org-section-body">' + hqCardHtml + bizCardsHtml + '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Contact Network</div>' +
      '<div class="org-section-body" style="padding:8px">' + networkInner + '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Influence by District</div>' +
      '<div class="org-section-body">' + legendHtml + heatHtml + sliderHtml + '</div>' +
    '</div>';

  while (extra.firstChild) bottomEl.appendChild(extra.firstChild);

  // Draw network graph after DOM is ready
  if (biz.length || hq.name) {
    setTimeout(function(){ _drawRelNetwork(org, gangColor); }, 0);
  }
}

/* ═══════════════════════════════════════════════
   GROUPE — IDENTITY & INFLUENCE
   ═══════════════════════════════════════════════ */
function renderIdentityInfluence() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.philosophy) org.philosophy = { code:'', specialization:'', membershipRequirements:'' };
  if (!org.influence)  org.influence  = { publicNotes:'', privateNotes:'', districts:{} };
  var ph  = org.philosophy;
  var inf = org.influence;
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';

  // Specialization badge
  var specBadge = ph.specialization
    ? '<div class="spec-badge" style="background:'+_esc(gangColor)+'">'+_esc(ph.specialization)+'</div>'
    : '';

  // Philosophy section
  var philHtml =
    '<div class="org-section">' +
      '<div class="org-section-head">Specialization</div>' +
      '<div class="org-section-body">' +
        (_viewMode
          ? (specBadge || '<div class="org-empty-hint">No specialization defined.</div>')
          : '<div style="display:flex;gap:8px;align-items:center">' +
              '<input class="org-input" style="flex:1" value="'+_esc(ph.specialization||'')+'" placeholder="e.g. Blades, Protection, Music, Combat, Vigilante…" oninput="orgSet_phil(\'specialization\',this.value)">' +
              (ph.specialization ? '<div class="spec-badge" style="background:'+_esc(gangColor)+'">'+_esc(ph.specialization)+'</div>' : '') +
            '</div>') +
      '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Code &amp; Rules</div>' +
      '<div class="org-section-body">' +
        '<div class="phil-code-wrap">' +
          (_viewMode
            ? (ph.code ? '<div class="phil-code-view">'+_esc(ph.code).replace(/\n/g,'<br>')+'</div>'
                       : '<div class="org-empty-hint">No code defined.</div>')
            : '<textarea class="org-textarea phil-code-edit" style="min-height:120px;border-left:3px solid '+_esc(gangColor)+'" placeholder="The rules, values, and laws of the group…" oninput="orgSet_phil(\'code\',this.value)">'+_esc(ph.code||'')+'</textarea>') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Membership Requirements</div>' +
      '<div class="org-section-body">' +
        (_viewMode
          ? (ph.membershipRequirements
              ? '<div class="phil-req-list">'+ph.membershipRequirements.split('\n').filter(Boolean).map(function(l){ return '<div class="phil-req-item"><span class="phil-req-bullet" style="color:'+gangColor+'">&#9654;</span>'+_esc(l.replace(/^[\-\*•]\s*/,''))+'</div>'; }).join('')+'</div>'
              : '<div class="org-empty-hint">No requirements defined.</div>')
          : '<textarea class="org-textarea" style="min-height:80px" placeholder="One requirement per line…" oninput="orgSet_phil(\'membershipRequirements\',this.value)">'+_esc(ph.membershipRequirements||'')+'</textarea>') +
      '</div>' +
    '</div>';

  // Heatmap helpers
  function hexToRgb(h) {
    h = h.replace('#','');
    if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) };
  }
  var gc = hexToRgb(gangColor) || { r:196, g:68, b:68 };
  function distCellColor(val) {
    if (!val) return '#f4f4f4';
    var t = val / 10;
    return 'rgb('+Math.round(244+(gc.r-244)*t)+','+Math.round(244+(gc.g-244)*t)+','+Math.round(244+(gc.b-244)*t)+')';
  }
  function distTextColor(val) { return val >= 6 ? '#fff' : '#333'; }

  var heatHtml = '<div class="infl-heatmap">' +
    _NC_DISTRICTS.map(function(d) {
      var val = parseInt(inf.districts[d]||0);
      return '<div class="infl-heat-cell" style="background:'+distCellColor(val)+';color:'+distTextColor(val)+'" ' +
        'onclick="inflCellClick(\''+_esc(d.replace(/'/g,"\\'"))+'\')" ' +
        'title="'+_esc(d)+': '+val+'/10">' +
        '<span class="infl-heat-name">'+_esc(d)+'</span>' +
        '<span class="infl-heat-val">'+val+'</span>' +
      '</div>';
    }).join('') +
  '</div>';

  var sliderHtml = !_viewMode ? '<div class="infl-slider-list">' +
    _NC_DISTRICTS.map(function(d) {
      var val = parseInt(inf.districts[d]||0);
      return '<div class="infl-district-row">' +
        '<span class="infl-district-name">'+_esc(d)+'</span>' +
        '<input type="range" min="0" max="10" value="'+val+'" class="infl-slider" ' +
          'style="accent-color:'+gangColor+'" oninput="inflSet(\''+d.replace(/'/g,"\\'").replace(/\./g,'\\.')+'\',this.value)">' +
        '<span class="infl-val" id="infl-val-'+_esc(d.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,''))+'">'+val+'</span>' +
      '</div>';
    }).join('') +
  '</div>' : '';

  var legendHtml = '<div class="infl-legend">' +
    [0,2,4,6,8,10].map(function(v) {
      return '<div class="infl-legend-item"><div class="infl-legend-dot" style="background:'+distCellColor(v)+'"></div><span>'+v+'</span></div>';
    }).join('') +
    '<span class="infl-legend-label">No presence &#8594; Total control</span>' +
  '</div>';

  var inflHtml =
    '<div class="org-section">' +
      '<div class="org-section-head">Influence by District</div>' +
      '<div class="org-section-body">' +
        legendHtml + heatHtml + sliderHtml +
      '</div>' +
    '</div>' +
    '<div class="org-section">' +
      '<div class="org-section-head">Notes</div>' +
      '<div class="org-section-body">' +
        '<div class="org-field"><label>Resources &amp; contacts (public)</label>' +
          (_viewMode ? '<div class="org-view-text">'+_esc(inf.publicNotes||'')+'</div>' : '<textarea class="org-textarea" style="min-height:70px" oninput="orgSet_nested(\'influence\',\'publicNotes\',this.value)">'+_esc(inf.publicNotes||'')+'</textarea>') +
        '</div>' +
        (_privateMode ? '<div class="org-field"><label>GM Notes (private)</label>' +
          (_viewMode ? '<div class="org-view-text org-view-text-private">'+_esc(inf.privateNotes||'')+'</div>' : '<textarea class="org-textarea org-textarea-private" style="min-height:70px" oninput="orgSet_nested(\'influence\',\'privateNotes\',this.value)">'+_esc(inf.privateNotes||'')+'</textarea>') +
        '</div>' : '') +
      '</div>' +
    '</div>';

  el.innerHTML = '<div class="org-tab-body">' + philHtml + inflHtml + '</div>';
}

/* ═══════════════════════════════════════════════
   GROUPE — RECRUTEMENT (jobs avec labels adaptés)
   ═══════════════════════════════════════════════ */
function renderRecruitment() {
  renderJobsVariant('groupe');
}

/* ═══════════════════════════════════════════════
   AGENCY — JURIDICTION (offices avec labels adaptés)
   ═══════════════════════════════════════════════ */
function renderJuridiction() {
  renderOffices('agency');
}

/* ═══════════════════════════════════════════════
   AGENCY — SERVICES (products avec champ coverage)
   ═══════════════════════════════════════════════ */
var _SERVICE_ACCESS = ['Public','On Request','Restricted','Classified'];

function renderServices() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  var allItems = org.products.items || [];
  var visible  = allItems.filter(function(p){ return _privateMode || !p.isPrivate; });

  function _svcCard(p) {
    var realIdx = allItems.indexOf(p);
    var accessColor = { 'Public':'#1a7a2e', 'On Request':'#3a7bd5', 'Restricted':'#b8860b', 'Classified':'#c44' }[p.availability||'Public'] || '#888';
    if (_viewMode) {
      return '<div class="prod-card'+(p.isPrivate?' prod-private':'')+'">' +
        '<div class="prod-card-body">' +
          '<div class="prod-card-name">'+_esc(p.name||'—')+'</div>' +
          (p.category ? '<div class="prod-card-cat">'+_esc(p.category)+'</div>' : '') +
          (p.description ? '<div class="prod-card-desc">'+_esc(p.description)+'</div>' : '') +
          '<div class="prod-card-footer">' +
            (p.coverage ? '<span style="font-size:11px;color:#888">📍 '+_esc(p.coverage)+'</span>' : '<span></span>') +
            '<span class="prod-avail" style="background:'+accessColor+';color:#fff;padding:1px 6px;border-radius:2px;font-size:11px">'+_esc(p.availability||'Public')+'</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    return '<div class="prod-card prod-card-edit'+(p.isPrivate?' prod-private':'')+'">' +
      '<div class="prod-card-body">' +
        '<input class="prod-card-name-edit" value="'+_esc(p.name||'')+'" placeholder="Service name" oninput="prodSet('+realIdx+',\'name\',this.value)">' +
        '<input class="prod-card-cat-edit" value="'+_esc(p.category||'')+'" placeholder="Service type" oninput="prodSet('+realIdx+',\'category\',this.value)">' +
        '<textarea class="prod-card-desc-edit" placeholder="Description" oninput="prodSet('+realIdx+',\'description\',this.value)">'+_esc(p.description||'')+'</textarea>' +
        '<div class="prod-card-price-row">' +
          '<input class="prod-card-price-edit" value="'+_esc(p.coverage||'')+'" placeholder="Zone / coverage" oninput="prodSet('+realIdx+',\'coverage\',this.value)">' +
          '<select class="prod-avail-select" onchange="prodSet('+realIdx+',\'availability\',this.value)">'+_SERVICE_ACCESS.map(function(a){ return '<option'+(p.availability===a?' selected':'')+'>'+a+'</option>'; }).join('')+'</select>' +
        '</div>' +
        '<div class="prod-card-edit-row">' +
          '<input class="prod-card-subcat-edit" value="'+_esc(p.subcat||'')+'" placeholder="Division..." oninput="prodSet('+realIdx+',\'subcat\',this.value)">' +
          (_privateMode ? '<label class="prod-private-lbl"><input type="checkbox"'+(p.isPrivate?' checked':'')+' onchange="prodSet('+realIdx+',\'isPrivate\',this.checked);renderServices()"> Privé</label>' : '') +
          '<span class="org-rm" onclick="removeProd('+realIdx+');renderServices()">✕</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Services & Programs' + (!_viewMode ? '<span class="org-section-add" onclick="addServiceItem()">＋</span>' : '') + '</div>' +
      '<div class="org-section-body" style="padding:14px">' +
        (visible.length || !_viewMode ? '<div class="prod-grid">'+visible.map(_svcCard).join('')+'</div>' : '<div class="org-empty-hint">No services listed.</div>') +
      '</div>' +
    '</div>' +
  '</div>';
}
function addServiceItem() {
  var org = _getActive(); if (!org) return;
  org.products.items.push({ id:_uid(), name:'', category:'', description:'', price:'', availability:'Public', isPrivate:false, image:'', subcat:'', coverage:'' });
  renderServices();
}

/* ═══════════════════════════════════════════════
   AGENCY — BUDGET
   ═══════════════════════════════════════════════ */
function renderBudget() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.budget) org.budget = { publicNotes:'', privateNotes:'', annualBudget:'', fundingSource:'', departments:[] };
  var b = org.budget;

  var deptRows = (b.departments||[]).map(function(d, i) {
    return '<div class="budget-dept-row">' +
      '<input class="org-input" style="flex:2" value="'+_esc(d.name||'')+'" placeholder="Department" oninput="_getActive().budget.departments['+i+'].name=this.value">' +
      '<input class="org-input" style="flex:1;text-align:right" value="'+_esc(d.allocation||'')+'" placeholder="Allocation" oninput="_getActive().budget.departments['+i+'].allocation=this.value">' +
      '<span class="org-rm" onclick="removeBudgetDept('+i+')">✕</span>' +
    '</div>';
  }).join('') || '<div class="org-empty-hint">No allocations listed.</div>';

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Public Budget</div>' +
      '<div class="org-section-body">' +
        '<div class="org-field-row">' +
          '<div class="org-field"><label>Annual Budget</label>' + (_viewMode ? '<div class="org-view-text">'+_esc(b.annualBudget||'—')+'</div>' : '<input class="org-input" value="'+_esc(b.annualBudget||'')+'" oninput="orgSet_nested(\'budget\',\'annualBudget\',this.value)">') + '</div>' +
          '<div class="org-field"><label>Funding Source</label>' + (_viewMode ? '<div class="org-view-text">'+_esc(b.fundingSource||'—')+'</div>' : '<input class="org-input" value="'+_esc(b.fundingSource||'')+'" placeholder="Governmental, corporate, mixed..." oninput="orgSet_nested(\'budget\',\'fundingSource\',this.value)">') + '</div>' +
        '</div>' +
        '<div class="org-field"><label>Public Notes</label>' +
          (_viewMode ? '<div class="org-view-text">'+_esc(b.publicNotes||'')+'</div>' : '<textarea class="org-textarea" oninput="orgSet_nested(\'budget\',\'publicNotes\',this.value)">'+_esc(b.publicNotes||'')+'</textarea>') +
        '</div>' +
      '</div>' +
    '</div>' +
    (_privateMode ? '<div class="org-section">' +
      '<div class="org-section-head">🔒 Allocations (GM)</div>' +
      '<div class="org-section-body">' +
        '<div class="budget-dept-header"><span>Department</span><span>Allocation</span></div>' +
        '<div id="budget-dept-list">'+deptRows+'</div>' +
        (!_viewMode ? '<button class="btn btn-sm" style="margin-top:6px" onclick="addBudgetDept()">＋ Department</button>' : '') +
        '<div class="org-field" style="margin-top:12px"><label>GM Notes (private)</label>' +
          (_viewMode ? '<div class="org-view-text org-view-text-private">'+_esc(b.privateNotes||'')+'</div>' : '<textarea class="org-textarea org-textarea-private" oninput="orgSet_nested(\'budget\',\'privateNotes\',this.value)">'+_esc(b.privateNotes||'')+'</textarea>') +
        '</div>' +
      '</div>' +
    '</div>' : '') +
  '</div>';
}
function addBudgetDept() {
  var org = _getActive(); if (!org) return;
  if (!org.budget.departments) org.budget.departments = [];
  org.budget.departments.push({ name:'', allocation:'' });
  renderBudget();
}
function removeBudgetDept(i) { var org = _getActive(); if (!org) return; org.budget.departments.splice(i,1); renderBudget(); }

/* ═══════════════════════════════════════════════
   AGENCY — POSTES / GROUPE — RECRUTEMENT (shared jobs variant)
   ═══════════════════════════════════════════════ */
function renderPostes() { renderJobsVariant('agency'); }

function renderJobsVariant(type) {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  var jobs = (org.jobs.openings||[]).filter(function(j){ return _privateMode || !j.isPrivate; });

  var isAgency = type === 'agency';
  var isGroupe = type === 'groupe';
  var headLabel = isAgency ? 'Positions & Assignments' : 'Recruitment';

  var cardsHtml = jobs.length ? jobs.map(function(j) {
    var realIdx = org.jobs.openings.indexOf(j);
    var open = !!_jobOpen[j.id];
    var riskCls = (j.risk||'low').toLowerCase();
    var cardBody = _viewMode
      ? '<div class="job-card-body'+(open?' open':'')+'">' +
          '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">' +
            (j.department ? '<div><label>'+(isAgency?'Unit/Division':'Cell')+'</label><div class="org-view-text">'+_esc(j.department)+'</div></div>' : '') +
            (isAgency && j.grade ? '<div><label>Grade</label><div class="org-view-text">'+_esc(j.grade)+'</div></div>' : '') +
            (j.pay ? '<div><label>'+(isGroupe?'Cut':'Salary')+'</label><div class="org-view-text">'+_esc(j.pay)+' eb '+(j.payPeriod?_esc(j.payPeriod):'')+'</div></div>' : '') +
            (isAgency && j.equipment ? '<div><label>Provided Equipment</label><div class="org-view-text">'+_esc(j.equipment)+'</div></div>' : '') +
          '</div>' +
          (j.requirements ? '<div class="org-field"><label>Requirements</label><div class="org-view-text">'+_esc(j.requirements)+'</div></div>' : '') +
          (j.description ? '<div class="org-field"><label>Description</label><div class="org-view-text">'+_esc(j.description)+'</div></div>' : '') +
        '</div>'
      : '<div class="job-card-body'+(open?' open':'')+'">' +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>'+(isGroupe?'Role in Group':'Title')+'</label><input class="org-input" value="'+_esc(j.title||'')+'" onchange="jobSet('+realIdx+',\'title\',this.value)"></div>' +
            '<div class="org-field"><label>'+(isAgency?'Unit/Division':'Cell')+'</label><input class="org-input" value="'+_esc(j.department||'')+'" onchange="jobSet('+realIdx+',\'department\',this.value)"></div>' +
          '</div>' +
          (isAgency ? '<div class="org-field-row">' +
            '<div class="org-field"><label>Grade / Rank</label><input class="org-input" value="'+_esc(j.grade||'')+'" placeholder="Ex: Officier, Lieutenant..." onchange="jobSet('+realIdx+',\'grade\',this.value)"></div>' +
            '<div class="org-field"><label>Provided Equipment</label><input class="org-input" value="'+_esc(j.equipment||'')+'" onchange="jobSet('+realIdx+',\'equipment\',this.value)"></div>' +
          '</div>' : '') +
          '<div class="org-field-row">' +
            '<div class="org-field"><label>'+(isGroupe?'Cut':'Salary')+' (eb)</label><input class="org-input" value="'+_esc(j.pay||'')+'" onchange="jobSet('+realIdx+',\'pay\',this.value)"></div>' +
            '<div class="org-field"><label>Pay Period</label><select class="org-select" style="width:100%" onchange="jobSet('+realIdx+',\'payPeriod\',this.value)">'+_PAY_PERIOD.map(function(p){ return '<option'+(j.payPeriod===p?' selected':'')+'>'+p+'</option>'; }).join('')+'</select></div>' +
            '<div class="org-field"><label>Risk</label><select class="org-select" style="width:100%" onchange="jobSet('+realIdx+',\'risk\',this.value)">'+_RISK.map(function(r){ return '<option'+(j.risk===r?' selected':'')+'>'+r+'</option>'; }).join('')+'</select></div>' +
          '</div>' +
          '<div class="org-field"><label>Requirements</label><textarea class="org-textarea" style="min-height:50px" oninput="jobSet('+realIdx+',\'requirements\',this.value)">'+_esc(j.requirements||'')+'</textarea></div>' +
          '<div class="org-field"><label>Description</label><textarea class="org-textarea" oninput="jobSet('+realIdx+',\'description\',this.value)">'+_esc(j.description||'')+'</textarea></div>' +
          '<div class="org-field"><label>Durée</label><input class="org-input" value="'+_esc(j.duration||'')+'" placeholder="Ex: Une nuit, Permanent..." onchange="jobSet('+realIdx+',\'duration\',this.value)"></div>' +
          (_privateMode ? '<label class="org-settings-row"><input type="checkbox"'+(j.isPrivate?' checked':'')+' onchange="jobSet('+realIdx+',\'isPrivate\',this.checked)"> GM Only</label>' : '') +
          '<div class="org-card-actions"><button class="btn btn-sm btn-red" onclick="removeJob('+realIdx+')">Supprimer</button></div>' +
        '</div>';
    return '<div class="job-card'+(j.isPrivate?' job-private':'')+'">' +
      '<div class="job-card-head" onclick="toggleJob(\''+j.id+'\')">' +
        '<span class="job-title">'+_esc(j.title||'Poste sans titre')+'</span>' +
        (j.department ? '<span style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+_esc(j.department)+'</span>' : '') +
        (isAgency && j.grade ? '<span style="font-family:var(--mono);font-size:11px;color:#3a7bd5">'+_esc(j.grade)+'</span>' : '') +
        (j.pay ? '<span class="job-pay">'+_esc(j.pay)+' eb</span>' : '') +
        '<span class="job-risk '+riskCls+'">'+(j.risk||'Low')+'</span>' +
        '<span style="font-size:13px;color:#bbb;margin-left:4px">'+(open?'▲':'▼')+'</span>' +
      '</div>' +
      cardBody +
    '</div>';
  }).join('') : '<div class="org-empty-hint">No positions listed.</div>';

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">'+headLabel+(!_viewMode?'<span class="org-section-add" onclick="addJobVariant()">＋</span>':'')+'</div>' +
      '<div class="org-section-body">'+cardsHtml+'</div>' +
    '</div>' +
  '</div>';
}
function addJobVariant() {
  var org = _getActive(); if (!org) return;
  var j = { id:_uid(), title:'', department:'', grade:'', equipment:'', pay:'', payPeriod:'per month', risk:'Low', requirements:'', description:'', duration:'', isPrivate:false };
  org.jobs.openings.push(j);
  _jobOpen[j.id] = true;
  var type = org.type;
  if (type === 'agency') renderPostes(); else if (type === 'groupe') renderRecruitment(); else renderJobs();
}

/* ═══════════════════════════════════════════════
   GROUPE — FONDS (diverging bar chart)
   ═══════════════════════════════════════════════ */

/*
  SVG stacked single-bar chart, straddling a zero line.
  - ONE vertical bar, centered.
  - Declared sources stack UPWARD from the zero line (one segment per source).
  - Hidden/illegal sources stack DOWNWARD from the zero line.
  - Each segment height = (amount / total) * maxTotalH  →  proportional to its share of all funding.
  - The zero line position is dynamic: it sits at the boundary between declared and hidden zones,
    so its vertical position reflects the declared/hidden split.
  - Labels connect to each segment with a short horizontal tick.
*/
function _buildFundsChart(sources, gangColor) {
  var W = 560, barX = 210, barW = 90, topPad = 28, botPad = 24, maxTotalH = 160;

  function parseAmt(s) { var n=parseFloat((s.amount||'').replace(/[^0-9.]/g,'')); return(isNaN(n)||n<=0)?1:n; }
  function hexToRgb(h) { h=h.replace('#',''); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
  var gc = hexToRgb(gangColor||'#c44')||{r:196,g:68,b:68};

  var declPalette = [
    'rgba('+gc.r+','+gc.g+','+gc.b+',0.90)',
    'rgba('+gc.r+','+gc.g+','+gc.b+',0.68)',
    'rgba('+gc.r+','+gc.g+','+gc.b+',0.48)',
    'rgba('+gc.r+','+gc.g+','+gc.b+',0.80)'
  ];
  var hidePalette = ['#7a1a1a','#5c1515','#993322','#7a2a1a'];

  // Empty state
  if (!sources.length) {
    var eh = topPad + maxTotalH + botPad;
    return '<svg class="funds-chart-svg" viewBox="0 0 '+W+' 60" preserveAspectRatio="xMidYMid meet">' +
      '<line x1="20" y1="30" x2="'+(W-20)+'" y2="30" stroke="#ccc" stroke-width="1.5"/>' +
      '<text x="'+(W/2)+'" y="26" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="#bbb">no sources — add one below</text>' +
    '</svg>';
  }

  var declared = sources.filter(function(s){ return s.declared !== false && s.category !== 'illegal'; });
  var hidden   = sources.filter(function(s){ return s.declared === false  || s.category === 'illegal'; });

  var total      = sources.reduce(function(acc,s){ return acc+parseAmt(s); }, 0) || 1;
  var declTotal  = declared.reduce(function(acc,s){ return acc+parseAmt(s); }, 0);
  // Zero line sits at topPad + height of declared zone
  var declZoneH  = Math.round((declTotal / total) * maxTotalH);
  var zeroY      = topPad + declZoneH;
  var svgH       = topPad + maxTotalH + botPad;

  var segments = '', connectors = '', labels = '';

  // ── Declared segments — stack upward from zeroY ──
  var curY = zeroY;
  declared.forEach(function(s, i) {
    var h   = Math.max(5, Math.round((parseAmt(s)/total) * maxTotalH));
    curY   -= h;
    var col = declPalette[i % declPalette.length];
    var midY = curY + h/2;

    segments += '<rect x="'+barX+'" y="'+curY+'" width="'+barW+'" height="'+h+'" fill="'+col+'"><title>'+_esc(s.name||'—')+(s.amount?' — '+_esc(s.amount):'')+'</title></rect>';

    // Amount inside if tall enough
    if (h >= 18) {
      segments += '<text x="'+(barX+barW/2)+'" y="'+(midY+4)+'" text-anchor="middle" font-family="var(--mono)" font-size="8" fill="#fff" opacity="0.85">'+(s.amount?_esc(s.amount):'')+'</text>';
    }

    // Label right
    var lx = barX + barW + 10;
    var label = (s.name||'—'); if(label.length>22) label=label.slice(0,21)+'…';
    connectors += '<line x1="'+(barX+barW)+'" y1="'+midY+'" x2="'+(lx-2)+'" y2="'+midY+'" stroke="'+col+'" stroke-width="1" opacity="0.45"/>';
    labels += '<text x="'+lx+'" y="'+(midY+3)+'" font-family="var(--head)" font-size="9" letter-spacing="0.3" fill="#333">'+_esc(label)+'</text>';
    if (s.amount && h < 18) {
      labels += '<text x="'+lx+'" y="'+(midY+13)+'" font-family="var(--mono)" font-size="8" fill="#999">'+_esc(s.amount)+'</text>';
    }
  });

  // ── Hidden segments — stack downward from zeroY ──
  curY = zeroY;
  hidden.forEach(function(s, i) {
    var h   = Math.max(5, Math.round((parseAmt(s)/total) * maxTotalH));
    var col = hidePalette[i % hidePalette.length];
    var midY = curY + h/2;

    segments += '<rect x="'+barX+'" y="'+curY+'" width="'+barW+'" height="'+h+'" fill="'+col+'"><title>'+_esc(s.name||'—')+(s.amount?' — '+_esc(s.amount):'')+'</title></rect>';

    if (h >= 18) {
      segments += '<text x="'+(barX+barW/2)+'" y="'+(midY+4)+'" text-anchor="middle" font-family="var(--mono)" font-size="8" fill="#fff" opacity="0.75">'+(s.amount?_esc(s.amount):'')+'</text>';
    }

    // Label left
    var lx = barX - 10;
    var label = (s.name||'—'); if(label.length>22) label=label.slice(0,21)+'…';
    connectors += '<line x1="'+barX+'" y1="'+midY+'" x2="'+(lx+2)+'" y2="'+midY+'" stroke="'+col+'" stroke-width="1" opacity="0.45"/>';
    labels += '<text x="'+lx+'" y="'+(midY+3)+'" text-anchor="end" font-family="var(--head)" font-size="9" letter-spacing="0.3" fill="#993322">'+_esc(label)+'</text>';
    if (s.amount && h < 18) {
      labels += '<text x="'+lx+'" y="'+(midY+13)+'" text-anchor="end" font-family="var(--mono)" font-size="8" fill="#8a4444">'+_esc(s.amount)+'</text>';
    }

    curY += h;
  });

  // Zone background tints
  var bg = (declZoneH > 0 ? '<rect x="'+(barX-2)+'" y="'+topPad+'" width="'+(barW+4)+'" height="'+declZoneH+'" fill="#f0f7ff" opacity="0.5"/>' : '') +
           ((maxTotalH - declZoneH) > 0 ? '<rect x="'+(barX-2)+'" y="'+zeroY+'" width="'+(barW+4)+'" height="'+(maxTotalH-declZoneH)+'" fill="#200505" opacity="0.12"/>' : '');

  // Zone labels (above/below bar)
  var zoneLabels =
    (declared.length ? '<text x="'+(barX+barW/2)+'" y="'+(topPad-8)+'" text-anchor="middle" font-family="var(--head)" font-size="7.5" letter-spacing="2" fill="#3a6080" opacity="0.7">DECLARED</text>' : '') +
    (hidden.length   ? '<text x="'+(barX+barW/2)+'" y="'+(topPad+maxTotalH+botPad-6)+'" text-anchor="middle" font-family="var(--head)" font-size="7.5" letter-spacing="2" fill="#8a3030" opacity="0.7">HIDDEN</text>' : '');

  // Zero line (on top of everything)
  var zeroLine = '<line x1="'+(barX-18)+'" y1="'+zeroY+'" x2="'+(barX+barW+18)+'" y2="'+zeroY+'" stroke="#333" stroke-width="1.5" opacity="0.6"/>' +
    '<text x="'+(barX-22)+'" y="'+(zeroY+4)+'" text-anchor="end" font-family="var(--mono)" font-size="8" fill="#888">0</text>';

  return '<svg class="funds-chart-svg" viewBox="0 0 '+W+' '+svgH+'" preserveAspectRatio="xMidYMid meet">' +
    bg + segments + connectors + zeroLine + zoneLabels + labels +
  '</svg>';
}

function renderFunds() {
  var el = document.getElementById('org-tab-content'); if (!el) return;
  var org = _getActive(); if (!org) return;
  if (!org.funds) org.funds = { sources:[], publicNotes:'', privateNotes:'' };
  var funds = org.funds;
  var sources = funds.sources || [];

  // Editable sources list — only visible in edit mode or private mode
  var canSeeList = !_viewMode || _privateMode;
  var listHtml = '';
  if (canSeeList) {
    var addBtns = !_viewMode
      ? '<span class="org-section-add" style="display:flex;gap:4px;margin-left:auto">' +
          '<button class="btn btn-sm" onclick="addFundSrc(\'legal\',true)" style="font-size:11px;padding:1px 6px">+ Declared</button>' +
          '<button class="btn btn-sm" onclick="addFundSrc(\'illegal\',false)" style="font-size:11px;padding:1px 6px">+ Hidden</button>' +
        '</span>' : '';
    var rowsHtml = sources.length ? sources.map(function(s, idx) {
      var col = s.category==='illegal'?'#7a1a1a':s.category==='legal'?'#1a4a2e':'#444';
      if (_viewMode) {
        return '<div class="funds-src-row">' +
          '<div class="funds-src-color" style="background:'+col+'"></div>' +
          '<span class="funds-src-name">'+_esc(s.name||'—')+'</span>' +
          (s.amount ? '<span class="funds-src-amt">'+_esc(s.amount)+'</span>' : '') +
          '<span class="funds-src-cat" style="color:'+col+'">'+_esc(s.category||'legal')+'</span>' +
          '<span class="funds-src-decl">'+(s.declared!==false?'declared':'hidden')+'</span>' +
        '</div>';
      }
      return '<div class="funds-src-row">' +
        '<div class="funds-src-color" style="background:'+col+'"></div>' +
        '<input class="org-input funds-src-input" value="'+_esc(s.name||'')+'" placeholder="Source name…" oninput="fundSrcSet('+idx+',\'name\',this.value)">' +
        '<input class="org-input funds-src-input funds-src-amt-input" value="'+_esc(s.amount||'')+'" placeholder="Amount" oninput="fundSrcSet('+idx+',\'amount\',this.value)">' +
        '<select class="org-select funds-src-select" onchange="fundSrcSet('+idx+',\'category\',this.value)">' +
          '<option value="legal"'+(s.category==='legal'?' selected':'')+'>Legal</option>' +
          '<option value="illegal"'+(s.category==='illegal'?' selected':'')+'>Illegal</option>' +
        '</select>' +
        '<label class="funds-src-decl-lbl">' +
          '<input type="checkbox"'+(s.declared!==false?' checked':'')+' onchange="fundSrcSet('+idx+',\'declared\',this.checked)"> Declared' +
        '</label>' +
        '<span class="org-rm" onclick="removeFundSrc('+idx+')">✕</span>' +
      '</div>';
    }).join('') : '<div class="org-empty-hint">No income sources. Add one above.</div>';

    listHtml = '<div class="org-section">' +
      '<div class="org-section-head">Income Sources' + addBtns + '</div>' +
      '<div class="org-section-body" style="padding:8px 12px;gap:4px" id="funds-src-list">' + rowsHtml + '</div>' +
    '</div>';
  }

  var notesHtml = '<div class="org-section">' +
    '<div class="org-section-head">Notes</div>' +
    '<div class="org-section-body">' +
      '<div class="org-field"><label>Public notes</label>' +
        (_viewMode ? '<div class="org-view-text">'+_esc(funds.publicNotes||'')+'</div>' : '<textarea class="org-textarea" style="min-height:60px" oninput="orgSet_nested(\'funds\',\'publicNotes\',this.value)">'+_esc(funds.publicNotes||'')+'</textarea>') +
      '</div>' +
      (_privateMode ? '<div class="org-field"><label>GM Notes (private)</label>' +
        (_viewMode ? '<div class="org-view-text org-view-text-private">'+_esc(funds.privateNotes||'')+'</div>' : '<textarea class="org-textarea org-textarea-private" style="min-height:60px" oninput="orgSet_nested(\'funds\',\'privateNotes\',this.value)">'+_esc(funds.privateNotes||'')+'</textarea>') +
      '</div>' : '') +
    '</div>' +
  '</div>';

  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';

  el.innerHTML = '<div class="org-tab-body">' +
    '<div class="org-section">' +
      '<div class="org-section-head">Financial Overview</div>' +
      '<div class="org-section-body" style="padding:8px 12px" id="funds-chart-wrap">' +
        _buildFundsChart(sources, gangColor) +
      '</div>' +
    '</div>' +
    listHtml +
    notesHtml +
  '</div>';
}
function fundSrcSet(idx, field, val) {
  var org = _getActive(); if (!org) return;
  if (!org.funds || !org.funds.sources[idx]) return;
  org.funds.sources[idx][field] = val;
  _schedSave();
  // Refresh chart on any structural change (amount shifts bar heights; category/declared shift sides)
  if (field === 'category' || field === 'declared' || field === 'amount') { _refreshFundsChart(); }
}
function _refreshFundsChart() {
  var wrap = document.getElementById('funds-chart-wrap');
  if (!wrap) { renderFunds(); return; }
  var org = _getActive(); if (!org) return;
  var gangColor = ((org.reputation||{}).colors||{}).primary || (org.reputation||{}).color || '#c44';
  wrap.innerHTML = _buildFundsChart((org.funds||{}).sources || [], gangColor);
}
function addFundSrc(category, declared) {
  var org = _getActive(); if (!org) return;
  if (!org.funds) org.funds = { sources:[], publicNotes:'', privateNotes:'' };
  org.funds.sources.push({ id:_uid(), name:'', category:category||'legal', declared:declared!==false, amount:'', notes:'' });
  renderFunds();
}
function removeFundSrc(idx) {
  var org = _getActive(); if (!org) return;
  if (!org.funds) return;
  org.funds.sources.splice(idx,1);
  _schedSave();
  renderFunds();
}

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async function() {
  window.__cdoc = new URLSearchParams(window.location.search).get('cdoc') === '1';
  if (window.__cdoc) {
    // File-bridge mode: the org is loaded from a campaign file by campaign-doc.js.
    _orgs = [];
    window.__cdocAdapter = {
      load: function (json) { if (!json || !Object.keys(json).length) return; _migrateOrg(json); _orgs = [json]; _activeId = json.id; renderSidebar(); renderMain(); },
      serialize: function () { return _getActive(); },
    };
    renderSidebar(); renderMain();
    return;
  }
  _loadFromStorage();

  /* ── Load bundled orgs (always fresh from file, never persisted) ── */
  var _bundledFiles = [
    'data/arasaka.org.json'
  ];
  for (var _bi = 0; _bi < _bundledFiles.length; _bi++) {
    try {
      var _resp = await fetch(_bundledFiles[_bi]);
      if (!_resp.ok) throw new Error(_resp.status);
      var _bOrg = await _resp.json();
      _migrateOrg(_bOrg);
      _bOrg._bundled = true;
      _BUNDLED_IDS.push(_bOrg.id);
      // Replace if already present (e.g. stale localStorage copy), otherwise prepend
      var _bIdx = _orgs.map(function(o){ return o.id; }).indexOf(_bOrg.id);
      if (_bIdx >= 0) _orgs[_bIdx] = _bOrg; else _orgs.unshift(_bOrg);
    } catch(e) { console.warn('Could not load bundled org:', _bundledFiles[_bi], e); }
  }

  renderSidebar();
  renderMain();
});
