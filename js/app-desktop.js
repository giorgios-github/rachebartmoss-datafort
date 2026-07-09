/* app-desktop.js — the DESKTOP section: a diegetic in-world computer OS.
   ───────────────────────────────────────────────────────────────────────────
   A real window manager (drag / resize / focus / min / max / close), a dock,
   desktop icons, a top bar with a live clock, a booting splash, and — the point
   of this file — a PLUGGABLE APP + OS FRAMEWORK. This is the character's machine:
   the OS is chosen (or forced by the hardware in cs.html → net.computer), each OS
   is a swappable skin with pros/cons, and apps are self-contained plugins.

   ┌─ THE APP SDK — how you add an app later ─────────────────────────────────┐
   │  Create a file (or add to js/desktop-apps.js) and call:                  │
   │                                                                          │
   │    Desktop.registerApp({                                                 │
   │      id:'todo', name:'To-Do', glyph:'T', vendor:'you', seed:false,       │
   │      category:'utility', os:['*'],           // which OSes offer it       │
   │      desc:'A tiny task list.',                                            │
   │      win:{ w:360, h:440, minW:260, minH:220 },                           │
   │      singleton:true,                                                      │
   │      onOpen:function (win, sdk) {                                         │
   │        // win.body is your DOM to fill; win.setTitle / win.close ...      │
   │        // sdk.el / sdk.esc / sdk.store (persisted) / sdk.open(otherApp)   │
   │        // sdk.os / sdk.sheet() / sdk.files / sdk.notify(...)              │
   │      }                                                                    │
   │    });                                                                    │
   │  Register a whole OS with Desktop.registerOS({...}) the same way.         │
   │  Nothing else in the app needs to know about your app. That's the seam.   │
   └──────────────────────────────────────────────────────────────────────────┘

   Depends on window.App (helpers + meta.ui memory), and — through window.Shell —
   on the live campaign sheet bridge (mirrors app-web.js) so the OS choice lands
   on the player's sheet (net.os) exactly where cs.html can read it. */
(function () {
  'use strict';
  var App = window.App;
  function esc(s) { return App.esc(s); }
  function uid(p) { return App.uid(p); }
  function reduceMotion() { return App.reduceMotion(); }
  function eln(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clampn(v, lo, hi) { v = +v; if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

  /* ── session / role / sheet bridge (mirrors app-web.js) ── */
  function br() { return (window.Shell && Shell.bridge && Shell.bridge()) || {}; }
  function role() { return (br().sess || {}).role || (App.ctx && App.ctx.role) || 'gm'; }
  function isPlayer() { return role() !== 'gm'; }
  function playerJson() { var s = br().sess; if (!s || !s.sheetId || !s.camp) return null; var sid = (br().idOf ? br().idOf(s.sheetId) : s.sheetId); var rec = s.camp.getSheet && s.camp.getSheet(sid); return rec && rec.json; }
  function playerSid() { var s = br().sess; return s && (br().idOf ? br().idOf(s.sheetId) : s.sheetId); }
  function publishPlayer(json) { var s = br().sess; if (s && s.camp && s.camp.publishSheet) s.camp.publishSheet(playerSid(), json.handle || json.name || 'PC', json); }
  function activeDevice() { if (!isPlayer()) return null; var j = playerJson(); return (j && j.net && j.net.computer) || null; }
  function hasDeck() { if (!isPlayer()) return false; var j = playerJson(); return !!(j && j.netrunner && j.netrunner.deckId); }

  /* ── desktop state: on the player's sheet (net.desktop, sync'd, visible to
        cs.html) for a player; in per-campaign UI memory for the GM sandbox. ── */
  function dtRead() {
    if (isPlayer()) { var j = playerJson(); if (!j) return {}; j.net = j.net || {}; return (j.net.desktop = j.net.desktop || {}); }
    return App.uiGet('desktop', {}) || {};
  }
  function dtWrite(mut) {
    if (isPlayer()) { var j = playerJson(); if (!j) return; j.net = j.net || {}; j.net.desktop = j.net.desktop || {}; mut(j.net.desktop); publishPlayer(j); }
    else { var d = App.uiGet('desktop', {}) || {}; mut(d); App.uiSet('desktop', d); }
  }

  /* ═══════════════ registries — the extensibility seam ═══════════════ */
  var APPS = {}, OSES = {}, OS_ORDER = [];
  function registerApp(def) { if (def && def.id) APPS[def.id] = def; }
  function registerOS(def) { if (def && def.id) { OSES[def.id] = def; if (OS_ORDER.indexOf(def.id) < 0) OS_ORDER.push(def.id); } }
  function appList() { return Object.keys(APPS).map(function (k) { return APPS[k]; }); }
  function osList() { return OS_ORDER.map(function (k) { return OSES[k]; }).filter(Boolean); }

  /* ── OS resolution (choice, gated by the hardware) ── */
  function osDef(id) { return OSES[id] || OSES[OS_ORDER[0]] || null; }
  function osOffersApp(os, app) { if (!os || !app) return false; if (!app.os || app.os.indexOf('*') >= 0) return true; return app.os.indexOf(os.id) >= 0; }
  function forcedOS(device) {
    if (device && device.os && OSES[device.os]) return device.os;   // explicit GM pin on the device
    for (var i = 0; i < OS_ORDER.length; i++) { var o = OSES[OS_ORDER[i]]; if (o.forcedFor && o.forcedFor(device)) return o.id; }
    return null;
  }
  function availableOSes(device) { return osList().filter(function (o) { return !o.availableFor || o.availableFor(device, { role: role() }); }); }
  function currentOSId() {
    var dev = activeDevice(), f = forcedOS(dev);
    if (f) return f;
    var saved = dtRead().os, avail = availableOSes(dev).map(function (o) { return o.id; });
    if (saved && avail.indexOf(saved) >= 0) return saved;
    return avail[0] || OS_ORDER[0] || null;
  }
  function setOS(id) { dtWrite(function (d) { d.os = id; }); }

  /* ── install state (defaults to each OS's seeded apps, then user-managed) ── */
  function ensureInstall() {
    var d = dtRead();
    if (d.installed) return;
    dtWrite(function (s) { if (s.installed) return; var m = {}; var os = osDef(currentOSId()); appList().forEach(function (a) { if (a.seed && osOffersApp(os, a)) m[a.id] = 1; }); s.installed = m; });
  }
  function isInstalled(id) { var a = APPS[id]; if (!a) return false; if (a.core) return true; var m = dtRead().installed; if (!m) return !!a.seed; return !!m[id]; }
  function installApp(id) { ensureInstall(); dtWrite(function (d) { d.installed = d.installed || {}; d.installed[id] = 1; }); }
  function uninstallApp(id) { var a = APPS[id]; if (a && a.core) return; ensureInstall(); dtWrite(function (d) { if (d.installed) delete d.installed[id]; }); }
  function installedApps() { var os = osDef(currentOSId()); return appList().filter(function (a) { return isInstalled(a.id) && osOffersApp(os, a); }); }

  /* ═══════════════ virtual filesystem (shared by apps via sdk.files) ═══════════════
     Flat entries { id, folder, name, kind:'text'|'image'|'app'|'link', body, app,
     arg, src, ro }. Seeded entries (from apps/OS) are read-only; user files persist
     in state. The Files app derives folders from distinct `folder` values. */
  var FS_SEED = [];
  var FS = {
    seed: function (entry) { FS_SEED.push(entry); },
    seedReset: function () { FS_SEED = []; },
    userFiles: function () { return (dtRead().files || []); },
    all: function () {
      var out = FS_SEED.slice();
      // collected intel from the Net (net.intel) shows up as files
      var j = isPlayer() ? playerJson() : null, intel = (j && j.net && j.net.intel) || [];
      intel.forEach(function (it, i) { out.push({ id: 'intel-' + (it.id || i), folder: 'Intel', name: (it.name || 'record') + '.dat', kind: 'text', body: (it.desc || '') + (it.type ? '\n\n[' + it.type + ']' : ''), ro: true }); });
      return out.concat(FS.userFiles());
    },
    folders: function () { var s = {}; FS.all().forEach(function (f) { s[f.folder || 'Home'] = 1; }); return Object.keys(s); },
    inFolder: function (folder) { return FS.all().filter(function (f) { return (f.folder || 'Home') === folder; }); },
    write: function (entry) { dtWrite(function (d) { d.files = d.files || []; entry.id = entry.id || uid('file'); var i = d.files.map(function (x) { return x.id; }).indexOf(entry.id); if (i >= 0) d.files[i] = entry; else d.files.push(entry); }); return entry; },
    remove: function (id) { dtWrite(function (d) { if (d.files) d.files = d.files.filter(function (x) { return x.id !== id; }); }); }
  };

  /* ═══════════════ the window manager (one per mounted pane) ═══════════════ */
  var _bootedOS = {};   // per app-session: which OSes have already shown their splash

  function Env(host) { this.host = host; this.wins = []; this.zTop = 20; this.winSeq = 0; this._menu = null; this._clock = null; }

  Env.prototype.mount = function () {
    var self = this;
    this.host.className = 'tab-content dt-pane';
    this.host.innerHTML = '';
    var root = this.root = eln('div', 'dt-root');
    root.appendChild(eln('div', 'dt-wallpaper'));
    this.desktop = eln('div', 'dt-desktop');
    this.iconsEl = eln('div', 'dt-icons');
    this.desktop.appendChild(this.iconsEl);
    this.topbar = eln('div', 'dt-topbar');
    this.taskbar = eln('div', 'dt-taskbar');
    this.toasts = eln('div', 'dt-toasts');
    root.appendChild(this.topbar);
    root.appendChild(this.desktop);
    root.appendChild(this.taskbar);
    root.appendChild(this.toasts);
    this.host.appendChild(root);

    if (isPlayer() && !activeDevice() && !hasDeck()) { this.applyTheme(); this.renderNoMachine(); return; }

    ensureInstall();
    this.applyTheme();
    this.refreshChrome();
    root.addEventListener('mousedown', function (e) { if (self._menu && !e.target.closest('.dt-menu') && !e.target.closest('[data-dt-menu]')) self.closeMenu(); });
    this.startClock();
    var osid = currentOSId();
    if (!_bootedOS[osid]) { _bootedOS[osid] = 1; this.boot(); }
  };

  Env.prototype.os = function () { return osDef(currentOSId()); };

  Env.prototype.applyTheme = function () {
    var os = this.os(); if (!os) return;
    var r = this.root, t = os.theme || {};
    Object.keys(t).forEach(function (k) { r.style.setProperty(k, t[k]); });
    if (os.wallpaper) r.style.setProperty('--dt-wall', os.wallpaper);
    var wp = dtRead().wallpaper; if (wp) r.style.setProperty('--dt-wall', wp);   // user override
    r.setAttribute('data-os', os.id);
    r.classList.toggle('dt-fx-scan', !!os.scanlines);
  };

  Env.prototype.renderNoMachine = function () {
    var self = this;
    var wrap = eln('div', 'dt-nomachine');
    wrap.innerHTML = '<div class="dt-nomachine-in"><h2>No machine detected</h2>' +
      '<p>This terminal has nothing to boot. A personal computer lives on your character sheet — add one and this desktop wakes up.</p>' +
      (hasDeck() ? '<p class="dt-muted">Your cyberdeck can reach the Net, but a desktop OS needs a real computer.</p>' : '') + '</div>';
    var btn = eln('button', 'dt-btn primary', 'Open my character sheet');
    btn.onclick = function () { if (window.Shell && Shell.openSection) Shell.openSection('party'); };
    wrap.querySelector('.dt-nomachine-in').appendChild(btn);
    this.desktop.appendChild(wrap);
    this.topbar.innerHTML = '<div class="dt-menu-btn"><span class="dt-menu-mark"></span>' + esc((this.os() || {}).name || 'OS') + '</div><div class="dt-topbar-title"></div>';
  };

  /* ── chrome: icons + top bar + dock ── */
  Env.prototype.refreshChrome = function () { this.renderIcons(); this.renderTopbar(); this.renderTaskbar(); };

  Env.prototype.renderIcons = function () {
    var self = this; this.iconsEl.innerHTML = '';
    installedApps().forEach(function (a) {
      if (a.noIcon) return;
      var ic = eln('div', 'dt-icon');
      ic.innerHTML = '<div class="dt-icon-g">' + esc(a.glyph || a.name.slice(0, 1)) + '</div><div class="dt-icon-l">' + esc(a.name) + '</div>';
      ic.title = a.desc || a.name;
      ic.onclick = function () { self.iconsEl.querySelectorAll('.dt-icon.sel').forEach(function (n) { n.classList.remove('sel'); }); ic.classList.add('sel'); };
      ic.ondblclick = function () { self.openApp(a.id); };
      self.iconsEl.appendChild(ic);
    });
  };

  Env.prototype.renderTopbar = function () {
    var self = this, os = this.os(), dev = activeDevice();
    this.topbar.innerHTML = '';
    var menu = eln('button', 'dt-menu-btn'); menu.setAttribute('data-dt-menu', '1');
    menu.innerHTML = '<span class="dt-menu-mark"></span>' + esc(os ? os.name : 'OS');
    menu.onclick = function (e) { e.stopPropagation(); self.osMenu(menu); };
    this.topbar.appendChild(menu);
    this.topTitle = eln('div', 'dt-topbar-title'); this.topbar.appendChild(this.topTitle);
    var right = eln('div', 'dt-topbar-right');
    if (dev) right.appendChild(eln('span', 'dt-stat', 'R<b>' + (dev.reach != null ? dev.reach : 0) + '</b> · P<b>' + (dev.power != null ? dev.power : 0) + '</b> · S<b>' + (dev.stealth != null ? dev.stealth : 0) + '</b>'));
    else if (os) right.appendChild(eln('span', 'dt-stat', esc(os.vendor || '')));
    this.clockEl = eln('span', 'dt-clock', this.clockText());
    right.appendChild(this.clockEl);
    this.topbar.appendChild(right);
    this.syncTitle();
  };

  Env.prototype.renderTaskbar = function () {
    var self = this; this.taskbar.innerHTML = '';
    var os = this.os();
    var start = eln('button', 'dt-start'); start.setAttribute('data-dt-menu', '1');
    start.innerHTML = '<span class="dt-menu-mark"></span>' + esc((os && os.startLabel) || 'Apps');
    start.onclick = function (e) { e.stopPropagation(); self.startMenu(start); };
    this.taskbar.appendChild(start);
    var tasks = eln('div', 'dt-tasks'); this.taskbar.appendChild(tasks);
    // open windows first, then pinned-but-not-open apps
    var openIds = {};
    this.wins.forEach(function (w) {
      openIds[w.appId] = 1; var a = APPS[w.appId] || {};
      var t = eln('button', 'dt-task' + (self.active === w ? ' on' : ''));
      t.innerHTML = '<span class="dt-task-g">' + esc(a.glyph || '▪') + '</span><span class="dt-task-l">' + esc(w.title || a.name || 'App') + '</span>';
      t.onclick = function () { if (w.min) self.restore(w); else if (self.active === w) self.minimize(w); else self.focus(w); };
      tasks.appendChild(t);
    });
    installedApps().forEach(function (a) {
      if (!a.pin || openIds[a.id]) return;
      var t = eln('button', 'dt-task pin');
      t.innerHTML = '<span class="dt-task-g">' + esc(a.glyph || '▪') + '</span><span class="dt-task-l">' + esc(a.name) + '</span>';
      t.onclick = function () { self.openApp(a.id); };
      tasks.appendChild(t);
    });
    var tray = eln('div', 'dt-tray');
    tray.appendChild(eln('span', 'dt-stat', esc(role() === 'gm' ? 'GM PREVIEW' : '')));
    this.taskbar.appendChild(tray);
  };

  /* ── clock ── */
  Env.prototype.clockText = function () { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return p(d.getHours()) + ':' + p(d.getMinutes()); };
  Env.prototype.startClock = function () {
    var self = this;
    if (this._clock) clearInterval(this._clock);
    this._clock = setInterval(function () {
      if (!document.contains(self.root)) { clearInterval(self._clock); self._clock = null; return; }
      if (self.clockEl) self.clockEl.textContent = self.clockText();
    }, 15000);
  };

  /* ── boot splash ── */
  Env.prototype.boot = function () {
    var self = this, os = this.os(); if (!os) return;
    var b = os.boot || {};
    var splash = eln('div', 'dt-boot');
    splash.innerHTML = '<div><div class="dt-boot-logo">' + esc(b.logo || os.name) + '</div>' +
      (b.sub ? '<div class="dt-boot-sub">' + esc(b.sub) + '</div>' : '') + '</div>' +
      '<div class="dt-boot-lines"></div><div class="dt-boot-bar"><i></i></div>';
    this.root.appendChild(splash);
    var linesEl = splash.querySelector('.dt-boot-lines'), bar = splash.querySelector('.dt-boot-bar i');
    var lines = (b.lines || ['initializing…', 'mounting volumes', 'ready']).slice();
    if (reduceMotion()) {
      linesEl.innerHTML = lines.map(function (l) { return '<div class="dt-boot-line">' + l + ' <span class="ok">✓</span></div>'; }).join('');
      bar.style.width = '100%';
      setTimeout(function () { splash.remove(); }, 350);
      return;
    }
    var i = 0;
    (function step() {
      if (i >= lines.length) {
        setTimeout(function () { splash.classList.add('fade'); setTimeout(function () { splash.remove(); }, 500); }, 260);
        return;
      }
      var row = eln('div', 'dt-boot-line dt-boot-cursor'); row.innerHTML = lines[i];
      linesEl.appendChild(row);
      bar.style.width = Math.round(((i + 1) / lines.length) * 100) + '%';
      var prev = linesEl.children[i - 1]; if (prev) { prev.classList.remove('dt-boot-cursor'); prev.innerHTML += ' <span class="ok">✓</span>'; }
      i++;
      setTimeout(step, 230 + Math.floor(Math.random() * 170));
    })();
  };

  Env.prototype.reboot = function () {
    var self = this;
    this.wins.slice().forEach(function (w) { self.destroyWin(w, true); });
    this.wins = []; this.active = null;
    delete _bootedOS[currentOSId()];
    this.applyTheme(); this.refreshChrome();
    _bootedOS[currentOSId()] = 1; this.boot();
  };

  Env.prototype.switchOS = function (id) {
    if (forcedOS(activeDevice())) { this.notify('This machine is locked to its OS.'); return; }
    if (id === currentOSId()) return;
    setOS(id);
    // re-derive installs for the new OS if the user never customized
    var self = this;
    this.wins.slice().forEach(function (w) { self.destroyWin(w, true); });
    this.wins = []; this.active = null;
    this.applyTheme(); this.refreshChrome();
    delete _bootedOS[id]; _bootedOS[id] = 1; this.boot();
    this.notify('Now running ' + (this.os() || {}).name + '.');
  };

  /* ── menus ── */
  Env.prototype.closeMenu = function () { if (this._menu) { this._menu.remove(); this._menu = null; } };
  Env.prototype.openMenu = function (anchor, items) {
    this.closeMenu();
    var self = this, m = eln('div', 'dt-menu');
    items.forEach(function (it) {
      if (it.sep) { m.appendChild(eln('div', 'dt-menu-sep')); return; }
      if (it.head) { m.appendChild(eln('div', 'dt-menu-h', esc(it.head))); return; }
      var row = eln('div', 'dt-menu-item' + (it.disabled ? ' disabled' : ''));
      row.innerHTML = (it.glyph != null ? '<span class="dt-menu-g">' + esc(it.glyph) + '</span>' : '') +
        '<span>' + esc(it.label) + '</span>' + (it.sub ? '<span class="dt-menu-sub">' + esc(it.sub) + '</span>' : '');
      if (!it.disabled) row.onclick = function () { self.closeMenu(); it.onClick && it.onClick(); };
      m.appendChild(row);
    });
    this.root.appendChild(m);
    var r = anchor.getBoundingClientRect(), rr = this.root.getBoundingClientRect();
    var x = r.left - rr.left, top = r.bottom - rr.top + 4;
    m.style.left = Math.min(x, rr.width - m.offsetWidth - 8) + 'px';
    if (top + m.offsetHeight > rr.height - 8) m.style.bottom = (rr.height - (r.top - rr.top) + 4) + 'px';
    else m.style.top = top + 'px';
    this._menu = m;
  };

  Env.prototype.osMenu = function (anchor) {
    var self = this, os = this.os();
    var items = [{ head: os ? os.name : 'System' }];
    items.push({ label: 'About this machine', glyph: 'ⓘ', onClick: function () { self.openApp('settings', { tab: 'about' }); } });
    items.push({ label: 'Settings', glyph: '⚙', onClick: function () { self.openApp('settings'); } });
    items.push({ label: 'App Store', glyph: '⊞', onClick: function () { self.openApp('app-store'); } });
    items.push({ sep: true });
    var locked = !!forcedOS(activeDevice());
    availableOSes(activeDevice()).forEach(function (o) {
      items.push({ label: o.name, glyph: o.id === currentOSId() ? '●' : '○', sub: o.id === currentOSId() ? 'current' : (locked ? 'locked' : 'switch'), disabled: locked && o.id !== currentOSId(), onClick: function () { self.switchOS(o.id); } });
    });
    items.push({ sep: true });
    items.push({ label: 'Reboot', glyph: '⟳', onClick: function () { self.reboot(); } });
    this.openMenu(anchor, items);
  };

  Env.prototype.startMenu = function (anchor) {
    var self = this;
    var items = [{ head: 'Applications' }];
    installedApps().forEach(function (a) { if (a.noIcon) return; items.push({ label: a.name, glyph: a.glyph, sub: a.category || '', onClick: function () { self.openApp(a.id); } }); });
    items.push({ sep: true });
    items.push({ label: 'App Store', glyph: '⊞', onClick: function () { self.openApp('app-store'); } });
    this.openMenu(anchor, items);
  };

  /* ── windows ── */
  Env.prototype.findWin = function (appId) { for (var i = 0; i < this.wins.length; i++) if (this.wins[i].appId === appId) return this.wins[i]; return null; };

  Env.prototype.openApp = function (appId, arg) {
    var app = APPS[appId]; if (!app) return null;
    if (app.singleton !== false) { var ex = this.findWin(appId); if (ex) { if (ex.min) this.restore(ex); else this.focus(ex); if (app.onFocus) try { app.onFocus(ex, this.sdk(ex, app), arg); } catch (e) {} return ex; } }
    return this.createWin(app, arg);
  };

  Env.prototype.createWin = function (app, arg) {
    var self = this;
    var spec = app.win || {};
    var w = clampn(spec.w || 520, 220, 2000), h = clampn(spec.h || 400, 140, 2000);
    var area = this.desktop.getBoundingClientRect();
    w = Math.min(w, Math.max(240, area.width - 24)); h = Math.min(h, Math.max(160, area.height - 24));
    var off = (this.winSeq++ % 6) * 26;
    var x = clampn((area.width - w) / 2 + off - 60, 8, Math.max(8, area.width - w - 8));
    var y = clampn(40 + off, 8, Math.max(8, area.height - h - 8));

    var win = { id: uid('win'), appId: app.id, appDef: app, title: app.name, min: false, max: false, prev: null, listeners: {} };
    var el = win.el = eln('div', 'dt-win dt-win-open');
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.minWidth = (spec.minW || 220) + 'px'; el.style.minHeight = (spec.minH || 140) + 'px';
    var bar = eln('div', 'dt-win-bar');
    bar.innerHTML = '<span class="dt-win-ico">' + esc(app.glyph || '▪') + '</span><span class="dt-win-t">' + esc(app.name) + '</span>';
    var ctrls = eln('div', 'dt-win-ctrls');
    var bMin = eln('button', 'dt-win-b', '—'), bMax = eln('button', 'dt-win-b', '▢'), bX = eln('button', 'dt-win-b x', '✕');
    bMin.title = 'Minimize'; bMax.title = 'Maximize'; bX.title = 'Close';
    ctrls.appendChild(bMin); if (spec.maximizable !== false) ctrls.appendChild(bMax); ctrls.appendChild(bX);
    bar.appendChild(ctrls); el.appendChild(bar);
    win.titleEl = bar.querySelector('.dt-win-t');
    win.body = eln('div', 'dt-win-body'); el.appendChild(win.body);
    if (spec.resizable !== false) { var rz = eln('div', 'dt-win-rz'); el.appendChild(rz); this.wireResize(win, rz); }
    this.desktop.appendChild(el);
    this.wins.push(win);

    win.setTitle = function (t) { win.title = t; win.titleEl.textContent = t; if (self.active === win) self.syncTitle(); self.renderTaskbar(); };
    win.close = function () { self.destroyWin(win); };
    win.focus = function () { self.focus(win); };
    win.on = function (ev, fn) { (win.listeners[ev] = win.listeners[ev] || []).push(fn); };
    win.setBadge = function () {};

    bMin.onclick = function (e) { e.stopPropagation(); self.minimize(win); };
    bMax.onclick = function (e) { e.stopPropagation(); self.toggleMax(win); };
    bX.onclick = function (e) { e.stopPropagation(); self.destroyWin(win); };
    bar.ondblclick = function (e) { if (!e.target.closest('.dt-win-b')) self.toggleMax(win); };
    el.addEventListener('mousedown', function () { self.focus(win); }, true);
    this.wireDrag(win, bar);
    this.focus(win);

    try { app.onOpen(win, this.sdk(win, app), arg); }
    catch (e) { win.body.innerHTML = '<div class="dt-pad"><div class="dt-h1">App error</div><div class="dt-p dt-muted">' + esc(String(e && e.message || e)) + '</div></div>'; }
    this.renderTaskbar();
    return win;
  };

  Env.prototype.focus = function (win) {
    if (this.active === win && win.el.style.zIndex) { return; }
    this.active = win;
    win.el.style.zIndex = ++this.zTop;
    this.wins.forEach(function (w) { w.el.classList.toggle('dt-inactive', w !== win); });
    this.syncTitle(); this.renderTaskbar();
  };
  Env.prototype.syncTitle = function () { if (this.topTitle) this.topTitle.textContent = this.active && !this.active.min ? (this.active.title || '') : ''; };

  Env.prototype.minimize = function (win) { win.min = true; win.el.style.display = 'none'; if (this.active === win) { this.active = null; this.syncTitle(); } this.renderTaskbar(); };
  Env.prototype.restore = function (win) { win.min = false; win.el.style.display = ''; this.focus(win); };
  Env.prototype.toggleMax = function (win) {
    var d = this.desktop.getBoundingClientRect();
    if (win.max) { win.max = false; win.el.classList.remove('dt-max'); if (win.prev) { win.el.style.left = win.prev.x + 'px'; win.el.style.top = win.prev.y + 'px'; win.el.style.width = win.prev.w + 'px'; win.el.style.height = win.prev.h + 'px'; } }
    else { win.prev = { x: win.el.offsetLeft, y: win.el.offsetTop, w: win.el.offsetWidth, h: win.el.offsetHeight }; win.max = true; win.el.classList.add('dt-max'); win.el.style.left = '0px'; win.el.style.top = '0px'; win.el.style.width = d.width + 'px'; win.el.style.height = d.height + 'px'; }
    this.focus(win);
  };
  Env.prototype.destroyWin = function (win, silent) {
    (win.listeners.close || []).forEach(function (fn) { try { fn(); } catch (e) {} });
    if (win.el && win.el.parentNode) win.el.parentNode.removeChild(win.el);
    var i = this.wins.indexOf(win); if (i >= 0) this.wins.splice(i, 1);
    if (this.active === win) { this.active = this.wins[this.wins.length - 1] || null; if (this.active) this.focus(this.active); else this.syncTitle(); }
    if (!silent) this.renderTaskbar();
  };

  Env.prototype.wireDrag = function (win, handle) {
    var self = this;
    handle.addEventListener('mousedown', function (e) {
      if (e.target.closest('.dt-win-b') || e.button !== 0) return;
      if (win.max) return;
      e.preventDefault();
      var sx = e.clientX, sy = e.clientY, ox = win.el.offsetLeft, oy = win.el.offsetTop;
      var d = self.desktop.getBoundingClientRect();
      function mv(ev) {
        var nx = clampn(ox + (ev.clientX - sx), -win.el.offsetWidth + 80, d.width - 40);
        var ny = clampn(oy + (ev.clientY - sy), 0, d.height - 30);
        win.el.style.left = nx + 'px'; win.el.style.top = ny + 'px';
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  };
  Env.prototype.wireResize = function (win, handle) {
    var self = this;
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); self.focus(win);
      var sx = e.clientX, sy = e.clientY, ow = win.el.offsetWidth, oh = win.el.offsetHeight;
      var minW = parseInt(win.el.style.minWidth, 10) || 220, minH = parseInt(win.el.style.minHeight, 10) || 140;
      var d = self.desktop.getBoundingClientRect();
      function mv(ev) {
        win.el.style.width = clampn(ow + (ev.clientX - sx), minW, d.width - win.el.offsetLeft - 4) + 'px';
        win.el.style.height = clampn(oh + (ev.clientY - sy), minH, d.height - win.el.offsetTop - 4) + 'px';
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  };

  /* ── toasts ── */
  Env.prototype.notify = function (msg) {
    var t = eln('div', 'dt-toast', esc(msg)); this.toasts.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2600);
  };

  /* ── the per-app SDK handed to onOpen ── */
  Env.prototype.sdk = function (win, app) {
    var self = this;
    return {
      // identity / context
      os: this.os(), role: role(), isPlayer: isPlayer(), device: activeDevice(),
      // dom + helpers
      el: eln, esc: esc, uid: uid, reduceMotion: reduceMotion, clampn: clampn, App: App,
      // window handle
      win: win,
      close: function () { win.close(); },
      // persistence — per-app blob on the sheet (player) or meta.ui (GM)
      store: appStore(app.id),
      // shared services
      files: FS,
      sheet: function () { return isPlayer() ? playerJson() : null; },
      notify: function (m) { self.notify(m); },
      open: function (id, arg) { return self.openApp(id, arg); },
      shell: window.Shell || null,
      web: window.WebSection || null,
      // app + os catalog (for the App Store / Settings apps)
      apps: appList, installedApps: installedApps,
      availableApps: function () { var os = self.os(); return appList().filter(function (a) { return osOffersApp(os, a) && !a.core; }); },
      isInstalled: isInstalled,
      install: function (id) { installApp(id); self.refreshChrome(); },
      uninstall: function (id) { uninstallApp(id); self.refreshChrome(); },
      osList: osList, currentOS: currentOSId, osDef: osDef,
      availableOSes: function () { return availableOSes(activeDevice()); },
      forcedOS: function () { return forcedOS(activeDevice()); },
      switchOS: function (id) { self.switchOS(id); },
      reboot: function () { self.reboot(); },
      getWallpaper: function () { return dtRead().wallpaper || null; },
      setWallpaper: function (css) { dtWrite(function (d) { if (css) d.wallpaper = css; else delete d.wallpaper; }); self.applyTheme(); }
    };
  };

  function appStore(appId) {
    return {
      get: function (k, def) { var d = dtRead(); var a = (d.apps && d.apps[appId]) || {}; return (k in a) ? a[k] : def; },
      set: function (k, v) { dtWrite(function (d) { d.apps = d.apps || {}; d.apps[appId] = d.apps[appId] || {}; d.apps[appId][k] = v; }); },
      all: function () { var d = dtRead(); return (d.apps && d.apps[appId]) || {}; },
      replace: function (obj) { dtWrite(function (d) { d.apps = d.apps || {}; d.apps[appId] = obj; }); }
    };
  }

  /* ═══════════════ public API + shell entry point ═══════════════ */
  window.Desktop = {
    registerApp: registerApp, registerOS: registerOS,
    apps: appList, oses: osList,
    fs: FS, seedFile: function (e) { FS.seed(e); },
    currentOS: currentOSId, osDef: osDef,
    // small helpers a plugin might want
    isPlayer: isPlayer, role: role
  };

  window.DesktopSection = {
    render: function (tab, host) { var env = new Env(host); host._dtEnv = env; env.mount(); },
    // let the shell know the section exists even before a tab opens
    label: 'Desktop'
  };
})();
