/* ═══════════════════════════════════════════════
   Rache Bartmoss' Datafort — main.js
   Data is fetched from data/*.json at startup.
═══════════════════════════════════════════════ */

const DB_COLS={"Corporations": ["name", "industry", "hq", "source"], "Vehicles": ["name", "type", "topspeed", "accelerate", "decelerate", "crew", "passengers", "cargo", "range", "maneuver", "sdp", "sp", "mass", "bookcost", "options", "weapons", "source"], "Decks": ["name", "_mu", "speed", "dataWall", "codeGate", "doubleMu", "description", "source"], "Gear": ["name", "category", "cost", "wt", "notes", "source"], "Programs": ["name", "class", "str", "mu", "cost", "options", "description", "source"], "Roles": ["name", "base", "specialability", "salary", "skills", "source"], "Skills": ["name", "stat", "ipmod", "sa", "description", "source"], "Weapons": ["name", "type", "category", "subcategory", "wa", "conc", "avail", "damage", "ammo", "shots", "rof", "rel", "range", "cost", "source"], "Cyberware": ["name", "type", "subtype", "cost", "hc", "surgery", "notes", "source"]};

/* ─── State ─── */
var DB;
var dbDatasets, dbCur, dbSort = null, dbSortAsc = true;
var numCols = ['topspeed','accelerate','decelerate','crew','passengers','range','maneuver','sdp','sp','bookcost','cost','wt','str','mu','_mu','speed','dataWall','codeGate','wa','shots','rof','ipmod','hc'];

var STATS = ['INT', 'REF', 'TECH', 'COOL', 'ATT', 'LUCK', 'MA', 'BODY', 'EMP'];
var LOCS = ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'];
var LOC_NAMES = { head: 'Head', torso: 'Torso', rarm: 'R.Arm', larm: 'L.Arm', rleg: 'R.Leg', lleg: 'L.Leg' };
var BTM_TABLE = [0, 0, 0, 0, -1, -1, -1, -2, -2, -3, -4];

/* ═══ LIFEPATH — condensed but faithful CP2020 tables ═══ */
var _LIFEPATH = {
  culturalOrigin: ['Anglo-American','Black American / African','Latin / Hispanic','European','Japanese / Korean','Chinese / SE Asian','Central / SW Asian','Pacific Islander','Native American','Slavic / Russian'],
  personality: ['Shy and secretive','Rebellious, antisocial, violent','Arrogant, proud, aloof','Moody, rash, headstrong','Picky, fussy, precise','Sneaky, deceptive, scheming','Intellectual and detached','Friendly, outgoing, open','Stable, serious, reliable','Silly and fluff-headed'],
  clothing: ['Generic Chic (jeans, tees, normal clothes)','Leisurewear (sweats, workout, baggies)','Urban Flash (chromed gear, blinking lights)','Businesswear (suits, ties, sharp)','High Fashion (designer, expensive)','Bohemian (peasant, tie-dye, retro)','Bag-Lady Chic (torn, ragged, vintage)','Gang Colors (flying your crew)','Nomad Leathers (road gear, dusters)','Corporate Conservative (sober, neutral)'],
  hairstyle: ['Mohawk','Long and ratty','Short and spiked','Wild and all over','Bald or shaved','Striped','Tinted / neon','Neat and conservative','Tied back / ponytail','Long and styled'],
  affectation: ['Tattoos','Mirrorshades','Ritual scars','Spiked gloves','Nose / brow rings','Tongue or ear piercings','Strange fingernails','Spiked boots or jewelry','Fingerless gloves','Antique weapon worn openly'],
  ethnicity: ['Anglo-American','African','Hispanic / Latin','European','Japanese','Chinese','Korean','Southeast Asian','Russian / Slavic','Mixed heritage'],
  familyRanking: ['Corporate executives','Corporate managers','Nomad pack','Pirate fleet','Gang family','Crime lords / mob','Combat-zone poor','Urban poor / homeless','Arcology dwellers','Reclaimers / rural'],
  parents: ['Both parents living','Both parents dead','One parent living','You never knew your parents','Parents divorced or separated','Raised by a relative','Raised in an institution','Raised by a gang or pack','Parents in hiding or on the run','One or both in prison'],
  familyEvent: ['Family lost everything through betrayal','Family lost everything to an accident','Family was exiled from its home','Family runs a long, bitter feud','A family member was murdered','Family fell into crushing debt','Family was framed for a crime','Family is at war with another','Nothing unusual happened','A relative is a famous hero or villain'],
  childhood: ['On the street, no home','In a corporate arcology','In a nomad pack on the road','In a corporate suburb','In a combat zone','In a decaying urban core','In a rural settlement','Aboard a ship or station','In a boarding academy','Drifting city to city'],
  siblings: ['No siblings','One older sibling','One younger sibling','Two siblings','Several siblings','A twin','A sibling you never met','A sibling who is your rival','A sibling you must protect','A sibling who is missing or dead'],
  valueMost: ['Money','Honor','Your word','Honesty','Knowledge','Vengeance','Love','Power','Family','Friendship'],
  feelings: ['People are tools, use them','People are untrustworthy','People are wonderful','I like almost everyone','I hate almost everyone','People are obstacles','People are precious and fragile','I value people for their use','Everyone is equal','I trust only my own'],
  valuedPerson: ['A parent','A sibling','A lover','A friend','A mentor or teacher','A childhood hero','A crewmate','A dependent you protect','Yourself, only','No one anymore'],
  valuedPossession: ['A weapon','A vehicle','A piece of jewelry','A photo or memento','A tool of your trade','A book or recording','A piece of cyberware','An article of clothing','A pet or companion','A debt owed to you'],
  friendDetail: ['like an old friend','like a sibling to you','like a teacher and mentor','like a partner in crime','someone you owe a debt','someone who owes you','a rival turned ally','a contact from a past job'],
  enemyWho: ['an ex-friend','an ex-lover','a relative','a childhood enemy','someone you wronged','a corporate exec','a government official','a gang and its leader'],
  enemyCause: ['over money','over a lover','over a betrayal','over an accident you caused','over a job gone wrong','over a public insult','over a death they blame on you','over clashing ideals'],
  romanceOutcome: ['it is happy and ongoing','it ended in tragedy','your lover died','it was a bitter breakup','it is forbidden and hidden','distance keeps you apart','it cooled into friendship','they left without a word','you parted as allies','it is complicated and intense']
};
/* main life-event table: some entries pull a sub-roll (friend / enemy / romance) */
var _LP_EVENTS = [
  { t:'plain', text:'A quiet year of training and scraping by.' },
  { t:'plain', text:'You hit a big score and made real money.' },
  { t:'plain', text:'You fell deep into debt.' },
  { t:'plain', text:'Someone you trusted betrayed you.' },
  { t:'plain', text:'You spent time on the wrong side of the law.' },
  { t:'plain', text:'You found a mentor who sharpened your trade.' },
  { t:'plain', text:'You were badly hurt and barely pulled through.' },
  { t:'plain', text:'You relocated and rebuilt your life somewhere new.' },
  { t:'friend',  text:'You made a close friend' },
  { t:'enemy',   text:'You made a dangerous enemy' },
  { t:'romance', text:'You fell into a love affair' }
];
var _LIFEPATH_FIELDS = [
  { key:'culturalOrigin', label:'Cultural origin', group:'origins', table:'culturalOrigin' },
  { key:'ethnicity', label:'Ethnicity', group:'origins', table:'ethnicity' },
  { key:'languages', label:'Languages', group:'origins', table:null },
  { key:'personality', label:'Personality', group:'origins', table:'personality', long:true },
  { key:'clothing', label:'Clothing style', group:'origins', table:'clothing' },
  { key:'hairstyle', label:'Hairstyle', group:'origins', table:'hairstyle' },
  { key:'affectation', label:'Affectation', group:'origins', table:'affectation' },
  { key:'familyRanking', label:'Family background', group:'family', table:'familyRanking' },
  { key:'parents', label:'Parents', group:'family', table:'parents' },
  { key:'familyEvent', label:'Family event', group:'family', table:'familyEvent', long:true },
  { key:'childhood', label:'Childhood environment', group:'family', table:'childhood' },
  { key:'siblings', label:'Siblings', group:'family', table:'siblings' },
  { key:'valueMost', label:'What you value most', group:'motivations', table:'valueMost' },
  { key:'feelings', label:'Feelings about people', group:'motivations', table:'feelings', long:true },
  { key:'valuedPerson', label:'Most valued person', group:'motivations', table:'valuedPerson' },
  { key:'valuedPossession', label:'Most valued possession', group:'motivations', table:'valuedPossession' }
];
var _LP_GROUPS = [['origins','Origins &amp; Style'], ['family','Family'], ['motivations','Motivations']];
function _lpPick(key) { var a = _LIFEPATH[key] || []; return a.length ? a[Math.floor(Math.random()*a.length)] : ''; }
function _lpGenEvent(age) {
  var e = _LP_EVENTS[Math.floor(Math.random()*_LP_EVENTS.length)];
  var text = e.text;
  if (e.t === 'friend')       text += ' (' + _lpPick('friendDetail') + ').';
  else if (e.t === 'enemy')   text += ': ' + _lpPick('enemyWho') + ', ' + _lpPick('enemyCause') + '.';
  else if (e.t === 'romance') text += ' — ' + _lpPick('romanceOutcome') + '.';
  return { id: _bankUid(), age: (age == null ? '' : age), text: text };
}

var CYBER_ZONE_MAP = {
  'NEURALWARE':        'cerveau',
  'CYBERAUDIO':        'cerveau',
  'CHIPWARE':          'cerveau',
  'CYBERVOCAL':        'cerveau',
  'CYBEROPTIC':        'yeux',
  'LINEAR FRAMES':     'frame',
  'CYBERWEAPON':       'forearm-r',
  'CYBERLIMB':         'rarm',
  'CYBERHAND':         'rhand',
  'CYBERFOOT':         'rfoot',
  'IMPLANT':           'centre',
  'CYBERNETIC SYSTEM': 'centre',
  'FASHIONWARE':       'peau',
  'EXOTIC BODYSCULPT': 'peau',
  'BODY PLATING':      'peau',
  'BIOWARE':           'coeur',
  'FULL CONVERSION':   'full'
};

var CYBER_SUB_ZONE = {
  'SUBDERMAL ARMOR':    'peau',
  'SKIN WEAVE':         'peau',
  'SKINWEAVE':          'peau',
  'NEURAL ENHANCEMENT': 'cerveau'
};

var ALL_CYBER_ZONES = ['cerveau','yeux','peau','coeur','centre','frame','forearm-r','forearm-l','rarm','larm','rhand','lhand','rleg','lleg','rfoot','lfoot','chips'];
var FULL_CONV_ZONES = ['cerveau','coeur','frame','rarm','larm','rleg','lleg'];
var DANGER_TYPES    = ['CYBERWEAPON','FULL CONVERSION','BODY PLATING'];
// Types whose OPTIONS attach to CYBERLIMB parents (no base type of their own)
var ATTACH_TO_LIMB  = ['CYBERNETIC SYSTEM'];

/* ─── Cyberware bonus helpers ─── */
function getCyberBonusesFor(type, target) {
  var result = [];
  CS.cyberware.forEach(function(c) {
    (c.bonuses || []).forEach(function(b) {
      if (b.type === type && b.target === target)
        result.push({ name: c.name, value: parseInt(b.value) || 0 });
    });
    (c.options || []).forEach(function(o) {
      (o.bonuses || []).forEach(function(b) {
        if (b.type === type && b.target === target)
          result.push({ name: o.name, value: parseInt(b.value) || 0 });
      });
    });
  });
  return result;
}
function getCyberTotalFor(type, target) {
  return getCyberBonusesFor(type, target).reduce(function(s, b) { return s + b.value; }, 0);
}
function effectiveStat(s) {
  return (CS.stats[s] || 0) + getCyberTotalFor('stat', s);
}

var WOUND_ZONES = [
  { label: 'Light', count: 4 }, { label: 'Serious', count: 4 }, { label: 'Critical', count: 4 },
  { label: 'Mortal0', count: 4 }, { label: 'Mortal1', count: 4 }, { label: 'Mortal2', count: 4 },
  { label: 'Mortal3', count: 4 }, { label: 'Mortal4', count: 4 }, { label: 'Mortal5', count: 4 },
  { label: 'Mortal6', count: 4 }
];

var ARMOR_DB, CS, CYBER_EFFECTS = {};
var openDropdown = null;

/* ─── UI helpers ─── */
function toggleSec(head) { head.parentElement.classList.toggle('collapsed'); }

/* ═══ TUTORIAL SYSTEM ═══
   Generic, data-driven contextual help. Add an entry here keyed by the section's
   id and a chip is injected in that section's header automatically.
   Hover the chip → short teaser tooltip; click → full popup. Reuse the real UI
   labels/icons inside the text (wrapped in <b class="tuto-ui"> / <span class="tuto-hit">)
   so players map the explanation directly onto what they see on screen. */
var TUTORIALS = {
  'sec-life': {
    title: 'Life — Health &amp; Damage',
    teaser: 'Your wound track and the per-location damage calculator. Click for hit locations, how armor SP / cover / AP work, and the wound states.',
    html:
      '<p>This section tracks how hurt you are and resolves incoming hits. Two parts: the <b class="tuto-ui">Health</b> wound track and the <b class="tuto-ui">Damage Calculator</b>.</p>' +
      '<h4>Wound track</h4>' +
      '<ul>' +
        '<li>40 boxes grouped into <b class="tuto-ui">Light · Serious · Critical · Mortal 0–6</b>. Each filled box = 1 point of damage taken.</li>' +
        '<li>Click any box to set/clear your current damage by hand; the counter <span class="tuto-chiprep">0 / 40</span> turns green → yellow → red as you fill it.</li>' +
        '<li>The line under the track shows your <b>state</b> and its penalty: Light (Stun 0), Serious (Stun −1), Critical (Stun −2, REF/INT/COOL halved), Mortal (rising Stun, roll a <b>Death Save</b> each turn).</li>' +
      '</ul>' +
      '<h4>Damage Calculator</h4>' +
      '<p>One column per hit location: <b class="tuto-ui">Head · Torso · R.Arm · L.Arm · R.Leg · L.Leg</b>. Fill the rows, then press the red <span class="tuto-hit">Hit</span> button for that location.</p>' +
      '<ul>' +
        '<li><b class="tuto-ui">ARMOR SP</b> — filled automatically from the armor you have equipped in <b class="tuto-ui">Fashion &amp; Armor</b> for that location.</li>' +
        '<li><b class="tuto-ui">COVER</b> — extra SP from cover you are behind (you type it in).</li>' +
        '<li><b class="tuto-ui">DMG</b> — the raw damage of the incoming attack.</li>' +
        '<li><b class="tuto-ui">AP</b> — armor-piercing: it <i>ablates</i> the armor on that location (reduces its current SP) as the round chews through it.</li>' +
      '</ul>' +
      '<p>Damage that gets through = <b>DMG − (ARMOR SP + COVER) − BTM</b>, where <b class="tuto-ui">BTM</b> (Body Type Modifier) comes from your <b>BODY</b> stat and is shown in <b class="tuto-ui">Stats</b>. Pressing <span class="tuto-hit">Hit</span> applies it to the wound track and ablates armor for any AP.</p>' +
      '<div class="tuto-example"><b>Example — shot in the Torso</b><br>' +
        'Incoming <b class="tuto-ui">DMG</b> 18 · <b class="tuto-ui">ARMOR SP</b> 14 (equipped jacket) · <b class="tuto-ui">COVER</b> 0 · <b>BODY</b> 8 → <b class="tuto-ui">BTM</b> 2.<br>' +
        'Through = 18 − (14 + 0) − 2 = <b>2 damage</b> → press <span class="tuto-hit">Hit</span> on Torso and 2 boxes fill (you are now <b>Light</b>, Stun 0).<br>' +
        'If the round had <b class="tuto-ui">AP</b> 10, the jacket also loses 10 from its current SP.</div>'
  },

  'sec-lifepath': {
    title: 'Lifepath',
    teaser: 'Your background: origins, style, family, motivations and the year-by-year life events that made you. Type your own or roll on the CP2020 tables.',
    html:
      '<p>Start with the free paragraph at the top to sketch your character in your own words. Below, every field is freeform too &mdash; or roll it with its <b class="tuto-ui">&#9860;</b> for a faithful Cyberpunk 2020 result you can edit.</p>' +
      '<ul>' +
        '<li><b class="tuto-ui">&#9860; Roll all</b> fills the blanks and <b>re-rolls anything previously rolled</b> &mdash; press it again for a fresh draft. Fields you typed yourself are always kept.</li>' +
        '<li>The per-field <b class="tuto-ui">&#9860;</b> rerolls just that one field.</li>' +
        '<li>Three blocks: <b class="tuto-ui">Origins &amp; Style</b>, <b class="tuto-ui">Family</b>, <b class="tuto-ui">Motivations</b>. Use the <b class="tuto-ui">&#9662;</b> by each title to collapse it.</li>' +
      '</ul>' +
      '<h4>Life events</h4>' +
      '<ul>' +
        '<li><b class="tuto-ui">&#9860; Roll a year</b> adds one generated, editable event (friends, enemies and lovers come with their own sub-rolls).</li>' +
        '<li><b class="tuto-ui">Roll by age</b> fills one event per year of adult life, from 16 up to your <b>Age</b>.</li>' +
        '<li><b class="tuto-ui">+ Add</b> records a manual event (age + text). Events sort by age.</li>' +
      '</ul>' +
      '<div class="tuto-example"><b>Example</b><br>' +
        'Set <b>Age</b> 25 in Identity, hit <b class="tuto-ui">Roll by age</b>, and you get 9 years of history (16&ndash;24). One reads: <i>"You made a dangerous enemy: an ex-lover, over a betrayal."</i> &mdash; rewrite it to fit your story, then save that person into <b class="tuto-ui">Contacts</b>.</div>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Identity:</span> your <b>Age</b> drives how many life events <b class="tuto-ui">Roll by age</b> generates (one per year from 16).</li>' +
        '<li><span class="tuto-arrow">&rarr; Network &amp; Gigs:</span> the friends, enemies and lovers your lifepath throws up are perfect entries for your <b class="tuto-ui">Contacts</b> roster.</li>' +
        '<li><span class="tuto-arrow">&rarr; Notes:</span> keep longer background prose there.</li>' +
      '</ul></div>'
  },

  'net-identity': {
    title: 'Digital Identity',
    teaser: 'Your Net self: ICON, how you jack in, your Interface rating, and how much heat NetWatch has on you. Appears when your Role is Netrunner.',
    html:
      '<p>The digital twin of your ID card &mdash; it unfolds under Identity once your <b class="tuto-ui">Role</b> is Netrunner.</p>' +
      '<ul>' +
        '<li><b class="tuto-ui">ICON</b> &mdash; your persona in the Net. It can look like anything; give it your style (armored warrior, neon serpent, a logo). Upload an image like a photo.</li>' +
        '<li><b class="tuto-ui">Interface</b> &mdash; how you connect: <b>plugs</b> (a cyberware install, faster, costs Humanity) or <b>trodes</b> (stick-on electrodes, no Humanity, but −2 REF in the Net).</li>' +
        '<li><b class="tuto-ui">Net base</b> &mdash; a readout of <b>INT + Interface</b> skill: your raw competence for Net actions.</li>' +
        '<li><b class="tuto-ui">NetWatch heat</b> &mdash; 0–10: how badly the NetCops want to brain-burn you. Click the pips to set it.</li>' +
        '<li><b class="tuto-ui">Signature program</b> &mdash; the program you are known for; it gets a ★ in your loadout.</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Cyberdeck &amp; Net:</span> your deck and program loadout; the signature program is flagged there.</li>' +
        '<li><span class="tuto-arrow">&rarr; Stats / Skills:</span> the Net base reads your <b>INT</b> and your <b>Interface</b> skill.</li>' +
        '<li><span class="tuto-arrow">&rarr; Cyberware:</span> interface plugs are a chrome install with a Humanity cost.</li>' +
      '</ul></div>'
  },

  'sec-net': {
    title: 'Cyberdeck &amp; Net',
    teaser: 'Load a cyberdeck, slot programs up to its MU limit (drag-and-drop), and track your program library. Quickhacking mode swaps CP2020 programs for homebrew quickhacks.',
    html:
      '<p>Two columns: <b class="tuto-ui">Cyberdeck</b> (left) and <b class="tuto-ui">Programs</b> or <b class="tuto-ui">Quickhacks</b> (right). The mode toggle switches between rulesets.</p>' +
      '<h4>Selecting a deck</h4>' +
      '<ul>' +
        '<li>Search the CP2020 deck database or add a <b class="tuto-ui">+ Custom deck</b>.</li>' +
        '<li>The deck card shows its stats (<b class="tuto-ui">MU</b>, <b class="tuto-ui">Speed</b>, <b class="tuto-ui">DataWall</b>, <b class="tuto-ui">CodeGate</b>) and the hardware options you can activate.</li>' +
        '<li>Upload a photo by clicking the deck image area.</li>' +
      '</ul>' +
      '<h4>Programs &amp; the MU bar</h4>' +
      '<ul>' +
        '<li>Add programs from the database or with <b class="tuto-ui">+ Custom program</b>. They sit in your library (right column).</li>' +
        '<li><b>Drag a program</b> from the right column and drop it onto the deck <b class="tuto-ui">MU bar</b> / slotted list to load it. Or press <b class="tuto-ui">Slot</b>.</li>' +
        '<li>The <b class="tuto-ui">MU bar</b> tracks used / available Memory Units. You cannot slot a program that would overflow.</li>' +
        '<li>Unslot with <b class="tuto-ui">✕</b> in the deck panel — the program stays in your library.</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Cyberware:</span> the netrunner needs an <i>Interface Plug</i> and a <i>Cyberdeck</i> cyberware install to run the Net.</li>' +
        '<li><span class="tuto-arrow">&rarr; Database:</span> browse all decks and programs in the <b class="tuto-ui">Database</b> tab → Decks / Programs.</li>' +
      '</ul></div>'
  },

  'press-card': {
    title: 'Press Card',
    teaser: 'For Media characters: your Credibility, the outlets you write for, your paying contracts, and your heat. Anyone can investigate — Credibility is what gets a story heard.',
    html:
      '<p>The journalist’s counterpart to the netrunner’s deck. It surfaces your <b class="tuto-ui">Credibility</b> (the Media special ability) and how you get paid.</p>' +
      '<h4>Credibility</h4>' +
      '<p>Set it in <b class="tuto-ui">Stats &amp; Skills → Special Abilities</b>. It governs how far a story travels every time you publish from a media suite; non-Media sit at 0 and die in obscurity.</p>' +
      '<h4>Contracts — three ways to get paid</h4>' +
      '<ul>' +
        '<li><b class="tuto-ui">Ad deal</b> — clean money running an advertiser’s placement on an outlet.</li>' +
        '<li><b class="tuto-ui">Advertorial</b> — a client supplies the material; you stake your Credibility. Disclose it (safe, less reach) or bury it (lucrative — a Credibility roll at the table if it surfaces).</li>' +
        '<li><b class="tuto-ui">Staff</b> — on the payroll, paid per article or per month against a quota.</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Stats / Skills:</span> Credibility lives under Special Abilities.</li>' +
        '<li><span class="tuto-arrow">&rarr; Web / Media app:</span> the advertorial disclosure here mirrors the <i>commissioned</i> toggle when you compose a piece.</li>' +
      '</ul></div>'
  },

  'sec-stats': {
    title: 'Stats &amp; Derived',
    teaser: 'Your nine stats and everything they feed: movement, carry, BTM, Humanity, and every skill total.',
    html:
      '<p>Set the nine core stats. The <b class="tuto-ui">derived</b> boxes recompute automatically and drive systems all over the sheet.</p>' +
      '<ul>' +
        '<li><b class="tuto-ui">RUN</b> / <b class="tuto-ui">LEAP</b> come from <b>MA</b>; <b class="tuto-ui">CARRY</b> / <b class="tuto-ui">LIFT</b> come from <b>BODY</b>.</li>' +
        '<li><b class="tuto-ui">BTM</b> (Body Type Modifier) comes from <b>BODY</b> and subtracts from every hit you take.</li>' +
        '<li><b class="tuto-ui">HUMANITY</b> = <b>EMP</b> &times; 10 &minus; total cyberware Humanity Cost.</li>' +
        '<li><b class="tuto-ui">SAVE</b> equals <b>BODY</b>.</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Life:</span> <b class="tuto-ui">BTM</b> cushions every hit in the damage calculator; at Critical wounds your <b>REF/INT/COOL</b> are halved.</li>' +
        '<li><span class="tuto-arrow">&rarr; Skills:</span> each skill total = governing stat + skill level, so raising a stat lifts every skill under it.</li>' +
        '<li><span class="tuto-arrow">&rarr; Cyberware:</span> installing chrome lowers <b class="tuto-ui">HUMANITY</b> shown here.</li>' +
      '</ul></div>'
  },

  'sec-skills': {
    title: 'Skills',
    teaser: 'Career and pickup skills. Each total combines a stat with the skill level; your Role decides which skills are career skills.',
    html:
      '<p>Raise skills with your skill points. A roll uses <b>governing stat + skill level + 1d10</b>.</p>' +
      '<ul>' +
        '<li>Career skills (granted by your Role) are highlighted; spend points there first.</li>' +
        '<li>Use <b class="tuto-ui">+ Custom</b> for skills not in the list.</li>' +
        '<li>The skill points field tracks your remaining budget.</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Identity:</span> the <b>Role</b> you pick flags the career skills and sets your Special Ability.</li>' +
        '<li><span class="tuto-arrow">&rarr; Stats:</span> the governing stat is added to every skill, so the same level is stronger on a high stat.</li>' +
        '<li><span class="tuto-arrow">&rarr; Weapons:</span> attacks roll <b>REF</b> + the matching weapon skill.</li>' +
        '<li><span class="tuto-arrow">&rarr; Cyberware:</span> some implants grant skill bonuses, applied here automatically.</li>' +
      '</ul></div>'
  },

  'sec-cyber': {
    title: 'Cyberware',
    teaser: 'Chrome and its price. Every implant chips away at your Humanity and can be bought on credit.',
    html:
      '<p>Add implants from the database or with <b class="tuto-ui">+ Custom</b>. Each carries a Humanity Cost (HC) and a surgery code.</p>' +
      '<ul>' +
        '<li>Implants can grant stat or skill bonuses, applied to the sheet live.</li>' +
        '<li>The more chrome you stack, the more Humanity you spend.</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Stats:</span> total HC reduces <b class="tuto-ui">HUMANITY</b>; bonuses raise the relevant stats and skills.</li>' +
        '<li><span class="tuto-arrow">&rarr; Lifestyle:</span> buy chrome on credit with <b class="tuto-ui">Cyberware financing</b> on a corporate or premium bank account.</li>' +
      '</ul></div>'
  },

  'sec-weapons': {
    title: 'Weapons',
    teaser: 'Your arsenal. Weapon damage feeds the Life damage calculator; attacks use REF plus the weapon skill.',
    html:
      '<p>Track each weapon damage, ammo, rate of fire, range and concealment. Add from the database or with <b class="tuto-ui">+ Custom</b>.</p>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Life:</span> take a weapon damage value and enter it as <b class="tuto-ui">DMG</b> in the damage calculator, then press <span class="tuto-hit">Hit</span>.</li>' +
        '<li><span class="tuto-arrow">&rarr; Skills / Stats:</span> to-hit = <b>REF</b> + the relevant weapon skill + 1d10.</li>' +
        '<li><span class="tuto-arrow">&rarr; Inventory:</span> ammunition and spare gear are tracked there.</li>' +
      '</ul></div>'
  },

  'sec-fashion': {
    title: 'Fashion &amp; Armor',
    teaser: 'Build outfits from your wardrobe, equip one with the E badge, and its armor SP flows into the Life damage calculator, location by location.',
    html:
      '<p>Three columns: the <b>body map</b> (left) shows what is on each location, the <b>outfit builder</b> (middle), and the <b class="tuto-ui">WARDROBE</b> (right) that holds every piece you own.</p>' +
      '<h4>Wardrobe — your closet</h4>' +
      '<ul>' +
        '<li>Type in <b class="tuto-ui">search to add...</b> to pull clothing and armor from the database, or <b class="tuto-ui">+ Custom</b> to invent a piece.</li>' +
        '<li>Pieces sit in the wardrobe until you put them into an outfit. Owning a piece does not mean you are wearing it.</li>' +
        '<li><b class="tuto-ui">&darr; Outfit</b> imports a full build exported from the Outfit Designer tool (a <i>.outfit.json</i> file).</li>' +
      '</ul>' +
      '<h4>Outfits — what you actually wear</h4>' +
      '<ul>' +
        '<li>Outfits are tabs (<b class="tuto-ui">Outfit A</b>, <b class="tuto-ui">Outfit B</b>...). Add one with <b class="tuto-ui">+</b>, rename by double-clicking the tab, close with <b class="tuto-ui">&times;</b>.</li>' +
        '<li><b>Drag a piece from the wardrobe onto the open outfit</b> to add it. A piece can be in several outfits at once.</li>' +
        '<li>For each piece in the outfit, tick the body locations it covers (<b class="tuto-ui">HEAD/TORSO/R.ARM/L.ARM/R.LEG/L.LEG</b>) and set its <b class="tuto-ui">SP</b>.</li>' +
        '<li>The <span class="tuto-chiprep">E</span> badge on a tab <b>equips</b> that outfit. It is a radio: only one outfit is worn at a time, and only the equipped one counts for armor.</li>' +
        '<li><b>Layering:</b> two pieces covering the same location add their SP together on that location.</li>' +
      '</ul>' +
      '<div class="tuto-example"><b>Example — a street loadout</b><br>' +
        'In <b class="tuto-ui">Outfit A</b> you drop a <i>Kevlar Vest</i> (SP 10, ticked TORSO) and a <i>Leather Jacket</i> (SP 4, ticked TORSO + both arms). Click the <span class="tuto-chiprep">E</span> on Outfit A to wear it.<br>' +
        'Result on the body map: TORSO = 10 + 4 = <b>14 SP</b>, each arm = <b>4 SP</b>. Those numbers land directly in <b class="tuto-ui">ARMOR SP</b> over in <b class="tuto-ui">Life</b>.<br>' +
        'Switch the <span class="tuto-chiprep">E</span> to a different outfit and your armor changes instantly.</div>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Life:</span> only the <span class="tuto-chiprep">E</span>-equipped outfit feeds <b class="tuto-ui">ARMOR SP</b> per location in the damage calculator; an <b class="tuto-ui">AP</b> hit ablates the SP of the pieces on that location.</li>' +
        '<li><span class="tuto-arrow">&rarr; Inventory:</span> coats, vests and bags also carry storage slots — see the <b class="tuto-ui">Storage</b> column in Inventory.</li>' +
        '<li><span class="tuto-arrow">&rarr; Outfit Designer tool:</span> design a full outfit there, export it, and bring it in with <b class="tuto-ui">&darr; Outfit</b>.</li>' +
      '</ul></div>'
  },

  'sec-inventory': {
    title: 'Inventory',
    teaser: 'Two columns: Storage (containers with slots) on the left, Equipment (loose gear) on the right. Drag gear into a container to carry it tidily.',
    html:
      '<p>Inventory is split in two: <b class="tuto-ui">Storage</b> (left) lists your containers, <b class="tuto-ui">Search Equipment</b> (right) is the gear itself.</p>' +
      '<h4>Equipment (right column)</h4>' +
      '<ul>' +
        '<li>Use <b class="tuto-ui">search gear...</b> to add items from the database, or <b class="tuto-ui">+ Custom</b> for anything else.</li>' +
        '<li>Loose gear lives in the right-hand list until you stash it somewhere.</li>' +
      '</ul>' +
      '<h4>Storage &amp; containers (left column)</h4>' +
      '<ul>' +
        '<li><b class="tuto-ui">search bags &amp; cases...</b> or <b class="tuto-ui">+ Custom</b> adds a container (backpack, duffel, briefcase, hard case...).</li>' +
        '<li>Every container has a number of <b>slots</b> = its capacity. A duffel holds a lot; an attaché case holds little.</li>' +
        '<li><b>Drag a gear item onto a container</b> to store it. When a container is full, it stops accepting items.</li>' +
        '<li>Worn clothing with pockets (coats, vests) can also act as containers — they show up here with their own slots.</li>' +
      '</ul>' +
      '<h4>Not stored</h4>' +
      '<p>The <b class="tuto-ui">Not stored</b> box appears when items are pulled out of a container (for example when you remove the bag, or a home/vehicle that held them). It is your loose pile waiting to be re-stashed.</p>' +
      '<div class="tuto-example"><b>Example — packing for a run</b><br>' +
        'Add a <i>Med-Tech Field Backpack</i> (12 slots) in <b class="tuto-ui">Storage</b>. Add an <i>IV Kit</i>, <i>Medscanner</i> and <i>Frag Grenades x3</i> in <b class="tuto-ui">Equipment</b>.<br>' +
        'Drag the three items onto the backpack: it now reads <b>3/12</b>. Drop the backpack into your apartment cargo (in <b class="tuto-ui">Lifestyle</b>) and the whole kit travels with it — pull it back out and the contents land in <b class="tuto-ui">Not stored</b>.</div>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Fashion &amp; Armor:</span> a piece worn in your outfit (a trenchcoat, a vest) can double as a container with slots here — the wardrobe and the storage list share those pocketed pieces.</li>' +
        '<li><span class="tuto-arrow">&rarr; Lifestyle:</span> a home has cargo slots (rooms &times; 50). Drag gear or whole bags in to stash them off your person.</li>' +
        '<li><span class="tuto-arrow">&rarr; Vehicles:</span> each ride has its own cargo hold; drag gear in to haul it without carrying it.</li>' +
        '<li><span class="tuto-arrow">&rarr; Stats:</span> what you carry on you is weighed against <b class="tuto-ui">CARRY</b> / <b class="tuto-ui">LIFT</b> (from <b>BODY</b>) — stashed gear in a home or vehicle does not weigh you down.</li>' +
      '</ul></div>'
  },

  'sec-vehicles': {
    title: 'Vehicles',
    teaser: 'Your rides, and rolling storage. Each vehicle carries cargo slots that hold inventory.',
    html:
      '<p>Track each vehicle defence (SP/SDP), speed, options and cargo capacity.</p>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Inventory:</span> drag gear into a vehicle cargo hold to carry it without weighing you down.</li>' +
        '<li><span class="tuto-arrow">&rarr; Lifestyle:</span> pay for it from cash or a bank account.</li>' +
      '</ul></div>'
  },

  'sec-lifestyle': {
    title: 'Lifestyle',
    teaser: 'Money, home and a full banking simulation. Cash, salary, rent, services, bank accounts by tier, loans, transfers and financial products — all settled monthly.',
    html:
      '<p>The grid has three areas: <b class="tuto-ui">Housing</b> and <b class="tuto-ui">Services</b> on top, the full <b class="tuto-ui">Finances</b> panel below. Everything monthly is settled in one click.</p>' +

      '<h4>The monthly clock</h4>' +
      '<p>Press <span class="tuto-hit">&#9200; End of month</span> to advance one month and settle in order: <b>salary in</b> &rarr; account <b>regular inputs in</b> &rarr; <b>services</b> out &rarr; <b>rent + utilities</b> out &rarr; <b>groceries</b> out &rarr; account <b>fees</b> out &rarr; <b>loan interest</b> accrues &rarr; <b>deposits/insurance/financing</b> resolve. The <b class="tuto-ui">Monthly out</b> figure on the cash card previews the total drain.</p>' +

      '<h4>Cash, salary &amp; credchips</h4>' +
      '<ul>' +
        '<li><b class="tuto-ui">Cash on hand</b> is untraceable money. <b class="tuto-ui">Salary</b> (eb/mo) is your steady income; the <b class="tuto-ui">+</b> beside it pays you one month immediately.</li>' +
        '<li>Credchips are anonymous cash cards grouped under the balance.</li>' +
        '<li>With at least one account you also get <b class="tuto-ui">Withdraw from account</b> / <b class="tuto-ui">Deposit to account</b> to move money between cash and the bank.</li>' +
        '<li><b class="tuto-ui">Street debt &mdash; loan sharks:</b> <b class="tuto-ui">+ Borrow</b> fronts you cash on the spot with no account and no collateral, but at brutal rates (60&ndash;200%+/yr) that compound every End of month. Repay from cash on hand.</li>' +
      '</ul>' +

      '<h4>Housing &amp; Services</h4>' +
      '<ul>' +
        '<li>A home has rooms, rent, utilities and cargo slots (rooms &times; 50). Its <b class="tuto-ui">Billed to</b> selector sends rent + utilities to a chosen account, or leaves them on cash.</li>' +
        '<li>Each service line has its own <b class="tuto-ui">Billed to</b> selector. Groceries are a quality &times; multiplier monthly cost.</li>' +
        '<li>Every open bank account also appears in Services as a <b class="tuto-ui">&#127974; ... account fee</b> line, so you see the cost of banking next to everything else.</li>' +
      '</ul>' +

      '<h4>Bank accounts &amp; tiers</h4>' +
      '<p>Open an account from <b class="tuto-ui">+ open a bank account...</b> in Services. Banks come in three tiers, each with a monthly fee and an overdraft ceiling:</p>' +
      '<ul>' +
        '<li><b>Budget</b> (tier 1): fee <b>50</b> eb/mo, overdraft <b>100</b> eb. Cheap, no products.</li>' +
        '<li><b>Corporate</b> (tier 2): fee <b>400</b> eb/mo, overdraft <b>1000</b> eb. Unlocks deposits, insurance, financing, escrow (and laundering at Security/Financial banks).</li>' +
        '<li><b>Premium</b> (tier 3): fee <b>1000</b> eb/mo, overdraft <b>5000</b> eb. Everything, including investments and laundering.</li>' +
      '</ul>' +
      '<p>The sidebar lists <b class="tuto-ui">Cash</b> plus each account (colour-dotted by bank). Open an account to see its four tabs:</p>' +
      '<ul>' +
        '<li><b class="tuto-ui">Liquidity</b> — the editable <b class="tuto-ui">Demand deposit</b> balance, <b class="tuto-ui">Regular inputs</b> (recurring income; the <span class="tuto-chiprep">&#9656;</span> credits one now), the <b class="tuto-ui">Regular outputs</b> billed to this account, and a <b class="tuto-ui">One-off history</b> (record an expense with <b>&minus;</b> or income with <b>+</b>).</li>' +
        '<li><b class="tuto-ui">Operations</b> — <b class="tuto-ui">Transfers</b> to other accounts or NPC payees (with history), and your saved <b class="tuto-ui">NPC payees</b>.</li>' +
        '<li><b class="tuto-ui">Finance</b> — tier-gated products (below).</li>' +
        '<li><b class="tuto-ui">Loans</b> — your debts.</li>' +
      '</ul>' +
      '<p><b>Overdraft:</b> any debit that would push the balance below &minus;(tier ceiling) is refused. So a Budget account can only go to &minus;100 eb.</p>' +

      '<h4>Loans</h4>' +
      '<p>In the Loans tab, <b class="tuto-ui">+ New loan</b> asks for a <b>collateral</b> and an <b>amount</b>. The amount cannot exceed <b>50&times; the collateral</b>. The suggested rate improves with your deposit and salary; you can haggle it. Interest accrues every End of month; pay it down anytime.</p>' +

      '<h4>Financial products (Finance tab)</h4>' +
      '<ul>' +
        '<li><b>Term deposits</b> — lock money for N months at a fixed rate; matures back to the balance (early exit forfeits interest + 5% penalty).</li>' +
        '<li><b>Investments</b> — buy corporate shares; prices drift up over time (with risk) and move each End of month; sell for profit or loss.</li>' +
        '<li><b>Insurance</b> — pay a monthly premium; file a claim for a GM-set payout.</li>' +
        '<li><b>Cyberware financing</b> — buy chrome on instalments billed monthly.</li>' +
        '<li><b>Contract escrow</b> — lock funds in/out, released on a handshake.</li>' +
        '<li><b>Launder funds</b> — convert account money to untraceable cash (or back) for a commission.</li>' +
      '</ul>' +

      '<div class="tuto-example"><b>Example — a month in the life</b><br>' +
        'You hold an Arasaka <b>Corporate</b> account (fee 400/mo) with <b class="tuto-ui">Demand deposit</b> 3,000 eb, a 2,000 eb/mo <b class="tuto-ui">Regular input</b> (retainer), an apartment (rent 600 + utilities 40) billed to it, and a 500 eb/mo netlink service billed to it.<br>' +
        'Press <span class="tuto-hit">&#9200; End of month</span>: +2,000 input, &minus;640 housing, &minus;500 service, &minus;400 fee = <b>3,460 eb</b>. (Salary and groceries hit cash separately.)</div>' +

      '<div class="tuto-example"><b>Example — leveraging a loan</b><br>' +
        'You put up <b>2,000 eb collateral</b>, so you can borrow up to <b>100,000 eb</b> (50&times;). You take <b>20,000 eb</b> at a haggled 12%/yr. It lands in your deposit; each End of month adds 1% interest until you repay.</div>' +

      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Identity:</span> starting <b class="tuto-ui">Salary</b> scales with your <b>Role</b> rank.</li>' +
        '<li><span class="tuto-arrow">&rarr; Network &amp; Gigs:</span> <b class="tuto-ui">Collect payout</b> on a finished gig drops the net (minus fixer cut) into cash or a chosen account and logs it in <b class="tuto-ui">Liquidity</b>.</li>' +
        '<li><span class="tuto-arrow">&rarr; Cyberware:</span> <b>Cyberware financing</b> buys chrome on credit from a Corporate or Premium account.</li>' +
        '<li><span class="tuto-arrow">&rarr; Inventory:</span> a home provides cargo slots (rooms &times; 50) to stash gear and bags.</li>' +
        '<li><span class="tuto-arrow">&rarr; Investments:</span> share prices are seeded from the corporations in the database.</li>' +
      '</ul></div>'
  },

  'sec-network': {
    title: 'Network &amp; Gigs',
    teaser: 'Your contacts, fixers and job board. Fixers broker gigs; finished gigs pay out into your banking.',
    html:
      '<p>Keep a roster of <b class="tuto-ui">Contacts</b> (friends, enemies, fixers and more) and run gigs on the <b class="tuto-ui">JOB BOARD</b> with a status, risk and source.</p>' +
      '<ul>' +
        '<li><b class="tuto-ui">Browse corp gigs</b> pulls the public job openings from corporations you built in the Organisations tool.</li>' +
        '<li><b class="tuto-ui">+ Gig</b> adds a manual run, optionally brokered by a Fixer contact (shown as <i>via &lt;name&gt;</i>).</li>' +
      '</ul>' +
      '<div class="tuto-links"><b class="tuto-links-h">&harr; Links</b><ul>' +
        '<li><span class="tuto-arrow">&rarr; Lifestyle:</span> <b class="tuto-ui">Collect payout</b> credits cash or a bank account, minus the fixer cut, and logs it in the account history.</li>' +
        '<li><span class="tuto-arrow">&rarr; Organisations tool:</span> public openings of your corporations feed the job board.</li>' +
      '</ul></div>'
  },

  'sec-notes': {
    title: 'Notes',
    teaser: 'Free space for anything the structured sections do not cover.',
    html:
      '<p>A plain text area for backstory, leads, session notes, reminders, anything. It travels with the character in the export and import.</p>'
  }
};

/* Lazy tooltip element (hover) */
function _tutoTipEl() {
  var t = document.getElementById('tuto-tip');
  if (!t) {
    t = document.createElement('div');
    t.id = 'tuto-tip'; t.className = 'tuto-tip'; t.style.display = 'none';
    document.body.appendChild(t);
  }
  return t;
}
function tutoHover(chip, id) {
  var entry = TUTORIALS[id]; if (!entry) return;
  var t = _tutoTipEl();
  t.innerHTML = '<div class="tuto-tip-title">' + entry.title + '</div><div class="tuto-tip-body">' + entry.teaser + '</div><div class="tuto-tip-hint">click for details</div>';
  t.style.display = 'block';
  var r = chip.getBoundingClientRect();
  var tw = Math.min(300, window.innerWidth - 20);
  t.style.width = tw + 'px';
  var left = Math.min(r.left, window.innerWidth - tw - 10);
  t.style.left = Math.max(8, left) + 'px';
  // place below the chip, flip above if not enough room
  var below = r.bottom + 8;
  if (below + t.offsetHeight > window.innerHeight - 8 && r.top - t.offsetHeight - 8 > 0) {
    t.style.top = (r.top - t.offsetHeight - 8) + 'px';
  } else {
    t.style.top = below + 'px';
  }
}
function tutoOut() { var t = document.getElementById('tuto-tip'); if (t) t.style.display = 'none'; }

/* Full popup (click) */
function _tutoPopupEl() {
  var ov = document.getElementById('tuto-popup-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tuto-popup-overlay'; ov.className = 'tuto-popup-overlay';
    ov.onclick = function(e){ if (e.target === ov) tutoClose(); };
    ov.innerHTML = '<div class="tuto-popup"><div class="tuto-popup-head"><span class="tuto-popup-mark">ⓘ</span><span id="tuto-popup-title"></span><span class="tuto-popup-x" onclick="tutoClose()">✕</span></div><div id="tuto-popup-body" class="tuto-popup-body"></div></div>';
    document.body.appendChild(ov);
  }
  return ov;
}
function tutoOpen(id) {
  var entry = TUTORIALS[id]; if (!entry) return;
  tutoOut();
  var ov = _tutoPopupEl();
  document.getElementById('tuto-popup-title').innerHTML = entry.title;
  document.getElementById('tuto-popup-body').innerHTML = entry.html;
  ov.style.display = 'flex';
}
function tutoClose() { var ov = document.getElementById('tuto-popup-overlay'); if (ov) ov.style.display = 'none'; }

/* Site landing tutorial — reuses the Character-Sheet tutorial popup look. */
function homeTutorial() {
  var ov = _tutoPopupEl();
  document.getElementById('tuto-popup-title').innerHTML = 'How this works';
  document.getElementById('tuto-popup-body').innerHTML =
    '<p>A free, unofficial companion for <b>Cyberpunk 2020</b> (v2.01). Everything runs in your browser — nothing to sign up for.</p>' +
    '<h4>Tools</h4><ul>' +
      '<li><b class="tuto-ui">Character Sheet</b> — full PC sheet: stats, skills, gear, lifepath, cyberdeck, lifestyle &amp; banking. Export/import as JSON.</li>' +
      '<li><b class="tuto-ui">NPC Sheet</b>, <b class="tuto-ui">Organisations</b>, <b class="tuto-ui">Night City Map</b>, <b class="tuto-ui">Outfit Designer</b> — build the world around the table.</li>' +
    '</ul>' +
    '<h4>Data &amp; Files</h4><ul>' +
      '<li><b class="tuto-ui">Data</b> — searchable lists (cyberware, weapons, vehicles, gear, corps) with their book references.</li>' +
      '<li><b class="tuto-ui">Files</b> — core books and homebrew supplements.</li>' +
    '</ul>' +
    '<h4>Multiplayer <span class="tuto-chiprep">beta</span></h4>' +
    '<p>Play at the table on your own Wi-Fi — <b>no cloud, no account, no fees</b>.</p>' +
    '<div class="tuto-example">The GM runs a small free desktop app (the <b>GM Hub</b>) and shares a link. Players open it; their sheets sync live to the GM. See the <a href="#" onclick="tutoClose();setCategory(\'multiplayer\');return false;">Multiplayer</a> tab to download it, or the <a href="join.html">Join page</a> if your GM already sent you a link.</div>' +
    '<div class="tuto-links"><b class="tuto-links-h">⇄ Tips</b><ul>' +
      '<li><span class="tuto-arrow">→</span> Most sheets export to JSON so you can back them up or hand them to your GM.</li>' +
      '<li><span class="tuto-arrow">→</span> The <span class="tuto-chiprep">i</span> chips throughout the app open per-section guides like this one.</li>' +
    '</ul></div>';
  ov.style.display = 'flex';
}

/* Multiplayer tutorial — same popup look, explains how a local session runs. */
function multiTutorial() {
  var ov = _tutoPopupEl();
  document.getElementById('tuto-popup-title').innerHTML = 'Multiplayer';
  document.getElementById('tuto-popup-body').innerHTML =
    '<p>Everything runs on your own network — <b>no cloud, no account, no fees</b>. The GM hosts; players just open a link.</p>' +
    '<h4>For the GM</h4><ul>' +
      '<li>Download and open the <b class="tuto-ui">GM Hub</b> app (buttons on this tab).</li>' +
      '<li>It opens your dashboard and a folder of editable sheet files.</li>' +
      '<li>Share each player their link; their sheet appears live and you can edit any of them.</li>' +
    '</ul>' +
    '<h4>For a player</h4><ul>' +
      '<li>Nothing to install — open the link your GM sends, on the same Wi-Fi.</li>' +
      '<li>Edit your sheet; it syncs to the GM. Offline edits merge when you reconnect.</li>' +
    '</ul>' +
    '<div class="tuto-example">A link looks like <code>http://192.168.1.42:8787/cs.html?campaign=main&amp;sheet=Player_1</code>. The page is served by the GM\'s machine, so it\'s plain <code>http://</code> on the LAN — no padlock, that\'s normal and safe here.</div>' +
    '<div class="tuto-links"><b class="tuto-links-h">⇄ Links</b><ul>' +
      '<li><span class="tuto-arrow">→</span> Got a link already? Use the <a href="join.html">Join page</a>.</li>' +
    '</ul></div>';
  ov.style.display = 'flex';
}

/* ─── Player CONNECT (C6): pull the GM's copy or push your local build ─── */
function _initPlayerConnect() {
  var foot = document.getElementById('sidebar-foot'); if (!foot) return;
  if (document.getElementById('player-connect-btn')) return;
  var b = document.createElement('button');
  b.id = 'player-connect-btn';
  b.className = 'side-connect';
  b.innerHTML = '⇄ CONNECT';
  b.title = "Connect to your GM's session";
  b.onclick = playerConnect;
  foot.insertBefore(b, foot.firstChild);
}
function playerConnect() {
  var ov = _tutoPopupEl();
  document.getElementById('tuto-popup-title').innerHTML = 'Connect to your GM';
  document.getElementById('tuto-popup-body').innerHTML =
    '<div id="pc-discover"></div>' +
    '<div id="pc-roster"><p class="pc-loading">Looking for your GM…</p></div>' +
    '<details class="pc-manual"><summary>Connect manually</summary>' +
      '<label class="pc-label">Paste the link your GM gave you</label>' +
      '<input id="pc-link" class="pc-input" placeholder="http://192.168.1.42:8787/app.html?campaign=main&amp;sheet=Player_1">' +
      '<div class="pc-or">— or fill it in —</div>' +
      '<div class="pc-row">' +
        '<div><label class="pc-label">Campaign</label><input id="pc-camp" class="pc-input" value="main"></div>' +
        '<div><label class="pc-label">Your sheet id</label><input id="pc-sheet" class="pc-input" placeholder="Player_1"></div>' +
      '</div>' +
      '<div class="pc-actions">' +
        '<button class="pc-btn pc-btn-recv" onclick="_playerGo(\'join\')">⇄ CONNECT<small>join the session</small></button>' +
      '</div>' +
    '</details>' +
    '<div id="pc-err" class="pc-err"></div>';
  ov.style.display = 'flex';
  _pcLoadDiscover(); _pcLoadRoster();
}
function _pcApi(path) { return fetch('/__api/' + path).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
// Characters the GM is hosting on this hub (same-origin) → click to join directly.
function _pcLoadRoster() {
  _pcApi('roster').then(function (d) {
    var box = document.getElementById('pc-roster'); if (!box) return;
    var camps = (d && d.campaigns) || [], withSheets = camps.filter(function (c) { return c.sheets && c.sheets.length; });
    if (!withSheets.length) {
      box.innerHTML = '<p class="pc-empty">' + (d
        ? 'No characters hosted yet — ask your GM to go live, or connect manually below.'
        : 'Open your GM\'s link on the same Wi-Fi to see the character list, or connect manually below.') + '</p>';
      return;
    }
    box.innerHTML = '<p class="pc-pick">Pick your character:</p>' + withSheets.map(function (c) {
      return '<div class="pc-sec-h">' + _esc(c.name || c.id) + (c.live ? ' <span class="pc-live">LIVE</span>' : '') + '</div>' +
        '<div class="pc-chars">' + c.sheets.map(function (s) {
          var av = s.photo ? '<img class="pc-char-av" src="' + _esc(s.photo) + '">'
            : '<span class="pc-char-av pc-char-noav">' + _esc((s.name || '?').slice(0, 1).toUpperCase()) + '</span>';
          return '<button class="pc-char" onclick="_playerJoinSheet(\'' + _esc(c.id) + '\',\'' + _esc(s.id) + '\')">' + av +
            '<span class="pc-char-t"><b>' + _esc(s.name || s.id) + '</b>' + (s.handle ? '<span class="pc-char-h">"' + _esc(s.handle) + '"</span>' : '') + '</span></button>';
        }).join('') + '</div>';
    }).join('');
  });
}
// Other GMs seen on the LAN (mDNS). Click → open that hub's site, which lists its own roster.
function _pcLoadDiscover() {
  _pcApi('discover').then(function (d) {
    var box = document.getElementById('pc-discover'); if (!box) return;
    var hubs = (d && d.hubs) || []; if (!hubs.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="pc-sec-h">On your network</div>' + hubs.map(function (h) {
      return '<button class="pc-hub" onclick="location.href=\'http://' + _esc(h.host) + ':' + h.port + '/index.html?player=1&autoconnect=1\'">' +
        '<span class="pc-hub-ico">◈</span><span class="pc-hub-t"><b>' + _esc(h.name || 'Datafort Hub') + '</b>' +
        (h.campaign ? '<span class="pc-hub-c">' + _esc(h.campaign) + '</span>' : '') + '</span><span class="pc-hub-go">▸</span></button>';
    }).join('');
  });
}
function _playerJoinSheet(camp, sheet) {
  window.location.href = 'app.html?campaign=' + encodeURIComponent(camp) + '&sheet=' + encodeURIComponent(sheet);
}
function _playerGo(mode) {
  var errEl = document.getElementById('pc-err');
  function fail(m) { if (errEl) errEl.textContent = m; }
  var link = (document.getElementById('pc-link').value || '').trim();
  var camp, sheet, origin = '';
  if (link) {
    try {
      var u = new URL(link, location.href);
      if (!/^https?:$/.test(u.protocol)) return fail('That does not look like a valid hub link.');
      camp = u.searchParams.get('campaign'); sheet = u.searchParams.get('sheet');
      if (!camp || !sheet) return fail('That link is missing the campaign or sheet.');
      if (u.origin !== location.origin) origin = u.origin; // a different hub
    } catch (e) { return fail('That does not look like a valid link.'); }
  } else {
    camp = (document.getElementById('pc-camp').value || 'main').trim();
    sheet = (document.getElementById('pc-sheet').value || '').trim();
    if (!sheet) return fail('Paste the link, or enter your sheet id.');
  }
  // Connect opens the session shell (app.html) for this campaign/sheet.
  var url = (origin ? origin + '/' : '') + 'app.html?campaign=' + encodeURIComponent(camp) +
    '&sheet=' + encodeURIComponent(sheet);
  window.location.href = url;
}

/* Inject a chip into every section header that has a TUTORIALS entry (idempotent) */
function initTutorialChips() {
  Object.keys(TUTORIALS).forEach(function(id) {
    var sec = document.getElementById(id); if (!sec) return;
    var head = sec.querySelector('.cs-section-head'); if (!head) return;
    if (head.querySelector('.tuto-chip')) return; // already injected
    var chip = document.createElement('span');
    chip.className = 'tuto-chip';
    chip.title = 'How this section works';
    chip.textContent = 'i';
    chip.setAttribute('onclick', "event.stopPropagation();tutoOpen('" + id + "')");
    chip.setAttribute('onmouseenter', "tutoHover(this,'" + id + "')");
    chip.setAttribute('onmouseleave', "tutoOut()");
    var toggle = head.querySelector('.toggle');
    if (toggle) head.insertBefore(chip, toggle); else head.appendChild(chip);
  });
}

/* ─── Shell: unified sidebar navigation ─── */
var TOOLS_LIST = [
  { tool:'menu',      label:'Menu' },
  { tool:'charsheet', label:'Character Sheet' },
  { tool:'npcsheet',  label:'NPC Sheet' },
  { tool:'orgs',      label:'Organisations' },
  { tool:'ncmap',     label:'Map' },
  { tool:'galmap',    label:'Galactic Map' },
  { tool:'outfit',    label:'Outfit Designer' }
];
function _pingFrame(fr) { try { var w = fr && fr.contentWindow; if (w) { if (typeof w.resize === 'function') w.resize(); w.dispatchEvent(new Event('resize')); } } catch (e) {} }
function loadToolFrame(panel) {
  if (!panel) return; var fr = panel.querySelector('iframe'); if (!fr) return;
  if (fr.getAttribute('data-src') && !fr.getAttribute('src')) {
    fr.addEventListener('load', function() { _pingFrame(fr); setTimeout(function(){ _pingFrame(fr); }, 150); });
    fr.setAttribute('src', fr.getAttribute('data-src'));
  } else { _pingFrame(fr); setTimeout(function(){ _pingFrame(fr); }, 150); }
}
function showTool(tool) {
  document.querySelectorAll('#tools-content > [id^="tool-"]').forEach(function(p) { p.style.display = 'none'; });
  var panel = document.getElementById('tool-' + tool);
  if (panel) { panel.style.display = 'block'; loadToolFrame(panel); }
  document.querySelectorAll('#sub-nav .tool-link').forEach(function(l) { l.classList.toggle('active', l.dataset.tool === tool); });
}
function setCategory(panel) {
  document.querySelectorAll('.cat').forEach(function(c) { c.classList.toggle('active', c.dataset.panel === panel); });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.toggle('active', p.id === panel); });
  renderSubNav(panel);
  if (panel === 'pdfs') mountSiteReader();
}
// Files tab → the "Établi" sourcebook reader (offline). Books from the hub's
// local folder (/__api/books) when served by a hub, else the static pdf-src list.
function mountSiteReader() {
  var host = document.getElementById('pdf-frame');
  if (!host || !window.SourcebookReader || host.dataset.reader) return;
  host.dataset.reader = '1';
  function staticBooks() {
    var src = document.getElementById('pdf-src'); if (!src) return [];
    return Array.prototype.slice.call(src.querySelectorAll('li[data-pdf]')).map(function (li) {
      return { id: li.dataset.pdf, title: (li.textContent || '').trim(), url: li.dataset.pdf };
    });
  }
  fetch('/__api/books').then(function (r) { return r.ok ? r.json() : { books: [] }; }).then(function (d) {
    var list = (d && d.books && d.books.length) ? d.books : staticBooks();
    host.innerHTML = ''; window.SourcebookReader.mount(host, { books: list });
  }).catch(function () { host.innerHTML = ''; window.SourcebookReader.mount(host, { books: staticBooks() }); });
}
function renderSubNav(panel) {
  var sn = document.getElementById('sub-nav'); if (!sn) return;
  if (panel === 'tools') {
    var active = (document.querySelector('#tools-content > [id^="tool-"]:not([style*="display: none"])') || {}).id || 'tool-menu';
    var cur = active.replace('tool-', '');
    sn.innerHTML = TOOLS_LIST.map(function(t) {
      return '<div class="sub-item tool-link' + (t.tool === cur ? ' active' : '') + '" data-tool="' + t.tool + '">' + t.label + '</div>';
    }).join('');
    sn.querySelectorAll('.tool-link').forEach(function(l) { l.onclick = function() { showTool(l.dataset.tool); }; });
  } else if (panel === 'database') {
    sn.innerHTML = (dbDatasets || []).map(function(name) {
      return '<div class="sub-item db-tab' + (name === dbCur ? ' active' : '') + '" data-name="' + name + '">' + (name.charAt(0).toUpperCase() + name.slice(1)) + '</div>';
    }).join('');
    sn.querySelectorAll('.db-tab').forEach(function(b) { b.onclick = function() { setDbTab(b.dataset.name); }; });
  } else if (panel === 'pdfs') {
    // The reader has its own source tabs / TOC; the sidebar is just a hint.
    sn.innerHTML = '<div class="sub-note">Sourcebooks open on the workbench. Switch books with the tabs at the top.</div>';
  } else if (panel === 'multiplayer') {
    sn.innerHTML = '<div class="sub-note">Local-first co-op: the GM runs a small free app, players sync on the same Wi-Fi. No cloud.</div>' +
      '<div class="sub-item" onclick="document.getElementById(\'dl-mac\').scrollIntoView({behavior:\'smooth\'})">Download the GM Hub</div>' +
      '<div class="sub-item" onclick="window.open(\'join.html\',\'_blank\')">Join a campaign (player)</div>';
  } else { // home
    sn.innerHTML = '<div class="sub-note">an unofficial Cyberpunk 2020 datafort.</div>';
  }
}
function toggleSidebar() {
  var app = document.getElementById('app'); if (!app) return;
  app.classList.toggle('side-collapsed');
  var b = document.getElementById('sidebar-collapse'); if (b) b.textContent = app.classList.contains('side-collapsed') ? '»' : '«';
  try { localStorage.setItem('sidebarCollapsed', app.classList.contains('side-collapsed') ? '1' : '0'); } catch(e) {}
}
function togglePlain() {
  var on = document.documentElement.toggleAttribute('data-plain');
  try { localStorage.setItem('bartmoss_plain', on ? '1' : '0'); } catch(e) {}
}

/* ─── Database ─── */
function dbFlat(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(dbFlat).join(', ');
    if (v.book) return v.book + ' p.' + (v.page || '');
    if (v.name) return v.name + (v.description ? ' — ' + v.description : '');
    return JSON.stringify(v);
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function dbRender() {
  var cols = DB_COLS[dbCur] || Object.keys(DB[dbCur][0] || {});
  var q = document.getElementById('db-search').value.toLowerCase();
  var rows = DB[dbCur].filter(function(r) {
    return !q || cols.some(function(c) { return dbFlat(r[c]).toLowerCase().indexOf(q) >= 0; });
  });
  if (dbSort) {
    rows.sort(function(a, b) {
      var va = a[dbSort], vb = b[dbSort];
      if (numCols.indexOf(dbSort) >= 0) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; return dbSortAsc ? va - vb : vb - va; }
      va = dbFlat(va).toLowerCase(); vb = dbFlat(vb).toLowerCase();
      return dbSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }
  document.getElementById('db-count').textContent = rows.length + '/' + DB[dbCur].length;
  var arrow = function(s) { return s === dbSort ? '<span style="font-size:10px;margin-left:2px;">' + (dbSortAsc ? '▲' : '▼') + '</span>' : ''; };
  document.getElementById('db-thead').innerHTML = '<tr>' + cols.map(function(c) { return '<th data-col="' + c + '">' + c + arrow(c) + '</th>'; }).join('') + '</tr>';
  var tb = document.getElementById('db-tbody');
  tb.innerHTML = rows.map(function(r, i) {
    return '<tr data-dbr="' + i + '">' + cols.map(function(c) {
      var v = dbFlat(r[c]), cls = c === 'name' ? 'cn' : (numCols.indexOf(c) >= 0 && v ? 'cnum' : '');
      if (!v) cls += ' cempty';
      return '<td class="' + cls + '">' + (v || '—') + '</td>';
    }).join('') + '</tr>';
  }).join('');
  if (window.CtxMenu) tb.querySelectorAll('tr[data-dbr]').forEach(function(tr) { CtxMenu.attach(tr, function() { return _siteDbMenu(rows[+tr.getAttribute('data-dbr')]); }); });
}
function _siteDbMenu(r) {
  if (!r) return null;
  var ref = (r.source && (r.source.book ? r.source.book + ' p.' + (r.source.page || '') : r.source)) || '';
  var items = [{ label: 'Copy name', icon: '⧉', onClick: function() { try { navigator.clipboard.writeText(r.name || ''); } catch (e) {} } }];
  if (ref) items.push({ label: 'Copy reference', icon: '▤', onClick: function() { try { navigator.clipboard.writeText((r.name || '') + ' — ' + ref); } catch (e) {} } });
  return items;
}

function setDbTab(name) {
  dbCur = name; dbSort = null; dbSortAsc = true;
  document.querySelectorAll('.db-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.name === name); });
  var ti = document.getElementById('db-title'); if (ti) ti.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  dbRender();
}

/* ─── Character Sheet ─── */
function makeBlankCS() {
  var sk = {};
  DB.skills.forEach(function(s) { sk[s.name] = 0; });
  return {
    name: '', handle: '', role: '', age: '', sa: '', photo: '', money: 0,
    pending: [],           // unpaid purchases tray (catalog buys awaiting debit)
    stats: { INT: 0, REF: 0, TECH: 0, COOL: 0, ATT: 0, LUCK: 0, MA: 0, BODY: 0, EMP: 0 },
    skillPoints: 40,
    ip: 0,
    skills: sk,
    customSkills: [],
    specialAbilities: {},  // role special-ability ranks, keyed by name
    settings: { forceNetrunner: false, showAllRoleSkills: false },
    cyberware: [],
    weapons: [],
    armor: [],
    outfit: [],
    fashion: [],
    wardrobe: [],
    outfits: [{ name: 'Outfit A', equipped: true, items: [] }],
    gear: [],
    notStored: [],
    hands: [null, null],
    vehicles: [],
    netrunner: { mode:'vanilla', deckId:null, deckPhoto:'', deckCustomOptions:[], programs:[], quickhacks:[],
      icon:{ name:'', style:'', photo:'' }, interface:'plugs', netAccessCode:'', heat:0, heatNotes:'', signatureProgramId:null },
    net: { computer:null, deliveries:[], bookmarks:[], pinned:[], groups:[], history:[] },  // Net access device, deliveries, browser state
    lifepath: { freeform: '', fields: {}, rolled: {}, collapsed: {}, events: [] },  // CP2020 background + life events
    contacts: [],          // network roster (friends, enemies, fixers…)
    jobs: [],              // gig / run pipeline
    wounds: new Array(40).fill(false),
    notes: '',
    customSections: [],    // user-defined standalone sections (fields / list / text)
    sectionExtras: {},     // user-defined extra fields grafted into built-in sections, by section id
    lifestyle: {
      cash: 0, salary: 0,
      credchips: [], credchipsOpen: false,
      housing: [],
      services: [],
      accounts: [],          // bank accounts
      payees: [],            // saved NPC accounts for transfers
      activeAccountId: 'cash', // which view the Finances panel shows
      month: 0,              // in-game month counter (drives prices & deposit maturity)
      bankAssets: {},        // per-bank uploaded logos: { [bankId]: { logo } }
      sharkLoans: []         // cash-side loan-shark debts (no account needed)
    }
  };
}

/* ─── PHOTO ─── */
function loadPhoto(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    CS.photo = ev.target.result;
    document.getElementById('photo-img').src = CS.photo;
    document.getElementById('photo-img').style.display = '';
    document.getElementById('photo-placeholder').style.display = 'none';
    var pc = document.getElementById('photo-clear'); if (pc) pc.style.display = '';
  };
  r.readAsDataURL(f);
}
function clearPhoto() {
  CS.photo = '';
  document.getElementById('photo-img').style.display = 'none';
  document.getElementById('photo-placeholder').style.display = '';
  var pc = document.getElementById('photo-clear'); if (pc) pc.style.display = 'none';
}

/* ─── STATS ─── */
function renderStats() {
  var g = document.getElementById('stats-grid');
  g.innerHTML = STATS.map(function(s) {
    var base     = CS.stats[s] || 0;
    var bonuses  = getCyberBonusesFor('stat', s);
    var cyberSum = bonuses.reduce(function(acc, b) { return acc + b.value; }, 0);
    var effective = base + cyberSum;

    var cyberTag = '';
    if (bonuses.length) {
      var tip = 'Base: ' + base + '&#10;' +
        bonuses.map(function(b) { return b.name + ': ' + (b.value >= 0 ? '+' : '') + b.value; }).join('&#10;') +
        '&#10;Total: ' + effective;
      var sign = cyberSum >= 0 ? '+' : '';
      cyberTag = '<span class="stat-cyber" title="' + tip + '">' + sign + cyberSum + '</span>' +
                 '<span class="stat-effective">' + effective + '</span>';
    }

    return '<div class="stat-box">' + _statSlabel(s) +
      '<input type="number" min="0" max="10" value="' + base + '" data-stat="' + s + '">' +
      cyberTag + '</div>';
  }).join('');
  g.querySelectorAll('input[data-stat]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      CS.stats[inp.dataset.stat] = parseInt(inp.value) || 0;
      updateDerived(); renderSkills(); renderNetIdentity();
    });
  });
  updateDerived();
  if (typeof _renderNativeSlot === 'function') _renderNativeSlot('sec-stats:primary');
  // compress all stats (native + custom) onto one row
  var extra = (CS.nativeExtras && CS.nativeExtras['sec-stats:primary']) ? CS.nativeExtras['sec-stats:primary'].length : 0;
  g.style.gridTemplateColumns = 'repeat(' + (STATS.length + extra) + ',minmax(0,1fr))';
}

function updateDerived() {
  if (!document.getElementById('derived-grid')) return;
  var B = effectiveStat('BODY'), M = effectiveStat('MA'), E = effectiveStat('EMP');
  var run = M * 3, leap = Math.round(run / 4), carry = B * 10, lift = carry * 2;
  var btm = BTM_TABLE[Math.min(B, 10)] || 0;
  var totalHC = CS.cyberware.reduce(function(s, c) {
    var optHC = (c.options || []).reduce(function(os, o) { return os + (parseFloat(o.hc) || 0); }, 0);
    return s + (parseFloat(c.hc) || 0) + optHC;
  }, 0);
  var humanity = E * 10 - totalHC;
  var items = [['RUN', run + 'm'], ['LEAP', leap + 'm'], ['CARRY', carry + 'kg'], ['LIFT', lift + 'kg'],
    ['BTM', btm], ['SAVE', B], ['HUMANITY', humanity]];
  document.getElementById('derived-grid').innerHTML = items.map(function(it) {
    return '<div class="derived-box"><span class="dlabel">' + it[0] + '</span><span class="dval">' + it[1] + '</span></div>';
  }).join('');
  document.getElementById('cyber-hc-total').textContent = totalHC;
  if (typeof _renderNativeSlot === 'function') _renderNativeSlot('sec-stats:derived');
}

/* ─── Get role skill names ─── */
function getRoleSkills() {
  var found = DB.roles.find(function(r) { return r.name === CS.role; });
  if (!found) return [];
  var names = [];
  found.skills.forEach(function(s) {
    if (typeof s === 'string') names.push(s);
    else if (Array.isArray(s)) s.forEach(function(ss) { names.push(ss); });
  });
  return names;
}

/* ─── SKILLS ─── */
function renderSkills() {
  var filter = document.getElementById('skill-filter').value.toLowerCase();
  var nz = document.getElementById('skill-nonzero').checked;
  var roleSkills = getRoleSkills();
  var container = document.getElementById('skills-list');

  // Group skills by stat
  var groups = {};
  STATS.forEach(function(s) { groups[s] = []; });
  groups['OTHER'] = [];

  DB.skills.forEach(function(s) {
    var st = s.stat && groups[s.stat] ? s.stat : 'OTHER';
    groups[st].push({ name: s.name, stat: s.stat, db: true });
  });
  CS.customSkills.forEach(function(s) {
    var st = s.stat && groups[s.stat] ? s.stat : 'OTHER';
    groups[st].push({ name: s.name, stat: s.stat, db: false });
  });

  var totalPts = 0;
  var html = '';
  var statOrder = STATS.concat(groups['OTHER'].length ? ['OTHER'] : []);

  statOrder.forEach(function(stat) {
    var skills = groups[stat];
    if (!skills || !skills.length) return;

    var filtered = skills.filter(function(sk) {
      var val = CS.skills[sk.name] || 0;
      if (nz && val === 0) return false;
      if (filter && sk.name.toLowerCase().indexOf(filter) < 0) return false;
      return true;
    });
    if (!filtered.length) return;

    html += '<div class="stat-group"><div class="stat-group-head">' + stat + '</div>';
    html += '<div class="stat-group-skills">';
    filtered.forEach(function(sk) {
      var val = CS.skills[sk.name] || 0;
      totalPts += val;
      var statVal = effectiveStat(sk.stat);
      var cyberBonus = getCyberTotalFor('skill', sk.name);
      var total = val + statVal + cyberBonus;
      var isRole = roleSkills.indexOf(sk.name) >= 0;
      var esc = sk.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

      var cyberTag = '';
      if (cyberBonus !== 0) {
        var bonuses = getCyberBonusesFor('skill', sk.name);
        var tip = bonuses.map(function(b) { return b.name + ': ' + (b.value >= 0 ? '+' : '') + b.value; }).join('&#10;');
        cyberTag = '<span class="sk-cyber" title="' + tip + '">' + (cyberBonus > 0 ? '+' : '') + cyberBonus + '</span>';
      }

      html += '<div class="skill-row' + (isRole ? ' role-skill' : '') + '">' +
        '<span class="sk-name" title="' + sk.name + '">' + sk.name + '</span>' +
        '<input class="sk-val" type="number" min="0" max="10" value="' + val + '" onchange="setSkill(\'' + esc + '\',this.value)">' +
        cyberTag +
        '<span class="sk-total">' + (total || '') + '</span>' +
        '</div>';
    });
    html += '</div></div>';
  });

  // ── Special Ability (role) group, rendered at the top ──
  var settings = CS.settings || {};
  var saDefs;
  if (settings.showAllRoleSkills) {
    var seen = {}; saDefs = [];
    (DB.roles||[]).forEach(function(r) {
      var sa = r.specialability; if (!sa || !sa.name || seen[sa.name]) return;
      seen[sa.name] = 1; saDefs.push({ name:sa.name, stat:sa.stat||'', role:r.name });
    });
    saDefs.sort(function(a,b){ return a.name.localeCompare(b.name); });
  } else {
    var fr = (DB.roles||[]).find(function(r){ return r.name === CS.role; });
    saDefs = (fr && fr.specialability && fr.specialability.name) ? [{ name:fr.specialability.name, stat:fr.specialability.stat||'', role:fr.name }] : [];
  }
  var saFiltered = saDefs.filter(function(d) {
    var v = CS.specialAbilities[d.name] || 0;
    if (nz && v === 0) return false;
    if (filter && d.name.toLowerCase().indexOf(filter) < 0) return false;
    return true;
  });
  var saHtml = '';
  if (saFiltered.length) {
    saHtml = '<div class="stat-group sa-group"><div class="stat-group-head">Special Ability' + (settings.showAllRoleSkills ? ' — all roles' : '') + '</div><div class="stat-group-skills">';
    saFiltered.forEach(function(d) {
      var v = CS.specialAbilities[d.name] || 0;
      var esc = d.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      saHtml += '<div class="skill-row role-skill">' +
        '<span class="sk-name" title="' + d.name + (d.stat ? ' (' + d.stat + ')' : '') + (settings.showAllRoleSkills ? ' — ' + d.role : '') + '">' + d.name + (d.stat ? ' <span class="sa-stat">' + d.stat + '</span>' : '') + '</span>' +
        '<input class="sk-val" type="number" min="0" max="10" value="' + v + '" onchange="setSpecialAbility(\'' + esc + '\',this.value)">' +
        '<span class="sk-total"></span>' +
      '</div>';
    });
    saHtml += '</div></div>';
  }

  container.innerHTML = saHtml + html;

  // Points info — two separate pools: starting points first, then IP overflow (flat 1:1).
  var startPool = parseInt(document.getElementById('skill-points').value) || 0;
  var ipEl = document.getElementById('ip-points');
  var ipPool = ipEl ? (parseInt(ipEl.value) || 0) : 0;
  CS.skillPoints = startPool;
  CS.ip = ipPool;
  var startUsed = Math.min(totalPts, startPool);
  var spentIP = Math.max(0, totalPts - startPool);
  var info = document.getElementById('points-info');
  var parts = [];
  // Starting points counter
  if (startPool > 0 && startUsed >= startPool) {
    parts.push('<span class="pts-ok">Allocated: ' + startPool + ' / ' + startPool + ' ✓</span>');
  } else {
    parts.push('<span class="pts-ok">Allocated: ' + startUsed + ' / ' + startPool + '</span>');
  }
  // IP counter (shown once any IP is budgeted or spent)
  if (ipPool > 0 || spentIP > 0) {
    var ipOver = spentIP - ipPool;
    if (ipOver > 0) parts.push('<span class="pts-over">IP: ' + spentIP + ' / ' + ipPool + ' (over: ' + ipOver + ')</span>');
    else parts.push('<span class="pts-ip">IP: ' + spentIP + ' / ' + ipPool + '</span>');
  }
  info.innerHTML = parts.join(' — ');
}

function setSkill(name, val) {
  CS.skills[name] = parseInt(val) || 0;
  renderSkills();
  if (name === 'Interface') renderNetIdentity();  // NET BASE depends on Interface
}
function setSpecialAbility(name, val) {
  CS.specialAbilities[name] = parseInt(val) || 0;
  renderSkills();
  if (name === 'Credibility') { try { renderPress(); } catch (e) {} }  // press card shows the live Credibility
}

function addCustomSkill() {
  var name = prompt('Skill name:'); if (!name) return;
  var stat = prompt('Stat (INT/REF/TECH/COOL/ATT/LUCK/MA/BODY/EMP):', 'REF');
  if (!stat) return;
  CS.customSkills.push({ name: name, stat: stat.toUpperCase() });
  CS.skills[name] = 0;
  renderSkills();
}

/* ─── Item search ─── */
function searchItems(type) {
  var outfitDB  = DB.gear.filter(function(g) { return (g.category || '') === 'ARMOR/CLOTHING'; });
  var _storageKw  = ['bag', 'backpack', 'briefcase', 'case', 'pack', 'pouch', 'satchel', 'holster', 'kit', 'vest', 'belt', 'duffel', 'sling', 'wallet', 'container', 'travel kit'];
  var _storageExc = ['drum kit', 'pillow', 'shower', 'booster pack', 'evidence bag', 'drum set'];
  var storageDB = DB.gear.filter(function(g) {
    var n = (g.name || '').toLowerCase();
    if (_storageExc.some(function(x) { return n.indexOf(x) >= 0; })) return false;
    return _storageKw.some(function(k) { return n.indexOf(k) >= 0; });
  }).concat(CUSTOM_STORAGE).concat(CUSTOM_STORAGE_FIXED);
  var fmtSlots = function(i) { return i.slots ? i.slots + ' slots — ' : (_getFashionSlots(i) + ' slots — '); };
  var configs = {
    cyber:  { db: DB.cyberware, field: 'cyber',  fmt: function(i) { return i.name + '<span class="dd-sub">' + i.type + (i.subtype ? ' / ' + i.subtype : '') + ' — HC:' + i.hc + ' — ' + i.cost + 'eb — ' + (i.notes || '') + '</span>'; } },
    weap:   { db: DB.weapons,   field: 'weap',   fmt: function(i) { return i.name + '<span class="dd-sub">' + (i.type || '') + ' ' + (i.damage || '') + ' ' + (i.ammo || '') + ' ' + (i.shots || '') + 'rds — ' + (i.cost || 0) + 'eb</span>'; } },
    gear:   { db: DB.gear.filter(function(g) { return g.category !== 'ARMOR/CLOTHING' && !(g.category === 'COMPUTER' && g.connection); }), field: 'gear',   fmt: function(i) { return i.name + '<span class="dd-sub">' + i.category + ' — ' + i.cost + 'eb — ' + (i.notes || '') + '</span>'; } },
    outfit: { db: outfitDB,     field: 'outfit', fmt: function(i) { return i.name + '<span class="dd-sub">' + fmtSlots(i) + (i.cost||0) + 'eb — ' + (i.notes || '') + '</span>'; } },
    fashion:{ db: storageDB,    field: 'fashion',fmt: function(i) { return i.name + '<span class="dd-sub">' + fmtSlots(i) + (i.cost||0) + 'eb — ' + (i.notes || '') + '</span>'; } },
    armor:  { db: ARMOR_DB,     field: 'armor',  fmt: function(i) { return i.name + '<span class="dd-sub">' + i.cost + 'eb — ' + (i.notes || '') + '</span>'; } },
    clothing: { db: outfitDB.concat(ARMOR_DB), field: 'clothing', fmt: function(i) {
      var spM = (i.notes||'').match(/SP[:\s]*(\d+)/i);
      var sp  = spM ? ' SP:' + spM[1] + ' — ' : '';
      return i.name + '<span class="dd-sub">' + sp + (i.cost||0) + 'eb — ' + (i.notes||'') + '</span>';
    } },
    veh:    { db: DB.vehicles,  field: 'veh',    fmt: function(i) { return i.name + '<span class="dd-sub">' + (i.type || '') + ' — spd:' + (i.topspeed || '?') + ' — SDP:' + (i.sdp || '?') + ' — SP:' + (i.sp || '?') + '</span>'; } },
    service:{ db: DB.gear.filter(function(g){ return g.category === 'LIFESTYLE' && /\(1\s*mo\)/i.test(g.name); }), field: 'service', fmt: function(i) { return i.name + '<span class="dd-sub">' + (i.cost||0) + ' eb — ' + (i.notes||'') + '</span>'; } },
    deck:   { db: DB.decks || [], field: 'net-deck', fmt: function(i) { return i.name + '<span class="dd-sub">' + (i._mu||'?') + ' MU — spd:' + (i.speed||'?') + ' — ' + (i.bookPrice||i.cost||0) + 'eb — ' + ((i.type&&i.type.name)||'') + '</span>'; } },
    program:{ db: DB.programs || [], field: 'net-prog', fmt: function(i) { return i.name + '<span class="dd-sub">' + (i.class||'') + ' — STR:' + (i.str||0) + ' — MU:' + (i.mu||0) + ' — ' + (i.cost||0) + 'eb</span>'; } }
  };
  var cfg = configs[type];
  var q = document.getElementById(cfg.field + '-search').value.toLowerCase();
  var dd = document.getElementById(cfg.field + '-dropdown');
  if (!q) { dd.classList.remove('open'); return; }
  var matches = cfg.db.filter(function(i) { return i.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 20);
  dd.innerHTML = matches.map(function(m, idx) {
    return '<div class="dd-item" data-idx="' + idx + '">' + cfg.fmt(m) + '</div>';
  }).join('');
  dd.classList.add('open');
  openDropdown = dd;
  dd.querySelectorAll('.dd-item').forEach(function(el, idx) {
    el.onclick = function() {
      if      (type === 'cyber')   addCyber(matches[idx]);
      else if (type === 'weap')    addWeapon(matches[idx]);
      else if (type === 'gear')    addGear(matches[idx]);
      else if (type === 'outfit')   addOutfit(matches[idx]);
      else if (type === 'fashion')  addFashion(matches[idx]);
      else if (type === 'armor')    addArmor(matches[idx]);
      else if (type === 'clothing') ARMOR_DB.indexOf(matches[idx]) >= 0 ? addArmor(matches[idx]) : addOutfit(matches[idx]);
      else if (type === 'veh')     addVehicle(matches[idx]);
      else if (type === 'service') lsAddService(matches[idx]);
      else if (type === 'deck')    netSetDeck(matches[idx].name);
      else if (type === 'program') netAddProgramFromDB(matches[idx]);
      dd.classList.remove('open');
      document.getElementById(cfg.field + '-search').value = '';
    };
  });
}

/* ─── CYBERWARE ─── */
function _makeCyberItem(item) {
  var c = { name: item.name, type: item.type, subtype: item.subtype || '', hc: item.hc,
    cost: item.cost, notes: item.notes || '', surgery: item.surgery || '', description: '', options: [] };
  c.zone = getCyberZone(c);
  var fx = CYBER_EFFECTS && CYBER_EFFECTS[item.name];
  c.bonuses = fx ? fx.map(function(b) {
    return { type: b.type, target: b.target, value: b.value, max: b.max || null };
  }) : [];
  return c;
}

function _cyberRefresh() { renderCyber(); renderStats(); renderSkills(); updateDerived(); }

function addCyber(item) {
  var sub = (item.subtype || '').toUpperCase();
  if (sub !== 'OPTION') {
    var ci = _makeCyberItem(item);
    CS.cyberware.push(ci);
    pendPurchase(ci, 'cyberware', item.cost);
    _cyberRefresh();
    return;
  }
  // OPTION: route to compatible parent (pend the option object once attached).
  var parents = findCompatibleParents(item);
  if (parents.length === 0) {
    var needed = ATTACH_TO_LIMB.indexOf(item.type.toUpperCase()) >= 0 ? 'CYBERLIMB' : item.type;
    alert('Install a ' + needed + ' first.');
    return;
  }
  var pidx = null;
  if (parents.length === 1) { pidx = parents[0].idx; addOptionTo(pidx, item); }
  else {
    var msg = 'Attach to which item?\n' + parents.map(function(p, i) { return i + ' — ' + p.name; }).join('\n');
    var n = parseInt(prompt(msg));
    if (!isNaN(n) && parents[n]) { pidx = parents[n].idx; addOptionTo(pidx, item); }
  }
  if (pidx != null) {
    var par = CS.cyberware[pidx]; var opt = par && par.options && par.options[par.options.length - 1];
    if (opt) pendPurchase(opt, 'cyberware', item.cost);
  }
}

function findCompatibleParents(item) {
  var itemType = item.type.toUpperCase();
  var parentType = ATTACH_TO_LIMB.indexOf(itemType) >= 0 ? 'CYBERLIMB' : itemType;
  var result = [];
  CS.cyberware.forEach(function(c, i) {
    if (c.type.toUpperCase() === parentType && (c.subtype || '').toUpperCase() !== 'OPTION') {
      result.push({ idx: i, name: c.name });
    }
  });
  return result;
}

function addOptionTo(parentIdx, item) {
  var parent = CS.cyberware[parentIdx];
  if (!parent) return;
  if (!parent.options) parent.options = [];
  var fx = CYBER_EFFECTS && CYBER_EFFECTS[item.name];
  var opt = { name: item.name, type: item.type, hc: item.hc, cost: item.cost,
    notes: item.notes || '', bonuses: fx ? fx.map(function(b) {
      return { type: b.type, target: b.target, value: b.value, max: b.max || null };
    }) : [] };
  parent.options.push(opt);
  _cyberRefresh();
}

function removeOption(parentIdx, optIdx) {
  var parent = CS.cyberware[parentIdx];
  if (!parent || !parent.options) return;
  parent.options.splice(optIdx, 1);
  _cyberRefresh();
}

function searchItemOptions(parentIdx, q) {
  var dd = document.getElementById('opt-dd-' + parentIdx);
  if (!dd) return;
  if (!q) { dd.classList.remove('open'); return; }
  var parent = CS.cyberware[parentIdx];
  if (!parent) return;
  var parentType = parent.type.toUpperCase();
  var pool = DB.cyberware.filter(function(item) {
    if ((item.subtype || '').toUpperCase() !== 'OPTION') return false;
    var itemType = item.type.toUpperCase();
    if (itemType === parentType) return true;
    if (parentType === 'CYBERLIMB' && ATTACH_TO_LIMB.indexOf(itemType) >= 0) return true;
    return false;
  });
  var matches = pool.filter(function(i) { return i.name.toLowerCase().indexOf(q.toLowerCase()) >= 0; }).slice(0, 15);
  if (!matches.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(function(m, idx) {
    return '<div class="dd-item" data-idx="' + idx + '">' + m.name +
      '<span class="dd-sub">' + m.type + ' — HC:' + m.hc + ' — ' + (m.notes || '') + '</span></div>';
  }).join('');
  dd.classList.add('open');
  openDropdown = dd;
  dd.querySelectorAll('.dd-item').forEach(function(el, idx) {
    el.onclick = function() {
      addOptionTo(parentIdx, matches[idx]);
      dd.classList.remove('open');
      var inp = document.getElementById('opt-inp-' + parentIdx);
      if (inp) inp.value = '';
    };
  });
}

function hasChipwareSocket() {
  return CS.cyberware.some(function(c) { return c.name === 'Chipware Socket'; });
}

function addCustomCyber() {
  var name = prompt('Name:'); if (!name) return;
  var hc = prompt('HC:', '1'); var cost = prompt('Cost:', '0');
  CS.cyberware.push({ name: name, type: 'CUSTOM', subtype: '', hc: hc || '0', cost: cost || 0, notes: '', surgery: '', description: '' });
  renderCyber(); updateDerived();
}
function removeCyber(idx) { CS.cyberware.splice(idx, 1); renderCyber(); renderStats(); renderSkills(); updateDerived(); }
function setCyberDesc(idx, val) { CS.cyberware[idx].description = val; }

// Editable tag helper: editTag('weapons', 0, 'damage', 'DMG', '', 50)
function editTag(arr, idx, field, label, suffix, width) {
  var val = (CS[arr][idx][field] != null ? CS[arr][idx][field] : '').toString().replace(/"/g, '&quot;');
  var w = width || (val.length * 7 + 20);
  if (w < 30) w = 30;
  return '<span class="inv-tag-label">' + label + '</span>' +
    '<input class="inv-tag-edit" style="width:' + w + 'px" value="' + val + '" ' +
    'onchange="CS.' + arr + '[' + idx + '].' + field + '=this.value">' +
    (suffix || '');
}
function editTagNum(arr, idx, field, label, suffix, width) {
  var val = CS[arr][idx][field] || 0;
  var w = width || 40;
  return '<span class="inv-tag-label">' + label + '</span>' +
    '<input class="inv-tag-edit" type="number" style="width:' + w + 'px" value="' + val + '" ' +
    'onchange="CS.' + arr + '[' + idx + '].' + field + '=parseFloat(this.value)||0">' +
    (suffix || '');
}

function getCyberZone(c) {
  // Respect manually dragged zone
  if (c.zone && c.zone !== 'full') return c.zone;
  var sub = (c.subtype || '').toUpperCase().trim();
  if (sub && CYBER_SUB_ZONE[sub]) return CYBER_SUB_ZONE[sub];
  return CYBER_ZONE_MAP[(c.type || '').toUpperCase()] || 'centre';
}

function renderBodyMap() {
  var zones = {};
  ALL_CYBER_ZONES.forEach(function(z) { zones[z] = []; });

  var fullConversions = [];
  var socketInst = hasChipwareSocket();

  CS.cyberware.forEach(function(c, i) {
    var entry = { name: c.name, type: (c.type||'').toUpperCase(), subtype: c.subtype||'', hc: c.hc, idx: i };
    if (entry.type === 'FULL CONVERSION') { fullConversions.push(entry); return; }
    var zone = getCyberZone(c);
    if (zones[zone] !== undefined) zones[zone].push(entry);
    else zones['centre'].push(entry);
    // Also push chips (options of Chipware Socket) to chips zone
    if (c.name === 'Chipware Socket') {
      (c.options || []).forEach(function(o) {
        zones['chips'].push({ name: o.name, type: 'CHIPWARE', subtype: 'OPTION', hc: o.hc, idx: i, isOpt: true });
      });
    }
  });

  // FULL CONVERSION appears only in selected zones (non-draggable)
  FULL_CONV_ZONES.forEach(function(z) {
    fullConversions.forEach(function(fc) { zones[z].push(fc); });
  });

  // Show/hide chips zone
  var chipsZone = document.querySelector('.zone-chips');
  if (chipsZone) chipsZone.style.display = socketInst ? 'block' : 'none';

  ALL_CYBER_ZONES.forEach(function(z) {
    var el = document.getElementById('bz-' + z);
    if (!el) return;
    el.innerHTML = zones[z].map(function(item) {
      var isDanger = DANGER_TYPES.indexOf(item.type) >= 0;
      var isLowHC  = !isDanger && parseFloat(item.hc) < 2;
      var cls = 'zone-chip' + (isDanger ? ' zc-danger' : isLowHC ? ' zc-safe' : '');
      var isFC = item.type === 'FULL CONVERSION';
      return '<div class="' + cls + '"' +
        (!isFC ? ' draggable="true" ondragstart="cyberDragStart(event,' + item.idx + ')"' : '') +
        ' data-idx="' + item.idx + '">' +
        item.name +
        '<div class="zone-tooltip">' +
        '<div>' + item.name + '</div>' +
        '<div class="zt-line">' + item.type + (item.subtype ? ' / ' + item.subtype : '') + ' — HC:' + item.hc + '</div>' +
        '</div></div>';
    }).join('');
  });
}

/* ─── Drag & Drop ─── */
function cyberDragStart(e, idx) {
  e.dataTransfer.setData('text/plain', String(idx));
  e.dataTransfer.effectAllowed = 'move';
}
function cyberDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function cyberDragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function cyberDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function cyberDrop(e, zone) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  var idx = parseInt(e.dataTransfer.getData('text/plain'));
  if (isNaN(idx) || idx < 0 || idx >= CS.cyberware.length) return;
  var c = CS.cyberware[idx];
  if ((c.type || '').toUpperCase() === 'FULL CONVERSION') return;
  c.zone = zone;
  renderBodyMap();
}

function _renderBonuses(bonuses, itemIdx, isSub, subParentIdx) {
  if (!bonuses || !bonuses.length) return '';
  return '<div class="cyber-bonuses">' +
    bonuses.map(function(b, bi) {
      var rangeHint = b.max ? ' (max ' + b.max + ')' : '';
      var onchange = isSub
        ? 'setOptionBonus(' + subParentIdx + ',' + itemIdx + ',' + bi + ',this.value)'
        : 'setCyberBonus(' + itemIdx + ',' + bi + ',this.value)';
      return '<span class="cyber-bonus-line">→ ' + b.target + ': ' +
        '<input class="cyber-bonus-input" type="number" value="' + b.value + '"' +
        (b.max ? ' max="' + b.max + '"' : '') + ' onchange="' + onchange + '">' +
        rangeHint + '</span>';
    }).join('') + '</div>';
}

function renderCyber() {
  document.getElementById('cyber-list').innerHTML = CS.cyberware.map(function(c, i) {
    var opts = c.options || [];
    // Options section
    var optHtml = '';
    // Only show options box for types that have options in DB (except CHIPWARE which has its own zone)
    var canHaveOptions = ['BODY PLATING','CYBERAUDIO','CYBERHAND','CYBERLIMB','CYBEROPTIC',
      'CYBERVOCAL','EXOTIC BODYSCULPT','FULL CONVERSION','NEURALWARE','CHIPWARE'].indexOf(c.type.toUpperCase()) >= 0;
    if (canHaveOptions) {
      var optItems = opts.map(function(o, oi) {
        return '<div class="opt-item">' +
          '<span class="opt-name">' + o.name + '</span>' +
          '<span class="opt-hc">HC:' + o.hc + '</span>' +
          '<span class="inv-remove opt-remove" onclick="removeOption(' + i + ',' + oi + ')">✕</span>' +
          (o.notes ? '<div class="inv-details">' + o.notes + '</div>' : '') +
          _renderBonuses(o.bonuses, oi, true, i) +
          '</div>';
      }).join('');
      optHtml = '<div class="cyber-options-box">' +
        '<div class="cyber-options-head">OPTIONS' + (opts.length ? ' (' + opts.length + ')' : '') + '</div>' +
        optItems +
        '<div class="item-search opt-search">' +
          '<input id="opt-inp-' + i + '" class="opt-inp" placeholder="add option..." ' +
          'oninput="searchItemOptions(' + i + ',this.value)">' +
          '<div class="dropdown" id="opt-dd-' + i + '"></div>' +
        '</div>' +
        '</div>';
    }
    return '<div class="inv-item">' +
      '<div class="inv-top"><span class="inv-name">' + c.name + '</span>' +
      '<div class="inv-tags">' +
      editTag('cyberware', i, 'type', 'Type:', '') +
      editTag('cyberware', i, 'subtype', 'Sub:', '') +
      '<span class="inv-tag-label">HC:</span><input class="inv-tag-edit" style="width:36px" value="' + (CS.cyberware[i].hc != null ? CS.cyberware[i].hc : '') + '" onchange="CS.cyberware[' + i + '].hc=this.value;renderCyberware()">' +
      editTag('cyberware', i, 'cost', '', 'eb', 50) +
      editTag('cyberware', i, 'surgery', 'Surg:', '', 30) +
      '</div>' +
      '<span class="inv-remove" onclick="removeCyber(' + i + ')">✕</span></div>' +
      (c.notes ? '<div class="inv-details">' + c.notes + '</div>' : '') +
      _renderBonuses(c.bonuses, i, false, null) +
      optHtml +
      '<textarea class="inv-desc-input" placeholder="Description..." oninput="setCyberDesc(' + i + ',this.value)">' + (c.description || '') + '</textarea>' +
      '</div>';
  }).join('');
  document.getElementById('cyber-hc-total').textContent = CS.cyberware.reduce(function(s, c) {
    var optHC = (c.options || []).reduce(function(os, o) { return os + (parseFloat(o.hc) || 0); }, 0);
    return s + (parseFloat(c.hc) || 0) + optHC;
  }, 0);
  renderBodyMap();
}

function setCyberBonus(idx, bonusIdx, val) {
  if (!CS.cyberware[idx] || !CS.cyberware[idx].bonuses) return;
  var b = CS.cyberware[idx].bonuses[bonusIdx];
  var v = parseInt(val) || 0;
  if (b.max !== null && v > b.max) v = b.max;
  b.value = v;
  renderStats(); renderSkills(); updateDerived();
}

function setOptionBonus(parentIdx, optIdx, bonusIdx, val) {
  var parent = CS.cyberware[parentIdx];
  if (!parent || !parent.options || !parent.options[optIdx]) return;
  var b = parent.options[optIdx].bonuses[bonusIdx];
  if (!b) return;
  var v = parseInt(val) || 0;
  if (b.max !== null && v > b.max) v = b.max;
  b.value = v;
  renderStats(); renderSkills(); updateDerived();
}

/* ─── Weapons ─── */
/* ─── WEAPONS ─── */
/* When a weapon is equipped, drop a matching item into the unsorted gear pool so it can be
   sorted into hands / clothing / vehicle / apartment storage like any other piece of gear.
   The gear copy is linked to its weapon via `weaponUid`: deleting either side removes the other. */
function _weaponToNotStored(w) {
  CS.notStored = CS.notStored || [];
  CS.notStored.push({ name: w.name || 'Weapon', category: 'WEAPON', isWeapon: true, weaponUid: w.uid,
    cost: w.cost || 0, wt: w.wt || 0,
    notes: [w.type, w.damage ? 'DMG ' + w.damage : '', w.ammo ? w.ammo : '', w.conc ? 'Conc ' + w.conc : ''].filter(Boolean).join(' · ') });
  if (typeof renderNotStored === 'function') renderNotStored();
}
/* Every place a gear item can live, so a linked copy can be found/purged wherever it was sorted. */
function _allGearArrays() {
  var arrs = [];
  if (CS.gear) arrs.push(CS.gear);
  if (CS.notStored) arrs.push(CS.notStored);
  (CS.fashion || []).forEach(function(f) { if (f.contents) arrs.push(f.contents); });
  (CS.outfits || []).forEach(function(o) { (o.items || []).forEach(function(it) { if (it.contents) arrs.push(it.contents); }); });
  ((CS.lifestyle && CS.lifestyle.housing) || []).forEach(function(h) { if (h.cargoContents) arrs.push(h.cargoContents); });
  (CS.vehicles || []).forEach(function(v) { if (v.cargoContents) arrs.push(v.cargoContents); });
  return arrs;
}
/* Remove the gear copy(ies) linked to a weapon uid, wherever they've been sorted (incl. hands). */
function _removeLinkedGear(uid) {
  if (!uid) return;
  _allGearArrays().forEach(function(arr) {
    for (var i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].weaponUid === uid) arr.splice(i, 1);
  });
  CS.hands = CS.hands || [null, null];
  CS.hands.forEach(function(h, i) { if (h && h.weaponUid === uid) CS.hands[i] = null; });
}
function addWeapon(item) {
  var w = { uid: _bankUid(), name: item.name, type: item.type || '', category: item.category || '', damage: item.damage || '', ammo: item.ammo || '', shots: item.shots || 0, currentAmmo: item.shots || 0, rof: item.rof || 1, rel: item.rel || '', range: item.range || 0, cost: item.cost || 0, wa: item.wa || 0, conc: item.conc || '', avail: item.avail || '', description: '' };
  CS.weapons.push(w);
  pendPurchase(w, 'weapon');
  _weaponToNotStored(w);
  renderWeapons();
}
function addCustomWeapon() {
  var name = prompt('Name:'); if (!name) return;
  var damage = prompt('Damage:', '1d6'); var shots = parseInt(prompt('Shots:', '10')) || 0;
  var w = { uid: _bankUid(), name: name, type: '?', category: '', damage: damage, ammo: 'custom', shots: shots, currentAmmo: shots, rof: 1, rel: 'ST', range: 0, cost: 0, wa: 0, conc: '', avail: '', description: '' };
  CS.weapons.push(w);
  _weaponToNotStored(w);
  renderWeapons();
}
function removeWeapon(idx) {
  var w = CS.weapons[idx];
  CS.weapons.splice(idx, 1);
  if (w && w.uid) { _removeLinkedGear(w.uid); if (typeof renderNotStored === 'function') renderNotStored(); if (typeof renderGear === 'function') renderGear(); if (typeof renderFashion === 'function') renderFashion(); }
  renderWeapons();
}
function ammoChange(idx, delta) {
  var w = CS.weapons[idx];
  w.currentAmmo = Math.max(0, Math.min(w.shots || 999, w.currentAmmo + delta));
  renderWeapons();
}
function ammoReload(idx) { CS.weapons[idx].currentAmmo = CS.weapons[idx].shots; renderWeapons(); }
function setWeapDesc(idx, val) { CS.weapons[idx].description = val; }

function renderWeapons() {
  document.getElementById('weap-list').innerHTML = CS.weapons.map(function(w, i) {
    return '<div class="inv-item" data-wi="' + i + '">' +
      '<div class="inv-top"><span class="inv-name">' + w.name + '</span>' +
      '<div class="inv-tags">' +
      editTag('weapons', i, 'type', 'Type:', '', 30) +
      editTag('weapons', i, 'damage', 'DMG:', '') +
      editTagNum('weapons', i, 'wa', 'WA:', '') +
      editTagNum('weapons', i, 'rof', 'ROF:', '') +
      editTag('weapons', i, 'rel', 'REL:', '', 30) +
      editTagNum('weapons', i, 'range', '', 'm', 45) +
      editTag('weapons', i, 'ammo', '', '', 60) +
      editTagNum('weapons', i, 'cost', '', 'eb', 50) +
      editTag('weapons', i, 'conc', 'Conc:', '', 24) +
      '</div>' +
      '<div class="ammo-ctrl">' +
      '<div class="abtn" onclick="ammoChange(' + i + ',-1)">−</div>' +
      '<span class="ammo-val">' + w.currentAmmo + '</span><span class="ammo-max">/' + w.shots + '</span>' +
      '<div class="abtn" onclick="ammoChange(' + i + ',1)">+</div>' +
      '<div class="abtn" onclick="ammoReload(' + i + ')" title="Reload" style="margin-left:3px;">↻</div>' +
      '</div>' +
      '<span class="inv-remove" onclick="removeWeapon(' + i + ')">✕</span></div>' +
      '<textarea class="inv-desc-input" placeholder="Description..." oninput="setWeapDesc(' + i + ',this.value)">' + (w.description || '') + '</textarea>' +
      '</div>';
  }).join('');
  var wl = document.getElementById('weap-list');
  if (wl && window.CtxMenu) wl.querySelectorAll('.inv-item[data-wi]').forEach(function (n) { CtxMenu.attach(n, function () { return _weaponCtxMenu(+n.getAttribute('data-wi')); }); });
}

/* ─── Armor ─── */
/* ─── ARMOR ─── */
/* Legacy fashion-armor adder (pushes into CS.fashion with SP/locs). Superseded by the
   wardrobe/outfit system below; renamed from addArmor to avoid shadowing the wardrobe
   addArmor (see js/main.js:~1580). Kept as a distinct, callable name. */
function addFashionArmor(item) {
  var spMatch = (item.notes || '').match(/SP[:\s]*(\d+)/i);
  var sp = spMatch ? parseInt(spMatch[1]) : 0;
  CS.fashion.push({ name: item.name, category: 'ARMOR', cost: item.cost || 0, wt: 0, notes: item.notes || '',
    slots: 0, isArmor: true, isOutfit: false, contents: [],
    sp: sp, spCurrent: sp,
    locs: { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false }, description: '' });
  renderClothing(); renderFashion(); updateArmorSP();
}
function addCustomArmor() {
  var name = prompt('Name:'); if (!name) return;
  var sp = parseInt(prompt('SP:', '14')) || 0;
  CS.fashion.push({ name: name, category: 'ARMOR', cost: 0, wt: 0, notes: '',
    slots: 0, isArmor: true, isOutfit: false, contents: [],
    sp: sp, spCurrent: sp,
    locs: { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false }, description: '' });
  renderClothing(); renderFashion(); updateArmorSP();
}

function getArmorSP(loc) {
  var total = 0;
  var equippedOutfit = (CS.outfits || []).filter(function(o) { return o.equipped; })[0];
  ((equippedOutfit && equippedOutfit.items) || []).forEach(function(f) {
    if (f.locs && f.locs[loc]) total += (f.spCurrent || 0);
  });
  return total;
}

function updateArmorSP() {
  LOCS.forEach(function(loc) {
    var el = document.getElementById('sp-' + loc);
    if (el) el.textContent = getArmorSP(loc);
  });
}

function renderArmor() { renderClothing(); } // legacy shim

// (old renderWardrobe/wardrobeDragStart replaced below in wardrobe section)

function renderClothing() {
  var el = document.getElementById('clothing-list');
  if (!el) return;
  var items = (CS.fashion || []).map(function(f, fi) {
    if (!f.isArmor && !f.isOutfit) return null;
    return { f: f, fi: fi };
  }).filter(Boolean);

  if (!items.length) {
    el.innerHTML = '<div class="fashion-empty">No clothing or armor.</div>';
    updateArmorSP(); renderFashionBodyMap(); return;
  }

  el.innerHTML = items.map(function(d) {
    var f = d.f, fi = d.fi;
    var locChecks = LOCS.map(function(loc) {
      return '<label class="clothing-loc-label"><input type="checkbox"' + (f.locs && f.locs[loc] ? ' checked' : '') +
        ' onchange="CS.fashion[' + fi + '].locs[\'' + loc + '\']=this.checked;updateArmorSP();renderFashionBodyMap()"> ' + LOC_NAMES[loc] + '</label>';
    }).join('');
    var spHtml = '<span class="inv-tag-label">SP:</span>' +
      '<input class="inv-tag-edit" type="number" style="width:40px" value="' + (f.sp || 0) + '" onchange="CS.fashion[' + fi + '].sp=CS.fashion[' + fi + '].spCurrent=parseInt(this.value)||0;updateArmorSP()"> ';
    return '<div class="inv-item">' +
      '<div class="inv-top"><span class="inv-name">' + f.name + '</span>' +
      '<div class="inv-tags">' + spHtml +
        '<span class="inv-tag-label">Cost:</span><input class="inv-tag-edit" type="number" style="width:50px" value="' + (f.cost || 0) + '" onchange="CS.fashion[' + fi + '].cost=parseFloat(this.value)||0"> eb' +
      '</div>' +
      '<span class="inv-remove" onclick="removeClothing(' + fi + ')">✕</span></div>' +
      (f.notes ? '<div class="inv-details">' + f.notes + '</div>' : '') +
      '<div class="clothing-locs">' + locChecks + '</div>' +
      '<textarea class="inv-desc-input" placeholder="Description..." oninput="CS.fashion[' + fi + '].description=this.value">' + (f.description || '') + '</textarea>' +
    '</div>';
  }).join('');
  updateArmorSP(); renderFashionBodyMap();
}

function removeClothing(fi) { unequipToWardrobe(fi); }

function renderFashionBodyMap() {
  var zones = { head: [], torso: [], rarm: [], larm: [], rleg: [], lleg: [] };
  // Overlay follows the ACTIVE tab (the outfit being viewed/edited), not the equipped one,
  // so each tab shows its own coverage. (ARMOR SP in the damage calc still uses the equipped outfit.)
  var outfits = CS.outfits || [];
  var activeOutfit = outfits[Math.min(_activeOutfitIdx, outfits.length - 1)];
  ((activeOutfit && activeOutfit.items) || []).forEach(function(f) {
    if (!f.locs) return;
    LOCS.forEach(function(loc) {
      if (f.locs[loc]) zones[loc].push(f.name);
    });
  });
  LOCS.forEach(function(loc) {
    var el = document.getElementById('fbz-items-' + loc);
    if (!el) return;
    el.innerHTML = zones[loc].map(function(name) {
      return '<div class="fzone-chip">' + name + '</div>';
    }).join('');
  });
}

/* ─── Fashion & Inventory ─── */

var CUSTOM_STORAGE = [
  /* ── Generics ── */
  { name: 'Duffel Bag',                        category: 'STORAGE', cost: 20,  wt: 0.5, notes: 'Large soft carry bag.',                                  slots: 14 },
  { name: 'Attaché Case',                      category: 'STORAGE', cost: 50,  wt: 1.0, notes: 'Hard-shell professional case.',                           slots: 8  },
  { name: 'Shoulder Bag',                      category: 'STORAGE', cost: 15,  wt: 0.3, notes: 'Casual soft carry bag.',                                  slots: 6  },
  { name: 'Messenger Bag',                     category: 'STORAGE', cost: 25,  wt: 0.4, notes: 'Courier satchel.',                                        slots: 6  },
  { name: 'Backpack',                          category: 'STORAGE', cost: 30,  wt: 0.8, notes: 'Standard civilian backpack.',                             slots: 12 },
  { name: 'Tactical Vest',                     category: 'STORAGE', cost: 60,  wt: 1.5, notes: 'Multi-pocket tactical carrier.',                          slots: 8  },
  { name: 'Fanny Pack',                        category: 'STORAGE', cost: 10,  wt: 0.2, notes: 'Small waist pouch.',                                      slots: 3  },
  { name: 'Cargo Pants',                       category: 'STORAGE', cost: 20,  wt: 0.5, notes: 'Street-style pants with deep pockets.',                   slots: 4  },
  { name: 'Utility Belt',                      category: 'STORAGE', cost: 35,  wt: 0.6, notes: 'Belt with multiple tool loops.',                          slots: 5  },
  /* ── Branded — Bags & Backpacks ── */
  { name: 'Militech MOLLE Assault Pack',       category: 'STORAGE', cost: 180, wt: 2.0, notes: 'Military tactical pack, MOLLE webbing, rain cover.',      slots: 16 },
  { name: 'Militech Field Duffel',             category: 'STORAGE', cost: 60,  wt: 1.0, notes: 'Mil-spec canvas duffel, reinforced seams, olive drab.',   slots: 14 },
  { name: 'SovOil Surplus Duffel',             category: 'STORAGE', cost: 25,  wt: 0.7, notes: 'Ex-military surplus duffel. Stencilled serial number.',   slots: 12 },
  { name: 'Chrome & Steel Courier Pack',       category: 'STORAGE', cost: 70,  wt: 0.8, notes: 'Biker messenger bag, kevlar-reinforced straps.',          slots: 9  },
  { name: 'EBM Corporate Messenger Bag',       category: 'STORAGE', cost: 85,  wt: 0.5, notes: 'Padded deck compartment, corp ID window, RFID lining.',   slots: 7  },
  { name: 'Night City Marathon Gym Bag',       category: 'STORAGE', cost: 30,  wt: 0.5, notes: 'Ventilated gym bag. "Night CityStrikers" logo.',         slots: 8  },
  { name: 'Zetatech Modular Tote',             category: 'STORAGE', cost: 45,  wt: 0.4, notes: 'Expandable tote with snap-in organiser panels.',          slots: 6  },
  /* ── Branded — Totes & Shopping ── */
  { name: 'Night City Street Tote',            category: 'STORAGE', cost: 5,   wt: 0.1, notes: 'Cheap canvas tote. "Night City or Die" print.',           slots: 4  },
  { name: 'Arasaka Shopping Bag',              category: 'STORAGE', cost: 15,  wt: 0.2, notes: 'Glossy black paper bag. Arasaka Galleria branding.',      slots: 4  },
  { name: 'Trauma Team Insulated Tote',        category: 'STORAGE', cost: 40,  wt: 0.3, notes: 'Thermal-lined tote, originally for organ transport.',     slots: 5  },
  /* ── Branded — Briefcases & Cases ── */
  { name: 'Arasaka Executive Briefcase',       category: 'STORAGE', cost: 250, wt: 1.2, notes: 'Carbon-fibre shell, biometric lock, SP4.',                slots: 8  },
  { name: 'Arasaka Security Transport Case',   category: 'STORAGE', cost: 400, wt: 4.0, notes: 'Armoured attaché, SP8, encrypted digital lock, tracker.', slots: 6  },
  { name: 'Petrochem Hazmat Transport Case',   category: 'STORAGE', cost: 200, wt: 2.5, notes: 'Rigid foam-lined case, sealed, rated for chemicals.',     slots: 6  },
  { name: 'Biotechnica Cold-Chain Case',       category: 'STORAGE', cost: 300, wt: 3.0, notes: 'Insulated case, temperature-controlled, 4h battery.',     slots: 5  },
  { name: 'GenTech Hard Transport Case',       category: 'STORAGE', cost: 90,  wt: 2.2, notes: 'IP67 hard case with pick-foam interior, lockable.',       slots: 7  },
  /* ── Branded — Suitcases & Travel ── */
  { name: 'GenTech Rolling Suitcase',          category: 'STORAGE', cost: 140, wt: 3.5, notes: 'Full-size rolling suitcase, combo lock, TSA-rated.',      slots: 18 },
  { name: 'Orbital Air Carry-On',              category: 'STORAGE', cost: 120, wt: 0.9, notes: 'Hard-shell carry-on, Orbital Air livery, spin wheels.',   slots: 10 },
  { name: 'TransWorld Weekend Bag',            category: 'STORAGE', cost: 55,  wt: 0.6, notes: 'Soft-sided overnight bag, TransWorld Airlines logo.',     slots: 10 },
  { name: 'TransWorld Rolling Duffel',         category: 'STORAGE', cost: 80,  wt: 1.8, notes: 'Wheeled duffel, retractable handle, lockable zip.',       slots: 16 },
];

/* Non-portable containers: stashes that can't be carried (no Equip badge). They sit at
   the top level of Storage or go inside a vehicle / apartment — and whatever they hold,
   they occupy their FULL slot capacity in whatever non-portable space contains them. */
var CUSTOM_STORAGE_FIXED = [
  { name: 'Cardboard Box',          category: 'STORAGE', cost: 1,    wt: 0.3, notes: 'Disposable box. Falls apart in the rain.',                   slots: 8,  nonPortable: true },
  { name: 'Plastic Storage Tote',   category: 'STORAGE', cost: 12,   wt: 1.5, notes: 'Snap-lid stacking tote.',                                   slots: 14, nonPortable: true },
  { name: 'Storage Bin',            category: 'STORAGE', cost: 20,   wt: 2.0, notes: 'Heavy-duty plastic bin.',                                   slots: 20, nonPortable: true },
  { name: 'Wooden Crate',           category: 'STORAGE', cost: 25,   wt: 6.0, notes: 'Nailed shipping crate.',                                    slots: 24, nonPortable: true },
  { name: 'Footlocker',             category: 'STORAGE', cost: 45,   wt: 8.0, notes: 'Military footlocker with hasp.',                            slots: 20, nonPortable: true },
  { name: 'Steamer Trunk',          category: 'STORAGE', cost: 90,   wt: 14,  notes: 'Old travel trunk, leather straps.',                        slots: 30, nonPortable: true },
  { name: 'Lockbox',                category: 'STORAGE', cost: 35,   wt: 3.0, notes: 'Small steel cash/valuables box, keyed.',                    slots: 6,  nonPortable: true },
  { name: 'Strongbox',              category: 'STORAGE', cost: 120,  wt: 9.0, notes: 'Reinforced steel box, combination lock. SP10.',           slots: 10, nonPortable: true },
  { name: 'Wall Safe',             category: 'STORAGE', cost: 400,  wt: 25,  notes: 'Concealable behind-panel safe, electronic lock. SP15.',     slots: 12, nonPortable: true },
  { name: 'Floor Vault',            category: 'STORAGE', cost: 1500, wt: 120, notes: 'Bolt-down floor vault, biometric lock. SP25.',             slots: 40, nonPortable: true },
  { name: 'Gun Locker',             category: 'STORAGE', cost: 250,  wt: 35,  notes: 'Steel long-gun cabinet, foam racks. SP12.',                slots: 16, nonPortable: true },
  { name: 'Weapons Crate',          category: 'STORAGE', cost: 60,   wt: 10,  notes: 'Mil-surplus arms crate, stencilled.',                      slots: 24, nonPortable: true },
  { name: 'Ammo Can',               category: 'STORAGE', cost: 15,   wt: 2.5, notes: 'Sealed steel ammo can, water-tight.',                      slots: 8,  nonPortable: true },
  { name: 'Pelican Hard Case',      category: 'STORAGE', cost: 180,  wt: 6.0, notes: 'IP67 wheeled hard case, pick-foam. SP8.',                  slots: 18, nonPortable: true },
  { name: 'Tool Chest',             category: 'STORAGE', cost: 140,  wt: 28,  notes: 'Rolling drawer tool chest.',                               slots: 28, nonPortable: true },
  { name: 'Cooler',                 category: 'STORAGE', cost: 40,   wt: 4.0, notes: 'Insulated cooler, holds a charge 12h.',                    slots: 14, nonPortable: true },
  { name: 'Filing Cabinet',         category: 'STORAGE', cost: 80,   wt: 30,  notes: 'Four-drawer steel cabinet, lockable.',                     slots: 26, nonPortable: true },
  { name: 'Locker',                 category: 'STORAGE', cost: 70,   wt: 22,  notes: 'Gym/work locker, vented door.',                            slots: 18, nonPortable: true },
  { name: 'Barrel / Drum',          category: 'STORAGE', cost: 30,   wt: 12,  notes: '200L steel drum, sealed lid.',                             slots: 30, nonPortable: true },
  { name: 'Server Rack',            category: 'STORAGE', cost: 600,  wt: 60,  notes: '19" rack cabinet, lockable mesh doors.',                   slots: 22, nonPortable: true },
  { name: 'Shipping Container',     category: 'STORAGE', cost: 3000, wt: 2200,notes: '20ft intermodal container. A room you can lock.',          slots: 200,nonPortable: true },
];

var _FASHION_SLOT_KEYS = [
  ['backpack', 12], ['briefcase', 8], ['attaché', 8], ['attache', 8],
  ['duffel', 14], ['trenchcoat', 6], ['greatcoat', 5], ['duster', 5],
  ['topcoat', 4], ['jacket', 3], ['coat', 4], ['vest', 2],
  ['satchel', 6], ['bag', 8], ['pants', 3], ['belt', 4],
];

function _getFashionSlots(item) {
  if (item.slots) return item.slots;
  var n = (item.name || '').toLowerCase();
  var m = (item.notes || '').match(/holds\s+up\s+to\s+(\d+)\s*kg/i);
  if (m) return Math.max(2, Math.ceil(parseInt(m[1]) / 5));
  for (var j = 0; j < _FASHION_SLOT_KEYS.length; j++) {
    if (n.indexOf(_FASHION_SLOT_KEYS[j][0]) >= 0) return _FASHION_SLOT_KEYS[j][1];
  }
  return 2;
}

function _makeContainer(src, isOutfit) {
  return {
    name:     src.name,
    category: src.category || '',
    cost:     src.cost  || 0,
    wt:       src.wt    || 0,
    notes:    src.notes || '',
    slots:    _getFashionSlots(src),
    isOutfit: !!isOutfit,
    nonPortable: !!src.nonPortable,
    isArmor:  false,
    sp:       0,
    spCurrent:0,
    locs:     { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false },
    contents: []
  };
}

/* ── Wardrobe ── */
function _makeWardrobeItem(src, isArmor) {
  var spMatch = (src.notes || '').match(/SP[:\s]*(\d+)/i);
  var sp = spMatch ? parseInt(spMatch[1]) : 0;
  return { name: src.name, category: src.category || (isArmor ? 'ARMOR' : 'ARMOR/CLOTHING'),
    cost: src.cost || 0, wt: src.wt || 0, notes: src.notes || '',
    isArmor: !!isArmor, sp: sp, description: '' };
}
function _makeOutfitItem(w) {
  return { name: w.name, category: w.category || '', cost: w.cost || 0, wt: w.wt || 0, notes: w.notes || '',
    isArmor: !!w.isArmor, slots: Math.max(_getFashionSlots(w), 2),
    contents: [], sp: w.sp || 0, spCurrent: w.sp || 0,
    locs: { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false },
    description: w.description || '' };
}

function addOutfit(item)  { var it = _makeWardrobeItem(item, false); CS.wardrobe.push(it); pendPurchase(it, 'clothing', item.cost); renderWardrobe(); }
function addArmor(item)   { var it = _makeWardrobeItem(item, true);  CS.wardrobe.push(it); pendPurchase(it, 'armor', item.cost); renderWardrobe(); }
function addCustomToWardrobe() {
  var name = prompt('Name:'); if (!name) return;
  var spStr = prompt('SP (0 for clothing):'); if (spStr === null) return;
  var sp = parseInt(spStr) || 0;
  CS.wardrobe.push({ name: name, category: sp > 0 ? 'ARMOR' : 'ARMOR/CLOTHING',
    cost: 0, wt: 0, notes: '', isArmor: sp > 0, sp: sp, description: '' });
  renderWardrobe();
}
function addCustomArmor()  { addCustomToWardrobe(); }
function removeFromWardrobe(wi) { CS.wardrobe.splice(wi, 1); renderWardrobe(); }

/* Add wardrobe item (copy) to active outfit */
function addToActiveOutfit(wi) {
  CS.outfits = CS.outfits || [];
  var idx = Math.min(_activeOutfitIdx, CS.outfits.length - 1);
  var w = CS.wardrobe[wi];
  if (!w) return;
  CS.outfits[idx].items.push(_makeOutfitItem(w));
  renderOutfitSection(); renderFashion(); updateArmorSP();
}

/* Remove item from outfit (stays in wardrobe) */
function removeFromOutfit(oi, ii) {
  var outfit = CS.outfits[oi];
  if (!outfit) return;
  var item = outfit.items[ii];
  if (item && (item.contents || []).length) {
    CS.notStored = (CS.notStored || []).concat(item.contents); renderNotStored();
  }
  outfit.items.splice(ii, 1);
  renderOutfitSection(); renderFashion(); updateArmorSP();
}

/* Outfit tabs management */
var _OUTFIT_NAMES = ['A','B','C','D','E','F','G','H'];
function addOutfitTab() {
  CS.outfits = CS.outfits || [];
  var letter = _OUTFIT_NAMES[CS.outfits.length] || (CS.outfits.length + 1);
  CS.outfits.push({ name: 'Outfit ' + letter, equipped: false, items: [] });
  _activeOutfitIdx = CS.outfits.length - 1;
  renderOutfitSection();
}
function removeOutfitTab(oi) {
  if (CS.outfits.length <= 1) return;
  var o = CS.outfits[oi];
  var orphans = (o.items || []).reduce(function(a, f) { return a.concat(f.contents || []); }, []);
  if (orphans.length) { CS.notStored = (CS.notStored || []).concat(orphans); renderNotStored(); }
  var wasEquipped = o.equipped;
  CS.outfits.splice(oi, 1);
  if (_activeOutfitIdx >= CS.outfits.length) _activeOutfitIdx = CS.outfits.length - 1;
  if (wasEquipped && CS.outfits.length) CS.outfits[0].equipped = true;
  renderOutfitSection(); renderFashion(); updateArmorSP();
}
function setActiveOutfit(oi) { _activeOutfitIdx = oi; renderOutfitSection(); renderFashionBodyMap(); updateArmorSP(); }
function toggleEquipOutfit(oi) {
  // Radio behaviour: clicking E always equips that outfit; can't unequip without equipping another
  CS.outfits.forEach(function(o, i) { o.equipped = (i === oi); });
  renderOutfitSection(); renderFashion(); updateArmorSP(); renderFashionBodyMap();
}
function renameOutfit(oi) {
  var o = CS.outfits[oi]; if (!o) return;
  var n = prompt('Outfit name:', o.name); if (!n) return;
  o.name = n; renderOutfitSection();
}

/* Drag wardrobe → outfit */
function wardrobeDragStart(e, wi) {
  _gearDrag = { src: 'wardrobe', wi: wi };
  e.dataTransfer.effectAllowed = 'copy';
}
function clothingEquippedDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
function clothingEquippedDrop(e) {
  e.preventDefault();
  if (!_gearDrag || _gearDrag.src !== 'wardrobe') return;
  addToActiveOutfit(_gearDrag.wi);
  _gearDrag = null;
}

/* Outfit section renderer */
function renderOutfitSection() {
  var el = document.getElementById('outfit-section');
  if (!el) return;
  CS.outfits = CS.outfits || [{ name: 'Outfit A', equipped: true, items: [] }];
  if (_activeOutfitIdx >= CS.outfits.length) _activeOutfitIdx = 0;

  // Tab bar
  var tabW = CS.outfits.length > 0 ? Math.floor(100 / CS.outfits.length) : 100;
  var tabs = CS.outfits.map(function(o, oi) {
    var active = oi === _activeOutfitIdx;
    return '<div class="outfit-tab' + (active ? ' outfit-tab-active' : '') + '" style="flex:1" onclick="setActiveOutfit(' + oi + ')">' +
      '<span class="outfit-tab-e' + (o.equipped ? ' outfit-tab-e-on' : '') + '" ' +
        'onclick="event.stopPropagation();toggleEquipOutfit(' + oi + ')" title="Equip this outfit">E</span>' +
      '<span class="outfit-tab-name" ondblclick="event.stopPropagation();renameOutfit(' + oi + ')">' + o.name + '</span>' +
      (CS.outfits.length > 1 ? '<span class="outfit-tab-close" onclick="event.stopPropagation();removeOutfitTab(' + oi + ')">×</span>' : '') +
    '</div>';
  }).join('');
  var tabBar = '<div class="outfit-tab-bar">' + tabs + '<div class="outfit-tab-add" onclick="addOutfitTab()">+</div></div>';

  // Active outfit items
  var outfit = CS.outfits[_activeOutfitIdx];
  var items = outfit.items || [];
  var itemsHtml = items.length ? items.map(function(f, ii) {
    var locChecks = LOCS.map(function(loc) {
      return '<label class="clothing-loc-label"><input type="checkbox"' + (f.locs && f.locs[loc] ? ' checked' : '') +
        ' onchange="CS.outfits[' + _activeOutfitIdx + '].items[' + ii + '].locs[\'' + loc + '\']=this.checked;updateArmorSP();renderFashionBodyMap()"> ' + LOC_NAMES[loc] + '</label>';
    }).join('');
    return '<div class="inv-item">' +
      '<div class="inv-top">' +
        '<span class="inv-name">' + f.name + '</span>' +
        '<div class="inv-tags">' +
          '<span class="inv-tag-label">SP:</span>' +
          '<input class="inv-tag-edit" type="number" style="width:40px" value="' + (f.sp||0) + '" ' +
            'onchange="CS.outfits[' + _activeOutfitIdx + '].items[' + ii + '].sp=CS.outfits[' + _activeOutfitIdx + '].items[' + ii + '].spCurrent=parseInt(this.value)||0;updateArmorSP()"> ' +
          '<span class="inv-tag-label">Cost:</span>' +
          '<input class="inv-tag-edit" type="number" style="width:50px" value="' + (f.cost||0) + '" ' +
            'onchange="CS.outfits[' + _activeOutfitIdx + '].items[' + ii + '].cost=parseFloat(this.value)||0"> eb' +
        '</div>' +
        '<span class="inv-remove" onclick="removeFromOutfit(' + _activeOutfitIdx + ',' + ii + ')">✕</span>' +
      '</div>' +
      (f.notes ? '<div class="inv-details">' + f.notes + '</div>' : '') +
      '<div class="clothing-locs">' + locChecks + '</div>' +
    '</div>';
  }).join('') : '<div class="outfit-drop-hint">Drag items from wardrobe here</div>';

  el.innerHTML = tabBar +
    '<div class="outfit-items" ondragover="clothingEquippedDragOver(event)" ondrop="clothingEquippedDrop(event)">' +
      itemsHtml +
    '</div>';

  // Keep the body-map overlay in sync with the active tab on every re-render
  // (covers + new tab, add/remove item, etc., not just explicit tab switches).
  renderFashionBodyMap();
}
function renderClothing() { renderOutfitSection(); } // shim

/* Wardrobe renderer */
function renderWardrobe() {
  var el = document.getElementById('wardrobe-list');
  if (!el) return;
  CS.wardrobe = CS.wardrobe || [];
  var searchEl = document.getElementById('wardrobe-search');
  var q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  var searchResultsEl = document.getElementById('wardrobe-search-results');
  if (searchResultsEl) {
    if (q) {
      var outfitDB = DB.gear.filter(function(g) { return (g.category || '') === 'ARMOR/CLOTHING'; });
      var combined = outfitDB.concat(ARMOR_DB);
      var hits = combined.filter(function(i) { return i.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 15);
      searchResultsEl.innerHTML = hits.length ? hits.map(function(item, idx) {
        var isArmorItem = ARMOR_DB.indexOf(item) >= 0;
        var spM = (item.notes || '').match(/SP[:\s]*(\d+)/i);
        return '<div class="wd-result" onclick="wardrobeAddFromSearch(\'' + item.name.replace(/'/g,"\\'") + '\',' + (isArmorItem?1:0) + ')">' +
          '<span class="wd-name">' + item.name + '</span>' +
          (spM ? '<span class="wd-tag">SP ' + spM[1] + '</span>' : '') +
          '<span class="wd-tag">' + (item.cost||0) + 'eb</span>' +
        '</div>';
      }).join('') : '<div class="wd-no-results">No results</div>';
      searchResultsEl.style.display = 'block';
    } else {
      searchResultsEl.style.display = 'none';
    }
  }
  el.innerHTML = CS.wardrobe.length ? CS.wardrobe.map(function(w, wi) {
    return '<div class="wd-item" draggable="true" ondragstart="wardrobeDragStart(event,' + wi + ')">' +
      (w.isArmor ? '<span class="wd-armor-dot" title="Armor"></span>' : '') +
      '<span class="wd-name">' + w.name + '</span>' +
      (w.sp ? '<span class="wd-tag">SP ' + w.sp + '</span>' : '') +
      '<span class="wd-equip-btn" onclick="addToActiveOutfit(' + wi + ')" title="Add to active outfit">▶</span>' +
      '<span class="wd-rm" onclick="removeFromWardrobe(' + wi + ')">✕</span>' +
    '</div>';
  }).join('') : '<div class="wd-empty">Empty. Search above or + Custom.</div>';
}

function wardrobeAddFromSearch(name, isArmorItem) {
  var outfitDB = DB.gear.filter(function(g) { return (g.category || '') === 'ARMOR/CLOTHING'; });
  var combined = outfitDB.concat(ARMOR_DB);
  var item = combined.filter(function(i) { return i.name === name; })[0];
  if (!item) return;
  CS.wardrobe.push(_makeWardrobeItem(item, !!isArmorItem));
  var searchEl = document.getElementById('wardrobe-search');
  if (searchEl) searchEl.value = '';
  var resultsEl = document.getElementById('wardrobe-search-results');
  if (resultsEl) resultsEl.style.display = 'none';
  renderWardrobe();
}

function renderOutfit() { renderOutfitSection(); }   // legacy shim

/* ── Storage containers (Fashion → Inventory containers) ── */
function addFashion(item) {
  CS.fashion.push(_makeContainer(item, false));
  renderFashion();
}
function addCustomFashion() {
  var name = prompt('Name:'); if (!name) return;
  var slots = parseInt(prompt('Number of slots:') || '4');
  CS.fashion.push({ name: name, category: 'CUSTOM', cost: 0, wt: 0, notes: '', slots: slots || 4, isOutfit: false, contents: [] });
  renderFashion();
}
function removeFashion(idx) {
  var item = CS.fashion[idx];
  var orphans = item.contents || [];
  if (orphans.length) {
    CS.notStored = (CS.notStored || []).concat(orphans);
    renderNotStored();
  }
  // If it's an outfit container, also remove from outfit list
  if (item.isOutfit) {
    CS.outfit = (CS.outfit || []).filter(function(o) { return o.name !== item.name; });
    renderOutfit();
  }
  CS.fashion.splice(idx, 1);
  renderFashion();
}

/* ── Not stored ── */
function renderNotStored() {
  CS.notStored = CS.notStored || [];
  var box = document.getElementById('not-stored-box');
  var list = document.getElementById('ns-items');
  if (!box || !list) return;
  if (!CS.notStored.length) { box.style.display = 'none'; return; }
  box.style.display = '';
  list.innerHTML = CS.notStored.map(function(c, i) {
    return '<div class="fci ns-fci" draggable="true" ondragstart="nsDragStart(event,' + i + ')" onclick="toggleNsDetail(' + i + ')">' +
      '<span class="fci-name">' + (c.name || '?') + '</span>' +
      (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
      '<span class="fci-rm" onclick="event.stopPropagation();nsToGear(' + i + ')" title="Move to gear">→</span>' +
      (_nsOpen === i ? '<div class="fci-detail">' +
        (c.category ? '<span>' + c.category + '</span>' : '') +
        (c.cost ? '<span>' + c.cost + 'eb</span>' : '') +
        (c.wt   ? '<span>' + c.wt + 'kg</span>'   : '') +
        (c.notes? '<span class="fci-detail-notes">' + c.notes + '</span>' : '') +
      '</div>' : '') +
    '</div>';
  }).join('');
}
var _nsOpen = null;
function toggleNsDetail(i) { _nsOpen = _nsOpen === i ? null : i; renderNotStored(); }
function nsToGear(i) {
  CS.notStored = CS.notStored || [];
  CS.gear.push(CS.notStored.splice(i, 1)[0]);
  renderNotStored(); renderGear();
}
function nsDragStart(e, i) {
  _gearDrag = { src: 'notStored', nsIdx: i };
  e.dataTransfer.effectAllowed = 'move';
}
function nsDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function nsDropZone(e) { /* items dragged from elsewhere land here */ }

/* ── Drag state ── */
var _gearDrag = null;
var _fciOpen = null; // "fi-ci" key for expanded stored item detail
var _activeOutfitIdx = 0;

function gearItemDragStart(e, gearIdx) {
  _gearDrag = { src: 'gear', gearIdx: gearIdx };
  e.dataTransfer.effectAllowed = 'move';
}
function fashionContentDragStart(e, fIdx, cIdx) {
  _gearDrag = { src: 'fashion', fIdx: fIdx, cIdx: cIdx };
  e.dataTransfer.effectAllowed = 'move';
}
function fashionContainerDragStart(e, fIdx) {
  _gearDrag = { src: 'fashionContainer', fIdx: fIdx };
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}
function fashionDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function gearDragOver(e)    { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }

function _extractDragItem() {
  if (!_gearDrag) return null;
  var item;
  if (_gearDrag.src === 'gear') {
    item = CS.gear.splice(_gearDrag.gearIdx, 1)[0];
  } else if (_gearDrag.src === 'fashion') {
    item = CS.fashion[_gearDrag.fIdx].contents.splice(_gearDrag.cIdx, 1)[0];
  } else if (_gearDrag.src === 'fashionContainer') {
    item = CS.fashion.splice(_gearDrag.fIdx, 1)[0];   // move a whole container (e.g. a stash) into a vehicle/apartment
  } else if (_gearDrag.src === 'notStored') {
    CS.notStored = CS.notStored || [];
    item = CS.notStored.splice(_gearDrag.nsIdx, 1)[0];
  } else if (_gearDrag.src === 'vehCargo') {
    item = CS.vehicles[_gearDrag.vIdx].cargoContents.splice(_gearDrag.cIdx, 1)[0];
  } else if (_gearDrag.src === 'houseCargo') {
    item = CS.lifestyle.housing[_gearDrag.hIdx].cargoContents.splice(_gearDrag.cIdx, 1)[0];
  } else if (_gearDrag.src === 'hand') {
    item = CS.hands[_gearDrag.hIdx];
    CS.hands[_gearDrag.hIdx] = null;
  } else if (_gearDrag.src === 'outfitContent') {
    var _eo = (CS.outfits || []).filter(function(o) { return o.equipped; })[0];
    if (_eo && _eo.items[_gearDrag.ii]) {
      item = _eo.items[_gearDrag.ii].contents.splice(_gearDrag.ci, 1)[0];
    }
  }
  return item || null;
}

function outfitContentDragStart(e, ii, ci) {
  _gearDrag = { src: 'outfitContent', ii: ii, ci: ci };
  e.dataTransfer.effectAllowed = 'move';
}
function outfitContentDropZone(e, ii) {
  e.preventDefault();
  if (!_gearDrag) return;
  var eo = (CS.outfits || []).filter(function(o) { return o.equipped; })[0];
  if (!eo) return;
  var container = eo.items[ii];
  if (!container || (container.contents || []).length >= container.slots) return;
  var item = _extractDragItem();
  if (!item) return;
  container.contents = container.contents || [];
  container.contents.push(item);
  _gearDrag = null;
  renderFashion(); renderGear(); renderNotStored();
}
function removeFromOutfitContent(ii, ci) {
  var eo = (CS.outfits || []).filter(function(o) { return o.equipped; })[0];
  if (!eo) return;
  var item = eo.items[ii].contents.splice(ci, 1)[0];
  CS.gear.push(item);
  _fciOpen = null;
  renderFashion(); renderGear();
}
function toggleOutfitFciDetail(ii, ci) {
  var key = 'oi-' + ii + '-' + ci;
  _fciOpen = (_fciOpen === key) ? null : key;
  renderFashion();
}

function fashionDropZone(e, fIdx) {
  e.preventDefault();
  if (!_gearDrag) return;
  var container = CS.fashion[fIdx];
  if ((container.contents || []).length >= container.slots) return;
  var item = _extractDragItem();
  if (!item) return;
  container.contents = container.contents || [];
  container.contents.push(item);
  _gearDrag = null;
  renderFashion(); renderGear(); renderNotStored();
}

function gearDropZone(e) {
  e.preventDefault();
  if (!_gearDrag) return;
  var item = _extractDragItem();
  if (!item) return;
  CS.gear.push(item);
  _gearDrag = null;
  renderFashion(); renderGear(); renderNotStored();
}

function removeFromFashion(fIdx, cIdx) {
  var item = CS.fashion[fIdx].contents.splice(cIdx, 1)[0];
  CS.gear.push(item);
  _fciOpen = null;
  renderFashion(); renderGear();
}

function toggleFciDetail(fIdx, cIdx) {
  var key = fIdx + '-' + cIdx;
  _fciOpen = (_fciOpen === key) ? null : key;
  renderFashion();
}

/* ── Render containers (Inventory) ── */
function renderFashion() {
  var el = document.getElementById('fashion-list');
  if (!el) return;
  CS.fashion = CS.fashion || [];
  CS.hands = CS.hands || [null, null];
  function _handSlot(entry, hi, label) {
    var occupied = !!entry;
    return '<div class="hand-slot' + (occupied ? ' hand-slot-full' : '') + '" ' +
      'ondragover="fashionDragOver(event)" ondrop="handDropZone(event,' + hi + ')">' +
      '<div class="hand-slot-label">' + label + '</div>' +
      (occupied
        ? '<div class="hand-item" draggable="true" ondragstart="handDragStart(event,' + hi + ')">' +
            '<span class="hand-item-name">' + (entry.name || '?') + '</span>' +
            (entry.category ? '<span class="hand-item-cat">' + entry.category + '</span>' : '') +
            (entry.cost ? '<span class="hand-item-stat">' + entry.cost + ' eb</span>' : '') +
            (entry.wt ? '<span class="hand-item-stat">' + entry.wt + ' kg</span>' : '') +
            (entry.notes ? '<span class="hand-item-notes">' + entry.notes + '</span>' : '') +
            '<span class="hand-item-rm" onclick="removeFromHand(' + hi + ')" title="Return to gear">↩</span>' +
          '</div>'
        : '<span class="hand-placeholder">drag here</span>'
      ) +
    '</div>';
  }
  var handsHtml = '<div class="fi-hands-row">' +
    _handSlot(CS.hands[0], 0, 'Left hand') +
    _handSlot(CS.hands[1], 1, 'Right hand') +
  '</div>';
  // Build vehicle cargo containers to append after fashion containers
  var vehCargoHtml = (CS.vehicles || []).map(function(v, vi) {
    if (!v.name) return '';
    var slots = _getVehCargoSlots(v);
    var used  = _cargoUsed(v.cargoContents);
    var full  = used >= slots;
    var pct   = slots > 0 ? Math.round(used / slots * 100) : 0;
    var slotViz = slots <= 16
      ? '<div class="slot-pips">' + (function() { var p = ''; for (var s = 0; s < slots; s++) p += '<span class="slot-pip' + (s < used ? ' pip-on' : '') + '"></span>'; return p; })() + '</div>'
      : '<div class="slot-bar"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>';
    var items = (v.cargoContents || []).map(function(c, ci) {
      var key = 'iv' + vi + '-' + ci;
      var open = _fciOpen === key;
      return '<div class="fci' + (open ? ' fci-open' : '') + '" draggable="true" ' +
        'ondragstart="vehCargoDragStart(event,' + vi + ',' + ci + ')" ' +
        'onclick="(function(){var k=\'iv' + vi + '-' + ci + '\';_fciOpen=_fciOpen===k?null:k;renderFashion();})()">' +
        '<span class="fci-name">' + (c.name || '?') + '</span>' +
        (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
        '<span class="fci-rm" onclick="event.stopPropagation();removeFromVehCargo(' + vi + ',' + ci + ')" title="Take out">↩</span>' +
        (open ? '<div class="fci-detail">' +
          (c.category ? '<span>' + c.category + '</span>' : '') +
          (c.cost !== undefined ? '<span>' + c.cost + 'eb</span>' : '') +
          (c.wt ? '<span>' + c.wt + 'kg</span>' : '') +
          (c.notes ? '<span class="fci-detail-notes">' + c.notes + '</span>' : '') +
          _containerContentsHtml(c) +
        '</div>' : '') +
      '</div>';
    }).join('');
    return '<div class="fashion-item fi-vehicle">' +
      '<div class="fashion-head">' +
        '<span class="fashion-name">' + v.name + '</span>' +
        '<span class="fashion-badge-vehicle">' + (v.type || 'vehicle') + '</span>' +
        '<div class="fashion-slots-ui">' + slotViz +
          '<span class="slot-count' + (full ? ' slot-full' : '') + '">' + used + '&thinsp;/&thinsp;' + slots + '</span>' +
        '</div>' +
        (v.cargo ? '<span class="veh-cargo-cap">' + v.cargo + '</span>' : '') +
      '</div>' +
      '<div class="fashion-contents' + (full ? ' fc-full' : '') + '" ' +
        'ondragover="fashionDragOver(event)" ondrop="vehCargoDropZone(event,' + vi + ')">' +
        (used > 0 ? items : '<span class="fc-placeholder">' + (full ? 'FULL' : 'drag gear here') + '</span>') +
      '</div>' +
    '</div>';
  }).join('');

  // Build housing cargo containers
  var houseCargoHtml = ((CS.lifestyle && CS.lifestyle.housing) || []).map(function(h, hi) {
    if (!h.name) return '';
    var slots = _lsHousingCargoSlots(h);
    var used  = _cargoUsed(h.cargoContents);
    var full  = used >= slots;
    var pct   = slots > 0 ? Math.round(used / slots * 100) : 0;
    var slotViz = '<div class="slot-bar"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>';
    var items = (h.cargoContents || []).map(function(c, ci) {
      var key = 'ih' + hi + '-' + ci;
      var open = _fciOpen === key;
      return '<div class="fci' + (open ? ' fci-open' : '') + '" draggable="true" ' +
        'ondragstart="houseCargoDragStart(event,' + hi + ',' + ci + ')" ' +
        'onclick="(function(){var k=\'ih' + hi + '-' + ci + '\';_fciOpen=_fciOpen===k?null:k;renderFashion();renderLifestyle();})()">' +
        '<span class="fci-name">' + (c.name || '?') + '</span>' +
        (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
        '<span class="fci-rm" onclick="event.stopPropagation();removeFromHouseCargo(' + hi + ',' + ci + ')" title="Take out">↩</span>' +
        (open ? '<div class="fci-detail">' +
          (c.category ? '<span>' + c.category + '</span>' : '') +
          (c.cost !== undefined ? '<span>' + c.cost + 'eb</span>' : '') +
          (c.wt ? '<span>' + c.wt + 'kg</span>' : '') +
          (c.notes ? '<span class="fci-detail-notes">' + c.notes + '</span>' : '') +
          _containerContentsHtml(c) +
        '</div>' : '') +
      '</div>';
    }).join('');
    return '<div class="fashion-item fi-housing">' +
      '<div class="fashion-head">' +
        '<span class="fashion-name">' + h.name + '</span>' +
        '<span class="fashion-badge-housing">' + (h.type || 'housing') + '</span>' +
        '<div class="fashion-slots-ui">' + slotViz +
          '<span class="slot-count' + (full ? ' slot-full' : '') + '">' + used + '&thinsp;/&thinsp;' + slots + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="fashion-contents' + (full ? ' fc-full' : '') + '" ' +
        'ondragover="fashionDragOver(event)" ondrop="houseCargoDropZone(event,' + hi + ')">' +
        (used > 0 ? items : '<span class="fc-placeholder">' + (full ? 'FULL' : 'drag gear here') + '</span>') +
      '</div>' +
    '</div>';
  }).join('');

  // Equipped outfit containers (slots > 0), shown in blue above regular bags
  var _equippedOutfit = (CS.outfits || []).filter(function(o) { return o.equipped; })[0];
  // Build list preserving real index within _equippedOutfit.items for correct drop/remove targeting
  var _outfitContainers = [];
  ((_equippedOutfit && _equippedOutfit.items) || []).forEach(function(f, realIdx) {
    if ((f.slots || 0) > 0) _outfitContainers.push({ f: f, ii: realIdx });
  });
  var outfitContainersHtml = '';
  if (_outfitContainers.length) {
    outfitContainersHtml = '<div class="inv-subsection-label inv-worn-label">Worn</div>' +
      _outfitContainers.map(function(entry) {
        var f = entry.f, ii = entry.ii;
        var used  = (f.contents || []).length;
        var total = f.slots || 2;
        var full  = used >= total;
        var pct   = total > 0 ? Math.round(used / total * 100) : 0;
        var slotViz = total <= 16
          ? '<div class="slot-pips">' + (function() { var p = ''; for (var s = 0; s < total; s++) p += '<span class="slot-pip' + (s < used ? ' pip-on' : '') + '"></span>'; return p; })() + '</div>'
          : '<div class="slot-bar"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>';
        var contentsHtml = (f.contents || []).map(function(c, ci) {
          var key = 'oi-' + ii + '-' + ci;
          var open = _fciOpen === key;
          return '<div class="fci' + (open ? ' fci-open' : '') + '" draggable="true" ' +
            'ondragstart="outfitContentDragStart(event,' + ii + ',' + ci + ')" ' +
            'onclick="toggleOutfitFciDetail(' + ii + ',' + ci + ')">' +
            '<span class="fci-name">' + (c.name || '?') + '</span>' +
            (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
            '<span class="fci-rm" onclick="event.stopPropagation();removeFromOutfitContent(' + ii + ',' + ci + ')" title="Return to gear">↩</span>' +
            (open ? '<div class="fci-detail">' +
              (c.category ? '<span>' + c.category + '</span>' : '') +
              (c.cost !== undefined && c.cost !== '' ? '<span>' + c.cost + 'eb</span>' : '') +
              (c.wt ? '<span>' + c.wt + 'kg</span>' : '') +
              (c.notes ? '<span class="fci-detail-notes">' + c.notes + '</span>' : '') +
            '</div>' : '') +
          '</div>';
        }).join('');
        return '<div class="fashion-item fi-outfit-worn">' +
          '<div class="fashion-head">' +
            '<span class="fashion-name">' + f.name + '</span>' +
            (f.category ? '<span class="fashion-cat">' + f.category + '</span>' : '') +
            '<div class="fashion-slots-ui">' + slotViz +
              '<span class="slot-count' + (full ? ' slot-full' : '') + '">' + used + '&thinsp;/&thinsp;' + total + '</span>' +
            '</div>' +
          '</div>' +
          (f.notes ? '<div class="fashion-notes">' + f.notes + '</div>' : '') +
          '<div class="fashion-contents' + (full ? ' fc-full' : '') + '" ' +
            'ondragover="fashionDragOver(event)" ondrop="outfitContentDropZone(event,' + ii + ')">' +
            (contentsHtml || '<span class="fc-placeholder">' + (full ? 'FULL' : 'drag gear here') + '</span>') +
          '</div>' +
        '</div>';
      }).join('');
  }

  var fashionHtml = CS.fashion.map(function(f, fi) {
    if (f.isArmor) return ''; // armor only in clothing section, not inventory
    var used  = (f.contents || []).length;
    var total = f.slots || 2;
    var full  = used >= total;
    var pct   = total > 0 ? Math.round(used / total * 100) : 0;

    var slotViz = '';
    if (total <= 16) {
      var pips = '';
      for (var s = 0; s < total; s++) pips += '<span class="slot-pip' + (s < used ? ' pip-on' : '') + '"></span>';
      slotViz = '<div class="slot-pips">' + pips + '</div>';
    } else {
      slotViz = '<div class="slot-bar"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>';
    }

    var contentsHtml = (f.contents || []).map(function(c, ci) {
      var key = fi + '-' + ci;
      var open = _fciOpen === key;
      return '<div class="fci' + (open ? ' fci-open' : '') + '" draggable="true" ' +
        'ondragstart="fashionContentDragStart(event,' + fi + ',' + ci + ')" ' +
        'onclick="toggleFciDetail(' + fi + ',' + ci + ')">' +
        '<span class="fci-name">' + (c.name || '?') + '</span>' +
        (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
        '<span class="fci-rm" onclick="event.stopPropagation();removeFromFashion(' + fi + ',' + ci + ')" title="Return to gear">↩</span>' +
        (open ? '<div class="fci-detail">' +
          (c.category ? '<span>' + c.category + '</span>' : '') +
          (c.cost !== undefined && c.cost !== '' ? '<span>' + c.cost + 'eb</span>' : '') +
          (c.wt   ? '<span>' + c.wt + 'kg</span>'   : '') +
          (c.notes ? '<span class="fci-detail-notes">' + c.notes + '</span>' : '') +
        '</div>' : '') +
      '</div>';
    }).join('');

    var badge = f.isOutfit ? '<span class="fashion-badge-outfit">outfit</span>'
      : (f.nonPortable ? '<span class="fashion-badge-fixed" title="Non-portable — can\'t be carried; sits at home or in a vehicle">fixed</span>' : '');

    // Non-portable containers (stashes, safes, crates) can't be equipped — no E badge.
    var eBadge = (!f.isOutfit && !f.isArmor && !f.nonPortable)
      ? '<span class="fi-equip-badge' + (f.equipped ? ' fi-equip-on' : '') + '" ' +
          'onclick="event.stopPropagation();CS.fashion[' + fi + '].equipped=!CS.fashion[' + fi + '].equipped;renderFashion()" ' +
          'title="Equipped">E</span>'
      : '';
    return '<div class="fashion-item' + (f.isOutfit ? ' fi-outfit' : '') + '" data-cfi="' + fi + '">' +
      eBadge +
      '<div class="fashion-head" ' + (!f.isOutfit ? 'draggable="true" ondragstart="fashionContainerDragStart(event,' + fi + ')"' : '') + '>' +
        '<span class="fashion-name">' + f.name + '</span>' + badge +
        (f.category && f.category !== 'CUSTOM' && !f.isOutfit ? '<span class="fashion-cat">' + f.category + '</span>' : '') +
        '<div class="fashion-slots-ui">' + slotViz +
          '<span class="slot-count' + (full ? ' slot-full' : '') + '">' + used + '&thinsp;/&thinsp;' + total + '</span>' +
        '</div>' +
        '<span class="inv-remove" onclick="removeFashion(' + fi + ')">✕</span>' +
      '</div>' +
      (f.notes ? '<div class="fashion-notes">' + f.notes + '</div>' : '') +
      '<div class="fashion-contents' + (full ? ' fc-full' : '') + '" ' +
        'ondragover="fashionDragOver(event)" ondrop="fashionDropZone(event,' + fi + ')">' +
        (contentsHtml || '<span class="fc-placeholder">' + (full ? 'FULL' : 'drag gear here') + '</span>') +
      '</div>' +
    '</div>';
  }).join('');

  el.innerHTML = handsHtml + outfitContainersHtml + fashionHtml + vehCargoHtml + houseCargoHtml;
  if (window.CtxMenu) el.querySelectorAll('.fashion-item[data-cfi]').forEach(function (n) { CtxMenu.attach(n, function () { return _containerCtxMenu(+n.getAttribute('data-cfi')); }); });
}

/* ─── Gear ─── */
function addGear(item) {
  var g = { name: item.name, category: item.category || '', cost: item.cost || 0, wt: item.wt || 0, qty: 1, notes: item.notes || '', description: '' };
  CS.gear.push(g);
  pendPurchase(g, 'gear');
  renderGear();
}
function addCustomGear() {
  var name = prompt('Name:'); if (!name) return;
  CS.gear.push({ name: name, category: 'CUSTOM', cost: 0, wt: 0, notes: '', description: '' });
  renderGear();
}
function removeGear(idx) {
  var g = CS.gear[idx];
  CS.gear.splice(idx, 1);
  if (g && g.weaponUid) { _removeLinkedWeaponByUid(g.weaponUid); }
  renderGear();
}
/* Removing a weapon's gear copy also retires the weapon (and any other linked copies). */
function _removeLinkedWeaponByUid(uid) {
  if (!uid) return;
  var i = (CS.weapons || []).findIndex(function(w) { return w.uid === uid; });
  if (i >= 0) CS.weapons.splice(i, 1);
  _removeLinkedGear(uid);
  if (typeof renderWeapons === 'function') renderWeapons();
  if (typeof renderNotStored === 'function') renderNotStored();
  if (typeof renderFashion === 'function') renderFashion();
}
function setGearDesc(idx, val) { CS.gear[idx].description = val; }
// Quantity per gear entry — drives the price charged in the buytray (unit × qty).
function setGearQty(idx, val) {
  var g = CS.gear[idx]; if (!g) return;
  g.qty = Math.max(1, Math.round(parseFloat(val) || 1));
  if (g.buyId && Array.isArray(CS.pending)) {
    var p = CS.pending.filter(function (x) { return x.id === g.buyId; })[0];
    if (p) { p.qty = g.qty; p.unit = (g.cost || 0); p.cost = Math.round((g.cost || 0) * g.qty); }
  }
  try { _csPersist(); } catch (e) {}
  renderGear(); renderPending();
}

function renderGear() {
  var el = document.getElementById('gear-list');
  if (!el) return;
  el.innerHTML = CS.gear.map(function(g, i) {
    return '<div class="inv-item' + (g._forSale ? ' inv-forsale' : '') + '" data-gi="' + i + '" draggable="true" ondragstart="gearItemDragStart(event,' + i + ')">' +
      '<div class="inv-top">' +
      '<span class="drag-handle" title="Drag into a container">⠿</span>' +
      '<span class="inv-name">' + g.name + (g._forSale ? ' <span class="inv-forsale-tag">on sale</span>' : '') + '</span>' +
      '<div class="inv-tags">' +
      editTag('gear', i, 'category', 'Cat:', '', 60) +
      '<span class="inv-tag-label">×</span>' +
      '<input class="inv-tag-edit" type="number" min="1" step="1" style="width:42px" value="' + (g.qty || 1) + '" title="Quantity" onchange="setGearQty(' + i + ',this.value)">' +
      editTagNum('gear', i, 'cost', '', 'eb', 50) +
      editTagNum('gear', i, 'wt', '', 'kg', 40) +
      '</div>' +
      '<span class="inv-remove" onclick="removeGear(' + i + ')">✕</span></div>' +
      (g.notes ? '<div class="inv-details">' + g.notes + '</div>' : '') +
      '<textarea class="inv-desc-input" placeholder="Description..." oninput="setGearDesc(' + i + ',this.value)">' + (g.description || '') + '</textarea>' +
      '</div>';
  }).join('');
  if (window.CtxMenu) el.querySelectorAll('.inv-item[data-gi]').forEach(function (n) { CtxMenu.attach(n, function () { return _gearCtxMenu(+n.getAttribute('data-gi')); }); });
}
/* ─── Inventory right-click menus ─── */
function _ctxInvRefresh() {
  renderGear(); renderFashion();
  if (typeof renderVehicles === 'function') renderVehicles();
  if (typeof renderLifestyle === 'function') renderLifestyle();
  if (typeof renderNotStored === 'function') renderNotStored();
  try { _csPersist(); } catch (e) {}
}
// Submenu of destinations a loose item can be moved into (bags, vehicles, apartments).
function _invMoveSubmenu(take) {
  var subs = [];
  (CS.fashion || []).forEach(function (f) {
    if (f.isArmor || !(f.slots > 0)) return;
    var full = (f.contents || []).length >= f.slots;
    subs.push({ label: f.name + ' (' + (f.contents || []).length + '/' + f.slots + ')', disabled: full, onClick: function () { var it = take(); if (it) { (f.contents || (f.contents = [])).push(it); _ctxInvRefresh(); } } });
  });
  (CS.vehicles || []).forEach(function (v) {
    if (!v.name) return; var cap = _getVehCargoSlots(v);
    subs.push({ label: '🚗 ' + v.name, disabled: _cargoUsed(v.cargoContents) + 1 > cap, onClick: function () { var it = take(); if (it) { (v.cargoContents || (v.cargoContents = [])).push(it); _ctxInvRefresh(); } } });
  });
  ((CS.lifestyle && CS.lifestyle.housing) || []).forEach(function (h) {
    if (!h.name) return; var cap = _lsHousingCargoSlots(h);
    subs.push({ label: '⌂ ' + h.name, disabled: _cargoUsed(h.cargoContents) + 1 > cap, onClick: function () { var it = take(); if (it) { (h.cargoContents || (h.cargoContents = [])).push(it); _ctxInvRefresh(); } } });
  });
  if (!subs.length) subs.push({ label: 'No containers yet', disabled: true });
  return subs;
}
function _gearCtxMenu(gi) {
  var g = CS.gear[gi]; if (!g) return null;
  return [
    { label: 'Move to…', icon: '⇢', submenu: function () { return _invMoveSubmenu(function () { return CS.gear.splice(gi, 1)[0]; }); } },
    { label: 'Duplicate', icon: '⧉', onClick: function () { CS.gear.push(JSON.parse(JSON.stringify(g))); _ctxInvRefresh(); } },
    { sep: true },
    { label: 'Delete', icon: '✕', danger: true, onClick: function () { removeGear(gi); try { _csPersist(); } catch (e) {} } }
  ];
}
function _weaponCtxMenu(wi) {
  var w = CS.weapons[wi]; if (!w) return null;
  return [
    { label: 'Reload', icon: '⟳', disabled: !(w.shots > 0), onClick: function () { ammoReload(wi); try { _csPersist(); } catch (e) {} } },
    { sep: true },
    { label: 'Delete', icon: '✕', danger: true, onClick: function () { removeWeapon(wi); try { _csPersist(); } catch (e) {} } }
  ];
}
function _containerCtxMenu(fi) {
  var f = CS.fashion[fi]; if (!f) return null;
  var items = [];
  if (!f.nonPortable && !f.isArmor) items.push({ label: f.equipped ? 'Unequip' : 'Equip', icon: 'E', onClick: function () { f.equipped = !f.equipped; renderFashion(); try { _csPersist(); } catch (e) {} } });
  items.push({ label: 'Empty (to Not stored)', icon: '⇩', disabled: !((f.contents || []).length), onClick: function () { CS.notStored = (CS.notStored || []).concat(f.contents || []); f.contents = []; renderFashion(); if (typeof renderNotStored === 'function') renderNotStored(); try { _csPersist(); } catch (e) {} } });
  items.push({ label: 'Rename', icon: '✎', onClick: function () { var v = prompt('Container name:', f.name || ''); if (v != null && v.trim()) { f.name = v.trim(); renderFashion(); try { _csPersist(); } catch (e) {} } } });
  items.push({ sep: true });
  items.push({ label: 'Remove', icon: '✕', danger: true, onClick: function () { removeFashion(fi); try { _csPersist(); } catch (e) {} } });
  return items;
}

/* ─── LIFESTYLE ─── */
var HOUSING_TYPES = ['Apartment','Studio','Cubicle','Condo','Container Pod','Mobile Home',
  'Corporate Housing','Penthouse','Squat','Safehouse','Houseboat','Underground Bunker',
  'Converted Warehouse','Capsule Hotel'];

/* ─── BANKING ─── */
/* Tier config: monthly account fee, overdraft ceiling, base loan rate (annual). */
var BANK_TIERS = {
  1: { fee: 50,   overdraft: 100,  loanRate: 0.20, label: 'Budget'    },
  2: { fee: 400,  overdraft: 1000, loanRate: 0.12, label: 'Corporate' },
  3: { fee: 1000, overdraft: 5000, loanRate: 0.06, label: 'Premium'   }
};
var BANKS = [
  { id:'amexworld', name:'American Express-World',  tier:1, services:['Banking'],                        location:'USA',           source:'SOF p.62',  region:'usa', color:'#006fcf', color2:'#00175a', logoFile:'img/logo/amex.png' },
  { id:'sumitomo',  name:'Sumitomo',                tier:1, services:['Banking'],                        location:'Japan',         source:'SOF p.62',  region:'jp',  color:'#1f8a4c', color2:'#0c5a30', logoFile:'img/logo/sumitomo.png' },
  { id:'westcity',  name:'West City Bank',          tier:1, services:['Banking'],                        location:'USA',           source:'CP20 p.218',region:'usa', color:'#b22234', color2:'#1f3a93', logoFile:'img/logo/westcitybank.png' },
  { id:'maf',       name:'Merrill, Asukaga & Finch',tier:1, services:['Banking','Financial'],            location:'New York, USA', source:'CP20 p.212',region:'usa', color:'#0e2a55', color2:'#caa23a', logoFile:'img/logo/MAF.png' },
  { id:'arasaka',   name:'Arasaka',                 tier:2, services:['Banking','Security','Arms'],      location:'Tokyo, Japan',  source:'CP20 p.214',region:'jp',  color:'#b3122a', color2:'#0d0d0d', logoFile:'img/logo/arasaka.png' },
  { id:'fujiwara',  name:'Fujiwara',                tier:2, services:['Banking','Security','Financial'], location:'Tokyo, Japan',  source:'PAC p.12',  region:'jp',  color:'#6c3a8c', color2:'#2a2440' },
  { id:'hilliard',  name:'Hilliard Corporation',    tier:2, services:['Banking','Financial'],            location:'London, UK',    source:'UK p.12',   region:'uk',  color:'#14502a', color2:'#a8862c' },
  { id:'drakon',    name:'Drakon Worldwide Fund',   tier:3, services:['Banking'],                        location:'Luxemburg',     source:'SOF p.52',  region:'lux', color:'#c9a24a', color2:'#0d0d0d' },
  { id:'eurobank',  name:'Eurobank',                tier:3, services:['Banking'],                        location:'Europe',        source:'ES+ p.17',  region:'eu',  color:'#003399', color2:'#ffcc00' },
  { id:'westgesell',name:'West Gesellschaft Bank',  tier:3, services:['Banking'],                        location:'Germany',       source:'ES+ p.47',  region:'de',  color:'#2b2f33', color2:'#8a9095' }
];
function _bankColor(bank)  { return (bank && bank.color)  || '#111'; }
function _bankColor2(bank) { return (bank && bank.color2) || '#666'; }
function _bankLogo(bankId) {
  var a = (CS.lifestyle.bankAssets || {})[bankId];
  if (a && a.logo) return a.logo;             // user upload wins
  var bank = _bankById(bankId);
  return (bank && bank.logoFile) ? bank.logoFile : null;  // bundled default PNG
}
/* True only when the displayed logo is a user upload (so we offer a clear button). */
function _bankLogoIsCustom(bankId) {
  var a = (CS.lifestyle.bankAssets || {})[bankId];
  return !!(a && a.logo);
}
function _bankMonogram(bank) {
  var words = String(bank.name || '?').replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (bank.name || '?').slice(0, 2).toUpperCase();
}
function _bankById(id) { return BANKS.filter(function(b){ return b.id === id; })[0] || null; }
function _bankOf(acc)  { return _bankById(acc.bankId) || BANKS[0]; }
function _accTier(acc) { return BANK_TIERS[_bankOf(acc).tier]; }
function _accById(id)  { return (CS.lifestyle.accounts||[]).filter(function(a){ return a.id === id; })[0] || null; }
/* Suggested annual loan rate: tier base, reduced by creditworthiness (balance + 3 months salary). */
function _suggestLoanRate(acc) {
  var base = _accTier(acc).loanRate;
  var credit = (parseFloat(acc.balance)||0) + (parseFloat(CS.lifestyle.salary)||0) * 3;
  var reduction = Math.min(0.5, credit / 100000 * 0.5);
  return Math.max(0.01, Math.round(base * (1 - reduction) * 1000) / 1000);
}

/* ─── Financial products: tier gating ───
   Returns the set of products available on an account, by bank tier + service tags. */
function _accProducts(acc) {
  var bank = _bankOf(acc);
  var t = bank.tier;
  var p = [];
  if (t >= 2) { p.push('deposit', 'insurance', 'financing', 'escrow'); }
  if (t >= 3) { p.push('invest', 'launder'); }
  // Laundering also available at tier 2 banks tagged Security/Financial
  if (t === 2 && (bank.services||[]).some(function(s){ return s === 'Security' || s === 'Financial'; })) {
    if (p.indexOf('launder') < 0) p.push('launder');
  }
  return p;
}
function _accHasProduct(acc, prod) { return _accProducts(acc).indexOf(prod) >= 0; }

/* ─── Corp share pricing (deterministic GBM, ported from organisations.js) ─── */
function _seededRng(seed) {
  var s = 0; var str = String(seed);
  for (var i = 0; i < str.length; i++) { s = (s * 31 + str.charCodeAt(i)) >>> 0; }
  s = s || 1;
  return function() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function _corpBasePrice(name) {
  var rng = _seededRng('base:' + name);
  return Math.round((20 + rng() * 280) * 100) / 100;
}
/* Price of a corp `month` steps into a deterministic series (monthly GBM). */
function _corpPrice(name, month) {
  month = Math.max(0, Math.floor(month || 0));
  var rng = _seededRng('series:' + name);
  var price = _corpBasePrice(name);
  var mu = 0.014, sigma = 0.06; // monthly drift / volatility — drift biased up so investing pays off
  for (var i = 0; i < month; i++) {
    var u1 = Math.max(1e-10, rng()), u2 = rng();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    price *= Math.exp((mu - sigma * sigma / 2) + sigma * z);
    if (rng() < 0.04) price *= (1 + (rng() - 0.4) * 0.3); // occasional shock, slightly upward-skewed
    price = Math.max(0.5, price);
  }
  return Math.round(price * 100) / 100;
}
/* Trading commission rate by tier (premium = cheaper). */
function _tradeCommission(acc) { return _bankOf(acc).tier >= 3 ? 0.01 : 0.02; }
/* Laundering commission by tier (premium launders cheaper). */
function _launderFeeRate(acc) { return _bankOf(acc).tier >= 3 ? 0.07 : 0.12; }

var GROCERY_QUALITY = { 'None':0, 'Kibble':100, 'Generic Prepak':160, 'Good Prepak':220, 'Fresh Food':600, 'Genetically Grown':1000 };
var GROCERY_MULT    = { 'Poor':0.5, 'Fair':1, 'Good':2, 'Excellent':3 };

function _lsHasCredchip() {
  return (CS.lifestyle.services || []).some(function(s) {
    return s.name.toLowerCase().indexOf('cred chip account') !== -1;
  });
}
function _lsCredchipTotal() {
  return (CS.lifestyle.credchips || []).reduce(function(t, c) { return t + (parseFloat(c.amount) || 0); }, 0);
}
function _lsCashTotal() {
  return (parseFloat(CS.lifestyle.cash) || 0) + (_lsHasCredchip() ? _lsCredchipTotal() : 0);
}
function _lsServiceTotal() {
  return (CS.lifestyle.services || []).reduce(function(t, s) { return t + (parseFloat(s.cost) || 0); }, 0);
}
function _lsGroceriesCost() {
  var g = CS.lifestyle.groceries || {};
  if (!g.quality || g.quality === 'None') return 0;
  return Math.round((GROCERY_QUALITY[g.quality] || 160) * (GROCERY_MULT[g.multiplier] || 1));
}
function _lsHousingMonthlyCost() {
  return (CS.lifestyle.housing || []).reduce(function(t, h) {
    var util = (h.utilities||[]).reduce(function(s,u){ return s+(parseFloat(u.cost)||0); },0);
    return t + (h.owned ? 0 : (parseFloat(h.rent)||0)) + util;
  }, 0);
}
/* Slots an item occupies in a non-portable space (vehicle / apartment cargo): a
   non-portable container takes its WHOLE capacity regardless of contents; anything
   else takes one slot. */
function _cargoCost(it) { return (it && it.nonPortable && it.slots) ? it.slots : 1; }
function _cargoUsed(arr) { return (arr || []).reduce(function(s, it) { return s + _cargoCost(it); }, 0); }
function _isContainerItem(it) { return !!(it && Array.isArray(it.contents)); }
/* When a container sits in a vehicle/apartment, expanding it lists what it holds. */
function _containerContentsHtml(c) {
  if (!_isContainerItem(c)) return '';
  if (!c.contents.length) return '<span class="fci-detail-notes">Empty — ' + (c.slots || '?') + ' slots</span>';
  return '<span class="fci-detail-notes">Holds ' + c.contents.length + '/' + (c.slots || '?') + ': ' +
    c.contents.map(function(x) { return _esc(x.name || '?'); }).join(', ') + '</span>';
}
function _lsHousingCargoSlots(h) { return (parseInt(h.rooms) || 1) * 50; }

/* cash */
function lsAddCashSalary() {
  CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash) || 0) + (parseFloat(CS.lifestyle.salary) || 0);
  renderLifestyle();
}
function lsAddCredchip() {
  var ni = document.getElementById('ls-cc-name-inp');
  var ai = document.getElementById('ls-cc-amt-inp');
  var name = ni ? ni.value.trim() : '';
  var amt  = ai ? parseFloat(ai.value) || 0 : 0;
  if (!name && !amt) return;
  CS.lifestyle.credchips.push({ name: name || 'Credchip', amount: amt });
  renderLifestyle();
}
function lsEndOfMonth() {
  var ls = CS.lifestyle;
  // Helper: debit `amt` to an account (by id) or to cash if no/closed account.
  function debit(accId, amt, label) {
    var a = accId ? _accById(accId) : null;
    if (a && !a.closed) { a.balance = (parseFloat(a.balance)||0) - amt; _ledgerPush(a, 'expense', label, amt); }
    else ls.cash = (parseFloat(ls.cash)||0) - amt;
  }

  // 0. Advance the in-game month (drives share prices & deposit maturity)
  ls.month = (parseInt(ls.month)||0) + 1;

  // 1. Salary → cash
  ls.cash = (parseFloat(ls.cash)||0) + (parseFloat(ls.salary)||0);

  // 2. Per-account regular INPUTs credited (monthly ×1, weekly ×4)
  (ls.accounts||[]).forEach(function(a) {
    if (a.closed) return;
    (a.inputs||[]).forEach(function(inp) {
      var amt = (parseFloat(inp.amount)||0) * (inp.freq === 'weekly' ? 4 : 1);
      if (amt) { a.balance = (parseFloat(a.balance)||0) + amt; _ledgerPush(a, 'income', (inp.label||'Input') + ' (' + inp.freq + ')', amt); }
    });
  });

  // 3. Services → their billing account (or cash)
  (ls.services||[]).forEach(function(s) {
    var cost = parseFloat(s.cost)||0;
    if (cost) debit(s.accountId, cost, 'Service: ' + (s.name||''));
  });

  // 4. Housing rent + utilities → billing account (or cash)
  (ls.housing||[]).forEach(function(h) {
    var util = (h.utilities||[]).reduce(function(t,u){ return t+(parseFloat(u.cost)||0); }, 0);
    var cost = (h.owned ? 0 : (parseFloat(h.rent)||0)) + util;
    if (cost) debit(h.billAccountId, cost, 'Housing: ' + (h.name||''));
  });

  // 5. Groceries → cash
  ls.cash = (parseFloat(ls.cash)||0) - _lsGroceriesCost();

  // 6. Account monthly fees → fee-billing account (default: own account)
  (ls.accounts||[]).forEach(function(a) {
    if (a.closed) return;
    debit(a.feeAccountId || a.id, _accTier(a).fee, _bankOf(a).name + ' account fee');
  });

  // 7. Loan interest accrues on every outstanding loan
  (ls.accounts||[]).forEach(function(a) {
    if (a.closed) return;
    (a.loans||[]).forEach(function(l) {
      var p = parseFloat(l.principal)||0;
      if (p > 0) l.principal = Math.round(p * (1 + (parseFloat(l.rate)||0) / 12));
    });
  });

  // 8. Financial products
  (ls.accounts||[]).forEach(function(a) {
    if (a.closed) return;
    // Term deposits: accrue monthly interest; auto-return at maturity
    (a.deposits||[]).slice().forEach(function(d) {
      d.monthsElapsed = (parseInt(d.monthsElapsed)||0) + 1;
      d.accrued = (parseFloat(d.accrued)||0) + (parseFloat(d.principal)||0) * (parseFloat(d.rate)||0) / 12;
      if (d.monthsElapsed >= (parseInt(d.termMonths)||0)) {
        var ret = Math.round((parseFloat(d.principal)||0) + (parseFloat(d.accrued)||0));
        a.balance = (parseFloat(a.balance)||0) + ret;
        _ledgerPush(a, 'income', 'Term deposit matured: ' + (d.label||''), ret);
        a.deposits = a.deposits.filter(function(x){ return x.id !== d.id; });
      }
    });
    // Insurance premiums
    (a.policies||[]).forEach(function(p) {
      if (p.active !== false && (parseFloat(p.premium)||0) > 0) debit(a.id, parseFloat(p.premium)||0, 'Insurance: ' + p.type);
    });
    // Cyberware financing installments
    (a.financing||[]).slice().forEach(function(f) {
      if ((parseInt(f.remaining)||0) > 0) {
        debit(a.id, parseFloat(f.monthly)||0, 'Financing: ' + (f.item||''));
        f.remaining = (parseInt(f.remaining)||0) - 1;
        if (f.remaining <= 0) a.financing = a.financing.filter(function(x){ return x.id !== f.id; });
      }
    });
  });

  // 9. Loan-shark interest compounds (cash-side debt, no mercy)
  (ls.sharkLoans||[]).forEach(function(s) {
    var p = parseFloat(s.principal)||0;
    if (p > 0) s.principal = Math.round(p * (1 + (parseFloat(s.rate)||0) / 12));
  });

  renderLifestyle();
}

/* housing */
function lsAddHousing() {
  CS.lifestyle.housing.push({
    name: 'New Place', type: 'Apartment', rooms: 1, rent: 0, owned: false,
    location: '', district: '', description: '', utilities: [], cargoContents: [], cargoOpen: false
  });
  renderLifestyle(); renderFashion();
}
function removeHousing(hi) {
  var h = CS.lifestyle.housing[hi];
  if ((h.cargoContents || []).length) {
    CS.notStored = (CS.notStored || []).concat(h.cargoContents);
    renderNotStored();
  }
  CS.lifestyle.housing.splice(hi, 1);
  renderLifestyle(); renderFashion();
}
function lsAddUtility(hi) {
  CS.lifestyle.housing[hi].utilities.push({ name: '', cost: 0 });
  renderLifestyle();
}
function houseCargoDragStart(e, hi, ci) {
  _gearDrag = { src: 'houseCargo', hIdx: hi, cIdx: ci };
  e.dataTransfer.effectAllowed = 'move';
}
function houseCargoDropZone(e, hi) {
  e.preventDefault();
  if (!_gearDrag) return;
  var h = CS.lifestyle.housing[hi];
  h.cargoContents = h.cargoContents || [];
  var item = _extractDragItem();
  if (!item) return;
  if (_cargoUsed(h.cargoContents) + _cargoCost(item) > _lsHousingCargoSlots(h)) { CS.notStored = (CS.notStored || []).concat(item); }
  else { h.cargoContents.push(item); }
  _gearDrag = null;
  renderLifestyle(); renderFashion(); renderGear(); renderNotStored();
}
function removeFromHouseCargo(hi, ci) {
  var item = CS.lifestyle.housing[hi].cargoContents.splice(ci, 1)[0];
  if (_isContainerItem(item)) { CS.fashion.push(item); } else { CS.gear.push(item); }
  renderLifestyle(); renderFashion(); renderGear();
}

/* services */
function lsAddService(item) {
  CS.lifestyle.services.push({ name: item.name, cost: parseFloat(item.cost) || 0 });
  renderLifestyle();
}
function lsRemoveService(si) {
  var svc = CS.lifestyle.services[si];
  // A web subscription is linked to an app: dropping the service cancels the sub.
  var wasApp = !!(svc && svc.app);
  if (wasApp && CS.net && CS.net.apps && CS.net.apps[svc.app]) CS.net.apps[svc.app].premium = false;
  // A desktop subscription (NÜ Premium) → dropping the service cancels the sub.
  if (svc && svc.desktopPro) { CS.net = CS.net || {}; CS.net.desktop = CS.net.desktop || {}; CS.net.desktop.nuePro = false; }
  CS.lifestyle.services.splice(si, 1);
  renderLifestyle();
  try { _csPersist(); } catch (e) {}
  // Reload so the Net app immediately reflects the cancelled subscription.
  if (wasApp) setTimeout(function () { location.reload(); }, 200);
}
function lsSetServiceAccount(si, accId) {
  if (CS.lifestyle.services[si]) CS.lifestyle.services[si].accountId = accId || null;
  renderLifestyle();
}

/* ─── BANKING actions ─── */
function _bankUid() { return 'a' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36); }
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* Sum of monthly account fees (one per open account). */
function _lsAccountFeesTotal() {
  return (CS.lifestyle.accounts || []).reduce(function(t, a) {
    return t + (a.closed ? 0 : _accTier(a).fee);
  }, 0);
}
function _accLoanTotal(acc) {
  return (acc.loans || []).reduce(function(t, l){ return t + (parseFloat(l.principal)||0); }, 0);
}
/* Net worth across all open accounts (can be negative if overdrawn / in debt). */
function _lsAccountsBalanceTotal() {
  return (CS.lifestyle.accounts || []).reduce(function(t, a) {
    if (a.closed) return t;
    return t + (parseFloat(a.balance)||0) - _accLoanTotal(a);
  }, 0);
}

/* Active sub-tab of the account panel (transient UI state). */
var _finTab = 'liquidity';

/* ── Modal helper (lives in the CS document) ── */
function _modalEl() {
  var ov = document.getElementById('cs-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'cs-modal-overlay';
    ov.className = 'cs-modal-overlay';
    ov.onclick = function(e){ if (e.target === ov) _modalClose(); };
    ov.innerHTML = '<div class="cs-modal"><div class="cs-modal-head"><span id="cs-modal-title"></span>' +
      '<span class="cs-modal-x" onclick="_modalClose()">✕</span></div><div id="cs-modal-body"></div></div>';
    document.body.appendChild(ov);
  }
  return ov;
}
function _modalOpen(title, html) {
  var ov = _modalEl();
  document.getElementById('cs-modal-title').textContent = title;
  document.getElementById('cs-modal-body').innerHTML = html;
  ov.style.display = 'flex';
}
function _modalClose() {
  var ov = document.getElementById('cs-modal-overlay');
  if (ov) ov.style.display = 'none';
}

/* ── Per-bank logo upload (base64, stored in CS.lifestyle.bankAssets) ── */
var _pendingLogoBank = null;
function _bankLogoInput() {
  var inp = document.getElementById('ls-bank-logo-input');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'ls-bank-logo-input'; inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.onchange = lsBankLogoUpload;
    document.body.appendChild(inp);
  }
  return inp;
}
function lsBankLogoPick(bankId) {
  _pendingLogoBank = bankId;
  _bankLogoInput().click();
}
function lsBankLogoUpload(e) {
  var f = e.target.files[0]; var bankId = _pendingLogoBank;
  if (!f || !bankId) { e.target.value = ''; return; }
  var r = new FileReader();
  r.onload = function(ev) {
    CS.lifestyle.bankAssets = CS.lifestyle.bankAssets || {};
    CS.lifestyle.bankAssets[bankId] = { logo: ev.target.result };
    _pendingLogoBank = null;
    renderLifestyle();
  };
  r.readAsDataURL(f);
  e.target.value = '';
}
function lsBankLogoClear(bankId) {
  if (CS.lifestyle.bankAssets) delete CS.lifestyle.bankAssets[bankId];
  renderLifestyle();
}

/* ── Account lifecycle ── */
function lsOpenAccount(bankId) {
  var bank = _bankById(bankId);
  if (!bank) return;
  var count = (CS.lifestyle.accounts || []).filter(function(a){ return a.bankId === bankId && !a.closed; }).length;
  var acc = {
    id: _bankUid(), bankId: bankId,
    name: bank.name + (count ? ' #' + (count+1) : ''),
    balance: 0, inputs: [], loans: [], ledger: [], feeAccountId: null,
    deposits: [], holdings: [], policies: [], financing: [], escrows: []
  };
  acc.feeAccountId = acc.id; // bank charges its own account by default
  CS.lifestyle.accounts.push(acc);
  CS.lifestyle.activeAccountId = acc.id;
  _finTab = 'liquidity';
  renderLifestyle();
}

function lsCloseAccount(accId) {
  var acc = _accById(accId); if (!acc) return;
  var debt = _accLoanTotal(acc);
  if (debt > 0) {
    if (!confirm('This account still carries ' + debt + ' eb of outstanding loans. Close anyway?')) return;
    if (!confirm('Are you sure? The ' + debt + ' eb debt will be written off the books — but the bank will remember.')) return;
  }
  CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) + (parseFloat(acc.balance)||0);
  CS.lifestyle.accounts = CS.lifestyle.accounts.filter(function(a){ return a.id !== accId; });
  // Detach billing pointers that referenced this account → back to cash
  (CS.lifestyle.services||[]).forEach(function(s){ if (s.accountId === accId) s.accountId = null; });
  (CS.lifestyle.housing||[]).forEach(function(h){ if (h.billAccountId === accId) h.billAccountId = null; });
  (CS.lifestyle.accounts||[]).forEach(function(a){ if (a.feeAccountId === accId) a.feeAccountId = a.id; });
  CS.lifestyle.activeAccountId = 'cash';
  renderLifestyle();
}

function lsSelectAccount(id) { CS.lifestyle.activeAccountId = id; _finTab = 'liquidity'; renderLifestyle(); }
function lsFinTab(tab) { _finTab = tab; renderLifestyle(); }

/* Editable demand deposit */
function lsSetBalance(accId, val) {
  var acc = _accById(accId); if (!acc) return;
  acc.balance = parseFloat(val)||0;
  renderLifestyle();
}

/* Overdraft guard: true if debiting `amt` from acc stays within the overdraft floor */
function _accCanDebit(acc, amt) {
  return (parseFloat(acc.balance)||0) - amt >= -_accTier(acc).overdraft;
}
function _ledgerPush(acc, type, label, amount) {
  acc.ledger = acc.ledger || [];
  acc.ledger.unshift({ id: _bankUid(), type: type, label: label || '', amount: amount });
}

/* ══ Purchases tray ══
   Catalog buys (weapons/gear/cyber/armor/clothing/vehicles) drop a pending line
   here, linked to the inventory object via a shared buyId. A tab peeks from the
   right wall; the panel debits all or a selected subset from cash or any bank
   account, or clears without paying. Removing the item drops its line too. */
function pendPurchase(obj, kind, costOverride) {
  var unit = Math.round(parseFloat(costOverride != null ? costOverride : (obj && obj.cost)) || 0);
  if (!unit || unit <= 0) return;                 // only priced catalog buys
  if (!Array.isArray(CS.pending)) CS.pending = [];
  var id = _bankUid();
  var qty = (obj && obj.qty > 1) ? Math.round(obj.qty) : 1;   // gear can be bought in bulk
  if (obj && typeof obj === 'object') obj.buyId = id;   // link line ↔ inventory item
  CS.pending.push({ id: id, buyId: id, name: (obj && obj.name) || 'Item', unit: unit, qty: qty, cost: unit * qty, kind: kind || '' });
  try { _csPersist(); } catch (e) {}
  renderPending();
}
// All buyIds still present in the inventory (incl. cyber options).
function _inventoryBuyIds() {
  var ids = {};
  function scan(arr) { (arr || []).forEach(function (x) { if (x && x.buyId) ids[x.buyId] = 1; if (x && Array.isArray(x.options)) x.options.forEach(function (o) { if (o && o.buyId) ids[o.buyId] = 1; }); }); }
  scan(CS.weapons); scan(CS.gear); scan(CS.cyberware); scan(CS.wardrobe); scan(CS.vehicles);
  scan((CS.net && CS.net.owned) || []);   // computers live in the device locker, not the gear list
  return ids;
}
function _csCash() { var ls = CS.lifestyle || {}; return parseFloat(ls.cash != null ? ls.cash : (CS.money || 0)) || 0; }
function _pendSelected() {
  var box = document.getElementById('buytray'); if (!box) return [];
  return Array.prototype.slice.call(box.querySelectorAll('input[data-pid]:checked')).map(function (c) { return c.getAttribute('data-pid'); });
}
window.pendToggleTray = function () { var b = document.getElementById('buytray'); if (b) b.classList.toggle('open'); };
window.pendClear = function (all) {
  var ids = all ? (CS.pending || []).map(function (p) { return p.id; }) : _pendSelected();
  if (!ids.length) return;
  CS.pending = (CS.pending || []).filter(function (p) { return ids.indexOf(p.id) < 0; });
  try { _csPersist(); } catch (e) {} renderPending();
};
window.pendDebit = function (all) {
  var ids = all ? (CS.pending || []).map(function (p) { return p.id; }) : _pendSelected();
  if (!ids.length) { alert('Select purchases to debit, or use “Debit all”.'); return; }
  var items = (CS.pending || []).filter(function (p) { return ids.indexOf(p.id) >= 0; });
  var sum = items.reduce(function (t, p) { return t + (p.cost || 0); }, 0);
  var sel = document.getElementById('buytray-src'); var src = sel ? sel.value : 'cash';
  var label = 'Purchases (' + items.length + ')';
  if (src === 'cash') {
    CS.lifestyle = CS.lifestyle || {};
    CS.lifestyle.cash = _csCash() - sum;
  } else {
    var acc = _accById(src); if (!acc) { alert('Account not found.'); return; }
    acc.balance = (parseFloat(acc.balance) || 0) - sum;
    _ledgerPush(acc, 'expense', label, sum);
  }
  CS.pending = (CS.pending || []).filter(function (p) { return ids.indexOf(p.id) < 0; });
  try { applyCS(); } catch (e) {} try { renderCsTabs(); } catch (e) {} try { _csPersist(); } catch (e) {}
  renderPending();
};
function renderPending() {
  if (!document.querySelector('.cs')) return;     // only on the character sheet
  // Reconcile: drop lines whose linked item was removed from the inventory.
  // Only do this when buyIds are actually being tracked on the inventory — in joined
  // (campaign) mode the sheet re-normalizes items on sync and strips buyId, so an empty
  // map must NOT be read as "every item was deleted" (that wiped the whole tray).
  if (CS && Array.isArray(CS.pending) && CS.pending.length) {
    var have = _inventoryBuyIds();
    if (Object.keys(have).length) CS.pending = CS.pending.filter(function (p) { return !p.buyId || have[p.buyId]; });
  }
  var box = document.getElementById('buytray');
  var list = (CS && CS.pending) || [];
  if (!list.length) { if (box) box.parentNode.removeChild(box); return; }
  if (!box) { box = document.createElement('div'); box.id = 'buytray'; document.body.appendChild(box); }
  var total = list.reduce(function (t, p) { return t + (p.cost || 0); }, 0);
  var accs = ((CS.lifestyle && CS.lifestyle.accounts) || []).filter(function (a) { return !a.closed; });
  var srcOpts = '<option value="cash">Cash (' + _csCash().toLocaleString() + 'eb)</option>' +
    accs.map(function (a) { return '<option value="' + a.id + '">' + _esc(a.name) + ' (' + (parseFloat(a.balance) || 0).toLocaleString() + 'eb)</option>'; }).join('');
  box.innerHTML =
    '<button class="buytray-tab" onclick="pendToggleTray()">🛒 ' + list.length + ' · ' + total.toLocaleString() + 'eb</button>' +
    '<div class="buytray-panel">' +
      '<div class="buytray-head">UNPAID PURCHASES</div>' +
      '<div class="buytray-list">' + list.map(function (p) {
        return '<label class="buytray-row"><input type="checkbox" data-pid="' + p.id + '" checked>' +
          '<span class="buytray-name">' + _esc(p.name) + (p.qty > 1 ? ' <b class="buytray-qty">×' + p.qty + '</b>' : '') + (p.kind ? ' <i>' + _esc(p.kind) + '</i>' : '') + '</span>' +
          '<span class="buytray-cost">' + (p.cost || 0).toLocaleString() + 'eb</span></label>';
      }).join('') + '</div>' +
      '<div class="buytray-total">Total <b>' + total.toLocaleString() + 'eb</b></div>' +
      '<div class="buytray-pay">Pay from <select id="buytray-src">' + srcOpts + '</select></div>' +
      '<div class="buytray-acts">' +
        '<button class="buytray-btn buytray-go" onclick="pendDebit(false)">Debit selected</button>' +
        '<button class="buytray-btn buytray-go" onclick="pendDebit(true)">Debit all</button>' +
        '<button class="buytray-btn buytray-clr" onclick="pendClear(false)">Remove sel.</button>' +
        '<button class="buytray-btn buytray-clr" onclick="pendClear(true)">Clear all</button>' +
      '</div>' +
    '</div>';
}

/* ── Regular INPUTs (popup add) ── */
function lsInputModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  _modalOpen('New regular input — ' + acc.name,
    '<label class="cs-modal-lbl">Source</label>' +
    '<input id="m-inp-label" class="cs-modal-inp" placeholder="gig, royalties, allowance…">' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-inp-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<label class="cs-modal-lbl">Frequency</label>' +
    '<select id="m-inp-freq" class="cs-modal-inp"><option value="monthly">monthly</option><option value="weekly">weekly</option></select>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsInputSave(\'' + accId + '\')">Add input</button></div>');
}
function lsInputSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var label = (document.getElementById('m-inp-label')||{}).value || '';
  var amt   = parseFloat((document.getElementById('m-inp-amt')||{}).value) || 0;
  var freq  = (document.getElementById('m-inp-freq')||{}).value || 'monthly';
  if (amt <= 0) { alert('Enter an amount.'); return; }
  acc.inputs.push({ id: _bankUid(), label: label, amount: amt, freq: freq });
  _modalClose(); renderLifestyle();
}
function lsRemoveInput(accId, inputId) {
  var acc = _accById(accId); if (!acc) return;
  acc.inputs = acc.inputs.filter(function(i){ return i.id !== inputId; });
  renderLifestyle();
}
/* Credit an input's amount to the balance immediately (one occurrence). */
function lsApplyInput(accId, inputId) {
  var acc = _accById(accId); if (!acc) return;
  var inp = (acc.inputs||[]).filter(function(i){ return i.id === inputId; })[0];
  if (!inp) return;
  var amt = parseFloat(inp.amount)||0;
  acc.balance = (parseFloat(acc.balance)||0) + amt;
  _ledgerPush(acc, 'income', (inp.label || 'Input') + ' (manual)', amt);
  renderLifestyle();
}

/* ── One-off expense / income (popup) ── */
function lsLedgerModal(accId, kind) {
  var acc = _accById(accId); if (!acc) return;
  var isExp = kind === 'expense';
  _modalOpen((isExp ? 'Record expense' : 'Record income') + ' — ' + acc.name,
    '<label class="cs-modal-lbl">Label</label>' +
    '<input id="m-led-label" class="cs-modal-inp" placeholder="' + (isExp ? 'ripperdoc, bribe, ammo…' : 'job payout, sale…') + '">' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-led-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsLedgerSave(\'' + accId + '\',\'' + kind + '\')">' + (isExp ? 'Debit' : 'Credit') + '</button></div>');
}
function lsLedgerSave(accId, kind) {
  var acc = _accById(accId); if (!acc) return;
  var label = (document.getElementById('m-led-label')||{}).value || '';
  var amt   = parseFloat((document.getElementById('m-led-amt')||{}).value) || 0;
  if (amt <= 0) { alert('Enter an amount.'); return; }
  if (kind === 'expense') {
    if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
    acc.balance = (parseFloat(acc.balance)||0) - amt;
    _ledgerPush(acc, 'expense', label, amt);
  } else {
    acc.balance = (parseFloat(acc.balance)||0) + amt;
    _ledgerPush(acc, 'income', label, amt);
  }
  _modalClose(); renderLifestyle();
}
function lsRemoveLedger(accId, entryId) {
  var acc = _accById(accId); if (!acc) return;
  acc.ledger = (acc.ledger||[]).filter(function(e){ return e.id !== entryId; });
  renderLifestyle();
}

/* ── Loans (multiple, with collateral cap 50×) ── */
function lsLoanModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var rate = (_suggestLoanRate(acc) * 100).toFixed(1);
  _modalOpen('New loan — ' + acc.name,
    '<label class="cs-modal-lbl">Label</label>' +
    '<input id="m-loan-label" class="cs-modal-inp" placeholder="mortgage, gear loan…" value="Loan">' +
    '<label class="cs-modal-lbl">Collateral / guarantee (eb)</label>' +
    '<input id="m-loan-coll" class="cs-modal-inp" type="number" placeholder="0" oninput="_loanCapHint()">' +
    '<label class="cs-modal-lbl">Amount to borrow (eb)</label>' +
    '<input id="m-loan-amt" class="cs-modal-inp" type="number" placeholder="0" oninput="_loanCapHint()">' +
    '<div id="m-loan-cap" class="cs-modal-hint">Max borrow = 50× collateral.</div>' +
    '<label class="cs-modal-lbl">Annual rate (%)</label>' +
    '<input id="m-loan-rate" class="cs-modal-inp" type="number" step="0.1" value="' + rate + '">' +
    '<div class="cs-modal-hint">Suggested by ' + _bankOf(acc).name + ': ' + rate + '% /yr (negotiable).</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsLoanSave(\'' + accId + '\')">Borrow</button></div>');
}
function _loanCapHint() {
  var coll = parseFloat((document.getElementById('m-loan-coll')||{}).value) || 0;
  var amt  = parseFloat((document.getElementById('m-loan-amt')||{}).value) || 0;
  var el = document.getElementById('m-loan-cap'); if (!el) return;
  var max = coll * 50;
  el.textContent = 'Max borrow = 50× collateral = ' + max + ' eb.' + (amt > max ? '  ⚠ over the limit' : '');
  el.className = 'cs-modal-hint' + (amt > max && amt > 0 ? ' warn' : '');
}
function lsLoanSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var label = (document.getElementById('m-loan-label')||{}).value || 'Loan';
  var coll  = parseFloat((document.getElementById('m-loan-coll')||{}).value) || 0;
  var amt   = parseFloat((document.getElementById('m-loan-amt')||{}).value) || 0;
  var rate  = (parseFloat((document.getElementById('m-loan-rate')||{}).value) || 0) / 100;
  if (amt <= 0)        { alert('Enter an amount to borrow.'); return; }
  if (coll <= 0)       { alert('A loan requires collateral.'); return; }
  if (amt > coll * 50) { alert('Refused: the loan cannot exceed 50× the collateral (' + (coll*50) + ' eb).'); return; }
  acc.loans.push({ id: _bankUid(), label: label, principal: amt, rate: rate, collateral: coll });
  acc.balance = (parseFloat(acc.balance)||0) + amt; // disbursed into the account
  _ledgerPush(acc, 'income', 'Loan disbursement: ' + label, amt);
  _modalClose(); renderLifestyle();
}
function lsRepayModal(accId, loanId) {
  var acc = _accById(accId); if (!acc) return;
  var loan = (acc.loans||[]).filter(function(l){ return l.id === loanId; })[0]; if (!loan) return;
  _modalOpen('Repay loan — ' + (loan.label||'Loan'),
    '<div class="cs-modal-hint">Outstanding: <strong>' + (parseFloat(loan.principal)||0) + ' eb</strong></div>' +
    '<label class="cs-modal-lbl">Repay amount (eb)</label>' +
    '<input id="m-repay-amt" class="cs-modal-inp" type="number" placeholder="0" value="' + (parseFloat(loan.principal)||0) + '">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsRepaySave(\'' + accId + '\',\'' + loanId + '\')">Pay down</button></div>');
}
function lsRepaySave(accId, loanId) {
  var acc = _accById(accId); if (!acc) return;
  var loan = (acc.loans||[]).filter(function(l){ return l.id === loanId; })[0]; if (!loan) return;
  var amt = parseFloat((document.getElementById('m-repay-amt')||{}).value) || 0;
  if (amt <= 0) return;
  amt = Math.min(amt, parseFloat(loan.principal)||0);
  if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
  loan.principal = (parseFloat(loan.principal)||0) - amt;
  acc.balance = (parseFloat(acc.balance)||0) - amt;
  _ledgerPush(acc, 'expense', 'Loan repayment: ' + (loan.label||'Loan'), amt);
  if (loan.principal <= 0) acc.loans = acc.loans.filter(function(l){ return l.id !== loanId; });
  _modalClose(); renderLifestyle();
}
function lsSetLoanRate(accId, loanId, val) {
  var acc = _accById(accId); if (!acc) return;
  var loan = (acc.loans||[]).filter(function(l){ return l.id === loanId; })[0]; if (!loan) return;
  loan.rate = (parseFloat(val)||0) / 100;
}

/* ── Transfers (popup): to another account or to an NPC payee ── */
function lsTransferModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var others = (CS.lifestyle.accounts||[]).filter(function(a){ return !a.closed && a.id !== accId; });
  var payees = CS.lifestyle.payees || [];
  if (!others.length && !payees.length) {
    _modalOpen('Transfer — ' + acc.name,
      '<div class="cs-modal-hint">No transfer targets yet. Open another account or add an NPC payee first.</div>' +
      '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Close</button></div>');
    return;
  }
  var opts = others.map(function(a){ return '<option value="acc:' + a.id + '">→ ' + _esc(a.name) + '</option>'; }).join('');
  var pOpts = payees.map(function(p){ return '<option value="payee:' + p.id + '">→ ' + _esc(p.name) + (p.bank?' ('+_esc(p.bank)+')':'') + '</option>'; }).join('');
  _modalOpen('Transfer — ' + acc.name,
    '<label class="cs-modal-lbl">Target</label>' +
    '<select id="m-xfer-tgt" class="cs-modal-inp">' + opts + (pOpts ? '<optgroup label="NPC payees">' + pOpts + '</optgroup>' : '') + '</select>' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-xfer-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<label class="cs-modal-lbl">Memo (optional)</label>' +
    '<input id="m-xfer-memo" class="cs-modal-inp" placeholder="rent, payback…">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsTransferSave(\'' + accId + '\')">Send</button></div>');
}
function lsTransferSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var tgt  = (document.getElementById('m-xfer-tgt')||{}).value || '';
  var amt  = parseFloat((document.getElementById('m-xfer-amt')||{}).value) || 0;
  var memo = (document.getElementById('m-xfer-memo')||{}).value || '';
  if (amt <= 0 || !tgt) return;
  if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
  acc.balance = (parseFloat(acc.balance)||0) - amt;
  if (tgt.indexOf('acc:') === 0) {
    var dest = _accById(tgt.slice(4));
    if (dest) {
      dest.balance = (parseFloat(dest.balance)||0) + amt;
      _ledgerPush(acc,  'xfer-out', 'To ' + dest.name + (memo ? ' — ' + memo : ''), amt);
      _ledgerPush(dest, 'xfer-in',  'From ' + acc.name + (memo ? ' — ' + memo : ''), amt);
    }
  } else if (tgt.indexOf('payee:') === 0) {
    var p = (CS.lifestyle.payees||[]).filter(function(x){ return x.id === tgt.slice(6); })[0];
    _ledgerPush(acc, 'xfer-out', 'To ' + (p ? p.name : 'payee') + (memo ? ' — ' + memo : ''), amt);
    // payee transfers leave the player's books entirely
  }
  _modalClose(); renderLifestyle();
}

/* ── Cash ↔ account (popups from cash view) ── */
function lsMoveModal(kind) {
  var accounts = (CS.lifestyle.accounts||[]).filter(function(a){ return !a.closed; });
  if (!accounts.length) return;
  var isWd = kind === 'withdraw';
  var opts = accounts.map(function(a){ return '<option value="' + a.id + '">' + _esc(a.name) + ' (' + (parseFloat(a.balance)||0) + ' eb)</option>'; }).join('');
  _modalOpen(isWd ? 'Withdraw cash' : 'Deposit cash',
    '<label class="cs-modal-lbl">' + (isWd ? 'From account' : 'To account') + '</label>' +
    '<select id="m-move-acc" class="cs-modal-inp">' + opts + '</select>' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-move-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsMoveSave(\'' + kind + '\')">' + (isWd ? 'Withdraw' : 'Deposit') + '</button></div>');
}
function lsMoveSave(kind) {
  var acc = _accById((document.getElementById('m-move-acc')||{}).value); if (!acc) return;
  var amt = parseFloat((document.getElementById('m-move-amt')||{}).value) || 0;
  if (amt <= 0) return;
  if (kind === 'withdraw') {
    if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
    acc.balance = (parseFloat(acc.balance)||0) - amt;
    CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) + amt;
    _ledgerPush(acc, 'expense', 'Cash withdrawal', amt);
  } else {
    CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) - amt;
    acc.balance = (parseFloat(acc.balance)||0) + amt;
    _ledgerPush(acc, 'income', 'Cash deposit', amt);
  }
  _modalClose(); renderLifestyle();
}

/* ── Service / housing / fee billing pointers ── */
function lsSetHousingAccount(hi, accId) {
  if (CS.lifestyle.housing[hi]) CS.lifestyle.housing[hi].billAccountId = accId || null;
  renderLifestyle();
}
function lsSetFeeAccount(accId, target) {
  var acc = _accById(accId); if (!acc) return;
  acc.feeAccountId = target || null;
  renderLifestyle();
}

/* ── Saved NPC payees (popup add) ── */
function lsPayeeModal() {
  _modalOpen('New NPC payee',
    '<label class="cs-modal-lbl">Name</label>' +
    '<input id="m-payee-name" class="cs-modal-inp" placeholder="fixer, contact, landlord…">' +
    '<label class="cs-modal-lbl">Bank / note (optional)</label>' +
    '<input id="m-payee-bank" class="cs-modal-inp" placeholder="Night City Trust…">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsPayeeSave()">Add payee</button></div>');
}
function lsPayeeSave() {
  var name = ((document.getElementById('m-payee-name')||{}).value || '').trim();
  if (!name) { alert('Enter a name.'); return; }
  var bank = ((document.getElementById('m-payee-bank')||{}).value || '').trim();
  CS.lifestyle.payees.push({ id: _bankUid(), name: name, bank: bank });
  _modalClose(); renderLifestyle();
}
function lsRemovePayee(id) {
  CS.lifestyle.payees = CS.lifestyle.payees.filter(function(p){ return p.id !== id; });
  renderLifestyle();
}

/* ── Loan sharks (cash-side debt, no bank account needed, brutal rates) ── */
function _sharkById(id) { return (CS.lifestyle.sharkLoans||[]).filter(function(s){ return s.id === id; })[0] || null; }
function lsSharkModal() {
  _modalOpen('Borrow on the street',
    '<div class="cs-modal-hint">No account, no collateral, no questions. The shark fronts you cash on hand on the spot &mdash; but the vig is vicious and they always collect.</div>' +
    '<label class="cs-modal-lbl">Lender</label>' +
    '<input id="m-shark-lender" class="cs-modal-inp" placeholder="name / crew (optional)" value="Loan shark">' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-shark-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<label class="cs-modal-lbl">Annual rate (%)</label>' +
    '<input id="m-shark-rate" class="cs-modal-inp" type="number" step="1" value="80">' +
    '<div class="cs-modal-hint">Street rates run 60&ndash;200%+ a year. Interest compounds every End of month.</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsSharkSave()">Take the cash</button></div>');
}
function lsSharkSave() {
  var lender = ((document.getElementById('m-shark-lender')||{}).value || '').trim() || 'Loan shark';
  var amt  = parseFloat((document.getElementById('m-shark-amt')||{}).value) || 0;
  var rate = (parseFloat((document.getElementById('m-shark-rate')||{}).value) || 0) / 100;
  if (amt <= 0) { alert('Enter an amount.'); return; }
  CS.lifestyle.sharkLoans = CS.lifestyle.sharkLoans || [];
  CS.lifestyle.sharkLoans.push({ id: _bankUid(), lender: lender, principal: amt, rate: rate });
  CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) + amt; // cash in hand, right now
  _modalClose(); renderLifestyle();
}
function lsSharkRepayModal(id) {
  var s = _sharkById(id); if (!s) return;
  _modalOpen('Repay ' + _esc(s.lender || 'loan shark'),
    '<div class="cs-modal-hint">Owed: <strong>' + (parseFloat(s.principal)||0) + ' eb</strong> · paid from cash on hand (' + (parseFloat(CS.lifestyle.cash)||0) + ' eb).</div>' +
    '<label class="cs-modal-lbl">Repay amount (eb)</label>' +
    '<input id="m-shark-repay" class="cs-modal-inp" type="number" value="' + (parseFloat(s.principal)||0) + '">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsSharkRepaySave(\'' + id + '\')">Pay</button></div>');
}
function lsSharkRepaySave(id) {
  var s = _sharkById(id); if (!s) return;
  var amt = parseFloat((document.getElementById('m-shark-repay')||{}).value) || 0;
  if (amt <= 0) return;
  amt = Math.min(amt, parseFloat(s.principal)||0);
  if ((parseFloat(CS.lifestyle.cash)||0) < amt) { alert('Not enough cash on hand to pay that.'); return; }
  CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) - amt;
  s.principal = (parseFloat(s.principal)||0) - amt;
  if (s.principal <= 0) CS.lifestyle.sharkLoans = CS.lifestyle.sharkLoans.filter(function(x){ return x.id !== id; });
  _modalClose(); renderLifestyle();
}
function lsRemoveShark(id) {
  var s = _sharkById(id); if (!s) return;
  if ((parseFloat(s.principal)||0) > 0) {
    if (!confirm('Walk away from a ' + s.principal + ' eb debt to ' + (s.lender||'a loan shark') + '? They will remember — and send someone.')) return;
  }
  CS.lifestyle.sharkLoans = (CS.lifestyle.sharkLoans||[]).filter(function(x){ return x.id !== id; });
  renderLifestyle();
}

/* ═══ FINANCIAL PRODUCTS ═══ */

/* ── Term deposits ── */
function lsDepositModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var rate = (Math.max(0.02, _accTier(acc).loanRate * 0.5) * 100).toFixed(1); // savings ≈ half the loan rate
  _modalOpen('New term deposit — ' + acc.name,
    '<label class="cs-modal-lbl">Label</label>' +
    '<input id="m-dep-label" class="cs-modal-inp" placeholder="nest egg, escrow…" value="Term deposit">' +
    '<label class="cs-modal-lbl">Amount to lock (eb)</label>' +
    '<input id="m-dep-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<label class="cs-modal-lbl">Term (months)</label>' +
    '<input id="m-dep-term" class="cs-modal-inp" type="number" value="6">' +
    '<label class="cs-modal-lbl">Annual rate (%)</label>' +
    '<input id="m-dep-rate" class="cs-modal-inp" type="number" step="0.1" value="' + rate + '">' +
    '<div class="cs-modal-hint">Funds are locked until maturity. Early withdrawal forfeits accrued interest plus a 5% penalty.</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsDepositSave(\'' + accId + '\')">Open deposit</button></div>');
}
function lsDepositSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var label = (document.getElementById('m-dep-label')||{}).value || 'Term deposit';
  var amt   = parseFloat((document.getElementById('m-dep-amt')||{}).value) || 0;
  var term  = parseInt((document.getElementById('m-dep-term')||{}).value) || 0;
  var rate  = (parseFloat((document.getElementById('m-dep-rate')||{}).value) || 0) / 100;
  if (amt <= 0) { alert('Enter an amount.'); return; }
  if (term <= 0) { alert('Enter a term in months.'); return; }
  if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
  acc.balance = (parseFloat(acc.balance)||0) - amt;
  acc.deposits.push({ id: _bankUid(), label: label, principal: amt, rate: rate, termMonths: term, monthsElapsed: 0, accrued: 0 });
  _ledgerPush(acc, 'expense', 'Term deposit opened: ' + label, amt);
  _modalClose(); renderLifestyle();
}
function lsDepositWithdraw(accId, depId) {
  var acc = _accById(accId); if (!acc) return;
  var d = (acc.deposits||[]).filter(function(x){ return x.id === depId; })[0]; if (!d) return;
  var matured = (d.monthsElapsed||0) >= (d.termMonths||0);
  var principal = parseFloat(d.principal)||0;
  var accrued = parseFloat(d.accrued)||0;
  var ret;
  if (matured) {
    ret = principal + accrued;
  } else {
    var penalty = Math.round(principal * 0.05);
    ret = principal - penalty; // forfeit accrued interest + 5% penalty
    if (!confirm('Early withdrawal: you forfeit ' + accrued + ' eb interest and pay a ' + penalty + ' eb penalty. Proceed?')) return;
  }
  acc.balance = (parseFloat(acc.balance)||0) + ret;
  _ledgerPush(acc, 'income', (matured ? 'Deposit matured: ' : 'Deposit withdrawn early: ') + (d.label||''), ret);
  acc.deposits = acc.deposits.filter(function(x){ return x.id !== depId; });
  renderLifestyle();
}

/* ── Investment: corp shares ── */
function lsBuyModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var month = CS.lifestyle.month || 0;
  var corps = (DB && DB.corporations ? DB.corporations : []).slice(0, 400);
  var dl = corps.map(function(c){ return '<option value="' + _esc(c.name) + '">'; }).join('');
  _modalOpen('Buy shares — ' + acc.name,
    '<label class="cs-modal-lbl">Corporation</label>' +
    '<input id="m-buy-corp" class="cs-modal-inp" list="m-buy-corps" placeholder="type a corp name…" oninput="_buyQuote(\'' + accId + '\')">' +
    '<datalist id="m-buy-corps">' + dl + '</datalist>' +
    '<div id="m-buy-price" class="cs-modal-hint">Pick a corporation to see its share price.</div>' +
    '<label class="cs-modal-lbl">Shares</label>' +
    '<input id="m-buy-shares" class="cs-modal-inp" type="number" placeholder="0" oninput="_buyQuote(\'' + accId + '\')">' +
    '<div id="m-buy-cost" class="cs-modal-hint"></div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsBuySave(\'' + accId + '\')">Buy</button></div>');
}
function _buyQuote(accId) {
  var acc = _accById(accId); if (!acc) return;
  var corp = (document.getElementById('m-buy-corp')||{}).value || '';
  var shares = parseFloat((document.getElementById('m-buy-shares')||{}).value) || 0;
  var pEl = document.getElementById('m-buy-price'); var cEl = document.getElementById('m-buy-cost');
  if (!corp) { if (pEl) pEl.textContent = 'Pick a corporation to see its share price.'; if (cEl) cEl.textContent = ''; return; }
  var price = _corpPrice(corp, CS.lifestyle.month || 0);
  if (pEl) pEl.textContent = corp + ' @ ' + price + ' eb/share';
  if (cEl && shares > 0) {
    var comm = Math.round(price * shares * _tradeCommission(acc));
    cEl.textContent = 'Cost: ' + Math.round(price * shares) + ' eb + ' + comm + ' eb commission = ' + (Math.round(price * shares) + comm) + ' eb';
  } else if (cEl) cEl.textContent = '';
}
function lsBuySave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var corp = ((document.getElementById('m-buy-corp')||{}).value || '').trim();
  var shares = parseFloat((document.getElementById('m-buy-shares')||{}).value) || 0;
  if (!corp || shares <= 0) { alert('Enter a corporation and a number of shares.'); return; }
  var price = _corpPrice(corp, CS.lifestyle.month || 0);
  var gross = price * shares;
  var total = gross + gross * _tradeCommission(acc);
  if (!_accCanDebit(acc, total)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
  acc.balance = (parseFloat(acc.balance)||0) - total;
  var existing = (acc.holdings||[]).filter(function(h){ return h.corp === corp; })[0];
  if (existing) { existing.costBasis = (parseFloat(existing.costBasis)||0) + total; existing.shares += shares; }
  else acc.holdings.push({ id: _bankUid(), corp: corp, shares: shares, costBasis: total });
  _ledgerPush(acc, 'expense', 'Bought ' + shares + ' ' + corp, Math.round(total));
  _modalClose(); renderLifestyle();
}
function lsSellHolding(accId, holdId) {
  var acc = _accById(accId); if (!acc) return;
  var h = (acc.holdings||[]).filter(function(x){ return x.id === holdId; })[0]; if (!h) return;
  var price = _corpPrice(h.corp, CS.lifestyle.month || 0);
  var gross = price * h.shares;
  var net = Math.round(gross - gross * _tradeCommission(acc));
  if (!confirm('Sell ' + h.shares + ' ' + h.corp + ' @ ' + price + ' eb for ' + net + ' eb (net of commission)?')) return;
  acc.balance = (parseFloat(acc.balance)||0) + net;
  _ledgerPush(acc, 'income', 'Sold ' + h.shares + ' ' + h.corp, net);
  acc.holdings = acc.holdings.filter(function(x){ return x.id !== holdId; });
  renderLifestyle();
}

/* ── Insurance ── */
function lsPolicyModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var types = ['Life','Cyberware & Gear','Medical','Liability'];
  var opts = types.map(function(t){ return '<option>' + t + '</option>'; }).join('');
  _modalOpen('New insurance policy — ' + acc.name,
    '<label class="cs-modal-lbl">Type</label>' +
    '<select id="m-pol-type" class="cs-modal-inp">' + opts + '</select>' +
    '<label class="cs-modal-lbl">Monthly premium (eb)</label>' +
    '<input id="m-pol-prem" class="cs-modal-inp" type="number" placeholder="0">' +
    '<label class="cs-modal-lbl">Coverage / payout cap (eb)</label>' +
    '<input id="m-pol-cov" class="cs-modal-inp" type="number" placeholder="0">' +
    '<div class="cs-modal-hint">The premium is billed to this account each End-of-Month. Claims are adjudicated by the GM.</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsPolicySave(\'' + accId + '\')">Subscribe</button></div>');
}
function lsPolicySave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var type = (document.getElementById('m-pol-type')||{}).value || 'Life';
  var prem = parseFloat((document.getElementById('m-pol-prem')||{}).value) || 0;
  var cov  = parseFloat((document.getElementById('m-pol-cov')||{}).value) || 0;
  if (prem <= 0) { alert('Enter a premium.'); return; }
  acc.policies.push({ id: _bankUid(), type: type, premium: prem, coverage: cov, active: true });
  _modalClose(); renderLifestyle();
}
function lsCancelPolicy(accId, polId) {
  var acc = _accById(accId); if (!acc) return;
  acc.policies = acc.policies.filter(function(p){ return p.id !== polId; });
  renderLifestyle();
}
function lsFileClaim(accId, polId) {
  var acc = _accById(accId); if (!acc) return;
  var p = (acc.policies||[]).filter(function(x){ return x.id === polId; })[0]; if (!p) return;
  _modalOpen('File a claim — ' + p.type,
    '<div class="cs-modal-hint">Coverage cap: <strong>' + (parseFloat(p.coverage)||0) + ' eb</strong>. The GM sets the actual payout.</div>' +
    '<label class="cs-modal-lbl">Payout amount (eb)</label>' +
    '<input id="m-claim-amt" class="cs-modal-inp" type="number" value="' + (parseFloat(p.coverage)||0) + '">' +
    '<label class="cs-modal-lbl"><input type="checkbox" id="m-claim-end"> Close policy after payout</label>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsClaimSave(\'' + accId + '\',\'' + polId + '\')">Pay out</button></div>');
}
function lsClaimSave(accId, polId) {
  var acc = _accById(accId); if (!acc) return;
  var p = (acc.policies||[]).filter(function(x){ return x.id === polId; })[0]; if (!p) return;
  var amt = parseFloat((document.getElementById('m-claim-amt')||{}).value) || 0;
  var end = (document.getElementById('m-claim-end')||{}).checked;
  if (amt <= 0) return;
  acc.balance = (parseFloat(acc.balance)||0) + amt;
  _ledgerPush(acc, 'income', 'Insurance claim: ' + p.type, amt);
  if (end) acc.policies = acc.policies.filter(function(x){ return x.id !== polId; });
  _modalClose(); renderLifestyle();
}

/* ── Cyberware financing (chrome on credit) ── */
function lsFinanceModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var cw = (DB && DB.cyberware ? DB.cyberware : []);
  var dl = cw.slice(0, 800).map(function(c){ return '<option value="' + _esc(c.name) + '">'; }).join('');
  var rate = (_accTier(acc).loanRate * 100).toFixed(1);
  _modalOpen('Finance cyberware — ' + acc.name,
    '<label class="cs-modal-lbl">Item</label>' +
    '<input id="m-fin-item" class="cs-modal-inp" list="m-fin-items" placeholder="type a cyberware name…" oninput="_finFill(\'' + accId + '\')">' +
    '<datalist id="m-fin-items">' + dl + '</datalist>' +
    '<label class="cs-modal-lbl">Price financed (eb)</label>' +
    '<input id="m-fin-amt" class="cs-modal-inp" type="number" placeholder="0" oninput="_finFill(\'' + accId + '\',true)">' +
    '<label class="cs-modal-lbl">Term (months)</label>' +
    '<input id="m-fin-term" class="cs-modal-inp" type="number" value="12" oninput="_finFill(\'' + accId + '\',true)">' +
    '<label class="cs-modal-lbl">Annual rate (%)</label>' +
    '<input id="m-fin-rate" class="cs-modal-inp" type="number" step="0.1" value="' + rate + '" oninput="_finFill(\'' + accId + '\',true)">' +
    '<div id="m-fin-monthly" class="cs-modal-hint"></div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsFinanceSave(\'' + accId + '\')">Finance it</button></div>');
}
function _finMonthly(principal, rate, term) {
  if (term <= 0) return 0;
  var r = rate / 12;
  if (r <= 0) return Math.round(principal / term);
  return Math.round(principal * r / (1 - Math.pow(1 + r, -term)));
}
function _finFill(accId, keepItem) {
  if (!keepItem) {
    var name = (document.getElementById('m-fin-item')||{}).value || '';
    var cw = (DB && DB.cyberware ? DB.cyberware : []).filter(function(c){ return c.name === name; })[0];
    if (cw && cw.cost) { var amtEl = document.getElementById('m-fin-amt'); if (amtEl) amtEl.value = cw.cost; }
  }
  var amt  = parseFloat((document.getElementById('m-fin-amt')||{}).value) || 0;
  var term = parseInt((document.getElementById('m-fin-term')||{}).value) || 0;
  var rate = (parseFloat((document.getElementById('m-fin-rate')||{}).value) || 0) / 100;
  var el = document.getElementById('m-fin-monthly'); if (!el) return;
  el.textContent = amt > 0 && term > 0 ? ('Monthly payment: ' + _finMonthly(amt, rate, term) + ' eb × ' + term + ' months') : '';
}
function lsFinanceSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var item = ((document.getElementById('m-fin-item')||{}).value || '').trim() || 'Cyberware';
  var amt  = parseFloat((document.getElementById('m-fin-amt')||{}).value) || 0;
  var term = parseInt((document.getElementById('m-fin-term')||{}).value) || 0;
  var rate = (parseFloat((document.getElementById('m-fin-rate')||{}).value) || 0) / 100;
  if (amt <= 0 || term <= 0) { alert('Enter a price and term.'); return; }
  var monthly = _finMonthly(amt, rate, term);
  acc.financing.push({ id: _bankUid(), item: item, principal: amt, rate: rate, monthly: monthly, remaining: term });
  _modalClose(); renderLifestyle();
}
function lsRepayFinancing(accId, finId) {
  var acc = _accById(accId); if (!acc) return;
  var f = (acc.financing||[]).filter(function(x){ return x.id === finId; })[0]; if (!f) return;
  var payoff = (parseFloat(f.monthly)||0) * (parseInt(f.remaining)||0);
  if (!confirm('Settle ' + f.item + ' early for ' + payoff + ' eb?')) return;
  if (!_accCanDebit(acc, payoff)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
  acc.balance = (parseFloat(acc.balance)||0) - payoff;
  _ledgerPush(acc, 'expense', 'Financing settled: ' + f.item, payoff);
  acc.financing = acc.financing.filter(function(x){ return x.id !== finId; });
  renderLifestyle();
}

/* ── Laundering (traceable ↔ untraceable cash) ── */
function lsLaunderModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  var feePct = (_launderFeeRate(acc) * 100).toFixed(0);
  _modalOpen('Launder funds — ' + acc.name,
    '<label class="cs-modal-lbl">Direction</label>' +
    '<select id="m-laund-dir" class="cs-modal-inp">' +
      '<option value="out">Account → untraceable cash</option>' +
      '<option value="in">Cash → clean account funds</option>' +
    '</select>' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-laund-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<div class="cs-modal-hint">Commission: ' + feePct + '%. Cash side is untraceable (added to / taken from cash on hand).</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsLaunderSave(\'' + accId + '\')">Run it</button></div>');
}
function lsLaunderSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var dir = (document.getElementById('m-laund-dir')||{}).value || 'out';
  var amt = parseFloat((document.getElementById('m-laund-amt')||{}).value) || 0;
  if (amt <= 0) return;
  var fee = Math.round(amt * _launderFeeRate(acc));
  if (dir === 'out') {
    if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
    acc.balance = (parseFloat(acc.balance)||0) - amt;
    CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) + (amt - fee);
    _ledgerPush(acc, 'expense', 'Laundered to cash (−' + fee + ' fee)', amt);
  } else {
    if ((parseFloat(CS.lifestyle.cash)||0) < amt) { alert('Not enough cash on hand.'); return; }
    CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) - amt;
    acc.balance = (parseFloat(acc.balance)||0) + (amt - fee);
    _ledgerPush(acc, 'income', 'Cleaned from cash (−' + fee + ' fee)', amt - fee);
  }
  _modalClose(); renderLifestyle();
}

/* ── Contract escrow ── */
function lsEscrowModal(accId) {
  var acc = _accById(accId); if (!acc) return;
  _modalOpen('New escrow — ' + acc.name,
    '<label class="cs-modal-lbl">Label</label>' +
    '<input id="m-esc-label" class="cs-modal-inp" placeholder="job payment, deal deposit…">' +
    '<label class="cs-modal-lbl">Direction</label>' +
    '<select id="m-esc-dir" class="cs-modal-inp">' +
      '<option value="in">Incoming — held for you, released to this account</option>' +
      '<option value="out">Outgoing — you deposit now, released to the other party</option>' +
    '</select>' +
    '<label class="cs-modal-lbl">Amount (eb)</label>' +
    '<input id="m-esc-amt" class="cs-modal-inp" type="number" placeholder="0">' +
    '<div class="cs-modal-hint">Outgoing escrow debits this account now and is locked until released.</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lsEscrowSave(\'' + accId + '\')">Create escrow</button></div>');
}
function lsEscrowSave(accId) {
  var acc = _accById(accId); if (!acc) return;
  var label = (document.getElementById('m-esc-label')||{}).value || 'Escrow';
  var dir = (document.getElementById('m-esc-dir')||{}).value || 'in';
  var amt = parseFloat((document.getElementById('m-esc-amt')||{}).value) || 0;
  if (amt <= 0) { alert('Enter an amount.'); return; }
  if (dir === 'out') {
    if (!_accCanDebit(acc, amt)) { alert('Refused: would exceed the ' + _accTier(acc).overdraft + ' eb overdraft limit.'); return; }
    acc.balance = (parseFloat(acc.balance)||0) - amt;
    _ledgerPush(acc, 'expense', 'Escrow deposited: ' + label, amt);
  }
  acc.escrows.push({ id: _bankUid(), label: label, amount: amt, direction: dir, status: 'open' });
  _modalClose(); renderLifestyle();
}
function lsReleaseEscrow(accId, escId) {
  var acc = _accById(accId); if (!acc) return;
  var e = (acc.escrows||[]).filter(function(x){ return x.id === escId; })[0]; if (!e) return;
  if (e.direction === 'in') {
    acc.balance = (parseFloat(acc.balance)||0) + (parseFloat(e.amount)||0);
    _ledgerPush(acc, 'income', 'Escrow released: ' + e.label, parseFloat(e.amount)||0);
  } else {
    _ledgerPush(acc, 'xfer-out', 'Escrow paid out: ' + e.label, parseFloat(e.amount)||0);
  }
  acc.escrows = acc.escrows.filter(function(x){ return x.id !== escId; });
  renderLifestyle();
}
function lsCancelEscrow(accId, escId) {
  var acc = _accById(accId); if (!acc) return;
  var e = (acc.escrows||[]).filter(function(x){ return x.id === escId; })[0]; if (!e) return;
  // Outgoing escrow refunds the locked amount back to the account
  if (e.direction === 'out') {
    acc.balance = (parseFloat(acc.balance)||0) + (parseFloat(e.amount)||0);
    _ledgerPush(acc, 'income', 'Escrow cancelled (refund): ' + e.label, parseFloat(e.amount)||0);
  }
  acc.escrows = acc.escrows.filter(function(x){ return x.id !== escId; });
  renderLifestyle();
}

/* ═══ LIFEPATH — background, motivations, life events ═══ */
function _lp() {
  CS.lifepath = CS.lifepath || { fields:{}, events:[] };
  CS.lifepath.fields = CS.lifepath.fields || {};
  CS.lifepath.events = CS.lifepath.events || [];
  if (CS.lifepath.freeform == null) CS.lifepath.freeform = '';
  CS.lifepath.rolled = CS.lifepath.rolled || {};       // keys filled by a roll (re-rollable)
  CS.lifepath.collapsed = CS.lifepath.collapsed || {}; // collapsed category state
  return CS.lifepath;
}

function renderLifepath() {
  var el = document.getElementById('lifepath-list'); if (!el) return;
  var lp = _lp();

  function _cToggle(key) {
    var col = !!lp.collapsed[key];
    return '<span class="lp-collapse' + (col?' lp-collapsed':'') + '" title="' + (col?'Expand':'Collapse') + '" onclick="lpToggleGroup(\'' + key + '\')">&#9662;</span>';
  }

  var groups = _LP_GROUPS.map(function(g) {
    var collapsed = !!lp.collapsed[g[0]];
    var rows = _LIFEPATH_FIELDS.filter(function(f){ return f.group === g[0]; }).map(function(f) {
      var val = lp.fields[f.key] || '';
      var rollBtn = f.table ? '<span class="lp-die" title="Roll this field" onclick="lpRollField(\'' + f.key + '\')">&#9860;</span>' : '<span class="lp-die lp-die-off">&mdash;</span>';
      var input = f.long
        ? '<textarea class="lp-input cs-modal-area" placeholder="' + _esc(f.label) + '..." oninput="lpSetField(\'' + f.key + '\',this.value)">' + _esc(val) + '</textarea>'
        : '<input class="lp-input" value="' + _esc(val) + '" placeholder="' + _esc(f.label) + '..." oninput="lpSetField(\'' + f.key + '\',this.value)">';
      return '<div class="lp-row"><span class="lp-label">' + f.label + '</span>' + input + rollBtn + '</div>';
    }).join('');
    return '<div class="lp-group' + (collapsed?' lp-group-collapsed':'') + '" data-group="' + g[0] + '">' +
      '<div class="lp-group-head">' + _cToggle(g[0]) + g[1] + '</div>' +
      (collapsed ? '' : rows) +
    '</div>';
  }).join('');

  var events = (lp.events || []).slice().sort(function(a,b){ return (parseInt(a.age)||0) - (parseInt(b.age)||0); });
  var eventRows = events.length ? events.map(function(ev) {
    return '<div class="lp-event">' +
      '<input class="lp-event-age" type="number" value="' + (ev.age==='' ? '' : ev.age) + '" placeholder="age" oninput="lpSetEvent(\'' + ev.id + '\',\'age\',this.value)">' +
      '<textarea class="lp-event-text cs-modal-area" oninput="lpSetEvent(\'' + ev.id + '\',\'text\',this.value)">' + _esc(ev.text||'') + '</textarea>' +
      '<span class="ls-rm" onclick="lpRemoveEvent(\'' + ev.id + '\')">&#10005;</span>' +
    '</div>';
  }).join('') : '<div class="net-empty">No life events yet. Roll a year, roll by age, or add one.</div>';

  var evCollapsed = !!lp.collapsed.events;

  el.innerHTML =
    '<textarea class="lp-freeform" placeholder="Write your character\'s story freely — concept, vibe, anything..." oninput="lpSetFreeform(this.value)">' + _esc(lp.freeform||'') + '</textarea>' +
    '<div class="lp-toolbar">' +
      '<button class="btn btn-sm" onclick="lpRollAll()" title="Fill blanks and re-roll previously rolled fields; your typed entries are kept">&#9860; Roll all</button>' +
    '</div>' +
    '<div class="lp-fields">' + groups + '</div>' +
    '<div class="lp-events-block' + (evCollapsed?' lp-group-collapsed':'') + '">' +
      '<div class="lp-group-head lp-events-head">' + _cToggle('events') + 'Life Events' +
        '<span class="lp-events-actions">' +
          '<button class="btn btn-sm" onclick="lpRollYear()">&#9860; Roll a year</button>' +
          '<button class="btn btn-sm" onclick="lpRollByAge()">Roll by age</button>' +
          '<button class="btn btn-sm" onclick="lpAddEventModal()">+ Add</button>' +
        '</span>' +
      '</div>' +
      (evCollapsed ? '' : eventRows) +
    '</div>';
}

function lpSetFreeform(val) { _lp().freeform = val; }
function lpToggleGroup(key) { var lp = _lp(); lp.collapsed[key] = !lp.collapsed[key]; renderLifepath(); }
function lpSetField(key, val) { var lp = _lp(); lp.fields[key] = val; delete lp.rolled[key]; } // typed = no longer a roll
function lpRollField(key) {
  var f = _LIFEPATH_FIELDS.filter(function(x){ return x.key === key; })[0];
  if (!f || !f.table) return;
  var lp = _lp();
  lp.fields[key] = _lpPick(f.table);
  lp.rolled[key] = true;
  renderLifepath();
}
/* Fill blank fields and re-roll any field previously set by a roll; keep typed entries. */
function lpRollAll() {
  var lp = _lp();
  _LIFEPATH_FIELDS.forEach(function(f) {
    if (!f.table) return;
    var empty = !(lp.fields[f.key] || '').trim();
    if (empty || lp.rolled[f.key]) { lp.fields[f.key] = _lpPick(f.table); lp.rolled[f.key] = true; }
  });
  renderLifepath();
}
function _lpCurrentAge() {
  var el = document.getElementById('cs-age');
  return parseInt(el && el.value) || parseInt(CS.age) || 0;
}
function lpRollYear() {
  var lp = _lp();
  var age = lp.events.length ? (Math.max.apply(null, lp.events.map(function(e){ return parseInt(e.age)||16; })) + 1) : 16;
  lp.events.push(_lpGenEvent(age));
  renderLifepath();
}
function lpRollByAge() {
  var lp = _lp();
  var target = Math.max(0, _lpCurrentAge() - 16);
  if (!target) { alert('Set an Age (16+) in Identity first, or use Roll a year.'); return; }
  var start = 16 + lp.events.length;
  for (var a = start; a < 16 + target; a++) lp.events.push(_lpGenEvent(a));
  renderLifepath();
}
function lpAddEventModal() {
  _modalOpen('Add life event',
    '<label class="cs-modal-lbl">Age</label>' +
    '<input id="m-lp-age" class="cs-modal-inp" type="number" placeholder="age">' +
    '<label class="cs-modal-lbl">What happened</label>' +
    '<textarea id="m-lp-text" class="cs-modal-inp cs-modal-area" placeholder="the event..."></textarea>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="lpSaveEvent()">Add</button></div>');
}
function lpSaveEvent() {
  var age  = (document.getElementById('m-lp-age')||{}).value || '';
  var text = ((document.getElementById('m-lp-text')||{}).value || '').trim();
  if (!text) { alert('Describe the event.'); return; }
  _lp().events.push({ id:_bankUid(), age: age==='' ? '' : (parseInt(age)||''), text: text });
  _modalClose(); renderLifepath();
}
function lpSetEvent(id, field, val) {
  var ev = _lp().events.filter(function(e){ return e.id === id; })[0]; if (!ev) return;
  ev[field] = (field === 'age') ? (val==='' ? '' : (parseInt(val)||'')) : val;
}
function lpRemoveEvent(id) {
  _lp().events = _lp().events.filter(function(e){ return e.id !== id; });
  renderLifepath();
}

/* ═══ NETWORK & GIGS — contacts, fixers, job board ═══ */
var CONTACT_TYPES  = ['Fixer','Friend','Enemy','Lover','Ripperdoc','Medtech','Netrunner','Cop','Corp','Gang','Media','Other'];
var CONTACT_ATTS   = ['Allied','Friendly','Neutral','Wary','Hostile'];
var JOB_RISKS      = ['Low','Medium','High','Suicide'];
var JOB_STATUSES   = ['offered','active','done','paid','failed'];

function renderNetwork() { renderContacts(); renderJobs(); }
function _fixers() { return (CS.contacts||[]).filter(function(c){ return c.type === 'Fixer'; }); }
function _contactById(id) { return (CS.contacts||[]).filter(function(c){ return c.id === id; })[0] || null; }

/* ── Contacts ── */
function renderContacts() {
  var el = document.getElementById('contacts-list'); if (!el) return;
  if (!(CS.contacts||[]).length) { el.innerHTML = '<div class="net-empty">No contacts yet.</div>'; return; }
  el.innerHTML = CS.contacts.map(function(c) {
    return '<div class="net-card' + (c.type==='Fixer'?' is-fixer':'') + '">' +
      '<div class="net-card-top">' +
        '<span class="net-name">' + _esc(c.name||'(unnamed)') + '</span>' +
        '<span class="net-type t-' + (c.type||'Other').toLowerCase() + '">' + _esc(c.type||'Other') + '</span>' +
        '<span class="net-att att-' + (c.attitude||'Neutral').toLowerCase() + '">' + _esc(c.attitude||'Neutral') + '</span>' +
        '<span class="ls-rm" onclick="removeContact(\'' + c.id + '\')">✕</span>' +
      '</div>' +
      (c.org ? '<div class="net-sub">' + _esc(c.org) + '</div>' : '') +
      (c.relationship ? '<div class="net-notes">' + _esc(c.relationship) + '</div>' : '') +
      ((c.description||c.notes) ? '<div class="net-notes">' + _esc(c.description||c.notes) + '</div>' : '') +
      '<div class="net-card-actions"><span class="net-edit" onclick="addContactModal(\'' + c.id + '\')">edit</span></div>' +
    '</div>';
  }).join('');
}
function addContactModal(id) {
  var c = id ? _contactById(id) : null;
  var typeOpts = CONTACT_TYPES.map(function(t){ return '<option' + (c&&c.type===t?' selected':'') + '>' + t + '</option>'; }).join('');
  var attOpts  = CONTACT_ATTS.map(function(t){ return '<option' + (c&&c.attitude===t?' selected':(!c&&t==='Neutral'?' selected':'')) + '>' + t + '</option>'; }).join('');
  _modalOpen((c?'Edit':'New') + ' contact',
    '<label class="cs-modal-lbl">Name</label>' +
    '<input id="m-c-name" class="cs-modal-inp" value="' + _esc(c?c.name:'') + '" placeholder="handle / name">' +
    '<label class="cs-modal-lbl">Type</label><select id="m-c-type" class="cs-modal-inp">' + typeOpts + '</select>' +
    '<label class="cs-modal-lbl">Attitude</label><select id="m-c-att" class="cs-modal-inp">' + attOpts + '</select>' +
    '<label class="cs-modal-lbl">Org / affiliation</label>' +
    '<input id="m-c-org" class="cs-modal-inp" value="' + _esc(c?c.org:'') + '" placeholder="optional">' +
    '<label class="cs-modal-lbl">Relationship</label>' +
    '<textarea id="m-c-rel" class="cs-modal-inp cs-modal-area" placeholder="how you know them">' + _esc(c?c.relationship:'') + '</textarea>' +
    '<label class="cs-modal-lbl">Description</label>' +
    '<textarea id="m-c-desc" class="cs-modal-inp cs-modal-area" placeholder="optional">' + _esc(c?(c.description||c.notes):'') + '</textarea>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="saveContact(' + (c?('\''+c.id+'\''):'null') + ')">Save</button></div>');
}
function saveContact(id) {
  var v = function(x){ return (document.getElementById(x)||{}).value || ''; };
  var name = v('m-c-name').trim(); if (!name) { alert('Enter a name.'); return; }
  var data = { name:name, type:v('m-c-type'), attitude:v('m-c-att'), relationship:v('m-c-rel').trim(), org:v('m-c-org').trim(), description:v('m-c-desc').trim() };
  var c = id ? _contactById(id) : null;
  if (c) { Object.assign(c, data); delete c.notes; }
  else { data.id = _bankUid(); CS.contacts.push(data); }
  _modalClose(); renderNetwork();
}
function removeContact(id) {
  CS.contacts = (CS.contacts||[]).filter(function(c){ return c.id !== id; });
  (CS.jobs||[]).forEach(function(j){ if (j.fixerId === id) j.fixerId = null; });
  renderNetwork();
}

/* ── Job board ── */
function _jobById(id) { return (CS.jobs||[]).filter(function(j){ return j.id === id; })[0] || null; }
function renderJobs() {
  var el = document.getElementById('jobs-list'); if (!el) return;
  if (!(CS.jobs||[]).length) { el.innerHTML = '<div class="net-empty">No gigs on the board.</div>'; return; }
  el.innerHTML = CS.jobs.map(function(j) {
    var fixer = j.fixerId ? _contactById(j.fixerId) : null;
    var srcLabel = j.source === 'corp' ? 'corp' : (fixer ? 'via ' + _esc(fixer.name) : (j.source==='fixer'?'fixer':'manual'));
    var net = Math.round((parseFloat(j.pay)||0) * (1 - (parseFloat(j.fixerCutPct)||0)/100));
    var canCollect = j.status === 'done';
    return '<div class="net-card job-' + (j.status||'offered') + '">' +
      '<div class="net-card-top">' +
        '<span class="net-name">' + _esc(j.title||'(untitled gig)') + '</span>' +
        '<span class="net-src">' + srcLabel + '</span>' +
        '<span class="job-risk r-' + (j.risk||'Medium').toLowerCase() + '">' + _esc(j.risk||'Medium') + '</span>' +
        '<span class="job-status s-' + (j.status||'offered') + '">' + (j.status||'offered') + '</span>' +
        '<span class="ls-rm" onclick="removeJob(\'' + j.id + '\')">✕</span>' +
      '</div>' +
      '<div class="net-sub">' + _esc(j.client||'—') + ' · ' + (parseFloat(j.pay)||0) + ' eb' + (j.payType==='per month'?'/mo':'') +
        ((parseFloat(j.fixerCutPct)||0)>0 ? ' (cut ' + j.fixerCutPct + '% → net ' + net + ')' : '') +
        (j.deadline ? ' · ' + _esc(j.deadline) : '') + '</div>' +
      (j.description ? '<div class="net-notes">' + _esc(j.description) + '</div>' : '') +
      '<div class="net-card-actions">' +
        _jobStatusBtns(j) +
        (canCollect ? '<span class="net-edit net-collect" onclick="collectJobModal(\'' + j.id + '\')">collect payout</span>' : '') +
        '<span class="net-edit" onclick="addJobModal(\'' + j.id + '\')">edit</span>' +
      '</div>' +
    '</div>';
  }).join('');
}
function _jobStatusBtns(j) {
  var flow = { offered:'active', active:'done' };
  var nxt = flow[j.status];
  var out = '';
  if (nxt) out += '<span class="net-edit" onclick="setJobStatus(\'' + j.id + '\',\'' + nxt + '\')">→ ' + nxt + '</span>';
  if (j.status !== 'failed' && j.status !== 'paid') out += '<span class="net-edit net-fail" onclick="setJobStatus(\'' + j.id + '\',\'failed\')">failed</span>';
  return out;
}
function setJobStatus(id, status) { var j = _jobById(id); if (j) { j.status = status; renderJobs(); } }
function removeJob(id) { CS.jobs = (CS.jobs||[]).filter(function(j){ return j.id !== id; }); renderJobs(); }

function addJobModal(id) {
  var j = id ? _jobById(id) : null;
  var riskOpts = JOB_RISKS.map(function(r){ return '<option' + (j&&j.risk===r?' selected':(!j&&r==='Medium'?' selected':'')) + '>' + r + '</option>'; }).join('');
  var fx = _fixers();
  var fixerOpts = '<option value="">— no fixer —</option>' + fx.map(function(c){ return '<option value="' + c.id + '"' + (j&&j.fixerId===c.id?' selected':'') + '>' + _esc(c.name) + '</option>'; }).join('');
  var corpList = (DB && DB.corporations ? DB.corporations : []).slice(0,400).map(function(c){ return '<option value="' + _esc(c.name) + '">'; }).join('');
  _modalOpen((j?'Edit':'New') + ' gig',
    '<label class="cs-modal-lbl">Title</label>' +
    '<input id="m-j-title" class="cs-modal-inp" value="' + _esc(j?j.title:'') + '" placeholder="the run">' +
    '<label class="cs-modal-lbl">Client</label>' +
    '<input id="m-j-client" class="cs-modal-inp" list="m-j-corps" value="' + _esc(j?j.client:'') + '" placeholder="corp / employer">' +
    '<datalist id="m-j-corps">' + corpList + '</datalist>' +
    '<label class="cs-modal-lbl">Fixer (broker)</label><select id="m-j-fixer" class="cs-modal-inp">' + fixerOpts + '</select>' +
    '<label class="cs-modal-lbl">Pay (eb)</label>' +
    '<input id="m-j-pay" class="cs-modal-inp" type="number" value="' + (j?j.pay:'') + '" placeholder="0">' +
    '<label class="cs-modal-lbl">Fixer cut (%)</label>' +
    '<input id="m-j-cut" class="cs-modal-inp" type="number" value="' + (j?(j.fixerCutPct||0):10) + '">' +
    '<label class="cs-modal-lbl">Risk</label><select id="m-j-risk" class="cs-modal-inp">' + riskOpts + '</select>' +
    '<label class="cs-modal-lbl">Deadline</label>' +
    '<input id="m-j-deadline" class="cs-modal-inp" value="' + _esc(j?j.deadline:'') + '" placeholder="optional">' +
    '<label class="cs-modal-lbl">Description</label>' +
    '<input id="m-j-desc" class="cs-modal-inp" value="' + _esc(j?j.description:'') + '" placeholder="optional">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="saveJob(' + (j?('\''+j.id+'\''):'null') + ')">Save</button></div>');
}
function saveJob(id) {
  var v = function(x){ return (document.getElementById(x)||{}).value || ''; };
  var title = v('m-j-title').trim(); if (!title) { alert('Enter a title.'); return; }
  var fixerId = v('m-j-fixer') || null;
  var data = { title:title, client:v('m-j-client').trim(), fixerId:fixerId,
    pay:parseFloat(v('m-j-pay'))||0, payType:'flat', fixerCutPct:parseFloat(v('m-j-cut'))||0,
    risk:v('m-j-risk'), deadline:v('m-j-deadline').trim(), description:v('m-j-desc').trim() };
  var j = id ? _jobById(id) : null;
  if (j) { Object.assign(j, data); }
  else { data.id = _bankUid(); data.status = 'offered'; data.source = fixerId ? 'fixer' : 'manual'; CS.jobs.push(data); }
  _modalClose(); renderJobs();
}

/* ── Collect payout → banking ── */
function collectJobModal(id) {
  var j = _jobById(id); if (!j) return;
  var net = Math.round((parseFloat(j.pay)||0) * (1 - (parseFloat(j.fixerCutPct)||0)/100));
  var accs = (CS.lifestyle.accounts||[]).filter(function(a){ return !a.closed; });
  var opts = '<option value="cash">Cash on hand</option>' +
    accs.map(function(a){ return '<option value="' + a.id + '">' + _esc(a.name) + '</option>'; }).join('');
  _modalOpen('Collect payout — ' + _esc(j.title||'gig'),
    '<div class="cs-modal-hint">Pay ' + (parseFloat(j.pay)||0) + ' eb − fixer cut ' + (parseFloat(j.fixerCutPct)||0) + '% = <strong>' + net + ' eb</strong> net.</div>' +
    '<label class="cs-modal-lbl">Deposit to</label><select id="m-jc-dest" class="cs-modal-inp">' + opts + '</select>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="collectJobSave(\'' + id + '\')">Collect ' + net + ' eb</button></div>');
}
function collectJobSave(id) {
  var j = _jobById(id); if (!j) return;
  var dest = (document.getElementById('m-jc-dest')||{}).value || 'cash';
  var net = Math.round((parseFloat(j.pay)||0) * (1 - (parseFloat(j.fixerCutPct)||0)/100));
  if (dest === 'cash') {
    CS.lifestyle.cash = (parseFloat(CS.lifestyle.cash)||0) + net;
  } else {
    var acc = _accById(dest);
    if (acc) { acc.balance = (parseFloat(acc.balance)||0) + net; _ledgerPush(acc, 'income', 'Gig payout: ' + (j.title||''), net); }
  }
  j.status = 'paid';
  _modalClose(); renderJobs(); renderLifestyle();
}

/* ── Browse public corporate gigs (from the Organisations tool) ── */
function _loadOrgOpenings(cb) {
  var orgs = [];
  try { orgs = JSON.parse(localStorage.getItem('bartmoss_orgs') || '[]') || []; } catch(e) { orgs = []; }
  fetch('data/arasaka.org.json').then(function(r){ return r.json(); })
    .then(function(a){ cb(orgs.concat([a])); })
    .catch(function(){ cb(orgs); });
}
function browseCorpGigsModal() {
  _modalOpen('Browse corporate gigs', '<div class="cs-modal-hint">Loading public openings…</div>');
  _loadOrgOpenings(function(orgs) {
    var rows = [];
    orgs.forEach(function(o) {
      var openings = (o && o.jobs && o.jobs.openings) || [];
      openings.forEach(function(j) {
        if (j.isPrivate) return; // public gigs only
        rows.push({ org:o.name||'Unknown', j:j });
      });
    });
    var body;
    if (!rows.length) {
      body = '<div class="cs-modal-hint">No public openings found. Create corporations with public job openings in the Organisations tool first.</div>';
    } else {
      body = '<div class="gig-browse">' + rows.map(function(r, i) {
        return '<div class="gig-row" onclick="addImportedJob(' + i + ')">' +
          '<div class="gig-row-top"><span class="net-name">' + _esc(r.j.title||'Opening') + '</span>' +
          '<span class="net-src">' + _esc(r.org) + '</span></div>' +
          '<div class="net-sub">' + _esc((r.j.pay||r.j.salary||'?') + (r.j.payPeriod?(' '+r.j.payPeriod):'')) + (r.j.risk?(' · risk '+_esc(r.j.risk)):'') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    _IMPORT_ROWS = rows;
    document.getElementById('cs-modal-body').innerHTML = body +
      '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Close</button></div>';
  });
}
var _IMPORT_ROWS = [];
function addImportedJob(i) {
  var r = _IMPORT_ROWS[i]; if (!r) return;
  var j = r.j;
  var payNum = parseFloat(String(j.pay||j.salary||'').replace(/[^\d.]/g,'')) || 0;
  CS.jobs.push({ id:_bankUid(), title:j.title||'Corporate gig', client:r.org, source:'corp', fixerId:null,
    pay:payNum, payType:(j.payPeriod && /month/i.test(j.payPeriod))?'per month':'flat', fixerCutPct:0,
    risk:(['Low','Medium','High','Suicide'].indexOf(j.risk)>=0?j.risk:'Medium'), status:'offered',
    deadline:j.duration||'', description:j.description||'' });
  _modalClose(); renderJobs();
}

/* ─── Vehicles ─── */
/* ─── VEHICLES ─── */
/* ── Vehicle cargo slot table ── */
var VEH_CARGO_SLOTS = {
  'motorcycle': 4, 'car': 10, 'pick-up': 16, 'truck': 40,
  'av': 8, 'hover': 12,
  'boat': 20, 'submarine': 30,
  'apc': 20, 'apc-wheeled': 20,
  'ifv': 16, 'ifv tracked': 16,
  'main battle tank': 8,
  'light helicopter': 6, 'medium helicopter': 10, 'heavy helicopter': 14,
  'osprey': 20,
  'ultralight': 3,
  'small jet': 20, 'medium airplane': 30, 'plane-medium': 30, 'large jet': 50,
  'airship': 50,
  'cyberwalk': 3, 'cyberwalk-biped': 3,
  'super-heavy construction': 50,
};
var VEH_TYPES = ['motorcycle','car','pick-up','truck','av','hover','boat','submarine',
  'apc','apc-wheeled','ifv','ifv tracked','main battle tank',
  'light helicopter','medium helicopter','heavy helicopter','osprey',
  'ultralight','small jet','medium airplane','large jet','airship',
  'cyberwalk','super-heavy construction'];

function _getVehCargoSlots(v) {
  if (v.cargoSlotsCustom != null && v.cargoSlotsCustom !== '') return Math.max(0, parseInt(v.cargoSlotsCustom) || 0);
  var m = String(v.cargo || '').match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (m) return Math.max(2, Math.min(50, Math.ceil(parseFloat(m[1]) / 10)));
  return VEH_CARGO_SLOTS[(v.type || '').toLowerCase()] || 6;
}

function _makeVeh(item) {
  return {
    name: item.name, type: item.type || '',
    topspeed: item.topspeed || 0, accelerate: item.accelerate || 0, decelerate: item.decelerate || 0,
    sdp: item.sdp || 0, sp: item.sp || 0,
    crew: item.crew || 0, passengers: item.passengers || 0,
    cargo: item.cargo || '', range: item.range || 0,
    maneuver: item.maneuver || 0, mass: item.mass || 0,
    cost: item.bookcost || item.cost || 0,
    options: item.options || '', weapons: item.weapons || '',
    description: '', photo: '', cargoContents: [],
    cargoSlotsCustom: null, customOptions: [], activeOptions: []
  };
}

function addVehicle(item) { var v = _makeVeh(item); CS.vehicles.push(v); pendPurchase(v, 'vehicle', item.cost || item.bookcost); renderVehicles(); renderFashion(); }
function addCustomVehicle() {
  var name = prompt('Name:'); if (!name) return;
  CS.vehicles.push({ name: name, type: '', topspeed: 0, accelerate: 0, decelerate: 0,
    sdp: 0, sp: 0, crew: 1, passengers: 0,
    cargo: '', range: 0, maneuver: 0, mass: 0, cost: 0, options: '', weapons: '',
    description: '', photo: '', cargoContents: [], cargoSlotsCustom: null, customOptions: [], activeOptions: [] });
  renderVehicles(); renderFashion();
}
function removeVehicle(idx) {
  var v = CS.vehicles[idx];
  if ((v.cargoContents || []).length) {
    CS.notStored = (CS.notStored || []).concat(v.cargoContents);
    renderNotStored();
  }
  CS.vehicles.splice(idx, 1);
  renderVehicles(); renderFashion();
}
function setVehDesc(idx, val) { CS.vehicles[idx].description = val; }
function setVehType(idx, val) { CS.vehicles[idx].type = val; renderVehicles(); renderFashion(); }
function setVehCargoSlots(idx, val) {
  var n = val === '' ? null : parseInt(val);
  CS.vehicles[idx].cargoSlotsCustom = (isNaN(n) ? null : n);
  renderVehicles(); renderFashion();
}
function addVehOption(idx) {
  var inp = document.getElementById('veh-opt-inp-' + idx);
  var val = inp ? inp.value.trim() : '';
  if (!val) return;
  CS.vehicles[idx].customOptions = CS.vehicles[idx].customOptions || [];
  CS.vehicles[idx].customOptions.push(val);
  inp.value = '';
  renderVehicles();
}
function removeVehOption(idx, oi) { CS.vehicles[idx].customOptions.splice(oi, 1); renderVehicles(); }
function toggleVehOption(idx, opt) {
  var v = CS.vehicles[idx];
  v.activeOptions = v.activeOptions || [];
  var pos = v.activeOptions.indexOf(opt);
  if (pos === -1) v.activeOptions.push(opt); else v.activeOptions.splice(pos, 1);
  renderVehicles();
}

function loadVehPhoto(idx, el) {
  var f = el.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) { CS.vehicles[idx].photo = ev.target.result; renderVehicles(); renderFashion(); };
  r.readAsDataURL(f);
}
function clearVehPhoto(idx) {
  if (CS.vehicles[idx]) { CS.vehicles[idx].photo = ''; renderVehicles(); renderFashion(); }
}

function handDragStart(e, hi) {
  _gearDrag = { src: 'hand', hIdx: hi };
  e.dataTransfer.effectAllowed = 'move';
}
function handDropZone(e, hi) {
  e.preventDefault();
  if (!_gearDrag) return;
  if (CS.hands[hi]) return; // slot occupied
  if (_gearDrag.src === 'fashionContainer') {
    var f = CS.fashion[_gearDrag.fIdx];
    if (!f) return;
    CS.hands[hi] = { name: f.name, category: f.category || '', cost: f.cost || 0, wt: f.wt || 0, notes: f.notes || '' };
    f.equipped = true;
    _gearDrag = null;
    renderFashion();
    return;
  }
  var item = _extractDragItem();
  if (!item) return;
  CS.hands[hi] = item;
  _gearDrag = null;
  renderFashion(); renderGear(); renderNotStored();
}
function removeFromHand(hi) {
  var entry = CS.hands[hi];
  if (!entry) return;
  CS.hands[hi] = null;
  CS.gear.push(entry);
  renderFashion(); renderGear();
}

function vehCargoDragStart(e, vIdx, cIdx) {
  _gearDrag = { src: 'vehCargo', vIdx: vIdx, cIdx: cIdx };
  e.dataTransfer.effectAllowed = 'move';
}
function vehCargoDropZone(e, vIdx) {
  e.preventDefault();
  if (!_gearDrag) return;
  var v = CS.vehicles[vIdx];
  v.cargoContents = v.cargoContents || [];
  var item = _extractDragItem();
  if (!item) return;
  if (_cargoUsed(v.cargoContents) + _cargoCost(item) > _getVehCargoSlots(v)) { CS.notStored = (CS.notStored || []).concat(item); }
  else { v.cargoContents.push(item); }
  _gearDrag = null;
  renderVehicles(); renderFashion(); renderGear(); renderNotStored();
}
function removeFromVehCargo(vIdx, cIdx) {
  var item = CS.vehicles[vIdx].cargoContents.splice(cIdx, 1)[0];
  if (_isContainerItem(item)) { CS.fashion.push(item); } else { CS.gear.push(item); }
  renderVehicles(); renderFashion(); renderGear();
}
function toggleVehCargoDetail(vIdx, cIdx) {
  var key = 'v' + vIdx + '-' + cIdx;
  _fciOpen = (_fciOpen === key) ? null : key;
  renderVehicles();
}

function renderLifestyle() {
  var el = document.getElementById('lifestyle-grid');
  if (!el) return;
  var ls = CS.lifestyle;
  if (!ls.groceries) ls.groceries = { quality: 'Generic Prepak', multiplier: 'Fair' };
  var hasCC      = _lsHasCredchip();
  var ccTotal    = _lsCredchipTotal();
  var cashTotal  = _lsCashTotal();
  var svcTotal   = _lsServiceTotal();
  var grocCost   = _lsGroceriesCost();
  var grandTotal = svcTotal + grocCost + _lsHousingMonthlyCost() + _lsAccountFeesTotal();

  /* ─────────── FINANCES (cash + bank accounts) ─────────── */
  var financeQ = _lsBuildFinance(ls, cashTotal, ccTotal, hasCC, grandTotal);

  /* ─────────── HOUSING ─────────── */
  var housingCards = (ls.housing || []).map(function(h, hi) {
    var slots = _lsHousingCargoSlots(h);
    var used  = _cargoUsed(h.cargoContents);
    var full  = used >= slots;
    var pct   = slots > 0 ? Math.round(used / slots * 100) : 0;
    var slotBar = '<div class="slot-bar" style="margin:3px 0 4px"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>';


    var utilTotal = (h.utilities||[]).reduce(function(t,u){ return t+(parseFloat(u.cost)||0); }, 0);
    var utilRows  = (h.utilities||[]).map(function(u, ui) {
      return '<div class="ls-util-row">' +
        '<input class="ls-util-name" value="' + (u.name||'').replace(/"/g,'&quot;') + '" placeholder="Electricity, Water, Net..." ' +
          'onchange="CS.lifestyle.housing[' + hi + '].utilities[' + ui + '].name=this.value">' +
        '<input class="ls-util-cost" type="number" value="' + (u.cost||0) + '" ' +
          'onchange="CS.lifestyle.housing[' + hi + '].utilities[' + ui + '].cost=parseFloat(this.value)||0;renderLifestyle()">' +
        '<span class="ls-suf">eb/mo</span>' +
        '<span class="ls-rm" onclick="CS.lifestyle.housing[' + hi + '].utilities.splice(' + ui + ',1);renderLifestyle()">✕</span>' +
      '</div>';
    }).join('');

    var typeOpts = HOUSING_TYPES.map(function(t) {
      return '<option value="' + t + '"' + (h.type === t ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
    var distOpts = '<option value=""' + (!h.district ? ' selected' : '') + '>— district —</option>' + NC_DISTRICTS.map(function(d) {
      return '<option value="' + d + '"' + (h.district === d ? ' selected' : '') + '>' + d + '</option>';
    }).join('');

    return '<div class="ls-housing-card">' +
      '<div class="ls-housing-head">' +
        '<input class="ls-housing-name" value="' + (h.name||'').replace(/"/g,'&quot;') + '" ' +
          'oninput="CS.lifestyle.housing[' + hi + '].name=this.value;renderFashion()">' +
        '<select class="ls-housing-type" onchange="CS.lifestyle.housing[' + hi + '].type=this.value;renderFashion()">' + typeOpts + '</select>' +
        '<select class="ls-housing-type" title="Delivery district" onchange="CS.lifestyle.housing[' + hi + '].district=this.value">' + distOpts + '</select>' +
        '<span class="ls-rm" onclick="removeHousing(' + hi + ')">✕</span>' +
      '</div>' +
      '<div class="ls-housing-body">' +
        '<div class="ls-hrow">' +
          '<span class="ls-lbl">Rooms</span>' +
          '<input class="ls-short-inp" type="number" min="1" value="' + (h.rooms||1) + '" ' +
            'onchange="CS.lifestyle.housing[' + hi + '].rooms=parseInt(this.value)||1;renderLifestyle();renderFashion()">' +
          '<span class="ls-lbl" style="margin-left:12px">Rent</span>' +
          (h.owned
            ? '<span class="ls-owned-badge">OWNED</span>'
            : '<input class="ls-short-inp" type="number" value="' + (h.rent||0) + '" ' +
                'onchange="CS.lifestyle.housing[' + hi + '].rent=parseFloat(this.value)||0">' +
              '<span class="ls-suf">eb/mo</span>'
          ) +
          '<label class="ls-owned-lbl">' +
            '<input type="checkbox"' + (h.owned ? ' checked' : '') + ' ' +
              'onchange="CS.lifestyle.housing[' + hi + '].owned=this.checked;renderLifestyle();renderFashion()"> Owned' +
          '</label>' +
        '</div>' +
        '<div class="ls-hrow">' +
          '<span class="ls-lbl">Location</span>' +
          '<input class="ls-loc-inp" value="' + (h.location||'').replace(/"/g,'&quot;') + '" placeholder="address, district..." ' +
            'onchange="CS.lifestyle.housing[' + hi + '].location=this.value">' +
        '</div>' +
        (function(){
          var open = (CS.lifestyle.accounts||[]).filter(function(a){ return !a.closed; });
          if (!open.length) return '';
          var opts = '<option value=""' + (!h.billAccountId?' selected':'') + '>Cash</option>' +
            open.map(function(a){ return '<option value="' + a.id + '"' + (h.billAccountId===a.id?' selected':'') + '>' + _esc(a.name) + '</option>'; }).join('');
          return '<div class="ls-hrow"><span class="ls-lbl">Billed to</span>' +
            '<select class="ls-svc-bill" onchange="lsSetHousingAccount(' + hi + ',this.value)">' + opts + '</select>' +
            '<span class="ls-suf">rent + utilities</span></div>';
        })() +
        '<textarea class="ls-housing-desc" placeholder="Description..." ' +
          'oninput="CS.lifestyle.housing[' + hi + '].description=this.value">' + (h.description||'') + '</textarea>' +
        '<div class="ls-util-section">' +
          '<div class="ls-sub-head">' +
            '<span class="ls-sub-lbl">Utilities</span>' +
            (utilTotal ? '<span class="ls-util-total">' + utilTotal + ' eb/mo</span>' : '') +
            '<span class="ls-add-btn" onclick="lsAddUtility(' + hi + ')">+</span>' +
          '</div>' +
          (utilRows || '') +
        '</div>' +
        '<div class="ls-cargo-toggle" onclick="CS.lifestyle.housing[' + hi + '].cargoOpen=!CS.lifestyle.housing[' + hi + '].cargoOpen;renderLifestyle()">' +
          '<span class="ls-sub-lbl">Cargo</span>' +
          '<span class="ls-cargo-info">' + used + '/' + slots + ' (' + (h.rooms||1) + '×50)</span>' +
          '<span class="ls-arr">' + (h.cargoOpen ? '▴' : '▾') + '</span>' +
        '</div>' +
        (h.cargoOpen ? (
          '<div class="ls-cargo-body" ondragover="fashionDragOver(event)" ondrop="houseCargoDropZone(event,' + hi + ')">' +
            slotBar +
            (used > 0
              ? (h.cargoContents || []).map(function(c, ci) {
                  return '<div class="fci" draggable="true" ondragstart="houseCargoDragStart(event,' + hi + ',' + ci + ')">' +
                    '<span class="fci-name">' + (c.name||'?') + '</span>' +
                    (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
                    '<span class="fci-rm" onclick="event.stopPropagation();removeFromHouseCargo(' + hi + ',' + ci + ')" title="Return to gear">↩</span>' +
                  '</div>';
                }).join('')
              : '<span class="fc-placeholder">drag gear here</span>'
            ) +
          '</div>'
        ) : '') +
      '</div>' +
    '</div>';
  }).join('');

  var housingQ = '<div class="ls-quad">' +
    '<div class="ls-q-head">Housing <span class="ls-add-btn" onclick="lsAddHousing()">+</span></div>' +
    (housingCards || '<span class="ls-empty">No housing.</span>') +
  '</div>';

  /* ─────────── SERVICES ─────────── */
  var openAccts = (ls.accounts || []).filter(function(a){ return !a.closed; });
  var svcRows = (ls.services || []).map(function(s, si) {
    var billSel = '';
    if (openAccts.length) {
      var opts = '<option value=""' + (!s.accountId?' selected':'') + '>Cash</option>' +
        openAccts.map(function(a){ return '<option value="' + a.id + '"' + (s.accountId===a.id?' selected':'') + '>' + _esc(a.name) + '</option>'; }).join('');
      billSel = '<select class="ls-svc-bill" title="Billed to" onchange="lsSetServiceAccount(' + si + ',this.value)">' + opts + '</select>';
    }
    return '<div class="ls-svc-row">' +
      '<span class="ls-svc-name">' + s.name + '</span>' +
      billSel +
      '<input class="ls-svc-cost" type="number" value="' + (s.cost||0) + '" ' +
        'onchange="CS.lifestyle.services[' + si + '].cost=parseFloat(this.value)||0;renderLifestyle()">' +
      '<span class="ls-suf">eb/mo</span>' +
      '<span class="ls-rm" onclick="lsRemoveService(' + si + ')">✕</span>' +
    '</div>';
  }).join('');

  /* opened accounts appear as billable service lines (their monthly fee) */
  var acctFeeRows = openAccts.map(function(a) {
    var fee = _accTier(a).fee;
    var feeTgt = a.feeAccountId || a.id;
    var opts = '<option value=""' + (!a.feeAccountId?' selected':'') + '>Cash</option>' +
      openAccts.map(function(b){ return '<option value="' + b.id + '"' + (feeTgt===b.id?' selected':'') + '>' + _esc(b.name) + (b.id===a.id?' (self)':'') + '</option>'; }).join('');
    return '<div class="ls-svc-row ls-svc-acct">' +
      '<span class="ls-svc-name">' + _esc(a.name) + ' — account fee</span>' +
      '<select class="ls-svc-bill" title="Fee billed to" onchange="lsSetFeeAccount(\'' + a.id + '\',this.value)">' + opts + '</select>' +
      '<span class="ls-svc-cost-fixed">' + fee + '</span><span class="ls-suf">eb/mo</span>' +
    '</div>';
  }).join('');

  /* bank subscription picker → opening an account at a bank */
  var bankOpts = '<option value="">+ open a bank account…</option>' +
    [1,2,3].map(function(tier) {
      var inTier = BANKS.filter(function(b){ return b.tier === tier; });
      return '<optgroup label="Tier ' + tier + ' — ' + BANK_TIERS[tier].label + ' (' + BANK_TIERS[tier].fee + ' eb/mo)">' +
        inTier.map(function(b){ return '<option value="' + b.id + '">' + _esc(b.name) + ' — ' + b.services.join('/') + '</option>'; }).join('') +
      '</optgroup>';
    }).join('');
  var bankPicker = '<div class="ls-bank-picker">' +
    '<select class="ls-bank-pick-sel" onchange="if(this.value){lsOpenAccount(this.value);}this.value=\'\';">' + bankOpts + '</select>' +
  '</div>';

  /* groceries row */
  var gQopts = Object.keys(GROCERY_QUALITY).map(function(k) {
    return '<option' + (ls.groceries.quality === k ? ' selected' : '') + '>' + k + '</option>';
  }).join('');
  var gMopts = Object.keys(GROCERY_MULT).map(function(k) {
    return '<option' + (ls.groceries.multiplier === k ? ' selected' : '') + '>' + k + '</option>';
  }).join('');
  var grocRow = '<div class="ls-groc-row">' +
    '<span class="ls-svc-name ls-groc-lbl">Groceries</span>' +
    '<select class="ls-groc-sel" onchange="CS.lifestyle.groceries.quality=this.value;renderLifestyle()">' + gQopts + '</select>' +
    '<span class="ls-groc-x">×</span>' +
    '<select class="ls-groc-sel" onchange="CS.lifestyle.groceries.multiplier=this.value;renderLifestyle()">' + gMopts + '</select>' +
    '<span class="ls-groc-cost">' + grocCost + ' eb/mo</span>' +
  '</div>';

  var allTotal = svcTotal + grocCost + _lsAccountFeesTotal();
  var svcQ = '<div class="ls-quad">' +
    '<div class="ls-q-head">Services</div>' +
    '<div class="item-search" style="position:relative;margin-bottom:8px">' +
      '<input id="service-search" placeholder="search lifestyle services..." ' +
        'oninput="searchItems(\'service\')" onfocus="searchItems(\'service\')" autocomplete="off">' +
      '<div class="dropdown" id="service-dropdown"></div>' +
    '</div>' +
    (svcRows || '') +
    (acctFeeRows || '') +
    grocRow +
    bankPicker +
    '<div class="ls-svc-total">Total monthly : <strong>' + allTotal + ' eb/mo</strong></div>' +
  '</div>';

  el.innerHTML = housingQ + svcQ + financeQ;
}

/* ─── Finances quad: narrow sidebar (Cash + accounts) + main panel ─── */
function _lsBuildFinance(ls, cashTotal, ccTotal, hasCC, grandTotal) {
  var accounts = (ls.accounts || []).filter(function(a){ return !a.closed; });
  var active = ls.activeAccountId || 'cash';
  if (active !== 'cash' && !_accById(active)) active = 'cash';

  /* sidebar */
  var sideItems = '<div class="ls-fin-tab' + (active==='cash'?' active':'') + '" onclick="lsSelectAccount(\'cash\')">' +
      '<span class="ls-fin-tab-name">Cash</span>' +
      '<span class="ls-fin-tab-bal">' + cashTotal + '</span>' +
    '</div>';
  sideItems += accounts.map(function(a) {
    var bank = _bankOf(a);
    return '<div class="ls-fin-tab' + (active===a.id?' active':'') + '" onclick="lsSelectAccount(\'' + a.id + '\')" title="' + _esc(bank.name) + '">' +
      '<span class="ls-fin-tab-dot" style="background:' + _bankColor(bank) + '"></span>' +
      '<span class="ls-fin-tab-name">' + _esc(a.name) + '</span>' +
      '<span class="ls-fin-tab-bal' + ((parseFloat(a.balance)||0) < 0 ? ' neg' : '') + '">' + (parseFloat(a.balance)||0) + '</span>' +
    '</div>';
  }).join('');
  var sidebar = '<div class="ls-fin-side"><div class="ls-fin-side-head">ACCOUNTS</div>' + sideItems + '</div>';

  var mainAttrs = '', main;
  if (active === 'cash') {
    main = _lsBuildCashView(ls, cashTotal, ccTotal, hasCC, grandTotal, accounts);
  } else {
    var acc = _accById(active), bank = _bankOf(acc);
    mainAttrs = ' data-tier="' + bank.tier + '" data-region="' + (bank.region||'') + '" data-bank="' + bank.id + '"' +
      ' style="--bank-accent:' + _bankColor(bank) + ';--bank-accent2:' + _bankColor2(bank) + '"';
    main = _lsBuildAccountView(acc, accounts);
  }

  return '<div class="ls-quad ls-quad-finance">' +
    '<div class="ls-q-head">Finances ' +
      '<button class="ls-eom-btn" onclick="lsEndOfMonth()" title="End of month: income in, bills out, interest accrues">⏰ End of month</button>' +
    '</div>' +
    '<div class="ls-fin-layout">' + sidebar + '<div class="ls-fin-main"' + mainAttrs + '>' + main + '</div></div>' +
  '</div>';
}

function _lsBuildCashView(ls, cashTotal, ccTotal, hasCC, grandTotal, accounts) {
  var credchipRows = (ls.credchips || []).map(function(c, ci) {
    return '<div class="ls-ledger-row ls-cc-item">' +
      '<input class="ls-cc-name" value="' + (c.name||'').replace(/"/g,'&quot;') + '" placeholder="chip name" ' +
        'onchange="CS.lifestyle.credchips[' + ci + '].name=this.value">' +
      '<div class="ls-ledger-right">' +
        '<input class="ls-ledger-amt" type="number" value="' + (c.amount||0) + '" ' +
          'onchange="CS.lifestyle.credchips[' + ci + '].amount=parseFloat(this.value)||0;renderLifestyle()">' +
        '<span class="ls-ledger-cur">eb</span>' +
        '<span class="ls-rm" onclick="CS.lifestyle.credchips.splice(' + ci + ',1);renderLifestyle()">✕</span>' +
      '</div>' +
    '</div>';
  }).join('');

  /* withdraw/deposit controls only relevant if the player owns accounts */
  var moveBlock = accounts.length ? (
    '<div class="ls-bank-move">' +
      '<button class="btn btn-sm" onclick="lsMoveModal(\'withdraw\')">↓ Withdraw from account</button>' +
      '<button class="btn btn-sm" onclick="lsMoveModal(\'deposit\')">↑ Deposit to account</button>' +
    '</div>'
  ) : '';

  /* street debt — loan sharks (no bank account needed, brutal rates) */
  var sharks = ls.sharkLoans || [];
  var sharkRows = sharks.map(function(s) {
    return '<div class="ls-line ls-shark-row">' +
      '<span class="ls-line-name">' + _esc(s.lender || 'Loan shark') + '</span>' +
      '<span class="ls-line-freq">' + ((parseFloat(s.rate)||0)*100).toFixed(0) + '%/yr</span>' +
      '<span class="ls-line-amt neg">−' + (parseFloat(s.principal)||0) + '</span>' +
      '<span class="ls-line-act" title="Pay down" onclick="lsSharkRepayModal(\'' + s.id + '\')">$</span>' +
      '<span class="ls-rm" onclick="lsRemoveShark(\'' + s.id + '\')">✕</span>' +
    '</div>';
  }).join('');
  var sharkBlock = '<div class="ls-shark">' +
    '<div class="ls-acc-sub-head ls-shark-head">Street debt — loan sharks ' +
      '<span class="ls-secadd" style="margin-left:auto" onclick="lsSharkModal()">+ Borrow</span></div>' +
    (sharkRows || '<span class="ls-empty">No street debt. Quick cash, no bank, no questions — and rates that bite.</span>') +
  '</div>';

  return '<div class="ls-bank-head">' +
      '<div class="ls-bank-label">Cash &amp; Credchips</div>' +
      '<div class="ls-bank-total">' + cashTotal + '<span class="ls-bank-cur"> eb</span></div>' +
    '</div>' +
    (hasCC ? (
      '<div class="ls-ledger-group">' +
        '<div class="ls-ledger-group-head" onclick="CS.lifestyle.credchipsOpen=!CS.lifestyle.credchipsOpen;renderLifestyle()">' +
          '<span class="ls-ledger-cat">Credchips</span>' +
          '<span class="ls-ledger-subtotal">' + ccTotal + ' eb</span>' +
          '<span class="ls-arr">' + (ls.credchipsOpen ? '▴' : '▾') + '</span>' +
        '</div>' +
        (ls.credchipsOpen ? (
          '<div class="ls-cc-list">' + credchipRows +
            '<div class="ls-ledger-row ls-cc-addrow">' +
              '<input id="ls-cc-name-inp" class="ls-cc-name" placeholder="chip name">' +
              '<div class="ls-ledger-right">' +
                '<input id="ls-cc-amt-inp" class="ls-ledger-amt" type="number" placeholder="0">' +
                '<span class="ls-ledger-cur">eb</span>' +
                '<span class="ls-add-btn" onclick="lsAddCredchip()">+</span>' +
              '</div>' +
            '</div>' +
          '</div>'
        ) : '') +
      '</div>'
    ) : '') +
    '<div class="ls-ledger-row">' +
      '<span class="ls-ledger-cat">Cash on hand</span>' +
      '<div class="ls-ledger-right">' +
        '<input class="ls-ledger-amt" type="number" value="' + (ls.cash||0) + '" ' +
          'onchange="CS.lifestyle.cash=parseFloat(this.value)||0;renderLifestyle()">' +
        '<span class="ls-ledger-cur">eb</span>' +
      '</div>' +
    '</div>' +
    '<div class="ls-ledger-row ls-salary-row">' +
      '<span class="ls-ledger-cat">Salary</span>' +
      '<div class="ls-ledger-right">' +
        '<input class="ls-ledger-amt" type="number" value="' + (ls.salary||0) + '" ' +
          'onchange="CS.lifestyle.salary=parseFloat(this.value)||0">' +
        '<span class="ls-ledger-cur">eb/mo</span>' +
        '<button class="ls-salary-btn" onclick="lsAddCashSalary()" title="Receive salary">+</button>' +
      '</div>' +
    '</div>' +
    moveBlock +
    sharkBlock +
    '<div class="ls-bank-footer">' +
      '<span class="ls-bank-out-lbl">Monthly out</span>' +
      '<span class="ls-bank-out-val">− ' + grandTotal + ' eb</span>' +
    '</div>';
}

function _lsBuildAccountView(acc, accounts) {
  if (!acc) return '<span class="ls-empty">No account.</span>';
  var bank = _bankOf(acc);
  var tier = _accTier(acc);
  var bal  = parseFloat(acc.balance)||0;
  var tab  = _finTab || 'liquidity';

  /* header + meta (always visible) — logo occupies its own corner with breathing room */
  var logo = _bankLogo(bank.id);
  var custom = _bankLogoIsCustom(bank.id);
  var logoHtml = logo
    ? '<img class="ls-bank-logo" src="' + logo + '" onclick="lsBankLogoPick(\'' + bank.id + '\')" title="Click to upload your own logo">' +
      (custom ? '<span class="ls-bank-logo-clear" onclick="lsBankLogoClear(\'' + bank.id + '\')" title="Reset logo">✕</span>' : '')
    : '<div class="ls-bank-logo-ph" onclick="lsBankLogoPick(\'' + bank.id + '\')" title="Click to upload a logo">' + _bankMonogram(bank) + '</div>';
  var header = '<div class="ls-bank-head">' +
      '<div class="ls-bank-headtext">' +
        '<div class="ls-bank-label">' + _esc(bank.name) + ' <span class="ls-acc-tier t' + bank.tier + '">' + tier.label + '</span></div>' +
        '<div class="ls-bank-total' + (bal<0?' neg':'') + '">' + bal + '<span class="ls-bank-cur"> eb</span></div>' +
      '</div>' +
      '<div class="ls-bank-logo-wrap">' + logoHtml + '</div>' +
    '</div>' +
    '<div class="ls-acc-meta">' +
      '<input class="ls-acc-name-inp" value="' + (acc.name||'').replace(/"/g,'&quot;') + '" onchange="(function(v){var a=_accById(\'' + acc.id + '\');if(a)a.name=v;renderLifestyle();})(this.value)">' +
      '<span class="ls-acc-detail">' + _esc(bank.location) + ' · fee ' + tier.fee + ' eb/mo · overdraft ' + tier.overdraft + ' eb</span>' +
    '</div>';

  /* top bar */
  var TABS = [['liquidity','Liquidity'],['operations','Operations'],['finance','Finance'],['loans','Loans']];
  var topbar = '<div class="ls-acc-tabs">' + TABS.map(function(t){
    var badge = (t[0]==='loans' && (acc.loans||[]).length) ? '<span class="ls-acc-tab-badge">' + acc.loans.length + '</span>' : '';
    return '<div class="ls-acc-tab' + (tab===t[0]?' active':'') + '" onclick="lsFinTab(\'' + t[0] + '\')">' + t[1] + badge + '</div>';
  }).join('') + '</div>';

  var body = '';

  if (tab === 'liquidity') {
    /* editable demand deposit */
    body += '<div class="ls-acc-deposit">' +
      '<span class="ls-move-lbl">Demand deposit</span>' +
      '<input class="ls-acc-deposit-inp" type="number" value="' + bal + '" onchange="lsSetBalance(\'' + acc.id + '\',this.value)">' +
      '<span class="ls-ledger-cur">eb</span>' +
    '</div>';

    /* regular inputs */
    var inputRows = (acc.inputs||[]).map(function(inp) {
      return '<div class="ls-line">' +
        '<span class="ls-line-name">' + _esc(inp.label||'(input)') + '</span>' +
        '<span class="ls-line-freq">' + inp.freq + '</span>' +
        '<span class="ls-line-amt pos">+' + (parseFloat(inp.amount)||0) + '</span>' +
        '<span class="ls-line-act" title="Credit now" onclick="lsApplyInput(\'' + acc.id + '\',\'' + inp.id + '\')">▸</span>' +
        '<span class="ls-rm" onclick="lsRemoveInput(\'' + acc.id + '\',\'' + inp.id + '\')">✕</span>' +
      '</div>';
    }).join('');
    body += '<div class="ls-acc-sub-head">Regular inputs <span class="ls-add-btn" onclick="lsInputModal(\'' + acc.id + '\')">+</span></div>' +
      (inputRows || '<span class="ls-empty">No recurring income.</span>');

    /* regular outputs (derived from services / housing / fees billed here) */
    var outs = [];
    (CS.lifestyle.services||[]).forEach(function(s){ if (s.accountId === acc.id) outs.push([s.name||'service', parseFloat(s.cost)||0]); });
    (CS.lifestyle.housing||[]).forEach(function(h){
      if (h.billAccountId === acc.id) {
        var util = (h.utilities||[]).reduce(function(t,u){ return t+(parseFloat(u.cost)||0); },0);
        outs.push([(h.name||'housing') + ' (rent+util)', (h.owned?0:(parseFloat(h.rent)||0)) + util]);
      }
    });
    (CS.lifestyle.accounts||[]).forEach(function(a){ if (!a.closed && (a.feeAccountId||a.id) === acc.id) outs.push([_bankOf(a).name + ' fee', _accTier(a).fee]); });
    var outRows = outs.map(function(o){
      return '<div class="ls-line"><span class="ls-line-name">' + _esc(o[0]) + '</span>' +
        '<span class="ls-line-freq">monthly</span>' +
        '<span class="ls-line-amt neg">−' + o[1] + '</span></div>';
    }).join('');
    body += '<div class="ls-acc-sub-head">Regular outputs <span class="ls-acc-hint">billed here</span></div>' +
      (outRows || '<span class="ls-empty">Nothing billed to this account. Assign services, rent or fees here.</span>');

    /* one-off history */
    var oneOff = (acc.ledger||[]).filter(function(e){ return e.type === 'expense' || e.type === 'income'; });
    var histRows = oneOff.map(function(e){
      var pos = e.type === 'income';
      return '<div class="ls-line"><span class="ls-line-name">' + _esc(e.label||(pos?'income':'expense')) + '</span>' +
        '<span class="ls-line-amt ' + (pos?'pos':'neg') + '">' + (pos?'+':'−') + e.amount + '</span>' +
        '<span class="ls-rm" onclick="lsRemoveLedger(\'' + acc.id + '\',\'' + e.id + '\')">✕</span></div>';
    }).join('');
    body += '<div class="ls-acc-sub-head">One-off history ' +
        '<span class="ls-add-btn ls-add-exp" title="Record expense" onclick="lsLedgerModal(\'' + acc.id + '\',\'expense\')">−</span>' +
        '<span class="ls-add-btn ls-add-inc" title="Record income" onclick="lsLedgerModal(\'' + acc.id + '\',\'income\')">+</span>' +
      '</div>' +
      (histRows || '<span class="ls-empty">No movements yet.</span>');
  }

  else if (tab === 'operations') {
    body += '<div class="ls-acc-sub-head">Transfers <span class="ls-add-btn" onclick="lsTransferModal(\'' + acc.id + '\')">+</span></div>';
    var xfers = (acc.ledger||[]).filter(function(e){ return e.type === 'xfer-out' || e.type === 'xfer-in'; });
    var xfRows = xfers.map(function(e){
      var pos = e.type === 'xfer-in';
      return '<div class="ls-line"><span class="ls-line-name">' + _esc(e.label||'transfer') + '</span>' +
        '<span class="ls-line-amt ' + (pos?'pos':'neg') + '">' + (pos?'+':'−') + e.amount + '</span></div>';
    }).join('');
    body += (xfRows || '<span class="ls-empty">No transfers yet.</span>');

    var payeeRows = (CS.lifestyle.payees||[]).map(function(p){
      return '<div class="ls-payee-row"><span class="ls-payee-name">' + _esc(p.name) + '</span>' +
        '<span class="ls-payee-bank">' + _esc(p.bank||'') + '</span>' +
        '<span class="ls-rm" onclick="lsRemovePayee(\'' + p.id + '\')">✕</span></div>';
    }).join('');
    body += '<div class="ls-acc-sub-head">NPC payees <span class="ls-add-btn" onclick="lsPayeeModal()">+</span></div>' +
      (payeeRows || '<span class="ls-empty">No saved payees.</span>');
  }

  else if (tab === 'finance') {
    body += _lsBuildFinanceTab(acc);
  }

  else if (tab === 'loans') {
    body += '<div class="ls-acc-sub-head">Loans <span class="ls-secadd" style="margin-left:auto" onclick="lsLoanModal(\'' + acc.id + '\')">+ New loan</span></div>';
    var loanRows = (acc.loans||[]).map(function(l){
      return '<div class="ls-loan-card">' +
        '<div class="ls-loan-card-head">' +
          '<span class="ls-loan-label">' + _esc(l.label||'Loan') + '</span>' +
          '<span class="ls-acc-loan-principal">' + (parseFloat(l.principal)||0) + ' eb</span>' +
        '</div>' +
        '<div class="ls-loan-card-row">' +
          '<span class="ls-move-lbl">Rate</span>' +
          '<input class="ls-acc-loan-rate" type="number" step="0.1" value="' + ((parseFloat(l.rate)||0)*100).toFixed(1) + '" onchange="lsSetLoanRate(\'' + acc.id + '\',\'' + l.id + '\',this.value)"><span class="ls-ledger-cur">%/yr</span>' +
          '<span class="ls-move-lbl" style="margin-left:10px">Collateral</span><span class="ls-loan-coll">' + (parseFloat(l.collateral)||0) + ' eb</span>' +
          '<button class="ls-add-btn" style="margin-left:auto" onclick="lsRepayModal(\'' + acc.id + '\',\'' + l.id + '\')">Repay</button>' +
        '</div>' +
      '</div>';
    }).join('');
    body += (loanRows || '<span class="ls-empty">No active loans.</span>');
  }

  var footer = '<div class="ls-acc-footer">' +
    '<button class="ls-acc-close" onclick="lsCloseAccount(\'' + acc.id + '\')">Close account</button>' +
  '</div>';

  return header + topbar + '<div class="ls-acc-body">' + body + '</div>' + footer;
}

/* ─── FINANCE tab: tier-gated financial products ─── */
function _lsBuildFinanceTab(acc) {
  var prods = _accProducts(acc);
  if (!prods.length) {
    return '<div class="ls-fin-locked">No financial products on a <strong>' + _accTier(acc).label +
      '</strong> account.<br><span>Open an account at a corporate or premium bank to unlock deposits, insurance, financing and more.</span></div>';
  }
  var aid = acc.id;
  var month = CS.lifestyle.month || 0;
  var html = '';

  function sub(title, addLabel, addCall, hint) {
    return '<div class="ls-acc-sub-head">' + title +
      (hint ? ' <span class="ls-acc-hint">' + hint + '</span>' : '') +
      '<span class="ls-secadd" style="margin-left:auto" onclick="' + addCall + '">' + addLabel + '</span></div>';
  }

  /* Term deposits */
  if (prods.indexOf('deposit') >= 0) {
    html += sub('Term deposits', '+', "lsDepositModal('" + aid + "')");
    var dRows = (acc.deposits||[]).map(function(d){
      var matured = (d.monthsElapsed||0) >= (d.termMonths||0);
      return '<div class="ls-line">' +
        '<span class="ls-line-name">' + _esc(d.label||'deposit') + ' · ' + (d.monthsElapsed||0) + '/' + (d.termMonths||0) + 'mo @ ' + ((d.rate||0)*100).toFixed(1) + '%</span>' +
        '<span class="ls-line-amt pos">' + (parseFloat(d.principal)||0) + (d.accrued ? '+' + Math.round(d.accrued) : '') + '</span>' +
        '<span class="ls-line-act" title="' + (matured?'Collect':'Withdraw early') + '" onclick="lsDepositWithdraw(\'' + aid + '\',\'' + d.id + '\')">' + (matured?'✓':'↩') + '</span>' +
      '</div>';
    }).join('');
    html += dRows || '<span class="ls-empty">No term deposits.</span>';
  }

  /* Investments */
  if (prods.indexOf('invest') >= 0) {
    html += sub('Investments', '+ Buy', "lsBuyModal('" + aid + "')", 'shares — month ' + month);
    var hRows = (acc.holdings||[]).map(function(h){
      var price = _corpPrice(h.corp, month);
      var value = Math.round(price * h.shares);
      var pnl = value - (parseFloat(h.costBasis)||0);
      return '<div class="ls-line">' +
        '<span class="ls-line-name">' + _esc(h.corp) + ' ×' + h.shares + ' @ ' + price + '</span>' +
        '<span class="ls-line-amt ' + (pnl>=0?'pos':'neg') + '">' + value + ' (' + (pnl>=0?'+':'') + pnl + ')</span>' +
        '<span class="ls-line-act" title="Sell" onclick="lsSellHolding(\'' + aid + '\',\'' + h.id + '\')">↩</span>' +
      '</div>';
    }).join('');
    html += hRows || '<span class="ls-empty">No holdings.</span>';
  }

  /* Insurance */
  if (prods.indexOf('insurance') >= 0) {
    html += sub('Insurance', '+', "lsPolicyModal('" + aid + "')");
    var pRows = (acc.policies||[]).map(function(p){
      return '<div class="ls-line">' +
        '<span class="ls-line-name">' + _esc(p.type) + ' · cover ' + (parseFloat(p.coverage)||0) + '</span>' +
        '<span class="ls-line-amt neg">−' + (parseFloat(p.premium)||0) + '/mo</span>' +
        '<span class="ls-line-act" title="File claim" onclick="lsFileClaim(\'' + aid + '\',\'' + p.id + '\')">$</span>' +
        '<span class="ls-rm" onclick="lsCancelPolicy(\'' + aid + '\',\'' + p.id + '\')">✕</span>' +
      '</div>';
    }).join('');
    html += pRows || '<span class="ls-empty">No policies.</span>';
  }

  /* Cyberware financing */
  if (prods.indexOf('financing') >= 0) {
    html += sub('Cyberware financing', '+', "lsFinanceModal('" + aid + "')");
    var fRows = (acc.financing||[]).map(function(f){
      return '<div class="ls-line">' +
        '<span class="ls-line-name">' + _esc(f.item) + ' · ' + (f.remaining||0) + 'mo left</span>' +
        '<span class="ls-line-amt neg">−' + (parseFloat(f.monthly)||0) + '/mo</span>' +
        '<span class="ls-line-act" title="Settle early" onclick="lsRepayFinancing(\'' + aid + '\',\'' + f.id + '\')">✓</span>' +
      '</div>';
    }).join('');
    html += fRows || '<span class="ls-empty">No financing plans.</span>';
  }

  /* Escrow */
  if (prods.indexOf('escrow') >= 0) {
    html += sub('Contract escrow', '+', "lsEscrowModal('" + aid + "')");
    var eRows = (acc.escrows||[]).map(function(e){
      var inc = e.direction === 'in';
      return '<div class="ls-line">' +
        '<span class="ls-line-name">' + _esc(e.label) + ' · ' + (inc?'incoming':'outgoing') + '</span>' +
        '<span class="ls-line-amt ' + (inc?'pos':'neg') + '">' + (inc?'+':'−') + (parseFloat(e.amount)||0) + '</span>' +
        '<span class="ls-line-act" title="Release" onclick="lsReleaseEscrow(\'' + aid + '\',\'' + e.id + '\')">✓</span>' +
        '<span class="ls-rm" title="Cancel" onclick="lsCancelEscrow(\'' + aid + '\',\'' + e.id + '\')">✕</span>' +
      '</div>';
    }).join('');
    html += eRows || '<span class="ls-empty">No escrows.</span>';
  }

  /* Laundering (action, not a list) */
  if (prods.indexOf('launder') >= 0) {
    html += '<div class="ls-acc-sub-head">Discreet services</div>' +
      '<button class="btn btn-sm" onclick="lsLaunderModal(\'' + aid + '\')">⚿ Launder funds (cash ⇄ account)</button>';
  }

  return '<div class="ls-fin-products">' + html + '</div>';
}

/* ═══ CYBERDECK & NETRUNNING ═══ */
var _NET_PROG_COLORS = { intrusion:'#c0392b', decryption:'#1769aa', detection:'#2ecc71', alarm:'#e67e22', stealth:'#8e44ad', evasion:'#16a085', protection:'#2c3e50', 'anti-system':'#d35400', 'anti-program':'#7f8c8d', 'anti-personnel':'#922b21' };
var _NET_QH_TYPES = ['Daemon','Interface','Turret','Environment','Comms'];
/* Grimoire ⑧ — emergent sigil = an ink Unicode glyph (never SVG/emoji, charte). Derived from
   the program class; Demons (carry containers) get their own container glyph. Text-default glyphs only. */
var _NET_SIGILS = {
  intrusion:'◆', decryption:'⊟', detection:'◎', alarm:'⌁', stealth:'◇', evasion:'↯',
  protection:'⊕', 'anti-system':'⊗', 'anti-program':'⊘', 'anti-personnel':'⊠',
  controller:'⌾', utility:'▤', 'anti-ic':'⊗', 'anti-personel':'⊠'
};
/* Net-assets ⑪ — pre-established access kinds (backdoors / forged creds / taps / planted / favors). */
var _NET_ASSET_KINDS = {
  backdoor: { label:'Backdoor',         sigil:'⊐' },
  cred:     { label:'Forged cred',      sigil:'▤' },
  tap:      { label:'Tap / wiretap',    sigil:'⋔' },
  planted:  { label:'Planted program',  sigil:'◉' },
  favor:    { label:'Favor owed',       sigil:'☆' }
};
var _netDragId = null;

function _nr() {
  if (!CS.netrunner) CS.netrunner = { mode:'vanilla', deckId:null, deckPhoto:'', deckCustomOptions:[], programs:[], quickhacks:[], assets:[] };
  // Shared sheet-side normalizer (net-interface-contract §2/§5) = single source of truth: adds
  // cs.netrunner.deck + .access + .programs, then seeds the starter loadout. Scoped to netrunners
  // so non-runners aren't handed a default deck + kit (the deck/programs UI shows for everyone).
  if (_isNetrunner() && window.NetModel && NetModel.ensureNetrunner) {
    NetModel.ensureNetrunner(CS);
    _netSeedPreset(CS.netrunner);
  }
  if (!Array.isArray(CS.netrunner.assets)) CS.netrunner.assets = [];   // ROLES-only field (net-assets ⑪)
  return CS.netrunner;
}
/* Seed the v1 starter loadout so the grimoire doesn't start empty (net-progress-audit §ROLES).
   Uses NetModel.PRESET_LOADOUT (6 programs, ΣMU=10) via makeProgram — no local copy, so it can't
   diverge. Dormant until NetModel is present; seeds once per sheet. */
function _netSeedPreset(nr) {
  if (nr._presetSeeded) return;
  if (!window.NetModel || !NetModel.PRESET_LOADOUT || !NetModel.makeProgram) return;
  if ((nr.programs || []).length) { nr._presetSeeded = true; return; }   // never seed over an existing loadout
  var hasDeck = !!(nr.deckId || (nr.deck && typeof nr.deck === 'object'));
  nr.programs = NetModel.PRESET_LOADOUT.map(function(t){ var p = NetModel.makeProgram(t); p.slotted = hasDeck; return p; });
  nr._presetSeeded = true;
}
function _deckByName(name) { return (DB.decks || []).filter(function(d){ return d.name === name; })[0] || null; }
/* The deck the grimoire renders/measures against: a chosen DB.decks row (legacy deckId), else the
   NetModel deck object on cs.netrunner.deck (contract §2), synthesized into a display record. */
function _activeDeckRecord() {
  var nr = _nr();
  if (nr.deckId) return _deckByName(nr.deckId);
  var d = nr.deck;
  if (d && typeof d === 'object') {
    var tname = d.type ? (d.type.charAt(0).toUpperCase() + d.type.slice(1)) : 'Standard';
    return { name: tname + ' cyberdeck', _mu: d.memoryMU, speed: d.speed, dataWall: d.dataWalls, codeGate: 0,
      description: 'Deck built from your loadout (' + (d.access || 'jack') + ' interface).', options: [], _fromModel: true };
  }
  return null;
}
/* Programs actually loaded on the deck = slotted top-level programs, each Demon expanded to include
   the sub-programs it carries (they deploy as one). Feeds the MU accounting. */
function _loadedList() {
  var out = [];
  (_nr().programs || []).forEach(function(p) {
    if (!p.slotted || _progCarrier(p.id)) return;
    out.push(p);
    if (p.demon) (p.carries || []).forEach(function(cid){ var c = _progById(cid); if (c) out.push(c); });
  });
  return out;
}
/* Deck MU accounting — SINGLE SOURCE OF TRUTH is window.NetModel.deckStats when present
   (net-interface-contract §2). Returns { memoryMU, loadedMu, freeMu }. Falls back to the local
   computation until net-model.js lands + is script-tagged (keeps today's behavior identical). */
function _deckStats() {
  var nr = _nr(); var rec = _activeDeckRecord();
  if (window.NetModel && NetModel.deckStats) {
    var st = NetModel.deckStats({ deck: nr.deck, deckId: nr.deckId, interface: nr.interface, programs: _loadedList() }, rec);
    var bonus = 0; (nr.deckCustomOptions || []).forEach(function(o){ if (o.mods && o.mods.mu) bonus += o.mods.mu; });  // ROLES-only hardware-option MU
    var memoryMU = (st.memoryMU || 0) + bonus;
    return { memoryMU: memoryMU, loadedMu: st.loadedMu || 0, freeMu: memoryMU - (st.loadedMu || 0) };
  }
  var mu = rec ? (parseInt(rec._mu) || 0) : 0;
  (nr.deckCustomOptions || []).forEach(function(o){ if (o.mods && o.mods.mu) mu += o.mods.mu; });
  if (rec && rec.doubleMu) mu *= 2;
  var used = _loadedList().reduce(function(t,p){ return t + (parseInt(p.mu) || 0); }, 0);
  return { memoryMU: mu, loadedMu: used, freeMu: mu - used };
}
function _netMuTotal(deck) { return _deckStats().memoryMU; }   // `deck` arg kept for call sites; source is _deckStats
function _netMuUsed()      { return _deckStats().loadedMu; }
/* ─ Program helpers (align with net-interface-contract §3: icon/effect/demon/carries) ─ */
function _progById(id) { return (_nr().programs || []).filter(function(p){ return p.id === id; })[0] || null; }
function _progSigil(p) {
  if (p && p.demon) return '❖';                    // Demon = carry container
  var c = ((p && p.class) || '').toLowerCase().trim();
  return _NET_SIGILS[c] || '◈';
}
/* Clear, table-facing effect line — description of what the program DOES (never a formula). */
function _progEffect(p) { return (p && (p.effect || p.description || p.notes)) || ''; }
/* A program carried by any Demon (so it is nested, not listed/slotted on its own).
   COORDINATION: `carries` is a ROLES field NOT yet in net-interface-contract §3 — pending DATA
   ratification (net-progress-audit §ROLES, item 4). Kept minimal so it can be renamed on ratification. */
function _progCarrier(id) {
  return (_nr().programs || []).filter(function(d){ return d.demon && (d.carries||[]).indexOf(id) >= 0; })[0] || null;
}
/* Effective MU = own MU + (Demon) the MU of everything it carries. */
function _progEffMu(p) {
  var mu = parseInt(p && p.mu) || 0;
  if (p && p.demon) (p.carries || []).forEach(function(cid){ var c = _progById(cid); if (c) mu += parseInt(c.mu) || 0; });
  return mu;
}

/* ─── COMPUTER (Net access device gating exploration + deliveries) ─── */
var NC_DISTRICTS = ['A1 Little Italy','A2 Northside','A3 City Center','A4 Upper Eastside','A5 Upper Marina','A6 East Marina','B1 Westhill Gardens','B2 Corp. Center','B3 City Center Closeup','B4 Bank Block','B5 Old Downtown','B6 New Harbor','C1 NC University','C2 Lake Park','C3 Eastpark & Japantown','C4 Little China','C5 Studio City','C6 Charter Hill'];
function _csNet() {
  if (!CS.net) CS.net = { computer:null, owned:[], deliveries:[], bookmarks:[], pinned:[], groups:[], history:[] };
  var n = CS.net;
  if (!Array.isArray(n.owned)) n.owned = [];
  // migrate a legacy single active machine into the owned list
  if (n.computer) { if (!n.computer.id) n.computer.id = _bankUid(); if (!n.owned.some(function (d) { return d.id === n.computer.id; })) n.owned.unshift(n.computer); n.activeDeviceId = n.computer.id; }
  return n;
}
function _compReach(c) { return c && typeof c.reach === 'number' ? c.reach : 0; }
function _compPower(c) { return c && typeof c.power === 'number' ? c.power : 0; }
function _compStealth(c) { return c && typeof c.stealth === 'number' ? c.stealth : 0; }
function _compUplink(c) { return (c && c.connection) || ''; }
function _deckReach() { var nr = CS.netrunner; return (nr && nr.deckId) ? 2 : 0; }
// Perk-adjusted effective stats (a machine carries at most one perk).
function _devReach(c) { if (!c) return 0; var r = _compReach(c); if (c.perk === 'signal' && c.connection === 'cellular') r += 1; return Math.max(0, Math.min(4, r)); }
function _devStealth(c) { if (!c) return 0; var s = _compStealth(c); if (c.perk === 'ghostos') s += 1; if (c.perk === 'hot') s -= 2; return Math.max(0, Math.min(3, s)); }
function _devPower(c) { if (!c) return 0; var p = _compPower(c); if (c.perk === 'compress') p += 1; return Math.max(0, p); }
function _effReach() { return Math.max(_devReach(_csNet().computer), _deckReach()); }
function _hasDevice() { return !!_csNet().computer || _deckReach() > 0; }
function _clampn(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
function _uplinkWord(u) { return u === 'landline' ? 'WIRED' : u === 'satellite' ? 'SAT' : u === 'cellular' ? 'CELL' : '—'; }
var COMP_PERKS = {
  // ── actually useful (wired to real mechanics) ──
  adblock:   { name:'Ad-scrubber',      desc:'Strips ads before they render — your feed stays clean.' },
  compress:  { name:'Compression core', desc:'Renders one tier above its class (+1 effective Power against the bandwidth gate).' },
  haggle:    { name:'Haggler AI',       desc:'Auto-negotiates every Net purchase — 15% off the sticker price.' },
  courier:   { name:'Priority courier', desc:'Bundled courier net — your Net orders arrive twice as fast.' },
  signal:    { name:'Signal booster',   desc:'Extends reach in the field (+1 Reach on a cellular uplink).' },
  ghostos:   { name:'Ghost OS',         desc:'Hardened, anonymized stack (+1 effective Stealth).' },
  ai:        { name:'AI copilot',       desc:'Auto-files every lead you uncover straight to your Files — no clicking.' },
  hot:       { name:'Hot (stolen)',     desc:'Flagged hardware — cheap for the specs, but it screams your location (−2 Stealth).' },
  // ── kept for lore / flavor (little or no mechanical effect) ──
  retro:     { name:'Retro core',       desc:'Renders classic old-web beautifully — a collector’s soul.', lore:true },
  sublock:   { name:'Subsidized',       desc:'Cheap, but a monthly corp fee and every packet is monitored.', lore:true },
  hardened:  { name:'EMP-hardened',     desc:'Shrugs off surges and jamming — a GM’s stat-drops bounce off it.', lore:true },
  overclock: { name:'Overclocked',      desc:'Pushed render, runs hot and loud (already baked into the numbers).', lore:true },
  mesh:      { name:'Mesh relay',       desc:'Off-grid short-range mesh — stays online where the towers die.', lore:true }
};
var COMP_CSS = '<style>' +
  '#computer-section .comp-card{border:2px solid #111;background:#fff;margin-bottom:16px}' +
  '#computer-section .comp-hud{display:flex;background:#111}' +
  '#computer-section .comp-hud-stat{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 4px;border-right:1px solid #333}' +
  '#computer-section .comp-hud-stat:last-child{border-right:none}' +
  '#computer-section .comp-hud-lbl{font-family:var(--head,sans-serif);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#9a9a9a}' +
  '#computer-section .comp-hud-val{font-family:var(--mono,monospace);font-size:23px;font-weight:bold;color:#fff;line-height:1}' +
  '#computer-section .comp-hud-word{font-size:15px;padding-top:5px}' +
  '#computer-section .comp-hud-sub{font-family:var(--mono,monospace);font-size:9px;color:#6f6f6f}' +
  '#computer-section .comp-name-row{display:flex;align-items:baseline;gap:8px;padding:11px 16px 0}' +
  '#computer-section .comp-name{font-family:var(--head,sans-serif);font-size:15px;letter-spacing:1px;text-transform:uppercase}' +
  '#computer-section .comp-maker{font-family:var(--mono,monospace);font-size:11px;color:#888}' +
  '#computer-section .comp-illegal{margin-left:auto;font-family:var(--head,sans-serif);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#fff;background:#c0392b;padding:2px 6px}' +
  '#computer-section .comp-blurb{font-family:var(--mono,monospace);font-size:12px;font-style:italic;color:#555;padding:4px 16px 0}' +
  '#computer-section .comp-perk{font-family:var(--mono,monospace);font-size:11px;color:#333;background:#f7f2e2;border-left:3px solid #b8860b;margin:9px 16px 0;padding:7px 10px;line-height:1.5}' +
  '#computer-section .comp-perk b{color:#111}' +
  '#computer-section .comp-readout{padding:6px 16px 14px}' +
  '#computer-section .comp-read{display:flex;gap:10px;padding:7px 0;border-top:1px solid #eee}' +
  '#computer-section .comp-read-k{flex:0 0 68px;font-family:var(--head,sans-serif);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#111;padding-top:1px}' +
  '#computer-section .comp-read-v{flex:1;font-family:var(--mono,monospace);font-size:12px;line-height:1.5;color:#333}' +
  '#computer-section .comp-read-v b{color:#111}' +
  '#computer-section .comp-warn{color:#b8860b}' +
  '#computer-section .comp-none{color:#767676;font-family:var(--mono,monospace);font-size:13px;padding:16px;line-height:1.6}' +
  '#computer-section .comp-none b{color:#111}' +
  '#computer-section .comp-dev-h{font-family:var(--head,sans-serif);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:4px 0 6px}' +
  '#computer-section .comp-dev{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #ddd;margin-bottom:6px}' +
  '#computer-section .comp-dev.active{border-color:#111;background:#fafafa}' +
  '#computer-section .comp-dev-n{flex:1;font-family:var(--mono,monospace);font-size:13px}' +
  '#computer-section .comp-dev-tag{font-family:var(--head,sans-serif);font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#888;border:1px solid #ccc;padding:1px 4px;margin-left:4px}' +
  '#computer-section .comp-dev-ill{color:#c0392b;border-color:#c0392b}' +
  '#computer-section .comp-dev-s{font-family:var(--mono,monospace);font-size:11px;color:#666;white-space:nowrap}' +
  '#computer-section .comp-dev-act{font-family:var(--mono,monospace);font-size:11px;color:#1a7a2e;font-weight:bold;white-space:nowrap}' +
  '#computer-section .comp-dev-use{font-family:var(--head,sans-serif);font-size:10px;letter-spacing:1px;text-transform:uppercase;border:1px solid #111;background:#fff;padding:4px 8px;cursor:pointer}' +
  '#computer-section .comp-dev-use:hover{background:#111;color:#fff}' +
  '#computer-section .comp-dev-x{border:none;background:none;color:#bbb;cursor:pointer;font-family:var(--mono,monospace)}' +
  '#computer-section .comp-dev-x:hover{color:#c0392b}' +
  '#computer-section .comp-acts{display:flex;gap:8px;margin:4px 0 16px}' +
  '#computer-section .comp-act{font-family:var(--head,sans-serif);font-size:10px;letter-spacing:1px;text-transform:uppercase;border:1.5px solid #111;background:#fff;padding:8px 12px;cursor:pointer}' +
  '#computer-section .comp-act:hover{background:#111;color:#fff}' +
  '.cc-cat-list{max-height:56vh;overflow:auto;margin:2px 0}' +
  '.cc-grp{font-family:var(--head,sans-serif);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;padding:14px 6px 5px}' +
  '.cc-cat-row{display:grid;grid-template-columns:1fr auto;grid-template-areas:\'main cost\' \'perk cost\';gap:3px 12px;padding:9px 6px;border-bottom:1px solid #eee;cursor:pointer}' +
  '.cc-cat-row:hover{background:#f7f5ee}' +
  '.cc-cat-main{grid-area:main;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}' +
  '.cc-cat-n{font-family:var(--mono,monospace);font-size:13px;font-weight:bold}' +
  '.cc-cat-ill{color:#c0392b;font-size:9px;letter-spacing:1px;text-transform:uppercase;font-family:var(--head,sans-serif);margin-left:6px}' +
  '.cc-cat-s{font-family:var(--mono,monospace);font-size:11px;color:#888}' +
  '.cc-cat-perk{grid-area:perk;font-family:var(--mono,monospace);font-size:11px;color:#6a5a1a;background:#f7f2e2;border-left:3px solid #b8860b;padding:3px 8px;line-height:1.45;align-self:start}' +
  '.cc-cat-perk b{color:#111}.cc-cat-perk i{font-style:normal;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#b0a06a}' +
  '.cc-cat-perk.lore{color:#999;background:#f3f3f3;border-left-color:#ccc}.cc-cat-perk.lore b{color:#666}.cc-cat-perk.lore i{color:#bbb}' +
  '.cc-cat-noperk{color:#bbb;background:none;border-left-color:#eee}' +
  '.cc-cat-c{grid-area:cost;align-self:center;font-family:var(--mono,monospace);color:#b8860b;font-weight:bold;white-space:nowrap}' +
  '#computer-section .comp-deliv-wrap{margin-top:4px}' +
  '#computer-section .comp-deliv-h{font-family:var(--head,sans-serif);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:4px 0 6px}' +
  '#computer-section .comp-deliv{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #eee}' +
  '#computer-section .comp-deliv-n{flex:1;font-family:var(--mono,monospace);font-size:13px}' +
  '#computer-section .comp-deliv-s{font-family:var(--mono,monospace);font-size:12px}' +
  '#computer-section .comp-in_transit{color:#b8860b}#computer-section .comp-delivered{color:#1a7a2e}#computer-section .comp-seized{color:#c0392b}' +
  '#computer-section .comp-deliv-a{color:#888;font-size:11px}' +
  '#computer-section .comp-os-h{font-family:var(--head,sans-serif);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:18px 0 8px}' +
  '#computer-section .comp-os-cur{border:2px solid #111;background:#fff;padding:12px 14px;margin-bottom:10px}' +
  '#computer-section .comp-os-name{font-family:var(--head,sans-serif);font-size:16px;letter-spacing:1px;text-transform:uppercase;display:flex;align-items:baseline;gap:10px}' +
  '#computer-section .comp-os-maker{font-family:var(--mono,monospace);font-size:11px;color:#888;text-transform:none;letter-spacing:0}' +
  '#computer-section .comp-os-tag{font-family:var(--mono,monospace);font-size:12px;font-style:italic;color:#555;margin-top:3px}' +
  '#computer-section .comp-os-lock{font-family:var(--mono,monospace);font-size:11px;color:#b8860b;margin-top:8px}' +
  '#computer-section .comp-os-list{display:flex;flex-direction:column;gap:8px}' +
  '#computer-section .comp-os-opt{border:1px solid #ddd;padding:10px 12px}' +
  '#computer-section .comp-os-opt.active{border-color:#111;background:#fafafa}' +
  '#computer-section .comp-os-opt-head{display:flex;align-items:baseline;gap:10px}' +
  '#computer-section .comp-os-opt-n{font-family:var(--mono,monospace);font-size:13px;font-weight:bold}' +
  '#computer-section .comp-os-opt-v{font-family:var(--mono,monospace);font-size:11px;color:#999}' +
  '#computer-section .comp-os-badge{margin-left:auto;font-family:var(--head,sans-serif);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#1a7a2e;white-space:nowrap}' +
  '#computer-section .comp-os-use{margin-left:auto;font-family:var(--head,sans-serif);font-size:10px;letter-spacing:1px;text-transform:uppercase;border:1px solid #111;background:#fff;padding:4px 10px;cursor:pointer;white-space:nowrap}' +
  '#computer-section .comp-os-use:hover{background:#111;color:#fff}' +
  '#computer-section .comp-os-pc{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;margin-top:8px}' +
  '#computer-section .comp-os-perk{font-family:var(--mono,monospace);font-size:11px;color:#2a6b3a;line-height:1.4}' +
  '#computer-section .comp-os-quirk{font-family:var(--mono,monospace);font-size:11px;color:#a05a2a;line-height:1.4}' +
  '#computer-section .comp-os-sb{margin-top:10px;border-top:1px solid #eee}' +
  '#computer-section .comp-os-sb-row{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #f2f2f2}' +
  '#computer-section .comp-os-sb-k{flex:0 0 30%;font-family:var(--head,sans-serif);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#111;padding-top:1px}' +
  '#computer-section .comp-os-sb-v{flex:1;font-family:var(--mono,monospace);font-size:11px;color:#555;line-height:1.4}' +
  '#computer-section .comp-os-sb-v b{color:#111}' +
  '#computer-section .comp-os-stamp{display:inline-block;width:8px;height:8px;margin-right:6px;vertical-align:middle}' +
  '#computer-section .comp-os-stamp.good{background:#1a7a2e}' +
  '#computer-section .comp-os-stamp.warn{background:#b8860b}' +
  '#computer-section .comp-os-stamp.bad{background:#c0392b}' +
  '#computer-section .comp-os-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}' +
  '#computer-section .comp-os-mtag{font-family:var(--mono,monospace);font-size:10px;padding:1px 6px;border:1px solid #ddd;color:#666}' +
  '#computer-section .comp-os-mtag.good{color:#1a7a2e;border-color:#1a7a2e}' +
  '#computer-section .comp-os-mtag.warn{color:#b8860b;border-color:#b8860b}' +
  '#computer-section .comp-os-mtag.bad{color:#c0392b;border-color:#c0392b}' +
'</style>';

/* ═══════════════ PRESS CARD (Media role) ═══════════════
   Sibling of the netrunner deck. Surfaces the character's Credibility (the CP2020 Media
   special ability that gates published reach on the Net), the outlets they're attached to,
   and their three kinds of paying contract:
     · ad-régie    — clean money, selling ad space on an outlet they run;
     · advertorial — a client supplies the material; the journalist composes it and stakes
                     their Credibility (disclose = safe/−reach, bury = lucrative/risky);
     · staff       — on the payroll, paid per article or per month against a quota.
   The app never rolls: the "Credibility roll" on a buried advertorial is a flag the table
   resolves. This mirrors the COMMISSIONED overlay in the Media desktop app. */
function _csPress() {
  if (!CS.press) CS.press = { affiliations: [], contracts: [], heat: 0, notes: '' };
  var p = CS.press;
  if (!Array.isArray(p.affiliations)) p.affiliations = [];
  if (!Array.isArray(p.contracts)) p.contracts = [];
  if (typeof p.heat !== 'number') p.heat = 0;
  if (typeof p.notes !== 'string') p.notes = '';
  return p;
}
function _pressCred() { return (CS.specialAbilities && CS.specialAbilities['Credibility']) || 0; }
var PRESS_MODES = {
  adregie:     { label: 'AD DEAL',     blurb: 'Clean money — you run an advertiser’s placement on an outlet.' },
  advertorial: { label: 'ADVERTORIAL', blurb: 'A client supplies the material; you compose it and stake your Credibility.' },
  staff:       { label: 'STAFF',       blurb: 'On the payroll — paid per article or per month against a quota.' }
};
function _pcMoney(n) { n = parseInt(n, 10) || 0; return n ? '€' + n.toLocaleString() : 'no fee'; }
function _pcPayout(po) { if (!po || !po.metric || po.metric === 'onPublish') return 'paid on delivery'; var l = { reach: 'reach', likes: 'likes', comments: 'comments' }[po.metric] || po.metric; return 'paid when ' + l + ' reach ' + (parseInt(po.threshold, 10) || 0); }
function _pcTerms(c) {
  if (c.mode === 'adregie') {
    var cpm = parseInt(c.cpm, 10) || 0;
    return '<div class="pc-terms">' + (cpm ? '€' + cpm.toLocaleString() + ' per 1,000 views' : 'unpaid placement') + (c.contentType && c.contentType !== 'any' ? ' · ' + _esc(c.contentType) + ' content' : '') + '</div>';
  }
  var feeVal = (c.fee != null ? c.fee : c.rate);
  if (feeVal == null && !c.payout) return '';
  return '<div class="pc-terms">' + _pcMoney(feeVal) + (c.payout ? ' · ' + _pcPayout(c.payout) : '') +
    (c.discloseRequired ? ' · disclosure required' : '') + '</div>';
}
function _pcAccountRow() {
  var accs = ((CS.lifestyle && CS.lifestyle.accounts) || []).filter(function (a) { return a && !a.closed; });
  if (!accs.length) return '<div class="pc-payacct pc-payacct-none">No bank account yet — open one in <b>Life</b> to receive fees.</div>';
  var cur = (CS.press && CS.press.payAccount) || (CS.lifestyle && CS.lifestyle.activeAccountId) || accs[0].id;
  return '<div class="pc-payacct"><span class="pc-payacct-l">Pay fees into</span><select class="pc-in" onchange="pressSetPayAccount(this.value)">' +
    accs.map(function (a) { return '<option value="' + a.id + '"' + (a.id === cur ? ' selected' : '') + '>' + _esc(a.name || 'account') + ' (' + (parseFloat(a.balance) || 0).toLocaleString() + 'eb)</option>'; }).join('') +
    '</select></div>';
}
function _pcMarket() { var m = window.__mediaMarket; return (m && m.market) ? m.market : { ads: [], posts: [], sponsors: [] }; }
// Existing press outlets (app==='press' sites) — fetched from the hub in joined mode; empty offline.
var _pcOutletsCache = null;
function _pressOutlets(cb) {
  if (_pcOutletsCache) { cb(_pcOutletsCache); return; }
  var code = new URLSearchParams(location.search).get('campaign');
  if (!code) { cb([]); return; }
  _pcApi('campaigns/' + encodeURIComponent(code) + '/sites').then(function (d) {
    var items = (d && d.items) || [];
    if (!items.length) { _pcOutletsCache = []; cb([]); return; }
    Promise.all(items.map(function (it) {
      return _pcApi('campaigns/' + encodeURIComponent(code) + '/sites/' + encodeURIComponent(it.name)).then(function (site) {
        var j = site && (site.json || site);
        return (j && j.app === 'press') ? { id: j.id, name: j.name || 'outlet' } : null;
      });
    })).then(function (arr) { _pcOutletsCache = arr.filter(Boolean); cb(_pcOutletsCache); }, function () { cb([]); });
  }, function () { cb([]); });
}
function _fillOutletDatalist() {
  var dl = document.getElementById('pc-outlets'); if (!dl) return;
  _pressOutlets(function (list) { var d2 = document.getElementById('pc-outlets'); if (!d2) return; d2.innerHTML = list.map(function (o) { return '<option value="' + _esc(o.name) + '"></option>'; }).join(''); });
}
var PRESS_CSS = '<style>' +
  '#press-section{font-family:var(--mono,monospace);margin-top:18px;border:2px solid #111;background:#fff;padding:14px}' +
  '#press-section .pc-head{display:flex;align-items:center;gap:8px;font-size:13px;letter-spacing:2.5px;font-weight:700;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #111}' +
  '#press-section .pc-tut{margin-left:auto;background:none;border:0;color:#888;cursor:pointer;font:inherit;font-size:11px;letter-spacing:1px;text-decoration:underline;text-underline-offset:3px}#press-section .pc-tut:hover{color:#111}' +
  '#press-section .pc-terms{font-size:12px;font-weight:700;letter-spacing:.5px;margin:8px 0;padding:5px 8px;background:#f4f4f4;border-left:3px solid #111}' +
  '#press-section .pc-payacct{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px dashed #ccc;font-size:12px}' +
  '#press-section .pc-payacct-l{font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase;white-space:nowrap}' +
  '#press-section .pc-payacct select{flex:1;max-width:280px}' +
  '#press-section .pc-payacct-none{display:block;color:#888;border-bottom:1px dashed #ccc;padding-bottom:10px}' +
  '#press-section .pc-offer{border:1.5px solid #111;padding:9px 11px;margin-bottom:9px}' +
  '#press-section .pc-offer-k{font-size:10px;letter-spacing:1px;font-weight:700;border:1px solid #111;display:inline-block;padding:1px 6px;margin-bottom:6px}' +
  '#press-section .pc-offer-b{font-size:13px;margin-bottom:4px}' +
  '#press-section .pc-offer-d{font-size:12px;color:#555;line-height:1.45;margin-bottom:6px;border-left:2px solid #ddd;padding-left:8px}' +
  '#press-section .pc-offer-a{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
  '#press-section .pc-offer-note{font-size:11px;color:#888;flex:1}' +
  '#press-section .pc-hero{display:flex;align-items:stretch;gap:0;border:2px solid #111;margin-bottom:14px}' +
  '#press-section .pc-hero-cred{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 16px;background:#111;color:#fff;min-width:92px}' +
  '#press-section .pc-cred-n{font-size:40px;font-weight:700;line-height:.95}#press-section .pc-cred-n small{font-size:15px;vertical-align:super}' +
  '#press-section .pc-cred-l{font-size:9px;letter-spacing:2px;margin-top:4px}' +
  '#press-section .pc-hero-txt{padding:10px 14px;display:flex;flex-direction:column;justify-content:center;font-size:12px;color:#333;line-height:1.5}' +
  '#press-section .pc-hero-txt b{color:#111}' +
  '#press-section.pc-nocred .pc-hero-cred{background:#666}' +
  '#press-section .pc-warn{color:#c0392b;font-weight:700}' +
  '#press-section .pc-grp{border:2px solid #111;margin-bottom:14px}' +
  '#press-section .pc-grp-h{background:#111;color:#fff;padding:5px 10px;font-size:11px;letter-spacing:2px;font-weight:700;display:flex;align-items:center;justify-content:space-between}' +
  '#press-section .pc-grp-body{padding:10px}' +
  '#press-section .pc-empty{color:#888;font-size:12px;padding:6px 2px}' +
  '#press-section .pc-addrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
  '#press-section .pc-add{font:inherit;font-size:11px;letter-spacing:1px;font-weight:700;background:#fff;border:1.5px solid #111;padding:5px 9px;cursor:pointer}#press-section .pc-add:hover{background:#111;color:#fff}' +
  '#press-section .pc-card{border:1.5px solid #111;padding:8px 10px;margin-bottom:8px}' +
  '#press-section .pc-card:last-child{margin-bottom:0}' +
  '#press-section .pc-card.ended{opacity:.55}' +
  '#press-section .pc-card-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
  '#press-section .pc-badge{font-size:10px;letter-spacing:1px;font-weight:700;border:1.5px solid #111;padding:2px 6px}' +
  '#press-section .pc-card-blurb{flex:1;font-size:11px;color:#666;line-height:1.4}' +
  '#press-section .pc-card-a{display:flex;gap:4px}' +
  '#press-section .pc-mini{font:inherit;font-size:10px;letter-spacing:1px;background:#fff;border:1px solid #111;padding:2px 7px;cursor:pointer}#press-section .pc-mini:hover{background:#111;color:#fff}' +
  '#press-section .pc-mini.del:hover{background:#c0392b;border-color:#c0392b}' +
  '#press-section .pc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}' +
  '#press-section .pc-f{display:flex;flex-direction:column;gap:3px}' +
  '#press-section .pc-f-l{font-size:9px;letter-spacing:1px;color:#888;text-transform:uppercase}' +
  '#press-section .pc-in{font:inherit;font-size:12px;border:1px solid #ccc;padding:4px 6px;background:#fff}#press-section .pc-in:focus{outline:none;border-color:#111}' +
  '#press-section .pc-chk{display:flex;align-items:center;gap:6px;font-size:12px;margin-top:8px;cursor:pointer}' +
  '#press-section .pc-note-line{font-size:11px;color:#c0392b;margin-top:6px;font-weight:700}' +
  '#press-section .pc-note-ok{font-size:11px;color:#666;margin-top:6px}' +
  '#press-section .pc-quota{font-size:11px;color:#333;margin-top:6px}' +
  '#press-section .pc-heat{display:flex;align-items:center;gap:10px}' +
  '#press-section .pc-heat input[type=range]{flex:1}' +
  '#press-section .pc-heat-v{font-size:22px;font-weight:700;min-width:34px;text-align:right}' +
  '#press-section .pc-heat-l{font-size:11px;color:#666}' +
  '#press-section .pc-ta{width:100%;font:inherit;font-size:12px;border:1px solid #ccc;padding:6px;background:#fff;resize:vertical;min-height:44px;box-sizing:border-box}#press-section .pc-ta:focus{outline:none;border-color:#111}' +
'</style>';

function _pcField(label, inner) { return '<label class="pc-f"><span class="pc-f-l">' + label + '</span>' + inner + '</label>'; }
function _pcOutletIn(id, field, val) {
  return '<input class="pc-in" list="pc-outlets" value="' + _esc(val == null ? '' : String(val)) + '" placeholder="pick or type an outlet" oninput="pressSetContract(\'' + id + '\',\'' + field + '\',this.value)">';
}
function _pcIn(id, field, val, ph, type) {
  return '<input class="pc-in" type="' + (type || 'text') + '"' + (type === 'number' ? ' min="0"' : '') +
    ' value="' + _esc(val == null ? '' : String(val)) + '" placeholder="' + _esc(ph || '') + '"' +
    ' oninput="pressSetContract(\'' + id + '\',\'' + field + '\',this.value)">';
}
function _pcContractFields(c) {
  if (c.mode === 'adregie') {
    return '<div class="pc-grid">' +
      _pcField('client / advertiser', _pcIn(c.id, 'client', c.client, 'who’s paying')) +
      _pcField('outlet it runs on', _pcOutletIn(c.id, 'siteName', c.siteName)) +
      _pcField('rate (€ / 1,000 views)', _pcIn(c.id, 'cpm', c.cpm, '0', 'number')) +
    '</div>' +
    '<div class="pc-note-ok">Pays each cycle as the piece gains views' + (parseInt(c.paidViews, 10) ? ' — earned on ' + (parseInt(c.paidViews, 10) || 0).toLocaleString() + ' views so far' : '') + '.</div>';
  }
  if (c.mode === 'advertorial') {
    var disc = c.disclosed !== false;
    return '<div class="pc-grid">' +
      _pcField('client', _pcIn(c.id, 'client', c.client, 'who commissioned it')) +
      _pcField('subject', _pcIn(c.id, 'subject', c.subject, 'what it pushes / buries')) +
      _pcField('fee (€)', _pcIn(c.id, 'fee', c.fee, '0', 'number')) +
    '</div>' +
    '<label class="pc-chk"><input type="checkbox"' + (disc ? ' checked' : '') + ' onchange="pressToggleContract(\'' + c.id + '\',\'disclosed\')"> disclose it’s sponsored</label>' +
    (disc
      ? '<div class="pc-note-ok">Disclosed — safe, but reach takes a hit (×0.7). No Credibility at stake.</div>'
      : '<div class="pc-note-line">Buried — lucrative (×1.15 reach) but if it surfaces the table calls a Credibility roll → crash.</div>');
  }
  // staff
  var per = c.per === 'month' ? 'month' : 'article';
  var quota = parseInt(c.quota, 10) || 0, filled = parseInt(c.filled, 10) || 0;
  return '<div class="pc-grid">' +
    _pcField('outlet / employer', _pcOutletIn(c.id, 'outlet', c.outlet)) +
    _pcField('pay (€)', _pcIn(c.id, 'pay', c.pay, '0', 'number')) +
    _pcField('per', '<select class="pc-in" onchange="pressSetContract(\'' + c.id + '\',\'per\',this.value)">' +
      '<option value="article"' + (per === 'article' ? ' selected' : '') + '>article</option>' +
      '<option value="month"' + (per === 'month' ? ' selected' : '') + '>month</option></select>') +
    _pcField('quota', _pcIn(c.id, 'quota', c.quota, '0', 'number')) +
    _pcField('filed', _pcIn(c.id, 'filled', c.filled, '0', 'number')) +
  '</div>' +
  (quota ? '<div class="pc-quota">Filed <b>' + filled + '</b> / ' + quota + (filled >= quota ? ' — quota met.' : ' — ' + (quota - filled) + ' to go.') + '</div>' : '');
}

function renderPress() {
  var host = document.getElementById('press-section'); if (!host) return;
  // Media-only, exactly like the netrunner's Digital Identity block: hidden for everyone else.
  if (!_isMedia()) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = '';
  var p = _csPress(), cred = _pressCred();
  host.className = cred > 0 ? '' : 'pc-nocred';

  var hero = '<div class="pc-head">PRESS CARD' +
      '<button class="pc-tut" onclick="tutoOpen(\'press-card\')">how it works</button></div>' +
    '<div class="pc-hero">' +
    '<div class="pc-hero-cred"><span class="pc-cred-n">' + cred + '<small>/10</small></span><span class="pc-cred-l">CREDIBILITY</span></div>' +
    '<div class="pc-hero-txt">' + (cred > 0
      ? 'Credibility is the Media special ability that governs how far your stories travel — it gates reach every time you publish from a media suite.'
      : '<b>Credibility not set.</b> Your stories won’t travel until you set it in <b>Stats &amp; Skills → Special Abilities</b>.') +
    '</div></div>';

  /* Affiliations */
  var affRows = p.affiliations.length ? p.affiliations.map(function (a) {
    return '<div class="pc-card"><div class="pc-card-h"><span class="pc-badge">OUTLET</span>' +
      '<div class="pc-card-a"><button class="pc-mini del" onclick="pressDelAffil(\'' + a.id + '\')">remove</button></div></div>' +
      '<div class="pc-grid">' +
        _pcField('outlet', '<input class="pc-in" list="pc-outlets" value="' + _esc(a.outlet || '') + '" placeholder="pick or type an outlet" oninput="pressSetAffil(\'' + a.id + '\',\'outlet\',this.value)">') +
        _pcField('your role', '<select class="pc-in" onchange="pressSetAffil(\'' + a.id + '\',\'rel\',this.value)">' +
          ['staff', 'freelance', 'stringer', 'owner'].map(function (r) { return '<option value="' + r + '"' + ((a.rel || 'freelance') === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>') +
        _pcField('press pass #', '<input class="pc-in" value="' + _esc(a.pass || '') + '" placeholder="optional" oninput="pressSetAffil(\'' + a.id + '\',\'pass\',this.value)">') +
      '</div></div>';
  }).join('') : '<div class="pc-empty">No outlet affiliations. Add the mastheads you write for.</div>';
  var affGrp = '<div class="pc-grp"><div class="pc-grp-h"><span>AFFILIATIONS</span></div><div class="pc-grp-body">' +
    affRows + '<div class="pc-addrow"><button class="pc-add" onclick="pressAddAffil()">+ outlet</button></div></div></div>';

  /* Offers proposed by the GM (targeted sponsors on the sheet + the open marketplace) */
  var offersT = ((CS.net && CS.net.media && CS.net.media.offers) || []);
  var _mk = _pcMarket(), _taken = {};
  p.contracts.concat(p.affiliations).forEach(function (x) { if (x.sourceId) _taken[x.sourceId] = 1; });
  var _oAds = (_mk.ads || []).filter(function (a) { return !a.hidden && !_taken[a.id]; });
  var _oPos = (_mk.posts || []).filter(function (x) { return !_taken[x.id]; });
  var offRows = '';
  offersT.forEach(function (o) {
    offRows += '<div class="pc-offer"><div class="pc-offer-k">SPONSOR</div>' +
      '<div class="pc-offer-b"><b>' + _esc(o.client || 'a client') + '</b> · ' + _pcMoney(o.fee) + ' · ' + _esc(_pcPayout(o.payout)) + (o.disclose ? ' · disclosure required' : '') + '</div>' +
      (o.brief ? '<div class="pc-offer-d">' + _esc(o.brief) + '</div>' : '') +
      '<div class="pc-offer-a"><span class="pc-offer-note">accept it in your media app to open the dossier</span><button class="pc-mini del" onclick="pressDismissSponsor(\'' + o.id + '\')">dismiss</button></div></div>';
  });
  _oAds.forEach(function (a) {
    offRows += '<div class="pc-offer"><div class="pc-offer-k">AD DEAL</div>' +
      '<div class="pc-offer-b"><b>' + _esc(a.name || 'Ad deal') + '</b> · €' + (parseInt(a.cpm, 10) || 0).toLocaleString() + ' per 1,000 views · ' + _esc(a.contentType || 'any') + ' content</div>' +
      '<div class="pc-offer-a"><button class="pc-mini" onclick="pressTakeAd(\'' + a.id + '\')">take</button></div></div>';
  });
  _oPos.forEach(function (x) {
    offRows += '<div class="pc-offer"><div class="pc-offer-k">POSITION</div>' +
      '<div class="pc-offer-b"><b>' + _esc(x.role || 'freelance') + '</b> at <b>' + _esc(x.outletName || 'outlet') + '</b>' + (x.role === 'staff' ? ' · €' + (parseInt(x.pay, 10) || 0).toLocaleString() + ' / piece · quota ' + (parseInt(x.quota, 10) || 0) : '') + '</div>' +
      '<div class="pc-offer-a"><button class="pc-mini" onclick="pressJoinPost(\'' + x.id + '\')">join</button></div></div>';
  });
  var offGrp = offRows ? '<div class="pc-grp"><div class="pc-grp-h"><span>OFFERS FROM THE DESK</span></div><div class="pc-grp-body">' + offRows + '</div></div>' : '';

  /* Contracts */
  var conRows = p.contracts.length ? p.contracts.map(function (c) {
    var m = PRESS_MODES[c.mode] || PRESS_MODES.adregie, ended = c.status === 'ended';
    return '<div class="pc-card' + (ended ? ' ended' : '') + '">' +
      '<div class="pc-card-h"><span class="pc-badge">' + m.label + '</span>' +
      '<span class="pc-card-blurb">' + m.blurb + '</span>' +
      '<div class="pc-card-a">' +
        '<button class="pc-mini" onclick="pressToggleContract(\'' + c.id + '\',\'status\')">' + (ended ? 'reopen' : 'end') + '</button>' +
        '<button class="pc-mini del" onclick="pressDelContract(\'' + c.id + '\')">remove</button>' +
      '</div></div>' + _pcTerms(c) + _pcContractFields(c) + '</div>';
  }).join('') : '<div class="pc-empty">No contracts yet. Take a gig from your media app’s desk — or add one here.</div>';
  var conGrp = '<div class="pc-grp"><div class="pc-grp-h"><span>CONTRACTS</span></div><div class="pc-grp-body">' +
    _pcAccountRow() + conRows + '<div class="pc-addrow">' +
      '<button class="pc-add" onclick="pressAddContract(\'adregie\')">+ ad deal</button>' +
      '<button class="pc-add" onclick="pressAddContract(\'advertorial\')">+ advertorial</button>' +
      '<button class="pc-add" onclick="pressAddContract(\'staff\')">+ staff</button>' +
    '</div></div></div>';

  /* Heat + notes */
  var heatWords = ['clean — nobody’s watching', 'noticed — a few enemies made', 'flagged — someone’s building a file', 'targeted — legal threats, tails', 'marked — they want you silenced'];
  var hw = heatWords[Math.min(4, Math.floor(p.heat / 2.5))] || heatWords[0];
  var heatGrp = '<div class="pc-grp"><div class="pc-grp-h"><span>REPUTATION &amp; HEAT</span></div><div class="pc-grp-body">' +
    '<div class="pc-heat"><input type="range" min="0" max="10" value="' + p.heat + '" oninput="pressSetHeat(this.value)">' +
    '<span class="pc-heat-v" id="pc-heat-v">' + p.heat + '</span></div>' +
    '<div class="pc-heat-l" id="pc-heat-l">' + hw + '</div>' +
    '<textarea class="pc-ta" placeholder="Reputation notes — who you’ve burned, who owes you, standing scoops…" oninput="pressSetNotes(this.value)" style="margin-top:8px">' + _esc(p.notes || '') + '</textarea>' +
  '</div></div>';

  host.innerHTML = PRESS_CSS + '<datalist id="pc-outlets"></datalist>' + hero + offGrp + affGrp + conGrp + heatGrp;
  _fillOutletDatalist();
}

/* press mutators — text edits persist silently (keep focus); structural edits re-render */
function pressAddContract(mode) {
  var p = _csPress();
  var c = { id: _bankUid(), mode: mode, status: 'active', client: '', notes: '' };
  if (mode === 'advertorial') c.disclosed = true;
  if (mode === 'adregie') { c.cpm = 0; c.paidViews = 0; }
  if (mode === 'staff') { c.per = 'article'; c.quota = 0; c.filled = 0; }
  p.contracts.push(c); _csPersist(); renderPress();
}
function _pressContract(id) { var p = _csPress(); for (var i = 0; i < p.contracts.length; i++) if (p.contracts[i].id === id) return p.contracts[i]; return null; }
function pressSetContract(id, field, val) { var c = _pressContract(id); if (!c) return; c[field] = val; _csPersist(); }
function pressToggleContract(id, field) {
  var c = _pressContract(id); if (!c) return;
  if (field === 'status') c.status = c.status === 'ended' ? 'active' : 'ended';
  else if (field === 'disclosed') c.disclosed = c.disclosed === false ? true : false;
  _csPersist(); renderPress();
}
function pressDelContract(id) { var p = _csPress(); p.contracts = p.contracts.filter(function (c) { return c.id !== id; }); _csPersist(); renderPress(); }
function pressSetPayAccount(id) { var p = _csPress(); p.payAccount = id; _csPersist(); }
function pressTakeAd(id) {
  var ad = (_pcMarket().ads || []).filter(function (a) { return a.id === id; })[0]; if (!ad) return;
  var p = _csPress(); if (p.contracts.some(function (x) { return x.sourceId === id; })) return;
  p.contracts.push({ id: _bankUid(), mode: 'adregie', status: 'active', client: ad.name || 'Ad deal', siteName: '', cpm: parseInt(ad.cpm, 10) || 0, contentType: ad.contentType || 'any', sourceId: id, paidViews: 0, notes: '' });
  _csPersist(); renderPress();
}
function pressJoinPost(id) {
  var post = (_pcMarket().posts || []).filter(function (x) { return x.id === id; })[0]; if (!post) return;
  var p = _csPress(); if (p.affiliations.some(function (x) { return x.sourceId === id; })) return;
  p.affiliations.push({ id: _bankUid(), sourceId: id, outlet: post.outletName || '', outletId: post.outletId || '', rel: post.role || 'freelance', pass: '' });
  if (post.role === 'staff') p.contracts.push({ id: _bankUid(), mode: 'staff', status: 'active', outlet: post.outletName || '', pay: parseInt(post.pay, 10) || 0, per: 'article', quota: parseInt(post.quota, 10) || 0, filled: 0, sourceId: id, notes: '' });
  _csPersist(); renderPress();
}
function pressDismissSponsor(id) { if (!(CS.net && CS.net.media && CS.net.media.offers)) return; CS.net.media.offers = CS.net.media.offers.filter(function (x) { return x.id !== id; }); _csPersist(); renderPress(); }
function pressAddAffil() { var p = _csPress(); p.affiliations.push({ id: _bankUid(), outlet: '', rel: 'freelance', pass: '' }); _csPersist(); renderPress(); }
function _pressAffil(id) { var p = _csPress(); for (var i = 0; i < p.affiliations.length; i++) if (p.affiliations[i].id === id) return p.affiliations[i]; return null; }
function pressSetAffil(id, field, val) { var a = _pressAffil(id); if (!a) return; a[field] = val; _csPersist(); }
function pressDelAffil(id) { var p = _csPress(); p.affiliations = p.affiliations.filter(function (a) { return a.id !== id; }); _csPersist(); renderPress(); }
function pressSetHeat(v) {
  var p = _csPress(); p.heat = _clampn(v, 0, 10); _csPersist();
  var vEl = document.getElementById('pc-heat-v'); if (vEl) vEl.textContent = p.heat;
  var lEl = document.getElementById('pc-heat-l'); if (lEl) { var w = ['clean — nobody’s watching', 'noticed — a few enemies made', 'flagged — someone’s building a file', 'targeted — legal threats, tails', 'marked — they want you silenced']; lEl.textContent = w[Math.min(4, Math.floor(p.heat / 2.5))] || w[0]; }
}
function pressSetNotes(v) { var p = _csPress(); p.notes = v; _csPersist(); }

function renderComputer() {
  var host = document.getElementById('computer-section'); if (!host) return;
  var net = _csNet(), c = net.computer, hasDeck = _deckReach() > 0, reach = _effReach();
  var reachLabels = ['broadcast sites only (citywide & up)','+ district nets','+ local & neighborhood sites','+ distant regions','the whole grid'];
  var powerLabels = ['nothing','text & old-web pages only','+ light media & one chat app','standard sites & chat apps — heavy corpo / braindance load stripped','rich media, apps & most corpo platforms','anything — corpo intranets included'];
  var uplinkText = { landline:'wired line — browse from a home only; private, hard to trace', cellular:'cellular — browse anywhere in city coverage; traceable to the towers', satellite:'satellite — connect anywhere incl. off-grid; laggy and conspicuous' };
  var stealthLabels = ['wide open — every move logged; shady buys leave a trail','light footprint — risky darknet / illegal buys may leave a trace','masked — reasonably quiet on the underground','ghost — you move through the dark net without a trace'];
  function readRow(k, v) { return '<div class="comp-read"><span class="comp-read-k">' + k + '</span><span class="comp-read-v">' + v + '</span></div>'; }

  var main;
  if (c) {
    var dR = _devReach(c), dS = _devStealth(c), pw = _compPower(c), up = _compUplink(c), perk = c.perk && COMP_PERKS[c.perk];
    main = '<div class="comp-hud">' +
        '<div class="comp-hud-stat"><span class="comp-hud-lbl">Reach</span><b class="comp-hud-val">' + dR + '</b><span class="comp-hud-sub">of 4</span></div>' +
        '<div class="comp-hud-stat"><span class="comp-hud-lbl">Power</span><b class="comp-hud-val">' + pw + '</b><span class="comp-hud-sub">of 5</span></div>' +
        '<div class="comp-hud-stat"><span class="comp-hud-lbl">Uplink</span><b class="comp-hud-val comp-hud-word">' + _uplinkWord(up) + '</b><span class="comp-hud-sub">' + _esc(up || '') + '</span></div>' +
        '<div class="comp-hud-stat"><span class="comp-hud-lbl">Stealth</span><b class="comp-hud-val">' + dS + '</b><span class="comp-hud-sub">of 3</span></div>' +
      '</div>' +
      '<div class="comp-name-row"><span class="comp-name">' + _esc(c.name || 'Device') + '</span>' + (c.maker && c.maker !== 'custom' && c.maker !== 'jury-rig' ? '<span class="comp-maker">' + _esc(c.maker) + '</span>' : '') + (c.legal === false ? '<span class="comp-illegal">illegal</span>' : '') + '</div>' +
      (c.blurb ? '<div class="comp-blurb">“' + _esc(c.blurb) + '”</div>' : '') +
      (perk ? '<div class="comp-perk"><b>' + _esc(perk.name) + '</b> — ' + _esc(perk.desc) + '</div>' : '') +
      '<div class="comp-readout">' +
        readRow('See', 'REACH ' + reach + ' — you reach ' + reachLabels[reach] + '.' + (_deckReach() > dR ? ' <span class="comp-warn">(boosted by your cyberdeck)</span>' : '')) +
        readRow('Render', 'POWER ' + pw + ' — ' + powerLabels[Math.min(5, pw)] + '.') +
        readRow('Connect', _esc(uplinkText[up] || 'unknown uplink') + '.') +
        readRow('Hide', 'STEALTH ' + dS + ' — ' + stealthLabels[dS] + '.') +
      '</div>';
  } else if (hasDeck) {
    main = '<div class="comp-none">No personal computer. You reach the Net through your <b>cyberdeck</b> only (reach ' + reach + ') — heavy and conspicuous, but it works. A dedicated machine is safer and renders more.</div>';
  } else {
    main = '<div class="comp-none"><b>No device — the Net is dark.</b> Without a computer or a jacked cyberdeck you can’t get online at all. Add a machine below.</div>';
  }

  var owned = net.owned || [];
  var devs = owned.length ? owned.map(function (d) {
    var actv = c && d.id === net.activeDeviceId;
    return '<div class="comp-dev' + (actv ? ' active' : '') + '">' +
      '<span class="comp-dev-n">' + _esc(d.name || 'Device') + (d.custom ? '<span class="comp-dev-tag">custom</span>' : '') + (d.legal === false ? '<span class="comp-dev-tag comp-dev-ill">illegal</span>' : '') + '</span>' +
      '<span class="comp-dev-s">R' + _devReach(d) + ' P' + _compPower(d) + ' ' + _uplinkWord(_compUplink(d)) + ' S' + _devStealth(d) + '</span>' +
      (actv ? '<span class="comp-dev-act">● active</span>' : '<button class="comp-dev-use" onclick="csSetActiveDevice(\'' + d.id + '\')">use</button>') +
      '<button class="comp-dev-x" title="Remove" onclick="csRemoveDevice(\'' + d.id + '\')">✕</button>' +
    '</div>';
  }).join('') : '<div class="comp-none" style="padding:8px 0">No devices yet — add one below.</div>';
  var actions = '<div class="comp-acts"><button class="comp-act" onclick="csAddFromCatalog()">＋ From catalog</button><button class="comp-act" onclick="csDesignCustom()">✎ Design custom</button></div>';

  var ds = net.deliveries || [];
  var deliv = '<div class="comp-deliv-h">Deliveries</div>' + (ds.length ?
    ds.slice().reverse().map(function(d){
      return '<div class="comp-deliv"><span class="comp-deliv-n">' + _esc(d.name||'item') + '</span>' +
        '<span class="comp-deliv-s comp-' + _esc(d.status) + '">' + _esc(d.status) + (d.status==='in_transit' ? ' · ETA ' + d.eta + 'h' : '') + '</span>' +
        '<span class="comp-deliv-a">→ ' + _esc(d.address||'') + '</span></div>';
    }).join('') :
    '<div class="comp-none">No deliveries. Buy something on the Net and it ships to your home.</div>');

  host.innerHTML = COMP_CSS +
    '<div class="comp-card">' + main + '</div>' +
    _osBlock(c) +
    '<div class="comp-dev-h">Your devices</div>' + devs + actions +
    '<div class="comp-deliv-wrap">' + deliv + '</div>';
}
/* ── Operating system: chosen HERE (on the sheet), gated by the machine. The
      desktop app (app.html) reads net.desktop.os; a corpo rig forces its OS. ── */
function _osBlock(c) {
  if (!window.DesktopOS) return '';
  if (!c) return '<div class="comp-os-h">Operating system</div><div class="comp-none">Add a machine to install an operating system.</div>';
  var dk = (CS.net && CS.net.desktop) || {};
  var chosen = dk.os || null, owned = dk.ownedOS || [];
  var forcedId = DesktopOS.forced(c), curId = DesktopOS.resolve(c, chosen, owned), cur = DesktopOS.byId(curId) || {};
  var html = '<div class="comp-os-h">Operating system</div>' +
    '<div class="comp-os-cur"><div class="comp-os-name">' + _esc(cur.name || '—') + '<span class="comp-os-maker">' + _esc(cur.vendor || '') + '</span></div>' +
    '<div class="comp-os-tag">' + _esc(cur.tagline || '') + '</div>' +
    (forcedId ? '<div class="comp-os-lock">▣ Locked by this hardware — a corporate machine only runs its own OS.</div>' : '') +
    _osStatFull(cur) + '</div>';
  html += '<div class="comp-os-list">';
  DesktopOS.available(c).forEach(function (o) {
    var isCur = o.id === curId, locked = forcedId && o.id !== curId;
    html += '<div class="comp-os-opt' + (isCur ? ' active' : '') + '"><div class="comp-os-opt-head">' +
      '<span class="comp-os-opt-n">' + _esc(o.name) + '</span><span class="comp-os-opt-v">' + _esc(o.vendor) + '</span>' +
      (isCur ? '<span class="comp-os-badge">● installed</span>' : (locked ? '' : csOsBtn(o, owned))) +
      '</div>' + _osTags(o) + '</div>';
  });
  return html + '</div>';
}
// The current OS's full mechanical stat-block (sourcebook), on the sheet.
function _osStatFull(o) {
  var DOS = window.DesktopOS, m = o.mech || {};
  return '<div class="comp-os-sb">' + DOS.MECH_ORDER.map(function (axis) {
    var spec = DOS.MECH[axis], v = spec.values[m[axis]] || {};
    return '<div class="comp-os-sb-row"><span class="comp-os-sb-k">' + _esc(spec.label) + '</span>' +
      '<span class="comp-os-sb-v"><span class="comp-os-stamp ' + (v.stamp || 'warn') + '"></span><b>' + _esc(v.tag || '—') + '</b> — ' + _esc(v.note || '') + '</span></div>';
  }).join('') +
  (o.traits || []).map(function (t) {
    return '<div class="comp-os-sb-row"><span class="comp-os-sb-k">Trait</span><span class="comp-os-sb-v">◆ ' + _esc(t) + '</span></div>';
  }).join('') + '</div>';
}
// A compact 4-tag mechanical summary for an OS option.
function _osTags(o) {
  var DOS = window.DesktopOS, m = o.mech || {};
  return '<div class="comp-os-tags">' + DOS.MECH_ORDER.map(function (axis) {
    var v = DOS.MECH[axis].values[m[axis]] || {};
    return '<span class="comp-os-mtag ' + (v.stamp || 'warn') + '">' + _esc(v.tag || '—') + '</span>';
  }).join('') + '</div>';
}
// Install button: shows the one-time price for a paid OS you don't own yet.
function csOsBtn(o, owned) {
  var cost = (window.DesktopOS && DesktopOS.installCost(o)) || 0, have = (owned || []).indexOf(o.id) >= 0;
  var lbl = (cost && !have) ? ('install · ' + cost + 'eb') : (have ? 'switch' : 'install');
  return '<button class="comp-os-use" onclick="csSetOS(\'' + o.id + '\')">' + lbl + '</button>';
}
function csSetOS(id) {
  var net = _csNet(); net.desktop = net.desktop || {}; net.desktop.ownedOS = net.desktop.ownedOS || [];
  var o = window.DesktopOS && DesktopOS.byId(id), cost = (window.DesktopOS && DesktopOS.installCost(o)) || 0;
  if (cost > 0 && net.desktop.ownedOS.indexOf(id) < 0) { csBuyOS(id, o, cost); return; }        // pay once
  if (o && o.sketchy && net.desktop.ownedOS.indexOf(id) < 0) { csWarnOS(id, o); return; }        // unsigned: warn first
  net.desktop.os = id; renderComputer(); try { _csPersist(); } catch (e) {}
}
// An unsigned / cracked OS isn't a one-click install — you accept the risk.
function csWarnOS(id, o) {
  var warn = o.installWarn || 'This is an <b>unsigned, cracked</b> build. It’s free and it works — but nobody vouches for it, and you don’t know what someone left inside. Install at your own risk (your GM may call for a <i>Programming</i> / <i>Awareness</i> roll).';
  _modalOpen('Install ' + (o.name || id) + '?',
    '<p class="cs-modal-lbl">' + warn + '</p>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button><button class="btn btn-sm btn-cy" onclick="csConfirmSketchy(\'' + id + '\')">Install anyway</button></div>');
}
function csConfirmSketchy(id) {
  var net = _csNet(); net.desktop = net.desktop || {}; net.desktop.ownedOS = net.desktop.ownedOS || [];
  if (net.desktop.ownedOS.indexOf(id) < 0) net.desktop.ownedOS.push(id);
  net.desktop.os = id; try { _modalClose(); } catch (e) {} renderComputer(); try { _csPersist(); } catch (e) {}
}
// One-time OS license: pick cash or an account, then debit + mark owned.
function csBuyOS(id, o, cost) {
  var accs = ((CS.lifestyle && CS.lifestyle.accounts) || []).filter(function (a) { return !a.closed; });
  var opts = '<option value="cash">Cash (' + Math.round(_csCash()) + 'eb)</option>' +
    accs.map(function (a) { return '<option value="' + a.id + '">' + _esc(a.name) + ' (' + Math.round(parseFloat(a.balance) || 0) + 'eb)</option>'; }).join('');
  _modalOpen('Install ' + (o.name || id) + ' — ' + cost + 'eb',
    '<p class="cs-modal-lbl">A one-time license. ' + _esc(o.tagline || '') + '</p>' +
    '<label class="cs-modal-lbl">Pay from</label><select id="os-pay" class="cs-modal-inp">' + opts + '</select>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button><button class="btn btn-sm btn-cy" onclick="csConfirmOS(\'' + id + '\',' + cost + ')">Pay &amp; install</button></div>');
}
function csConfirmOS(id, cost) {
  var src = (document.getElementById('os-pay') || {}).value || 'cash';
  if (src === 'cash') {
    if (_csCash() < cost) { alert('Not enough cash for that license (' + cost + 'eb).'); return; }
    CS.lifestyle = CS.lifestyle || {}; CS.lifestyle.cash = _csCash() - cost;
  } else {
    var acc = _accById(src); if (!acc) { alert('Account not found.'); return; }
    if ((parseFloat(acc.balance) || 0) < cost) { alert('Not enough in that account.'); return; }
    acc.balance = (parseFloat(acc.balance) || 0) - cost;
    _ledgerPush(acc, 'expense', 'OS license: ' + ((window.DesktopOS && DesktopOS.byId(id) || {}).name || id), cost);
  }
  var net = _csNet(); net.desktop = net.desktop || {}; net.desktop.ownedOS = net.desktop.ownedOS || [];
  if (net.desktop.ownedOS.indexOf(id) < 0) net.desktop.ownedOS.push(id);
  net.desktop.os = id;
  try { _modalClose(); } catch (e) {}
  try { applyCS(); } catch (e) {} try { renderComputer(); } catch (e) {} try { _csPersist(); } catch (e) {}
}
// ── Device management: you OWN devices (bought / found / built); one is active ──
function csAcquireDevice(d, activate, charge) {
  var net = _csNet();
  if (!d.id) d.id = _bankUid();
  net.owned = net.owned || [];
  net.owned.push(d);
  if (charge && d.cost > 0) { try { pendPurchase(d, 'computer', d.cost); } catch (e) {} }   // drops a buytray line, linked to the device via d.buyId
  if (activate || !net.computer) csSetActiveDevice(d.id);
  else { renderComputer(); try { _csPersist(); } catch (e) {} }
}
function csSetActiveDevice(id) {
  var net = _csNet();
  var d = (net.owned || []).filter(function (x) { return x.id === id; })[0] || null;
  net.computer = d; net.activeDeviceId = d ? d.id : null;
  renderComputer(); try { _csPersist(); } catch (e) {}
}
function csRemoveDevice(id) {
  var net = _csNet();
  net.owned = (net.owned || []).filter(function (x) { return x.id !== id; });
  if (net.activeDeviceId === id) { var f = net.owned[0] || null; net.computer = f; net.activeDeviceId = f ? f.id : null; }
  renderComputer(); try { _csPersist(); } catch (e) {}
}
var COMP_CLASS_LABEL = { phone:'Phones & burners', pocket:'Pocket decks', desktop:'Desktops', agent:'Field agents', wrist:'Wearables', implant:'Cyberware implants', vehicle:'Vehicle consoles', ai:'AI agents', salvage:'Salvage', custom:'Custom' };
var COMP_CLASS_ORDER = ['phone','pocket','desktop','agent','wrist','implant','vehicle','ai','salvage'];
function csAddFromCatalog() {
  var comps = (DB && DB.computers) || [];
  if (!comps.length) { alert('Computer catalog not loaded.'); return; }
  var groups = {}; comps.forEach(function (m, i) { (groups[m.class] = groups[m.class] || []).push(i); });
  var html = COMP_CLASS_ORDER.filter(function (k) { return groups[k]; }).map(function (k) {
    return '<div class="cc-grp">' + _esc(COMP_CLASS_LABEL[k] || k) + '</div>' + groups[k].map(function (i) {
      var m = comps[i], perk = m.perk && COMP_PERKS[m.perk];
      return '<div class="cc-cat-row" onclick="csCatPick(' + i + ')">' +
        '<div class="cc-cat-main"><span class="cc-cat-n">' + _esc(m.name) + (m.legal === false ? '<span class="cc-cat-ill">illegal</span>' : '') + '</span>' +
          '<span class="cc-cat-s">R' + m.reach + ' · P' + m.power + ' · ' + _uplinkWord(m.connection) + ' · S' + (m.stealth || 0) + '</span></div>' +
        (perk ? '<div class="cc-cat-perk' + (perk.lore ? ' lore' : '') + '"><b>' + _esc(perk.name) + '</b>' + (perk.lore ? ' <i>lore</i>' : '') + ' — ' + _esc(perk.desc) + '</div>' : '<div class="cc-cat-perk cc-cat-noperk">no perk</div>') +
        '<div class="cc-cat-c">' + (m.cost || 0) + 'eb</div></div>';
    }).join('');
  }).join('');
  _modalOpen('Add a machine — catalog', '<p class="cs-modal-lbl" style="margin:0 0 6px">Picking one charges its price to your buytray and stores it in your devices.</p><div class="cc-cat-list">' + html + '</div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Close</button></div>');
}
function csCatPick(i) {
  var m = ((DB && DB.computers) || [])[i]; if (!m) return;
  var d = JSON.parse(JSON.stringify(m)); d.id = _bankUid();
  _modalClose(); csAcquireDevice(d, true, true);
}
function csDesignCustom() {
  var perkOpts = '<option value="">— no perk —</option>' + Object.keys(COMP_PERKS).map(function (k) { return '<option value="' + k + '">' + COMP_PERKS[k].name + '</option>'; }).join('');
  _modalOpen('Design a custom machine',
    '<label class="cs-modal-lbl">Name</label><input id="cc-name" class="cs-modal-inp" placeholder="e.g. Franken-rig">' +
    '<label class="cs-modal-lbl">Reach (0–4) — how far you see</label><input id="cc-reach" class="cs-modal-inp" type="number" min="0" max="4" value="1">' +
    '<label class="cs-modal-lbl">Power (1–5) — how much you render / run</label><input id="cc-power" class="cs-modal-inp" type="number" min="1" max="5" value="2">' +
    '<label class="cs-modal-lbl">Uplink</label><select id="cc-uplink" class="cs-modal-inp"><option value="landline">wired — home only, private</option><option value="cellular" selected>cellular — mobile, traceable</option><option value="satellite">satellite — anywhere, loud</option></select>' +
    '<label class="cs-modal-lbl">Stealth (0–3) — how hidden</label><input id="cc-stealth" class="cs-modal-inp" type="number" min="0" max="3" value="1">' +
    '<label class="cs-modal-lbl">Perk</label><select id="cc-perk" class="cs-modal-inp">' + perkOpts + '</select>' +
    '<label class="cs-modal-lbl">Notes (optional)</label><input id="cc-blurb" class="cs-modal-inp" placeholder="what makes it yours">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button><button class="btn btn-sm btn-cy" onclick="csSaveCustom()">Build it</button></div>');
}
function csSaveCustom() {
  var g = function (id) { return (document.getElementById(id) || {}).value; };
  var name = (g('cc-name') || '').trim(); if (!name) { alert('Name your machine.'); return; }
  var d = { id: _bankUid(), name: name, maker: 'custom', class: 'custom', reach: _clampn(g('cc-reach'), 0, 4), power: _clampn(g('cc-power'), 1, 5), connection: g('cc-uplink') || 'cellular', stealth: _clampn(g('cc-stealth'), 0, 3), perk: g('cc-perk') || '', blurb: (g('cc-blurb') || '').trim(), cost: 0, legal: true, rarity: 'custom', custom: true };
  _modalClose(); csAcquireDevice(d, true, false);
}
// Legacy shim — old callers passed a catalog name.
function csSetComputer(name) {
  if (!name) { var net = _csNet(); net.computer = null; net.activeDeviceId = null; renderComputer(); try { _csPersist(); } catch (e) {} return; }
  var m = ((DB && DB.computers) || []).filter(function (x) { return x.name === name; })[0]; if (!m) return;
  var d = JSON.parse(JSON.stringify(m)); d.id = _bankUid(); csAcquireDevice(d, true);
}

function renderNet() {
  var el = document.getElementById('net-section'); if (!el) return;
  var nr = _nr();
  var deck = _activeDeckRecord();
  var muTotal = _netMuTotal(deck);
  var muUsed  = _netMuUsed();

  /* ── Mode toggle ── */
  var toggle = '<div class="net-mode-toggle">' +
    '<span class="net-mode-btn' + (nr.mode==='vanilla'?' active':'') + '" onclick="netToggleMode(\'vanilla\')">Vanilla</span>' +
    '<span class="net-mode-btn' + (nr.mode==='quickhacking'?' active':'') + '" onclick="netToggleMode(\'quickhacking\')">Quickhacking</span>' +
  '</div>';

  /* ── Col 1 (1/4): deck image with a HUD stat strip across the bottom ── */
  var imgSrc = nr.deckPhoto || (deck ? 'img/cyberdeck.png' : null);
  function hudStat(label, val) {
    return '<div class="net-hud-stat"><span class="net-hud-lbl">' + label + '</span><span class="net-hud-val">' + val + '</span></div>';
  }
  var statPins = '';
  if (deck) {
    statPins = '<div class="net-hud">' +
      hudStat('MU',  muTotal) +
      hudStat('SPD', deck.speed||'—') +
      hudStat('DW',  deck.dataWall||'—') +
      hudStat('CG',  deck.codeGate||'—') +
    '</div>';
  }
  var imgTag = '';

if (imgSrc) {
  imgTag =
    '<img class="net-deck-img" src="' + imgSrc + '" ' +
      (deck
        ? 'onclick="document.getElementById(\'net-deck-photo-input\').click()" title="Click to change photo"'
        : '') +
    '>';
}

var deckClear = nr.deckPhoto ? '<span class="img-clear" onclick="event.stopPropagation();netClearDeckPhoto()" title="Remove photo">✕</span>' : '';
var imgCol = '<div class="net-img-wrap">' +
  imgTag +
  deckClear +
  statPins +
'</div>';

  /* ── Col 2 (2/4): Deck info or deck picker ── */
  var infoCol;
  if (!deck) {
    /* No deck selected: 3/4 = img (default art) + search/pick */
    infoCol = '<div class="net-no-deck">' +
      '<div class="net-no-deck-title">No cyberdeck loaded</div>' +
      '<div class="item-search" style="position:relative;margin-bottom:6px">' +
        '<input id="net-deck-search" placeholder="search cyberdeck..." oninput="searchItems(\'deck\')" onfocus="searchItems(\'deck\')" autocomplete="off">' +
        '<div class="dropdown" id="net-deck-dropdown"></div>' +
      '</div>' +
      '<button class="btn btn-sm" onclick="netAddCustomDeckModal()">+ Custom deck</button>' +
    '</div>';
  } else {
    var deckType = (deck.type && deck.type.name) ? '<div class="net-deck-type">' + _esc(deck.type.name) + '</div>' : '';
    var deckDesc = deck.description ? '<div class="net-deck-desc">' + _esc(deck.description) + '</div>' : '';
    var pct = muTotal > 0 ? Math.min(100, Math.round(muUsed / muTotal * 100)) : 0;
    var muBar = '<div class="net-mu-bar-wrap">' +
      '<div class="net-mu-label">MU <strong>' + muUsed + '</strong> / ' + muTotal + '</div>' +
      '<div class="slot-bar"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';

    /* slotted programs (top-level only — carried subs roll up into their Demon) */
    var slotted = (nr.programs || []).filter(function(p){ return p.slotted && !_progCarrier(p.id); });
    var slottedRows = slotted.length ? slotted.map(function(p) {
      var carried = p.demon ? (p.carries||[]).map(_progById).filter(Boolean) : [];
      var subLine = carried.length
        ? '<span class="net-slot-carry" title="Carried by this Demon">' + carried.map(function(c){ return _esc(c.name); }).join(' · ') + '</span>'
        : '';
      return '<div class="net-slotted-row"' + (p.demon ? ' data-demon="1"' : '') + '>' +
        '<span class="net-sigil" title="' + _esc((p.class||'program')) + '">' + _progSigil(p) + '</span>' +
        '<span class="net-slotted-name" title="' + _esc(_progEffect(p)) + '">' + _esc(p.name) + (p.demon ? ' <span class="net-demon-tag">DEMON</span>' : '') + subLine + '</span>' +
        '<span class="net-mu-chip">MU' + _progEffMu(p) + '</span>' +
        '<span class="ls-rm" onclick="netUnslotProgram(\'' + p.id + '\')" title="Unslot">✕</span>' +
      '</div>';
    }).join('') : '<div class="net-empty">Drop programs from the library.</div>';

    /* hardware options */
    var optRows = (deck.options || []).map(function(opt, oi) {
      var active = (nr.deckCustomOptions || []).some(function(o){ return o.name === opt.name; });
      return '<label class="net-opt-row">' +
        '<input type="checkbox"' + (active?' checked':'') + ' onchange="netToggleOpt(' + oi + ',this.checked)">' +
        ' ' + _esc(opt.name) + '<span class="net-opt-cost"> ' + (opt.cost||0) + 'eb</span>' +
      '</label>';
    }).join('');

    infoCol = '<div class="net-deck-name">' + _esc(deck.name) + '</div>' +
      deckType + deckDesc + muBar +
      '<div class="net-slotted-zone" ondragover="netDragOver(event)" ondrop="netDeckDrop(event)">' + slottedRows + '</div>' +
      (optRows ? '<div class="net-opts-head">Hardware options</div><div class="net-opts">' + optRows + '</div>' : '') +
      '<button class="btn btn-sm" style="margin-top:8px" onclick="netClearDeck()">× Change deck</button>';
  }

  /* ── Col 3 (1/4): Programs or Quickhacks ── */
  var swCol;
  if (nr.mode === 'quickhacking') {
    var qhs = (nr.quickhacks || []);
    var qhRows = qhs.length ? qhs.map(function(q) {
      var col = _NET_PROG_COLORS[q.type] || '#8e44ad';
      return '<div class="net-prog-row" style="background:' + col + '18;border-left:3px solid ' + col + '">' +
        '<span class="net-prog-name">' + _esc(q.name) + '</span>' +
        '<span class="net-prog-meta">' + _esc(q.activation||'') + (q.damage?' · '+q.damage:'') + '</span>' +
        '<span class="ls-rm" onclick="netRemoveQuickhack(\'' + q.id + '\')">✕</span>' +
      '</div>';
    }).join('') : '<div class="net-empty">No quickhacks.</div>';
    swCol = '<button class="btn btn-sm" onclick="netAddQuickhackModal()" style="margin-bottom:8px">+ Quickhack</button>' + qhRows;
  } else {
    /* Grimoire ⑧ — top-level library (carried sub-programs are nested inside their Demon). */
    var topLevel = (nr.programs || []).filter(function(p){ return !_progCarrier(p.id); });
    var progRows = topLevel.length ? topLevel.map(function(p) {
      var isDemon = !!p.demon;
      var eff = _progEffMu(p);
      var canSlot = deck && !p.slotted && ((muUsed + eff) <= muTotal);
      var slotBtn = deck
        ? (p.slotted
          ? '<span class="net-slotted-chip" title="Slotted">✓</span>'
          : '<button class="btn btn-sm' + (canSlot?'':' net-btn-disabled') + '" ' + (canSlot?'onclick="netSlotProgram(\''+p.id+'\')"':'title="Not enough MU"') + '>▸</button>')
        : '';
      var sig = (nr.signatureProgramId === p.id) ? '<span class="net-prog-sig" title="Signature program">★</span>' : '';
      var demonBtn = '<span class="net-prog-act" title="' + (isDemon?'Dissolve Demon (release carried programs)':'Make a Demon — carry container') + '" ' +
        'onclick="' + (isDemon?'netUnmakeDemon':'netMakeDemon') + '(\'' + p.id + '\')">' + (isDemon?'⊘':'❖') + '</span>';
      var row = '<div class="net-prog-row' + (isDemon?' net-prog-demon':'') + '" draggable="true" ondragstart="netProgramDragStart(event,\'' + p.id + '\')">' +
        sig +
        '<span class="net-sigil" title="' + _esc(p.class||'program') + '">' + _progSigil(p) + '</span>' +
        '<span class="net-prog-name" title="' + _esc(_progEffect(p)) + '">' + _esc(p.name) + (isDemon?' <span class="net-demon-tag">DEMON</span>':'') + '</span>' +
        '<span class="net-prog-meta">S:' + (p.str||0) + ' M:' + eff + '</span>' +
        slotBtn + demonBtn +
        '<span class="ls-rm" onclick="netRemoveProgram(\'' + p.id + '\')" title="Remove">✕</span>' +
      '</div>';
      if (isDemon) {
        var carried = (p.carries || []).map(_progById).filter(Boolean);
        var carriedRows = carried.map(function(c) {
          return '<div class="net-carry-row">' +
            '<span class="net-sigil sm" title="' + _esc(c.class||'program') + '">' + _progSigil(c) + '</span>' +
            '<span class="net-carry-name" title="' + _esc(_progEffect(c)) + '">' + _esc(c.name) + '</span>' +
            '<span class="net-prog-meta">M:' + (c.mu||0) + '</span>' +
            '<span class="ls-rm" onclick="netUncarry(\'' + p.id + '\',\'' + c.id + '\')" title="Remove from Demon">✕</span>' +
          '</div>';
        }).join('');
        row += '<div class="net-demon-box">' +
          (carriedRows || '<div class="net-empty">Empty container.</div>') +
          '<button class="btn btn-sm" onclick="netCarryPicker(\'' + p.id + '\')">＋ carry a program</button>' +
        '</div>';
      }
      return row;
    }).join('') : '<div class="net-empty">No programs.</div>';
    swCol = '<div class="item-search" style="position:relative;margin-bottom:6px">' +
        '<input id="net-prog-search" placeholder="search programs..." oninput="searchItems(\'program\')" onfocus="searchItems(\'program\')" autocomplete="off">' +
        '<div class="dropdown" id="net-prog-dropdown"></div>' +
      '</div>' +
      '<button class="btn btn-sm" onclick="netAddProgramModal()" style="margin-bottom:8px">+ Custom</button>' +
      progRows;
  }

  el.innerHTML = toggle +
    '<div class="net-layout">' +
      '<div class="net-col-img">' + imgCol + '</div>' +
      '<div class="net-col-info' + (!deck?' net-col-info-empty':'') + '">' + infoCol + '</div>' +
      '<div class="net-col-sw"><div class="net-col-head">' + (nr.mode==='quickhacking'?'Quickhacks':'Programs') + '</div>' + swCol + '</div>' +
    '</div>';
  // keep the netrunner card's signature-program dropdown in sync with the loadout
  var _idw = document.getElementById('net-identity-wrap');
  if (_idw && _idw.style.display !== 'none' && _idw.innerHTML) renderNetIdentity();
}

/* ── Actions ── */
function netToggleMode(m) { _nr().mode = m; renderNet(); }
function netSetDeck(name) { var nr = _nr(); nr.deckId = name; nr.deckCustomOptions = []; renderNet(); }
function netClearDeck() { var nr = _nr(); nr.deckId = null; nr.deckPhoto = ''; nr.deckCustomOptions = []; renderNet(); }
function netClearDeckPhoto() { _nr().deckPhoto = ''; renderNet(); }
function netLoadDeckPhoto(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) { _nr().deckPhoto = ev.target.result; renderNet(); };
  r.readAsDataURL(f); e.target.value = '';
}
function netToggleOpt(oi, on) {
  var deck = _deckByName(_nr().deckId); if (!deck) return;
  var opt = deck.options && deck.options[oi]; if (!opt) return;
  var nr = _nr();
  nr.deckCustomOptions = (nr.deckCustomOptions||[]).filter(function(o){ return o.name !== opt.name; });
  if (on) nr.deckCustomOptions.push({ name: opt.name, cost: opt.cost||0, notes: opt.description||'', mods: opt.mods||{} });
  renderNet();
}

function netAddCustomDeckModal() {
  _modalOpen('Add custom cyberdeck',
    '<label class="cs-modal-lbl">Name</label><input id="m-nd-name" class="cs-modal-inp" placeholder="deck name">' +
    '<label class="cs-modal-lbl">MU</label><input id="m-nd-mu" class="cs-modal-inp" type="number" value="10">' +
    '<label class="cs-modal-lbl">Speed</label><input id="m-nd-spd" class="cs-modal-inp" type="number" value="0">' +
    '<label class="cs-modal-lbl">DataWall</label><input id="m-nd-dw" class="cs-modal-inp" type="number" value="0">' +
    '<label class="cs-modal-lbl">CodeGate</label><input id="m-nd-cg" class="cs-modal-inp" type="number" value="0">' +
    '<label class="cs-modal-lbl">Notes</label><input id="m-nd-notes" class="cs-modal-inp" placeholder="optional">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="netSaveCustomDeck()">Add</button></div>');
}
function netSaveCustomDeck() {
  var name = ((document.getElementById('m-nd-name')||{}).value||'').trim();
  if (!name) { alert('Enter a deck name.'); return; }
  // inject into DB.decks for live lookup
  DB.decks = DB.decks || [];
  if (!DB.decks.find(function(d){ return d.name===name; })) {
    DB.decks.push({ name:name, _mu:parseInt((document.getElementById('m-nd-mu')||{}).value)||10,
      speed:parseInt((document.getElementById('m-nd-spd')||{}).value)||0,
      dataWall:parseInt((document.getElementById('m-nd-dw')||{}).value)||0,
      codeGate:parseInt((document.getElementById('m-nd-cg')||{}).value)||0,
      description:((document.getElementById('m-nd-notes')||{}).value||''), options:[] });
  }
  netSetDeck(name);
  _modalClose();
}

/* Programs */
function netAddProgramFromDB(item) {
  var nr = _nr();
  var p = { id:_bankUid(), name:item.name, class:item.class||'', str:item.str||0, mu:item.mu||0, cost:item.cost||0, notes:item.description||'', slotted:false, description:item.description||'', effect:item.description||'' };
  nr.programs.push(p);
  renderNet(); _csPersistSafe();
}
function netAddProgramModal() {
  _modalOpen('Add custom program',
    '<label class="cs-modal-lbl">Name</label><input id="m-np-name" class="cs-modal-inp" placeholder="program name">' +
    '<label class="cs-modal-lbl">Class</label><input id="m-np-class" class="cs-modal-inp" placeholder="intrusion / stealth / ...">' +
    '<label class="cs-modal-lbl">STR</label><input id="m-np-str" class="cs-modal-inp" type="number" value="1">' +
    '<label class="cs-modal-lbl">MU</label><input id="m-np-mu" class="cs-modal-inp" type="number" value="1">' +
    '<label class="cs-modal-lbl">Effect (what it does — shown on hover)</label><input id="m-np-notes" class="cs-modal-inp" placeholder="e.g. pierces a data wall">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="netSaveProgram()">Add</button></div>');
}
function netSaveProgram() {
  var name = ((document.getElementById('m-np-name')||{}).value||'').trim();
  if (!name) { alert('Enter a program name.'); return; }
  var eff = ((document.getElementById('m-np-notes')||{}).value||'').trim();
  _nr().programs.push({ id:_bankUid(), name:name, class:((document.getElementById('m-np-class')||{}).value||'').trim(),
    str:parseInt((document.getElementById('m-np-str')||{}).value)||0, mu:parseInt((document.getElementById('m-np-mu')||{}).value)||0,
    notes:eff, slotted:false, description:eff, effect:eff });
  _modalClose(); renderNet(); _csPersistSafe();
}
function netSlotProgram(id) {
  var nr = _nr(); var deck = _deckByName(nr.deckId);
  var p = _progById(id); if (!p || p.slotted || _progCarrier(id)) return;
  if ((_netMuUsed() + _progEffMu(p)) > _netMuTotal(deck)) { alert('Not enough MU to slot this program.'); return; }
  p.slotted = true; renderNet(); _csPersistSafe();
}
function netUnslotProgram(id) {
  var p = _progById(id); if (!p) return;
  p.slotted = false; renderNet(); _csPersistSafe();
}
function netRemoveProgram(id) {
  var nr = _nr();
  // drop the program AND clear it from any Demon that was carrying it
  nr.programs = (nr.programs||[]).filter(function(x){ return x.id!==id; });
  (nr.programs||[]).forEach(function(d){ if (d.demon && (d.carries||[]).indexOf(id) >= 0) d.carries = d.carries.filter(function(c){ return c!==id; }); });
  renderNet(); _csPersistSafe();
}

/* ── Demons (carry containers) — Grimoire ⑧ ── */
function netMakeDemon(id) {
  var p = _progById(id); if (!p || _progCarrier(id)) return;  // a carried program can't itself be a Demon
  p.demon = true; if (!Array.isArray(p.carries)) p.carries = [];
  renderNet(); _csPersistSafe();
}
function netUnmakeDemon(id) {
  var p = _progById(id); if (!p) return;
  p.demon = false; p.carries = [];   // release: carried programs return to the top-level library
  renderNet(); _csPersistSafe();
}
function netUncarry(demonId, subId) {
  var d = _progById(demonId); if (!d || !d.demon) return;
  d.carries = (d.carries||[]).filter(function(c){ return c!==subId; });
  renderNet(); _csPersistSafe();
}
function netCarryPicker(demonId) {
  var d = _progById(demonId); if (!d || !d.demon) return;
  // eligible = owned programs that aren't Demons, aren't this one, and aren't already carried elsewhere
  var eligible = (_nr().programs||[]).filter(function(p){ return !p.demon && p.id !== demonId && !_progCarrier(p.id); });
  if (!eligible.length) { alert('No free sub-programs to carry. Add or free a program first.'); return; }
  var opts = eligible.map(function(p){ return '<option value="' + p.id + '">' + _esc(p.name) + ' — ' + _esc(p.class||'program') + ' · MU' + (p.mu||0) + '</option>'; }).join('');
  _modalOpen('Carry into Demon: ' + _esc(d.name),
    '<label class="cs-modal-lbl">Sub-program</label><select id="m-carry-sel" class="cs-modal-inp">' + opts + '</select>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="netCarryConfirm(\'' + demonId + '\')">Carry</button></div>');
}
function netCarryConfirm(demonId) {
  var d = _progById(demonId); if (!d || !d.demon) { _modalClose(); return; }
  var subId = (document.getElementById('m-carry-sel')||{}).value;
  var sub = _progById(subId); if (!sub || sub.demon || _progCarrier(subId)) { _modalClose(); return; }
  // MU cap: if the Demon is already slotted, carrying a new sub grows its footprint on the deck.
  // A sub that was itself slotted was already counted; an unslotted one adds its MU on top.
  if (d.slotted) {
    var addedMu = sub.slotted ? 0 : (parseInt(sub.mu) || 0);
    if ((_netMuUsed() + addedMu) > _netMuTotal()) {
      alert('Not enough free MU to carry that program into a slotted Demon. Unslot the Demon or free some MU first.');
      _modalClose(); return;
    }
  }
  if (!Array.isArray(d.carries)) d.carries = [];
  sub.slotted = false;               // carried programs deploy with the Demon, not on their own
  d.carries.push(subId);
  _modalClose(); renderNet(); _csPersistSafe();
}
function _csPersistSafe() { try { _csPersist(); } catch (e) {} }

/* Drag-and-drop programs → deck slot zone */
function netProgramDragStart(e, id) { _netDragId = id; e.dataTransfer.effectAllowed = 'copy'; }
function netDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
function netDeckDrop(e) { e.preventDefault(); if (_netDragId) { netSlotProgram(_netDragId); _netDragId = null; } }

/* Quickhacks */
function netAddQuickhackModal() {
  var typeOpts = _NET_QH_TYPES.map(function(t){ return '<option>' + t + '</option>'; }).join('');
  _modalOpen('Add quickhack',
    '<label class="cs-modal-lbl">Name</label><input id="m-qh-name" class="cs-modal-inp" placeholder="quickhack name">' +
    '<label class="cs-modal-lbl">Type</label><select id="m-qh-type" class="cs-modal-inp">' + typeOpts + '</select>' +
    '<label class="cs-modal-lbl">Activation</label><select id="m-qh-act" class="cs-modal-inp"><option>Combat</option><option>Passive</option><option>Ultimate</option></select>' +
    '<label class="cs-modal-lbl">Damage</label><input id="m-qh-dmg" class="cs-modal-inp" placeholder="e.g. 2d6">' +
    '<label class="cs-modal-lbl">Duration</label><input id="m-qh-dur" class="cs-modal-inp" placeholder="e.g. until reboot">' +
    '<label class="cs-modal-lbl">Notes</label><input id="m-qh-notes" class="cs-modal-inp" placeholder="optional">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="netSaveQuickhack()">Add</button></div>');
}
function netSaveQuickhack() {
  var name = ((document.getElementById('m-qh-name')||{}).value||'').trim();
  if (!name) { alert('Enter a quickhack name.'); return; }
  _nr().quickhacks.push({ id:_bankUid(), name:name, type:((document.getElementById('m-qh-type')||{}).value||''),
    activation:((document.getElementById('m-qh-act')||{}).value||''), damage:((document.getElementById('m-qh-dmg')||{}).value||'').trim(),
    duration:((document.getElementById('m-qh-dur')||{}).value||'').trim(), notes:((document.getElementById('m-qh-notes')||{}).value||'').trim() });
  _modalClose(); renderNet();
}
function netRemoveQuickhack(id) {
  var nr = _nr(); nr.quickhacks = (nr.quickhacks||[]).filter(function(x){ return x.id!==id; }); renderNet();
}

/* ═══ NETRUNNER DIGITAL IDENTITY (extension of the Identity section) ═══ */
function _isNetrunner() { return ((CS.role||'').toLowerCase().indexOf('netrunner') >= 0) || !!(CS.settings && CS.settings.forceNetrunner); }
function _isMedia() { return ((CS.role||'').toLowerCase().indexOf('media') >= 0) || _pressCred() > 0 || !!(CS.settings && CS.settings.forceMedia); }

function renderNetIdentity() {
  var el = document.getElementById('net-identity-wrap'); if (!el) return;
  var nr = _nr();
  if (!nr.icon) nr.icon = { name:'', style:'', photo:'' };
  if (!_isNetrunner()) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'block';

  var icon = nr.icon;
  var photo = icon.photo
    ? '<img class="net-id-icon" src="' + icon.photo + '" onclick="document.getElementById(\'net-icon-photo-input\').click()" title="Click to change ICON image">'
    : '<div class="net-id-icon-ph" onclick="document.getElementById(\'net-icon-photo-input\').click()" title="Click to upload an ICON image">ICON</div>';

  var iface = nr.interface || 'plugs';
  var ifaceNote = iface === 'trodes'
    ? '<span class="net-id-note">Trodes: −2 REF in the Net, no Humanity cost.</span>'
    : '<span class="net-id-note">Interface plugs: faster, but a cyberware install with a Humanity cost.</span>';

  var INT = (CS.stats && parseInt(CS.stats.INT)) || 0;
  var ifaceSkill = (CS.skills && parseInt(CS.skills['Interface'])) || 0;
  var readout = '<div class="net-id-readout">Net base: <b>INT ' + INT + '</b> + <b>Interface ' + ifaceSkill + '</b> = <b>' + (INT + ifaceSkill) + '</b></div>';

  // Heat pips 0..10
  var pips = '';
  for (var i = 1; i <= 10; i++) {
    pips += '<span class="net-heat-pip' + (i <= (nr.heat||0) ? ' on' : '') + '" onclick="netSetHeat(' + (i === (nr.heat||0) ? (i-1) : i) + ')" title="NetWatch heat ' + i + '"></span>';
  }

  // Signature program select
  var progs = nr.programs || [];
  var sigOpts = '<option value="">— none —</option>' + progs.map(function(p) {
    return '<option value="' + p.id + '"' + (nr.signatureProgramId === p.id ? ' selected' : '') + '>' + _esc(p.name) + '</option>';
  }).join('');
  var sigName = '';
  if (nr.signatureProgramId) {
    var sp = progs.filter(function(p){ return p.id === nr.signatureProgramId; })[0];
    if (sp) sigName = '<span class="net-id-sig">★ ' + _esc(sp.name) + '</span>';
  }

  var ifaceLabel = iface === 'trodes' ? 'Trodes' : 'Plugs';

  el.innerHTML = '<div class="net-id">' +
    '<div class="net-id-gloss"></div>' +
    '<div class="net-id-head"><span class="net-id-orb"></span>DIGITAL IDENTITY' +
      '<span class="net-id-tut" onclick="tutoOpen(\'net-identity\')" title="How this works">&#9432;</span></div>' +
    /* profile header: avatar + name + status */
    '<div class="net-id-profile">' +
      '<div class="net-id-avatar">' + photo +
        (icon.photo ? '<span class="img-clear round" onclick="event.stopPropagation();netClearIconPhoto()" title="Remove ICON image">✕</span>' : '') +
        '<span class="net-id-dot ' + iface + '" title="Jacked in via ' + ifaceLabel + '"></span></div>' +
      '<div class="net-id-meta">' +
        '<input class="net-id-name" value="' + _esc(icon.name) + '" placeholder="ICON name" oninput="netSetIcon(\'name\',this.value)">' +
        '<input class="net-id-status" value="' + _esc(icon.style) + '" placeholder="set your ICON style / personal message…" oninput="netSetIcon(\'style\',this.value)">' +
        '<div class="net-id-presence"><span class="net-id-dot ' + iface + '"></span> Online &middot; jacked in via ' + ifaceLabel + '</div>' +
      '</div>' +
    '</div>' +
    /* glossy info tiles */
    '<div class="net-id-tiles">' +
      '<div class="net-id-tile"><span class="t-lbl">Net base</span><span class="t-val">' + (INT + ifaceSkill) + '</span><span class="t-sub">INT ' + INT + ' + Iface ' + ifaceSkill + '</span></div>' +
      '<div class="net-id-tile"><span class="t-lbl">Interface</span>' +
        '<select class="net-id-tilesel" onchange="netSetInterface(this.value)">' +
          '<option value="plugs"' + (iface==='plugs'?' selected':'') + '>Plugs</option>' +
          '<option value="trodes"' + (iface==='trodes'?' selected':'') + '>Trodes</option>' +
        '</select><span class="t-sub">' + (iface==='trodes'?'−2 REF, no HC':'cyber, HC cost') + '</span></div>' +
      '<div class="net-id-tile t-wide"><span class="t-lbl">Net access code</span>' +
        '<input class="net-id-tileinp" value="' + _esc(nr.netAccessCode) + '" placeholder="LDL password…" oninput="netSetAccessCode(this.value)"></div>' +
    '</div>' +
    /* NetWatch heat meter */
    '<div class="net-id-panel">' +
      '<div class="net-id-paneltitle">NetWatch heat <span class="net-heat-val">' + (nr.heat||0) + '/10</span></div>' +
      '<div class="net-heat">' + pips + '</div>' +
      '<input class="net-id-status net-id-heatnotes" value="' + _esc(nr.heatNotes) + '" placeholder="who is hunting you, why…" oninput="netSetHeatNotes(this.value)">' +
    '</div>' +
    /* signature program (pinned favorite) */
    '<div class="net-id-panel">' +
      '<div class="net-id-paneltitle">Signature program ' + sigName + '</div>' +
      '<select class="net-id-tilesel net-id-sigsel" onchange="netSetSignature(this.value)">' + sigOpts + '</select>' +
    '</div>' +
  '</div>';
}
function netLoadIconPhoto(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) { _nr().icon = _nr().icon || {}; _nr().icon.photo = ev.target.result; renderNetIdentity(); };
  r.readAsDataURL(f); e.target.value = '';
}
function netClearIconPhoto() { var nr = _nr(); nr.icon = nr.icon || {}; nr.icon.photo = ''; renderNetIdentity(); }
function netSetIcon(field, val) { var nr = _nr(); nr.icon = nr.icon || {}; nr.icon[field] = val; }
function netSetInterface(val) { _nr().interface = val; renderNetIdentity(); }
function netSetAccessCode(val) { _nr().netAccessCode = val; }
function netSetHeat(n) { _nr().heat = Math.max(0, Math.min(10, parseInt(n)||0)); renderNetIdentity(); }
function netSetHeatNotes(val) { _nr().heatNotes = val; }
function netSetSignature(id) { _nr().signatureProgramId = id || null; renderNetIdentity(); renderNet(); }

/* ═══ NET-ASSETS ⑪ — pre-established access (netrunner kit; section of the sheet) ═══
   Backdoors / forged creds / taps / planted programs / favors. Each grants a reach or an entry
   that is otherwise out of range — and is discoverable & burnable at the table. Table-first:
   the app just tracks the access and its status; the GM resolves whether it still holds. */
function renderNetAssets() {
  var el = document.getElementById('net-assets-wrap'); if (!el) return;
  if (!_isNetrunner()) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'block';
  var nr = _nr();
  var assets = nr.assets || [];
  var rows = assets.length ? assets.map(function(a) {
    var kind = _NET_ASSET_KINDS[a.kind] || { label: a.kind || 'Access', sigil: '◈' };
    var burned = a.status === 'burned';
    return '<div class="net-asset' + (burned ? ' burned' : '') + '">' +
      '<span class="net-sigil" title="' + _esc(kind.label) + '">' + kind.sigil + '</span>' +
      '<div class="net-asset-main">' +
        '<div class="net-asset-line"><span class="net-asset-name">' + _esc(a.name || '(unnamed)') + '</span>' +
          '<span class="net-asset-kind">' + _esc(kind.label) + '</span></div>' +
        (a.target ? '<div class="net-asset-sub">into <b>' + _esc(a.target) + '</b></div>' : '') +
        (a.grants ? '<div class="net-asset-sub">grants ' + _esc(a.grants) + '</div>' : '') +
        (a.notes ? '<div class="net-asset-note">' + _esc(a.notes) + '</div>' : '') +
      '</div>' +
      '<button class="btn btn-sm net-asset-status' + (burned ? ' is-burned' : '') + '" ' +
        'onclick="netToggleAssetStatus(\'' + a.id + '\')" title="Toggle active / burned">' + (burned ? 'BURNED' : 'ACTIVE') + '</button>' +
      '<span class="ls-rm" onclick="netRemoveAsset(\'' + a.id + '\')" title="Remove">✕</span>' +
    '</div>';
  }).join('') : '<div class="net-empty">No pre-established access. A backdoor, forged cred or planted program buys you a way in that reach alone wouldn\'t.</div>';
  el.innerHTML = '<div class="net-assets">' +
    '<div class="net-col-head">Pre-established access ' +
      '<button class="btn btn-sm" onclick="netAddAssetModal()">＋ Access</button></div>' +
    rows +
  '</div>';
}
function netAddAssetModal() {
  var kindOpts = Object.keys(_NET_ASSET_KINDS).map(function(k){ return '<option value="' + k + '">' + _NET_ASSET_KINDS[k].label + '</option>'; }).join('');
  _modalOpen('Add pre-established access',
    '<label class="cs-modal-lbl">Kind</label><select id="m-na-kind" class="cs-modal-inp">' + kindOpts + '</select>' +
    '<label class="cs-modal-lbl">Name / label</label><input id="m-na-name" class="cs-modal-inp" placeholder="e.g. Militech maintenance login">' +
    '<label class="cs-modal-lbl">Opens (site / host)</label><input id="m-na-target" class="cs-modal-inp" placeholder="e.g. Arasaka Night City payroll fort">' +
    '<label class="cs-modal-lbl">Grants</label><input id="m-na-grants" class="cs-modal-inp" placeholder="e.g. reach past the login / entry point at the core">' +
    '<label class="cs-modal-lbl">Notes</label><input id="m-na-notes" class="cs-modal-inp" placeholder="how you got it, who could burn it…">' +
    '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Cancel</button>' +
    '<button class="btn btn-sm btn-cy" onclick="netSaveAsset()">Add</button></div>');
}
function netSaveAsset() {
  var name = ((document.getElementById('m-na-name')||{}).value||'').trim();
  if (!name) { alert('Give the access a name.'); return; }
  _nr().assets.push({ id:_bankUid(),
    kind:((document.getElementById('m-na-kind')||{}).value||'backdoor'),
    name:name,
    target:((document.getElementById('m-na-target')||{}).value||'').trim(),
    grants:((document.getElementById('m-na-grants')||{}).value||'').trim(),
    notes:((document.getElementById('m-na-notes')||{}).value||'').trim(),
    status:'active' });
  _modalClose(); renderNetAssets(); _csPersistSafe();
}
function netToggleAssetStatus(id) {
  var a = (_nr().assets||[]).filter(function(x){ return x.id===id; })[0]; if (!a) return;
  a.status = a.status === 'burned' ? 'active' : 'burned';
  renderNetAssets(); _csPersistSafe();
}
function netRemoveAsset(id) {
  var nr = _nr(); nr.assets = (nr.assets||[]).filter(function(x){ return x.id!==id; });
  renderNetAssets(); _csPersistSafe();
}

function renderVehicles() {
  var el = document.getElementById('veh-list');
  if (!el) return;
  el.innerHTML = CS.vehicles.map(function(v, i) {
    var slots = _getVehCargoSlots(v);
    var used  = _cargoUsed(v.cargoContents);
    var full  = used >= slots;
    var pct   = slots > 0 ? Math.round(used / slots * 100) : 0;

    var slotViz = slots <= 16
      ? '<div class="slot-pips">' + (function() {
          var p = ''; for (var s = 0; s < slots; s++) p += '<span class="slot-pip' + (s < used ? ' pip-on' : '') + '"></span>'; return p;
        })() + '</div>'
      : '<div class="slot-bar"><div class="slot-bar-fill" style="width:' + pct + '%"></div></div>';

    var cargoItems = (v.cargoContents || []).map(function(c, ci) {
      var key = 'v' + i + '-' + ci;
      var open = _fciOpen === key;
      return '<div class="fci' + (open ? ' fci-open' : '') + '" draggable="true" ' +
        'ondragstart="vehCargoDragStart(event,' + i + ',' + ci + ')" ' +
        'onclick="toggleVehCargoDetail(' + i + ',' + ci + ')">' +
        '<span class="fci-name">' + (c.name || '?') + '</span>' +
        (c.wt ? '<span class="fci-wt">' + c.wt + 'kg</span>' : '') +
        '<span class="fci-rm" onclick="event.stopPropagation();removeFromVehCargo(' + i + ',' + ci + ')" title="Return to gear">↩</span>' +
        (open ? '<div class="fci-detail">' +
          (c.category ? '<span>' + c.category + '</span>' : '') +
          (c.cost !== undefined ? '<span>' + c.cost + 'eb</span>' : '') +
          (c.wt ? '<span>' + c.wt + 'kg</span>' : '') +
          (c.notes ? '<span class="fci-detail-notes">' + c.notes + '</span>' : '') +
        '</div>' : '') +
      '</div>';
    }).join('');

    var photoHtml = v.photo
      ? '<img src="' + v.photo + '" onclick="document.getElementById(\'vph-' + i + '\').click()">'
      : '<span class="veh-photo-ph">PHOTO</span>';

    var typeOpts = '<option value="">— type —</option>' +
      VEH_TYPES.map(function(t) {
        return '<option value="' + t + '"' + (v.type === t ? ' selected' : '') + '>' + t + '</option>';
      }).join('');

    function statCell(field, lbl, suffix) {
      var val = v[field] != null ? v[field] : 0;
      return '<div class="veh-sc">' +
        '<span class="veh-sc-lbl">' + lbl + '</span>' +
        '<input class="veh-sc-inp" type="number" value="' + val + '" ' +
        'onchange="CS.vehicles[' + i + '].' + field + '=parseFloat(this.value)||0">' +
        (suffix ? '<span class="veh-sc-suf">' + suffix + '</span>' : '') +
        '</div>';
    }
    function textCell(field, lbl, w) {
      var val = (v[field] != null ? v[field] : '').toString().replace(/"/g, '&quot;');
      return '<div class="veh-sc veh-sc-text">' +
        '<span class="veh-sc-lbl">' + lbl + '</span>' +
        '<input class="veh-sc-inp" style="width:' + (w || 50) + 'px" value="' + val + '" ' +
        'onchange="CS.vehicles[' + i + '].' + field + '=this.value">' +
        '</div>';
    }

    /* ── Options section ── */
    var allDBOpts = [];
    if (v.options) v.options.split(/[,;]\s*/).filter(Boolean).forEach(function(o) { allDBOpts.push({o:o, weap:false}); });
    if (v.weapons) v.weapons.split(/[,;]\s*/).filter(Boolean).forEach(function(o) { allDBOpts.push({o:o, weap:true}); });
    var active = v.activeOptions || [];
    var customOpts = v.customOptions || [];

    var optChips = allDBOpts.map(function(item) {
      var on = active.indexOf(item.o) !== -1;
      var cls = 'veh-opt-chip veh-opt-db' + (item.weap ? ' veh-opt-weap' : '') + (on ? ' veh-opt-on' : '');
      var esc = item.o.replace(/'/g, "\\'");
      return '<span class="' + cls + '" onclick="toggleVehOption(' + i + ',\'' + esc + '\')" title="' + (on ? 'installed' : 'not installed') + '">' +
        (on ? '<span class="veh-opt-tick">✓</span>' : '') + item.o + '</span>';
    }).join('') +
    customOpts.map(function(o, oi) {
      return '<span class="veh-opt-chip veh-opt-custom veh-opt-on">' + o +
        '<span class="veh-opt-rm" onclick="removeVehOption(' + i + ',' + oi + ')">✕</span></span>';
    }).join('');

    var optSection = '<div class="veh-section">' +
      '<span class="veh-section-lbl">Options' +
        (active.length || customOpts.length ? ' <span class="veh-opt-count">' + (active.length + customOpts.length) + ' installed</span>' : '') +
      '</span>' +
      '<div class="veh-opts-row">' +
        (allDBOpts.length || customOpts.length ? optChips : '<span class="veh-no-opts">no options listed</span>') +
        '<input id="veh-opt-inp-' + i + '" class="veh-opt-inp" placeholder="custom option…" ' +
          'onkeydown="if(event.key===\'Enter\'){addVehOption(' + i + ');event.preventDefault()}">' +
        '<span class="veh-opt-add" onclick="addVehOption(' + i + ')">+</span>' +
      '</div>' +
    '</div>';

    /* ── Cargo slots override ── */
    var slotsCustomVal = v.cargoSlotsCustom != null ? v.cargoSlotsCustom : '';

    return '<div class="veh-card">' +
      '<div class="veh-header">' +
        '<input class="veh-name-inp" value="' + v.name.replace(/"/g,'&quot;') + '" ' +
          'onchange="CS.vehicles[' + i + '].name=this.value">' +
        '<select class="veh-type-sel" onchange="setVehType(' + i + ',this.value)">' + typeOpts + '</select>' +
        '<span class="inv-remove" onclick="removeVehicle(' + i + ')">✕</span>' +
      '</div>' +
      '<div class="veh-body">' +
        '<div class="veh-photo" onclick="document.getElementById(\'vph-' + i + '\').click()">' +
          photoHtml +
          (v.photo ? '<span class="img-clear" onclick="event.stopPropagation();clearVehPhoto(' + i + ')" title="Remove photo">✕</span>' : '') +
          '<input type="file" id="vph-' + i + '" accept="image/*" style="display:none" onchange="loadVehPhoto(' + i + ',this)">' +
        '</div>' +
        '<div class="veh-right">' +
          '<div class="veh-stats-grid">' +
            statCell('topspeed', 'SPD', '') + statCell('accelerate', 'ACC', '') + statCell('decelerate', 'DEC', '') +
            statCell('sdp', 'SDP', '') + statCell('sp', 'SP', '') + statCell('maneuver', 'Man', '') +
            statCell('crew', 'Crew', '') + statCell('passengers', 'Pass', '') + statCell('range', 'Range', 'm') +
            textCell('mass', 'Mass', 40) + statCell('cost', 'Cost', 'eb') +
          '</div>' +
          optSection +
          '<div class="veh-section">' +
            '<div class="veh-cargo-head">' +
              '<span class="veh-section-lbl">Cargo</span>' +
              (v.cargo ? '<span class="veh-cargo-cap">' + v.cargo + '</span>' : '') +
              '<span class="veh-slots-ovr">' +
                '<span class="veh-sc-lbl">slots</span>' +
                '<input class="veh-sc-inp" type="number" min="0" max="99" style="width:36px" ' +
                  'value="' + slotsCustomVal + '" placeholder="auto" ' +
                  'onchange="setVehCargoSlots(' + i + ',this.value)">' +
              '</span>' +
              '<div class="fashion-slots-ui">' + slotViz +
                '<span class="slot-count' + (full ? ' slot-full' : '') + '">' + used + '&thinsp;/&thinsp;' + slots + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="fashion-contents' + (full ? ' fc-full' : '') + '" ' +
              'ondragover="fashionDragOver(event)" ondrop="vehCargoDropZone(event,' + i + ')">' +
              (used > 0 ? cargoItems : '<span class="fc-placeholder">' + (full ? 'FULL' : 'drag gear here') + '</span>') +
            '</div>' +
          '</div>' +
          '<textarea class="inv-desc-input" placeholder="Description..." oninput="setVehDesc(' + i + ',this.value)">' + (v.description || '') + '</textarea>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ─── Wounds ─── */
function clickWound(idx) {
  // If clicking on an already-marked box: if it's the last marked one, clear it. Otherwise, set wounds to this level.
  var currentTotal = CS.wounds.filter(Boolean).length;
  if (CS.wounds[idx] && idx === currentTotal - 1) {
    // Clicking last marked box: clear it
    CS.wounds[idx] = false;
  } else {
    // Fill up to idx
    for (var j = 0; j < 40; j++) {
      CS.wounds[j] = j <= idx;
    }
  }
  renderWounds();
}

function renderWounds() {
  var track = document.getElementById('wound-track');
  // Split into two rows of 5 zones (20 boxes each)
  var row1 = WOUND_ZONES.slice(0, 5);  // Light → Mortal1
  var row2 = WOUND_ZONES.slice(5, 10); // Mortal2 → Mortal6

  function buildRow(zones, startIdx, labelsBelow) {
    var labelRow = '', boxRow = '', idx = startIdx;
    zones.forEach(function(z) {
      var boxes = '';
      for (var i = 0; i < z.count; i++) {
        var marked = CS.wounds[idx] ? ' marked' : '';
        boxes += '<div class="wound-box' + marked + '" onclick="clickWound(' + idx + ')">' + (idx + 1) + '</div>';
        idx++;
      }
      labelRow += '<div class="wound-group-label">' + z.label + '</div>';
      boxRow   += '<div class="wound-group-boxes">' + boxes + '</div>';
    });
    if (labelsBelow) return '<div class="wound-row">' + boxRow + '</div><div class="wound-row wound-labels-row">' + labelRow + '</div>';
    return '<div class="wound-row wound-labels-row">' + labelRow + '</div><div class="wound-row">' + boxRow + '</div>';
  }

  track.innerHTML = buildRow(row1, 0, false) + buildRow(row2, 20, true);

  var total = CS.wounds.filter(Boolean).length;
  var el = document.getElementById('wound-count');
  el.textContent = total + ' / 40';
  el.className = 'hp-big ' + (total === 0 ? 'hp-green' : total <= 8 ? 'hp-yellow' : 'hp-red');

  var state = '';
  if (total === 0) state = 'OK';
  else if (total <= 4) state = 'Light — Stun 0';
  else if (total <= 8) state = 'Serious — Stun -1';
  else if (total <= 12) state = 'Critical — Stun -2, REF/INT/COOL halved';
  else state = 'Mortal — Stun -' + (Math.floor((total - 9) / 4) + 3) + ', must roll Death Save each turn';
  document.getElementById('wound-state').textContent = state;
}

/* ─── Damage ─── */
/* ─── DAMAGE CALCULATOR ─── */
function applyDmg(loc) {
  var dmg = parseInt(document.querySelector('[data-dmg="' + loc + '"]').value) || 0;
  var ap = parseInt(document.querySelector('[data-ap="' + loc + '"]').value) || 0;
  var cover = parseInt(document.querySelector('[data-cov="' + loc + '"]').value) || 0;
  var armorSP = getArmorSP(loc);
  var totalSP = armorSP + cover;
  var btm = Math.abs(BTM_TABLE[Math.min(CS.stats.BODY || 0, 10)] || 0);
  var through = Math.max(0, dmg - totalSP - btm);

  // Apply AP to armor pieces on this location
  var apLeft = ap;
  CS.armor.forEach(function(a) {
    if (a.locs[loc] && apLeft > 0) {
      var reduction = Math.min(a.spCurrent, apLeft);
      a.spCurrent -= reduction;
      apLeft -= reduction;
    }
  });

  // Apply damage to wounds
  if (through > 0) {
    var currentWounds = CS.wounds.filter(Boolean).length;
    var newTotal = Math.min(40, currentWounds + through);
    for (var j = 0; j < 40; j++) {
      CS.wounds[j] = j < newTotal;
    }
  }

  renderWounds();
  renderArmor();
  renderWardrobe();
  updateArmorSP();

  // Reset inputs
  document.querySelector('[data-dmg="' + loc + '"]').value = 0;
  document.querySelector('[data-ap="' + loc + '"]').value = 0;
}

/* ─── Save / Load / New ─── */
/* ─── SAVE / LOAD / NEW ─── */
function collectState() {
  CS.name = document.getElementById('cs-name').value;
  CS.handle = document.getElementById('cs-handle').value;
  CS.role = document.getElementById('cs-role').value;
  CS.age = document.getElementById('cs-age').value;
  CS.sa = document.getElementById('cs-sa').value;
  CS.reputation = parseInt(document.getElementById('cs-reputation').value) || 0;
  CS.notes = document.getElementById('cs-notes').value;
  CS.skillPoints = parseInt(document.getElementById('skill-points').value) || 40;
  var _ipEl = document.getElementById('ip-points');
  if (_ipEl) CS.ip = parseInt(_ipEl.value) || 0;
}

function csSave() {
  collectState();
  var blob = new Blob([JSON.stringify(CS, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (CS.handle || CS.name || 'character').replace(/\s+/g, '_') + '.json';
  a.click();
}

/* ═══ Real-text PDF export of the character sheet (CP2020 layout, jsPDF vector text) ═══
   Designed to be PRINTED and written on: outlined headers (ink-light), boxed stat grid,
   printed wound track + ammo boxes, and blank writable rows after every list so the player
   can add weapons / gear / vehicles / contacts by hand. */
function csExportTextPdf() {
  collectState();
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('PDF library not loaded.'); return; }
  var doc = new window.jspdf.jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  var M = 13, pageW = 210, pageH = 297, cw = pageW - 2 * M, y = 0, page = 1;
  var INK = 30, GREY = 120, FAINT = 175;
  var ASCII = function(s) { return String(s == null ? '' : s).replace(/[★☆]/g,'*').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[•]/g,'-').replace(/[^\x00-\xFF]/g,''); };
  doc.setLineWidth(0.2); doc.setDrawColor(INK);

  function header() {
    doc.setDrawColor(INK); doc.setLineWidth(0.4); doc.rect(M, 8, cw, 9);
    doc.setLineWidth(0.2);
    doc.setTextColor(INK); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text('CYBERPUNK 2020', M + 2.5, 14.3);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(ASCII(CS.handle || CS.name || 'character'), pageW - M - 2.5, 14.3, { align:'right' });
    y = 22;
  }
  function foot() { doc.setTextColor(FAINT); doc.setFont('courier','normal'); doc.setFontSize(7); doc.text("Rache Bartmoss' Datafort - fan sheet - page " + page, pageW/2, pageH - 6, { align:'center' }); doc.setTextColor(INK); }
  function ensure(h) { if (y + h > pageH - 12) { foot(); doc.addPage(); page++; header(); } }

  // Outlined section header (ink-light): thin black frame, white fill, black bold title.
  function bar(t) {
    ensure(13);
    doc.setDrawColor(INK); doc.setLineWidth(0.4); doc.setFillColor(255,255,255);
    doc.rect(M, y, cw, 6.4, 'FD'); doc.setLineWidth(0.2);
    doc.setTextColor(INK); doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
    doc.text(ASCII(t).toUpperCase(), M + 2.5, y + 4.5);
    y += 9;
  }

  // A printed line for handwriting (faint full-width rule).
  function rule(indent) {
    var x0 = M + (indent || 0);
    doc.setDrawColor(FAINT); doc.setLineWidth(0.15);
    doc.line(x0, y, M + cw, y);
    doc.setDrawColor(INK); doc.setLineWidth(0.2);
  }
  // N blank writable rows (spacing 5mm) at the current cursor.
  function blankLines(n, indent) { for (var i = 0; i < n; i++) { ensure(5); y += 4; rule(indent); y += 1; } }

  function field(label, val) {
    ensure(5.4); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(INK); doc.text(ASCII(label) + ':', M, y);
    var lw = doc.getTextWidth(ASCII(label) + ': ') + 1; doc.setFont('courier','normal');
    var sval = ASCII(val);
    if (!sval.trim()) { // empty -> faint writable rule for filling by hand
      doc.setDrawColor(FAINT); doc.setLineWidth(0.15); doc.line(M + lw, y + 0.6, M + cw, y + 0.6);
      doc.setDrawColor(INK); doc.setLineWidth(0.2); y += 5.4; return;
    }
    var v = doc.splitTextToSize(sval, cw - lw); doc.text(v, M + lw, y); y += 4.6 * Math.max(1, v.length);
  }
  function lineItem(txt) { ensure(4.6); doc.setFont('courier','normal'); doc.setFontSize(8.5); doc.setTextColor(INK); var v = doc.splitTextToSize('- ' + ASCII(txt), cw); for (var i=0;i<v.length;i++){ ensure(4.3); doc.text(v[i], M + (i?3:0), y); y += 4.3; } }
  function subLine(txt) { ensure(4); doc.setFont('courier','normal'); doc.setFontSize(7.5); doc.setTextColor(GREY); var v = doc.splitTextToSize(ASCII(txt), cw - 6); for (var i=0;i<v.length;i++){ ensure(3.8); doc.text(v[i], M + 5, y); y += 3.8; } doc.setTextColor(INK); }
  function empty(t) { ensure(5); doc.setFont('helvetica','italic'); doc.setFontSize(8.5); doc.setTextColor(FAINT); doc.text(ASCII(t), M, y); doc.setTextColor(INK); y += 5; }
  function fitText(s, maxW) { s = ASCII(s); if (doc.getTextWidth(s) <= maxW) return s; while (s.length > 1 && doc.getTextWidth(s + '..') > maxW) s = s.slice(0, -1); return s + '..'; }

  // Grid of bordered value boxes (stats / derived). items=[{label,value}].
  function gridBoxes(items, perRow, boxH) {
    var bw = cw / perRow;
    for (var r = 0; r * perRow < items.length; r++) {
      ensure(boxH + 1);
      for (var c = 0; c < perRow; c++) {
        var it = items[r * perRow + c]; if (!it) continue;
        var x = M + c * bw;
        doc.setDrawColor(INK); doc.setLineWidth(0.3); doc.rect(x, y, bw, boxH);
        doc.setFont('helvetica','bold'); doc.setFontSize(6.3); doc.setTextColor(GREY);
        doc.text(ASCII(it.label).toUpperCase(), x + bw/2, y + 3, { align:'center' });
        doc.setFont('courier','normal'); doc.setFontSize(it.big ? 13 : 10); doc.setTextColor(INK);
        doc.text(ASCII(it.value == null ? '' : String(it.value)), x + bw/2, y + boxH - (it.big ? 3.2 : 3), { align:'center' });
      }
      y += boxH;
    }
    doc.setLineWidth(0.2);
  }

  // A row of small empty checkboxes (ammo / generic). Returns nothing; advances y.
  function checkRow(count, boxSz, label) {
    boxSz = boxSz || 3; var gap = 0.8; var per = Math.floor((cw - 30) / (boxSz + gap));
    ensure(boxSz + 2);
    var x = M;
    if (label) { doc.setFont('courier','normal'); doc.setFontSize(7); doc.setTextColor(GREY); doc.text(ASCII(label), x, y + boxSz - 0.6); x += 26; doc.setTextColor(INK); }
    doc.setDrawColor(INK); doc.setLineWidth(0.25);
    var n = Math.min(count, per);
    for (var i = 0; i < n; i++) { doc.rect(x, y, boxSz, boxSz); x += boxSz + gap; }
    doc.setLineWidth(0.2);
    y += boxSz + 1.5;
  }

  // ── gather ──
  var nr = CS.netrunner || {}, ls = CS.lifestyle || {};
  var rep = CS.reputation || 0;
  var cash = ls.cash != null ? ls.cash : (CS.money || 0);
  var B = effectiveStat('BODY'), MAv = effectiveStat('MA'), E = effectiveStat('EMP');
  var run = MAv * 3, leap = Math.round(run / 4), carry = B * 10, lift = carry * 2, btm = BTM_TABLE[Math.min(B, 10)] || 0;
  var totalHC = (CS.cyberware || []).reduce(function(s, c) { var o = (c.options || []).reduce(function(a, x) { return a + (parseFloat(x.hc) || 0); }, 0); return s + (parseFloat(c.hc) || 0) + o; }, 0);
  var humanity = E * 10 - totalHC;
  var woundCount = (CS.wounds || []).filter(Boolean).length;
  var skills = [];
  Object.keys(CS.skills || {}).forEach(function(n) { var v = CS.skills[n]; if (v > 0) { var d = (DB.skills || []).find(function(x) { return x.name === n; }); skills.push({ name:n, val:v, stat:d ? d.stat : '' }); } });
  (CS.customSkills || []).forEach(function(s) { if (s && s.name) skills.push({ name:s.name, val:s.val || 0, stat:s.stat || '', custom:true }); });
  skills.sort(function(a, b) { return (b.val || 0) - (a.val || 0); });

  // ── render ──
  header();

  bar('Identity');
  field('Handle', CS.handle || CS.name || '');
  field('Name', CS.name || '');
  field('Role', CS.role || ''); field('Age', CS.age || '');
  field('Special Ability', CS.sa || '');
  if (CS.specialAbilities && Object.keys(CS.specialAbilities).length) {
    var saR = Object.keys(CS.specialAbilities).map(function(k){ return k + ' ' + CS.specialAbilities[k]; }).filter(function(x){ return !/\s0$/.test(x); });
    if (saR.length) field('SA Ranks', saR.join(', '));
  }
  field('Reputation', rep); field('Cash', cash + ' eb');
  if (ls.salary) field('Salary', ls.salary + ' eb/mo');

  bar('Stats');
  gridBoxes(STATS.map(function(s){ return { label:s, value:effectiveStat(s), big:true }; }), STATS.length, 13);
  y += 1.5;
  gridBoxes([
    { label:'Run', value: run + 'm' }, { label:'Leap', value: leap + 'm' },
    { label:'Carry', value: carry + 'kg' }, { label:'Lift', value: lift + 'kg' },
    { label:'BTM', value: btm }, { label:'Save', value: B },
    { label:'Humanity', value: humanity }, { label:'Total HC', value: totalHC }
  ], 8, 10);
  y += 3;

  bar('Wound Track');
  // 40 boxes, grouped 5/wound-level: Light, Serious, Critical, Mortal0..6 (CP2020 single track of 40)
  ensure(14);
  (function() {
    var lvls = [['LIGHT',4],['SERIOUS',4],['CRITICAL',4],['MORTAL 0',4],['M1',4],['M2',4],['M3',4],['M4',4],['M5',4],['M6',4]];
    var bw = cw / lvls.length, bs = 3.2, idx = 0;
    for (var i = 0; i < lvls.length; i++) {
      var x = M + i * bw;
      doc.setFont('helvetica','bold'); doc.setFontSize(5.6); doc.setTextColor(GREY);
      doc.text(lvls[i][0], x + bw/2, y + 2.5, { align:'center' });
      var bx = x + (bw - (lvls[i][1] * (bs + 0.7) - 0.7)) / 2;
      for (var b = 0; b < lvls[i][1]; b++) {
        doc.setDrawColor(INK); doc.setLineWidth(0.25);
        var filled = (CS.wounds || [])[idx];
        if (filled) { doc.setFillColor(INK); doc.rect(bx, y + 4, bs, bs, 'F'); } else doc.rect(bx, y + 4, bs, bs);
        bx += bs + 0.7; idx++;
      }
    }
    doc.setLineWidth(0.2);
  })();
  y += 11; doc.setTextColor(INK);
  doc.setFont('courier','normal'); doc.setFontSize(7); doc.setTextColor(GREY);
  ensure(4); doc.text('Stun save: roll BODY (' + B + ') or under each wound level. BTM ' + btm + ' reduces damage.', M, y); y += 5.5; doc.setTextColor(INK);

  bar('Skills');
  if (skills.length) {
    var col = cw / 2, rowH = 4.5, valW = 11;
    doc.setFont('courier','normal'); doc.setFontSize(8.5);
    for (var i = 0; i < skills.length; i += 2) {
      ensure(rowH);
      [skills[i], skills[i + 1]].forEach(function(s, ci) {
        if (!s) return;
        var cx = M + ci * col, valX = cx + col - 2;
        doc.setTextColor(INK); doc.setFont('courier','normal'); doc.setFontSize(8.5);
        doc.text(fitText((s.custom ? '* ' : '') + s.name + (s.stat ? ' (' + s.stat + ')' : ''), col - valW - 4), cx, y);
        doc.text('[' + (s.val || 0) + ']', valX, y, { align:'right' });
      });
      y += rowH;
    }
  } else empty('No skills recorded.');

  // ─────────────────────────────────────────────────────────────
  // Quarter-page LIST PANELS in a fixed 2x2 grid. Each section gets one
  // quarter; items fill the slots top-down and any remaining slots are left
  // blank (faint writable rule) so the player can add entries by hand.
  // ─────────────────────────────────────────────────────────────
  var P_M = 10, P_GUT = 4, P_TOP = 20, P_BOT = pageH - 9;
  var P_W = (pageW - 2 * P_M - P_GUT) / 2;
  var P_H = (P_BOT - P_TOP - P_GUT) / 2;
  var _cell = 4; // >=4 forces a fresh page on the first panel
  function gridHeader() {
    doc.setDrawColor(INK); doc.setLineWidth(0.4); doc.rect(P_M, 8, pageW - 2 * P_M, 8); doc.setLineWidth(0.2);
    doc.setTextColor(INK); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('CYBERPUNK 2020', P_M + 2, 13.6);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(ASCII(CS.handle || CS.name || 'character'), pageW - P_M - 2, 13.6, { align:'right' });
  }
  function panel(title, lines) {
    if (_cell >= 4) { foot(); doc.addPage(); page++; gridHeader(); _cell = 0; }
    var c = _cell % 2, r = Math.floor(_cell / 2);
    var x = P_M + c * (P_W + P_GUT), py = P_TOP + r * (P_H + P_GUT);
    doc.setDrawColor(INK); doc.setLineWidth(0.4); doc.rect(x, py, P_W, P_H);
    doc.setLineWidth(0.3); doc.line(x, py + 6.5, x + P_W, py + 6.5);
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(INK);
    doc.text(ASCII(title).toUpperCase(), x + 2.5, py + 4.6);
    var slotH = 5.0, padTop = 9, padBot = 2.5;
    var slots = Math.floor((P_H - padTop - padBot) / slotH);
    var n = lines.length, over = n > slots, show = over ? slots - 1 : n;
    for (var i = 0; i < slots; i++) {
      var sy = py + padTop + i * slotH;
      doc.setDrawColor(FAINT); doc.setLineWidth(0.12); doc.line(x + 2, sy + 1.2, x + P_W - 2, sy + 1.2);
      doc.setDrawColor(INK); doc.setLineWidth(0.2);
      if (i < show) { doc.setFont('courier','normal'); doc.setFontSize(7.6); doc.setTextColor(INK); doc.text(fitText(lines[i], P_W - 6), x + 2.5, sy); }
      else if (over && i === show) { doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(GREY); doc.text('+ ' + (n - show) + ' more (digital sheet)', x + 2.5, sy); doc.setTextColor(INK); }
    }
    doc.setLineWidth(0.2);
    _cell++;
  }

  // ── build one-line entries per section ──
  var cyberLines = [];
  (CS.cyberware || []).forEach(function(c) {
    cyberLines.push((c.name || '') + (c.type ? ' [' + c.type + ']' : '') + (c.hc ? ' HC ' + c.hc : '') + (c.cost ? ' ' + c.cost + 'eb' : ''));
    (c.options || []).forEach(function(o) { cyberLines.push('  + ' + (o.name || '') + (o.hc ? ' HC ' + o.hc : '')); });
  });

  var weaponLines = (CS.weapons || []).map(function(w) {
    var stats = [w.type, w.damage ? 'DMG ' + w.damage : '', w.rof ? 'ROF ' + w.rof : '', w.ammo || '', w.shots ? (w.currentAmmo != null ? w.currentAmmo + '/' : '') + w.shots + ' sh' : '', w.rel || ''].filter(Boolean).join(' ');
    return (w.name || '') + (stats ? '  ' + stats : '');
  });

  var armorLines = [];
  (CS.outfits || []).forEach(function(o) {
    (o.items || []).forEach(function(it) { armorLines.push((o.equipped ? '* ' : '') + (it.name || '') + (it.sp ? ' SP ' + it.sp : '') + (it.locs ? ' [' + Object.keys(it.locs).filter(function(k){return it.locs[k];}).join(',') + ']' : '')); });
  });

  var gearLines = [];
  (CS.gear || []).forEach(function(g) { gearLines.push((g.name || '') + (g.category ? ' [' + g.category + ']' : '') + (g.cost ? ' ' + g.cost + 'eb' : '')); });
  function _glabel(arr, loc) { (arr || []).filter(Boolean).forEach(function(c) { gearLines.push((c.name || '?') + (c.category ? ' [' + c.category + ']' : '') + ' @ ' + loc); }); }
  _glabel((CS.hands || []).filter(Boolean), 'hands');
  var eqOutfit = (CS.outfits || []).filter(function(o){ return o.equipped; })[0];
  ((eqOutfit && eqOutfit.items) || []).forEach(function(f) { _glabel(f.contents, 'worn:' + (f.name || '')); });
  (CS.fashion || []).forEach(function(f) { if (!f.isArmor) _glabel(f.contents, f.name || 'bag'); });
  ((CS.lifestyle && CS.lifestyle.housing) || []).forEach(function(h) { _glabel(h.cargoContents, h.name || 'home'); });
  (CS.vehicles || []).forEach(function(v) { _glabel(v.cargoContents, v.name || 'vehicle'); });
  _glabel(CS.notStored, 'unsorted');

  var vehicleLines = (CS.vehicles || []).map(function(v) { return (v.name || '') + (v.type ? ' [' + v.type + ']' : '') + (v.topspeed ? ' SPD ' + v.topspeed : '') + ((v.cargoContents || []).length ? ' cargo:' + v.cargoContents.length : ''); });

  var netLines = [];
  if (nr.deckId) netLines.push('Deck: ' + nr.deckId);
  if (nr.interface) netLines.push('Interface: ' + nr.interface);
  if (nr.netAccessCode) netLines.push('Access: ' + nr.netAccessCode);
  if (nr.icon && nr.icon.name) netLines.push('Icon: ' + nr.icon.name);
  if (nr.heat) netLines.push('Heat: ' + nr.heat);
  (nr.deckCustomOptions || []).forEach(function(o) { netLines.push('mod: ' + (o.name || '')); });
  (nr.programs || []).forEach(function(p) { netLines.push((p.name || '') + (p.class ? ' [' + p.class + ']' : '') + (p.demon ? ' [Demon]' : '') + (p.str ? ' STR ' + p.str : '') + (p.mu ? ' MU ' + p.mu : '') + (p.slotted ? ' *' : '')); });
  (nr.quickhacks || []).forEach(function(q) { netLines.push('qh: ' + (q.name || q.title || String(q))); });
  (nr.assets || []).forEach(function(a) { var k = _NET_ASSET_KINDS[a.kind]; netLines.push('access: ' + (a.name || '') + ' [' + ((k && k.label) || a.kind || '') + ']' + (a.target ? ' → ' + a.target : '') + (a.status === 'burned' ? ' (burned)' : '')); });

  var finLines = [];
  finLines.push('Cash: ' + cash + ' eb');
  if (ls.salary) finLines.push('Salary: ' + ls.salary + ' eb/mo');
  (ls.credchips || []).forEach(function(cc) { finLines.push('credchip: ' + (cc.name || '') + ' ' + (cc.amount || 0) + 'eb'); });
  (ls.housing || []).forEach(function(h) { finLines.push((h.name || 'Housing') + (h.type ? ' [' + h.type + ']' : '') + (h.rent ? ' ' + h.rent + 'eb/mo' : '') + (h.owned ? ' owned' : '')); });
  (ls.services || []).forEach(function(s) { finLines.push('service: ' + (s.name || '') + ' ' + (s.cost || 0) + 'eb'); });
  (ls.accounts || []).filter(function(a){ return !a.closed; }).forEach(function(a) { finLines.push('acct: ' + (a.name || '') + (a.balance != null ? ' ' + a.balance + 'eb' : '')); });
  (ls.sharkLoans || []).forEach(function(l) { finLines.push('shark: ' + (l.lender || '') + ' ' + (l.principal || 0) + 'eb @' + (l.rate || 0) + '%'); });

  var contactLines = (CS.contacts || []).map(function(c) { return (c.name || '(unnamed)') + ' [' + (c.type || 'Other') + '/' + (c.attitude || 'Neutral') + ']' + (c.org ? ' @' + c.org : ''); });

  var jobLines = (CS.jobs || []).map(function(j) { return (j.title || '(untitled)') + ' [' + (j.status || 'offered') + ']' + (j.client ? ' ' + j.client : '') + (j.pay ? ' ' + j.pay + 'eb' : ''); });

  var lp = CS.lifepath || {};
  var lpLines = [];
  if (lp.fields) Object.keys(lp.fields).forEach(function(k) { if (lp.fields[k]) lpLines.push(k + ': ' + lp.fields[k]); });
  if (lp.freeform) { doc.setFont('courier','normal'); doc.setFontSize(7.6); doc.splitTextToSize(ASCII(lp.freeform), P_W - 6).forEach(function(s){ lpLines.push(s); }); }
  (lp.events || []).forEach(function(ev) { lpLines.push((ev.age !== '' && ev.age != null ? 'Age ' + ev.age + ' - ' : '') + (ev.text || '')); });

  var noteLines = [];
  if (CS.notes) { doc.setFont('courier','normal'); doc.setFontSize(7.6); noteLines = doc.splitTextToSize(ASCII(CS.notes), P_W - 6); }

  // ── lay out the panels (always rendered, empty ones become writable slots) ──
  panel('Cybernetics & Cyberware', cyberLines);
  panel('Weapons', weaponLines);
  panel('Armor & Outfits', armorLines);
  panel('Gear & Inventory', gearLines);
  panel('Vehicles', vehicleLines);
  panel('Netrunning', netLines);
  panel('Lifestyle & Finances', finLines);
  panel('Network & Contacts', contactLines);
  panel('Gigs & Jobs', jobLines);
  panel('Lifepath', lpLines);
  panel('Notes', noteLines);

  foot();
  doc.save(((CS.handle || CS.name || 'character').replace(/[^\w.-]+/g, '_')) + '_cp2020.pdf');
}

function csLoad(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      // detect a templates file (array of {kind,data}) or a single template
      var asTpl = Array.isArray(data) ? data.filter(function(t) { return t && t.kind && t.data; }) : ((data && data.kind && data.data) ? [data] : null);
      if (asTpl && asTpl.length) {
        var all = _loadTemplates(); asTpl.forEach(function(t) { t.id = _bankUid(); all.push(t); }); _saveTemplates(all);
        var sheet = asTpl.filter(function(t) { return t.kind === 'sheet'; }).pop();
        if (sheet) { // auto-apply: new sheet (new tab) from the imported sheet template
          var blank = makeBlankCS(); var d = JSON.parse(JSON.stringify(sheet.data));
          blank.layout = d.layout; blank.customSections = d.customSections; blank.nativeBlocks = d.nativeBlocks; blank.nativeExtras = d.nativeExtras; blank.statLabels = d.statLabels;
          if (d.onboarding) blank.onboarding = d.onboarding;   // creation guidance rides the template
          _csAdoptSheet(blank);
        } else { alert('Imported ' + asTpl.length + ' template(s).'); }
        return;
      }
      _csAdoptSheet(data);   // import = new tab
    } catch (err) { alert('Invalid JSON: ' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
}

/* ─── Tabs (multi-character, mirrors the NPC sheet) ─── */
var SHEETS = [];          // open character-sheet tabs
var csActiveIdx = 0;
var _CS_LS = 'bartmoss_cs_sheets';   // collection { list, active }

function _csTabLabel(s) { return (s && (s.handle || s.name)) || 'PC'; }
/* Per-tab scroll memory so switching characters doesn't share one scroll offset. */
var _csScroll = new WeakMap();
function _csScrollEl() { return document.querySelector('.cs'); }
function _csSaveScroll() { var el = _csScrollEl(); if (el && CS) _csScroll.set(CS, el.scrollTop); }
function _csRestoreScroll() { var el = _csScrollEl(); if (el) el.scrollTop = _csScroll.get(CS) || 0; }
function _csPersist() {
  if (document.getElementById('cs-name')) collectState();
  try { renderPending(); } catch (e) {}   // reconcile the buy tray on any change (incl. removals)
  // Joined mode / file-bridge: the campaign (hub) is the source of truth, so we
  // must NOT write the bound sheet into shared localStorage. cs-join.js (live) or
  // campaign-doc.js (file) handles persistence instead.
  if (window.__csJoined || window.__cdoc) return;
  try { localStorage.setItem(_CS_LS, JSON.stringify({ list: SHEETS, active: csActiveIdx })); } catch (e) {}
}
function renderCsTabs() {
  var bar = document.getElementById('cs-tabs'); if (!bar) return;
  bar.innerHTML = SHEETS.map(function(s, i) {
    return '<div class="cs-tab' + (i === csActiveIdx ? ' active' : '') + '" onclick="csSwitchTab(' + i + ')" title="' + _esc(_csTabLabel(s)) + '">' +
      '<span class="cs-tab-label">' + _esc(_csTabLabel(s)) + '</span>' +
      (SHEETS.length > 1 ? '<span class="cs-tab-close" onclick="event.stopPropagation();csCloseTab(' + i + ')" title="Close">✕</span>' : '') +
    '</div>';
  }).join('') + '<div class="cs-tab-add" onclick="csNewTab()" title="New character">＋</div>';
  try { renderPending(); } catch (e) {}
}
function csSwitchTab(i) {
  if (i < 0 || i >= SHEETS.length || i === csActiveIdx) return;
  if (document.getElementById('cs-name')) collectState();   // capture current edits
  _csSaveScroll();
  csActiveIdx = i; CS = SHEETS[i];
  applyCS(); renderCsTabs(); _csRestoreScroll(); _csPersist();
}
function csNewTab() {
  if (document.getElementById('cs-name')) collectState();
  _csSaveScroll();
  SHEETS.push(makeBlankCS());
  csActiveIdx = SHEETS.length - 1; CS = SHEETS[csActiveIdx];
  applyCS(); renderCsTabs(); _csRestoreScroll(); _csPersist();
}
function csCloseTab(i) {
  if (SHEETS.length <= 1) return;
  if (!confirm('Close this character tab? (export first if you want to keep it)')) return;
  _csSaveScroll();
  SHEETS.splice(i, 1);
  if (csActiveIdx >= SHEETS.length) csActiveIdx = SHEETS.length - 1;
  else if (i < csActiveIdx) csActiveIdx--;
  CS = SHEETS[csActiveIdx];
  applyCS(); renderCsTabs(); _csRestoreScroll(); _csPersist();
}
/* Adopt an imported / template sheet as a brand-new tab. */
function _csAdoptSheet(obj) {
  if (document.getElementById('cs-name')) collectState();
  _csSaveScroll();
  SHEETS.push(obj);
  csActiveIdx = SHEETS.length - 1; CS = obj;
  applyCS(); renderCsTabs(); _csRestoreScroll(); _csPersist();
}

function csNew() { csNewTab(); }

/* ── Settings popup ── */
function csSettingsModal() {
  if (!CS.settings) CS.settings = { forceNetrunner:false, showAllRoleSkills:false };
  var s = CS.settings;
  var cz = document.body.classList.contains('cs-customizing');
  _modalOpen('Sheet settings',
    '<label class="cs-set-row"><input type="checkbox" id="m-set-cust"' + (cz?' checked':'') + ' onchange="csToggleCustomize()">' +
      '<span><b>Customize mode</b><br><span class="cs-set-hint">Build your own categories, sub-categories &amp; fields, reorder the layout, edit structure. Sheet values are locked while on.</span></span></label>' +
    '<label class="cs-set-row"><input type="checkbox" id="m-set-runner"' + (s.forceNetrunner?' checked':'') + ' onchange="csSetOption(\'forceNetrunner\',this.checked)">' +
      '<span><b>Netrunner mode without the class</b><br><span class="cs-set-hint">Show the Digital Identity panel even if your Role is not Netrunner.</span></span></label>' +
    '<label class="cs-set-row"><input type="checkbox" id="m-set-allsa"' + (s.showAllRoleSkills?' checked':'') + ' onchange="csSetOption(\'showAllRoleSkills\',this.checked)">' +
      '<span><b>Show all role special abilities</b><br><span class="cs-set-hint">List every role ability (Authority, Combat Sense, Interface…) in Skills, not just your role\'s.</span></span></label>' +
    '<label class="cs-set-row"><input type="checkbox" id="m-set-mark"' + (s.markCustom?' checked':'') + ' onchange="csSetOption(\'markCustom\',this.checked)">' +
      '<span><b>Mark custom content</b><br><span class="cs-set-hint">Show a subtle accent on your custom categories/fields even in view mode (off = indistinguishable from vanilla).</span></span></label>' +
    '<label class="cs-set-row"><input type="checkbox" id="m-set-onb"' + (s.onbAuthor?' checked':'') + ' onchange="csSetOption(\'onbAuthor\',this.checked)">' +
      '<span><b>Author character-creation onboarding</b><br><span class="cs-set-hint">Show the ✎ chip to write step-by-step creation guidance, then share it via a sheet template or exported JSON. Players who load it see the wizard automatically.</span></span></label>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm btn-cy" onclick="_modalClose()">Done</button></div>');
}
function csSetOption(key, val) {
  if (!CS.settings) CS.settings = {};
  CS.settings[key] = !!val;
  if (key === 'showAllRoleSkills') renderSkills();
  if (key === 'forceNetrunner') { renderNetIdentity(); renderNetAssets(); }
  if (key === 'markCustom') renderSheetLayout();
  if (key === 'onbAuthor' && window.CSOnboarding) window.CSOnboarding.refreshAuthor();
}

/* ═══════════════════════════════════════════════
   CUSTOM SECTIONS / FIELDS + REUSABLE TEMPLATES (CS)
   ═══════════════════════════════════════════════ */
var _TPL_KEY = 'bartmoss_templates';   // shared template library (CS + NPC later)
var NATIVE_SECTION_IDS = ['sec-identity','sec-life','sec-stats','sec-skills','sec-cyber','sec-net','sec-computer','sec-weapons','sec-fashion','sec-inventory','sec-vehicles','sec-lifestyle','sec-network','sec-lifepath','sec-notes'];
var NATIVE_SLOTS = {
  'sec-identity:fields': { sel:'#sec-identity .id-fields', style:'field',      addLabel:'+ field' },
  'sec-stats:primary':   { sel:'#stats-grid',             style:'statbox',    addLabel:'+ stat'  },
  'sec-stats:derived':   { sel:'#derived-grid',           style:'derivedbox', addLabel:'+ derived' }
};
var FIELD_TYPES = {
  text:     { label:'Text',      displays:['plain','badge'] },
  longtext: { label:'Long text', displays:['plain'] },
  number:   { label:'Number',    displays:['plain','statbox','bar','rating'] },
  boolean:  { label:'Checkbox',  displays:['check','toggle'] },
  select:   { label:'Choice',    displays:['dropdown','chips'] },
  counter:  { label:'Counter',   displays:['counter'] },
  track:    { label:'Track',     displays:['track'] },
  dice:     { label:'Dice',      displays:['dice'] }
};
function _cz() { return !!(typeof document !== 'undefined' && document.body && document.body.classList.contains('cs-customizing')); }
function _defaultDisplay(t) { return (FIELD_TYPES[t] && FIELD_TYPES[t].displays[0]) || 'plain'; }
function _fieldBlank(t) {
  switch (t) {
    case 'number': return 0; case 'boolean': return false;
    case 'counter': return { cur:0, max:0 }; case 'track': return { filled:0, total:5 };
    case 'dice': return { formula:'1d6', last:null }; default: return '';
  }
}
function _defaultOpts(t) { if (t === 'select') return { options:[] }; if (t === 'number') return { max:10 }; return {}; }
function makeField(t) { t = FIELD_TYPES[t] ? t : 'text'; return { kind:'field', id:_bankUid(), label:'', type:t, display:_defaultDisplay(t), value:_fieldBlank(t), placeholder:'', inline:false, opts:_defaultOpts(t) }; }
function makeBox(ctype) {
  var content;
  if (ctype === 'list') content = { ctype:'list', columns:[{ id:_bankUid(), label:'Name', type:'text', opts:{} }, { id:_bankUid(), label:'Detail', type:'text', opts:{} }], rows:[] };
  else if (ctype === 'text') content = { ctype:'text', value:'' };
  else if (ctype === 'collection') content = { ctype:'collection', record:{ kind:'split', dir:'col', children:[makeBox('fields')] }, instances:[] };
  else { ctype = 'fields'; content = { ctype:'fields', root:{ kind:'split', dir:'col', children:[] } }; }
  return { kind:'box', id:_bankUid(), title:(ctype === 'list' ? 'Table' : ctype === 'text' ? 'Notes' : ctype === 'collection' ? 'Collection' : 'Fields'), content:content };
}
function makeCategory(title) { return { id:_bankUid(), title:title || '', root:{ kind:'split', dir:'col', children:[] } }; }

/* native stat display labels (display-only; rules use the keys) */
function _statLabel(s) { return (CS.statLabels && CS.statLabels[s]) || s; }
function csRenameStat(key, v) { CS.statLabels = CS.statLabels || {}; if (!v || v === key) delete CS.statLabels[key]; else CS.statLabels[key] = v; renderStats(); }
function _statSlabel(s) { return '<span class="slabel"><span class="cs-stat-ro">' + _esc(_statLabel(s)) + '</span><input class="cs-stat-rename cs-cust-struct" value="' + _esc(_statLabel(s)) + '" onchange="csRenameStat(\'' + s + '\',this.value)" title="Rename label"></span>'; }

/* ── normalize + migrate ── */
function _csNormalizeCustom() {
  if (!Array.isArray(CS.customSections)) CS.customSections = [];
  if (!CS.statLabels || typeof CS.statLabels !== 'object') CS.statLabels = {};
  if (!CS.settings) CS.settings = {};
  if (CS.settings.markCustom === undefined) CS.settings.markCustom = false;
  if (!CS.nativeBlocks || typeof CS.nativeBlocks !== 'object') CS.nativeBlocks = {};
  if (!CS.nativeExtras || typeof CS.nativeExtras !== 'object') {
    var ne = {};
    if (CS.sectionExtras && typeof CS.sectionExtras === 'object') Object.keys(CS.sectionExtras).forEach(function(sid) { ne[sid + ':body'] = CS.sectionExtras[sid]; });
    CS.nativeExtras = ne;
  }
  Object.keys(CS.nativeExtras).forEach(function(k) {
    var m = k.match(/^(.*):body$/);
    if (m && (CS.nativeExtras[k] || []).length) {
      var sid = m[1]; CS.nativeBlocks[sid] = CS.nativeBlocks[sid] || { root:{ kind:'split', dir:'col', children:[] } };
      var box = makeBox('fields'); box.title = 'Notes';
      CS.nativeExtras[k].forEach(function(f) { box.content.root.children.push(makeField('text')); var nf = box.content.root.children[box.content.root.children.length - 1]; nf.label = f.label || ''; nf.value = f.value || ''; });
      CS.nativeBlocks[sid].root.children.push(box);
    }
    if (m) delete CS.nativeExtras[k];
  });
  CS.customSections = CS.customSections.map(function(s) {
    if (s && s.root) return s;
    var cat = makeCategory(s && s.title ? s.title : ''); var box;
    if (s && s.type === 'list') { box = makeBox('list'); (s.items || []).forEach(function() { box.content.rows.push({ id:_bankUid(), cells:{} }); }); }
    else if (s && s.type === 'text') { box = makeBox('text'); box.content.value = (s && s.text) || ''; }
    else { box = makeBox('fields'); (s && s.fields || []).forEach(function(f) { var nf = makeField('text'); nf.label = f.label || ''; nf.value = f.value || ''; box.content.root.children.push(nf); }); }
    cat.root.children.push(box); return cat;
  });
  CS.customSections.forEach(function(cat) { if (!cat.id) cat.id = _bankUid(); if (!cat.root || cat.root.kind !== 'split') cat.root = { kind:'split', dir:'col', children:[] }; _normNode(cat.root); });
  Object.keys(CS.nativeBlocks).forEach(function(sid) { var nb = CS.nativeBlocks[sid]; if (!nb.root) nb.root = { kind:'split', dir:'col', children:[] }; _normNode(nb.root); });
  Object.keys(NATIVE_SLOTS).forEach(function(k) { (CS.nativeExtras[k] || []).forEach(_normField); });
  if (!CS.layout || typeof CS.layout !== 'object') CS.layout = { order:[], hidden:{} };
  if (!Array.isArray(CS.layout.order)) CS.layout.order = [];
  if (!CS.layout.hidden || typeof CS.layout.hidden !== 'object') CS.layout.hidden = {};
  var want = NATIVE_SECTION_IDS.slice(); CS.customSections.forEach(function(c) { want.push('cust:' + c.id); });
  var seen = {}, order = [];
  CS.layout.order.forEach(function(k) { if (want.indexOf(k) >= 0 && !seen[k]) { order.push(k); seen[k] = 1; } });
  want.forEach(function(k) { if (!seen[k]) { order.push(k); seen[k] = 1; } });
  CS.layout.order = order;
  // one-shot: pin Computer & Web right after Cyberdeck & Net (it used to land at the bottom for old sheets)
  if (!CS._secCompMoved) {
    var _o = CS.layout.order, _ci = _o.indexOf('sec-computer'), _ni = _o.indexOf('sec-net');
    if (_ci >= 0 && _ni >= 0 && _ci !== _ni + 1) { _o.splice(_ci, 1); _ni = _o.indexOf('sec-net'); _o.splice(_ni + 1, 0, 'sec-computer'); }
    CS._secCompMoved = true;
  }
}
function _normField(f) { f.kind = 'field'; if (!f.id) f.id = _bankUid(); if (!FIELD_TYPES[f.type]) f.type = 'text'; if (!f.display || FIELD_TYPES[f.type].displays.indexOf(f.display) < 0) f.display = _defaultDisplay(f.type); if (f.value === undefined) f.value = _fieldBlank(f.type); if (typeof f.placeholder !== 'string') f.placeholder = ''; if (typeof f.inline !== 'boolean') f.inline = false; if (!f.opts || typeof f.opts !== 'object') f.opts = _defaultOpts(f.type); }
function _normNode(node) {
  if (node.kind === 'field') { _normField(node); return; }
  if (node.kind === 'box') {
    if (!node.id) node.id = _bankUid(); if (!node.content) node.content = { ctype:'fields', root:{ kind:'split', dir:'col', children:[] } };
    var c = node.content;
    if (c.ctype === 'fields') { if (!c.root || c.root.kind !== 'split') { var kids = (c.fields || []).map(function(f) { f.kind = 'field'; return f; }); c.root = { kind:'split', dir:'col', children:kids }; delete c.fields; } _normNode(c.root); }
    if (c.ctype === 'list') { c.columns = c.columns || []; c.columns.forEach(function(col) { if (!col.id) col.id = _bankUid(); if (!col.type) col.type = 'text'; if (!col.opts) col.opts = {}; }); c.rows = c.rows || []; }
    if (c.ctype === 'text' && typeof c.value !== 'string') c.value = '';
    if (c.ctype === 'collection') { if (!c.record || c.record.kind !== 'split') c.record = { kind:'split', dir:'col', children:[makeBox('fields')] }; _normNode(c.record); c.instances = c.instances || []; c.instances.forEach(function(inst) { if (!inst.id) inst.id = _bankUid(); if (typeof inst.title !== 'string') inst.title = ''; if (!inst.root || inst.root.kind !== 'split') inst.root = { kind:'split', dir:'col', children:[] }; _normNode(inst.root); }); }
    return;
  }
  node.dir = node.dir === 'row' ? 'row' : 'col'; node.children = (node.children || []); node.children.forEach(_normNode);
}
function _csFindSec(id) { return (CS.customSections || []).find(function(s) { return s.id === id; }); }

/* ── tree helpers (leaf = any node whose kind !== 'split') ── */
function _eachBox(node, cb) {
  if (node.kind === 'box') { cb(node); var c = node.content; if (c && c.ctype === 'collection') { _eachBox(c.record, cb); (c.instances || []).forEach(function(i) { _eachBox(i.root, cb); }); } return; }
  if (node.kind === 'field') return;
  (node.children || []).forEach(function(ch) { _eachBox(ch, cb); });
}
function _findBoxNode(node, id) { if (node.kind !== 'split') return node.id === id ? node : null; for (var i = 0; i < node.children.length; i++) { var r = _findBoxNode(node.children[i], id); if (r) return r; } return null; }
function _findParent(node, id) { for (var i = 0; i < node.children.length; i++) { var c = node.children[i]; if (c.kind !== 'split' && c.id === id) return { parent:node, index:i }; if (c.kind === 'split') { var r = _findParent(c, id); if (r) return r; } } return null; }
function _removeBox(node, id) { for (var i = 0; i < node.children.length; i++) { var c = node.children[i]; if (c.kind !== 'split' && c.id === id) { node.children.splice(i, 1); return c; } if (c.kind === 'split') { var r = _removeBox(c, id); if (r) return r; } } return null; }
function _prune(node, isRoot) {
  if (node.kind !== 'split') return node;
  node.children = node.children.map(function(c) { return _prune(c, false); }).filter(Boolean);
  var merged = []; node.children.forEach(function(c) { if (c.kind === 'split' && c.dir === node.dir) merged = merged.concat(c.children); else merged.push(c); });
  node.children = merged;
  if (node.children.length === 0) return isRoot ? node : null;
  if (node.children.length === 1 && !isRoot) return node.children[0];
  return node;
}
function _paneMove(root, dragId, targetId, side) {
  if (dragId === targetId) return root;
  var drag = _removeBox(root, dragId); if (!drag) return root;
  root = _prune(root, true) || { kind:'split', dir:'col', children:[] };
  if (!targetId) { root.children.push(drag); return _prune(root, true); }
  var dir = (side === 'left' || side === 'right') ? 'row' : 'col', before = (side === 'left' || side === 'top');
  var loc = _findParent(root, targetId);
  if (!loc) { root.children.push(drag); return _prune(root, true); }
  if (loc.parent.dir === dir) loc.parent.children.splice(before ? loc.index : loc.index + 1, 0, drag);
  else { var t = loc.parent.children[loc.index]; loc.parent.children[loc.index] = { kind:'split', dir:dir, children: before ? [drag, t] : [t, drag] }; }
  return _prune(root, true);
}

/* ── scope registry ── */
var _SCOPES = {};
function _reg(id, root, render) { _SCOPES[id] = { root:root, render:render }; }
function _scopeRoot(id) { return _SCOPES[id] && _SCOPES[id].root; }
function _scopeRender(id) { if (_collEdit && _collEdit.scopes && _collEdit.scopes[id]) { _renderCollEditBody(); return; } if (_SCOPES[id] && _SCOPES[id].render) _SCOPES[id].render(); }
function _setScopeRoot(id, root) { if (_SCOPES[id]) _SCOPES[id].root = root; }
var _curScopeId = '';
function _indexScopes() {
  _SCOPES = {};
  function walk(root, render) {
    _reg(_curScopeId, root, render);
    _eachBox(root, function(box) {
      if (box.content && box.content.ctype === 'fields') _reg('fbox:' + box.id, box.content.root, render);
      if (box.content && box.content.ctype === 'collection') { _reg('rec:' + box.id, box.content.record, render); box.content.instances.forEach(function(inst) { _reg('inst:' + inst.id, inst.root, render); }); }
    });
  }
  CS.customSections.forEach(function(c) { _curScopeId = 'cat:' + c.id; walk(c.root, (function(id) { return function() { renderCategory(id); }; })(c.id)); });
  CS.nativeBlocks = CS.nativeBlocks || {};
  NATIVE_SECTION_IDS.forEach(function(sid) { if (!CS.nativeBlocks[sid]) CS.nativeBlocks[sid] = { root:{ kind:'split', dir:'col', children:[] } }; _curScopeId = 'sec:' + sid; walk(CS.nativeBlocks[sid].root, (function(s) { return function() { renderNativeSection(s); }; })(sid)); });
}

/* ═══ customize mode + sidebar ═══ */
function csToggleCustomize() {
  document.body.classList.toggle('cs-customizing');
  renderSheetLayout(); renderNativeExtras();
  var side = document.getElementById('cs-layout-side'); if (side && side.classList.contains('open')) renderLayoutSide();
}

/* ═══ render: layout ═══ */
function renderSheetLayout() {
  var cont = document.querySelector('.cs'); if (!cont) return;
  document.body.classList.toggle('cs-mark-custom', !!(CS.settings && CS.settings.markCustom));
  renderCustomSections();
  var tools = document.getElementById('cs-cust-tools');
  CS.layout.order.forEach(function(key) {
    var el = key.indexOf('cust:') === 0 ? document.getElementById('cs-cat-' + key.slice(5)) : document.getElementById(key);
    if (el) { el.classList.toggle('cat-hidden', !!CS.layout.hidden[key]); cont.appendChild(el); }
  });
  if (tools) cont.appendChild(tools);
}
function renderCustomSections() {
  var cont = document.querySelector('.cs'); if (!cont) return;
  _csNormalizeCustom(); _indexScopes();
  var present = {}; CS.customSections.forEach(function(c) { present['cs-cat-' + c.id] = true; });
  Array.prototype.slice.call(cont.querySelectorAll('.cs-cust-sec')).forEach(function(n) { if (!present[n.id]) n.remove(); });
  CS.customSections.forEach(function(cat) {
    var el = document.getElementById('cs-cat-' + cat.id);
    if (!el) { el = document.createElement('div'); el.id = 'cs-cat-' + cat.id; el.className = 'cs-section cs-cust-sec'; cont.appendChild(el); }
    el.innerHTML = _csCategoryInner(cat);
  });
}
function renderCategory(catId) { _indexScopes(); var el = document.getElementById('cs-cat-' + catId), cat = _csFindSec(catId); if (el && cat) el.innerHTML = _csCategoryInner(cat); }
function _csCategoryInner(cat) {
  return '<div class="cs-section-head" onclick="toggleSec(this)">' +
      '<h2><span class="cs-cust-title-ro">' + (_esc(cat.title) || 'Category') + '</span><input class="cs-cust-title cs-cust-struct" value="' + _esc(cat.title) + '" placeholder="Category title" onclick="event.stopPropagation()" oninput="csCatRename(\'' + cat.id + '\',this.value)"></h2>' +
      '<span class="cs-cust-headctrl cs-cust-struct" onclick="event.stopPropagation()">' +
        '<span class="cs-cust-icon" onclick="csSaveAsTemplate(\'category\',\'' + cat.id + '\')" title="Save as template">⤓</span>' +
        '<span class="cs-cust-x" onclick="csRemoveCategory(\'' + cat.id + '\')" title="Delete category">✕</span>' +
      '</span><span class="toggle"></span></div>' +
    '<div class="cs-section-body">' + _renderNode(cat.root, 'cat:' + cat.id) +
      '<div class="cs-cust-struct cs-cat-foot"><button class="btn btn-sm" onclick="csAddBoxMenu(\'cat:' + cat.id + '\')">+ Sub-box</button></div>' +
    '</div>';
}
function renderNativeSection(sid) { _indexScopes(); renderNativeExtras(); }

/* ═══ render: nodes / boxes / fields ═══ */
function _renderNode(node, scope) {
  if (node.kind === 'field') return _renderField(node, scope);
  if (node.kind === 'box') return _renderBox(node, scope);
  return '<div class="cs-pane ' + (node.dir === 'row' ? 'cs-pane-row' : 'cs-pane-col') + '">' + node.children.map(function(c) { return _renderNode(c, scope); }).join('') + '</div>';
}
function _dragAttrs(scope, id) { return ' draggable="true" ondragstart="csBoxDragStart(event,\'' + scope + '\',\'' + id + '\')" ondragover="csBoxDragOver(event)" ondragleave="csBoxDragLeave(event)" ondrop="csBoxDrop(event,\'' + scope + '\',\'' + id + '\')"'; }
function _renderBox(box, scope) {
  var ref = '\'' + scope + '\',\'' + box.id + '\'';
  return '<div class="cs-subbox" id="box-' + box.id + '"' + _dragAttrs(scope, box.id) + '>' +
    '<div class="cs-subbox-head"><span class="cs-subbox-title-ro">' + (_esc(box.title) || 'Box') + '</span>' +
      '<span class="cs-cust-struct cs-subbox-ctrl">' +
        '<input class="cs-subbox-title" value="' + _esc(box.title) + '" placeholder="Title" oninput="csBoxRename(' + ref + ',this.value)">' +
        '<span class="cs-cust-icon" onclick="csSaveAsTemplate(\'box\',' + ref + ')" title="Save box as template">⤓</span>' +
        '<span class="cs-cust-x" onclick="csRemoveBox(' + ref + ')" title="Remove box">✕</span>' +
      '</span></div>' +
    '<div class="cs-subbox-body">' + _renderContent(box.content, scope, box.id) + '</div>' +
  '</div>';
}
function _renderContent(content, scope, boxId) {
  if (content.ctype === 'text') return '<textarea class="cs-cust-text" oninput="csBoxText(\'' + scope + '\',\'' + boxId + '\',this.value)">' + _esc(content.value) + '</textarea>';
  if (content.ctype === 'list') return _renderList(content, scope, boxId);
  if (content.ctype === 'collection') return _renderCollection(content, scope, boxId);
  return _renderNode(content.root, 'fbox:' + boxId) +
    '<button class="btn btn-sm cs-cust-struct cs-add-field" onclick="csAddFieldMenu(\'fbox:' + boxId + '\')">+ field</button>';
}
function _renderField(f, scope) {
  var k = '\'' + scope + '\',\'' + f.id + '\'';
  var set = 'csFieldVal(' + k + ',', click = 'csFieldClickW(' + k + ',';
  var widget;
  if (_cz()) {
    if (f.type === 'text') widget = '<input class="cs-ph-edit" placeholder="placeholder shown when empty…" value="' + _esc(f.placeholder) + '" oninput="csFieldPlaceholder(' + k + ',this.value)">';
    else if (f.type === 'longtext') widget = '<textarea class="cs-ph-edit" placeholder="placeholder shown when empty…" oninput="csFieldPlaceholder(' + k + ',this.value)">' + _esc(f.placeholder) + '</textarea>';
    else widget = '<span class="cs-inert">' + _widHTML(f, set, click) + '</span>';
  } else { widget = _widHTML(f, set, click); }
  var ctrl = '<span class="cs-cust-struct cs-f-ctrl">' + _fieldTypeSel(f, k) + _fieldDisplaySel(f, k) + _fieldOptsBtn(f, k) +
    '<span class="cs-cust-icon' + (f.inline ? ' on' : '') + '" onclick="csFieldInline(' + k + ')" title="Label + value on one line">⇿</span>' +
    '<span class="cs-cust-x" onclick="csFieldRemove(' + k + ')" title="Remove field">✕</span></span>';
  return '<div class="cs-cust-field cs-f-' + f.type + (f.inline ? ' cs-cf-inline' : '') + '" id="field-' + f.id + '"' + _dragAttrs(scope, f.id) + '>' +
    '<div class="cs-cf-top"><label class="cs-cust-flabel-ro">' + (_esc(f.label) || '—') + '</label>' +
      '<input class="cs-cust-flabel cs-cust-struct" value="' + _esc(f.label) + '" placeholder="Label" oninput="csFieldLabel(' + k + ',this.value)">' + ctrl + '</div>' +
    '<span class="cs-f-widget">' + widget + '</span>' +
  '</div>';
}
function _fieldTypeSel(f, k) { return '<select class="cs-f-sel" title="Type" onchange="csFieldType(' + k + ',this.value)">' + Object.keys(FIELD_TYPES).map(function(t) { return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + FIELD_TYPES[t].label + '</option>'; }).join('') + '</select>'; }
function _fieldDisplaySel(f, k) { var ds = FIELD_TYPES[f.type].displays; if (ds.length < 2) return ''; return '<select class="cs-f-sel" title="Display" onchange="csFieldDisplay(' + k + ',this.value)">' + ds.map(function(d) { return '<option value="' + d + '"' + (f.display === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>'; }
function _fieldOptsBtn(f, k) { if (f.type === 'select' || f.type === 'dice' || (f.type === 'number' && (f.display === 'bar' || f.display === 'rating')) || f.type === 'track' || f.type === 'counter') return '<span class="cs-cust-icon" onclick="csFieldOpts(' + k + ')" title="Options">⚙</span>'; return ''; }
/* shared option-modal bodies/parsers (used by fields AND table columns) */
function _diceParse(fm) { var m = String(fm || '1d6').match(/^(\d*)d(\d+)([+-]\d+)?$/i); return m ? { n:parseInt(m[1] || '1'), s:parseInt(m[2]), mod:parseInt(m[3] || '0') } : { n:1, s:6, mod:0 }; }
function _optsBody(type, f) {
  if (type === 'select') return '<div class="cs-modal-lbl">Options (one per line)</div><textarea class="cs-modal-inp cs-modal-area" id="cs-opt-ta">' + _esc(((f.opts && f.opts.options) || []).join('\n')) + '</textarea>';
  if (type === 'dice') { var d = _diceParse((f.value && f.value.formula) || (f.opts && f.opts.formula)); return '<div class="cs-modal-lbl">Dice rolled</div><div style="display:flex;align-items:center;gap:6px;font-family:var(--mono)"><input class="cs-modal-inp" id="cs-opt-n" type="number" min="1" value="' + d.n + '" style="width:64px"> d <input class="cs-modal-inp" id="cs-opt-s" type="number" min="2" value="' + d.s + '" style="width:64px"> <input class="cs-modal-inp" id="cs-opt-m" type="number" value="' + d.mod + '" style="width:64px" title="modifier"></div>'; }
  if (type === 'track') return '<div class="cs-modal-lbl">Number of boxes</div><input class="cs-modal-inp" id="cs-opt-n" type="number" min="1" value="' + ((f.value && f.value.total) || (f.opts && f.opts.total) || 5) + '">';
  if (type === 'counter') return '<div class="cs-modal-lbl">Max (0 = none)</div><input class="cs-modal-inp" id="cs-opt-n" type="number" min="0" value="' + ((f.value && f.value.max) || (f.opts && f.opts.max) || 0) + '">';
  return '<div class="cs-modal-lbl">Max value</div><input class="cs-modal-inp" id="cs-opt-n" type="number" min="1" value="' + ((f.opts && f.opts.max) || 10) + '">';
}
function _optsRead(type, target) {
  var n = parseInt((document.getElementById('cs-opt-n') || {}).value) || 0;
  if (type === 'select') { var ta = document.getElementById('cs-opt-ta'); target.opts = target.opts || {}; target.opts.options = (ta ? ta.value : '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean); }
  else if (type === 'dice') { var s = parseInt((document.getElementById('cs-opt-s') || {}).value) || 6, m = parseInt((document.getElementById('cs-opt-m') || {}).value) || 0; var fm = Math.max(1, n) + 'd' + Math.max(2, s) + (m ? (m > 0 ? '+' + m : m) : ''); target.opts = target.opts || {}; target.opts.formula = fm; if (target.value && typeof target.value === 'object') target.value.formula = fm; }
  else if (type === 'track') { target.opts = target.opts || {}; target.opts.total = Math.max(1, n); if (target.value && typeof target.value === 'object') target.value.total = Math.max(1, n); }
  else if (type === 'counter') { target.opts = target.opts || {}; target.opts.max = n; if (target.value && typeof target.value === 'object') target.value.max = n; }
  else { target.opts = target.opts || {}; target.opts.max = Math.max(1, n); }
}

/* shared widget HTML (value editors). set/click = JS call prefixes ending with comma. */
function _widHTML(f, set, click) {
  var ph = _esc(f.placeholder || '');
  switch (f.type) {
    case 'longtext': return '<textarea class="cs-fw-text" placeholder="' + ph + '" oninput="' + set + 'this.value)">' + _esc(f.value) + '</textarea>';
    case 'boolean':
      if (f.display === 'toggle') return '<span class="cs-toggle ' + (f.value ? 'on' : '') + '" onclick="' + click + '\'toggle\')"></span>';
      return '<input type="checkbox" ' + (f.value ? 'checked' : '') + ' onchange="' + set + 'this.checked)">';
    case 'select': { var o = (f.opts && f.opts.options) || [];
      if (f.display === 'chips') return o.length ? o.map(function(x) { return '<span class="cs-chip ' + (f.value === x ? 'on' : '') + '" onclick="' + click + '\'chip\',\'' + _esc(x).replace(/'/g, '&#39;') + '\')">' + _esc(x) + '</span>'; }).join('') : '<span class="cs-fw-empty">no options</span>';
      return '<select onchange="' + set + 'this.value)"><option value="">' + (ph || '') + '</option>' + o.map(function(x) { return '<option' + (f.value === x ? ' selected' : '') + '>' + _esc(x) + '</option>'; }).join('') + '</select>'; }
    case 'counter': { var c = f.value || { cur:0, max:0 }; return '<span class="cs-counter"><span class="cs-cbtn" onclick="' + click + '\'counter\',-1)">−</span><b>' + (c.cur || 0) + '</b><span class="cs-cmax">/' + (c.max || 0) + '</span><span class="cs-cbtn" onclick="' + click + '\'counter\',1)">+</span></span>'; }
    case 'track': { var t = f.value || { filled:0, total:5 }, b = ''; for (var i = 0; i < (t.total || 0); i++) b += '<span class="cs-tbox ' + (i < t.filled ? 'on' : '') + '" onclick="' + click + '\'track\',' + (i + 1) + ')"></span>'; return '<span class="cs-track">' + b + '</span>'; }
    case 'dice': { var d = f.value || { formula:'1d6', last:null }; return '<span class="cs-dice"><input class="cs-dice-f cs-cust-struct" value="' + _esc(d.formula) + '" oninput="' + click + '\'dformula\',this.value)"><span class="cs-dice-fro">' + _esc(d.formula) + '</span><button class="btn btn-sm" onclick="' + click + '\'roll\')">Roll</button><b class="cs-dice-res">' + (d.last == null ? '—' : d.last) + '</b></span>'; }
    case 'number':
      if (f.display === 'statbox') return '<span class="stat-box cs-fw-statbox"><input type="number" value="' + (f.value || 0) + '" oninput="' + set + '(parseFloat(this.value)||0))"></span>';
      if (f.display === 'bar') { var mx = (f.opts && f.opts.max) || 10, pct = Math.max(0, Math.min(100, ((f.value || 0) / mx) * 100)); return '<span class="cs-bar-wrap"><input type="number" class="cs-bar-inp" value="' + (f.value || 0) + '" oninput="' + click + '\'numbar\',this.value)"><span class="cs-bar"><i style="width:' + pct + '%"></i></span></span>'; }
      if (f.display === 'rating') { var rmx = (f.opts && f.opts.max) || 5, dots = ''; for (var r = 1; r <= rmx; r++) dots += '<span class="cs-dot ' + (r <= (f.value || 0) ? 'on' : '') + '" onclick="' + click + '\'rating\',' + r + ')"></span>'; return '<span class="cs-rating">' + dots + '</span>'; }
      return '<input type="number" class="cs-fw-num" placeholder="' + ph + '" value="' + (f.value || 0) + '" oninput="' + set + '(parseFloat(this.value)||0))">';
    default:
      return '<input class="cs-fw-text' + (f.display === 'badge' ? ' cs-fw-badge' : '') + '" placeholder="' + ph + '" value="' + _esc(f.value) + '" oninput="' + set + 'this.value)">';
  }
}
function _applyAction(cur, action, arg) {
  if (action === 'toggle') return !cur;
  if (action === 'chip') return arg;
  if (action === 'rating') return (cur === arg ? arg - 1 : arg);
  if (action === 'numbar') return parseFloat(arg) || 0;
  if (action === 'counter') { cur = (cur && typeof cur === 'object') ? cur : { cur:0, max:0 }; cur.cur = (cur.cur || 0) + arg; return cur; }
  if (action === 'track') { cur = (cur && typeof cur === 'object') ? cur : { filled:0, total:5 }; cur.filled = (cur.filled === arg ? arg - 1 : arg); return cur; }
  if (action === 'dformula') { cur = (cur && typeof cur === 'object') ? cur : { formula:'1d6', last:null }; cur.formula = arg; return cur; }
  if (action === 'roll') { cur = (cur && typeof cur === 'object') ? cur : { formula:'1d6', last:null }; cur.last = _rollDice(cur.formula); return cur; }
  return cur;
}
function _rollDice(f) { f = String(f || '').replace(/\s+/g, ''); var m = f.match(/^(\d*)d(\d+)([+-]\d+)?$/i); if (!m) { var n = parseInt(f); return isNaN(n) ? 0 : n; } var num = parseInt(m[1] || '1'), sides = parseInt(m[2]), mod = parseInt(m[3] || '0'), t = 0; for (var i = 0; i < num; i++) t += Math.floor(Math.random() * sides) + 1; return t + mod; }

/* ── list / table (typed cells) ── */
function _renderList(content, scope, boxId) {
  var cols = content.columns || [], rows = content.rows || [];
  var optTypes = { select:1, dice:1, track:1, counter:1 };
  var head = cols.map(function(col) {
    var ct = col.type || 'text';
    var optBtn = (optTypes[ct] || (ct === 'number')) ? '<span class="cs-cust-icon" onclick="csColOpts(\'' + scope + '\',\'' + boxId + '\',\'' + col.id + '\')" title="Options">⚙</span>' : '';
    return '<th><span class="cs-lcol-ro">' + (_esc(col.label) || '—') + '</span><span class="cs-cust-struct cs-lcol-ed"><input class="cs-lcol" value="' + _esc(col.label) + '" oninput="csListColLabel(\'' + scope + '\',\'' + boxId + '\',\'' + col.id + '\',this.value)"><select class="cs-f-sel" onchange="csListColType(\'' + scope + '\',\'' + boxId + '\',\'' + col.id + '\',this.value)">' + Object.keys(FIELD_TYPES).map(function(t) { return '<option value="' + t + '"' + (ct === t ? ' selected' : '') + '>' + FIELD_TYPES[t].label + '</option>'; }).join('') + '</select>' + optBtn + '<span class="cs-cust-x" onclick="csListRemoveCol(\'' + scope + '\',\'' + boxId + '\',\'' + col.id + '\')">✕</span></span></th>';
  }).join('') + '<th class="cs-cust-struct"></th>';
  var body = rows.map(function(row) {
    return '<tr>' + cols.map(function(col) {
      var ct = col.type || 'text', v = (row.cells || {})[col.id];
      if (v === undefined) v = _fieldBlank(ct);
      if (ct === 'dice') v = { formula:(v && v.formula) || (col.opts && col.opts.formula) || '1d6', last:(v && v.last != null) ? v.last : null };
      if (ct === 'track') v = { filled:(v && v.filled) || 0, total:(col.opts && col.opts.total) || (v && v.total) || 5 };
      if (ct === 'counter') v = { cur:(v && v.cur) || 0, max:(col.opts && col.opts.max) || (v && v.max) || 0 };
      var cf = { type:ct, display:_defaultDisplay(ct), value:v, opts:col.opts || {}, placeholder:'' };
      var base = '\'' + scope + '\',\'' + boxId + '\',\'' + row.id + '\',\'' + col.id + '\'';
      return '<td>' + _widHTML(cf, 'csCellVal(' + base + ',', 'csCellClickW(' + base + ',') + '</td>';
    }).join('') + '<td><span class="cs-cust-x cs-cust-struct" onclick="csListRemoveRow(\'' + scope + '\',\'' + boxId + '\',\'' + row.id + '\')">✕</span></td></tr>';
  }).join('');
  return '<table class="cs-cust-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
    '<div class="cs-list-tools"><button class="btn btn-sm" onclick="csListAddRow(\'' + scope + '\',\'' + boxId + '\')">+ row</button> <button class="btn btn-sm cs-cust-struct" onclick="csListAddCol(\'' + scope + '\',\'' + boxId + '\')">+ column</button></div>';
}

/* ── collection (template + popup-filled entries, Housing-style cards) ── */
function _firstFieldVal(node) {
  if (node.kind === 'field') return (node.value != null && node.value !== '' && typeof node.value !== 'object') ? node.value : '';
  if (node.kind === 'box') { return node.content.ctype === 'fields' ? _firstFieldVal(node.content.root) : ''; }
  for (var i = 0; i < (node.children || []).length; i++) { var v = _firstFieldVal(node.children[i]); if (v) return v; }
  return '';
}
function _instTitle(it) { return it.title || _firstFieldVal(it.root) || 'Entry'; }
function _renderCollection(content, scope, boxId) {
  var rec = _cz() ? '<div class="cs-coll-record"><div class="cs-coll-rlabel">Entry template — define the fields/tables an entry contains</div>' + _renderNode(content.record, 'rec:' + boxId) + '<div class="cs-cat-foot"><button class="btn btn-sm" onclick="csAddBoxMenu(\'rec:' + boxId + '\')">+ Sub-box</button></div></div>' : '';
  var cards = (content.instances || []).map(function(it) {
    return '<div class="cs-coll-card" onclick="csCollEdit(\'' + scope + '\',\'' + boxId + '\',\'' + it.id + '\')">' +
      '<span class="cs-coll-card-title">' + (_esc(_instTitle(it)) || 'Entry') + '</span>' +
      '<span class="cs-coll-card-x" onclick="event.stopPropagation();csCollRemove(\'' + scope + '\',\'' + boxId + '\',\'' + it.id + '\')">✕</span></div>';
  }).join('');
  return rec + '<div class="cs-coll-cards">' + cards + '</div><button class="btn btn-sm cs-coll-add" onclick="csCollAdd(\'' + scope + '\',\'' + boxId + '\')">+ Add</button>';
}
function _collBox(scope, boxId) { var root = _scopeRoot(scope); if (!root) return null; var b = _findBoxNode(root, boxId); return (b && b.content && b.content.ctype === 'collection') ? b.content : null; }
function csCollAdd(scope, boxId) { var C = _collBox(scope, boxId); if (!C) return; var root = JSON.parse(JSON.stringify(C.record)); _regenIds(root); _stripValues(root); var inst = { id:_bankUid(), title:'', root:root }; C.instances.push(inst); _scopeRender(scope); csCollEdit(scope, boxId, inst.id); }
function csCollRemove(scope, boxId, iid) { var C = _collBox(scope, boxId); if (!C) return; C.instances = C.instances.filter(function(x) { return x.id !== iid; }); _scopeRender(scope); }
function csCollTitle(scope, boxId, iid, v) { var C = _collBox(scope, boxId); if (!C) return; var it = C.instances.find(function(x) { return x.id === iid; }); if (it) it.title = v; }
var _collEdit = null;
function _collScopeSet() {
  var set = {}; if (!_collEdit) return set; var C = _collBox(_collEdit.scope, _collEdit.boxId); if (!C) return set;
  var it = C.instances.find(function(x) { return x.id === _collEdit.iid; }); if (!it) return set;
  set['inst:' + it.id] = 1;
  _eachBox(it.root, function(b) { if (b.content.ctype === 'fields') set['fbox:' + b.id] = 1; if (b.content.ctype === 'collection') { set['rec:' + b.id] = 1; b.content.instances.forEach(function(i) { set['inst:' + i.id] = 1; }); } });
  return set;
}
function _renderCollEditBody() {
  var body = document.querySelector('#cs-modal-body .cs-coll-edit-body');
  if (!body) { _collEdit = null; return; }
  _indexScopes(); _collEdit.scopes = _collScopeSet();
  var C = _collBox(_collEdit.scope, _collEdit.boxId); var it = C && C.instances.find(function(x) { return x.id === _collEdit.iid; });
  if (it) body.innerHTML = _renderNode(it.root, 'inst:' + it.id);
}
function csCollEdit(scope, boxId, iid) {
  var C = _collBox(scope, boxId); if (!C) return; var it = C.instances.find(function(x) { return x.id === iid; }); if (!it) return;
  _indexScopes();
  var body = '<div class="cs-coll-edit"><div class="cs-modal-lbl">Entry name</div><input class="cs-modal-inp" value="' + _esc(it.title) + '" placeholder="(optional — defaults to first field)" oninput="csCollTitle(\'' + scope + '\',\'' + boxId + '\',\'' + iid + '\',this.value)">' +
    '<div class="cs-coll-edit-body">' + _renderNode(it.root, 'inst:' + iid) + '</div></div>' +
    '<div class="cs-modal-actions"><button class="btn btn-sm btn-cy" onclick="_modalClose();_csCollClose(\'' + scope + '\')">Done</button></div>';
  _modalOpen('Entry', body);
  _collEdit = { scope:scope, boxId:boxId, iid:iid }; _collEdit.scopes = _collScopeSet();
}
function _csCollClose(scope) { _collEdit = null; _scopeRender(scope); }

/* ── native sections: loose-field slots + panel-tree holder ── */
function renderNativeExtras() {
  if (!document.querySelector('.cs-section')) return;
  CS.nativeExtras = CS.nativeExtras || {}; _indexScopes();
  Object.keys(NATIVE_SLOTS).forEach(_renderNativeSlot);
  NATIVE_SECTION_IDS.forEach(function(sid) {
    var sec = document.getElementById(sid); if (!sec) return;
    CS.nativeBlocks[sid] = CS.nativeBlocks[sid] || { root:{ kind:'split', dir:'col', children:[] } };
    var holder = null; for (var c = sec.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1 && c.classList && c.classList.contains('cs-extra-holder')) { holder = c; break; } }
    if (!holder) { holder = document.createElement('div'); holder.className = 'cs-extra-holder'; sec.appendChild(holder); }
    var root = CS.nativeBlocks[sid].root, hasContent = root.children.length > 0;
    holder.innerHTML = (hasContent ? _renderNode(root, 'sec:' + sid) : '') +
      '<div class="cs-cust-struct cs-cat-foot"><button class="btn btn-sm" onclick="csAddBoxMenu(\'sec:' + sid + '\')">+ Sub-category</button></div>';
  });
}
function _renderNativeSlot(key) {
  var slot = NATIVE_SLOTS[key], host = document.querySelector(slot.sel); if (!host) return;
  Array.prototype.slice.call(host.querySelectorAll('.cs-extra-native')).forEach(function(n) { n.remove(); });
  var tmp = document.createElement('div');
  (CS.nativeExtras[key] || []).forEach(function(f) { tmp.innerHTML = _nativeFieldHtml(key, slot.style, f); var node = tmp.firstElementChild; if (node) host.appendChild(node); });
  var add = document.createElement('div'); add.className = 'cs-extra-native cs-cust-struct cs-extra-add'; add.innerHTML = '<button class="btn btn-sm" onclick="csAddNative(\'' + key + '\')">' + slot.addLabel + '</button>'; host.appendChild(add);
}
function _nativeFieldHtml(key, style, f) {
  var k = '\'' + key + '\',\'' + f.id + '\'', cz = _cz();
  var rm = '<span class="cs-cust-x cs-cust-struct cs-native-x" onclick="csNativeRemove(' + k + ')">✕</span>';
  var lbl = '<span class="cs-stat-ro">' + (_esc(f.label) || '—') + '</span><input class="cs-cust-struct cs-stat-rename" value="' + _esc(f.label) + '" placeholder="Label" oninput="csNativeLabel(' + k + ',this.value)">';
  var ph = _esc(f.placeholder || '');
  if (style === 'statbox') { var si = cz ? '<input class="cs-ph-edit cs-cust-struct" placeholder="0" value="' + ph + '" oninput="csNativePlaceholder(' + k + ',this.value)">' : '<input type="number" placeholder="' + ph + '" value="' + (parseFloat(f.value) || 0) + '" oninput="csNativeVal(' + k + ',this.value)">'; return '<div class="stat-box cs-extra-native"><span class="slabel">' + lbl + '</span>' + si + rm + '</div>'; }
  if (style === 'derivedbox') { var di = cz ? '<input class="dval cs-dval-inp cs-ph-edit cs-cust-struct" placeholder="—" value="' + ph + '" oninput="csNativePlaceholder(' + k + ',this.value)">' : '<input class="dval cs-dval-inp" placeholder="' + ph + '" value="' + _esc(f.value) + '" oninput="csNativeVal(' + k + ',this.value)">'; return '<div class="derived-box cs-extra-native"><span class="dlabel">' + lbl + '</span>' + di + rm + '</div>'; }
  var fi = cz ? '<input class="cs-ph-edit cs-cust-struct" placeholder="placeholder…" value="' + ph + '" oninput="csNativePlaceholder(' + k + ',this.value)">' : '<input placeholder="' + ph + '" value="' + _esc(f.value) + '" oninput="csNativeVal(' + k + ',this.value)">';
  return '<div class="field cs-extra-field cs-extra-native"><label>' + lbl + '</label>' + fi + rm + '</div>';
}

/* ═══ field mutators (scope = fbox) ═══ */
function _ctxF(scope, fid) { var root = _scopeRoot(scope); if (!root) return null; var f = _findBoxNode(root, fid); return (f && f.kind === 'field') ? { f:f } : null; }
function csFieldVal(scope, fid, v) { var c = _ctxF(scope, fid); if (c) c.f.value = v; }
function csFieldClickW(scope, fid, action, arg) {
  var c = _ctxF(scope, fid); if (!c) return; c.f.value = _applyAction(c.f.value, action, arg);
  var el = document.getElementById('field-' + fid); if (!el) return;
  if (action === 'numbar') { var bar = el.querySelector('.cs-bar i'); if (bar) { var mx = (c.f.opts && c.f.opts.max) || 10; bar.style.width = Math.max(0, Math.min(100, ((c.f.value || 0) / mx) * 100)) + '%'; } return; }
  var w = el.querySelector('.cs-f-widget'); if (w) w.innerHTML = _widHTML(c.f, 'csFieldVal(\'' + scope + '\',\'' + fid + '\',', 'csFieldClickW(\'' + scope + '\',\'' + fid + '\',');
}
function csFieldLabel(scope, fid, v) { var c = _ctxF(scope, fid); if (c) c.f.label = v; }
function csFieldPlaceholder(scope, fid, v) { var c = _ctxF(scope, fid); if (c) c.f.placeholder = v; }
function csFieldInline(scope, fid) { var c = _ctxF(scope, fid); if (c) { c.f.inline = !c.f.inline; _scopeRender(scope); } }
function csFieldType(scope, fid, t) { var c = _ctxF(scope, fid); if (!c || !FIELD_TYPES[t]) return; c.f.type = t; c.f.display = _defaultDisplay(t); c.f.value = _fieldBlank(t); c.f.opts = _defaultOpts(t); _scopeRender(scope); }
function csFieldDisplay(scope, fid, d) { var c = _ctxF(scope, fid); if (c) { c.f.display = d; _scopeRender(scope); } }
function csFieldRemove(scope, fid) { var root = _scopeRoot(scope); if (!root) return; _removeBox(root, fid); _setScopeRoot(scope, _prune(root, true)); _scopeRender(scope); }
function csFieldOpts(scope, fid) {
  var c = _ctxF(scope, fid); if (!c) return;
  _modalOpen('Field options', _optsBody(c.f.type, c.f) + '<div class="cs-modal-actions"><button class="btn btn-sm btn-cy" onclick="csFieldOptsSave(\'' + scope + '\',\'' + fid + '\')">Save</button></div>');
}
function csFieldOptsSave(scope, fid) { var c = _ctxF(scope, fid); if (!c) { _modalClose(); return; } _optsRead(c.f.type, c.f); _modalClose(); _scopeRender(scope); }
function csColOpts(scope, boxId, cid) {
  var L = _listC(scope, boxId); if (!L) return; var col = L.columns.find(function(c) { return c.id === cid; }); if (!col) return;
  _modalOpen('Column options', _optsBody(col.type || 'text', col) + '<div class="cs-modal-actions"><button class="btn btn-sm btn-cy" onclick="csColOptsSave(\'' + scope + '\',\'' + boxId + '\',\'' + cid + '\')">Save</button></div>');
}
function csColOptsSave(scope, boxId, cid) { var L = _listC(scope, boxId); if (!L) return; var col = L.columns.find(function(c) { return c.id === cid; }); if (!col) { _modalClose(); return; } _optsRead(col.type || 'text', col); _modalClose(); _scopeRender(scope); }

/* category / box mutators */
function csAddCategory() { _csNormalizeCustom(); var cat = makeCategory(''); CS.customSections.push(cat); CS.layout.order.push('cust:' + cat.id); if (!_cz()) csToggleCustomize(); else renderSheetLayout(); }
function csRemoveCategory(id) { if (!confirm('Delete this category?')) return; CS.customSections = CS.customSections.filter(function(s) { return s.id !== id; }); CS.layout.order = CS.layout.order.filter(function(k) { return k !== 'cust:' + id; }); var el = document.getElementById('cs-cat-' + id); if (el) el.remove(); }
function csCatRename(id, v) { var c = _csFindSec(id); if (c) c.title = v; }
function csAddBoxMenu(scope) {
  _modalOpen('Add sub-box', '<div class="cs-modal-lbl">Type</div><div class="cs-modal-actions" style="justify-content:flex-start;flex-wrap:wrap;gap:8px">' +
    '<button class="btn btn-sm" onclick="csAddBox(\'' + scope + '\',\'fields\')">Fields</button>' +
    '<button class="btn btn-sm" onclick="csAddBox(\'' + scope + '\',\'list\')">Table</button>' +
    '<button class="btn btn-sm" onclick="csAddBox(\'' + scope + '\',\'text\')">Text</button>' +
    '<button class="btn btn-sm" onclick="csAddBox(\'' + scope + '\',\'collection\')">Collection</button></div>');
}
function csAddBox(scope, ctype) { var root = _scopeRoot(scope); if (!root) return; root.children.push(makeBox(ctype)); _setScopeRoot(scope, _prune(root, true)); _modalClose(); _scopeRender(scope); }
function csRemoveBox(scope, boxId) { var root = _scopeRoot(scope); if (!root) return; _removeBox(root, boxId); _setScopeRoot(scope, _prune(root, true)); _scopeRender(scope); }
function csBoxRename(scope, boxId, v) { var root = _scopeRoot(scope); if (!root) return; var b = _findBoxNode(root, boxId); if (b) b.title = v; }
function csBoxText(scope, boxId, v) { var root = _scopeRoot(scope); if (!root) return; var b = _findBoxNode(root, boxId); if (b && b.content) b.content.value = v; }
function csAddFieldMenu(scope) { _modalOpen('Add field', '<div class="cs-modal-lbl">Data type</div><div class="cs-modal-actions" style="justify-content:flex-start;flex-wrap:wrap;gap:8px">' + Object.keys(FIELD_TYPES).map(function(t) { return '<button class="btn btn-sm" onclick="csAddField(\'' + scope + '\',\'' + t + '\')">' + FIELD_TYPES[t].label + '</button>'; }).join(' ') + '</div>'); }
function csAddField(scope, type) { var root = _scopeRoot(scope); if (!root) return; root.children.push(makeField(type)); _modalClose(); _scopeRender(scope); }

/* list mutators */
function _listC(scope, boxId) { var root = _scopeRoot(scope); if (!root) return null; var b = _findBoxNode(root, boxId); return (b && b.content && b.content.ctype === 'list') ? b.content : null; }
function csListAddRow(scope, boxId) { var L = _listC(scope, boxId); if (!L) return; L.rows.push({ id:_bankUid(), cells:{} }); _scopeRender(scope); }
function csListRemoveRow(scope, boxId, rid) { var L = _listC(scope, boxId); if (!L) return; L.rows = L.rows.filter(function(r) { return r.id !== rid; }); _scopeRender(scope); }
function csListAddCol(scope, boxId) { var L = _listC(scope, boxId); if (!L) return; L.columns.push({ id:_bankUid(), label:'Column', type:'text', opts:{} }); _scopeRender(scope); }
function csListRemoveCol(scope, boxId, cid) { var L = _listC(scope, boxId); if (!L) return; L.columns = L.columns.filter(function(c) { return c.id !== cid; }); L.rows.forEach(function(r) { if (r.cells) delete r.cells[cid]; }); _scopeRender(scope); }
function csListColLabel(scope, boxId, cid, v) { var L = _listC(scope, boxId); if (!L) return; var col = L.columns.find(function(c) { return c.id === cid; }); if (col) col.label = v; }
function csListColType(scope, boxId, cid, t) { var L = _listC(scope, boxId); if (!L) return; var col = L.columns.find(function(c) { return c.id === cid; }); if (col) { col.type = t; L.rows.forEach(function(r) { if (r.cells) delete r.cells[cid]; }); _scopeRender(scope); } }
function csCellVal(scope, boxId, rid, cid, v) { var L = _listC(scope, boxId); if (!L) return; var row = L.rows.find(function(r) { return r.id === rid; }); if (row) { row.cells = row.cells || {}; row.cells[cid] = v; } }
function csCellClickW(scope, boxId, rid, cid, action, arg) { var L = _listC(scope, boxId); if (!L) return; var row = L.rows.find(function(r) { return r.id === rid; }); if (!row) return; var col = L.columns.find(function(c) { return c.id === cid; }); row.cells = row.cells || {}; if (!row.cells[cid] && col && col.type === 'dice') row.cells[cid] = { formula:(col.opts && col.opts.formula) || '1d6', last:null }; row.cells[cid] = _applyAction(row.cells[cid], action, arg); _scopeRender(scope); }

/* native-extras mutators */
function csAddNative(key) { CS.nativeExtras = CS.nativeExtras || {}; CS.nativeExtras[key] = CS.nativeExtras[key] || []; CS.nativeExtras[key].push(makeField('text')); _renderNativeSlot(key); }
function csNativeVal(key, fid, v) { var l = (CS.nativeExtras || {})[key] || []; var f = l.find(function(x) { return x.id === fid; }); if (f) f.value = v; }
function csNativePlaceholder(key, fid, v) { var l = (CS.nativeExtras || {})[key] || []; var f = l.find(function(x) { return x.id === fid; }); if (f) f.placeholder = v; }
function csNativeLabel(key, fid, v) { var l = (CS.nativeExtras || {})[key] || []; var f = l.find(function(x) { return x.id === fid; }); if (f) f.label = v; }
function csNativeRemove(key, fid) { if (!CS.nativeExtras || !CS.nativeExtras[key]) return; CS.nativeExtras[key] = CS.nativeExtras[key].filter(function(x) { return x.id !== fid; }); _renderNativeSlot(key); }

/* ── drag / split layout (boxes AND field leaves; within a single scope; customize only) ── */
var _csDrag = { scope:null, id:null, side:null };
function csBoxDragStart(e, scope, id) { if (!_cz()) return; _csDrag = { scope:scope, id:id, side:null }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch(_) {} if (e.stopPropagation) e.stopPropagation(); }
function csBoxDragOver(e) {
  if (!_cz() || !_csDrag.id) return;
  e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
  var el = e.currentTarget, r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  var dl = x, dr = 1 - x, dt = y, db = 1 - y, m = Math.min(dl, dr, dt, db);
  _csDrag.side = m === dl ? 'left' : m === dr ? 'right' : m === dt ? 'top' : 'bottom';
  ['cs-drop-l','cs-drop-r','cs-drop-t','cs-drop-b'].forEach(function(c) { el.classList.remove(c); });
  el.classList.add('cs-drop-' + _csDrag.side[0]);
}
function csBoxDragLeave(e) { var el = e.currentTarget; ['cs-drop-l','cs-drop-r','cs-drop-t','cs-drop-b'].forEach(function(c) { el.classList.remove(c); }); }
function csBoxDrop(e, scope, targetId) {
  e.preventDefault(); if (e.stopPropagation) e.stopPropagation();
  var el = e.currentTarget; ['cs-drop-l','cs-drop-r','cs-drop-t','cs-drop-b'].forEach(function(c) { el.classList.remove(c); });
  if (!_cz() || _csDrag.scope !== scope || !_csDrag.id) return;
  var root = _scopeRoot(scope); if (!root) return;
  _setScopeRoot(scope, _paneMove(root, _csDrag.id, targetId, _csDrag.side || 'bottom'));
  _csDrag = { scope:null, id:null, side:null }; _scopeRender(scope);
}

/* ── layout sidebar (Customize) / nav (View) ── */
function csLayoutSidebar() {
  var side = document.getElementById('cs-layout-side');
  if (!side) { side = document.createElement('div'); side.id = 'cs-layout-side'; side.className = 'cs-layout-side'; side.innerHTML = '<div class="cs-ls-head"><span class="cs-ls-title-h"></span><span class="cs-ls-x" onclick="csLayoutSidebar()">✕</span></div><div class="cs-ls-body"></div>'; document.body.appendChild(side); }
  var open = side.classList.toggle('open'); if (open) renderLayoutSide();
}
function renderLayoutSide() {
  var side = document.getElementById('cs-layout-side'); if (!side) return; _csNormalizeCustom();
  var custom = _cz();
  side.querySelector('.cs-ls-title-h').textContent = custom ? 'Layout' : 'Navigate';
  side.querySelector('.cs-ls-body').innerHTML = CS.layout.order.filter(function(key) { return custom || !CS.layout.hidden[key]; }).map(function(key) {
    if (custom) {
      var i = CS.layout.order.indexOf(key);
      return '<div class="cs-ls-row" draggable="true" ondragstart="csLsDragStart(event,' + i + ')" ondragover="csLsDragOver(event)" ondrop="csLsDrop(event,' + i + ')">' +
        '<span class="cs-ls-handle">⠿</span><input type="checkbox" ' + (CS.layout.hidden[key] ? '' : 'checked') + ' onchange="csLsHidden(\'' + key + '\',this.checked)"><span class="cs-ls-label">' + _esc(_catLabel(key)) + '</span></div>';
    }
    return '<div class="cs-ls-row cs-nav" onclick="csNavTo(\'' + key + '\')"><span class="cs-ls-label">' + _esc(_catLabel(key)) + '</span></div>';
  }).join('');
}
function _catLabel(key) { if (key.indexOf('cust:') === 0) { var c = _csFindSec(key.slice(5)); return c ? (c.title || 'Untitled') : '(deleted)'; } var el = document.getElementById(key); if (el) { var h = el.querySelector('h2'); return h ? h.textContent.trim() : key; } return key; }
function csNavTo(key) { var el = key.indexOf('cust:') === 0 ? document.getElementById('cs-cat-' + key.slice(5)) : document.getElementById(key); if (el) { el.classList.remove('collapsed'); el.scrollIntoView({ behavior:'smooth', block:'start' }); } }
var _csLsFrom = null;
function csLsDragStart(e, i) { _csLsFrom = i; e.dataTransfer.effectAllowed = 'move'; }
function csLsDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function csLsDrop(e, to) { e.preventDefault(); if (_csLsFrom == null || _csLsFrom === to) return; var o = CS.layout.order, it = o.splice(_csLsFrom, 1)[0]; o.splice(to, 0, it); _csLsFrom = null; renderLayoutSide(); renderSheetLayout(); }
function csLsHidden(key, checked) { CS.layout.hidden[key] = !checked; renderSheetLayout(); }

/* ═══ templates (category / box / sheet) ═══ */
function _loadTemplates() { try { var r = localStorage.getItem(_TPL_KEY); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch(e) { return []; } }
function _saveTemplates(a) { try { localStorage.setItem(_TPL_KEY, JSON.stringify(a)); } catch(e) {} }
function _regenIds(node) {
  if (node.kind === 'field') { node.id = _bankUid(); return; }
  if (node.kind === 'box') { node.id = _bankUid(); var c = node.content; if (c.ctype === 'fields') _regenIds(c.root); if (c.ctype === 'list') { c.columns.forEach(function(x) { x.id = _bankUid(); }); c.rows = []; } if (c.ctype === 'collection') { _regenIds(c.record); c.instances = []; } return; }
  node.children.forEach(_regenIds);
}
function _stripValues(node) {
  if (node.kind === 'field') { node.value = _fieldBlank(node.type); return; }
  if (node.kind === 'box') { var c = node.content; if (c.ctype === 'fields') _stripValues(c.root); if (c.ctype === 'list') c.rows = []; if (c.ctype === 'text') c.value = ''; if (c.ctype === 'collection') { _stripValues(c.record); c.instances = []; } return; }
  node.children.forEach(_stripValues);
}
function csSaveAsTemplate(scope, a, b) {
  var data, def;
  if (scope === 'category') { var cat = _csFindSec(a); if (!cat) return; data = JSON.parse(JSON.stringify(cat.root)); def = cat.title; }
  else { var root = _scopeRoot(a); if (!root) return; var box = _findBoxNode(root, b); if (!box) return; data = JSON.parse(JSON.stringify(box)); def = box.title; }
  var name = prompt('Template name:', def || 'Untitled'); if (name == null) return;
  _stripValues(data);
  var all = _loadTemplates(); all.push({ id:_bankUid(), title:name || def || 'Untitled', kind:(scope === 'category' ? 'category' : 'box'), data:data }); _saveTemplates(all);
  alert('Saved template “' + (name || def) + '”.');
}
function csSaveSheetTemplate() {
  _csNormalizeCustom();
  var data = JSON.parse(JSON.stringify({ layout:CS.layout, customSections:CS.customSections, nativeBlocks:CS.nativeBlocks, nativeExtras:CS.nativeExtras, statLabels:CS.statLabels, onboarding:CS.onboarding || null }));
  data.customSections.forEach(function(c) { _stripValues(c.root); });
  Object.keys(data.nativeBlocks).forEach(function(s) { _stripValues(data.nativeBlocks[s].root); });
  Object.keys(data.nativeExtras).forEach(function(k) { data.nativeExtras[k].forEach(function(f) { f.value = _fieldBlank(f.type); }); });
  var name = prompt('Sheet template name:', CS.role || 'My character type'); if (name == null) return;
  var all = _loadTemplates(); all.push({ id:_bankUid(), title:name || 'Sheet', kind:'sheet', data:data }); _saveTemplates(all);
  alert('Saved sheet template “' + (name || 'Sheet') + '”.');
}
function csTemplatePicker() {
  var all = _loadTemplates();
  var body = all.length ? all.map(function(t) {
    var act = t.kind === 'sheet' ? '<button class="btn btn-sm btn-cy" onclick="csNewFromTemplate(\'' + t.id + '\')">New sheet</button>' : '<button class="btn btn-sm btn-cy" onclick="csInsertTemplate(\'' + t.id + '\')">Insert</button>';
    return '<div class="cs-tpl-row"><span><b>' + _esc(t.title) + '</b> <span class="cs-tpl-type">' + t.kind + '</span></span>' + act + '</div>';
  }).join('') : '<div class="cs-modal-hint">No templates yet. Build something, then “Save as template”.</div>';
  _modalOpen('Templates', body + '<div class="cs-modal-actions"><button class="btn btn-sm" onclick="_modalClose()">Close</button></div>');
}
function csInsertTemplate(tid) {
  var t = _loadTemplates().find(function(x) { return x.id === tid; }); if (!t || t.kind === 'sheet') return; _csNormalizeCustom();
  var data = JSON.parse(JSON.stringify(t.data)); _regenIds(data);
  if (t.kind === 'category') { var cat = makeCategory(t.title); cat.root = (data.kind === 'split') ? data : { kind:'split', dir:'col', children:[data] }; CS.customSections.push(cat); CS.layout.order.push('cust:' + cat.id); }
  else { if (!CS.customSections.length) { var nc = makeCategory(t.title); CS.customSections.push(nc); CS.layout.order.push('cust:' + nc.id); } var target = CS.customSections[CS.customSections.length - 1]; target.root.children.push(data); target.root = _prune(target.root, true); }
  _modalClose(); if (!_cz()) csToggleCustomize(); else renderSheetLayout();
}
function csNewFromTemplate(tid) {
  var t = _loadTemplates().find(function(x) { return x.id === tid; }); if (!t || t.kind !== 'sheet') return;
  if (!confirm('Start a new sheet from this template (in a new tab)?')) return;
  var blank = makeBlankCS(); var d = JSON.parse(JSON.stringify(t.data));
  blank.layout = d.layout; blank.customSections = d.customSections; blank.nativeBlocks = d.nativeBlocks; blank.nativeExtras = d.nativeExtras; blank.statLabels = d.statLabels;
  if (d.onboarding) blank.onboarding = d.onboarding;   // creation guidance rides the template
  _modalClose(); _csAdoptSheet(blank);
}
function csManageTemplates() {
  var all = _loadTemplates();
  var body = all.length ? all.map(function(t) { return '<div class="cs-tpl-row"><input class="cs-modal-inp" style="flex:1" value="' + _esc(t.title) + '" onchange="csRenameTemplate(\'' + t.id + '\',this.value)"><span class="cs-tpl-type">' + t.kind + '</span><button class="btn btn-sm" onclick="csDeleteTemplate(\'' + t.id + '\')">Delete</button></div>'; }).join('') : '<div class="cs-modal-hint">No templates saved.</div>';
  _modalOpen('Manage templates', body + '<div class="cs-modal-actions" style="flex-wrap:wrap;gap:6px"><button class="btn btn-sm" onclick="csSaveSheetTemplate()">Save whole sheet</button><button class="btn btn-sm" onclick="csExportTemplates()">⬇ Export JSON</button><button class="btn btn-sm" onclick="csImportTemplatesPick()">⬆ Import JSON</button><button class="btn btn-sm btn-cy" onclick="_modalClose()">Done</button></div>');
}
function csDeleteTemplate(tid) { _saveTemplates(_loadTemplates().filter(function(t) { return t.id !== tid; })); csManageTemplates(); }
function csRenameTemplate(tid, v) { var all = _loadTemplates(); var t = all.find(function(x) { return x.id === tid; }); if (t) { t.title = v; _saveTemplates(all); } }
function csExportTemplates() { var blob = new Blob([JSON.stringify(_loadTemplates(), null, 2)], { type:'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bartmoss_templates.json'; a.click(); }
function csImportTemplatesPick() { var i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = csImportTemplates; i.click(); }
function csImportTemplates(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try { var arr = JSON.parse(ev.target.result); if (!Array.isArray(arr)) arr = [arr]; var all = _loadTemplates(); arr.forEach(function(t) { if (t && t.data && t.kind) { t.id = _bankUid(); all.push(t); } }); _saveTemplates(all); csManageTemplates(); }
    catch(err) { alert('Invalid templates JSON: ' + err.message); }
  };
  r.readAsText(f); e.target.value = '';
}

/* Map an Outfit Designer item ({name,sp,slots,isArmor,notes,locs}) to a CS outfit item */
function _odItemToOutfitItem(it) {
  var locs = it.locs || {};
  return {
    name: it.name || '', category: it.isArmor ? 'ARMOR' : 'ARMOR/CLOTHING',
    cost: 0, wt: 0, notes: it.notes || '', isArmor: !!it.isArmor,
    slots: it.slots || 0, contents: [],
    sp: it.sp || 0, spCurrent: it.sp || 0,
    locs: { head:!!locs.head, torso:!!locs.torso, rarm:!!locs.rarm,
            larm:!!locs.larm, rleg:!!locs.rleg, lleg:!!locs.lleg },
    description: ''
  };
}

/* Import outfit(s) exported from the Outfit Designer (.outfit.json) into new outfit tab(s) */
function csImportOutfit(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      var outfitList = Array.isArray(data) ? data : [data];
      CS.outfits  = CS.outfits  || [];
      CS.wardrobe = CS.wardrobe || [];
      var firstNewIdx = -1, imported = 0;
      outfitList.forEach(function(od) {
        if (!od || !Array.isArray(od.items)) return;
        var tab = { name: od.name || 'Imported Outfit', equipped: false, items: [] };
        od.items.forEach(function(it) {
          var csItem = _odItemToOutfitItem(it);
          tab.items.push(csItem);
          // Keep a reusable copy in the wardrobe
          CS.wardrobe.push({ name: csItem.name, category: csItem.category, cost: 0, wt: 0,
            notes: csItem.notes, isArmor: csItem.isArmor, sp: csItem.sp, description: '' });
        });
        CS.outfits.push(tab);
        if (firstNewIdx < 0) firstNewIdx = CS.outfits.length - 1;
        imported++;
      });
      if (!imported) { alert('No outfit found in this file. Expected an Outfit Designer export (.outfit.json).'); return; }
      _activeOutfitIdx = firstNewIdx;
      renderWardrobe(); renderOutfitSection(); renderFashion(); renderFashionBodyMap(); updateArmorSP();
    } catch (err) { alert('Invalid outfit JSON: ' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
}

function applyCS() {
  if (!document.getElementById('cs-name')) return; // Not in CS context
  document.getElementById('cs-name').value = CS.name || '';
  document.getElementById('cs-handle').value = CS.handle || '';
  document.getElementById('cs-role').value = CS.role || '';
  document.getElementById('cs-age').value = CS.age || '';
  document.getElementById('cs-sa').value = CS.sa || '';
  document.getElementById('cs-reputation').value = CS.reputation || CS.money || 0;
  document.getElementById('cs-notes').value = CS.notes || '';
  document.getElementById('skill-points').value = CS.skillPoints || 40;
  var _ipInp = document.getElementById('ip-points'); if (_ipInp) _ipInp.value = CS.ip || 0;
  if (CS.photo) {
    document.getElementById('photo-img').src = CS.photo;
    document.getElementById('photo-img').style.display = '';
    document.getElementById('photo-placeholder').style.display = 'none';
  } else {
    document.getElementById('photo-img').style.display = 'none';
    document.getElementById('photo-placeholder').style.display = '';
  }
  var _pc = document.getElementById('photo-clear'); if (_pc) _pc.style.display = CS.photo ? '' : 'none';
  // A partial sheet (e.g. a GM-seeded Party sheet with only a name) may arrive without a skills
  // map. Guard here — this runs before the other CS.* guards below, and a throw would abort applyCS
  // and (in joined mode) stall live publishing so the sheet silently stops saving.
  if (!CS.skills || typeof CS.skills !== 'object') CS.skills = {};
  DB.skills.forEach(function(s) { if (!(s.name in CS.skills)) CS.skills[s.name] = 0; });
  if (!CS.customSkills) CS.customSkills = [];
  _csNormalizeCustom();
  if (!CS.specialAbilities) CS.specialAbilities = {};
  if (!CS.settings) CS.settings = { forceNetrunner:false, showAllRoleSkills:false };
  if (!CS.wounds || CS.wounds.length !== 40) CS.wounds = new Array(40).fill(false);
  if (!CS.outfit)    CS.outfit    = [];
  // Migrate legacy CS.armor items into CS.fashion
  if (CS.armor && CS.armor.length) {
    CS.armor.forEach(function(a) {
      if (!CS.fashion) CS.fashion = [];
      var already = CS.fashion.some(function(f) { return f.isArmor && f.name === a.name; });
      if (!already) {
        CS.fashion.push({ name: a.name, category: 'ARMOR', cost: a.cost || 0, wt: 0, notes: a.notes || '',
          slots: 0, isArmor: true, isOutfit: false, contents: [],
          sp: a.sp || 0, spCurrent: a.spCurrent || 0,
          locs: a.locs || { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false },
          description: a.description || '' });
      }
    });
    CS.armor = [];
  }
  if (!CS.armor) CS.armor = [];
  if (!CS.fashion)   CS.fashion   = [];
  CS.fashion.forEach(function(f) {
    if (f.sp == null)        f.sp        = 0;
    if (f.spCurrent == null) f.spCurrent = f.sp || 0;
    if (!f.locs) f.locs = { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false };
  });
  if (!CS.wardrobe)  CS.wardrobe  = [];
  if (!CS.outfits || !CS.outfits.length) {
    // Migrate legacy isOutfit/isArmor items from CS.fashion into first outfit
    var legacyItems = CS.fashion.filter(function(f) { return f.isOutfit || f.isArmor; });
    CS.outfits = [{ name: 'Outfit A', equipped: true, items: legacyItems }];
    CS.fashion  = CS.fashion.filter(function(f) { return !f.isOutfit && !f.isArmor; });
  }
  CS.outfits.forEach(function(o) {
    if (!o.items) o.items = [];
    o.items.forEach(function(f) {
      if (f.sp == null)        f.sp        = 0;
      if (f.spCurrent == null) f.spCurrent = f.sp || 0;
      if (!f.locs) f.locs = { head:false, torso:false, rarm:false, larm:false, rleg:false, lleg:false };
      if (!f.contents) f.contents = [];
      if (!f.slots)            f.slots     = Math.max(_getFashionSlots(f), 2);
    });
  });
  // Ensure at least one outfit is equipped
  var _anyEquipped = CS.outfits.some(function(o) { return o.equipped; });
  if (!_anyEquipped && CS.outfits.length) CS.outfits[0].equipped = true;
  if (!CS.notStored) CS.notStored = [];
  if (!CS.hands)     CS.hands     = [null, null];
  if (!CS.vehicles)  CS.vehicles  = [];
  if (!CS.netrunner) CS.netrunner = { mode:'vanilla', deckId:null, deckPhoto:'', deckCustomOptions:[], programs:[], quickhacks:[], assets:[] };
  if (!CS.netrunner.programs)      CS.netrunner.programs      = [];
  if (!CS.netrunner.quickhacks)    CS.netrunner.quickhacks    = [];
  if (!Array.isArray(CS.netrunner.assets)) CS.netrunner.assets = [];
  // Demons carry a list of sub-program ids (Grimoire ⑧) — normalize old programs
  (CS.netrunner.programs || []).forEach(function(p){ if (p.demon && !Array.isArray(p.carries)) p.carries = []; });
  if (!CS.netrunner.deckCustomOptions) CS.netrunner.deckCustomOptions = [];
  if (CS.netrunner.deckPhoto  == null) CS.netrunner.deckPhoto  = '';
  if (!CS.netrunner.mode)          CS.netrunner.mode = 'vanilla';
  if (!CS.netrunner.icon) CS.netrunner.icon = { name:'', style:'', photo:'' };
  if (!CS.netrunner.interface) CS.netrunner.interface = 'plugs';
  if (CS.netrunner.netAccessCode == null) CS.netrunner.netAccessCode = '';
  if (CS.netrunner.heat == null) CS.netrunner.heat = 0;
  if (CS.netrunner.heatNotes == null) CS.netrunner.heatNotes = '';
  if (CS.netrunner.signatureProgramId === undefined) CS.netrunner.signatureProgramId = null;
  if (!CS.lifepath)  CS.lifepath  = { fields:{}, events:[] };
  if (!CS.lifepath.fields) CS.lifepath.fields = {};
  if (!CS.lifepath.events) CS.lifepath.events = [];
  if (CS.lifepath.freeform == null) CS.lifepath.freeform = '';
  if (!CS.lifepath.rolled) CS.lifepath.rolled = {};
  if (!CS.lifepath.collapsed) CS.lifepath.collapsed = {};
  if (!CS.contacts)  CS.contacts  = [];
  CS.contacts.forEach(function(c){ if (c.description == null && c.notes != null) { c.description = c.notes; } delete c.notes; });
  if (!CS.jobs)      CS.jobs      = [];
  if (!CS.lifestyle) CS.lifestyle = { cash:0, salary:0, credchips:[], credchipsOpen:false, housing:[], services:[] };
  if (!CS.lifestyle.credchips)  CS.lifestyle.credchips  = [];
  if (!CS.lifestyle.housing)    CS.lifestyle.housing    = [];
  if (!CS.lifestyle.services)   CS.lifestyle.services   = [];
  if (!CS.lifestyle.accounts)   CS.lifestyle.accounts   = [];
  if (!CS.lifestyle.payees)     CS.lifestyle.payees     = [];
  if (!CS.lifestyle.sharkLoans) CS.lifestyle.sharkLoans = [];
  if (!CS.lifestyle.activeAccountId) CS.lifestyle.activeAccountId = 'cash';
  if (!CS.lifestyle.groceries)  CS.lifestyle.groceries  = { quality: 'Generic Prepak', multiplier: 'Fair' };
  if (CS.lifestyle.month == null) CS.lifestyle.month = 0;
  if (!CS.lifestyle.bankAssets) CS.lifestyle.bankAssets = {};
  CS.lifestyle.accounts.forEach(function(a) {
    if (!a.inputs)   a.inputs   = [];
    if (!a.loans)    a.loans    = [];
    if (!a.ledger)   a.ledger   = [];
    if (!a.deposits)  a.deposits  = [];
    if (!a.holdings)  a.holdings  = [];
    if (!a.policies)  a.policies  = [];
    if (!a.financing) a.financing = [];
    if (!a.escrows)   a.escrows   = [];
    if (a.balance == null) a.balance = 0;
    if (a.feeAccountId === undefined) a.feeAccountId = a.id;
    // Migrate legacy single loan → loans array
    if (a.loan && (parseFloat(a.loan.principal)||0) > 0) {
      a.loans.push({ id: _bankUid(), label: a.loan.label || 'Loan',
        principal: parseFloat(a.loan.principal)||0, rate: parseFloat(a.loan.rate)||0, collateral: 0 });
    }
    delete a.loan;
    a.inputs.forEach(function(i){ if (!i.id) i.id = _bankUid(); });
  });
  CS.lifestyle.services.forEach(function(s) {
    if (s.accountId === undefined) s.accountId = null; // null = paid from cash
  });
  CS.lifestyle.housing.forEach(function(h) {
    if (h.billAccountId === undefined) h.billAccountId = null;
  });
  CS.lifestyle.housing.forEach(function(h) {
    if (!h.cargoContents) h.cargoContents = [];
    if (!h.utilities)     h.utilities     = [];
    if (h.cargoOpen === undefined) h.cargoOpen = false;
  });
  CS.vehicles.forEach(function(v) {
    if (!v.cargoContents) v.cargoContents = [];
    if (!v.photo) v.photo = '';
    if (!v.customOptions) v.customOptions = [];
    if (!v.activeOptions) v.activeOptions = [];
    if (v.cargoSlotsCustom === undefined) v.cargoSlotsCustom = null;
    if (v.accelerate == null) v.accelerate = 0;
    if (v.decelerate == null) v.decelerate = 0;
  });
  renderStats();
  renderSkills();
  renderCyber();
  renderWeapons();
  renderArmor();
  renderOutfit();
  renderWardrobe();
  renderFashion();
  renderNotStored();
  renderGear();
  renderVehicles();
  renderNet();
  renderNetIdentity();
  renderNetAssets();
  renderPress();
  renderComputer();
  renderLifestyle();
  renderLifepath();
  renderNetwork();
  renderWounds();
  _csNormalizeCustom();
  renderSheetLayout();
  renderNativeExtras();
  try { renderPending(); } catch (e) {}   // mount/reconcile the buy tray (e.g. shop purchases arriving via sync)
  if (window.CSOnboarding) window.CSOnboarding.afterApply();
}

/* ═══ INIT (runs after data is loaded) ═══ */
function init() {
  var isStandaloneCS = document.body && document.body.dataset.mode === 'cs';

  if (!isStandaloneCS) {
    /* ─── Plain-mode restore ─── */
    try { if (localStorage.getItem('bartmoss_plain') === '1') document.documentElement.setAttribute('data-plain', ''); } catch(e) {}

    /* ─── Sidebar categories ─── */
    document.querySelectorAll('.cat').forEach(function(c) { c.onclick = function() { setCategory(c.dataset.panel); }; });

    // Restore collapsed sidebar
    try { if (localStorage.getItem('sidebarCollapsed') === '1') { var app = document.getElementById('app'); if (app) { app.classList.add('side-collapsed'); var cb = document.getElementById('sidebar-collapse'); if (cb) cb.textContent = '»'; } } } catch(e) {}

    /* ─── Database ─── */
    dbDatasets = Object.keys(DB);
    dbCur = dbDatasets[0];
    document.getElementById('db-search').addEventListener('input', dbRender);
    document.getElementById('db-thead').addEventListener('click', function(e) {
      var th = e.target.closest('th'); if (!th) return;
      var col = th.dataset.col;
      if (dbSort === col) dbSortAsc = !dbSortAsc; else { dbSort = col; dbSortAsc = true; }
      dbRender();
    });
    setDbTab(dbCur);

    // Initial sub-nav for the active category (home) + preload menu tool view
    renderSubNav('home');
    showTool('menu');

    // Player mode (in-app: role=player → index.html?player=1): add a prominent
    // CONNECT button to the sidebar foot, above the collapse arrow.
    if (new URLSearchParams(location.search).get('player') === '1') {
      _initPlayerConnect();
      // Arrived here from LAN discovery on another hub → pop the connect dialog straight away.
      if (new URLSearchParams(location.search).get('autoconnect') != null) setTimeout(playerConnect, 60);
    }
  }

  /* ─── Character sheet data ─── */
  ARMOR_DB = DB.gear.filter(function(g) { return g.category === 'ARMOR/CLOTHING'; });
  CS = makeBlankCS();

  /* ─── Standalone CS: restore the open tabs (mirrors the NPC sheet) ─── */
  if (isStandaloneCS) {
    var _params = new URLSearchParams(window.location.search);
    // Joined mode (?campaign=&sheet=): the sheet comes from the campaign via
    // js/cs-join.js — do NOT load the local localStorage tabs here (they'd
    // clobber the bound sheet, since init() runs after cs-join's setup).
    window.__csJoined = !!(_params.get('campaign') && _params.get('sheet'));
    // File-bridge mode (?cdoc=1): the sheet is loaded from a campaign file by
    // js/campaign-doc.js; same as joined mode, don't touch local tabs.
    var _cdoc = _params.get('cdoc') === '1';
    // Player "Send my sheet" (?mode=send): we DO want the local active sheet
    // loaded so cs-join can push it to the hub. "receive" (default) keeps the
    // placeholder and pulls the GM's copy.
    var _sendMode = _params.get('mode') === 'send';
    if ((window.__csJoined && !_sendMode) || _cdoc) {
      SHEETS = [makeBlankCS()]; csActiveIdx = 0; CS = SHEETS[0]; // placeholder until the bridge binds
    } else {
      var imported = null;
      try {
        var ssKey = _params.get('key');
        if (ssKey) { var stored = sessionStorage.getItem(ssKey); if (stored) imported = JSON.parse(stored); }
      } catch(e) { console.warn('Could not load CS from sessionStorage:', e); }
      try {
        var saved = JSON.parse(localStorage.getItem(_CS_LS) || 'null');
        if (saved && Array.isArray(saved.list) && saved.list.length) {
          SHEETS = saved.list;
          csActiveIdx = Math.min(Math.max(0, saved.active || 0), SHEETS.length - 1);
        }
      } catch(e) { SHEETS = []; csActiveIdx = 0; }
      if (imported) { SHEETS.push(imported); csActiveIdx = SHEETS.length - 1; }   // ?key import = new tab
      if (!SHEETS.length) SHEETS = [makeBlankCS()];
      CS = SHEETS[csActiveIdx];
    }
  }

  /* ─── Role list ─── */
  var roleList = document.getElementById('role-list');
  if (roleList) {
    DB.roles.forEach(function(r) { var o = document.createElement('option'); o.value = r.name; roleList.appendChild(o); });
  }
  var csRoleEl = document.getElementById('cs-role');
  if (csRoleEl) {
    csRoleEl.addEventListener('change', function() {
      CS.role = this.value;
      var found = DB.roles.find(function(r) { return r.name === CS.role; });
      CS.sa = found ? found.specialability.name : '';
      document.getElementById('cs-sa').value = CS.sa;
      renderSkills();
      renderNetIdentity();
      renderNetAssets();
      renderPress();
    });
  }

  /* ─── Click outside dropdown ─── */
  document.addEventListener('click', function(e) {
    if (openDropdown && !e.target.closest('.item-search')) {
      openDropdown.classList.remove('open');
      openDropdown = null;
    }
  });

  applyCS();
  if (isStandaloneCS) {
    renderCsTabs();
    // Re-label the active tab as Name / Handle are typed, and persist edits.
    ['cs-name', 'cs-handle'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function() { if (id === 'cs-handle') CS.handle = el.value; else CS.name = el.value; renderCsTabs(); });
    });
    window.addEventListener('beforeunload', _csPersist);
    // Joined mode: init() has finished, so cs-join can now safely bind the
    // campaign sheet without being overwritten. Deterministic hand-off.
    if (window.__csJoined && typeof window.__csJoinReady === 'function') window.__csJoinReady();
    // File-bridge adapter (campaign-doc.js loads/saves a single sheet file).
    window.__cdocAdapter = {
      load: function (json) { CS = (json && Object.keys(json).length) ? json : makeBlankCS(); SHEETS = [CS]; csActiveIdx = 0; applyCS(); },
      serialize: function () { if (typeof collectState === 'function') collectState(); return CS; },
    };
  }
  initTutorialChips();
  if (window.CSOnboarding) window.CSOnboarding.boot();
}

/* ═══ DATA LOADER ═══ */
async function loadData() {
  var files = {
    corporations: 'data/corporations.json',
    vehicles:     'data/cp2020-vehicles.json',
    decks:        'data/cp2020decks.json',
    gear:         'data/cp2020gear.json',
    programs:     'data/cp2020programs.json',
    roles:        'data/cp2020rolesext.json',
    skills:       'data/cp2020skills.json',
    weapons:      'data/cp2020weapons.json',
    cyberware:    'data/cyberware.json'
  };

  /* Load cyberware effects as internal data (not a browsable DB) */
  var _cyberwareEffectsFile = 'data/cyberware-effects.json';

  var entries = await Promise.all(
    Object.entries(files).map(function([key, url]) {
      return fetch(url).then(function(r) { return r.json(); }).then(function(data) { return [key, data]; });
    })
  );

  DB = Object.fromEntries(entries);
  // Unwrap nested objects where the JSON is { key: [...] }
  if (DB.roles && !Array.isArray(DB.roles) && Array.isArray(DB.roles.roles)) DB.roles = DB.roles.roles;
  // Computers live in the Gear DB (category COMPUTER + an uplink). Surface the net-capable ones as the device catalog.
  DB.computers = (DB.gear || []).filter(function (g) { return g.category === 'COMPUTER' && g.connection; });

  // Load cyberware effects separately (not as a browsable DB), then init
  fetch(_cyberwareEffectsFile)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      CYBER_EFFECTS = data;
      init();
    })
    .catch(function(e) {
      console.warn('Could not load cyberware effects:', e);
      init(); // Still init even if effects fail to load
    });
}

loadData();

/* When embedded as a tool iframe in the app shell, relay ⌘K up so the command
   palette can open even while focus is inside this sheet. */
window.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && window.parent && window.parent !== window) {
    e.preventDefault(); try { window.parent.postMessage({ type: 'nav-key', key: 'k' }, '*'); } catch (_) {}
  }
});
