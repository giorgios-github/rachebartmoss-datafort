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
    // ── FAB family: how a thing gets MADE (each fab method its own base-tree) ──
    'FAB-ADDITIVE':    { skill: 'Basic Tech', bars: ['glue stick', 'filament printer', 'resin vat', 'powder-bed metal', 'multi-material cell', 'prints working machines', 'self-replicating fab-cell'] },
    'FAB-SUBTRACTIVE': { skill: 'Gyro Tech', bars: ['hand file', 'bench drill', '3-axis router', '5-axis mill', 'EDM and waterjet', 'sub-micron cell', 'angstrom-true optics'] },
    'FAB-CHEM':        { skill: 'Pharmaceuticals', bars: ['bathtub cook', 'stirred tank', 'work-up train', 'flow reactor', 'designer catalyst', 'any molecule to order', 'autonomous plant'] },
    'FAB-FORGE':       { skill: 'Basic Tech', bars: ['charcoal forge', 'sand cast', 'die cast', 'press forge', 'vacuum superalloy', 'single-crystal grow', 'metamaterial armour'] },
    'BIOFAB':          { skill: 'Pharmaceuticals', bars: ['petri dish', 'sterile incubator', 'stirred bioreactor', 'scaffold graft', 'whole-organ vat', 'living machines', 'designer organism'] },
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
    // ── new categories: keeping a thing shut, and letting a thing change shape ──
    'SECURITY':   { skill: 'Electronic Security', bars: ['latch', 'keyed lock', 'coded lock', 'biometric lock', 'active countermeasures', 'layered corp vault', 'nothing gets in'] },
    'MORPH':      { skill: 'Basic Tech', bars: ['folds flat', 'collapsible', 'swappable modules', 'tool-less reconfigure', 'powered transform', 'self-reconfiguring', 'programmable matter'] },
    'MIND':       { skill: 'Cyber Tech', bars: ['hunch', 'mood read', 'sense record', 'braindance playback', 'emotion capture', 'persona overlay', 'wears a mind'] },
    'CONTAIN':    { skill: 'Basic Tech', bars: ['pocket', 'crate', 'sealed drum', 'pressure vessel', 'climate hold', 'blast vault', 'holds what walls cannot'] },
    'EMIT':       { skill: 'Pharmaceuticals', bars: ['puff', 'smoke can', 'screening cloud', 'multispectral obscurant', 'targeted plume', 'area flood', 'a weather of your own'] },
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
    fab:      ['tool changer', 'sealed enclosure', 'fume extraction', 'feedstock hopper', 'in-process gauge', 'waste conveyor', 'lights-out controller', 'calibration jig'],
    security: ['tamper seal', 'intrusion log', 'proximity token', 'duress code', 'alarm shriek', 'backup power', 'anti-pick shroud'],
  };
  var DOMAIN_FAMILY = {
    STRIKE: 'weapon', SHOCK: 'weapon', BURN: 'weapon', PROJECT: 'weapon', DEMOLISH: 'weapon', SONIC: 'weapon',
    ROCKET: 'weapon', CHEMICAL: 'weapon', ENERGY: 'weapon', GAUSS: 'weapon', BLADE: 'weapon',   // STRIKE weapon systems
    VISION: 'optics', SENSE: 'optics', TRACK: 'optics', ANALYZE: 'optics', RECORD: 'optics', ILLUMINATE: 'optics',
    LINK: 'signal', HACK: 'signal', COMPUTE: 'signal', BROADCAST: 'signal', JAM: 'signal', CONTROL: 'signal', TRANSLATE: 'signal',
    ARMOR: 'armor', SHIELD: 'armor', SEAL: 'armor', CONCEAL: 'armor', CLOAK: 'armor', DISGUISE: 'armor',
    MOVE: 'mobility', FLY: 'mobility', HAUL: 'mobility', BOOST: 'mobility', RESTRAIN: 'mobility', SURVIVE: 'mobility',
    HEAL: 'medchem', INJECT: 'medchem', 'FILTER-AIR': 'medchem', REPAIR: 'medchem', FABRICATE: 'medchem',
    POWER: 'core', STORE: 'core', GUIDE: 'core', STYLE: 'core',
    'FAB-ADDITIVE': 'fab', 'FAB-SUBTRACTIVE': 'fab', 'FAB-CHEM': 'fab', 'FAB-FORGE': 'fab', BIOFAB: 'fab',
    SECURITY: 'security', MORPH: 'mobility', MIND: 'signal', CONTAIN: 'core', EMIT: 'medchem',
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
    // tag-class addons (unlocked by walked effect-tree nodes; each node's `tag` = an addon class)
    'heavy barrel': 110, 'muzzle brake': 70, 'threaded muzzle': 45,
    'quick-loader': 60, 'mixed-load selector': 120, 'tracer rounds': 40, 'rangefinder': 160,
    'multi-lock': 280, 'decoy rejection': 240, 'datalink uplink': 200,
    'selectable yield': 260, 'airburst fuze': 180, 'safe-arm interlock': 70,
    'fast-feed ramp': 70, 'dual-feed selector': 140, 'belt adapter': 90,
    'reload cassette': 80, 'soft-launch tube': 120, 'mixed rack': 100,
    'beam focuser': 200, 'heat shroud': 150, 'pulse tuner': 170,
    'capacitor bank': 220, 'cooling shroud': 120, 'arc suppressor': 160,
    'mono-hone': 90, 'quick-draw sheath': 70, 'serrated spine': 60,
    'spool guard': 60, 'tension reel': 110, 'grip loop': 40,
    'shock cushion': 70, 'counterweight head': 90,
    'trauma insert': 180, 'breathable liner': 60, 'stab layer': 110,
    'matte finish': 60, 'reaction tuner': 200, 'spare tiles': 120, 'load harness': 150,
    'spare cartridge': 40, 'positive-pressure blower': 180, 'quick-swap seal': 60,
    'spare o2 bottle': 90, 'co2 monitor': 120,
    'subdermal mount': 150, 'anti-tamper lock': 200, 'maintenance port': 60, 'neural sync': 300,
    'extra ram': 150, 'co-processor': 250, 'ice buffer': 200,
    'payload slot': 120, 'stealth wrapper': 180, 'auto-update': 80,
    'run-flat tires': 150, 'skid plate': 100, 'all-weather tread': 120, 'nitro tank': 300,
    'reserve chute': 120, 'altimeter': 60, 'vector nozzle': 200,
    'sling mount': 30, 'lens cap': 20, 'spare battery': 40,
  };
  function addonPrice(name) { var e = ADDON_PRICES[String(name || '').toLowerCase().trim()]; return e === undefined ? null : e; }

  // ── ADDON CLASSES — a walked effect-tree node carries a `tag` = an addon class it UNLOCKS.
  // The per-effect picker offers the UNION of the classes unlocked by the nodes you walked,
  // plus a minimal domain base (never empty). Unknown tags just contribute nothing (graceful),
  // and an untagged / legacy effect falls back to its whole domain family. Seed set — grows freely.
  var ADDON_CLASSES = {
    // STRIKE weapon systems
    barrel: ['long barrel', 'heavy barrel', 'muzzle brake', 'threaded muzzle'],
    ammo: ['extended magazine', 'quick-loader', 'mixed-load selector', 'tracer rounds'],
    optics: ['powered zoom', 'IR filter', 'low-light gain', 'HUD overlay', 'rangefinder'],
    optic: ['powered zoom', 'IR filter', 'low-light gain', 'HUD overlay', 'rangefinder'],
    seeker: ['multi-lock', 'decoy rejection', 'datalink uplink'],
    warhead: ['selectable yield', 'airburst fuze', 'safe-arm interlock'],
    feed: ['fast-feed ramp', 'dual-feed selector', 'belt adapter'],
    munition: ['reload cassette', 'soft-launch tube', 'mixed rack'],
    emitter: ['beam focuser', 'heat shroud', 'pulse tuner'],
    driver: ['capacitor bank', 'cooling shroud', 'arc suppressor'],
    core: ['high-capacity cell', 'fast-charge port', 'hot-swap module', 'solar trickle panel'],
    cell: ['spare cell', 'fast-charge port', 'high-density pack', 'thermal cutoff'],
    edge: ['mono-hone', 'quick-draw sheath', 'serrated spine'],
    wire: ['spool guard', 'tension reel', 'grip loop'],
    impact: ['shock cushion', 'counterweight head'],
    // ARMOR / SHIELD
    plate: ['trauma insert', 'ceramic insert', 'quick-release', 'reinforced seams'],
    weave: ['concealed cut', 'breathable liner', 'stab layer'],
    reflec: ['matte finish', 'anti-glare coating'],
    active: ['reaction tuner', 'spare tiles'],
    exo: ['reinforced servos', 'load harness', 'gyro stabilizer'],
    // FILTER-AIR
    filter: ['spare cartridge', 'positive-pressure blower', 'quick-swap seal'],
    closed: ['spare O2 bottle', 'CO2 monitor'],
    // MOVE / HACK / SENSE, and chrome
    cyberware: ['subdermal mount', 'anti-tamper lock', 'maintenance port', 'neural sync'],
    deck: ['extra RAM', 'co-processor', 'ICE buffer', 'cooling shroud'],
    program: ['payload slot', 'stealth wrapper', 'auto-update'],
    drive: ['run-flat tires', 'skid plate', 'all-weather tread', 'nitro tank'],
    flight: ['reserve chute', 'altimeter', 'vector nozzle'],
    // FAB family — the machine that makes the thing
    nozzle: ['hardened nozzle', 'multi-material head', 'heated bore', 'auto-wipe'],
    vat: ['resin heater', 'level sensor', 'inert cover', 'quick-drain'],
    crucible: ['pour controller', 'thermal jacket', 'slag skimmer', 'inert cover'],
    spindle: ['tool changer', 'through-spindle coolant', 'auto-balancer', 'touch probe'],
    reactor: ['jacket heater', 'pressure relief', 'inline analytics', 'blast shield'],
    matrix: ['lattice designer', 'clean chamber', 'atom-scale calibration'],
    // SHOCK
    arc: ['insulated grip', 'arc shield', 'charge indicator'],
    coil: ['capacitor bank', 'field tuner', 'cooling loop'],
    // batches 3-6: offense, perception, signal, stealth/environment
    torch: ['spare fuel bottle', 'striker', 'flashback arrestor', 'nozzle set'],
    lance: ['spare rod', 'insulated grip', 'oxygen feed', 'strike igniter'],
    charge: ['safe-arm interlock', 'timer fuze', 'remote detonator', 'shaped liner'],
    horn: ['focusing horn', 'baffle ring', 'mount clamp'],
    resonator: ['tuning fork set', 'frequency preset', 'vibration mount'],
    injector: ['spare cartridge', 'dose regulator', 'quick-purge line'],
    snare: ['spare cartridge', 'quick-release cutter', 'tension gauge'],
    lens: ['lens cap', 'anti-glare coating', 'filter ring', 'spare optic'],
    overlay: ['HUD overlay', 'custom reticle', 'colour-blind palette', 'auto-brightness'],
    reel: ['spare storage reel', 'quick-eject', 'index tab'],
    beacon: ['spare beacon', 'long-life cell', 'tamper switch', 'burst schedule'],
    antenna: ['boosted antenna', 'directional horn', 'mast extension', 'weatherproof radome'],
    relay: ['spare relay node', 'mesh pairing', 'solar trickle', 'weather casing'],
    codec: ['extra language pack', 'slang dictionary', 'low-bandwidth mode', 'offline cache'],
    holo: ['projector lens', 'scene library', 'ambient-light compensator', 'silent fan'],
    phantom: ['decoy library', 'signature randomiser', 'burn-after-use profile'],
    ice: ['signature updates', 'sandbox layer', 'alert relay'],
    camo: ['pattern library', 'season swap', 'anti-glint coat', 'quick-change skin'],
    dye: ['refill cartridge', 'fast-set catalyst', 'UV-stable pigment'],
    seal: ['spare gasket', 'pressure test port', 'lubricant kit', 'quick-seal patch'],
    scar: ['patch kit', 'sealant charge', 'abrasion guard'],
    gill: ['spare membrane', 'silt prefilter', 'flow booster'],
    lock: ['spare key', 'tamper witness', 'anti-pick shroud', 'duress code'],
    shell: ['spare panel', 'quick-release catch', 'impact liner', 'colour skin'],
    swarm: ['spare units', 'recall beacon', 'charging nest', 'firmware sync'],
    // batches 7-8: flight, movement, body, logistics, containment, repair, emission, shielding
    rotor: ['blade de-ice', 'pitch trim', 'spare blades', 'strike guard'],
    thrust: ['heat shroud', 'intake screen', 'fuel reserve', 'vector trim'],
    lift: ['ballast trim', 'patch kit', 'tie-down set'],
    limb: ['joint seals', 'spare actuator', 'shin guard', 'footpad set'],
    tread: ['run-flat core', 'spare track link', 'mud scraper'],
    grip: ['spare pads', 'grip cleaner', 'fall-arrest line'],
    fin: ['fin guard', 'anti-foul coat', 'spare blade'],
    auger: ['spare cutter head', 'spoil chute', 'bit sharpener'],
    exo: ['reinforced servos', 'load harness', 'quick-release', 'padding kit'],
    wire: ['shielded loom', 'spare lead', 'surge clamp'],
    dose: ['spare cartridge', 'dose lockout', 'sterile purge', 'occlusion alarm'],
    stasis: ['rewarm kit', 'coolant reserve', 'vitals tag'],
    arm: ['tool turret', 'wrist joint', 'grip pads', 'haptic governor'],
    mount: ['adapter plate', 'quick release', 'dovetail rail', 'bus router'],
    crate: ['lidded top', 'strap cage', 'liner bag', 'stack feet'],
    pod: ['seal gasket', 'stack lock', 'handle set'],
    tank: ['relief valve', 'level gauge', 'bung seal', 'pump riser'],
    vessel: ['tamper seal', 'inspection port', 'lifting lugs', 'label plate'],
    smoke: ['refill canister', 'wind trim', 'timed bloom'],
    foam: ['reserve tank', 'nozzle set', 'cure booster'],
    chaff: ['refill magazine', 'burst timer', 'dipole cut'],
    ablate: ['spare tiles', 'peel ply', 'edge trim'],
    deflector: ['anchor feet', 'firing slit', 'wheel base'],
    ward: ['charge coil', 'node sync', 'ward beacon', 'flicker gate'],
  };
  // a minimal "never empty" floor per family, when at least one class was unlocked
  var DOMAIN_BASE = { weapon: ['sling mount'], optics: ['lens cap'], signal: ['spare battery'],
    armor: ['quick-release'], mobility: ['maintenance port'], medchem: ['sterile reservoir'], core: ['fast-charge port'],
    fab: ['dust cover'], security: ['tamper seal'] };

  // groups of addons for an effect: one section per unlocked class (from walked-node tags),
  // + a minimal domain base; or the whole domain family if nothing was unlocked (legacy/untagged).
  function addonClasses(tags, domain) {
    tags = tags || []; var groups = [], seen = {};
    tags.forEach(function (t) { var k = String(t || '').toLowerCase(); if (seen[k]) return; var lst = ADDON_CLASSES[k]; if (lst) { seen[k] = 1; groups.push({ tag: k, label: k.toUpperCase(), addons: lst.slice() }); } });
    var fam = familyOfDomain(domain);
    if (groups.length) { var base = DOMAIN_BASE[fam]; if (base) groups.push({ tag: '_base', label: 'GENERAL', addons: base.slice() }); }
    else groups.push({ tag: '_fam', label: fam ? fam.toUpperCase() : (String(domain || '').toUpperCase() + ' · GENERIC'), addons: addonsForDomain(domain) });
    return groups;
  }

  window.TechCatalog = {
    ANCHORS: ANCHORS, DOMAINS: DOMAINS, anchorOf: anchorOf, isKnownDomain: isKnownDomain, skillForDomain: skillForDomain,
    CLASSES: CLASSES, skillForClass: skillForClass,
    TOKENS: TOKENS, allTokens: allTokens, isStandard: isStandard,
    SUGGEST: SUGGEST, suggestFor: suggestFor,
    MODS: MODS, modsFor: modsFor,
    ADDON_FAMILIES: ADDON_FAMILIES, GENERIC_ADDONS: GENERIC_ADDONS, familyOfDomain: familyOfDomain, addonsForDomain: addonsForDomain,
    ADDON_CLASSES: ADDON_CLASSES, addonClasses: addonClasses,
    ADDON_PRICES: ADDON_PRICES, addonPrice: addonPrice,
    presets: presets, PRESETS: PRESETS,
  };
})();
