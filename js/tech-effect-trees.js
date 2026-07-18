/* tech-effect-trees.js — EFFECT TREES (cran 5 · replaces the flat grade ladder).
   An effect is no longer a scalar grade — it's a PATH walked down a per-domain tree.
   tier (= depth from root) IS the old grade, kept as an annotation.

   Authoring: a nested literal per domain (short keys, dense to write):
     { l:label, cap:caption, act:action, tag:addon-filter, need:requires,
       sc:{max,per} (° dial), arch:archetype-name, kids:[…] }
   Domains without an authored tree fall back to a LINEAR spine built from
   TechCatalog.ANCHORS[domain].bars — i.e. the old g1..g6 ladder, verbatim.

   Exposes window.TechTrees { get(domain) → graph, layout(graph) → positioned }. */
(function () {
  'use strict';
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) || 'n'; }

  // ── authored trees (bushy where it matters: g3–g4) ──
  var TREES = {
    STRIKE: { l: 'Weapon', cap: 'it wounds', kids: [
      { l: 'Ranged', kids: [
        { l: 'Ballistic', kids: [
          { l: 'Sidearm', act: 'aimed-shot', kids: [
            { l: 'Compact', tag: 'conceal' },
            { l: 'Match', act: 'aimed-shot', kids: [
              { l: 'Marksman', act: 'overwatch', kids: [{ l: 'Anti-materiel', arch: 'Barrett', need: 'mount' }] }] },
            { l: 'Heavy', act: 'pierce' }] },
          { l: 'SMG', sc: { max: 3, per: 'rof' }, tag: 'mag' },
          { l: 'Longarm', act: 'burst', kids: [
            { l: 'Assault', act: 'burst', tag: 'rail' },
            { l: 'Marksman', act: 'overwatch', kids: [{ l: 'Fire-control', act: 'overwatch', need: 'node:SENSE.tag' }] },
            { l: 'Shotgun', act: 'spread' }] },
          { l: 'Launcher', act: 'lob', tag: 'tube' }] },
        { l: 'Energy', need: 'power', kids: [
          { l: 'Beam', kids: [
            { l: 'Continuous', sc: { max: 3, per: 'sustain' }, act: 'burn' },
            { l: 'Pulse', act: 'overcharge' }] },
          { l: 'Arc', kids: [{ l: 'Chain', sc: { max: 3, per: 'targets' }, act: 'arc' }] }] }] },
      { l: 'Melee', cap: 'silent', kids: [
        { l: 'Blade', kids: [
          { l: 'Mono', arch: 'mantis' },
          { l: 'Vibro', sc: { max: 3, per: 'cut' } },
          { l: 'Poisoned', act: 'inject', need: 'node:INJECT' }] },
        { l: 'Blunt', act: 'stagger' },
        { l: 'Flexible', kids: [{ l: 'Monowire', act: 'dismember' }] }] }] },

    ARMOR: { l: 'Cover', cap: 'it stops a hit', kids: [
      { l: 'Worn', kids: [
        { l: 'Weave', kids: [
          { l: 'Kevlar' }, { l: 'Silk', tag: 'conceal' }, { l: 'Trauma-lined', act: 'cushion' }] },
        { l: 'Sealed', need: 'seal', kids: [
          { l: 'Filter-liner' }, { l: 'Hardsuit', kids: [{ l: 'Deep-env' }] }] }] },
      { l: 'Rigid', kids: [
        { l: 'Plate', kids: [
          { l: 'Trauma-insert', add: true, cap: 'stacks with other treatments' },
          { l: 'Ceramic', add: true, cap: 'stacks with other treatments', kids: [
            { l: 'Milspec plate', needsAll: ['rigid.plate.trauma-insert'], arch: 'milspec', cap: 'needs trauma-insert + ceramic' }] },
          { l: 'Ablative', add: true, sc: { max: 3, per: 'hits' }, cap: 'ablates by the hit' }] },
        { l: 'Composite', kids: [
          { l: 'Reactive', sc: { max: 3, per: 'coverage' }, need: 'power', act: 'brace' },
          { l: 'Self-seal', act: 'patch' },
          { l: 'Powered', need: 'node:MOVE.servo', act: 'carry', kids: [{ l: 'Exo', arch: 'Dragoon', act: 'shrug' }] }] }] }] },

    HACK: { l: 'Intrusion', cap: 'get in', bridge: 'net', kids: [
      { l: 'Access', kids: [
        { l: 'Lockpick', act: 'unlock' },
        { l: 'Spoof', act: 'spoof', need: 'data-port' },
        { l: 'Brute', act: 'crack-pw' }] },
      { l: 'Breach', act: 'breach', kids: [
        { l: 'Rootkit', act: 'persist' },
        { l: 'Backdoor' },
        { l: 'Escalate', act: 'root', kids: [
          { l: 'Crack-fort', bridge: 'net', act: 'crack', kids: [{ l: 'Own-net', sc: { max: 3, per: 'reach' }, act: 'own' }] }] }] },
      { l: 'Stealth', kids: [
        { l: 'Loop-feeds', act: 'loop' },
        { l: 'Wipe-trail', act: 'wipe' },
        { l: 'Trace-back', act: 'trace' }] },
      { l: 'Payload', kids: [
        { l: 'Virus', act: 'infect' },
        { l: 'Logic-bomb', act: 'arm' },
        { l: 'Ransom', act: 'lock-sys' }] }] },

    SENSE: { l: 'Sense', cap: 'perceive', kids: [
      { l: 'Optical', kids: [
        { l: 'Zoom', sc: { max: 3, per: 'magnify' } },
        { l: 'Low-light', kids: [{ l: 'Thermal', kids: [{ l: 'Multispectral' }] }] }] },
      { l: 'Signal', need: 'power', kids: [
        { l: 'Radar', sc: { max: 4, per: 'range' }, act: 'ping' },
        { l: 'Intercept', bridge: 'net', act: 'tap' }] },
      { l: 'Track', kids: [
        { l: 'Follow', sc: { max: 3, per: 'range' }, act: 'track' },
        { l: 'Predict', need: 'node:COMPUTE.expert', act: 'predict' }] }] },

    HEAL: { l: 'Heal', cap: 'mend', kids: [
      { l: 'First-aid', kids: [
        { l: 'Stabilize', sc: { max: 3, per: 'charges' }, act: 'stabilize' },
        { l: 'Trauma-pack', tag: 'sterile' }] },
      { l: 'Chem', need: 'injector', kids: [
        { l: 'Stim', sc: { max: 3, per: 'doses' }, act: 'dose' },
        { l: 'Antitox', act: 'purge' }] },
      { l: 'Nano', need: 'power', kids: [
        { l: 'Repair', sc: { max: 3, per: 'rate' }, act: 'mend', kids: [{ l: 'Regen', arch: 'regen bay', need: 'mount' }] }] }] },
  };

  function hasTree(domain) { return !!TREES[String(domain || '').toUpperCase()]; }

  // build a linear spine from the catalogue's grade bars (the OLD ladder, as a tree)
  function linearRoot(domain) {
    var C = window.TechCatalog, an = C && C.ANCHORS && C.ANCHORS[domain];
    var bars = (an && an.bars) || [];
    var root = { l: domain, cap: (an && an.skill) || '', kids: [] }, cur = root;
    for (var g = 1; g <= 6; g++) { var n = { l: bars[g] || ('g' + g), kids: [] }; cur.kids = [n]; cur = n; }
    return root;
  }

  // flatten a nested literal into a graph: nodes{id}, edges, tiers, roots
  function build(domain) {
    domain = String(domain || '').toUpperCase();
    var rootLit = TREES[domain] || linearRoot(domain);
    var nodes = {}, edges = [], byTier = {};
    (function walk(lit, parentId, tier) {
      var id;
      if (parentId === null) id = 'ROOT';
      else { var base = parentId === 'ROOT' ? slug(lit.l) : parentId + '.' + slug(lit.l); id = base; var k = 2; while (nodes[id]) { id = base + '~' + k; k++; } }
      var n = { id: id, tier: tier, parent: parentId, label: lit.l, cap: lit.cap || '',
        act: lit.act || null, tag: lit.tag || null, need: lit.need || null,
        scale: lit.sc || null, arch: lit.arch || null, bridge: lit.bridge || null,
        add: !!lit.add, needsAll: lit.needsAll || null, kids: [] };
      nodes[id] = n; (byTier[tier] || (byTier[tier] = [])).push(id);
      if (parentId) { edges.push({ from: parentId, to: id }); nodes[parentId].kids.push(id); }
      (lit.kids || []).forEach(function (c) { walk(c, id, tier + 1); });
      return id;
    })(rootLit, null, 0);
    var rootId = byTier[0][0];
    return { domain: domain, authored: !!TREES[domain], nodes: nodes, edges: edges, byTier: byTier,
      root: rootId, maxTier: Math.max.apply(null, Object.keys(byTier).map(Number)) };
  }

  // ── layout: tiers = rows (top→bottom), tidy x (leaves sequential, parents centered) ──
  function layout(g, opt) {
    opt = opt || {};
    var colW = opt.colW || 118, rowH = opt.rowH || 76, padX = opt.padX || 70, padY = opt.padY || 40;
    var x = {}, seq = { n: 0 };
    (function place(id) {
      var n = g.nodes[id];
      if (!n.kids.length) { x[id] = seq.n++; return x[id]; }
      var xs = n.kids.map(place);
      x[id] = (xs[0] + xs[xs.length - 1]) / 2; return x[id];
    })(g.root);
    var pos = {}, maxX = 0;
    Object.keys(g.nodes).forEach(function (id) {
      var n = g.nodes[id], px = padX + x[id] * colW, py = padY + n.tier * rowH;
      pos[id] = { id: id, x: px, y: py, tier: n.tier }; if (px > maxX) maxX = px;
    });
    return { pos: pos, W: maxX + padX, H: padY + (g.maxTier + 1) * rowH, colW: colW, rowH: rowH, padX: padX, padY: padY };
  }

  // ── selection engine (path = a SET of node ids; a ° dial node is stored 'id@n') ──
  // status → glyph: excl = ○ (pick one) · add = □ (stackable) · dial = ◇ (° cumulative) · conv = ⬡ (needsAll)
  function baseId(p) { return String(p).split('@')[0]; }
  function scaleOf(path, id) { var e = (path || []).filter(function (p) { return baseId(p) === id; })[0]; return e && e.indexOf('@') >= 0 ? (+e.split('@')[1] || 1) : null; }
  function activeIds(path) { return (path || []).map(baseId); }
  function isActive(path, id) { return activeIds(path).indexOf(id) >= 0; }
  function kindOf(n) { return n.needsAll ? 'conv' : n.scale ? 'dial' : n.add ? 'add' : 'excl'; }
  function ancestors(g, id) { var out = [], cur = id; while (cur && cur !== 'ROOT' && g.nodes[cur]) { out.unshift(cur); cur = g.nodes[cur].parent; } return out; }
  function pickable(g, path, id) { // parent active (or tier 1) AND every needsAll met
    var n = g.nodes[id]; if (!n) return false;
    var parentOk = n.tier <= 1 || isActive(path, n.parent);
    var reqOk = !n.needsAll || n.needsAll.every(function (r) { return isActive(path, r); });
    return parentOk && reqOk;
  }
  function toggle(g, path, id) {
    var set = (path || []).slice();
    var ids = function () { return set.map(baseId); };
    var has = function (x) { return ids().indexOf(x) >= 0; };
    var removeSub = function (x) { var kill = {}; (function rec(y) { kill[y] = 1; (g.nodes[y].kids || []).forEach(rec); })(x); set = set.filter(function (p) { return !kill[baseId(p)]; }); };
    var n = g.nodes[id]; if (!n) return set;
    if (has(id)) { removeSub(id); return set; }                          // un-pick (prunes its subtree)
    if (n.needsAll && !n.needsAll.every(has)) return set;                // convergence gate unmet → no-op
    ancestors(g, id).forEach(function (nid) {                            // ensure the chain, honouring exclusivity
      var node = g.nodes[nid]; if (has(nid)) return;
      (g.nodes[node.parent] ? g.nodes[node.parent].kids : []).forEach(function (sib) {
        if (sib !== nid && has(sib) && !node.add && !g.nodes[sib].add) removeSub(sib);   // exclusive siblings drop
      });
      set.push(node.scale ? nid + '@1' : nid);
    });
    return set;
  }
  function setScale(path, id, v) { return (path || []).map(function (p) { return baseId(p) === id ? id + '@' + Math.max(1, v | 0) : p; }); }
  function pathTier(g, path) { return activeIds(path).reduce(function (m, id) { return g.nodes[id] ? Math.max(m, g.nodes[id].tier) : m; }, 0); }
  function tips(g, path) { var a = activeIds(path); return a.filter(function (id) { return !(g.nodes[id].kids || []).some(function (k) { return a.indexOf(k) >= 0; }); }); }
  function crumbs(g, path) { return tips(g, path).map(function (id) { return ancestors(g, id).map(function (x) { return g.nodes[x].label; }).join(' › '); }); }
  function collect(g, path, key) { var out = []; activeIds(path).forEach(function (id) { var n = g.nodes[id]; if (n && n[key] && out.indexOf(n[key]) < 0) out.push(n[key]); }); return out; }

  window.TechTrees = { TREES: TREES, has: hasTree, get: build, layout: layout,
    kindOf: kindOf, pickable: pickable, isActive: isActive, activeIds: activeIds, ancestors: ancestors,
    toggle: toggle, scaleOf: scaleOf, setScale: setScale, pathTier: pathTier, tips: tips, crumbs: crumbs, collect: collect };
})();
