import Phaser from "phaser";
import { Sfx } from "../audio/sfx";
import { EnemyArcher } from "../combat/archer";
import { Bolt } from "../combat/bolt";
import { Boss } from "../combat/boss";
import { CheckpointState, anyEngaged } from "../combat/checkpoint";
import { EnemyMelee } from "../combat/enemy";
import { applySwing, wedgePoints, type Swing } from "../combat/hit";
import { PlayerCombat, type PlayerInput } from "../combat/player";
import { simulationDelta } from "../core/clock";
import { moveCircle } from "../core/collision";
import { KeyboardPointerInput } from "../core/input";
import { inputToWorldDirection } from "../core/movement";
import { groundDepth, screenToWorld, worldToScreen, type Vec2 } from "../core/projection";
import { ARCHER, BOSS, ENEMY, FEEDBACK, FIXED_STEP, MAX_STEPS_PER_FRAME, PLAYER } from "../data/combatConfig";
import { ITEMS, LEVEL_HP, LEVEL_XP, XP_AWARDS, type LevelChoice } from "../data/content";
import { MAPS, anchorFor, type DoorDef, type MapDef, type NpcDef } from "../data/world";
import { freshSession, getActiveSession, persistActive, setActiveSession } from "../game/session";
import { getSettings, patchSettings } from "../game/settingsState";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, SCENE_KEYS } from "../game/config";
import { openingLine, type DialoguePage } from "../narrative/dialogue";
import { objective } from "../narrative/story";
import { browserStorage, saveSettings } from "../persistence/save";
import { projectPoints } from "./gfx";
import { RoomView } from "./RoomView";

const BODY_W = 16;
const BODY_H = 34;
type Mode = "play" | "talk" | "gear" | "journal" | "help" | "level" | "choice" | "ending" | "confirm" | "dead" | "clue";

interface Actor {
  xpId: string;
  melee?: EnemyMelee;
  archer?: EnemyArcher;
  boss?: Boss;
  node: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  mark: Phaser.GameObjects.Text;
}

/**
 * The adventure: town, watchtower road, and the Kneeling Watchman.
 * One session owns quests, items and the checkpoint. This scene owns the fight.
 */
export class PlayScene extends Phaser.Scene {
  private controls!: KeyboardPointerInput;
  private room!: RoomView;
  private map!: MapDef;
  private player!: PlayerCombat;
  private checkpoints!: CheckpointState;
  private actors: Actor[] = [];
  private bolts: { bolt: Bolt; node: Phaser.GameObjects.Arc }[] = [];
  private sfx = new Sfx(getSettings);
  private swingCounter = 0;
  private aim: Vec2 = { x: 1, y: 0 };
  private accumulator = 0;
  private hitStop = 0;
  private focusPaused = false;
  private mode: Mode = "play";
  private page: DialoguePage | null = null;
  private messageUntil = 0;
  private modal: Phaser.GameObjects.GameObject[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private pickupMarks = new Map<string, Phaser.GameObjects.Arc>();
  private hud!: Phaser.GameObjects.Graphics;
  private objectiveText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private heroNode!: Phaser.GameObjects.Container;
  private heroBody!: Phaser.GameObjects.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super(SCENE_KEYS.play);
  }

  create(): void {
    const session = getActiveSession();
    this.map = MAPS[session.map];
    this.swingCounter = 0;
    this.actors = [];
    this.bolts = [];
    this.accumulator = 0;
    this.hitStop = 0;
    this.focusPaused = false;
    this.mode = "play";
    this.page = null;
    this.messageUntil = 0;
    this.modal = [];
    this.aim = { x: 1, y: 0 };

    this.cameras.main.setBackgroundColor("#100e16");
    this.cameras.main.setRoundPixels(true);
    this.room = new RoomView(this, this.map.room);
    const anchor = anchorFor(session.checkpointId);
    this.player = new PlayerCombat(1, anchor, () => ++this.swingCounter);
    if (session.progression.choice === "health") this.player.health.raiseMax(LEVEL_HP);
    this.player.applyMods(session.mods());
    this.checkpoints = new CheckpointState(session.checkpointId, anchor);
    this.fx = this.add.graphics();
    this.drawMarkers();
    this.spawnActors();
    this.buildHero();
    this.buildHud();
    this.controls = new KeyboardPointerInput(this);
    this.bindKeys();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.sfx.unlock());
    this.input.keyboard?.on("keydown", () => this.sfx.unlock());
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.onFocus, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onFocus, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    if (session.storageWarning) this.say("Progress this session will not be saved.");
    if (session.story.status === "complete" && !session.endingDismissed) this.openEnding();
  }

  update(_time: number, deltaMs: number): void {
    this.controls.poll();
    this.readMenus();
    if (this.mode === "dead") {
      if (this.down("R")) this.scene.restart();
      this.render(0);
      return;
    }
    const frameDt = this.focusPaused || this.mode !== "play" ? 0 : simulationDelta(deltaMs);
    this.updateAim();
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
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    if (this.player.state === "dead" && this.mode === "play") this.openDead();
    const boss = this.boss();
    if (boss?.state === "choice" && this.mode === "play") this.openChoice();
    if (getActiveSession().progression.ready && this.mode === "play") this.openLevel();
    this.render(frameDt);
  }

  private step(dt: number): void {
    const session = getActiveSession();
    const player = this.player;
    const colliders = this.room.colliders;
    if (this.controls.consumeInteract()) this.interact();

    const input: PlayerInput = {
      moveDir: inputToWorldDirection(this.controls.getMove()),
      aim: this.aim,
      attackPressed: this.controls.consumeAttack(),
      dodgePressed: this.controls.consumeDodge(),
      echoPressed: this.controls.consumeEcho(),
      healPressed: this.controls.consumeHeal(),
    };
    const hadStrike = player.echoStrike;
    const charges = player.healCharges;
    const hp = player.health.hp;
    const velocity = player.update(dt, input);
    if (!hadStrike && player.echoStrike) {
      this.sfx.play("echo");
      this.say("Echo Strike");
      if (this.boss() && this.boss()?.state !== "dead") {
        const line = session.hearEchoLine();
        if (line) {
          session.echoNotice = null;
          this.say(line);
        }
      }
    }
    if (player.healCharges < charges) {
      this.sfx.play("heal");
      this.say("Healed");
    }
    if (velocity.x !== 0 || velocity.y !== 0) {
      player.pos = moveCircle(player.pos, { x: velocity.x * dt, y: velocity.y * dt }, PLAYER.radius, colliders);
    }

    for (const actor of this.actors) {
      const foe = actor.melee ?? actor.archer ?? actor.boss;
      if (!foe) continue;
      const vel = foe.update(dt, player.pos, player.alive);
      if (vel.x !== 0 || vel.y !== 0) {
        const radius = actor.boss ? BOSS.radius : actor.archer ? ARCHER.radius : ENEMY.radius;
        foe.pos = moveCircle(foe.pos, { x: vel.x * dt, y: vel.y * dt }, radius, colliders);
      }
      this.pushApart(foe.pos, actor.boss ? BOSS.radius : actor.archer ? ARCHER.radius : ENEMY.radius);
      const launched = actor.archer?.takeBolt();
      if (launched) this.bolts.push({ bolt: launched, node: this.add.circle(0, 0, 5, 0xffb25a) });
    }

    for (const entry of this.bolts) {
      entry.bolt.update(dt);
      const room = this.map.room;
      const outside = entry.bolt.pos.x < 32 || entry.bolt.pos.y < 32 || entry.bolt.pos.x > (room.cols - 1) * 32 || entry.bolt.pos.y > (room.rows - 1) * 32;
      if (outside) entry.bolt.alive = false;
      if (entry.bolt.alive && player.alive) entry.bolt.tryHit(player, player.pos);
    }
    this.bolts = this.bolts.filter((entry) => {
      if (entry.bolt.alive) return true;
      entry.node.destroy();
      return false;
    });

    this.resolvePlayer(player.activeSwing);
    this.resolvePlayer(player.echoStrike?.activeSwing ?? null);
    for (const actor of this.actors) {
      const swing = actor.melee?.activeSwing ?? actor.boss?.activeSwing ?? null;
      if (swing && player.alive) {
        if (actor.boss) swing.origin = { ...actor.boss.pos };
        const before = player.health.hp;
        applySwing(swing, player, player.pos);
        if (player.health.hp < before) this.sfx.play("hurt");
      }
    }
    if (player.health.hp < hp && getSettings().shake) this.cameras.main.shake(80, 0.003);
    this.collectPickups();
  }

  private resolvePlayer(swing: Swing | null): void {
    if (!swing) return;
    for (const actor of this.actors) {
      const foe = actor.melee ?? actor.archer ?? actor.boss;
      if (!foe || !foe.health.alive || (actor.boss && actor.boss.state === "spared")) continue;
      const outcome = applySwing(swing, foe, foe.pos);
      if (outcome === "applied" || outcome === "killed") {
        this.player.registerHit(swing);
        this.sfx.play("hit");
        this.hitStop = outcome === "killed" ? FEEDBACK.killHitStop : FEEDBACK.hitStop;
      }
      if (outcome === "killed") this.onDefeat(actor);
    }
  }

  private onDefeat(actor: Actor): void {
    const session = getActiveSession();
    const grant = session.grantXp(actor.xpId);
    if (grant.gained) this.say(`Experience +${XP_AWARDS[actor.xpId] ?? 0}`);
    if (actor.boss) {
      session.resolve("kill");
      this.player.applyMods(session.mods());
      this.say("Aldren's Blade is yours. Press I to see it.");
      this.showEchoNotice();
      persistActive(browserStorage());
    } else if (grant.gained) {
      persistActive(browserStorage());
    }
    if (session.progression.ready) this.openLevel();
  }

  private interact(): void {
    const session = getActiveSession();
    const npc = this.nearestNpc();
    if (npc) {
      if (npc.id === "watchman" && session.story.outcome !== "spare") return;
      const page = openingLine(npc.id, session.story);
      if (page) this.openTalk(page);
      return;
    }
    const door = this.nearestDoor();
    const engaged = this.inFight();
    const restHere = this.checkpoints.canRest(this.map.checkpoint, this.player, engaged);
    const doorDist = door ? Math.hypot(door.pos.x - this.player.pos.x, door.pos.y - this.player.pos.y) : Infinity;
    const restDist = Math.hypot(this.map.checkpoint.position.x - this.player.pos.x, this.map.checkpoint.position.y - this.player.pos.y);
    if (door && (!restHere || doorDist < restDist)) {
      this.go(door);
      return;
    }
    if (engaged && this.checkpoints.atStone(this.map.checkpoint, this.player)) {
      this.say("You cannot rest while an enemy is hunting you.");
      return;
    }
    if (this.checkpoints.rest(this.map.checkpoint, this.player, this.resetables(), engaged)) {
      this.clearBolts();
      session.checkpointId = this.map.checkpoint.id;
      persistActive(browserStorage());
      this.sfx.play("rest");
      this.say("Rested. Checkpoint saved. Enemies reset.");
    }
  }

  private go(door: DoorDef): void {
    const session = getActiveSession();
    session.travel(door.to, door.arrive);
    persistActive(browserStorage());
    this.scene.start(SCENE_KEYS.play);
  }

  private collectPickups(): void {
    const session = getActiveSession();
    for (const pickup of this.map.pickups) {
      if (session.hasCollected(pickup.id)) continue;
      if (Math.hypot(this.player.pos.x - pickup.pos.x, this.player.pos.y - pickup.pos.y) > pickup.range) continue;
      if (pickup.kind === "clue") {
        session.findClue();
        this.boss()?.setClueKnown(true);
        persistActive(browserStorage());
        this.openClue();
      } else if (pickup.itemId) {
        session.own(pickup.itemId);
        persistActive(browserStorage());
        this.say(`${ITEMS[pickup.itemId]?.name ?? "Item"} found. Press I to equip it outside a fight.`);
      }
      this.pickupMarks.get(pickup.id)?.setVisible(false);
    }
  }

  private readMenus(): void {
    if (this.mode === "play") {
      if (this.down("I")) this.openGear();
      else if (this.down("J")) this.openJournal();
      else if (this.down("H")) this.openHelp();
      else if (this.down("ESC")) this.openHelp();
      return;
    }
    if (this.down("ESC") && (this.mode === "talk" || this.mode === "gear" || this.mode === "journal" || this.mode === "help" || this.mode === "clue")) {
      this.closeModal();
      return;
    }
    if (this.mode === "talk") this.pickOption(this.optionIndex());
    if (this.mode === "gear") this.equipIndex(this.optionIndex());
    if (this.mode === "level") this.pickLevel(this.optionIndex());
    if (this.mode === "choice") this.pickChoice(this.optionIndex());
    if (this.mode === "ending") this.pickEnding(this.optionIndex());
    if (this.mode === "confirm") this.pickConfirm(this.optionIndex());
    if (this.mode === "help") this.readSettingsKeys();
    if ((this.mode === "journal" || this.mode === "clue" || this.mode === "help") && this.down("F")) this.closeModal();
  }

  private optionIndex(): number {
    if (this.down("ONE")) return 0;
    if (this.down("TWO")) return 1;
    if (this.down("THREE")) return 2;
    return -1;
  }

  private pickOption(index: number): void {
    const option = this.page?.options[index];
    if (!option) return;
    const session = getActiveSession();
    if (option.effect === "accept") session.acceptQuest();
    if (option.effect === "complete") session.finishQuest();
    if (option.effect !== "close") persistActive(browserStorage());
    this.sfx.play("ui");
    this.closeModal();
    if (session.story.status === "complete") this.openEnding();
  }

  private equipIndex(index: number): void {
    const ids = getActiveSession().loadout.ownedIds();
    const id = ids[index];
    if (!id) return;
    if (this.inFight()) {
      this.say("Leave the fight before changing gear.");
      return;
    }
    getActiveSession().equip(id);
    this.player.applyMods(getActiveSession().mods());
    persistActive(browserStorage());
    this.sfx.play("ui");
    this.openGear();
  }

  private pickLevel(index: number): void {
    const choice = (["health", "damage", "echo"] as const)[index];
    if (!choice) return;
    this.applyLevel(choice);
  }

  private applyLevel(choice: LevelChoice): void {
    const session = getActiveSession();
    if (!session.chooseLevel(choice)) return;
    if (choice === "health") this.player.health.raiseMax(LEVEL_HP);
    this.player.applyMods(session.mods());
    persistActive(browserStorage());
    this.sfx.play("ui");
    this.say(choice === "health" ? "Maximum health increased." : choice === "damage" ? "Basic attacks hit harder." : "Basic hits build more Echo.");
    this.closeModal();
  }

  private pickChoice(index: number): void {
    const boss = this.boss();
    if (!boss) return;
    if (index === 0) {
      boss.spare();
      getActiveSession().resolve("spare");
      this.player.applyMods(getActiveSession().mods());
      persistActive(browserStorage());
      this.showEchoNotice();
      this.say("You spoke his name. He keeps the charm. The Watchman's Vow is yours.");
      this.closeModal();
    } else if (index === 1) {
      boss.decline();
      this.say("The Watchman raises his blade again.");
      this.closeModal();
    }
  }

  private pickEnding(index: number): void {
    if (index === 0) {
      getActiveSession().endingDismissed = true;
      this.closeModal();
    } else if (index === 1) {
      this.closeModal();
      this.openConfirm();
    }
  }

  private pickConfirm(index: number): void {
    if (index === 0) {
      const storage = browserStorage();
      if (storage) storage.removeItem("hollow-bell-save");
      setActiveSession(freshSession());
      persistActive(storage);
      this.scene.start(SCENE_KEYS.play);
    } else if (index === 1) {
      this.closeModal();
    }
  }

  private readSettingsKeys(): void {
    let changed = false;
    if (this.down("M")) {
      patchSettings({ muted: !getSettings().muted });
      changed = true;
    }
    if (this.down("K")) {
      patchSettings({ shake: !getSettings().shake });
      changed = true;
    }
    if (this.down("L")) {
      patchSettings({ reducedFlash: !getSettings().reducedFlash });
      changed = true;
    }
    if (this.down("COMMA")) {
      patchSettings({ master: Math.max(0, Math.round((getSettings().master - 0.1) * 10) / 10) });
      changed = true;
    }
    if (this.down("PERIOD")) {
      patchSettings({ master: Math.min(1, Math.round((getSettings().master + 0.1) * 10) / 10) });
      changed = true;
    }
    if (!changed) return;
    const storage = browserStorage();
    if (storage) saveSettings(storage, getSettings());
    this.sfx.play("ui");
    this.openHelp();
  }

  private openTalk(page: DialoguePage): void {
    this.mode = "talk";
    this.page = page;
    this.controls.reset();
    this.showPanel(page.speaker, [page.text], page.options.map((option, i) => `${i + 1}. ${option.label}`));
  }

  private openGear(): void {
    this.mode = "gear";
    this.controls.reset();
    const session = getActiveSession();
    const lines = ["Numbers or a click equip an item. Esc closes. Gear changes only while nothing is chasing you."];
    const options = session.loadout.ownedIds().map((id, i) => {
      const item = ITEMS[id];
      const worn = id === session.loadout.swordId || id === session.loadout.charmId ? "worn" : "bag";
      return `${i + 1}. ${item?.name ?? id} (${worn}) — ${item?.blurb ?? ""}`;
    });
    this.showPanel("Equipment", lines, options.length ? options : ["Nothing else to equip"]);
  }

  private openJournal(): void {
    this.mode = "journal";
    this.controls.reset();
    const story = getActiveSession().story;
    const lines = [objective(story)];
    if (story.clueKnown) lines.push("Clue: the forgotten brother is named Aldren.");
    if (story.outcome === "kill") lines.push("Outcome: the Watchman fell. Aldren's Blade is yours.");
    if (story.outcome === "spare") lines.push("Outcome: you spoke Aldren's name. He kept the charm.");
    this.showPanel("Journal", lines, ["Esc or F closes"]);
  }

  private openHelp(): void {
    this.mode = "help";
    this.controls.reset();
    const s = getSettings();
    this.showPanel("Help", [
      "WASD move. Mouse aims. Click attacks. Click again for the second hit. Space dodges.",
      "E Echo Strike when the meter is full. Q heals. F talks, rests, or uses a door.",
      "I equipment. J journal. H help.",
      `M mute (${s.muted ? "on" : "off"}). K shake (${s.shake ? "on" : "off"}). L reduced flashes (${s.reducedFlash ? "on" : "off"}).`,
      `, and . change volume (${Math.round(s.master * 100)}%). Audio starts after you click or press a key.`,
      "Dying returns you to the last rest or doorway. Unsaved fighting is lost. One save slot on this browser.",
    ], ["Esc closes"]);
  }

  private openClue(): void {
    this.mode = "clue";
    this.controls.reset();
    this.showPanel("Scratched stone", ["The letters are still sharp: ALDREN. The brother the town cannot recall."], ["Esc or F closes"]);
  }

  private openLevel(): void {
    if (this.mode === "level") return;
    this.mode = "level";
    this.controls.reset();
    this.showPanel(`Level up (${LEVEL_XP} experience)`, ["Choose once. It cannot be changed."], [
      "1. Maximum health +25",
      "2. Basic attack damage +4",
      "3. Echo gained per hit +20",
    ]);
  }

  private openChoice(): void {
    this.mode = "choice";
    this.controls.reset();
    this.showPanel("The Watchman waits", ["He knows the sword. The bell has not taken this moment."], [
      "1. Speak the name Aldren",
      "2. Keep fighting",
    ]);
  }

  private openEnding(): void {
    if (getActiveSession().endingDismissed) return;
    this.mode = "ending";
    this.controls.reset();
    const spare = getActiveSession().story.outcome === "spare";
    this.showPanel("The Hollow Bell", [
      spare
        ? "Aldren stands in the square. Bram has his brother, and the charm stayed where it was worn."
        : "The tower is quiet. Bram hangs the blade by the forge and says the name where the bell cannot reach.",
      "This is the end of the prototype. You can keep walking, or begin again.",
    ], ["1. Keep walking", "2. New game"]);
  }

  private openDead(): void {
    this.mode = "dead";
    this.controls.reset();
    this.showPanel("You fall", ["R returns you to the last checkpoint. Experience, items and the quest stay."], ["R respawn"]);
  }

  private openConfirm(): void {
    this.mode = "confirm";
    this.controls.reset();
    this.showPanel("New game", ["This erases the saved bell on this browser."], ["1. Erase and begin", "2. Cancel"]);
  }

  private showPanel(title: string, lines: string[], options: string[]): void {
    this.clearModal();
    const bg = this.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 150, 900, 250, 0x16131d, 0.94).setScrollFactor(0).setDepth(2_000_000);
    const heading = this.add.text(40, LOGICAL_HEIGHT - 260, title, { fontFamily: "Georgia, serif", fontSize: "28px", color: "#f4efe2" }).setScrollFactor(0).setDepth(2_000_001);
    const body = this.add.text(40, LOGICAL_HEIGHT - 220, lines.join("\n"), { fontFamily: "Georgia, serif", fontSize: "18px", color: "#f4efe2", wordWrap: { width: 880 } }).setScrollFactor(0).setDepth(2_000_001);
    this.modal.push(bg, heading, body);
    options.forEach((label, index) => {
      const button = this.add.text(40, LOGICAL_HEIGHT - 120 + index * 28, label, { fontFamily: "monospace", fontSize: "18px", color: "#1a1722", backgroundColor: "#e6d7a8", padding: { x: 8, y: 4 } }).setScrollFactor(0).setDepth(2_000_001).setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => {
        this.controls.consumeAttack();
        if (this.mode === "talk") this.pickOption(index);
        else if (this.mode === "gear") this.equipIndex(index);
        else if (this.mode === "level") this.pickLevel(index);
        else if (this.mode === "choice") this.pickChoice(index);
        else if (this.mode === "ending") this.pickEnding(index);
        else if (this.mode === "confirm") this.pickConfirm(index);
        else if (this.mode === "dead") this.scene.restart();
        else this.closeModal();
      });
      this.modal.push(button);
    });
  }

  private closeModal(): void {
    this.clearModal();
    this.page = null;
    this.mode = "play";
    this.controls.reset();
  }

  private clearModal(): void {
    for (const node of this.modal) node.destroy();
    this.modal = [];
  }

  private showEchoNotice(): void {
    const line = getActiveSession().echoNotice;
    if (!line) return;
    getActiveSession().echoNotice = null;
    this.say(line);
  }

  private render(frameDt: number): void {
    const hs = worldToScreen(this.player.pos);
    this.heroNode.setPosition(Math.round(hs.x), Math.round(hs.y)).setDepth(groundDepth(this.player.pos));
    this.styleHero();
    for (const actor of this.actors) {
      const foe = actor.melee ?? actor.archer ?? actor.boss;
      if (!foe) continue;
      const at = worldToScreen(foe.pos);
      actor.node.setPosition(Math.round(at.x), Math.round(at.y)).setDepth(groundDepth(foe.pos));
      const flash = foe.flash > 0 && !getSettings().reducedFlash;
      actor.body.setFillStyle(foe.health.alive ? (flash ? 0xffffff : actor.boss ? 0x6d4a86 : actor.archer ? 0x8a5a32 : 0x8a3b3b) : 0x444444);
      const telegraph = actor.melee?.state === "telegraph" || actor.archer?.state === "telegraph" || actor.boss?.state === "telegraph" || actor.boss?.state === "attack";
      actor.mark.setVisible(telegraph);
      if (actor.boss && telegraph) actor.mark.setText(`${actor.boss.patternId}!`);
    }
    for (const entry of this.bolts) {
      const at = worldToScreen(entry.bolt.pos);
      entry.node.setPosition(at.x, at.y).setDepth(groundDepth(entry.bolt.pos));
    }
    this.drawSwings();
    this.drawHud();
    this.room.update(this.player.pos, frameDt, BODY_W, BODY_H);
    this.cameras.main.centerOn(Math.round(hs.x), Math.round(hs.y - BODY_H / 2));
    this.promptText.setText(this.prompt());
    if (this.time.now > this.messageUntil && this.mode === "play") this.messageText.setVisible(false);
    this.pauseText.setVisible(this.focusPaused && this.mode === "play");
  }

  private styleHero(): void {
    const p = this.player;
    let color = 0xc9b28a;
    let alpha = 1;
    if (!p.alive) color = 0x555555;
    else if (p.flash > 0 && !getSettings().reducedFlash) color = 0xffffff;
    else if (p.flash > 0) color = 0xd37a4a;
    else if (p.state === "hurt") color = 0xe08080;
    else if (p.state === "cast") color = 0x9fdcff;
    else if (p.state === "heal") color = 0x8fe3a0;
    else if (p.state === "dodge") alpha = p.isInvulnerable() ? 0.35 : 0.75;
    this.heroBody.setFillStyle(color);
    this.heroNode.setAlpha(alpha);
  }

  private drawSwings(): void {
    const g = this.fx;
    g.clear();
    const swing = this.player.currentSwing;
    const phase = this.player.attackPhase;
    if (swing && (phase === "windup" || phase === "active")) {
      this.wedge(g, swing, phase === "active" ? 0xffe9a8 : 0xffffff, phase === "active" ? 0.45 : 0);
    }
    const echo = this.player.echoStrike;
    if (echo) this.wedge(g, echo.swing, 0x7fd4ff, echo.state === "active" ? 0.55 : 0.18);
    for (const actor of this.actors) {
      const danger = actor.melee?.dangerSwing ?? actor.boss?.dangerSwing ?? null;
      if (!danger) continue;
      this.wedge(g, danger, 0xff5a4a, 0.28);
    }
  }

  private wedge(g: Phaser.GameObjects.Graphics, swing: Swing, color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    g.lineStyle(2, color, 0.9);
    const points = projectPoints(wedgePoints(swing.origin, swing.aim, swing.range, swing.arc));
    g.fillPoints(points, true);
    g.strokePoints(points, true);
  }

  private drawHud(): void {
    const p = this.player;
    const session = getActiveSession();
    const g = this.hud;
    g.clear();
    g.fillStyle(0x1a1722, 0.88);
    g.fillRect(8, 8, 360, 62);
    g.fillStyle(0x6d2430, 1);
    g.fillRect(16, 36, 220, 12);
    g.fillStyle(0xd45462, 1);
    g.fillRect(16, 36, Math.round((220 * p.health.hp) / p.health.max), 12);
    g.fillStyle(0x1c3c55, 1);
    g.fillRect(16, 52, 140, 8);
    g.fillStyle(p.echo.full ? 0x9fdcff : 0x3d7ea8, 1);
    g.fillRect(16, 52, Math.round((140 * p.echo.value) / p.echo.max), 8);
    const sword = ITEMS[session.loadout.swordId]?.name ?? "Sword";
    const charm = session.loadout.charmId ? ITEMS[session.loadout.charmId]?.name : "no charm";
    this.objectiveText.setText(objective(session.story));
    this.resourceText.setText(`HP ${p.health.hp}/${p.health.max}  Echo ${Math.round(p.echo.value)}  Heals ${p.healCharges}  ${sword} / ${charm}  XP ${session.progression.total}`);
  }

  private prompt(): string {
    if (this.mode !== "play") return "";
    const npc = this.nearestNpc();
    if (npc && (npc.id !== "watchman" || getActiveSession().story.outcome === "spare")) return "F: talk";
    if (this.checkpoints.atStone(this.map.checkpoint, this.player)) return this.inFight() ? "Cannot rest during a fight" : "F: rest";
    const door = this.nearestDoor();
    return door ? door.label : "";
  }

  private nearestNpc(): NpcDef | null {
    return nearest(this.map.npcs.filter((npc) => npc.id !== "watchman" || getActiveSession().story.outcome === "spare"), this.player.pos);
  }

  private nearestDoor(): DoorDef | null {
    return nearest(this.map.doors, this.player.pos);
  }

  private boss(): Boss | null {
    return this.actors.find((actor) => actor.boss)?.boss ?? null;
  }

  private inFight(): boolean {
    return anyEngaged(this.actors.map((actor) => actor.melee?.state ?? actor.archer?.state ?? actor.boss?.state ?? "idle"));
  }

  private resetables(): { reset(): void }[] {
    return this.actors.flatMap((actor) => {
      const foe = actor.melee ?? actor.archer ?? actor.boss;
      return foe ? [foe] : [];
    });
  }

  private pushApart(pos: Vec2, radius: number): void {
    const min = PLAYER.radius + radius;
    const dx = pos.x - this.player.pos.x;
    const dy = pos.y - this.player.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= min) return;
    const nx = dist > 1e-6 ? dx / dist : 1;
    const ny = dist > 1e-6 ? dy / dist : 0;
    const moved = moveCircle(pos, { x: nx * (min - dist), y: ny * (min - dist) }, radius, this.room.colliders);
    pos.x = moved.x;
    pos.y = moved.y;
  }

  private clearBolts(): void {
    for (const entry of this.bolts) entry.node.destroy();
    this.bolts = [];
  }

  private say(text: string): void {
    this.messageText.setText(text).setVisible(true);
    this.messageUntil = this.time.now + 2600;
  }

  private down(name: string): boolean {
    const key = this.keys[name];
    return key ? Phaser.Input.Keyboard.JustDown(key) : false;
  }

  private spawnActors(): void {
    const session = getActiveSession();
    for (const spawn of this.map.melee) this.actors.push(this.makeActor(spawn.xpId, new EnemyMelee(10 + this.actors.length, spawn.pos, () => ++this.swingCounter)));
    for (const spawn of this.map.archers) this.actors.push(this.makeActor(spawn.xpId, new EnemyArcher(20 + this.actors.length, spawn.pos, () => ++this.swingCounter)));
    if (this.map.boss && session.story.outcome === null) {
      const boss = new Boss(30, this.map.boss.pos, () => ++this.swingCounter);
      boss.setClueKnown(session.story.clueKnown);
      this.actors.push(this.makeActor(this.map.boss.xpId, boss));
    }
    for (const npc of this.map.npcs) {
      if (npc.id === "watchman" && session.story.outcome !== "spare") continue;
      const at = worldToScreen(npc.pos);
      const label = npc.id === "bram" ? "Bram" : npc.id === "mara" ? "Mara" : npc.id === "oren" ? "Oren" : "Aldren";
      this.add.text(at.x, at.y - 46, label, { fontFamily: "monospace", fontSize: "14px", color: "#f4efe2" }).setOrigin(0.5, 1).setDepth(groundDepth(npc.pos) + 1);
      this.add.rectangle(at.x, at.y, 14, 28, npc.id === "watchman" ? 0x6d4a86 : 0xd9d2b8).setOrigin(0.5, 1).setDepth(groundDepth(npc.pos));
    }
  }

  private makeActor(xpId: string, foe: EnemyMelee | EnemyArcher | Boss): Actor {
    const node = this.add.container(0, 0);
    const body = this.add.rectangle(0, 0, foe instanceof Boss ? 22 : 16, foe instanceof Boss ? 40 : 30, 0x8a3b3b).setOrigin(0.5, 1);
    const mark = this.add.text(0, foe instanceof Boss ? -52 : -40, "!", { fontFamily: "monospace", fontSize: "16px", color: "#ffe08a" }).setOrigin(0.5, 1);
    node.add([body, mark]);
    const actor: Actor = { xpId, node, body, mark };
    if (foe instanceof EnemyMelee) actor.melee = foe;
    else if (foe instanceof EnemyArcher) actor.archer = foe;
    else actor.boss = foe;
    return actor;
  }

  private buildHero(): void {
    this.heroNode = this.add.container(0, 0);
    this.heroBody = this.add.rectangle(0, 0, BODY_W, BODY_H, 0xc9b28a).setOrigin(0.5, 1);
    const head = this.add.rectangle(0, -BODY_H, 10, 10, 0xe6d3b0).setOrigin(0.5, 1);
    this.heroNode.add([this.heroBody, head]);
  }

  private buildHud(): void {
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(1_000_000);
    const style = { fontFamily: "monospace", fontSize: "16px", color: "#f4efe2" };
    this.objectiveText = this.add.text(16, 14, "", { ...style, fontSize: "16px", color: "#f4efe2" }).setScrollFactor(0).setDepth(1_000_001);
    this.resourceText = this.add.text(16, LOGICAL_HEIGHT - 28, "", style).setScrollFactor(0).setDepth(1_000_001);
    this.messageText = this.add.text(LOGICAL_WIDTH / 2, 90, "", { fontFamily: "Georgia, serif", fontSize: "20px", color: "#1a1722", backgroundColor: "#e6d7a8", padding: { x: 8, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(1_000_002).setVisible(false);
    this.promptText = this.add.text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 56, "", { fontFamily: "monospace", fontSize: "18px", color: "#1a1722", backgroundColor: "#e6d7a8", padding: { x: 8, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(1_000_002);
    this.pauseText = this.add.text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, "Paused", { fontFamily: "monospace", fontSize: "28px", color: "#f4efe2", backgroundColor: "#000000cc", padding: { x: 12, y: 8 } }).setOrigin(0.5).setScrollFactor(0).setDepth(1_000_003).setVisible(false);
    this.add.text(LOGICAL_WIDTH - 210, 16, this.map.title, { fontFamily: "Georgia, serif", fontSize: "22px", color: "#f4efe2" }).setScrollFactor(0).setDepth(1_000_001);
  }

  private drawMarkers(): void {
    const g = this.add.graphics().setDepth(1);
    const stone = worldToScreen(this.map.checkpoint.position);
    g.fillStyle(0x8d8a9e, 1);
    g.fillCircle(stone.x, stone.y, 8);
    for (const pickup of this.map.pickups) {
      if (getActiveSession().hasCollected(pickup.id)) continue;
      const at = worldToScreen(pickup.pos);
      const mark = this.add.circle(at.x, at.y, 7, pickup.kind === "clue" ? 0xe6d7a8 : 0x7dcea0).setDepth(2);
      this.pickupMarks.set(pickup.id, mark);
    }
    for (const door of this.map.doors) {
      const at = worldToScreen(door.pos);
      g.lineStyle(2, 0xe6d7a8, 1);
      g.strokeCircle(at.x, at.y, 12);
    }
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error("Keyboard input is not available");
    const code = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      R: kb.addKey(code.R),
      I: kb.addKey(code.I),
      J: kb.addKey(code.J),
      H: kb.addKey(code.H),
      ESC: kb.addKey(code.ESC),
      ONE: kb.addKey(code.ONE),
      TWO: kb.addKey(code.TWO),
      THREE: kb.addKey(code.THREE),
      M: kb.addKey(code.M),
      K: kb.addKey(code.K),
      L: kb.addKey(code.L),
      COMMA: kb.addKey(code.COMMA),
      PERIOD: kb.addKey(code.PERIOD),
      F: kb.addKey(code.F),
    };
  }

  private updateAim(): void {
    const pointer = this.controls.getPointerScreen();
    if (!pointer) return;
    const target = screenToWorld(pointer);
    const dx = target.x - this.player.pos.x;
    const dy = target.y - this.player.pos.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) this.aim = { x: dx / len, y: dy / len };
  }

  private onBlur(): void {
    this.focusPaused = true;
    this.controls.reset();
  }

  private onFocus(): void {
    this.focusPaused = false;
    this.controls.reset();
    this.accumulator = 0;
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onBlur, this);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.onFocus, this);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.onFocus, this);
    this.clearBolts();
    this.clearModal();
    const kb = this.input.keyboard;
    if (kb && this.keys) for (const key of Object.values(this.keys)) kb.removeKey(key, true);
    this.controls.destroy();
  }
}

function nearest<T extends { pos: Vec2; range: number }>(items: readonly T[], pos: Vec2): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const dist = Math.hypot(item.pos.x - pos.x, item.pos.y - pos.y);
    if (dist <= item.range && dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}
