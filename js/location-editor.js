/* location-editor.js — standalone Location editor (cdoc-bridged).
   Schema: { id, name, district, type, mood, photo, desc, notes, coords?, props }
   Roundtrip-safe: LOC is the loaded object mutated in place — unknown fields
   (id, props, coords, source…) always survive serialize(). */
(function () {
  'use strict';
  var LOC = { name: '', district: '', type: '', mood: '', photo: '', desc: '', notes: '', props: {} };

  function el(id) { return document.getElementById(id); }

  function paintPhoto() {
    var img = el('loc-photo-img'), ph = el('loc-photo-ph'), clr = el('loc-photo-clear');
    if (LOC.photo) { img.src = LOC.photo; img.style.display = ''; ph.style.display = 'none'; clr.style.display = ''; }
    else { img.style.display = 'none'; ph.style.display = ''; clr.style.display = 'none'; }
  }
  function paint() {
    el('loc-name').value = LOC.name || '';
    el('loc-district').value = LOC.district || '';
    el('loc-type').value = LOC.type || '';
    el('loc-mood').value = LOC.mood || '';
    el('loc-desc').value = LOC.desc || '';
    el('loc-notes').value = LOC.notes || '';
    paintPhoto();
  }

  function bind() {
    el('loc-name').oninput = function (e) { LOC.name = e.target.value; };
    el('loc-district').oninput = function (e) { LOC.district = e.target.value; };
    el('loc-type').oninput = function (e) { LOC.type = e.target.value; };
    el('loc-mood').oninput = function (e) { LOC.mood = e.target.value; };
    el('loc-desc').oninput = function (e) { LOC.desc = e.target.value; };
    el('loc-notes').oninput = function (e) { LOC.notes = e.target.value; };
    el('loc-photo-input').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { LOC.photo = r.result; paintPhoto(); };
      r.readAsDataURL(f);
    };
    el('loc-photo-clear').onclick = function (e) { e.stopPropagation(); LOC.photo = ''; paintPhoto(); };
  }

  function init() {
    bind(); paint();
    window.__cdocAdapter = {
      load: function (json) {
        if (json && typeof json === 'object') LOC = json;
        if (!LOC.props || typeof LOC.props !== 'object') LOC.props = {};
        ['name', 'district', 'type', 'mood', 'photo', 'desc', 'notes'].forEach(function (k) { if (LOC[k] == null) LOC[k] = ''; });
        paint();
      },
      serialize: function () { return LOC; },
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
