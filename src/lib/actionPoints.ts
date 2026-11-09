// What happens to an action point when she acts on it (Nov 5 2026, WORLD-BIBLE
// "Решения 5 ноября" #5). "I'll try" and "I did it" both end with the
// count starting again from today: the lighthouse goes dark until her rule is
// reached again. The old count is kept as a finished cycle.
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { isoLocal } from "@/lib/doors";
import { clearThresholdNotification } from "@/lib/notifications";
import { adviceVariants } from "@/lib/trackerLocalize";
import { uuid } from "@/lib/uuid";
import { LIFE_STREAMS, type LifeStreamTemplate } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { HOME_HARM_IDS } from "@/lib/supportLines";

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
// unfollow / mute: done once, then before and after (her note, Nov 9 2026: "Unfollow or mute" every day for 14 days)
const ONCE_WORDS = /\b(doctor|gp|dentist|check|checked|book|appointment|talk to|see a|visit|counsell?or|therapist|unfollow|mute)\b|анфоллоу|отпис|заглуш|врач|терапевт|стоматолог|провер|поговор|записат|сходить|психолог|психотерапевт/i;
const TEMPLATES = new Map<string, LifeStreamTemplate>(LIFE_STREAMS.flatMap((s) => s.templates).map((t) => [t.id, t]));
/** The library's own kind for its plan (content review, Nov 9 2026: the word guess called "Set a weekly
 *  reminder to call" a 2-week test). Only while the question still has the library's plan, in either
 *  language: a plan she wrote herself is guessed from its words. */
const libraryKind = (tr: Tracker): "once" | "daily" | undefined => {
  const id = matchTemplateIdByTitle(tr.title), tpl = id ? TEMPLATES.get(id) : undefined;
  if (!tpl?.planKind) return undefined;
  const plan = (tr.adviceAboveThreshold || "").trim();
  return plan && (plan === tpl.adviceAboveThreshold || plan === tpl.adviceAboveThresholdRu) ? tpl.planKind : undefined;
};
// the same answer in both languages (Nov 8 2026: "Book 3 workout slots" was "once" in English, "every day" in Russian)
export const planKindOf = (tr: Tracker): "once" | "daily" =>
  HOME_HARM_IDS.has(matchTemplateIdByTitle(tr.title) ?? "") ? "once" : tr.planKind ?? libraryKind(tr) ?? (adviceVariants(tr.adviceAboveThreshold || "").some((a) => ONCE_WORDS.test(a)) ? "once" : "daily");
