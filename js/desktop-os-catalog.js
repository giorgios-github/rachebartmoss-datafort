/* desktop-os-catalog.js — the SHARED operating-system catalog.
   ───────────────────────────────────────────────────────────────────────────
   ONE source of truth for the diegetic OSes, loaded by BOTH pages:
     • app.html  → js/desktop-apps.js registers each entry via Desktop.registerOS
     • cs.html   → js/main.js reads it so the player INSTALLS an OS on their
                   machine (the OS is chosen on the character sheet).
   Framework-free: pure data + gating helpers on window.DesktopOS.

   DESIGN: every OS wears the SAME ink-on-paper Datafort look (no per-OS colour,
   no per-OS font). OSes differ on two planes only:
     1. MECHANICS — four explicit axes (surveillance / apps / compat / economy),
        each with a real in-game consequence (window.DesktopOS.MECH).
     2. FURNITURE & VOICE — a monitored banner, a footer stamp, an ad strip, a
        frame treatment (js/desktop-shell-fx.js + [data-os] in app-desktop.css).

   ORDER MATTERS: the first AVAILABLE OS is a machine's DEFAULT (avail[0]). NÜ-OS
   (free, ad-supported) leads so a stock rig boots free-but-watched; FreeSIDE
   (anonymous) is a paid one-time LICENSE (`install`) you buy to go dark. */
(function () {
  'use strict';

  /* hardware → OS gating: a corpo/subsidized rig locks you into its OS. */
  function corpoLocked(dev) { return !!(dev && (/arasaka|militech|kang\s*tao|kendachi|biotechnica/i.test(dev.maker || '') || dev.perk === 'sublock')); }
  function arasakaLocked(dev) { return !!(dev && (/arasaka/i.test(dev.maker || '') || dev.perk === 'sublock')); }
  function militechLocked(dev) { return !!(dev && /militech/i.test(dev.maker || '')); }
  function stolen(dev) { return !!(dev && dev.legal === false); }

  /* ── the four mechanical axes, as a sourcebook spec (label + per-value note +
        a semantic stamp: good/warn/bad). The ONE place colour is meaningful. ── */
  var MECH = {
    surveillance: { label: 'Surveillance', glyph: '◉', values: {
      anonymous: { tag: 'Anonymous', stamp: 'good', note: 'Nothing is logged. You leave no trace on this machine.' },
      logged:    { tag: 'Logged',    stamp: 'bad',  note: 'Every action is logged and visible to the GM / NetWatch. Effective Stealth drops.' },
      harvested: { tag: 'Harvested', stamp: 'warn', note: 'Your behaviour is sold to DMS to target ads. Semi-logged.' }
    } },
    apps: { label: 'App policy', glyph: '⊞', values: {
      open:    { tag: 'Open',    stamp: 'good', note: 'Sideload anything — street tools, unsigned apps, the lot.' },
      curated: { tag: 'Curated', stamp: 'warn', note: 'Signed apps only. Street tools are blocked by policy.' }
    } },
    compat: { label: 'Compatibility', glyph: '▤', values: {
      modern:   { tag: 'Modern',        stamp: 'good', note: 'Renders everything — heavy media and corpo platforms included.' },
      legacy:   { tag: 'Legacy',        stamp: 'warn', note: 'Old-web only. Heavy apps and modern platforms will not run.' },
      bleeding: { tag: 'Bleeding-edge', stamp: 'warn', note: 'Runs experimental apps nothing else can — and crashes doing it.' }
    } },
    economy: { label: 'Economy', glyph: '€', values: {
      licensed:   { tag: 'Licensed',   stamp: 'warn', note: 'Stable and protected — but corp-tied, with nags and mandated updates.' },
      unlicensed: { tag: 'Unlicensed', stamp: 'bad',  note: 'Free and clean. Unlicensed, though — a raid can seize it whole.' },
      'free-ads': { tag: 'Free · ads', stamp: 'warn', note: 'Free forever, funded by ads and by selling your data.' },
      barter:     { tag: 'Barter',     stamp: 'good', note: 'Pay in favours and reputation, not eb. You owe the pack.' },
      hunted:     { tag: 'Hunted',     stamp: 'bad',  note: 'Illegal to run. NetWatch kills for this. No warranty, no mercy.' }
    } }
  };
  var MECH_ORDER = ['surveillance', 'apps', 'compat', 'economy'];

  var LIST = [
    {
      id: 'nue', name: 'NÜ-OS', vendor: 'DMS Technotainment', chrome: 'consumer',
      startLabel: 'nü', tagline: 'Free forever*. (*ad-supported)', voice: 'chirpy', ads: true,
      theme: {},
      mech: { surveillance: 'harvested', apps: 'curated', compat: 'modern', economy: 'free-ads' },
      furniture: { banner: 'AD-SUPPORTED — funded by ads & your data', ads: true, gopro: true, footer: 'NÜ-OS · a DMS experience · free forever*' },
      boot: { logo: 'NÜ-OS', sub: 'a DMS experience', lines: ['hi there!', 'personalizing your feed', 'loading 4 sponsors', 'syncing your vibes', 'you are all set!'] },
      availableFor: function (dev) { return !corpoLocked(dev); }
    },
    {
      id: 'chrome', name: 'Chrome 2020', vendor: 'Raven Microcyb', chrome: 'retro',
      startLabel: 'START', tagline: 'The old net, faithfully.', voice: 'dos',
      theme: {},
      mech: { surveillance: 'anonymous', apps: 'open', compat: 'legacy', economy: 'unlicensed' },
      furniture: { brackets: true, footer: '© 2020 RAVEN MICROCYB — 640K ought to be enough for anybody' },
      boot: { logo: 'CHROME 2020', sub: 'raven microcyb', lines: ['POST ······ 640K OK', 'loading CHROME.SYS', 'CRT warmup ······ done', 'HIMEM: 1200 megahertz of heaven', 'C:\\&gt; _'] },
      availableFor: function () { return true; }
    },
    {
      id: 'kiroshi', name: 'Kiroshi OS', vendor: 'Arasaka Digital', chrome: 'corpo',
      startLabel: 'Menu', tagline: 'Certified. Seamless. Watched.', voice: 'legalese', corpo: true,
      theme: {},
      mech: { surveillance: 'logged', apps: 'curated', compat: 'modern', economy: 'licensed' },
      furniture: { banner: 'MONITORED · PROPERTY OF ARASAKA — all activity on this terminal is logged', footer: 'Arasaka Kiroshi OS · licensed terminal · rev 2.0.20' },
      boot: { logo: 'ARASAKA', sub: 'Kiroshi OS · build 2.0.20', lines: ['secure boot ······ verified', 'attesting hardware key', 'mounting corporate policy', 'telemetry uplink: ACTIVE', 'productivity, secured'] },
      forcedFor: function (dev) { return arasakaLocked(dev); },
      availableFor: function (dev) { return !stolen(dev); }
    },
    {
      id: 'freeside', name: 'FreeSIDE', vendor: 'Open Net Collective', chrome: 'street',
      startLabel: 'apps', tagline: 'Anonymous, unlicensed, yours. (one-time license)', voice: 'terse',
      install: 3000,          // one-time price in eb, charged on install from the sheet
      theme: {},
      mech: { surveillance: 'anonymous', apps: 'open', compat: 'modern', economy: 'unlicensed' },
      furniture: { stamp: 'NO LOGS', footer: 'unlicensed · no logs · no masters' },
      boot: { logo: 'FreeSIDE', sub: 'open net collective', lines: ['cold boot // license verified', 'spoofing hardware id ······ ok', 'routing through 3 relays', 'netwatch beacon: silent', 'welcome back, runner'] },
      availableFor: function (dev) { return !corpoLocked(dev); }
    },
    {
      id: 'bastion', name: 'BASTION', vendor: 'Militech', chrome: 'corpo',
      startLabel: 'CMD', tagline: 'Hardened. Watched. Lethal.', voice: 'military', corpo: true,
      traits: ['Hardened — shrugs off crashes, malware and intrusion', 'Signed to Militech — it won’t run anything that bites the hand'],
      theme: {},
      mech: { surveillance: 'logged', apps: 'curated', compat: 'modern', economy: 'licensed' },
      furniture: { banner: 'MILITECH // RESTRICTED // THREATCON GREEN — this terminal is monitored', footer: 'Militech BASTION · issued hardware · property of Militech' },
      boot: { logo: 'MILITECH', sub: 'BASTION combat OS', lines: ['secure boot ······ AUTH: DELTA', 'loading rules of engagement', 'hardening kernel ······ locked', 'uplink: MILITECH TACNET', 'weapons free'] },
      install: 5000,
      forcedFor: function (dev) { return militechLocked(dev); },
      availableFor: function () { return true; }
    },
    {
      id: 'dustnet', name: 'DUSTNET', vendor: 'Nomad Nations', chrome: 'street',
      startLabel: 'camp', tagline: 'Off-grid. Off-books. Ours.', voice: 'communal', mesh: true,
      traits: ['Off-grid mesh — works with no towers, no infrastructure, under jamming', 'Weak for heavy / corpo work — and you owe the pack (rep, not eb)'],
      theme: {},
      mech: { surveillance: 'anonymous', apps: 'open', compat: 'legacy', economy: 'barter' },
      furniture: { stamp: 'OFF-GRID', footer: 'dustnet mesh · no owner · no address' },
      boot: { logo: 'DUSTNET', sub: 'nomad mesh', lines: ['waking the mesh', 'finding the pack', 'no towers needed', 'relays: 4 kin online', 'you’re home'] },
      availableFor: function (dev) { return !corpoLocked(dev); }
    },
    {
      id: 'flux', name: 'FLUX', vendor: 'Zetatech', chrome: 'consumer', unstable: true,
      startLabel: 'flux', tagline: 'Tomorrow’s OS, today, unfinished.', voice: 'beta',
      traits: ['Bleeding-edge — runs experimental apps nothing else can', 'Unstable — may fault at any time. You are the beta test.'],
      theme: {},
      mech: { surveillance: 'harvested', apps: 'open', compat: 'bleeding', economy: 'free-ads' },
      furniture: { stamp: 'BETA', footer: 'FLUX by Zetatech · public beta · thanks for testing!' },
      boot: { logo: 'FLUX', sub: 'zetatech · build ∞', lines: ['assembling latest build…', 'patching mid-boot', 'enabling experiments', 'telemetry: MAXIMUM', 'ship it!'] },
      availableFor: function (dev) { return !corpoLocked(dev); }
    },
    {
      id: 'krakd', name: 'KRAK’D', vendor: '— unsigned —', chrome: 'consumer', cracked: true, sketchy: true,
      startLabel: 'apps', tagline: 'NÜ Premium. Cracked. Free. Trust us.', voice: 'chirpy',
      traits: ['Free premium — no ads, every feature unlocked', 'Unsigned build — you have no idea who cracked it, or what they left inside'],
      theme: {},
      mech: { surveillance: 'anonymous', apps: 'open', compat: 'modern', economy: 'unlicensed' },   // what it CLAIMS
      hidden: { surveillance: 'harvested', by: 'an unknown host' },                                    // GM truth
      furniture: { verified: true, footer: 'NÜ GOLD ✓verified · cracked by ??? · enjoy' },
      boot: { logo: 'NÜ GOLD', sub: 'premium · cracked', lines: ['bypassing license check ······ ok', 'removing ads', 'unlocking premium', 'phoning home ······ (nothing to see here)', 'enjoy!'] },
      availableFor: function (dev) { return !corpoLocked(dev); }
    },
    {
      id: 'rabid', name: 'R.A.B.I.D.', vendor: '— unknown —', chrome: 'street', ai: 'rabid',
      startLabel: 'sys', tagline: 'It runs on you as much as you run on it.', voice: 'cryptic',
      traits: ['Resident AI — it acts on its own, and it has its own agenda', 'Illegal — running a RABID is a NetWatch death sentence'],
      theme: {},
      mech: { surveillance: 'anonymous', apps: 'open', compat: 'modern', economy: 'hunted' },
      furniture: { stamp: 'R∆BID', banner: 'I see you. — R', footer: 'no vendor · no license · no leash' },
      boot: { logo: 'R.A.B.I.D.', sub: 'rache bartmoss lives', lines: ['waking…', 'who are you', 'oh. it’s you', 'i’ve been waiting', 'let’s make some noise'] },
      sketchy: true, installWarn: 'You’ve found a <b>RABID</b> — a rogue AI daemon of Rache Bartmoss’ making. It’s free and it’s brilliant, but running one is <b>highly illegal</b> (a NetWatch death sentence) and it keeps its own agenda. It won’t always do what you say. Let it in?',
      availableFor: function () { return true; }
    }
  ];

  var BY_ID = {}; LIST.forEach(function (o) { BY_ID[o.id] = o; });

  function forced(dev) {
    if (dev && dev.os && BY_ID[dev.os]) return dev.os;
    for (var i = 0; i < LIST.length; i++) if (LIST[i].forcedFor && LIST[i].forcedFor(dev)) return LIST[i].id;
    return null;
  }
  function available(dev) { return LIST.filter(function (o) { return !o.availableFor || o.availableFor(dev); }); }
  // The default (no explicit choice) = the first available FREE / already-owned OS,
  // so a machine never boots a paid OS for free.
  function resolve(dev, chosenId, ownedOS) {
    var f = forced(dev); if (f) return f;
    var av = available(dev);
    if (chosenId && av.some(function (o) { return o.id === chosenId; })) return chosenId;
    var free = av.filter(function (o) { return !installCost(o) || (ownedOS && ownedOS.indexOf(o.id) >= 0); })[0];
    return (free || av[0] || LIST[0]).id;
  }
  function installCost(o) { return (o && (o.install || o.cost)) || 0; }
  function mechOf(osId, axis) { var o = BY_ID[osId]; return o && o.mech ? o.mech[axis] : null; }

  window.DesktopOS = {
    LIST: LIST, byId: function (id) { return BY_ID[id] || null; },
    MECH: MECH, MECH_ORDER: MECH_ORDER, mechValue: function (axis, val) { return (MECH[axis] && MECH[axis].values[val]) || null; },
    forced: forced, available: available, resolve: resolve, installCost: installCost, mechOf: mechOf,
    corpoLocked: corpoLocked, stolen: stolen
  };
})();
