/**
 * Combat tuning. All times are seconds of simulation time, distances are world
 * units, angles are radians. These numbers are starting hypotheses, not final.
 */
const deg = (d: number): number => (d * Math.PI) / 180;

/** Fixed simulation step. Gameplay always advances in steps of exactly this size. */
export const FIXED_STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 4;

export interface AttackStep {
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  range: number;
  arc: number;
}

export const PLAYER = {
  maxHp: 100,
  radius: 8,
  moveSpeed: 150,
  /** Two-hit sequence. The second swing is slower and stronger. */
  attacks: [
    { windup: 0.1, active: 0.1, recovery: 0.18, damage: 10, range: 46, arc: deg(110) },
    { windup: 0.08, active: 0.1, recovery: 0.3, damage: 15, range: 52, arc: deg(130) },
  ] as AttackStep[],
  /** Time after a swing sequence ends before a new one may start. Stops spam. */
  lockoutAfterSingle: 0.12,
  lockoutAfterCombo: 0.25,
  hurtDuration: 0.3,
  /** Extra invulnerability after being hit. Prevents chain stun-lock. */
  hurtInvulnerability: 0.6,
  flashDuration: 0.12,
  dodge: {
    duration: 0.28,
    /** Invulnerable while time since dodge start is in [invulnStart, invulnEnd). */
    invulnStart: 0.03,
    invulnEnd: 0.18,
    speed: 260,
    /** Measured from the start of a dodge. */
    cooldown: 0.6,
  },
} as const;

export const ENEMY = {
  maxHp: 40,
  radius: 10,
  moveSpeed: 75,
  aggroRange: 240,
  /** Distance (centre to centre) at which the enemy starts its attack. */
  triggerRange: 40,
  telegraph: 0.7,
  attack: { active: 0.12, damage: 15, range: 50, arc: deg(100) },
  recover: 0.8,
  flashDuration: 0.12,
} as const;

/** Echo meter and Echo Strike (a delayed spectral slash). */
export const ECHO = {
  max: 100,
  /** Gained only when a basic swing hits. Echo hits and enemy hits give nothing. */
  gainPerBasicHit: 40,
  /** Player is rooted this long after activating. */
  castDuration: 0.25,
  /** The spectral slash appears this far ahead of the player, along the locked aim. */
  spawnDistance: 36,
  /** Time between activation and the slash landing. */
  delay: 0.7,
  /** How long the slash can hit once it lands. */
  active: 0.12,
  damage: 35,
  range: 84,
  arc: deg(150),
} as const;

export const HEAL = {
  maxCharges: 3,
  amount: 40,
  /** Player is rooted this long. A heal completes only if not interrupted by a hit. */
  duration: 0.7,
} as const;

export const FEEDBACK = {
  hitStop: 0.05,
  killHitStop: 0.09,
} as const;

/** Slow ranged attacker on the watchtower road. */
export const ARCHER = {
  maxHp: 30,
  radius: 10,
  moveSpeed: 50,
  aggroRange: 280,
  preferredRange: 150,
  tooClose: 90,
  telegraph: 0.85,
  recover: 1.0,
  boltSpeed: 110,
  boltDamage: 12,
  boltRadius: 8,
  boltLife: 1.6,
  flashDuration: 0.12,
} as const;

/** The Kneeling Watchman. Three telegraphed attacks, then one choice if the clue is known. */
export const BOSS = {
  maxHp: 140,
  thresholdHp: 70,
  radius: 14,
  moveSpeed: 60,
  aggroRange: 340,
  triggerRange: 56,
  recover: 0.75,
  flashDuration: 0.12,
  attacks: [
    { id: "overhead", telegraph: 0.85, active: 0.14, damage: 22, range: 58, arc: deg(80), lunge: 0 },
    { id: "sweep", telegraph: 0.7, active: 0.16, damage: 16, range: 72, arc: deg(200), lunge: 0 },
    { id: "thrust", telegraph: 0.6, active: 0.28, damage: 24, range: 46, arc: deg(50), lunge: 160 },
  ],
} as const;
