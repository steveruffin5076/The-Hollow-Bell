import type { CheckpointDef } from "../combat/checkpoint";
import type { Vec2 } from "../core/projection";
import { WORLD_TILE } from "../core/projection";
import type { MapId, NpcId } from "./content";
import { buildRoom, type RoomDef } from "./rooms";

const PILLAR = { topColor: 0x8a8576, leftColor: 0x5e5a50, rightColor: 0x433f38 };
const CRATE = { topColor: 0x8c6a45, leftColor: 0x5f4630, rightColor: 0x44301f };

export interface DoorDef {
  id: string;
  pos: Vec2;
  range: number;
  label: string;
  to: MapId;
  /** Checkpoint the player stands at on the destination map. */
  arrive: string;
}

export interface NpcDef {
  id: NpcId;
  pos: Vec2;
  range: number;
}

export interface PickupDef {
  id: string;
  kind: "item" | "clue";
  itemId?: string;
  pos: Vec2;
  range: number;
  label: string;
}

export interface SpawnDef {
  xpId: string;
  pos: Vec2;
}

export interface MapDef {
  id: MapId;
  title: string;
  room: RoomDef;
  checkpoint: CheckpointDef;
  doors: DoorDef[];
  npcs: NpcDef[];
  pickups: PickupDef[];
  melee: SpawnDef[];
  archers: SpawnDef[];
  boss: SpawnDef | null;
}

function at(col: number, row: number): Vec2 {
  return { x: col * WORLD_TILE + 16, y: row * WORLD_TILE + 16 };
}

const townRoom = buildRoom(16, 12, [
  { id: "forge", rect: { minX: 4 * 32, minY: 4 * 32, maxX: 5 * 32, maxY: 5 * 32 }, height: 48, ...CRATE },
  { id: "inn", rect: { minX: 11 * 32, minY: 4 * 32, maxX: 12 * 32, maxY: 5 * 32 }, height: 56, ...PILLAR },
  { id: "bell", rect: { minX: 8 * 32, minY: 2 * 32, maxX: 9 * 32, maxY: 3 * 32 }, height: 70, ...PILLAR },
], at(8, 7));

const approachRoom = buildRoom(18, 14, [
  { id: "ruin-a", rect: { minX: 8 * 32, minY: 5 * 32, maxX: 9 * 32, maxY: 6 * 32 }, height: 64, ...PILLAR },
  { id: "ruin-b", rect: { minX: 9 * 32, minY: 9 * 32, maxX: 10 * 32, maxY: 10 * 32 }, height: 40, ...CRATE },
], at(4, 7));

const towerRoom = buildRoom(14, 12, [
  { id: "kneeler-stone", rect: { minX: 8 * 32, minY: 4 * 32, maxX: 9 * 32, maxY: 5 * 32 }, height: 28, ...PILLAR },
], at(4, 6));

export const MAPS: Record<MapId, MapDef> = {
  town: {
    id: "town",
    title: "Hollow Town",
    room: townRoom,
    checkpoint: { id: "town-square", position: at(8, 7), anchor: at(8, 7), interactRange: 48 },
    doors: [{ id: "to-approach", pos: at(13, 7), range: 40, label: "F: watchtower road", to: "approach", arrive: "approach-road" }],
    npcs: [
      { id: "bram", pos: at(5, 6), range: 42 },
      { id: "mara", pos: at(11, 6), range: 42 },
      { id: "oren", pos: at(8, 4), range: 42 },
      { id: "watchman", pos: at(11, 9), range: 42 },
    ],
    pickups: [],
    melee: [],
    archers: [],
    boss: null,
  },
  approach: {
    id: "approach",
    title: "Watchtower Road",
    room: approachRoom,
    // The stone sits far enough west that resting from any side of it stays outside
    // the wraith's and the archer's aggro range (checked in phase7.test.ts).
    checkpoint: { id: "approach-road", position: at(2, 10), anchor: at(4, 7), interactRange: 48 },
    doors: [
      { id: "to-town", pos: at(2, 7), range: 36, label: "F: return to town", to: "town", arrive: "town-square" },
      { id: "to-tower", pos: at(15, 7), range: 40, label: "F: enter the watchtower", to: "watchtower", arrive: "watchtower-door" },
    ],
    npcs: [],
    pickups: [
      { id: "memory-aldren", kind: "clue", pos: at(12, 3), range: 36, label: "A name scratched in the stone" },
      { id: "pickup-ash-ward", kind: "item", itemId: "ash-ward", pos: at(6, 11), range: 28, label: "Ash Ward" },
    ],
    melee: [{ xpId: "yard-wraith", pos: at(12, 10) }],
    archers: [{ xpId: "tower-archer", pos: at(15, 4) }],
    boss: null,
  },
  watchtower: {
    id: "watchtower",
    title: "The Watchtower",
    room: towerRoom,
    checkpoint: { id: "watchtower-door", position: at(4, 9), anchor: at(4, 6), interactRange: 48 },
    doors: [{ id: "to-approach", pos: at(2, 6), range: 36, label: "F: leave the tower", to: "approach", arrive: "approach-tower" }],
    npcs: [],
    pickups: [],
    melee: [],
    archers: [],
    boss: { xpId: "kneeling-watchman", pos: at(9, 6) },
  },
};

/** Where a doorway or a reload places the player. The tower exit is the east end of the road. */
const ARRIVALS: Record<string, Vec2> = {
  "town-square": at(8, 7),
  "approach-road": at(4, 7),
  "approach-tower": at(13, 7),
  "watchtower-door": at(4, 6),
};

export function anchorFor(checkpointId: string): Vec2 {
  const arrival = ARRIVALS[checkpointId];
  if (arrival) return { ...arrival };
  return { ...MAPS.town.checkpoint.anchor };
}
