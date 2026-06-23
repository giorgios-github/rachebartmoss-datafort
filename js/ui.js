/* ui.js — shared UI helpers for the design system. The single modal system
   (window.UI.modal) replaces the app's ad-hoc .app-modal builders. Vanilla,
   no deps. Reuses the .ui-modal* classes from css/ui.css. */
(function () {
  'use strict';
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var UI = {
    _esc: null,
    // UI.modal({ title, body, actions:[{label, kind, onClick, dismiss}], size, onShow, dismissable })
    //  - kind: 'primary' | 'go' | 'danger' | (default ghost-ish)
    //  - onClick(box): return false to KEEP the modal open (e.g. validation failed)
    //  - size: 'wide' | 'dark'
    modal: function (opts) {
      opts = opts || {};
      UI.close();
      var ov = document.createElement('div');
      ov.id = 'ui-modal-ov'; ov.className = 'ui-modal-ov';
      var acts = (opts.actions || []).map(function (a, i) {
        var cls = 'ui-btn' + (a.kind === 'primary' ? ' ui-btn--primary' : a.kind === 'go' ? ' ui-btn--go' : a.kind === 'danger' ? ' ui-btn--danger' : '');
        return '<button class="' + cls + '" data-act="' + i + '">' + esc(a.label) + '</button>';
      }).join('');
      var size = opts.size === 'wide' ? ' ui-modal--wide' : opts.size === 'dark' ? ' ui-modal--dark' : '';
      ov.innerHTML = '<div class="ui-modal' + size + '">' +
        (opts.title ? '<div class="ui-modal-head">' + esc(opts.title) + '</div>' : '') +
        '<div class="ui-modal-body">' + (opts.body || '') + '</div>' +
        (acts ? '<div class="ui-modal-actions">' + acts + '</div>' : '') +
        '</div>';
      document.body.appendChild(ov);
      var box = ov.firstChild;
      (opts.actions || []).forEach(function (a, i) {
        var b = box.querySelector('[data-act="' + i + '"]');
        if (b) b.onclick = function () { var keep = a.onClick && a.onClick(box) === false; if (!keep && a.dismiss !== false) UI.close(); };
      });
      if (opts.dismissable !== false) {
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) UI.close(); });
        UI._esc = function (e) { if (e.key === 'Escape') UI.close(); };
        document.addEventListener('keydown', UI._esc);
      }
      if (opts.onShow) opts.onShow(box);
      return box;
    },
    close: function () {
      var ov = document.getElementById('ui-modal-ov');
      if (ov) ov.parentNode.removeChild(ov);
      if (UI._esc) { document.removeEventListener('keydown', UI._esc); UI._esc = null; }
    },
    esc: esc
  };
  window.UI = UI;
})();
