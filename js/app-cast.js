/* app-cast.js — the CAST section.
   Sidebar: folder groups + cast-views + clocks, each row with a ▶ Play button
   (immediate broadcast — always live). Main frame tabs host the composer.
   A cast-view is a doc in casts/ with three natures:
     · free    — block composition (image/text blocks, template seeds)
     · entity  — linked {type,id} + field selector; resolved AT CAST TIME
                 (live-updating), over-editable via extraBlocks
     · (clocks are their own docs in clocks/, castable & updatable)
   Depends on App, Store, Links, Shell (+ bridge: castReveal, clockViz, logSession). */
(function () {
  'use strict';
  var App = window.App, Store = window.Store;

  function br() { return (window.Shell && Shell.bridge()) || {}; }
  function esc(s) { return App.esc(s); }
  function isPlayer() { return (br().sess || {}).role !== 'gm'; }

  /* block helpers (same shapes as the legacy event model) */
  function blImg(src, size, cam, align) { return { id: App.uid('bl'), type: 'image', src: src || '', cam: cam || '', size: size || 'm', align: align || 'center' }; }
  function blTxt(t, mode, size, speaker) { return { id: App.uid('bl'), type: 'text', text: t || '', mode: mode || 'panel', size: size || 'l', speaker: speaker || '', align: 'center' }; }
  var TEMPLATES = [
    { k: 'imagetext', label: 'Image + dialogue', make: function () { return [blImg('', 'l'), blTxt('', 'dialogue', 'l')]; } },
    { k: 'call', label: 'Incoming call', make: function () { return [blImg('', 'l', 'CAM 03 ● LIVE'), blImg('', 's', 'ID ● CALLER', 'left'), blTxt('', 'dialogue', 'l', 'INCOMING CALL')]; } },
    { k: 'dossier', label: 'Dossier', make: function () { return [blImg('', 'l', 'ID ● FILE', 'left'), blTxt('', 'panel', 'l')]; } },
    { k: 'fullimage', label: 'Full image', make: function () { return [blImg('', 'full')]; } },
    { k: 'textonly', label: 'Text panel', make: function () { return [blTxt('', 'panel', 'xl')]; } },
  ];
  var ENTITY_FIELDS = [
    ['photo', 'Photo / logo'], ['name', 'Name'], ['role', 'Role / type'], ['notes', 'Notes'],
  ];

  /* ── build the reveal (async: entity nature resolves fresh) ── */
  function buildReveal(doc) {
    if (doc.nature === 'entity' && doc.ref) {
      return Store.resolve(doc.ref).then(function (hit) {
        var blocks = [];
        var fields = doc.fields || ['photo', 'name', 'role'];
        if (hit) {
          var j = hit.json;
          if (fields.indexOf('photo') >= 0 && (j.photo || j.logo)) blocks.push(blImg(j.photo || j.logo, 'l', 'ID ● FILE', 'left'));
          var lines = [];
          if (fields.indexOf('name') >= 0) lines.push((Store.displayName(hit) || '').toUpperCase());
          if (fields.indexOf('role') >= 0 && (j.role || j.type)) lines.push(j.role || j.type);
          if (fields.indexOf('notes') >= 0 && (j.desc || j.notes)) lines.push('', j.desc || j.notes);
          if (lines.length) blocks.push(blTxt(lines.join('\n'), 'panel', 'l'));
        }
        (doc.extraBlocks || []).forEach(function (b) { blocks.push(b); });
        return { kind: 'event', title: doc.name || '', blocks: blocks };
      });
    }
    return Promise.resolve({ kind: 'event', title: doc.name || '', blocks: doc.blocks || [] });
  }
  function clockReveal(k) {
    return { kind: 'event', title: k.name || 'Clock', blocks: [blTxt((k.name || 'CLOCK').toUpperCase() + '\n\n' + (k.value || 0) + ' / ' + (k.max || 6), 'panel', 'xl')] };
  }
  function play(doc) {
    buildReveal(doc).then(function (rev) {
      var b = br();
      if (b.castReveal) b.castReveal(rev);
    });
    if (window.CastRules) CastRules.emit({ src: 'cast.played', castId: doc.id });   // reactive: playing a cast can trigger rules
  }
  function playClock(k) { var b = br(); if (b.castReveal) b.castReveal(clockReveal(k)); }

  /* ═══ REACTIVE ENGINE — chained triggers (docs/cast-triggers-design.md) ═══
     A rule = {id,name,enabled,when,then[],once,firedAt}. A watched-state change
     (a clock crosses a threshold / fills / empties; a cast-view is played; manual)
     evaluates the rules. AUTO effects (clock.advance/set, log) apply at once and
     re-enter the engine → cascade. ARMED effects (cast.play, reveal.clock,
     loot.grant) are queued to the pending-list and wait for a GM ▶ — table-first:
     the engine never broadcasts to players on its own. Termination: a rule fires
     at most once per cascade (visited-set) + `once` across cascades + a step cap. */
  var Rules = (function () {
    var MAX_STEPS = 64;   // backstop; the per-cascade visited-set is the real guarantee
    var _pending = [];
    var _cascade = null;

    function refreshPending() { refreshSide(); }
    function loadState() {
      return Promise.all([Store.index('rule'), Store.index('clock')]).then(function (res) {
        return { ruleRows: res[0], clockRows: res[1] };
      });
    }
    function clockById(state, id) { return state.clockRows.filter(function (r) { return r.json.id === id; })[0] || null; }
    function evPlayer(k) { return (k && k.props && k.props.player) || null; }
    function crossEvent(k, before, after) { return { src: 'clock.cross', clockId: k.id, dir: after > before ? 'up' : 'down', from: before, to: after, player: evPlayer(k) }; }
    function logLine(msg) { var b = br(); if (b.logSession) b.logSession(msg); }

    // when → event matching. Clock selector = concrete {clockId} or templated {clockKind}.
    function selMatch(when, ev, state) {
      if (when.clockKind) { var k = clockById(state, ev.clockId); return !!(k && (k.json.props || {}).kind === when.clockKind); }
      if (when.clockId) return when.clockId === ev.clockId;
      return true;
    }
    function matches(rule, ev, state) {
      var w = rule.when || {};
      if (w.src !== ev.src) return false;
      if (ev.src === 'clock.cross') {
        if (w.dir && w.dir !== ev.dir) return false;
        if (!selMatch(w, ev, state)) return false;
        if (w.threshold == null) return true;
        return w.dir === 'down' ? (ev.from >= w.threshold && ev.to < w.threshold) : (ev.from < w.threshold && ev.to >= w.threshold);
      }
      if (ev.src === 'clock.full' || ev.src === 'clock.empty') return selMatch(w, ev, state);
      if (ev.src === 'cast.played') return !w.castId || w.castId === ev.castId;
      if (ev.src === 'manual') return w.ruleId ? w.ruleId === ev.ruleId : (ev.ruleId === rule.id);
      return false;
    }
    // effect target: concrete {clockId} or templated {clockKind, player:'$trigger'} → same-player clock.
    function targetClock(fx, ev, state) {
      if (fx.clockId) return clockById(state, fx.clockId);
      if (fx.clockKind) {
        var player = fx.player === '$trigger' ? ev.player : fx.player;
        if (fx.player === '$trigger' && !player) return null;
        return state.clockRows.filter(function (r) { var p = r.json.props || {}; return p.kind === fx.clockKind && (!player || p.player === player); })[0] || null;
      }
      return null;
    }

    function changeClock(kind, fx, rule, ev, c) {
      var row = targetClock(fx, ev, c.state);
      if (!row) { logLine('⚠ ' + (rule.name || 'rule') + ' — clock cible introuvable'); return Promise.resolve(); }
      var k = row.json, before = k.value || 0, max = k.max || 6, after;
      if (kind === 'advance') after = before + (parseInt(fx.by, 10) || 1); else after = (parseInt(fx.value, 10) || 0);
      after = Math.max(0, Math.min(max, after));
      if (after === before) return Promise.resolve();
      k.value = after;
      c.queue.push(crossEvent(k, before, after));   // re-enter the engine → cascade
      if (after >= max) c.queue.push({ src: 'clock.full', clockId: k.id, player: evPlayer(k) });
      if (after <= 0) c.queue.push({ src: 'clock.empty', clockId: k.id, player: evPlayer(k) });
      return Store.put(row.ref, k).then(function () { refreshSide(); }).catch(function () {});
    }
    function arm(item) { item.id = App.uid('pend'); _pending.push(item); }
    function applyEffect(fx, rule, ev, c) {
      switch (fx.fx) {
        case 'log': logLine(fx.text || ('⚙ ' + (rule.name || 'rule'))); return Promise.resolve();
        case 'clock.advance': return changeClock('advance', fx, rule, ev, c);
        case 'clock.set': return changeClock('set', fx, rule, ev, c);
        case 'cast.play': arm({ kind: 'cast', castId: fx.castId, rule: rule.name, label: '▸ ' + (rule.name || 'reveal') }); return Promise.resolve();
        case 'reveal.clock': { var t = targetClock(fx, ev, c.state); arm({ kind: 'clock', clockId: t ? t.json.id : fx.clockId, rule: rule.name, label: '◔ ' + (rule.name || 'clock') }); return Promise.resolve(); }
        case 'loot.grant': arm({ kind: 'loot', lootId: fx.lootId, rule: rule.name, label: '⛃ ' + (rule.name || 'loot') }); return Promise.resolve();
        default: return Promise.resolve();
      }
    }
    function applyRule(row, ev, c) {
      var rule = row.json;
      if (c.visited[rule.id]) return Promise.resolve();
      if (rule.once && rule.firedAt) return Promise.resolve();
      c.visited[rule.id] = true;
      rule.firedAt = Date.now();
      logLine('▸ règle « ' + (rule.name || 'rule') + ' »');
      var chain = Store.put(row.ref, rule).catch(function () {});
      (rule.then || []).forEach(function (fx) { chain = chain.then(function () { return applyEffect(fx, rule, ev, c); }); });
      return chain;
    }
    function step(c) {
      if (!c.queue.length) return Promise.resolve();
      if (c.steps++ >= MAX_STEPS) { logLine('⚠ cascade de déclencheurs plafonnée à ' + MAX_STEPS + ' étapes'); return Promise.resolve(); }
      var ev = c.queue.shift();
      var fired = c.state.ruleRows.filter(function (r) { return r.json && r.json.enabled !== false && matches(r.json, ev, c.state); });
      var chain = Promise.resolve();
      fired.forEach(function (r) { chain = chain.then(function () { return applyRule(r, ev, c); }); });
      return chain.then(function () { return step(c); });
    }
    function runCascade(events, seed) {
      return loadState().then(function (state) {
        var c = { queue: events.slice(), visited: {}, steps: 0, state: state };
        _cascade = c;
        var start = seed ? seed(c) : Promise.resolve();
        return start.then(function () { return step(c); }).then(function () { _cascade = null; refreshPending(); }, function (e) { _cascade = null; throw e; });
      });
    }
    function emitMany(events) {
      if (isPlayer()) return Promise.resolve();               // engine is GM-side only
      if (_cascade) { Array.prototype.push.apply(_cascade.queue, events); return Promise.resolve(); }
      return runCascade(events);
    }
    function emit(ev) { return emitMany([ev]); }
    function emitClockChange(k, before, after) {
      if (before === after) return Promise.resolve();
      var evs = [crossEvent(k, before, after)], max = k.max || 6;
      if (after >= max) evs.push({ src: 'clock.full', clockId: k.id, player: evPlayer(k) });
      if (after <= 0) evs.push({ src: 'clock.empty', clockId: k.id, player: evPlayer(k) });
      return emitMany(evs);
    }
    // Manual fire runs a rule's effects directly (bypasses when-matching) so the GM can test any rule.
    function fireManual(ruleId) {
      if (isPlayer() || _cascade) return Promise.resolve();
      return runCascade([], function (c) {
        var row = c.state.ruleRows.filter(function (r) { return r.json.id === ruleId; })[0];
        return row ? applyRule(row, { src: 'manual', ruleId: ruleId, player: null }, c) : Promise.resolve();
      });
    }
    function confirm(pid) {
      var item = _pending.filter(function (p) { return p.id === pid; })[0]; if (!item) return;
      _pending = _pending.filter(function (p) { return p.id !== pid; });
      if (item.kind === 'cast') Store.resolve({ type: 'cast', id: item.castId }).then(function (h) { if (h) play(h.json); });
      else if (item.kind === 'clock') Store.resolve({ type: 'clock', id: item.clockId }).then(function (h) { if (h) playClock(h.json); });
      else if (item.kind === 'loot') { var b = br(); if (b.grantLoot) b.grantLoot(item.lootId); else logLine('⚠ loot.grant non branché (' + (item.lootId || '?') + ')'); }
      refreshPending();
    }
    function dismiss(pid) { _pending = _pending.filter(function (p) { return p.id !== pid; }); refreshPending(); }
    function resetFired() {
      return Store.index('rule').then(function (rows) {
        return Promise.all(rows.map(function (r) { if (r.json.firedAt) { r.json.firedAt = null; return Store.put(r.ref, r.json).catch(function () {}); } return null; }));
      }).then(function () { refreshSide(); });
    }
    return { emit: emit, emitClockChange: emitClockChange, fireManual: fireManual, pending: function () { return _pending; }, confirm: confirm, dismiss: dismiss, resetFired: resetFired };
  })();
  window.CastRules = Rules;

  /* ═══ SIDEBAR ═══ */
  function renderSide(host) {
    if (isPlayer()) return renderSidePlayer(host);
    Promise.all([Store.index('cast'), Store.index('clock'), Store.index('rule')]).then(function (res) {
      var casts = res[0], clocks = res[1], rules = res[2];
      var folders = {};
      casts.forEach(function (r) { var f = r.json.folder || ''; (folders[f] = folders[f] || []).push(r); });
      var html = '<div class="dt-side">';
      var pend = Rules.pending();
      if (pend.length) {
        html += '<div class="dt-head">ARMED — CONFIRM ▶</div>';
        html += pend.map(function (p) {
          return '<div class="dt-node ca-row"><span class="dt-l">' + esc(p.label || p.rule || p.kind) + '</span>' +
            '<button class="ca-play" data-pendok="' + esc(p.id) + '" title="Broadcast now">▶</button>' +
            '<button class="dt-x" data-penddismiss="' + esc(p.id) + '" title="Dismiss">✕</button></div>';
        }).join('');
      }
      html += '<div class="dt-head">CAST-VIEWS</div>';
      Object.keys(folders).sort().forEach(function (f) {
        if (f) html += '<div class="ca-folder">▾ ' + esc(f) + '</div>';
        html += folders[f].map(function (r) {
          // no icon column (DS: typography over pictograms) — entity-bound
          // reveals are tagged "live" since they re-resolve at cast time
          return '<div class="dt-node ca-row" data-cast="' + esc(r.json.id) + '"><span class="dt-l">' + esc(r.json.name || 'Reveal') + '</span>' +
            (r.json.nature === 'entity' ? '<span class="dt-n">live</span>' : '') +
            '<button class="ca-play" data-play="' + esc(r.json.id) + '" title="Cast to players">▶</button></div>';
        }).join('');
      });
      html += '<div class="dt-node dt-newview" data-newcast><span class="dt-l dt-dim">+ new cast-view</span></div>';
      function clockRow(r) {
        var k = r.json;
        return '<div class="dt-node ca-row" data-clock="' + esc(k.id) + '"><span class="dt-l">' + esc(k.name || 'Clock') + '</span>' +
          '<span class="dt-n">' + (k.value || 0) + '/' + (k.max || 6) + (k.props && k.props.public ? ' · public' : '') + '</span>' +
          '<button class="ca-play" data-playclock="' + esc(k.id) + '" title="Cast">▶</button></div>';
      }
      // Narrative clocks vs heat/trace (per-player, tagged props.kind) — grouped apart in the rail.
      var narrClk = clocks.filter(function (r) { return !((r.json.props || {}).kind); });
      var heatClk = clocks.filter(function (r) { return (r.json.props || {}).kind; });
      html += '<div class="dt-head dt-head-mt">CLOCKS</div>';
      html += narrClk.map(clockRow).join('');
      html += '<div class="dt-node dt-newview" data-newclock><span class="dt-l dt-dim">+ new clock</span></div>';
      if (heatClk.length) html += '<div class="dt-head dt-head-mt">HEAT / TRACE</div>' + heatClk.map(clockRow).join('');
      html += '<div class="dt-head dt-head-mt">RULES</div>';
      html += rules.map(function (r) {
        var ru = r.json, badge = ru.enabled === false ? 'off' : (ru.firedAt ? 'fired' : 'ready');
        return '<div class="dt-node ca-row" data-rule="' + esc(ru.id) + '"><span class="dt-l">' + esc(ru.name || 'Rule') + '</span>' +
          '<span class="dt-n">' + badge + '</span>' +
          '<button class="ca-play" data-firerule="' + esc(ru.id) + '" title="Fire now">▶</button></div>';
      }).join('');
      html += '<div class="dt-node dt-newview" data-newrule><span class="dt-l dt-dim">+ new rule</span></div>';
      html += '<div class="dt-node dt-newview" data-resetfired><span class="dt-l dt-dim">↺ reset fired-state</span></div>';
      html += '</div>';
      host.innerHTML = html;

      host.querySelectorAll('[data-cast]').forEach(function (d) {
        d.onclick = function (e) { if (e.target.hasAttribute('data-play')) return; markActive(host, d); showDetail(host, 'cast', d.getAttribute('data-cast')); };
        if (window.CtxMenu) CtxMenu.attach(d, function () { return castMenu(casts.filter(function (r) { return r.json.id === d.getAttribute('data-cast'); })[0]); });
      });
      host.querySelectorAll('[data-play]').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var r = casts.filter(function (x) { return x.json.id === b.getAttribute('data-play'); })[0];
          if (r) { play(r.json); b.textContent = '✓'; setTimeout(function () { b.textContent = '▶'; }, 900); }
        };
      });
      host.querySelectorAll('[data-clock]').forEach(function (d) {
        d.onclick = function (e) { if (e.target.hasAttribute('data-playclock')) return; markActive(host, d); showDetail(host, 'clock', d.getAttribute('data-clock')); };
      });
      host.querySelectorAll('[data-playclock]').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var r = clocks.filter(function (x) { return x.json.id === b.getAttribute('data-playclock'); })[0];
          if (r) { playClock(r.json); b.textContent = '✓'; setTimeout(function () { b.textContent = '▶'; }, 900); }
        };
      });
      host.querySelectorAll('[data-rule]').forEach(function (d) {
        d.onclick = function (e) { if (e.target.hasAttribute('data-firerule')) return; markActive(host, d); showDetail(host, 'rule', d.getAttribute('data-rule')); };
      });
      host.querySelectorAll('[data-firerule]').forEach(function (b) {
        b.onclick = function (e) { e.stopPropagation(); Rules.fireManual(b.getAttribute('data-firerule')); b.textContent = '✓'; setTimeout(function () { b.textContent = '▶'; }, 900); };
      });
      host.querySelectorAll('[data-pendok]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); Rules.confirm(b.getAttribute('data-pendok')); }; });
      host.querySelectorAll('[data-penddismiss]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); Rules.dismiss(b.getAttribute('data-penddismiss')); }; });
      var nrule = host.querySelector('[data-newrule]'); if (nrule) nrule.onclick = newRule;
      var rfire = host.querySelector('[data-resetfired]'); if (rfire) rfire.onclick = function () { Rules.resetFired(); };
      var nc = host.querySelector('[data-newcast]'); if (nc) nc.onclick = newCastFlow;
      var nk = host.querySelector('[data-newclock]'); if (nk) nk.onclick = newClock;
    });
  }
  function renderSidePlayer(host) {
    Store.index('clock').then(function (clocks) {
      var pub = clocks.filter(function (r) { return r.json.props && r.json.props.public; });
      host.innerHTML = '<div class="dt-side"><div class="dt-head">CLOCKS</div>' +
        (pub.map(function (r) {
          return '<div class="dt-node"><span class="dt-l">' + esc(r.json.name) + '</span><span class="dt-n">' + (r.json.value || 0) + '/' + (r.json.max || 6) + '</span></div>';
        }).join('') || '<div class="dt-node dt-dim" style="cursor:default">nothing public yet</div>') + '</div>';
    });
  }
  function castMenu(row) {
    if (!row) return [];
    return [
      { label: 'Open', icon: '▸', onClick: function () { openInline('cast', row.json.id); } },
      { label: 'Cast', icon: '▶', onClick: function () { play(row.json); } },
      { label: 'Move to group…', icon: '▤', onClick: function () {
        App.prompt('Move to group', 'Group name (empty = root)', row.json.folder || '', function (f) {
          row.json.folder = (f || '').trim();
          Store.put(row.ref, row.json).then(refreshSide);
        });
      } },
      { sep: true },
      { label: 'Delete', icon: '✕', danger: true, onClick: function () { Store.del(row.ref).then(refreshSide); } },
    ];
  }
  function refreshSide() { document.querySelectorAll('.ca-rail').forEach(function (s) { renderSide(s); }); }
  App.on('entity:saved', function (e) { if (e && (e.type === 'cast' || e.type === 'clock' || e.type === 'rule')) refreshSide(); });

  function openCastTab(id) { Shell.openEntity('cast', id, null); }
  function openClockTab(id) { Shell.openEntity('clock', id, null); }
  // Open an entity in the master-detail pane (rail stays put) instead of a full
  // shell tab — the CAST sidebar is always visible. Falls back to a tab only if
  // no rail is mounted (e.g. deep-linked from search).
  function openInline(kind, id) {
    var rail = document.querySelector('.ca-rail');
    if (rail) showDetail(rail, kind, id);
    else if (window.Shell) Shell.openEntity(kind, id, null);
  }
  /* Master-detail: clicking a rail item renders its editor in the pane's main
     area (the rail stays put, so you can pick another / go back). */
  function markActive(rail, node) { rail.querySelectorAll('.ca-row.ca-active').forEach(function (r) { r.classList.remove('ca-active'); }); if (node) node.classList.add('ca-active'); }
  function showDetail(rail, kind, id) {
    var pane = rail.parentNode, main = pane && pane.querySelector('.ca-main'); if (!main) return;
    main.innerHTML = '<div class="ca-detail"></div>';
    renderEditor({ kind: kind, ref: id }, main.querySelector('.ca-detail'));
  }

  /* ── creation flows ── */
  function newCastFlow() {
    if (!window.UI) return;
    UI.modal({
      title: 'New cast-view',
      body: '<div class="dt-newchoice">' +
        '<button class="dt-choice" data-c="free"><b>Free composition</b><span>Images & text, block layout.</span></button>' +
        '<button class="dt-choice" data-c="entity"><b>From a record</b><span>Linked to an NPC, org, place… — always up to date.</span></button></div>',
      actions: [{ label: 'Cancel' }],
      onShow: function (box) {
        box.querySelector('[data-c="free"]').onclick = function () {
          UI.close();
          Store.create('cast', { name: 'New reveal', nature: 'free', folder: '', blocks: TEMPLATES[0].make(), props: {} })
            .then(function (made) { refreshSide(); openInline('cast', made.json.id); });
        };
        box.querySelector('[data-c="entity"]').onclick = function () {
          UI.close();
          entityPicker(function (ref, name) {
            Store.create('cast', { name: name, nature: 'entity', folder: '', ref: ref, fields: ['photo', 'name', 'role'], extraBlocks: [], props: {} })
              .then(function (made) { refreshSide(); openInline('cast', made.json.id); });
          });
        };
      }
    });
  }
  function entityPicker(done) {
    UI.modal({
      title: 'Pick a record',
      body: '<input class="rt-input" id="ep-q" placeholder="search…" autocomplete="off"><div id="ep-res" class="lk-picker-res"></div>',
      actions: [{ label: 'Cancel' }],
      onShow: function (box) {
        var all = [];
        Promise.all(['npc', 'org', 'location', 'item'].map(function (t) {
          return Store.index(t).then(function (rows) { rows.forEach(function (r) { if (r.json.id) all.push({ ref: r.ref, name: Store.displayName(r), t: t }); }); }).catch(function () {});
        })).then(function () { paint(''); });
        function paint(f) {
          f = f.toLowerCase();
          var hits = all.filter(function (e) { return !f || e.name.toLowerCase().indexOf(f) >= 0; }).slice(0, 30);
          box.querySelector('#ep-res').innerHTML = hits.map(function (e, i) { return '<button class="lk-picker-row" data-i="' + i + '">' + esc(e.name) + ' <small>' + e.t + '</small></button>'; }).join('');
          box.querySelectorAll('[data-i]').forEach(function (b) {
            b.onclick = function () { var e = hits[+b.getAttribute('data-i')]; UI.close(); done(e.ref, e.name); };
          });
        }
        box.querySelector('#ep-q').oninput = function (e) { paint(e.target.value); };
        box.querySelector('#ep-q').focus();
      }
    });
  }
  function newClock() {
    Store.create('clock', { name: 'New clock', max: 6, value: 0, color: '#b8860b', style: 'pie', props: { public: false } })
      .then(function (made) { refreshSide(); openInline('clock', made.json.id); });
  }
  function newRule() {
    Store.create('rule', { name: 'New rule', enabled: true, when: { src: 'clock.cross', dir: 'up' }, then: [], once: false, firedAt: null })
      .then(function (made) { refreshSide(); openInline('rule', made.json.id); });
  }

  /* — rule editor (when → then). Clock selectors carry a concrete id OR a templated
       kind (any heat/trace clock of the same player: player:'$trigger'). — */
  var WHEN_SRC = [['clock.cross', 'clock crosses threshold'], ['clock.full', 'clock fills'], ['clock.empty', 'clock empties'], ['cast.played', 'cast-view played'], ['manual', 'manual only']];
  var FX_KINDS = [['cast.play', 'play cast-view (armed)'], ['reveal.clock', 'reveal clock (armed)'], ['clock.advance', 'advance clock'], ['clock.set', 'set clock'], ['loot.grant', 'grant loot (armed)'], ['log', 'log line']];
  function clockOptions(clocks, sel) {
    var cur = sel && sel.clockId ? 'id:' + sel.clockId : (sel && sel.clockKind ? 'kind:' + sel.clockKind : '');
    var opts = '<option value=""' + (cur === '' ? ' selected' : '') + '>— none —</option>';
    opts += clocks.map(function (r) { var v = 'id:' + r.json.id; return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(r.json.name || 'Clock') + '</option>'; }).join('');
    ['heat', 'trace'].forEach(function (kd) { var v = 'kind:' + kd; opts += '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>any ' + kd.toUpperCase() + ' (same player)</option>'; });
    return opts;
  }
  function parseClockSel(v) { if (!v) return {}; if (v.indexOf('id:') === 0) return { clockId: v.slice(3) }; if (v.indexOf('kind:') === 0) return { clockKind: v.slice(5), player: '$trigger' }; return {}; }
  function castOptionsHtml(casts, selId) { return '<option value="">— none —</option>' + casts.map(function (r) { return '<option value="' + esc(r.json.id) + '"' + (selId === r.json.id ? ' selected' : '') + '>' + esc(r.json.name || 'Reveal') + '</option>'; }).join(''); }
  function renderRuleEditor(body, ref, hit) {
    var ru = hit.json;
    ru.when = ru.when || { src: 'clock.cross', dir: 'up' };
    ru.then = ru.then || [];
    function poke() { schedule(ref, ru, refreshSide); }
    Promise.all([Store.index('cast'), Store.index('clock')]).then(function (res) { draw(res[0], res[1]); });

    function fxRow(fx, i, casts, clocks) {
      var head = '<select data-fxk="' + i + '">' + FX_KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (fx.fx === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select><button class="dt-x" data-fxrm="' + i + '">✕</button>';
      var params = '';
      if (fx.fx === 'cast.play') params = '<select data-fxcast="' + i + '">' + castOptionsHtml(casts, fx.castId) + '</select>';
      else if (fx.fx === 'reveal.clock' || fx.fx === 'clock.advance' || fx.fx === 'clock.set') {
        params = '<select data-fxclk="' + i + '">' + clockOptions(clocks, fx) + '</select>';
        if (fx.fx === 'clock.advance') params += '<input type="number" data-fxby="' + i + '" value="' + (fx.by != null ? fx.by : 1) + '" style="width:56px" title="by">';
        if (fx.fx === 'clock.set') params += '<input type="number" data-fxval="' + i + '" value="' + (fx.value != null ? fx.value : 0) + '" style="width:56px" title="value">';
      } else if (fx.fx === 'loot.grant') params = '<input data-fxloot="' + i + '" value="' + esc(fx.lootId || '') + '" placeholder="loot id">';
      else if (fx.fx === 'log') params = '<input data-fxtext="' + i + '" value="' + esc(fx.text || '') + '" placeholder="log text">';
      return '<div class="ru-fx">' + head + ' ' + params + '</div>';
    }
    function draw(casts, clocks) {
      var w = ru.when;
      var clockSrc = (w.src === 'clock.cross' || w.src === 'clock.full' || w.src === 'clock.empty');
      body.innerHTML = '<div class="dtf">' +
        '<div class="dtf-head"><input class="dtf-name" id="ru-name" value="' + esc(ru.name || '') + '" placeholder="Rule name"></div>' +
        '<div class="ru-flags"><label class="lk-prop"><input type="checkbox" id="ru-en"' + (ru.enabled !== false ? ' checked' : '') + '> enabled</label>' +
        '<label class="lk-prop"><input type="checkbox" id="ru-once"' + (ru.once ? ' checked' : '') + '> once</label>' +
        '<button class="dt-btn" id="ru-fire" title="Fire now (manual)">▶ Fire now</button></div>' +
        '<div class="dt-head dt-head-mt">WHEN</div><div class="ru-when">' +
          '<select id="ru-src">' + WHEN_SRC.map(function (s) { return '<option value="' + s[0] + '"' + (w.src === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
          (clockSrc ? '<label class="dtf-field"><span>Clock</span><select id="ru-clk">' + clockOptions(clocks, w) + '</select></label>' : '') +
          (w.src === 'clock.cross' ?
            '<label class="dtf-field"><span>Dir</span><select id="ru-dir"><option value="up"' + (w.dir !== 'down' ? ' selected' : '') + '>fills ↑</option><option value="down"' + (w.dir === 'down' ? ' selected' : '') + '>drains ↓</option></select></label>' +
            '<label class="dtf-field"><span>Threshold</span><input type="number" id="ru-thr" value="' + (w.threshold != null ? w.threshold : '') + '" style="width:64px"></label>' : '') +
          (w.src === 'cast.played' ? '<label class="dtf-field"><span>Cast-view</span><select id="ru-wcast">' + castOptionsHtml(casts, w.castId) + '</select></label>' : '') +
          (w.src === 'manual' ? '<p class="dt-hint">Fires only from the ▶ button.</p>' : '') +
        '</div>' +
        '<div class="dt-head dt-head-mt">THEN</div><div class="ru-then">' +
          ru.then.map(function (fx, i) { return fxRow(fx, i, casts, clocks); }).join('') +
          '<div class="if-addrow"><button class="dt-btn" id="ru-addfx">+ effect</button></div>' +
        '</div></div>';
      wire(casts, clocks);
    }
    function wire(casts, clocks) {
      body.querySelector('#ru-name').oninput = function (e) { ru.name = e.target.value; poke(); };
      body.querySelector('#ru-en').onchange = function (e) { ru.enabled = e.target.checked; poke(); };
      body.querySelector('#ru-once').onchange = function (e) { ru.once = e.target.checked; poke(); };
      body.querySelector('#ru-fire').onclick = function () { saveDoc(ref, ru).then(function () { if (window.CastRules) CastRules.fireManual(ru.id); }); };
      body.querySelector('#ru-src').onchange = function (e) { ru.when = { src: e.target.value, dir: ru.when.dir || 'up' }; poke(); draw(casts, clocks); };
      var clk = body.querySelector('#ru-clk'); if (clk) clk.onchange = function (e) { var s = parseClockSel(e.target.value); ru.when.clockId = s.clockId; ru.when.clockKind = s.clockKind; poke(); };
      var dir = body.querySelector('#ru-dir'); if (dir) dir.onchange = function (e) { ru.when.dir = e.target.value; poke(); };
      var thr = body.querySelector('#ru-thr'); if (thr) thr.oninput = function (e) { ru.when.threshold = e.target.value === '' ? undefined : (parseInt(e.target.value, 10) || 0); poke(); };
      var wcast = body.querySelector('#ru-wcast'); if (wcast) wcast.onchange = function (e) { ru.when.castId = e.target.value || undefined; poke(); };
      body.querySelector('#ru-addfx').onclick = function () { ru.then.push({ fx: 'cast.play' }); poke(); draw(casts, clocks); };
      body.querySelectorAll('[data-fxk]').forEach(function (s) { s.onchange = function () { ru.then[+s.getAttribute('data-fxk')] = { fx: s.value }; poke(); draw(casts, clocks); }; });
      body.querySelectorAll('[data-fxrm]').forEach(function (b) { b.onclick = function () { ru.then.splice(+b.getAttribute('data-fxrm'), 1); poke(); draw(casts, clocks); }; });
      body.querySelectorAll('[data-fxcast]').forEach(function (s) { s.onchange = function () { ru.then[+s.getAttribute('data-fxcast')].castId = s.value || undefined; poke(); }; });
      body.querySelectorAll('[data-fxclk]').forEach(function (s) { s.onchange = function () { var i = +s.getAttribute('data-fxclk'), sel = parseClockSel(s.value); ru.then[i].clockId = sel.clockId; ru.then[i].clockKind = sel.clockKind; ru.then[i].player = sel.player; poke(); }; });
      body.querySelectorAll('[data-fxby]').forEach(function (n) { n.oninput = function () { ru.then[+n.getAttribute('data-fxby')].by = parseInt(n.value, 10) || 0; poke(); }; });
      body.querySelectorAll('[data-fxval]').forEach(function (n) { n.oninput = function () { ru.then[+n.getAttribute('data-fxval')].value = parseInt(n.value, 10) || 0; poke(); }; });
      body.querySelectorAll('[data-fxloot]').forEach(function (t) { t.oninput = function () { ru.then[+t.getAttribute('data-fxloot')].lootId = t.value; poke(); }; });
      body.querySelectorAll('[data-fxtext]').forEach(function (t) { t.oninput = function () { ru.then[+t.getAttribute('data-fxtext')].text = t.value; poke(); }; });
    }
  }

  /* ═══ EDITOR PANES ═══ */
  function renderEditor(t, host) {
    var ref = { type: t.kind, id: t.ref };
    host.className = 'tab-content dt-fiche';
    // Same fiche chrome as the DATA records: the links band on top (cast-views
    // and clocks are linkable entities too); props stay in the editor body.
    host.innerHTML = '<div class="dt-fichebar"><div class="lk-band-host"></div></div>' +
      '<div class="dt-fiche-body"><div class="app-empty">…</div></div>';
    var bandHost = host.querySelector('.lk-band-host');
    var body = host.querySelector('.dt-fiche-body');
    Store.resolve(ref).then(function (hit) {
      if (!hit) { body.innerHTML = '<div class="app-empty">Not found.</div>'; return; }
      ref = { type: t.kind, id: hit.json.id };
      t.label = hit.json.name || t.kind;
      if (window.Links && t.kind !== 'rule') Links.renderBand(bandHost, ref, { noProps: true });
      if (t.kind === 'clock') renderClockEditor(body, ref, hit);
      else if (t.kind === 'rule') renderRuleEditor(body, ref, hit);
      else renderCastComposer(body, ref, hit);
      Shell.renderTabs();
    });
  }

  function saveDoc(ref, json) { return Store.put(ref, json).catch(function (e) { console.error(e); }); }
  var debSave = null;
  function schedule(ref, json, then) {
    clearTimeout(debSave);
    debSave = setTimeout(function () { saveDoc(ref, json).then(then || function () {}); }, 450);
  }

  /* — composer (free + entity) — */
  function renderCastComposer(body, ref, hit) {
    var doc = hit.json;
    var isEntity = doc.nature === 'entity';
    body.innerHTML = '<div class="ca-comp">' +
      '<div class="ca-left">' +
        '<div class="ca-toprow"><input class="dtf-name" id="ca-name" value="' + esc(doc.name || '') + '" placeholder="Reveal title">' +
        '<button class="dt-btn dt-btn-new" id="ca-play-btn">▶ Cast</button></div>' +
        '<div id="ca-blocks"></div>' +
      '</div>' +
      '<div class="ca-right"><div class="dt-head">PREVIEW — WHAT THE PLAYERS SEE</div><div class="ca-preview" id="ca-preview"></div></div>' +
    '</div>';
    body.querySelector('#ca-name').oninput = function (e) { doc.name = e.target.value; schedule(ref, doc, refreshSide); };
    body.querySelector('#ca-play-btn').onclick = function () { saveDoc(ref, doc).then(function () { play(doc); }); };
    paintBlocks();
    preview();

    function blocksArr() { return isEntity ? (doc.extraBlocks || (doc.extraBlocks = [])) : (doc.blocks || (doc.blocks = [])); }
    function preview() {
      var pv = body.querySelector('#ca-preview'); if (!pv) return;
      buildReveal(doc).then(function (rev) {
        if (window.FilmWindow && window.FilmWindow.preview) FilmWindow.preview(pv, rev);
        else pv.innerHTML = '<div class="app-empty">' + rev.blocks.length + ' bloc(s)</div>';
      });
    }
    function poke() { schedule(ref, doc); preview(); }

    function paintBlocks() {
      var box = body.querySelector('#ca-blocks');
      var blocks = blocksArr();
      var html = '';
      if (isEntity) {
        var fields = doc.fields || (doc.fields = ['photo', 'name', 'role']);
        html += '<div class="ca-entity"><span class="dt-head" style="padding:0 0 6px">LINKED TO THE RECORD — broadcast fields</span>' +
          ENTITY_FIELDS.map(function (f) {
            return '<label class="lk-prop"><input type="checkbox" data-f="' + f[0] + '"' + (fields.indexOf(f[0]) >= 0 ? ' checked' : '') + '> ' + f[1] + '</label>';
          }).join('') + '<p class="dt-hint">Resolved at cast time: the record changes, the reveal follows.</p></div>';
      } else {
        html += '<div class="ca-tpls">' + TEMPLATES.map(function (tp) { return '<button class="dt-btn" data-tpl="' + tp.k + '">' + esc(tp.label) + '</button>'; }).join('') + '</div>';
      }
      html += blocks.map(function (b, i) {
        var head = '<div class="ca-b-head"><span>' + (b.type === 'image' ? 'Image' : 'Text') + '</span>' +
          '<select data-bsz="' + i + '">' + ['s', 'm', 'l', 'xl', 'full'].map(function (z) { return '<option' + (z === b.size ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select>' +
          '<select data-bal="' + i + '">' + ['left', 'center', 'right'].map(function (a) { return '<option' + (a === (b.align || 'center') ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>' +
          '<button class="dt-x" data-bup="' + i + '">▲</button><button class="dt-x" data-bdn="' + i + '">▼</button><button class="dt-x" data-brm="' + i + '">✕</button></div>';
        var inner;
        if (b.type === 'image') {
          inner = '<div class="ca-b-img">' + (b.src ? '<img src="' + esc(b.src) + '">' : '<span class="dt-dim">no image</span>') +
            '<label class="dt-btn">Upload<input type="file" accept="image/*" data-bimg="' + i + '" hidden></label>' +
            '<input data-bcam="' + i + '" value="' + esc(b.cam || '') + '" placeholder="caption (CAM 03…)"></div>';
        } else {
          inner = '<textarea data-btxt="' + i + '" placeholder="What the players read…">' + esc(b.text || '') + '</textarea>' +
            '<div class="ca-b-img"><select data-bmd="' + i + '"><option value="panel"' + ((b.mode || 'panel') === 'panel' ? ' selected' : '') + '>Panel</option><option value="dialogue"' + (b.mode === 'dialogue' ? ' selected' : '') + '>Dialogue</option></select>' +
            '<input data-bspk="' + i + '" value="' + esc(b.speaker || '') + '" placeholder="speaker (optional)"></div>';
        }
        return '<div class="ca-b">' + head + inner + '</div>';
      }).join('');
      html += '<div class="if-addrow"><button class="dt-btn" id="ca-addimg">+ Image</button><button class="dt-btn" id="ca-addtxt">+ Text</button></div>';
      box.innerHTML = html;

      if (isEntity) box.querySelectorAll('[data-f]').forEach(function (c) {
        c.onchange = function () {
          var f = c.getAttribute('data-f'), fields = doc.fields;
          var ix = fields.indexOf(f);
          if (c.checked && ix < 0) fields.push(f); else if (!c.checked && ix >= 0) fields.splice(ix, 1);
          poke();
        };
      });
      box.querySelectorAll('[data-tpl]').forEach(function (btn) {
        btn.onclick = function () { var tp = TEMPLATES.filter(function (x) { return x.k === btn.getAttribute('data-tpl'); })[0]; if (tp) { doc.blocks = tp.make(); poke(); paintBlocks(); } };
      });
      function bAt(node, attr) { return blocksArr()[+node.getAttribute(attr)]; }
      box.querySelectorAll('[data-bsz]').forEach(function (s) { s.onchange = function () { bAt(s, 'data-bsz').size = s.value; poke(); }; });
      box.querySelectorAll('[data-bal]').forEach(function (s) { s.onchange = function () { bAt(s, 'data-bal').align = s.value; poke(); }; });
      box.querySelectorAll('[data-btxt]').forEach(function (ta) { ta.oninput = function () { bAt(ta, 'data-btxt').text = ta.value; poke(); }; });
      box.querySelectorAll('[data-bcam]').forEach(function (i2) { i2.oninput = function () { bAt(i2, 'data-bcam').cam = i2.value; poke(); }; });
      box.querySelectorAll('[data-bmd]').forEach(function (s) { s.onchange = function () { bAt(s, 'data-bmd').mode = s.value; poke(); }; });
      box.querySelectorAll('[data-bspk]').forEach(function (i2) { i2.oninput = function () { bAt(i2, 'data-bspk').speaker = i2.value; poke(); }; });
      box.querySelectorAll('[data-bimg]').forEach(function (inp) {
        inp.onchange = function () {
          var f = inp.files[0]; if (!f) return;
          var r = new FileReader();
          r.onload = function () { bAt(inp, 'data-bimg').src = r.result; poke(); paintBlocks(); };
          r.readAsDataURL(f);
        };
      });
      box.querySelectorAll('[data-brm]').forEach(function (b2) { b2.onclick = function () { blocksArr().splice(+b2.getAttribute('data-brm'), 1); poke(); paintBlocks(); }; });
      box.querySelectorAll('[data-bup]').forEach(function (b2) { b2.onclick = function () { var i = +b2.getAttribute('data-bup'), a = blocksArr(); if (i > 0) { var tmp = a[i - 1]; a[i - 1] = a[i]; a[i] = tmp; poke(); paintBlocks(); } }; });
      box.querySelectorAll('[data-bdn]').forEach(function (b2) { b2.onclick = function () { var i = +b2.getAttribute('data-bdn'), a = blocksArr(); if (i < a.length - 1) { var tmp = a[i + 1]; a[i + 1] = a[i]; a[i] = tmp; poke(); paintBlocks(); } }; });
      var ai = box.querySelector('#ca-addimg'); if (ai) ai.onclick = function () { blocksArr().push(blImg('', 'm')); poke(); paintBlocks(); };
      var at = box.querySelector('#ca-addtxt'); if (at) at.onclick = function () { blocksArr().push(blTxt('', 'panel', 'l')); poke(); paintBlocks(); };
    }
  }

  /* — clock editor — */
  var CLOCK_COLORS = ['#c0392b', '#b8860b', '#1a7a2e', '#7a5ab8'];
  function renderClockEditor(body, ref, hit) {
    var k = hit.json;
    var b = br();
    var viz = b.clockViz ? b.clockViz(k.style || 'pie', k.value || 0, k.max || 6, k.color || '#b8860b', 110) : '';
    var swatches = CLOCK_COLORS.map(function (c) {
      return '<button class="ev-color' + (c === (k.color || '#b8860b') ? ' active' : '') + '" data-ckcol="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
    }).join('');
    body.innerHTML = '<div class="dtf">' +
      '<div class="dtf-head"><input class="dtf-name" id="ck-name" value="' + esc(k.name || '') + '"></div>' +
      '<div class="ck-row"><div class="ck-viz" id="ck-viz">' + viz + '</div>' +
        '<div class="ck-ctl">' +
          '<div class="ck-val"><button class="dt-btn" id="ck-dec">−</button><b id="ck-vtxt">' + (k.value || 0) + ' / ' + (k.max || 6) + '</b><button class="dt-btn" id="ck-inc">+</button></div>' +
          '<label class="dtf-field"><span>Max</span><input type="number" id="ck-max" min="1" max="24" value="' + (k.max || 6) + '"></label>' +
          '<label class="dtf-field"><span>Style</span><select id="ck-style">' + ['pie', 'bar', 'timer', 'tally', 'dial'].map(function (s) { return '<option' + (s === (k.style || 'pie') ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
          '<div class="dtf-field"><span>Color</span><div class="ev-colors">' + swatches + '</div></div>' +
          '<label class="lk-prop"><input type="checkbox" id="ck-pub"' + (k.props && k.props.public ? ' checked' : '') + '> visible to players</label>' +
          '<label class="dtf-field"><span>Kind</span><select id="ck-kind">' + ['', 'heat', 'trace'].map(function (kd) { return '<option value="' + kd + '"' + (((k.props && k.props.kind) || '') === kd ? ' selected' : '') + '>' + (kd || 'narrative') + '</option>'; }).join('') + '</select></label>' +
          '<label class="dtf-field" id="ck-playerwrap"' + ((k.props && k.props.kind) ? '' : ' style="display:none"') + '><span>Player</span><input id="ck-player" value="' + esc((k.props && k.props.player) || '') + '" placeholder="sheet id / name"></label>' +
          '<button class="dt-btn dt-btn-new" id="ck-play">▶ Cast</button>' +
        '</div></div></div>';
    function up(repaint) {
      schedule(ref, k, refreshSide);
      body.querySelector('#ck-vtxt').textContent = (k.value || 0) + ' / ' + (k.max || 6);
      if (repaint && b.clockViz) body.querySelector('#ck-viz').innerHTML = b.clockViz(k.style || 'pie', k.value || 0, k.max || 6, k.color || '#b8860b', 110);
    }
    body.querySelector('#ck-name').oninput = function (e) { k.name = e.target.value; up(); };
    function bump(d) {
      var before = k.value || 0;
      var after = d > 0 ? Math.min(before + 1, k.max || 6) : Math.max(before - 1, 0);
      if (after === before) return;
      k.value = after;
      // Save immediately (NOT the debounced `up`): a cascade may change this same clock,
      // and a late debounced write would clobber it. Update the editor UI inline instead.
      var vt = body.querySelector('#ck-vtxt'); if (vt) vt.textContent = (k.value || 0) + ' / ' + (k.max || 6);
      if (b.clockViz) { var vz = body.querySelector('#ck-viz'); if (vz) vz.innerHTML = b.clockViz(k.style || 'pie', k.value || 0, k.max || 6, k.color || '#b8860b', 110); }
      saveDoc(ref, k).then(function () { refreshSide(); if (window.CastRules) CastRules.emitClockChange(k, before, after); });
    }
    body.querySelector('#ck-inc').onclick = function () { bump(1); };
    body.querySelector('#ck-dec').onclick = function () { bump(-1); };
    body.querySelector('#ck-max').onchange = function (e) { k.max = Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 6)); if (k.value > k.max) k.value = k.max; up(true); };
    body.querySelector('#ck-style').onchange = function (e) { k.style = e.target.value; up(true); };
    body.querySelectorAll('[data-ckcol]').forEach(function (sw) {
      sw.onclick = function () {
        k.color = sw.getAttribute('data-ckcol');
        body.querySelectorAll('[data-ckcol]').forEach(function (x) { x.classList.toggle('active', x === sw); });
        up(true);
      };
    });
    body.querySelector('#ck-pub').onchange = function (e) { k.props = k.props || {}; k.props.public = e.target.checked; up(); };
    body.querySelector('#ck-kind').onchange = function (e) { k.props = k.props || {}; k.props.kind = e.target.value || undefined; if (!e.target.value) delete k.props.player; var w = body.querySelector('#ck-playerwrap'); if (w) w.style.display = e.target.value ? '' : 'none'; up(); };
    body.querySelector('#ck-player').oninput = function (e) { k.props = k.props || {}; k.props.player = e.target.value; up(); };
    body.querySelector('#ck-play').onclick = function () { saveDoc(ref, k).then(function () { playClock(k); }); };
  }

  /* — section home pane (default tab): a collapsable cast rail + a main area — */
  function renderHome(t, host) {
    var player = isPlayer();
    host.className = 'tab-content ca-pane';
    host.innerHTML =
      '<div class="ca-topbar"><button class="ca-rail-toggle" title="Toggle cast list" aria-label="Toggle cast list">«</button><span class="ca-topbar-t">CAST</span></div>' +
      '<div class="ca-body">' +
        '<aside class="ca-rail"></aside>' +
        '<div class="ca-main"><div class="dt-head" style="padding:16px 18px 4px">BROADCAST TO THE TABLE</div>' +
        '<p class="dt-hint" style="padding:0 18px 6px">Pick a cast-view or a clock on the left — every ▶ broadcasts instantly.</p>' +
        (player ? '' :
          '<div class="ca-home-acts">' +
            '<button class="app-empty ca-home-new" data-ca="cast">compose a <b>cast-view</b></button>' +
            '<button class="app-empty ca-home-new" data-ca="clock">start a <b>clock</b></button>' +
          '</div>') +
        '</div>' +
      '</div>';
    var rail = host.querySelector('.ca-rail'); if (rail) renderSide(rail);
    host.querySelectorAll('[data-ca]').forEach(function (b) {
      b.onclick = function () { if (b.getAttribute('data-ca') === 'cast') newCastFlow(); else newClock(); };
    });
    var tog = host.querySelector('.ca-rail-toggle');
    if (tog) tog.onclick = function () { var c = host.classList.toggle('ca-rail-collapsed'); tog.textContent = c ? '»' : '«'; };
  }

  window.CastSection = {
    renderSide: renderSide,
    renderEditor: renderEditor,
    renderHome: renderHome,
    buildReveal: buildReveal,
    play: play,
  };
})();
