import type { Vec2 } from "../core/projection";
import { ENEMY } from "../data/combatConfig";
import { Health, type Hittable, type Swing } from "./hit";

export type EnemyState = "idle" | "chase" | "telegraph" | "attack" | "recover" | "dead";

const ZERO: Vec2 = { x: 0, y: 0 };

/**
 * Melee enemy. Transition rules:
 *
 *   idle      -> chase      player alive and within aggro range
 *   chase     -> telegraph  within trigger range (aim locks here)
 *   telegraph -> attack     telegraph time finished
 *   attack    -> recover    active time finished (one swing, one hit chance)
 *   recover   -> chase      recover time finished (idle if player is dead)
 *   any       -> dead       health reaches zero (final)
 *
 * The enemy is not staggered by hits, so the telegraph is always honest.
 */
export class EnemyMelee implements Hittable {
  readonly health = new Health(ENEMY.maxHp);
  pos: Vec2;
  state: EnemyState = "idle";
  stateTime = 0;
  /** Aim direction, locked when the telegraph begins. */
  aim: Vec2 = { x: 1, y: 0 };
  flash = 0;

  private swing: Swing | null = null;
  private readonly spawn: Vec2;

  constructor(
    readonly id: number,
    pos: Vec2,
    private readonly nextSwingId: () => number,
  ) {
    this.pos = { ...pos };
    this.spawn = { ...pos };
  }

  /** Puts the same enemy back at its spawn, alive, at full health, with no pending swing. */
  reset(): void {
    this.health.restore();
    this.pos = { ...this.spawn };
    this.swing = null;
    this.flash = 0;
    this.aim = { x: 1, y: 0 };
    this.enter("idle");
  }

  get alive(): boolean {
    return this.health.alive;
  }

  /** Only non-null during the attack's active window. */
  get activeSwing(): Swing | null {
    if (this.state !== "attack" || !this.swing) return null;
    return this.stateTime < ENEMY.attack.active ? this.swing : null;
  }

  /** The swing being prepared or executed, for drawing the danger area. */
  get dangerSwing(): Swing | null {
    return this.state === "telegraph" || this.state === "attack" ? this.swing : null;
  }

  /** 0..1 progress through the telegraph, 0 outside it. */
  get telegraphProgress(): number {
    return this.state === "telegraph" ? Math.min(1, this.stateTime / ENEMY.telegraph) : 0;
  }

  isInvulnerable(): boolean {
    return false;
  }

  receiveHit(damage: number, _swing: Swing): void {
    if (this.state === "dead") return;
    this.health.damage(damage);
    this.flash = ENEMY.flashDuration;
    if (!this.health.alive) {
      this.swing = null;
      this.enter("dead");
    }
  }

  /** Advances one step. Returns the desired velocity in world units per second. */
  update(dt: number, playerPos: Vec2, playerAlive: boolean): Vec2 {
    if (this.state === "dead") return ZERO;
    this.flash = Math.max(0, this.flash - dt);
    this.stateTime += dt;

    const dx = playerPos.x - this.pos.x;
    const dy = playerPos.y - this.pos.y;
    const dist = Math.hypot(dx, dy);

    switch (this.state) {
      case "idle":
        if (playerAlive && dist <= ENEMY.aggroRange) this.enter("chase");
        return ZERO;

      case "chase": {
        if (!playerAlive) {
          this.enter("idle");
          return ZERO;
        }
        if (dist <= ENEMY.triggerRange) {
          this.startTelegraph(dx, dy, dist);
          return ZERO;
        }
        return { x: (dx / dist) * ENEMY.moveSpeed, y: (dy / dist) * ENEMY.moveSpeed };
      }

      case "telegraph":
        if (this.stateTime >= ENEMY.telegraph) this.enter("attack", this.stateTime - ENEMY.telegraph);
        return ZERO;

      case "attack":
        if (this.stateTime >= ENEMY.attack.active) {
          const carry = this.stateTime - ENEMY.attack.active;
          this.swing = null;
          this.enter("recover", carry);
        }
        return ZERO;

      case "recover":
        if (this.stateTime >= ENEMY.recover) {
          this.enter(playerAlive ? "chase" : "idle", this.stateTime - ENEMY.recover);
        }
        return ZERO;

      default:
        return ZERO;
    }
  }

  private startTelegraph(dx: number, dy: number, dist: number): void {
    this.aim = dist > 1e-6 ? { x: dx / dist, y: dy / dist } : { ...this.aim };
    this.swing = {
      id: this.nextSwingId(),
      attackerId: this.id,
      source: "enemy",
      damage: ENEMY.attack.damage,
      origin: { ...this.pos },
      aim: this.aim,
      range: ENEMY.attack.range,
      arc: ENEMY.attack.arc,
      hitTargets: new Set<number>(),
    };
    this.enter("telegraph");
  }

  private enter(state: EnemyState, carry = 0): void {
    this.state = state;
    this.stateTime = carry;
  }
}
