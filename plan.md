# The Hollow Bell — Prototype Development Plan

## 1. Purpose and authority

Build a small, complete, single-player isometric action RPG prototype for desktop browsers. This file is the source of truth for scope, implementation order, and acceptance gates. It is intended for Cursor working with a beginner developer.

**Do not implement the whole document in one pass. Complete only the currently authorised phase. Stop after testing each phase and wait for the user’s explicit approval before starting the next.** Fixes within the current phase are allowed; silence, successful automated tests, or approval of a bug fix is not approval to advance.

Start at Phase 0. Never claim a manual browser test passed unless it was actually performed. If browser automation is unavailable, explain that limitation and give the user exact manual steps. Do not mark their checks complete for them.

## 2. Locked creative direction

- Working title: **The Hollow Bell** (not trademark clearance).
- Genre: haunted dark-fantasy, isometric pixel-art action RPG.
- Platform: desktop browser first; mobile adaptation later.
- Hero: a cursed swordsman and grave scavenger, not a chosen saviour.
- Premise: a cathedral bell keeps the dead outside town. Each toll erases a living person from everyone’s memory, except the protagonist. The ultimate explanation remains outside prototype scope.
- Player interests: satisfying combat and loot, mysterious exploration, character conversations, consequential choices, character and equipment progression.
- Core loop: investigate → explore → fight → recover equipment and memories → choose → return to a changed town.
- Tone: ominous but human; moments of warmth make the darkness meaningful.
- Signature mechanic: **Echo Strike**. Basic hits generate Echo; spending a full meter produces a delayed spectral slash associated with a weapon’s former owner.
- Knowledge unlocks encounter options; players can still finish by fighting without reading every clue.

### Prototype content budget

Target 15–25 minutes for a first playthrough; validate through playtesting rather than padding.

- One small safe town map and one compact, handcrafted dungeon map (ruined approach and watchtower can be regions of the same map).
- Three speaking town NPCs: blacksmith, innkeeper, bell keeper.
- Two normal enemy archetypes and one boss.
- One sword moveset; two named swords may share that moveset and Echo attack.
- Two equipment slots: sword and charm. A few fixed authored items; no random affix generator.
- One short XP curve with one level-up choice.
- One main quest, one investigative clue, one consequential kill/spare decision, two visible aftermaths.
- One checkpoint/rest system and one local save slot.
- Temporary consistent art before polish.

### Explicit exclusions

No multiplayer, backend, accounts, payments, open world, procedural generation, crafting, farming, pets, classes, extensive skill trees, platforming, rotating camera, realistic elevation, gamepad support, mobile touch interface, parry, stamina, durability, voice acting, or elaborate cinematic system. Do not add these without a separately approved scope change.

## 3. Technical defaults

Use the current stable Phaser release compatible with the chosen toolchain, TypeScript in strict mode, Vite, npm, and a committed lockfile. **Phaser is the engine; “2D” does not mean Phaser 2.** Verify package versions from official documentation/registry at setup time. Do not invent version numbers or perform unrelated upgrades mid-project.

Use Vitest for pure logic tests. Add Playwright browser smoke tests when practical; installing it must not block all progress if the environment cannot run browsers. Explain limitations explicitly.

- No backend. Use versioned localStorage for a single local save.
- Flat 2D world coordinates, projected into an isometric presentation. Do not use screen coordinates as authoritative gameplay coordinates.
- Prefer lightweight custom kinematic movement and simple ground-plane collision over forcing screen-space physics into the projection. No additional physics engine needed.
- Fixed camera orientation. Shared projection/inverse-projection helpers for rendering, aiming, and picking.
- Aim toward pointer in world coordinates. Normalize diagonal movement.
- Damage, AI, movement and timers use simulation time, not frame count.
- Use logical pixel scaling, nearest-neighbour rendering, consistent sprite ground anchors, and a restrained palette. Establish actual dimensions in Phase 1.
- Foreground occluders fade or become transparent when they hide the hero. Depth follows ground contact position, not sprite centre. Keep the initial layout simple enough for reliable sorting.
- Responsive HTML or Phaser UI is acceptable; choose one approach and document it. No UI framework is required. Keep DOM inputs from leaking clicks into combat.
- Use keyboard and pointer input through an action interface to ease a later mobile adapter. Do not build mobile controls now.
- Handle window resize, browser blur, tab hiding and focus regain safely. Pause gameplay on lost focus; prevent stuck keys and catch-up damage.
- No remote runtime assets/CDNs required. All prototype assets must be local and usable offline after dependencies/build are available.

### Suggested project organization

Adapt to the existing repository if present; do not create a second app unnecessarily.

```text
src/
  main.ts
  game/             # configuration and scene startup
  scenes/           # Boot, Town, Dungeon, UI as needed
  core/             # world coordinates, projection, clock, input, collision
  combat/           # state machines, hit resolution, health, Echo
  entities/         # player, enemies, boss
  data/             # typed item, dialogue, enemy and quest definitions
  progression/      # equipment, XP, level-up
  narrative/        # dialogue and quest state transitions
  persistence/      # save schema, validation, migration/reset
  ui/               # HUD and menus
  tests/            # colocated tests also acceptable
public/assets/      # local placeholders and audio
```

Separate pure rules from Phaser rendering where it improves testing. Avoid giant scene files, global mutable flags, speculative plugin systems, and premature abstractions. Keep one canonical state owner for inventory, quest outcomes, and player progression.

## 4. Mandatory phase workflow

For every phase:

1. Read this plan, the progress log, and relevant existing code.
2. State the authorised scope, intended files, and tests before editing.
3. Implement the smallest complete increment; do not silently implement future phases.
4. Run applicable checks: typecheck, unit tests, production build, browser smoke tests if available.
5. Provide exact commands, results, and known limitations. Distinguish executed tests from suggested tests.
6. Give the user a numbered manual checklist with expected results.
7. Fix failures within this phase and rerun affected checks plus regression checks.
8. Update `PROGRESS.md` with phase status, changes, test evidence, open issues, and next proposed phase.
9. Stop with: **“Phase N is ready for your testing. Please report issues or explicitly approve Phase N+1.”**
10. Advance only after explicit approval. Before the next phase, create a Git checkpoint if authorised and available; never fabricate a commit or overwrite unrelated work.

Use statuses: Not started / In progress / Awaiting user testing / Approved / Blocked. Only the user can approve a phase. If architecture or scope must change, explain the smallest alternative and ask first.

### Standard manual-test report

```text
Phase:
Build/commit tested:
Automated checks actually run:
Manual steps and expected results:
Known issues and deferred items:
Files changed:
Approval needed:
```

On a defect, record reproduction steps, expected/actual behaviour, likely cause, fix and regression test. No unresolved progression blockers or crashes may cross a gate. Cosmetic exceptions require explicit user acceptance.

## 5. Phased implementation

### Phase 0 — Repository inspection and reproducible foundation

**Build**
- Inspect existing files before choosing commands or changing configuration.
- Set up the selected stack, strict TypeScript, scripts for dev/typecheck/test/build, and a minimal boot screen.
- Record actual dependency versions and Node requirements in README.
- Create `PROGRESS.md`, asset provenance file, and a short architecture note.
- Display title, version label, and Start button leading to a placeholder scene.
- Bind the development server to a preview-accessible host when needed; document local and hosted-preview commands. Never hardcode a sandbox hostname into game code.

**Automated checks**: typecheck, one real unit-test smoke test, production build. Verify build asset paths support the intended hosting location.

**User tests**
1. Follow README from install to dev launch; title appears without runtime errors.
2. Start button opens the placeholder scene exactly once.
3. Resize the window; button remains usable.

**Gate**: reproducible launch and passing baseline checks. Stop; request Phase 1 approval.

### Phase 1 — Isometric movement sandbox

**Build**
- One placeholder room with floor, walls and a few occluding props.
- World/screen conversion helpers and tests, including inverse round trips.
- Hero movement, normalized diagonals, ground-plane wall collision, fixed camera tracking.
- WASD movement; pointer-derived facing indicator. Clear focus/input behaviour.
- Establish temporary tile/sprite dimensions and render scaling in architecture notes.
- Ground-contact depth sorting and foreground fading.
- Small debug overlay toggle for coordinates, collision bounds and frame rate.

**Automated checks**: projection round trips, movement normalization, representative collision cases, typecheck/build.

**User tests**
1. Move in every direction; diagonal speed matches straight movement.
2. Push against corners and walls; no passage through solid objects or persistent sticking.
3. Walk in front of and behind props; depth looks correct and hero remains findable.
4. Resize, switch tabs while holding a key, return; no teleporting or stuck movement.

**Gate**: navigation is readable and reliable. Stop; request Phase 2 approval.

### Phase 2 — Core melee combat laboratory

**Build**
- Player idle/move/attack/dodge/hurt/dead states and explicit transition rules.
- Two-hit basic attack sequence with a small input buffer; at most one queued follow-up. No indefinite button-spam chain.
- Lock aim when each swing begins; use world-space range and arc for hits.
- Each swing damages each eligible target at most once.
- Dodge with a short documented invulnerability window and recovery; no attack/dodge spam bypass.
- One melee enemy: idle, chase, telegraph, attack, recover, dead.
- Enemy attacks resolve once per swing and use clear danger indicators.
- Health bars, death, restart, hit flash and restrained hit-stop/feedback.
- Use an isolated combat room; do not add town or story yet.

**Automated checks**: hit deduplication, state transitions, invulnerability timing, death disables combat, time-step consistency for cooldowns.

**User tests**
1. Attacks hit only within the shown reach/direction.
2. Holding or spamming attack cannot cause unlimited instant damage.
3. Dodge through an attack during its safe window; late dodges can be hit.
4. Enemy telegraph gives a readable opportunity to react.
5. Die and restart three times; no duplicated enemies/listeners or stale damage.
6. Blur/return during a fight; gameplay resumes safely.

**Gate**: user confirms the basic fight feels understandable and responsive. Tune before advancing. Stop; request Phase 3 approval.

### Phase 3 — Echo, healing and checkpoint rules

**Build**
- Echo gained only from successful basic hits; clamp to meter maximum.
- Full meter enables one delayed spectral slash; spend meter once on activation.
- One visible spectral attack; ensure its delayed hit does not fire after a scene reset or invalid actor death.
- Limited healing charges, visible count, a short heal commitment; no overheal or use at full health.
- One checkpoint/rest point restores health/charges, resets enemies, and records the respawn anchor. Preserve collected persistent rewards.
- Death restores the latest committed checkpoint state; no currency penalty in prototype.
- Define and document reset rules now, before persistence.

**Automated checks**: meter gain/spend/clamp, single delayed hit, heal limits, death/rest cleanup, no duplicate persistent rewards.

**User tests**
1. Missed swings generate no Echo; hits do.
2. Empty meter cannot activate; full meter fires once and empties.
3. Die or restart before delayed Echo impact; no ghost damage on the next run.
4. Healing respects health/charge limits.
5. Rest resets normal enemies but does not duplicate collected rewards.

**Gate**: abilities and reset semantics are predictable. Stop; request Phase 4 approval.

### Phase 4 — Loot, equipment and one level-up

**Build**
- Fixed authored pickups; no randomized drop economy.
- Two sword items sharing the current moveset/Echo, with modest clearly displayed differences; two charm options with simple effects.
- Sword/charm equipment UI, descriptions, current effects and safe swapping outside combat.
- XP with one prototype level-up: choose maximum health, basic damage, or Echo generation. Select once; apply once.
- Stable item IDs, unique pickup IDs, no reapplying stacked stats on menu open/equip.
- For unique authored enemies, award XP only on the first defeat; respawned enemies remain combat practice without repeat XP. Track separately from transient alive/dead state.
- UI controls must not trigger world attacks; modal menus pause gameplay consistently.

**Automated checks**: item ownership and equip validation, stat recomputation, pickup uniqueness, XP threshold and one-time level-up application.

**User tests**
1. Collect/equip/swap; UI and combat effects agree.
2. Repeatedly open/close menus and swap items; stats never grow accidentally.
3. Reach level-up; choose each option on separate fresh runs.
4. Rest/refight; no duplicate unique drops or XP farming.

**Gate**: loot changes play and progression is stable. Stop; request Phase 5 approval.

### Phase 5 — Town, dialogue and investigative quest

**Build**
- Small safe town, three NPCs, transitions to/from a compact placeholder dungeon.
- Data-driven dialogue with readable text, keyboard/pointer options, and quest-aware lines.
- Main quest: blacksmith requests a silver charm said to belong to his brother; innkeeper disputes the brother’s existence; bell keeper provides limited bell context.
- One discoverable memory clue reveals the name used to address the watchtower guardian.
- Quest states: not accepted, active, clue found, guardian resolved, returned, complete. Model clue ownership independently if the player finds it before accepting.
- Quest journal and concise objective text. No combat while talking or using a modal menu.
- Prototype mystery stays bounded; do not generate extensive lore trees.

**Automated checks**: dialogue conditions, valid quest transitions, clue-before-quest case, repeated interaction idempotency.

**User tests**
1. Talk to all NPCs in different orders; no soft lock.
2. Find the clue before and after accepting the quest.
3. Skip optional dialogue; route to completion remains available.
4. Change maps repeatedly; no duplicated input handlers, NPCs or HUD.
5. Close/reopen dialogue; no unintended attacks or movement.

**Gate**: user can follow the mystery and objective without external instructions. Stop; request Phase 6 approval.

### Phase 6 — Dungeon encounters and boss decision

**Build**
- Finish the compact ruined approach/watchtower layout; no additional large map.
- Second normal enemy archetype with one distinct, telegraphed threat (for example a slow ranged attacker). Bound projectiles and clean them up reliably.
- Boss: The Kneeling Watchman. Three attacks: overhead, sweep, rushing thrust, with clear telegraph/recovery.
- Boss health threshold opens one safe decision opportunity if clue is known. Freeze threats while the choice UI is active. Choosing to speak the discovered name resolves spare; otherwise continue combat.
- Killing is always possible without the clue. Outcomes are mutually exclusive and committed once.
- First appropriate Echo activation triggers one brief recognition line: “Where did you get his sword?” Do not interrupt every fight; provide a fallback delivery if the player never uses Echo.
- Kill reward: named sword immediately. Spare reward: distinct charm and later Watchman presence in town. Tune neither path as obviously worthless.
- Town aftermath and blacksmith dialogue visibly acknowledge the outcome; quest completes and an end-of-prototype screen offers continue exploring or new game.

**Automated checks**: boss attack hit rules, threshold trigger once, exclusive outcome, reward once, no attacks during choice, scene/death cleanup, both quest endings.

**User tests**
1. Complete without finding clue: kill route works.
2. Find clue: choose spare and verify reward and town change.
3. Find clue but continue fighting: kill remains possible.
4. Die during boss fight; restart without stale projectiles, dialogue flags or rewards.
5. Reach both endings from fresh runs; no permanent progression block.

**Gate**: complete beginning-to-end adventure with both outcomes. Stop; request Phase 7 approval.

### Phase 7 — Durable local saves and recovery

**Build**
- Versioned, validated localStorage save and explicit New Game confirmation.
- Save stable progression, inventory/equipment IDs, XP/level choice, collected pickup IDs, awarded XP IDs, quest/clue/outcome flags and checkpoint ID.
- Do not serialize Phaser objects, timers, transient enemy state or mid-attack state.
- Commit safe snapshots at rest, map transitions and resolved permanent choices/rewards. Group outcome plus reward plus quest updates into one state change before save.
- Reload starts at a safe checkpoint with appropriate progression, not halfway through a fight. Document what unsaved travel/combat is lost.
- Continue button, storage unavailable warning, malformed/unsupported save recovery without silent destructive overwrite. Offer an explicit reset; keep an invalid raw save backup when storage allows.
- Save failure must not crash the game; warn that progress is session-only.

**Automated checks**: serialization round trips, schema validation, unsupported versions, invalid IDs, blocked storage, both ending saves, idempotent reloading/rewards.

**User tests**
1. Save/reload in town and after a level-up; progress matches.
2. Resolve each boss outcome then reload; outcome and reward stay consistent.
3. Refresh mid-fight; respawn safely under documented rules.
4. Test malformed save and blocked storage; recovery is clear, no crash.
5. Confirm/cancel New Game; old progress is removed only after confirmation.

**Gate**: reload cannot duplicate rewards, erase a valid save unexpectedly, or strand the player. Stop; request Phase 8 approval.

### Phase 8 — Presentation, usability and performance pass

**Build**
- Improve placeholder consistency and UI hierarchy; do not silently expand into final bespoke asset production.
- Local, licensed temporary audio or simple generated effects; provenance recorded. Browser audio begins only after user gesture.
- Settings: master volume/mute, screen-shake toggle, reduced flashes. Avoid rapid flashing effects.
- Readable text, sufficient contrast, controls help, obvious interact prompts, visible hit/telegraph cues beyond colour alone.
- Responsive desktop layouts; test at 1280×720 and 1920×1080 plus a narrower window. Mobile UI implementation remains deferred.
- Profile before optimizing. Target smooth 60 FPS on the documented test machine at 1280×720, not a universal hardware guarantee. Record frame behaviour and active entity counts; no accumulating objects/listeners over repeated resets.
- Ensure production build works with local bundled assets and the intended deployment base path.

**Automated checks**: full suite/build, available browser smoke tests, missing asset checks.

**User tests**
1. Play with audio muted; all gameplay information remains understandable.
2. Resize during dialogue, equipment, combat and ending screens.
3. Test all settings; reload and confirm persistence if settings storage is implemented.
4. Repeat travel/death/rest cycles at least ten times; no obvious slowdown or duplication.
5. Complete one full run using the production build, not just the dev server.

**Gate**: playable, readable, stable presentation. Stop; request Phase 9 approval.

### Phase 9 — Release-candidate playtest and prototype handoff

**Build**
- Feature freeze: fix bugs, tune encounters, clarify confusing objectives; no new systems.
- README with install/run/build/preview/deployment instructions, controls, save behaviour, limitations and troubleshooting.
- Record tested browser/OS/device. Target current stable Chrome and Firefox desktop; list Safari as unverified unless tested.
- Consolidate content/asset provenance and known issues.
- Package source/repository state and production build instructions; do not assume generated build folders are persisted by every workspace.

**Regression matrix**
- Fresh start → kill ending.
- Fresh start → clue → spare ending.
- Clue discovered before quest acceptance.
- Death during normal attack, Echo delay, boss attack.
- Save/reload after reward, level choice and ending.
- Invalid/blocked storage, new-game cancellation, blur/resume, repeated map travel.

**User playtest questions**
1. Can you explain the goal and mystery after the first few minutes?
2. Are enemy attacks readable? Do deaths feel fair?
3. Does Echo Strike feel distinct and useful?
4. Did an item or conversation make you curious?
5. Did the final choice feel understandable and consequential?
6. Where were you confused, bored, or blocked?

If possible, observe a new player without explaining controls beyond in-game help. Record actual completion time and confusion points. Obtain user acceptance before declaring the prototype finished.

**Final deliverables**: runnable source, passing available checks, documented test evidence, known-issues list, asset provenance, and a recommendation to improve or expand based on feedback.

## 6. Implementation rules and tuning guidance

- Put tunable numbers in typed data/configuration, not scattered magic constants. Starting numbers are hypotheses, not promises of balance.
- Keep normal fights short and boss phases readable. Tune telegraphs using observed player response.
- Prefer deterministic authored encounters and fixed rewards for debugging.
- Use explicit combat states; do not accumulate loosely related booleans.
- Give every delayed action a cancellation/ownership mechanism. Destroy timers, projectiles, events and listeners on scene shutdown.
- One hit resolver defines damage, invulnerability, death and reward callbacks consistently.
- Track input press versus hold deliberately; one held button must not repeatedly interact or choose dialogue options.
- Keep persistent facts separate from transient combat state. Death/reload must not turn a spared boss into a kill or award both rewards.
- Changes to save schema, quest transitions or shared input require regression tests.
- Never use copyrighted commercial game assets without permission. Record source, author, licence and modifications for every external asset.
- Do not put secrets in frontend code. Do not introduce analytics or external data collection without approval.
- Explain commands to the beginner. Avoid destructive resets, overwriting existing files blindly, or requiring tools the user has not installed without instructions.

## 7. Future roadmap — NOT authorised implementation

Only reconsider these after prototype acceptance and playtest findings:

1. Combat refinement: additional weapon movesets, expanded enemy roster, better accessibility and optional difficulty tuning.
2. Content expansion: one new district and its local mystery, not an immediate open world.
3. Polished identity: consistent final pixel-art pipeline, animation directions, sound, music and narrative revision. Test replacing a single character/environment kit before producing all assets.
4. More meaningful equipment memories and carefully bounded consequences; avoid exponential branching.
5. Mobile feasibility spike: touch aiming/assistance, input layout, UI scale, performance, browser storage behaviour and device testing. Validate first, then adapt.
6. Distribution decisions: browser hosting first; desktop packaging/store releases are separate projects if desired.

Do not promise a full-game timeline or commercial success from this prototype. A finished small slice is the evidence needed to decide the next scope.

## 8. Copy/paste instruction for Cursor

> Read `plan.md` completely and inspect the existing repository. Follow its scope and approval gates. Start only Phase 0 unless `PROGRESS.md` records a later user-approved starting point. Before editing, summarize the current phase, files you expect to change, and acceptance tests. Implement only that phase, run available checks, report actual results and limitations, update `PROGRESS.md`, and provide my manual test checklist. Then STOP and wait for my explicit approval before advancing. Do not implement later phases, silently add dependencies/features, claim unperformed tests passed, or change the agreed scope without asking.
