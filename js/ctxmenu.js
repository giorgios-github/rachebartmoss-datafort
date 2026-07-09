/* ctxmenu.js — a tiny, dependency-free right-click context menu, shared by the
   site, the character sheet and the desktop app. Terminal/datafort styling.

   window.CtxMenu.open(x, y, items)
     items: [ item | { sep:true } ]
     item:  { label, icon?, onClick?, submenu?:[items], disabled?, danger? }
   window.CtxMenu.attach(el, builder, opts?)
     builder(ev) -> items (or null to fall through to the native menu).
     opts.skipInputs (default true): right-clicking a field shows the NATIVE menu
     so copy/paste/spellcheck keep working. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var openEl = null;

  function close() {
    if (!openEl) return;
    if (openEl.parentNode) openEl.parentNode.removeChild(openEl);
    openEl = null;
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('scroll', close, true);
    window.removeEventListener('blur', close);
    window.removeEventListener('resize', close);
  }
  function onDoc(e) { if (openEl && !openEl.contains(e.target)) close(); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function render(items) {
    return items.map(function (it, i) {
      if (it.sep) return '<div class="ctxm-sep"></div>';
      var cls = 'ctxm-item' + (it.disabled ? ' is-dis' : '') + (it.danger ? ' is-danger' : '') + (it.submenu ? ' has-sub' : '');
      return '<button class="' + cls + '" type="button" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' +
        (it.icon ? '<span class="ctxm-ic">' + it.icon + '</span>' : '<span class="ctxm-ic"></span>') +
        '<span class="ctxm-l">' + esc(it.label) + '</span>' +
        (it.submenu ? '<span class="ctxm-arr">▸</span>' : '') +
        '</button>';
    }).join('');
  }

  function position(m, x, y) {
    var w = m.offsetWidth, h = m.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    if (x + w > vw - 6) x = Math.max(6, vw - w - 6);
    if (y + h > vh - 6) y = Math.max(6, vh - h - 6);
    m.style.left = x + 'px'; m.style.top = y + 'px';
  }

  function show(items, x, y, stack) {
    var m = document.createElement('div');
    m.className = 'ctxm';
    m.innerHTML = (stack && stack.length ? '<button class="ctxm-item ctxm-back" type="button" data-back="1"><span class="ctxm-ic">‹</span><span class="ctxm-l">Back</span></button><div class="ctxm-sep"></div>' : '') + render(items);
    if (openEl && openEl.parentNode) openEl.parentNode.removeChild(openEl);
    document.body.appendChild(m);
    openEl = m;
    position(m, x, y);
    m.querySelectorAll('[data-i]').forEach(function (b) {
      b.onclick = function () {
        var it = items[+b.getAttribute('data-i')];
        if (!it || it.disabled) return;
        if (it.submenu) { var sm = typeof it.submenu === 'function' ? it.submenu() : it.submenu; (stack = stack || []).push({ items: items, x: x, y: y }); show(sm, x, y, stack); return; }
        close();
        if (it.onClick) it.onClick();
      };
    });
    var back = m.querySelector('[data-back]');
    if (back) back.onclick = function () { var prev = stack.pop(); show(prev.items, prev.x, prev.y, stack); };
    setTimeout(function () {
      document.addEventListener('mousedown', onDoc, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('scroll', close, true);
      window.addEventListener('blur', close);
      window.addEventListener('resize', close);
    }, 0);
  }

  function open(x, y, items) {
    close();
    if (!items || !items.length) return;
    show(items, x, y, []);
  }

  function attach(el, builder, opts) {
    if (!el) return;
    opts = opts || {};
    var skipInputs = opts.skipInputs !== false;
    function fire(e, x, y) {
      if (skipInputs && e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      var items = builder(e);
      if (!items || !items.length) return;
      e.preventDefault();
      open(x, y, items);
    }
    el.addEventListener('contextmenu', function (e) { fire(e, e.clientX, e.clientY); });
    // Touch: long-press (500ms, no significant move) opens the same menu.
    var lpTimer = null, lpX = 0, lpY = 0;
    el.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0]; if (!t) return; lpX = t.clientX; lpY = t.clientY;
      lpTimer = setTimeout(function () { lpTimer = null; fire(e, lpX, lpY); }, 500);
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var t = e.touches && e.touches[0]; if (lpTimer && t && (Math.abs(t.clientX - lpX) > 10 || Math.abs(t.clientY - lpY) > 10)) { clearTimeout(lpTimer); lpTimer = null; }
    }, { passive: true });
    el.addEventListener('touchend', function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } });
  }

  window.CtxMenu = { open: open, attach: attach, close: close };
})();
