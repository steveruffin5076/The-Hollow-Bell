import { describe, expect, it } from "vitest";
import { openingLine } from "./dialogue";
import { acceptQuest, completeQuest, enterTown, findClue, freshStory, objective, resolveGuardian } from "./story";

describe("quest transitions", () => {
  it("accepts once, and a clue found first skips ahead", () => {
    const early = findClue(freshStory());
    expect(early.clueKnown).toBe(true);
    expect(early.status).toBe("not-accepted");
    const accepted = acceptQuest(early);
    expect(accepted.status).toBe("clue-found");
    expect(acceptQuest(accepted)).toBe(accepted);
  });

  it("finding the clue after accepting advances the quest", () => {
    const active = acceptQuest(freshStory());
    expect(active.status).toBe("active");
    const found = findClue(active);
    expect(found.status).toBe("clue-found");
    expect(findClue(found)).toBe(found);
  });

  it("allows a kill without the clue and rejects a second outcome", () => {
    const killed = resolveGuardian(freshStory(), "kill");
    expect(killed.outcome).toBe("kill");
    expect(killed.status).toBe("guardian-resolved");
    expect(resolveGuardian(killed, "spare")).toBe(killed);
  });

  it("rejects spare without the clue", () => {
    expect(resolveGuardian(freshStory(), "spare")).toEqual(freshStory());
  });

  it("spares once, then returns and completes without repeating", () => {
    const ready = findClue(acceptQuest(freshStory()));
    const spared = resolveGuardian(ready, "spare");
    expect(spared.outcome).toBe("spare");
    const back = enterTown(spared);
    expect(back.status).toBe("returned");
    expect(enterTown(back)).toBe(back);
    const done = completeQuest(back);
    expect(done.status).toBe("complete");
    expect(completeQuest(done)).toBe(done);
    expect(resolveGuardian(done, "kill")).toBe(done);
  });

  it("does not complete before the player has returned", () => {
    const killed = resolveGuardian(acceptQuest(freshStory()), "kill");
    expect(completeQuest(killed)).toBe(killed);
  });
});

describe("dialogue", () => {
  it("offers the quest once and stays readable if skipped", () => {
    const first = openingLine("bram", freshStory());
    expect(first?.options.some((o) => o.effect === "accept")).toBe(true);
    const later = openingLine("bram", acceptQuest(freshStory()));
    expect(later?.options.some((o) => o.effect === "accept")).toBe(false);
    expect(later?.text.length).toBeGreaterThan(10);
  });

  it("changes the innkeeper line after the clue", () => {
    const before = openingLine("mara", freshStory());
    const after = openingLine("mara", findClue(freshStory()));
    expect(after?.text).not.toBe(before?.text);
    expect(after?.text.toLowerCase()).toContain("aldren");
  });

  it("hides the watchman until he is spared", () => {
    expect(openingLine("watchman", freshStory())).toBeNull();
    const spared = resolveGuardian(findClue(freshStory()), "spare");
    expect(openingLine("watchman", spared)?.text.length).toBeGreaterThan(10);
  });

  it("gives an objective with no external notes required", () => {
    expect(objective(freshStory())).toMatch(/Bram/i);
    expect(objective(findClue(acceptQuest(freshStory())))).toMatch(/Aldren/);
  });
});
