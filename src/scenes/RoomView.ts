import Phaser from "phaser";
import type { Rect } from "../core/collision";
import {
  boxDepth,
  boxScreenBounds,
  occludesHero,
  type ScreenBounds,
} from "../core/occlusion";
import { groundDepth, worldToScreen, WORLD_TILE, type Vec2 } from "../core/projection";
import type { RoomDef, SolidBox } from "../data/rooms";
import { toV } from "./gfx";

const FADE_ALPHA = 0.3;
const FADE_PER_SECOND = 8;

interface Occluder {
  graphics: Phaser.GameObjects.Graphics;
  depth: number;
  bounds: ScreenBounds;
}

/** Draws a room (floor, walls, props) and fades anything that hides the hero. */
export class RoomView {
  readonly colliders: Rect[];
  private readonly occluders: Occluder[] = [];

  constructor(
    scene: Phaser.Scene,
    readonly def: RoomDef,
  ) {
    this.colliders = [...def.wallColliders, ...def.props.map((p) => p.rect)];
    this.drawFloor(scene);
    for (const box of [...def.wallBoxes, ...def.props]) {
      const graphics = scene.add.graphics();
      drawBox(graphics, box);
      const depth = boxDepth(box.rect);
      graphics.setDepth(depth);
      this.occluders.push({ graphics, depth, bounds: boxScreenBounds(box.rect, box.height) });
    }
  }

  get fadedCount(): number {
    return this.occluders.filter((o) => o.graphics.alpha < 1).length;
  }

  /** Fades occluders in front of the hero. dt of 0 holds the current alpha. */
  update(heroPos: Vec2, dt: number, heroWidth: number, heroHeight: number): void {
    const s = worldToScreen(heroPos);
    const heroBounds: ScreenBounds = {
      left: s.x - heroWidth / 2,
      right: s.x + heroWidth / 2,
      top: s.y - heroHeight - 10,
      bottom: s.y,
    };
    const heroDepth = groundDepth(heroPos);
    const step = FADE_PER_SECOND * dt;

    for (const o of this.occluders) {
      const target = occludesHero(heroDepth, heroBounds, o.depth, o.bounds) ? FADE_ALPHA : 1;
      const current = o.graphics.alpha;
      if (current === target || dt <= 0) continue;
      const next = current < target ? Math.min(target, current + step) : Math.max(target, current - step);
      o.graphics.setAlpha(next);
    }
  }

  private drawFloor(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(-1);
    for (let c = 0; c < this.def.cols; c++) {
      for (let r = 0; r < this.def.rows; r++) {
        g.fillStyle((c + r) % 2 === 0 ? 0x242231 : 0x2b2839, 1);
        g.fillPoints(
          toV([
            worldToScreen({ x: c * WORLD_TILE, y: r * WORLD_TILE }),
            worldToScreen({ x: (c + 1) * WORLD_TILE, y: r * WORLD_TILE }),
            worldToScreen({ x: (c + 1) * WORLD_TILE, y: (r + 1) * WORLD_TILE }),
            worldToScreen({ x: c * WORLD_TILE, y: (r + 1) * WORLD_TILE }),
          ]),
          true,
        );
      }
    }
  }
}

function drawBox(g: Phaser.GameObjects.Graphics, box: SolidBox): void {
  const { rect, height } = box;
  const up = (p: Vec2): Vec2 => ({ x: p.x, y: p.y - height });
  const nw = worldToScreen({ x: rect.minX, y: rect.minY });
  const ne = worldToScreen({ x: rect.maxX, y: rect.minY });
  const se = worldToScreen({ x: rect.maxX, y: rect.maxY });
  const sw = worldToScreen({ x: rect.minX, y: rect.maxY });

  g.fillStyle(box.leftColor, 1);
  g.fillPoints(toV([sw, se, up(se), up(sw)]), true);
  g.fillStyle(box.rightColor, 1);
  g.fillPoints(toV([se, ne, up(ne), up(se)]), true);
  g.fillStyle(box.topColor, 1);
  g.fillPoints(toV([up(nw), up(ne), up(se), up(sw)]), true);
}
