/** Authored items, ids and story constants. No random rolls. */

export type Slot = "sword" | "charm";

export interface ItemDef {
  id: string;
  name: string;
  slot: Slot;
  blurb: string;
  damageFlat: number;
  echoDamageFlat: number;
  incomingReduction: number;
  healBonus: number;
}

export const ITEMS: Record<string, ItemDef> = {
  "grave-iron": {
    id: "grave-iron",
    name: "Grave Iron",
    slot: "sword",
    blurb: "The sword you dug up. Ordinary reach.",
    damageFlat: 0,
    echoDamageFlat: 0,
    incomingReduction: 0,
    healBonus: 0,
  },
  "aldrens-blade": {
    id: "aldrens-blade",
    name: "Aldren's Blade",
    slot: "sword",
    blurb: "Basic hits +5. Echo Strike +8.",
    damageFlat: 5,
    echoDamageFlat: 8,
    incomingReduction: 0,
    healBonus: 0,
  },
  "ash-ward": {
    id: "ash-ward",
    name: "Ash Ward",
    slot: "charm",
    blurb: "Hits against you deal 4 less damage.",
    damageFlat: 0,
    echoDamageFlat: 0,
    incomingReduction: 4,
    healBonus: 0,
  },
  "watchmans-vow": {
    id: "watchmans-vow",
    name: "Watchman's Vow",
    slot: "charm",
    blurb: "Healing restores 20 more.",
    damageFlat: 0,
    echoDamageFlat: 0,
    incomingReduction: 0,
    healBonus: 20,
  },
};

export const STARTING_SWORD = "grave-iron";
export const KILL_REWARD = "aldrens-blade";
export const SPARE_REWARD = "watchmans-vow";

export const LEVEL_XP = 40;
export const LEVEL_HP = 25;
export const LEVEL_DAMAGE = 4;
export const LEVEL_ECHO_GAIN = 20;

export const XP_AWARDS: Record<string, number> = {
  "yard-wraith": 20,
  "tower-archer": 20,
  "kneeling-watchman": 20,
};

export type MapId = "town" | "approach" | "watchtower";

export const MAP_IDS: readonly MapId[] = ["town", "approach", "watchtower"];

export const CHECKPOINT_MAP: Record<string, MapId> = {
  "town-square": "town",
  "approach-road": "approach",
  "approach-tower": "approach",
  "watchtower-door": "watchtower",
};

export const ENTRY_CHECKPOINT: Record<MapId, string> = {
  town: "town-square",
  approach: "approach-road",
  watchtower: "watchtower-door",
};

export const BROTHER_NAME = "Aldren";
export const ECHO_LINE = "Where did you get his sword?";

export type QuestStatus =
  | "not-accepted"
  | "active"
  | "clue-found"
  | "guardian-resolved"
  | "returned"
  | "complete";

export const QUEST_STATUSES: readonly QuestStatus[] = [
  "not-accepted",
  "active",
  "clue-found",
  "guardian-resolved",
  "returned",
  "complete",
];

export type Outcome = "kill" | "spare";
export type LevelChoice = "health" | "damage" | "echo";
export type NpcId = "bram" | "mara" | "oren" | "watchman";
