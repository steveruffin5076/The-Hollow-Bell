import { describe, expect, it } from "vitest";
import { BOSS, FIXED_STEP } from "../data/combatConfig";
import { Boss } from "./boss";
import { Bolt } from "./bolt";
import { EnemyArcher } from "./archer";
import { Health, swingCovers, type Hittable, type Swing } from "./hit";

const dt = FIXED_STEP;

function steps(n: number, fn: () => void): void {
  for (let i = 0; i < n; i++) fn();
}

describe("archer and bolts", () => {
  it("telegraphs, fires one bolt, and the bolt expires", () => {
    const archer = new EnemyArcher(3, { x: 0, y: 0 }, () => 1);
    const player = { x: 140, y: 0 };
    let bolt: Bolt | null = null;
    steps(180, () => {
      archer.update(dt, player, true);
      bolt = bolt ?? archer.takeBolt();
    });
    expect(bolt).not.toBeNull();
    const fired = bolt as unknown as Bolt;
    steps(200, () => fired.update(dt));
    expect(fired.alive).toBe(false);
  });

  it("a bolt hits a target once", () => {
    const bolt = new Bolt(9, { x: 0, y: 0 }, { x: 1, y: 0 }, 12, 8, 2);
    const hits: string[] = [];
    const target: Hittable = {
      id: 1,
      health: new Health(20),
      isInvulnerable: () => false,
      receiveHit: () => {
        hits.push("hit");
      },
    };
    expect(swingCovers(bolt.swing, { x: 0, y: 0 })).toBe(true);
    bolt.tryHit(target);
    bolt.tryHit(target);
    expect(hits).toEqual(["hit"]);
    expect(bolt.alive).toBe(false);
  });

  it("reset drops a pending bolt", () => {
    const archer = new EnemyArcher(3, { x: 0, y: 0 }, () => 1);
    steps(180, () => archer.update(dt, { x: 140, y: 0 }, true));
    archer.reset();
    expect(archer.takeBolt()).toBeNull();
    expect(archer.alive).toBe(true);
    expect(archer.state).toBe("idle");
  });
});

describe("kneeling watchman", () => {
  const origin = { x: 0, y: 0 };

  it("cycles overhead, sweep, and thrust", () => {
    const boss = new Boss(4, origin, () => 1);
    boss.setClueKnown(false);
    const seen: string[] = [];
    const player = { x: 40, y: 0 };
    steps(500, () => {
      boss.update(dt, player, true);
      if (boss.state === "telegraph" && !seen.includes(boss.patternId)) seen.push(boss.patternId);
    });
    expect(seen.slice(0, 3)).toEqual(["overhead", "sweep", "thrust"]);
  });

  it("opens the choice once at the health threshold when the clue is known", () => {
    const boss = new Boss(4, origin, () => 1);
    boss.setClueKnown(true);
    boss.receiveHit(BOSS.maxHp - BOSS.thresholdHp, dummySwing());
    expect(boss.health.hp).toBe(BOSS.thresholdHp);
    expect(boss.state).toBe("choice");
    steps(30, () => boss.update(dt, { x: 40, y: 0 }, true));
    expect(boss.state).toBe("choice");
    expect(boss.dangerSwing).toBeNull();
    boss.decline();
    expect(boss.state).toBe("recover");
    boss.receiveHit(10, dummySwing());
    expect(boss.state).not.toBe("choice");
  });

  it("does not offer the choice without the clue or after death", () => {
    const blind = new Boss(4, origin, () => 1);
    blind.receiveHit(BOSS.thresholdHp, dummySwing());
    expect(blind.state).not.toBe("choice");

    const boss = new Boss(4, origin, () => 1);
    boss.setClueKnown(true);
    boss.receiveHit(BOSS.maxHp, dummySwing());
    expect(boss.state).toBe("dead");
    expect(boss.health.alive).toBe(false);
  });

  it("reset clears the choice and restores health", () => {
    const boss = new Boss(4, origin, () => 1);
    boss.setClueKnown(true);
    boss.receiveHit(BOSS.thresholdHp, dummySwing());
    expect(boss.state).toBe("choice");
    boss.reset();
    expect(boss.state).toBe("idle");
    expect(boss.health.hp).toBe(BOSS.maxHp);
  });
});

function dummySwing(): Swing {
  return {
    id: 1,
    attackerId: 1,
    source: "basic" as const,
    damage: 1,
    origin: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    range: 10,
    arc: 1,
    hitTargets: new Set<number>(),
  };
}
