/* role-picker.js — replaces the cs.html Role <input> with a card popup.
   The 9 base CP2020 roles get rich cards (portrait, blurb, signature ability,
   recommended attributes, career skills, salary). Every other role from
   data/cp2020rolesext.json appears in a searchable "more roles" drawer.
   Picking a role just sets #cs-role and fires its change event, so main.js's
   existing handler still auto-fills the Special Ability and flags career skills. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var BASE = ['Rockerboy', 'Solo', 'Netrunner', 'Techie', 'Media', 'Cop', 'Corporate', 'Fixer', 'Nomad'];
  // Authored: portrait file key, short blurb, recommended attributes (CP2020 has no fixed role stats).
  var CARD = {
    'Rockerboy':  { key: 'rockerboy',  attrs: ['COOL', 'EMP', 'ATT'],  blurb: 'Rebel musicians and street poets who sway crowds, spark riots and speak truth to power.' },
    'Solo':       { key: 'solo',       attrs: ['REF', 'BODY', 'COOL'], blurb: 'Hired guns, bodyguards and assassins — the deadliest operators on the Street.' },
    'Netrunner':  { key: 'netrunner',  attrs: ['INT', 'REF', 'TECH'],  blurb: 'Console cowboys who jack into the Net to crack ICE, steal data and own the grid.' },
    'Techie':     { key: 'techie',     attrs: ['TECH', 'INT'],         blurb: 'Gearheads who build, repair and jury-rig anything with moving parts or circuits.' },
    'Media':      { key: 'media',       attrs: ['INT', 'COOL', 'EMP'],  blurb: 'Reporters and broadcasters who chase the story and shape public opinion.' },
    'Cop':        { key: 'cop',        attrs: ['REF', 'INT', 'COOL'],  blurb: 'The badge-carrying law of Night City, from beat patrol to Psycho Squad.' },
    'Corporate':  { key: 'corporate',  attrs: ['INT', 'COOL'],         blurb: 'Suits who wield the money, assets and ruthless reach of the megacorps.' },
    'Fixer':      { key: 'fixer',      attrs: ['COOL', 'INT'],         blurb: 'Dealmakers and middlemen who can get you anything — for the right price.' },
    'Nomad':      { key: 'nomad',      attrs: ['REF', 'BODY', 'TECH'], blurb: 'Clan road-warriors bound by family, riding the highways in armed convoys.' }
  };

  function db() { return (window.DB && window.DB.roles) || []; }
  function roleByName(n) { var a = db(); for (var i = 0; i < a.length; i++) if (a[i].name === n) return a[i]; return null; }
  function flatSkills(r) { return ((r && r.skills) || []).map(function (s) { return Array.isArray(s) ? s.join(' / ') : s; }); }
  function salaryStr(r) { var s = r && r.salary; if (!s || !s.length) return '—'; var a = s[0], b = s[s.length - 1]; return (a === b ? a.toLocaleString() : a.toLocaleString() + '–' + b.toLocaleString()) + 'eb/mo'; }

  function pick(name) {
    var inp = document.getElementById('cs-role'); if (!inp) return;
    inp.value = name;
    inp.dispatchEvent(new Event('change', { bubbles: true }));   // → main.js fills SA + flags career skills
    close();
  }
  function close() { var ov = document.getElementById('rolepick-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }

  function baseCard(name) {
    var r = roleByName(name) || {}, c = CARD[name] || {}, sa = r.specialability || {};
    var img = 'img/roles/' + (c.key || name.toLowerCase()) + '.png';
    var skills = flatSkills(r);
    return '<button class="rp-card" data-role="' + esc(name) + '">' +
      '<span class="rp-card-ph">' + esc(name.charAt(0)) + '</span>' +
      '<img class="rp-card-img" src="' + esc(img) + '" alt="" onerror="this.remove()">' +
      '<span class="rp-card-grad"></span>' +
      '<span class="rp-card-info">' +
        '<span class="rp-card-name">' + esc(name) + '</span>' +
        '<span class="rp-card-sa">★ ' + esc(sa.name || '—') + (sa.stat ? ' · ' + esc(sa.stat) : '') + '</span>' +
        (c.attrs ? '<span class="rp-card-attrs">' + c.attrs.map(function (a) { return '<i>' + esc(a) + '</i>'; }).join('') + '</span>' : '') +
        '<span class="rp-card-blurb">' + esc(c.blurb || '') + '</span>' +
        '<span class="rp-card-meta">' + salaryStr(r) + '</span>' +
        (skills.length ? '<span class="rp-card-skills">' + skills.slice(0, 9).map(function (s) { return '<em>' + esc(s) + '</em>'; }).join('') + '</span>' : '') +
      '</span></button>';
  }
  function otherRow(r) {
    var sa = r.specialability || {};
    return '<button class="rp-row" data-role="' + esc(r.name) + '">' +
      '<span class="rp-row-name">' + esc(r.name) + '</span>' +
      '<span class="rp-row-sa">' + esc(sa.name || '') + '</span>' +
      '<span class="rp-row-sal">' + (r.salary && r.salary[0] ? r.salary[0].toLocaleString() + 'eb' : '') + '</span></button>';
  }

  function open() {
    if (!db().length) { return; }   // data not loaded yet
    close();
    var others = db().filter(function (r) { return BASE.indexOf(r.name) < 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var ov = document.createElement('div'); ov.id = 'rolepick-ov'; ov.className = 'rp-ov';
    ov.innerHTML = '<div class="rp-modal"><div class="rp-head">CHOOSE YOUR ROLE<button class="rp-x" id="rp-x" title="Close">✕</button></div>' +
      '<div class="rp-body">' +
        '<div class="rp-carousel">' +
          '<button class="rp-nav rp-nav-prev" id="rp-prev" aria-label="Previous">‹</button>' +
          '<div class="rp-track" id="rp-track">' + BASE.map(baseCard).join('') + '</div>' +
          '<button class="rp-nav rp-nav-next" id="rp-next" aria-label="Next">›</button>' +
        '</div>' +
        '<button class="rp-more" id="rp-more">▸ More roles (' + others.length + ')</button>' +
        '<div class="rp-others" id="rp-others" hidden>' +
          '<input class="rp-search" id="rp-search" placeholder="search every role…">' +
          '<div class="rp-others-list" id="rp-others-list">' + others.map(otherRow).join('') + '</div>' +
        '</div>' +
      '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.getElementById('rp-x').onclick = close;
    function wire(scope) { scope.querySelectorAll('[data-role]').forEach(function (b) { b.onclick = function () { pick(b.getAttribute('data-role')); }; }); }
    wire(ov);
    var track = document.getElementById('rp-track');
    function slide(dir) { if (track) track.scrollBy({ left: dir * Math.max(320, track.clientWidth * 0.8), behavior: 'smooth' }); }
    document.getElementById('rp-prev').onclick = function () { slide(-1); };
    document.getElementById('rp-next').onclick = function () { slide(1); };
    var more = document.getElementById('rp-more'), box = document.getElementById('rp-others');
    more.onclick = function () {
      if (box.hasAttribute('hidden')) { box.removeAttribute('hidden'); more.textContent = '▾ More roles (' + others.length + ')'; document.getElementById('rp-search').focus(); }
      else { box.setAttribute('hidden', ''); more.textContent = '▸ More roles (' + others.length + ')'; }
    };
    document.getElementById('rp-search').oninput = function () {
      var f = this.value.toLowerCase();
      var hits = others.filter(function (r) { return r.name.toLowerCase().indexOf(f) >= 0 || (r.specialability && (r.specialability.name || '').toLowerCase().indexOf(f) >= 0); });
      var list = document.getElementById('rp-others-list');
      list.innerHTML = hits.length ? hits.map(otherRow).join('') : '<div class="rp-empty">No role matches.</div>';
      wire(list);
    };
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  function attach() {
    var inp = document.getElementById('cs-role'); if (!inp || inp._rpWired) return;
    inp._rpWired = 1; inp.readOnly = true; inp.style.cursor = 'pointer';
    inp.addEventListener('mousedown', function (e) { e.preventDefault(); open(); });   // mousedown (not focus) so picking doesn't re-open
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }
  if (document.readyState !== 'loading') attach(); else document.addEventListener('DOMContentLoaded', attach);
  window.RolePicker = { open: open };
})();
