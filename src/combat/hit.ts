import type { Vec2 } from "../core/projection";

export class Health {
  hp: number;
  max: number;
  constructor(max: number) {
    this.max = max;
    this.hp = max;
  }
  /** Raises the maximum and current health by the same amount. Applied once per level choice. */
  raiseMax(extra: number): void {
    if (extra <= 0) return;
    this.max += extra;
    this.hp += extra;
  }
  get alive(): boolean {
    return this.hp > 0;
  }
  /** Back to full health. */
  restore(): void {
    this.hp = this.max;
  }
  /** Adds health up to the maximum (no overheal). Returns the amount actually added. */
  heal(amount: number): number {
    if (amount <= 0 || !this.alive) return 0;
    const added = Math.min(amount, this.max - this.hp);
    this.hp += added;
    return added;
  }
  /** Returns the amount actually removed. Dead targets take nothing. */
  damage(amount: number): number {
    if (amount <= 0 || !this.alive) return 0;
    const removed = Math.min(amount, this.hp);
    this.hp -= removed;
    return removed;
  }
}

/**
 * One swing of one attack. `hitTargets` records every target this swing has
 * already resolved against, so a swing can affect each target at most once.
 */
export type SwingSource = "basic" | "echo" | "enemy";

export interface Swing {
  id: number;
  attackerId: number;
  /** Where the swing came from. Only "basic" swings generate Echo. */
  source: SwingSource;
  damage: number;
  origin: Vec2;
  /** Unit vector, locked when the swing begins. */
  aim: Vec2;
  range: number;
  /** Full arc width in radians. */
  arc: number;
  hitTargets: Set<number>;
}

export interface Hittable {
  id: number;
  health: Health;
  isInvulnerable(): boolean;
  receiveHit(damage: number, swing: Swing): void;
}

export type HitOutcome =
  | "applied"
  | "killed"
  | "already-hit"
  | "invulnerable"
  | "dead"
  | "self"
  | "out-of-reach";

/** True when a world point lies inside the swing's range and arc. */
export function swingCovers(swing: Swing, point: Vec2): boolean {
  const dx = point.x - swing.origin.x;
  const dy = point.y - swing.origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > swing.range) return false;
  if (dist < 1e-6) return true;
  const cos = (dx * swing.aim.x + dy * swing.aim.y) / dist;
  return cos >= Math.cos(swing.arc / 2) - 1e-9;
}

/**
 * The single place where damage, invulnerability and death are decided.
 * A swing that reaches an invulnerable target is spent on that target
 * (it will not hit later in the same swing).
 */
export function resolveHit(swing: Swing, target: Hittable): HitOutcome {
  if (target.id === swing.attackerId) return "self";
  if (swing.hitTargets.has(target.id)) return "already-hit";
  if (!target.health.alive) return "dead";
  swing.hitTargets.add(target.id);
  if (target.isInvulnerable()) return "invulnerable";
  target.receiveHit(swing.damage, swing);
  return target.health.alive ? "applied" : "killed";
}

/** Geometry check followed by resolveHit. Out-of-reach does not spend the swing. */
export function applySwing(swing: Swing, target: Hittable, targetPos: Vec2): HitOutcome {
  if (!swingCovers(swing, targetPos)) return "out-of-reach";
  return resolveHit(swing, target);
}

/** Polygon (world space) for drawing a swing's reach: origin plus an arc. */
export function wedgePoints(origin: Vec2, aim: Vec2, range: number, arc: number, segments = 14): Vec2[] {
  const base = Math.atan2(aim.y, aim.x);
  const pts: Vec2[] = [{ x: origin.x, y: origin.y }];
  for (let i = 0; i <= segments; i++) {
    const a = base - arc / 2 + (arc * i) / segments;
    pts.push({ x: origin.x + Math.cos(a) * range, y: origin.y + Math.sin(a) * range });
  }
  return pts;
}
