/* npc-archetypes.js — built-in NPC archetype generator for Cyberpunk 2020.
   Not fixed sheets: a set of rules that produce a random combat-ready NPC sheet
   from parameters (tier, chrome, playstyle role, optional CP2020 role). Hybrid
   equipment: curated kits select from the REAL game data (cp2020weapons.json,
   cyberware.json, cp2020gear.json) so stats are authentic.

   window.NPCGen.generate({ archetype, tier, chrome, role, cp2020role, name }, DBs)
     → an NPC-sheet object (same schema makeCombatant + the NPC tool consume).
   window.NPCGen.generateTeam({ archetype, tier, size }, DBs) → [sheets].
   DBs = { weapons:[], cyber:[], armor:[] } (arrays from the data files). */
(function () {
  'use strict';

  function rng() { return Math.random(); }
  function pick(arr, r) { return arr.length ? arr[Math.floor((r || rng)() * arr.length)] : null; }
  function jitter(base, spread, r) { return base + Math.round(((r || rng)() * 2 - 1) * spread); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function low(s) { return String(s == null ? '' : s).toLowerCase(); }

  /* ── tiers ── */
  var TIERS = {
    mook:    { label: 'Mook',    stat: 5, skill: 3, sa: 2, armorSP: 8,  cyber: 0 },
    average: { label: 'Average', stat: 6, skill: 4, sa: 3, armorSP: 12, cyber: 1 },
    veteran: { label: 'Veteran', stat: 7, skill: 6, sa: 5, armorSP: 16, cyber: 3 },
    elite:   { label: 'Elite',   stat: 8, skill: 7, sa: 7, armorSP: 20, cyber: 5 },
    boss:    { label: 'Boss',    stat: 9, skill: 9, sa: 9, armorSP: 25, cyber: 8 },
  };
  var TIER_ORDER = ['mook', 'average', 'veteran', 'elite', 'boss'];
  // chrome overrides how much cyberware is installed (else derived from tier).
  var CHROME = { none: 0, light: 2, moderate: 4, heavy: 7, borg: 11 };

  /* ── playstyle roles (bias stats/skills/weapons) ── */
  var ROLES = {
    bruiser:   { stats: { BODY: 2, REF: 1 }, weaponTypes: ['MEL', 'SHT', 'P'], skills: { Brawling: 2, Melee: 2 }, armor: 4 },
    ranged:    { stats: { REF: 2 }, weaponTypes: ['RIF', 'SMG', 'P'], skills: { Rifle: 1, Submachinegun: 1 }, armor: 0 },
    sniper:    { stats: { REF: 2, INT: 1 }, weaponTypes: ['RIF'], skills: { Rifle: 2, 'Awareness/Notice': 2, Stealth: 2 }, armor: -2, longRange: true },
    support:   { stats: { TECH: 1, EMP: 1 }, weaponTypes: ['SMG', 'P'], skills: { 'First Aid': 2, Medtech: 1 }, armor: 0 },
    leader:    { stats: { COOL: 2, INT: 1 }, weaponTypes: ['SMG', 'P'], skills: { Leadership: 2, Handgun: 1 }, armor: 2 },
    netrunner: { stats: { INT: 2 }, weaponTypes: ['P'], skills: { Interface: 3, 'Awareness/Notice': 1 }, armor: -2, deck: true },
  };

  /* ── CP2020 role overlay → Special Ability ── */
  var CP2020_ROLES = {
    solo: 'Combat Sense', netrunner: 'Interface', cop: 'Authority', corporate: 'Resources',
    nomad: 'Family', tech: 'Jury Rig', media: 'Credibility', fixer: 'Streetdeal',
    rockerboy: 'Charismatic Leadership', medtech: 'Medical Tech',
  };

  // skill → governing stat (only the ones our packages use; rest default INT).
  var SKILL_STAT = {
    Handgun: 'REF', Rifle: 'REF', Submachinegun: 'REF', 'Shoulder Arms': 'REF', 'Heavy Weapons': 'REF',
    Melee: 'REF', Brawling: 'REF', 'Martial Arts': 'REF', Fencing: 'REF', Archery: 'REF',
    'Dodge & Escape': 'REF', Athletics: 'REF', Stealth: 'REF', Driving: 'REF',
    'Awareness/Notice': 'INT', 'Hide/Evade': 'INT', Shadow: 'INT', Interface: 'INT', 'Wardrobe & Style': 'COOL',
    'First Aid': 'TECH', Medtech: 'TECH', Weaponsmith: 'TECH', 'Basic Tech': 'TECH', 'Cybertech': 'TECH',
    Intimidate: 'COOL', Leadership: 'COOL', 'Interrogation': 'COOL', 'Resist Torture/Drugs': 'COOL', Streetwise: 'COOL',
    Persuasion: 'COOL', Endurance: 'BODY', 'Strength Feat': 'BODY',
  };
  function statForSkill(name) { return SKILL_STAT[name] || 'INT'; }

  /* ── archetypes ── */
  var ARCHETYPES = {
    ganger: {
      label: 'Ganger', desc: 'Boostergang muscle — cheap chrome, attitude, street iron.',
      cp2020: 'solo', statPriority: ['REF', 'BODY', 'COOL'],
      skills: { Brawling: 2, Handgun: 1, Melee: 1, Streetwise: 2, 'Awareness/Notice': 1, Intimidate: 1, 'Dodge & Escape': 1 },
      weaponTypes: ['P', 'SMG', 'MEL', 'SHT'], cyberThemes: ['reflex', 'cyberarm', 'rippers', 'cybereye', 'cyberaudio', 'wolvers', 'big knucks'],
      armorMax: 16, team: { lead: 'veteran', roles: ['bruiser', 'ranged', 'ranged', 'bruiser'] },
    },
    corpo: {
      label: 'Corporate operative', desc: 'Clean, disciplined company security / black-ops.',
      cp2020: 'corporate', statPriority: ['COOL', 'REF', 'INT'],
      skills: { Handgun: 2, Submachinegun: 1, 'Awareness/Notice': 2, 'Wardrobe & Style': 1, Persuasion: 1, 'Dodge & Escape': 1, Athletics: 1 },
      weaponTypes: ['P', 'SMG', 'RIF'], cyberThemes: ['neural', 'reflex', 'cybereye', 'smartgun', 'cyberaudio', 'subdermal'],
      armorMax: 20, team: { lead: 'elite', roles: ['ranged', 'ranged', 'leader', 'support'] },
    },
    netrunner: {
      label: 'Combat netrunner', desc: 'Deck-jockey with enough chrome to survive a firefight.',
      cp2020: 'netrunner', statPriority: ['INT', 'REF'], forceRole: 'netrunner',
      skills: { Interface: 3, 'Awareness/Notice': 2, Handgun: 1, 'Basic Tech': 1, Cybertech: 1, Stealth: 1 },
      weaponTypes: ['P', 'SMG'], cyberThemes: ['interface', 'neural', 'chipware', 'cybermodem', 'cybereye', 'reflex'],
      armorMax: 14, team: { lead: 'veteran', roles: ['netrunner', 'ranged', 'support'] },
    },
    guard: {
      label: 'Security guard', desc: 'Rent-a-cop — uniform, sidearm, body armor.',
      cp2020: 'cop', statPriority: ['BODY', 'REF'],
      skills: { Handgun: 2, 'Shoulder Arms': 1, 'Awareness/Notice': 2, Brawling: 1, Intimidate: 1, Athletics: 1 },
      weaponTypes: ['P', 'SHT', 'SMG'], cyberThemes: ['cybereye', 'cyberaudio', 'reflex', 'subdermal'],
      armorMax: 18, team: { lead: 'veteran', roles: ['ranged', 'bruiser', 'ranged', 'leader'] },
    },
    military: {
      label: 'Military trooper', desc: 'Trained soldier — rifles, hard armor, fire discipline.',
      cp2020: 'solo', statPriority: ['REF', 'BODY', 'INT'],
      skills: { Rifle: 2, 'Heavy Weapons': 1, 'Awareness/Notice': 2, Athletics: 2, 'Dodge & Escape': 1, 'First Aid': 1, Endurance: 1 },
      weaponTypes: ['RIF', 'HVY', 'SMG'], cyberThemes: ['reflex', 'smartgun', 'cybereye', 'muscle', 'subdermal', 'neural'],
      armorMax: 28, team: { lead: 'elite', roles: ['ranged', 'ranged', 'sniper', 'support'] },
    },
    assassin: {
      label: 'Assassin', desc: 'Quiet professional — stealth, precision, one shot.',
      cp2020: 'solo', statPriority: ['REF', 'INT', 'COOL'], forceRole: 'sniper',
      skills: { Rifle: 2, Handgun: 1, Stealth: 3, 'Awareness/Notice': 2, 'Hide/Evade': 2, 'Martial Arts': 1 },
      weaponTypes: ['RIF', 'P', 'MEL'], cyberThemes: ['reflex', 'cybereye', 'smartgun', 'sniper', 'skinweave', 'neural'],
      armorMax: 14, team: { lead: 'elite', roles: ['sniper', 'sniper'] },
    },
    cyberpsycho: {
      label: 'Cyberpsycho', desc: 'Chrome past the edge — relentless, armored in metal.',
      cp2020: 'solo', statPriority: ['BODY', 'REF'], forceRole: 'bruiser', forceChrome: 'borg',
      skills: { Brawling: 3, Melee: 2, 'Martial Arts': 2, Athletics: 2, Endurance: 2, Intimidate: 2 },
      weaponTypes: ['MEL', 'HVY', 'SHT'], cyberThemes: ['cyberarm', 'rippers', 'wolvers', 'subdermal', 'linear frame', 'reflex', 'muscle', 'sword'],
      armorMax: 25, team: { lead: 'boss', roles: ['bruiser'] },
    },
    nomad: {
      label: 'Nomad fighter', desc: 'Pack road-warrior — scavenged iron, fights as a family.',
      cp2020: 'nomad', statPriority: ['REF', 'BODY'],
      skills: { Rifle: 1, Handgun: 1, Driving: 2, Brawling: 1, 'Awareness/Notice': 1, Streetwise: 1, 'Basic Tech': 1, Endurance: 1 },
      weaponTypes: ['RIF', 'P', 'SHT', 'MEL'], cyberThemes: ['cybereye', 'reflex', 'cyberaudio', 'subdermal'],
      armorMax: 16, team: { lead: 'veteran', roles: ['ranged', 'bruiser', 'ranged', 'support'] },
    },
  };

  /* ── name flavor ── */
  var NAMES = ['Razor', 'Spike', 'Vex', 'Crank', 'Diesel', 'Mara', 'Nyx', 'Cole', 'Riot', 'Static', 'Ash', 'Wraith', 'Juno', 'Dex', 'Korr', 'Lena', 'Bishop', 'Tygr', 'Sable', 'Volt', 'Reza', 'M008', 'Jax', 'Nova'];
  function randName(r) { return pick(NAMES, r); }

  /* ── equipment selection from real DBs ── */
  function weaponFromDB(W, types, opts, r) {
    opts = opts || {};
    var pool = (W || []).filter(function (w) {
      if (types.indexOf(w.type) < 0) return false;
      if (opts.longRange && (+w.range || 0) < 150) return false;
      if (opts.maxCost && (+w.cost || 0) > opts.maxCost) return false;
      if (opts.avail && /R|VR/.test(w.avail) && !opts.exotic) return /R/.test(opts.avail || ''); // mooks avoid rare
      return true;
    });
    var w = pick(pool.length ? pool : (W || []).filter(function (x) { return types.indexOf(x.type) >= 0; }), r);
    if (!w) return null;
    var shots = parseInt(w.shots, 10) || 0;
    return {
      uid: 'g' + Math.floor((r || rng)() * 1e9).toString(36),
      name: w.name, type: w.type, category: w.category || '',
      damage: w.damage || '1d6', ammo: w.ammo || '', shots: shots, currentAmmo: shots,
      rof: parseInt(w.rof, 10) || 1, range: parseInt(w.range, 10) || 50,
      wa: parseInt(w.wa, 10) || 0, conc: w.conc || '', rel: w.rel || '', cost: w.cost || 0, notes: '',
    };
  }
  function armorFromDB(A, targetSP, r) {
    var scored = (A || []).map(function (a) {
      var m = /sp\s*(\d+)/i.exec(a.notes || ''); var n = low(a.notes);
      // prefer real body armor: covers torso/body, or lists no location (full suit)
      var torso = /torso|chest|body|ches/.test(n) || !/head|arm|leg|feet|hand|helmet|glove|boot/.test(n);
      return { a: a, sp: m ? +m[1] : 0, torso: torso };
    }).filter(function (x) { return x.sp > 0; });
    if (!scored.length) return null;
    var body = scored.filter(function (x) { return x.torso; });
    var pool = body.length ? body : scored;
    pool.sort(function (x, y) { return Math.abs(x.sp - targetSP) - Math.abs(y.sp - targetSP); });
    var near = pool.slice(0, Math.min(6, pool.length));
    var hit = pick(near, r);
    return hit ? { name: hit.a.name, notes: hit.a.notes || '', sp: hit.sp } : null;
  }
  function cyberFromDB(C, themes, count, r) {
    if (count <= 0) return [];
    var pool = (C || []).filter(function (c) {
      var hay = low(c.name) + ' ' + low(c.subtype) + ' ' + low(c.type);
      return themes.some(function (t) { return hay.indexOf(low(t)) >= 0; });
    });
    var out = [], seen = {};
    for (var i = 0; i < count * 3 && out.length < count; i++) {
      var c = pick(pool, r); if (!c || seen[c.name]) continue; seen[c.name] = 1;
      out.push({ name: c.name, type: c.type || '', subtype: c.subtype || '', hc: c.hc || '', notes: c.notes || '' });
    }
    return out;
  }

  /* ── core generator ── */
  function generate(opts, DBs) {
    opts = opts || {}; DBs = DBs || {};
    var r = opts.rng || rng;
    var arch = ARCHETYPES[opts.archetype] || ARCHETYPES.ganger;
    var tierKey = opts.tier && TIERS[opts.tier] ? opts.tier : 'average';
    var tier = TIERS[tierKey];
    var roleKey = opts.role || arch.forceRole || 'ranged';
    var role = ROLES[roleKey] || ROLES.ranged;

    // stats: tier base, archetype priority +, role bias +, jitter
    var stats = { INT: 0, REF: 0, TECH: 0, COOL: 0, ATT: 0, LUCK: 0, MA: 0, BODY: 0, EMP: 0 };
    Object.keys(stats).forEach(function (k) { stats[k] = clamp(jitter(tier.stat, 1, r), 2, 10); });
    (arch.statPriority || []).forEach(function (k, i) { stats[k] = clamp(stats[k] + (i === 0 ? 2 : 1), 2, 10); });
    Object.keys(role.stats || {}).forEach(function (k) { stats[k] = clamp(stats[k] + role.stats[k], 2, 10); });
    stats.MA = clamp(jitter(6, 1, r), 4, 9); stats.LUCK = clamp(jitter(tier.stat - 1, 1, r), 1, 10);

    // skills: archetype package + role package, leveled by tier + jitter
    var skillLv = {};
    function addSkill(name, bonus) { skillLv[name] = clamp((skillLv[name] || 0) + tier.skill + (bonus || 0) + jitter(0, 1, r), 1, 10); }
    Object.keys(arch.skills).forEach(function (s) { addSkill(s, arch.skills[s]); });
    Object.keys(role.skills || {}).forEach(function (s) { addSkill(s, role.skills[s]); });
    var skills = Object.keys(skillLv).map(function (s) { return { name: s, stat: statForSkill(s), val: skillLv[s], isRole: false, isCustom: false }; });

    // special ability from the CP2020 role overlay (archetype default or chosen)
    var cp = opts.cp2020role || arch.cp2020;
    var sa = CP2020_ROLES[cp] || '', saVal = sa ? clamp(jitter(tier.sa, 1, r), 1, 10) : 0;
    if (sa) skills.push({ name: sa, stat: 'SPECIAL', val: saVal, isRole: true, isCustom: false });

    // chrome
    var chromeKey = opts.chrome || arch.forceChrome || (tierKey === 'mook' ? 'light' : tierKey === 'boss' ? 'heavy' : 'moderate');
    var cyberCount = CHROME[chromeKey] != null ? CHROME[chromeKey] : tier.cyber;
    var cyber = cyberFromDB(DBs.cyber, arch.cyberThemes, cyberCount, r);

    // weapons: 1 primary by role/archetype types + a sidearm
    var maxCost = tierKey === 'mook' ? 600 : tierKey === 'average' ? 1500 : tierKey === 'veteran' ? 4000 : 99999;
    var types = role.weaponTypes && role.weaponTypes.length ? role.weaponTypes : arch.weaponTypes;
    types = types.filter(function (t) { return arch.weaponTypes.indexOf(t) >= 0; }); if (!types.length) types = arch.weaponTypes;
    var weapons = [];
    var primary = weaponFromDB(DBs.weapons, types, { longRange: role.longRange, maxCost: maxCost }, r);
    if (primary) weapons.push(primary);
    var side = weaponFromDB(DBs.weapons, ['P'], { maxCost: maxCost }, r);
    if (side && (!primary || side.name !== primary.name)) weapons.push(side);

    // armor near the tier/role SP target, capped by the archetype
    var targetSP = Math.min(arch.armorMax, tier.armorSP + (role.armor || 0));
    var armorPiece = armorFromDB(DBs.armor, targetSP, r);
    var armor = armorPiece ? [{ name: armorPiece.name, notes: armorPiece.notes }] : [];

    // gadgets
    var inventory = [{ name: 'Medkit', category: 'GEAR', notes: '' }];
    if (roleKey === 'bruiser' || arch.label === 'Ganger') inventory.push({ name: 'Grenade (Frag)', category: 'WEAPON', notes: '7m blast; 7d6' });

    var name = opts.name || (arch.label + ' "' + randName(r) + '"');
    var sheet = {
      type: 'npc', generated: true, archetype: opts.archetype || 'ganger', tier: tierKey, chrome: chromeKey, playstyle: roleKey,
      role: arch.label, sa: sa, saVal: saVal,
      notes: tier.label + ' ' + arch.label + (cp ? ' · ' + cp : '') + ' · ' + chromeKey + ' chrome · ' + roleKey,
      stats: stats, skills: skills, cyberware: cyber, weapons: weapons, armor: armor, inventory: inventory, vehicles: [],
    };
    if (role.deck || arch.forceRole === 'netrunner' || opts.archetype === 'netrunner') {
      sheet.netrunner = { mode: 'vanilla', deckId: 'Combat deck', programs: ['Sword', 'Armor', 'Hellbolt', 'Shield'], quickhacks: [], interface: 'plugs' };
    }
    return sheet;
  }

  /* ── team generator: a leader + complementary roles ── */
  function generateTeam(opts, DBs) {
    opts = opts || {};
    var arch = ARCHETYPES[opts.archetype] || ARCHETYPES.ganger;
    var comp = arch.team || { lead: 'veteran', roles: ['ranged', 'ranged'] };
    var r = opts.rng || rng;
    var baseTier = opts.tier || 'average';
    var gruntTier = baseTier;
    var leadTier = bumpTier(baseTier, 1);
    var team = [];
    team.push(generate({ archetype: opts.archetype, tier: leadTier, chrome: opts.chrome, role: 'leader', cp2020role: opts.cp2020role, rng: r, name: opts.name }, DBs));
    var roles = (comp.roles || []).slice(0, opts.size ? opts.size - 1 : comp.roles.length);
    roles.forEach(function (role) {
      team.push(generate({ archetype: opts.archetype, tier: gruntTier, chrome: opts.chrome, role: role, rng: r }, DBs));
    });
    return team;
  }
  function bumpTier(key, by) { var i = TIER_ORDER.indexOf(key); return TIER_ORDER[clamp(i + by, 0, TIER_ORDER.length - 1)]; }

  function list() {
    return Object.keys(ARCHETYPES).map(function (k) { return { id: k, label: ARCHETYPES[k].label, desc: ARCHETYPES[k].desc, cp2020: ARCHETYPES[k].cp2020 }; });
  }

  window.NPCGen = {
    generate: generate, generateTeam: generateTeam, list: list,
    ARCHETYPES: ARCHETYPES, TIERS: TIERS, TIER_ORDER: TIER_ORDER, CHROME: CHROME, ROLES: ROLES, CP2020_ROLES: CP2020_ROLES,
  };
})();
