/* reader.js — "L'Établi" sourcebook reader. Diegetic PDF reader: the book sits
   on a dark workbench, the table of contents is a tabbed spine, bookmarks are
   ribbons, a spiral notebook (global, per-book, can reference passages) sits to
   the right. Renders via pdf.js (js/vendor/pdf.min.js).

   window.SourcebookReader.mount(container, { books:[{id,title,url}] }) → { destroy() }
   Persistence (global, device-local):
     datafort_reader_<bookId> = { lastPage, bookmarks, night }
     datafort_reader_notes    = { [bookId]: [{ id, page, excerpt, text }] } */
(function () {
  'use strict';
  var PDF = window.pdfjsLib;
  if (PDF && PDF.GlobalWorkerOptions) PDF.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NOTES_KEY = 'datafort_reader_notes';
  function allNotes() { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAllNotes(o) { try { localStorage.setItem(NOTES_KEY, JSON.stringify(o)); } catch (e) {} }

  function mount(container, opts) {
    opts = opts || {};
    var books = opts.books || [];
    var st = { book: null, doc: null, page: 1, total: 0, outline: [], night: false, bookmarks: [], rendering: false, pending: null, selPage: null };

    container.innerHTML =
      '<div class="rdr"><div class="rdr-tabs" id="rdr-tabs"></div>' +
      '<div class="rdr-stage">' +
        '<nav class="rdr-spine" id="rdr-spine"></nav>' +
        '<div class="rdr-deskwrap" id="rdr-deskwrap">' +
          '<div class="rdr-ribbons" id="rdr-ribbons"></div>' +
          '<div class="rdr-book" id="rdr-book">' +
            '<div class="rdr-page rdr-page-l"><canvas id="rdr-cv-l"></canvas><div class="rdr-text" id="rdr-tx-l" data-side="l"></div></div>' +
            '<div class="rdr-bind"></div>' +
            '<div class="rdr-page rdr-page-r"><canvas id="rdr-cv-r"></canvas><div class="rdr-text" id="rdr-tx-r" data-side="r"></div><div class="rdr-curl"></div></div>' +
            '<button class="rdr-selnote" id="rdr-selnote" hidden>↳ note</button>' +
          '</div>' +
          '<div class="rdr-switch" id="rdr-switch" title="Day / night"><span class="rdr-sw-day">DAY</span><span class="rdr-sw-night">NIGHT</span></div>' +
        '</div>' +
        '<aside class="rdr-notebook"><div class="rdr-nb-head">NOTEBOOK<button class="rdr-nb-add" id="rdr-nb-add" title="Note this page">+ note</button></div>' +
          '<div class="rdr-nb-body" id="rdr-notes"></div></aside>' +
      '</div>' +
      '<div class="rdr-foot"><button class="rdr-fbtn" id="rdr-prev">‹</button>' +
        '<span class="rdr-foot-mid"><button class="rdr-bm" id="rdr-bm" title="Bookmark this page">▮ bookmark</button><span class="rdr-pageno" id="rdr-pageno">—</span></span>' +
        '<button class="rdr-fbtn" id="rdr-next">›</button></div>' +
      '<div class="rdr-empty" id="rdr-empty" hidden>No sourcebooks in the local books folder. Drop PDFs in it and reopen.</div>' +
      '</div>';
    var root = container.querySelector('.rdr');
    function el(id) { return container.querySelector('#' + id); }
    function showEmpty(msg) { var e = el('rdr-empty'); e.textContent = msg; e.hidden = false; }

    function bkey() { return 'datafort_reader_' + (st.book ? st.book.id : 'x'); }
    function saveState() { try { localStorage.setItem(bkey(), JSON.stringify({ lastPage: st.page, bookmarks: st.bookmarks, night: st.night })); } catch (e) {} }
    function loadState() { try { return JSON.parse(localStorage.getItem(bkey()) || '{}'); } catch (e) { return {}; } }
    function notes() { var a = allNotes(); return (st.book && a[st.book.id]) || []; }
    function setNotes(list) { var a = allNotes(); if (st.book) a[st.book.id] = list; saveAllNotes(a); }

    /* source tabs */
    function renderTabs() {
      el('rdr-tabs').innerHTML = books.map(function (b) {
        return '<button class="rdr-tab' + (st.book && st.book.id === b.id ? ' active' : '') + '" data-b="' + esc(b.id) + '">' + esc(b.title) + '</button>';
      }).join('');
      el('rdr-tabs').querySelectorAll('[data-b]').forEach(function (t) {
        t.onclick = function () { var b = books.filter(function (x) { return x.id === t.getAttribute('data-b'); })[0]; if (b) openBook(b); };
      });
    }

    function openBook(book) {
      if (!PDF) { showEmpty('PDF engine not loaded.'); return; }
      st.book = book; renderTabs();
      var s = loadState(); st.bookmarks = s.bookmarks || []; st.night = !!s.night;
      root.classList.toggle('night', st.night);
      el('rdr-empty').hidden = true;
      renderNotes();
      PDF.getDocument({ url: book.url }).promise.then(function (doc) {
        st.doc = doc; st.total = doc.numPages; st.page = spreadLeft(Math.min(Math.max(1, s.lastPage || 1), st.total));
        loadOutline(doc); renderRibbons(); renderSpread();
      }, function () { showEmpty('Could not open "' + book.title + '".'); });
    }

    /* table of contents (spine) */
    function loadOutline(doc) {
      el('rdr-spine').innerHTML = '';
      doc.getOutline().then(function (items) {
        if (!items || !items.length) { st.outline = []; return; }
        Promise.all(items.slice(0, 16).map(function (it) {
          return resolveDest(doc, it.dest).then(function (pg) { return { title: it.title, page: pg }; }, function () { return null; });
        })).then(function (res) { st.outline = res.filter(Boolean); renderSpine(); });
      }, function () {});
    }
    function resolveDest(doc, dest) {
      return Promise.resolve(typeof dest === 'string' ? doc.getDestination(dest) : dest).then(function (arr) {
        if (!arr || !arr[0]) throw 0;
        return doc.getPageIndex(arr[0]).then(function (idx) { return idx + 1; });
      });
    }
    function renderSpine() {
      el('rdr-spine').innerHTML = st.outline.map(function (o, i) {
        var label = (o.title || '').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '').trim().slice(0, 4).toUpperCase() || ('§' + (i + 1));
        return '<button class="rdr-stab" data-pg="' + o.page + '" title="' + esc(o.title) + '">' + esc(label) + '</button>';
      }).join('');
      el('rdr-spine').querySelectorAll('[data-pg]').forEach(function (b) { b.onclick = function () { goto(+b.getAttribute('data-pg')); }; });
    }

    /* bookmarks (ribbons) */
    function renderRibbons() {
      el('rdr-ribbons').innerHTML = (st.bookmarks || []).map(function (bm, i) {
        return '<button class="rdr-ribbon ' + (i % 2 ? 'gold' : 'red') + '" data-pg="' + bm.page + '" title="p.' + bm.page + '"><span>' + bm.page + '</span></button>';
      }).join('');
      el('rdr-ribbons').querySelectorAll('[data-pg]').forEach(function (b) { b.onclick = function () { goto(+b.getAttribute('data-pg')); }; });
    }

    /* render */
    function renderPageTo(canvas, txt, num, scale, dpr) {
      if (num < 1 || num > st.total) { canvas.width = canvas.height = 0; canvas.style.display = 'none'; canvas.parentNode.style.display = 'none'; if (txt) txt.innerHTML = ''; return Promise.resolve(); }
      canvas.style.display = 'block'; canvas.parentNode.style.display = 'flex';
      return st.doc.getPage(num).then(function (page) {
        var vp = page.getViewport({ scale: scale * dpr });
        canvas.width = vp.width; canvas.height = vp.height;
        var cssW = vp.width / dpr, cssH = vp.height / dpr;
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        canvas.parentNode.style.width = cssW + 'px'; canvas.parentNode.style.height = cssH + 'px';
        var p = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        if (txt) {
          txt.innerHTML = ''; txt.style.width = cssW + 'px'; txt.style.height = cssH + 'px'; txt.dataset.page = num;
          var tvp = page.getViewport({ scale: scale });
          page.getTextContent().then(function (tc) { try { PDF.renderTextLayer({ textContent: tc, container: txt, viewport: tvp, textDivs: [] }); } catch (e) {} });
        }
        return p;
      });
    }
    function renderSpread() {
      if (!st.doc) return;
      if (st.rendering) { st.pending = st.page; return; }
      st.rendering = true;
      // Offset by one: the cover (p.1) sits alone; the rest pair up (2-3, 4-5…).
      var leftNum = st.page === 1 ? 0 : st.page;        // 0 → no left page (cover)
      var rightNum = st.page === 1 ? 1 : st.page + 1;
      var scaleRef = rightNum <= st.total ? rightNum : (leftNum || 1);
      el('rdr-pageno').textContent = st.page === 1
        ? 'p.1 / ' + st.total
        : 'p.' + leftNum + (rightNum <= st.total ? '–' + rightNum : '') + ' / ' + st.total;
      var desk = el('rdr-deskwrap').getBoundingClientRect();
      st.doc.getPage(scaleRef).then(function (page) {
        var v1 = page.getViewport({ scale: 1 });
        var availH = desk.height - 56, availW = (desk.width - 60) / 2; // 2 pages + margins
        var scale = Math.max(0.1, Math.min(availW / v1.width, availH / v1.height));
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        Promise.all([
          renderPageTo(el('rdr-cv-l'), el('rdr-tx-l'), leftNum, scale, dpr),
          renderPageTo(el('rdr-cv-r'), el('rdr-tx-r'), rightNum, scale, dpr),
        ]).then(function () {
          st.rendering = false;
          if (st.pending != null && st.pending !== st.page) { st.pending = null; renderSpread(); } else st.pending = null;
          saveState();
        }, function () { st.rendering = false; });
      });
    }
    // st.page is the LEFT page of the spread (even), or 1 for the lone cover.
    function spreadLeft(p) { return p <= 1 ? 1 : p - (p % 2); }
    function goto(pg) { st.page = spreadLeft(Math.min(Math.max(1, pg), st.total)); hideSelNote(); renderSpread(); }
    function step(d) { goto(d > 0 ? (st.page === 1 ? 2 : st.page + 2) : (st.page <= 2 ? 1 : st.page - 2)); }

    /* notebook — page-anchored notes that reference passages */
    function renderNotes() {
      var list = notes();
      el('rdr-notes').innerHTML = list.length
        ? list.map(function (n) {
            return '<div class="rdr-note" data-id="' + esc(n.id) + '">' +
              (n.excerpt ? '<div class="rdr-note-ex">“' + esc(n.excerpt) + '”</div>' : '') +
              '<textarea class="rdr-note-t" data-id="' + esc(n.id) + '" placeholder="…">' + esc(n.text || '') + '</textarea>' +
              '<div class="rdr-note-foot"><button class="rdr-note-go" data-go="' + n.page + '">↳ p.' + n.page + '</button>' +
                '<button class="rdr-note-del" data-del="' + esc(n.id) + '">✕</button></div></div>';
          }).join('')
        : '<div class="rdr-nb-empty">No notes yet. Select text in the book, or use “+ note”.</div>';
      el('rdr-notes').querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { goto(+b.getAttribute('data-go')); }; });
      el('rdr-notes').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { setNotes(notes().filter(function (n) { return n.id !== b.getAttribute('data-del'); })); renderNotes(); }; });
      el('rdr-notes').querySelectorAll('.rdr-note-t').forEach(function (ta) {
        var t; ta.oninput = function () { clearTimeout(t); t = setTimeout(function () { var list = notes().map(function (n) { return n.id === ta.getAttribute('data-id') ? Object.assign({}, n, { text: ta.value }) : n; }); setNotes(list); }, 400); };
      });
    }
    function addNote(page, excerpt) {
      if (!st.book) return;
      var list = notes(); list.unshift({ id: 'n' + Date.now().toString(36), page: page || st.page, excerpt: excerpt || '', text: '' });
      setNotes(list); renderNotes();
    }

    /* text selection → "↳ note" */
    function hideSelNote() { el('rdr-selnote').hidden = true; st.selPage = null; st.selExcerpt = ''; }
    function onSelect() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { hideSelNote(); return; }
      var anc = sel.anchorNode; var layer = anc && (anc.nodeType === 1 ? anc : anc.parentNode);
      layer = layer && layer.closest && layer.closest('.rdr-text');
      if (!layer || !root.contains(layer)) { hideSelNote(); return; }
      st.selPage = +layer.dataset.page || st.page;
      st.selExcerpt = sel.toString().trim().slice(0, 160);
      var rect = sel.getRangeAt(0).getBoundingClientRect(), brect = el('rdr-book').getBoundingClientRect();
      var btn = el('rdr-selnote');
      btn.style.left = (rect.left - brect.left + rect.width / 2 - 24) + 'px';
      btn.style.top = (rect.top - brect.top - 30) + 'px';
      btn.hidden = false;
    }

    /* wiring */
    el('rdr-prev').onclick = function () { step(-1); };
    el('rdr-next').onclick = function () { step(1); };
    el('rdr-switch').onclick = function () { st.night = !st.night; root.classList.toggle('night', st.night); saveState(); };
    el('rdr-bm').onclick = function () {
      var p = st.page, has = st.bookmarks.some(function (b) { return b.page === p; });
      st.bookmarks = has ? st.bookmarks.filter(function (b) { return b.page !== p; }) : st.bookmarks.concat([{ page: p }]);
      st.bookmarks.sort(function (a, b) { return a.page - b.page; });
      renderRibbons(); saveState();
    };
    el('rdr-nb-add').onclick = function () { addNote(st.page, ''); };
    el('rdr-selnote').onclick = function () { addNote(st.selPage || st.page, st.selExcerpt || ''); hideSelNote(); var s = window.getSelection(); if (s) s.removeAllRanges(); };
    container.addEventListener('mouseup', function () { setTimeout(onSelect, 0); });
    function onKey(e) { if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; } if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); }
    document.addEventListener('keydown', onKey);
    var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(function () { if (st.doc) renderSpread(); }) : null;
    if (ro) ro.observe(el('rdr-deskwrap'));

    renderTabs();
    if (books.length) openBook(books[0]); else el('rdr-empty').hidden = false;
    return { destroy: function () { document.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); } };
  }

  window.SourcebookReader = { mount: mount };
})();
