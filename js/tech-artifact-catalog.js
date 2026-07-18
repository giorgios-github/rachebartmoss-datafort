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
    'BOOST':      { skill: 'Cyber Tech', bars: ['—', '+1 attribut', '+2', 'réflexes câblés', '+3 combat', 'milspec', 'surhumain'] },
    'SHOCK':      { skill: 'Electronics', bars: ['statique', 'décharge taser', 'assomme', 'champ de stun', 'grille le cyber', 'salve EMP', 'EMP de zone'] },
    'BURN':       { skill: 'Weaponsmith', bars: ['flamme', 'chalumeau', 'thermite', 'découpe plasma', 'lance thermique', 'torche à arc', 'mono chauffée'] },
    'PROJECT':    { skill: 'Electronics', bars: ['holo plat', 'leurre statique', 'leurre mobile', 'double crédible', 'illusion complète', 'fantôme sensoriel', 'indétectable'] },
    'HACK':       { skill: 'Electronic Security', bars: ['crochète une serrure', 'spoofe des accès', 'perce un appareil', 'prend le contrôle', 'crack un fort', 'possède le réseau', 'invisible au sysop'] },
    'INJECT':     { skill: 'Pharmaceuticals', bars: ['piqûre', 'auto-dose', 'cocktail de combat', 'régime minuté', 'fléchette ciblée', 'aérosol de zone', 'contact cutané'] },
    'DISGUISE':   { skill: 'Cyber Tech', bars: ['masque', 'voix maquillée', 'face-off', 'traits morphables', 'spoof biométrique', 'ADN de façade', 'indétectable'] },
    'SHIELD':     { skill: 'Electronics', bars: ['durci EMP', 'champ amortisseur', 'tampon cinétique', 'bouclier d’énergie', 'barrière milspec', 'champ dense', 'impénétrable'] },
    'TRACK':      { skill: 'Electronics', bars: ['ping GPS', 'tag et suit', 'à travers les murs', 'à l’échelle ville', 'prédictif', 'satellite', 'inéluctable'] },
    'CONTROL':    { skill: 'Electronics', bars: ['télécommande filaire', 'remote courte', 'pirate le non-sécurisé', 'saisit le sécurisé', 'contrôle de masse', 'essaim autonome', 'asservit tout'] },
    'REPAIR':     { skill: 'Basic Tech', bars: ['rustine', 'réparation de terrain', 'auto-réparation', 'nanites', 'reconstruction', 'régénère', 'inusable'] },
    'COMPUTE':    { skill: 'Programming', bars: ['calculette', 'co-processeur', 'smartlink', 'système expert', 'pseudo-IA', 'IA véritable', 'esprit ruche'] },
    'SONIC':      { skill: 'Sonar Tech', bars: ['amplificateur', 'ping sonar', 'ultrason', 'stun sonique', 'brise-résonance', 'sonique létal', 'onde de choc'] },
    'RESTRAIN':   { skill: 'Weaponsmith', bars: ['collier', 'filet', 'toile gluante', 'mousse adhésive', 'poigne de stase', 'champ de contention', 'inéluctable'] },
    'FABRICATE':  { skill: 'Basic Tech', bars: ['multitool', 'kit de terrain', 'imprimante portable', 'fab de munitions', 'imprimante matière', 'nano-forge', 'fab universelle'] },
    // ── harvested from the Ultra Chrome catalogue (breadth of CP2020 gear) ──
    'RECORD':     { skill: 'Electronics', bars: ['note', 'photo', 'audio', 'vidéo', 'multi-cam', 'braindance', 'archive plein-sens'] },
    'VISION':     { skill: 'Cyber Tech', bars: ['lunettes', 'zoom', 'bas-niveau', 'infrarouge', 'thermographique', 'multi-spectral', 'vision totale'] },
    'ANALYZE':    { skill: 'Electronics', bars: ['jauge', 'détecteur simple', 'analyse chimique', 'diagnostic médical', 'détecteur de mensonge', 'scan profond', 'omniscient'] },
    'CLOAK':      { skill: 'Electronics', bars: ['peinture mate', 'anti-reflet', 'absorbe le radar', 'baffle IR', 'ablatif laser', 'furtif multi-spectral', 'signature nulle'] },
    'SEAL':       { skill: 'Basic Tech', bars: ['coupe-vent', 'étanche', 'masque à air', 'combi NBC', 'scaphandre', 'anti-pression', 'cycle fermé'] },
    'FLY':        { skill: 'AV Tech', bars: ['saut plané', 'glisse', 'jetpack court', 'hover', 'vol soutenu', 'supersonique', 'orbital'] },
    'HAUL':       { skill: 'Basic Tech', bars: ['sangle', 'sac de charge', 'treuil', 'grue', 'remorque', 'portique', 'levage lourd'] },
    'ILLUMINATE': { skill: 'Basic Tech', bars: ['lueur', 'lampe', 'torche', 'projecteur', 'illuminateur IR', 'strobe aveuglant', 'soleil portatif'] },
    'DEMOLISH':   { skill: 'Demolitions', bars: ['pétard', 'charge', 'C6', 'brèche dirigée', 'démolition', 'charge sculptée', 'rase un bloc'] },
    'BROADCAST':  { skill: 'Electronics', bars: ['talkie', 'radio', 'TV', 'faisceau serré', 'relais', 'maillage', 'couverture satellite'] },
    'TRANSLATE':  { skill: 'Electronics', bars: ['lexique', 'phrases', 'temps réel', 'argot', 'toutes langues', 'intention', 'façade télépathique'] },
    'STYLE':      { skill: 'Wardrobe & Style', bars: ['propre', 'soigné', 'urban flash', 'edgerunner', 'haute couture', 'icône', 'légende vivante'] },
    'SURVIVE':    { skill: 'Basic Tech', bars: ['briquet', 'kit de survie', 'abri', 'eau potable', 'autonomie longue', 'base mobile', 'écosystème'] },
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
    firearm: ['silencieux', 'viseur laser', 'lunette', 'red-dot', 'smartgun link', 'chargeur étendu', 'chargeur tambour', 'crosse pliante', 'compensateur de recul', 'lance-grenade sous-canon', 'bipied', 'conversion full-auto', 'détente à cheveu', 'munition perce-armure', 'munition HE', 'munition électrothermique', 'canon sans étui', 'finition sans empreintes'],
    armor: ['plaques d’insert (+SP)', 'couche ablative laser', 'déplacement thermique', 'absorbant radar', 'ignifugé', 'anti-stun (signal-retardant)', 'panneau vidéo/polychromique', 'stockage dissimulé'],
    cyber: ['smartgun link', 'option bas-niveau/IR/thermo', 'anti-éblouissement', 'blindage EMP', 'peau réaliste (realskin)', 'articulations verrouillables', 'portée étendue', 'pop-up/rétractable', 'os indétectable', 'compartiment creux', 'coût d’humanité réduit'],
    vehicle: ['blindage (+SP)', 'tourelle', 'plaques réactives', 'revêtement furtif', 'pneus increvables', 'vitres blindées', 'treuil', 'bélier renforcé', 'kit amphibie', 'pod d’armes', 'soute cargo', 'pilote auto', 'siège éjectable'],
    electronics: ['mémoire +MU', 'processeur rapide', 'blindage EMP', 'datashielding', 'chiffrement', 'uplink satellite', 'portée étendue', 'dead man’s handle', 'brouillage-proof'],
    general: ['finition custom', 'sans empreintes', 'qualité supérieure', 'miniaturisation', 'commande vocale', 'module GPS', 'abonnement de mise à jour', 'revêtement auto-nettoyant'],
  };
  var MOD_GROUPS = { weapon: ['firearm', 'general'], ammo: ['firearm'], cyberware: ['cyber', 'general'], vehicle: ['vehicle', 'general'], carrier: ['vehicle', 'electronics'], electronics: ['electronics', 'general'], data: ['electronics'], gear: ['armor', 'general'], drug: ['general'] };
  function modsFor(cls) { return (MOD_GROUPS[cls] || ['general']).map(function (g) { return { group: g, list: MODS[g] || [] }; }); }

  window.TechCatalog = {
    ANCHORS: ANCHORS, DOMAINS: DOMAINS, anchorOf: anchorOf, isKnownDomain: isKnownDomain, skillForDomain: skillForDomain,
    CLASSES: CLASSES, skillForClass: skillForClass,
    TOKENS: TOKENS, allTokens: allTokens, isStandard: isStandard,
    SUGGEST: SUGGEST, suggestFor: suggestFor,
    MODS: MODS, modsFor: modsFor,
    presets: presets, PRESETS: PRESETS,
  };
})();
