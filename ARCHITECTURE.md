# Architecture notes

## Stack

Phaser 4 (engine), TypeScript strict, Vite, Vitest, npm.

## Layout

- `src/main.ts`: entry point, calls `startGame("game")`.
- `src/game/`: config constants and Phaser game creation.
- `src/scenes/`: `BootScene` (title, version, two buttons), `SandboxScene` (Phase 1), `CombatScene` (Phase 2), `RoomView` (shared room drawing and fading), `gfx.ts`.
- `src/core/`: projection, movement, collision, occlusion, clock, input.
- `src/combat/`: `hit.ts`, `player.ts`, `enemy.ts` (pure rules).
- `src/data/`: `rooms.ts` (room definitions), `combatConfig.ts` (tuning).

Planned folders (`core/`, `combat/`, `entities/`, `data/`, `progression/`, `narrative/`, `persistence/`, `ui/`) are added only in the phase that needs them.

## Phase 1: projection, sizes and rules

- World space is the flat ground plane and the only gameplay coordinate system. Screen space is for rendering, aiming and picking.
- Projection (`src/core/projection.ts`): `screen.x = world.x - world.y`, `screen.y = (world.x + world.y) / 2`. The inverse is `world.x = screen.y + screen.x / 2`, `world.y = screen.y - screen.x / 2`.
- Tile size: 32x32 world units, drawn as a 64x32 diamond (2:1). Room is 20x14 tiles. Walls are 64 high, props 36-80 high.
- Hero placeholder: 16x34 body, ground anchor at the feet, collision circle radius 8. Speed 150 world units per second.
- Render scale: camera zoom 1 on the 960x540 logical canvas, scaled to the window with nearest-neighbour. The camera centres on the hero each frame.
- WASD is screen-relative (W = up the screen). The direction is converted to world space and normalized there, so all 8 directions have the same world speed. On screen, vertical moves look slower than horizontal ones because of the 2:1 projection.
- Collision: circle versus axis-aligned rectangles, moved in sub-steps of at most half the radius, then pushed out so the hero slides along solids.
- Depth: draw depth = ground contact `(x + y) / 2`. Boxes use their front-most ground corner. A box fades to 30% alpha when it is in front of the hero and its screen bounds overlap the hero.
- Time: each frame delta is clamped to 50 ms (`src/core/clock.ts`). On blur or hidden the scene pauses and keys are released. On focus the scene resumes with keys cleared.
- Input: `InputActions` interface in `src/core/input.ts` (keyboard and pointer implementation only).
- Debug overlay: F3 shows FPS, coordinates, pointer, depth, collision rectangles (red) and the hero circle (blue).

## Phase 2: combat rules

Pure rules live in `src/combat/` and know nothing about Phaser. Tunable numbers are in `src/data/combatConfig.ts`.

- **Fixed step.** Combat advances in steps of exactly 1/60 s (at most 4 per frame, no burst catch-up). Rendering reads the result. Hit-stop pauses the simulation but uses real time.
- **One hit resolver** (`hit.ts`, `resolveHit`). A `Swing` has an id, origin, locked aim, range, arc and a set of targets it has already resolved against. A swing affects each target at most once. If the target is invulnerable, the swing is spent on that target and cannot hit later in the same swing.
- **Reach.** A swing covers a point if the point is within `range` of the origin (centre to centre) and inside the arc. The wedge drawn on the floor uses the same numbers.
- **Player states:** idle, move, attack, dodge, hurt, dead. Transitions are listed in the comment at the top of `player.ts`.
- **Attack:** left click starts swing 1 (windup, active, recovery). One click during swing 1 queues swing 2. Clicks during swing 2 do nothing. A short lockout (0.12 s after one swing, 0.25 s after two) blocks new sequences. Holding the button does not repeat. The attacker cannot move during a swing. Aim is locked when the swing starts.
- **Dodge:** Space. Lasts 0.28 s. Invulnerable from 0.03 s to 0.18 s after the start. Cooldown 0.6 s from the start. Cannot start during an attack, hurt or dodge. Direction is the move direction, or the aim if you are standing still.
- **Hurt:** 0.3 s stun, then 0.6 s of invulnerability from the hit, which stops stun-lock. A hit cancels the current swing.
- **Enemy states:** idle, chase, telegraph, attack, recover, dead. The aim locks when the telegraph starts. Telegraph 0.7 s, active 0.12 s, recover 0.8 s. The enemy is not staggered by hits.
- **Death:** a dead actor takes no hits, has no swing and does not move. R restarts the scene; per-run state is reset in `create()`.
- **Feedback:** hit flash, 0.05 s hit-stop (0.09 s on a kill), a red danger wedge that fills during the telegraph and a `!` above the enemy, and a white wedge while the swing can hit.
- **Input:** left click and Space are edge-triggered (one event per press) and queued until the next step. Blur clears queued presses.
- **UI approach:** Phaser text and Graphics, fixed to the camera. No DOM UI, so clicks cannot leak into combat.

## Phase 3: Echo, healing and checkpoint rules

Pure rules: `echo.ts`, `checkpoint.ts`, `outcome.ts`, `progression/rewards.ts`, plus additions to `player.ts` and `enemy.ts`. Numbers are in `combatConfig.ts` (`ECHO`, `HEAL`) and `rooms.ts`.

**Echo meter** (0 to 100, clamped)
- Gained only when a basic swing hits (`applied` or `killed`): +40 per hit. Misses, `already-hit`, `invulnerable`, Echo hits and enemy hits give nothing.
- Press `E` with a full meter: the meter is spent once and exactly one Echo Strike is created. Not allowed with a partial meter, while one is in flight, or outside idle/move.
- Echo Strike: a spectral slash placed 36 units ahead along the aim locked at activation. It is harmless for 0.7 s (a cyan wedge and a ghost figure show where it will land), can hit for 0.12 s, then ends. It deals 35 damage and hits a target at most once. The player is rooted for 0.25 s while casting.
- It runs on simulation time, with no Phaser timers. It is cancelled if the player dies, rests or respawns. Being hurt does not cancel it. A dead target is never hit.

**Healing**
- Press `Q`. Needs a charge and health below maximum. Starts at 3 charges.
- The player is rooted for 0.7 s. At the end, one charge is spent and 40 health is restored, capped at maximum (no overheal).
- A hit interrupts the heal and costs no charge.

**Reset rules**

| Event | Player | Enemies | Rewards | Anchor |
| --- | --- | --- | --- | --- |
| Rest (`F`, within 48 units of the bell stone, player idle or moving) | Full health, full charges, Echo empty, no pending swing or Echo Strike. Not moved. | Back at spawn, alive, full health, idle | Kept | Committed to the bell stone |
| Death, then `R` | Same restore, moved to the last committed anchor | Reset as above | Kept | Unchanged |
| `N` (new run) | Scene restarts from scratch | Reset | Cleared | Back to the start position |

- Before any rest, the respawn anchor is the hero's starting position.
- There is no currency penalty for dying.
- Quitting or reloading the page loses everything. Saving is Phase 7.

**Persistent rewards** (`RewardLedger`): each reward id is granted once per run. The lab has two: the first defeat of the enemy (`lab-enemy-first-kill`) and a floor pickup (`lab-ash-token-1`). Both give 1 Ash Token (placeholder currency). Resting and dying never remove them, and killing the reset enemy again gives nothing.

## Phases 4–9

One `Session` (`src/game/session.ts`) owns items, XP, the quest, the clue, the Watchman outcome, and the checkpoint id. Scenes own positions, swings, and projectiles. Those are not saved.

- **Items.** Grave Iron is the starting sword. Aldren's Blade (kill) adds 5 basic damage and 8 Echo damage. Ash Ward (road pickup) reduces incoming damage by 4. Watchman's Vow (spare) adds 20 to a completed heal. Stats are recomputed from the equipped ids and the level choice. They do not stack when a menu opens.
- **Level.** 40 XP from the first defeat of the road enemies (20 each). The Watchman awards 20 only if killed. One choice: +25 maximum health, +4 basic damage, or +20 Echo per basic hit.
- **Story.** Bram, Mara, and Oren. States: not accepted, active, clue found, guardian resolved, returned, complete. The name Aldren can be found before the quest is accepted. Spare requires that name. Kill does not. The two outcomes cannot both be set, and each reward is granted once.
- **Fights.** The road has the original melee enemy and an archer. Archer bolts expire, die on hit, and are cleared on rest, death, and leaving the map. The Kneeling Watchman cycles overhead, sweep, and thrust. At 70 HP, if the clue is known, he stops once. Speaking the name spares him. Fighting on can still kill him. The first Echo Strike in that fight, or the resolution if Echo was never used, shows "Where did you get his sword?"
- **Save.** Version 1. See README. A reload starts at the last doorway or rest, with full health, not in the middle of a swing.
- **Presentation.** Phaser text on the camera. Logical canvas stays 960×540 and scales to the window. Audio, shake, and reduced flashes are settings. Reduced flashes replace the white hit flash with a steady colour.

## Decisions

- Logical resolution is 960x540, scaled with `Scale.FIT` and centred. `pixelArt: true` gives nearest-neighbour rendering. Final tile and sprite sizes are set in Phase 1.
- Vite `base` is `./` so the build works from any path.
- UI approach for now: Phaser text objects. Revisit in Phase 2 or 4 and document the choice.
- No game code contains a hostname.
