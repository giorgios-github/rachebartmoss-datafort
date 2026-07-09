Note: claude-opus-4-8 (the safety classifier) was unavailable when reviewing this subagent's work. Please carefully verify the subagent's actions and output before acting on them.

Verified against the tree. Key facts confirmed: `WebSection` export at app-web.js:1765; `APP_RENDERERS` pattern (715, 820–824); `appMinPower` (80); `blankSite` (105); `chanKey`/`postToBoard` (285/287); `setRich`/`renderRichText`/`mentionBtn`/`openEntityChip`/`revealEntity`/`addToFiles` (467–532); `appBoot`/`chatApp` (705/778); `payAdRevenue`/`settleMonth` (873/881); `paintAppConfig` (1346); **`creditOwner` already exists** (1658, signature `creditOwner(ownerSid, amt, label, accountId)`); `ensureApps` (1745); `DOC_TYPES` in createHub.mjs:200 (already has `sites`,`links`); `CS.specialAbilities[name]` in main.js:842/1100. Two input claims corrected below: `creditOwner` is real (no need to "generalize payAdRevenue"), and `computeAdRevenue` exists at line 48.

Here is the merged spec.

---

# MEDIA APP — BUILD SPEC
**Rache Bartmoss' Datafort · "Live & Direct" media suites on the Net engine**
Target file: `docs/media-app-design.md` · Branch: `redesign/aside-browser` · Coded directly from this document.

All line numbers are current-tree (`js/app-web.js`, 1769 lines) and verified. The app **never rolls dice**: it ingests table results and simulates fallout at the sanctioned Settle-the-Cycle tick.

---

## 0. SUBSTRATE OVERRIDE (2026-07-07 — FINAL, supersedes §1 and the app-web.js parts of §3.3 / §5 / §8)

The media suites are **Desktop OS apps**, NOT app-mode Net sites. `js/app-desktop.js` is a delivered window-manager + app SDK (`Desktop.registerApp({id,name,glyph,onOpen(win,sdk)})`). Another terminal is actively working on the OS files, so **touch no existing OS file** beyond one additive `<script>` line in `app.html`.

- **New self-contained file `js/desktop-media.js`** (loaded after `app-desktop.js`): registers 5 apps via `Desktop.registerApp`; each `onOpen(win, sdk)` runs `mediaApp(win, sdk, CFG_x)`, rendering the newsroom + board into `win.body`. It **injects its own CSS** (no `<head>` edit) and uses ONLY public APIs — the `sdk` (`store` / `sheet()` / `files` [already surfaces `net.intel`] / `notify` / `open` / `web` [= `window.WebSection`] / `shell`), `window.Store`, `window.App`, and `camp()` via `sdk.shell.bridge().sess.camp`.
- **No edits to `app-web.js` / `app-desktop.js` / `createHub.mjs`.** The `WebSection.media` export (§1.2) is NOT added. Instead:
  - **publishStory** builds a page from existing blocks and calls `sdk.web.blankSite(name)` + `window.Store.create/put('site', s)` (public). Published media sites are ordinary Net sites → they get traffic/rep/ad-revenue from the existing GM Traffic-watch / `settleMonth` for free.
  - **credibilityOf** reads `sdk.sheet().specialAbilities['Credibility']` directly.
  - **money** (subs/donations/doses/mobilization) uses a thin local `creditOwner` (getSheet→accounts→`camp().publishSheet`) — a generic bank credit, not a fork of the economy.
  - **auto-comments** use `camp().putNetPost(siteId+':chan:'+slug, post)` (public).
  - **rich text / entity chips** = a small local `renderMentions(⟦type:id|label⟧)` in this file.
- **Cases live on the sheet** at `net.media.cases[]` (player) / `App.uiGet('media').cases` (GM) via `mediaRead/mediaWrite` (mirrors app-desktop's `dtRead/dtWrite`). No `case` Store type, no hub restart (the §2.1 Store-type + cross-player sharing is a later upgrade).
- **Everything else in this doc stands**: the case schema (§2.2), the `mediaApp` view set + `cfg` schema (§3), the OBJECTIF + 7 lenses + DOSSIER (§4), the press-block field specs (§5 — added to `app-web.js` blockRegistry only in a LATER careful-additive pass; v1 `publishStory` uses existing blocks), the 5 suite cfg gradients (§6), the credibility→reach formula + Settle-the-Cycle (§7). Signature change only: `mediaApp(host,json,ctx,cfg)` → `mediaApp(win, sdk, cfg)` rendering into `win.body`; the OBJECTIF/board mount into a stage inside `win.body`.

---

## 1. MODULE STRATEGY  *(historical — see §0 for the final substrate)*

### 1.1 Decision: CO-LOCATE the engine, SPLIT the board, export a thin SDK.

Three sub-decisions, all final:

1. **Engine + economy + publish + suite registration live INSIDE the `app-web.js` IIFE.** They call ~25 closure-private primitives (`computeTraffic`, `computeAdRevenue`, `settleMonth`, `payAdRevenue`, `creditOwner`, `postToBoard`, `chanKey`, `appBoot`, `blankSite`, `Store`, `webSave`/`webGet`, `revealEntity`, `addToFiles`, `setRich`, `mentionBtn`, `openEntityChip`, `pickMention`, `personaSelect`, …). Re-exporting all of these as an SDK is strictly worse than co-location; reimplementing forks the economy. **No SDK for the engine.** It registers on the private `APP_RENDERERS` map exactly like `chatApp` does today (715, 820–824).

2. **The investigation board + 7 lenses live in a NEW file `js/app-media.js`, loaded after `app-web.js`.** This is the large (~800–1000 line), closure-independent chunk: it renders a `case` JSON and needs only rich-text/chip/intel helpers, not the economy plumbing. It consumes a **minimal read/write SDK** exposed as `WebSection.media`.

3. **`WebSection.media` is the ONLY new export surface.** Everything else stays private.

> Rationale for the split seam: the seam is *board vs engine*, not *engine vs economy*. The board is a pure function of a case JSON; the engine is welded to the economy. Splitting there keeps each file coherent and each side independently `node --check`-able.

### 1.2 The export surface (append to the object at app-web.js:1765)

```js
window.WebSection.media = {
  // rich text + entity chips (private → board)
  setRich, renderRichText, mentionBtn, pickMention, openEntityChip, insertAtCursor,
  // intel / reveal bridge
  addToFiles, revealEntity, getIntel: function(){ return (webGet().intel) || []; },
  // store resolve (nodes reference Store entities)
  resolveRef: function(ref){ return ref && Store.resolve(ref); },
  entityChip: function(type,id,label){ return renderRichText('⟦'+type+':'+id+'|'+(label||'')+'⟧'); },
  // credibility (read-only, §7)
  credibilityOf, mediaTrustTank,
  // publish bridge (board builds story → engine writes site)
  publishStory,
  // case persistence (§2)
  caseLoad, caseSave, caseIndex, caseCreate, blankCase,
  // context helpers
  isPlayer, playerSid: function(){ return playerSid(); }, camp, netClock,
  // the board renderer registers itself back:
  registerBoard: function(fn){ _renderBoard = fn; }   // engine calls _renderBoard in the 'case' view
};
```

The board file (`app-media.js`) calls `WebSection.media.registerBoard(renderBoard)` at load, so `mediaApp`'s `case` view can invoke it without a hard file-order dependency beyond "loaded after."

### 1.3 File-touch list

| File | Action | What |
|---|---|---|
| `js/app-web.js` | **edit** | `mediaApp()` engine; `CFG_*` presets + 5 `APP_RENDERERS`; 5 `APP_META`; `ensureMediaApps()` (called at 1054 area); extend `paintAppConfig` (1346) media branch; extend `appMinPower` (80); `publishStory()` + reach helpers; `credibilityOf`/`mediaTrustTank`; `settleCycle()`; `caseLoad/Save/Index/Create`/`blankCase`; `WebSection.media` export; **`_APP_SEEDS` refactor + `registerApp()`** (see §1.4). |
| `js/app-media.js` | **new** | OBJECTIF switcher + 7 lens renderers + DOSSIER. Consumes `WebSection.media`. Zero dice. |
| `css/app-web.css` | **edit** | `.media-app` shell + `.media-*` variants + `.mapp-*` chrome. Charte tokens. |
| `css/app-media.css` | **new** | `.dt-board` investigation-board charte (`.dt-*`, `.lens-*`, `.dt-objectif`, `.dt-dossier`). |
| `app.html` | **edit** | Add `<link rel="stylesheet" href="css/app-media.css">` and `<script src="js/app-media.js"></script>` **after** `app-web.js` / its CSS, in the same set the other app pages load. |
| `hub/createHub.mjs` | **edit** | Add `'cases'` to `DOC_TYPES` (200). **Requires hub restart.** |

`js/app-store.js` needs **no change** — it proxies whatever `DOC_TYPES` the hub exposes. No new client Store code beyond the `caseCRUD` wrappers in app-web.js.

### 1.4 `registerApp()` + `_APP_SEEDS` (ship it)

Refactor `ensureApps` (1745) and the new `ensureMediaApps` to iterate one shared array, so five suites register in one object each:

```js
var _APP_SEEDS = [];
function registerApp(def){            // def:{ id, meta, seed, render }
  APP_RENDERERS[def.id] = def.render;
  APP_META[def.id]      = def.meta;
  _APP_SEEDS.push(def.seed);          // seed:{ app,name,preset,appConfig,minPower }
}
// ensureApps()/ensureMediaApps() loop _APP_SEEDS instead of a local defs[].
```

`appMinPower` reads a seed's `minPower` (fallback to the current hard-coded rule) so `media-braindance` → 4, the rest → 3, without editing the function per-suite.

---

## 2. DATA MODEL

### 2.1 Decision: `case` is a first-class Store type.

A case is a shared campaign artifact (any user opens it, GM seeds it, a story publishes *from* it). It maps 1:1 onto the `site` model (`owner` + `props.public` + `known` + `Store.index/resolve` + `Store.visibleToPlayers` + `entity:saved`). **Register Store type `case`** — one line in `hub/createHub.mjs` `DOC_TYPES` (200), the exact pattern already used for `sites`/`links`. Without it `Store.create('case',…)` returns `400 bad type` (createHub.mjs:281).

**Fallback (document in PR, do not build unless the user declines the hub change):** stash cases in the player's `net.media.cases[]` via `webSave`, GM cases in `App.uiGet('web').cases`; `caseIndex` scans `allSheets()`. Cost: no cross-player sharing. **Recommendation: the Store type.**

### 2.2 `case` schema (canonical — one model, all lenses project it)

```jsonc
{
  "id": "case_x9", "kind": "case",
  "name": "Who poisoned the Watson water table", "subtitle": "",
  "owner": "<sid|null>",          // null = GM-authored
  "media": false,                 // true when opened from a media suite → ungreys MONTAGE + WAR lenses
  "known": false,                 // GM reveals to players (like sites)
  "props": { "public": false },   // public → visible to all players
  "subject": null,                // optional {type:'org',id} focus (pickSubjectRestricted)
  "created": 12, "updated": 40,   // netClock() stamps

  "nodes": [{
    "id": "n_1",
    "kind": "entity|claim|note|evidence|event|place|source",
    "ref": { "type":"org|npc|site|shop|item|sheet|location|squad", "id":"…" } | null, // Store OR intel entry; null=freeform
    "label": "Petrochem outflow pipe", "img": "", "note": "",
    "when":  <hours|null>,                       // netClock hours → CHRONO x
    "where": { "locId":"…" } | { "lat":0,"lng":0 } | null, // → CARTE
    "source": "<sourceId|null>",                 // provenance → SOURCES
    "cred":   0,                                  // 0 unconfirmed·1 single·2 corroborated·3 verified
    "heat":   { "legal":0, "threat":0, "adversary":null }, // → HEAT
    "verify": "unverified|corroborated|confirmed|debunked",
    "dropped": false,                             // plea-dropped → greyed everywhere
    "tags": [], "x": 340, "y": 210               // LIENS layout cache (only LIENS persists coords)
  }],

  "links": [{ "id":"l_1", "from":"n_1", "to":"n_3",
    "kind":"knows|employs|funds|owns|met|located-at|caused|contradicts|corroborates|alias|custom",
    "label":"", "cred":0, "directed":true, "active":false }], // cred>=2 solid; active=red trace

  "sources": [{ "id":"s_1", "kind":"contact|doc|intel|observation|anon",
    "ref":{type,id}|null, "label":"", "reliability":0, "shielded":false,
    "checks":{ "called":false,"second":false,"document":false,"onRecord":false } }],

  "claims": [{ "id":"c_1", "text":"", "stance":"ours|rival|neutral",
    "sources":["s_1"], "counters":["c_2"], "channel":"<siteId|null>",
    "reach":0, "cred":0, "momentum":0, "state":"live|collapsing|retracted" }],

  "heat": { "level":0, "rung":0, "adversaries":[], "shields":[],
            "pleas":[{ "topicNodeId":"n_1","deltaOffered":10,"taken":false }] },

  "stories": [{ "id":"st_1", "postType":"article|video|radio|braindance|broadcast|dump",
    "headline":"", "dek":"", "body":"<rich>",
    "sources":["n_1","s_1"], "productionQuality":"low|med|high", "sensationalism":4,
    "dramaticRecreation":false, "angle":"", "beat":"",
    "tableResult": { "composition":18, "credDelta":0 },   // INGESTED, never rolled
    "publishedSiteId": null, "publishedPageId": null }],

  "view": {   // presentation only; never mutates canonical data
    "lens":"liens", "sel":null, "pan":{"x":0,"y":0}, "zoom":1,
    "timeline":{ "lane":"kind", "playhead":null },
    "sources":{ "filter":"all" }, "heat":{ "root":null },
    "carte":{ "center":null, "zoom":12 }, "war":{ "front":"stance" } }
}
```

**Non-destructive contract (reviewer-checkable):** a lens is a pure function of `case + case.view`. Projection `project(node, lens) → {x,y,shown}`: LIENS returns `node.x/y`; CHRONO `{x:tScale(node.when), y:laneY}`; CARTE the marker latlng; HEAT reuses LIENS coords recolored. Only LIENS persists coordinates. Filters set `opacity`/`.dt-dim`, never splice. `case.view.sel` is global and survives lens switches.

### 2.3 Persistence, sync, visibility

- **Persist** = whole-doc `Store.create('case', json)` / `Store.put({type:'case',id}, json)`, debounced 400 ms trailing on structural edits; emit `App.emit('entity:saved',{type:'case'})`. Wire the same repaint listeners the site path uses.
- **Player↔GM sync** rides the existing Yjs Store transport (same channel as sites/sheets). No new transport. For low-latency co-edit, optionally mirror patches through `camp().putNetPost('case:'+id, patch)` + `camp().onNetChange` — the identical pattern `chatApp`/board blocks use.
- **Visibility** = `Store.visibleToPlayers(json)`: GM sees all; a player sees a case if `owner===playerSid()` OR (`known && props.public`). This gives "investigation available to any user, GM sees everything" for free.
- **Nodes → intel:** a node's `ref` points at a Store entity or a Files entry (`net.intel[]`). Dragging from Files reads `getIntel()`; revealing a chip calls `revealEntity(type,id)` then `addToFiles`.
- **Live artifacts stay live:** nothing on the board uses Yjs board posts. Only the *published site's* comments/traffic ride `postToBoard`/`putNetPost`.

### 2.4 Site publish-target additions

Published outlet sites are ordinary block-sites plus these fields (set once at creation, read by the economy):

```jsonc
{ "owner":"<sid>",            // → creditOwner / payAdRevenue routing
  "broadcast":"district|sector|citywide|global", // → reachNeeded()/computeTraffic
  "known":true, "props":{"public":true},
  "licenseStatus":"licensed|underground",         // → powerGate ×1 / ×0.5
  "adRate": <number>, "adSlots": <n>,             // → computeAdRevenue (48)
  "buzz":0, "rep":0, "popularity":0,              // existing economy fields
  "credibility":0,                                // 0–100 per-site accrued (settleCycle)
  "network":"net54|dms|wns|null",                 // NARRATIVE-WAR / sweeps grouping
  "grid":{"x":0,"y":0}, "level":"ldl",            // pirate only (mobile LDL)
  "theme":{ "preset":"screamsheet", "overrides":{} } }
```

No new economy fields beyond `credibility` and `network`; the rest already exist on sites.

---

## 3. THE `mediaApp(host, json, ctx, cfg)` ENGINE

Sibling of `chatApp` (778). One generic renderer; five suites are one-liners differing only by `cfg`.

```js
function mediaApp(host, json, ctx, cfg){
  var boot = appBoot(host, json, ctx); if (!boot) return;      // reuse onboarding/premium/ads/chrome
  var cred = credibilityOf(playerSid());                        // §7
  var st   = mediaState(json);                                  // per-player working state (webGet)
  // shell: left rail (cfg.sections) + main view-router + top OBJECTIF bar
  paintRail(cfg.sections);   // 'desk' 'cases' 'compose' 'publish' 'analytics' (+ 'gmctl' if !isPlayer())
  routeView(st.view || cfg.sections[0]);
  if (camp() && camp().onNetChange) camp().onNetChange(function(){ routeView(st.view); });
}
```

**Views (main pane router):**
- `desk` — newsroom feed of this suite's published stories + drafts + the ratings/mobilization HUD.
- `cases` — case index (list + new/open); opening a case flips to `case` view.
- `case` — mounts `_renderBoard(host, caseJson, ctx)` from `app-media.js` (OBJECTIF + lenses). Sets `caseJson.media = (cfg.mediaLenses.length>0)`.
- `compose` — MONTAGE composer (also reachable as a lens); builds a `story`, calls `publishStory`.
- `publish` — target-site picker + broadcast/licensing + the two-step review board where applicable.
- `analytics` — reach vs credibility two-meter readout, per-story deltas, sweeps/mobilization.
- `gmctl` — GM only: Settle-the-Cycle button, media-trust tank slider, boost/bury, sponsor/heat levers.

### 3.1 `cfg` schema (the five-suite axis knobs)

```js
{
  id:'street-signal', variant:'indie', label:'STREET SIGNAL',
  sections:['desk','cases','compose','analytics'],           // rail (GM also gets 'gmctl')

  lenses:['liens','timeline','carte','sources','heat'],       // 5 universal always on
  mediaLenses:['montage','narrative'],                        // 0–2 media-only; [] = investigator baseline
  foreground:['sources','heat'], demote:['liens','carte'],    // per-suite lens emphasis
  defaultLens:'sources',

  publish:{ model:'standalone|platform|both', hubSiteId:null, licensed:false,
            defaultBroadcast:'district', postTypes:['article','video','radio'],
            dramaticRecreation:true, twoStep:false, reviewChannel:null, airChannel:null },

  money:{ ads:true, adRate:0.9, adSlots:'high|med|low|0', sponsors:false, subs:true, subPrice:50,
          donations:true, bounties:false, productionCostMult:1.0, creditLabel:'…' },

  surveillance:{ model:'none|network|netwatchHeat|magnet-deniable|triangulation',
                 corpAudit:false, heatCeiling:100, heatOn:'author|drop|rig' },

  cred:{ reachCoeff:0.11, credBase:0.5, believeFloor:20,
         sensationalismReward:1.0, productionSwing:20, assignable:false, earned:false,
         governs:'reach|believability|hold|authenticity-mobilization' },

  meter:{ primary:'reach|share|mobilization', hideMoney:false },
  preset:'zine', commentPools:['cynical','paranoid','outrage'],
  vendorAbout:'…', minPower:3, premium:true, cost:0
}
```

### 3.2 GM config editor (extend `paintAppConfig`, 1346)

Add `if (MEDIA_APPS.indexOf(doc.app) >= 0)` branch rendering, with the existing `poke()/preview()` cadence: **Org link** (`pickSubjectRestricted` → `doc.subject`), **Channels** (`name::beat` lines), **Sponsors** (`name::cut::mandate::taboos` lines), **Target press-site picker** (`appConfig.targetSiteId`), **Trust tank / cred floor** numbers, **Rundown** (corpo only). `MEDIA_APPS = ['media-corpo','media-indie','media-leak','media-braindance','media-pirate']` sits next to `GM_ONLY_BLOCKS`.

### 3.3 Seeding (`ensureMediaApps`, called near 1054, GM-only guard)

Same body as `ensureApps`: `blankSite(name)` → `kind:'app'`, `app:id`, `appConfig`, `known:true`, `broadcast:'citywide'`, `props:{public:true}`, `theme:{preset,overrides}`, one `layout:'app'` page → `Store.create('site', site)`. Via `_APP_SEEDS` so it is one loop. **The app site is citywide/installable; the OUTLET it publishes to is a separate GM-authored press site created lazily on first publish.**

---

## 4. LENSES

Board file `js/app-media.js`, mounted in a `.dt-board` scope that **hard-declares charte tokens** (ignores the site theme — the board is a datascreen, identical every campaign):

```css
.dt-board{ --paper:#fff; --pin:#111; --rule:#ddd; --muted:#666; --red:#c0392b;
  --mono:'Space Mono',ui-monospace,monospace; --head:'Eurostile',var(--mono);
  position:absolute; inset:0; background:var(--paper); color:var(--pin);
  font-family:var(--mono); font-size:13px; line-height:1.4; overflow:hidden; }
.dt-board *{ box-sizing:border-box; border-radius:0 !important; }
.dt-frame{ border:2px solid var(--pin); background:var(--paper); }
.dt-node:hover,.dt-btn:hover,.dt-claim:hover{ background:var(--pin); color:var(--paper); }
```
No radius, no shadow, no blur/`backdrop-filter`. Glyphs Unicode-only: cred `▪`/`▫`, verified `✓`, unconfirmed `？`, heat `▲`, source `❋`, location `◎`, note `▤`, evidence `▣`, adversary `⚑`, shielded `▨`, active edge = red.

### 4.1 OBJECTIF (lens switcher)

```js
var LENSES = [
 {id:'liens',   key:'1', glyph:'⌘', label:'LIENS',        universal:true},
 {id:'timeline',key:'2', glyph:'▤', label:'CHRONO',       universal:true},
 {id:'sources', key:'3', glyph:'❋', label:'SOURCES',      universal:true},
 {id:'heat',    key:'4', glyph:'▲', label:'HEAT',         universal:true},
 {id:'carte',   key:'5', glyph:'◎', label:'CARTE',        universal:true},
 {id:'montage', key:'6', glyph:'▣', label:'MONTAGE',      media:true},
 {id:'war',     key:'7', glyph:'⚔', label:'NARRATIVE WAR',media:true},
 {id:'dossier', key:'d', glyph:'☰', label:'DOSSIER',      contextual:true}
];
```
cmdk overlay `.dt-objectif` (open with `\` or `k`; fuzzy filter; `↑/↓`+`Enter`); digit keys `1–7` jump directly; `d` toggles DOSSIER; `Esc` closes. When `!case.media`, MONTAGE/WAR render `.dt-lens-off` (muted, `aria-disabled`, "media suites only"). One `.dt-stage`; switching = `stage.innerHTML=''` then `LENS_IMPL[id].mount(stage, caseJson, api)`, `api = {sel, select(id), save(), rerender(), dossier(node)}`.

### 4.2 Build order + per-lens notes

**P-board-0:** case model + `blankCase`/`caseSave` + `renderBoard` shell + charte + OBJECTIF + global selection + DOSSIER rail.

1. **LIENS** (home). One `.dt-world` with `transform:translate(pan) scale(zoom)`; inside, `<svg class="dt-edges">` beneath a DOM node layer (single transform keeps them aligned). Node cards absolutely positioned at `node.x/y`; edges `<path>`. `cred>=2`→solid `2px`, else dashed; `active`→red; directed→`<marker>` arrowhead. Pan on empty drag; wheel zoom about cursor (clamp 0.3–2.5); node drag updates only that node + `linksOf(id)` paths (no full repaint). Link-draw from `◆` handle → rubber-band → drop → radial `kind` picker. Add via `+ NODE` or drag-from-tray (Files/intel `getIntel()`, contacts, `pickFromTypes([...])`). No dice.
2. **CHRONO.** Bottom time axis `tScale` over `[min,max]` padded to campaign days; lanes by `view.timeline.lane` (`kind|source|adversary|channel`). Undated nodes in `⧖ UNDATED` tray; drag onto axis → `node.when = tScale.invert(x)` snapped to day (ingestion). Draggable red playhead dims `when>playhead`. `caused` links as L→R arcs. Editable date table is the ingestion surface.
3. **SOURCES.** Central 2px spine; `.dt-claim` cards alternate sides; solidity from source count × reliability × independence (0→`？` dashed; 1→`▪▫▫`; ≥2→`▪▪▫`; `onRecord`/reliability 3→`✓ ▪▪▪`). Verify checklist (called·second·document·on-record) — ticking is the ingestion point, recompute live. Filters (all·unconfirmed·single·shielded) dim not remove. Claim solidity writes back to citing nodes'/links' `cred`.
4. **HEAT.** Reuses LIENS `.dt-world`, recolors by `node.heat`; max-heat node → red frame + `▲`. Right-gutter escalation ladder (cease→jam→raid→arrest) with marker from `heat.level` bands (0–24/25–49/50–74/75–100). Adversary re-root: pick adversary → BFS by hop distance (`view.heat.root`). Shielded sources render `▨` in every lens. Plea: accept → node `dropped:true` + `heat.level`↓. `+Δ/−Δ` stepper ingests table fallout; never checks arrest.
5. **CARTE.** Mount Leaflet (`js/vendor/leaflet.js`) on `img/maps/tiles/`; markers from `node.where` using `img/maps/loc-icons.json` by kind/ref.type, tinted by `cred`; `located-at`→polylines; drop-to-place sets `node.where`. **Fallback** (Leaflet/tiles absent, e.g. off `main`): static districts SVG with same drop behavior + "full map unavailable" note. Do **not** postMessage into `nightcity.html` — re-mount in-DOM.
6. **NARRATIVE WAR** (media-only). Projects `claims`. Three columns OUR/neutral/THEIR; `contradicts`/`counters` as red connectors; horizontal virality axis by `reach`; momentum meter; `cred<30`→`state:'collapsing'` red hatch. `channel` chip opens the published press site via `openEntityChip`. Per-claim reach/cred/momentum ingested at Settle.
7. **DOSSIER** (contextual). Selected node + `resolveRef(node.ref)` + touching links + source + metadata. Sections: Identity (Open record → `openEntityChip`, ＋Files/＋Contacts), Metadata editors (when/where/cred/source/heat/tags — the ingestion surface), Connections (jump-to-node keeps current lens), Evidence/notes (`mentionBtn` + `setRich` preview), Lens extras (Verify checklist / shield toggle / WAR steppers).

**MONTAGE** is both the `compose` view and lens 6; it emits a `story` and calls `publishStory` (§5). It renders per suite: broadcast package (corpo), screamsheet longform (indie), raw redaction-only dump (leak), BD "▲ VIDEO SAMPLE ▼" + tabloid (braindance), audio + action-payload (pirate).

---

## 5. PRESS BLOCKS (deliverable B — the GM-modulable SITE side)

New `blockRegistry` entries, same `{kind,label,fields,render}` contract, added under a `BLOCK_GROUPS` group `{label:'Press / media', keys:[…]}` and a `Press site` `BLOCK_PRESETS`. Field `t` restricted to existing `wireField` types (`text,textarea,image,file,select,bool,color,number,lines,plans`) — **no new field type**. Renderers use `eln`, `esc`, `setRich`, `lines`, and `postToBoard`/`boardPosts` where live. Blocks inherit each site's `--web-*` theme.

| # | kind | nature | fields |
|---|---|---|---|
| 1 | `article` | static (core PUBLISH landing) | `headline`(text) `deck`(text) `byline`(text) `dateline`(text) `body`(textarea) `lede`(bool) `sources`(lines) `rating`(select: ''/verified/developing/unconfirmed/recreation) |
| 2 | `masthead` | static | `name` `tagline` `est` `logo`(image) `rule`(bool) |
| 3 | `breaking` | live | `label` `channel` → `boardPosts(chanKey)` red marquee |
| 4 | `videoembed` | special | `title` `src`(file,accept video/*) `poster`(image) `bd`(bool) `timecode`(text) `blur`(bool) → "▲ VIDEO SAMPLE ▼" framed box; `bd`→`◉ BRAINDANCE` head |
| 5 | `review` | static | `title` `items`(lines: `stars::text::author`) |
| 6 | `letters` | live+interactive | `title` `channel` → `boardPosts` letters + compose bar → same key |
| 7 | `correction` | static | `text` `orig` `date` → red left-rule notice |
| 8 | `poll` | interactive | `question` `options`(lines) `channel` → votes as `{tag:'vote',body:opt}` posts, tallies derived |
| 9 | `sponsorstrip` | data | `label` `items`(lines: `name::image::addr`) |
| 10 | `staff` | static | `title` `items`(lines: `name::role::photo`) |
| 11 | `wire` | live | `title` `channel` `beat` → reverse-chron dateline feed (mode:'wire' target) |
| 12 | `obituary`/`classifieds` | static | `title` `items`(lines) |

**Publish-target contract:** the composer's target picker lists sites where `props.public` AND a page contains any landing block `['article','wire','breaking','letters']`. No new economy — all reuse `computeTraffic`/`computeAdRevenue`/`settleCycle` and the `board`/`putNetPost` comment substrate. No GM dice anywhere.

### 5.1 `publishStory(story, cfg, ctx)` — the only bridge

```js
function publishStory(story, cfg, ctx){
  // 1. RESOLVE TARGET
  //    'platform' → append to cfg.publish.hubSiteId; 'standalone' → find-or-create author outlet (lazy).
  //    On create: owner=playerSid(); broadcast=cfg.publish.defaultBroadcast;
  //      known=true; props={public:true}; licenseStatus=cfg.publish.licensed?'licensed':'underground';
  //      adRate/adSlots from cfg.money; theme.preset=cfg.preset.
  // 2. BUILD PAGE (append, never replace) from ordinary blockRegistry blocks by postType:
  //    article→[masthead?,article{headline,deck,byline,dateline,body via setRich,sources list},
  //             ad?,letters{Comments}]; video→[header,videoembed,text,ad,letters];
  //    radio→[header,audio,text,letters]; braindance→videoembed{bd:true} (power-gated);
  //    dump→docs/code blocks verbatim + redaction spans; broadcast→board post on 'underground'/district.
  //    dramaticRecreation → correction/notice{'▲ DRAMATIC RECREATION ▼'} block.
  // 3. COMMENTS key = chanKey(ctx,{channel:pageSlug}) → boardPosts/postToBoard already handle it.
  // 4. PERSIST: site.lastEdit=netClock(); Store.put({type:'site',id},site);
  //    story.publishedSiteId/PageId set; caseSave(theCase); App.emit('entity:saved',{type:'site'}).
  // 5. SEED REACH: site.buzz += initialBuzz(story, cfg, ctx);   // §7.2
}
```

Long-form → append a page; feed items (video/short/broadcast) → append a board post; outlet site created lazily (standalone) or never (platform). GM keeps authoring authority: the app only adds pages/posts to a GM-owned shell.

---

## 6. THE 5 SUITES (functionally distinct, not skins)

Each is `APP_RENDERERS['media-*'] = (h,j,c)=>mediaApp(h,j,c,CFG_*)`. The differences are load-bearing on four axes: **publish model, economy, surveillance/heat, credibility role** — plus which lenses are foreground vs hidden.

| id / name | mediaLenses / foreground / **hidden** | publish | economy | surveillance | credibility role | minPower |
|---|---|---|---|---|---|---|
| **media-corpo** PRIMETIME (Net 54) | montage,narrative / montage,timeline(=rundown),narrative(=sweeps),heat(=S&P) / **sources,liens,carte demoted; sources weak** | **two-step**: submit→S&P review→air; to GM site; credential-gated | ads + sponsor **retainers with strings** (cave/publish/spin) + sweepsBonus 0.15 | **network-inward**: drafts auto-post to `sp-review`; Producer verbs approve/spike/rewrite/mandate | **assigned halo**: `effectiveCred=networkBrandCred×halo + personalSA×credScale×10`; halo revocable; success=reach/share | **4** |
| **media-indie** SAMIZDAT | montage / sources,heat / **narrative hidden** | screamsheet longform → GM press site; player's own button | **subs + patronage, NO ads**, net-loss floor | **unlicensed-hunted**: seizable, pseudonymous, source-shield, subpoena toggle | **earned only**: 2-independent-source Verify gate; earnedCred rises only when a verified un-retracted scoop survives Settle | 3 |
| **media-leak** DEADMAN | (montage suppressed to redaction-only) / sources,heat,liens / **montage min, narrative hidden** | **dump-not-compose**: verbatim docs → GM leak sites; mirror ×N; dead-man's-switch | donations + target bounties, **wallet freezes at heat 70** | **magnet-deniable**: heat on the DROP not the author; hash-shielded submitters; go-dark | **decoupled**: reach = source-solidity (corroboration count), not byline; Credibility only buys an anonymous deniable **vouch** | 3 |
| **media-braindance** SPLICE (DMS) | montage,narrative / montage,narrative,timeline / **sources hidden (DRAMATIZE toggle); heat→EXPOSURE gauge** | BD/tabloid blocks → GM site; **writes site.buzz at compose time** | **doses 25–500cr + 3× adRate + contract lumps** | **extractive**: harvests audience telemetry into Files as blackmail intel | **decoupled from reach** (buzz+addiction carry cred-0); Credibility = **narrative HOLD** (cycles a fabrication survives) | **4** |
| **media-pirate** GHOST FREQ | montage,narrative / carte,heat,montage / **analytics-money hidden; narrative demoted** | ephemeral district-scoped broadcast-log; **raidable**, `broadcast='district'` | **NO ads (adSlots=0)**; tips + merch + conditional stipend − rig upkeep; **MOBILIZATION meter replaces money** | **netwatch triangulation**: heat physical + location-bound on CARTE; go-dark/relocate; martyr bump | **authenticity multiplier on mobilization**: `base×(0.5+0.15·cred)×agitation`; no production lever; surviving a raid **raises** cred | 3 |

**Proof of distinctness (mechanical, not thematic):** corpo is the only suite with a live gatekeeper between compose and publish (two-step + Producer verbs) and a diegetic rundown reach-multiplier; indie is the only one that *earns* cred behind a hard Verify gate and refuses ads; leak is the only one that decouples reach from a byline and puts heat on the artifact; braindance is the only one that writes `site.buzz` at compose time, publishes fabrications, and swaps HEAT for an exposure gauge; pirate is the only one that deletes ad revenue (adSlots forced 0), makes heat physical on the map, and where being attacked helps. Same engine, opposite `cfg` gradients.

### 6.1 seedDefs (into `_APP_SEEDS` via `registerApp`)

```js
// media-corpo
{ app:'media-corpo', name:'PRIMETIME', preset:'screamsheet', minPower:4,
  appConfig:{ channels:['air','sp-review','assignments'], network:'net54', rundown:[],
    sponsors:[{name:'Militech',orgId:null,control:15,retainer:5000,mandate:'Militech: peace through superior firepower.',taboos:['militech','defense']}],
    ratings:[], targetSiteId:null, credential:'talent' } }
// media-indie
{ app:'media-indie', name:'SAMIZDAT', preset:'zine', minPower:3,
  appConfig:{ channels:[], caseSeed:true, patron:null, presetOverrides:{bg:'#ffffff',accent:'#c0392b',rule:'#111111'} } }
// media-leak
{ app:'media-leak', name:'DEADMAN', preset:'zine', minPower:3,
  appConfig:{ objectif:{foreground:['sources','heat'],hidden:['montage','narrative']}, compose:{mode:'dump'},
    reach:{engine:'source-solidity',corroborationThreshold:2}, economy:{donations:true,bounties:true,ads:false},
    surveillance:{model:'magnet-deniable',heatOn:'drop'} } }
// media-braindance
{ app:'media-braindance', name:'SPLICE', preset:'chrome', minPower:4,
  appConfig:{ channels:['hot-drops','the-dish','commissions'], suite:'splice',
    postTypes:['braindance','tabloid'], adRateMult:3, priceRange:[25,500] } }
// media-pirate
{ app:'media-pirate', name:'GHOST FREQ', preset:'zine', minPower:3,
  appConfig:{ rig:{level:'ldl',triangulation:0,dark:false,safehouses:[],upkeepPerCycle:200,lastMoveClock:0},
    mobilization:{}, streetTemperature:0, patron:null, jam:{incoming:[],outgoing:[]},
    presetOverrides:{bg:'#ffffff'} } }
```
The seed loop also sets, for pirate: `site.grid={x:CENTER.x,y:CENTER.y}; site.level='ldl'`. `APP_META['media-*']` entries follow the chat-app shape (`about,nameLabel,cta,premium,premiumName,premiumPitch,perks,cost,price,ads`) — values from the JSON specs (e.g. corpo `cost:750`, braindance/indie/pirate/leak lower or donation-based).

> **New preset `screamsheet`** must be added to the site theme presets (pure white `#fff`, ink `#111`, Eurostile caps, Space Mono, square). Fallback to `corp` if not yet present. `zine` is bone `#f2f0e6`; suites that need pure white pass `theme.overrides.bg:'#ffffff'`. The app *chrome* always renders on charte tokens regardless of the published-site preset.

---

## 7. CREDIBILITY + ECONOMY

### 7.1 Credibility read (never mutated by the app)

```js
function credibilityOf(sid){
  if (!isPlayer()) return 10;                                  // GM authors with full authority
  var rec = camp() && camp().getSheet && camp().getSheet(sid || playerSid());
  var sa  = rec && rec.json && rec.json.specialAbilities;      // main.js:842/1100 — keyed by name
  return Math.max(0, Math.min(10, (sa && (sa['Credibility']|0)) || 0)); // 0–10, non-media → 0
}
function mediaTrustTank(){ var w = App.uiGet('web')||{}; return (w.mediaTrust==null?100:w.mediaTrust); } // GM lever
```

**Soft, layered gate — investigation is ungated, publishing is economics-gated:**
- Board + 5 universal lenses + DOSSIER + case CRUD: open to everyone (the `investigator`/leak baseline is built for non-media). No cred check.
- Publishing: allowed for all; **reach is credibility-scaled**, so a rank-0 poster publishes into obscurity (the intended "posts die" outcome by economics, not a hard block).
- Media-only lenses (`montage`,`narrative`) appear only if `cfg.mediaLenses` includes them AND `canPublish` — everyone in a media suite gets them; the investigator baseline hides them.
- GM (`isPlayer()===false`) bypasses every gate.

### 7.2 Credibility → reach, folded into the EXISTING economy (no `computeTraffic` signature change)

`computeTraffic` (42) already multiplies `broadcast × quality × hostRep × rep × freshness ÷ competition × (1−adDrag) × luck` and **adds `site.buzz`** (46). Credibility enters at **publish, via buzz seeding**:

```
initialBuzz(story,cfg,ctx) = round(
    BASE_STORY(=200)
  * powerGate(story,cfg)
  * credReach(author,cfg)
  * sourcingBonus(story)
  * (0.5 + 0.5*mediaTrustTank()/100) )        // campaign trust tank halves all channels at 0

powerGate = clamp(0.5, 2.0,
      1 + 0.06*sensationalism*cfg.cred.sensationalismReward
        + prodBump(productionQuality)          // low 0 / med .2 / high .4
        + (cfg.publish.licensed ? 0.25 : 0) )
      * (cfg.publish.licensed ? 1 : 0.5)       // underground ×0.5

credReach(author) = cfg.cred.credBase + cfg.cred.reachCoeff * credibilityOf(author)  // ~0.5 … ~1.6
sourcingBonus(story) = 1 + 0.05 * confirmedSourceCount(story)
```

Per-suite overrides: **braindance** — `credReach` floored high (buzz+addiction), Credibility instead sets `holdCycles = 1 + floor(cred/4)`; also `site.buzz += sensationalism spike` at compose. **leak** — replace `credReach` with `corroborationMult` (`<2 sources`→0.4, `≥2`→1.6) + `0.15·mirrorCount`; Credibility only adds an optional anonymous vouch term. **pirate** — no reach-to-money; `mobilizationGain = baseAudience(district)·(0.5+0.15·cred)·agitation`, `adSlots=0`. **corpo** — multiply `powerGate` by the rundown slot multiplier (A≈1.0, buried past C≈0.3) and by the network halo.

The two-meter readout = **reach** (existing `computeTraffic`/`rep`/`buzz`) vs **credibility** (author SA + per-site `site.credibility` 0–100 accrued in the tick). Never merged.

### 7.3 HARD RULE: ingested vs simulated

The app never rolls. `story.tableResult.{composition,credDelta}`, `productionQuality`, `sensationalism`, `verify`, source reliability/independence, heat deltas, sub counts, turnout bands — all typed by GM/player. `publishStory` and `settleCycle` only *simulate fallout*. Zero `Math.random` in board or media code; the only randomness in the vicinity is `computeTraffic`'s existing `luckMult`, owned by the economy and merely displayed.

### 7.4 Settle-the-Cycle tick (superset of `settleMonth`, no dice)

`settleMonth` (881) already accrues `rep`, fades `buzz`, and pays ad revenue via `payAdRevenue` (873) → `creditOwner` (1658). `settleCycle` wraps it:

```js
function settleCycle(){
  Store.index('site').then(function(all){
    settleMonth(all);                                    // reuse rep/buzz/ad revenue unchanged
    all.forEach(function(r){
      var s = r.json; if (!s.app && !s.licenseStatus) return; // media sites only
      // 1. CREDIBILITY DRIFT (ingested): s.credibility += Σ story.tableResult.credDelta
      //    + recoveryDrift(+5..10) − smearPressure(GM-typed); clamp 0..100;
      //    below cfg.cred.believeFloor → s.disbelief=true (reach ×0.5 next cycle).
      // 2. INCOME via creditOwner(s.owner, amt, label, s.payAccount):
      //    subs = subscribers·cfg.money.subPrice; donations = banked tipjar;
      //    sponsors = retainer (zeroed next cycle if its taboo was PUBLISHED against);
      //    doses = ingested reach×loyalty×price (braindance); merch/stipend−upkeep (pirate).
      // 3. LEGAL/NETWATCH HEAT (cfg.surveillance): s.legalHeat += published-negative count;
      //    ladder thresholds LOGGED via br().logSession, never auto-enforced; go-dark decays.
      // 4. COMMENT SIM: for each fresh story, postToBoard(chanKey) N canned comments from
      //    cfg.commentPools, authored via personaSelect so GM injection reads identically.
      // 5. SCOOP / NARRATIVE-WAR: first-published on a shared beat gets a reach flag;
      //    competing stories feed the WAR lens; sweeps winner banks cfg sweepsBonus.
      Store.put({type:'site',id:s.id}, s);
    });
    if (br().logSession) br().logSession('📰 Settled a media cycle — ratings, credibility, income, comments.');
  });
}
```
Chain it from the media `gmctl` view and optionally the existing button in `renderTraffic` (892). All inputs GM/player-typed; the tick only redistributes reach/money/credibility/comments. Income routes through the existing `creditOwner` (1658) — **it already exists; do not reimplement**.

---

## 8. BUILD ORDER (phased, each `node --check`-clean, mapped to tasks #16–#24)

| Phase | Task | Deliverable | Independently testable |
|---|---|---|---|
| **P0** | #16 | `case` Store type (hub line + restart) + `caseCRUD`/`blankCase` + `mediaApp` shell + `appBoot` gate + `_APP_SEEDS`/`registerApp` | `node --check app-web.js`; seed 5 apps appear in Browser; open one → shell paints |
| **P1** | #17 | OBJECTIF + LIENS + DOSSIER + `investigator`/leak baseline (`mediaLenses:[]`) | `node --check app-media.js`; add nodes/links, drag, select, inspect — no publish |
| **P2** | #18 | CHRONO + SOURCES (+ Verify checklist) | date drag sets `when`; ticking checks recomputes solidity → LIENS edge goes solid |
| **P3** | #19 | Press blocks 1–6,11 + `publishStory` + `initialBuzz`/`powerGate`/`credReach` + `street-signal`/indie publish | compose a story → a real page appears on a GM press site; buzz seeded |
| **P4** | #20 | `settleCycle` + comment sim + two-meter analytics + `media-corpo` (rundown, two-step review, sweeps) | run Settle from `gmctl`: rep/cred/income/comments update; corpo draft blocks on `sp-review` |
| **P5** | #21 | HEAT + CARTE (Leaflet + fallback) + `media-indie` full (source-shield, subpoena, ladder) | heat stepper moves rung; drop-to-place sets `where`; map renders or falls back |
| **P6** | #22 | `media-braindance` (buzz-write, DRAMATIZE, doses, EXPOSURE gauge) + blocks 4,8,9 | dose economy credits owner at Settle; fabrication holds N cycles |
| **P7** | #23 | `media-leak` (dump, mirror, dead-man's-switch, vouch) + `media-pirate` (mobilization, triangulation, go-dark, adSlots=0) | leak dump mirrors to N sites; pirate reach is district-bound, money≠reach |
| **P8** | #24 | NARRATIVE WAR lens + sponsors/heat set-pieces + press blocks 7,10,12 + polish | WAR columns render claims; smear momentum collapses a rival at cred<30 |

Each phase leaves `app-web.js` and `app-media.js` syntactically valid and the app bootable; media code is additive to `APP_RENDERERS`, so unfinished suites simply don't seed.

---

## 9. RISKS / OPEN QUESTIONS

1. **Hub restart for `case` type.** Adding `'cases'` to `DOC_TYPES` (createHub.mjs:200) needs a hub restart; `Store.create('case',…)` 400s until then. Mitigation: copy the "restart the hub" UX `newSite` already shows; ship the `net.media.cases[]` fallback behind a flag so the feature degrades to per-player cases if the user declines the hub change. **Decision needed from user: hub change (recommended) or fallback.**
2. **`app-web.js` size.** Engine + economy + 5 cfgs + press blocks add ~1200 lines to a 1769-line file. Split mitigates (board → `app-media.js`, ~900 lines). If it still feels heavy, a later `app-web-media.js` inside a shared IIFE via a build concat is possible but **not** in scope — no build step exists (per CLAUDE.md).
3. **Load order coupling.** `app-media.js` must load after `app-web.js` and call `WebSection.media.registerBoard`. If `app.html` order is wrong the `case` view no-ops gracefully (guard `if(_renderBoard)`), but the board is dead. Verify the `<script>` order in `app.html`.
4. **Leaflet availability off `redesign/aside-browser`.** `js/vendor/leaflet.js` + `img/maps/tiles/` are staged on this branch only. CARTE must feature-detect and fall back to the districts SVG so the suite runs on `main`.
5. **NPC-authored stories.** `credibilityOf` reads player sheets (`specialAbilities`); NPC sheets store cred as `.sa/.saVal` (CLAUDE.md org schema). If NPCs publish, add an NPC branch; otherwise GM authors as themselves (cred 10).
6. **`screamsheet` preset.** Must be added to the site theme presets or the 5 seeds fall back to `corp`/`zine`. Confirm the preset registry location before P4.
7. **Two-step publish (corpo) vs single-button (others).** The review-board state machine (`draft→review→approved→spiked→mandated`) is corpo-only complexity; keep it entirely inside `CFG_CORPO`-gated code paths so the other four suites' publish stays a single call.
8. **Sync granularity.** Cases persist whole-doc (coarse, like sites). Two players co-editing the same board can clobber; the optional `putNetPost('case:'+id,patch)` mirror mitigates but isn't a true CRDT. Acceptable for authored (not real-time-typed) artifacts; flag if the table wants live co-editing.