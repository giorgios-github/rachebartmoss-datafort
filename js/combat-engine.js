/* combat-engine.js — Cyberpunk 2020 (v2.01) Friday Night Firefight rules engine.
   Pure functions only (no DOM, no network): rolls, range/to-hit, hit location,
   armor/SP + ablation, BTM, the 10-state wound track, stun & death saves,
   cyberlimb SDP. Used by the GM dashboard and the player combat overlay; also
   loadable in node for unit tests (UMD-ish export at the bottom). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CombatEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── dice ── */
  // 1d10, exploding on 10 (CP2020 skill checks); fumble handling is left to
  // the caller (a natural 1 is reported, not auto-failed).
  function d10x(rng) {
    rng = rng || Math.random;
    var total = 0, rolls = [], r;
    do { r = 1 + Math.floor(rng() * 10); rolls.push(r); total += r; } while (r === 10 && rolls.length < 10);
    return { total: total, rolls: rolls, natural1: rolls.length === 1 && rolls[0] === 1 };
  }
  function d10(rng) { rng = rng || Math.random; return 1 + Math.floor(rng() * 10); }
  function d6(rng) { rng = rng || Math.random; return 1 + Math.floor(rng() * 6); }
  // "2d6+2"-style weapon damage strings.
  function rollDamage(spec, rng) {
    rng = rng || Math.random;
    var m = /^(\d+)\s*[dD]\s*(\d+)\s*([+-]\s*\d+)?$/.exec(String(spec || '').trim());
    if (!m) return { total: 0, rolls: [], spec: spec, invalid: true };
    var n = +m[1], sides = +m[2], mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    var rolls = [], t = 0;
    for (var i = 0; i < n; i++) { var r = 1 + Math.floor(rng() * sides); rolls.push(r); t += r; }
    return { total: Math.max(0, t + mod), rolls: rolls, mod: mod, spec: spec };
  }

  /* ── initiative ── */
  function rollInitiative(ref, bonus, rng) {
    var die = d10(rng);
    return { total: die + (ref || 0) + (bonus || 0), die: die, ref: ref || 0, bonus: bonus || 0 };
  }

  /* ── ranges & to-hit ── */
  // Range bands from the weapon's listed range (meters): PB ≤1, Close ≤ r/4,
  // Medium ≤ r/2, Long ≤ r, Extreme ≤ 2r. To-hit difficulty per band.
  var RANGE_TN = { pb: 10, close: 15, medium: 20, long: 25, extreme: 30 };
  var RANGE_LABEL = { pb: 'Point blank', close: 'Close', medium: 'Medium', long: 'Long', extreme: 'Extreme' };
  function bandsFor(rangeM) {
    rangeM = rangeM || 50;
    return [
      { key: 'pb', max: 1 }, { key: 'close', max: Math.ceil(rangeM / 4) },
      { key: 'medium', max: Math.ceil(rangeM / 2) }, { key: 'long', max: rangeM },
      { key: 'extreme', max: rangeM * 2 },
    ];
  }
  // Common FNFF attack modifiers (the chart's list, name → mod).
  var MODIFIERS = [
    { key: 'aimloc', label: 'Aimed shot at location', mod: -4 },
    { key: 'moving', label: 'Target moving > 10m/turn', mod: -3 },
    { key: 'dodge', label: 'Target dodging', mod: -2 },
    { key: 'immobile', label: 'Target immobile', mod: 4 },
    { key: 'aim1', label: 'Aiming (1 rnd)', mod: 1 },
    { key: 'aim2', label: 'Aiming (2 rnd)', mod: 2 },
    { key: 'aim3', label: 'Aiming (3 rnd)', mod: 3 },
    { key: 'fastdraw', label: 'Fast draw / snapshot', mod: -3 },
    { key: 'ricochet', label: 'Ricochet / indirect fire', mod: -5 },
    { key: 'blinded', label: 'Blinded by light/smoke', mod: -3 },
    { key: 'silhouette', label: 'Target silhouetted', mod: 2 },
    { key: 'turnrun', label: 'Turning to face target', mod: -2 },
    { key: 'twoweap', label: 'Two weapons (each)', mod: -3 },
    { key: 'hipfire', label: 'Firing while moving (hip)', mod: -3 },
    { key: 'smartgun', label: 'Smartgun link', mod: 2 },
    { key: 'laser', label: 'Targeting scope/laser', mod: 1 },
    { key: 'wounded', label: 'Attacker Seriously wounded', mod: -2 },
  ];
  // Ranged attack: REF + skill + 1d10x + mods vs the band TN.
  function rangedAttack(opts, rng) {
    var roll = d10x(rng);
    var mods = (opts.mods || []).reduce(function (s, m) { return s + (m.mod || 0); }, 0);
    var total = (opts.ref || 0) + (opts.skill || 0) + (opts.wmod || 0) + mods + roll.total;
    var tn = RANGE_TN[opts.band || 'medium'];
    return { total: total, roll: roll, tn: tn, mods: mods, hit: !roll.natural1 && total > tn, fumble: roll.natural1 };
  }
  // Melee: opposed REF+skill+1d10x.
  function meleeAttack(att, def, rng) {
    var ra = d10x(rng), rd = d10x(rng);
    var ta = (att.ref || 0) + (att.skill || 0) + (att.mod || 0) + ra.total;
    var td = (def.ref || 0) + (def.skill || 0) + (def.mod || 0) + rd.total;
    return { attacker: { total: ta, roll: ra }, defender: { total: td, roll: rd }, hit: !ra.natural1 && ta > td, fumble: ra.natural1 };
  }
  // Full auto: ±1 per 10 rounds (+ close, − beyond), hits = margin capped by rounds fired.
  function fullAutoMod(rounds, band) {
    var per10 = Math.floor((rounds || 0) / 10);
    return (band === 'pb' || band === 'close') ? per10 : -per10;
  }
  function fullAutoHits(margin, rounds) { return Math.max(0, Math.min(rounds || 0, margin)); }
  // Three-round burst: +3 at close/medium, d6/2 rounds hit.
  function burstHits(rng) { return Math.max(1, Math.ceil(d6(rng) / 2)); }

  /* ── hit location ── */
  var LOCS = ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'];
  var LOC_LABEL = { head: 'Head', torso: 'Torso', rarm: 'R.Arm', larm: 'L.Arm', rleg: 'R.Leg', lleg: 'L.Leg' };
  function rollLocation(rng) {
    var r = d10(rng);
    var loc = r === 1 ? 'head' : r <= 4 ? 'torso' : r === 5 ? 'rarm' : r === 6 ? 'larm' : r <= 8 ? 'rleg' : 'lleg';
    return { die: r, loc: loc };
  }

  /* ── BTM ── */
  function btmFor(body) {
    body = +body || 0;
    if (body <= 2) return 0; if (body <= 4) return -1; if (body <= 7) return -2;
    if (body <= 9) return -3; if (body === 10) return -4; return -5;
  }

  /* ── damage pipeline ──
     raw → minus (SP + cover) at location → ×2 if head → minus |BTM| (min 1)
     → wound points. Armor ablates 1 SP at the struck location when penetrated.
     8+ points to a limb in one hit = limb destroyed (treat wound state Mortal 0
     minimum); cyberlimbs instead lose SDP and spare the meat. */
  function resolveDamage(opts) {
    var raw = +opts.raw || 0;
    var sp = +opts.sp || 0, cover = +opts.cover || 0;
    var afterArmor = raw - (sp + cover);
    if (afterArmor <= 0) return { wound: 0, stopped: true, raw: raw, afterArmor: 0, ablate: false, limbEvent: null };
    var dmg = afterArmor;
    if (opts.loc === 'head') dmg *= 2;
    var cyber = !!opts.cyberlimb;
    var btm = Math.abs(+opts.btm || 0);
    var wound = cyber ? dmg : Math.max(1, dmg - btm);
    var limbEvent = null;
    if (wound >= 8 && opts.loc !== 'torso' && opts.loc !== 'head' && !cyber) limbEvent = 'severed';
    if (wound >= 8 && opts.loc === 'head' && !cyber) limbEvent = 'headshot';
    return { wound: wound, stopped: false, raw: raw, afterArmor: afterArmor, headDoubled: opts.loc === 'head', btmApplied: cyber ? 0 : btm, ablate: true, cyberlimb: cyber, limbEvent: limbEvent };
  }

  /* ── wound track ── */
  // 10 states × 4 points: Light, Serious, Critical, Mortal 0..6.
  var WOUND_STATES = ['Light', 'Serious', 'Critical', 'Mortal 0', 'Mortal 1', 'Mortal 2', 'Mortal 3', 'Mortal 4', 'Mortal 5', 'Mortal 6'];
  var MAX_WOUNDS = 40;
  function woundState(points) {
    points = Math.max(0, Math.min(MAX_WOUNDS, +points || 0));
    if (points === 0) return { idx: -1, name: 'OK', penalty: 0, mortal: -1 };
    var idx = Math.min(9, Math.floor((points - 1) / 4));
    return { idx: idx, name: WOUND_STATES[idx], penalty: idx, mortal: idx >= 3 ? idx - 3 : -1 };
  }
  // REF/stat effect of the wound state (chart: Serious −2 REF; Critical ÷2; Mortal ÷3).
  function statEffect(stateIdx) {
    if (stateIdx <= 0) return { refMod: 0, note: stateIdx === 0 ? 'No penalty' : '' };
    if (stateIdx === 1) return { refMod: -2, note: '−2 REF' };
    if (stateIdx === 2) return { half: true, note: 'REF, INT, CL at ½' };
    return { third: true, note: 'REF, INT, CL at ⅓' };
  }
  // Stun/Shock save: roll 1d10 ≤ (BODY − state penalty) to stay up.
  function stunSave(body, stateIdx, rng) {
    var target = (+body || 0) - Math.max(0, stateIdx);
    var die = d10(rng);
    return { die: die, target: target, ok: die <= target };
  }
  // Death save (Mortal only): roll 1d10 ≤ (BODY − mortal level) or die.
  function deathSave(body, mortalLevel, rng) {
    var target = (+body || 0) - Math.max(0, mortalLevel);
    var die = d10(rng);
    return { die: die, target: target, ok: die <= target };
  }

  /* ── combatant factory ──
     Builds a combat record from a character sheet (CS schema) or an NPC sheet
     (org hierarchy.roles schema). Both store stats under .stats and weapons /
     armor arrays; armor uses { sp, locs:{head,torso,...} } on NPCs and the
     outfit/armor section on PCs — we take per-location worn SP, best piece. */
  function low(s) { return String(s == null ? '' : s).toLowerCase().trim(); }
  function statOf(sheet, key) {
    var s = (sheet && sheet.stats) || {};
    var v = s[key];
    if (v && typeof v === 'object') v = v.current != null ? v.current : v.base; // CS sometimes nests
    return +v || 0;
  }
  // Cyberware bonuses (CS schema: cyberware[].bonuses / options[].bonuses, each
  // { type:'stat'|'skill', target, value }). flatCyber already includes options.
  function cyberBonus(sheet, type, target) {
    var t = low(target), sum = 0;
    flatCyber(sheet).forEach(function (c) {
      ((c && c.bonuses) || []).forEach(function (b) { if (b && b.type === type && low(b.target) === t) sum += parseInt(b.value, 10) || 0; });
    });
    return sum;
  }
  function fullStats(sheet) {
    var keys = ['INT', 'REF', 'TECH', 'COOL', 'ATT', 'LUCK', 'MA', 'BODY', 'EMP'], out = {};
    keys.forEach(function (k) { out[k] = statOf(sheet, k) + cyberBonus(sheet, 'stat', k); }); // chrome boosts stats
    return out;
  }

  /* skills — PCs store an object { name: level } (+ customSkills[]); NPCs store
     an array [{ name, stat, val }]. Unify to a name→{name,val} map. */
  function skillsMap(sheet) {
    var out = {}, s = sheet && sheet.skills;
    if (Array.isArray(s)) s.forEach(function (x) { if (x && x.name) out[low(x.name)] = { name: x.name, val: +x.val || 0 }; });
    else if (s && typeof s === 'object') Object.keys(s).forEach(function (k) { out[low(k)] = { name: k, val: +s[k] || 0 }; });
    var cs = sheet && sheet.customSkills;
    if (Array.isArray(cs)) cs.forEach(function (x) { if (x && x.name) out[low(x.name)] = { name: x.name, val: +(x.val != null ? x.val : x.level) || 0 }; });
    // Chipware / neural bonuses grant or raise skills (chips you don't otherwise have appear here).
    flatCyber(sheet).forEach(function (c) {
      ((c && c.bonuses) || []).forEach(function (b) {
        if (b && b.type === 'skill') { var k = low(b.target), v = parseInt(b.value, 10) || 0; if (out[k]) out[k].val += v; else out[k] = { name: b.target, val: v }; }
      });
    });
    return out;
  }
  function skillVal(map, name) { var e = map[low(name)]; return e ? e.val : 0; }
  // Categories so the cockpit/condensed sheet can group & pick the right skill.
  var COMBAT_SKILLS = {
    'handgun': 'ranged', 'rifle': 'ranged', 'submachinegun': 'ranged', 'shoulder arms': 'ranged',
    'heavy weapons': 'ranged', 'archery': 'ranged', 'autofire': 'ranged', 'grenade throwing': 'ranged', 'grenade': 'ranged',
    'melee': 'melee', 'brawling': 'melee', 'martial arts': 'melee', 'fencing': 'melee',
    'dodge & escape': 'defence', 'dodge': 'defence', 'athletics': 'defence',
    'awareness/notice': 'util', 'awareness': 'util', 'first aid': 'util', 'medtech': 'util', 'medical tech': 'util',
    'weaponsmith': 'util', 'stealth': 'util', 'combat sense': 'util',
  };
  function combatSkills(map) {
    return Object.keys(map).filter(function (k) { return COMBAT_SKILLS[k]; })
      .map(function (k) { return { name: map[k].name, val: map[k].val, kind: COMBAT_SKILLS[k] }; })
      .sort(function (a, b) { return b.val - a.val; });
  }
  // Pick the CP2020 skill that governs a given weapon (by category/type/name).
  function skillForWeapon(w) {
    var s = low((w && (w.category || '')) + ' ' + (w && (w.type || '')) + ' ' + (w && (w.name || '')));
    if (/heavy|rpg|launcher|hmg|grenade.?launcher|rocket|cannon/.test(s)) return 'Heavy Weapons';
    if (/grenade|molotov|thrown|throw/.test(s)) return 'Athletics';
    if (/bow|crossbow/.test(s)) return 'Archery';
    if (/smg|sub.?machine|machine.?pistol/.test(s)) return 'Submachinegun';
    if (/rifle|assault|carbine|shotgun|sniper|shoulder/.test(s)) return 'Rifle';
    if (/pistol|handgun|revolver|hold.?out|\bp\b/.test(s)) return 'Handgun';
    if (/fist|punch|kick|brawl|martial|unarmed/.test(s)) return 'Brawling';
    if (/sword|blade|knife|axe|club|melee|baton|katana|monokatana|spear|staff|mono/.test(s)) return 'Melee';
    return 'Handgun'; // sensible default for an unrecognised firearm
  }
  function weaponSkillKind(w) {
    var sk = typeof w === 'string' ? w : skillForWeapon(w);
    return COMBAT_SKILLS[low(sk)] === 'melee' ? 'melee' : 'ranged';
  }

  /* weapons — use the live ammo count (currentAmmo / shots), NOT `ammo`, which
     holds the ammo TYPE string (e.g. "6mm"). Carry the sheet uid for write-back. */
  function weaponsFromSheet(sheet, map) {
    var list = (sheet && sheet.weapons) || [];
    if (!Array.isArray(list)) return [];
    return list.map(function (w, i) {
      var maxAmmo = parseInt((w && (w.shots != null ? w.shots : w.clip)) || 0, 10) || 0;
      var cur = w && w.currentAmmo != null ? parseInt(w.currentAmmo, 10) : maxAmmo;
      if (isNaN(cur)) cur = maxAmmo;
      var sk = skillForWeapon(w);
      return {
        id: 'w' + i, uid: (w && w.uid) || null,
        name: (w && (w.name || w.weapon)) || 'Weapon ' + (i + 1),
        type: (w && w.type) || '', category: (w && w.category) || '',
        damage: (w && (w.damage || w.dmg)) || '1d6',
        ammoType: (w && w.ammo) || '', ammoMax: maxAmmo, ammo: cur,
        rof: parseInt((w && w.rof) || 1, 10) || 1,
        range: parseInt((w && w.range) || 50, 10) || 50,
        wa: parseInt((w && (w.wa || w.acc)) || 0, 10) || 0,
        conc: (w && w.conc) || '', rel: (w && w.rel) || '',
        skill: sk, skillVal: map ? skillVal(map, sk) : 0,
        notes: (w && (w.description || w.notes)) || '',
      };
    });
  }

  /* armor — PCs encode SP per location inside free-text `notes` on each piece
     (e.g. "SP 14 torso/arms; EV 2", "SP 20 torso; SP 15 arms"). Parse those,
     plus structured NPC armor ({ sp, locs }), then layer per CP2020 rules. */
  var LOC_WORDS = {
    head: ['head', 'face', 'helmet', 'skull'], torso: ['torso', 'chest', 'body', 'ches', 'vest'],
    rarm: ['arm', 'arms'], larm: ['arm', 'arms'], rleg: ['leg', 'legs', 'feet'], lleg: ['leg', 'legs', 'feet'],
  };
  function parseArmorNotes(notes) {
    var out = {}, txt = String(notes || '');
    var re = /sp\s*(\d+)\s*([a-z/,.\- ]*?)(?=(?:;|sp\s*\d|ev\b|$))/gi, m;
    while ((m = re.exec(txt))) {
      var sp = +m[1], locStr = low(m[2]);
      var locs = [];
      ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'].forEach(function (L) {
        if (LOC_WORDS[L].some(function (w) { return locStr.indexOf(w) >= 0; })) locs.push(L);
      });
      if (!locs.length) locs = ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg']; // unspecified → full coverage
      locs.forEach(function (L) { out[L] = (out[L] || []); out[L].push(sp); });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return out; // { loc: [sp, sp...] }
  }
  function evFromNotes(notes) { var m = /ev\s*(-?\d+)/i.exec(String(notes || '')); return m ? +m[1] : 0; }
  // CP2020 layering: combine two SPs → higher + bonus from the difference.
  function layerTwo(a, b) {
    var hi = Math.max(a, b), lo = Math.min(a, b), diff = hi - lo;
    var bonus = diff <= 4 ? 5 : diff <= 8 ? 4 : diff <= 14 ? 3 : diff <= 20 ? 2 : 1;
    return hi + bonus;
  }
  function layerSPs(arr) {
    if (!arr || !arr.length) return 0;
    var s = arr.slice().sort(function (x, y) { return y - x; });
    var combined = s[0];
    for (var i = 1; i < s.length; i++) combined = layerTwo(combined, s[i]);
    return combined;
  }
  // Returns { sp:{loc:val}, ev, pieces:[names] } from a sheet's worn armor.
  function armorFromSheet(sheet) {
    var perLoc = { head: [], torso: [], rarm: [], larm: [], rleg: [], lleg: [] }, ev = 0, pieces = [];
    function addPiece(name, notes, structured) {
      if (structured && structured.sp) {
        var locs = structured.locs;
        ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'].forEach(function (L) {
          if (!locs || locs[L]) perLoc[L].push(+structured.sp);
        });
        if (name) pieces.push(name);
        return;
      }
      var parsed = parseArmorNotes(notes), got = false;
      Object.keys(parsed).forEach(function (L) { parsed[L].forEach(function (sp) { perLoc[L].push(sp); got = true; }); });
      if (got) { pieces.push(name || 'Armor'); ev += evFromNotes(notes); }
    }
    // structured NPC armor array
    var arr = (sheet && sheet.armor) || [];
    if (Array.isArray(arr)) arr.forEach(function (a) {
      if (!a) return;
      if (a.sp != null || a.SP != null) addPiece(a.name, a.notes, { sp: a.sp || a.SP, locs: a.locs });
      else addPiece(a.name, a.notes || a.note);
    });
    // PC equipped outfit(s) — items carry { name, notes }
    var outfits = (sheet && sheet.outfits) || [];
    if (Array.isArray(outfits)) outfits.filter(function (o) { return o && o.equipped; }).forEach(function (o) {
      (o.items || []).forEach(function (it) { if (it) addPiece(it.name, it.notes || it.note); });
    });
    var sp = {};
    ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'].forEach(function (L) { sp[L] = layerSPs(perLoc[L]); });
    return { sp: sp, ev: ev, pieces: pieces };
  }

  // CS stores cyber OPTIONS (Sandevistan, Kerenzikov, smartgun chip, scopes…)
  // nested under their parent processor's `.options`. Flatten so combat sees them.
  function flatCyber(sheet) {
    var cw = (sheet && sheet.cyberware) || [];
    if (!Array.isArray(cw)) return [];
    var out = [];
    cw.forEach(function (c) { if (!c) return; out.push(c); if (Array.isArray(c.options)) c.options.forEach(function (o) { if (o) out.push(o); }); });
    return out;
  }
  function cyberLimbsFromSheet(sheet) {
    var out = {}, cw = flatCyber(sheet);
    cw.forEach(function (c) {
      var n = low((c && (c.name || c.type)) || '');
      if (n.indexOf('cyberarm') >= 0 || (n.indexOf('cyber') >= 0 && n.indexOf('arm') >= 0)) { if (n.indexOf('left') >= 0) out.larm = 20; else out.rarm = 20; }
      if (n.indexOf('cyberleg') >= 0 || (n.indexOf('cyber') >= 0 && n.indexOf('leg') >= 0)) { if (n.indexOf('left') >= 0) out.lleg = 20; else out.rleg = 20; }
    });
    return out;
  }
  function cyberNamesFromSheet(sheet) {
    return flatCyber(sheet).map(function (c) { return (c && (c.name || c.type)) || ''; }).filter(Boolean);
  }

  /* Cyberware that actually does something in a firefight → weapons, passive
     bonuses, initiative speedware and activatable boosts. */
  var CYBERWEAPONS = [
    { re: /wolvers/, dmg: '2d6', skill: 'Melee' }, { re: /rippers/, dmg: '1d6', skill: 'Melee' },
    { re: /scratchers/, dmg: '1d6', skill: 'Melee' }, { re: /big *knuck/, dmg: '1d6', skill: 'Brawling' },
    { re: /battleglove/, dmg: '2d6', skill: 'Brawling' }, { re: /vampires?/, dmg: '1d6', skill: 'Melee' },
    { re: /slice.?n.?dice|slice/, dmg: '2d6', skill: 'Melee' }, { re: /cybersnake/, dmg: '2d6', skill: 'Melee' },
    { re: /monoblade|cyber.?sword|monokatana/, dmg: '3d6', skill: 'Melee' }, { re: /cyberbeast|hellhound/, dmg: '2d6', skill: 'Brawling' },
  ];
  function damageInNotes(notes) { var m = /(\d+\s*d\s*\d+\s*(?:[+-]\s*\d+)?)/i.exec(String(notes || '')); return m ? m[1].replace(/\s+/g, '') : ''; }
  function cyberCombatFromSheet(sheet) {
    var cw = flatCyber(sheet);
    var out = { weapons: [], initBonus: 0, smartgun: false, scope: false, painEditor: false, activatables: [] };
    cw.forEach(function (c, i) {
      var name = (c && (c.name || c.type)) || '', n = low(name), notes = (c && c.notes) || '';
      // cyber-weapons → usable attack
      var def = CYBERWEAPONS.filter(function (d) { return d.re.test(n); })[0];
      if (def) out.weapons.push({
        id: 'cw' + i, uid: null, name: name, type: 'MEL', category: 'CYBERWEAPON',
        damage: damageInNotes(notes) || def.dmg, ammoType: '', ammoMax: 0, ammo: 0,
        rof: 1, range: 2, wa: 0, skill: def.skill, skillVal: 0, cyber: true, notes: notes,
      });
      // passive aids
      if (/smart ?gun|smartlink|smartgun link/.test(n)) out.smartgun = true;
      if (/targeting scope|smartgoggles|sniper.?scope/.test(n)) out.scope = true;
      if (/pain ?editor/.test(n)) out.painEditor = true;
      // speedware → initiative
      if (/kerenzikov/.test(n)) out.initBonus += 2;
      if (/boosted reflex|reflex boost|synaptic|nanosurgeons/.test(n)) out.initBonus += 1;
      if (/sandevistan/.test(n)) out.activatables.push({ id: 'act' + i, name: name || 'Sandevistan', kind: 'speed', boost: 3, note: '+3 initiative this round' });
      if (/adrenal/.test(n)) out.activatables.push({ id: 'act' + i, name: name || 'Adrenal Booster', kind: 'adrenal', boost: 2, note: '+2 REF/INT, ignore one wound level' });
    });
    return out;
  }
  // Full inventory (gear) with detail — gadgets, grenades, tools, drugs…
  function inventoryFromSheet(sheet) {
    var g = (sheet && sheet.gear) || [];
    if (!Array.isArray(g)) return [];
    return g.map(function (x) {
      return { name: (x && (x.name || x.item)) || '', category: (x && x.category) || '', notes: (x && (x.notes || x.description)) || '', qty: (x && x.qty) || 0 };
    }).filter(function (x) { return x.name; });
  }
  // Every known skill the character actually has (level > 0), incl. custom ones.
  function allSkillsFromSheet(sheet) {
    var map = skillsMap(sheet);
    return Object.keys(map).map(function (k) { return map[k]; }).filter(function (s) { return s.val > 0; })
      .sort(function (a, b) { return b.val - a.val || a.name.localeCompare(b.name); });
  }
  function netFromSheet(sheet) {
    var n = sheet && sheet.netrunner;
    if (!n || (!n.deckId && !(n.programs && n.programs.length))) return null;
    return { deckId: n.deckId || '', mode: n.mode || 'vanilla', programs: (n.programs || []).slice(0, 30), quickhacks: (n.quickhacks || []).slice(0, 30), interface: n.interface || '' };
  }

  function makeCombatant(opts) {
    var sheet = opts.sheet || {};
    var map = skillsMap(sheet);
    var stats = fullStats(sheet);
    var armor = armorFromSheet(sheet);
    var cc = cyberCombatFromSheet(sheet);
    var weapons = weaponsFromSheet(sheet, map);
    // cyber-weapons gain their skill value from the sheet too
    cc.weapons.forEach(function (w) { w.skillVal = skillVal(map, w.skill); });
    weapons = weapons.concat(cc.weapons);
    return {
      id: opts.id,
      kind: opts.kind || 'npc',           // 'pc' | 'npc'
      sheetId: opts.sheetId || null,       // hosted sheet id for PCs (write-back)
      name: opts.name || sheet.handle || sheet.name || sheet.role || 'Combatant',
      role: sheet.role || opts.roleLabel || '',
      stats: stats,
      // Action REF = chromed REF minus armor encumbrance value (EV).
      ref: Math.max(0, stats.REF - (armor.ev || 0)), body: stats.BODY, ma: stats.MA, btm: btmFor(stats.BODY),
      initBonus: (+opts.initBonus || 0) + cc.initBonus, // speedware (Kerenzikov, reflex…)
      cyberFx: { smartgun: cc.smartgun, scope: cc.scope, painEditor: cc.painEditor },
      activatables: cc.activatables,      // Sandevistan / Adrenal — activatable in combat
      boosted: false,
      init: null, wounds: 0,
      armorSP: armor.sp,                   // combined SP per location (layered)
      armorDmg: { head: 0, torso: 0, rarm: 0, larm: 0, rleg: 0, lleg: 0 }, // ablation taken
      armorEV: armor.ev, armorPieces: armor.pieces,
      cyber: cyberLimbsFromSheet(sheet),   // loc → SDP remaining
      cyberList: cyberNamesFromSheet(sheet),
      weapons: weapons,                    // sheet weapons + cyber-weapons
      skills: combatSkills(map),          // combat subset (cockpit skill picker)
      allSkills: allSkillsFromSheet(sheet), // every skill the char has (sheet display)
      inventory: inventoryFromSheet(sheet), // full gear/gadgets with detail
      net: netFromSheet(sheet),
      status: { stunned: false, down: false, dead: false, stabilized: false },
      visible: opts.visible !== false,
      updatedAt: Date.now(),
    };
  }
  // Effective SP at a location = layered SP minus ablation taken (min 0).
  function effectiveSP(c, loc) { return Math.max(0, (c.armorSP && c.armorSP[loc] || 0) - (c.armorDmg && c.armorDmg[loc] || 0)); }

  return {
    d10: d10, d10x: d10x, d6: d6, rollDamage: rollDamage,
    rollInitiative: rollInitiative,
    RANGE_TN: RANGE_TN, RANGE_LABEL: RANGE_LABEL, bandsFor: bandsFor, MODIFIERS: MODIFIERS,
    rangedAttack: rangedAttack, meleeAttack: meleeAttack,
    fullAutoMod: fullAutoMod, fullAutoHits: fullAutoHits, burstHits: burstHits,
    LOCS: LOCS, LOC_LABEL: LOC_LABEL, rollLocation: rollLocation,
    btmFor: btmFor, resolveDamage: resolveDamage,
    weaponSkillKind: weaponSkillKind, skillForWeapon: skillForWeapon,
    skillsMap: skillsMap, skillVal: skillVal, combatSkills: combatSkills,
    armorFromSheet: armorFromSheet, parseArmorNotes: parseArmorNotes, layerSPs: layerSPs, effectiveSP: effectiveSP,
    WOUND_STATES: WOUND_STATES, MAX_WOUNDS: MAX_WOUNDS, woundState: woundState,
    statEffect: statEffect, stunSave: stunSave, deathSave: deathSave,
    makeCombatant: makeCombatant,
  };
});
