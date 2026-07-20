/* app-web.js — the WEB / Net section.
   For a PLAYER, the Net section IS the browser (the computer + deliveries live on
   the character sheet, cs.html). For the GM it's an authoring surface (sites,
   hosts) plus the same browser to preview. A SITE is authored content first and is
   MULTIPAGE: site.pages[] each with its own blocks and its own address
   (grid://region/site/page). Navigation between pages is manual — a `navbar` block
   and/or `link` blocks the GM places. Sites persist as Store entities (type
   'site'); live board/presence ride Yjs. Depends on App, Store, Links, Shell. */
(function () {
  'use strict';
  var App = window.App, Store = window.Store;
  function br() { return (window.Shell && Shell.bridge()) || {}; }
  function esc(s) { return App.esc(s); }
  function uid(p) { return App.uid(p); }
  function isPlayer() { return (br().sess || {}).role !== 'gm'; }

  /* ═══════════════ constants ═══════════════ */
  var BROADCAST = ['local', 'district', 'citywide', 'national', 'global'];
  function broadcastOrd(b) { var i = BROADCAST.indexOf(b); return i < 0 ? 2 : i; }
  // Big broadcasts are reachable by everyone (reach 0): citywide/national/global
  // need nothing; district needs reach 1, local needs 2. Better gear reveals more.
  function reachNeeded(site) { return Math.max(0, 2 - broadcastOrd(site.broadcast || 'citywide')); }
  // Net economy: simulated traffic (popularity × reach) → ad revenue.
  // Rich, anti-exploit traffic model. Monthly progression (rep/buzz) advances on
  // the GM's "settle month". traffic = BASE × reach × quality × hostRep × siteRep
  //          × freshness ÷ competition × (1 − adDrag) × luck   (+ buzz views).
  var TRAFFIC_BASE = 40, MONTH_HOURS = 720;
  function hashStr(s) { var h = 5381; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
  function countBlocks(list, type) { var n = 0; (list || []).forEach(function (b) { if (b.type === type) n++; if (b.slots) Object.keys(b.slots).forEach(function (k) { n += countBlocks(b.slots[k], type); }); }); return n; }
  function adSlots(site) { var n = 0; sitePages(site).forEach(function (pg) { n += countBlocks(pg.blocks, 'ad'); }); return n; }
  function adDrag(site) { return Math.min(0.6, adSlots(site) * 0.08); }
  function countAllBlocks(list) { var n = 0; (list || []).forEach(function (b) { n++; if (b.slots) Object.keys(b.slots).forEach(function (k) { n += countAllBlocks(b.slots[k]); }); }); return n; }
  function siteContentCount(site) { var t = 0; sitePages(site).forEach(function (pg) { t += countAllBlocks(pg.blocks); }); return t; }
  // Quality is auto-derived from the ad-to-content ratio: proportionally more ads → spammier → lower quality.
  function qualityMult(site) { var total = siteContentCount(site), ad = adSlots(site), content = Math.max(0, total - ad); var ratio = total ? ad / total : 0; return Math.max(0.3, Math.min(1.6, 1.2 - ratio * 1.5 + Math.min(0.3, Math.log(1 + content) * 0.08))); }
  function repMult(site) { return 1 + Math.log(1 + (parseFloat(site.rep) || 0) / 500); }   // diminishing returns
  function freshnessMult(site) { if (!site.lastEdit) return 1; var months = Math.max(0, (netClock() - site.lastEdit) / MONTH_HOURS); return Math.max(0.4, 1 - months * 0.12); }
  function hostRepMult(hostJson) { var r = (hostJson && hostJson.hostConfig && hostJson.hostConfig.reliability); return 0.7 + 0.2 * (r != null ? r : 1); }
  function competitionDiv(site, all) { if (!all) return 1; var n = all.filter(function (r) { return r.json.id !== site.id && (r.json.kind || 'site') === (site.kind || 'site') && isOnline(r.json); }).length; return 1 + n * 0.12; }
  function playerLuck(site) { if (!site.owner) return 0; var c = camp(); var rec = c && c.getSheet && c.getSheet(site.owner); var st = rec && rec.json && rec.json.stats; return (st && (st.LUCK || st.luck)) || 0; }
  function luckMult(site) { var month = Math.floor(netClock() / MONTH_HOURS); var r = (hashStr(site.id + ':' + month) % 1000) / 1000; return 1 + (r - 0.5) * (0.2 + playerLuck(site) * 0.03); }
  function computeTraffic(site, all) {
    if (!isOnline(site)) return 0;
    var host = all && all.filter(function (r) { return r.json.id === site.hostId; })[0];
    var base = TRAFFIC_BASE * (broadcastOrd(site.broadcast || 'citywide') + 1) * qualityMult(site) * hostRepMult(host && host.json) * repMult(site) * freshnessMult(site) / competitionDiv(site, all) * (1 - adDrag(site)) * luckMult(site);
    return Math.max(0, Math.round(base) + (parseInt(site.buzz, 10) || 0));
  }
  function computeAdRevenue(site, all) { return Math.round(computeTraffic(site, all) * adSlots(site) * (parseFloat(site.adRate) || 0)); }
  var AD_REGIES = [
    { name: 'StreetAds', rate: 0.4, note: 'open to anyone, no minimum' },
    { name: 'MediaCore', rate: 0.9, note: 'needs decent traffic' },
    { name: 'Arasaka AdNet', rate: 1.6, note: 'corp-only, exclusive & clean' },
    { name: 'BlackMarket promos', rate: 1.3, note: 'illegal goods · Netwatch risk' }
  ];
  var DEFAULT_ADS = ['img/ads/200.webp', 'img/ads/200-2.webp', 'img/ads/jelly-beans-jelly-bean.webp', 'img/ads/japanese-rpg.gif', 'img/ads/procter-and-gamble-p-and-g.gif', 'img/ads/smap-okinawa.gif', 'img/ads/ezgif-42084bc3229343d2.gif', 'img/ads/ezgif-4240ac4ef7a97965.gif', 'img/ads/ezgif-439323df570c84b3.gif', 'img/ads/ezgif-450f71e016114523.gif', 'img/ads/ezgif-4664a5271ee12935.gif', 'img/ads/ezgif-47be45be4ad41455.gif'];
  function defaultAd(id) { return DEFAULT_ADS[(hashStr(id || '') + Math.floor((netClock ? netClock() : 0) / MONTH_HOURS)) % DEFAULT_ADS.length]; }
  function isOnline(s) { return !(s && s.state && s.state.online === false); }
  // A hosting plan carries its own list of ALLOWED block keys, chosen by the GM
  // per host. Presets just pre-fill that list. Some blocks are never player-placeable.
  var GM_ONLY_BLOCKS = ['hosting'];
  function allBlockKeys() { return Object.keys(blockRegistry).filter(function (k) { return GM_ONLY_BLOCKS.indexOf(k) < 0; }); }
  var BLOCK_PRESETS = [
    { name: 'Perso — blog / page', keys: ['header', 'heading', 'text', 'image', 'list', 'link', 'divider', 'spacer', 'board', 'badge', 'marquee', 'counter', 'quote', 'footer'] },
    { name: 'Front - everything static', keys: ['header', 'heading', 'text', 'image', 'gallery', 'video', 'audio', 'list', 'link', 'navbar', 'card', 'columns', 'section', 'table', 'profile', 'faq', 'notice', 'quote', 'pullquote', 'divider', 'spacer', 'footer', 'hero', 'details', 'tabs', 'board'] },
    { name: 'Store — boutique', keys: ['header', 'heading', 'text', 'image', 'gallery', 'list', 'link', 'navbar', 'card', 'columns', 'section', 'table', 'item', 'price', 'tipjar', 'ad', 'notice', 'divider', 'spacer', 'footer', 'board'] },
    { name: 'Pro — everything', keys: '*' }
  ];
  function presetKeys(preset) { return preset.keys === '*' ? allBlockKeys() : preset.keys.slice(); }
  function connectable(site, reach) { return (reach || 0) >= reachNeeded(site); }
  function reachOfComputer(c) { if (!c) return 0; var r = (typeof c.reach === 'number' ? c.reach : 0); if (c.perk === 'signal' && c.connection === 'cellular') r += 1; return Math.max(0, Math.min(4, r)); }
  function reachOfDeck(json) { return NetModel.deckStats(json && json.netrunner).reach; }   // deck reach ([BWB], via NetModel)
  function effectiveReach(json) { if (!json) return 0; return Math.max(reachOfComputer(json.net && json.net.computer), reachOfDeck(json)); }
  // Device / render gating — a player needs a machine, and its POWER caps what renders.
  function deviceOf(json) { return json && json.net && json.net.computer; }
  function playerHasDevice(json) { return !!(json && (deviceOf(json) || (json.netrunner && json.netrunner.deckId))); }
  function deviceHasPerk(json, perk) { var c = deviceOf(json); return !!(c && c.perk === perk); }
  function playerPower(json) { if (!isPlayer()) return 999; var c = deviceOf(json); var p = c && typeof c.power === 'number' ? c.power : 0; if (c && c.perk === 'compress') p += 1; return p; }
  var BLOCK_POWER = { image: 2, card: 2, columns: 2, section: 2, hero: 2, reviews: 2, countdown: 2, form: 2, webring: 2, underconstruction: 2, gallery: 3, video: 3, audio: 3, embed: 3, braindance: 4, dashboard: 3, docs: 3, webmail: 3, secops: 3, orgchart: 3, keycard: 3 };
  function blockMinPower(type) { return BLOCK_POWER[type] || 1; }
  function appMinPower(appId) { return (appId === 'corpo-msg' || appId === 'elite') ? 4 : 3; }

  var GRID_W = 26, GRID_H = 26, CELL = 58, CENTER = { x: 13, y: 13 };
  var LEVELS = { ldl: 'df_ldl', lv1: 'df_lv1', lv2: 'df_lv2', lv3: 'df_lv3' };
  var LEVEL_LABEL = { ldl: 'LDL', lv1: 'Datafort 1', lv2: 'Datafort 2', lv3: 'Datafort 3' };
  function levelIcon(l) { return 'img/icons/' + (LEVELS[l] || LEVELS.lv1) + '.png'; }

  // Two families. STREET (default) = old-web / 4chan: flat, square, image-driven,
  // no radius/shadow. CORPO (opt-in) = modern: rounded + soft shadow.
  var THEME_PRESETS = {
    plain:    { bg: '#ffffee', fg: '#800000', accent: '#af0a0f', muted: '#5c5c5c', font: "'Arial', 'Helvetica', sans-serif", rule: '#d9bfb7', card: '#f0e0d6' },
    terminal: { bg: '#0a0b0d', fg: '#e9e4d8', accent: '#8fc9d4', muted: '#8a8f98', font: 'var(--font-mono, monospace)', rule: '#22242a', card: '#14161a' },
    bbs:      { bg: '#120d05', fg: '#f4c775', accent: '#ef9f27', muted: '#a07a3a', font: 'var(--font-mono, monospace)', rule: '#33260f', card: '#1c1408' },
    zine:     { bg: '#f2f0e6', fg: '#111111', accent: '#c0392b', muted: '#555555', font: 'var(--font-mono, monospace)', rule: '#111111', card: '#ffffff' },
    geocities:{ bg: '#000033', fg: '#00ff66', accent: '#ff00ff', muted: '#00cccc', font: "'Comic Sans MS', 'Comic Sans', cursive", rule: '#00ff66', card: '#101044' },
    corp:     { bg: '#f6f5f0', fg: '#1a1a17', accent: '#185fa5', muted: '#6f6d62', font: 'var(--font-sans, sans-serif)', rule: '#e0dccf', card: '#ffffff', radius: '7px', shadow: '0 1px 3px rgba(0,0,0,.12)' },
    chrome:   { bg: '#0d0f14', fg: '#dfe6f0', accent: '#d4537e', muted: '#8a90a0', font: 'var(--font-sans, sans-serif)', rule: '#232838', card: '#151824', radius: '8px', shadow: '0 2px 10px rgba(0,0,0,.45)' },
    neon:     { bg: '#07070c', fg: '#eafcff', accent: '#39ff9e', muted: '#7fa0a8', font: 'var(--font-mono, monospace)', rule: '#12313a', card: '#0c1016', radius: '4px', shadow: '0 0 12px rgba(57,255,158,.25)' },
    paper:    { bg: '#faf7ee', fg: '#1a1712', accent: '#8a1c1c', muted: '#6b6455', font: "'Georgia', serif", rule: '#e2dcc9', card: '#fffdf6', radius: '3px' },
  };
  var STREET_PRESETS = ['plain', 'terminal', 'bbs', 'zine', 'geocities'];
  function themeVars(theme) { theme = theme || {}; var p = THEME_PRESETS[theme.preset] || THEME_PRESETS.plain; var o = theme.overrides || {}; return { bg: o.bg || p.bg, fg: o.fg || p.fg, accent: o.accent || p.accent, muted: o.muted || p.muted, font: o.font || p.font, head: o.head || p.head || o.font || p.font, rule: o.rule || p.rule, card: o.card || p.card, radius: (o.radius != null && o.radius !== '' ? o.radius : (p.radius || '0')), shadow: p.shadow || 'none', bgImage: o.bgImage || '' }; }
  function themeCss(theme) { var v = themeVars(theme); var s = '--web-bg:' + v.bg + ';--web-fg:' + v.fg + ';--web-accent:' + v.accent + ';--web-muted:' + v.muted + ';--web-font:' + v.font + ';--web-head:' + v.head + ';--web-rule:' + v.rule + ';--web-card:' + v.card + ';--web-radius:' + v.radius + ';--web-shadow:' + v.shadow + ';'; s += 'background:' + v.bg + ';color:' + v.fg + ';font-family:' + v.font + ';'; if (v.bgImage) s += 'background-image:url(' + v.bgImage + ');background-size:cover;background-position:center;'; return s; }

  /* ═══════════════ site + page model ═══════════════ */
  function blankSite(name) {
    return {
      name: name || 'New site', kind: 'site', folder: '',
      region: 'nc', broadcast: 'citywide',
      grid: { x: CENTER.x, y: CENTER.y }, level: 'lv1',
      theme: { preset: 'plain', overrides: {} },
      pages: [{ id: uid('pg'), name: 'Home', slug: '', home: true, blocks: [] }],
      state: { online: true }, unlisted: false,
      subject: null, hostId: null,
      record: { uploadDate: Date.now(), broadcast: 'citywide', hostId: null, serverAddress: '', infraId: null },
      hostConfig: null, board: [], props: {},
      auth: { enabled: false, wall: false, levels: ['Public'], accounts: [] },
      owner: null, plan: 0, popularity: 20, ads: false,
    };
  }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function siteUrl(json) { return 'grid://' + (json.region || 'nc') + '/' + (slugify(json.name) || json.id); }
  function ensurePages(json) { if (!Array.isArray(json.pages) || !json.pages.length) json.pages = [{ id: uid('pg'), name: 'Home', slug: '', home: true, blocks: Array.isArray(json.blocks) ? json.blocks : [], board: Array.isArray(json.board) ? json.board : [] }]; return json.pages; }
  function sitePages(json) { return ensurePages(json); }
  function homePage(json) { var ps = ensurePages(json); return ps.filter(function (p) { return p.home; })[0] || ps[0]; }
  function pageBySlug(json, slug) { var ps = ensurePages(json); if (!slug) return homePage(json); return ps.filter(function (p) { return (p.slug || '') === slug; })[0] || homePage(json); }
  function pageUrl(json, page) { var base = siteUrl(json); return (page && !page.home && page.slug) ? base + '/' + page.slug : base; }

  /* ═══════════════ block registry ═══════════════ */
  function eln(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function lines(v) { return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }

  var blockRegistry = {
    header: { kind: 'static', label: 'Header', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'tagline', t: 'text', label: 'Tagline' }, { k: 'logo', t: 'image', label: 'Logo' }, { k: 'align', t: 'select', label: 'Align', opts: ['left', 'center', 'right'] }, { k: 'size', t: 'select', label: 'Size', opts: ['s', 'm', 'l'] }, { k: 'accent', t: 'bool', label: 'Accent title' }, { k: 'rule', t: 'bool', label: 'Underline rule' }],
      render: function (b) { var e = eln('div', 'web-b web-header web-header-' + (b.size || 'm') + (b.rule ? ' web-header-rule' : '')); e.style.textAlign = b.align || 'left'; if (b.logo) e.appendChild(eln('div', 'web-header-logo', '<img src="' + esc(b.logo) + '" alt="">')); var t = eln('div', 'web-header-title', esc(b.title || 'Untitled')); if (b.accent) t.style.color = 'var(--web-accent)'; e.appendChild(t); if (b.tagline) e.appendChild(eln('div', 'web-header-tag', esc(b.tagline))); return e; } },
    text: { kind: 'static', label: 'Text', fields: [{ k: 'body', t: 'textarea', label: 'Body' }, { k: 'align', t: 'select', label: 'Align', opts: ['left', 'center', 'right', 'justify'] }, { k: 'size', t: 'select', label: 'Size', opts: ['s', 'm', 'l'] }, { k: 'mono', t: 'bool', label: 'Monospace' }, { k: 'dropcap', t: 'bool', label: 'Drop cap' }, { k: 'color', t: 'color', label: 'Color' }],
      render: function (b) { var e = eln('div', 'web-b web-text web-text-' + (b.size || 'm') + (b.dropcap ? ' web-text-dropcap' : '')); e.style.textAlign = b.align || 'left'; if (b.mono) e.style.fontFamily = 'var(--font-mono, monospace)'; if (b.color) e.style.color = b.color; setRich(e, b.body || ''); return e; } },
    image: { kind: 'static', label: 'Image', fields: [{ k: 'src', t: 'image', label: 'Image' }, { k: 'caption', t: 'text', label: 'Caption' }, { k: 'size', t: 'select', label: 'Size', opts: ['s', 'm', 'l', 'full'] }, { k: 'align', t: 'select', label: 'Align', opts: ['left', 'center', 'right'] }, { k: 'frame', t: 'bool', label: 'Frame' }, { k: 'round', t: 'bool', label: 'Rounded' }, { k: 'link', t: 'text', label: 'Links to (addr)' }],
      render: function (b) { var e = eln('div', 'web-b web-image web-image-' + (b.size || 'm') + ' web-align-' + (b.align || 'left') + (b.frame ? ' web-image-frame' : '') + (b.round ? ' web-image-round' : '')); var imgHtml = b.src ? '<img src="' + esc(b.src) + '" alt="' + esc(b.caption || '') + '">' : ''; if (b.src) { var w = eln('div', null, imgHtml); if (b.link) { var a = eln('a'); a.href = '#'; a.setAttribute('data-goto', b.link); a.innerHTML = imgHtml; w.innerHTML = ''; w.appendChild(a); } e.appendChild(w); } else e.appendChild(eln('div', 'web-image-ph', esc(b.caption || '[ image ]'))); if (b.caption) e.appendChild(eln('div', 'web-image-cap', esc(b.caption))); return e; } },
    list: { kind: 'static', label: 'List', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'items', t: 'lines', label: 'Items (one per line)' }, { k: 'style', t: 'select', label: 'Bullet', opts: ['disc', 'check', 'arrow', 'dash', 'number', 'none'] }, { k: 'cols', t: 'select', label: 'Columns', opts: ['1', '2'] }],
      render: function (b) { var e = eln('div', 'web-b web-list web-list-' + (b.style || 'disc') + (b.cols === '2' ? ' web-list-2col' : '')); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title))); var ul = eln(b.style === 'number' ? 'ol' : 'ul'); lines(b.items).forEach(function (li) { ul.appendChild(setRich(eln('li'), li)); }); e.appendChild(ul); return e; } },
    link: { kind: 'static', label: 'Link', fields: [{ k: 'label', t: 'text', label: 'Label' }, { k: 'addr', t: 'text', label: 'Address (grid://… or page:slug)' }],
      render: function (b) { var e = eln('div', 'web-b web-link'); var a = eln('a', 'web-a', esc(b.label || b.addr || 'link')); a.href = '#'; a.setAttribute('data-goto', b.addr || ''); e.appendChild(a); return e; } },
    navbar: { kind: 'static', label: 'Nav bar', fields: [{ k: 'hideCurrent', t: 'bool', label: 'Hide current page' }],
      render: function (b, ctx) { var e = eln('div', 'web-b web-navbar'); (sitePages(ctx.siteJson) || []).forEach(function (p) { if (b.hideCurrent && ctx.page && p === ctx.page) return; if (p.access && (ctx.level || 0) < p.access) { e.appendChild(eln('span', 'web-nav-link web-nav-lock', '🔒 ' + esc(p.name))); return; } var a = eln('a', 'web-nav-link' + (ctx.page && p === ctx.page ? ' on' : ''), esc(p.name)); a.href = '#'; a.setAttribute('data-goto', pageUrl(ctx.siteJson, p)); e.appendChild(a); }); return e; } },
    divider: { kind: 'static', label: 'Divider', fields: [{ k: 'style', t: 'select', label: 'Style', opts: ['line', 'double', 'dots', 'stars'] }],
      render: function (b) { var m = { line: '', double: 'web-hr-double', dots: 'web-hr-dots', stars: 'web-hr-stars' }; return eln('div', 'web-b web-hr ' + (m[b.style] || ''), b.style === 'stars' ? '✦ ✦ ✦' : b.style === 'dots' ? '· · · · ·' : ''); } },
    badge: { kind: 'static', label: 'Badge', fields: [{ k: 'text', t: 'text', label: 'Text' }], render: function (b) { return eln('div', 'web-b web-badge', esc(b.text || 'Best viewed in Netscape')); } },
    marquee: { kind: 'static', label: 'Marquee', fields: [{ k: 'text', t: 'text', label: 'Scrolling text' }], render: function (b) { var e = eln('div', 'web-b web-marquee'); e.appendChild(eln('span', 'web-marquee-in', esc(b.text || ''))); return e; } },
    counter: { kind: 'static', label: 'Visitor counter', fields: [{ k: 'label', t: 'text', label: 'Label' }, { k: 'value', t: 'number', label: 'Count' }],
      render: function (b) { var n = ('0000000' + (parseInt(b.value, 10) || 0)).slice(-7); var e = eln('div', 'web-b web-counter'); e.innerHTML = esc(b.label || 'Visitors:') + ' <span class="web-counter-n">' + n.split('').map(function (d) { return '<b>' + d + '</b>'; }).join('') + '</span>'; return e; } },
    board: { kind: 'live', label: 'Board', fields: [{ k: 'title', t: 'text', label: 'Title' }], render: function (b, ctx) { return renderBoardBlock(b, ctx); } },
    compose: { kind: 'interactive', label: 'Post box', fields: [{ k: 'placeholder', t: 'text', label: 'Placeholder' }], render: function (b, ctx) { return renderComposeBlock(b, ctx); } },
    presence: { kind: 'live', label: 'Presence', fields: [{ k: 'label', t: 'text', label: 'Label' }], render: function (b, ctx) { return renderPresenceBlock(b, ctx); } },
    messenger: { kind: 'live', label: 'Messenger (DMs)', fields: [{ k: 'title', t: 'text', label: 'Title' }], render: function (b, ctx) { return renderMessengerBlock(b, ctx); } },
    item: { kind: 'data', label: 'Items (from linked shop)', fields: [{ k: 'cat', t: 'select', label: 'Category', opts: ['all', 'weapons', 'gear', 'cyberware', 'vehicles', 'decks', 'programs'] }, { k: 'title', t: 'text', label: 'Title' }], render: function (b, ctx) { return renderItemsBlock(b, ctx); } },
    price: { kind: 'data', label: 'Price (one item)', fields: [{ k: 'name', t: 'text', label: 'Item name' }], render: function (b, ctx) { return renderPriceBlock(b, ctx); } },
    form: { kind: 'interactive', label: 'Contact form', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'fields', t: 'lines', label: 'Fields (one per line)' }],
      render: function (b) { var e = eln('div', 'web-b web-form'); if (b.title) e.appendChild(eln('div', 'web-form-t', esc(b.title))); lines(b.fields).forEach(function (f) { e.appendChild(eln('label', 'web-form-f', esc(f) + '<input type="text">')); }); e.appendChild(eln('button', 'web-btn', 'Send')); return e; } },
    gate: { kind: 'interactive', label: 'Members gate', fields: [{ k: 'prompt', t: 'text', label: 'Prompt' }], render: function (b) { var e = eln('div', 'web-b web-gate'); e.innerHTML = '<span class="web-gate-lock">▮</span> ' + esc(b.prompt || 'Members only — enter access code.'); return e; } },
    // ── secure / corpo (work with the site auth layer) ──
    login: { kind: 'interactive', label: 'Login form', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'note', t: 'text', label: 'Note' }], render: function (b, ctx) { var json = ctx.siteJson, e = eln('div', 'web-b web-loginblock'); if (json && json.auth && json.auth.enabled && isPlayer() && authAccount(json)) { e.appendChild(eln('div', 'web-login-ok', '🔓 Signed in as ' + esc(authAccount(json).user))); var out = eln('button', 'web-btn', 'log out'); out.onclick = function () { doLogout(json); repaintSite(ctx); }; e.appendChild(out); return e; } e.appendChild(eln('div', 'web-login-h', esc(b.title || 'Sign in'))); if (b.note) e.appendChild(eln('div', 'web-login-sub', esc(b.note))); if (json) e.appendChild(loginForm(json, ctx)); return e; } },
    dashboard: { kind: 'static', label: 'Dashboard', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'tiles', t: 'lines', label: 'Tiles (label :: value :: sub)' }], render: function (b) { var e = eln('div', 'web-b web-dash'); if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title))); var grid = eln('div', 'web-dash-grid'); lines(b.tiles).forEach(function (li) { var p = li.split('::'); var t = eln('div', 'web-dash-tile'); t.innerHTML = '<div class="web-dash-v">' + esc((p[1] || '').trim()) + '</div><div class="web-dash-l">' + esc((p[0] || '').trim()) + '</div>' + (p[2] ? '<div class="web-dash-s">' + esc(p[2].trim()) + '</div>' : ''); grid.appendChild(t); }); e.appendChild(grid); return e; } },
    docs: { kind: 'static', label: 'Documents', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'items', t: 'lines', label: 'Docs (name :: level :: body)' }], render: function (b, ctx) { var e = eln('div', 'web-b web-docs'); if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title))); var lvl = (ctx && ctx.level) || 0; lines(b.items).forEach(function (li) { var p = li.split('::'), name = (p[0] || '').trim(), need = parseInt(p[1], 10) || 0, bodyTxt = (p.slice(2).join('::') || '').trim(); var row = eln('div', 'web-doc'); if (lvl < need) { row.className += ' web-doc-lock'; row.innerHTML = '<span class="web-doc-i">🔒</span> <span class="web-doc-n">' + esc(name) + '</span> <span class="web-doc-lv">L' + need + '</span>'; } else { row.innerHTML = '<span class="web-doc-i">▤</span> <span class="web-doc-n">' + esc(name) + '</span>'; row.style.cursor = 'pointer'; row.onclick = function () { if (window.UI) UI.modal({ title: name, body: '<div class="web-doc-body"></div>', actions: [{ label: 'Close' }], onShow: function (box) { setRich(box.querySelector('.web-doc-body'), bodyTxt); } }); }; } e.appendChild(row); }); return e; } },
    webmail: { kind: 'static', label: 'Webmail', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'items', t: 'lines', label: 'Mail (from :: subject :: body)' }], render: function (b) { var e = eln('div', 'web-b web-mail'); if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title))); lines(b.items).forEach(function (li) { var p = li.split('::'), from = (p[0] || '').trim(), subj = (p[1] || '').trim(), body = (p.slice(2).join('::') || '').trim(); var row = eln('div', 'web-mail-row'); row.innerHTML = '<span class="web-mail-from">' + esc(from) + '</span><span class="web-mail-subj">' + esc(subj) + '</span>'; row.style.cursor = 'pointer'; row.onclick = function () { if (window.UI) UI.modal({ title: subj || '(no subject)', body: '<div class="dt-hint">From: ' + esc(from) + '</div><div class="web-mail-body"></div>', actions: [{ label: 'Close' }], onShow: function (box) { setRich(box.querySelector('.web-mail-body'), body); } }); }; e.appendChild(row); }); return e; } },
    secops: { kind: 'static', label: 'Security ops', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'alert', t: 'select', label: 'Alert level', opts: ['green', 'amber', 'red'] }, { k: 'feeds', t: 'lines', label: 'Camera feeds (one per line)' }], render: function (b) { var e = eln('div', 'web-b web-secops web-secops-' + (b.alert || 'green')); e.appendChild(eln('div', 'web-secops-h', (b.title || 'SECURITY') + ' — ALERT: ' + (b.alert || 'green').toUpperCase())); var grid = eln('div', 'web-secops-grid'); lines(b.feeds).forEach(function (f) { grid.appendChild(eln('div', 'web-secops-cam', '◉ ' + esc(f))); }); e.appendChild(grid); return e; } },
    orgchart: { kind: 'static', label: 'Org chart', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'items', t: 'lines', label: 'Rows (depth :: name :: title)' }], render: function (b) { var e = eln('div', 'web-b web-orgchart'); if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title))); lines(b.items).forEach(function (li) { var p = li.split('::'); var depth = Math.max(0, Math.min(5, parseInt(p[0], 10) || 0)); var row = eln('div', 'web-org-node'); row.style.marginLeft = (depth * 22) + 'px'; row.innerHTML = '<span class="web-org-n">' + esc((p[1] || '').trim()) + '</span>' + (p[2] ? '<span class="web-org-t">' + esc(p[2].trim()) + '</span>' : ''); e.appendChild(row); }); return e; } },
    keycard: { kind: 'static', label: 'Doors / access', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'items', t: 'lines', label: 'Doors (name :: level :: open|locked)' }], render: function (b, ctx) { var e = eln('div', 'web-b web-doors'); if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title))); var lvl = (ctx && ctx.level) || 0; lines(b.items).forEach(function (li) { var p = li.split('::'), name = (p[0] || '').trim(), need = parseInt(p[1], 10) || 0, st = (p[2] || 'locked').trim().toLowerCase(); var open = st === 'open' || st === 'unlocked'; var row = eln('div', 'web-door web-door-' + (open ? 'open' : 'locked')); row.innerHTML = '<span class="web-door-i">' + (open ? '🔓' : '🔒') + '</span><span class="web-door-n">' + esc(name) + '</span>' + (lvl >= need ? '<span class="web-door-s">' + (open ? 'OPEN' : 'LOCKED') + '</span>' : '<span class="web-door-s">L' + need + '</span>'); e.appendChild(row); }); return e; } },
    // ── layout / structure ──
    hero: { kind: 'static', label: 'Hero', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'tagline', t: 'text', label: 'Tagline' }, { k: 'image', t: 'image', label: 'Background' }, { k: 'height', t: 'select', label: 'Height', opts: ['s', 'm', 'l'] }, { k: 'align', t: 'select', label: 'Align', opts: ['left', 'center', 'right'] }, { k: 'overlay', t: 'bool', label: 'Dark overlay' }, { k: 'cta', t: 'text', label: 'Button label' }, { k: 'ctaAddr', t: 'text', label: 'Button → addr' }],
      render: function (b) { var e = eln('div', 'web-b web-hero web-hero-' + (b.height || 'm') + (b.overlay ? ' web-hero-ovl' : '')); e.style.textAlign = b.align || 'left'; if (b.image) e.style.backgroundImage = 'url(' + b.image + ')'; var cta = b.cta ? '<a class="web-btn web-hero-cta" href="#" data-goto="' + esc(b.ctaAddr || '') + '">' + esc(b.cta) + '</a>' : ''; e.innerHTML = '<div class="web-hero-in"><div class="web-hero-t">' + esc(b.title || '') + '</div>' + (b.tagline ? '<div class="web-hero-tag">' + esc(b.tagline) + '</div>' : '') + cta + '</div>'; return e; } },
    // ── containers (hold child blocks in slots; rendered by renderContainer) ──
    columns: { kind: 'container', label: 'Columns', fields: [{ k: 'cols', t: 'select', label: 'Columns', opts: ['2', '3', '4'] }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    card: { kind: 'container', label: 'Card', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'border', t: 'select', label: 'Border', opts: ['box', 'left', 'none'] }, { k: 'tint', t: 'bool', label: 'Tinted bg' }, { k: 'accent', t: 'bool', label: 'Accent title' }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    panel: { kind: 'container', label: 'Panel', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'tone', t: 'select', label: 'Tone', opts: ['default', 'accent'] }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    section: { kind: 'container', label: 'Section', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'bg', t: 'image', label: 'Background' }, { k: 'pad', t: 'select', label: 'Padding', opts: ['s', 'm', 'l'] }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    details: { kind: 'container', label: 'Details / spoiler', fields: [{ k: 'summary', t: 'text', label: 'Summary' }, { k: 'open', t: 'bool', label: 'Open by default' }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    table: { kind: 'container', label: 'Table / grid', fields: [{ k: 'rows', t: 'number', label: 'Rows' }, { k: 'cols', t: 'number', label: 'Cols' }, { k: 'borders', t: 'bool', label: 'Cell borders' }, { k: 'head', t: 'bool', label: 'Header row' }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    tabs: { kind: 'container', label: 'Tabs', fields: [{ k: 'tabLabels', t: 'lines', label: 'Tabs (one per line)' }], render: function (b, ctx) { return renderContainer(b, ctx); } },
    spacer: { kind: 'static', label: 'Spacer', fields: [{ k: 'size', t: 'select', label: 'Size', opts: ['s', 'm', 'l'] }], render: function (b) { var e = eln('div', 'web-b'); e.style.height = ({ s: 12, m: 32, l: 64 }[b.size || 'm']) + 'px'; return e; } },
    pullquote: { kind: 'static', label: 'Pull quote', fields: [{ k: 'text', t: 'textarea', label: 'Quote' }, { k: 'cite', t: 'text', label: 'Cite' }], render: function (b) { var e = eln('div', 'web-b web-pull'); e.appendChild(setRich(eln('div', 'web-pull-t'), b.text || '')); if (b.cite) e.appendChild(eln('div', 'web-pull-c', '— ' + esc(b.cite))); return e; } },
    footer: { kind: 'static', label: 'Footer', fields: [{ k: 'text', t: 'textarea', label: 'Text' }], render: function (b) { var e = eln('div', 'web-b web-footer'); e.textContent = b.text || ''; return e; } },
    // ── editorial ──
    heading: { kind: 'static', label: 'Heading', fields: [{ k: 'text', t: 'text', label: 'Text' }, { k: 'level', t: 'select', label: 'Level', opts: ['1', '2', '3'] }, { k: 'align', t: 'select', label: 'Align', opts: ['left', 'center', 'right'] }, { k: 'accent', t: 'bool', label: 'Accent' }, { k: 'caps', t: 'bool', label: 'Uppercase' }], render: function (b) { var e = eln('div', 'web-b web-heading web-h' + (b.level || '2') + (b.caps ? ' web-caps' : '')); e.style.textAlign = b.align || 'left'; if (b.accent) e.style.color = 'var(--web-accent)'; e.textContent = b.text || ''; return e; } },
    quote: { kind: 'static', label: 'Quote', fields: [{ k: 'text', t: 'textarea', label: 'Quote' }, { k: 'cite', t: 'text', label: 'Cite' }], render: function (b) { var e = eln('blockquote', 'web-b web-quote'); setRich(e, b.text || ''); if (b.cite) e.appendChild(eln('cite', null, '— ' + esc(b.cite))); return e; } },
    notice: { kind: 'static', label: 'Notice', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'text', t: 'textarea', label: 'Text' }, { k: 'tone', t: 'select', label: 'Tone', opts: ['info', 'warn', 'danger', 'success'] }, { k: 'icon', t: 'text', label: 'Icon (emoji)' }], render: function (b) { var e = eln('div', 'web-b web-notice web-notice-' + (b.tone || 'info')); var head = (b.icon ? '<span class="web-notice-ic">' + esc(b.icon) + '</span>' : '') + (b.title ? '<b>' + esc(b.title) + '</b>' : ''); if (head) e.appendChild(eln('div', 'web-notice-t', head)); e.appendChild(setRich(eln('div'), b.text || '')); return e; } },
    table: { kind: 'static', label: 'Table', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'rows', t: 'lines', label: 'Rows (cells split by |)' }], render: function (b) { var e = eln('div', 'web-b web-table2'); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title))); var tb = eln('table'); lines(b.rows).forEach(function (r) { var tr = eln('tr'); r.split('|').forEach(function (cel) { tr.appendChild(eln('td', null, esc(cel.trim()))); }); tb.appendChild(tr); }); e.appendChild(tb); return e; } },
    code: { kind: 'static', label: 'Code / data', fields: [{ k: 'body', t: 'textarea', label: 'Body' }], render: function (b) { var e = eln('pre', 'web-b web-code'); e.textContent = b.body || ''; return e; } },
    faq: { kind: 'static', label: 'FAQ', fields: [{ k: 'items', t: 'lines', label: 'Q :: A per line' }], render: function (b) { var e = eln('div', 'web-b web-faq'); lines(b.items).forEach(function (li) { var p = li.split('::'); e.innerHTML += '<div class="web-faq-q">' + esc((p[0] || '').trim()) + '</div><div class="web-faq-a">' + esc((p[1] || '').trim()) + '</div>'; }); return e; } },
    // ── media ──
    gallery: { kind: 'static', label: 'Gallery', fields: [{ k: 'i1', t: 'image', label: 'Image 1' }, { k: 'i2', t: 'image', label: 'Image 2' }, { k: 'i3', t: 'image', label: 'Image 3' }, { k: 'i4', t: 'image', label: 'Image 4' }], render: function (b) { var e = eln('div', 'web-b web-gallery'); [b.i1, b.i2, b.i3, b.i4].forEach(function (s) { if (s) e.appendChild(eln('div', null, '<img src="' + esc(s) + '">')); }); if (!e.children.length) e.appendChild(eln('div', 'web-empty', 'No images.')); return e; } },
    // ── diegetic / social / commerce ──
    wanted: { kind: 'static', label: 'Wanted / bounty', fields: [{ k: 'name', t: 'text', label: 'Name' }, { k: 'crime', t: 'text', label: 'Crime' }, { k: 'reward', t: 'text', label: 'Reward' }, { k: 'photo', t: 'image', label: 'Photo' }], render: function (b) { var e = eln('div', 'web-b web-wanted'); e.innerHTML = (b.photo ? '<img class="web-wanted-ph" src="' + esc(b.photo) + '">' : '') + '<div class="web-wanted-x"><div class="web-wanted-h">WANTED</div><div class="web-wanted-n">' + esc(b.name || '') + '</div><div class="web-wanted-c">' + esc(b.crime || '') + '</div><div class="web-wanted-r">' + esc(b.reward || '') + '</div></div>'; return e; } },
    profile: { kind: 'static', label: 'Profile', fields: [{ k: 'name', t: 'text', label: 'Name' }, { k: 'role', t: 'text', label: 'Role' }, { k: 'photo', t: 'image', label: 'Photo' }, { k: 'bio', t: 'textarea', label: 'Bio' }], render: function (b) { var e = eln('div', 'web-b web-profile'); e.innerHTML = (b.photo ? '<img class="web-profile-ph" src="' + esc(b.photo) + '">' : '') + '<div class="web-profile-x"><div class="web-profile-n">' + esc(b.name || '') + '</div><div class="web-profile-r">' + esc(b.role || '') + '</div><div class="web-profile-b">' + esc(b.bio || '') + '</div></div>'; return e; } },
    reviews: { kind: 'static', label: 'Reviews', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'items', t: 'lines', label: 'stars :: text :: author' }], render: function (b) { var e = eln('div', 'web-b web-reviews'); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title))); lines(b.items).forEach(function (li) { var p = li.split('::'); var st = Math.max(0, Math.min(5, parseInt(p[0], 10) || 0)); e.innerHTML += '<div class="web-review"><span class="web-review-s">' + (st ? new Array(st + 1).join('★') : '') + '</span> ' + esc((p[1] || '').trim()) + ' <span class="web-review-a">— ' + esc((p[2] || '').trim()) + '</span></div>'; }); return e; } },
    ad: { kind: 'static', label: 'Ad / sponsor', fields: [{ k: 'text', t: 'text', label: 'Text' }, { k: 'image', t: 'image', label: 'Image' }, { k: 'addr', t: 'text', label: 'Links to (grid://…)' }], render: function (b) { var e = eln('div', 'web-b web-ad'); var a = eln('a', 'web-ad-in'); a.href = '#'; a.setAttribute('data-goto', b.addr || ''); a.innerHTML = (b.image ? '<img src="' + esc(b.image) + '">' : '') + '<span>' + esc(b.text || 'Sponsored') + '</span>'; e.appendChild(a); return e; } },
    countdown: { kind: 'static', label: 'Countdown', fields: [{ k: 'value', t: 'text', label: 'Display (T-…)' }, { k: 'label', t: 'text', label: 'Label' }], render: function (b) { var e = eln('div', 'web-b web-countdown'); e.innerHTML = '<div class="web-cd-v">' + esc(b.value || 'T-00:00') + '</div><div class="web-cd-l">' + esc(b.label || '') + '</div>'; return e; } },
    manifesto: { kind: 'static', label: 'Manifesto', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'body', t: 'textarea', label: 'Body' }], render: function (b) { var e = eln('div', 'web-b web-manifesto'); if (b.title) e.appendChild(eln('div', 'web-manifesto-t', esc(b.title))); var bd = eln('div', 'web-manifesto-b'); bd.textContent = b.body || ''; e.appendChild(bd); return e; } },
    subscription: { kind: 'commerce', label: 'Subscription', fields: [{ k: 'name', t: 'text', label: 'Plan' }, { k: 'price', t: 'text', label: 'Price' }, { k: 'perks', t: 'lines', label: 'Perks (one per line)' }], render: function (b) { var e = eln('div', 'web-b web-sub'); e.innerHTML = '<div class="web-sub-n">' + esc(b.name || '') + '</div><div class="web-sub-p">' + esc(b.price || '') + '</div>'; var ul = eln('ul'); lines(b.perks).forEach(function (p) { ul.appendChild(eln('li', null, esc(p))); }); e.appendChild(ul); e.appendChild(eln('button', 'web-btn', 'Subscribe')); return e; } },
    tipjar: { kind: 'commerce', label: 'Tip jar', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'note', t: 'text', label: 'Note' }, { k: 'suggest', t: 'number', label: 'Suggested (eb)' }], render: function (b, ctx) { var e = eln('div', 'web-b web-tipjar'); e.appendChild(eln('div', 'web-tipjar-t', esc(b.title || 'Tip jar'))); if (b.note) e.appendChild(eln('div', 'web-tipjar-n', esc(b.note))); var btn = eln('button', 'web-btn', '💸 Send eb'); btn.onclick = function () { tipOwner(ctx.siteJson, parseInt(b.suggest, 10) || 0); }; e.appendChild(btn); return e; } },
    hosting: { kind: 'special', label: 'Hosting portal', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'blurb', t: 'text', label: 'Blurb' }, { k: 'plans', t: 'plans', label: 'Plans' }], render: function (b, ctx) { return renderHostingBlock(b, ctx); } },
    ad: { kind: 'special', label: 'Ad slot', fields: [{ k: 'src', t: 'image', label: 'Creative (leave empty = default ad)' }, { k: 'text', t: 'text', label: 'Caption (optional)' }, { k: 'href', t: 'text', label: 'Links to (addr, optional)' }], render: function (b) {
      var e = eln('div', 'web-b web-adslot web-adslot-has'); var src = b.src || defaultAd(b.id);
      var media = eln('div', 'web-adslot-media'), imgHtml = '<img src="' + esc(src) + '" alt="ad">';
      if (b.href) { var a = eln('a'); a.href = '#'; a.setAttribute('data-goto', b.href); a.innerHTML = imgHtml; media.appendChild(a); } else media.innerHTML = imgHtml;
      media.appendChild(eln('span', 'web-adslot-tag', 'AD')); e.appendChild(media);
      if (b.text) e.appendChild(eln('div', 'web-adslot-cap', esc(b.text)));
      return e;
    } },
    // ── media ──
    embed: { kind: 'special', label: 'Embed (iframe)', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'src', t: 'text', label: 'URL / path' }, { k: 'height', t: 'number', label: 'Height (px)' }], render: function (b) { var e = eln('div', 'web-b web-embed'); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title))); if (b.src) { var f = eln('iframe', 'web-embed-f'); f.src = b.src; f.style.height = ((parseInt(b.height, 10) || 360)) + 'px'; e.appendChild(f); } else e.appendChild(eln('div', 'web-empty', 'No URL set.')); return e; } },
    video: { kind: 'static', label: 'Video', fields: [{ k: 'src', t: 'file', accept: 'video/*', label: 'Video file' }, { k: 'caption', t: 'text', label: 'Caption' }], render: function (b) { var e = eln('div', 'web-b web-video'); if (b.src) e.innerHTML = '<video controls src="' + esc(b.src) + '"></video>'; else e.appendChild(eln('div', 'web-image-ph', '[ video ]')); if (b.caption) e.appendChild(eln('div', 'web-image-cap', esc(b.caption))); return e; } },
    audio: { kind: 'static', label: 'Audio', fields: [{ k: 'src', t: 'file', accept: 'audio/*', label: 'Audio file' }, { k: 'label', t: 'text', label: 'Label' }], render: function (b) { var e = eln('div', 'web-b web-audio'); if (b.label) e.appendChild(eln('div', null, esc(b.label))); if (b.src) e.innerHTML += '<audio controls src="' + esc(b.src) + '"></audio>'; else e.appendChild(eln('div', 'web-empty', 'No audio.')); return e; } },
    braindance: { kind: 'special', label: 'Braindance', fields: [{ k: 'title', t: 'text', label: 'Title' }, { k: 'src', t: 'file', accept: 'video/*', label: 'Clip' }, { k: 'warning', t: 'text', label: 'Warning' }], render: function (b) { var e = eln('div', 'web-b web-bd'); e.innerHTML = '<div class="web-bd-h">◉ BRAINDANCE' + (b.warning ? ' — ' + esc(b.warning) : '') + '</div>' + (b.src ? '<video controls src="' + esc(b.src) + '"></video>' : '<div class="web-bd-ph">' + esc(b.title || '[ BD clip ]') + '</div>'); return e; } },
    // ── old-net ──
    underconstruction: { kind: 'static', label: 'Under construction', fields: [{ k: 'text', t: 'text', label: 'Text' }], render: function (b) { return eln('div', 'web-b web-uc', '🚧 ' + esc(b.text || 'This page is under construction!')); } },
    webring: { kind: 'static', label: 'Webring', fields: [{ k: 'prev', t: 'text', label: 'Prev (addr)' }, { k: 'hub', t: 'text', label: 'Hub (addr)' }, { k: 'next', t: 'text', label: 'Next (addr)' }], render: function (b) { var e = eln('div', 'web-b web-webring'); ['prev', 'hub', 'next'].forEach(function (k) { var a = eln('a', 'web-nav-link', k); a.href = '#'; a.setAttribute('data-goto', b[k] || ''); e.appendChild(a); }); return e; } },
  };
  var BLOCK_GROUPS = [
    { label: 'Layout', keys: ['hero', 'spacer', 'divider', 'pullquote', 'footer'] },
    { label: 'Containers', keys: ['columns', 'card', 'panel', 'section', 'table', 'details', 'tabs'] },
    { label: 'Text', keys: ['header', 'heading', 'text', 'quote', 'list', 'table', 'faq', 'notice', 'code'] },
    { label: 'Media', keys: ['image', 'gallery', 'video', 'audio', 'braindance', 'embed'] },
    { label: 'Navigation', keys: ['link', 'navbar'] },
    { label: 'Old-net', keys: ['badge', 'marquee', 'counter', 'underconstruction', 'webring'] },
    { label: 'Live / chat', keys: ['board', 'compose', 'presence', 'messenger'] },
    { label: 'Shop / data', keys: ['item', 'price', 'subscription', 'tipjar', 'ad'] },
    { label: 'People / diegetic', keys: ['profile', 'reviews', 'wanted', 'ad', 'countdown', 'manifesto'] },
    { label: 'Forms', keys: ['form', 'gate'] },
    { label: 'Secure / corpo', keys: ['login', 'dashboard', 'docs', 'webmail', 'orgchart', 'keycard', 'secops', 'hosting'] },
  ];

  function renderItemsBlock(b, ctx) {
    var e = eln('div', 'web-b web-items'); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title)));
    var shop = ctx && ctx.subject && ctx.subject.items ? ctx.subject : null;
    if (!shop) { e.appendChild(eln('div', 'web-empty', 'No shop linked.')); return e; }
    var items = (shop.items || []).filter(function (it) { return b.cat === 'all' || !b.cat || it.cat === b.cat; });
    if (!items.length) { e.appendChild(eln('div', 'web-empty', 'Nothing in stock.')); return e; }
    items.forEach(function (it) { var row = eln('div', 'web-item'); row.innerHTML = '<span class="web-item-n">' + esc(it.name || 'item') + '</span><span class="web-item-p">' + (it.price != null ? it.price + 'eb' : '') + '</span>'; if (isPlayer()) { var buy = eln('button', 'web-btn web-buy', 'buy'); buy.onclick = function () { onlineBuy(ctx.siteJson, it, shop, buy); }; row.appendChild(buy); } e.appendChild(row); });
    return e;
  }
  function renderPriceBlock(b, ctx) {
    var e = eln('div', 'web-b web-price'); var shop = ctx && ctx.subject && ctx.subject.items ? ctx.subject : null;
    var it = shop && (shop.items || []).filter(function (x) { return (x.name || '').toLowerCase() === String(b.name || '').toLowerCase(); })[0];
    if (!it) { e.appendChild(eln('div', 'web-empty', b.name ? 'Item not found on the linked shop.' : 'No shop linked.')); return e; }
    e.innerHTML = '<span class="web-item-n">' + esc(it.name) + '</span> <span class="web-item-p">' + (it.price != null ? it.price + 'eb' : '') + '</span>';
    if (isPlayer()) { var buy = eln('button', 'web-btn web-buy', 'buy'); buy.onclick = function () { onlineBuy(ctx.siteJson, it, shop, buy); }; e.appendChild(buy); }
    return e;
  }

  function camp() { var s = br().sess; return s && s.camp; }
  function hasNet() { var c = camp(); return !!(c && c.putNetPost && c.getNetPosts); }
  // The GM never posts as "GM". They keep a roster of net personas (casual
  // handles that pop up on forums) to switch between fast, and can also
  // impersonate an NPC. Current name in web.persona; roster in web.personas.
  var _persona = null;
  function webPersonas() { return App.uiGet('web.personas', []) || []; }
  function saveWebPersonas(list) { App.uiSet('web.personas', list); }
  function addWebPersona(name) { name = (name || '').trim(); if (!name) return; var l = webPersonas(); if (l.indexOf(name) < 0) { l.push(name); saveWebPersonas(l); } setPersona(name); }
  function removeWebPersona(name) { saveWebPersonas(webPersonas().filter(function (n) { return n !== name; })); if (_persona === name) setPersona(''); }
  function posterHandle() { var s = br().sess; if (!s) return 'anon'; if (s.role !== 'gm') { var j = playerJson(); return (j && (j.handle || j.name)) || 'runner'; } if (_persona == null) _persona = App.uiGet('web.persona', '') || ''; return _persona; }
  function setPersona(name) { _persona = (name || '').trim(); App.uiSet('web.persona', _persona); document.querySelectorAll('.web-persona-live').forEach(function (el2) { if (el2._sync) el2._sync(); }); }
  function myHandle() { return posterHandle(); }
  // A quick-switch <select> of the GM's net personas (+ NPC / new / manage).
  // Names the players know: the union of every player sheet's contacts.
  function allContacts() { var c = camp(); if (!c || !c.allSheets) return []; var out = []; (c.allSheets() || []).forEach(function (rec) { ((rec.json && rec.json.contacts) || []).forEach(function (ct) { var n = ct && (ct.name || ct.handle); if (n) out.push(n); }); }); return out.filter(function (v, i, a) { return a.indexOf(v) === i; }); }
  // Rich "write as" picker: saved personas + contacts the players know + NPCs + free text.
  function pickPersonaRich(done) {
    if (!window.UI) { done(''); return; }
    Store.index('npc').then(function (rows) {
      var npcs = rows.map(function (r) { return Store.displayName(r); }).filter(Boolean), personas = webPersonas(), contacts = allContacts();
      function sec(label, arr) { return arr.length ? '<div class="web-pp-sec">' + esc(label) + '</div>' + arr.map(function (n) { return '<button class="lk-picker-row" data-name="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') : ''; }
      amodal({ title: 'Write as…', body: '<input class="rt-input" id="pp-name" placeholder="…or type any name"><div class="lk-picker-res" style="margin-top:8px">' + (sec('Your personas', personas) + sec('Contacts — people the players know', contacts) + sec('NPCs', npcs) || '<div class="app-empty">No NPCs or contacts yet — type a name.</div>') + '</div>', actions: [{ label: 'Cancel' }, { label: 'Use name', kind: 'primary', onClick: function (box) { var v = (box.querySelector('#pp-name').value || '').trim(); if (!v) return false; done(v); } }], onShow: function (box, close) { box.querySelectorAll('[data-name]').forEach(function (b) { b.onclick = function () { close(); done(b.getAttribute('data-name')); }; }); box.querySelector('#pp-name').focus(); } });
    }).catch(function () { done(''); });
  }
  function personaSelect() {
    var sel = eln('select', 'web-asnpc web-persona-live');
    function build() { var list = webPersonas(), cur = posterHandle(); sel.innerHTML = (cur && list.indexOf(cur) < 0 ? '<option selected>' + esc(cur) + '</option>' : (!cur ? '<option value="" selected>pick a name…</option>' : '')) + list.map(function (p) { return '<option' + (p === cur ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '<option value="__npc">＋ impersonate (NPC / contact)…</option><option value="__new">＋ new persona…</option><option value="__manage">manage…</option>'; }
    build(); sel._sync = build;
    sel.onchange = function () { var v = sel.value; if (v === '__npc') pickPersonaRich(function (n) { if (n) addWebPersona(n); build(); }); else if (v === '__new') App.prompt('New net persona', 'Handle', '', function (n) { addWebPersona(n); build(); }); else if (v === '__manage') managePersonas(function () { build(); }); else setPersona(v); };
    return sel;
  }
  function pickNpc(done) { if (!window.UI) { done(''); return; } Store.index('npc').then(function (rows) { var npcs = rows.map(function (r) { return Store.displayName(r); }).filter(Boolean); UI.modal({ title: 'Impersonate an NPC', body: '<input class="rt-input" id="pp-name" placeholder="or type a name"><div id="pp-list" class="lk-picker-res" style="margin-top:8px"></div>', actions: [{ label: 'Cancel' }, { label: 'Use', kind: 'primary', onClick: function (box) { done((box.querySelector('#pp-name').value || '').trim()); } }], onShow: function (box) { box.querySelector('#pp-list').innerHTML = npcs.slice(0, 60).map(function (n, i) { return '<button class="lk-picker-row" data-i="' + i + '">' + esc(n) + '</button>'; }).join('') || '<div class="app-empty">No NPCs — type a name.</div>'; box.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { UI.close(); done(npcs[+b.getAttribute('data-i')]); }; }); box.querySelector('#pp-name').focus(); } }); }).catch(function () { done(''); }); }
  function managePersonas(done) { if (!window.UI) return; var list = webPersonas(); UI.modal({ title: 'Net personas', body: '<div>' + (list.length ? list.map(function (n, i) { return '<div class="rt-rowline"><span>' + esc(n) + '</span><button class="rt-link" data-rm="' + i + '">remove</button></div>'; }).join('') : '<div class="app-empty">No personas yet.</div>') + '</div><label class="rt-field" style="margin-top:8px"><span class="rt-field-l">Add</span><input class="rt-input" id="mp-add" placeholder="new handle"></label>', actions: [{ label: 'Done', kind: 'primary', onClick: function () { if (done) done(); } }], onShow: function (box) { box.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { removeWebPersona(list[+b.getAttribute('data-rm')]); UI.close(); managePersonas(done); }; }); box.querySelector('#mp-add').onkeydown = function (e) { if (e.key === 'Enter') { addWebPersona(e.target.value); UI.close(); managePersonas(done); } }; } }); }
  // Boards/chat are keyed per page (a page = a channel).
  function chanKey(ctx, b) { return ctx.siteId + ':' + ((b && b.channel) || (ctx.page && ctx.page.slug) || 'main'); }
  function boardPosts(key, page) { if (hasNet()) { var live = camp().getNetPosts(key) || []; if (live.length) return live; } return (page && page.board) || []; }
  function postToBoard(key, ctx, post) { if (hasNet()) camp().putNetPost(key, post); else { var pg = ctx.page || {}; pg.board = (pg.board || []).concat([post]); if (!isPlayer()) Store.put({ type: 'site', id: ctx.siteId }, ctx.siteJson).catch(function () {}); } document.querySelectorAll('.web-board').forEach(function (el2) { if (el2._webRepaint) el2._webRepaint(); }); }
  function presenceFor(siteId) { var c = camp(); if (!c || !c.getPeers) return []; var out = []; (c.getPeers() || []).forEach(function (st) { if (st && st.netSite === siteId && st.netHandle) out.push(st.netHandle); }); return out; }
  function renderBoardBlock(b, ctx) { var key = chanKey(ctx, b); var e = eln('div', 'web-b web-board'); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title))); var listEl = eln('div', 'web-board-list'); e.appendChild(listEl); function paint() { var posts = boardPosts(key, ctx.page); listEl.innerHTML = ''; if (!posts.length) { listEl.appendChild(eln('div', 'web-empty', 'No messages yet.')); return; } var prev = null; posts.forEach(function (p) { var who = p.handle || 'anon'; var d = eln('div', 'web-post' + (who === prev ? ' web-post-cont' : '')); if (who !== prev) d.appendChild(eln('div', 'web-post-h', '<b>' + esc(who) + '</b> <span class="web-post-t">' + esc(p.tag || '') + '</span>')); d.appendChild(setRich(eln('div', 'web-post-b'), p.body || '')); listEl.appendChild(d); prev = who; }); } paint(); if (hasNet()) camp().onNetChange(function () { paint(); }); e._webRepaint = paint; return e; }
  function renderComposeBlock(b, ctx) { var key = chanKey(ctx, b); var e = eln('div', 'web-b web-compose'); if (!isPlayer()) e.appendChild(personaSelect()); var inp = eln('input', 'web-compose-in'); inp.type = 'text'; inp.placeholder = b.placeholder || 'Leave a message…'; var btn = eln('button', 'web-btn', 'post'); btn.onclick = function () { var t = inp.value.trim(); if (!t) return; if (!isPlayer() && !posterHandle()) { App.prompt('Post as (net persona)', 'Handle', '', function (n) { addWebPersona(n); }); return; } postToBoard(key, ctx, { id: uid('post'), handle: posterHandle(), tag: '', body: t, ts: Date.now() }); inp.value = ''; }; e.appendChild(inp); e.appendChild(mentionBtn(function (tok) { insertAtCursor(inp, tok); })); e.appendChild(btn); return e; }
  function renderPresenceBlock(b, ctx) { var e = eln('div', 'web-b web-presence'); function paint() { var who = presenceFor(ctx.siteId); e.innerHTML = '<span class="web-presence-dot"></span> ' + esc(b.label || 'online') + ': ' + (who.length ? who.map(esc).join(', ') : '—'); } paint(); if (camp() && camp().onPresence) camp().onPresence(function () { paint(); }); return e; }

  // ── Direct messages (private, per-site) ──────────────────────────────
  // "Private" = UI-level: only participants' clients render a thread, and the
  // GM sees every thread (surveillance). Threads + messages live in the Yjs
  // net map (not persisted to disk); requires a live campaign (hasNet()).
  function onlinePlayers() { var c = camp(); if (!c || !c.getPeers) return []; var out = []; (c.getPeers() || []).forEach(function (st) { if (st && st.member && st.member.role === 'player') { var n = st.netHandle || st.member.name; if (n) out.push(n); } }); return out.filter(function (v, i, a) { return a.indexOf(v) === i; }); }
  function playerContacts(me) { var j = playerJson(); var cs = ((j && j.contacts) || []).map(function (c) { return c && (c.name || c.handle); }).filter(Boolean); var pl = onlinePlayers().filter(function (n) { return n !== me; }); return cs.concat(pl).filter(function (v, i, a) { return v && a.indexOf(v) === i; }); }
  function dmThreads(siteId) { return hasNet() ? (camp().getNetPosts('dmindex:' + siteId) || []) : []; }
  function saveDmThreads(siteId, arr) { if (hasNet() && camp().setNetBoard) camp().setNetBoard('dmindex:' + siteId, arr); }
  function dmThreadId(members) { return members.slice().sort().join('~'); }
  function ensureThread(siteId, members, group, title) { var id = dmThreadId(members); var arr = dmThreads(siteId); if (!arr.some(function (t) { return t.id === id; })) saveDmThreads(siteId, arr.concat([{ id: id, members: members, group: !!group, title: title || '' }])); return id; }
  function threadMsgs(siteId, id) { return hasNet() ? (camp().getNetPosts('dmt:' + siteId + ':' + id) || []) : []; }
  function sendDm(siteId, id, from, body) { if (hasNet()) camp().putNetPost('dmt:' + siteId + ':' + id, { id: uid('m'), from: from, body: body, ts: Date.now() }); }

  function renderMessengerBlock(b, ctx) {
    var siteId = ctx.siteId, player = isPlayer();
    var me = player ? ((playerJson() && (playerJson().handle || playerJson().name)) || 'me') : null;
    var e = eln('div', 'web-b web-msgr'); if (b.title) e.appendChild(eln('div', 'web-list-t', esc(b.title)));
    if (!hasNet()) { e.appendChild(eln('div', 'web-empty', 'Direct messages need a live campaign.')); return e; }
    var wrap = eln('div', 'web-msgr-wrap'); e.appendChild(wrap);
    var listEl = eln('div', 'web-msgr-list'), threadEl = eln('div', 'web-msgr-thread'); wrap.appendChild(listEl); wrap.appendChild(threadEl);
    var _open = null;
    function threadOf(id) { return dmThreads(siteId).filter(function (x) { return x.id === id; })[0]; }
    function myThreads() { var all = dmThreads(siteId); return player ? all.filter(function (t) { return (t.members || []).indexOf(me) >= 0; }) : all; }
    function currentFrom() { return player ? me : posterHandle(); }
    function gmAlignPersona() { if (player) return; var t = threadOf(_open); if (!t) return; var pls = onlinePlayers(); var npcSide = (t.members || []).filter(function (m) { return pls.indexOf(m) < 0; }); if (npcSide.length && npcSide.indexOf(posterHandle()) < 0) setPersona(npcSide[0]); }
    function paintList() {
      var ts = myThreads();
      listEl.innerHTML = '<div class="web-msgr-h"><span>Messages</span><button class="web-msgr-new">＋ new</button></div>' + (ts.length ? ts.map(function (t) { var others = (t.members || []).filter(function (m) { return m !== me; }); return '<button class="web-msgr-conv' + (_open === t.id ? ' on' : '') + '" data-t="' + esc(t.id) + '">' + esc(t.title || others.join(', ') || 'chat') + (t.group ? ' <span class="web-msgr-g">group</span>' : '') + '</button>'; }).join('') : '<div class="web-empty">No conversations.</div>');
      listEl.querySelector('.web-msgr-new').onclick = newConv;
      listEl.querySelectorAll('[data-t]').forEach(function (bt) { bt.onclick = function () { _open = bt.getAttribute('data-t'); gmAlignPersona(); paintList(); paintThread(); }; });
    }
    function paintThread() {
      if (!_open) { threadEl.innerHTML = '<div class="web-empty">Pick a conversation.</div>'; return; }
      var t = threadOf(_open); if (!t) { threadEl.innerHTML = ''; return; }
      var msgs = threadMsgs(siteId, _open), from = currentFrom();
      threadEl.innerHTML = '<div class="web-msgr-th-h">' + esc(t.title || (t.members || []).filter(function (m) { return m !== me; }).join(', ')) + '<span class="web-msgr-mem">' + esc((t.members || []).join(' · ')) + '</span></div>' +
        '<div class="web-msgr-msgs"></div>' +
        '<div class="web-msgr-compose"><input class="web-compose-in web-dm-in" placeholder="Message…"><button class="web-btn">send</button></div>';
      var msgsEl = threadEl.querySelector('.web-msgr-msgs');
      if (!msgs.length) msgsEl.appendChild(eln('div', 'web-empty', 'No messages yet.'));
      else { var prevf = null; msgs.forEach(function (p) { var d = eln('div', 'web-dm' + (p.from === from ? ' me' : '') + (p.from === prevf ? ' web-dm-cont' : '')); if (p.from !== prevf) { d.appendChild(eln('b', null, esc(p.from))); d.appendChild(document.createTextNode(' ')); } d.appendChild(setRich(eln('span'), p.body || '')); msgsEl.appendChild(d); prevf = p.from; }); }
      var inp = threadEl.querySelector('.web-dm-in'), btn = threadEl.querySelector('.web-btn'), cmp = threadEl.querySelector('.web-msgr-compose');
      if (!player) cmp.insertBefore(personaSelect(), cmp.firstChild);
      cmp.insertBefore(mentionBtn(function (tok) { insertAtCursor(inp, tok); }), btn);
      btn.onclick = function () { var v = inp.value.trim(); if (!v) return; var f = currentFrom(); if (!f) { alert('Pick a persona first (the “as” selector).'); return; } sendDm(siteId, _open, f, v); inp.value = ''; };
      inp.onkeydown = function (ev) { if (ev.key === 'Enter') btn.onclick(); };
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    function newConv() {
      var opts = player ? playerContacts(me) : onlinePlayers();
      if (!opts.length) { alert(player ? 'No contacts to message yet.' : 'No players online.'); return; }
      if (!window.UI) return;
      UI.modal({ title: 'New message', body: (player ? '' : '<p class="dt-hint">Writing as “' + esc(posterHandle() || 'pick a persona first') + '”.</p>') + '<div class="lk-picker-res">' + opts.map(function (n, i) { return '<label class="web-msgr-pick"><input type="checkbox" data-r="' + i + '"> ' + esc(n) + '</label>'; }).join('') + '</div><label class="rt-field" style="margin-top:8px"><span class="rt-field-l">Group title (optional)</span><input class="rt-input" id="nc-title"></label>', actions: [{ label: 'Cancel' }, { label: 'Start', kind: 'primary', onClick: function (box) {
        var picked = []; box.querySelectorAll('[data-r]:checked').forEach(function (c) { picked.push(opts[+c.getAttribute('data-r')]); }); if (!picked.length) return;
        var sender = player ? me : posterHandle(); if (!sender) { alert('Pick a persona first (the “as” selector on the compose bar).'); return; }
        var members = [sender].concat(picked).filter(function (v, i, a) { return v && a.indexOf(v) === i; }); if (members.length < 2) return;
        _open = ensureThread(siteId, members, members.length > 2, (box.querySelector('#nc-title').value || '').trim()); paintList(); paintThread();
      } }] });
    }
    paintList(); paintThread();
    if (camp().onNetChange) camp().onNetChange(function () { paintList(); paintThread(); });
    return e;
  }

  /* ═══════════════ block tree: widths + containers ═══════════════ */
  var WEB_WIDTHS = [['full', 'full'], ['1-2', '½'], ['1-3', '⅓'], ['2-3', '⅔'], ['1-4', '¼']];
  var CONTAINER_TYPES = ['columns', 'card', 'panel', 'section', 'details', 'table', 'tabs'];
  function isContainer(type) { return CONTAINER_TYPES.indexOf(type) >= 0; }
  function colCount(b) { return Math.max(2, Math.min(4, parseInt(b.cols, 10) || 2)); }
  function tabLabels(b) { var l = lines(b.tabLabels); return l.length ? l : ['Tab 1', 'Tab 2']; }
  function slotDefs(b) {
    switch (b.type) {
      case 'columns': { var n = colCount(b), out = []; for (var i = 0; i < n; i++) out.push({ key: 'c' + i, label: 'Col ' + (i + 1) }); return out; }
      case 'table': { var r = Math.max(1, parseInt(b.rows, 10) || 2), cc = Math.max(1, parseInt(b.cols, 10) || 2), o = []; for (var y = 0; y < r; y++) for (var x = 0; x < cc; x++) o.push({ key: 'r' + y + 'c' + x, label: 'R' + (y + 1) + '·C' + (x + 1) }); return o; }
      case 'tabs': return tabLabels(b).map(function (t, i) { return { key: 'tab' + i, label: t }; });
      default: return [{ key: 'body', label: 'Body' }];
    }
  }
  function ensureSlots(b) { b.slots = b.slots || {}; slotDefs(b).forEach(function (s) { if (!Array.isArray(b.slots[s.key])) b.slots[s.key] = []; }); return b.slots; }
  function mkTextBlock(t) { return { id: uid('b'), type: 'text', body: t || '' }; }
  function migrateBlock(b) {
    if (!b || b._mig) return b;
    if (b.type === 'columns' && !b.slots) { var n = colCount(b); b.slots = {}; ['a', 'b', 'c'].forEach(function (k, i) { if (i < n) b.slots['c' + i] = (b[k] != null && b[k] !== '') ? [mkTextBlock(b[k])] : []; delete b[k]; }); }
    if (b.type === 'card' && !b.slots) { b.slots = { body: (b.body != null && b.body !== '') ? [mkTextBlock(b.body)] : [] }; delete b.body; }
    if (isContainer(b.type)) ensureSlots(b);
    b._mig = true; return b;
  }
  function listInSubtree(block, list) { if (!block || !block.slots) return false; return Object.keys(block.slots).some(function (k) { var arr = block.slots[k]; if (arr === list) return true; return (arr || []).some(function (ch) { return listInSubtree(ch, list); }); }); }
  /* ═══════════════ Block textures & per-block fonts ═══════════════ */
  var WEB_FONTS = [['preset default', ''], ['Sans', 'var(--font-sans, sans-serif)'], ['Mono', 'var(--font-mono, monospace)'], ['Serif', 'Georgia, "Times New Roman", serif'], ['Display', 'Impact, Haettenschweiler, sans-serif'], ['Typewriter', '"Courier New", Courier, monospace'], ['Terminal', '"Lucida Console", Monaco, monospace'], ['Verdana', 'Verdana, Geneva, sans-serif'], ['Trebuchet', '"Trebuchet MS", Helvetica, sans-serif'], ['Times', '"Times New Roman", Times, serif'], ['Palatino', '"Palatino Linotype", "Book Antiqua", serif'], ['Comic', '"Comic Sans MS", cursive'], ['Marker', '"Bradley Hand", "Comic Sans MS", cursive'], ['Wide', '"Arial Black", Gadget, sans-serif'], ['Tahoma', 'Tahoma, Geneva, sans-serif']];
  var _texCache = null;
  function loadTextures(cb) { if (_texCache) return cb(_texCache); fetch('img/webtextures/index.json').then(function (r) { return r.json(); }).then(function (a) { _texCache = Array.isArray(a) ? a : []; cb(_texCache); }).catch(function () { _texCache = []; cb(_texCache); }); }
  function texUrl(t) { return !t ? '' : (t.indexOf('data:') === 0 ? t : 'img/webtextures/' + encodeURIComponent(t)); }
  function applyBlockStyle(el, b) {
    if (!el || !b) return;
    if (b.font) el.style.fontFamily = b.font;
    var bg = b.bg; if (!bg || !bg.tex) return;
    var url = texUrl(bg.tex); if (!url) return;
    var layers = [], sizes = [], reps = [];
    if (bg.scrim === 'light') { layers.push('linear-gradient(rgba(255,255,255,.82),rgba(255,255,255,.82))'); sizes.push('auto'); reps.push('repeat'); }
    else if (bg.scrim === 'dark') { layers.push('linear-gradient(rgba(8,8,10,.72),rgba(8,8,10,.72))'); sizes.push('auto'); reps.push('repeat'); }
    layers.push('url("' + url + '")'); sizes.push(bg.mode === 'cover' ? 'cover' : 'auto'); reps.push(bg.mode === 'cover' ? 'no-repeat' : 'repeat');
    el.style.backgroundImage = layers.join(', '); el.style.backgroundSize = sizes.join(', '); el.style.backgroundRepeat = reps.join(', '); el.style.backgroundPosition = 'center';
    el.classList.add('web-bw-textured'); if (bg.scrim === 'dark') el.classList.add('web-bw-ondark');
  }
  function pickBlockStyle(b, cb) {
    if (!window.UI) return; b.bg = b.bg || {};
    var sel = b.bg.tex || '';
    loadTextures(function (texs) {
      var grid = '<div class="tex-grid"><button class="tex-cell tex-none' + (!sel ? ' active' : '') + '" data-tex="">none</button>' +
        texs.map(function (f) { return '<button class="tex-cell' + (sel === f ? ' active' : '') + '" data-tex="' + esc(f) + '" title="' + esc(f) + '" style="background-image:url(&quot;' + texUrl(f) + '&quot;)"></button>'; }).join('') + '</div>';
      UI.modal({ title: 'Background & font', size: 'wide',
        body: '<div class="rt-field-l" style="margin-bottom:4px">Texture library</div>' + grid +
          '<div class="tex-drop" id="tex-drop">▽ drop your own image here</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' +
            '<label class="rt-field"><span class="rt-field-l">Fit</span><select class="rt-select" id="tex-mode"><option value="tile"' + (b.bg.mode !== 'cover' ? ' selected' : '') + '>tile</option><option value="cover"' + (b.bg.mode === 'cover' ? ' selected' : '') + '>cover</option></select></label>' +
            '<label class="rt-field"><span class="rt-field-l">Scrim (readability)</span><select class="rt-select" id="tex-scrim"><option value="none">none</option><option value="light"' + (b.bg.scrim === 'light' ? ' selected' : '') + '>light</option><option value="dark"' + (b.bg.scrim === 'dark' ? ' selected' : '') + '>dark</option></select></label>' +
            '<label class="rt-field"><span class="rt-field-l">Font</span><select class="rt-select" id="tex-font">' + WEB_FONTS.map(function (op) { return '<option value="' + esc(op[1]) + '"' + ((b.font || '') === op[1] ? ' selected' : '') + '>' + esc(op[0]) + '</option>'; }).join('') + '</select></label>' +
          '</div>',
        actions: [{ label: 'Cancel' }, { label: 'Apply', kind: 'primary', onClick: function (box) {
          b.bg = { tex: sel, mode: box.querySelector('#tex-mode').value, scrim: box.querySelector('#tex-scrim').value };
          if (b.bg.scrim === 'none') delete b.bg.scrim;
          if (!b.bg.tex) b.bg = null;
          var fnt = box.querySelector('#tex-font').value; if (fnt) b.font = fnt; else delete b.font;
          if (cb) cb();
        } }],
        onShow: function (box) {
          box.querySelectorAll('[data-tex]').forEach(function (btn) { btn.onclick = function () { box.querySelectorAll('[data-tex]').forEach(function (x) { x.classList.remove('active'); }); btn.classList.add('active'); sel = btn.getAttribute('data-tex'); }; });
          var drop = box.querySelector('#tex-drop');
          drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
          drop.ondragleave = function () { drop.classList.remove('over'); };
          drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('over'); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { sel = rd.result; box.querySelectorAll('[data-tex]').forEach(function (x) { x.classList.remove('active'); }); drop.textContent = '✓ custom image loaded'; }; rd.readAsDataURL(f); };
        }
      });
    });
  }
  function renderBlocks(list, ctx) { var wrap = eln('div', 'web-blocks'); (list || []).forEach(function (b) { var node = renderOneBlock(b, ctx); if (!node) return; var bw = eln('div', 'web-bw web-w-' + (b.w || 'full')); bw.appendChild(node); applyBlockStyle(bw, b); wrap.appendChild(bw); }); return wrap; }
  function renderOneBlock(b, ctx) { migrateBlock(b); if (ctx && b.access && (ctx.level || 0) < b.access) return b.accHide ? null : redactedBlock(); if (ctx && ctx.adblock && b.type === 'ad') return null; if (ctx && ctx.power != null && ctx.power < blockMinPower(b.type)) return degradedBlock(b); if (isContainer(b.type)) return renderContainer(b, ctx); var def = blockRegistry[b.type]; if (!def) return null; try { return def.render(b, ctx); } catch (e) { return null; } }
  function renderContainer(b, ctx) {
    ensureSlots(b); var t = b.type, slots = b.slots, e;
    if (t === 'columns') { var n = colCount(b); e = eln('div', 'web-b web-cols web-cols-' + n); for (var i = 0; i < n; i++) { var col = eln('div', 'web-col'); col.appendChild(renderBlocks(slots['c' + i], ctx)); e.appendChild(col); } return e; }
    if (t === 'card') { e = eln('div', 'web-b web-card web-card-br-' + (b.border || 'box') + (b.tint ? ' web-card-tint' : '')); if (b.title) { var ti = eln('div', 'web-card-t', esc(b.title)); if (b.accent) ti.style.color = 'var(--web-accent)'; e.appendChild(ti); } e.appendChild(renderBlocks(slots.body, ctx)); return e; }
    if (t === 'panel') { e = eln('div', 'web-b web-panel' + (b.tone === 'accent' ? ' web-panel-acc' : '')); if (b.title) e.appendChild(eln('div', 'web-panel-h', esc(b.title))); var pb = eln('div', 'web-panel-b'); pb.appendChild(renderBlocks(slots.body, ctx)); e.appendChild(pb); return e; }
    if (t === 'section') { e = eln('div', 'web-b web-section web-pad-' + (b.pad || 'm')); if (b.bg) { e.style.backgroundImage = 'url(' + b.bg + ')'; e.classList.add('web-section-bg'); } if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title))); e.appendChild(renderBlocks(slots.body, ctx)); return e; }
    if (t === 'details') { e = eln('details', 'web-b web-details'); if (b.open) e.open = true; e.appendChild(eln('summary', null, esc(b.summary || 'Details'))); e.appendChild(renderBlocks(slots.body, ctx)); return e; }
    if (t === 'table') return renderTableC(b, ctx);
    if (t === 'tabs') return renderTabsC(b, ctx);
    return eln('div', 'web-b');
  }
  function renderTableC(b, ctx) {
    var r = Math.max(1, parseInt(b.rows, 10) || 2), cc = Math.max(1, parseInt(b.cols, 10) || 2);
    var tbl = eln('table', 'web-gridtable' + (b.borders ? ' web-gt-bord' : '')), tb = eln('tbody');
    for (var y = 0; y < r; y++) { var tr = eln('tr'); for (var x = 0; x < cc; x++) { var isHead = b.head && y === 0; var cell = eln(isHead ? 'th' : 'td'); cell.appendChild(renderBlocks(b.slots['r' + y + 'c' + x] || [], ctx)); tr.appendChild(cell); } tb.appendChild(tr); }
    tbl.appendChild(tb); var w = eln('div', 'web-b web-gtwrap'); w.appendChild(tbl); return w;
  }
  function renderTabsC(b, ctx) {
    var defs = slotDefs(b), e = eln('div', 'web-b web-tabs'), nav = eln('div', 'web-tabs-nav'), body = eln('div', 'web-tabs-body');
    defs.forEach(function (d, i) {
      var btn = eln('button', 'web-tabs-t' + (i === 0 ? ' on' : ''), esc(d.label)), pane = eln('div', 'web-tabs-pane' + (i === 0 ? ' on' : ''));
      pane.appendChild(renderBlocks(b.slots[d.key] || [], ctx));
      btn.onclick = function () { nav.querySelectorAll('.web-tabs-t').forEach(function (x) { x.classList.remove('on'); }); body.querySelectorAll('.web-tabs-pane').forEach(function (x) { x.classList.remove('on'); }); btn.classList.add('on'); pane.classList.add('on'); };
      nav.appendChild(btn); body.appendChild(pane);
    });
    e.appendChild(nav); e.appendChild(body); return e;
  }

  /* ═══════════════ data mentions (link data anywhere) ═══════════════ */
  // Token in prose: ⟦type:id|Label⟧ . Chips resolve to a public diegetic site
  // if one exists & is reachable; otherwise they REVEAL the record to the
  // player (a way to hand out intel in-world) who can save it to their files.
  var MENTION_TYPES = ['npc', 'org', 'location', 'shop', 'item', 'squad'];
  var TYPE_LABELS = { npc: 'Person', org: 'Organisation', location: 'Location', shop: 'Shop', item: 'Item', squad: 'Crew', clock: 'Clock', site: 'Site' };
  var MENTION_RE = /⟦([a-z]+):([^|⟧]+)(?:\|([^⟧]*))?⟧/g;
  function hasMentions(str) { MENTION_RE.lastIndex = 0; return MENTION_RE.test(String(str == null ? '' : str)); }
  function renderRichText(str) {
    var frag = document.createDocumentFragment(); str = String(str == null ? '' : str); var last = 0, m; MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(str))) {
      if (m.index > last) frag.appendChild(document.createTextNode(str.slice(last, m.index)));
      var a = eln('a', 'web-chip', esc(m[3] || m[2])); a.href = '#'; a.setAttribute('data-entity', m[1] + ':' + m[2]);
      frag.appendChild(a); last = m.index + m[0].length;
    }
    if (last < str.length) frag.appendChild(document.createTextNode(str.slice(last)));
    return frag;
  }
  function setRich(el, str) { el.textContent = ''; el.appendChild(renderRichText(str)); return el; }
  // Robust catch-all: after a site renders, turn any remaining raw ⟦…⟧ token in
  // any text node into a chip — so mentions work in EVERY block/field, not just
  // the ones whose renderer calls setRich().
  function richifyTextNodes(root) {
    if (!root || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, targets = [];
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || n.nodeValue.indexOf('⟦') < 0) continue;
      var p = n.parentNode, tag = p && p.tagName;
      if (!p || tag === 'TEXTAREA' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION' || (p.classList && p.classList.contains('web-chip'))) continue;
      targets.push(n);
    }
    targets.forEach(function (tn) { if (tn.parentNode) tn.parentNode.replaceChild(renderRichText(tn.nodeValue), tn); });
  }
  function sanitizeLabel(s) { return String(s || '').replace(/[⟦⟧|]/g, '').trim(); }
  function pickMention(done) {
    // Players may also link the sites they know; GMs link the campaign records as before.
    var types = isPlayer() ? MENTION_TYPES.concat(['site']) : MENTION_TYPES;
    pickFromTypes(types, 'Insert a data link', function (ref) { if (!ref) { done(null); return; } Store.resolve(ref).then(function (hit) { done('⟦' + ref.type + ':' + ref.id + '|' + (sanitizeLabel(hit ? Store.displayName(hit) : ref.id) || ref.id) + '⟧'); }).catch(function () { done('⟦' + ref.type + ':' + ref.id + '|' + ref.id + '⟧'); }); });
  }
  function insertAtCursor(el, text) { var s = el.selectionStart, e = el.selectionEnd; if (s == null) { el.value = (el.value || '') + text; return; } var v = el.value || ''; el.value = v.slice(0, s) + text + v.slice(e); el.selectionStart = el.selectionEnd = s + text.length; el.focus(); }
  function mentionBtn(onInsert) { var b = eln('button', 'web-mention-b'); b.type = 'button'; b.textContent = '@'; b.title = 'insert a data link'; b.onclick = function () { pickMention(function (tok) { if (tok) onInsert(tok); }); }; return b; }
  function openEntityChip(spec) {
    var i = spec.indexOf(':'); if (i < 0) return; var type = spec.slice(0, i), id = spec.slice(i + 1);
    // A direct site link (⟦site:id⟧, players linking a known site) → open that site.
    if (type === 'site') {
      Store.resolve({ type: 'site', id: id }).then(function (hit) {
        if (!hit) { revealEntity(type, id); return; }
        if (isPlayer() && !(Store.visibleToPlayers(hit.json) && connectable(hit.json, effectiveReach(playerJson())))) { if (window.UI) UI.modal({ title: 'Out of reach', body: '<p class="dt-hint">Your device can’t reach that site right now.</p>', actions: [{ label: 'OK', kind: 'primary' }] }); return; }
        if (window.Shell) Shell.openTool('web-browse'); var u = siteUrl(hit.json); setTimeout(function () { navTo(u); }, 60);
      }).catch(function () {});
      return;
    }
    Store.index('site').then(function (rows) {
      var openable = rows.filter(function (r) { var s = r.json.subject; return s && s.type === type && s.id === id && r.json.props && r.json.props.public; }).filter(function (r) { return isPlayer() ? (Store.visibleToPlayers(r.json) && connectable(r.json, effectiveReach(playerJson()))) : true; })[0];
      if (openable) { if (window.Shell) Shell.openTool('web-browse'); var u = siteUrl(openable.json); setTimeout(function () { navTo(u); }, 60); return; }
      revealEntity(type, id);
    }).catch(function () { revealEntity(type, id); });
  }
  function revealEntity(type, id) {
    if (!window.UI) return;
    Store.resolve({ type: type, id: id }).then(function (hit) {
      if (!hit) { UI.modal({ title: 'Dead link', body: '<p class="dt-hint">That record is no longer available.</p>', actions: [{ label: 'OK', kind: 'primary' }] }); return; }
      var j = hit.json, name = Store.displayName(hit), img = j.photo || j.logo || j.img || j.image || '', desc = j.tagline || j.role || j.summary || j.blurb || j.desc || '';
      var body = (img ? '<img class="web-reveal-img" src="' + esc(img) + '">' : '') + '<div class="web-reveal-ty">' + esc(TYPE_LABELS[type] || type) + '</div>' + (desc ? '<p class="web-reveal-d">' + esc(desc) + '</p>' : '<p class="dt-hint">No further details on file.</p>');
      var actions = [{ label: 'Close' }];
      if (isPlayer()) {
        if (type === 'npc') actions.push({ label: '＋ Contacts', onClick: function () { if (addToContacts(name, desc, j.org || '') && br().logSession) br().logSession('☎ Added contact: ' + name); } });
        if (deviceHasPerk(playerJson(), 'ai')) { addToFiles({ type: type, id: id, name: name, img: img, desc: desc }); body += '<p class="web-reveal-ai">✓ Auto-filed by your AI copilot.</p>'; if (br().logSession) br().logSession('AI filed: ' + name); }
        actions.push({ label: '＋ Files', kind: 'primary', onClick: function () { addToFiles({ type: type, id: id, name: name, img: img, desc: desc }); if (br().logSession) br().logSession('Filed: ' + name); } });
      } else actions.push({ label: 'Open record', kind: 'primary', onClick: function () { if (window.App) App.emit('open:entity', { ref: { type: type, id: id } }); } });
      UI.modal({ title: name, body: body, actions: actions });
    }).catch(function () {});
  }
  function addToFiles(entry) { webSave(function (net) { net.intel = net.intel || []; if (!net.intel.some(function (x) { return x.type === entry.type && x.id === entry.id; })) net.intel.push({ type: entry.type, id: entry.id, name: entry.name, img: entry.img || '', desc: entry.desc || '', ts: netClock ? netClock() : 0 }); }); }
  function sheetSave(mut) { if (!isPlayer()) return false; var j = playerJson(); if (!j) return false; mut(j); publishPlayer(j); return true; }
  function addToContacts(name, desc, org) { return sheetSave(function (j) { j.contacts = j.contacts || []; if (j.contacts.some(function (c) { return (c.name || '').toLowerCase() === (name || '').toLowerCase(); })) return; j.contacts.push({ id: uid('ct'), name: name, type: 'Other', attitude: 'Neutral', org: org || '', description: desc || '' }); }); }
  var _chipWired = false;
  function wireChipClicks() { if (_chipWired) return; _chipWired = true; document.addEventListener('click', function (e) { var a = e.target && e.target.closest ? e.target.closest('.web-chip') : null; if (!a) return; e.preventDefault(); openEntityChip(a.getAttribute('data-entity') || ''); }); }

  /* ═══════════════ auth / clearance (corpo sites) ═══════════════ */
  // Linear clearance: level 0 = Public. Accounts (user/pass → level) are defined
  // on the site by the GM; players type credentials they discover in-world. Login
  // session lives on the player's sheet (net.auth) → syncs → GM can watch.
  var _gmView = {}; // GM-only, ephemeral: siteId → clearance to preview as (null = see all)
  function ensureAuth(json) { if (!json.auth) json.auth = { enabled: false, wall: false, levels: ['Public'], accounts: [] }; if (!json.auth.levels || !json.auth.levels.length) json.auth.levels = ['Public']; if (!json.auth.accounts) json.auth.accounts = []; return json.auth; }
  function siteLevels(json) { return ensureAuth(json).levels; }
  function levelName(json, i) { var l = siteLevels(json); return l[i] || ('Level ' + i); }
  function netAuthMap() { var w = webGet(); return w.auth || {}; }
  function authAccount(json) { return netAuthMap()[json.id] || null; }
  function authLevelFor(json) { if (!isPlayer()) return 999; var a = netAuthMap()[json.id]; return (a && a.level) || 0; }
  function doLogin(json, user, pass) { var acc = (ensureAuth(json).accounts || []).filter(function (a) { return (a.user || '') === user && (a.pass || '') === pass; })[0]; if (!acc) return -1; webSave(function (net) { net.auth = net.auth || {}; net.auth[json.id] = { level: acc.level || 0, user: acc.user, accountId: acc.id }; }); return acc.level || 0; }
  function doLogout(json) { webSave(function (net) { if (net.auth) delete net.auth[json.id]; }); }
  function repaintSite(ctx) { if (ctx && ctx.host) renderSite(ctx.host, ctx.siteJson, { siteId: ctx.siteId, page: ctx.page, host: ctx.host, subject: ctx.subject }); }
  function redactedBlock() { var e = eln('div', 'web-b web-redacted'); e.appendChild(eln('span', 'web-redacted-bar', '████████ CLASSIFIED ████████')); return e; }
  function degradedBlock(b) { var e = eln('div', 'web-b web-degraded'); e.appendChild(eln('div', 'web-degraded-bar', '▓▓ INSUFFICIENT BANDWIDTH')); e.appendChild(eln('div', 'web-degraded-sub', 'This ' + esc(b.type || 'block') + ' won’t render on your device — a machine with more Power would.')); return e; }
  function webDarkScreen() { var e = eln('div', 'web-dark'); e.innerHTML = '<div class="web-dark-in"><div class="web-dark-glyph">⚠</div><div class="web-dark-h">THE NET IS DARK</div><div class="web-dark-p">You have no device that can connect. Get a computer or jack a cyberdeck, then set it active in your sheet’s <b>Computer &amp; Web</b> section.</div></div>'; return e; }
  function appTooWeak(json) { var e = eln('div', 'web-empty web-appweak'); e.innerHTML = '<div class="web-degraded-bar">▓▓ DEVICE TOO WEAK</div><div class="web-appweak-p">“' + esc((json && json.name) || 'This app') + '” needs more processing power than your machine has. A better computer will run it.</div>'; return e; }
  function renderAuthBar(json, eff, ctx) {
    var bar = eln('div', 'web-authbar');
    if (!isPlayer()) {
      bar.appendChild(eln('span', 'web-authbar-s', '🛠 GM'));
      var vsel = eln('select', 'web-authbar-view'); var cur = _gmView[json.id];
      vsel.innerHTML = '<option value="all"' + (cur == null ? ' selected' : '') + '>view: all clearances</option>' + siteLevels(json).map(function (lv, i) { return '<option value="' + i + '"' + (cur === i ? ' selected' : '') + '>view as: ' + esc(lv) + '</option>'; }).join('');
      vsel.onchange = function () { _gmView[json.id] = (vsel.value === 'all') ? null : (+vsel.value); repaintSite(ctx); };
      bar.appendChild(vsel); return bar;
    }
    var acc = authAccount(json);
    if (acc) { bar.appendChild(eln('span', 'web-authbar-s', '🔓 ' + esc(acc.user) + ' · ' + esc(levelName(json, acc.level || 0)))); var out = eln('button', 'web-authbar-b', 'log out'); out.onclick = function () { doLogout(json); repaintSite(ctx); }; bar.appendChild(out); }
    else { bar.appendChild(eln('span', 'web-authbar-s', '🔒 not signed in')); var lin = eln('button', 'web-authbar-b', 'log in'); lin.onclick = function () { promptLogin(json, ctx); }; bar.appendChild(lin); }
    return bar;
  }
  function loginForm(json, ctx, onDone) {
    var wrap = eln('div', 'web-login-form');
    var u = eln('input', 'web-login-in'); u.placeholder = 'user'; u.autocomplete = 'off';
    var p = eln('input', 'web-login-in'); p.type = 'password'; p.placeholder = 'password';
    var btn = eln('button', 'web-btn', 'Sign in'), err = eln('div', 'web-login-err');
    btn.onclick = function () { var lvl = doLogin(json, u.value.trim(), p.value); if (lvl < 0) { err.textContent = 'ACCESS DENIED'; return; } if (onDone) onDone(); else repaintSite(ctx); };
    p.onkeydown = function (ev) { if (ev.key === 'Enter') btn.onclick(); };
    [u, p, btn, err].forEach(function (x) { wrap.appendChild(x); });
    return wrap;
  }
  function renderLoginScreen(json, ctx) {
    var e = eln('div', 'web-loginscreen'), box = eln('div', 'web-login-box');
    box.appendChild(eln('div', 'web-login-h', esc(json.name || 'Secure system')));
    box.appendChild(eln('div', 'web-login-sub', 'Authentication required'));
    box.appendChild(loginForm(json, ctx));
    e.appendChild(box); return e;
  }
  function renderLockedPage(json, page) {
    var e = eln('div', 'web-locked');
    e.appendChild(eln('div', 'web-locked-h', '🔒 Clearance required'));
    e.appendChild(eln('p', null, 'This section needs <b>' + esc(levelName(json, page.access || 0)) + '</b> clearance.'));
    var a = eln('a', 'web-nav-link', '← Home'); a.href = '#'; a.setAttribute('data-goto', pageUrl(json, homePage(json))); e.appendChild(a);
    return e;
  }
  function promptLogin(json, ctx) {
    if (!window.UI) return;
    UI.modal({ title: 'Sign in — ' + (json.name || ''), body: '<label class="rt-field"><span class="rt-field-l">User</span><input class="rt-input" id="lg-u" autocomplete="off"></label><label class="rt-field"><span class="rt-field-l">Password</span><input class="rt-input" id="lg-p" type="password"></label><div id="lg-err" class="web-login-err"></div>', actions: [{ label: 'Cancel' }, { label: 'Sign in', kind: 'primary', onClick: function (box) { var lvl = doLogin(json, box.querySelector('#lg-u').value.trim(), box.querySelector('#lg-p').value); if (lvl < 0) { box.querySelector('#lg-err').textContent = 'Access denied.'; return false; } repaintSite(ctx); } }], onShow: function (box) { box.querySelector('#lg-u').focus(); } });
  }

  /* ═══════════════ chat apps (bespoke sites, no blocks — real HTML) ═══════════════ */
  // A site with json.app = <id> renders a hand-built app UI instead of blocks.
  // They reuse the live plumbing (Yjs board/DM, presence, personas, mentions).
  var APP_RENDERERS = {};
  function siteAppId(json) { return json && json.app && APP_RENDERERS[json.app] ? json.app : null; }
  function caMe() { return isPlayer() ? ((playerJson() && (playerJson().handle || playerJson().name)) || 'me') : null; }
  function caFrom() { return isPlayer() ? caMe() : posterHandle(); }
  function caGmAlign(t) { if (isPlayer()) return; var pls = onlinePlayers(); var npc = (t.members || []).filter(function (m) { return pls.indexOf(m) < 0; }); if (npc.length && npc.indexOf(posterHandle()) < 0) setPersona(npc[0]); }
  function caMsgEl(p, mine, showName) { var who = p.handle || p.from || 'anon'; var d = eln('div', 'ca-msg' + (who === mine ? ' me' : '') + (showName ? '' : ' ca-cont')); if (showName) d.appendChild(eln('span', 'ca-msg-h', esc(who))); d.appendChild(setRich(eln('span', 'ca-msg-b'), p.body || '')); return d; }
  // Render a run of messages, hiding the author name on consecutive same-author lines.
  function caFillMsgs(container, posts, mine) { var prev = null; (posts || []).forEach(function (p) { var who = p.handle || p.from; container.appendChild(caMsgEl(p, mine, who !== prev)); prev = who; }); container.scrollTop = container.scrollHeight; }
  function caComposeBar(onSend) {
    var bar = eln('div', 'ca-compose'); if (!isPlayer()) bar.appendChild(personaSelect());
    var inp = eln('input', 'ca-in'); inp.placeholder = 'Message…'; bar.appendChild(inp);
    bar.appendChild(mentionBtn(function (tok) { insertAtCursor(inp, tok); }));
    var btn = eln('button', 'ca-send', 'send');
    function go() { var v = inp.value.trim(); if (!v) return; if (onSend(v) !== false) inp.value = ''; }
    btn.onclick = go; inp.onkeydown = function (e) { if (e.key === 'Enter') go(); }; bar.appendChild(btn); return bar;
  }
  function caPostChan(json, key, body) { var h = posterHandle(); if (!isPlayer() && !h) { App.prompt('Post as (net persona)', 'Handle', '', function (n) { addWebPersona(n); }); return false; } postToBoard(key, { siteId: json.id, siteJson: json, page: homePage(json) }, { id: uid('post'), handle: h, tag: '', body: body, ts: netClock ? netClock() : 0 }); return true; }
  function caNewDM(json, me, done) {
    // GM chooses who they write AS (from personas / contacts / NPCs) first, then picks recipients.
    if (isPlayer()) return caNewDMRecipients(json, me, done);
    pickPersonaRich(function (n) { if (!n) return; addWebPersona(n); caNewDMRecipients(json, me, done); });
  }
  function caNewDMRecipients(json, me, done) {
    var opts = isPlayer() ? playerContacts(me) : onlinePlayers(); if (!opts.length) { alert(isPlayer() ? 'No contacts to message yet.' : 'No players online.'); return; }
    if (!window.UI) return;
    amodal({ title: isPlayer() ? 'New message' : 'New message — as ' + (posterHandle() || '?'), body: '<div class="lk-picker-res">' + opts.map(function (n, i) { return '<label class="web-msgr-pick"><input type="checkbox" data-r="' + i + '"> ' + esc(n) + '</label>'; }).join('') + '</div>', actions: [{ label: 'Cancel' }, { label: 'Start', kind: 'primary', onClick: function (box) {
      var picked = []; box.querySelectorAll('[data-r]:checked').forEach(function (c) { picked.push(opts[+c.getAttribute('data-r')]); }); if (!picked.length) return;
      var sender = isPlayer() ? me : posterHandle(); if (!sender) { alert('Choose who you write as.'); return; }
      var members = [sender].concat(picked).filter(function (v, i, a) { return v && a.indexOf(v) === i; }); if (members.length < 2) return; done(ensureThread(json.id, members, members.length > 2, ''));
    } }] });
  }
  function caMyThreads(json, me) { return dmThreads(json.id).filter(function (t) { return isPlayer() ? (t.members || []).indexOf(me) >= 0 : true; }); }

  // ── shared app framework: accounts · onboarding · about · subscription · ads ──
  var APP_META = {
    'corpo-msg': { about: 'AraNet — secure corporate messaging for verified personnel.', nameLabel: 'full name (on record)', premium: true, premiumName: 'AraNet+', premiumPitch: 'Unlock the full suite.', perks: ['Create your own channels', 'Read receipts', 'Unlimited history'], cost: 50, price: '50eb / month' },
    'runner-comms': { about: 'BLACKICE — encrypted dead-drop comms. Handles only. Trust no one.', nameLabel: 'legal name (never shown)', premium: true, premiumName: 'GHOST tier', premiumPitch: 'Go darker.', perks: ['Burn channels after reading', 'Rotating handles', 'Metadata scrubbing'], cost: 200, price: '200eb / month' },
    'consumer': { about: 'PONY — chat with everyone. Fast, free, fun.', nameLabel: 'name', cta: 'Sign up', ads: true, premium: true, premiumName: 'PONY Gold', premiumPitch: 'Ditch the ads.', perks: ['No ads', 'Bigger groups', 'Custom stickers'], cost: 10, price: '10eb / month' },
    'elite': { about: 'VELVET — the room where it happens. By invitation only.', nameLabel: 'legal name', cta: 'Request access', premium: true, premiumName: 'Membership', premiumPitch: 'The city’s power brokers, one message away.', perks: ['Access to the lounges', 'Verified elite badge', 'Concierge desk'], cost: 500, price: '500eb / month' },
    'public': { about: 'NC PUBLIC ACCESS — a service of the Night City Municipal Government. Free to all citizens.', nameLabel: 'citizen ID / name', cta: 'Register', premium: false }
  };
  function appAcct(appId) { var w = webGet(); return (w.apps && w.apps[appId]) || null; }
  function appHandleFor(appId) { if (!isPlayer()) return posterHandle(); var a = appAcct(appId); return (a && a.handle) || caMe(); }
  function appSignup(appId, name, handle) { webSave(function (net) { net.apps = net.apps || {}; net.apps[appId] = { name: name || '', handle: handle || 'user', joined: netClock ? netClock() : 0, premium: false }; }); }
  function appSetPremium(appId, v) { webSave(function (net) { if (net.apps && net.apps[appId]) net.apps[appId].premium = v; }); }
  function appIsPremium(appId) { if (!isPlayer()) return true; var a = appAcct(appId); return !!(a && a.premium); }
  // A web subscription becomes a real monthly service on the sheet (paid in eb),
  // tagged with the app/site so it links back. Sign-out / cancel removes it.
  function appDoSubscribe(json, meta) {
    if (!isPlayer()) { appSetPremium(json.app, true); return; }
    sheetSave(function (j) {
      j.net = j.net || {}; j.net.apps = j.net.apps || {}; if (j.net.apps[json.app]) j.net.apps[json.app].premium = true;
      j.lifestyle = j.lifestyle || {}; j.lifestyle.services = j.lifestyle.services || [];
      if (!j.lifestyle.services.some(function (s) { return s.app === json.app; })) j.lifestyle.services.push({ name: (meta.premiumName || 'Subscription') + ' — ' + (json.name || 'app'), cost: meta.cost || 0, app: json.app, siteId: json.id });
    });
    if (br().logSession) br().logSession('💳 Subscribed to ' + (json.name || 'app') + ' (' + (meta.cost || 0) + 'eb/mo)');
  }
  function appUnsubscribe(json) { if (!isPlayer()) return; sheetSave(function (j) { if (j.net && j.net.apps && j.net.apps[json.app]) j.net.apps[json.app].premium = false; if (j.lifestyle && j.lifestyle.services) j.lifestyle.services = j.lifestyle.services.filter(function (s) { return s.app !== json.app; }); }); }
  // In-site modal: mounts into the current app (themed with --web-*), not the tool's
  // inked UI.modal. _capHost tracks the app host; null on ordinary block-sites → falls back.
  var _capHost = null;
  function appModal(host, opts) {
    var ov = eln('div', 'capp-modal-ov'), box = eln('div', 'capp-modal');
    if (opts.title) box.appendChild(eln('div', 'capp-modal-h', esc(opts.title)));
    var body = eln('div', 'capp-modal-b'); if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body); box.appendChild(body);
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    if (opts.actions && opts.actions.length) { var acts = eln('div', 'capp-modal-acts'); opts.actions.forEach(function (a) { var b = eln('button', 'capp-modal-btn' + (a.kind === 'primary' ? ' primary' : a.kind === 'danger' ? ' danger' : ''), a.label); b.onclick = function () { var keep = a.onClick && a.onClick(box) === false; if (!keep && a.dismiss !== false) close(); }; acts.appendChild(b); }); box.appendChild(acts); }
    ov.appendChild(box); ov.onclick = function (e) { if (e.target === ov && opts.dismissable !== false) close(); };
    host.appendChild(ov); if (opts.onShow) opts.onShow(box, close); return { box: box, close: close };
  }
  function amodal(opts) {
    if (_capHost && _capHost.isConnected !== false) return appModal(_capHost, opts);
    if (!window.UI) return null;
    var o = {}; for (var k in opts) o[k] = opts[k];
    if (opts.onShow) o.onShow = function (box) { opts.onShow(box, function () { UI.close(); }); };
    return UI.modal(o);
  }
  function appAboutModal(json, meta) { amodal({ title: 'About ' + (json.name || ''), body: '<p>' + esc(meta.about || '') + '</p>', actions: [{ label: 'Close', kind: 'primary' }] }); }
  function appSubscribe(json, meta, after) { amodal({ title: (meta.premiumName || 'Premium') + ' — ' + (json.name || ''), body: '<p>' + esc(meta.premiumPitch || 'Unlock premium features.') + '</p><ul class="app-perks">' + (meta.perks || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul><p class="capp-modal-fine">' + esc(meta.price || '') + ' — billed monthly to your sheet’s Services.</p>', actions: [{ label: 'Not now' }, { label: 'Subscribe', kind: 'primary', onClick: function () { appDoSubscribe(json, meta); if (after) after(); } }] }); }
  var AD_LINES = ['Chrome your chrome at KIROSHI — 20% off optics!', 'MILITECH: peace through superior firepower.', 'Flatlined? SMASH™ — the taste of the street.', 'Trauma Team Platinum: you can’t respawn.'];
  function appAd() { var e = eln('div', 'app-ad'); e.innerHTML = '<span class="app-ad-tag">AD</span> ' + esc(AD_LINES[(netClock ? netClock() : 0) % AD_LINES.length]); return e; }
  function appChrome(json, meta, onRepaint) {
    var bar = eln('div', 'app-chrome'), acct = appAcct(json.app);
    bar.appendChild(eln('span', 'app-chrome-h', esc(acct ? '@' + acct.handle : (json.name || 'App')) + (appIsPremium(json.app) && meta.premium ? ' ✓' : '')));
    var sp = eln('span'); sp.style.flex = '1'; bar.appendChild(sp);
    if (meta.premium && !appIsPremium(json.app)) { var up = eln('button', 'app-chrome-b app-chrome-pro', '★ ' + (meta.premiumName || 'Go Pro')); up.onclick = function () { appSubscribe(json, meta, onRepaint); }; bar.appendChild(up); }
    else if (meta.premium && isPlayer() && appIsPremium(json.app)) { var cx = eln('button', 'app-chrome-b', 'cancel sub'); cx.title = 'cancel subscription'; cx.onclick = function () { appUnsubscribe(json); onRepaint(); }; bar.appendChild(cx); }
    var ab = eln('button', 'app-chrome-b', 'ⓘ'); ab.title = 'about'; ab.onclick = function () { appAboutModal(json, meta); }; bar.appendChild(ab);
    if (isPlayer() && acct) { var lo = eln('button', 'app-chrome-b', 'sign out'); lo.onclick = function () { sheetSave(function (j) { if (j.net && j.net.apps) delete j.net.apps[json.app]; if (j.lifestyle && j.lifestyle.services) j.lifestyle.services = j.lifestyle.services.filter(function (s) { return s.app !== json.app; }); }); onRepaint(); }; bar.appendChild(lo); }
    return bar;
  }
  function appOnboard(host, json, meta, done) {
    var e = eln('div', 'app-onboard'); host.appendChild(e);
    e.appendChild(eln('div', 'app-ob-brand', esc(json.name || 'App')));
    e.appendChild(eln('p', 'app-ob-about', esc(meta.about || '')));
    var nm = eln('input', 'web-login-in'); nm.placeholder = meta.nameLabel || 'real name';
    var hd = eln('input', 'web-login-in'); hd.placeholder = 'handle / pseudonym';
    var btn = eln('button', 'web-btn', meta.cta || 'Create account'), err = eln('div', 'web-login-err');
    btn.onclick = function () { var h = (hd.value || '').trim(); if (!h) { err.textContent = 'Pick a handle.'; return; } appSignup(json.app, (nm.value || '').trim(), h); done(); };
    hd.onkeydown = function (ev) { if (ev.key === 'Enter') btn.onclick(); };
    [nm, hd, btn, err].forEach(function (x) { e.appendChild(x); });
  }
  // Common opener for a chat-app renderer: gate on account, mount chrome + optional ad.
  function appBoot(host, json, ctx) {
    var appId = json.app, meta = APP_META[appId] || {};
    var acp = json.appConfig && json.appConfig.premium;
    if (acp && acp.enabled) meta = { about: meta.about, nameLabel: meta.nameLabel, cta: meta.cta, ads: meta.ads, premium: true, premiumName: acp.name || 'Premium', premiumPitch: acp.pitch || 'Unlock the premium tier.', perks: acp.perks || [], cost: acp.cost || 0, price: (acp.cost || 0) + 'eb / month' };
    if (isPlayer() && !appAcct(appId)) { appOnboard(host, json, meta, function () { repaintSite(ctx); }); return null; }
    host.appendChild(appChrome(json, meta, function () { repaintSite(ctx); }));
    if (meta.ads && !appIsPremium(appId)) host.appendChild(appAd());
    return { appId: appId, meta: meta, me: isPlayer() ? appHandleFor(appId) : null, premium: appIsPremium(appId), from: function () { return isPlayer() ? appHandleFor(appId) : posterHandle(); } };
  }
  function appPresence(json, me) { var c = camp(); if (c && c.setPresence) c.setPresence({ netSite: json.id, netHandle: me || posterHandle() }); }

  // ── Corpo Messenger: channels + DMs, clean/professional ──
  APP_RENDERERS['corpo-msg'] = function (host, json, ctx) {
    var boot = appBoot(host, json, ctx); if (!boot) return;
    var chans = (json.appConfig && json.appConfig.channels && json.appConfig.channels.length ? json.appConfig.channels : ['general', 'announcements']);
    var me = boot.me; appPresence(json, me);
    var st = { view: 'chan', chan: chans[0], thread: null };
    var root = eln('div', 'capp capp-corpo'), side = eln('div', 'capp-side'), main = eln('div', 'capp-main');
    root.appendChild(side); root.appendChild(main); host.appendChild(root);
    function paintSide() {
      side.innerHTML = '<div class="capp-sec">Channels</div>';
      chans.forEach(function (ch) { var b = eln('button', 'capp-chan' + (st.view === 'chan' && st.chan === ch ? ' on' : ''), '# ' + esc(ch)); b.onclick = function () { st.view = 'chan'; st.chan = ch; paint(); }; side.appendChild(b); });
      side.appendChild(eln('div', 'capp-sec', 'Direct'));
      var nb = eln('button', 'capp-dm-new', '+ new message'); nb.onclick = function () { caNewDM(json, me, function (id) { st.view = 'dm'; st.thread = id; paint(); }); }; side.appendChild(nb);
      caMyThreads(json, me).forEach(function (t) { var others = (t.members || []).filter(function (m) { return m !== me; }); var b = eln('button', 'capp-chan' + (st.view === 'dm' && st.thread === t.id ? ' on' : ''), '@ ' + esc(t.title || others.join(', ') || 'chat')); b.onclick = function () { st.view = 'dm'; st.thread = t.id; caGmAlign(t); paint(); }; side.appendChild(b); });
      var pres = presenceFor(json.id); side.appendChild(eln('div', 'capp-presence', '● ' + (pres.length ? pres.map(esc).join(', ') : 'nobody online')));
    }
    function paintMain() {
      main.innerHTML = '';
      if (st.view === 'chan') {
        main.appendChild(eln('div', 'capp-head', '# ' + esc(st.chan)));
        var key = json.id + ':chan:' + st.chan, msgs = eln('div', 'capp-msgs'); main.appendChild(msgs);
        var posts = boardPosts(key, homePage(json)), shown = boot.premium ? posts : posts.slice(-25);
        if (!boot.premium && posts.length > shown.length) { var lk = eln('div', 'capp-paywall'); lk.appendChild(document.createTextNode('Recent messages only · ')); var a = eln('a', 'capp-paylink', 'AraNet+ for full history'); a.onclick = function () { appSubscribe(json, boot.meta, function () { repaintSite(ctx); }); }; lk.appendChild(a); msgs.appendChild(lk); }
        caFillMsgs(msgs, shown, boot.from());
        main.appendChild(caComposeBar(function (v) { return caPostChan(json, key, v); }));
      } else {
        var t = dmThreads(json.id).filter(function (x) { return x.id === st.thread; })[0]; if (!t) { main.appendChild(eln('div', 'capp-empty', 'Pick a conversation.')); return; }
        main.appendChild(eln('div', 'capp-head', '@ ' + esc((t.members || []).filter(function (m) { return m !== me; }).join(', '))));
        var msgs2 = eln('div', 'capp-msgs'); main.appendChild(msgs2);
        caFillMsgs(msgs2, threadMsgs(json.id, t.id), boot.from());
        main.appendChild(caComposeBar(function (v) { var f = boot.from(); if (!f) { alert('Pick who you write as.'); return false; } sendDm(json.id, t.id, f, v); return true; }));
      }
    }
    function paint() { paintSide(); paintMain(); }
    paint(); if (camp() && camp().onNetChange) camp().onNetChange(function () { paint(); });
  };

  // ── Runner comms: DM-only, dark, paranoid, burnable ──
  APP_RENDERERS['runner-comms'] = function (host, json, ctx) {
    var boot = appBoot(host, json, ctx); if (!boot) return;
    var me = boot.me; appPresence(json, me);
    var st = { thread: null };
    var root = eln('div', 'capp capp-runner'), side = eln('div', 'capp-side'), main = eln('div', 'capp-main');
    root.appendChild(side); root.appendChild(main); host.appendChild(root);
    function paintSide() {
      side.innerHTML = '<div class="capp-sec">▓ secure channels</div>';
      var nb = eln('button', 'capp-dm-new', '+ open channel'); nb.onclick = function () { caNewDM(json, me, function (id) { st.thread = id; paint(); }); }; side.appendChild(nb);
      caMyThreads(json, me).forEach(function (t) { var others = (t.members || []).filter(function (m) { return m !== me; }); var b = eln('button', 'capp-chan' + (st.thread === t.id ? ' on' : ''), '⌁ ' + esc(t.title || others.join(' · ') || 'channel')); b.onclick = function () { st.thread = t.id; caGmAlign(t); paint(); }; side.appendChild(b); });
    }
    function paintMain() {
      main.innerHTML = '';
      if (!st.thread) { main.appendChild(eln('div', 'capp-empty', '▓ NO CHANNEL OPEN ▓')); return; }
      var t = dmThreads(json.id).filter(function (x) { return x.id === st.thread; })[0]; if (!t) return;
      var head = eln('div', 'capp-head'); head.appendChild(eln('span', null, '⌁ ' + (t.members || []).filter(function (m) { return m !== me; }).join(' · ')));
      var burn = eln('button', 'capp-burn', boot.premium ? 'BURN' : '★ BURN'); burn.title = boot.premium ? 'wipe this channel for everyone' : 'GHOST tier only'; burn.onclick = function () { if (!boot.premium) { appSubscribe(json, boot.meta, function () { repaintSite(ctx); }); return; } amodal({ title: 'Burn channel?', body: '<p class="capp-modal-fine">Wipes every message in this channel, for everyone.</p>', actions: [{ label: 'Cancel' }, { label: 'Burn', kind: 'danger', onClick: function () { if (camp() && camp().setNetBoard) camp().setNetBoard('dmt:' + json.id + ':' + t.id, []); } }] }); }; head.appendChild(burn); main.appendChild(head);
      var msgs = eln('div', 'capp-msgs'); main.appendChild(msgs);
      caFillMsgs(msgs, threadMsgs(json.id, t.id), boot.from());
      main.appendChild(caComposeBar(function (v) { var f = boot.from(); if (!f) { alert('Pick a handle.'); return false; } sendDm(json.id, t.id, f, v); return true; }));
    }
    function paint() { paintSide(); paintMain(); }
    paint(); if (camp() && camp().onNetChange) camp().onNetChange(function () { paint(); });
  };

  // Generic chat-app engine, parameterised by cfg — powers the lighter services.
  function chatApp(host, json, ctx, cfg) {
    var boot = appBoot(host, json, ctx); if (!boot) return;
    var ac = json.appConfig || {};
    var gateWhole = ac.gateWhole != null ? ac.gateWhole : cfg.gateWhole, dmOn = ac.dm !== false, showPres = ac.presence !== false, psa = ac.psa != null ? (ac.psa || null) : cfg.psa;
    if (gateWhole && isPlayer() && !boot.premium) {
      var g = eln('div', 'app-onboard'); host.appendChild(g);
      g.appendChild(eln('div', 'app-ob-brand', esc(json.name || 'Members only')));
      g.appendChild(eln('p', 'app-ob-about', esc(cfg.gateMsg || 'Invite-only. Membership required.')));
      var jb = eln('button', 'web-btn', '★ ' + ((boot.meta && boot.meta.premiumName) || 'Join')); jb.onclick = function () { appSubscribe(json, boot.meta, function () { repaintSite(ctx); }); }; g.appendChild(jb);
      return;
    }
    var chans = (ac.channels && ac.channels.length) ? ac.channels : (cfg.channels === 'config' ? [] : (cfg.channels || []));
    var me = boot.me; appPresence(json, me);
    var st = { view: chans.length ? 'chan' : 'dm', chan: chans[0] || null, thread: null };
    var root = eln('div', 'capp capp-' + cfg.variant), side = eln('div', 'capp-side'), main = eln('div', 'capp-main');
    root.appendChild(side); root.appendChild(main); host.appendChild(root);
    function paintSide() {
      side.innerHTML = '';
      if (chans.length) { side.appendChild(eln('div', 'capp-sec', cfg.chanLabel || 'Channels')); chans.forEach(function (ch) { var b = eln('button', 'capp-chan' + (st.view === 'chan' && st.chan === ch ? ' on' : ''), (cfg.chanPrefix || '# ') + esc(ch)); b.onclick = function () { st.view = 'chan'; st.chan = ch; paint(); }; side.appendChild(b); }); }
      if (dmOn) {
        side.appendChild(eln('div', 'capp-sec', cfg.dmLabel || 'Direct'));
        var nb = eln('button', 'capp-dm-new', cfg.newLabel || '+ new chat'); nb.onclick = function () { caNewDM(json, me, function (id) { st.view = 'dm'; st.thread = id; paint(); }); }; side.appendChild(nb);
        caMyThreads(json, me).forEach(function (t) { var others = (t.members || []).filter(function (m) { return m !== me; }); var b = eln('button', 'capp-chan' + (st.view === 'dm' && st.thread === t.id ? ' on' : ''), '@ ' + esc(t.title || others.join(', ') || 'chat')); b.onclick = function () { st.view = 'dm'; st.thread = t.id; caGmAlign(t); paint(); }; side.appendChild(b); });
      }
      if (showPres) { var pres = presenceFor(json.id); side.appendChild(eln('div', 'capp-presence', '● ' + (pres.length ? pres.map(esc).join(', ') : 'nobody online'))); }
    }
    function paintMain() {
      main.innerHTML = '';
      if (psa) main.appendChild(eln('div', 'capp-psa', psa));
      if (st.view === 'chan' && st.chan) {
        main.appendChild(eln('div', 'capp-head', (cfg.chanPrefix || '# ') + esc(st.chan)));
        var key = json.id + ':chan:' + st.chan, msgs = eln('div', 'capp-msgs'); main.appendChild(msgs);
        caFillMsgs(msgs, boardPosts(key, homePage(json)), boot.from());
        main.appendChild(caComposeBar(function (v) { return caPostChan(json, key, v); }));
      } else if (st.view === 'dm' && st.thread) {
        var t = dmThreads(json.id).filter(function (x) { return x.id === st.thread; })[0]; if (!t) { main.appendChild(eln('div', 'capp-empty', 'Pick a chat.')); return; }
        main.appendChild(eln('div', 'capp-head', '@ ' + esc((t.members || []).filter(function (m) { return m !== me; }).join(', '))));
        var msgs2 = eln('div', 'capp-msgs'); main.appendChild(msgs2);
        caFillMsgs(msgs2, threadMsgs(json.id, t.id), boot.from());
        main.appendChild(caComposeBar(function (v) { var f = boot.from(); if (!f) { alert('Pick who you write as.'); return false; } sendDm(json.id, t.id, f, v); return true; }));
      } else main.appendChild(eln('div', 'capp-empty', cfg.emptyMsg || 'Pick a chat.'));
    }
    function paint() { paintSide(); paintMain(); }
    paint(); if (camp() && camp().onNetChange) camp().onNetChange(function () { paint(); });
  }
  // ── Consumer: mass-market, free, ad-supported (PONY) ──
  APP_RENDERERS['consumer'] = function (host, json, ctx) { chatApp(host, json, ctx, { variant: 'consumer', channels: [], dmLabel: 'Chats', newLabel: '+ new chat', emptyMsg: 'Start a chat — say hi 👋' }); };
  // ── Elite: invite-only, whole app behind a membership paywall (VELVET) ──
  APP_RENDERERS['elite'] = function (host, json, ctx) { chatApp(host, json, ctx, { variant: 'elite', channels: 'config', chanLabel: 'Lounges', chanPrefix: '◈ ', dmLabel: 'Private', newLabel: '+ compose', gateWhole: true, gateMsg: 'VELVET is invite-only. Membership is by subscription.', emptyMsg: 'Welcome to the club.' }); };
  // ── Public: municipal service, deliberately clunky but free (NC PUBLIC ACCESS) ──
  APP_RENDERERS['public'] = function (host, json, ctx) { chatApp(host, json, ctx, { variant: 'public', channels: 'config', chanLabel: 'Public boards', chanPrefix: '▸ ', dmLabel: 'Messages', newLabel: '+ new message', psa: '⚠ NC MUNICIPAL COMMS — traffic may be monitored. Thank you for your patience.', emptyMsg: 'Select a board. Please wait…' }); };
  // Generic chat app — GM-created, fully appConfig-driven (variant + channels/dm/presence/gate/psa).
  APP_RENDERERS['chat'] = function (host, json, ctx) { chatApp(host, json, ctx, { variant: 'custom', chanLabel: 'Channels', chanPrefix: '# ', dmLabel: 'Direct', newLabel: '+ new message', emptyMsg: 'Pick a channel or start a chat.' }); };
  APP_META['chat'] = { about: 'A chat service.', nameLabel: 'handle', premium: false };

  /* ═══════════════ PRESS ENGINE — a config-driven "site engine" (alt to blocks) ═══════════════
     A hard-coded, richly-configurable press outlet: json.app='press' + json.appConfig
     (identity, LAYOUT archetype, palette, sections, formats, submission policy, angle,
     corpo link, comments, ratings, monetization…). Diegetic look (NOT the ink charte) —
     each LAYOUT is modelled on a real press-site type for deep visual demarcation.
     Stories/comments live as board posts (kind:'story'|'comment'). Media publish onto it. */
  // NEUTRAL, generic starting defaults per archetype (tone + type family only — NOT copies
  // of real brands). The GM overrides bg/ink/accent/font freely via appConfig.palette; that
  // customization is where each outlet's identity lives.
  var PRESS_PALETTES = {
    broadsheet: { bg: '#f5f3ec', ink: '#1a1a1a', accent: '#6e2a2a', font: 'Georgia,"Times New Roman",serif', head: 'Georgia,"Times New Roman",serif' },
    tabloid: { bg: '#ffffff', ink: '#141414', accent: '#9c2226', font: 'Arial,Helvetica,sans-serif', head: '"Arial Black",Impact,sans-serif' },
    tvnews: { bg: '#141a22', ink: '#eef2f6', accent: '#a33636', font: 'Arial,Helvetica,sans-serif', head: '"Arial Narrow",Arial,sans-serif' },
    wire: { bg: '#ffffff', ink: '#141414', accent: '#555555', font: '"Courier New",ui-monospace,monospace', head: '"Courier New",monospace' },
    gossip: { bg: '#f7f1f4', ink: '#241019', accent: '#a3356b', font: '"Trebuchet MS",Verdana,sans-serif', head: '"Trebuchet MS",Verdana,sans-serif' },
    corporate: { bg: '#f2f5f7', ink: '#14222f', accent: '#356a5b', font: '"Segoe UI",Arial,sans-serif', head: '"Segoe UI",Arial,sans-serif' },
    zine: { bg: '#e9e6de', ink: '#141414', accent: '#141414', font: '"Courier New",ui-monospace,monospace', head: '"Courier New",monospace' },
    video: { bg: '#ffffff', ink: '#141414', accent: '#7a2f2f', font: 'Arial,Helvetica,sans-serif', head: 'Arial,Helvetica,sans-serif' },
    live: { bg: '#16131f', ink: '#ece9f2', accent: '#5b4b8a', font: '"Segoe UI",Arial,sans-serif', head: '"Segoe UI",Arial,sans-serif' }
  };
  var LAYOUT_STRUCT = { broadsheet: 'leadgrid', corporate: 'leadgrid', tabloid: 'splash', gossip: 'cards', tvnews: 'broadcast', wire: 'list', zine: 'list', video: 'videogrid', live: 'livegrid' };
  // content type (per post) — decoupled from the site's visual look. A post renders as a
  // video card if its format is one of these, else an article card; a site may mix types.
  var VIDEO_FORMATS = ['video', 'clip', 'live', 'stream', 'broadcast', 'braindance', 'short'];
  var PRESS_FEED = {
    leadgrid: function (w, arr, mk) { if (arr[0]) w.appendChild(mk(arr[0], true)); var g = eln('div', 'pe-grid'); arr.slice(1).forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); },
    splash: function (w, arr, mk) { if (arr[0]) w.appendChild(mk(arr[0], true)); var g = eln('div', 'pe-teasers'); arr.slice(1).forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); },
    cards: function (w, arr, mk) { var g = eln('div', 'pe-cards'); arr.forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); },
    broadcast: function (w, arr, mk) { w.appendChild(eln('div', 'pe-liveband', '● LIVE  ·  BREAKING NEWS')); if (arr[0]) w.appendChild(mk(arr[0], true)); var g = eln('div', 'pe-segs'); arr.slice(1).forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); },
    list: function (w, arr, mk) { var g = eln('div', 'pe-list'); arr.forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); },
    videogrid: function (w, arr, mk) { if (arr[0]) w.appendChild(mk(arr[0], true)); var g = eln('div', 'pe-vgrid'); arr.slice(1).forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); },
    livegrid: function (w, arr, mk) { w.appendChild(eln('div', 'pe-liveband', '● LIVE NOW')); if (arr[0]) w.appendChild(mk(arr[0], true)); var g = eln('div', 'pe-vgrid'); arr.slice(1).forEach(function (p) { g.appendChild(mk(p, false)); }); w.appendChild(g); }
  };

  function webCred() { var j = playerJson(); return (j && j.specialAbilities && (j.specialAbilities['Credibility'] | 0)) || 0; }
  function feedCanPost(json, boot) {
    var pol = (json.appConfig && json.appConfig.submit) || 'media';
    if (!isPlayer()) return true;
    if (pol === 'gm') return false;
    if (pol === 'open') return !!boot;
    if (typeof pol === 'string' && pol.indexOf('cred') === 0) return webCred() >= (parseInt(pol.slice(4), 10) || 1);
    return webCred() >= 1;                                   // 'media'
  }
  function pLive(key) { return (hasNet() && camp().getNetPosts) ? (camp().getNetPosts(key) || []) : []; }
  function pComments(key, sid) { return pLive(key).filter(function (p) { return p.kind === 'comment' && p.parent === sid; }); }
  function peHash(s) { s = String(s || ''); var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function peThumbBg(seed) {
    var h = peHash(seed), ang = h % 360, l1 = 26 + (h % 34), l2 = 8 + ((h >> 3) % 22), sat = 5 + (h % 14), pat = h % 3;
    var over = ['repeating-linear-gradient(' + (h % 180) + 'deg, rgba(255,255,255,.05) 0 2px, transparent 2px 7px)',
      'radial-gradient(rgba(255,255,255,.10) 1px, transparent 1.4px)',
      'repeating-linear-gradient(45deg, rgba(0,0,0,.14) 0 9px, transparent 9px 18px)'][pat];
    return { bg: over + ', linear-gradient(' + ang + 'deg, hsl(' + (h % 360) + ',' + sat + '%,' + l1 + '%), hsl(' + ((h >> 5) % 360) + ',' + sat + '%,' + l2 + '%))', size: pat === 1 ? '4px 4px, cover' : 'auto, cover' };
  }
  function peViews(n, seed, live) { var v = (n || 0) + (peHash(seed) % 137); return v.toLocaleString() + (live ? ' watching now' : ' views'); }
  var PC_PRO = ['This is huge if true.', 'Finally someone said it.', 'Preem journalism for once.', 'Been waiting for someone to run this.', 'Sharing this everywhere.', 'Screenshotting before it vanishes.', 'The only outlet with a spine left.'];
  var PC_CON = ['Source? Or just vibes.', 'Old news, wake up.', 'Paid to say this, obviously.', 'This you? nice try.', 'Corpo hit piece, calling it.', 'Delete this before you get flatlined.', 'Zero evidence, pure ragebait.'];
  var PC_SNARK = ['Classic Night City.', 'The comments are the real story.', 'Netwatch is loving this thread.', 'Who benefits? Follow the money.', 'My cousin works there — checks out.', 'Sitting real close to a libel suit.', 'Popcorn ready for the retraction.'];
  var PRESS_HANDLES = ['wire_rat', 'zero_cool', 'chrome_dome', 'no_futures', 'street_samurai', 'ping_of_death', 'lady_stack', 'gonk_slayer', 'edgerunner77', 'binary_star', 'byte_me', 'ghost_in_grid', 'static_hiss', 'red_queen', 'nomad_9', 'kibble_bit'];
  function pePick(arr, n, h) { var a = arr.slice(), out = []; for (var i = 0; i < n && a.length; i++) { out.push(a.splice((h + i * 7 + (h >> (i + 1))) % a.length, 1)[0]); } return out; }
  function peAutoComments(seed) {
    var h = peHash(seed), n = [0, 1, 1, 2, 2, 3, 3, 4, 5][h % 9]; if (!n) return [];
    var mood = h % 3, pool = mood === 0 ? PC_PRO.concat(PC_SNARK) : (mood === 1 ? PC_CON.concat(PC_SNARK) : PC_PRO.concat(PC_CON, PC_SNARK));
    var bodies = pePick(pool, n, h), handles = pePick(PRESS_HANDLES, n, (h >> 3) + 1);
    return bodies.map(function (b, i) { return { handle: handles[i] || 'anon', body: b, auto: true }; });
  }
  function pressInfoBtn(json) {
    var wrap = eln('div', 'pe-info'), btn = eln('button', 'pe-info-btn', 'ⓘ'), pop = eln('div', 'pe-info-pop');
    btn.title = 'about this outlet'; pop.style.display = 'none';
    pop.innerHTML = 'Stories are filed from a <b>newsroom app</b>, not here — a reporter builds the case then publishes to a section (subject to this outlet’s policy). Readers can comment.';
    btn.onclick = function () { pop.style.display = pop.style.display === 'none' ? '' : 'none'; };
    wrap.appendChild(btn); wrap.appendChild(pop); return wrap;
  }

  function pressComposer(json, key, boot, ctx, repaint) {
    var cfg = json.appConfig || {}, comp = eln('div', 'pe-compose');
    var formats = (cfg.formats && cfg.formats.length) ? cfg.formats : ['article'];
    var fmt = eln('select', 'pe-in pe-in-fmt'); formats.forEach(function (f) { var o = eln('option', null, f); o.value = f; fmt.appendChild(o); });
    var hl = eln('input', 'pe-in'); hl.placeholder = 'Headline';
    var bd = eln('textarea', 'pe-in pe-ta'); bd.placeholder = 'File a story… ⟦npc:id|Name⟧ to cite';
    var lbl = cfg.layout === 'video' ? 'upload' : (cfg.layout === 'live' ? 'go live' : 'publish');
    var post = eln('button', 'pe-post', cfg.workflow === 'hold' && isPlayer() ? 'submit for review' : lbl);
    post.onclick = function () { var h = (hl.value || '').trim(); if (!h) return; postToBoard(key, ctx, { id: uid('st'), kind: 'story', handle: boot.from(), format: fmt.value, headline: h, body: bd.value || '', held: cfg.workflow === 'hold' && isPlayer(), ts: netClock ? netClock() : 0 }); hl.value = ''; bd.value = ''; repaint(); };
    if (!isPlayer()) comp.appendChild(personaSelect());
    comp.appendChild(fmt); comp.appendChild(hl); comp.appendChild(bd);
    var bar = eln('div', 'pe-compose-bar'); bar.appendChild(mentionBtn(function (t) { insertAtCursor(bd, t); })); bar.appendChild(post); comp.appendChild(bar);
    return comp;
  }
  function pressLikeBtn(key, p, boot, repaint) {
    var me = (boot && boot.from && boot.from()) || 'reader';
    var likedBy = p.likedBy || [], liked = likedBy.indexOf(me) >= 0;
    var b = eln('button', 'pe-like' + (liked ? ' on' : ''), '▲ ' + (likedBy.length || 0));
    b.title = liked ? 'unlike' : 'like';
    b.onclick = function () {
      var c = camp(); if (!c || !c.getNetPosts || !c.setNetBoard) return;
      c.setNetBoard(key, (c.getNetPosts(key) || []).map(function (x) {
        if (x.id === p.id) { x = JSON.parse(JSON.stringify(x)); x.likedBy = x.likedBy || []; var i = x.likedBy.indexOf(me); if (i >= 0) x.likedBy.splice(i, 1); else x.likedBy.push(me); x.likes = x.likedBy.length; }
        return x;
      }));
      repaint();
    };
    return b;
  }
  function pressStoryCard(json, key, p, ctx, boot, repaint, big) {
    var cfg = json.appConfig || {}, card = eln('div', 'pe-story' + (big ? ' pe-lead' : '') + (p.held ? ' pe-held' : '') + (p.exposed ? ' pe-exposed' : ''));
    if (p.held) card.appendChild(eln('span', 'pe-flag', 'PENDING REVIEW'));
    if (p.exposed) card.appendChild(eln('span', 'pe-rating pe-rate-exposed', 'EXPOSED — bought / false'));
    else if (p.rating && cfg.showRatings) card.appendChild(eln('span', 'pe-rating pe-rate-' + esc(p.rating), esc(p.rating)));
    card.appendChild(eln('div', 'pe-h', esc(p.headline || '(untitled)')));
    if (p.dek) card.appendChild(eln('div', 'pe-dek', esc(p.dek)));
    card.appendChild(eln('div', 'pe-by', 'by ' + esc(p.handle || 'staff') + (p.format ? ' · ' + esc(p.format) : '') + (p.ts ? ' · t+' + p.ts + 'h' : '')));
    var _eng = (p.reach || 0) + (p.buzz || 0);
    if (_eng > 0) card.appendChild(eln('div', 'pe-stat', '▲ ' + _eng.toLocaleString() + ' reach'));
    card.appendChild(setRich(eln('div', 'pe-body'), p.body || ''));
    if (boot && !p.held) { var lact = eln('div', 'pe-actions'); lact.appendChild(pressLikeBtn(key, p, boot, repaint)); card.appendChild(lact); }
    if (p.held && !isPlayer()) { var ap = eln('button', 'pe-approve', 'approve'); ap.onclick = function () { var posts = pLive(key); posts.forEach(function (x) { if (x.id === p.id) x.held = false; }); if (camp() && camp().setNetBoard) camp().setNetBoard(key, posts); repaint(); }; card.appendChild(ap); }
    if (cfg.comments !== 'off') {
      var cm = pComments(key, p.id).concat(peAutoComments(p.id)), cwrap = eln('div', 'pe-comments');
      var tog = eln('button', 'pe-cm-toggle', cm.length + (cm.length === 1 ? ' comment' : ' comments'));
      var box = eln('div', 'pe-cm-box'); box.style.display = 'none'; tog.onclick = function () { box.style.display = box.style.display === 'none' ? '' : 'none'; };
      cm.forEach(function (c) { box.appendChild(eln('div', 'pe-cm', '<b>' + esc(c.handle || 'anon') + '</b> ' + esc(c.body || ''))); });
      if (boot) { var ci = eln('input', 'pe-cm-in'); ci.placeholder = 'Add a comment…'; ci.onkeydown = function (e) { if (e.key === 'Enter' && ci.value.trim()) { postToBoard(key, ctx, { id: uid('cm'), kind: 'comment', parent: p.id, handle: boot.from(), body: ci.value.trim(), ts: netClock ? netClock() : 0 }); ci.value = ''; repaint(); } }; box.appendChild(ci); }
      cwrap.appendChild(tog); cwrap.appendChild(box); card.appendChild(cwrap);
    }
    return card;
  }
  function pressVideoCard(json, key, p, ctx, boot, repaint, big, layout) {
    var live = layout === 'live', card = eln('div', 'pe-vid' + (big ? ' pe-vid-big' : ''));
    var thumb = eln('div', 'pe-thumb' + (live ? ' pe-thumb-live' : ''));
    var _tb = peThumbBg(p.id || p.headline); thumb.style.backgroundImage = _tb.bg; thumb.style.backgroundSize = _tb.size;
    thumb.innerHTML = '<span class="pe-thumb-play">▶</span>' + (live ? '<span class="pe-thumb-livebadge">● LIVE</span>' : '<span class="pe-thumb-dur">' + esc(p.dur || '12:04') + '</span>');
    card.appendChild(thumb);
    var meta = eln('div', 'pe-vid-meta');
    meta.innerHTML = '<div class="pe-vid-t">' + esc(p.headline || '(untitled)') + '</div><div class="pe-vid-ch">' + esc(p.handle || 'channel') + '</div><div class="pe-vid-v">' + peViews((p.reach || 0) + (p.buzz || 0), p.id || p.headline, live) + '</div>';
    card.appendChild(meta);
    if (big) {
      if (p.body) card.appendChild(setRich(eln('div', 'pe-vid-desc'), p.body));
      if (boot) { var vact = eln('div', 'pe-actions'); vact.appendChild(pressLikeBtn(key, p, boot, repaint)); card.appendChild(vact); }
      if ((json.appConfig || {}).comments !== 'off') {
        var cm = pComments(key, p.id).concat(peAutoComments(p.id)), cwrap = eln('div', 'pe-vid-comments');
        cwrap.appendChild(eln('div', 'pe-cm-toggle', (live ? 'LIVE CHAT · ' : '') + cm.length + (cm.length === 1 ? ' comment' : ' comments')));
        var box = eln('div', 'pe-cm-box'); cm.forEach(function (c) { box.appendChild(eln('div', 'pe-cm', '<b>' + esc(c.handle || 'anon') + '</b> ' + esc(c.body || ''))); });
        if (boot) { var ci = eln('input', 'pe-cm-in'); ci.placeholder = live ? 'Say something…' : 'Add a comment…'; ci.onkeydown = function (e) { if (e.key === 'Enter' && ci.value.trim()) { postToBoard(key, ctx, { id: uid('cm'), kind: 'comment', parent: p.id, handle: boot.from(), body: ci.value.trim(), ts: netClock ? netClock() : 0 }); ci.value = ''; repaint(); } }; box.appendChild(ci); }
        cwrap.appendChild(box); card.appendChild(cwrap);
      }
    }
    return card;
  }
  function pressMasthead(root, layout, json, cfg, sections, st, onNav) {
    var m = eln('div', 'pe-mast pe-mast-' + layout), name = json.name || 'The Press', tag = cfg.tagline || '';
    if (layout === 'tvnews') m.innerHTML = '<div class="pe-tv-band"><span class="pe-tv-logo">' + esc(name) + '</span><span class="pe-tv-live">● LIVE</span></div>' + (tag ? '<div class="pe-tv-tag">' + esc(tag) + '</div>' : '');
    else if (layout === 'tabloid') m.innerHTML = '<div class="pe-tab-name">' + esc(name) + '</div>' + (tag ? '<div class="pe-tab-tag">' + esc(tag) + '</div>' : '');
    else if (layout === 'wire') m.innerHTML = '<div class="pe-wire-name">' + esc(name) + ' <span>// WIRE SERVICE</span></div>';
    else if (layout === 'gossip') m.innerHTML = '<div class="pe-gos-name">' + esc(name) + '</div>' + (tag ? '<div class="pe-gos-tag">' + esc(tag) + '</div>' : '');
    else if (layout === 'corporate') m.innerHTML = '<div class="pe-corp-name">' + esc(name) + '</div><div class="pe-corp-sub">' + esc(tag || 'Official Newsroom') + '</div>';
    else if (layout === 'zine') m.innerHTML = '<div class="pe-zine-name">' + esc(name) + '</div>' + (tag ? '<div class="pe-zine-tag">' + esc(tag) + '</div>' : '');
    else if (layout === 'video') m.innerHTML = '<div class="pe-yt-bar"><span class="pe-yt-logo">' + esc(name) + '</span><span class="pe-yt-search">Search</span></div>' + (tag ? '<div class="pe-yt-tag">' + esc(tag) + '</div>' : '');
    else if (layout === 'live') m.innerHTML = '<div class="pe-tw-bar"><span class="pe-tw-logo">' + esc(name) + '</span><span class="pe-tw-live">● LIVE</span></div>' + (tag ? '<div class="pe-tw-tag">' + esc(tag) + '</div>' : '');
    else m.innerHTML = '<div class="pe-bs-name">' + esc(name) + '</div>' + (tag ? '<div class="pe-bs-tag">' + esc(tag) + '</div>' : '') + '<div class="pe-bs-rule"></div>';
    if (sections.length > 1) { var nav = eln('div', 'pe-nav'); sections.forEach(function (s) { var b = eln('button', 'pe-navb' + (st.sec === s ? ' on' : ''), esc(s)); b.onclick = function () { st.sec = s; onNav(); }; nav.appendChild(b); }); m.appendChild(nav); }
    root.appendChild(m);
  }
  function pressEngine(host, json, ctx) {
    var boot = appBoot(host, json, ctx); if (!boot) return;
    var cfg = json.appConfig || {}, layout = cfg.layout || 'broadsheet';
    var pal = {}, base = PRESS_PALETTES[layout] || PRESS_PALETTES.broadsheet; for (var k in base) pal[k] = base[k];
    var ov = cfg.palette || {}; for (var k2 in ov) { if (ov[k2]) pal[k2] = ov[k2]; }
    var root = eln('div', 'pe pe-' + layout);
    root.setAttribute('style', '--pe-bg:' + pal.bg + ';--pe-ink:' + pal.ink + ';--pe-accent:' + pal.accent + ';--pe-font:' + pal.font + ';--pe-head:' + pal.head + ';');
    if (pal.bgImage) { root.style.backgroundImage = 'url("' + pal.bgImage + '")'; root.classList.add('pe-hasbg'); }
    host.appendChild(root); appPresence(json, boot.me);
    var sections = (cfg.sections && cfg.sections.length) ? cfg.sections : ['Front'], st = { sec: sections[0], article: (ctx && ctx.article) || null };
    var mastWrap = eln('div', 'pe-mastwrap'); root.appendChild(mastWrap);
    var feedWrap = eln('div', 'pe-feedwrap'); root.appendChild(feedWrap);
    function sectionStories(sec) {
      var key = json.id + ':feed:' + slugify(sec);
      var seedArr = ((json.appConfig && json.appConfig.seed) || {})[slugify(sec)] || [];
      if (!seedArr.length && sec === sections[0]) seedArr = (homePage(json).board || []).filter(function (p) { return p.kind === 'story'; }); // legacy page.board fallback
      var stories = seedArr.concat(pLive(key).filter(function (p) { return p.kind === 'story'; })).filter(function (p) { return !p.held || !isPlayer() || p.handle === boot.from(); });
      return { key: key, stories: stories };
    }
    function findArticle(id) {
      for (var i = 0; i < sections.length; i++) { var s = sectionStories(sections[i]); for (var j = 0; j < s.stories.length; j++) if (s.stories[j].id === id) return { post: s.stories[j], key: s.key, section: sections[i] }; }
      return null;
    }
    function card(p, key, big) {
      var vf = p.format ? VIDEO_FORMATS.indexOf(p.format) >= 0 : (layout === 'video' || layout === 'live');
      return vf ? pressVideoCard(json, key, p, ctx, boot, paint, big, (p.format === 'live' || layout === 'live') ? 'live' : 'video') : pressStoryCard(json, key, p, ctx, boot, paint, big);
    }
    function paint() {
      mastWrap.innerHTML = ''; pressMasthead(mastWrap, layout, json, cfg, sections, st, function () { st.article = null; paint(); });
      mastWrap.appendChild(pressInfoBtn(json));
      if (cfg.corpoLink && cfg.corpoLink.name) mastWrap.appendChild(eln('div', 'pe-owner', 'A ' + esc(cfg.corpoLink.name) + ' publication'));
      feedWrap.innerHTML = '';
      if (st.article) {
        var found = findArticle(st.article);
        var back = eln('button', 'pe-back', '‹ back to ' + esc(st.sec)); back.onclick = function () { st.article = null; paint(); }; feedWrap.appendChild(back);
        if (!found) { feedWrap.appendChild(eln('div', 'pe-empty', 'This story is no longer available.')); return; }
        var pA = found.post, art = eln('div', 'pe-article');
        var bar = eln('div', 'pe-artbar');
        bar.innerHTML = '<span>' + (((pA.reach || 0) + (pA.buzz || 0))).toLocaleString() + ' reach</span><span>' + ((pA.likedBy || []).length || pA.likes || 0) + ' likes</span><span>' + pComments(found.key, pA.id).length + ' comments</span>';
        var cp = eln('button', 'pe-copylink', 'copy link');
        cp.onclick = function () { var link = siteUrl(json) + '#a=' + pA.id; try { navigator.clipboard.writeText(link); cp.textContent = 'link copied'; setTimeout(function () { cp.textContent = 'copy link'; }, 1400); } catch (e) { cp.textContent = link; } };
        bar.appendChild(cp); art.appendChild(bar);
        art.appendChild(card(pA, found.key, true)); feedWrap.appendChild(art);
        return;
      }
      var s = sectionStories(st.sec), key = s.key, stories = s.stories;
      if (cfg.rank === 'reach') stories.sort(function (a, b) { return ((b.reach || 0) + (b.buzz || 0)) - ((a.reach || 0) + (a.buzz || 0)); });
      if (!stories.length) { feedWrap.appendChild(eln('div', 'pe-empty', 'No stories filed yet.')); return; }
      PRESS_FEED[LAYOUT_STRUCT[layout] || 'leadgrid'](feedWrap, stories, function (p, big) {
        var el = card(p, key, big);
        var hEl = el.querySelector('.pe-h') || el.querySelector('.pe-vid-t');
        if (hEl) { hEl.classList.add('pe-clickable'); hEl.title = 'open this story'; hEl.onclick = function (e) { e.stopPropagation(); st.article = p.id; paint(); }; }
        return el;
      });
    }
    paint(); if (camp() && camp().onNetChange) camp().onNetChange(function () { paint(); });
  }
  APP_RENDERERS['press'] = pressEngine;
  APP_META['press'] = { about: 'A press outlet.', nameLabel: 'reporter handle', premium: false };

  /* ═══════════════ renderSite (a single page) ═══════════════ */
  function renderSite(host, siteJson, ctx) {
    wireChipClicks();
    ctx = ctx || {};
    // A standalone datafort has no public surface — nothing to browse to.
    if (siteJson && siteJson.deepOnly) { host.className = 'web-site web-deep-only'; host.removeAttribute('style'); host.innerHTML = '<div class="web-deep-only-box">◆ DATAFORT<div class="web-deep-only-s">No public surface. This system exists only in the DEEP — a netrunner jacks in from the atlas.</div></div>'; return; }
    ctx.siteJson = siteJson; ctx.siteId = ctx.siteId || siteJson.id; ctx.page = ctx.page || homePage(siteJson); ctx.host = host;
    if (isPlayer()) { var _pj = playerJson(); ctx.power = playerPower(_pj); ctx.adblock = deviceHasPerk(_pj, 'adblock'); } else { ctx.power = 999; ctx.adblock = false; }
    host.className = 'web-site web-preset-' + ((siteJson.theme && siteJson.theme.preset) || 'plain') + (ctx.page && ctx.page.layout === 'app' ? ' web-page-app' : ''); host.setAttribute('style', themeCss(siteJson.theme)); host.innerHTML = '';
    var auth = siteJson.auth, eff = 999;
    if (auth && auth.enabled) {
      eff = authLevelFor(siteJson); if (!isPlayer() && _gmView[siteJson.id] != null) eff = _gmView[siteJson.id]; ctx.level = eff;
      if (isPlayer() && auth.wall && eff <= 0) { host.appendChild(renderLoginScreen(siteJson, ctx)); wireGoto(host, siteJson); return; }
      if (!(auth.hideBar && isPlayer())) host.appendChild(renderAuthBar(siteJson, eff, ctx));
      if (ctx.page && ctx.page.access && eff < ctx.page.access) { host.appendChild(renderLockedPage(siteJson, ctx.page)); wireGoto(host, siteJson); return; }
    } else ctx.level = 999;
    var appId = siteAppId(siteJson); _capHost = host; // in-site modals (apps + hosting portal, etc.)
    if (appId) { if (host.className.indexOf('web-page-app') < 0) host.className += ' web-page-app'; if (isPlayer() && ctx.power < appMinPower(appId)) { host.appendChild(appTooWeak(siteJson)); wireGoto(host, siteJson); return; } APP_RENDERERS[appId](host, siteJson, ctx); wireGoto(host, siteJson); return; }
    var blocks = (ctx.page && ctx.page.blocks) || [];
    if (!blocks.length) host.appendChild(eln('div', 'web-empty', 'This page has no content yet.'));
    else host.appendChild(renderBlocks(blocks, ctx));
    richifyTextNodes(host);
    wireGoto(host, siteJson);
  }
  function wireGoto(host, siteJson) {
    host.querySelectorAll('[data-goto]').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); var addr = a.getAttribute('data-goto'); if (!addr) return; if (addr.indexOf('page:') === 0) addr = pageUrl(siteJson, pageBySlug(siteJson, addr.slice(5))); openAddress(addr); }; });
  }
  var _deepArticle = null;  // one-shot: a story id to open directly when the browser deep-links to an article
  function renderSiteResolved(host, siteJson, pageSlug) {
    var ctx = { siteId: siteJson.id, siteJson: siteJson, role: br().sess && br().sess.role, subject: null, page: pageBySlug(siteJson, pageSlug), article: _deepArticle };
    _deepArticle = null;
    var sub = siteJson.subject;
    if (sub && sub.type && sub.id) Store.resolve(sub).then(function (hit) { ctx.subject = hit ? hit.json : null; renderSite(host, siteJson, ctx); }).catch(function () { renderSite(host, siteJson, ctx); });
    else renderSite(host, siteJson, ctx);
  }

  /* ═══════════════ HOME (GM authoring rail; player → browser) ═══════════════ */
  // GM surveillance: who is logged into which auth site, at what clearance.
  function renderSessions() {
    if (!window.UI) return;
    var c = camp(); var sheets = (c && c.allSheets && c.allSheets()) || [];
    var bySite = {};
    sheets.forEach(function (rec) { var j = (rec && rec.json) || {}; var pc = j.handle || j.name || 'PC'; var auth = (j.net && j.net.auth) || {}; Object.keys(auth).forEach(function (sid) { (bySite[sid] = bySite[sid] || []).push({ pc: pc, user: auth[sid].user, level: auth[sid].level }); }); });
    Store.index('site').then(function (rows) {
      var info = {}; rows.forEach(function (r) { info[r.json.id] = r.json; });
      var ids = Object.keys(bySite);
      var body = ids.length ? ids.map(function (sid) { var s = info[sid]; return '<div class="web-sess-site">' + esc(s ? s.name : sid) + '</div>' + bySite[sid].map(function (x) { return '<div class="web-sess-row"><span class="web-sess-pc">' + esc(x.pc) + '</span><span class="web-sess-u">' + esc(x.user || '') + '</span><span class="web-sess-lv">' + esc(s ? levelName(s, x.level) : ('L' + x.level)) + '</span></div>'; }).join(''); }).join('') : '<div class="app-empty">No active logins.</div>';
      UI.modal({ title: 'Active logins · surveillance', body: body, actions: [{ label: 'Close', kind: 'primary' }] });
    }).catch(function () {});
  }
  // GM traffic watch: every site's traffic/revenue breakdown, quality & buzz, monthly settle.
  // On settle, ad revenue is paid straight into the owner's chosen account.
  function payAdRevenue(s, all) {
    var rev = computeAdRevenue(s, all); if (rev <= 0) return;
    var c = camp(); if (!c || !c.getSheet || !c.publishSheet || !s.owner) return; var rec = c.getSheet(s.owner); if (!rec || !rec.json) return; var j = rec.json;
    var accs = (j.lifestyle && j.lifestyle.accounts) || []; if (!accs.length) return; var acc = pickAccount(accs, s.payAccount); if (!acc) return;
    accs.forEach(function (a) { a.inputs = (a.inputs || []).filter(function (i) { return i.site !== s.id; }); }); // drop any legacy recurring ad input
    acc.balance = (parseFloat(acc.balance) || 0) + rev; acc.ledger = acc.ledger || []; acc.ledger.unshift({ id: 'ad-' + Date.now().toString(36), type: 'income', label: 'Ad revenue — ' + s.name, amount: rev });
    c.publishSheet(s.owner, j.handle || j.name || 'PC', j); return rev;
  }
  function settleMonth(all) {
    var paid = 0;
    all.forEach(function (r) { var s = r.json; if (!isOnline(s)) return; var t = computeTraffic(s, all), buzz = parseInt(s.buzz, 10) || 0; s.rep = (parseInt(s.rep, 10) || 0) + Math.round(t * 0.08 + buzz * 0.3); s.buzz = Math.round(buzz * 0.3); Store.put({ type: 'site', id: s.id }, s).catch(function () {}); if (s.owner) paid += (payAdRevenue(s, all) || 0); });
    if (br().logSession) br().logSession('📈 Settled a month of Net traffic — rep grows, buzz fades, ' + paid + 'eb of ad revenue paid out.');
    if (window.UI) UI.close();
  }
  function renderTraffic() {
    var host = document.getElementById('web-gm-main'); if (!host) return;
    var st = { tab: 'sites' };
    host.innerHTML = '<div class="web-sv-head"><span class="dt-head" style="padding:0">TRAFFIC</span>' +
      '<span class="web-sv-toggle"><button class="web-sv-b on" data-tt="sites">Sites</button><button class="web-sv-b" data-tt="content">Content</button></span>' +
      '<button class="web-sv-new" data-tr-settle>▶ settle month</button></div><div class="web-sv-body" id="web-tr-body"></div>';
    var body = host.querySelector('#web-tr-body');
    host.querySelector('[data-tr-settle]').onclick = function () { Store.index('site').then(function (all) { settleMonth(all); setTimeout(function () { renderTraffic(); }, 250); }).catch(function () {}); };
    host.querySelectorAll('[data-tt]').forEach(function (b) { b.onclick = function () { st.tab = b.getAttribute('data-tt'); host.querySelectorAll('[data-tt]').forEach(function (x) { x.classList.toggle('on', x === b); }); paint(); }; });
    function ownerName(osid) { var c = camp(); var rec = osid && c && c.getSheet && c.getSheet(osid); return (rec && rec.json && (rec.json.handle || rec.json.name)) || (osid ? '—' : 'GM'); }
    function paint() { if (st.tab === 'content') paintContent(); else paintSites(); }
    function paintSites() {
      Store.index('site').then(function (all) {
        var rows = all.map(function (r) { var s = r.json; return '<tr data-sid="' + esc(s.id) + '"><td>' + esc(s.name) + (isOnline(s) ? '' : ' <span class="dt-dim">(offline)</span>') + '</td><td>' + esc(ownerName(s.owner)) + '</td><td class="web-tr-num web-tr-traffic">' + computeTraffic(s, all) + '</td><td class="web-tr-num">' + computeAdRevenue(s, all) + 'eb</td><td class="web-tr-num" title="auto: ad/content ratio">' + qualityMult(s).toFixed(2) + '</td><td class="web-tr-num web-tr-rep">' + (parseInt(s.rep, 10) || 0) + '</td><td class="web-tr-num web-tr-bz">' + (parseInt(s.buzz, 10) || 0) + '</td><td><button class="web-mini web-tr-buzz">+buzz</button></td></tr>'; }).join('');
        body.innerHTML = '<table class="web-traffic-tbl"><thead><tr><th>Site</th><th>Owner</th><th>Visits/mo</th><th>Ad rev</th><th>Quality</th><th>Rep</th><th>Buzz</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="8" class="app-empty">No sites.</td></tr>') + '</tbody></table><p class="dt-hint">Quality is auto (ad/content ratio). Buzz is your lever. “Settle month” accrues rep, fades buzz, pays ad revenue.</p>';
        body.querySelectorAll('[data-sid]').forEach(function (tr) { var s = all.filter(function (r) { return r.json.id === tr.getAttribute('data-sid'); })[0].json; tr.querySelector('.web-tr-buzz').onclick = function () { s.buzz = (parseInt(s.buzz, 10) || 0) + 500; Store.put({ type: 'site', id: s.id }, s).then(function () { tr.querySelector('.web-tr-bz').textContent = s.buzz; tr.querySelector('.web-tr-traffic').textContent = computeTraffic(s, all); }).catch(function () {}); }; });
      }).catch(function () { body.innerHTML = '<div class="app-empty" style="padding:24px">Could not load sites.</div>'; });
    }
    function paintContent() {
      Store.index('site').then(function (all) {
        var items = [];
        all.forEach(function (r) { var s = r.json; if (s.app !== 'press') return; var secs = (s.appConfig && s.appConfig.sections) || ['Front']; secs.forEach(function (sec) { var key = s.id + ':feed:' + slugify(sec); pLive(key).forEach(function (p) { if (p.kind === 'story' && p.authorSid) items.push({ p: p, s: s, sec: sec, key: key }); }); }); });
        if (!items.length) { body.innerHTML = '<div class="app-empty" style="padding:24px">No player-published content yet. Stories filed from a newsroom app land here.</div>'; return; }
        body.innerHTML = '<div class="web-content-list"></div><p class="dt-hint">Reach = <b>200 × power × credibility × sourcing × trust-tank</b> (fixed at publish, the story’s “visits/mo”). <b>Buzz</b> is your live lever — boost or bury a story on top.</p>';
        var listEl = body.querySelector('.web-content-list');
        function adjBuzz(o, delta) { var posts = pLive(o.key); posts.forEach(function (x) { if (x.id === o.p.id) x.buzz = (x.buzz || 0) + delta; }); if (camp() && camp().setNetBoard) camp().setNetBoard(o.key, posts); paintContent(); }
        items.forEach(function (o) {
          var p = o.p, rp = p.reachParts || {}, buzz = p.buzz || 0, total = Math.max(0, (p.reach || 0) + buzz);
          var cc = pLive(o.key).filter(function (x) { return x.kind === 'comment' && x.parent === p.id; }).length;
          var det = (rp.power != null) ? ('200 × ' + rp.power + ' pow × ' + rp.cred + ' cred × ' + rp.sourcing + ' src × ' + rp.trust + ' trust = ' + (p.reach || 0) + ' seed') : ('seed ' + (p.reach || 0));
          var row = eln('div', 'web-content-row');
          row.innerHTML = '<div class="web-content-top"><span class="web-content-h">' + esc(p.headline || '(untitled)') + (p.held ? ' <span class="dt-dim">(held)</span>' : '') + '</span><span class="web-content-reach">' + total + ' <small>reach</small></span></div>' +
            '<div class="web-content-m">' + esc(p.handle || 'staff') + ' · ' + esc(o.s.name) + ' · ' + esc(o.sec) + ' · ' + cc + ' comments</div>' +
            '<div class="web-content-calc">' + det + (buzz ? ' <b>' + (buzz > 0 ? '+' : '') + buzz + ' buzz</b> → ' + total : '') + '</div>';
          var acts = eln('div', 'web-content-acts');
          var b1 = eln('button', 'web-mini', '+ buzz'); b1.onclick = function () { adjBuzz(o, 500); };
          var b2 = eln('button', 'web-mini', '++ boost'); b2.onclick = function () { adjBuzz(o, 2000); };
          var b3 = eln('button', 'web-mini', 'bury'); b3.onclick = function () { adjBuzz(o, -(p.reach || 0) - (p.buzz || 0)); };
          acts.appendChild(b1); acts.appendChild(b2); acts.appendChild(b3); row.appendChild(acts);
          listEl.appendChild(row);
        });
      }).catch(function () { body.innerHTML = '<div class="app-empty" style="padding:24px">Could not load content.</div>'; });
    }
    paint();
  }
  /* ═══════════════ QUICK SITE GENERATOR (GM) ═══════════════ */
  function _gPick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function _gPickN(a, n) { var c = a.slice(), o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; }
  function _gInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function _gMoney() { return _gInt(1, 60) * 50; }
  function _gb(type, extra) { var b = { id: uid('b'), type: type }; if (extra) Object.keys(extra).forEach(function (k) { b[k] = extra[k]; }); return b; }
  function _gpage(name, slug, blocks, home) { return { id: uid('pg'), name: name, slug: slug || '', home: !!home, blocks: blocks || [] }; }
  function _gL(arr) { return arr.join('\n'); }
  function _gShuf(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function _gMaybe(p, v) { return Math.random() < p ? v : null; }
  var _G_ADJ = ['Neon', 'Chrome', 'Black', 'Red', 'Silent', 'Broken', 'Iron', 'Ghost', 'Midnight', 'Toxic', 'Golden', 'Electric', 'Savage', 'Velvet', 'Hollow', 'Feral', 'Crimson', 'Static', 'Wired', 'Rusted', 'Cold', 'Burning', 'Fractured', 'Grey', 'Obsidian', 'Sacred', 'Profane', 'Hungry', 'Last', 'Lost', 'Nameless', 'Screaming', 'Whispered', 'Bleeding', 'Neon-lit', 'Concrete', 'Plastic', 'Glass', 'Acid', 'Numb', 'Dead', 'Holy', 'Rogue', 'Zero', 'Bootleg', 'Off-grid', 'Analog', 'Deep', 'Low', 'High'];
  var _G_NOUN = ['Dragon', 'Circuit', 'Lotus', 'Wolf', 'Byte', 'Katana', 'Halo', 'Serpent', 'Ronin', 'Spike', 'Angel', 'Rat', 'Phoenix', 'Bazaar', 'Exchange', 'Foundry', 'Den', 'Alley', 'Kiosk', 'Vault', 'Nail', 'Fang', 'Signal', 'Static', 'Mirror', 'Ash', 'Ember', 'Wire', 'Ghost', 'Saint', 'Hollow', 'Needle', 'Chapel', 'Market', 'Garage', 'Clinic', 'Lounge', 'Frequency', 'Relay', 'Node', 'Cache', 'Drop', 'Loop', 'Cradle', 'Grave', 'Nest', 'Cortex', 'Shell', 'Verse', 'Choir'];
  var _G_CORP = ['Arasaka', 'Militech', 'Zetatech', 'Kendachi', 'Microtech', 'Petrochem', 'Biotechnica', 'Orbital Air', 'Continental Brands', 'Dynalar', 'Raven Microcybernetics', 'IEC', 'Trauma Team', 'SovOil', 'EBM', 'WorldSat', 'Infocomp', 'Network 54', 'DMS', 'Nomad Wares', 'Segotari', 'Militech Financial', 'Lazarus', 'Sunburst', 'World News Service', 'CINO', 'Petrochem Refining'];
  var _G_STREET = ['no refunds, no questions, no cops.', 'discretion guaranteed.', 'walk-ins welcome, snitches flatlined.', 'prices in eb, cash or credchip.', 'we were here before the collapse.', 'Netwatch can’t read what isn’t written.', 'if you have to ask, you can’t afford it.', 'quality you can bleed on.', 'open when the sign is lit.', 'no chrome we won’t fit.', 'ask for the back room.', 'we don’t do warranties, we do results.', 'the corps hate this one trick.', 'first rule: you were never here.', 'cheaper than the alternative.', 'built to outlast you.', 'mention the password, skip the markup.', 'trusted since the Fourth Corporate War.', 'we take eddies, favors, or blood.', 'off-grid and proud.', 'don’t bring what you can’t carry out.', 'the house always eats.', 'bring cash. bring backup.', 'still standing. still cheaper.'];
  var _G_GOODS = ['Militech Avenger', 'armor weave', 'a pain editor', 'Kiroshi optics', 'black ICE', 'deck mods', 'synthcoke', 'a clean SIN', 'ripper tools', 'ammo (all calibers)', 'a cold pistol', 'skinweave', 'combat drugs', 'a fake passport', 'a monowire', 'reflex boosters', 'a Kendachi Mono-Three', 'trauma patches', 'stealth cyberware', 'a Militech Ronin', 'braindance wipes', 'a Malorian 3516', 'subdermal armor', 'a burner agent', 'cyberdeck RAM', 'anti-personnel rounds', 'a Techtronika drone', 'nasal filters', 'a smart pistol', 'grip-tape gloves', 'street slang chips', 'a chipped Kiroshi', 'a scrambler', 'a used cyberarm', 'discreet delivery', 'a nomad rig part', 'ICE-breaker suites', 'a forged permit', 'painkillers by the case', 'a very quiet knife'];
  var _G_DISTRICT = ['City Center', 'the Corporate Center', 'Downtown', 'Old Downtown', 'the Combat Zone', 'Little Italy', 'Japantown', 'Charter Hill', 'The Glen', 'Heywood', 'Rancho Coronado', 'North Oak', 'Westbrook', 'the Docks', 'Night City Harbor', 'the University District', 'South Night City', 'Pacifica'];
  var _G_NAME = ['Rook', 'Vex', 'Dex', 'Nix', 'Padre', 'Mama Welles', 'Wakako', 'Kirk', 'Sasha', 'Ozob', 'Bes', 'Jotaro', 'Regina', 'Cassidy', 'Viktor', 'Grease', 'the Fixer', 'El Capitán', 'Muamar', 'Denny', 'Henry', 'Blue Moon', 'the Twins', 'a woman with no name', 'Old Pete', 'Slick', 'Doc', 'the Broker'];
  function _gYear() { return _gInt(1988, 2019); }  // CP2020 — a plausible PAST founding year
  // Template engine: {adj} {noun} {corp} {district} {name} {goods} {money} {gang} filled from the pools.
  function _gT(s) {
    return String(s).replace(/\{adj\}/g, function () { return _gPick(_G_ADJ); }).replace(/\{noun\}/g, function () { return _gPick(_G_NOUN); })
      .replace(/\{corp\}/g, function () { return _gPick(_G_CORP); }).replace(/\{district\}/g, function () { return _gPick(_G_DISTRICT); })
      .replace(/\{name\}/g, function () { return _gPick(_G_NAME); }).replace(/\{goods\}/g, function () { return _gPick(_G_GOODS); })
      .replace(/\{money\}/g, function () { return _gMoney().toLocaleString(); }).replace(/\{gang\}/g, function () { return 'the ' + _gPick(_G_ADJ) + ' ' + _gPick(['Kings', 'Saints', 'Wolves', 'Fangs', 'Reapers', 'Ghosts', 'Valentinos', 'Animals']); });
  }
  function _gTN(pool, n) { return _gPickN(pool, n).map(_gT); } // sample n, then template each
  function genName(k) {
    if (k === 'corp') return _gPick(_G_CORP) + ' ' + _gPick(['Global', 'Industries', 'Corp', 'Group', 'Holdings', 'Systems', 'Dynamics', 'Consolidated', 'International', 'Division', 'Partners', 'Labs']);
    if (k === 'news') return _gPick(['Night City', 'Street', 'Combat Zone', 'Data', 'Neon', _gPick(_G_DISTRICT), 'Free', 'The Daily']) + ' ' + _gPick(['Screamsheet', 'Wire', 'Feed', 'Daily', 'Tribune', 'Static', 'Report', 'Ledger', 'Dispatch', 'Bugle', 'Signal']);
    if (k === 'gang') return _gPick([_gT('the {adj} {noun}s'), _gT('{gang}'), 'The ' + _gPick(_G_ADJ) + ' ' + _gPick(['Kings', 'Saints', 'Wolves', 'Ghosts', 'Fangs', 'Reapers', 'Sabres', 'Angels'])]);
    if (k === 'fixer') return _gPick(_G_NAME) + '’s ' + _gPick(['Board', 'List', 'Rolodex', 'Line', 'Corner', 'Rooms', 'Network', 'Table']);
    if (k === 'clinic') return _gPick([_gPick(_G_NAME) + '’s ' + _gPick(['Clinic', 'Chop Shop', 'Ripperdoc', 'Surgery', 'Garage']), _gT('{adj} {noun} Cyberware'), 'The Meat Locker', 'Back-Alley Augmentics']);
    if (k === 'bar') return _gPick([_gT('the {adj} {noun}'), _gT('{noun} & {noun}'), 'Club ' + _gPick(_G_NOUN), _gPick(_G_NAME) + '’s']);
    if (k === 'cult') return _gPick([_gT('Church of the {adj} {noun}'), _gT('the {noun} of {noun}'), 'The ' + _gPick(_G_ADJ) + ' Communion', 'Order of ' + _gPick(_G_NOUN)]);
    if (k === 'personal') return _gPick([_gPick(_G_NAME) + '’s ' + _gPick(['Page', 'Corner', 'Zone', 'Site', 'Homepage', 'Diary']), _gT('{adj}{noun}').toLowerCase() + '.dat', _gT('{name}_{noun}').toLowerCase()]);
    return _gPick([_gT('{adj} {noun}'), _gT('the {adj} {noun}'), _gT('{noun} & {noun}'), _gPick(_G_NAME) + '’s ' + _gPick(_G_NOUN)]);
  }
  // A hero replacement that actually renders: a textured section band with a centered slogan,
  // or a pullquote when no textures. Never repeats the site name (the header carries that).
  function _gBanner(I, slogan, sub) {
    var texs = I && I.texs;
    if (texs && texs.length && Math.random() < 0.7) {
      var body = [_gb('heading', { text: slogan, level: '2', accent: true })];
      if (sub) body.push(_gb('text', { body: sub }));
      return _gb('section', { title: '', pad: 'l', bg: texUrl(_gPick(texs)), slots: { body: body } });
    }
    return _gb('pullquote', { text: slogan, cite: sub || '' });
  }
  // Structural diversifier — shuffles the body, occasionally splits into an extra page, and sprinkles
  // a decorative block, so two rolls of the same archetype come out organized differently.
  function _gDiversify(pages, I) {
    if (!pages || !pages.length) return pages;
    var home = pages.filter(function (p) { return p.home; })[0] || pages[0];
    var bl = home.blocks || [];
    var lead = 0; while (lead < bl.length && lead < 4 && ['navbar', 'header', 'section', 'pullquote'].indexOf(bl[lead].type) >= 0) lead++;
    var tail = bl.length; while (tail > lead && bl[tail - 1].type === 'footer') tail--;
    var head = bl.slice(0, lead), mid = bl.slice(lead, tail), foot = bl.slice(tail);
    if (mid.length > 2) mid = _gShuf(mid);
    if (mid.length && Math.random() < 0.4) mid.splice(_gInt(0, mid.length), 0, _gPick([
      _gb('divider', { style: _gPick(['line', 'double', 'dashed']) }),
      _gb('marquee', { text: _gT('{adj} {noun} — ') + _gPick(_G_STREET) }),
      _gb('badge', { text: _gPick(['off-grid', 'no SIN', 'est. ' + _gYear(), 'mirrored', 'anon']) }),
      _gb('spacer', {})]));
    if (mid.length >= 4 && Math.random() < 0.5) {
      var cut = _gInt(2, mid.length - 1), moved = mid.splice(cut);
      var pn = _gPick(['More', 'Info', 'Log', 'Notes', 'Archive', 'Extras', 'The Back', 'Deep', 'Ledger', 'Files']);
      pages.push(_gpage(pn, slugify(pn) + '-' + _gInt(10, 999), [_gb('header', { title: pn })].concat(moved)));
    }
    home.blocks = head.concat(mid, foot);
    return pages;
  }
  var SITE_ARCHETYPES = [
    { key: 'shop', label: 'Storefront', icon: '▣', preset: 'plain', build: function (I) {
      var g = _gPickN(_G_GOODS, _gInt(4, 6));
      return [
        _gpage('Home', '', [_gb('navbar'), _gb('header', { title: I.name, tagline: I.hook || _gPick(['the block’s worst-kept secret', 'open all night', 'everything, no questions']), accent: true, rule: true }),
          _gBanner(I, _gPick(_G_STREET), _gT(_gPick(['walk-ins welcome', 'ask for the back room', 'cash or credchip only', 'no {corp} garbage']))),
          _gb('text', { body: _gPick(['Welcome to ' + I.name + '. ', 'You found us. ', _gT('Serving {district} since ') + _gYear() + '. ']) + _gPick(_G_STREET) + ' ' + _gPick(_G_STREET) }),
          _gb('heading', { text: 'On the shelves', caps: true, accent: true }), _gb('list', { items: _gL(g), style: 'arrow' }),
          _gb('notice', { title: 'House rules', text: _gPick(_G_STREET), tone: 'warn', icon: '⚠' }), _gb('footer', { text: I.name + ' · est. ' + _gYear() })], true),
        _gpage('Stock', 'stock', [_gb('heading', { text: 'Full stock', caps: true }), _gb('list', { title: 'Priced to move', items: _gL(g.map(function (x) { return x + ' — ' + _gMoney() + 'eb'; })), style: 'dash' }), _gb('notice', { text: 'Ask about bulk. No layaway.', tone: 'info' })]),
        _gpage('Contact', 'contact', [_gb('heading', { text: 'Find us' }), _gb('text', { body: 'Back room. Ask for ' + _gPick(['the manager', 'Rook', 'Mama Vex', 'the fixer']) + '.' }), _gb('notice', { title: 'Hours', text: 'Dusk ’til whenever.', tone: 'info' })])
      ];
    } },
    { key: 'corp', label: 'Corp', icon: '⌗', preset: 'corp', build: function (I) {
      var div = _gPickN(['Cybernetics', 'Security Solutions', 'Biotech', 'Media & Entertainment', 'Logistics', 'Aerospace', 'Data Services', 'Pharmaceuticals', 'Robotics', 'Financial Services', 'Weapons Systems', 'Urban Development', 'Agritech', 'Orbital Operations', 'Private Security', 'Braindance Studios'], _gInt(3, 6));
      return [
        _gpage('Home', '', [_gb('navbar'), _gb('header', { title: I.name, tagline: I.hook || _gPick(['Building tomorrow.', 'A better future, delivered.', 'Trust. Power. Progress.', 'Your world, optimized.', 'Beyond the horizon.', 'We invest in humanity.', 'Progress is our product.']), accent: true }),
          _gBanner(I, _gPick(['Shaping the world since the fall.', 'Global reach. Local control.', 'Building the future you were promised.', 'Trusted by governments and the desperate alike.', 'A safer tomorrow, by contract.']), _gT('Operating in {district} and beyond.')),
          _gb('heading', { text: 'Divisions' }), _gb('list', { items: _gL(div), style: 'check', cols: '2' }),
          _gb('text', { body: 'At ' + I.name + ', we deliver value to shareholders and citizens alike across ' + _gInt(6, 40) + ' megacities.' }), _gb('footer', { text: '© 2020 ' + I.name + '. All rights reserved.' })], true),
        _gpage('About', 'about', [_gb('heading', { text: 'Our story' }), _gb('text', { body: 'Founded in ' + _gYear() + ', ' + I.name + ' rose from the ashes of the Collapse to become a leader in ' + _gPick(div) + '.' }),
          _gb('profile', { name: _gPick(['R. Nakamura', 'V. Kessler', 'D. Okoye', 'M. Vasquez']), role: 'Chief Executive', bio: 'A visionary leader with zero tolerance for failure.' }), _gb('quote', { text: 'Progress is not negotiable.', cite: 'Office of the CEO' })]),
        _gpage('Careers', 'careers', [_gb('heading', { text: 'Join us' }), _gb('list', { title: 'Open positions', items: _gL(['Security contractor', 'Netrunner (cleared)', 'Field agent', 'Corporate liaison']), style: 'arrow' }), _gb('notice', { title: 'Note', text: 'All applicants subject to background verification.', tone: 'info' })])
      ];
    } },
    { key: 'news', label: 'News / screamsheet', icon: '▤', preset: 'zine', build: function (I) {
      var head = _gTN(['Corp war spills into {district}', 'Cyberpsycho loose in {district}', 'Fixer found flatlined in {district}', 'New drug floods {district}', 'Netwatch raids {corp} server farm', 'Gang truce collapses in {district}', 'Trauma Team strike threatened', '{corp} denies {district} cover-up', 'Bodies pile up as {gang} moves on {district}', '{corp} exec vanishes overnight', 'Blackout hits {district} for a third night', 'Braindance ring busted in {district}', '{gang} claims the {district} docks', 'Water rationing begins in {district}', 'AV crash scatters {money}eb of cargo', 'Rogue AI rumored loose in the Old Net'], _gInt(4, 7));
      return [
        _gpage('Front', '', [_gb('header', { title: I.name, tagline: I.hook || 'The street’s only honest feed.', rule: true }), _gb('marquee', { text: 'BREAKING — ' + _gPick(head) + ' — more inside — ' }),
          _gb('heading', { text: head[0], level: '1' }), _gb('text', { body: _gPick(_G_STREET) + ' Sources say the situation is developing. Stay tuned, choombas.', dropcap: true }), _gb('divider', { style: 'double' }),
          _gb('list', { title: 'Also today', items: _gL(head.slice(1)), style: 'dash' }), _gb('footer', { text: I.name + ' · filed from ' + (I.region || 'NC') })], true),
        _gpage('Story', 'story', [_gb('heading', { text: head[0] }), _gb('text', { body: 'Full report. ' + _gPick(_G_STREET) + ' Eyewitnesses describe chaos. Officials declined to comment.' }), _gb('pullquote', { text: 'I’ve never seen anything like it.', cite: 'a bystander' })])
      ];
    } },
    { key: 'forum', label: 'Forum / BBS', icon: '▦', preset: 'bbs', build: function (I) {
      return [
        _gpage('Main', '', [_gb('header', { title: I.name, tagline: I.hook || 'talk freely. we’re all anon here.' }), _gb('navbar'), _gb('notice', { title: 'Rules', text: 'No doxxing. No corps. No cops. Lurk before you post.', tone: 'warn' }), _gb('board', { title: 'General' }), _gb('compose', { placeholder: 'say something…' })], true),
        _gpage('Trades', 'trades', [_gb('header', { title: I.name + ' — trades' }), _gb('navbar'), _gb('board', { title: 'Buy / sell / trade' }), _gb('compose', { placeholder: 'WTS / WTB…' })])
      ];
    } },
    { key: 'fixer', label: 'Fixer board', icon: '⌸', preset: 'terminal', build: function (I) {
      var gig = _gPickN(['Extraction — {corp} defector, {money}eb', 'Recover stolen data from {district}, negotiable', 'Bodyguard, one night, {money}eb', 'Wetwork — don’t ask, {money}eb', 'Escort a package through {district}, no questions', 'Sabotage {corp} in {district}, {money}eb', 'Steal a prototype from {corp}, {money}eb', 'Scare off {gang}, {money}eb', 'Find a missing {name}, {money}eb', 'Drive, no questions, {money}eb', 'Plant evidence on a mark, {money}eb', 'Guard a meet in {district}, {money}eb'], _gInt(3, 6)).map(_gT);
      return [
        _gpage('Board', '', [_gb('header', { title: I.name, tagline: I.hook || 'gigs for those who can keep quiet', accent: true }), _gb('notice', { text: 'No timewasters. No heroes. Payment on completion.', tone: 'danger', icon: '☠' }),
          _gb('heading', { text: 'Open gigs', caps: true }), _gb('list', { items: _gL(gig), style: 'arrow' }), _gb('board', { title: 'Chatter' }), _gb('compose', { placeholder: 'reply to a gig (be discreet)…' })], true)
      ];
    } },
    { key: 'personal', label: 'Personal / geocities', icon: '☘', preset: 'geocities', build: function (I) {
      var likes = _gPickN(['braindances', 'old chrome', 'my cat', 'synthwave', 'street racing', 'conspiracy theories', 'retro decks', 'noodles from Tom’s', 'the Old Net', 'analog cameras', 'my gang', 'rooftop gardens', 'pirate radio', 'stray drones', 'cheap ramen', 'ancient anime', 'lockpicking', 'my deck'], _gInt(3, 6));
      return [
        _gpage('Home', '', [_gb('header', { title: I.name + '’s corner of the net' }), _gb('marquee', { text: '~*~ welcome to my page ~*~ sign my guestbook ~*~' }), _gb('text', { body: I.hook || 'hi!! this is my page. still under construction lol. more soon!!' }),
          _gb('heading', { text: 'stuff i like' }), _gb('list', { items: _gL(likes), style: 'disc' }), _gb('counter', { label: 'visitors since 2020', value: _gInt(3, 9999) }), _gb('badge', { text: 'Best viewed in Netscape' }), _gb('footer', { text: 'made with ♥ on a stolen deck' })], true),
        _gpage('Links', 'links', [_gb('heading', { text: 'cool links' }), _gb('list', { items: _gL(['my friend’s page', 'the best noodle bar', 'free deck mods (sketchy)', 'webring →']), style: 'arrow' }), _gb('badge', { text: 'Y2K compliant' })])
      ];
    } },
    { key: 'gang', label: 'Gang', icon: '☠', preset: 'zine', build: function (I) {
      var turf = _gPickN(_G_DISTRICT.concat(['the docks', 'the old subway', 'the market', 'the overpass']), _gInt(2, 5));
      return [_gpage('Home', '', [_gb('header', { title: I.name, tagline: I.hook || 'our block. our rules.', accent: true }),
        _gBanner(I, _gPick(['cross us and bleed', 'family til the end', 'we run this block', 'blood in, blood out', 'this is our street'])),
        _gb('manifesto', { title: _gPick(['The code', 'Our law', 'The rules']), body: _gPick(['Loyalty above all. ', 'Blood is the price. ', 'The block comes first. ']) + _gPick(_G_STREET) + _gPick([' Rats get the knife.', ' Snitches don’t heal.', ' No exceptions.']) }),
        _gb('heading', { text: 'Our turf', caps: true }), _gb('list', { items: _gL(turf), style: 'arrow' }),
        _gb('wanted', { name: _gPick(['a rival boss', 'the snitch', 'a corpo rat']), crime: 'crossed the ' + I.name, reward: _gMoney() + 'eb' }),
        _gb('board', { title: 'Word on the street' }), _gb('footer', { text: I.name + ' — respect or bleed' })], true)];
    } },
    { key: 'clinic', label: 'Ripperdoc', icon: '✚', preset: 'plain', build: function (I) {
      var svc = _gPickN(['neural link install', 'reflex boosters', 'skinweave', 'optics swap', 'organ patch', 'detox', 'chrome removal', 'blackmarket implants', 'subdermal armor', 'pain editor tune-up', 'memory wipe', 'SIN scrub', 'cyberarm fitting', 'wound sealing', 'gland install', 'jailbroken firmware'], _gInt(4, 7));
      return [_gpage('Home', '', [_gb('header', { title: I.name, tagline: I.hook || 'chrome & repair, no SIN required' }),
        _gb('text', { body: 'Walk-in ripperdoc. ' + _gPick(['Clean tools, mostly.', 'Anesthetic is extra.', 'Cash up front.']) }),
        _gb('heading', { text: 'Services', caps: true }), _gb('list', { title: 'Menu', items: _gL(svc.map(function (s) { return s + ' — ' + _gMoney() + 'eb'; })), style: 'dash' }),
        _gb('notice', { title: 'Aftercare', text: 'Humanity loss is your problem, not ours.', tone: 'warn', icon: '⚠' }),
        _gb('profile', { name: _gPick(['Doc Vex', 'Ripper Jane', 'Old Sasha']), role: 'Ripperdoc', bio: 'Twenty years of chrome. Steady hands, no questions.' })], true)];
    } },
    { key: 'cult', label: 'Cult / church', icon: '✟', preset: 'paper', build: function (I) {
      return [_gpage('Home', '', [_gb('header', { title: I.name, tagline: I.hook || 'the flesh is weak. the code is eternal.', accent: true, align: 'center' }),
        _gBanner(I, _gPick(['ascend beyond the meat', 'the net is god', 'join us in the deep', 'the flesh is a prison', 'upload and be free'])),
        _gb('manifesto', { title: _gPick(['Our creed', 'The doctrine', 'What we know']), body: _gPick(['We reject the tyranny of flesh.', 'The Old Net remembers. So do we.', 'Bartmoss lives in the wires.', 'The body is a rough draft.', 'Death is a bandwidth problem.']) + ' ' + _gPick(_G_STREET) }),
        _gb('quote', { text: 'When the body fails, the mind uploads.', cite: 'The First Sermon' }),
        _gb('list', { title: 'Gatherings', items: _gL(['Sunday — the Deep Dive', 'Wednesday — flesh-fasting', 'Full moon — the Uploading']), style: 'none' }), _gb('footer', { text: 'ascend or perish' })], true)];
    } },
    { key: 'bar', label: 'Bar / club', icon: '♪', preset: 'neon', build: function (I) {
      return [_gpage('Home', '', [_gb('header', { title: I.name, tagline: I.hook || 'drinks, beats, and no questions' }),
        _gBanner(I, _gPick(['the night never ends', 'where the street unwinds', 'loud, dark, ours', 'drink til the chrome shines', 'no cover, no cops'])),
        _gb('marquee', { text: '♪ LIVE TONIGHT ♪ ' + _gPick(['synthwave', 'chrome punk', 'a braindance DJ set', _gT('{name} on the decks'), 'industrial noise', 'a nomad string band']) + ' ♪ ' }),
        _gb('text', { body: 'Open dusk til dawn. ' + _gPick(['Chrome bar.', 'Braindance lounge upstairs.', 'Ask the bartender for the good stuff.']) }), _gb('footer', { text: I.name })], true),
        _gpage('Events', 'events', [_gb('heading', { text: 'This week' }), _gb('list', { items: _gL(['Fri — ' + _gPick(_G_ADJ) + ' ' + _gPick(_G_NOUN), 'Sat — open decks', 'Sun — chill & chrome']), style: 'arrow' })])];
    } }
  ];
  function _gDress(b, vibe, texs) {
    if (!texs.length) return;
    var pTex = vibe === 'chaotic' ? 0.5 : vibe === 'lively' ? 0.22 : 0, pFont = vibe === 'chaotic' ? 0.4 : vibe === 'lively' ? 0.16 : 0;
    var ok = ['header', 'hero', 'heading', 'text', 'list', 'notice', 'quote', 'pullquote', 'manifesto', 'footer', 'profile', 'wanted'];
    if (ok.indexOf(b.type) < 0) return;
    if (Math.random() < pTex) b.bg = { tex: _gPick(texs), mode: _gPick(['tile', 'tile', 'cover']), scrim: 'light' };   // light scrim keeps the default dark text readable
    if (Math.random() < pFont) b.font = _gPick(WEB_FONTS.slice(1))[1];
  }
  function _gDressPages(pages, vibe, texs) { (pages || []).forEach(function (p) { (p.blocks || []).forEach(function (b) { _gDress(b, vibe, texs); }); }); }
  function openSiteGenerator() {
    if (!window.UI) return;
    var arch = SITE_ARCHETYPES[0].key;
    var presets = ['auto', 'plain', 'terminal', 'bbs', 'zine', 'geocities', 'corp', 'chrome', 'neon', 'paper'];
    UI.modal({
      title: 'Generate a site', size: 'wide',
      body: '<div class="gen-arch" id="gen-arch">' + SITE_ARCHETYPES.map(function (a) { return '<button class="gen-arch-b' + (a.key === arch ? ' active' : '') + '" data-arch="' + a.key + '"><span class="gen-arch-i">' + a.icon + '</span><span>' + esc(a.label) + '</span></button>'; }).join('') + '</div>' +
        '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="gen-name" placeholder="blank = roll a random name"></label>' +
        '<label class="rt-field"><span class="rt-field-l">Hook / subject</span><input class="rt-input" id="gen-hook" placeholder="one line — what it’s about (optional)"></label>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="rt-field" style="flex:1;min-width:120px"><span class="rt-field-l">Region</span><input class="rt-input" id="gen-region" value="nc"></label>' +
          '<label class="rt-field" style="flex:1;min-width:120px"><span class="rt-field-l">Broadcast</span><select class="rt-select" id="gen-bc">' + BROADCAST.map(function (b) { return '<option' + (b === 'citywide' ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select></label>' +
          '<label class="rt-field" style="flex:1;min-width:120px"><span class="rt-field-l">Look</span><select class="rt-select" id="gen-preset">' + presets.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></label>' +
          '<label class="rt-field" style="flex:1;min-width:110px"><span class="rt-field-l">Vibe</span><select class="rt-select" id="gen-vibe"><option value="clean">clean</option><option value="lively" selected>lively</option><option value="chaotic">chaotic</option></select></label>' +
          '<label class="rt-field" style="flex:1;min-width:110px"><span class="rt-field-l">Font</span><select class="rt-select" id="gen-font">' + WEB_FONTS.map(function (op) { return '<option value="' + esc(op[1]) + '">' + esc(op[0] === 'preset default' ? 'auto' : op[0]) + '</option>'; }).join('') + '</select></label></div>' +
        '<p class="dt-hint">Rolls a multi-page site with placeholder content you can tweak. Change the type or hit Generate again for a different roll.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Generate', kind: 'primary', onClick: function (box) { doGenerate(box); } }],
      onShow: function (box) { box.querySelectorAll('[data-arch]').forEach(function (b) { b.onclick = function () { arch = b.getAttribute('data-arch'); box.querySelectorAll('[data-arch]').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); }; }); }
    });
    function doGenerate(box) {
      var a = SITE_ARCHETYPES.filter(function (x) { return x.key === arch; })[0]; if (!a) return;
      var I = { name: (box.querySelector('#gen-name').value || '').trim(), hook: (box.querySelector('#gen-hook').value || '').trim(), region: (box.querySelector('#gen-region').value || 'nc').trim(), broadcast: box.querySelector('#gen-bc').value, preset: box.querySelector('#gen-preset').value, vibe: box.querySelector('#gen-vibe').value, font: box.querySelector('#gen-font').value };
      if (!I.name) I.name = genName(arch);
      loadTextures(function (texs) {
        var site = blankSite(I.name);
        site.region = I.region || 'nc'; site.broadcast = I.broadcast; site.record.broadcast = I.broadcast;
        site.theme = { preset: (I.preset && I.preset !== 'auto') ? I.preset : a.preset, overrides: {} };
        if (I.font) site.theme.overrides.font = I.font;
        I.texs = texs;
        site.pages = a.build(I);
        _gDiversify(site.pages, I);
        if (I.vibe && I.vibe !== 'clean') _gDressPages(site.pages, I.vibe, texs);
        if (!site.pages.some(function (p) { return p.home; })) site.pages[0].home = true;
        site.lastEdit = netClock();
        Store.create('site', site).then(function (made) { UI.close(); if (br().logSession) br().logSession('Generated ' + a.label + ': ' + I.name); Shell.openEntity('site', made.json.id, made.json.name); }).catch(function (e) { alert('Could not create the site: ' + ((e && e.message) || e)); });
      });
    }
  }

  /* ═══════════ POPULATE WEB — one-click generator for a living Net (GM only) ═══════════
     Order: hosts (corpo / indie / underground) → press outlets on those hosts → chat & block
     sites → seeded stories/comments/personas → monetization catalog → starting traffic.
     Curated pools + light per-run variation; idempotent (dedup sites by name, catalog by gen key). */
  // A small, DIVERSIFIED set of hosts (3-4 max) — distinct offers, not a swarm.
  var POP_HOSTLIST = [
    { fac: 'corpo', name: 'Arasaka Datafort', blurb: 'Enterprise hosting. Fully compliant, Netwatch-audited, global reach. Priced accordingly.', cfg: { price: 800, legality: 3, netwatchCoop: 3, reliability: 3, reachGranted: 'global', anonymity: 0 } },
    { fac: 'corpo', name: 'Militech Managed Cloud', blurb: 'Turnkey managed hosting. SLA-backed, corporate-clean, national reach.', cfg: { price: 400, legality: 3, netwatchCoop: 2, reliability: 3, reachGranted: 'national', anonymity: 0 } },
    { fac: 'indie', name: 'Night City Mirror', blurb: 'Independent hosting for the rest of us. Best-effort uptime, no masters, no snooping.', cfg: { price: 150, legality: 1, netwatchCoop: 1, reliability: 2, reachGranted: 'national', anonymity: 2 } },
    { fac: 'under', name: 'GhostGrid', blurb: 'No logs. No names. No questions. Mirrored everywhere, and very hard to kill.', cfg: { price: 60, legality: 0, netwatchCoop: 0, reliability: 1, reachGranted: 'citywide', anonymity: 3 } }
  ];
  var POP_OUTLETS = [
    { fac: 'corpo', layout: 'tvnews', angle: 'corpo', name: 'Network 54 News', tag: 'The city, as it should be seen.', secs: ['Top', 'City', 'Markets'] },
    { fac: 'corpo', layout: 'corporate', angle: 'corpo', name: 'NC Business Wire', tag: 'Official markets & corporate affairs.', secs: ['Corp', 'Markets'] },
    { fac: 'corpo', layout: 'broadsheet', angle: 'state', name: 'The Standard', tag: 'Night City’s paper of record.', secs: ['Front', 'City', 'Corp'] },
    { fac: 'indie', layout: 'broadsheet', angle: 'independent', name: 'Street Signal', tag: 'From the pavement up.', secs: ['Front', 'Crime', 'Streets'] },
    { fac: 'indie', layout: 'wire', angle: 'independent', name: 'The Wire Service', tag: 'Just the feed.', secs: ['Wire'] },
    { fac: 'indie', layout: 'gossip', angle: 'sensational', name: 'Night City Confidential', tag: 'Everyone’s business.', secs: ['Gossip', 'Stars'] },
    { fac: 'under', layout: 'zine', angle: 'activist', name: 'SAMIZDAT', tag: 'Print it before they scrub it.', secs: ['Front', 'Dissent'] },
    { fac: 'under', layout: 'video', angle: 'sensational', name: 'PULSE', tag: 'You had to be there. Now you are.', secs: ['Trending', 'Clips'], formats: ['video', 'clip', 'short'] },
    { fac: 'under', layout: 'tabloid', angle: 'sensational', name: 'THE SCREAM', tag: 'Louder than the truth.', secs: ['Front', 'Shock'] },
    { fac: 'under', layout: 'live', angle: 'activist', name: 'GHOST FREQ', tag: 'Broadcasting from a moving van.', secs: ['Live'], formats: ['live', 'stream'] }
  ];
  var POP_CHATS = [
    { app: 'consumer', name: 'PONY', preset: 'chrome', cfg: { variant: 'consumer', channels: ['general', 'trade', 'venting'], dm: true, presence: true, gateWhole: false, psa: '' } },
    { app: 'runner-comms', name: 'BLACKICE', preset: 'terminal', cfg: { variant: 'elite', channels: ['ops', 'jobs'], dm: true, presence: false, gateWhole: true, psa: 'Trust no relay.' } },
    { app: 'public', name: 'NC PUBLIC ACCESS', preset: 'bbs', cfg: { variant: 'public', channels: ['notices', 'complaints'], dm: false, presence: true, gateWhole: false, psa: '' } }
  ];
  var POP_CRED = { corpo: [68, 88], indie: [48, 68], under: [22, 46] };
  var POP_REACH = { corpo: [2000, 9000], indie: [800, 4200], under: [1500, 12000] };
  var POP_DISTRICTS = ['City Center', 'Heywood', 'Pacifica', 'the Combat Zone', 'Westbrook', 'Japantown', 'The Glen', 'Rancho Coronado', 'Little Italy', 'the Docks'];
  var POP_STARS = ['Johnny Silverhand', 'Kerry Eurodyne', 'Rache Bartmoss', 'a Samurai roadie', 'a corporate heir', 'a Night City anchor'];
  var POP_BODIES = ['The record is thin, the timing convenient.', 'Everyone we asked declined to comment.', 'Follow it far enough and it ends at a familiar tower.', 'Three sources, one story, no names.', 'By morning the page may be gone. Screenshot accordingly.'];
  var POP_CHATTER = ['anyone got eyes on the Watson job?', 'prices went up again, thanks corpo', 'lmao did you see the feed', 'need a ripperdoc who won’t talk', 'meet at the usual, bring cash', 'saw netwatch sniffing the relay, be careful', 'who’s running tonight', 'that story was 100% bought'];
  var POP_PRESETS = ['plain', 'terminal', 'bbs', 'zine', 'geocities', 'corp', 'chrome', 'neon', 'paper'];
  var POP_ARCH = ['shop', 'corp', 'news', 'forum', 'fixer', 'personal', 'gang', 'clinic', 'cult', 'bar'];
  var POP_FORUM = ['WTB clean SIN, will pay premium.', 'anyone run the Watson job last night? radio silence since.', 'ripperdoc rec? mine flatlined a client.', 'prices at the market doubled. corpo greed.', 'PSA: netwatch sweep in Kabuki, lay low.', 'selling deck mods, DM for the list.', 'that outlet is 100% bought, don’t trust it.', 'lost a friend to Trauma Team billing. never again.', 'looking for a fixer who doesn’t skim.', 'the water’s off in Pacifica again.', 'saw an AV over the Glen at 3am, anyone else?', 'new gang tag on 6th, watch yourselves.', 'is this host safe or is netwatch reading?', 'first.'];
  var POP_LIVE = { quiet: { cmtLo: 0, cmtHi: 2, postLo: 0, postHi: 2, chatLo: 0, chatHi: 2 }, lively: { cmtLo: 1, cmtHi: 4, postLo: 2, postHi: 6, chatLo: 1, chatHi: 4 }, buzzing: { cmtLo: 3, cmtHi: 8, postLo: 4, postHi: 12, chatLo: 3, chatHi: 8 } };
  var POP_HEADS = {
    corpo: [['{corp} Posts Record Quarter', 'Analysts credit “disciplined leadership” as shares climb.'], ['City Signs {corp} Security Deal', 'Officials cite public safety; the details are sealed.'], ['{corp} Unveils Next-Gen Line', 'A spokesperson calls it “a new standard for living.”']],
    state: [['Council Approves {district} Redevelopment', 'Residents to be “relocated with support,” officials say.'], ['Curfew Extended in {district}', 'NCPD cites “ongoing stabilization efforts.”']],
    independent: [['Inside the {district} Evictions: Who Profits', 'Documents the city didn’t want you to read.'], ['The {corp} Contract Nobody Voted For', 'Follow the money — it ends where you’d expect.'], ['They Cut the Water in {district}', 'We asked why. Nobody would answer.']],
    activist: [['LEAK: {corp} Knew', 'A source inside the fort sent us everything.'], ['{district} Is Watching Back', 'How the neighborhood mapped every camera.']],
    sensational: [['EXCLUSIVE: {star}’s Midnight Meltdown', 'Sources swear the braindance was real.'], ['Is {corp}’s CEO a Construct?', 'You won’t believe what our “expert” says.'], ['{star} Seen Leaving {district} at 3 A.M.', 'We have the footage. You have the questions.']]
  };
  function _popGrid() { return { x: Math.max(2, Math.min(GRID_W - 3, CENTER.x + _gInt(-18, 18))), y: Math.max(2, Math.min(GRID_H - 3, CENTER.y + _gInt(-18, 18))) }; }
  // A free grid cell not already in `used` (so no two sites overlap on the map).
  function _popFreeCell(used) {
    for (var t = 0; t < 500; t++) { var x = _gInt(1, GRID_W - 2), y = _gInt(1, GRID_H - 2), k = x + ',' + y; if (!used[k]) { used[k] = 1; return { x: x, y: y }; } }
    for (var yy = 1; yy < GRID_H - 1; yy++) for (var xx = 1; xx < GRID_W - 1; xx++) { var kk = xx + ',' + yy; if (!used[kk]) { used[kk] = 1; return { x: xx, y: yy }; } }
    return _popGrid();
  }
  // A free (district, subcell) across the 15×15 subgrids — spreads sites over
  // districts (round-robin by seed) so "populate" doesn't pile them in one place.
  function _popDistrictCell(usedCells, seed) {
    for (var a = 0; a < NC_DISTRICTS.length; a++) {
      var d = NC_DISTRICTS[(seed + a) % NC_DISTRICTS.length].id;
      for (var t = 0; t < 400; t++) { var x = _gInt(0, SUBGRID_N - 1), y = _gInt(0, SUBGRID_N - 1), k = d + ':' + x + ',' + y; if (!usedCells[k]) { usedCells[k] = 1; return { district: d, x: x, y: y }; } }
    }
    for (var di = 0; di < NC_DISTRICTS.length; di++) { var dd = NC_DISTRICTS[di].id; for (var yy = 0; yy < SUBGRID_N; yy++) for (var xx = 0; xx < SUBGRID_N; xx++) { var kk = dd + ':' + xx + ',' + yy; if (!usedCells[kk]) { usedCells[kk] = 1; return { district: dd, x: xx, y: yy }; } } }
    return { district: DEFAULT_DISTRICT, x: 0, y: 0 };
  }
  function _popPlans(fac, c) {
    var blocks = ['header', 'text', 'image', 'link', 'board', 'compose'];
    return [
      { name: fac === 'under' ? 'Ghost' : 'Basic', price: Math.round(c.price / 4), reach: fac === 'corpo' ? 'citywide' : 'district', anon: c.anonymity, blocks: blocks },
      { name: fac === 'corpo' ? 'Enterprise' : 'Pro', price: Math.round(c.price / 1.5), reach: c.reachGranted, anon: c.anonymity, blocks: blocks.concat(['gallery', 'form']) }
    ];
  }
  // Real CP2020 item DB, loaded once and filtered to MEDIUM availability (not common, not rare)
  // so generated shops stock believable, mid-tier gear — and carry the source row so buying delivers it.
  var POP_ITEM_FILES = [['weapons', 'data/cp2020weapons.json', 'cost'], ['cyberware', 'data/cyberware.json', 'cost'], ['gear', 'data/cp2020gear.json', 'cost'], ['vehicles', 'data/cp2020-vehicles.json', 'bookcost'], ['decks', 'data/cp2020decks.json', 'bookPrice'], ['programs', 'data/cp2020programs.json', 'cost']];
  var _popItemsCache = null;
  function _popCost(v) { return parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0; }
  function _popLoadItems(cb) {
    if (_popItemsCache) return cb(_popItemsCache);
    Promise.all(POP_ITEM_FILES.map(function (f) {
      return fetch(f[1]).then(function (r) { return r.json(); }).then(function (j) { return { cat: f[0], costK: f[2], rows: (Array.isArray(j) ? j : (j.items || [])) }; }, function () { return { cat: f[0], costK: f[2], rows: [] }; });
    })).then(function (arr) {
      var db = {};
      arr.forEach(function (g) {
        var rows = (g.rows || []).map(function (r) { return { name: r.name, cost: _popCost(r[g.costK]), avail: r.avail || '', data: r }; }).filter(function (x) { return x.name; });
        if (g.cat === 'weapons') rows = rows.filter(function (x) { return x.avail === 'P'; }); // Poor = the medium band (E/C easy, R rare)
        else { var cs = rows.map(function (x) { return x.cost; }).filter(function (c) { return c > 0; }).sort(function (a, b) { return a - b; }); if (cs.length > 6) { var lo = cs[Math.floor(cs.length * 0.35)], hi = cs[Math.floor(cs.length * 0.8)]; rows = rows.filter(function (x) { return x.cost >= lo && x.cost <= hi; }); } }
        db[g.cat] = rows;
      });
      _popItemsCache = db; cb(db);
    }, function () { _popItemsCache = {}; cb({}); });
  }
  function _popShopItems(db) {
    db = db || {}; var cats = Object.keys(db).filter(function (c) { return (db[c] || []).length; });
    if (!cats.length) return [{ id: uid('si'), cat: 'gear', name: 'assorted street gear', price: _gMoney(), qty: null }];
    var items = [];
    _gPickN(cats, _gInt(2, 4)).forEach(function (cat) { _gPickN(db[cat], _gInt(2, 5)).forEach(function (row) { items.push({ id: uid('si'), cat: cat, name: row.name, price: row.cost || _gMoney(), qty: _gPick([null, null, _gInt(1, 9)]), data: row.data }); }); });
    return items;
  }
  function _popHost(def) {
    var c = def.cfg, fac = def.fac, site = blankSite(def.name);
    site.id = uid('sit'); site.kind = 'host'; site.known = true; site.props = { public: true, generated: true };
    site.broadcast = c.reachGranted; site.record.broadcast = c.reachGranted;
    site.theme = { preset: fac === 'corpo' ? 'corp' : (fac === 'indie' ? 'chrome' : 'terminal'), overrides: {} };
    site.hostConfig = { price: c.price, legality: c.legality, netwatchCoop: c.netwatchCoop, reliability: c.reliability, reachGranted: c.reachGranted, anonymity: c.anonymity, serverAddress: '' };
    var tiles = _gL(['Reach :: ' + c.reachGranted, 'Reliability :: ' + c.reliability + '/3', 'Anonymity :: ' + c.anonymity + '/3', 'From :: ' + Math.round(c.price / 4) + 'eb/mo']);
    site.pages = [
      _gpage('Home', '', [
        _gb('navbar'),
        _gb('header', { title: def.name, tagline: fac === 'corpo' ? 'Managed corporate hosting' : fac === 'indie' ? 'Independent hosting collective' : 'Off-grid, no-log hosting', accent: true, rule: true }),
        _gb('dashboard', { title: 'Infrastructure', tiles: tiles }),
        _gb('text', { body: def.blurb }),
        _gb('notice', { title: fac === 'corpo' ? 'Compliance' : fac === 'under' ? 'Terms' : 'Fair use', text: fac === 'corpo' ? 'All traffic is Netwatch-audited and logged. SLA guaranteed, 24/7 support.' : fac === 'under' ? 'We keep nothing. We answer to no one. Payment in advance, no refunds.' : 'Community-run, best-effort uptime. Don’t be a gonk and we’ll get along.', tone: fac === 'corpo' ? 'info' : fac === 'under' ? 'danger' : 'warn' }),
        _gb('hosting', { title: 'Get a site on ' + def.name, plans: _popPlans(fac, c) }),
        _gb('footer', { text: def.name + ' · ' + c.reachGranted + ' backbone' })
      ], true),
      _gpage('Status', 'status', [
        _gb('heading', { text: 'System status', caps: true }),
        _gb('dashboard', { title: '', tiles: _gL(['Uptime :: ' + (90 + c.reliability * 3) + '.' + _gInt(0, 9) + '%', 'Nodes :: ' + _gInt(3, 40), 'Load :: ' + _gInt(10, 90) + '%', 'Incidents :: ' + _gInt(0, 3)]) }),
        _gb('list', { title: 'Recent events', items: _gL(_gPickN(['scheduled maintenance', 'Netwatch probe repelled', 'node added to the pool', 'DDoS absorbed', 'certificate rotated', 'mirror resynced', 'abuse report actioned'], 3)), style: 'dash' })
      ])
    ];
    return site;
  }
  function _popStory(o) {
    var t = _gPick(POP_HEADS[o.angle] || POP_HEADS.independent), corp = _gPick(_G_CORP), district = _gPick(POP_DISTRICTS), star = _gPick(POP_STARS);
    function fill(s) { return String(s).replace(/{corp}/g, corp).replace(/{district}/g, district).replace(/{star}/g, star); }
    var likers = PRESS_HANDLES.slice(0, _gInt(0, 6));
    var rating = o.angle === 'sensational' ? _gPick(['unconfirmed', 'recreation']) : (o.angle === 'independent' ? _gPick(['verified', 'developing']) : 'developing');
    return { id: uid('st'), kind: 'story', handle: _gPick(PRESS_HANDLES), format: _gPick(o.formats || ['article']), headline: fill(t[0]), dek: fill(t[1]), body: fill(t[1]) + ' ' + fill(_gPick(POP_BODIES)), rating: rating, reach: _gInt.apply(null, POP_REACH[o.fac] || [800, 4000]), buzz: _gInt(0, 40), likes: likers.length, likedBy: likers, ts: netClock() };
  }
  function _popSeedOutlet(site, o, level) {
    var c = camp(); if (!c || !c.putNetPost) return;
    var nS = _gInt(2, 4);
    for (var i = 0; i < nS; i++) {
      var key = site.id + ':feed:' + slugify(_gPick(o.secs)), story = _popStory(o);
      c.putNetPost(key, story);
      var nc = _gInt(level.cmtLo, level.cmtHi);
      for (var j = 0; j < nc; j++) c.putNetPost(key, { id: uid('cm'), kind: 'comment', parent: story.id, handle: _gPick(PRESS_HANDLES), body: _gPick(PC_PRO.concat(PC_CON, PC_SNARK)), ts: netClock() });
    }
  }
  function _popOutlet(o, host) {
    var site = blankSite(o.name); site.id = uid('sit'); site.kind = 'app'; site.app = 'press'; site.known = true; site.props = { public: true, generated: true };
    var reach = (host && host.hostConfig && host.hostConfig.reachGranted) || 'citywide';
    site.hostId = host ? host.id : null; site.record.hostId = site.hostId; site.broadcast = reach; site.record.broadcast = reach;
    site.appConfig = { layout: o.layout, palette: {}, tagline: o.tag, sections: o.secs.slice(), formats: (o.formats || ['article']).slice(), submit: 'media', workflow: 'auto', angle: o.angle, corpoLink: null, comments: 'on', rank: 'reach', showRatings: true, seed: {} };
    site.pages = [{ id: uid('pg'), name: 'App', slug: '', home: true, layout: 'app', blocks: [] }];
    site.credibility = _gInt.apply(null, POP_CRED[o.fac] || [40, 60]); site.buzz = _gInt(20, 200);
    if (o.angle === 'corpo' || o.angle === 'state') {
      var corp = _gPick(_G_CORP), orgId = uid('org');
      try { Promise.resolve(Store.create('org', { id: orgId, name: corp, type: 'corporation', tagline: corp + ' — a Night City institution.', tags: ['generated'], props: { public: true } })).catch(function () {}); } catch (e) {}
      site.appConfig.corpoLink = { type: 'org', id: orgId, name: corp };
    }
    return site;
  }
  function _popChat(cdef, host) {
    var site = blankSite(cdef.name); site.id = uid('sit'); site.kind = 'app'; site.app = cdef.app; site.known = true; site.props = { public: true, generated: true };
    site.theme = { preset: cdef.preset, overrides: {} }; site.appConfig = JSON.parse(JSON.stringify(cdef.cfg));
    if (host) { site.hostId = host.id; site.record.hostId = host.id; site.broadcast = host.hostConfig.reachGranted; site.record.broadcast = site.broadcast; }
    site.pages = [{ id: uid('pg'), name: 'App', slug: '', home: true, layout: 'app', blocks: [] }];
    return site;
  }
  function _popSeedChat(site, cdef, level) {
    var c = camp(); if (!c || !c.putNetPost) return;
    (cdef.cfg.channels || []).forEach(function (ch) { var n = _gInt(level.chatLo, level.chatHi); for (var i = 0; i < n; i++) c.putNetPost(site.id + ':chan:' + ch, { id: uid('post'), handle: _gPick(PRESS_HANDLES), tag: '', body: _gPick(POP_CHATTER), ts: netClock() }); });
  }
  // Seed forum/board block posts on any generated site that has 'board' blocks.
  function _popSeedBoards(site, level) {
    var c = camp(); if (!c || !c.putNetPost) return;
    (site.pages || []).forEach(function (pg) {
      (pg.blocks || []).forEach(function (b) {
        if (!b || b.type !== 'board') return;
        var key = site.id + ':' + (b.channel || pg.slug || 'main'), n = _gInt(level.postLo, level.postHi);
        for (var i = 0; i < n; i++) c.putNetPost(key, { id: uid('post'), handle: _gPick(PRESS_HANDLES), tag: '', body: _gPick(POP_FORUM), ts: netClock() });
      });
    });
  }
  // A varied block site via the existing generate machinery — random archetype, theme, vibe, font,
  // and texture dressing so no two look alike. This is the bulk of the "life" on the Net.
  function _popBlockSite(host, texs, db) {
    var valid = SITE_ARCHETYPES.map(function (x) { return x.key; });
    var key = _gPick(POP_ARCH.filter(function (k) { return valid.indexOf(k) >= 0; })) || (SITE_ARCHETYPES[0] && SITE_ARCHETYPES[0].key);
    var a = SITE_ARCHETYPES.filter(function (x) { return x.key === key; })[0]; if (!a) return null;
    var vibe = _gPick(['clean', 'lively', 'lively', 'chaotic']);
    var preset = Math.random() < 0.35 ? a.preset : _gPick(POP_PRESETS);
    var font = Math.random() < 0.5 ? _gPick(WEB_FONTS.slice(1))[1] : '';
    var reach = _gPick(['local', 'district', 'district', 'citywide', 'national']);
    var I = { name: genName(key), hook: '', region: 'nc', broadcast: reach, preset: preset, vibe: vibe, font: font, texs: texs };
    var site = blankSite(I.name); site.id = uid('sit'); site.known = true; site.props = { public: true, generated: true, genBlock: true, genArch: key };
    site.broadcast = reach; site.record.broadcast = reach; site.lastEdit = netClock();
    site.theme = { preset: preset, overrides: font ? { font: font } : {} };
    if (Math.random() < 0.25 && texs && texs.length) site.theme.overrides.bgImage = texUrl(_gPick(texs)); // some sites get a full-site background
    try { site.pages = a.build(I); _gDiversify(site.pages, I); } catch (e) { site.pages = blankSite(I.name).pages; }
    if (vibe !== 'clean' && texs && texs.length) { try { _gDressPages(site.pages, vibe, texs); } catch (e) {} }
    if (!site.pages.length) site.pages = blankSite(I.name).pages;
    if (!site.pages.some(function (p) { return p.home; })) site.pages[0].home = true;
    // Shops link a REAL shop entity so the item block shows real products (not a flavor list).
    if (key === 'shop') {
      var shopId = uid('shp');
      try { Promise.resolve(Store.create('shop', { id: shopId, name: I.name, kind: 'storefront', items: _popShopItems(db), props: { public: true }, tags: ['generated'] })).catch(function () {}); } catch (e) {}
      site.subject = { type: 'shop', id: shopId };
      var sp = site.pages.filter(function (p) { return p.home; })[0] || site.pages[0];
      var itemB = _gb('item', { cat: 'all', title: _gPick(['In stock', 'On the shelves', 'Merchandise', 'The goods']) });
      var li = sp.blocks.map(function (b) { return b.type; }).indexOf('list');
      if (li >= 0) sp.blocks.splice(li, 1, itemB); else sp.blocks.splice(Math.max(1, sp.blocks.length - 1), 0, itemB);
    }
    if (host) { site.hostId = host.id; site.record.hostId = host.id; if (broadcastOrd(reach) > broadcastOrd(host.hostConfig.reachGranted || 'global')) { site.broadcast = host.hostConfig.reachGranted; site.record.broadcast = site.broadcast; } }
    return site;
  }
  function _popCatalog(pressOutlets) {
    var c = camp(); if (!c || !c.setOverview) return;
    var ov = (c.getOverview && c.getOverview()) || {}, regie = (ov.regie && typeof ov.regie === 'object') ? ov.regie : {};
    var mkt = regie.market || {}; mkt.ads = mkt.ads || []; mkt.posts = mkt.posts || []; mkt.sponsors = mkt.sponsors || [];
    function has(arr, k) { return arr.some(function (x) { return x.gen === k; }); }
    [['Kiroshi Optics placement', 'video', 40], ['Trauma Team spot', 'any', 32], ['SIN-clean promo', 'article', 22]].forEach(function (d, i) { var k = 'ad-' + i; if (!has(mkt.ads, k)) mkt.ads.push({ id: uid('ad'), gen: k, name: d[0], contentType: d[1], cpm: d[2], hidden: false }); });
    pressOutlets.slice(0, 4).forEach(function (s) { var k = 'pos-' + s.id; if (!has(mkt.posts, k)) mkt.posts.push({ id: uid('pos'), gen: k, outletId: s.id, outletName: s.name, role: _gPick(['freelance', 'stringer', 'staff']), pay: _gInt(50, 300), quota: _gInt(2, 5) }); });
    regie.market = mkt; c.setOverview({ regie: regie });
  }
  function populateNet(opts) {
    if (!window.Store || isPlayer()) return;
    var facs = (opts.facs && opts.facs.length) ? opts.facs : ['corpo', 'indie', 'under'];
    var N = ({ S: [5, 1, 6], M: [9, 2, 12], L: [15, 3, 22] })[opts.size || 'M']; // [press outlets, chat apps, varied-block-site target]
    var level = POP_LIVE[opts.live] || POP_LIVE.lively;
    Store.index('site').then(function (rows) {
      var byName = {}, blockCount = 0, used = {}, usedCells = {}, relocated = 0;
      rows.forEach(function (r) { byName[(r.json.name || '').toLowerCase()] = r.json; if (r.json.props && r.json.props.genBlock) blockCount++; var g = r.json.grid; if (g && (g.x !== CENTER.x || g.y !== CENTER.y)) used[g.x + ',' + g.y] = 1; if (r.json.subcell) usedCells[siteDistrict(r.json) + ':' + r.json.subcell.x + ',' + r.json.subcell.y] = 1; });
      // Spread out any sites stacked on the default CENTER cell (e.g. the pre-seeded chat/press apps).
      rows.forEach(function (r) { var g = r.json.grid || CENTER; if (g.x === CENTER.x && g.y === CENTER.y) { r.json.grid = _popFreeCell(used); relocated++; try { Promise.resolve(Store.put({ type: 'site', id: r.json.id }, r.json)); } catch (e) {} } });
      var created = 0, hostRefs = { corpo: [], indie: [], under: [] }, pressOutlets = [], blockNeed = 0;
      function ensure(json, onNew) {
        var ex = byName[(json.name || '').toLowerCase()];
        if (ex) return Promise.resolve(ex);
        json.grid = _popFreeCell(used); // legacy free-grid coord (kept for any old view)
        var dc = _popDistrictCell(usedCells, created); json.district = dc.district; json.subcell = { x: dc.x, y: dc.y }; // spread across district subgrids
        created++;
        return Promise.resolve(Store.create('site', json)).then(function (made) { byName[(json.name || '').toLowerCase()] = made.json; if (onNew) try { onNew(made.json); } catch (e) {} return made.json; });
      }
      // (0) hosts first — 3-4 max, diversified offers
      var hp = [];
      POP_HOSTLIST.filter(function (h) { return facs.indexOf(h.fac) >= 0; }).slice(0, 4).forEach(function (def) { hp.push(ensure(_popHost(def)).then(function (j) { hostRefs[def.fac].push(j); })); });
      Promise.all(hp).then(function () {
        var pool = hostRefs.corpo.concat(hostRefs.indie, hostRefs.under);
        function hostFor(fac) { var f = hostRefs[fac] && hostRefs[fac].length ? hostRefs[fac] : pool; return f.length ? _gPick(f) : null; }
        var sp = [];
        // (1) press outlets on hosts
        POP_OUTLETS.filter(function (o) { return facs.indexOf(o.fac) >= 0; }).slice(0, N[0]).forEach(function (o) {
          var ex = byName[(o.name || '').toLowerCase()];
          if (ex) { if (ex.app === 'press') pressOutlets.push(ex); return; } // already there → don't rebuild (would mint an orphan corpo org)
          sp.push(ensure(_popOutlet(o, hostFor(o.fac)), function (j) { _popSeedOutlet(j, o, level); }).then(function (j) { if (j.app === 'press') pressOutlets.push(j); }));
        });
        if (opts.chat) POP_CHATS.slice(0, N[1]).forEach(function (cd) { sp.push(ensure(_popChat(cd, hostFor('indie')), function (j) { _popSeedChat(j, cd, level); })); });
        Promise.all(sp).then(function () {
          // (2) MANY varied block sites via the generate tool (fills to a target count → idempotent)
          function makeBlocks(next) {
            blockNeed = opts.blocks ? Math.max(0, N[2] - blockCount) : 0;
            if (!blockNeed) return next();
            loadTextures(function (texs) {
              _popLoadItems(function (db) {
                var arr = [];
                for (var i = 0; i < blockNeed; i++) { var s = _popBlockSite(hostFor(_gPick(facs)), texs, db); if (s) arr.push(ensure(s, function (j) { _popSeedBoards(j, level); })); }
                Promise.all(arr).then(next);
              });
            });
          }
          makeBlocks(function () {
            _popCatalog(pressOutlets);
            App.emit('entity:saved', { type: 'site' });
            if (br().logSession) br().logSession('Populated the Net — +' + created + ' site(s).');
            if (window.UI && UI.modal) UI.modal({ title: 'Net populated', body: '<p>Added <b>' + created + '</b> new site(s): a few hosts, outlets' + (opts.chat ? ', chat' : '') + (opts.blocks ? ', ' + blockNeed + ' varied block sites' : '') + ' — seeded with stories, comments, forum posts and a monetization catalog. Re-run any time; it fills gaps.</p>', actions: [{ label: 'OK', kind: 'primary' }] });
          });
        });
      });
    }).catch(function () {});
  }
  function openPopulate() {
    if (!window.UI || isPlayer()) return;
    UI.modal({
      title: 'Populate the Net', size: 'wide',
      body: '<p class="dt-hint">Generates a few diversified hosts (corpo / indie / underground), press outlets on them, chat apps, and lots of <b>varied block sites</b> via the site generator — each with its own theme, layout and vibe. Seeds stories, comments and forum posts, a monetization catalog and starting traffic. Idempotent: safe to re-run, it fills gaps.</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="rt-field" style="flex:1;min-width:130px"><span class="rt-field-l">Size</span><select class="rt-select" id="pop-size"><option value="S">Small</option><option value="M" selected>Medium</option><option value="L">Large</option></select></label>' +
        '<label class="rt-field" style="flex:1;min-width:130px"><span class="rt-field-l">Liveliness</span><select class="rt-select" id="pop-live"><option value="quiet">Quiet</option><option value="lively" selected>Lively</option><option value="buzzing">Buzzing</option></select></label></div>' +
        '<div class="rt-field-l" style="margin:10px 0 4px">Factions</div><div class="web-pop-facs"><label><input type="checkbox" id="pop-corpo" checked> corpo</label><label><input type="checkbox" id="pop-indie" checked> indie</label><label><input type="checkbox" id="pop-under" checked> underground</label></div>' +
        '<div class="web-pop-facs" style="margin-top:8px"><label><input type="checkbox" id="pop-chat" checked> include chat apps</label><label><input type="checkbox" id="pop-blocks" checked> include block sites</label></div>',
      actions: [{ label: 'Cancel' }, { label: 'Populate', kind: 'primary', onClick: function (box) {
        var facs = []; ['corpo', 'indie', 'under'].forEach(function (f) { var el = box.querySelector('#pop-' + f); if (el && el.checked) facs.push(f); });
        UI.close();
        populateNet({ size: box.querySelector('#pop-size').value, live: box.querySelector('#pop-live').value, facs: facs, chat: box.querySelector('#pop-chat').checked, blocks: box.querySelector('#pop-blocks').checked });
      } }]
    });
  }

  function renderHome(t, host) {
    ensureRuntime();
    if (isPlayer()) return renderBrowser(t, host);
    ensureChatApp(); ensureApps();
    host.className = 'tab-content ca-pane';
    host.innerHTML =
      '<div class="ca-topbar"><span class="ca-topbar-t">THE NET</span>' + gmClockHtml() + '</div>' +
      '<div class="ca-body"><aside class="ca-rail"><div class="dt-side"><div class="dt-head">NET</div><div class="dt-node" data-web="sites"><span class="dt-l">Sites</span></div><div class="dt-node" data-web="browse"><span class="dt-l">Browser</span></div><div class="dt-node" data-web="atlas"><span class="dt-l">Cyberspace</span></div><div class="dt-node" data-web="hosts"><span class="dt-l">Hosts</span></div><div class="dt-node" data-web="sessions"><span class="dt-l">Logins</span></div><div class="dt-node" data-web="traffic"><span class="dt-l">Traffic</span></div>' +
      '</div></aside><div class="ca-main" id="web-gm-main"></div></div>';
    host.querySelectorAll('[data-web]').forEach(function (b) { b.onclick = function () { var a = b.getAttribute('data-web'); if (a === 'sites') { var m = host.querySelector('#web-gm-main'); if (m) renderSitesView(m); } else if (a === 'browse') Shell.openTool('web-browse'); else if (a === 'atlas') { Shell.openTool('web-browse'); setTimeout(function () { navTo('/home/map'); }, 60); } else if (a === 'hosts') Shell.openTool('web-hosts'); else if (a === 'sessions') renderSessions(); else if (a === 'traffic') renderTraffic(); }; });
    var gmMain = host.querySelector('#web-gm-main'); if (gmMain) renderSitesView(gmMain);
    wireGmClock(host);
  }
  var _sitesView = 'grid';
  function renderSitesView(container) {
    container.innerHTML = '<div class="web-sv-head"><span class="dt-head" style="padding:0">SITES</span>' +
      '<span class="web-sv-toggle"><button class="web-sv-b on" data-sv="grid">▦ Grid</button><button class="web-sv-b" data-atlas>Cyberspace ↗</button></span>' +
      '<button class="web-sv-new" data-sv-new>+ new</button><button class="web-sv-new" data-sv-app>+ app</button><button class="web-sv-new" data-sv-fort>+ fort</button><button class="web-sv-new" data-sv-gen>generate</button><button class="web-sv-new web-sv-pop" data-sv-pop>populate net</button></div>' +
      '<div class="web-sv-body" id="web-sv-body"></div>';
    container.querySelector('[data-sv-new]').onclick = newSite;
    container.querySelector('[data-sv-app]').onclick = newSiteApp;
    container.querySelector('[data-sv-fort]').onclick = newAutonomousFort;
    container.querySelector('[data-sv-gen]').onclick = openSiteGenerator;
    container.querySelector('[data-sv-pop]').onclick = openPopulate;
    container.querySelectorAll('[data-sv]').forEach(function (b) { b.onclick = function () { _sitesView = b.getAttribute('data-sv'); renderSitesView(container); }; });
    var atl = container.querySelector('[data-atlas]'); if (atl) atl.onclick = function () { Shell.openTool('web-browse'); setTimeout(function () { navTo('/home/map'); }, 60); };
    var body = container.querySelector('#web-sv-body');
    Store.index('site').then(function (rows) {
      body.innerHTML = rows.length ? '<div class="web-sv-grid">' + rows.map(function (r) { var s = r.json; return '<button class="web-sv-card" data-site="' + esc(s.id) + '"><span class="web-sv-card-n">' + esc(s.name || 'site') + (s.app ? ' <span class="web-sv-tag">app</span>' : '') + '</span><span class="web-sv-card-m">' + esc(s.kind || 'site') + ' · ' + esc(s.broadcast || 'citywide') + (isOnline(s) ? '' : ' · <span class="web-sv-off">offline</span>') + '</span></button>'; }).join('') + '</div>' : '<div class="app-empty" style="padding:24px">No sites yet — “+ new” or “generate”.</div>';
      body.querySelectorAll('[data-site]').forEach(function (b) { b.onclick = function () { Shell.openEntity('site', b.getAttribute('data-site'), null); }; });
    }).catch(function () { body.innerHTML = '<div class="app-empty" style="padding:24px">Could not load sites.</div>'; });
  }
  function renderSitesMap(body) {
    Store.index('site').then(function (rows) {
      var html = '<div class="web-mapwrap"><div class="web-grid" style="width:' + (GRID_W * CELL) + 'px;height:' + (GRID_H * CELL) + 'px;background-size:' + CELL + 'px ' + CELL + 'px">';
      rows.forEach(function (r) { var s = r.json, g = s.grid || CENTER; var x = ((g.x != null ? g.x : CENTER.x) + 0.5) * CELL, y = ((g.y != null ? g.y : CENTER.y) + 0.5) * CELL; html += '<div class="web-gsite' + (isOnline(s) ? '' : ' web-gsite-off') + '" data-site="' + esc(s.id) + '" style="left:' + x + 'px;top:' + y + 'px" title="' + esc(s.name) + '"><img src="' + levelIcon(s.level) + '" alt=""><span class="web-gsite-l">' + esc(s.name) + '</span></div>'; });
      html += '</div></div>';
      body.innerHTML = html;
      var wrap = body.querySelector('.web-mapwrap'); if (wrap) { wrap.scrollLeft = (CENTER.x + 0.5) * CELL - wrap.clientWidth / 2; wrap.scrollTop = (CENTER.y + 0.5) * CELL - wrap.clientHeight / 2; }
      body.querySelectorAll('[data-site]').forEach(function (n) { n.onclick = function () { Shell.openEntity('site', n.getAttribute('data-site'), null); }; });
    }).catch(function () { body.innerHTML = '<div class="app-empty" style="padding:24px">Could not load the map.</div>'; });
  }
  function paintSiteList(list) { Store.index('site').then(function (rows) { list.innerHTML = rows.length ? rows.map(function (r) { return '<div class="dt-node ca-row" data-site="' + esc(r.json.id) + '"><span class="dt-l">' + esc(r.json.name || 'site') + '</span>' + (r.json.kind && r.json.kind !== 'site' ? '<span class="dt-n">' + esc(r.json.kind) + '</span>' : '') + '</div>'; }).join('') : '<div class="dt-node dt-dim" style="cursor:default">no sites yet</div>'; list.querySelectorAll('[data-site]').forEach(function (d) { d.onclick = function () { Shell.openEntity('site', d.getAttribute('data-site'), null); }; }); }).catch(function () {}); }
  function newSite() { App.prompt('New site', 'Site name', 'New site', function (name) { Store.create('site', blankSite((name || '').trim() || 'New site')).then(function (made) { Shell.openEntity('site', made.json.id, made.json.name); }).catch(function (e) { var msg = String((e && e.message) || e); var hint = /bad type|read-only|hub/i.test(msg) ? 'The hub doesn’t know the <code>sites</code> type yet — restart the hub.' : ''; if (window.UI && UI.modal) UI.modal({ title: 'Could not create the site', body: '<p>' + esc(msg) + '</p>' + (hint ? '<p class="dt-hint">' + hint + '</p>' : ''), actions: [{ label: 'OK', kind: 'primary' }] }); else alert('Could not create the site: ' + msg); }); }); }
  function mkSiteApp(kind, name) {
    name = (name || '').trim() || (kind === 'press' ? 'New Outlet' : 'New Chat');
    var site = blankSite(name); site.kind = 'app'; site.app = kind; site.known = true; site.broadcast = 'citywide'; site.props = { public: true };
    site.appConfig = kind === 'press'
      ? { layout: 'broadsheet', tagline: '', sections: ['Front'], formats: ['article'], submit: 'media', angle: 'neutral', comments: 'on', showRatings: false, palette: {}, seed: {} }
      : { variant: 'consumer', channels: ['general'], dm: true, presence: true, gateWhole: false, psa: '' };
    site.pages = [{ id: uid('pg'), name: 'App', slug: '', home: true, layout: 'app', blocks: [] }];
    Store.create('site', site).then(function (made) { Shell.openEntity('site', made.json.id, made.json.name); }).catch(function (e) { var msg = String((e && e.message) || e); if (window.UI && UI.modal) UI.modal({ title: 'Could not create the app', body: '<p>' + esc(msg) + '</p>', actions: [{ label: 'OK', kind: 'primary' }] }); else alert(msg); });
  }
  function newSiteApp() {
    var choose = function (kind) { App.prompt(kind === 'press' ? 'New press outlet' : 'New chat app', 'Name', kind === 'press' ? 'New Outlet' : 'New Chat', function (n) { if (n != null) mkSiteApp(kind, n); }); };
    if (window.UI && UI.modal) {
      UI.modal({ title: 'New app', body: '<p class="dt-hint">Pick an engine — both are fully configurable afterwards (look in Design, behaviour in the app config).</p><div class="web-newapp"><button class="dt-btn web-newapp-b" data-mk="press"><b>Press outlet</b><span>news · video · tabloid · live…</span></button><button class="dt-btn web-newapp-b" data-mk="chat"><b>Chat app</b><span>channels · DMs · invite-only…</span></button></div>', onShow: function (box) { box.querySelectorAll('[data-mk]').forEach(function (b) { b.onclick = function () { UI.close(); choose(b.getAttribute('data-mk')); }; }); } });
    } else choose('press');
  }
  App.on('entity:saved', function (e) { if (e && e.type === 'site') { var m = document.getElementById('web-gm-main'); if (m && _sitesView === 'grid') renderSitesView(m); } });
  App.on('entity:deleted', function (e) { if (e && e.ref && e.ref.type === 'site') { var m = document.getElementById('web-gm-main'); if (m && _sitesView === 'grid') renderSitesView(m); } });

  function netClock() { var c = camp(); var o = (c && c.getOverview && c.getOverview()) || {}; return parseInt(o.netClock, 10) || 0; }
  function gmClockHtml() { return '<span class="web-clock">clock: <b id="web-clock-v">' + netClock() + 'h</b><button class="web-clock-b" data-clock="1">+1h</button><button class="web-clock-b" data-clock="24">+1d</button></span>'; }
  function wireGmClock(host) { host.querySelectorAll('[data-clock]').forEach(function (b) { b.onclick = function () { var c = camp(); if (!c || !c.setOverview) return; var v = netClock() + (parseInt(b.getAttribute('data-clock'), 10) || 0); c.setOverview({ netClock: v }); var el2 = document.getElementById('web-clock-v'); if (el2) el2.textContent = v + 'h'; if (br().logSession) br().logSession('⏱ Net clock → ' + v + 'h'); }; }); }

  /* ═══════════════ THE BROWSER ═══════════════ */
  var _tabs = null, _active = null;
  function initTabs() { if (_tabs) return; _tabs = [{ id: uid('bt'), url: '/home', title: 'Home' }]; _active = _tabs[0].id; }
  function activeTab() { for (var i = 0; i < _tabs.length; i++) if (_tabs[i].id === _active) return _tabs[i]; return _tabs[0]; }
  function renderBrowser(t, host) {
    ensureRuntime();
    if (isPlayer() && !playerHasDevice(playerJson())) { host.className = 'tab-content web-browser'; host.innerHTML = ''; host.appendChild(webDarkScreen()); return; }
    initTabs(); host.className = 'tab-content web-browser';
    host.innerHTML =
      '<div class="web-chrome"><div class="web-tabbar" id="web-tabbar"></div><div class="web-urlrow">' +
        '<button class="web-nav" id="web-back" data-back title="Back">◄</button><button class="web-nav" id="web-fwd" data-fwd title="Forward">►</button>' +
        '<button class="web-nav" data-home title="Home">⌂</button><button class="web-nav" data-map title="Cyberspace">▦</button><div class="web-crumbs" id="web-crumbs"></div>' +
        '<input class="web-url" id="web-url" spellcheck="false" autocomplete="off"><button class="web-nav" id="web-go">go</button><button class="web-nav" id="web-star" title="Bookmark">☆</button>' +
      '</div></div><div class="web-stage" id="web-stage"></div>';
    host.querySelector('[data-back]').onclick = goBack;
    host.querySelector('[data-fwd]').onclick = goForward;
    host.querySelector('[data-home]').onclick = function () { navTo('/home'); };
    host.querySelector('[data-map]').onclick = function () { navTo('/home/map'); };
    host.querySelector('#web-go').onclick = function () { navTo(host.querySelector('#web-url').value.trim()); };
    host.querySelector('#web-url').onkeydown = function (e) { if (e.key === 'Enter') navTo(e.target.value.trim()); };
    host.querySelector('#web-star').onclick = function () { var a = activeTab(); if (a.url.indexOf('grid://') === 0) { addBookmark(a.url, a.title); flash(host.querySelector('#web-star'), '★'); } };
    paintChrome(); paintStage();
    if (t && t.addr) navTo(t.addr);
    else if (t && t.siteId) { _deepArticle = t.postId || null; Promise.resolve(Store.resolve({ type: 'site', id: t.siteId })).then(function (rec) { if (rec && rec.json) navTo(siteUrl(rec.json)); }).catch(function () {}); }
  }
  function paintChrome() {
    var bar = document.getElementById('web-tabbar'); if (!bar) return;
    bar.innerHTML = _tabs.map(function (tb) { return '<div class="web-tab' + (tb.id === _active ? ' on' : '') + '" data-tab="' + tb.id + '"><span>' + esc(tb.title || 'New tab') + '</span><button class="web-tab-x" data-tabx="' + tb.id + '">✕</button></div>'; }).join('') + '<button class="web-tab-add" id="web-tabadd">＋</button>';
    bar.querySelectorAll('[data-tab]').forEach(function (d) { d.onclick = function (e) { if (e.target.hasAttribute('data-tabx')) return; _active = d.getAttribute('data-tab'); paintChrome(); paintStage(); }; });
    bar.querySelectorAll('[data-tabx]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); closeTab(b.getAttribute('data-tabx')); }; });
    var add = document.getElementById('web-tabadd'); if (add) add.onclick = function () { var nt = { id: uid('bt'), url: '/home', title: 'Home' }; _tabs.push(nt); _active = nt.id; paintChrome(); paintStage(); };
    var a = activeTab();
    var bk = document.getElementById('web-back'); if (bk) bk.disabled = !(a.back && a.back.length);
    var fw = document.getElementById('web-fwd'); if (fw) fw.disabled = !(a.fwd && a.fwd.length);
    var url = document.getElementById('web-url'); if (url) url.value = a.url;
    var cr = document.getElementById('web-crumbs'); if (cr) { cr.innerHTML = crumbs(a).map(function (c) { return '<a data-crumb="' + esc(c.url) + '">' + esc(c.label) + '</a>'; }).join('<i>›</i>'); cr.querySelectorAll('[data-crumb]').forEach(function (x) { x.onclick = function () { navTo(x.getAttribute('data-crumb')); }; }); }
  }
  function crumbs(tb) { if (tb.url === '/home') return [{ label: 'Home', url: '/home' }]; if (tb.url === '/home/map') return [{ label: 'Home', url: '/home' }, { label: 'Map', url: '/home/map' }]; return [{ label: 'Home', url: '/home' }, { label: tb.title || tb.url, url: tb.url }]; }
  function closeTab(id) { var i = _tabs.map(function (x) { return x.id; }).indexOf(id); if (i < 0) return; _tabs.splice(i, 1); if (!_tabs.length) _tabs.push({ id: uid('bt'), url: '/home', title: 'Home' }); if (_active === id) _active = _tabs[Math.max(0, i - 1)].id; paintChrome(); paintStage(); }
  function navTo(url) { if (!url) return; if (url.indexOf('grid:') !== 0 && url.charAt(0) !== '/') url = 'grid://' + url; var a = activeTab(); if (a.url && a.url !== url) { a.back = a.back || []; a.back.push({ url: a.url, title: a.title }); if (a.back.length > 60) a.back.shift(); a.fwd = []; } a.url = url; if (url === '/home') a.title = 'Home'; else if (url === '/home/map') a.title = 'Map'; paintChrome(); paintStage(); }
  function goBack() { var a = activeTab(); if (!a.back || !a.back.length) return; a.fwd = a.fwd || []; a.fwd.push({ url: a.url, title: a.title }); var p = a.back.pop(); a.url = p.url; a.title = p.title || p.url; paintChrome(); paintStage(); }
  function goForward() { var a = activeTab(); if (!a.fwd || !a.fwd.length) return; a.back = a.back || []; a.back.push({ url: a.url, title: a.title }); var n = a.fwd.pop(); a.url = n.url; a.title = n.title || n.url; paintChrome(); paintStage(); }
  function paintStage() { var stage = document.getElementById('web-stage'); if (!stage) return; clearRunLive(); var a = activeTab(); if (a.url === '/home') { stage.className = 'web-stage'; stage.removeAttribute('style'); renderBrowserHome(stage); } else if (a.url === '/home/map') { stage.className = 'web-stage'; stage.removeAttribute('style'); renderAtlas(stage); } else if (a.url === '/run') { stage.className = 'web-stage web-stage-run'; stage.removeAttribute('style'); renderRunSection(stage); } else { openAddress(a.url, stage); stage.scrollTop = 0; } if (!isPlayer()) refreshGmRunBanner(); }

  /* /home — pinned · bookmarks (groups) · history (player→json.net, GM→meta.ui.web) */
  function webGet() { if (isPlayer()) { var j = playerJson(); return (j && j.net) || {}; } return App.uiGet('web', {}) || {}; }
  function webSave(mut) { if (isPlayer()) { var j = playerJson(); if (!j) return; ensureNet(j); mut(j.net); publishPlayer(j); } else { var w = App.uiGet('web', {}) || {}; mut(w); App.uiSet('web', w); } if (_tabs && activeTab().url === '/home') paintStage(); }
  function addBookmark(url, title) { webSave(function (w) { w.bookmarks = w.bookmarks || []; if (!w.bookmarks.some(function (b) { return b.url === url; })) w.bookmarks.push({ url: url, title: title || url, group: '', pinned: false }); }); }
  function removeBookmark(url) { webSave(function (w) { w.bookmarks = (w.bookmarks || []).filter(function (b) { return b.url !== url; }); }); }
  function togglePin(url) { webSave(function (w) { (w.bookmarks || []).forEach(function (b) { if (b.url === url) b.pinned = !b.pinned; }); }); }
  function setGroup(url, g) { webSave(function (w) { (w.bookmarks || []).forEach(function (b) { if (b.url === url) b.group = g; }); }); }
  function pushHistory(url, title) { webSave(function (w) { w.history = w.history || []; w.history = w.history.filter(function (h) { return h.url !== url; }); w.history.unshift({ url: url, title: title || url, ts: Date.now() }); w.history = w.history.slice(0, 40); }); }
  function renderBrowserHome(stage) {
    var w = webGet(), bm = w.bookmarks || [], hist = w.history || [];
    var pinned = bm.filter(function (b) { return b.pinned; });
    var groups = {}; bm.forEach(function (b) { var g = b.group || ''; (groups[g] = groups[g] || []).push(b); });
    var html = '<div class="web-home">';
    html += '<div class="web-home-sec"><div class="web-home-h">Pinned</div><div class="web-pins">' + (pinned.length ? pinned.map(function (b) { return '<button class="web-pin" data-go="' + esc(b.url) + '"><span class="web-pin-t">' + esc(b.title) + '</span><span class="web-pin-u">' + esc(b.url) + '</span></button>'; }).join('') : '<div class="web-empty">Nothing pinned. Open a site and press ☆, then pin it here.</div>') + '</div></div>';
    var intel = w.intel || [];
    if (isPlayer() || intel.length) html += '<div class="web-home-sec"><div class="web-home-h">Files' + (intel.length ? ' <span class="web-home-n">' + intel.length + '</span>' : '') + '</div><div class="web-files">' + (intel.length ? intel.map(function (f) { return '<button class="web-file" data-file="' + esc(f.type + ':' + f.id) + '">' + (f.img ? '<img src="' + esc(f.img) + '">' : '<span class="web-file-ph">▤</span>') + '<span class="web-file-n">' + esc(f.name || 'record') + '</span><span class="web-file-t">' + esc(TYPE_LABELS[f.type] || f.type) + '</span></button>'; }).join('') : '<div class="web-empty">No files yet. While browsing the Net, reveal a record or contact and hit “＋ Add to Files” to collect it here.</div>') + '</div></div>';
    html += '<div class="web-home-cols"><div class="web-home-sec"><div class="web-home-h">Bookmarks</div><div id="web-saved-grp"></div>';
    if (bm.length) { Object.keys(groups).sort().forEach(function (g) { if (g) html += '<div class="web-bm-g">' + esc(g) + '</div>'; html += groups[g].map(function (b) { return '<div class="web-bm" data-go="' + esc(b.url) + '"><span class="web-bm-t">' + esc(b.title) + '</span><span class="web-bm-acts"><button data-pin="' + esc(b.url) + '" title="Pin">' + (b.pinned ? '★' : '☆') + '</button><button data-grp="' + esc(b.url) + '" title="Group">▤</button><button data-del="' + esc(b.url) + '" title="Remove">✕</button></span></div>'; }).join(''); }); } else html += '<div class="web-empty">No bookmarks yet.</div>';
    html += '</div><div class="web-home-sec"><div class="web-home-h">History</div>' + (hist.length ? hist.map(function (h) { return '<div class="web-hist" data-go="' + esc(h.url) + '"><span class="web-bm-t">' + esc(h.title) + '</span><span class="web-hist-u">' + esc(h.url) + '</span></div>'; }).join('') : '<div class="web-empty">No history.</div>') + '</div></div></div>';
    stage.innerHTML = html;
    stage.querySelectorAll('[data-go]').forEach(function (d) { d.onclick = function (e) { if (e.target.hasAttribute('data-pin') || e.target.hasAttribute('data-del') || e.target.hasAttribute('data-grp')) return; navTo(d.getAttribute('data-go')); }; });
    stage.querySelectorAll('[data-pin]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); togglePin(b.getAttribute('data-pin')); }; });
    stage.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); removeBookmark(b.getAttribute('data-del')); }; });
    stage.querySelectorAll('[data-grp]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); App.prompt('Group', 'Group name (blank = none)', '', function (g) { setGroup(b.getAttribute('data-grp'), (g || '').trim()); }); }; });
    stage.querySelectorAll('[data-file]').forEach(function (b) { b.onclick = function () { var s = b.getAttribute('data-file'), i = s.indexOf(':'); revealEntity(s.slice(0, i), s.slice(i + 1)); }; });
    Store.index('site').then(function (rows) {
      var gm = !isPlayer(), reach = gm ? 999 : effectiveReach(playerJson());
      var known = rows.filter(function (r) { return r.json.known && (gm || (Store.visibleToPlayers(r.json) && connectable(r.json, reach))); });
      var sec = stage.querySelector('#web-saved-grp'); if (!sec) return;
      sec.innerHTML = known.length ? '<div class="web-bm-g">Saved</div>' + known.map(function (r) { return '<div class="web-bm" data-go="' + esc(siteUrl(r.json)) + '"><span class="web-bm-t">◆ ' + esc(r.json.name) + '</span></div>'; }).join('') : '';
      sec.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { navTo(b.getAttribute('data-go')); }; });
    }).catch(function () {});
  }

  /* /home/map — a plain black-on-white grid; sites placed by the GM, reach-gated */
  function renderBrowserMap(stage) {
    Store.index('site').then(function (rows) {
      var reach = effectiveReach(playerJson()), gm = !isPlayer();
      var sites = rows.filter(function (r) { return gm ? true : (Store.visibleToPlayers(r.json) && connectable(r.json, reach) && isOnline(r.json)); });
      var html = '<div class="web-mapwrap"><div class="web-grid" style="width:' + (GRID_W * CELL) + 'px;height:' + (GRID_H * CELL) + 'px;background-size:' + CELL + 'px ' + CELL + 'px">';
      sites.forEach(function (r) { var g = r.json.grid || CENTER; var x = ((g.x != null ? g.x : CENTER.x) + 0.5) * CELL, y = ((g.y != null ? g.y : CENTER.y) + 0.5) * CELL; html += '<div class="web-gsite" data-site="' + esc(r.json.id) + '" style="left:' + x + 'px;top:' + y + 'px" title="' + esc(LEVEL_LABEL[r.json.level] || '') + '"><img src="' + levelIcon(r.json.level) + '" alt=""><span class="web-gsite-l">' + esc(r.json.name) + '</span></div>'; });
      html += '</div></div>';
      if (isPlayer() && !sites.length) html += '<div class="web-map-note">Nothing in reach. A better computer reveals more of the Net.</div>';
      stage.innerHTML = html;
      var wrap = stage.querySelector('.web-mapwrap'); if (wrap) { wrap.scrollLeft = (CENTER.x + 0.5) * CELL - wrap.clientWidth / 2; wrap.scrollTop = (CENTER.y + 0.5) * CELL - wrap.clientHeight / 2; }
      stage.querySelectorAll('[data-site]').forEach(function (n) { n.onclick = function () { var r = rows.filter(function (x) { return x.json.id === n.getAttribute('data-site'); })[0]; if (r) navTo(siteUrl(r.json)); }; });
    }).catch(function () { stage.innerHTML = '<div class="web-empty">Could not load the map.</div>'; });
  }

  function openAddress(addr, stage) {
    stage = stage || document.getElementById('web-stage'); if (!stage) return;
    addr = String(addr || ''); var _ai = addr.indexOf('#a='); var _art = ''; if (_ai >= 0) { _art = addr.slice(_ai + 3); addr = addr.slice(0, _ai); } // article permalink → open that story directly
    var m = /^grid:\/\/([^/]+)\/(.+)$/.exec(addr); var rest = m ? m[2] : addr; var parts = rest.split('/'); var siteSlug = slugify(parts[0]); var pageSlug = parts[1] ? slugify(parts.slice(1).join('-')) : '';
    Store.index('site').then(function (rows) {
      var hit = rows.filter(function (r) { return slugify(r.json.name) === siteSlug || r.json.id === parts[0]; })[0];
      if (!hit) { stage.className = 'web-stage'; stage.removeAttribute('style'); stage.innerHTML = '<div class="web-empty" style="padding:24px">No site at ' + esc(addr) + '.</div>'; return; }
      if (isPlayer() && !(Store.visibleToPlayers(hit.json) && connectable(hit.json, effectiveReach(playerJson())) && isOnline(hit.json))) { stage.innerHTML = '<div class="web-empty" style="padding:24px">Out of reach.</div>'; return; }
      if (_art) _deepArticle = _art;
      var page = pageBySlug(hit.json, pageSlug); var a = activeTab(); a.url = pageUrl(hit.json, page); a.title = hit.json.name + (page && !page.home ? ' / ' + page.name : ''); pushHistory(a.url, a.title); setPresenceSite(hit.json.id); paintChrome();
      stage.className = 'web-stage web-stage-site'; stage.removeAttribute('style'); stage.innerHTML = ''; var host = document.createElement('div'); stage.appendChild(host); renderSiteResolved(host, hit.json, page ? page.slug : ''); stage.scrollTop = 0;
    });
  }
  function flash(btn, txt) { if (!btn) return; var o = btn.textContent; btn.textContent = txt; setTimeout(function () { btn.textContent = o; }, 700); }

  // Visual placement: open the city grid, click a cell → onPick(x, y).
  function openGridPicker(doc, onPick) {
    if (!window.UI) return;
    Store.index('site').then(function (rows) {
      var others = rows.filter(function (r) { return r.json.id !== doc.id; }); var cur = doc.grid || { x: CENTER.x, y: CENTER.y };
      UI.modal({ title: 'Place on the city grid — click a cell', size: 'wide',
        body: '<div class="web-gridpick"><div class="web-gridpick-grid" id="wgp" style="width:' + (GRID_W * CELL) + 'px;height:' + (GRID_H * CELL) + 'px;background-size:' + CELL + 'px ' + CELL + 'px"></div></div>',
        actions: [{ label: 'Done', kind: 'primary' }],
        onShow: function (box) {
          var g = box.querySelector('#wgp');
          var html = others.map(function (r) { var p = r.json.grid || { x: CENTER.x, y: CENTER.y }; return '<div class="web-gp-other" style="left:' + ((p.x + 0.5) * CELL) + 'px;top:' + ((p.y + 0.5) * CELL) + 'px"><img src="' + levelIcon(r.json.level) + '"><span>' + esc(r.json.name) + '</span></div>'; }).join('');
          html += '<div class="web-gp-me" id="wgp-me" style="left:' + ((cur.x + 0.5) * CELL) + 'px;top:' + ((cur.y + 0.5) * CELL) + 'px"><img src="' + levelIcon(doc.level) + '"></div>';
          g.innerHTML = html;
          g.onclick = function (e) { var rect = g.getBoundingClientRect(); var x = Math.max(0, Math.min(GRID_W - 1, Math.floor((e.clientX - rect.left) / CELL))), y = Math.max(0, Math.min(GRID_H - 1, Math.floor((e.clientY - rect.top) / CELL))); var me = box.querySelector('#wgp-me'); if (me) { me.style.left = ((x + 0.5) * CELL) + 'px'; me.style.top = ((y + 0.5) * CELL) + 'px'; } onPick(x, y); };
          var wrap = box.querySelector('.web-gridpick'); if (wrap) { wrap.scrollLeft = (cur.x + 0.5) * CELL - wrap.clientWidth / 2; wrap.scrollTop = (cur.y + 0.5) * CELL - wrap.clientHeight / 2; }
        } });
    });
  }

  // Placement label for a site: district · cell (subgrid). "(auto)" = derived, not yet placed.
  function placeLabel(doc) { var dist = doc.district || DEFAULT_DISTRICT; var sc = subcellOf(doc); return dist + ' · ' + sc.x + ',' + sc.y + (doc.subcell ? '' : ' (auto)'); }
  // Place a site in a district's 15×15 subgrid — choose district ▸ cell, one site per cell.
  function openSubgridPlacer(doc, onPick) {
    if (!window.UI) return;
    Store.index('site').then(function (rows) {
      var district = doc.district || DEFAULT_DISTRICT;
      var sel = doc.subcell ? { x: doc.subcell.x, y: doc.subcell.y } : null;
      function occ(dist) { var o = {}; rows.forEach(function (r) { if (r.json.id === doc.id) return; if (siteDistrict(r.json) !== dist) return; var sc = subcellOf(r.json); o[sc.x + ',' + sc.y] = r.json.name || 'site'; }); return o; }
      UI.modal({ title: 'Place the site — district ▸ cell', size: 'wide',
        body: '<label class="rt-field"><span class="rt-field-l">District (subgrid)</span><select class="rt-input" id="pl-dist">' + NC_DISTRICTS.map(function (n) { return '<option value="' + n.id + '"' + (district === n.id ? ' selected' : '') + '>' + n.id + ' · ' + esc(n.name) + '</option>'; }).join('') + '</select></label><div class="net-place-wrap"><div class="net-place" id="pl-grid"></div></div><div class="net-place-hint" id="pl-hint"></div>',
        actions: [{ label: 'Cancel' }, { label: 'Place', kind: 'primary', onClick: function () { if (sel) onPick(district, sel.x, sel.y); } }],
        onShow: function (box) {
          function draw() {
            var o = occ(district), html = '';
            for (var y = 0; y < SUBGRID_N; y++) for (var x = 0; x < SUBGRID_N; x++) { var key = x + ',' + y, isSel = sel && sel.x === x && sel.y === y, isOcc = o[key] && !isSel; html += '<button class="net-place-c' + (isOcc ? ' net-place-occ' : '') + (isSel ? ' net-place-sel' : '') + '" data-x="' + x + '" data-y="' + y + '"' + (isOcc ? ' disabled title="' + esc(o[key]) + '"' : '') + '></button>'; }
            var g = box.querySelector('#pl-grid'); g.style.gridTemplateColumns = 'repeat(' + SUBGRID_N + ',1fr)'; g.innerHTML = html;
            box.querySelector('#pl-hint').textContent = sel ? ('Cell ' + sel.x + ',' + sel.y + ' — one site per cell.') : 'Pick an empty cell (occupied cells are dimmed).';
            g.querySelectorAll('[data-x]').forEach(function (c2) { if (c2.disabled) return; c2.onclick = function () { sel = { x: +c2.getAttribute('data-x'), y: +c2.getAttribute('data-y') }; draw(); }; });
          }
          box.querySelector('#pl-dist').onchange = function (e) { district = e.target.value; sel = null; draw(); };
          draw();
        } });
    });
  }

  /* ═══════════════ EDITOR — 3 tabs (Info → Blocks → Design) + live preview ═══════════════ */
  function renderEditor(t, host) {
    var ref = { type: 'site', id: t.ref }; host.className = 'tab-content dt-fiche';
    host.innerHTML = '<div class="dt-fichebar"><div class="lk-band-host"></div></div><div class="dt-fiche-body"><div class="app-empty">…</div></div>';
    var body = host.querySelector('.dt-fiche-body');
    Store.resolve(ref).then(function (hit) { if (!hit) { body.innerHTML = '<div class="app-empty">Not found.</div>'; return; } var doc = hit.json; t.label = doc.name || 'site'; if (window.Links) Links.renderBand(host.querySelector('.lk-band-host'), { type: 'site', id: doc.id }, { noProps: false }); renderComposer(body, { type: 'site', id: doc.id }, doc); if (window.Shell) Shell.renderTabs(); });
  }
  var _saveT = null;
  function schedule(ref, doc, then) { clearTimeout(_saveT); _saveT = setTimeout(function () { Store.put(ref, doc).then(then || function () {}).catch(function (e) { console.error(e); }); }, 400); }

  function renderComposer(body, ref, doc) {
    doc.record = doc.record || { uploadDate: Date.now(), broadcast: doc.broadcast, hostId: doc.hostId || null, serverAddress: '', infraId: null };
    doc.grid = doc.grid || { x: CENTER.x, y: CENTER.y }; ensurePages(doc);
    var _tab = isPlayer() ? 'blocks' : 'info', _page = homePage(doc);
    var _drag = null, _palCat = 0, _palQ = '';   // MUST be initialized before the first setTab() → paintBlocksTab (var-hoist bug: else _palQ is undefined at first paint)
    body.innerHTML =
      '<div class="web-comp"><div class="web-comp-left">' +
        '<div class="web-comp-row"><input class="dtf-name" id="web-name" value="' + esc(doc.name || '') + '" placeholder="Site name"><button class="dt-btn" id="web-open">open ↗</button></div>' +
        '<div class="web-edit-tabs"><button class="web-et" data-et="info">Info</button><button class="web-et" data-et="blocks">Blocks</button><button class="web-et" data-et="design">Design</button>' + (doc.app ? '' : '<button class="web-et" data-et="access">Access</button><button class="web-et" data-et="ads">Ads</button>') + '<button class="web-et" data-et="fort">Fort</button></div>' +
        '<div class="web-edit-body" id="web-edit-body"></div>' +
      '</div><div class="web-comp-right"><div class="dt-head">PREVIEW — WHAT A VISITOR SEES</div><div class="web-preview" id="web-preview"></div></div></div>';
    body.querySelector('#web-name').oninput = function (e) { doc.name = e.target.value; poke(); };
    body.querySelector('#web-open').onclick = function () { Shell.openTool('web-browse'); setTimeout(function () { navTo(pageUrl(doc, _page)); }, 60); };
    body.querySelectorAll('.web-et').forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-et')); }; });
    setTab(_composerFortId === doc.id ? 'fort' : (isPlayer() ? 'blocks' : 'info')); _composerFortId = null;   // setTab() now calls preview()

    function setTab(t2) { _tab = t2; body.querySelectorAll('.web-et').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-et') === t2); }); var comp = body.querySelector('.web-comp'); if (comp) comp.classList.toggle('web-comp-fort', t2 === 'fort'); var c = body.querySelector('#web-edit-body'); if (!c) return; if (_tab === 'info') (isPlayer() ? paintPlayerMeta : paintMeta)(c); else if (_tab === 'blocks') paintBlocksTab(c); else if (_tab === 'access') paintAccess(c); else if (_tab === 'ads') paintAds(c); else if (_tab === 'fort') renderFortBuilder(c, doc, ref, poke); else paintStyle(c); preview(); }
    function paintAds(c) {
      c.innerHTML = '<p class="dt-hint">Ads on your site come from <b>Ad slot</b> blocks. More slots = more revenue per visit, but they drag your traffic down — find the sweet spot. Sign a rate with an ad network.</p><div id="web-ads-body">…</div>';
      Store.index('site').then(function (all) {
        var slots = adSlots(doc), traffic = computeTraffic(doc, all), rev = computeAdRevenue(doc, all);
        var offers = AD_REGIES.map(function (r, i) { var picked = (doc.adRegie === r.name); return '<div class="web-regie' + (picked ? ' on' : '') + '"><div class="web-regie-h"><b>' + esc(r.name) + '</b><span class="web-regie-rate">' + r.rate + 'eb / visit</span></div><div class="web-regie-note">' + esc(r.note) + '</div><button class="web-mini" data-regie="' + i + '">' + (picked ? '✓ signed' : 'sign') + '</button></div>'; }).join('');
        c.querySelector('#web-ads-body').innerHTML =
          '<div class="web-ads-stats"><span>' + slots + ' ad slot' + (slots === 1 ? '' : 's') + '</span><span>~' + traffic + ' visits/mo</span><span class="web-ads-rev">' + rev + 'eb / mo</span></div>' +
          '<div class="web-ads-cur">Contract: <b>' + esc(doc.adRegie || 'none') + '</b>' + (doc.adRate ? ' — ' + doc.adRate + 'eb/visit' : '') + (doc.adRegie ? ' <button class="web-mini" id="web-ads-drop">drop</button>' : '') + '</div>' +
          '<div class="web-regies">' + offers + '</div>';
        c.querySelectorAll('[data-regie]').forEach(function (b) { b.onclick = function () { var r = AD_REGIES[+b.getAttribute('data-regie')]; doc.adRegie = r.name; doc.adRate = r.rate; poke(); paintAds(c); }; });
        var drop = c.querySelector('#web-ads-drop'); if (drop) drop.onclick = function () { doc.adRegie = ''; doc.adRate = 0; poke(); paintAds(c); };
      }).catch(function () {});
    }
    function paintAccess(c) {
      var a = ensureAuth(doc);
      c.innerHTML = '<label class="lk-prop"><input type="checkbox" id="au-en"' + (a.enabled ? ' checked' : '') + '> require login</label> ' +
        '<label class="lk-prop"><input type="checkbox" id="au-wall"' + (a.wall ? ' checked' : '') + '> login wall (hide everything until signed in)</label> ' +
        '<label class="lk-prop"><input type="checkbox" id="au-hidebar"' + (a.hideBar ? ' checked' : '') + '> hide the login bar (use a Login block instead)</label>' +
        '<div class="web-acc-sec"><div class="web-acc-h">Clearance levels</div><div id="au-levels"></div><button class="dt-btn" id="au-addlvl">+ level</button></div>' +
        '<div class="web-acc-sec"><div class="web-acc-h">Accounts</div><div id="au-accs"></div><button class="dt-btn" id="au-addacc">+ account</button></div>' +
        '<p class="dt-hint">Level 0 = Public. A block or page reveals its content to accounts at or above its level; below that it shows [REDACTED] (or is hidden). Players type credentials they find in-world. Note: passwords live in the site data — fine at the table, but a player inspecting raw sync data could read them.</p>';
      c.querySelector('#au-en').onchange = function (e) { a.enabled = e.target.checked; poke(); preview(); };
      c.querySelector('#au-wall').onchange = function (e) { a.wall = e.target.checked; poke(); preview(); };
      c.querySelector('#au-hidebar').onchange = function (e) { a.hideBar = e.target.checked; poke(); preview(); };
      c.querySelector('#au-addlvl').onclick = function () { a.levels.push('Level ' + a.levels.length); poke(); paintLevels(); };
      c.querySelector('#au-addacc').onclick = function () { a.accounts.push({ id: uid('acc'), user: '', pass: '', level: Math.max(1, a.levels.length - 1) }); poke(); paintAccs(); };
      paintLevels(); paintAccs();
      function paintLevels() { var box = c.querySelector('#au-levels'); box.innerHTML = a.levels.map(function (lv, i) { return '<div class="web-acc-row"><span class="web-acc-i">' + i + '</span><input class="rt-input" data-lvl="' + i + '" value="' + esc(lv) + '"' + (i === 0 ? ' disabled' : '') + '>' + (i > 0 ? '<button class="rt-link" data-lvlx="' + i + '">✕</button>' : '') + '</div>'; }).join(''); box.querySelectorAll('[data-lvl]').forEach(function (inp) { inp.oninput = function () { a.levels[+inp.getAttribute('data-lvl')] = inp.value; poke(); }; }); box.querySelectorAll('[data-lvlx]').forEach(function (bt) { bt.onclick = function () { a.levels.splice(+bt.getAttribute('data-lvlx'), 1); poke(); paintLevels(); paintAccs(); }; }); }
      function paintAccs() { var box = c.querySelector('#au-accs'); box.innerHTML = a.accounts.length ? a.accounts.map(function (ac, i) { return '<div class="web-acc-acct"><input class="rt-input" data-au="' + i + '" data-k="user" placeholder="user" value="' + esc(ac.user || '') + '"><input class="rt-input" data-au="' + i + '" data-k="pass" placeholder="pass" value="' + esc(ac.pass || '') + '"><select data-au="' + i + '" data-k="level">' + a.levels.map(function (lv, li) { return '<option value="' + li + '"' + ((ac.level || 0) === li ? ' selected' : '') + '>' + esc(lv) + '</option>'; }).join('') + '</select><button class="rt-link" data-aux="' + i + '">✕</button></div>'; }).join('') : '<div class="app-empty">No accounts. Add one for each clearance you hand out.</div>'; box.querySelectorAll('[data-au]').forEach(function (inp) { inp.oninput = inp.onchange = function () { var i = +inp.getAttribute('data-au'), k = inp.getAttribute('data-k'); a.accounts[i][k] = (k === 'level') ? (+inp.value) : inp.value; poke(); }; }); box.querySelectorAll('[data-aux]').forEach(function (bt) { bt.onclick = function () { a.accounts.splice(+bt.getAttribute('data-aux'), 1); poke(); paintAccs(); }; }); }
    }
    function poke() { doc.lastEdit = netClock(); schedule(ref, doc, function () { var l = document.getElementById('web-sitelist'); if (l) paintSiteList(l); }); preview(); }
    function preview() { var pv = body.querySelector('#web-preview'); if (!pv) return; pv.innerHTML = ''; var host = document.createElement('div'); pv.appendChild(host); renderSiteResolved(host, doc, _page ? _page.slug : ''); }
    function field(label, inner) { return '<label class="web-mf"><span>' + esc(label) + '</span>' + inner + '</label>'; }

    function paintMeta(c) {
      c.innerHTML = '<div class="web-metagrid">' +
        field('Kind', '<select id="wm-kind">' + ['site', 'bbs', 'media', 'corp', 'gov', 'shop', 'person', 'blackmarket', 'host'].map(function (k) { return '<option' + (k === (doc.kind || 'site') ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>') +
        field('Level (map icon)', '<select id="wm-level">' + Object.keys(LEVELS).map(function (l) { return '<option value="' + l + '"' + (l === (doc.level || 'lv1') ? ' selected' : '') + '>' + LEVEL_LABEL[l] + '</option>'; }).join('') + '</select>') +
        field('Placement', '<button class="dt-btn" id="wm-place">▦ place (district ▸ cell)</button> <span class="web-metaval" id="wm-cell">' + esc(placeLabel(doc)) + '</span>') +
        field('Broadcast', '<select id="wm-bc">' + BROADCAST.map(function (b) { return '<option' + (b === (doc.broadcast || 'citywide') ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select>') +
        field('Host', '<button class="dt-btn" id="wm-host">' + esc(doc.hostId ? 'linked' : 'pick host…') + '</button>') +
        field('Subject', '<button class="dt-btn" id="wm-subject">' + esc(doc.subject ? (doc.subject.type + ' linked') : 'link a record…') + '</button>') +
        field('Server addr', '<input id="wm-server" value="' + esc((doc.record && doc.record.serverAddress) || '') + '" placeholder="recon-gated">') +
        field('Uploaded', '<span class="web-metaval">' + new Date(doc.record.uploadDate || Date.now()).toLocaleDateString() + '</span>') +
        field('Address', '<span class="web-metaval">' + esc(siteUrl(doc)) + '</span>') +
        field('Infrastructure', '<span class="web-metaval">' + (doc.record.infraId ? 'datafort linked' : 'none (v3)') + '</span>') +
        field('Listed', '<label class="lk-prop"><input type="checkbox" id="wm-listed"' + (doc.unlisted ? '' : ' checked') + '> in directory</label>') +
        field('Known by default', '<label class="lk-prop"><input type="checkbox" id="wm-known"' + (doc.known ? ' checked' : '') + '> starter set (players arrive knowing it)</label>') +
        '</div><div id="web-hostcfg"></div>';
      c.querySelector('#wm-kind').onchange = function (e) { doc.kind = e.target.value; paintHostCfg(c); poke(); };
      c.querySelector('#wm-level').onchange = function (e) { doc.level = e.target.value; poke(); };
      c.querySelector('#wm-place').onclick = function () { openSubgridPlacer(doc, function (dist, x, y) { doc.district = dist; doc.subcell = { x: x, y: y }; poke(); var el = c.querySelector('#wm-cell'); if (el) el.textContent = placeLabel(doc); }); };
      c.querySelector('#wm-bc').onchange = function (e) { doc.broadcast = e.target.value; doc.record.broadcast = e.target.value; clampBroadcast(doc); poke(); };
      c.querySelector('#wm-server').oninput = function (e) { doc.record.serverAddress = e.target.value; poke(); };
      c.querySelector('#wm-listed').onchange = function (e) { doc.unlisted = !e.target.checked; poke(); };
      c.querySelector('#wm-known').onchange = function (e) { doc.known = e.target.checked; poke(); };
      c.querySelector('#wm-host').onclick = function () { pickHost(function (r) { doc.hostId = r ? r.id : null; doc.record.hostId = doc.hostId; if (r && window.Links && Links.add) Links.add({ type: 'site', id: doc.id }, { type: 'site', id: r.id }, 'hosted on', 'hosts'); clampBroadcast(doc); poke(); paintMeta(c); }); };
      c.querySelector('#wm-subject').onclick = function () { pickSubject(function (r) { doc.subject = r || null; if (r && window.Links && Links.add) Links.add({ type: 'site', id: doc.id }, r, 'site of', 'has site'); poke(); paintMeta(c); }); };
      paintHostCfg(c);
    }
    function paintPlayerMeta(c) {
      c.innerHTML = '<div class="web-metagrid">' +
        field('Site name', '<input id="pm-name" value="' + esc(doc.name || '') + '">') +
        field('Placement', '<button class="dt-btn" id="pm-place">▦ place (district ▸ cell)</button> <span class="web-metaval" id="pm-cell">' + esc(placeLabel(doc)) + '</span>') +
        field('Linked record', '<button class="dt-btn" id="pm-subject">' + esc(doc.subject ? (doc.subject.type + ' linked') : 'link your shop / org…') + '</button>') +
        field('Plan', '<span class="web-metaval">' + esc(doc.plan || '—') + '</span>') +
        field('Reach', '<span class="web-metaval">' + esc(doc.broadcast || '—') + '</span>') +
        field('Address', '<span class="web-metaval">' + esc(siteUrl(doc)) + '</span>') +
        field('Server addr', '<span class="web-metaval">' + esc((doc.record && doc.record.serverAddress) || 'recon-gated') + '</span>') +
        field('Uploaded', '<span class="web-metaval">' + new Date((doc.record && doc.record.uploadDate) || Date.now()).toLocaleDateString() + '</span>') +
        '</div><p class="dt-hint">Your host sets your reach and address. You can place the site on the map and link a shop or org you own.</p>';
      c.querySelector('#pm-name').oninput = function (e) { doc.name = e.target.value; poke(); };
      c.querySelector('#pm-place').onclick = function () { openSubgridPlacer(doc, function (dist, x, y) { doc.district = dist; doc.subcell = { x: x, y: y }; poke(); var cell = c.querySelector('#pm-cell'); if (cell) cell.textContent = placeLabel(doc); }); };
      c.querySelector('#pm-subject').onclick = function () { pickSubjectRestricted(function (r) { doc.subject = r || null; if (r && window.Links && Links.add) Links.add({ type: 'site', id: doc.id }, r, 'site of', 'has site'); poke(); paintPlayerMeta(c); }); };
    }
    function paintHostCfg(c) {
      var h = c.querySelector('#web-hostcfg'); if (!h) return; if (doc.kind !== 'host') { h.innerHTML = ''; return; }
      doc.hostConfig = doc.hostConfig || { price: 100, legality: 2, netwatchCoop: 1, reliability: 2, reachGranted: 'citywide', anonymity: 1, serverAddress: '' }; var cfg = doc.hostConfig;
      h.innerHTML = '<div class="dt-head" style="margin-top:10px">HOST CONFIG</div><div class="web-metagrid">' +
        field('Price (eb)', '<input type="number" id="hc-price" value="' + (cfg.price || 0) + '">') + field('Legality 0-3', '<input type="number" min="0" max="3" id="hc-legal" value="' + (cfg.legality || 0) + '">') +
        field('Netwatch coop 0-3', '<input type="number" min="0" max="3" id="hc-nw" value="' + (cfg.netwatchCoop || 0) + '">') + field('Reliability 0-3', '<input type="number" min="0" max="3" id="hc-rel" value="' + (cfg.reliability || 0) + '">') +
        field('Anonymity 0-3', '<input type="number" min="0" max="3" id="hc-anon" value="' + (cfg.anonymity || 0) + '">') + field('Reach granted', '<select id="hc-reach">' + BROADCAST.map(function (b) { return '<option' + (b === (cfg.reachGranted || 'citywide') ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select>') + '</div>';
      var map = { 'hc-price': 'price', 'hc-legal': 'legality', 'hc-nw': 'netwatchCoop', 'hc-rel': 'reliability', 'hc-anon': 'anonymity' };
      Object.keys(map).forEach(function (id) { var i = h.querySelector('#' + id); if (i) i.oninput = function () { cfg[map[id]] = parseInt(i.value, 10) || 0; poke(); }; });
      var rs = h.querySelector('#hc-reach'); if (rs) rs.onchange = function () { cfg.reachGranted = rs.value; poke(); };
    }
    function paintPressLook(c) {
      c.innerHTML = ''; var ac = doc.appConfig = doc.appConfig || {}; ac.palette = ac.palette || {};
      function sec(t) { c.appendChild(eln('div', 'web-cfg-sec', t)); }
      function row(label, el) { var w = eln('label', 'web-b-f'); w.appendChild(eln('span', null, label)); w.appendChild(el); c.appendChild(w); return el; }
      var base = PRESS_PALETTES[ac.layout || 'broadsheet'] || {};
      sec('SKIN');
      var skinSel = eln('select');
      [['broadsheet', 'Broadsheet — serious paper'], ['tabloid', 'Tabloid — loud splash'], ['tvnews', 'TV news — broadcast'], ['wire', 'Wire — dense dispatches'], ['gossip', 'Gossip — card grid'], ['corporate', 'Corporate newsroom'], ['zine', 'Zine — underground'], ['video', 'Video platform'], ['live', 'Live streaming']].forEach(function (o) { var op = eln('option', null, o[1]); op.value = o[0]; if (o[0] === (ac.layout || 'broadsheet')) op.selected = true; skinSel.appendChild(op); });
      skinSel.onchange = function () { ac.layout = skinSel.value; poke(); paintPressLook(c); preview(); };
      row('Visual skin (independent of what it posts)', skinSel);
      sec('PALETTE');
      var pal = eln('div', 'web-cfg-pal');
      [['bg', 'background'], ['ink', 'text'], ['accent', 'accent']].forEach(function (p) { var w = eln('label', 'web-cfg-sw'); w.appendChild(eln('span', null, p[1])); var ci = eln('input'); ci.type = 'color'; ci.value = ac.palette[p[0]] || base[p[0]] || '#000000'; ci.oninput = function () { ac.palette[p[0]] = ci.value; poke(); preview(); }; w.appendChild(ci); pal.appendChild(w); });
      c.appendChild(pal);
      var fontI = eln('input'); fontI.type = 'text'; fontI.value = ac.palette.font || ''; fontI.placeholder = base.font || 'Georgia,serif'; fontI.oninput = function () { ac.palette.font = fontI.value; if (!ac.palette.headSet) ac.palette.head = fontI.value; poke(); preview(); }; row('Body font (blank = skin default)', fontI);
      var headI = eln('input'); headI.type = 'text'; headI.value = ac.palette.headSet ? (ac.palette.head || '') : ''; headI.placeholder = 'headline font (blank = same as body)'; headI.oninput = function () { ac.palette.headSet = !!headI.value; ac.palette.head = headI.value || ac.palette.font || ''; poke(); preview(); }; row('Headline font (optional)', headI);
      var tagI = eln('input'); tagI.type = 'text'; tagI.value = ac.tagline || ''; tagI.placeholder = 'The city’s eyes'; tagI.oninput = function () { ac.tagline = tagI.value; poke(); preview(); }; row('Tagline / slogan', tagI);
      sec('BACKGROUND');
      var bgw = eln('label', 'web-b-f'); bgw.appendChild(eln('span', null, 'Background image (shows behind the page)')); var bgin = eln('input'); bgin.type = 'file'; bgin.accept = 'image/*'; bgw.appendChild(bgin); c.appendChild(bgw);
      bgin.onchange = function () { var f = bgin.files && bgin.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { ac.palette.bgImage = rd.result; poke(); paintPressLook(c); preview(); }; rd.readAsDataURL(f); };
      if (ac.palette.bgImage) { var bgx = eln('button', 'web-mini', 'clear background'); bgx.onclick = function () { ac.palette.bgImage = ''; poke(); paintPressLook(c); preview(); }; c.appendChild(bgx); }
      var resetB = eln('button', 'web-mini', 'reset colours to skin default'); resetB.onclick = function () { ac.palette = { font: ac.palette.font, head: ac.palette.head, headSet: ac.palette.headSet }; poke(); paintPressLook(c); preview(); }; c.appendChild(resetB);
    }
    function paintChatLook(c) {
      var th = doc.theme || (doc.theme = { preset: 'plain', overrides: {} }); var o = th.overrides || (th.overrides = {});
      var v = themeVars(th);
      var corpoKeys = Object.keys(THEME_PRESETS).filter(function (p) { return STREET_PRESETS.indexOf(p) < 0; });
      function colRow(label, key, dflt) { return field(label, '<input type="color" data-ov="' + key + '" value="' + esc(o[key] || dflt || '#000000') + '"><button class="web-mini" data-ovx="' + key + '" title="reset to preset">↺</button>'); }
      c.innerHTML = '<p class="dt-hint">Design freely — every colour, both fonts and the corner radius override the preset, so any look is reachable. Start from a preset, then tune. (Behaviour — channels, DMs, gate — is in the Blocks tab.)</p><div class="web-metagrid">' +
        field('Start from preset', '<select id="ws-preset"><optgroup label="Street / old-web">' + STREET_PRESETS.map(function (p) { return '<option' + (p === th.preset ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</optgroup><optgroup label="Corpo / modern">' + corpoKeys.map(function (p) { return '<option' + (p === th.preset ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</optgroup></select>') +
        colRow('Background', 'bg', v.bg) + colRow('Panels / bubbles', 'card', v.card) + colRow('Text', 'fg', v.fg) +
        colRow('Accent · my bubble', 'accent', v.accent) + colRow('Lines', 'rule', v.rule) + colRow('Muted text', 'muted', v.muted) +
        field('Corner radius', '<input type="range" id="ws-radius" min="0" max="20" value="' + (parseInt(v.radius, 10) || 0) + '"> <span id="ws-radius-o">' + (parseInt(v.radius, 10) || 0) + 'px</span>') +
        field('Body font', '<select id="ws-font"><option value="">— preset —</option>' + WEB_FONTS.map(function (op) { return '<option value="' + esc(op[1]) + '"' + (op[1] === (o.font || '') ? ' selected' : '') + '>' + esc(op[0]) + '</option>'; }).join('') + '</select>') +
        field('Display font (brand · headers)', '<select id="ws-head"><option value="">— same as body —</option>' + WEB_FONTS.map(function (op) { return '<option value="' + esc(op[1]) + '"' + (op[1] === (o.head || '') ? ' selected' : '') + '>' + esc(op[0]) + '</option>'; }).join('') + '</select>') +
        field('Background image', '<label class="dt-btn">image<input type="file" accept="image/*" id="ws-bg" hidden></label>' + (o.bgImage ? ' <button class="dt-btn" id="ws-bgx">clear</button>' : '')) + '</div>';
      c.querySelector('#ws-preset').onchange = function (e) { th.preset = e.target.value; poke(); paintChatLook(c); preview(); };
      c.querySelectorAll('[data-ov]').forEach(function (inp) { inp.oninput = function () { o[inp.getAttribute('data-ov')] = inp.value; poke(); preview(); }; });
      c.querySelectorAll('[data-ovx]').forEach(function (b) { b.onclick = function () { delete o[b.getAttribute('data-ovx')]; poke(); paintChatLook(c); preview(); }; });
      var rad = c.querySelector('#ws-radius'); rad.oninput = function () { o.radius = rad.value + 'px'; c.querySelector('#ws-radius-o').textContent = rad.value + 'px'; poke(); preview(); };
      c.querySelector('#ws-font').onchange = function (e) { o.font = e.target.value; poke(); preview(); };
      c.querySelector('#ws-head').onchange = function (e) { o.head = e.target.value; poke(); preview(); };
      var bg = c.querySelector('#ws-bg'); if (bg) bg.onchange = function () { var f = bg.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { o.bgImage = rd.result; poke(); paintChatLook(c); preview(); }; rd.readAsDataURL(f); };
      var bx = c.querySelector('#ws-bgx'); if (bx) bx.onclick = function () { o.bgImage = ''; poke(); paintChatLook(c); preview(); };
    }
    function paintStyle(c) {
      if (doc.app === 'press') return paintPressLook(c);
      if (CHAT_APPS.indexOf(doc.app) >= 0) return paintChatLook(c);
      var th = doc.theme || (doc.theme = { preset: 'plain', overrides: {} }); var o = th.overrides || (th.overrides = {});
      var corpoKeys = Object.keys(THEME_PRESETS).filter(function (p) { return STREET_PRESETS.indexOf(p) < 0; });
      c.innerHTML = '<div class="web-metagrid">' +
        field('Preset', '<select id="ws-preset"><optgroup label="Street / old-web">' + STREET_PRESETS.map(function (p) { return '<option' + (p === th.preset ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</optgroup><optgroup label="Corpo / modern">' + corpoKeys.map(function (p) { return '<option' + (p === th.preset ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</optgroup></select>') +
        field('Accent', '<input type="color" id="ws-accent" value="' + esc(o.accent || themeVars(th).accent) + '">') +
        field('Font', '<select id="ws-font">' + WEB_FONTS.map(function (op) { return '<option value="' + esc(op[1]) + '"' + (op[1] === (o.font || '') ? ' selected' : '') + '>' + esc(op[0]) + '</option>'; }).join('') + '</select>') +
        field('Background', '<label class="dt-btn">image<input type="file" accept="image/*" id="ws-bg" hidden></label>' + (o.bgImage ? ' <button class="dt-btn" id="ws-bgx">clear</button>' : '')) + '</div><p class="dt-hint" style="margin-top:8px">The theme applies to every page of the site.</p>';
      c.querySelector('#ws-preset').onchange = function (e) { th.preset = e.target.value; poke(); paintStyle(c); };
      c.querySelector('#ws-accent').oninput = function (e) { o.accent = e.target.value; poke(); };
      c.querySelector('#ws-font').onchange = function (e) { o.font = e.target.value; poke(); };
      var bg = c.querySelector('#ws-bg'); if (bg) bg.onchange = function () { var f = bg.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { o.bgImage = rd.result; poke(); paintStyle(c); }; rd.readAsDataURL(f); };
      var bx = c.querySelector('#ws-bgx'); if (bx) bx.onclick = function () { o.bgImage = ''; poke(); paintStyle(c); };
    }
    function paintBlocksTab(c) { if (doc.app) return paintAppConfig(c); c.innerHTML = '<div class="web-pagebar" id="web-pagebar"></div><div class="web-page-ctl" id="web-pagectl"></div><div class="web-palette" id="web-palette"></div><div id="web-blocks"></div>'; paintPages(c); paintPalette(c); paintBlocks(c); }
    var CHAT_APPS = ['corpo-msg', 'runner-comms', 'consumer', 'elite', 'public', 'chat'];
    function paintAppConfig(c) {
      if (doc.app === 'press') { paintPressConfig(c); return; }
      if (CHAT_APPS.indexOf(doc.app) >= 0) { paintChatConfig(c); return; }
      c.innerHTML = '<p class="dt-hint">This is a built-in <b>' + esc(doc.app) + '</b> app — a hand-built interface, so there are no blocks to edit. You can still rename it, theme it (Design) and gate it (Access).</p>';
    }
    function paintChatConfig(c) {
      c.innerHTML = ''; var ac = doc.appConfig = doc.appConfig || {};
      function sec(t) { c.appendChild(eln('div', 'web-cfg-sec', t)); }
      function chk(val, label, on) { var w = eln('label', 'web-b-f web-b-check'); var cb = eln('input'); cb.type = 'checkbox'; cb.checked = !!val; cb.onchange = function () { on(cb.checked); poke(); preview(); }; w.appendChild(cb); w.appendChild(eln('span', null, label)); c.appendChild(w); return cb; }
      c.appendChild(eln('p', 'dt-hint', 'Chat app on the shared engine — set how it works. Its look/theme is in the Design tab.'));
      sec('CHANNELS');
      var wrap = eln('label', 'web-b-f'); wrap.innerHTML = '<span>Channels / boards (one per line — blank = DM-only)</span><textarea id="ac-chans" rows="5">' + esc((ac.channels || []).join('\n')) + '</textarea>'; c.appendChild(wrap);
      c.querySelector('#ac-chans').oninput = function (e) { ac.channels = e.target.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); poke(); preview(); };
      sec('FEATURES');
      chk(ac.dm !== false, 'Direct messages', function (v) { ac.dm = v; });
      chk(ac.presence !== false, 'Show who’s online', function (v) { ac.presence = v; });
      chk(!!ac.gateWhole, 'Invite-only (whole app behind a paywall)', function (v) { ac.gateWhole = v; });
      sec('BANNER');
      var pw = eln('label', 'web-b-f'); pw.innerHTML = '<span>PSA / notice banner (blank = none)</span><input type="text" id="ac-psa" value="' + esc(ac.psa || '') + '">'; c.appendChild(pw);
      c.querySelector('#ac-psa').oninput = function (e) { ac.psa = e.target.value; poke(); preview(); };
      sec('PRO / PAID TIER');
      var pen = ac.premium = ac.premium || {};
      chk(pen.enabled, 'Offer a paid premium tier (monthly subscription)', function (v) { pen.enabled = v; poke(); preview(); });
      var pn = eln('label', 'web-b-f'); pn.innerHTML = '<span>Tier name</span><input type="text" id="ac-pn" value="' + esc(pen.name || '') + '" placeholder="e.g. GOLD / GHOST tier">'; c.appendChild(pn);
      c.querySelector('#ac-pn').oninput = function (e) { pen.name = e.target.value; poke(); preview(); };
      var pc = eln('label', 'web-b-f'); pc.innerHTML = '<span>Price (eb / month)</span><input type="number" id="ac-pc" value="' + (pen.cost || 0) + '">'; c.appendChild(pc);
      c.querySelector('#ac-pc').oninput = function (e) { pen.cost = +e.target.value || 0; poke(); preview(); };
      var pp = eln('label', 'web-b-f'); pp.innerHTML = '<span>Pitch (why upgrade)</span><input type="text" id="ac-pp" value="' + esc(pen.pitch || '') + '">'; c.appendChild(pp);
      c.querySelector('#ac-pp').oninput = function (e) { pen.pitch = e.target.value; poke(); preview(); };
      var pk = eln('label', 'web-b-f'); pk.innerHTML = '<span>Perks (one per line)</span><textarea id="ac-pk" rows="3">' + esc((pen.perks || []).join('\n')) + '</textarea>'; c.appendChild(pk);
      c.querySelector('#ac-pk').oninput = function (e) { pen.perks = e.target.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); poke(); preview(); };
    }
    function paintPressConfig(c) {
      c.innerHTML = ''; var ac = doc.appConfig = doc.appConfig || {};
      function sec(t) { c.appendChild(eln('div', 'web-cfg-sec', t)); }
      function row(label, el) { var w = eln('label', 'web-b-f'); w.appendChild(eln('span', null, label)); w.appendChild(el); c.appendChild(w); return el; }
      function sel(val, opts, on) { var s = eln('select'); opts.forEach(function (o) { var v = (o.value != null ? o.value : o), l = (o.label != null ? o.label : o); var op = eln('option', null, l); op.value = v; if (v === val) op.selected = true; s.appendChild(op); }); s.onchange = function () { on(s.value); poke(); preview(); }; return s; }
      function txt(val, ph, on) { var i = eln('input'); i.type = 'text'; i.value = val || ''; i.placeholder = ph || ''; i.oninput = function () { on(i.value); poke(); preview(); }; return i; }
      function col(val, dflt, on) { var i = eln('input'); i.type = 'color'; i.value = val || dflt || '#000000'; i.oninput = function () { on(i.value); poke(); preview(); }; return i; }
      function lines(val, ph, on) { var t = eln('textarea'); t.rows = 4; t.value = (val || []).join('\n'); t.placeholder = ph; t.oninput = function () { on(t.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)); poke(); preview(); }; return t; }
      function chk(val, label, on) { var w = eln('label', 'web-b-f web-b-check'); var cb = eln('input'); cb.type = 'checkbox'; cb.checked = !!val; cb.onchange = function () { on(cb.checked); poke(); preview(); }; w.appendChild(cb); w.appendChild(eln('span', null, label)); c.appendChild(w); return cb; }

      c.appendChild(eln('p', 'dt-hint', 'Visual look — skin, colours, fonts, tagline — lives in the Design tab. Here you set how the outlet WORKS.'));
      sec('CONTENT');
      row('Sections / beats (one per line)', lines(ac.sections, 'Front\nCrime\nCorp', function (v) { ac.sections = v; }));
      row('Accepted formats (one per line)', lines(ac.formats, 'article\nvideo\ndispatch', function (v) { ac.formats = v; }));

      sec('WHO PUBLISHES');
      row('Submission policy', sel(ac.submit || 'media', [
        { value: 'open', label: 'Open — any account' }, { value: 'media', label: 'Media — Credibility ≥ 1' },
        { value: 'cred3', label: 'Credibility ≥ 3' }, { value: 'cred5', label: 'Credibility ≥ 5' }, { value: 'gm', label: 'GM / staff only' }
      ], function (v) { ac.submit = v; }));
      row('Workflow', sel(ac.workflow || 'auto', [{ value: 'auto', label: 'Auto-publish' }, { value: 'hold', label: 'Hold for GM review' }], function (v) { ac.workflow = v; }));

      sec('EDITORIAL');
      row('Angle / slant', sel(ac.angle || 'neutral', ['neutral', 'corpo', 'independent', 'sensational', 'activist', 'state'].map(function (a) { return { value: a, label: a }; }), function (v) { ac.angle = v; }));
      var own = eln('div', 'web-b-f'); own.appendChild(eln('span', null, 'Owned / funded by (corp)'));
      var ob = eln('button', 'web-mini', (ac.corpoLink && ac.corpoLink.name) ? ac.corpoLink.name : 'link an org…');
      ob.onclick = function () { pickSubject(function (ref) { if (!ref) return; Promise.resolve(Store.resolve(ref)).then(function (rec) { ac.corpoLink = { type: ref.type, id: ref.id, name: (rec && rec.json && rec.json.name) || '' }; poke(); paintPressConfig(c); preview(); }); }); };
      own.appendChild(ob);
      if (ac.corpoLink) { var clr = eln('button', 'web-mini', '✕'); clr.onclick = function () { ac.corpoLink = null; poke(); paintPressConfig(c); preview(); }; own.appendChild(clr); }
      c.appendChild(own);

      sec('AUDIENCE & TRUST');
      row('Comments', sel(ac.comments || 'on', [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], function (v) { ac.comments = v; }));
      row('Story order', sel(ac.rank || 'chrono', [{ value: 'chrono', label: 'Newest first' }, { value: 'reach', label: 'By reach' }], function (v) { ac.rank = v; }));
      chk(ac.showRatings, 'Show fact-check ratings on stories', function (v) { ac.showRatings = v; });

      sec('MECHANICS (optional)');
      row('Verification gate — min confirmed sources to publish', sel(String(ac.requireSources || 0), [{ value: '0', label: 'off' }, { value: '1', label: '1 source' }, { value: '2', label: '2 sources' }, { value: '3', label: '3 sources' }], function (v) { ac.requireSources = +v; }));
      row('Monetization', sel(ac.money || 'ads', [{ value: 'none', label: 'none / free' }, { value: 'ads', label: 'ads (traffic × rate)' }, { value: 'subs', label: 'subscriptions' }, { value: 'donations', label: 'donations' }, { value: 'doses', label: 'pay-per-view (doses)' }, { value: 'mobilization', label: 'mobilization — no money, turnout' }], function (v) { ac.money = v; }));
      chk(ac.allowDramatize, 'Allow “dramatic recreation” (flagged fabrications)', function (v) { ac.allowDramatize = v; });
      chk(ac.allowRedaction, 'Allow redaction — [REDACTED] spans in dumps', function (v) { ac.allowRedaction = v; });
      chk(ac.sourceShield, 'Shield sources (protect / hide bylines)', function (v) { ac.sourceShield = v; });
    }
    function paintPages(c) {
      var bar = c.querySelector('#web-pagebar');
      bar.innerHTML = doc.pages.map(function (p, i) { return '<button class="web-page-tab' + (p === _page ? ' on' : '') + '" data-pg="' + i + '">' + esc(p.name || 'page') + (p.home ? ' ⌂' : '') + '</button>'; }).join('') + '<button class="web-page-add" id="web-pgadd">+ page</button>';
      bar.querySelectorAll('[data-pg]').forEach(function (b) { b.onclick = function () { _page = doc.pages[+b.getAttribute('data-pg')]; paintBlocksTab(c); preview(); }; });
      var add = bar.querySelector('#web-pgadd'); if (add) add.onclick = function () { App.prompt('New page', 'Page name', 'Page', function (n) { n = (n || '').trim() || 'Page'; var pg = { id: uid('pg'), name: n, slug: slugify(n), home: false, blocks: [] }; doc.pages.push(pg); _page = pg; poke(); paintBlocksTab(c); preview(); }); };
      var ctl = c.querySelector('#web-pagectl');
      ctl.innerHTML = '<button data-prename>rename</button><button data-phome>set home</button><button data-playout>' + (_page.layout === 'app' ? 'layout: app ▣' : 'layout: flow ▤') + '</button><button data-pleft>◄</button><button data-pright>►</button>' + (doc.pages.length > 1 ? '<button data-pdel class="web-del">delete</button>' : '');
      ctl.querySelector('[data-prename]').onclick = function () { App.prompt('Rename page', 'Page name', _page.name || '', function (n) { n = (n || '').trim(); if (!n) return; _page.name = n; if (!_page.home) _page.slug = slugify(n); poke(); paintBlocksTab(c); }); };
      ctl.querySelector('[data-phome]').onclick = function () { doc.pages.forEach(function (p) { if (p.home && p !== _page) { p.home = false; p.slug = slugify(p.name); } }); _page.home = true; _page.slug = ''; poke(); paintBlocksTab(c); };
      ctl.querySelector('[data-playout]').onclick = function () { _page.layout = (_page.layout === 'app') ? 'flow' : 'app'; poke(); paintBlocksTab(c); };
      if (doc.auth && doc.auth.enabled) { var ps = document.createElement('select'); ps.className = 'web-page-acc'; ps.title = 'page clearance'; ps.innerHTML = siteLevels(doc).map(function (lv, i) { return '<option value="' + i + '"' + ((_page.access || 0) === i ? ' selected' : '') + '>🔒 ' + esc(lv) + '</option>'; }).join(''); ps.onchange = function () { _page.access = +ps.value; poke(); preview(); }; ctl.appendChild(ps); }
      ctl.querySelector('[data-pleft]').onclick = function () { var i = doc.pages.indexOf(_page); if (i > 0) { doc.pages.splice(i, 1); doc.pages.splice(i - 1, 0, _page); poke(); paintBlocksTab(c); } };
      ctl.querySelector('[data-pright]').onclick = function () { var i = doc.pages.indexOf(_page); if (i < doc.pages.length - 1) { doc.pages.splice(i, 1); doc.pages.splice(i + 1, 0, _page); poke(); paintBlocksTab(c); } };
      var del = ctl.querySelector('[data-pdel]'); if (del) del.onclick = function () { if (doc.pages.length <= 1) return; var i = doc.pages.indexOf(_page); doc.pages.splice(i, 1); if (_page.home && doc.pages[0]) { doc.pages[0].home = true; doc.pages[0].slug = ''; } _page = homePage(doc); poke(); paintBlocksTab(c); };
    }
    // (_drag / _palCat / _palQ are declared at the top of renderComposer — before the first setTab.)
    // Compact palette: a search box + one category at a time (56 blocks would be a wall).
    function paintPalette(c) {
      var p = c.querySelector('#web-palette');
      p.innerHTML = '<input class="web-pal-q" id="web-pal-q" placeholder="search blocks…"><div class="web-pal-cats" id="web-pal-cats"></div><div class="web-pal-list" id="web-pal-list"></div>';
      var qi = p.querySelector('#web-pal-q'); qi.value = _palQ || '';
      qi.oninput = function () { _palQ = qi.value; paintPalCats(); paintPalList(); };
      paintPalCats(); paintPalList();
      function paintPalCats() {
        var box = p.querySelector('#web-pal-cats'), q = (_palQ || '').trim();
        box.innerHTML = BLOCK_GROUPS.map(function (g, i) { return '<button class="web-pal-cat' + (!q && (_palCat || 0) === i ? ' on' : '') + '" data-cat="' + i + '">' + esc(g.label) + '</button>'; }).join('');
        box.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { _palCat = +b.getAttribute('data-cat'); _palQ = ''; qi.value = ''; paintPalCats(); paintPalList(); }; });
      }
      function paintPalList() {
        var box = p.querySelector('#web-pal-list'), q = (_palQ || '').trim().toLowerCase(), keys;
        if (q) { keys = []; BLOCK_GROUPS.forEach(function (g) { g.keys.forEach(function (k) { if (blockRegistry[k] && keys.indexOf(k) < 0 && (blockRegistry[k].label.toLowerCase().indexOf(q) >= 0 || k.indexOf(q) >= 0)) keys.push(k); }); }); }
        else { var g = BLOCK_GROUPS[_palCat || 0]; keys = (g ? g.keys : []).filter(function (k) { return blockRegistry[k]; }); }
        if (isPlayer() && Array.isArray(doc.allowedBlocks)) keys = keys.filter(function (k) { return doc.allowedBlocks.indexOf(k) >= 0; });
        else keys = keys.filter(function (k) { return isPlayer() || true; }); // GM: everything
        box.innerHTML = keys.length ? keys.map(function (k) { return '<button class="web-pal-b' + (isContainer(k) ? ' web-pal-cont' : '') + '" draggable="true" data-add="' + k + '" title="' + esc(k) + '">' + esc(blockRegistry[k].label) + '</button>'; }).join('') : '<div class="web-empty">No blocks available in this plan.</div>';
        box.querySelectorAll('[data-add]').forEach(function (b) {
          var ty = b.getAttribute('data-add');
          b.onclick = function () { _page.blocks = _page.blocks || []; _page.blocks.push(migrateBlock({ id: uid('b'), type: ty })); poke(); paintBlocks(c); };
          b.ondragstart = function (e) { _drag = { newType: ty }; e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', ty); } catch (_) {} };
          b.ondragend = function () { _drag = null; };
        });
      }
    }
    function canDrop(list, sctx) {
      if (!_drag) return false;
      var type = _drag.newType || (_drag.block && _drag.block.type);
      if (sctx === 'cell' && isContainer(type)) return false;   // table cells hold leaves only
      if (sctx === 'col' && type === 'columns') return false;    // no columns inside columns
      if (_drag.block && listInSubtree(_drag.block, list)) return false;
      return true;
    }
    function doDrop(list, index, sctx, c) {
      if (!canDrop(list, sctx)) { _drag = null; return; }
      var nb;
      if (_drag.newType) nb = migrateBlock({ id: uid('b'), type: _drag.newType });
      else { nb = _drag.block; var from = _drag.list; var fi = from.indexOf(nb); if (fi < 0) { _drag = null; return; } from.splice(fi, 1); if (from === list && fi < index) index--; }
      list.splice(index, 0, nb); _drag = null; poke(); paintBlocks(c);
    }
    function dz(list, index, sctx, c) {
      var d = eln('div', 'web-dz');
      d.ondragover = function (e) { if (!canDrop(list, sctx)) return; e.preventDefault(); d.classList.add('on'); };
      d.ondragleave = function () { d.classList.remove('on'); };
      d.ondrop = function (e) { e.preventDefault(); e.stopPropagation(); d.classList.remove('on'); doDrop(list, index, sctx, c); };
      return d;
    }
    function dzBig(list, sctx, c) {
      var d = eln('div', 'web-ez-empty', 'drop blocks here');
      d.ondragover = function (e) { if (!canDrop(list, sctx)) return; e.preventDefault(); d.classList.add('on'); };
      d.ondragleave = function () { d.classList.remove('on'); };
      d.ondrop = function (e) { e.preventDefault(); e.stopPropagation(); d.classList.remove('on'); doDrop(list, 0, sctx, c); };
      return d;
    }
    function buildZone(list, sctx, c) {
      var z = eln('div', 'web-ez');
      if (!list.length) { z.appendChild(dzBig(list, sctx, c)); return z; }
      z.appendChild(dz(list, 0, sctx, c));
      list.forEach(function (b, i) { z.appendChild(editCard(b, list, sctx, c)); z.appendChild(dz(list, i + 1, sctx, c)); });
      return z;
    }
    function slotCtxFor(type) { return type === 'table' ? 'cell' : type === 'columns' ? 'col' : 'body'; }
    function editCard(b, list, sctx, c) {
      migrateBlock(b); var def = blockRegistry[b.type] || { label: b.type, fields: [] };
      var card = eln('div', 'web-ec' + (isContainer(b.type) ? ' web-ec-cont' : '')); card.setAttribute('data-bid', b.id);
      var head = eln('div', 'web-ec-h'); head.draggable = true; head.innerHTML = '<span class="web-ec-drag" title="drag">⠿</span><span class="web-ec-t">' + esc(def.label) + '</span>';
      head.ondragstart = function (e) { e.stopPropagation(); _drag = { block: b, list: list }; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', b.id); } catch (_) {} };
      head.ondragend = function (e) { e.stopPropagation(); _drag = null; card.classList.remove('dragging'); };
      var wsel = eln('select', 'web-ec-w'); wsel.title = 'width'; wsel.innerHTML = WEB_WIDTHS.map(function (w) { return '<option value="' + w[0] + '"' + ((b.w || 'full') === w[0] ? ' selected' : '') + '>' + w[1] + '</option>'; }).join(''); wsel.onchange = function () { b.w = wsel.value; poke(); preview(); };
      var eBtn = eln('button', 'web-ec-x', '✎'); eBtn.title = 'fields';
      var sBtn = eln('button', 'web-ec-x', '▨'); sBtn.title = 'background & font'; sBtn.onclick = function () { pickBlockStyle(b, function () { poke(); preview(); }); };
      var xBtn = eln('button', 'web-ec-x', '✕'); xBtn.title = 'delete'; xBtn.onclick = function () { var i = list.indexOf(b); if (i >= 0) { list.splice(i, 1); poke(); paintBlocks(c); } };
      head.appendChild(wsel); head.appendChild(sBtn); head.appendChild(eBtn); head.appendChild(xBtn); card.appendChild(head);
      var bodyEl = eln('div', 'web-ec-body'); if (!b._open) bodyEl.style.display = 'none'; if (def.fields.length) mountFields(bodyEl, b, c); else bodyEl.appendChild(eln('div', 'web-ec-nofields', 'no options'));
      card.appendChild(bodyEl); eBtn.onclick = function () { b._open = !b._open; bodyEl.style.display = b._open ? 'block' : 'none'; };
      if (isContainer(b.type)) {
        ensureSlots(b); var ctl = containerCtl(b, c); if (ctl) card.appendChild(ctl);
        var sw = eln('div', 'web-ec-slots web-ec-slots-' + b.type);
        if (b.type === 'table') sw.style.cssText = 'display:grid;gap:6px;padding:6px;grid-template-columns:repeat(' + Math.max(1, parseInt(b.cols, 10) || 2) + ',1fr)';
        slotDefs(b).forEach(function (sd) { var sl = eln('div', 'web-ec-slot'); sl.appendChild(eln('div', 'web-ec-slotlab', esc(sd.label))); sl.appendChild(buildZone(b.slots[sd.key], slotCtxFor(b.type), c)); sw.appendChild(sl); });
        card.appendChild(sw);
      }
      if (doc.auth && doc.auth.enabled) card.appendChild(blockAccessRow(b, c));
      return card;
    }
    function blockAccessRow(b) {
      var row = eln('div', 'web-ec-acc'); row.appendChild(eln('span', 'web-ec-acclab', '🔒 access'));
      var sel = eln('select'); sel.innerHTML = siteLevels(doc).map(function (lv, i) { return '<option value="' + i + '"' + ((b.access || 0) === i ? ' selected' : '') + '>' + esc(lv) + '</option>'; }).join(''); sel.onchange = function () { b.access = +sel.value; poke(); preview(); }; row.appendChild(sel);
      var hide = eln('label', 'web-ec-acchide'); var cb = eln('input'); cb.type = 'checkbox'; cb.checked = !!b.accHide; cb.onchange = function () { b.accHide = cb.checked; poke(); preview(); }; hide.appendChild(cb); hide.appendChild(document.createTextNode(' hide')); row.appendChild(hide);
      return row;
    }
    function containerCtl(b, c) {
      var el = eln('div', 'web-ec-ctl');
      if (b.type === 'columns') { el.appendChild(document.createTextNode('cols ')); [2, 3, 4].forEach(function (n) { var bt = eln('button', 'web-ec-mini' + (colCount(b) === n ? ' on' : ''), '' + n); bt.onclick = function () { setColumns(b, n); poke(); paintBlocks(c); }; el.appendChild(bt); }); return el; }
      if (b.type === 'table') { el.appendChild(document.createTextNode('rows ')); el.appendChild(stepper(b, 'rows', c)); el.appendChild(document.createTextNode(' cols ')); el.appendChild(stepper(b, 'cols', c)); return el; }
      if (b.type === 'tabs') { var add = eln('button', 'web-ec-mini', '+ tab'); add.onclick = function () { var l = tabLabels(b).slice(); l.push('Tab ' + (l.length + 1)); b.tabLabels = l.join('\n'); ensureSlots(b); poke(); paintBlocks(c); }; el.appendChild(add); if (tabLabels(b).length > 1) { var rm = eln('button', 'web-ec-mini', '– tab'); rm.onclick = function () { var l = tabLabels(b).slice(); delete (b.slots || {})['tab' + (l.length - 1)]; l.pop(); b.tabLabels = l.join('\n'); poke(); paintBlocks(c); }; el.appendChild(rm); } return el; }
      return null;
    }
    function stepper(b, key, c) {
      var cur = Math.max(1, parseInt(b[key], 10) || 2), wrap = eln('span', 'web-ec-step');
      var dn = eln('button', 'web-ec-mini', '–'), up = eln('button', 'web-ec-mini', '+'), val = eln('span', 'web-ec-stepv', '' + cur);
      dn.onclick = function () { b[key] = Math.max(1, cur - 1); reconcileTable(b); poke(); paintBlocks(c); };
      up.onclick = function () { b[key] = Math.min(8, cur + 1); reconcileTable(b); poke(); paintBlocks(c); };
      wrap.appendChild(dn); wrap.appendChild(val); wrap.appendChild(up); return wrap;
    }
    function setColumns(b, n) { b.cols = n; b.slots = b.slots || {}; Object.keys(b.slots).forEach(function (k) { if (/^c\d+$/.test(k) && +k.slice(1) >= n) { var dst = b.slots['c' + (n - 1)] = b.slots['c' + (n - 1)] || []; dst.push.apply(dst, b.slots[k]); delete b.slots[k]; } }); ensureSlots(b); }
    function reconcileTable(b) { b.slots = b.slots || {}; var keep = {}; slotDefs(b).forEach(function (s) { keep[s.key] = true; }); Object.keys(b.slots).forEach(function (k) { if (/^r\d+c\d+$/.test(k) && !keep[k]) { var arr = b.slots[k]; if (arr && arr.length) b.slots.r0c0 = (b.slots.r0c0 || []).concat(arr); delete b.slots[k]; } }); ensureSlots(b); }
    function mountFields(scope, b, c) { var def = blockRegistry[b.type] || { fields: [] }; scope.innerHTML = def.fields.map(function (f) { return fieldRow(b, f); }).join(''); def.fields.forEach(function (f) { wireField(scope, b, f, c); }); }
    function paintBlocks(c) { var box = c.querySelector('#web-blocks'); if (!box) return; box.innerHTML = ''; _page.blocks = _page.blocks || []; box.appendChild(buildZone(_page.blocks, 'root', c)); preview(); }
    // GM authors the hosting plans: name/price/reach/anon + the allowed-block list
    // (a checklist, prefillable from a preset).
    function mountPlansEditor(container, b, c) {
      b.plans = b.plans || [];
      function paint() {
        container.innerHTML = '';
        b.plans.forEach(function (pl, i) {
          pl.blocks = pl.blocks || [];
          var card = eln('div', 'web-plan-ed');
          card.innerHTML = '<div class="web-plan-ed-row"><input class="rt-input web-plan-name" placeholder="plan name" value="' + esc(pl.name || '') + '"><input class="rt-input web-plan-price" type="number" placeholder="eb/mo" value="' + (pl.price != null ? esc(pl.price) : '') + '"><select class="web-plan-reach">' + BROADCAST.map(function (r) { return '<option' + (r === (pl.reach || 'citywide') ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select><label class="lk-prop"><input type="checkbox" class="web-plan-anon"' + (pl.anon ? ' checked' : '') + '> anon</label><button class="rt-link web-plan-del">✕</button></div>' +
            '<div class="web-plan-ed-blocks"><span class="web-plan-blabel">' + pl.blocks.length + ' blocks</span> <select class="web-plan-preset"><option value="">apply preset…</option>' + BLOCK_PRESETS.map(function (p, pi) { return '<option value="' + pi + '">' + esc(p.name) + '</option>'; }).join('') + '</select> <button type="button" class="web-mini web-plan-pick">choose blocks…</button></div>';
          card.querySelector('.web-plan-name').oninput = function (e) { pl.name = e.target.value; poke(); };
          card.querySelector('.web-plan-price').oninput = function (e) { pl.price = parseInt(e.target.value, 10) || 0; poke(); };
          card.querySelector('.web-plan-reach').onchange = function (e) { pl.reach = e.target.value; poke(); };
          card.querySelector('.web-plan-anon').onchange = function (e) { pl.anon = e.target.checked; poke(); };
          card.querySelector('.web-plan-del').onclick = function () { b.plans.splice(i, 1); poke(); paint(); };
          card.querySelector('.web-plan-preset').onchange = function (e) { if (e.target.value === '') return; pl.blocks = presetKeys(BLOCK_PRESETS[+e.target.value]); poke(); paint(); };
          card.querySelector('.web-plan-pick').onclick = function () { pickPlanBlocks(pl, function () { poke(); paint(); }); };
          container.appendChild(card);
        });
        var add = eln('button', 'web-mini', '+ add plan'); add.onclick = function () { b.plans.push({ id: uid('pl'), name: 'Plan ' + (b.plans.length + 1), price: 0, reach: 'citywide', anon: false, blocks: presetKeys(BLOCK_PRESETS[0]) }); poke(); paint(); }; container.appendChild(add);
      }
      paint();
    }
    function pickPlanBlocks(pl, done) {
      if (!window.UI) return;
      var sel = {}; (pl.blocks || []).forEach(function (k) { sel[k] = true; });
      var body = BLOCK_GROUPS.map(function (g) { var ks = g.keys.filter(function (k) { return blockRegistry[k] && GM_ONLY_BLOCKS.indexOf(k) < 0; }); if (!ks.length) return ''; return '<div class="web-pp-sec">' + esc(g.label) + '</div>' + ks.map(function (k) { return '<label class="web-msgr-pick"><input type="checkbox" data-k="' + k + '"' + (sel[k] ? ' checked' : '') + '> ' + esc(blockRegistry[k].label) + '</label>'; }).join(''); }).join('');
      UI.modal({ title: 'Blocks allowed in “' + (pl.name || 'plan') + '”', size: 'wide', body: '<div class="lk-picker-res">' + body + '</div>', actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: function (box) { var out = []; box.querySelectorAll('[data-k]:checked').forEach(function (c2) { out.push(c2.getAttribute('data-k')); }); pl.blocks = out; if (done) done(); } }] });
    }
    function fieldRow(b, f) {
      var id = 'bf-' + b.id + '-' + f.k, v = b[f.k], input;
      if (f.t === 'textarea' || f.t === 'lines') input = '<textarea id="' + id + '" rows="2">' + esc(v || '') + '</textarea>';
      else if (f.t === 'select') input = '<select id="' + id + '">' + (f.opts || []).map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      else if (f.t === 'number') input = '<input id="' + id + '" type="number" value="' + (v != null ? esc(v) : '') + '">';
      else if (f.t === 'bool') input = '<label class="lk-prop"><input id="' + id + '" type="checkbox"' + (v ? ' checked' : '') + '></label>';
      else if (f.t === 'file') input = (v ? '<span class="web-metaval">✓ file</span> ' : '') + '<label class="dt-btn">upload<input id="' + id + '" type="file" accept="' + esc(f.accept || '*/*') + '" hidden></label>';
      else if (f.t === 'image') input = (v ? '<img class="web-b-thumb" src="' + esc(v) + '"> ' : '') + '<label class="dt-btn">upload<input id="' + id + '" type="file" accept="image/*" hidden></label>';
      else if (f.t === 'color') input = '<input id="' + id + '" type="color" value="' + esc(v || '#888888') + '">' + (v ? ' <button type="button" class="rt-link" data-clr="' + id + '">clear</button>' : '');
      else if (f.t === 'plans') input = '<div id="' + id + '" class="web-plans-ed"></div>';
      else input = '<input id="' + id + '" value="' + esc(v || '') + '">';
      var mb = (f.t === 'textarea' || f.t === 'lines' || f.t === 'text' || !f.t) ? '<button type="button" class="web-mention-b" data-mention="' + id + '" title="insert data link">@</button>' : '';
      return '<label class="web-b-f"><span>' + esc(f.label || f.k) + '</span>' + input + mb + '</label>';
    }
    function wireField(scope, b, f, c) {
      var base = 'bf-' + b.id + '-' + f.k, elx = scope.querySelector('[id="' + base + '"]'); if (!elx) return;
      if (f.t === 'plans') { mountPlansEditor(elx, b, c); return; }
      var mbtn = scope.querySelector('[data-mention="' + base + '"]'); if (mbtn) mbtn.onclick = function () { pickMention(function (tok) { if (!tok) return; insertAtCursor(elx, tok); b[f.k] = elx.value; poke(); preview(); }); };
      if (f.t === 'image' || f.t === 'file') { elx.onchange = function () { var fl = elx.files[0]; if (!fl) return; var rd = new FileReader(); rd.onload = function () { b[f.k] = rd.result; poke(); preview(); mountFields(scope, b, c); }; rd.readAsDataURL(fl); }; return; }
      if (f.t === 'bool') { elx.onchange = function () { b[f.k] = elx.checked; poke(); preview(); }; return; }
      if (f.t === 'select') { elx.onchange = function () { b[f.k] = elx.value; poke(); preview(); }; return; }
      if (f.t === 'color') { elx.oninput = function () { b[f.k] = elx.value; poke(); preview(); }; var clr = scope.querySelector('[data-clr="' + base + '"]'); if (clr) clr.onclick = function () { b[f.k] = ''; poke(); mountFields(scope, b, c); preview(); }; return; }
      elx.oninput = function () { b[f.k] = (f.t === 'number') ? (parseInt(elx.value, 10) || 0) : elx.value; poke(); preview(); };
    }
  }

  /* pickers */
  // A player only KNOWS the records on their data screen (Files/intel) + the sites
  // they've discovered — so the @ picker is scoped to those, never the whole campaign.
  function playerKnownSet() { var set = {}; (webGet().intel || []).forEach(function (f) { if (f && f.type && f.id) set[f.type + ':' + f.id] = 1; }); return set; }
  function playerKnowsSite(json) { if (!json) return false; return !!json.known && Store.visibleToPlayers(json) && connectable(json, effectiveReach(playerJson())); }
  function pickFromTypes(types, title, done) {
    if (!window.UI) return;
    UI.modal({ title: title, body: '<input class="rt-input" id="wp-q" placeholder="search…" autocomplete="off"><div id="wp-res" class="lk-picker-res"></div>', actions: [{ label: 'Cancel' }, { label: 'Unlink', onClick: function () { done(null); } }],
      onShow: function (box) { var all = []; var known = isPlayer() ? playerKnownSet() : null;
        Promise.all(types.map(function (ty) { return Store.index(ty).then(function (rows) { rows.forEach(function (r) {
          if (!r.json.id) return;
          if (known) { if (ty === 'site') { if (!playerKnowsSite(r.json)) return; } else if (!known[ty + ':' + r.json.id]) return; }
          all.push({ ref: r.ref, name: Store.displayName(r), t: ty });
        }); }).catch(function () {}); })).then(function () { paint(''); });
        function paint(f) { f = (f || '').toLowerCase(); var hits = all.filter(function (e) { return !f || (e.name || '').toLowerCase().indexOf(f) >= 0; }).slice(0, 40); var empty = known ? '<div class="app-empty">Only records on your data screen (Files) and sites you know can be linked.</div>' : '<div class="app-empty">nothing</div>'; box.querySelector('#wp-res').innerHTML = hits.map(function (e, i) { return '<button class="lk-picker-row" data-i="' + i + '">' + esc(e.name) + ' <small>' + esc(e.t) + '</small></button>'; }).join('') || empty; box.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { var e = hits[+b.getAttribute('data-i')]; UI.close(); done(e.ref); }; }); }
        box.querySelector('#wp-q').oninput = function (e) { paint(e.target.value); }; box.querySelector('#wp-q').focus(); } });
  }
  function pickSubject(done) { pickFromTypes(['location', 'org', 'shop', 'npc'], 'Link a record', done); }
  function orgHasMember(orgJson, sid) { var h = (orgJson && orgJson.hierarchy) || {}; return ((h.persons || []).some(function (p) { return p && (p.sheetId === sid || p.id === sid); })); }
  // Players may only link a shop they own or an org they belong to — unless the GM
  // turned on "Allow impersonation".
  function invCost(it) { var v = it && (it.cost != null ? it.cost : it.bookcost != null ? it.bookcost : it.bookPrice != null ? it.bookPrice : 0); return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; }
  function playerInventory() {
    var j = playerJson(); if (!j) return { j: null, items: [] }; var out = [];
    [['gear', j.gear], ['weapons', j.weapons], ['cyberware', j.cyberware], ['vehicles', j.vehicles]].forEach(function (pair) {
      (pair[1] || []).forEach(function (it, i) { if (it && it.name) out.push({ arr: pair[0], idx: i, name: it.name, cost: invCost(it), listed: !!it._forSale, data: it }); });
    });
    return { j: j, items: out };
  }
  // Player store editor — same shape as the GM's, but the "catalog" is only what
  // the player actually owns (no infinite resources). Creates a Store('shop').
  function openPlayerStore(done) {
    if (!isPlayer() || !window.UI) return;
    var inv = playerInventory(); if (!inv.j) { alert('Your sheet isn’t loaded.'); return; }
    var shop = { id: uid('shop'), name: 'My store', kind: 'player', owner: playerSid(), public: true, location: '', address: '', items: [] };
    UI.modal({ title: 'Open a store — from your inventory', size: 'wide',
      body: '<label class="rt-field"><span class="rt-field-l">Store name</span><input class="rt-input" id="ps-name" value="My store"></label>' +
        '<div class="ps-cols"><div class="ps-pane"><div class="ps-h">Your inventory</div><div id="ps-inv"></div></div><div class="ps-pane"><div class="ps-h">On sale</div><div id="ps-shelf"></div></div></div>',
      actions: [{ label: 'Cancel' }, { label: 'Open store', kind: 'primary', onClick: function (box) { shop.name = (box.querySelector('#ps-name').value || 'store').trim(); if (!shop.items.length) { alert('Add at least one item to sell.'); return false; } savePlayerStore(inv.j, shop, done); } }],
      onShow: function (box) {
        function inShop(it) { return shop.items.some(function (s) { return s._invKey === it.arr + ':' + it.idx; }); }
        function paintInv() { box.querySelector('#ps-inv').innerHTML = inv.items.length ? inv.items.map(function (it, i) { var u = inShop(it); return '<div class="ps-row' + (u ? ' ps-used' : '') + '"><span class="ps-n">' + esc(it.name) + '</span><span class="ps-c">' + it.cost + 'eb</span><button class="web-mini" data-add="' + i + '"' + (u ? ' disabled' : '') + '>' + (u ? 'listed' : 'add') + '</button></div>'; }).join('') : '<div class="app-empty">No sellable items in your inventory.</div>'; box.querySelectorAll('[data-add]').forEach(function (b) { b.onclick = function () { var it = inv.items[+b.getAttribute('data-add')]; shop.items.push({ id: uid('si'), cat: it.arr, name: it.name, price: it.cost, qty: 1, data: it.data, _invKey: it.arr + ':' + it.idx }); paintInv(); paintShelf(); }; }); }
        function paintShelf() { var el = box.querySelector('#ps-shelf'); el.innerHTML = shop.items.length ? shop.items.map(function (s) { return '<div class="ps-row"><span class="ps-n">' + esc(s.name) + '</span><input class="rt-input ps-price" data-price="' + s.id + '" type="number" value="' + s.price + '"><button class="web-mini" data-rm="' + s.id + '">✕</button></div>'; }).join('') : '<div class="app-empty">Add items from your inventory →</div>'; el.querySelectorAll('[data-price]').forEach(function (i) { i.onchange = function () { var s = shop.items.filter(function (x) { return x.id === i.getAttribute('data-price'); })[0]; if (s) s.price = parseInt(i.value, 10) || 0; }; }); el.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { shop.items = shop.items.filter(function (x) { return x.id !== b.getAttribute('data-rm'); }); paintInv(); paintShelf(); }; }); }
        paintInv(); paintShelf();
      } });
  }
  function savePlayerStore(j, shop, done) {
    shop.items.forEach(function (s) { if (s._invKey) { var p = s._invKey.split(':'); var it = j[p[0]] && j[p[0]][+p[1]]; if (it) it._forSale = shop.id; } });
    Store.create('shop', shop).then(function (made) { publishPlayer(j); if (br().logSession) br().logSession('🏪 Opened store "' + shop.name + '" (' + shop.items.length + ' items).'); if (done) done(made.ref || { type: 'shop', id: made.json.id }); }).catch(function (e) { alert('Could not open the store: ' + ((e && e.message) || e)); });
  }
  // On a sale: drop the item from the shop's stock and out of the seller's inventory.
  function sellerRemoveStock(siteJson, shopJson, shopItem) {
    if (!shopJson || !shopJson.id) return;
    Store.resolve({ type: 'shop', id: shopJson.id }).then(function (hit) {
      if (!hit) return; var sh = hit.json; var it = (sh.items || []).filter(function (x) { return x.id === shopItem.id || x.name === shopItem.name; })[0]; if (!it) return;
      if (it.qty == null) { /* unlimited stock — leave as is */ } else if (it.qty > 1) { it.qty -= 1; } else { sh.items = sh.items.filter(function (x) { return x !== it; }); }
      Store.put({ type: 'shop', id: sh.id }, sh).catch(function () {});
      // Pull one unit from the seller's inventory: prefer the entry flagged for this shop, else match by name; decrement stackable gear rather than always removing.
      var c = camp(); var rec = siteJson.owner && c && c.getSheet && c.getSheet(siteJson.owner);
      if (rec && rec.json) {
        var j = rec.json, done = false;
        ['gear', 'weapons', 'cyberware', 'vehicles'].forEach(function (k) {
          if (done) return; var arr = j[k]; if (!arr) return;
          var found = arr.filter(function (x) { return x && x._forSale === sh.id && x.name === shopItem.name; })[0] || arr.filter(function (x) { return x && x.name === shopItem.name; })[0];
          if (found) { if (found.qty > 1) found.qty -= 1; else arr.splice(arr.indexOf(found), 1); done = true; }
        });
        c.publishSheet(siteJson.owner, j.handle || j.name || 'PC', j);
      }
    }).catch(function () {});
  }
  function pickSubjectRestricted(done) {
    if (App.uiGet('web.allowImpersonation', false)) return pickSubject(done);
    if (!window.UI) return; var sid = playerSid();
    Promise.all([Store.index('shop').catch(function () { return []; }), Store.index('org').catch(function () { return []; })]).then(function (res) {
      var all = (res[0] || []).filter(function (r) { return r.json.owner === sid; }).map(function (r) { return { ref: r.ref, name: Store.displayName(r), t: 'shop' }; })
        .concat((res[1] || []).filter(function (r) { return orgHasMember(r.json, sid); }).map(function (r) { return { ref: r.ref, name: Store.displayName(r), t: 'org' }; }));
      UI.modal({ title: 'Link your shop / org', body: all.length ? '<div class="lk-picker-res">' + all.map(function (e, i) { return '<button class="lk-picker-row" data-i="' + i + '">' + esc(e.name) + ' <small>' + e.t + '</small></button>'; }).join('') + '</div>' : '<div class="app-empty">You don’t own a shop or belong to an org yet.</div>', actions: [{ label: 'Cancel' }, { label: '＋ Create a storefront', onClick: function () { if (br().openMyStore) { UI.close(); br().openMyStore(); } else { openPlayerStore(function (ref) { done(ref); }); } return false; } }, { label: 'Unlink', onClick: function () { done(null); } }], onShow: function (box) { box.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { UI.close(); done(all[+b.getAttribute('data-i')].ref); }; }); } });
    }).catch(function () {});
  }
  function pickHost(done) { if (!window.UI) return; Store.index('site').then(function (rows) { var hosts = rows.filter(function (r) { return r.json.kind === 'host'; }); UI.modal({ title: 'Pick a host', body: hosts.length ? '<div class="lk-picker-res">' + hosts.map(function (r, i) { return '<button class="lk-picker-row" data-i="' + i + '">' + esc(r.json.name) + ' <small>' + esc((r.json.hostConfig && r.json.hostConfig.reachGranted) || '') + '</small></button>'; }).join('') + '</div>' : '<div class="app-empty">No host sites yet — make a site with kind “host”.</div>', actions: [{ label: 'Cancel' }, { label: 'Unlink', onClick: function () { done(null); } }], onShow: function (box) { box.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { UI.close(); done(hosts[+b.getAttribute('data-i')].ref); }; }); } }); }); }
  function clampBroadcast(doc) { if (!doc.hostId) return; Store.resolve({ type: 'site', id: doc.hostId }).then(function (hit) { if (!hit || !hit.json.hostConfig) return; var maxOrd = broadcastOrd(hit.json.hostConfig.reachGranted || 'global'); if (broadcastOrd(doc.broadcast) > maxOrd) { doc.broadcast = BROADCAST[maxOrd]; doc.record.broadcast = doc.broadcast; } }).catch(function () {}); }

  /* ═══════════════ HOSTS registry ═══════════════ */
  function renderHosts(t, host) {
    host.className = 'tab-content web-registry'; host.innerHTML = '<div class="dt-head" style="padding:16px 18px 8px">HOST REGISTRY</div><div id="web-hostlist" style="padding:0 18px 18px"></div>';
    Store.index('site').then(function (rows) { var hosts = rows.filter(function (r) { return r.json.kind === 'host'; }); if (isPlayer()) hosts = hosts.filter(function (r) { return Store.visibleToPlayers(r.json); }); var list = host.querySelector('#web-hostlist');
      list.innerHTML = hosts.length ? '<table class="web-table"><tr><th>Host</th><th>Price</th><th>Legality</th><th>Netwatch</th><th>Reliability</th><th>Reach</th></tr>' + hosts.map(function (r) { var c = r.json.hostConfig || {}; return '<tr data-site="' + esc(r.json.id) + '"><td>' + esc(r.json.name) + '</td><td>' + (c.price || 0) + 'eb</td><td>' + (c.legality || 0) + '</td><td>' + (c.netwatchCoop || 0) + '</td><td>' + (c.reliability || 0) + '</td><td>' + esc(c.reachGranted || '') + '</td></tr>'; }).join('') + '</table>' : '<div class="app-empty">No hosts yet. Create a site with kind “host”.</div>';
      list.querySelectorAll('[data-site]').forEach(function (row) { row.onclick = function () { if (!isPlayer()) Shell.openEntity('site', row.getAttribute('data-site'), null); }; }); });
  }

  /* ═══════════════ player context + economy ═══════════════ */
  function playerJson() { var s = br().sess; if (!s || !s.sheetId || !s.camp) return null; var sid = (br().idOf ? br().idOf(s.sheetId) : s.sheetId); var rec = s.camp.getSheet && s.camp.getSheet(sid); return rec && rec.json; }
  function playerSid() { var s = br().sess; return s && (br().idOf ? br().idOf(s.sheetId) : s.sheetId); }
  function publishPlayer(json) { var s = br().sess; if (s && s.camp && s.camp.publishSheet) s.camp.publishSheet(playerSid(), json.handle || json.name || 'PC', json); }
  function ensureNet(json) { if (!json.net) json.net = { computer: null, deliveries: [], bookmarks: [], pinned: [], groups: [], history: [] }; return json.net; }
  function homeDistricts(json) { return ((json.lifestyle && json.lifestyle.housing) || []).filter(function (h) { return h.district; }).map(function (h) { return { name: h.name || 'home', district: h.district }; }); }
  function onlineBuy(siteJson, shopItem, shopJson, btn) {
    var s = br().sess; if (!s || s.role !== 'player' || !s.sheetId) { alert('Only a player with a linked sheet can buy.'); return; }
    var json = playerJson(); if (!json) { alert('Your sheet isn’t loaded.'); return; }
    var homes = homeDistricts(json); if (!homes.length) { alert('Set a delivery district on one of your homes (Lifestyle → Housing) first.'); return; }
    var accs = ((json.lifestyle && json.lifestyle.accounts) || []).filter(function (a) { return !a.closed; }); if (!accs.length) { alert('You need a bank account to buy online.'); return; }
    var price = parseInt(shopItem.price, 10) || 0; if (deviceHasPerk(json, 'haggle')) price = Math.round(price * 0.85); if (!window.UI) return;
    UI.modal({ title: 'Buy — ' + (shopItem.name || 'item'),
      body: '<p>' + esc(shopItem.name || '') + ' — <b>' + price + 'eb</b></p>' +
        '<label class="rt-field"><span class="rt-field-l">Pay from</span><select class="rt-select" id="ob-acc">' + accs.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + ' (' + (parseFloat(a.balance) || 0).toLocaleString() + 'eb)</option>'; }).join('') + '</select></label>' +
        '<label class="rt-field"><span class="rt-field-l">Deliver to</span><select class="rt-select" id="ob-home">' + homes.map(function (h, i) { return '<option value="' + i + '">' + esc(h.name) + ' — ' + esc(h.district) + '</option>'; }).join('') + '</select></label>',
      actions: [{ label: 'Cancel' }, { label: 'Confirm', kind: 'primary', onClick: function (box) {
        var acc = accs.filter(function (a) { return a.id === box.querySelector('#ob-acc').value; })[0]; if (!acc) return;
        var home = homes[+box.querySelector('#ob-home').value] || homes[0];
        if ((parseFloat(acc.balance) || 0) - price < -50000) { alert('Refused: exceeds overdraft.'); return; }
        acc.balance = (parseFloat(acc.balance) || 0) - price; acc.ledger = acc.ledger || []; acc.ledger.unshift({ id: 'net-' + Date.now().toString(36), type: 'expense', label: 'Net order: ' + (shopItem.name || 'item'), amount: price });
        var dt = (parseInt(shopJson && shopJson.deliveryTime, 10) || 12); if (deviceHasPerk(json, 'courier')) dt = Math.max(1, Math.round(dt / 2)); var eta = netClock() + dt; var net = ensureNet(json); net.deliveries = net.deliveries || [];
        net.deliveries.push({ id: uid('dlv'), name: shopItem.name, cat: shopItem.cat, data: shopItem.data, price: price, fromShopId: shopJson && shopJson.id, address: home.district, placedAt: netClock(), eta: eta, status: 'in_transit' });
        publishPlayer(json); if (siteJson && siteJson.owner) { creditOwner(siteJson.owner, price, 'Sale: ' + (shopItem.name || 'item'), siteJson.payAccount); sellerRemoveStock(siteJson, shopJson, shopItem); } if (br().logSession) br().logSession('🛒 Ordered "' + (shopItem.name || 'item') + '" — ' + price + 'eb → ' + home.district + ' (ETA ' + eta + 'h)'); if (btn) { btn.textContent = 'ordered'; btn.disabled = true; }
      } }] });
  }
  function isComputerData(data) { return !!(data && data.connection && data.reach != null && data.power != null && data.stealth != null); }
  function settleDeliveries() { var json = playerJson(); if (!json || !json.net || !json.net.deliveries) return; var now = netClock(), changed = false; json.net.deliveries.forEach(function (d) { if (d.status === 'in_transit' && d.eta <= now) { d.status = 'delivered'; if (isComputerData(d.data)) { var net = json.net; net.owned = net.owned || []; var dev = JSON.parse(JSON.stringify(d.data)); dev.id = uid('dev'); delete dev.category; net.owned.push(dev); if (!net.computer) { net.computer = dev; net.activeDeviceId = dev.id; } } else if (br().shopWriteItem) br().shopWriteItem(json, { cat: d.cat, name: d.name, data: d.data }); changed = true; } }); if (changed) { publishPlayer(json); if (br().logSession) br().logSession('📦 A delivery arrived.'); } }
  function refreshStage() { try { if (_tabs && document.getElementById('web-stage')) paintStage(); } catch (e) {} }
  // Credit another player's (the site owner's) first bank account — sales, tips.
  function pickAccount(accs, id) { return (accs || []).filter(function (a) { return a.id === id; })[0] || (accs || [])[0]; }
  function creditOwner(ownerSid, amt, label, accountId) { var c = camp(); if (!c || !c.getSheet || !c.publishSheet || !ownerSid) return; var rec = c.getSheet(ownerSid); if (!rec || !rec.json) return; var j = rec.json; var accs = (j.lifestyle && j.lifestyle.accounts) || []; if (!accs.length) return; var acc = pickAccount(accs, accountId); if (!acc) return; acc.balance = (parseFloat(acc.balance) || 0) + amt; acc.ledger = acc.ledger || []; acc.ledger.unshift({ id: 'in-' + Date.now().toString(36), type: 'income', label: label, amount: amt }); c.publishSheet(ownerSid, j.handle || j.name || 'PC', j); }
  // Ad revenue = a monthly regular input on the owner's account, tagged with the site.
  function toggleSiteOnline(s) { s.state = s.state || {}; s.state.online = !(s.state.online !== false); Store.put({ type: 'site', id: s.id }, s).then(function () { refreshStage(); }).catch(function () {}); }
  // Player picks a hosting plan → publishes a real site owned by them, billed monthly.
  function playerAccounts() { var j = playerJson(); return ((j && j.lifestyle && j.lifestyle.accounts) || []).filter(function (a) { return !a.closed; }); }
  function hostingGetPlan(hostSite, plan) {
    if (!isPlayer()) { alert('This is where players buy hosting.'); return; }
    var accs = playerAccounts();
    var accSel = accs.length ? '<label class="rt-field"><span class="rt-field-l">Billing / payout account</span><select class="rt-input" id="hg-acc">' + accs.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') + '</select></label>' : '<p class="capp-modal-fine">Open a bank account to bill hosting and collect ad / sales revenue.</p>';
    amodal({ title: 'Publish a site', body: '<label class="rt-field"><span class="rt-field-l">Site name</span><input class="rt-input" id="hg-name" placeholder="e.g. my-drop"></label>' + accSel + '<p class="capp-modal-fine">' + esc(hostSite.name || 'host') + ' · ' + esc(plan.name || 'plan') + ' · ' + (parseInt(plan.price, 10) || 0) + 'eb/mo</p>', actions: [{ label: 'Cancel' }, { label: 'Publish', kind: 'primary', onClick: function (box) { var name = (box.querySelector('#hg-name').value || '').trim(); if (!name) return false; var ae = box.querySelector('#hg-acc'); hostingPublish(hostSite, plan, name, ae ? ae.value : null); } }], onShow: function (box) { box.querySelector('#hg-name').focus(); } });
  }
  function hostingPublish(hostSite, plan, name, payAccount) {
    var site = blankSite(name);
    site.owner = playerSid(); site.hostId = hostSite.id; site.plan = plan.name || 'plan'; site.payAccount = payAccount || null;
    site.allowedBlocks = (plan.blocks && plan.blocks.length) ? plan.blocks.slice() : allBlockKeys();
    site.broadcast = plan.reach || 'citywide'; site.record.broadcast = site.broadcast; site.record.hostId = hostSite.id;
    site.props = { public: true }; site.anon = !!plan.anon;
    site.grid = { x: (hostSite.grid && hostSite.grid.x != null) ? hostSite.grid.x : CENTER.x, y: (hostSite.grid && hostSite.grid.y != null) ? hostSite.grid.y : CENTER.y };
    Store.create('site', site).then(function (made) {
      sheetSave(function (j) { j.lifestyle = j.lifestyle || {}; j.lifestyle.services = j.lifestyle.services || []; j.lifestyle.services.push({ name: 'Hosting — ' + name + ' (' + (hostSite.name || 'host') + ')', cost: parseInt(plan.price, 10) || 0, site: made.json.id, host: hostSite.id, accountId: payAccount || null }); });
      if (br().logSession) br().logSession('🌐 Published "' + name + '" via ' + (hostSite.name || 'host') + ' — ' + (parseInt(plan.price, 10) || 0) + 'eb/mo');
      if (window.Shell) Shell.openEntity('site', made.json.id, made.json.name);
    }).catch(function (err) { alert('Could not publish: ' + ((err && err.message) || err)); });
  }
  function renderHostingBlock(b, ctx) {
    var e = eln('div', 'web-b web-hosting');
    if (b.title) e.appendChild(eln('div', 'web-section-h', esc(b.title)));
    if (b.blurb) e.appendChild(eln('p', 'web-hosting-blurb', esc(b.blurb)));
    var plans = b.plans || [], grid = eln('div', 'web-hosting-plans');
    plans.forEach(function (pl) {
      var card = eln('div', 'web-hosting-plan');
      card.innerHTML = '<div class="web-hosting-name">' + esc(pl.name || 'Plan') + '</div><div class="web-hosting-price">' + (parseInt(pl.price, 10) || 0) + 'eb/mo</div><div class="web-hosting-meta">reach: ' + esc(pl.reach || 'citywide') + (pl.anon ? ' · anonymous' : '') + ' · ' + ((pl.blocks || []).length) + ' blocks</div>';
      if (isPlayer()) { var g = eln('button', 'web-btn', 'Get this plan'); g.onclick = function () { hostingGetPlan(ctx.siteJson, pl); }; card.appendChild(g); }
      grid.appendChild(card);
    });
    if (!plans.length) grid.appendChild(eln('div', 'web-empty', isPlayer() ? 'No plans offered right now.' : 'No plans yet — add some in the block’s editor.'));
    e.appendChild(grid);
    if (isPlayer()) {
      var mine = eln('div', 'web-hosting-mine'); e.appendChild(mine); var sid = playerSid();
      Store.index('site').then(function (rows) {
        var owned = rows.filter(function (r) { return r.json.owner === sid && r.json.hostId === ctx.siteId; });
        if (!owned.length) return;
        mine.appendChild(eln('div', 'web-section-h', 'Your sites here'));
        owned.forEach(function (r) {
          var s = r.json, row = eln('div', 'web-hosting-site');
          row.appendChild(eln('span', 'web-hosting-sn', esc(s.name) + (s.state && s.state.online === false ? ' (offline)' : '')));
          row.appendChild(eln('span', 'web-hosting-stats', computeTraffic(s, rows) + ' visits/mo' + (adSlots(s) ? ' · ' + computeAdRevenue(s, rows) + 'eb ads' : '')));
          var acts = eln('span', 'web-hosting-acts');
          [['edit', function () { if (window.Shell) Shell.openEntity('site', s.id, s.name); }], ['visit', function () { openAddress(siteUrl(s)); }], [(s.state && s.state.online === false) ? 'bring online' : 'take offline', function () { toggleSiteOnline(s); }]].forEach(function (a) { var bt = eln('button', 'web-mini', a[0]); bt.onclick = a[1]; acts.appendChild(bt); });
          var accs = playerAccounts(); if (accs.length) { var asel = eln('select', 'web-mini'); asel.title = 'billing / payout account'; asel.innerHTML = accs.map(function (a) { return '<option value="' + esc(a.id) + '"' + (s.payAccount === a.id ? ' selected' : '') + '>💳 ' + esc(a.name) + '</option>'; }).join(''); asel.onchange = function () { s.payAccount = asel.value || null; Store.put({ type: 'site', id: s.id }, s).then(function () { refreshStage(); }).catch(function () {}); }; acts.appendChild(asel); }
          row.appendChild(acts); mine.appendChild(row);
        });
      }).catch(function () {});
    }
    return e;
  }
  function tipOwner(siteJson, suggest) {
    if (!isPlayer()) { alert('Only a player can tip.'); return; }
    var json = playerJson(); var accs = ((json && json.lifestyle && json.lifestyle.accounts) || []).filter(function (a) { return !a.closed; }); if (!accs.length) { alert('You need a bank account.'); return; }
    if (!window.UI) return;
    UI.modal({ title: 'Send eb — ' + (siteJson.name || ''), body: '<label class="rt-field"><span class="rt-field-l">Amount</span><input class="rt-input" id="tip-amt" type="number" value="' + (suggest || 10) + '"></label><label class="rt-field"><span class="rt-field-l">From</span><select class="rt-select" id="tip-acc">' + accs.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + ' (' + (parseFloat(a.balance) || 0) + 'eb)</option>'; }).join('') + '</select></label>', actions: [{ label: 'Cancel' }, { label: 'Send', kind: 'primary', onClick: function (box) { var amt = parseInt(box.querySelector('#tip-amt').value, 10) || 0; if (amt <= 0) return; var acc = accs.filter(function (a) { return a.id === box.querySelector('#tip-acc').value; })[0]; if (!acc) return; acc.balance = (parseFloat(acc.balance) || 0) - amt; acc.ledger = acc.ledger || []; acc.ledger.unshift({ id: 'tip-' + Date.now().toString(36), type: 'expense', label: 'Tip: ' + (siteJson.name || 'site'), amount: amt }); publishPlayer(json); creditOwner(siteJson.owner, amt, 'Tip via ' + (siteJson.name || 'site'), siteJson.payAccount); if (br().logSession) br().logSession('💸 Tipped ' + amt + 'eb → ' + (siteJson.name || 'a site')); } }] });
  }

  function setPresenceSite(siteId) { var c = camp(); if (c && c.setPresence) c.setPresence({ netSite: siteId, netHandle: myHandle() }); }
  var _runtime = false;
  function ensureRuntime() { wireChipClicks(); if (_runtime) return; var s = br().sess; if (!s || !s.camp) return; _runtime = true; if (s.role === 'player' && s.camp.onOverview) { s.camp.onOverview(function () { settleDeliveries(); var v = document.getElementById('web-clock-v'); if (v) v.textContent = netClock() + 'h'; maybeOpenPlayerRun(); }); settleDeliveries(); maybeOpenPlayerRun(); } if (s.role === 'gm' && s.camp.onNetChange && s.camp.getNetPosts) { s.camp.onNetChange(function () { flushBoards(); }); } if (s.role === 'gm' && s.camp.onOverview) { s.camp.onOverview(function () { maybeSurfaceGmRun(); }); maybeSurfaceGmRun(); }
    // Site/datafort records are hub FILES with no server→client push. When the GM saves one,
    // announce it over Yjs (overview.sitesRev) so players drop their stale Store cache and
    // re-render — otherwise a GM's tier/fort edit never reaches the player's Cyberspace.
    if (s.role === 'gm' && App && App.on && s.camp.setOverview) { App.on('entity:saved', function (e) { if (e && e.type === 'site') s.camp.setOverview({ sitesRev: Date.now() }); }); }
  }
  var _flushT = null;
  function flushBoards() { clearTimeout(_flushT); _flushT = setTimeout(function () { Store.index('site').then(function (rows) { rows.forEach(function (r) { var changed = false; sitePages(r.json).forEach(function (pg) { var key = r.json.id + ':' + (pg.slug || 'main'); var posts = camp().getNetPosts(key) || []; if (!posts.length) return; if (posts.length !== (pg.board || []).length) { pg.board = posts.slice(); changed = true; } }); if (changed) Store.put(r.ref, r.json).catch(function () {}); }); }).catch(function () {}); }, 800); }
  // The default chat app (players ↔ players ↔ NPCs), seeded once per campaign by the GM.
  var _chatSeeded = false;
  function ensureChatApp() {
    if (_chatSeeded || isPlayer()) return; _chatSeeded = true;
    Store.index('site').then(function (rows) {
      if (rows.some(function (r) { return r.json.builtin === 'chat'; })) return;
      var chans = [['General', ''], ['Jobs', 'jobs'], ['Rumors', 'rumors']];
      var pages = chans.map(function (c, i) { return { id: uid('pg'), name: c[0], slug: c[1], home: i === 0, layout: 'app', board: [], blocks: [
        { id: uid('b'), type: 'navbar' }, { id: uid('b'), type: 'header', title: 'NC Comms', tagline: '#' + c[0].toLowerCase() },
        { id: uid('b'), type: 'presence', label: 'online' }, { id: uid('b'), type: 'board' }, { id: uid('b'), type: 'compose', placeholder: 'Message #' + c[0].toLowerCase() + '…' } ] }; });
      pages.push({ id: uid('pg'), name: 'Direct', slug: 'direct', home: false, layout: 'app', board: [], blocks: [
        { id: uid('b'), type: 'navbar' }, { id: uid('b'), type: 'header', title: 'NC Comms', tagline: '#direct' },
        { id: uid('b'), type: 'messenger', title: 'Direct messages' } ] });
      var site = blankSite('NC Comms'); site.kind = 'bbs'; site.builtin = 'chat'; site.known = true; site.broadcast = 'citywide'; site.props = { public: true }; site.theme = { preset: 'terminal', overrides: {} }; site.pages = pages;
      Store.create('site', site).then(function () { App.emit('entity:saved', { type: 'site' }); if (br().logSession) br().logSession('💬 Seeded the default chat app (NC Comms).'); }).catch(function () {});
    }).catch(function () {});
  }
  // Seed the bespoke chat apps (hand-built UIs, not blocks), once per campaign.
  var _appsSeeded = false;
  function ensureApps() {
    if (_appsSeeded || isPlayer()) return; _appsSeeded = true;
    Store.index('site').then(function (rows) {
      var have = {}; rows.forEach(function (r) { if (r.json.app) have[r.json.app] = true; });
      var defs = [
        { app: 'corpo-msg', name: 'AraNet Messenger', preset: 'corp', appConfig: { channels: ['general', 'announcements', 'ops'] } },
        { app: 'runner-comms', name: 'BLACKICE', preset: 'terminal', appConfig: {} },
        { app: 'consumer', name: 'PONY', preset: 'chrome', appConfig: {} },
        { app: 'elite', name: 'VELVET', preset: 'paper', appConfig: { channels: ['the-lounge', 'deals'] } },
        { app: 'public', name: 'NC PUBLIC ACCESS', preset: 'bbs', appConfig: { channels: ['notices', 'complaints'] } },
        { app: 'press', name: 'NC Sentinel', preset: 'paper', appConfig: { layout: 'broadsheet', tagline: 'The city, uncensored', sections: ['Front', 'Crime', 'Corp'], formats: ['article', 'op-ed'], submit: 'media', angle: 'independent', comments: 'on', showRatings: true, seed: { front: [{ id: 'seedS1', kind: 'story', ts: 0, headline: 'Petrochem outflow poisons the Watson water table', dek: 'A leaked ledger ties the spill to a covered-up Q3 dump', body: 'A cache of internal documents obtained by the Sentinel shows managers signed off on the discharge weeks before the fish kills began washing up along the canal…', handle: 'M. Ellerby', rating: 'developing' }, { id: 'seedS2', kind: 'story', ts: 0, headline: 'Council quietly rezones the Combat Zone', body: 'Records filed after midnight rezone six blocks for "redevelopment", days before an Arasaka-linked shell bought the parcels…', handle: 'staff', rating: 'verified' }], crime: [{ id: 'seedS3', kind: 'story', ts: 0, headline: 'Ripper ring traced to a Watson back-clinic', body: 'Three bodies, one supplier, and a badge that keeps looking away…', handle: 'M. Ellerby', rating: 'developing' }] } } },
        { app: 'press', name: 'PULSE', preset: 'chrome', appConfig: { layout: 'video', tagline: 'Watch the city', sections: ['Trending'], formats: ['video', 'clip'], submit: 'open', angle: 'sensational', comments: 'on', seed: { trending: [{ id: 'seedP1', kind: 'story', ts: 0, headline: 'CHROME GONE WRONG: cyberpsycho rampage caught on cam', body: 'Full clip inside — viewer discretion advised.', handle: '@streetcam', reach: 183412, dur: '8:12' }, { id: 'seedP2', kind: 'story', ts: 0, headline: 'Braindance leak: exec caught slumming in the Afterlife', body: '', handle: '@dirtylaundry', reach: 512847, dur: '3:44' }] } } }
      ];
      defs.forEach(function (d) {
        if (d.app === 'press' ? rows.some(function (r) { return r.json.app === 'press' && r.json.name === d.name; }) : have[d.app]) return;
        var site = blankSite(d.name); site.kind = 'app'; site.app = d.app; site.appConfig = d.appConfig; site.known = true; site.broadcast = 'citywide'; site.props = { public: true }; site.theme = { preset: d.preset, overrides: {} };
        site.pages = [{ id: uid('pg'), name: 'App', slug: '', home: true, layout: 'app', blocks: [] }];
        Store.create('site', site).then(function () { App.emit('entity:saved', { type: 'site' }); }).catch(function () {});
      });
    }).catch(function () {});
  }

  /* ═══════════════════════════════════════════════════════════════════════
     NET INFRASTRUCTURE — v1 : LA BOUCLE DE RUN
     Additive layer over the Surface browser. Table-first: the app never rolls a
     die — the table types a result, the app applies it. No new DOC_TYPE: the
     `datafort` facet lives ON the site entity; run state rides Yjs; the player
     token rides the campaign overview. Contract: docs/net-interface-contract.md.
     Canon: docs/net-canon.md (Axe 1 topology, Axe 2 fort, Axe 3/4 run/trace).
     ═══════════════════════════════════════════════════════════════════════ */

  // Canonical Night City 2020 districts (MAIN §4-⑤). Our OWN 6×3 grid — NOT wired
  // to nightcity.js (that integration is deferred). NEVER 2077 districts.
  var NC_DISTRICTS = [
    { id: 'A1', name: 'Little Italy', col: 0, row: 0 },
    { id: 'A2', name: 'Northside District', col: 1, row: 0 },
    { id: 'A3', name: 'City Center', col: 2, row: 0 },
    { id: 'A4', name: 'Upper Eastside', col: 3, row: 0 },
    { id: 'A5', name: 'Upper Marina', col: 4, row: 0 },
    { id: 'A6', name: 'East Marina', col: 5, row: 0 },
    { id: 'B1', name: 'Westhill Gardens', col: 0, row: 1 },
    { id: 'B2', name: 'Corp. Center', col: 1, row: 1 },
    { id: 'B3', name: 'City Center', col: 2, row: 1 },
    { id: 'B4', name: 'Bank Block', col: 3, row: 1 },
    { id: 'B5', name: 'Old Downtown', col: 4, row: 1 },
    { id: 'B6', name: 'New Harbor Area', col: 5, row: 1 },
    { id: 'C1', name: 'Night City Univ.', col: 0, row: 2 },
    { id: 'C2', name: 'Lake Park', col: 1, row: 2 },
    { id: 'C3', name: 'Eastpark & Japantown', col: 2, row: 2 },
    { id: 'C4', name: 'Little China', col: 3, row: 2 },
    { id: 'C5', name: 'Studio City', col: 4, row: 2 },
    { id: 'C6', name: 'Charter Hill', col: 5, row: 2 },
  ];
  var DISTRICT_COLS = 6, DISTRICT_ROWS = 3, DEFAULT_DISTRICT = 'A3';
  function districtById(id) { for (var i = 0; i < NC_DISTRICTS.length; i++) if (NC_DISTRICTS[i].id === id) return NC_DISTRICTS[i]; return null; }
  function districtName(id) { var d = districtById(id); return d ? d.name : (id || '—'); }
  function districtDist(a, b) { var A = districtById(a), B = districtById(b); if (!A || !B) return 99; return Math.max(Math.abs(A.col - B.col), Math.abs(A.row - B.row)); }
  // Netwatch presence baseline per district (asymmetric, net-life-canon §climat):
  // dense in corp/gov, thin in the zone. 0..3. GM overrides live (overview).
  var DISTRICT_NETWATCH = { A3: 3, B2: 3, B3: 3, B4: 3, C6: 3, A4: 2, A5: 2, C1: 2, C3: 2, A1: 1, A2: 1, B1: 1, C2: 1, C5: 1, A6: 1, B5: 0, B6: 0, C4: 0 };

  var FORT_TIERS = ['grey', '1', '2', '3', 'black'];
  var TIER_LABEL = { grey: 'Grey', '1': 'Level 1', '2': 'Level 2', '3': 'Level 3', black: 'Black' };
  var TIER_GLYPH = { grey: '▢', '1': '◈', '2': '◈', '3': '◆', black: '◆' };
  // 6 file types (net-canon §Axe 2). Grey/Black Ops = the loot (↔ Store entities).
  var FILE_TYPES = ['Inter-Office', 'Database', 'Business Records', 'Financial', 'Grey Ops', 'Black Ops'];

  /* ── The fort model. The FORMULAS live in the shared window.NetModel
        (js/net-model.js — DATA owns them, net-interface-contract §1). NET only
        carries thin editing/normalizing helpers here and NEVER reimplements a
        formula. Difficulty is DERIVED: NetModel.difficulty(df,{securityLevel})
        returns {rating, band, breakdown, int, muCapacity, actions, …}. ── */
  function defSubgrid() { return { w: 12, h: 12, cells: [] }; }                              // the run terrain — NET paints it
  function gatesForCpu(cpu) { var g = []; for (var i = 0; i < cpu; i++) g.push({ id: NetModel._uid('gate'), str: 2, label: '' }); return g; } // 1 gate / CPU (canon)
  function newDatafort(cpu) { var d = NetModel.blankDatafort({ cpu: cpu }); if (!d.subgrid) d.subgrid = defSubgrid(); return d; }
  function ensureDf(site) {
    if (!site.datafort) site.datafort = newDatafort(1);
    var d = site.datafort;
    if (d.cpu == null) d.cpu = 1;
    if (!Array.isArray(d.codeGates) || !d.codeGates.length) d.codeGates = gatesForCpu(d.cpu);
    if (!Array.isArray(d.ice)) d.ice = [];
    if (!Array.isArray(d.files)) d.files = [];
    if (!Array.isArray(d.remotes)) d.remotes = [];
    if (!Array.isArray(d.skills)) d.skills = [];
    if (!d.subgrid) d.subgrid = defSubgrid();
    return d;
  }
  function wallSTR(d) { return Math.min(NetModel.MAX_STR, (d && d.dataWallSTR != null) ? d.dataWallSTR : ((d && d.cpu) || 1)); }
  function gatesSTR(d) { return ((d && d.codeGates) || []).reduce(function (s, g) { return s + (g.str || 2); }, 0); }
  function fortSecurity(site) { return 2; }  // Night City City Grid Security Level (LDL table p.147) — NET supplies it; enrich per-region later
  function fortDiff(site) { return NetModel.difficulty(ensureDf(site), { securityLevel: fortSecurity(site) }); }
  // Every site/app projects a DEEP presence — its datafort (spine: 1 site ⇄ 1 datafort).
  // The facet is authored in the Fort tab; unauthored = a default Grey fort.
  function hasFort(site) { return !!site; }
  // A standalone datafort has no public façade (no design blocks) → shows only in DEEP.
  function hasSurface(site) { return !!(site && !site.deepOnly); }
  function fortTier(site) { return site ? fortDiff(site).band : 'grey'; }   // the derived ICON tier band (NetModel)
  function siteDistrict(site) { return (site && site.district) || DEFAULT_DISTRICT; }

  /* ── Reference DB — the ICE catalogue is DATA's data/net-ice.json (loaded once,
        cached). ICE entries are created via NetModel.makeIceEntry. ── */
  var _iceCat = null;
  function loadIceCat(cb) { if (_iceCat) { cb(_iceCat); return; } fetch('data/net-ice.json').then(function (r) { return r.json(); }).then(function (a) { _iceCat = Array.isArray(a) ? a : []; cb(_iceCat); }).catch(function () { _iceCat = []; cb(_iceCat); }); }
  function iceByName(name) { for (var i = 0; i < (_iceCat || []).length; i++) if (_iceCat[i].name === name) return _iceCat[i]; return (_iceCat || [])[0]; }
  // Runner's loaded software: authored programs on cs.netrunner.programs, else the
  // shared PRESET_LOADOUT (contract §3). NEVER cs.net.
  function runnerPrograms(sheetJson) { var p = sheetJson && sheetJson.netrunner && sheetJson.netrunner.programs; return (Array.isArray(p) && p.length) ? p : NetModel.PRESET_LOADOUT; }
  function deckSpeed(sheetJson) { return NetModel.deckStats(sheetJson && sheetJson.netrunner).speed; }

  /* ── Subgrid helpers (the run terrain). Cells stored sparse; absent = 'empty'.
        Kinds: wall | node | gate | ice | remote | core | empty. ── */
  var SUBGRID_KINDS = ['wall', 'node', 'gate', 'ice', 'remote', 'core', 'file'];
  var KIND_GLYPH = { wall: '█', node: '○', gate: '⌷', ice: '☠', remote: '⊡', core: '▲', file: '☰' };
  function sgCells(sg) { return (sg && sg.cells) || []; }
  function sgAt(sg, x, y) { var cs = sgCells(sg); for (var i = 0; i < cs.length; i++) if (cs[i].x === x && cs[i].y === y) return cs[i]; return null; }
  function sgSet(sg, x, y, kind, ref) { sg.cells = sgCells(sg).filter(function (c) { return !(c.x === x && c.y === y); }); if (kind && kind !== 'empty') sg.cells.push({ x: x, y: y, kind: kind, ref: ref || null }); }
  function sgNodeIndex(sg) { var m = {}, n = 0; sgCells(sg).forEach(function (c) { if (c.kind === 'node' || c.kind === 'core') { m[c.x + ',' + c.y] = (++n); } }); return m; }
  // Number nodes/core first (1..K, row-major), then ICE (K+1..) — like the datafort ref.
  function sgLabelIndex(sg) { var m = {}, n = 0, cells = sgCells(sg).slice().sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); }); cells.forEach(function (c) { if (c.kind === 'node' || c.kind === 'core') m[c.x + ',' + c.y] = ++n; }); cells.forEach(function (c) { if (c.kind === 'ice') m[c.x + ',' + c.y] = ++n; }); return m; }
  // Bold, iconic cell contents (datafort visual language): boxed numbers for nodes,
  // ▲ CPU, ⊗ gate, ☰ file, ⊡ remote, ☠ (text-presentation) + number for ICE.
  function cellInnerHtml(kind, num, opts) {
    opts = opts || {};
    if (kind === 'node') return '<span class="net-cell-box">' + (num || '') + '</span>';
    if (kind === 'core') return '<span class="net-cell-cpu">▲</span>';
    if (kind === 'gate') return '<span class="net-cell-gate">⊗</span>';
    if (kind === 'file') return '<span class="net-cell-file">☰</span>';
    if (kind === 'remote') return '<span class="net-cell-rem">⊡</span>';
    if (kind === 'ice') return '<span class="net-cell-skull">☠︎</span>' + (opts.ident !== false && num ? '<span class="net-cell-num">' + num + '</span>' : '');
    return '';
  }

  /* ── Player token (MEAT position → reach + trace target). v1: a browser-side
        district per sheet, MJ-driven, live via the overview. The nightcity jeton
        wiring is deferred (MAP's part). ── */
  function netTokens() { var c = camp(); var o = (c && c.getOverview && c.getOverview()) || {}; return o.netTokens || {}; }
  function setToken(sheetId, district) { var c = camp(); if (!c || !c.setOverview) return; var o = (c.getOverview && c.getOverview()) || {}; var t = Object.assign({}, o.netTokens || {}); if (district) t[sheetId] = district; else delete t[sheetId]; c.setOverview({ netTokens: t }); }
  function myToken() { var s = br().sess; if (!s || s.role === 'gm') return null; return netTokens()[s.sheetId] || null; }
  // The party's sheets. The canonical id is rec.id (the Yjs map key == the player's
  // session sheetId) — NEVER rec.json.id.
  function playerSheets() { var c = camp(); if (!c || !c.allSheets) return []; return (c.allSheets() || []).filter(function (r) { return r && r.id; }); }
  function sheetLabelOf(rec) { var j = rec && rec.json; return (j && (j.handle || j.name)) || (rec && rec.name) || (rec && rec.id) || 'runner'; }
  function sheetPhotoOf(rec) { if (window.Store && Store.photoOf) { var p = Store.photoOf(rec); if (p) return p; } var j = rec && rec.json; return (j && (j.photo || j.img || j.image || j.portrait)) || ''; }
  // A player token = a filled circle: profile photo, else the first letter of the handle.
  function tokenAvatar(sid) {
    var c = camp(); var rec = c && c.getSheet && c.getSheet(sid); var nm = sheetLabelOf(rec), photo = sheetPhotoOf(rec);
    if (photo) return '<span class="net-tok-av" style="background-image:url(' + esc(photo) + ')"></span>';
    return '<span class="net-tok-av net-tok-av-l">' + esc((nm || '?').slice(0, 1).toUpperCase()) + '</span>';
  }

  // Reach graph (canon §1.5): broadcast covers everyone; else district radius from
  // the token. Graded 3-state redaction: 'full' | 'redacted' (signal in range,
  // unresolved) | 'hidden'. Fog is a GM option (Full / Hybrid=default / Fog).
  function reachRadius(reach) { return (reach || 0) <= 0 ? -1 : (reach - 1); }
  function reachDesc(reach) { reach = reach || 0; return reach <= 0 ? 'broadcast sites only' : reach === 1 ? 'its own district' : reach >= 4 ? 'the whole city' : (reachRadius(reach) + 1) + ' districts out'; }
  function sheetReach(sid) { var c = camp(); var rec = c && c.getSheet && c.getSheet(sid); return effectiveReach(rec && rec.json); }
  // Hovering a token greys the districts that runner can't reach (radius from its token).
  function showTokenReach(wrap, sid) {
    var td = netTokens()[sid]; if (!td) return; var rad = reachRadius(sheetReach(sid));
    wrap.querySelectorAll('.net-dcell-city').forEach(function (c) { c.classList.toggle('net-dcell-unreach', districtDist(td, c.getAttribute('data-drill')) > rad); });
  }
  function clearTokenReach(wrap) { wrap.querySelectorAll('.net-dcell-unreach').forEach(function (c) { c.classList.remove('net-dcell-unreach'); }); }
  // Reach GATES the map: a player may only enter districts within their physical reach
  // radius (from the token). Broadcast sites stay reachable by grid:// address, not by drill.
  function playerCanEnterDistrict(wrap, did) { if (!isPlayer()) return true; var t = myToken(); if (!t) return false; return districtDist(t, did) <= reachRadius(effectiveReach(playerJson())); }
  function atlasFog() { return (App.uiGet('web.atlas', {}) || {}).fog || 'hybrid'; }
  function siteReachState(site, token, reach) {
    if (connectable(site, reach)) return 'full';
    if (!token) return 'hidden';
    var d = districtDist(token, siteDistrict(site)), r = reachRadius(reach);
    if (d <= r) return 'full';
    if (d <= r + 1) return 'redacted';
    return 'hidden';
  }
  // What a given viewer sees of a node in the atlas, folding the fog option in.
  function nodeVisibility(site, deep) {
    if (!isPlayer()) return 'full';                                  // GM: everything
    if (!(Store.visibleToPlayers(site) && isOnline(site))) return 'hidden';
    var fog = atlasFog();
    if (deep && reachOfDeck(playerJson()) <= 0) return 'redacted';   // no deck → DEEP is caviardé
    if (fog === 'full') return 'full';
    if (fog === 'fog') return site.known ? 'full' : 'hidden';        // only what's been surfaced
    return siteReachState(site, myToken(), effectiveReach(playerJson())); // hybrid
  }

  /* ── CAST adapter — reveal-to-table, DEPTH/TRACE gauges, per-viewer reveal
        flags, dispatch suggestion. v1 keeps the gauges INSIDE the run state (Yjs);
        swap the internals for CAST clocks/castReveal once those land. ── */
  var NetCast = {
    reveal: function (view) { var b = br(); if (b && b.castReveal && view) b.castReveal(view); },
    log: function (msg) { var b = br(); if (b && b.logSession) b.logSession(msg); },
    // Dispatch (trace full): suggest the owner's force at the token's MEAT district.
    dispatchSuggestion: function (site, token) {
      var d = ensureDf(site), tier = d.tier || 'grey';
      var force = ({ grey: 'a lone sysop / private security', '1': 'corporate security patrol', '2': 'a corp response team', '3': 'a Netwatch strike team', black: 'a Netwatch / corp black-ops kill team' })[tier];
      return { force: force, district: token || '—', tier: tier };
    }
  };

  /* ═══════════════ ① CYBERSPACE — homepage-map + weather surcouche ═══════════════
     The browser's spatial home: a district grid (our own 2020 A1..C6), two lenses
     (SURFACE / DEEP — DEEP is netrunner-only), reach/fog masking, stackable overlays
     (WEATHER/TRAFFIC/SEDIMENT — weather/sediment netrunner-only), a zoom rail, a
     grid:// bar, a jack-in point and a sediment rail. GM sees all; a player is masked by reach. */
  function atlasState() {
    var s = App.uiGet('web.atlas', null);
    if (!s) { s = { lens: 'surface', overlays: { weather: false, traffic: false, sediment: false }, fog: 'hybrid', zoom: 'city', district: '' }; App.uiSet('web.atlas', s); }
    if (!s.overlays) s.overlays = { weather: false, traffic: false, sediment: false };
    return s;
  }
  function saveAtlas(mut) { var s = atlasState(); mut(s); App.uiSet('web.atlas', s); }
  var ZOOM_LEVELS = [['world', 'World'], ['region', 'Region'], ['city', 'City'], ['subgrid', 'Subgrid'], ['fort', 'Fort'], ['micronet', 'microNet']];
  var ZOOM_HELP = {
    world: 'World scale — deferred: v1 is Night City only (the multi-region graph is post-v1).',
    region: 'Region scale — deferred: the Pacifica / region graph is post-v1.',
    city: 'City — the live district grid.',
    subgrid: 'Subgrid — a fort’s run terrain. Click a fort node first, then here.',
    fort: 'Fort — the datafort inspector. Click a fort node first, then here.',
    micronet: 'microNet — object hacking (v2, gated behind the item creator).'
  };
  var ZOOM_SUB = { world: '~1000 mi/cell', region: '"kingdom"', city: '~12 blocks/cell', subgrid: '10 m/cell', fort: 'RUN docks here', micronet: 'in-device · later' };
  var _atlasOvWired = false, _atlasEntWired = false, _atlasFort = null, _dragToken = null;

  function renderAtlas(stage) {
    ensureRuntime(); wireHover();
    stage.className = 'web-stage net-atlas-stage';
    stage.removeAttribute('style');
    var st = atlasState(), gm = !isPlayer();
    // Dualism SURFACE / DEEP (no MEAT). DEEP is the jack-in — netrunner (deck) or GM only.
    var canDeep = gm || reachOfDeck(playerJson()) > 0;
    if (st.lens === 'meat' || (st.lens === 'deep' && !canDeep)) st.lens = 'surface';
    if (!canDeep) { st.overlays.weather = false; st.overlays.sediment = false; }   // non-runners: no weather/sediment
    var showSed = canDeep && st.zoom !== 'fort';   // the FORT layer replaces the sediment rail with fort info
    var lenses = [['surface', 'SURFACE']]; if (canDeep) lenses.push(['deep', 'DEEP']);
    var lensBtns = lenses.map(function (l) {
      return '<button class="net-lens-b' + (st.lens === l[0] ? ' on' : '') + '" data-lens="' + l[0] + '"' + (l[0] === 'deep' ? hv('<b>DEEP</b><br>jack under the surface — the datafort layer') : '') + '>' + l[1] + '</button>';
    }).join('');
    var overlays = canDeep ? [['weather', 'WEATHER', '▧'], ['traffic', 'TRAFFIC', '≋'], ['sediment', 'SEDIMENT', '†']] : [['traffic', 'TRAFFIC', '≋']];
    var ovBtns = overlays.map(function (o) {
      return '<button class="net-ov-b' + (st.overlays[o[0]] ? ' on' : '') + '" data-ov="' + o[0] + '"><span class="net-ov-g">' + o[2] + '</span>' + o[1] + '</button>';
    }).join('');
    var fogSel = gm ? '<label class="net-fog">FOG <select class="net-sel" id="net-fog">' +
      ['full', 'hybrid', 'fog'].map(function (f) { return '<option value="' + f + '"' + (st.fog === f ? ' selected' : '') + '>' + ({ full: 'Full (all)', hybrid: 'Hybrid', fog: 'Fog (known)' })[f] + '</option>'; }).join('') + '</select></label>' : '';
    var jack = jackinHtml(gm);
    stage.innerHTML =
      '<div class="net-atlas">' +
        '<div class="net-atlas-top">' +
          '<span class="net-cs-logo">CYBERSPACE</span>' +
          '<div class="net-lens" role="group">' + lensBtns + '</div>' +
          '<div class="net-overlays">' + ovBtns + '</div>' +
          '<input class="net-addr" id="net-addr" spellcheck="false" placeholder="grid://…">' +
          jack + fogSel +
        '</div>' +
        '<div class="net-atlas-body' + (showSed ? '' : ' net-atlas-body-nosed') + '">' +
          '<div class="net-zoom">' + ZOOM_LEVELS.map(function (z) { var dim = (z[0] === 'world' || z[0] === 'region' || z[0] === 'micronet'); return '<button class="net-zoom-b' + (z[0] === st.zoom ? ' on' : '') + (dim ? ' net-zoom-dim' : '') + '" data-zoom="' + z[0] + '"' + hv(esc(ZOOM_HELP[z[0]])) + '><span class="net-zoom-l">' + z[1] + '</span><span class="net-zoom-s">' + esc(ZOOM_SUB[z[0]]) + '</span></button>'; }).join('') + '</div>' +
          '<div class="net-map-wrap" id="net-map-wrap"></div>' +
          (showSed ? '<div class="net-sediment" id="net-sediment"></div>' : '') +
        '</div>' +
      '</div>';
    // top-bar wiring
    stage.querySelectorAll('[data-lens]').forEach(function (b) { b.onclick = function () { saveAtlas(function (s) { s.lens = b.getAttribute('data-lens'); }); renderAtlas(stage); }; });
    stage.querySelectorAll('[data-ov]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-ov'); saveAtlas(function (s) { s.overlays[k] = !s.overlays[k]; }); renderAtlas(stage); }; });
    stage.querySelectorAll('[data-zoom]').forEach(function (b) { b.onclick = function () { var z = b.getAttribute('data-zoom'); if (z === 'city') { saveAtlas(function (s) { s.zoom = 'city'; }); renderAtlas(stage); return; } if (z === 'subgrid') { if (!atlasState().district) { flashTool('Click a district first.'); return; } saveAtlas(function (s) { s.zoom = 'subgrid'; }); renderAtlas(stage); return; } if (z === 'fort') { if (!_atlasFort) { flashTool('Click a fort node first.'); return; } saveAtlas(function (s) { s.zoom = 'fort'; }); renderAtlas(stage); return; } flashTool(ZOOM_HELP[z] || 'Deferred this pass.'); }; });
    var fog = stage.querySelector('#net-fog'); if (fog) fog.onchange = function () { saveAtlas(function (s) { s.fog = fog.value; }); renderAtlas(stage); };
    var addr = stage.querySelector('#net-addr'); if (addr) addr.onkeydown = function (e) { if (e.key === 'Enter') navTo(e.target.value.trim()); };
    wireJackin(stage);
    paintAtlasMap(stage.querySelector('#net-map-wrap'), st);
    paintSediment(stage.querySelector('#net-sediment'), st);
  }

  function jackinHtml(gm) {
    if (gm) return '<button class="net-jack net-jack-gm" id="net-jack">◎ tokens</button>';
    var t = myToken();
    return '<span class="net-jack" title="Your jack-in point (physical position)">◎ ' + esc(t ? (t + ' · ' + districtName(t)) : 'no position') + '</span>';
  }
  function wireJackin(stage) {
    var b = stage.querySelector('#net-jack'); if (!b || isPlayer()) return;
    b.onclick = function () { openTokenManager(); };
  }
  function openTokenManager() {
    if (!window.UI) return;
    var sheets = playerSheets(), tok = netTokens();
    var rows = sheets.length ? sheets.map(function (r) {
      var id = r.id, cur = tok[id] || '';
      var opts = '<option value="">— off-net —</option>' + NC_DISTRICTS.map(function (d) { return '<option value="' + d.id + '"' + (cur === d.id ? ' selected' : '') + '>' + d.id + ' · ' + esc(d.name) + '</option>'; }).join('');
      return '<div class="net-tok-row"><span class="net-tok-av-wrap">' + tokenAvatar(id) + '</span><span class="net-tok-n">' + esc(sheetLabelOf(r)) + '</span><select class="net-sel" data-tok="' + esc(id) + '">' + opts + '</select></div>';
    }).join('') : '<div class="app-empty">No player sheets in this campaign yet.</div>';
    UI.modal({ title: 'Player positions (jack-in points)', body: '<p class="dt-hint">Where each runner physically sits — this bounds their reach and is the target of a full trace. Drag a token on the map, or set it here.</p>' + rows, actions: [{ label: 'Done', kind: 'primary' }],
      onShow: function (box) { box.querySelectorAll('[data-tok]').forEach(function (s) { s.onchange = function () { setToken(s.getAttribute('data-tok'), s.value); }; }); } });
  }

  var SUBGRID_N = 15;   // a Night City district's subgrid = 15×15 square cells (canon City Grid ▸ Subgrid)
  // A site sits in one subgrid cell. Explicit placement wins; else a stable cell from its id.
  function subcellOf(site) { if (site.subcell && site.subcell.x != null) return { x: site.subcell.x, y: site.subcell.y }; var h = hashStr(site.id || site.name || ''); return { x: h % SUBGRID_N, y: Math.floor(h / SUBGRID_N) % SUBGRID_N }; }
  function districtWeather(id) { var nwOv = (camp() && camp().getOverview && (camp().getOverview() || {}).netWeather) || {}; return (nwOv[id] != null) ? nwOv[id] : (DISTRICT_NETWATCH[id] || 0); }
  function hatchSpan(angle, per) { return '<span class="net-wash" style="background-image:repeating-linear-gradient(' + angle + 'deg,var(--ink,#111) 0,var(--ink,#111) 1px,transparent 1px,transparent ' + per + 'px)"></span>'; }
  function sheetHandle(sid) { var c = camp(); var rec = c && c.getSheet && c.getSheet(sid); var j = rec && rec.json; return (j && (j.handle || j.name)) || sid; }
  function atlasStageOf(wrap) { return wrap && wrap.closest ? wrap.closest('.net-atlas-stage') : null; }
  function reRenderAtlas(wrap) { var stg = atlasStageOf(wrap); if (stg) renderAtlas(stg); else paintAtlasMap(wrap, atlasState()); }
  // Live sync for GM AND players: token moves / weather / sediment repaint the map;
  // a site edit (name, tier, placement…) repaints the cards too.
  var _lastSitesRev = null;
  function wireOverviewRefresh(wrap) {
    var c = camp();
    if (c && c.onOverview && !_atlasOvWired) { _atlasOvWired = true; c.onOverview(function () { var ov = (c.getOverview && c.getOverview()) || {}; if (ov.sitesRev !== _lastSitesRev) { _lastSitesRev = ov.sitesRev; if (window.Store && Store.invalidate) Store.invalidate('site'); } if (atlasState().zoom === 'fort') return; var s2 = document.getElementById('net-map-wrap'); if (s2) paintAtlasMap(s2, atlasState()); }); }
    if (App && App.on && !_atlasEntWired) { _atlasEntWired = true; App.on('entity:saved', function (e) { if (e && e.type && e.type !== 'site') return; if (atlasState().zoom === 'fort') return; var s2 = document.getElementById('net-map-wrap'); if (s2) paintAtlasMap(s2, atlasState()); }); }
  }

  /* ── Hover-card: a small window next to the cursor. Any element with a data-hv
        attribute (HTML content) pops it on hover — districts, sites, fort cells,
        weather. Wired once, globally delegated. ── */
  var _hoverEl = null, _hoverWired = false;
  function hv(html) { return ' data-hv="' + String(html).replace(/"/g, '&quot;') + '"'; }
  function wireHover() {
    if (_hoverWired) return; _hoverWired = true;
    document.addEventListener('mousemove', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-hv]') : null;
      if (!t) { if (_hoverEl) _hoverEl.style.display = 'none'; return; }
      if (!_hoverEl) { _hoverEl = eln('div', 'net-hovercard'); document.body.appendChild(_hoverEl); }
      _hoverEl.innerHTML = t.getAttribute('data-hv'); _hoverEl.style.display = 'block';
      var w = _hoverEl.offsetWidth, h = _hoverEl.offsetHeight, pad = 16;
      var left = e.clientX + pad, top = e.clientY + pad;
      if (left + w > window.innerWidth - 6) left = e.clientX - w - pad;
      if (top + h > window.innerHeight - 6) top = e.clientY - h - pad;
      _hoverEl.style.left = Math.max(4, left) + 'px'; _hoverEl.style.top = Math.max(4, top) + 'px';
    }, true);
  }

  /* ── Pan/zoom viewport: a clipped window over a bigger inner grid. Drag the
        background to pan, wheel to zoom. Pointer-capture → no leaked listeners. ── */
  function mountPanZoom(viewport, inner, opts) {
    opts = opts || {};
    var st = { scale: opts.scale || 1, tx: opts.tx || 0, ty: opts.ty || 0 };
    inner.style.transformOrigin = '0 0';
    function apply() { inner.style.transform = 'translate(' + st.tx + 'px,' + st.ty + 'px) scale(' + st.scale + ')'; }
    var minS = opts.minScale || 0.35, maxS = opts.maxScale || 3.5;
    function zoomAt(cx, cy, f) { var ns = Math.max(minS, Math.min(maxS, st.scale * f)); var k = ns / st.scale; st.tx = cx - (cx - st.tx) * k; st.ty = cy - (cy - st.ty) * k; st.scale = ns; apply(); }
    var panning = false, sx = 0, sy = 0, otx = 0, oty = 0;
    viewport.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; if (e.target.closest && e.target.closest('button,[data-cell],[data-site],[data-fort],.net-token,input,select')) return; panning = true; sx = e.clientX; sy = e.clientY; otx = st.tx; oty = st.ty; viewport.classList.add('net-panning'); try { viewport.setPointerCapture(e.pointerId); } catch (err) {} });
    viewport.addEventListener('pointermove', function (e) { if (!panning) return; st.tx = otx + (e.clientX - sx); st.ty = oty + (e.clientY - sy); apply(); });
    function endPan(e) { if (!panning) return; panning = false; viewport.classList.remove('net-panning'); try { viewport.releasePointerCapture(e.pointerId); } catch (err) {} }
    viewport.addEventListener('pointerup', endPan); viewport.addEventListener('pointercancel', endPan);
    viewport.addEventListener('wheel', function (e) { e.preventDefault(); var r = viewport.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    function center() { var iw = inner.offsetWidth || inner.scrollWidth || 0, ih = inner.offsetHeight || inner.scrollHeight || 0, vr = viewport.getBoundingClientRect(); st.tx = Math.round((vr.width - iw * st.scale) / 2); st.ty = Math.round((vr.height - ih * st.scale) / 2); apply(); }
    apply(); if (opts.center) center();
    return { zoomBy: function (f) { var r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, f); }, center: center, reset: function () { st.scale = opts.scale || 1; if (opts.center) center(); else { st.tx = opts.tx || 0; st.ty = opts.ty || 0; apply(); } }, state: st };
  }

  // Two geographic scales: CITY (the 6×3 districts) and SUBGRID (a district's 15×15,
  // one site per cell). Drill in by clicking a district; back out from the subgrid head.
  function paintAtlasMap(wrap, st) {
    if (!wrap) return;
    if (st.zoom === 'fort' && _atlasFort) paintFort(wrap, st);
    else if (st.zoom === 'subgrid' && st.district) paintSubgrid(wrap, st);
    else paintCity(wrap, st);
  }
  // FORT zoom layer (GM) — the datafort screen inside the cyberspace: the grid in the
  // middle, the fort's info/controls on the right. Reuses the fort builder.
  function paintFort(wrap, st) {
    wrap.className = 'net-map-wrap net-map-wrap-fort';
    Store.resolve({ type: 'site', id: _atlasFort }).then(function (hit) {
      if (!hit) { saveAtlas(function (s) { s.zoom = s.district ? 'subgrid' : 'city'; }); reRenderAtlas(wrap); return; }
      renderFortBuilder(wrap, hit.json, hit.ref, null, function () { saveAtlas(function (s) { s.zoom = s.district ? 'subgrid' : 'city'; }); reRenderAtlas(wrap); });
      wireOverviewRefresh(wrap);
    }).catch(function () {});
  }

  function paintCity(wrap, st) {
    Store.index('site').then(function (rows) {
      var deep = st.lens === 'deep', meat = st.lens === 'meat';
      var countByDist = {}, redByDist = {}, anyVis = false;
      NC_DISTRICTS.forEach(function (d) { countByDist[d.id] = 0; });
      rows.forEach(function (r) { var s = r.json; if (!deep && !hasSurface(s)) return; var vis = nodeVisibility(s, deep); if (vis === 'hidden') return; if (vis === 'redacted') redByDist[siteDistrict(s)] = (redByDist[siteDistrict(s)] || 0) + 1; else { countByDist[siteDistrict(s)] = (countByDist[siteDistrict(s)] || 0) + 1; anyVis = true; } });
      var tok = netTokens(), tokensByDist = {}; Object.keys(tok).forEach(function (sid) { var dd = tok[sid]; (tokensByDist[dd] = tokensByDist[dd] || []).push(sid); });
      var ovW = st.overlays.weather, ovT = st.overlays.traffic, trafByDist = {}, maxTraf = 1;
      if (ovT) { rows.forEach(function (r) { var dd = siteDistrict(r.json); trafByDist[dd] = (trafByDist[dd] || 0) + computeTraffic(r.json, rows); }); Object.keys(trafByDist).forEach(function (k) { if (trafByDist[k] > maxTraf) maxTraf = trafByDist[k]; }); }
      var pToken = myToken(), pReach = isPlayer() ? effectiveReach(playerJson()) : 999, pRad = reachRadius(pReach);
      var cells = NC_DISTRICTS.map(function (d) {
        var n = countByDist[d.id] || 0, red = redByDist[d.id] || 0, nw = districtWeather(d.id), washes = '';
        var oor = isPlayer() && (!pToken || districtDist(pToken, d.id) > pRad);   // reach gates the map, sites or not
        if (oor) washes += hatchSpan(45, 6);                 // redacted — out of reach (dense hatch)
        else { if (ovW && nw > 0) washes += hatchSpan(45, 24 - nw * 5); if (ovT) { var tr = (trafByDist[d.id] || 0) / maxTraf; if (tr > 0.02) washes += hatchSpan(135, Math.max(9, Math.round(26 - tr * 15))); } }
        var toks = (tokensByDist[d.id] || []).map(function (sid) { var rch = sheetReach(sid); return '<span class="net-token" draggable="' + (isPlayer() ? 'false' : 'true') + '" data-token="' + esc(sid) + '"' + hv('<b>' + esc(sheetHandle(sid)) + '</b><br>jacked in at ' + d.id + '<br>reach ' + rch + ' — ' + reachDesc(rch) + (isPlayer() ? '' : '<br>drag to move<br><span class="net-hv-dim">hover: greys what’s out of reach</span>')) + '>' + tokenAvatar(sid) + '<span class="net-tok-nm">' + esc(sheetHandle(sid)) + '</span></span>'; }).join('');
        var weatherPip = ovW ? '<span class="net-dcell-nw">' + (nw ? '●'.repeat(nw) : '○') + '</span>' : '';
        var label = deep ? 'fort' : 'site';
        var count = oor ? '' : (n ? '<span class="net-dcell-count">' + n + ' ' + label + (n > 1 ? 's' : '') + '</span>' : (red ? '<span class="net-dcell-count net-dcell-redc">▨ signal</span>' : '<span class="net-dcell-count net-dcell-0">·</span>'));
        var dhv = '<b>' + d.id + ' · ' + esc(d.name) + '</b><br>' + (oor ? 'out of reach — redacted' : (n ? n + ' ' + label + (n > 1 ? 's' : '') + ' in reach' : 'no ' + label + 's in reach')) + '<br>Netwatch ' + (nw ? '●'.repeat(nw) + ' (' + nw + '/3)' : 'none') + (oor ? '' : '<br>click to enter the subgrid');
        return '<div class="net-dcell net-dcell-city' + (oor ? ' net-dcell-oor' : '') + '" data-drill="' + d.id + '" style="grid-column:' + (d.col + 1) + ';grid-row:' + (d.row + 1) + '"' + hv(dhv) + '>' +
          washes +
          '<span class="net-dcell-hd"><span class="net-dcell-id">' + d.id + '</span>' + weatherPip + '</span>' +
          '<span class="net-dcell-name">' + esc(d.name) + '</span>' + count +
          '<span class="net-dcell-toks">' + toks + '</span>' +
        '</div>';
      }).join('');
      wrap.className = 'net-map-wrap';
      wrap.innerHTML = '<div class="net-map" style="grid-template-columns:repeat(' + DISTRICT_COLS + ',1fr);grid-template-rows:repeat(' + DISTRICT_ROWS + ',1fr)">' + cells + '</div>' +
        (isPlayer() && !anyVis ? '<div class="net-map-note">Nothing in reach. A better rig — or a closer jack-in point — reveals more of the Net.</div>' : '') +
        (deep && isPlayer() && reachOfDeck(playerJson()) <= 0 ? '<div class="net-map-note">DEEP is dark without a deck. Jack in with a cyberdeck to see the infrastructure layer.</div>' : '');
      wrap._distHasSites = {}; NC_DISTRICTS.forEach(function (d) { if ((countByDist[d.id] || 0) > 0 || (redByDist[d.id] || 0) > 0) wrap._distHasSites[d.id] = 1; });
      wrap.querySelectorAll('.net-dcell-city').forEach(function (cell) {
        cell.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.net-token')) return; var did = cell.getAttribute('data-drill'); if (!playerCanEnterDistrict(wrap, did)) { flashTool('Out of reach — a closer jack-in or a better rig gets you there.'); return; } saveAtlas(function (s) { s.district = did; s.zoom = 'subgrid'; }); reRenderAtlas(wrap); });
        if (!isPlayer()) {
          cell.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; cell.classList.add('net-dcell-drop'); });
          cell.addEventListener('dragleave', function () { cell.classList.remove('net-dcell-drop'); });
          cell.addEventListener('drop', function (e) { e.preventDefault(); cell.classList.remove('net-dcell-drop'); var sid = _dragToken || (e.dataTransfer && e.dataTransfer.getData('text/plain')); if (sid) setToken(sid, cell.getAttribute('data-drill')); _dragToken = null; });
        }
      });
      if (!isPlayer()) wrap.querySelectorAll('[data-token]').forEach(function (t) {
        var sid = t.getAttribute('data-token');
        t.addEventListener('mouseenter', function () { showTokenReach(wrap, sid); });   // GM tool: inspect a runner's reach
        t.addEventListener('mouseleave', function () { clearTokenReach(wrap); });
        t.addEventListener('dragstart', function (e) { e.stopPropagation(); clearTokenReach(wrap); _dragToken = sid; if (e.dataTransfer) { e.dataTransfer.setData('text/plain', sid); e.dataTransfer.effectAllowed = 'move'; } });
        t.addEventListener('dragend', function () { _dragToken = null; document.querySelectorAll('.net-dcell-drop').forEach(function (c) { c.classList.remove('net-dcell-drop'); }); });
      });
      wireOverviewRefresh(wrap);
    }).catch(function () { wrap.innerHTML = '<div class="web-empty" style="padding:24px">Could not load the atlas.</div>'; });
  }

  // A district's 15×15 as a real map: a clipped viewport over the full grid, pan
  // (drag) + zoom (wheel / buttons). Shows only a portion at a time.
  function paintSubgrid(wrap, st) {
    Store.index('site').then(function (rows) {
      var deep = st.lens === 'deep', meat = st.lens === 'meat', district = st.district, gm = !isPlayer();
      var placed = {}, count = 0;
      rows.forEach(function (r) { var s = r.json; if (siteDistrict(s) !== district) return; if (!deep && !hasSurface(s)) return; var vis = nodeVisibility(s, deep); if (vis === 'hidden') return; var sc = subcellOf(s); placed[sc.x + ',' + sc.y] = { json: s, vis: vis, fort: deep }; count++; });
      var ovW = st.overlays.weather, ovT = st.overlays.traffic, nw = districtWeather(district), traf = 0;
      if (ovT) rows.forEach(function (r) { if (siteDistrict(r.json) === district) traf += computeTraffic(r.json, rows); });
      var cells = '';
      for (var y = 0; y < SUBGRID_N; y++) for (var x = 0; x < SUBGRID_N; x++) { var node = placed[x + ',' + y]; cells += node ? subgridCell(node, deep) : ('<div class="net-sg-c net-sg-empty" data-empty="' + x + ',' + y + '"' + hv('cell ' + x + ',' + y + (gm ? '<br>right-click → add a fort' : '')) + '></div>'); }
      var readout = (ovW ? '<span class="net-sg-ro"' + hv('Netwatch presence ' + nw + '/3 — ' + district) + '>Netwatch ' + (nw ? '●'.repeat(nw) : '○') + '</span>' : '') + (ovT ? '<span class="net-sg-ro"' + hv('traffic volume in ' + district) + '>traffic ~' + traf + '</span>' : '');
      wrap.className = 'net-map-wrap net-map-wrap-sg';
      wrap.innerHTML =
        '<div class="net-sg-head"><button class="net-mini" data-back>◄ City</button><span class="net-sg-t">' + district + ' · ' + esc(districtName(district)) + '</span><span class="net-sg-n">' + count + ' ' + (deep ? 'fort' : 'site') + (count === 1 ? '' : 's') + '</span>' + readout + '<span class="net-sg-sp"></span>' + (gm ? '<button class="net-mini" data-addfort>＋ fort</button>' : '') + '<span class="net-zoomctl"><button class="net-mini" data-zo="-">−</button><button class="net-mini" data-zo="fit">fit</button><button class="net-mini" data-zo="+">＋</button></span></div>' +
        '<div class="net-sg-view" id="net-sg-view"><div class="net-sg-inner" id="net-sg-inner"><div class="net-grid-field" style="--gf-cx:106px;--gf-cy:70px;--gf-px:318px;--gf-py:210px"><div class="net-map net-subgrid" style="grid-template-columns:repeat(' + SUBGRID_N + ',1fr)">' + cells + '</div></div></div></div>' +
        (isPlayer() && !count ? '<div class="net-map-note">Nothing in reach in this district. Pan and zoom to explore.</div>' : '');
      wrap.querySelector('[data-back]').onclick = function () { saveAtlas(function (s) { s.zoom = 'city'; }); reRenderAtlas(wrap); };
      wrap.querySelectorAll('[data-site]').forEach(function (b) { b.onclick = function () { var r = byId(rows, b.getAttribute('data-site')); if (r) navTo(siteUrl(r.json)); }; });
      wrap.querySelectorAll('[data-fort]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-fort'); _atlasFort = id; if (isPlayer()) { selfJackIn(id); } else { saveAtlas(function (s) { s.zoom = 'fort'; }); reRenderAtlas(wrap); } }; });
      if (gm) {
        var af = wrap.querySelector('[data-addfort]'); if (af) af.onclick = function () { var fc = freeSubcell(rows, district); addFortAt(district, fc.x, fc.y); };
        wrap.querySelectorAll('[data-empty]').forEach(function (c) { c.addEventListener('contextmenu', function (e) { e.preventDefault(); var p = c.getAttribute('data-empty').split(','); addFortAt(district, +p[0], +p[1]); }); });
      }
      var view = wrap.querySelector('#net-sg-view'), inner = wrap.querySelector('#net-sg-inner');
      var pz = mountPanZoom(view, inner, { scale: 1, center: true, minScale: 0.55 });
      wrap.querySelector('[data-zo="+"]').onclick = function () { pz.zoomBy(1.25); };
      wrap.querySelector('[data-zo="-"]').onclick = function () { pz.zoomBy(1 / 1.25); };
      wrap.querySelector('[data-zo="fit"]').onclick = function () { pz.reset(); };
      wireOverviewRefresh(wrap);
    }).catch(function () { wrap.innerHTML = '<div class="web-empty" style="padding:24px">Could not load the subgrid.</div>'; });
  }
  // A site as a card: glyph + name + label — DEEP shows the datafort tier, SURFACE
  // shows kind · broadcast (like the atlas reference).
  function subgridCell(node, deep) {
    var s = node.json, name = esc(s.name || 'site');
    if (node.vis === 'redacted') return '<div class="net-sg-c net-sg-hatch"' + hv('<b>▨ redacted</b><br>a signal is in range but out of reach') + '></div>';
    if (deep) {
      var tier = fortTier(s), g = tier === 'grey' ? '○' : tier === '1' ? '□' : '■';
      var lab = TIER_LABEL[tier] + (tier === 'black' ? ' — lethal' : '');
      var info = '<b>' + name + '</b><br>' + TIER_LABEL[tier] + ' datafort' + (isPlayer() ? '' : ' · rating ' + fortDiff(s).rating) + '<br>' + esc(s.kind || 'site');
      return '<button class="net-sg-c net-sg-card net-sg-fort' + (tier === 'black' ? ' net-sg-black' : '') + '" data-fort="' + esc(s.id) + '"' + hv(info) + '><span class="net-sg-g">' + g + '</span><span class="net-sg-nm">' + name + '</span><span class="net-sg-lb">' + esc(lab) + '</span></button>';
    }
    var kind = esc(s.kind || 'site'), bc = esc(s.broadcast || 'citywide'), off = !isOnline(s);
    var i2 = '<b>' + name + '</b><br>' + kind + ' · ' + bc + (off ? '<br><span class="net-hv-dim">offline</span>' : '');
    return '<button class="net-sg-c net-sg-card' + (off ? ' net-sg-off' : '') + '" data-site="' + esc(s.id) + '"' + hv(i2) + '><span class="net-sg-g">◆</span><span class="net-sg-nm">' + name + '</span><span class="net-sg-lb">' + (off ? 'offline' : kind + ' · ' + bc) + '</span></button>';
  }
  function freeSubcell(rows, district) { var used = {}; rows.forEach(function (r) { if (siteDistrict(r.json) !== district) return; var sc = subcellOf(r.json); used[sc.x + ',' + sc.y] = 1; }); for (var y = 0; y < SUBGRID_N; y++) for (var x = 0; x < SUBGRID_N; x++) if (!used[x + ',' + y]) return { x: x, y: y }; return { x: 0, y: 0 }; }
  function addFortAt(district, x, y) {
    App.prompt('New datafort', 'Name', 'New datafort', function (name) {
      if (name == null) return;
      var site = blankSite((name || '').trim() || 'New datafort'); site.kind = 'host'; site.deepOnly = true; site.district = district; site.subcell = { x: x, y: y };
      var d = newDatafort(1); site.datafort = d;
      Store.create('site', site).then(function (made) { App.emit('entity:saved', { type: 'site' }); _atlasFort = made.json.id; openFortEditor(made.json.id); }).catch(function (e) { if (window.UI) UI.modal({ title: 'Could not create the fort', body: '<p>' + esc(String((e && e.message) || e)) + '</p>', actions: [{ label: 'OK', kind: 'primary' }] }); });
    });
  }
  function byId(rows, id) { for (var i = 0; i < rows.length; i++) if (rows[i].json.id === id) return rows[i]; return null; }

  // Right rail — SEDIMENT: the Net's memory made spatial (scars of past events).
  // v1 reads CAST events from the overview (stub); empty until CAST feeds it.
  function netEvents() { var c = camp(); var o = (c && c.getOverview && c.getOverview()) || {}; var ev = o.netEvents || []; return isPlayer() ? ev.filter(function (e) { return e.public || (e.visibleTo || []).indexOf((br().sess || {}).sheetId) >= 0; }) : ev; }
  function paintSediment(rail, st) {
    if (!rail) return;
    var evs = netEvents();
    rail.innerHTML = '<div class="net-rail-h">SEDIMENT</div>' +
      (evs.length ? evs.slice(-40).reverse().map(function (e) {
        return '<button class="net-sed-row" data-sed="' + esc(e.id || '') + '"><span class="net-sed-g">' + esc(sedGlyph(e.type)) + '</span><span class="net-sed-b"><span class="net-sed-t">' + esc(e.subject || e.type || 'event') + '</span><span class="net-sed-m">' + esc((e.region || '') + (e.when != null ? ' · ' + e.when + 'h' : '')) + '</span></span></button>';
      }).join('') : '<div class="net-rail-empty">Quiet. Breaches, defacements, planted daemons and patrol trails will settle here as the Net remembers.</div>');
    rail.querySelectorAll('[data-sed]').forEach(function (b) { b.onclick = function () { /* → CHRONIQUE entry (v2) */ }; });
  }
  function sedGlyph(type) { return ({ breach: '†', daemon: '‡', deface: '▚', anb: '⚑', patrol: '⋯', netwar: '⚔', abandoned: '⌫' })[type] || '·'; }

  /* ═══════════════ ② FORT SIDEBAR — MJ inspector ═══════════════
     Opens over the atlas on a fort-node click. MJ only (an author's view — the
     player never sees the file ledger). Live-edits the datafort facet; difficulty
     recomputes on every change (derived, never stored). */
  // The FORT zoom layer (renderFortBuilder in the cyberspace) replaces the old drawer.
  // Any residual caller is redirected to it.
  function openFortSidebar(siteId) {
    if (isPlayer()) return;
    _atlasFort = siteId;
    var stg = document.querySelector('.net-atlas-stage');
    if (stg) { saveAtlas(function (s) { s.zoom = 'fort'; }); renderAtlas(stg); } else openFortEditor(siteId);
  }
  function fpStat(label, val) { return '<div class="net-fp-stat"><span class="net-fp-sl">' + esc(label) + '</span><span class="net-fp-sv">' + esc(String(val)) + '</span></div>'; }
  function fpStep(label, val, key) { return '<div class="net-fp-stat"><span class="net-fp-sl">' + esc(label) + '</span><span class="net-fp-sv net-fp-step"><button class="net-fp-b" data-step="' + key + '" data-dir="-1">−</button>' + esc(String(val)) + '<button class="net-fp-b" data-step="' + key + '" data-dir="1">+</button></span></div>'; }
  function subgridVignette(sg) { var w = (sg && sg.w) || 8, h = (sg && sg.h) || 8, out = ''; for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var c = sgAt(sg, x, y); out += '<span class="net-vg-c' + (c ? ' net-vg-' + c.kind : '') + '"></span>'; } return '<div class="net-vg" style="grid-template-columns:repeat(' + w + ',1fr)">' + out + '</div>'; }

  // Compact pickers (reuse the app's modal + picker classes).
  function pickStoreEntity(cb) {
    if (!window.UI) { cb(null); return; }
    var types = [['npc', 'NPC'], ['item', 'Item'], ['document', 'Doc'], ['org', 'Org'], ['location', 'Location'], ['shop', 'Shop']];
    UI.modal({ title: 'Link a record (loot ↔ Store)', body: '<label class="rt-field"><span class="rt-field-l">Type</span><select class="rt-input" id="le-type">' + types.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select></label><input class="rt-input" id="le-q" placeholder="search…" style="margin-top:8px"><div id="le-res" class="lk-picker-res" style="margin-top:8px;max-height:240px;overflow:auto"></div>', actions: [{ label: 'Cancel' }],
      onShow: function (box) {
        function load() { var ty = box.querySelector('#le-type').value, q = (box.querySelector('#le-q').value || '').toLowerCase(); Store.index(ty).then(function (rows) { var list = rows.filter(function (r) { return !q || (Store.displayName(r) || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 60); box.querySelector('#le-res').innerHTML = list.length ? list.map(function (r) { return '<button class="lk-picker-row" data-id="' + esc(r.json.id) + '" data-nm="' + esc(Store.displayName(r) || r.json.id) + '">' + esc(Store.displayName(r) || r.json.id) + '</button>'; }).join('') : '<div class="app-empty">none</div>'; box.querySelectorAll('[data-id]').forEach(function (b) { b.onclick = function () { UI.close(); cb({ type: ty, id: b.getAttribute('data-id'), name: b.getAttribute('data-nm') }); }; }); }).catch(function () {}); }
        box.querySelector('#le-type').onchange = load; box.querySelector('#le-q').oninput = App.debounce(load, 180); load();
      } });
  }
  function pickIce(cb) {
    if (!window.UI) { cb(null); return; }
    loadIceCat(function (cat) {
      UI.modal({ title: 'Load ICE (catalogue)', body: '<div class="net-icepick">' + cat.map(function (i, idx) { return '<button class="net-icepick-b" data-i="' + idx + '"><span class="net-ip-k">' + (i.blackIce ? '† ' : '') + esc(i.name) + '</span><span class="net-ip-m">' + esc(i.class) + ' · STR ' + i.str + ' · ' + i.mu + 'MU' + (i.mobile ? ' · ⟳ mobile' : '') + (i.alert && i.alert !== 'none' ? ' · ' + esc(i.alert) : '') + '</span></button>'; }).join('') + '</div>', actions: [{ label: 'Cancel' }],
        onShow: function (box) { box.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { UI.close(); cb(NetModel.makeIceEntry(cat[+b.getAttribute('data-i')])); }; }); } });
    });
  }

  /* ═══════════════ ③ FORT EDITOR — the Fort tab, diegetic ═══════════════
     Two entries: from a site's Fort tab, or autonomous — but first you procure a
     server (hardware tier + eb + district). The subgrid painter is the run terrain
     (jointive, no gutters). MJ + player (Fast
     Fortress of their own site) use the same editor. */
  // The fort editor is a TAB inside the site editor (the app shell stays visible),
  // not a full-screen overlay. Opening it selects that tab.
  var _composerFortId = null;   // openFortEditor targets THIS site's Fort tab (not a global flag)
  function openFortEditor(siteId) { _composerFortId = siteId; if (window.Shell && Shell.openEntity) Shell.openEntity('site', siteId, null); }
  // Autonomous entry — procure a server, then open the fort tab on a fresh fort-site.
  function newAutonomousFort() {
    procureServer(null, function (cfg) {
      var site = blankSite(cfg.name || 'New datafort'); site.kind = 'host'; site.deepOnly = true; site.district = cfg.district || DEFAULT_DISTRICT;
      var d = newDatafort(cfg.cpu || 1); d.tier = cfg.tier || 'grey'; if (cfg.wall) d.dataWallSTR = Math.max(1, Math.min(10, cfg.wall)); if (cfg.gates != null) { while (d.codeGates.length < cfg.gates) d.codeGates.push({ id: uid('gate'), str: 2 }); if (d.codeGates.length > cfg.gates) d.codeGates = d.codeGates.slice(0, cfg.gates); } site.datafort = d;
      Store.create('site', site).then(function (made) { App.emit('entity:saved', { type: 'site' }); openFortEditor(made.json.id); }).catch(function (e) { if (window.UI) UI.modal({ title: 'Could not create the fort', body: '<p>' + esc(String((e && e.message) || e)) + '</p>', actions: [{ label: 'OK', kind: 'primary' }] }); });
    });
  }
  // Hardware chassis (net-canon §Axe 2 — CPU→INT, tier is the public security label).
  var SERVER_TIERS = [
    { name: 'Personal computer (rented rack)', cpu: 1, tier: 'grey', cost: 3000 },
    { name: 'Terminal cluster', cpu: 2, tier: 'grey', cost: 9000 },
    { name: 'Mini-Frame', cpu: 3, tier: '1', cost: 30000 },
    { name: 'Business minicomp', cpu: 4, tier: '1', cost: 55000 },
    { name: 'Corporate mainframe', cpu: 5, tier: '2', cost: 90000 },
    { name: 'Hardened mainframe', cpu: 6, tier: '2', cost: 160000 },
    { name: 'Black-tier fortress core', cpu: 7, tier: '3', cost: 250000 }
  ];
  var ACQUIRE = [['rent', 'Rent', 'monthly bill · on the record'], ['buy', 'Buy', 'yours outright · a big hit'], ['steal', 'Steal', 'free but hot · Netwatch flag']];
  function procureServer(site, cb) {
    if (!window.UI) { cb({}); return; }
    var d = site && site.datafort;
    UI.modal({ title: 'Procure a server', size: 'wide',
      body: '<p class="dt-hint">Pick a chassis (sets CPU→INT and the public security tier), how you acquire it, and which district it sits in. Fine-tune CPU / walls / gates afterwards in the editor.</p>' +
        (site ? '' : '<label class="rt-field"><span class="rt-field-l">Name</span><input class="rt-input" id="ps-name" placeholder="Datafort name"></label>') +
        '<div class="net-ed-h">Chassis</div><div class="net-srv">' + SERVER_TIERS.map(function (t, i) { return '<button class="net-srv-b" data-srv="' + i + '"><b>' + esc(t.name) + '</b><span>' + t.cpu + ' CPU · INT ' + (t.cpu * 3) + ' · ' + (t.cpu * 40) + ' MU · tier ' + TIER_LABEL[t.tier] + '</span><span class="net-srv-c">' + t.cost + ' eb</span></button>'; }).join('') + '</div>' +
        '<div class="net-ed-h" style="margin-top:8px">Acquire</div><div class="net-srv-acq">' + ACQUIRE.map(function (a, i) { return '<label class="net-srv-acqb"><input type="radio" name="ps-acq" value="' + a[0] + '"' + (i === 0 ? ' checked' : '') + '><b>' + a[1] + '</b> <span>' + esc(a[2]) + '</span></label>'; }).join('') + '</div>' +
        '<label class="rt-field" style="margin-top:8px"><span class="rt-field-l">District (where it sits)</span><select class="rt-input" id="ps-dist"><option value="">— place later —</option>' + NC_DISTRICTS.map(function (n) { return '<option value="' + n.id + '"' + ((site && site.district) === n.id ? ' selected' : '') + '>' + n.id + ' · ' + esc(n.name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="net-ed-h" style="margin-top:8px">Or custom (GM sets the stats)</div><div class="net-srv-cust">' +
          '<label>CPU <input type="number" class="rt-input" id="ps-cpu" min="1" max="7" value="' + ((d && d.cpu) || 1) + '"></label>' +
          '<label>Wall STR <input type="number" class="rt-input" id="ps-wall" min="1" max="10" value="' + ((d && d.dataWallSTR) || 1) + '"></label>' +
          '<label>Gates <input type="number" class="rt-input" id="ps-gates" min="0" max="7" value="' + ((d && (d.codeGates || []).length) || 1) + '"></label>' +
          '<label>Tier <select class="rt-input" id="ps-tier">' + FORT_TIERS.map(function (t) { return '<option value="' + t + '"' + ((d && d.tier) === t ? ' selected' : '') + '>' + TIER_LABEL[t] + '</option>'; }).join('') + '</select></label>' +
          '<button class="dt-btn" data-custom>Use custom ▸</button>' +
        '</div>',
      actions: [{ label: 'Cancel' }],
      onShow: function (box) {
        function district() { return box.querySelector('#ps-dist').value; }
        function nameVal() { var nm = box.querySelector('#ps-name'); return nm ? nm.value : ''; }
        function acq() { return (box.querySelector('input[name=ps-acq]:checked') || {}).value || 'rent'; }
        box.querySelectorAll('[data-srv]').forEach(function (b) { b.onclick = function () { var t = SERVER_TIERS[+b.getAttribute('data-srv')]; UI.close(); cb({ cpu: t.cpu, tier: t.tier, cost: t.cost, district: district(), name: nameVal(), method: acq() }); }; });
        box.querySelector('[data-custom]').onclick = function () { var cpu = Math.max(1, Math.min(7, parseInt(box.querySelector('#ps-cpu').value, 10) || 1)); var wall = Math.max(1, Math.min(10, parseInt(box.querySelector('#ps-wall').value, 10) || 1)); var gates = Math.max(0, Math.min(7, parseInt(box.querySelector('#ps-gates').value, 10) || 0)); UI.close(); cb({ cpu: cpu, wall: wall, gates: gates, tier: box.querySelector('#ps-tier').value, district: district(), name: nameVal(), method: acq(), custom: true }); };
      } });
  }
  function iceOf(d, id) { var a = (d.ice || []).filter(function (i) { return i.id === id; }); return a[0]; }

  // A host's datafort holds a File for each site it hosts (their data lives on the server).
  function ensureHostFiles(site) {
    if (site.kind !== 'host') return Promise.resolve(false);
    var d = ensureDf(site);
    return Store.index('site').then(function (rows) {
      var changed = false, live = {};
      rows.forEach(function (r) { var s = r.json; if (s.id === site.id || s.hostId !== site.id) return; live[s.id] = 1; if (!(d.files || []).some(function (f) { return f.storeRef && f.storeRef.type === 'site' && f.storeRef.id === s.id; })) { d.files.push({ id: uid('file'), type: 'Inter-Office', mu: 1, storeRef: { type: 'site', id: s.id }, name: s.name, hosted: true }); changed = true; } });
      // drop hosted-file entries for sites no longer hosted here
      var before = (d.files || []).length; d.files = (d.files || []).filter(function (f) { return !(f.hosted && f.storeRef && !live[f.storeRef.id]); }); if (d.files.length !== before) changed = true;
      return changed;
    }).catch(function () { return false; });
  }
  // The fort builder, rendered INTO a container (the site editor's Fort tab).
  function renderFortBuilder(c, site, ref, poke, onBack) {
    var d = ensureDf(site);
    var tool = 'wall', sel = null, saveT = null, pz = null;
    function save() { clearTimeout(saveT); saveT = setTimeout(function () { Store.put(ref, site).then(function () { App.emit('entity:saved', { type: 'site' }); }).catch(function () {}); }, 300); }
    function setCpu(n) { n = Math.max(1, Math.min(7, n)); d.cpu = n; var g = d.codeGates || []; while (g.length < n) g.push({ id: uid('gate'), str: 2 }); if (g.length > n) g = g.slice(0, n); d.codeGates = g; if (d.dataWallSTR > 10) d.dataWallSTR = 10; }
    var TOOLS = [['wall', '█ Wall'], ['node', '▢ Node'], ['gate', '⊗ Gate'], ['ice', '☠ ICE'], ['file', '☰ File'], ['remote', '⊡ Remote'], ['core', '▲ CPU'], ['empty', '· Erase']];
    function comps() {
      return '<div class="net-ed-h" style="margin-top:12px">Files <span class="net-fp-n">' + (d.files || []).length + '</span><button class="net-mini" data-add-file>+</button></div>' +
        ((d.files || []).length ? d.files.map(function (f, i) { return '<div class="net-fp-file"><span>' + esc(f.type || 'file') + '</span><span class="net-fp-fa">' + (f.storeRef ? '<span class="net-fp-loot">↔ ' + esc(f.name || 'loot') + '</span>' : '<button class="net-mini" data-link-file="' + i + '">link</button>') + '<button class="net-mini" data-rm-file="' + i + '">✕</button></span></div>'; }).join('') : '<div class="net-fp-empty">No files.</div>') +
        '<div class="net-ed-h" style="margin-top:10px">ICE <span class="net-fp-n">' + (d.ice || []).length + '</span><button class="net-mini" data-add-ice>+</button></div>' +
        ((d.ice || []).length ? d.ice.map(function (ic, i) { return '<div class="net-fp-ice">' + (ic.blackIce ? '† ' : '') + esc(ic.name || 'ICE') + ' <span class="net-fp-str">STR ' + (ic.str || 0) + '</span>' + (ic.mobile ? ' ⟳' : '') + (ic.pos ? '' : ' <span class="net-fp-diffl">·unplaced</span>') + '<button class="net-mini net-fp-icerm" data-rm-ice="' + i + '">✕</button></div>'; }).join('') : '<div class="net-fp-empty">No ICE.</div>') +
        '<div class="net-ed-h" style="margin-top:10px">Remotes <span class="net-fp-n">' + (d.remotes || []).length + '</span><button class="net-mini" data-add-remote>+</button></div>' +
        ((d.remotes || []).length ? d.remotes.map(function (rm, i) { return '<div class="net-fp-file"><span>' + esc(rm.kind || 'remote') + '</span><button class="net-mini" data-rm-remote="' + i + '">✕</button></div>'; }).join('') : '<div class="net-fp-empty">No remotes.</div>');
    }
    function paint() {
      var D = NetModel.difficulty(d, { securityLevel: fortSecurity(site) }), sg = d.subgrid, w = sg.w || 12, h = sg.h || 12;
      c.innerHTML =
        '<div class="net-ed net-ed-tab">' +
          '<div class="net-ed-top">' + (onBack ? '<button class="net-mini" data-fb-back>◄</button>' : '') + '<span class="net-ed-t">DATAFORT · ' + esc(site.name || 'fort') + '</span>' +
            '<select class="net-sel" data-tier><option value=""' + (!d.tier ? ' selected' : '') + '>— tier: ' + TIER_LABEL[D.band] + ' (derived) —</option>' + FORT_TIERS.map(function (t) { return '<option value="' + t + '"' + (d.tier === t ? ' selected' : '') + '>force ' + TIER_LABEL[t] + '</option>'; }).join('') + '</select>' +
            '<span class="net-ed-diff">INT ' + D.int + (D.int >= 12 ? ' · AI' : '') + ' · MU ' + D.muCapacity + ' · ' + D.actions + ' act/rd · rating <b>' + D.rating + '</b> · ' + TIER_LABEL[D.band] + '</span>' +
            '<span class="net-ed-sp"></span><button class="dt-btn" data-server>Server ▸</button><button class="dt-btn" data-sketch>Auto-sketch</button><button class="dt-btn" data-run>Run test ▸</button></div>' +
          '<div class="net-ed-body">' +
            '<div class="net-ed-pal">' +
              '<div class="net-ed-h">Paint</div>' + TOOLS.map(function (t) { return '<button class="net-ed-tool' + (tool === t[0] ? ' on' : '') + '" data-tool="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
              '<div class="net-ed-h" style="margin-top:10px">Hardware</div>' +
                '<div class="net-ed-hw">' + fpStep('CPU', d.cpu + '/7', 'cpu') + fpStep('Wall', wallSTR(d), 'wall') + '</div>' +
                '<div class="net-ed-gates">Gates ' + (d.codeGates || []).length + ' · Σ' + gatesSTR(d) + ' <button class="net-mini" data-gate="str">STR+</button></div>' +
              '<div class="net-ed-h" style="margin-top:10px">Grid</div><div class="net-ed-size"><button class="net-mini" data-size="-">−</button><span>' + w + '×' + h + '</span><button class="net-mini" data-size="+">+</button></div>' +
              '<div class="net-ed-hint">Drag a cell to paint · drag the background to pan · wheel to zoom.</div>' +
            '</div>' +
            '<div class="net-ed-gridwrap"><div class="net-zoomctl net-ed-zoomctl"><button class="net-mini" data-zo="-">−</button><button class="net-mini" data-zo="fit">fit</button><button class="net-mini" data-zo="+">＋</button></div>' +
              '<div class="net-ed-view" id="net-ed-view"><div class="net-ed-inner" id="net-ed-inner"><div class="net-grid-field" style="--gf-cx:66px;--gf-cy:66px;--gf-px:198px;--gf-py:198px"><div class="net-rg net-rg-edit net-rg-big" id="net-ed-grid" style="grid-template-columns:repeat(' + w + ',1fr)"></div></div></div></div></div>' +
            '<div class="net-ed-insp"><div id="net-ed-cellinsp"></div><div id="net-ed-comp"></div></div>' +
          '</div>' +
        '</div>';
      paintGrid(); paintInsp();
      c.querySelector('#net-ed-comp').innerHTML = comps(); wireComps();
      var fbBack = c.querySelector('[data-fb-back]'); if (fbBack && onBack) fbBack.onclick = onBack;
      c.querySelector('[data-tier]').onchange = function (e) { d.tier = e.target.value || null; save(); paint(); };
      c.querySelector('[data-server]').onclick = function () { procureServer(site, function (cfg) { if (cfg.cpu) { setCpu(cfg.cpu); if (cfg.tier) d.tier = cfg.tier; } if (cfg.wall) d.dataWallSTR = Math.max(1, Math.min(10, cfg.wall)); if (cfg.gates != null) { var g = d.codeGates || []; while (g.length < cfg.gates) g.push({ id: uid('gate'), str: 2 }); if (g.length > cfg.gates) g = g.slice(0, cfg.gates); d.codeGates = g; } if (cfg.district) site.district = cfg.district; save(); paint(); }); };
      c.querySelector('[data-sketch]').onclick = function () { if (!(d.subgrid.cells || []).length || confirmSketch()) { loadIceCat(function () { autoSketch(d); save(); paint(); }); } };
      c.querySelector('[data-run]').onclick = function () { openRun(site.id); };
      c.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { tool = b.getAttribute('data-tool'); c.querySelectorAll('[data-tool]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      c.querySelectorAll('[data-step]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-step'), dir = +b.getAttribute('data-dir'); if (k === 'cpu') setCpu(d.cpu + dir); else if (k === 'wall') d.dataWallSTR = Math.max(1, Math.min(10, wallSTR(d) + dir)); save(); paint(); }; });
      c.querySelector('[data-gate="str"]').onclick = function () { (d.codeGates || []).forEach(function (g) { g.str = Math.min(10, (g.str || 2) + 1); }); save(); paint(); };
      c.querySelectorAll('[data-size]').forEach(function (b) { b.onclick = function () { var dir = b.getAttribute('data-size') === '+' ? 1 : -1; d.subgrid.w = Math.max(8, Math.min(20, (d.subgrid.w || 12) + dir)); d.subgrid.h = Math.max(8, Math.min(20, (d.subgrid.h || 12) + dir)); save(); paint(); }; });
      var view = c.querySelector('#net-ed-view'), inner = c.querySelector('#net-ed-inner'); pz = mountPanZoom(view, inner, { scale: 1, center: true });
      c.querySelector('[data-zo="+"]').onclick = function () { pz.zoomBy(1.25); };
      c.querySelector('[data-zo="-"]').onclick = function () { pz.zoomBy(1 / 1.25); };
      c.querySelector('[data-zo="fit"]').onclick = function () { pz.reset(); };
    }
    function confirmSketch() { return !window.confirm || window.confirm('Replace the current layout with a fresh sketch?'); }
    function wireComps() {
      c.querySelector('[data-add-file]').onclick = function () { App.prompt('Add file', 'File type', FILE_TYPES[0], function (ty) { if (ty == null) return; d.files.push({ id: uid('file'), type: ty || 'Database', mu: 1 }); save(); paint(); }); };
      c.querySelectorAll('[data-link-file]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-link-file'); pickStoreEntity(function (r) { if (r) { d.files[i].storeRef = { type: r.type, id: r.id }; d.files[i].name = r.name; save(); paint(); } }); }; });
      c.querySelectorAll('[data-rm-file]').forEach(function (b) { b.onclick = function () { d.files.splice(+b.getAttribute('data-rm-file'), 1); save(); paint(); }; });
      c.querySelector('[data-add-ice]').onclick = function () { pickIce(function (ic) { if (ic) { d.ice.push(ic); save(); paint(); } }); };
      c.querySelectorAll('[data-rm-ice]').forEach(function (b) { b.onclick = function () { var ic = d.ice.splice(+b.getAttribute('data-rm-ice'), 1)[0]; if (ic && ic.pos) sgSet(d.subgrid, ic.pos.x, ic.pos.y, 'empty'); save(); paint(); }; });
      c.querySelector('[data-add-remote]').onclick = function () { App.prompt('Add remote', 'Kind (camera / door / vehicle…)', 'camera', function (k) { if (k == null) return; d.remotes.push({ id: uid('rem'), kind: k || 'remote', meatRef: null }); save(); paint(); }); };
      c.querySelectorAll('[data-rm-remote]').forEach(function (b) { b.onclick = function () { d.remotes.splice(+b.getAttribute('data-rm-remote'), 1); save(); paint(); }; });
    }
    function paintGrid() {
      var grid = c.querySelector('#net-ed-grid'); if (!grid) return;
      var sg = d.subgrid, w = sg.w || 12, h = sg.h || 12, idx = sgLabelIndex(sg), html = '';
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var cc = sgAt(sg, x, y), key = x + ',' + y; var cls = 'net-rg-c' + (cc ? ' net-rg-' + cc.kind + (cc.kind === 'ice' && iceOf(d, cc.ref) && iceOf(d, cc.ref).blackIce ? ' net-rg-black' : '') : ''); var inner = cc ? cellInnerHtml(cc.kind, idx[key], {}) : ''; var hvx = cc ? cellHv(cc) : ''; html += '<button class="' + cls + (sel === key ? ' net-rg-sel' : '') + '" data-cell="' + key + '"' + hvx + '>' + inner + '</button>'; }
      grid.innerHTML = html;
      var painting = false;
      function apply(key) { var p = key.split(','), x = +p[0], y = +p[1]; if (tool === 'ice') { if (sgAt(sg, x, y) && sgAt(sg, x, y).kind === 'ice') return; pickIce(function (ic) { if (!ic) return; ic.pos = { x: x, y: y }; d.ice.push(ic); sgSet(sg, x, y, 'ice', ic.id); save(); paint(); }); return; } if (tool === 'file') { if (sgAt(sg, x, y) && sgAt(sg, x, y).kind === 'file') return; App.prompt('File', 'Type (Grey Ops / Black Ops / Database…)', FILE_TYPES[4], function (ty) { if (ty == null) return; var f = { id: uid('file'), type: ty || 'Database', mu: 1, pos: { x: x, y: y } }; d.files.push(f); sgSet(sg, x, y, 'file', f.id); save(); paint(); }); return; } if (tool === 'remote') { App.prompt('Remote', 'Kind (camera / door / vehicle…)', 'camera', function (k) { if (k == null) return; var rm = { id: uid('rem'), kind: k || 'remote', meatRef: null, pos: { x: x, y: y } }; d.remotes.push(rm); sgSet(sg, x, y, 'remote', rm.id); save(); paint(); }); return; } sgSet(sg, x, y, tool === 'empty' ? 'empty' : tool); sel = key; save(); paintGrid(); paintInsp(); }
      grid.querySelectorAll('[data-cell]').forEach(function (cell) {
        cell.addEventListener('mousedown', function (e) { e.preventDefault(); painting = true; apply(cell.getAttribute('data-cell')); });
        cell.addEventListener('mouseenter', function () { if (painting && tool !== 'ice' && tool !== 'remote' && tool !== 'file') apply(cell.getAttribute('data-cell')); });
        cell.addEventListener('click', function () { sel = cell.getAttribute('data-cell'); paintInsp(); paintGrid(); });
      });
      document.addEventListener('mouseup', function () { painting = false; }, { once: true });
    }
    function cellHv(cc) { if (cc.kind === 'ice') { var ic = iceOf(d, cc.ref); return hv(ic ? ('<b>☠ ' + esc(ic.name) + (ic.blackIce ? ' — Black ICE' : '') + '</b><br>STR ' + ic.str + ' · ' + esc(ic.class) + (ic.mobile ? '<br>⟳ mobile — patrols' : '')) : 'ICE'); } if (cc.kind === 'file') { var f = (d.files || []).filter(function (z) { return z.id === cc.ref; })[0]; return hv('<b>☰ ' + esc((f && f.type) || 'File') + '</b>' + (f && f.storeRef ? '<br>↔ loot linked' : '')); } if (cc.kind === 'core') return hv('<b>▲ CPU / core</b><br>the system’s brain'); if (cc.kind === 'gate') return hv('<b>⊗ Code gate</b><br>a password wall'); if (cc.kind === 'wall') return hv('<b>█ Data wall</b>'); if (cc.kind === 'remote') return hv('<b>⊡ Remote</b><br>a device the fort controls'); if (cc.kind === 'node') return hv('<b>▢ Node</b>'); return ''; }
    function paintInsp() {
      var box = c.querySelector('#net-ed-cellinsp'); if (!box) return;
      if (!sel) { box.innerHTML = '<div class="net-ed-h">Cell</div><div class="net-fp-empty">Click a cell to inspect. Difficulty updates live from the whole build.</div>'; return; }
      var p = sel.split(','), x = +p[0], y = +p[1], cc = sgAt(d.subgrid, x, y);
      var body = '<div class="net-ed-h">Cell ' + x + ',' + y + '</div>';
      if (!cc) body += '<div class="net-fp-empty">Empty.</div>';
      else if (cc.kind === 'ice') { var ic = iceOf(d, cc.ref); body += ic ? '<div class="net-fp-ice">☠ ' + esc(ic.name) + (ic.blackIce ? ' — Black ICE' : '') + ' <span class="net-fp-str">STR ' + ic.str + '</span>' + (ic.mobile ? ' ⟳' : '') + '</div><button class="net-mini" data-clear>remove ICE</button>' : ''; }
      else if (cc.kind === 'file') { var f = (d.files || []).filter(function (z) { return z.id === cc.ref; })[0]; body += '<div class="net-fp-file"><span>☰ ' + esc((f && f.type) || 'File') + '</span>' + (f && f.storeRef ? '<span class="net-fp-loot">↔ ' + esc(f.name || 'loot') + '</span>' : (f ? '<button class="net-mini" data-linkf>link Store</button>' : '')) + '</div><button class="net-mini" data-clear>remove file</button>'; }
      else body += '<div class="net-fp-loc">' + esc(cc.kind) + '</div><button class="net-mini" data-clear>erase</button>';
      box.innerHTML = body;
      var lf = box.querySelector('[data-linkf]'); if (lf) lf.onclick = function () { var f = (d.files || []).filter(function (z) { return z.id === cc.ref; })[0]; if (f) pickStoreEntity(function (r) { if (r) { f.storeRef = { type: r.type, id: r.id }; f.name = r.name; save(); paint(); } }); };
      var cl = box.querySelector('[data-clear]'); if (cl) cl.onclick = function () { if (cc && cc.kind === 'ice') d.ice = d.ice.filter(function (z) { return z.id !== cc.ref; }); if (cc && cc.kind === 'file') d.files = d.files.filter(function (z) { return z.id !== cc.ref; }); if (cc && cc.kind === 'remote') d.remotes = d.remotes.filter(function (z) { return z.id !== cc.ref; }); sgSet(d.subgrid, x, y, 'empty'); save(); paint(); };
    }
    paint();
    ensureHostFiles(site).then(function (ch) { if (ch) { save(); paint(); } });   // hosted sites → files on the host's datafort
  }
  // A structured starting footprint: outer shell, an inner vault around the core,
  // an entrance + vault gate, work nodes, and a couple of guard ICE.
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // A dense, coherent datafort — a central blob of merged chambers (kept off the map
  // edges), a wall shell with code-gate passages, clustered numbered nodes, a central
  // CPU, ICE at the gates / around the core / on patrol, plus files and remotes.
  function autoSketch(d) {
    var sg = d.subgrid, W = sg.w || 12, H = sg.h || 12; sg.cells = [];
    var cpu = Math.max(1, Math.min(7, d.cpu || 1));
    var R = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
    // components: keep authored ones (reset their positions), else generate a loadout
    // from the shared catalogue (data/net-ice.json → NetModel.makeIceEntry).
    if (!(d.ice || []).length) { d.ice = []; var iceKinds = ['Watchdog', 'Bloodhound', 'Killer VI', 'Hellhound', 'Liche', 'Brainwipe', 'Glue', 'Stun', 'Manticore', 'Dragon']; var nIce = Math.min(iceKinds.length, 3 + cpu); for (var q = 0; q < nIce; q++) d.ice.push(NetModel.makeIceEntry(iceByName(iceKinds[q]))); }
    else d.ice.forEach(function (i) { i.pos = null; });
    if (!(d.files || []).some(function (f) { return !f.hosted; })) { var ft = ['Black Ops', 'Grey Ops', 'Database', 'Financial', 'Business Records', 'Inter-Office']; var nF = 3 + Math.floor(cpu / 2); for (var fq = 0; fq < nF; fq++) d.files.push({ id: uid('file'), type: ft[fq % ft.length], mu: 1, pos: null }); }
    else d.files.forEach(function (f) { f.pos = null; });
    if (!(d.remotes || []).length) d.remotes = [NetModel.makeRemoteEntry('terminal'), NetModel.makeRemoteEntry('camera')];
    else d.remotes.forEach(function (r) { r.pos = null; });

    var margin = 2, cx = Math.floor(W / 2), cy = Math.floor(H / 2), interior = {};
    function room(rx, ry, rw, rh) { for (var y = ry; y < ry + rh; y++) for (var x = rx; x < rx + rw; x++) if (x >= margin && x <= W - 1 - margin && y >= margin && y <= H - 1 - margin) interior[x + ',' + y] = 1; }
    room(cx - 2, cy - 2, 4, 4);
    var nRooms = 2 + Math.floor(cpu / 2) + R(0, 1);
    for (var rr = 0; rr < nRooms; rr++) { var rw = R(3, 5), rh = R(3, 5), dir = R(0, 3); room(cx - 1 + (dir === 0 ? -rw : dir === 1 ? 2 : R(-2, 1)), cy - 1 + (dir === 2 ? -rh : dir === 3 ? 2 : R(-2, 1)), rw, rh); }
    var intCells = Object.keys(interior).map(function (k) { var p = k.split(','); return { x: +p[0], y: +p[1] }; }).sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    if (!intCells.length) { room(cx - 2, cy - 2, 4, 4); intCells = Object.keys(interior).map(function (k) { var p = k.split(','); return { x: +p[0], y: +p[1] }; }); }
    // wall shell = cells touching the interior but not inside it
    var wallSet = {}, DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    Object.keys(interior).forEach(function (k) { var p = k.split(','), x = +p[0], y = +p[1]; DIRS8.forEach(function (dd) { var nx = x + dd[0], ny = y + dd[1], nk = nx + ',' + ny; if (!interior[nk] && nx >= 0 && nx < W && ny >= 0 && ny < H) wallSet[nk] = 1; }); });
    Object.keys(wallSet).forEach(function (k) { var p = k.split(','); sgSet(sg, +p[0], +p[1], 'wall'); });
    // gates: wall cells that are a real passage (interior on one side, open on the other)
    var wallCells = shuffle(Object.keys(wallSet).map(function (k) { var p = k.split(','); return { x: +p[0], y: +p[1] }; }));
    var wantGates = Math.max(2, (d.codeGates || []).length || cpu), gates = 0, DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    wallCells.forEach(function (w) { if (gates >= wantGates) return; for (var i = 0; i < 4; i++) { var inK = (w.x + DIRS4[i][0]) + ',' + (w.y + DIRS4[i][1]), outK = (w.x - DIRS4[i][0]) + ',' + (w.y - DIRS4[i][1]); if (interior[inK] && !interior[outK] && !wallSet[outK]) { sgSet(sg, w.x, w.y, 'gate'); gates++; break; } } });
    // core near the centroid
    var core = intCells[Math.floor(intCells.length / 2)]; sgSet(sg, core.x, core.y, 'core');
    function freeInt() { return intCells.filter(function (c) { return !sgAt(sg, c.x, c.y); }); }
    // nodes (clustered, dense)
    var pool = shuffle(freeInt()), nNodes = Math.min(pool.length, 3 + cpu * 2);
    for (var n = 0; n < nNodes; n++) sgSet(sg, pool[n].x, pool[n].y, 'node');
    // files scattered inside
    d.files.forEach(function (f) { var fr = freeInt(); if (!fr.length) return; var c = fr[R(0, fr.length - 1)]; f.pos = { x: c.x, y: c.y }; sgSet(sg, c.x, c.y, 'file', f.id); });
    // ICE: gates → their interior side, then around the core, then anywhere free
    var spots = [];
    sgCells(sg).filter(function (c) { return c.kind === 'gate'; }).forEach(function (g) { DIRS4.forEach(function (dd) { var x = g.x + dd[0], y = g.y + dd[1]; if (interior[x + ',' + y] && !sgAt(sg, x, y)) spots.push({ x: x, y: y }); }); });
    DIRS4.forEach(function (dd) { var x = core.x + dd[0], y = core.y + dd[1]; if (interior[x + ',' + y] && !sgAt(sg, x, y)) spots.push({ x: x, y: y }); });
    spots = spots.concat(shuffle(freeInt()));
    d.ice.forEach(function (ic, idx) { var s = spots[idx]; if (!s || sgAt(sg, s.x, s.y)) { var fr = freeInt(); s = fr[0]; } if (s && !sgAt(sg, s.x, s.y)) { ic.pos = { x: s.x, y: s.y }; sgSet(sg, s.x, s.y, 'ice', ic.id); } });
    // remotes on the interior edge (near the shell — the connection points)
    var edge = shuffle(freeInt().filter(function (c) { return DIRS4.some(function (dd) { return wallSet[(c.x + dd[0]) + ',' + (c.y + dd[1])]; }); }));
    d.remotes.forEach(function (rm, idx) { var c = edge[idx] || freeInt()[0]; if (c && !sgAt(sg, c.x, c.y)) { rm.pos = { x: c.x, y: c.y }; sgSet(sg, c.x, c.y, 'remote', rm.id); } });
  }

  /* ═══════════════ THE RUN — ⑤ player board / ⑦ SYSOP / ⑥ cast ═══════════════
     One shared state in Yjs (the overview): three views of the same round. The
     app decrements the action budget and applies TYPED results — no dice. */
  function getRun() { var c = camp(); return (c && c.getOverview && (c.getOverview() || {}).netRun) || null; }
  function setRun(patch) { var c = camp(); if (!c || !c.setOverview) return; var cur = getRun() || {}; c.setOverview({ netRun: Object.assign({}, cur, patch) }); }
  function getDecl() { var c = camp(); return (c && c.getOverview && (c.getOverview() || {}).netRunDecl) || null; }
  function setDecl(dcl) { var c = camp(); if (!c || !c.setOverview) return; c.setOverview({ netRunDecl: dcl }); }
  function runBeat(run, text) { var beats = (run.beats || []).concat([{ ts: netClock(), text: text }]).slice(-30); return beats; }
  function mySheetId() { return (br().sess || {}).sheetId; }

  /* VISION — raycast LOS (canon [CORE p.152]: you see everything within 20 cells
     UNLESS a data wall blocks it). No persistent `scanned`: a line of sight computed
     from runnerPos, walls project shadow. `remembered` accumulates cells once seen. */
  var LOS_RADIUS = 20;
  function isWallAt(sg, x, y) { var c = sgAt(sg, x, y); return !!(c && c.kind === 'wall'); }
  function losVisible(sg, pos, radius) {
    var vis = {}; if (!pos) return vis; var w = sg.w || 12, h = sg.h || 12, r = radius || LOS_RADIUS;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (Math.max(Math.abs(x - pos.x), Math.abs(y - pos.y)) > r) continue;
      // Bresenham from runner to target; blocked if a wall lies strictly between (the
      // wall face itself stays visible — you see the wall, not what's behind it).
      var x0 = pos.x, y0 = pos.y, x1 = x, y1 = y, adx = Math.abs(x1 - x0), ady = Math.abs(y1 - y0);
      var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = adx - ady, cx = x0, cy = y0, blocked = false;
      while (!(cx === x1 && cy === y1)) {
        var e2 = 2 * err; if (e2 > -ady) { err -= ady; cx += sx; } if (e2 < adx) { err += adx; cy += sy; }
        if (cx === x1 && cy === y1) break;
        if (isWallAt(sg, cx, cy)) { blocked = true; break; }
      }
      if (!blocked) vis[x + ',' + y] = true;
    }
    return vis;
  }
  function rememberUnion(prev, vis) { var m = Object.assign({}, prev || {}); for (var k in vis) if (vis.hasOwnProperty(k)) m[k] = true; return m; }
  // A jack-in cell: prefer a code gate on the perimeter, else the first gate, else a mid-edge cell.
  function entryCell(sg) {
    var cells = sgCells(sg), w = sg.w || 12, h = sg.h || 12, gates = cells.filter(function (c) { return c.kind === 'gate'; });
    var edge = gates.filter(function (c) { return c.x === 0 || c.y === 0 || c.x === w - 1 || c.y === h - 1; });
    if (edge.length) return { x: edge[0].x, y: edge[0].y };
    if (gates.length) return { x: gates[0].x, y: gates[0].y };
    // fall to a free mid-left cell
    for (var y = (h >> 1); y < h; y++) for (var x = 0; x < w; x++) { if (!sgAt(sg, x, y) || sgAt(sg, x, y).kind !== 'wall') return { x: x, y: y }; }
    return { x: 0, y: h >> 1 };
  }

  // GM: start a run against a fort — pick the runner sheet, seed the shared state.
  function openRun(siteId) {
    if (isPlayer()) { selfJackIn(siteId); return; }
    Store.resolve({ type: 'site', id: siteId }).then(function (hit) {
      if (!hit) return; var site = hit.json, d = ensureDf(site);
      var sheets = playerSheets();
      if (!window.UI) { return; }
      // Runner id = the canonical sheet key (rec.id == the player's session sheetId), so
      // the runner's own board and MEAT token resolve. (rec.json.id is a different id.)
      var body = '<p class="dt-hint">Jack a runner into <b>' + esc(site.name) + '</b>. This opens the SYSOP console (you) and the run board (them). Table-first — you type every result.</p>' +
        '<label class="rt-field"><span class="rt-field-l">Runner</span><select class="rt-input" id="run-who">' + (sheets.length ? sheets.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(sheetLabelOf(r)) + '</option>'; }).join('') : '<option value="">(no player sheets)</option>') + '</select></label>';
      UI.modal({ title: 'Start a run', body: body, actions: [{ label: 'Cancel' }, { label: 'Jack in ▸', kind: 'primary', onClick: function (box) { var who = box.querySelector('#run-who').value; sketchIfEmpty(site, d, function () { startRun(site, d, who); gotoRun(); }); } }] });
    }).catch(function () {});
  }
  // Self-jack-in (gate ~2957): a runner opens a standalone run on a reachable fort — no GM
  // needed. The GM is notified (log + the shared run state their SYSOP picks up).
  function selfJackIn(siteId) {
    var sid = mySheetId(); if (!sid) { flashTool('no sheet on this session'); return; }
    var existing = getRun(); if (existing && existing.status === 'active') { gotoRun(); return; }
    Store.resolve({ type: 'site', id: siteId }).then(function (hit) {
      if (!hit) return; var site = hit.json, d = ensureDf(site), pj = playerJson();
      if (reachOfDeck(pj) <= 0) { flashTool('Jack in with a cyberdeck to run a fort.'); return; }
      if (!isOnline(site) || !connectable(site, effectiveReach(pj))) { flashTool('Out of reach — a closer jack-in or a better rig gets you there.'); return; }
      sketchIfEmpty(site, d, function () {
        startRun(site, d, sid, { selfJack: true });
        if (br().logSession) br().logSession('▸ ' + sheetLabelOf({ json: pj }) + ' self-jacks into ' + (site.name || 'a fort'));
        gotoRun();
      });
    }).catch(function () {});
  }
  // A fort's terrain (subgrid cells) is only ever laid down by autoSketch. A fort the GM
  // never hand-sketched has cells:[] → a blank run board. Sketch on first run (needs the ICE
  // catalogue), persist so it's stable and the player's Store can pick it up. Never clobber a
  // fort that already has cells (that would wipe a GM's hand-painted layout).
  function sketchIfEmpty(site, d, cb) {
    if (d.subgrid && d.subgrid.cells && d.subgrid.cells.length) { cb(); return; }
    loadIceCat(function () { autoSketch(d); site.datafort = d; Store.put({ type: 'site', id: site.id }, site).catch(function () {}); cb(); });
  }
  // Focus the web section on the RUN surface (in-section, not an overlay). Target the tool
  // that OWNS the browser for this role: a player's browser IS 'web-home' (renderHome →
  // renderBrowser), the GM's is 'web-browse'. Opening the wrong one spawns a SECOND browser
  // pane → two elements share id "web-stage", the run renders into the hidden one, and every
  // click handler is dead. Each role has exactly one browser-owning tool, so this never dupes.
  function gotoRun() {
    var tool = isPlayer() ? 'web-home' : 'web-browse';
    if (window.Shell && Shell.openTool) Shell.openTool(tool);
    (function nav(tries) {
      if (_tabs && document.getElementById('web-stage')) { navTo('/run'); return; }
      if (tries <= 0) return; setTimeout(function () { nav(tries - 1); }, 40);
    })(12);
  }
  function startRun(site, d, runnerSheetId, opts) {
    opts = opts || {};
    var c = camp(); var rec = runnerSheetId && c && c.getSheet && c.getSheet(runnerSheetId); var sheet = rec && rec.json;
    var runnerActions = 1 + (sheet ? deckSpeed(sheet) : 0);
    var traceMax = Math.min(12, 4 + (d.codeGates || []).length + (d.ice || []).filter(function (i) { return i.trace; }).length);
    var pos = entryCell(d.subgrid);
    var runnerName = sheet ? (sheet.handle || sheet.name || 'runner') : 'runner';
    var openLine = opts.selfJack ? (runnerName + ' jacks into ' + (site.name || 'the fort') + '.') : ('Run opened against ' + (site.name || 'fort') + '.');
    var run = {
      id: uid('run'), hostId: site.id, hostName: site.name, runnerSheetId: runnerSheetId || '', runnerName: runnerName,
      mode: 'standalone', selfJack: !!opts.selfJack,
      round: 1, actionsLeft: { runner: runnerActions, fort: NetModel.actsOf(d) },
      runnerPos: pos, depth: { v: 0, max: 6 }, trace: { v: 0, max: traceMax, countdown: null },
      aiBehavior: NetModel.intOf(d) >= 12 ? 'territorial' : '', autoPlay: false,
      // The fort travels IN the run state so the runner sees it even when their Store
      // hasn't synced the GM's (unpublished) datafort. The GM's plays update it live.
      fort: d,
      reveal: {}, remembered: rememberUnion({}, losVisible(d.subgrid, pos, LOS_RADIUS)),
      beats: [{ ts: netClock(), text: openLine }], status: 'active', dispatch: null
    };
    setRun(run); setDecl(null);
    if (br().logSession) br().logSession('▸ Netrun opened: ' + runnerName + ' → ' + (site.name || 'fort'));
  }
  function endRun(status) { var run = getRun(); if (!run) return; _surfacedRunId = null; setRun({ status: status || 'jacked-out' }); if (br().logSession) br().logSession('■ Netrun ' + (status || 'ended') + ' (' + (run.hostName || 'fort') + ')'); }

  /* The run renders INSIDE the web section (web-stage, url '/run') — no overlay.
     While shown, we subscribe to the overview so every SET STATE repaints live. */
  var _runUnsub = null;
  function clearRunLive() { if (_runUnsub) { try { _runUnsub(); } catch (e) {} _runUnsub = null; } }
  function reRunStage() { var s = document.getElementById('web-stage'); if (s && _tabs && activeTab().url === '/run') renderRunSection(s); }
  function bindRunLive() { clearRunLive(); var c = camp(); if (c && c.onOverview) _runUnsub = c.onOverview(reRunStage); }

  // Dispatch the RUN surface by role: GM → SYSOP · the runner → player board · others → spectator.
  function renderRunSection(stage) {
    wireHover(); bindRunLive();
    var run = getRun();
    if (!run || run.status !== 'active') { renderRunEnded(stage, run); return; }
    if (isPlayer()) {
      if (run.runnerSheetId && run.runnerSheetId === mySheetId()) renderRunPlayer(stage, run);
      else renderRunSpectator(stage, run);
    } else renderSysop(stage, run);
  }
  function renderRunEnded(stage, run) {
    clearRunLive();
    var st = run && run.status ? run.status : 'none';
    var label = st === 'flatlined' ? 'FLATLINED' : st === 'dumped' ? 'DUMPED' : st === 'jacked-out' ? 'JACKED OUT' : 'NO ACTIVE RUN';
    stage.innerHTML = '<div class="net-run-end"><div class="net-run-end-t">' + esc(label) + '</div>' +
      (run && run.hostName ? '<div class="net-run-end-s">' + esc(run.hostName) + '</div>' : '') +
      '<button class="dt-btn" data-back>▦ Back to Cyberspace</button></div>';
    var b = stage.querySelector('[data-back]'); if (b) b.onclick = function () { navTo('/home/map'); };
  }
  function renderRunSpectator(stage, run) {
    stage.innerHTML = '<div class="net-run-end"><div class="net-run-end-t">RUN IN PROGRESS</div>' +
      '<div class="net-run-end-s">' + esc(run.runnerName || 'A runner') + ' is deep in ' + esc(run.hostName || 'a fort') + '. Watch it on the shared screen (CAST).</div>' +
      '<div class="net-beats">' + (run.beats || []).slice(-6).reverse().map(function (bt) { return '<div class="net-beat">' + esc(bt.text) + '</div>'; }).join('') + '</div></div>';
  }
  function gaugeHtml(label, g, cls) { var v = (g && g.v) || 0, max = (g && g.max) || 6, pct = Math.min(100, Math.round(v / max * 100)); return '<div class="net-gauge ' + (cls || '') + '"><div class="net-gauge-l">' + esc(label) + ' <b>' + v + '/' + max + '</b></div><div class="net-gauge-bar"><span style="width:' + pct + '%"></span></div></div>'; }
  // v1 standalone: initiative is runner + fort only (meat combatants merge is v2, §9).
  function initiativeList(run, d) {
    var c = camp(), out = [];
    var runnerInit = 0; if (run.runnerSheetId && c && c.getSheet) { var s = c.getSheet(run.runnerSheetId); s = s && s.json; runnerInit = ((s && s.stats && (s.stats.REF || s.stats.ref)) || 0) + deckSpeed(s); }
    var fortInit = NetModel.intOf(d);
    for (var i = 0; i < (run.actionsLeft.runner || 0); i++) out.push({ kind: 'deck', label: run.runnerName + ' — action ' + (i + 1), init: runnerInit });
    for (var j = 0; j < (run.actionsLeft.fort || 0); j++) out.push({ kind: 'ice', label: (d.tier === 'black' ? 'BLACK ' : '') + 'fort — action ' + (j + 1), init: fortInit });
    out.sort(function (a, b) { return b.init - a.init; });
    return out;
  }

  /* ⑦ SYSOP — the GM plays the fort (fully unmasked, nested piece menus). In-section. */
  var _sysMoveIce = null, _sysSelIce = null;
  var AI_BEHAVIORS = ['territorial', 'aggressive', 'trapper', 'hunter', 'defensive'];
  function sysSuggest(behavior, ic) {
    var mob = ic && ic.mobile;
    switch (behavior) {
      case 'aggressive': return 'attack the runner' + (mob ? ' — close in first' : '');
      case 'hunter': return mob ? 'move toward the runner, then strike' : 'strike anything in reach';
      case 'trapper': return 'hold dormant, wake when the runner is adjacent';
      case 'defensive': return mob ? 'fall back to guard the core' : 'guard — attack only intruders on your node';
      default: return mob ? 'patrol your territory, chase on contact' : 'hold your node, attack on contact';
    }
  }
  function saveFort(run, d) { Store.resolve({ type: 'site', id: run.hostId }).then(function (h) { if (h) { h.json.datafort = d; Store.put(h.ref, h.json).catch(function () {}); } }); }
  // Give a render the datafort to draw. run.fort (rides Yjs, always set at startRun) is
  // ALREADY a datafort, so normalize as {datafort: run.fort} — NOT ensureDf(run.fort), which
  // reads a missing .datafort and hands back an EMPTY fort (the "forts are empty" bug). When
  // run.fort is present we render synchronously (no Store round-trip that could blank the board
  // if the hub is slow); only a legacy run without a snapshot falls back to Store.resolve.
  function withRunFort(run, cb) {
    if (run.fort) { cb(ensureDf({ datafort: run.fort })); return; }
    Store.resolve({ type: 'site', id: run.hostId }).then(function (hit) { cb(hit ? ensureDf(hit.json) : newDatafort(1)); }).catch(function () { cb(newDatafort(1)); });
  }
  function iceStateLabel(ic) { return ic.state === 'down' ? 'down' : ic.state === 'awake' ? 'awake' : 'dormant'; }
  function renderSysop(stage, run) {
    withRunFort(run, function (d) {
      if (activeTab().url !== '/run') return;
      var init = initiativeList(run, d), intv = NetModel.intOf(d), hasAI = intv >= 12;
      var ices = (d.ice || []).slice().sort(function (a, b) { return (b.str || 0) - (a.str || 0); });
      var beh = run.aiBehavior || (hasAI ? 'territorial' : '');
      var traceFull = run.trace.v >= run.trace.max, cd = run.trace.countdown;
      stage.innerHTML =
        '<div class="net-run net-run-gm">' +
          '<div class="net-run-top"><span class="net-run-t">SYSOP — ' + esc(run.hostName || 'fort') + '</span>' +
            '<span class="net-run-rd">round ' + run.round + ' · ' + esc(NetModel.difficulty(d, { securityLevel: 2 }).band) + '</span>' +
            '<span class="net-run-sp"></span>' +
            '<button class="dt-btn" data-cast>Cast ⑥</button><button class="dt-btn" data-next>Next round ▸</button><button class="dt-btn net-danger" data-end>End run</button></div>' +
          '<div class="net-run-body">' +
            '<div class="net-run-mid"><div class="net-run-h">' + (_sysMoveIce ? 'Click the ICE’s new cell' : 'The fort — fully unmasked · dotted = what the runner sees') + '</div>' + runGridHtml(run, d, false) + '</div>' +
            '<div class="net-run-right net-sysop-play">' +
              '<div class="net-run-h">Play the fort</div>' +
              (hasAI ? '<div class="net-ai"><span class="net-ai-l">◆ AI · INT ' + intv + '</span><select class="net-sel" id="sy-beh">' + AI_BEHAVIORS.map(function (b) { return '<option value="' + b + '"' + (b === beh ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select></div>' : '<div class="net-ai net-ai-none">No AI (INT ' + intv + ' < 12) — you run the ICE.</div>') +
              '<label class="net-auto"><input type="checkbox" id="sy-auto"' + (run.autoPlay ? ' checked' : '') + '> auto-play (algo follows behavior)</label>' +
              '<div class="net-ice-list">' + (ices.length ? ices.map(function (ic) {
                var open = _sysSelIce === ic.id;
                return '<div class="net-icep' + (open ? ' on' : '') + '">' +
                  '<button class="net-icep-h" data-ice="' + esc(ic.id) + '"><span class="net-icep-n">☠ ' + esc(ic.name) + (ic.blackIce ? ' ◼' : '') + '</span><span class="net-icep-m">S' + (ic.str || 0) + ' · ' + iceStateLabel(ic) + (ic.mobile ? ' · ⟳' : '') + (ic.pos ? ' · @' + ic.pos.x + ',' + ic.pos.y : '') + '</span></button>' +
                  (open ? '<div class="net-icep-menu">' + (beh ? '<div class="net-icep-sug">suggest: ' + esc(sysSuggest(beh, ic)) + '</div>' : '') +
                    '<div class="net-icep-acts">' + (ic.mobile ? '<button class="net-mini" data-ia="move" data-ice="' + esc(ic.id) + '">Move</button>' : '') +
                    '<button class="net-mini" data-ia="attack" data-ice="' + esc(ic.id) + '">Attack</button>' +
                    '<button class="net-mini" data-ia="wake" data-ice="' + esc(ic.id) + '">Wake</button>' +
                    '<button class="net-mini" data-ia="hold" data-ice="' + esc(ic.id) + '">Hold</button>' +
                    '<button class="net-mini" data-ia="rerez" data-ice="' + esc(ic.id) + '">Re-rez</button></div></div>' : '') +
                  '</div>';
              }).join('') : '<div class="net-fp-empty">No ICE placed. Sketch or edit the fort.</div>') + '</div>' +
              '<div class="net-run-h">Initiative</div><ol class="net-init">' + init.map(function (e) { return '<li class="net-init-' + e.kind + '">' + esc(e.label) + ' <span class="net-init-i">' + e.init + '</span></li>'; }).join('') + '</ol>' +
              gaugeHtml('DEPTH', run.depth, 'net-g-depth') +
              '<div class="net-run-h">Beats</div><div class="net-beats">' + (run.beats || []).slice(-8).reverse().map(function (b) { return '<div class="net-beat">' + esc(b.text) + '</div>'; }).join('') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="net-run-strip">' +
            '<span class="net-strip-depth">DEPTH <b>' + run.depth.v + '/' + run.depth.max + '</b> <button class="net-mini" data-dp="-1">−</button><button class="net-mini" data-dp="1">＋</button></span>' +
            '<span class="net-strip-trace">TRACE → ' + esc(myTargetLabel(run)) + ' <b>' + Math.round(run.trace.v / run.trace.max * 100) + '%</b> <button class="net-mini" data-tr="-1">−</button><button class="net-mini" data-tr="1">＋</button></span>' +
            (traceFull && cd == null ? '<span class="net-strip-cd">FULL — raid in <input class="net-in net-in-n" id="sy-cd" value="3" size="2"> rounds <button class="net-mini" data-armcd>Arm</button></span>' : '') +
            (cd != null ? '<span class="net-strip-cd">raid in <b>' + cd + '</b> round' + (cd === 1 ? '' : 's') + ' <button class="net-mini" data-cancelcd>cancel</button> <button class="dt-btn net-dispatch" data-dispatch>⚑ Dispatch now</button></span>' : '') +
            (run.dispatch ? '<span class="net-dispatch-note">Dispatch: ' + esc(run.dispatch.force) + ' → ' + esc(run.dispatch.district) + '</span>' : '') +
          '</div>' +
        '</div>';
      // wiring
      stage.querySelector('[data-end]').onclick = function () { endRun('jacked-out'); };
      stage.querySelector('[data-cast]').onclick = function () { castRun(run, d); };
      stage.querySelector('[data-next]').onclick = function () { nextRound(run, d); };
      var beh2 = stage.querySelector('#sy-beh'); if (beh2) beh2.onchange = function () { setRun({ aiBehavior: beh2.value, beats: runBeat(run, 'AI shifts to ' + beh2.value + '.') }); };
      var au = stage.querySelector('#sy-auto'); if (au) au.onchange = function () { setRun({ autoPlay: au.checked }); };
      stage.querySelectorAll('[data-ice]').forEach(function (b) { if (b.hasAttribute('data-ia')) return; b.onclick = function () { var id = b.getAttribute('data-ice'); _sysSelIce = (_sysSelIce === id ? null : id); _sysMoveIce = null; reRunStage(); }; });
      stage.querySelectorAll('[data-ia]').forEach(function (b) { b.onclick = function () { sysIceAct(run, d, b.getAttribute('data-ice'), b.getAttribute('data-ia')); }; });
      stage.querySelectorAll('[data-cell]').forEach(function (cell) { cell.onclick = function () { var key = cell.getAttribute('data-cell'); if (_sysMoveIce) { doMoveIce(run, d, _sysMoveIce, key); _sysMoveIce = null; } }; });
      stage.querySelectorAll('[data-dp]').forEach(function (b) { b.onclick = function () { var nv = Math.max(0, Math.min(run.depth.max, run.depth.v + (+b.getAttribute('data-dp')))); setRun({ depth: { v: nv, max: run.depth.max }, beats: runBeat(run, 'Depth ' + (nv > run.depth.v ? 'deepens' : 'lifts') + ' (' + nv + '/' + run.depth.max + ').') }); }; });
      stage.querySelectorAll('[data-tr]').forEach(function (b) { b.onclick = function () { var nv = Math.max(0, Math.min(run.trace.max, run.trace.v + (+b.getAttribute('data-tr')))); var tp = Object.assign({}, run.trace, { v: nv }); if (nv < run.trace.max) tp.countdown = null; setRun({ trace: tp, beats: runBeat(run, 'Trace ' + (nv > run.trace.v ? 'advances' : 'eases') + ' (' + nv + '/' + run.trace.max + ').') }); }; });
      var arm = stage.querySelector('[data-armcd]'); if (arm) arm.onclick = function () { var n = Math.max(1, parseInt(stage.querySelector('#sy-cd').value, 10) || 3); setRun({ trace: Object.assign({}, run.trace, { countdown: n }), beats: runBeat(run, 'Full trace — the owner musters. Raid in ' + n + ' rounds.') }); };
      var cc = stage.querySelector('[data-cancelcd]'); if (cc) cc.onclick = function () { setRun({ trace: Object.assign({}, run.trace, { countdown: null }), beats: runBeat(run, 'The raid is called off.') }); };
      var disp = stage.querySelector('[data-dispatch]'); if (disp) disp.onclick = function () { doDispatch(run, d); };
    });
  }
  // Spend one fort action (1 + ½CPU budget) — clamped; keeps the initiative roster honest.
  function fortSpend(run) { return { runner: run.actionsLeft.runner, fort: Math.max(0, (run.actionsLeft.fort || 0) - 1) }; }
  function sysIceAct(run, d, iceId, act) {
    var ic = iceOf(d, iceId); if (!ic) return;
    if (act === 'move') { if (!ic.mobile) { flashTool('that ICE is not mobile (⟳)'); return; } _sysMoveIce = iceId; reRunStage(); return; }
    if (act === 'attack') { ic.state = 'awake'; saveFort(run, d); setRun({ fort: d, actionsLeft: fortSpend(run), beats: runBeat(run, ic.name + ' strikes the runner — apply the hit at the table.') }); return; }
    if (act === 'wake') { ic.state = 'awake'; saveFort(run, d); setRun({ fort: d, beats: runBeat(run, ic.name + ' wakes.') }); return; }   // posture — free
    if (act === 'hold') { ic.state = 'dormant'; saveFort(run, d); setRun({ fort: d, beats: runBeat(run, ic.name + ' holds, dormant.') }); return; }   // posture — free
    if (act === 'rerez') { ic.state = 'awake'; saveFort(run, d); setRun({ fort: d, actionsLeft: fortSpend(run), beats: runBeat(run, ic.name + ' is re-rezzed.') }); return; }
  }
  // The runner's physical district — named in the TRACE (jeopardy of the body).
  function myTargetLabel(run) { var t = run.runnerSheetId && netTokens()[run.runnerSheetId]; return t ? (t + ' ' + districtName(t)) : 'your body'; }
  var _flashT2 = null;
  function flashTool(msg) { var old = document.getElementById('net-flash'); if (old) old.remove(); var el = eln('div', 'net-flash'); el.id = 'net-flash'; el.textContent = msg; document.body.appendChild(el); clearTimeout(_flashT2); _flashT2 = setTimeout(function () { el.remove(); }, 1500); }
  function nextRound(run, d) {
    var c = camp(); var runnerActions = 1; if (run.runnerSheetId && c && c.getSheet) { var s = c.getSheet(run.runnerSheetId); runnerActions = 1 + deckSpeed(s && s.json); }
    var beats = runBeat(run, 'Round ' + (run.round + 1) + '.');
    var patch = { round: run.round + 1, actionsLeft: { runner: runnerActions, fort: NetModel.actsOf(d) } };
    var cd = run.trace.countdown;   // raid countdown ticks down each round; 0 → the owner raids
    if (cd != null) {
      cd = cd - 1;
      patch.trace = Object.assign({}, run.trace, { countdown: Math.max(0, cd) });
      if (cd <= 0) { beats = (beats || []).concat([{ ts: netClock(), text: 'The raid lands — they hit the body now.' }]).slice(-30); }
      else beats = (beats || []).concat([{ ts: netClock(), text: 'Raid in ' + cd + ' round' + (cd === 1 ? '' : 's') + '.' }]).slice(-30);
    }
    patch.beats = beats;
    setRun(patch);
    if (cd != null && cd <= 0) doDispatch(Object.assign({}, run, patch), d);
    if (c && c.combatMeta && c.combatMeta() && c.combatMeta().active && c.setCombatMeta) { var m = c.combatMeta(); c.setCombatMeta(Object.assign({}, m, { round: (m.round || 1) + 1 })); }
  }
  function doMoveIce(run, d, iceId, key) { var ic = iceOf(d, iceId); if (!ic) return; var p = key.split(','), x = +p[0], y = +p[1]; if (ic.pos) sgSet(d.subgrid, ic.pos.x, ic.pos.y, 'empty'); ic.pos = { x: x, y: y }; sgSet(d.subgrid, x, y, 'ice', ic.id); saveFort(run, d); setRun({ fort: d, actionsLeft: fortSpend(run), beats: runBeat(run, ic.name + ' prowls to ' + key + '.') }); }
  function doDispatch(run, d) { var token = (run.runnerSheetId && netTokens()[run.runnerSheetId]) || '—'; var sug = NetCast.dispatchSuggestion({ datafort: d, tier: d.tier }, token); setRun({ dispatch: sug, beats: runBeat(run, 'DISPATCH suggested: ' + sug.force + ' → ' + sug.district) }); if (br().logSession) br().logSession('⚑ Dispatch: ' + sug.force + ' at ' + sug.district + ' — GM adjudicates.'); if (window.UI) UI.modal({ title: 'Dispatch — trace full', body: '<p>The fort’s owner sends <b>' + esc(sug.force) + '</b> to the runner’s physical position (<b>' + esc(sug.district) + '</b>).</p><p class="dt-hint">You adjudicate and narrate the scene — open combat in the combat section when they arrive.</p>', actions: [{ label: 'OK', kind: 'primary' }] }); }
  function siteRegionOf(d) { return ''; }
  function raiseNetEvent(type, subject, region) { var c = camp(); if (!c || !c.setOverview) return; var o = c.getOverview() || {}; var ev = (o.netEvents || []).concat([{ id: uid('nev'), type: type, subject: subject, region: region, when: netClock(), public: true }]).slice(-80); c.setOverview({ netEvents: ev }); }

  /* ⑤ RUN board — the runner's POV. Self-resolve: pick action + type your roll →
     it APPLIES immediately (no GM round-trip). Vision = raycast LOS (runGridHtml). */
  var _runBoardSel = null, _runBoardProg = null, _runAct = null, _runRoll = '';
  var RUN_ACTS = [['move', 'Move (5)'], ['deploy', 'Deploy'], ['read', 'Read'], ['scan', 'Scan'], ['jackout', 'Jack out']];
  function hasDetection(progs) { return (progs || []).some(function (p) { return /detect/i.test(((p.kw || []).join(' ')) + ' ' + (p.class || '') + ' ' + (p.name || '') + ' ' + (p.effect || '')); }); }
  function moveLegal(from, x, y, max) { if (!from) return true; var dx = x - from.x, dy = y - from.y; if (dx === 0 && dy === 0) return false; if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false; return Math.max(Math.abs(dx), Math.abs(dy)) <= max; }
  function pathClearOfWalls(sg, from, x, y) { if (!from) return !isWallAt(sg, x, y); var x0 = from.x, y0 = from.y, adx = Math.abs(x - x0), ady = Math.abs(y - y0), sx = x0 < x ? 1 : -1, sy = y0 < y ? 1 : -1, err = adx - ady, cx = x0, cy = y0; while (!(cx === x && cy === y)) { var e2 = 2 * err; if (e2 > -ady) { err -= ady; cx += sx; } if (e2 < adx) { err += adx; cy += sy; } if (isWallAt(sg, cx, cy)) return false; } return true; }
  function vgaugeHtml(label, g, opts) {
    opts = opts || {}; var v = (g && g.v) || 0, max = (g && g.max) || 6, pct = Math.min(100, Math.round(v / max * 100));
    return '<div class="net-vg net-vg-' + label.toLowerCase() + '"><div class="net-vg-l">' + esc(label) + '</div>' +
      '<div class="net-vg-bar"><span style="height:' + pct + '%"></span>' + (opts.pct ? '<b class="net-vg-p">' + pct + '%</b>' : '') + '</div>' +
      (opts.foot ? '<div class="net-vg-foot">' + opts.foot + '</div>' : '') + '</div>';
  }
  function progGlyph(p) {
    var s = ((p.class || '') + ' ' + ((p.kw || []).join(' ')) + ' ' + (p.name || '')).toLowerCase();
    if (/detect|watchdog|monitor|trace|track|alarm/.test(s)) return '⊚';
    if (/stealth|evasion|invis|cloak|hide|mask/.test(s)) return '◐';
    if (/wall|breach|intrus|hammer|crack|gate|break|decrypt|jack/.test(s)) return '◇';
    if (/data|file|util|copy|read|base/.test(s)) return '≡';
    if (/attack|kill|anti|combat|black|virus|worm|demon/.test(s)) return '✦';
    return '▸';
  }
  function traceStatusPhrase(pct) { return pct >= 100 ? 'they’re at your door' : pct >= 70 ? 'they’re closing' : pct >= 35 ? 'they’re onto you' : 'you’re a ghost'; }
  function deckStatsSafe(sheet) { try { return NetModel.deckStats(sheet && sheet.netrunner) || {}; } catch (e) { return {}; } }
  function renderRunPlayer(stage, run) {
    withRunFort(run, function (d) {
      if (activeTab().url !== '/run') return;
      var sheet = (camp() && camp().getSheet && camp().getSheet(run.runnerSheetId) || {}).json || {};
      var progs = runnerPrograms(sheet), left = run.actionsLeft.runner || 0, canAct = left > 0;
      var intv = (sheet.stats && (sheet.stats.INT || sheet.stats.int)) || 0, ds = deckStatsSafe(sheet);
      var tracePct = Math.min(100, Math.round(run.trace.v / run.trace.max * 100));
      var needsSel = _runAct === 'move' || _runAct === 'deploy' || _runAct === 'read';
      stage.innerHTML =
        '<div class="net-run net-run-pl">' +
          '<div class="net-run-top net-inv"><span class="net-run-t">RUN ▸ ' + esc((run.hostName || 'target').toUpperCase()) + '</span>' +
            '<span class="net-run-sp"></span><span class="net-run-rd">round ' + run.round + ' · ' + left + ' action' + (left === 1 ? '' : 's') + ' left</span>' +
            '<span class="net-run-sp"></span><span class="net-run-body-l">● your body: ' + esc(myTargetLabel(run)) + ' — ' + esc(traceStatusPhrase(tracePct)) + '</span></div>' +
          '<div class="net-run-stage">' +
            '<div class="net-run-left net-a-soft"><div class="net-run-h">Software</div>' +
              (progs.length ? progs.map(function (p, i) { return '<button class="net-prog' + (_runBoardProg === i ? ' on' : '') + '" data-prog="' + i + '" title="' + esc(p.effect || '') + '"><span class="net-prog-g">' + progGlyph(p) + '</span><span class="net-prog-n">' + esc(p.name) + '</span><span class="net-prog-s">S' + (p.str || 0) + '</span></button>'; }).join('') : '<div class="net-fp-empty">No programs loaded.</div>') +
              '<div class="net-mu">MU ' + (ds.loadedMu || 0) + ' / ' + (ds.memoryMU || 0) + '</div>' +
              '<div class="net-run-h net-body-h">Body</div><div class="net-body-tally">◈ INT ' + intv + '</div>' +
              '<div class="net-body-note">a black-ICE hit hits YOU, not the deck.</div></div>' +
            '<div class="net-pov">' +
              vgaugeHtml('DEPTH', run.depth, {}) +
              '<div class="net-run-gridwrap"><div class="net-pov-cap">raycast — you see 20. walls block. the fort runs past your sight.</div>' + runGridHtml(run, d, true) + '<div class="net-pov-count">' + run.depth.v + '/' + run.depth.max + '</div></div>' +
              vgaugeHtml('TRACE', run.trace, { pct: true, foot: '→ a line coming<br>for your body' }) + '</div>' +
            '<div class="net-run-right net-a-log"><div class="net-run-h">Log</div>' +
              '<div class="net-beats">' + (run.beats || []).slice(-14).reverse().map(function (b, i) { return '<div class="net-beat' + (i === 0 ? ' net-beat-top' : '') + '">' + (i === 0 ? '' : '▸ ') + esc(b.text) + '</div>'; }).join('') + '</div>' +
              '<div class="net-log-foot">newest on top · your run, narrated.</div></div>' +
            '<div class="net-run-turn' + (canAct ? '' : ' net-turn-off') + '"><span class="net-turn-l">Your turn</span>' +
              '<div class="net-turn-act' + (_runAct ? '' : ' net-turn-act-empty') + '">' + (_runAct ? esc(actLabel(_runAct, progs)) + (needsSel && !_runBoardSel ? ' — pick a cell' : '') : 'pick an action ▸') + '</div>' +
              '<span class="net-turn-roll-l">you rolled</span><input class="net-turn-in" id="rp-roll" value="' + esc(_runRoll) + '">' +
              '<button class="net-turn-go" data-resolve' + (canAct && _runAct ? '' : ' disabled') + '>▸ Resolve — it’s done</button>' +
              '<div class="net-turn-alt">or ' + RUN_ACTS.map(function (a) { return '<button class="net-alt' + (_runAct === a[0] ? ' on' : '') + '" data-act="' + a[0] + '">' + a[1] + '</button>'; }).join(' · ') + ' — you play, you enter the die, it lands.</div></div>' +
          '</div>' +
        '</div>';
      stage.querySelectorAll('[data-prog]').forEach(function (b) { b.onclick = function () { _runBoardProg = +b.getAttribute('data-prog'); reRunStage(); }; });
      stage.querySelectorAll('[data-cell]').forEach(function (cell) { cell.onclick = function () { _runBoardSel = cell.getAttribute('data-cell'); reRunStage(); }; });
      stage.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function () { _runAct = b.getAttribute('data-act'); reRunStage(); }; });
      var ri = stage.querySelector('#rp-roll'); if (ri) { ri.oninput = function () { _runRoll = ri.value; }; ri.onkeydown = function (e) { if (e.key === 'Enter') applyRunnerAction(run, d, progs); }; }
      var rg = stage.querySelector('[data-resolve]'); if (rg) rg.onclick = function () { applyRunnerAction(run, d, progs); };
    });
  }
  function actLabel(act, progs) {
    var prog = _runBoardProg != null ? progs[_runBoardProg] : null;
    if (act === 'move') return 'Move to ' + (_runBoardSel || 'a cell') + ' — up to 5, straight';
    if (act === 'deploy') return 'Deploy ' + (prog ? progGlyph(prog) + ' ' + prog.name : 'a program') + ' → ' + (_runBoardSel || 'a cell');
    if (act === 'read') return 'Read the file at ' + (_runBoardSel || 'a cell');
    if (act === 'scan') return 'Scan (Detection) — reveal cloaked ICE in sight';
    if (act === 'jackout') return 'Jack out — leave the fort';
    return act;
  }
  function applyRunnerAction(run, d, progs) {
    var sg = d.subgrid, sel = _runBoardSel, prog = _runBoardProg != null ? progs[_runBoardProg] : null;
    var roll = (_runRoll || '').trim(), rt = roll ? ' · rolled ' + roll : '';
    // Jack out is the escape valve — always allowed, even at 0 actions.
    if (_runAct === 'jackout') { setRun({ beats: runBeat(run, 'Jacks out' + rt + '.') }); endRun('jacked-out'); _runAct = null; _runRoll = ''; return; }
    if (!_runAct) { flashTool('choose an action'); return; }
    if ((run.actionsLeft.runner || 0) <= 0) { flashTool('no actions left — the sysop advances the round'); return; }
    var patch = { actionsLeft: { runner: (run.actionsLeft.runner - 1), fort: run.actionsLeft.fort } };
    if (_runAct === 'move') {
      if (!sel) return flashTool('pick a destination cell');
      var mp = sel.split(','), mx = +mp[0], my = +mp[1];
      if (!moveLegal(run.runnerPos, mx, my, 5)) return flashTool('move is up to 5 cells in a straight line');
      if (!pathClearOfWalls(sg, run.runnerPos, mx, my)) return flashTool('a data wall blocks that path');
      patch.runnerPos = { x: mx, y: my };
      patch.remembered = rememberUnion(run.remembered, losVisible(sg, { x: mx, y: my }, LOS_RADIUS));
      patch.beats = runBeat(run, 'Moved to ' + mx + ',' + my + '.');
    } else if (_runAct === 'deploy') {
      if (prog == null) return flashTool('pick a program from Software');
      if (!sel) return flashTool('pick a target cell');
      patch.beats = runBeat(run, 'Deploy ' + prog.name + ' → ' + sel + rt + '.');
    } else if (_runAct === 'read') {
      if (!sel) return flashTool('pick a cell');
      var rp = sel.split(','), rc = sgAt(sg, +rp[0], +rp[1]);
      if (!rc || rc.kind !== 'file') return flashTool('no file on that cell');
      patch.beats = runBeat(run, 'Read the file at ' + sel + rt + '.');
    } else if (_runAct === 'scan') {
      if (!hasDetection(progs)) return flashTool('no Detection program loaded');
      var vis = losVisible(sg, run.runnerPos, LOS_RADIUS), rv = Object.assign({}, run.reveal || {}), found = 0;
      (d.ice || []).forEach(function (ic) { if (ic.pos && vis[ic.pos.x + ',' + ic.pos.y]) { rv[ic.id] = true; found++; } });
      patch.reveal = rv; patch.beats = runBeat(run, 'Scan sweeps — ' + found + ' ICE picked out' + rt + '.');
    } else return flashTool('choose an action');
    _runRoll = ''; setRun(patch);
  }

  /* ⑥ CAST — a stripped view pushed to the shared screen (two gauges + last beat). */
  function castRun(run, d) {
    var last = (run.beats || []).slice(-1)[0];
    var txt = (run.hostName || 'FORT').toUpperCase() + ' — ' + (run.runnerName || 'runner') + '\n\nDEPTH ' + run.depth.v + '/' + run.depth.max + '   ·   TRACE ' + run.trace.v + '/' + run.trace.max + '\n\n' + (last ? '“' + last.text + '”' : '');
    NetCast.reveal({ kind: 'event', title: 'NETRUN', blocks: [{ type: 'text', body: txt }] });
    if (br().logSession) br().logSession('⑥ Cast the run to the table.');
  }

  // The player's run auto-surfaces (flips the web section to /run) when the GM jacks
  // them in — once per run. Called from ensureRuntime's overview subscription.
  var _surfacedRunId = null;
  function maybeOpenPlayerRun() {
    if (!isPlayer()) return; var run = getRun();
    if (run && run.status === 'active' && run.runnerSheetId === mySheetId()) {
      if (_surfacedRunId !== run.id) { _surfacedRunId = run.id; gotoRun(); }
    } else _surfacedRunId = null;
  }
  // GM side: a run going active (esp. a player self-jack) flips the GM to the SYSOP once,
  // and — if the GM later navigates away mid-run — a persistent, clickable banner stays up.
  var _gmSurfacedRunId = null, _gmRunBanner = null;
  function onRunTab() { return !!(_tabs && activeTab && activeTab().url === '/run' && document.getElementById('web-stage')); }
  function maybeSurfaceGmRun() {
    if (isPlayer()) return; var run = getRun(), active = run && run.status === 'active';
    if (active) { if (_gmSurfacedRunId !== run.id) { _gmSurfacedRunId = run.id; if (!onRunTab()) gotoRun(); } }
    else _gmSurfacedRunId = null;
    refreshGmRunBanner();
  }
  function refreshGmRunBanner() {
    if (isPlayer()) { if (_gmRunBanner) { _gmRunBanner.remove(); _gmRunBanner = null; } return; }
    var run = getRun(), show = run && run.status === 'active' && !onRunTab();
    if (!show) { if (_gmRunBanner) { _gmRunBanner.remove(); _gmRunBanner = null; } return; }
    if (!_gmRunBanner) { _gmRunBanner = eln('button', 'net-gm-runbar'); document.body.appendChild(_gmRunBanner); _gmRunBanner.onclick = function () { gotoRun(); }; }
    _gmRunBanner.innerHTML = '▸ RUN — ' + esc(run.runnerName || 'runner') + ' in ' + esc(run.hostName || 'a fort') + ' · open SYSOP ▸';
  }

  // Shared run-grid renderer.
  //   masked=true  (player) → raycast LOS: cells in sight = live; once-seen = remembered
  //                            (pale); never seen = fog. Walls project shadow.
  //   masked=false (GM/SYSOP) → the whole fort, plus a `los` marker on what the runner sees.
  function runGridHtml(run, d, masked) {
    var sg = d.subgrid, w = sg.w || 12, h = sg.h || 12, idx = sgLabelIndex(sg), reveal = run.reveal || {}, pos = run.runnerPos, cells = '';
    var vis = losVisible(sg, pos, LOS_RADIUS), remembered = run.remembered || {};
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = sgAt(sg, x, y), key = x + ',' + y, isPos = pos && pos.x === x && pos.y === y, cls = 'net-rg-c', inner = '', hvx = '';
      var inSight = !!vis[key], mem = !inSight && !!remembered[key];
      if (masked && !inSight && !mem) { cls += ' net-rg-fog'; cells += '<button class="' + cls + '" data-cell="' + key + '"></button>'; continue; }
      if (masked && mem) cls += ' net-rg-mem';                 // remembered — you know what was here, not what's here now
      if (!masked && inSight) cls += ' net-rg-los';            // GM: dotted contour of the runner's sight
      if (c) {
        if (c.kind === 'ice') {
          var ic = iceOf(d, c.ref);
          var cloaked = ic && (ic.cloaked || ic.hidden);       // cloaked ICE stays invisible until scanned
          var ident = !masked || reveal[c.ref];
          if (masked && cloaked && !reveal[c.ref] && !mem) { /* invisible: render as empty in-sight cell */ }
          else {
            cls += ' net-rg-ice' + (ident && ic && ic.blackIce ? ' net-rg-black' : '') + (!masked && ic && ic.state === 'awake' ? ' net-rg-awake' : '');
            inner = cellInnerHtml('ice', idx[key], { ident: ident });
            hvx = hv(ident && ic ? ('<b>☠ ' + esc(ic.name) + (ic.blackIce ? ' — Black ICE' : '') + ' · S' + ic.str + '</b><br>' + esc(ic.class) + (ic.mobile ? '<br>⟳ mobile — patrols, gives chase' : '') + (!masked ? '<br>state: ' + iceStateLabel(ic) : '')) : '<b>☠ ICE</b><br>unidentified — scan to ID');
          }
        } else {
          cls += ' net-rg-' + c.kind; inner = cellInnerHtml(c.kind, idx[key], {});
          hvx = hv(c.kind === 'core' ? '<b>▲ CPU / core</b><br>Black Ops — the prize' : c.kind === 'node' ? '<b>▢ Node ' + (idx[key] || '') + '</b>' : c.kind === 'gate' ? '<b>⊗ Code gate</b>' : c.kind === 'file' ? '<b>☰ File</b>' : c.kind === 'wall' ? '<b>█ Data wall</b>' : c.kind === 'remote' ? '<b>⊡ Remote</b>' : '');
        }
      }
      if (isPos) { cls += ' net-rg-pos'; inner += '<span class="net-rg-run">◉</span>'; }
      cells += '<button class="' + cls + '" data-cell="' + key + '"' + hvx + '>' + inner + '</button>';
    }
    // --gf-* (fade pitch/reach) set per role in CSS so the extension aligns with the cell size.
    return '<div class="net-grid-field net-run-field"><div class="net-rg" style="grid-template-columns:repeat(' + w + ',1fr)">' + cells + '</div></div>';
  }

  window.WebSection = {
    renderHome: renderHome, renderEditor: renderEditor, renderBrowser: renderBrowser, renderHosts: renderHosts,
    renderSite: renderSite, renderSiteResolved: renderSiteResolved, blockRegistry: blockRegistry, themeCss: themeCss, blankSite: blankSite,
    renderAtlas: renderAtlas, openFortEditor: openFortEditor, newAutonomousFort: newAutonomousFort,
  };

  // Wire the runtime (run auto-surface, delivery settling) as soon as a session is live —
  // NOT lazily on first Net render. Otherwise a player sitting on their sheet when the GM
  // jacks them in never gets surfaced into the run. Poll until the camp is ready after join.
  if (window.App && App.on) App.on('campaign', function () { var t = 0; (function poll() { ensureRuntime(); if (!_runtime && t++ < 25) setTimeout(poll, 300); })(); });
})();
