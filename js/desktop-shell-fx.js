/* desktop-shell-fx.js — OS-feel enhancements layered on top of the desktop kernel.
   ───────────────────────────────────────────────────────────────────────────
   Does NOT edit the kernel (js/app-desktop.js). It watches for mounted desktops
   and augments each running Env instance at runtime:
     • draggable desktop icons with per-OS persisted positions (localStorage)
     • a right-click context menu on the empty desktop
   It wraps the instance's own renderIcons() so icon layout survives every
   kernel re-render (install / uninstall / OS switch), and wraps switchOS() to
   enforce the PAID-OS paywall on the top-bar OS menu (players can't switch to a
   paid OS they don't own — buying happens on the character sheet). Public
   override hook: window.Desktop.onOSPurchase(id, cost, osDef).
   Pure, additive, defensive — NO kernel edit. */
(function () {
  'use strict';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── paid-OS paywall (players only). Ownership lives on the sheet
        (net.desktop.ownedOS) — the SHEET is where you buy an OS. ── */
  function br() { return (window.Shell && Shell.bridge && Shell.bridge()) || {}; }
  function isPlayer() { return !!(window.Desktop && Desktop.isPlayer && Desktop.isPlayer()); }
  function osDefOf(id) { try { return (window.Desktop && Desktop.osDef && Desktop.osDef(id)) || null; } catch (e) { return null; } }
  function osCost(id) { var o = osDefOf(id); return (o && (o.install || o.cost)) || 0; }
  function ownedOS() {
    var s = br().sess; if (!s || !s.sheetId || !s.camp) return [];
    var sid = br().idOf ? br().idOf(s.sheetId) : s.sheetId;
    var rec = s.camp.getSheet && s.camp.getSheet(sid);
    return (rec && rec.json && rec.json.net && rec.json.net.desktop && rec.json.net.desktop.ownedOS) || [];
  }
  function onPaidOS(id, cost) {
    var o = osDefOf(id), name = (o && o.name) || id;
    if (window.Desktop && typeof Desktop.onOSPurchase === 'function') { try { Desktop.onOSPurchase(id, cost, o); return; } catch (e) {} }
    if (window.UI && UI.modal) {
      UI.modal({ title: name + ' — ' + cost + 'eb', body: '<p class="dt-hint">' + name + ' is a paid one-time license. Install it from your character sheet, under <b>Computer &amp; Web</b>.</p>', actions: [{ label: 'Not now' }, { label: 'Open my sheet', kind: 'primary', onClick: function () { if (window.Shell && Shell.openSection) Shell.openSection('party'); } }] });
    } else if (window.Shell && Shell.openSection) { Shell.openSection('party'); }
  }

  /* NÜ Premium (ad-free) flag — read from the sheet (net.desktop.nuePro), GM = uiState */
  function isNuePro() {
    if (!isPlayer()) return !!(window.App && App.uiGet && (App.uiGet('desktop', {}) || {}).nuePro);
    var s = br().sess; if (!s || !s.sheetId || !s.camp) return false;
    var sid = br().idOf ? br().idOf(s.sheetId) : s.sheetId;
    var rec = s.camp.getSheet && s.camp.getSheet(sid);
    return !!(rec && rec.json && rec.json.net && rec.json.net.desktop && rec.json.net.desktop.nuePro);
  }
  // mounted envs, so a purchase can refresh furniture (ads) without a reboot.
  var ENVS = [];
  window.__dtRefreshFurniture = function () { ENVS.forEach(function (env) { if (env && env.root && document.contains(env.root)) { try { injectFurniture(env); } catch (e) {} } }); };

  /* ── per-OS icon position store ── */
  function keyFor(osid) { return 'bartmoss_dt_icons_' + (osid || 'x'); }
  function saved(osid) { try { return JSON.parse(localStorage.getItem(keyFor(osid)) || '{}'); } catch (e) { return {}; } }
  function saveOne(osid, k, x, y) { var m = saved(osid); m[k] = { x: x, y: y }; try { localStorage.setItem(keyFor(osid), JSON.stringify(m)); } catch (e) {} }
  function clearSaved(osid) { try { localStorage.removeItem(keyFor(osid)); } catch (e) {} }
  function iconKey(el) { var l = el.querySelector('.dt-icon-l'); return l ? l.textContent : (el.textContent || ''); }
  function osId(env) { try { var o = env.os && env.os(); return (o && o.id) || 'x'; } catch (e) { return 'x'; } }

  function layoutIcons(env) {
    var cont = env.iconsEl; if (!cont) return;
    cont.classList.add('dt-icons-free');
    var osid = osId(env), map = saved(osid);
    var kids = Array.prototype.slice.call(cont.querySelectorAll('.dt-icon'));
    var COLW = 94, ROWH = 96, PADX = 12, PADY = 12;
    var areaH = env.desktop ? (env.desktop.clientHeight || 500) : 500;
    var perCol = Math.max(1, Math.floor((areaH - PADY * 2) / ROWH));
    kids.forEach(function (el, i) {
      var k = iconKey(el), pos = map[k];
      if (!pos) { var col = Math.floor(i / perCol), r = i % perCol; pos = { x: PADX + col * COLW, y: PADY + r * ROWH }; }
      el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
      if (el._fxDrag) return; el._fxDrag = 1;
      el.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop, moved = false;
        var area = env.desktop.getBoundingClientRect();
        function mv(ev) {
          if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
          moved = true; el.classList.add('dt-icon-drag');
          el.style.left = clamp(ox + (ev.clientX - sx), 0, area.width - el.offsetWidth) + 'px';
          el.style.top = clamp(oy + (ev.clientY - sy), 0, area.height - el.offsetHeight) + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
          if (moved) { el.classList.remove('dt-icon-drag'); saveOne(osId(env), iconKey(el), el.offsetLeft, el.offsetTop); }
        }
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      });
    });
  }

  /* ── OS furniture: monitored banner / footer stamp / NO-LOGS stamp / ad strip.
        These ARE the mechanics made visible (surveillance, economy). ── */
  var FX_ADS = ['img/ads/200.webp', 'img/ads/200-2.webp', 'img/ads/japanese-rpg.gif', 'img/ads/jelly-beans-jelly-bean.webp'];
  function injectFurniture(env) {
    var d = env.desktop; if (!d) return;
    Array.prototype.forEach.call(d.querySelectorAll('.dt-fx-banner,.dt-fx-footer,.dt-fx-stamp,.dt-fx-ads,.dt-fx-verified,.dt-fx-blip,.dt-fx-watcher,.dt-fx-fault'), function (n) { n.remove(); });
    d.classList.remove('has-banner');
    var os = null; try { os = env.os && env.os(); } catch (e) {}
    if (!os) return;
    var f = os.furniture || {}, mech = os.mech || {}, pro = isNuePro();
    if (f.banner) {
      var b = document.createElement('div');
      if (f.gopro && pro) {                      // Premium: neutral "ad-free" badge
        b.className = 'dt-fx-banner'; b.textContent = '★ NÜ PREMIUM — ad-free';
        d.appendChild(b); d.classList.add('has-banner');
      } else if (f.gopro) {                      // free/ad-supported: a real GO PRO button
        b.className = 'dt-fx-banner warn';
        b.appendChild(document.createTextNode(f.banner + '  '));
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dt-fx-gopro'; btn.textContent = '★ Go Pro';
        btn.addEventListener('click', function (e) { e.stopPropagation(); try { env.openApp('nue-pro'); } catch (err) {} });
        b.appendChild(btn); d.appendChild(b); d.classList.add('has-banner');
      } else {
        b.className = 'dt-fx-banner ' + (mech.surveillance === 'logged' ? 'bad' : 'warn');
        b.textContent = f.banner; d.appendChild(b); d.classList.add('has-banner');
      }
    }
    if (f.stamp) { var s = document.createElement('div'); s.className = 'dt-fx-stamp'; s.textContent = f.stamp; d.appendChild(s); }
    if (f.footer) { var ft = document.createElement('div'); ft.className = 'dt-fx-footer'; ft.textContent = f.footer; d.appendChild(ft); }
    if (f.ads && !pro) {
      var pick = FX_ADS[(os.id || 'x').length % FX_ADS.length];
      var a = document.createElement('div'); a.className = 'dt-fx-ads';
      a.innerHTML = '<img src="' + pick + '" alt="ad"><div class="cap">ad · go pro to hide</div>';
      d.appendChild(a);
    }
    // KRAK'D tells: a slightly-wrong "verified" badge + a blip to an unknown host.
    if (f.verified) {
      var vb = document.createElement('div'); vb.className = 'dt-fx-verified'; vb.textContent = '✓ verified'; vb.title = 'certificate issued by: ???';
      vb.onclick = function () { try { env.notify('Certificate issued by: ??? — chain of trust: broken.'); } catch (e) {} };
      d.appendChild(vb);
      var blip = document.createElement('div'); blip.className = 'dt-fx-blip'; blip.textContent = '◍ sync → ' + ((os.hidden && os.hidden.host) || '41.0.0.7'); d.appendChild(blip);
    }
    // GM-only truth panel for OSes with hidden behaviour (KRAK'D honeypot).
    if (!isPlayer() && os.hidden) {
      var wp = document.createElement('div'); wp.className = 'dt-fx-watcher';
      wp.textContent = '⚠ WATCHER (GM): actually ' + (os.hidden.surveillance || 'watched') + ' by ' + (os.hidden.by || '???') + ' — players don’t see this';
      d.appendChild(wp);
    }
    // FLUX (unstable): a GM fault trigger.
    if (!isPlayer() && os.unstable) {
      var fbtn = document.createElement('button'); fbtn.className = 'dt-fx-fault'; fbtn.textContent = '⚡ fault';
      fbtn.onclick = function (e) { e.stopPropagation(); crashOverlay(env); }; d.appendChild(fbtn);
    }
    // RABID: the resident AI shows itself, unprompted, once.
    if (os.ai && !env._aiOpened) { env._aiOpened = 1; setTimeout(function () { try { env.openApp('r-console'); } catch (e) {} }, 500); }
  }
  function crashOverlay(env) {
    if (!env.root) return;
    var o = document.createElement('div'); o.className = 'dt-fx-crash';
    o.innerHTML = '<div class="dt-fx-crash-in">▚▞▚ SYSTEM FAULT ▚▞▚<br><span>FLUX hit an experimental problem.<br>Recovering… (this is normal)</span></div>';
    env.root.appendChild(o);
    setTimeout(function () { o.classList.add('gone'); setTimeout(function () { if (o.parentNode) o.remove(); }, 400); }, 2400);
  }

  /* ── desktop right-click menu ── */
  var _menu = null;
  function closeMenu() { if (_menu) { _menu.remove(); _menu = null; document.removeEventListener('mousedown', onDoc, true); } }
  function onDoc(e) { if (_menu && !e.target.closest('.dt-fx-menu')) closeMenu(); }
  function showMenu(env, cx, cy) {
    closeMenu();
    var root = env.root, rr = root.getBoundingClientRect();
    var m = document.createElement('div'); m.className = 'dt-menu dt-fx-menu';
    var items = [
      ['New note', function () { env.openApp('notes'); }],
      ['Clean up icons', function () { clearSaved(osId(env)); layoutIcons(env); }],
      ['Change wallpaper', function () { env.openApp('settings', { tab: 'wallpaper' }); }],
      ['Reboot', function () { env.reboot(); }]
    ];
    items.forEach(function (it) {
      var r = document.createElement('div'); r.className = 'dt-menu-item';
      r.innerHTML = '<span class="dt-menu-g">·</span><span>' + it[0] + '</span>';
      r.onclick = function () { closeMenu(); try { it[1](); } catch (e) {} };
      m.appendChild(r);
    });
    root.appendChild(m);
    var x = clamp(cx - rr.left, 4, Math.max(4, rr.width - m.offsetWidth - 8));
    var y = clamp(cy - rr.top, 4, Math.max(4, rr.height - m.offsetHeight - 8));
    m.style.left = x + 'px'; m.style.top = y + 'px';
    _menu = m;
    setTimeout(function () { document.addEventListener('mousedown', onDoc, true); }, 0);
  }

  /* ── enhance one Env ── */
  function enhance(root) {
    var host = root.parentElement, env = host && host._dtEnv;
    if (!env || env._fx) return; env._fx = 1; ENVS.push(env);
    if (typeof env.renderIcons === 'function') {
      var orig = env.renderIcons.bind(env);
      env.renderIcons = function () { orig(); injectFurniture(env); layoutIcons(env); };
    }
    // Fix the kernel's focus early-return: when the active window is closed the
    // kernel pre-sets `active` then calls focus(), which short-circuits and never
    // clears `dt-inactive` on the newly-active window (it stays greyed, even on
    // re-click). Always re-sync active/inactive classes + title after focus().
    if (typeof env.focus === 'function') {
      var origFocus = env.focus.bind(env);
      env.focus = function (win) {
        origFocus(win);
        if (win && win.el && env.wins) { env.wins.forEach(function (w) { if (w.el) w.el.classList.toggle('dt-inactive', w !== win); }); if (typeof env.syncTitle === 'function') try { env.syncTitle(); } catch (e) {} }
      };
    }
    // Paywall the top-bar OS switch: a player can't switch to a paid OS they
    // don't own — route them to the sheet to buy it. (GM sandbox switches free.)
    if (typeof env.switchOS === 'function') {
      var origSwitch = env.switchOS.bind(env);
      env.switchOS = function (id) {
        if (isPlayer()) { var c = osCost(id); if (c > 0 && ownedOS().indexOf(id) < 0) { onPaidOS(id, c); return; } }
        return origSwitch(id);
      };
    }
    if (env.desktop) env.desktop.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.dt-win') || e.target.closest('.dt-icon') || e.target.closest('.dt-menu')) return;
      e.preventDefault(); showMenu(env, e.clientX, e.clientY);
    });
    injectFurniture(env); layoutIcons(env);
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && node.classList.contains('dt-root')) enhance(node);
    if (node.querySelectorAll) Array.prototype.forEach.call(node.querySelectorAll('.dt-root'), enhance);
  }
  var mo = new MutationObserver(function (muts) { muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); }); });
  function start() { if (!document.body) return; mo.observe(document.body, { childList: true, subtree: true }); scan(document.body); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
