/* desktop-apps.js — OS registration + the built-in apps for the DESKTOP.
   ───────────────────────────────────────────────────────────────────────────
   Written against the PUBLIC Desktop SDK (registerApp / registerOS / seedFile).
   Every OS wears the same ink-on-paper DS; they differ only by MECHANICS —
   enforced HERE (App Store policy + compatibility + ads) and shown as a
   sourcebook stat-block — and by furniture/voice (js/desktop-shell-fx.js). The
   player INSTALLS an OS on their sheet (cs.html), not in Settings. */
(function () {
  'use strict';
  if (!window.Desktop) return;
  var D = window.Desktop, DOS = window.DesktopOS;

  if (DOS) DOS.LIST.forEach(function (o) { D.registerOS(o); });

  /* ── shared helpers ── */
  function h1(sdk, t) { return sdk.el('div', 'dt-h1', sdk.esc(t)); }
  function adStrip(sdk) {
    if (!sdk.os || !sdk.os.ads || isNuePro(sdk)) return null;   // Premium = no ads
    var ads = ['img/ads/200.webp', 'img/ads/200-2.webp', 'img/ads/japanese-rpg.gif', 'img/ads/jelly-beans-jelly-bean.webp'];
    var src = ads[Math.floor((Date.now() / 9000) % ads.length)];
    var w = sdk.el('div', 'dt-adbox');
    w.innerHTML = '<img class="dt-ad" src="' + src + '" alt="ad"><div class="dt-adnote">sponsored · go pro to hide</div>';
    return w;
  }
  function mech(sdk, axis) { var m = (sdk.os && sdk.os.mech) || {}; return m[axis]; }
  /* the app→OS policy gate (the mechanics made real) */
  function policyBlocked(sdk, app) {
    if (app.street && mech(sdk, 'apps') === 'curated') return 'unsigned · blocked by policy';
    if (app.heavy && mech(sdk, 'compat') === 'legacy') return 'too heavy for a legacy OS';
    return null;
  }
  function incompatPane(sdk, name, why) {
    var d = sdk.el('div', 'dt-pad'); d.appendChild(h1(sdk, 'Cannot run'));
    d.appendChild(sdk.el('div', 'dt-p dt-muted', '“' + name + '” will not run on this OS. ' + why));
    var t = sdk.el('div', 'dt-tag bad'); t.textContent = 'legacy os'; d.appendChild(t); return d;
  }
  /* the mechanical stat-block, straight from the shared catalog */
  function osStatBlock(sdk, os) {
    var wrap = sdk.el('div', 'dt-statblock'); if (!DOS) return wrap;
    DOS.MECH_ORDER.forEach(function (axis) {
      var spec = DOS.MECH[axis], v = spec.values[(os.mech || {})[axis]] || {};
      var row = sdk.el('div', 'dt-sb-row');
      row.innerHTML = '<div class="dt-sb-k"><span class="dt-menu-g">' + sdk.esc(spec.glyph) + '</span>' + sdk.esc(spec.label) + '</div>' +
        '<div class="dt-sb-v"><div class="dt-sb-tag"><span class="dt-stamp ' + (v.stamp || 'warn') + '"></span>' + sdk.esc(v.tag || '—') + '</div>' +
        '<div class="dt-sb-note">' + sdk.esc(v.note || '') + '</div></div>';
      wrap.appendChild(row);
    });
    (os.traits || []).forEach(function (t) {
      var row = sdk.el('div', 'dt-sb-row');
      row.innerHTML = '<div class="dt-sb-k"><span class="dt-menu-g">◆</span>Trait</div><div class="dt-sb-v"><div class="dt-sb-note">' + sdk.esc(t) + '</div></div>';
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* ═══════════════ CORE: Settings (OS stat-block + wallpaper) ═══════════════ */
  D.registerApp({
    id: 'settings', name: 'Settings', glyph: '⚙', core: true, seed: true, os: ['*'],
    category: 'system', vendor: 'system', desc: 'This machine, its OS and its wallpaper.',
    win: { w: 520, h: 500, minW: 380, minH: 340 },
    onOpen: function (win, sdk, arg) {
      var cur = (arg && arg.tab) || (win._arg && win._arg.tab) || 'system';
      function paint(tab) {
        cur = tab || cur; var b = win.body; b.innerHTML = '';
        var tabs = sdk.el('div', 'dt-tabbar');
        [['system', 'System'], ['wallpaper', 'Wallpaper']].forEach(function (t) {
          var btn = sdk.el('button', 'dt-btn sm' + (cur === t[0] ? ' primary' : ' ghost'), t[1]);
          btn.onclick = function () { paint(t[0]); }; tabs.appendChild(btn);
        });
        b.appendChild(tabs);
        var body = sdk.el('div', 'dt-pad dt-scroll-y'); b.appendChild(body);
        if (cur === 'wallpaper') paintWall(body); else paintSystem(body);
      }
      function paintSystem(body) {
        var os = sdk.osDef(sdk.currentOS()), dev = sdk.device;
        body.appendChild(h1(sdk, os.name));
        body.appendChild(sdk.el('div', 'dt-p dt-muted', (os.vendor || '') + ' — ' + (os.tagline || '')));
        body.appendChild(sdk.el('div', 'dt-h2', 'Mechanics'));
        body.appendChild(osStatBlock(sdk, os));
        body.appendChild(sdk.el('div', 'dt-h2', 'Machine'));
        var rows = [];
        if (dev) { rows.push(['Hardware', dev.name || 'Computer']); if (dev.maker) rows.push(['Maker', dev.maker]); rows.push(['R / P / S', 'R' + (dev.reach || 0) + ' · P' + (dev.power || 0) + ' · S' + (dev.stealth || 0)]); rows.push(['Status', dev.legal === false ? 'flagged / stolen' : 'clean']); }
        else rows.push(['Hardware', sdk.role === 'gm' ? 'GM preview (no device)' : 'none']);
        rows.forEach(function (r) { var row = sdk.el('div', 'dt-inforow'); row.innerHTML = '<div class="dt-infok">' + sdk.esc(r[0]) + '</div><div class="dt-infov">' + sdk.esc(r[1]) + '</div>'; body.appendChild(row); });
        var note = sdk.el('div', 'dt-note');
        note.innerHTML = 'The OS is set by your <b>hardware</b> and your choice — install a different one from your character sheet (<b>Computer &amp; Web</b>).';
        body.appendChild(note);
        var reb = sdk.el('button', 'dt-btn', '⟳ Reboot'); reb.style.marginTop = '12px'; reb.onclick = function () { sdk.reboot(); }; body.appendChild(reb);
      }
      function paintWall(body) {
        body.appendChild(h1(sdk, 'Wallpaper'));
        body.appendChild(sdk.el('div', 'dt-p dt-muted', 'The desktop stays paper — pick its grain.'));
        var opts = [
          ['Graph paper', ''],
          ['Blank', '#fafafa'],
          ['Fine grid', 'repeating-linear-gradient(0deg,#eee 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,#eee 0 1px,transparent 1px 16px),#fff'],
          ['Ledger', 'repeating-linear-gradient(0deg,#e6e6e6 0 1px,transparent 1px 26px),#fff'],
          ['Ink field', '#111'],
          ['Dot grid', 'radial-gradient(#ddd 1px,transparent 1px) 0 0/22px 22px,#fff']
        ];
        var grid = sdk.el('div', 'dt-wallgrid');
        opts.forEach(function (o) {
          var cell = sdk.el('div', 'dt-wallcell');
          var sw = sdk.el('div', 'dt-wallsw'); sw.style.background = o[1] || 'var(--dt-wall)'; sw.style.backgroundSize = o[1] && o[1].indexOf('22px') >= 0 ? '22px 22px' : 'cover';
          cell.appendChild(sw); cell.appendChild(sdk.el('div', 'dt-wall-l', sdk.esc(o[0])));
          cell.onclick = function () { sdk.setWallpaper(o[1]); sdk.notify('Wallpaper set'); };
          grid.appendChild(cell);
        });
        body.appendChild(grid);
      }
      paint(cur);
    }
  });

  /* ═══════════════ CORE: App Store (policy + compatibility gate) ═══════════════ */
  D.registerApp({
    id: 'app-store', name: 'App Store', glyph: '⊞', core: true, seed: true, os: ['*'], pin: true,
    category: 'system', vendor: 'system', desc: 'Install and remove apps.',
    win: { w: 600, h: 500, minW: 400, minH: 340 },
    onOpen: function (win, sdk) {
      function storeName(os) { return os.corpo ? 'Arasaka App Directory' : os.id === 'chrome' ? 'CHROME Shareware' : os.id === 'nue' ? 'NÜ Store' : 'FreeSIDE Repo'; }
      function paint() {
        var b = win.body; b.innerHTML = ''; var os = sdk.osDef(sdk.currentOS());
        var head = sdk.el('div', 'dt-pad');
        head.appendChild(h1(sdk, storeName(os)));
        var policy = mech(sdk, 'apps') === 'curated' ? 'Signed apps only. Sideloading is disabled by policy.' : 'Open repository — install anything, no questions.';
        head.appendChild(sdk.el('div', 'dt-p dt-muted', policy));
        var ad = adStrip(sdk); if (ad) head.appendChild(ad);
        b.appendChild(head);
        var list = sdk.el('div', 'dt-list dt-scroll-y');
        var apps = sdk.availableApps().sort(function (a, c) { return (a.category || '').localeCompare(c.category || '') || a.name.localeCompare(c.name); });
        var blocked = 0;
        if (!apps.length) list.appendChild(sdk.el('div', 'dt-pad dt-muted', 'Nothing else available for this OS.'));
        apps.forEach(function (a) {
          var block = policyBlocked(sdk, a); if (block) blocked++;
          var row = sdk.el('div', 'dt-row'); row.style.cursor = 'default';
          row.innerHTML = '<div class="dt-row-g">' + sdk.esc(a.glyph || a.name.slice(0, 1)) + '</div>' +
            '<div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(a.name) + ' <span class="dt-tag">' + sdk.esc(a.category || 'app') + '</span>' +
            (a.street ? ' <span class="dt-tag">street</span>' : '') + (a.heavy ? ' <span class="dt-tag">heavy</span>' : '') + '</div>' +
            '<div class="dt-row-s">' + sdk.esc(block ? block : (a.desc || '') + ' — ' + (a.vendor || '')) + '</div></div>';
          var acts = sdk.el('div', 'dt-row-acts');
          if (block) { var lk = sdk.el('div', 'dt-tag bad'); lk.textContent = 'blocked'; acts.appendChild(lk); }
          else {
            var installed = sdk.isInstalled(a.id);
            var btn = sdk.el('button', 'dt-btn sm' + (installed ? '' : ' primary'), installed ? 'Remove' : 'Get');
            btn.onclick = function () { if (installed) sdk.uninstall(a.id); else { sdk.install(a.id); sdk.notify(a.name + ' installed'); } paint(); };
            acts.appendChild(btn);
            if (!installed) { var op = sdk.el('button', 'dt-btn sm ghost', 'Open'); op.onclick = function () { sdk.install(a.id); sdk.open(a.id); paint(); }; acts.appendChild(op); }
          }
          row.appendChild(acts); list.appendChild(row);
        });
        b.appendChild(list);
        if (blocked) { var f = sdk.el('div', 'dt-banner bad'); f.textContent = blocked + ' app(s) blocked by this OS’s policy — install a more open OS to run them.'; b.appendChild(f); }
      }
      paint();
    }
  });

  /* ═══════════════ Files ═══════════════ */
  D.registerApp({
    id: 'files', name: 'Files', glyph: '▤', seed: true, os: ['*'],
    category: 'utility', vendor: 'system', desc: 'Browse the machine’s files.',
    win: { w: 620, h: 440, minW: 400, minH: 280 },
    onOpen: function (win, sdk) {
      var folder = null;
      function paint() {
        var b = win.body; b.innerHTML = '';
        var wrap = sdk.el('div', 'dt-split');
        var side = sdk.el('div', 'dt-split-side dt-scroll-y');
        var main = sdk.el('div', 'dt-split-main');
        var folders = sdk.files.folders(); if (!folders.length) folders = ['Home'];
        if (!folder || folders.indexOf(folder) < 0) folder = folders[0];
        folders.forEach(function (f) {
          var it = sdk.el('div', 'dt-sideitem' + (f === folder ? ' on' : ''));
          it.innerHTML = '<span class="dt-sideitem-g">▸</span><span class="dt-sideitem-l">' + sdk.esc(f) + '</span>';
          it.onclick = function () { folder = f; paint(); }; side.appendChild(it);
        });
        var toolbar = sdk.el('div', 'dt-toolbar');
        var add = sdk.el('button', 'dt-btn sm', '＋ New note');
        add.onclick = function () { var e = sdk.files.write({ folder: folder === 'Intel' ? 'Home' : folder, name: 'untitled.txt', kind: 'text', body: '' }); sdk.open('notes', { fileId: e.id }); paint(); };
        toolbar.appendChild(add); main.appendChild(toolbar);
        var list = sdk.el('div', 'dt-list dt-scroll-y');
        var entries = sdk.files.inFolder(folder);
        if (!entries.length) list.appendChild(sdk.el('div', 'dt-pad dt-muted', 'Empty folder.'));
        entries.forEach(function (f) {
          var row = sdk.el('div', 'dt-row');
          var g = f.kind === 'image' ? '▣' : f.kind === 'app' ? '◈' : f.kind === 'link' ? '↗' : '⌗';
          row.innerHTML = '<div class="dt-row-g">' + g + '</div><div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(f.name) + '</div><div class="dt-row-s">' + sdk.esc(f.kind) + (f.ro ? ' · read-only' : '') + '</div></div>';
          row.onclick = function () { openFile(f); };
          if (!f.ro) { var del = sdk.el('button', 'dt-iconbtn x', '✕'); del.title = 'Delete'; del.onclick = function (e) { e.stopPropagation(); sdk.files.remove(f.id); paint(); }; row.appendChild(del); }
          list.appendChild(row);
        });
        main.appendChild(list);
        wrap.appendChild(side); wrap.appendChild(main); b.appendChild(wrap);
      }
      function openFile(f) {
        if (f.kind === 'image') sdk.open('media', { src: f.src || f.body, name: f.name });
        else if (f.kind === 'app') sdk.open(f.app, f.arg);
        else if (f.kind === 'link' && sdk.shell) { if (f.app) sdk.shell.openTool(f.app); }
        else sdk.open('notes', f.ro ? { read: { name: f.name, body: f.body } } : { fileId: f.id });
      }
      paint();
    }
  });

  /* ═══════════════ Notes ═══════════════ */
  D.registerApp({
    id: 'notes', name: 'Notes', glyph: 'N', seed: true, os: ['*'], singleton: false,
    category: 'utility', vendor: 'system', desc: 'A plain notepad, saved to your machine.',
    win: { w: 440, h: 480, minW: 300, minH: 260 },
    onOpen: function (win, sdk, arg) {
      arg = arg || {};
      if (arg.read) { win.setTitle(arg.read.name || 'Note'); var v = sdk.el('div', 'dt-pad dt-selectable dt-reader'); v.textContent = arg.read.body || '(empty)'; win.body.appendChild(v); return; }
      var fileId = arg.fileId || null;
      var file = fileId ? sdk.files.all().filter(function (f) { return f.id === fileId; })[0] : null;
      var wrap = sdk.el('div', 'dt-vstack');
      var bar = sdk.el('div', 'dt-toolbar');
      var name = sdk.el('input', 'dt-field dt-selectable'); name.style.flex = '1'; name.value = (file && file.name) || 'untitled.txt';
      bar.appendChild(name);
      var save = sdk.el('button', 'dt-btn sm primary', 'Save'); bar.appendChild(save);
      var ta = sdk.el('textarea', 'dt-field dt-selectable dt-textarea'); ta.style.margin = '10px'; ta.value = (file && file.body) || '';
      win.setTitle((file && file.name) || 'Notes');
      function doSave() { var e = sdk.files.write({ id: fileId || undefined, folder: (file && file.folder) || 'Home', name: name.value.trim() || 'untitled.txt', kind: 'text', body: ta.value }); fileId = e.id; file = e; win.setTitle(e.name); sdk.notify('Saved'); }
      save.onclick = doSave;
      var t = null; ta.oninput = name.oninput = function () { clearTimeout(t); t = setTimeout(doSave, 900); };
      wrap.appendChild(bar); wrap.appendChild(ta); win.body.appendChild(wrap);
      setTimeout(function () { ta.focus(); }, 30);
    }
  });

  /* ═══════════════ Media (heavy → refuses on a legacy OS) ═══════════════ */
  D.registerApp({
    id: 'media', name: 'Media', glyph: '▷', seed: true, os: ['*'], singleton: false, heavy: true,
    category: 'media', vendor: 'MediaNet', desc: 'View images, art and clips.',
    win: { w: 640, h: 480, minW: 380, minH: 300 },
    onOpen: function (win, sdk, arg) {
      arg = arg || {};
      if (mech(sdk, 'compat') === 'legacy' && !arg.src) { win.body.appendChild(incompatPane(sdk, 'Media', 'It needs modern codecs a legacy OS can’t decode.')); return; }
      if (arg.src) return viewer(arg.src, arg.name);
      gallery();
      function gallery() {
        var b = win.body; b.innerHTML = '';
        var head = sdk.el('div', 'dt-pad');
        head.appendChild(h1(sdk, 'MediaNet'));
        head.appendChild(sdk.el('div', 'dt-p dt-muted', 'Your local library. Feed & braindance sync will land here once the media platform comes online.'));
        b.appendChild(head);
        var ad = adStrip(sdk); if (ad) { ad.style.margin = '0 14px'; b.appendChild(ad); }
        var items = [
          ['img/RacheBartmoss.png', 'rache.jpg'], ['img/cyberdeck.png', 'my_deck.png'],
          ['img/nightcity-map.png', 'nightcity.png'], ['img/webtextures/bluedrag.gif', 'dragon.gif'],
          ['img/webtextures/bloodoze.gif', 'ooze.gif'], ['img/webtextures/blueswrl.jpg', 'swirl.jpg'],
          ['img/ads/japanese-rpg.gif', 'promo.gif'], ['img/body.png', 'render_01.png']
        ];
        var grid = sdk.el('div', 'dt-grid dt-scroll-y');
        items.forEach(function (it) {
          var cell = sdk.el('div', 'dt-mediacell');
          var im = sdk.el('img'); im.src = it[0]; im.alt = it[1]; im.onerror = function () { cell.style.display = 'none'; };
          cell.appendChild(im); cell.appendChild(sdk.el('div', 'dt-mediacell-l', sdk.esc(it[1])));
          cell.onclick = function () { viewer(it[0], it[1]); }; grid.appendChild(cell);
        });
        b.appendChild(grid);
      }
      function viewer(src, name) {
        win.setTitle(name || 'Media'); var b = win.body; b.innerHTML = '';
        var wrap = sdk.el('div', 'dt-vstack');
        var bar = sdk.el('div', 'dt-toolbar');
        var back = sdk.el('button', 'dt-btn sm ghost', '‹ Library'); back.onclick = function () { win.setTitle('Media'); gallery(); };
        bar.appendChild(back); bar.appendChild(sdk.el('div', 'dt-row-s', sdk.esc(name || '')));
        var stage = sdk.el('div', 'dt-mediastage'); var im = sdk.el('img'); im.src = src; stage.appendChild(im);
        wrap.appendChild(bar); wrap.appendChild(stage); b.appendChild(wrap);
      }
    }
  });

  /* ═══════════════ Browser — a real DS window BUILT around the Net ═══════════════ */
  D.registerApp({
    id: 'browser', name: 'Browser', glyph: '◉', seed: true, pin: true, os: ['*'],
    category: 'net', vendor: 'system', desc: 'Reach the Net — sites, boards, apps.',
    win: { w: 820, h: 580, minW: 460, minH: 360 },
    onOpen: function (win, sdk, arg) {
      // The Net browser brings its own chrome — mount it full-bleed in the window.
      // arg (optional) may carry { address:'grid://…' } or { siteId, postId } to deep-link on open.
      var view = sdk.el('div', 'dt-br-view'); win.body.appendChild(view);
      var ok = false;
      if (sdk.web && sdk.web.renderBrowser) { try { sdk.web.renderBrowser({ tool: 'web-browse', addr: arg && arg.address, siteId: arg && arg.siteId, postId: arg && arg.postId }, view); ok = view.childNodes.length > 0; } catch (e) { ok = false; } }
      if (!ok) {
        view.innerHTML = ''; var fb = sdk.el('div', 'dt-pad');
        fb.appendChild(h1(sdk, 'The Net'));
        fb.appendChild(sdk.el('div', 'dt-p dt-muted', sdk.web ? 'Couldn’t embed the browser here — open the full Net section instead.' : 'The Net module isn’t loaded here.'));
        var go = sdk.el('button', 'dt-btn primary', 'Open the Net ↗'); go.onclick = function () { if (sdk.shell) sdk.shell.openTool('web-home'); };
        fb.appendChild(go); view.appendChild(fb);
      }
    }
  });

  /* ═══════════════ NÜ Premium — the (very expensive) "Go Pro" upsell ═══════════════ */
  var NUE_PRO_PRICE = 500;    // eb PER MONTH — a subscription billed monthly by the sheet's banking sim
  function isNuePro(sdk) {
    if (sdk.isPlayer) { var j = sdk.sheet(); return !!(j && j.net && j.net.desktop && j.net.desktop.nuePro); }
    return !!(window.App && App.uiGet && (App.uiGet('desktop', {}) || {}).nuePro);
  }
  function publishSheet(sdk, j) {
    var b = sdk.shell && sdk.shell.bridge && sdk.shell.bridge(), s = b && b.sess;
    if (s && s.camp && s.camp.publishSheet) s.camp.publishSheet(b.idOf ? b.idOf(s.sheetId) : s.sheetId, j.handle || j.name || 'PC', j);
  }
  function setNuePro(sdk, val) {
    if (sdk.isPlayer) { var j = sdk.sheet(); if (!j) return; j.net = j.net || {}; j.net.desktop = j.net.desktop || {}; j.net.desktop.nuePro = !!val; publishSheet(sdk, j); }
    else if (window.App) App.uiSet('desktop.nuePro', !!val);
  }
  // Subscribe = add a monthly service line to the sheet (billed by main.js's sim) + flag pro.
  function subNuePro(sdk) {
    if (!sdk.isPlayer) { setNuePro(sdk, true); return; }             // GM preview: just flip the flag
    var j = sdk.sheet(); if (!j) return;
    j.lifestyle = j.lifestyle || {}; j.lifestyle.services = j.lifestyle.services || [];
    if (!j.lifestyle.services.some(function (s) { return s.desktopPro; })) j.lifestyle.services.push({ name: 'NÜ Premium', cost: NUE_PRO_PRICE, desktopPro: true });
    j.net = j.net || {}; j.net.desktop = j.net.desktop || {}; j.net.desktop.nuePro = true;
    publishSheet(sdk, j);
  }
  function unsubNuePro(sdk) {
    if (!sdk.isPlayer) { setNuePro(sdk, false); return; }
    var j = sdk.sheet(); if (!j) return;
    if (j.lifestyle && j.lifestyle.services) j.lifestyle.services = j.lifestyle.services.filter(function (s) { return !s.desktopPro; });
    j.net = j.net || {}; j.net.desktop = j.net.desktop || {}; j.net.desktop.nuePro = false;
    publishSheet(sdk, j);
  }
  function refreshFurniture() { if (window.__dtRefreshFurniture) try { window.__dtRefreshFurniture(); } catch (e) {} }

  D.registerApp({
    id: 'nue-pro', name: 'NÜ Premium', glyph: '★', core: true, noIcon: true, singleton: true, os: ['nue'],
    category: 'system', vendor: 'DMS', desc: 'Remove ads. For a price.',
    win: { w: 430, h: 500, minW: 320, minH: 340 },
    onOpen: function (win, sdk) {
      var b = win.body;
      function pitch() {
        b.innerHTML = ''; var pad = sdk.el('div', 'dt-pad dt-scroll-y');
        pad.appendChild(h1(sdk, 'NÜ Premium ★'));
        pad.appendChild(sdk.el('div', 'dt-p', 'Tired of ads? Of course you are. Subscribe to NÜ Premium and we’ll stop showing them (we’ll keep harvesting your data, obviously).'));
        var price = sdk.el('div', 'dt-nue-price', NUE_PRO_PRICE + ' eb'); price.appendChild(sdk.el('span', 'dt-nue-per', ' / month')); pad.appendChild(price);
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Billed monthly to your bank. Cancel anytime — from here or your character sheet.'));
        ['No ads. Anywhere. Probably.', 'A gold ★ next to your handle', 'The warm glow of a recurring charge'].forEach(function (p) { var r = sdk.el('div', 'dt-p'); r.innerHTML = '<span class="dt-tag ok">✓</span> ' + sdk.esc(p); pad.appendChild(r); });
        var sub = sdk.el('button', 'dt-btn primary', '★ Subscribe — ' + NUE_PRO_PRICE + 'eb/mo'); sub.style.marginTop = '12px';
        sub.onclick = function () { subNuePro(sdk); refreshFurniture(); sdk.notify('NÜ Premium active — ' + NUE_PRO_PRICE + 'eb/mo, billed to your bank.'); have(); };
        pad.appendChild(sub); b.appendChild(pad);
      }
      function have() {
        b.innerHTML = ''; var pad = sdk.el('div', 'dt-pad');
        pad.appendChild(h1(sdk, 'NÜ Premium ★'));
        pad.appendChild(sdk.el('div', 'dt-p', 'You’re Premium — ' + NUE_PRO_PRICE + 'eb / month. The ads are gone. Your data isn’t — but that was never on the table.'));
        var tag = sdk.el('div', 'dt-tag ok'); tag.textContent = 'subscribed'; pad.appendChild(tag);
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Billed monthly by your bank. The charge shows up in Services on your character sheet.'));
        var cancel = sdk.el('button', 'dt-btn ghost', 'Cancel subscription'); cancel.style.marginTop = '10px';
        cancel.onclick = function () { unsubNuePro(sdk); refreshFurniture(); sdk.notify('Premium cancelled. The ads missed you.'); pitch(); };
        pad.appendChild(cancel); b.appendChild(pad);
      }
      if (isNuePro(sdk)) have(); else pitch();
    }
  });

  /* ═══════════════ Terminal (installable — street, blocked on curated OSes) ═══════════════ */
  D.registerApp({
    id: 'terminal', name: 'Terminal', glyph: '>_', seed: false, os: ['*'], street: true,
    category: 'system', vendor: 'gnu-nc', desc: 'A shell. Street tool — unsigned.',
    win: { w: 580, h: 400, minW: 340, minH: 220 },
    onOpen: function (win, sdk) {
      var out = sdk.el('div', 'dt-term-out dt-selectable dt-scroll-y');
      var line = sdk.el('div', 'dt-term-line');
      var ps = sdk.el('span', 'dt-term-ps', 'runner@' + sdk.currentOS() + ':~$');
      var inp = sdk.el('input', 'dt-field dt-term-in dt-selectable');
      line.appendChild(ps); line.appendChild(inp);
      win.body.appendChild(out); win.body.appendChild(line);
      function print(s) { var d = sdk.el('div'); d.innerHTML = s; out.appendChild(d); out.scrollTop = out.scrollHeight; }
      print('shell — type <b>help</b>. This is a toy; the real damage happens on the Net.');
      var CMDS = {
        help: function () { return 'help, ls, cat &lt;file&gt;, apps, open &lt;app&gt;, os, whoami, echo, date, clear, rache'; },
        ls: function () { return sdk.files.all().map(function (f) { return f.name; }).join('  ') || '(empty)'; },
        cat: function (a) { var f = sdk.files.all().filter(function (x) { return x.name === a; })[0]; return f ? (sdk.esc(f.body) || '(empty)') : 'cat: ' + sdk.esc(a || '') + ': no such file'; },
        apps: function () { return sdk.installedApps().map(function (x) { return x.id; }).join('  '); },
        open: function (a) { if (sdk.apps().some(function (x) { return x.id === a; })) { sdk.open(a); return 'opening ' + sdk.esc(a) + '…'; } return 'open: unknown app: ' + sdk.esc(a || ''); },
        os: function () { var o = sdk.osDef(sdk.currentOS()); return o.name + ' — ' + o.vendor; },
        whoami: function () { var j = sdk.sheet(); return (j && (j.handle || j.name)) || 'runner'; },
        echo: function (a) { return sdk.esc(a || ''); },
        date: function () { return new Date().toString(); },
        clear: function () { out.innerHTML = ''; return ''; },
        rache: function () { return 'Rache Bartmoss is dead. Probably. The RABIDS say otherwise.'; },
        netwatch: function () { return 'NetWatch is watching. Not on FreeSIDE, though. Allegedly.'; }
      };
      inp.onkeydown = function (e) {
        if (e.key !== 'Enter') return; var v = inp.value.trim(); inp.value = '';
        print('<span class="dt-term-ps">' + sdk.esc(ps.textContent) + '</span> ' + sdk.esc(v));
        if (!v) return; var parts = v.split(/\s+/), cmd = parts.shift(), a = parts.join(' ');
        var fn = CMDS[cmd]; var r = fn ? fn(a) : (sdk.esc(cmd) + ': command not found'); if (r) print(r);
      };
      setTimeout(function () { inp.focus(); }, 30);
    }
  });

  /* ═══════════════ Datarain (installable toy) ═══════════════ */
  D.registerApp({
    id: 'rain', name: 'Datarain', glyph: '▓', seed: false, os: ['*'],
    category: 'toys', vendor: 'anon', desc: 'Falling code. Purely decorative.',
    win: { w: 420, h: 320, minW: 220, minH: 180 },
    onOpen: function (win, sdk) {
      var cv = sdk.el('canvas', 'dt-rain'); win.body.style.overflow = 'hidden'; win.body.appendChild(cv);
      var ctx = cv.getContext('2d'), cols = [], raf = null, W = 0, H = 0;
      var GLY = 'ｱｲｳｴｵｶｷｸ0123456789ABCDEF<>*/'.split('');
      function size() { W = cv.width = cv.offsetWidth || 400; H = cv.height = cv.offsetHeight || 300; cols = []; for (var i = 0; i < Math.floor(W / 12); i++) cols[i] = Math.random() * H; }
      function frame() {
        ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(0, 0, W, H);
        ctx.font = '13px monospace'; ctx.fillStyle = '#111';
        for (var i = 0; i < cols.length; i++) { var x = i * 12, y = cols[i]; ctx.fillText(GLY[Math.floor(Math.random() * GLY.length)], x, y); cols[i] = y > H + Math.random() * 400 ? 0 : y + 12; }
        raf = requestAnimationFrame(frame);
      }
      size(); frame();
      var ro = setInterval(function () { if (cv.offsetWidth !== W) size(); }, 1000);
      win.on('close', function () { if (raf) cancelAnimationFrame(raf); clearInterval(ro); });
    }
  });

  /* ═══════════════ starter files ═══════════════ */
  D.seedFile({ folder: 'Home', name: 'readme.txt', kind: 'text', ro: true, body: 'This is your machine.\n\nDrag windows by their title bar, resize from the corner, drag icons where you like. Get more from the App Store — though your OS decides what you may install. Your OS is set on your character sheet (Computer & Web).' });
  D.seedFile({ folder: 'Home', name: 'todo.txt', kind: 'text', ro: true, body: '- pay off the ripperdoc\n- find out who owns the Afterlife\n- DO NOT trust the fixer' });
  D.seedFile({ folder: 'Media', name: 'my_deck.png', kind: 'image', src: 'img/cyberdeck.png', ro: true });

})();
