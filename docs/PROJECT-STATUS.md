# PROJECT STATUS — Rache Bartmoss' Datafort

> **Rôle de ce document.** Tableau de bord de coordination unique du rework (branche
> `redesign/aside-browser`). Il répond à trois questions : **où on en est**, **qui touche quoi**,
> **quoi ensuite**. Le *détail de conception* vit dans `docs/net-app-design.md`,
> `docs/media-app-design.md`, `docs/press-app-design.md` — ici on ne duplique pas, on pointe.
>
> **Maintenu par** le terminal « coordinateur ». Les autres terminaux sont invités à mettre à jour
> leur ligne dans §2 et à cocher/ajouter dans §4–§6 quand ils livrent ou découvrent un bug.
>
> Légende statut : ✅ fait & vérifié · 🟡 codé, **non testé runtime** · 🔴 risque/bug · ⏸ parké/différé · ⛔ ne pas toucher

_Dernière synchro : 2026-07-08._

---

## 1. Snapshot

- **Branche :** `redesign/aside-browser` — `main` intact (dernier commit `ffaabab Add README`).
- **WIP :** 77 fichiers non commités (~22k lignes JS neuf/modifié + CSS + docs). **Aucun checkpoint.**
- **Intégrité :** les 24 modules JS/MJS passent `node --check` (0 erreur syntaxique).
- **Statique vs live :** le site Neocities public reste statique/intact. Le rework MJ tourne en
  contexte desktop/Electron avec un **hub Yjs local** (`node hub/server.mjs`) → sync temps réel
  MJ↔joueurs. **Tester avec le hub**, jamais `python -m http.server` seul.

---

## 2. Chantiers & propriété des fichiers (qui touche quoi)

| Chantier | Terminal | Fichiers cœur | Statut |
|---|---|---|---|
| Shell « aside-browser » + rework 6 sections | coord/base | `js/app-shell.js`, `app-data/core/store/views/links.js`, `css/app-aside.css` | ✅ audité UI |
| **App CAST — refonte déclencheurs chaînés** (réactif/chaînable, cascades de clocks, substrat heat/trace) | ⛔ **cast (nouveau terminal, 2026-07-08)** | `js/app-cast.js` + le path trigger legacy de `js/app.js` (`:2377`, `:412`) + `js/app-migrate.js` + éventuel type dans `js/app-store.js` | 🟡 en cours (design-first) |
| App **Net/Web** (sites, éco, chat, presse-engine) | net | `js/app-web.js`, `css/app-web.css`, `data/cp2020gear.json` (net-devices) | 🟡 v1→Vague 2 |
| App **Media** (newsroom, lentilles, Control Room) | media | `js/desktop-media.js` (+ `css/app-web.css` `.dm-*`) | 🟡 7 lentilles + Régie |
| **Desktop OS — kernel/SDK** | ⛔ **autre terminal** | `js/app-desktop.js` | ne pas toucher |
| Desktop — catalogue OS / apps / connecteurs / fx / IA | desktop | `js/desktop-os-catalog.js`, `desktop-apps.js`, `desktop-apps2.js`, `desktop-connectors.js`, `desktop-shell-fx.js`, `desktop-ai.js`, `css/app-desktop.css` | ✅ vérifié headless |
| Carte Night City | map | `js/nightcity.js`, `css/nightcity.css`, `nightcity.html`, `img/maps/*`, `scripts/build-map-tiles.mjs` | 🟡 fortement modifié |
| Sheet (Computer & Web, Press Card, éco) | base | `js/main.js`, `cs.html` | 🟡 |
| Shop / location editors, palette, ctxmenu | base | `js/shop-editor.js`, `location-editor.js`, `palette.js`, `ctxmenu.js` | 🟡 |

### Fichiers PARTAGÉS (⚠️ édits additifs seulement, lire-avant-d'éditer)

- `app.html` — balises `<script>`/`<link>` de tous les modules. **Additif uniquement.**
- `hub/createHub.mjs` — `DOC_TYPES` (types d'entités sync). Additif. ⚠️ **L'app Electron utilise
  `desktop/hub.bundle.cjs` (figé)** : toute édition de `createHub.mjs` n'a **aucun effet** tant que
  `npm run build:hub` n'a pas régénéré le bundle + app relancée. Le CLI `node hub/server.mjs` utilise
  la source live directement. (Les dossiers de types sont créés en lazy à la 1re écriture, pas au boot.)
- `js/main.js` — sheet, éco bancaire, Computer & Web, Press Card. Multi-auteur.
- `js/app.js` — cerveau de campagne (clocks/events/loot/squads legacy, journal de sessions). **Le
  terminal CAST y touche le path trigger legacy (`:2377`/`:412`)** ; base y touche le reste → additif, lire avant.
- `js/app-cast.js` — ⛔ **désormais zone active du terminal CAST** (refonte en cours). Ne pas éditer sans coord.
- `js/app-web.js` — `WebSection` API publique consommée par Media + Desktop. **Contrat gelé** (voir §3).
- `data/cp2020gear.json` — source unique des net-devices (colonne `category:"COMPUTER" && connection`).

### Contrats GELÉS (ne pas casser sans coordination)

- `window.AppNav` (palette) · `sess.camp.setOverview` (FilmWindow).
- `window.Shell`, `window.Store`, `window.App`, `window.WebSection` (API publiques inter-modules).
- `WebSection.renderSite(host, siteJson, ctx)` — rend un site seul, consommé par `netapp`/Media.
- `slugify()` doit rester **identique** entre `desktop-media.js` et `app-web.js` (clés de feed presse).
- `Desktop.registerApp/registerOS/seedFile` + le `sdk` d'app (store/sheet/files/web/shell/notify/open).

---

## 3. Règles de coordination

1. ⛔ **`js/app-desktop.js` = territoire d'un autre terminal.** Tout passe par CSS / defs d'apps /
   nouveaux fichiers / la sheet. Jamais réécrire la logique du kernel.
2. **Fichiers partagés (§2) = édits additifs, lire le fichier AVANT d'éditer.**
3. **Pas de commit sans feu vert utilisateur.** Décision 2026-07-08 : on **laisse le WIP non commité**
   pour l'instant (terminaux actifs). À rediscuter à la première accalmie (voir §4 P0).
4. **Mode du coordinateur (2026-07-08) : « coordinateur + exécutant à la demande ».** Par défaut je
   surveille, tiens ce doc à jour, signale conflits/risques ; je touche au code (impl./fixes)
   **quand l'utilisateur le demande**, pas de moi-même.
5. **Test runtime = domaine de l'utilisateur (décision 2026-07-08).** Je ne le pilote pas et ne le
   tracke pas comme dette. Convention : **si l'utilisateur ne signale rien sur une feature, elle est
   testée/OK.** Je ne re-flague un souci runtime que s'il le remonte.
6. Un nouveau **type d'entité** (Store/DOC_TYPES) impose un **redémarrage du hub** ; le reste = hard-reload.
7. Charte : encre `#111` sur **blanc PUR `#fff`** (jamais cassé), cadres 2px, coins carrés, zéro
   ombre/gradient, Eurostile Extended + Terminal Grotesque, **glyphes Unicode (jamais SVG/emoji)**,
   inversion au hover. Exemptions : FilmWindow, intérieur de la Map, l'OS desktop (mobilier/voix).
8. Le **desktop OS est en encre-sur-papier** ; la différence entre OS = **mécaniques + mobilier/voix**,
   PAS couleur/police. Scoper toute classe `.dt-*` sous `.dt-root` (elles existent aussi hors OS).

---

## 4. TO FIX — bugs & risques (priorisés)

> Items marqués _(mémoire)_ = signalés dans les notes de conception, **à revérifier contre le code**
> au moment de les traiter (les mémoires sont des instantanés).

- **P0 🔴 La montagne non-commitée.** ~22k lignes, ≥3 terminaux, zéro checkpoint sur `redesign/aside-browser`.
  Risque de perte totale. **Décision 2026-07-08 : laissé non commité** (arbre libre pour les terminaux
  actifs) → **rediscuter à la première accalmie**. En attendant, éviter tout `git reset/stash/checkout` destructif.
- **P0 🟠 Dette de test runtime.** Net/Media/Desktop = `node --check` only. Voir la checklist §6.
- 🟡 **Éco Net — approximations _(mémoire)_ :** overdraft codé en dur (`-50000`) ; board = LWW (pas Y.Array) ;
  `popularity` défaut fixe (pas de tuning MJ) ; service/input **orphelins** si un site est supprimé hors flux.
- 🟡 **Marqueur inventaire « on sale »** appliqué au **gear seulement** ; weapons/cyberware/vehicles
  portent le même flag `_forSale` mais sans traitement visuel _(mémoire)_.
- 🟡 **Flux boutique joueur** (`Store.create('shop')` côté joueur + achat bout-en-bout) non testé en vrai.
- 🔴 **Fuite de secrets diégétique :** mots de passe (auth de site) et DM vivent en clair dans la donnée
  sync — un joueur inspectant le sync brut peut les lire. Choix assumé (confiance table), à documenter.
- 🟡 **Media — nœuds non tirés du Store réel** (add depuis Files/intel seulement) ; affiliation org absente.
- 🟡 **Media — `LENS_IMPL.carte`/`.war` = code mort** (CARTE retirée, NARRATIVE WAR déplacée vers la Régie).
- 🟡 **Media/presse — ad-régie/rate affiché mais pas de versement auto** (à brancher sur `creditOwner` si voulu).
- 🟡 **Press Card — staff `filed`/gains** partiellement branchés à l'éco ; auto-log de l'output publié à finir.
- 🟡 **NC Comms seedé avant** les changements `known`/`messenger` → pas rétro-actif (reseed ou ajout manuel).
- 🟡 **Desktop — perks lore sans effet** (hardened/mesh/overclock/sublock) ; vignettes braindance à
  repointer sur `img/bd/` ; placement fin sur la map (au-delà du district) non fait.
- 🟡 **Computer — revente d'un ordinateur** (`net.owned` ≠ gear) non gérée ; levier MJ « endommager un
  appareil » non fait ; mécaniques dures uplink (wired=home-only, couverture) + stealth/heat = attendent Netwatch.

---

## 5. TO ADD — features (par chantier)

> Ci-dessous = le **proche** (features du rework en cours). Tout ce qui a été reporté **moyen/long terme**
> (plateforme post-Neocities, refactor DS, déclencheurs chaînés, spines de la fiche, export PDF, combat
> sync, Sessions/Events, galmap…) est consolidé dans **`docs/ROADMAP.md`**.

### Net / Web
- ⏸ **Vague 3–5 :** Netwatch (météo + faction + contenu gameable, heat graduelle) · IA (`ai-host`
  drag-drop, arbre scripté + override MJ) · trafic/pubs approfondi · **cast d'un netrun** (layout présentation).
- ⏸ **MicroNet** (hack d'objet) — **attend le créateur d'Items**.
- ⏸ **Complexe netrunning v3 :** build cyberdeck, écriture de programmes (Programming 101), pièges,
  **construction de datafort par les joueurs** (Fast Fortress) → PvP émergent.
- **Recon d'hébergeur** (paliers) · **accès pré-établis** (background perso → état de jeu).
- ⏸ Peupler le Net de **sites in-lore** via le générateur (parké « on va y réfléchir »).
- L'utilisateur doit déposer une **bibliothèque de textures** dans `img/webtextures/` (système construit à vide).

### Media
- **Régie/Control Room — payouts** de monétisation approfondis · **Data↔Files** (lier entités Store au
  case comme nœuds + `＋Files` persiste aussi comme entité Store `data`) · perks pro-tier · buzz par-story
  → `settleMonth` · vue **article seul** (partiel) · polish typo/skins.
- **Features bespoke des suites** (two-step S&P corpo · dump/mirror/deadman leak · doses+buzz braindance ·
  mobilization+adSlots0 pirate) — pour l'instant différenciées au niveau cfg/reach seulement.
- **Blocs presse dédiés** (publie avec header/text/board pour l'instant).
- **CARTE en Leaflet** (lentille retirée, à réintroduire proprement).

### Desktop OS
- **UI MJ « choisir qui apparaît »** (nom / localisation NC2020 / fiche / **placement sur la map**).
- **Dispatch** : offres/ETA/tarifs + gigs DeadDrop · **shops de SERVICES** dans DATA/Shops (mid-term)
  reliés à Dispatch.
- Persister les **positions d'icônes sur la fiche** (au lieu de localStorage) · Comms deep-link vers un
  site de chat précis (partiel via `netapp`) · ⏸ app **BREACH**/netrunning · ⏸ **REP**.
- Optionnel : **push mail GM→joueur** = hook additif ~2 lignes dans `desktop-connectors.js` lisant
  `sheet.net.mailbox` (aujourd'hui le WIRE de newsroom fait le job, self-contained).

### App base (rework 6 sections / shell)
- **CAST — déclencheurs chaînés** (réactif : règles + cascades de clocks + heat/trace) — 🟡 **codé
  Phases 0-4 (2026-07-08), non testé runtime.** Moteur `Rules`/`window.CastRules` + pending-list armée
  (▶ MJ) + rail RULES + éditeur inline + heat/trace = clocks taggées per-joueur, dans `js/app-cast.js`.
  Type Store `rule` (`app-store.js` + `'rules'` DOC_TYPES hub ⇒ **redémarrage hub** — déjà rebuild/relancé).
  Migration `ev.trigger`→doc `rule` (`app-migrate.js`) ; path legacy `app.js:2377` + éditeur `ev.trigger`
  **retirés**. Détail + limites v1 : `docs/cast-triggers-design.md`. Pur app JS (hors type Store) ⇒
  hard-reload. Zone base/CAST, non commité.
- **Cohérence des éditeurs embarqués** (NPC/ORG en cdoc) = workstream à part entière (pass DS).
- **Créateur d'Items** (outil techie) — débloque MicroNet, utile bien au-delà du Net.
- **Rework de l'outil Organisations** puis le relier aux sites à login.

---

## 6. Test runtime — domaine de l'utilisateur

Le test runtime est **géré par l'utilisateur** (décision 2026-07-08), pas tracké ici comme dette.
Convention : **pas de signalement = feature OK**. Pour mémoire, lancer un scénario passe par
`node hub/server.mjs` + navigateur (hard-reload ; redémarrer le hub si un **type d'entité** a changé) ;
harnais headless existants : `scratchpad/cdp.mjs`, `dt-harness.html`.

---

## 7. Différé / parké

Détail complet dans **`docs/ROADMAP.md`**. Rappel des gros différés v3+ : Netwatch · IA (au-delà de
r-console/flux-ai) · MicroNet · netrunning complexe (build deck / Programming 101 / Fast Fortress / PvP).
**Abandonnés (décidés) :** credential-objets auto-remplis (le joueur tape, c'est voulu) · vibrancy Electron
(contredit la charte) · bloc vr-room · navigation distante/WebRTC (LAN-only assumé).

---

## 8. Docs de référence

- `docs/ROADMAP.md` — **backlog moyen/long terme** (relevé des conversations) : plateforme post-Neocities,
  refactor DS, spines, fiche CS, export PDF, combat sync, campagne, carte…
- `docs/net-app-design.md` — conception Net/Web (Part A concept / B mapping code / C plan / D schémas / E différés).
- `docs/media-app-design.md` — conception Media (§0 = override substrat desktop).
- `docs/press-app-design.md` — brief presse (ancré CP2020 *Live & Direct*).
- `docs/cast-triggers-design.md` — CAST déclencheurs chaînés (§0 décisions / A concept / B données / C moteur / D effets / E migration / F UI / G différés / H plan).
- `docs/SYNC.md` — architecture Yjs.
- `CLAUDE.md` — contraintes du repo (statique, thèmes, localStorage, contraintes Neocities).
- Mémoires : `rework-app-6-sections`, `fork-aside-browser`, `net-app-conception`, `media-app-conception`,
  `desktop-os-app`, `preferences-design-utilisateur`.
