# Sync architecture (local-first, LAN, GM hub)

A small, layered design. Each layer has one job.

```
 Player machine (browser)            GM machine
 ┌───────────────────────┐          ┌───────────────────────────────────┐
 │ cs.html?campaign&sheet │  ws://   │ hub/server.mjs (Node)             │
 │  └ js/cs-join.js  ─────┼────────► │  • serves the app over the LAN    │
 │     binds ONE sheet    │          │  • relays Yjs (rooms = campaign)  │
 └───────────────────────┘          │  • campaign-data/sheets/<id>.json │
 ┌───────────────────────┐  ws://   │    (one raw sheet file each)      │
 │ gm.html (dashboard) ───┼────────► │                                   │
 │  └ js/gm.js  roster    │          └───────────────────────────────────┘
 └───────────────────────┘
```

## Concepts

- **Campaign** = one shared Yjs document, identified by a *code* (the room).
  It contains only the campaign's sheets, in a `Y.Map` keyed by **sheet id**.
  Because the key is the id, a sheet appears **exactly once** for everyone.
- **Sheet id** = the **filename** on the GM's disk (`Player_1.json` → `Player_1`).
  Human-readable, stable, round-trips to disk.
- **Hub** (`hub/server.mjs`) = the GM's local Node process. It (1) serves the
  static app on the LAN, (2) relays Yjs between clients using the *same*
  `yjs@13` + `y-protocols` as the browser bundle, and (3) loads/saves each
  sheet as a raw JSON file in `campaign-data/sheets/`.
- **`Campaign` handle** (`src/sync/Campaign.ts`) = the browser-side object you
  get from `BartmossSync.join({url, room, member})`. It owns one dedicated doc
  + WebSocket provider and exposes: `onSheetsChange`, `allSheets`, `getSheet`,
  `publishSheet`, `createSheet`, presence (`onPresence`), `onSynced`/`onStatus`.

## Two modes of cs.html

1. **Local mode** (no `?campaign`): the normal offline tool. localStorage tabs.
   *No sync, no campaign writes* — deliberately isolated.
2. **Joined mode** (`?campaign=<code>&sheet=<id>`, via `js/cs-join.js`):
   joins the campaign, binds that one sheet two-way. Local edits publish
   (debounced); remote edits apply back (skipped while you're typing).

> The earlier "appears twice" bug came from mixing these: `_csPersist()` used to
> mirror *all local tabs* into the shared doc. That mirror is removed — local
> tabs never touch a campaign now.

## Conflict model (today)

Whole-sheet **last-writer-wins** (by `updatedAt`). Fine when each player edits
their own sheet and the GM occasionally tweaks. Field-level CRDT (so GM + player
can edit the same sheet simultaneously without clobbering) is planned with the
**combat** phase.

## Build / run

- `npm run build:sync` → rebuilds `js/sync.bundle.js` from `src/sync/` (TS).
- `npm run hub` → starts the GM hub; prints the dashboard URL + one player link
  per sheet (LAN IP). `--campaign <code>`, `--data <dir>`, `--port`.
- Players open their printed link from any machine on the same Wi-Fi.

## Roadmap

- **Now**: GM dashboard (roster, one card per sheet, "Edit (live)" + copy link).
- **Next**: in-dashboard tabbed editor (GM edits every sheet from one screen).
- **Then**: teams — group sheets, let players view teammates' sheets live.
- **Then**: package the hub as a desktop app (something to ship); combat system.
