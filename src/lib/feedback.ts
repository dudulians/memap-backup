// Centralised sound + haptic feedback for swipe interactions.
//
// Sound design notes
// - Single shared AudioContext (browsers cap ~6 contexts per tab).
// - Sine waves with a smooth attack/decay envelope — no harsh square-edged
//   clicks, no exponentialRamp to 0 (which causes a hard cut on some devices).
// - Pleasant intervals: Yes = rising major 3rd, No = falling minor 3rd, Skip
//   = soft single tone. All pitched in a mellow mid register.
//
// Haptics
// - Native (iOS/Android via Capacitor): uses @capacitor/haptics Impact, which
//   gives proper system-level haptic feedback (especially Taptic Engine on
//   iOS — `navigator.vibrate` doesn't work there at all).
// - Web fallback: navigator.vibrate when available.

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

type FeedbackKind = "yes" | "no" | "skip";

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
 * Mobile browsers (and most WebViews) require a user gesture before an
 * AudioContext can make sound. Attaching unlock handlers to the first
 * pointerdown/touchstart/keydown resumes the context so the very first
 * swipe after app launch plays audibly.
 */
export const primeAudio = () => {
  if (unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => { /* ignore */ });
    }
  };
  const opts: AddEventListenerOptions = { once: false, passive: true };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
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
  const ctx = getCtx();
  if (!ctx) return;
  // Try to resume on every call — the AudioContext may be in "suspended"
  // state after a tab switch on iOS WebView.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { /* ignore */ });
  }
  try {
    if (kind === "yes") playYes(ctx);
    else if (kind === "no") playNo(ctx);
    else playSkip(ctx);
  } catch {
    // swallow — audio should never block the UI
  }
};

// --- Bubble sounds ("Unload your mind", Nov 2026: "звуки, когда лопаются пузыри") ---
// Made here, no files (Nov 3 2026, her "более ASMR-ное"): a tiny wet click and
// a short rising plip, lower for bigger bubbles, a little different each time,
// panned to where the bubble was; a quiet sea can play underneath.
// Ambient audio on iOS: the silent switch mutes it and music keeps playing.

/** The app's sound setting (Settings → sounds), on unless she turned it off. */
export const soundOn = (): boolean => {
  try {
    const raw = localStorage.getItem("memap_session_settings");
    return raw ? JSON.parse(raw)?.soundEnabled !== false : true;
  } catch {
    return true;
  }
};

const ready = (): AudioContext | null => {
  const ctx = getCtx();
  if (!ctx) return null;
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== "ambient") nav.audioSession.type = "ambient";
  } catch { /* older WebViews */ }
  if (ctx.state === "suspended") ctx.resume().catch(() => { /* ignore */ });
  return ctx;
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

/** A bubble popping; size 0 (small) .. 1 (big), x 0 (left) .. 1 (right). */
export const playPop = (size = 0.3, x = 0.5) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try { plip(ctx, Math.max(0, Math.min(1, size)), (x - 0.5) * 1.4); } catch { /* audio never blocks the UI */ }
};
/** Two bubbles joining: a soft low blub. */
export const playMerge = (x = 0.5) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
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
/** A big bubble bursting: a little cascade of plips. */
export const playBurst = (x = 0.5) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    [0.9, 0.55, 0.3, 0.15].forEach((z, k) => plip(ctx, z, (x - 0.5) * 1.4 + (k - 1.5) * 0.25, k * 0.038, 0.85));
  } catch { /* ignore */ }
};

/** A quiet sea under the game: soft noise, low, rising and falling like
 *  slow waves. Returns a stop function (fades out). */
export const startSea = (): (() => void) => {
  if (!soundOn()) return () => undefined;
  const ctx = ready();
  if (!ctx) return () => undefined;
  try {
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
  } catch {
    return () => undefined;
  }
};
/** A thought kept for later: a small rising chime. */
export const playKeep = () => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    tone(ctx, [659.25], { start: 0, duration: 0.1, peak: 0.07 });
    tone(ctx, [987.77], { start: 0.08, duration: 0.16, peak: 0.07 });
  } catch { /* ignore */ }
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
