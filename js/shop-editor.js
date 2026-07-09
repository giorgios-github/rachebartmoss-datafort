/* shop-editor.js — standalone Shop editor (cdoc-bridged).
   Evolves the old in-app renderShopGM: database palette (left) drag-dropped
   onto the shelf (right), with price/qty editing. Links & public live in the
   shell's band (registry/props), not here.
   Schema: { id, name, kind, url?, items:[{id,cat,name,price,qty,data}], notes, props }
   Roundtrip-safe: SHOP is the loaded object mutated in place. */
(function () {
  'use strict';
  var SHOP = { name: '', kind: 'storefront', url: '', items: [], notes: '', props: {} };
  var CATS = [
    ['weapons', 'Weapons', 'data/cp2020weapons.json'],
    ['cyberware', 'Cyberware', 'data/cyberware.json'],
    ['gear', 'Gear', 'data/cp2020gear.json'],
    ['vehicles', 'Vehicles', 'data/cp2020-vehicles.json'],
    ['decks', 'Cyberdecks', 'data/cp2020decks.json'],
    ['programs', 'Programs', 'data/cp2020programs.json'],
  ];
  var DB = {};

  function el(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function uid() { return 'si' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function price(r) { var v = r == null ? 0 : (r.cost != null ? r.cost : r.bookcost != null ? r.bookcost : r.bookPrice != null ? r.bookPrice : (r.type && r.type.cost != null ? r.type.cost : 0)); return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; }

  function dbLoad(cat) {
    if (DB[cat]) return Promise.resolve(DB[cat]);
    var def = CATS.filter(function (c) { return c[0] === cat; })[0];
    return fetch(def[2]).then(function (r) { return r.json(); })
      .then(function (j) { DB[cat] = Array.isArray(j) ? j : (j.items || []); return DB[cat]; })
      .catch(function () { DB[cat] = []; return []; });
  }

  /* palette */
  function paintPalette() {
    var cat = el('pal-cat').value;
    dbLoad(cat).then(function (rows) {
      var q = (el('pal-q').value || '').toLowerCase();
      var hits = rows.filter(function (r) { return !q || String(r.name || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 80);
      el('pal-list').innerHTML = hits.map(function (r, i) {
        return '<div class="pal-row" draggable="true" data-i="' + i + '">' + esc(r.name || '?') +
          '<small>' + esc(String(r.cost || '')) + '</small><button class="pal-add" data-add="' + i + '" title="Add">＋</button></div>';
      }).join('') || '<div class="shelf-empty">nothing</div>';
      el('pal-list').querySelectorAll('.pal-row').forEach(function (rowEl) {
        rowEl.ondragstart = function (e) {
          var r = hits[+rowEl.getAttribute('data-i')];
          e.dataTransfer.setData('text/plain', JSON.stringify({ cat: cat, name: r.name, data: r }));
        };
      });
      el('pal-list').querySelectorAll('[data-add]').forEach(function (b) {
        b.onclick = function () { addItem(cat, hits[+b.getAttribute('data-add')]); };
      });
    });
  }
  function addItem(cat, r) {
    SHOP.items.push({ id: uid(), cat: cat, name: r.name, price: price(r), qty: null, data: r });
    paintShelf(); poke();
  }

  /* shelf */
  function paintShelf() {
    var box = el('shelf');
    if (!SHOP.items.length) { box.innerHTML = '<div class="shelf-empty">Empty shelf — drag items from the catalog, or ＋.</div>'; }
    else {
      box.innerHTML = '<table class="shelf-t"><thead><tr><th>Item</th><th>Cat.</th><th>Price (eb)</th><th>Stock</th><th></th></tr></thead><tbody>' +
        SHOP.items.map(function (it) {
          return '<tr><td>' + esc(it.name) + '</td><td>' + esc(it.cat) + '</td>' +
            '<td><input class="cell" type="number" min="0" data-price="' + it.id + '" value="' + (it.price || 0) + '"></td>' +
            '<td><input class="cell" type="number" min="0" data-qty="' + it.id + '" value="' + (it.qty == null ? '' : it.qty) + '" placeholder="∞"></td>' +
            '<td><button class="rm" data-rm="' + it.id + '">✕</button></td></tr>';
        }).join('') + '</tbody></table>';
      box.querySelectorAll('[data-price]').forEach(function (i) { i.onchange = function () { item(i.getAttribute('data-price')).price = parseInt(i.value, 10) || 0; poke(); paintStats(); }; });
      box.querySelectorAll('[data-qty]').forEach(function (i) { i.onchange = function () { item(i.getAttribute('data-qty')).qty = i.value === '' ? null : (parseInt(i.value, 10) || 0); poke(); }; });
      box.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { SHOP.items = SHOP.items.filter(function (x) { return x.id !== b.getAttribute('data-rm'); }); paintShelf(); poke(); }; });
    }
    paintStats();
  }
  function item(id) { return SHOP.items.filter(function (x) { return x.id === id; })[0] || {}; }
  function paintStats() {
    el('st-n').textContent = SHOP.items.length;
    el('st-total').textContent = SHOP.items.reduce(function (a, it) { return a + (it.price || 0) * (it.qty == null ? 1 : it.qty); }, 0) + ' eb';
  }
  // Nudge the cdoc bridge (it listens to input/change/click, plus a 2s safety net).
  function poke() { try { document.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }

  function paint() {
    el('sh-name').value = SHOP.name || '';
    el('sh-kind').value = SHOP.kind || '';
    el('sh-url').value = SHOP.url || '';
    el('sh-notes').value = SHOP.notes || '';
    var dv = el('sh-delivery'); if (dv) dv.value = SHOP.deliveryTime == null ? '' : SHOP.deliveryTime;
    paintShelf();
  }

  function init() {
    el('pal-cat').innerHTML = CATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('');
    el('pal-cat').onchange = paintPalette;
    var t = null;
    el('pal-q').oninput = function () { clearTimeout(t); t = setTimeout(paintPalette, 180); };
    el('sh-name').oninput = function (e) { SHOP.name = e.target.value; };
    el('sh-kind').oninput = function (e) { SHOP.kind = e.target.value; };
    el('sh-url').oninput = function (e) { SHOP.url = e.target.value; };
    el('sh-notes').oninput = function (e) { SHOP.notes = e.target.value; };
    var shDv = el('sh-delivery'); if (shDv) shDv.oninput = function (e) { SHOP.deliveryTime = e.target.value === '' ? null : (parseInt(e.target.value, 10) || 0); };
    var shelf = el('shelf');
    shelf.ondragover = function (e) { e.preventDefault(); shelf.classList.add('over'); };
    shelf.ondragleave = function () { shelf.classList.remove('over'); };
    shelf.ondrop = function (e) {
      e.preventDefault(); shelf.classList.remove('over');
      try { var d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d && d.name) addItem(d.cat, d.data || { name: d.name }); } catch (err) {}
    };
    paintPalette(); paint();
    window.__cdocAdapter = {
      load: function (json) {
        if (json && typeof json === 'object') SHOP = json;
        if (!Array.isArray(SHOP.items)) SHOP.items = [];
        if (!SHOP.props || typeof SHOP.props !== 'object') SHOP.props = {};
        ['name', 'kind', 'url', 'notes'].forEach(function (k) { if (SHOP[k] == null) SHOP[k] = ''; });
        paint();
      },
      serialize: function () { return SHOP; },
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
