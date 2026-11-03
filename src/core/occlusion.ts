import type { Rect } from "./collision";
import { groundDepth, worldToScreen } from "./projection";

/** Screen-space bounding box. */
export interface ScreenBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Screen bounds of an extruded box standing on the ground. */
export function boxScreenBounds(rect: Rect, height: number): ScreenBounds {
  const corners = [
    worldToScreen({ x: rect.minX, y: rect.minY }),
    worldToScreen({ x: rect.maxX, y: rect.minY }),
    worldToScreen({ x: rect.maxX, y: rect.maxY }),
    worldToScreen({ x: rect.minX, y: rect.maxY }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys) - height,
    bottom: Math.max(...ys),
  };
}

/** Depth of a box: its front-most ground corner. */
export function boxDepth(rect: Rect): number {
  return groundDepth({ x: rect.maxX, y: rect.maxY });
}

export function boundsOverlap(a: ScreenBounds, b: ScreenBounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** True when an object drawn in front of the hero covers part of the hero. */
export function occludesHero(
  heroDepth: number,
  heroBounds: ScreenBounds,
  occluderDepth: number,
  occluderBounds: ScreenBounds,
): boolean {
  return occluderDepth > heroDepth && boundsOverlap(heroBounds, occluderBounds);
}
