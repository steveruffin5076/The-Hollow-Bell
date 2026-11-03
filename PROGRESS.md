# Progress log

| Phase | Status |
| --- | --- |
| 0 - Foundation | Approved |
| 1 - Isometric movement sandbox | Approved |
| 2 - Core melee combat laboratory | Approved (user approved moving on) |
| 3 - Echo, healing and checkpoint rules | Awaiting user testing |
| 4 - Loot, equipment, level-up | Awaiting user testing |
| 5 - Town, dialogue, quest | Awaiting user testing |
| 6 - Dungeon, boss, both outcomes | Awaiting user testing |
| 7 - Local save | Awaiting user testing |
| 8 - Presentation and settings | Awaiting user testing |
| 9 - Playtest handoff | Awaiting user testing |

## Phase 0 (approved)

Vite + TypeScript (strict) + Phaser 4.2.1 + Vitest setup, boot screen, README, `ASSETS.md`, `ARCHITECTURE.md`.

## Phase 1 (approved)

Isometric room, projection helpers, hero movement and collision, depth sorting with fading occluders, pause on focus loss, F3 debug overlay.

## Phase 2

**Changes:**
- New pure rules in `src/combat/`: `hit.ts` (one hit resolver, swing geometry), `player.ts` (idle/move/attack/dodge/hurt/dead), `enemy.ts` (idle/chase/telegraph/attack/recover/dead). Tuning in `src/data/combatConfig.ts`.
- New `CombatScene`: isolated room, one hero, one melee enemy, health bars, hit flash, hit-stop, reach wedge, danger wedge with `!` marker, death and restart with R.
- Fixed 1/60 s simulation step with an accumulator.
- `input.ts` now has edge-triggered attack (left click) and dodge (Space).
- Shared room drawing moved to `RoomView`. `SandboxScene` now uses it. `sandboxRoom.ts` was replaced by `rooms.ts`.
- Title screen has two buttons: "Start (combat lab)" and "Movement sandbox".
- `ARCHITECTURE.md` documents the rules and numbers.

**Automated checks run:**
- `npm run typecheck`: passed.
- `npm test`: 3 files, 55 tests passed (34 new combat tests: swing geometry, hit dedup, two-hit chain with no third swing, spam limit, lockout, aim lock, dodge invulnerability window, dodge cooldown, hurt cancelling a swing, death disabling actions, enemy cycle and single hit per swing, same results at 1/30, 1/60 and 1/120 s steps).
- `npm run build`: passed.
- Browser smoke test (Playwright, Chromium, dev server): the combat lab opened and the enemy telegraphed and hit the player; the health bars, wedge and `!` marker were visible. Pressing R three times, clicking 40 times quickly and pressing Space produced no console errors. The movement sandbox still renders and moves after the refactor. Fading occluders still work in the combat room.

**Not run / limitations:**
- No manual play-through of the six user tests. Feel and balance are untested by a person.
- Browser automation looked unreliable after a page reload in the original Phase 2 smoke tests. Later Phase 3 work showed this was a test-method artefact (Playwright `press` is too brief for Phaser `JustDown`, and screenshots taken in parallel with clicks captured a stale frame). A held key (~100 ms) and sequential capture work. There is no confirmed game bug.
- Blur and resume during a fight was not exercised in a browser.
- The enemy is not staggered by hits and there is no knockback.

**Known issues:** none confirmed.

**Manual checklist status (user to complete):**
1. Attacks hit only inside the white wedge: not yet tested
2. Spam and hold limits: not yet tested
3. Dodge safe window and late dodge: not yet tested
4. Telegraph readability: not yet tested
5. Die and restart three times: not yet tested
6. Blur and resume during a fight: not yet tested
7. F5 reload then Start: not yet tested

**Notes:**
- If port 5173 is already in use, Vite picks the next free port (for example 5174). Use the address printed in the terminal.
- Phase 3 was started after user approval.

## Phase 3

**Changes:**
- New pure rules: `echo.ts` (meter + delayed strike), `checkpoint.ts` (rest / respawn / reset rules), `outcome.ts` (hit → Echo + kill reward), `progression/rewards.ts` (once-per-id ledger and pickup).
- Player states `cast` and `heal`. Echo gained only from successful basic hits. Heal spends a charge only on completion. `restoreFull` clears Echo, swings and charges.
- Enemy `reset()` returns it to spawn, alive, idle. Swings now carry a `source` (`basic` | `echo` | `enemy`).
- Combat room has a bell stone (`F` to rest) and one Ash Token pickup. HUD: Echo bar, heal pips, token count, rest prompt, death overlay.
- `R` respawns only when dead. `N` starts a new run. Title `Enter` starts the combat lab.
- `ARCHITECTURE.md` records Echo, heal, checkpoint and reward rules. `README.md` lists the new keys.

**Automated checks run:**
- `npm run typecheck`: passed.
- `npm test`: 4 files, 97 tests passed (42 new Phase 3 tests: meter clamp, miss vs hit gain, Echo-hit gives no Echo, empty meter cannot fire, full meter fires once and empties, delayed hit timing, cancel on death/rest/respawn, heal limits and interrupt, rest vs respawn vs new run, no duplicate persistent rewards).
- `npm run build`: passed.
- Browser smoke (Playwright, Chromium, local Vite on 5190 then 5191). Later checklist pass (3 Nov 2026): miss swing Echo stayed 0; hits raised Echo 40 then 80 then READY; empty `E` did nothing; full meter fired once and emptied, second `E` did nothing; heal at 85 HP restored 100 and spent one charge, `Q` at full HP did nothing; floor pickup granted token 2 and disappeared; rest reset the enemy to 40/40, restored charges, kept 2 tokens, pickup stayed gone; second kill did not add a token; `R` returned to the committed stone; `N` during a pending Echo Strike started a clean run (enemy 40/40, no leftover slash). No console errors.

**Not run / limitations:**
- A hit interrupting an in-progress heal was not captured in the browser (heal finished before the next enemy hit, or the player died first). Covered by the unit test "a hit interrupts the heal and costs no charge".
- Dying during a pending Echo Strike (not `N`) was not captured in the browser. Covered by unit tests for cancel on death/respawn.
- Feel and numbers (Echo delay, heal duration, 40 Echo per hit) are still for a person to judge.

**Known issues:** none confirmed.

**Manual checklist (user to complete):**
1. Missed swings give no Echo; hits do.
2. An empty meter cannot activate; a full meter fires once and empties.
3. Die or restart before the delayed Echo lands; no ghost damage next run.
4. Healing respects health and charge limits (no overheal, no use at full health, a hit during a heal costs no charge).
5. Rest resets normal enemies but does not duplicate collected rewards (kill reward and floor pickup stay collected).
6. Extra: `R` when dead respawns at the last rest; `N` starts a new run and clears rewards.

## Phases 4–9

The user asked for every remaining phase in one pass, then a playthrough. These phases are implemented. They are not marked approved.

**Changes:**
- Authored swords and charms, one level-up, and XP only on the first defeat of each unique enemy.
- Hollow Town (Bram, Mara, Oren), the watchtower road (melee enemy, archer, Aldren clue, Ash Ward), and the Kneeling Watchman.
- Kill grants Aldren's Blade. Spare, after the clue, grants Watchman's Vow and puts Aldren in the square. The quest can be finished either way.
- Versioned local save, separate settings, generated tones, help screen, mute, shake, and reduced flashes.
- README, architecture notes, and asset notes updated for the prototype handoff.

**Automated checks run (3 Nov 2026):**
- `npm run typecheck`: passed.
- `npm test`: 8 files, 128 tests passed.
- `npm run build`: passed (`dist/assets/index-DKN2ifus.js`).

**Browser play (Chromium, dev server, 1280×720), then a production-build smoke:**
- New game, talk to Bram, Mara, and Oren. Accepting the quest set it active. No console errors.
- The road clue opened the Aldren panel and set the quest to clue found. Ash Ward was collected once.
- Both road enemies died. XP reached 40. The damage level-up applied once (health stayed 100). Ash Ward equipped.
- Dying to the Watchman and pressing R restored 100 HP and a full boss. The choice opened under 70 HP. Speaking the name spared him, equipped Watchman's Vow, and kept Aldren's Blade absent.
- Returning to Bram completed the quest. The ending text matched the spare. Aldren could be talked to in the square. Echo's recognition line was marked delivered.
- Reload Continue restored outcome spare, the charm, level, XP, and the clue.
- Help saved mute on, shake off, and reduced flashes on.
- One later doorway from the road back to town worked after the rest stone was moved off the exit. An earlier five-trip loop was blocked because the ending reopened on every doorway and the rest stone covered the exit. Both of those are fixed. Ten uninterrupted loops were not repeated after the fix.

**Not played in the browser:**
- The kill ending. Played in the browser on 3 Nov 2026 (see below).
- A hit that interrupts a heal. The Phase 3 unit test still covers it.
- Firefox and Safari.
- Fighting at 1920×1080 or a narrow window. The production canvas did resize to those sizes without a page error. The playthrough itself was at 1280×720.
- New Game's erase confirmation was not clicked. Cancel and confirm are on the title screen when a save exists.

**Known issues:**
- Art is flat shapes. The road enemies reset on each visit, which is intended practice, and the screen can get crowded if you fight on top of the entrance.
- The ending shows again after a reload until you choose Keep walking. It no longer shows on every door.
- The road rest stone was 256 units from the wraith, and the wraith chases at 240. Fixed on 3 Nov 2026 (see below).

## Doorway fix (3 Nov 2026)

**Problem:** Every entrance to the watchtower road used the west checkpoint, `approach-road`. Leaving the tower therefore placed the player at the "F: return to town" door.

**Change:** Each door now names its own arrival checkpoint. The tower exit arrives at `approach-tower`, two tiles west of the watchtower door. Coming from town still uses the west door. A reload before the next rest uses that same arrival.

**Checks:** `npm run typecheck` passed. `src/persistence/phase7.test.ts` passed, including "returns from the watchtower beside that door, not the town door". The full suite was not re-run after this change.

**User check:** confirmed fixed.

## Watchman revive and road rest stone fixes (3 Nov 2026)

**Bug 1 – Resting in the watchtower revived the Watchman.** After you spared or killed him, a rest in the same visit reset him to 140/140 HP and idle, and he fought again. Beating him a second time showed a false reward message. Fix: a spared or dead boss is settled, and `Boss.reset()` now leaves him as he is (`src/combat/boss.ts`). A reset before the outcome still fully restores him and offers the choice again.

**Bug 2 – The road rest stone woke the wraith.** The stone moved from tile (4, 10) to (2, 10). From the nearest point you can rest from, the wraith is now 272 units away (aggro 240) and the archer is 398 (aggro 280). The stone is still clear of the town door. The arrival and respawn point stays at (4, 7).

**Checks:**
- `npm run typecheck`: passed.
- `npm test`: 8 files, 131 tests passed. New tests: "a rest does not bring back a spared or defeated Watchman" and "road rest stone can be used from any side without waking the wraith or the archer".
- Browser (Chromium, dev server, 1280×720): I loaded a road save and walked to the stone. "F: rest" appeared, the rest worked, and the wraith stayed idle at its spawn point. There were no console errors. The watchtower revive fix was checked only by unit test, not in the browser.

**Note:** In the tower, the Watchman's aggro range (340) covers the door stone, which is intended for the arena.

## No resting during a fight (3 Nov 2026)

**Change:** In the adventure, a rest is refused while any enemy is chasing, telegraphing, attacking, recovering, or while the Watchman waits for the choice. Near the stone, the prompt reads "Cannot rest during a fight", and F shows "You cannot rest while an enemy is hunting you." Nothing is restored or reset on a refused rest. The rule is in `src/combat/checkpoint.ts` (`anyEngaged`, `canRest(..., engaged)`). The Phase 3 combat lab is not changed and still allows a rest at any time.

**Effect on play:** Enemies do not give up the chase. To rest, you win the fight, leave through a door, or fall. In the tower, the Watchman wakes as soon as you arrive, so you cannot rest there until he is spared or defeated. The tower door is still your respawn point.

**Checks:**
- `npm run typecheck`: passed.
- `npm test`: 8 files, 133 tests passed. New tests cover a refused rest while an enemy chases (health, charges, and enemy state unchanged) and which states count as engaged.
- Browser (Chromium, dev server, 1280×720): I woke the wraith and walked back to the road stone. The prompt read "Cannot rest during a fight", and HP and heals did not change. After the wraith was killed (XP 20), the prompt read "F: rest", the rest worked, and the wraith reset at its spawn point. There were no console errors. The refusal message text was not captured in a screenshot.

## New game save fix (3 Nov 2026)

**Problem:** "Erase and begin" (ending panel) and "Erase" (title screen) removed the save and then wrote a fresh empty save at once. After that, the title showed Continue for a game with no progress. The backup of a broken save (`hollow-bell-save-backup`) was never removed, although the README said it would be. Both scenes repeated the save key as a literal string.

**Change:** Both paths now call one function, `beginNewGame()` (`src/game/session.ts`). It clears the save and the backup through `clearSave()`, keeps settings, and writes nothing. The first save is the first doorway, rest, pickup or choice, as before. If storage is blocked, the "will not be saved" warning still shows.

**Checks:**
- `npm run typecheck`: passed. `npm run build`: passed.
- `npm test`: 8 files, 135 tests passed. New tests cover erasing the slot and backup while keeping settings with no write until a save point, and a new game with no storage.
- Browser (Chromium, dev server, 1280×720): I seeded a save and a backup, then clicked New game and Erase on the title. Town opened with XP 0, and both keys were gone. After a reload, the title showed only New game. There were no console errors. The ending panel's "New game" path uses the same function but was not clicked in the browser.

## Kill ending browser play (3 Nov 2026)

**Method:** Chromium, dev server, 1280×720. A scripted player used real keyboard and mouse input. A test-only entry point (served by the test, not in the repo) let it read game state to steer and to check results. It started from a seeded save in the watchtower: clue known, level-up damage, Ash Ward equipped, 40 XP.

**Results (all passed, no console errors):**
- During the fight, the first Echo Strike showed "Where did you get his sword?".
- At 70 HP, the choice panel opened. "2. Keep fighting" showed "The Watchman raises his blade again." and the fight went on.
- The kill showed "Aldren's Blade is yours. Press I to see it." Outcome became kill, status guardian-resolved, XP went from 40 to 60, and Aldren's Blade was owned and equipped. There was no Watchman's Vow. The player did not die.
- A rest at the tower stone after the kill left the Watchman dead (confirms the revive fix in the browser).
- The tower exit led to the road beside the tower door. The road door led to town.
- Bram: "You brought his sword, not the charm. Then he is gone. I will remember the blade." "1. Then this is finished." completed the quest and opened the kill ending: "The tower is quiet. Bram hangs the blade by the forge and says the name where the bell cannot reach." Aldren was not in the square (only Bram, Mara, Oren).
- After a reload and Continue: town, outcome kill, status complete, Aldren's Blade equipped, XP 60. The ending showed again (known behaviour). The journal read "Outcome: the Watchman fell. Aldren's Blade is yours." The equipment panel listed Aldren's Blade (worn), Ash Ward (worn), Grave Iron (bag).

**New issue found (fixed below):** Messages shown in the same frame replace each other, so only the last one is seen. On the kill, "Experience +20" is replaced at once by "Aldren's Blade is yours" (XP did rise to 60). If Echo was never used, the fallback line "Where did you get his sword?" replaces the blade message on a kill. On a spare, the spare message replaces the fallback line. Cause: `say()` in `src/scenes/PlayScene.ts` keeps one message.

## Message queue fix (3 Nov 2026)

**Change:** On-screen messages now go through a queue (`src/core/messages.ts`) in both the adventure and the combat lab. Messages raised together show one after another, in order. A lone message shows for 2.6 s (2.2 s in the lab). When another is waiting, the current one moves on after 1.4 s (1.2 s in the lab). A repeat of the message showing or of the last one waiting is dropped. At most 3 wait, and the oldest waiting one is dropped first. Messages raised during a modal or a paused tab are not skipped.

**Checks:**
- `npm run typecheck`: passed. `npm run build`: passed.
- `npm test`: 9 files, 141 tests passed. Six new queue tests: order, full time, repeats, limit, long pause, clear.
- Browser (Chromium, dev server, 1280×720, same scripted player as the kill run, no console errors):
  - Kill: "Echo Strike", "Where did you get his sword?", "The Watchman raises his blade again.", "Echo Strike", "Experience +20", "Aldren's Blade is yours. Press I to see it." all showed. Before the fix, "Experience +20" and the first "Echo Strike" were never seen.
  - Spare with Echo never used: "Where did you get his sword?" then "You spoke his name. He keeps the charm. The Watchman's Vow is yours." both showed. Before the fix, the first was replaced at once.
- The combat lab was not played in the browser after this change.

**Next:** your check of the five fixes, then acceptance of the prototype. Nothing past Phase 9 is authorised.
