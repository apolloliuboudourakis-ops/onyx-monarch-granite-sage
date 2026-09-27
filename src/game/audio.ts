import type { Cmd, RootState } from "./types";

type Sound = "ui" | "shot" | "gold" | "win" | "cover";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem("ashveil-mute", v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadMuted(): boolean {
  try {
    muted = localStorage.getItem("ashveil-mute") === "1";
  } catch {
    muted = false;
  }
  return muted;
}

function ac(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  const W = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext || W.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.035, slide = 0): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

export function play(kind: Sound): void {
  if (kind === "ui") tone(520, 0.045, "sine", 0.028);
  else if (kind === "shot") tone(168, 0.1, "triangle", 0.05, -90);
  else if (kind === "cover") tone(210, 0.14, "sine", 0.03, -70);
  else if (kind === "gold") {
    tone(520, 0.08, "sine", 0.035);
    window.setTimeout(() => tone(780, 0.11, "sine", 0.035), 80);
  } else {
    [523, 659, 784].forEach((f, i) => window.setTimeout(() => tone(f, 0.16, "sine", 0.04), i * 120));
  }
}

export function cue(cmd: Cmd["type"], prev: RootState, next: RootState): void {
  if (next === prev || cmd === "cursor" || cmd === "note-save") return;
  if (next.screen === "victory" && prev.screen !== "victory") return play("win");
  if (next.screen === "handoff" && prev.screen !== "handoff") return play("cover");
  if (next.screen === "battle" && prev.screen === "handoff") return play("gold");
  if ((next.match?.fx.length ?? 0) > (prev.match?.fx.length ?? 0)) return play("shot");
  play("ui");
}
