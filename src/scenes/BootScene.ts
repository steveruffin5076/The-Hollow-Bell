import Phaser from "phaser";
import { Sfx } from "../audio/sfx";
import { freshSession, persistActive, sessionFromSave, setActiveSession } from "../game/session";
import { replaceSettings } from "../game/settingsState";
import {
  GAME_TITLE,
  GAME_VERSION_LABEL,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  SCENE_KEYS,
} from "../game/config";
import { browserStorage, loadSave, loadSettings } from "../persistence/save";

/**
 * Title screen. Enter continues a valid save, or starts a new game.
 * The combat lab and movement sandbox stay available.
 */
export class BootScene extends Phaser.Scene {
  private started = false;
  private confirming = false;
  private saveReady = false;
  private notice = "";

  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    this.started = false;
    this.confirming = false;
    const storage = browserStorage();
    if (storage) replaceSettings(loadSettings(storage));
    const sfx = new Sfx(() => ({ master: 0, muted: true, shake: false, reducedFlash: false }));
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => sfx.unlock());
    const loaded = storage ? loadSave(storage) : { ok: false as const, reason: "empty" as const };
    this.saveReady = loaded.ok;
    if (!loaded.ok && loaded.reason !== "empty") {
      this.notice =
        loaded.reason === "unsupported"
          ? "The save is from another version. It was copied aside. Start a new game to replace it."
          : "The save could not be read. It was copied aside. Start a new game to replace it.";
    } else if (!storage) {
      this.notice = "This browser will not keep a save. Progress lasts for this session only.";
    }

    const cx = LOGICAL_WIDTH / 2;
    this.add.text(cx, 110, GAME_TITLE, { fontFamily: "Georgia, serif", fontSize: "64px", color: "#f4efe2" }).setOrigin(0.5);
    this.add.text(cx, 175, GAME_VERSION_LABEL, { fontFamily: "monospace", fontSize: "18px", color: "#c8c2b4" }).setOrigin(0.5);
    this.add
      .text(cx, 214, "A bell keeps the dead outside. Each toll forgets a living name.", {
        fontFamily: "Georgia, serif",
        fontSize: "18px",
        color: "#f4efe2",
      })
      .setOrigin(0.5);
    if (this.notice) {
      this.add
        .text(cx, 250, this.notice, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#1a1722",
          backgroundColor: "#e6d7a8",
          align: "center",
          wordWrap: { width: 760 },
          padding: { x: 8, y: 6 },
        })
        .setOrigin(0.5);
    }

    if (this.saveReady) this.makeButton(cx, 320, "Continue", 28, () => this.continueGame());
    this.makeButton(cx, this.saveReady ? 390 : 340, "New game", 28, () => this.askNewGame());
    this.makeButton(cx, 460, "Combat lab", 18, () => this.go(SCENE_KEYS.combat));
    this.makeButton(cx, 510, "Movement sandbox", 18, () => this.go(SCENE_KEYS.sandbox));

    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.confirming) return;
      if (this.saveReady) this.continueGame();
      else this.startNew();
    });
  }

  private askNewGame(): void {
    if (!this.saveReady) {
      this.startNew();
      return;
    }
    if (this.confirming) return;
    this.confirming = true;
    const panel = this.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 640, 180, 0x16131d, 0.96).setDepth(5);
    const text = this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 40, "Erase the saved game?", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#f4efe2",
      })
      .setOrigin(0.5)
      .setDepth(6);
    const yes = this.choice(LOGICAL_WIDTH / 2 - 110, LOGICAL_HEIGHT / 2 + 30, "Erase", () => {
      panel.destroy();
      text.destroy();
      yes.destroy();
      no.destroy();
      this.startNew();
    });
    const no = this.choice(LOGICAL_WIDTH / 2 + 110, LOGICAL_HEIGHT / 2 + 30, "Cancel", () => {
      panel.destroy();
      text.destroy();
      yes.destroy();
      no.destroy();
      this.confirming = false;
    });
  }

  private choice(x: number, y: number, label: string, onPick: () => void): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#1a1722",
        backgroundColor: "#e6d7a8",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });
    button.on("pointerup", onPick);
    return button;
  }

  private continueGame(): void {
    const storage = browserStorage();
    if (!storage) return;
    const loaded = loadSave(storage);
    if (!loaded.ok) return;
    setActiveSession(sessionFromSave(loaded.save));
    this.go(SCENE_KEYS.play);
  }

  private startNew(): void {
    const storage = browserStorage();
    if (storage) storage.removeItem("hollow-bell-save");
    setActiveSession(freshSession());
    persistActive(storage);
    this.go(SCENE_KEYS.play);
  }

  private makeButton(x: number, y: number, label: string, size: number, onPick: () => void): void {
    const button = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: `${size}px`,
        color: "#1a1722",
        backgroundColor: "#e6d7a8",
        padding: { x: 28, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setBackgroundColor("#ffffff"));
    button.on("pointerout", () => button.setBackgroundColor("#e6d7a8"));
    button.on("pointerup", onPick);
  }

  private go(target: string): void {
    if (this.started) return;
    this.started = true;
    this.scene.start(target);
  }
}
