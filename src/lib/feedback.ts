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
// Made here, no files: a short "bloop" (a sine that drops in pitch), lower for
// bigger bubbles and a little different each time so many pops don't drone.
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

const bloop = (ctx: AudioContext, from: number, to: number, start: number, length: number, peak: number) => {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.linearRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.03);
};

/** A bubble popping; size 0 (small) .. 1 (big). */
export const playPop = (size = 0.3) => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    const z = Math.max(0, Math.min(1, size));
    const f = (980 - 520 * z) * (0.92 + Math.random() * 0.16);
    bloop(ctx, f, f * 0.5, 0, 0.07 + 0.05 * z, 0.09 + 0.05 * z);
  } catch { /* audio never blocks the UI */ }
};
/** Two bubbles joining: a soft low blub. */
export const playMerge = () => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try { bloop(ctx, 260, 340, 0, 0.09, 0.05); } catch { /* ignore */ }
};
/** A big bubble bursting: three quick bloops going up. */
export const playBurst = () => {
  if (!soundOn()) return;
  const ctx = ready();
  if (!ctx) return;
  try {
    [520, 700, 900].forEach((f, k) => bloop(ctx, f, f * 0.55, k * 0.045, 0.07, 0.08));
  } catch { /* ignore */ }
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
