import { describe, expect, it } from "vitest";
import { ENEMY, PLAYER } from "../data/combatConfig";
import { EnemyMelee } from "./enemy";
import { applySwing, Health, resolveHit, swingCovers, wedgePoints, type Swing } from "./hit";
import { PlayerCombat, type PlayerInput } from "./player";

const STEP = 1 / 60;
const NONE: PlayerInput = {
  moveDir: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  attackPressed: false,
  dodgePressed: false,
  echoPressed: false,
  healPressed: false,
};

function counter(): () => number {
  let n = 0;
  return () => ++n;
}

function makePlayer(): PlayerCombat {
  return new PlayerCombat(1, { x: 0, y: 0 }, counter());
}

function makeEnemy(x = 100, y = 0): EnemyMelee {
  return new EnemyMelee(2, { x, y }, counter());
}

function run(p: PlayerCombat, seconds: number, input: Partial<PlayerInput> = {}, dt = STEP): void {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) p.update(dt, { ...NONE, ...input });
}

function testSwing(attackerId = 1): Swing {
  return {
    id: 1,
    attackerId,
    source: "basic",
    damage: 10,
    origin: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    range: 50,
    arc: (100 * Math.PI) / 180,
    hitTargets: new Set(),
  };
}

describe("swing geometry", () => {
  const s = testSwing();
  it("covers points in front within range", () => {
    expect(swingCovers(s, { x: 30, y: 0 })).toBe(true);
    expect(swingCovers(s, { x: 45, y: 10 })).toBe(true);
  });
  it("misses points beyond range", () => {
    expect(swingCovers(s, { x: 51, y: 0 })).toBe(false);
  });
  it("misses points outside the arc and behind", () => {
    expect(swingCovers(s, { x: 20, y: 40 })).toBe(false);
    expect(swingCovers(s, { x: -20, y: 0 })).toBe(false);
  });
  it("draws a wedge that starts at the origin", () => {
    const pts = wedgePoints({ x: 5, y: 5 }, { x: 1, y: 0 }, 40, 1);
    expect(pts[0]).toEqual({ x: 5, y: 5 });
    expect(pts.length).toBeGreaterThan(3);
  });
});

describe("hit resolution", () => {
  it("hits a target only once per swing", () => {
    const e = makeEnemy(20, 0);
    const s = testSwing();
    const results = [1, 2, 3, 4, 5].map(() => applySwing(s, e, e.pos));
    expect(results[0]).toBe("applied");
    expect(results.slice(1).every((r) => r === "already-hit")).toBe(true);
    expect(e.health.hp).toBe(ENEMY.maxHp - 10);
  });

  it("does not spend the swing when the target is out of reach", () => {
    const e = makeEnemy(200, 0);
    const s = testSwing();
    expect(applySwing(s, e, e.pos)).toBe("out-of-reach");
    expect(s.hitTargets.size).toBe(0);
  });

  it("reports a kill and never hits a dead target", () => {
    const e = makeEnemy(20, 0);
    const big: Swing = { ...testSwing(), damage: 999, hitTargets: new Set() };
    expect(resolveHit(big, e)).toBe("killed");
    const second: Swing = { ...testSwing(), id: 2, hitTargets: new Set() };
    expect(resolveHit(second, e)).toBe("dead");
    expect(e.state).toBe("dead");
  });

  it("ignores the attacker as a target", () => {
    const p = makePlayer();
    expect(resolveHit(testSwing(p.id), p)).toBe("self");
  });

  it("health never goes below zero", () => {
    const h = new Health(10);
    expect(h.damage(50)).toBe(10);
    expect(h.hp).toBe(0);
    expect(h.damage(5)).toBe(0);
  });
});

describe("player attacks", () => {
  it("starts a swing on a press and returns to idle afterwards", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true });
    expect(p.state).toBe("attack");
    run(p, 1);
    expect(p.state).toBe("idle");
  });

  it("exposes the swing only during its active window", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true });
    expect(p.activeSwing).toBeNull(); // windup
    run(p, PLAYER.attacks[0]!.windup + 0.02);
    expect(p.activeSwing).not.toBeNull();
    run(p, PLAYER.attacks[0]!.active + 0.02);
    expect(p.activeSwing).toBeNull(); // recovery
  });

  it("locks aim when the swing begins", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true, aim: { x: 0, y: 1 } });
    run(p, 0.12, { aim: { x: -1, y: 0 } });
    expect(p.activeSwing?.aim).toEqual({ x: 0, y: 1 });
  });

  it("chains exactly one buffered follow-up, never a third swing", () => {
    const p = makePlayer();
    const ids = new Set<number>();
    p.update(STEP, { ...NONE, attackPressed: true });
    if (p.currentSwing) ids.add(p.currentSwing.id);
    // Press many times during the whole fight.
    for (let i = 0; i < 90; i++) {
      p.update(STEP, { ...NONE, attackPressed: i % 3 === 0 });
      if (p.currentSwing) ids.add(p.currentSwing.id);
      if (p.state === "idle" && ids.size >= 2) break;
    }
    expect(ids.size).toBe(2);
  });

  it("limits swings per second even with a press every step", () => {
    const p = makePlayer();
    const ids = new Set<number>();
    for (let i = 0; i < 180; i++) {
      p.update(STEP, { ...NONE, attackPressed: true });
      if (p.currentSwing) ids.add(p.currentSwing.id);
    }
    // 3 seconds. One sequence of two swings plus lockout is longer than 1 second.
    expect(ids.size).toBeGreaterThanOrEqual(2);
    expect(ids.size).toBeLessThanOrEqual(6);
  });

  it("does not repeat damage on a held button (no new press)", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true });
    run(p, 2); // button held but no further press events
    expect(p.state).toBe("idle");
  });

  it("applies a lockout between sequences", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true });
    run(p, 0.1 + 0.1 + 0.18 + 0.01);
    expect(p.state).toBe("idle");
    p.update(STEP, { ...NONE, attackPressed: true });
    expect(p.state).toBe("idle"); // lockout still active
    run(p, 0.2);
    p.update(STEP, { ...NONE, attackPressed: true });
    expect(p.state).toBe("attack");
  });
});

describe("dodge", () => {
  it("is vulnerable at the very start, safe in the middle, vulnerable late", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, dodgePressed: true });
    expect(p.state).toBe("dodge");
    expect(p.isInvulnerable()).toBe(false); // t = 0
    run(p, 0.1);
    expect(p.isInvulnerable()).toBe(true);
    run(p, 0.12); // t ~ 0.22
    expect(p.state).toBe("dodge");
    expect(p.isInvulnerable()).toBe(false);
  });

  it("a hit during the safe window is avoided and the swing is spent", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, dodgePressed: true });
    run(p, 0.1);
    const s = testSwing(99);
    expect(resolveHit(s, p)).toBe("invulnerable");
    run(p, 0.1); // safe window over
    expect(resolveHit(s, p)).toBe("already-hit");
    expect(p.health.hp).toBe(PLAYER.maxHp);
  });

  it("a late dodge can be hit", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, dodgePressed: true });
    run(p, 0.22);
    expect(resolveHit(testSwing(99), p)).toBe("applied");
    expect(p.state).toBe("hurt");
  });

  it("cannot be repeated before the cooldown ends", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, dodgePressed: true });
    run(p, PLAYER.dodge.duration + 0.05);
    expect(p.state).toBe("idle");
    p.update(STEP, { ...NONE, dodgePressed: true });
    expect(p.state).toBe("idle");
    run(p, 0.4);
    p.update(STEP, { ...NONE, dodgePressed: true });
    expect(p.state).toBe("dodge");
  });

  it("is ignored during an attack, and attacks are ignored during a dodge", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true });
    p.update(STEP, { ...NONE, dodgePressed: true });
    expect(p.state).toBe("attack");

    const q = makePlayer();
    q.update(STEP, { ...NONE, dodgePressed: true });
    q.update(STEP, { ...NONE, attackPressed: true });
    expect(q.state).toBe("dodge");
  });

  it("dodges toward the aim when there is no move input", () => {
    const p = makePlayer();
    const v = p.update(STEP, { ...NONE, dodgePressed: true, aim: { x: 0, y: 1 } });
    expect(v.y).toBeGreaterThan(0);
  });
});

describe("hurt and death", () => {
  it("hurt cancels an attack and removes its swing", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, attackPressed: true });
    run(p, 0.12);
    expect(p.activeSwing).not.toBeNull();
    resolveHit(testSwing(99), p);
    expect(p.state).toBe("hurt");
    expect(p.activeSwing).toBeNull();
    expect(p.currentSwing).toBeNull();
  });

  it("is briefly invulnerable after a hit, then returns to idle", () => {
    const p = makePlayer();
    resolveHit(testSwing(99), p);
    expect(resolveHit({ ...testSwing(99), id: 5, hitTargets: new Set() }, p)).toBe("invulnerable");
    run(p, PLAYER.hurtDuration + 0.05);
    expect(p.state).toBe("idle");
    run(p, PLAYER.hurtInvulnerability);
    expect(p.isInvulnerable()).toBe(false);
  });

  it("death disables all combat actions", () => {
    const p = makePlayer();
    resolveHit({ ...testSwing(99), damage: 999 }, p);
    expect(p.state).toBe("dead");
    const v = p.update(STEP, { ...NONE, attackPressed: true, dodgePressed: true, moveDir: { x: 1, y: 0 } });
    expect(v).toEqual({ x: 0, y: 0 });
    expect(p.state).toBe("dead");
    expect(p.activeSwing).toBeNull();
    expect(resolveHit({ ...testSwing(99), id: 9, hitTargets: new Set() }, p)).toBe("dead");
  });

  it("a dead enemy has no swing and does not move", () => {
    const e = makeEnemy(30, 0);
    e.update(STEP, { x: 0, y: 0 }, true);
    resolveHit({ ...testSwing(1), damage: 999 }, e);
    expect(e.state).toBe("dead");
    expect(e.activeSwing).toBeNull();
    expect(e.dangerSwing).toBeNull();
    expect(e.update(STEP, { x: 0, y: 0 }, true)).toEqual({ x: 0, y: 0 });
  });
});

describe("enemy", () => {
  it("runs idle -> chase -> telegraph -> attack -> recover -> chase", () => {
    const e = makeEnemy(100, 0);
    const player = { x: 0, y: 0 };
    const seen: string[] = [];
    const note = (): void => {
      if (seen[seen.length - 1] !== e.state) seen.push(e.state);
    };
    note();
    for (let i = 0; i < 60 * 5; i++) {
      const v = e.update(STEP, player, true);
      e.pos = { x: e.pos.x + v.x * STEP, y: e.pos.y + v.y * STEP };
      note();
      if (seen.length >= 6) break;
    }
    expect(seen.slice(0, 6)).toEqual(["idle", "chase", "telegraph", "attack", "recover", "chase"]);
  });

  it("stays idle when the player is out of aggro range or dead", () => {
    const far = makeEnemy(1000, 0);
    far.update(STEP, { x: 0, y: 0 }, true);
    expect(far.state).toBe("idle");
    const near = makeEnemy(100, 0);
    near.update(STEP, { x: 0, y: 0 }, false);
    expect(near.state).toBe("idle");
  });

  it("only exposes a swing during the active window and hits the player once", () => {
    const player = makePlayer();
    player.pos = { x: 0, y: 0 };
    const e = makeEnemy(30, 0);
    let activeFrames = 0;
    let hits = 0;
    for (let i = 0; i < 60 * 3; i++) {
      e.update(STEP, player.pos, player.alive);
      const sw = e.activeSwing;
      if (sw) {
        activeFrames++;
        const r = applySwing(sw, player, player.pos);
        if (r === "applied" || r === "killed") hits++;
      } else if (e.state === "telegraph") {
        expect(e.activeSwing).toBeNull();
      }
      // Keep the player alive and vulnerable for this check.
      player.update(STEP, NONE);
    }
    expect(activeFrames).toBeGreaterThan(1);
    expect(hits).toBeGreaterThanOrEqual(1);
    // Every enemy swing deals damage at most once.
    expect(player.health.hp).toBeGreaterThan(0);
    expect(PLAYER.maxHp - player.health.hp).toBe(hits * ENEMY.attack.damage);
  });

  it("locks its aim at the start of the telegraph", () => {
    const e = makeEnemy(30, 0);
    e.update(STEP, { x: 0, y: 0 }, true); // idle -> chase
    e.update(STEP, { x: 0, y: 0 }, true); // chase -> telegraph
    expect(e.state).toBe("telegraph");
    const aim = { ...e.aim };
    for (let i = 0; i < 20; i++) e.update(STEP, { x: 30, y: 200 }, true);
    expect(e.aim).toEqual(aim);
  });

  it("goes back to idle if the player dies", () => {
    const e = makeEnemy(100, 0);
    e.update(STEP, { x: 0, y: 0 }, true); // chase
    e.update(STEP, { x: 0, y: 0 }, false);
    expect(e.state).toBe("idle");
  });
});

describe("time-step consistency", () => {
  function timeToIdleAfterAttack(dt: number): number {
    const p = makePlayer();
    p.update(dt, { ...NONE, attackPressed: true });
    let t = 0; // time since the swing started
    while (p.state !== "idle" && t < 5) {
      p.update(dt, NONE);
      t += dt;
    }
    return t;
  }

  function timeUntilSecondDodge(dt: number): number {
    const p = makePlayer();
    p.update(dt, { ...NONE, dodgePressed: true });
    let t = 0; // time since the first dodge started
    let seenIdle = false;
    for (;;) {
      p.update(dt, { ...NONE, dodgePressed: true });
      t += dt;
      if (p.state === "idle") seenIdle = true;
      if (seenIdle && p.state === "dodge") return t;
      if (t > 5) return t;
    }
  }

  it("attack duration is the same at different step sizes", () => {
    const a = PLAYER.attacks[0]!;
    const expected = a.windup + a.active + a.recovery;
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      expect(Math.abs(timeToIdleAfterAttack(dt) - expected)).toBeLessThan(dt + 1e-6);
    }
  });

  it("dodge cooldown ends at the same time at different step sizes", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      expect(Math.abs(timeUntilSecondDodge(dt) - PLAYER.dodge.cooldown)).toBeLessThan(dt * 2 + 1e-6);
    }
  });

  it("enemy telegraph lasts the configured time at different step sizes", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      const e = makeEnemy(30, 0);
      e.update(dt, { x: 0, y: 0 }, true);
      e.update(dt, { x: 0, y: 0 }, true);
      expect(e.state).toBe("telegraph");
      let t = 0;
      while (e.state === "telegraph" && t < 5) {
        e.update(dt, { x: 0, y: 0 }, true);
        t += dt;
      }
      expect(Math.abs(t - ENEMY.telegraph)).toBeLessThan(dt + 1e-6);
    }
  });
});
