import { Tracker, TrackerEntry } from "@/types/tracker";
import { safeParse } from "@/lib/safeParse";
import { checkThresholdAlerts } from "@/lib/notifications";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import {
  isKnownLibraryTitle,
  isKnownAdvice,
} from "@/lib/trackerLocalize";

const TRACKERS_KEY = "memap_trackers";
const ENTRIES_KEY = "memap_entries";

// Advice-only migration. When we update advice copy in a release
// (e.g. shortened from "Write down what usually triggers fights —
// the pattern says more than any single argument" to "Write down
// what usually triggers fights"), existing user trackers carry the
// OLD copy in stored data. The localization map only holds CURRENT
// pairs, so the old EN string falls through untranslated → user
// sees raw English in their advice card.
//
// Strategy (very conservative — never overwrite user-edited text):
//   1. Tracker title MUST be a known library title (in the current
//      map either as EN or RU). Custom trackers don't match → skip.
//   2. Stored advice MUST be UNKNOWN to the current map (i.e. not
//      a current canonical EN/RU advice string for any template).
//      That signals "this is legacy text from a previous version".
//   3. Find the template id via title match, look up its current
//      advice, set it on the tracker (in the user's likely
//      language — Cyrillic heuristic).
//
// Title and questionText are NOT migrated even if they look stale,
// because:
//   - They're typically what the user RECOGNISES the tracker as
//   - The localization map already covers many legacy title/question
//     forms (LEGACY_LIFESTREAMS_*_PAIRS), so they translate fine
//   - Risk of overwriting a user-edited title is too high
//
// Idempotent: second run sees the freshly-set advice already in the
// current map → isKnownAdvice returns true → no-op.
const migrateLegacyAdvice = async (): Promise<void> => {
  const trackers = await getTrackers();
  if (trackers.length === 0) return;
  let anyChanged = false;
  const next = trackers.map((tr) => {
    if (!tr.adviceAboveThreshold) return tr;
    if (!isKnownLibraryTitle(tr.title)) return tr;
    if (isKnownAdvice(tr.adviceAboveThreshold)) return tr;
    const tplId = matchTemplateIdByTitle(tr.title);
    if (!tplId) return tr;
    // Find canonical template
    let canonical: typeof LIFE_STREAMS[0]["templates"][0] | null = null;
    for (const stream of LIFE_STREAMS) {
      for (const tpl of stream.templates) {
        if (tpl.id === tplId) {
          canonical = tpl;
          break;
        }
      }
      if (canonical) break;
    }
    if (!canonical) return tr;
    // Pick localized form — Cyrillic heuristic on the OLD stored
    // advice means the user was on RU when the tracker was created.
    const looksRu = /[А-Яа-яЁё]/.test(tr.adviceAboveThreshold);
    const newAdvice = looksRu
      ? canonical.adviceAboveThresholdRu
      : canonical.adviceAboveThreshold;
    if (newAdvice === tr.adviceAboveThreshold) return tr;
    anyChanged = true;
    return { ...tr, adviceAboveThreshold: newAdvice };
  });
  if (anyChanged) {
    await saveTrackers(next);
  }
};

// Public — call once on app startup. Wraps in try/catch so a
// corrupted entry can't break the whole app boot.
export const runStartupMigrations = async (): Promise<void> => {
  try {
    await migrateLegacyAdvice();
  } catch (e) {
    console.error("startup migrations failed:", e);
  }
};

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
    } catch {
      // Ignore — environment without window (SSR / tests)
    }
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
