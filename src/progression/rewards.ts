import type { Vec2 } from "../core/projection";

/**
 * Persistent rewards. Each reward has a stable id and is granted at most once
 * per run. Resting or dying never touches the ledger.
 */
export class RewardLedger {
  private readonly granted = new Set<string>();
  /** Placeholder currency for the lab. */
  tokens = 0;

  has(id: string): boolean {
    return this.granted.has(id);
  }

  /** Returns true only the first time an id is granted. */
  grant(id: string, tokens = 1): boolean {
    if (this.granted.has(id)) return false;
    this.granted.add(id);
    this.tokens += tokens;
    return true;
  }
}

export interface PickupDef {
  id: string;
  position: Vec2;
  radius: number;
}

/** Collects a pickup if the actor is close enough and it has not been collected. */
export function tryCollect(ledger: RewardLedger, pickup: PickupDef, actorPos: Vec2): boolean {
  if (ledger.has(pickup.id)) return false;
  const d = Math.hypot(actorPos.x - pickup.position.x, actorPos.y - pickup.position.y);
  if (d > pickup.radius) return false;
  return ledger.grant(pickup.id);
}
