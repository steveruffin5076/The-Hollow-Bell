import { describe, expect, it } from "vitest";
import { ITEMS } from "../data/content";
import { Loadout, computeMods } from "./loadout";
import { Progression } from "./xp";

describe("equipment", () => {
  it("starts with Grave Iron and no charm", () => {
    const loadout = new Loadout();
    expect(loadout.swordId).toBe("grave-iron");
    expect(loadout.charmId).toBeNull();
    expect(loadout.owns("grave-iron")).toBe(true);
    expect(loadout.owns("aldrens-blade")).toBe(false);
  });

  it("rejects equipping an item you do not own", () => {
    const loadout = new Loadout();
    expect(loadout.equip("aldrens-blade")).toBe(false);
    expect(loadout.swordId).toBe("grave-iron");
  });

  it("equips a sword and a charm without stacking stats", () => {
    const loadout = new Loadout();
    expect(loadout.own("aldrens-blade")).toBe(true);
    expect(loadout.own("aldrens-blade")).toBe(false);
    expect(loadout.own("ash-ward")).toBe(true);
    expect(loadout.equip("aldrens-blade")).toBe(true);
    expect(loadout.equip("ash-ward")).toBe(true);
    const once = computeMods(loadout.swordId, loadout.charmId, null);
    loadout.equip("aldrens-blade");
    loadout.equip("ash-ward");
    const twice = computeMods(loadout.swordId, loadout.charmId, null);
    expect(twice).toEqual(once);
    expect(once.damageFlat).toBe(ITEMS["aldrens-blade"]?.damageFlat);
    expect(once.incomingReduction).toBe(ITEMS["ash-ward"]?.incomingReduction);
  });

  it("swapping back restores the previous stats", () => {
    const loadout = new Loadout();
    loadout.own("aldrens-blade");
    loadout.own("ash-ward");
    loadout.own("watchmans-vow");
    loadout.equip("aldrens-blade");
    loadout.equip("ash-ward");
    loadout.equip("grave-iron");
    loadout.equip("watchmans-vow");
    const mods = computeMods(loadout.swordId, loadout.charmId, null);
    expect(loadout.swordId).toBe("grave-iron");
    expect(mods.damageFlat).toBe(0);
    expect(mods.healBonus).toBe(ITEMS["watchmans-vow"]?.healBonus);
    expect(mods.incomingReduction).toBe(0);
  });

  it("recomputes the same mods every time", () => {
    const a = computeMods("grave-iron", null, "damage");
    const b = computeMods("grave-iron", null, "damage");
    expect(a).toEqual(b);
    expect(a.damageFlat).toBe(4);
    expect(computeMods("grave-iron", null, "echo").echoGainFlat).toBe(20);
    expect(computeMods("grave-iron", "ash-ward", null).incomingReduction).toBe(4);
  });
});

describe("experience", () => {
  it("awards unique enemy XP once", () => {
    const xp = new Progression();
    expect(xp.grant("yard-wraith", 20)).toEqual({ gained: true, ready: false });
    expect(xp.grant("yard-wraith", 20)).toEqual({ gained: false, ready: false });
    expect(xp.total).toBe(20);
  });

  it("offers one level-up and applies the choice once", () => {
    const xp = new Progression();
    xp.grant("yard-wraith", 20);
    xp.grant("tower-archer", 20);
    expect(xp.ready).toBe(true);
    expect(xp.choose("health")).toBe(true);
    expect(xp.choose("damage")).toBe(false);
    expect(xp.choice).toBe("health");
    expect(xp.ready).toBe(false);
    xp.grant("kneeling-watchman", 20);
    expect(xp.total).toBe(60);
    expect(xp.ready).toBe(false);
  });

  it("refuses a choice before the threshold", () => {
    const xp = new Progression();
    expect(xp.choose("echo")).toBe(false);
    expect(xp.choice).toBeNull();
  });
});
