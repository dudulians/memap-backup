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
