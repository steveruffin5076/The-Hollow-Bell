import type { Vec2 } from "../core/projection";
import { BOSS } from "../data/combatConfig";
import { Health, type Hittable, type Swing } from "./hit";

export type BossState = "idle" | "chase" | "telegraph" | "attack" | "recover" | "choice" | "spared" | "dead";

const ZERO: Vec2 = { x: 0, y: 0 };

/**
 * The Kneeling Watchman.
 * Attacks cycle overhead, sweep, rushing thrust.
 * At the health threshold, if the clue is known and no outcome is committed,
 * he stops once and waits for the choice. Decline resumes the fight.
 * reset() is a full restore, including the choice, so a death can offer it again.
 * A spared or defeated Watchman is settled: reset() leaves him as he is, so a rest
 * in the tower cannot bring him back after the outcome is committed.
 */
export class Boss implements Hittable {
  readonly health = new Health(BOSS.maxHp);
  pos: Vec2;
  state: BossState = "idle";
  stateTime = 0;
  aim: Vec2 = { x: 1, y: 0 };
  flash = 0;

  private pattern = 0;
  private swing: Swing | null = null;
  private clueKnown = false;
  private offered = false;
  private readonly spawn: Vec2;

  constructor(
    readonly id: number,
    pos: Vec2,
    private readonly nextSwingId: () => number,
  ) {
    this.pos = { ...pos };
    this.spawn = { ...pos };
  }

  setClueKnown(known: boolean): void {
    this.clueKnown = known;
  }

  get patternId(): string {
    return BOSS.attacks[this.pattern]?.id ?? "overhead";
  }

  get alive(): boolean {
    return this.health.alive && this.state !== "spared";
  }

  /** True once he is spared or dead. The outcome is committed at that moment. */
  get settled(): boolean {
    return this.state === "spared" || this.state === "dead";
  }

  reset(): void {
    if (this.settled) return;
    this.health.restore();
    this.pos = { ...this.spawn };
    this.swing = null;
    this.flash = 0;
    this.pattern = 0;
    this.offered = false;
    this.aim = { x: 1, y: 0 };
    this.enter("idle");
  }

  /** Leaves the fight without dying. The scene grants the spare reward. */
  spare(): void {
    this.swing = null;
    this.enter("spared");
  }

  decline(): void {
    if (this.state !== "choice") return;
    this.enter("recover");
  }

  get activeSwing(): Swing | null {
    const atk = BOSS.attacks[this.pattern];
    if (this.state !== "attack" || !this.swing || !atk) return null;
    return this.stateTime < atk.active ? this.swing : null;
  }

  get dangerSwing(): Swing | null {
    return this.state === "telegraph" || this.state === "attack" ? this.swing : null;
  }

  get telegraphProgress(): number {
    const atk = BOSS.attacks[this.pattern];
    if (this.state !== "telegraph" || !atk) return 0;
    return Math.min(1, this.stateTime / atk.telegraph);
  }

  isInvulnerable(): boolean {
    return this.state === "choice" || this.state === "spared";
  }

  receiveHit(damage: number, _swing: Swing): void {
    if (this.state === "dead" || this.state === "spared" || this.state === "choice") return;
    this.health.damage(damage);
    this.flash = BOSS.flashDuration;
    if (!this.health.alive) {
      this.swing = null;
      this.enter("dead");
      return;
    }
    if (this.clueKnown && !this.offered && this.health.hp <= BOSS.thresholdHp) {
      this.offered = true;
      this.swing = null;
      this.enter("choice");
    }
  }

  update(dt: number, playerPos: Vec2, playerAlive: boolean): Vec2 {
    if (this.state === "dead" || this.state === "spared" || this.state === "choice") return ZERO;
    this.flash = Math.max(0, this.flash - dt);
    this.stateTime += dt;
    const atk = BOSS.attacks[this.pattern];
    if (!atk) return ZERO;

    const dx = playerPos.x - this.pos.x;
    const dy = playerPos.y - this.pos.y;
    const dist = Math.hypot(dx, dy);

    switch (this.state) {
      case "idle":
        if (playerAlive && dist <= BOSS.aggroRange) this.enter("chase");
        return ZERO;
      case "chase": {
        if (!playerAlive) {
          this.enter("idle");
          return ZERO;
        }
        if (dist <= BOSS.triggerRange) {
          this.beginTelegraph(dx, dy, dist);
          return ZERO;
        }
        if (dist < 1e-6) return ZERO;
        return { x: (dx / dist) * BOSS.moveSpeed, y: (dy / dist) * BOSS.moveSpeed };
      }
      case "telegraph":
        if (this.stateTime >= atk.telegraph) this.enter("attack", this.stateTime - atk.telegraph);
        return ZERO;
      case "attack":
        if (this.stateTime >= atk.active) {
          this.swing = null;
          this.pattern = (this.pattern + 1) % BOSS.attacks.length;
          this.enter("recover", this.stateTime - atk.active);
          return ZERO;
        }
        if (atk.lunge > 0) return { x: this.aim.x * atk.lunge, y: this.aim.y * atk.lunge };
        return ZERO;
      case "recover":
        if (this.stateTime >= BOSS.recover) {
          this.enter(playerAlive ? "chase" : "idle", this.stateTime - BOSS.recover);
        }
        return ZERO;
      default:
        return ZERO;
    }
  }

  private beginTelegraph(dx: number, dy: number, dist: number): void {
    const atk = BOSS.attacks[this.pattern];
    if (!atk) return;
    this.aim = dist > 1e-6 ? { x: dx / dist, y: dy / dist } : { ...this.aim };
    this.swing = {
      id: this.nextSwingId(),
      attackerId: this.id,
      source: "enemy",
      damage: atk.damage,
      origin: { ...this.pos },
      aim: this.aim,
      range: atk.range,
      arc: atk.arc,
      hitTargets: new Set<number>(),
    };
    this.enter("telegraph");
  }

  private enter(state: BossState, carry = 0): void {
    this.state = state;
    this.stateTime = carry;
  }
}
