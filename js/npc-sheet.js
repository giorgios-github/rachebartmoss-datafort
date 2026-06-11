/* ═══════════════════════════════════════════════
   NPC SHEET — Rache Bartmoss' Datafort
   Simplified character sheet for NPCs
   ═══════════════════════════════════════════════ */

var NPC_STATS = ['INT', 'REF', 'TECH', 'COOL', 'ATT', 'LUCK', 'MA', 'BODY', 'EMP'];
var NPC_LOCS = ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'];
var NPC_LOC_NAMES = { head:'Head', torso:'Torso', rarm:'R.Arm', larm:'L.Arm', rleg:'R.Leg', lleg:'L.Leg' };
var NPC_LOC_POS = [
  { loc:'head',  top:3,   center:true },
  { loc:'torso', top:64,  center:true },
  { loc:'rarm',  top:55,  left:1,    right:null, center:false },
  { loc:'larm',  top:55,  left:null, right:1,    center:false },
  { loc:'rleg',  top:145, left:19,   right:null, center:false },
  { loc:'lleg',  top:145, left:null, right:19,   center:false }
];

var DB = { roles:[], skills:[], weapons:[], vehicles:[], armor:[], cyberware:[], gearItems:[] };
var NPC = makeBlankNPC();
var _skillSearchOpen = false;
var _weapSearchOpen = false;
var _armorSearchOpen = false;
var _vehSearchOpen = false;

/* ─── Blank NPC factory ─── */
function makeBlankNPC() {
  var stats = {};
  NPC_STATS.forEach(function(s){ stats[s] = 0; });
  return {
    name: '',
    type: '',
    viewMode: 'edit',
    viewData: {},        // per-view-type document fields (status, dept, caseNum...)
    photo: '',
    role: '',
    sa: '',
    saVal: 0,
    notes: '',
    stats: stats,
    skills: [],          // [{name, stat, val, isRole, isCustom}]
    cyberware: [],       // [{name, type, hc}]
    weapons: [],         // [{name, type, damage, ammo, rof, range, notes}]
    armor: [],           // [{name, sp, locs:{head,torso,rarm,larm,rleg,lleg}, notes}]
    inventory: [],       // [{name, notes}]
    vehicles: []         // [{name, type, notes}]
  };
}

/* ─── Utilities ─── */
function _uid() { return 'n-' + Math.random().toString(36).substr(2,9); }
function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ─── Multi-NPC collection + localStorage ─── */
var _LS_KEY     = 'bartmoss_npc';    // legacy single-NPC key (migrated)
var _LS_KEY_ALL = 'bartmoss_npcs';   // collection { list, active }
var NPCS = [];        // open NPC tabs
var activeIdx = 0;
function _npcMigrate(n) {            // ensure new fields on any loaded NPC
  if (!n || typeof n !== 'object') return makeBlankNPC();
  if (n.name == null) n.name = '';
  if (!n.viewMode) n.viewMode = 'edit';
  if (!n.viewData || typeof n.viewData !== 'object') n.viewData = {};
  return n;
}
function _save() {
  if (window.__cdoc) return; // file-bridge mode: campaign-doc.js owns persistence
  try { localStorage.setItem(_LS_KEY_ALL, JSON.stringify({ list: NPCS, active: activeIdx })); } catch(e) {}
}
function _load() {
  try {
    var rawAll = localStorage.getItem(_LS_KEY_ALL);
    if (rawAll) {
      var data = JSON.parse(rawAll);
      NPCS = (data.list || []).map(_npcMigrate);
      activeIdx = Math.min(Math.max(0, data.active || 0), Math.max(0, NPCS.length - 1));
    } else {
      // migrate the legacy single NPC, if any
      var rawOne = localStorage.getItem(_LS_KEY);
      NPCS = rawOne ? [_npcMigrate(JSON.parse(rawOne))] : [];
      activeIdx = 0;
    }
  } catch(e) { NPCS = []; activeIdx = 0; }
  if (!NPCS.length) NPCS = [makeBlankNPC()];
  NPC = NPCS[activeIdx];
}

/* ─── Data loader ─── */
async function loadData() {
  var files = {
    roles:     'data/cp2020rolesext.json',
    skills:    'data/cp2020skills.json',
    weapons:   'data/cp2020weapons.json',
    vehicles:  'data/cp2020-vehicles.json',
    gear:      'data/cp2020gear.json',
    cyberware: 'data/cyberware.json'
  };
  try {
    var entries = await Promise.all(
      Object.entries(files).map(function([key,url]) {
        return fetch(url).then(function(r){ return r.json(); }).then(function(d){ return [key,d]; })
          .catch(function(e){ console.warn('NPC: could not load', url, e); return [key, null]; });
      })
    );
    var raw = Object.fromEntries(entries);
    DB.roles     = (raw.roles && raw.roles.roles) ? raw.roles.roles : (raw.roles || []);
    DB.skills    = raw.skills || [];
    DB.weapons   = raw.weapons || [];
    DB.vehicles  = raw.vehicles || [];
    DB.armor     = (raw.gear || []).filter(function(g){ return g.category === 'ARMOR/CLOTHING'; });
    DB.cyberware = raw.cyberware || [];
    DB.gearItems = (raw.gear || []).filter(function(g){ return g.category !== 'ARMOR/CLOTHING'; });
  } catch(e) {
    console.warn('NPC loadData error:', e);
  }

  // Check for sessionStorage preload / file-bridge mode
  var _params = new URLSearchParams(window.location.search);
  window.__cdoc = _params.get('cdoc') === '1';
  try {
    if (window.__cdoc) {
      NPCS = [makeBlankNPC()]; activeIdx = 0; NPC = NPCS[0]; // placeholder until the bridge loads the file
    } else {
      var ssKey = _params.get('key');
      if (ssKey) {
        var stored = sessionStorage.getItem(ssKey);
        if (stored) { NPCS = [_npcMigrate(JSON.parse(stored))]; activeIdx = 0; NPC = NPCS[0]; }
        else { _load(); }
      } else {
        _load();
      }
    }
  } catch(e) { _load(); }

  renderNpcTabs();
  renderAll();
  initRoleDropdown();
  applyViewMode();

  // File-bridge adapter (campaign-doc.js loads/saves a single NPC file).
  window.__cdocAdapter = {
    load: function (json) { NPC = (json && Object.keys(json).length) ? _npcMigrate(json) : makeBlankNPC(); NPCS = [NPC]; activeIdx = 0; renderNpcTabs(); renderAll(); applyViewMode(); },
    serialize: function () { return NPC; },
  };
}

function initRoleDropdown() {
  var sel = document.getElementById('npc-role');
  if (!sel) return;
  DB.roles.forEach(function(r) {
    var o = document.createElement('option');
    o.value = r.name; o.textContent = r.name;
    sel.appendChild(o);
  });
  sel.value = NPC.role || '';
  sel.addEventListener('change', function() {
    NPC.role = this.value;
    var found = DB.roles.find(function(r){ return r.name === NPC.role; });
    NPC.sa = found ? (found.specialability.name || '') : '';
    document.getElementById('npc-sa-name').textContent = NPC.sa || '—';
    // Update role skills
    _syncRoleSkills();
    renderSkills();
    _save();
  });
}

/* ─── Sync role skills ─── */
function _syncRoleSkills() {
  var found = DB.roles.find(function(r){ return r.name === NPC.role; });
  var roleSkillNames = [];
  if (found && found.skills) {
    found.skills.forEach(function(s) {
      if (typeof s === 'string') roleSkillNames.push(s);
      else if (Array.isArray(s) && s.length) roleSkillNames.push(s[0]); // pick first option
    });
  }
  // Remove old role skills that aren't in new role
  NPC.skills = NPC.skills.filter(function(sk){ return !sk.isRole; });
  // Add new role skills (not already present as custom)
  roleSkillNames.forEach(function(name) {
    if (!NPC.skills.find(function(sk){ return sk.name === name; })) {
      var dbSkill = DB.skills.find(function(s){ return s.name === name; });
      NPC.skills.unshift({ name:name, stat: dbSkill ? (dbSkill.stat||'') : '', val:0, isRole:true });
    } else {
      // Mark existing as role skill
      var existing = NPC.skills.find(function(sk){ return sk.name === name; });
      if (existing) existing.isRole = true;
    }
  });
}

/* ─── Render all ─── */
function renderAll() {
  renderIdentity();
  renderStatsSkills();
  renderCyberware();
  renderWeapons();
  renderArmor();
  renderInventory();
  renderVehicles();
  renderNotes();
}

/* ─── Identity ─── */
function renderIdentity() {
  var nameEl = document.getElementById('npc-name');
  if (nameEl) nameEl.value = NPC.name || '';
  var typeEl = document.getElementById('npc-type');
  if (typeEl) typeEl.value = NPC.type || '';
  var saNameEl = document.getElementById('npc-sa-name');
  if (saNameEl) saNameEl.textContent = NPC.sa || '—';
  var saValEl = document.getElementById('npc-sa-val');
  if (saValEl) saValEl.value = NPC.saVal || 0;
  var photoImg = document.getElementById('npc-photo-img');
  var photoPlaceholder = document.getElementById('npc-photo-placeholder');
  if (NPC.photo) {
    photoImg.src = NPC.photo; photoImg.style.display = 'block';
    if (photoPlaceholder) photoPlaceholder.style.display = 'none';
  } else {
    photoImg.style.display = 'none';
    if (photoPlaceholder) photoPlaceholder.style.display = '';
  }
  var pc = document.getElementById('npc-photo-clear'); if (pc) pc.style.display = NPC.photo ? '' : 'none';
  var roleEl = document.getElementById('npc-role');
  if (roleEl) roleEl.value = NPC.role || '';
}

function npcLoadPhoto(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    NPC.photo = ev.target.result;
    document.getElementById('npc-photo-img').src = NPC.photo;
    document.getElementById('npc-photo-img').style.display = 'block';
    document.getElementById('npc-photo-placeholder').style.display = 'none';
    var pc = document.getElementById('npc-photo-clear'); if (pc) pc.style.display = '';
    if (NPC.viewMode && NPC.viewMode !== 'edit') applyViewMode();
    _save();
  };
  r.readAsDataURL(f);
  e.target.value = '';
}
function npcClearPhoto() {
  NPC.photo = '';
  document.getElementById('npc-photo-img').style.display = 'none';
  document.getElementById('npc-photo-placeholder').style.display = '';
  var pc = document.getElementById('npc-photo-clear'); if (pc) pc.style.display = 'none';
  if (NPC.viewMode && NPC.viewMode !== 'edit') applyViewMode();
  _save();
}

/* ─── Stats + Skills ─── */
function renderStatsSkills() {
  renderStats();
  renderSkills();
  renderSA();
}

function renderStats() {
  var grid = document.getElementById('npc-stats-grid'); if (!grid) return;
  grid.innerHTML = NPC_STATS.map(function(s) {
    return '<div class="npc-stat-box">' +
      '<span class="slabel">'+s+'</span>' +
      '<input type="number" min="0" max="10" value="'+(NPC.stats[s]||0)+'" data-stat="'+s+'" oninput="npcStatChange(this)">' +
    '</div>';
  }).join('');
}

function npcStatChange(inp) {
  NPC.stats[inp.dataset.stat] = parseInt(inp.value) || 0;
  _save();
}

function renderSA() {
  var saNameEl = document.getElementById('npc-sa-name');
  if (saNameEl) saNameEl.textContent = NPC.sa || '—';
  var saValEl = document.getElementById('npc-sa-val');
  if (saValEl) saValEl.value = NPC.saVal || 0;
}

function renderSkills() {
  var container = document.getElementById('npc-skills-list'); if (!container) return;
  var filter = (document.getElementById('npc-skill-filter')||{}).value || '';
  var fl = filter.toLowerCase();
  var skills = NPC.skills.filter(function(sk) {
    return !fl || sk.name.toLowerCase().includes(fl);
  });
  if (!skills.length) {
    container.innerHTML = '<div class="npc-empty-hint">No skills. Select a role or search to add.</div>';
    return;
  }
  container.innerHTML = skills.map(function(sk, i) {
    var realIdx = NPC.skills.indexOf(sk);
    return '<div class="npc-skill-row">' +
      '<input class="npc-name-edit npc-skill-name'+(sk.isRole?' role-skill':'')+'" value="'+_esc(sk.name)+'" title="'+(sk.isRole?'Role skill':'Skill name')+'" oninput="npcSkillSetName('+realIdx+',this.value)">' +
      '<span class="npc-skill-stat">'+_esc(sk.stat||'')+'</span>' +
      '<input class="npc-skill-val" type="number" min="0" max="10" value="'+(sk.val||0)+'" oninput="npcSkillChange('+realIdx+',this.value)">' +
      '<span class="npc-skill-rm" onclick="npcRemoveSkill('+realIdx+')">✕</span>' +
    '</div>';
  }).join('');
}

function npcSkillChange(idx, val) {
  if (NPC.skills[idx]) { NPC.skills[idx].val = parseInt(val)||0; _save(); }
}
function npcSkillSetName(idx, val) {
  if (NPC.skills[idx]) { NPC.skills[idx].name = val; NPC.skills[idx].isCustom = true; _save(); }
}

function npcRemoveSkill(idx) {
  NPC.skills.splice(idx, 1);
  renderSkills();
  _save();
}

// Distribute `total` points across `count` fields, each clamped to [min,max].
function _rollPool(count, total, min, max) {
  var vals = [];
  var i;
  for (i = 0; i < count; i++) vals.push(min);
  var budget = total - count * min;
  if (budget < 0) budget = 0;
  // available room per field
  while (budget > 0) {
    var open = [];
    for (i = 0; i < count; i++) if (vals[i] < max) open.push(i);
    if (!open.length) break;
    var k = open[Math.floor(Math.random() * open.length)];
    vals[k]++;
    budget--;
  }
  return vals;
}

function npcRollStats() {
  var vals = _rollPool(NPC_STATS.length, 40, 1, 10);
  NPC_STATS.forEach(function(s, i) { NPC.stats[s] = vals[i]; });
  renderStats();
  _save();
}

function npcRollSkills() {
  var n = NPC.skills.length;
  if (!n) return;
  var vals = _rollPool(n, 40, 1, 10);
  NPC.skills.forEach(function(sk, i) { sk.val = vals[i]; });
  renderSkills();
  _save();
}

/* Skill search */
function npcSkillSearch(val) {
  var results = document.getElementById('npc-add-skill-results'); if (!results) return;
  if (!val.trim()) { results.style.display = 'none'; return; }
  var fl = val.toLowerCase();
  var matches = DB.skills.filter(function(s) {
    return s.name.toLowerCase().includes(fl) && !NPC.skills.find(function(sk){ return sk.name === s.name; });
  }).slice(0, 20);
  if (!matches.length) { results.style.display = 'none'; return; }
  results.innerHTML = matches.map(function(s,i) {
    return '<div class="npc-add-skill-result" onclick="npcAddSkill(\''+_esc(s.name).replace(/'/g,'\\\'')+'\')">' +
      '<span>'+_esc(s.name)+'</span>' +
      '<span class="npc-add-skill-stat">'+_esc(s.stat||'')+'</span>' +
    '</div>';
  }).join('');
  results.style.display = 'block';
}

function npcAddSkill(name) {
  var dbSkill = DB.skills.find(function(s){ return s.name === name; });
  if (!NPC.skills.find(function(sk){ return sk.name === name; })) {
    NPC.skills.push({ name:name, stat: dbSkill ? (dbSkill.stat||'') : '', val:0, isRole:false, isCustom:true });
  }
  var addInput = document.getElementById('npc-add-skill-input');
  if (addInput) addInput.value = '';
  var results = document.getElementById('npc-add-skill-results');
  if (results) results.style.display = 'none';
  renderSkills();
  _save();
}

function npcAddCustomSkill() {
  var input = document.getElementById('npc-add-skill-input');
  var name = (input ? input.value : '').trim();
  if (!name) return;
  npcAddSkill(name);
}

/* ─── Cyberware ─── */
function renderCyberware() {
  var list = document.getElementById('npc-cyber-list'); if (!list) return;
  var totalHC = NPC.cyberware.reduce(function(s,c){ return s+(parseFloat(c.hc)||0); }, 0);
  var hcEl = document.getElementById('npc-hc-total');
  if (hcEl) hcEl.textContent = totalHC;

  if (!NPC.cyberware.length) {
    list.innerHTML = '<div class="npc-empty-hint">No cyberware.</div>';
    return;
  }
  list.innerHTML = NPC.cyberware.map(function(c, i) {
    return '<div class="npc-cyber-item">' +
      '<input class="npc-name-edit npc-cyber-item-name" value="'+_esc(c.name)+'" title="Cyberware name" oninput="npcCyberSet('+i+',\'name\',this.value)">' +
      '<span class="npc-cyber-item-type">'+_esc(c.type||'')+'</span>' +
      (c.hc ? '<span class="npc-cyber-item-hc">HC:'+c.hc+'</span>' : '') +
      '<span class="npc-cyber-rm" onclick="npcRemoveCyber('+i+')">✕</span>' +
    '</div>';
  }).join('');
}

function npcCyberSearch(val) {
  var results = document.getElementById('npc-cyber-results'); if (!results) return;
  if (!val.trim()) { results.style.display='none'; return; }
  var fl = val.toLowerCase();
  var matches = DB.cyberware.filter(function(c){ return (c.name||'').toLowerCase().includes(fl); }).slice(0,20);
  if (!matches.length) { results.style.display='none'; return; }
  results.innerHTML = matches.map(function(c) {
    return '<div class="npc-cyber-result" onclick="npcAddCyberFromDB(\''+_esc(c.name).replace(/'/g,'\\\'')+'\')">' +
      '<div class="npc-cyber-result-name">'+_esc(c.name)+'</div>' +
      '<div class="npc-cyber-result-sub">'+_esc(c.type||'')+(c.hc?' · HC:'+c.hc:'')+(c.cost?' · '+c.cost+'eb':'')+'</div>' +
    '</div>';
  }).join('');
  results.style.display = 'block';
}

function npcAddCyberFromDB(name) {
  var c = DB.cyberware.find(function(x){ return x.name===name; });
  NPC.cyberware.push({ name:name, type:c?(c.type||''):'', hc:c?(c.hc||0):0 });
  var inp = document.getElementById('npc-cyber-search-input');
  if (inp) inp.value = '';
  var res = document.getElementById('npc-cyber-results');
  if (res) res.style.display='none';
  renderCyberware();
  _save();
}

function npcAddCyberCustom() {
  var name = prompt('Cyberware name:'); if (!name) return;
  var hc = prompt('Humanity cost:', '0') || '0';
  NPC.cyberware.push({ name:name, type:'Custom', hc:parseFloat(hc)||0 });
  renderCyberware();
  _save();
}

function npcCyberSet(i, field, val) {
  if (NPC.cyberware[i]) { NPC.cyberware[i][field] = val; _save(); }
}
function npcRemoveCyber(i) {
  NPC.cyberware.splice(i,1);
  renderCyberware();
  _save();
}

/* ─── Weapons ─── */
function renderWeapons() {
  var tbody = document.getElementById('npc-weap-tbody'); if (!tbody) return;
  if (!NPC.weapons.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="npc-empty-hint" style="padding:8px">No weapons.</td></tr>';
    return;
  }
  tbody.innerHTML = NPC.weapons.map(function(w,i) {
    return '<tr>' +
      '<td><input value="'+_esc(w.name||'')+'" oninput="npcWeapSet('+i+',\'name\',this.value)"></td>' +
      '<td><input value="'+_esc(w.type||'')+'" style="width:60px" oninput="npcWeapSet('+i+',\'type\',this.value)"></td>' +
      '<td><input value="'+_esc(w.damage||'')+'" style="width:60px" oninput="npcWeapSet('+i+',\'damage\',this.value)"></td>' +
      '<td><input value="'+_esc(w.ammo||'')+'" style="width:44px" oninput="npcWeapSet('+i+',\'ammo\',this.value)"></td>' +
      '<td><input value="'+_esc(w.rof||'')+'" style="width:30px" oninput="npcWeapSet('+i+',\'rof\',this.value)"></td>' +
      '<td><input value="'+_esc(w.range||'')+'" style="width:50px" oninput="npcWeapSet('+i+',\'range\',this.value)"></td>' +
      '<td><span class="npc-armor-rm" onclick="npcRemoveWeapon('+i+')">✕</span></td>' +
    '</tr>';
  }).join('');
}

function npcWeapSet(i, field, val) {
  if (NPC.weapons[i]) { NPC.weapons[i][field] = val; _save(); }
}

function npcWeapSearch(val) {
  var results = document.getElementById('npc-weap-results'); if (!results) return;
  if (!val.trim()) { results.style.display='none'; return; }
  var fl = val.toLowerCase();
  var matches = DB.weapons.filter(function(w){ return (w.name||'').toLowerCase().includes(fl); }).slice(0,20);
  if (!matches.length) { results.style.display='none'; return; }
  results.innerHTML = matches.map(function(w) {
    return '<div class="npc-weap-result" onclick="npcAddWeaponFromDB(\''+_esc(w.name).replace(/'/g,'\\\'')+'\')">' +
      '<div class="npc-weap-result-name">'+_esc(w.name)+'</div>' +
      '<div class="npc-weap-result-dmg">'+_esc(w.damage||'')+(w.ammo?' · '+_esc(w.ammo):'')+'</div>' +
    '</div>';
  }).join('');
  results.style.display = 'block';
}

function npcAddWeaponFromDB(name) {
  var w = DB.weapons.find(function(x){ return x.name===name; });
  NPC.weapons.push({ name: w ? w.name : name, type: w ? (w.category||w.type||'') : '', damage: w ? (w.damage||'') : '', ammo: w ? (w.ammo||'') : '', rof: w ? (String(w.rof||'')) : '', range: w ? (String(w.range||'')) : '', notes:'' });
  var input = document.getElementById('npc-weap-search-input');
  if (input) input.value = '';
  var results = document.getElementById('npc-weap-results');
  if (results) results.style.display = 'none';
  renderWeapons();
  _save();
}

function npcAddWeaponCustom() {
  NPC.weapons.push({ name:'', type:'', damage:'', ammo:'', rof:'', range:'', notes:'' });
  renderWeapons();
  _save();
}

function npcRemoveWeapon(i) {
  NPC.weapons.splice(i,1);
  renderWeapons();
  _save();
}

/* ─── Armor / Fashion ─── */
function renderArmor() {
  renderArmorBody();
  renderArmorList();
}

function _spByLoc() {
  var sp = {}; NPC_LOCS.forEach(function(l){ sp[l]=0; });
  NPC.armor.forEach(function(a) {
    if (!a.locs || !a.sp) return;
    NPC_LOCS.forEach(function(l){ if (a.locs[l]) sp[l] += parseInt(a.sp)||0; });
  });
  return sp;
}

function renderArmorBody() {
  var wrap = document.getElementById('npc-armor-body-wrap'); if (!wrap) return;
  var sp = _spByLoc();
  var overlays = NPC_LOC_POS.map(function(z) {
    var val = sp[z.loc];
    var pos = 'position:absolute;top:'+z.top+'px;';
    if (z.center) pos += 'left:50%;transform:translateX(-50%);text-align:center;';
    else if (z.left != null) pos += 'left:'+z.left+'px;';
    else pos += 'right:'+z.right+'px;text-align:right;';
    if (val > 0) {
      return '<div style="'+pos+'background:rgba(58,123,213,0.55);padding:1px 4px;font-family:var(--head);font-size:9px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none">'+NPC_LOC_NAMES[z.loc]+' SP'+val+'</div>';
    }
    return '';
  }).join('');

  // Update existing overlays
  var existing = wrap.querySelectorAll('.npc-sp-dyn');
  existing.forEach(function(e){ e.remove(); });
  var tmp = document.createElement('div');
  tmp.innerHTML = overlays;
  Array.from(tmp.children).forEach(function(c){
    c.className = 'npc-sp-dyn'; wrap.appendChild(c);
  });
}

function renderArmorList() {
  var list = document.getElementById('npc-armor-list'); if (!list) return;
  if (!NPC.armor.length) {
    list.innerHTML = '<div class="npc-empty-hint">No armor/clothing.</div>';
    return;
  }
  list.innerHTML = NPC.armor.map(function(a, i) {
    var locChecks = NPC_LOCS.map(function(l) {
      return '<label class="npc-armor-loc-check"><input type="checkbox"'+(a.locs&&a.locs[l]?' checked':'')+' onchange="npcArmorLocChange('+i+',\''+l+'\',this.checked)"><span>'+NPC_LOC_NAMES[l].replace('.',' ')+'</span></label>';
    }).join('');
    return '<div class="npc-armor-item-row">' +
      '<input class="npc-name-edit npc-armor-item-name" value="'+_esc(a.name||'')+'" title="Armor name" oninput="npcArmorSetName('+i+',this.value)">' +
      '<input class="npc-armor-item-sp" type="number" min="0" value="'+(a.sp||0)+'" title="SP" oninput="npcArmorSpChange('+i+',this.value)">' +
      '<div class="npc-armor-loc-checks">'+locChecks+'</div>' +
      '<span class="npc-armor-rm" onclick="npcRemoveArmor('+i+')">✕</span>' +
    '</div>';
  }).join('');
}

function npcArmorSearch(val) {
  var results = document.getElementById('npc-armor-results'); if (!results) return;
  if (!val.trim()) { results.style.display='none'; return; }
  var fl = val.toLowerCase();
  var matches = DB.armor.filter(function(a){ return (a.name||'').toLowerCase().includes(fl); }).slice(0,20);
  if (!matches.length) { results.style.display='none'; return; }
  results.innerHTML = matches.map(function(a) {
    var sp = _extractSP(a.notes||'');
    return '<div class="npc-armor-result" onclick="npcAddArmorFromDB(\''+_esc(a.name).replace(/'/g,'\\\'')+'\')">' +
      '<div class="npc-armor-result-name">'+_esc(a.name)+'<span class="npc-armor-result-sp" style="margin-left:8px">'+(sp?'SP'+sp:'')+'</span></div>' +
      '<span class="npc-armor-result-notes">'+_esc((a.notes||'').slice(0,60))+'</span>' +
    '</div>';
  }).join('');
  results.style.display = 'block';
}

function _extractSP(notes) {
  var m = (notes||'').match(/\bSP\s*(\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

function npcAddArmorFromDB(name) {
  var a = DB.armor.find(function(x){ return x.name===name; });
  var sp = a ? _extractSP(a.notes||'') : 0;
  var locs = { head:false, torso:true, rarm:false, larm:false, rleg:false, lleg:false }; // default torso
  NPC.armor.push({ name:a?a.name:name, sp:sp, locs:locs, notes:a?a.notes:'' });
  var input = document.getElementById('npc-armor-search-input');
  if (input) input.value = '';
  var results = document.getElementById('npc-armor-results');
  if (results) results.style.display = 'none';
  renderArmor();
  _save();
}

function npcAddArmorCustom() {
  NPC.armor.push({ name:'', sp:0, locs:{ head:false, torso:true, rarm:false, larm:false, rleg:false, lleg:false }, notes:'' });
  renderArmorList();
  renderArmorBody();
  _save();
}

/* Import outfit(s) exported from the Outfit Designer (.outfit.json) as armor/clothing entries */
function npcImportOutfit(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      var outfitList = Array.isArray(data) ? data : [data];
      var imported = 0;
      outfitList.forEach(function(od) {
        if (!od || !Array.isArray(od.items)) return;
        od.items.forEach(function(it) {
          var locs = it.locs || {};
          var notes = it.notes || '';
          if (it.slots) notes = (notes ? notes + ' ' : '') + '[storage: ' + it.slots + ' slots]';
          NPC.armor.push({
            name: it.name || '', sp: it.sp || 0,
            locs: { head:!!locs.head, torso:!!locs.torso, rarm:!!locs.rarm,
                    larm:!!locs.larm, rleg:!!locs.rleg, lleg:!!locs.lleg },
            notes: notes
          });
          imported++;
        });
      });
      if (!imported) { alert('No outfit found in this file. Expected an Outfit Designer export (.outfit.json).'); return; }
      renderArmor();
      _save();
    } catch (err) { alert('Invalid outfit JSON: ' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
}

function npcArmorSetName(i, val) {
  if (NPC.armor[i]) { NPC.armor[i].name = val; _save(); }
}
function npcArmorSpChange(i, val) {
  if (NPC.armor[i]) { NPC.armor[i].sp = parseInt(val)||0; renderArmorBody(); _save(); }
}

function npcArmorLocChange(i, loc, checked) {
  if (NPC.armor[i]) {
    if (!NPC.armor[i].locs) NPC.armor[i].locs = {};
    NPC.armor[i].locs[loc] = checked;
    renderArmorBody();
    _save();
  }
}

function npcRemoveArmor(i) {
  NPC.armor.splice(i,1);
  renderArmor();
  _save();
}

/* ─── Inventory ─── */
function renderInventory() {
  var list = document.getElementById('npc-inv-list'); if (!list) return;
  if (!NPC.inventory.length) {
    list.innerHTML = '<div class="npc-empty-hint">No inventory.</div>';
    return;
  }
  list.innerHTML = NPC.inventory.map(function(item, i) {
    return '<div class="npc-inv-row">' +
      '<input class="npc-inv-name" value="'+_esc(item.name||'')+'" placeholder="Item..." oninput="npcInvSet('+i+',\'name\',this.value)">' +
      '<input class="npc-inv-notes" value="'+_esc(item.notes||'')+'" placeholder="Notes..." oninput="npcInvSet('+i+',\'notes\',this.value)">' +
      '<span class="npc-inv-rm" onclick="npcRemoveInv('+i+')">✕</span>' +
    '</div>';
  }).join('');
}

function npcInvSet(i, field, val) {
  if (NPC.inventory[i]) { NPC.inventory[i][field] = val; _save(); }
}

function npcAddInv() {
  NPC.inventory.push({ name:'', notes:'' });
  renderInventory();
  _save();
}

function npcRemoveInv(i) {
  NPC.inventory.splice(i,1);
  renderInventory();
  _save();
}

function npcGearSearch(val) {
  var results = document.getElementById('npc-gear-results'); if (!results) return;
  if (!val.trim()) { results.style.display='none'; return; }
  var fl = val.toLowerCase();
  var matches = DB.gearItems.filter(function(g){ return (g.name||'').toLowerCase().includes(fl); }).slice(0,20);
  if (!matches.length) { results.style.display='none'; return; }
  results.innerHTML = matches.map(function(g) {
    return '<div class="npc-gear-result" onclick="npcAddGearFromDB(\''+_esc(g.name).replace(/'/g,'\\\'')+'\')">' +
      '<div class="npc-gear-result-name">'+_esc(g.name)+'</div>' +
      '<div class="npc-gear-result-sub">'+_esc(g.category||'')+(g.cost?' · '+g.cost+'eb':'')+(g.notes?' — '+_esc(g.notes):'')+'</div>' +
    '</div>';
  }).join('');
  results.style.display = 'block';
}

function npcAddGearFromDB(name) {
  var g = DB.gearItems.find(function(x){ return x.name===name; });
  NPC.inventory.push({ name:name, notes: g?(g.notes||''):'' });
  var inp = document.getElementById('npc-gear-search-input');
  if (inp) inp.value = '';
  var res = document.getElementById('npc-gear-results');
  if (res) res.style.display='none';
  renderInventory();
  _save();
}

/* ─── Vehicles ─── */
function renderVehicles() {
  var list = document.getElementById('npc-veh-list'); if (!list) return;
  if (!NPC.vehicles.length) {
    list.innerHTML = '<div class="npc-empty-hint">No vehicles.</div>';
    return;
  }
  list.innerHTML = NPC.vehicles.map(function(v, i) {
    return '<div class="npc-veh-row">' +
      '<input class="npc-veh-name" value="'+_esc(v.name||'')+'" placeholder="Name..." oninput="npcVehSet('+i+',\'name\',this.value)">' +
      '<input class="npc-veh-type" value="'+_esc(v.type||'')+'" placeholder="Type..." style="max-width:90px" oninput="npcVehSet('+i+',\'type\',this.value)">' +
      '<input class="npc-veh-notes" value="'+_esc(v.notes||'')+'" placeholder="Notes..." oninput="npcVehSet('+i+',\'notes\',this.value)">' +
      '<span class="npc-veh-rm" onclick="npcRemoveVeh('+i+')">✕</span>' +
    '</div>';
  }).join('');
}

function npcVehSet(i, field, val) {
  if (NPC.vehicles[i]) { NPC.vehicles[i][field] = val; _save(); }
}

function npcVehSearch(val) {
  var results = document.getElementById('npc-veh-results'); if (!results) return;
  if (!val.trim()) { results.style.display='none'; return; }
  var fl = val.toLowerCase();
  var matches = DB.vehicles.filter(function(v){ return (v.name||'').toLowerCase().includes(fl); }).slice(0,20);
  if (!matches.length) { results.style.display='none'; return; }
  results.innerHTML = matches.map(function(v) {
    return '<div class="npc-veh-result" onclick="npcAddVehFromDB(\''+_esc(v.name).replace(/'/g,'\\\'')+'\')">' +
      '<div class="npc-veh-result-name">'+_esc(v.name)+'</div>' +
      '<div class="npc-veh-result-type">'+_esc(v.type||'')+'</div>' +
    '</div>';
  }).join('');
  results.style.display = 'block';
}

function npcAddVehFromDB(name) {
  var v = DB.vehicles.find(function(x){ return x.name===name; });
  NPC.vehicles.push({ name:name, type: v?v.type:'', notes:'' });
  var input = document.getElementById('npc-veh-search-input');
  if (input) input.value = '';
  var results = document.getElementById('npc-veh-results');
  if (results) results.style.display = 'none';
  renderVehicles();
  _save();
}

function npcAddVehCustom() {
  NPC.vehicles.push({ name:'', type:'', notes:'' });
  renderVehicles();
  _save();
}

function npcRemoveVeh(i) {
  NPC.vehicles.splice(i,1);
  renderVehicles();
  _save();
}

/* ─── Notes ─── */
function renderNotes() {
  var el = document.getElementById('npc-notes'); if (!el) return;
  el.value = NPC.notes || '';
}

/* ─── Export / Import ─── */
function npcSave() {
  var blob = new Blob([JSON.stringify(NPC, null, 2)], { type:'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (NPC.name || NPC.type || 'npc') + '-sheet.json';
  a.click();
}

function npcLoad(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var loaded = _npcMigrate(JSON.parse(ev.target.result));
      NPCS.push(loaded);            // import = new tab
      activeIdx = NPCS.length - 1;
      NPC = NPCS[activeIdx];
      renderNpcTabs(); renderAll(); initRoleDropdown(); applyViewMode();
      _save();
    } catch(err) { alert('Invalid NPC sheet JSON'); }
  };
  r.readAsText(f);
  e.target.value = '';
}

function npcNew() { npcNewTab(); }

/* ─── Tabs (multi-NPC) ─── */
function _npcTabLabel(n) { return (n && (n.name || n.type)) || 'NPC'; }
function renderNpcTabs() {
  var bar = document.getElementById('npc-tabs'); if (!bar) return;
  bar.innerHTML = NPCS.map(function(n, i) {
    return '<div class="npc-tab' + (i === activeIdx ? ' active' : '') + '" onclick="npcSwitchTab(' + i + ')" title="' + _esc(_npcTabLabel(n)) + '">' +
      '<span class="npc-tab-label">' + _esc(_npcTabLabel(n)) + '</span>' +
      (NPCS.length > 1 ? '<span class="npc-tab-close" onclick="event.stopPropagation();npcCloseTab(' + i + ')" title="Close">✕</span>' : '') +
    '</div>';
  }).join('') + '<div class="npc-tab-add" onclick="npcNewTab()" title="New NPC">＋</div>';
}
function npcSwitchTab(i) {
  if (i < 0 || i >= NPCS.length) return;
  activeIdx = i; NPC = NPCS[i];
  renderNpcTabs(); renderAll(); initRoleDropdown(); applyViewMode();
  _save();
}
function npcNewTab() {
  NPCS.push(makeBlankNPC());
  activeIdx = NPCS.length - 1; NPC = NPCS[activeIdx];
  renderNpcTabs(); renderAll(); initRoleDropdown(); applyViewMode();
  _save();
}
function npcCloseTab(i) {
  if (NPCS.length <= 1) return;
  if (!confirm('Close this NPC tab? (export first if you want to keep it)')) return;
  NPCS.splice(i, 1);
  if (activeIdx >= NPCS.length) activeIdx = NPCS.length - 1;
  else if (i < activeIdx) activeIdx--;
  NPC = NPCS[activeIdx];
  renderNpcTabs(); renderAll(); initRoleDropdown(); applyViewMode();
  _save();
}

/* ═══ VIEW MODES (read-only themed documents) ═══ */
function _vNum(x){ var m=String(x==null?'':x).match(/-?\d+(\.\d+)?/); return m?parseFloat(m[0]):0; }
function _npcHC(n){ return (n.cyberware||[]).reduce(function(t,c){ return t+_vNum(c.hc); },0); }
function _npcArmed(n){ return (n.weapons||[]).length>0; }
function _npcStat(n,s){ return (n.stats&&n.stats[s])||0; }
function _npcTopSkills(n,k){ return (n.skills||[]).filter(function(s){return (s.val||0)>0;}).sort(function(a,b){return (b.val||0)-(a.val||0);}).slice(0,k||6); }
function _npcThreatScore(n){ return _npcStat(n,'REF')+_npcStat(n,'BODY') + (n.weapons||[]).length*3 + (n.cyberware||[]).length*2 + (n.saVal||0); }
function _npcThreat(n){ var s=_npcThreatScore(n); return s>=34?'EXTREME':s>=24?'HIGH':s>=14?'MEDIUM':'LOW'; }
function _npcBounty(n){ var s=_npcThreatScore(n); return (Math.max(1,Math.round(s*3))*100) + ' eb'; }
function _vName(n){ return _esc(n.name||n.type||'UNKNOWN'); }
function _vPhoto(n, cls){
  return n.photo ? '<img class="'+cls+'" src="'+n.photo+'">' : '<div class="'+cls+' npc-v-noimg">NO IMAGE</div>';
}
function _vList(arr, fmt, empty){ return (arr&&arr.length) ? arr.map(fmt).join('') : '<div class="npc-v-empty">'+ (empty||'—') +'</div>'; }
function _vStatsGrid(n){
  return '<div class="npc-v-stats">' + NPC_STATS.map(function(s){
    return '<div class="npc-v-stat"><span>'+s+'</span><b>'+_npcStat(n,s)+'</b></div>';
  }).join('') + '</div>';
}
/* ── per-row producers (arrays of <div class="nv-line"> strings) for pagination ──
   Structure: name in .nv-l (flex:1), meta right in .nv-r. Avoids
   justify-content:space-between, which html2canvas mis-renders in PDF export. */
function _rowsSkills(n){ return (n.skills||[]).slice().sort(function(a,b){return (b.val||0)-(a.val||0);}).map(function(s){ return '<div class="nv-line"><span class="nv-l">'+_esc(s.name)+(s.stat?' <span class="nv-dim">'+s.stat+'</span>':'')+'</span><b class="nv-r">'+(s.val||0)+'</b></div>'; }); }
function _rowsCyber(n){ return (n.cyberware||[]).map(function(c){ return '<div class="nv-line"><span class="nv-l">'+_esc(c.name)+'</span><span class="nv-r nv-dim">'+_esc(c.type||'')+' · HC '+_vNum(c.hc)+'</span></div>'; }); }
function _rowsWeapons(n){ return (n.weapons||[]).map(function(w){ var m=[w.damage,w.ammo,w.rof,w.range].filter(Boolean).map(_esc).join(' · '); return '<div class="nv-line"><span class="nv-l">'+_esc(w.name)+'</span>'+(m?'<span class="nv-r nv-dim">'+m+'</span>':'')+'</div>'; }); }
function _rowsArmor(n){ return (n.armor||[]).map(function(a){ var ls=Object.keys(a.locs||{}).filter(function(k){return a.locs[k];}); return '<div class="nv-line"><span class="nv-l">'+_esc(a.name)+'</span><span class="nv-r nv-dim">SP '+(a.sp||0)+(ls.length?' · '+ls.join('/'):'')+'</span></div>'; }); }
function _rowsInv(n){ return (n.inventory||[]).map(function(it){ return '<div class="nv-line"><span class="nv-l">'+_esc(it.name)+'</span>'+(it.notes?'<span class="nv-r nv-dim">'+_esc(it.notes)+'</span>':'')+'</div>'; }); }
function _rowsVeh(n){ return (n.vehicles||[]).map(function(v){ return '<div class="nv-line"><span class="nv-l">'+_esc(v.name)+'</span>'+(v.type?'<span class="nv-r nv-dim">'+_esc(v.type)+'</span>':'')+'</div>'; }); }

/* Dossier as discrete flow items (for the pagination engine). L = label overrides. */
function _vDossierSections(n, L){
  L = L || {};
  return [
    { sec:(L.attrs||'Attributes'), block:_vStatsGrid(n) },
    { sec:(L.skills||'Skills'),    rows:_rowsSkills(n),  empty:'No skills recorded.' },
    { sec:(L.cyber||'Cyberware'),  rows:_rowsCyber(n),   empty:'No cyberware.' },
    { sec:(L.weapons||'Armament'), rows:_rowsWeapons(n), empty:'Unarmed.' },
    { sec:(L.armor||'Protection'), rows:_rowsArmor(n),   empty:'No armor.' },
    { sec:(L.inv||'Effects &amp; gear'), rows:_rowsInv(n), empty:'No items.' },
    { sec:(L.veh||'Transport'),    rows:_rowsVeh(n),     empty:'No vehicles.' },
    { sec:(L.notes||'Notes'),      block:'<div class="nv-notes">'+(_esc(n.notes)||'—')+'</div>' }
  ];
}

/* ── CP2020 classic-sheet helpers (R.Talsorian style) ── */
function _cpBTM(n){ var b=_npcStat(n,'BODY'); return b<=2?0:b<=4?-1:b<=7?-2:b<=9?-3:-4; }
function _cpStats(n){
  return '<div class="cp-stats">'+NPC_STATS.map(function(s){ return '<span class="cp-stat">'+s+'<b>[ '+_npcStat(n,s)+' ]</b></span>'; }).join('')+'</div>';
}
function _cpArmorSP(n){
  var sp={skull:0,face:0,neck:0,torso:0,abd:0,rarm:0,larm:0,rleg:0,lleg:0};
  (n.armor||[]).forEach(function(a){ if(!a.locs||!a.sp)return; var v=parseInt(a.sp)||0;
    if(a.locs.head){sp.skull+=v;sp.face+=v;sp.neck+=v;}
    if(a.locs.torso){sp.torso+=v;sp.abd+=v;}
    if(a.locs.rarm)sp.rarm+=v; if(a.locs.larm)sp.larm+=v; if(a.locs.rleg)sp.rleg+=v; if(a.locs.lleg)sp.lleg+=v;
  });
  return sp;
}
function _cpArmorTable(n){
  var sp=_cpArmorSP(n);
  var cols=[['Skull',sp.skull],['Face',sp.face],['Neck',sp.neck],['Torso',sp.torso],['Abd.',sp.abd],['R.Arm',sp.rarm],['L.Arm',sp.larm],['R.Leg',sp.rleg],['L.Leg',sp.lleg]];
  return '<table class="cp-armortbl"><tr><td class="cp-armortbl-h">Location</td>'+cols.map(function(c){return '<td class="cp-armortbl-loc">'+c[0]+'</td>';}).join('')+'</tr>'+
    '<tr><td class="cp-armortbl-h">Armor SP</td>'+cols.map(function(c){return '<td>'+(c[1]||'')+'</td>';}).join('')+'</tr></table>';
}
function _cpDamageTrack(){
  var groups=[['LIGHT','0'],['SERIOUS','-1'],['CRITICAL','-2'],['MORTAL 0','-3'],['MORTAL 1','-4'],['MORTAL 2','-5'],['MORTAL 3','-6']];
  return '<div class="cp-dmg">'+groups.map(function(g){ return '<div class="cp-dmg-col"><div class="cp-dmg-label">'+g[0]+'</div><div class="cp-dmg-boxes">▢▢▢▢</div><div class="cp-dmg-stun">Stun '+g[1]+'</div></div>'; }).join('')+'</div>';
}
function _cpSkillRows(n){
  return (n.skills||[]).slice().sort(function(a,b){return (b.val||0)-(a.val||0);}).map(function(s){
    return '<div class="cp-skill"><span class="cp-skill-name">'+_esc(s.name)+(s.stat?' <i>('+s.stat+')</i>':'')+'</span><span class="cp-leader"></span><span class="cp-skill-val">[ '+(s.val||0)+' ]</span></div>';
  });
}
function _cpLead(n){
  return '<div class="cp-idrow"><div class="cp-idcol">' +
      '<div class="cp-bar-line"><span class="cp-bar">HANDLE</span><span class="cp-fieldval">'+_vName(n)+'</span></div>' +
      '<div class="cp-bar-line"><span class="cp-bar">ROLE</span><span class="cp-fieldval">'+_esc(n.role||n.type||'—')+'</span></div>' +
      '<div class="cp-bar cp-bar-full">STATS</div>'+_cpStats(n) +
    '</div><div class="cp-photobox">'+_vPhoto(n,'cp-photo')+'</div></div>' +
    '<div class="cp-bar cp-bar-full">ARMOR &amp; SAVE</div>'+_cpArmorTable(n) +
    '<div class="cp-saverow"><div class="cp-savebox"><span>SAVE</span><b>'+_npcStat(n,'BODY')+'</b></div><div class="cp-savebox"><span>BTM</span><b>'+_cpBTM(n)+'</b></div></div>' +
    '<div class="cp-bar cp-bar-full">DAMAGE TRACK</div>'+_cpDamageTrack();
}

/* ── Bureaucratic boilerplate: deliberately long corporate/admin documents ──
   A "Length" document field injects standard clauses / notices / appendices,
   which the paginator naturally spills onto extra pages. */
var _DOC_FILLER = {
  corpo: [
    { t:'TERMS OF ENGAGEMENT', p:'The individual described herein (the "Asset") is engaged under standard corporate indenture. All deliverables, intellectual product, and incidental innovation arising in the course of duty vest irrevocably in the Corporation. The Asset acknowledges that continued employment is contingent on quarterly performance review and satisfactory loyalty metrics.' },
    { t:'CONFIDENTIALITY UNDERTAKING', p:'The Asset shall not disclose, replicate, or otherwise externalise any proprietary information, operational schedule, security posture, or personnel record, in any medium organic or synthetic, for a period of ninety-nine (99) years following separation. Breach triggers immediate liquidated damages and may invoke Section 7 remedies without prior notice.' },
    { t:'BIOMETRIC & NEURAL DATA CONSENT', p:'The Asset consents to continuous collection of biometric, genetic, neural, and locational telemetry for the purposes of access control, productivity analysis, and threat assessment. Data may be retained indefinitely and shared with affiliated entities, insurers, and contracted security providers at the Corporation’s sole discretion.' },
    { t:'STANDARD CONDUCT & LOYALTY CLAUSES', p:'The Asset shall maintain conduct consistent with brand values at all times, on and off premises. Fraternisation with competitor personnel, unsanctioned media contact, and participation in collective bargaining are grounds for reassignment. Loyalty is presumed, audited, and non-refundable.' },
    { t:'INDEMNITY, LIABILITY & ASSET FORFEITURE', p:'The Corporation accepts no liability for injury, cyberpsychosis, or terminal outcome arising from assigned duties. The Asset indemnifies the Corporation against all claims and waives recourse. Outstanding obligations, including cyberware financing, survive incapacity and attach to the estate.' },
    { t:'TERMINATION & REASSIGNMENT PROTOCOL', p:'Engagement may be terminated for cause, for convenience, or for strategic realignment, effective immediately. Upon termination the Asset shall surrender all issued equipment, credentials, and proprietary augmentations, and submit to standard memory-audit procedures where applicable.' },
    { t:'APPENDIX A — COMPLIANCE ATTESTATION', p:'I attest that the foregoing record is accurate and complete, that I have read and understood all clauses, and that my consent is freely given. I understand that misrepresentation constitutes corporate fraud subject to Section 7 remedies. Signature on file. Witnessed by Human Resources.' },
    { t:'APPENDIX B — REVISION HISTORY', p:'Rev 1.0 initial filing. Rev 1.4 added biometric schedule. Rev 2.1 harmonised with revised Loyalty Framework. Rev 3.0 incorporated post-incident liability waiver. This document supersedes all prior versions and is valid only with current corporate seal.' }
  ],
  admin: [
    { t:'STATUTORY NOTICE', p:'This registration is issued under the Night City Municipal Code, Title 14, as amended. Provision of false information is an offence punishable by fine, detention, or both. The registrant is required to notify the Authority of any change of designation within five (5) working days.' },
    { t:'DECLARATION OF ACCURACY', p:'I declare that the particulars entered on this form are true and complete to the best of my knowledge. I understand that this declaration is made for the purposes of municipal record and may be cross-referenced against other registries, databases, and surveillance archives.' },
    { t:'SCHEDULE 1 — FEES, LEVIES & DUTIES', p:'A standard processing fee applies to all registrations. Additional levies may be assessed for expedited handling, biometric re-enrolment, duplicate issuance, and archival retrieval. All fees are non-refundable and payable in certified municipal scrip prior to issuance.' },
    { t:'DATA RETENTION & SURVEILLANCE NOTICE', p:'Records created under this form are retained for a minimum of seven (7) years and may be retained indefinitely where flagged. The Authority reserves the right to share records with law enforcement, NetWatch, accredited corporations, and such other parties as municipal policy may direct.' },
    { t:'CONTINUATION SHEET 14-A/2(b)', p:'Where the space provided is insufficient, particulars are continued on this sheet. Each continuation must bear the same reference number and be initialled by the issuing officer. Unsigned continuation sheets are void and will not be entered into the record.' },
    { t:'APPENDIX — APPEALS PROCEDURE', p:'A registrant aggrieved by any determination may lodge an appeal in writing within fourteen (14) days, accompanied by the prescribed fee. Appeals are heard by the Municipal Review Panel, whose decision is final. Pending appeal, the contested determination remains in force.' }
  ]
};
function _fillerItems(kind, level){
  var pool = _DOC_FILLER[kind] || [];
  var count = level==='Maximal bureaucracy' ? pool.length : level==='Verbose' ? 4 : level==='Standard' ? 2 : 0;
  return pool.slice(0, count).map(function(s){ return { sec:s.t, block:'<div class="nv-notes nv-filler">'+s.p+'</div>' }; });
}
var _DOC_LEN_OPTS = ['Concise','Standard','Verbose','Maximal bureaucracy'];

/* ── Page formats (global, persisted) ── */
var NPC_PAGE_SIZES = {
  a4:  { label:'A4',           w:794, h:1122, fmt:'a4', orient:'portrait'  },
  a5v: { label:'A5 Portrait',  w:559, h:794,  fmt:'a5', orient:'portrait'  },
  a5h: { label:'A5 Landscape', w:794, h:559,  fmt:'a5', orient:'landscape' },
  a6:  { label:'A6',           w:397, h:559,  fmt:'a6', orient:'portrait'  },
  a7:  { label:'A7',           w:279, h:397,  fmt:'a7', orient:'portrait'  }
};
var _npcPageSize = 'a4';
var _npcPageUserSet = false;
var _lastViewType = 'netwatch';
try {
  var _ps0 = localStorage.getItem('bartmoss_npc_page_size');
  if (_ps0 && NPC_PAGE_SIZES[_ps0]) _npcPageSize = _ps0;
  _npcPageUserSet = localStorage.getItem('bartmoss_npc_page_userset') === '1';
} catch(e){}

/* read a per-view document field: NPC.viewData[viewKey][field] */
function _vd(n, key, field, fb){
  var o = ((n.viewData||{})[key]) || {};
  var v = o[field];
  return (v == null || v === '') ? (fb == null ? '' : fb) : v;
}

/* No universal fields: in View mode, character-sheet data (name, type, notes,
   photo, stats…) is READ-ONLY. The side panel only edits document-presentation
   fields (NPC.viewData.*) declared per view in sidePanelExtra. */
var NPC_SIDE_UNIVERSAL = [];

var NPC_VIEWS = {
  netwatch: { label:'NetWatch card', theme:'netwatch', defaultSize:'a5v', sidePanelExtra:[
    { key:'viewData.netwatch.status', label:'Status', type:'select', opts:['ACTIVE','MONITORING','CLOSED','TERMINATED'] },
    { key:'viewData.netwatch.caseRef', label:'Case ref', type:'text' }
  ], render:function(n){
    var caseRef = _esc(_vd(n,'netwatch','caseRef')) || ('NW-'+(Math.abs(_hash(_vName(n)))%900000+100000));
    var status = _esc(_vd(n,'netwatch','status','ACTIVE'));
    return '<div class="nv-banner">⚠ NETWATCH — CLASSIFIED — EYES ONLY ⚠</div>' +
      '<div class="nv-head">'+ _vPhoto(n,'nv-photo') +
        '<div class="nv-headmeta">' +
          '<div class="nv-title">'+_vName(n)+'</div>' +
          '<div class="nv-sub">'+_esc(n.type||'—')+(n.role?' · '+_esc(n.role):'')+'</div>' +
          '<div class="nv-ref">FILE #'+caseRef+' · '+status+'</div>' +
          '<div class="nv-threat t-'+_npcThreat(n).toLowerCase()+'">THREAT: '+_npcThreat(n)+'</div>' +
        '</div></div>' +
      '<div class="nv-sec">KNOWN AUGMENTATIONS</div>' +
      _vList(n.cyberware, function(c){ return '<div class="nv-line"><span class="nv-l">▣ '+_esc(c.name)+'</span><span class="nv-r nv-dim">'+_esc(c.type||'')+'</span></div>'; }, 'No registered cyberware.') +
      '<div class="nv-sec">ASSESSED CAPABILITIES</div>' +
      _vList(_npcTopSkills(n,8), function(s){ return '<div class="nv-line"><span class="nv-l">'+_esc(s.name)+'</span><b class="nv-r">'+s.val+'</b></div>'; }, 'No data.') +
      (_npcArmed(n)?'<div class="nv-flag">⚠ SUBJECT IS ARMED</div>':'') +
      '<div class="nv-sec">FIELD NOTES</div><div class="nv-notes">'+(_esc(n.notes)||'No notes on file.')+'</div>' +
      '<div class="nv-stamp">NETWATCH</div>';
  }},
  corpo: { label:'Corporate card', theme:'corpo', defaultSize:'a5v', sidePanelExtra:[
    { key:'viewData.corpo.department', label:'Department', type:'text' },
    { key:'viewData.corpo.classification', label:'Classification', type:'select', opts:['A-CLASS','B-CLASS','C-CLASS','EXEC'] }
  ], render:function(n){
    var cls = _esc(_vd(n,'corpo','classification','B-CLASS'));
    var dept = _esc(_vd(n,'corpo','department'));
    return '<div class="nv-corphead"><div class="nv-corplogo">◆</div><div><div class="nv-corpname">PERSONNEL DOSSIER</div><div class="nv-sub">Confidential — Internal Use</div></div><div class="nv-class">'+cls+'</div></div>' +
      '<div class="nv-head">'+ _vPhoto(n,'nv-photo') +
        '<div class="nv-headmeta"><div class="nv-title">'+_vName(n)+'</div>' +
          '<div class="nv-kv"><span>Position</span><b>'+_esc(n.role||n.type||'—')+'</b></div>' +
          (dept?'<div class="nv-kv"><span>Department</span><b>'+dept+'</b></div>':'') +
          '<div class="nv-kv"><span>Clearance</span><b>'+_npcThreat(n)+'</b></div>' +
          '<div class="nv-kv"><span>Asset value</span><b>'+_npcBounty(n)+'</b></div></div></div>' +
      '<div class="nv-sec">CORE COMPETENCIES</div>' +
      _vList(_npcTopSkills(n,8), function(s){ return '<div class="nv-line"><span class="nv-l">'+_esc(s.name)+'</span><span class="nv-r"><span class="nv-bar"><i style="width:'+(s.val*10)+'%"></i></span></span></div>'; }, 'None recorded.') +
      '<div class="nv-sec">REMARKS</div><div class="nv-notes">'+(_esc(n.notes)||'—')+'</div>';
  }},
  admin: { label:'Admin card', theme:'admin', defaultSize:'a5v', sidePanelExtra:[
    { key:'viewData.admin.department', label:'Department', type:'text' },
    { key:'viewData.admin.clearance', label:'Clearance', type:'text' }
  ], render:function(n){
    function box(l,v){ return '<div class="nv-formbox"><span>'+l+'</span><div>'+(_esc(v)||'&nbsp;')+'</div></div>'; }
    var dept = _vd(n,'admin','department');
    return '<div class="nv-formhead">CITIZEN REGISTRATION — FORM 27-B/6 <span class="nv-ref">REF '+(Math.abs(_hash(_vName(n)))%9000000+1000000)+'</span></div>' +
      '<div class="nv-formgrid">' + box('Name',n.name) + box('Designation',n.type) + box('Role',n.role) + box('Department',dept) + box('Clearance',_vd(n,'admin','clearance')) + box('Special Ability',n.sa+(n.saVal?(' '+n.saVal):'')) + '</div>' +
      '<div class="nv-sec">ATTRIBUTES</div>'+_vStatsGrid(n) +
      '<div class="nv-sec">DECLARED EQUIPMENT</div>' +
      _vList((n.weapons||[]).concat(n.inventory||[]), function(it){ return '<div class="nv-line">☐ '+_esc(it.name)+'</div>'; }, 'None declared.') +
      '<div class="nv-formfoot">Stamped &amp; filed · NIGHT CITY MUNICIPAL AUTHORITY</div>';
  }},
  wanted: { label:'Wanted Poster', theme:'wanted', defaultSize:'a5v', sidePanelExtra:[], render:function(n){
    return '<div class="nv-wanted">WANTED</div>' +
      _vPhoto(n,'nv-wphoto') +
      '<div class="nv-walias">"'+_vName(n)+'"</div>' +
      (_npcArmed(n)?'<div class="nv-warmed">ARMED &amp; DANGEROUS</div>':'') +
      '<div class="nv-wbounty">REWARD<br><b>'+_npcBounty(n)+'</b></div>' +
      '<div class="nv-wmeta">Threat level: <b>'+_npcThreat(n)+'</b></div>' +
      '<div class="nv-sec">LAST KNOWN</div><div class="nv-notes">'+(_esc(n.notes)||'Whereabouts unknown.')+'</div>' +
      '<div class="nv-wfoot">Contact your local fixer · No questions asked</div>';
  }},
  medical: { label:'Trauma medical', theme:'medical', defaultSize:'a5v', sidePanelExtra:[
    { key:'viewData.medical.bloodType', label:'Blood type', type:'select', opts:['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
    { key:'viewData.medical.insurance', label:'Insurance', type:'text' },
    { key:'viewData.medical.physician', label:'Physician', type:'text' }
  ], render:function(n){
    var hc=_npcHC(n); var hum=(_npcStat(n,'EMP')*10)-hc;
    var blood=_esc(_vd(n,'medical','bloodType')) || (['A','B','AB','O'][Math.abs(_hash(_vName(n)))%4]+'+');
    var ins=_esc(_vd(n,'medical','insurance')) || (_npcThreatScore(n)>20?'Platinum':'Gold');
    var phys=_esc(_vd(n,'medical','physician','—'));
    return '<div class="nv-medhead">✚ TRAUMA TEAM — PATIENT CHART</div>' +
      '<div class="nv-head">'+_vPhoto(n,'nv-photo')+'<div class="nv-headmeta"><div class="nv-title">'+_vName(n)+'</div>' +
        '<div class="nv-kv"><span>Blood</span><b>'+blood+'</b></div>' +
        '<div class="nv-kv"><span>Coverage</span><b>'+ins+'</b></div>' +
        '<div class="nv-kv"><span>Physician</span><b>'+phys+'</b></div></div></div>' +
      '<div class="nv-sec">VITALS</div>' +
      '<div class="nv-vitals"><div>BODY <b>'+_npcStat(n,'BODY')+'</b></div><div>EMP <b>'+_npcStat(n,'EMP')+'</b></div><div>Humanity <b>'+hum+'</b></div><div>Total HC <b>'+hc+'</b></div></div>' +
      '<div class="nv-sec">IMPLANT LOG</div>' +
      _vList(n.cyberware, function(c){ return '<div class="nv-line"><span class="nv-l">⊕ '+_esc(c.name)+'</span><span class="nv-r nv-dim">HC '+_vNum(c.hc)+'</span></div>'; }, 'No implants on record.') +
      '<div class="nv-sec">CLINICAL NOTES</div><div class="nv-notes">'+(_esc(n.notes)||'Patient stable.')+'</div>';
  }},
  fixer: { label:'Fixer contact', theme:'fixer', defaultSize:'a6', sidePanelExtra:[
    { key:'viewData.fixer.aliases', label:'Aliases', type:'text' },
    { key:'viewData.fixer.fee', label:'Fee', type:'text' }
  ], render:function(n){
    var fee=_esc(_vd(n,'fixer','fee')) || _npcBounty(n);
    var aliases=_esc(_vd(n,'fixer','aliases'));
    return '<div class="nv-fixhead">▸ CONTACT</div>' +
      '<div class="nv-head">'+_vPhoto(n,'nv-photo')+'<div class="nv-headmeta"><div class="nv-title">'+_vName(n)+'</div>' +
        '<div class="nv-sub">'+_esc(n.type||n.role||'Operator')+'</div>' +
        (aliases?'<div class="nv-kv"><span>Aliases</span><b>'+aliases+'</b></div>':'') +
        '<div class="nv-kv"><span>Rate</span><b>'+fee+'</b></div>' +
        '<div class="nv-kv"><span>Reliability</span><b>'+['Shaky','Fair','Solid','Rock'][Math.min(3,Math.floor(_npcThreatScore(n)/12))]+'</b></div></div></div>' +
      '<div class="nv-sec">SPECIALTIES</div>' +
      _vList(_npcTopSkills(n,5), function(s){ return '<span class="nv-chip">'+_esc(s.name)+' '+s.val+'</span>'; }, 'Generalist.') +
      '<div class="nv-sec">BRINGS TO THE TABLE</div>' +
      _vList(n.weapons, function(w){ return '<div class="nv-line"><span class="nv-l">'+_esc(w.name)+'</span>'+(w.damage?'<span class="nv-r nv-dim">'+_esc(w.damage)+'</span>':'')+'</div>'; }, 'Unarmed.') +
      '<div class="nv-sec">WORD ON THE STREET</div><div class="nv-notes">'+(_esc(n.notes)||'—')+'</div>';
  }},
  card: { label:'Collectible Card', theme:'card', defaultSize:'a6', sidePanelExtra:[], render:function(n){
    return '<div class="nv-card">' +
      '<div class="nv-cardtop"><span class="nv-cardname">'+_vName(n)+'</span><span class="nv-cardtype">'+_esc(n.type||n.role||'')+'</span></div>' +
      _vPhoto(n,'nv-cardimg') +
      _vStatsGrid(n) +
      '<div class="nv-cardskills">'+_npcTopSkills(n,4).map(function(s){ return '<span class="nv-chip">'+_esc(s.name)+' '+s.val+'</span>'; }).join('')+'</div>' +
      '<div class="nv-cardflavor">'+(_esc(n.notes)||'A face in the crowd.')+'</div>' +
      '<div class="nv-cardfoot">THREAT '+_npcThreat(n)+'</div></div>';
  }},
  badge: { label:'ID badge', theme:'badge', defaultSize:'a6', sidePanelExtra:[
    { key:'viewData.badge.department', label:'Department', type:'text' },
    { key:'viewData.badge.clearance', label:'Clearance', type:'text' },
    { key:'viewData.badge.empId', label:'Employee ID', type:'text' }
  ], render:function(n){
    var dept=_esc(_vd(n,'badge','department')) || 'NIGHT CITY';
    var clr=_esc(_vd(n,'badge','clearance')) || _npcThreat(n);
    var eid=_esc(_vd(n,'badge','empId')) || (Math.abs(_hash(_vName(n)))%90000000+10000000);
    return '<div class="nv-badge">' +
      '<div class="nv-badgehead">'+dept+' · ID</div>' +
      '<div class="nv-badgebody">'+_vPhoto(n,'nv-badgeimg')+
        '<div class="nv-badgemeta"><div class="nv-title">'+_vName(n)+'</div>' +
          '<div class="nv-sub">'+_esc(n.role||n.type||'Civilian')+'</div>' +
          '<div class="nv-kv"><span>Clearance</span><b>'+clr+'</b></div>' +
          '<div class="nv-kv"><span>ID</span><b>'+eid+'</b></div></div></div>' +
      '<div class="nv-barcode"></div></div>';
  }},

  /* ── Long "file" versions (multi-page A4). If no name → frame as a POSITION/role document. ── */
  netwatch_file: { label:'NetWatch file', theme:'netwatch', paged:true, defaultSize:'a4', sidePanelExtra:[
    { key:'viewData.netwatch_file.caseNum', label:'Case #', type:'text' },
    { key:'viewData.netwatch_file.assignedAgent', label:'Assigned agent', type:'text' },
    { key:'viewData.netwatch_file.status', label:'Status', type:'select', opts:['ACTIVE','MONITORING','CLOSED','TERMINATED'] }
  ],
  runningHeader:function(n){ return 'NETWATCH SURVEILLANCE DIVISION · EYES ONLY · CLASSIFIED'; },
  runningFooter:function(n,p,c){ return 'Unauthorised access prosecuted under Cybercrime Act 87-C · NetWatch Internal · Page '+p+'/'+c; },
  flow:function(n){
    var named = !!n.name;
    var title = named ? _vName(n) : ('SURVEILLANCE PROFILE — ' + (_esc(n.type||n.role)||'UNCLASSIFIED OPERATIVE'));
    var intro = named ? 'Individual surveillance dossier compiled from intercepts and field reports.'
                      : 'Standing surveillance profile for operatives of this designation. No specific individual identified on file.';
    var caseNum = _esc(_vd(n,'netwatch_file','caseNum')) || ('NW-'+(Math.abs(_hash(title))%900000+100000));
    var agent = _esc(_vd(n,'netwatch_file','assignedAgent','—'));
    var status = _esc(_vd(n,'netwatch_file','status','ACTIVE'));
    var lead = '<div class="nv-fhead"><div class="nv-fhead-main"><div class="nv-ftitle">'+title+'</div>' +
        '<div class="nv-sub">'+_esc(n.type||'—')+(n.role?' · '+_esc(n.role):'')+'</div></div>' +
        '<div class="nv-fhead-side"><div class="nv-ref">FILE #'+caseNum+'</div><div class="nv-statusbadge">'+status+'</div></div></div>' +
      '<div class="nv-idblock">'+_vPhoto(n,'nv-fphoto')+
        '<table class="nv-metatbl">' +
          '<tr><td>Threat level</td><td><span class="nv-threat t-'+_npcThreat(n).toLowerCase()+'">'+_npcThreat(n)+'</span></td></tr>' +
          '<tr><td>Assigned agent</td><td>'+agent+'</td></tr>' +
          '<tr><td>Armed</td><td>'+(_npcArmed(n)?'YES — proceed with caution':'No indication')+'</td></tr>' +
          '<tr><td>Cyber load</td><td>HC '+_npcHC(n)+'</td></tr>' +
        '</table></div>' +
      '<div class="nv-intro">'+intro+'</div>';
    return [{ block:lead }].concat(_vDossierSections(n, { skills:'Assessed capabilities', cyber:'Known augmentations', inv:'Recovered effects', notes:'Field notes' }));
  }},
  corpo_file: { label:'Corporate file', theme:'corpo', paged:true, defaultSize:'a4', sidePanelExtra:[
    { key:'viewData.corpo_file.department', label:'Department', type:'text' },
    { key:'viewData.corpo_file.title', label:'Job title', type:'text' },
    { key:'viewData.corpo_file.supervisor', label:'Supervisor', type:'text' },
    { key:'viewData.corpo_file.verbosity', label:'Length', type:'select', opts:_DOC_LEN_OPTS }
  ],
  pageDecoration:function(n){ return '<div class="nv-watermark">CONFIDENTIAL</div>'; },
  runningHeader:function(n){ return (n.name?'PERSONNEL FILE':'POSITION DESCRIPTION')+' · CONFIDENTIAL · INTERNAL USE'; },
  runningFooter:function(n,p,c){ var ref='HR-'+(Math.abs(_hash(n.name?_vName(n):(_esc(n.role||n.type)||'POS')))%900000+100000); return 'Human Resources Division · Document '+ref+' · Page '+p+'/'+c; },
  flow:function(n){
    var named = !!n.name; var posting = !named;
    var title = named ? _vName(n) : ('POSITION: ' + (_esc(n.role||n.type)||'UNSPECIFIED'));
    var intro = posting ? 'JOB POSTING / POSITION DESCRIPTION — the following defines the standard profile, competencies and issued equipment for this role.'
                        : 'Confidential personnel dossier — internal use only.';
    var dept = _esc(_vd(n,'corpo_file','department','—'));
    var jt = _esc(_vd(n,'corpo_file','title')) || _esc(n.role||n.type||'—');
    var sup = _esc(_vd(n,'corpo_file','supervisor','—'));
    var lead = '<div class="nv-corphead"><div class="nv-corplogo">◆</div><div class="nv-corphead-txt"><div class="nv-corpname">'+(posting?'POSITION DESCRIPTION':'PERSONNEL FILE')+'</div><div class="nv-sub">Confidential — Internal Use</div></div><div class="nv-class">CONFIDENTIAL</div></div>' +
      '<div class="nv-idblock">'+_vPhoto(n,'nv-fphoto')+
        '<table class="nv-metatbl">' +
          '<tr><td>'+(posting?'Title':'Name')+'</td><td>'+(named?_vName(n):jt)+'</td></tr>' +
          '<tr><td>'+(posting?'Title':'Position')+'</td><td>'+jt+'</td></tr>' +
          '<tr><td>Department</td><td>'+dept+'</td></tr>' +
          '<tr><td>Clearance</td><td>'+_npcThreat(n)+'</td></tr>' +
          '<tr><td>Supervisor</td><td>'+sup+'</td></tr>' +
          '<tr><td>'+(posting?'Pay grade':'Asset value')+'</td><td>'+_npcBounty(n)+'</td></tr>' +
        '</table></div>' +
      '<div class="nv-intro">'+intro+'</div>';
    return [{ block:lead }]
      .concat(_vDossierSections(n, { attrs:'Required attributes', skills:(posting?'Required competencies':'Core competencies'), cyber:'Authorised augmentations', weapons:'Issued armament', armor:'Issued protection', inv:'Issued equipment', notes:(posting?'Conditions':'Remarks') }))
      .concat(_fillerItems('corpo', _vd(n,'corpo_file','verbosity','Concise')));
  }},
  admin_file: { label:'Admin file', theme:'admin', paged:true, defaultSize:'a4', sidePanelExtra:[
    { key:'viewData.admin_file.department', label:'Department', type:'text' },
    { key:'viewData.admin_file.position', label:'Position', type:'text' },
    { key:'viewData.admin_file.fileRef', label:'File ref', type:'text' },
    { key:'viewData.admin_file.verbosity', label:'Length', type:'select', opts:_DOC_LEN_OPTS }
  ],
  runningHeader:function(n){ return 'NIGHT CITY MUNICIPAL AUTHORITY · '+(n.name?'CITIZEN REGISTRATION':'POSITION REGISTRATION'); },
  runningFooter:function(n,p,c){ var ref=_esc(_vd(n,'admin_file','fileRef'))||('REF '+(Math.abs(_hash(_vName(n)))%9000000+1000000)); return 'Stamped &amp; filed · NCMA · '+ref+' · Retain 7 years · Page '+p+'/'+c; },
  flow:function(n){
    var named = !!n.name;
    var head = named ? 'CITIZEN REGISTRATION — FORM 27-B/6' : 'POSITION & UNIFORM REGISTRATION — FORM 14-A/2';
    var ref = _esc(_vd(n,'admin_file','fileRef')) || ('REF '+(Math.abs(_hash(_vName(n)))%9000000+1000000));
    var dept = _esc(_vd(n,'admin_file','department'));
    var pos = _esc(_vd(n,'admin_file','position')) || _esc(n.role||n.type);
    function box(l,v){ return '<div class="nv-formbox"><span>'+l+'</span><div>'+(_esc(v)||'&nbsp;')+'</div></div>'; }
    var fields = '<div class="nv-adminfields">' +
        box(named?'Name':'Position', n.name||pos) +
        box('Designation', n.type) +
        box('Department', dept) +
        box('Role', n.role) +
        box('Special Ability', (n.sa||'')+(n.saVal?(' '+n.saVal):'')) +
      '</div>';
    var photo = '<div class="nv-adminphoto">'+(n.photo?('<img src="'+n.photo+'">'):'<span class="nv-adminphoto-ph">PHOTO</span>')+'</div>';
    var lead = '<div class="nv-formhead"><div class="nv-seal">NCMA</div><div class="nv-formhead-txt"><b>NIGHT CITY MUNICIPAL AUTHORITY</b><br>'+head+'</div><span class="nv-ref">'+ref+'</span></div>' +
      '<div class="nv-adminid">'+fields+photo+'</div>';
    var sig = { block:'<div class="nv-sigrow"><div class="nv-sig">Issuing Officer</div><div class="nv-sig">Date</div><div class="nv-sig">Stamp</div></div>' };
    return [{ block:lead }]
      .concat(_vDossierSections(n, { attrs:'Registered attributes', skills:'Certified proficiencies', cyber:'Declared augmentations', weapons:'Declared armament', armor:'Issued protective gear', inv:'Declared equipment', veh:'Registered vehicles', notes:'Official remarks' }))
      .concat(_fillerItems('admin', _vd(n,'admin_file','verbosity','Concise')))
      .concat([sig]);
  }},

  /* ── CP2020 classic R.Talsorian sheet (multi-page A4, faithful style) ── */
  cp2020: { label:'CP2020 sheet', theme:'cp2020', paged:true, defaultSize:'a4', sidePanelExtra:[],
    runningHeader:function(n){ return '<span class="cp-htitle">CYBERPUNK 2020</span><span class="cp-hsub">CHARACTER SHEET</span>'; },
    runningFooter:function(n,p,c){ return 'CYBERPUNK 2020 · fan reference sheet · Page '+p+'/'+c; },
    flow:function(n){
      var items = [{ block:_cpLead(n) }];
      items.push({ sec:'SKILLS', rows:_cpSkillRows(n), empty:'No skills recorded.' });
      items.push({ sec:'CYBERNETICS &amp; CYBERWARE', rows:_rowsCyber(n), empty:'No cyberware.' });
      items.push({ sec:'WEAPONS', rows:_rowsWeapons(n), empty:'No weapons.' });
      items.push({ sec:'GEAR', rows:_rowsInv(n), empty:'No gear.' });
      if (_esc(n.notes)) items.push({ sec:'NOTES', block:'<div class="nv-notes">'+_esc(n.notes)+'</div>' });
      return items;
    }
  }
};
function _hash(s){ var h=0; s=String(s); for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return h; }

/* ═══ Edit / View toggle + page format + side panel + PDF ═══ */
function setViewMode(mode){
  mode = mode || 'edit';
  NPC.viewMode = mode;
  if (mode !== 'edit') {
    _lastViewType = mode;
    var v = NPC_VIEWS[mode];
    if (v && v.paged) { _npcPageSize = 'a4'; }          // files & CP2020 locked to A4
    else if (!_npcPageUserSet) { _npcPageSize = (v && v.defaultSize) || 'a4'; }
  }
  applyViewMode();
  _save();
}
function npcSetEdit(){ setViewMode('edit'); }
function npcSetView(){ setViewMode((NPC.viewMode && NPC.viewMode !== 'edit') ? NPC.viewMode : _lastViewType); }

function setPageSize(key){
  if (!NPC_PAGE_SIZES[key]) return;
  _npcPageSize = key; _npcPageUserSet = true;
  try { localStorage.setItem('bartmoss_npc_page_size', key); localStorage.setItem('bartmoss_npc_page_userset','1'); } catch(e){}
  _applyPaperSize();
  var sel = document.getElementById('npc-page-size'); if (sel) sel.value = key;
}
function _applyPaperSize(){
  var paper = document.getElementById('npc-paper'); if (!paper) return;
  var sz = NPC_PAGE_SIZES[_npcPageSize] || NPC_PAGE_SIZES.a4;
  paper.style.width = sz.w + 'px';
  paper.style.minHeight = sz.h + 'px';
}

function renderNpcView(){
  var v = NPC_VIEWS[NPC.viewMode]; if (!v || v.paged) return '';
  return '<div class="npc-view npc-view-'+(v.theme||NPC.viewMode)+'">'+ v.render(NPC) +'</div>';
}

/* Multi-page layout engine: lays a view's flow() items into A4 pages,
   each with a repeated running header + footer. Splits long sections,
   repeating the section title with " (cont.)". Measures in an offscreen host. */
function _paginate(view, n){
  var sz = NPC_PAGE_SIZES.a4;
  var theme = view.theme;
  var deco = view.pageDecoration ? view.pageDecoration(n) : '';
  var host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;';
  host.style.width = sz.w + 'px';
  document.body.appendChild(host);
  host.innerHTML = '<div class="nv-page npc-view-'+theme+'"><div class="nv-page-head">'+view.runningHeader(n,1,1)+'</div><div class="nv-page-body"></div><div class="nv-page-foot">'+view.runningFooter(n,1,1)+'</div></div>';
  var mbody = host.querySelector('.nv-page-body');
  // true available content height of the body box (respects real layout + margins)
  var avail = mbody.clientHeight;
  if (!avail || avail < 80) { avail = sz.h - 80; }
  var MAX_PAGES = 60; // hard safety cap

  var flow = view.flow(n);
  var pages = []; var cur = [];
  function append(html){ mbody.insertAdjacentHTML('beforeend', html); cur.push(html); }
  function overflowsWith(html){            // would adding `html` overflow the current page?
    mbody.insertAdjacentHTML('beforeend', html);
    var over = mbody.scrollHeight > avail + 1;
    mbody.removeChild(mbody.lastChild);
    return over;
  }
  function commit(){ if (cur.length) pages.push(cur); cur = []; mbody.innerHTML = ''; }

  flow.forEach(function(item){
    if (pages.length > MAX_PAGES) return;
    if (item.block != null) {
      if (cur.length && overflowsWith(item.block)) commit();
      append(item.block); return;
    }
    if (item.rows) {
      var rows = item.rows, title = item.sec;
      function titleHtml(cont){ return '<div class="nv-sec">'+title+(cont?' <span class="nv-cont">(cont.)</span>':'')+'</div>'; }
      if (!rows.length) {
        var emptyHtml = titleHtml(false)+'<div class="nv-empty">'+(item.empty||'—')+'</div>';
        if (cur.length && overflowsWith(emptyHtml)) commit();
        append(emptyHtml); return;
      }
      // start the section on a fresh page only if even title+first row can't fit here
      if (cur.length && overflowsWith(titleHtml(false)+rows[0])) commit();
      append(titleHtml(false));
      var afterTitle = true; // page currently holds only the (continuation) title
      for (var idx = 0; idx < rows.length && pages.length <= MAX_PAGES; idx++) {
        if (!afterTitle && overflowsWith(rows[idx])) { commit(); append(titleHtml(true)); afterTitle = true; }
        append(rows[idx]); afterTitle = false;
      }
    }
  });
  if (cur.length) pages.push(cur);
  document.body.removeChild(host);

  var total = pages.length || 1;
  return pages.map(function(content, i){
    return '<div class="nv-page npc-view-'+theme+'">' +
      (deco || '') +
      '<div class="nv-page-head">'+view.runningHeader(n, i+1, total)+'</div>' +
      '<div class="nv-page-body">'+content.join('')+'</div>' +
      '<div class="nv-page-foot">'+view.runningFooter(n, i+1, total)+'</div>' +
    '</div>';
  }).join('');
}

/* Render the active view into #npc-paper (single sheet OR multi-page stack). */
function renderPaper(){
  var paper = document.getElementById('npc-paper'); if (!paper) return;
  var v = NPC_VIEWS[NPC.viewMode];
  if (v && v.paged) {
    paper.className = 'npc-paper-multi npc-view-'+v.theme;
    paper.style.width = NPC_PAGE_SIZES.a4.w + 'px';
    paper.style.minHeight = '';
    paper.innerHTML = _paginate(v, NPC);
  } else {
    paper.className = '';
    paper.innerHTML = renderNpcView();
    _applyPaperSize();
  }
}

function _updateModeUI(mode){
  var be = document.getElementById('npc-btn-edit'), bv = document.getElementById('npc-btn-view'),
      vc = document.getElementById('npc-view-controls');
  if (be) be.classList.toggle('active', mode === 'edit');
  if (bv) bv.classList.toggle('active', mode !== 'edit');
  if (vc) vc.style.display = (mode === 'edit') ? 'none' : '';
  var sel = document.getElementById('npc-view-mode'); if (sel) sel.value = mode;
  var v = NPC_VIEWS[mode]; var paged = !!(v && v.paged);
  var ps = document.getElementById('npc-page-size');
  if (ps) { ps.disabled = paged; ps.style.opacity = paged ? '.45' : '1'; ps.title = paged ? 'Files & CP2020 are A4 only' : 'Page format'; ps.value = _npcPageSize; }
}
function applyViewMode(){
  var mode = NPC.viewMode || 'edit';
  var wrap = document.querySelector('.npc-wrap');
  var view = document.getElementById('npc-view');
  _updateModeUI(mode);
  if (mode === 'edit') {
    if (wrap) wrap.style.display = '';
    if (view) { view.style.display = 'none'; view.innerHTML = ''; }
  } else {
    if (wrap) wrap.style.display = 'none';
    if (view) {
      view.style.display = 'block';
      view.innerHTML = '<div id="npc-view-area"><div id="npc-paper"></div><div id="npc-side-panel"></div></div>';
      renderPaper();
      renderSidePanel();
    }
  }
}

/* dotted-path get/set on the active NPC */
function _npcGetPath(dotKey){
  var parts = dotKey.split('.'); var o = NPC;
  for (var i=0;i<parts.length;i++){ if (o == null) return ''; o = o[parts[i]]; }
  return o == null ? '' : o;
}
function _npcSetPath(dotKey, value){
  var parts = dotKey.split('.'); var o = NPC;
  for (var i=0;i<parts.length-1;i++){
    if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length-1]] = value;
}
function renderSidePanel(){
  var el = document.getElementById('npc-side-panel'); if (!el) return;
  var v = NPC_VIEWS[NPC.viewMode]; if (!v) { el.innerHTML = ''; return; }
  var fields = NPC_SIDE_UNIVERSAL.concat(v.sidePanelExtra || []);
  var html = '<div class="nv-sp-title">'+_esc(v.label)+'</div>' +
    '<div class="nv-sp-hint">Document fields only. Character data is read-only here — switch to <b>Edit</b> to change it.</div>';
  if (!fields.length) html += '<div class="nv-sp-empty">No document fields for this view.</div>';
  fields.forEach(function(f){
    var val = _npcGetPath(f.key);
    var safe = _esc(String(val == null ? '' : val));
    if (f.type === 'select') {
      html += '<div class="nv-sp-field"><label>'+_esc(f.label)+'</label><select onchange="npcSideEdit(\''+f.key+'\',this.value)">' +
        (f.opts||[]).map(function(o){ return '<option'+(String(val)===o?' selected':'')+'>'+_esc(o)+'</option>'; }).join('') +
        '</select></div>';
    } else if (f.type === 'textarea') {
      html += '<div class="nv-sp-field"><label>'+_esc(f.label)+'</label><textarea oninput="npcSideEdit(\''+f.key+'\',this.value)">'+safe+'</textarea></div>';
    } else {
      html += '<div class="nv-sp-field"><label>'+_esc(f.label)+'</label><input value="'+safe+'" oninput="npcSideEdit(\''+f.key+'\',this.value)"></div>';
    }
  });
  el.innerHTML = html;
}
function npcSideEdit(dotKey, value){
  // Side panel only edits document fields (NPC.viewData.*), never core sheet data.
  _npcSetPath(dotKey, value);
  // re-render only the paper (keeps side-panel input focus), preserve scroll
  var view = document.getElementById('npc-view'); var st = view ? view.scrollTop : 0;
  renderPaper();
  if (view) view.scrollTop = st;
  _save();
}

async function npcDownloadPdf(){
  var paper = document.getElementById('npc-paper');
  if (!paper || !window.html2canvas || !window.jspdf) { alert('PDF libraries not loaded.'); return; }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch(e){} }
  var jsPDF = window.jspdf.jsPDF;
  var opts = { scale:2, backgroundColor:null, useCORS:true, logging:false };
  var fname = ((NPC.name || NPC.type || 'npc') + '_' + NPC.viewMode + '.pdf').replace(/[^\w.-]+/g,'_');

  // Multi-page paged views: one A4 PDF page per .nv-page (clean headers/footers).
  var pageEls = paper.querySelectorAll('.nv-page');
  if (pageEls.length) {
    var pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    for (var i=0;i<pageEls.length;i++){
      var cv = await html2canvas(pageEls[i], opts);
      if (i>0) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg',0.95), 'JPEG', 0, 0, pw, ph);
    }
    pdf.save(fname);
    return;
  }

  // Single-sheet views (cards): capture the whole paper at its page format.
  var sz = NPC_PAGE_SIZES[_npcPageSize] || NPC_PAGE_SIZES.a4;
  var canvas = await html2canvas(paper, {
    scale: 2,
    backgroundColor: null,
    useCORS: true,
    logging: false,
    windowWidth: paper.scrollWidth,
    windowHeight: paper.scrollHeight
  });
  var pdf = new jsPDF({ orientation: sz.orient, unit:'mm', format: sz.fmt });
  var pw = pdf.internal.pageSize.getWidth();
  var ph = pdf.internal.pageSize.getHeight();
  var imgW = pw;
  var imgH = canvas.height * (imgW / canvas.width);
  var img = canvas.toDataURL('image/jpeg', 0.95);
  if (imgH <= ph + 0.5) {
    pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH);
  } else {
    var remaining = imgH, offset = 0;
    while (remaining > 0.5) {
      pdf.addImage(img, 'JPEG', 0, -offset, imgW, imgH);
      remaining -= ph; offset += ph;
      if (remaining > 0.5) pdf.addPage();
    }
  }
  pdf.save(fname);
}

/* ─── Section toggle ─── */
function npcToggleSec(head) {
  var body = head.nextElementSibling;
  if (!body) return;
  body.classList.toggle('collapsed');
  head.querySelector('.toggle').textContent = body.classList.contains('collapsed') ? '▶' : '▼';
}

/* ─── Click outside to close dropdowns ─── */
document.addEventListener('click', function(e) {
  if (!e.target.closest('#npc-add-skill-wrap')) {
    var r = document.getElementById('npc-add-skill-results');
    if (r) r.style.display = 'none';
  }
  if (!e.target.closest('.npc-weap-search-wrap')) {
    var r = document.getElementById('npc-weap-results');
    if (r) r.style.display = 'none';
  }
  if (!e.target.closest('.npc-armor-search-wrap')) {
    var r = document.getElementById('npc-armor-results');
    if (r) r.style.display = 'none';
  }
  if (!e.target.closest('.npc-veh-search-wrap')) {
    var r = document.getElementById('npc-veh-results');
    if (r) r.style.display = 'none';
  }
  if (!e.target.closest('.npc-cyber-search-wrap')) {
    var r = document.getElementById('npc-cyber-results');
    if (r) r.style.display = 'none';
  }
  if (!e.target.closest('.npc-gear-search-wrap')) {
    var r = document.getElementById('npc-gear-results');
    if (r) r.style.display = 'none';
  }
});

/* ─── Init ─── */
window.addEventListener('DOMContentLoaded', function() {
  // Wire up field listeners
  var nameEl = document.getElementById('npc-name');
  if (nameEl) nameEl.addEventListener('input', function() { NPC.name = this.value; renderNpcTabs(); _save(); });
  var typeEl = document.getElementById('npc-type');
  if (typeEl) typeEl.addEventListener('input', function() { NPC.type = this.value; renderNpcTabs(); _save(); });

  var saValEl = document.getElementById('npc-sa-val');
  if (saValEl) saValEl.addEventListener('input', function() { NPC.saVal = parseInt(this.value)||0; _save(); });

  var notesEl = document.getElementById('npc-notes');
  if (notesEl) notesEl.addEventListener('input', function() { NPC.notes = this.value; _save(); });

  loadData();
});
