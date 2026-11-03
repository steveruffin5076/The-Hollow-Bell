import { describe, expect, it } from "vitest";
import { ECHO, ENEMY, HEAL, PLAYER } from "../data/combatConfig";
import { RewardLedger, tryCollect } from "../progression/rewards";
import { CheckpointState, type CheckpointDef } from "./checkpoint";
import { EchoMeter, EchoStrike } from "./echo";
import { EnemyMelee } from "./enemy";
import { applySwing, resolveHit, type Swing } from "./hit";
import { onPlayerSwingOutcome } from "./outcome";
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

function makeEnemy(x = 60, y = 0): EnemyMelee {
  return new EnemyMelee(2, { x, y }, counter());
}

function run(p: PlayerCombat, seconds: number, input: Partial<PlayerInput> = {}): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) p.update(STEP, { ...NONE, ...input });
}

function swing(source: Swing["source"], damage = 10, attackerId = 99): Swing {
  return {
    id: Math.floor(Math.random() * 1e9),
    attackerId,
    source,
    damage,
    origin: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    range: 80,
    arc: Math.PI,
    hitTargets: new Set(),
  };
}

function fillEcho(p: PlayerCombat): void {
  p.echo.gain(ECHO.max);
}

const STONE: CheckpointDef = {
  id: "stone",
  position: { x: 100, y: 100 },
  anchor: { x: 130, y: 100 },
  interactRange: 48,
};

describe("echo meter", () => {
  it("starts empty and gains", () => {
    const m = new EchoMeter(100);
    expect(m.value).toBe(0);
    expect(m.gain(30)).toBe(30);
    expect(m.value).toBe(30);
  });

  it("clamps to the maximum", () => {
    const m = new EchoMeter(100);
    m.gain(70);
    expect(m.gain(70)).toBe(30);
    expect(m.value).toBe(100);
    expect(m.full).toBe(true);
    expect(m.gain(10)).toBe(0);
  });

  it("ignores zero and negative gain", () => {
    const m = new EchoMeter(100);
    expect(m.gain(0)).toBe(0);
    expect(m.gain(-5)).toBe(0);
    expect(m.value).toBe(0);
  });

  it("spends only when full, and only once", () => {
    const m = new EchoMeter(100);
    m.gain(99);
    expect(m.spend()).toBe(false);
    expect(m.value).toBe(99);
    m.gain(1);
    expect(m.spend()).toBe(true);
    expect(m.value).toBe(0);
    expect(m.spend()).toBe(false);
  });
});

describe("echo gain rules", () => {
  it("a basic hit gives Echo", () => {
    const p = makePlayer();
    const e = makeEnemy();
    const ledger = new RewardLedger();
    const s = swing("basic", 10, p.id);
    const outcome = resolveHit(s, e);
    onPlayerSwingOutcome(p, ledger, s, outcome);
    expect(p.echo.value).toBe(ECHO.gainPerBasicHit);
  });

  it("a miss, an already-hit target, or an invulnerable target gives nothing", () => {
    const p = makePlayer();
    const ledger = new RewardLedger();
    const e = makeEnemy(500, 0);
    const s = swing("basic", 10, p.id);
    onPlayerSwingOutcome(p, ledger, s, applySwing(s, e, e.pos)); // out of reach
    expect(p.echo.value).toBe(0);

    const near = makeEnemy(40, 0);
    const s2 = swing("basic", 10, p.id);
    onPlayerSwingOutcome(p, ledger, s2, resolveHit(s2, near));
    const after = p.echo.value;
    onPlayerSwingOutcome(p, ledger, s2, resolveHit(s2, near)); // already-hit
    expect(p.echo.value).toBe(after);

    // A different actor that is mid-dodge (the player's swing can reach it, but it is invulnerable).
    const dodging = new PlayerCombat(7, { x: 0, y: 0 }, counter());
    dodging.update(STEP, { ...NONE, dodgePressed: true });
    run(dodging, 0.1);
    const s3 = swing("basic", 10, p.id);
    const o3 = resolveHit(s3, dodging);
    expect(o3).toBe("invulnerable");
    const before = p.echo.value;
    onPlayerSwingOutcome(p, ledger, s3, o3);
    expect(p.echo.value).toBe(before);
  });

  it("Echo hits and enemy hits never give Echo", () => {
    const p = makePlayer();
    const ledger = new RewardLedger();
    const e = makeEnemy(40, 0);
    const echoSwing = swing("echo", 35, p.id);
    onPlayerSwingOutcome(p, ledger, echoSwing, resolveHit(echoSwing, e));
    expect(p.echo.value).toBe(0);
    const enemySwing = swing("enemy", 5, e.id);
    onPlayerSwingOutcome(p, ledger, enemySwing, "applied");
    expect(p.echo.value).toBe(0);
  });

  it("the meter never exceeds its maximum from repeated hits", () => {
    const p = makePlayer();
    const ledger = new RewardLedger();
    for (let i = 0; i < 10; i++) {
      onPlayerSwingOutcome(p, ledger, swing("basic", 1, p.id), "applied");
    }
    expect(p.echo.value).toBe(ECHO.max);
  });
});

describe("echo strike activation", () => {
  it("cannot be activated with an empty or partial meter", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, echoPressed: true });
    expect(p.state).toBe("idle");
    expect(p.echoStrike).toBeNull();
    p.echo.gain(ECHO.max - 1);
    p.update(STEP, { ...NONE, echoPressed: true });
    expect(p.state).toBe("idle");
    expect(p.echoStrike).toBeNull();
    expect(p.echo.value).toBe(ECHO.max - 1);
  });

  it("a full meter fires once, spends the meter, and creates one strike", () => {
    const p = makePlayer();
    fillEcho(p);
    p.update(STEP, { ...NONE, echoPressed: true });
    expect(p.state).toBe("cast");
    expect(p.echo.value).toBe(0);
    const strike = p.echoStrike;
    expect(strike).not.toBeNull();
    // Pressing again does nothing: meter is empty and a strike is in flight.
    run(p, ECHO.castDuration + 0.05, { echoPressed: true });
    expect(p.echoStrike).toBe(strike);
  });

  it("does not fire a second strike even if the meter refills while one is in flight", () => {
    const p = makePlayer();
    fillEcho(p);
    p.update(STEP, { ...NONE, echoPressed: true });
    const first = p.echoStrike;
    run(p, ECHO.castDuration + 0.05);
    fillEcho(p);
    p.update(STEP, { ...NONE, echoPressed: true });
    expect(p.echoStrike).toBe(first);
    expect(p.echo.value).toBe(ECHO.max);
  });

  it("locks the aim and places the slash ahead of the player", () => {
    const p = makePlayer();
    fillEcho(p);
    p.update(STEP, { ...NONE, echoPressed: true, aim: { x: 0, y: 1 } });
    const s = p.echoStrike!.swing;
    expect(s.aim).toEqual({ x: 0, y: 1 });
    expect(s.origin.y).toBeCloseTo(ECHO.spawnDistance, 9);
    expect(s.source).toBe("echo");
  });
});

describe("echo strike timing", () => {
  function makeStrike(): EchoStrike {
    return new EchoStrike(swing("echo", 35, 1), ECHO.delay, ECHO.active);
  }

  it("is harmless while pending, hits during its active window, then ends", () => {
    const s = makeStrike();
    for (let t = 0; t < ECHO.delay - 0.05; t += STEP) {
      s.update(STEP);
      expect(s.activeSwing).toBeNull();
    }
    let activeSteps = 0;
    for (let t = 0; t < 0.5; t += STEP) {
      s.update(STEP);
      if (s.activeSwing) activeSteps++;
    }
    expect(activeSteps).toBeGreaterThan(0);
    expect(s.state).toBe("done");
    expect(s.activeSwing).toBeNull();
  });

  it("damages a target exactly once however many steps it is active", () => {
    const e = makeEnemy(60, 0);
    const s = new EchoStrike({ ...swing("echo", 35, 1), origin: { x: 40, y: 0 } }, 0.1, 0.2);
    let hits = 0;
    for (let i = 0; i < 60; i++) {
      s.update(STEP);
      const sw = s.activeSwing;
      if (sw) {
        const r = applySwing(sw, e, e.pos);
        if (r === "applied" || r === "killed") hits++;
      }
    }
    expect(hits).toBe(1);
    expect(e.health.hp).toBe(ENEMY.maxHp - 35);
  });

  it("a cancelled strike never hits", () => {
    const s = makeStrike();
    s.update(STEP);
    s.cancel();
    expect(s.state).toBe("cancelled");
    for (let i = 0; i < 120; i++) {
      s.update(STEP);
      expect(s.activeSwing).toBeNull();
    }
  });

  it("is the same at different step sizes", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      const s = makeStrike();
      let t = 0;
      while (!s.activeSwing && t < 5) {
        s.update(dt);
        t += dt;
      }
      expect(Math.abs(t - ECHO.delay)).toBeLessThan(dt + 1e-6);
    }
  });
});

describe("echo strike cleanup", () => {
  function pendingPlayer(): PlayerCombat {
    const p = makePlayer();
    fillEcho(p);
    p.update(STEP, { ...NONE, echoPressed: true });
    run(p, 0.3);
    return p;
  }

  it("is cancelled when the player dies before it lands", () => {
    const p = pendingPlayer();
    const strike = p.echoStrike!;
    expect(strike.state).toBe("pending");
    resolveHit(swing("enemy", 999), p);
    expect(p.state).toBe("dead");
    expect(p.echoStrike).toBeNull();
    expect(strike.state).toBe("cancelled");
    run(p, 2);
    expect(strike.activeSwing).toBeNull();
  });

  it("is cancelled on respawn or rest, so there is no ghost damage next run", () => {
    const p = pendingPlayer();
    const strike = p.echoStrike!;
    p.restoreFull();
    expect(p.echoStrike).toBeNull();
    expect(strike.state).toBe("cancelled");
    run(p, 2);
    expect(strike.activeSwing).toBeNull();
  });

  it("keeps flying if the player is only hurt", () => {
    const p = pendingPlayer();
    resolveHit(swing("enemy", 10), p);
    expect(p.state).toBe("hurt");
    expect(p.echoStrike?.state).toBe("pending");
  });

  it("does not damage an enemy that died before it landed", () => {
    const p = pendingPlayer();
    const e = makeEnemy(40, 0);
    resolveHit({ ...swing("basic", 999, p.id) }, e);
    const strike = p.echoStrike!;
    let result = "none";
    for (let i = 0; i < 120; i++) {
      p.update(STEP, NONE);
      const sw = strike.activeSwing;
      if (sw) result = applySwing(sw, e, e.pos);
    }
    expect(result).toBe("dead");
    expect(e.health.hp).toBe(0);
  });
});

describe("healing", () => {
  function hurtPlayer(damage = 50): PlayerCombat {
    const p = makePlayer();
    p.health.damage(damage);
    return p;
  }

  it("starts with the maximum number of charges", () => {
    expect(makePlayer().healCharges).toBe(HEAL.maxCharges);
  });

  it("cannot be used at full health, and costs nothing", () => {
    const p = makePlayer();
    p.update(STEP, { ...NONE, healPressed: true });
    expect(p.state).toBe("idle");
    expect(p.healCharges).toBe(HEAL.maxCharges);
  });

  it("cannot be used with no charges", () => {
    const p = hurtPlayer();
    p.healCharges = 0;
    p.update(STEP, { ...NONE, healPressed: true });
    expect(p.state).toBe("idle");
    expect(p.health.hp).toBe(PLAYER.maxHp - 50);
  });

  it("commits the player for the heal duration, then heals and spends one charge", () => {
    const p = hurtPlayer();
    p.update(STEP, { ...NONE, healPressed: true });
    expect(p.state).toBe("heal");
    expect(p.update(STEP, { ...NONE, moveDir: { x: 1, y: 0 } })).toEqual({ x: 0, y: 0 });
    run(p, HEAL.duration * 0.5);
    expect(p.state).toBe("heal");
    expect(p.health.hp).toBe(PLAYER.maxHp - 50);
    expect(p.healCharges).toBe(HEAL.maxCharges);
    run(p, HEAL.duration * 0.5 + 0.05);
    expect(p.state).toBe("idle");
    expect(p.health.hp).toBe(PLAYER.maxHp - 50 + HEAL.amount);
    expect(p.healCharges).toBe(HEAL.maxCharges - 1);
  });

  it("never heals above the maximum", () => {
    const p = hurtPlayer(10);
    p.update(STEP, { ...NONE, healPressed: true });
    run(p, HEAL.duration + 0.05);
    expect(p.health.hp).toBe(PLAYER.maxHp);
    expect(p.healCharges).toBe(HEAL.maxCharges - 1);
  });

  it("a hit interrupts the heal and costs no charge", () => {
    const p = hurtPlayer();
    p.update(STEP, { ...NONE, healPressed: true });
    run(p, 0.2);
    resolveHit(swing("enemy", 10), p);
    expect(p.state).toBe("hurt");
    run(p, HEAL.duration + 0.5);
    expect(p.healCharges).toBe(HEAL.maxCharges);
    expect(p.health.hp).toBe(PLAYER.maxHp - 50 - 10);
  });

  it("a holding heal key cannot drain charges: charges only drop per completed heal", () => {
    const p = hurtPlayer(90);
    for (let i = 0; i < 60 * 6; i++) p.update(STEP, { ...NONE, healPressed: true });
    expect(p.healCharges).toBeGreaterThanOrEqual(0);
    expect(p.health.hp).toBeLessThanOrEqual(PLAYER.maxHp);
    expect(HEAL.maxCharges - p.healCharges).toBeLessThanOrEqual(3);
  });

  it("a dead player cannot heal", () => {
    const p = hurtPlayer();
    resolveHit(swing("enemy", 999), p);
    p.update(STEP, { ...NONE, healPressed: true });
    expect(p.state).toBe("dead");
    expect(p.healCharges).toBe(HEAL.maxCharges);
  });
});

describe("checkpoint rest", () => {
  function setup(): { p: PlayerCombat; e: EnemyMelee; cp: CheckpointState } {
    const p = makePlayer();
    p.pos = { x: 110, y: 100 };
    const e = makeEnemy(300, 300);
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    return { p, e, cp };
  }

  it("restores health, charges and clears Echo, and commits the anchor", () => {
    const { p, e, cp } = setup();
    p.health.damage(70);
    p.healCharges = 0;
    p.echo.gain(60);
    expect(cp.rest(STONE, p, [e])).toBe(true);
    expect(p.health.hp).toBe(PLAYER.maxHp);
    expect(p.healCharges).toBe(HEAL.maxCharges);
    expect(p.echo.value).toBe(0);
    expect(cp.committedId).toBe("stone");
    expect(cp.committedAnchor).toEqual(STONE.anchor);
    expect(p.pos).toEqual({ x: 110, y: 100 }); // not moved
  });

  it("resets enemies, including a dead one", () => {
    const { p, e, cp } = setup();
    e.pos = { x: 10, y: 10 };
    resolveHit(swing("basic", 999, p.id), e);
    expect(e.state).toBe("dead");
    cp.rest(STONE, p, [e]);
    expect(e.state).toBe("idle");
    expect(e.health.hp).toBe(ENEMY.maxHp);
    expect(e.pos).toEqual({ x: 300, y: 300 });
    expect(e.activeSwing).toBeNull();
  });

  it("cancels a pending Echo Strike", () => {
    const { p, e, cp } = setup();
    fillEcho(p);
    p.update(STEP, { ...NONE, echoPressed: true });
    run(p, ECHO.castDuration + 0.05);
    const strike = p.echoStrike!;
    cp.rest(STONE, p, [e]);
    expect(strike.state).toBe("cancelled");
    expect(p.echoStrike).toBeNull();
  });

  it("is refused when too far, mid-attack, hurt, or dead", () => {
    const { p, e, cp } = setup();
    p.pos = { x: 400, y: 400 };
    expect(cp.rest(STONE, p, [e])).toBe(false);
    p.pos = { x: 110, y: 100 };
    p.update(STEP, { ...NONE, attackPressed: true });
    expect(p.state).toBe("attack");
    expect(cp.rest(STONE, p, [e])).toBe(false);
    const q = makePlayer();
    q.pos = { x: 110, y: 100 };
    resolveHit(swing("enemy", 10), q);
    expect(cp.rest(STONE, q, [e])).toBe(false);
    resolveHit({ ...swing("enemy", 999), id: 12345 }, q);
    q.state = "dead";
    expect(cp.rest(STONE, q, [e])).toBe(false);
    expect(cp.committedId).toBe("start");
  });

  it("a refused rest changes nothing", () => {
    const { p, e, cp } = setup();
    p.pos = { x: 400, y: 400 };
    p.health.damage(30);
    cp.rest(STONE, p, [e]);
    expect(p.health.hp).toBe(PLAYER.maxHp - 30);
  });
});

describe("death and respawn", () => {
  it("returns the player to the latest committed checkpoint with full state", () => {
    const p = makePlayer();
    p.pos = { x: 110, y: 100 };
    const e = makeEnemy(300, 300);
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    cp.rest(STONE, p, [e]);

    p.pos = { x: 250, y: 250 };
    p.health.damage(40);
    p.healCharges = 1;
    p.echo.gain(80);
    resolveHit(swing("enemy", 999), p);
    expect(p.state).toBe("dead");

    cp.respawn(p, [e]);
    expect(p.state).toBe("idle");
    expect(p.pos).toEqual(STONE.anchor);
    expect(p.health.hp).toBe(PLAYER.maxHp);
    expect(p.healCharges).toBe(HEAL.maxCharges);
    expect(p.echo.value).toBe(0);
    expect(e.health.hp).toBe(ENEMY.maxHp);
  });

  it("uses the start anchor if no checkpoint was ever rested at", () => {
    const p = makePlayer();
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    resolveHit(swing("enemy", 999), p);
    cp.respawn(p, []);
    expect(p.pos).toEqual({ x: 5, y: 5 });
  });

  it("a respawned player can act again and takes damage normally", () => {
    const p = makePlayer();
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    resolveHit(swing("enemy", 999), p);
    cp.respawn(p, []);
    p.update(STEP, { ...NONE, attackPressed: true });
    expect(p.state).toBe("attack");
    expect(p.isInvulnerable()).toBe(false);
  });

  it("repeated death and respawn leaves no stale timers", () => {
    const p = makePlayer();
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    for (let i = 0; i < 3; i++) {
      fillEcho(p);
      p.update(STEP, { ...NONE, echoPressed: true });
      resolveHit(swing("enemy", 999), p);
      cp.respawn(p, []);
      expect(p.echoStrike).toBeNull();
      expect(p.state).toBe("idle");
    }
  });
});

describe("persistent rewards", () => {
  it("grants an id only once", () => {
    const l = new RewardLedger();
    expect(l.grant("a")).toBe(true);
    expect(l.grant("a")).toBe(false);
    expect(l.tokens).toBe(1);
  });

  it("a kill reward is granted once, even if the enemy is killed again after a rest", () => {
    const p = makePlayer();
    const e = makeEnemy(40, 0);
    const l = new RewardLedger();
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    p.pos = { x: 110, y: 100 };

    const first = swing("basic", 999, p.id);
    onPlayerSwingOutcome(p, l, first, resolveHit(first, e), "kill");
    expect(l.tokens).toBe(1);

    cp.rest(STONE, p, [e]);
    expect(e.health.hp).toBe(ENEMY.maxHp);

    const second = swing("basic", 999, p.id);
    onPlayerSwingOutcome(p, l, second, resolveHit(second, e), "kill");
    expect(e.state).toBe("dead");
    expect(l.tokens).toBe(1);
  });

  it("rest and death never remove collected rewards", () => {
    const p = makePlayer();
    const l = new RewardLedger();
    const cp = new CheckpointState("start", { x: 5, y: 5 });
    l.grant("x");
    p.pos = { x: 110, y: 100 };
    cp.rest(STONE, p, []);
    resolveHit(swing("enemy", 999), p);
    cp.respawn(p, []);
    expect(l.has("x")).toBe(true);
    expect(l.tokens).toBe(1);
  });

  it("a pickup is collected once and stays collected", () => {
    const l = new RewardLedger();
    const pickup = { id: "p1", position: { x: 50, y: 50 }, radius: 14 };
    expect(tryCollect(l, pickup, { x: 200, y: 200 })).toBe(false);
    expect(tryCollect(l, pickup, { x: 55, y: 50 })).toBe(true);
    expect(tryCollect(l, pickup, { x: 55, y: 50 })).toBe(false);
    expect(l.tokens).toBe(1);
  });

  it("a kill with Echo Strike also counts once", () => {
    const p = makePlayer();
    const e = makeEnemy(40, 0);
    const l = new RewardLedger();
    const s = swing("echo", 999, p.id);
    onPlayerSwingOutcome(p, l, s, resolveHit(s, e), "kill");
    expect(l.tokens).toBe(1);
    expect(p.echo.value).toBe(0);
  });
});
