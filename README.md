# Rache Bartmoss Datafort
Rache Bartmoss Datafort is a web-based companion app for Cyberpunk 2020, the Roleplaying Game of the Dark Future.

It is divided in two tools with different scopes :
1. The *website* features a set of autonomous tools with limited interconnection that allow anyone to build data elements for Cyberpunk 2020 play. Mainly, it can be used to generate a full character sheet, NPC sheets, Night City locations, outfits, etc. You can also find reference under Data.
2. The *app* is two things at once :
	- A link between GM and player devices that allows for sync and data sharing on the same Wi-Fi network.
	- A set of tools built on, or utilizing, this link. It live-syncs character sheets, map informations and more between GM and players. Full features are listed below.

## App tools :
1. Party :
	- Character Sheets are synced live between GM and players
	- Character Sheets feature many systems on top of the basic ones, such as
		- Banking, investment, financial products, loans
		- Shopping, debit, credit
		- NET Identity
		- Complex inventory management
		- Wardrobe for quick outfit switching
		- Contacts, jobs
		- Custom fields
		- GM designed onboarding guide for players
	- The GM can add blank sheets to the campaign on the fly, or import sheets/templates (with their onboarding) when creating it.
2. Cast
	- GMs can send custom designed arrangements of pictures and text to the player’s screen.
	- NPCs, organisations, locations and Database entries can be cast quick.
3. Map
	- GMs can import custom maps and share curated locations to players. Those locations can be linked to shops
	- The player can keep a log of the locations they visit on the map, importing pictures and writing down notes.
4. Generators
	- GMs can generate/design and share combattants, NPCs, organizations, squads, clocks and shops.
		- NPCs and organizations have in depth complete tools for building them, allowing for instance for full hierarchical flow charts in organizations
		- Shops are a very useful tool as well : the GM can curate objets, set prices, link them to a fixer, location or organisation and share the shop with its players.
5. Combat
	- A full combat tool synced with the player sheets, the NPC and Squad systems.
	- Features GM or player agency.
6. Database
	- GMs and players can consult datasets of all vehicles, weapons, cyberware, programs, corporations and gear feature in the sourcebooks, plus (if made public) the entries, organisations, and NPCs designed by the GM.

That’s it for the tools for now.

## Installation

On any OS :
1. Install the last executable from Releases (macOS `.dmg`, Windows `.exe`, Linux `.AppImage`).
2. Launch it.
	- On first launch, you will get a security warning, because the app is not code-signed yet. macOS → System Settings → Privacy & Security → **Open anyway**. Windows → **More info** → **Run anyway**. Linux → make the AppImage executable (`chmod +x`) and run it.
	- The first time it serves the game, your OS firewall may ask to allow incoming connections — **allow it**, otherwise players can't connect.
3. Start a game.
	1. **If you are the GM** : press **Game Master** and create a campaign (optionally importing sheets/templates). Open it, then press **Go live** to host it. Use **Share** to copy the player link.
	2. **If you are a player** : nothing to install. On the **same Wi-Fi** as the GM, open the link they shared (or press **Player** and paste the GM's address + your sheet). Your sheet syncs both ways from then on.

Everything runs locally on the GM's machine over the LAN — no accounts, no cloud, no fees. Campaign data is stored as plain JSON files in a visible campaign folder on the GM's computer.

## Website (no install)

The same toolkit is published as a static site and works on its own — useful for solo prep or building sheets offline, without a GM hub. The app simply layers live sync and GM/player tools on top of it.

## Development

Vanilla HTML/CSS/JS — the website needs no build step. The desktop app is Electron wrapping a small in-process hub (Node) that serves the site over the LAN and relays the Yjs CRDT sync.

```bash
# Serve the website locally
python3 -m http.server 8000        # then open http://localhost:8000

# Sync layer (TypeScript → js/sync.bundle.js)
npm run build:sync                 # or: npm run dev:sync (watch)
npm run typecheck

# CLI hub (serve the toolkit on the LAN without the desktop shell)
npm run hub

# Desktop app
cd desktop
npm start                          # build the hub bundle + launch Electron
npm run dist                       # build distributables (electron-builder)
```

Releases are built and published automatically by GitHub Actions (`.github/workflows/release.yml`) on a `v*` tag, across macOS, Windows and Linux.

## Credits & legal

Built for friends, on the scraps fans gathered before me. For a serious, complete Cyberpunk 2020 webtool, see [Cybersmily](https://cybersmily.net).

Unofficial content under R. Talsorian Games' Homebrew Content Policy. It is not approved or endorsed by RTG, and references materials owned by RTG and its licensees.
