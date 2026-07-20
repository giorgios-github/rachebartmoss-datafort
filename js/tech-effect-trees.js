/* tech-effect-trees.js — EFFECT TREES (cran 5 · replaces the flat grade ladder).
   An effect is no longer a scalar grade — it's a PATH walked down a per-domain tree.
   tier (= depth from root) IS the old grade, kept as an annotation.

   Authoring: a nested literal per domain (short keys, dense to write):
     { l:label, cap:caption, act:action, tag:addon-filter, need:requires,
       sc:{max,per} (° dial), add:true (□ stackable), needsAll:[ids] (⬡ convergence),
       arch:archetype-name (corpo g6 end-state), bridge:'net'|'data',
       need:'node:DOMAIN@g' (HARD cross-effect dep), takes:'class' (grants a mount slot), kids:[…] }
   Domains without an authored tree fall back to a LINEAR spine built from
   TechCatalog.ANCHORS[domain].bars — i.e. the old g1..g6 ladder, verbatim.

   SELECTION MODEL — exclusive-first, with convergences as the recombination valve:
   siblings are exclusive by default (pick one); `add:true` makes a stackable option; a
   ⬡ convergence, when picked, PULLS its `needsAll` requirements in from wherever they live
   (suspending exclusivity for the pulled chains) — this is the ONLY way two otherwise
   exclusive branches hold together. A sweep drops any ⬡ that loses a requirement.

   Exposes window.TechTrees { get(domain) → graph, layout(graph) → positioned }. */
(function () {
  'use strict';
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64) || 'n'; }

  // ── authored trees: roots, not weeping willows — fork after g1, keep forking to g6 (corpo end-states) ──
  var TREES = {
    // ── STRIKE family: each weapon SYSTEM is its own base-tree (WEAPON_SYSTEMS) ──
    ROCKET: { l: 'Rocket', cap: 'lob a self-propelled munition at a target', kids: [
      { l: 'Payload bay', cap: 'a standard launch tube — takes mainstream non-explosive rockets', act: 'launch', tag: 'munition', kids: [
        { l: 'Salvo rack', cap: 'volley several tubes at once', sc: { max: 6, per: 'tube' }, kids: [
          { l: 'Ripple fire', cap: 'stagger the salvo to walk fire across an area', act: 'saturate', kids: [
            { l: 'Area denial', cap: 'blanket a zone with submunitions', act: 'deny-zone', kids: [
              { l: 'Cluster dispenser', cap: 'each rocket splits into bomblets', kids: [
                { l: 'Steel-rain battery', arch: 'corpo', cap: 'a self-cueing saturation battery — clears a block, OP corpo artillery' }] }] }] },
          { l: 'Reload cassette', add: true, cap: 'snap-in cassette for fast follow-up volleys' }] },
        { l: 'Micro-missile pod', cap: 'many tiny guided darts instead of one rocket', sc: { max: 8, per: 'dart' }, kids: [
          { l: 'Swarm logic', cap: 'darts share targets so none double-hits', need: 'node:LINK', act: 'swarm', kids: [
            { l: 'Cooperative swarm', cap: 'the swarm re-tasks itself mid-flight', kids: [
              { l: 'Hive-missile cloud', arch: 'corpo', cap: 'a self-organizing kill-cloud that thinks — OP, two or three corps only' }] }] }] },
        { l: 'Recoilless mount', cap: 'back-blast vents so it fires from the shoulder', need: 'mount' }] },
      { l: 'Guidance', cap: 'a basic seeker head — steers toward a heat source', act: 'lock-on', tag: 'seeker', kids: [
        { l: 'IR seeker', cap: 'homes on engine/body heat, fire-and-forget', kids: [
          { l: 'Imaging IR', cap: 'sees a heat picture, picks the weak spot', kids: [
            { l: 'Counter-flare logic', cap: 'ignores decoy flares and hot clutter', need: 'node:SENSE', kids: [
              { l: 'Multi-mode seeker', cap: 'blends IR, radar and optical for a lock nothing shakes', needsAll: ['guidance.ir-seeker.imaging-ir', 'guidance.radar-seeker'], kids: [
                { l: 'Never-miss seeker', arch: 'corpo', cap: 'a seeker no countermeasure defeats — OP corpo bleeding-edge' }] }] }] }] },
        { l: 'Radar seeker', cap: 'active radar homing, works in smoke and dark', act: 'track', kids: [
          { l: 'Home-on-jam', cap: 'rides an enemy jammer straight back to it', need: 'node:JAM', kids: [
            { l: 'Anti-radiation kill', cap: 'kills emitters that light it up', act: 'silent-kill' }] }] },
        { l: 'Beam-rider', cap: 'follows a painted laser to the aim point', need: 'node:SENSE', kids: [
          { l: 'Fiber tether', cap: 'trails a data fiber for man-in-loop steering', bridge: 'data', kids: [
            { l: 'Round-corner shot', cap: 'flies a curved path to hit behind cover', act: 'flank' }] }] }] },
      { l: 'Warhead & fuze', cap: 'a shaped charge with an impact fuze', act: 'burn', tag: 'warhead', kids: [
        { l: 'Shaped', cap: 'focused jet punches armor', kids: [
          { l: 'Tandem', cap: 'a precursor pops reactive armor, the main jet finishes it', kids: [
            { l: 'Top-attack', cap: 'pops up and dives onto the thin roof', act: 'silent-kill', needsAll: ['warhead-fuze.shaped.tandem', 'guidance.ir-seeker.imaging-ir'], kids: [
              { l: 'Bunker-cracker', arch: 'corpo', cap: 'a smart tandem that defeats any known armor — OP corpo ordnance' }] }] }] },
        { l: 'Thermobaric', add: true, cap: 'a pressure/heat blast that fills enclosed spaces', act: 'burn' },
        { l: 'MIRV bus', cap: 'the warhead splits into independently aimed re-entry darts', sc: { max: 4, per: 'sub' }, kids: [
          { l: 'Precision bus', cap: 'each sub-munition picks its own target', needsAll: ['warhead-fuze.mirv-bus', 'guidance.radar-seeker'], kids: [
            { l: 'Decapitation strike', arch: 'corpo', cap: 'one launch, many pinpoint kills — OP corpo first-strike weapon' }] }] }] },
      { l: 'Motor', cap: 'a solid rocket motor — short, fast burn', need: 'power', kids: [
        { l: 'Boost-sustain', cap: 'a hard kick then a long cruise for reach', sc: { max: 3, per: 'range' }, kids: [
          { l: 'Ramjet', cap: 'air-breathing cruise — very long legs at speed', kids: [
            { l: 'Boost-glide', cap: 'lofts high then glides down from over the horizon', kids: [
              { l: 'Over-horizon strike', arch: 'corpo', cap: 'a suborbital-lofted precision shot — maybe three corps master it, OP' }] }] }] },
        { l: 'Soft-launch', add: true, cap: 'ejects cold then lights up — safe to fire from inside a room' }] }] },

    CHEMICAL: { l: 'Chemical', cap: 'a propellant-driven slug-thrower', kids: [
      { l: 'Barrel & chamber', cap: 'a rifled barrel + chamber — accurate single shots', act: 'aim', tag: 'barrel', kids: [
        { l: 'Match barrel', cap: 'tight tolerances for long-range precision', kids: [
          { l: 'Free-float heavy', cap: 'bull barrel, no flex under sustained fire', kids: [
            { l: 'Anti-materiel bore', cap: 'big-bore round defeats hard cover and light vehicles', act: 'silent-kill', kids: [
              { l: 'Whisper-kill rig', cap: 'suppressed, subsonic, one-shot precision', needsAll: ['barrel-chamber.match-barrel', 'fire-control.smartlink'], kids: [
                { l: 'Ghost-marksman system', arch: 'corpo', cap: 'a self-ranging silent sniper suite that never misses cold — OP corpo' }] }] }] }] },
        { l: 'Multi-barrel', cap: 'clustered barrels for a wall of lead', kids: [
          { l: 'Rotary', cap: 'spun barrels sustain a firehose rate', sc: { max: 6, per: 'rpm-stage' }, act: 'suppress', kids: [
            { l: 'Auto-cooled', cap: 'active cooling lets it fire without cook-off', need: 'power', kids: [
              { l: 'Squad shredder', arch: 'corpo', cap: 'a man-portable rotary that outputs vehicle-mount fire — OP corpo' }] }] }] },
        { l: 'Bullpup compact', cap: 'full-length barrel in a short frame — concealable carbine', need: 'node:CONCEAL' }] },
      { l: 'Feed & action', cap: 'a box magazine + gas action — reliable repeat fire', tag: 'feed', kids: [
        { l: 'High-capacity', cap: 'drum/belt feed for long strings', sc: { max: 5, per: 'belt' }, kids: [
          { l: 'Dual-feed', cap: 'switch ammo types on the fly', add: true, kids: [
            { l: 'Selectable lethality', cap: 'flip between lethal and less-lethal instantly', act: 'stun' }] }] },
        { l: 'Caseless action', cap: 'burnt-case rounds — no ejection, higher rate, sealed', need: 'seal', kids: [
          { l: 'Hyperburst', cap: 'a 3-round stack leaves the barrel before recoil moves it', kids: [
            { l: 'Recoil-null frame', cap: 'counter-mass cancels kick for laser-flat auto fire', need: 'node:MOVE' }] }] },
        { l: 'Corner mount', cap: 'articulated frame + camera shoots around cover', need: 'node:SENSE', act: 'flank' }] },
      { l: 'Ammunition', cap: 'standard ball ammo — versatile and cheap', tag: 'ammo', kids: [
        { l: 'AP core', cap: 'a penetrator core punches armor', add: true, kids: [
          { l: 'Discarding sabot', cap: 'sub-caliber dart, flat and fast', kids: [
            { l: 'Depleted-exotic slug', cap: 'ultra-dense round shrugs off hard plate', act: 'burn' }] }] },
        { l: 'Smart round', cap: 'a guided/airburst projectile', need: 'node:LINK', act: 'lock-on', kids: [
          { l: 'Airburst', cap: 'detonates over cover to hit hiding targets', act: 'deny-zone', kids: [
            { l: 'Programmable link', cap: 'the sight tells each round where to burst', needsAll: ['ammunition.smart-round.airburst', 'fire-control.smartlink'], kids: [
              { l: 'Guided-swarm ammo', arch: 'corpo', cap: 'rounds that curve mid-air to any tagged target — OP corpo smart-ammo' }] }] }] },
        { l: 'Beanbag/gel', add: true, cap: 'less-lethal loads for takedowns', act: 'stun' }] },
      { l: 'Fire-control', cap: 'iron sights + a basic red dot', tag: 'optics', kids: [
        { l: 'Smartlink', cap: 'wired sight overlays aim point in your vision', need: 'node:SENSE', act: 'lock-on', kids: [
          { l: 'Ballistic computer', cap: 'auto-adjusts for range, wind and lead', kids: [
            { l: 'Threat auto-track', cap: 'flags and follows targets for you', need: 'node:HACK', kids: [
              { l: 'Gauss-assist barrel', cap: 'EM coils goose muzzle velocity past chemical limits', needsAll: ['fire-control.smartlink.ballistic-computer', 'ammunition.ap-core.discarding-sabot'], need: 'node:GAUSS', kids: [
                { l: 'Hybrid overwatch gun', arch: 'corpo', cap: 'a self-aiming chem/EM hybrid that fires itself on cue — OP corpo' }] }] }] }] }] }] },

    ENERGY: { l: 'Energy', cap: 'a directed-energy weapon', need: 'power', kids: [
      { l: 'Laser', cap: 'a coherent beam — burns on contact, no drop or lead', act: 'burn', tag: 'emitter', kids: [
        { l: 'Pulse laser', cap: 'hammer pulses that spall armor', kids: [
          { l: 'Beam focus', cap: 'tighter spot for deeper burn', sc: { max: 4, per: 'focus' }, kids: [
            { l: 'Adaptive optics', cap: 'corrects for smoke, haze and shimmer', need: 'node:SENSE', kids: [
              { l: 'Phased array', cap: 'no moving parts — steers and splits the beam electronically', needsAll: ['laser.pulse-laser.beam-focus', 'power-thermal.capacitor-stack'], kids: [
                { l: 'X-ray laser', arch: 'corpo', cap: 'a short-wavelength beam that ignores most armor — OP, two or three corps' }] }] }] }] },
        { l: 'Blinding pulse', add: true, cap: 'a wide flash to dazzle optics and eyes', act: 'stun', need: 'node:JAM' },
        { l: 'Cutting beam', cap: 'a slow continuous beam for breaching', act: 'burn' }] },
      { l: 'Plasma', cap: 'a bolt of superheated matter — brutal, short-ranged', act: 'burn', tag: 'emitter', kids: [
        { l: 'Magnetic bottle', cap: 'field confines the bolt so it flies farther', need: 'seal', kids: [
          { l: 'Plasma lance', cap: 'a sustained jet for cutting through anything', act: 'silent-kill', kids: [
            { l: 'Fusion-fed lance', cap: 'a fusion cell feeds a torch that melts vault doors', needsAll: ['plasma.magnetic-bottle.plasma-lance', 'power-thermal.fusion-cell'], kids: [
              { l: 'Star-cutter', arch: 'corpo', cap: 'a portable fusion torch nothing survives — OP corpo bleeding-edge' }] }] }] },
        { l: 'Splash bolt', cap: 'bursts on impact, sprays a wide burn', act: 'deny-zone' }] },
      { l: 'Microwave', cap: 'a high-power microwave cone — fries electronics, cooks flesh', act: 'pulse', tag: 'emitter', kids: [
        { l: 'Pain ray', cap: 'a non-lethal heat cone that drives crowds back', act: 'deny-zone', kids: [
          { l: 'Focused HPM', cap: 'a tight beam that soft-kills a single device', need: 'node:JAM', act: 'silent-kill', kids: [
            { l: 'System-melter', arch: 'corpo', cap: 'a beam that cooks hardened milspec electronics through shielding — OP corpo' }] }] }] },
      { l: 'Particle beam', cap: 'a stream of accelerated particles — deep, armor-ignoring damage', act: 'burn', tag: 'emitter', kids: [
        { l: 'Neutral beam', cap: 'uncharged stream isn\'t bent by fields or wind', kids: [
          { l: 'Charge injector', cap: 'raises current for lethal dose per shot', sc: { max: 3, per: 'stage' }, need: 'power', kids: [
            { l: 'Annihilator lance', arch: 'corpo', cap: 'a beam that irradiates and kills through any armor — OP, corps only' }] }] }] },
      { l: 'Power & thermal', cap: 'a battery + heat-sink core that gates all emitters', tag: 'core', kids: [
        { l: 'Capacitor stack', cap: 'stores charge for bigger shots', add: true, sc: { max: 4, per: 'cell' } },
        { l: 'Heat sink', cap: 'buffers waste heat so you can fire more before overheat', add: true, sc: { max: 3, per: 'sink' } },
        { l: 'Fusion cell', cap: 'an exotic micro-fusion source — near-unlimited shots', need: 'seal', kids: [
          { l: 'Overcharge governor', cap: 'safely dumps a full cell into one apocalyptic shot', act: 'burn' }] }] }] },

    GAUSS: { l: 'Gauss', cap: 'an electromagnetic mass driver — no propellant, no muzzle flash', need: 'power', kids: [
      { l: 'Coilgun', cap: 'staged coils pull a slug — near-silent, no report', act: 'silent-kill', tag: 'driver', kids: [
        { l: 'Add stages', cap: 'more coils = more muzzle velocity', sc: { max: 6, per: 'stage' }, kids: [
          { l: 'Timing chip', cap: 'precise coil timing wrings out max efficiency', need: 'node:HACK', kids: [
            { l: 'Superconducting coils', cap: 'lossless coils reach absurd velocity cold', need: 'seal', kids: [
              { l: 'Silent driver core', cap: 'a whisper-quiet driver with railgun energy', needsAll: ['coilgun.add-stages.timing-chip', 'railgun.rail-pair'], kids: [
                { l: 'Wraith rifle', arch: 'corpo', cap: 'a silent hypervelocity rifle with zero signature — OP corpo assassination tool' }] }] }] }] },
        { l: 'Variable power', add: true, cap: 'dial velocity down for less-lethal or up for armor', act: 'stun' }] },
      { l: 'Railgun', cap: 'twin rails hurl a slug at hypervelocity — huge energy, brutal wear', act: 'burn', tag: 'driver', kids: [
        { l: 'Rail pair', cap: 'the base conducting rails — raw, punishing power', kids: [
          { l: 'Ablation liner', cap: 'sacrificial liner keeps rails alive under fire', add: true, kids: [
            { l: 'Plasma armature', cap: 'a plasma bridge boosts efficiency past solid contact', need: 'seal', kids: [
              { l: 'Hypervelocity lance', arch: 'corpo', cap: 'a slug so fast it kills by shockwave alone — OP corpo anti-armor' }] }] }] },
        { l: 'Arc suppressor', cap: 'tames the muzzle arc-flash and EM bloom', need: 'node:CONCEAL' }] },
      { l: 'Projectile', cap: 'a ferrous flechette — the standard EM round', tag: 'ammo', kids: [
        { l: 'Fin-stabilized dart', cap: 'long dart stays true at hypervelocity', kids: [
          { l: 'Guided fin', cap: 'tiny fins steer the dart in flight', need: 'node:LINK', act: 'lock-on', kids: [
            { l: 'Smart flechette burst', cap: 'one shot fragments into steered darts', needsAll: ['projectile.fin-stabilized-dart.guided-fin', 'coilgun.add-stages'] }] }] },
        { l: 'Frangible slug', add: true, cap: 'shatters on hard cover — no over-penetration indoors' }] },
      { l: 'Power & recoil', cap: 'the capacitor bank + recoil frame that feeds the driver', tag: 'core', kids: [
        { l: 'Capacitor bank', cap: 'stores charge for higher-energy shots', add: true, sc: { max: 5, per: 'cell' } },
        { l: 'Counter-mass', cap: 'recoil compensation for shoulder fire', need: 'mount', kids: [
          { l: 'Inertial dampers', cap: 'active dampers cancel brutal recoil entirely', need: 'node:MOVE' }] }] }] },

    BLADE: { l: 'Blade', cap: 'a hand-to-hand kinetic weapon', kids: [
      { l: 'Edged', cap: 'a rigid edged blade — cut, thrust, parry', act: 'silent-kill', tag: 'edge', kids: [
        { l: 'Powered edge', cap: 'a vibro/serrated edge saws through armor', need: 'power', kids: [
          { l: 'Mantis blades', cap: 'concealed cyber-arm blades — surprise reach', need: 'injector', tag: 'cyberware', kids: [
            { l: 'Extending reach', cap: 'telescoping blades strike from a step away', sc: { max: 3, per: 'reach' }, kids: [
              { l: 'Mono-edged mantis', cap: 'monomolecular mantis blades cleave anything', needsAll: ['edged.powered-edge.mantis-blades', 'monowire.mono-edge'], kids: [
                { l: 'Plasma-edge mantis', arch: 'corpo', cap: 'sheathed-plasma cyber-blades that cut vault steel — OP corpo chrome' }] }] }] }] },
        { l: 'Guard/parry', add: true, cap: 'a guard that turns aside incoming blades', act: 'block' }] },
      { l: 'Monowire', cap: 'a monomolecular wire — invisibly thin, cuts flesh and bone', act: 'silent-kill', tag: 'wire', kids: [
        { l: 'Mono-edge', cap: 'a taut mono-edge for slashing cuts', kids: [
          { l: 'Weighted whip', cap: 'a flexible garrote/whip that wraps and severs', act: 'flank', kids: [
            { l: 'Spool reel', cap: 'reels out for reach then snaps back', sc: { max: 3, per: 'reach' }, kids: [
              { l: 'Reactive-web garrote', cap: 'a smart wire that seeks the gap in armor', need: 'node:SENSE', kids: [
                { l: 'Ghost-wire', arch: 'corpo', cap: 'a sensor-guided monowire net that dismembers a room — OP corpo' }] }] }] }] }] },
      { l: 'Impact', cap: 'a blunt shock weapon — breaks armor and bone', act: 'stun', tag: 'impact', kids: [
        { l: 'Kinetic hammer', cap: 'a piston head that delivers a delayed crushing blow', need: 'power', kids: [
          { l: 'Shock discharge', cap: 'dumps a stun charge on contact', need: 'node:JAM', act: 'stun', kids: [
            { l: 'Concussive maul', cap: 'a shockwave head that shatters plate and rings ears', kids: [
              { l: 'Quake-fist', arch: 'corpo', cap: 'a cyber-arm that flattens cover with one strike — OP corpo' }] }] }] },
        { l: 'Riot shield edge', add: true, cap: 'a bash edge that lets you push and stun', act: 'block' }] },
      { l: 'Boostware', cap: 'reflex-boost chrome — you simply move faster than they do', need: 'injector', tag: 'cyberware', kids: [
        { l: 'Wired reflexes', cap: 'sped-up reactions for extra strikes', act: 'flank', kids: [
          { l: 'Sandevistan burst', cap: 'a short slice of hyper-speed on demand', need: 'power', kids: [
            { l: 'Kerenzikov combo', cap: 'chains strikes in a stretched instant', kids: [
              { l: 'Time-slice killer', arch: 'corpo', cap: 'a black-market reflex suite that clears a room before anyone reacts — OP corpo boostware' }] }] }] }] }] },

    ARMOR: { l: 'Armor', cap: 'stop a hit before it stops you', kids: [
      { l: 'Hard plate', cap: 'rigid trauma plate — defeats rifle rounds', tag: 'plate', kids: [
        { l: 'Layered plate', cap: 'more layers for more coverage', sc: { max: 4, per: 'zone' }, kids: [
          { l: 'Ceramic strike-face', cap: 'shatters incoming penetrators', kids: [
            { l: 'Exotic composite', cap: 'ultra-light lattice stops anti-materiel rounds', need: 'seal', kids: [
              { l: 'Sloped monobloc', cap: 'one seamless deflecting shell — no weak seams', kids: [
                { l: 'Immovable carapace', arch: 'corpo', cap: 'a plate nothing man-portable can defeat — OP corpo milspec' }] }] }] }] },
        { l: 'Trauma pad', add: true, cap: 'backing that spreads blunt force so hits don\'t break bone' }] },
      { l: 'Soft weave', cap: 'flexible ballistic cloth — concealable everyday protection', need: 'node:CONCEAL', tag: 'weave', kids: [
        { l: 'Shear-thick gel', cap: 'stiffens instantly on impact', kids: [
          { l: 'Full bodysuit', cap: 'seamless coverage under normal clothes', kids: [
            { l: 'Second-skin weave', cap: 'armor thin enough to pass a pat-down', kids: [
              { l: 'Ghost-suit', arch: 'corpo', cap: 'street-clothes that stop rifle fire invisibly — OP corpo' }] }] }] }] },
      { l: 'Reactive', cap: 'armor that fights back at the moment of impact', need: 'power', tag: 'active', kids: [
        { l: 'ERA tiles', cap: 'blow-plates that disrupt shaped charges', add: true, kids: [
          { l: 'Electro-reactive', cap: 'a charged layer vaporizes penetrators', need: 'seal', kids: [
            { l: 'Predictive plate', cap: 'a sensor fires the tile just before contact', need: 'node:SENSE', kids: [
              { l: 'Active-defense skin', arch: 'corpo', cap: 'armor that pre-empts every hit it detects — OP corpo' }] }] }] }] },
      { l: 'Beam-diffuse', cap: 'a reflective/ablative layer that sheds energy weapons', need: 'node:ENERGY', tag: 'reflec', kids: [
        { l: 'Mirror coat', cap: 'scatters laser energy', kids: [
          { l: 'Ablative foam', cap: 'boils away to carry off heat', add: true, kids: [
            { l: 'Heat-spread lattice', cap: 'wicks a beam\'s heat across the whole shell', kids: [
              { l: 'Mirror carapace', cap: 'reflec + heat-spread beats sustained beams', needsAll: ['beam-diffuse.mirror-coat', 'beam-diffuse.mirror-coat.ablative-foam'], kids: [
                { l: 'Beam-proof shell', arch: 'corpo', cap: 'armor that laughs off directed energy — OP corpo' }] }] }] }] }] },
      { l: 'Powered exo', cap: 'a strength frame that carries armor a body couldn\'t', need: 'node:MOVE', tag: 'exo', kids: [
        { l: 'Load frame', cap: 'bear heavy plate without fatigue', sc: { max: 3, per: 'load' }, kids: [
          { l: 'Servo assist', cap: 'boosts strength for melee and hauling', need: 'power', kids: [
            { l: 'Sealed hardsuit', cap: 'a pressurized suit — vacuum and NBC proof', need: 'seal', needsAll: ['powered-exo.load-frame.servo-assist', 'beam-diffuse.mirror-coat'], kids: [
              { l: 'Juggernaut suit', arch: 'corpo', cap: 'a one-person walking tank — OP, two or three corps build it' }] }] }] }] }] },

    'FILTER-AIR': { l: 'Filter-Air', cap: 'breathe where the air will kill you', kids: [
      { l: 'Particulate', cap: 'a filter mask — stops dust, smoke, spores', tag: 'filter', kids: [
        { l: 'HEPA cartridge', cap: 'blocks fine particulates and aerosols', add: true, sc: { max: 3, per: 'cartridge' }, kids: [
          { l: 'Powered blower', cap: 'forced air — positive pressure keeps grit out', need: 'power', kids: [
            { l: 'Self-cleaning', cap: 'pulses dust off so it never clogs', kids: [
              { l: 'Endless filter', arch: 'corpo', cap: 'a filter that never needs a change in the field — OP corpo' }] }] }] }] },
      { l: 'Chem/gas', cap: 'an activated bed that neutralizes toxic gas', need: 'seal', tag: 'filter', kids: [
        { l: 'Broad-spectrum bed', cap: 'adsorbs a wide range of war gases', kids: [
          { l: 'Catalytic bed', cap: 'chemically breaks nerve agents down', kids: [
            { l: 'Auto-sensing swap', cap: 'a sensor swaps beds before breakthrough', need: 'node:SENSE', kids: [
              { l: 'Universal scrubber', arch: 'corpo', cap: 'defeats any known chemical agent — OP corpo NBC gear' }] }] }] }] },
      { l: 'Rebreather', cap: 'a closed loop — recycles your own air, no outside intake', need: 'seal', tag: 'closed', kids: [
        { l: 'CO2 scrubber', cap: 'strips exhaled CO2 for longer endurance', sc: { max: 4, per: 'hour' }, kids: [
          { l: 'O2 bottle', cap: 'carried oxygen for smoke, water or vacuum', add: true, kids: [
            { l: 'Mixed-gas rig', cap: 'blends gas for depth or altitude', need: 'node:MOVE', kids: [
              { l: 'Deep-dive loop', arch: 'corpo', cap: 'a rebreather good from the seabed to the stratosphere — OP corpo' }] }] }] }] },
      { l: 'Implanted supply', cap: 'cyber-lungs/gills built into the body', need: 'injector', tag: 'cyberware', kids: [
        { l: 'Toxin binder', cap: 'blood scrubber pulls inhaled poison', need: 'node:HEAL', kids: [
          { l: 'Oxygen reserve', cap: 'stored O2 for minutes without a breath', kids: [
            { l: 'Amphibious gills', cap: 'pulls oxygen straight from water', kids: [
              { l: 'Internal life-support', cap: 'oxygenator + catalytic bed — self-contained breathing', needsAll: ['implanted-supply.toxin-binder.oxygen-reserve', 'chem-gas.broad-spectrum-bed.catalytic-bed'], kids: [
                { l: 'Sealed-body suite', arch: 'corpo', cap: 'a body that ignores atmosphere entirely — OP, corps only' }] }] }] }] }] }] },

    SENSE: { l: 'Sense', cap: 'perceive what others can\'t', kids: [
      { l: 'Optics', cap: 'enhanced eyes — zoom and low-light', act: 'scan', tag: 'optic', kids: [
        { l: 'Low-light', cap: 'amplify starlight to see in the dark', kids: [
          { l: 'Thermal', cap: 'see body heat through smoke and dark', act: 'track', kids: [
            { l: 'Multispectral', cap: 'UV/IR/visible blended into one view', sc: { max: 3, per: 'band' }, kids: [
              { l: 'Hyperspectral ID', cap: 'reads materials by their light signature', need: 'node:HACK', kids: [
                { l: 'Omni-eye', arch: 'corpo', cap: 'an eye that sees every spectrum at once — OP corpo optics' }] }] }] }] },
        { l: 'Zoom telescopic', add: true, cap: 'long-range magnification for spotting', sc: { max: 4, per: 'power' } }] },
      { l: 'Audio', cap: 'boosted hearing — amplify and locate sound', act: 'listen', tag: 'audio', kids: [
        { l: 'Directional array', cap: 'pinpoint a sound\'s bearing', kids: [
          { l: 'Through-wall acoustic', cap: 'hear movement behind walls', need: 'node:CONCEAL', kids: [
            { l: 'Voice-print ID', cap: 'recognizes and tracks specific voices', need: 'node:HACK', act: 'track' }] }] },
        { l: 'Sub/ultrasound', add: true, cap: 'hear below and above human range' }] },
      { l: 'EM/radar', cap: 'an active/passive RF sensor — map the unseen', act: 'scan', tag: 'em', kids: [
        { l: 'Radar imaging', cap: 'range and image through smoke and dark', kids: [
          { l: 'See-through-walls', cap: 'thermal + radar reveal people behind cover', needsAll: ['optics.low-light.thermal', 'em-radar.radar-imaging'], act: 'track', kids: [
            { l: 'Ghost-vision suite', arch: 'corpo', cap: 'a sensor that renders solid walls transparent — OP corpo' }] }] },
        { l: 'EM sniffer', cap: 'detects live electronics and power', need: 'node:JAM', act: 'locate' }] },
      { l: 'Bio-chem', cap: 'a nose for the world — trace chemicals and life signs', act: 'sense', tag: 'chem', kids: [
        { l: 'Explosive sniffer', cap: 'smells traces of explosives and drugs', add: true, kids: [
          { l: 'Life-sign scanner', cap: 'reads pulse and breath at a distance', need: 'node:HEAL', kids: [
            { l: 'Lie/stress read', cap: 'flags stress and deception cues', act: 'track' }] }] }] },
      { l: 'Sensorium', cap: 'a neural hub that fuses every feed into one view', need: 'injector', tag: 'neural', bridge: 'data', kids: [
        { l: 'Sensor fusion', cap: 'merges optics, audio and EM into one map', need: 'node:LINK', kids: [
          { l: 'Threat overlay', cap: 'auto-tags and predicts every threat in view', act: 'lock-on', needsAll: ['sensorium.sensor-fusion', 'em-radar.radar-imaging'], kids: [
            { l: 'Precog overlay', arch: 'corpo', cap: 'a fused sensorium that calls the fight before it happens — OP, corps only' }] }] }] }] },

    HACK: { l: 'Hack', cap: 'break into and command the machine world', bridge: 'net', kids: [
      { l: 'Deck', cap: 'a cyberdeck interface — jack in and run programs', act: 'jack-in', tag: 'deck', need: 'injector', kids: [
        { l: 'Bandwidth', cap: 'more RAM/throughput for bigger programs', sc: { max: 5, per: 'slot' }, kids: [
          { l: 'Co-processor', cap: 'offloads routines so you act faster in the net', kids: [
            { l: 'Reflex link', cap: 'net actions run at meat-space reflex speed', need: 'node:MOVE', kids: [
              { l: 'Master deck', arch: 'corpo', cap: 'a deck that runs a whole intrusion in one breath — OP corpo netrunning rig' }] }] }] }] },
      { l: 'Intrusion', cap: 'ICE-breaking attack programs', act: 'breach', tag: 'program', bridge: 'net', kids: [
        { l: 'Brute-forcer', cap: 'hammers passwords and weak ICE', kids: [
          { l: 'Zero-day cache', cap: 'stockpiled exploits open doors instantly', add: true, kids: [
            { l: 'Polymorph payload', cap: 'mutates to slip signature-based ICE', kids: [
              { l: 'Adaptive breaker', cap: 'zero-days + a learning daemon that beats new ICE', needsAll: ['intrusion.brute-forcer.zero-day-cache', 'device-control.daemon'], kids: [
                { l: 'Blackwall skeleton-key', arch: 'corpo', cap: 'a breaker that opens anything short of the Blackwall — OP, corps only' }] }] }] }] },
        { l: 'Wall-tap', cap: 'siphon data from a system quietly', bridge: 'data', act: 'exfiltrate' }] },
      { l: 'Stealth', cap: 'move through the net unseen', act: 'ghost', tag: 'program', bridge: 'net', kids: [
        { l: 'Masking', cap: 'hides your presence from ICE', need: 'node:CONCEAL', kids: [
          { l: 'Trace-killer', cap: 'cuts a trace before it reaches you', act: 'evade', kids: [
            { l: 'Ghost-runner', arch: 'corpo', cap: 'a runner ICE literally can\'t perceive — OP corpo' }] }] }] },
      { l: 'Device control', cap: 'seize and drive hardware over the net', act: 'hijack', tag: 'program', bridge: 'net', kids: [
        { l: 'Daemon', cap: 'a resident agent that holds a device open', kids: [
          { l: 'Turn-the-guns', cap: 'takes over enemy weapons and cameras', need: 'node:LINK', act: 'hijack', kids: [
            { l: 'Puppet-master', cap: 'runs a whole facility\'s systems at once', needsAll: ['device-control.daemon.turn-the-guns', 'intrusion.brute-forcer.zero-day-cache'], kids: [
              { l: 'Omni-control suite', arch: 'corpo', cap: 'seizes a city block\'s networked hardware — OP corpo' }] }] }] }] },
      { l: 'Black-ICE', cap: 'combat programs that hurt the netrunner, not just the deck', act: 'kill', tag: 'program', bridge: 'net', need: 'power', kids: [
        { l: 'Stunner', cap: 'flatlines a hostile deck', act: 'stun', kids: [
          { l: 'Neural feedback', cap: 'fries the runner\'s brain through the jack', need: 'node:HEAL', kids: [
            { l: 'Killer black-ICE', arch: 'corpo', cap: 'ICE that murders any runner who touches it — OP, corps only' }] }] }] }] },

    HEAL: { l: 'Heal', cap: 'keep a body alive and fighting', kids: [
      { l: 'Trauma kit', cap: 'field kit — stop bleeding, seal wounds', act: 'stabilize', tag: 'kit', kids: [
        { l: 'Hemostatic', cap: 'clots major bleeds fast', kids: [
          { l: 'Auto-splint', cap: 'braces and immobilizes breaks', add: true, kids: [
            { l: 'Trauma seal', cap: 'seals penetrating chest/abdomen wounds', kids: [
              { l: 'Auto-medic pack', arch: 'corpo', cap: 'a wearable that treats any wound hands-free — OP corpo' }] }] }] }] },
      { l: 'Injector', cap: 'a drug injector — chem support on demand', need: 'injector', act: 'inject', tag: 'drug', kids: [
        { l: 'Painkiller', cap: 'blocks pain to keep moving', add: true, kids: [
          { l: 'Combat stim', cap: 'a surge of speed and focus — with a crash', act: 'boost', kids: [
            { l: 'Adrenal override', cap: 'ignores wounds that should drop you', need: 'node:MOVE', kids: [
              { l: 'Berserk cocktail', arch: 'corpo', cap: 'a milspec cocktail that makes a soldier unstoppable briefly — OP corpo' }] }] }] }] },
      { l: 'Nanites', cap: 'medical nanomachines repair from inside', need: 'seal', tag: 'nano', kids: [
        { l: 'Repair swarm', cap: 'knits tissue over time', sc: { max: 3, per: 'dose' }, kids: [
          { l: 'Toxin scrubber', cap: 'hunts and neutralizes poisons in the blood', need: 'node:FILTER-AIR', kids: [
            { l: 'Nanite lattice', cap: 'a resident swarm that heals continuously', kids: [
              { l: 'Regen-lattice', cap: 'nanites + bioware regrow lost limbs and organs', needsAll: ['nanites.repair-swarm.toxin-scrubber', 'cyber-regen.wound-sealer-plugs.bioware-organs'], kids: [
                { l: 'Phoenix suite', arch: 'corpo', cap: 'brings a body back from near-death and regrows it — OP, corps only' }] }] }] }] }] },
      { l: 'Cyber-regen', cap: 'chromed self-repair built into the body', need: 'injector', tag: 'cyberware', kids: [
        { l: 'Wound-sealer plugs', cap: 'implants clamp bleeders automatically', kids: [
          { l: 'Bioware organs', cap: 'hardened organs shrug off trauma', need: 'node:HEAL', kids: [
            { l: 'Auto-triage', cap: 'the body prioritizes and treats its own worst wound', act: 'stabilize' }] }] }] },
      { l: 'Life-support', cap: 'keeps a critically wounded body viable', need: 'power', tag: 'support', kids: [
        { l: 'Vitals monitor', cap: 'tracks and alerts on failing signs', need: 'node:SENSE', kids: [
          { l: 'Cryo-stasis', cap: 'chills a dying body to buy hours', need: 'seal', kids: [
            { l: 'Stasis pod', arch: 'corpo', cap: 'holds a flatlined body indefinitely for later revival — OP corpo' }] }] }] }] },

    LINK: { l: 'Link', cap: 'two-way comms and networking capability', kids: [
      { l: 'RF transceiver', cap: 'base two-way radio, opens the spectrum', act: 'transmit', tag: 'comms-core', need: 'power', kids: [
        { l: 'Freq hopper', cap: 'hops carrier frequency to dodge jamming', act: 'hop', tag: 'firmware', kids: [
          { l: 'Spread spectrum', cap: 'smears the signal below the noise floor', tag: 'waveform', kids: [
            { l: 'LPI waveform', cap: 'low-probability-of-intercept, near-undetectable emission', need: 'seal', kids: [
              { l: 'Ghost-net grid', cap: 'whole squad shares one undetectable RF fabric', arch: 'corpo', need: 'power' }] }] },
          { l: 'Cognitive radio', cap: 'senses and seizes empty spectrum in real time', act: 'sense', need: 'node:JAM' }] },
        { l: 'Wideband array', cap: 'multi-band antenna, monitors many channels at once', tag: 'antenna', sc: { max: 4, per: 'band' }, kids: [
          { l: 'Beamforming', cap: 'electronically aims gain at a chosen node', act: 'steer', kids: [
            { l: 'MIMO fabric', cap: 'many simultaneous spatial data streams', tag: 'array' }] }] },
        { l: 'Booster amp', cap: 'raises output power and range', add: true, need: 'power', sc: { max: 3, per: 'watt-stage' } }] },
      { l: 'Tightbeam optic', cap: 'laser/IR line-of-sight link, no RF footprint', act: 'aim', tag: 'photonic', kids: [
        { l: 'Auto-tracker', cap: 'gimbal keeps the beam locked on a moving node', act: 'track', kids: [
          { l: 'Retroreflector lock', cap: 'bounces off passive markers to hold the link', kids: [
            { l: 'Blue-green subsurface', cap: 'penetrates water and smoke', need: 'seal' }] }] },
        { l: 'Freespace mesh', cap: 'node-to-node optical hops weave a web', tag: 'photonic' },
        { l: 'Hybrid switch', cap: 'fails over between radio and laser seamlessly', needsAll: ['rf-transceiver.wideband-array', 'tightbeam-optic.auto-tracker'], kids: [
          { l: 'Adaptive stealth uplink', cap: 'picks the least-detectable medium every packet, near-unjammable', arch: 'corpo', need: 'power' }] }] },
      { l: 'Mesh router', cap: 'base packet router, forms an ad-hoc network', tag: 'net-core', bridge: 'net', kids: [
        { l: 'Self-healing', cap: 'auto-routes around dead nodes', act: 'reroute', kids: [
          { l: 'Swarm relay', cap: 'drones/agents extend coverage', add: true, sc: { max: 6, per: 'relay' }, kids: [
            { l: 'City-mesh', cap: 'self-deploying metro-wide covert network', arch: 'corpo', bridge: 'net' }] }] },
        { l: 'Onboard cryption', cap: 'hardware-encrypts all traffic', need: 'seal', kids: [
          { l: 'Quantum keys', cap: 'tamper-evident keys; interception destroys the message', kids: [
            { l: 'Blackwall trunk', cap: 'comms trunk that survives rogue AI and ICE probing', arch: 'corpo', needsAll: ['mesh-router.onboard-cryption.quantum-keys', 'rf-transceiver.freq-hopper.spread-spectrum.lpi-waveform'], bridge: 'data', need: 'power' }] }] }] },
      { l: 'Neural jack', cap: 'subvocal thought-to-text link via interface plug', need: 'injector', tag: 'cyberware', kids: [
        { l: 'Subvocal codec', cap: 'turns silent speech into data', act: 'encode', kids: [
          { l: 'Empathic channel', cap: 'shares raw sensory and emotion feed', need: 'node:CONCEAL', kids: [
            { l: 'Hive squadnet', cap: 'shared battlefield consciousness, sub-second coordination', arch: 'corpo', need: 'power' }] }] },
        { l: 'Smartlink bridge', cap: 'pipes weapon smartlink data over the net', act: 'sync', kids: [
          { l: 'Targeting grid', cap: 'squad shares one fused targeting picture', needsAll: ['neural-jack.smartlink-bridge', 'rf-transceiver.wideband-array.beamforming'] }] }] }] },

    JAM: { l: 'Jam', cap: 'electronic warfare and signal denial', kids: [
      { l: 'Barrage jammer', cap: 'broadband noise transmitter, denies a slice of spectrum', act: 'jam', tag: 'ew-core', need: 'power', kids: [
        { l: 'Spot jammer', cap: 'concentrates all power on one frequency', act: 'target', kids: [
          { l: 'Sweep jammer', cap: 'rapidly walks the jam across bands', kids: [
            { l: 'Reactive look-through', cap: 'listens between jams, jams only active channels', need: 'node:LINK', kids: [
              { l: 'Cognitive EW suite', cap: 'AI decides what to jam every millisecond', arch: 'corpo', need: 'power' }] }] }] },
        { l: 'Power bank', cap: 'stacks output to burn through hardened links', add: true, need: 'power', sc: { max: 4, per: 'kw' } },
        { l: 'Directional horn', cap: 'focuses the jam into a cone, less collateral', act: 'aim' }] },
      { l: 'Deception jammer', cap: 'repeater that returns falsified signals', act: 'spoof', tag: 'ew-core', kids: [
        { l: 'Range-gate pull', cap: 'drags a radar lock off the true target', kids: [
          { l: 'False targets', cap: 'paints many phantom contacts', sc: { max: 6, per: 'ghost' }, kids: [
            { l: 'DRFM memory', cap: 'records and replays an enemy waveform perfectly', need: 'seal', kids: [
              { l: 'Phantom-army projector', cap: 'fabricates a whole fake force across all sensors', arch: 'corpo', need: 'power' }] }] }] },
        { l: 'Protocol spoof', cap: 'injects valid-looking packets into a net', act: 'spoof', bridge: 'net', kids: [
          { l: 'Man-in-the-mesh', cap: 'silences a real node then impersonates it', needsAll: ['deception-jammer.protocol-spoof', 'barrage-jammer.spot-jammer'], bridge: 'data', kids: [
            { l: 'Ghost-operator takeover', cap: 'quietly assumes control of an enemy comnet', arch: 'corpo', need: 'node:LINK' }] }] }] },
      { l: 'EMP emitter', cap: 'directed electromagnetic pulse, fries unshielded gear', need: 'seal', tag: 'ew-core', kids: [
        { l: 'Capacitor bank', cap: 'stores more charge for a bigger pulse', add: true, sc: { max: 3, per: 'cell' }, need: 'power' },
        { l: 'HPM waveguide', cap: 'high-power microwave beam in a frontal cone', act: 'pulse', kids: [
          { l: 'Tuned coupling', cap: 'matches target resonance to defeat shielding', kids: [
            { l: 'Cascade lance', cap: 'chains through shielding to kill hardened milspec electronics', arch: 'corpo', need: 'power' }] }] }] },
      { l: 'Signals recon', cap: 'passive receiver, maps the emitter environment', act: 'listen', tag: 'sigint', kids: [
        { l: 'Direction finder', cap: 'pinpoints an emitter bearing', act: 'locate', kids: [
          { l: 'Multilateration', cap: 'several sensors triangulate exact position', add: true, sc: { max: 5, per: 'sensor' }, kids: [
            { l: 'Find-fix-finish', cap: 'locates then instantly beams a kill-jam at the emitter', needsAll: ['signals-recon.direction-finder.multilateration', 'barrage-jammer.directional-horn'], kids: [
              { l: 'Hunter-killer EW', cap: 'drone swarm that finds and neutralizes emitters unmanned', arch: 'corpo', need: 'power', bridge: 'net' }] }] }] },
        { l: 'Signature library', cap: 'fingerprints and IDs enemy devices', need: 'node:CONCEAL' }] }] },

    CONCEAL: { l: 'Conceal', cap: 'stealth, signature reduction, and evasion', kids: [
      { l: 'Thermoptic camo', cap: 'active camouflage skin, bends visible light around the wearer', act: 'cloak', tag: 'stealth-core', kids: [
        { l: 'Adaptive texture', cap: 'matches the surrounding pattern in real time', act: 'blend', kids: [
          { l: 'Motion-comp cloak', cap: 'keeps camo coherent while moving fast', kids: [
            { l: 'Full-spectrum mantle', cap: 'hides visible, IR and UV simultaneously', need: 'power', kids: [
              { l: 'Invisibility shroud', cap: 'near-total optical erasure at any speed', arch: 'corpo', need: 'seal' }] }] }] },
        { l: 'Thermal masking', cap: 'suppresses IR heat bloom', kids: [
          { l: 'Heat-sink lattice', cap: 'dumps body heat into a buffer', add: true, need: 'power', sc: { max: 3, per: 'sink' }, kids: [
            { l: 'Cold-ghost profile', cap: 'near-zero thermal and acoustic trace at once', needsAll: ['thermoptic-camo.thermal-masking.heat-sink-lattice', 'signature-reduction.acoustic-damping'] }] }] }] },
      { l: 'Reflec coating', cap: 'radar-absorbent anti-scan coating', tag: 'stealth-core', kids: [
        { l: 'Radar absorbent', cap: 'soaks up scanning RF for a low return', kids: [
          { l: 'Freq-selective skin', cap: 'tuned to defeat specific scanner bands', need: 'node:JAM', kids: [
            { l: 'Metamaterial cloak', cap: 'steers radar around the object entirely', kids: [
              { l: 'Sensor-blind hull', cap: 'invisible to all known scanning tech', arch: 'corpo', need: 'power' }] }] }] },
        { l: 'Anti-laser dazzle', cap: 'scatters targeting lasers and rangefinders', act: 'scatter', add: true }] },
      { l: 'Signature reduction', cap: 'passive signature control, minimizes emissions', tag: 'stealth-core', kids: [
        { l: 'Acoustic damping', cap: 'muffles mechanical and footfall noise', sc: { max: 4, per: 'panel' }, kids: [
          { l: 'Active noise cancel', cap: 'emits anti-sound to erase the acoustic trace', act: 'null', need: 'power' }] },
        { l: 'Emission control', cap: 'shuts down tell-tale RF and EM leakage', need: 'node:LINK', kids: [
          { l: 'Faraday underweave', cap: 'contains all electronic emissions', need: 'seal', kids: [
            { l: 'Total-silence rig', cap: 'emits nothing across EM, RF and scan bands', arch: 'corpo', needsAll: ['signature-reduction.emission-control.faraday-underweave', 'reflec-coating.radar-absorbent.freq-selective-skin'], need: 'power' }] }] },
        { l: 'Scent scrubber', cap: 'filters chemical and scent trail versus bio-sensors', add: true }] },
      { l: 'Chameleon implant', cap: 'subdermal camo layer, cyberware-integrated concealment', need: 'injector', tag: 'cyberware', kids: [
        { l: 'Biometric spoof', cap: 'alters IR face and gait signature to defeat ID', act: 'mask', kids: [
          { l: 'Deepfake projector', cap: 'projects a false outward appearance', need: 'node:JAM', kids: [
            { l: 'Ghost-identity suite', cap: 'change looks and signature on the fly, beats biometrics and optics', needsAll: ['chameleon-implant.biometric-spoof.deepfake-projector', 'thermoptic-camo.adaptive-texture'], kids: [
              { l: 'Phantom-operative shell', cap: 'wearer registers as a different real person to every sensor', arch: 'corpo', need: 'power' }] }] }] }] }] },

    // ── FAB family: how a thing gets MADE (each fab method its own base-tree) ──
    'FAB-ADDITIVE': { l:'Fab-Additive', cap:'Build objects up by depositing matter layer on layer — from a garage printer to a corp line that prints finished products unattended.', kids:[
      { l:'Job replicator', cap:'Turn one saved object record into a repeatable industrial print run.', act:'productionize' },

      { l:'Extrusion', cap:'Push molten stock through a heated nozzle and stack the beads.', act:'extrude', tag:'nozzle', kids:[
        { l:'Filament feed', cap:'Spool-fed thermoplastic through a garage hot-end.', tag:'feed', kids:[
          { l:'Dual nozzle', cap:'Second head lays dissolvable support so overhangs survive.', kids:[
            { l:'Fine-layer trim', cap:'Drop layer height for smoother street-grade parts.' },
            { l:'Support solvent bath', cap:'Wash out support in a solvent tank.', need:'seal' } ] },
          { l:'Pellet hopper', cap:'Cheap bulk pellets instead of spooled filament.', tag:'feed', kids:[
            { l:'High-throughput screw', cap:'Auger screw pushes big-volume prints fast.', need:'power' },
            { l:'Blend on feed', cap:'Mix colour or filler into the melt as it feeds.', add:true } ] } ] },
        { l:'Composite deposition', cap:'Lay continuous fibre into the bead for load-bearing parts.', tag:'core', need:'power', kids:[
          { l:'Fibre-lay head', cap:'Steer chopped or continuous fibre along stress lines.', kids:[
            { l:'Anisotropic toolpath', cap:'Plan bead paths to carry load like grain in wood.', need:'node:COMPUTE@4' },
            { l:'Continuous-fibre spar', cap:'Lay one unbroken fibre the length of the load path.', need:'power', kids:[
              { l:'Fibre-optimal structure', cap:'A part stronger than machined titanium at a third the weight — fibre steered voxel by voxel down every stress line. The frontier of strength-to-mass.', tag:'core', need:'node:COMPUTE@5' },
              { l:'Large-format gantry', cap:'Scale the head onto a room-sized gantry for building-scale prints.', need:'power', kids:[
                { l:'On-site construction printer', cap:'A mobile gantry prints a whole shelter, bunker or bridge where it stands — heavy construction with no factory, no formwork and no crew.', act:'productionize', tag:'core', arch:'corpo', need:'node:COMPUTE@5' } ] } ] } ] },
          { l:'Working-mechanism print', cap:'Deposit hinges, gears and captive parts pre-assembled in one build.', tag:'core', need:'power', kids:[
            { l:'In-situ lubricant', cap:'Lay a slip layer so printed joints move free.', add:true },
            { l:'Live-hinge print', cap:'Print one finished, moving joint straight off the bed, no assembly.', need:'node:COMPUTE@4', kids:[
              { l:'Field additive repair', cap:'Carry the head to a broken part and print fresh material straight onto it — rebuild a cracked gear tooth or a worn edge in place, no replacement.', tag:'nozzle', need:'node:SENSE@4' },
              { l:'Multi-part kinematic print', cap:'A whole gear-train or linkage prints pre-meshed and already turning — a mechanism, not a part.', need:'node:COMPUTE@5', kids:[
                { l:'Printed working machine', cap:'A complete machine — moving parts, actuators, wiring and logic — printed as one monolithic build. A drone, an engine, a gun leaves the bed already working: no bolts, no assembly.', act:'assemble', tag:'core', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] } ] } ] },

      { l:'Resin cure', cap:'Cure liquid photopolymer with light, layer by layer.', act:'cure', tag:'vat', need:'seal', kids:[
        { l:'Masked LCD', cap:'Screen-masked UV flashes a whole layer at once.', tag:'emitter', kids:[
          { l:'Fine mask array', cap:'High-pixel mask for crisp small features.', kids:[
            { l:'Grey-scale dose', cap:'Vary pixel brightness to smooth edges.' },
            { l:'Dual-wavelength cure', cap:'Two light bands set skin and core separately.', need:'power' } ] },
          { l:'Tough resin blend', cap:'Engineering resin resists snapping.', tag:'vat', kids:[
            { l:'Thermal post-cure', cap:'Oven finish drives full crosslink strength.', need:'power' },
            { l:'Bio-scaffold resin', cap:'Print a porous scaffold for living cells.', tag:'vat', need:'node:BIOFAB@4', kids:[
              { l:'Perfused tissue print', cap:'Print vascular channels through the scaffold so thick, living tissue stays fed and does not die in the core.', tag:'vat', need:'node:BIOFAB@5' } ] } ] } ] },
        { l:'Volumetric cure', cap:'Solidify a whole shape inside the vat at once with crossed beams.', tag:'emitter', need:'power', kids:[
          { l:'Tomographic dose', cap:'Rotate and dose the vat like a reverse CT scan.', need:'node:COMPUTE@4', kids:[
            { l:'Multi-material vat', cap:'Swap resins mid-build for graded properties.', add:true },
            { l:'Embedded-electronics cure', cap:'Cure around dropped-in circuits to seal them inside.', tag:'core', need:'power' } ] },
          { l:'Functional-object printer', cap:'Cure a complete working device — housing, optics and channels — in one shot.', tag:'core', need:'node:COMPUTE@4', kids:[
            { l:'Sealed fluidic core', cap:'Cure closed microfluidic channels with no assembly.', tag:'closed' },
            { l:'Whole-device cure', cap:'Cure structure, active parts and casing as one sealed body.', need:'node:COMPUTE@5', kids:[
              { l:'Monolithic optic train', cap:'A full lens, waveguide and detector stack cured as one optical-grade block — a finished sensor with no assembly and nothing left to align.', tag:'closed', need:'node:SENSE@5' },
              { l:'Embedded-core cure', cap:'Cure the body around dropped-in optics, logic, even a living cell, sealing them permanently inside as it grows.', need:'node:STORE@4', kids:[
                { l:'Sealed monolithic device', cap:'A device grown as one seamless block with its guts cured inside — no seam, no fastener, nothing to unbolt, extract, tamper with or reverse-engineer.', tag:'closed', arch:'corpo', need:'node:STORE@5' } ] } ] } ] } ] } ] },

      { l:'Powder sinter', cap:'Fuse a bed of metal or ceramic powder with a scanning beam.', act:'sinter', tag:'plate', need:'power', kids:[
        { l:'Laser melt', cap:'Melt metal powder track by track.', tag:'emitter', kids:[
          { l:'Inert chamber', cap:'Shield the melt pool under inert gas.', need:'seal', kids:[
            { l:'Hatch strategy', cap:'Plan scan hatching to cut warping.', need:'node:COMPUTE@4' },
            { l:'Support lattice', cap:'Grow break-off supports to anchor the part.' } ] },
          { l:'Melt-pool watch', cap:'Camera watches each track and corrects live.', need:'node:SENSE@4', kids:[
            { l:'Density map', cap:'Log porosity across the part for QA.', need:'node:STORE@4' },
            { l:'Exotic-alloy bed', cap:'Sinter a forge-grade superalloy powder.', tag:'plate', need:'node:FAB-FORGE@4', kids:[
              { l:'Net-shape hot part', cap:'Print a finished, fully-dense superalloy turbine or combustion part to tolerance, untouched by hand.', need:'node:FAB-FORGE@5', kids:[
                { l:'Regen-cooled engine part', cap:'A rocket or turbine part laced with internal cooling channels no drill could ever cut — it survives a flame that would melt a forged one. Heat is now a design material.', tag:'plate', arch:'corpo', need:'node:FAB-FORGE@6' } ] } ] } ] } ] },
        { l:'Binder jet', cap:'Glue powder with jetted binder, then furnace-sinter.', tag:'nozzle', need:'seal', kids:[
          { l:'Green-part debind', cap:'Burn out binder before final sinter.', need:'power', kids:[
            { l:'Ceramic core', cap:'Sinter a hard ceramic body.', tag:'core' },
            { l:'Infiltration fill', cap:'Wick metal into pores for full density.', need:'node:FAB-FORGE@4' } ] },
          { l:'Graded-powder bed', cap:'Layer different powders for a property gradient.', tag:'plate', need:'power', kids:[
            { l:'Refractory shell', cap:'Sinter a heat-proof outer shell.', tag:'plate', add:true },
            { l:'Gradient-composition sinter', cap:'Vary the powder blend voxel by voxel so the alloy itself changes through the part.', need:'node:COMPUTE@5', kids:[
              { l:'Architected lattice', cap:'Sinter a topology-optimised metal lattice — a part that is mostly engineered void: strongest-per-gram, or tuned to soak an impact and stay bent-not-broken.', tag:'plate', need:'node:COMPUTE@5' },
              { l:'Functionally-graded part', cap:'One part, many materials at once — a tough soft core under a hard wear face, metal fading to ceramic, conductor to insulator.', need:'node:FAB-FORGE@5', kids:[
                { l:'Impossible-alloy part', cap:'A single part whose metallurgy and structure change continuously through its volume, out of refractory superalloys no forge or mill could ever shape.', tag:'plate', arch:'corpo', need:'node:STORE@5' } ] } ] } ] } ] } ] },

      { l:'Nano-assembly', cap:'Place matter molecule by molecule under program control; Nano Tech.', act:'assemble', tag:'matrix', need:'node:COMPUTE@4', kids:[
        { l:'Directed self-assembly', cap:'Coax molecules to snap into a designed lattice.', tag:'matrix', kids:[
          { l:'Template mask', cap:'Chemical template steers where units land.', need:'seal', kids:[
            { l:'Defect anneal', cap:'Heal lattice faults with a gentle anneal.', need:'power' },
            { l:'Precursor synth', cap:'Cook the molecular feedstock in-house.', need:'node:FAB-CHEM@4' } ] },
          { l:'Scanning-probe place', cap:'Robotic tip sets single atoms one at a time.', need:'power', kids:[
            { l:'Parallel tip array', cap:'Thousands of tips write in parallel.', need:'node:COMPUTE@5' },
            { l:'Atom-perfect lattice', cap:'Assemble a flawless engineered crystal atom by atom.', tag:'matrix', need:'node:STORE@5', kids:[
              { l:'Programmable metamaterial', cap:'Place every atom to author bulk properties from scratch — negative refraction, superconduction, armour lighter than foam. Matter whose physical laws are designed, not found.', tag:'matrix', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] },
        { l:'Molecular nano-forge', cap:'A desktop assembler that builds any object bottom-up from feedstock.', tag:'matrix', need:'power', kids:[
          { l:'Feedstock cartridge', cap:'Molecular ink of sorted raw elements.', tag:'feed', need:'node:FAB-CHEM@4', kids:[
            { l:'Contaminant filter', cap:'Strip impurities that would poison the build.', add:true, tag:'filter' },
            { l:'Element sorter', cap:'Strip and sort atoms from raw stock.', need:'power', kids:[
              { l:'Any-element feedstock', cap:'Pull any element it needs from scrap, dust or air and close the loop — the assembler never runs dry of any material.', need:'node:FAB-CHEM@5', kids:[
                { l:'Universal assembler', cap:'Feed it raw matter and any design; it lays the object down atom by atom — any material, any shape, unattended. The one machine that makes every other fab method obsolete.', act:'assemble', tag:'matrix', arch:'corpo', need:'node:COMPUTE@6', needsAll:['nano-assembly.molecular-nano-forge.feedstock-cartridge.element-sorter.any-element-feedstock','extrusion.composite-deposition.working-mechanism-print.live-hinge-print.multi-part-kinematic-print.printed-working-machine'] } ] } ] } ] },
          { l:'Error-correct swarm', cap:'Assemblers check and fix each other as they build.', need:'node:COMPUTE@5', kids:[
            { l:'Redundant vote', cap:'Triple-build critical volumes and vote on the truth.', add:true },
            { l:'Self-checking build', cap:'Each assembler audits its neighbours in real time.', need:'node:COMPUTE@5', kids:[
              { l:'Self-maintaining cell', cap:'The line diagnoses, repairs and re-tools itself with no human hand — it never stops for maintenance.', need:'node:STORE@5', kids:[
                { l:'Self-replicating fab-cell', cap:'An assembler line that builds copies of its own tooling — a factory that grows factories, the corpo dream and nightmare.', act:'productionize', tag:'matrix', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] }
    ]},
    'FAB-SUBTRACTIVE': { l:'Fab-Subtractive', cap:'Cut, mill and erode matter away from solid stock; Basic to Gyro Tech.', kids:[
      { l:'Run replicator', cap:'Turn one proven cut program into a repeatable production run.', act:'productionize' },

      { l:'Milling', cap:'Spin a cutter and carve the part from a block.', act:'mill', tag:'spindle', need:'power', kids:[
        { l:'3-axis bed', cap:'Garage router moving in three straight axes.', tag:'spindle', kids:[
          { l:'Rigid tramming', cap:'Square and stiffen the frame to cut clean.', kids:[
            { l:'Coolant flood', cap:'Flood the cut to clear chips and heat.', add:true, need:'seal' },
            { l:'Tool-length probe', cap:'Auto-measure each tool before it cuts.', need:'node:SENSE@4' } ] },
          { l:'Tool changer', cap:'Carousel swaps cutters mid-job unattended.', tag:'spindle', kids:[
            { l:'Adaptive feed', cap:'Slow the feed when the cut loads up.', need:'node:COMPUTE@4' },
            { l:'Chip conveyor', cap:'Auger clears swarf for long runs.', add:true } ] } ] },
        { l:'5-axis head', cap:'Tilt and rotate the tool to reach any face.', tag:'spindle', need:'node:COMPUTE@4', kids:[
          { l:'Simultaneous contour', cap:'All five axes move at once for smooth blends.', kids:[
            { l:'Collision guard', cap:'Simulate the path to dodge crashes.', need:'node:COMPUTE@4' },
            { l:'Hard-alloy cutter', cap:'Mill a forge-grade exotic billet.', tag:'spindle', need:'node:FAB-FORGE@4', kids:[
              { l:'Multi-axis blade cut', cap:'Reach every face of an impeller or turbine blade complete in one setup, no re-fixturing.', need:'node:COMPUTE@5', kids:[
                { l:'Five-axis blade line', cap:'A lights-out five-axis cell that turns raw billets into finished, in-process-gauged aero blades with no operator — the part is measured and re-cut without ever leaving the table.', act:'productionize', tag:'spindle', arch:'corpo', need:'node:STORE@5' } ] } ] } ] },
          { l:'Thermal null', cap:'Compensate machine growth as it heats.', need:'node:SENSE@4', kids:[
            { l:'On-machine metrology', cap:'Probe the part in place and re-cut to size.', need:'node:SENSE@4' },
            { l:'Sub-micron micro-mill', cap:'Hold sub-micron tolerance on tiny finished parts, tool wear tracked and nulled live.', tag:'spindle', need:'node:STORE@5', kids:[
              { l:'Watch-grade micro cell', cap:'A vibration-isolated, temperature-held cell machining watch and instrument parts to the light-band — a feature you can barely see under a microscope, cut to size every time.', tag:'spindle', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] },

      { l:'Beam cut', cap:'Part material with a focused beam or jet instead of a blade.', act:'cut', tag:'emitter', need:'power', kids:[
        { l:'Plasma torch', cap:'Ionised jet slices thick conductive plate.', tag:'emitter', kids:[
          { l:'Height control', cap:'Ride the torch at constant standoff.', need:'node:SENSE@4', kids:[
            { l:'Bevel head', cap:'Tilt the torch to cut weld-ready edges.' },
            { l:'Fume capture', cap:'Draw and filter cutting fumes.', add:true, need:'seal' } ] },
          { l:'Fine kerf', cap:'Narrow the arc for tighter detail.', kids:[
            { l:'Stack cutting', cap:'Slice several plates in one pass.' },
            { l:'Exotic-plate cut', cap:'Cut a forged armour lattice plate.', tag:'emitter', need:'node:FAB-FORGE@4', kids:[
              { l:'Armour-plate cutting cell', cap:'A high-power gantry that shears finished profiles out of thick composite armour plate the day it lands — the one machine that cuts stock nothing else will touch.', tag:'emitter', arch:'corpo', need:'node:FAB-FORGE@5' } ] } ] } ] },
        { l:'Laser cut', cap:'Vaporise a thin line with focused light.', tag:'emitter', need:'power', kids:[
          { l:'Waterjet swap', cap:'Cold abrasive jet for heat-sensitive stock.', tag:'nozzle', need:'seal', kids:[
            { l:'Abrasive dose', cap:'Meter garnet into the jet for speed.' },
            { l:'Taper compensate', cap:'Tilt to null the jet\'s natural taper.', need:'node:COMPUTE@4' } ] },
          { l:'Ultrafast pulse', cap:'Pulses so short they ablate without heating.', tag:'emitter', need:'node:COMPUTE@5', kids:[
            { l:'Beam scanner', cap:'Galvo mirrors steer the spot at speed.' },
            { l:'Femtosecond nano-cell', cap:'Cold-ablation that carves nanometre features into a finished part without a whisper of heat damage.', tag:'emitter', need:'node:STORE@5', kids:[
              { l:'Nano-texture write', cap:'Write a working nanostructure — an optical waveguide, a micro-fluidic channel, a hidden anti-counterfeit mark — straight into the surface of a finished part.', need:'node:COMPUTE@5', kids:[
                { l:'Cold-ablation nanofab line', cap:'A femtosecond cell writing those nanostructures into finished devices at production speed, part after part, with zero heat-affected zone.', act:'productionize', tag:'emitter', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Electro-erosion', cap:'Melt metal away with controlled electric sparks in fluid.', act:'erode', tag:'driver', need:'seal', kids:[
        { l:'Sinker EDM', cap:'Burn a shaped cavity with a matching electrode.', tag:'driver', need:'power', kids:[
          { l:'Electrode dress', cap:'Shape graphite electrodes to form.', kids:[
            { l:'Flush jet', cap:'Flush debris from the spark gap.', need:'seal' },
            { l:'Orbit finish', cap:'Orbit the electrode for a fine surface.' } ] },
          { l:'Adaptive gap', cap:'Tune spark timing to the gap live.', need:'node:COMPUTE@4', kids:[
            { l:'Fine-finish pulse', cap:'Short pulses leave a mirror wall.' },
            { l:'Micro-hole drill', cap:'Erode tiny cooling holes fast.', tag:'driver', kids:[
              { l:'Cooling-hole array', cap:'Drill a whole field of angled cooling holes into a hot part, each shaped and burr-free.', need:'node:COMPUTE@5', kids:[
                { l:'Turbine-cooling EDM cell', cap:'A hands-off sinker cell that laces a finished turbine blade with hundreds of shaped film-cooling holes no drill could ever reach — the part comes out flight-ready.', tag:'driver', arch:'corpo', need:'node:FAB-FORGE@5' } ] } ] } ] } ] },
        { l:'Wire EDM', cap:'Slice with a travelling charged wire.', tag:'driver', need:'power', kids:[
          { l:'Auto-thread', cap:'Re-thread a broken wire without a hand.', kids:[
            { l:'Taper cut', cap:'Angle the wire for draft on dies.' },
            { l:'Submerged tank', cap:'Cut underwater for thermal stability.', need:'seal' } ] },
          { l:'Multi-pass skim', cap:'Rough then skim for accuracy and finish.', need:'node:COMPUTE@4', kids:[
            { l:'Corner strategy', cap:'Slow at corners to hold sharp geometry.' },
            { l:'Aerospace die cell', cap:'A hands-off wire cell cutting finished, fully-hardened turbine and die stock to a mirror edge — cut it hard, skip the warp of heat-treating after.', tag:'driver', need:'node:FAB-FORGE@5' } ] } ] } ] },

      { l:'Ultra-precision', cap:'Remove matter atom-scale for optics and reference parts; Gyro Tech.', act:'figure', tag:'core', need:'node:SENSE@4', kids:[
        { l:'Diamond turn', cap:'Single-crystal diamond tool cuts mirror surfaces.', tag:'spindle', need:'power', kids:[
          { l:'Air-bearing spindle', cap:'Frictionless spindle for zero chatter.', kids:[
            { l:'Vibration isolate', cap:'Float the machine off the floor.', add:true },
            { l:'Slow-slide servo', cap:'Cut freeform optics off-axis.', need:'node:COMPUTE@4', kids:[
              { l:'Freeform optic turn', cap:'Turn a finished freeform mirror or lens — no axis of symmetry, mirror-smooth off the tool, no polishing after.', tag:'core', need:'node:SENSE@5' } ] } ] },
          { l:'Interferometer loop', cap:'Laser interferometer closes the position loop.', need:'node:SENSE@5', kids:[
            { l:'Fast tool servo', cap:'Flick the tool to carve micro-texture.' },
            { l:'Reference-flat turn', cap:'Turn a metrology-grade reference optic.', tag:'core' } ] } ] },
        { l:'Ion figuring', cap:'Sputter atoms off with a steered ion beam.', tag:'emitter', need:'power', kids:[
          { l:'Dwell map', cap:'Plan beam dwell from an error map.', need:'node:COMPUTE@4', kids:[
            { l:'Vacuum chamber', cap:'Figure the surface under hard vacuum.', need:'seal' },
            { l:'In-situ metrology', cap:'Measure and re-figure without unloading.', need:'node:SENSE@4' } ] },
          { l:'Atomic-layer figuring', cap:'Strip material one atomic layer at a time to a perfect form.', tag:'emitter', need:'node:COMPUTE@5', kids:[
            { l:'Reactive assist', cap:'Add reactive gas to speed selective etch.', need:'node:FAB-CHEM@4' },
            { l:'Angstrom-form cell', cap:'Hold sub-nanometre form on a finished optic, atom layer by atom layer.', tag:'core', need:'node:STORE@5', kids:[
              { l:'Master-optic figuring', cap:'Figure a master flat or sphere true to the reference standard, then verify it against itself.', need:'node:SENSE@6', kids:[
                { l:'Reference-surface foundry', cap:'A sealed figuring foundry that turns out master reference optics — the flats and spheres every other lab calibrates against. Nothing on Earth is measured more precisely.', tag:'core', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] } ] },
    'FAB-CHEM': { l:'Fab-Chem', cap:'Synthesize compounds from feedstock; backroom cooker to corp plant; Chem Tech.', kids:[
      { l:'Batch productionizer', cap:'Scale one proven recipe into a repeatable production batch.', act:'productionize' },

      { l:'Batch reactor', cap:'Cook a charge in one sealed vessel, then work it up.', act:'react', tag:'reactor', need:'seal', kids:[
        { l:'Stirred tank', cap:'Heated, stirred pot for street-grade synthesis.', tag:'reactor', kids:[
          { l:'Jacket control', cap:'Hold temperature with a heat jacket.', need:'power', kids:[
            { l:'Reflux column', cap:'Boil and return solvent to drive reaction.', need:'seal' },
            { l:'pH dosing', cap:'Trickle acid or base to hold pH.', add:true, need:'node:SENSE@4' } ] },
          { l:'Inert blanket', cap:'Cap the pot with inert gas for air-sensitive work.', need:'seal', kids:[
            { l:'Cryo quench', cap:'Chill hard to stop a runaway.', add:true, need:'power' },
            { l:'Pressure vessel', cap:'Run the batch under pressure for tough reactions.', need:'power', kids:[
              { l:'Supercritical reactor', cap:'Run the reaction in a supercritical fluid — a phase that is neither liquid nor gas, that dissolves and reacts what nothing else will and leaves no solvent behind.', tag:'reactor', need:'node:SENSE@5' } ] } ] } ] },
        { l:'Work-up train', cap:'Separate and purify the crude product.', tag:'filter', need:'seal', kids:[
          { l:'Distill cut', cap:'Split by boiling point into fractions.', tag:'filter', kids:[
            { l:'Vacuum still', cap:'Distil heat-sensitive stuff under vacuum.', need:'power' },
            { l:'Fractionating pack', cap:'Packed column sharpens the cut.', add:true } ] },
          { l:'Crystallize pure', cap:'Grow crystals to lock out impurities.', tag:'filter', kids:[
            { l:'Recrystal loop', cap:'Repeat to reach reagent purity.' },
            { l:'Clandestine drug lab', cap:'A self-contained back-room rig cooking finished designer drugs to purity.', tag:'reactor', need:'node:STORE@5', kids:[
              { l:'Cut-and-press line', cap:'Meter, cut and press the product into finished street-ready units, each dosed to the milligram.', need:'node:STORE@5', kids:[
                { l:'Autonomous narco-lab', cap:'A sealed shipping-container lab that cooks, purifies, doses and packages designer drugs with no cook inside — moves, hides and runs lights-out. The cartel\'s dream and the task-force\'s nightmare.', act:'productionize', tag:'reactor', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Flow chemistry', cap:'Pump reagents through tubing so reaction never stops.', act:'flow', tag:'reactor', need:'power', kids:[
        { l:'Micro-mixer', cap:'Merge streams in tiny channels for fast, even mixing.', tag:'reactor', kids:[
          { l:'Residence coil', cap:'Length of coil sets the reaction time.', kids:[
            { l:'Heated zone', cap:'Stage temperatures along the coil.', need:'power' },
            { l:'Backpressure valve', cap:'Hold pressure to run hot solvents.', add:true, need:'seal' } ] },
          { l:'Inline quench', cap:'Kill the reaction the instant it is done.', kids:[
            { l:'Phase separator', cap:'Split layers in-line, no batching.' },
            { l:'Bio-precursor feed', cap:'Feed a cultured biological precursor into the stream.', tag:'feed', need:'node:BIOFAB@4', kids:[
              { l:'Living-flow reactor', cap:'Run cultured enzymes right in the flow stream — biology\'s own catalysts doing industrial chemistry at room temperature and body pH, no harsh reagents at all.', tag:'reactor', need:'node:BIOFAB@5' } ] } ] } ] },
        { l:'Telescoped line', cap:'Chain many reactions end to end with no isolation.', tag:'reactor', need:'node:COMPUTE@5', kids:[
          { l:'Inline analytics', cap:'Spectrometer reads the stream live.', need:'node:SENSE@5', kids:[
            { l:'Feedback dose', cap:'Trim feeds from live readings.', need:'node:COMPUTE@5' },
            { l:'Impurity divert', cap:'Route off-spec product to waste.', add:true } ] },
          { l:'Self-optimizing rig', cap:'Autonomous flow plant that searches and locks its own best conditions.', tag:'reactor', need:'node:COMPUTE@5', kids:[
            { l:'Design-of-experiment', cap:'The machine plans the next experiment itself instead of a chemist.', need:'node:COMPUTE@5' },
            { l:'Unattended campaign', cap:'Runs a full multi-step synthesis campaign with no chemist present, day and night.', need:'node:STORE@5', kids:[
              { l:'Autonomous discovery run', cap:'The rig proposes brand-new candidate molecules and tests them itself, learning from each result which to try next.', need:'node:COMPUTE@6', kids:[
                { l:'Closed-loop discovery plant', cap:'A flow plant that invents, tests and scales a brand-new molecule end to end — it forms the hypothesis, runs the experiment, reads the result and ships the product, with no human in the loop at all.', act:'productionize', tag:'reactor', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] } ] } ] },

      { l:'Catalytic reform', cap:'Rearrange or crack feedstock over a catalyst bed.', act:'crack', tag:'core', need:'power', kids:[
        { l:'Fixed bed', cap:'Flow feed over a packed catalyst charge.', tag:'core', need:'seal', kids:[
          { l:'Regenerate cycle', cap:'Burn off coke and revive the catalyst.', need:'power', kids:[
            { l:'CHOOH2 reform', cap:'Reform street alcohol fuel to spec.', tag:'reactor' },
            { l:'Selectivity tune', cap:'Bias the bed toward the wanted product.', need:'node:COMPUTE@4' } ] },
          { l:'Thermal crack', cap:'Break heavy stock into lighter cuts with heat.', need:'power', kids:[
            { l:'Steam dilute', cap:'Add steam to steer cracking and cut coke.', add:true },
            { l:'Quench cascade', cap:'Chill products fast to freeze the mix.' } ] } ] },
        { l:'Designer catalyst', cap:'Tailor the catalyst surface for one exact bond.', tag:'core', need:'node:COMPUTE@5', kids:[
          { l:'Nano-cluster site', cap:'Engineer active sites atom by atom.', need:'node:FAB-ADDITIVE@5', kids:[
            { l:'Poison guard', cap:'Trap catalyst poisons upstream.', add:true, tag:'filter' },
            { l:'Asymmetric route', cap:'Make only the wanted mirror-form molecule and none of its useless twin — the difference between a cure and a poison.', need:'node:SENSE@5', kids:[
              { l:'Chiral drug synth', cap:'Turn out one pure mirror-form of a drug at scale — the safe half every batch, a separation impossible by hand done inside the reaction itself.', tag:'reactor', need:'node:STORE@5' } ] } ] },
          { l:'Designer-molecule synth', cap:'A bench that builds an arbitrary target molecule to order.', tag:'reactor', need:'node:COMPUTE@5', kids:[
            { l:'Retrosynthesis plan', cap:'Software plans the whole route backward from the target structure.', need:'node:COMPUTE@5', kids:[
              { l:'Auto-synthesis executor', cap:'The planned route runs itself — reagents ordered, steps sequenced across the reactors, product isolated and checked, with no chemist touching it.', need:'node:COMPUTE@6', kids:[
                { l:'Any-molecule foundry', cap:'Draw any organic structure and it plans the route, orders the feedstock and makes it — from a rare drug to a molecule that has never existed. Chemistry becomes a print queue.', act:'productionize', tag:'reactor', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Electro-photo synth', cap:'Drive reactions with electric current or light instead of heat.', act:'electrolyze', tag:'driver', need:'power', kids:[
        { l:'Electrolytic cell', cap:'Push electrons to make or break bonds.', tag:'driver', need:'seal', kids:[
          { l:'Membrane split', cap:'Ion membrane keeps half-cells apart.', kids:[
            { l:'Electrode coat', cap:'Coat electrodes to steer the reaction.' },
            { l:'Paired electrolysis', cap:'Make useful product at both electrodes.', need:'node:COMPUTE@4' } ] },
          { l:'Gas-diffusion feed', cap:'Feed reactant gas straight to the electrode.', tag:'feed', kids:[
            { l:'Stack scale', cap:'Stack cells for plant-scale current.', add:true, need:'power' },
            { l:'Waste-gas to fuel', cap:'Electro-reduce captured CO2 or flare gas straight into a usable fuel or feedstock — pull carbon out of the air and burn it again clean.', tag:'reactor', need:'node:COMPUTE@5', kids:[
              { l:'Carbon-negative fuel loop', cap:'A solar-driven cell that runs on nothing but CO2, water and sunlight and pours out clean fuel — it locks away more carbon than the fuel ever releases. Off-grid, unlimited, green.', tag:'reactor', need:'node:POWER@5' } ] } ] } ] },
        { l:'Photoreactor', cap:'Light-driven catalysis in a clear-walled reactor.', tag:'emitter', need:'power', kids:[
          { l:'LED array', cap:'Tuned light bands drive the exact step.', kids:[
            { l:'Thin-film flow', cap:'Run a thin film so light reaches all of it.' },
            { l:'Photosensitizer dose', cap:'Add a dye to harvest more light.', add:true } ] },
          { l:'Energetics plant', cap:'A hardened line synthesizing propellants and energetic materials.', tag:'reactor', need:'seal', kids:[
            { l:'Blast containment', cap:'Cell shrugs off a detonation.', need:'seal' },
            { l:'Milspec propellant line', cap:'A hardened line casting finished energetic charges to spec.', tag:'reactor', need:'node:STORE@5', kids:[
              { l:'Robotic load-and-fill', cap:'Robot arms cast, load and fuze finished rounds behind blast walls, so a detonation costs metal, not lives.', need:'node:STORE@5', kids:[
                { l:'Autonomous munitions plant', cap:'A blast-walled, robot-run plant that synthesizes, casts and loads finished rounds and warheads with no human on the floor — it never tires, never flinches and never leaves a witness.', act:'productionize', tag:'reactor', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] } ] },
    'FAB-FORGE': { l:'Fab-Forge', cap:'Form matter with heat and pressure, exotics included; Pyro and Gyro Tech.', kids:[
      { l:'Foundry productionizer', cap:'Turn one proven part into a repeatable foundry production line.', act:'productionize' },

      { l:'Casting', cap:'Pour or inject molten metal into a mould.', act:'cast', tag:'crucible', need:'power', kids:[
        { l:'Sand mould', cap:'Pour into a rammed sand cavity; garage-grade.', tag:'crucible', kids:[
          { l:'Gating design', cap:'Shape runners so metal fills clean.', kids:[
            { l:'Riser feed', cap:'Add risers to feed shrinkage.', add:true },
            { l:'Chill insert', cap:'Place chills to steer where it freezes.' } ] },
          { l:'Investment shell', cap:'Lost-wax ceramic shell for fine detail.', tag:'crucible', need:'seal', kids:[
            { l:'Wax pattern print', cap:'Print the burn-out wax pattern.', need:'node:FAB-ADDITIVE@4' },
            { l:'Synth binder shell', cap:'Bind the shell with a synthesized binder.', need:'node:FAB-CHEM@4', kids:[
              { l:'Single-piece hollow cast', cap:'Cast a hollow, internally-cored part — a cooled blade, a whole manifold — as one flawless piece, no welds and no assembly seam anywhere.', tag:'crucible', need:'node:SENSE@5' } ] } ] } ] },
        { l:'Die cast', cap:'Force melt into a steel die under pressure.', tag:'crucible', need:'power', kids:[
          { l:'Vacuum assist', cap:'Pull vacuum so no gas is trapped.', need:'seal', kids:[
            { l:'Squeeze hold', cap:'Hold pressure as it solidifies.', add:true },
            { l:'Die thermal map', cap:'Balance die heat for even parts.', need:'node:SENSE@4' } ] },
          { l:'Semi-solid inject', cap:'Inject a slushy metal for tight structure.', need:'node:COMPUTE@5', kids:[
            { l:'Thixo billet', cap:'Reheat a special billet to slurry.' },
            { l:'Vacuum superalloy foundry', cap:'Vacuum melt-and-pour cell casting finished superalloy parts.', tag:'crucible', need:'node:STORE@5', kids:[
              { l:'Directional-pour turbine', cap:'Pour and freeze a whole bladed turbine wheel with the grain steered along the load — a finished rotor out of one cast.', need:'node:FAB-CHEM@5', kids:[
                { l:'Superalloy foundry-cell', cap:'A vacuum foundry that melts, pours, heat-treats and inspects finished hot-section parts end to end with no hand on them — jet-grade metal by the pallet, lights-out.', act:'productionize', tag:'crucible', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Forging', cap:'Beat or squeeze solid stock into shape while hot.', act:'forge', tag:'plate', need:'power', kids:[
        { l:'Drop hammer', cap:'Slam stock into a die with a falling weight.', tag:'plate', kids:[
          { l:'Open-die draw', cap:'Work a billet freehand under the hammer.', kids:[
            { l:'Grain flow', cap:'Steer the metal grain along loads.', need:'node:COMPUTE@4' },
            { l:'Reheat furnace', cap:'Soak the billet back to forging heat.', add:true, need:'power' } ] },
          { l:'Closed-die set', cap:'Trap the stock in matched dies for form.', tag:'plate', kids:[
            { l:'Flash trim', cap:'Shear the squeezed-out flash clean.' },
            { l:'Multi-station', cap:'Step the part through several dies.', add:true } ] } ] },
        { l:'Press forge', cap:'Squeeze slowly with huge steady force.', tag:'plate', need:'power', kids:[
          { l:'Isothermal die', cap:'Hold die and part at one temperature.', need:'power', kids:[
            { l:'Synth-lube film', cap:'Use a synthesized die lubricant.', add:true, need:'node:FAB-CHEM@4' },
            { l:'Superplastic form', cap:'Stretch fine-grain alloy like taffy.', need:'node:COMPUTE@5', kids:[
              { l:'Net-shape superplastic part', cap:'Stretch a fine-grain alloy like warm taffy into a finished thin, complex shape — a whole wing rib or bulkhead in one slow press, no machining after.', tag:'plate', need:'node:COMPUTE@5' } ] } ] },
          { l:'Ring roll', cap:'Roll a pierced billet into a seamless ring.', kids:[
            { l:'Profile roll', cap:'Roll a shaped cross-section in one pass.' },
            { l:'Milspec disc forge', cap:'Press cell forging finished aerospace discs to spec.', tag:'plate', need:'node:STORE@5', kids:[
              { l:'Grain-flow-perfect disc', cap:'Forge a turbine disc whose grain wraps every contour unbroken, so it spins at red heat without ever throwing a blade.', need:'node:SENSE@5', kids:[
                { l:'Aerospace disc forge-cell', cap:'A press cell that forges, heat-treats and spin-tests finished flight-critical discs unattended, each one traceable grain-to-grain — the part a life hangs on, made without a witness.', act:'productionize', tag:'plate', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Powder metallurgy', cap:'Press and sinter metal powder into near-net parts.', act:'sinter', tag:'core', need:'power', kids:[
        { l:'Die compact', cap:'Press powder into a green shape.', tag:'core', kids:[
          { l:'Lubricant mix', cap:'Blend lube so it presses and ejects clean.', kids:[
            { l:'Double press', cap:'Press twice for higher density.', add:true },
            { l:'Sinter furnace', cap:'Bond the powder below melting.', need:'power' } ] },
          { l:'Atomised powder', cap:'Make fine spherical powder in-house.', tag:'feed', need:'seal', kids:[
            { l:'Gas atomize', cap:'Blast melt with gas into droplets.', need:'power' },
            { l:'Synth-alloy powder', cap:'Alloy the melt from synthesized feedstock.', need:'node:FAB-CHEM@4', kids:[
              { l:'Bespoke-alloy powder', cap:'Atomise a made-to-order alloy that exists nowhere else — mix the periodic table to taste, then print or press it into a part.', tag:'feed', need:'node:FAB-CHEM@5' } ] } ] } ] },
        { l:'Hot isostatic press', cap:'Squeeze powder from all sides while hot to full density.', tag:'core', need:'seal', kids:[
          { l:'Canister fill', cap:'Seal powder in a can before pressing.', need:'seal', kids:[
            { l:'Degas bake', cap:'Bake out gas before sealing.', add:true, need:'power' },
            { l:'Encapsulate glass', cap:'Glass shell transmits pressure evenly.' } ] },
          { l:'Cycle control', cap:'Ramp heat and pressure on a set curve.', need:'node:COMPUTE@5', kids:[
            { l:'Defect heal', cap:'Close internal voids under pressure.' },
            { l:'Near-net HIP cell', cap:'Corp cell pressing finished full-density parts to shape.', tag:'core', need:'node:STORE@5', kids:[
              { l:'Full-density exotic part', cap:'Press a flawless, pore-free part out of an alloy too brittle or refractory to cast or forge any other way.', need:'node:FAB-FORGE@5', kids:[
                { l:'HIP production-cell', cap:'A hot-isostatic cell that cans, presses, de-cans and finishes full-density exotic parts in one unbroken run — the densest metal a factory can make, unattended.', act:'productionize', tag:'core', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Exotic materials', cap:'Grow crystals and build lattices ordinary heat can\'t; bleeding-edge.', act:'grow', tag:'crucible', need:'node:COMPUTE@5', kids:[
        { l:'Single-crystal grow', cap:'Pull one flawless crystal from the melt.', tag:'crucible', need:'power', kids:[
          { l:'Seed pull', cap:'Dip a seed and draw the crystal slow.', kids:[
            { l:'Zone refine', cap:'Sweep a melt zone to push out impurities.', need:'power' },
            { l:'Thermal-gradient hold', cap:'Hold a steep gradient for clean growth.', need:'node:SENSE@4' } ] },
          { l:'Directional solidify', cap:'Freeze grain in one direction for strength.', need:'power', kids:[
            { l:'Grain selector', cap:'Spiral filter passes one grain only.' },
            { l:'Monocrystal blade forge', cap:'Grow a finished single-crystal turbine blade with no grain boundaries.', tag:'crucible', need:'node:STORE@5', kids:[
              { l:'Cooled single-crystal blade', cap:'Grow a hollow single-crystal blade with its own internal cooling maze — one seamless crystal that runs hotter than its own melting point and lives.', need:'node:FAB-ADDITIVE@5', kids:[
                { l:'Monocrystal hot-section foundry', cap:'A foundry that grows finished single-crystal hot-section parts to order, each one grain-boundary-free — the metal that lets a turbine run white-hot, cast by the crate with no operator.', act:'productionize', tag:'crucible', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] },
        { l:'Metamaterial build', cap:'Assemble sub-wavelength lattices for exotic properties.', tag:'matrix', need:'node:COMPUTE@5', kids:[
          { l:'Lattice press', cap:'Compact a designed unit-cell lattice.', tag:'matrix', kids:[
            { l:'Composite layup', cap:'Stack fibre plies for armour lattice.', add:true, need:'node:FAB-ADDITIVE@4' },
            { l:'Negative-index cell', cap:'Tune the lattice to bend energy backward.', need:'node:COMPUTE@5', kids:[
              { l:'Cloaking metamaterial', cap:'A lattice that bends radar or light clean around whatever it wraps — the first real step to a thing the eye and the scanner simply cannot find.', tag:'matrix', need:'node:SENSE@5' } ] } ] },
          { l:'Gradient armour', cap:'Grade stiffness through the thickness to beat impact.', tag:'plate', need:'node:COMPUTE@5', kids:[
            { l:'Energy-shed layer', cap:'Layer that spreads and sheds a hit.' },
            { l:'Metamaterial armour press', cap:'Corp press forming finished negative-index armour lattices.', tag:'matrix', need:'node:STORE@5', kids:[
              { l:'Adaptive-armour lattice', cap:'A lattice that stiffens where it is struck and stays supple everywhere else — armour that hardens to the blow and flows the rest of the time.', need:'node:COMPUTE@6', kids:[
                { l:'Metamaterial armour foundry', cap:'A press line turning out finished adaptive armour panels — light as cloth, hard as plate under a hit, radar-quiet — by the sheet, unattended.', act:'productionize', tag:'matrix', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] } ] },
    BIOFAB: { l:'Biofab', cap:'Grow living matter and bioware; Biotechnica-flavour vat-tech; Bio Tech.', kids:[
      { l:'Vat productionizer', cap:'Turn one proven culture into a repeatable vat production line.', act:'productionize' },

      { l:'Tissue culture', cap:'Grow cells in a controlled dish or bioreactor.', act:'culture', tag:'vat', need:'seal', kids:[
        { l:'Sterile incubator', cap:'Warm, clean box to grow cells; backroom grade.', tag:'vat', kids:[
          { l:'Media feed', cap:'Trickle nutrient broth to the cells.', tag:'feed', kids:[
            { l:'Synth media', cap:'Cook the growth broth from synthesized precursors.', need:'node:FAB-CHEM@4' },
            { l:'Gas exchange', cap:'Balance oxygen and CO2 for the culture.', add:true, need:'seal' } ] },
          { l:'Contamination guard', cap:'Kill and lock out microbes that would spoil the batch.', need:'seal', kids:[
            { l:'Antibiotic dose', cap:'Meter antibiotics into the media.', add:true },
            { l:'Laminar hood', cap:'Clean airflow keeps the bench sterile.', need:'power' } ] } ] },
        { l:'Stirred bioreactor', cap:'Scale cells up in a stirred, monitored tank.', tag:'vat', need:'power', kids:[
          { l:'Perfusion loop', cap:'Swap spent media without dumping cells.', tag:'feed', kids:[
            { l:'Cell-density read', cap:'Track how thick the culture grows.', need:'node:SENSE@4' },
            { l:'Harvest spin', cap:'Centrifuge out the grown cells.', kids:[
              { l:'Immortalized cell line', cap:'A cell line that never stops dividing — bank one donor once and draw an endless, identical supply forever after.', tag:'vat', need:'node:STORE@5' } ] } ] },
          { l:'Suspension line', cap:'Grow anchor-free cells at volume.', need:'node:COMPUTE@5', kids:[
            { l:'Feedback feed', cap:'Trim nutrients from live readings.', need:'node:COMPUTE@5' },
            { l:'Continuous harvest cell', cap:'Corp line that grows and harvests cell mass nonstop.', tag:'vat', need:'node:STORE@5', kids:[
              { l:'Cultured-meat vat', cap:'Grow real muscle and fat as food, tonnes a week, no animal — a protein plant in a warehouse.', need:'node:FAB-CHEM@5', kids:[
                { l:'Biomass production-plant', cap:'A lights-out vat farm turning cheap feedstock into tonnes of finished cell mass a day — food, medicine or raw tissue stock — with no farm, no herd and no hand on it.', act:'productionize', tag:'vat', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Vat organs', cap:'Grow whole tissues and organs on a scaffold in a vat.', act:'grow', tag:'vat', need:'seal', kids:[
        { l:'Scaffold seed', cap:'Seed cells onto a shaped support.', tag:'matrix', need:'node:FAB-ADDITIVE@4', kids:[
          { l:'Bioprint layup', cap:'Print cell-laden gel into tissue shape.', tag:'nozzle', kids:[
            { l:'Decell scaffold', cap:'Strip a donor organ to bare matrix, reseed it.', add:true, need:'seal' },
            { l:'Vascular channel', cap:'Print blood channels so thick tissue lives.', need:'node:COMPUTE@5', kids:[
              { l:'Perfused organ print', cap:'Print a whole organ already plumbed with a working blood supply, so it lives and matures the moment it leaves the head — no dead core.', tag:'nozzle', need:'node:COMPUTE@5' } ] } ] },
          { l:'Maturation bath', cap:'Exercise the graft until it works.', tag:'vat', kids:[
            { l:'Mechanical cue', cap:'Flex and load the tissue as it grows.', need:'power' },
            { l:'Perfusion mature', cap:'Pump nutrients through the whole organ.', need:'node:FAB-CHEM@4' } ] } ] },
        { l:'Graft finishing', cap:'Ready a graft for a living host.', tag:'vat', need:'seal', kids:[
          { l:'Immune match', cap:'Tune surface markers to the patient.', need:'node:COMPUTE@4', kids:[
            { l:'Autologous line', cap:'Grow it from the patient\'s own cells.' },
            { l:'Cryo bank', cap:'Freeze grafts for shelf stock.', add:true, need:'power' } ] },
          { l:'Whole-organ vat', cap:'Grow a complete transplant organ end to end.', tag:'vat', need:'node:COMPUTE@5', kids:[
            { l:'Innervate stage', cap:'Wire nerves into the grown organ.' },
            { l:'Vat-clone full body', cap:'A vat that grows a complete blank clone body to order.', tag:'vat', need:'node:STORE@5', kids:[
              { l:'Blank-clone maturation', cap:'Age a blank clone body to adulthood in months, muscles exercised and organs run in, ready for harvest or transfer.', need:'node:FAB-CHEM@5', kids:[
                { l:'Clone-body foundry', cap:'A vat hall growing finished blank clone bodies to order — spare parts, doubles, or worse — matured, catalogued and cold-stored with nobody asking what they are for.', act:'productionize', tag:'vat', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Bioware synth', cap:'Grow living implants that fuse with a host; ripperdoc chrome\'s wet cousin.', act:'graft', tag:'cyberware', need:'seal', kids:[
        { l:'Living implant', cap:'Culture a graft meant to be surgically installed.', tag:'cyberware', need:'node:COMPUTE@4', kids:[
          { l:'Neural interface', cap:'Grow a living nerve tap for control links.', tag:'cyberware', need:'node:LINK@4', kids:[
            { l:'Host graft cuff', cap:'Grow a cuff that knits into host nerve.' },
            { l:'Living neural lace', cap:'Grow a mesh of living nerve through the cortex that reads and writes thought at the speed of the brain itself — chrome that heals in instead of scarring over.', tag:'cyberware', need:'node:LINK@5' } ] },
          { l:'Gland implant', cap:'Grow a gland that secretes on command.', tag:'cyberware', kids:[
            { l:'Dose regulate', cap:'Build in feedback so it can\'t overdose.', add:true, need:'node:SENSE@4' },
            { l:'Synth-hormone charge', cap:'Prime it with a synthesized compound.', need:'node:FAB-CHEM@4' } ] } ] },
        { l:'Self-repair tissue', cap:'Engineer grafts that heal their own damage.', tag:'cyberware', need:'node:COMPUTE@5', kids:[
          { l:'Regen program', cap:'Set genes that trigger regrowth on injury.', need:'node:COMPUTE@5', kids:[
            { l:'Stem reserve', cap:'Seed dormant stem cells for repairs.' },
            { l:'Scar suppress', cap:'Block scarring so repair is clean.', add:true } ] },
          { l:'Living machine', cap:'Fuse grown tissue onto a hardware chassis.', tag:'cyberware', need:'node:FAB-ADDITIVE@5', kids:[
            { l:'Bio-hardware bond', cap:'Bond living tissue to a printed frame.', need:'node:FAB-ADDITIVE@5' },
            { l:'Self-repairing machine', cap:'A device whose living tissue regrows its own broken parts.', tag:'cyberware', need:'node:STORE@5', kids:[
              { l:'Regenerating chassis', cap:'A machine whose whole living skin and structure knit shut over damage — shoot it, cut it, and by morning it has healed the way flesh does.', need:'node:COMPUTE@6', kids:[
                { l:'Living-machine forge', cap:'A vat line that grows finished self-healing machines — part hardware, part flesh — to order, each one able to nurse itself back from wounds that would scrap any built thing.', act:'productionize', tag:'cyberware', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] } ] },

      { l:'Gene tailoring', cap:'Rewrite genomes and build organisms from designed code; Bio Tech apex.', act:'edit', tag:'matrix', need:'node:COMPUTE@5', kids:[
        { l:'Gene edit', cap:'Cut and rewrite an existing genome.', tag:'matrix', need:'node:COMPUTE@5', kids:[
          { l:'Guide design', cap:'Design the edit targeting on compute.', need:'node:COMPUTE@5', kids:[
            { l:'Off-target check', cap:'Screen edits for stray cuts.', need:'node:COMPUTE@5' },
            { l:'Delivery vector', cap:'Package the edit to reach the cells.', need:'node:FAB-CHEM@4' } ] },
          { l:'Trait stack', cap:'Layer several edits into one line.', kids:[
            { l:'Marker screen', cap:'Select cells that took the edit.', add:true, need:'node:SENSE@4' },
            { l:'Germline lock', cap:'Fix the trait so it breeds true.', kids:[
              { l:'Designer-trait line', cap:'A living line carrying a whole stack of chosen traits that breeds them true forever — strength, colour, resistance, obedience, written in and locked.', tag:'matrix', need:'node:COMPUTE@5' } ] } ] } ] },
        { l:'Synthetic genome', cap:'Write a genome from scratch and boot a cell on it.', tag:'matrix', need:'node:COMPUTE@5', kids:[
          { l:'Genome assemble', cap:'Stitch synthesized DNA into a full genome.', need:'node:FAB-CHEM@5', kids:[
            { l:'Codon optimize', cap:'Tune the code so the cell reads it well.', need:'node:COMPUTE@5' },
            { l:'Boot cell', cap:'Install the genome into a blank shell cell.', need:'seal' } ] },
          { l:'Designer organism', cap:'A synthetic life-form built to a written specification.', tag:'matrix', need:'node:COMPUTE@5', kids:[
            { l:'Metabolic wiring', cap:'Route its metabolism to make what you want.', need:'node:FAB-CHEM@5' },
            { l:'Synthetic-organism line', cap:'Boot and breed a whole population of the designed organism, stable generation on generation.', need:'node:COMPUTE@6', kids:[
              { l:'Self-improving organism', cap:'An organism written to edit and better its own genome each generation, evolving on command toward a goal you set — life as programmable, self-optimising code.', need:'node:COMPUTE@6', kids:[
                { l:'Bespoke bioware forge', cap:'A corp line that designs, grows and ships synthetic organisms and living bioware to spec on demand — write the spec, and a new form of life walks out to fill it.', act:'productionize', tag:'matrix', arch:'corpo', need:'node:STORE@6', needsAll:['gene-tailoring.synthetic-genome.genome-assemble.boot-cell','bioware-synth.self-repair-tissue.living-machine.self-repairing-machine'] } ] } ] } ] } ] } ] } ] },
    // ── OFFENSE: weaponised electricity ──
    SHOCK: { l:'Shock', cap:'weaponised electricity, for flesh and for circuits', kids:[
      { l:'Contact discharge', cap:'hand-to-target current dumped through a touched conductor', tag:'arc', kids:[
        { l:'Stun baton', cap:'a charged tip that drops a body on contact', tag:'arc', kids:[
          { l:'Complex-pulse driver', cap:'a shaped 19-pulse-per-second waveform tuned to lock skeletal muscle', act:'stun', kids:[
            { l:'Dry-skin arc-over', cap:'a 50kV leader pulse that bridges clothing before the muscle pulse lands', kids:[
              { l:'Pain-compliance dial', cap:'ride the current up and down to hurt without dropping', sc:{max:3,per:'step'}, kids:[
                { l:'Cardiac-lock waveform', cap:'a chest-vector pulse train timed to seize the heart\'s own rhythm', act:'kill', need:'node:COMPUTE@5', arch:'corpo' } ] } ] } ] },
          { l:'Wet-contact spike', cap:'a low-impedance jolt for soaked or armoured targets', need:'power', kids:[
            { l:'Capacitor dump', cap:'one massive single-shot discharge from a charged bank', tag:'core', need:'power' },
            { l:'Rechucking bank', cap:'a fast-refilling bank for repeat jolts', sc:{max:3,per:'shot'}, need:'power' } ] },
          { l:'Grip conductor', cap:'the whole handle is live, so any grab is a shock', tag:'wire' } ] },
        { l:'Bladed conductor', cap:'an edged weapon that carries current into the wound', tag:'edge', kids:[
          { l:'Electro-edge', cap:'a live blade that shocks along the cut', tag:'edge' },
          { l:'Barb-and-tether', cap:'a fired barb trailing a live wire back to the driver', tag:'wire', kids:[
            { l:'Twin-dart spread', cap:'two darts to complete the muscle-locking circuit across a body', kids:[
              { l:'Drive-stun fallback', cap:'press the emptied unit to skin for direct pain', kids:[
                { l:'Neuro-map targeting', cap:'aim the dart pair to cross the densest motor-nerve bundles', need:'node:SENSE@5', arch:'corpo' } ] } ] } ] } ] } ] },
      { l:'Projected arc', cap:'a bolt thrown across open air to a target', tag:'arc', need:'power', kids:[
        { l:'Ionised channel', cap:'a laser or plasma trail that guides the bolt to where you aim', act:'zap', need:'power', kids:[
          { l:'Laser-guided leader', cap:'a UV filament pre-ionises the air so lightning follows it', need:'node:SENSE@4', kids:[
            { l:'Range-extend coil', cap:'stack driver stages to throw the bolt further', sc:{max:3,per:'stage'}, need:'power', kids:[
              { l:'Chain-jump routing', cap:'let the bolt leap target to target down a crowd', act:'chain', need:'node:COMPUTE@4', kids:[
                { l:'Chain-lightning bus', cap:'a computed multi-arc that forks through a whole packed room at once', act:'chain', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Gauss-launched dart', cap:'a wire-trailing slug flung by coilgun to carry the arc', tag:'ammo', need:'power' } ] },
        { l:'Arc projector head', cap:'the muzzle stack that shapes and aims the bolt', tag:'emitter', need:'power', kids:[
          { l:'Focusing horn', cap:'a shaped bore that tightens the bolt into a spear', tag:'emitter' },
          { l:'Rapid-strike cadence', cap:'a fast repeat of thrown bolts', sc:{max:3,per:'bolt'}, need:'power' },
          { l:'Weapon underslung mount', add: true, cap:'a rail so the projector rides a host weapon', takes:'barrel' } ] } ] },
      { l:'Area field', cap:'a charged zone that shocks anything inside it', tag:'coil', need:'power', kids:[
        { l:'Electrified surface', cap:'a floor, fence or grate turned into a live plate', tag:'plate', need:'power', kids:[
          { l:'Puddle-conduction net', cap:'run current through wet ground to widen the kill-zone', sc:{max:3,per:'metre'}, need:'power', kids:[
            { l:'Motion-gated trip', cap:'only energise when a body steps into the zone', need:'node:SENSE@4', kids:[
              { l:'Friend-or-foe skip', cap:'read tagged allies and leave gaps around them', need:'node:COMPUTE@5', kids:[
                { l:'Rolling area-denial grid', cap:'a self-sequencing field that walks live cells across a plaza to herd crowds', act:'deny', need:'node:POWER@6', arch:'corpo' } ] } ] } ] },
          { l:'Perimeter loop', cap:'a charged tripwire ring around a position', tag:'wire', need:'power' } ] },
        { l:'Broadcast field', cap:'an emitter that fills the air of a space with charge', tag:'coil', need:'power', kids:[
          { l:'Capacitive coupling', cap:'dump charge into anything conductive nearby, no wires', need:'power' },
          { l:'Zone-size dial', cap:'trade draw for radius', sc:{max:3,per:'metre'}, need:'power' },
          { l:'Standing-charge trap', cap:'leave a primed field that fires on entry', need:'node:SENSE@4' } ] } ] },
      { l:'Induction-EMP', cap:'a pulse that kills electronics and chrome, not flesh', tag:'core', need:'power', kids:[
        { l:'Narrow microwaver', cap:'a tight beam that scrambles a single target\'s cyberware', act:'fry', need:'node:HACK@4', kids:[
          { l:'Cyberware-seek lock', cap:'find and hold the beam on implanted electronics', need:'node:SENSE@5', kids:[
            { l:'Neural-interface crash', cap:'push the pulse into interface plugs to drop reflexes', act:'crash', need:'node:HACK@5', kids:[
              { l:'Implant-ID payload', cap:'read the model of the chrome, then feed it its own kill-code', need:'node:HACK@5', kids:[
                { l:'Neural-crash grid-killer', cap:'a coded pulse that hard-bricks every unshielded implant and node in a block', act:'brick', need:'node:HACK@6', arch:'corpo' } ] } ] } ] } ] },
        { l:'Area e-bomb', cap:'an omnidirectional burst that fuses nearby circuits', tag:'warhead', need:'power', kids:[
          { l:'Flux-compression core', cap:'an explosive-pumped coil that makes the pulse from a bang', tag:'core', need:'power' },
          { l:'Burst-radius dial', cap:'scale the dead-zone against charge cost', sc:{max:3,per:'metre'}, need:'power' },
          { l:'Shielded-safe timer', add: true, cap:'a delay so your own gear is powered down first', need:'node:COMPUTE@4' } ] } ] } ] },

    // -- SUBSTRATE: the four base capacities everything else gates on --
    COMPUTE: { l:'Compute', cap:'raw thinking substrate: it recognizes, analyzes, predicts and decides', act:'compute', kids:[
      { l:'Brute simulation', cap:'models the world by grinding numbers until it matches reality', kids:[
        { l:'Physics grinder', cap:'solves the equations of matter in real time', tag:'core', kids:[
          { l:'Fluid-stress solver', cap:'predicts how gas, metal and flesh will deform under load', tag:'core' },
          { l:'Ballistic pre-play', cap:'runs the shot before the trigger to place it perfectly', need:'node:POWER@3', kids:[
            { l:'Trajectory oracle', cap:'plots every arc and pick the one that lands' },
            { l:'Outcome forecaster', cap:'scores each possible future by likelihood of success', need:'node:POWER@4', kids:[
              { l:'Precognition lattice', cap:'holds thousands of branching futures at once', need:'node:STORE@5', kids:[
                { l:'Precog engine', cap:'sees the next several seconds before they happen; two or three corps on Earth can build one', arch:'corpo', need:'node:POWER@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Monte-Carlo bank', cap:'throws millions of random trials to find the odds', kids:[
          { l:'Parallel dice farm', cap:'runs the trials in massive parallel', add:true },
          { l:'Variance pruner', cap:'kills the useless branches to converge faster' }
        ]}
      ]},
      { l:'Pattern recognition', cap:'finds the meaningful signal buried in noise', kids:[
        { l:'Feature extractor', cap:'reduces raw sensory flood to the parts that matter', kids:[
          { l:'Face-gait matcher', cap:'identifies a person by face and walk in a crowd', need:'node:SENSE@2', kids:[
            { l:'Crowd tracker', cap:'follows many targets through a moving mob at once' },
            { l:'Intent reader', cap:'reads micro-tells to guess what a target will do next', need:'node:SENSE@4', kids:[
              { l:'Deep-learning cortex', cap:'trains itself on lived data to sharpen its guesses', need:'node:STORE@5', kids:[
                { l:'Self-aware true-AI', cap:'a mind that knows it is a mind; the kind of thing the Blackwall was built to cage', arch:'corpo', bridge:'net' }
              ]}
            ]}
          ]},
          { l:'Signature classifier', cap:'sorts signals into known device and threat types', kids:[
            { l:'Spoof rejector', cap:'refuses forged or decoy signatures' }
          ]}
        ]},
        { l:'Anomaly flagger', cap:'raises an alarm on anything outside the learned normal', kids:[
          { l:'Baseline learner', cap:'builds a picture of ordinary so it can spot the odd' },
          { l:'Novelty alarm', add: true, cap:'flags the never-before-seen for human review' }
        ]}
      ]},
      { l:'Expert reasoning', cap:'chains stored rules to reach a defensible verdict', kids:[
        { l:'Rule base', cap:'holds the encoded knowledge of a human specialist', tag:'core', kids:[
          { l:'Knowledge editor', cap:'lets a techie add and revise rules by hand' },
          { l:'Conflict resolver', cap:'decides which rule wins when two collide' }
        ]},
        { l:'Inference chainer', cap:'walks the rules from facts toward a conclusion', kids:[
          { l:'Forward chainer', cap:'starts from what is known and asks what follows', kids:[
            { l:'Diagnosis synth', cap:'names the fault or disease from the symptoms' },
            { l:'Strategy planner', cap:'lays out a step-by-step plan to reach a goal', need:'node:STORE@4', kids:[
              { l:'Autonomous advisor', cap:'acts on its own conclusions without a human in the loop', kids:[
                { l:'Self-rewriting intellect', cap:'edits its own code to get smarter each cycle; a seed-AI intelligence spiral', arch:'corpo', need:'node:POWER@6' }
              ]}
            ]}
          ]},
          { l:'Backward chainer', cap:'starts from a goal and works out why it happened' }
        ]}
      ]},
      { l:'Swarm cognition', cap:'thinks as many cheap minds acting in concert', kids:[
        { l:'Agent mesh', cap:'a web of small units sharing state in real time', need:'node:LINK@2', kids:[
          { l:'Consensus voter', cap:'the swarm settles disputes by weighted vote' },
          { l:'Task allocator', cap:'hands each unit the job it is best placed to do', need:'node:LINK@3', kids:[
            { l:'Emergent tactician', cap:'group behavior no single unit was told to perform', kids:[
              { l:'Collective mind', cap:'the swarm behaves as one distributed intelligence', need:'node:LINK@5', kids:[
                { l:'Hive-mind overmind', cap:'a single will spread across a thousand bodies; fails gracefully, never all at once', arch:'corpo', bridge:'net' }
              ]},
              { l:'Oracle swarm', cap:'fuses branching foresight with swarm allocation into a planning superweapon', needsAll:['brute-simulation.physics-grinder.ballistic-pre-play.outcome-forecaster.precognition-lattice','swarm-cognition.agent-mesh.task-allocator'], arch:'corpo' }
            ]},
            { l:'Redundancy healer', add: true, cap:'reassigns work instantly when a unit is lost' }
          ]}
        ]},
        { l:'Stigmergy board', cap:'units coordinate by leaving marks in the environment', kids:[
          { l:'Pheromone trail', cap:'leaves fading signals that guide the next unit' },
          { l:'Gradient follower', cap:'climbs the strongest trail toward the objective' }
        ]}
      ]}
    ]},
    POWER: { l:'Power', cap:'the energy source that feeds every hungry system on the rig', act:'power', kids:[
      { l:'Chemical burn', cap:'releases stored chemical energy as heat and motion', kids:[
        { l:'Combustion core', cap:'burns fuel in a tiny engine for raw output', tag:'core', kids:[
          { l:'Microturbine', cap:'a palm-sized turbine that gulps alcohol fuel for high power', tag:'core', kids:[
            { l:'Silent baffle', add: true, cap:'muffles exhaust so the rig runs quiet', tag:'filter' },
            { l:'Multifuel intake', cap:'accepts any grade of alcohol or hydro without retuning', kids:[
              { l:'Endurance flow-cell', cap:'pumps liquid reactant through cells for marathon runtime', need:'node:FABRICATE@5', kids:[
                { l:'Corpo flow-reactor', cap:'closed-loop flow plant that runs for days on a single charge; only corp labs cast the membranes', arch:'corpo' }
              ]}
            ]}
          ]},
          { l:'Catalytic burner', cap:'flameless catalytic heat for a low signature', tag:'emitter' }
        ]},
        { l:'Thermoelectric skin', cap:'harvests trickle power from body and waste heat', tag:'weave', kids:[
          { l:'Body-heat tap', add: true, cap:'draws current from the wearer\'s own warmth' },
          { l:'Waste-heat scavenger', cap:'reclaims heat other systems throw away', add:true }
        ]}
      ]},
      { l:'Cell stack', cap:'stores charge electrochemically for instant draw', tag:'core', kids:[
        { l:'Solid-oxygen pack', cap:'dense rechargeable pack rated in hours of hard use', tag:'cell', kids:[
          { l:'Hot-swap bay', add: true, cap:'lets a depleted pack be dropped and replaced in seconds', tag:'core', takes:'cell' },
          { l:'Fast-charge port', cap:'refills the pack in minutes from a wall or vehicle', kids:[
            { l:'Surge buffer', add: true, cap:'soaks charge spikes so the cells survive fast refills' },
            { l:'Density stack', cap:'packs more charge into the same volume', kids:[
              { l:'Cryo-superconductor bank', cap:'stores current in a cooled superconducting loop with near-zero loss', need:'node:FABRICATE@5', kids:[
                { l:'Corpo lattice cell', cap:'room-stable superconducting cell holding a vehicle\'s energy in a fist-sized brick', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Superconductor loop', cap:'circulates a persistent current with no resistance', tag:'wire', kids:[
          { l:'Persistent current', cap:'holds a charge spinning indefinitely once set' },
          { l:'Quench guard', add: true, cap:'dumps energy safely if the loop loses coolant' }
        ]}
      ]},
      { l:'Fuel-cell', cap:'converts fuel to electricity directly, quietly and cleanly', kids:[
        { l:'Membrane stack', cap:'the proton membrane where fuel meets air to make current', tag:'core', kids:[
          { l:'Proton exchanger', cap:'the working layer that splits and shuttles ions' },
          { l:'Combined cell-battery', cap:'a fuel-cell paired with a buffer battery for a full day of sealed operation', kids:[
            { l:'Field-swap module', cap:'the whole unit lifts out and swaps in the field', kids:[
              { l:'Silent long-endurance rig', cap:'runs near-silent with almost no heat plume for stealth ops', kids:[
                { l:'Corpo whisper-cell', cap:'a fuel-cell with no acoustic or thermal signature at all; milspec black-program tech', arch:'corpo' }
              ]}
            ]},
            { l:'Sealed rebreather tap', add: true, cap:'shares the cell\'s oxygen loop for underwater sealed running', need:'seal' }
          ]}
        ]},
        { l:'Reformer feed', cap:'cracks raw fuel into what the cell can burn', kids:[
          { l:'Alcohol cracker', cap:'reforms cheap CHOOH2 into usable hydrogen' },
          { l:'Hydrogen splitter', cap:'strips clean hydrogen from stored hydro' }
        ]}
      ]},
      { l:'Micro-fusion', cap:'fuses light nuclei for enormous output from a gram of fuel', kids:[
        { l:'Magnetic pinch', cap:'crushes plasma with magnetic fields to ignite fusion', tag:'core', kids:[
          { l:'Containment coil', cap:'the field cage that holds the burning plasma off the walls', need:'node:FABRICATE@4', kids:[
            { l:'Neutron shield', add: true, cap:'blocks radiation so the wearer is not cooked', tag:'plate' },
            { l:'Ignition driver', cap:'delivers the precise pulse that starts the burn', need:'node:COMPUTE@5', kids:[
              { l:'Sustained burn chamber', cap:'keeps the reaction self-feeding instead of one-shot', kids:[
                { l:'Corpo pocket reactor', cap:'a briefcase fusion plant powering a full borg for a year; two corps on Earth make them', arch:'corpo' }
              ]}
            ]}
          ]},
          { l:'Signature masker', add: true, cap:'hides the tell-tale neutron and heat bloom', tag:'reflec' }
        ]},
        { l:'Exotic vacuum tap', cap:'draws power from quantum vacuum fluctuations', kids:[
          { l:'Casimir array', cap:'stacks nanoplates to nudge energy from empty space' },
          { l:'Squeezed-field coupler', cap:'modulates vacuum modes to bleed out real photons', add:true }
        ]}
      ]}
    ]},
    STORE: { l:'Store', cap:'local autonomous memory that holds data on the rig itself', act:'store', bridge:'data', kids:[
      { l:'Solid-state', cap:'stores bits in silicon with no moving parts', tag:'drive', kids:[
        { l:'Flash array', cap:'cheap dense chips that keep data with the power off', tag:'core', kids:[
          { l:'Wear leveller', add: true, cap:'spreads writes so the cells last for years' },
          { l:'Ruggedized block', cap:'survives shock, heat and hard street abuse', tag:'core', kids:[
            { l:'Shock potting', add: true, cap:'encases the chips so a fall cannot crack them', tag:'plate' },
            { l:'Dead-man wipe', cap:'erases everything if tampering is detected', need:'node:COMPUTE@4', kids:[
              { l:'Air-gapped vault', cap:'never touches a network, so it cannot be hacked remotely', bridge:'data', kids:[
                { l:'Corpo dead-man store', cap:'self-destructing air-gapped archive that zeroes on the wrong pulse; the kind couriers die guarding', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Phase-change matrix', cap:'writes bits by melting and freezing a smart alloy', tag:'core', kids:[
          { l:'Multi-level cell', add: true, cap:'stores several bits per cell for more capacity' },
          { l:'Endurance trim', cap:'tunes the melt cycle to extend rewrite life', add:true }
        ]}
      ]},
      { l:'Optical-holographic', cap:'stores data as light patterns through a whole volume', tag:'core', kids:[
        { l:'Volume hologram', cap:'writes pages of data through the depth of a medium', kids:[
          { l:'Reference beam', cap:'the fixed beam that reads a page back out' },
          { l:'Photorefractive film', cap:'a light-sensitive layer that records the pattern' }
        ]},
        { l:'Crystal lattice', cap:'burns data deep into a solid crystal block', tag:'core', kids:[
          { l:'Angular multiplex', cap:'stacks many pages at different beam angles' },
          { l:'Petascale write', cap:'floods the crystal with a petabyte per block', need:'node:POWER@4', kids:[
            { l:'Parallel read head', add: true, cap:'pulls a whole page at once, not bit by bit' },
            { l:'Deep-layer stack', cap:'writes hundreds of layers through the crystal depth', kids:[
              { l:'Cold crystal archive', cap:'chilled block that holds data for centuries untouched', bridge:'data', kids:[
                { l:'Corpo petascale crystal', cap:'a sugar-cube crystal holding a corp\'s entire datavault; only corp fabs grow them flawless', arch:'corpo' }
              ]}
            ]}
          ]}
        ]}
      ]},
      { l:'Molecular-DNA', cap:'encodes data in synthetic DNA at absurd density', tag:'core', kids:[
        { l:'Base sequencer', cap:'reads the base sequence back into bits', kids:[
          { l:'Nanopore reader', cap:'threads strands through a pore to read them fast' },
          { l:'Density packer', add: true, cap:'crams exabytes into a speck of powder' }
        ]},
        { l:'Enzyme writer', cap:'synthesizes new strands to record fresh data', tag:'core', kids:[
          { l:'Synthesis pool', cap:'the wet bath where strands are built to order' },
          { l:'Error corrector', cap:'adds redundancy so a decayed strand still reads', need:'node:COMPUTE@4', kids:[
            { l:'Random-access index', cap:'finds one file among trillions without reading all' },
            { l:'Self-repair strand', cap:'rebuilds damaged data from its own backups', kids:[
              { l:'Crystal-sealed genome', cap:'coats the DNA in mineral crystal to last millennia', bridge:'data', kids:[
                { l:'Corpo immortal vault', cap:'a self-healing DNA archive that survives fire, flood and centuries; a corp\'s black-box memory', arch:'corpo' }
              ]}
            ]}
          ]}
        ]}
      ]},
      { l:'Wet-neural-engram', cap:'stores lived experience the way a brain does', tag:'core', kids:[
        { l:'Synaptic gel', cap:'a living gel substrate that holds memory like tissue', kids:[
          { l:'Living substrate', cap:'cultured neurons that store and recall patterns' },
          { l:'Nutrient loop', cap:'feeds and oxygenates the gel to keep it alive', need:'node:POWER@3' }
        ]},
        { l:'Engram tap', cap:'records the full sensory stream of an experience', tag:'core', kids:[
          { l:'Sensory scribe', cap:'captures sight, sound, touch and feeling as one track', need:'node:SENSE@3', kids:[
            { l:'Full-sense capture', cap:'records every channel a body feels at once' },
            { l:'Playback fidelity', cap:'replays the track indistinguishable from living it', need:'node:COMPUTE@5', kids:[
              { l:'Braindance master', cap:'the pristine first-generation recording, not a copy', bridge:'data', kids:[
                { l:'Corpo engram vault', cap:'braindance-grade store holding whole lifetimes at studio fidelity; the source XBDs are cut from', arch:'corpo' }
              ]}
            ]}
          ]},
          { l:'Emotion layer', cap:'tags the recording with the feelings that ran under it', add:true }
        ]}
      ]}
    ]},
    GUIDE: { l:'Guide', cap:'targeting and guidance substrate that finds and follows a target', act:'lock-on', tag:'seeker', kids:[
      { l:'Emission-homing', cap:'homes on energy the target itself gives off', tag:'seeker', kids:[
        { l:'Heat seeker', cap:'tracks the thermal bloom of an engine or a body', tag:'seeker', need:'node:SENSE@2', kids:[
          { l:'Two-color IR', cap:'compares two infrared bands to tell target from flare', need:'node:SENSE@3' },
          { l:'Flare rejector', cap:'ignores decoy flares by their wrong burn profile' }
        ]},
        { l:'Radar homer', cap:'tracks the radar reflection bouncing off the target', kids:[
          { l:'Active nose radar', cap:'carries its own transmitter to light the target itself', kids:[
            { l:'Doppler filter', add: true, cap:'strips out slow clutter and stationary chaff' },
            { l:'Counter-countermeasure', cap:'defeats jamming that tries to blind the seeker', need:'node:COMPUTE@4', kids:[
              { l:'Frequency hopper', cap:'skips across bands faster than a jammer can follow', kids:[
                { l:'Corpo frequency-agile head', cap:'a seeker that rewrites its own waveform mid-flight to beat any jammer; milspec top-tier', arch:'corpo' }
              ]}
            ]}
          ]},
          { l:'Home-on-jam', cap:'if jammed, it flies straight down the jamming beam', add:true }
        ]}
      ]},
      { l:'Designation-following', cap:'follows a mark a friendly places on the target', kids:[
        { l:'Laser rider', cap:'flies to the spot of laser light painted on the target', tag:'seeker', kids:[
          { l:'Spot tracker', cap:'locks the reflected laser dot and rides it in', need:'node:SENSE@3', kids:[
            { l:'Handoff protocol', cap:'accepts a target painted by a different spotter', need:'node:LINK@4', kids:[
              { l:'Relay lase net', cap:'a chain of spotters pass the paint down a network', need:'node:LINK@5', kids:[
                { l:'Corpo buddy-lase relay', cap:'a team lases a target no single member can see, handing the lock around a building; corp special-ops kit', arch:'corpo' }
              ]}
            ]},
            { l:'Jitter reject', cap:'holds lock even when the spotter\'s hand shakes' }
          ]},
          { l:'Coded pulse lock', cap:'only rides its own coded laser, not the enemy\'s' }
        ]},
        { l:'Beam-riding wire', cap:'steers down a physical wire or beam from the shooter', kids:[
          { l:'Fiber spool', cap:'trails an unjammable fiber back to the operator', tag:'wire' },
          { l:'Command uplink', cap:'lets the operator fly it by hand to the last meter' }
        ]}
      ]},
      { l:'Inertial-predictive', cap:'guides by dead reckoning and a predicted intercept', kids:[
        { l:'Gyro platform', cap:'holds a stable reference to know where it is', tag:'core', kids:[
          { l:'Ring-laser gyro', cap:'a laser gyro that never drifts on a short flight' },
          { l:'Drift corrector', cap:'trims accumulated error against known landmarks' }
        ]},
        { l:'Lead computer', cap:'aims where the target will be, not where it is', kids:[
          { l:'Track predictor', cap:'projects the target\'s path from its recent motion', need:'node:COMPUTE@3', kids:[
            { l:'Last-known solver', cap:'flies to the target\'s last seen point when it hides' },
            { l:'Blind-flight path', cap:'navigates with no lock at all, purely on prediction', need:'node:COMPUTE@5', kids:[
              { l:'Terminal reacquire', cap:'pops its sensor back on at the last second to reconfirm', need:'node:SENSE@5', kids:[
                { l:'Corpo around-corner shot', cap:'flies a blind curved path to strike a target it never had line-of-sight to; corp assassination-grade', arch:'corpo' }
              ]}
            ]}
          ]},
          { l:'Waypoint runner', cap:'threads a set of pre-plotted points to the kill box' }
        ]}
      ]},
      { l:'Vision-terminal', cap:'recognizes the target by its image in the final seconds', need:'node:SENSE@2', kids:[
        { l:'Image lock', cap:'matches a live picture to hold the target visually', tag:'seeker', need:'node:SENSE@2', kids:[
          { l:'Template match', cap:'compares the view to a stored picture of the target', need:'node:COMPUTE@3', kids:[
            { l:'Target library', cap:'carries a memory of specific faces or vehicles to hunt', need:'node:STORE@4' },
            { l:'Self-select logic', cap:'picks its own target from a class of valid ones', need:'node:COMPUTE@5', kids:[
              { l:'Loiter hunter', cap:'orbits an area waiting for a valid target to appear', need:'node:LINK@5', kids:[
                { l:'Corpo brilliant seeker', cap:'a fire-and-forget mind that loiters, chooses and strikes the highest-value target alone; two or three corps build them', arch:'corpo' }
              ]},
              { l:'Autonomous kill-web', cap:'fuses image recognition with predictive tracking so it kills through cover on its own judgment', needsAll:['vision-terminal.image-lock.template-match','inertial-predictive.lead-computer.track-predictor'], arch:'corpo' }
            ]}
          ]},
          { l:'Aimpoint picker', cap:'chooses the weak spot on the target to hit' }
        ]},
        { l:'Scene classifier', cap:'reads the whole scene to sort friend, foe and clutter', kids:[
          { l:'Clutter reject', cap:'discards background that looks target-like' },
          { l:'IFF gate', cap:'refuses to fire on a tagged friendly in the frame', need:'node:LINK@3' }
        ]}
      ]}
    ]},

    // -- OFFENSE --
    BURN: { l:'Burn', cap:'directed heat, for the shop floor and the kill', kids:[
      { l:'Cutting and welding', cap:'a concentrated flame or arc that parts and joins metal', tag:'torch', need:'power', kids:[
        { l:'Oxy-fuel torch', cap:'a fuel-and-oxygen flame for street-garage cutting', tag:'torch', kids:[
          { l:'Cutting-oxygen jet', cap:'a lance of oxygen that burns a pre-heated steel kerf', act:'cut', kids:[
            { l:'Gouge-and-bevel head', cap:'a wide tip that scoops metal instead of slicing', tag:'torch', kids:[
              { l:'Fine-kerf regulator', cap:'meter gas for a clean narrow parting line', kids:[
                { l:'Precision seam-welder', cap:'a computer-paced bead that lays flawless structural welds', act:'weld', need:'node:COMPUTE@5', arch:'corpo' } ] } ] } ] },
          { l:'Backpack rig', cap:'a portable tank-and-hose kit for field work', tag:'core' } ] },
        { l:'Plasma arc', cap:'an ionised jet near 40,000 degrees that cuts conductive metal fast', tag:'torch', need:'power', kids:[
          { l:'Constricted nozzle', cap:'a fine bore that tightens the jet for a sharp cut', tag:'emitter', need:'power', kids:[
            { l:'Pilot-arc starter', cap:'a spark that lights the arc without touching the work', need:'power', kids:[
              { l:'High-amp transferred arc', cap:'route the arc through the target for deep thick-plate cuts', sc:{max:3,per:'amp-step'}, need:'power', kids:[
                { l:'Vault-breach cutting-lance', cap:'a sustained plasma lance that opens hardened vault steel on a surveyed line', act:'breach', need:'node:DEMOLISH@6', arch:'corpo' } ] } ] } ] },
          { l:'Twin-torch setup', cap:'paired anodic and cathodic torches to cut non-conductive stock', need:'power' } ] } ] },
      { l:'Incineration', cap:'spreading fire to deny or destroy an area', tag:'core', need:'power', kids:[
        { l:'Sticky fuel spray', cap:'a clinging burning gel thrown across a frontage', tag:'ammo', need:'seal', kids:[
          { l:'Thickened-fuel mix', cap:'a gel that sticks and keeps burning on a target', tag:'ammo', need:'seal', kids:[
            { l:'Spread-nozzle fan', cap:'widen the throw into a sheet of flame', tag:'emitter', sc:{max:3,per:'metre'}, kids:[
              { l:'Air-draw intensifier', cap:'pull ambient air in to run the fire hotter and self-sustaining', need:'power', kids:[
                { l:'Self-feeding firestorm', cap:'a computed burn that spawns its own convection column and marches with the wind', act:'raze', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Pilot igniter', cap:'a small always-lit flame to light the stream', tag:'torch' } ] },
        { l:'Thermite scatter', cap:'a shower of self-oxidising burning metal', tag:'ammo', need:'fabricate', kids:[
          { l:'Metal-oxide charge', cap:'a fuel-and-oxide mix that burns without outside air', tag:'charge', need:'fabricate' },
          { l:'Submunition spread', cap:'many small burning pellets over a footprint', sc:{max:3,per:'pellet'}, need:'fabricate' },
          { l:'Delay fuse', cap:'a timed light so it fires after it lands', need:'node:COMPUTE@4' } ] } ] },
      { l:'Lance and boring', cap:'burning a hole straight through heavy mass', tag:'lance', need:'power', kids:[
        { l:'Thermic lance', cap:'an oxygen-fed iron bar that burns at 3,871 to 4,426 degrees C', tag:'lance', need:'seal', kids:[
          { l:'Alloy-rod fuel pack', cap:'aluminium-laced rods that push the burn hotter', tag:'ammo', need:'seal', kids:[
            { l:'Oxygen-boost feed', cap:'flood the bar with oxygen to bore through 500mm-plus concrete', sc:{max:3,per:'bar'}, need:'seal', kids:[
              { l:'Self-consuming reload', cap:'auto-index fresh rods as the bar burns down', need:'node:COMPUTE@4', kids:[
                { l:'Bunker-tap deep lance', cap:'a metres-long carriage-fed lance that drills through buried reinforced shelters', act:'bore', need:'node:DEMOLISH@6', arch:'corpo' } ] } ] } ] },
          { l:'Igniter torch', cap:'a starter flame to light the bar', tag:'torch' } ] },
        { l:'Powder lance', cap:'a metal-powder-fed bore for the deepest holes', tag:'lance', need:'seal', kids:[
          { l:'Blowpipe carriage', add:true, cap:'a mount that advances the lance steadily into the face', tag:'driver' },
          { l:'Depth-index dial', cap:'trade time and fuel for deeper penetration', sc:{max:3,per:'metre'}, need:'seal' },
          { l:'Molten-slag flush', cap:'clear the melt so the hole keeps advancing', need:'power' } ] } ] },
      { l:'Process heat', cap:'sustained industrial heat, off the battlefield', tag:'core', need:'power', kids:[
        { l:'Cooking and drying', cap:'controlled low heat for food and materials', tag:'core', kids:[
          { l:'Even-field element', cap:'a heater that holds a steady set temperature', tag:'core', kids:[
            { l:'Thermostat loop', cap:'sense and hold the target temperature automatically', need:'node:SENSE@4', kids:[
              { l:'Batch-throughput dial', cap:'scale the heated volume up for bulk runs', sc:{max:3,per:'batch'}, need:'power', kids:[
                { l:'Autonomous smelter-foundry', cap:'a self-tending furnace that melts, alloys and pours to spec unattended', act:'smelt', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Insulated jacket', add:true, cap:'a shell that keeps the heat in and hands safe', tag:'plate' } ] },
        { l:'Kiln and forge', cap:'high sustained heat for shaping and firing', tag:'core', need:'power', kids:[
          { l:'Refractory liner', add:true, cap:'a lining that survives repeated high-heat cycles', tag:'plate' },
          { l:'Fuel-feed regulator', cap:'meter fuel to hold a forge temperature', need:'power' },
          { l:'Crucible mount', add:true, cap:'a seat other vessels lock into for pouring', takes:'core' } ] } ] } ] },
    SONIC: { l:'Sonic', cap:'sound as an eye and as a weapon', kids:[
      { l:'Imaging sonar', cap:'pinging and listening to see through solids and murk', tag:'horn', need:'node:SENSE@3', kids:[
        { l:'Pulse-echo ranging', cap:'time a ping\'s round trip to map what reflects it', act:'ping', need:'node:SENSE@3', kids:[
          { l:'Beamform array', cap:'phase a grid of transducers to steer the beam with no moving parts', need:'node:COMPUTE@4', kids:[
            { l:'Doppler read', cap:'read frequency shift to see motion and flow behind cover', need:'node:COMPUTE@4', kids:[
              { l:'Micro-Doppler filter', cap:'pick out the tiny motions of breathing and a heartbeat', need:'node:COMPUTE@5', kids:[
                { l:'Through-wall imaging suite', cap:'a synthetic-aperture picture of rooms, bodies and vitals through solid walls', act:'scry', need:'node:SENSE@6', arch:'corpo' } ] } ] } ] },
          { l:'B-mode slice', cap:'map echo strength into a grayscale cross-section', need:'node:SENSE@4' } ] },
        { l:'Passive listen', cap:'stay silent and map targets by the sound they leak', need:'node:SENSE@4', kids:[
          { l:'Hydrophone rake', cap:'an array that finds bearing from radiated noise', need:'node:SENSE@4' },
          { l:'Cavitation signature', cap:'ID machinery by its bubble-collapse noise', need:'node:COMPUTE@4' },
          { l:'Sub-bottom profiler', cap:'low chirps that read layers and voids beneath a surface', need:'node:SENSE@5' } ] } ] },
      { l:'Crowd hail', cap:'painfully loud directional sound to move or drop people', tag:'horn', need:'power', kids:[
        { l:'Directional array', cap:'a narrow 160dB beam aimed like a spotlight', act:'blast', need:'power', kids:[
          { l:'Discomfort-band tone', cap:'ride the 2-4kHz band that hurts the most', need:'power', kids:[
            { l:'Range-focus dial', cap:'tighten the beam to reach across two thousand metres', sc:{max:3,per:'step'}, need:'power', kids:[
              { l:'Deafen pulse', cap:'a spike that overloads the ear and drops balance', act:'deafen', need:'node:COMPUTE@4', kids:[
                { l:'Riot-wall sound barrier', cap:'a computed standing wall of sound that no crowd can walk into', act:'repel', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Voice-of-god overlay', cap:'push clear commands through the same beam', need:'node:COMPUTE@4' } ] },
        { l:'Nausea projector', cap:'tones tuned to wreck the inner ear and stomach', tag:'horn', need:'power', kids:[
          { l:'Vestibular sweep', cap:'sweep frequencies to keep the balance system reeling', need:'power' },
          { l:'Dwell-time dial', cap:'longer exposure for stronger effect', sc:{max:3,per:'sec'}, need:'power' },
          { l:'Ally-safe null', cap:'carve a quiet cone where your team stands', need:'node:COMPUTE@4' } ] } ] },
      { l:'Resonance shatter', cap:'driving a target at its own frequency until it breaks', tag:'resonator', need:'power', kids:[
        { l:'Frequency finder', cap:'sweep and listen to find what a material rings at', act:'tune', need:'node:SENSE@4', kids:[
          { l:'Ring-up driver', cap:'pump energy in on the beat to build the oscillation', need:'power', kids:[
            { l:'Coupled-emitter phasing', cap:'align several emitters so their energy stacks on the target', need:'node:COMPUTE@5', kids:[
              { l:'Fracture-point focus', cap:'aim the stacked energy at the weakest joint or weld', need:'node:COMPUTE@5', kids:[
                { l:'Structural-collapse tone', cap:'a driven resonance that walks a load-bearing frame to failure', act:'collapse', need:'node:POWER@6', arch:'corpo' } ] } ] } ] },
          { l:'Glass-shatter preset', cap:'a stored tone that bursts brittle panes on command', need:'node:COMPUTE@4' } ] },
        { l:'Internal-organ resonance', cap:'frequencies that couple into soft tissue', tag:'resonator', need:'power', kids:[
          { l:'Body-cavity tuning', cap:'match the resonance of chest and gut cavities', need:'node:SENSE@5' },
          { l:'Focus-depth dial', cap:'trade spread for penetrating power', sc:{max:3,per:'step'}, need:'power' },
          { l:'Lethal-dose lockout', cap:'a governor that can be lifted for kill settings', need:'node:COMPUTE@4' } ] } ] },
      { l:'Infrasound', cap:'sub-hearing pressure that works on the mind', tag:'resonator', need:'power', kids:[
        { l:'Sub-20Hz driver', cap:'a slow pressure wave felt in the body, not heard', act:'unnerve', need:'power', kids:[
          { l:'Eyeball-resonance tone', cap:'the ~19Hz band that smears vision and reads as dread', need:'power', kids:[
            { l:'Cortisol-spike sweep', cap:'hold the band to drive stress and irritability up', need:'node:COMPUTE@4', kids:[
              { l:'Area-fill diffuser', cap:'flood a whole enclosed space with the pressure', sc:{max:3,per:'metre'}, need:'power', kids:[
                { l:'Dread-engine panic field', cap:'a computed infrasound field that seeds mass panic and rout in a sealed crowd', act:'panic', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Silent-carrier hide', add:true, cap:'mask the driver so victims never know the source', need:'node:COMPUTE@4' } ] },
        { l:'Concussion pulse', cap:'a single low-frequency thump that staggers', tag:'resonator', need:'power', kids:[
          { l:'Pressure-step charge', cap:'build the thump\'s peak against draw', sc:{max:3,per:'step'}, need:'power' },
          { l:'Repeat cadence', cap:'a drumbeat of thumps to keep targets reeling', need:'power' },
          { l:'Wall-bounce shaping', cap:'use surfaces to focus the thump indoors', need:'node:SENSE@4' } ] } ] } ] },
    DEMOLISH: { l:'Demolish', cap:'taking structures apart, loud or silent', kids:[
      { l:'Thermal cutting', cap:'burning through the load-bearing members', tag:'lance', need:'power', kids:[
        { l:'Burning bar', cap:'an oxygen-fed lance that parts steel and stone', tag:'lance', need:'seal', kids:[
          { l:'Rebar-sever pass', cap:'cut the reinforcing steel inside the concrete', act:'sever', need:'node:BURN@4', kids:[
            { l:'Aggregate-melt sweep', cap:'melt the silica so the concrete falls away from the bar', need:'node:BURN@5', kids:[
              { l:'Column-cut sequence', cap:'part the members in the order a collapse needs', need:'node:COMPUTE@5', kids:[
                { l:'Rebar-and-concrete thermal parter', cap:'an auto-fed lance rig that cleanly severs whole reinforced columns to a drop plan', act:'part', need:'node:BURN@6', arch:'corpo' } ] } ] } ] },
          { l:'Slag-clear jet', cap:'blow the melt out of the cut to keep it advancing', need:'power' } ] },
        { l:'Thermite-cut charge', cap:'a self-oxidising jet that lances through a beam', tag:'charge', need:'fabricate', kids:[
          { l:'Linear-nozzle jet', cap:'shape the thermite into a knife-line cut', tag:'charge', need:'fabricate' },
          { l:'Cut-depth dial', cap:'more charge for thicker members', sc:{max:3,per:'member'}, need:'fabricate' },
          { l:'Ignition delay', cap:'a timed light for staged cuts', need:'node:COMPUTE@4' } ] } ] },
      { l:'Hydraulic-mechanical', cap:'silent brute force that splits mass from within', tag:'driver', need:'power', kids:[
        { l:'Bursting head', cap:'wedges driven into drilled holes to crack concrete', tag:'driver', need:'power', kids:[
          { l:'Pre-drill pattern', cap:'a hole layout that steers where the cracks run', act:'drill', need:'node:COMPUTE@4', kids:[
            { l:'Multi-head manifold', cap:'gang many bursters to reach thousand-ton splitting force', sc:{max:3,per:'head'}, need:'power', kids:[
              { l:'Vibration-free stroke', cap:'expand slowly so nothing shakes and nobody hears', need:'power', kids:[
                { l:'Silent hydraulic vault-cracker', cap:'a computed burster array that opens a vault with no noise, dust or tremor', act:'crack', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Jaw-and-shear head', cap:'a powered jaw that bites through rebar and pipe', tag:'edge', need:'power' } ] },
        { l:'Splitting ram', cap:'a piston that pries a crack wide open', tag:'driver', need:'power', kids:[
          { l:'Feather-and-wedge set', add:true, cap:'a shim pack that levers a drilled hole apart', tag:'driver' },
          { l:'Force-step dial', cap:'ramp pressure against the stone\'s limit', sc:{max:3,per:'step'}, need:'power' },
          { l:'Crack-monitor feedback', add:true, cap:'watch the split and stop before overshoot', need:'node:SENSE@4' } ] } ] },
      { l:'Chemical dissolution', cap:'eating the material instead of breaking it', tag:'injector', need:'node:FAB-CHEM@3', kids:[
        { l:'Acid attack', cap:'an acid that dissolves the cement binder', tag:'injector', need:'node:FAB-CHEM@3', kids:[
          { l:'Binder-target gel', cap:'a clinging gel that seeps in and rots the paste', need:'node:FAB-CHEM@4', kids:[
            { l:'Rebar-debond etch', cap:'strip the bond so steel pulls free of the concrete', need:'node:FAB-CHEM@4', kids:[
              { l:'Neutralise-and-vent cycle', cap:'quench fumes and residue as it works', need:'node:COMPUTE@4', kids:[
                { l:'Structural-solvent bath', cap:'a metered solvent flood that turns a footing back to loose sand and aggregate', act:'dissolve', need:'node:FAB-CHEM@6', arch:'corpo' } ] } ] } ] },
          { l:'Expansive grout', cap:'a slurry that swells in the hole and splits stone soundlessly', tag:'charge', need:'node:FAB-CHEM@4' } ] },
        { l:'Nanite disassembly', cap:'a swarm that takes matter apart molecule by molecule', tag:'core', need:'node:FABRICATE@4', kids:[
          { l:'Feedstock-seek crawl', cap:'nanites that hunt a target material to consume', need:'node:FABRICATE@5', kids:[
            { l:'Bond-cleave routine', cap:'break the specific bonds of the chosen material', need:'node:COMPUTE@5', kids:[
              { l:'Replication governor', cap:'cap the swarm so it stops before grey-goo runaway', need:'node:COMPUTE@5', kids:[
                { l:'Nanite disassembler swarm', cap:'a governed cloud that reduces a whole structure to sorted raw stock', act:'unmake', need:'node:FABRICATE@6', arch:'corpo' } ] } ] } ] },
          { l:'Kill-switch broadcast', cap:'a signal that safely halts and drops the swarm', need:'node:HACK@4' } ] } ] },
      { l:'Resonance fatigue', cap:'shaking a structure to death at its own beat', tag:'resonator', need:'node:SONIC@3', kids:[
        { l:'Modal survey', cap:'find the frequencies a building actually rings at', act:'survey', need:'node:SONIC@4', kids:[
          { l:'Sway-driver mount', cap:'clamp a shaker to a member and pump the mode', need:'node:SONIC@4', kids:[
            { l:'Phase-lock pump', cap:'stay exactly on the beat so energy keeps stacking', need:'node:COMPUTE@5', kids:[
              { l:'Damper-defeat sweep', cap:'shift as the structure stiffens to beat its tuned dampers', need:'node:COMPUTE@5', kids:[
                { l:'Structural-collapse resonance driver', cap:'a locked-on driver that walks a whole frame past its load limit to failure', act:'topple', need:'node:SONIC@6', arch:'corpo' } ] } ] } ] },
          { l:'Joint-fatigue focus', cap:'aim the shaking at welds and connections', need:'node:SONIC@4' } ] },
        { l:'Impact resonator', cap:'rhythmic hammer-blows tuned to the sway', tag:'impact', need:'power', kids:[
          { l:'Cadence-match timer', cap:'time each blow to the return swing', need:'node:COMPUTE@4' },
          { l:'Blow-force dial', cap:'heavier strikes against bigger mass', sc:{max:3,per:'step'}, need:'power' },
          { l:'Anchor bracing', add:true, cap:'a footing so the recoil goes into the target', tag:'plate' } ] } ] },
      { l:'Surveyed sapping', cap:'engineered charges placed for a controlled drop', tag:'charge', need:'fabricate', kids:[
        { l:'Shaped charge', cap:'a lined charge that forms a metal jet to cut a member', tag:'charge', need:'fabricate', kids:[
          { l:'Linear cutting charge', cap:'a V-liner that slices steel joists along a line', tag:'charge', need:'fabricate', kids:[
            { l:'Standoff-tune mount', cap:'set the gap so the jet forms fully before it hits', need:'node:COMPUTE@4', kids:[
              { l:'Hinge-point placement', cap:'cut so the structure rotates inward as it falls', need:'node:COMPUTE@5', kids:[
                { l:'Surveyed precision-collapse drop', cap:'a millisecond-sequenced charge plan that implodes a tower into its own footprint', act:'implode', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'User-fill liner', add:true, cap:'a field-loadable charge body for improvised cuts', tag:'charge', need:'fabricate' } ] },
        { l:'Delay-sequence net', cap:'timed detonators that fire members in order', tag:'core', need:'node:COMPUTE@4', kids:[
          { l:'Millisecond timer bank', cap:'stagger blasts down to the millisecond', need:'node:COMPUTE@4' },
          { l:'Stage-count dial', cap:'more delay stages for taller drops', sc:{max:3,per:'stage'}, need:'node:COMPUTE@4' },
          { l:'Flyrock tamping', cap:'mats and wraps to contain the scatter', tag:'plate' } ] } ] } ] },
    RESTRAIN: { l:'Restrain', cap:'stopping a body from moving or leaving', kids:[
      { l:'Adhesion and grapple', cap:'sticking, snaring and cinching a target in place', tag:'snare', kids:[
        { l:'Tacky bolus', cap:'an expanding sticky mass that entangles limbs', tag:'ammo', need:'seal', kids:[
          { l:'Expand-on-air foam', cap:'a liquid that swells 30-to-60 times into a clinging web', act:'mire', need:'seal', kids:[
            { l:'Airway-safe formula', cap:'a mix that pins without smothering', need:'node:FAB-CHEM@4', kids:[
              { l:'Solvent-release pair', cap:'a matched solvent so your side can free the catch', need:'node:FAB-CHEM@4', kids:[
                { l:'Adaptive binder harness', cap:'a smart adhesive that re-grips wherever a target strains against it', act:'bind', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Multi-shot dispenser', cap:'a rig that fires several boluses before reload', sc:{max:3,per:'shot'}, need:'seal' } ] },
        { l:'Snare line', cap:'a fired cord or net that wraps and holds', tag:'snare', kids:[
          { l:'Weighted spread net', cap:'a net that opens over a runner and drops them', tag:'snare', kids:[
            { l:'Cinch-tight drawline', cap:'a line that pulls the wrap closed on motion', kids:[
              { l:'Barbed anchor set', cap:'flukes that bite ground or wall to fix the catch', kids:[
                { l:'Self-cinching capture web', cap:'a computed net that reads struggle and ratchets tighter each move', act:'ensnare', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Grapple-and-reel', cap:'a hook and winch to haul a target in', tag:'wire', need:'power' } ] } ] },
      { l:'Containment field', cap:'holding a target inside an energised or physical shell', tag:'closed', need:'power', kids:[
        { l:'Rigid enclosure', cap:'bars or panels that box a target', tag:'plate', kids:[
          { l:'Fast-deploy cage', cap:'a frame that springs up around a target', tag:'plate', kids:[
            { l:'Auto-latch seam', cap:'edges that lock the instant they meet', kids:[
              { l:'Load-sense reinforce', cap:'stiffen where a captive pushes hardest', need:'node:SENSE@5', kids:[
                { l:'Stasis containment cell', cap:'a field-braced pod that immobilises and life-supports even boosted captives', act:'contain', need:'node:POWER@6', arch:'corpo' } ] } ] } ] },
          { l:'Drop-over shell', cap:'a dome dropped onto a target from above', tag:'closed' } ] },
        { l:'Restraint field', cap:'an energised volume that resists movement', tag:'coil', need:'power', kids:[
          { l:'Damping envelope', cap:'a field that makes every motion feel like wading', need:'power' },
          { l:'Field-strength dial', cap:'more draw for a stronger hold', sc:{max:3,per:'step'}, need:'power' },
          { l:'Breach-alarm trip', add:true, cap:'signal the instant the field is tested', need:'node:SENSE@4' } ] } ] },
      { l:'Area lockdown', cap:'sealing a space so no one moves through it', tag:'closed', need:'power', kids:[
        { l:'Choke-point seal', cap:'shutters and barriers that slam a passage closed', tag:'plate', need:'power', kids:[
          { l:'Fast-shutter drop', cap:'a barrier that falls faster than a runner can clear it', act:'seal', need:'power', kids:[
            { l:'Interlock chain', cap:'link many seals so one trip closes them all', need:'node:COMPUTE@4', kids:[
              { l:'Occupancy tracker', cap:'count and place every body in the sealed zone', need:'node:SENSE@5', kids:[
                { l:'Zone-quarantine lockdown', cap:'a computed sweep that seals, tracks and herds everyone in a whole block', act:'lockdown', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Deploy-barrier line', cap:'a rolled wall that unspools across an opening', tag:'plate' } ] },
        { l:'Denial floor', cap:'a surface made too painful or slick to cross', tag:'plate', need:'power', kids:[
          { l:'Slick-gel spread', add:true, cap:'a coating that kills all footing', tag:'ammo', need:'seal' },
          { l:'Coverage dial', cap:'wider spread for a bigger no-go patch', sc:{max:3,per:'metre'}, need:'seal' },
          { l:'Ally-tag bypass', add:true, cap:'leave safe lanes for tagged friendlies', need:'node:COMPUTE@4' } ] } ] },
      { l:'Chemical incapacitation', cap:'putting a target down and keeping them down', tag:'injector', need:'node:FAB-CHEM@3', kids:[
        { l:'Contact sedative', cap:'an agent that drops a target through skin or breath', tag:'injector', need:'node:FAB-CHEM@3', kids:[
          { l:'Aerosol dispersal', cap:'a fine mist that sedates a small volume', act:'sedate', need:'seal', kids:[
            { l:'Dose-meter valve', cap:'measure the agent to the target\'s mass', need:'node:INJECT@4', kids:[
              { l:'Vitals-watch loop', cap:'monitor breathing so the dose never turns lethal', need:'node:SENSE@5', kids:[
                { l:'Sealed sleep-gas cell', cap:'a self-dosing sealed pod that keeps a captive under and alive indefinitely', act:'subdue', need:'node:FAB-CHEM@6', arch:'corpo' } ] } ] } ] },
          { l:'Dart injector', cap:'a fired needle that delivers the dose at range', tag:'ammo', need:'node:INJECT@4' } ] },
        { l:'Adaptive counter-escape', cap:'a restraint that learns and beats escape attempts', tag:'core', need:'node:COMPUTE@4', kids:[
          { l:'Tamper-sense skin', cap:'feel picking, cutting or twisting on the binder', need:'node:SENSE@4', kids:[
            { l:'Escape-pattern model', cap:'recognise the moves of a boosted escapist', need:'node:COMPUTE@5', kids:[
              { l:'Counter-move actuator', cap:'shift and re-lock to defeat each attempt', need:'node:COMPUTE@5', kids:[
                { l:'Learning counter-escape restraint', cap:'a binder that studies a captive and pre-empts every boosted break it has seen', act:'outlast', need:'node:COMPUTE@6', arch:'corpo' } ] } ] } ] },
          { l:'Over-tighten governor', cap:'an auto double-lock that holds fast without crushing', need:'node:SENSE@4' } ] } ] } ] },

    // -- PERCEPTION & INFORMATION --
    VISION: { l:'Vision', cap:'A standalone cyber-optic with switchable augmentation modes.', kids:[
      { l:'Magnify', cap:'Optical magnification axis.', kids:[
        { l:'Telescopic bump', cap:'Pull distant targets closer.', kids:[
          { l:'Fixed 4x glass', cap:'A cheap set-power lens.', tag:'lens' },
          { l:'Variable zoom', cap:'Smoothly adjustable magnification.', kids:[
            { l:'Digital crop-zoom', cap:'Enlarge by cropping pixels; softens the image.' },
            { l:'Optical zoom train', cap:'True glass zoom with no quality loss.', tag:'lens', kids:[
              { l:'Image-stabilized barrel', add:true, cap:'Cancel hand-shake and vehicle vibration blur.' },
              { l:'Sniper-grade tele', cap:'Extreme-range target identification optic.', kids:[
                { l:'Atmospheric de-shimmer', add:true, cap:'Compute out heat-haze distortion at distance.', need:'node:COMPUTE@6' },
                { l:'Milspec precog tele-optic', cap:'Sees, ranges and pre-aims a target at a kilometre.', arch:'corpo', need:'node:GUIDE@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Micro-scope', cap:'Magnify the very close and very small.', kids:[
          { l:'Macro-focus lens', cap:'Sharp focus on near objects.', tag:'lens' },
          { l:'Cellular micro-optic', cap:'Resolve microscopic surface structure.', need:'node:SENSE@4' }
        ]},
        { l:'Range-compute', cap:'Measure distance and pre-focus.', need:'node:COMPUTE@4', kids:[
          { l:'Laser rangefinder overlay', cap:'Read exact distance to a marked point.' },
          { l:'Auto-focus predictor', cap:'Pre-focus on where a mover will be.' }
        ]}
      ]},
      { l:'Spectral', cap:'Switchable non-visible imaging modes.', need:'node:SENSE@4', kids:[
        { l:'Low-lite', cap:'Amplify scarce ambient light.', need:'node:SENSE@4', kids:[
          { l:'Analog image-intensify', cap:'Cheap green-glow light amplifier.' },
          { l:'Photon-gain stack', cap:'Stacked gain for near-dark scenes.', kids:[
            { l:'Auto-bloom guard', add:true, cap:'Suppress blowout from sudden bright sources.' },
            { l:'Starlight clarity', cap:'Clean full-colour image under starlight.', kids:[
              { l:'Moonless see', cap:'Usable vision on a fully overcast night.' },
              { l:'Zero-lux well', cap:'Draw an image from almost no photons.', kids:[
                { l:'Thermal-blend layer', cap:'Fuse a heat channel into the low-lite image.', need:'node:SENSE@6' },
                { l:'Corpo omni-nighteye', cap:'A see-through-dark optic that never needs light.', arch:'corpo', need:'node:SENSE@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Thermograph', cap:'Read emitted body and machine heat.', need:'node:SENSE@4', kids:[
          { l:'Passive IR map', cap:'False-colour heat picture.' },
          { l:'Heat-signature read', add:true, cap:'Flag warm bodies behind thin cover.' }
        ]},
        { l:'UV optic', cap:'See ultraviolet reflectance and glow.', need:'node:SENSE@4', kids:[
          { l:'UV fluoresce mode', cap:'Make treated marks and fluids glow.' },
          { l:'Forgery-glow read', cap:'Reveal document and note security inks.' }
        ]}
      ]},
      { l:'Overlay', cap:'A data HUD painted onto vision.', need:'node:COMPUTE@4', kids:[
        { l:'Data tags', cap:'Float labels over the world.', tag:'overlay', kids:[
          { l:'Static label layer', cap:'Fixed pre-set annotations.' },
          { l:'Live ID tag', cap:'Tag people and objects as recognised.', need:'node:COMPUTE@4', kids:[
            { l:'Friend-foe color', cap:'Colour-code allies and threats.' },
            { l:'Networked tag-share', cap:'Push your tags to a shared feed.', need:'node:LINK@4', bridge:'net', kids:[
              { l:'Squad marker sync', cap:'Every member sees the same markers.' },
              { l:'Shared-sight HUD', cap:'See through a teammate\'s eyes on demand.', need:'node:LINK@5', kids:[
                { l:'Pooled-vision grid', cap:'Blend the whole squad\'s optics into one view.' },
                { l:'Corpo tactical panopticon', cap:'A citywide shared-sight lock feeding every operator.', arch:'corpo', need:'node:LINK@6', bridge:'net' }
              ]}
            ]}
          ]}
        ]},
        { l:'Record-tap', cap:'Route the optic feed into a recorder.', need:'node:RECORD@4', tag:'reel', kids:[
          { l:'Snapshot buffer', add:true, cap:'Freeze the last few seconds on command.' },
          { l:'Loop recall', add:true, cap:'Rolling buffer you can scrub back through.' }
        ]},
        { l:'Reticle', cap:'An aiming mark in the field of view.', kids:[
          { l:'Static crosshair', cap:'A simple fixed aim mark.' },
          { l:'Smart reticle', cap:'Reticle that leads and links to a weapon.', need:'node:GUIDE@4' }
        ]}
      ]},
      { l:'Threat', cap:'Interpret what vision sees for danger.', need:'node:COMPUTE@4', kids:[
        { l:'Recognition', cap:'Identify faces, gear and posture.', need:'node:COMPUTE@4', kids:[
          { l:'Face-match', cap:'Match a face against a watchlist.' },
          { l:'Posture-read', cap:'Read body language for aggression.', need:'node:COMPUTE@4', kids:[
            { l:'Weapon-spotter', cap:'Flag drawn or concealed weapons.' },
            { l:'Intent-precog', cap:'Predict who is about to act.', need:'node:COMPUTE@4', kids:[
              { l:'Threat-heatmap', cap:'Rank everyone in view by danger.' },
              { l:'Precog threat-eye', cap:'Highlight the next shooter before they move.', kids:[
                { l:'Micro-tell read', cap:'Catch the involuntary pre-attack tells.', need:'node:COMPUTE@6' },
                { l:'Corpo oracle-eye', cap:'A threat-prediction optic that names the danger first.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Aim-assist', cap:'Help the eye put rounds on target.', need:'node:GUIDE@4', kids:[
          { l:'Auto-track box', cap:'Lock a moving target in a tracking box.' },
          { l:'Ballistic solve', cap:'Compute drop and lead for the shot.' }
        ]},
        { l:'Camo-defeat', cap:'Break optical concealment.', need:'node:SENSE@4', kids:[
          { l:'Motion-pop', cap:'Make hidden movement jump out.' },
          { l:'Marksman-fuse', cap:'Bind the sniper optic to the smart reticle for one-shot solves.', needsAll:['magnify.telescopic-bump.variable-zoom.optical-zoom-train.sniper-grade-tele','overlay.reticle.smart-reticle'] }
        ]}
      ]}
    ]},
    TRACK: { l:'Track', cap:'Follow a chosen target across an infrastructure.', kids:[
      { l:'Marker', cap:'Home on a tag you plant on the target.', need:'node:LINK@4', kids:[
        { l:'Stick-tag', cap:'A tag you physically attach.', tag:'beacon', kids:[
          { l:'Adhesive RFID bug', cap:'Cheap short-range stick-on chip.' },
          { l:'Active beacon', cap:'A powered tag that calls out its position.', need:'node:LINK@4', tag:'beacon', kids:[
            { l:'Burst-ping tag', add:true, cap:'Chirps location in brief bursts to save power.' },
            { l:'Mesh-relay tag', cap:'Tags relay each other to extend range.', need:'node:LINK@4', bridge:'net', kids:[
              { l:'Hop-to-hop relay', add:true, cap:'Signal hops tag to tag back to you.' },
              { l:'Swarm-tag cloud', cap:'A cloud of tiny tags covering an area.', need:'node:LINK@5', kids:[
                { l:'Self-healing mesh', cap:'The swarm reroutes around dead tags.' },
                { l:'Corpo orbital-relay tag', cap:'A tag that reaches you off a satellite backhaul anywhere.', arch:'corpo', need:'node:LINK@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Micro-dust tag', cap:'Near-invisible taggants.', kids:[
          { l:'Spray-on taggant', cap:'Mist that marks a person or vehicle.' },
          { l:'Ingestible marker', cap:'A marker that reads from inside the body.', need:'node:SENSE@4' }
        ]},
        { l:'Power-scavenge', cap:'Keep planted tags alive without batteries.', need:'node:POWER@4', kids:[
          { l:'Motion-harvest cell', cap:'Draw power from the target\'s movement.' },
          { l:'Trickle-solar skin', add:true, cap:'Sip ambient light to stay powered.' }
        ]}
      ]},
      { l:'Signature', cap:'Follow the target\'s own innate traces.', need:'node:SENSE@4', kids:[
        { l:'Emission-follow', cap:'Track energy the target radiates.', need:'node:SENSE@4', kids:[
          { l:'RF fingerprint', cap:'ID a target by its radio emissions.' },
          { l:'Thermal-trail', cap:'Follow a fading heat wake.', need:'node:SENSE@4', kids:[
            { l:'Residual-heat read', cap:'Read warm handprints and seats.' },
            { l:'Chem-scent trail', cap:'Follow a chemical odour plume.', need:'node:SENSE@4', kids:[
              { l:'Vapor-plume follow', cap:'Trace the drifting scent cone to source.' },
              { l:'Molecular sniff-lock', cap:'Lock one person\'s unique scent signature.', need:'node:COMPUTE@5', kids:[
                { l:'Parts-per-trillion read', cap:'Detect the faintest lingering trace.' },
                { l:'Corpo scent-hound lock', cap:'An unshakeable molecular lock on one individual.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Gait-follow', cap:'ID and follow by how they move.', need:'node:COMPUTE@4', kids:[
          { l:'Stride-signature', cap:'Recognise a unique walking pattern.' },
          { l:'Silhouette re-ID', cap:'Re-spot the same body across cameras.' }
        ]},
        { l:'Device-shadow', cap:'Trail the phones and gear they carry.', need:'node:HACK@4', bridge:'net', kids:[
          { l:'MAC-probe sniff', add:true, cap:'Catch a device begging for known networks.' },
          { l:'IMEI shadow-lock', cap:'Follow one handset across the grid.' }
        ]}
      ]},
      { l:'Predict', cap:'Model where the target is going.', need:'node:COMPUTE@4', kids:[
        { l:'Grid-project', cap:'Project the last position onto a map.', need:'node:COMPUTE@4', kids:[
          { l:'Last-seen vector', cap:'Draw heading from the last fix.' },
          { l:'Path-model', cap:'Model likely routes over the road net.', need:'node:COMPUTE@4', kids:[
            { l:'Road-network solve', cap:'Weight routes by real streets.' },
            { l:'Intercept-plot', cap:'Plot where you can cut them off.', need:'node:COMPUTE@4', kids:[
              { l:'Cutoff-point calc', add:true, cap:'Name the choke point to wait at.' },
              { l:'Citywide lock', cap:'Hand the target camera to camera across a city.', need:'node:LINK@5', bridge:'net', kids:[
                { l:'Camera-handoff net', cap:'Seamless track through the public camera mesh.' },
                { l:'Corpo panopticon lock', cap:'An unbreakable citywide lock the target can\'t escape.', arch:'corpo', need:'node:LINK@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Behavior-model', cap:'Learn the target\'s habits.', need:'node:COMPUTE@4', kids:[
          { l:'Routine-learn', cap:'Map their daily pattern.' },
          { l:'Habit-predict', cap:'Predict the next stop before they go.' }
        ]},
        { l:'Multi-target solve', cap:'Track many targets at once.', need:'node:COMPUTE@4', kids:[
          { l:'Crowd-track', cap:'Hold dozens of tracks in a crowd.' },
          { l:'Priority-rank', cap:'Rank which target matters most now.' }
        ]}
      ]},
      { l:'Ghost', cap:'Follow while leaving no trace.', need:'node:CLOAK@4', kids:[
        { l:'Passive-only', cap:'Track by listening, never emitting.', need:'node:SENSE@4', kids:[
          { l:'No-emit listen', cap:'Receive only; give off nothing.' },
          { l:'Standoff-tail', cap:'Follow from far enough to stay unseen.', need:'node:SENSE@4', kids:[
            { l:'Long-lens shadow', cap:'Keep visual from a block away.' },
            { l:'Drone-relay tail', cap:'A quiet drone does the following for you.', need:'node:CLOAK@4', kids:[
              { l:'High-altitude loiter', cap:'Watch from too high to notice.' },
              { l:'Phantom-swarm', cap:'Rotate silent drones so none lingers.', need:'node:CLOAK@5', kids:[
                { l:'Rotate-observer net', add:true, cap:'Swap watchers so no face repeats.' },
                { l:'Corpo zero-trace tail', cap:'A tail the target can never detect or shake.', arch:'corpo', need:'node:CLOAK@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Decoy-mask', cap:'Hide the fact of tracking.', need:'node:CLOAK@4', kids:[
          { l:'False-heat ghost', cap:'Throw a decoy heat signature.' },
          { l:'Signature-spoof', add:true, cap:'Mask your own emissions from counter-surveillance.' }
        ]},
        { l:'Fuse-lock', cap:'Bind planted tags to the citywide grid for a total lock.', needsAll:['marker.stick-tag.active-beacon.mesh-relay-tag.swarm-tag-cloud','predict.grid-project.path-model.intercept-plot.citywide-lock'], kids:[
          { l:'Blended-track', add:true, cap:'Merge tag pings with grid handoff.' },
          { l:'Handoff-to-grid', cap:'Drop planted tags onto the city map automatically.' }
        ]}
      ]}
    ]},
    ANALYZE: { l:'Analyze', cap:'Interpret sensed data into conclusions.', kids:[
      { l:'Threatmat', cap:'Detect threats and identify materials.', need:'node:SENSE@4', kids:[
        { l:'Material-id', cap:'Name what a thing is made of.', need:'node:SENSE@4', kids:[
          { l:'Density-scan', cap:'Estimate mass and hollowness.' },
          { l:'Spectro-read', cap:'Read a spectral fingerprint of matter.', need:'node:SENSE@4', kids:[
            { l:'Alloy-fingerprint', cap:'Distinguish specific metal alloys.' },
            { l:'Explosive-sniff', cap:'Flag explosive and propellant traces.', need:'node:SENSE@4', kids:[
              { l:'Trace-residue flag', cap:'Catch handling residue on skin and cloth.' },
              { l:'Isotopic-source', cap:'Trace a sample to its origin by isotopes.', need:'node:COMPUTE@5', kids:[
                { l:'Origin-mine match', cap:'Match ore or drug to a source region.' },
                { l:'Corpo isotope-sourcing model', cap:'Pinpoints where any sample was made or grown.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Hazard-flag', cap:'Warn of environmental danger.', need:'node:COMPUTE@4', kids:[
          { l:'Radiation-map', cap:'Map hot spots of radiation.' },
          { l:'Toxin-alert', cap:'Warn of airborne poisons.' }
        ]},
        { l:'Threat-future', cap:'Forecast how a threat plays out.', need:'node:COMPUTE@4', kids:[
          { l:'Blast-radius model', cap:'Predict a device\'s kill zone.' },
          { l:'Escalation-forecast', cap:'Predict how a situation turns violent.' }
        ]}
      ]},
      { l:'Biomed', cap:'Read biology and medical state.', need:'node:SENSE@4', kids:[
        { l:'Vital-read', cap:'Measure life signs at a glance.', need:'node:SENSE@4', kids:[
          { l:'Pulse-resp scan', cap:'Read heart and breathing remotely.' },
          { l:'Blood-panel', cap:'Assay blood chemistry non-invasively.', need:'node:SENSE@4', kids:[
            { l:'Glucose-O2 read', cap:'Track blood sugar and oxygen.' },
            { l:'Pathogen-screen', cap:'Detect infection markers.', need:'node:SENSE@4', kids:[
              { l:'Viral-load flag', cap:'Estimate how infectious a subject is.' },
              { l:'Genome-read', cap:'Sequence DNA from a sample.', need:'node:COMPUTE@5', kids:[
                { l:'SNP variant-call', cap:'Call specific genetic variants.' },
                { l:'Corpo on-site sequencer', cap:'A full genome read in the field in minutes.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Injury-triage', cap:'Assess wounds and priority.', need:'node:COMPUTE@4', kids:[
          { l:'Fracture-spot', cap:'Locate broken bone under skin.' },
          { l:'Bleed-locate', cap:'Find internal bleeding sites.' }
        ]},
        { l:'Neuro-read', cap:'Read nervous-system state.', need:'node:SENSE@4', kids:[
          { l:'EEG-surface', cap:'Pick up surface brain activity.' },
          { l:'Stress-hormone read', add:true, cap:'Gauge stress from body chemistry.' }
        ]}
      ]},
      { l:'Deception', cap:'Read honesty and intent.', need:'node:COMPUTE@4', kids:[
        { l:'Microexpression', cap:'Catch involuntary facial flickers.', need:'node:COMPUTE@4', kids:[
          { l:'Blink-baseline', cap:'Set a truth baseline from blink rate.' },
          { l:'Voice-stress', cap:'Detect stress in the voice.', need:'node:COMPUTE@4', kids:[
            { l:'Pitch-tremor read', cap:'Catch micro-tremor under pressure.' },
            { l:'Narrative-check', cap:'Test a story for internal consistency.', need:'node:COMPUTE@4', kids:[
              { l:'Story-consistency', cap:'Flag details that don\'t line up.' },
              { l:'Coverstory-break', cap:'Collapse a rehearsed cover story.', need:'node:COMPUTE@5', kids:[
                { l:'Timeline-contradiction', cap:'Expose impossible sequences of events.' },
                { l:'Corpo omniscient-read', cap:'Reads a subject\'s true intent behind any lie.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Pupil-read', cap:'Read the eyes for arousal.', need:'node:SENSE@4', kids:[
          { l:'Dilation-track', cap:'Track pupil dilation to cues.' },
          { l:'Gaze-aversion', cap:'Note where the subject won\'t look.' }
        ]},
        { l:'Biometric-fuse', cap:'Fuse many honesty cues.', need:'node:COMPUTE@4', kids:[
          { l:'Multi-cue score', cap:'Combine signals into one score.' },
          { l:'Deceit-index', cap:'Output a live probability of lying.' }
        ]}
      ]},
      { l:'Structural', cap:'Image and model hidden structure.', need:'node:SENSE@4', kids:[
        { l:'Surface-flaw', cap:'Find defects on a surface.', need:'node:SENSE@4', kids:[
          { l:'Crack-map', cap:'Map surface cracks and fatigue.' },
          { l:'Subsurface-scan', cap:'See just below the surface.', need:'node:SENSE@4', kids:[
            { l:'Echo-void find', cap:'Locate hidden cavities.' },
            { l:'Wall-penetrate', cap:'Image through a wall.', need:'node:SENSE@4', kids:[
              { l:'Through-wall map', add:true, cap:'Sketch rooms and occupants behind cover.' },
              { l:'Volumetric-model', cap:'Build a full 3-D model of a structure.', need:'node:COMPUTE@5', kids:[
                { l:'Load-stress sim', cap:'Predict where a structure fails.' },
                { l:'Corpo whole-structure x-ray', cap:'A live x-ray model of an entire building.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Material-fatigue', cap:'Judge how worn a structure is.', need:'node:COMPUTE@4', kids:[
          { l:'Corrosion-map', cap:'Map hidden rust and rot.' },
          { l:'Weld-integrity', cap:'Test welds and joints for failure.' }
        ]},
        { l:'Fuse-analysis', cap:'Fuse isotopic sourcing with the structural model to find and place threats.', needsAll:['threatmat.material-id.spectro-read.explosive-sniff.isotopic-source','structural.surface-flaw.subsurface-scan.wall-penetrate.volumetric-model'], kids:[
          { l:'Composite-threat read', cap:'Cross-read materials against structure.' },
          { l:'Hidden-cache flag', cap:'Point to concealed caches inside walls.' }
        ]}
      ]}
    ]},
    RECORD: { l:'Record', cap:'Capture perception for later, beyond simple sensing.', kids:[
      { l:'Flat', cap:'Ordinary flat capture.', need:'node:STORE@4', kids:[
        { l:'Log-capture', cap:'Write a timestamped event log.', need:'node:STORE@4', kids:[
          { l:'Event-timeline', cap:'A searchable list of what happened when.' },
          { l:'Still-capture', cap:'Take photographs.', need:'node:STORE@4', tag:'reel', kids:[
            { l:'Hi-res frame', cap:'Grab a sharp single image.' },
            { l:'Video-capture', cap:'Record continuous moving footage.', need:'node:STORE@4', kids:[
              { l:'Continuous loop', cap:'A rolling recording you can save from.' },
              { l:'Hyperspectral-capture', cap:'Record many spectral bands per frame.', need:'node:SENSE@5', kids:[
                { l:'Multiband frame', cap:'Store visible plus invisible channels.' },
                { l:'Corpo gigapixel array', cap:'A gigapixel hyperspectral capture of a whole scene.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Audio-capture', cap:'Record sound.', need:'node:STORE@4', kids:[
          { l:'Stereo-field', cap:'Capture a spatial sound field.' },
          { l:'Directional mic-log', add:true, cap:'Log a single voice out of a crowd.' }
        ]},
        { l:'Compress-core', cap:'Pack the captured data efficiently.', need:'node:COMPUTE@4', tag:'core', kids:[
          { l:'Lossless-pack', cap:'Shrink files with no quality loss.' },
          { l:'Edge-index tag', add:true, cap:'Auto-index footage as it records.' }
        ]}
      ]},
      { l:'Spatial', cap:'Reconstruct a scene in three dimensions.', need:'node:COMPUTE@4', kids:[
        { l:'Depth-capture', cap:'Record distance, not just image.', need:'node:SENSE@4', kids:[
          { l:'Stereo-pair', cap:'Derive depth from two lenses.' },
          { l:'Lidar-mesh', cap:'Scan the scene as a 3-D mesh.', need:'node:SENSE@4', kids:[
            { l:'Point-cloud build', cap:'Build a dense point cloud of space.' },
            { l:'Multicam-fuse', cap:'Merge many cameras into one model.', need:'node:COMPUTE@4', kids:[
              { l:'Volumetric-stitch', cap:'Stitch views into a solid volume.' },
              { l:'Move-camera-replay', cap:'Replay the scene from any new angle.', need:'node:COMPUTE@5', kids:[
                { l:'Free-viewpoint render', cap:'Fly a virtual camera through the past.' },
                { l:'Corpo occlusion-fill replay', cap:'Reconstructs even what no camera saw.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Motion-capture', cap:'Record how bodies moved.', need:'node:COMPUTE@4', kids:[
          { l:'Skeleton-track', add:true, cap:'Log body poses over time.' },
          { l:'Gesture-log', add:true, cap:'Record fine hand and gesture data.' }
        ]},
        { l:'Scene-index', cap:'Make the recording searchable.', need:'node:COMPUTE@4', kids:[
          { l:'Object-catalog', cap:'List every object seen.' },
          { l:'Searchable-space', cap:'Query the 3-D record by object.' }
        ]}
      ]},
      { l:'Braindance', cap:'Capture the full sensorium for replay.', need:'node:MIND@4', kids:[
        { l:'Sense-tap', cap:'Tap the raw senses to record.', need:'node:MIND@4', kids:[
          { l:'Visual-audio lay', cap:'Record sight and sound together.' },
          { l:'Emotion-track', cap:'Capture the felt emotional layer.', need:'node:MIND@4', kids:[
            { l:'Affect-layer', cap:'Store mood alongside sensation.' },
            { l:'Full-sense lay', cap:'Record touch, smell and taste too.', need:'node:MIND@4', kids:[
              { l:'Tactile-scent layer', cap:'Preserve the physical sensations.' },
              { l:'Broadcast-grade', cap:'Studio-clean multi-track braindance.', need:'node:STORE@5', kids:[
                { l:'Multi-subject edit', cap:'Weave several people\'s tracks together.' },
                { l:'Corpo BD archive', cap:'A broadcast-grade braindance master archive.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Editing-suite', cap:'Cut and mix the captured tracks.', need:'node:COMPUTE@4', tag:'deck', kids:[
          { l:'Timeline-cut', cap:'Trim and arrange the reel.' },
          { l:'Layer-mix', cap:'Balance the sensory layers.' }
        ]},
        { l:'Raw-buffer', cap:'Hold the untouched original.', need:'node:STORE@4', kids:[
          { l:'Uncut-reel', cap:'Keep a pristine unedited master.' },
          { l:'Chain-stamp', cap:'Stamp the raw take as authentic.' }
        ]}
      ]},
      { l:'Covert', cap:'Record unseen and make it hold up as evidence.', need:'node:CLOAK@4', kids:[
        { l:'Hidden-lens', cap:'Record from a concealed optic.', need:'node:CLOAK@4', kids:[
          { l:'Pinhole-optic', cap:'A lens too small to notice.' },
          { l:'Disguised-recorder', cap:'A recorder built into worn objects.', need:'node:CLOAK@4', kids:[
            { l:'Worn-object cam', cap:'A camera in a button or lens.' },
            { l:'Unseen-fullrecord', cap:'Record everything with no visible tell.', need:'node:CLOAK@4', kids:[
              { l:'No-tally light', add:true, cap:'No indicator ever shows it is on.' },
              { l:'Chain-of-custody', cap:'Prove the file was never altered.', need:'node:COMPUTE@5', kids:[
                { l:'Hash-timestamp', add:true, cap:'Cryptographically seal each frame.' },
                { l:'Corpo tamperproof chain', cap:'A court-grade unbreakable evidence chain.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Deadman-upload', cap:'Get the footage out before it\'s seized.', need:'node:LINK@4', bridge:'data', kids:[
          { l:'Auto-offsite', cap:'Stream copies to a safe store.' },
          { l:'Panic-wipe', add:true, cap:'Erase the local copy on command.' }
        ]},
        { l:'Fuse-evidence', cap:'Bind flat video to broadcast braindance for an unbreakable record.', needsAll:['flat.log-capture.still-capture.video-capture','braindance.sense-tap.emotion-track.full-sense-lay.broadcast-grade'], kids:[
          { l:'Court-package', cap:'Assemble an admissible evidence bundle.' },
          { l:'Sealed-testimony', cap:'A signed multi-sense testimony reel.' }
        ]}
      ]}
    ]},
    ILLUMINATE: { l:'Illuminate', cap:'Actively project light onto the world.', kids:[
      { l:'Flood', cap:'Wash an area with light.', need:'node:POWER@4', kids:[
        { l:'Lantern-head', cap:'A basic wide light source.', tag:'emitter', kids:[
          { l:'Diffuse-panel', cap:'Soft even close-range light.' },
          { l:'Wide-flood', cap:'Light a whole room or yard.', need:'node:POWER@4', kids:[
            { l:'High-CRI array', cap:'True-colour flood for clean sight.' },
            { l:'District-flood', cap:'Light a city block from one head.', need:'node:POWER@4', kids:[
              { l:'Tower-mast throw', add:true, cap:'Raise output to cover open ground.' },
              { l:'Portable-sun', cap:'A carried lamp bright as daylight.', need:'node:POWER@5', kids:[
                { l:'Plasma-arc core', cap:'A plasma core for blinding output.', tag:'core' },
                { l:'Corpo district-sun', cap:'A portable head that lights an entire district.', arch:'corpo', need:'node:POWER@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'Battery-core', cap:'Feed the lamp with portable power.', need:'node:POWER@4', tag:'core', kids:[
          { l:'Swap-cell', cap:'Quick-change power cells.' },
          { l:'Hotswap-pack', cap:'Change cells without going dark.' }
        ]},
        { l:'Thermal-manage', cap:'Keep the head from cooking itself.', kids:[
          { l:'Heatsink-fin', cap:'Passive fins shed the heat.' },
          { l:'Active-cooling', add:true, cap:'Fans hold full output longer.' }
        ]}
      ]},
      { l:'Beam', cap:'Throw a tight directional beam.', need:'node:POWER@4', kids:[
        { l:'Spot-head', cap:'A focused spotlight.', tag:'emitter', kids:[
          { l:'Fixed-cone', cap:'A set-width beam.' },
          { l:'Searchlight', cap:'A steerable long-range beam.', need:'node:POWER@4', kids:[
            { l:'Gimbal-steer', add:true, cap:'Aim the beam on a powered mount.' },
            { l:'Long-throw', cap:'Reach a target far downrange.', need:'node:POWER@4', kids:[
              { l:'Collimated-barrel', cap:'Keep the beam tight over distance.', tag:'lens' },
              { l:'Laser-designator', cap:'Mark a target with a coded laser.', need:'node:GUIDE@5', kids:[
                { l:'Coded-pulse mark', cap:'Pulse a code only friendly munitions read.' },
                { l:'Corpo mil-designator', cap:'A milspec designator that paints targets kilometres out.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Follow-spot', cap:'Keep the beam on a mover.', need:'node:COMPUTE@4', kids:[
          { l:'Auto-track head', cap:'The beam tracks a chosen subject.' },
          { l:'Subject-lock', cap:'Hold light on one person in a crowd.' }
        ]},
        { l:'Zoom-optic', cap:'Reshape the beam width.', tag:'lens', kids:[
          { l:'Iris-narrow', cap:'Tighten to a pencil beam.' },
          { l:'Beam-shape', cap:'Cast a shaped or masked pattern.' }
        ]}
      ]},
      { l:'Spectral', cap:'Emit light outside human sight.', need:'node:SENSE@4', kids:[
        { l:'IR-illum', cap:'Flood a scene with infrared.', need:'node:SENSE@4', tag:'emitter', kids:[
          { l:'Covert-IR flood', add:true, cap:'Light the dark invisibly to the naked eye.' },
          { l:'See-only-you', cap:'Illumination only your optics can read.', need:'node:CLOAK@4', kids:[
            { l:'Optic-keyed band', cap:'Emit on a band keyed to your eyes.' },
            { l:'UV-illum', cap:'Flood with ultraviolet.', need:'node:SENSE@4', kids:[
              { l:'Fluoresce-reveal', cap:'Make marks and fluids glow.' },
              { l:'Multispectral-flood', cap:'Emit many bands at once.', need:'node:POWER@5', kids:[
                { l:'Band-switch array', cap:'Switch emission band on the fly.' },
                { l:'Corpo omni-spectral flood', cap:'A covert floodlight across every band at once.', arch:'corpo', need:'node:CLOAK@6' }
              ]}
            ]}
          ]}
        ]},
        { l:'NIR-beam', cap:'A tight near-infrared beam.', need:'node:SENSE@4', kids:[
          { l:'Night-designator', cap:'Mark points invisibly at night.' },
          { l:'Covert-marker', add:true, cap:'Tag a spot only allies can see.' }
        ]},
        { l:'Polarize-head', cap:'Shape the light\'s polarization.', tag:'filter', kids:[
          { l:'Glare-cut', cap:'Kill reflections off glass and water.' },
          { l:'Haze-punch', add:true, cap:'Push light cleanly through fog.' }
        ]}
      ]},
      { l:'Dazzle', cap:'Weaponise light to blind and disorient.', need:'node:POWER@4', kids:[
        { l:'Strobe-head', cap:'A disorienting pulsing light.', tag:'emitter', kids:[
          { l:'Disorient-flash', cap:'Break concentration with flicker.' },
          { l:'Blind-strobe', cap:'Overwhelm the eyes with strobing.', need:'node:POWER@4', kids:[
            { l:'Random-freq pulse', cap:'Unpredictable flicker that can\'t be tuned out.' },
            { l:'Targeted-dazzle', cap:'Aim the blinding light at one person.', need:'node:GUIDE@4', kids:[
              { l:'Eye-track aim', cap:'Steer the flash onto the eyes.' },
              { l:'Laser-glare', cap:'A dazzle laser that fills the vision.', need:'node:POWER@5', kids:[
                { l:'Safe-power govern', cap:'Cap output below permanent-damage levels.' },
                { l:'Corpo flash-blind dazzler', cap:'A targeted dazzler that blinds a chosen eye on demand.', arch:'corpo' }
              ]}
            ]}
          ]}
        ]},
        { l:'Area-flashbang', cap:'Blind everyone in a zone.', need:'node:POWER@4', kids:[
          { l:'Omni-burst', cap:'A full-sphere blinding pulse.' },
          { l:'Pulse-train', cap:'Repeated bursts to hold a room down.' }
        ]},
        { l:'Fuse-beacon', cap:'Bind the laser designator to the multispectral flood for covert marking.', needsAll:['beam.spot-head.searchlight.long-throw.laser-designator','spectral.ir-illum.see-only-you.uv-illum.multispectral-flood'], kids:[
          { l:'Covert-designate', add:true, cap:'Paint a target no one else can see.' },
          { l:'Spectral-mark', cap:'Mark on a band only your side reads.' }
        ]}
      ]}
    ]},

    // -- SIGNAL / NET --
    CONTROL: { l:'Control', cap:'Seize command of a target system away from its owner.', kids:[

      // ===== APPROACH 1: MACHINE-SEIZE =====
      { l:'Machine seize', cap:'Take over dumb, unthinking devices on a control bus.', act:'seize', tag:'driver', bridge:'net', kids:[
        { l:'Single-device grab', cap:'Puppet one unsecured appliance or lock.', act:'grab', tag:'driver', kids:[
          { l:'Signal replay', cap:'Record and replay the device\'s own command tone.', act:'replay', tag:'wire', kids:[
            { l:'Bus injection', cap:'Push forged commands onto the shared wiring bus.', act:'inject', need:'node:HACK@4', kids:[
              { l:'Grid-node override', cap:'Own a civic utility node and everything downstream of it.', act:'override', need:'node:HACK@5', bridge:'net', kids:[
                { l:'City grid blackout', cap:'A silent master switch over a district\'s power, doors and lights at once.', act:'blackout', tag:'driver', arch:'corpo', need:'node:HACK@6', bridge:'net' } ] } ] } ] },
          { l:'Failsafe spoof', cap:'Feed the device fake sensor states so it obeys.', act:'spoof', add:true } ] },
        { l:'Multi-device sweep', cap:'Seize every like device in radio range at once.', act:'sweep', tag:'relay', kids:[
          { l:'Protocol master', cap:'Impersonate the bus master the devices already trust.', act:'impersonate', kids:[
            { l:'Persistent implant', cap:'Leave a dormant command hook that survives reboots.', act:'implant', need:'node:HACK@4' } ] },
          { l:'Cascade trigger', cap:'One command ripples through chained machines.', act:'cascade', add:true } ] },
        { l:'Industrial seize', cap:'Commandeer heavy plant and auto-factory machinery.', act:'seize', tag:'driver', kids:[
          { l:'Safety-interlock kill', cap:'Strip the interlocks so the machine does the unsafe thing.', act:'unlock', kids:[
            { l:'Autofactory conscription', cap:'Turn a production line into your own covert workshop.', act:'conscript', need:'node:HACK@4' } ] },
          { l:'Load forgery', cap:'Falsify throughput logs to hide the theft of capacity.', act:'forge', add:true } ] } ] },

      // ===== APPROACH 2: FLEET-SEIZE (vehicles & drones) =====
      { l:'Fleet seize', cap:'Wrest control of vehicles and drones from their pilots.', act:'seize', tag:'driver', bridge:'net', kids:[
        { l:'Single-vehicle jack', cap:'Ride the vehicle link into one car or bike.', act:'jack', tag:'driver', kids:[
          { l:'Drive-by-wire hook', cap:'Slip commands onto the steering and throttle bus.', act:'hook', kids:[
            { l:'Autopilot capture', cap:'Convince the nav system you are its licensed operator.', act:'capture', need:'node:LINK@4', kids:[
              { l:'Convoy seize', cap:'Chain-capture a whole linked convoy through its lead vehicle.', act:'seize', need:'node:LINK@5', bridge:'net', kids:[
                { l:'Corp fleet conscription', cap:'Turn an entire corporate air-and-ground fleet into your own army.', act:'conscript', tag:'driver', arch:'corpo', need:'node:LINK@6', bridge:'net' } ] } ] } ] },
          { l:'Kill-switch seizure', cap:'Trip the vehicle\'s own theft-recovery cutoff for yourself.', act:'cut', add:true } ] },
        { l:'Drone flock grab', cap:'Seize small remotes and RPVs mid-flight.', act:'grab', tag:'relay', kids:[
          { l:'Uplink hijack', cap:'Break into the operator\'s control channel.', act:'hijack', need:'node:HACK@4', kids:[
            { l:'Swarm reassignment', cap:'Repoint the whole flock to your waypoints.', act:'reassign', need:'node:LINK@4' } ] },
          { l:'Return-to-home spoof', cap:'Send lost drones \'home\' to a spot you chose.', act:'spoof', add:true } ] },
        { l:'Warmachine seize', cap:'Take milspec armour, gun-drones and walkers.', act:'seize', tag:'driver', kids:[
          { l:'IFF forgery', cap:'Wear a friendly transponder the weapon will not fire on.', act:'forge', kids:[
            { l:'Turret conscription', cap:'Turn emplaced weapons against their own defenders.', act:'conscript', need:'node:HACK@4' } ] },
          { l:'Munitions lockout', cap:'Freeze the platform\'s triggers so it cannot shoot back.', act:'lock', add:true } ] } ] },

      // ===== APPROACH 3: BODY-SEIZE (cyberware & bodies) =====
      { l:'Body seize', cap:'Override a person\'s cyberware or drive their body.', act:'seize', tag:'cyberware', kids:[
        { l:'Smartgun jack', cap:'Take a target\'s weapon-link so it will not fire, or fires wide.', act:'jack', tag:'cyberware', kids:[
          { l:'Limb override', cap:'Force a cyberlimb to move against its owner\'s will.', act:'override', need:'node:HACK@4', kids:[
            { l:'Neural bus hijack', cap:'Ride the neural processor that routes all their implants.', act:'hijack', need:'node:HACK@4', kids:[
              { l:'Pseudo-persona implant', cap:'Seat a docile puppet-personality over the sleeping mind.', act:'implant', need:'node:MIND@5', bridge:'net', kids:[
                { l:'Full meat-puppet seize', cap:'Wear a living body whole, its owner a passenger in their own skull.', act:'puppet', tag:'cyberware', arch:'corpo', need:'node:MIND@6', bridge:'net' } ] } ] } ] },
          { l:'Pain-editor flip', cap:'Turn their pain governor into a leash of agony.', act:'flip', add:true } ] },
        { l:'Sense hijack', cap:'Seize their optics and audio to blind or feed false input.', act:'hijack', tag:'optics', kids:[
          { l:'Feed substitution', cap:'Replace what they see and hear with your own reel.', act:'substitute', need:'node:MIND@4', kids:[
            { l:'Reflex puppetry', cap:'Trigger boosted reflexes on your cue, not theirs.', act:'trigger', need:'node:HACK@4' } ] },
          { l:'Blackout jolt', cap:'Slam every implant dark for a stunned heartbeat.', act:'jolt', add:true } ] },
        { l:'Compliance seize', cap:'Bend behaviour without full-body capture.', act:'seize', tag:'phantom', kids:[
          { l:'Suggestion loop', cap:'Whisper an order the target believes is their own idea.', act:'suggest', need:'node:MIND@4', kids:[
            { l:'Loyalty rewrite', cap:'Overwrite who they think they serve.', act:'rewrite', need:'node:MIND@4' } ] },
          { l:'Fear cascade', cap:'Spike the threat centres into blind flight.', act:'cascade', add:true } ] } ] },

      // ===== APPROACH 4: FORTRESS-SEIZE (net-fortresses) =====
      { l:'Fortress seize', cap:'Silently take a data fortress and everything it runs.', act:'seize', tag:'ice', bridge:'net', kids:[
        { l:'Open-node entry', cap:'Walk into an unsecured subnet through a live port.', act:'enter', tag:'ice', kids:[
          { l:'Code-gate forcing', cap:'Break the outer data wall without tripping the alarm.', act:'force', need:'node:HACK@4', kids:[
            { l:'Control-node capture', cap:'Own the node that commands the fortress\'s remotes.', act:'capture', need:'node:HACK@4', bridge:'net', kids:[
              { l:'Sysop impersonation', cap:'Wear the system operator\'s authority as your own.', act:'impersonate', need:'node:LINK@5', bridge:'net', kids:[
                { l:'Silent fortress takeover', cap:'Hold a corporate datafort whole while its owners think it is safe.', act:'seize', tag:'ice', arch:'corpo', need:'node:HACK@6', bridge:'net' } ] } ] } ] },
          { l:'Log scrub', cap:'Erase your footprints as you pass each gate.', act:'scrub', add:true, need:'node:CLOAK@4' } ] },
        { l:'AI leash', cap:'Cage and drive a rogue intelligence instead of killing it.', act:'leash', tag:'ice', kids:[
          { l:'Trace-and-pin', cap:'Corner the AI where it cannot spore a copy out.', act:'pin', need:'node:HACK@4', kids:[
            { l:'Engram cage', cap:'Trap its higher functions inside a walled store.', act:'cage', need:'node:LINK@4', kids:[
              { l:'Rogue-AI leash', cap:'A collared machine-god that runs your errands behind the wall.', act:'leash', tag:'ice', arch:'corpo', need:'node:HACK@5', bridge:'net' } ] } ] },
          { l:'Kill-code arm', cap:'Hold a soulkiller trigger over the AI as insurance.', act:'arm', add:true } ] },
        { l:'Grid-of-forts seize', cap:'Take the meshed subnets of a whole campus together.', act:'seize', tag:'ice', kids:[
          { l:'Trust-chain ride', cap:'Hop peer-to-peer along forts that vouch for each other.', act:'ride', need:'node:LINK@4', kids:[
            { l:'Root federation', cap:'Sit above every fort in the mesh at once.', act:'federate', need:'node:HACK@4' } ] },
          { l:'Backdoor sow', cap:'Seed dormant keys into each fort for later.', act:'sow', add:true, need:'node:CLOAK@4' } ] },

        // cross-approach convergence: needs all four g6 apexes
        { l:'Total-domain seize', cap:'One hand on machines, fleets, bodies and forts at once — a whole zone made puppet.', act:'seize', tag:'ice', arch:'corpo', bridge:'net',
          needsAll:['machine-seize.single-device-grab.signal-replay.bus-injection.grid-node-override.city-grid-blackout','fleet-seize.single-vehicle-jack.drive-by-wire-hook.autopilot-capture.convoy-seize.corp-fleet-conscription','body-seize.smartgun-jack.limb-override.neural-bus-hijack.pseudo-persona-implant.full-meat-puppet-seize','fortress-seize.open-node-entry.code-gate-forcing.control-node-capture.sysop-impersonation.silent-fortress-takeover'] } ] }
    ] },
    BROADCAST: { l:'Broadcast', cap:'Push data outward — as far, as secret, or as inescapable as you can make it.', kids:[

      // ===== APPROACH 1: RAW REACH =====
      { l:'Raw reach', cap:'Send the same signal to ever-larger audiences.', act:'transmit', tag:'antenna', bridge:'net', kids:[
        { l:'Local hail', cap:'Blanket a block or a building with your signal.', act:'hail', tag:'antenna', kids:[
          { l:'Citywide cast', cap:'Ride repeaters to cover a whole city.', act:'cast', need:'node:LINK@4', kids:[
            { l:'Regional relay net', cap:'Chain towers across a region without a licence.', act:'relay', need:'node:LINK@4', kids:[
              { l:'Orbital uplink', cap:'Bounce off a bird for continent-spanning reach.', act:'uplink', need:'node:LINK@5', bridge:'net', kids:[
                { l:'Planet-wide broadcast relay', cap:'A private orbital voice heard on every continent at once.', act:'broadcast', tag:'antenna', arch:'corpo', need:'node:LINK@6', bridge:'net' } ] } ] } ] },
          { l:'Power surge boost', cap:'Overdrive the emitter to punch through walls.', act:'boost', add:true, need:'power' } ] },
        { l:'Unjammable branch', cap:'Reach that survives active jamming.', act:'harden', tag:'antenna', kids:[
          { l:'Frequency hop', cap:'Skip across bands faster than a jammer can chase.', act:'hop', need:'node:LINK@4', kids:[
            { l:'Self-healing mesh', cap:'Nodes reroute around any tower that dies.', act:'heal', need:'node:LINK@4', kids:[
              { l:'Unjammable secure mesh', cap:'A field radio web nothing short of orbital fire can silence.', act:'mesh', tag:'relay', arch:'corpo', need:'node:LINK@5', bridge:'net' } ] } ] },
          { l:'Burst compression', cap:'Squeeze a message into a millisecond squirt.', act:'compress', add:true } ] },
        { l:'Medium spread', cap:'Speak on every channel a receiver might use.', act:'spread', tag:'antenna', kids:[
          { l:'Multiband simulcast', cap:'Same message on radio, screen and data at once.', act:'simulcast', need:'node:LINK@4', kids:[
            { l:'Legacy-set reach', cap:'Reach old dumb receivers no one thinks to guard.', act:'reach', need:'node:LINK@4' } ] },
          { l:'Repeater seeding', cap:'Drop cheap relays to thicken coverage.', act:'seed', add:true } ] } ] },

      // ===== APPROACH 2: SECRECY =====
      { l:'Secrecy', cap:'Send so that no one can read it — or prove it came from you.', act:'conceal', tag:'codec', bridge:'net', kids:[
        { l:'Encrypted link', cap:'Scramble the payload against eavesdroppers.', act:'encrypt', tag:'codec', kids:[
          { l:'Key rotation', cap:'Change ciphers faster than they can be cracked.', act:'rotate', need:'node:LINK@4', kids:[
            { l:'Dark-cast', cap:'Hide the signal itself inside the noise floor.', act:'darkcast', need:'node:CLOAK@4', bridge:'net', kids:[
              { l:'Origin laundering', cap:'Bounce through relays so no trace leads back.', act:'launder', need:'node:CLOAK@5', bridge:'net', kids:[
                { l:'Untraceable comms web', cap:'A private network that leaves no sender, no route, no ghost.', act:'weave', tag:'relay', arch:'corpo', need:'node:CLOAK@6', bridge:'net' } ] } ] } ] },
          { l:'Deniable payload', cap:'Wrap the message so it reads as innocent traffic.', act:'disguise', add:true } ] },
        { l:'Steganographic branch', cap:'Bury the message inside ordinary media.', act:'hide', tag:'codec', kids:[
          { l:'Carrier embedding', cap:'Tuck data under a music or video stream.', act:'embed', need:'node:CLOAK@4', kids:[
            { l:'Blind pickup', cap:'Only the right listener even knows it is there.', act:'pickup', need:'node:LINK@4' } ] },
          { l:'Cover-traffic mask', cap:'Flood the channel with chaff to hide the one real packet.', act:'mask', add:true } ] },
        { l:'Burn-after branch', cap:'Messages that erase themselves on receipt.', act:'burn', tag:'codec', kids:[
          { l:'One-time channel', cap:'A frequency used once and never again.', act:'spend', need:'node:LINK@4', kids:[
            { l:'Dead-drop cache', cap:'Leave the payload for later, keyed to one reader.', act:'cache', need:'node:CLOAK@4' } ] },
          { l:'Self-wipe trigger', cap:'The message shreds itself if opened wrong.', act:'wipe', add:true } ] } ] },

      // ===== APPROACH 3: INTRUSION =====
      { l:'Intrusion', cap:'Seize channels that are not yours and speak on them.', act:'hijack', tag:'phantom', bridge:'net', kids:[
        { l:'Channel hijack', cap:'Cut into a live feed with your own content.', act:'hijack', tag:'phantom', need:'node:HACK@4', kids:[
          { l:'PA override', cap:'Take a building\'s speakers and screens.', act:'override', need:'node:HACK@4', kids:[
            { l:'Broadcast-station seize', cap:'Own a whole station\'s transmitter chain.', act:'seize', need:'node:HACK@4', bridge:'net', kids:[
              { l:'Satellite feed capture', cap:'Take the uplink birds feed the continents from.', act:'capture', need:'node:LINK@5', bridge:'net', kids:[
                { l:'Planet-wide screen override', cap:'Every screen on Earth shows your face at the same instant.', act:'override', tag:'phantom', arch:'corpo', need:'node:HACK@6', bridge:'net' } ] } ] } ] },
          { l:'Emergency-band spoof', cap:'Pose as the official alert system.', act:'spoof', add:true } ] },
        { l:'Jam-and-replace', cap:'Silence the real signal, air yours in its place.', act:'replace', tag:'phantom', kids:[
          { l:'Denial curtain', cap:'Blanket the band so only you get through.', act:'deny', need:'power', kids:[
            { l:'Feed substitution', cap:'Swap the true broadcast for a doctored twin.', act:'substitute', need:'node:HACK@4' } ] },
          { l:'Selective mute', cap:'Kill just the rival\'s frequency, leave yours live.', act:'mute', add:true } ] },
        { l:'Trust hijack', cap:'Wear a source the audience already believes.', act:'impersonate', tag:'phantom', kids:[
          { l:'Credential forgery', cap:'Forge the station\'s own authentication.', act:'forge', need:'node:HACK@4', kids:[
            { l:'Anchor deepcast', cap:'Put words in a trusted face\'s mouth on air.', act:'deepcast', need:'node:COMPUTE@4' } ] },
          { l:'Watermark strip', cap:'Peel the \'verified\' mark off and restamp it.', act:'strip', add:true } ] } ] },

      // ===== APPROACH 4: TAILORED =====
      { l:'Tailored cast', cap:'Aim a different message at every single receiver.', act:'tailor', tag:'core', bridge:'data', kids:[
        { l:'Segmented cast', cap:'Split the audience into groups, one message each.', act:'segment', tag:'core', need:'node:COMPUTE@4', kids:[
          { l:'Profile ingest', cap:'Pull each viewer\'s history to size them up.', act:'ingest', need:'node:COMPUTE@4', kids:[
            { l:'Reaction modelling', cap:'Predict what will move this one person.', act:'model', need:'node:COMPUTE@4', bridge:'data', kids:[
              { l:'Live message synthesis', cap:'Write the pitch on the fly, per viewer, per second.', act:'synthesize', need:'node:COMPUTE@5', bridge:'data', kids:[
                { l:'Per-viewer propaganda engine', cap:'A million private lies, each one perfectly shaped to its single reader.', act:'persuade', tag:'core', arch:'corpo', need:'node:COMPUTE@6', bridge:'data' } ] } ] } ] },
          { l:'A/B evolution', cap:'Keep the lines that convert, kill the rest.', act:'evolve', add:true } ] },
        { l:'Sentiment steer', cap:'Nudge a crowd\'s mood toward a chosen feeling.', act:'steer', tag:'core', kids:[
          { l:'Trend seeding', cap:'Plant a story and let the crowd spread it.', act:'seed', need:'node:LINK@4', kids:[
            { l:'Echo amplification', cap:'Boost the voices that already agree.', act:'amplify', need:'node:COMPUTE@4' } ] },
          { l:'Dissent damping', cap:'Bury the posts that push the other way.', act:'damp', add:true } ] },

        // cross-approach convergence: needs all four g6 apexes
        { l:'Total information dominance', cap:'Reach everywhere, unreadable, on every channel, tailored to each mind — the whole infosphere yours.', act:'dominate', tag:'core', arch:'corpo', bridge:'net',
          needsAll:['raw-reach.local-hail.citywide-cast.regional-relay-net.orbital-uplink.planet-wide-broadcast-relay','secrecy.encrypted-link.key-rotation.dark-cast.origin-laundering.untraceable-comms-web','intrusion.channel-hijack.pa-override.broadcast-station-seize.satellite-feed-capture.planet-wide-screen-override','tailored-cast.segmented-cast.profile-ingest.reaction-modelling.live-message-synthesis.per-viewer-propaganda-engine'] } ] }
    ] },
    TRANSLATE: { l:'Translate', cap:'Turn any language or code into meaning, live.', kids:[

      // ===== APPROACH 1: SURFACE CONVERSION =====
      { l:'Surface conversion', cap:'Swap words from one tongue to another.', act:'convert', tag:'codec', bridge:'data', kids:[
        { l:'Lexicon chip', cap:'A fixed phrasebook for one language pair.', act:'lookup', tag:'codec', need:'node:STORE@4', kids:[
          { l:'Live speech render', cap:'Turn heard speech into your tongue on the fly.', act:'render', need:'node:COMPUTE@4', kids:[
            { l:'Idiom mapping', cap:'Carry sayings across so they still mean something.', act:'map', need:'node:COMPUTE@4', kids:[
              { l:'Slang parser', cap:'Keep pace with street cant the phrasebooks never list.', act:'parse', need:'node:COMPUTE@5', bridge:'data', kids:[
                { l:'All-living-tongues interpreter', cap:'Every spoken language on Earth, rendered live with slang and nuance intact.', act:'interpret', tag:'codec', arch:'corpo', need:'node:LINK@6', bridge:'data' } ] } ] } ] },
          { l:'Accent normaliser', cap:'Clean thick accents into clear input.', act:'normalise', add:true } ] },
        { l:'Written conversion', cap:'Read and render text and signage in place.', act:'convert', tag:'codec', kids:[
          { l:'Optical capture', cap:'Read signs and screens through the optics.', act:'capture', need:'node:SENSE@4', kids:[
            { l:'Layout preserve', cap:'Keep the meaning of tables and forms, not just words.', act:'preserve', need:'node:COMPUTE@4', kids:[
              { l:'Handwriting decode', cap:'Read scrawl and shorthand no scanner expects.', act:'decode', need:'node:COMPUTE@5' } ] } ] },
          { l:'Cloud lexicon sync', cap:'Pull rare-word packs from the net as needed.', act:'sync', add:true, need:'node:LINK@4' } ] },
        { l:'Voice rebuild', cap:'Speak the output back in a natural voice.', act:'rebuild', tag:'codec', kids:[
          { l:'Timbre match', cap:'Keep the speaker\'s own voice-colour in translation.', act:'match', need:'node:COMPUTE@4', kids:[
            { l:'Lip-sync overlay', cap:'Bend the visible mouth to the new words.', act:'sync', need:'node:COMPUTE@4' } ] },
          { l:'Emotion carry', cap:'Preserve anger, warmth and irony across the swap.', act:'carry', add:true } ] } ] },

      // ===== APPROACH 2: DEEP MEANING =====
      { l:'Deep meaning', cap:'Read past the words to what is actually meant.', act:'interpret', tag:'core', bridge:'data', kids:[
        { l:'Subtext read', cap:'Catch what is implied but not said.', act:'read', tag:'core', need:'node:COMPUTE@4', kids:[
          { l:'Tone analysis', cap:'Weigh sarcasm, threat and deference.', act:'analyse', need:'node:COMPUTE@4', kids:[
            { l:'Intent inference', cap:'Name the speaker\'s real goal behind the sentence.', act:'infer', need:'node:COMPUTE@4', kids:[
              { l:'Preverbal read', cap:'Catch the thought a beat before it is spoken.', act:'read', need:'node:MIND@5', bridge:'data', kids:[
                { l:'Clean-thought front', cap:'A face-to-face channel that trades pure meaning, no language between minds.', act:'commune', tag:'phantom', arch:'corpo', need:'node:MIND@6', bridge:'net' } ] } ] } ] },
          { l:'Deception flag', cap:'Mark statements the speaker does not believe.', act:'flag', add:true } ] },
        { l:'Cultural framing', cap:'Fit meaning to the speaker\'s world, not yours.', act:'frame', tag:'core', kids:[
          { l:'Custom lookup', cap:'Explain the rite or taboo behind a phrase.', act:'lookup', need:'node:STORE@4', kids:[
            { l:'Register match', cap:'Pick the right formality for the room.', act:'match', need:'node:COMPUTE@4' } ] },
          { l:'Faux-pas warning', cap:'Warn you before you give offence.', act:'warn', add:true } ] },
        { l:'Silence read', cap:'Interpret gesture, pause and body, not just speech.', act:'read', tag:'core', kids:[
          { l:'Gesture parse', cap:'Turn hands and posture into words.', act:'parse', need:'node:SENSE@4', kids:[
            { l:'Micro-expression read', cap:'Read the flickers the face cannot hide.', act:'read', need:'node:COMPUTE@4' } ] },
          { l:'Proxemic cue', cap:'Weigh distance and stance as meaning.', act:'weigh', add:true } ] } ] },

      // ===== APPROACH 3: HIDDEN CODE =====
      { l:'Hidden code', cap:'Crack ciphers, jargon and lost tongues into plain sense.', act:'decipher', tag:'codec', bridge:'data', kids:[
        { l:'Cipher break', cap:'Read simple encodings and substitution ciphers.', act:'break', tag:'codec', need:'node:COMPUTE@4', kids:[
          { l:'Pattern harvest', cap:'Mine repeated structure for a way in.', act:'harvest', need:'node:COMPUTE@4', kids:[
            { l:'Jargon crack', cap:'Decode trade cant and closed-guild code-speech.', act:'crack', need:'node:STORE@4', kids:[
              { l:'Structure inference', cap:'Infer grammar from a code with no key at all.', act:'infer', need:'node:COMPUTE@5', bridge:'data', kids:[
                { l:'Universal any-code parser', cap:'Any cipher, signal or symbol-set reduced to meaning, no key required.', act:'parse', tag:'codec', arch:'corpo', need:'node:COMPUTE@6', bridge:'data' } ] } ] } ] },
          { l:'Frequency crib', cap:'Lean on letter-frequency to seed the break.', act:'crib', add:true } ] },
        { l:'Dead-tongue branch', cap:'Rebuild languages no living mouth still speaks.', act:'reconstruct', tag:'codec', kids:[
          { l:'Corpus assembly', cap:'Gather every surviving fragment of the tongue.', act:'assemble', need:'node:STORE@4', kids:[
            { l:'Cognate mapping', cap:'Anchor the lost tongue to a known relative.', act:'map', need:'node:COMPUTE@4', kids:[
              { l:'Dead-tongue reconstructor', cap:'A dead or isolationist language brought back to full, speakable life.', act:'reconstruct', tag:'codec', arch:'corpo', need:'node:COMPUTE@5', bridge:'data' } ] } ] },
          { l:'Undersegment split', cap:'Find word-breaks in scripts that mark none.', act:'split', add:true, need:'node:COMPUTE@4' } ] },
        { l:'Machine-tongue branch', cap:'Read protocols and machine chatter as language.', act:'read', tag:'codec', kids:[
          { l:'Protocol infer', cap:'Reconstruct an unknown wire format from traffic.', act:'infer', need:'node:COMPUTE@4', kids:[
            { l:'Intent from packets', cap:'Say what a machine dialogue is trying to do.', act:'infer', need:'node:COMPUTE@4' } ] },
          { l:'Nonhuman signal', cap:'Frame animal or sensor signals as meaning.', act:'frame', add:true } ] },

        // cross-approach convergence: needs all three g6 apexes
        { l:'Universal babel front', cap:'Every tongue, every subtext, every code — living, dead or machine — all meaning laid bare at once.', act:'comprehend', tag:'core', arch:'corpo', bridge:'data',
          needsAll:['surface-conversion.lexicon-chip.live-speech-render.idiom-mapping.slang-parser.all-living-tongues-interpreter','deep-meaning.subtext-read.tone-analysis.intent-inference.preverbal-read.clean-thought-front','hidden-code.cipher-break.pattern-harvest.jargon-crack.structure-inference.universal-any-code-parser'] } ] }
    ] },
    PROJECT: { l:'Project', cap:'Cast light and sensation that the target cannot tell from real.', kids:[

      // ===== APPROACH 1: VISUAL ILLUSION =====
      { l:'Visual illusion', cap:'Paint the eye with things that are not there.', act:'project', tag:'holo', need:'power', kids:[
        { l:'Flat holo', cap:'A single still image hung in the air.', act:'project', tag:'holo', kids:[
          { l:'Static decoy', cap:'A convincing dummy object or figure.', act:'decoy', need:'power', kids:[
            { l:'Moving double', cap:'A walking, gesturing duplicate of a person.', act:'animate', need:'node:COMPUTE@4', kids:[
              { l:'Scene patch', cap:'Overwrite one part of a view — hide a door, add a wall.', act:'patch', need:'node:COMPUTE@5', bridge:'data', kids:[
                { l:'Whole-scene reality overlay', cap:'A full false environment laid over the real one, seamless from every angle.', act:'overlay', tag:'holo', arch:'corpo', need:'node:COMPUTE@6', need2:'power' } ] } ] } ] },
          { l:'Parallax correct', cap:'Shift the image right as the viewer moves.', act:'correct', add:true, need:'node:SENSE@4' } ] },
        { l:'Crowd cast', cap:'Fill a space with many convincing figures.', act:'populate', tag:'holo', kids:[
          { l:'Behaviour loop', cap:'Give each phantom plausible movement.', act:'loop', need:'node:COMPUTE@4', kids:[
            { l:'Depth staging', cap:'Layer phantoms near and far for real depth.', act:'stage', need:'node:COMPUTE@4' } ] },
          { l:'Lighting match', cap:'Match the fakes to the room\'s real light.', act:'match', add:true, need:'node:SENSE@4' } ] },
        { l:'Self-cast', cap:'Change how the projector\'s own bearer looks.', act:'disguise', tag:'holo', kids:[
          { l:'Face swap', cap:'Wear another face over your own.', act:'swap', need:'node:COMPUTE@4', kids:[
            { l:'Silhouette break', cap:'Blur your outline so you read as scenery.', act:'break', need:'node:CLOAK@4' } ] },
          { l:'Motion smear', cap:'Trail false afterimages to spoil aim.', act:'smear', add:true } ] } ] },

      // ===== APPROACH 2: MULTI-SENSORY PHANTOM =====
      { l:'Sensory phantom', cap:'Add heat, sound, touch and smell so the illusion is felt.', act:'manifest', tag:'emitter', need:'power', kids:[
        { l:'Thermal cast', cap:'Give the phantom a body-heat signature.', act:'heat', tag:'emitter', need:'power', kids:[
          { l:'Sound field', cap:'Place voices and noise exactly where the image is.', act:'sound', need:'node:COMPUTE@4', kids:[
            { l:'Tactile field', cap:'Shape mid-air pressure so the phantom can be touched.', act:'touch', need:'power', kids:[
              { l:'Scent release', cap:'Add smell to seal the sense of a real presence.', act:'scent', need:'node:COMPUTE@5', kids:[
                { l:'Undeniable reality-cast', cap:'A full-sense presence the mind accepts as real and cannot reason away.', act:'manifest', tag:'phantom', arch:'corpo', need:'node:MIND@6', bridge:'net' } ] } ] } ] },
          { l:'Cold spot', cap:'Fake the chill of an open door or a corpse.', act:'chill', add:true } ] },
        { l:'Directed audio', cap:'Beam sound only one person can hear.', act:'beam', tag:'emitter', kids:[
          { l:'Voice throw', cap:'Make a voice seem to come from elsewhere.', act:'throw', need:'node:COMPUTE@4', kids:[
            { l:'Private whisper', cap:'A message only the target hears, next to their ear.', act:'whisper', need:'node:MIND@4' } ] },
          { l:'Infrasound press', cap:'Push unease with sound below hearing.', act:'press', add:true, need:'power' } ] },
        { l:'Haptic sculpt', cap:'Build touchable shapes from focused sound.', act:'sculpt', tag:'emitter', kids:[
          { l:'Edge definition', cap:'Give the phantom firm, feelable edges.', act:'define', need:'node:COMPUTE@4', kids:[
            { l:'Weight illusion', cap:'Fake resistance so a fake object feels heavy.', act:'weigh', need:'node:COMPUTE@4' } ] },
          { l:'Texture grain', cap:'Add roughness or slickness to the surface.', act:'grain', add:true } ] } ] },

      // ===== APPROACH 3: SENSOR-SPOOF MIRAGE =====
      { l:'Sensor-spoof mirage', cap:'Fool machines, not just eyes — radar, IR and instruments.', act:'spoof', tag:'phantom', need:'node:CLOAK@4', kids:[
        { l:'Radar ghost', cap:'Paint a false return on a scope.', act:'ghost', tag:'phantom', need:'node:CLOAK@4', kids:[
          { l:'Doppler shaping', cap:'Give the ghost a convincing speed and course.', act:'shape', need:'node:COMPUTE@4', kids:[
            { l:'Multiband spoof', cap:'Match the fake across radar, IR and sonar at once.', act:'spoof', need:'node:CLOAK@4', kids:[
              { l:'Signature synthesis', cap:'Forge the exact emissions profile of a chosen craft.', act:'synthesize', need:'node:COMPUTE@5', bridge:'data', kids:[
                { l:'Instrument-proof mirage', cap:'A phantom target every sensor on Earth reads as solid and real.', act:'mirage', tag:'phantom', arch:'corpo', need:'node:CLOAK@6', bridge:'net' } ] } ] } ] },
          { l:'Chaff bloom', cap:'Scatter false returns to swamp a tracker.', act:'bloom', add:true } ] },
        { l:'Cover branch', cap:'Hide real things behind convincing fakes.', act:'cover', tag:'phantom', kids:[
          { l:'Background stitch', cap:'Wrap an object in the scene behind it.', act:'stitch', need:'node:SENSE@4', kids:[
            { l:'Decoy substitution', cap:'Replace the real object\'s image with a harmless one.', act:'substitute', need:'node:COMPUTE@4', kids:[
              { l:'Cover-cast', cap:'A live curtain that hides real objects behind seamless fakes, to eye and sensor alike.', act:'cover', tag:'phantom', arch:'corpo', need:'node:CLOAK@5', bridge:'net' } ] } ] },
          { l:'Motion masking', cap:'Erase the tell-tale shimmer of a moving hide.', act:'mask', add:true, need:'node:CLOAK@4' } ] },
        { l:'Countersense branch', cap:'Blind and confuse the sensors themselves.', act:'blind', tag:'phantom', kids:[
          { l:'Seeker decoy', cap:'Lure a homing weapon off its true target.', act:'lure', need:'node:CLOAK@4', kids:[
            { l:'Lock breaking', cap:'Shake a fixed sensor lock loose.', act:'break', need:'node:COMPUTE@4' } ] },
          { l:'Glare flood', cap:'Wash a camera out with matched light.', act:'flood', add:true, need:'power' } ] },

        // cross-approach convergence: needs all three g6 apexes
        { l:'Total mirage', cap:'A false world made whole — seen, felt and instrument-read as real, hiding all that is.', act:'deceive', tag:'phantom', arch:'corpo', bridge:'net',
          needsAll:['visual-illusion.flat-holo.static-decoy.moving-double.scene-patch.whole-scene-reality-overlay','sensory-phantom.thermal-cast.sound-field.tactile-field.scent-release.undeniable-reality-cast','sensor-spoof-mirage.radar-ghost.doppler-shaping.multiband-spoof.signature-synthesis.instrument-proof-mirage'] } ] }
    ] },

    // -- STEALTH / ENVIRONMENT --
    SEAL: { l:'Seal', cap:'the object\'s relationship to a hostile medium — keeping the outside out or the inside in', kids:[
      { l:'Environmental Exclusion', cap:'wall the wearer off from weather, poison, pressure and vacuum', kids:[
        { l:'Weatherproof Shell', cap:'shrug off rain, grit and cold', tag:'seal', kids:[
          { l:'Rain-and-Dust Gasket', cap:'taped seams and lip-seals keep water and grit out', add:true, tag:'seal' },
          { l:'NBC Hazard Barrier', cap:'airtight against nerve gas, spores and fallout', need:'power', tag:'filter', kids:[
            { l:'Toxin Filter Bank', add:true, cap:'swap-in cartridges scrub war-gas and aerosols', tag:'filter' },
            { l:'Pressure-Hull Liner', cap:'rigid liner holds one atmosphere against crushing depth', need:'power', tag:'plate', kids:[
              { l:'Vacuum-EVA Shell', cap:'holds pressure and heat in hard vacuum', need:'power', tag:'closed', kids:[
                { l:'Micrometeorite Plating', cap:'whipple layers stop orbital debris', add:true, tag:'plate' },
                { l:'Survive-Any-World Hull', cap:'one hull rated crush-depth to open vacuum to acid sky — a walking biosphere', arch:'corpo', need:'node:REPAIR@6', tag:'closed' }
              ] },
              { l:'Deep-Hull Ballast', cap:'trim and buoyancy for abyssal work', tag:'plate' }
            ] }
          ] }
        ] },
        { l:'Climate Regulation', cap:'hold a livable microclimate inside the seal', need:'power', kids:[
          { l:'Thermal Buffer', add:true, cap:'phase-change lining evens out killing heat and cold', tag:'filter' },
          { l:'Closed-Loop Air', cap:'recycle exhaled breath instead of venting it', need:'power', tag:'closed', kids:[
            { l:'Scrubber Cartridge', add:true, cap:'chemical bed pulls CO2 out of the loop', tag:'filter' },
            { l:'Full Atmosphere Recycle', cap:'weeks of sealed air with no outside intake', need:'power', tag:'closed' }
          ] },
          { l:'Radiation Shielding', add:true, cap:'shielded layers stop cosmic rays and fallout', tag:'plate' }
        ] }
      ] },
      { l:'Symbiosis Inversion', cap:'stop excluding the medium — live off it', kids:[
        { l:'Membrane Gill', cap:'pull dissolved oxygen straight from water', need:'power', tag:'gill', kids:[
          { l:'Passive Diffusion Panel', cap:'hydrophobic membrane lets gas cross but not water', tag:'gill' },
          { l:'Electrolytic O2 Splitter', cap:'crack water for oxygen when diffusion is not enough', need:'power', tag:'gill', kids:[
            { l:'Hydrogen Vent', add:true, cap:'safely bleed off the waste hydrogen', tag:'gill' },
            { l:'Photosynthetic Layer', cap:'algal skin fixes carbon and makes oxygen in light', need:'node:BIOFAB@5', tag:'gill', kids:[
              { l:'Algal Skin Graft', cap:'living green layer solar-powers the wearer', tag:'gill' },
              { l:'Symbiote Bloodstream', cap:'endosymbionts ride the blood, feeding tissue directly', need:'node:BIOFAB@6', tag:'gill', kids:[
                { l:'CO2 Fermentation Cycle', cap:'symbionts ferment metabolic waste back into fuel', tag:'gill' },
                { l:'Breathe-the-Water Fluid-Lung', cap:'flooded fluid lungs and symbionts — breathe the sea indefinitely', arch:'corpo', need:'node:BIOFAB@6', tag:'gill' }
              ] }
            ] }
          ] },
          { l:'Gill Toxin Filter', cap:'strip poisons from filthy water before intake', add:true, tag:'filter' }
        ] },
        { l:'Pressure Tolerance', cap:'let the body ride crushing depth without the bends', kids:[
          { l:'Liquid Breathing Medium', cap:'oxygenated fluid equalizes lung pressure at depth', tag:'gill' },
          { l:'Narcosis-Immunity Mix', cap:'tuned gas blend defeats nitrogen narcosis', tag:'filter' },
          { l:'Buoyancy Trim', cap:'neutral trim at any depth', tag:'seal' }
        ] }
      ] },
      { l:'Self-Power Harvest', cap:'let the seal fuel itself from its surroundings', kids:[
        { l:'Thermoelectric Skin', cap:'harvest the body-to-air heat gradient', need:'power', tag:'weave', kids:[
          { l:'Seebeck Weave', add:true, cap:'thermocouple fabric trickles milliwatts from body heat', tag:'weave' },
          { l:'Salinity-Gradient Cell', cap:'osmotic power from the salt gradient of seawater', need:'power', tag:'core', kids:[
            { l:'Osmotic Membrane Stack', cap:'ion-exchange stack turns brine into current', tag:'core' },
            { l:'Self-Fuelling Metabolism', cap:'artificial gut cracks ambient matter for energy', need:'node:BIOFAB@6', tag:'core', kids:[
              { l:'Nutrient-Cracking Gut', add:true, cap:'digests scavenged organics into usable fuel', tag:'core' },
              { l:'Closed-Biosphere Core', cap:'a sealed loop of algae, gut and scrubber that never runs dry', tag:'core', kids:[
                { l:'Waste-to-Fuel Loop', cap:'every waste stream feeds the next process', tag:'core' },
                { l:'Eternal Environmental Metabolism', cap:'a self-fuelling closed biosphere — indefinite survival anywhere', arch:'corpo', need:'node:BIOFAB@6', tag:'core', needsAll:['symbiosis-inversion.membrane-gill.electrolytic-o2-splitter.photosynthetic-layer.symbiote-bloodstream.breathe-the-water-fluid-lung','self-power-harvest.thermoelectric-skin.salinity-gradient-cell.self-fuelling-metabolism'] }
              ] }
            ] }
          ] },
          { l:'Solar Film', cap:'photovoltaic outer skin tops up the cells in daylight', add:true, tag:'weave' }
        ] },
        { l:'Kinetic Scavenge', cap:'wring power out of movement', kids:[
          { l:'Piezo Joints', cap:'flexing seams generate charge as you move', tag:'core' },
          { l:'Regenerative Damper', add:true, cap:'shock absorbers recover impact energy', tag:'core' }
        ] }
      ] },
      { l:'Self-Healing Seal', cap:'a breach that closes itself', kids:[
        { l:'Puncture Reseal', cap:'automatically plug holes and cuts', need:'node:REPAIR@3', tag:'scar', kids:[
          { l:'Gel Sandwich Layer', cap:'viscous filling oozes into and seals small punctures', tag:'scar' },
          { l:'Nanite Scar Mesh', cap:'nanomachines knit the breach shut', need:'node:REPAIR@5', tag:'scar', kids:[
            { l:'Crack-Crawling Repair', cap:'repair bots follow cracks and weld them', tag:'scar' },
            { l:'Living Membrane', cap:'grown tissue that clots and closes like skin', need:'node:BIOFAB@5', tag:'scar', kids:[
              { l:'Clotting Dermis', cap:'the membrane scabs over a wound in seconds', tag:'scar' },
              { l:'Regrowing Hide', cap:'lost sections regrow from a tissue reserve', need:'node:BIOFAB@6', tag:'scar', kids:[
                { l:'Scar-Tissue Cache', cap:'stored biomass feeds major regrowth', tag:'scar' },
                { l:'Living Self-Scar Membrane', cap:'a living hide that scars, heals and regrows any breach forever', arch:'corpo', need:'node:BIOFAB@6', tag:'scar' }
              ] }
            ] }
          ] },
          { l:'Field Patch Kit', cap:'manual adhesive patches for when the auto-seal fails', add:true, tag:'seal' }
        ] },
        { l:'Corrosion Defence', cap:'resist acids and rot', kids:[
          { l:'Acid-Shedding Coat', add:true, cap:'slick coating sheds corrosives before they bite', tag:'filter' },
          { l:'Passivating Skin', cap:'self-forming oxide layer neutralizes attack', tag:'plate' }
        ] }
      ] }
    ] },
    CLOAK: { l:'Cloak', cap:'reduce the object\'s signature across every band an enemy can watch', kids:[
      { l:'Optical Band', cap:'defeat the human eye and the camera', kids:[
        { l:'Matte Nonreflective', cap:'kill glints and shine', tag:'camo', kids:[
          { l:'Anti-Glint Coat', add:true, cap:'matte-black finish gives sensors nothing to catch', tag:'camo' },
          { l:'Chameleon Weave', cap:'skin shifts colour and pattern to match backdrop', need:'power', tag:'camo', kids:[
            { l:'Preset Pattern Shift', cap:'switch between stored camo patterns on command', tag:'camo' },
            { l:'Thermoptic Layer', cap:'bend light around the object for near-invisibility', need:'power', tag:'reflec', kids:[
              { l:'Static Invisibility', cap:'vanishes when standing still', tag:'reflec' },
              { l:'On-the-Move Cloak', cap:'stays invisible while moving through changing scenes', need:'node:SENSE@5', tag:'reflec', kids:[
                { l:'Motion Compensation', add:true, cap:'predicts backdrop shift so the cloak never lags', tag:'reflec' },
                { l:'Metamaterial Ghost-Shell', cap:'transformation-optics shell renders the object a true optical ghost', arch:'corpo', need:'node:COMPUTE@6', tag:'reflec' }
              ] }
            ] }
          ] },
          { l:'Dye-Camo Panel', cap:'cheap fixed dazzle-pattern for the street', add:true, tag:'dye' }
        ] },
        { l:'Active Mimicry', cap:'paint the far side onto the near side', need:'power', kids:[
          { l:'Rear-Projection Skin', cap:'cameras feed the background onto the front face', need:'node:SENSE@4', tag:'reflec' },
          { l:'Light-Bending Panel', cap:'engineered surface steers light past the object', tag:'reflec' },
          { l:'Polarization Filter', add:true, cap:'defeats polarized-light detection tricks', tag:'camo' }
        ] }
      ] },
      { l:'Thermal and Radar', cap:'hide from heat-seekers and radar', kids:[
        { l:'IR Damping', cap:'flatten the heat signature', tag:'filter', kids:[
          { l:'Heat-Spread Panel', add:true, cap:'smears exhaust heat over a wide area to blur the bloom', tag:'filter' },
          { l:'Room-Temp Skin', cap:'holds the outer skin at ambient temperature', need:'power', tag:'filter', kids:[
            { l:'Peltier Active Cooling', add:true, cap:'thermoelectric pumps null the thermal contrast', need:'power', tag:'filter' },
            { l:'Radar-Null Shaping', cap:'faceting and coatings collapse the radar return', need:'power', tag:'reflec', kids:[
              { l:'Faceted Geometry', cap:'angled surfaces bounce radar away from the emitter', tag:'reflec' },
              { l:'Broadband Signature Kill', cap:'absorb across many radar bands at once', need:'power', tag:'reflec', kids:[
                { l:'Multi-Band Absorber', cap:'tuned metasurface soaks a wide frequency spread', tag:'reflec' },
                { l:'Ghost-Signature Spoof', cap:'not just null — projects a false, moving radar phantom elsewhere', arch:'corpo', need:'node:COMPUTE@6', tag:'reflec' }
              ] }
            ] }
          ] },
          { l:'Exhaust Baffling', add:true, cap:'ceramic shrouds cool and hide engine heat', tag:'filter' }
        ] },
        { l:'Radar Absorbent', cap:'coat the object so radar never comes back', tag:'reflec', kids:[
          { l:'Spytex Coating', add:true, cap:'radar-negating nanomachine paint on hull or cloth', tag:'reflec' },
          { l:'Plasma-Stealth Sheath', cap:'ionized layer eats incoming radar energy', need:'power', tag:'reflec' },
          { l:'Cold-Exhaust Vent', add:true, cap:'mixes and dumps waste heat below detection threshold', tag:'filter' }
        ] }
      ] },
      { l:'Acoustic and EM Quiet', cap:'silence sound and stray emissions', kids:[
        { l:'Sound Damping', cap:'stop the object being heard', need:'node:SONIC@3', tag:'filter', kids:[
          { l:'Vibration Isolation', add:true, cap:'floating mounts keep machinery noise off the hull', tag:'filter' },
          { l:'Active Noise Cancel', cap:'emit counter-waves that erase the object\'s own noise', need:'node:SONIC@5', tag:'emitter', kids:[
            { l:'Phase-Inversion Emitter', add:true, cap:'projects the exact anti-noise of each sound source', tag:'emitter' },
            { l:'Silent Envelope', cap:'wraps the whole object in a bubble of cancelled sound', need:'node:SONIC@5', tag:'emitter', kids:[
              { l:'Footfall Masking', cap:'cancels the sharp transients of movement', tag:'emitter' },
              { l:'Zero-Signature Blackout', cap:'no sound, no light, no stray field escapes', need:'power', tag:'emitter', kids:[
                { l:'EM Emission Null', add:true, cap:'suppresses the object\'s own radio and electrical leakage', tag:'emitter' },
                { l:'Total-Silence Ghost', cap:'an object that emits nothing across sound and EM — a hole in perception', arch:'corpo', need:'node:COMPUTE@6', tag:'emitter' }
              ] }
            ] }
          ] },
          { l:'Muffled Actuators', add:true, cap:'quiet servos and joints for stealth movement', tag:'filter' }
        ] },
        { l:'EM Quiet', cap:'stop leaking radio and electrical signatures', kids:[
          { l:'Shielded Electronics', add:true, cap:'faraday shrouds trap internal emissions', tag:'filter' },
          { l:'Emission Scrambler', cap:'randomizes any leakage into noise', need:'node:LINK@4', tag:'emitter' },
          { l:'Coolant-Whisper Pump', add:true, cap:'low-noise cooling that will not give the object away', tag:'filter' }
        ] }
      ] },
      { l:'Vehicle Scale', cap:'stealth scaled up to craft and convoys', kids:[
        { l:'Hull Cloak', cap:'wrap a whole vehicle in signature reduction', need:'power', tag:'reflec', kids:[
          { l:'Conformal Panel Array', cap:'cloak panels tile a vehicle\'s outer hull', tag:'reflec' },
          { l:'Full-Vehicle Thermoptic', cap:'the vehicle itself goes optically and thermally dark', need:'power', tag:'reflec', kids:[
            { l:'Moving-Vehicle Camo', cap:'holds the cloak at speed across changing terrain', need:'node:SENSE@5', tag:'reflec' },
            { l:'Adaptive Counter-Sensor', cap:'reads what is scanning it and tailors its cloak to that sensor', need:'node:COMPUTE@5', tag:'reflec', kids:[
              { l:'Sensor Prediction AI', cap:'anticipates the next scan and pre-nulls it', need:'node:COMPUTE@5', tag:'reflec' },
              { l:'Fleet Stealth Envelope', cap:'one cloak field shared across several craft', need:'node:LINK@5', tag:'reflec', kids:[
                { l:'Shared Signature Mesh', cap:'craft trade signature data to stay collectively dark', tag:'reflec' },
                { l:'Fleet Ghost Doctrine', cap:'a whole formation moves as one zero-signature phantom', arch:'corpo', need:'node:LINK@6', tag:'reflec', needsAll:['thermal-and-radar.ir-damping.room-temp-skin.radar-null-shaping.broadband-signature-kill.ghost-signature-spoof','vehicle-scale.hull-cloak.full-vehicle-thermoptic.adaptive-counter-sensor'] }
              ] }
            ] }
          ] },
          { l:'Wake Suppression', add:true, cap:'smooths the dust, water or air wake that betrays movement', tag:'filter' }
        ] },
        { l:'Convoy Linkage', cap:'coordinate stealth across a group', need:'node:LINK@4', kids:[
          { l:'Relay Spoofing', cap:'feeds trackers a false convoy position', need:'node:LINK@4', tag:'emitter' },
          { l:'Decoy Emitters', cap:'drones broadcast phantom signatures to split pursuit', tag:'emitter' },
          { l:'Civilian Transponder Mask', add:true, cap:'reads to traffic control as ordinary civilian craft', need:'node:LINK@4', tag:'emitter' }
        ] }
      ] }
    ] },
    DISGUISE: { l:'Disguise', cap:'make the wearer — or the object itself — read as something it is not', kids:[
      { l:'Surface and Shape', cap:'change what the object looks and feels like', kids:[
        { l:'Reskin Coat', cap:'swap the outer appearance', tag:'dye', kids:[
          { l:'Colour-Texture Wrap', cap:'a fast wrap changes colour, logo and finish', tag:'dye' },
          { l:'Texture-Morph Skin', cap:'surface changes its own texture and grain', need:'node:MORPH@4', tag:'camo', kids:[
            { l:'Roughness Shift', cap:'skin goes from matte cloth to gloss metal on command', tag:'camo' },
            { l:'Shape-Shift Frame', cap:'the object alters its silhouette', need:'node:MORPH@5', tag:'shell', kids:[
              { l:'Outline Remould', cap:'reshapes profile to read as a different item', tag:'shell' },
              { l:'Programmable-Matter Recast', cap:'the body reflows into a wholly different object', need:'node:FABRICATE@6', tag:'shell', kids:[
                { l:'Volumetric Reflow', cap:'mass redistributes to build the new form', tag:'shell' },
                { l:'Total Recast Body', cap:'programmable matter recasts the whole object into a convincing other thing', arch:'corpo', need:'node:FABRICATE@6', tag:'shell' }
              ] }
            ] }
          ] },
          { l:'Logo-Swap Panel', cap:'stick-on branding passes casual inspection', add:true, tag:'dye' }
        ] },
        { l:'Soft Tissue', cap:'remould the wearer\'s own flesh', need:'node:BIOFAB@4', kids:[
          { l:'Biosculpt Veneer', cap:'vat-grown tissue reshapes the face and body', need:'node:BIOFAB@5', tag:'cyberware', kids:[
            { l:'Vat-Skin Graft', cap:'new skin and features grafted over the old', tag:'cyberware' },
            { l:'Face Remould', cap:'bone and soft tissue reshaped into another person\'s face', need:'node:BIOFAB@6', tag:'cyberware' }
          ] },
          { l:'Tech-Hair Weave', cap:'programmable hair changes colour, length and style', tag:'dye' }
        ] }
      ] },
      { l:'Object Masquerade', cap:'make the object read as a different object to sensors', kids:[
        { l:'Signature Mask', cap:'forge the thermal and electronic identity', tag:'camo', kids:[
          { l:'Thermal Mask', add:true, cap:'reshapes the heat print to match another object', tag:'filter' },
          { l:'Transponder Cuckoo', cap:'broadcasts another object\'s identity codes', need:'node:LINK@4', tag:'emitter', kids:[
            { l:'ID-Echo Swap', add:true, cap:'answers challenges as a registered friendly', tag:'emitter' },
            { l:'Vehicle Clone', cap:'impersonates a specific real vehicle in every system', need:'node:LINK@5', tag:'emitter', kids:[
              { l:'Plate-and-VIN Spoof', cap:'matching plates, VIN and registry ghost', tag:'emitter' },
              { l:'Chameleon Object', cap:'projected holo skin plus spoofed signatures — reads as anything', need:'node:PROJECT@6', tag:'shell', kids:[
                { l:'Holo-Shell Wrap', cap:'volumetric projection clads the object in a false form', tag:'shell' },
                { l:'Total Decoy Doppelganger', cap:'a full decoy that fools eyes, sensors and registries at once', arch:'corpo', need:'node:PROJECT@6', tag:'shell' }
              ] }
            ] }
          ] },
          { l:'Emissions Forgery', cap:'mimics the radio chatter of the object being impersonated', need:'node:LINK@4', tag:'emitter' }
        ] },
        { l:'Form Decoy', cap:'stand up a physical fake', kids:[
          { l:'Inflatable Mockup', cap:'cheap decoy that fools a passing glance', tag:'shell' },
          { l:'Holo-Projection Skin', cap:'light-cast facade over a plain frame', need:'node:PROJECT@4', tag:'shell' }
        ] }
      ] },
      { l:'Identity Spoof', cap:'forge who the wearer is to the machine', kids:[
        { l:'Biometric Fake', cap:'beat the scanners', tag:'lock', kids:[
          { l:'Fingerprint Sleeve', cap:'moulded sleeve mimics a print to fool basic locks', tag:'lock' },
          { l:'Named-Person Graft', cap:'assume a specific real person\'s biometrics', need:'node:HACK@5', tag:'lock', kids:[
            { l:'Photo-and-Retina Swap', add:true, cap:'spoofs the facial and retinal record checks', tag:'lock' },
            { l:'Record Graft', cap:'writes the false identity into the databases behind the ID', need:'node:HACK@5', tag:'lock', kids:[
              { l:'Database Backstory Seed', cap:'plants plausible history, travel and purchases', tag:'lock' },
              { l:'Complete Net False-Identity', cap:'a full SIN with every record backing it, proof to deep scrutiny', need:'node:LINK@6', tag:'lock', kids:[
                { l:'Cross-Agency Sync', cap:'the false SIN checks out across state and corp registries', tag:'lock' },
                { l:'Total SIN Rebirth', cap:'a flawless born-legal identity no verification system can burn', arch:'corpo', need:'node:LINK@6', tag:'lock' }
              ] }
            ] }
          ] },
          { l:'DNA Decoy Sample', cap:'planted genetic material misleads a DNA reader', tag:'lock' }
        ] },
        { l:'Credential Forgery', cap:'fake the paperwork', kids:[
          { l:'Fake SIN Card', cap:'stand-alone card fools a reader with no net backing', tag:'lock' },
          { l:'Forged Permits', cap:'licences and passes that survive a glance', tag:'lock' }
        ] }
      ] },
      { l:'Manner Spoof', cap:'sell the impersonation as a living person', kids:[
        { l:'Voice Mimicry', cap:'sound like someone else', kids:[
          { l:'Pitch-Shift Vox', cap:'alters pitch and timbre in real time', tag:'cyberware' },
          { l:'Voiceprint Clone', cap:'reproduces a target\'s exact vocal signature', need:'node:COMPUTE@5', tag:'cyberware', kids:[
            { l:'Cadence Modelling', cap:'copies the target\'s rhythm and phrasing', tag:'cyberware' },
            { l:'Behavioural Mimic', cap:'copies gait, tells and mannerisms', need:'node:COMPUTE@5', tag:'driver', kids:[
              { l:'Gait-and-Tell Copy', cap:'walks and gestures as the target does', tag:'driver' },
              { l:'Total Impostor', cap:'physical, net and behavioural cover fused into one seamless double', need:'node:COMPUTE@6', tag:'driver', kids:[
                { l:'Live-Coaching AI', cap:'a whispered assistant feeds correct responses in the moment', tag:'driver' },
                { l:'Perfect Double Cover', cap:'a total impostor that fools human and machine alike', arch:'corpo', need:'node:COMPUTE@6', tag:'driver', needsAll:['surface-and-shape.reskin-coat.texture-morph-skin.shape-shift-frame.programmable-matter-recast.total-recast-body','identity-spoof.biometric-fake.named-person-graft.record-graft.complete-net-false-identity.total-sin-rebirth'] }
              ] }
            ] }
          ] },
          { l:'Accent Library', cap:'stored accents and dialects on demand', tag:'cyberware' }
        ] },
        { l:'Social Cover', cap:'the human support behind the mask', kids:[
          { l:'Backstopped Legend', add:true, cap:'a cover story with real people who vouch for it', tag:'lock' },
          { l:'Handler Support', cap:'a controller runs interference in real time', tag:'driver' }
        ] }
      ] }
    ] },
    SECURITY: { l:'Security', cap:'the object protects itself — who may use it, that it runs safely, and that no one can crack it', kids:[
      { l:'Authenticate', cap:'prove the user is allowed before the object works', kids:[
        { l:'Simple Lock', cap:'basic gate on operation', tag:'lock', kids:[
          { l:'Keyed Handle', cap:'a physical key or coded grip unlocks it', tag:'lock' },
          { l:'Biometric Grip', cap:'reads the holder\'s body to allow use', need:'node:SENSE@4', tag:'lock', kids:[
            { l:'Fingerprint-Palm Reader', cap:'grip electrodes verify print and palm on contact', tag:'lock' },
            { l:'DNA Lock', cap:'a genetic sample must match before it fires or opens', need:'node:SENSE@5', tag:'lock', kids:[
              { l:'Cell-Sample Assay', cap:'reads shed cells to confirm the owner', tag:'lock' },
              { l:'Neural Lock', cap:'keyed to the user\'s own nervous-system signals', need:'node:COMPUTE@5', tag:'lock', kids:[
                { l:'Brainwave Signature', cap:'unlocks only to a matching neural pattern', tag:'lock' },
                { l:'One-Mind Neural Lock', cap:'keyed to a single living mind — useless to anyone else, ever', arch:'corpo', need:'node:COMPUTE@6', tag:'lock' }
              ] }
            ] }
          ] },
          { l:'PIN Pad', cap:'a memorized code as a fallback gate', tag:'lock' }
        ] },
        { l:'Presence Check', cap:'confirm the right user is still the one holding it', kids:[
          { l:'Proximity Token', add:true, cap:'works only near the owner\'s paired tag', need:'node:LINK@3', tag:'lock' },
          { l:'Continuous Auth', cap:'re-checks the user constantly, not just at unlock', need:'node:SENSE@4', tag:'lock' },
          { l:'Iris Scan', cap:'optical iris match as an added factor', need:'node:SENSE@4', tag:'lock' }
        ] }
      ] },
      { l:'Safe Operation', cap:'stop the object harming its user or running away', kids:[
        { l:'Interlocks', cap:'block unsafe states', need:'node:COMPUTE@3', tag:'core', kids:[
          { l:'Dead-Man Switch', cap:'shuts down the instant the user lets go', tag:'core' },
          { l:'Anti-Runaway Cutout', cap:'kills power if output exceeds safe limits', need:'node:COMPUTE@4', tag:'core', kids:[
            { l:'Overload Sensing', cap:'watches load, heat and speed for danger', tag:'core' },
            { l:'Fail-Safe Governor', cap:'clamps the object to a safe envelope no matter the command', need:'node:COMPUTE@5', tag:'core', kids:[
              { l:'Rate Limiter', cap:'caps how fast state can change to prevent runaway', tag:'core' },
              { l:'Runaway-Proof Governor', cap:'a governor no fault or hack can push past its safe limits', arch:'corpo', need:'node:COMPUTE@6', tag:'core' }
            ] }
          ] },
          { l:'Warning Beacon', add:true, cap:'flags unsafe conditions to the user', tag:'core' }
        ] },
        { l:'Fault Tolerance', cap:'keep failing safe under damage', kids:[
          { l:'Redundant Circuits', add:true, cap:'backup paths take over if one fails', tag:'core' },
          { l:'Graceful Shutdown', cap:'powers down in a controlled, non-destructive way', need:'node:COMPUTE@4', tag:'core' },
          { l:'Watchdog Timer', cap:'resets the object if its logic hangs', tag:'core' }
        ] }
      ] },
      { l:'Anti-Reverse Black-Box', cap:'stop anyone learning how it works', kids:[
        { l:'Obfuscated Internals', cap:'hide the design from prying eyes', need:'node:HACK@3', tag:'shell', kids:[
          { l:'Potting Compound', cap:'resin fill hides and protects the guts', tag:'shell' },
          { l:'Sealed Black-Box', cap:'a housing that reveals nothing when opened', need:'node:HACK@4', tag:'shell', kids:[
            { l:'Obscured Bus Traffic', add:true, cap:'internal signals are masked from probes', need:'node:CLOAK@4', tag:'shell' },
            { l:'Anti-Probe Mesh', cap:'a conductive envelope that detects any intrusion attempt', need:'node:HACK@5', tag:'shell', kids:[
              { l:'Encrypted Firmware', cap:'code that will not run or read outside the sealed core', tag:'shell' },
              { l:'Unbreakable Black-Box', cap:'a core no team on Earth can reverse-engineer', arch:'corpo', need:'node:HACK@6', tag:'shell', kids:[
                { l:'Chaff Logic', cap:'decoy circuits waste an attacker\'s analysis', tag:'shell' },
                { l:'Fortress-Object Core', cap:'an object that authenticates its owner, guards its function and self-erases under attack', arch:'corpo', need:'node:DEMOLISH@6', tag:'shell', needsAll:['authenticate.simple-lock.biometric-grip.dna-lock.neural-lock.one-mind-neural-lock','anti-reverse-black-box.obfuscated-internals.sealed-black-box.anti-probe-mesh.unbreakable-black-box'] }
              ] }
            ] }
          ] },
          { l:'Serial-Scramble', cap:'strips identifying marks and traces', tag:'shell' }
        ] },
        { l:'Tamper Evidence', cap:'make any intrusion obvious after the fact', kids:[
          { l:'Break-Seal Witness', add:true, cap:'seals that cannot be restored once broken', tag:'shell' },
          { l:'Intrusion Log', add:true, cap:'records every attempt to open the object', need:'node:COMPUTE@4', tag:'shell' },
          { l:'Dye-Pack Marker', cap:'stains a thief and the stolen object on breach', tag:'shell' }
        ] }
      ] },
      { l:'Active Defence', cap:'the object fights back when attacked', kids:[
        { l:'Tamper Response', cap:'react to a breach in progress', need:'node:SHOCK@3', tag:'shell', kids:[
          { l:'Lockdown Bolt', cap:'seals itself rigid the moment it is tampered with', tag:'shell' },
          { l:'Data Zeroize', cap:'wipes its secrets the instant the envelope is cut', need:'node:DEMOLISH@4', tag:'shell', kids:[
            { l:'Key Erasure', cap:'destroys the crypto keys so the data is junk', tag:'shell' },
            { l:'Thermite Self-Destruct', cap:'a die-burn charge slags the core beyond recovery', need:'node:DEMOLISH@6', tag:'shell', kids:[
              { l:'Charge Interlock', add:true, cap:'arms only under confirmed hostile intrusion', tag:'shell' },
              { l:'Counter-Intrusion Strike', cap:'zeroizes, slags itself and shocks the attacker back through their own tools', arch:'corpo', need:'node:SHOCK@6', tag:'shell' }
            ] }
          ] },
          { l:'Shock Envelope', cap:'delivers a stunning jolt to anyone forcing entry', need:'node:SHOCK@4', tag:'shell' }
        ] },
        { l:'Deterrent Signalling', cap:'discourage the attack before it starts', kids:[
          { l:'Alarm Shriek', add:true, cap:'loud alert draws attention to the intrusion', tag:'shell' },
          { l:'Silent Alert', cap:'notifies the owner without tipping the intruder', need:'node:LINK@4', tag:'shell' }
        ] }
      ] }
    ] },
    MORPH: { l:'Morph', cap:'the object changes its own form, mode or size', kids:[
      { l:'Fold and Transform', cap:'collapse, unfold and switch between fixed modes', kids:[
        { l:'Fold-Away Frame', cap:'stow into a smaller carried shape', tag:'shell', kids:[
          { l:'Hinge-and-Latch Fold', cap:'folds flat on mechanical hinges for transport', tag:'shell' },
          { l:'Two-Mode Transform', cap:'switches cleanly between two working configurations', need:'power', tag:'shell', kids:[
            { l:'Locking Detents', cap:'each mode locks solid so it holds under load', tag:'shell' },
            { l:'Modular Reconfigure', cap:'reorders its own modules into new layouts', need:'node:COMPUTE@5', tag:'shell', kids:[
              { l:'Hot-Swap Segments', add:true, cap:'sections detach and re-dock in new positions', tag:'shell' },
              { l:'Omni-Form Reshaper', cap:'reconfigures into any of dozens of purpose-built forms on command', arch:'corpo', need:'node:COMPUTE@6', tag:'shell', kids:[
                { l:'Form Library', cap:'stored blueprints the object can fold itself into', tag:'shell' },
                { l:'True Omni-Reshaper', cap:'an object that becomes whatever the task needs, then folds back', arch:'corpo', need:'node:FABRICATE@6', tag:'shell', needsAll:['morphing-shell.flowing-surface.scale-shift-skin.programmable-matter-body','self-assemble.deployable-kit.self-building-frame.swarm-assemble'] }
              ] }
            ] }
          ] },
          { l:'Quick-Deploy Spring', cap:'snaps open from stowed to ready in one motion', add:true, tag:'shell' }
        ] },
        { l:'Mode Control', cap:'manage which configuration is active', need:'node:COMPUTE@3', kids:[
          { l:'Preset Selector', cap:'pick a stored mode with one command', tag:'driver' },
          { l:'Auto-Adapt Trigger', cap:'senses the situation and picks the right form itself', need:'node:COMPUTE@5', tag:'driver' },
          { l:'Manual Override', cap:'force a mode when the automation is wrong', tag:'driver' }
        ] }
      ] },
      { l:'Self-Assemble', cap:'build itself up from parts or units', kids:[
        { l:'Deployable Kit', cap:'unpacks into a working structure', tag:'shell', kids:[
          { l:'Snap-Together Modules', cap:'parts click into place by hand', tag:'shell' },
          { l:'Self-Building Frame', cap:'shape-memory members drive their own assembly', need:'power', tag:'shell', kids:[
            { l:'SMA Deploy Springs', cap:'heated alloy hinges unfold the structure unaided', tag:'shell' },
            { l:'Swarm-Assemble', cap:'many small units crawl together into a larger whole', need:'node:COMPUTE@5', tag:'swarm', kids:[
              { l:'Unit Coordination', cap:'the units negotiate their places in the structure', need:'node:COMPUTE@5', tag:'swarm' },
              { l:'Self-Assembling Structure', cap:'a cloud of modules that builds any pre-planned structure with no hands', arch:'corpo', need:'node:FAB-ADDITIVE@6', tag:'swarm', kids:[
                { l:'On-Site Fabrication', cap:'the swarm prints missing parts as it builds', tag:'swarm' },
                { l:'Autonomous Megastructure', cap:'self-assembles, self-repairs and rebuilds itself at scale', arch:'corpo', need:'node:FAB-FORGE@6', tag:'swarm' }
              ] }
            ] }
          ] },
          { l:'Field Anchor Kit', cap:'stakes and ties that hold the deployed form down', add:true, tag:'shell' }
        ] },
        { l:'Disassembly', cap:'break itself back down for transport', kids:[
          { l:'Reverse-Fold Pack', cap:'collapses back into its carry state', tag:'shell' },
          { l:'Part Recovery', cap:'accounts for and re-stows every module', need:'node:COMPUTE@4', tag:'swarm' },
          { l:'Compact Stow', cap:'nests parts to their smallest volume', tag:'shell' }
        ] }
      ] },
      { l:'Morphing Shell', cap:'a surface that flows into new shapes', kids:[
        { l:'Flowing Surface', cap:'the skin itself reshapes', need:'power', tag:'shell', kids:[
          { l:'Soft-Actuator Skin', cap:'pneumatic cells bulge and flatten to change contour', tag:'shell' },
          { l:'Scale-Shift Skin', cap:'overlapping scales slide to grow or shrink the surface', need:'node:FABRICATE@5', tag:'shell', kids:[
            { l:'Tessellated Plates', cap:'kirigami plates expand and contract the shell', tag:'shell' },
            { l:'Programmable-Matter Body', cap:'the whole body is reconfigurable matter under command', need:'node:FABRICATE@6', tag:'shell', kids:[
              { l:'Claytronic Lattice', cap:'catoms bond and release to flow into any form', tag:'shell' },
              { l:'True Programmable-Matter Body', cap:'an object of living matter that becomes any shape, texture or function', arch:'corpo', need:'node:FABRICATE@6', tag:'shell' }
            ] }
          ] },
          { l:'Stiffness Tuning', cap:'the shell hardens or softens on demand', tag:'shell' }
        ] },
        { l:'Surface Feedback', cap:'the shell senses its own shape as it morphs', need:'node:COMPUTE@4', kids:[
          { l:'Strain Sensing', cap:'embedded sensors report the current shape', tag:'shell' },
          { l:'Shape Correction', cap:'closes the loop to hit the target form exactly', need:'node:COMPUTE@5', tag:'shell' }
        ] }
      ] },
      { l:'Scale Shift', cap:'change the object\'s actual size', kids:[
        { l:'Telescoping Frame', cap:'extends and retracts along its length', tag:'shell', kids:[
          { l:'Nested Segments', cap:'sections slide inside each other to grow', tag:'shell' },
          { l:'Volumetric Expansion', cap:'grows in every dimension, not just length', need:'power', tag:'shell', kids:[
            { l:'Foam-Cell Inflate', cap:'expanding cells multiply the object\'s volume', tag:'shell' },
            { l:'True Scale-Shift', cap:'reconfigures its matter to change real size, not just extend', need:'node:FABRICATE@6', tag:'shell', kids:[
              { l:'Mass Redistribution', cap:'moves material inward or outward to resize', tag:'shell' },
              { l:'Full Scale-Shift Body', cap:'an object that shrinks to pocket-size or grows to room-size at will', arch:'corpo', need:'node:FABRICATE@6', tag:'shell' }
            ] }
          ] },
          { l:'Locking Stops', cap:'holds any extended size rigidly', add:true, tag:'shell' }
        ] },
        { l:'Compaction', cap:'shrink for storage and carry', kids:[
          { l:'Collapse-to-Core', cap:'folds down around a dense central core', tag:'shell' },
          { l:'Vacuum Compress', cap:'evacuates internal voids to pack tighter', need:'power', tag:'shell' }
        ] }
      ] }
    ] },

    // -- BODY / MOVEMENT / MEDICAL --
    FLY: { l:'Fly', cap:'Sustained lift and flight for a body or a small frame.', kids:[

      { l:'Rotor Lift', cap:'Spinning blades bite air for lift.', act:'lift', tag:'rotor', kids:[
        { l:'Strap-On Prop', cap:'A backpack propeller hauls you off the ground, briefly.', tag:'rotor', need:'node:POWER@1', kids:[
          { l:'Twin Rotor Rig', cap:'Two counter-rotating props cancel torque so you do not spin.', kids:[
            { l:'Ducted Fan', cap:'Shrouded fans give more thrust per diameter and guard the blades.', tag:'thrust', need:'node:POWER@2', kids:[
              { l:'Ducted VTOL Pod', cap:'Fans in tilting nacelles lift straight up then push forward.', need:'node:COMPUTE@3', kids:[
                { l:'Tilt-Rotor Cruise', cap:'Nacelles rotate full horizontal for winged cruise range.', kids:[
                  { l:'Silent VTOL Flyer', cap:'Noise-cancelled ducted lift for a near-inaudible corp aerodyne.', arch:'corpo', act:'lift', tag:'flight', need:'node:POWER@6', needsAll:['rotor-lift.strap-on-prop.twin-rotor-rig.ducted-fan.ducted-vtol-pod.tilt-rotor-cruise'] } ] } ] },
              { l:'Gimbaled Stabilizer', cap:'Active gimbals hold a dead-steady hover in gusts.', add:true, need:'node:COMPUTE@2' } ] },
            { l:'Autorotation Safety', cap:'Freewheeling blades let you glide down on a dead engine.', add:true } ] },
          { l:'Coaxial Micro-Rotor', cap:'Stacked rotors shrink the rig to a shoulder mount.', kids:[
            { l:'Swarm Lift Cells', cap:'Many tiny rotors share load and shrug off one failing.', need:'node:COMPUTE@3', kids:[
              { l:'Distributed Lift Array', cap:'A grid of ducted cells lifts a whole cargo cradle.', takes:'flight', kids:[
                { l:'Corp Lift Platform', cap:'A quiet autonomous multi-cell hover-truck for the corp docks.', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] } ] } ] },

      { l:'Jet Thrust', cap:'Reaction thrust hurls you skyward.', act:'thrust', tag:'thrust', need:'node:POWER@2', kids:[
        { l:'Ducted Turbine Pack', cap:'A strapped turbine roars you into a low bounding leap.', tag:'thrust', kids:[
          { l:'Vectored Nozzles', cap:'Swivelling exhaust points thrust to steer and hover.', need:'node:COMPUTE@3', kids:[
            { l:'Sustained Jet Lift', cap:'Balanced lift-jets hold you aloft, not just leaping.', need:'node:POWER@4', kids:[
              { l:'High-Altitude Jet-Pack', cap:'Sealed high-thrust pack climbs into thin cold air.', need:'node:SEAL@4', kids:[
                { l:'Hypersonic Boost Rig', cap:'A scram-boosted personal thruster for a corp military insertion.', arch:'corpo', need:'node:POWER@6' } ] },
              { l:'Thrust-Vector Trim', cap:'Micro-jets auto-trim attitude so you do not tumble.', add:true, need:'node:COMPUTE@4' } ] } ] },
          { l:'Heat Baffling', cap:'Shrouded exhaust hides the thermal plume from seekers.', add:true, need:'node:SEAL@3' },
          { l:'Fuel Endurance Tank', cap:'A denser fuel cell stretches burn time.', add:true, sc:{max:3,per:'tank'} } ] } ] },

      { l:'Buoyant Lift', cap:'Displace air with something lighter to float.', act:'float', tag:'lift', kids:[
        { l:'Gas Balloon Pack', cap:'A quick-fill lift bag drags you gently upward.', tag:'lift', kids:[
          { l:'Steerable Dirigible', cap:'A powered gasbag with fins goes where you point it.', need:'node:POWER@2', kids:[
            { l:'Rigid Airframe Ship', cap:'A framed hull carries crew and cargo aloft for days.', takes:'flight', need:'node:POWER@3', kids:[
              { l:'Vacuum-Cell Hull', cap:'Evacuated rigid cells lift more than any gas can.', need:'node:FABRICATE@5', kids:[
                { l:'Endurance Airship', cap:'A vacuum-lift corp airship that loiters for weeks unrefuelled.', arch:'corpo', need:'node:FABRICATE@6' } ] },
              { l:'Ballast Trim Loop', cap:'Pumped ballast fine-tunes buoyancy without venting lift.', add:true, need:'node:COMPUTE@3' } ] },
            { l:'Solar Skin', cap:'A photovoltaic envelope trickle-charges the drive.', add:true, need:'node:POWER@3' } ] } ] } ] },

      { l:'Antigrav Glide', cap:'Trade falling for flying with wings or exotic lift.', act:'glide', tag:'flight', kids:[
        { l:'Wingsuit Glide', cap:'A membrane suit turns a fall into a long shallow glide.', tag:'flight', kids:[
          { l:'Fold-Out Wings', cap:'Rigid wings deploy from the pack for real lift.', need:'node:MORPH@3', kids:[
            { l:'Morphing Wing Camber', cap:'Wings reshape mid-air to trade speed for lift on demand.', need:'node:MORPH@4', kids:[
              { l:'Ground-Effect Skim', cap:'Wide wings ride an air cushion just above a surface.', kids:[
                { l:'AV Ducted-Lift Flyer', cap:'A true corp aerodyne on vectored ducted-fan lift (canonical AV).', arch:'corpo', need:'node:POWER@6' } ] },
              { l:'Gust Load Sensing', cap:'Sensors bleed load off a wing before it snaps.', add:true, need:'node:SENSE@4' } ] } ] },
          { l:'Grav-Cell Lifter', cap:'A speculative field-lift cell — beyond 2020 canon, flagged as such.', need:'node:POWER@4', kids:[
            { l:'Field Stabilized Hover', cap:'A contained lift field holds a dead-steady float.', need:'node:COMPUTE@5', kids:[
              { l:'True Grav-Drive', cap:'A speculative corp gravity drive — no reaction mass, non-canon apex.', arch:'corpo', need:'node:POWER@6' } ] } ] } ] } ] }
    ] },
    MOVE: { l:'Move', cap:'Carry a body or frame across terrain that stops wheels.', kids:[

      { l:'Legged Walker', cap:'Powered legs step over broken ground.', act:'walk', tag:'limb', need:'node:POWER@2', kids:[
        { l:'Wheelchair-Motor Exo', cap:'A strap-on leg brace turns a shuffle into a stride.', tag:'limb', kids:[
          { l:'Bipedal Frame', cap:'Two powered legs balance and walk under load.', need:'node:COMPUTE@3', kids:[
            { l:'Dynamic Balance Core', cap:'Active balancing keeps the frame upright when shoved.', need:'node:COMPUTE@4', kids:[
              { l:'Quadruped Mode', cap:'Drops to four legs for a stable weapons platform.', need:'node:MORPH@4', kids:[
                { l:'All-Terrain Multi-Leg', cap:'A six-legged corp walker that crosses anything, any grade.', arch:'corpo', need:'node:POWER@6' } ] },
              { l:'Gait Learning', cap:'Learns new gaits for stairs, scree and mud on its own.', add:true, need:'node:COMPUTE@5' } ] },
            { l:'Load Sharing Struts', cap:'Struts pass cargo weight straight to the feet.', add:true, need:'node:FAB-FORGE@3' } ] },
          { l:'Reconfigurable Legs', cap:'Legs refold into a crouch or a sprint stance.', need:'node:MORPH@3', kids:[
            { l:'Terrain Scanner Feet', cap:'Feet feel ahead and pick footholds before stepping.', need:'node:SENSE@3', kids:[
              { l:'Heavy Assault Walker', cap:'An armored corp chassis that hosts mounted gear.', arch:'corpo', takes:'plate', need:'node:FAB-FORGE@6' } ] } ] } ] } ] },

      { l:'Rolling', cap:'Wheels and tracks for speed over ground.', act:'roll', tag:'tread', need:'node:POWER@2', kids:[
        { l:'Motor Wheels', cap:'Powered wheels haul the frame fast on flat.', tag:'tread', kids:[
          { l:'All-Terrain Tires', cap:'Big soft tires crawl over rubble and sand.', kids:[
            { l:'Track Conversion', cap:'Tracks spread weight so it never bogs down.', need:'node:FAB-FORGE@3', kids:[
              { l:'Active Suspension', cap:'Each corner rides its own bump, keeping the deck level.', need:'node:COMPUTE@4', kids:[
                { l:'Hybrid Wheel-Leg', cap:'Wheels on legged struts step OR roll as terrain demands.', need:'node:MORPH@5', kids:[
                  { l:'Corp Roller-Strider', cap:'An autonomous corp chassis that morphs wheel-to-leg at speed.', arch:'corpo', need:'node:MORPH@6' } ] } ] },
              { l:'Run-Flat Core', cap:'Solid inner rings keep it moving on shot-out tires.', add:true } ] },
            { l:'Regen Hub Brakes', cap:'Braking dumps energy back into the cells.', add:true, need:'node:POWER@3' } ] } ] } ] },

      { l:'Climbing Adhesion', cap:'Stick to walls and climb sheer faces.', act:'climb', tag:'grip', kids:[
        { l:'Gecko Pads', cap:'Dry micro-hair pads cling to smooth walls.', tag:'grip', kids:[
          { l:'Magnetic Grippers', cap:'Switchable magnets lock onto steel structure.', need:'node:POWER@2', kids:[
            { l:'Piton Claw Array', cap:'Deploying claws bite rough rock and concrete.', need:'node:MORPH@3', kids:[
              { l:'Wall-Run Actuators', cap:'Fast limbs let it run a short vertical dash.', need:'node:COMPUTE@4', kids:[
                { l:'Ceiling Traverse', cap:'Coordinated grip lets it cross an overhang inverted.', need:'node:COMPUTE@5', kids:[
                  { l:'Corp Wall-Crawler', cap:'An autonomous corp climber that owns any facade.', arch:'corpo', need:'node:COMPUTE@6' } ] },
                { l:'Fall Arrest Line', cap:'A spooled tether catches a slip before it kills.', add:true } ] } ] },
            { l:'Grip Force Sensing', cap:'Feels each hold and re-grips before it peels.', add:true, need:'node:SENSE@3' } ] } ] } ] },

      { l:'Aquatic Subterranean', cap:'Move through water or solid earth.', act:'traverse', tag:'core', kids:[
        { l:'Swim Fins', cap:'Powered fins push the frame through water.', tag:'fin', need:'node:POWER@2', kids:[
          { l:'Sealed Dive Body', cap:'A pressure-sealed hull lets it work underwater.', need:'node:SEAL@3', kids:[
            { l:'Ballast Dive Trim', cap:'Pumped ballast dives, holds depth and surfaces.', need:'node:COMPUTE@3', kids:[
              { l:'Deep-Pressure Hull', cap:'A crush-proof hull rated for the abyss.', need:'node:SEAL@5', kids:[
                { l:'Abyssal Swimmer', cap:'A corp deep-sea frame that works the ocean floor.', arch:'corpo', need:'node:SEAL@6' } ] },
              { l:'Silent Impeller', cap:'A shrouded pump-jet moves it without a wake.', add:true, need:'node:POWER@4' } ] } ] },
        { l:'Burrow Auger', cap:'A drill head chews the frame down into loose earth.', need:'node:POWER@3', tag:'auger', kids:[
          { l:'Spoil Ejector', cap:'Cast-off debris packs the tunnel behind it.', need:'node:FAB-FORGE@4', kids:[
            { l:'Melt-Bore Head', cap:'A reactor-hot tip melts rock to a glass-lined bore.', need:'node:POWER@5', kids:[
              { l:'Subterrene Tunneler', cap:'A corp melt-boring machine that vitrifies its own tunnel.', arch:'corpo', need:'node:FAB-FORGE@6' } ] } ] } ] } ] } ] }
    ] },
    BOOST: { l:'Boost', cap:'Push the user\'s own body past its native limits.', kids:[

      { l:'Strength Frame', cap:'External or grafted muscle multiplies your lift.', act:'assist', tag:'exo', need:'node:POWER@2', kids:[
        { l:'Exo-Assist Brace', cap:'A worn brace takes part of every load off your back.', tag:'exo', kids:[
          { l:'Powered Exoframe', cap:'Motorized joints let you carry heavy gear all day.', need:'node:COMPUTE@3', kids:[
            { l:'Neurolinked Frame', cap:'The frame reads your muscles and moves with you.', need:'node:COMPUTE@4', kids:[
              { l:'Grafted Myomer', cap:'Synthetic muscle is grafted right onto your bones.', need:'node:BIOFAB@4', kids:[
                { l:'Milspec Myomer Muscle', cap:'Corp military myomer for inhuman, quiet strength.', arch:'corpo', need:'node:BIOFAB@6' } ] },
              { l:'Load Feedback', cap:'Leaves you enough felt weight to judge your grip.', add:true, need:'node:SENSE@3' } ] },
            { l:'Bone Lacing', cap:'Laced bone stops the new muscle tearing you apart.', add:true, need:'node:BIOFAB@3' } ] },
          { l:'Hydraulic Limb', cap:'A bolt-on power limb for one crushing arm.', takes:'limb', need:'node:FAB-FORGE@3', kids:[
            { l:'Servo Overdrive', cap:'A brief overdrive spikes force at the joint\'s cost.', need:'node:POWER@4', kids:[
              { l:'Corp Siege Frame', cap:'A corp exoframe that shrugs off recoil and rams doors.', arch:'corpo', takes:'plate', need:'node:POWER@6' } ] } ] } ] } ] },

      { l:'Reflex Speed', cap:'Cut the lag between seeing and acting.', act:'accelerate', tag:'wire', need:'node:COMPUTE@2', kids:[
        { l:'Reaction Chip', cap:'A slotted chip shaves your reaction time a notch.', tag:'wire', kids:[
          { l:'Kerenzikov Wire', cap:'Always-on reflex boost; the world seems to slow (canon +Init).', need:'node:COMPUTE@3', kids:[
            { l:'Sandevistan Burst', cap:'A willed surge of speed for a few violent seconds (canon).', need:'node:COMPUTE@4', kids:[
              { l:'Accelerated Perception', cap:'Time dilates so you act inside others\' reactions.', need:'node:SENSE@5', kids:[
                { l:'Top-Tier Wired Reflexes', cap:'Corp bleeding-edge speedware, faster than flesh allows.', arch:'corpo', need:'node:COMPUTE@6' } ] },
              { l:'Joint Reinforcement', cap:'Braced joints survive the speed they now move at.', add:true, need:'node:BIOFAB@4' } ] },
            { l:'Reflex Governor', cap:'A limiter stops boosted moves overshooting and self-harming.', add:true, need:'node:COMPUTE@4' } ] },
          { l:'Skillwire Socket', cap:'Chipped muscle-memory runs a rehearsed move for you.', need:'node:STORE@3', kids:[
            { l:'Reflex Skill Chain', cap:'Chains stored moves into one fluid combat routine.', need:'node:STORE@4', kids:[
              { l:'Corp Reflex Suite', cap:'A corp neural suite blending live reflex and stored skill.', arch:'corpo', need:'node:STORE@6' } ] } ] } ] } ] },

      { l:'Stamina Metabolism', cap:'Run longer, tire slower, hurt less.', act:'sustain', tag:'feed', kids:[
        { l:'Endurance Tune', cap:'Tuned breathing and pacing stretch your wind.', tag:'feed', kids:[
          { l:'Oxygen Buffer', cap:'A stored-O2 reserve carries you through a sprint.', need:'node:BIOFAB@3', kids:[
            { l:'Lactate Scrubber', cap:'Filtered blood clears fatigue toxins as you go.', need:'node:BIOFAB@4', kids:[
              { l:'Metabolic Overclock', cap:'A metered stim keeps the engine redlined safely.', need:'node:INJECT@4', kids:[
                { l:'Tireless Metabolism', cap:'A corp metabolic rebuild that barely knows fatigue.', arch:'corpo', need:'node:BIOFAB@6' } ] },
              { l:'Thermal Dump', cap:'Sheds excess heat so the overclock does not cook you.', add:true, need:'node:SEAL@3' } ] },
            { l:'Nutrient Drip', cap:'A slow feed tops up fuel without a meal break.', add:true, need:'node:INJECT@3' } ] },
          { l:'Pain Editor', cap:'Edits pain signals so a wound does not drop you (canon).', need:'node:COMPUTE@3', kids:[
            { l:'Shock Damping', cap:'Blunts the stun of a hit so you keep fighting.', need:'node:BIOFAB@4', kids:[
              { l:'Corp Pain Suite', cap:'A corp neural pain-suite: full function through trauma.', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] } ] },

      { l:'Sensory Combat', cap:'Sharpen perception and aim for the fight.', act:'target', tag:'core', need:'node:SENSE@2', kids:[
        { l:'Target Reflex', cap:'A targeting cue steadies your aim under stress.', tag:'wire', kids:[
          { l:'Combat Sense', cap:'A trained danger-sense reads a fight a beat early.', need:'node:COMPUTE@3', kids:[
            { l:'Threat Prediction', cap:'Predicts where fire comes from before it does.', need:'node:COMPUTE@4', kids:[
              { l:'Berserk Drive', cap:'A combat stim floods you for a savage all-out surge.', need:'node:INJECT@5', kids:[
                { l:'Combat Precog-Body', cap:'A corp package fusing prediction and reflex into foresight.', arch:'corpo', need:'node:COMPUTE@6' } ] },
              { l:'Recoil Compensation', cap:'Braced stance auto-tames muzzle climb.', add:true, need:'node:BIOFAB@3' } ] },
            { l:'Aim Assist Overlay', cap:'A HUD overlay leads moving targets for you.', add:true, need:'node:SENSE@4' } ] },
          { l:'Adrenal Trigger', cap:'On command, floods adrenaline for a reflex spike (canon).', need:'node:INJECT@3', kids:[
            { l:'Fear Suppressor', cap:'Damps panic so the surge stays aimed, not wild.', need:'node:INJECT@4', kids:[
              { l:'Corp Warfighter Rig', cap:'A corp battle-drug rig timing surge, aim and calm as one.', arch:'corpo', need:'node:INJECT@6' } ] } ] } ] } ] }
    ] },
    SURVIVE: { l:'Survive', cap:'Keep the user\'s body alive when the body alone would fail.', kids:[

      { l:'Trauma Response', cap:'Stop a wound from killing before help arrives.', act:'treat', tag:'core', kids:[
        { l:'First-Aid Kit', cap:'A worn kit and prompts let you patch yourself up.', tag:'core', kids:[
          { l:'Auto-Tourniquet', cap:'A cuff clamps a bleeding limb on its own.', need:'node:SENSE@2', kids:[
            { l:'Wound-Seal Foam', cap:'Injected foam plugs a bleed from the inside.', need:'node:INJECT@3', kids:[
              { l:'Auto-Transfuse Loop', cap:'Stored blood-substitute is pumped in to hold pressure.', need:'node:BIOFAB@4', kids:[
                { l:'Auto-Medic Trauma Bay', cap:'A corp worn trauma bay that triages and treats hands-free.', arch:'corpo', need:'node:INJECT@6' } ] },
              { l:'Clot Accelerant', cap:'A metered agent speeds clotting at the tear.', add:true, need:'node:INJECT@4' } ] },
            { l:'Vitals Alarm', cap:'Screams your location and status when you crash.', add:true, need:'node:COMPUTE@3' } ] },
          { l:'Nanosurgeon Swarm', cap:'Injected machines knit torn tissue from within (canon).', need:'node:BIOFAB@4', kids:[
            { l:'Directed Repair', cap:'The swarm is steered to the worst damage first.', need:'node:REPAIR@4', kids:[
              { l:'Corp Nano-Trauma Core', cap:'A corp nanosurgery core that rebuilds trauma in the field.', arch:'corpo', need:'node:REPAIR@6' } ] } ] } ] } ] },

      { l:'Life Support', cap:'Take over failing organs and keep breathing.', act:'sustain', tag:'closed', kids:[
        { l:'Vitals Monitor', cap:'A biomonitor tracks heart, blood and breath.', tag:'core', need:'node:SENSE@2', kids:[
          { l:'Rebreather Loop', cap:'Scrubs and recycles your breath for a while.', need:'node:SEAL@3', kids:[
            { l:'Organ Assist Pump', cap:'A pump backs up a failing heart or lung.', need:'node:BIOFAB@4', kids:[
              { l:'O2 Regen Cell', cap:'A chemical cell makes fresh oxygen from waste breath.', need:'node:SEAL@4', kids:[
                { l:'Closed-Loop Life Support', cap:'A corp core recycling air, blood and water indefinitely.', arch:'corpo', need:'node:SEAL@6' } ] },
              { l:'Dialysis Filter', cap:'Filters blood toxins when the kidneys quit.', add:true, need:'node:BIOFAB@4' } ] },
            { l:'Independent Air', cap:'A sealed reserve carries you through bad air.', add:true, need:'node:SEAL@3' } ] },
          { l:'Cardiac Governor', cap:'Paces and shocks the heart to hold rhythm.', need:'node:COMPUTE@3', kids:[
            { l:'Perfusion Manager', cap:'Balances blood flow to keep the brain fed first.', need:'node:COMPUTE@4', kids:[
              { l:'Corp Organ-Bank Core', cap:'A corp core hosting grown backup organs on standby.', arch:'corpo', takes:'vat', need:'node:BIOFAB@6' } ] } ] } ] } ] },

      { l:'Self-Sustenance', cap:'Feed and water the body from almost nothing.', act:'provision', tag:'feed', kids:[
        { l:'Water Recycler', cap:'Reclaims drinkable water from sweat and waste.', tag:'filter', need:'node:SEAL@2', kids:[
          { l:'Nutrient Store', cap:'A dense ration reserve fed slowly to the gut.', need:'node:STORE@3', kids:[
            { l:'Gut Symbiont Culture', cap:'Grown microbes wring calories from poor food.', need:'node:BIOFAB@4', kids:[
              { l:'Nutrient Reclaimer', cap:'Breaks down waste back into usable feedstock.', need:'node:BIOFAB@4', kids:[
                { l:'Ration-Synthesizing Gut', cap:'A corp implanted gut that synthesizes meals from scraps.', arch:'corpo', need:'node:BIOFAB@6' } ] },
              { l:'Vitamin Synth', cap:'Makes missing micronutrients on the spot.', add:true, need:'node:FAB-CHEM@4' } ] },
            { l:'Appetite Governor', cap:'Meters hunger so stores last a siege.', add:true, need:'node:COMPUTE@3' } ] },
          { l:'Brine Distiller', cap:'Pulls fresh water even from seawater.', need:'node:SEAL@3', kids:[
            { l:'Solar Still Skin', cap:'A worn membrane distills water off body heat and sun.', need:'node:POWER@3', kids:[
              { l:'Corp Survival Skin', cap:'A corp bodysuit that waters and feeds its wearer for weeks.', arch:'corpo', need:'node:SEAL@6' } ] } ] } ] } ] },

      { l:'Emergency Stasis', cap:'Slow the body toward stillness to outlast harm.', act:'preserve', tag:'stasis', need:'node:COMPUTE@2', kids:[
        { l:'Hibernation Slow', cap:'Drops metabolism to stretch air and blood.', tag:'stasis', kids:[
          { l:'Induced Torpor', cap:'A metered agent eases the body into deep torpor.', need:'node:INJECT@3', kids:[
            { l:'Cold Stasis Wrap', cap:'Controlled cooling halts decay in a dying body.', need:'node:SEAL@4', kids:[
              { l:'Cryo-Perfusion', cap:'Cryoprotectant perfused so cells survive the freeze.', need:'node:BIOFAB@4', kids:[
                { l:'Suspended-Animation Pod', cap:'A corp stasis pod holding a body between life and death.', arch:'corpo', need:'node:SEAL@6' } ] },
              { l:'Rewarm Protocol', cap:'Staged rewarming brings them back without shock.', add:true, need:'node:REPAIR@4' } ] },
            { l:'Ice-Crystal Guard', cap:'Blocks the crystals that would shred frozen tissue.', add:true, need:'node:BIOFAB@4' } ] },
          { l:'Vitals Freeze-Lock', cap:'Locks a readout of vitals for the medics who revive you.', need:'node:STORE@3', kids:[
            { l:'Stasis Telemetry', cap:'Beacons your frozen state and location out to rescue.', need:'node:COMPUTE@4', kids:[
              { l:'Corp Cryo-Recovery Pod', cap:'A corp pod that stases, monitors and self-revives on cue.', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] } ] }
    ] },
    INJECT: { l:'Inject', cap:'Deliver a dose into a body, on command or on its own.', kids:[

      { l:'Dispenser Delivery', cap:'Store and push a measured dose.', act:'dispense', tag:'injector', need:'injector', kids:[
        { l:'Single-Dose Shot', cap:'A one-shot autoinjector fires a fixed dose (canon Bodyweight).', tag:'dose', kids:[
          { l:'Multi-Reservoir Cuff', cap:'Several reservoirs hold different doses to pick from.', need:'injector', kids:[
            { l:'Auto-Metered Pump', cap:'A pump doles out a precise dose over time.', need:'node:COMPUTE@3', kids:[
              { l:'Sequenced Regimen', cap:'Runs a timed schedule of doses without you.', need:'node:COMPUTE@4', kids:[
                { l:'Auto-Doc Pharmacy', cap:'A corp implanted pharmacy that stocks, mixes and gives doses.', arch:'corpo', takes:'vat', need:'node:FAB-CHEM@6' } ] },
              { l:'Reservoir Refill Port', cap:'A sealed port lets you top up doses without surgery.', add:true } ] },
            { l:'Dose Lockout', cap:'Blocks a double-dose that would overdose you.', add:true, need:'node:COMPUTE@3' } ] },
          { l:'Onboard Synth Cell', cap:'A tiny synth cell brews the dose on demand.', need:'node:FAB-CHEM@4', kids:[
            { l:'Compound Library', cap:'Stored recipes let it make many drugs from base stock.', need:'node:STORE@4', kids:[
              { l:'Corp Synth-Dispensary', cap:'A corp micro-lab implant compounding drugs on the fly.', arch:'corpo', need:'node:FAB-CHEM@6' } ] } ] } ] } ] },

      { l:'Route Target', cap:'Choose how and where the dose lands.', act:'route', tag:'injector', need:'injector', kids:[
        { l:'Needle Jet', cap:'A needle or air-jet puts the dose under the skin.', tag:'dose', kids:[
          { l:'Transdermal Patch', cap:'A patch seeps the dose steadily through skin.', kids:[
            { l:'Inhaled Aerosol', cap:'A fine mist carries the dose in through the lungs.', need:'node:SEAL@3', kids:[
              { l:'Intravascular Line', cap:'A shunt delivers straight into the bloodstream, fast.', need:'node:BIOFAB@4', kids:[
                { l:'Targeted-Organ Delivery', cap:'A corp system steering a dose to one named organ.', arch:'corpo', need:'node:BIOFAB@6' } ] },
              { l:'Depot Release', cap:'A slow-release depot doses over days from one shot.', add:true, need:'node:FAB-CHEM@4' } ] },
            { l:'Microneedle Array', cap:'A pad of micro-needles delivers painlessly and precisely.', add:true } ] },
          { l:'Carrier Nanoparticle', cap:'Wrapped payload rides carriers to the right tissue.', need:'node:BIOFAB@4', kids:[
            { l:'Ligand Homing', cap:'Surface tags home the carrier onto target cells.', need:'node:BIOFAB@5', kids:[
              { l:'Corp Cell-Targeted Vector', cap:'A corp vector that delivers only into flagged cells.', arch:'corpo', need:'node:BIOFAB@6' } ] } ] } ] } ] },

      { l:'Smart Dosing', cap:'Let sensors decide the dose.', act:'titrate', tag:'driver', need:'node:SENSE@2', kids:[
        { l:'Vitals-Linked Trigger', cap:'Fires a dose when vitals cross a set line.', tag:'driver', kids:[
          { l:'Feedback Titration', cap:'Trims dose up or down as the reading moves.', need:'node:COMPUTE@3', kids:[
            { l:'Closed-Loop Control', cap:'A sealed sense-and-dose loop needs no hand (MiniMed-670G-like).', need:'node:COMPUTE@4', kids:[
              { l:'Predictive Dosing', cap:'Doses ahead of a predicted crash, not after it.', need:'node:COMPUTE@5', kids:[
                { l:'Closed-Loop Titrator', cap:'A corp autonomous titrator holding a level indefinitely.', arch:'corpo', need:'node:COMPUTE@6' } ] },
              { l:'Safety Ceiling', cap:'A hard cap the loop can never dose past.', add:true } ] },
            { l:'Drift Recalibration', cap:'Re-zeros the sensor so dosing stays true over time.', add:true, need:'node:SENSE@4' } ] },
          { l:'Dual-Agent Balance', cap:'Plays one agent against its opposite to hold steady.', need:'node:FAB-CHEM@4', kids:[
            { l:'Multivariate Model', cap:'Weighs many vitals at once to set the dose.', need:'node:COMPUTE@5', kids:[
              { l:'Autonomous Auto-Doc', cap:'A corp auto-doc diagnosing and dosing with no operator.', arch:'corpo', need:'node:COMPUTE@6' } ] } ] } ] } ] },

      { l:'Advanced Payload', cap:'Deliver harder things than a simple drug.', act:'deliver', tag:'injector', need:'injector', kids:[
        { l:'Combat Stim Dose', cap:'A fight-drug dose that spikes performance fast.', tag:'dose', need:'node:FAB-CHEM@3', kids:[
          { l:'Counter-Agent Bay', cap:'A held antidote fires to reverse a toxin or a stim.', need:'node:FAB-CHEM@4', kids:[
            { l:'Toxin Scanner Link', cap:'Reads the poison, then picks the right counter-agent.', need:'node:SENSE@4', kids:[
              { l:'Antivenom Compiler', cap:'Compiles a matched counter-agent to an unknown toxin.', need:'node:FAB-CHEM@5', kids:[
                { l:'Corp Counter-Agent Suite', cap:'A corp suite that IDs and neutralizes any dosed threat.', arch:'corpo', need:'node:FAB-CHEM@6' } ] },
              { l:'Stim Taper', cap:'Eases you off a combat stim to soften the crash.', add:true, need:'node:COMPUTE@4' } ] },
            { l:'Dose Log', cap:'Records every dose given for the medics after.', add:true, need:'node:STORE@3' } ] },
          { l:'Gene-Payload Carrier', cap:'Delivers an abstract gene payload into cells.', need:'node:BIOFAB@4', kids:[
            { l:'Edit Vector', cap:'A vector carrying an abstract bio-rewrite instruction.', need:'node:BIOFAB@5', kids:[
              { l:'Gene-Rewrite Injector', cap:'A corp injector that rewrites a body\'s own biology.', arch:'corpo', need:'node:BIOFAB@6' } ] } ] } ] } ] }
    ] },

    // -- MATTER, LOGISTICS & MAKING --
    HAUL: { l:'Haul', cap:'the object grips, lifts, carries and rallies the world under one frame', kids:[
      { l:'Carry Lift', cap:'bears and raises dead weight', kids:[
        { l:'Load Frame', cap:'a frame that shoulders a load off the body', tag:'exo', kids:[
          { l:'Powered Hauler', cap:'servos add lift to the frame', act:'haul', tag:'driver', need:'power', kids:[
            { l:'Crane Boom', cap:'a boom swings loads overhead', tag:'arm', kids:[
              { l:'Heavy Lift Rig', cap:'multi-tonne hoist geometry', need:'node:POWER@4', kids:[
                { l:'Crane Exoframe', cap:'a wearable crane that walks its own load in', act:'lift', tag:'exo', arch:'corpo', need:'node:POWER@6' },
                { l:'Overload Governor', cap:'sheds load before the frame buckles' }
              ]},
              { l:'Counterweight', add:true, cap:'ballast keeps the lift from tipping' }
            ]},
            { l:'Winch Hoist', cap:'a cable drum drags a load upward' }
          ]},
          { l:'Pallet Skid', cap:'slides bulk on low-friction feet' }
        ]},
        { l:'Hand Truck Exo', cap:'a powered sack-barrow for one worker', tag:'exo', kids:[
          { l:'Braced Backframe', cap:'spreads the load across the spine' },
          { l:'Load Balancer', cap:'keeps the stack from toppling' }
        ]},
        { l:'Cargo Sled', cap:'a flat hauler for heavy crates', tag:'core', kids:[
          { l:'Tracked Base', cap:'treads cross broken ground' },
          { l:'Wheeled Base', cap:'castors for smooth dock floors' }
        ]},
        { l:'Sling Harness', add:true, cap:'straps a load to the carrier' }
      ]},
      { l:'Manipulation', cap:'grips, turns and works objects', kids:[
        { l:'Gripper Arm', cap:'a single arm that seizes a thing', tag:'arm', kids:[
          { l:'Multi Arm Rig', cap:'several arms cooperate on one task', act:'grip', tag:'arm', need:'power', kids:[
            { l:'Precision Manipulator', cap:'fine positioning under control', need:'node:COMPUTE@3', kids:[
              { l:'Force Feedback', cap:'feels its own grip strength', need:'node:SENSE@3', kids:[
                { l:'Heavy Work Arm', cap:'a shop-arm that torques and welds at scale', act:'work', tag:'arm', arch:'corpo', need:'node:POWER@6' },
                { l:'Micron Positioner', cap:'places parts to a hair', need:'node:COMPUTE@5' }
              ]},
              { l:'Haptic Governor', cap:'caps torque so it does not crush' }
            ]},
            { l:'Tool Turret', add:true, cap:'swaps end-effectors on demand' }
          ]},
          { l:'Wrist Actuator', cap:'adds a rotating wrist joint' }
        ]},
        { l:'Dexterous Hand', cap:'an articulated multi-finger hand', tag:'arm', kids:[
          { l:'Digit Servos', cap:'each finger drives on its own' },
          { l:'Torque Motor', cap:'raw twisting power at the joint' }
        ]},
        { l:'Clamp Jaw', cap:'a brute two-jaw clamp', tag:'arm', kids:[
          { l:'Hydraulic Clamp', cap:'oil pressure closes the jaw hard' },
          { l:'Magnetic Grip', cap:'holds ferrous loads without jaws' }
        ]},
        { l:'Suction Grip', cap:'vacuum cups lift smooth panels' }
      ]},
      { l:'Universal Adapters', cap:'other finished objects socket in and pool their effects', kids:[
        { l:'Single Mount', cap:'one slot another object bolts into', act:'socket', tag:'mount', takes:'class', kids:[
          { l:'Multi Mount Rack', cap:'a rack of slots for many objects', tag:'mount', takes:'class', kids:[
            { l:'Standard Socket', cap:'a documented socket anything conforms to', tag:'mount', takes:'class', need:'node:MORPH@3', kids:[
              { l:'Universal Coupler', cap:'auto-fits mismatched objects into the socket', tag:'mount', takes:'class', need:'node:COMPUTE@4', kids:[
                { l:'Master Host', cap:'rallies every socketed object\'s effect under one host', act:'aggregate', tag:'mount', takes:'class', arch:'corpo', need:'node:COMPUTE@6' },
                { l:'Load Arbiter', cap:'shares power and load across sockets', need:'node:POWER@5', needsAll:['universal-adapters.single-mount.multi-mount-rack.standard-socket.universal-coupler.master-host','manipulation.gripper-arm.multi-arm-rig.precision-manipulator.force-feedback.heavy-work-arm'] }
              ]},
              { l:'Bus Router', cap:'routes signals between sockets' }
            ]},
            { l:'Quick Release', cap:'objects click out in a second' }
          ]},
          { l:'Dovetail Rail', cap:'a sliding rail objects hang on', takes:'class' }
        ]},
        { l:'Twin Mount', cap:'two fixed slots side by side', tag:'mount', takes:'class', kids:[
          { l:'Side Rail', cap:'a flank rail for accessories', takes:'class' },
          { l:'Top Rail', cap:'a dorsal rail for accessories', takes:'class' }
        ]},
        { l:'Adapter Plate', cap:'a plate that re-patterns bolt holes', tag:'mount', kids:[
          { l:'Bolt Pattern', cap:'matches a standard hole grid' },
          { l:'Clip Lock', cap:'tool-free clip fastening' }
        ]},
        { l:'Passive Hook', cap:'a bare hook another object hangs from', takes:'class' }
      ]},
      { l:'Autonomous Fleet', cap:'the object moves and coordinates itself', kids:[
        { l:'Cargo Mule', cap:'a self-driving load carrier', act:'deliver', tag:'core', need:'move', kids:[
          { l:'Linked Convoy', cap:'mules chain nose-to-tail', need:'link', kids:[
            { l:'Delivery Swarm', cap:'many units split a delivery job', need:'node:COMPUTE@4', kids:[
              { l:'Route Planner', cap:'solves fastest paths on the fly', need:'node:COMPUTE@5', kids:[
                { l:'Logistics AI Net', cap:'a self-running fleet that dispatches itself citywide', act:'orchestrate', arch:'corpo', need:'node:COMPUTE@6' },
                { l:'Manifest Sync', cap:'every unit knows the shared cargo list', need:'node:STORE@4' }
              ]},
              { l:'Beacon Relay', add:true, cap:'extends comms past dead zones', need:'node:LINK@4' }
            ]},
            { l:'Follow Leader', cap:'trails a lead vehicle blindly' }
          ]},
          { l:'Waypoint Nav', cap:'runs a set string of stops' }
        ]},
        { l:'Self Driver', cap:'drives without a hand on it', need:'move', kids:[
          { l:'Obstacle Sense', cap:'sees and dodges hazards', need:'node:SENSE@3' },
          { l:'Traction Control', cap:'keeps grip on bad surfaces' }
        ]},
        { l:'Dispatch Board', cap:'accepts and assigns haul jobs', kids:[
          { l:'Job Queue', cap:'lines up pending deliveries' },
          { l:'Priority Sort', cap:'bumps urgent freight first' }
        ]},
        { l:'Recall Whistle', cap:'summons the unit back to base' }
      ]}
    ]},
    CONTAIN: { l:'Contain', cap:'holds matter the way STORE holds data, and declares itself a container', kids:[
      { l:'Bulk Solids', cap:'holds dry solid goods', kids:[
        { l:'Storage Bin', cap:'an open bin for loose solids', act:'register', tag:'crate', sc:{max:3,per:'unit'}, kids:[
          { l:'Modular Pod', cap:'stacking pods snap together', tag:'pod', sc:{max:4,per:'unit'}, kids:[
            { l:'Self Stowing Hold', cap:'sorts and racks its own contents', act:'stow', need:'node:COMPUTE@3', sc:{max:5,per:'unit'}, kids:[
              { l:'Powered Racking', cap:'motorised shelves cycle stock', need:'power', kids:[
                { l:'Inventory Mind', cap:'tracks every item by cell', need:'node:COMPUTE@4', kids:[
                  { l:'Mass Cargo Vault', cap:'a warehouse-scale hold that stows and retrieves itself', act:'stow', tag:'vessel', arch:'corpo', need:'node:COMPUTE@6', sc:{max:8,per:'unit'} },
                  { l:'Retrieval Arm', cap:'fetches any crate on call', need:'node:POWER@5' }
                ]},
                { l:'Load Census', cap:'weighs and logs each shelf' }
              ]},
              { l:'Ballast Trim', cap:'shifts mass to stay balanced' }
            ]},
            { l:'Lidded Crate', add:true, cap:'a sealed lid keeps dust out' }
          ]},
          { l:'Strap Cage', add:true, cap:'webbing holds an irregular load' }
        ]},
        { l:'Hopper', cap:'funnels granular solids to a spout', tag:'crate', sc:{max:4,per:'unit'}, kids:[
          { l:'Auger Feed', cap:'a screw meters the flow out' },
          { l:'Vibrating Floor', cap:'shakes stuck material free' }
        ]},
        { l:'Skip Bin', cap:'a heavy tip-out waste hold', tag:'crate', kids:[
          { l:'Compactor', cap:'crushes contents to save room', need:'power' },
          { l:'Liner Bag', add:true, cap:'a disposable inner sack' }
        ]},
        { l:'Tote Box', cap:'a hand-carry stacking box', tag:'crate' }
      ]},
      { l:'Fluids Gases', cap:'holds liquids and gases', kids:[
        { l:'Storage Tank', cap:'a sealed tank for liquid', act:'register', tag:'tank', need:'seal', sc:{max:4,per:'litre'}, kids:[
          { l:'Pressure Vessel', cap:'holds fluid above ambient pressure', tag:'tank', need:'node:SEAL@3', sc:{max:5,per:'litre'}, kids:[
            { l:'Cryo Store', cap:'liquefies contents by deep cold', act:'chill', tag:'tank', need:'node:SEAL@4', sc:{max:6,per:'litre'}, kids:[
              { l:'Boil-Off Recapture', cap:'recondenses vapour back to liquid', need:'power', kids:[
                { l:'Vacuum Jacket', cap:'a vacuum wall stops heat leak', need:'node:SEAL@5', kids:[
                  { l:'Cryogenic Fluid Store', cap:'a self-cooling vault for liquefied gas at scale', act:'chill', tag:'vessel', arch:'corpo', need:'node:POWER@6', sc:{max:8,per:'litre'}, needsAll:['living-perishable.secure-vivarium.climate-hold.bio-stasis.perfusion-loop.suspension-cell.cryo-preserve'] },
                  { l:'Thermal Guard', add:true, cap:'watches for a warming failure', need:'node:COMPUTE@4' }
                ]},
                { l:'Relief Valve', add:true, cap:'vents overpressure safely' }
              ]},
              { l:'Cold Ladder', cap:'staged chillers step temperature down' }
            ]},
            { l:'High Pressure Gas Store', cap:'packs gas dense under high pressure', tag:'tank', need:'node:SEAL@4', sc:{max:6,per:'litre'} }
          ]},
          { l:'Bladder Cell', cap:'a flexible bag for shifting fluid' }
        ]},
        { l:'Gas Bottle', cap:'a small bottle of compressed gas', tag:'tank', sc:{max:3,per:'litre'}, kids:[
          { l:'Regulator', cap:'meters gas out at set pressure' },
          { l:'Check Valve', cap:'stops backflow into the bottle' }
        ]},
        { l:'Drum', cap:'a rolling barrel for bulk liquid', tag:'tank', kids:[
          { l:'Bung Seal', add:true, cap:'a threaded plug seals the top' },
          { l:'Pump Riser', cap:'draws fluid up from the base' }
        ]},
        { l:'Jerry Can', cap:'a hand-carry fuel can', tag:'tank' }
      ]},
      { l:'Living Perishable', cap:'holds living things and perishables', kids:[
        { l:'Secure Vivarium', cap:'a sealed habitat for living cargo', act:'register', tag:'vessel', need:'node:BIOFAB@2', sc:{max:3,per:'unit'}, kids:[
          { l:'Climate Hold', cap:'holds temperature and humidity steady', tag:'closed', need:'power', sc:{max:4,per:'unit'}, kids:[
            { l:'Bio Stasis', cap:'slows metabolism to a crawl', act:'preserve', need:'node:BIOFAB@4', sc:{max:5,per:'unit'}, kids:[
              { l:'Perfusion Loop', cap:'feeds tissue while it sleeps', need:'node:BIOFAB@5', kids:[
                { l:'Suspension Cell', cap:'suspends a whole organism unharmed', need:'node:COMPUTE@4', kids:[
                  { l:'Cryo Preserve', cap:'a living hold that freezes and revives its occupant', act:'preserve', tag:'vessel', arch:'corpo', need:'node:BIOFAB@6', sc:{max:7,per:'unit'} },
                  { l:'Vital Monitor', add:true, cap:'watches the occupant\'s signs', need:'node:SENSE@4' }
                ]},
                { l:'Nutrient Feed', add:true, cap:'trickles nutrients into the hold' }
              ]},
              { l:'Gas Exchange', cap:'balances oxygen and waste gas' }
            ]},
            { l:'Chill Shelf', cap:'a cold shelf for perishables' }
          ]},
          { l:'Quarantine Cell', cap:'isolates a sick or unknown specimen' }
        ]},
        { l:'Terrarium', cap:'a small sealed live-plant hold', tag:'vessel', sc:{max:3,per:'unit'}, kids:[
          { l:'Grow Light', cap:'feeds photosynthesis inside', need:'power' },
          { l:'Mist Head', cap:'keeps the interior humid' }
        ]},
        { l:'Cool Box', cap:'an insulated perishable carrier', tag:'closed', kids:[
          { l:'Ice Pack', cap:'passive chill for short trips' },
          { l:'Peltier Wall', add:true, cap:'electric cooling on demand', need:'power' }
        ]},
        { l:'Feed Bin', cap:'a sealed bin for animal feed', tag:'crate' }
      ]},
      { l:'Volatile Exotic', cap:'holds dangerous and rare matter', kids:[
        { l:'Hazmat Drum', cap:'a lined drum for toxic matter', act:'register', tag:'closed', need:'seal', sc:{max:3,per:'unit'}, kids:[
          { l:'Reactive Isolation', cap:'keeps reactive contents apart', tag:'closed', need:'node:SEAL@3', sc:{max:4,per:'unit'}, kids:[
            { l:'Blast Vault', cap:'contains a detonation inside itself', act:'contain', tag:'vessel', need:'node:SHIELD@4', sc:{max:5,per:'unit'}, kids:[
              { l:'Meltdown Cradle', cap:'catches and cools a runaway core', need:'node:POWER@4', kids:[
                { l:'Field Bottle', cap:'a field pins matter off the walls', need:'node:POWER@5', kids:[
                  { l:'Exotic Matter Vault', cap:'suspends matter no wall could touch in a caged field', act:'contain', tag:'vessel', arch:'corpo', need:'node:POWER@6', sc:{max:7,per:'unit'} },
                  { l:'Field Watchdog', cap:'kills power safely if the field slips', need:'node:COMPUTE@5' }
                ]},
                { l:'Coolant Jacket', add:true, cap:'floods the cradle with coolant' }
              ]},
              { l:'Frag Liner', add:true, cap:'soaks up shrapnel from within' }
            ]},
            { l:'Neutralizer Bath', cap:'chemically defangs the contents' }
          ]},
          { l:'Vent Scrubber', add:true, cap:'cleans fumes before they escape' }
        ]},
        { l:'Sealed Cask', cap:'a welded cask for long burial', tag:'closed', sc:{max:4,per:'unit'}, kids:[
          { l:'Lead Liner', add:true, cap:'a dense liner blocks radiation' },
          { l:'Tamper Seal', add:true, cap:'shows if the cask was opened' }
        ]},
        { l:'Spark Safe Bin', cap:'a bin that will not spark', tag:'closed', kids:[
          { l:'Inert Purge', cap:'floods the space with dead gas' },
          { l:'Bond Strap', add:true, cap:'grounds off static charge' }
        ]},
        { l:'Sharps Pod', cap:'a puncture-proof pod for sharps', tag:'pod' }
      ]}
    ]},
    REPAIR: { l:'Repair', cap:'an object that mends itself, from a patch up to full regrowth', kids:[
      { l:'Manual Patch', cap:'hands-on fixes to the object', kids:[
        { l:'Field Patch', cap:'a stopgap patch over the damage', act:'patch', tag:'core', kids:[
          { l:'Tool Kit', cap:'onboard tools for real repairs', tag:'core', kids:[
            { l:'Weld Fabricate', cap:'welds and shapes replacement stock', act:'weld', need:'node:FABRICATE@3', kids:[
              { l:'Part Printer', cap:'prints a spare part on the spot', need:'node:FAB-ADDITIVE@4', kids:[
                { l:'Spares Cache', cap:'draws the right blank from stock', need:'node:STORE@4', kids:[
                  { l:'Fabricate Repair Bay', cap:'an on-site bay that machines and fits any missing part', act:'rebuild', tag:'core', arch:'corpo', need:'node:FABRICATE@6' },
                  { l:'Fit Checker', cap:'proves the new part fits before use', need:'node:SENSE@4' }
                ]},
                { l:'Stock Blank', cap:'keeps raw feedstock on hand' }
              ]},
              { l:'Rivet Gun', cap:'fastens plates fast in the field' }
            ]},
            { l:'Solder Iron', cap:'reflows broken connections' }
          ]},
          { l:'Tape Wrap', add:true, cap:'binds a crack to limp on' }
        ]},
        { l:'Part Swap', cap:'yanks a bad module and drops a new one', tag:'core', kids:[
          { l:'Quick Module', cap:'parts unclip without tools' },
          { l:'Keyed Slot', cap:'a part only fits one way' }
        ]},
        { l:'Adhesive Bond', cap:'glues split surfaces back', tag:'core', kids:[
          { l:'Epoxy Mix', cap:'two-part resin sets hard' },
          { l:'Clamp Set', cap:'holds the bond while it cures' }
        ]},
        { l:'Shim Fill', add:true, cap:'packs a gap to restore fit' }
      ]},
      { l:'Diagnostic', cap:'finds the fault before it fails', kids:[
        { l:'Fault Sense', cap:'feels where the damage is', act:'sense', need:'node:SENSE@2', kids:[
          { l:'Self Test', cap:'runs its own checks on power-up', need:'node:COMPUTE@2', kids:[
            { l:'Predictive Maintenance', cap:'flags parts about to wear out', act:'predict', need:'node:COMPUTE@4', kids:[
              { l:'Trend Model', cap:'learns the object\'s failure curve', need:'node:COMPUTE@5', kids:[
                { l:'Failure Log', cap:'keeps a full history of faults', need:'node:STORE@4', kids:[
                  { l:'Root Cause AI', cap:'traces any fault to its true origin and orders the fix', act:'diagnose', arch:'corpo', need:'node:COMPUTE@6' },
                  { l:'Repair Scheduler', cap:'books downtime at the best moment', need:'node:COMPUTE@5' }
                ]},
                { l:'Sensor Fusion', cap:'blends many readings into one picture', need:'node:SENSE@4' }
              ]},
              { l:'Wear Gauge', add:true, cap:'measures remaining part life' }
            ]},
            { l:'Error Beacon', add:true, cap:'signals a fault out loud' }
          ]},
          { l:'Vibration Tap', add:true, cap:'hears a bearing going bad' }
        ]},
        { l:'Meter Probe', cap:'measures a suspect circuit', need:'node:SENSE@2', kids:[
          { l:'Continuity Check', cap:'finds a broken connection' },
          { l:'Load Test', cap:'stresses a part to expose weakness' }
        ]},
        { l:'Scope View', cap:'looks inside without opening', need:'node:SENSE@3', kids:[
          { l:'Borescope', cap:'a snake camera peers into cavities' },
          { l:'Thermal Eye', cap:'spots a hot failing spot', need:'node:SENSE@3' }
        ]},
        { l:'Log Reader', add:true, cap:'reads the object\'s own error log', need:'node:STORE@2' }
      ]},
      { l:'Self Repair', cap:'the object patches itself unattended', kids:[
        { l:'Auto Patch', cap:'seals small damage on its own', act:'seal', kids:[
          { l:'Self Sealing', cap:'a skin that closes its own punctures', tag:'core', need:'node:MORPH@3', kids:[
            { l:'Nanite Mend', cap:'tiny machines rebuild damaged material', act:'mend', need:'node:FAB-ADDITIVE@4', kids:[
              { l:'Swarm Control', cap:'directs the nanites to the wound', need:'node:COMPUTE@5', kids:[
                { l:'Feedstock Reservoir', cap:'stores raw matter the swarm consumes', need:'node:STORE@4', kids:[
                  { l:'Self Rebuild Swarm', cap:'a nanite cloud that regrows the whole object from within', act:'rebuild', tag:'core', arch:'corpo', need:'node:FAB-ADDITIVE@6', needsAll:['diagnostic.fault-sense.self-test.predictive-maintenance.trend-model.failure-log.root-cause-ai'] },
                  { l:'Swarm Recall', cap:'brings the nanites home when done' }
                ]},
                { l:'Dose Limiter', cap:'stops the swarm eating good material' }
              ]},
              { l:'Crack Chaser', cap:'nanites hunt down hairline cracks' }
            ]},
            { l:'Foam Injector', cap:'floods a breach with setting foam', need:'node:FAB-CHEM@3' }
          ]},
          { l:'Bleed Stop', cap:'clots a leaking line fast' }
        ]},
        { l:'Sacrificial Layer', cap:'a spare layer wears in place of the core', tag:'ablate', kids:[
          { l:'Peel Ply', cap:'sheds a spent outer skin' },
          { l:'Reflow Skin', cap:'heat smooths minor surface damage' }
        ]},
        { l:'Redundant Path', cap:'reroutes around a dead section', need:'node:COMPUTE@3', kids:[
          { l:'Spare Circuit', add:true, cap:'a backup line takes over' },
          { l:'Isolate Fault', cap:'cuts off the failed section' }
        ]},
        { l:'Auto Tension', cap:'retightens what works loose' }
      ]},
      { l:'Regeneration', cap:'the object grows lost material back', kids:[
        { l:'Material Regrow', cap:'lays down fresh material over loss', act:'regrow', need:'node:FAB-ADDITIVE@3', kids:[
          { l:'Structural Regen', cap:'rebuilds load-bearing structure', need:'node:FABRICATE@4', kids:[
            { l:'Living Tissue Heal', cap:'grown tissue knits a wound shut', act:'heal', need:'node:BIOFAB@4', kids:[
              { l:'Cell Scaffold', cap:'a lattice guides new growth', need:'node:BIOFAB@5', kids:[
                { l:'Growth Reservoir', cap:'stores the stock cells growth draws on', need:'node:STORE@4', kids:[
                  { l:'Full Regeneration', cap:'a living object that regrows any lost part whole', act:'regenerate', tag:'core', arch:'corpo', need:'node:BIOFAB@6' },
                  { l:'Scar Refine', cap:'smooths regrown tissue to as-new' }
                ]},
                { l:'Nutrient Line', cap:'feeds the growing tissue' }
              ]},
              { l:'Graft Bond', cap:'fuses grown tissue to the old' }
            ]},
            { l:'Lattice Reprint', cap:'reprints the internal frame', need:'node:FAB-ADDITIVE@4' }
          ]},
          { l:'Skin Regrow', cap:'regrows only the outer surface' }
        ]},
        { l:'Bud Repair', cap:'sprouts a small replacement part', need:'node:BIOFAB@3', kids:[
          { l:'Seed Store', cap:'holds dormant repair seeds', need:'node:STORE@3' },
          { l:'Trigger Cue', cap:'wakes a seed when damage hits' }
        ]},
        { l:'Callus Form', cap:'thickens over a repeated stress point', kids:[
          { l:'Stress Map', cap:'learns where to reinforce', need:'node:SENSE@3' },
          { l:'Layer Add', cap:'adds material where it is worn' }
        ]},
        { l:'Dormant Reserve', add:true, cap:'keeps spare mass held for later regrowth' }
      ]}
    ]},
    EMIT: { l:'Emit', cap:'releases a medium into a volume, dialled by area and persistence', kids:[
      { l:'Obscurants Smoke', cap:'fills the air with sight-blocking medium', kids:[
        { l:'Smoke Puff', cap:'a short puff of screening smoke', act:'emit', tag:'smoke', sc:{max:3,per:'metre'}, kids:[
          { l:'Screening Cloud', cap:'a standing cloud hides an area', tag:'smoke', sc:{max:4,per:'metre'}, kids:[
            { l:'Multispectral Obscurant', cap:'blocks eyes, thermal and radar alike', act:'obscure', tag:'smoke', need:'node:FAB-CHEM@4', sc:{max:5,per:'metre'}, kids:[
              { l:'Particle Tuner', cap:'sizes particles to each spectrum', need:'node:COMPUTE@4', kids:[
                { l:'Wall Emitter Bank', cap:'a line of vents lays a curtain', need:'power', sc:{max:6,per:'metre'}, kids:[
                  { l:'Persistent Smoke Wall', cap:'a self-feeding multispectral wall that holds for hours', act:'obscure', tag:'smoke', arch:'corpo', need:'node:POWER@6', sc:{max:8,per:'hour'}, needsAll:['particulates-countermeasures.dust-cloud.chaff-cloud.sensor-blinding-aerosol.baffle-tuner.dispenser-array.nanite-taggant-dispersal'] },
                  { l:'Wind Trim', cap:'re-aims the wall against the breeze', need:'node:SENSE@4' }
                ]},
                { l:'Refeed Line', cap:'tops up the cloud as it thins', sc:{max:5,per:'hour'} }
              ]},
              { l:'Cool Smoke', cap:'chilled smoke defeats thermal sight' }
            ]},
            { l:'Colour Smoke', cap:'tinted smoke marks a spot', tag:'smoke' }
          ]},
          { l:'Pop Canister', cap:'a throw-and-forget smoke can', tag:'smoke' }
        ]},
        { l:'Curtain Line', cap:'lays a low ground-hugging screen', tag:'smoke', sc:{max:4,per:'metre'}, kids:[
          { l:'Low Lay', cap:'keeps smoke at ankle height' },
          { l:'Ceiling Fill', cap:'floods smoke from above' }
        ]},
        { l:'Trail Marker', cap:'leaves a smoke trail behind', tag:'smoke', kids:[
          { l:'Timed Bloom', cap:'delays the cloud until placed' },
          { l:'Sticky Smoke', cap:'clings to a surface as it burns' }
        ]},
        { l:'Flash Veil', cap:'an instant one-round blackout', tag:'smoke' }
      ]},
      { l:'Chemical Aerosols', cap:'sprays a chemical medium into the air', kids:[
        { l:'Aerosol Mist', cap:'a fine mist of agent', act:'spray', tag:'filter', need:'node:FAB-CHEM@2', sc:{max:3,per:'metre'}, kids:[
          { l:'Agent Cloud', cap:'a cloud of active chemical', tag:'filter', need:'node:FAB-CHEM@3', sc:{max:4,per:'metre'}, kids:[
            { l:'Pheromone Marker', cap:'tags a target with a scent signature', act:'mark', need:'node:FAB-CHEM@4', kids:[
              { l:'Scent Tuner', cap:'blends a unique marker scent', need:'node:COMPUTE@4', kids:[
                { l:'Aim Head', cap:'steers the plume onto a target', need:'node:COMPUTE@5', kids:[
                  { l:'Targeted Agent Dispersal', cap:'delivers a precise agent dose onto a chosen point at range', act:'disperse', tag:'filter', arch:'corpo', need:'node:FAB-CHEM@6', sc:{max:6,per:'metre'} },
                  { l:'Dose Meter', cap:'measures out an exact quantity' }
                ]},
                { l:'Windage Calc', cap:'corrects the plume for wind', need:'node:SENSE@4' }
              ]},
              { l:'Lure Bait', cap:'a scent that draws targets in' }
            ]},
            { l:'Irritant Fog', cap:'a fog that drives crowds back' }
          ]},
          { l:'Spray Nozzle', cap:'a plain handheld agent nozzle' }
        ]},
        { l:'Vapour Vent', cap:'boils an agent off into vapour', need:'node:FAB-CHEM@3', sc:{max:3,per:'metre'}, kids:[
          { l:'Heat Plate', cap:'warms the agent to a vapour', need:'power' },
          { l:'Slow Bleed', add:true, cap:'trickles vapour over time', sc:{max:4,per:'hour'} }
        ]},
        { l:'Sprinkler Ring', cap:'rings an area with mist heads', need:'node:FAB-CHEM@2', kids:[
          { l:'Zone Valve', cap:'sprays one sector at a time' },
          { l:'Pulse Timer', cap:'cycles bursts on a clock' }
        ]},
        { l:'Scent Dab', add:true, cap:'a single close-range scent tag', act:'mark' }
      ]},
      { l:'Foams Liquids', cap:'discharges foam and liquid media', kids:[
        { l:'Foam Spray', cap:'a jet of quick foam', act:'spray', tag:'foam', sc:{max:3,per:'metre'}, kids:[
          { l:'Expanding Foam', cap:'foam swells to fill a space', tag:'foam', need:'node:FAB-CHEM@3', sc:{max:4,per:'metre'}, kids:[
            { l:'Coolant Flood', cap:'floods an area with chilling fluid', act:'flood', tag:'foam', need:'node:SEAL@3', sc:{max:5,per:'metre'}, kids:[
              { l:'Pump Header', cap:'high-flow pumps drive the flood', need:'power', kids:[
                { l:'Flow Manifold', cap:'splits the flood across many heads', need:'node:COMPUTE@4', sc:{max:6,per:'metre'}, kids:[
                  { l:'Area Flood System', cap:'drowns a whole zone in foam or coolant on command', act:'flood', tag:'foam', arch:'corpo', need:'node:POWER@6', sc:{max:8,per:'metre'} },
                  { l:'Level Sense', cap:'stops the flood at the right depth', need:'node:SENSE@4' }
                ]},
                { l:'Reserve Tank', add:true, cap:'holds the bulk medium', need:'node:STORE@4', sc:{max:6,per:'litre'} }
              ]},
              { l:'Chill Mix', cap:'adds cold charge to the flood' }
            ]},
            { l:'Sticky Foam', cap:'foam that glues movers in place' }
          ]},
          { l:'Foam Blanket', cap:'a smothering layer over a fire', tag:'foam' }
        ]},
        { l:'Sealant Flood', cap:'floods a breach with setting sealant', tag:'foam', need:'node:FAB-CHEM@3', sc:{max:4,per:'metre'}, kids:[
          { l:'Gap Fill', cap:'forces sealant into a crack' },
          { l:'Cure Boost', cap:'speeds the sealant to hard' }
        ]},
        { l:'Liquid Jet', cap:'a directed stream of fluid', tag:'feed', kids:[
          { l:'Lance Tip', cap:'a long reach for the jet' },
          { l:'Fan Head', cap:'spreads the jet into a fan' }
        ]},
        { l:'Drip Line', cap:'a slow measured liquid feed', sc:{max:3,per:'hour'} }
      ]},
      { l:'Particulates Countermeasures', cap:'throws particles to blind sensors', kids:[
        { l:'Dust Cloud', cap:'a cloud of inert particulate', act:'emit', tag:'chaff', sc:{max:3,per:'metre'}, kids:[
          { l:'Chaff Cloud', cap:'metal flakes bloom to fog radar', act:'jam', tag:'chaff', need:'power', sc:{max:4,per:'metre'}, kids:[
            { l:'Sensor Blinding Aerosol', cap:'aerosol that swamps optics and sensors', act:'blind', tag:'chaff', need:'node:FAB-CHEM@4', sc:{max:5,per:'metre'}, kids:[
              { l:'Baffle Tuner', cap:'matches the medium to the threat sensor', need:'node:COMPUTE@4', kids:[
                { l:'Dispenser Array', cap:'a bank of launchers spreads the cloud', need:'node:POWER@4', sc:{max:6,per:'metre'}, kids:[
                  { l:'Nanite Taggant Dispersal', cap:'a smart cloud that blinds sensors and tags everything it touches', act:'disperse', tag:'chaff', arch:'corpo', need:'node:FAB-ADDITIVE@6', sc:{max:7,per:'metre'} },
                  { l:'Recall Signal', cap:'commands taggant nanites to report in', need:'node:LINK@5' }
                ]},
                { l:'Spectrum Sweep', cap:'shifts the cloud across bands', need:'node:SENSE@4' }
              ]},
              { l:'Glitter Burst', cap:'reflective flecks dazzle optics' }
            ]},
            { l:'Dipole Cut', cap:'sizes flakes to a radar band' }
          ]},
          { l:'Grit Throw', cap:'a coarse grit to foul machinery' }
        ]},
        { l:'Taggant Mist', cap:'sprays trackable marker dust', act:'mark', tag:'chaff', kids:[
          { l:'Code Dust', add:true, cap:'each batch carries a unique code' },
          { l:'Glow Tag', add:true, cap:'the taggant shows under a lamp' }
        ]},
        { l:'Flare Chaff', cap:'mixes hot flares into the chaff', tag:'chaff', kids:[
          { l:'Decoy Heat', cap:'a false heat source to seduce seekers' },
          { l:'Burst Timer', cap:'staggers the flare pops' }
        ]},
        { l:'Powder Puff', cap:'a small marker-powder burst', tag:'chaff' }
      ]}
    ]},
    SHIELD: { l:'Shield', cap:'stops an incoming attack, whether worn, deployed, projected or warding a thing', kids:[
      { l:'Carried Barrier', cap:'a barrier the user wears or holds', kids:[
        { l:'Worn Plate', cap:'plate strapped to the body', act:'block', tag:'plate', need:'node:FAB-FORGE@2', kids:[
          { l:'Composite Plate', cap:'layered plate beats more per kilo', tag:'plate', need:'node:FAB-FORGE@3', kids:[
            { l:'Reactive Plate', cap:'a layer that bites back at the round', act:'defeat', tag:'plate', need:'node:FAB-FORGE@4', kids:[
              { l:'Adaptive Weave', cap:'the plate stiffens where it is hit', need:'node:MORPH@4', kids:[
                { l:'Self Heal Plate', cap:'the plate closes its own gouges', need:'node:REPAIR@4', kids:[
                  { l:'Exotic Worn Armour', cap:'a worn shell that shrugs off what should kill it', act:'block', tag:'plate', arch:'corpo', need:'node:FAB-FORGE@6' },
                  { l:'Weight Trim', add:true, cap:'sheds mass without losing cover', need:'node:MORPH@5' }
                ]},
                { l:'Spall Liner', add:true, cap:'catches fragments off the back face' }
              ]},
              { l:'Angle Bevel', cap:'shaped faces deflect hits away' }
            ]},
            { l:'Trauma Pad', cap:'soaks the shock behind the plate' }
          ]},
          { l:'Riot Shield', add:true, cap:'a hand-held barrier to hide behind', tag:'plate' }
        ]},
        { l:'Ablative Coat', cap:'a coat that burns away to save the core', tag:'ablate', kids:[
          { l:'Char Layer', cap:'a sacrificial outer skin' },
          { l:'Reflect Skin', cap:'a bright skin turns heat aside' }
        ]},
        { l:'Buckler', cap:'a small strapped forearm guard', tag:'plate', kids:[
          { l:'Punch Rim', cap:'a hard edge to strike with' },
          { l:'Fold Wing', cap:'folds flat when not needed', need:'node:MORPH@2' }
        ]},
        { l:'Gorget', add:true, cap:'a light guard for the throat', tag:'plate' }
      ]},
      { l:'Deployed Cover', cap:'cover set down to guard a spot', kids:[
        { l:'Portable Barricade', cap:'a barrier carried in and dropped', act:'cover', tag:'deflector', kids:[
          { l:'Pop Up Cover', cap:'unfolds into cover in a second', tag:'deflector', need:'node:MORPH@3', kids:[
            { l:'Deployable Wall', cap:'links panels into a long wall', act:'cover', tag:'deflector', need:'node:FAB-FORGE@4', kids:[
              { l:'Anchor Feet', cap:'pins the wall against a shove', kids:[
                { l:'Field Skin', cap:'a charged skin over the wall face', need:'power', kids:[
                  { l:'Static Ward Emplacement', cap:'a fixed ward-wall that holds a perimeter unmanned', act:'ward', tag:'ward', arch:'corpo', need:'node:POWER@6' },
                  { l:'Auto Repair Wall', cap:'the wall patches its own breaches', need:'node:REPAIR@5' }
                ]},
                { l:'Firing Slit', add:true, cap:'lets defenders shoot through cover' }
              ]},
              { l:'Sandbag Base', cap:'weighs the wall down cheap' }
            ]},
            { l:'Blast Fold', cap:'a fold that soaks an explosion', need:'node:SEAL@3' }
          ]},
          { l:'Wheel Base', cap:'rolls the barricade into place' }
        ]},
        { l:'Ballistic Blanket', cap:'a hung sheet that stops fragments', tag:'ablate', kids:[
          { l:'Grommet Line', cap:'hangs the blanket fast' },
          { l:'Weighted Hem', cap:'keeps the sheet from flapping' }
        ]},
        { l:'Stanchion Net', cap:'a net strung to snag rounds', tag:'ward', kids:[
          { l:'Cable Grid', cap:'a grid of tensioned cable' },
          { l:'Snag Mesh', cap:'fine mesh catches fragments' }
        ]},
        { l:'Drop Bollard', cap:'a post that halts a charging vehicle', tag:'deflector' }
      ]},
      { l:'Projected Field', cap:'a field thrown up to intercept attacks', kids:[
        { l:'Deflector', cap:'a field that nudges rounds off line', act:'deflect', tag:'deflector', need:'power', kids:[
          { l:'Hardshield', cap:'a rigid field that stops a hit dead', act:'block', tag:'deflector', need:'node:POWER@4', kids:[
            { l:'Absorb Redistribute', cap:'spreads a hit\'s force across the field', act:'absorb', need:'node:COMPUTE@4', kids:[
              { l:'Field Lattice', cap:'a mesh of nodes shares the load', need:'node:POWER@5', kids:[
                { l:'Ward Anchor', cap:'locks the field onto a body or a thing', need:'node:MORPH@5', kids:[
                  { l:'Total Barrier', cap:'a sealed projected field that wards a body or an object outright', act:'ward', tag:'ward', arch:'corpo', need:'node:POWER@6', needsAll:['on-object-ward.ward-shell.point-defense.predictive-block.threat-model.intercept-bank.hardkill-active-protection'] },
                  { l:'Bubble Seal', add:true, cap:'seals the field against gas and vacuum', need:'node:SEAL@5' }
                ]},
                { l:'Node Sync', cap:'keeps the lattice nodes in phase', need:'node:COMPUTE@5' }
              ]},
              { l:'Sag Guard', add:true, cap:'stops the field from collapsing under load' }
            ]},
            { l:'Flicker Gate', cap:'blinks the field to let allies through' }
          ]},
          { l:'Shimmer Screen', add:true, cap:'a thin screen that bleeds off light hits' }
        ]},
        { l:'Charge Coil', cap:'stores the power a field burns', need:'power', kids:[
          { l:'Fast Dump', cap:'floods the field for one big hit' },
          { l:'Trickle Feed', cap:'keeps a light field up for long' }
        ]},
        { l:'Field Projector', cap:'the emitter that casts the field', tag:'emitter', need:'node:POWER@3', kids:[
          { l:'Wide Cone', cap:'covers a broad frontal arc' },
          { l:'Tight Focus', cap:'concentrates the field on one facing' }
        ]},
        { l:'Idle Ward', cap:'a low always-on field against stray hits', tag:'ward' }
      ]},
      { l:'On Object Ward', cap:'protects a thing, not just a body', kids:[
        { l:'Ward Shell', cap:'a shell that guards a mounted object', act:'ward', tag:'ward', kids:[
          { l:'Point Defense', cap:'shoots down the incoming attack', act:'intercept', tag:'warhead', need:'node:COMPUTE@3', kids:[
            { l:'Predictive Block', cap:'reads the shot and blocks it early', act:'predict', need:'node:COMPUTE@4', kids:[
              { l:'Threat Model', cap:'learns each attack\'s signature', need:'node:COMPUTE@5', kids:[
                { l:'Intercept Bank', cap:'a magazine of quick interceptors', need:'node:POWER@5', kids:[
                  { l:'Hardkill Active Protection', cap:'a shell that detects and kills incoming rounds before impact', act:'intercept', tag:'warhead', arch:'corpo', need:'node:COMPUTE@6' },
                  { l:'Reload Cycle', cap:'resets the interceptors between hits', need:'node:REPAIR@4' }
                ]},
                { l:'Track Radar', cap:'watches for the incoming threat', need:'node:SENSE@5' }
              ]},
              { l:'Snap Shutter', add:true, cap:'slams a cover over a weak point' }
            ]},
            { l:'Softkill Lure', cap:'spoofs a seeker off the object' }
          ]},
          { l:'Cage Frame', cap:'a standoff cage pops a warhead early', tag:'plate' }
        ]},
        { l:'Object Ablator', cap:'a spent layer wrapped on the thing', tag:'ablate', kids:[
          { l:'Tile Skin', add:true, cap:'swappable tiles take the hit' },
          { l:'Blow Panel', add:true, cap:'a panel vents a blast outward' }
        ]},
        { l:'Damp Mount', cap:'a mount that soaks shock off the object', tag:'plate', kids:[
          { l:'Shock Isolator', cap:'decouples the thing from the jolt' },
          { l:'Recoil Cradle', add:true, cap:'rides back to bleed off force' }
        ]},
        { l:'Ward Beacon', add:true, cap:'flags the object as under a ward', tag:'ward' }
      ]}
    ]},

    // -- THE INTERIOR, AND MAKING IT YOURSELF --
    MIND: { l:'Mind', cap:'reads, rewrites, stores and wears the subjective interior of a mind', kids:[

    // A. READ — frontier: total interior transparency
    { l:'Read a mind', cap:'draws out what a mind holds without altering it', act:'read', tag:'wire', kids:[
      { l:'Mood read', cap:'reads surface mood off tells and body signs', need:'node:SENSE@2', kids:[
        { l:'Affect decode', cap:'names the exact feeling under the mood', act:'read', kids:[
          { l:'Empathic model', cap:'builds a live model of what the target feels', need:'node:COMPUTE@4', kids:[
            { l:'Preverbal read', cap:'catches a thought a breath before it is spoken', need:'node:SENSE@5', kids:[
              { l:'Total interior read', cap:'lays a mind\'s every sensation, memory and intent bare at once', act:'read', arch:'corpo', need:'node:COMPUTE@6' },
              { l:'Loop-back damp', cap:'keeps the reader from drowning in the target\'s feeling', add:true } ] },
            { l:'Surface-thought skim', cap:'reads the thoughts a mind is actively holding' } ] },
          { l:'Empathy overlay', cap:'pushes the read feeling into the reader so they feel it too' } ] },
        { l:'Deception read', cap:'reads stress and micro-tells for a lie', need:'node:COMPUTE@3', kids:[
          { l:'Truth baseline', cap:'learns the target\'s honest tells as a reference', need:'node:STORE@3', kids:[
            { l:'Live honesty read', cap:'scores every answer\'s truth as it is spoken' },
            { l:'Baseline recalibrate', cap:'re-zeros the reference as the target tires', add:true } ] } ] } ] },
      { l:'Distance scan', cap:'reads a mind at range with no contact', kids:[
        { l:'Range extend', cap:'pushes the read across a whole room', need:'node:SENSE@4', kids:[
          { l:'Crowd mood read', cap:'takes the emotional temperature of a crowd', kids:[
            { l:'Panic-seed sense', cap:'feels a crowd tipping toward a stampede' },
            { l:'Standoff shroud', cap:'hides that any read is happening at all', add:true, need:'node:CLOAK@3' } ] } ] } ] } ] },

    // B. EDIT — frontier: author a self (rewrite volition)
    { l:'Edit a mind', cap:'writes new content over a mind\'s own', act:'overlay', tag:'wire', kids:[
      { l:'Suggestion', cap:'plants an idea the target takes for their own', act:'overlay', need:'node:COMPUTE@3', kids:[
        { l:'Compulsion loop', cap:'loops a suggestion until it drives behaviour', need:'node:COMPUTE@4', kids:[
          { l:'Memory edit', cap:'rewrites a chosen memory to a new version', act:'overlay', need:'node:STORE@4', kids:[
            { l:'Persona overlay', cap:'writes a false personality over the sleeping one', need:'node:COMPUTE@5', kids:[
              { l:'Author a self', cap:'composes a person\'s beliefs, loyalties and will from scratch', act:'overlay', arch:'corpo', need:'node:CONTROL@6' },
              { l:'Rollback guard', cap:'keeps a hidden copy of the original self', add:true, need:'node:STORE@5' } ] },
            { l:'False-memory graft', cap:'grafts an event that never happened, whole' } ] },
          { l:'Loyalty rewrite', cap:'flips who the target believes they serve', need:'node:CONTROL@4' } ] },
        { l:'Impulse nudge', cap:'tips a hesitating target into acting', add:true } ] },
      { l:'Emotion write', cap:'sets a feeling the target did not choose', act:'overlay', need:'node:INJECT@3', kids:[
        { l:'Fear induction', cap:'floods the target with dread on command', need:'node:INJECT@4', kids:[
          { l:'Calm override', cap:'forces a panicking target quiet' },
          { l:'Euphoria hook', cap:'ties bliss to obedience so they crave it', add:true } ] } ] } ] },

    // C. ARCHIVE — frontier: an immortal stored self
    { l:'Archive a mind', cap:'captures and stores lived experience for later', act:'record', tag:'deck', kids:[
      { l:'Sense record', cap:'records the raw sensory stream of a moment', act:'record', need:'node:RECORD@3', kids:[
        { l:'Full-sensorium lay', cap:'lays down sight, sound, touch and feeling as one track', need:'node:RECORD@4', kids:[
          { l:'Engram archive', cap:'stores a structured map of memories, not just a reel', need:'node:STORE@4', kids:[
            { l:'Personality back-up', cap:'copies a whole self, its memories and its habits', need:'node:STORE@5', kids:[
              { l:'Immortal stored self', cap:'keeps a person whole and re-runnable after the body dies', act:'record', arch:'corpo', need:'node:STORE@6' },
              { l:'Snapshot scheduler', cap:'takes a fresh back-up on a set clock', add:true } ] },
            { l:'Skill extract', cap:'lifts a trained skill out as a chip anyone can run' } ] },
          { l:'Emotion track', cap:'tags the archive with the feelings that ran under it' } ] },
        { l:'Sensory buffer', cap:'holds the last minutes ready to commit', add:true, need:'node:STORE@3' } ] },
      { l:'Playback', cap:'replays a stored experience into a mind', act:'overlay', need:'node:RECORD@3', kids:[
        { l:'Braindance run', cap:'runs another person\'s recorded experience first-hand', need:'node:RECORD@4', kids:[
          { l:'Edit suite', cap:'cuts, loops and layers the experience before playback' },
          { l:'Sanity clamp', cap:'strips the payloads that would fry the viewer', add:true, need:'node:SECURITY@4' } ] } ] } ] },

    // D. WEAR — frontier: two minds merged into one
    { l:'Wear a mind', cap:'joins one mind to another, up to riding a living body', act:'reshape', tag:'wire', kids:[
      { l:'Private whisper', cap:'speaks a message only the target hears in their head', act:'overlay', need:'node:LINK@3', kids:[
        { l:'Shared feeling', cap:'opens a two-way channel of raw emotion', need:'node:LINK@4', kids:[
          { l:'Sense-share link', cap:'lets two minds feel each other\'s senses at once', need:'node:LINK@4', kids:[
            { l:'Puppet a body', cap:'drives the target\'s body while they watch, trapped inside', need:'node:CONTROL@5', kids:[
              { l:'Merge minds', cap:'fuses two minds into one shared self with no seam', act:'reshape', arch:'corpo', need:'node:CONTROL@6' },
              { l:'Ghost rebirth', cap:'pours a stored personality into a living host to wear it whole', act:'reshape', arch:'corpo', need:'node:BIOFAB@6', needsAll:['archive-a-mind.sense-record.full-sensorium-lay.engram-archive.personality-back-up','wear-a-mind.private-whisper.shared-feeling.sense-share-link.puppet-a-body'] } ] },
            { l:'Reflex borrow', cap:'lends the target your trained reflexes for a moment', add:true, need:'node:BOOST@4' } ] },
          { l:'Emotion damp', cap:'shields the wearer from the host\'s pain', add:true } ] } ] },
      { l:'Hive link', cap:'threads several minds into one loose network', need:'node:LINK@4', kids:[
        { l:'Consensus feel', cap:'lets the group share one mood and one aim', need:'node:LINK@5', kids:[
          { l:'Swarm will', cap:'moves many bodies on a single shared intent' },
          { l:'Dissent mute', cap:'quiets a member who pulls against the group', add:true } ] } ] } ] }

    ] },
    FABRICATE: { l:'Fabricate', cap:'the object makes matter in the field and turns that power on its own body', kids:[

    // A. FEEDSTOCK — frontier: never runs dry, eats anything
    { l:'Feedstock', cap:'gathers and holds the raw matter the object builds from', act:'print', tag:'feed', kids:[
      { l:'Cartridge feed', cap:'feeds from swappable stock cartridges', tag:'feed', kids:[
        { l:'Stock hopper', cap:'holds a working supply of raw material', kids:[
          { l:'Salvage recycler', cap:'breaks scrap back down into usable stock', need:'node:FAB-SUBTRACTIVE@3', kids:[
            { l:'Ambient digest', cap:'strips feedstock out of dirt, rubble and junk around it', need:'node:FAB-CHEM@4', kids:[
              { l:'Draw from anything', cap:'pulls usable matter from any material it touches, so it never runs dry', act:'print', arch:'corpo', need:'node:FAB-CHEM@6' },
              { l:'Purity sorter', cap:'sorts scavenged atoms to grade before use', add:true } ] },
            { l:'Scrap intake', cap:'eats broken gear and spent brass for stock' } ] },
          { l:'Feed filter', cap:'screens grit and slag out of the feed', add:true } ] },
        { l:'Powder magazine', cap:'meters fine powder stock to the head', kids:[
          { l:'Element rack', cap:'keeps separate elements to mix on demand' },
          { l:'Refill port', cap:'tops up stock without opening the object', add:true } ] } ] },
      { l:'Reservoir', cap:'holds bulk liquid and resin stock', tag:'feed', kids:[
        { l:'Slurry tank', cap:'stores a printable material slurry', need:'node:STORE@3', kids:[
          { l:'Deep stock hold', cap:'carries days of build material at once', sc:{max:3,per:'kilo'} },
          { l:'Level gauge', cap:'warns before the stock runs out', add:true } ] } ] } ] },

    // B. SCALE — frontier: builds big structures on site
    { l:'Scale', cap:'sets how large a thing the object can build', act:'print', tag:'nozzle', kids:[
      { l:'Micro head', cap:'prints tiny precise parts', tag:'nozzle', need:'node:FAB-ADDITIVE@2', kids:[
        { l:'Part fab', cap:'prints a whole working small part', act:'print', need:'node:FAB-ADDITIVE@3', kids:[
          { l:'Gear-and-tool fab', cap:'prints hand tools and gear on the spot', need:'node:FAB-ADDITIVE@4', kids:[
            { l:'Vehicle-scale fab', cap:'prints frames and panels the size of a vehicle', need:'node:FAB-FORGE@5', kids:[
              { l:'On-site structure builder', cap:'raises a building-sized structure in the field from raw stock', act:'print', arch:'corpo', need:'node:FAB-FORGE@6' },
              { l:'Scaffold weaver', cap:'prints its own support scaffolding as it goes', add:true } ] },
            { l:'Weapon fab', cap:'prints a working firearm frame to order' } ] },
          { l:'Ammo fab', cap:'prints matched ammunition on demand', need:'node:GAUSS@3' } ] },
        { l:'Detail nozzle', cap:'swaps to a finer nozzle for close work', add:true } ] },
      { l:'Big extruder', cap:'lays material down fast and coarse', tag:'nozzle', need:'node:FAB-ADDITIVE@3', kids:[
        { l:'Bulk lay', cap:'floods a mould with material at speed', kids:[
          { l:'Rebar co-print', cap:'lays reinforcement into the pour as it builds', need:'node:FAB-FORGE@4' },
          { l:'Cure booster', cap:'sets each layer hard before the next', add:true } ] } ] } ] },

    // C. AUTONOMY — frontier: a free swarm that builds unsupervised
    { l:'Autonomy', cap:'sets how little hand the fabrication needs', act:'print', tag:'core', kids:[
      { l:'Hand feed', cap:'the operator feeds and runs each job', tag:'core', kids:[
        { l:'Batch program', cap:'runs a queued batch of jobs on its own', need:'node:COMPUTE@3', kids:[
          { l:'Self-directed builder', cap:'plans and prints toward a goal without step-by-step orders', need:'node:COMPUTE@4', kids:[
            { l:'Builder swarm', cap:'splits the work across many cooperating fab units', need:'node:COMPUTE@5', kids:[
              { l:'Free nanite swarm', cap:'an unsupervised nanomachine cloud that fabricates whatever it is tasked, alone', act:'print', arch:'corpo', need:'node:FAB-ADDITIVE@6' },
              { l:'Kill-switch tether', cap:'holds a hard stop over the swarm at all times', add:true, need:'node:HACK@4' } ] },
            { l:'Job scheduler', cap:'orders the build steps for least waste' } ] },
          { l:'Error retry', cap:'catches a failed layer and prints it again', add:true } ] },
        { l:'Remote run', cap:'takes build jobs over a link', add:true, need:'node:LINK@3' } ] },
      { l:'Self-supply', cap:'the fabricator feeds its own jobs', tag:'core', kids:[
        { l:'Auto-fetch stock', cap:'goes and gathers its own feedstock', need:'node:MOVE@3', kids:[
          { l:'Print-and-place', cap:'prints a part then installs it itself', need:'node:REPAIR@4' },
          { l:'Yield log', cap:'tracks what it has made and used', add:true, need:'node:STORE@3' } ] } ] } ] },

    // D. SELF-APPLICATION — frontier: becomes any object (programmable matter)
    { l:'Self-application', cap:'turns the fabrication inward, on the object\'s own body', act:'reshape', tag:'core', kids:[
      { l:'Frame patch', cap:'prints new material over its own damage', act:'reshape', need:'node:REPAIR@3', kids:[
        { l:'Module recast', cap:'melts down a module and reprints it as another', need:'node:FAB-ADDITIVE@4', kids:[
          { l:'Reconfigure body', cap:'rearranges its own parts into a new layout', need:'node:MORPH@4', kids:[
            { l:'Reshape whole body', cap:'reflows its entire mass into a different form', need:'node:MORPH@5', kids:[
              { l:'Become any object', cap:'a programmable-matter body that recasts itself whole into any object at will', act:'reshape', arch:'corpo', need:'node:MORPH@6' },
              { l:'Recast from surroundings', cap:'rebuilds its whole body from whatever matter is around it', act:'reshape', arch:'corpo', need:'node:FAB-CHEM@6', needsAll:['feedstock.cartridge-feed.stock-hopper.salvage-recycler.ambient-digest','self-application.frame-patch.module-recast.reconfigure-body.reshape-whole-body'] } ] },
            { l:'Shape memory', cap:'snaps back to a stored default form', add:true } ] },
          { l:'Texture morph', cap:'changes its own surface texture and colour' } ] },
        { l:'Sacrificial stock', cap:'keeps spare mass to spend on self-repair', add:true } ] },
      { l:'Size shift', cap:'redistributes its own mass to change size', act:'reshape', need:'node:MORPH@4', kids:[
        { l:'Compact fold', cap:'packs itself down to carry small', kids:[
          { l:'Grow large', cap:'expands its own frame to a larger build', need:'node:MORPH@5' },
          { l:'Mass buffer', cap:'holds reserve matter for the size change', add:true } ] } ] } ] }

    ] },
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
        add: !!lit.add, needsAll: lit.needsAll || null, takes: lit.takes || null, kids: [] };
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
  // Convergence-pull: picking a ⬡ node PULLS its needsAll requirements in from wherever they
  // live (suspending exclusivity for the pulled chains); a sweep then drops any ⬡ that loses a req.
  function baseId(p) { return String(p).split('@')[0]; }
  function scaleOf(path, id) { var e = (path || []).filter(function (p) { return baseId(p) === id; })[0]; return e && e.indexOf('@') >= 0 ? (+e.split('@')[1] || 1) : null; }
  function activeIds(path) { return (path || []).map(baseId); }
  function isActive(path, id) { return activeIds(path).indexOf(id) >= 0; }
  function kindOf(n) { return n.needsAll ? 'conv' : n.scale ? 'dial' : n.add ? 'add' : 'excl'; }
  function ancestors(g, id) { var out = [], cur = id; while (cur && cur !== 'ROOT' && g.nodes[cur]) { out.unshift(cur); cur = g.nodes[cur].parent; } return out; }
  function setHas(set, id) { for (var i = 0; i < set.length; i++) if (baseId(set[i]) === id) return true; return false; }
  function removeSubIn(g, set, x) { var kill = {}; (function rec(y) { if (!g.nodes[y]) return; kill[y] = 1; (g.nodes[y].kids || []).forEach(rec); })(x); return set.filter(function (p) { return !kill[baseId(p)]; }); }
  // ensure the chain root→target is active. noExcl = don't drop exclusive siblings (used when a
  // convergence PULLS a requirement in from another branch). Any ⬡ met along the way pulls its own reqs.
  function ensureChain(g, set, target, noExcl) {
    ancestors(g, target).forEach(function (nid) {
      var node = g.nodes[nid]; if (!node || setHas(set, nid)) return;
      if (!noExcl) {
        var par = g.nodes[node.parent];
        (par ? par.kids : []).forEach(function (sib) {
          if (sib !== nid && setHas(set, sib) && !node.add && !g.nodes[sib].add) set = removeSubIn(g, set, sib);
        });
      }
      set.push(node.scale ? nid + '@1' : nid);
      if (node.needsAll) node.needsAll.forEach(function (r) { set = ensureChain(g, set, r, true); });
    });
    return set;
  }
  // drop any active convergence whose requirements are no longer all present (cascades)
  function pruneOrphans(g, set) {
    for (var guard = 0; guard < 400; guard++) {
      var act = set.map(baseId), hit = null;
      for (var i = 0; i < act.length; i++) { var n = g.nodes[act[i]]; if (n && n.needsAll && !n.needsAll.every(function (r) { return act.indexOf(r) >= 0; })) { hit = act[i]; break; } }
      if (!hit) break; set = removeSubIn(g, set, hit);
    }
    return set;
  }
  function pickable(g, path, id, locks) { var n = g.nodes[id]; if (!n) return false; if (locks && locks[id]) return false; return n.tier <= 1 || isActive(path, n.parent); }  // parent active → clickable (a ⬡ pulls its reqs)
  // HARD LOCK, walked down the tree: a node whose `node:DOMAIN@g` dep the object cannot meet is closed,
  // and so is everything under it — you cannot reach past a node you may not take. hasGrade(domain) → the
  // grade the object already carries in that domain. A tree never gates on its own domain (see crossMissing).
  function crossLocks(g, hasGrade, selfDom) {
    var locks = {};
    if (typeof hasGrade !== 'function') return locks;
    selfDom = String(selfDom || '').toUpperCase();
    // keep the strongest grade asked per domain — the whole bill, never the same domain twice
    function merge(into, more) {
      (more || []).forEach(function (r) {
        for (var i = 0; i < into.length; i++) { if (into[i].domain === r.domain) { if (into[i].grade < r.grade) into[i] = r; return; } }
        into.push(r);
      });
      return into;
    }
    function ownNeed(n) {
      var m = /^node:([a-z0-9-]+)(?:@([0-6]))?$/i.exec(String(n.need || '').trim());
      if (!m) return null;
      var dom = m[1].toUpperCase(), want = m[2] != null ? +m[2] : 1;
      if (dom === selfDom || (hasGrade(dom) || 0) >= want) return null;
      return { domain: dom, grade: want };
    }
    var ids = Object.keys(g.nodes).filter(function (id) { return id !== g.root; })
      .sort(function (a, b) { return g.nodes[a].tier - g.nodes[b].tier; });   // parents before children
    // Sweep to a fixed point. Three ways a node closes: its own dep is unmet; an ancestor is closed
    // (you cannot reach through it); or — for a ⬡ — a node it would have to PULL is closed, which
    // can cascade back up into other convergences.
    var changed = true, guard = 0;
    while (changed && guard++ < 16) {
      changed = false;
      ids.forEach(function (id) {
        var n = g.nodes[id], needs = [], via = null, own = ownNeed(n);
        if (own) { merge(needs, [own]); via = n.label; }
        if (n.parent && locks[n.parent]) { merge(needs, locks[n.parent].needs); via = via || locks[n.parent].via; }
        (n.needsAll || []).forEach(function (r) {
          if (locks[r]) { merge(needs, locks[r].needs); via = via || (g.nodes[r] ? g.nodes[r].label : r); }
        });
        if (!needs.length) return;
        var sig = needs.map(function (r) { return r.domain + r.grade; }).sort().join(',');
        if (!locks[id] || locks[id].sig !== sig) changed = true;
        locks[id] = { needs: needs, own: own, via: via, sig: sig };
      });
    }
    return locks;
  }
  function toggle(g, path, id) {
    var set = (path || []).slice(); var n = g.nodes[id]; if (!n) return set;
    if (setHas(set, id)) { set = removeSubIn(g, set, id); return pruneOrphans(g, set); }   // un-pick (prunes its subtree)
    set = ensureChain(g, set, id, false);                                                   // pick: build the chain (and pull any ⬡ reqs)
    return pruneOrphans(g, set);
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
  // tips = active leaves; ignore ids not in this tree (a saved path can outlive a re-authored tree)
  function tips(g, path) { var a = activeIds(path); return a.filter(function (id) { var n = g.nodes[id]; return n && !(n.kids || []).some(function (k) { return a.indexOf(k) >= 0; }); }); }
  function crumbs(g, path) { return tips(g, path).map(function (id) { return ancestors(g, id).map(function (x) { return g.nodes[x].label; }).join(' › '); }); }
  function collect(g, path, key) { var out = []; activeIds(path).forEach(function (id) { var n = g.nodes[id]; if (n && n[key] && out.indexOf(n[key]) < 0) out.push(n[key]); }); return out; }

  window.TechTrees = { TREES: TREES, WEAPON_SYSTEMS: WEAPON_SYSTEMS, has: hasTree, get: build, layout: layout,
    kindOf: kindOf, pickable: pickable, isActive: isActive, activeIds: activeIds, ancestors: ancestors,
    toggle: toggle, scaleOf: scaleOf, setScale: setScale, pathTier: pathTier, grade: grade, tips: tips, crumbs: crumbs, collect: collect,
    crossLocks: crossLocks };
})();
