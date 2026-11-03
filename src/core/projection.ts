/**
 * Fixed isometric projection (2:1 diamond tiles).
 *
 * World space is the authoritative flat ground plane. One world unit equals
 * one logical screen pixel along the horizontal axis. A 32x32 world tile is a
 * 64x32 diamond on screen. Screen coordinates are for rendering, aiming and
 * picking only. Never store gameplay state in screen space.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export const WORLD_TILE = 32;

export function worldToScreen(w: Vec2): Vec2 {
  return { x: w.x - w.y, y: (w.x + w.y) / 2 };
}

export function screenToWorld(s: Vec2): Vec2 {
  return { x: s.y + s.x / 2, y: s.y - s.x / 2 };
}

/**
 * Converts a screen-space direction (for example "up" = 0,-1) to a world-space
 * direction. This is a linear map, so it is the same maths as screenToWorld.
 * The result is not normalized.
 */
export function screenDirToWorldDir(d: Vec2): Vec2 {
  return screenToWorld(d);
}

/** Draw order value. Larger is drawn on top. Based on ground contact, not sprite centre. */
export function groundDepth(w: Vec2): number {
  return (w.x + w.y) / 2;
}
