import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { CombatScene } from "../scenes/CombatScene";
import { PlayScene } from "../scenes/PlayScene";
import { SandboxScene } from "../scenes/SandboxScene";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./config";

export function startGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: "#0b0a10",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, SandboxScene, CombatScene, PlayScene],
  });
}
