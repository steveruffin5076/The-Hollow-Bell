import type { Settings } from "../persistence/save";

type Tone = "hit" | "hurt" | "echo" | "heal" | "rest" | "ui";

/**
 * Short tones made in the browser. Nothing is loaded from a file.
 * Playback starts only after unlock(), which must follow a user gesture.
 */
export class Sfx {
  private ctx: AudioContext | null = null;

  constructor(private readonly settings: () => Settings) {}

  unlock(): void {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    void this.ctx.resume();
  }

  play(kind: Tone): void {
    const settings = this.settings();
    if (!this.ctx || settings.muted || settings.master <= 0) return;
    const spec = SPECS[kind];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;
    gain.gain.value = spec.gain * settings.master;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
    osc.stop(now + spec.dur);
  }
}

const SPECS: Record<Tone, { freq: number; dur: number; gain: number; type: OscillatorType }> = {
  hit: { freq: 220, dur: 0.06, gain: 0.08, type: "square" },
  hurt: { freq: 110, dur: 0.12, gain: 0.1, type: "sawtooth" },
  echo: { freq: 520, dur: 0.18, gain: 0.06, type: "triangle" },
  heal: { freq: 340, dur: 0.14, gain: 0.05, type: "sine" },
  rest: { freq: 180, dur: 0.28, gain: 0.07, type: "triangle" },
  ui: { freq: 440, dur: 0.04, gain: 0.04, type: "square" },
};
