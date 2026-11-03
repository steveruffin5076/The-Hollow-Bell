import {
  ECHO_LINE,
  ENTRY_CHECKPOINT,
  KILL_REWARD,
  SPARE_REWARD,
  XP_AWARDS,
  type LevelChoice,
  type MapId,
  type Outcome,
} from "../data/content";
import {
  acceptQuest,
  completeQuest,
  enterTown,
  findClue,
  freshStory,
  markEchoLine,
  resolveGuardian,
  type Story,
} from "../narrative/story";
import { writeSave, type SaveData, type StorageLike } from "../persistence/save";
import { Loadout, computeMods, type CombatMods } from "../progression/loadout";
import { Progression, type XpGrant } from "../progression/xp";

/**
 * The one owner of inventory, quest outcome and progression.
 * Enemy positions and mid-swing state stay in the scene and are not saved.
 */
export class Session {
  map: MapId = "town";
  checkpointId = "town-square";
  story: Story = freshStory();
  loadout = new Loadout();
  progression = new Progression();
  storageWarning = false;
  /** The ending can show again after a reload, but not on every doorway. */
  endingDismissed = false;
  /** Set when the Echo recognition line is heard. The scene shows it once and clears it. */
  echoNotice: string | null = null;
  private readonly collected = new Set<string>();

  toSave(): SaveData {
    return {
      version: 1,
      map: this.map,
      checkpointId: this.checkpointId,
      swordId: this.loadout.swordId,
      charmId: this.loadout.charmId,
      owned: this.loadout.ownedIds(),
      collected: [...this.collected].sort(),
      xp: this.progression.total,
      levelChoice: this.progression.choice,
      xpAwarded: this.progression.awardedIds(),
      status: this.story.status,
      clueKnown: this.story.clueKnown,
      outcome: this.story.outcome,
      echoLineDelivered: this.story.echoLineDelivered,
    };
  }

  restoreCollected(ids: readonly string[]): void {
    for (const id of ids) this.collected.add(id);
  }

  owns(id: string): boolean {
    return this.loadout.owns(id);
  }

  own(id: string): boolean {
    const added = this.loadout.own(id);
    if (added && id === "ash-ward") this.collected.add("pickup-ash-ward");
    return added;
  }

  equip(id: string): boolean {
    return this.loadout.equip(id);
  }

  mods(): CombatMods {
    return computeMods(this.loadout.swordId, this.loadout.charmId, this.progression.choice);
  }

  hasCollected(id: string): boolean {
    return this.collected.has(id);
  }

  grantXp(id: string, amount = XP_AWARDS[id] ?? 0): XpGrant {
    return this.progression.grant(id, amount);
  }

  chooseLevel(choice: LevelChoice): boolean {
    return this.progression.choose(choice);
  }

  acceptQuest(): void {
    this.story = acceptQuest(this.story);
  }

  findClue(): void {
    this.story = findClue(this.story);
    this.collected.add("memory-aldren");
  }

  finishQuest(): void {
    this.story = completeQuest(this.story);
  }

  travel(map: MapId, checkpointId = ENTRY_CHECKPOINT[map]): void {
    this.map = map;
    this.checkpointId = checkpointId;
    if (map === "town") this.story = enterTown(this.story);
  }

  /** Commits kill or spare once. Grants that path's item and equips it. */
  resolve(outcome: Outcome): boolean {
    if (this.story.outcome) return false;
    const next = resolveGuardian(this.story, outcome);
    if (next === this.story) return false;
    this.story = next;
    if (outcome === "kill") {
      this.own(KILL_REWARD);
      this.equip(KILL_REWARD);
    } else {
      this.own(SPARE_REWARD);
      this.equip(SPARE_REWARD);
    }
    this.hearEchoLine();
    return true;
  }

  /** First Echo recognition line, including the fallback if Echo was never used. */
  hearEchoLine(): string | null {
    if (this.story.echoLineDelivered) return null;
    this.story = markEchoLine(this.story);
    this.echoNotice = ECHO_LINE;
    return ECHO_LINE;
  }
}

export function freshSession(): Session {
  return new Session();
}

let activeSession: Session | null = null;

export function setActiveSession(session: Session): void {
  activeSession = session;
}

export function getActiveSession(): Session {
  if (!activeSession) activeSession = freshSession();
  return activeSession;
}

/** Writes the current session. A blocked or missing store sets a warning and does not throw. */
export function persistActive(storage: StorageLike | null): void {
  const session = getActiveSession();
  if (!storage) {
    session.storageWarning = true;
    return;
  }
  const wrote = writeSave(storage, session.toSave());
  session.storageWarning = !wrote.ok;
}

export function sessionFromSave(save: SaveData): Session {
  const session = new Session();
  session.map = save.map;
  session.checkpointId = save.checkpointId;
  session.story = {
    status: save.status,
    clueKnown: save.clueKnown,
    outcome: save.outcome,
    echoLineDelivered: save.echoLineDelivered,
  };
  session.loadout = Loadout.restore(save.owned, save.swordId, save.charmId);
  session.progression = Progression.restore(save.xp, save.levelChoice, save.xpAwarded);
  session.restoreCollected(save.collected);
  return session;
}
