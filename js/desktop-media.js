/* desktop-media.js — MEDIA SUITES for the in-world Desktop OS.
   ───────────────────────────────────────────────────────────────────────────
   Five bespoke media applications ("suites"), registered as self-contained
   plugins on the delivered Desktop SDK (js/app-desktop.js). NOTHING in the OS
   kernel is edited — this file only calls Desktop.registerApp(...). It uses
   ONLY public APIs: the per-app `sdk` (store/sheet/files/notify/open/web/shell),
   window.Store, window.App, and camp() via sdk.shell.bridge().sess.camp.

   Model: ONE investigation CASE, many LENSES (non-destructive projections).
   The app NEVER rolls dice — it ingests table results and simulates fallout.
   Investigation is open to everyone; only PUBLISHING reach is Credibility-gated
   (CP2020 Media Special Ability, read from the sheet). See docs/media-app-design.md.

   Increment A (this file so far): registration + newsroom shell + case CRUD +
   LIENS board + DOSSIER. CHRONO/SOURCES/HEAT/CARTE/MONTAGE/WAR + publish + the
   Settle-the-Cycle sim land in later increments (stubbed here, OBJECTIF works). */
(function () {
  'use strict';
  if (!window.Desktop || !window.Desktop.registerApp) return;   // needs the OS SDK
  var App = window.App, Store = window.Store;

  /* ═══════════════ helpers ═══════════════ */
  function esc(s) { return App && App.esc ? App.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eln(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function uid(p) { return (App && App.uid ? App.uid(p) : (p || 'x') + '_' + Math.floor((Date.now() % 1e7) + Object.keys({}).length)); }
  function clampn(v, lo, hi) { v = +v; if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
  function nowStamp() { return Date.now(); }

  function br(sdk) { return (sdk && sdk.shell && sdk.shell.bridge && sdk.shell.bridge()) || {}; }
  function camp(sdk) { var s = br(sdk).sess; return s && s.camp; }
  function sid(sdk) { var s = br(sdk).sess; if (!s) return null; return br(sdk).idOf ? br(sdk).idOf(s.sheetId) : s.sheetId; }
  function isGM(sdk) { return !sdk.isPlayer; }

  /* per-user media state, shared across all five suites (mirrors app-desktop dtRead/dtWrite) */
  function mediaRead(sdk) {
    if (sdk.isPlayer) { var j = sdk.sheet(); if (!j) return {}; j.net = j.net || {}; return (j.net.media = j.net.media || {}); }
    return App.uiGet('media', {}) || {};
  }
  function mediaWrite(sdk, mut) {
    if (sdk.isPlayer) {
      var j = sdk.sheet(); if (!j) return; j.net = j.net || {}; j.net.media = j.net.media || {};
      mut(j.net.media);
      var c = camp(sdk); if (c && c.publishSheet) c.publishSheet(sid(sdk), j.handle || j.name || 'PC', j);
    } else { var d = App.uiGet('media', {}) || {}; mut(d); App.uiSet('media', d); }
  }

  /* Credibility = CP2020 Media Special Ability (0-10), read-only. GM = full authority. */
  function credibilityOf(sdk, who) {
    if (!sdk.isPlayer) return 10;
    var c = camp(sdk), rec = c && c.getSheet && c.getSheet(who || sid(sdk));
    var sa = rec && rec.json && rec.json.specialAbilities;
    return clampn((sa && (sa['Credibility'] | 0)) || 0, 0, 10);
  }

  /* thin generic bank-credit (not a fork of the Net economy; used for suite income) */
  function creditOwner(sdk, ownerSid, amt, label, accountId) {
    var c = camp(sdk); if (!c || !c.getSheet) return false;
    var rec = c.getSheet(ownerSid); var j = rec && rec.json; if (!j) return false;
    var ls = j.lifestyle = j.lifestyle || {}; var accs = ls.accounts = ls.accounts || [];
    if (!accs.length) return false;
    var acc = null, i; for (i = 0; i < accs.length; i++) { if (accs[i].id === accountId) { acc = accs[i]; break; } }
    if (!acc) acc = accs[0];
    acc.balance = (+acc.balance || 0) + amt;
    acc.ledger = acc.ledger || []; acc.ledger.unshift({ id: uid('tx'), type: amt >= 0 ? 'income' : 'expense', label: label || 'media', amount: amt });
    if (c.publishSheet) c.publishSheet(ownerSid, j.handle || j.name || 'PC', j);
    return true;
  }

  /* minimal ⟦type:id|label⟧ mention renderer (local; no app-web private helpers) */
  var MENTION_RE = /⟦([a-z]+):([^|⟧]+)(?:\|([^⟧]*))?⟧/g;
  function richText(str) {
    var out = esc(str || '');
    out = out.replace(MENTION_RE, function (_, t, id, label) { return '<span class="dm-chip" data-type="' + esc(t) + '" data-id="' + esc(id) + '">' + esc(label || id) + '</span>'; });
    return out.replace(/\n/g, '<br>');
  }

  function netClock(sdk) { try { var c = camp(sdk); var o = c && c.getOverview && c.getOverview(); return (o && o.netClock) | 0 || 0; } catch (e) { return 0; } }

  /* ═══════════════ case model ═══════════════ */
  function blankCase(name, owner, media) {
    return {
      id: uid('case'), kind: 'case', name: name || 'Untitled case', subtitle: '',
      owner: owner || null, media: !!media, known: false, props: { public: false }, subject: null,
      track: 'investigation',
      created: nowStamp(), updated: nowStamp(),
      nodes: [], links: [], sources: [], claims: [],
      heat: { level: 0, rung: 0, adversaries: [], shields: [], pleas: [] },
      stories: [],
      view: { lens: 'liens', sel: null, pan: { x: 0, y: 0 }, zoom: 1, timeline: { lane: 'kind', playhead: null }, sources: { filter: 'all' }, heat: { root: null }, carte: { center: null, zoom: 12 }, war: { front: 'stance' } }
    };
  }
  function listCases(sdk) { var m = mediaRead(sdk); return (m.cases || []).slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }); }
  function loadCase(sdk, id) { var m = mediaRead(sdk); return (m.cases || []).filter(function (c) { return c.id === id; })[0] || null; }
  function saveCase(sdk, cs) {
    cs.updated = nowStamp();
    mediaWrite(sdk, function (m) {
      m.cases = m.cases || []; var i = -1, k; for (k = 0; k < m.cases.length; k++) { if (m.cases[k].id === cs.id) { i = k; break; } }
      if (i >= 0) m.cases[i] = cs; else m.cases.push(cs);
    });
  }
  function newCase(sdk, name, media) { var cs = blankCase(name, sid(sdk), media); saveCase(sdk, cs); return cs; }
  function deleteCase(sdk, id) { mediaWrite(sdk, function (m) { if (m.cases) m.cases = m.cases.filter(function (c) { return c.id !== id; }); }); }

  function nodeById(cs, id) { for (var i = 0; i < cs.nodes.length; i++) if (cs.nodes[i].id === id) return cs.nodes[i]; return null; }
  function linksOf(cs, nid) { return cs.links.filter(function (l) { return l.from === nid || l.to === nid; }); }
  function addNode(cs, o) {
    var n = { id: uid('n'), kind: o.kind || 'note', ref: o.ref || null, label: o.label || 'Untitled', img: o.img || '', note: o.note || '', when: o.when != null ? o.when : null, where: o.where || null, source: null, cred: o.cred || 0, heat: { legal: 0, threat: 0, adversary: null }, verify: 'unverified', dropped: false, tags: [], x: o.x != null ? o.x : 120 + (cs.nodes.length % 6) * 40, y: o.y != null ? o.y : 120 + Math.floor(cs.nodes.length / 6) * 30 };
    cs.nodes.push(n); return n;
  }
  function addLink(cs, from, to, kind) {
    if (from === to) return null;
    var l = { id: uid('l'), from: from, to: to, kind: kind || 'custom', label: '', cred: 0, directed: true, active: false };
    cs.links.push(l); return l;
  }

  var NODE_KINDS = ['entity', 'claim', 'note', 'evidence', 'event', 'place', 'source'];
  var NODE_GLYPH = { entity: '❑', claim: '“', note: '▤', evidence: '▣', event: '◷', place: '◎', source: '❋' };
  var LINK_KINDS = ['knows', 'employs', 'funds', 'owns', 'met', 'located-at', 'caused', 'contradicts', 'corroborates', 'alias', 'custom'];

  /* ═══════════════ economy + publish pipeline (public APIs only) ═══════════════ */
  function prodBump(q) { return q === 'high' ? 0.4 : q === 'med' ? 0.2 : 0; }
  function mediaTrust() { var w = App.uiGet('web', {}) || {}; return (w.mediaTrust == null ? 100 : w.mediaTrust); }
  function powerGate(story, cfg) {
    var s = +story.sensationalism || 0;
    var g = 1 + 0.06 * s * ((cfg.cred && cfg.cred.sensationalismReward) || 1) + prodBump(story.productionQuality) + (cfg.publish.licensed ? 0.25 : 0);
    return clampn(g, 0.5, 2.0) * (cfg.publish.licensed ? 1 : 0.5);
  }
  function credReach(sdk, cfg) { var c = cfg.cred || {}; if (c.decoupled) return c.credBase || 1.0; return (c.credBase || 0.5) + (c.reachCoeff || 0.11) * credibilityOf(sdk); }
  function confirmedSources(cs, story) { var n = 0; (story.sources || []).forEach(function (id) { var nd = nodeById(cs, id); if (nd && nd.cred >= 2) n++; }); return n; }
  function initialBuzz(sdk, cfg, cs, story) {
    var t = mediaTrust(), track = story.track || (cs && cs.track) || 'investigation';
    var base = 200 * powerGate(story, cfg) * (0.5 + 0.5 * t / 100), cr = (cfg.cred || {}), r;
    if (track === 'opinion') r = base * ((cr.credBase || 0.5) + ((cr.reachCoeff || 0.11) + 0.07) * credibilityOf(sdk)) * (1 + 0.08 * (story.conviction || 0));
    else if (track === 'sensation') r = base * 1.25 * (1 + 0.12 * (story.sensationalism || 0)) * (0.6 + 0.08 * (story.subjectFame || 5));
    else if (track === 'broadcast') r = base * ((cr.credBase || 0.5) + (cr.reachCoeff || 0.11) * credibilityOf(sdk)) * 1.4;
    else r = base * credReach(sdk, cfg) * (1 + 0.05 * confirmedSources(cs, story));
    if (story.commissioned) r = r * (story.disclosed ? 0.7 : 1.15);
    return Math.round(r);
  }
  function credBar(c) { c = c | 0; var s = ''; for (var i = 0; i < 3; i++) s += (i < c ? '▪' : '▫'); return s; }

  function storyBlocks(story, sdk, cfg) {
    var j = sdk.sheet && sdk.sheet(), author = (j && (j.handle || j.name)) || '';
    var b = [];
    b.push({ id: uid('b'), type: 'header', title: story.headline || '(untitled)', tagline: story.dek || '', size: 'l', rule: true, accent: true });
    b.push({ id: uid('b'), type: 'text', body: (author ? 'By ' + author + ' · ' : '') + cfg.label + ' · ' + (story.broadcast || ''), size: 's', mono: true });
    if (story.dramaticRecreation) b.push({ id: uid('b'), type: 'text', body: '▲ DRAMATIC RECREATION ▼', align: 'center', size: 's' });
    b.push({ id: uid('b'), type: 'text', body: story.body || '', mono: story.postType === 'dump' });
    b.push({ id: uid('b'), type: 'board', title: 'Comments' });
    return b;
  }

  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function mediaOutlets(cb) {
    try { Promise.resolve(Store.index('site')).then(function (list) { cb((list || []).filter(function (r) { return r.json && r.json.app === 'press'; })); }, function () { cb([]); }); }
    catch (e) { cb([]); }
  }
  // Single most-important reason a post can't go to an outlet (by priority), or null if OK.
  function outletCompat(oj, draft, sdk, cs) {
    var ac = oj.appConfig || {};
    if (sdk.isPlayer) {
      var pol = ac.submit || 'media', cr = credibilityOf(sdk);
      if (pol === 'gm') return 'staff only';
      if (pol === 'media' && cr < 1) return 'media only';
      if (typeof pol === 'string' && pol.indexOf('cred') === 0) { var need = parseInt(pol.slice(4), 10) || 1; if (cr < need) return 'needs Cred ≥ ' + need; }
    }
    var formats = (ac.formats && ac.formats.length) ? ac.formats : ['article'];
    if (formats.indexOf(draft.postType) < 0) return 'no ' + draft.postType;
    if (ac.requireSources && confirmedSources(cs, draft) < ac.requireSources) return 'needs ' + ac.requireSources + ' source' + (ac.requireSources > 1 ? 's' : '');
    return null;
  }
  function openArticle(sdk, siteId, postId) { try { if (sdk.open) sdk.open('browser', siteId ? { siteId: siteId, postId: postId || undefined } : undefined); else if (sdk.shell && sdk.shell.openTool) sdk.shell.openTool('web-home'); } catch (e) {} }
  function deletePublished(sdk, story, cb) {
    var c = camp(sdk);
    if (c && c.getNetPosts && c.setNetBoard && story.publishedSiteId) {
      var key = story.publishedSiteId + ':feed:' + slugify(story.publishedSection || 'front');
      c.setNetBoard(key, (c.getNetPosts(key) || []).filter(function (p) { return p.id !== story.postId; }));
    }
    mediaWrite(sdk, function (mm) { (mm.cases || []).forEach(function (cs2) { if (cs2.stories) cs2.stories = cs2.stories.filter(function (s) { return s.id !== story.id; }); }); });
    if (cb) cb();
  }
  // Publish a story ONTO a GM-authored press outlet — the media publishes on their sites.
  function publishStory(sdk, cfg, cs, story, onDone) {
    var track = story.track || (cs && cs.track) || 'investigation';
    var reachSeed = initialBuzz(sdk, cfg, cs, story);
    var _conf = confirmedSources(cs, story), _tot = (story.sources || []).length;
    var reachParts = { track: track };
    if (track === 'investigation') { var _pg = powerGate(story, cfg), _cr = credReach(sdk, cfg), _src = 1 + 0.05 * _conf, _tr = 0.5 + 0.5 * mediaTrust() / 100; reachParts = { track: track, base: 200, power: Math.round(_pg * 100) / 100, cred: Math.round(_cr * 100) / 100, sourcing: Math.round(_src * 100) / 100, trust: Math.round(_tr * 100) / 100 }; }
    var rating = track === 'investigation' ? (_conf >= 2 ? 'verified' : (_conf >= 1 ? 'developing' : 'unconfirmed')) : (track === 'sensation' ? (story.dramaticRecreation ? 'recreation' : 'unconfirmed') : (track === 'opinion' ? 'op-ed' : 'developing'));
    if (story.commissioned && story.disclosed === false) rating = 'unconfirmed';
    var target = story.targetJson;
    if (!target) { sdk.notify('Pick a press outlet to publish to — the GM creates press sites in the Net.'); return; }
    var c = camp(sdk); if (!c || !c.putNetPost) { sdk.notify('No live session — can’t publish.'); return; }
    var section = story.targetSection || ((target.appConfig && target.appConfig.sections) || ['Front'])[0];
    var key = target.id + ':feed:' + slugify(section);
    var j = sdk.sheet && sdk.sheet(), author = (j && (j.handle || j.name)) || cfg.label;
    var postId = uid('st'); c.putNetPost(key, { id: postId, kind: 'story', handle: author, authorSid: sid(sdk), headline: story.headline, dek: story.dek || '', body: story.body || '', format: story.postType, track: track, rating: rating, srcConfirmed: _conf, srcTotal: _tot, sponsored: !!story.commissioned, disclosed: story.disclosed !== false, reach: reachSeed, reachParts: reachParts, buzz: 0, ts: nowStamp() });
    target.buzz = (target.buzz || 0) + Math.round(reachSeed / 40); target.lastEdit = nowStamp();
    try { Promise.resolve(Store.put({ type: 'site', id: target.id }, target)); } catch (e) {}
    story.publishedSiteId = target.id; story.publishedSection = section; story.reachSeed = reachSeed; story.postId = postId; story.outletName = target.name;
    cs.stories = cs.stories || []; cs.stories.push(story);
    // Contracts on the Press Card: a filed piece fills a staff quota, pays staff per-piece, and
    // attaches to a fee contract — paid now if "on delivery", or at Settle if it's reach/likes/comments-gated.
    if (j && j.press && j.press.contracts && c.publishSheet) {
      var cts = j.press.contracts, paid = 0;
      var staff = cts.filter(function (ct) { return ct.mode === 'staff' && ct.status !== 'ended'; })[0];
      if (staff) {
        staff.filled = (parseInt(staff.filled, 10) || 0) + 1;
        if (parseInt(staff.pay, 10)) { paid += creditSheet(j, parseInt(staff.pay, 10), 'Staff pay — ' + (story.headline || 'piece')); }
      }
      var link = cts.filter(function (ct) { return ct.mode === 'advertorial' && ct.status !== 'ended' && !ct.articlePostId && ct.caseId === cs.id; })[0]
        || cts.filter(function (ct) { return (ct.mode === 'adregie' || ct.mode === 'advertorial') && ct.status !== 'ended' && !ct.articlePostId && !ct.caseId; })[0];
      if (link) {
        link.articlePostId = postId; link.articleKey = key; link.articleOutlet = target.id;
        var po = link.payout || { metric: 'onPublish' };
        if ((!po.metric || po.metric === 'onPublish') && parseInt(link.fee, 10)) { var _lp = creditSheet(j, parseInt(link.fee, 10), 'Contract fee — ' + (link.client || story.headline || 'piece')); paid += _lp; if (_lp) link.paid = true; } // only mark paid if it actually landed; else Settle pays it once an account exists
      }
      c.publishSheet(sid(sdk), j.handle || j.name || 'PC', j);
      var _q = staff ? (parseInt(staff.quota, 10) || 0) : 0;
      if (paid) sdk.notify('Filed — paid ' + money(paid) + '.' + (staff && _q ? ' Quota ' + staff.filled + '/' + _q + '.' : ''));
      else if (staff) sdk.notify(_q && staff.filled >= _q ? 'Filed — staff quota met (' + staff.filled + '/' + _q + ').' : 'Filed toward your staff quota (' + staff.filled + (_q ? '/' + _q : '') + ').');
      else if (link) sdk.notify('Filed under your ' + (link.client || 'contract') + ' — ' + (link.mode === 'adregie' ? cpmLabel(link.cpm) + ', settles as views grow' : 'fee ' + payoutLabel(link.payout)) + '.');
    }
    if (App && App.emit) App.emit('entity:saved', { type: 'site', id: target.id });
    openArticle(sdk, target.id, postId);
    onDone && onDone(story, target.id);
  }

  /* ── the Settle-the-Cycle tick (GM only; ingest results → simulate fallout, no dice) ── */
  var COMMENTS = {
    loyal: ['Finally someone tells it straight.', 'The Network never lies.', 'Proud to watch this.'],
    astroturf: ['Everyone I know agrees.', 'This is the real story.', 'Wake up, people.'],
    skeptic: ['Who is paying for this?', 'Sources? I will wait.', 'Convenient timing.'],
    cynical: ['Nothing will change.', 'A corp owns them too, probably.', 'Saving this before it is scrubbed.'],
    grateful: ['You people are the only ones left.', 'Donated. Keep going.', 'This took guts.'],
    threatened: ['Delete this before they find you.', 'Careful out there.', 'They are watching this thread.'],
    paranoid: ['Mirror it now.', 'This will be gone by morning.', 'Trust no relay.'],
    zealot: ['The truth is a weapon.', 'Bartmoss lives.', 'Burn it all down.'],
    debunker: ['Half of this is fabricated.', 'Chain of custody?', 'Screenshots or it did not happen.'],
    thirsty: ['No way.', 'Need the full clip.', 'Who IS she.'],
    outrage: ['This is disgusting.', 'Cancel them.', 'I cannot look away.'],
    stan: ['Obsessed.', 'Replaying forever.', 'Icon behaviour.'],
    'fired-up': ['To the streets.', 'We move at dawn.', 'Count me in.'],
    scared: ['This is how people disappear.', 'Stay safe.', 'Do not show your face.'],
    informer: ['Where is the next broadcast?', 'Just asking who runs this.', 'Location?'],
    reader: ['Interesting.', 'Noted.', 'Following this.']
  };
  var _cmI = 0;
  function cannedComment(pool) { var a = COMMENTS[pool] || COMMENTS.reader; return a[_cmI++ % a.length]; }
  function settleCycle(sdk, cfg, onLog) {
    var pools = (cfg && cfg.commentPools) || ['reader'];
    try {
      Promise.resolve(Store.index('site')).then(function (all) {
        var n = 0, seeded = 0, c = camp(sdk);
        (all || []).forEach(function (r) {
          var s = (r && r.json) || r; if (!s || !s.id) return;
          if (s.app !== 'press') return;                               // press outlets only (matches mediaOutlets / the whole layer)
          n++;
          s.credibility = clampn((s.credibility || 0) + 5, 0, 100);     // recovery drift (ingested deltas add on top elsewhere)
          s.buzz = Math.round((s.buzz || 0) * 0.6);                     // a cycle's fade
          if (c && c.putNetPost && c.getNetPosts) {
            // Seed reader comments on stories with traction — on the SAME feed key + shape the press engine reads.
            var secs = (s.appConfig && s.appConfig.sections) || ['Front'];
            secs.forEach(function (secName) {
              var key = s.id + ':feed:' + slugify(secName), posts = c.getNetPosts(key) || [];
              posts.filter(function (p) { return p.kind === 'story'; }).forEach(function (story) {
                if (((story.reach || 0) + (story.buzz || 0)) < 150) return;                                  // needs a little traction
                if (posts.filter(function (p) { return p.kind === 'comment' && p.parent === story.id; }).length >= 8) return; // don't flood
                var pool = pools[seeded % pools.length];
                c.putNetPost(key, { id: uid('cm'), kind: 'comment', parent: story.id, handle: pool + '-' + (1000 + (seeded % 900) * 7), body: cannedComment(pool), ts: nowStamp() });
                seeded++;
              });
            });
          }
          Promise.resolve(Store.put({ type: 'site', id: s.id }, s));
        });
        // Fee payouts: release any reach/likes/comments-gated contract whose delivered article now clears the bar.
        var paidOut = 0, paidN = 0;
        if (c && c.allSheets && c.getNetPosts && c.publishSheet) {
          (c.allSheets() || []).forEach(function (rec) {
            var pj = rec && rec.json; if (!pj || !pj.press || !pj.press.contracts) return; var changed = false;
            pj.press.contracts.forEach(function (ct) {
              if (!ct.articlePostId || !ct.articleKey) return;
              var posts = c.getNetPosts(ct.articleKey) || [], post = posts.filter(function (p) { return p.id === ct.articlePostId; })[0]; if (!post) return;
              if (ct.mode === 'adregie' && parseInt(ct.cpm, 10)) {
                // ad deal — pay the rate on new views since last settle (per 1,000 views)
                var views = (post.reach || 0) + (post.buzz || 0), delta = views - (parseInt(ct.paidViews, 10) || 0); if (delta <= 0) return;
                var adAmt = Math.round((parseInt(ct.cpm, 10) || 0) * delta / 1000); if (!adAmt) { ct.paidViews = views; return; }
                var pa = creditSheet(pj, adAmt, 'Ad revenue — ' + (ct.client || 'placement')); if (pa) { ct.paidViews = views; paidOut += pa; paidN++; changed = true; }
                return;
              }
              // sponsor / advertorial flat fee, released once when its condition clears
              // (on-delivery fees are normally paid at publish; if that failed for lack of an account, pay here)
              if (ct.paid) return;
              var po = ct.payout || { metric: 'onPublish' };
              var clears = (!po.metric || po.metric === 'onPublish') ? true
                : ((po.metric === 'comments' ? posts.filter(function (p) { return p.kind === 'comment' && p.parent === ct.articlePostId; }).length : (po.metric === 'likes' ? (post.likes || 0) : (post.reach || 0))) >= (parseInt(po.threshold, 10) || 0));
              if (clears) { var amt = creditSheet(pj, parseInt(ct.fee, 10) || 0, 'Contract fee — ' + (ct.client || 'piece')); if (amt) { ct.paid = true; paidOut += amt; paidN++; changed = true; } }
            });
            if (changed) c.publishSheet(rec.id, pj.handle || pj.name || 'PC', pj);
          });
        }
        onLog && onLog('Settled ' + n + ' press outlet(s): credibility drift, buzz fade, ' + seeded + ' reader comment(s) seeded' + (paidN ? ', ' + paidN + ' fee(s) paid (' + money(paidOut) + ')' : '') + '.');
      }, function (e) { onLog && onLog('Settle unavailable: ' + (e && e.message || e)); });
    } catch (e) { onLog && onLog('Settle failed: ' + (e && e.message || e)); }
  }

  function renderComposer(host, cs, sdk, cfg, onDone) {
    host.innerHTML = '';
    var wrap = eln('div', 'dm-composer'); host.appendChild(wrap);
    var _tk = (cs && cs.track) || 'investigation', _ti = TRACK_INFO[_tk] || TRACK_INFO.investigation;
    wrap.appendChild(eln('div', 'dm-comp-head', '<b>' + esc(_ti.label) + '</b> — ' + esc(_ti.blurb) + ' You type the table’s results; the app never rolls. Reach is gated by your Credibility.'));
    var pts = (cfg.publish.postTypes && cfg.publish.postTypes.slice()) || ['article'];
    var draft = { id: uid('st'), track: _tk, postType: pts[0], headline: '', dek: '', body: '', sources: [], conviction: 5, subject: '', subjectFame: 5, event: '', commissioned: !!(cs && cs.commissioned), disclosed: true, productionQuality: 'med', sensationalism: 3, dramaticRecreation: false, tableResult: { composition: 0, credDelta: 0 }, broadcast: cfg.publish.defaultBroadcast, publishedSiteId: null };
    function field(lab, el) { var f = eln('label', 'dm-cf'); f.appendChild(eln('span', 'dm-cf-l', esc(lab))); f.appendChild(el); return f; }
    function sel(opts, val, on) { var s = eln('select', 'dm-in'); opts.forEach(function (o) { var op = eln('option', null, o); op.value = o; if (o === val) op.selected = true; s.appendChild(op); }); s.onchange = function () { on(s.value); }; return s; }
    function group(parent, title) { var g = eln('div', 'dm-comp-grp'); g.appendChild(eln('div', 'dm-comp-gh', title)); parent.appendChild(g); return g; }

    var cols = eln('div', 'dm-comp-cols'); wrap.appendChild(cols);
    var mainC = eln('div', 'dm-comp-main'); var sideC = eln('div', 'dm-comp-side'); cols.appendChild(mainC); cols.appendChild(sideC);

    var g1 = group(mainC, '① THE STORY');
    g1.appendChild(field('format', sel(pts, draft.postType, function (v) { draft.postType = v; })));
    var hl = eln('input', 'dm-in'); hl.placeholder = 'Headline — grab them'; hl.oninput = function () { draft.headline = hl.value; }; g1.appendChild(field('headline', hl));
    var dk = eln('input', 'dm-in'); dk.placeholder = 'Dek / sub-headline'; dk.oninput = function () { draft.dek = dk.value; }; g1.appendChild(field('dek', dk));
    var bd = eln('textarea', 'dm-in dm-ta'); bd.placeholder = 'The body of the piece… use ⟦npc:id|Name⟧ to cite an entity from your Files.'; bd.oninput = function () { draft.body = bd.value; }; g1.appendChild(field('body', bd));

    var g2 = group(sideC, _ti.panelTitle);
    if (draft.track === 'investigation') {
      var cand = cs.nodes.filter(function (n) { return ['evidence', 'claim', 'source', 'entity', 'event'].indexOf(n.kind) >= 0; });
      if (!cand.length) g2.appendChild(eln('div', 'dm-muted dm-comp-pad', 'No evidence in this case yet — build the board first. The more of your nodes are confirmed sources, the further it travels.'));
      cand.forEach(function (n) {
        var row = eln('label', 'dm-src-row'); var cb = eln('input'); cb.type = 'checkbox';
        cb.onchange = function () { if (cb.checked) draft.sources.push(n.id); else draft.sources = draft.sources.filter(function (x) { return x !== n.id; }); refresh(); };
        row.appendChild(cb); row.appendChild(eln('span', null, esc(n.label) + ' <span class="dm-muted">' + credBar(n.cred) + '</span>')); g2.appendChild(row);
      });
    } else if (draft.track === 'opinion') {
      g2.appendChild(eln('div', 'dm-muted dm-comp-pad', 'No sources — your name carries this. The stronger the stake, the further it travels (and the more you risk if the table calls your Credibility).'));
      var cv = eln('input', 'dm-in'); cv.type = 'range'; cv.min = 0; cv.max = 10; cv.value = draft.conviction; var cvOut = eln('span', 'dm-cf-out', String(draft.conviction));
      cv.oninput = function () { draft.conviction = +cv.value; cvOut.textContent = cv.value; refresh(); };
      var cvRow = field('conviction / stake', cv); cvRow.appendChild(cvOut); g2.appendChild(cvRow);
      var sj = eln('input', 'dm-in'); sj.placeholder = 'who / what it’s about (optional)'; sj.oninput = function () { draft.subject = sj.value; }; g2.appendChild(field('subject', sj));
    } else if (draft.track === 'sensation') {
      g2.appendChild(eln('div', 'dm-muted dm-comp-pad', 'Point it at someone. Buzz beats truth here — sensationalism drives reach, credibility barely counts.'));
      var tg = eln('input', 'dm-in'); tg.placeholder = 'target / subject (a name, a face)'; tg.oninput = function () { draft.subject = tg.value; refresh(); }; g2.appendChild(field('target', tg));
      var fa = eln('input', 'dm-in'); fa.type = 'range'; fa.min = 1; fa.max = 10; fa.value = draft.subjectFame; var faOut = eln('span', 'dm-cf-out', String(draft.subjectFame));
      fa.oninput = function () { draft.subjectFame = +fa.value; faOut.textContent = fa.value; refresh(); };
      var faRow = field('how famous is the target', fa); faRow.appendChild(faOut); g2.appendChild(faRow);
    } else if (draft.track === 'broadcast') {
      g2.appendChild(eln('div', 'dm-muted dm-comp-pad', 'It’s happening now. Timeliness + reach carry it; it spikes then fades fast.'));
      var ev = eln('input', 'dm-in'); ev.placeholder = 'the event you’re covering'; ev.oninput = function () { draft.event = ev.value; }; g2.appendChild(field('event', ev));
    }
    var _reqDisc = !!(cs && cs.discloseRequired);
    var comWrap = eln('div', 'dm-comm-ov'); g2.appendChild(comWrap);
    var comRow = eln('label', 'dm-src-row'); var comCb = eln('input'); comCb.type = 'checkbox'; comCb.checked = draft.commissioned; comRow.appendChild(comCb); comRow.appendChild(eln('span', null, 'sponsored — a client provided the material' + (cs && cs.sponsorClient ? ' (' + esc(cs.sponsorClient) + ')' : ''))); comWrap.appendChild(comRow);
    var discRow = eln('label', 'dm-src-row'); discRow.style.display = draft.commissioned ? '' : 'none'; var discCb = eln('input'); discCb.type = 'checkbox'; discCb.checked = true; if (_reqDisc) discCb.disabled = true; discRow.appendChild(discCb); discRow.appendChild(eln('span', null, _reqDisc ? 'disclosure required by your sponsor' : 'disclose it’s sponsored (safe, −reach; hiding it risks a Credibility roll → crash)')); comWrap.appendChild(discRow);
    comCb.onchange = function () { draft.commissioned = comCb.checked; discRow.style.display = comCb.checked ? '' : 'none'; refresh(); };
    discCb.onchange = function () { draft.disclosed = discCb.checked; refresh(); };

    var g3 = group(sideC, '③ FROM THE TABLE');
    g3.appendChild(field('production quality', sel(['low', 'med', 'high'], draft.productionQuality, function (v) { draft.productionQuality = v; refresh(); })));
    var sn = eln('input', 'dm-in'); sn.type = 'range'; sn.min = 0; sn.max = 10; sn.value = draft.sensationalism; var snOut = eln('span', 'dm-cf-out', String(draft.sensationalism));
    sn.oninput = function () { draft.sensationalism = +sn.value; snOut.textContent = sn.value; refresh(); };
    var snRow = field('sensationalism', sn); snRow.appendChild(snOut); g3.appendChild(snRow);
    var comp = eln('input', 'dm-in'); comp.type = 'number'; comp.placeholder = 'Composition roll'; comp.oninput = function () { draft.tableResult.composition = +comp.value || 0; }; g3.appendChild(field('composition (table result)', comp));
    var drRow = eln('label', 'dm-src-row'); var drCb = eln('input'); drCb.type = 'checkbox'; drCb.onchange = function () { draft.dramaticRecreation = drCb.checked; }; drRow.appendChild(drCb); drRow.appendChild(eln('span', null, 'dramatic recreation (label it staged)')); g3.appendChild(drRow);

    var g4 = group(sideC, '④ PUBLISH TO AN OUTLET');
    var outletSel = eln('select', 'dm-in'); outletSel.innerHTML = '<option value="">loading outlets…</option>'; g4.appendChild(field('press outlet', outletSel));
    var secSel = eln('select', 'dm-in'); g4.appendChild(field('section', secSel));
    function fillSections(oj) { secSel.innerHTML = ''; (((oj || {}).appConfig || {}).sections || ['Front']).forEach(function (s) { var o = eln('option', null, s); o.value = s; secSel.appendChild(o); }); draft.targetSection = secSel.value; }
    var _outlets = [];
    function refreshOutlets() {
      if (!_outlets.length) { outletSel.innerHTML = '<option value="">— no press outlets yet (GM creates them) —</option>'; draft.targetJson = null; return; }
      var cur = outletSel.value, firstOk = null;
      outletSel.innerHTML = '';
      _outlets.forEach(function (r) { var reason = outletCompat(r.json, draft, sdk, cs); var o = eln('option', null, (r.json.name || 'outlet') + (reason ? ' — ' + reason : '')); o.value = r.json.id; if (reason) o.disabled = true; else if (firstOk == null) firstOk = r.json.id; outletSel.appendChild(o); });
      var curOk = _outlets.filter(function (r) { return r.json.id === cur && !outletCompat(r.json, draft, sdk, cs); })[0];
      var pick = curOk ? cur : firstOk;
      if (pick) { outletSel.value = pick; var pr = _outlets.filter(function (x) { return x.json.id === pick; })[0]; draft.targetJson = pr.json; draft.targetOutletId = pick; fillSections(pr.json); }
      else { draft.targetJson = null; }
    }
    mediaOutlets(function (list) { _outlets = list; refreshOutlets(); refresh(); });
    outletSel.onchange = function () { var r = _outlets.filter(function (x) { return x.json.id === outletSel.value; })[0]; draft.targetJson = r && r.json; draft.targetOutletId = outletSel.value; fillSections(r && r.json); refresh(); };
    secSel.onchange = function () { draft.targetSection = secSel.value; };
    var est = eln('div', 'dm-est'); g4.appendChild(est);
    var pubReason = eln('div', 'dm-pub-reason'); g4.appendChild(pubReason);
    var pub = eln('button', 'dm-btn dm-primary dm-pub', '➤ PUBLISH'); g4.appendChild(pub);

    function refresh() {
      if (_outlets.length) refreshOutlets();
      var b = initialBuzz(sdk, cfg, cs, draft), cr = credibilityOf(sdk);
      est.innerHTML = '<div class="dm-est-row"><span class="dm-est-l">REACH SEED</span><span class="dm-est-n">' + b + '</span></div>' +
        '<div class="dm-est-row"><span class="dm-est-l">CREDIBILITY</span><span class="dm-est-n">' + cr + '<small>/10</small></span></div>' +
        (cr === 0 && sdk.isPlayer ? '<div class="dm-est-warn">No credibility — this dies in obscurity. Only media get heard.</div>' : '');
      var reason = draft.targetJson ? outletCompat(draft.targetJson, draft, sdk, cs) : (_outlets.length ? 'no compatible outlet for this post' : 'no press outlets yet');
      pub.disabled = !!reason; pub.classList.toggle('dm-disabled', !!reason);
      pubReason.textContent = reason ? '✕ ' + reason : '';
    }
    pub.onclick = function () { if (pub.disabled) return; if (!draft.headline) { sdk.notify('Give it a headline first.'); return; } publishStory(sdk, cfg, cs, draft, function (story) { sdk.notify('Published “' + story.headline + '” — opening on the Net.'); onDone && onDone(story); }); };
    refresh();
  }

  /* ═══════════════ the OBJECTIF lens set ═══════════════ */
  var LENSES = [
    // The spine, in order: LINKS (collect + connect) → SOURCES (source the news) → PUBLISH.
    { id: 'liens', key: '1', glyph: '①', label: 'LINKS', universal: true },
    { id: 'sources', key: '2', glyph: '②', label: 'SOURCES', universal: true },
    { id: 'montage', key: '3', glyph: '③', label: 'PUBLISH', media: true },
    // Depth lenses (opt-in, not part of the happy path):
    { id: 'timeline', key: '4', glyph: '▤', label: 'CHRONO', universal: true },
    { id: 'heat', key: '5', glyph: '▲', label: 'HEAT', universal: true },
    { id: 'dossier', key: 'd', glyph: '☰', label: 'DOSSIER', contextual: true }
  ];
  // Piece-first: 4 production tracks. Each swaps what replaces the SOURCES step, and thus
  // which factor dominates reach. COMMISSIONED is an overlay (client-provided material), not a track.
  var TRACK_INFO = {
    investigation: { label: 'INVESTIGATION', panelTitle: '② SOURCES', blurb: 'you proved it — sourcing carries this.', card: 'Prove it — pull evidence, source it, publish. Reach = your sourcing.' },
    opinion: { label: 'OPINION', panelTitle: '② STANCE & STAKE', blurb: 'your name carries this.', card: 'Stake your name — a take, no sourcing. Reach = your Credibility.' },
    broadcast: { label: 'BROADCAST', panelTitle: '② THE EVENT', blurb: 'it’s happening now.', card: 'Cover it live — built from an event, fades fast. Reach = timeliness.' },
    sensation: { label: 'SENSATION', panelTitle: '② TARGET', blurb: 'buzz beats truth.', card: 'Point and crank — a target, sensational. Reach = buzz, not credibility.' }
  };
  var TRACKS = ['investigation', 'opinion', 'broadcast', 'sensation'];
  var LENS_PURPOSE = {
    liens: 'who connects to whom — ＋ add nodes, then drag from a card’s ◆ to draw a typed link',
    timeline: 'reconstruct the sequence — give nodes a “when” below to place them on the axis',
    sources: 'how solid is it — tick what the table confirmed; solidity feeds every lens',
    heat: 'who wants this buried — set legal / threat heat and shield your sources',
    carte: 'where it happened — place nodes on Night City districts',
    montage: 'turn this piece into a story and publish it to the Net',
    war: 'the story vs the counter-story across channels'
  };

  /* ═══════════════ the investigation BOARD ═══════════════ */
  function renderBoard(host, cs, sdk, cfg, onSave) {
    host.innerHTML = '';
    var save = function () { onSave && onSave(); };
    var board = eln('div', 'dt-board'); host.appendChild(board);

    // OBJECTIF bar
    var bar = eln('div', 'dm-objbar'); board.appendChild(bar);
    bar.appendChild(eln('span', 'dm-obj-lab', 'OBJECTIF'));
    var lensBtns = {};
    LENSES.forEach(function (L) {
      if (L.contextual) return;
      var media = L.media && !cs.media;
      var b = eln('button', 'dm-lens' + (media ? ' off' : '') + (cs.view.lens === L.id ? ' on' : ''), esc(L.label));
      b.title = media ? 'Media suites only' : (L.label + '  [' + L.key + ']');
      if (!media) b.onclick = function () { switchLens(L.id); };
      lensBtns[L.id] = b; bar.appendChild(b);
    });
    var spacer = eln('span', 'dm-obj-sp'); bar.appendChild(spacer);
    var dossBtn = eln('button', 'dm-lens dm-doss-btn', 'DOSSIER');
    dossBtn.onclick = function () { toggleDossier(); }; bar.appendChild(dossBtn);

    // stage + dossier
    var wrap = eln('div', 'dm-stagewrap'); board.appendChild(wrap);
    var stage = eln('div', 'dm-stage'); wrap.appendChild(stage);
    var dossier = eln('div', 'dm-dossier'); wrap.appendChild(dossier);
    var dossierOpen = false;

    var api = {
      get sel() { return cs.view.sel; },
      select: function (id) { cs.view.sel = id; save(); renderDossier(); if (id && !dossierOpen) { dossierOpen = true; dossier.classList.add('open'); } paintSelection(); },
      save: save,
      rerender: function () { mount(); },
      dossier: function (id) { api.select(id); }
    };

    function toggleDossier() { dossierOpen = !dossierOpen; dossier.classList.toggle('open', dossierOpen); if (dossierOpen) renderDossier(); }

    function switchLens(id) {
      cs.view.lens = id; save();
      Object.keys(lensBtns).forEach(function (k) { lensBtns[k].classList.toggle('on', k === id); });
      mount();
    }

    var _paintSel = function () {};
    function paintSelection() { try { _paintSel(); } catch (e) {} }

    function mount() {
      stage.innerHTML = '';
      var L = LENSES.filter(function (x) { return x.id === cs.view.lens; })[0] || LENSES[0];
      stage.appendChild(eln('div', 'dm-lens-head', '<span class="dm-lh-t">' + esc(L.glyph) + ' ' + esc(L.label) + '</span><span class="dm-lh-p">' + esc(LENS_PURPOSE[L.id] || '') + '</span>'));
      var bodyEl = eln('div', 'dm-lens-body'); stage.appendChild(bodyEl);
      var impl = LENS_IMPL[cs.view.lens] || LENS_IMPL.liens;
      _paintSel = function () {};
      impl(bodyEl, cs, sdk, cfg, api, function (fn) { _paintSel = fn; });
    }

    /* DOSSIER (contextual inspector) */
    function renderDossier() {
      dossier.innerHTML = '';
      var n = cs.view.sel ? nodeById(cs, cs.view.sel) : null;
      if (!n) { dossier.appendChild(eln('div', 'dm-doss-empty', 'Select a node to inspect it.')); return; }
      var head = eln('div', 'dm-doss-head');
      head.innerHTML = '<span class="dm-doss-g">' + esc(NODE_GLYPH[n.kind] || '▪') + '</span><span class="dm-doss-kind">' + esc(n.kind.toUpperCase()) + '</span>';
      dossier.appendChild(head);

      var nameIn = eln('input', 'dm-doss-name'); nameIn.value = n.label || ''; nameIn.placeholder = 'label';
      nameIn.oninput = function () { n.label = nameIn.value; save(); paintSelection(); };
      dossier.appendChild(nameIn);

      // kind + cred row
      var meta = eln('div', 'dm-doss-row');
      var kindSel = eln('select', 'dm-doss-sel');
      NODE_KINDS.forEach(function (k) { var o = eln('option', null, k); o.value = k; if (k === n.kind) o.selected = true; kindSel.appendChild(o); });
      kindSel.onchange = function () { n.kind = kindSel.value; save(); paintSelection(); };
      meta.appendChild(labelWrap('kind', kindSel));
      var credSel = eln('select', 'dm-doss-sel');
      ['0 unconfirmed', '1 single-source', '2 corroborated', '3 verified'].forEach(function (t, i) { var o = eln('option', null, t); o.value = i; if (i === (n.cred | 0)) o.selected = true; credSel.appendChild(o); });
      credSel.onchange = function () { n.cred = +credSel.value; save(); paintSelection(); };
      meta.appendChild(labelWrap('credibility', credSel));
      dossier.appendChild(meta);

      // note
      var noteTa = eln('textarea', 'dm-doss-note'); noteTa.value = n.note || ''; noteTa.placeholder = 'notes… use ⟦npc:id|Name⟧ to mention';
      noteTa.oninput = function () { n.note = noteTa.value; save(); };
      dossier.appendChild(labelWrap('notes', noteTa));

      // connections
      var conns = linksOf(cs, n.id);
      if (conns.length) {
        var cl = eln('div', 'dm-doss-conns'); cl.appendChild(eln('div', 'dm-doss-h', 'CONNECTIONS'));
        conns.forEach(function (l) {
          var other = nodeById(cs, l.from === n.id ? l.to : l.from);
          var row = eln('div', 'dm-doss-conn', '<span class="dm-doss-rel">' + esc(l.kind) + '</span> ' + esc(other ? other.label : '?'));
          row.onclick = function () { if (other) api.select(other.id); };
          cl.appendChild(row);
        });
        dossier.appendChild(cl);
      }

      var toData = eln('button', 'dm-btn dm-doss-todata', '→ publish to Data');
      toData.title = 'save this node into the campaign database, in its own category';
      toData.onclick = function () { publishNodeToData(n); };
      dossier.appendChild(toData);

      var del = eln('button', 'dm-btn dm-del', '✕ delete node');
      del.onclick = function () {
        cs.nodes = cs.nodes.filter(function (x) { return x.id !== n.id; });
        cs.links = cs.links.filter(function (x) { return x.from !== n.id && x.to !== n.id; });
        cs.view.sel = null; save(); renderDossier(); mount();
      };
      dossier.appendChild(del);
    }
    // Publish a node back into the campaign Data (Store) — in its native category (NPC→npc,
    // location→location…), tagged 'data'. Data entries are Store records the GM/players share.
    function publishNodeToData(n) {
      if (!window.Store || !Store.create) { sdk.notify('The campaign database is unavailable here.'); return; }
      function put(type) {
        var name = n.label || 'Untitled', desc = n.note || '';
        if (n.ref && n.ref.id && n.ref.type === type) {
          Promise.resolve(Store.resolve(n.ref)).then(function (rec) {
            var j = (rec && rec.json) || { id: n.ref.id }; j.name = name; if (desc) j.desc = desc; j.tags = (j.tags || []).indexOf('data') >= 0 ? j.tags : (j.tags || []).concat(['data']);
            Promise.resolve(Store.put({ type: type, id: n.ref.id }, j)).then(function () { sdk.notify('Updated in Data (' + type + ').'); }, function () { sdk.notify('Could not update that Data entry.'); });
          }, function () { sdk.notify('Could not reach that Data entry.'); });
        } else {
          Promise.resolve(Store.create(type, { name: name, desc: desc, tags: ['data'], source: 'media' })).then(function (made) {
            n.ref = { type: type, id: (made && made.json && made.json.id) || (made && made.id) }; save(); renderDossier();
            sdk.notify('Published to Data (' + type + ').');
          }, function (e) { sdk.notify('Could not publish: ' + ((e && e.message) || e)); });
        }
      }
      if (n.ref && n.ref.type) { put(n.ref.type); return; } // it already came from a category → back it goes
      var m = eln('div', 'dm-pop'); m.appendChild(eln('div', 'dm-pop-h', 'publish to Data — pick a category'));
      [['npc', 'Person'], ['org', 'Organisation'], ['location', 'Location'], ['item', 'Item']].forEach(function (t) { var b = eln('button', 'dm-pop-b', t[1]); b.onclick = function () { m.remove(); put(t[0]); }; m.appendChild(b); });
      var cx = eln('button', 'dm-pop-x', 'cancel'); cx.onclick = function () { m.remove(); }; m.appendChild(cx);
      stage.appendChild(m);
    }
    function labelWrap(lab, el) { var w = eln('label', 'dm-fl'); w.appendChild(eln('span', 'dm-fl-l', esc(lab))); w.appendChild(el); return w; }

    // chip clicks (mentions) — reveal via Files if available
    board.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('.dm-chip'); if (!chip) return;
      sdk.notify(chip.getAttribute('data-type') + ' · ' + chip.textContent);
    });

    mount();
    if (cs.view.sel) { dossierOpen = true; dossier.classList.add('open'); renderDossier(); }

    // keyboard: 1-7 jump lenses, d dossier
    board.tabIndex = 0;
    board.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      var L = LENSES.filter(function (x) { return x.key === e.key; })[0];
      if (L) { if (L.id === 'dossier') toggleDossier(); else if (!(L.media && !cs.media)) switchLens(L.id); }
    });
  }

  /* ─── lens implementations ─── */
  var LENS_IMPL = {};

  LENS_IMPL.liens = function (stage, cs, sdk, cfg, api, setPaint) {
    var toolbar = eln('div', 'dm-liens-tb');
    toolbar.innerHTML = '<button class="dm-btn" data-a="node">＋ NODE</button>' +
      '<button class="dm-btn" data-a="files">＋ FROM FILES</button>' +
      '<button class="dm-btn" data-a="data">＋ FROM DATA</button>' +
      '<button class="dm-btn" data-a="link">＋ LINK</button>' +
      '<span class="dm-tb-sp"></span>' +
      '<button class="dm-btn dm-z" data-a="zin">＋</button><button class="dm-btn dm-z" data-a="zout">－</button>' +
      '<span class="dm-hint">drag empty = pan · drag node = move · click = inspect</span>';
    stage.appendChild(toolbar);

    var viewport = eln('div', 'dm-viewport'); stage.appendChild(viewport);
    var world = eln('div', 'dm-world'); viewport.appendChild(world);
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'dm-edges'); world.appendChild(svg);
    var defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="dm-ah" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#111"/></marker>' +
      '<marker id="dm-ahr" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#c0392b"/></marker>';
    svg.appendChild(defs);

    var pan = cs.view.pan || (cs.view.pan = { x: 0, y: 0 }), zoom = cs.view.zoom || 1;
    function applyXform() { world.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')'; }
    applyXform();

    var linkMode = false, linkFrom = null;
    var nodeEls = {};

    function center(n) { return { x: n.x + 76, y: n.y + 26 }; }
    function drawEdges() {
      // clear existing paths (keep defs)
      var kids = svg.querySelectorAll('path.dm-edge, text.dm-elab'); Array.prototype.forEach.call(kids, function (k) { k.remove(); });
      cs.links.forEach(function (l) {
        var a = nodeById(cs, l.from), b = nodeById(cs, l.to); if (!a || !b) return;
        var ca = center(a), cb = center(b);
        var mx = (ca.x + cb.x) / 2, my = (ca.y + cb.y) / 2 - 18;
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('class', 'dm-edge'); p.setAttribute('d', 'M' + ca.x + ',' + ca.y + ' Q' + mx + ',' + my + ' ' + cb.x + ',' + cb.y);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', l.active ? '#c0392b' : '#111');
        p.setAttribute('stroke-width', (l.cred >= 2 || l.active) ? '2' : '1.4');
        if (!(l.cred >= 2) && !l.active) p.setAttribute('stroke-dasharray', '6 5');
        if (l.directed) p.setAttribute('marker-end', l.active ? 'url(#dm-ahr)' : 'url(#dm-ah)');
        svg.appendChild(p);
        if (l.kind && l.kind !== 'custom') {
          var t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'dm-elab'); t.setAttribute('x', mx); t.setAttribute('y', my + 2); t.setAttribute('text-anchor', 'middle'); t.textContent = l.kind;
          svg.appendChild(t);
        }
      });
    }

    function sizeSvg() {
      var maxX = 800, maxY = 500;
      cs.nodes.forEach(function (n) { maxX = Math.max(maxX, n.x + 220); maxY = Math.max(maxY, n.y + 160); });
      svg.setAttribute('width', maxX); svg.setAttribute('height', maxY);
      svg.style.width = maxX + 'px'; svg.style.height = maxY + 'px';
    }

    function makeNode(n) {
      var el = eln('div', 'dm-node' + (cs.view.sel === n.id ? ' sel' : '') + (n.dropped ? ' dropped' : ''));
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      el.setAttribute('data-id', n.id);
      el.innerHTML = '<div class="dm-node-h"><span class="dm-node-g">' + esc(NODE_GLYPH[n.kind] || '▪') + '</span><span class="dm-node-ty">' + esc(n.kind) + '</span>' +
        '<span class="dm-node-cred" title="credibility">' + credDots(n.cred) + '</span></div>' +
        '<div class="dm-node-nm">' + esc(n.label || 'untitled') + '</div>' +
        '<div class="dm-node-hd" title="draw link">◆</div>';
      world.appendChild(el); nodeEls[n.id] = el;
      wireNode(el, n);
      return el;
    }
    function credDots(c) { c = c | 0; var s = ''; for (var i = 0; i < 3; i++) s += (i < c ? '▪' : '▫'); return s; }

    function wireNode(el, n) {
      var handle = el.querySelector('.dm-node-hd');
      handle.addEventListener('mousedown', function (e) {
        e.stopPropagation(); e.preventDefault(); startLink(n, e);
      });
      el.addEventListener('mousedown', function (e) {
        if (e.target === handle) return;
        if (linkMode) { finishLink(n); return; }
        e.stopPropagation();
        var sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y, moved = false;
        function mv(ev) {
          moved = true;
          n.x = ox + (ev.clientX - sx) / zoom; n.y = oy + (ev.clientY - sy) / zoom;
          el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; drawEdges();
        }
        function up() {
          document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
          if (moved) { api.save(); sizeSvg(); }
          else { api.select(n.id); }
        }
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      });
    }

    // rubber-band link draw
    var band = null;
    function startLink(n, e) {
      linkFrom = n; band = document.createElementNS(NS, 'path'); band.setAttribute('class', 'dm-edge'); band.setAttribute('stroke', '#c0392b'); band.setAttribute('stroke-width', '2'); band.setAttribute('fill', 'none'); svg.appendChild(band);
      var ca = center(n);
      function mv(ev) {
        var rect = world.getBoundingClientRect();
        var x = (ev.clientX - rect.left) / zoom, y = (ev.clientY - rect.top) / zoom;
        band.setAttribute('d', 'M' + ca.x + ',' + ca.y + ' L' + x + ',' + y);
      }
      function up(ev) {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        if (band) { band.remove(); band = null; }
        var tgt = ev.target && ev.target.closest ? ev.target.closest('.dm-node') : null;
        if (tgt && tgt.getAttribute('data-id') !== n.id) { pickLinkKind(n.id, tgt.getAttribute('data-id')); }
        linkFrom = null;
      }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    }
    function finishLink(n) { if (linkFrom && linkFrom.id !== n.id) pickLinkKind(linkFrom.id, n.id); linkMode = false; linkFrom = null; viewport.classList.remove('linking'); }

    function pickLinkKind(from, to) {
      var m = eln('div', 'dm-pop'); m.appendChild(eln('div', 'dm-pop-h', 'relation'));
      LINK_KINDS.forEach(function (k) { var b = eln('button', 'dm-pop-b', esc(k)); b.onclick = function () { addLink(cs, from, to, k); api.save(); m.remove(); redraw(); }; m.appendChild(b); });
      var cx = eln('button', 'dm-pop-x', 'cancel'); cx.onclick = function () { m.remove(); }; m.appendChild(cx);
      stage.appendChild(m);
    }

    function redraw() {
      Object.keys(nodeEls).forEach(function (k) { if (nodeEls[k]) nodeEls[k].remove(); }); nodeEls = {};
      cs.nodes.forEach(makeNode); sizeSvg(); drawEdges();
    }

    // pan on empty drag; zoom on wheel
    viewport.addEventListener('mousedown', function (e) {
      if (e.target.closest('.dm-node') || e.target.closest('.dm-pop')) return;
      var sx = e.clientX, sy = e.clientY, ox = pan.x, oy = pan.y;
      function mv(ev) { pan.x = ox + (ev.clientX - sx); pan.y = oy + (ev.clientY - sy); applyXform(); }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); cs.view.pan = pan; api.save(); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    viewport.addEventListener('wheel', function (e) {
      e.preventDefault(); var d = e.deltaY < 0 ? 1.1 : 0.9; zoom = clampn(zoom * d, 0.3, 2.5); cs.view.zoom = zoom; applyXform();
    }, { passive: false });

    toolbar.addEventListener('click', function (e) {
      var b = e.target.closest('.dm-btn'); if (!b) return; var a = b.getAttribute('data-a');
      if (a === 'node') { var lab = window.prompt ? '' : ''; App.prompt ? App.prompt('New node', 'Label', '', function (v) { if (v) { var n = addNode(cs, { label: v, kind: 'note' }); api.save(); redraw(); api.select(n.id); } }) : (function () { var n = addNode(cs, { label: 'Node', kind: 'note' }); api.save(); redraw(); })(); }
      else if (a === 'files') { pickFromFiles(); }
      else if (a === 'data') { pickFromData(); }
      else if (a === 'link') { linkMode = !linkMode; viewport.classList.toggle('linking', linkMode); sdk.notify(linkMode ? 'Link mode: click two nodes.' : 'Link mode off.'); }
      else if (a === 'zin') { zoom = clampn(zoom * 1.15, 0.3, 2.5); cs.view.zoom = zoom; applyXform(); }
      else if (a === 'zout') { zoom = clampn(zoom * 0.87, 0.3, 2.5); cs.view.zoom = zoom; applyXform(); }
    });

    function pickFromFiles() {
      var files = (sdk.files && sdk.files.all && sdk.files.all()) || [];
      var m = eln('div', 'dm-pop dm-pop-files'); m.appendChild(eln('div', 'dm-pop-h', 'add from files / intel'));
      if (!files.length) m.appendChild(eln('div', 'dm-pop-empty', 'no files yet'));
      files.slice(0, 40).forEach(function (f) {
        var b = eln('button', 'dm-pop-b', '<b>' + esc(f.name || 'file') + '</b> <span class="dm-muted">' + esc(f.folder || '') + '</span>');
        b.onclick = function () { var n = addNode(cs, { label: (f.name || 'file').replace(/\.[a-z]+$/, ''), kind: f.folder === 'Intel' ? 'evidence' : 'note', note: f.body || '', ref: f.ref || null }); api.save(); m.remove(); redraw(); api.select(n.id); };
        m.appendChild(b);
      });
      var cx = eln('button', 'dm-pop-x', 'cancel'); cx.onclick = function () { m.remove(); }; m.appendChild(cx);
      stage.appendChild(m);
    }
    // Pull a campaign Store entity (NPC / org / location / item / crew) straight onto the board as a node.
    function pickFromData() {
      var m = eln('div', 'dm-pop dm-pop-files'); m.appendChild(eln('div', 'dm-pop-h', 'add from Data — campaign entities'));
      var host = eln('div'); m.appendChild(host); host.appendChild(eln('div', 'dm-pop-empty', 'loading…'));
      var cx = eln('button', 'dm-pop-x', 'cancel'); cx.onclick = function () { m.remove(); }; m.appendChild(cx);
      stage.appendChild(m);
      if (!window.Store || !Store.index) { host.innerHTML = ''; host.appendChild(eln('div', 'dm-pop-empty', 'the campaign database is unavailable here')); return; }
      var types = [['npc', 'person', 'entity'], ['org', 'organisation', 'entity'], ['location', 'location', 'entity'], ['item', 'item', 'evidence'], ['squad', 'crew', 'entity']];
      Promise.all(types.map(function (t) { return Promise.resolve(Store.index(t[0])).then(function (rows) { return { t: t, rows: rows || [] }; }, function () { return { t: t, rows: [] }; }); })).then(function (groups) {
        host.innerHTML = ''; var any = false;
        groups.forEach(function (g) {
          g.rows.slice(0, 30).forEach(function (r) {
            if (!r || !r.json) return; any = true;
            var nm = (Store.displayName && Store.displayName(r)) || r.json.name || r.json.handle || 'entity';
            var b = eln('button', 'dm-pop-b', '<b>' + esc(nm) + '</b> <span class="dm-muted">' + esc(g.t[1]) + '</span>');
            b.onclick = function () { var n = addNode(cs, { label: nm, kind: g.t[2], note: r.json.desc || r.json.notes || '', ref: { type: g.t[0], id: r.json.id } }); api.save(); m.remove(); redraw(); api.select(n.id); };
            host.appendChild(b);
          });
        });
        if (!any) host.appendChild(eln('div', 'dm-pop-empty', 'no campaign entities yet'));
      }, function () { host.innerHTML = ''; host.appendChild(eln('div', 'dm-pop-empty', 'could not read the database')); });
    }

    redraw();
    if (!cs.nodes.length) stage.appendChild(eln('div', 'dm-empty', 'Empty piece. Add a node, or pull from your Files, then drag from a node’s ◆ handle to link them and map the story.'));

    setPaint(function () {
      Object.keys(nodeEls).forEach(function (k) { var n = nodeById(cs, k); if (nodeEls[k] && n) { nodeEls[k].classList.toggle('sel', cs.view.sel === k); var nm = nodeEls[k].querySelector('.dm-node-nm'); if (nm) nm.textContent = n.label || 'untitled'; var cd = nodeEls[k].querySelector('.dm-node-cred'); if (cd) cd.innerHTML = credDots(n.cred); } });
      drawEdges();
    });
  };

  function stubLens(name, note) {
    return function (stage, cs) {
      var d = eln('div', 'dm-lens-stub');
      d.innerHTML = '<div class="dm-stub-g">' + esc((LENSES.filter(function (l) { return l.label === name || l.id === name; })[0] || {}).glyph || '▪') + '</div><div class="dm-stub-t">' + esc(name) + '</div><div class="dm-stub-n">' + esc(note) + '</div>';
      stage.appendChild(d);
    };
  }
  LENS_IMPL.sources = function (stage, cs, sdk, cfg, api, setPaint) {
    var tb = eln('div', 'dm-liens-tb'); tb.appendChild(eln('span', 'dm-hint', 'tick what the table confirmed — solidity recomputes and feeds every lens'));
    var fwrap = eln('span', 'dm-srf-wrap'); tb.appendChild(fwrap);
    var cur = (cs.view.sources && cs.view.sources.filter) || 'all';
    ['all', 'unconfirmed', 'single', 'corroborated'].forEach(function (f) { var b = eln('button', 'dm-btn dm-srf' + (f === cur ? ' on' : ''), f); b.onclick = function () { cs.view.sources = { filter: f }; api.save(); api.rerender(); }; fwrap.appendChild(b); });
    stage.appendChild(tb);
    var pane = eln('div', 'dm-sr-pane'); stage.appendChild(pane);
    var spine = eln('div', 'dm-sr-spine'); pane.appendChild(spine);
    var items = cs.nodes.filter(function (n) { return ['claim', 'evidence', 'entity', 'event', 'source'].indexOf(n.kind) >= 0; });
    items = items.filter(function (n) { var c = n.cred | 0; if (cur === 'unconfirmed') return c === 0; if (cur === 'single') return c === 1; if (cur === 'corroborated') return c >= 2; return true; });
    if (!items.length) { pane.appendChild(eln('div', 'dm-empty', 'No claims or evidence match this filter. Add nodes on LINKS, or clear the filter.')); setPaint(function () { }); return; }
    function recompute(n) { var c = n.checks || {}, s = 0; if (c.called) s++; if (c.second) s++; if (c.document) s++; if (c.onRecord) s++; n.cred = s >= 3 ? 3 : s; n.verify = n.cred >= 3 ? 'confirmed' : (n.cred >= 2 ? 'corroborated' : 'unverified'); }
    items.forEach(function (n, i) {
      n.checks = n.checks || { called: false, second: false, document: false, onRecord: false };
      var card = eln('div', 'dm-sr-card ' + (i % 2 ? 'r' : 'l') + (cs.view.sel === n.id ? ' sel' : ''));
      var solid = n.cred >= 2 ? '✓ solid' : (n.cred === 1 ? 'single-source' : '？ unconfirmed');
      var h = eln('div', 'dm-sr-h', '<span class="dm-sr-g">' + esc(NODE_GLYPH[n.kind] || '▪') + '</span><b>' + esc(n.label) + '</b><span class="dm-sr-cred">' + credBar(n.cred) + '</span>');
      h.onclick = function () { api.select(n.id); };
      card.appendChild(h);
      card.appendChild(eln('div', 'dm-sr-solid' + (n.cred >= 2 ? ' ok' : (n.cred === 0 ? ' bad' : '')), solid));
      var chk = eln('div', 'dm-sr-checks');
      [['called', 'called the source'], ['second', '2nd independent source'], ['document', 'documentary proof'], ['onRecord', 'on the record']].forEach(function (p) {
        var lab = eln('label', 'dm-sr-chk'); var cb = eln('input'); cb.type = 'checkbox'; cb.checked = !!n.checks[p[0]];
        cb.onchange = function () { n.checks[p[0]] = cb.checked; recompute(n); api.save(); api.rerender(); };
        lab.appendChild(cb); lab.appendChild(eln('span', null, p[1])); chk.appendChild(lab);
      });
      card.appendChild(chk);
      spine.appendChild(card);
    });
    setPaint(function () { });
  };

  LENS_IMPL.timeline = function (stage, cs, sdk, cfg, api, setPaint) {
    var tb = eln('div', 'dm-liens-tb'); tb.appendChild(eln('span', 'dm-hint', 'set a “when” (hours) below to reconstruct the sequence — the ingestion surface')); stage.appendChild(tb);
    var pane = eln('div', 'dm-tl-pane'); stage.appendChild(pane);
    var axis = eln('div', 'dm-tl-axis'); pane.appendChild(axis);
    var dated = cs.nodes.filter(function (n) { return n.when != null; }).sort(function (a, b) { return a.when - b.when; });
    var mn = 0, mx = 100;
    if (dated.length) { mn = dated[0].when; mx = dated[dated.length - 1].when; if (mn === mx) { mn -= 10; mx += 10; } }
    function xOf(w) { return ((w - mn) / (mx - mn || 1)) * 88 + 6; }
    if (!dated.length) axis.appendChild(eln('div', 'dm-empty', 'No dated events yet.'));
    dated.forEach(function (n, i) {
      var m = eln('div', 'dm-tl-node' + (cs.view.sel === n.id ? ' sel' : '') + (i % 2 ? ' lo' : ''));
      m.style.left = xOf(n.when) + '%';
      m.innerHTML = '<div class="dm-tl-lab">' + esc(n.label) + '</div><div class="dm-tl-dot"></div><div class="dm-tl-when">t+' + n.when + 'h</div>';
      m.onclick = function () { api.select(n.id); }; axis.appendChild(m);
    });
    var tray = eln('div', 'dm-tl-tray'); pane.appendChild(tray);
    tray.appendChild(eln('div', 'dm-doss-h', 'WHEN (hours from case start)'));
    cs.nodes.forEach(function (n) {
      var row = eln('div', 'dm-tl-row'); row.appendChild(eln('span', 'dm-tl-rl', '<span class="dm-sr-g">' + esc(NODE_GLYPH[n.kind] || '▪') + '</span>' + esc(n.label)));
      var inp = eln('input', 'dm-in dm-tl-in'); inp.type = 'number'; inp.placeholder = '—'; if (n.when != null) inp.value = n.when;
      inp.oninput = function () { n.when = inp.value === '' ? null : (+inp.value); api.save(); };
      inp.onchange = function () { api.rerender(); };
      row.appendChild(inp); tray.appendChild(row);
    });
    setPaint(function () { });
  };
  var HEAT_RUNGS = [['CLEAR', 0], ['CEASE & DESIST', 25], ['JAMMING / TAKEDOWN', 50], ['RAID', 75], ['ARREST / SANCTION', 90]];
  LENS_IMPL.heat = function (stage, cs, sdk, cfg, api, setPaint) {
    var pane = eln('div', 'dm-heat-pane'); stage.appendChild(pane);
    var maxHeat = (cs.heat && cs.heat.level) || 0;
    cs.nodes.forEach(function (n) { maxHeat = Math.max(maxHeat, (n.heat && n.heat.legal) || 0); });
    var ladder = eln('div', 'dm-heat-ladder'); pane.appendChild(ladder);
    ladder.appendChild(eln('div', 'dm-doss-h', 'LEGAL HEAT — ESCALATION LADDER'));
    HEAT_RUNGS.slice().reverse().forEach(function (r) {
      ladder.appendChild(eln('div', 'dm-heat-rung' + (maxHeat >= r[1] && r[1] > 0 ? ' on' : ''), '<span class="dm-heat-thr">' + r[1] + '</span><span>' + esc(r[0]) + '</span>'));
    });
    ladder.appendChild(eln('div', 'dm-heat-gauge', 'case heat <b>' + maxHeat + '</b>/100 <span class="dm-muted">· table-set; the app never triggers a raid</span>'));
    var list = eln('div', 'dm-heat-list'); pane.appendChild(list);
    list.appendChild(eln('div', 'dm-doss-h', 'PER-NODE HEAT / THREAT (ingest table fallout)'));
    if (!cs.nodes.length) list.appendChild(eln('div', 'dm-muted', 'No nodes yet.'));
    cs.nodes.forEach(function (n) {
      n.heat = n.heat || { legal: 0, threat: 0, adversary: null };
      var row = eln('div', 'dm-heat-row' + (cs.view.sel === n.id ? ' sel' : ''));
      var nm = eln('span', 'dm-heat-nm', (n.shielded ? '▨ ' : '') + esc(NODE_GLYPH[n.kind] || '▪') + ' ' + esc(n.label)); nm.onclick = function () { api.select(n.id); }; row.appendChild(nm);
      var steps = eln('span', 'dm-heat-steps');
      function stepper(labl, key) {
        var w = eln('span', 'dm-heat-st'); w.appendChild(eln('span', 'dm-heat-stl', labl));
        var mi = eln('button', 'dm-btn dm-z', '－'), val = eln('span', 'dm-heat-val', String(n.heat[key] || 0)), pl = eln('button', 'dm-btn dm-z', '＋');
        mi.onclick = function () { n.heat[key] = clampn((n.heat[key] || 0) - 10, 0, 100); api.save(); api.rerender(); };
        pl.onclick = function () { n.heat[key] = clampn((n.heat[key] || 0) + 10, 0, 100); api.save(); api.rerender(); };
        w.appendChild(mi); w.appendChild(val); w.appendChild(pl); return w;
      }
      steps.appendChild(stepper('legal', 'legal')); steps.appendChild(stepper('threat', 'threat'));
      var sh = eln('button', 'dm-btn dm-heat-shield' + (n.shielded ? ' on' : ''), n.shielded ? '▨ shielded' : 'shield');
      sh.onclick = function () { n.shielded = !n.shielded; api.save(); api.rerender(); };
      steps.appendChild(sh); row.appendChild(steps); list.appendChild(row);
    });
    setPaint(function () { });
  };

  var NC_DISTRICTS = ['City Center', 'Watson', 'Heywood', 'Westbrook', 'Pacifica', 'Santo Domingo', 'Badlands', 'Combat Zone'];
  LENS_IMPL.carte = function (stage, cs, sdk, cfg, api, setPaint) {
    var pane = eln('div', 'dm-carte-pane'); stage.appendChild(pane);
    var grid = eln('div', 'dm-carte-grid'); pane.appendChild(grid);
    NC_DISTRICTS.forEach(function (d) {
      var cell = eln('div', 'dm-carte-cell'); cell.appendChild(eln('div', 'dm-carte-dn', esc(d)));
      cs.nodes.filter(function (n) { return n.where && n.where.district === d; }).forEach(function (n) {
        var chip = eln('div', 'dm-carte-chip' + (cs.view.sel === n.id ? ' sel' : ''), esc(NODE_GLYPH[n.kind] || '▪') + ' ' + esc(n.label));
        chip.onclick = function () { api.select(n.id); }; cell.appendChild(chip);
      });
      grid.appendChild(cell);
    });
    var tray = eln('div', 'dm-carte-tray'); pane.appendChild(tray);
    tray.appendChild(eln('div', 'dm-doss-h', 'PLACE NODES — where did it happen?'));
    cs.nodes.forEach(function (n) {
      var row = eln('div', 'dm-tl-row'); row.appendChild(eln('span', 'dm-tl-rl', '<span class="dm-sr-g">' + esc(NODE_GLYPH[n.kind] || '▪') + '</span>' + esc(n.label)));
      var selD = eln('select', 'dm-in dm-carte-sel'); var o0 = eln('option', null, '—'); o0.value = ''; selD.appendChild(o0);
      NC_DISTRICTS.forEach(function (d) { var o = eln('option', null, d); o.value = d; if (n.where && n.where.district === d) o.selected = true; selD.appendChild(o); });
      selD.onchange = function () { n.where = selD.value ? { district: selD.value } : null; api.save(); api.rerender(); };
      row.appendChild(selD); tray.appendChild(row);
    });
    setPaint(function () { });
  };
  LENS_IMPL.montage = function (stage, cs, sdk, cfg, api) {
    var host = eln('div', 'dm-lens-compose'); stage.appendChild(host);
    renderComposer(host, cs, sdk, cfg, function () { api.save(); });
  };
  LENS_IMPL.war = function (stage, cs, sdk, cfg, api, setPaint) {
    var pane = eln('div', 'dm-war-pane'); stage.appendChild(pane);
    var cols = eln('div', 'dm-war-cols'); pane.appendChild(cols);
    cs.claims = cs.claims || [];
    function editClaim(c) {
      var m = eln('div', 'dm-pop'); m.appendChild(eln('div', 'dm-pop-h', esc(c.text)));
      [['reach', 'reach'], ['cred', 'credibility'], ['momentum', 'momentum']].forEach(function (p) {
        var b = eln('button', 'dm-pop-b', 'set ' + p[1] + ' (' + (c[p[0]] || 0) + ')');
        b.onclick = function () { m.remove(); if (App.prompt) App.prompt('Edit claim', p[1] + ' (number)', String(c[p[0]] || 0), function (v) { if (v != null) { c[p[0]] = +v || 0; if ((c.cred || 0) < 30 && (c.momentum || 0) < 0) c.state = 'collapsing'; api.save(); api.rerender(); } }); };
        m.appendChild(b);
      });
      var st = eln('button', 'dm-pop-b', 'cycle stance');
      st.onclick = function () { var o = ['ours', 'neutral', 'their']; c.stance = o[(o.indexOf(c.stance || 'ours') + 1) % 3]; m.remove(); api.save(); api.rerender(); }; m.appendChild(st);
      var del = eln('button', 'dm-pop-x', 'delete claim'); del.onclick = function () { cs.claims = cs.claims.filter(function (x) { return x.id !== c.id; }); m.remove(); api.save(); api.rerender(); }; m.appendChild(del);
      stage.appendChild(m);
    }
    [['ours', 'OUR NARRATIVE'], ['neutral', 'CONTESTED'], ['their', 'COUNTER-NARRATIVE']].forEach(function (L) {
      var col = eln('div', 'dm-war-col'); col.appendChild(eln('div', 'dm-war-h' + (L[0] === 'their' ? ' their' : ''), L[1]));
      cs.claims.filter(function (c) { return (c.stance || 'ours') === L[0]; }).forEach(function (c) {
        var mom = c.momentum || 0;
        var card = eln('div', 'dm-war-card' + ((c.cred || 0) < 30 && mom < 0 ? ' collapsing' : ''));
        card.innerHTML = '<div class="dm-war-txt">' + esc(c.text || '(claim)') + '</div>' +
          '<div class="dm-war-meters"><span>reach ' + (c.reach || 0) + '</span><span>cred ' + (c.cred || 0) + '</span><span class="' + (mom < 0 ? 'dm-red' : '') + '">mom ' + (mom > 0 ? '+' : '') + mom + '</span></div>';
        card.onclick = function () { editClaim(c); }; col.appendChild(card);
      });
      var add = eln('button', 'dm-btn dm-war-add', '＋ claim');
      add.onclick = function () { if (App.prompt) App.prompt('New claim', 'Claim (a story\'s thesis)', '', function (v) { if (v) { cs.claims.push({ id: uid('c'), text: v, stance: L[0], sources: [], counters: [], channel: null, reach: 0, cred: 0, momentum: 0, state: 'live' }); api.save(); api.rerender(); } }); };
      col.appendChild(add); cols.appendChild(col);
    });
    if (!cs.claims.length) pane.appendChild(eln('div', 'dm-muted dm-war-hint', 'Map the information war: add claims to OUR / CONTESTED / COUNTER lanes. Reach, credibility and momentum are ingested at the Settle-the-Cycle tick — the app never rolls the outcome.'));
    setPaint(function () { });
  };

  /* ═══════════════ the newsroom shell (mediaApp engine) ═══════════════ */
  var SECTION_LABEL = { desk: 'DESK', cases: 'PIECES', compose: 'COMPOSE', publish: 'PUBLISH', analytics: 'TRAFFIC', gmctl: 'CONTROL ROOM' };

  /* per-suite identity: a distinct skin (layout + look), tagline, pitch, and signature panel */
  var SKINS = {
    corpo:      { skin: 'broadcast', tagline: 'THE NETWORK',   pitch: 'Run the rundown, chase the ratings, air the story the sponsors can live with.', sig: 'ratings' },
    indie:      { skin: 'press',     tagline: 'THE FREE PRESS', pitch: 'Chase the scoop, verify every source, print what the corps want buried.',       sig: 'frontpage' },
    leak:       { skin: 'deaddrop',  tagline: 'ANONYMOUS DROP', pitch: 'Take the data, shield the source, mirror it before they scrub it.',             sig: 'drop' },
    braindance: { skin: 'tabloid',   tagline: 'SENSE / NET',    pitch: 'Cut the clip, ride the buzz, run the smear. Truth optional.',                   sig: 'trending' },
    pirate:     { skin: 'rig',       tagline: 'PIRATE SIGNAL',  pitch: 'Broadcast from nowhere, move the crowd, vanish before the raid.',               sig: 'signal' }
  };

  function reachTotal(stories) { var t = 0; stories.forEach(function (o) { t += (o.s.reachSeed || 0); }); return t; }
  function renderSignature(host, sig, ctx) {
    var stories = ctx.stories || [], n = stories.length;
    if (sig === 'ratings') {
      host.classList.add('dm-sig-ratings');
      host.innerHTML = '<div class="dm-sig-h">● ON AIR — NIELSEN SHARE</div><div class="dm-rat-num">' + Math.min(99, Math.round(reachTotal(stories) / 400)) + '<span>%</span></div>';
      var rd = eln('div', 'dm-rundown'); rd.appendChild(eln('div', 'dm-rd-h', 'THE RUNDOWN'));
      if (!n) rd.appendChild(eln('div', 'dm-muted', 'Dead air. Compose a segment.'));
      stories.slice(0, 6).forEach(function (o, i) { rd.appendChild(eln('div', 'dm-rd-row', '<span class="dm-rd-slot">' + String.fromCharCode(65 + i) + '</span><span class="dm-rd-t">' + esc(o.s.headline || '(untitled)') + '</span><span class="dm-rd-r">' + (o.s.reachSeed || 0) + '</span>')); });
      host.appendChild(rd);
    } else if (sig === 'frontpage') {
      host.classList.add('dm-sig-front');
      var lead = stories[0];
      host.innerHTML = '<div class="dm-front-rule">LATE CITY EDITION · UNCENSORED · No.' + (n + 1) + '</div>' +
        (lead ? '<div class="dm-front-lead">' + esc(lead.s.headline || '') + '</div><div class="dm-front-dek">' + esc(lead.s.dek || '') + '</div>'
              : '<div class="dm-front-cold">THE PRESSES ARE COLD.<span>Verify a scoop, then put it on the front page.</span></div>');
    } else if (sig === 'drop') {
      host.classList.add('dm-sig-drop');
      host.innerHTML = '<div class="dm-drop-box">DROP DATA HERE<span>pull a leaked file into a piece, then dump it</span></div>' +
        '<div class="dm-redact"><span></span><span></span><span></span></div>' +
        '<div class="dm-drop-switch">DEAD-MAN’S SWITCH · <b>' + (n ? 'ARMED' : 'IDLE') + '</b> · mirrors ' + n + '</div>';
    } else if (sig === 'trending') {
      host.classList.add('dm-sig-trend');
      host.innerHTML = '<div class="dm-sig-h">▲ TRENDING NOW</div>';
      var grid = eln('div', 'dm-trend-grid');
      if (!n) grid.appendChild(eln('div', 'dm-muted', 'Nothing trending. Go cut a clip.'));
      stories.slice(0, 6).forEach(function (o) { grid.appendChild(eln('div', 'dm-trend-tile', '<div class="dm-trend-thumb">▶</div><div class="dm-trend-cap">' + esc(o.s.headline || '') + '</div><div class="dm-trend-buzz">▲ ' + (o.s.reachSeed || 0) + '</div>')); });
      host.appendChild(grid);
    } else if (sig === 'signal') {
      host.classList.add('dm-sig-signal');
      var wave = ''; for (var i = 0; i < 44; i++) { wave += '<i style="height:' + (8 + ((i * 7 + n * 13) % 30)) + 'px"></i>'; }
      var mob = Math.min(100, n * 12 + 8);
      host.innerHTML = '<div class="dm-sig-h">◂ LIVE SIGNAL ▸</div><div class="dm-wave">' + wave + '</div>' +
        '<div class="dm-mob"><div class="dm-mob-l">MOBILIZATION</div><div class="dm-mob-bar"><i style="width:' + mob + '%"></i></div><div class="dm-mob-v">' + mob + '</div></div>';
    }
  }

  function mediaApp(win, sdk, cfg) {
    var body = win.body; body.innerHTML = '';
    var sk = SKINS[cfg.variant] || {};
    var root = eln('div', 'dm-root dm-variant-' + cfg.variant + ' dm-skin-' + (sk.skin || 'press')); body.appendChild(root);

    var st = { section: cfg.sections[0], caseId: null };
    var stored = sdk.store && sdk.store.get ? sdk.store.get('ui', null) : null;
    if (stored && stored.section && cfg.sections.indexOf(stored.section) >= 0) st.section = stored.section;
    function persistUi() { if (sdk.store) sdk.store.set('ui', { section: st.section, caseId: st.caseId }); }

    var rail = eln('div', 'dm-rail'); root.appendChild(rail);
    var main = eln('div', 'dm-main'); root.appendChild(main);

    var sections = cfg.sections.slice();
    if (isGM(sdk) && sections.indexOf('gmctl') < 0) sections.push('gmctl');

    function paintRail() {
      rail.innerHTML = '';
      var brand = eln('div', 'dm-brand'); brand.innerHTML = '<span class="dm-brand-n">' + esc(cfg.label) + '</span>';
      rail.appendChild(brand);
      rail.appendChild(eln('div', 'dm-brand-v', esc((SKINS[cfg.variant] || {}).tagline || cfg.vendor || '')));
      var nav = eln('div', 'dm-nav'); rail.appendChild(nav);
      sections.forEach(function (s) {
        var b = eln('button', 'dm-navb' + (st.section === s ? ' on' : ''), esc(SECTION_LABEL[s] || s));
        b.onclick = function () { st.section = s; if (s !== 'case') st.caseId = null; persistUi(); route(); };
        nav.appendChild(b);
      });
      var foot = eln('div', 'dm-rail-foot');
      var cred = credibilityOf(sdk);
      foot.innerHTML = '<span class="dm-cred">CRED <b>' + cred + '</b>/10</span>' + (isGM(sdk) ? '<span class="dm-gmtag">GM</span>' : '');
      rail.appendChild(foot);
    }

    function route() {
      Array.prototype.forEach.call(rail.querySelectorAll('.dm-navb'), function (b) { b.classList.remove('on'); });
      var idx = sections.indexOf(st.section === 'case' ? 'cases' : st.section);
      var btns = rail.querySelectorAll('.dm-navb'); if (btns[idx]) btns[idx].classList.add('on');
      main.innerHTML = '';
      if (st.section === 'case' && st.caseId) return viewCase();
      if (st.section === 'cases') return viewCases();
      if (st.section === 'compose') return viewCompose();
      if (st.section === 'publish') return viewCompose();
      if (st.section === 'analytics') return viewAnalytics();
      if (st.section === 'gmctl') return viewGmctl();
      return viewDesk();
    }

    function topbar(title, right) {
      var tb = eln('div', 'dm-top'); tb.appendChild(eln('div', 'dm-top-t', esc(title)));
      var r = eln('div', 'dm-top-r'); (right || []).forEach(function (el) { r.appendChild(el); }); tb.appendChild(r);
      return tb;
    }

    function viewDesk() {
      var sk = SKINS[cfg.variant] || {};
      var pane = eln('div', 'dm-pane dm-desk'); main.appendChild(pane);
      var cases = listCases(sdk);
      var stories = []; cases.forEach(function (c) { (c.stories || []).forEach(function (s) { stories.push({ s: s, c: c }); }); });

      var mast = eln('div', 'dm-mast');
      mast.innerHTML = '<div class="dm-mast-tag">' + esc(sk.tagline || cfg.vendor || '') + '</div>' +
        '<div class="dm-mast-name">' + esc(cfg.label) + '</div>' +
        '<div class="dm-mast-pitch">' + esc(sk.pitch || cfg.vendorAbout || '') + '</div>';
      pane.appendChild(mast);

      var acts = eln('div', 'dm-acts');
      function tile(label, sub, go) { var t = eln('button', 'dm-act', '<span class="dm-act-l">' + esc(label) + '</span><span class="dm-act-s">' + esc(sub) + '</span>'); t.onclick = go; acts.appendChild(t); }
      if (cfg.sections.indexOf('compose') >= 0) tile('NEW PIECE', 'op-ed · broadcast · exposé · investigation', startNewPiece);
      else tile('NEW INVESTIGATION', 'connect the dots', startNewCase);
      tile('OPEN A PIECE', cases.length + (cases.length === 1 ? ' piece' : ' pieces'), function () { st.section = 'cases'; persistUi(); route(); });
      if (cfg.sections.indexOf('compose') >= 0) tile(sk.sig === 'drop' ? 'DUMP DATA' : 'COMPOSE A STORY', 'publish to the Net', function () { st.section = 'compose'; persistUi(); route(); });
      if (cfg.sections.indexOf('analytics') >= 0) tile('TRAFFIC', stories.length + ' published', function () { st.section = 'analytics'; persistUi(); route(); });
      if (isGM(sdk)) tile('CONTROL ROOM', 'settle the cycle', function () { st.section = 'gmctl'; persistUi(); route(); });
      pane.appendChild(acts);

      // OFFERS & GIGS — everything the network is paying for, straight from the Control Room
      var offers = (mediaRead(sdk).offers || []), mkt = regieState(sdk).market;
      var _jj = sdk.sheet && sdk.sheet(), _press = (_jj && _jj.press) || {}, _taken = {};
      ((_press.contracts) || []).concat((_press.affiliations) || []).forEach(function (x) { if (x.sourceId) _taken[x.sourceId] = 1; });
      var openAds = (mkt.ads || []).filter(function (a) { return !a.hidden && !_taken[a.id]; });
      var openPosts = (mkt.posts || []).filter(function (p) { return !_taken[p.id]; });
      if (offers.length || openAds.length || openPosts.length) {
        var wireBox = eln('div', 'dm-wire'); pane.appendChild(wireBox);
        wireBox.appendChild(eln('div', 'dm-wire-h', 'OFFERS & GIGS'));
        offers.forEach(function (off) {
          var card = eln('div', 'dm-wire-offer');
          card.innerHTML = '<div class="dm-wire-k">SPONSOR</div>' +
            '<div class="dm-wire-b"><b>' + esc(off.client || 'a client') + '</b> · ' + esc(money(off.fee)) + ' · ' + esc(payoutLabel(off.payout)) + (off.disclose ? ' · disclosure required' : '') + '</div>' +
            (off.brief ? '<div class="dm-wire-brief">' + esc(off.brief) + '</div>' : '') +
            ((off.dossier && off.dossier.length) ? '<div class="dm-wire-brief">Dossier: ' + off.dossier.map(function (d) { return esc(d.title || 'file'); }).join(', ') + '</div>' : '');
          var a = eln('div', 'dm-wire-a');
          var acc = eln('button', 'dm-btn sm dm-primary', 'accept — start the piece'); acc.onclick = function () { acceptOffer(off); };
          var dec = eln('button', 'dm-btn sm', 'pass'); dec.onclick = function () { mediaWrite(sdk, function (m) { m.offers = (m.offers || []).filter(function (x) { return x.id !== off.id; }); }); route(); };
          a.appendChild(acc); a.appendChild(dec); card.appendChild(a); wireBox.appendChild(card);
        });
        openAds.forEach(function (ad) {
          var card = eln('div', 'dm-wire-offer');
          card.innerHTML = '<div class="dm-wire-k">AD DEAL</div>' +
            '<div class="dm-wire-b"><b>' + esc(ad.name || 'Ad deal') + '</b> · ' + esc(cpmLabel(ad.cpm)) + ' · ' + esc(ad.contentType || 'any') + ' content</div>' +
            '<div class="dm-wire-brief">Runs on your next piece; pays each cycle as views grow.</div>';
          var a = eln('div', 'dm-wire-a'); var take = eln('button', 'dm-btn sm dm-primary', 'take deal'); take.onclick = function () { acceptGig('ad', ad); };
          a.appendChild(take); card.appendChild(a); wireBox.appendChild(card);
        });
        openPosts.forEach(function (post) {
          var card = eln('div', 'dm-wire-offer');
          card.innerHTML = '<div class="dm-wire-k">POSITION</div>' +
            '<div class="dm-wire-b"><b>' + esc(post.role || 'freelance') + '</b> at <b>' + esc(post.outletName || 'outlet') + '</b>' + (post.role === 'staff' ? ' · ' + esc(money(post.pay)) + ' / piece · quota ' + (parseInt(post.quota, 10) || 0) : '') + '</div>';
          var a = eln('div', 'dm-wire-a'); var join = eln('button', 'dm-btn sm dm-primary', 'join'); join.onclick = function () { acceptGig('post', post); };
          a.appendChild(join); card.appendChild(a); wireBox.appendChild(card);
        });
      }

      var sig = eln('div', 'dm-sig'); pane.appendChild(sig);
      renderSignature(sig, sk.sig, { stories: stories, cases: cases, cfg: cfg });

      if (!cases.length) {
        var teach = eln('div', 'dm-teach');
        teach.innerHTML = '<div class="dm-teach-h">HOW IT WORKS — anyone can investigate; only media get heard</div>' +
          '<div class="dm-teach-steps">' +
          '<div class="dm-teach-step"><b>1 · INVESTIGATE</b><span>Open a piece, pull entities from your Files, draw the links (LINKS).</span></div>' +
          '<div class="dm-teach-step"><b>2 · VERIFY</b><span>Tick what the table confirmed (SOURCES) — solidity feeds every lens.</span></div>' +
          '<div class="dm-teach-step"><b>3 · PUBLISH</b><span>Compose a story — reach is gated by your Credibility.</span></div>' +
          '</div>';
        pane.appendChild(teach);
      }
    }

    function startNewCase() {
      function make(nm) { var cs = newCase(sdk, nm || 'Untitled piece', cfg.mediaLenses && cfg.mediaLenses.length > 0); st.caseId = cs.id; st.section = 'case'; persistUi(); route(); }
      if (App.prompt) App.prompt('New investigation', 'Title', '', function (v) { if (v != null) make(v); }); else make('Untitled piece');
    }
    // A sponsor brief the GM sent: a commissioned piece with the client's files + an advertorial contract.
    function acceptOffer(off) {
      var j = sdk.sheet && sdk.sheet(), c = camp(sdk);
      var cs = newCase(sdk, off.client ? ('Sponsored: ' + off.client) : 'Commissioned piece', cfg.mediaLenses && cfg.mediaLenses.length > 0);
      cs.track = 'investigation'; cs.commissioned = true; cs.discloseRequired = !!off.disclose; cs.sponsorClient = off.client || '';
      if (off.brief) addNode(cs, { label: 'Client brief', kind: 'note', note: off.brief });
      (off.dossier || []).forEach(function (d) { addNode(cs, { label: d.title || 'File', kind: 'evidence', note: d.note || '' }); });
      saveCase(sdk, cs);
      if (j && c && c.publishSheet) {
        j.press = j.press || {}; j.press.contracts = j.press.contracts || [];
        j.press.contracts.push({ id: uid('ct'), mode: 'advertorial', status: 'active', client: off.client || '', subject: '', fee: parseInt(off.fee, 10) || 0, payout: off.payout || { metric: 'onPublish' }, disclosed: true, discloseRequired: !!off.disclose, sourceId: off.id, caseId: cs.id, notes: off.brief || '' });
        c.publishSheet(sid(sdk), j.handle || j.name || 'PC', j);
      }
      mediaWrite(sdk, function (m) { m.offers = (m.offers || []).filter(function (x) { return x.id !== off.id; }); });
      st.section = 'case'; st.caseId = cs.id; persistUi();
      sdk.notify('Sponsor accepted — a commissioned piece. ' + money(off.fee) + ', ' + payoutLabel(off.payout) + '.'); route();
    }
    // Take an open marketplace item (ad deal or affiliation post) → a contract/affiliation on the Press Card.
    function acceptGig(kind, item) {
      var j = sdk.sheet && sdk.sheet(), c = camp(sdk);
      if (!j || !c || !c.publishSheet) { sdk.notify('No live session.'); return; }
      j.press = j.press || {}; j.press.contracts = j.press.contracts || []; j.press.affiliations = j.press.affiliations || [];
      if (j.press.contracts.some(function (x) { return x.sourceId === item.id; }) || j.press.affiliations.some(function (x) { return x.sourceId === item.id; })) { sdk.notify('You already took this.'); return; }
      if (kind === 'ad') {
        j.press.contracts.push({ id: uid('ct'), mode: 'adregie', status: 'active', client: item.name || 'Ad deal', siteName: '', cpm: parseInt(item.cpm, 10) || 0, contentType: item.contentType || 'any', sourceId: item.id, paidViews: 0, notes: '' });
        sdk.notify('Ad deal added to your Press Card.');
      } else {
        j.press.affiliations.push({ id: uid('af'), sourceId: item.id, outlet: item.outletName || '', outletId: item.outletId || '', rel: item.role || 'freelance', pass: '' });
        if (item.role === 'staff') j.press.contracts.push({ id: uid('ct'), mode: 'staff', status: 'active', outlet: item.outletName || '', pay: parseInt(item.pay, 10) || 0, per: 'article', quota: parseInt(item.quota, 10) || 0, filled: 0, sourceId: item.id, notes: '' });
        sdk.notify('Joined ' + (item.outletName || 'the outlet') + '.');
      }
      c.publishSheet(sid(sdk), j.handle || j.name || 'PC', j); route();
    }
    function startNewPiece() {
      if (cfg.sections.indexOf('compose') < 0) return startNewCase();
      main.innerHTML = '';
      var back = eln('button', 'dm-btn', '‹ desk'); back.onclick = function () { route(); };
      main.appendChild(topbar(cfg.label + ' · NEW PIECE', [back]));
      var pane = eln('div', 'dm-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'dm-cf-l', 'WHAT ARE YOU PUBLISHING?'));
      pane.appendChild(eln('div', 'dm-track-hint', 'The track sets what you prove and what drives your reach. Provenance (a client-commissioned piece) is a toggle you add later, on any track.'));
      var grid = eln('div', 'dm-track-grid'); pane.appendChild(grid);
      TRACKS.forEach(function (tk) {
        var ti = TRACK_INFO[tk];
        var card = eln('button', 'dm-track-card', '<span class="dm-track-h">' + esc(ti.label) + '</span><span class="dm-track-c">' + esc(ti.card) + '</span><span class="dm-track-go">' + (tk === 'investigation' ? 'build the board →' : 'compose →') + '</span>');
        card.onclick = function () {
          function make(nm) {
            var cs = newCase(sdk, nm || ti.label, cfg.mediaLenses && cfg.mediaLenses.length > 0);
            cs.track = tk; saveCase(sdk, cs);
            if (tk === 'investigation') { st.section = 'case'; st.caseId = cs.id; }
            else { st.section = 'compose'; st.composeCaseId = cs.id; }
            persistUi(); route();
          }
          var lbl = tk === 'investigation' ? 'Title' : 'Working title';
          if (App.prompt) App.prompt(ti.label, lbl, '', function (v) { if (v != null) make(v); }); else make('');
        };
        grid.appendChild(card);
      });
    }
    function viewCases() {
      var newBtn = eln('button', 'dm-btn dm-primary', 'new piece');
      newBtn.onclick = cfg.sections.indexOf('compose') >= 0 ? startNewPiece : startNewCase;
      main.appendChild(topbar(cfg.label + ' · PIECES', [newBtn]));
      var pane = eln('div', 'dm-pane'); main.appendChild(pane);
      var cases = listCases(sdk);
      if (!cases.length) { pane.appendChild(eln('div', 'dm-empty', 'No pieces yet. Every player can investigate — connect entities, evidence and events into a piece, then (if you\'re media) publish.')); return; }
      var list = eln('div', 'dm-caselist'); pane.appendChild(list);
      cases.forEach(function (c) {
        var row = eln('div', 'dm-caserow');
        row.innerHTML = '<div class="dm-caserow-n">' + esc(c.name) + (c.media ? ' <span class="dm-tag">media</span>' : '') + '</div>' +
          '<div class="dm-caserow-m">' + c.nodes.length + ' nodes · ' + c.links.length + ' links · ' + (c.stories || []).length + ' stories</div>';
        var open = eln('button', 'dm-btn', 'open'); open.onclick = function () { st.caseId = c.id; st.section = 'case'; persistUi(); route(); };
        var del = eln('button', 'dm-btn dm-del', 'delete'); del.onclick = function (e) { e.stopPropagation(); deleteCase(sdk, c.id); route(); };
        var acts = eln('div', 'dm-caserow-a'); acts.appendChild(open); acts.appendChild(del); row.appendChild(acts);
        row.querySelector('.dm-caserow-n').onclick = open.onclick;
        list.appendChild(row);
      });
    }

    function viewCase() {
      var cs = loadCase(sdk, st.caseId);
      if (!cs) { st.section = 'cases'; return route(); }
      var back = eln('button', 'dm-btn', '‹ cases'); back.onclick = function () { st.section = 'cases'; st.caseId = null; persistUi(); route(); };
      var ren = eln('div', 'dm-case-name', esc(cs.name));
      main.appendChild(topbar('', [back]));
      var head = main.querySelector('.dm-top-t'); if (head) head.appendChild(ren);
      var boardHost = eln('div', 'dm-boardhost'); main.appendChild(boardHost);
      renderBoard(boardHost, cs, sdk, cfg, function () { saveCase(sdk, cs); });
    }

    function viewStub(title, note) {
      main.appendChild(topbar(cfg.label + ' · ' + title));
      var pane = eln('div', 'dm-pane'); main.appendChild(pane);
      var d = eln('div', 'dm-lens-stub'); d.innerHTML = '<div class="dm-stub-t">' + esc(title) + '</div><div class="dm-stub-n">' + esc(note) + '</div>'; pane.appendChild(d);
    }

    function viewCompose() {
      main.appendChild(topbar(cfg.label + ' · COMPOSE'));
      var pane = eln('div', 'dm-pane'); main.appendChild(pane);
      var cases = listCases(sdk);
      if (!cases.length) { pane.appendChild(eln('div', 'dm-empty', 'Create a case first (CASES), build the board, then compose from it.')); return; }
      pane.appendChild(eln('div', 'dm-cf-l', 'COMPOSE FROM CASE'));
      var pick = eln('select', 'dm-in dm-pickcase');
      cases.forEach(function (c) { var o = eln('option', null, c.name + ' (' + c.nodes.length + ' nodes)'); o.value = c.id; pick.appendChild(o); });
      var chosen = (st.composeCaseId && cases.filter(function (c) { return c.id === st.composeCaseId; })[0]) ? st.composeCaseId : cases[0].id;
      pick.value = chosen; pane.appendChild(pick);
      var host = eln('div', 'dm-compose-host'); pane.appendChild(host);
      function load(id) { st.composeCaseId = id; var cs2 = loadCase(sdk, id); host.innerHTML = ''; if (cs2) renderComposer(host, cs2, sdk, cfg, function () { saveCase(sdk, cs2); }); }
      pick.onchange = function () { load(pick.value); };
      load(chosen);
    }

    function viewAnalytics() {
      var st2 = { tab: mediaRead(sdk)._anTab === 'content' ? 'content' : 'sites' };
      main.appendChild(topbar(cfg.label + ' · TRAFFIC'));
      var tabs = eln('div', 'dm-antabs'); main.appendChild(tabs);
      var pane = eln('div', 'dm-pane'); main.appendChild(pane);
      function paintTabs() {
        tabs.innerHTML = '';
        [['sites', 'SITES', 'your outlets & hosted sites'], ['content', 'CONTENT', 'your published stories']].forEach(function (t) {
          var b = eln('button', 'dm-antab' + (st2.tab === t[0] ? ' on' : ''), '<b>' + t[1] + '</b><span>' + t[2] + '</span>');
          b.onclick = function () { st2.tab = t[0]; mediaWrite(sdk, function (m) { m._anTab = t[0]; }); paintTabs(); paint(); };
          tabs.appendChild(b);
        });
      }
      function paint() { pane.innerHTML = ''; if (st2.tab === 'content') paintContent(); else paintSites(); }
      function paintSites() {
        pane.appendChild(eln('div', 'dm-an-note', 'Sites you own. Live traffic + income settle in the GM’s Net “Traffic” watch each cycle.'));
        var list = eln('div', 'dm-caselist'); pane.appendChild(list);
        var mySid = sid(sdk);
        Promise.resolve(window.Store && window.Store.index && window.Store.index('site')).then(function (rows) {
          var mine = (rows || []).filter(function (r) { return r.json && r.json.owner === mySid; });
          if (!mine.length) { list.appendChild(eln('div', 'dm-empty', 'You don’t own any sites yet. Publish a story (it can spin up your outlet) or host a site.')); return; }
          mine.forEach(function (r) {
            var s = r.json, row = eln('div', 'dm-an-row');
            row.innerHTML = '<div class="dm-an-h">' + esc(s.name || 'site') + (s.app === 'press' ? ' <span class="dm-tag">press</span>' : (s.app ? ' <span class="dm-tag">app</span>' : '')) + '</div>' +
              '<div class="dm-an-meters"><span class="dm-meter">BUZZ <b>' + Math.round(s.buzz || 0) + '</b></span><span class="dm-meter">REP <b>' + Math.round(s.rep || 0) + '</b></span><span class="dm-meter">' + esc(s.broadcast || 'citywide') + '</span><span class="dm-meter">' + ((s.state && s.state.online === false) ? 'offline' : '<b>online</b>') + '</span></div>';
            var open = eln('button', 'dm-btn', 'open'); open.onclick = function () { if (sdk.shell && sdk.shell.openEntity) sdk.shell.openEntity('site', s.id, s.name); }; row.appendChild(open);
            list.appendChild(row);
          });
        }).catch(function () { list.appendChild(eln('div', 'dm-empty', 'Could not load your sites.')); });
      }
      function paintContent() {
        var rows = []; listCases(sdk).forEach(function (c) { (c.stories || []).forEach(function (s) { rows.push({ s: s, c: c }); }); });
        if (!rows.length) { pane.appendChild(eln('div', 'dm-empty', 'No published stories yet — compose one from a case.')); return; }
        pane.appendChild(eln('div', 'dm-an-note', 'Everything you’ve published. Reach = the credibility-scaled seed at publish; the outlet’s live traffic settles on the Net.'));
        rows.forEach(function (o) {
          var row = eln('div', 'dm-an-row');
          row.innerHTML = '<div class="dm-an-h">' + esc(o.s.headline || '(untitled)') + '</div>' +
            '<div class="dm-an-meters"><span class="dm-meter">REACH <b>' + esc(String(o.s.reachSeed != null ? o.s.reachSeed : '—')) + '</b></span>' +
            '<span class="dm-meter">CRED <b>' + credibilityOf(sdk) + '</b>/10</span>' +
            '<span class="dm-meter">' + (o.s.publishedSiteId ? '<b>LIVE</b>' : 'draft') + '</span></div>' +
            '<div class="dm-an-m2">' + esc(o.s.postType || '') + ' · ' + esc(o.c.name) + (o.s.outletName ? ' → ' + esc(o.s.outletName) : '') + '</div>';
          var acts = eln('div', 'dm-an-acts');
          if (o.s.publishedSiteId) { var op = eln('button', 'dm-btn', '↗ open'); op.onclick = function () { openArticle(sdk, o.s.publishedSiteId); }; acts.appendChild(op); }
          var del = eln('button', 'dm-btn dm-del', '✕'); del.title = 'delete this article from the site'; del.onclick = function () { deletePublished(sdk, o.s, function () { paint(); }); }; acts.appendChild(del);
          row.appendChild(acts); pane.appendChild(row);
        });
      }
      paintTabs(); paint();
    }

    function viewGmctl() {
      main.appendChild(topbar(cfg.label + ' · CONTROL ROOM'));
      var pane = eln('div', 'dm-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'dm-desk-about', 'GM tools live in the CONTROL ROOM — the network’s desk: monitor every outlet, boost or bury stories, run the narrative war, set what the desk can earn, and settle the cycle. You ingest the table’s results; nothing here rolls dice.'));
      var open = eln('button', 'dm-btn dm-primary', 'open the control room');
      open.onclick = function () { try { sdk.open('regie'); } catch (e) {} };
      pane.appendChild(open);
    }

    paintRail(); route();
    win.setTitle(cfg.label);
  }

  /* ═══════════════ the five suite cfgs ═══════════════ */
  var CFG = {
    corpo: {
      id: 'media-corpo', variant: 'corpo', label: 'PRIMETIME', glyph: '◉', vendor: 'Network 54',
      sections: ['desk', 'cases', 'compose', 'publish', 'analytics'],
      lenses: ['liens', 'timeline', 'sources', 'heat'], mediaLenses: ['montage'],
      foreground: ['montage', 'timeline'], defaultLens: 'liens',
      publish: { model: 'platform', defaultBroadcast: 'citywide', postTypes: ['broadcast', 'video'], licensed: true, twoStep: true },
      money: { ads: true, adRate: 1.2, subs: false, donations: false, sponsors: true },
      cred: { reachCoeff: 0.11, credBase: 0.6, assignable: true }, meter: { primary: 'share' },
      preset: 'screamsheet', minPower: 4, cost: 750,
      vendorAbout: 'Network 54 · PRIMETIME producer suite. City-wide reach, sponsor retainers, a ratings war — and a network that reads your drafts. The truth is what airs.',
      commentPools: ['loyal', 'astroturf', 'skeptic']
    },
    indie: {
      id: 'media-indie', variant: 'indie', label: 'SAMIZDAT', glyph: '✶', vendor: 'open-source',
      sections: ['desk', 'cases', 'compose', 'analytics'],
      lenses: ['liens', 'timeline', 'sources', 'heat'], mediaLenses: ['montage'],
      foreground: ['sources', 'heat'], defaultLens: 'sources',
      publish: { model: 'standalone', defaultBroadcast: 'district', postTypes: ['article'], licensed: false, twoStep: false },
      money: { ads: false, adRate: 0, subs: true, subPrice: 50, donations: true, sponsors: false },
      cred: { reachCoeff: 0.13, credBase: 0.45, earned: true }, meter: { primary: 'reach' },
      preset: 'zine', minPower: 3, cost: 0,
      vendorAbout: 'SAMIZDAT · a scrappy open-source screamsheet kit. No ads, no masters — reader-funded, subpoena-hunted. Credibility is earned scoop by verified scoop.',
      commentPools: ['grateful', 'cynical', 'threatened']
    },
    leak: {
      id: 'media-leak', variant: 'leak', label: 'DEADMAN', glyph: '☠', vendor: 'Bartmoss bench',
      sections: ['desk', 'cases', 'compose'],
      lenses: ['liens', 'timeline', 'sources', 'heat'], mediaLenses: [],
      foreground: ['sources', 'heat', 'liens'], defaultLens: 'sources',
      publish: { model: 'standalone', defaultBroadcast: 'citywide', postTypes: ['dump'], licensed: false, twoStep: false },
      money: { ads: false, adRate: 0, subs: false, donations: true, bounties: true, sponsors: false }, meter: { primary: 'reach' },
      cred: { reachCoeff: 0, credBase: 1.0, decoupled: true },
      preset: 'zine', minPower: 3, cost: 0,
      vendorAbout: 'DEADMAN · an anonymous dead-drop toolkit in the spirit of Rache Bartmoss. The data is the story. No byline, mirrored everywhere, a dead-man’s switch. Reach = corroboration, not fame.',
      commentPools: ['paranoid', 'zealot', 'debunker']
    },
    braindance: {
      id: 'media-braindance', variant: 'braindance', label: 'SPLICE', glyph: '◈', vendor: 'DMS',
      sections: ['desk', 'cases', 'compose', 'publish', 'analytics'],
      lenses: ['liens', 'timeline', 'sources', 'heat'], mediaLenses: ['montage'],
      foreground: ['montage', 'timeline'], defaultLens: 'montage',
      publish: { model: 'standalone', defaultBroadcast: 'citywide', postTypes: ['braindance', 'tabloid'], licensed: true, twoStep: false },
      money: { ads: true, adRate: 3, subs: false, donations: false, doses: true, sponsors: true }, meter: { primary: 'reach' },
      cred: { reachCoeff: 0.02, credBase: 1.4, decoupled: true },
      preset: 'chrome', minPower: 4, cost: 300,
      vendorAbout: 'SPLICE by DMS · a braindance + tabloid studio. Upload a "sample", ride the buzz, run a smear for hire. Truth optional; sensation pays. Credibility only sets how long a fabrication holds.',
      commentPools: ['thirsty', 'outrage', 'stan']
    },
    pirate: {
      id: 'media-pirate', variant: 'pirate', label: 'GHOST FREQ', glyph: '⚑', vendor: 'street rig',
      sections: ['desk', 'cases', 'compose'],
      lenses: ['liens', 'timeline', 'sources', 'heat'], mediaLenses: ['montage'],
      foreground: ['heat', 'montage'], defaultLens: 'liens',
      publish: { model: 'standalone', defaultBroadcast: 'district', postTypes: ['radio', 'broadcast'], licensed: false, twoStep: false },
      money: { ads: false, adRate: 0, adSlots: 0, subs: false, donations: true, sponsors: false }, meter: { primary: 'mobilization', hideMoney: true },
      cred: { reachCoeff: 0.15, credBase: 0.5, mobilization: true },
      preset: 'zine', minPower: 3, cost: 0,
      vendorAbout: 'GHOST FREQ · a cobbled pirate broadcast rig. Agitprop from a moving van, Netwatch on your tail. You don’t chase money — you move crowds. Get raided and the legend grows.',
      commentPools: ['fired-up', 'scared', 'informer']
    }
  };

  /* ═══════════════ RÉGIE — the GM control room (« le réseau et la vérité ») ═══════════════
     GM-only desktop app. Monitor every media outlet, boost/bury player stories, seed
     comments, curate the campaign-wide narrative war, lean on journalists (sponsor pressure
     + paid offers delivered to their newsroom wire), and settle the cycle. It never rolls a
     die — it ingests the table's results and settles the fallout. */
  // Campaign-wide media state: the narrative war + the monetization catalog the GM authors.
  //   market.ads   — ad deals, an open marketplace any journalist can take (some hidden by default)
  //   market.posts — open affiliation positions at outlets any journalist can join
  //   market.sponsors — sponsor briefs sent to a specific journalist (delivered to their offers)
  function regieState(sdk) {
    var c = camp(sdk); var o = (c && c.getOverview && c.getOverview()) || {}; var r = o.regie;
    r = (r && typeof r === 'object') ? r : {};
    if (!Array.isArray(r.war)) r.war = [];
    if (!r.market || typeof r.market !== 'object') r.market = {};
    if (!Array.isArray(r.market.ads)) r.market.ads = [];
    if (!Array.isArray(r.market.posts)) r.market.posts = [];
    if (!Array.isArray(r.market.sponsors)) r.market.sponsors = [];
    return r;
  }
  function regieSave(sdk, mut) { var c = camp(sdk); if (!c || !c.setOverview) return; var r = JSON.parse(JSON.stringify(regieState(sdk))); mut(r); c.setOverview({ regie: r }); }
  // How a fee is released, chosen by the GM. Threshold reads the delivered post's own numbers.
  var PAYOUT_METRICS = [['onPublish', 'on delivery'], ['reach', 'reach reaches'], ['likes', 'likes reach'], ['comments', 'comments reach']];
  var AD_CONTENT = ['any', 'article', 'video', 'broadcast', 'opinion'];
  function payoutLabel(p) {
    if (!p || !p.metric || p.metric === 'onPublish') return 'paid on delivery';
    var lab = { reach: 'reach', likes: 'likes', comments: 'comments' }[p.metric] || p.metric;
    return 'paid when ' + lab + ' reach ' + (parseInt(p.threshold, 10) || 0);
  }
  function money(n) { n = parseInt(n, 10) || 0; return n ? '€' + n.toLocaleString() : 'no fee'; }
  function cpmLabel(c) { c = parseInt(c, 10) || 0; return c ? '€' + c.toLocaleString() + ' per 1,000 views' : 'unpaid placement'; }
  // Pay a fee into the sheet's chosen bank account (Press Card → payAccount, else the active account,
  // else the first open one). Mirrors app-web creditOwner's ledger shape. Returns the amount paid.
  function creditSheet(j, amt, label) {
    amt = parseInt(amt, 10) || 0; if (!amt || !j) return 0;
    var accs = ((j.lifestyle && j.lifestyle.accounts) || []).filter(function (a) { return a && !a.closed; }); if (!accs.length) return 0;
    var wantId = (j.press && j.press.payAccount) || (j.lifestyle && j.lifestyle.activeAccountId);
    var acc = accs.filter(function (a) { return a.id === wantId; })[0] || accs[0];
    acc.balance = (parseFloat(acc.balance) || 0) + amt; acc.ledger = acc.ledger || [];
    acc.ledger.unshift({ id: 'in-' + uid('fee'), type: 'income', label: label || 'Media income', amount: amt });
    return amt;
  }
  function ownerName(sdk, osid) { if (!osid) return 'GM'; var c = camp(sdk); var rec = c && c.getSheet && c.getSheet(osid); return (rec && rec.json && (rec.json.handle || rec.json.name)) || '—'; }
  function regieJournalists(sdk) {
    var c = camp(sdk); if (!c || !c.allSheets) return [];
    return (c.allSheets() || []).map(function (rec) {
      var j = (rec && rec.json) || {}, sa = j.specialAbilities || {};
      var cred = clampn((sa['Credibility'] | 0) || 0, 0, 10);
      var media = cred > 0 || ((j.role || '').toLowerCase().indexOf('media') >= 0);
      return { sid: rec.id, name: j.handle || j.name || 'PC', cred: cred, media: media };
    }).filter(function (x) { return x.media; });
  }
  function regieStories(sdk, cb) {
    mediaOutlets(function (outlets) {
      var c = camp(sdk), rows = [];
      (outlets || []).forEach(function (r) {
        var oj = r.json, secs = (oj.appConfig && oj.appConfig.sections) || ['Front'];
        secs.forEach(function (secName) {
          var key = oj.id + ':feed:' + slugify(secName);
          ((c && c.getNetPosts && c.getNetPosts(key)) || []).forEach(function (p) {
            if (p.kind === 'story' && p.authorSid) rows.push({ post: p, key: key, outlet: oj, section: secName });
          });
        });
      });
      rows.sort(function (a, b) { return (b.post.ts || 0) - (a.post.ts || 0); });
      cb(rows, outlets || []);
    });
  }
  function regieBumpPost(sdk, key, postId, dBuzz) {
    var c = camp(sdk); if (!c || !c.getNetPosts || !c.setNetBoard) return;
    var posts = (c.getNetPosts(key) || []).map(function (p) { if (p.id === postId) { p = JSON.parse(JSON.stringify(p)); p.buzz = (p.buzz || 0) + dBuzz; } return p; });
    c.setNetBoard(key, posts);
  }
  function regieComment(sdk, key, handle, body, parent) { var c = camp(sdk); if (c && c.putNetPost) c.putNetPost(key, { id: uid('cm'), kind: 'comment', parent: parent || null, handle: handle || 'anon', body: body || '', ts: nowStamp() }); }
  // The GM contests a piece; the table rolls Credibility; the GM ingests the result at Settle.
  function regieChallenge(sdk, key, postId, on) {
    var c = camp(sdk); if (!c || !c.getNetPosts || !c.setNetBoard) return;
    c.setNetBoard(key, (c.getNetPosts(key) || []).map(function (p) { if (p.id === postId) { p = JSON.parse(JSON.stringify(p)); p.challenge = on ? 'pending' : null; } return p; }));
  }
  function regieResolveChallenge(sdk, row, outcome) {
    var c = camp(sdk); if (!c || !c.getNetPosts || !c.setNetBoard) return;
    c.setNetBoard(row.key, (c.getNetPosts(row.key) || []).map(function (p) {
      if (p.id === row.post.id) { p = JSON.parse(JSON.stringify(p)); if (outcome === 'exposed') { p.challenge = 'exposed'; p.rating = 'exposed'; p.exposed = true; p.reach = Math.round((p.reach || 0) * 0.4); } else { p.challenge = 'held'; } }
      return p;
    }));
    if (outcome === 'exposed') {
      var s = row.outlet; if (s && s.id) { s.credibility = clampn((s.credibility || 0) - 20, 0, 100); try { Promise.resolve(Store.put({ type: 'site', id: s.id }, s)); } catch (e) {} }
      if (row.post.authorSid && c.getSheet && c.publishSheet) { var rec = c.getSheet(row.post.authorSid); if (rec && rec.json) { var j = rec.json; j.press = j.press || {}; j.press.heat = clampn((j.press.heat || 0) + 2, 0, 10); c.publishSheet(row.post.authorSid, j.handle || j.name || 'PC', j); } }
    }
  }
  function regieDeliver(sdk, targetSid, bucket, payload) {
    var c = camp(sdk); if (!c || !c.getSheet || !c.publishSheet || !targetSid) return false;
    var rec = c.getSheet(targetSid); if (!rec || !rec.json) return false;
    var j = rec.json; j.net = j.net || {}; j.net.media = j.net.media || {};
    var m = j.net.media; m[bucket] = m[bucket] || []; m[bucket].unshift(payload);
    c.publishSheet(targetSid, j.handle || j.name || 'PC', j); return true;
  }
  function credBar100(v) { v = clampn(v, 0, 100); return '<span class="rg-cred"><span class="rg-cred-b" style="width:' + v + '%"></span></span><span class="rg-cred-v">' + v + '</span>'; }
  function ratingTag(r) { if (!r) return ''; var cls = (r === 'verified') ? 'ok' : (r === 'unconfirmed' || r === 'recreation' || r === 'exposed') ? 'warn' : ''; return '<span class="rg-tag ' + cls + '">' + esc(r) + '</span>'; }

  function regieApp(win, sdk) {
    var body = win.body; body.innerHTML = '';
    if (sdk.isPlayer) {
      body.innerHTML = '<div class="rg-root rg-locked"><div class="rg-lock"><div class="rg-lock-t">CONTROL ROOM</div><div class="rg-lock-s">Corporate access only. Network credentials required — this terminal is for the desk, not the field.</div></div></div>';
      win.setTitle('Control Room'); return;
    }
    var root = eln('div', 'rg-root'); body.appendChild(root);
    var rail = eln('div', 'rg-rail'); root.appendChild(rail);
    var main = eln('div', 'rg-main'); root.appendChild(main);
    var SEC = [['newsroom', 'NEWSROOM'], ['stories', 'STORIES'], ['market', 'MONETIZATION'], ['war', 'NARRATIVE WAR'], ['settle', 'SETTLE']];
    var st = { sec: 'newsroom' };
    var stored = App.uiGet ? App.uiGet('regieUi', null) : null; if (stored && stored.sec) st.sec = stored.sec;
    function persist() { if (App.uiSet) App.uiSet('regieUi', { sec: st.sec }); }

    function paintRail() {
      rail.innerHTML = '';
      rail.appendChild(eln('div', 'rg-brand', 'CONTROL ROOM'));
      rail.appendChild(eln('div', 'rg-brand-v', 'the network, and the truth'));
      var nav = eln('div', 'rg-nav'); rail.appendChild(nav);
      SEC.forEach(function (s) { var b = eln('button', 'rg-navb' + (st.sec === s[0] ? ' on' : ''), esc(s[1])); b.onclick = function () { st.sec = s[0]; persist(); route(); }; nav.appendChild(b); });
      rail.appendChild(eln('div', 'rg-rail-foot', 'GM authority — the app never rolls'));
    }
    function topbar(title, right) { var tb = eln('div', 'rg-top'); tb.appendChild(eln('div', 'rg-top-t', esc(title))); var r = eln('div', 'rg-top-r'); (right || []).forEach(function (e) { r.appendChild(e); }); tb.appendChild(r); return tb; }
    function labeled(lab, el) { var f = eln('label', 'rg-f'); f.appendChild(eln('span', 'rg-f-l', esc(lab))); f.appendChild(el); return f; }

    function route() {
      Array.prototype.forEach.call(rail.querySelectorAll('.rg-navb'), function (b, i) { b.classList.toggle('on', SEC[i] && SEC[i][0] === st.sec); });
      main.innerHTML = '';
      if (st.sec === 'stories') return viewStories();
      if (st.sec === 'market') return viewMonetization();
      if (st.sec === 'war') return viewWar();
      if (st.sec === 'settle') return viewSettle();
      return viewNewsroom();
    }

    function viewNewsroom() {
      main.appendChild(topbar('NEWSROOM — every outlet on the wire'));
      var pane = eln('div', 'rg-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'rg-note', 'Live feed of every media outlet. Credibility and buzz drift each cycle; boost or bury individual stories under STORIES.'));
      var host = eln('div'); pane.appendChild(host); host.appendChild(eln('div', 'rg-loading', 'reading the wire…'));
      mediaOutlets(function (outlets) {
        host.innerHTML = '';
        if (!outlets.length) { host.appendChild(eln('div', 'dm-empty', 'No media outlets yet. Create press sites in the Net (Web) — they show up here.')); return; }
        var c = camp(sdk);
        outlets.forEach(function (r) {
          var oj = r.json, secs = (oj.appConfig && oj.appConfig.sections) || ['Front'], storyCount = 0, latest = null;
          secs.forEach(function (secName) { ((c && c.getNetPosts && c.getNetPosts(oj.id + ':feed:' + slugify(secName))) || []).forEach(function (p) { if (p.kind === 'story') { storyCount++; if (!latest || (p.ts || 0) > (latest.ts || 0)) latest = p; } }); });
          var card = eln('div', 'rg-outlet');
          card.innerHTML = '<div class="rg-outlet-h"><span class="rg-outlet-n">' + esc(oj.name || 'outlet') + '</span><span class="rg-outlet-o">' + esc(ownerName(sdk, oj.owner)) + '</span></div>' +
            '<div class="rg-outlet-m">' + credBar100(oj.credibility || 0) + '<span class="rg-chip">buzz ' + (oj.buzz || 0) + '</span><span class="rg-chip">' + storyCount + ' stories</span></div>' +
            (latest ? '<div class="rg-outlet-l">latest: “' + esc(latest.headline || '') + '” · reach ' + (latest.reach || 0) + '</div>' : '<div class="rg-outlet-l dm-muted">no stories yet</div>');
          var open = eln('button', 'dm-btn sm', 'open on Net'); open.onclick = function () { try { sdk.open('browser', { siteId: oj.id }); } catch (e) {} };
          card.appendChild(open); host.appendChild(card);
        });
      });
    }

    function viewStories() {
      main.appendChild(topbar('STORIES — boost · bury · seed comments'));
      var pane = eln('div', 'rg-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'rg-note', 'Every story a player has published. You never roll — you ingest the table’s result: push a story’s buzz, bury it, or seed the comments with a reader persona.'));
      var host = eln('div'); pane.appendChild(host); host.appendChild(eln('div', 'rg-loading', 'gathering stories…'));
      regieStories(sdk, function (rows) {
        host.innerHTML = '';
        if (!rows.length) { host.appendChild(eln('div', 'dm-empty', 'No player stories published yet.')); return; }
        rows.forEach(function (row) {
          var p = row.post, card = eln('div', 'rg-story');
          card.innerHTML = '<div class="rg-story-h"><span class="rg-story-t">' + esc(p.headline || '(untitled)') + '</span>' + ratingTag(p.rating) + '</div>' +
            '<div class="rg-story-m"><span>' + esc(ownerName(sdk, p.authorSid)) + '</span><span>' + esc(row.outlet.name || '') + ' · ' + esc(row.section) + '</span><span class="rg-chip">' + esc(p.track || 'investigation') + '</span>' + (p.sponsored ? '<span class="rg-chip warn">' + (p.disclosed ? 'sponsored' : 'undisclosed') + '</span>' : '') + (p.challenge ? '<span class="rg-chip warn">' + (p.challenge === 'pending' ? 'challenged' : p.challenge) + '</span>' : '') + '</div>' +
            '<div class="rg-story-r">reach ' + (p.reach || 0) + ' · buzz ' + (p.buzz || 0) + '</div>';
          var bar = eln('div', 'rg-story-a');
          function act(lbl, cls, fn) { var b = eln('button', 'dm-btn sm' + (cls ? ' ' + cls : ''), lbl); b.onclick = fn; bar.appendChild(b); }
          act('boost +', '', function () { regieBumpPost(sdk, row.key, p.id, 25); route(); });
          act('boost ++', 'dm-primary', function () { regieBumpPost(sdk, row.key, p.id, 100); route(); });
          act('bury', 'dm-del', function () { regieBumpPost(sdk, row.key, p.id, -100); route(); });
          if (!p.challenge) act('challenge', '', function () { regieChallenge(sdk, row.key, p.id, true); sdk.notify('Contested — resolve the Credibility roll at Settle.'); route(); });
          else if (p.challenge === 'pending') act('drop challenge', '', function () { regieChallenge(sdk, row.key, p.id, false); route(); });
          act('seed comment', '', function () { if (App.prompt) App.prompt('Seed a comment', 'comment (posts as a reader persona)', '', function (v) { if (v) { regieComment(sdk, row.key, 'reader-' + (1000 + Math.floor(nowStamp() % 9000)), v, p.id); sdk.notify('Comment seeded.'); route(); } }); });
          act('open', '', function () { try { sdk.open('browser', { siteId: row.outlet.id, postId: p.id }); } catch (e) {} });
          card.appendChild(bar); host.appendChild(card);
        });
      });
    }

    function editClaim(c) {
      var m = eln('div', 'rg-pop'); m.appendChild(eln('div', 'rg-pop-h', esc(c.text)));
      [['reach', 'reach'], ['cred', 'credibility'], ['momentum', 'momentum']].forEach(function (p) {
        var b = eln('button', 'rg-pop-b', 'set ' + p[1] + ' (' + (c[p[0]] || 0) + ')');
        b.onclick = function () { m.remove(); if (App.prompt) App.prompt('Edit claim', p[1] + ' (number; momentum may be negative)', String(c[p[0]] || 0), function (v) { if (v != null) { regieSave(sdk, function (r) { (r.war || []).forEach(function (x) { if (x.id === c.id) x[p[0]] = parseInt(v, 10) || 0; }); }); route(); } }); };
        m.appendChild(b);
      });
      var stb = eln('button', 'rg-pop-b', 'cycle stance'); stb.onclick = function () { m.remove(); regieSave(sdk, function (r) { (r.war || []).forEach(function (x) { if (x.id === c.id) { var o = ['ours', 'neutral', 'their']; x.stance = o[(o.indexOf(x.stance || 'ours') + 1) % 3]; } }); }); route(); }; m.appendChild(stb);
      var del = eln('button', 'rg-pop-x', 'delete'); del.onclick = function () { m.remove(); regieSave(sdk, function (r) { r.war = (r.war || []).filter(function (x) { return x.id !== c.id; }); }); route(); }; m.appendChild(del);
      var close = eln('button', 'rg-pop-x', 'close'); close.onclick = function () { m.remove(); }; m.appendChild(close);
      main.appendChild(m);
    }
    function viewWar() {
      main.appendChild(topbar('NARRATIVE WAR — the story vs the counter-story'));
      var pane = eln('div', 'rg-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'rg-note', 'Map the information war campaign-wide. Reach, credibility and momentum are numbers you ingest from the table — the app never rolls the outcome. Low credibility + negative momentum = a claim collapsing.'));
      var war = regieState(sdk).war || [];
      var cols = eln('div', 'rg-war-cols'); pane.appendChild(cols);
      [['ours', 'OUR NARRATIVE'], ['neutral', 'CONTESTED'], ['their', 'COUNTER-NARRATIVE']].forEach(function (L) {
        var col = eln('div', 'rg-war-col'); col.appendChild(eln('div', 'rg-war-h' + (L[0] === 'their' ? ' their' : ''), L[1]));
        war.filter(function (c) { return (c.stance || 'ours') === L[0]; }).forEach(function (c) {
          var mom = c.momentum || 0, collapsing = (c.cred || 0) < 30 && mom < 0;
          var card = eln('div', 'rg-war-card' + (collapsing ? ' collapsing' : ''));
          card.innerHTML = '<div class="rg-war-txt">' + esc(c.text || '(claim)') + '</div><div class="rg-war-meters"><span>reach ' + (c.reach || 0) + '</span><span>cred ' + (c.cred || 0) + '</span><span class="' + (mom < 0 ? 'dm-red' : '') + '">mom ' + (mom > 0 ? '+' : '') + mom + '</span></div>';
          card.onclick = function () { editClaim(c); }; col.appendChild(card);
        });
        var add = eln('button', 'dm-btn sm rg-war-add', '＋ claim');
        add.onclick = function () { if (App.prompt) App.prompt('New claim', 'the claim / thesis', '', function (v) { if (v) { regieSave(sdk, function (r) { r.war = r.war || []; r.war.push({ id: uid('cl'), text: v, stance: L[0], reach: 0, cred: 50, momentum: 0 }); }); route(); } }); };
        col.appendChild(add); cols.appendChild(col);
      });
      if (!war.length) pane.appendChild(eln('div', 'dm-muted rg-war-hint', 'No claims yet. Add your narrative, the contested ground, and the counter-narrative — then ingest the table’s reach/cred/momentum.'));
    }

    function viewMonetization() {
      main.appendChild(topbar('MONETIZATION — what the desk can earn'));
      var pane = eln('div', 'rg-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'rg-note', 'Everything a journalist can be paid for. You set the terms — the fee, how it pays out, the content it buys — and players pick from these; they never invent their own. Ad deals and open positions are a public board every journalist sees; a sponsor brief is sent to one journalist.'));

      function fld(lab, el) { var f = eln('label', 'rg-f'); f.appendChild(eln('span', 'rg-f-l', esc(lab))); f.appendChild(el); return f; }
      function txt(ph) { var i = eln('input', 'rg-in'); i.placeholder = ph || ''; return i; }
      function num(ph) { var i = eln('input', 'rg-in'); i.type = 'number'; i.min = 0; i.placeholder = ph || '0'; return i; }
      function sel(opts) { var s = eln('select', 'rg-in'); opts.forEach(function (o) { var op = eln('option', null, o[1]); op.value = o[0]; s.appendChild(op); }); return s; }
      function mini(lbl, fn, cls) { var b = eln('button', 'rg-mini' + (cls ? ' ' + cls : ''), lbl); b.onclick = fn; return b; }
      function payoutRow() {
        var wrap = eln('div', 'rg-payout'), m = sel(PAYOUT_METRICS), th = num('0'); th.classList.add('rg-payout-th');
        function sync() { th.style.display = m.value === 'onPublish' ? 'none' : ''; } m.onchange = sync; sync();
        wrap.appendChild(m); wrap.appendChild(th);
        return { el: wrap, get: function () { return { metric: m.value, threshold: parseInt(th.value, 10) || 0 }; } };
      }
      function grp(title, note) {
        var box = eln('div', 'rg-grp'); box.appendChild(eln('div', 'rg-grp-h', esc(title)));
        var body = eln('div', 'rg-grp-body'); if (note) body.appendChild(eln('div', 'rg-grp-note', esc(note)));
        box.appendChild(body); pane.appendChild(box); return body;
      }
      function itemCard(title, lines, onRemove, extraBtns) {
        var c = eln('div', 'rg-item'); c.appendChild(eln('div', 'rg-item-t', esc(title)));
        (lines || []).forEach(function (l) { c.appendChild(eln('div', 'rg-item-l', l)); });
        var a = eln('div', 'rg-item-a'); (extraBtns || []).forEach(function (b) { a.appendChild(b); });
        a.appendChild(mini('remove', onRemove, 'del')); c.appendChild(a); return c;
      }
      var mkt = regieState(sdk).market;

      /* ── AD DEALS ── */
      var b1 = grp('AD DEALS', 'A public marketplace of ad placements. They pay a rate per 1,000 views — the more the piece is seen, the more it earns, settled each cycle. Hidden deals stay off the players’ board until you reveal them.');
      (mkt.ads || []).forEach(function (a) {
        var card = itemCard((a.hidden ? '[hidden] ' : '') + (a.name || 'Ad deal'),
          [cpmLabel(a.cpm) + ' · ' + esc(a.contentType || 'any') + ' content'],
          function () { regieSave(sdk, function (r) { r.market.ads = (r.market.ads || []).filter(function (x) { return x.id !== a.id; }); }); route(); },
          [mini(a.hidden ? 'reveal' : 'hide', function () { regieSave(sdk, function (r) { (r.market.ads || []).forEach(function (x) { if (x.id === a.id) x.hidden = !x.hidden; }); }); route(); })]);
        if (a.hidden) card.classList.add('rg-item-off'); b1.appendChild(card);
      });
      if (!(mkt.ads || []).length) b1.appendChild(eln('div', 'rg-empty2', 'No ad deals yet.'));
      (function () {
        var form = eln('div', 'rg-form'), nm = txt('deal name — e.g. Kiroshi placement'), ct = sel(AD_CONTENT.map(function (c) { return [c, c]; })), cpm = num('€ per 1,000 views');
        form.appendChild(fld('name', nm)); form.appendChild(fld('content type', ct)); form.appendChild(fld('rate — € per 1,000 views', cpm));
        var add = eln('button', 'rg-add', 'add ad deal');
        add.onclick = function () { if (!nm.value.trim()) { sdk.notify('Name the deal.'); return; } regieSave(sdk, function (r) { r.market.ads.push({ id: uid('ad'), name: nm.value.trim(), contentType: ct.value, cpm: parseInt(cpm.value, 10) || 0, hidden: false }); }); route(); };
        form.appendChild(add); b1.appendChild(form);
      })();

      /* ── AFFILIATION POSTS ── */
      var b2 = grp('AFFILIATION POSTS', 'Open positions at your outlets. A journalist joins one to attach to that masthead; a staff post carries a per-piece fee and a quota.');
      (mkt.posts || []).forEach(function (p) {
        b2.appendChild(itemCard((p.role || 'freelance') + ' — ' + (p.outletName || 'outlet'),
          [esc(p.outletName || 'outlet') + ' · ' + esc(p.role || 'freelance'), (p.role === 'staff' ? money(p.pay) + ' / piece · quota ' + (parseInt(p.quota, 10) || 0) : 'no retainer')],
          function () { regieSave(sdk, function (r) { r.market.posts = (r.market.posts || []).filter(function (x) { return x.id !== p.id; }); }); route(); }));
      });
      if (!(mkt.posts || []).length) b2.appendChild(eln('div', 'rg-empty2', 'No open positions.'));
      (function () {
        var form = eln('div', 'rg-form'), outSel = eln('select', 'rg-in'), _outs = [];
        outSel.innerHTML = '<option value="">loading outlets…</option>';
        mediaOutlets(function (list) { _outs = list || []; outSel.innerHTML = ''; if (!_outs.length) { var o0 = eln('option', null, '— no outlets yet —'); o0.value = ''; outSel.appendChild(o0); } _outs.forEach(function (r) { var o = eln('option', null, r.json.name || 'outlet'); o.value = r.json.id; outSel.appendChild(o); }); });
        var role = sel([['freelance', 'freelance'], ['stringer', 'stringer'], ['staff', 'staff (payroll)']]), pay = num('€ / piece'), quota = num('quota');
        var fPay = fld('pay / piece', pay), fQ = fld('quota', quota);
        function sync() { var s = role.value === 'staff'; fPay.style.display = s ? '' : 'none'; fQ.style.display = s ? '' : 'none'; } role.onchange = sync;
        form.appendChild(fld('outlet', outSel)); form.appendChild(fld('role', role)); form.appendChild(fPay); form.appendChild(fQ); sync();
        var add = eln('button', 'rg-add', 'open position');
        add.onclick = function () { if (!outSel.value) { sdk.notify('Pick an outlet.'); return; } var oj = ((_outs.filter(function (r) { return r.json.id === outSel.value; })[0] || {}).json) || {}; regieSave(sdk, function (r) { r.market.posts.push({ id: uid('pos'), outletId: outSel.value, outletName: oj.name || 'outlet', role: role.value, pay: parseInt(pay.value, 10) || 0, quota: parseInt(quota.value, 10) || 0 }); }); route(); };
        form.appendChild(add); b2.appendChild(form);
      })();

      /* ── SPONSORS (sent to one journalist) ── */
      var b3 = grp('SPONSORS', 'A sponsor brief sent to one journalist: a dossier to run, a fee, and the terms it pays on. They can disclose it or bury it — their Credibility on the line.');
      (mkt.sponsors || []).forEach(function (s) {
        b3.appendChild(itemCard(s.client || 'Sponsor',
          ['to ' + esc(s.targetName || '—') + ' · ' + money(s.fee), payoutLabel(s.payout) + (s.disclose ? ' · disclosure required' : ''), (s.dossier && s.dossier.length ? s.dossier.length + ' dossier file(s)' : 'no dossier')],
          function () { regieSave(sdk, function (r) { r.market.sponsors = (r.market.sponsors || []).filter(function (x) { return x.id !== s.id; }); }); route(); }));
      });
      if (!(mkt.sponsors || []).length) b3.appendChild(eln('div', 'rg-empty2', 'No sponsors sent.'));
      (function () {
        var js = regieJournalists(sdk);
        if (!js.length) { b3.appendChild(eln('div', 'rg-empty2', 'No media characters to sponsor yet — a character becomes press with the Media role or a Credibility score.')); return; }
        var form = eln('div', 'rg-form'), who = eln('select', 'rg-in'); js.forEach(function (j) { var o = eln('option', null, j.name + ' — cred ' + j.cred); o.value = j.sid; who.appendChild(o); });
        var client = txt('client / sponsor'), fee = num('fee €'), po = payoutRow(), brief = eln('textarea', 'rg-in rg-ta'); brief.placeholder = 'the angle — what they’re paid to say';
        var disc = eln('input'); disc.type = 'checkbox'; var discRow = eln('label', 'rg-chk'); discRow.appendChild(disc); discRow.appendChild(eln('span', null, 'require disclosure (safe, less immoral)'));
        var dossier = [], dossHost = eln('div', 'rg-doss');
        function paintDoss() { dossHost.innerHTML = ''; dossier.forEach(function (d, i) { var row = eln('div', 'rg-doss-row', '<span>' + esc(d.title) + '</span>'); row.appendChild(mini('remove', function () { dossier.splice(i, 1); paintDoss(); }, 'del')); dossHost.appendChild(row); }); }
        var dTitle = txt('file title'), dNote = txt('what it says');
        form.appendChild(fld('journalist', who)); form.appendChild(fld('client', client)); form.appendChild(fld('fee', fee)); form.appendChild(fld('pays out', po.el)); form.appendChild(fld('brief', brief)); form.appendChild(discRow);
        var dWrap = eln('div', 'rg-doss-build'); dWrap.appendChild(eln('span', 'rg-f-l', 'dossier — files provided to the journalist')); dWrap.appendChild(dossHost);
        var dInline = eln('div', 'rg-doss-inline'); dInline.appendChild(dTitle); dInline.appendChild(dNote); dInline.appendChild(mini('attach file', function () { if (!dTitle.value.trim()) return; dossier.push({ title: dTitle.value.trim(), note: dNote.value.trim() }); dTitle.value = dNote.value = ''; paintDoss(); }));
        dWrap.appendChild(dInline); form.appendChild(dWrap);
        var send = eln('button', 'rg-add', 'send sponsor brief');
        send.onclick = function () {
          if (!client.value.trim()) { sdk.notify('Name the client.'); return; }
          var target = js.filter(function (j) { return j.sid === who.value; })[0] || {};
          var payload = { id: uid('sp'), kind: 'sponsor', client: client.value.trim(), fee: parseInt(fee.value, 10) || 0, payout: po.get(), disclose: disc.checked, brief: brief.value.trim(), dossier: dossier.slice(), ts: nowStamp(), status: 'pending', targetName: target.name };
          var ok = regieDeliver(sdk, who.value, 'offers', payload);
          if (ok) regieSave(sdk, function (r) { r.market.sponsors.push({ id: payload.id, client: payload.client, fee: payload.fee, payout: payload.payout, disclose: payload.disclose, dossier: payload.dossier, targetSid: who.value, targetName: target.name, ts: payload.ts }); });
          sdk.notify(ok ? 'Sponsor brief sent to ' + (target.name || 'the journalist') + '.' : 'Delivery failed — no live session.'); route();
        };
        form.appendChild(send); b3.appendChild(form);
      })();
    }

    function viewSettle() {
      main.appendChild(topbar('SETTLE THE CYCLE'));
      var pane = eln('div', 'rg-pane'); main.appendChild(pane);
      pane.appendChild(eln('div', 'rg-note', 'Advance the media economy one cycle: credibility drift, buzz fade, reader comments seed on every outlet. Ratings, rep and ad-revenue also settle in the Net “Traffic” watch. Nothing here rolls dice.'));
      var tank = mediaTrust();
      var tlab = eln('span', 'rg-f-l', 'MEDIA-TRUST TANK — campaign-wide reach × ' + tank + '%');
      var sl = eln('input', 'dm-in'); sl.type = 'range'; sl.min = 0; sl.max = 100; sl.value = tank;
      sl.oninput = function () { var w = App.uiGet('web', {}) || {}; w.mediaTrust = +sl.value; App.uiSet('web', w); tlab.textContent = 'MEDIA-TRUST TANK — campaign-wide reach × ' + sl.value + '%'; };
      var tl = eln('label', 'rg-f'); tl.appendChild(tlab); tl.appendChild(sl); pane.appendChild(tl);

      /* Credibility rolls — resolve pieces you contested under STORIES */
      var chGrp = eln('div', 'rg-grp'); chGrp.appendChild(eln('div', 'rg-grp-h', 'CREDIBILITY ROLLS — pending challenges'));
      var chBody = eln('div', 'rg-grp-body'); chGrp.appendChild(chBody); pane.appendChild(chGrp);
      chBody.appendChild(eln('div', 'rg-loading', 'gathering challenges…'));
      regieStories(sdk, function (rows) {
        var pend = rows.filter(function (r) { return r.post.challenge === 'pending'; });
        chBody.innerHTML = '';
        chBody.appendChild(eln('div', 'rg-grp-note', 'The table rolls Credibility on each contested piece; you record the outcome. Held up = it survives. Exposed = discredited: the piece loses reach, the outlet loses credibility, the journalist takes heat.'));
        if (!pend.length) { chBody.appendChild(eln('div', 'rg-empty2', 'Nothing contested. Flag a piece under STORIES to bring it here.')); return; }
        pend.forEach(function (row) {
          var p = row.post, item = eln('div', 'rg-item');
          item.appendChild(eln('div', 'rg-item-t', esc(p.headline || '(untitled)') + (p.sponsored ? (p.disclosed ? ' — sponsored' : ' — undisclosed ad') : '')));
          item.appendChild(eln('div', 'rg-item-l', esc(ownerName(sdk, p.authorSid)) + ' · ' + esc(row.outlet.name || '') + ' · reach ' + (p.reach || 0)));
          var a = eln('div', 'rg-item-a');
          var held = eln('button', 'rg-mini', 'held up'); held.onclick = function () { regieResolveChallenge(sdk, row, 'held'); sdk.notify('Held up — the piece survives.'); route(); };
          var exp = eln('button', 'rg-mini del', 'exposed'); exp.onclick = function () { regieResolveChallenge(sdk, row, 'exposed'); sdk.notify('Exposed — discredited; outlet credibility and journalist heat updated.'); route(); };
          a.appendChild(held); a.appendChild(exp); item.appendChild(a); chBody.appendChild(item);
        });
      });

      var settle = eln('button', 'dm-btn dm-primary', 'settle the cycle');
      var log = eln('div', 'rg-log');
      settle.onclick = function () { log.textContent = 'settling…'; settleCycle(sdk, { commentPools: ['loyal', 'skeptic', 'astroturf', 'cynical'] }, function (msg) { log.textContent = msg; if (br(sdk).logSession) br(sdk).logSession('[CONTROL] ' + msg); }); };
      pane.appendChild(settle); pane.appendChild(log);
    }

    paintRail(); route(); win.setTitle('Control Room');
    var c = camp(sdk);
    if (c && c.onNetChange) { var off = c.onNetChange(function () { if (st.sec === 'newsroom' || st.sec === 'stories') route(); }); if (win.on) win.on('close', function () { try { off && off(); } catch (e) {} }); }
  }

  /* ═══════════════ register the five Desktop apps ═══════════════ */
  function makeApp(cfg) {
    return {
      id: cfg.id, name: cfg.label, glyph: cfg.glyph, vendor: cfg.vendor, category: 'media',
      os: ['*'], seed: true, desc: cfg.vendorAbout,
      win: { w: 940, h: 640, minW: 620, minH: 420 }, singleton: true,
      onOpen: function (win, sdk) { try { mediaApp(win, sdk, cfg); } catch (e) { win.body.innerHTML = '<div class="dm-root"><div class="dm-empty">Media app error: ' + esc(String(e && e.message || e)) + '</div></div>'; } }
    };
  }
  Object.keys(CFG).forEach(function (k) { window.Desktop.registerApp(makeApp(CFG[k])); });
  window.Desktop.registerApp({
    id: 'regie', name: 'Control Room', glyph: '▲', vendor: 'Network 54', category: 'media',
    os: ['*'], seed: false, gmOnly: true, desc: 'GM control room for the media layer: monitor outlets, boost or bury stories, run the narrative war, lean on journalists, settle the cycle.',
    win: { w: 960, h: 660, minW: 640, minH: 440 }, singleton: true,
    onOpen: function (win, sdk) { try { regieApp(win, sdk); } catch (e) { win.body.innerHTML = '<div class="rg-root"><div class="dm-empty">Control Room error: ' + esc(String(e && e.message || e)) + '</div></div>'; } }
  });

  /* ═══════════════ styles (injected — no <head> edit) ═══════════════ */
  var CSS = [
    '.dm-root{position:absolute;inset:0;display:flex;background:#fff;color:#111;font-family:var(--mono,"Terminal Grotesque",monospace);font-size:13px;line-height:1.4;overflow:hidden;-webkit-font-smoothing:antialiased}',
    '.dm-root *{box-sizing:border-box}',
    '.dm-rail{width:190px;flex:none;border-right:2px solid #111;display:flex;flex-direction:column;background:#fff}',
    '.dm-brand{padding:14px 14px 4px;font-weight:700;letter-spacing:1px}',
    '.dm-brand-n{font-size:16px;letter-spacing:1.5px}',
    '.dm-brand-v{padding:0 12px 10px;color:#999;font-size:10px;letter-spacing:1px;border-bottom:1px solid #ddd;text-transform:uppercase}',
    '.dm-nav{flex:1;padding:8px 0;overflow:auto}',
    '.dm-navb{display:block;width:100%;text-align:left;background:none;border:0;border-left:3px solid transparent;padding:11px 14px;font:inherit;font-size:12.5px;color:#111;cursor:pointer;letter-spacing:1.5px}',
    '.dm-navb:hover{background:#f2f2f2}.dm-navb.on{border-left-color:#111;font-weight:700;background:#111;color:#fff}',
    '.dm-navg{width:16px;text-align:center}',
    '.dm-rail-foot{padding:10px 12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#666}',
    '.dm-cred b{color:#111}.dm-gmtag{background:#111;color:#fff;padding:1px 6px;font-weight:700;letter-spacing:1px}',
    '.dm-main{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}',
    '.dm-top{display:flex;align-items:center;justify-content:space-between;height:44px;flex:none;border-bottom:2px solid #111;padding:0 12px}',
    '.dm-top-t{font-weight:700;letter-spacing:1px;display:flex;align-items:center;gap:10px}',
    '.dm-case-name{font-weight:700}',
    '.dm-top-r{display:flex;gap:6px}',
    '.dm-pane{flex:1;overflow:auto;padding:14px}',
    '.dm-btn{background:#fff;color:#111;border:1.5px solid #111;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer;letter-spacing:.5px;line-height:1}',
    '.dm-btn:hover{background:#111;color:#fff}.dm-btn.dm-primary{background:#111;color:#fff}.dm-btn.dm-primary:hover{background:#fff;color:#111}',
    '.dm-btn.dm-del{border-color:#c0392b;color:#c0392b}.dm-btn.dm-del:hover{background:#c0392b;color:#fff}',
    '.dm-empty{padding:24px;color:#666;text-align:center;border:2px dashed #ddd;margin:8px}',
    '.dm-desk-about{color:#444;border-left:2px solid #111;padding:2px 0 2px 12px;margin-bottom:14px}',
    '.dm-desk-hud{display:flex;gap:10px;margin-bottom:14px}',
    '.dm-stat{border:1.5px solid #111;padding:8px 14px;min-width:80px}.dm-stat b{font-size:22px;display:block}.dm-stat span{font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase}',
    '.dm-story{border:1px solid #ddd;border-left:2px solid #111;padding:8px 10px;margin-bottom:6px}.dm-story-h{font-weight:700}.dm-story-m{color:#666;font-size:11px}',
    '.dm-caselist{display:flex;flex-direction:column;gap:6px}',
    '.dm-caserow{display:flex;align-items:center;justify-content:space-between;border:1.5px solid #111;padding:8px 10px}',
    '.dm-caserow-n{font-weight:700;cursor:pointer}.dm-caserow-m{color:#666;font-size:11px}',
    '.dm-tag{background:#111;color:#fff;font-size:9px;padding:1px 5px;letter-spacing:1px;vertical-align:middle}',
    '.dm-caserow-a{display:flex;gap:6px}',
    // board
    '.dt-board{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff;color:#111}',
    '.dt-board *{box-sizing:border-box}',
    '.dm-objbar{display:flex;align-items:center;gap:2px;height:38px;flex:none;border-bottom:2px solid #111;padding:0 6px;overflow-x:auto}',
    '.dm-lens{display:flex;align-items:center;gap:6px;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-2px;padding:0 10px;height:38px;font:inherit;font-size:11px;letter-spacing:1px;color:#999;cursor:pointer;white-space:nowrap}',
    '.dm-lens:hover{color:#111}.dm-lens.on{color:#111;font-weight:700;border-bottom-color:#111}',
    '.dm-lens.off{color:#ccc;cursor:not-allowed}.dm-lens.off:hover{color:#ccc}',
    '.dm-lg{font-size:14px}.dm-obj-sp{flex:1}',
    '.dm-stagewrap{flex:1;display:flex;min-height:0;position:relative}',
    '.dm-stage{flex:1;display:flex;flex-direction:column;min-height:0;position:relative;overflow:hidden}',
    '.dm-lens-head{flex:none;padding:6px 12px;border-bottom:2px solid #111;display:flex;align-items:baseline;gap:10px;background:#fff}',
    '.dm-lh-t{font-weight:700;letter-spacing:1px;white-space:nowrap}.dm-lh-p{color:#555;font-size:12px}',
    '.dm-lens-body{flex:1;min-height:0;position:relative;overflow:hidden}',
    '.dm-obj-lab{font-size:10px;letter-spacing:2px;color:#999;padding:0 6px 0 2px;align-self:center;white-space:nowrap}',
    '.dm-dossier{width:0;flex:none;border-left:2px solid #111;overflow:auto;transition:width .12s;background:#fff}',
    '.dm-dossier.open{width:260px;padding:12px}',
    '.dm-doss-empty{color:#666;padding:20px 4px}',
    '.dm-doss-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}.dm-doss-g{font-size:18px}.dm-doss-kind{font-weight:700;letter-spacing:1px;font-size:11px}',
    '.dm-doss-name{width:100%;border:1.5px solid #111;padding:6px 8px;font:inherit;font-weight:700;margin-bottom:8px}',
    '.dm-doss-row{display:flex;gap:8px;margin-bottom:8px}',
    '.dm-fl{display:flex;flex-direction:column;gap:3px;flex:1}.dm-fl-l{font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase}',
    '.dm-doss-sel,.dm-doss-note{border:1.5px solid #111;padding:5px 6px;font:inherit;width:100%;background:#fff;color:#111}',
    '.dm-doss-note{min-height:70px;resize:vertical}',
    '.dm-doss-h{font-size:10px;color:#666;letter-spacing:1px;margin:10px 0 4px}',
    '.dm-doss-conn{padding:5px 6px;border:1px solid #ddd;margin-bottom:4px;cursor:pointer}.dm-doss-conn:hover{background:#111;color:#fff}',
    '.dm-doss-rel{color:#c0392b;font-weight:700}.dm-doss-conn:hover .dm-doss-rel{color:#fff}',
    '.dm-del{margin-top:12px;width:100%}',
    // liens
    '.dm-liens-tb{display:flex;align-items:center;gap:6px;height:36px;flex:none;border-bottom:1px solid #ddd;padding:0 8px}',
    '.dm-tb-sp{flex:1}.dm-hint{color:#999;font-size:10px}',
    '.dm-z{width:28px;text-align:center;padding:5px 0}',
    '.dm-viewport{position:absolute;inset:36px 0 0 0;overflow:hidden;cursor:grab;background:linear-gradient(#f6f6f6 1px,transparent 1px),linear-gradient(90deg,#f6f6f6 1px,transparent 1px);background-size:26px 26px}',
    '.dm-viewport.linking{cursor:crosshair}',
    '.dm-world{position:absolute;left:0;top:0;transform-origin:0 0}',
    '.dm-edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}',
    '.dm-edge{pointer-events:none}.dm-elab{font-family:var(--mono,"Terminal Grotesque",monospace);font-size:9px;fill:#111;letter-spacing:1px}',
    '.dm-node{position:absolute;width:152px;background:#fff;border:1.5px solid #111;box-shadow:3px 3px 0 rgba(17,17,17,.85);cursor:move;user-select:none}',
    '.dm-node.sel{outline:2px solid #c0392b;outline-offset:2px}',
    '.dm-node.dropped{opacity:.4}',
    '.dm-node-h{display:flex;align-items:center;gap:5px;background:#111;color:#fff;padding:2px 6px;font-size:9px;letter-spacing:1px}',
    '.dm-node-ty{flex:1}.dm-node-cred{letter-spacing:-1px}',
    '.dm-node-nm{padding:6px 8px;font-weight:700;line-height:1.15}',
    '.dm-node-hd{position:absolute;right:2px;bottom:2px;color:#c0392b;cursor:crosshair;font-size:11px;padding:2px}',
    '.dm-pop{position:absolute;left:50%;top:40px;transform:translateX(-50%);background:#fff;border:2px solid #111;box-shadow:4px 4px 0 rgba(0,0,0,.4);padding:6px;z-index:20;max-height:70%;overflow:auto;min-width:160px}',
    '.dm-pop-h{font-size:10px;color:#666;letter-spacing:1px;padding:2px 4px 6px;text-transform:uppercase}',
    '.dm-pop-b{display:block;width:100%;text-align:left;background:none;border:0;padding:5px 8px;font:inherit;cursor:pointer}.dm-pop-b:hover{background:#111;color:#fff}',
    '.dm-pop-b .dm-muted{color:#999}.dm-pop-b:hover .dm-muted{color:#ccc}',
    '.dm-pop-x{display:block;width:100%;margin-top:4px;border-top:1px solid #ddd;background:none;border-left:0;border-right:0;border-bottom:0;padding:5px;font:inherit;color:#c0392b;cursor:pointer}',
    '.dm-pop-empty{padding:8px;color:#999}',
    // stubs
    '.dm-lens-stub,.dm-empty.dm-stub{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#666;gap:8px;text-align:center;padding:24px}',
    '.dm-stub-g{font-size:40px;color:#ddd}.dm-stub-t{font-weight:700;letter-spacing:2px;font-size:14px}.dm-stub-n{max-width:420px;color:#666}',
    '.dm-chip{border-bottom:1px solid #c0392b;cursor:pointer}',
    '.dm-boardhost{flex:1;position:relative}',
    // composer + analytics
    '.dm-composer{max-width:920px}',
    '.dm-comp-head{font-size:13px;color:#333;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}.dm-comp-head b{font-size:15px;letter-spacing:1px}',
    '.dm-comp-cols{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}',
    '.dm-comp-main{flex:2;min-width:320px}.dm-comp-side{flex:1;min-width:250px}',
    '.dm-comp-grp{border:1.5px solid #111;margin-bottom:12px}',
    '.dm-comp-gh{background:#111;color:#fff;padding:5px 10px;font-size:11px;letter-spacing:1px;font-weight:700}',
    '.dm-comp-grp .dm-cf{margin:10px}',
    '.dm-comp-grp .dm-src-row{padding:3px 10px}',
    '.dm-comp-pad{padding:10px}',
    '.dm-est-row{display:flex;justify-content:space-between;align-items:baseline;padding:2px 0}',
    '.dm-est-l{font-size:10px;letter-spacing:2px;color:#666}',
    '.dm-est-n{font-family:var(--head,"Eurostile",sans-serif);font-weight:700;font-size:26px}.dm-est-n small{font-size:13px;color:#666}',
    '.dm-est-warn{color:#c0392b;font-weight:700;font-size:12px;margin-top:6px;border-top:1px solid #ddd;padding-top:6px}',
    '.dm-pub{display:block;width:calc(100% - 20px);margin:0 10px 12px;padding:10px}',
    '.dm-cf{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}',
    '.dm-in{border:1.5px solid #111;padding:6px 8px;font:inherit;background:#fff;color:#111;width:100%}',
    '.dm-ta{min-height:120px;resize:vertical}',
    '.dm-cf-out{font-weight:700;margin-left:8px}',
    '.dm-src{border:1px solid #ddd;padding:8px;margin-bottom:10px}',
    '.dm-src-row{display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer}',
    '.dm-muted{color:#999}.dm-red{color:#c0392b;font-weight:700}',
    '.dm-est{background:#f2f2f2;padding:10px;margin:10px}',
    '.dm-pickcase{max-width:380px;margin-bottom:12px}',
    '.dm-an-row{border:1px solid #ddd;border-left:2px solid #111;padding:8px 10px;margin-bottom:6px}',
    '.dm-an-h{font-weight:700}.dm-an-meters{display:flex;gap:12px;margin-top:4px}.dm-meter{font-size:11px}.dm-an-m2{color:#666;font-size:11px;margin-top:2px}',
    '.dm-an-note{color:#666;font-size:11px;margin-bottom:10px}',
    '.dm-antabs{display:flex;gap:0;border-bottom:2px solid #111;flex:none}',
    '.dm-antab{flex:1;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-2px;padding:8px 10px;font:inherit;color:#666;cursor:pointer;text-align:left}',
    '.dm-antab.on{color:#111;border-bottom-color:#111}.dm-antab b{display:block;letter-spacing:1px}.dm-antab span{font-size:10px;color:#999}',
    '.dm-pub-reason{color:#c0392b;font-size:11px;font-weight:700;margin:4px 0;min-height:14px}',
    '.dm-btn.dm-disabled,.dm-btn:disabled{opacity:.4;cursor:not-allowed}',
    '.dm-an-acts{display:flex;gap:6px;margin-top:6px}',
    '.dm-lens-compose{position:absolute;inset:0;overflow:auto;padding:14px}',
    // sources lens
    '.dm-srf-wrap{margin-left:auto;display:flex;gap:4px}',
    '.dm-srf{padding:3px 8px;font-size:11px}.dm-srf.on{background:#111;color:#fff}',
    '.dm-sr-pane{position:absolute;inset:36px 0 0 0;overflow:auto;padding:14px}',
    '.dm-sr-spine{position:relative;max-width:720px;margin:0 auto}',
    '.dm-sr-spine:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;background:#111;transform:translateX(-1px)}',
    '.dm-sr-card{position:relative;width:46%;border:1.5px solid #111;background:#fff;padding:8px 10px;margin:0 0 12px}',
    '.dm-sr-card.l{margin-right:auto}.dm-sr-card.r{margin-left:auto}',
    '.dm-sr-card.sel{outline:2px solid #c0392b;outline-offset:2px}',
    '.dm-sr-h{display:flex;align-items:center;gap:6px;cursor:pointer}.dm-sr-h b{flex:1}',
    '.dm-sr-g{font-size:14px}.dm-sr-cred{letter-spacing:-1px}',
    '.dm-sr-solid{font-size:11px;color:#666;margin:3px 0 6px}.dm-sr-solid.ok{color:#1a7a2e}.dm-sr-solid.bad{color:#c0392b}',
    '.dm-sr-checks{display:flex;flex-direction:column;gap:2px;border-top:1px solid #ddd;padding-top:6px}',
    '.dm-sr-chk{display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer}',
    // chrono lens
    '.dm-tl-pane{position:absolute;inset:36px 0 0 0;display:flex;flex-direction:column}',
    '.dm-tl-axis{position:relative;height:190px;border-bottom:2px solid #111;margin:16px 12px 0;flex:none}',
    '.dm-tl-node{position:absolute;bottom:0;transform:translateX(-50%);text-align:center;cursor:pointer;width:112px}',
    '.dm-tl-node.lo{bottom:auto;top:0}',
    '.dm-tl-lab{font-size:11px;font-weight:700;margin-bottom:2px;line-height:1.1}',
    '.dm-tl-dot{width:9px;height:9px;background:#111;margin:0 auto}',
    '.dm-tl-when{font-size:9px;color:#666;margin-top:2px}',
    '.dm-tl-node.sel .dm-tl-dot{background:#c0392b;outline:3px solid rgba(192,57,43,.25)}',
    '.dm-tl-tray{flex:1;overflow:auto;padding:12px;border-top:1px solid #ddd}',
    '.dm-tl-row{display:flex;align-items:center;gap:8px;padding:2px 0}',
    '.dm-tl-rl{flex:1;display:flex;align-items:center;gap:6px}',
    '.dm-tl-in{width:90px}',
    // heat lens
    '.dm-heat-pane{position:absolute;inset:36px 0 0 0;overflow:auto;padding:14px;display:flex;gap:16px;flex-wrap:wrap}',
    '.dm-heat-ladder{min-width:240px;flex:0 0 auto}',
    '.dm-heat-rung{display:flex;align-items:center;gap:8px;border:1px solid #ddd;padding:6px 8px;margin-bottom:3px;color:#999}',
    '.dm-heat-rung.on{border-color:#c0392b;color:#c0392b;font-weight:700}',
    '.dm-heat-thr{width:32px;font-weight:700}',
    '.dm-heat-gauge{margin-top:8px;border-top:2px solid #111;padding-top:6px}',
    '.dm-heat-list{flex:1;min-width:300px}',
    '.dm-heat-row{display:flex;align-items:center;gap:10px;border-bottom:1px solid #ddd;padding:6px 0;flex-wrap:wrap}',
    '.dm-heat-row.sel{background:#f2f2f2}',
    '.dm-heat-nm{flex:1;min-width:120px;cursor:pointer}',
    '.dm-heat-steps{display:flex;align-items:center;gap:10px}',
    '.dm-heat-st{display:flex;align-items:center;gap:3px}.dm-heat-stl{font-size:10px;color:#666;letter-spacing:1px}',
    '.dm-heat-val{min-width:24px;text-align:center;font-weight:700}',
    '.dm-heat-shield.on{background:#111;color:#fff}',
    // carte lens
    '.dm-carte-pane{position:absolute;inset:36px 0 0 0;overflow:auto;padding:14px}',
    '.dm-carte-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px}',
    '.dm-carte-cell{border:1.5px solid #111;min-height:82px;padding:6px}',
    '.dm-carte-dn{font-size:10px;letter-spacing:1px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:4px}',
    '.dm-carte-chip{font-size:11px;border:1px solid #ddd;padding:2px 4px;margin-bottom:3px;cursor:pointer}.dm-carte-chip:hover{background:#111;color:#fff}',
    '.dm-carte-chip.sel{outline:1px solid #c0392b;font-weight:700}',
    '.dm-carte-sel{width:160px}',
    // narrative war lens
    '.dm-war-pane{position:absolute;inset:36px 0 0 0;overflow:auto;padding:14px}',
    '.dm-war-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
    '.dm-war-col{border:1.5px solid #111;padding:8px;min-height:120px}',
    '.dm-war-h{font-size:11px;letter-spacing:1px;font-weight:700;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px}',
    '.dm-war-h.their{color:#c0392b;border-bottom-color:#c0392b}',
    '.dm-war-card{border:1px solid #111;padding:6px 8px;margin-bottom:6px;cursor:pointer}.dm-war-card:hover{background:#f2f2f2}',
    '.dm-war-card.collapsing{border-color:#c0392b;background:repeating-linear-gradient(45deg,#fff,#fff 6px,#fbeaea 6px,#fbeaea 12px)}',
    '.dm-war-txt{font-weight:700;margin-bottom:4px}',
    '.dm-war-meters{display:flex;gap:8px;font-size:10px;color:#666}',
    '.dm-war-add{width:100%;margin-top:4px}',
    '.dm-war-hint{padding:14px;max-width:520px}',
    '.dm-gm-log{margin-top:10px;border-left:2px solid #111;padding:6px 10px;color:#444;min-height:20px}',
    // ── desk: masthead + action tiles + signature + teach ──
    '.dm-desk{padding:0}',
    '.dm-mast{padding:22px 22px 18px;border-bottom:3px solid #111;position:relative}',
    '.dm-mast-tag{font-size:11px;letter-spacing:3px;color:#666;text-transform:uppercase;margin-bottom:6px}',
    '.dm-mast-name{font-family:var(--head,"Eurostile",sans-serif);font-weight:700;font-size:38px;line-height:.95;letter-spacing:1px}',
    '.dm-mast-g{font-size:34px}',
    '.dm-mast-pitch{margin-top:10px;font-size:14px;max-width:640px;color:#222}',
    '.dm-acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-bottom:2px solid #111}',
    '.dm-act{display:flex;flex-direction:column;align-items:flex-start;gap:5px;text-align:left;background:#fff;border:0;border-right:1px solid #ddd;padding:16px;cursor:pointer;font:inherit;color:#111}',
    '.dm-act:hover{background:#111;color:#fff}',
    '.dm-act-l{font-weight:700;letter-spacing:1.5px;font-size:14px}',
    '.dm-act-s{font-size:11px;color:#666}.dm-act:hover .dm-act-s{color:#bbb}',
    '.dm-sig{padding:18px 22px}',
    '.dm-sig-h{font-size:11px;letter-spacing:2px;font-weight:700;margin-bottom:10px}',
    '.dm-teach{margin:0 22px 22px;border:2px solid #111}',
    '.dm-teach-h{background:#111;color:#fff;padding:6px 12px;font-size:11px;letter-spacing:2px;font-weight:700}',
    '.dm-teach-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}',
    '.dm-teach-step{padding:12px;border-right:1px solid #ddd}.dm-teach-step b{display:block;letter-spacing:1px;margin-bottom:4px}.dm-teach-step span{color:#555;font-size:12px}',
    // THE WIRE (Régie pressure + offers, on the journalist's desk)
    '.dm-wire{border:2px solid #111;margin:0 22px 18px}',
    '.dm-wire-h{background:#111;color:#fff;padding:6px 12px;font-size:11px;letter-spacing:2px;font-weight:700}',
    '.dm-wire-offer,.dm-wire-msg{padding:10px 12px;border-bottom:1px solid #ddd}',
    '.dm-wire-offer:last-child,.dm-wire-msg:last-child{border-bottom:0}',
    '.dm-wire-k{font-size:10px;letter-spacing:1px;font-weight:700;border:1px solid #111;display:inline-block;padding:1px 6px;margin-bottom:6px}',
    '.dm-wire-b{font-size:13px;margin-bottom:4px}',
    '.dm-wire-brief{font-size:12px;color:#555;line-height:1.45;margin-bottom:8px;border-left:2px solid #ddd;padding-left:8px}',
    '.dm-wire-from{font-size:12px;font-weight:700;margin-bottom:3px}',
    '.dm-wire-body{font-size:12px;color:#333;line-height:1.45;margin-bottom:8px;white-space:pre-wrap}',
    '.dm-wire-a{display:flex;gap:6px}',
    // new-piece track chooser
    '.dm-track-hint{color:#666;font-size:12px;margin:0 0 14px;max-width:640px;line-height:1.5}',
    '.dm-track-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}',
    '.dm-track-card{display:flex;flex-direction:column;gap:8px;text-align:left;background:#fff;border:2px solid #111;padding:16px;cursor:pointer;font:inherit;color:#111;transition:none}',
    '.dm-track-card:hover{background:#111;color:#fff}',
    '.dm-track-h{font-weight:700;letter-spacing:1.5px;font-size:14px}',
    '.dm-track-c{font-size:12px;color:#555;line-height:1.45;flex:1}.dm-track-card:hover .dm-track-c{color:#ccc}',
    '.dm-track-go{font-size:11px;letter-spacing:1px;font-weight:700;color:#111;border-top:1px solid #ddd;padding-top:8px}.dm-track-card:hover .dm-track-go{color:#fff;border-top-color:#444}',
    // commissioned overlay (composer ② panel)
    '.dm-comm-ov{margin-top:10px;border:1px dashed #bbb;padding:10px;background:#fafafa}',
    '.dm-comm-ov .dm-cf{margin:0}',
    // signature: ratings
    '.dm-sig-ratings{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}',
    '.dm-rat-num{font-family:var(--head,"Eurostile",sans-serif);font-weight:700;font-size:72px;line-height:.9}.dm-rat-num span{font-size:24px;vertical-align:super}',
    '.dm-rundown{flex:1;min-width:260px}',
    '.dm-rd-h{font-size:11px;letter-spacing:2px;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:6px;font-weight:700}',
    '.dm-rd-row{display:flex;align-items:center;gap:10px;border-bottom:1px solid #ddd;padding:5px 0}',
    '.dm-rd-slot{width:22px;height:22px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}',
    '.dm-rd-t{flex:1;font-weight:700}.dm-rd-r{color:#666}',
    // signature: front page
    '.dm-front-rule{border-top:3px solid #111;border-bottom:1px solid #111;padding:4px 0;font-size:10px;letter-spacing:3px;text-align:center;text-transform:uppercase}',
    '.dm-front-lead{font-family:var(--head,"Eurostile",sans-serif);font-weight:700;font-size:32px;line-height:1.02;margin:14px 0 6px;text-transform:uppercase}',
    '.dm-front-dek{font-size:15px;color:#333;font-style:italic}',
    '.dm-front-cold{padding:24px 0;text-align:center}.dm-front-cold span{display:block;color:#777;font-size:13px;margin-top:6px;font-style:italic}',
    // signature: drop
    '.dm-drop-box{border:3px dashed #111;padding:24px;text-align:center;font-weight:700;letter-spacing:3px;font-size:16px}',
    '.dm-drop-box span{display:block;font-weight:400;letter-spacing:0;font-size:12px;color:#666;margin-top:8px}',
    '.dm-redact{display:flex;gap:6px;margin:12px 0}.dm-redact span{height:14px;background:#111;flex:1}.dm-redact span:nth-child(2){flex:.6}.dm-redact span:nth-child(3){flex:1.4}',
    '.dm-drop-switch{font-size:12px;letter-spacing:1px;border-left:3px solid #c0392b;padding-left:10px}',
    // signature: trending
    '.dm-trend-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}',
    '.dm-trend-tile{border:1.5px solid #111;background:#fff}',
    '.dm-trend-thumb{height:74px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;background:#111;background-image:radial-gradient(rgba(255,255,255,.25) 1px,transparent 1.5px);background-size:5px 5px}',
    '.dm-trend-cap{padding:5px 7px;font-weight:700;font-size:12px;line-height:1.1}.dm-trend-buzz{padding:0 7px 6px;font-size:11px;color:#666}',
    // signature: signal
    '.dm-wave{display:flex;align-items:flex-end;gap:2px;height:44px;border-bottom:2px solid #111}.dm-wave i{flex:1;background:#111;min-width:2px}',
    '.dm-mob{margin-top:14px;display:flex;align-items:center;gap:10px}.dm-mob-l{font-size:11px;letter-spacing:2px;font-weight:700}',
    '.dm-mob-bar{flex:1;height:16px;border:1.5px solid #111;padding:2px}.dm-mob-bar i{display:block;height:100%;background:repeating-linear-gradient(45deg,#111 0 6px,#fff 6px 8px)}.dm-mob-v{font-weight:700}',
    // ── per-suite skins (bolder, still ink-on-white) ──
    '.dm-skin-broadcast .dm-mast{background:#111;color:#fff}',
    '.dm-skin-broadcast .dm-mast-tag{color:#bbb}.dm-skin-broadcast .dm-mast-pitch{color:#ddd}',
    '.dm-skin-broadcast .dm-mast:after{content:"● ON AIR";position:absolute;top:14px;right:18px;color:#e6564a;font-weight:700;letter-spacing:1px;font-size:12px}',
    '.dm-skin-broadcast .dm-brand{background:#111;color:#fff}',
    '.dm-skin-press .dm-mast{text-align:center;border-bottom:none;box-shadow:0 3px 0 #111,0 5px 0 #fff,0 6px 0 #111}',
    '.dm-skin-press .dm-mast-name{justify-content:center;font-size:44px;letter-spacing:2px}.dm-skin-press .dm-mast-pitch{margin:10px auto 0;font-style:italic}',
    '.dm-skin-deaddrop .dm-desk{background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(17,17,17,.045) 3px 4px)}',
    '.dm-skin-deaddrop .dm-mast-name{font-family:var(--mono,"Terminal Grotesque",monospace);font-size:30px}',
    '.dm-skin-deaddrop .dm-mast-name:after{content:"_";animation:dm-blink 1s steps(1) infinite}',
    '.dm-skin-deaddrop .dm-rail{background:#111;color:#fff}.dm-skin-deaddrop .dm-navb{color:#fff}.dm-skin-deaddrop .dm-navb:hover,.dm-skin-deaddrop .dm-navb.on{background:#000;border-left-color:#fff}',
    '.dm-skin-deaddrop .dm-brand-v{color:#888;border-color:#333}.dm-skin-deaddrop .dm-rail-foot{color:#888;border-color:#333}.dm-skin-deaddrop .dm-cred b{color:#fff}',
    '@keyframes dm-blink{50%{opacity:0}}',
    '.dm-skin-tabloid .dm-mast{background-image:radial-gradient(#111 1.2px,transparent 1.6px);background-size:7px 7px;border-bottom-width:4px}',
    '.dm-skin-tabloid .dm-mast-name{font-size:50px;letter-spacing:0}',
    '.dm-skin-tabloid .dm-mast-tag,.dm-skin-tabloid .dm-mast-pitch{background:#fff;display:inline-block;padding:2px 7px}',
    '.dm-skin-rig .dm-mast{border-bottom:0}',
    '.dm-skin-rig .dm-mast:before{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;background:repeating-linear-gradient(45deg,#111 0 10px,#fff 10px 20px)}',
    '.dm-skin-rig .dm-mast-name{letter-spacing:6px}.dm-skin-rig .dm-mast-tag:before{content:"\\2691 "}',
    /* ── RÉGIE (GM control room) ── */
    '.rg-root{position:absolute;inset:0;display:flex;background:#fff;color:#111;font-family:var(--mono,"Terminal Grotesque",monospace);font-size:13px;line-height:1.4;overflow:hidden;-webkit-font-smoothing:antialiased}',
    '.rg-root *{box-sizing:border-box}',
    '.rg-locked{align-items:center;justify-content:center}',
    '.rg-lock{text-align:center}.rg-lock-g{font-size:44px}.rg-lock-t{font-weight:700;letter-spacing:2px;margin:10px 0 6px}.rg-lock-s{color:#666;font-size:12px;max-width:320px;margin:0 auto}',
    '.rg-rail{width:200px;flex:none;border-right:2px solid #111;display:flex;flex-direction:column;padding:16px 0}',
    '.rg-brand{padding:0 16px;font-weight:700;letter-spacing:2px;font-size:14px}',
    '.rg-brand-v{padding:4px 16px 14px;color:#666;font-size:11px;border-bottom:2px solid #111;margin-bottom:10px}',
    '.rg-nav{flex:1;display:flex;flex-direction:column;gap:1px}',
    '.rg-navb{background:none;border:0;border-left:3px solid transparent;padding:11px 16px;font:inherit;font-size:12.5px;letter-spacing:1.5px;color:#111;cursor:pointer;text-align:left}',
    '.rg-navb:hover{background:#f2f2f2}.rg-navb.on{border-left-color:#111;font-weight:700;background:#111;color:#fff}',
    '.rg-rail-foot{padding:10px 14px 0;border-top:1px solid #ddd;color:#888;font-size:10px;letter-spacing:1px}',
    '.rg-main{flex:1;position:relative;overflow-y:auto}',
    '.rg-top{position:sticky;top:0;background:#111;color:#fff;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;z-index:2}.rg-top-t{font-weight:700;letter-spacing:2px;font-size:12px}',
    '.rg-pane{padding:16px}',
    '.rg-note{color:#555;font-size:12px;line-height:1.5;margin-bottom:14px;max-width:720px}',
    '.rg-loading{color:#888;padding:12px}',
    '.rg-outlet{border:2px solid #111;padding:12px;margin-bottom:10px}',
    '.rg-outlet-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}.rg-outlet-n{font-weight:700;letter-spacing:1px}.rg-outlet-o{color:#666;font-size:11px}',
    '.rg-outlet-m{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.rg-outlet-l{font-size:12px;color:#333;margin-bottom:8px}',
    '.rg-chip{font-size:10px;letter-spacing:1px;border:1px solid #111;padding:1px 6px}.rg-chip.warn{border-color:#c0392b;color:#c0392b}',
    '.rg-cred{display:inline-block;width:90px;height:8px;border:1px solid #111;position:relative;vertical-align:middle}.rg-cred-b{position:absolute;left:0;top:0;bottom:0;background:#111}.rg-cred-v{font-size:11px;margin-left:2px}',
    '.rg-story{border:1.5px solid #111;padding:10px 12px;margin-bottom:9px}',
    '.rg-story-h{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}.rg-story-t{font-weight:700;flex:1}',
    '.rg-story-m{display:flex;gap:10px;flex-wrap:wrap;color:#666;font-size:11px;margin-bottom:4px;align-items:center}.rg-story-r{font-size:12px;margin-bottom:8px}',
    '.rg-story-a{display:flex;gap:5px;flex-wrap:wrap}',
    '.rg-tag{font-size:10px;letter-spacing:1px;border:1px solid #111;padding:1px 5px}.rg-tag.ok{background:#111;color:#fff}.rg-tag.warn{border-color:#c0392b;color:#c0392b}',
    '.rg-war-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
    '.rg-war-col{border:2px solid #111;padding:8px;min-height:140px}',
    '.rg-war-h{font-size:11px;letter-spacing:1px;font-weight:700;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px}.rg-war-h.their{color:#c0392b;border-bottom-color:#c0392b}',
    '.rg-war-card{border:1px solid #111;padding:6px 8px;margin-bottom:6px;cursor:pointer}.rg-war-card:hover{background:#f2f2f2}',
    '.rg-war-card.collapsing{border-color:#c0392b;background:repeating-linear-gradient(45deg,#fff,#fff 6px,#fbeaea 6px,#fbeaea 12px)}',
    '.rg-war-txt{font-weight:700;margin-bottom:4px}.rg-war-meters{display:flex;gap:8px;font-size:10px;color:#666}.rg-war-add{width:100%;margin-top:4px}.rg-war-hint{margin-top:12px;max-width:520px}',
    '.rg-pop{position:absolute;top:60px;left:50%;transform:translateX(-50%);background:#fff;border:2px solid #111;padding:8px;z-index:5;display:flex;flex-direction:column;gap:4px;box-shadow:6px 6px 0 rgba(0,0,0,.15)}',
    '.rg-pop-h{font-weight:700;padding:2px 6px;border-bottom:1px solid #ddd;margin-bottom:2px;max-width:240px}',
    '.rg-pop-b,.rg-pop-x{font:inherit;font-size:12px;background:#fff;border:1px solid #111;padding:4px 8px;cursor:pointer;text-align:left}.rg-pop-b:hover{background:#111;color:#fff}',
    '.rg-pop-x{border-style:dashed;color:#666}.rg-pop-x:hover{color:#c0392b;border-color:#c0392b}',
    '.rg-grp{border:2px solid #111;margin:14px 0}',
    '.rg-grp-h{background:#111;color:#fff;padding:7px 12px;font-size:12px;letter-spacing:1.5px;font-weight:700}',
    '.rg-grp-body{padding:12px}',
    '.rg-grp-note{color:#666;font-size:11.5px;line-height:1.5;margin-bottom:10px}',
    '.rg-f{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}.rg-f-l{font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase}',
    '.rg-in{font:inherit;font-size:13px;border:1.5px solid #111;padding:7px 9px;background:#fff;color:#111;width:100%}.rg-in:focus{outline:none;box-shadow:inset 0 0 0 1px #111}',
    'select.rg-in{cursor:pointer}',
    '.rg-ta{min-height:64px;resize:vertical}',
    '.rg-payout{display:flex;gap:8px}.rg-payout .rg-in{flex:1}.rg-payout-th{max-width:120px}',
    '.rg-chk{display:flex;align-items:center;gap:8px;font-size:12.5px;margin:2px 0 12px;cursor:pointer}',
    '.rg-form{border-top:2px solid #111;margin-top:12px;padding-top:12px}',
    '.rg-add{font:inherit;font-size:12px;letter-spacing:1.5px;font-weight:700;background:#111;color:#fff;border:2px solid #111;padding:9px 16px;cursor:pointer;width:100%;text-transform:uppercase}.rg-add:hover{background:#fff;color:#111}',
    '.rg-item{border:1.5px solid #111;padding:10px 12px;margin-bottom:10px;display:flex;flex-direction:column;gap:3px}',
    '.rg-item-off{opacity:.55}.rg-item-t{font-weight:700;letter-spacing:.5px}.rg-item-l{font-size:12px;color:#555}',
    '.rg-item-a{display:flex;gap:6px;margin-top:6px}',
    '.rg-mini{font:inherit;font-size:11px;letter-spacing:.5px;background:#fff;border:1.5px solid #111;padding:4px 10px;cursor:pointer}.rg-mini:hover{background:#111;color:#fff}.rg-mini.del:hover{background:#c0392b;border-color:#c0392b;color:#fff}',
    '.rg-empty2{color:#888;font-size:12px;padding:6px 2px 10px}',
    '.rg-doss-build{border:1px dashed #bbb;padding:10px;margin:4px 0 10px;background:#fafafa}',
    '.rg-doss-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;border-bottom:1px solid #eee;padding:4px 0}',
    '.rg-doss-inline{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.rg-doss-inline .rg-in{flex:1;min-width:120px}',
    '.rg-log{margin-top:10px;font-size:12px;color:#333;white-space:pre-wrap}',
    '.dm-btn.sm{padding:4px 10px;font-size:11px}'
  ].join('\n');
  var style = document.createElement('style'); style.id = 'dm-media-styles'; style.textContent = CSS;
  document.head.appendChild(style);
})();
