/* tech-artifact-catalog.js — the curated CONTENT of the TECH section (cran 1).
   Three things, deliberately kept as data (design fragility #1 isolated):
     · ANCHORS   — per effect-domain: a skill + 7 grade barreaux (g0..g6). These
                   ANCHOR the "grade = distance to market" scale; two GMs cote the
                   same object the same only if these are good. Hand-authored,
                   seeded from CP2020 canon.
     · TOKENS    — the standard interface jetons (calibres, mounts, cells, ports,
                   formats). Standard = buyable in a shop; anything else = custom.
     · PRESETS   — ~9 lore objects, fully specced + hand-coted. Triple role:
                   quick-start · tutorial-by-example · coting jurisprudence.
   Exposes window.TechCatalog. Depends on window.TechArtifact (normalize). */
(function () {
  'use strict';
  var A = window.TechArtifact;

  // ── grade anchors: [g0, g1, g2, g3, g4, g5, g6] per domain ──
  var ANCHORS = {
    'FILTER-AIR': { skill: 'Basic Tech', bars: ['dust cloth', 'particulate mask', 'toxin filter', 'gas + bio', 'sealed rebreather', 'CBRN over-pressure', 'closed-cycle, hours'] },
    'CONCEAL':    { skill: 'Stealth Tech', bars: ['drab colours', 'broken camo', 'chameleon static', 'thermoptic static', 'thermoptic moving (shimmer)', 'invisible in motion', 'sensor-null, no shimmer'] },
    'ARMOR':      { skill: 'Basic Tech', bars: ['SP4 padding', 'SP10 soft', 'SP14 hard', 'SP18 plate', 'SP20 composite', 'SP25 milspec', 'SP30 exotic'] },
    'SENSE':      { skill: 'Electronics', bars: ['dial/gauge', 'basic sensor', 'lowlight/zoom', 'multi-spectral', 'targeting suite', 'wide-area fusion', 'through-wall/deep scan'] },
    'MOVE':       { skill: 'Gyro Tech', bars: ['grip', '+1 MA', '+2 leap', '+3 leap', 'wall-run/glide', 'short boost-jump', 'sustained flight'] },
    'STRIKE':     { skill: 'Weaponsmith', bars: ['blunt', 'small arms', 'heavy pistol', 'rifle', 'anti-materiel', 'vehicle-grade', 'anti-armor exotic'] },
    'GUIDE':      { skill: 'Electronics', bars: ['iron sights', 'laser dot', 'lock-on', 'fire-and-forget', 'multi-target', 'terrain-follow', 'autonomous hunt'] },
    'LINK':       { skill: 'Electronics', bars: ['wire', 'short radio', 'encrypted radio', 'neural jack', 'satlink', 'mesh relay', 'quantum-tight'] },
    'JAM':        { skill: 'Electronic Security', bars: ['noise', 'spoof one band', 'spoof sensors', 'break comms', 'blind a suite', 'area denial', 'take control'] },
    'STORE':      { skill: 'Electronics', bars: ['note', 'shard 10MU', 'shard 40MU', 'deck 200MU', 'array 1GU', 'vault', 'living archive'] },
    'HEAL':       { skill: 'Basic Tech', bars: ['bandage', 'first aid', 'stabilize', 'trauma field', 'surgery bay', 'nano-repair', 'full regen'] },
    'POWER':      { skill: 'Electronics', bars: ['cell', 'pack', 'high-density', 'fuel cell', 'micro-fusion', 'plant', 'exotic core'] },
  };
  var DOMAINS = Object.keys(ANCHORS);
  function isKnownDomain(d) { return !!ANCHORS[String(d || '').toUpperCase()]; }
  function anchorOf(domain, grade) {
    var a = ANCHORS[String(domain || '').toUpperCase()];
    if (!a) return null;
    return { skill: a.skill, bar: a.bars[Math.max(0, Math.min(6, grade | 0))] };
  }
  function skillForDomain(d) { var a = ANCHORS[String(d || '').toUpperCase()]; return a ? a.skill : 'Basic Tech'; }

  // class → base craft skill (fidèle CP2020)
  var CLASS_SKILL = {
    weapon: 'Weaponsmith', cyberware: 'Cyber Tech', vehicle: 'AV Tech', electronics: 'Electronics',
    drug: 'Pharmaceuticals', gear: 'Basic Tech', carrier: 'Robotics', data: 'Programming', ammo: 'Weaponsmith',
  };
  var CLASSES = Object.keys(CLASS_SKILL);
  function skillForClass(c) { return CLASS_SKILL[c] || 'Basic Tech'; }

  // ── standard tokens (buyable). Anything not here = custom (craft/salvage). ──
  var TOKENS = {
    ammo: ['9mm', '10mm', '5.56', '5.45', '7.62', '12ga', '.50', 'he-84', 'thermo-84', 'smart-84'],
    mount: ['torso-std', 'face-std', 'rail-std', 'turret-mount-b', 'tube-84', 'borg-frame-std'],
    power: ['cell power-c', 'cell power-d', 'fuel-cell', 'micro-fusion'],
    port: ['neural-port', 'interface-plug', 'data-port', 'control-link'],
    format: ['shard-std', 'chip-std', 'deck-std'],
    consumable: ['cartridge filter-std', 'coolant', 'medpack'],
  };
  var STD = {};
  Object.keys(TOKENS).forEach(function (g) { TOKENS[g].forEach(function (t) { STD[t.toLowerCase()] = g; }); });
  function isStandard(token) { return !!STD[String(token || '').toLowerCase()]; }
  function allTokens() { var o = []; Object.keys(TOKENS).forEach(function (g) { o = o.concat(TOKENS[g]); }); return o; }

  // ── presets: full records, hand-coted (the calibration set) ──
  var RAW = [
    { id: 'preset-filter-mask', name: 'SCAVENGER FILTER MASK', cls: 'gear', tier: 2, origin: 'HANDMADE',
      flavor: 'Rebreather bricolé pour les fouilleurs du Dump — tient 40 heures, la voix grésille.',
      feats: [{ domain: 'FILTER-AIR', grade: 1 }],
      ports: { needs: [{ token: 'cartridge filter-std', rate: '40h' }], fits: ['face-std'] },
      limits: [{ text: 'nez-bouche seul · voix −1' }], mods: [{ target: 'wearer.voice', value: '-1', when: 'when worn' }] },

    { id: 'preset-thermoptic-cape', name: 'CHAMELEON CLOAK', cls: 'gear', tier: 4, origin: 'CORP PULL',
      flavor: 'Thermoptique — le camo grésille au sprint, mais on te rate.',
      feats: [{ domain: 'CONCEAL', grade: 4, when: 'while powered' }, { domain: 'ARMOR', grade: 2 }],
      ports: { needs: [{ token: 'cell power-c', rate: '30min' }], fits: ['torso-std'] },
      limits: [{ text: 'shimmer au sprint (grade −1 en courant)' }], mods: [{ target: 'wearer.Stealth', value: '+2', when: 'while powered' }],
      lineage: { refines: '', steps: 1 } },

    { id: 'preset-jump-boots', name: 'KANGAROO JUMP BOOTS', cls: 'gear', tier: 2, origin: 'FACTORY',
      flavor: 'Actionneurs mollets — +3 au saut, atterris comme tu peux.',
      feats: [{ domain: 'MOVE', grade: 2 }], mods: [{ target: 'wearer.MA.jump', value: '+3', when: 'when worn' }],
      limits: [{ text: 'atterrissage brutal : REF check ou 1d6' }] },

    { id: 'preset-combat-drone', name: 'WATCHDOG COMBAT DRONE', cls: 'carrier', tier: 4, origin: 'CORP PULL',
      flavor: 'Drone quadrotor de sécurité — mitraille légère, optiques multi-spectrales.',
      feats: [{ domain: 'SENSE', grade: 3 }, { domain: 'STRIKE', grade: 3 }],
      ports: { takes: [{ slot: 'gadget-bay', accepts: ['rail-std'], n: 2 }], needs: [{ token: 'control-link', service: true }, { token: 'cell power-d', rate: '2h' }] },
      limits: [{ text: 'bande passante : 1 opérateur à la fois' }],
      stats: { sdp: 20, sp: 8 }, latent: [{ text: 'balise télémétrie usine', domain: 'LINK', grade: 2, who: ['maker', 'GM'] }] },

    { id: 'preset-cyber-dog', name: 'CERBERUS CYBER-MASTIFF', cls: 'carrier', tier: 4, origin: 'FACTORY',
      flavor: 'Molosse cybernétique de garde — mâchoires hydrauliques, museau chimio.',
      feats: [{ domain: 'STRIKE', grade: 4 }, { domain: 'SENSE', grade: 3 }],
      ports: { needs: [{ token: 'control-link', service: true }], holds: [{ kind: 'payload', cap: '1 module' }] },
      limits: [{ text: 'loyauté câblée : perd le contrôle si CONTROL est cracké' }], stats: { sdp: 30, sp: 6 } },

    { id: 'preset-rpg', name: 'MILITECH ARROW RPG', cls: 'weapon', tier: 3, origin: 'CORP PULL',
      flavor: 'Lance-roquette dépaulé — accepte trois têtes, s’alèse pour une quatrième si tu oses.',
      feats: [{ domain: 'STRIKE', grade: 4 }],
      ports: { takes: [{ slot: 'tube', accepts: ['he-84', 'thermo-84', 'smart-84'], n: 1 }] },
      stats: { range: '400m', shots: 1 },
      mods: [{ target: 're-bore chamber', value: '+accepts he-100 · dmg+2d6 · instab+2', when: 'modded' }] },

    { id: 'preset-smart-rocket', name: 'SMART ROCKET 84MM', cls: 'ammo', tier: 3, origin: 'CORP PULL',
      flavor: 'Roquette téléguidée — verrouille après désignation, pour tout tube 84.',
      feats: [{ domain: 'GUIDE', grade: 3 }],
      ports: { fits: ['tube-84'], needs: [{ token: 'designator-link' }] } },

    { id: 'preset-datashard', name: 'FULL DATASHARD', cls: 'data', tier: 1, origin: 'FACTORY',
      flavor: 'Shard scellé — 40 mégaunités, coordonnées d’extraction dedans.',
      feats: [], ports: { fits: ['shard-std'], holds: [{ kind: 'data', cap: '40MU', contents: 'coordonnées d’extraction' }] } },

    { id: 'preset-neural-cable', name: 'INTERFACE CABLE', cls: 'electronics', tier: 2, origin: 'FACTORY',
      flavor: 'Câble de plongée — relie une prise neurale à toute interface numérique.',
      feats: [{ domain: 'LINK', grade: 2 }], ports: { fits: ['neural-port'], feeds: ['data-port'] } },

    { id: 'preset-ambulance', name: 'ARMORED TRAUMA VAN', cls: 'vehicle', tier: 5, origin: 'FACTORY',
      flavor: 'Ambulance blindée — baie de stabilisation à bord, tôle qui encaisse.',
      feats: [{ domain: 'HEAL', grade: 3 }, { domain: 'ARMOR', grade: 4 }],
      ports: { holds: [{ kind: 'patients', cap: '2' }] }, stats: { sdp: 75, sp: 20, seats: 2 } },
  ];
  var PRESETS = RAW.map(function (r) { r.preset = true; return A ? A.normalize(r) : r; });
  function presets() { return PRESETS.map(function (p) { return A ? A.clone(p) : JSON.parse(JSON.stringify(p)); }); }

  // ── what a given class usually needs — the "smart parts bin" per class ──
  var SUGGEST = {
    weapon:      { domains: ['STRIKE', 'GUIDE'], tokens: ['tube-84', 'he-84', 'smart-84', 'rail-std'] },
    ammo:        { domains: ['STRIKE', 'GUIDE'], tokens: ['tube-84'] },
    gear:        { domains: ['CONCEAL', 'ARMOR', 'MOVE', 'FILTER-AIR'], tokens: ['torso-std', 'face-std', 'cell power-c', 'cartridge filter-std'] },
    cyberware:   { domains: ['SENSE', 'LINK', 'MOVE', 'STRIKE'], tokens: ['neural-port', 'borg-frame-std'] },
    vehicle:     { domains: ['ARMOR', 'MOVE', 'STRIKE', 'SENSE'], tokens: ['fuel-cell'] },
    electronics: { domains: ['LINK', 'STORE', 'SENSE', 'JAM'], tokens: ['data-port', 'interface-plug', 'cell power-c'] },
    drug:        { domains: ['HEAL'], tokens: [] },
    carrier:     { domains: ['SENSE', 'STRIKE', 'LINK'], tokens: ['control-link', 'cell power-d'] },
    data:        { domains: ['STORE'], tokens: ['shard-std', 'chip-std'] },
  };
  function suggestFor(cls) { var s = SUGGEST[cls] || { domains: [], tokens: [] }; return { domains: s.domains.filter(isKnownDomain), tokens: s.tokens.slice() }; }

  window.TechCatalog = {
    ANCHORS: ANCHORS, DOMAINS: DOMAINS, anchorOf: anchorOf, isKnownDomain: isKnownDomain, skillForDomain: skillForDomain,
    CLASSES: CLASSES, skillForClass: skillForClass,
    TOKENS: TOKENS, allTokens: allTokens, isStandard: isStandard,
    SUGGEST: SUGGEST, suggestFor: suggestFor,
    presets: presets, PRESETS: PRESETS,
  };
})();
