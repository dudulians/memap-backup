/**
 * Core Haptics — custom Capacitor plugin (Swift) that drives iOS's
 * Core Haptics framework directly, the same way games like Fishdom
 * do. Falls back to no-ops on web / Android (the regular
 * @capacitor/haptics path covers Android in lib/haptics.ts).
 *
 * Why we have this in addition to @capacitor/haptics:
 * The official @capacitor/haptics plugin uses UIImpactFeedbackGenerator
 * under the hood. On the user's device that path silently degraded to
 * the legacy AudioServicesPlaySystemSound buzzer (the "vibrate" tier)
 * instead of triggering Taptic Engine — every test felt like one
 * crude vibration instead of five distinct premium pulses. Core
 * Haptics gives us direct CHHapticEngine + CHHapticPattern access,
 * which is what produces the precise, tactile feel.
 *
 * Native-side implementation lives in
 * ios/App/App/AppDelegate.swift (alongside the AppDelegate to avoid
 * pbxproj edits) and is registered via packageClassList in
 * ios/App/App/capacitor.config.json.
 */

import { registerPlugin } from "@capacitor/core";

export interface CoreHapticsPlugin {
  /** Soft swipe-commit pulse — low intensity, low sharpness. */
  swipe(): Promise<void>;
  /** Crisp selection tick — for buttons / toggles. */
  tap(): Promise<void>;
  /** Stronger "this matters" thump — yes/no card swipe commit. */
  medium(): Promise<void>;
  /** Two-pulse success pattern — round done, milestone hit. */
  success(): Promise<void>;
  /** Two-pulse warning — destructive action, "are you sure". */
  warning(): Promise<void>;
  /** Three-pulse error — failure the user should notice. */
  error(): Promise<void>;
  /**
   * Reports whether the device's Taptic Engine actually supports
   * Core Haptics. False on iPad / older iPhones; we fall back to
   * UIFeedbackGenerator via @capacitor/haptics when this is false.
   */
  isAvailable(): Promise<{ available: boolean }>;
}

const noop = async () => {};

const CoreHaptics = registerPlugin<CoreHapticsPlugin>("CoreHaptics", {
  // Web / dev fallback. Core Haptics is iOS-only; let calls resolve
  // to no-ops so consumer code doesn't need platform-guards everywhere.
  // The real UX gates and per-platform fallbacks live in lib/haptics.ts.
  web: () => ({
    swipe: noop,
    tap: noop,
    medium: noop,
    success: noop,
    warning: noop,
    error: noop,
    isAvailable: async () => ({ available: false }),
  }),
});

export default CoreHaptics;
