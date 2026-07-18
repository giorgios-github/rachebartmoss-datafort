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
    // ── STRIKE family: each launch/actuation SYSTEM is its own base-tree (WEAPON_SYSTEMS) ──
    ROCKET: { l: 'Rocket', cap: 'self-propelled projectile launcher', kids: [
      { l: 'Payload bay', cap: 'standard bay — takes mainstream non-explosive rockets (smoke, flare, recon, net)', kids: [
        { l: 'Warhead compat', add: true, cap: 'accepts HE / thermo / gas / smart heads' },
        { l: 'Bay caliber', sc: { max: 3, per: 'round size' }, cap: 'bigger rounds' },
        { l: 'Autoloader', add: true, cap: 'rotary magazine, fast reload', kids: [
          { l: 'Smart-select', act: 'lock-on', cap: 'choose the round per shot', kids: [
            { l: 'Deployables', act: 'seed', cap: 'launch mines / sensors / a micro-drone', kids: [
              { l: 'Cross-payload', need: 'node:SENSE', cap: 'delivers another effect: SENSE / HACK / INJECT / HEAL' }] }] }] },
        { l: 'Guided bus', add: true, act: 'lock-on', cap: 'fire-and-forget, retarget in flight' },
        { l: 'Modular bus', needsAll: ['payload-bay.autoloader', 'payload-bay.guided-bus'], arch: 'corpo', cap: 'any onboard system rides it — corpo logistics, OP' }] },
      { l: 'Warhead & fuze', cap: 'HE warhead + impact fuze — detonates on contact', kids: [
        { l: 'Blast radius', sc: { max: 3, per: 'area' }, cap: 'bigger area' },
        { l: 'Prox fuze', add: true, cap: 'airburst near the target' },
        { l: 'Shaped', add: true, cap: 'sculpt the blast: cone / ring / wall', kids: [
          { l: 'Cluster', cap: 'submunitions saturate a footprint', kids: [
            { l: 'Sequenced', cap: 'timed multi-blast — walk the fire' }] },
          { l: 'Persistent field', act: 'deny-zone', cap: 'fire / gas / EMP lingers', kids: [
            { l: 'Thermobaric', cap: 'over-pressure fills a room' }] }] },
        { l: 'Programmable airburst', needsAll: ['warhead-fuze.prox-fuze', 'warhead-fuze.shaped'], act: 'airburst', arch: 'corpo', cap: 'paint a volume, script it — corpo fire-control, OP' }] },
      { l: 'Heavy rail', cap: 'reinforced rail + dense core — heavy/fast rounds, beats light cover', kids: [
        { l: 'HEAT jet', sc: { max: 3, per: 'penetration' }, cap: 'deeper penetration' },
        { l: 'Tandem charge', add: true, cap: 'beats reactive armor' },
        { l: 'Kinetic dart', add: true, cap: 'no explosive — pure physics', kids: [
          { l: 'Material exotica', cap: 'depleted-U / monocrystal / thermic-lance warhead', kids: [
            { l: 'Overpressure-through', cap: 'punches the wall AND everything behind it' }] }] },
        { l: 'Fortress-killer', needsAll: ['heavy-rail.tandem-charge', 'heavy-rail.kinetic-dart'], arch: 'corpo', cap: 'one shot beats anything — exotic mfg, OP' }] },
      { l: 'Seeker head', cap: 'basic seeker — lock and it flies to the mark', kids: [
        { l: 'IR lock', add: true, cap: 'infra-red / contrast lock' },
        { l: 'Fire-and-forget', add: true, act: 'lock-on', cap: 'launch and forget', kids: [
          { l: 'Top-attack', cap: 'strikes from above', kids: [
            { l: 'Swarm-link', need: 'node:LINK', cap: 'a volley coordinates, splits targets' }] }] },
        { l: 'Predictive', add: true, need: 'node:COMPUTE', cap: 'leads an evading mark' },
        { l: 'Hunter-killer', needsAll: ['seeker-head.fire-and-forget', 'seeker-head.predictive'], act: 'hunt', arch: 'corpo', cap: 'loiters, picks its own target — corpo, OP' }] }] },

    CHEMICAL: { l: 'Chemical', cap: 'propellant slug-thrower — the classic gun', kids: [
      { l: 'Barrel & bore', cap: 'rifled barrel + chamber — accurate single shots', kids: [
        { l: 'Match bore', sc: { max: 3, per: 'accuracy' }, cap: 'tighter groups' },
        { l: 'Optic', add: true, cap: 'magnified / ranged sight', kids: [
          { l: 'Guided rounds', need: 'node:GUIDE', cap: 'fin-stabilized, course-correct' }] },
        { l: 'Long barrel', add: true, cap: 'more velocity & range', kids: [
          { l: 'Bull barrel', cap: 'anti-materiel precision', kids: [
            { l: 'Reach-beyond', cap: 'top-attack / curves past cover' }] }] },
        { l: 'Curve fire-control', needsAll: ['barrel-bore.optic', 'barrel-bore.long-barrel'], act: 'overwatch', arch: 'corpo', cap: 'hits past cover — corpo, OP' }] },
      { l: 'Feed & action', cap: 'box mag + auto action — lay down fire', kids: [
        { l: 'Cyclic rate', sc: { max: 3, per: 'rof' }, cap: 'faster fire' },
        { l: 'Belt feed', add: true, cap: 'sustained volume', kids: [
          { l: 'Rotary', cap: 'multi-barrel firehose' }] },
        { l: 'Select-fire', add: true, cap: 'semi / burst / auto', kids: [
          { l: 'Recoilless', cap: 'hold the volume on target' }] },
        { l: 'Area-suppression', needsAll: ['feed-action.belt-feed', 'feed-action.select-fire'], act: 'suppress', arch: 'corpo', cap: 'pins a zone — corpo, OP' }] },
      { l: 'Ammunition', cap: 'ball ammo — cheap, works', kids: [
        { l: 'AP', add: true, cap: 'armor-piercing rounds' },
        { l: 'Smart rounds', add: true, cap: 'airburst / programmable', kids: [
          { l: 'Homing micro-rounds', need: 'node:GUIDE', cap: 'each round steers to the mark' }] },
        { l: 'Payload rounds', act: 'inject', need: 'node:INJECT', cap: 'gas / EMP / inject on hit' },
        { l: 'Exotic magazine', needsAll: ['ammunition.smart-rounds', 'ammunition.ap'], arch: 'corpo', cap: 'any effect per round — corpo, OP' }] },
      { l: 'Signature', cap: 'suppressor mount — hides the shot', kids: [
        { l: 'Suppressed', sc: { max: 3, per: 'quiet' }, cap: 'quieter' },
        { l: 'Non-metallic', add: true, cap: 'passes scanners', kids: [
          { l: 'Disguised form', need: 'node:DISGUISE', cap: 'reads as a phone / umbrella' }] },
        { l: 'Flashless', add: true, cap: 'no muzzle flash' },
        { l: 'Ghost gun', needsAll: ['signature.non-metallic', 'signature.flashless'], act: 'silent-kill', arch: 'corpo', cap: 'untraceable, subsonic — corpo, OP' }] }] },

    ENERGY: { l: 'Directed energy', cap: 'directed-energy weapon (needs power)', need: 'power', kids: [
      { l: 'Emitter', cap: 'laser diode — a coherent beam that burns', kids: [
        { l: 'Focus', sc: { max: 3, per: 'tight/hot' }, cap: 'tighter, hotter' },
        { l: 'Sustained lase', add: true, act: 'burn', cap: 'burns through over time', kids: [
          { l: 'Wavelength tuning', cap: 'cut metal / flesh / cook chips selectively' }] },
        { l: 'Phased array', add: true, cap: 'several beams converge', kids: [
          { l: 'Relayed beam', cap: 'mirror-drones bounce it around cover' }] },
        { l: 'Coherent lance', needsAll: ['emitter.sustained-lase', 'emitter.phased-array'], arch: 'corpo', cap: 'industrial cutter, slices vehicles — corpo, OP' }] },
      { l: 'Discharge', cap: 'capacitor + arc gap — an electric shock', kids: [
        { l: 'Overcharge', sc: { max: 3, per: 'jolt' }, cap: 'bigger jolt' },
        { l: 'EMP mode', add: true, need: 'node:SHOCK', cap: 'fries electronics & cyber' },
        { l: 'Chained arc', add: true, sc: { max: 3, per: 'targets' }, cap: 'jumps between targets', kids: [
          { l: 'Ion field', cap: 'continuous electrical discharge' }] },
        { l: 'Ion storm', needsAll: ['discharge.emp-mode', 'discharge.chained-arc'], act: 'deny-zone', arch: 'corpo', cap: 'area electrical denial — corpo, OP' }] },
      { l: 'Reactor feed', cap: 'cell + regulator — how long & hot it runs', kids: [
        { l: 'High-density cell', sc: { max: 3, per: 'shots' }, cap: 'more shots' },
        { l: 'Micro-fusion', add: true, need: 'power', cap: 'near-unlimited', kids: [
          { l: 'Heat sink', cap: 'sustained fire without cook-off' }] },
        { l: 'Overdrive tap', add: true, cap: 'dump the reactor for one huge shot' },
        { l: 'Exotic core', needsAll: ['reactor-feed.micro-fusion', 'reactor-feed.overdrive-tap'], arch: 'corpo', cap: 'plasma / particle output — corpo, OP' }] }] },

    GAUSS: { l: 'Electromagnetic', cap: 'gauss / rail — magnetic launch, no propellant, quiet', kids: [
      { l: 'Rail assembly', cap: 'parallel rails — fling a slug magnetically', kids: [
        { l: 'Velocity', sc: { max: 3, per: 'muzzle' }, cap: 'faster slug' },
        { l: 'Rail cooling', add: true, cap: 'sustained fire' },
        { l: 'Hypervelocity', add: true, cap: 'ignores most armor', kids: [
          { l: 'Superconducting', cap: 'massive energy, silent', kids: [
            { l: 'Kinetic overmatch', cap: 'defeats anything by sheer speed' }] }] },
        { l: 'Mass driver', needsAll: ['rail-assembly.hypervelocity', 'rail-assembly.rail-cooling'], arch: 'corpo', cap: 'anti-vehicle rail cannon — corpo, OP' }] },
      { l: 'Coil stack', cap: 'induction coils — smooth accel, low signature', kids: [
        { l: 'Stages', sc: { max: 3, per: 'velocity' }, cap: 'more velocity' },
        { l: 'Silent op', add: true, cap: 'no report, no flash', kids: [
          { l: 'Recoil-nulled', cap: 'perfectly stable' }] },
        { l: 'Guided ferro', add: true, need: 'node:GUIDE', cap: 'ferro-rounds steer' },
        { l: 'Assassin coilgun', needsAll: ['coil-stack.silent-op', 'coil-stack.guided-ferro'], act: 'silent-kill', arch: 'corpo', cap: 'untraceable, curves the round — corpo, OP' }] },
      { l: 'Capacitor bank', cap: 'charge store — how much punch you dump', kids: [
        { l: 'High-capacity', sc: { max: 3, per: 'charge' }, cap: 'bigger charge' },
        { l: 'Overvolt', add: true, cap: 'one railgun-tier shot' },
        { l: 'Reactor-fed', add: true, need: 'power', cap: 'continuous feed' },
        { l: 'Sustained overvolt', needsAll: ['capacitor-bank.overvolt', 'capacitor-bank.reactor-fed'], arch: 'corpo', cap: 'a railgun that never stops — corpo, OP' }] }] },

    BLADE: { l: 'Kinetic', cap: 'edged / blunt / flexible — silent, hand-to-hand', kids: [
      { l: 'Edge', cap: 'a hardened blade — cuts and stabs', kids: [
        { l: 'Mono-edge', sc: { max: 3, per: 'sharp' }, cap: 'sharper' },
        { l: 'Vibro', add: true, cap: 'powered oscillation, cuts armor', kids: [
          { l: 'Superconductor edge', cap: 'cuts almost anything' }] },
        { l: 'Retractable', add: true, need: 'node:CONCEAL', cap: 'concealed deploy' },
        { l: 'Mantis blades', needsAll: ['edge.vibro', 'edge.retractable'], arch: 'corpo', cap: 'cyber-arm blades, cut vehicles — corpo, OP' }] },
      { l: 'Mass', cap: 'a weighted head — blunt force, staggers', kids: [
        { l: 'Impact', sc: { max: 3, per: 'force' }, cap: 'harder hits' },
        { l: 'Shock head', add: true, need: 'node:SHOCK', cap: 'stun on hit' },
        { l: 'Powered swing', add: true, cap: 'hydraulic force', kids: [
          { l: 'Kinetic amplifier', cap: 'multiplies the blow' }] },
        { l: 'Powered maul', needsAll: ['mass.shock-head', 'mass.powered-swing'], act: 'stagger', arch: 'corpo', cap: 'one-swing demolition — corpo, OP' }] },
      { l: 'Tether', cap: 'a flexible line — reach, entangle, pull', kids: [
        { l: 'Reach', sc: { max: 3, per: 'length' }, cap: 'longer' },
        { l: 'Monowire', add: true, act: 'dismember', cap: 'monofilament, dismembers' },
        { l: 'Motorized reel', add: true, cap: 'whip and retract', kids: [
          { l: 'Electrified line', need: 'node:SHOCK', cap: 'shocks on contact' }] },
        { l: 'Monowhip array', needsAll: ['tether.monowire', 'tether.motorized-reel'], act: 'dismember', arch: 'corpo', cap: 'cuts a crowd — corpo, OP' }] }] },

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

    'FILTER-AIR': { l: 'Filter air', cap: 'breathe in bad conditions', kids: [
      { l: 'Particulate cartridge', cap: 'mechanical filter — dust, sand, smoke', kids: [
        { l: 'Fineness', sc: { max: 3, per: 'fine particles' }, cap: 'finer filtration' },
        { l: 'Positive pressure', add: true, cap: 'keeps grit out even torn', kids: [
          { l: 'Auto-reload', cap: 'multi-cartridge rotation, lasts longer' }] },
        { l: 'Beacon', add: true, sc: { max: 3, per: 'perimeter' }, need: 'power', act: 'emit-zone', cap: 'a shared clean-air zone' },
        { l: 'Atmosphere processor', needsAll: ['particulate-cartridge.positive-pressure', 'particulate-cartridge.beacon'], arch: 'corpo', cap: 'cleans a whole street — corpo, OP' }] },
      { l: 'Chemical scrubber', cap: 'sorbent bed — neutralizes toxic gases', kids: [
        { l: 'Broad-spectrum', sc: { max: 3, per: 'toxins' }, cap: 'more toxins covered' },
        { l: 'Catalytic', add: true, cap: 'neutralizes, never saturates', kids: [
          { l: 'Regenerating bed', cap: 'bakes itself clean between exposures' }] },
        { l: 'Chem beacon', add: true, sc: { max: 3, per: 'perimeter' }, need: 'power', act: 'emit-zone', cap: 'a shared clean-air zone' },
        { l: 'CBRN dome', needsAll: ['chemical-scrubber.catalytic', 'chemical-scrubber.chem-beacon'], arch: 'corpo', cap: 'area chem / bio denial — corpo, OP' }] },
      { l: 'Sealed rebreather', cap: 'closed O₂ loop — carry your own air', kids: [
        { l: 'Duration', sc: { max: 3, per: 'hours' }, cap: 'lasts longer' },
        { l: 'Closed-cycle', add: true, cap: 'scrubs CO₂, recycles O₂', kids: [
          { l: 'Mixed-gas', cap: 'trimix — depth-rated' }] },
        { l: 'Bioreactor', add: true, need: 'power', cap: 'makes O₂ on the go' },
        { l: 'Indefinite life-support', needsAll: ['sealed-rebreather.closed-cycle', 'sealed-rebreather.bioreactor'], arch: 'corpo', cap: 'days sealed — corpo deep-env, OP' }] }] },

    SHIELD: { l: 'Shield', cap: 'ward off a hit', kids: [
      { l: 'Reactive plating', cap: 'hard plates that brace an impact', kids: [
        { l: 'Trauma plates', add: true, cap: 'stacks with treatments' },
        { l: 'Reactive tiles', add: true, cap: 'pop out, beat HEAT', kids: [
          { l: 'Adaptive', cap: 'hardens where hit, flexible elsewhere' }] },
        { l: 'Self-repairing', add: true, cap: 'nanite lattice re-knits cracks' },
        { l: 'Moving fortress', needsAll: ['reactive-plating.reactive-tiles', 'reactive-plating.self-repairing'], arch: 'corpo', cap: 'a walking bunker — corpo powered-armor, OP' }] },
      { l: 'EM field', cap: 'energy field that slows projectiles (needs power)', need: 'power', kids: [
        { l: 'Kinetic buffer', sc: { max: 3, per: 'coverage' }, cap: 'stops bullets' },
        { l: 'Bubble', add: true, cap: 'extends to allies nearby' },
        { l: 'Phased', add: true, cap: 'tuned per threat type', kids: [
          { l: 'Overcharge dump', cap: 'absorb a big hit, then reboot' }] },
        { l: 'Deflector dome', needsAll: ['em-field.bubble', 'em-field.phased'], act: 'ward-zone', arch: 'corpo', cap: 'an area shield — corpo, OP' }] },
      { l: 'Datafort ward', cap: 'NET barrier — equip a fort, defends net-space', bridge: 'net', kids: [
        { l: 'Firewall level', sc: { max: 4, per: 'strength' }, cap: 'stronger wall' },
        { l: 'Active ICE', add: true, cap: 'strikes back at hackers', kids: [
          { l: 'Blackwall shard', cap: 'lethal counter-intrusion' }] },
        { l: 'Self-healing net', add: true, cap: 're-locks breached nodes' },
        { l: 'AI sentinel', needsAll: ['datafort-ward.active-ice', 'datafort-ward.self-healing-net'], arch: 'corpo', cap: 'autonomous fort defense — corpo, OP' }] }] },

    MOVE: { l: 'Move', cap: 'get around', kids: [
      { l: 'Actuators', cap: 'powered limb actuators — faster, higher jump (+1 MA)', kids: [
        { l: 'Combat reflexes', sc: { max: 3, per: 'reaction' }, cap: 'act first in a fight', kids: [
          { l: 'Reaction override', cap: 'reflexes bypass conscious lag', kids: [
            { l: 'Kerenzikov', cap: 'a burst of reflex speed on trigger', kids: [
              { l: 'Time-slice', cap: 'perceive combat in slow-motion', kids: [
                { l: 'Sandevistan', arch: 'corpo', cap: 'seconds of hyper-speed — corpo boostware, OP' }] }] }] }] },
        { l: 'Wall-run', act: 'climb', cap: 'run up vertical surfaces', kids: [
          { l: 'Shock-absorbers', add: true, cap: 'no fall damage' },
          { l: 'Free-runner', cap: 'chains parkour moves fluidly', kids: [
            { l: 'Silent servos', need: 'node:CONCEAL', cap: 'fast AND whisper-quiet', kids: [
              { l: 'Neural sync', cap: 'the body moves at the speed of thought', kids: [
                { l: 'Spider frame', arch: 'corpo', cap: 'any surface, any angle, unheard — a few corps build these, OP' }] }] }] }] },
        { l: 'Load frame', cap: 'carry heavy AND stay mobile', kids: [
          { l: 'Servo-assist', cap: 'multiplies strength', kids: [
            { l: 'Gyro-balance', add: true, cap: 'never knocked down' },
            { l: 'Milspec frame', cap: 'battlefield-hardened', kids: [
              { l: 'Powered chassis', cap: 'a full wearable frame', kids: [
                { l: 'Exo-skeleton', arch: 'corpo', cap: 'a walking tank — corpo powered-armor, OP' }] }] }] }] }] },
      { l: 'Drive system', cap: 'wheels / treads / thrust — sustained ground speed (+2 MA)', kids: [
        { l: 'Sprint', sc: { max: 3, per: 'top speed' }, cap: 'faster', kids: [
          { l: 'Boost', act: 'dash', cap: 'a burst of speed on demand', kids: [
            { l: 'Predictive traction', need: 'node:COMPUTE', cap: 'corners impossibly', kids: [
              { l: 'Reactor drive', need: 'power', cap: 'inexhaustible output', kids: [
                { l: 'Leopard drive', arch: 'corpo', cap: 'outruns any pursuit vehicle — corpo racing tech, OP' }] }] }] }] },
        { l: 'All-terrain', cap: 'treads / legs hybrid', kids: [
          { l: 'Amphibious', add: true, cap: 'water-capable' },
          { l: 'Climb-treads', cap: 'scales walls & rubble', kids: [
            { l: 'Sealed drivetrain', cap: 'mud / sand / vacuum proof', kids: [
              { l: 'Autopilot', need: 'node:COMPUTE', cap: 'drives itself', kids: [
                { l: 'All-domain drive', arch: 'corpo', cap: 'land / water / vertical, unstoppable — corpo mil, OP' }] }] }] }] }] },
      { l: 'Lift', cap: 'a lift surface / micro-thrust — glide & hop (needs power)', need: 'power', kids: [
        { l: 'Glide', sc: { max: 3, per: 'range' }, cap: 'farther glide', kids: [
          { l: 'Wingsuit', cap: 'true horizontal flight, descending', kids: [
            { l: 'Ram-air canopy', add: true, cap: 'steer & flare a landing' },
            { l: 'Stealth glider', need: 'node:CLOAK', cap: 'radar-silent descent', kids: [
              { l: 'Powered assist', cap: 'extend the glide under thrust', kids: [
                { l: 'Ghost glider', arch: 'corpo', cap: 'a silent HALO insertion rig — corpo black-ops, OP' }] }] }] }] },
        { l: 'Hop-jets', cap: 'short boosted jumps', kids: [
          { l: 'Hover', cap: 'sustained low altitude, VTOL', kids: [
            { l: 'Vector thrust', add: true, cap: 'precise maneuvering' },
            { l: 'Sustained flight', cap: 'true flight — heavy power draw', kids: [
              { l: 'High-altitude', cap: 'supersonic ceiling', kids: [
                { l: 'Orbital launch', arch: 'corpo', cap: 'a suborbital hop — maybe three corporations master this, OP' }] }] }] }] },
        { l: 'Anti-grav lifter', cap: 'exotic — shrug off gravity to hover', kids: [
          { l: 'Field hover', cap: 'a stable grav cushion', kids: [
            { l: 'Null-weight', cap: 'effectively weightless', kids: [
              { l: 'Inertia damper', cap: 'no momentum — turns on a dime', kids: [
                { l: 'Grav drive', arch: 'corpo', cap: 'silent, inertia-less flight — bleeding-edge corpo, OP' }] }] }] }] }] }] },
  };
  var WEAPON_SYSTEMS = ['ROCKET', 'CHEMICAL', 'ENERGY', 'GAUSS', 'BLADE'];   // the STRIKE family (each its own base-tree)

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
    // a convergence renders one row BELOW its deepest requirement (a culmination, not a sibling)
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id]; if (!n.needsAll || !n.needsAll.length) return;
      var mx = n.needsAll.reduce(function (m, r) { return nodes[r] ? Math.max(m, nodes[r].tier) : m; }, 0);
      if (mx + 1 > n.tier) n.tier = mx + 1;
    });
    var bt = {}; Object.keys(nodes).forEach(function (id) { (bt[nodes[id].tier] || (bt[nodes[id].tier] = [])).push(id); }); byTier = bt;
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
  // GRADE = accumulation of FEATURES, not depth. Each active node weighs (base + a bit
  // for how deep/sophisticated it is); a corpo/OP node (arch) is a jump to g6. Tunable.
  var GRADE = { base: 1, perTier: 0.6, thresholds: [1.5, 3.5, 6, 9, 13] };  // raw < thresholds[i] → grade i+1
  function grade(g, path) {
    var ids = activeIds(path); if (!ids.length) return 0;
    var ceiling = 0, raw = 0, corpo = false;
    ids.forEach(function (id) { var n = g.nodes[id]; if (!n) return; ceiling = Math.max(ceiling, n.tier); raw += GRADE.base + Math.max(0, n.tier - 1) * GRADE.perTier; if (n.arch) corpo = true; });
    if (corpo) return 6;                                    // corpo-monopoly tech → top grade
    var th = GRADE.thresholds, breadth = th.length + 1;     // how MANY / how advanced features are stacked
    for (var i = 0; i < th.length; i++) { if (raw < th[i]) { breadth = i + 1; break; } }
    // grade = the more damning of: the sophistication of your DEEPEST feature, or the BREADTH of the build
    return Math.max(1, Math.min(6, Math.max(ceiling, breadth)));
  }
  function tips(g, path) { var a = activeIds(path); return a.filter(function (id) { return !(g.nodes[id].kids || []).some(function (k) { return a.indexOf(k) >= 0; }); }); }
  function crumbs(g, path) { return tips(g, path).map(function (id) { return ancestors(g, id).map(function (x) { return g.nodes[x].label; }).join(' › '); }); }
  function collect(g, path, key) { var out = []; activeIds(path).forEach(function (id) { var n = g.nodes[id]; if (n && n[key] && out.indexOf(n[key]) < 0) out.push(n[key]); }); return out; }

  window.TechTrees = { TREES: TREES, WEAPON_SYSTEMS: WEAPON_SYSTEMS, has: hasTree, get: build, layout: layout,
    kindOf: kindOf, pickable: pickable, isActive: isActive, activeIds: activeIds, ancestors: ancestors,
    toggle: toggle, scaleOf: scaleOf, setScale: setScale, pathTier: pathTier, grade: grade, tips: tips, crumbs: crumbs, collect: collect };
})();
