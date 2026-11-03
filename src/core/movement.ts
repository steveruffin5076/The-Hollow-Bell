import { screenDirToWorldDir, type Vec2 } from "./projection";

/**
 * Turns a screen-relative input direction (W = screen up, D = screen right)
 * into a unit-length world direction. Normalizing in world space means every
 * direction moves the hero at the same world speed, including diagonals.
 */
export function inputToWorldDirection(screenDir: Vec2): Vec2 {
  if (screenDir.x === 0 && screenDir.y === 0) return { x: 0, y: 0 };
  const w = screenDirToWorldDir(screenDir);
  const len = Math.hypot(w.x, w.y);
  return { x: w.x / len, y: w.y / len };
}

/** Distance vector for one simulation step. */
export function stepVector(dir: Vec2, speed: number, dt: number): Vec2 {
  return { x: dir.x * speed * dt, y: dir.y * speed * dt };
}
