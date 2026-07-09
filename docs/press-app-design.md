# Press / Media App — Design (grounded in CP2020 *Live & Direct*, CP3431)

Source of truth for the press/media app + the generalized "rich config" app framework.
Grounded in **R. Talsorian's *Live & Direct: Media in the Cyberpunk Age*** (product CP3431).

## Locked decisions (player-confirmed)
- **Framework** = config-driven ("config riche"): a per-app `caps`/`appConfig` the renderer reads. This press app is the first rich-config app; the 5 chat apps get re-expressed as configs of the same engine later.
- **Press shape** = BOTH a shared platform (channels register, YouTube-like) AND standalone media sites.
- **Traffic/money** = auto-sim + GM nudge (boost/bury).
- **Org** = link a real campaign org (media corp); its name is campaign-variable and modulates the profile.
- **Comments** = canned pools tone-sorted + GM injection via personas.
- **Monetization** = ad (reach × rate) + sponsors.
- **Post types** = video + article (+ braindance premium proposed; music/radio as bonus).
- **Credibility** = first-class stat (build/burn, GM can discredit → crash + backlash).
- **Corpo vs independent** = a real axis (reach/money/safety + censorship/cut/risk ↔ freedom/keep-all + low reach/Netwatch heat).
- **Sourcing** = attach sources (NPCs/contacts + intel from the app's Files/reveal system); better-sourced = more credibility + harder to discredit.
- **⚠ THE APP NEVER ROLLS.** Dice are rolled at the table (Composition under deadline, Interview Results, etc.); the app *receives* results/inputs (quality, credibility deltas, scoop timing) and simulates the consequences.

---

## 1. Canonical mechanics worth modelling
Central thesis (ch3): **media controls reality through credibility, not truth.** Every mechanic serves the tension **REACH/MONETIZATION ↔ CREDIBILITY/ETHICS**.

**1.1 Credibility & Trust (ch3, ch5) — the core meter.** TWO parallel metrics, never merged: **Audience Loyalty/Reach** (size, stickiness) and **Credibility** (0–100, trackable per genre: News/Dance/Film/Music/Black-Ops). Corporate gains size easily but bleeds credibility; underground builds credibility slowly with a volatile audience. Below ~20 credibility the audience stops believing anything. Recovery slow (+5–10/cycle); smears cost −20 to −30 in one cycle; legal wins restore only 5–15%. **Production quality shifts the credibility delta ±20** — a high-production lie beats a low-production truth by ~40. Add a campaign-wide **GENERAL MEDIA-TRUST tank** (a shared gauge; disinformation wars drip it −10; at 0 all channels lose ~50% effectiveness).

**1.2 Ratings / Sweeps (ch5, ch6).** Periodic scoring **cycles** ("sweeps", weekly/monthly). **Sensationalism is mechanically rewarded** — a per-post `sensationalism` 0–10 gives an immediate reach boost vs a credibility cost. Declining sweeps → rising corporate pressure to sensationalize. Sweeps winner gets a next-cycle dominance bonus.

**1.3 Sponsorship & Monetization (ch1, ch5).** Sponsors pay production for **editorial control %, mandated messages, product placement**. Revenue = sponsorship cut + ad(reach × engagement) − production cost. **Sponsor leverage**: a negative story about a sponsor → they threaten to pull ads → player chooses **cave / publish / spin** (the recurring integrity decision). Underground has no sponsors: donations (volatile), barter, bootleg, at net-loss with a sustainability threshold; alt = **ideological sponsors** (NGOs/hacker collectives/resistance) funding conditional on mission-aligned content.

**1.4 Censorship / Seward Act / the "AI rating gate" (ch1, ch2, ch5) — the legal-heat spine.** All mass media is **LICENSED** or **UNDERGROUND**; license renewal needs a minimum audience (else shutdown/arrest/seizure). **legalHeatLevel 0–100** rises from investigative/negative reporting; ladder = cease-and-desist → jamming → raid; arrest risk checked per cycle (table roll, app tracks heat). **Plea-deal**: as heat rises, GM offers "drop topic X → −heat" (trade credibility for safety). The **AI content rating gate** (editors can't override) = the **POWER GATE** (§2): sets reach prominence, amplifies sensationalism, deprioritizes underground (×0.5) but never hard-blocks. **Shadetalk**: enemies hijack your broadcast, overwrite with propaganda → credibility crash (defend with a table tech-check).

**1.5 Scoop / Competition (ch5, ch6).** **Scoop economy**: first-to-air gets a ratings + advertiser bonus, later versions struggle. **Sabotage ladder**: smear → equipment sabotage → talent poach/kidnap → merc raid (blowback if exposed). **Disinformation war**: contested reach+credibility; winner's narrative = "truth" 1–2 cycles; loser retracts −20; each war drips global trust −10. **Smear momentum**: 5–10 attacks over 2–4 cycles; target counters with facts/legal (+10–20% each); succeeds if target < 30.

**1.6 Content richness (ch2, ch3).** Richness ≈ linear with ad spend/reach through the POWER gate. **Message repetition / illusory truth**: same content across 2–5 channels → +5 credibility each, +15 on the 5th (propaganda multiplier). **Subliminal payload**: 0–5 hidden hits/post, +5 influence each (+20 if undetected); **if detected: −50 credibility + retraction** (high risk/reward hidden layer).

---

## 2. Content types → fields, POWER gate, monetization
**Common post fields:** channelId, orgAffiliation, contentType, beat, angle, sources[] (linked Files/intel), productionQuality (low/med/high), sensationalism (0–10), subliminalHits (0–5), sponsorMandatedMessages[], licenseStatus, productionCost, table-roll result inputs.

**POWER GATE** (the AI rating filter): every post gets a reach-prominence multiplier from sensationalism + production + corporate alignment + repetition; underground ×0.5; **GM can boost/bury here** (the nudge verb). *Whoever controls distribution controls reach; content is secondary.*

| Type | Cost | Reach | Loyalty | Piracy | Legal | Extra fields | Money | Engine |
|---|---|---|---|---|---|---|---|---|
| **Screamsheet / Article** | Low | slow long-tail | low churn, archival | low | med | AI keyword rating, syndication, newsstand count, subscription 50–75cr, searchable archive | ads + subs | **credibility** |
| **Video / Broadcast** | Med–High | fastest, widest | medium | high | med–high | broadcast/cable/pirate, channel slot, dramatic-recreation flag | ad-heavy + sponsor slots | **reach** |
| **Braindance** | High (25–500cr) | slower, deepest | **extreme (addiction)** | **highest** | **highest** (snuff/etc illegal) | experience_type, duration 15–60m, hardware-gated, addiction toggle, consent/ethics flag | 3× ad rate, bootleg 25–75cr | **loyalty** |
| **Music** | varies | retail/radio/net/street | fan/viral | high | low–med | label type, royalty split, live>recorded | sales/licensing/live | virality |
| **Radio / Pirate** | cheapest | range-limited, mobile | cultish, authentic | n/a | high (unlicensed) | transmitter count, relay reach, jamming risk | donations | **authenticity** |

Bake in: **BD addiction loop** (+30 auto-return loyalty/dose, max 3; rival PR "sobers up" the audience → −30 cred, 3 cycles). **Dramatic recreation** flag (publish unverified; +15 authenticity if high-production; exposed = mutual −20). **Fabricated story / fake upload**: undetected → +20 reach + 3-cycle narrative control; detected → −40 cred + permanent +15 distrust primer. Fake-upload visual = the book's **"▲ VIDEO SAMPLE ▼"** framed box + timecode + blurred procedural thumb.

---

## 3. Corpo ↔ Independent axis (real media corps)
Model **scores, not one slider**: `corporateApproval` (gates distribution + resources; <0 → +50% production cost), `undergroundReputation`, `sponsorRelationships[]`, `marketShare` (>60% monopoly = +25 to reach/cred but antitrust −10/cycle). The alignment slider *reads out* consequences.

**DMS — Diverse/Danger Media Systems** ("Technotainment", ch3/ch6): aggressor; weaponizes braindance addiction + false narratives to blackmail/destroy rivals (the **Marylou Ellerby smear** — destroyed a #1 anchor despite legal wins). Trashy hit *Boob Tube Bonanza*. → default hostile-sponsor / rival; enables smear+blackmail mechanics.

**Network 54** ("Everywhere", ch3/ch6): #1 news brought down by a coordinated smear *despite* top ratings (subliminals + leaked footage + fake polls made viewers "feel" it was dying). Top show *Looking Glass* (host Bernie Herriman). → prestige mainstream; DMS↔Net54 = ready ratings-war arc.

**WNS — World News Service** ("credibility major", ch6): London public corp; largest stockholder Saudi investor Kabooni Mahmet el Islamid; **DMS + Net 54 both hold non-controlling stakes** → contested asset, **51% hostile-takeover threshold** to track. Full spectrum (WNS International/Global/World Sports/Financial…), print arms (*GI News, America Today, Orbital Observer*, tabloid *Worldwide Eye*), prestige Annual Reports = passive subs. Best internal unity. → aspirational credibility employer; cap-table = strategic sub-game.

**Trade-offs:** corporate end = max reach (POWER gate favors), eroding credibility (+20 with loyalists), sponsor editorial control, stable funding, licensed/protected, can't criticize owner's allies (−approval → resource starvation), talent = bound property. Underground end = −50% reach, slow-build credibility (+50% with core believers), total freedom, donation/net-loss funding, unlicensed (seizure/raid/jamming), free to attack anyone but hunted, freelance talent (WANTED/kidnap risk).

---

## 4. Flavor libraries (paste-ready)
**Bands/tracks:** Chrome Division—*If I Had an Uzi*; Lo End—*Stitch is a Brag*; Skinflower—*Transcontinental Touch*; Gender Division—*Yes, Then Y?*; Bag of Broken Glass—*Lift Me with a Tearin' Bayb*; Wirebrain—*Homicidal and Getting Worse*; Damned Nation—*Money is the Master*; Mokkori Power—*Let's Be Making Sex*; Flashpoint Caracas—*Blood on My Tongue*; Access Denied—*Repression Compression Scheme*; Clinically Sane—*1200 MegaHertz of Heaven*; Una Angel (corp pop).
**News shows / networks:** Net 54, *Looking Glass*, DMS National News, WNS Prime, WNS International/Global/World Sports/Europe/Africa, WFN, World Newsline, *Boob Tube Bonanza*, John Dawson Execution Broadcast. Net 54 fare: Cayman Islands Sports, Netwatch's Most Wanted, The Accident Channel, Firearms with Bod Travis, "Sparky", Trauma Team, War Zone, Malwatch, Arcology Heat, America's Most Violent Home Videos, Skin, Borg, Robot at Law.
**Screamsheets/print:** *The Tab, Dr. Paradox's Mysteries, Rockerboy Magazine, GI News, America Today, Orbital Observer, Worldwide Eye*. Headlines: "NetNet Stock Crash", "D-Dance Cures Cancer", "The Death of Print and the Birth of the Screamsheet".
**Comment fodder by sentiment:** cynical ("The advertising model is the power gate — content is secondary." / "A well-produced lie beats a poorly-produced truth by forty points."); paranoid ("Once they repeat it five times, it's true whether it happened or not." / "Next time you jack into braindance, your mind might be the target."); addicted ("Excuse me, your brain is in my head." / "1200 megahertz of heaven."); adoring (celebrity-face praise); suspicious-of-smear ("She won her case and lost her career — the public preferred the false story."); outrage ("Power to the People — vote on the execution!").
**Persona archetypes (channel roles):** Crusader (+cred, −revenue), Star (celebrity traffic, can't go undercover), Investigative Reporter (uncovers secrets, +legal heat), Freelancer, Paparazzo, Ambulance Chaser, Spin Doctor/Propagandist (monetizes corp buys, alienates grassroots), Techie/"The Eye", Solo/"The Muscle", Corporate Editor/Producer, Netrunner/"The Researcher" (Files/intel dives). Ready NPCs: **Moxie** (Star, *Dr. Paradox's Mysteries*), **Cameron Ride** (Rockerboy reporter), **Dr. Paradox** (war correspondent).
**Corps:** DMS, Net 54, WNS, NBC, NorCal Gov Broadcasting, Arasaka (BD producer), Dupree Chemicals, Burp Cola (subliminal incident), NetNews.
**Tech:** screamsheet AI, braindance player (home/portable/arcade), subliminals, shadetalk (broadcast hijack), dramatic-recreation, pirate transmitters, TV News Van (Armor 6, targeting radar), TV News Chopper (16× telescope, sat uplink).

---

## 5. New gameplay (surprising but faithful) — ranked
1. **Subliminal payload** hidden layer (0–5 hits; +influence; detected = −50 cred). Tiny footprint, very cyberpunk.
2. **Spectacle Event economy** (John Dawson live-execution style): GM stages a mega-event, 50M+ reach, fake "voting", exposed rig = ×5 cred loss.
3. **Braindance addiction loop** (Faustian loyalty engine).
4. **Global media-trust tank** (shared ecosystem gauge; disinformation poisons the well).
5. **Message-repetition / illusory-truth combo** across channels.
6. **Shadetalk hijack** live mini-game (defend with security budget/table tech-check).
7. **WNS cap-table / hostile-takeover** sub-game + shareholder votes.
8. **Scoop race between player channels** (emergent PvP).
9. **Dramatic-recreation gambit** (cheap content with a landmine).
10. **Plea-deal / heat-for-silence** (recurring moral choice).
11. **Ideological (non-profit) sponsors** (keeps the indie path playable).
12. **Journalist-safety roll on sensitive stories** (dead journalist kills the story, grants 1-cycle sympathy spin).

---

## 6. Prioritized build order (folds into the phased plan)
- **P0 — core loop & config framework:** channel entity (org affiliation, alignment, licenseStatus, credibility, reach); post entity + common fields (beat/angle/sources→Files, type, productionQuality, sensationalism, cost); **content-type config records** (the reusable rich-config core); **POWER GATE** + GM boost/bury; **cycle/sweeps tick** (ingest table results → reach + credibility + traffic + sentiment-tagged comment pool); **two-meter readout** (loyalty vs credibility).
- **P1 — monetization & sponsorship:** revenue formula; sponsorRelationships (control %, mandated messages) + **sponsor-pressure decision** (cave/publish/spin); underground funding + sustainability; global media-trust tank.
- **P2 — legal-heat spine:** legalHeatLevel, escalation ladder, license-renewal timer; plea-deal; explicit sensationalism↔credibility per post.
- **P3 — competition & sabotage:** scoop race, smear-campaign momentum, disinformation war, sabotage ladder, talent pool + journalist-safety.
- **P4 — rich set-pieces (park until core proven):** subliminal payload, BD addiction loop, spectacle event, shadetalk hijack, WNS cap-table, message-repetition combo, dramatic-recreation gambit. *(These are the stress-test that proves the config framework is general enough for the chat-app port.)*

**Guiding cut rule:** the app never rolls → anything "roll at table, app records the consequence" (heat, smear counters, scoop timing, credibility deltas) is cheap and P0–P2; anything needing rich per-post hidden state or bespoke UI (subliminals, spectacle, cap-table) is P4.

**Load-bearing tension to preserve everywhere:** *reach/monetization pulls one way, credibility/ethics the other; production quality + repetition let a lie out-compete the truth; the underground trades reach for authenticity at personal risk.*
