/* desktop-connectors.js — desktop apps that bridge the OS to the rest of the app.
   ───────────────────────────────────────────────────────────────────────────
   Written against the public Desktop SDK. These are the "connected" apps:
     • Records → the campaign DATA corpus (window.Store), public-gated for players
     • Comms   → the CHAT that lives on the Net/Web module (window.WebSection)
     • Mail    → an inbox built from the sheet's contacts, OS-flavored
   All degrade gracefully when a campaign / module isn't present. */
(function () {
  'use strict';
  if (!window.Desktop) return;
  var D = window.Desktop;

  function alive(win) { return win && win.body && document.contains(win.body); }
  function h1(sdk, t) { return sdk.el('div', 'dt-h1', sdk.esc(t)); }
  function empty(sdk, msg) { var e = sdk.el('div', 'dt-empty'); e.textContent = msg; return e; }

  /* ═══════════════ Records — the campaign DATA corpus ═══════════════ */
  var REC_TYPES = [['npc', 'People', '☺'], ['org', 'Orgs', '⌗'], ['location', 'Places', '◰'], ['shop', 'Shops', '▣'], ['item', 'Items', '◈']];
  D.registerApp({
    id: 'records', name: 'Records', glyph: '⛁', seed: true, os: ['*'],
    category: 'data', vendor: 'DataNet', desc: 'Search the databanks — people, places, orgs.',
    win: { w: 660, h: 480, minW: 420, minH: 300 },
    onOpen: function (win, sdk) {
      var Store = window.Store;
      // OS-flavored product name
      var os = sdk.os || {}; var brand = os.corpo ? 'Arasaka Registry' : os.id === 'freeside' ? 'deepsearch' : os.id === 'chrome' ? 'INFOBASE' : 'Records';
      if (!Store || !(window.App && App.ctx && App.ctx.cid)) {
        var pad = sdk.el('div', 'dt-pad'); pad.appendChild(h1(sdk, brand)); pad.appendChild(empty(sdk, 'No campaign databank connected.')); win.body.appendChild(pad); return;
      }
      win.setTitle(brand);
      var type = 'npc', q = '', rowsCache = {};
      var b = win.body, wrap = sdk.el('div', 'dt-split');
      var side = sdk.el('div', 'dt-split-side dt-scroll-y');
      var main = sdk.el('div', 'dt-split-main');
      wrap.appendChild(side); wrap.appendChild(main); b.appendChild(wrap);

      function loadType(t) {
        if (rowsCache[t]) return Promise.resolve(rowsCache[t]);
        return Store.index(t).then(function (rows) {
          if (sdk.isPlayer) rows = rows.filter(function (r) { return Store.visibleToPlayers(r.json); });
          rowsCache[t] = rows; return rows;
        }).catch(function () { rowsCache[t] = []; return []; });
      }
      function paintSide() {
        side.innerHTML = '';
        REC_TYPES.forEach(function (ty) {
          var it = sdk.el('div', 'dt-sideitem' + (ty[0] === type ? ' on' : ''));
          it.innerHTML = '<span class="dt-sideitem-g">' + ty[2] + '</span><span class="dt-sideitem-l">' + sdk.esc(ty[1]) + '</span>';
          it.onclick = function () { type = ty[0]; paint(); }; side.appendChild(it);
        });
      }
      function paint() {
        paintSide(); main.innerHTML = '';
        var toolbar = sdk.el('div', 'dt-toolbar');
        var s = sdk.el('input', 'dt-field dt-selectable'); s.placeholder = 'Search ' + type + '…'; s.value = q;
        s.oninput = function () { q = s.value; renderList(); };
        toolbar.appendChild(s); main.appendChild(toolbar);
        var list = sdk.el('div', 'dt-list dt-scroll-y'); main.appendChild(list);
        list.appendChild(empty(sdk, 'Loading…'));
        function renderList() {
          loadType(type).then(function (rows) {
            if (!alive(win)) return;
            list.innerHTML = '';
            var ql = q.trim().toLowerCase();
            var filtered = rows.filter(function (r) { return !ql || (Store.displayName(r) || '').toLowerCase().indexOf(ql) >= 0; });
            if (!filtered.length) { list.appendChild(empty(sdk, sdk.isPlayer ? 'Nothing on record (that you can see).' : 'Nothing on record.')); return; }
            filtered.sort(function (a, c) { return (Store.displayName(a) || '').localeCompare(Store.displayName(c) || ''); });
            filtered.forEach(function (r) {
              var row = sdk.el('div', 'dt-row');
              var nm = Store.displayName(r) || r.json.id || 'record';
              var photo = Store.photoOf ? Store.photoOf(r) : null;
              row.innerHTML = (photo ? '<div class="dt-row-g dt-row-photo" style="background-image:url(' + photo + ')"></div>' : '<div class="dt-row-g">' + sdk.esc(nm.slice(0, 1)) + '</div>') +
                '<div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(nm) + '</div><div class="dt-row-s">' + sdk.esc(sub(r.json)) + '</div></div>';
              row.onclick = function () { detail(r); }; list.appendChild(row);
            });
          });
        }
        renderList();
      }
      function sub(j) { return j.role || j.type || j.kind || j.tagline || (j.stats ? 'character' : '') || ''; }
      function detail(r) {
        var j = r.json, nm = Store.displayName(r) || j.id;
        main.innerHTML = '';
        var bar = sdk.el('div', 'dt-toolbar');
        var back = sdk.el('button', 'dt-btn sm ghost', '‹ Back'); back.onclick = paint; bar.appendChild(back);
        main.appendChild(bar);
        var body = sdk.el('div', 'dt-pad dt-scroll-y dt-selectable');
        var photo = Store.photoOf ? Store.photoOf(r) : null;
        if (photo) { var im = sdk.el('img', 'dt-detail-img'); im.src = photo; im.onerror = function () { im.style.display = 'none'; }; body.appendChild(im); }
        body.appendChild(h1(sdk, nm));
        var meta = [j.role, j.type, j.kind, j.founded, j.headquarters].filter(Boolean).join(' · ');
        if (meta) body.appendChild(sdk.el('div', 'dt-p dt-muted', meta));
        var desc = j.desc || j.notes || j.tagline || j.general || (j.sa && j.notes) || '';
        if (desc) body.appendChild(sdk.el('div', 'dt-p', '')).textContent = String(desc).slice(0, 800);
        // public custom props
        var props = (j.props && Array.isArray(j.props.list)) ? j.props.list : (Array.isArray(j.props) ? j.props : []);
        (props || []).forEach(function (p) {
          if (sdk.isPlayer && !p.public) return;
          var row = sdk.el('div', 'dt-inforow'); row.innerHTML = '<div class="dt-infok">' + sdk.esc(p.label || p.key || '') + '</div><div class="dt-infov">' + sdk.esc(String(p.value != null ? p.value : '')) + '</div>'; body.appendChild(row);
        });
        main.appendChild(body);
      }
      paint();
    }
  });

  /* ═══════════════ netapp — a Net "app" site (chat client) as a STANDALONE
        desktop window: full-bleed, its own UI, NO browser chrome. Hidden app,
        opened by Comms via sdk.open('netapp', { site }). Uses the public
        WebSection.renderSite(host, siteJson, ctx). ═══════════════ */
  // Real chat CLIENTS only = bespoke app sites (kind:'app' + a dedicated renderer).
  // A normal site that merely contains a `messenger` block (e.g. NC Comms,
  // interstate-hell) is NOT a chat app and must not show here.
  var CHAT_APPS = ['corpo-msg', 'runner-comms', 'consumer', 'elite', 'public'];
  function isChatSite(j) { return !!(j && j.kind === 'app' && CHAT_APPS.indexOf(j.app) >= 0); }
  function chatTag(j) {
    return ({ 'corpo-msg': 'corporate · channels + DMs', 'runner-comms': 'encrypted · DM only', 'consumer': 'mass-market · free', 'elite': 'invite-only', 'public': 'municipal · free' })[j.app] || 'chat client';
  }
  D.registerApp({
    id: 'netapp', name: 'Messenger', glyph: '✆', core: true, noIcon: true, os: ['*'], singleton: false,
    category: 'net', vendor: 'system', desc: 'A Net app.',
    win: { w: 720, h: 560, minW: 380, minH: 320 },
    onOpen: function (win, sdk, arg) {
      var site = arg && arg.site, web = sdk.web;
      if (!site || !web || !web.renderSite) { win.body.appendChild(sdk.el('div', 'dt-pad dt-muted', 'This app can’t be opened here.')); return; }
      win.setTitle(site.name || 'Messenger');
      // renderSite reclasses this host to .web-page(-app); desktop CSS makes it full-bleed.
      var host = sdk.el('div'); win.body.appendChild(host);
      var page = (site.pages || []).filter(function (p) { return p.home; })[0] || (site.pages || [])[0] || null;
      try { web.renderSite(host, site, { siteId: site.id, siteJson: site, page: page, host: host, subject: site.subject || null }); }
      catch (e) { host.innerHTML = ''; host.appendChild(sdk.el('div', 'dt-pad dt-muted', 'Couldn’t open “' + sdk.esc(site.name || 'app') + '”.')); }
    }
  });

  /* ═══════════════ Comms — your CHAT clients (each opens as its own app) ═══════════════ */
  D.registerApp({
    id: 'comms', name: 'Comms', glyph: '✆', seed: true, os: ['*'], pin: true,
    category: 'net', vendor: 'system', desc: 'Your chat clients.',
    win: { w: 460, h: 460, minW: 320, minH: 280 },
    onOpen: function (win, sdk) {
      var Store = window.Store, b = win.body, os = sdk.os || {};
      var head = sdk.el('div', 'dt-pad');
      head.appendChild(h1(sdk, os.corpo ? 'AraNet' : os.id === 'freeside' ? 'BLACKICE' : 'Messages'));
      head.appendChild(sdk.el('div', 'dt-p dt-muted', 'Your messaging apps. Each opens as its own full-screen app.'));
      b.appendChild(head);
      var list = sdk.el('div', 'dt-list dt-scroll-y'); b.appendChild(list);
      function fallback(msg) {
        list.appendChild(empty(sdk, msg || 'No chat clients installed.'));
        var pad = sdk.el('div', 'dt-pad'); var go = sdk.el('button', 'dt-btn ghost sm', 'Open the Net ↗'); go.onclick = function () { if (sdk.shell) sdk.shell.openTool('web-home'); }; pad.appendChild(go); b.appendChild(pad);
      }
      if (!Store || !(window.App && App.ctx && App.ctx.cid)) { fallback('No campaign connected.'); return; }
      Store.index('site').then(function (rows) {
        if (!alive(win)) return;
        var apps = rows.filter(function (r) { return isChatSite(r.json); });
        if (sdk.isPlayer) apps = apps.filter(function (r) { return Store.visibleToPlayers(r.json); });
        if (!apps.length) { fallback(); return; }
        apps.forEach(function (r) {
          var j = r.json, row = sdk.el('div', 'dt-row');
          row.innerHTML = '<div class="dt-row-g">✆</div><div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(j.name || 'Messenger') + '</div><div class="dt-row-s">' + sdk.esc(chatTag(j)) + '</div></div>';
          row.onclick = function () { sdk.open('netapp', { site: j }); };
          list.appendChild(row);
        });
      }).catch(function () { if (alive(win)) fallback(); });
    }
  });

  /* ═══════════════ Mail — an inbox built from the sheet's contacts ═══════════════ */
  var MAIL_SEED = {
    corpo: [
      { from: 'HR.Bot@arasaka', sub: 'Mandatory loyalty seminar', body: 'Attendance is not optional. Your continued employment reflects your enthusiasm.' },
      { from: 'security@arasaka', sub: 'Anomalous access flagged', body: 'Your terminal accessed an unlisted node at 03:14. This has been logged. Explain within 24h.' },
      { from: 'no-reply@aranet', sub: 'Your Kiroshi OS update', body: 'Build 2.0.21 installs tonight. Telemetry improvements. You cannot defer.' }
    ],
    street: [
      { from: 'fixer://nix', sub: 'work, if you want it', body: 'Got a courier run. Low heat, decent eddies. Usual dead drop. Burn this after.' },
      { from: 'anon@freeside', sub: 're: that host', body: 'The address you wanted resolves to a shell in Old Downtown. Be careful who you tell.' }
    ]
  };
  D.registerApp({
    id: 'mail', name: 'Mail', glyph: '✉', seed: true, os: ['*'],
    category: 'net', vendor: 'system', desc: 'Read and send mail to your contacts.',
    win: { w: 660, h: 460, minW: 420, minH: 300 },
    onOpen: function (win, sdk) {
      var os = sdk.os || {}, corpo = !!os.corpo, street = os.id === 'freeside';
      var sv = (os.mech && os.mech.surveillance) || 'anonymous';
      win.setTitle(corpo ? 'AraMail' : street ? 'GhostMail' : 'Mail');
      var store = sdk.store;
      var sheet = sdk.sheet && sdk.sheet();
      var contacts = ((sheet && sheet.contacts) || []).map(function (c) { return c && (c.name || c.handle); }).filter(Boolean);
      var seed = corpo ? MAIL_SEED.corpo : street ? MAIL_SEED.street : MAIL_SEED.street;
      // contact-derived threads
      var fromContacts = contacts.slice(0, 6).map(function (n) { return { from: n, sub: 'catching up', body: 'Hey — it’s ' + n + '. We should talk. You know where to find me.' }; });
      var inbox = seed.concat(fromContacts);
      var sent = store.get('sent', []);
      var view = 'inbox';
      var b = win.body, wrap = sdk.el('div', 'dt-split');
      var side = sdk.el('div', 'dt-split-side dt-scroll-y');
      var main = sdk.el('div', 'dt-split-main');
      wrap.appendChild(side); wrap.appendChild(main); b.appendChild(wrap);

      function paint() {
        side.innerHTML = '';
        [['inbox', 'Inbox', inbox.length], ['sent', 'Sent', sent.length]].forEach(function (v) {
          var it = sdk.el('div', 'dt-sideitem' + (v[0] === view ? ' on' : ''));
          it.innerHTML = '<span class="dt-sideitem-l">' + sdk.esc(v[1]) + '</span><span class="dt-count">' + v[2] + '</span>';
          it.onclick = function () { view = v[0]; paint(); }; side.appendChild(it);
        });
        var comp = sdk.el('button', 'dt-btn sm primary dt-mail-compose', '＋ Compose'); comp.onclick = compose; side.appendChild(comp);
        main.innerHTML = '';
        if (sv === 'logged') { var mon = sdk.el('div', 'dt-banner bad'); mon.textContent = '◉ MONITORED — everything you read and send here is logged.'; main.appendChild(mon); }
        else if (sv === 'harvested') { var ha = sdk.el('div', 'dt-banner warn'); ha.textContent = '◉ Ad-funded — your messages train DMS ad targeting.'; main.appendChild(ha); }
        else { var enc = sdk.el('div', 'dt-banner ok'); enc.textContent = 'End-to-end encrypted. Nothing is stored on a server.'; main.appendChild(enc); }
        var msgs = view === 'inbox' ? inbox : sent;
        var list = sdk.el('div', 'dt-list dt-scroll-y');
        if (!msgs.length) list.appendChild(empty(sdk, view === 'sent' ? 'No sent mail yet.' : 'Inbox zero.'));
        msgs.forEach(function (m) {
          var row = sdk.el('div', 'dt-row');
          row.innerHTML = '<div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(m.sub || '(no subject)') + '</div><div class="dt-row-s">' + sdk.esc(view === 'sent' ? 'to ' + (m.to || '?') : m.from) + '</div></div>';
          row.onclick = function () { read(m, view); }; list.appendChild(row);
        });
        main.appendChild(list);
      }
      function read(m, from) {
        main.innerHTML = '';
        var bar = sdk.el('div', 'dt-toolbar'); var back = sdk.el('button', 'dt-btn sm ghost', '‹ Back'); back.onclick = paint; bar.appendChild(back);
        if (from === 'inbox') { var re = sdk.el('button', 'dt-btn sm', 'Reply'); re.onclick = function () { compose(m.from); }; bar.appendChild(re); }
        main.appendChild(bar);
        var body = sdk.el('div', 'dt-pad dt-scroll-y dt-selectable');
        body.appendChild(h1(sdk, m.sub || '(no subject)'));
        body.appendChild(sdk.el('div', 'dt-row-s dt-mail-from', from === 'sent' ? 'to ' + (m.to || '?') : 'from ' + m.from));
        body.appendChild(sdk.el('div', 'dt-p dt-reader', '')).textContent = m.body || '';
        if (sv === 'logged') { var t = sdk.el('div', 'dt-tag bad'); t.style.marginTop = '12px'; t.textContent = 'session logged'; body.appendChild(t); }
        else if (sv === 'harvested') { var t2 = sdk.el('div', 'dt-tag warn'); t2.style.marginTop = '12px'; t2.textContent = 'scanned for ads'; body.appendChild(t2); }
        main.appendChild(body);
      }
      function compose(to) {
        main.innerHTML = '';
        var bar = sdk.el('div', 'dt-toolbar'); var back = sdk.el('button', 'dt-btn sm ghost', '‹ Cancel'); back.onclick = paint; bar.appendChild(back);
        main.appendChild(bar);
        var body = sdk.el('div', 'dt-pad dt-vgap');
        var toWrap = sdk.el('div');
        toWrap.appendChild(sdk.el('div', 'dt-label', 'To'));
        var toIn = sdk.el('input', 'dt-field dt-selectable'); toIn.value = to || ''; toIn.placeholder = 'a contact or handle'; toWrap.appendChild(toIn);
        if (contacts.length) { var dl = sdk.el('div', 'dt-chips'); contacts.slice(0, 8).forEach(function (n) { var c = sdk.el('button', 'dt-chip', sdk.esc(n)); c.onclick = function () { toIn.value = n; }; dl.appendChild(c); }); toWrap.appendChild(dl); }
        body.appendChild(toWrap);
        body.appendChild(sdk.el('div', 'dt-label', 'Subject'));
        var subIn = sdk.el('input', 'dt-field dt-selectable'); body.appendChild(subIn);
        body.appendChild(sdk.el('div', 'dt-label', 'Message'));
        var msgIn = sdk.el('textarea', 'dt-field dt-selectable dt-textarea'); msgIn.style.minHeight = '120px'; body.appendChild(msgIn);
        var send = sdk.el('button', 'dt-btn primary', 'Send'); send.style.marginTop = '10px';
        send.onclick = function () {
          var to2 = toIn.value.trim(); if (!to2) { sdk.notify('Add a recipient.'); return; }
          sent = sent.concat([{ to: to2, sub: subIn.value.trim() || '(no subject)', body: msgIn.value, ts: Date.now() }]);
          store.set('sent', sent); sdk.notify(corpo ? 'Sent (and logged).' : 'Sent.'); view = 'sent'; paint();
        };
        body.appendChild(send);
        main.appendChild(body);
      }
      paint();
    }
  });

})();
