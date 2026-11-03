import type { Vec2 } from "../core/projection";
import { applySwing, type Hittable, type Swing } from "./hit";

/** A bounded projectile. It dies on hit, on expiry, or when the scene clears it. */
export class Bolt {
  alive = true;
  pos: Vec2;
  readonly swing: Swing;
  private life: number;
  private readonly vel: Vec2;

  constructor(id: number, pos: Vec2, aim: Vec2, damage: number, radius: number, life: number, speed = 110) {
    const len = Math.hypot(aim.x, aim.y);
    const unit = len > 1e-6 ? { x: aim.x / len, y: aim.y / len } : { x: 1, y: 0 };
    this.pos = { ...pos };
    this.life = life;
    this.vel = { x: unit.x * speed, y: unit.y * speed };
    this.swing = {
      id,
      attackerId: -Math.abs(id) - 1,
      source: "enemy",
      damage,
      origin: { ...pos },
      aim: unit,
      range: radius,
      arc: Math.PI * 2,
      hitTargets: new Set<number>(),
    };
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.pos = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };
    this.swing.origin = { ...this.pos };
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  /** Resolves against a target standing at `at` (defaults to the bolt). */
  tryHit(target: Hittable, at: Vec2 = this.pos): void {
    if (!this.alive) return;
    const outcome = applySwing(this.swing, target, at);
    if (outcome === "applied" || outcome === "killed" || outcome === "invulnerable") this.alive = false;
  }
}
