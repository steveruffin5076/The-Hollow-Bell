import Phaser from "phaser";
import type { Vec2 } from "./projection";

/**
 * Action interface used by gameplay code. A later mobile adapter can provide
 * the same methods without touching the scene logic.
 */
export interface InputActions {
  /** Screen-relative move direction, each axis -1, 0 or 1. */
  getMove(): Vec2;
  /** Pointer position in render (projected) space. */
  getPointerScreen(): Vec2 | null;
  /** True once per press of attack (left mouse button). Holding does not repeat. */
  consumeAttack(): boolean;
  /** True once per press of dodge (Space). Holding does not repeat. */
  consumeDodge(): boolean;
  /** True once per press of Echo Strike (E). */
  consumeEcho(): boolean;
  /** True once per press of heal (Q). */
  consumeHeal(): boolean;
  /** True once per press of interact / rest (F). */
  consumeInteract(): boolean;
  /** Call once per rendered frame before reading presses. */
  poll(): void;
  /** Releases all held inputs and drops pending presses. Call on blur or pause. */
  reset(): void;
  destroy(): void;
}

type Key = Phaser.Input.Keyboard.Key;
type Action = "dodge" | "echo" | "heal" | "interact";

export class KeyboardPointerInput implements InputActions {
  private readonly move: Record<"W" | "A" | "S" | "D", Key>;
  private readonly actionKeys: Record<Action, Key>;
  private readonly queued: Record<Action, boolean> = {
    dodge: false,
    echo: false,
    heal: false,
    interact: false,
  };
  private attackQueued = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error("Keyboard input is not available");
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.move = {
      W: kb.addKey(codes.W),
      A: kb.addKey(codes.A),
      S: kb.addKey(codes.S),
      D: kb.addKey(codes.D),
    };
    this.actionKeys = {
      dodge: kb.addKey(codes.SPACE),
      echo: kb.addKey(codes.E),
      heal: kb.addKey(codes.Q),
      interact: kb.addKey(codes.F),
    };
    kb.addCapture("SPACE");
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) this.attackQueued = true;
  }

  poll(): void {
    for (const action of Object.keys(this.actionKeys) as Action[]) {
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys[action])) this.queued[action] = true;
    }
  }

  getMove(): Vec2 {
    const k = this.move;
    return {
      x: (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0),
      y: (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0),
    };
  }

  getPointerScreen(): Vec2 | null {
    const p = this.scene.input.activePointer;
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  consumeAttack(): boolean {
    const v = this.attackQueued;
    this.attackQueued = false;
    return v;
  }

  private take(action: Action): boolean {
    const v = this.queued[action];
    this.queued[action] = false;
    return v;
  }

  consumeDodge(): boolean {
    return this.take("dodge");
  }

  consumeEcho(): boolean {
    return this.take("echo");
  }

  consumeHeal(): boolean {
    return this.take("heal");
  }

  consumeInteract(): boolean {
    return this.take("interact");
  }

  reset(): void {
    this.scene.input.keyboard?.resetKeys();
    this.attackQueued = false;
    for (const action of Object.keys(this.queued) as Action[]) this.queued[action] = false;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    kb.removeCapture("SPACE");
    for (const key of Object.values(this.move)) kb.removeKey(key, true);
    for (const key of Object.values(this.actionKeys)) kb.removeKey(key, true);
  }
}
