# ROADMAP — réconcilié contre le code (2026-07-08)

> **Ce que c'est.** Le backlog miné des conversations, **vérifié item par item contre le code réel**
> (6 agents read-only, evidence en `file:line`). Companion de `docs/PROJECT-STATUS.md` (opérationnel proche).
>
> Statut : ✅ **FAIT** · 🟡 **PARTIEL** (socle là, manque X) · ⬜ **OUVERT** (rien/négligeable) ·
> ❌ **OUTDATÉ/ABANDONNÉ**. Horizon quand ouvert : `[court] [moyen] [long]`.
>
> ⚠️ Le mining des transcripts confond « a été dit » et « reste à faire » → beaucoup d'items étaient
> **déjà faits** (combat sync, job board, L'Établi, orgs, galmap, persistance de sessions…). Ce doc est la
> version dégraissée. Re-réconcilier après chaque grosse tranche.

---

## §0 — Ce qui reste VRAIMENT ouvert (priorisé)

**A. Le gros levier — les « spines » = une REFONTE de l'app CAST → 🔨 EN COURS (terminal dédié, 2026-07-08) :**
_CAST possède déjà les révélations (cast-views), les clocks et la primitive `castReveal`. Les 3 items
ci-dessous = rendre CAST réactif/chaînable + rapatrier le trigger legacy orphelin de `app.js:2377`.
Confié à un terminal (prompt design-first livré). Voir PROJECT-STATUS §2 pour l'ownership `app-cast.js`._
1. 🟡 **Déclencheurs chaînés** — n'existe qu'en *une* forme codée en dur (clock < seuil → révèle un event) ;
   pas de lieu/event/squad/loot comme sources, pas de vrai chaînage, et l'éditeur de clock redesigné
   n'expose même plus l'UI de trigger. → **le généraliser = le plus transformateur.** `[moyen]`
2. ⬜ **Cascades de clocks** — aucune automation clock→clock. Extension directe du #1. `[moyen]`
3. 🟡 **Heat / trace** — plusieurs jauges *manuelles* isolées (NetWatch, Press, case-heat, influence org),
   aucune escalade campagne-wide ni mécanique de trace. → en faire un système. `[moyen]`

**B. Wins discrets (moyens, cadrés) :**
4. 🟡 **Joueur voit les fiches des autres** — côté MJ fait (voit/édite tout live) ; côté joueur, il ne
   voit que la sienne. `[moyen]`
5. 🟡 **Orgs ↔ sites à login** — les 2 moitiés existent mais pas câblées : les comptes de login sont
   définis à la main par site, pas dérivés de l'appartenance à une org. `[moyen]`
6. 🟡 **Créateur d'Items** (forge techie généraliste) — n'existe qu'en morceaux (outfit custom, gear
   nom-seul, builder d'ordi). **Débloque le MicroNet.** `[moyen]`
7. ⬜ **Messaging → « téléphone » sur la fiche** (liste les apps de chat du perso). `[moyen]`
8. 🟡 **Media — Data↔Files** (tirer de vraies entités Store comme nœuds d'enquête) + 🟡 **buzz par-story**
   sommé dans le settle mensuel. `[moyen]`

**C. La frontière Net/netrun (gros, largement gaté derrière le créateur d'Items + le netrunning ; le
terminal Net est actif dessus) :**
9. ⬜/🟡 **Netwatch** (système) · **IA/ai-host** (moteur desktop existe, pas câblé au Net) · **MicroNet** ·
   **netrunning complexe** (écriture de programmes / Fast Fortress / PvP) · **recon d'hébergeur** (action
   réelle) · **cast d'un netrun** (layout dédié) · **accès pré-établis** · **skin navigateur** · **peupler
   le Net** (générer N sites). `[long]`

**D. Polish / petit (à faire au fil de l'eau) :**
10. ⬜ Business directory (orgs) · ⬜ contenu NCPD (phase 2, après gangs) · 🟡 placement fin map pour
    shops/services · 🟡 templates de sections côté NPC · 🟡 vrais conteneurs de stockage (briefcase/backpack
    qui *contiennent*) · ⬜ merc service · 🟡 `openPinnedDoc` → router vers le reader (stub) · Media : flag
    `twoStep` corpo inutilisé + deadman leak cosmétique.

**À retirer / ne pas faire :** ❌ Overview Sessions/Events (dead code legacy dans app.js — candidat suppression) ·
❌ lentille CARTE « en Leaflet » (la lentille média est une grille non-Leaflet, l'idée Leaflet est absente —
soit on abandonne le but Leaflet, soit on garde la grille) · ❌ Svelte/PWA (déconseillé, cf §A).

---

## §1 — Statut détaillé par thème

### A. Plateforme
- ✅ **Quitter Neocities** — desktop/Electron + hub Yjs LAN, distant abandonné.
- ✅ **Combat sync** — `src/sync/Campaign.ts:106` (map `combat` : meta round/turn/order, combattants LWW
  init/wounds/status/ammo, log Y.Array) + `js/combat-ui.js` (stage MJ + overlay joueur, MJ-autoritaire).
  _(Était noté [long] — en fait livré.)_
- ⬜ **Svelte / PWA** — aucun code (pas de svelte, pas de service worker/manifest). **Déconseillé** : la base
  vanilla marche, réécriture = churn massif contre 3 terminaux actifs.

### B. Design System
- ✅ **Audit + refactor DS** — faits (confirmé user). Résidu de classes legacy par-module = intentionnel.

### C. Spines — voir §0.A (1 partiel, 2 ouvert, 3 partiel)
- 🟡 Déclencheurs chaînés `js/app.js:2376` (moteur), config `:412`, migrate `app-migrate.js:137` — 1 seule
  forme (clock→event), pas de chaînage, UI trigger absente du nouvel éditeur de clock (`app-cast.js:333`).
- ⬜ Cascades de clocks — clocks inc/dec manuels seulement (`app.js:1090`, `app-cast.js:357`).
- 🟡 Heat/trace — jauges isolées `main.js:5728` (NetWatch), `:5158` (Press), `desktop-media.js:809` (case),
  `organisations.js:4234` (influence) ; pas de système, pas de trace.
- ✅ **Persistance inter-séances** — modèle session-journal `app.js:289` persisté hub (`meta.sessions`),
  drawer `app-shell.js:666`. _(Était ouvert — en fait fait.)_

### D. Fiche joueur (CS)
- ✅ **Finie** (user). Inclut ✅ **Contacts + Fixer + Job board** `main.js:3891` (tire les `jobs.openings`
  des orgs → `CS.jobs`, cut fixer + payout banque). _(Roadmap la donnait « à confirmer » — livré.)_

### E. Export / impression
- ❌ **Abandonné** (user : « oublie »).

### F. Organisations
- ✅ **Rework de l'outil** `organisations.js` (5075 l., 3 profils typés, éditeur d'org-chart SVG, market/stock, jobs).
- ✅ **Gangs** — type « groupe » = gang/crew, tabs dédiés + générateur.
- ✅ **Job openings ↔ fiche** (voir §D).
- 🟡 **NCPD / Agency** — type « agency » générique câblé, mais 0 contenu NCPD dédié (phase 2, après gangs).
- ⬜ **Business directory** — seulement une liste « selected businesses » par org, pas d'annuaire global.
- 🟡 **Orgs ↔ sites à login** — plateforme corpo authentifiée `app-web.js:538` OK + un site peut viser une
  org, mais comptes de login manuels (pas dérivés de l'appartenance).

### G. Shell / Campagne / Files
- ✅ **Files → « L'Établi »** — reader `js/reader.js` (`SourcebookReader`), câblé Books/palette. Reste : ⬜
  `openPinnedDoc` (`app.js:2475`) = stub vers 'files', ne route pas dans le reader.
- ✅ **PARTY columns ⇄ tabs** `app-shell.js:693` (settings.partyMode).
- ✅ **Quitter une campagne** `app-shell.js:176`.
- 🟡 **Équipes + fiches des autres** — MJ voit/édite tout live `app.js:2496` ; joueur ne voit que la sienne.
- 🟡 **Templates de sections partagés** — CS seulement `main.js:6466` ; NPC pas câblé.
- ❌ **Overview Sessions/Events** — dead code legacy `app.js:2262/330/481`, remplacé par shell à onglets +
  Log drawer + section Cast. **Candidat à suppression.**

### H. Cartes (⚠️ « galmap » du roadmap = la carte-monde Night City dans `nightcity.js`, PAS `galmap.html` le générateur de galaxie)
- ✅ **Descriptions par ville / clic / fond blanc / zoom fluide / typo Inkscape** — tout sur la carte-monde
  NC : `nightcity.js:1321` (clic→popup ville), `:1196` (SmoothWheelZoom continu), `:1116` (tuiles Inkscape).
- 🟡 **Placement fin** — OK carte-monde + cartes custom ; cartes de district NC restent district+building+floor
  → placement précis shops/services encore ouvert.
- ✅ **Map = planner étendu** — plans multiples `nightcity.js:684`, poussés en overlay joueurs `:108` ;
  `location-editor.js` coexiste (remplacement conceptuel).

### I. Net / Web frontier — voir §0.C
- 🟡 Netwatch (jauge heat + host coop seulement) · ⬜ IA/ai-host Net (moteur `desktop-ai.js` existe, pas câblé)
  · ⬜ MicroNet · 🟡 netrunning (choix de deck + options + MU ; pas d'écriture de prog / Fast Fortress / PvP)
  · 🟡 recon hébergeur (attributs + placeholder « recon-gated », pas d'action) · ⬜ accès pré-établis · 🟡 cast
  netrun (CAST générique existe, rien de net-spécifique) · 🟡 générateurs (**site generator FAIT**
  `app-web.js:1256/openSiteGenerator` ; program/datafort/micronet/run-resolver ⬜) · ⬜ skin navigateur
  (placeholder) · ⬜ peupler le Net (générateur 1-par-1) · ⬜ messaging→téléphone sur la fiche.

### J. Media
- ✅ **Suites bespoke** `desktop-media.js:906` (renderSignature : panneaux+skins distincts par variante).
  _(Caveats : flag corpo `twoStep` jamais consommé ; deadman leak cosmétique.)_
- ✅ **Blocs presse dédiés** — press engine `app-web.js:922` (story/video cards, layouts), app `press`.
- ✅ **Payouts** — `settleMonth`→`payAdRevenue`→`creditOwner` `app-web.js:1089/2032`.
- 🟡 **Data↔Files** — nœuds tirés du FS virtuel (`sdk.files`), pas de vrai browse des entités Store.
- 🟡 **Buzz par-story → settle** — bump `site.buzz` mais pas sommé par-story dans le settle mensuel.
- ❌ **Lentille CARTE en Leaflet** — la lentille `LENS_IMPL.carte` est une grille NC non-Leaflet ; l'idée
  Leaflet est absente.

### K. Divers
- 🟡 **Créateur d'Items** — morceaux (outfit custom `outfit-designer.js:314`, gear nom-seul `main.js:2419`,
  builder d'ordi `main.js:5432`) ; pas de forge stat-block généraliste. **Débloque MicroNet.**
- 🟡 **Conteneurs de stockage** — `slots` = capacité numérique `outfit-designer.js:47` ; pas de conteneur
  typé qui contient des enfants.
- ⬜ **Merc service** — flavor seulement (gigs/fixer).

---

## §2 — Ordre suggéré (post-réconciliation)

1. **Spines (§0.A)** : généraliser les déclencheurs chaînés → cascades de clocks → système heat/trace.
   Plus gros levier, dans la base (app.js/app-cast.js), peu de conflit avec les terminaux features.
2. **Wins discrets (§0.B)** au fil de l'eau (fiches des autres joueurs, orgs↔login, Data↔Files…).
3. **Créateur d'Items (§0.B #6)** — porte d'entrée du **MicroNet** et de la frontière Net.
4. **Frontière Net/netrun (§0.C)** — le gros morceau, quand la base spines est là (et le terminal Net avance).
5. Polish (§0.D) et **nettoyage** du dead code (Overview Sessions/Events).

_Note : les 3 terminaux (Net/Media/Desktop) sont encore actifs → §0.A/§0.D (base app, orgs, cartes) sont les
zones les plus sûres pour moi ; laisser Net/Media/Desktop à leurs owners._
