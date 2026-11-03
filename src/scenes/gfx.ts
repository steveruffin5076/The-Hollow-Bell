import Phaser from "phaser";
import { worldToScreen, type Vec2 } from "../core/projection";

/** Phaser's Graphics API wants Vector2 objects; core code uses plain Vec2. */
export function toV(points: Vec2[]): Phaser.Math.Vector2[] {
  return points.map((p) => new Phaser.Math.Vector2(p.x, p.y));
}

/** Projects world-space points to screen space as Vector2 objects. */
export function projectPoints(worldPoints: Vec2[]): Phaser.Math.Vector2[] {
  return toV(worldPoints.map((p) => worldToScreen(p)));
}
