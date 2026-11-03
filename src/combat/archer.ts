import type { Vec2 } from "../core/projection";
import { ARCHER } from "../data/combatConfig";
import { Bolt } from "./bolt";
import { Health, type Hittable, type Swing } from "./hit";

export type ArcherState = "idle" | "chase" | "telegraph" | "recover" | "dead";

const ZERO: Vec2 = { x: 0, y: 0 };

/**
 * Ranged enemy. It keeps a preferred distance, telegraphs, then fires one bolt.
 * reset() drops any bolt that has not been taken yet.
 */
export class EnemyArcher implements Hittable {
  readonly health = new Health(ARCHER.maxHp);
  pos: Vec2;
  state: ArcherState = "idle";
  stateTime = 0;
  aim: Vec2 = { x: 1, y: 0 };
  flash = 0;

  private pending: Bolt | null = null;
  private readonly spawn: Vec2;

  constructor(
    readonly id: number,
    pos: Vec2,
    private readonly nextSwingId: () => number,
  ) {
    this.pos = { ...pos };
    this.spawn = { ...pos };
  }

  reset(): void {
    this.health.restore();
    this.pos = { ...this.spawn };
    this.pending = null;
    this.flash = 0;
    this.aim = { x: 1, y: 0 };
    this.enter("idle");
  }

  get alive(): boolean {
    return this.health.alive;
  }

  /** 0..1 progress through the telegraph. The bolt is the danger marker. */
  get telegraphProgress(): number {
    return this.state === "telegraph" ? Math.min(1, this.stateTime / ARCHER.telegraph) : 0;
  }

  isInvulnerable(): boolean {
    return false;
  }

  takeBolt(): Bolt | null {
    const bolt = this.pending;
    this.pending = null;
    return bolt;
  }

  receiveHit(damage: number, _swing: Swing): void {
    if (this.state === "dead") return;
    this.health.damage(damage);
    this.flash = ARCHER.flashDuration;
    if (!this.health.alive) this.enter("dead");
  }

  update(dt: number, playerPos: Vec2, playerAlive: boolean): Vec2 {
    if (this.state === "dead") return ZERO;
    this.flash = Math.max(0, this.flash - dt);
    this.stateTime += dt;
    const dx = playerPos.x - this.pos.x;
    const dy = playerPos.y - this.pos.y;
    const dist = Math.hypot(dx, dy);

    switch (this.state) {
      case "idle":
        if (playerAlive && dist <= ARCHER.aggroRange) this.enter("chase");
        return ZERO;
      case "chase": {
        if (!playerAlive) {
          this.enter("idle");
          return ZERO;
        }
        if (dist <= ARCHER.preferredRange && dist >= ARCHER.tooClose) {
          this.aimToward(dx, dy, dist);
          this.enter("telegraph");
          return ZERO;
        }
        if (dist < ARCHER.tooClose && dist > 1e-6) {
          return { x: (-dx / dist) * ARCHER.moveSpeed, y: (-dy / dist) * ARCHER.moveSpeed };
        }
        if (dist > 1e-6) return { x: (dx / dist) * ARCHER.moveSpeed, y: (dy / dist) * ARCHER.moveSpeed };
        return ZERO;
      }
      case "telegraph":
        if (this.stateTime >= ARCHER.telegraph) {
          this.pending = new Bolt(
            this.nextSwingId(),
            this.pos,
            this.aim,
            ARCHER.boltDamage,
            ARCHER.boltRadius,
            ARCHER.boltLife,
            ARCHER.boltSpeed,
          );
          this.enter("recover", this.stateTime - ARCHER.telegraph);
        }
        return ZERO;
      case "recover":
        if (this.stateTime >= ARCHER.recover) {
          this.enter(playerAlive ? "chase" : "idle", this.stateTime - ARCHER.recover);
        }
        return ZERO;
      default:
        return ZERO;
    }
  }

  private aimToward(dx: number, dy: number, dist: number): void {
    this.aim = dist > 1e-6 ? { x: dx / dist, y: dy / dist } : { ...this.aim };
  }

  private enter(state: ArcherState, carry = 0): void {
    this.state = state;
    this.stateTime = carry;
  }
}
