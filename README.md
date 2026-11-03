# The Hollow Bell

Haunted dark-fantasy isometric action RPG prototype for desktop browsers. Scope and phases are defined in `plan.md`. Current status is in `PROGRESS.md`.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (tested on v20.20.1)
- npm (tested on 11.17.0)

## Versions in use (from `package-lock.json`)

| Package | Version |
| --- | --- |
| phaser | 4.2.1 |
| vite | 8.3.5 |
| typescript | 7.0.2 |
| vitest | 4.1.12 |

## Commands

Run these in the project folder.

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies. Run once. |
| `npm run dev` | Starts the dev server at http://localhost:5173 |
| `npm run dev:host` | Same, but reachable from other devices or a hosted preview (binds to all network interfaces). |
| `npm run typecheck` | Checks TypeScript (strict mode). |
| `npm test` | Runs unit tests. |
| `npm run build` | Builds to `dist/`. |
| `npm run preview` | Serves the built `dist/` locally. |

## How to play

New Game starts in Hollow Town. Bram the blacksmith asks for a silver charm. The east road leads to the watchtower. A scratched name on that road changes what you can say to the guardian. You can still finish by fighting.

Continue loads the one save on this browser. Enter continues when a save exists, and starts a new game when it does not. Combat lab and Movement sandbox stay on the title screen.

## Controls

- `WASD`: move (screen-relative)
- Mouse: aim
- Left click: attack. Click again during the first swing for the second hit.
- `Space`: dodge
- `E`: Echo Strike when the meter is full. Basic hits fill it.
- `Q`: heal (3 charges). A hit during the heal spends nothing.
- `F`: talk, rest, or use a door when the prompt shows
- `I`: equipment. Numbers equip an item while nothing is chasing you.
- `J`: journal
- `H`: help, including mute, screen shake, reduced flashes, and volume
- `R`: respawn at the last checkpoint (only when dead)
- `1` `2` `3`: choose a dialogue, level-up, or the Watchman's offer
- `N`: new run in the combat lab only
- `F3`: debug overlay in the movement sandbox

## Save

One save slot in `localStorage` (`hollow-bell-save`). It is written at a doorway, a rest, a pickup, a level choice, an equipment change, and when the Watchman is resolved. Dying or refreshing during a fight returns you to the last of those points. Unsaved blows in that fight are lost. The outcome and its reward are saved together. Settings are a separate key (`hollow-bell-settings`). If storage is blocked, the game tells you and keeps going for the session. A broken save is copied to `hollow-bell-save-backup` and is not deleted until you confirm a new game.

## Hosting

The build uses a relative base (`./`), so `dist/` works from any folder or sub-path on a static host. Open it through a web server (for example `npm run preview`), not by double-clicking `index.html`.

## Offline use

No CDN or remote assets are used. Tones are generated in the browser after the first click or key press.

## Tested

Windows, Chromium via Playwright, viewport 1280×720, on 3 Nov 2026. Firefox and Safari were not tested.

## Limits

Placeholder shapes, not final art. One sword moveset. No gamepad and no phone controls. The story ends after the watchtower choice.
