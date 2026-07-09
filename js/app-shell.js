/* app-shell.js — ASIDE FORK: the browser-style session shell.
   ───────────────────────────────────────────────────────────────────────────
   A translucent left sidebar (à la Aside/Arc) with three zones, top→bottom:
     1. Search  — fuzzy over sections · views · objects (reuses window.AppNav)
     2. Grid    — the six sections as launcher tiles (icon + label)
     3. Tabs    — one UNIFIED list of every open tab (section + entity, mixed)
   Behaviour: sections don't "switch" — clicking a tile OPENS A NEW TAB. Every
   open thing is a tab in the same sidebar list. DATA's default tab is the total
   corpus view (types + saved views); its per-type/per-view tabs open on click.
   The content stage (#tab-stage) reuses the existing lazy, persistent pane
   engine — panes never reload on tab switch (display toggle; iframes keep state).
   Public window.Shell API is preserved so app.js + the palette keep working.
   Depends on window.App (+ bridge from app.js via Shell.bind). */
(function () {
  'use strict';
  var App = window.App;
  var esc, el, uid, reduceMotion;

  var B = null;                              // bridge into app.js internals
  var state = { tabs: [], activeTab: null, groups: [] }; // ONE global tab list (+ tab groups)
  var _closed = [];                          // ⌘⇧T reopen stack
  var _lastPane = null;                      // one-shot pane-in animation guard
  var _reveal = false;                       // transient: sidebar shown in auto-hide mode
  var _searchEnts = [];                       // cached corpus entities for the search

  /* ── sections ── */
  var SECTIONS = [
    { key: 'party',  label: 'Party',  sub: 'Player sheets',   glyph: 'P', tools: { gm: ['party'],     player: ['sheet'] } },
    { key: 'data',   label: 'Data',   sub: 'The campaign corpus', glyph: 'D', tools: { gm: ['data-home'], player: ['data-home'] } },
    { key: 'map',    label: 'Map',    sub: 'Night City & maps', glyph: 'M', tools: { gm: ['map'],       player: ['map'] } },
    { key: 'cast',   label: 'Cast',   sub: 'Broadcast to players', glyph: 'C', tools: { gm: ['cast-home'], player: ['cast-home'] } },
    { key: 'combat', label: 'Combat', sub: 'Encounters & gangs', glyph: 'X', tools: { gm: ['combat'],    player: ['combat'] } },
    { key: 'web',    label: 'Net',    sub: 'The Net',          glyph: 'W', tools: { gm: ['web-home'], player: ['web-home'] } },
  ];
  // tool id → owning section (for the tab's icon + Shell.state().active compat)
  var TOOL_SECTION = {
    party: 'party', sheet: 'party',
    'data-home': 'data', 'data-view': 'data', 'data-db': 'data', npc: 'data', org: 'data', shop: 'data', database: 'data',
    map: 'map', cast: 'cast', 'cast-home': 'cast', clocks: 'cast',
    combat: 'combat', 'web-home': 'web', 'web-browse': 'web', 'web-hosts': 'web', 'web-placeholder': 'web', desktop: 'desktop', log: null,
  };
  // legacy tool ids (palette / cross-nav) → DATA tabs in the new system
  var LEGACY_DATA = { npc: { tool: 'data-view', dtype: 'npc' }, org: { tool: 'data-view', dtype: 'org' }, shop: { tool: 'data-view', dtype: 'shop' }, database: { tool: 'data-db' } };
  var TOOL_LABEL = {
    party: 'Party', sheet: 'My sheet', 'data-home': 'Data', 'data-view': 'Corpus', 'data-db': 'Database',
    'cast-home': 'Cast', map: 'Map', combat: 'Combat', clocks: 'Clocks', 'web-placeholder': 'Web',
    'web-home': 'Net', 'web-browse': 'Browser', 'web-hosts': 'Hosts', desktop: 'Desktop',
  };

  function role() { return (B && B.sess && B.sess.role) || 'gm'; }
  function sectionOf(key) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].key === key) return SECTIONS[i]; return null; }
  function sectionDefs() { return SECTIONS.filter(function (s) { return s.disabled || (s.tools[role()] || []).length; }); }
  function defaultTool(key) { var s = sectionOf(key); return s ? (s.tools[role()] || [])[0] || null : null; }
  function tabSection(t) {
    if (!t) return 'data';
    if (t.kind) return t.kind === 'sheet' ? 'party' : (t.kind === 'cast' || t.kind === 'clock') ? 'cast' : (t.kind === 'site') ? 'web' : 'data';
    var s = TOOL_SECTION[t.tool]; return s || 'data';
  }

  /* ── iconography = Unicode glyphs (DS house rule: never SVG/emoji) ── */
  var GLYPH = {
    party: '⧉', data: '▤', map: '▦', cast: '⊡', combat: '◎', web: '⌾', desktop: '▚',
    sheet: '⒜', npc: '☺', org: '⌗', shop: '▣', location: '◰', item: '◈', clock: '◴', site: '⌾',
    search: '⌕', close: '✕', plus: '＋', dots: '⋯',
  };
  function glyph(name, cls) { return '<span class="asd-ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + (GLYPH[name] || '·') + '</span>'; }
  function tabIcon(t) { return t.kind ? (GLYPH[t.kind] ? t.kind : 'item') : tabSection(t); }

  /* ── state persistence (per-campaign, meta.ui.shell) ── */
  function blankState() {
    // Land on the corpus: a single DATA-home tab, active.
    var t = { id: uid('tab'), tool: 'data-home' };
    return { tabs: [t], activeTab: t.id, groups: [] };
  }
  function snapshot() {
    return {
      activeIdx: Math.max(0, state.tabs.map(function (t) { return t.id; }).indexOf(state.activeTab)),
      groups: (state.groups || []).map(function (g) { return { id: g.id, name: g.name, collapsed: !!g.collapsed }; }),
      tabs: state.tabs.map(function (t) {
        return { tool: t.tool || null, kind: t.kind || null, ref: t.ref || null, label: t.label || null,
          dtype: t.dtype || null, view: t.view || null, db: t.db || null, builtin: t.builtin || null, group: t.group || null };
      }),
    };
  }
  function persist() { if (role() === 'gm') App.uiSet('shell', snapshot()); }
  function restoreFrom(saved) {
    if (!saved) return blankState();
    // migrate the old per-section shape {sections:{key:{tabs}}} → one flat list
    var flat = [];
    if (saved.sections && !saved.tabs) {
      Object.keys(saved.sections).forEach(function (k) { (saved.sections[k].tabs || []).forEach(function (t) { flat.push(t); }); });
    } else if (Array.isArray(saved.tabs)) {
      flat = saved.tabs;
    }
    if (!flat.length) return blankState();
    var groups = Array.isArray(saved.groups) ? saved.groups.map(function (g) { return { id: g.id || uid('grp'), name: g.name || 'Group', collapsed: !!g.collapsed }; }) : [];
    var gids = {}; groups.forEach(function (g) { gids[g.id] = 1; });
    var tabs = flat.map(function (t) {
      var out = { id: uid('tab'), tool: t.tool || null, kind: t.kind || null, ref: t.ref || null, label: t.label || null,
        dtype: t.dtype || null, view: t.view || null, db: t.db || null, builtin: t.builtin || null, group: (t.group && gids[t.group]) ? t.group : null };
      if (out.tool && LEGACY_DATA[out.tool]) { var lg = LEGACY_DATA[out.tool]; out.tool = lg.tool; out.dtype = out.dtype || lg.dtype || null; }
      if (out.tool === 'cast' || out.tool === 'clocks') out.tool = 'cast-home';   // pre-fork tabs → CAST home
      return out;
    });
    var ai = Math.min(Math.max(0, saved.activeIdx || 0), tabs.length - 1);
    return { tabs: tabs, activeTab: tabs[ai].id, groups: groups };
  }

  /* ── mount ── */
  function mount() {
    esc = App.esc; el = App.el; uid = App.uid; reduceMotion = App.reduceMotion;
    var host = el('view-session'); if (!host) return;
    var sh = el('app-shell'); if (sh) { sh.classList.add('in-session'); sh.classList.add('asd'); sh.classList.remove('mode-manage'); sh.classList.add('mode-active'); }
    document.body.classList.add('asd-live');
    state = restoreFrom(App.uiGet('shell', null));
    _lastPane = null;
    host.innerHTML =
      '<div id="shell-root">' +
        '<aside id="asd-side" aria-label="Navigation">' +
          '<div class="asd-head">' +
            '<button class="asd-camp" id="asd-camp"><span class="asd-live" id="asd-live"></span><span class="asd-camp-n" id="asd-camp-n"></span>' + glyph('dots', 'asd-camp-more') + '</button>' +
          '</div>' +
          '<div class="asd-search-wrap">' +
            '<button class="asd-nav" id="asd-back" title="Back (⌘[)" aria-label="Back" disabled>‹</button>' +
            '<button class="asd-nav" id="asd-fwd" title="Forward (⌘])" aria-label="Forward" disabled>›</button>' +
            '<input id="asd-search" class="asd-search" type="text" autocomplete="off" spellcheck="false" placeholder="Jump to anything…" aria-label="Search">' +
            '<div id="asd-results" class="asd-results" hidden></div>' +
          '</div>' +
          '<nav class="asd-grid" id="asd-grid" aria-label="Sections"></nav>' +
          '<div class="asd-tabs">' +
            '<div class="asd-tabs-h"><span>Tabs</span><button class="asd-newtab" id="asd-newtab" title="New tab (⌘T)" aria-label="New tab">' + glyph('plus') + '</button></div>' +
            '<div class="asd-tablist" id="asd-tablist" role="tablist"></div>' +
          '</div>' +
          '<div class="asd-foot">' +
            '<button class="asd-wide" id="asd-desktop" title="Your in-world computer — a full OS with apps &amp; windows"><span class="asd-wide-g" aria-hidden="true">▚</span><span class="asd-wide-l">Desktop</span><span class="asd-wide-s">OS</span></button>' +
            '<button class="asd-collapse" id="asd-collapse" title="Hide sidebar (⌘B)" aria-label="Hide sidebar"><span class="asd-ic">‹</span> HIDE</button>' +
          '</div>' +
        '</aside>' +
        '<main id="asd-stage-wrap"><div id="tab-stage"></div></main>' +
        '<div id="asd-reveal" title="Show sidebar (⌘B)" aria-label="Show sidebar"></div>' +
        '<button id="asd-show" title="Show sidebar (⌘B)" aria-label="Show sidebar">›</button>' +
      '</div>';
    el('asd-camp').onclick = function (e) { e.stopPropagation(); campMenu(this); };
    el('asd-collapse').onclick = function (e) { e.stopPropagation(); toggleSidebar(); };
    el('asd-newtab').onclick = navNewTab;
    var dbtn = el('asd-desktop'); if (dbtn) dbtn.onclick = function () { openTool('desktop'); };
    _nav = { stack: [], i: -1, jump: false };
    el('asd-back').onclick = function () { navGo(-1); };
    el('asd-fwd').onclick = function () { navGo(1); };
    wireSidebar();
    wireSearch();
    renderGrid();
    renderHeader();
    renderTabs();
    applySidebar();
    if (B && B.ensureCdData) B.ensureCdData(function () { renderGrid(); loadSearchEnts(); if (B.renderCrumbs) B.renderCrumbs(); });
    loadSearchEnts();
    if (B && B.renderMonitor) B.renderMonitor();
  }

  /* ── header (campaign name + live dot + ⋯ menu) ── */
  function renderHeader() {
    var n = el('asd-camp-n'); if (n) n.textContent = (B && B.campName && B.campName()) || 'Campaign';
    var live = el('asd-live'); if (live) live.classList.toggle('on', role() === 'gm');
  }
  function campMenu(btn) {
    if (!window.CtxMenu) return;
    var r = btn.getBoundingClientRect(), items = [];
    items.push({ label: 'Session journal', onClick: openLogDrawer });
    items.push({ label: 'Settings', onClick: settingsModal });
    items.push({ label: 'Keyboard shortcuts', onClick: shortcutsModal });
    items.push({ label: 'Sourcebooks', onClick: function () { if (window.openReaderApp) window.openReaderApp(); } });
    items.push({ sep: true });
    if (role() === 'gm') {
      items.push({ label: 'Share player links', onClick: function () { if (B.shareLinks) B.shareLinks(); } });
      items.push({ label: 'Leave campaign', onClick: function () { if (B.renderCampaigns) B.renderCampaigns(); } });
    } else {
      items.push({ label: 'Leave session', danger: true, onClick: function () { if (B.leaveSession) B.leaveSession(); } });
    }
    items.push({ label: 'Switch role', onClick: function () { if (window.switchRole) window.switchRole(); } });
    CtxMenu.open(r.left, r.bottom + 6, items);
  }

  /* ── sidebar visibility (pinned collapse + auto-hide) ── */
  function sidebarMode() { return App.uiGet('settings.sidebarMode', 'pinned'); }
  function applySidebar() {
    var root = el('shell-root'); if (!root) return;
    var auto = sidebarMode() === 'autohide';
    root.classList.toggle('side-autohide', auto);
    if (auto) { root.classList.remove('side-collapsed'); root.classList.toggle('side-reveal', !!_reveal); }
    else { root.classList.remove('side-reveal'); root.classList.toggle('side-collapsed', !!App.uiGet('settings.sidebarCollapsed', false)); }
  }
  function setReveal(v) { if (_reveal === v) return; _reveal = v; applySidebar(); if (v) { var s = el('asd-search'); } }
  function toggleSidebar() {
    if (sidebarMode() === 'autohide') { setReveal(!_reveal); }
    else { App.uiSet('settings.sidebarCollapsed', !App.uiGet('settings.sidebarCollapsed', false)); applySidebar(); }
  }
  function wireSidebar() {
    var handle = el('asd-reveal'), side = el('asd-side'), show = el('asd-show');
    if (handle) {
      handle.onclick = function () { toggleSidebar(); };
      handle.onmouseenter = function () { if (sidebarMode() === 'autohide') setReveal(true); };
    }
    if (show) {
      show.onclick = function (e) { e.stopPropagation(); toggleSidebar(); };
      show.onmouseenter = function () { if (sidebarMode() === 'autohide') setReveal(true); };
    }
    if (side) {
      side.onmouseleave = function () {
        if (sidebarMode() !== 'autohide') return;
        // keep it open while the user is typing in the search
        if (document.activeElement && side.contains(document.activeElement)) return;
        setReveal(false);
      };
    }
  }

  /* ── section grid — plain launchers; the TABS list below already says what's
        open, so tiles carry no counters. WEB is an assumed teaser. ── */
  function renderGrid() {
    var grid = el('asd-grid'); if (!grid) return;
    grid.innerHTML = sectionDefs().map(function (s) {
      return '<button class="asd-tile' + (s.disabled ? ' is-disabled' : '') + '" data-sec="' + s.key + '"' +
        (s.disabled ? ' title="Coming soon"' : ' title="' + esc(s.sub) + '"') + '>' +
        '<span class="asd-tile-l">' + esc(s.label) + '</span>' +
        (s.disabled ? '<span class="asd-tile-soon">soon</span>' : '') +
        '</button>';
    }).join('');
    grid.querySelectorAll('[data-sec]').forEach(function (b) {
      b.onclick = function () { openSection(b.getAttribute('data-sec')); };
    });
  }

  /* Open a section from the grid. If a tab for its default page already exists
     EXACTLY (the plain /party, /data, /map…), jump to it. If the ACTIVE tab
     already belongs to that section (e.g. /data/npc), NAVIGATE it back to the
     section home — ‹ restores where you were. Otherwise open a new tab. */
  function openSection(key) {
    var s = sectionOf(key); if (!s) return;
    var tool = defaultTool(key);
    if (!tool) return;
    var ex = focusTab(function (t) { return !t.kind && t.tool === tool && !t.dtype && !t.view && !t.db && !t.builtin; });
    if (ex) return;
    var act = activeTab();
    if (act && tabSection(act) === key) {
      act.kind = null; act.ref = null; act.dtype = null; act.view = null; act.db = null; act.builtin = null; act.label = null;
      act.tool = tool;
      var p = paneEl(act.id); if (p) p._rendered = false;
      renderTabs(); persist();
      return;
    }
    addTab({ tool: tool });
  }

  /* ── tab list (sidebar) ── */
  function activeTab() { for (var i = 0; i < state.tabs.length; i++) if (state.tabs[i].id === state.activeTab) return state.tabs[i]; return null; }
  function activeToolId() { var t = activeTab(); return t ? (t.tool || null) : null; }
  function tabLabel(t) { return t.label || (t.tool ? (TOOL_LABEL[t.tool] || t.tool) : 'New tab'); }
  /* The tab's "url" — a terse path shown as pure text in the list. */
  var DATA_KINDS = { npc: 1, org: 1, shop: 1, location: 1, item: 1 };
  function tabUrl(t) {
    if (!t) return '/new';
    if (t.kind) {
      var nm = t.label || t.ref || '';
      if (t.kind === 'sheet') return '/party/' + nm;
      if (t.kind === 'cast') return '/cast/' + nm;
      if (t.kind === 'clock') return '/cast/clock/' + nm;
      if (DATA_KINDS[t.kind]) return '/data/' + t.kind + '/' + nm;
      return '/' + t.kind + '/' + nm;
    }
    var tool = t.tool;
    if (tool === 'data-home') return '/data';
    if (tool === 'data-db') return '/data/database' + (t.db ? '/' + t.db : '');
    if (tool === 'data-view') {
      if (t.builtin === 'contacts') return '/data/contacts';
      if (t.view) return '/data/view/' + (t.label || t.view);
      return '/data/' + (t.dtype || 'npc');
    }
    if (tool === 'cast-home') return '/cast';
    if (tool === 'party') return '/party';
    if (tool === 'sheet') return '/party/me';
    if (tool === 'map') return '/map';
    if (tool === 'combat') return '/combat';
    if (tool === 'web-home') return '/web';
    if (tool === 'web-browse') return '/web/browse' + (t.addr ? '/' + t.addr : '');
    if (tool === 'web-hosts') return '/web/hosts';
    if (tool === 'web-placeholder') return '/web';
    if (tool === 'desktop') return '/desktop';
    if (!tool) return '/new';
    return '/' + tool;
  }

  /* ── tab groups ── */
  function tabById(id) { for (var i = 0; i < state.tabs.length; i++) if (state.tabs[i].id === id) return state.tabs[i]; return null; }
  function groupOf(id) { for (var i = 0; i < state.groups.length; i++) if (state.groups[i].id === id) return state.groups[i]; return null; }
  function pruneGroups() { state.groups = state.groups.filter(function (g) { return state.tabs.some(function (t) { return t.group === g.id; }); }); }
  function toggleGroup(id) { var g = groupOf(id); if (g) { g.collapsed = !g.collapsed; renderTabs(); persist(); } }
  function newGroupFromTab(tabId) {
    App.prompt('New tab group', 'Group name', '', function (name) {
      var g = { id: uid('grp'), name: (name || '').trim() || 'Group', collapsed: false };
      state.groups.push(g); var t = tabById(tabId); if (t) t.group = g.id; renderTabs(); persist();
    });
  }
  function addToGroup(tabId, gid) { var t = tabById(tabId); if (t) { t.group = gid; renderTabs(); persist(); } }
  function removeFromGroup(tabId) { var t = tabById(tabId); if (t) { t.group = null; renderTabs(); persist(); } }
  function renameGroup(id) { var g = groupOf(id); if (!g) return; App.prompt('Rename group', 'Group name', g.name, function (n) { g.name = (n || '').trim() || g.name; renderTabs(); persist(); }); }
  function ungroup(id) { state.tabs.forEach(function (t) { if (t.group === id) t.group = null; }); renderTabs(); persist(); }
  function onDropTab(data, targetId) {
    if (data.indexOf('tab:') !== 0) return; var fromId = data.slice(4); if (fromId === targetId) return;
    var t = tabById(fromId), target = tabById(targetId); if (t && target) t.group = target.group || null;
    reorderTab(fromId, targetId);
  }
  function tabMenu(tabId, x, y) {
    if (!window.CtxMenu) return;
    var t = tabById(tabId); if (!t) return;
    var items = [{ label: 'New group…', onClick: function () { newGroupFromTab(tabId); } }];
    state.groups.forEach(function (g) { if (t.group !== g.id) items.push({ label: 'Add to “' + g.name + '”', onClick: function () { addToGroup(tabId, g.id); } }); });
    if (t.group) items.push({ label: 'Remove from group', onClick: function () { removeFromGroup(tabId); } });
    items.push({ sep: true });
    items.push({ label: 'Close tab', danger: true, onClick: function () { closeTab(tabId); } });
    CtxMenu.open(x, y, items);
  }
  function groupMenu(gid, x, y) {
    if (!window.CtxMenu) return; var g = groupOf(gid); if (!g) return;
    CtxMenu.open(x, y, [
      { label: 'Rename group…', onClick: function () { renameGroup(gid); } },
      { label: g.collapsed ? 'Expand' : 'Collapse', onClick: function () { toggleGroup(gid); } },
      { sep: true },
      { label: 'Ungroup', danger: true, onClick: function () { ungroup(gid); } },
    ]);
  }

  function renderTabs() {
    var list = el('asd-tablist'); if (!list) return;
    pruneGroups();
    var html = '', printed = {};
    state.tabs.forEach(function (t) {
      var g = t.group ? groupOf(t.group) : null;
      if (g && !printed[g.id]) {
        printed[g.id] = 1;
        var gc = state.tabs.filter(function (x) { return x.group === g.id; }).length;
        html += '<div class="asd-grp" data-grp="' + g.id + '" title="' + esc(g.name) + '">' +
          '<span class="asd-grp-car">' + (g.collapsed ? '+' : '–') + '</span>' +
          '<span class="asd-grp-n">' + esc(g.name) + '</span><span class="asd-grp-c">' + gc + '</span></div>';
      }
      if (g && g.collapsed) return;
      var on = t.id === state.activeTab, isNew = t._new && !reduceMotion();
      html += '<div class="asd-tab' + (g ? ' asd-tab-grp' : '') + (on ? ' is-active' : '') + (isNew ? ' asd-tab-in' : '') +
        '" data-tab="' + t.id + '" role="tab" aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '" draggable="true">' +
        '<span class="asd-tab-l">' + esc(tabUrl(t)) + '</span>' +
        '<button class="asd-tab-x" data-tabx="' + t.id + '" title="Close (⌘W)" tabindex="-1" aria-label="Close tab">' + glyph('close') + '</button></div>';
    });
    list.innerHTML = html;
    state.tabs.forEach(function (t) { t._new = false; });
    list.querySelectorAll('[data-tab]').forEach(function (d) {
      d.onclick = function (e) { if (e.target.closest('[data-tabx]')) return; selectTab(d.getAttribute('data-tab')); };
      d.oncontextmenu = function (e) { e.preventDefault(); tabMenu(d.getAttribute('data-tab'), e.clientX, e.clientY); };
      d.ondragstart = function (e) { e.dataTransfer.setData('text/plain', 'tab:' + d.getAttribute('data-tab')); d.classList.add('asd-drag'); };
      d.ondragend = function () { d.classList.remove('asd-drag'); };
      d.ondragover = function (e) { e.preventDefault(); };
      d.ondrop = function (e) { e.preventDefault(); onDropTab(e.dataTransfer.getData('text/plain'), d.getAttribute('data-tab')); };
    });
    list.querySelectorAll('[data-tabx]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); closeTab(b.getAttribute('data-tabx')); }; });
    list.querySelectorAll('[data-grp]').forEach(function (d) {
      d.onclick = function () { toggleGroup(d.getAttribute('data-grp')); };
      d.oncontextmenu = function (e) { e.preventDefault(); groupMenu(d.getAttribute('data-grp'), e.clientX, e.clientY); };
      d.ondragover = function (e) { e.preventDefault(); d.classList.add('asd-grp-over'); };
      d.ondragleave = function () { d.classList.remove('asd-grp-over'); };
      d.ondrop = function (e) { e.preventDefault(); d.classList.remove('asd-grp-over'); var data = e.dataTransfer.getData('text/plain'); if (data.indexOf('tab:') === 0) addToGroup(data.slice(4), d.getAttribute('data-grp')); };
    });
    list.onkeydown = function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var ids = state.tabs.map(function (x) { return x.id; }), i = ids.indexOf(state.activeTab);
      if (i < 0) return; i += (e.key === 'ArrowDown' ? 1 : -1); if (i < 0 || i >= ids.length) return;
      e.preventDefault(); selectTab(ids[i]); var nt = list.querySelector('.asd-tab.is-active'); if (nt) nt.focus();
    };
    navRecord();           // every focus change funnels through here
    activatePane();
  }

  /* ── navigation history (browser-style back / forward) ──
     Session-local stack of STATES {tab id, content spec}: it covers both focus
     switches AND in-place navigation (a tab going /data → /data/npc keeps its
     id but changes spec — ‹ restores the previous spec into the same tab).
     renderTabs() is the single funnel every change flows through, so recording
     happens there; navGo() jumps without recording; entries whose tab has
     since closed are skipped. */
  var _nav = { stack: [], i: -1, jump: false };
  function _navLive(id) { return state.tabs.some(function (t) { return t.id === id; }); }
  function specOf(t) {
    return { tool: t.tool || null, kind: t.kind || null, ref: t.ref || null, label: t.label || null,
      dtype: t.dtype || null, view: t.view || null, db: t.db || null, builtin: t.builtin || null };
  }
  function _navKeyOf(t) { return t.id + '|' + paneKey(t); }
  function navRecord() {
    var t = activeTab();
    if (!t) { updateNavBtns(); return; }
    if (_nav.jump) { _nav.jump = false; updateNavBtns(); return; }
    var key = _navKeyOf(t);
    var top = _nav.stack[_nav.i];
    if (top && top.key === key) { updateNavBtns(); return; }
    _nav.stack = _nav.stack.slice(0, _nav.i + 1);
    _nav.stack.push({ id: t.id, key: key, spec: specOf(t) });
    _nav.i = _nav.stack.length - 1;
    if (_nav.stack.length > 60) { _nav.stack.shift(); _nav.i--; }
    updateNavBtns();
  }
  function _navOK(entry) {
    if (!_navLive(entry.id)) return false;
    var t = activeTab();
    return !(t && entry.key === _navKeyOf(t));   // not where we already are
  }
  function navCan(dir) {
    for (var j = _nav.i + dir; j >= 0 && j < _nav.stack.length; j += dir)
      if (_navOK(_nav.stack[j])) return true;
    return false;
  }
  function navGo(dir) {
    var j = _nav.i + dir;
    while (j >= 0 && j < _nav.stack.length && !_navOK(_nav.stack[j])) j += dir;
    if (j < 0 || j >= _nav.stack.length) return;
    var entry = _nav.stack[j];
    _nav.i = j; _nav.jump = true;
    var t = tabById(entry.id);
    Object.assign(t, entry.spec);   // restore content; activatePane re-renders if paneKey changed
    state.activeTab = t.id;
    renderTabs(); persist();
  }
  function updateNavBtns() {
    var b = el('asd-back'), f = el('asd-fwd');
    if (b) b.disabled = !navCan(-1);
    if (f) f.disabled = !navCan(1);
  }

  function addTab(spec) {
    var t = Object.assign({ id: uid('tab') }, spec); t._new = true;
    state.tabs.push(t); state.activeTab = t.id; renderTabs(); persist();
    return t;
  }
  function selectTab(id) { if (state.activeTab === id) return; state.activeTab = id; renderTabs(); persist(); }
  function reorderTab(fromId, toId) {
    if (fromId === toId) return;
    var arr = state.tabs, fi = arr.map(function (t) { return t.id; }).indexOf(fromId), ti = arr.map(function (t) { return t.id; }).indexOf(toId);
    if (fi < 0 || ti < 0) return; var m = arr.splice(fi, 1)[0]; arr.splice(ti, 0, m); renderTabs(); persist();
  }
  function closeTab(id) {
    var arr = state.tabs, i = arr.map(function (t) { return t.id; }).indexOf(id); if (i < 0) return;
    var gone = arr[i];
    if (gone.kind) _closed.push({ kind: gone.kind, ref: gone.ref, label: gone.label });
    else if (gone.tool) _closed.push({ tool: gone.tool, dtype: gone.dtype, view: gone.view, db: gone.db, builtin: gone.builtin, label: gone.label });
    arr.splice(i, 1);
    if (!arr.length) { var nt = { id: uid('tab'), tool: 'data-home', _new: true }; arr.push(nt); state.activeTab = nt.id; }
    else if (state.activeTab === id) state.activeTab = arr[Math.max(0, i - 1)].id;
    renderTabs(); persist();
  }
  function navNewTab() { addTab({ tool: null }); }
  function navCloseActive() { if (state.activeTab) closeTab(state.activeTab); }
  function navReopen() {
    var last = _closed.pop(); if (!last) return;
    if (last.kind) openEntity(last.kind, last.ref, last.label, true);
    else addTab({ tool: last.tool, dtype: last.dtype, view: last.view, db: last.db, builtin: last.builtin, label: last.label });
  }
  function cycleTab(backwards) {
    if (state.tabs.length < 2) return;
    var ids = state.tabs.map(function (t) { return t.id; }), i = ids.indexOf(state.activeTab);
    i = (i + (backwards ? -1 : 1) + ids.length) % ids.length; selectTab(ids[i]);
  }

  /* ── panes (lazy, persistent) ── */
  function paneEl(id) { var st = el('tab-stage'); return st ? st.querySelector('[data-pane="' + id + '"]') : null; }
  function activeHost() { var t = activeTab(); return t ? paneEl(t.id) : null; }
  function paneKey(t) { return t.kind ? ('@' + t.kind + ':' + t.ref) : ((t.tool || '') + (t.dtype ? ':' + t.dtype : '') + (t.view ? ':v' + t.view : '') + (t.db ? ':' + t.db : '') + (t.builtin ? ':b' + t.builtin : '') || null); }
  function ensurePane(t) {
    var stage = el('tab-stage'); if (!stage) return null;
    var p = paneEl(t.id);
    if (!p) { p = document.createElement('div'); p.className = 'tab-content'; p.setAttribute('data-pane', t.id); p.style.display = 'none'; stage.appendChild(p); p._rendered = false; }
    return p;
  }
  function renderPane(t, p) {
    p.className = 'tab-content'; p.setAttribute('data-pane', t.id);
    if (t.tool === 'web-home' && window.WebSection) WebSection.renderHome(t, p);
    else if (t.tool === 'web-browse' && window.WebSection) WebSection.renderBrowser(t, p);
    else if (t.tool === 'web-hosts' && window.WebSection) WebSection.renderHosts(t, p);
    else if (t.kind === 'site' && window.WebSection) WebSection.renderEditor(t, p);
    else if (t.tool === 'web-placeholder') renderWebPlaceholder(p);
    else if (t.tool === 'desktop' && window.DesktopSection) DesktopSection.render(t, p);
    else if (t.tool === 'data-home' && window.DataSection && DataSection.renderHome) DataSection.renderHome(t, p);
    else if (t.tool === 'data-view' && window.DataSection) DataSection.renderViewPane(t, p);
    else if (t.tool === 'data-db' && window.DataSection) DataSection.renderDbPane(t, p);
    else if (t.tool === 'cast-home' && window.CastSection) CastSection.renderHome(t, p);
    else if (t.kind === 'sheet') B.entityRender(t, p);
    else if ((t.kind === 'cast' || t.kind === 'clock') && window.CastSection) CastSection.renderEditor(t, p);
    else if (t.kind && window.DataSection) DataSection.renderFiche(t, p);
    else if (t.kind) B.entityRender(t, p);
    else if (!t.tool) renderLauncher(p);
    else B.toolRender(t.tool, p);
    p._rendered = true; p._tool = paneKey(t);
  }
  function activatePane() {
    var stage = el('tab-stage'); if (!stage) return;
    var act = activeTab();
    var live = {}; state.tabs.forEach(function (t) { live[t.id] = 1; });
    if (act && act.tool === 'combat') { var pc = ensurePane(act); if (pc) pc._rendered = false; }   // combat reflects live state
    if (act) { var p = ensurePane(act); if (p && (!p._rendered || p._tool !== paneKey(act))) renderPane(act, p); }
    Array.prototype.slice.call(stage.children).forEach(function (c) {
      var pid = c.getAttribute('data-pane'); if (!pid) return;
      if (!live[pid]) { stage.removeChild(c); return; }
      c.style.display = (act && pid === act.id) ? '' : 'none';
    });
    if (act && act.id !== _lastPane && !reduceMotion()) {
      var ap = paneEl(act.id); if (ap) { ap.classList.remove('pane-in'); void ap.offsetWidth; ap.classList.add('pane-in'); }
    }
    _lastPane = act ? act.id : null;
    if (B) { if (B.renderMonitor) B.renderMonitor(); if (B.qdbEnsure) B.qdbEnsure(); }
  }
  function renderTabContent() { var t = activeTab(); if (!t) return; var p = ensurePane(t); if (p) { p._rendered = false; renderPane(t, p); } activatePane(); }

  /* ── launcher (blank tab) & WEB placeholder ── */
  function renderLauncher(host) {
    host.className = 'tab-content asd-launch';
    host.innerHTML = '<div class="asd-launch-in"><div class="asd-launch-h">Open a section</div>' +
      '<div class="asd-launch-grid">' + sectionDefs().map(function (s) {
        return '<button class="asd-launch-card' + (s.disabled ? ' is-disabled' : '') + '" data-launch="' + s.key + '">' +
          '<span class="asd-launch-l">' + esc(s.label) + '</span>' +
          '<span class="asd-launch-s">' + esc(s.sub) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="asd-launch-hint">or press <kbd>⌘K</kbd> to search everything</div></div>';
    host.querySelectorAll('[data-launch]').forEach(function (b) {
      b.onclick = function () {
        var key = b.getAttribute('data-launch'), tool = defaultTool(key), t = activeTab();
        if (t) { t.tool = tool; t.kind = null; t.ref = null; t.dtype = null; t.view = null; t.db = null; t.builtin = null; renderTabs(); persist(); }
      };
    });
  }
  function renderWebPlaceholder(host) {
    host.className = 'tab-content asd-web';
    host.innerHTML = '<div class="asd-web-in">' +
      '<h2>WEB</h2><p>NET / netrunning simulator — coming soon.</p>' +
      '<p class="asd-web-sub">Rache is working on it from beyond.</p></div>';
  }

  /* ── open routing (palette + cross-nav contract) ── */
  function focusTab(pred) { for (var i = 0; i < state.tabs.length; i++) if (pred(state.tabs[i])) { selectTab(state.tabs[i].id); return state.tabs[i]; } return null; }

  function openTool(tool, force) {
    if (tool === 'log') { openLogDrawer(); return; }
    if (tool === 'cast' || tool === 'clocks') tool = 'cast-home';
    if (LEGACY_DATA[tool]) return openDataTab(Object.assign({ label: TOOL_LABEL[tool] || tool }, LEGACY_DATA[tool]), force);
    var ex = focusTab(function (t) { return t.tool === tool && !t.kind; });
    if (ex) { if (force) { var p = paneEl(ex.id); if (p) { p._rendered = false; activatePane(); } } return; }
    // reuse a blank active tab if we're on one, else open a new tab
    var act = activeTab();
    if (act && !act.tool && !act.kind) { act.tool = tool; renderTabs(); persist(); }
    else addTab({ tool: tool });
  }
  function openDataTab(spec, force) {
    var key = (spec.tool || '') + ':' + (spec.dtype || '') + ':' + (spec.view || '') + ':' + (spec.db || '') + ':' + (spec.builtin || '');
    var ex = focusTab(function (t) { return ((t.tool || '') + ':' + (t.dtype || '') + ':' + (t.view || '') + ':' + (t.db || '') + ':' + (t.builtin || '')) === key; });
    if (ex) { if (force) { var p = paneEl(ex.id); if (p) { p._rendered = false; activatePane(); } } return; }
    // Browser model: NAVIGATE the active tab in place whenever it's already a
    // DATA surface (corpus home, a view, the database, a fiche) or a blank tab
    // — /data → /data/npc stays one tab, ‹ brings the corpus back. Only a tab
    // from another section spawns a new one.
    var act = activeTab();
    var dataish = act && (act.kind ? !!DATA_KINDS[act.kind]
      : (act.tool === 'data-home' || act.tool === 'data-view' || act.tool === 'data-db' || !act.tool));
    if (dataish) {
      act.kind = null; act.ref = null;
      act.tool = spec.tool; act.dtype = spec.dtype || null; act.view = spec.view || null; act.db = spec.db || null; act.builtin = spec.builtin || null; act.label = spec.label || null;
      var pp = paneEl(act.id); if (pp) pp._rendered = false; renderTabs(); persist();
    } else addTab({ tool: spec.tool, dtype: spec.dtype || null, view: spec.view || null, db: spec.db || null, builtin: spec.builtin || null, label: spec.label || null });
  }
  function openEntity(kind, ref, label, newTab) {
    var ex = focusTab(function (t) { return t.kind === kind && t.ref === ref; });
    if (ex) return;
    // Same-section opens NAVIGATE the active tab (a view drilling into a fiche,
    // a fiche following a link…); ‹ returns. Cross-section opens — and explicit
    // requests (⌘-click, "Open in a new tab") — spawn a tab.
    var act = activeTab();
    var inPlace = !newTab && act && ((!act.tool && !act.kind) || tabSection(act) === tabSection({ kind: kind }));
    if (inPlace) {
      act.tool = null; act.dtype = null; act.view = null; act.db = null; act.builtin = null;
      act.kind = kind; act.ref = ref; act.label = label || ref;
      var p = paneEl(act.id); if (p) p._rendered = false; renderTabs(); persist();
    } else addTab({ kind: kind, ref: ref, label: label || ref });
  }
  App.on('open:entity', function (e) { if (e && e.ref) openEntity(e.ref.type, e.ref.id, e.label, !!e.newTab); });

  /* ── sidebar search — a live Store index of corpus entities. This cache is
        ALSO the palette's entity source (via Shell.corpusEntities), so ⌘K and
        the sidebar always agree on what exists. ── */
  var SEARCH_TYPES = [['npc', 'NPC'], ['org', 'Org'], ['shop', 'Shop'], ['location', 'Location'], ['item', 'Item'], ['cast', 'Cast-view'], ['clock', 'Clock']];
  function loadSearchEnts() {
    if (!window.Store) return;
    var player = role() === 'player';
    Promise.all(SEARCH_TYPES.map(function (ty) {
      return Store.index(ty[0]).then(function (rows) {
        if (player) rows = rows.filter(function (r) { return Store.visibleToPlayers(r.json); });
        return rows.map(function (r) {
          return { group: ty[1] + 's', label: Store.displayName ? Store.displayName(r) : (r.json.name || r.json.id), sub: ty[1], type: ty[0], id: r.json.id || r.file };
        });
      }).catch(function () { return []; });
    })).then(function (res) { _searchEnts = Array.prototype.concat.apply([], res); }).catch(function () {});
  }
  App.on('entity:saved', loadSearchEnts);
  App.on('entity:deleted', loadSearchEnts);

  function fuzzy(q, text) {
    if (!q) return 0; q = q.toLowerCase(); text = text.toLowerCase();
    var ti = 0, score = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var f = text.indexOf(q[qi], ti); if (f < 0) return -1;
      if (f === 0 || text[f - 1] === ' ') score += 5; if (f === ti) score += 3; ti = f + 1;
    }
    return score - text.length * 0.02;
  }
  function wireSearch() {
    var input = el('asd-search'), box = el('asd-results'); if (!input || !box) return;
    var sel = -1, cur = [];
    function paint(q) {
      // Same command list as the ⌘K palette (AppNav sources entities from
      // Shell.corpusEntities, i.e. the cache this module maintains).
      var all = (window.AppNav && AppNav.commands && AppNav.commands()) || [];
      var scored = all.map(function (it, i) { return { it: it, s: fuzzy(q, it.label + ' ' + (it.sub || '') + ' ' + it.group), i: i }; })
        .filter(function (x) { return x.s > -1; }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).slice(0, 12);
      cur = scored.map(function (x) { return x.it; }); sel = cur.length ? 0 : -1;
      if (!q || !cur.length) { box.hidden = true; box.innerHTML = ''; return; }
      var lastG = null, html = '';
      cur.forEach(function (it, i) {
        if (it.group !== lastG) { html += '<div class="asd-res-g">' + esc(it.group) + '</div>'; lastG = it.group; }
        html += '<div class="asd-res' + (i === sel ? ' is-sel' : '') + '" data-i="' + i + '">' +
          '<span class="asd-res-l">' + esc(it.label) + '</span>' + (it.sub ? '<span class="asd-res-s">' + esc(it.sub) + '</span>' : '') + '</div>';
      });
      box.innerHTML = html; box.hidden = false;
      box.querySelectorAll('[data-i]').forEach(function (d) {
        d.onmousemove = function () { var i = +d.getAttribute('data-i'); if (i !== sel) { sel = i; mark(); } };
        d.onmousedown = function (e) { e.preventDefault(); run(+d.getAttribute('data-i')); };
      });
    }
    function mark() { box.querySelectorAll('.asd-res').forEach(function (d) { d.classList.toggle('is-sel', +d.getAttribute('data-i') === sel); }); }
    function run(i) { var it = cur[i]; if (!it) return; input.value = ''; box.hidden = true; try { it.run(); } catch (e) {} }
    input.oninput = function () { paint(input.value.trim()); };
    input.onfocus = function () { if (input.value.trim()) paint(input.value.trim()); };
    input.onkeydown = function (e) {
      if (e.key === 'Escape') { input.value = ''; box.hidden = true; input.blur(); return; }
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (sel < cur.length - 1) { sel++; mark(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (sel > 0) { sel--; mark(); } }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    };
    document.addEventListener('mousedown', function (e) { if (box && !box.hidden && !e.target.closest('.asd-search-wrap')) box.hidden = true; });
  }

  /* ── journal drawer ── */
  function openLogDrawer() {
    if (el('log-drawer')) { closeLogDrawer(); return; }
    var d = document.createElement('div'); d.id = 'log-drawer'; d.className = 'log-drawer'; document.body.appendChild(d);
    if (!reduceMotion()) requestAnimationFrame(function () { d.classList.add('open'); }); else d.classList.add('open');
    paintLogDrawer(d);
  }
  function closeLogDrawer() {
    var d = el('log-drawer'); if (!d) return; d.classList.remove('open');
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, reduceMotion() ? 0 : 200);
  }
  function paintLogDrawer(d) {
    var sessions = (B && B.sessions) ? B.sessions() : [], rows = [];
    sessions.slice().reverse().forEach(function (s) {
      rows.push('<div class="log-sess">— ' + esc(s.name || 'Session') + ' · ' + esc(s.date || '') + ' —</div>');
      (s.log || []).slice().reverse().forEach(function (e2) {
        rows.push('<div class="log-row"><span class="log-ts">' + esc(B.fmtTime ? B.fmtTime(e2.ts) : '') + '</span>' + esc(e2.msg || '') + '</div>');
      });
    });
    d.innerHTML = '<div class="log-drawer-head"><span>JOURNAL</span>' +
      (role() === 'gm' ? '<button class="app-btn" id="log-newsess">— new session —</button>' : '') +
      '<button class="app-btn" id="log-close">✕</button></div>' +
      '<div class="log-drawer-body">' + (rows.join('') || '<div class="app-empty">Nothing logged yet.</div>') + '</div>';
    el('log-close').onclick = closeLogDrawer;
    var nb = el('log-newsess'); if (nb) nb.onclick = function () { if (B.startNewSession) B.startNewSession(function () { paintLogDrawer(d); }); };
  }

  /* ── settings — every change applies instantly (no Apply step) ── */
  function settingsModal() {
    if (!window.UI) return;
    var partyMode = App.uiGet('settings.partyMode', 'columns');
    var colW = App.uiGet('settings.partyCols', 1.5);
    var sideMode = App.uiGet('settings.sidebarMode', 'pinned');
    window.UI.modal({
      title: 'Settings',
      body:
        '<label class="rt-field"><span class="rt-field-l">Sidebar</span><select class="rt-select" id="set-sidebar">' +
          '<option value="pinned"' + (sideMode === 'pinned' ? ' selected' : '') + '>Pinned — always visible (⌘B hides it)</option>' +
          '<option value="autohide"' + (sideMode === 'autohide' ? ' selected' : '') + '>Auto-hide — reveal on hover at the left edge</option></select></label>' +
        '<label class="rt-field"><span class="rt-field-l">PARTY layout</span><select class="rt-select" id="set-pmode">' +
          '<option value="columns"' + (partyMode === 'columns' ? ' selected' : '') + '>Columns (horizontal scroll)</option>' +
          '<option value="tabs"' + (partyMode === 'tabs' ? ' selected' : '') + '>Tabs (no horizontal scroll)</option></select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Sheets visible at once</span><select class="rt-select" id="set-pcols">' +
          [1, 1.5, 2, 3].map(function (n) { return '<option value="' + n + '"' + (n === colW ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
        (role() === 'gm' ? '<label class="rt-field"><span class="rt-field-l">Net impersonation</span><span style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="set-imp"' + (App.uiGet('web.allowImpersonation', false) ? ' checked' : '') + '> players may link shops / orgs that aren’t theirs</span></label>' : '') +
        '<p class="dt-hint" style="margin:2px 0 0">Changes apply immediately.</p>',
      actions: [{ label: 'Done', kind: 'primary' }],
      onShow: function (box) {
        function repartify() { var act = activeTab(); if (act && act.tool === 'party') renderTabContent(); }
        box.querySelector('#set-sidebar').onchange = function (e) { App.uiSet('settings.sidebarMode', e.target.value); _reveal = false; applySidebar(); };
        box.querySelector('#set-pmode').onchange = function (e) { App.uiSet('settings.partyMode', e.target.value); repartify(); };
        box.querySelector('#set-pcols').onchange = function (e) { App.uiSet('settings.partyCols', parseFloat(e.target.value) || 1.5); repartify(); };
        var imp = box.querySelector('#set-imp'); if (imp) imp.onchange = function (e) { App.uiSet('web.allowImpersonation', e.target.checked); };
      }
    });
  }

  /* ── keyboard shortcuts cheat-sheet ── */
  function shortcutsModal() {
    if (!window.UI) return;
    var rows = [
      ['⌘1 … ⌘6', 'Open a section'],
      ['⌘0', 'Open the Desktop'],
      ['⌃Tab / ⌃⇧Tab', 'Cycle tabs'],
      ['⌘T', 'New tab'],
      ['⌘W', 'Close tab'],
      ['⌘⇧T', 'Reopen the last closed tab'],
      ['⌘[ / ⌘]', 'Back / forward'],
      ['⌘K', 'Command palette'],
      ['⌘B', 'Hide / show the sidebar'],
      ['Esc', 'Close overlays'],
    ];
    window.UI.modal({
      title: 'Keyboard shortcuts',
      body: '<div class="ks">' + rows.map(function (r) {
        return '<div class="ks-row"><span class="ks-k">' + App.esc(r[0]) + '</span><span class="ks-l">' + App.esc(r[1]) + '</span></div>';
      }).join('') + '</div>',
      actions: [{ label: 'Close', kind: 'primary' }]
    });
  }

  /* ── keyboard ── */
  function onKey(e) {
    if (!B || !B.sess || !B.sess.id) return;
    if (e.key === 'Escape') { if (el('log-drawer')) { closeLogDrawer(); return; } }
    if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); cycleTab(e.shiftKey); return; }
    var meta = e.metaKey || e.ctrlKey; if (!meta) return;
    var tn = (e.target && e.target.tagName || '').toLowerCase();
    if (tn === 'input' || tn === 'textarea' || tn === 'select' || (e.target && e.target.isContentEditable)) return;
    var digit = /^Digit([1-6])$/.exec(e.code || '');   // ⌘1..6 open a section tab (AZERTY-safe via e.code)
    if (digit) { var defs = sectionDefs(), s = defs[+digit[1] - 1]; if (s) { e.preventDefault(); openSection(s.key); } return; }
    if (e.code === 'Digit0') { e.preventDefault(); openTool('desktop'); return; }   // ⌘0 → Desktop OS
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); toggleSidebar(); return; }   // ⌘B hide/show sidebar
    if (e.key === '[' || e.key === ']') { e.preventDefault(); navGo(e.key === '[' ? -1 : 1); return; }   // ⌘[ / ⌘] focus history
    if (B.menuNav) return;   // ⌘T/W/⇧T/K owned by the Electron menu (IPC → Shell)
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); if (window.Palette) window.Palette.toggle(); return; }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); if (e.shiftKey) navReopen(); else navNewTab(); return; }
    if (e.key === 'w' || e.key === 'W') { e.preventDefault(); navCloseActive(); return; }
  }
  document.addEventListener('keydown', onKey);

  /* Data/Cast sections repaint the active pane on entity/view changes now that
     there's no persistent side rail. */
  /* Entity changes stale EVERY corpus pane (home + views), not just the active
     one — a hidden data-home must show fresh counts/RECENT when re-selected. */
  function staleDataPanes() {
    state.tabs.forEach(function (t) {
      if (t.tool === 'data-home' || t.tool === 'data-view') { var p = paneEl(t.id); if (p) p._rendered = false; }
    });
    activatePane();
  }
  App.on('entity:saved', staleDataPanes);
  App.on('entity:deleted', staleDataPanes);
  App.on('views:changed', function () { var a = activeTab(); if (a && a.tool === 'data-home') { var p = paneEl(a.id); if (p) { p._rendered = false; activatePane(); } } });

  /* State shim: legacy callers read Shell.state().active (== section of the
     active tab). Kept so app-data.js / app-cast.js guards still resolve. */
  function stateShim() { return { active: tabSection(activeTab()), tabs: state.tabs, activeTab: state.activeTab }; }

  window.Shell = {
    bind: function (bridge) { B = bridge; },
    bridge: function () { return B; },
    mount: mount,
    switchSection: openSection,            // legacy name → open a section tab
    openSection: openSection,
    openTool: openTool, openEntity: openEntity, openDataTab: openDataTab,
    activeTab: activeTab, activeToolId: activeToolId, activeHost: activeHost, paneEl: paneEl,
    renderTabs: renderTabs, activatePane: activatePane, renderTabContent: renderTabContent,
    navNewTab: navNewTab, navCloseActive: navCloseActive, navReopen: navReopen,
    navBack: function () { navGo(-1); }, navForward: function () { navGo(1); },
    openLogDrawer: openLogDrawer, settingsModal: settingsModal, shortcutsModal: shortcutsModal,
    state: stateShim,
    sectionDefs: sectionDefs,
    corpusEntities: function () { return _searchEnts; },
  };
})();
