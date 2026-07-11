/* net-model.js — the Net data model (socle DEEP).
   Pure, table-first, deterministic. Implements the shapes fixed in
   docs/net-interface-contract.md (DATA owns them): the DATAFORT facet, the
   runner DECK + NET ACCESS + program loadout, and the difficulty that is
   CALCULATED from the tuple (no stored "difficulty", no dice — the app receives
   typed results, it never rolls). NET/CAST/ROLES build their screens on these.

   Carrier note: a "host" is itself a `site` entity (app-web.js resolves
   `site.hostId` as a `site`; there is NO separate host type). So the contract's
   `host.datafort` is literally `site.datafort` on the hosting site → ZERO new
   DOC_TYPE. The runner deck/access/programs live on `cs.netrunner` on the Yjs
   sheet (where `deckId`/`programs`/`interface`/`netAccessCode` already live).

   Canon: docs/net-canon.md Axe 2 (fort components) / Axe 3 (deck, run) / Axe 4
   (ICE tiers, trace). Reference DB: data/net-ice.json, data/net-capabilities.json,
   data/net-buildtables.json + the shared data/cp2020programs.json catalog.

   No external deps — safe to load in app.html (GM) and cs.html (sheet).
   Exposes window.NetModel. Never throws on load. */
(function () {
  'use strict';

  /* ── tiny helpers (self-contained; no App dependency) ── */
  function uid(p) { return (p || 'nm') + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function sum(list, f) { var t = 0; for (var i = 0; i < list.length; i++) t += num(f(list[i], i)); return t; }

  /* ════════════════ CANON CONSTANTS ════════════════ */

  // The 6 canonical file types on a datafort. [CORE] p.157.
  // greyOps/blackOps are the loot — linked to Store entities (storeRef).
  var FILE_TYPES = [
    { key: 'interOffice',           label: 'Inter-Office' },
    { key: 'database',              label: 'Database' },
    { key: 'businessRecords',       label: 'Business Records' },
    { key: 'financialTransactions', label: 'Financial Transactions' },
    { key: 'greyOps',               label: 'Grey Ops',  loot: true },
    { key: 'blackOps',              label: 'Black Ops', loot: true },
  ];
  var LOOT_FILE_TYPES = ['greyOps', 'blackOps']; // these carry a Store entity storeRef

  // Public ICON tier on the City Grid (what the map shows BEFORE a run). [CORE] p.145.
  var TIERS = ['grey', '1', '2', '3', 'black'];

  // Program classes a datafort can DEPLOY as ICE (defense) vs. a runner LOADS as
  // a breaker (offense). Used to filter the shared program catalog into palettes.
  var ICE_CLASSES     = ['alarm', 'detection', 'anti-program', 'anti-system', 'anti-personnel', 'controller'];
  var BREAKER_CLASSES = ['intrusion', 'decryption', 'stealth', 'evasion', 'protection', 'utility', 'compiler', 'systemware'];

  // Deck access interface → REF modifier in the Net (contract §2 `deck.access`).
  // [CORE] p.132,134 ; keyboard (a desktop-app run) = -4 REF but IMMUNE to Black
  // ICE biofeedback (handoff §1). 'plugs' is the legacy sheet value for 'jack'.
  var INTERFACES = {
    jack:     { label: 'Interface plugs (jack)', ref: 0,  biofeedback: true },
    plugs:    { label: 'Interface plugs (jack)', ref: 0,  biofeedback: true },  // alias of jack (legacy sheet value)
    trodes:   { label: "'Trodes",               ref: -2, biofeedback: true },
    keyboard: { label: 'Keyboard (desktop)',     ref: -4, biofeedback: false },
  };
  function ifaceKey(v) { return v === 'plugs' ? 'jack' : (INTERFACES[v] ? v : 'jack'); }

  // Net Access lifecycle. [CORE] p.144–145 economy → net-life-canon §1.
  var ACCESS_STATUS = ['paid', 'late', 'invalidated', 'erased', 'hunted'];

  /* ════════════════ DATAFORT FACET (contract §1) ════════════════
     Attached to the hosting `site` as `host.datafort` (= `site.datafort`;
     1 site ⇄ 1 datafort). A plain object — the Store already syncs the site.
     No new entity type. */

  // Canon derivations (all deterministic):
  //  INT   = 3 × CPU           ([CORE] p.154, +3 INT / CPU, max 7 CPU → INT 21)
  //  MU    = 40 × CPU          (4 memories/CPU × 10 MU each, [CORE] p.155)
  //  acts  = 1 + ⌊CPU/2⌋       (fort actions/round: +1 per extra 2 CPU, [CORE] p.152)
  //  AI    = INT ≥ 12          (CPU ≥ 4, [CORE] p.154)
  var MAX_CPU = 7, MAX_STR = 10, AI_INT = 12;

  function blankDatafort(opts) {
    opts = opts || {};
    var cpu = clamp(num(opts.cpu, 1), 1, MAX_CPU);
    return {
      cpu: cpu,
      memoryMU: 40 * cpu,                                // capacity (contract §1); override by editing
      dataWallSTR: clamp(num(opts.dataWallSTR, cpu), 0, MAX_STR), // canon base STR = #CPU
      codeGates: opts.codeGates || [{ id: uid('gate'), str: 2, label: '' }], // {id,str}(+label)
      ice: [],       // {id,name,class,str,mu,mobile,blackIce,alert,pos?}  (net-canon §3.5)
      files: [],     // {id,type,mu,name,locked,revealed,storeRef?}  (6 types; loot→storeRef)
      remotes: [],   // {id,kind,name,meatRef?}  (↔ MEAT object; wiring deferred)
      skills: [],    // {name,str}  (5 skills / 2 CPU, [CORE] p.156)
      ai: null,      // {personality,reaction,icon} | {aiRef} — meaningful iff INT≥12
      tier: null,    // authored ICON tier override (grey/1/2/3/black) or null→derived
      // evolution state (net-life-canon §3, GM-driven / CAST-mutated — table-first):
      security: 0, codesRotatedAt: null, lastMaintained: null, abandoned: false,
      broadcast: null, econColor: null,                  // mirror/region (site owns broadcast)
      subgrid: null, // {w,h,cells:[{x,y,kind,ref?}]} — NET's fort editor paints it (no gutters)
      serverLocation: null, // {district?,meatRef?} — MEAT anchor, wiring deferred
    };
  }

  function intOf(df)  { return 3 * clamp(num(df && df.cpu, 1), 1, MAX_CPU); }
  function muOf(df)   { var o = df && df.memoryMU; return o != null ? num(o) : 40 * clamp(num(df && df.cpu, 1), 1, MAX_CPU); }
  function actsOf(df) { return 1 + Math.floor(clamp(num(df && df.cpu, 1), 1, MAX_CPU) / 2); }
  function canHostAI(df) { return intOf(df) >= AI_INT; }
  function muUsed(df)  { return sum(arr(df && df.files), function (f) { return num(f.mu, 1); }) + sum(arr(df && df.ice), function (i) { return num(i.mu); }); }

  /* ── calculated DIFFICULTY — the tuple → a transparent scalar + a tier band.
     There is no single canon number ([CORE] p.145: hardness emerges from the
     tuple). We expose an additive, monotone index and — more useful at the table
     — a qualitative TIER derived from the same canon rules. This is the ONE
     implementation (contract §1: "ne pas réimplémenter, appeler"). The band is
     what the ATLAS/sidebar shows; the breakdown feeds the "difficulty note". */
  var ICE_WEIGHT = { 'anti-personnel': 4, 'anti-program': 2, 'anti-system': 2, 'controller': 1, 'detection': 1, 'stealth': 1, 'alarm': 0 };
  function iceWeight(cls) { return ICE_WEIGHT[cls] != null ? ICE_WEIGHT[cls] : 1; }

  function difficulty(df, opts) {
    df = df || {};
    opts = opts || {};
    var sec = num(opts.securityLevel, 2);   // City Grid Security Level (LDL table p.147) — NET supplies it
    var int = intOf(df), gates = arr(df.codeGates), ice = arr(df.ice);
    var wall = clamp(num(df.dataWallSTR, 0), 0, MAX_STR);
    var gateStrSum = sum(gates, function (g) { return clamp(num(g.str, 2), 0, MAX_STR); });
    var iceScore = sum(ice, function (i) { return num(i.str) + iceWeight(i.class); });
    var aiBonus = int >= AI_INT ? 5 : 0;

    // rating = armor + gates + mind + teeth + city-grid context + AI-grade mind.
    var rating = wall * 3 + gateStrSum + int + iceScore + sec * 2 + aiBonus;

    var breakdown = [
      { label: 'Data Wall STR', value: wall, weight: '×3', pts: wall * 3 },
      { label: 'Code gates (Σ STR)', value: gateStrSum, weight: '×1', pts: gateStrSum },
      { label: 'System INT (' + clamp(num(df.cpu, 1), 1, MAX_CPU) + ' CPU)', value: int, weight: '×1', pts: int },
      { label: 'ICE loadout', value: ice.length, weight: 'str+class', pts: iceScore },
      { label: 'City Grid security', value: sec, weight: '×2', pts: sec * 2 },
    ];
    if (aiBonus) breakdown.push({ label: 'AI-grade mind (INT≥12)', value: '✓', weight: '+5', pts: aiBonus });

    return {
      int: int, muCapacity: muOf(df), actions: actsOf(df),
      wall: wall, gateStrSum: gateStrSum, gateCount: gates.length,
      iceScore: iceScore, blackIce: ice.some(function (i) { return i.blackIce; }),
      rating: rating, band: bandOf(df, rating), breakdown: breakdown,
    };
  }

  // Qualitative tier (canon §4.4). Authored tier wins; else Black iff any Black
  // ICE (anti-personnel) is present; Grey iff no attack ICE at all (alarm/
  // detection only); otherwise thresholds on the rating.
  function bandOf(df, rating) {
    var authored = df && df.tier;
    if (authored && TIERS.indexOf(String(authored)) >= 0) return String(authored);
    var ice = arr(df && df.ice);
    if (ice.some(function (i) { return i.blackIce || i.class === 'anti-personnel'; })) return 'black';
    var hasAttack = ice.some(function (i) { return i.class === 'anti-program' || i.class === 'anti-system'; });
    if (!hasAttack) return 'grey';           // alarm/detection only = alarm tier
    if (rating < 16) return '1';
    if (rating < 28) return '2';
    return '3';
  }

  /* ── loadout / files / remotes editing helpers (pure; return new entries) ── */
  function makeIceEntry(prog) {
    prog = prog || {};
    return {
      id: uid('ice'), name: prog.name || 'ICE', class: prog.class || 'detection',
      str: num(prog.str, 3), mu: num(prog.mu, 1),
      blackIce: !!(prog.blackIce != null ? prog.blackIce : prog.class === 'anti-personnel'),
      mobile: !!prog.mobile, alert: prog.alert || 'none', pos: null,
    };
  }
  function makeFileEntry(type, name) {
    var isLoot = LOOT_FILE_TYPES.indexOf(type) >= 0;
    return { id: uid('file'), type: type || 'database', mu: 1, name: name || '', locked: isLoot, revealed: false, storeRef: null };
  }
  function makeRemoteEntry(kind, name) {
    return { id: uid('rem'), kind: kind || 'camera', name: name || '', meatRef: null };
  }

  /* ════════════════ RUNNER DECK (contract §2) ════════════════
     cs.netrunner.deck. A `deckId` referencing data/cp2020decks.json may fill the
     base stats; blankDeck() builds a custom standard deck. deckStats() normalizes
     either into the run's inputs (MU capacity, Speed→actions, reach). [CORE] p.132–134. */
  function blankDeck() {
    // Standard cyberdeck baseline. [CORE] p.132. reach fixed by the deck ([BWB]).
    // deckId (optional) = chassis pointer into data/cp2020decks.json; null = custom.
    return { type: 'standard', deckId: null, memoryMU: 10, speed: 0, dataWalls: 2, specialOptions: [], reach: 2, access: 'jack' };
  }

  // The chassis id (a row in data/cp2020decks.json) behind this runner's deck.
  // UNIFIES the two representations (contract §2): the object's `deckId` wins,
  // then the legacy top-level `nr.deckId`. Callers resolve the catalog row from
  // this id and pass it to deckStats() as deckRecord.
  function deckChassisId(netrunner) {
    netrunner = netrunner || {};
    return (netrunner.deck && netrunner.deck.deckId) || netrunner.deckId || null;
  }

  // Normalize a runner's deck into run inputs. Accepts (netrunner, deckRecord?)
  // where deckRecord is the cp2020decks.json row for deckChassisId(netrunner)
  // (has _mu, speed, dataWall). Resolution per stat: object override ?? chassis
  // catalog ?? standard default — so a pointer-only `{deckId}` deck picks up the
  // chassis' real stats, while an explicit field on the object overrides them.
  function deckStats(netrunner, deckRecord) {
    netrunner = netrunner || {};
    var d = netrunner.deck || {};
    var rec = deckRecord || {};
    var chassis = deckChassisId(netrunner);
    var baseMu = num(d.memoryMU, num(rec._mu, 10));
    var speed = clamp(num(d.speed, num(rec.speed, 0)), 0, 5);          // max Speed 5 ([CORE] p.134)
    var wall = clamp(num(d.dataWalls, num(rec.dataWall, 2)), 0, MAX_STR);
    var iface = ifaceKey(d.access || netrunner.interface);            // 'plugs' (legacy) → 'jack'
    var loaded = arr(netrunner.programs);
    var loadedMu = sum(loaded, function (p) { return num(p.mu, num(p._mu, 1)); });
    var reach = d.reach != null ? num(d.reach) : (chassis || netrunner.deck ? 2 : 0);
    return {
      deckId: chassis,
      memoryMU: baseMu, speed: speed, dataWalls: wall,
      access: iface, refMod: INTERFACES[iface].ref, biofeedback: INTERFACES[iface].biofeedback,
      actions: 1 + speed,                      // runner plays 1 + Speed actions/round (contract §4)
      reach: reach,                            // a live deck = reach 2 (fixed by the deck)
      loadedMu: loadedMu, freeMu: baseMu - loadedMu, overloaded: loadedMu > baseMu,
    };
  }

  // v1 starter loadout (contract §3 program shape). A balanced kit that fits
  // exactly a standard 10 MU deck. Names resolve against data/cp2020programs.json.
  var PRESET_LOADOUT = [
    { name: 'Jackhammer',   kw: ['pierce'], class: 'intrusion',    str: 2, mu: 2, cost: 360, icon: 'hammer', effect: 'Break a data wall (1D6 to Wall STR).' },
    { name: 'Codecracker',  kw: ['unlock'], class: 'decryption',   str: 3, mu: 2, cost: 380, icon: 'key',    effect: 'Crack a code gate or file lock.' },
    { name: 'SeeYa',        kw: ['seek'],   class: 'detection',    str: 3, mu: 1, cost: 280, icon: 'eye',    effect: 'Spot ICE; a sawtooth wave flags an AI.' },
    { name: 'Invisibility', kw: ['cloak'],  class: 'stealth',      str: 3, mu: 1, cost: 300, icon: 'ghost',  effect: 'Stay unseen while Detection < STR.' },
    { name: 'Shield',       kw: ['shield'], class: 'protection',   str: 3, mu: 1, cost: 150, icon: 'shield', effect: 'Soak one incoming hit.' },
    { name: 'Manticore',    kw: ['strike'], class: 'anti-program', str: 2, mu: 3, cost: 880, icon: 'blade',  effect: 'De-rez a hostile program.' },
  ]; // Σ MU = 10

  // Instantiate a preset (or any template) into a live loadout program (adds id).
  function makeProgram(tpl) {
    tpl = tpl || {};
    return {
      id: uid('prog'), name: tpl.name || 'program', kw: arr(tpl.kw).slice(),
      class: tpl.class || 'utility', str: num(tpl.str, 1), mu: num(tpl.mu, 1), cost: num(tpl.cost, 0),
      icon: tpl.icon || '', demon: !!tpl.demon, daemon: tpl.daemon || null, effect: tpl.effect || '',
    };
  }

  /* ════════════════ NET ACCESS (contract §5) ════════════════
     cs.netrunner.access. The app never auto-charges — it SUGGESTS a status from
     the dates; the GM confirms escalation (late→invalidated→erased→hunted→Solo
     team). Table-first. */
  function blankAccess(opts) {
    opts = opts || {};
    return {
      code: opts.code || '',            // the Net Access code (LDL password)
      subscriptionDueAt: opts.subscriptionDueAt || null,
      tollsAccrued: 0,                  // 0.20 eb / case travelled ([CORE] p.144)
      status: 'paid',                   // paid|late|invalidated|erased|hunted
      monthlyFee: num(opts.monthlyFee, 30),   // ~30 eb/mo (additive) ([CORE] economy)
      lastPaidAt: null,                 // additive
    };
  }

  // Suggest a status from the clock. Returns {status, suggested, overdueDays}.
  // NEVER mutates and never escalates past `late` on its own — deeper states
  // (invalidated/erased/hunted) are GM calls. now = Date.now() (injectable).
  function accessStatus(access, now) {
    access = access || {};
    now = now || Date.now();
    var cur = ACCESS_STATUS.indexOf(access.status) >= 0 ? access.status : 'paid';
    var due = access.subscriptionDueAt;
    var overdueDays = due && now > due ? Math.floor((now - due) / 86400000) : 0;
    // If the GM already pushed it past `late`, keep their call.
    if (cur === 'invalidated' || cur === 'erased' || cur === 'hunted') return { status: cur, suggested: cur, overdueDays: overdueDays };
    var suggested = overdueDays > 0 ? 'late' : 'paid';
    return { status: cur, suggested: suggested, overdueDays: overdueDays };
  }

  // Cost of travel: 0.20 eb × cases. [CORE] p.144. A datum, not a charge.
  function tollFor(cases) { return Math.round(num(cases) * 0.20 * 100) / 100; }

  /* ════════════════ SHEET NORMALIZER ════════════════
     Ensure cs.netrunner carries the v1 deck + access objects without clobbering
     existing fields (main.js owns the base netrunner shape — this is additive).
     NET/main call it lazily; safe to run repeatedly. */
  function ensureNetrunner(cs) {
    if (!cs) return null;
    var nr = cs.netrunner || (cs.netrunner = {});
    // Unify the two deck representations non-destructively: `nr.deck` is the one
    // object. A legacy top-level `nr.deckId` becomes a chassis pointer INSIDE it
    // (a POINTER-ONLY deck — baking blankDeck() here would shadow the chassis'
    // real MU/Speed; deckStats resolves those from the catalog row instead). The
    // legacy `nr.deckId` field is kept intact (main.js still reads it).
    if (!nr.deck || typeof nr.deck !== 'object') {
      nr.deck = nr.deckId ? { deckId: nr.deckId } : blankDeck();
    } else if (!nr.deck.deckId && nr.deckId) {
      nr.deck.deckId = nr.deckId;
    }
    if (!nr.access || typeof nr.access !== 'object') {
      nr.access = blankAccess({ code: nr.netAccessCode || '' });  // fold the legacy string in
    }
    if (!Array.isArray(nr.programs)) nr.programs = [];
    return nr;
  }

  /* ════════════════ PROGRAM CLASSIFICATION ════════════════
     Filter the shared 281-entry catalog (data/cp2020programs.json) into role
     palettes, and read the fort-facing flags the raw rows lack. Black ICE = the
     anti-personnel class (biofeedback). [CORE] p.153. Mobile = hunts outside the
     walls (Hellhound/Bloodhound/Pit Bull). [CORE] p.152,163. */
  var MOBILE_NAMES = { 'Hellhound': 1, 'Bloodhound': 1, 'Pit Bull': 1, 'Werewolf': 1, 'Pepe Le Pue': 1 };
  function isBlackIce(prog) { return !!(prog && (prog.blackIce || prog.class === 'anti-personnel')); }
  function isMobile(prog)   { return !!(prog && (prog.mobile || MOBILE_NAMES[prog.name])); }
  function forFort(prog)    { return !!(prog && ICE_CLASSES.indexOf(prog.class) >= 0); }
  function forRunner(prog)  { return !!(prog && BREAKER_CLASSES.indexOf(prog.class) >= 0); }
  // Alert behaviour of an intrusion program (noise). [CORE] p.153.
  var ALERT = { 'Hammer': 'always', 'Jackhammer': '8-10', 'Worm': '9-10', 'Pile Driver': 'always', 'Sledgehammer': 'always' };
  function alertOf(prog) { return (prog && ALERT[prog.name]) || 'none'; }

  window.NetModel = {
    // constants
    FILE_TYPES: FILE_TYPES, LOOT_FILE_TYPES: LOOT_FILE_TYPES, TIERS: TIERS,
    ICE_CLASSES: ICE_CLASSES, BREAKER_CLASSES: BREAKER_CLASSES,
    INTERFACES: INTERFACES, ACCESS_STATUS: ACCESS_STATUS,
    MAX_CPU: MAX_CPU, MAX_STR: MAX_STR, AI_INT: AI_INT,
    PRESET_LOADOUT: PRESET_LOADOUT,
    // datafort
    blankDatafort: blankDatafort, difficulty: difficulty,
    intOf: intOf, muOf: muOf, actsOf: actsOf, muUsed: muUsed, canHostAI: canHostAI,
    makeIceEntry: makeIceEntry, makeFileEntry: makeFileEntry, makeRemoteEntry: makeRemoteEntry,
    // deck + programs
    blankDeck: blankDeck, deckStats: deckStats, deckChassisId: deckChassisId, makeProgram: makeProgram,
    // access
    blankAccess: blankAccess, accessStatus: accessStatus, tollFor: tollFor,
    ensureNetrunner: ensureNetrunner,
    // program classification (over the shared catalog)
    isBlackIce: isBlackIce, isMobile: isMobile, forFort: forFort, forRunner: forRunner, alertOf: alertOf,
    // internal (exposed for tests / NET reuse)
    _uid: uid,
  };
})();
