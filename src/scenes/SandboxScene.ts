import Phaser from "phaser";
import { moveCircle } from "../core/collision";
import { simulationDelta } from "../core/clock";
import { KeyboardPointerInput } from "../core/input";
import { inputToWorldDirection, stepVector } from "../core/movement";
import { groundDepth, screenToWorld, worldToScreen, WORLD_TILE, type Vec2 } from "../core/projection";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, SCENE_KEYS } from "../game/config";
import { SANDBOX_ROOM } from "../data/rooms";
import { toV } from "./gfx";
import { RoomView } from "./RoomView";

const HERO_RADIUS = 8;
const HERO_SPEED = 150; // world units per second
const HERO_BODY_W = 16;
const HERO_BODY_H = 34;
const AIM_ARROW_LENGTH = 28;

export class SandboxScene extends Phaser.Scene {
  private controls!: KeyboardPointerInput;
  private room!: RoomView;
  private heroPos: Vec2 = { ...SANDBOX_ROOM.heroSpawn };
  private aim: Vec2 = { x: 1, y: 0 };
  private hero!: Phaser.GameObjects.Container;
  private arrow!: Phaser.GameObjects.Graphics;
  private paused = false;
  private pausedText!: Phaser.GameObjects.Text;
  private debugOn = false;
  private debugText!: Phaser.GameObjects.Text;
  private debugGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE_KEYS.sandbox);
  }

  create(): void {
    // Reset per-run state so re-entering the scene never reuses old values.
    this.heroPos = { ...SANDBOX_ROOM.heroSpawn };
    this.aim = { x: 1, y: 0 };
    this.paused = false;
    this.debugOn = false;

    this.cameras.main.setBackgroundColor("#0b0a10");
    this.cameras.main.setRoundPixels(true);

    this.room = new RoomView(this, SANDBOX_ROOM);
    this.buildHero();
    this.buildHud();

    this.controls = new KeyboardPointerInput(this);
    this.input.keyboard?.addCapture("W,A,S,D,F3");
    const f3 = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    f3?.on("down", this.toggleDebug, this);

    this.game.events.on(Phaser.Core.Events.BLUR, this.onFocusLost, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onFocusLost, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.onFocusGained, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onFocusGained, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.onFocusLost, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onFocusLost, this);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.onFocusGained, this);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.onFocusGained, this);
    this.input.keyboard?.removeCapture("W,A,S,D,F3");
    this.input.keyboard?.removeKey(Phaser.Input.Keyboard.KeyCodes.F3, true);
    this.controls.destroy();
  }

  // ---- focus handling ----

  private onFocusLost(): void {
    this.paused = true;
    this.controls.reset();
    this.pausedText.setVisible(true);
  }

  private onFocusGained(): void {
    this.controls.reset();
    this.paused = false;
    this.pausedText.setVisible(false);
  }

  // ---- building the scene ----

  private buildHero(): void {
    const shadow = this.add.ellipse(0, 0, 22, 11, 0x000000, 0.45);
    const body = this.add.rectangle(0, 0, HERO_BODY_W, HERO_BODY_H, 0xc9b28a).setOrigin(0.5, 1);
    const head = this.add.rectangle(0, -HERO_BODY_H, 10, 10, 0xe6d3b0).setOrigin(0.5, 1);
    this.arrow = this.add.graphics();
    this.hero = this.add.container(0, 0, [shadow, this.arrow, body, head]);
    this.syncHeroVisual();
  }

  private buildHud(): void {
    this.pausedText = this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, "Paused (window lost focus)", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffffff",
        backgroundColor: "#000000bb",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1_000_000)
      .setVisible(false);

    this.add
      .text(12, 10, "WASD move  |  Mouse aims  |  F3 debug", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#9a96ab",
      })
      .setScrollFactor(0)
      .setDepth(1_000_000);

    this.debugText = this.add
      .text(12, 32, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#7CFC9A",
        backgroundColor: "#000000aa",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1_000_000)
      .setVisible(false);

    this.debugGfx = this.add.graphics().setDepth(999_999).setVisible(false);
  }

  private toggleDebug(): void {
    this.debugOn = !this.debugOn;
    this.debugText.setVisible(this.debugOn);
    this.debugGfx.setVisible(this.debugOn);
  }

  // ---- per-frame ----

  update(_time: number, deltaMs: number): void {
    const dt = this.paused ? 0 : simulationDelta(deltaMs);

    if (dt > 0) {
      const dir = inputToWorldDirection(this.controls.getMove());
      this.heroPos = moveCircle(this.heroPos, stepVector(dir, HERO_SPEED, dt), HERO_RADIUS, this.room.colliders);
    }

    this.updateAim();
    this.syncHeroVisual();
    this.room.update(this.heroPos, dt, HERO_BODY_W, HERO_BODY_H);
    this.centerCamera();
    this.updateDebug();
  }

  private updateAim(): void {
    const p = this.controls.getPointerScreen();
    if (!p) return;
    const target = screenToWorld(p);
    const dx = target.x - this.heroPos.x;
    const dy = target.y - this.heroPos.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) this.aim = { x: dx / len, y: dy / len };

    // Arrow is drawn on the ground plane, relative to the hero container.
    const tip = worldToScreen({ x: this.aim.x * AIM_ARROW_LENGTH, y: this.aim.y * AIM_ARROW_LENGTH });
    const wing = (angle: number): Vec2 => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const bx = -this.aim.x * 9;
      const by = -this.aim.y * 9;
      return worldToScreen({
        x: this.aim.x * AIM_ARROW_LENGTH + bx * c - by * s,
        y: this.aim.y * AIM_ARROW_LENGTH + bx * s + by * c,
      });
    };
    this.arrow.clear();
    this.arrow.lineStyle(2, 0xff7a59, 1);
    this.arrow.lineBetween(0, 0, tip.x, tip.y);
    const a = wing(0.5);
    const b = wing(-0.5);
    this.arrow.lineBetween(tip.x, tip.y, a.x, a.y);
    this.arrow.lineBetween(tip.x, tip.y, b.x, b.y);
  }

  private syncHeroVisual(): void {
    const s = worldToScreen(this.heroPos);
    this.hero.setPosition(Math.round(s.x), Math.round(s.y));
    // Depth follows ground contact, not sprite centre.
    this.hero.setDepth(groundDepth(this.heroPos));
  }

  private centerCamera(): void {
    const s = worldToScreen(this.heroPos);
    this.cameras.main.centerOn(Math.round(s.x), Math.round(s.y - HERO_BODY_H / 2));
  }

  private updateDebug(): void {
    if (!this.debugOn) return;
    const pointer = this.controls.getPointerScreen();
    const pw = pointer ? screenToWorld(pointer) : null;
    this.debugText.setText(
      [
        `FPS: ${this.game.loop.actualFps.toFixed(0)}`,
        `hero world: ${this.heroPos.x.toFixed(1)}, ${this.heroPos.y.toFixed(1)}`,
        `hero tile: ${Math.floor(this.heroPos.x / WORLD_TILE)}, ${Math.floor(this.heroPos.y / WORLD_TILE)}`,
        `pointer world: ${pw ? `${pw.x.toFixed(1)}, ${pw.y.toFixed(1)}` : "-"}`,
        `aim: ${this.aim.x.toFixed(2)}, ${this.aim.y.toFixed(2)}`,
        `depth: ${groundDepth(this.heroPos).toFixed(1)}`,
        `faded: ${this.room.fadedCount}`,
      ].join("\n"),
    );

    const g = this.debugGfx;
    g.clear();
    g.lineStyle(1, 0xff3b3b, 1);
    for (const r of this.room.colliders) {
      g.strokePoints(
        toV([
          worldToScreen({ x: r.minX, y: r.minY }),
          worldToScreen({ x: r.maxX, y: r.minY }),
          worldToScreen({ x: r.maxX, y: r.maxY }),
          worldToScreen({ x: r.minX, y: r.maxY }),
        ]),
        true,
      );
    }
    // Hero collision circle on the ground plane (an ellipse on screen).
    g.lineStyle(1, 0x3bd1ff, 1);
    const pts: Vec2[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(
        worldToScreen({
          x: this.heroPos.x + Math.cos(a) * HERO_RADIUS,
          y: this.heroPos.y + Math.sin(a) * HERO_RADIUS,
        }),
      );
    }
    g.strokePoints(toV(pts), true);
  }
}
