import type { RewardLedger } from "../progression/rewards";
import type { HitOutcome, Swing } from "./hit";
import type { PlayerCombat } from "./player";

/**
 * Applies the side effects of one of the player's swings resolving on a target:
 * Echo gain (basic swings only) and a one-time kill reward.
 */
export function onPlayerSwingOutcome(
  player: PlayerCombat,
  ledger: RewardLedger,
  swing: Swing,
  outcome: HitOutcome,
  killRewardId?: string,
): void {
  if (outcome === "applied" || outcome === "killed") player.registerHit(swing);
  if (outcome === "killed" && killRewardId) ledger.grant(killRewardId);
}
