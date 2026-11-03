/** Longest simulation step in seconds. Prevents catch-up jumps after a stall or tab switch. */
export const MAX_FRAME_SECONDS = 1 / 20;

/** Converts a Phaser frame delta (milliseconds) to a safe simulation delta in seconds. */
export function simulationDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
}
