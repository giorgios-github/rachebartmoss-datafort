/* desktop-apps2.js — the content apps for the Desktop OS (wave 1).
   ───────────────────────────────────────────────────────────────────────────
   All on the public Desktop SDK. `os:[...]` locks an app to an OS, `street:true`
   makes curated (corpo) OSes block it, `heavy:true` makes legacy OSes refuse it.
   That's what makes the App Store a real differentiator: the corpo Portal only
   runs on a corpo OS; DeadDrop and Sniffer never show on one. */
(function () {
  'use strict';
  if (!window.Desktop) return;
  var D = window.Desktop;
  var App = window.App;
  function h1(sdk, t) { return sdk.el('div', 'dt-h1', sdk.esc(t)); }
  function money(n) { return (typeof n === 'number' ? Math.round(n) : (parseFloat(n) || 0)).toLocaleString('en-US') + ' eb'; }
  function publishSheet(sdk, j) { var b = sdk.shell && sdk.shell.bridge && sdk.shell.bridge(), s = b && b.sess; if (s && s.camp && s.camp.publishSheet) s.camp.publishSheet(b.idOf ? b.idOf(s.sheetId) : s.sheetId, j.handle || j.name || 'PC', j); }
  function askChain(qs, done, acc) { acc = acc || []; if (!qs.length) return done(acc); var q = qs[0]; App.prompt(q[0], q[1] || q[0], q[2] || '', function (v) { acc.push(v == null ? '' : String(v).trim()); askChain(qs.slice(1), done, acc); }); }
  function hasCampaign() { return !!(window.Store && App && App.ctx && App.ctx.cid); }
  // pay-source picker + debit against the sheet (cash or an account), publishes.
  function paySources(sdk) { var j = sdk.sheet && sdk.sheet(), ls = (j && j.lifestyle) || {}; var out = [['cash', 'Cash (' + money(ls.cash || 0) + ')']]; ((ls.accounts || []).filter(function (a) { return !a.closed; })).forEach(function (a) { out.push([a.id, (a.name || 'account') + ' (' + money(a.balance || 0) + ')']); }); return out; }
  function chargeSource(sdk, src, cost, label) {
    if (!sdk.isPlayer) return true;                          // GM: no debit
    var j = sdk.sheet(); if (!j) return false; var ls = j.lifestyle = j.lifestyle || {};
    if (src === 'cash' || !src) { if ((parseFloat(ls.cash) || 0) < cost) return false; ls.cash = (parseFloat(ls.cash) || 0) - cost; }
    else { var a = (ls.accounts || []).filter(function (x) { return x.id === src; })[0]; if (!a || (parseFloat(a.balance) || 0) < cost) return false; a.balance = (parseFloat(a.balance) || 0) - cost; a.ledger = a.ledger || []; a.ledger.unshift({ id: 'dt' + Math.floor(Date.now()), type: 'expense', label: label || 'purchase', amount: cost }); }
    publishSheet(sdk, j); return true;
  }
  function shopSave(json, done) { window.Store.put({ type: 'shop', id: json.id }, json).then(function () { if (App.emit) App.emit('entity:saved', { type: 'shop', id: json.id }); done && done(); }).catch(function () { done && done(); }); }
  function shopCreate(json, done) { window.Store.create('shop', json).then(function (res) { if (App.emit) App.emit('entity:saved', { type: 'shop' }); done && done(res); }).catch(function () { done && done(null); }); }
  // an IN-APP form (App.prompt / UI.modal open BEHIND the opaque desktop — z-index)
  function dtForm(win, sdk, opts) {
    win.body.innerHTML = ''; var pad = sdk.el('div', 'dt-pad dt-scroll-y');
    if (opts.back) { var b = sdk.el('button', 'dt-btn sm ghost', '‹ Cancel'); b.onclick = opts.back; pad.appendChild(b); }
    pad.appendChild(h1(sdk, opts.title));
    var inputs = {};
    opts.fields.forEach(function (f) {
      pad.appendChild(sdk.el('div', 'dt-label', f.label));
      var i; if (f.type === 'textarea') i = sdk.el('textarea', 'dt-field dt-selectable dt-textarea'); else { i = sdk.el('input', 'dt-field dt-selectable'); if (f.type === 'number') i.type = 'number'; }
      if (f.val != null) i.value = f.val; if (f.ph) i.placeholder = f.ph; pad.appendChild(i); inputs[f.key] = i;
    });
    var go = sdk.el('button', 'dt-btn primary', opts.submit || 'Save'); go.style.marginTop = '12px';
    go.onclick = function () { var v = {}; opts.fields.forEach(function (f) { v[f.key] = (inputs[f.key].value || '').trim(); }); opts.onSubmit(v); };
    pad.appendChild(go); win.body.appendChild(pad);
    setTimeout(function () { var el = pad.querySelector('input,textarea'); if (el) el.focus(); }, 30);
  }
  // all places logged on the Night City / world / custom maps (nightcity campaign doc)
  function mapPlaces(cb) {
    if (!(App && App.api && App.ctx && App.ctx.cid)) return cb([]);
    App.api('GET', 'campaigns/' + encodeURIComponent(App.ctx.cid) + '/nightcity/_campaign.json').then(function (d) {
      var GM = (d && d.GM) || {}, out = [];
      (GM.list || []).forEach(function (nb) { (nb.entries || []).forEach(function (e) { out.push(e); }); });
      (GM.maps || []).forEach(function (m) { (m.gmEntries || []).forEach(function (e) { out.push(e); }); });
      if (GM.world && GM.world.places) GM.world.places.forEach(function (e) { out.push(e); });
      cb(out);
    }).catch(function () { cb([]); });
  }

  /* ═══════════════ Portal — a corpo intranet, driven by the OS's corp ═══════════════ */
  var PORTALS = {
    kiroshi: { motto: 'Loyalty. Precision. Perpetuity.', ann: ['Mandatory loyalty seminar — Friday, 0900. Attendance logged.', 'City Center tower lockdown drill at 0600. Do not deviate.', 'Employee of the Month: [REDACTED, clearance 4].'], depts: ['Trauma Team liaison', 'Arasaka Bank', 'Security Division', 'Kiroshi Optics'] },
    bastion: { motto: 'Peace through superior firepower.', ann: ['Live-fire refresher — Range B, 1400. Bring your own hearing.', 'New ROE package pushed to all units. Acknowledge or lose pay.', 'Report anomalous net activity to S2. Yes, this counts.'], depts: ['Militech Armory', 'TacNet Ops', 'Contracts & Procurement', 'Personnel (expendable)'] }
  };
  D.registerApp({
    id: 'portal', name: 'Portal', glyph: '⊟', seed: true, os: ['kiroshi', 'bastion'],
    category: 'work', vendor: 'corp', desc: 'Your employer’s intranet.',
    win: { w: 620, h: 480, minW: 400, minH: 320 },
    onOpen: function (win, sdk) {
      var os = sdk.os || {}, corp = os.vendor || 'the Corp', cfg = PORTALS[os.id] || { motto: '', ann: [], depts: [] };
      win.setTitle(corp + ' Portal');
      function login() {
        var b = win.body; b.innerHTML = ''; var pad = sdk.el('div', 'dt-pad dt-portal-login');
        pad.appendChild(h1(sdk, corp));
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', cfg.motto));
        pad.appendChild(sdk.el('div', 'dt-label', 'Employee ID'));
        var u = sdk.el('input', 'dt-field dt-selectable'); u.value = ''; u.placeholder = 'badge #'; pad.appendChild(u);
        pad.appendChild(sdk.el('div', 'dt-label', 'Passphrase'));
        var p = sdk.el('input', 'dt-field dt-selectable'); p.type = 'password'; pad.appendChild(p);
        var go = sdk.el('button', 'dt-btn primary', 'Sign in'); go.style.marginTop = '12px'; go.onclick = dash; pad.appendChild(go);
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Access is logged. Unauthorized use is a terminable — and survivable-optional — offence.'));
        b.appendChild(pad);
      }
      function dash() {
        var b = win.body; b.innerHTML = '';
        var bar = sdk.el('div', 'dt-toolbar'); bar.appendChild(sdk.el('div', 'dt-row-t', corp + ' · signed in')); var out = sdk.el('button', 'dt-btn sm ghost', 'Sign out'); out.onclick = login; bar.appendChild(out); b.appendChild(bar);
        var body = sdk.el('div', 'dt-pad dt-scroll-y');
        body.appendChild(sdk.el('div', 'dt-h2', 'Announcements'));
        (cfg.ann || []).forEach(function (a) { var n = sdk.el('div', 'dt-portal-ann'); n.textContent = '▪ ' + a; body.appendChild(n); });
        body.appendChild(sdk.el('div', 'dt-h2', 'Departments'));
        var grid = sdk.el('div', 'dt-grid'); grid.style.padding = '0';
        (cfg.depts || []).concat(['Directory', 'Documents', 'Webmail', 'Security']).forEach(function (d) {
          var t = sdk.el('button', 'dt-portal-tile', sdk.esc(d)); t.onclick = function () { sdk.notify('“' + d + '” — access denied (clearance too low).'); }; grid.appendChild(t);
        });
        body.appendChild(grid); b.appendChild(body);
      }
      login();
    }
  });

  /* ═══════════════ BD Studio — braindance player (heavy: no legacy OS) ═══════════════ */
  var BD_LIB = [
    { name: 'Sunset over the Bay', genre: 'lifestyle', img: 'img/nightcity-map.png' },
    { name: 'Chrome & Consequence', genre: 'combat', img: 'img/cyberdeck.png' },
    { name: 'The Afterlife, 3AM', genre: 'social', img: 'img/RacheBartmoss.png' },
    { name: 'Freefall (do not scrub)', genre: 'thrill', img: 'img/body.png' },
    { name: 'Somebody Else’s Monday', genre: 'slice', img: 'img/body2.png' }
  ];
  D.registerApp({
    id: 'bd', name: 'BD Studio', glyph: '◈', seed: true, os: ['*'], heavy: true,
    category: 'media', vendor: 'MediaNet', desc: 'Play and scrub braindances.',
    win: { w: 660, h: 500, minW: 420, minH: 320 },
    onOpen: function (win, sdk) {
      if (window.Desktop && Desktop.osDef && (Desktop.osDef(sdk.currentOS()) || {}).mech && Desktop.osDef(sdk.currentOS()).mech.compat === 'legacy') {
        var d = sdk.el('div', 'dt-pad'); d.appendChild(h1(sdk, 'Cannot run')); d.appendChild(sdk.el('div', 'dt-p dt-muted', 'Braindance needs a modern OS — the wetware codecs won’t load here.')); var t = sdk.el('div', 'dt-tag bad'); t.textContent = 'legacy os'; d.appendChild(t); win.body.appendChild(d); return;
      }
      library();
      function library() {
        var b = win.body; b.innerHTML = ''; b.appendChild(sdk.el('div', 'dt-pad', '')).appendChild(h1(sdk, 'Braindance Library'));
        var grid = sdk.el('div', 'dt-grid dt-scroll-y');
        BD_LIB.forEach(function (bd) {
          var cell = sdk.el('div', 'dt-mediacell'); var im = sdk.el('img'); im.src = bd.img; im.onerror = function () { im.style.visibility = 'hidden'; };
          cell.appendChild(im); cell.appendChild(sdk.el('div', 'dt-mediacell-l', sdk.esc(bd.name) + ' · ' + bd.genre));
          cell.onclick = function () { player(bd); }; grid.appendChild(cell);
        });
        b.appendChild(grid);
      }
      function player(bd) {
        win.setTitle('BD · ' + bd.name); var b = win.body; b.innerHTML = '';
        var wrap = sdk.el('div', 'dt-vstack');
        var bar = sdk.el('div', 'dt-toolbar'); var back = sdk.el('button', 'dt-btn sm ghost', '‹ Library'); back.onclick = function () { win.setTitle('BD Studio'); library(); }; bar.appendChild(back); bar.appendChild(sdk.el('div', 'dt-row-s', sdk.esc(bd.name)));
        var stage = sdk.el('div', 'dt-bd-stage'); var im = sdk.el('img'); im.src = bd.img; stage.appendChild(im);
        var tracks = sdk.el('div', 'dt-bd-tracks');
        ['Visual', 'Audio', 'Thermal', 'Emotion', 'Scent'].forEach(function (tk) { var c = sdk.el('button', 'dt-bd-track on', tk); c.onclick = function () { c.classList.toggle('on'); }; tracks.appendChild(c); });
        var scrub = sdk.el('div', 'dt-bd-scrub'); var fill = sdk.el('i'); scrub.appendChild(fill);
        scrub.onclick = function (e) { var r = scrub.getBoundingClientRect(); fill.style.width = Math.round((e.clientX - r.left) / r.width * 100) + '%'; };
        var ctl = sdk.el('div', 'dt-bd-ctl'); var play = sdk.el('button', 'dt-btn sm', '▶ Play'); var pl = false;
        play.onclick = function () { pl = !pl; play.textContent = pl ? '❚❚ Pause' : '▶ Play'; }; ctl.appendChild(play);
        ctl.appendChild(sdk.el('div', 'dt-row-s', 'edit: toggle a track to strip it · scrub to seek'));
        wrap.appendChild(bar); wrap.appendChild(stage); wrap.appendChild(tracks); wrap.appendChild(scrub); wrap.appendChild(ctl); b.appendChild(wrap);
      }
    }
  });

  /* ═══════════════ Ledger — a usable banking interface over the sheet's accounts ═══════════════
     Operates the SAME sheet.lifestyle data as cs.html's Banking (transfers, open /
     close, deposit / withdraw, per-account history, overdraft rules). Loans,
     term deposits and investments stay on the full sheet. */
  var LG_TIERS = { 1: { fee: 50, overdraft: 100, label: 'Budget' }, 2: { fee: 400, overdraft: 1000, label: 'Corporate' }, 3: { fee: 1000, overdraft: 5000, label: 'Premium' } };
  var LG_BANKS = [
    { id: 'westcity', name: 'West City Bank', tier: 1 }, { id: 'maf', name: 'Merrill, Asukaga & Finch', tier: 1 }, { id: 'sumitomo', name: 'Sumitomo', tier: 1 },
    { id: 'arasaka', name: 'Arasaka', tier: 2 }, { id: 'fujiwara', name: 'Fujiwara', tier: 2 }, { id: 'hilliard', name: 'Hilliard Corporation', tier: 2 },
    { id: 'drakon', name: 'Drakon Worldwide Fund', tier: 3 }, { id: 'eurobank', name: 'Eurobank', tier: 3 }
  ];
  var LG_BBY = {}; LG_BANKS.forEach(function (b) { LG_BBY[b.id] = b; });
  function lgUid() { return 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  D.registerApp({
    id: 'ledger', name: 'Ledger', glyph: '▤', seed: true, os: ['*'],
    category: 'finance', vendor: 'system', desc: 'Accounts, transfers, deposits — the daily banking.',
    win: { w: 560, h: 520, minW: 360, minH: 340 },
    onOpen: function (win, sdk) {
      var state = 'home';
      function J() { return sdk.sheet && sdk.sheet(); }
      function LS() { var x = J(); if (x) x.lifestyle = x.lifestyle || {}; return x ? x.lifestyle : null; }
      function save() { var x = J(); if (x) publishSheet(sdk, x); }
      function accs() { return ((LS() || {}).accounts || []).filter(function (a) { return !a.closed; }); }
      function accById(id) { return accs().filter(function (a) { return a.id === id; })[0]; }
      function tierOf(a) { var b = LG_BBY[a.bankId]; return LG_TIERS[(b ? b.tier : (a.tier || 1))] || LG_TIERS[1]; }
      function push(a, type, label, amt) { a.ledger = a.ledger || []; a.ledger.unshift({ id: lgUid(), type: type, label: label, amount: amt }); }
      function canDebit(a, amt) { return (parseFloat(a.balance) || 0) - amt >= -tierOf(a).overdraft; }
      var pad; function panel(title, back) { win.body.innerHTML = ''; pad = sdk.el('div', 'dt-pad dt-scroll-y'); if (back) { var bk = sdk.el('button', 'dt-btn sm ghost', '‹ Back'); bk.onclick = function () { state = back; render(); }; pad.appendChild(bk); } pad.appendChild(h1(sdk, title)); win.body.appendChild(pad); }
      function field(label) { pad.appendChild(sdk.el('div', 'dt-label', label)); var i = sdk.el('input', 'dt-field dt-selectable'); i.type = 'number'; i.placeholder = '0'; pad.appendChild(i); return i; }
      function selField(label, opts) { pad.appendChild(sdk.el('div', 'dt-label', label)); var s = sdk.el('select', 'dt-field'); opts.forEach(function (o) { var e = sdk.el('option'); e.value = o[0]; e.textContent = o[1]; s.appendChild(e); }); pad.appendChild(s); return s; }

      function render() {
        if (!LS()) { win.body.innerHTML = ''; var p = sdk.el('div', 'dt-pad'); p.appendChild(h1(sdk, 'Ledger')); p.appendChild(sdk.el('div', 'dt-empty', sdk.role === 'gm' ? 'No sheet in GM preview.' : 'No banking on this sheet yet.')); win.body.appendChild(p); return; }
        if (state === 'home') return home();
        if (state === 'open') return openView();
        if (state === 'transfer') return moveView('transfer');
        if (state === 'deposit') return moveView('deposit');
        if (state === 'withdraw') return moveView('withdraw');
        return detail(state);
      }
      function home() {
        panel('Ledger'); var L = LS();
        var total = (parseFloat(L.cash) || 0) + accs().reduce(function (t, a) { return t + (parseFloat(a.balance) || 0); }, 0);
        var head = sdk.el('div', 'dt-ledger-total'); head.innerHTML = '<span class="dt-ledger-lbl">Net worth</span><span class="dt-ledger-big">' + money(total) + '</span>'; pad.appendChild(head);
        var cash = sdk.el('div', 'dt-row'); cash.style.cursor = 'default'; cash.innerHTML = '<div class="dt-row-g">₡</div><div class="dt-row-main"><div class="dt-row-t">Cash</div><div class="dt-row-s">in hand</div></div><div class="dt-ledger-bal">' + money(L.cash) + '</div>'; pad.appendChild(cash);
        var acts = sdk.el('div'); acts.style.cssText = 'display:flex;gap:6px;margin:8px 0 6px;flex-wrap:wrap';
        function act(lbl, to, cls) { var bt = sdk.el('button', 'dt-btn sm' + (cls || ''), lbl); bt.onclick = function () { state = to; render(); }; acts.appendChild(bt); }
        if (accs().length) { act('Transfer', 'transfer'); act('Deposit', 'deposit', ' ghost'); act('Withdraw', 'withdraw', ' ghost'); }
        pad.appendChild(acts);
        pad.appendChild(sdk.el('div', 'dt-h2', 'Accounts'));
        if (!accs().length) pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'No accounts yet. Open one below.'));
        accs().forEach(function (a) {
          var row = sdk.el('div', 'dt-row'), t = tierOf(a);
          row.innerHTML = '<div class="dt-row-g">▣</div><div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(a.name || 'Account') + '</div><div class="dt-row-s">' + sdk.esc(t.label) + ' · fee ' + t.fee + '/mo · overdraft ' + t.overdraft + '</div></div><div class="dt-ledger-bal">' + money(a.balance) + '</div>';
          row.onclick = function () { state = a.id; render(); }; pad.appendChild(row);
        });
        var open = sdk.el('button', 'dt-btn', '＋ Open an account'); open.style.marginTop = '10px'; open.onclick = function () { state = 'open'; render(); }; pad.appendChild(open);
        var svc = (L.services || []); if (svc.length) { pad.appendChild(sdk.el('div', 'dt-h2', 'Monthly services')); svc.forEach(function (s) { var r = sdk.el('div', 'dt-ledger-tx'); r.style.paddingLeft = '0'; r.innerHTML = '<span>' + sdk.esc(s.name || 'service') + '</span><span class="out">−' + money(s.cost) + '/mo</span>'; pad.appendChild(r); }); }
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Loans, term deposits & investments live on your character sheet.'));
      }
      function detail(id) {
        var a = accById(id); if (!a) { state = 'home'; return render(); }
        panel(a.name || 'Account', 'home'); var t = tierOf(a);
        var head = sdk.el('div', 'dt-ledger-total'); head.innerHTML = '<span class="dt-ledger-lbl">' + sdk.esc(t.label) + ' · overdraft ' + t.overdraft + '</span><span class="dt-ledger-big">' + money(a.balance) + '</span>'; pad.appendChild(head);
        var acts = sdk.el('div'); acts.style.cssText = 'display:flex;gap:6px;margin:8px 0;flex-wrap:wrap';
        [['Transfer', 'transfer'], ['Deposit', 'deposit'], ['Withdraw', 'withdraw']].forEach(function (x) { var bt = sdk.el('button', 'dt-btn sm', x[0]); bt.onclick = function () { win._from = a.id; state = x[1]; render(); }; acts.appendChild(bt); });
        var close = sdk.el('button', 'dt-btn sm ghost', 'Close account'); close.onclick = function () { LS().cash = (parseFloat(LS().cash) || 0) + (parseFloat(a.balance) || 0); LS().accounts = LS().accounts.filter(function (x) { return x.id !== id; }); save(); sdk.notify('Account closed — balance moved to cash.'); state = 'home'; render(); }; acts.appendChild(close);
        pad.appendChild(acts);
        pad.appendChild(sdk.el('div', 'dt-h2', 'History'));
        var led = (a.ledger || []).slice(0, 20);
        if (!led.length) pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'No transactions yet.'));
        led.forEach(function (e) { var r = sdk.el('div', 'dt-ledger-tx'); r.style.paddingLeft = '0'; var inc = /in|income|deposit/.test(e.type || ''); r.innerHTML = '<span>' + sdk.esc(e.label || e.type || '—') + '</span><span class="' + (inc ? 'in' : 'out') + '">' + (inc ? '+' : '−') + money(e.amount) + '</span>'; pad.appendChild(r); });
      }
      function openView() {
        panel('Open an account', 'home');
        [1, 2, 3].forEach(function (tier) {
          pad.appendChild(sdk.el('div', 'dt-h2', LG_TIERS[tier].label + ' · fee ' + LG_TIERS[tier].fee + '/mo · overdraft ' + LG_TIERS[tier].overdraft));
          LG_BANKS.filter(function (b) { return b.tier === tier; }).forEach(function (bk) {
            var row = sdk.el('div', 'dt-row'); row.innerHTML = '<div class="dt-row-g">▣</div><div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(bk.name) + '</div></div>';
            var op = sdk.el('button', 'dt-btn sm', 'Open'); op.onclick = function (e) { e.stopPropagation(); openAccount(bk.id); }; row.appendChild(op); pad.appendChild(row);
          });
        });
      }
      function openAccount(bankId) {
        var L = LS(), bank = LG_BBY[bankId]; L.accounts = L.accounts || [];
        var count = L.accounts.filter(function (a) { return a.bankId === bankId && !a.closed; }).length;
        var acc = { id: lgUid(), bankId: bankId, name: bank.name + (count ? ' #' + (count + 1) : ''), balance: 0, inputs: [], loans: [], ledger: [], feeAccountId: null, deposits: [], holdings: [], policies: [], financing: [], escrows: [] };
        acc.feeAccountId = acc.id; L.accounts.push(acc); save(); sdk.notify('Opened ' + acc.name + '.'); state = acc.id; render();
      }
      function moveView(kind) {
        var titleMap = { transfer: 'Transfer', deposit: 'Deposit cash', withdraw: 'Withdraw cash' };
        panel(titleMap[kind], 'home');
        var acctOpts = accs().map(function (a) { return [a.id, a.name + ' (' + money(a.balance) + ')']; });
        if (!acctOpts.length) { pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Open an account first.')); return; }
        var fromSel, toSel;
        if (kind === 'transfer') { fromSel = selField('From', acctOpts); toSel = selField('To', acctOpts); if (win._from) fromSel.value = win._from; }
        else fromSel = selField(kind === 'withdraw' ? 'From account' : 'To account', acctOpts);
        var amt = field('Amount (eb)');
        var memo = (kind === 'transfer') ? (function () { pad.appendChild(sdk.el('div', 'dt-label', 'Memo (optional)')); var m = sdk.el('input', 'dt-field dt-selectable'); pad.appendChild(m); return m; })() : null;
        var go = sdk.el('button', 'dt-btn primary', titleMap[kind]); go.style.marginTop = '12px';
        go.onclick = function () {
          var v = parseFloat(amt.value) || 0; if (v <= 0) { sdk.notify('Enter an amount.'); return; }
          var L = LS();
          if (kind === 'transfer') {
            var from = accById(fromSel.value), to = accById(toSel.value);
            if (!from || !to || from === to) { sdk.notify('Pick two different accounts.'); return; }
            if (!canDebit(from, v)) { sdk.notify('Refused: exceeds the ' + tierOf(from).overdraft + 'eb overdraft.'); return; }
            from.balance = (parseFloat(from.balance) || 0) - v; to.balance = (parseFloat(to.balance) || 0) + v;
            push(from, 'xfer-out', 'To ' + to.name + (memo.value ? ' — ' + memo.value : ''), v); push(to, 'xfer-in', 'From ' + from.name + (memo.value ? ' — ' + memo.value : ''), v);
          } else if (kind === 'deposit') {
            if ((parseFloat(L.cash) || 0) < v) { sdk.notify('Not enough cash.'); return; }
            var d = accById(fromSel.value); L.cash = (parseFloat(L.cash) || 0) - v; d.balance = (parseFloat(d.balance) || 0) + v; push(d, 'deposit', 'Cash deposit', v);
          } else {
            var w = accById(fromSel.value); if (!canDebit(w, v)) { sdk.notify('Refused: exceeds overdraft.'); return; }
            w.balance = (parseFloat(w.balance) || 0) - v; L.cash = (parseFloat(L.cash) || 0) + v; push(w, 'withdraw', 'Cash withdrawal', v);
          }
          save(); sdk.notify(titleMap[kind] + ' done.'); win._from = null; state = 'home'; render();
        };
        pad.appendChild(go);
      }
      render();
    }
  });

  /* ═══════════════ DeadDrop — covert gig & deal board (never on a corpo OS) ═══════════════ */
  var GIGS = [
    { title: 'Courier run — Northside to City Center', fixer: 'Nix', pay: 1200, heat: 'low' },
    { title: 'Bodyguard, one night, no questions', fixer: 'Rogue', pay: 3500, heat: 'med' },
    { title: 'Retrieve a package from a dead man', fixer: 'anon', pay: 5000, heat: 'high' },
    { title: 'Scare a landlord. Don’t kill him.', fixer: 'Padre', pay: 800, heat: 'low' }
  ];
  var DEALS = [
    { item: 'Militech Ronin (hot)', price: 900, seller: 'trunk_guy' }, { item: 'Kiroshi Mk.1 optics, used', price: 400, seller: 'ripper_lu' },
    { item: 'Fake SIN, decent', price: 2500, seller: '—' }, { item: 'Case of synth-coffee', price: 60, seller: 'nomad_ez' }
  ];
  D.registerApp({
    id: 'deaddrop', name: 'DeadDrop', glyph: '⧗', seed: false, os: ['*'], street: true, pin: false,
    category: 'net', vendor: 'the street', desc: 'Gigs and deals, under the counter.',
    win: { w: 600, h: 480, minW: 380, minH: 300 },
    onOpen: function (win, sdk) {
      var Store = window.Store, tab = 'gigs', pad, gm = !sdk.isPlayer, formMode = null;
      // The board's shop exists by DEFAULT (created on first GM open, even empty).
      if (gm && hasCampaign()) Store.index('shop', true).then(function (rows) { if (!rows.some(function (r) { return (r.json.kind || '').toLowerCase() === 'deaddrop'; })) shopCreate({ name: 'DeadDrop', kind: 'deaddrop', items: [], notes: 'the board', props: { public: true } }); });
      function frame() { win.body.innerHTML = ''; var bar = sdk.el('div', 'dt-tabbar'); [['gigs', 'Gigs'], ['deals', 'Deals']].forEach(function (t) { var b = sdk.el('button', 'dt-btn sm' + (tab === t[0] ? ' primary' : ' ghost'), t[1]); b.onclick = function () { tab = t[0]; render(); }; bar.appendChild(b); }); win.body.appendChild(bar); pad = sdk.el('div', 'dt-list dt-scroll-y'); win.body.appendChild(pad); }
      function render() {
        if (formMode === 'gig') return dtForm(win, sdk, { title: 'New gig', back: function () { formMode = null; render(); }, fields: [{ key: 'title', label: 'Title' }, { key: 'fixer', label: 'Fixer', val: 'anon' }, { key: 'pay', label: 'Pay (eb)', type: 'number' }, { key: 'heat', label: 'Heat (low/med/high)', val: 'low' }], submit: 'Post', onSubmit: function (v) { if (!v.title) { sdk.notify('Give it a title.'); return; } App.uiSet('deaddrop.gigs', gigStore().concat([{ id: 'g' + Date.now(), title: v.title, fixer: v.fixer || 'anon', pay: v.pay === '' ? '' : (parseFloat(v.pay) || v.pay), heat: v.heat || 'low' }])); formMode = null; render(); } });
        if (formMode === 'deal') return dtForm(win, sdk, { title: 'New deal', back: function () { formMode = null; render(); }, fields: [{ key: 'item', label: 'Item' }, { key: 'price', label: 'Price (eb)', type: 'number', val: '0' }, { key: 'seller', label: 'Seller (optional)' }], submit: 'Post', onSubmit: function (v) { if (!v.item) { sdk.notify('Name the item.'); return; } var it = { id: 'it' + Date.now(), cat: '', name: v.item, price: parseFloat(v.price) || 0, seller: v.seller || '', qty: 1 }; Store.index('shop', true).then(function (rows) { var s = rows.filter(function (r) { return (r.json.kind || '').toLowerCase() === 'deaddrop'; })[0]; if (s) { s.json.items = s.json.items || []; s.json.items.push(it); shopSave(s.json, function () { formMode = null; render(); }); } else shopCreate({ name: 'DeadDrop', kind: 'deaddrop', items: [it], notes: 'the board', props: { public: true } }, function () { formMode = null; render(); }); }); } });
        frame(); if (tab === 'gigs') gigs(); else deals();
      }
      function gigStore() { return (App.uiGet && App.uiGet('deaddrop.gigs', [])) || []; }
      function gigRow(title, sub, pay, onRemove, tag) {
        var row = sdk.el('div', 'dt-row'); row.innerHTML = '<div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(title) + (tag ? ' <span class="dt-tag">' + tag + '</span>' : '') + '</div><div class="dt-row-s">' + sdk.esc(sub) + '</div></div><div class="dt-ledger-bal">' + (typeof pay === 'number' ? money(pay) : sdk.esc(pay || '')) + '</div>';
        if (sdk.isPlayer) { var t = sdk.el('button', 'dt-btn sm', 'Take'); t.onclick = function (e) { e.stopPropagation(); sdk.notify('You put your name in for “' + title + '.”'); }; row.appendChild(t); }
        if (onRemove) { var rm = sdk.el('button', 'dt-iconbtn x', '✕'); rm.onclick = function (e) { e.stopPropagation(); onRemove(); }; row.appendChild(rm); } pad.appendChild(row);
      }
      function gigs() {
        if (gm) { var add = sdk.el('button', 'dt-btn sm', '＋ Add gig'); add.style.margin = '8px 12px'; add.onclick = function () { formMode = 'gig'; render(); }; pad.appendChild(add); }
        var authored = gigStore(), any = authored.length;
        authored.forEach(function (g) { gigRow(g.title, [g.fixer, g.heat ? 'heat ' + g.heat : ''].filter(Boolean).join(' · '), g.pay, gm ? function () { App.uiSet('deaddrop.gigs', gigStore().filter(function (x) { return x.id !== g.id; })); render(); } : null); });
        if (hasCampaign()) Store.index('org').then(function (rows) {
          if (!document.contains(pad)) return;
          rows.forEach(function (r) { var o = r.json; if (sdk.isPlayer && !Store.visibleToPlayers(o)) return; ((o.jobs && o.jobs.openings) || []).filter(function (j) { return !j.isPrivate; }).forEach(function (j) { any = true; gigRow(j.title || 'Job', [o.name, j.risk ? 'risk ' + j.risk : '', j.location || ''].filter(Boolean).join(' · '), j.pay ? (parseFloat(j.pay) || j.pay) : (j.salary || ''), null, 'org'); }); });
          if (!any) pad.appendChild(sdk.el('div', 'dt-empty', gm ? 'No gigs. Add one, or post openings on your orgs.' : 'Board’s quiet tonight.'));
        }); else if (!any) pad.appendChild(sdk.el('div', 'dt-empty', gm ? 'No gigs yet — add one.' : 'Board’s quiet tonight.'));
      }
      function dealRow(item, price, seller, onRemove) {
        var row = sdk.el('div', 'dt-row'); row.innerHTML = '<div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(item) + '</div><div class="dt-row-s">seller: ' + sdk.esc(seller) + '</div></div><div class="dt-ledger-bal">' + money(price) + '</div>';
        if (sdk.isPlayer) { var b = sdk.el('button', 'dt-btn sm', 'Enquire'); b.onclick = function (e) { e.stopPropagation(); sdk.notify('Meet set. Bring cash. Come alone.'); }; row.appendChild(b); }
        if (onRemove) { var rm = sdk.el('button', 'dt-iconbtn x', '✕'); rm.onclick = function (e) { e.stopPropagation(); onRemove(); }; row.appendChild(rm); } pad.appendChild(row);
      }
      function deals() {
        if (!hasCampaign()) { DEALS.forEach(function (d) { dealRow(d.item, d.price, d.seller); }); return; }
        if (gm) { var add = sdk.el('button', 'dt-btn sm', '＋ Add deal'); add.style.margin = '8px 12px'; add.onclick = function () { formMode = 'deal'; render(); }; pad.appendChild(add); }
        Store.index('shop', true).then(function (rows) {
          if (!document.contains(pad)) return;
          var shop = rows.filter(function (r) { return (r.json.kind || '').toLowerCase() === 'deaddrop'; })[0];
          if (!shop) { if (sdk.isPlayer) DEALS.forEach(function (d) { dealRow(d.item, d.price, d.seller); }); else pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'The board’s shop is being created…')); return; }
          var j = shop.json; if (sdk.isPlayer && !Store.visibleToPlayers(j)) { pad.appendChild(sdk.el('div', 'dt-empty', 'Nothing on offer.')); return; }
          (j.items || []).forEach(function (it) { dealRow(it.name, it.price, it.seller || j.name || 'seller', gm ? function () { j.items = (j.items || []).filter(function (x) { return x !== it; }); shopSave(j, render); } : null); });
          if (!(j.items || []).length) pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'No deals listed' + (gm ? ' — add one.' : '.')));
        });
      }
      render();
    }
  });

  /* ═══════════════ Feed — screamsheet / news (ad-heavy on ad OSes) ═══════════════ */
  var NEWS = [
    { h: 'NETWATCH DECLARES “WAR ON RABID CODE”', s: 'Officials promise a “clean net.” Runners promise otherwise.' },
    { h: 'D-DANCE CURES CANCER, SAYS SPONSOR', s: 'Study funded by braindance conglomerate. Read the fine print.' },
    { h: 'ARASAKA-MILITECH TENSIONS RISE IN NIGHT CITY', s: 'Two corps, one city, no rules. Traffic advisory issued.' },
    { h: 'THE DEATH OF PRINT AND THE BIRTH OF THE SCREAMSHEET', s: 'A retrospective nobody asked for.' },
    { h: 'TRAUMA TEAM RESPONSE TIMES “BEST FOR PLATINUM MEMBERS”', s: 'Bronze members advised to “try not to get shot.”' }
  ];
  D.registerApp({
    id: 'feed', name: 'Feed', glyph: '☰', seed: true, os: ['*'],
    category: 'media', vendor: 'MediaNet', desc: 'Screamsheets and the day’s noise.',
    win: { w: 560, h: 500, minW: 360, minH: 300 },
    onOpen: function (win, sdk) {
      var b = win.body, pad = sdk.el('div', 'dt-scroll-y'); pad.style.height = '100%';
      var head = sdk.el('div', 'dt-pad'); head.appendChild(h1(sdk, sdk.os && sdk.os.ads ? 'NÜ Feed' : 'The Feed')); pad.appendChild(head);
      var ads = sdk.os && sdk.os.ads;
      NEWS.forEach(function (n, i) {
        var art = sdk.el('div', 'dt-feed-art'); art.innerHTML = '<div class="dt-feed-h">' + sdk.esc(n.h) + '</div><div class="dt-feed-s">' + sdk.esc(n.s) + '</div>';
        pad.appendChild(art);
        if (ads && i % 2 === 1) { var ad = sdk.el('div', 'dt-feed-ad'); ad.innerHTML = '<img src="img/ads/japanese-rpg.gif" alt="ad" onerror="this.style.display=\'none\'"><span>sponsored</span>'; pad.appendChild(ad); }
      });
      b.appendChild(pad);
    }
  });

  /* ═══════════════ RipperNet — clinics & chrome ═══════════════ */
  var CHROME = [
    { name: 'Kiroshi Optics Mk.2', price: 1000, hc: 3 }, { name: 'Subdermal Armor', price: 1000, hc: 3 },
    { name: 'Reflex Boosters', price: 5000, hc: 5 }, { name: 'Cyberaudio Suite', price: 500, hc: 2 }
  ];
  var RIP_SEED = [
    { name: 'Vik’s', loc: 'Japantown', note: 'trusted · cash only', items: [{ name: 'Kiroshi Optics Mk.2', price: 1000, hc: 3 }, { name: 'Cyberaudio Suite', price: 500, hc: 2 }] },
    { name: 'Dr. Chrome', loc: 'Little China', note: 'cheap · questionable', items: [{ name: 'Subdermal Armor', price: 1000, hc: 3 }, { name: 'Reflex Boosters', price: 5000, hc: 5 }] },
    { name: 'Arasaka MedCenter', loc: 'Corp. Center', note: 'corpo · pricey · logged', items: CHROME }
  ];
  function shopLoc(j) { return (j.props && (j.props.location || j.props.district)) || j.location || j.district || ''; }
  D.registerApp({
    id: 'ripper', name: 'RipperNet', glyph: '✚', seed: false, os: ['*'],
    category: 'utility', vendor: 'medtech', desc: 'Ripperdocs & chrome — authored by the GM.',
    win: { w: 600, h: 520, minW: 380, minH: 320 },
    onOpen: function (win, sdk) {
      var Store = window.Store, state = 'list', pad, gm = !sdk.isPlayer;
      function frame(title, back) { win.body.innerHTML = ''; pad = sdk.el('div', 'dt-pad dt-scroll-y'); if (back != null) { var b = sdk.el('button', 'dt-btn sm ghost', '‹ Back'); b.onclick = function () { state = back; render(); }; pad.appendChild(b); } pad.appendChild(h1(sdk, title)); win.body.appendChild(pad); }
      function render() {
        if (state && state.form === 'ripper') return formRipper();
        if (state && state.form === 'chrome') return formChrome(state.ripper);
        if (state && state.buy) return buyPanel(state);
        if (state && state.ripper) return ripperView(state.ripper);
        return list();
      }
      function loadRippers(cb) {
        if (!hasCampaign()) return cb(null);
        Promise.all([Store.index('shop', true).catch(function () { return []; }), Store.index('location', true).catch(function () { return []; }), new Promise(function (res) { mapPlaces(res); })]).then(function (res) {
          var rippers = [];
          res[0].forEach(function (r) { var j = r.json, k = (j.kind || '').toLowerCase(); if (/rip|chrome|cyber|clinic|med/.test(k) || (j.items || []).some(function (it) { return /cyber/.test((it.cat || '').toLowerCase()); })) rippers.push({ kind: 'shop', name: j.name || 'Clinic', contact: j.contact || (j.props && j.props.contact) || '', loc: shopLoc(j), items: j.items || [], json: j, pub: Store.visibleToPlayers(j) }); });
          function loose(name, type, district, pub) { if (/rip|clinic/.test((type || '').toLowerCase()) && !rippers.some(function (x) { return x.name === (name || ''); })) rippers.push({ kind: 'map', name: name || 'Ripperdoc', contact: '', loc: district || '', items: [], json: null, pub: !!pub }); }
          res[1].forEach(function (r) { loose(r.json.name, r.json.type, r.json.district, Store.visibleToPlayers(r.json)); });   // DATA locations
          res[2].forEach(function (p) { loose(p.name, p.type, p.district, p.public); });                                        // map places
          cb(rippers);
        });
      }
      function list() {
        frame('RipperNet');
        if (gm) { var add = sdk.el('button', 'dt-btn', '＋ New ripperdoc'); add.onclick = function () { state = { form: 'ripper' }; render(); }; pad.appendChild(add); }
        var holder = sdk.el('div'); pad.appendChild(holder); holder.appendChild(sdk.el('div', 'dt-p dt-muted', 'loading…'));
        loadRippers(function (rippers) {
          if (!document.contains(holder)) return; holder.innerHTML = '';
          if (rippers === null) { RIP_SEED.forEach(function (s) { shelfRow(holder, { name: s.name, loc: s.loc, contact: s.note, items: s.items }); }); return; }
          var vis = gm ? rippers : rippers.filter(function (x) { return x.pub; });
          if (!vis.length) { holder.appendChild(sdk.el('div', 'dt-empty', gm ? 'No ripperdocs yet. Add one — or log a “Ripperdoc/Clinic” on the Night City map.' : 'No ripperdocs on your grid.')); return; }
          vis.forEach(function (rp) { shelfRow(holder, rp); });
        });
      }
      function shelfRow(holder, rp) {
        var row = sdk.el('div', 'dt-row');
        row.innerHTML = '<div class="dt-row-g">✚</div><div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(rp.name) + (gm && rp.pub === false ? ' <span class="dt-tag">hidden</span>' : '') + (rp.kind === 'map' ? ' <span class="dt-tag">map</span>' : '') + '</div><div class="dt-row-s">' + sdk.esc([rp.loc, rp.contact].filter(Boolean).join(' · ') || (rp.kind === 'map' ? 'from the map' : '')) + '</div></div>';
        row.onclick = function () { state = { ripper: rp }; render(); }; holder.appendChild(row);
      }
      function ripperView(rp) {
        frame(rp.name, 'list');
        var sub = [rp.loc, rp.contact].filter(Boolean).join(' · '); if (sub) pad.appendChild(sdk.el('div', 'dt-p dt-muted', sub));
        var book = sdk.el('button', 'dt-btn', 'Book an appointment'); book.onclick = function () { sdk.notify('Appointment requested at ' + rp.name + '.'); }; pad.appendChild(book);
        pad.appendChild(sdk.el('div', 'dt-h2', 'Chrome'));
        if (gm && rp.kind === 'shop') { var ac = sdk.el('button', 'dt-btn sm', '＋ Add chrome'); ac.onclick = function () { state = { form: 'chrome', ripper: rp }; render(); }; pad.appendChild(ac); }
        if (gm && rp.kind !== 'shop') { var mk = sdk.el('button', 'dt-btn sm', '＋ Give this clinic a shop'); mk.onclick = function () { shopFromLoc(rp); }; pad.appendChild(mk); pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'This ripperdoc came from the map — create a shop for it to list chrome.')); }
        (rp.items || []).forEach(function (it) {
          var r = sdk.el('div', 'dt-row'); r.innerHTML = '<div class="dt-row-g">◈</div><div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(it.name || 'implant') + '</div><div class="dt-row-s">' + (it.hc != null && it.hc !== '' ? 'HC ' + it.hc : (it.cat || 'chrome')) + '</div></div><div class="dt-ledger-bal">' + money(it.price) + '</div>';
          if (sdk.isPlayer) { var buy = sdk.el('button', 'dt-btn sm', 'Buy'); buy.onclick = function (e) { e.stopPropagation(); state = { buy: it, ripper: rp }; render(); }; r.appendChild(buy); }
          else if (rp.kind === 'shop') { var rm = sdk.el('button', 'dt-iconbtn x', '✕'); rm.onclick = function (e) { e.stopPropagation(); rp.json.items = (rp.json.items || []).filter(function (x) { return x !== it; }); rp.items = rp.json.items; shopSave(rp.json, function () { state = { ripper: rp }; render(); }); }; r.appendChild(rm); }
          pad.appendChild(r);
        });
        if (!(rp.items || []).length && !(gm && rp.kind !== 'shop')) pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'No chrome listed.' + (gm ? ' Add some above.' : '')));
      }
      function buyPanel(st) {
        frame('Buy — ' + (st.buy.name || 'chrome'), { ripper: st.ripper });
        var head = sdk.el('div', 'dt-ledger-total'); head.innerHTML = '<span class="dt-ledger-lbl">' + (st.buy.hc != null && st.buy.hc !== '' ? 'HC ' + st.buy.hc : 'chrome') + '</span><span class="dt-ledger-big">' + money(st.buy.price) + '</span>'; pad.appendChild(head);
        pad.appendChild(sdk.el('div', 'dt-label', 'Pay from'));
        var sel = sdk.el('select', 'dt-field'); paySources(sdk).forEach(function (o) { var e = sdk.el('option'); e.value = o[0]; e.textContent = o[1]; sel.appendChild(e); }); pad.appendChild(sel);
        var go = sdk.el('button', 'dt-btn primary', 'Buy & book install'); go.style.marginTop = '12px';
        go.onclick = function () {
          var cost = parseFloat(st.buy.price) || 0;
          if (!chargeSource(sdk, sel.value, cost, 'Chrome: ' + (st.buy.name || ''))) { sdk.notify('Not enough on that source.'); return; }
          var j = sdk.sheet && sdk.sheet(); if (j) { j.cyberware = j.cyberware || []; j.cyberware.push({ name: st.buy.name, type: st.buy.cat || 'Cyberware', hc: parseFloat(st.buy.hc) || 0, data: st.buy.data || {}, installed: false, _boughtAt: st.ripper.name }); publishSheet(sdk, j); }
          sdk.notify(st.buy.name + ' bought — on your sheet; install at ' + st.ripper.name + '.'); state = { ripper: st.ripper }; render();
        };
        pad.appendChild(go);
      }
      function formRipper() { dtForm(win, sdk, { title: 'New ripperdoc', back: function () { state = 'list'; render(); }, fields: [{ key: 'name', label: 'Name', ph: 'e.g. Vik’s' }, { key: 'contact', label: 'Contact / handle (optional)' }], submit: 'Create', onSubmit: function (v) { if (!v.name) { sdk.notify('Give it a name.'); return; } shopCreate({ name: v.name, kind: 'ripperdoc', contact: v.contact || '', items: [], notes: '', props: { public: true } }, function () { state = 'list'; render(); }); } }); }
      function formChrome(rp) { dtForm(win, sdk, { title: 'Add chrome — ' + rp.name, back: function () { state = { ripper: rp }; render(); }, fields: [{ key: 'name', label: 'Chrome' }, { key: 'price', label: 'Price (eb)', type: 'number', val: '0' }, { key: 'hc', label: 'Humanity cost (optional)', type: 'number' }], submit: 'Add', onSubmit: function (v) { if (!v.name) { sdk.notify('Name the implant.'); return; } rp.json.items = rp.json.items || []; rp.json.items.push({ id: 'it' + Date.now(), cat: 'Cyberware', name: v.name, price: parseFloat(v.price) || 0, hc: v.hc === '' ? '' : (parseFloat(v.hc) || 0), qty: 1 }); rp.items = rp.json.items; shopSave(rp.json, function () { state = { ripper: rp }; render(); }); } }); }
      function shopFromLoc(rp) { shopCreate({ name: rp.name, kind: 'ripperdoc', contact: '', items: [], notes: 'clinic', props: { public: true, district: rp.loc } }, function () { state = 'list'; render(); }); }
      render();
    }
  });

  /* ═══════════════ Dispatch — rides & deliveries (tied to the sheet) ═══════════════ */
  D.registerApp({
    id: 'dispatch', name: 'Dispatch', glyph: '➤', seed: false, os: ['*'],
    category: 'utility', vendor: 'logistics', desc: 'Call a ride, track your deliveries.',
    win: { w: 540, h: 460, minW: 340, minH: 280 },
    onOpen: function (win, sdk) {
      var b = win.body, j = sdk.sheet && sdk.sheet();
      function paint() {
        b.innerHTML = ''; var pad = sdk.el('div', 'dt-pad dt-scroll-y');
        pad.appendChild(h1(sdk, 'Dispatch'));
        pad.appendChild(sdk.el('div', 'dt-h2', 'Call a ride'));
        [['Standard', 40], ['Armored', 200], ['Nomad convoy', 500]].forEach(function (r) {
          var row = sdk.el('div', 'dt-row'); row.innerHTML = '<div class="dt-row-g">➤</div><div class="dt-row-main"><div class="dt-row-t">' + r[0] + '</div><div class="dt-row-s">ETA ~' + (r[1] < 100 ? '8' : '15') + ' min</div></div><div class="dt-ledger-bal">' + money(r[1]) + '</div>';
          var call = sdk.el('button', 'dt-btn sm', 'Call'); call.onclick = function (e) { e.stopPropagation(); sdk.notify(r[0] + ' ride en route.'); }; row.appendChild(call); pad.appendChild(row);
        });
        pad.appendChild(sdk.el('div', 'dt-h2', 'Deliveries'));
        var dels = (j && j.net && j.net.deliveries) || [];
        if (!dels.length) pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'No deliveries in transit. Buy on the Net and track them here.'));
        dels.slice().reverse().forEach(function (d) {
          var row = sdk.el('div', 'dt-row'); row.style.cursor = 'default';
          row.innerHTML = '<div class="dt-row-main"><div class="dt-row-t">' + sdk.esc(d.name || 'package') + '</div><div class="dt-row-s">' + sdk.esc(d.status || 'in transit') + (d.status === 'in_transit' ? ' · ETA ' + d.eta + 'h' : '') + ' → ' + sdk.esc(d.address || '') + '</div></div>'; pad.appendChild(row);
        });
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Delivery & ride services are billed via Services on your character sheet.'));
        b.appendChild(pad);
      }
      paint();
    }
  });

  /* ═══════════════ Trauma — a rescue subscription (Services on the sheet) ═══════════════ */
  var TRAUMA_TIERS = [['Bronze', 200, 'best-effort · someday'], ['Silver', 500, 'priority · usually'], ['Platinum', 1500, 'AV in 6 minutes or your estate’s money back']];
  D.registerApp({
    id: 'trauma', name: 'Trauma', glyph: '✚', seed: false, os: ['*'],
    category: 'utility', vendor: 'Trauma Team', desc: 'Life insurance with a helipad.',
    win: { w: 500, h: 480, minW: 340, minH: 320 },
    onOpen: function (win, sdk) {
      function tier() { var j = sdk.sheet && sdk.sheet(); var s = ((j && j.lifestyle && j.lifestyle.services) || []).filter(function (x) { return x.trauma; })[0]; return s ? s.tier : null; }
      function subscribe(name, cost) {
        if (!sdk.isPlayer) { sdk.notify('GM preview: ' + name + ' active.'); return paint(); }
        var j = sdk.sheet(); if (!j) return; j.lifestyle = j.lifestyle || {}; j.lifestyle.services = (j.lifestyle.services || []).filter(function (x) { return !x.trauma; });
        j.lifestyle.services.push({ name: 'Trauma Team (' + name + ')', cost: cost, trauma: true, tier: name });
        publishSheet(sdk, j); sdk.notify('Trauma Team ' + name + ' active — ' + cost + 'eb/mo.'); paint();
      }
      function cancel() {
        if (!sdk.isPlayer) return paint();
        var j = sdk.sheet(); if (!j) return; if (j.lifestyle && j.lifestyle.services) j.lifestyle.services = j.lifestyle.services.filter(function (x) { return !x.trauma; });
        publishSheet(sdk, j); sdk.notify('Coverage cancelled. Try not to die.'); paint();
      }
      function paint() {
        var b = win.body; b.innerHTML = ''; var pad = sdk.el('div', 'dt-pad dt-scroll-y');
        pad.appendChild(h1(sdk, 'Trauma Team'));
        var cur = tier();
        if (cur) { var pan = sdk.el('button', 'dt-btn primary dt-trauma-panic', '✚ PANIC — call extraction'); pan.onclick = function () { sdk.notify('Trauma Team ' + cur + ' inbound. Hold position. Share your vitals.'); }; pad.appendChild(pan); pad.appendChild(sdk.el('div', 'dt-banner warn', '◉ Your live location & vitals are shared with Trauma Team while covered.')); }
        pad.appendChild(sdk.el('div', 'dt-h2', cur ? 'Your plan' : 'Choose a plan'));
        TRAUMA_TIERS.forEach(function (t) {
          var row = sdk.el('div', 'dt-row'); if (t[0] === cur) row.style.borderLeft = '3px solid var(--dt-accent)';
          row.innerHTML = '<div class="dt-row-main"><div class="dt-row-t">' + t[0] + (t[0] === cur ? ' — active' : '') + '</div><div class="dt-row-s">' + sdk.esc(t[2]) + '</div></div><div class="dt-ledger-bal">' + money(t[1]) + '/mo</div>';
          if (t[0] !== cur) { var sub = sdk.el('button', 'dt-btn sm', 'Subscribe'); sub.onclick = function (e) { e.stopPropagation(); subscribe(t[0], t[1]); }; row.appendChild(sub); }
          pad.appendChild(row);
        });
        if (cur) { var c = sdk.el('button', 'dt-btn ghost', 'Cancel coverage'); c.style.marginTop = '12px'; c.onclick = cancel; pad.appendChild(c); }
        pad.appendChild(sdk.el('div', 'dt-p dt-muted', 'Billed monthly via Services on your character sheet.'));
        b.appendChild(pad);
      }
      paint();
    }
  });

  /* ═══════════════ Sniffer — traffic monitor (street; flags you on corpo OS) ═══════════════ */
  var SNIFF_TARGETS = ['grid://nc/afterlife', 'grid://nc/aranet-messenger', 'grid://watson/hostly-io', 'grid://nc/blackice', 'a cellular handset nearby'];
  D.registerApp({
    id: 'sniffer', name: 'Sniffer', glyph: '≈', seed: false, os: ['*'], street: true,
    category: 'net', vendor: 'gnu-nc', desc: 'Watch the traffic. Tap a target.',
    win: { w: 600, h: 460, minW: 380, minH: 300 },
    onOpen: function (win, sdk) {
      var b = win.body, wrap = sdk.el('div', 'dt-vstack');
      var bar = sdk.el('div', 'dt-toolbar'); bar.appendChild(sdk.el('div', 'dt-row-s', 'live capture'));
      var sel = sdk.el('select', 'dt-field'); var o0 = sdk.el('option'); o0.value = ''; o0.textContent = 'tap a target…'; sel.appendChild(o0);
      SNIFF_TARGETS.forEach(function (t) { var o = sdk.el('option'); o.value = t; o.textContent = t; sel.appendChild(o); });
      bar.appendChild(sel);
      var out = sdk.el('div', 'dt-sniff-out dt-selectable dt-scroll-y');
      wrap.appendChild(bar); wrap.appendChild(out); b.appendChild(wrap);
      var IPS = ['12.4.9.1', '54.0.2.77', '198.51.7.3', '10.13.9.2', '41.0.0.7'], VERBS = ['GET', 'POST', 'SYN', 'ACK', 'PING'], PATHS = ['/home', '/board', '/dm', '/auth', '/pay', '/img/loc.png'];
      function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
      function line(s, cls) { var d = sdk.el('div', 'dt-sniff-line ' + (cls || '')); d.textContent = s; out.appendChild(d); while (out.childNodes.length > 200) out.removeChild(out.firstChild); out.scrollTop = out.scrollHeight; }
      line('# capturing… (street tool — on a corpo OS this would flag you)', 'muted');
      var iv = setInterval(function () { line(pick(IPS) + ' → ' + pick(IPS) + '  [' + pick(VERBS) + ']  ' + pick(PATHS) + '  ' + (40 + Math.floor(Math.random() * 900)) + 'b'); }, 500);
      win.on('close', function () { clearInterval(iv); });
      sel.onchange = function () {
        if (!sel.value) return; var t = sel.value;
        line('', ''); line('# TAP → ' + t, 'hi');
        ['auth handshake … creds seen (hashed)', 'DM: “you bring the thing or not?”', 'DM: “relax. tonight. usual drop.”', 'payment: 500eb → shell account', 'presence: 3 users, 1 idle'].forEach(function (m, i) { setTimeout(function () { line('  ' + t.split('/').pop() + ' » ' + m, 'tap'); }, 250 * (i + 1)); });
      };
    }
  });

})();
