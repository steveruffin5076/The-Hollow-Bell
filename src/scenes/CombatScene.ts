import Phaser from "phaser";
import { CheckpointState } from "../combat/checkpoint";
import { EnemyMelee } from "../combat/enemy";
import { applySwing, wedgePoints, type HitOutcome, type Swing } from "../combat/hit";
import { onPlayerSwingOutcome } from "../combat/outcome";
import { PlayerCombat, type PlayerInput } from "../combat/player";
import { simulationDelta } from "../core/clock";
import { moveCircle } from "../core/collision";
import { KeyboardPointerInput } from "../core/input";
import { inputToWorldDirection } from "../core/movement";
import { groundDepth, screenToWorld, worldToScreen, type Vec2 } from "../core/projection";
import { ENEMY, FEEDBACK, FIXED_STEP, HEAL, MAX_STEPS_PER_FRAME, PLAYER } from "../data/combatConfig";
import {
  COMBAT_CHECKPOINT,
  COMBAT_ENEMY_REWARD_ID,
  COMBAT_ENEMY_SPAWN,
  COMBAT_PICKUP,
  COMBAT_ROOM,
  COMBAT_START_CHECKPOINT_ID,
} from "../data/rooms";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, SCENE_KEYS } from "../game/config";
import { RewardLedger, tryCollect } from "../progression/rewards";
import { projectPoints } from "./gfx";
import { RoomView } from "./RoomView";

const PLAYER_ID = 1;
const ENEMY_ID = 2;
const BODY_W = 16;
const BODY_H = 34;
const MESSAGE_SECONDS = 2.2;

/**
 * Combat laboratory: one room, one hero, one melee enemy, one rest point,
 * one pickup. Gameplay runs in fixed steps (FIXED_STEP); rendering reads the result.
 */
export class CombatScene extends Phaser.Scene {
  private controls!: KeyboardPointerInput;
  private room!: RoomView;
  private player!: PlayerCombat;
  private enemy!: EnemyMelee;
  private ledger!: RewardLedger;
  private checkpoints!: CheckpointState;
  private swingCounter = 0;

  private aim: Vec2 = { x: 1, y: 0 };
  private accumulator = 0;
  private hitStop = 0;
  private paused = false;
  private restarting = false;
  private messageUntil = 0;

  private heroNode!: Phaser.GameObjects.Container;
  private heroBody!: Phaser.GameObjects.Rectangle;
  private enemyNode!: Phaser.GameObjects.Container;
  private enemyBody!: Phaser.GameObjects.Rectangle;
  private enemyMark!: Phaser.GameObjects.Text;
  private fx!: Phaser.GameObjects.Graphics;
  private echoFx!: Phaser.GameObjects.Graphics;
  private worldBars!: Phaser.GameObjects.Graphics;
  private hudBars!: Phaser.GameObjects.Graphics;
  private pickupGfx!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private echoText!: Phaser.GameObjects.Text;
  private enemyStatusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private endText!: Phaser.GameObjects.Text;
  private respawnKey!: Phaser.Input.Keyboard.Key;
  private newRunKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SCENE_KEYS.combat);
  }

  create(): void {
    // Reset every per-run value: scene fields are not reset by scene.restart().
    this.swingCounter = 0;
    this.aim = { x: 1, y: 0 };
    this.accumulator = 0;
    this.hitStop = 0;
    this.paused = false;
    this.restarting = false;
    this.messageUntil = 0;

    this.cameras.main.setBackgroundColor("#0b0a10");
    this.cameras.main.setRoundPixels(true);

    this.room = new RoomView(this, COMBAT_ROOM);
    const nextSwingId = (): number => ++this.swingCounter;
    this.player = new PlayerCombat(PLAYER_ID, COMBAT_ROOM.heroSpawn, nextSwingId);
    this.enemy = new EnemyMelee(ENEMY_ID, COMBAT_ENEMY_SPAWN, nextSwingId);
    this.ledger = new RewardLedger();
    this.checkpoints = new CheckpointState(COMBAT_START_CHECKPOINT_ID, COMBAT_ROOM.heroSpawn);

    this.fx = this.add.graphics().setDepth(0);
    this.drawCheckpointStone();
    this.pickupGfx = this.add.graphics();
    this.buildActors();
    this.echoFx = this.add.graphics().setDepth(800_000);
    this.worldBars = this.add.graphics().setDepth(900_000);
    this.buildHud();

    this.controls = new KeyboardPointerInput(this);
    this.input.keyboard?.addCapture("W,A,S,D,R,N,E,Q,F");
    this.respawnKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.newRunKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);

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
    this.input.keyboard?.removeCapture("W,A,S,D,R,N,E,Q,F");
    this.input.keyboard?.removeKey(this.respawnKey, true);
    this.input.keyboard?.removeKey(this.newRunKey, true);
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
    this.accumulator = 0;
    this.paused = false;
    this.pausedText.setVisible(false);
  }

  // ---- building ----

  private buildActors(): void {
    const heroShadow = this.add.ellipse(0, 0, 22, 11, 0x000000, 0.45);
    this.heroBody = this.add.rectangle(0, 0, BODY_W, BODY_H, 0xc9b28a).setOrigin(0.5, 1);
    const heroHead = this.add.rectangle(0, -BODY_H, 10, 10, 0xe6d3b0).setOrigin(0.5, 1);
    this.heroNode = this.add.container(0, 0, [heroShadow, this.heroBody, heroHead]);

    const enemyShadow = this.add.ellipse(0, 0, 26, 13, 0x000000, 0.45);
    this.enemyBody = this.add.rectangle(0, 0, 20, 36, 0x8a3b3b).setOrigin(0.5, 1);
    const enemyHead = this.add.rectangle(0, -36, 12, 12, 0xb55a5a).setOrigin(0.5, 1);
    this.enemyMark = this.add
      .text(0, -62, "!", { fontFamily: "monospace", fontSize: "24px", color: "#ff3b3b", fontStyle: "bold" })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.enemyNode = this.add.container(0, 0, [enemyShadow, this.enemyBody, enemyHead, this.enemyMark]);
  }

  /** A small bell post. Not solid. Drawn once. */
  private drawCheckpointStone(): void {
    const s = worldToScreen(COMBAT_CHECKPOINT.position);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(s.x, s.y, 30, 15);
    g.fillStyle(0x4b4a5c, 1);
    g.fillRect(s.x - 6, s.y - 34, 12, 34);
    g.fillStyle(0x6d6b82, 1);
    g.fillRect(s.x - 9, s.y - 38, 18, 6);
    g.fillStyle(0xe8c46a, 1);
    g.fillTriangle(s.x - 7, s.y - 40, s.x + 7, s.y - 40, s.x, s.y - 54);
    g.setDepth(groundDepth(COMBAT_CHECKPOINT.position));

    this.promptText = this.add
      .text(Math.round(s.x), Math.round(s.y - 62), "F: rest", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffe9a8",
        backgroundColor: "#000000aa",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(900_000)
      .setVisible(false);
  }

  private buildHud(): void {
    this.hudBars = this.add.graphics().setScrollFactor(0).setDepth(1_000_000);

    const hudText = (x: number, y: number, color: string, size = 14): Phaser.GameObjects.Text =>
      this.add
        .text(x, y, "", { fontFamily: "monospace", fontSize: `${size}px`, color })
        .setScrollFactor(0)
        .setDepth(1_000_000);

    this.statusText = hudText(12, 10, "#cfcadb");
    this.echoText = hudText(242, 51, "#9fdcff", 13);
    this.resourceText = hudText(12, 68, "#cfcadb");
    this.enemyStatusText = hudText(12, 90, "#e0a0a0");

    this.hintText = this.add
      .text(LOGICAL_WIDTH / 2, 150, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffe9a8",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1_000_000);

    this.messageText = this.add
      .text(LOGICAL_WIDTH / 2, 118, "", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#000000bb",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1_000_000)
      .setVisible(false);

    const helpStyle = { fontFamily: "monospace", fontSize: "13px", color: "#9a96ab" };
    this.add
      .text(12, LOGICAL_HEIGHT - 44, "WASD move | Mouse aim | Click attack (click again: 2nd hit) | Space dodge", helpStyle)
      .setScrollFactor(0)
      .setDepth(1_000_000);
    this.add
      .text(12, LOGICAL_HEIGHT - 26, "E Echo Strike | Q heal | F rest at bell stone | R respawn (when dead) | N new run", helpStyle)
      .setScrollFactor(0)
      .setDepth(1_000_000);

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
      .setDepth(1_000_001)
      .setVisible(false);

    this.endText = this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 60, "", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffffff",
        backgroundColor: "#000000bb",
        padding: { x: 18, y: 10 },
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1_000_000)
      .setVisible(false);
  }

  private say(text: string): void {
    this.messageText.setText(text).setVisible(true);
    this.messageUntil = this.time.now + MESSAGE_SECONDS * 1000;
  }

  // ---- per-frame ----

  update(_time: number, deltaMs: number): void {
    if (this.restarting) return;

    this.controls.poll();

    if (Phaser.Input.Keyboard.JustDown(this.newRunKey)) {
      this.restarting = true;
      this.scene.restart();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.respawnKey) && !this.player.alive) this.respawn();

    const frameDt = this.paused ? 0 : simulationDelta(deltaMs);

    this.updateAim();

    // Hit-stop freezes the simulation but still uses real time.
    let simDt = frameDt;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - frameDt);
      simDt = 0;
    }

    this.accumulator += simDt;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // never catch up in a burst

    this.render(frameDt);
  }

  /** Death restores the latest committed checkpoint. Rewards are kept. */
  private respawn(): void {
    this.checkpoints.respawn(this.player, [this.enemy]);
    this.hitStop = 0;
    this.accumulator = 0;
    this.controls.reset();
    this.say("Respawned at checkpoint");
  }

  private updateAim(): void {
    const p = this.controls.getPointerScreen();
    if (!p) return;
    const target = screenToWorld(p);
    const dx = target.x - this.player.pos.x;
    const dy = target.y - this.player.pos.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) this.aim = { x: dx / len, y: dy / len };
  }

  private step(dt: number): void {
    const player = this.player;
    const enemy = this.enemy;
    const colliders = this.room.colliders;
    const tokensBefore = this.ledger.tokens;

    // Rest happens before the player update so the restore is clean.
    if (this.controls.consumeInteract() && this.checkpoints.rest(COMBAT_CHECKPOINT, player, [enemy])) {
      this.say("Rested. Checkpoint saved, enemy reset.");
    }

    const input: PlayerInput = {
      moveDir: inputToWorldDirection(this.controls.getMove()),
      aim: this.aim,
      attackPressed: this.controls.consumeAttack(),
      dodgePressed: this.controls.consumeDodge(),
      echoPressed: this.controls.consumeEcho(),
      healPressed: this.controls.consumeHeal(),
    };

    const hadStrike = player.echoStrike;
    const chargesBefore = player.healCharges;
    const pv = player.update(dt, input);
    if (!hadStrike && player.echoStrike) this.say("Echo Strike!");
    if (player.healCharges < chargesBefore) this.say("Healed");

    if (pv.x !== 0 || pv.y !== 0) {
      player.pos = moveCircle(player.pos, { x: pv.x * dt, y: pv.y * dt }, PLAYER.radius, colliders);
    }

    const ev = enemy.update(dt, player.pos, player.alive);
    if (ev.x !== 0 || ev.y !== 0) {
      enemy.pos = moveCircle(enemy.pos, { x: ev.x * dt, y: ev.y * dt }, ENEMY.radius, colliders);
    }
    this.separateEnemyFromPlayer();

    if (player.alive) tryCollect(this.ledger, COMBAT_PICKUP, player.pos);

    // Hits. Each swing resolves against each target at most once.
    this.resolvePlayerSwing(player.activeSwing);
    this.resolvePlayerSwing(player.echoStrike?.activeSwing ?? null);
    const enemySwing = enemy.activeSwing;
    if (enemySwing && player.alive) applySwing(enemySwing, player, player.pos);

    if (this.ledger.tokens > tokensBefore) this.say(`Reward: Ash Token (total ${this.ledger.tokens})`);
  }

  private resolvePlayerSwing(swing: Swing | null): void {
    if (!swing || !this.enemy.alive) return;
    const outcome: HitOutcome = applySwing(swing, this.enemy, this.enemy.pos);
    onPlayerSwingOutcome(this.player, this.ledger, swing, outcome, COMBAT_ENEMY_REWARD_ID);
    if (outcome === "applied") this.hitStop = FEEDBACK.hitStop;
    else if (outcome === "killed") this.hitStop = FEEDBACK.killHitStop;
  }

  /** Bodies do not overlap: the enemy is pushed out of the player. */
  private separateEnemyFromPlayer(): void {
    if (!this.player.alive || !this.enemy.alive) return;
    const minDist = PLAYER.radius + ENEMY.radius;
    const dx = this.enemy.pos.x - this.player.pos.x;
    const dy = this.enemy.pos.y - this.player.pos.y;
    const d = Math.hypot(dx, dy);
    if (d >= minDist) return;
    const nx = d > 1e-6 ? dx / d : 1;
    const ny = d > 1e-6 ? dy / d : 0;
    const push = minDist - d;
    this.enemy.pos = moveCircle(
      this.enemy.pos,
      { x: nx * push, y: ny * push },
      ENEMY.radius,
      this.room.colliders,
    );
  }

  // ---- rendering ----

  private render(frameDt: number): void {
    const { player, enemy } = this;

    const hs = worldToScreen(player.pos);
    this.heroNode.setPosition(Math.round(hs.x), Math.round(hs.y)).setDepth(groundDepth(player.pos));
    const es = worldToScreen(enemy.pos);
    this.enemyNode.setPosition(Math.round(es.x), Math.round(es.y)).setDepth(groundDepth(enemy.pos));

    this.styleHero();
    this.styleEnemy();
    this.drawSwings();
    this.drawEchoStrike();
    this.drawPickup();
    this.drawBars();
    this.updateText();

    const near = this.checkpoints.canRest(COMBAT_CHECKPOINT, player);
    this.promptText.setVisible(near);

    if (this.time.now > this.messageUntil) this.messageText.setVisible(false);

    this.room.update(player.pos, frameDt, BODY_W, BODY_H);
    this.cameras.main.centerOn(Math.round(hs.x), Math.round(hs.y - BODY_H / 2));
  }

  private styleHero(): void {
    const p = this.player;
    let color = 0xc9b28a;
    let alpha = 1;
    if (p.state === "dead") {
      color = 0x555555;
      alpha = 0.6;
    } else if (p.flash > 0) {
      color = 0xffffff;
    } else if (p.state === "hurt") {
      color = 0xff8080;
    } else if (p.state === "cast") {
      color = 0x9fdcff;
    } else if (p.state === "heal") {
      color = 0x8fe3a0;
    } else if (p.state === "dodge") {
      alpha = p.isInvulnerable() ? 0.35 : 0.7;
    }
    this.heroBody.setFillStyle(color);
    this.heroNode.setAlpha(alpha);
  }

  private styleEnemy(): void {
    const e = this.enemy;
    let color = 0x8a3b3b;
    if (e.state === "dead") color = 0x444444;
    else if (e.flash > 0) color = 0xffffff;
    this.enemyBody.setFillStyle(color);
    this.enemyNode.setAlpha(e.state === "dead" ? 0.5 : 1);
    this.enemyMark.setVisible(e.state === "telegraph" || e.state === "attack");
  }

  private drawSwings(): void {
    const g = this.fx;
    g.clear();

    // Player swing: outline while winding up, filled while it can hit.
    const ps = this.player.currentSwing;
    const phase = this.player.attackPhase;
    if (ps && (phase === "windup" || phase === "active")) {
      this.drawWedge(g, ps, phase === "active" ? 0xffe9a8 : 0xffffff, phase === "active" ? 0.55 : 0.0, phase === "active" ? 1 : 0.4);
    }

    // Enemy danger area: grows more solid during the telegraph, brightest while active.
    const es = this.enemy.dangerSwing;
    if (es) {
      if (this.enemy.state === "telegraph") {
        const t = this.enemy.telegraphProgress;
        const pulse = 0.65 + 0.35 * Math.sin(this.time.now / 60);
        this.drawWedge(g, es, 0xff3b3b, 0.1 + 0.35 * t, pulse);
      } else {
        this.drawWedge(g, es, 0xffffff, 0.75, 1);
      }
    }
  }

  /** The spectral slash: a ghost figure and a cyan wedge that firms up before it lands. */
  private drawEchoStrike(): void {
    const g = this.echoFx;
    g.clear();
    const strike = this.player.echoStrike;
    if (!strike) return;
    const swing = strike.swing;
    const active = strike.state === "active";
    const t = strike.progress;
    const pulse = 0.6 + 0.4 * Math.sin(this.time.now / 50);

    this.drawWedge(g, swing, active ? 0xffffff : 0x59c8ff, active ? 0.7 : 0.08 + 0.3 * t, active ? 1 : pulse);

    // Ghost figure standing where the slash will land.
    const o = worldToScreen(swing.origin);
    g.fillStyle(0x9fdcff, active ? 0.8 : 0.25 + 0.3 * t);
    g.fillRect(Math.round(o.x - 8), Math.round(o.y - BODY_H), BODY_W, BODY_H);
    g.fillRect(Math.round(o.x - 5), Math.round(o.y - BODY_H - 10), 10, 10);
  }

  private drawWedge(
    g: Phaser.GameObjects.Graphics,
    swing: Swing,
    color: number,
    fillAlpha: number,
    lineAlpha: number,
  ): void {
    const pts = projectPoints(wedgePoints(swing.origin, swing.aim, swing.range, swing.arc));
    if (fillAlpha > 0) {
      g.fillStyle(color, fillAlpha);
      g.fillPoints(pts, true);
    }
    g.lineStyle(2, color, lineAlpha);
    g.strokePoints(pts, true);
  }

  private drawPickup(): void {
    const g = this.pickupGfx;
    g.clear();
    if (this.ledger.has(COMBAT_PICKUP.id)) return;
    const s = worldToScreen(COMBAT_PICKUP.position);
    const bob = Math.sin(this.time.now / 250) * 2;
    g.setDepth(groundDepth(COMBAT_PICKUP.position));
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(s.x, s.y, 14, 7);
    g.fillStyle(0xe8c46a, 1);
    g.fillTriangle(s.x - 7, s.y - 12 + bob, s.x + 7, s.y - 12 + bob, s.x, s.y - 24 + bob);
    g.fillTriangle(s.x - 7, s.y - 12 + bob, s.x + 7, s.y - 12 + bob, s.x, s.y - 2 + bob);
  }

  private drawBars(): void {
    // Enemy bar floats above its head, in world space.
    const wb = this.worldBars;
    wb.clear();
    if (this.enemy.alive) {
      const s = worldToScreen(this.enemy.pos);
      const w = 40;
      const x = Math.round(s.x - w / 2);
      const y = Math.round(s.y - 52);
      wb.fillStyle(0x000000, 0.7);
      wb.fillRect(x - 1, y - 1, w + 2, 7);
      wb.fillStyle(0xd23a3a, 1);
      wb.fillRect(x, y, Math.round((w * this.enemy.health.hp) / this.enemy.health.max), 5);
    }

    // Player bars are fixed to the screen.
    const hb = this.hudBars;
    hb.clear();
    const bw = 220;
    hb.fillStyle(0x000000, 0.7);
    hb.fillRect(11, 33, bw + 2, 16);
    hb.fillStyle(0x4fbf6a, 1);
    hb.fillRect(12, 34, Math.round((bw * this.player.health.hp) / this.player.health.max), 14);

    const echo = this.player.echo;
    hb.fillStyle(0x000000, 0.7);
    hb.fillRect(11, 52, bw + 2, 12);
    const pulse = echo.full ? 0.7 + 0.3 * Math.sin(this.time.now / 90) : 1;
    hb.fillStyle(echo.full ? 0xbfeaff : 0x59c8ff, pulse);
    hb.fillRect(12, 53, Math.round((bw * echo.value) / echo.max), 10);
  }

  private updateText(): void {
    const p = this.player;
    const e = this.enemy;
    this.statusText.setText(
      `Player: ${p.state}${p.state === "attack" ? ` (hit ${p.comboIndex + 1})` : ""}   HP ${p.health.hp}/${p.health.max}`,
    );
    this.echoText.setText(p.echo.full ? "Echo READY (E)" : `Echo ${p.echo.value}/${p.echo.max}`);

    const pips = Array.from({ length: HEAL.maxCharges }, (_, i) => (i < p.healCharges ? "[x]" : "[ ]")).join("");
    this.resourceText.setText(`Heal (Q): ${pips}    Ash Tokens: ${this.ledger.tokens}`);
    this.enemyStatusText.setText(`Enemy: ${e.state}   HP ${e.health.hp}/${e.health.max}`);

    if (!p.alive) {
      this.endText.setText("You died\nR: respawn at checkpoint\nN: new run").setVisible(true);
      this.hintText.setText("");
    } else {
      this.endText.setVisible(false);
      this.hintText.setText(e.alive ? "" : "Enemy defeated. Rest at the bell stone (F) to reset it.");
      this.hintText.setVisible(!e.alive);
    }
  }
}