/**
 * Per-platform haptic dispatcher.
 *
 *   iOS native     → Core Haptics via our custom CoreHapticsPlugin
 *                    (CHHapticEngine + CHHapticPattern). The user reported
 *                    that @capacitor/haptics' UIImpactFeedbackGenerator
 *                    path silently downgraded to the legacy crude
 *                    AudioServicesPlaySystemSound buzzer on her device,
 *                    so we route iOS through our own plugin where we
 *                    control the engine directly. Same code path that
 *                    games like Fishdom use for their premium feel.
 *   Android native → @capacitor/haptics (UIImpactFeedbackGenerator-
 *                    equivalent on Android via AndroidX). No Core
 *                    Haptics on Android, but Android haptic quality
 *                    varies wildly between OEMs anyway.
 *   Web            → navigator.vibrate() if present. iOS Safari
 *                    ignores it completely; that's expected — iOS
 *                    users are on the native build.
 *
 * Use sparingly. Only fire on moments the user would recognise as a
 * "thing happened" — swipe committed, round done, delete confirmed,
 * gender toggle. Per-frame or per-tap haptics drain battery and the
 * user turns the feature off.
 */

import { Capacitor } from "@capacitor/core";
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";
import CoreHaptics from "./coreHaptics";

const isIOS = (() => {
  try {
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
})();

const isAndroid = (() => {
  try {
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
})();

const webVibrate = (ms: number | number[]) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
};

const safe = (p: Promise<unknown>) => { p.catch(() => { /* swallow */ }); };

// Central gate. Reads the user's hapticsEnabled setting from
// localStorage on every call (cheap, sync). When she turns vibration
// off in Settings, EVERY public haptic method below short-circuits to
// a no-op — no need to add an `if (isHapticEnabled())` guard at every
// call site. Migration: pre-split users without a hapticsEnabled key
// fall back to soundEnabled so we don't surprise-enable vibration on
// someone who'd previously turned the combined toggle off.
const isHapticsEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem("memap_session_settings");
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.hapticsEnabled === "boolean") {
      return parsed.hapticsEnabled;
    }
    return parsed?.soundEnabled !== false;
  } catch {
    return true;
  }
};

// Each public API:
//   1. Bails early if hapticsEnabled is off → universal mute.
//   2. Picks the right backend:
//        iOS → Core Haptics (custom plugin, premium quality)
//        Android → @capacitor/haptics (UIImpactFeedbackGenerator analogue)
//        Web → navigator.vibrate fallback

// Warm-up flag. iOS Core Haptics (CHHapticEngine) takes ~10-50 ms to
// initialise on first use; if a haptic pattern is submitted while the
// engine is starting, it silently no-ops. Same gesture-gating story
// for Android Haptics on some devices. Calling a single subtle haptic
// on the first user gesture starts the engine so the *next* call —
// usually the Play-button tap that triggered the prime — fires
// instantly with no delay or skipped vibration.
let hapticsPrimed = false;

/**
 * Attach one-shot listeners that fire a minimal haptic on the first
 * pointerdown / touchstart / keydown after app launch. Mirrors
 * primeAudio() in lib/feedback.ts. Idempotent — safe to call from
 * multiple mount points; only the first call attaches listeners.
 */
export const primeHaptics = () => {
  if (hapticsPrimed || typeof window === "undefined") return;
  const prime = () => {
    if (hapticsPrimed) return;
    hapticsPrimed = true;
    if (isIOS) safe(CoreHaptics.swipe());
    else if (isAndroid) safe(Haptics.impact({ style: ImpactStyle.Light }));
    window.removeEventListener("pointerdown", prime);
    window.removeEventListener("touchstart", prime);
    window.removeEventListener("keydown", prime);
  };
  const opts: AddEventListenerOptions = { once: false, passive: true };
  window.addEventListener("pointerdown", prime, opts);
  window.addEventListener("touchstart", prime, opts);
  window.addEventListener("keydown", prime, opts);
};

type Beat = { t: number; i: number; s: number };
/** iOS: the exact pattern; Android: impacts at the same times; web: vibrate(ms…). */
const pattern = (beats: Beat[], android: ImpactStyle[], web: number[]) => {
  if (!isHapticsEnabled()) return;
  if (isIOS) {
    CoreHaptics.play({ events: beats }).catch(() => safe(CoreHaptics.tap()));
    return;
  }
  if (isAndroid) {
    beats.forEach((b, k) => window.setTimeout(() => safe(Haptics.impact({ style: android[k] ?? ImpactStyle.Light })), b.t * 1000));
    return;
  }
  webVibrate(web.length === 1 ? web[0] : web);
};

export const haptics = {
  /** Light swipe-commit pulse. */
  swipe: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.swipe()); return; }
    if (isAndroid) { safe(Haptics.impact({ style: ImpactStyle.Light })); return; }
    webVibrate(10);
  },

  /** Crisp selection tick — toggles, segmented controls, picker changes. */
  tap: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.tap()); return; }
    // Android: selectionChanged is silent without selectionStart, so a
    // light impact is the tap there (Aurora step 1 leftover).
    if (isAndroid) { safe(Haptics.impact({ style: ImpactStyle.Light })); return; }
    webVibrate(5);
  },

  /** Medium thump — yes/no card swipe commit, long-press confirm. */
  medium: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.medium()); return; }
    if (isAndroid) { safe(Haptics.impact({ style: ImpactStyle.Medium })); return; }
    webVibrate(25);
  },

  /** Double-pulse success — round done, entry saved, reflection logged. */
  success: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.success()); return; }
    if (isAndroid) { safe(Haptics.notification({ type: NotificationType.Success })); return; }
    webVibrate([10, 60, 10]);
  },

  /** Warning pattern — destructive action, "are you sure". */
  warning: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.warning()); return; }
    if (isAndroid) { safe(Haptics.notification({ type: NotificationType.Warning })); return; }
    webVibrate([20, 80, 20]);
  },

  // --- Varied patterns (Nov 2026, her ask: "разные вибрации везде") ---
  // iOS plays them through CoreHaptics.play (older builds without it fall
  // back to a tap); Android strings light/medium impacts; the web vibrates.

  /** A bubble popping: small = light and crisp, big = deeper and softer. */
  pop: (size = 0.3) => {
    const z = Math.max(0, Math.min(1, size));
    pattern([{ t: 0, i: 0.35 + 0.5 * z, s: 0.85 - 0.45 * z }], z > 0.5 ? [ImpactStyle.Medium] : [ImpactStyle.Light], [6 + Math.round(z * 14)]);
  },
  /** Two things joining: one dull, soft thud. */
  merge: () => pattern([{ t: 0, i: 0.3, s: 0.15 }], [ImpactStyle.Light], [8]),
  /** A big one bursting: three quick fading taps. */
  burst: () => pattern([{ t: 0, i: 0.8, s: 0.5 }, { t: 0.05, i: 0.45, s: 0.7 }, { t: 0.1, i: 0.25, s: 0.9 }], [ImpactStyle.Medium, ImpactStyle.Light, ImpactStyle.Light], [18, 30, 8, 30, 5]),
  /** Something nice found: three light, rising sparkles. */
  sparkle: () => pattern([{ t: 0, i: 0.3, s: 0.9 }, { t: 0.08, i: 0.4, s: 0.95 }, { t: 0.16, i: 0.55, s: 1 }], [ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Medium], [5, 50, 6, 50, 9]),
  /** Kept / started: a gentle swell. */
  rise: () => pattern([{ t: 0, i: 0.2, s: 0.3 }, { t: 0.07, i: 0.38, s: 0.4 }, { t: 0.14, i: 0.6, s: 0.5 }], [ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Medium], [6, 40, 9, 40, 14]),
  /** Before a reveal (the chest): a drum roll and one strong beat. */
  drumroll: () => pattern(
    [{ t: 0, i: 0.3, s: 0.5 }, { t: 0.12, i: 0.34, s: 0.5 }, { t: 0.22, i: 0.38, s: 0.55 }, { t: 0.3, i: 0.42, s: 0.6 }, { t: 0.36, i: 0.46, s: 0.6 }, { t: 0.41, i: 0.5, s: 0.65 }, { t: 0.56, i: 1, s: 0.6 }],
    [ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Light, ImpactStyle.Heavy],
    [8, 110, 8, 90, 8, 70, 8, 50, 8, 40, 8, 140, 40]),
  /** A card landing: one solid, warm beat. */
  land: () => pattern([{ t: 0, i: 0.6, s: 0.35 }], [ImpactStyle.Medium], [14]),
  /** Barely there: theme switch, a quiet choice. */
  soft: () => pattern([{ t: 0, i: 0.22, s: 0.2 }], [ImpactStyle.Light], [4]),

  /** Error pattern — failed action that the user should notice. */
  error: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.error()); return; }
    if (isAndroid) { safe(Haptics.notification({ type: NotificationType.Error })); return; }
    webVibrate([40, 60, 40, 60, 40]);
  },
};

