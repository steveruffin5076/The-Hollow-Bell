import type { CheckpointDef } from "../combat/checkpoint";
import type { Rect } from "../core/collision";
import type { PickupDef } from "../progression/rewards";
import { WORLD_TILE, type Vec2 } from "../core/projection";

export const WALL_HEIGHT = 64;

export interface SolidBox {
  id: string;
  rect: Rect;
  height: number;
  topColor: number;
  leftColor: number;
  rightColor: number;
}

export interface RoomDef {
  cols: number;
  rows: number;
  wallBoxes: SolidBox[];
  wallColliders: Rect[];
  props: SolidBox[];
  heroSpawn: Vec2;
}

export function tileRect(col: number, row: number, cols = 1, rows = 1): Rect {
  return {
    minX: col * WORLD_TILE,
    minY: row * WORLD_TILE,
    maxX: (col + cols) * WORLD_TILE,
    maxY: (row + rows) * WORLD_TILE,
  };
}

const WALL_COLORS = { topColor: 0x5a566b, leftColor: 0x3a374a, rightColor: 0x2b293a };
const PILLAR = { topColor: 0x8a8576, leftColor: 0x5e5a50, rightColor: 0x433f38 };
const CRATE = { topColor: 0x8c6a45, leftColor: 0x5f4630, rightColor: 0x44301f };

/** Builds a rectangular room with a one-tile wall ring around the edge. */
export function buildRoom(cols: number, rows: number, props: SolidBox[], heroSpawn: Vec2): RoomDef {
  const wallBoxes: SolidBox[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const onRing = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
      if (onRing) {
        wallBoxes.push({ id: `wall-${c}-${r}`, rect: tileRect(c, r), height: WALL_HEIGHT, ...WALL_COLORS });
      }
    }
  }
  const wallColliders: Rect[] = [
    tileRect(0, 0, cols, 1),
    tileRect(0, rows - 1, cols, 1),
    tileRect(0, 0, 1, rows),
    tileRect(cols - 1, 0, 1, rows),
  ];
  return { cols, rows, wallBoxes, wallColliders, props, heroSpawn };
}

/** Phase 1 movement sandbox. */
export const SANDBOX_ROOM: RoomDef = buildRoom(
  20,
  14,
  [
    { id: "pillar-a", rect: tileRect(6, 4), height: 80, ...PILLAR },
    { id: "pillar-b", rect: tileRect(5, 10), height: 80, ...PILLAR },
    { id: "pillar-c", rect: tileRect(15, 10), height: 80, ...PILLAR },
    { id: "tomb", rect: tileRect(14, 4, 2, 1), height: 40, ...PILLAR },
    { id: "crate-l1", rect: tileRect(10, 7), height: 36, ...CRATE },
    { id: "crate-l2", rect: tileRect(11, 7), height: 36, ...CRATE },
    { id: "crate-l3", rect: tileRect(10, 8), height: 36, ...CRATE },
  ],
  { x: 5 * WORLD_TILE, y: 6 * WORLD_TILE },
);

/** Phase 2 isolated combat room. Open floor with two pillars. */
export const COMBAT_ROOM: RoomDef = buildRoom(
  16,
  12,
  [
    { id: "pillar-a", rect: tileRect(6, 5), height: 80, ...PILLAR },
    { id: "pillar-b", rect: tileRect(10, 7), height: 80, ...PILLAR },
  ],
  { x: 4 * WORLD_TILE, y: 4 * WORLD_TILE },
);

/** The combat room's rest point. */
export const COMBAT_CHECKPOINT: CheckpointDef = {
  id: "lab-bell-stone",
  position: { x: 3 * WORLD_TILE + 16, y: 8 * WORLD_TILE + 16 },
  anchor: { x: 3 * WORLD_TILE + 44, y: 8 * WORLD_TILE + 16 },
  interactRange: 48,
};

/** Respawn anchor before any rest: the hero's starting position. */
export const COMBAT_START_CHECKPOINT_ID = "lab-start";

/** A fixed pickup that can be collected once per run. */
export const COMBAT_PICKUP: PickupDef = {
  id: "lab-ash-token-1",
  position: { x: 12 * WORLD_TILE + 16, y: 3 * WORLD_TILE + 16 },
  radius: 14,
};

/** Granted once, the first time the lab enemy is defeated. */
export const COMBAT_ENEMY_REWARD_ID = "lab-enemy-first-kill";

/** Where the combat room enemy starts. */
export const COMBAT_ENEMY_SPAWN: Vec2 = { x: 11 * WORLD_TILE, y: 8 * WORLD_TILE };
