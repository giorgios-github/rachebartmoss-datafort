# CAST — Déclencheurs chaînés (réactifs & cascades)

> Conception du passage de CAST « broadcast manuel » → **système réactif** : cast-views et clocks
> se déclenchent en chaîne. C'est le spine « déclencheurs chaînés » ; il fait émerger les **cascades
> de clocks** et un substrat **heat/trace**. Ce n'est **pas** un moteur bolt-on : c'est une évolution
> de CAST au-dessus des entités existantes.
>
> Zone de travail = base/CAST : `js/app-cast.js`, le path trigger legacy de `js/app.js`,
> `js/app-migrate.js`, `js/app-store.js`. ⛔ Ne pas toucher `js/app-desktop.js` ni les modules des
> terminaux actifs (desktop-*, app-web, desktop-media). Table-first : l'app ne lance aucun dé.
>
> _Phase 0 close le 2026-07-08 — décisions verrouillées ci-dessous._

---

## 0. Décisions verrouillées (Phase 0)

| # | Question | Décision |
|---|---|---|
| Q1 | Où vivent les règles | **Registre central** — nouveau type Store `rule` (miroir de Links). ⇒ **redémarrage du hub** requis (nouveau type d'entité). |
| Q2 | Périmètre v1 | Sources `clock.cross` / `clock.full` / `clock.empty` / `cast.played` / `manual` · Effets `cast.play` (armé) / `clock.advance` / `clock.set` / `reveal.clock` / `loot.grant` / `log`. **Hors v1** : `prop.set`, sources sur props Store. |
| Q3 | Armé vs auto | **Armé + état auto** : les reveals joueurs sont mis en attente (le MJ clique ▶) ; les changements d'état interne (`clock.advance`/`clock.set`/`log`) s'exécutent seuls et alimentent les cascades. |
| Q4 | Heat/trace | **Sous-système séparé, per-joueur, matérialisé en clocks** (voir §B.2). Rendu via clockViz, listé dans le rail, surveillé par le même `clock.cross`. |
| Q5 | Sources | **CAST + loot** — le moteur n'écoute que les entités CAST (clocks/cast/loot). Pas d'écoute des props d'entités Store en v1. |
| Q6 | UX auteur | Tête **« RULES »** dans le rail CAST (comme CLOCKS), édition inline depuis la clock/cast source, état armé/déclenché visible. **Pas** la bande Links. |
| Q7 | Anti-boucle | visited-set + profondeur max **8** + flag `once` ; reset du `firedAt` en début de session + action « reset triggers ». |

---

## A. Concept

- **Réactif** : un changement d'état surveillé (clock qui franchit un seuil, cast diffusé, loot
  donné) évalue un graphe de **règles**. Une règle qui matche **arme** une diffusion et/ou applique
  des effets d'état.
- **Chaînable** : un effet qui modifie un état surveillé (ex. `clock.advance`) **re-rentre** dans le
  moteur → **cascade**. Anti-boucle : visited-set + profondeur max + `once`.
- **Table-first, non négociable** : l'app ne lance **aucun dé** et n'auto-résout **aucun** skill
  check. Un déclencheur, au plus, **arme** une diffusion (le MJ confirme d'un ▶) ou avance un état
  narratif. Jamais de résolution de règle CP2020 côté machine.
- **Idiome CAST préservé** : chaque diffusion joueur reste un ▶ MJ. Le moteur pose des **diffusions
  armées** dans une pending-list ; il ne broadcast jamais tout seul.

## B. Modèle de données

### B.1 Type Store `rule` (registre central)

```json
{
  "id": "rule_…",
  "name": "Trace complète → mercs débarquent",
  "enabled": true,
  "folder": "",
  "when": {
    "src": "clock.cross",          // clock.cross | clock.full | clock.empty | cast.played | manual
    "clockId": "clk_…",            // pour clock.*  (ou sélecteur, voir §C.4)
    "castId": null,                 // pour cast.played
    "dir": "up",                   // up | down   (clock.cross)
    "threshold": 6                  // clock.cross
  },
  "then": [
    { "fx": "cast.play",     "castId": "cast_…" },        // ARMÉ (pending)
    { "fx": "clock.advance", "clockId": "clk_…", "by": 1 }, // auto
    { "fx": "clock.set",     "clockId": "clk_…", "value": 0 },
    { "fx": "reveal.clock",  "clockId": "clk_…" },          // ARMÉ (pending)
    { "fx": "loot.grant",    "lootId": "…" },
    { "fx": "log",           "text": "…" }                  // auto
  ],
  "once": false,
  "firedAt": null,
  "props": {}
}
```

- `when` = **une** source (v1). `then` = **liste** d'effets, appliqués dans l'ordre.
- Effets **armés** (`cast.play`, `reveal.clock`, `loot.grant`) → posés dans la pending-list, attendent
  le ▶ MJ. Effets **auto** (`clock.advance`, `clock.set`, `log`) → appliqués immédiatement, ré-entrent
  dans le moteur.
- `firedAt` : horodatage de dernier déclenchement (null = jamais). `once:true` ⇒ ne re-déclenche pas
  tant que `firedAt` non remis à null. Reset en début de session.
- **Persistance (tranchée Phase 1)** : **un doc `rule` par règle** — type Store `rule` (dir `rules/`),
  pas un `_rules.json` façon Links. Raison : `Store.index` skip les fichiers `_`-préfixés et le pattern
  natif du Store = un fichier par entité ⇒ CRUD (`index`/`create`/`put`/`del`/`resolve`) + rail RULES
  gratuits. Registre central = collection dédiée, distincte des docs qu'elle câble. Ajouté :
  `TYPES.rule` (`app-store.js`) + `'rules'` dans `DOC_TYPES` (`hub/createHub.mjs`, ⇒ redémarrage hub).

### B.2 Heat/trace = clocks taggées, per-joueur

Pas de nouveau type : des docs `clock` **normaux**, un par joueur, taggés :

```json
{ "id": "clk_heat_<player>", "name": "Heat — <player>", "max": 10, "value": 0,
  "style": "bar", "color": "#c0392b",
  "props": { "public": false, "kind": "heat", "player": "<playerId>" } }
```

- `props.kind` ∈ `heat` | `trace` (et clocks narratives = pas de `kind`). `props.player` = le joueur.
- **Conséquences gratuites** : ils SONT des clocks → rendus par clockViz, listables dans le rail
  (groupe **« HEAT / TRACE »** distinct des clocks narratives), et **surveillés par le même
  `clock.cross`**. L'escalade et la trace émergent donc du **seul** moteur de règles.
- Le « séparé » (Q4) vit dans l'**identité per-joueur** + le **regroupement UI**, pas dans une 2e
  machinerie de seuils.

## C. Le moteur

### C.1 Émission des événements
- **`clock.cross`** : émis depuis l'inc/dec CAST — [`app-cast.js:357-358`](../js/app-cast.js#L357).
  Après changement de `value`, comparer `before`/`after` contre les seuils des règles ; émettre
  `{src:'clock.cross', clockId, dir, from, to}`. **Remplace** le path legacy
  [`app.js:2377-2381`](../js/app.js#L2377) (qui ne gérait que `dir:down` + « drops below »).
- **`clock.full`/`empty`** : dérivés quand `to>=max` / `to<=0`.
- **`cast.played`** : émis dans `play(doc)` — [`app-cast.js:56`](../js/app-cast.js#L56).
- **`loot.grant`** : hook sur le flux loot existant.
- **`manual`** : bouton « fire » sur la règle dans le rail RULES.

### C.2 Boucle d'évaluation
```
emit(event):
  queue = [event]; depth = 0; visited = Set()
  while queue not empty and depth < MAX_DEPTH(8):
    ev = queue.shift()
    for rule in rules where rule.enabled and matches(rule.when, ev):
      if rule.once and rule.firedAt: continue
      rule.firedAt = now; persist(rule)
      for fx in rule.then:
        if fx is ARMED:  pending.push(buildArmed(fx))        // attend le ▶ MJ
        else:            applied = applyAuto(fx)              // clock.advance/set/log
                         if applied.emitsEvent and !visited.has(key): queue.push(applied.event)
    depth++
```
- **visited-set** clé = `(ruleId)` ou `(clockId,threshold,dir)` pour couper les cycles.
- Les effets **armés ne ré-entrent pas** (ils attendent le MJ) ; seuls les effets **auto** propagent
  la cascade → borne naturelle + `MAX_DEPTH`.

### C.3 Confirmation MJ (armé)
- La pending-list vit dans le home/rail CAST : chaque entrée = un reveal prêt, bouton ▶.
- ▶ appelle la machinerie existante : `play(castDoc)` → `buildReveal` → `br().castReveal(rev)` ;
  `reveal.clock` → `playClock`. **Aucune** nouvelle primitive de diffusion.

### C.4 Ciblage per-joueur (point ouvert Phase 1)
Les heat-clocks sont N docs (un par joueur). Deux façons d'écrire une règle « heat d'un joueur ≥ 6 » :
- **(a) concrète par joueur** — une règle par joueur (clockId concret). Moteur trivial ; N règles,
  potentiellement auto-générées à l'arrivée d'un joueur.
- **(b) templatée** — `when.clockId` = sélecteur `{kind:'heat'}` (matche n'importe quelle heat-clock),
  effet ciblant `{kind:'trace', player:'$trigger'}` (le trace-clock du **même** joueur).
  **Reco** : (b), résolue par `kind` + « joueur de l'événement » — scale sans N règles, reste
  mono-dimension (pas de cross-joueur). **VALIDÉ + IMPLÉMENTÉ (Phase 2)** : le sélecteur templaté est un
  champ **`clockKind`** distinct (`'heat'|'trace'`), pas un `clockId`-objet — évite le polymorphisme
  string|objet dans le JSON/éditeur. Dans un `when`, `clockKind` matche n'importe quelle clock de ce
  kind ; dans un `then`, `{clockKind, player:'$trigger'}` cible la clock de même kind **du joueur de
  l'événement** (`ev.player` = `props.player` de la clock source). Le `clockId` concret reste l'autre cas.

## D. Effets → mapping sur l'existant

| Effet | Branché sur | Armé ? |
|---|---|---|
| `cast.play` | `play(doc)` → `castReveal` ([app-cast.js:56](../js/app-cast.js#L56)) | oui |
| `reveal.clock` | `playClock(k)` ([app-cast.js:62](../js/app-cast.js#L62)) | oui |
| `clock.advance` / `clock.set` | `Store.put` sur le clock doc (+ re-émission `clock.cross`) | non |
| `loot.grant` | flux loot existant | oui |
| `log` | `br().logSession` | non |

## E. Migration & retrait du legacy

1. **Migration** — [`app-migrate.js:135-141`](../js/app-migrate.js#L135) : au lieu de poser
   `trigger: ev.trigger` sur le cast doc (champ aujourd'hui **orphelin**, jamais lu), émettre un doc
   `rule` : `when:{src:'clock.cross', clockId: ev.trigger.clockId, dir:'down', threshold: ev.trigger.below}`,
   `then:[{fx:'cast.play', castId:<id du cast doc migré>}]`. (Le legacy = `dir:down` + « drops below ».)
2. **Retrait legacy — DIFFÉRÉ EN PHASE 2** (pas Phase 1). Constat de lecture : `buildRun` lit
   `p = meta.prep` ([`app.js:2321`](../js/app.js#L2321)) et la migration met **`prep: null`**
   ([`app-migrate.js:194`](../js/app-migrate.js#L194)) → pour toute campagne v2 le panneau RUN n'a plus
   ni clocks ni events, l'auto-trigger [`app.js:2377-2381`](../js/app.js#L2377) est déjà **inerte**
   (boutons `data-clkp/m` non rendus). On le supprime — avec la config `ev.trigger` UI
   [`app.js:412-414`](../js/app.js#L412) / `saveTrig` [`app.js:436`](../js/app.js#L436) — **en Phase 2,
   quand le moteur reproduit le comportement**, pas avant (ne pas régresser une campagne non migrée).

## F. UI d'auteur & visibilité MJ

- **Rail CAST** : nouvelle tête **« RULES »** (après CLOCKS) listant les règles avec badge d'état
  (armée / déclenchée / off) et un bouton « fire » (source `manual`). Groupe **« HEAT / TRACE »**
  pour les clocks taggées.
- **Édition inline** : depuis l'éditeur d'une clock/cast → section « quand ceci franchit X → … »
  (crée/édite la règle liée). Réutilise le chrome fiche existant, pas la bande Links.
- **Pending-list** : bandeau dans le home CAST — diffusions armées prêtes, ▶ pour confirmer, ✕ pour
  écarter. C'est là que le MJ **voit** ce que le moteur a proposé.
- **Journal** : chaque déclenchement → `logSession` (déjà en place).

## G. Garde-fous & différés

- Chaque JS passe `node --check`. Charte DS : blanc pur, cadres ink 2px, coins carrés, zéro ombre,
  glyphes Unicode (jamais SVG/emoji). Aucun jet de dé, aucune auto-résolution de skill.
- Édits additifs et prudents ; **pas de commit** sans feu vert.
- **Différé v1.1+** : `prop.set` + sources `prop.change` sur props Store (npc/org/location) ;
  ciblage cross-joueur ; conditions composées (`when` multi-source) ; undo de cascade.
- **Limites connues v1 (Phases 2-4)** : (a) anti-boucle réel = **visited-set par règle/cascade** (une
  règle tire au plus 1×/cascade) + `once` ; `MAX_STEPS=64` est un simple backstop loggé, pas le « 8 »
  littéral — le 8 aurait pu couper des chaînes légitimes. (b) La pending-list et les changements de
  clock ne se rafraîchissent que si un `.ca-rail` est monté (GM dans la section CAST) — éditer une clock
  en **plein onglet** hors CAST ne rafraîchit pas la pending-list jusqu'au retour dans CAST. (c) `loot.grant`
  = effet armé **stub** (best-effort `br().grantLoot`, sinon log) tant que le loot v2 n'est pas fixé.
  (d) Reset du `firedAt` = **action manuelle** « reset fired-state » ; l'auto-reset en début de session
  reste à brancher.
- **Pass UI (2026-07-08)** : tout ouvre en **inline master-detail** (rail CAST toujours visible ;
  `openInline` remplace `Shell.openEntity` pour clock/cast/rule/« Open »). CSS scopé `.ca-pane` dans
  `css/app-aside.css` : gouttières supprimées (`.dtf` padding:0 + max-width:none, `.ca-left` flush,
  `.ca-preview` sans marge), cadres de contenu passés en **2px encre / blanc pur / zéro ombre**, bandes
  séparées par des filets encre, et l'éditeur `.ru-*` désormais stylé. `openCastTab`/`openClockTab`
  conservés (inutilisés) comme fallback.

## H. Plan de livraison

1. **Données + migration — ✅ FAIT (Phase 1, 2026-07-08).** Type Store `rule` (`app-store.js` +
   `'rules'` dans `hub/createHub.mjs` DOC_TYPES) ; migration `ev.trigger` → doc `rule`
   (`app-migrate.js`, retrait du champ orphelin `trigger`). Les 3 fichiers passent `node --check`.
   Ciblage per-joueur = **templaté** (`{kind}` + `$trigger`). Heat-clock tagging = convention (pas de
   source legacy) : réalisé quand les règles/UI créent les heat-clocks (Phase 2/4). Retrait du path
   runtime legacy `app.js` **repoussé en Phase 2** (voir §E.2). ⚠️ Nouveau type ⇒ **redémarrage du hub**.
2. **Moteur — ✅ FAIT (Phase 2, 2026-07-08).** `Rules` IIFE dans `app-cast.js` (+ `window.CastRules`).
   Émission `clock.cross`/`full`/`empty` depuis l'inc/dec clock (save immédiate → pas de clobber
   débounce), `cast.played` depuis `play()`. Boucle `when→if→then` (`matches`/`applyRule`/`applyEffect`/
   `step`), résolveur templaté per-joueur (`targetClock`), anti-boucle visited-set + `once` + `MAX_STEPS`.
   Path legacy `app.js` **retiré** (runtime 2377-2381 + éditeur `ev.trigger` + `saveTrig` + var orpheline).
3. **Effets — ✅ FAIT (Phase 3).** Auto : `clock.advance`/`clock.set` (re-émettent → cascade), `log`
   (`logSession`). Armés (pending-list) : `cast.play`→`play`, `reveal.clock`→`playClock`, `loot.grant`
   (stub best-effort).
4. **UI — ✅ FAIT (Phase 4).** Rail : pending-list « ARMED — CONFIRM ▶ », groupes CLOCKS / HEAT-TRACE /
   RULES, `+ new rule`, `↺ reset fired-state`, ▶ fire manuel. Éditeur de règle inline (`renderRuleEditor` :
   WHEN src+sélecteur clock concret/templaté+dir+seuil ; THEN liste d'effets). Clock editor : champ
   Kind (narrative/heat/trace) + Player = tagging heat/trace. **Non commité ; `node --check` OK.**
