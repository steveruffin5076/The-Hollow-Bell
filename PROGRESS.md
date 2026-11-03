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
- The kill ending. Unit tests cover the exclusive outcome, the sword reward, and a reload of that save.
- A hit that interrupts a heal. The Phase 3 unit test still covers it.
- Firefox and Safari.
- Fighting at 1920×1080 or a narrow window. The production canvas did resize to those sizes without a page error. The playthrough itself was at 1280×720.
- New Game's erase confirmation was not clicked. Cancel and confirm are on the title screen when a save exists.

**Known issues:**
- Art is flat shapes. The road enemies reset on each visit, which is intended practice, and the screen can get crowded if you fight on top of the entrance.
- The ending shows again after a reload until you choose Keep walking. It no longer shows on every door.
- The road rest stone is 256 units from the wraith, and the wraith chases at 240. Walking up to rest usually starts a fight. Standing on the exact centre of the stone does not.

## Doorway fix (3 Nov 2026)

**Problem:** Every entrance to the watchtower road used the west checkpoint, `approach-road`. Leaving the tower therefore placed the player at the "F: return to town" door.

**Change:** Each door now names its own arrival checkpoint. The tower exit arrives at `approach-tower`, two tiles west of the watchtower door. Coming from town still uses the west door. A reload before the next rest uses that same arrival.

**Checks:** `npm run typecheck` passed. `src/persistence/phase7.test.ts` passed, including "returns from the watchtower beside that door, not the town door". The full suite was not re-run after this change.

**User check:** confirmed fixed.

**Next:** your play of the remaining rest-stone issue, then acceptance of the prototype. Nothing past Phase 9 is authorised.
