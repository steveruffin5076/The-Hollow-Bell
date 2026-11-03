import { describe, expect, it } from "vitest";
import { ARCHER, ENEMY } from "../data/combatConfig";
import { MAPS, anchorFor } from "../data/world";
import { beginNewGame, freshSession, getActiveSession, persistActive, sessionFromSave, setActiveSession } from "../game/session";
import { MemoryStorage, loadSave, loadSettings, saveSettings, writeSave } from "./save";

describe("saves", () => {
  it("round-trips a session", () => {
    const session = freshSession();
    session.acceptQuest();
    session.findClue();
    session.own("ash-ward");
    session.equip("ash-ward");
    session.grantXp("yard-wraith", 20);
    session.grantXp("tower-archer", 20);
    expect(session.progression.ready).toBe(true);
    expect(session.chooseLevel("damage")).toBe(true);
    session.travel("watchtower");
    const storage = new MemoryStorage();
    expect(writeSave(storage, session.toSave()).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const again = sessionFromSave(loaded.save);
    expect(again.toSave()).toEqual(session.toSave());
    expect(again.progression.choice).toBe("damage");
    expect(again.progression.total).toBe(40);
    expect(again.grantXp("yard-wraith", 20).gained).toBe(false);
  });

  it("returns from the watchtower beside that door, not the town door", () => {
    const session = freshSession();
    session.travel("approach", "approach-tower");
    expect(session.map).toBe("approach");
    expect(session.checkpointId).toBe("approach-tower");
    const arrived = anchorFor(session.checkpointId);
    const townDoor = anchorFor("approach-road");
    expect(arrived.x).toBeGreaterThan(townDoor.x + 64);
    const storage = new MemoryStorage();
    expect(writeSave(storage, session.toSave()).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(sessionFromSave(loaded.save).checkpointId).toBe("approach-tower");
  });

  it("keeps both endings stable across a reload", () => {
    for (const outcome of ["kill", "spare"] as const) {
      const session = freshSession();
      session.findClue();
      session.travel("watchtower");
      expect(session.resolve(outcome)).toBe(true);
      expect(session.resolve(outcome === "kill" ? "spare" : "kill")).toBe(false);
      const storage = new MemoryStorage();
      writeSave(storage, session.toSave());
      const loaded = loadSave(storage);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      const again = sessionFromSave(loaded.save);
      expect(again.story.outcome).toBe(outcome);
      expect(again.owns(outcome === "kill" ? "aldrens-blade" : "watchmans-vow")).toBe(true);
      expect(again.owns(outcome === "kill" ? "watchmans-vow" : "aldrens-blade")).toBe(false);
      expect(again.resolve("kill")).toBe(false);
    }
  });

  it("backs up a malformed save and does not overwrite it", () => {
    const storage = new MemoryStorage();
    storage.setItem("hollow-bell-save", "{not json");
    const loaded = loadSave(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.reason).toBe("malformed");
    expect(storage.getItem("hollow-bell-save")).toBe("{not json");
    expect(storage.getItem("hollow-bell-save-backup")).toBe("{not json");
  });

  it("rejects an unsupported version and an impossible reward pair", () => {
    const storage = new MemoryStorage();
    storage.setItem("hollow-bell-save", JSON.stringify({ version: 99 }));
    const old = loadSave(storage);
    expect(old.ok).toBe(false);
    if (!old.ok) expect(old.reason).toBe("unsupported");

    const session = freshSession();
    const broken = session.toSave();
    broken.owned.push("aldrens-blade", "watchmans-vow");
    storage.setItem("hollow-bell-save", JSON.stringify(broken));
    const bad = loadSave(storage);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("invalid");
  });

  it("reports blocked storage without throwing", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const result = writeSave(storage, freshSession().toSave());
    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("persists settings separately from the game save", () => {
    const storage = new MemoryStorage();
    saveSettings(storage, { master: 0.2, muted: true, shake: false, reducedFlash: true });
    expect(loadSettings(storage)).toEqual({ master: 0.2, muted: true, shake: false, reducedFlash: true });
    expect(storage.getItem("hollow-bell-save")).toBeNull();
  });
});

describe("road rest stone", () => {
  it("can be used from any side without waking the wraith or the archer", () => {
    const { checkpoint, melee, archers, doors } = MAPS.approach;
    const spawns = [
      ...melee.map((spawn) => ({ pos: spawn.pos, aggro: ENEMY.aggroRange })),
      ...archers.map((spawn) => ({ pos: spawn.pos, aggro: ARCHER.aggroRange })),
    ];
    for (const foe of spawns) {
      const centre = Math.hypot(foe.pos.x - checkpoint.position.x, foe.pos.y - checkpoint.position.y);
      // The closest point the player can rest from is interactRange nearer to the enemy.
      expect(centre - checkpoint.interactRange).toBeGreaterThan(foe.aggro);
    }
    for (const door of doors) {
      const gap = Math.hypot(door.pos.x - checkpoint.position.x, door.pos.y - checkpoint.position.y);
      expect(gap).toBeGreaterThan(door.range + checkpoint.interactRange);
    }
  });
});

describe("new game", () => {
  it("erases the slot and the backup, keeps settings, and writes nothing until a save point", () => {
    const storage = new MemoryStorage();
    const old = freshSession();
    old.grantXp("yard-wraith", 40);
    writeSave(storage, old.toSave());
    storage.setItem("hollow-bell-save-backup", "{not json");
    saveSettings(storage, { master: 0.7, muted: true, shake: false, reducedFlash: true });

    const session = beginNewGame(storage);
    expect(getActiveSession()).toBe(session);
    expect(session.progression.total).toBe(0);
    expect(session.storageWarning).toBe(false);
    expect(storage.getItem("hollow-bell-save")).toBeNull();
    expect(storage.getItem("hollow-bell-save-backup")).toBeNull();
    expect(loadSave(storage)).toEqual({ ok: false, reason: "empty" });
    expect(loadSettings(storage).muted).toBe(true);

    persistActive(storage);
    expect(loadSave(storage).ok).toBe(true);
  });

  it("warns when there is no storage and still starts", () => {
    setActiveSession(freshSession());
    const session = beginNewGame(null);
    expect(session.storageWarning).toBe(true);
    expect(getActiveSession()).toBe(session);
  });
});
