/* filmwindow.js — player-side reveal overlay, inspired by The Silver Case's
   "Film Window": framed image/text blocks on a dark veil with data bars, a
   header (clock · location tabs · chapter) and typed monospace text.

   Driven by the GM via the Yjs overview `reveal` field. The reveal is a
   composition of BLOCKS:
     reveal = { kind:'event', title, tabs:[], blocks:[ block ], ts }
     block  = { type:'image', src, cam, size:'s'|'m'|'l'|'xl'|'full', align:'left'|'center'|'right' }
            | { type:'text',  text, mode:'panel'|'dialogue', speaker, size, align }
   Legacy reveals ({preset,image,text,portrait} or {kind:'scene'|'handout'}) are
   converted to blocks so older content still renders. */
(function () {
  'use strict';
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var typers = [], current = null;

  function clockStr() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }
  function sizeOf(b) { var s = b && b.size; return (s === 's' || s === 'm' || s === 'l' || s === 'xl' || s === 'full') ? s : 'm'; }
  function alignOf(b) { var a = b && b.align; return (a === 'left' || a === 'right') ? a : 'center'; }

  /* ── Legacy reveal → blocks ── */
  function legacyToBlocks(d) {
    var p = d.preset, img = d.image, txt = d.text, por = d.portrait, out = [];
    if (Array.isArray(d.blocks) && d.blocks.length) return d.blocks;
    if (p === 'fullimage') { if (img) out.push({ type: 'image', src: img, size: 'full' }); }
    else if (p === 'call') {
      if (img) out.push({ type: 'image', src: img, cam: 'CAM 03 ● LIVE', size: 'l' });
      if (por) out.push({ type: 'image', src: por, cam: 'ID ● CALLER', size: 's' });
      if (txt) out.push({ type: 'text', text: txt, mode: 'dialogue', speaker: 'INCOMING CALL' });
    } else if (p === 'dossier') {
      if (por || img) out.push({ type: 'image', src: por || img, cam: 'ID ● FILE', size: 'l', align: 'left' });
      if (txt) out.push({ type: 'text', text: txt, mode: 'panel', size: 'l' });
    } else if (p === 'triptych') {
      if (img) out.push({ type: 'image', src: img, cam: 'CAM 02', size: 'l', align: 'right' });
      if (txt) out.push({ type: 'text', text: txt, mode: 'panel', size: 'm' });
      if (por) out.push({ type: 'image', src: por, cam: 'ID', size: 's', align: 'left' });
    } else if (p === 'textonly') {
      if (txt) out.push({ type: 'text', text: txt, mode: 'panel', size: 'xl' });
    } else { // imagetext / scene / handout
      if (img) out.push({ type: 'image', src: img, size: 'l' });
      if (txt) out.push({ type: 'text', text: txt, mode: img ? 'dialogue' : 'panel', size: 'l' });
    }
    return out;
  }

  /* ── Header ── */
  function header(data) {
    var tabs = (data.tabs && data.tabs.length ? data.tabs : ['// INCOMING'])
      .map(function (t) { return '<span class="fw-tab">' + esc(t) + '</span>'; }).join('');
    return '<div class="fw-top">' +
      '<div class="fw-clock">' + clockStr() + '</div>' +
      '<div class="fw-tabs">' + tabs + '</div>' +
      '<div class="fw-chapter">' + esc(data.title || 'TRANSMISSION') + '</div>' +
      '<button class="fw-x" id="fw-x" title="Dismiss (Esc)">✕</button></div>';
  }

  /* ── Block rendering ── */
  function imageBlock(b) {
    var cls = 'fw-block fw-block-img fw-sz-' + sizeOf(b) + ' fw-al-' + alignOf(b);
    return '<div class="' + cls + '"><span class="fw-cam">' + esc(b.cam || 'REC ● CAM') + '</span><span class="fw-rec"></span>' +
      '<img src="' + esc(b.src) + '" alt=""></div>';
  }
  function panelBlock(b) {
    return '<div class="fw-block fw-block-text fw-sz-' + sizeOf(b) + ' fw-al-' + alignOf(b) + '">' +
      (b.speaker ? '<div class="fw-speaker">' + esc(b.speaker) + '</div>' : '') +
      '<div class="fw-type" data-full="' + esc(b.text || '') + '"></div></div>';
  }
  function dialogueBlock(b) {
    return '<div class="fw-dialogue"><span class="fw-dlabel">▸ ' + esc(b.speaker || 'TRANSMISSION') + '</span>' +
      '<div class="fw-type" data-full="' + esc(b.text || '') + '"></div></div>';
  }

  function composeInner(data, anim) {
    var blocks = legacyToBlocks(data);
    var stage = [], dlg = [];
    blocks.forEach(function (b) {
      if (!b) return;
      if (b.type === 'image' && b.src) stage.push(imageBlock(b));
      else if (b.type === 'text' && b.text) { if (b.mode === 'dialogue') dlg.push(dialogueBlock(b)); else stage.push(panelBlock(b)); }
    });
    return '<div class="fw-bg"></div><div class="fw-scan"></div>' +
      '<div class="fw-page' + (anim ? ' fw-page-anim' : '') + '">' + header(data) +
        '<div class="fw-stage">' + stage.join('') + '</div>' +
        dlg.join('') +
      '</div>';
  }
  function build(data) {
    var ov = document.createElement('div'); ov.id = 'fw-ov'; ov.className = 'fw-ov';
    ov.innerHTML = composeInner(data, true);
    return ov;
  }
  // Inline, static, scaled preview (for the event editor). Text shown in full.
  function preview(host, data) {
    if (!host) return;
    if (!data) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="fw-prev">' + composeInner(data, false) + '</div>';
    Array.prototype.forEach.call(host.querySelectorAll('.fw-type'), function (t) { t.textContent = t.getAttribute('data-full') || ''; });
    var x = host.querySelector('.fw-x'); if (x) x.style.display = 'none';
  }

  function show(data) {
    if (!data) return;
    hide(true);
    current = data;
    var ov = build(data);
    document.body.appendChild(ov);
    document.getElementById('fw-x').onclick = function () { dismiss(); };
    // Type out every text block (panel + dialogue) in parallel, staggered.
    var els = ov.querySelectorAll('.fw-type'); typers = [];
    Array.prototype.forEach.call(els, function (t, k) {
      var full = t.getAttribute('data-full') || ''; t.textContent = '';
      var i = 0, startAt = Date.now() + k * 180;   // stagger so multiple panels feel alive
      var iv = setInterval(function () {
        if (Date.now() < startAt) return;
        i += 2; t.textContent = full.slice(0, i); if (i >= full.length) clearInterval(iv);
      }, 16);
      typers.push(iv);
    });
    removePill();
  }
  function hide(silent) {
    typers.forEach(function (iv) { clearInterval(iv); }); typers = [];
    var ov = document.getElementById('fw-ov'); if (ov) ov.parentNode.removeChild(ov);
    if (!silent) removePill();
  }
  function dismiss() { hide(true); showPill(); }
  function showPill() {
    if (document.getElementById('fw-pill') || !current) return;
    var b = document.createElement('button'); b.id = 'fw-pill'; b.className = 'fw-pill';
    b.textContent = '✉ MESSAGE';
    b.onclick = function () { show(current); };
    document.body.appendChild(b);
  }
  function removePill() { var p = document.getElementById('fw-pill'); if (p) p.parentNode.removeChild(p); }

  // Apply a reveal object from the overview map (auto-show on new ts; clear on null).
  var lastTs = 0;
  function apply(reveal) {
    if (reveal && reveal.ts && reveal.ts !== lastTs) { lastTs = reveal.ts; show(reveal); }
    else if (!reveal) { lastTs = 0; current = null; hide(false); }
  }

  // Esc closes.
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('fw-ov')) dismiss(); });

  window.FilmWindow = { show: show, hide: hide, dismiss: dismiss, apply: apply, preview: preview };
})();
