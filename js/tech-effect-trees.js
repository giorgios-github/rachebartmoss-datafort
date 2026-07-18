/* tech-effect-trees.js — EFFECT TREES (cran 5 · replaces the flat grade ladder).
   An effect is no longer a scalar grade — it's a PATH walked down a per-domain tree.
   tier (= depth from root) IS the old grade, kept as an annotation.

   Authoring: a nested literal per domain (short keys, dense to write):
     { l:label, cap:caption, act:action, tag:addon-filter, need:requires,
       sc:{max,per} (° dial), add:true (□ stackable), needsAll:[ids] (⬡ convergence),
       arch:archetype-name (corpo g6 end-state), bridge:'net'|'data', kids:[…] }
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
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) || 'n'; }

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

    SHIELD: { l: 'Shield', cap: 'put a barrier between you and the hit', kids: [
      { l: 'Ballistic shield', cap: 'a rigid hand shield — stops rounds you hide behind', act: 'block', tag: 'shield', kids: [
        { l: 'View port', cap: 'a bulletproof slit to see and shoot through', kids: [
          { l: 'Gun port', cap: 'return fire without exposing yourself', act: 'flank', kids: [
            { l: 'Powered brace', cap: 'servo brace holds it steady under fire', need: 'power', kids: [
              { l: 'Breach bulwark', arch: 'corpo', cap: 'a one-person mobile wall that shrugs off a squad — OP corpo' }] }] }] },
        { l: 'Extend width', add: true, cap: 'wider face to cover a teammate too', sc: { max: 3, per: 'span' } }] },
      { l: 'Deployable cover', cap: 'a barrier that unfolds into standing cover', act: 'deny-zone', tag: 'deployable', kids: [
        { l: 'Auto-deploy', cap: 'pops from a pack into a wall in seconds', kids: [
          { l: 'Ballistic foam', cap: 'sprays and hardens into instant cover', kids: [
            { l: 'Self-repairing', cap: 'the wall reflows to seal holes', need: 'seal', kids: [
              { l: 'Fortress-in-a-box', arch: 'corpo', cap: 'a briefcase that becomes a bunker — OP corpo' }] }] }] }] },
      { l: 'Energy field', cap: 'a projected field that bleeds off incoming energy', need: 'power', tag: 'field', kids: [
        { l: 'Flare screen', cap: 'diffuses lasers and beams', need: 'node:ENERGY', kids: [
          { l: 'Kinetic damper', cap: 'a field that slows fast projectiles', sc: { max: 3, per: 'strength' }, kids: [
            { l: 'Deflector', cap: 'a shaped field that turns rounds aside', kids: [
              { l: 'Graviton screen', cap: 'damper + deflector — a bubble little gets through', needsAll: ['energy-field.flare-screen.kinetic-damper', 'energy-field.flare-screen.kinetic-damper.deflector'], kids: [
                { l: 'Aegis bubble', arch: 'corpo', cap: 'a personal force-screen that stops nearly everything — OP, corps only' }] }] }] }] }] },
      { l: 'Hardkill', cap: 'a system that shoots incoming threats out of the air', need: 'node:SENSE', act: 'lock-on', tag: 'apc', kids: [
        { l: 'Interceptor pucks', cap: 'launches counter-munitions at rockets', add: true, sc: { max: 4, per: 'puck' }, kids: [
          { l: 'Radar cue', cap: 'tracks threats and cues the intercept', need: 'node:JAM', kids: [
            { l: 'Point-defense laser', cap: 'a beam swats grenades and drones', need: 'node:ENERGY', needsAll: ['hardkill.interceptor-pucks', 'hardkill.interceptor-pucks.radar-cue'], kids: [
              { l: 'Guardian halo', arch: 'corpo', cap: 'an auto point-defense bubble that clears the sky around you — OP corpo' }] }] }] }] }] },

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

    MOVE: { l: 'Move', cap: 'get around', kids: [
      { l: 'Lift', cap: 'a lift surface / micro-thrust — glide & hop', need: 'power', tag: 'flight', kids: [
        { l: 'Glide', cap: 'farther glide', sc: { max: 3, per: 'range' }, kids: [
          { l: 'Wingsuit', cap: 'true horizontal flight, descending', kids: [
            { l: 'Ram-air canopy', add: true, cap: 'steer and flare a soft landing' },
            { l: 'Stealth glider', need: 'node:CONCEAL', cap: 'radar-silent descent', kids: [
              { l: 'Powered assist', cap: 'extend the glide under thrust', kids: [
                { l: 'Ghost glider', arch: 'corpo', cap: 'a silent high-altitude insertion rig — OP corpo black-ops' }] }] }] }] },
        { l: 'Hop-jets', cap: 'short boosted jumps', kids: [
          { l: 'Hover', cap: 'sustained low-altitude VTOL', kids: [
            { l: 'Sustained flight', cap: 'true flight — heavy power draw', kids: [
              { l: 'High-altitude', cap: 'supersonic ceiling', kids: [
                { l: 'Orbital launch', arch: 'corpo', cap: 'a suborbital hop — maybe three corporations master this, OP' }] }] }] }] },
        { l: 'Anti-grav', cap: 'exotic — shrug off gravity', need: 'seal', kids: [
          { l: 'Lift plates', cap: 'silent hover with no downwash', kids: [
            { l: 'Grav drive', arch: 'corpo', cap: 'true anti-gravity flight — OP, corps only' }] }] }] },
      { l: 'Actuators', cap: 'boosted muscle/reflex — move faster and hit harder', need: 'injector', tag: 'cyberware', kids: [
        { l: 'Reflex boost', cap: 'sped-up reactions', act: 'boost', kids: [
          { l: 'Leg servos', cap: 'sprint and leap far beyond human limits', sc: { max: 3, per: 'boost' }, kids: [
            { l: 'Sandevistan sprint', cap: 'a burst of hyper-speed on demand', need: 'power', kids: [
              { l: 'Blur-runner', arch: 'corpo', cap: 'a reflex suite that makes you a blur — OP corpo boostware' }] }] }] }] },
      { l: 'Traversal', cap: 'go where there\'s no floor — climb and cling', tag: 'climb', kids: [
        { l: 'Gecko grip', cap: 'cling to sheer walls', kids: [
          { l: 'Grapple line', cap: 'fire and ascend a line', act: 'ascend', add: true, kids: [
            { l: 'Powered winch', cap: 'hauls you and gear up fast', need: 'power', kids: [
              { l: 'Spider-swing', cap: 'reflex + grapple to swing between buildings', needsAll: ['actuators.reflex-boost', 'traversal.gecko-grip.grapple-line'], kids: [
                { l: 'Web-runner rig', arch: 'corpo', cap: 'swing across a skyline like it\'s flat ground — OP corpo' }] }] }] }] }] },
      { l: 'Drive', cap: 'a vehicle drivetrain — cover ground', need: 'mount', tag: 'drive', kids: [
        { l: 'Ground drive', cap: 'wheeled/tracked propulsion', sc: { max: 4, per: 'speed' }, kids: [
          { l: 'All-terrain', cap: 'legs/tracks cross broken ground', kids: [
            { l: 'Amphibious', cap: 'swim as well as roll', need: 'seal', kids: [
              { l: 'Self-flying AV', cap: 'ground drive + hover = a true flying car', needsAll: ['drive.ground-drive.all-terrain', 'lift.hop-jets.hover'], need: 'node:HACK', kids: [
                { l: 'Autopilot AV', arch: 'corpo', cap: 'a self-piloting gyro-AV that goes anywhere — OP corpo gyro tech' }] }] }] }] }] }] },

    // ── additional effect domains (were linear ladders) ──
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
  function pickable(g, path, id) { var n = g.nodes[id]; if (!n) return false; return n.tier <= 1 || isActive(path, n.parent); }  // parent active → clickable (a ⬡ pulls its reqs)
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
    toggle: toggle, scaleOf: scaleOf, setScale: setScale, pathTier: pathTier, grade: grade, tips: tips, crumbs: crumbs, collect: collect };
})();
