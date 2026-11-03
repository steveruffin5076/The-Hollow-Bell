import type { Swing } from "./hit";

/** Echo resource. Only gain(), spend() and reset() change it. Always within 0..max. */
export class EchoMeter {
  value = 0;
  constructor(readonly max: number) {}

  get full(): boolean {
    return this.value >= this.max;
  }

  /** Adds Echo, clamped to the maximum. Returns the amount actually added. */
  gain(amount: number): number {
    if (amount <= 0) return 0;
    const added = Math.min(amount, this.max - this.value);
    this.value += added;
    return added;
  }

  /** Empties a full meter. Returns false (and changes nothing) if it is not full. */
  spend(): boolean {
    if (!this.full) return false;
    this.value = 0;
    return true;
  }

  reset(): void {
    this.value = 0;
  }
}

export type EchoStrikeState = "pending" | "active" | "done" | "cancelled";

/**
 * One delayed spectral slash. Driven only by update(dt), so it uses simulation
 * time and owns no Phaser timers. cancel() makes it permanently harmless.
 *
 *   pending -> active   after `delay`
 *   active  -> done     after `active`
 *   pending/active -> cancelled   via cancel()
 */
export class EchoStrike {
  state: EchoStrikeState = "pending";
  time = 0;

  constructor(
    readonly swing: Swing,
    private readonly delay: number,
    private readonly activeTime: number,
  ) {}

  get finished(): boolean {
    return this.state === "done" || this.state === "cancelled";
  }

  /** Non-null only while the slash can hit. */
  get activeSwing(): Swing | null {
    return this.state === "active" ? this.swing : null;
  }

  /** 0..1 progress of the delay. 1 once it has landed. */
  get progress(): number {
    return this.state === "pending" ? Math.min(1, this.time / this.delay) : 1;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.time += dt;
    if (this.state === "pending" && this.time >= this.delay) this.state = "active";
    if (this.state === "active" && this.time >= this.delay + this.activeTime) this.state = "done";
  }

  cancel(): void {
    if (!this.finished) this.state = "cancelled";
  }
}
