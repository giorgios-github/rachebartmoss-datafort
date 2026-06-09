#!/usr/bin/env python3
"""
Parse cyberware notes to extract stat/skill bonuses.
Output: data/cyberware-effects.json
"""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

cyberware = json.load(open(os.path.join(ROOT, 'data/cyberware.json')))
skills_raw = json.load(open(os.path.join(ROOT, 'data/cp2020skills.json')))

# All skill names, longest first (greedy match)
SKILL_NAMES = sorted(set(s['name'] for s in skills_raw), key=len, reverse=True)

# Stat aliases → canonical
STAT_MAP = {
    'body': 'BODY', 'bod': 'BODY', 'bt': 'BODY',
    'ref': 'REF',
    'ma': 'MA',
    'att': 'ATT', 'attr': 'ATT',
    'cool': 'COOL',
    'int': 'INT',
    'emp': 'EMP',
    'luck': 'LUCK',
    'tech': 'TECH',
}
STAT_PATTERN = r'(?:body|bod|bt|ref|ma|att|attr|cool|int|emp|luck|tech)\b'

# Skill aliases found in notes
SKILL_ALIASES = {
    'awareness/notice':           'Awareness/Notice',
    'awareness':                  'Awareness/Notice',
    'notice':                     'Awareness/Notice',
    'personal grooming':          'Personal Grooming',
    'stealth':                    'Stealth',
    'sneak':                      'Stealth',
    'swim':                       'Swimming',
    'swimming':                   'Swimming',
    'climb':                      'Climbing',
    'seduction':                  'Seduction',
    'persuasion':                 'Persuasion & Fast Talk',
    'human perception':           'Human Perception',
    'interrogation':              'Interrogation',
    'disguise':                   'Disguise',
    'wilderness survival':        'Wilderness Survival',
    'endurance':                  'Endurance',
    'wardrobe':                   'Wardrobe & Style',
    'wardrobe & style':           'Wardrobe & Style',
    'wardrobe\\& style':          'Wardrobe & Style',
    'wardrobe style':             'Wardrobe & Style',
    'resist torture':             'Resist Torture/Drugs',
    'resist torture/drugs':       'Resist Torture/Drugs',
    'resist torture\\& drugs':    'Resist Torture/Drugs',
    'first aid':                  'First Aid',
    '1st aid':                    'First Aid',
    'performance':                'Perform',
    'perform':                    'Perform',
    'martial art':                'Martial Art',
    'martialart':                 'Martial Art',
    'hand to hand':               'Brawling',
    'hth':                        'Brawling',
    'athletics':                  'Athletics',
    'facedown':                   'Social',   # facedown rolls
    'language':                   'Language',
    'culture':                    'Culture',
    'streetwise':                 'Streetwise',
    'strength feat':              'Strength Feat',
    'strength':                   'Strength Feat',
    'space survival':             'Space Survival',
    'highrider culture':          'Culture',
    'initiative':                 'Initiative',  # special case
}

# Segments containing these → skip (conditional/temporary effects)
SKIP_RE = re.compile(
    r'\b(?:for\s+\d+|per\s+day|per\s+turn|\d+x\s+per|turns?|hours?\b|temporary|when\s+on|'
    r'once\s+per|3\s+times|1d\d+\+?\d*\s+turns?|each\s+use)\b',
    re.IGNORECASE
)

def match_skill(text):
    t = text.strip().lower()
    # Alias table first
    for alias, canon in SKILL_ALIASES.items():
        if alias in t:
            return canon
    # Full skill name list
    for name in SKILL_NAMES:
        if name.lower() == t or name.lower() in t:
            return name
    return None

def parse_note(notes):
    if not notes:
        return []
    effects = []

    # ── Range patterns:  "+2 to +4 to Skill Name" ──
    for m in re.finditer(
        r'\+(\d+)\s+to\s+\+(\d+)\s+to\s+([^;,.\d][^;,.]*?)(?=[;,.]|$)',
        notes, re.IGNORECASE
    ):
        vmin, vmax, raw = int(m.group(1)), int(m.group(2)), m.group(3)
        sk = match_skill(raw)
        if sk:
            effects.append({'type': 'skill', 'target': sk, 'value': vmin, 'max': vmax})

    # ── Process per segment ──
    for seg in re.split(r'[;]', notes):
        seg = seg.strip()
        if not seg or SKIP_RE.search(seg):
            continue

        # Remove BTM references so they don't confuse stat matching
        seg_clean = re.sub(r'\bbtm\b[^;]*', '', seg, flags=re.IGNORECASE)

        # ── Stat:  "+N STAT" or "STAT +N" or "+N to STAT" ──
        # form A: [+-]N (to)? STAT
        for m in re.finditer(
            r'([+-]?\d+)\s+(?:to\s+)?' + r'(' + STAT_PATTERN + r')',
            seg_clean, re.IGNORECASE
        ):
            val   = int(m.group(1))
            canon = STAT_MAP.get(m.group(2).lower())
            if canon and val != 0:
                _add(effects, {'type': 'stat', 'target': canon, 'value': val})

        # form B: STAT [+-]N
        for m in re.finditer(
            r'(' + STAT_PATTERN + r')\s*([+-]\d+)',
            seg_clean, re.IGNORECASE
        ):
            canon = STAT_MAP.get(m.group(1).lower())
            val   = int(m.group(2))
            if canon and val != 0:
                _add(effects, {'type': 'stat', 'target': canon, 'value': val})

        # ── Skill:  "+N to SkillText" (skip if already matched as range) ──
        for m in re.finditer(
            r'([+-]\d+)\s+(?:to\s+)?([A-Za-z/\\& ]{3,}?)(?=[;,.\d(]|$)',
            seg_clean, re.IGNORECASE
        ):
            val  = int(m.group(1))
            raw  = m.group(2).strip()
            # Don't re-match stats
            if re.match(STAT_PATTERN, raw, re.IGNORECASE):
                continue
            # Don't match short noise words
            if raw.lower() in {'on', 'all', 'the', 'and', 'or', 'a', 'an', 'by', 'at', 'in',
                                'of', 'to', 'from', 'for', 'with', 'via', 'per', 'vs',
                                'stun', 'death', 'save', 'saves',
                                'damage', 'sdp', 'sp', 'healing', 'balance', 'hp'}:
                continue
            # Skip if already in effects (from range match)
            sk = match_skill(raw)
            if sk:
                already = any(e['type'] == 'skill' and e['target'] == sk for e in effects)
                if not already and val != 0:
                    _add(effects, {'type': 'skill', 'target': sk, 'value': val})

    return effects

def _add(lst, entry):
    """Add only if not already present (dedup)."""
    if entry not in lst:
        lst.append(entry)

# Items whose auto-parsed effects should be discarded entirely (false positives)
REMOVE_ITEMS = {
    'Soviet Cyberaudio',           # probabilistic -1 ATTR, not flat
    'Vehicle Link',                # "+2 to vehicle op" matched "Con" skill wrongly
    'Cam-O-Skin',                  # -1 is penalty to others spotting you, not your skill
    'CyberSteriods',               # cost-per-unit, not flat bonus
    'Boostmaster',                 # conditional: only with both boosterware types
    'Digitgrade Legs',             # conditional: with/without tail
    'Dream Suppressant Chip',      # conditional: per week of use
    'Echolocation System Coprocessor',  # side-effect penalty, ambiguous
    'Photo Memory RAM Chip',       # "+2" is to INT roll DC, not a stat
}

# Manual entries for items the parser misses or gets wrong
MANUAL = {
    'Muscle Enhancement':      [{'type':'stat',  'target':'BODY',              'value':1}],
    'Muscle and Bone Lace':    [{'type':'stat',  'target':'BODY',              'value':2}],
    'Kerenzikov Boosterware I':[{'type':'skill', 'target':'Initiative',        'value':1}],
    'Kerenzikov Boosterware II':[{'type':'skill','target':'Initiative',        'value':2}],
    'Sandevistan Speedware':   [{'type':'skill', 'target':'Initiative',        'value':3}],
    'Ubermensch Speedware':    [{'type':'skill', 'target':'Initiative',        'value':2}],
    'Space Chip':              [{'type':'skill', 'target':'Space Survival',    'value':2},
                                {'type':'skill', 'target':'Culture',          'value':1}],
    'Tourism Chip':            [{'type':'skill', 'target':'Language',          'value':1},
                                {'type':'skill', 'target':'Culture',          'value':1}],
    'Auditory Recognition I Chips':  [{'type':'skill','target':'Awareness/Notice','value':1}],
    'Auditory Recognition II Chips': [{'type':'skill','target':'Awareness/Notice','value':2}],
    'Poser Impersonation Chip':[{'type':'skill', 'target':'Perform',           'value':1}],
    'Special Operative Chip':  [{'type':'skill', 'target':'Language',          'value':1}],
}

# ── Build effects map ──
effects_map = {}
skipped = []

for item in cyberware:
    name  = item.get('name', '')
    notes = item.get('notes', '')
    if name in REMOVE_ITEMS:
        continue
    if name in MANUAL:
        effects_map[name] = MANUAL[name]
        continue
    parsed = parse_note(notes)
    if parsed:
        effects_map[name] = parsed

# Add manual entries not in cyberware list
for name, effects in MANUAL.items():
    if name not in effects_map:
        effects_map[name] = effects

# ── Write output ──
out_path = os.path.join(ROOT, 'data/cyberware-effects.json')
with open(out_path, 'w') as f:
    json.dump(effects_map, f, indent=2, ensure_ascii=False)

print(f'Done. {len(effects_map)} items with effects (out of {len(cyberware)}).')
print()

# ── Print summary for review ──
for name, effects in sorted(effects_map.items()):
    print(f'{name}:')
    for e in effects:
        if 'max' in e:
            print(f'  {e["type"]:5s} {e["target"]:30s} +{e["value"]} to +{e["max"]}')
        else:
            v = f'+{e["value"]}' if e['value'] > 0 else str(e['value'])
            print(f'  {e["type"]:5s} {e["target"]:30s} {v}')
