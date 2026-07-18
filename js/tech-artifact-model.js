/* tech-artifact-model.js — the TECH artifact RECORD (cran 1).
   Pure, no DOM. An object is this record; the fiche is a projection of it.

   THREE LAYERS (docs/tech-artifacts-design.md):
     1. INTERFACES — jetons + sélecteurs : takes / fits / holds / needs / feeds
     2. EFFECTS    — feats { domain (free), grade 0–6, uses/dur/when } + limits + mods
     3. PRODUCTION — everything DERIVED (DC / OP / cost / ingredients), never authored

   Grade = distance to market. Every derived number lives in TUNING — nothing is
   hardcoded downstream (design fragility #2 isolated here for playtest tuning).

   Degeneracy: a flat DB item = { cls, stats }, zero feats — still a valid record.
   Exposes window.TechArtifact. */
(function () {
  'use strict';

  // ── TUNING — the whole derived-math surface, in one editable place ──
  var TUNING = {
    grade: { min: 0, max: 6 },
    dc: {
      base: 8,
      perGradeTop: 2,      // hardest feature drives the floor
      perFeature: 1.5,     // each ADDITIONAL feature
      perInterface: 1,     // takes-slot / needs line = integration effort
      exoticDomain: 3,     // a domain with no market anchor is harder
      perTierOverThree: 1, // big things are harder to make
    },
    op: {
      perGradeSum: 1,      // raw power = Σ grades
      limitRelief: 1.5,    // each declared limit lowers OP (limits are the balance engine)
      pushRisk: 0.6,       // instability per grade above the maker's ceiling (used at cran 2)
    },
    cost: {
      matBase: 40,
      matPerGrade: 60,     // materials ≈ Σ grades
      hoursPerDC: 0.5,
      streetMult: 2.2,     // STREET = PROD × this × (1 + 0.12·gradeTop)
      streetPerGradeTop: 0.12,
    },
    lineage: { perStep: 2, cap: 6 },  // re-crafting your own line lowers DC, capped
    ingredient: { gradeBelow: 1 },    // a feature grade N needs a component grade N−1
    gate: { instabilityPerLevel: 0.6 },  // building above your skill = PUSH, per level of deficit
  };
  var WHO = ['maker', 'owner', 'GM', 'public'];

  var _n = 0;
  function newId(prefix) {
    _n = (_n + 1) % 1e6;
    return (prefix || 'art') + '-' + _n.toString(36) + '-' + (('' + (_n * 2654435761 % 1e9)).slice(-4));
  }
  function clampGrade(g) { g = Math.round(+g || 0); return Math.max(TUNING.grade.min, Math.min(TUNING.grade.max, g)); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function str(x) { return x == null ? '' : String(x); }

  // ── the record ──
  function blank(opts) {
    opts = opts || {};
    return normalize({
      id: opts.id || newId('art'),
      name: opts.name || 'UNTITLED ARTIFACT',
      cls: opts.cls || 'gear',
      tier: opts.tier || 1,
      flavor: opts.flavor || '',
      origin: opts.origin || 'HANDMADE',
      feats: opts.feats || [],
      ports: opts.ports || {},
      limits: opts.limits || [],
      mods: opts.mods || [],
      lineage: opts.lineage || null,
      latent: opts.latent || [],
      stats: opts.stats || {},
      plate: opts.plate || null,   // { png:dataURL, w, h } — attached pressed plate (cran 1)
    });
  }

  function normFeat(f) {
    f = f || {};
    var o = { domain: str(f.domain || 'EFFECT').toUpperCase(), grade: clampGrade(f.grade != null ? f.grade : 1) };
    if (f.uses != null) o.uses = str(f.uses);
    if (f.dur != null) o.dur = str(f.dur);
    if (f.when != null) o.when = str(f.when);
    if (f.note != null) o.note = str(f.note);
    return o;
  }
  function normPorts(p) {
    p = p || {};
    return {
      takes: arr(p.takes).map(function (t) { return { slot: str(t.slot || 'slot'), accepts: arr(t.accepts).map(str), n: Math.max(1, +t.n || 1) }; }),
      fits: arr(p.fits).map(str),
      holds: arr(p.holds).map(function (h) { return { kind: str(h.kind || 'item'), cap: str(h.cap || ''), contents: h.contents != null ? str(h.contents) : '' }; }),
      needs: arr(p.needs).map(function (n) { return { token: str(n.token || ''), rate: n.rate != null ? str(n.rate) : '', service: !!n.service }; }),
      feeds: arr(p.feeds).map(str),
    };
  }
  function normWho(w) { w = arr(w).filter(function (x) { return WHO.indexOf(x) >= 0; }); return w.length ? w : ['maker', 'GM']; }

  function normalize(p) {
    p = p || {};
    p.id = p.id || newId('art');
    p.name = str(p.name || 'UNTITLED ARTIFACT');
    p.cls = str(p.cls || 'gear');
    p.tier = Math.max(1, Math.min(6, Math.round(+p.tier || 1)));
    p.flavor = str(p.flavor || '');
    p.origin = str(p.origin || 'HANDMADE');
    p.feats = arr(p.feats).map(normFeat);
    p.ports = normPorts(p.ports);
    p.limits = arr(p.limits).map(function (l) { return typeof l === 'string' ? { text: l, relief: 1 } : { text: str(l.text), relief: l.relief != null ? +l.relief : 1 }; });
    p.mods = arr(p.mods).map(function (m) { return { target: str(m.target || ''), value: str(m.value != null ? m.value : ''), when: str(m.when || 'when worn') }; });
    p.lineage = p.lineage ? { refines: str(p.lineage.refines || ''), steps: Math.max(0, Math.round(+p.lineage.steps || 0)) } : null;
    p.latent = arr(p.latent).map(function (x) { return { text: str(x.text || x), domain: str(x.domain || '').toUpperCase(), grade: x.grade != null ? clampGrade(x.grade) : null, who: normWho(x.who) }; });
    p.stats = (p.stats && typeof p.stats === 'object') ? p.stats : {};
    if (p.plate && !(p.plate.png)) p.plate = null;
    return p;
  }

  // ── DERIVES (pure, tunable) ──
  function gradeTop(p) { return p.feats.reduce(function (m, f) { return Math.max(m, f.grade); }, 0); }
  function gradeSum(p) { return p.feats.reduce(function (s, f) { return s + f.grade; }, 0); }
  function interfaceCount(p) { return p.ports.takes.length + p.ports.needs.length + p.ports.holds.length; }

  // ingredients: one graded component per feature (grade N ← component N−1); grade-0 feats need none
  function ingredients(p, isKnownDomain) {
    var out = [];
    p.feats.forEach(function (f) {
      var g = f.grade - TUNING.ingredient.gradeBelow;
      if (g >= 1) out.push({ domain: f.domain, grade: g, exotic: isKnownDomain ? !isKnownDomain(f.domain) : false });
    });
    return out;
  }

  function derive(p, opts) {
    opts = opts || {};
    var isKnown = opts.isKnownDomain || null;
    var nExotic = isKnown ? p.feats.filter(function (f) { return !isKnown(f.domain); }).length : 0;
    var gt = gradeTop(p), gs = gradeSum(p), nF = p.feats.length, nI = interfaceCount(p);
    var T = TUNING;

    var dc = T.dc.base
      + T.dc.perGradeTop * gt
      + T.dc.perFeature * Math.max(0, nF - 1)
      + T.dc.perInterface * nI
      + T.dc.exoticDomain * nExotic
      + T.dc.perTierOverThree * Math.max(0, p.tier - 3);
    dc = Math.round(dc);

    var lineBonus = 0;
    if (p.lineage && p.lineage.steps > 0) lineBonus = Math.min(T.lineage.cap, T.lineage.perStep * p.lineage.steps);
    var dcLineage = Math.max(T.dc.base, dc - lineBonus);

    var nLimits = p.limits.length;
    var op = Math.max(0, Math.round(T.op.perGradeSum * gs - T.op.limitRelief * nLimits));

    var prodEb = Math.round(T.cost.matBase + T.cost.matPerGrade * gs);
    var prodHours = Math.max(1, Math.round(T.cost.hoursPerDC * dcLineage));
    var streetEb = Math.round(prodEb * T.cost.streetMult * (1 + T.cost.streetPerGradeTop * gt));

    var ingr = ingredients(p, isKnown);

    return {
      gradeTop: gt, gradeSum: gs, nFeats: nF, nInterfaces: nI, nExotic: nExotic,
      dc: dc, dcLineage: dcLineage, lineBonus: lineBonus,
      op: op, prodEb: prodEb, prodHours: prodHours, streetEb: streetEb,
      ingredients: ingr,
    };
  }

  // ---- GATING (cran 2): confront the BUILDER's skills against what the object
  // needs. Player-side: your levels unlock (or lock) what you can craft, and show
  // WHY. Class base skill = prerequisite (need ≥1); each feature's domain skill =
  // a ceiling (level ≥ grade to build safe; below = PUSH, buys instability; 0 = locked).
  function gate(p, skills, opt) {
    opt = opt || {}; skills = skills || {};
    var sfc = opt.skillForClass || function () { return 'Basic Tech'; };
    var sfd = opt.skillForDomain || function () { return 'Basic Tech'; };
    var lvl = function (name) {
      if (skills[name] != null) return +skills[name] || 0;
      var lc = String(name).toLowerCase();
      for (var k in skills) if (String(k).toLowerCase() === lc) return +skills[k] || 0;
      return 0;
    };
    var T = TUNING.gate, need = {}, isClass = {};
    var cs = sfc(p.cls); need[cs] = Math.max(need[cs] || 0, 1); isClass[cs] = true;   // class prerequisite
    p.feats.forEach(function (f) { var sk = sfd(f.domain); need[sk] = Math.max(need[sk] || 0, f.grade); });
    var rows = [], locks = [], pushes = [], instab = 0;
    Object.keys(need).forEach(function (sk) {
      var n = need[sk], have = lvl(sk), status = 'ok', push = 0;
      if (have <= 0) { status = 'locked'; locks.push(sk); }
      else if (have < n) { status = 'push'; push = n - have; pushes.push({ skill: sk, by: push }); instab += push * T.instabilityPerLevel; }
      rows.push({ skill: sk, need: n, have: have, status: status, push: push, isClass: !!isClass[sk] });
    });
    rows.sort(function (a, b) { return (b.isClass ? 1 : 0) - (a.isClass ? 1 : 0) || (a.status === 'locked' ? -1 : 1); });
    return { rows: rows, locks: locks, pushes: pushes, instability: Math.round(instab * 10) / 10, buildable: locks.length === 0, classSkill: cs };
  }

  // ── compact one-line record (library copy/import) ──
  function toJSON(p) {
    var o = { id: p.id, name: p.name, cls: p.cls, tier: p.tier };
    if (p.flavor) o.flavor = p.flavor;
    if (p.origin && p.origin !== 'HANDMADE') o.origin = p.origin;
    if (p.feats.length) o.feats = p.feats;
    var pr = p.ports, hasP = pr.takes.length || pr.fits.length || pr.holds.length || pr.needs.length || pr.feeds.length;
    if (hasP) o.ports = pr;
    if (p.limits.length) o.limits = p.limits;
    if (p.mods.length) o.mods = p.mods;
    if (p.lineage) o.lineage = p.lineage;
    if (p.latent.length) o.latent = p.latent;
    if (Object.keys(p.stats).length) o.stats = p.stats;
    if (p.plate) o.plate = p.plate;
    return JSON.stringify(o);
  }
  function fromJSON(s) { try { return normalize(typeof s === 'string' ? JSON.parse(s) : s); } catch (e) { return null; } }
  function clone(p) { return normalize(JSON.parse(toJSON(p))); }

  window.TechArtifact = {
    TUNING: TUNING, WHO: WHO,
    newId: newId, blank: blank, normalize: normalize, derive: derive, gate: gate,
    gradeTop: gradeTop, gradeSum: gradeSum, ingredients: ingredients,
    toJSON: toJSON, fromJSON: fromJSON, clone: clone,
  };
})();
