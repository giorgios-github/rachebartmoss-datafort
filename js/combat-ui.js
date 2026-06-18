/* combat-ui.js — shared combat tracker UI (GM stage + player overlay).
   Layout: a narrow "informed list" of combatants on the left (≤25% width) and,
   on the right, a condensed combat sheet of the *selected* combatant plus a
   COMP/CON-style cockpit (big action tiles → guided steps). All state flows
   through camp.combat* (Yjs) so every device converges; rules math is in
   CombatEngine (js/combat-engine.js). Every roll is auto but editable.

   window.CombatUI.mount(container, { camp, role:'gm'|'player', selfSheetId })
   returns { destroy(), render(), resort() }. */
(function () {
  'use strict';
  var E = window.CombatEngine;
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Skill → governing stat map (for grouping the full skill list like a real
  // sheet). Loaded once from the served skills DB; falls back to ungrouped.
  var SKILL_STAT = null;
  function loadSkillStats() {
    if (SKILL_STAT) return Promise.resolve(SKILL_STAT);
    if (window.DB && Array.isArray(window.DB.skills)) {
      SKILL_STAT = {}; window.DB.skills.forEach(function (s) { if (s && s.name) SKILL_STAT[s.name.toLowerCase()] = s.stat || ''; });
      return Promise.resolve(SKILL_STAT);
    }
    return fetch('data/cp2020skills.json').then(function (r) { return r.json(); }).then(function (arr) {
      SKILL_STAT = {}; (arr || []).forEach(function (s) { if (s && s.name) SKILL_STAT[s.name.toLowerCase()] = s.stat || ''; });
      return SKILL_STAT;
    }).catch(function () { SKILL_STAT = {}; return SKILL_STAT; });
  }
  function skillStat(name) { return (SKILL_STAT && SKILL_STAT[String(name).toLowerCase()]) || ''; }

  function mount(container, opts) {
    var camp = opts.camp, role = opts.role || 'player', selfSheetId = opts.selfSheetId || null;
    var unsubs = [];
    var selectedId = null;      // manual free selection (persists across turns)
    var act = null;             // in-progress attack flow for the selected combatant

    /* ── state helpers ── */
    function meta() { return camp.combatMeta() || {}; }
    function setMeta(patch) { camp.setCombatMeta(Object.assign({}, meta(), patch)); }
    function combatants() {
      var list = camp.allCombatants(), order = meta().order || [];
      list.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
      return list;
    }
    function get(id) { return camp.getCombatant(id); }
    function put(rec) { rec.updatedAt = Date.now(); camp.putCombatant(rec.id, rec); }
    function log(msg) { camp.logCombat({ msg: msg }); }
    function activeC() { var m = meta(), order = m.order || []; return get(order[(m.turnIdx || 0) % (order.length || 1)]); }
    function selectedC() { var c = selectedId && get(selectedId); return c || activeC(); }
    function isGM() { return role === 'gm'; }
    function isMine(c) { return !!(c && c.kind === 'pc' && c.sheetId && c.sheetId === selfSheetId); }
    function mode() { return (meta().settings || {}).mode || 'hybrid'; }
    function npcVis() { return (meta().settings || {}).npcVis || 'full'; }
    function canAct(c) { return !!c && (isGM() || (mode() === 'hybrid' && isMine(c))); }
    function viewLevel(c) {
      if (isGM() || c.kind === 'pc') return 'full';
      if (c.visible === false) return 'name';
      return npcVis(); // 'full' | 'status' | 'name'
    }

    var root = document.createElement('div');
    root.className = 'cbt-root';
    container.appendChild(root);

    /* ── small render helpers ── */
    function woundChip(c) {
      if (c.status.dead) return '<span class="cbt-chip cbt-chip-dead">DEAD</span>';
      var ws = E.woundState(c.wounds);
      if (ws.idx < 0) return '<span class="cbt-chip cbt-chip-ok">OK</span>';
      var tier = ws.idx === 0 ? 1 : Math.min(3, Math.floor(ws.idx / 3) + 1);
      return '<span class="cbt-chip cbt-chip-w' + tier + '">' + esc(ws.name.toUpperCase()) + '</span>';
    }
    function statusIcons(c) {
      var out = '';
      if (c.status.stunned) out += '<span class="cbt-ic" title="Stunned">✦</span>';
      if (c.status.down) out += '<span class="cbt-ic" title="Down">▼</span>';
      if (c.status.stabilized) out += '<span class="cbt-ic ok" title="Stabilized">✚</span>';
      return out;
    }
    function woundBar(c) {
      var pct = Math.min(100, Math.round((c.wounds / E.MAX_WOUNDS) * 100));
      var ws = E.woundState(c.wounds);
      var tier = c.status.dead ? 'd' : ws.idx < 0 ? 'ok' : ws.idx < 3 ? 'w' : 'm';
      return '<div class="cbt-lbar"><span class="cbt-lbar-f t-' + tier + '" style="width:' + pct + '%"></span></div>';
    }

    /* ── left: informed combatant list ── */
    function listRow(c, idx) {
      var actv = activeC(), m = meta();
      var isTurn = actv && actv.id === c.id;
      var sel = selectedC();
      var isSel = sel && sel.id === c.id;
      var lvl = viewLevel(c);
      var nameHidden = lvl === 'name';
      return '<div class="cbt-lrow' + (isSel ? ' sel' : '') + (isTurn ? ' turn' : '') + (c.status.dead ? ' dead' : '') + '" data-sel="' + esc(c.id) + '">' +
        '<span class="cbt-linit">' + (c.init == null ? '—' : c.init) + '</span>' +
        '<div class="cbt-lmain">' +
          '<div class="cbt-ltop"><span class="cbt-lname">' + esc(c.name) + '</span>' +
            '<span class="cbt-lkind">' + (c.kind === 'pc' ? 'PC' : 'NPC') + '</span>' +
            (isGM() && c.kind === 'npc' ? '<span class="cbt-eye' + (c.visible === false ? ' off' : '') + '" data-eye="' + esc(c.id) + '" title="Toggle player visibility">' + (c.visible === false ? '◌' : '◉') + '</span>' : '') +
            (isGM() ? '<span class="cbt-rm" data-rm="' + esc(c.id) + '" title="Remove">✕</span>' : '') +
          '</div>' +
          (nameHidden ? '<div class="cbt-lhidden">— hidden —</div>'
                      : '<div class="cbt-lbot">' + woundChip(c) + statusIcons(c) + woundBar(c) + '</div>') +
        '</div></div>';
    }
    function listCol() {
      var list = combatants();
      return '<div class="cbt-list">' +
        '<div class="cbt-lhead">[ COMBATANTS ]<span class="cbt-lround">R' + (meta().round || 1) + '</span></div>' +
        '<div class="cbt-lrows">' + list.map(listRow).join('') + '</div>' +
        '</div>';
    }

    /* ── right: condensed combat sheet of the selected combatant ── */
    function condensedSheet(c) {
      var lvl = viewLevel(c);
      var actv = activeC(), isTurn = actv && actv.id === c.id;
      var editable = canAct(c) || isGM();
      var head = '<div class="cs-head">' +
        '<span class="cs-init"' + (isGM() ? ' data-init="' + esc(c.id) + '" title="Click to edit initiative"' : '') + '>' + (c.init == null ? '—' : c.init) + '</span>' +
        '<span class="cs-name">' + esc(c.name) + '</span>' +
        '<span class="cs-kind">' + (c.kind === 'pc' ? 'PC' : 'NPC') + '</span>' +
        (isTurn ? '<span class="cs-turn">● ACTIVE TURN</span>' : '') +
        '<span style="flex:1"></span>' + woundChip(c) +
        '</div>';
      if (lvl === 'name') return '<div class="cs-sheet">' + head + '<div class="cs-hidden">Details hidden by the GM.</div></div>';
      var ws = E.woundState(c.wounds), eff = E.statEffect(ws.idx);
      var st = c.stats || {};
      var statOrder = [['REF', c.ref], ['BODY', c.body], ['MA', c.ma], ['INT', st.INT], ['COOL', st.COOL], ['TECH', st.TECH], ['EMP', st.EMP], ['BTM', c.btm]];
      var statline = '<div class="cs-stats">' + statOrder.filter(function (p) { return p[1] != null && (p[0] === 'BTM' || p[0] === 'REF' || p[0] === 'BODY' || p[1]); }).map(function (p) {
        return '<span><b>' + p[0] + '</b> ' + p[1] + '</span>';
      }).join('') + (eff.note ? '<span class="cs-pen">' + esc(eff.note) + '</span>' : '') +
        (c.armorEV ? '<span class="cs-ev" title="Encumbrance">EV ' + c.armorEV + '</span>' : '') + '</div>';
      if (lvl === 'status') return '<div class="cs-sheet">' + head + '<div class="cs-row">' + woundChip(c) + statusIcons(c) + '</div></div>';

      var combatNames = {}; (c.skills || []).forEach(function (s) { combatNames[s.name.toLowerCase()] = true; });
      var track = '<div class="cs-block"><div class="cs-blbl">WOUNDS — ' + (ws.idx < 0 ? 'unhurt' : esc(ws.name)) + (ws.mortal >= 0 ? ' · death save BODY−' + ws.mortal : '') + '</div>' + woundTrack(c, editable) + '</div>';
      var armor = '<div class="cs-block"><div class="cs-blbl">ARMOR SP / LOCATION' + (c.armorPieces && c.armorPieces.length ? ' <span class="cs-armnote">' + esc(c.armorPieces.join(', ')) + '</span>' : '') + '</div>' + armorRow(c, editable) + '</div>';
      var canUse = editable && isTurn && canAct(c);
      var weapons = (c.weapons && c.weapons.length) ? '<div class="cs-block"><div class="cs-blbl">WEAPONS</div>' + c.weapons.map(function (w) {
        var ammoLabel = w.ammoMax > 0 ? (w.ammo + '/' + w.ammoMax) : '—';
        return '<div class="cs-weap' + (canUse ? ' use' : '') + '"' + (canUse ? ' data-usew="' + esc(w.id) + '"' : '') + '>' +
          '<span class="cs-wname">⌖ ' + esc(w.name) + '</span>' +
          '<span class="cs-wmeta">' + esc(w.damage) + ' · ' + esc(w.skill) + (w.skillVal ? ' ' + w.skillVal : '') + ' · ROF ' + w.rof + ' · ' + w.range + 'm' + (w.ammoType ? ' · ' + esc(w.ammoType) : '') + '</span>' +
          '<span class="cs-ammo' + (w.ammoMax > 0 && w.ammo === 0 ? ' empty' : '') + '">' + ammoLabel + (w.ammoMax > 0 ? ' ⬩' : '') + '</span></div>';
      }).join('') + '</div>' : '';
      // Full skill list, grouped by governing stat like a real sheet.
      var skills = '';
      if (c.allSkills && c.allSkills.length) {
        var STAT_ORDER = ['REF', 'BODY', 'COOL', 'INT', 'TECH', 'EMP', 'ATT', 'MA', 'LUCK'];
        var groups = {};
        c.allSkills.forEach(function (s) { var st = skillStat(s.name) || 'MISC'; (groups[st] = groups[st] || []).push(s); });
        var order = STAT_ORDER.filter(function (k) { return groups[k]; }).concat(Object.keys(groups).filter(function (k) { return STAT_ORDER.indexOf(k) < 0; }));
        skills = '<div class="cs-block"><div class="cs-blbl">SKILLS <span class="cs-armnote">' + c.allSkills.length + '</span></div>' +
          order.map(function (st) {
            return '<div class="cs-skgrp"><span class="cs-skstat">' + esc(st) + '</span><div class="cs-chips">' +
              groups[st].map(function (s) { return '<span class="cs-skill' + (combatNames[s.name.toLowerCase()] ? ' combat' : '') + '">' + esc(s.name) + ' <b>' + s.val + '</b></span>'; }).join('') +
              '</div></div>';
          }).join('') + '</div>';
      }
      var fx = c.cyberFx || {};
      var fxLine = [fx.smartgun ? 'Smartgun +2' : '', fx.scope ? 'Scope +1' : '', fx.painEditor ? 'Pain editor' : '', c.initBonus ? 'Speedware +' + c.initBonus + ' init' : '', c.boosted ? 'BOOSTED' : ''].filter(Boolean).join(' · ');
      var cyber = (c.cyberList && c.cyberList.length) ? '<div class="cs-block"><div class="cs-blbl">CYBERWARE <span class="cs-armnote">' + c.cyberList.length + '</span></div>' +
        (fxLine ? '<div class="cs-fxline">' + esc(fxLine) + '</div>' : '') +
        '<div class="cs-chips">' + c.cyberList.map(function (n) {
          var combat = /wolver|ripper|scratch|knuck|battleglove|vampire|slice|snake|monoblade|sword|smartgun|scope|kerenzikov|sandevistan|reflex|synaptic|pain ?editor|adrenal/i.test(n);
          return '<span class="cs-cyber' + (combat ? ' combat' : '') + '">' + esc(n) + '</span>';
        }).join('') + '</div></div>' : '';
      var inv = (c.inventory && c.inventory.length) ? '<div class="cs-block"><div class="cs-blbl">INVENTORY / GADGETS <span class="cs-armnote">' + c.inventory.length + '</span></div><div class="cs-invlist">' + c.inventory.map(function (g) {
        return '<div class="cs-inv"><span class="cs-invn">' + esc(g.name) + (g.qty > 1 ? ' ×' + g.qty : '') + '</span>' +
          (g.category ? '<span class="cs-invcat">' + esc(g.category) + '</span>' : '') +
          (g.notes ? '<span class="cs-invnote">' + esc(g.notes) + '</span>' : '') + '</div>';
      }).join('') + '</div></div>' : '';
      var net = c.net ? '<div class="cs-block"><div class="cs-blbl">NETRUNNER' + (c.net.deckId ? ' · ' + esc(c.net.deckId) : '') + (c.net.interface ? ' · ' + esc(c.net.interface) : '') + '</div><div class="cs-chips">' +
        (c.net.programs || []).concat(c.net.quickhacks || []).map(function (p) { return '<span class="cs-prog">' + esc(typeof p === 'string' ? p : (p.name || '')) + '</span>'; }).join('') + '</div></div>' : '';
      return '<div class="cs-sheet">' + head + statline +
        '<div class="cs-sections">' + track + armor + weapons + skills + cyber + inv + net + '</div></div>';
    }
    function woundTrack(c, editable) {
      var html = '<div class="cbt-track">';
      for (var g = 0; g < 10; g++) {
        html += '<div class="cbt-tgroup" title="' + esc(E.WOUND_STATES[g]) + '"><div class="cbt-tlabel">' + esc(E.WOUND_STATES[g].replace('Mortal ', 'M')) + '</div><div class="cbt-tboxes">';
        for (var b = 0; b < 4; b++) { var n = g * 4 + b + 1; html += '<span class="cbt-box' + (c.wounds >= n ? ' hit' : '') + (editable ? ' ed' : '') + '" data-w="' + n + '"></span>'; }
        html += '</div></div>';
      }
      return html + '</div>';
    }
    function armorRow(c, editable) {
      return '<div class="cbt-armor">' + E.LOCS.map(function (L) {
        var sdp = c.cyber && c.cyber[L] != null ? '<span class="cbt-sdp" title="Cyberlimb SDP">' + c.cyber[L] + '</span>' : '';
        var effSP = E.effectiveSP(c, L), maxSP = (c.armorSP && c.armorSP[L]) || 0;
        var worn = maxSP > 0 ? '<span class="cbt-spmax" title="Armor SP (damaged ' + (c.armorDmg[L] || 0) + ')">/' + maxSP + '</span>' : '';
        return '<div class="cbt-aloc"><label>' + esc(E.LOC_LABEL[L]) + sdp + '</label>' +
          (editable ? '<input type="number" class="cbt-sp" data-loc="' + L + '" value="' + effSP + '" title="Current SP — edit to set armor damage">'
                    : '<span class="cbt-spv">' + effSP + '</span>') + worn + '</div>';
      }).join('') + '</div>';
    }

    /* ── right: cockpit (COMP/CON-style big buttons → steps) ── */
    function cockpit(sel) {
      var actv = activeC();
      var isActive = actv && actv.id === sel.id;
      if (!isActive) {
        // Viewing someone who isn't acting: offer to jump to whoever's turn it is.
        var can = canAct(actv);
        return '<div class="cck cck-idle">' +
          '<span class="cck-idle-t">' + (can ? "Your turn isn't this combatant." : esc(actv ? actv.name : '—') + ' is acting.') + '</span>' +
          (actv ? '<button class="cck-big" id="cck-goactive">⊙ Go to ' + esc(actv.name) + '</button>' : '') + '</div>';
      }
      if (!canAct(sel)) return '<div class="cck cck-idle"><span class="cck-idle-t">Watching — the GM resolves this turn.</span></div>';
      if (sel.status.dead) return '<div class="cck cck-idle"><span class="cck-idle-t">' + esc(sel.name) + ' is out of the fight.</span></div>';

      act = act && act.cid === sel.id ? act : { cid: sel.id, step: 'pick' };
      var html = '<div class="cck"><div class="cck-h">[ ACTIONS — ' + esc(sel.name) + ' ]</div>';

      if (act.step === 'pick') {
        var tiles = (sel.weapons || []).map(function (w) {
          var dry = w.ammoMax > 0 && w.ammo === 0; // only ranged weapons run dry
          var ammoTxt = w.ammoMax > 0 ? ' · ' + w.ammo + '/' + w.ammoMax + ' ⬩' : '';
          return '<button class="cck-tile" data-atk="' + esc(w.id) + '"' + (dry ? ' disabled title="Out of ammo — reload first"' : '') + '>' +
            '<span class="cck-tic">⌖</span><span class="cck-tname">' + esc(w.name) + '</span>' +
            '<span class="cck-tsub">' + esc(w.damage) + ' · ' + esc(w.skill) + ammoTxt + '</span></button>';
        }).join('');
        var run = sel.ma ? (sel.ma * 3) : 0, mv = sel.ma || 0;
        html += '<div class="cck-tiles">' + tiles +
          '<button class="cck-tile" data-atk="melee"><span class="cck-tic">⊗</span><span class="cck-tname">Melee / Brawl</span><span class="cck-tsub">opposed</span></button>' +
          '<button class="cck-tile" data-act="move"><span class="cck-tic">➤</span><span class="cck-tname">Move</span><span class="cck-tsub">' + mv + 'm / run ' + run + 'm</span></button>' +
          '<button class="cck-tile" data-act="reload"><span class="cck-tic">↺</span><span class="cck-tname">Reload</span><span class="cck-tsub">1 action</span></button>' +
          '<button class="cck-tile" data-act="stabilize"><span class="cck-tic">✚</span><span class="cck-tname">Stabilize</span><span class="cck-tsub">dying ally</span></button>' +
          '<button class="cck-tile" data-act="other"><span class="cck-tic">…</span><span class="cck-tname">Other</span><span class="cck-tsub">log it</span></button>' +
          // activatable cyberware (Sandevistan, Adrenal Booster…)
          (sel.activatables || []).map(function (a) {
            return '<button class="cck-tile cck-cyber" data-activate="' + esc(a.id) + '"' + (sel.boosted ? ' disabled title="Already boosted"' : '') + '><span class="cck-tic">◆</span><span class="cck-tname">' + esc(a.name) + '</span><span class="cck-tsub">' + esc(a.note) + '</span></button>';
          }).join('') +
          '</div>' +
          ((sel.cyberFx && (sel.cyberFx.smartgun || sel.cyberFx.scope || sel.cyberFx.painEditor)) ?
            '<div class="cck-fx">Active cyber: ' + [sel.cyberFx.smartgun ? 'Smartgun +2 to-hit' : '', sel.cyberFx.scope ? 'Targeting scope +1' : '', sel.cyberFx.painEditor ? 'Pain editor (no stun)' : ''].filter(Boolean).join(' · ') + '</div>' : '');
      } else if (act.step === 'aim') {
        var w = act.weapon;
        var targets = combatants().filter(function (t) { return t.id !== sel.id && !t.status.dead; });
        html += '<div class="cck-sec"><div class="cck-lbl">TARGET</div><div class="cck-opts">' + targets.map(function (t) {
          return '<button class="cck-opt' + (act.targetId === t.id ? ' sel' : '') + '" data-target="' + esc(t.id) + '">' + esc(t.name) + ' ' + woundChip(t) + '</button>';
        }).join('') + '</div></div>';
        if (w && !act.melee) {
          var bands = E.bandsFor(w.range);
          html += '<div class="cck-sec"><div class="cck-lbl">RANGE</div><div class="cck-opts">' + bands.map(function (b) {
            return '<button class="cck-opt' + ((act.band || 'close') === b.key ? ' sel' : '') + '" data-band="' + b.key + '">' + E.RANGE_LABEL[b.key] + '<small>≤' + b.max + 'm · TN' + E.RANGE_TN[b.key] + '</small></button>';
          }).join('') + '</div></div>';
          html += '<div class="cck-sec"><div class="cck-lbl">FIRE</div><div class="cck-opts">' +
            '<button class="cck-opt' + ((act.fire || 'single') === 'single' ? ' sel' : '') + '" data-fire="single">Single</button>' +
            (w.rof >= 3 ? '<button class="cck-opt' + (act.fire === 'burst' ? ' sel' : '') + '" data-fire="burst">3-rd burst<small>+3 close/med</small></button>' : '') +
            (w.rof >= 10 ? '<button class="cck-opt' + (act.fire === 'auto' ? ' sel' : '') + '" data-fire="auto">Full auto</button>' : '') +
            (act.fire === 'auto' ? '<label class="cck-inline">rounds <input type="number" id="cck-rounds" value="' + (act.rounds || Math.min(w.rof, w.ammo)) + '" min="1" max="' + Math.min(w.rof, w.ammo) + '" title="Up to the weapon ROF (' + w.rof + '), capped by ammo"></label><span class="cck-rofnote">ROF ' + w.rof + ' max</span>' : '') +
            '</div></div>';
        }
        html += skillSec(sel, w);
        if (!w) html += '<div class="cck-sec"><div class="cck-lbl">DAMAGE</div><div class="cck-opts"><input class="cck-dmg-in" id="cck-mdmg" value="' + esc(act.mdmg || '1d6') + '"></div></div>';
        var nMods = (act.mods || []).length;
        html += '<details class="cck-mods"' + (nMods ? ' open' : '') + '><summary>MODIFIERS' + (nMods ? ' (' + nMods + ')' : '') + '</summary><div class="cck-modgrid">' +
          E.MODIFIERS.map(function (m) {
            return '<label class="cck-mod"><input type="checkbox" data-mod="' + m.key + '"' + ((act.mods || []).indexOf(m.key) >= 0 ? ' checked' : '') + '> ' + esc(m.label) + ' <b>' + (m.mod > 0 ? '+' : '') + m.mod + '</b></label>';
          }).join('') + '</div></details>';
        html += '<div class="cck-actions"><button class="cck-big cck-go" id="cck-roll">ROLL TO HIT</button><button class="cck-big cck-ghost" id="cck-cancel">Cancel</button></div>';
      } else if (act.step === 'tohit') {
        var r = act.tohit;
        html += '<div class="cck-res"><div class="cck-res-big">' + r.total + '</div>' +
          '<div class="cck-res-meta">vs ' + (r.tn != null ? 'TN ' + r.tn : 'defence ' + r.def) +
          (r.fumble ? ' · <span class="cbt-chip cbt-chip-dead">FUMBLE</span>' : '') +
          '<br><small>d10: ' + r.roll.rolls.join('→') + '</small></div>' +
          '<label class="cck-inline">adjust <input type="number" id="cck-th-total" value="' + r.total + '"></label></div>' +
          '<div class="cck-actions"><button class="cck-big cck-go" id="cck-resolve">RESOLVE ▸</button><button class="cck-big cck-ghost" id="cck-cancel">Cancel</button></div>';
      } else if (act.step === 'damage') {
        var t = get(act.targetId), d = act.dmg;
        html += '<div class="cck-sec"><div class="cck-lbl">HIT — ' + esc(t ? t.name : '?') + (act.hits > 1 ? ' ×' + act.hits : '') + '</div>' +
          '<div class="cck-opts">' + E.LOCS.map(function (L) { return '<button class="cck-opt' + (act.loc === L ? ' sel' : '') + '" data-loc="' + L + '">' + E.LOC_LABEL[L] + '</button>'; }).join('') + '</div></div>' +
          '<div class="cck-sec"><div class="cck-lbl">DAMAGE &amp; COVER</div><div class="cck-opts">' +
          '<label class="cck-inline">dmg <input type="number" id="cck-dmg" value="' + d.total + '"></label>' +
          '<label class="cck-inline">cover SP <input type="number" id="cck-cover" value="' + (act.cover || 0) + '"></label>' +
          '<span class="cck-dmgnote">' + esc(d.spec || '') + ': ' + d.rolls.join('+') + (d.mod ? (d.mod > 0 ? '+' : '') + d.mod : '') + '</span></div></div>' +
          '<div class="cck-actions"><button class="cck-big cck-go" id="cck-apply">APPLY DAMAGE ▸</button><button class="cck-big cck-ghost" id="cck-cancel">Cancel</button></div>';
      }
      return html + '</div>';
    }
    function skillSec(sel, w) {
      // Default the skill to the one the weapon actually uses, read from the
      // sheet (e.g. firing a Rifle pulls the Rifle level, not a generic number).
      if (act.skill == null) {
        if (w) { act.skill = w.skillVal || 0; act.skillName = w.skill || ''; }
        else { var best = (sel.skills || []).filter(function (s) { return s.kind === 'melee'; })[0] || (sel.skills || [])[0]; act.skill = best ? best.val : 0; act.skillName = best ? best.name : ''; }
      }
      var skills = (sel.skills || []).slice();
      if (act.skillName && !skills.some(function (s) { return s.name === act.skillName; })) skills.unshift({ name: act.skillName, val: act.skill });
      var optsHtml = skills.map(function (s) { return '<option value="' + s.val + '"' + (act.skillName === s.name ? ' selected' : '') + '>' + esc(s.name) + ' (' + s.val + ')</option>'; }).join('');
      return '<div class="cck-sec"><div class="cck-lbl">SKILL — ' + esc(w ? w.skill : 'melee') + '</div><div class="cck-opts">' +
        (optsHtml ? '<select id="cck-skillsel">' + optsHtml + '<option value="__manual">Manual…</option></select>' : '') +
        '<label class="cck-inline">level <input type="number" id="cck-skill" value="' + (act.skill || 0) + '"></label></div></div>';
    }

    function logBar() {
      var entries = camp.combatLog().slice(-50).reverse();
      return '<details class="cbt-logbar" open><summary>LOG</summary><div class="cbt-logrows">' + entries.map(function (e) {
        var d = new Date(e.t || 0);
        return '<div class="cbt-lentry"><span class="cbt-lt">' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '</span> ' + esc(e.msg) + '</div>';
      }).join('') + '</div></details>';
    }

    /* ── top rail ── */
    function rail() {
      var m = meta(), list = combatants();
      var chips = list.map(function (c, i) {
        return '<span class="cbt-ochip' + (i === (m.turnIdx || 0) ? ' on' : '') + (c.status.dead ? ' dead' : '') + '" data-goto="' + i + '" data-osel="' + esc(c.id) + '"><b>' + (c.init == null ? '—' : c.init) + '</b> ' + esc(c.name) + '</span>';
      }).join('');
      return '<div class="cbt-rail"><span class="cbt-round">ROUND ' + (m.round || 1) + '</span>' + chips +
        '<span style="flex:1"></span>' +
        '<button class="cbt-btn" id="cbt-snap" title="Select whoever is acting">⊙ Active</button>' +
        (canAdvance() ? '<button class="cbt-btn cbt-next" id="cbt-next">NEXT TURN ▸</button>' : '') +
        (isGM() ? '<button class="cbt-btn cbt-danger" id="cbt-endcombat">END COMBAT</button>' : '') + '</div>';
    }
    function canAdvance() { return isGM() || (mode() === 'hybrid' && isMine(activeC())); }

    /* ── render ── */
    var renderTimer = null;
    function render() {
      var ae = document.activeElement;
      if (ae && root.contains(ae) && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) { clearTimeout(renderTimer); renderTimer = setTimeout(render, 900); return; }
      var m = meta();
      if (!m.active) { root.innerHTML = '<div class="cbt-over">Combat ended.</div>'; return; }
      var list = combatants();
      if (!selectedId || !get(selectedId)) { var a = activeC(); selectedId = a ? a.id : (list[0] && list[0].id); }
      var sel = selectedC();
      root.innerHTML = rail() + '<div class="cbt-body">' + listCol() +
        '<div class="cbt-stage">' + (sel ? condensedSheet(sel) + cockpit(sel) : '') + logBar() + '</div></div>';
      wire();
    }

    /* ── interactions ── */
    function wire() {
      // list selection
      root.querySelectorAll('[data-sel]').forEach(function (rowEl) {
        rowEl.onclick = function (e) {
          if (e.target.closest('[data-eye],[data-rm]')) return;
          selectedId = rowEl.getAttribute('data-sel'); act = null; render();
        };
      });
      // rail turn chips: click = select that combatant, dblclick (GM) = jump turn
      root.querySelectorAll('[data-osel]').forEach(function (ch) {
        ch.onclick = function () { selectedId = ch.getAttribute('data-osel'); render(); };
        if (isGM()) ch.ondblclick = function () { setMeta({ turnIdx: +ch.getAttribute('data-goto') }); act = null; };
      });
      var snap = root.querySelector('#cbt-snap'); if (snap) snap.onclick = function () { var a = activeC(); selectedId = a ? a.id : null; act = null; render(); };

      var next = root.querySelector('#cbt-next');
      if (next) next.onclick = advanceTurn;
      var end = root.querySelector('#cbt-endcombat');
      if (end) end.onclick = function () { if (confirm('End combat for everyone?')) { writeBackToSheets(); log('Combat ends.'); setMeta({ active: false }); } };

      // GM hover controls on list rows
      if (isGM()) {
        root.querySelectorAll('[data-eye]').forEach(function (ey) { ey.onclick = function (e) { e.stopPropagation(); var c = get(ey.getAttribute('data-eye')); c.visible = c.visible === false; put(c); }; });
        root.querySelectorAll('[data-rm]').forEach(function (rm) { rm.onclick = function (e) {
          e.stopPropagation(); var cid = rm.getAttribute('data-rm'); var c = get(cid);
          camp.removeCombatant(cid);
          var m = meta(), order = (m.order || []).filter(function (x) { return x !== cid; });
          setMeta({ order: order, turnIdx: Math.min(m.turnIdx || 0, Math.max(0, order.length - 1)) });
          if (selectedId === cid) selectedId = null;
          log((c ? c.name : cid) + ' removed from combat.');
        }; });
      }

      // condensed-sheet editing (selected combatant)
      var sel = selectedC();
      if (sel) {
        var editable = canAct(sel) || isGM();
        if (editable) {
          root.querySelectorAll('.cbt-box.ed').forEach(function (box) {
            box.onclick = function () {
              var c = get(sel.id); if (!c) return;
              var n = +box.getAttribute('data-w');
              c.wounds = (c.wounds === n) ? n - 1 : n;
              if (c.wounds === 0) { c.status.dead = false; c.status.down = false; }
              put(c); var ws = E.woundState(c.wounds); log(c.name + ' wounds → ' + c.wounds + (ws.idx >= 0 ? ' (' + ws.name + ')' : ''));
            };
          });
          root.querySelectorAll('.cbt-sp').forEach(function (inp) {
            inp.onchange = function () {
              var c = get(sel.id); if (!c) return; var L = inp.getAttribute('data-loc');
              // Editing the *current* SP sets how much armor damage it has taken.
              var want = Math.max(0, parseInt(inp.value, 10) || 0), maxSP = (c.armorSP && c.armorSP[L]) || 0;
              c.armorDmg[L] = Math.max(0, maxSP - want); put(c);
            };
          });
          root.querySelectorAll('[data-usew]').forEach(function (wp) {
            wp.onclick = function () { startWeapon(sel, wp.getAttribute('data-usew')); };
          });
        }
        if (isGM()) {
          var initEl = root.querySelector('.cs-init[data-init]');
          if (initEl) initEl.onclick = function () {
            var c = get(sel.id); if (!c) return;
            var inp = document.createElement('input'); inp.type = 'number'; inp.value = c.init || 0; inp.className = 'cs-init-in';
            initEl.replaceWith(inp); inp.focus();
            inp.onblur = inp.onchange = function () { var c2 = get(sel.id); if (!c2) return; c2.init = parseInt(inp.value, 10) || 0; put(c2); resort(); log(c2.name + ' initiative → ' + c2.init); };
          };
        }
      }

      wireCockpit(sel);
    }

    function startWeapon(sel, wid) {
      var weapon = wid === 'melee' ? null : (sel.weapons || []).filter(function (w) { return w.id === wid; })[0];
      // Melee/cyber-weapons resolve as opposed melee, not ranged.
      var melee = weapon ? (weapon.cyber || E.weaponSkillKind(weapon) === 'melee') : true;
      act = { cid: sel.id, step: 'aim', weapon: weapon, melee: melee, mods: [], fire: 'single', skill: null };
      var ts = combatants().filter(function (t) { return t.id !== sel.id && !t.status.dead; });
      if (ts[0]) act.targetId = ts[0].id;
      act.band = 'close';
      render();
    }

    function wireCockpit(sel) {
      var goa = root.querySelector('#cck-goactive'); if (goa) goa.onclick = function () { var a = activeC(); selectedId = a ? a.id : null; act = null; render(); };
      if (!sel || !canAct(sel)) return;
      var actv = activeC(); if (!actv || actv.id !== sel.id) return;

      root.querySelectorAll('[data-atk]').forEach(function (b) { b.onclick = function () { startWeapon(sel, b.getAttribute('data-atk')); }; });
      root.querySelectorAll('[data-activate]').forEach(function (b) {
        b.onclick = function () {
          var c = get(sel.id); if (!c || c.boosted) return;
          var a = (c.activatables || []).filter(function (x) { return x.id === b.getAttribute('data-activate'); })[0]; if (!a) return;
          c.boosted = true; c.init = (c.init || 0) + (a.boost || 0); put(c); resort();
          log(c.name + ' activates ' + a.name + ' — ' + a.note + '.');
        };
      });
      root.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-act'), c = get(sel.id);
          if (a === 'reload') log(c.name + ' reloads.');
          else if (a === 'move') log(c.name + ' moves (MA ' + (c.ma || 0) + ' → run ' + ((c.ma || 0) * 3) + 'm).');
          else if (a === 'stabilize') {
            var dying = combatants().filter(function (t) { return E.woundState(t.wounds).mortal >= 0 && !t.status.dead && !t.status.stabilized; })[0];
            if (!dying) { log(c.name + ' finds no one to stabilize.'); return; }
            dying.status.stabilized = true; put(dying); log(c.name + ' stabilizes ' + dying.name + '.');
          } else log(c.name + ' takes an action.');
        };
      });
      var cancel = root.querySelector('#cck-cancel'); if (cancel) cancel.onclick = function () { act = { cid: sel.id, step: 'pick' }; render(); };

      root.querySelectorAll('[data-target]').forEach(function (b) { b.onclick = function () { act.targetId = b.getAttribute('data-target'); render(); }; });
      root.querySelectorAll('[data-band]').forEach(function (b) { b.onclick = function () { act.band = b.getAttribute('data-band'); render(); }; });
      root.querySelectorAll('[data-fire]').forEach(function (b) { b.onclick = function () { act.fire = b.getAttribute('data-fire'); render(); }; });
      var rnds = root.querySelector('#cck-rounds'); if (rnds) rnds.onchange = function () { act.rounds = parseInt(rnds.value, 10) || 1; };
      var ssel = root.querySelector('#cck-skillsel'); if (ssel) ssel.onchange = function () {
        if (ssel.value === '__manual') return;
        act.skill = parseInt(ssel.value, 10) || 0; act.skillName = ssel.options[ssel.selectedIndex].text.replace(/\s*\(\d+\)$/, '');
        var si = root.querySelector('#cck-skill'); if (si) si.value = act.skill;
      };
      var skl = root.querySelector('#cck-skill'); if (skl) skl.onchange = function () { act.skill = parseInt(skl.value, 10) || 0; };
      var mdmg = root.querySelector('#cck-mdmg'); if (mdmg) mdmg.onchange = function () { act.mdmg = mdmg.value; };
      root.querySelectorAll('[data-mod]').forEach(function (cb) {
        cb.onchange = function () { act.mods = act.mods || []; var k = cb.getAttribute('data-mod'); if (cb.checked) { if (act.mods.indexOf(k) < 0) act.mods.push(k); } else act.mods = act.mods.filter(function (x) { return x !== k; }); };
      });
      root.querySelectorAll('[data-loc]').forEach(function (b) { if (b.hasAttribute('data-loc') && b.tagName === 'BUTTON') b.onclick = function () { act.loc = b.getAttribute('data-loc'); render(); }; });

      var roll = root.querySelector('#cck-roll'); if (roll) roll.onclick = function () { doRoll(sel); };
      var resolve = root.querySelector('#cck-resolve'); if (resolve) resolve.onclick = function () { doResolve(sel); };
      var apply = root.querySelector('#cck-apply'); if (apply) apply.onclick = function () { doApply(sel); };
    }

    /* ── attack resolution ── */
    function advanceTurn() {
      var m = meta(), order = m.order || [];
      var ti = ((m.turnIdx || 0) + 1) % order.length, round = m.round || 1;
      if (ti === 0) { round++; log('— Round ' + round + ' —'); }
      setMeta({ turnIdx: ti, round: round });
      act = null;
      var c = get(order[ti]);
      if (c && c.status.stunned && !c.status.dead) {
        var ws = E.woundState(c.wounds), sv = E.stunSave(c.body, ws.penalty);
        if (sv.ok) { c.status.stunned = false; put(c); log(c.name + ' recovers from stun (' + sv.die + ' ≤ ' + sv.target + ').'); }
        else log(c.name + ' stays stunned (' + sv.die + ' > ' + sv.target + ').');
      }
      selectedId = order[ti]; // follow the new active when YOU advanced
    }
    // Wound penalty auto-applied to action REF (CP2020: Serious −2; Critical ½; Mortal ⅓).
    function woundRef(c) {
      var idx = E.woundState(c.wounds || 0).idx, r = c.ref || 0;
      if (idx === 1) r -= 2; else if (idx === 2) r = Math.floor(r / 2); else if (idx >= 3) r = Math.floor(r / 3);
      return Math.max(0, r);
    }
    function doRoll(c) {
      if (!act.targetId) { var t0 = combatants().filter(function (t) { return t.id !== c.id && !t.status.dead; })[0]; if (!t0) return; act.targetId = t0.id; }
      var modObjs = E.MODIFIERS.filter(function (m) { return (act.mods || []).indexOf(m.key) >= 0; });
      if (act.weapon && !act.melee) {
        var extra = 0;
        if (act.fire === 'burst' && (act.band === 'close' || act.band === 'medium')) extra += 3;
        if (act.fire === 'auto') extra += E.fullAutoMod(act.rounds || 10, act.band || 'close');
        // cyberware aids: smartgun link +2, targeting scope +1 (ranged only)
        if (c.cyberFx && c.cyberFx.smartgun) extra += 2;
        if (c.cyberFx && c.cyberFx.scope) extra += 1;
        act.tohit = E.rangedAttack({ ref: woundRef(c), skill: act.skill || 0, wmod: (act.weapon.wa || 0) + extra, band: act.band || 'close', mods: modObjs });
      } else {
        var t = get(act.targetId);
        var mm = E.meleeAttack({ ref: woundRef(c), skill: act.skill || 0, mod: modObjs.reduce(function (s, x) { return s + x.mod; }, 0) }, { ref: t ? woundRef(t) : 0, skill: 0 });
        act.tohit = { total: mm.attacker.total, roll: mm.attacker.roll, def: mm.defender.total, hit: mm.hit, fumble: mm.fumble };
      }
      act.step = 'tohit'; render();
    }
    function doResolve(c) {
      var totEl = root.querySelector('#cck-th-total');
      var total = totEl ? parseInt(totEl.value, 10) || 0 : act.tohit.total;
      var tn = act.tohit.tn != null ? act.tohit.tn : act.tohit.def;
      var t = get(act.targetId), hit = !act.tohit.fumble && total > tn;
      if (act.weapon && !act.melee && act.weapon.ammoMax > 0) {
        var spent = act.fire === 'auto' ? (act.rounds || 10) : act.fire === 'burst' ? 3 : 1;
        var cc = get(c.id); cc.weapons = (cc.weapons || []).map(function (w) { if (w.id === act.weapon.id) w.ammo = Math.max(0, (w.ammo || 0) - spent); return w; }); put(cc);
      }
      if (!hit) { log(c.name + (act.weapon ? ' fires ' + act.weapon.name + ' at ' : ' attacks ') + (t ? t.name : '?') + ' — MISS (' + total + ' vs ' + tn + ').'); act = { cid: c.id, step: 'pick' }; render(); return; }
      var hits = 1;
      if (act.fire === 'burst') hits = E.burstHits();
      if (act.fire === 'auto') hits = E.fullAutoHits(total - tn, act.rounds || 10);
      act.hits = Math.max(1, hits);
      act.loc = E.rollLocation().loc;
      act.dmg = E.rollDamage(act.weapon ? act.weapon.damage : (act.mdmg || '1d6'));
      act.step = 'damage';
      log(c.name + (act.weapon ? ' hits with ' + act.weapon.name : ' lands a hit') + ' on ' + (t ? t.name : '?') + ' (' + total + ' vs ' + tn + (act.hits > 1 ? ', ×' + act.hits : '') + ').');
      render();
    }
    function doApply(c) {
      var t = get(act.targetId); if (!t) { act = { cid: c.id, step: 'pick' }; render(); return; }
      var loc = act.loc;
      var dmgEl = root.querySelector('#cck-dmg'); var dmgv = dmgEl ? parseInt(dmgEl.value, 10) || 0 : act.dmg.total;
      var covEl = root.querySelector('#cck-cover'); var cover = covEl ? parseInt(covEl.value, 10) || 0 : 0;
      var hits = act.hits || 1;
      for (var h = 0; h < hits; h++) {
        var hloc = h === 0 ? loc : E.rollLocation().loc;
        var hdmg = h === 0 ? dmgv : E.rollDamage(act.weapon ? act.weapon.damage : (act.mdmg || '1d6')).total;
        var isCyber = t.cyber && t.cyber[hloc] != null && t.cyber[hloc] > 0;
        var effSP = E.effectiveSP(t, hloc);
        var res = E.resolveDamage({ raw: hdmg, sp: effSP, cover: cover, loc: hloc, btm: t.btm, cyberlimb: isCyber });
        if (res.stopped) { log('  ▸ ' + E.LOC_LABEL[hloc] + ': armor stops it (' + hdmg + ' vs SP ' + (effSP + cover) + ').'); if (effSP > 0) t.armorDmg[hloc] = (t.armorDmg[hloc] || 0) + 1; continue; }
        if (res.ablate && effSP > 0) t.armorDmg[hloc] = (t.armorDmg[hloc] || 0) + 1; // armor takes 1 AP of ablation
        if (isCyber) { t.cyber[hloc] = Math.max(0, t.cyber[hloc] - res.wound); log('  ▸ ' + E.LOC_LABEL[hloc] + ' (cyber): ' + res.wound + ' SDP — ' + t.cyber[hloc] + ' left.'); }
        else {
          t.wounds = Math.min(E.MAX_WOUNDS, (t.wounds || 0) + res.wound);
          var ws = E.woundState(t.wounds);
          log('  ▸ ' + E.LOC_LABEL[hloc] + ': ' + res.wound + ' wound' + (res.wound > 1 ? 's' : '') + (res.headDoubled ? ' (head ×2)' : '') + ' → ' + ws.name + '.');
          if (res.limbEvent === 'severed') { log('  ▸ ' + t.name + "'s " + E.LOC_LABEL[hloc] + ' is destroyed!'); if (ws.mortal < 0) t.wounds = Math.max(t.wounds, 13); }
          if (res.limbEvent === 'headshot') log('  ▸ Devastating head wound!');
          if (t.cyberFx && t.cyberFx.painEditor) { log('  ▸ ' + t.name + ' shrugs it off (Pain Editor — no stun).'); }
          else { var sv = E.stunSave(t.body, ws.penalty);
            if (!sv.ok) { t.status.stunned = true; t.status.down = true; log('  ▸ ' + t.name + ' fails stun save (' + sv.die + ' > ' + sv.target + ') — DOWN.'); } }
          if (ws.mortal >= 0 && !t.status.stabilized) {
            var dsv = E.deathSave(t.body, ws.mortal);
            if (!dsv.ok) { t.status.dead = true; log('  ▸ ' + t.name + ' fails death save (' + dsv.die + ' > ' + dsv.target + ') — DEAD.'); }
            else log('  ▸ ' + t.name + ' clings to life (death save ' + dsv.die + ' ≤ ' + dsv.target + ').');
          }
        }
      }
      put(t); act = { cid: c.id, step: 'pick' }; render();
    }

    function resort() {
      var list = camp.allCombatants().slice().sort(function (a, b) { return (b.init || 0) - (a.init || 0); });
      setMeta({ order: list.map(function (x) { return x.id; }) });
    }

    // Persistence: write spent ammo, armor ablation and wounds back onto each PC's
    // live sheet so they carry past the fight. GM-authoritative (runs on End).
    function writeBackToSheets() {
      if (!isGM() || !camp.getSheet || !camp.publishSheet) return;
      combatants().forEach(function (c) {
        if (c.kind !== 'pc' || !c.sheetId) return;
        var rec = camp.getSheet(c.sheetId); if (!rec || !rec.json) return;
        var json = rec.json;
        // ammo by weapon uid
        if (Array.isArray(json.weapons)) (c.weapons || []).forEach(function (w) {
          if (!w.uid) return;
          var sw = json.weapons.filter(function (x) { return x && x.uid === w.uid; })[0];
          if (sw) sw.currentAmmo = w.ammo;
        });
        // wounds + armor ablation + status persisted under a `combat` block
        json.combat = { wounds: c.wounds, armorDmg: c.armorDmg, status: c.status, ts: Date.now() };
        try { camp.publishSheet(c.sheetId, json.handle || json.name || c.name, json); } catch (e) {}
      });
    }

    /* ── subscriptions ── */
    loadSkillStats().then(function () { render(); }); // re-render once skills→stat map is ready
    unsubs.push(camp.onCombatChange(function () { clearTimeout(renderTimer); renderTimer = setTimeout(render, 60); }));
    unsubs.push(camp.onCombatLog(function () { clearTimeout(renderTimer); renderTimer = setTimeout(render, 60); }));
    render();

    return {
      destroy: function () { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); clearTimeout(renderTimer); if (root.parentNode) root.parentNode.removeChild(root); },
      render: render, resort: resort,
    };
  }

  window.CombatUI = { mount: mount };
})();
