import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackerEmoji } from "@/lib/categoryHelpers";

const NOTIFICATION_ENABLED_KEY = "memap_notification_enabled";
const NOTIFICATION_TIME_KEY = "memap_notification_time";
const THRESHOLD_ALERTS_KEY = "memap_threshold_alerts";
const NOTIFIED_CYCLES_KEY = "memap_notified_cycles";
const DAILY_NOTIFICATION_ID = 1;

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

export const cancelNotification = async (): Promise<void> => {
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: DAILY_NOTIFICATION_ID }],
    });
  } catch (error) {
    console.error("Notification cancel error", error);
  }
};

export const scheduleNotification = async (
  settings: NotificationSettings
): Promise<void> => {
  if (!settings.enabled) {
    await cancelNotification();
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const [hour, minute] = settings.time.split(":").map(Number);

  await cancelNotification();

  if (Capacitor.getPlatform() === "web") {
    console.log("Web mode: notification permission granted");
    return;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: DAILY_NOTIFICATION_ID,
        title: "MeMap",
        body: "Time for your daily check-in",
        schedule: {
          on: { hour, minute },
          repeats: true,
          allowWhileIdle: true,
        },
      },
    ],
  });
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
  const title = `${emoji} Action signal reached`;
  const body = `"${tracker.title}" hit ${tracker.threshold} significant days. Time to act.`;

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