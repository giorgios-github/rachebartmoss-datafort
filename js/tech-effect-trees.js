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
    STRIKE: { l: 'Weapon', cap: 'a thing that wounds', kids: [
      { l: 'Ranged', cap: 'strikes at a distance', kids: [
        { l: 'Ballistic', cap: 'throws slugs — bullets', kids: [
          { l: 'Sidearm', cap: 'pistol-class, one-handed', act: 'aimed-shot', kids: [
            { l: 'Compact', cap: 'small, concealable frame', tag: 'conceal' },
            { l: 'Match', cap: 'precision-tuned frame', act: 'aimed-shot', kids: [
              { l: 'Marksman', cap: 'accurate long-range fire', act: 'overwatch', kids: [{ l: 'Anti-materiel', cap: 'punches through vehicles & walls', arch: 'Barrett', need: 'mount' }] }] },
            { l: 'Heavy', cap: 'big rounds, hard hits', act: 'pierce' }] },
          { l: 'SMG', cap: 'high fire-rate, close range', sc: { max: 3, per: 'rof' }, tag: 'mag' },
          { l: 'Longarm', cap: 'rifle-class, two-handed', act: 'burst', kids: [
            { l: 'Assault', cap: 'select-fire carbine', act: 'burst', tag: 'rail' },
            { l: 'Marksman', cap: 'accurate long-range fire', act: 'overwatch', kids: [{ l: 'Fire-control', cap: 'computer-aimed, watches an arc', act: 'overwatch', need: 'node:SENSE.tag' }] },
            { l: 'Shotgun', cap: 'wide spread, close range', act: 'spread' }] },
          { l: 'Launcher', cap: 'lobs grenades / rockets', act: 'lob', tag: 'tube' }] },
        { l: 'Energy', cap: 'directed energy (needs power)', need: 'power', kids: [
          { l: 'Beam', cap: 'coherent energy beam', kids: [
            { l: 'Continuous', cap: 'sustained beam that burns through', sc: { max: 3, per: 'sustain' }, act: 'burn' },
            { l: 'Pulse', cap: 'a burst of energy', act: 'overcharge' }] },
          { l: 'Arc', cap: 'an electric arc', kids: [{ l: 'Chain', cap: 'arc that jumps between targets', sc: { max: 3, per: 'targets' }, act: 'arc' }] }] }] },
      { l: 'Melee', cap: 'silent, hand-to-hand', kids: [
        { l: 'Blade', cap: 'an edged weapon', kids: [
          { l: 'Mono', cap: 'monomolecular edge — cuts most matter', arch: 'mantis' },
          { l: 'Vibro', cap: 'vibrating blade, deeper cuts', sc: { max: 3, per: 'cut' } },
          { l: 'Poisoned', cap: 'coated to inject on a hit', act: 'inject', need: 'node:INJECT' }] },
        { l: 'Blunt', cap: 'impact weapon, staggers', act: 'stagger' },
        { l: 'Flexible', cap: 'whip / wire — reach + entangle', kids: [{ l: 'Monowire', cap: 'monofilament wire, dismembers', act: 'dismember' }] }] }] },

    ARMOR: { l: 'Cover', cap: 'a thing that stops a hit', kids: [
      { l: 'Worn', cap: 'soft, wearable protection', kids: [
        { l: 'Weave', cap: 'ballistic fabric', kids: [
          { l: 'Kevlar', cap: 'aramid weave, common' }, { l: 'Silk', cap: 'thin, concealable', tag: 'conceal' }, { l: 'Trauma-lined', cap: 'cushions blunt trauma', act: 'cushion' }] },
        { l: 'Sealed', cap: 'airtight (needs a seal)', need: 'seal', kids: [
          { l: 'Filter-liner', cap: 'filters bad air' }, { l: 'Hardsuit', cap: 'rigid pressure suit', kids: [{ l: 'Deep-env', cap: 'deep-sea / vacuum rated' }] }] }] },
      { l: 'Rigid', cap: 'hard-shell protection', kids: [
        { l: 'Plate', cap: 'rigid armour plate', kids: [
          { l: 'Trauma-insert', add: true, cap: 'shock-plate; stacks with other treatments' },
          { l: 'Ceramic', add: true, cap: 'shatters incoming rounds; stacks', kids: [
            { l: 'Milspec plate', needsAll: ['rigid.plate.trauma-insert'], arch: 'milspec', cap: 'military composite — needs trauma-insert + ceramic' }] },
          { l: 'Ablative', add: true, sc: { max: 3, per: 'hits' }, cap: 'sacrificial layer, ablates each hit' }] },
        { l: 'Composite', cap: 'layered high-tech plate', kids: [
          { l: 'Reactive', cap: 'reacts to a hit and braces (needs power)', sc: { max: 3, per: 'coverage' }, need: 'power', act: 'brace' },
          { l: 'Self-seal', cap: 'seals its own breaches', act: 'patch' },
          { l: 'Powered', cap: 'motorized frame, carries the load (needs servos)', need: 'node:MOVE.servo', act: 'carry', kids: [{ l: 'Exo', cap: 'full exoskeleton — shrugs hits', arch: 'Dragoon', act: 'shrug' }] }] }] }] },

    HACK: { l: 'Intrusion', cap: 'a thing that gets in', bridge: 'net', kids: [
      { l: 'Access', cap: 'get past a lock / gate', kids: [
        { l: 'Lockpick', cap: 'opens physical & electronic locks', act: 'unlock' },
        { l: 'Spoof', cap: 'fakes credentials (needs a port)', act: 'spoof', need: 'data-port' },
        { l: 'Brute', cap: 'cracks passwords by force', act: 'crack-pw' }] },
      { l: 'Breach', cap: 'break into a device', act: 'breach', kids: [
        { l: 'Rootkit', cap: 'stays in after the breach', act: 'persist' },
        { l: 'Backdoor', cap: 'leaves a quiet way back in' },
        { l: 'Escalate', cap: 'grabs root / admin rights', act: 'root', kids: [
          { l: 'Crack-fort', cap: 'assaults a full datafort (NET)', bridge: 'net', act: 'crack', kids: [{ l: 'Own-net', cap: 'owns the whole subnet', sc: { max: 3, per: 'reach' }, act: 'own' }] }] }] },
      { l: 'Stealth', cap: 'stay undetected', kids: [
        { l: 'Loop-feeds', cap: 'loops camera / sensor feeds', act: 'loop' },
        { l: 'Wipe-trail', cap: 'erases the logs', act: 'wipe' },
        { l: 'Trace-back', cap: 'traces the sysop back', act: 'trace' }] },
      { l: 'Payload', cap: 'drop malware', kids: [
        { l: 'Virus', cap: 'self-spreading infection', act: 'infect' },
        { l: 'Logic-bomb', cap: 'triggers on a condition', act: 'arm' },
        { l: 'Ransom', cap: 'locks the system for ransom', act: 'lock-sys' }] }] },

    SENSE: { l: 'Sense', cap: 'a thing that perceives', kids: [
      { l: 'Optical', cap: 'see better', kids: [
        { l: 'Zoom', cap: 'magnifies (dial)', sc: { max: 3, per: 'magnify' } },
        { l: 'Low-light', cap: 'sees in the dark', kids: [{ l: 'Thermal', cap: 'sees heat', kids: [{ l: 'Multispectral', cap: 'sees across every spectrum' }] }] }] },
      { l: 'Signal', cap: 'detect emissions (needs power)', need: 'power', kids: [
        { l: 'Radar', cap: 'active ranging ping (dial)', sc: { max: 4, per: 'range' }, act: 'ping' },
        { l: 'Intercept', cap: 'taps comms traffic (NET)', bridge: 'net', act: 'tap' }] },
      { l: 'Track', cap: 'follow a target', kids: [
        { l: 'Follow', cap: 'keeps a lock (dial range)', sc: { max: 3, per: 'range' }, act: 'track' },
        { l: 'Predict', cap: 'anticipates the path (needs a smart core)', need: 'node:COMPUTE.expert', act: 'predict' }] }] },

    HEAL: { l: 'Heal', cap: 'a thing that mends', kids: [
      { l: 'First-aid', cap: 'basic care', kids: [
        { l: 'Stabilize', cap: 'stops someone from dying (dial charges)', sc: { max: 3, per: 'charges' }, act: 'stabilize' },
        { l: 'Trauma-pack', cap: 'sterile field dressing', tag: 'sterile' }] },
      { l: 'Chem', cap: 'drugs (needs an injector)', need: 'injector', kids: [
        { l: 'Stim', cap: 'combat stimulant (dial doses)', sc: { max: 3, per: 'doses' }, act: 'dose' },
        { l: 'Antitox', cap: 'purges toxins', act: 'purge' }] },
      { l: 'Nano', cap: 'medical nanites (needs power)', need: 'power', kids: [
        { l: 'Repair', cap: 'mends wounds over time (dial rate)', sc: { max: 3, per: 'rate' }, act: 'mend', kids: [{ l: 'Regen', cap: 'full-body regeneration bay (needs a mount)', arch: 'regen bay', need: 'mount' }] }] }] },
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
    var colW = opt.colW || 100, rowH = opt.rowH || 64, padX = opt.padX || 56, padY = opt.padY || 52;
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
