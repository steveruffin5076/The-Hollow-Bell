import {
  CHECKPOINT_MAP,
  ITEMS,
  LEVEL_XP,
  MAP_IDS,
  QUEST_STATUSES,
  STARTING_SWORD,
  type LevelChoice,
  type MapId,
  type Outcome,
  type QuestStatus,
} from "../data/content";

export const SAVE_KEY = "hollow-bell-save";
export const BACKUP_KEY = "hollow-bell-save-backup";
export const SETTINGS_KEY = "hollow-bell-settings";
export const SAVE_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("blocked");
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export interface SaveData {
  version: 1;
  map: MapId;
  checkpointId: string;
  swordId: string;
  charmId: string | null;
  owned: string[];
  collected: string[];
  xp: number;
  levelChoice: LevelChoice | null;
  xpAwarded: string[];
  status: QuestStatus;
  clueKnown: boolean;
  outcome: Outcome | null;
  echoLineDelivered: boolean;
}

export interface Settings {
  master: number;
  muted: boolean;
  shake: boolean;
  reducedFlash: boolean;
}

export const DEFAULT_SETTINGS: Settings = { master: 0.4, muted: false, shake: true, reducedFlash: false };

export type LoadResult =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "empty" | "malformed" | "unsupported" | "invalid" };

export function writeSave(storage: StorageLike, save: SaveData): { ok: true } | { ok: false; reason: "blocked" } {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return { ok: true };
  } catch {
    return { ok: false, reason: "blocked" };
  }
}

export function loadSave(storage: StorageLike): LoadResult {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { ok: false, reason: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    backup(storage, raw);
    return { ok: false, reason: "malformed" };
  }
  const checked = validateSave(parsed);
  if (checked === "unsupported" || checked === "malformed" || checked === "invalid") {
    backup(storage, raw);
    return { ok: false, reason: checked };
  }
  return { ok: true, save: checked };
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // A failed delete still leaves the game playable for this session.
  }
}

export function saveSettings(storage: StorageLike, settings: Settings): boolean {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(storage: StorageLike): Settings {
  const raw = storage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const master = typeof parsed.master === "number" && Number.isFinite(parsed.master) ? parsed.master : DEFAULT_SETTINGS.master;
    return {
      master: Math.min(1, Math.max(0, master)),
      muted: parsed.muted === true,
      shake: parsed.shake !== false,
      reducedFlash: parsed.reducedFlash === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** localStorage when the browser allows it, otherwise null (session-only play). */
export function browserStorage(): StorageLike | null {
  try {
    const probe = "__hollow_bell_probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function backup(storage: StorageLike, raw: string): void {
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // Keeping the original key is enough when the backup write is blocked.
  }
}

function validateSave(raw: unknown): SaveData | "malformed" | "unsupported" | "invalid" {
  if (typeof raw !== "object" || raw === null) return "malformed";
  const version = (raw as { version?: unknown }).version;
  if (version !== SAVE_VERSION) return typeof version === "number" ? "unsupported" : "malformed";
  const row = raw as Partial<SaveData>;
  if (!isMap(row.map) || typeof row.checkpointId !== "string") return "invalid";
  if (CHECKPOINT_MAP[row.checkpointId] !== row.map) return "invalid";
  if (!isStringList(row.owned) || !isStringList(row.collected) || !isStringList(row.xpAwarded)) return "invalid";
  if (!row.owned.includes(STARTING_SWORD)) return "invalid";
  if (typeof row.swordId !== "string" || !row.owned.includes(row.swordId) || ITEMS[row.swordId]?.slot !== "sword") return "invalid";
  if (row.charmId !== null && (typeof row.charmId !== "string" || !row.owned.includes(row.charmId) || ITEMS[row.charmId]?.slot !== "charm")) {
    return "invalid";
  }
  for (const id of row.owned) if (!ITEMS[id]) return "invalid";
  if (typeof row.xp !== "number" || !Number.isFinite(row.xp) || row.xp < 0 || row.xp > 100000) return "invalid";
  if (!isChoice(row.levelChoice)) return "invalid";
  if (row.levelChoice && row.xp < LEVEL_XP) return "invalid";
  if (!isStatus(row.status) || typeof row.clueKnown !== "boolean" || typeof row.echoLineDelivered !== "boolean") return "invalid";
  if (row.outcome !== null && row.outcome !== "kill" && row.outcome !== "spare") return "invalid";
  const blade = row.owned.includes("aldrens-blade");
  const vow = row.owned.includes("watchmans-vow");
  if (blade && vow) return "invalid";
  if (row.outcome === "kill" && (!blade || vow)) return "invalid";
  if (row.outcome === "spare" && (!vow || blade)) return "invalid";
  if (row.outcome === null && (blade || vow)) return "invalid";
  return {
    version: 1,
    map: row.map,
    checkpointId: row.checkpointId,
    swordId: row.swordId,
    charmId: row.charmId ?? null,
    owned: [...row.owned].sort(),
    collected: [...row.collected].sort(),
    xp: row.xp,
    levelChoice: row.levelChoice ?? null,
    xpAwarded: [...row.xpAwarded].sort(),
    status: row.status,
    clueKnown: row.clueKnown,
    outcome: row.outcome,
    echoLineDelivered: row.echoLineDelivered,
  };
}

function isMap(value: unknown): value is MapId {
  return typeof value === "string" && (MAP_IDS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is QuestStatus {
  return typeof value === "string" && (QUEST_STATUSES as readonly string[]).includes(value);
}

function isChoice(value: unknown): value is LevelChoice | null {
  return value === null || value === "health" || value === "damage" || value === "echo";
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
