/* ═══════════════════════════════════════════════
   OUTFIT DESIGNER  —  Rache Bartmoss' Datafort
   ═══════════════════════════════════════════════ */

var _outfits  = [];
var _activeOdId = null;

var _LOCS      = ['head','torso','rarm','larm','rleg','lleg'];
var _LOC_NAMES = { head:'Head', torso:'Torso', rarm:'R.Arm', larm:'L.Arm', rleg:'R.Leg', lleg:'L.Leg' };

var _OD_LS_KEY = 'bartmoss_outfits';
var _saveTimer = null;
var _odSearchOpen = false;

/* ─── Armor / Clothing database ─── */
var _ARMOR_DB = [{"name":"Alessio' Coveralls","notes":"","cost":200},{"name":"Armor Inserts (1 location)","notes":"SP +5; Max SP 20; ","cost":40},{"name":"Armored Bearskin Hat","notes":"SP 10","cost":75},{"name":"Armored Stockings","notes":"SP 6; EV 0","cost":110},{"name":"Battlegloves","notes":"3 spaces of standar cyberarm weapon or option except Hydraulic Arm; Crush 3d6; Punch 2d6;","cost":900},{"name":"Bearskin Hat","notes":"","cost":50},{"name":"Blackjack Stealth Armor","notes":"SP 16; EV 2; +3 Stealth; 4-hr Life support; Radar invisible (90%); Low-lite/Anti-dazzle/Targeting Scope/Times Square Plus optics;","cost":10000},{"name":"C-Ballistic Mesh","notes":"SP 15; Worn over Skin Tight Body Armor","cost":""},{"name":"Ciamplo' Gloves","notes":"","cost":400},{"name":"Contact Lenses","notes":"","cost":100},{"name":"Contact Lenses (Businesswear)","notes":"","cost":300},{"name":"Contact Lenses (Generic Chic)","notes":"","cost":100},{"name":"Contact Lenses (High Fashion)","notes":"","cost":400},{"name":"Contact Lenses (Leisurewear)","notes":"","cost":200},{"name":"Contact Lenses (Urban Flash)","notes":"","cost":200},{"name":"Discovery line - 2 Piece","notes":"Taser when touched DIFF 25; 4 Charges;","cost":1500},{"name":"Discovery line - 2 Piece Armored","notes":"SP 6 torso/arms/legs; Taser when touched DIFF 25; 4 Charges;","cost":1725},{"name":"Discovery line - 2 Piece Battery","notes":"1 week life","cost":200},{"name":"Discovery line - Jacket","notes":"Taser when touched DIFF 25; 5 Charges;","cost":750},{"name":"Discovery line - Jacket Armored","notes":"SP 6 torso/arms; Taser when touched DIFF 25; 5 Charges;","cost":975},{"name":"Discovery line - Jacket Battery","notes":"2 weeks life","cost":75},{"name":"Discovery line - Jump-suit","notes":"Taser when touched DIFF 25; 6 Charges;","cost":900},{"name":"Discovery line - Jump-suit Armored","notes":"SP 6 torso/arms/legs; Taser when touched DIFF 25; 6 Charges;","cost":1125},{"name":"Discovery line - Jump-suit Battery","notes":"1 week life","cost":100},{"name":"Discovery line - Shirt","notes":"Taser when touched DIFF 25; 3 Charges;","cost":125},{"name":"Discovery line - Shirt Armored","notes":"SP 6 torso/arms; Taser when touched DIFF 25; 3 Charges;","cost":450},{"name":"Discovery line - Shirt Battery","notes":"1 month life","cost":50},{"name":"Door Gunner's Vest","notes":"SP 25 torso; EV 3","cost":250},{"name":"Duster Coat","notes":"","cost":200},{"name":"EMA-1 SoftShell","notes":"SP25; EV 0; Linear Frame 48 hr use;","cost":8500},{"name":"Eji Armored Cloak with Light Panels","notes":"SP 14 torso/arms/legs","cost":500},{"name":"Eji Designer Jeans","notes":"","cost":50},{"name":"Eji Wool Sweater","notes":"","cost":60},{"name":"Flack Pants","notes":"SP 20 legs; EV 1;","cost":200},{"name":"Flack Vest","notes":"SP 20 torso; EV 1;","cost":200},{"name":"Footwear - Businesswear","notes":"","cost":75},{"name":"Footwear - Generic Chic","notes":"","cost":25},{"name":"Footwear - High Fashion","notes":"","cost":100},{"name":"Footwear - Leisurewear","notes":"","cost":50},{"name":"Footwear - Urban Flash","notes":"","cost":50},{"name":"Full Plates SP 20 (1 location)","notes":"+1 EV if torso/legs/arms; (+3 total)","cost":60},{"name":"Full Plates SP 25 (1 location)","notes":"+1 EV if torso/legs/arms; (+3 total)","cost":100},{"name":"G-12 Cold Weather Combat Gear Balaclava","notes":"24 hr warmth generator. -70 C.","cost":50},{"name":"G-12 Cold Weather Combat Gear Gloves","notes":"24 hr warmth generator. -70 C.","cost":50},{"name":"G-12 Cold Weather Combat Gear Jacket","notes":"EV 1; 24 hr warmth generator. -70 C.","cost":300},{"name":"G-12 Cold Weather Combat Gear Outfit","notes":"EV 1; 24 hr warmth generator. -70 C.","cost":575},{"name":"G-12 Cold Weather Combat Gear boots","notes":"24 hr warmth generator. -70 C.","cost":100},{"name":"G-12 Cold Weather Combat Gear pants","notes":"EV 1; 24 hr warmth generator. -70 C.","cost":200},{"name":"Gianni' Helmet","notes":"SP20; +10 to resist gases; With Smartgoggles","cost":800},{"name":"Gibson Battlegear 'Sneak Suit'","notes":"SP 10; EV 0; Awareness/Notice -4 penalty;","cost":560},{"name":"Gibson Battlegear 'Sneak Suit' Flak Vest","notes":"SP 16; EV 1; Awareness/Notice -4 penalty;","cost":375},{"name":"Gibson Battlegear 'Sneak Suit' Helmet","notes":"SP 18; EV 0; Awareness/Notice -4 penalty;","cost":185},{"name":"Gibson Battlegear 'Space Sneak Suit'","notes":"SP 8; EV 2; Awareness/Notice -4 penalty; 40minute air supply","cost":2500},{"name":"Gibson Battlegear 'Space Sneak Suit' w/ Sonar Baffler","notes":"SP 8; EV 2; Awareness/Notice -4 penalty; 40minute air supply","cost":3500},{"name":"Gibson Battlegear Cotton T-shirt","notes":"SP 10 torso","cost":10},{"name":"Gibson Battlegear Denim Jacket","notes":"SP 14 torso/arms","cost":150},{"name":"Gibson Battlegear IR Combat Cloak","notes":"Awareness/Notice -5 vs IR; EV2","cost":450},{"name":"Gibson Battlegear Jeans","notes":"SP 16 legs","cost":30},{"name":"Glasses - Businesswear","notes":"","cost":150},{"name":"Glasses - Generic Chic","notes":"","cost":50},{"name":"Glasses - High Fashion","notes":"","cost":200},{"name":"Glasses - Leisurewear","notes":"","cost":100},{"name":"Glasses - Urban Flash","notes":"","cost":100},{"name":"Guercio' Helmet","notes":"SP20; +10 to resist gases","cost":600},{"name":"Heavy Armor Jacket","notes":"SP 20 torso/arms; EV 2;","cost":250},{"name":"Heavy Leather Jacket","notes":"SP 4 torso/arms; EV 0","cost":50},{"name":"Heavy Leather Pants","notes":"SP 4 legs;","cost":50},{"name":"ICON America 'Gunfighter' Hat","notes":"","cost":100},{"name":"ICON America Bomber Jacket","notes":"","cost":300},{"name":"ICON America Boots","notes":"","cost":150},{"name":"ICON America Gun Belt","notes":"","cost":60},{"name":"ICON America Halfboots","notes":"","cost":150},{"name":"ICON America Jacket","notes":"","cost":300},{"name":"ICON America Long Duster","notes":"","cost":500},{"name":"ICON America Long skirt","notes":"","cost":200},{"name":"ICON America Miniskirt","notes":"","cost":100},{"name":"ICON America Pants","notes":"","cost":250},{"name":"ICON America Skirt","notes":"","cost":100},{"name":"ICON America Tunic","notes":"","cost":220},{"name":"IR Flashlight Belt Buckle","notes":"2 hour;","cost":40},{"name":"IR Flashlight Belt Buckle Battery","notes":"Req. Belt Buckle; 2 hour;","cost":2},{"name":"IR Poncho","notes":"-2 to infrared awareness rolls","cost":300},{"name":"Info-Helm","notes":"SP 20; Two-way radio; Various options","cost":300},{"name":"Infrared Defeating Camo Gloves/Balaclava/helmet","notes":"-2 to infrared awareness rolls","cost":30},{"name":"Infrared Defeating Camo Jacket","notes":"-2 to infrared awareness rolls","cost":150},{"name":"Infrared Defeating Camo Pants","notes":"-2 to infrared awareness rolls","cost":50},{"name":"Infrared Defeating Camo Tunic and boots","notes":"-2 to infrared awareness rolls","cost":75},{"name":"Jacket - Businesswear","notes":"","cost":105},{"name":"Jacket - Generic Chic","notes":"","cost":35},{"name":"Jacket - High Fashion","notes":"","cost":140},{"name":"Jacket - Leisurewear","notes":"","cost":70},{"name":"Jacket - Urban Flash","notes":"","cost":70},{"name":"Kevlar T-Shirt","notes":"SP 10 torso; EV 0;","cost":90},{"name":"Kevlar Vest","notes":"SP 10 torso; EV 0;","cost":90},{"name":"Lano' Armored Coveralls","notes":"SP14 torso/arms/legs; EV 2","cost":1600},{"name":"Light Armor Jacket","notes":"SP 14 torso/arms; EV 0","cost":150},{"name":"Light Enhancement Mirrorshades","notes":"Anti-dazzle; IR","cost":400},{"name":"Light Mesh Body Armor - Lower Body","notes":"SP 15 legs;","cost":300},{"name":"Light Mesh Body Armor - Upper Body","notes":"SP 15 Torso/arms;","cost":400},{"name":"Linear Frame- Beta","notes":"BOD 14; -2 REF;","cost":7000},{"name":"Linear Frame- Omega","notes":"BOD 16; -2 REF;","cost":9000},{"name":"Linear Frame- Sigma","notes":"BOD 12; -2 REF;","cost":5000},{"name":"M-78 Revised Personal Armor Heavy Vest","notes":"SP 18 ches; EV 0","cost":300},{"name":"M-78 Revised Personal Armor Jacket","notes":"SP 14 arms and chest; EV 1","cost":300},{"name":"M-78 Revised Personal Armor T-shirt","notes":"SP 7 chest; EV 0","cost":130},{"name":"M-88 Revised Combat Helmet","notes":"20 SP; 15 SP for face; 10 SDP; Navigation and computer enehanced.","cost":5000},{"name":"M-88A2 Enhanced Combat Helmet","notes":"SP 25; SP 20 visor; Nullify Awareness penalty; x20 teleoptics/Targetingn Scope/Anti-dazzle/Times Square Plus/Thermograph; Commlinks and sensors","cost":2399},{"name":"M73 'Mirage Gear' Environmental Assimilation System","notes":"SP 12; EV 1; Awareness/Notice -2","cost":1050},{"name":"M73 'Mirage Gear' Environmental Assimilation System Flak Vest","notes":"SP 18; EV 1; Awareness/Notice -2","cost":275},{"name":"M73 'Mirage Gear' Environmental Assimilation System Helmet","notes":"SP 24; EV 1; Awareness/Notice -2","cost":140},{"name":"M96 'Ghostsuit' Cameleon Clothing","notes":"SP 10; EV 1; Awareness/Notice -4 penalty;","cost":5300},{"name":"M96 'Ghostsuit' Cameleon Helmet","notes":"SP 16; EV 0; Awareness/Notice -4 penalty;","cost":600},{"name":"Maximum Threat Urban Riot Armour","notes":"SP 25 torso/arms; SP20 legs; EV 3","cost":1200},{"name":"Med Armor Jacket","notes":"SP 18 torso/arms; EV 1;","cost":200},{"name":"MedicGear Combat Medical Armor","notes":"SP20; EV -3; +2 Med skill rolls","cost":3400},{"name":"MetalGear","notes":"SP 25 head/torso/arms/legs; EV 2","cost":600},{"name":"Military Assault Armor","notes":"SP 28; EV 2; NBC protection; Radio; Gas Mask; Low-light; Anti-dazzler; Thermograph; Tareting scope; 2-hr cooling;  IR -3; Radar baffler -5;","cost":3000},{"name":"Military Assault Armor w/ air tank","notes":"SP 28; EV 4; NBC protection; Radio; Gas Mask; Low-light; Anti-dazzler; Thermograph; Tareting scope; 2-hr cooling;  IR -3; Radar baffler -5;","cost":3500},{"name":"Mirrorshades - Businesswear","notes":"","cost":300},{"name":"Mirrorshades - Generic Chic","notes":"","cost":100},{"name":"Mirrorshades - High Fashion","notes":"","cost":400},{"name":"Mirrorshades - Leisureware","notes":"","cost":200},{"name":"Mirrorshades - Urban Flash","notes":"","cost":200},{"name":"Moto-cross Armor","notes":"","cost":750},{"name":"Motorcycle Helmet","notes":"SP 8","cost":100},{"name":"Motorcycle Jacket","notes":"SP 4","cost":200},{"name":"Motorcycle Jacket (Armored)","notes":"SP 12","cost":300},{"name":"Motorcycle Pants","notes":"","cost":150},{"name":"Naval Armor","notes":"SP 16 torso/arms/legs; EV 3; Floatation","cost":1500},{"name":"Nomad Gloves","notes":"SP 4","cost":50},{"name":"Nu-Tek Jacket","notes":"Video clothing","cost":300},{"name":"Nu-Tek Skirt","notes":"Video clothing","cost":200},{"name":"Nylon Helmet","notes":"SP 20 head; EV 0;","cost":100},{"name":"Pants - Businesswear","notes":"","cost":60},{"name":"Pants - Generic Chic","notes":"","cost":20},{"name":"Pants - High Fashion","notes":"","cost":80},{"name":"Pants - Leisurewear","notes":"","cost":40},{"name":"Pants - Urban Flash","notes":"","cost":40},{"name":"Patrol Armor","notes":"SP 18 Legs;  SP20 Torso;  SP 15 arms; EV 2","cost":900},{"name":"Patrol Armor w/ Alloy Plates","notes":"SP 23 Legs; SP25 Torso; SP 20 arms; EV 3","cost":900},{"name":"Pinamonte' Boots","notes":"SP20 to feet and ankles","cost":500},{"name":"Police Issue General Purpose Shield","notes":"SP 10","cost":80},{"name":"Police Issue Paramedic Helmet","notes":"SP 20; Two-way radio; Beamlight; Anti-dazzler","cost":230},{"name":"Police Issue Patrol Helmet","notes":"SP 25; Two-way radio; Beamlight; Anti-dazzler","cost":230},{"name":"Police Issue Patrol Helmet w/ Targeting","notes":"SP 25; Two-way radio; Beamlight:  Anti-dazzler/Smartgun targetting/IR","cost":430},{"name":"Police Issue Riot Helmet","notes":"As Patrol Helmet; Sealed  air suppy 10 mins","cost":650},{"name":"Police Issue Riot Shield","notes":"SP 15; ","cost":150},{"name":"Police Issue Riot Shield w/strobe light","notes":"SP 15; Strobelight REF to sheild eyes else BOD save avoid stunned for 1d6 turns; 10 pulse battery","cost":180},{"name":"Police Issue Traffic Helmet","notes":"SP 15; Two-way radio; Beamlight;  Anti-dazzler; Camera","cost":230},{"name":"Protective Headgear Insert","notes":"SP 4; EV 0","cost":50},{"name":"Recrea Tech Powerblades","notes":"Athletics +1;MA +5; 4 hrs","cost":200},{"name":"Rubberized Polymer Boots","notes":"","cost":40},{"name":"Rubberized Polymer Boots w/ hidden space","notes":"","cost":60},{"name":"SPA Anti-Fire Suit","notes":"30 mins air supply; Max heat 2000F/1093C. Fails with overexposure.","cost":1500},{"name":"Skates - Hydraulic Boot Skate","notes":"+Ath/4 +Skate/3 to MA","cost":275},{"name":"Skates - Snap-down/Snap-on ","notes":"break -3 MA/sec","cost":200},{"name":"Skin Tight","notes":"","cost":2000},{"name":"Smart Helmet","notes":"SP 18; Integrated Smartgoggles: Low-lite/ IR/Targeting Scope; Commlink","cost":800},{"name":"Smartgoggles","notes":"4 cyberoptic options (10% less); Smartgun plug and cables;","cost":200},{"name":"Socialite Light Armor","notes":"SP 10 torso/arms/legs;","cost":475},{"name":"Socialite Light Armor w/ shirt","notes":"SP 15 torso/arms; SP 10 legs","cost":560},{"name":"Sovite Military Armored Greatcoat","notes":"SP14 torso/arms/legs; EV 1; -20C temps","cost":250},{"name":"Standard Field Armor","notes":"SP 14 torso/arms/legs; EV 0; Can be air sealed in 2 turns;","cost":1200},{"name":"Standard Field Armor w/ inserts","notes":"SP 20 torso/legs; SP 14 arms; EV 1; Can be air sealed in 2 turns;","cost":1200},{"name":"Standard Field Cooling Vest","notes":"1 hour; regulates body temp","cost":100},{"name":"Standard Nylon Helmet","notes":"SP20; EV 0; Builtin x20 binoc; Radio; anti-dazzle/low-lite; Gas mask","cost":300},{"name":"Standard Nylon Helmet w/ Smartgun Target","notes":"SP20; EV 0; Builtin x20 binoc; Radio; anti-dazzle/low-lite/Targeting Scope; Gas mask","cost":500},{"name":"Steel Helmet","notes":"SP 14 head;","cost":20},{"name":"Takanaka Exec Line Armored Opera Cloak","notes":"SP 16 torso/arms","cost":1200},{"name":"Takanaka Exec Line Armored Topcoat","notes":"SP 16 torso/arms","cost":2000},{"name":"Takanaka Exec Line Cape","notes":"","cost":900},{"name":"Takanaka Exec Line Cravat","notes":"","cost":100},{"name":"Takanaka Exec Line Jacket","notes":"","cost":800},{"name":"Takanaka Exec Line Monogram Shirt","notes":"","cost":200},{"name":"Takanaka Exec Line Pants","notes":"","cost":700},{"name":"Takanaka Exec Line Scarf","notes":"","cost":75},{"name":"Takanaka Exec Line Tie","notes":"","cost":100},{"name":"Takanaka Exec Line Top Coat","notes":"","cost":1000},{"name":"Takanaka Exec Line Vest","notes":"","cost":500},{"name":"Top - Businesswear","notes":"","cost":45},{"name":"Top - Generic Chic","notes":"","cost":15},{"name":"Top - High Fashion","notes":"","cost":60},{"name":"Top - Leisurewear","notes":"","cost":30},{"name":"Top - Urban Flash","notes":"","cost":30},{"name":"Uniware Armor Trenchcoat","notes":"SP 18 torso/arms/legs","cost":300},{"name":"Uniware Armorjacket","notes":"SP 14 torso/arms","cost":200},{"name":"Uniware Blouse/shirt","notes":"","cost":20},{"name":"Uniware Boots","notes":"","cost":30},{"name":"Uniware Dress","notes":"","cost":50},{"name":"Uniware Jumpsuit","notes":"","cost":75},{"name":"Uniware Legpads","notes":"SP 10 legs","cost":60},{"name":"Uniware Pants","notes":"","cost":35},{"name":"Uniware Skirt","notes":"","cost":35},{"name":"Uniware Torso Armor","notes":"SP 10 torso","cost":60},{"name":"Uniware Utility Belt","notes":"","cost":15},{"name":"Uniware Vest","notes":"","cost":25}];

/* ─── Utilities ─── */
function _uid()  { return 'od-' + Math.random().toString(36).substr(2,9); }
function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _getActiveOd() { return _outfits.filter(function(o){ return o.id === _activeOdId; })[0] || null; }

/* ─── Persistence ─── */
function _odFlushSave() {
  try { localStorage.setItem(_OD_LS_KEY, JSON.stringify(_outfits)); } catch(e) {}
}
function _odSchedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_odFlushSave, 500);
}
function _odLoadFromStorage() {
  try {
    var raw = localStorage.getItem(_OD_LS_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (Array.isArray(data)) _outfits = data.map(_odMigrate);
  } catch(e) {}
}
function _odMigrate(o) {
  if (!o.id)    o.id    = _uid();
  if (!o.name)  o.name  = 'Unnamed Outfit';
  if (!o.items) o.items = [];
  o.items.forEach(function(it) {
    if (!it.id)   it.id   = _uid();
    if (!it.locs) it.locs = { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false };
    if (it.sp    == null) it.sp    = 0;
    if (it.slots == null) it.slots = 0;
    if (!it.notes) it.notes = '';
  });
  return o;
}

/* ─── Blank outfit factory ─── */
function _makeOutfit(name) {
  return { id:_uid(), name:name||'New Outfit', items:[] };
}
function _makeItem(name, sp, isArmor) {
  return {
    id:_uid(), name:name||'', sp:sp||0, slots:0, isArmor:!!isArmor, notes:'',
    locs:{ head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false }
  };
}

/* ─── CRUD ─── */
function odNew() {
  var name = prompt('Outfit name:'); if (!name) return;
  var o = _makeOutfit(name);
  _outfits.push(o);
  _odFlushSave();
  odSelect(o.id);
}

function odDelete(id) {
  if (!confirm('Delete this outfit?')) return;
  _outfits = _outfits.filter(function(o){ return o.id !== id; });
  if (_activeOdId === id) _activeOdId = _outfits.length ? _outfits[0].id : null;
  _odFlushSave();
  odRenderSidebar(); odRenderMain();
}

function odDuplicate(id) {
  var src = _outfits.filter(function(o){ return o.id===id; })[0]; if (!src) return;
  var copy = JSON.parse(JSON.stringify(src));
  copy.id   = _uid();
  copy.name = src.name + ' (copy)';
  _outfits.push(copy);
  _odFlushSave();
  odSelect(copy.id);
}

function odExport(id) {
  var o = id ? _outfits.filter(function(x){ return x.id===id; })[0] : _getActiveOd();
  if (!o) return;
  var blob = new Blob([JSON.stringify(o, null, 2)], { type:'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (o.name||'outfit').replace(/\s+/g,'_').toLowerCase() + '.outfit.json';
  a.click();
}

function odImportFile(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      // Support both a single outfit and an array
      var outfitList = Array.isArray(data) ? data : [data];
      outfitList.forEach(function(raw) {
        raw = _odMigrate(raw);
        var idx = _outfits.map(function(o){ return o.id; }).indexOf(raw.id);
        if (idx >= 0) _outfits[idx] = raw; else _outfits.push(raw);
        _activeOdId = raw.id;
      });
      _odFlushSave();
      odRenderSidebar(); odRenderMain();
    } catch(err) { alert('Invalid JSON: ' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
}

/* ─── Sidebar ─── */
function odSelect(id) {
  _activeOdId = id;
  odRenderSidebar();
  odRenderMain();
}

function odRenderSidebar() {
  var el = document.getElementById('od-sidebar-list'); if (!el) return;
  var q  = ((document.getElementById('od-search')||{}).value||'').trim().toLowerCase();
  var list = _outfits.filter(function(o){ return !q || (o.name||'').toLowerCase().indexOf(q) >= 0; });
  if (!list.length) {
    el.innerHTML = '<div class="od-sidebar-empty">No outfits yet.</div>';
    return;
  }
  el.innerHTML = list.map(function(o) {
    var active = o.id === _activeOdId;
    var itemCount = (o.items||[]).length;
    return '<div class="od-list-item'+(active?' active':'')+'" onclick="odSelect(\''+o.id+'\')">' +
      '<span class="od-list-name">'+_esc(o.name)+'</span>' +
      '<span style="font-family:var(--mono);font-size:11px;color:'+(active?'#888':'#bbb')+'">'+itemCount+'</span>' +
      '<div class="od-list-actions">' +
        '<span onclick="event.stopPropagation();odDuplicate(\''+o.id+'\')" title="Duplicate">⧉</span>' +
        '<span onclick="event.stopPropagation();odExport(\''+o.id+'\')" title="Export">↓</span>' +
        '<span onclick="event.stopPropagation();odDelete(\''+o.id+'\')" title="Delete">✕</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ─── Main render ─── */
function odRenderMain() {
  var el = document.getElementById('od-main'); if (!el) return;
  var o = _getActiveOd();
  if (!o) {
    el.innerHTML = '<div class="od-welcome"><div class="od-welcome-icon">⬡</div><div class="od-welcome-title">OUTFIT DESIGNER</div><div class="od-welcome-sub">Create a new outfit or import a JSON file.</div></div>';
    return;
  }

  // Compute SP per location
  var spByLoc = {};
  _LOCS.forEach(function(loc) { spByLoc[loc] = 0; });
  (o.items||[]).forEach(function(it) {
    _LOCS.forEach(function(loc) {
      if (it.locs && it.locs[loc] && it.sp) spByLoc[loc] += it.sp;
    });
  });

  // SP bar
  var spBar = '<div class="od-sp-bar">' +
    _LOCS.map(function(loc) {
      var val = spByLoc[loc];
      return '<div class="od-sp-cell">' +
        '<div class="od-sp-loc">'+_LOC_NAMES[loc]+'</div>' +
        '<div class="od-sp-val'+(val>0?' has-sp':'')+'">'+(val>0?val:'—')+'</div>' +
      '</div>';
    }).join('') +
  '</div>';

  // Item table
  var itemsHtml = odBuildItemsTable(o);

  // Storage summary
  var storageItems = (o.items||[]).filter(function(it){ return it.slots > 0; });
  var storageHtml = '';
  if (storageItems.length) {
    var totalSlots = storageItems.reduce(function(acc, it){ return acc + (it.slots||0); }, 0);
    storageHtml = '<div class="od-section">' +
      '<div class="od-section-head">Storage Capacity</div>' +
      '<div class="od-section-body">' +
        '<div class="od-storage-row">' +
          storageItems.map(function(it) {
            return '<div class="od-storage-chip">' +
              '<span class="od-storage-chip-name">'+_esc(it.name)+'</span>' +
              '<span class="od-storage-chip-val">'+it.slots+'</span>' +
              '<span class="od-storage-chip-label">slots</span>' +
            '</div>';
          }).join('') +
          '<div class="od-storage-chip" style="border-color:#111">' +
            '<span class="od-storage-chip-name" style="font-weight:bold">TOTAL</span>' +
            '<span class="od-storage-chip-val" style="color:#111">'+totalSlots+'</span>' +
            '<span class="od-storage-chip-label">slots</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  el.innerHTML =
    '<div class="od-header">' +
      '<div class="od-name" contenteditable="true" spellcheck="false" onblur="odSetName(this.textContent.trim())">'+_esc(o.name)+'</div>' +
      '<div class="od-header-actions">' +
        '<button class="btn btn-sm btn-cy" onclick="odExport()">Export JSON</button>' +
      '</div>' +
    '</div>' +
    spBar +
    '<div class="od-content">' +
      '<div class="od-section">' +
        '<div class="od-section-head">Items <span class="od-section-add" onclick="odAddItem()">＋</span></div>' +
        '<div style="padding:8px 12px;border-bottom:1px solid #e0e0e0;position:relative;">' +
          '<input id="od-db-search" class="od-db-search" placeholder="search armor/clothing database to add…" oninput="odSearchInput(this.value)" autocomplete="off">' +
          '<div id="od-db-results" class="od-db-results" style="display:none"></div>' +
        '</div>' +
        '<div class="od-section-body">'+itemsHtml+'</div>' +
      '</div>' +
      storageHtml +
    '</div>';
}

function odBuildItemsTable(o) {
  var items = o.items || [];
  if (!items.length) return '<div class="od-empty-hint">No items. Click + to add armor or clothing.</div>';

  var locHeaders = _LOCS.map(function(loc){ return '<th style="text-align:center">'+_LOC_NAMES[loc]+'</th>'; }).join('');

  var rows = items.map(function(it, idx) {
    var locCells = _LOCS.map(function(loc) {
      return '<td style="text-align:center">' +
        '<div class="od-loc-check">' +
          '<input type="checkbox"'+(it.locs&&it.locs[loc]?' checked':'')+' onchange="odItemLocSet('+idx+',\''+loc+'\',this.checked)">' +
        '</div>' +
      '</td>';
    }).join('');
    return '<tr>' +
      '<td class="od-item-name"><input type="text" value="'+_esc(it.name||'')+'" placeholder="Item name" oninput="odItemSet('+idx+',\'name\',this.value)"></td>' +
      '<td><input type="number" class="od-sp-input" value="'+(it.sp||0)+'" min="0" max="30" oninput="odItemSet('+idx+',\'sp\',parseInt(this.value)||0);odUpdateSpBar()"></td>' +
      '<td><input type="number" class="od-slots-input" value="'+(it.slots||0)+'" min="0" max="40" oninput="odItemSet('+idx+',\'slots\',parseInt(this.value)||0)"></td>' +
      locCells +
      '<td><input type="text" value="'+_esc(it.notes||'')+'" placeholder="notes" oninput="odItemSet('+idx+',\'notes\',this.value)" style="width:100px"></td>' +
      '<td><span class="od-rm" onclick="odRemoveItem('+idx+')">✕</span></td>' +
    '</tr>';
  }).join('');

  return '<table class="od-table">' +
    '<thead><tr>' +
      '<th>Name</th><th>SP</th><th>Slots</th>' +
      locHeaders +
      '<th>Notes</th><th></th>' +
    '</tr></thead>' +
    '<tbody>'+rows+'</tbody>' +
  '</table>';
}

/* ─── Item mutators ─── */
function odSetName(val) {
  var o = _getActiveOd(); if (!o || !val) return;
  o.name = val;
  odRenderSidebar();
  _odSchedSave();
}

function odItemSet(idx, field, val) {
  var o = _getActiveOd(); if (!o) return;
  o.items[idx][field] = val;
  if (field === 'sp') odUpdateSpBar();
  _odSchedSave();
}

function odItemLocSet(idx, loc, val) {
  var o = _getActiveOd(); if (!o) return;
  if (!o.items[idx].locs) o.items[idx].locs = {};
  o.items[idx].locs[loc] = val;
  _odSchedSave();
  odUpdateSpBar();
}

function odUpdateSpBar() {
  var o = _getActiveOd(); if (!o) return;
  var spByLoc = {};
  _LOCS.forEach(function(loc) { spByLoc[loc] = 0; });
  (o.items||[]).forEach(function(it) {
    _LOCS.forEach(function(loc) {
      if (it.locs && it.locs[loc] && it.sp) spByLoc[loc] += it.sp;
    });
  });
  _LOCS.forEach(function(loc) {
    var cells = document.querySelectorAll('.od-sp-cell');
    var idx = _LOCS.indexOf(loc);
    if (!cells[idx]) return;
    var valEl = cells[idx].querySelector('.od-sp-val');
    if (!valEl) return;
    var val = spByLoc[loc];
    valEl.textContent = val > 0 ? val : '—';
    valEl.className = 'od-sp-val' + (val > 0 ? ' has-sp' : '');
  });
}

function odAddItem() {
  var o = _getActiveOd(); if (!o) return;
  var name = prompt('Item name (e.g. "Light Armor Jacket"):'); if (!name) return;
  var spStr = prompt('SP value (0 for clothing):'); if (spStr === null) return;
  var sp = parseInt(spStr) || 0;
  var slotsStr = prompt('Storage slots (0 if no storage):'); if (slotsStr === null) return;
  var slots = parseInt(slotsStr) || 0;
  o.items.push(_makeItem(name, sp, sp > 0));
  o.items[o.items.length-1].slots = slots;
  _odFlushSave();
  odRenderMain();
}

/* ─── DB search ─── */
function _odExtractSP(notes) {
  var m = (notes||'').match(/\bSP\s*(\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

function odSearchInput(val) {
  var q = val.trim().toLowerCase();
  var results = document.getElementById('od-db-results'); if (!results) return;
  if (!q || q.length < 2) { results.innerHTML = ''; results.style.display = 'none'; return; }
  var matches = _ARMOR_DB.filter(function(it){ return it.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 10);
  if (!matches.length) { results.innerHTML = '<div class="od-db-result-empty">No results.</div>'; results.style.display = 'block'; return; }
  results.innerHTML = matches.map(function(it, i) {
    var sp = _odExtractSP(it.notes);
    return '<div class="od-db-result" onclick="odAddFromDB('+i+',\''+val.replace(/'/g,"\\'")+'\')">' +
      '<span class="od-db-result-name">'+_esc(it.name)+'</span>' +
      (sp ? '<span class="od-db-result-sp">SP '+sp+'</span>' : '') +
      (it.cost ? '<span class="od-db-result-cost">'+it.cost+'eb</span>' : '') +
      (it.notes ? '<span class="od-db-result-notes">'+_esc(it.notes.slice(0,60))+'</span>' : '') +
    '</div>';
  }).join('');
  results._matches = matches;
  results.style.display = 'block';
}

function odAddFromDB(idx, query) {
  var results = document.getElementById('od-db-results');
  if (!results || !results._matches) return;
  var it = results._matches[idx]; if (!it) return;
  var o = _getActiveOd(); if (!o) return;
  var sp = _odExtractSP(it.notes);
  var newItem = _makeItem(it.name, sp, sp > 0);
  newItem.notes = it.notes || '';
  o.items.push(newItem);
  _odFlushSave();
  // Clear search
  var inp = document.getElementById('od-db-search');
  if (inp) inp.value = '';
  results.innerHTML = ''; results.style.display = 'none';
  odRenderMain();
}

function odRemoveItem(idx) {
  var o = _getActiveOd(); if (!o) return;
  o.items.splice(idx, 1);
  _odFlushSave();
  odRenderMain();
}

/* ─── Init ─── */
window.addEventListener('DOMContentLoaded', function() {
  _odLoadFromStorage();
  odRenderSidebar();
});
