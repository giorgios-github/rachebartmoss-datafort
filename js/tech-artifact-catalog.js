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
    'BOOST':      { skill: 'Cyber Tech', bars: ['—', '+1 attribute', '+2', 'wired reflexes', '+3 combat', 'milspec', 'superhuman'] },
    'SHOCK':      { skill: 'Electronics', bars: ['static', 'taser jolt', 'knockdown', 'stun field', 'fries cyber', 'EMP burst', 'area EMP'] },
    'BURN':       { skill: 'Weaponsmith', bars: ['flame', 'blowtorch', 'thermite', 'plasma cutter', 'thermal lance', 'arc torch', 'heated mono'] },
    'PROJECT':    { skill: 'Electronics', bars: ['flat holo', 'static decoy', 'moving decoy', 'convincing double', 'full illusion', 'sensory phantom', 'undetectable'] },
    'HACK':       { skill: 'Electronic Security', bars: ['picks a lock', 'spoofs access', 'cracks a device', 'takes control', 'cracks a fort', 'owns the network', 'invisible to sysop'] },
    'INJECT':     { skill: 'Pharmaceuticals', bars: ['jab', 'auto-dose', 'combat cocktail', 'timed regimen', 'targeted dart', 'area aerosol', 'skin contact'] },
    'DISGUISE':   { skill: 'Cyber Tech', bars: ['mask', 'disguised voice', 'face-off', 'morphable features', 'biometric spoof', 'false DNA', 'undetectable'] },
    'SHIELD':     { skill: 'Electronics', bars: ['EMP-hardened', 'damping field', 'kinetic buffer', 'energy shield', 'milspec barrier', 'dense field', 'impenetrable'] },
    'TRACK':      { skill: 'Electronics', bars: ['GPS ping', 'tag and follow', 'through walls', 'city-scale', 'predictive', 'satellite', 'inescapable'] },
    'CONTROL':    { skill: 'Electronics', bars: ['wired remote', 'short remote', 'hijacks unsecured', 'seizes secured', 'mass control', 'autonomous swarm', 'enslaves all'] },
    'REPAIR':     { skill: 'Basic Tech', bars: ['patch', 'field repair', 'self-repair', 'nanites', 'rebuild', 'regenerates', 'never wears'] },
    'COMPUTE':    { skill: 'Programming', bars: ['calculator', 'co-processor', 'smartlink', 'expert system', 'pseudo-AI', 'true AI', 'hive mind'] },
    'SONIC':      { skill: 'Sonar Tech', bars: ['amplifier', 'sonar ping', 'ultrasound', 'sonic stun', 'resonance breaker', 'lethal sonic', 'shockwave'] },
    'RESTRAIN':   { skill: 'Weaponsmith', bars: ['collar', 'net', 'sticky web', 'adhesive foam', 'stasis grip', 'containment field', 'inescapable'] },
    'FABRICATE':  { skill: 'Basic Tech', bars: ['multitool', 'field kit', 'portable printer', 'ammo fab', 'matter printer', 'nano-forge', 'universal fab'] },
    // ── harvested from the Ultra Chrome catalogue (breadth of CP2020 gear) ──
    'RECORD':     { skill: 'Electronics', bars: ['note', 'photo', 'audio', 'video', 'multi-cam', 'braindance', 'full-sense archive'] },
    'VISION':     { skill: 'Cyber Tech', bars: ['goggles', 'zoom', 'low-light', 'infrared', 'thermographic', 'multi-spectral', 'total vision'] },
    'ANALYZE':    { skill: 'Electronics', bars: ['gauge', 'simple detector', 'chemical analysis', 'medical diagnosis', 'lie detector', 'deep scan', 'omniscient'] },
    'CLOAK':      { skill: 'Electronics', bars: ['matte paint', 'anti-glare', 'radar-absorbing', 'IR baffle', 'laser ablative', 'multi-spectral stealth', 'null signature'] },
    'SEAL':       { skill: 'Basic Tech', bars: ['windbreak', 'waterproof', 'air mask', 'NBC suit', 'hardsuit', 'pressure-proof', 'closed cycle'] },
    'FLY':        { skill: 'AV Tech', bars: ['glide jump', 'glide', 'short jetpack', 'hover', 'sustained flight', 'supersonic', 'orbital'] },
    'HAUL':       { skill: 'Basic Tech', bars: ['strap', 'load bag', 'winch', 'crane', 'trailer', 'gantry', 'heavy lift'] },
    'ILLUMINATE': { skill: 'Basic Tech', bars: ['glow', 'lamp', 'torch', 'floodlight', 'IR illuminator', 'blinding strobe', 'portable sun'] },
    'DEMOLISH':   { skill: 'Demolitions', bars: ['firecracker', 'charge', 'C6', 'breaching charge', 'demolition', 'shaped charge', 'levels a block'] },
    'BROADCAST':  { skill: 'Electronics', bars: ['walkie', 'radio', 'TV', 'tight beam', 'relay', 'mesh', 'satellite coverage'] },
    'TRANSLATE':  { skill: 'Electronics', bars: ['lexicon', 'phrases', 'real-time', 'slang', 'all languages', 'intent', 'telepathic front'] },
    'STYLE':      { skill: 'Wardrobe & Style', bars: ['clean', 'sharp', 'urban flash', 'edgerunner', 'haute couture', 'icon', 'living legend'] },
    'SURVIVE':    { skill: 'Basic Tech', bars: ['lighter', 'survival kit', 'shelter', 'clean water', 'long endurance', 'mobile base', 'ecosystem'] },
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
    ammo: ['.22', '9mm', '10mm', '11mm', '.38', '.357', '.44', '.45 ACP', '5.56', '5.45', '7.62', '12ga', '10ga', '20ga', '.50', '12.7mm', '15mm', '20mm', '25mm', '30mm', '37mm', 'he-84', 'thermo-84', 'smart-84', 'arrow', 'bolt', 'flechette', 'dart', 'rocket-2.75', 'railgun-slug'],
    mount: ['torso-std', 'face-std', 'rail-std', 'underbarrel-rail', 'gyro-mount', 'sling', 'bipod', 'tripod', 'turret-mount-b', 'pintle-turret', 'hardpoint', 'weapon-pod', 'shoulder-mount', 'cyberlimb-mount', 'tube-84', 'borg-frame-std'],
    power: ['cell power-c', 'cell power-d', 'battery-b', 'power-cell', 'capacitor', 'fuel-cell', 'et-charge', 'solar', 'chooh2', 'micro-fusion', 'nuclear-core'],
    port: ['neural-port', 'neural-link', 'interface-plug', 'chipware-socket', 'data-port', 'cybermodem', 'control-link', 'dataline', 'satellite-uplink'],
    format: ['shard-std', 'chip-std', 'memchip', 'braindance-chip', 'skillchip', 'credchip', 'deck-std', 'mu'],
    consumable: ['cartridge filter-std', 'air-canister', 'drug-dose', 'blood-pack', 'coolant', 'cutting-fuel', 'chaff', 'flare', 'smoke', 'detonator', 'medpack'],
  };
  var STD = {};
  Object.keys(TOKENS).forEach(function (g) { TOKENS[g].forEach(function (t) { STD[t.toLowerCase()] = g; }); });
  function isStandard(token) { return !!STD[String(token || '').toLowerCase()]; }
  function allTokens() { var o = []; Object.keys(TOKENS).forEach(function (g) { o = o.concat(TOKENS[g]); }); return o; }

  // ── presets: full records, hand-coted (the calibration set) ──
  var RAW = [
    { id: 'preset-filter-mask', name: 'SCAVENGER FILTER MASK', cls: 'gear', tier: 2, origin: 'HANDMADE',
      flavor: 'Rebreather kludged for Dump scavengers — lasts 40 hours, voice crackles.',
      feats: [{ domain: 'FILTER-AIR', grade: 1 }],
      ports: { needs: [{ token: 'cartridge filter-std', rate: '40h' }], fits: ['face-std'] },
      limits: [{ text: 'nose-mouth only · voice −1' }], mods: [{ target: 'wearer.voice', value: '-1', when: 'when worn' }] },

    { id: 'preset-thermoptic-cape', name: 'CHAMELEON CLOAK', cls: 'gear', tier: 4, origin: 'CORP PULL',
      flavor: 'Thermoptic — the camo flickers at a sprint, but they miss you.',
      feats: [{ domain: 'CONCEAL', grade: 4, when: 'while powered' }, { domain: 'ARMOR', grade: 2 }],
      ports: { needs: [{ token: 'cell power-c', rate: '30min' }], fits: ['torso-std'] },
      limits: [{ text: 'shimmer at a sprint (grade −1 while running)' }], mods: [{ target: 'wearer.Stealth', value: '+2', when: 'while powered' }],
      lineage: { refines: '', steps: 1 } },

    { id: 'preset-jump-boots', name: 'KANGAROO JUMP BOOTS', cls: 'gear', tier: 2, origin: 'FACTORY',
      flavor: 'Calf actuators — +3 to jump, land how you can.',
      feats: [{ domain: 'MOVE', grade: 2 }], mods: [{ target: 'wearer.MA.jump', value: '+3', when: 'when worn' }],
      limits: [{ text: 'hard landing: REF check or 1d6' }] },

    { id: 'preset-combat-drone', name: 'WATCHDOG COMBAT DRONE', cls: 'carrier', tier: 4, origin: 'CORP PULL',
      flavor: 'Security quadrotor drone — light autofire, multi-spectral optics.',
      feats: [{ domain: 'SENSE', grade: 3 }, { domain: 'STRIKE', grade: 3 }],
      ports: { takes: [{ slot: 'gadget-bay', accepts: ['rail-std'], n: 2 }], needs: [{ token: 'control-link', service: true }, { token: 'cell power-d', rate: '2h' }] },
      limits: [{ text: 'bandwidth: 1 operator at a time' }],
      stats: { sdp: 20, sp: 8 }, latent: [{ text: 'factory telemetry beacon', domain: 'LINK', grade: 2, who: ['maker', 'GM'] }] },

    { id: 'preset-cyber-dog', name: 'CERBERUS CYBER-MASTIFF', cls: 'carrier', tier: 4, origin: 'FACTORY',
      flavor: 'Cyber guard mastiff — hydraulic jaws, chem-sniffer muzzle.',
      feats: [{ domain: 'STRIKE', grade: 4 }, { domain: 'SENSE', grade: 3 }],
      ports: { needs: [{ token: 'control-link', service: true }], holds: [{ kind: 'payload', cap: '1 module' }] },
      limits: [{ text: 'hardwired loyalty: loses control if CONTROL is cracked' }], stats: { sdp: 30, sp: 6 } },

    { id: 'preset-rpg', name: 'MILITECH ARROW RPG', cls: 'weapon', tier: 3, origin: 'CORP PULL',
      flavor: 'Shoulder-fired launcher — takes three warheads, re-bores for a fourth if you dare.',
      feats: [{ domain: 'STRIKE', grade: 4 }],
      ports: { takes: [{ slot: 'tube', accepts: ['he-84', 'thermo-84', 'smart-84'], n: 1 }] },
      stats: { range: '400m', shots: 1 },
      mods: [{ target: 're-bore chamber', value: '+accepts he-100 · dmg+2d6 · instab+2', when: 'modded' }] },

    { id: 'preset-smart-rocket', name: 'SMART ROCKET 84MM', cls: 'ammo', tier: 3, origin: 'CORP PULL',
      flavor: 'Guided rocket — locks on after designation, for any 84 tube.',
      feats: [{ domain: 'GUIDE', grade: 3 }],
      ports: { fits: ['tube-84'], needs: [{ token: 'designator-link' }] } },

    { id: 'preset-datashard', name: 'FULL DATASHARD', cls: 'data', tier: 1, origin: 'FACTORY',
      flavor: 'Sealed shard — 40 megaunits, extraction coordinates inside.',
      feats: [], ports: { fits: ['shard-std'], holds: [{ kind: 'data', cap: '40MU', contents: 'extraction coordinates' }] } },

    { id: 'preset-neural-cable', name: 'INTERFACE CABLE', cls: 'electronics', tier: 2, origin: 'FACTORY',
      flavor: 'Dive cable — links a neural port to any digital interface.',
      feats: [{ domain: 'LINK', grade: 2 }], ports: { fits: ['neural-port'], feeds: ['data-port'] } },

    { id: 'preset-ambulance', name: 'ARMORED TRAUMA VAN', cls: 'vehicle', tier: 5, origin: 'FACTORY',
      flavor: 'Armored ambulance — onboard stabilization bay, sheet metal that takes hits.',
      feats: [{ domain: 'HEAL', grade: 3 }, { domain: 'ARMOR', grade: 4 }],
      ports: { holds: [{ kind: 'patients', cap: '2' }] }, stats: { sdp: 75, sp: 20, seats: 2 } },
  ];
  var PRESETS = RAW.map(function (r) { r.preset = true; return A ? A.normalize(r) : r; });
  function presets() { return PRESETS.map(function (p) { return A ? A.clone(p) : JSON.parse(JSON.stringify(p)); }); }

  // ── what a given class usually needs — the "smart parts bin" per class ──
  var SUGGEST = {
    weapon:      { domains: ['STRIKE', 'GUIDE', 'BURN', 'SHOCK', 'RESTRAIN'], tokens: ['9mm', '5.56', '12ga', 'he-84', 'smart-84', 'tube-84', 'rail-std', 'cell power-c'] },
    ammo:        { domains: ['STRIKE', 'GUIDE', 'BURN'], tokens: ['9mm', '5.56', '7.62', '12ga', 'he-84', 'tube-84'] },
    gear:        { domains: ['CONCEAL', 'ARMOR', 'MOVE', 'FILTER-AIR', 'SHIELD', 'DISGUISE'], tokens: ['torso-std', 'face-std', 'cell power-c', 'cartridge filter-std'] },
    cyberware:   { domains: ['BOOST', 'SENSE', 'LINK', 'MOVE', 'DISGUISE'], tokens: ['neural-port', 'borg-frame-std'] },
    vehicle:     { domains: ['ARMOR', 'MOVE', 'STRIKE', 'SHIELD', 'CONTROL'], tokens: ['fuel-cell', 'turret-mount-b'] },
    electronics: { domains: ['LINK', 'HACK', 'PROJECT', 'TRACK', 'STORE', 'SENSE'], tokens: ['data-port', 'interface-plug', 'cell power-c'] },
    drug:        { domains: ['HEAL', 'BOOST', 'INJECT'], tokens: [] },
    carrier:     { domains: ['SENSE', 'STRIKE', 'CONTROL', 'TRACK', 'LINK'], tokens: ['control-link', 'cell power-d'] },
    data:        { domains: ['STORE', 'COMPUTE', 'HACK'], tokens: ['shard-std', 'chip-std'] },
  };
  function suggestFor(cls) { var s = SUGGEST[cls] || { domains: [], tokens: [] }; return { domains: s.domains.filter(isKnownDomain), tokens: s.tokens.slice() }; }

  // ── common MODIFICATIONS (harvested from Ultra Chrome), grouped ──
  var MODS = {
    firearm: ['silencer', 'laser sight', 'scope', 'red-dot', 'smartgun link', 'extended magazine', 'drum magazine', 'folding stock', 'recoil compensator', 'underbarrel grenade launcher', 'bipod', 'full-auto conversion', 'hair trigger', 'armor-piercing ammo', 'HE ammo', 'electrothermal ammo', 'caseless barrel', 'fingerprint-free finish'],
    armor: ['insert plates (+SP)', 'laser ablative layer', 'thermal displacement', 'radar-absorbing', 'fireproofed', 'anti-stun (signal-retardant)', 'video/polychromic panel', 'concealed storage'],
    cyber: ['smartgun link', 'low-light/IR/thermo option', 'anti-glare', 'EMP shielding', 'realskin', 'lockable joints', 'extended range', 'pop-up/retractable', 'undetectable bone', 'hollow compartment', 'reduced humanity cost'],
    vehicle: ['armor (+SP)', 'turret', 'reactive plates', 'stealth coating', 'run-flat tires', 'armored windows', 'winch', 'reinforced ram', 'amphibious kit', 'weapon pod', 'cargo hold', 'autopilot', 'ejection seat'],
    electronics: ['+MU memory', 'fast processor', 'EMP shielding', 'datashielding', 'encryption', 'satellite uplink', 'extended range', 'dead man’s handle', 'jam-proof'],
    general: ['custom finish', 'fingerprint-free', 'superior quality', 'miniaturization', 'voice control', 'GPS module', 'update subscription', 'self-cleaning coating'],
  };
  var MOD_GROUPS = { weapon: ['firearm', 'general'], ammo: ['firearm'], cyberware: ['cyber', 'general'], vehicle: ['vehicle', 'general'], carrier: ['vehicle', 'electronics'], electronics: ['electronics', 'general'], data: ['electronics'], gear: ['armor', 'general'], drug: ['general'] };
  function modsFor(cls) { return (MOD_GROUPS[cls] || ['general']).map(function (g) { return { group: g, list: MODS[g] || [] }; }); }

  // ── EFFECT-tied ADDONS — each domain inherits a catalogue by family ──
  // (generic, cross-cutting addons go through the GENERIC_ADDONS text field).
  var ADDON_FAMILIES = {
    weapon:   ['silencer', 'long barrel', 'bipod', 'recoil compensator', 'extended magazine', 'underbarrel rail', 'folding stock', 'hair trigger'],
    optics:   ['helmet mount', 'telephoto lens', 'IR filter', 'low-light gain', 'powered zoom', 'HUD overlay', 'anti-glare coating', 'gyro stabilizer'],
    signal:   ['boosted antenna', 'encryption module', 'signal amp', 'stealth routing', 'extra data ports', 'burst transmitter', 'directional antenna'],
    armor:    ['trauma plates', 'sealed liner', 'ablative coating', 'ceramic insert', 'quick-release', 'reinforced seams', 'concealed cut'],
    mobility: ['gyro stabilizer', 'reinforced servos', 'cargo rack', 'quick-release harness', 'shock dampers', 'grip treads'],
    medchem:  ['dose regulator', 'sterile reservoir', 'auto-injector', 'cold-chain liner', 'overflow valve'],
    core:     ['high-capacity cell', 'fast-charge port', 'solar trickle panel', 'hot-swap module', 'hardened housing'],
  };
  var DOMAIN_FAMILY = {
    STRIKE: 'weapon', SHOCK: 'weapon', BURN: 'weapon', PROJECT: 'weapon', DEMOLISH: 'weapon', SONIC: 'weapon',
    VISION: 'optics', SENSE: 'optics', TRACK: 'optics', ANALYZE: 'optics', RECORD: 'optics', ILLUMINATE: 'optics',
    LINK: 'signal', HACK: 'signal', COMPUTE: 'signal', BROADCAST: 'signal', JAM: 'signal', CONTROL: 'signal', TRANSLATE: 'signal',
    ARMOR: 'armor', SHIELD: 'armor', SEAL: 'armor', CONCEAL: 'armor', CLOAK: 'armor', DISGUISE: 'armor',
    MOVE: 'mobility', FLY: 'mobility', HAUL: 'mobility', BOOST: 'mobility', RESTRAIN: 'mobility', SURVIVE: 'mobility',
    HEAL: 'medchem', INJECT: 'medchem', 'FILTER-AIR': 'medchem', REPAIR: 'medchem', FABRICATE: 'medchem',
    POWER: 'core', STORE: 'core', GUIDE: 'core', STYLE: 'core',
  };
  var GENERIC_ADDONS = ['miniaturization', 'hardened', 'waterproofed', 'modular', 'concealed', 'lightweighted', 'fingerprint-free', 'reinforced', 'voice control', 'self-cleaning'];
  function familyOfDomain(dom) { return DOMAIN_FAMILY[String(dom || '').toUpperCase()] || null; }
  function addonsForDomain(dom) { var f = familyOfDomain(dom); return f ? ADDON_FAMILIES[f].slice() : GENERIC_ADDONS.slice(); }

  // ── ADDON PRICES ── number = fixed eb ; { mult } = fraction of the object's base
  // complexity cost (scales with Σgrades) — miniaturising a robot-dog costs a fortune.
  // Anything absent falls to the flat TUNING.addon.eb default.
  var ADDON_PRICES = {
    // weapon
    'silencer': 150, 'long barrel': 100, 'bipod': 75, 'recoil compensator': 120, 'extended magazine': 50, 'underbarrel rail': 40, 'folding stock': 80, 'hair trigger': 100,
    // optics
    'helmet mount': 60, 'telephoto lens': 200, 'ir filter': 150, 'low-light gain': 250, 'powered zoom': 180, 'hud overlay': 300, 'anti-glare coating': 50, 'gyro stabilizer': 220,
    // signal
    'boosted antenna': 120, 'encryption module': 300, 'signal amp': 150, 'stealth routing': 400, 'extra data ports': 80, 'burst transmitter': 180, 'directional antenna': 100,
    // armor
    'trauma plates': 200, 'sealed liner': 250, 'ablative coating': 300, 'ceramic insert': 180, 'quick-release': 60, 'reinforced seams': 40, 'concealed cut': 90,
    // mobility
    'reinforced servos': 300, 'cargo rack': 80, 'quick-release harness': 60, 'shock dampers': 120, 'grip treads': 150,
    // medchem
    'dose regulator': 150, 'sterile reservoir': 90, 'auto-injector': 200, 'cold-chain liner': 250, 'overflow valve': 60,
    // core
    'high-capacity cell': 200, 'fast-charge port': 80, 'solar trickle panel': 150, 'hot-swap module': 120, 'hardened housing': 100,
    // generic — mostly complexity-scaled (they touch the whole object)
    'miniaturization': { mult: 1.0 }, 'hardened': { mult: 0.3 }, 'waterproofed': { mult: 0.2 }, 'modular': { mult: 0.25 },
    'concealed': { mult: 0.15 }, 'lightweighted': { mult: 0.35 }, 'reinforced': { mult: 0.3 },
    'fingerprint-free': 60, 'voice control': 120, 'self-cleaning': 80,
  };
  function addonPrice(name) { var e = ADDON_PRICES[String(name || '').toLowerCase().trim()]; return e === undefined ? null : e; }

  window.TechCatalog = {
    ANCHORS: ANCHORS, DOMAINS: DOMAINS, anchorOf: anchorOf, isKnownDomain: isKnownDomain, skillForDomain: skillForDomain,
    CLASSES: CLASSES, skillForClass: skillForClass,
    TOKENS: TOKENS, allTokens: allTokens, isStandard: isStandard,
    SUGGEST: SUGGEST, suggestFor: suggestFor,
    MODS: MODS, modsFor: modsFor,
    ADDON_FAMILIES: ADDON_FAMILIES, GENERIC_ADDONS: GENERIC_ADDONS, familyOfDomain: familyOfDomain, addonsForDomain: addonsForDomain,
    ADDON_PRICES: ADDON_PRICES, addonPrice: addonPrice,
    presets: presets, PRESETS: PRESETS,
  };
})();
