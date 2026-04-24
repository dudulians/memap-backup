import { Tracker, TrackerEntry } from "@/types/tracker";
import { safeParse } from "@/lib/safeParse";
import { checkThresholdAlerts } from "@/lib/notifications";

const TRACKERS_KEY = "memap_trackers";
const ENTRIES_KEY = "memap_entries";

export const getTrackers = (): Promise<Tracker[]> => {
  return Promise.resolve().then(() => {
    const data = localStorage.getItem(TRACKERS_KEY);
    return safeParse<Tracker[]>(data, []);
  });
};

export const saveTrackers = (trackers: Tracker[]): Promise<void> => {
  return Promise.resolve().then(() => {
    localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
    try {
      window.dispatchEvent(new Event("memap-trackers-changed"));
    } catch {}
  });
};

export const getEntries = (): Promise<TrackerEntry[]> => {
  return Promise.resolve().then(() => {
    const data = localStorage.getItem(ENTRIES_KEY);
    return safeParse<TrackerEntry[]>(data, []);
  });
};

export const saveEntries = (entries: TrackerEntry[]): Promise<void> => {
  return Promise.resolve().then(async () => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    // Broadcast so other mounted views (TodayTab, TrackerDetails, calendars)
    // refresh their local entry cache. Fire synchronously after the write —
    // anyone listening can re-read localStorage immediately.
    try {
      window.dispatchEvent(new Event("memap-entries-changed"));
    } catch {
      // environments without window (SSR) — no-op
    }
    try {
      const trackers = await getTrackers();
      await checkThresholdAlerts(trackers, entries);
    } catch {
      // threshold check is best-effort, never block saves
    }
  });
};
