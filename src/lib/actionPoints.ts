// What happens to an action point when she acts on it (Nov 5 2026, WORLD-BIBLE
// "Решения 5 ноября" #5). "I'll try" and "I did it" both end with the
// count starting again from today: the lighthouse goes dark until her rule is
// reached again. The old count is kept as a finished cycle.
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { isoLocal } from "@/lib/doors";
import { clearThresholdNotification } from "@/lib/notifications";
import { uuid } from "@/lib/uuid";

/** Before a week of evenings nothing is called calm: "Your world is still taking shape". */
export const SHAPING_EVENINGS = 7;
/** Evenings she has answered anything (her own questions; not the games). */
export const answeredEvenings = (trackers: Tracker[], entries: TrackerEntry[]): number => {
  const ids = new Set(trackers.filter((t) => !t.archived && t.source !== "play").map((t) => t.id));
  return new Set(entries.filter((e) => ids.has(e.trackerId)).map((e) => e.date)).size;
};

/** Change one question and tell the screens. */
export const patchTracker = async (id: string, patch: (t: Tracker) => Tracker) => {
  const all = await getTrackers();
  await saveTrackers(all.map((t) => (t.id === id ? patch(t) : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};

/** The count starts again from today (k = the days it had reached). */
export const countFromToday = async (id: string, k: number, extra: Partial<Tracker> = {}) => {
  const today = isoLocal(new Date());
  await patchTracker(id, (x) => {
    const cycle: ReflectionCycle = {
      id: uuid(), startDate: x.cycleStartDate ?? x.createdAt.split("T")[0], endDate: today,
      periodDays: x.periodDays, threshold: x.threshold, significantDays: k, totalTrackedDays: k,
    };
    return { ...x, ...extra, cycleStartDate: today, cycles: [...(x.cycles ?? []), cycle] };
  });
  clearThresholdNotification(id);
};

/** Once (see a doctor, get checked, book…) or every day (a 2-week test). Hers once she picks;
 *  until then a guess from the words (Nov 7 2026). */
const ONCE_WORDS = /\b(doctor|gp|dentist|check|checked|book|appointment|talk to|see a|visit|counsell?or|therapist)\b|врач|терапевт|стоматолог|провер|поговор|записат|сходить|психолог|психотерапевт/i;
export const planKindOf = (tr: Tracker): "once" | "daily" => tr.planKind ?? (ONCE_WORDS.test(tr.adviceAboveThreshold || "") ? "once" : "daily");
