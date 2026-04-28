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
