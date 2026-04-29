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
    if (isAndroid) { safe(Haptics.selectionChanged()); return; }
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

  /** Error pattern — failed action that the user should notice. */
  error: () => {
    if (!isHapticsEnabled()) return;
    if (isIOS) { safe(CoreHaptics.error()); return; }
    if (isAndroid) { safe(Haptics.notification({ type: NotificationType.Error })); return; }
    webVibrate([40, 60, 40, 60, 40]);
  },
};

// --- Diagnostic harness ----------------------------------------------
// The user's TestFlight build silently fails on every haptic call —
// no error, no vibration. To find out where it dies we need to surface
// each call result individually instead of swallowing them. This
// function tries every distinct iOS haptic API the plugin exposes and
// returns a structured report that the Settings test button can
// display inline.

export interface HapticDiagnostic {
  isNative: boolean;
  results: Array<{
    label: string;
    ok: boolean;
    error?: string;
  }>;
}

const tryCall = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { label, ok: true };
  } catch (err) {
    return {
      label,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

export const runHapticsDiagnostic = async (): Promise<HapticDiagnostic> => {
  const isNative = (() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  })();

  if (!isNative) {
    return {
      isNative: false,
      results: [
        { label: "platform", ok: false, error: "Capacitor.isNativePlatform() returned false" },
      ],
    };
  }

  // Tests BOTH haptic systems back-to-back so the user can feel the
  // difference. Old @capacitor/haptics first (5 calls — the ones that
  // felt like crude vibration on her device), then ~600 ms gap, then
  // the new Core Haptics plugin (6 calls — should feel like proper
  // Taptic Engine: precise, contextual, "Fishdom-grade").
  const results: HapticDiagnostic["results"] = [];

  results.push(await tryCall("[old] impact:Light", () => Haptics.impact({ style: ImpactStyle.Light })));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("[old] impact:Medium", () => Haptics.impact({ style: ImpactStyle.Medium })));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("[old] notification:Success", () => Haptics.notification({ type: NotificationType.Success })));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("[old] selectionChanged", () => Haptics.selectionChanged()));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("[old] vibrate", () => Haptics.vibrate({ duration: 200 })));

  // Pause so the user can mentally separate "old engine" from "new engine".
  await new Promise((r) => setTimeout(r, 600));

  // --- Core Haptics (new) ---------------------------------------------

  const availability = await tryCall("[new] isAvailable", async () => {
    const result = await CoreHaptics.isAvailable();
    if (!result.available) throw new Error("Core Haptics not supported on this device");
  });
  results.push(availability);

  if (availability.ok) {
    results.push(await tryCall("[new] swipe", () => CoreHaptics.swipe()));
    await new Promise((r) => setTimeout(r, 250));

    results.push(await tryCall("[new] tap", () => CoreHaptics.tap()));
    await new Promise((r) => setTimeout(r, 250));

    results.push(await tryCall("[new] medium", () => CoreHaptics.medium()));
    await new Promise((r) => setTimeout(r, 250));

    results.push(await tryCall("[new] success", () => CoreHaptics.success()));
    await new Promise((r) => setTimeout(r, 350));

    results.push(await tryCall("[new] warning", () => CoreHaptics.warning()));
    await new Promise((r) => setTimeout(r, 350));

    results.push(await tryCall("[new] error", () => CoreHaptics.error()));
  }

  return { isNative: true, results };
};
