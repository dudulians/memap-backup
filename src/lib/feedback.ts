// Centralised sound + haptic feedback for swipe interactions.
//
// Sound design notes
// - Single shared AudioContext (browsers cap ~6 contexts per tab).
// - Sine waves with a smooth attack/decay envelope — no harsh square-edged
//   clicks, no exponentialRamp to 0 (which causes a hard cut on some devices).
// - Swipes (Nov 3 2026, her: "старый звук очень плохой"): a card sliding off
//   to the right (Yes) or left (No) and a soft page turn (Skip), real CC0
//   recordings; the old tones (Yes a rising third, No a falling one) stay as
//   the fallback until they load.
//
// Haptics
// - Native (iOS/Android via Capacitor): uses @capacitor/haptics Impact, which
//   gives proper system-level haptic feedback (especially Taptic Engine on
//   iOS — `navigator.vibrate` doesn't work there at all).
// - Web fallback: navigator.vibrate when available.

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import pop1 from "@/assets/sounds/pop-1.mp3";
import pop2 from "@/assets/sounds/pop-2.mp3";
import pop3 from "@/assets/sounds/pop-3.mp3";
import pop4 from "@/assets/sounds/pop-4.mp3";
import drop from "@/assets/sounds/drop.mp3";
import sparkle from "@/assets/sounds/sparkle.mp3";
import thump from "@/assets/sounds/thump.mp3";
import sea from "@/assets/sounds/sea.mp3";
import swipeYes from "@/assets/sounds/swipe-yes.mp3";
import swipeNo from "@/assets/sounds/swipe-no.mp3";
import swipeSkip from "@/assets/sounds/swipe-skip.mp3";
import wheelTick from "@/assets/sounds/wheel-tick.mp3";

type FeedbackKind = "yes" | "no" | "skip";

/** Every sound is off for now (her note, Nov 4 2026: "звуки пока везде
 *  плохие", vibrations instead). Each place that played one also taps, so
 *  nothing goes quiet; false brings them all back with the Settings switch. */
export const SOUNDS_PAUSED = true;
/** …except the bubbles (her note, Nov 5 2026: "надо оставить их в баблз"):
 *  "Unload your mind" keeps its pops, merges, bursts and quiet sea, with its
 *  own mute button. Everything else stays quiet while SOUNDS_PAUSED. */
export const BUBBLE_SOUNDS = true;
const BUBBLE_SET = new Set<string>(["pop1", "pop2", "pop3", "pop4", "drop", "sea"]);

let audioCtx: AudioContext | null = null;
let unlockAttached = false;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
};

/**
 * iOS leaves the context "interrupted" (not "suspended") after Control Center, a call or another app's sound, and
 * it may not come back by itself: the bubbles stayed silent after she unmuted the phone until the app was
 * restarted (her note, Nov 10 2026). Any state but "running" is woken; a context still stuck a moment later is
 * replaced by a new one (decoded sounds are kept; the sea starts again in the new one).
 */
let stuckSince = 0;
const onNewCtx = new Set<() => void>();
const wake = (): AudioContext | null => {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === "running") { stuckSince = 0; return ctx; }
  ctx.resume().catch(() => { /* ignore */ });
  if (ctx.state === "suspended") return ctx;
  // "interrupted" or "closed"
  if (!stuckSince) stuckSince = Date.now();
  if (ctx.state === "closed" || Date.now() - stuckSince > 600) {
    try { void ctx.close(); } catch { /* already closed */ }
    audioCtx = null;
    stuckSince = 0;
    const fresh = getCtx();
    if (fresh) { fresh.resume().catch(() => { /* ignore */ }); onNewCtx.forEach((f) => f()); }
    return fresh;
  }
  return ctx;
};

/**
 * Mobile browsers (and most WebViews) require a user gesture before an
 * AudioContext can make sound. Attaching unlock handlers to the first
 * pointerdown/touchstart/keydown resumes the context so the very first
 * swipe after app launch plays audibly.
 */
export const primeAudio = () => {
  if ((SOUNDS_PAUSED && !BUBBLE_SOUNDS) || unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;
  const unlock = () => { wake(); };
  const opts: AddEventListenerOptions = { once: false, passive: true };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  // back from Control Center, a call or another app: wake the sound at once (no new context without a tap)
  const back = () => { if (document.visibilityState === "visible" && audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => { /* ignore */ }); };
  document.addEventListener("visibilitychange", back);
  window.addEventListener("focus", back);
  window.addEventListener("pageshow", back);
};

const envelope = (
  ctx: AudioContext,
  gain: GainNode,
  peak: number,
  attack: number,
  hold: number,
  release: number,
) => {
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.linearRampToValueAtTime(peak, t + attack + hold);
  gain.gain.linearRampToValueAtTime(0.0001, t + attack + hold + release);
};

const tone = (
  ctx: AudioContext,
  frequencies: number[],
  opts: { start?: number; duration: number; peak?: number; type?: OscillatorType } = { duration: 0.25 },
) => {
  const { start = 0, duration, peak = 0.12, type = "sine" } = opts;

  const master = ctx.createGain();
  master.connect(ctx.destination);
  envelope(ctx, master, peak, 0.012, duration * 0.55, duration * 0.45);

  const startAt = ctx.currentTime + start;
  const stopAt = ctx.currentTime + start + duration + 0.05;

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    // Layer secondary oscillators quieter so the fundamental stays clear.
    og.gain.value = i === 0 ? 1 : 0.35;
    osc.connect(og).connect(master);
    osc.start(startAt);
    osc.stop(stopAt);
  });
};

const playYes = (ctx: AudioContext) => {
  // Rising major third: C5 → E5, with a soft octave layer for warmth.
  tone(ctx, [523.25, 1046.5], { start: 0, duration: 0.12, peak: 0.11 });
  tone(ctx, [659.25, 1318.5], { start: 0.09, duration: 0.18, peak: 0.11 });
};

const playNo = (ctx: AudioContext) => {
  // Falling minor third: A4 → F4 — gentle "nope", not buzzy.
  tone(ctx, [440, 880], { start: 0, duration: 0.12, peak: 0.1 });
  tone(ctx, [349.23, 698.46], { start: 0.09, duration: 0.2, peak: 0.1 });
};

const playSkip = (ctx: AudioContext) => {
  // Neutral single tone, quieter.
  tone(ctx, [392, 784], { start: 0, duration: 0.14, peak: 0.07 });
};

export const playSwipeSound = (kind: FeedbackKind) => {
  if (!soundOn()) return;
  // woken on every call: "suspended" after a tab switch, "interrupted" after Control Center (wake above)
  const ctx = wake();
  if (!ctx) return;
  try {
    const name = kind === "yes" ? "swipeYes" : kind === "no" ? "swipeNo" : "swipeSkip";
    if (sample(ctx, name, { rate: vary(0.04), pan: kind === "yes" ? 0.35 : kind === "no" ? -0.35 : 0 })) return;
    if (kind === "yes") playYes(ctx);
    else if (kind === "no") playNo(ctx);
    else playSkip(ctx);
  } catch {
    // swallow — audio should never block the UI
  }
};

// --- Game sounds ("Unload your mind", Nov 2026: "звуки, когда лопаются пузыри") ---
// Real recordings since Nov 3 2026 (her: "звуки из баз, а не кодом"): small
// CC0 files from Freesound in src/assets/sounds (CREDITS.md there), played
// through Web Audio so each one is pitched by size, a little different each
// time and panned to where it happened. Until a file has loaded, the sound
// made here plays instead, so a tap is never silent.
// Ambient audio on iOS: the silent switch mutes it and music keeps playing.

/** The app's sound setting (Settings → sounds), on unless she turned it off. */
export const soundOn = (): boolean => {
  if (SOUNDS_PAUSED) return false;
  try {
    const raw = localStorage.getItem("memap_session_settings");
    return raw ? JSON.parse(raw)?.soundEnabled !== false : true;
  } catch {
    return true;
  }
};

/** The bubbles' own sound switch: on while BUBBLE_SOUNDS (the game's mute button decides). */
const bubbleSoundOn = (): boolean => BUBBLE_SOUNDS || soundOn();

const ready = (): AudioContext | null => {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== "ambient") nav.audioSession.type = "ambient";
  } catch { /* older WebViews */ }
  return wake();
};

/** Where a sound sits, left (-1) to right (1); plain output where panning isn't there. */
const outAt = (ctx: AudioContext, pan: number): AudioNode => {
  const p = (ctx as AudioContext & { createStereoPanner?: () => StereoPannerNode }).createStereoPanner?.();
  if (!p) return ctx.destination;
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(ctx.destination);
  return p;
};

let noise: AudioBuffer | null = null;
/** One second of soft noise, made once. */
const noiseBuffer = (ctx: AudioContext) => {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
};

/** A soap bubble popping: a tiny wet click and a short rising "plip". */
const plip = (ctx: AudioContext, size: number, pan: number, start = 0, peak = 1) => {
  const t = ctx.currentTime + start;
  const out = outAt(ctx, pan);
  // the click: 25 ms of noise through a narrow band
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200 - 1400 * size;
  band.Q.value = 5;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t);
  cg.gain.linearRampToValueAtTime(0.16 * peak, t + 0.002);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
  src.connect(band).connect(cg).connect(out);
  src.start(t, Math.random() * 0.5, 0.04);
  // the plip: a sine that rises a little, like a drop
  const f0 = (1150 - 520 * size) * (0.9 + Math.random() * 0.2);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f0 * 0.82, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 1.28, t + 0.045);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.linearRampToValueAtTime((0.07 + 0.04 * size) * peak, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07 + 0.05 * size);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + 0.16);
};

// The recordings (CC0, Freesound; src/assets/sounds/CREDITS.md).
const FILES = { pop1, pop2, pop3, pop4, drop, sparkle, thump, sea, swipeYes, swipeNo, swipeSkip, wheelTick } as const;
type Sound = keyof typeof FILES;
/** How loud each file sits next to the others. */
const LEVEL: Record<Sound, number> = { pop1: 1, pop2: 1, pop3: 0.7, pop4: 1.3, drop: 0.9, sparkle: 0.35, thump: 1, sea: 1, swipeYes: 0.35, swipeNo: 0.38, swipeSkip: 0.6, wheelTick: 0.05 };
const decoded = new Map<Sound, AudioBuffer | null>();
const loading = new Map<Sound, Promise<AudioBuffer | null>>();

/** A file's bytes; the tiniest come inlined as data: URLs. */
const bytes = async (url: string): Promise<ArrayBuffer> => {
  if (url.startsWith("data:")) {
    const bin = atob(url.slice(url.indexOf(",") + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  return (await fetch(url)).arrayBuffer();
};
const load = (ctx: AudioContext, name: Sound): Promise<AudioBuffer | null> => {
  let p = loading.get(name);
  if (!p) {
    p = bytes(FILES[name])
      // the callback form: older iOS WebViews return no promise here
      .then((buf) => new Promise<AudioBuffer>((ok, no) => ctx.decodeAudioData(buf, ok, no)))
      .then((buf) => { decoded.set(name, buf); return buf; })
      .catch(() => { decoded.set(name, null); return null; });
    loading.set(name, p);
  }
  return p;
};

/** Start loading what a game will play, so its first sound is on time. */
export const preloadSounds = (...names: Sound[]) => {
  const list = SOUNDS_PAUSED ? names.filter((n) => BUBBLE_SOUNDS && BUBBLE_SET.has(n)) : names;
  if (!list.length) return;
  const ctx = getCtx();
  if (ctx) list.forEach((n) => void load(ctx, n));
};

/** Plays a recording now; false while it hasn't loaded (the caller falls back). */
const sample = (ctx: AudioContext, name: Sound, o: { rate?: number; gain?: number; pan?: number; at?: number; lowpass?: number } = {}): boolean => {
  const buf = decoded.get(name);
  if (!buf) { void load(ctx, name); return false; }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = o.rate ?? 1;
  const g = ctx.createGain();
  g.gain.value = (o.gain ?? 1) * LEVEL[name];
  let head: AudioNode = src;
  if (o.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = o.lowpass;
    head = head.connect(lp);
  }
  head.connect(g).connect(outAt(ctx, o.pan ?? 0));
  src.start(ctx.currentTime + (o.at ?? 0));
  return true;
};

/** A little different each time: the rate ± n. */
const vary = (n = 0.08) => 1 - n + Math.random() * 2 * n;
const oneOf = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const SMALL = ["pop1", "pop4"] as const;
const BIG = ["pop2", "pop3"] as const;

/** A bubble popping; size 0 (small) .. 1 (big), x 0 (left) .. 1 (right). */
export const playPop = (size = 0.3, x = 0.5) => {
  if (!bubbleSoundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  const z = Math.max(0, Math.min(1, size));
  const pan = (x - 0.5) * 1.4;
  try {
    if (!sample(ctx, oneOf(z > 0.5 ? BIG : SMALL), { rate: (1.3 - 0.5 * z) * vary(), gain: 0.3 + 0.2 * z, pan })) plip(ctx, z, pan);
  } catch { /* audio never blocks the UI */ }
};
/** Two bubbles joining: a soft low blub. */
export const playMerge = (x = 0.5) => {
  if (!bubbleSoundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    if (sample(ctx, "drop", { rate: 0.7 * vary(0.06), gain: 0.26, pan: (x - 0.5) * 1.2, lowpass: 1500 })) return;
    const t = ctx.currentTime;
    const out = outAt(ctx, (x - 0.5) * 1.2);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(230, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.18);
  } catch { /* ignore */ }
};
/** A big bubble bursting: one round pop and a spray of small ones. */
export const playBurst = (x = 0.5) => {
  if (!bubbleSoundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  const pan = (x - 0.5) * 1.4;
  try {
    if (sample(ctx, oneOf(BIG), { rate: 0.85 * vary(), gain: 0.5, pan })) {
      [0.045, 0.085, 0.13].forEach((at, k) => sample(ctx, oneOf(SMALL), { rate: (1.35 + 0.15 * k) * vary(), gain: 0.2, pan: pan + (k - 1) * 0.35, at }));
      return;
    }
    [0.9, 0.55, 0.3, 0.15].forEach((z, k) => plip(ctx, z, pan + (k - 1.5) * 0.25, k * 0.038, 0.85));
  } catch { /* ignore */ }
};

/** A recorded quiet beach, looping softly. */
const seaFrom = (ctx: AudioContext, buf: AudioBuffer) => {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  // past the encoder's padding at both ends; the file's end runs into its start
  src.loopStart = 0.05;
  src.loopEnd = buf.duration - 0.05;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.2, t + 2);
  src.connect(g).connect(ctx.destination);
  src.start(t, 0.05);
  return () => {
    const e = ctx.currentTime;
    g.gain.cancelScheduledValues(e);
    g.gain.setValueAtTime(g.gain.value, e);
    g.gain.linearRampToValueAtTime(0, e + 0.6);
    src.stop(e + 0.7);
  };
};
/** Made-here waves (soft noise rising and falling), if the file can't load. */
const madeSea = (ctx: AudioContext) => {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0;
  // waves: the volume swells every ~7 s
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.14;
  const depth = ctx.createGain();
  depth.gain.value = 0.012;
  lfo.connect(depth).connect(g.gain);
  src.connect(lp).connect(g).connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.022, t + 1.5);
  src.start(t);
  lfo.start(t);
  return () => {
    const e = ctx.currentTime;
    g.gain.cancelScheduledValues(e);
    g.gain.setValueAtTime(g.gain.value, e);
    g.gain.linearRampToValueAtTime(0, e + 0.6);
    src.stop(e + 0.7);
    lfo.stop(e + 0.7);
  };
};
/** A quiet sea under the game. Returns a stop function (fades out). */
export const startSea = (): (() => void) => {
  if (!bubbleSoundOn()) return () => undefined;
  const ctx = ready();
  if (!ctx) return () => undefined;
  let stop: (() => void) | null = null;
  let stopped = false;
  const play = (c: AudioContext) => {
    void load(c, "sea").then((buf) => {
      if (stopped) return;
      try { stop = buf ? seaFrom(c, buf) : madeSea(c); } catch { /* no sea, the game goes on */ }
    });
  };
  play(ctx);
  // the old context was replaced (wake): the sea goes on in the new one
  const again = () => { if (stopped || !audioCtx) return; try { stop?.(); } catch { /* old one is gone */ } play(audioCtx); };
  onNewCtx.add(again);
  return () => { stopped = true; onNewCtx.delete(again); stop?.(); };
};
/** A thought kept for later: a small sparkle. */
export const playKeep = () => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    if (sample(ctx, "sparkle", { gain: 0.45, rate: 1.1 })) return;
    tone(ctx, [659.25], { start: 0, duration: 0.1, peak: 0.07 });
    tone(ctx, [987.77], { start: 0.08, duration: 0.16, peak: 0.07 });
  } catch { /* ignore */ }
};
/** Something found or earned: a chest card, a checked hunch, a test's result. */
export const playSparkle = (gain = 0.5) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    if (sample(ctx, "sparkle", { gain })) return;
    tone(ctx, [783.99], { start: 0, duration: 0.12, peak: 0.06 });
    tone(ctx, [1174.66], { start: 0.09, duration: 0.2, peak: 0.06 });
  } catch { /* ignore */ }
};
/** A card landing softly. */
export const playThump = () => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try { if (!sample(ctx, "thump", { gain: 0.45, rate: vary(0.05) })) tone(ctx, [196], { duration: 0.12, peak: 0.06 }); } catch { /* ignore */ }
};
/** A soft dull "tok": the wheel's sound until its recording has loaded. */
const tok = (ctx: AudioContext) => {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(820, t);
  osc.frequency.exponentialRampToValueAtTime(420, t + 0.03);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  osc.connect(g).connect(outAt(ctx, 0));
  osc.start(t);
  osc.stop(t + 0.06);
};
/** The path rolling past a step, like a picker wheel: one soft wooden tick
 *  of a clock (her note, Nov 3 2026: the pitched-up water drop before it was
 *  "очень резкий"). */
export const playWheelTick = () => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try { if (!sample(ctx, "wheelTick", { rate: vary(0.04) })) tok(ctx); } catch { /* ignore */ }
};
/** An island pressed: a soft round "bloop" in the water, where it is. */
export const playBloop = (x = 0.5) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try { if (!sample(ctx, "drop", { gain: 0.3, rate: 0.82 * vary(0.05), pan: (x - 0.5) * 1.2, lowpass: 1900 })) plip(ctx, 0.7, (x - 0.5) * 1.2); } catch { /* ignore */ }
};
/** A choice ticked (higher) or unticked (lower): a tiny pop. */
export const playTick = (on = true) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try { if (!sample(ctx, "pop1", { gain: 0.18, rate: on ? 1.55 : 1.2 })) plip(ctx, on ? 0 : 0.4, 0, 0, 0.6); } catch { /* ignore */ }
};

export const triggerHaptic = async (kind: "light" | "medium" | "heavy") => {
  // Prefer the native Capacitor plugin on iOS/Android — especially on iOS
  // where `navigator.vibrate` is a no-op. We log every step so that if
  // haptics still don't fire on TestFlight we can connect Safari Web
  // Inspector to the iPhone and see exactly where the call falls off.
  const native = (() => {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  })();

  if (native) {
    try {
      const style =
        kind === "light" ? ImpactStyle.Light :
        kind === "medium" ? ImpactStyle.Medium :
        ImpactStyle.Heavy;
      await Haptics.impact({ style });
      return;
    } catch (err) {
      // Plugin call failed — most often this means the SPM package
      // didn't link properly (Package.swift had backslash paths) or
      // the plugin class isn't registered. Surfacing the error in the
      // console so we can see it in Web Inspector.
      console.warn("[haptics] Capacitor Haptics.impact failed", err);
    }
  }

  // Web fallback. iOS Safari ignores navigator.vibrate, so this only
  // helps Android and desktop dev. On iOS native this branch only runs
  // when the Capacitor plugin call above threw.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const duration = kind === "light" ? 10 : kind === "medium" ? 25 : 40;
    try { navigator.vibrate(duration); } catch { /* ignore */ }
  }
};
