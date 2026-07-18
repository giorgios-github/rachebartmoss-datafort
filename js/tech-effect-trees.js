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
          { l: 'Trauma-insert' }, { l: 'Ceramic' }, { l: 'Ablative', sc: { max: 3, per: 'hits' } }] },
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
        kids: [] };
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

  // helpers the UI needs
  function pathTier(g, path) { return (path || []).reduce(function (m, id) { return g.nodes[id] ? Math.max(m, g.nodes[id].tier) : m; }, 0); }
  function frontier(g, path) { // children of the deepest picked node = the next choices
    if (!path || !path.length) return g.nodes[g.root].kids.slice();
    var last = path[path.length - 1]; return g.nodes[last] ? g.nodes[last].kids.slice() : [];
  }
  function crumbs(g, path) { return (path || []).map(function (id) { return g.nodes[id] ? g.nodes[id].label : id; }); }
  function collect(g, path, key) { // gather a node field (act/tag/need/bridge) along the path
    var out = []; (path || []).forEach(function (id) { var n = g.nodes[id]; if (n && n[key]) out.push(n[key]); });
    return out;
  }

  window.TechTrees = { TREES: TREES, has: hasTree, get: build, layout: layout,
    pathTier: pathTier, frontier: frontier, crumbs: crumbs, collect: collect };
})();
