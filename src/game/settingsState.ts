import { DEFAULT_SETTINGS, type Settings } from "../persistence/save";

let current: Settings = { ...DEFAULT_SETTINGS };

export function getSettings(): Settings {
  return current;
}

export function replaceSettings(next: Settings): void {
  current = { ...next };
}

export function patchSettings(partial: Partial<Settings>): Settings {
  current = { ...current, ...partial };
  return current;
}
