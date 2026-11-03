import {
  ITEMS,
  LEVEL_DAMAGE,
  LEVEL_ECHO_GAIN,
  STARTING_SWORD,
  type LevelChoice,
} from "../data/content";

export interface CombatMods {
  damageFlat: number;
  echoGainFlat: number;
  echoDamageFlat: number;
  incomingReduction: number;
  healBonus: number;
}

export function computeMods(swordId: string, charmId: string | null, choice: LevelChoice | null): CombatMods {
  const sword = ITEMS[swordId];
  const charm = charmId ? ITEMS[charmId] : undefined;
  return {
    damageFlat: (sword?.damageFlat ?? 0) + (choice === "damage" ? LEVEL_DAMAGE : 0),
    echoGainFlat: choice === "echo" ? LEVEL_ECHO_GAIN : 0,
    echoDamageFlat: sword?.echoDamageFlat ?? 0,
    incomingReduction: charm?.incomingReduction ?? 0,
    healBonus: charm?.healBonus ?? 0,
  };
}

/** Owned items and the two equipment slots. Stats are always recomputed. */
export class Loadout {
  private readonly owned = new Set<string>([STARTING_SWORD]);
  swordId = STARTING_SWORD;
  charmId: string | null = null;

  static restore(owned: readonly string[], swordId: string, charmId: string | null): Loadout {
    const loadout = new Loadout();
    loadout.owned.clear();
    for (const id of owned) loadout.owned.add(id);
    loadout.swordId = swordId;
    loadout.charmId = charmId;
    return loadout;
  }

  owns(id: string): boolean {
    return this.owned.has(id);
  }

  ownedIds(): string[] {
    return [...this.owned].sort();
  }

  /** Returns true only the first time. */
  own(id: string): boolean {
    if (!ITEMS[id] || this.owned.has(id)) return false;
    this.owned.add(id);
    return true;
  }

  /** Equips an owned item into its slot. Same choice twice does not change stats. */
  equip(id: string): boolean {
    const item = ITEMS[id];
    if (!item || !this.owned.has(id)) return false;
    if (item.slot === "sword") this.swordId = id;
    else this.charmId = id;
    return true;
  }
}
