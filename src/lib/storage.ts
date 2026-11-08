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
/** Library advice that was retired (Nov 7 2026: no tests, drugs or therapies by name). Only these
 *  are refreshed to the current text; a plan she wrote herself is never touched. */
const RETIRED_ADVICE = new Set<string>([
    // weekly goals said plainly (Nov 8 2026)
    "Book 3 workout slots in calendar this week",
    "Внести 3 тренировки в календарь на эту неделю",
    "Put 2 strength sessions in the calendar this week",
    "Внести в календарь 2 силовые тренировки на эту неделю",
    "Plan two nature walks this week",
    "Запланировать на неделе две прогулки на природе",
    "Book a neurologist with my data",
    "Записаться к неврологу с данными",
    "See an osteopath or physiotherapist with my data",
    "Записаться к остеопату или физиотерапевту с данными",
    "Get bloodwork — iron, ferritin, B12, thyroid",
    "Сдать кровь — железо, ферритин, B12, щитовидка",
    "Get hormone bloodwork — testosterone, cortisol",
    "Сдать кровь на гормоны — тестостерон, кортизол",
    "Book an eye doctor and check screen time",
    "Записаться к окулисту и проверить экранное время",
    "Ask a neurologist about migraine prevention",
    "Спросить невролога про профилактику мигрени",
    "Book a physiotherapist with my data",
    "Записаться к физиотерапевту с данными",
    "Book a therapist who treats panic with CBT",
    "Записаться к психотерапевту, который лечит панику методом КПТ",
    "Ask a doctor about CBT for insomnia",
    "Спросить врача про КПТ бессонницы",
    "Ask a doctor to check for sleep apnoea",
    "Попросить врача проверить на апноэ сна",
    "Eat 2 kiwis a day for 4 weeks",
    "4 недели съедать по 2 киви в день",
    "Take psyllium every day for 4 weeks, with water",
    "4 недели каждый день принимать псиллиум, запивая водой",
    "Ask a doctor or dietitian about a low-FODMAP trial",
    "Спросить врача или диетолога про пробную диету low-FODMAP",
    "Do pelvic floor squeezes 3 times a day for 3 months",
    "3 месяца делать упражнения для тазового дна 3 раза в день",
    "Ask a GP to check heavy periods and iron",
    "Попросить врача проверить обильные месячные и уровень железа",
    "Ask a doctor about HRT or CBT for hot flushes",
    "Спросить врача про ЗГТ или КПТ от приливов",
    "Use one acne treatment for 12 weeks before judging it",
    "12 недель пользоваться одним средством от прыщей и только потом оценивать",
    "Ask a dentist about a night guard",
    "Спросить стоматолога про ночную капу",
    "Ask a pharmacist or doctor about a urine infection",
    "Спросить фармацевта или врача, нет ли цистита",
    "Try bladder training for 6 weeks",
    "6 недель тренировать мочевой пузырь",
    "Put on a strong antiperspirant at bedtime for 2 weeks",
    "Две недели наносить сильный антиперспирант на ночь",
    "Ask a doctor about tinnitus support and CBT",
    "Спросить врача про помощь при шуме в ушах и КПТ"
  ]);

const migrateLegacyAdvice = async (): Promise<void> => {
  const trackers = await getTrackers();
  if (trackers.length === 0) return;
  let anyChanged = false;
  const next = trackers.map((tr) => {
    if (!tr.adviceAboveThreshold) return tr;
    if (!isKnownLibraryTitle(tr.title)) return tr;
    if (isKnownAdvice(tr.adviceAboveThreshold)) return tr;
    // her own plan stays: only retired library advice is refreshed (found Nov 7 2026)
    if (!RETIRED_ADVICE.has(tr.adviceAboveThreshold.trim())) return tr;
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

/** The weekly goals' rules (Nov 8 2026): "12 days without a workout in 30" didn't match
 *  "3 workouts a week"; a question still on the old library rule gets the weekly one. */
const GOAL_RULES: Record<string, { was: [number, number]; now: [number, number] }> = {
  exercised: { was: [12, 30], now: [5, 7] },
  "strength-training": { was: [23, 30], now: [6, 7] },
  "time-in-nature": { was: [12, 14], now: [6, 7] },
};
/** Removed from MeMap (her note, Nov 8 2026: "давай вообще уберём этот вопрос"): "Partner brought me
 *  flowers" goes to the archive once; the answers stay. */
const REMOVED_TITLES = ["partner brought me flowers", "партнёр подарил мне цветы"];
const archiveRemoved = async (): Promise<void> => {
  if (localStorage.getItem("memap_removed_flowers")) return;
  localStorage.setItem("memap_removed_flowers", "1");
  const trackers = await getTrackers();
  if (!trackers.some((t) => !t.archived && REMOVED_TITLES.includes(t.title.trim().toLowerCase()))) return;
  await saveTrackers(trackers.map((t) => (REMOVED_TITLES.includes(t.title.trim().toLowerCase()) ? { ...t, archived: true } : t)));
};
const migrateGoalRules = async (): Promise<void> => {
  const trackers = await getTrackers();
  let changed = false;
  const next = trackers.map((tr) => {
    const id = matchTemplateIdByTitle(tr.title), r = id ? GOAL_RULES[id] : undefined;
    if (!r || tr.threshold !== r.was[0] || tr.periodDays !== r.was[1]) return tr;
    changed = true;
    return { ...tr, threshold: r.now[0], periodDays: r.now[1] };
  });
  if (changed) await saveTrackers(next);
};

// Public — call once on app startup. Wraps in try/catch so a
// corrupted entry can't break the whole app boot.
export const runStartupMigrations = async (): Promise<void> => {
  try {
    await migrateLegacyAdvice();
    await migrateGoalRules();
    await archiveRemoved();
    // a running old-style weekly-goal test moves onto her own question (Nov 8 2026)
    await (await import("@/lib/testWords")).migrateGoalTests();
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
