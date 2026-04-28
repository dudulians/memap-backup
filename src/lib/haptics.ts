/**
 * Wrapper around @capacitor/haptics with a graceful web fallback.
 *
 * Native (iOS/Android via Capacitor) → real Taptic Engine / vibrator.
 * Web (desktop browsers, the Vite dev server) → falls back to
 *   navigator.vibrate() when present, otherwise no-op. iOS Safari
 *   ignores navigator.vibrate completely, but iOS users will be on the
 *   native build anyway.
 *
 * Use sparingly. Only fire on moments the user would recognise as a
 * "thing happened" — swipe committed, round done, delete confirmed,
 * gender toggle. Per-frame or per-tap haptics drain battery and the
 * user turns the feature off.
 *
 * NOTE: swipe haptics for the daily card are handled by feedback.ts
 * (`triggerHaptic`) which is wired into the gesture handler. This
 * module covers everything else.
 */

import { Capacitor } from "@capacitor/core";
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";

const webVibrate = (ms: number | number[]) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
};

const impact = async (style: ImpactStyle, webMs: number) => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
      return;
    }
  } catch { /* fall through */ }
  webVibrate(webMs);
};

const notify = async (type: NotificationType, webPattern: number[]) => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type });
      return;
    }
  } catch { /* fall through */ }
  webVibrate(webPattern);
};

const selection = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionChanged();
      return;
    }
  } catch { /* fall through */ }
  webVibrate(5);
};

const safe = (p: Promise<void>) => { p.catch(() => { /* swallow */ }); };

export const haptics = {
  /** Light tap — swipe crossing its commit threshold. */
  swipe: () => safe(impact(ImpactStyle.Light, 10)),

  /** Selection tick — toggles, segmented controls, picker changes. */
  tap: () => safe(selection()),

  /** Medium thud — long-press or "this is important" action. */
  medium: () => safe(impact(ImpactStyle.Medium, 25)),

  /** Double-pulse success — round done, entry saved, reflection logged. */
  success: () => safe(notify(NotificationType.Success, [10, 60, 10])),

  /** Warning pulse — delete / archive / "are you sure". */
  warning: () => safe(notify(NotificationType.Warning, [20, 80, 20])),

  /** Error pulse — failed action that the user should notice. */
  error: () => safe(notify(NotificationType.Error, [40, 60, 40, 60, 40])),
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

  // Spaced ~250 ms apart so a working device can produce 4 distinct
  // tactile events the user can count individually.
  const results: HapticDiagnostic["results"] = [];

  results.push(await tryCall("impact:Light", () => Haptics.impact({ style: ImpactStyle.Light })));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("impact:Medium", () => Haptics.impact({ style: ImpactStyle.Medium })));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("notification:Success", () => Haptics.notification({ type: NotificationType.Success })));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("selectionChanged", () => Haptics.selectionChanged()));
  await new Promise((r) => setTimeout(r, 250));

  results.push(await tryCall("vibrate", () => Haptics.vibrate({ duration: 200 })));

  return { isNative: true, results };
};
