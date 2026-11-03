/**
 * On-screen messages, shown one at a time in the order they were raised.
 *
 * Several messages can be raised in the same frame (for example the kill of the
 * Watchman gives experience, a sword and Echo's line). Before this queue, each one
 * replaced the last and only the final one was seen.
 *
 * - A message shows for `fullMs` when nothing is waiting behind it.
 * - When another message is waiting, the current one moves on after `minMs`,
 *   so a burst of messages does not lag far behind play.
 * - A message equal to the one showing, or to the last one waiting, is dropped
 *   (repeated "Healed" or "Echo Strike" do not pile up).
 * - At most `maxPending` messages wait. The oldest waiting one is dropped first.
 * Time is passed in by the caller, so the queue follows the scene clock.
 */
export class MessageQueue {
  private showing: { text: string; since: number } | null = null;
  private readonly pending: string[] = [];

  constructor(
    readonly fullMs = 2600,
    readonly minMs = 1400,
    readonly maxPending = 3,
  ) {}

  push(text: string, now: number): void {
    const last = this.pending[this.pending.length - 1] ?? (this.showing && this.current(now));
    if (text === last) return;
    if (!this.showing) {
      this.showing = { text, since: now };
      return;
    }
    this.pending.push(text);
    while (this.pending.length > this.maxPending) this.pending.shift();
  }

  /** The message to show at `now`, or null when there is none. */
  current(now: number): string | null {
    while (this.showing) {
      const limit = this.pending.length > 0 ? this.minMs : this.fullMs;
      if (now - this.showing.since < limit) return this.showing.text;
      const next = this.pending.shift();
      this.showing = next === undefined ? null : { text: next, since: this.showing.since + limit };
      // A message that was waiting starts no earlier than now minus its own minimum,
      // so a long pause (a modal, a blurred tab) does not skip it unseen.
      if (this.showing && now - this.showing.since >= this.minMs) this.showing.since = now;
    }
    return null;
  }

  get waiting(): number {
    return this.pending.length;
  }

  clear(): void {
    this.showing = null;
    this.pending.length = 0;
  }
}
