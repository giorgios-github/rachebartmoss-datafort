/* app-migrate.js — one-shot, idempotent campaign migration to schema v2.
   Converts the meta.prep blobs into per-entity files, stamps stable ids on
   npcs/orgs, converts name-refs to {type,id}, seeds the links & props
   registries. Additive until the final commit (schemaVersion:2 + prep →
   prepLegacy), so a crash mid-run replays cleanly.
   Entities that already carry uid()-style ids (shops, events, clocks, squads,
   loot, customDb) KEEP them — cast clock-triggers therefore stay valid as-is.
   Depends on window.App (app-core.js). GM role only. */
(function () {
  'use strict';
  var App = window.App;

  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
  function fileFor(name, id) { return slugify(name) + '-' + id + '.json'; }

  /* Block materialization for legacy preset-only events — mirror of app.js
     evBlocks/_blImg/_blTxt (can't reach them inside app.js's IIFE). */
  function blImg(src, size, cam, align) { return { id: App.uid('bl'), type: 'image', src: src || '', cam: cam || '', size: size || 'm', align: align || 'center' }; }
  function blTxt(t, mode, size, speaker) { return { id: App.uid('bl'), type: 'text', text: t || '', mode: mode || 'panel', size: size || 'l', speaker: speaker || '', align: 'center' }; }
  function materializeBlocks(ev) {
    if (Array.isArray(ev.blocks) && ev.blocks.length) return ev.blocks;
    var p = ev.preset, b = [];
    if (p === 'fullimage') { if (ev.image) b.push(blImg(ev.image, 'full')); }
    else if (p === 'call') { if (ev.image) b.push(blImg(ev.image, 'l', 'CAM 03 ● LIVE')); if (ev.portrait) b.push(blImg(ev.portrait, 's', 'ID ● CALLER', 'left')); if (ev.text) b.push(blTxt(ev.text, 'dialogue', 'l', 'INCOMING CALL')); }
    else if (p === 'dossier') { if (ev.portrait || ev.image) b.push(blImg(ev.portrait || ev.image, 'l', 'ID ● FILE', 'left')); if (ev.text) b.push(blTxt(ev.text, 'panel', 'l')); }
    else if (p === 'triptych') { if (ev.image) b.push(blImg(ev.image, 'l', 'CAM 02', 'right')); if (ev.text) b.push(blTxt(ev.text, 'panel', 'm')); if (ev.portrait) b.push(blImg(ev.portrait, 's', 'ID', 'left')); }
    else if (p === 'textonly') { if (ev.text) b.push(blTxt(ev.text, 'panel', 'xl')); }
    else { if (ev.image) b.push(blImg(ev.image, 'l')); if (ev.text) b.push(blTxt(ev.text, ev.image ? 'dialogue' : 'panel', 'l')); }
    return b;
  }

  function run(cid, onProgress) {
    var say = onProgress || function (m) { console.log('[Migrate] ' + m); };
    var C = encodeURIComponent(cid);
    var api = App.api;
    var idIndex = {};   // "type:id" → filename
    var linkRows = [];  // accumulated link-registry entries
    var nameMap = {};   // "npc:<basename>"|"org:<basename>"|"location:<lowername>" → {type,id}

    function putDoc(type, fname, json) {
      idIndex[type + ':' + json.id] = fname;
      return api('PUT', 'campaigns/' + C + '/' + type + '/' + encodeURIComponent(fname), JSON.stringify(json, null, 2)).then(function (r) {
        if (r && r.error) throw new Error('hub refused ' + type + '/' + fname + ': ' + r.error);
      });
    }
    function baseName(f) { return String(f).replace(/\.json$/i, ''); }
    function addLink(from, to, label, inverseLabel) {
      if (!from || !to) return;
      linkRows.push({ id: App.uid('lk'), from: from, to: to, label: label || 'linked to', inverseLabel: inverseLabel || '' });
    }

    return api('GET', 'campaigns/' + C).then(function (d) {
      var meta = (d && d.meta) || {};
      if ((meta.schemaVersion || 0) >= 2) { say('already v' + meta.schemaVersion + ' — nothing to do'); return { done: true, skipped: true }; }
      var prep = meta.prep || {};
      var docs = d.docs || {};
      say('migrating "' + cid + '" to schema v2…');

      // 2. backup meta (documents/, POST — never overwritten)
      var backupName = '_meta-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      return api('POST', 'campaigns/' + C + '/documents', { name: backupName, json: meta }).then(function () {
        say('meta backup → documents/' + backupName);

        // 3. stamp ids on npcs + orgs
        function stampAll(dirType, refType) {
          var files = (docs[dirType === 'npcs' ? 'npcs' : 'orgs'] || []).filter(function (f) { return f.name.charAt(0) !== '_' && /\.json$/i.test(f.name); });
          var chain = Promise.resolve();
          files.forEach(function (f) {
            chain = chain.then(function () {
              return api('GET', 'campaigns/' + C + '/' + dirType + '/' + encodeURIComponent(f.name)).then(function (json) {
                if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { json = {}; } }
                var dirty = false;
                if (!json.id) { json.id = App.uid(refType); dirty = true; }
                if (!json.props || typeof json.props !== 'object') { json.props = {}; dirty = true; }
                nameMap[refType + ':' + baseName(f.name)] = { type: refType, id: json.id };
                idIndex[refType + ':' + json.id] = f.name;
                return dirty ? api('PUT', 'campaigns/' + C + '/' + dirType + '/' + encodeURIComponent(f.name), JSON.stringify(json, null, 2)) : null;
              });
            });
          });
          return chain.then(function () { say(dirType + ': ' + files.length + ' stamped'); });
        }

        return stampAll('npcs', 'npc').then(function () { return stampAll('orgs', 'org'); }).then(function () {

          // 4. locations (union of prep.locations, locbooks places, shop location refs)
          var locByName = {};
          function ensureLocation(name, sub) {
            name = (name || '').trim(); if (!name) return null;
            var k = name.toLowerCase();
            if (locByName[k]) return locByName[k].ref;
            var id = App.uid('loc');
            locByName[k] = { ref: { type: 'location', id: id }, json: { id: id, name: name, district: '', notes: sub || '', props: {} } };
            nameMap['location:' + k] = locByName[k].ref;
            return locByName[k].ref;
          }
          (prep.locations || []).forEach(function (p) { ensureLocation(p.name || p.id, p.sub || ''); });
          (prep.locbooks || []).forEach(function (b) { (b.places || []).forEach(function (p) { ensureLocation(p.name || p.id, b.name || ''); }); });
          (prep.shops || []).forEach(function (s) { if (s.link && s.link.type === 'location' && s.link.ref) ensureLocation(s.link.ref, ''); });

          var chain = Promise.resolve();
          Object.keys(locByName).forEach(function (k) {
            var e = locByName[k];
            chain = chain.then(function () { return putDoc('locations', fileFor(e.json.name, e.json.id), e.json); });
          });

          // 5. shops (skip the __online virtual)
          (prep.shops || []).forEach(function (s) {
            if (s._virtual || s.id === '__online') return;
            var id = s.id || App.uid('shop');
            var json = { id: id, name: s.name || 'Shop', kind: s.kind || 'storefront', items: s.items || [], props: { public: !!s.public }, notes: s.notes || '' };
            var ref = { type: 'shop', id: id };
            if (s.link) {
              if (s.link.type === 'url' && s.link.url) json.url = s.link.url;
              else if (s.link.type === 'location' && s.link.ref) addLink(ref, nameMap['location:' + String(s.link.ref).toLowerCase()], 'located at', 'hosts');
              else if (s.link.type === 'npc' && s.link.ref) addLink(ref, nameMap['npc:' + baseName(s.link.ref)], 'run by', 'runs');
              else if (s.link.type === 'org' && s.link.ref) addLink(ref, nameMap['org:' + baseName(s.link.ref)], 'owned by', 'owns');
            }
            chain = chain.then(function () { return putDoc('shops', fileFor(json.name, id), json); });
          });

          // 6. items: loot containers + customDb entries
          (prep.loot || []).forEach(function (g) {
            var id = g.id || App.uid('itm');
            var json = { id: id, name: g.name || 'Container', kind: 'container', nodes: g.nodes || [], props: {}, notes: '' };
            chain = chain.then(function () { return putDoc('items', fileFor(json.name, id), json); });
          });
          (prep.customDb || []).forEach(function (rec) {
            var id = rec.id || App.uid('itm');
            var json = { id: id, name: rec.name || 'Custom', kind: 'object', notes: rec.notes || '', data: rec, source: { db: rec.cat || '', custom: true }, props: {} };
            chain = chain.then(function () { return putDoc('items', fileFor(json.name, id), json); });
          });

          // 7. casts (events) — materialize legacy preset blocks; npcRef → link.
          //    Legacy ev.trigger (clock drops below x → auto-reveal) is superseded by
          //    the CAST reactive engine: it becomes a `rule` doc (docs/cast-triggers-design.md
          //    §E) instead of an orphan field the composer never read. Clock ids are
          //    preserved (§8 below), so when.clockId keeps resolving.
          (prep.events || []).forEach(function (ev) {
            var id = ev.id || App.uid('cast');
            var json = { id: id, name: ev.title || 'Reveal', nature: 'free', folder: '', blocks: materializeBlocks(ev), props: {} };
            var ref = { type: 'cast', id: id };
            if (ev.npcRef) { var nr = nameMap['npc:' + baseName(ev.npcRef)]; if (nr) { json.ref = nr; addLink(ref, nr, 'features', 'featured in'); } }
            chain = chain.then(function () { return putDoc('casts', fileFor(json.name, id), json); });
            if (ev.trigger && ev.trigger.clockId) {
              var rid = App.uid('rule');
              // Legacy semantics = decrement + "drops below x" ⇒ dir:'down', crossing threshold.
              var rule = {
                id: rid, name: (ev.title || 'Reveal') + ' — auto', enabled: true, folder: '',
                when: { src: 'clock.cross', clockId: ev.trigger.clockId, dir: 'down', threshold: (ev.trigger.below != null ? ev.trigger.below : 1) },
                then: [{ fx: 'cast.play', castId: id }],
                once: false, firedAt: null, props: {},
              };
              chain = chain.then(function () { return putDoc('rules', fileFor(rule.name, rid), rule); });
            }
          });

          // 8. clocks — ids preserved, so cast triggers keep resolving
          (prep.clocks || []).forEach(function (k) {
            var id = k.id || App.uid('clk');
            var json = { id: id, name: k.label || 'Clock', max: k.max || 6, value: k.value || 0, color: k.color || '', style: k.style || 'pie', props: { public: !!k.public } };
            chain = chain.then(function () { return putDoc('clocks', fileFor(json.name, id), json); });
          });

          // 9. squads — npcfile members re-mapped to refs (best effort)
          (prep.squads || []).forEach(function (sq) {
            var id = sq.id || App.uid('sq');
            var members = (sq.members || []).map(function (m) {
              if (m.kind === 'npcfile' && m.name) {
                var r = nameMap['npc:' + baseName(m.name)];
                return r ? Object.assign({}, m, { ref: r }) : m;
              }
              return m;
            });
            var json = { id: id, name: sq.name || 'Squad', members: members, lootId: sq.lootId || null, settings: sq.settings || {}, props: {} };
            chain = chain.then(function () { return putDoc('squads', fileFor(json.name, id), json); });
          });

          // 10. npcPublic → props.public on the npc files
          (prep.npcPublic || []).forEach(function (nm) {
            var r = nameMap['npc:' + baseName(nm)];
            if (!r) return;
            var fname = idIndex['npc:' + r.id];
            chain = chain.then(function () {
              return api('GET', 'campaigns/' + C + '/npcs/' + encodeURIComponent(fname)).then(function (json) {
                if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { return; } }
                json.props = json.props || {}; json.props.public = true;
                return api('PUT', 'campaigns/' + C + '/npcs/' + encodeURIComponent(fname), JSON.stringify(json, null, 2));
              });
            });
          });

          // 11. registries
          chain = chain.then(function () {
            return api('PUT', 'campaigns/' + C + '/links/_links.json', JSON.stringify(linkRows, null, 2));
          });

          // 12. commit
          return chain.then(function () {
            var npcOrderIds = (prep.npcOrder || []).map(function (nm) { var r = nameMap['npc:' + baseName(nm)]; return r ? r.id : null; }).filter(Boolean);
            return App.saveMeta(function (m) {
              var props = Array.isArray(m.props) ? m.props.slice() : [];
              if (!props.some(function (p) { return p.key === 'public'; })) props.unshift({ key: 'public', type: 'bool', system: true });
              var ui = Object.assign({}, m.ui);
              ui.dataOrder = Object.assign({}, ui.dataOrder, { npc: npcOrderIds });
              return {
                schemaVersion: 2,
                prepLegacy: m.prep || prep,
                prep: null,
                props: props,
                ui: ui,
                idIndex: Object.assign({}, m.idIndex, idIndex),
              };
            }, cid).then(function () {
              say('committed — schemaVersion 2, prep → prepLegacy, ' + Object.keys(idIndex).length + ' entities indexed, ' + linkRows.length + ' links');
              return { done: true, entities: Object.keys(idIndex).length, links: linkRows.length };
            });
          });
        });
      });
    });
  }

  window.Migrate = { run: run };
})();
