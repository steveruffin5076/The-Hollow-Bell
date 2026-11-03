import type { Vec2 } from "../core/projection";
import type { PlayerCombat } from "./player";

export interface Resettable {
  reset(): void;
}

export interface CheckpointDef {
  id: string;
  /** Where the rest point stands in the world. */
  position: Vec2;
  /** Where the player returns after dying. */
  anchor: Vec2;
  /** The player must be within this distance to rest. */
  interactRange: number;
}

/**
 * Reset rules (see ARCHITECTURE.md):
 *
 * REST (at a checkpoint, player idle or moving, within range):
 *   - commits this checkpoint as the respawn anchor
 *   - player: full health, full heal charges, Echo empty, no pending swing or Echo Strike
 *   - every normal enemy: back at spawn, alive, full health, idle, no pending swing
 *   - the player is not moved
 *
 * RESPAWN (after death): same restore as rest, and the player moves to the
 *   last committed anchor. Enemies reset too.
 *
 * Neither touches persistent rewards. Those live in the RewardLedger.
 */
export class CheckpointState {
  committedId: string;
  committedAnchor: Vec2;

  constructor(startId: string, startAnchor: Vec2) {
    this.committedId = startId;
    this.committedAnchor = { ...startAnchor };
  }

  canRest(def: CheckpointDef, player: PlayerCombat): boolean {
    if (!player.alive) return false;
    if (player.state !== "idle" && player.state !== "move") return false;
    const d = Math.hypot(player.pos.x - def.position.x, player.pos.y - def.position.y);
    return d <= def.interactRange;
  }

  /** Returns true if the rest happened. */
  rest(def: CheckpointDef, player: PlayerCombat, enemies: readonly Resettable[]): boolean {
    if (!this.canRest(def, player)) return false;
    this.committedId = def.id;
    this.committedAnchor = { ...def.anchor };
    player.restoreFull();
    for (const e of enemies) e.reset();
    return true;
  }

  /** Restores the latest committed checkpoint state after death. */
  respawn(player: PlayerCombat, enemies: readonly Resettable[]): void {
    player.restoreFull(this.committedAnchor);
    for (const e of enemies) e.reset();
  }
}
