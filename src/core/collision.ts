import type { Vec2 } from "./projection";

/** Axis-aligned solid rectangle on the world ground plane. */
export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Pushes a circle out of every rectangle it overlaps. Mutates nothing. */
export function resolveCircleRects(pos: Vec2, radius: number, rects: readonly Rect[]): Vec2 {
  let x = pos.x;
  let y = pos.y;

  // A few passes settle corners where two rectangles touch.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const r of rects) {
      const cx = Math.min(Math.max(x, r.minX), r.maxX);
      const cy = Math.min(Math.max(y, r.minY), r.maxY);
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 >= radius * radius) continue;

      if (d2 > 0) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        x += (dx / d) * push;
        y += (dy / d) * push;
      } else {
        // Centre is inside the rectangle: leave by the nearest edge.
        const left = x - r.minX;
        const right = r.maxX - x;
        const top = y - r.minY;
        const bottom = r.maxY - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = r.minX - radius;
        else if (m === right) x = r.maxX + radius;
        else if (m === top) y = r.minY - radius;
        else y = r.maxY + radius;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}

/**
 * Moves a circle by delta in small sub-steps so it cannot tunnel through
 * thin walls, then slides along solids by pushing out of them.
 */
export function moveCircle(
  pos: Vec2,
  delta: Vec2,
  radius: number,
  rects: readonly Rect[],
): Vec2 {
  const maxStep = radius * 0.5;
  const dist = Math.hypot(delta.x, delta.y);
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  let p = { x: pos.x, y: pos.y };
  for (let i = 0; i < steps; i++) {
    p = resolveCircleRects(
      { x: p.x + delta.x / steps, y: p.y + delta.y / steps },
      radius,
      rects,
    );
  }
  return p;
}
