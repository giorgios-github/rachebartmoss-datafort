/* org-archetypes.js — built-in organisation generator (corps, gangs, agencies…).
   Same spirit as NPCGen: rules → a random org sheet (organisations schema) from
   a kind + scale. Flavor from data/corporations.json; leadership stat blocks via
   window.NPCGen. Output is consumed/edited by organisations.html (its _migrate
   fills any missing fields).

   window.OrgGen.generate({ kind, scale, name }, DBs) → org object
   DBs = { corps:[], weapons:[], cyber:[], armor:[] } */
(function () {
  'use strict';
  function rng() { return Math.random(); }
  function pick(a) { return a.length ? a[Math.floor(rng() * a.length)] : null; }
  function uid() { return 'o' + Date.now().toString(36) + Math.floor(rng() * 1e5).toString(36); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // kind → org type (corporation|groupe|agency) + leadership archetype (NPCGen) + flavor
  var KINDS = {
    corporation: { type: 'corporation', lead: 'corpo', muscle: 'corpo', label: 'Corporation' },
    gang:        { type: 'groupe', lead: 'ganger', muscle: 'ganger', label: 'Gang / crew' },
    agency:      { type: 'agency', lead: 'guard', muscle: 'military', label: 'Agency (police/mil)' },
    fixerring:   { type: 'groupe', lead: 'corpo', muscle: 'ganger', label: 'Fixer ring' },
    nomad:       { type: 'groupe', lead: 'nomad', muscle: 'nomad', label: 'Nomad pack' },
  };
  var SCALE = {
    street:   { tier: 'average', lead: 'veteran', n: 2, label: 'Street' },
    local:    { tier: 'veteran', lead: 'elite',   n: 3, label: 'Local' },
    national: { tier: 'elite',   lead: 'boss',    n: 4, label: 'National' },
    megacorp: { tier: 'boss',    lead: 'boss',    n: 5, label: 'Mega' },
  };
  var GANG_ADJ = ['Steel', 'Neon', 'Chrome', 'Blood', 'Razor', 'Static', 'Iron', 'Ghost', 'Acid', 'Night', 'Black', 'Voodoo'];
  var GANG_NOUN = ['Wolves', 'Saints', 'Vultures', 'Reapers', 'Kings', 'Vipers', 'Phantoms', 'Hounds', 'Edge', 'Circuit', 'Maelstrom', 'Tigers'];
  var TITLES = {
    corporation: ['CEO', 'VP Operations', 'Head of Security', 'Chief Counsel', 'Division Lead'],
    groupe: ['Boss', 'Lieutenant', 'Enforcer', 'Quartermaster', 'Runner'],
    agency: ['Commander', 'Captain', 'Sergeant', 'Specialist', 'Officer'],
  };
  var TAGLINES = {
    corporation: ['Building tomorrow, today.', 'Your future. Our design.', 'Beyond the edge.', 'Progress without limits.'],
    groupe: ['Own the street.', 'No gods, no corps.', 'We take what we want.', 'Blood in, blood out.'],
    agency: ['To serve and control.', 'Order through strength.', 'Protect. Enforce. Endure.', 'The long arm.'],
  };

  function leaderName(kind) {
    if (kind === 'corporation' || kind === 'agency') return pick(['Mr.', 'Ms.', 'Dir.', 'Col.']) + ' ' + pick(['Harlan', 'Voss', 'Sato', 'Reyes', 'Kane', 'Mercer', 'Okada', 'Brandt', 'Cole', 'Nyx']);
    return pick(['Razor', 'Spike', 'Mama', 'Diesel', 'King', 'Vex', 'Tygr', 'Saint', 'Crank', 'Wraith']);
  }
  function orgName(kind, DBs) {
    if (kind === 'corporation') { var c = pick((DBs.corps || []).filter(function (x) { return x && x.name; })); if (c) return c.name; }
    if (kind === 'agency') return pick(['Night City', 'Pacifica', 'Metro', 'Federal']) + ' ' + pick(['Police Dept', 'Security Authority', 'Enforcement Agency', 'Marshals']);
    return cap(pick(GANG_ADJ)) + ' ' + pick(GANG_NOUN);
  }

  function generate(opts, DBs) {
    opts = opts || {}; DBs = DBs || {};
    var kindKey = KINDS[opts.kind] ? opts.kind : 'corporation';
    var kind = KINDS[kindKey];
    var scaleKey = SCALE[opts.scale] ? opts.scale : 'local';
    var scale = SCALE[scaleKey];
    var type = kind.type;
    var name = opts.name || orgName(kindKey, DBs);
    var titles = TITLES[type] || TITLES.corporation;
    var npcDBs = { weapons: DBs.weapons || [], cyber: DBs.cyber || [], armor: DBs.armor || [] };

    // leadership nodes (NPC stat blocks) + edges from the leader
    var nodes = [], edges = [];
    function leaderBlock(arch, tier, title, i) {
      var sheet = window.NPCGen ? window.NPCGen.generate({ archetype: arch, tier: tier }, npcDBs) : null;
      var nm = leaderName(kindKey);
      var node = { id: uid(), type: 'role', label: nm, title: title, npcSheet: sheet, isHQ: i === 0, x: 0, y: 0 };
      return node;
    }
    var leader = leaderBlock(kind.lead, scale.lead, titles[0], 0);
    nodes.push(leader);
    for (var i = 0; i < scale.n; i++) {
      var n = leaderBlock(kind.muscle, scale.tier, titles[(i + 1) % titles.length], i + 1);
      nodes.push(n); edges.push({ from: leader.id, to: n.id });
    }

    var founded = String(2000 + Math.floor(rng() * 23));
    var hq = kindKey === 'nomad' ? pick(['The Badlands', 'I-5 Corridor', 'Highway 101']) : pick(['Night City', 'Tokyo', 'Neo York', 'Pacifica', 'Watson', 'Heywood']);
    var org = {
      id: uid(), name: name, type: type, generated: true, archetype: kindKey, scale: scaleKey,
      logo: '', tagline: pick(TAGLINES[type] || TAGLINES.corporation), founded: founded, headquarters: hq,
      activeTabs: { general: true, hierarchy: true, offices: true, products: true, market: type !== 'groupe', jobs: true, funds: type === 'groupe' },
      hierarchyMode: 'tree',
      general: { publicSummary: cap(scale.label) + '-tier ' + kind.label.toLowerCase() + ' operating out of ' + hq + '.', privateSummary: '', keyMissions: [] },
      hierarchy: { nodes: nodes, edges: edges },
      offices: { locations: [], typicalOffices: [], regions: [], mapType: type === 'groupe' ? 'nightcity' : 'world' },
      products: { items: [] },
      market: { stockSymbol: name.replace(/[^A-Z]/g, '').slice(0, 4) || 'ORG', basePrice: 50 + Math.floor(rng() * 200), publicData: { revenue: '', employees: '', founded: founded, notes: '' }, privateData: {} },
      jobs: { openings: [] },
    };
    return org;
  }

  function list() { return Object.keys(KINDS).map(function (k) { return { id: k, label: KINDS[k].label }; }); }

  window.OrgGen = { generate: generate, list: list, KINDS: KINDS, SCALE: SCALE };
})();
