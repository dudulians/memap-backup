import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackerEmoji } from "@/lib/categoryHelpers";
import i18n from "@/lib/i18n";
import { getTrackers, getEntries } from "@/lib/storage";
import { localizeTrackerTitle, localizeTrackerAdvice } from "@/lib/trackerLocalize";

const NOTIFICATION_ENABLED_KEY = "memap_notification_enabled";
const NOTIFICATION_TIME_KEY = "memap_notification_time";
const THRESHOLD_ALERTS_KEY = "memap_threshold_alerts";
const NOTIFIED_CYCLES_KEY = "memap_notified_cycles";
// Legacy id used by the old single repeating notification. Kept around
// only so we can cancel it on first run of the new scheduler — once
// every install has migrated this can go.
const LEGACY_DAILY_NOTIFICATION_ID = 1;

// Window of days we pre-schedule. Each day gets its own non-repeating
// notification with a date-based id, so we can cancel any single day
// (e.g. to skip "today" once it's already filled). 7 days is plenty —
// the app re-runs the scheduler on every cold start, so the queue gets
// topped up whenever the user actually opens it.
const DAYS_AHEAD = 7;

// Encode a date as a 32-bit-safe integer id: YYYYMMDD.
const dateToNotificationId = (date: Date): number =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

const localISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Today is "filled" when every active (non-archived) tracker has an
// entry for today's date. If there are no active trackers, treat as
// filled (nothing to remind about).
const isTodayFilled = async (): Promise<boolean> => {
  try {
    const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
    const active = trackers.filter((t) => !t.archived);
    if (active.length === 0) return true;
    const todayIso = localISODate(new Date());
    const answered = new Set(
      entries.filter((e) => e.date === todayIso).map((e) => e.trackerId),
    );
    return active.every((t) => answered.has(t.id));
  } catch {
    // best-effort — never block scheduling on storage errors
    return false;
  }
};

export interface NotificationSettings {
  enabled: boolean;
  time: string;
  thresholdAlerts: boolean;
}

export const getNotificationSettings = (): NotificationSettings => {
  const enabled = localStorage.getItem(NOTIFICATION_ENABLED_KEY) === "true";
  const time = localStorage.getItem(NOTIFICATION_TIME_KEY) || "20:00";
  const thresholdAlerts = localStorage.getItem(THRESHOLD_ALERTS_KEY) !== "false";
  return { enabled, time, thresholdAlerts };
};

export const saveNotificationSettings = (settings: NotificationSettings): void => {
  localStorage.setItem(NOTIFICATION_ENABLED_KEY, settings.enabled.toString());
  localStorage.setItem(NOTIFICATION_TIME_KEY, settings.time);
  localStorage.setItem(THRESHOLD_ALERTS_KEY, settings.thresholdAlerts.toString());
};

export type PermissionFailure =
  | "insecure-origin"    // Served over HTTP on a non-localhost host — mobile browsers block Notification entirely.
  | "unsupported"        // Browser doesn't expose the Notification API at all (iOS Safari in a regular tab).
  | "denied"             // User actively denied the system prompt.
  | "unknown";

export interface PermissionResult {
  granted: boolean;
  reason?: PermissionFailure;
}

/**
 * Detailed permission request. Distinguishes between "user said no" and
 * "the browser environment can't even ask" so the UI can show a useful
 * message (e.g. "open the installed app" instead of "permission denied").
 */
export const requestNotificationPermissionDetailed = async (): Promise<PermissionResult> => {
  try {
    if (Capacitor.getPlatform() === "web") {
      // Insecure origin: anything that isn't HTTPS or localhost. Mobile
      // Chrome / iOS Safari refuse to even load the Notification API here,
      // so the request silently returns "denied".
      const isSecure =
        typeof window !== "undefined" &&
        (window.isSecureContext ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");
      if (!isSecure) return { granted: false, reason: "insecure-origin" };

      if (!("Notification" in window)) return { granted: false, reason: "unsupported" };

      const permission = await Notification.requestPermission();
      if (permission === "granted") return { granted: true };
      return { granted: false, reason: "denied" };
    }

    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return { granted: true };

    const requested = await LocalNotifications.requestPermissions();
    if (requested.display === "granted") return { granted: true };
    return { granted: false, reason: "denied" };
  } catch (error) {
    console.error("Notification permission error", error);
    return { granted: false, reason: "unknown" };
  }
};

// Back-compat: boolean-only version still used by scheduleNotification etc.
export const requestNotificationPermission = async (): Promise<boolean> => {
  const r = await requestNotificationPermissionDetailed();
  return r.granted;
};

// Cancel ALL daily notifications we may have scheduled. Iterates a
// window of date-based ids around today, plus the legacy single-id
// notification, so the keychain is left clean before re-scheduling.
export const cancelNotification = async (): Promise<void> => {
  if (Capacitor.getPlatform() === "web") return;
  try {
    const ids: { id: number }[] = [{ id: LEGACY_DAILY_NOTIFICATION_ID }];
    const today = new Date();
    // ±60 days is more than enough — covers anything we ever scheduled
    // ahead, plus any stragglers from past windows that didn't fire.
    for (let offset = -60; offset <= 60; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      ids.push({ id: dateToNotificationId(d) });
    }
    await LocalNotifications.cancel({ notifications: ids });
  } catch (error) {
    console.error("Notification cancel error", error);
  }
};

// Re-builds the daily notification queue from scratch. Call this:
//   - on cold app start
//   - after the user finishes a session (so today gets cancelled)
//   - after settings change (time / enabled flag)
//   - after the UI language changes
// It cancels everything, then schedules the next DAYS_AHEAD days,
// skipping today if today is already fully filled.
export const scheduleNotification = async (
  settings: NotificationSettings,
): Promise<void> => {
  // Kill old schedule no matter what — keeps state consistent.
  await cancelNotification();

  if (!settings.enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (Capacitor.getPlatform() === "web") {
    // Web: no per-day scheduling. The setting is just remembered for
    // when the user installs the native app.
    return;
  }

  const [hour, minute] = settings.time.split(":").map(Number);
  const now = new Date();
  const todayFilled = await isTodayFilled();

  // Pull the lock-screen text in the user's CURRENT language at
  // schedule time. iOS stores the literal string with the
  // notification, so a later language switch needs another reschedule
  // to update — that's why callers re-run this on memap-language-changed.
  const title = i18n.t("notifications.dailyTitle");
  const body = i18n.t("notifications.dailyBody");

  type ScheduledNotification = {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
  };
  const notifications: ScheduledNotification[] = [];

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const fireAt = new Date(now);
    fireAt.setDate(now.getDate() + offset);
    fireAt.setHours(hour, minute, 0, 0);

    // Skip past times (today's slot when it's already past, or any
    // earlier day in the window).
    if (fireAt <= now) continue;
    // Skip today if user already filled everything for today — no
    // point reminding them to do something they've done.
    if (offset === 0 && todayFilled) continue;

    notifications.push({
      id: dateToNotificationId(fireAt),
      title,
      body,
      schedule: { at: fireAt, allowWhileIdle: true },
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
};

const getNotifiedCycles = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_CYCLES_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const saveNotifiedCycles = (data: Record<string, string>) => {
  localStorage.setItem(NOTIFIED_CYCLES_KEY, JSON.stringify(data));
};

const fireThresholdNotification = async (tracker: Tracker) => {
  const emoji = getTrackerEmoji(tracker.title);
  const title = i18n.t("notifications.thresholdTitle", { emoji });

  // Localise the tracker's title and action (adviceAboveThreshold) into
  // the active language. Stored values may be in either language depending
  // on when/where the tracker was created; the localize helpers map
  // through the EN↔RU pair tables and pass through unchanged for custom
  // user-typed text.
  const localizedTitle = localizeTrackerTitle(tracker.title);
  const rawAction = (tracker.adviceAboveThreshold ?? "").trim();
  const action = rawAction ? localizeTrackerAdvice(rawAction) : "";

  // If the tracker has a user-defined action ("Action when pattern hits"),
  // surface it directly in the notification body — that's the whole point
  // of asking the user to write one. Without an action, fall back to the
  // generic "time to act" wording.
  const body = action
    ? i18n.t("notifications.thresholdBodyWithAction", {
        title: localizedTitle,
        threshold: tracker.threshold,
        action,
      })
    : i18n.t("notifications.thresholdBody", {
        title: localizedTitle,
        threshold: tracker.threshold,
      });

  if (Capacitor.getPlatform() === "web") {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, tag: `threshold-${tracker.id}` });
      } catch {
        // ignore
      }
    }
    return;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1000 + Math.floor(Math.random() * 100000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
        },
      ],
    });
  } catch (error) {
    console.error("Threshold notification error", error);
  }
};

export const checkThresholdAlerts = async (
  trackers: Tracker[],
  entries: TrackerEntry[]
): Promise<void> => {
  const settings = getNotificationSettings();
  if (!settings.thresholdAlerts) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notified = getNotifiedCycles();
  let dirty = false;

  for (const tracker of trackers) {
    if (tracker.archived) continue;

    const rollingStart = new Date(today);
    rollingStart.setDate(today.getDate() - tracker.periodDays);
    const cycleStart = tracker.cycleStartDate
      ? new Date(tracker.cycleStartDate + "T00:00:00")
      : null;
    const windowStart = cycleStart && cycleStart > rollingStart ? cycleStart : rollingStart;

    const significantDays = entries.filter((e) => {
      if (e.trackerId !== tracker.id) return false;
      const d = new Date(e.date + "T00:00:00");
      if (d < windowStart || d > today) return false;
      return tracker.problemWhen === "yes" ? e.value : !e.value;
    }).length;

    if (significantDays < tracker.threshold) continue;

    const cycleKey = tracker.cycleStartDate ?? "initial";
    if (notified[tracker.id] === cycleKey) continue;

    await fireThresholdNotification(tracker);
    notified[tracker.id] = cycleKey;
    dirty = true;
  }

  if (dirty) saveNotifiedCycles(notified);
};

export const clearThresholdNotification = (trackerId: string): void => {
  const notified = getNotifiedCycles();
  delete notified[trackerId];
  saveNotifiedCycles(notified);
};