/* ═══════════════════════════════════════════════════════════════════
   theme.js — Switcher de thèmes : default | sourcebook | typewriter
   Anti-FOUC : l'IIFE applique [data-theme] sur <html> avant le paint.
   ═══════════════════════════════════════════════════════════════════ */

var THEME_KEY  = 'bartmoss_theme';
var THEMES     = ['default', 'sourcebook', 'typewriter'];
var THEME_LABELS = {
  'default':    'THEME: DEFAULT',
  'sourcebook': 'THEME: SOURCEBOOK',
  'typewriter': 'THEME: TYPEWRITER'
};

/* ── IIFE anti-FOUC : applique le thème AVANT le premier paint ── */
(function () {
  var s;
  try { s = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (s && s !== 'default') {
    document.documentElement.setAttribute('data-theme', s);
  }
}());

/* ── Appliquer un thème ── */
function themeApply(name) {
  if (name === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', name);
  }
}

/* ── Mettre à jour le label du bouton THEME ── */
function themeUpdateBtn(name) {
  var btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = THEME_LABELS[name] || 'THEME';
  var ascii = document.querySelector('.ascii-theme-btn');
  if (ascii) ascii.textContent = '[THEME: ' + name.toUpperCase() + ']';
}

/* ── Cycle Default → Sourcebook → Typewriter → Default ── */
function themeCycle() {
  var current;
  try { current = localStorage.getItem(THEME_KEY) || 'default'; } catch (e) { current = 'default'; }
  var idx  = THEMES.indexOf(current);
  var next = THEMES[(idx + 1) % THEMES.length];

  themeApply(next);
  themeUpdateBtn(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}

  /* Propager aux iframes déjà chargées */
  document.querySelectorAll('iframe').forEach(function (f) {
    try { f.contentWindow.postMessage({ type: 'setTheme', theme: next }, '*'); } catch (e) {}
  });

  /* Afficher/masquer l'ascii-nav et mettre à jour l'état actif */
  if (next === 'typewriter') {
    themeRenderBanner();
    themeSyncAsciiMenu();
  }
}

/* ── Recevoir le thème depuis le parent (iframe) ── */
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'setTheme') {
    themeApply(e.data.theme);
  }
});

/* ── Bannière ASCII dynamique (typewriter) — ligne unique compacte ── */
function themeRenderBanner() {
  var el = document.getElementById('ascii-banner');
  if (!el) return;

  var charW = 8.4;
  var cols  = Math.max(44, Math.min(100, Math.floor(window.innerWidth / charW) - 2));

  var label = '[ RACHE BARTMOSS\' DATAFORT :: CP2020 v2.01 ]';
  var fillLen = Math.max(0, cols - label.length);
  var left  = Math.floor(fillLen / 2);
  var right = fillLen - left;
  var line  = '+' + '='.repeat(Math.max(0, left - 1)) + label + '='.repeat(Math.max(0, right - 1)) + '+';

  el.textContent = line;
}

/* ── Synchroniser l'ascii-menu avec le panel actif ── */
function themeSyncAsciiMenu() {
  var activePanel = null;
  document.querySelectorAll('.panel').forEach(function (p) {
    if (p.classList.contains('active')) activePanel = p.id;
  });
  document.querySelectorAll('.ascii-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.panel === activePanel);
  });
}

/* ── Raccourcis clavier 1/2/3/4 (typewriter uniquement) ── */
document.addEventListener('keydown', function (e) {
  if (document.documentElement.getAttribute('data-theme') !== 'typewriter') return;
  /* Ignorer si focus dans un input/textarea */
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  var map = { '1': 'home', '2': 'tools', '3': 'database', '4': 'pdfs' };
  var panelId = map[e.key];
  if (!panelId) return;

  /* Réutiliser la logique de main.js : activer les .main-tab et .panel */
  document.querySelectorAll('.main-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.panel === panelId);
  });
  document.querySelectorAll('.panel').forEach(function (p) {
    p.classList.toggle('active', p.id === panelId);
  });
  themeSyncAsciiMenu();
});

/* ── Clicks sur l'ascii-menu ── */
document.addEventListener('click', function (e) {
  var item = e.target.closest('.ascii-item');
  if (!item) return;
  var panelId = item.dataset.panel;
  if (!panelId) return;

  /* Activer le panel correspondant (même logique que .main-tab) */
  document.querySelectorAll('.main-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.panel === panelId);
  });
  document.querySelectorAll('.panel').forEach(function (p) {
    p.classList.toggle('active', p.id === panelId);
  });
  themeSyncAsciiMenu();
});

/* ── Redimensionnement → recalculer la bannière ── */
window.addEventListener('resize', function () {
  if (document.documentElement.getAttribute('data-theme') === 'typewriter') {
    themeRenderBanner();
  }
});

/* ── Initialisation DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', function () {
  var saved;
  try { saved = localStorage.getItem(THEME_KEY) || 'default'; } catch (e) { saved = 'default'; }

  themeUpdateBtn(saved);

  if (saved === 'typewriter') {
    themeRenderBanner();
    themeSyncAsciiMenu();
  }
});
