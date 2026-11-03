import type { Vec2 } from "../core/projection";
import { ECHO, HEAL, PLAYER } from "../data/combatConfig";
import type { CombatMods } from "../progression/loadout";
import { EchoMeter, EchoStrike } from "./echo";
import { Health, type Hittable, type Swing } from "./hit";

const NO_MODS: CombatMods = {
  damageFlat: 0,
  echoGainFlat: 0,
  echoDamageFlat: 0,
  incomingReduction: 0,
  healBonus: 0,
};

export type PlayerState = "idle" | "move" | "attack" | "dodge" | "hurt" | "dead" | "cast" | "heal";

export interface PlayerInput {
  /** Unit world direction, or zero. */
  moveDir: Vec2;
  /** Unit world aim direction toward the pointer. */
  aim: Vec2;
  /** True only on the step where the button went down (not while held). */
  attackPressed: boolean;
  dodgePressed: boolean;
  echoPressed: boolean;
  healPressed: boolean;
}

const ZERO: Vec2 = { x: 0, y: 0 };

/**
 * Player combat state machine. Transition rules:
 *
 *   idle/move -> dodge    dodge pressed and cooldown finished
 *   idle/move -> cast     Echo pressed, meter full, no Echo Strike in flight
 *   idle/move -> heal     heal pressed, charges left, health below maximum
 *   idle/move -> attack   attack pressed and no lockout
 *   attack    -> attack   one buffered press during swing 1 starts swing 2
 *   attack    -> idle     swing finished (lockout starts)
 *   dodge/cast -> idle    time finished
 *   heal      -> idle     time finished: one charge spent, health restored (clamped)
 *   any alive -> hurt     receiveHit, unless invulnerable. Cancels attack and heal.
 *                         An interrupted heal costs nothing.
 *   hurt      -> idle     hurt time finished
 *   any       -> dead     health reaches zero (final). Cancels the Echo Strike.
 *
 * Priority when several buttons are pressed on one step: dodge, Echo, heal, attack.
 * Presses are ignored in every other state. Time advances only through update(dt).
 */
export class PlayerCombat implements Hittable {
  readonly health = new Health(PLAYER.maxHp);
  readonly echo = new EchoMeter(ECHO.max);
  pos: Vec2;
  state: PlayerState = "idle";
  stateTime = 0;
  comboIndex = 0;
  healCharges: number = HEAL.maxCharges;
  /** The spectral slash in flight, or null. At most one at a time. */
  echoStrike: EchoStrike | null = null;
  /** Seconds of remaining hit flash, for visuals. */
  flash = 0;

  private swing: Swing | null = null;
  private buffered = false;
  private lockedAim: Vec2 = { x: 1, y: 0 };
  private dodgeDir: Vec2 = { x: 1, y: 0 };
  private invulnRemaining = 0;
  private dodgeCooldown = 0;
  private attackLockout = 0;
  private mods: CombatMods = { ...NO_MODS };

  /** Replaces combat modifiers. Does not add to the previous values. */
  applyMods(mods: CombatMods): void {
    this.mods = { ...mods };
  }

  constructor(
    readonly id: number,
    pos: Vec2,
    private readonly nextSwingId: () => number,
  ) {
    this.pos = { ...pos };
  }

  get alive(): boolean {
    return this.health.alive;
  }

  /** The swing currently able to hit, or null. Exposed only during the active window. */
  get activeSwing(): Swing | null {
    if (this.state !== "attack" || !this.swing) return null;
    const a = PLAYER.attacks[this.comboIndex];
    if (!a) return null;
    return this.stateTime >= a.windup && this.stateTime < a.windup + a.active ? this.swing : null;
  }

  /** The swing being prepared or executed (for drawing the reach), or null. */
  get currentSwing(): Swing | null {
    return this.state === "attack" ? this.swing : null;
  }

  get attackPhase(): "windup" | "active" | "recovery" | null {
    if (this.state !== "attack") return null;
    const a = PLAYER.attacks[this.comboIndex];
    if (!a) return null;
    if (this.stateTime < a.windup) return "windup";
    if (this.stateTime < a.windup + a.active) return "active";
    return "recovery";
  }

  /** 0..1 progress of a heal in progress, 0 otherwise. */
  get healProgress(): number {
    return this.state === "heal" ? Math.min(1, this.stateTime / HEAL.duration) : 0;
  }

  isInvulnerable(): boolean {
    if (this.invulnRemaining > 0) return true;
    const d = PLAYER.dodge;
    return this.state === "dodge" && this.stateTime >= d.invulnStart && this.stateTime < d.invulnEnd;
  }

  /** Advances one step. Returns the desired velocity in world units per second. */
  update(dt: number, input: PlayerInput): Vec2 {
    if (this.state === "dead") return ZERO;

    this.invulnRemaining = Math.max(0, this.invulnRemaining - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.attackLockout = Math.max(0, this.attackLockout - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.stateTime += dt;

    // The Echo Strike advances on its own clock, whatever the player is doing.
    if (this.echoStrike) {
      this.echoStrike.update(dt);
      if (this.echoStrike.finished) this.echoStrike = null;
    }

    switch (this.state) {
      case "idle":
      case "move":
        return this.updateFree(input);
      case "attack":
        return this.updateAttack(input);
      case "dodge":
        return this.updateDodge();
      case "cast":
        if (this.stateTime >= ECHO.castDuration) this.enter("idle", this.stateTime - ECHO.castDuration);
        return ZERO;
      case "heal":
        if (this.stateTime >= HEAL.duration) this.completeHeal();
        return ZERO;
      case "hurt":
        if (this.stateTime >= PLAYER.hurtDuration) this.enter("idle", this.stateTime - PLAYER.hurtDuration);
        return ZERO;
      default:
        return ZERO;
    }
  }

  receiveHit(damage: number, _swing: Swing): void {
    if (this.state === "dead") return;
    const reduced = this.mods.incomingReduction > 0 ? Math.max(1, damage - this.mods.incomingReduction) : damage;
    this.health.damage(reduced);
    this.flash = PLAYER.flashDuration;
    this.swing = null;
    this.buffered = false;
    if (!this.health.alive) {
      this.cancelEchoStrike();
      this.enter("dead");
      return;
    }
    this.invulnRemaining = PLAYER.hurtInvulnerability;
    this.enter("hurt");
  }

  /**
   * Call when one of the player's swings hit a target. Only successful basic
   * hits give Echo. Echo hits and other sources give nothing.
   */
  registerHit(swing: Swing): void {
    if (swing.source === "basic") this.echo.gain(ECHO.gainPerBasicHit + this.mods.echoGainFlat);
  }

  /**
   * Full restore used by rest and respawn: health, heal charges, Echo to empty,
   * no pending swing or Echo Strike, no timers. Optionally moves the player.
   */
  restoreFull(pos?: Vec2): void {
    this.health.restore();
    this.healCharges = HEAL.maxCharges;
    this.echo.reset();
    this.cancelEchoStrike();
    this.swing = null;
    this.buffered = false;
    this.comboIndex = 0;
    this.invulnRemaining = 0;
    this.dodgeCooldown = 0;
    this.attackLockout = 0;
    this.flash = 0;
    if (pos) this.pos = { ...pos };
    this.enter("idle");
  }

  private cancelEchoStrike(): void {
    this.echoStrike?.cancel();
    this.echoStrike = null;
  }

  private enter(state: PlayerState, carry = 0): void {
    this.state = state;
    this.stateTime = carry;
  }

  private updateFree(input: PlayerInput): Vec2 {
    if (input.dodgePressed && this.dodgeCooldown <= 0) {
      this.dodgeDir = isZero(input.moveDir) ? { ...input.aim } : { ...input.moveDir };
      this.dodgeCooldown = PLAYER.dodge.cooldown;
      this.enter("dodge");
      return scale(this.dodgeDir, PLAYER.dodge.speed);
    }
    if (input.echoPressed && this.echo.full && this.echoStrike === null) {
      this.castEcho(input.aim);
      return ZERO;
    }
    if (input.healPressed && this.healCharges > 0 && this.health.hp < this.health.max) {
      this.enter("heal");
      return ZERO;
    }
    if (input.attackPressed && this.attackLockout <= 0) {
      this.startAttack(0, input.aim, 0);
      return ZERO;
    }
    if (isZero(input.moveDir)) {
      if (this.state !== "idle") this.enter("idle");
      return ZERO;
    }
    if (this.state !== "move") this.enter("move");
    return scale(input.moveDir, PLAYER.moveSpeed);
  }

  /** Spends the meter once and starts exactly one Echo Strike. */
  private castEcho(aim: Vec2): void {
    if (!this.echo.spend()) return;
    const lockedAim = { ...aim };
    const swing: Swing = {
      id: this.nextSwingId(),
      attackerId: this.id,
      source: "echo",
      damage: ECHO.damage + this.mods.echoDamageFlat,
      origin: {
        x: this.pos.x + lockedAim.x * ECHO.spawnDistance,
        y: this.pos.y + lockedAim.y * ECHO.spawnDistance,
      },
      aim: lockedAim,
      range: ECHO.range,
      arc: ECHO.arc,
      hitTargets: new Set<number>(),
    };
    this.echoStrike = new EchoStrike(swing, ECHO.delay, ECHO.active);
    this.enter("cast");
  }

  /** Spends one charge and heals, only if the heal ran to the end. */
  private completeHeal(): void {
    const carry = this.stateTime - HEAL.duration;
    if (this.health.hp < this.health.max && this.healCharges > 0) {
      this.healCharges -= 1;
      this.health.heal(HEAL.amount + this.mods.healBonus);
    }
    this.enter("idle", carry);
  }

  private startAttack(index: number, aim: Vec2, carry: number): void {
    const a = PLAYER.attacks[index];
    if (!a) return;
    this.comboIndex = index;
    this.lockedAim = { ...aim };
    this.buffered = false;
    this.swing = {
      id: this.nextSwingId(),
      attackerId: this.id,
      source: "basic",
      damage: a.damage + this.mods.damageFlat,
      origin: { ...this.pos },
      aim: this.lockedAim,
      range: a.range,
      arc: a.arc,
      hitTargets: new Set<number>(),
    };
    this.enter("attack", carry);
  }

  private updateAttack(input: PlayerInput): Vec2 {
    const a = PLAYER.attacks[this.comboIndex];
    if (!a) {
      this.enter("idle");
      return ZERO;
    }
    // At most one queued follow-up, and only from the first swing.
    if (input.attackPressed && this.comboIndex === 0) this.buffered = true;

    const total = a.windup + a.active + a.recovery;
    if (this.stateTime >= total) {
      const carry = this.stateTime - total;
      this.swing = null;
      if (this.buffered && this.comboIndex === 0) {
        this.startAttack(1, input.aim, carry);
      } else {
        this.attackLockout = this.comboIndex === 0 ? PLAYER.lockoutAfterSingle : PLAYER.lockoutAfterCombo;
        this.buffered = false;
        this.enter("idle", carry);
      }
    }
    return ZERO;
  }

  private updateDodge(): Vec2 {
    if (this.stateTime >= PLAYER.dodge.duration) {
      this.enter("idle", this.stateTime - PLAYER.dodge.duration);
      return ZERO;
    }
    return scale(this.dodgeDir, PLAYER.dodge.speed);
  }
}

function isZero(v: Vec2): boolean {
  return v.x === 0 && v.y === 0;
}

function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}
