import { LEVEL_XP, type LevelChoice } from "../data/content";

export interface XpGrant {
  gained: boolean;
  ready: boolean;
}

/** One short curve. A unique enemy id awards XP once. The level choice applies once. */
export class Progression {
  total = 0;
  choice: LevelChoice | null = null;
  private readonly awarded = new Set<string>();

  static restore(total: number, choice: LevelChoice | null, awarded: readonly string[]): Progression {
    const xp = new Progression();
    xp.total = total;
    xp.choice = choice;
    for (const id of awarded) xp.awarded.add(id);
    return xp;
  }

  get ready(): boolean {
    return this.choice === null && this.total >= LEVEL_XP;
  }

  awardedIds(): string[] {
    return [...this.awarded].sort();
  }

  grant(id: string, amount: number): XpGrant {
    if (this.awarded.has(id) || amount <= 0) return { gained: false, ready: this.ready };
    this.awarded.add(id);
    this.total += amount;
    return { gained: true, ready: this.ready };
  }

  choose(choice: LevelChoice): boolean {
    if (!this.ready) return false;
    this.choice = choice;
    return true;
  }
}
