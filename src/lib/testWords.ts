// The words of a 2-week test (Nov 8 2026, her phone notes):
//   "In bed by 23:00? Что? Это вопрос? В коротких формулировках мы теряем смыслы" —
//     a test's evening question is a whole question: the idea's own ("Were you in bed by
//     23:00?"), else "Did you do this: “…”?", never the plan with a "?" on the end;
//   "Внести 3 тренировки в календарь на эту неделю?" — "это должен был быть вопрос: ты
//     сегодня тренировалась? И приложение должно писать, что должно быть 3 раза в неделю" —
//     a plan that is a weekly goal for the question itself adds no question: the test uses
//     the question she has, with a goal a week, and the rule matches the goal;
//   "не всё трансформируется с англ на рус" — names and questions follow the language.
import i18n from "@/lib/i18n";
import type { Tracker } from "@/types/tracker";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { localizeTrackerAdvice } from "@/lib/trackerLocalize";
import { BED_FROM_WAKE, IDEAS, OLD_IDEAS, PLAN_IDEAS, QUESTION_IDEAS, TOPIC_IDEAS, bedtimeFrom, getExperiments, replaceExperiments, type Experiment } from "@/lib/experiments";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { templateQuestion } from "@/lib/cardText";
import { LEGACY_IDEA_NAMES } from "@/lib/ideaNames";

const norm = (s: string) => s.trim().toLowerCase().replace(/[.?!？]+$/, "").replace(/\s+/g, " ");
// every ready idea: island, plan, topic and per-question ones, and the retired ones tests may still run
const ideaKeys = () => [...new Set([...Object.values(IDEAS).flat(), ...PLAN_IDEAS, ...Object.values(TOPIC_IDEAS).flat(), ...Object.values(QUESTION_IDEAS).flat(), ...OLD_IDEAS])];

/** The ready idea a plan or a test's name is, in either language. */
export const ideaOf = (text: string): string | null => {
  const n = norm(text || "");
  if (!n) return null;
  for (const k of ideaKeys()) {
    for (const lng of ["en", "ru"]) if (norm(i18n.t(`experiment.idea.${k}.change`, { lng })) === n) return k;
    const olds = Object.entries(LEGACY_IDEA_NAMES).filter(([key]) => key === k || key.startsWith(`${k}__`)).flatMap(([, v]) => Object.values(v));
    if (olds.some((x) => !!x && norm(x) === n)) return k;
  }
  return null;
};

/** A test's name (her plan) in today's language; her own words stay hers. A weekly goal, also in
 *  its old words ("Внести 3 тренировки в календарь на эту неделю"), is "3 workouts a week". */
/** Ideas she is already doing: a test running now, or one she kept going (QA, Nov 8 2026: the picker
 *  and "Not for me" offered "Go to bed by 23:00" on day 5 of that very test). */
export const busyIdeas = (): Set<string> =>
  new Set(getExperiments().filter((x) => !x.reviewed || x.kept).map((x) => ideaOf(x.change)).filter((k): k is string => !!k));

/** "21:30" said the way the phone's time field shows it (QA, Nov 8 2026: the row said 21:30, the sheet
 *  09:30 PM): 12-hour in English, 24-hour in Russian. */
export const clockTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  if (i18n.language?.startsWith("ru")) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** A test name in quotes of the language: «…» in Russian, “…” in English. */
export const quotedTestName = (change: string): string => { const n = testNameOf(change); return i18n.language?.startsWith("ru") ? `«${n}»` : `“${n}”`; };
export const testNameOf = (change: string): string => {
  const k = ideaOf(change);
  if (k) return i18n.t(`experiment.idea.${k}.change`);
  const g = goalTemplateOf(change), tpl = g ? TEMPLATES.get(g) : undefined;
  if (tpl) return i18n.language?.startsWith("ru") ? tpl.adviceAboveThresholdRu ?? tpl.adviceAboveThreshold : tpl.adviceAboveThreshold;
  return localizeTrackerAdvice(change.trim());
};

/** The evening question for a plan: the idea's own question; a weekly goal asks its own question
 *  ("Did you do a real workout?"); else "Did you do this: “…”?" */
export const testQuestionOf = (change: string): string => {
  const k = ideaOf(change);
  if (k) return i18n.t(`experiment.idea.${k}.q`);
  const g = goalTemplateOf(change), tpl = g ? TEMPLATES.get(g) : undefined;
  if (tpl) return templateQuestion(tpl);
  return planAsQuestion(testNameOf(change));
};

/** A plan that starts with a verb reads as a plain question (QA, Nov 8 2026: "Did you do this: “Write 3
 *  lines before bed”?" read like a robot): EN "Did you write 3 lines before bed?", RU «Получилось писать
 *  3 строчки перед сном?». Anything else keeps the quoted form. */
const planAsQuestion = (plan: string): string => {
  const p = plan.trim().replace(/[.!?]+$/, "");
  const first = p.split(/\s+/)[0] ?? "";
  const lower = p.charAt(0).toLocaleLowerCase() + p.slice(1);
  if (i18n.language?.startsWith("ru")) {
    if (/^[А-ЯЁа-яё]+(ть|ться|ти|тись|чь|чься)$/.test(first)) return `Получилось ${lower}?`;
  } else if (/^[A-Za-z]+$/.test(first) && !/^(no|not|less|more|a|an|the|only|without|never|one|two|three|every|each|my|your|some|any|at|in|on|by|for|before|after)$/i.test(first) && !/(ing|ed|s)$/i.test(first)) {
    return `Did you ${lower}?`;
  }
  return i18n.t("experiment.planQ", { plan: p });
};

/** A step done in the morning ("Spend 10 minutes outside in the morning"): started in the afternoon, its first
 *  evening is tomorrow — today's morning is gone (Nov 10 2026). */
export const morningStep = (k: string): boolean => {
  const s = `${i18n.t(`experiment.idea.${k}.change`, { lng: "en" })} ${i18n.t(`experiment.idea.${k}.q`, { lng: "en" })}`;
  return MORNING.test(s) && !/tomorrow/i.test(s);
};
const MORNING = /\b(this morning|in the morning|morning light|after waking|first (work )?hour|before noon)\b/i;

/** Today's step for a test's push (her note, Nov 8 2026: not the plan, but "не забудь
 *  потренироваться сегодня"): an idea's or a goal's own line, else null (her own words go in the body). */
export const testTodayOf = (change: string, x?: Pick<Experiment, "wake">): string | null => {
  const k = ideaOf(change);
  // a bedtime counted back from the wake-up time: "Tonight: in bed by 23:00" (her note, Nov 10 2026: "во сколько надо лечь?")
  if (k && BED_FROM_WAKE[k] && x?.wake) return i18n.t(`experiment.idea.${k}.todayAt`, { time: clockTime(bedtimeFrom(x.wake, BED_FROM_WAKE[k])), wake: clockTime(x.wake) });
  if (k) return i18n.t(`experiment.idea.${k}.today`);
  const g = goalTemplateOf(change);
  return g ? i18n.t(`experiment.goalToday.${g}`) : null;
};

/** Plans that are a weekly goal for the question itself: how many a week. The rule of
 *  the question matches the goal (fewer than that in 7 days → time to act). */
export const GOALS: Record<string, number> = { exercised: 3, "strength-training": 2, "time-in-nature": 2, "hobby-time": 2 };
const TEMPLATES = new Map(LIFE_STREAMS.flatMap((s) => s.templates).map((t) => [t.id, t]));
/** The weekly goals' words, now and before Nov 8 2026, in both languages. */
const OLD_GOAL_WORDS: Record<string, string[]> = {
  exercised: ["Book 3 workout slots in calendar this week", "Внести 3 тренировки в календарь на эту неделю"],
  "strength-training": ["Put 2 strength sessions in the calendar this week", "Внести в календарь 2 силовые тренировки на эту неделю"],
  "time-in-nature": ["Plan two nature walks this week", "Запланировать на неделе две прогулки на природе"],
  "hobby-time": ["Put the hobby in the calendar twice a week", "Поставить хобби в календарь два раза в неделю"],
};
/** The library question a weekly-goal plan is about, from its words (new or old, either language). */
export const goalTemplateOf = (change: string): string | null => {
  const n = norm(change || "");
  if (!n) return null;
  for (const id of Object.keys(GOALS)) {
    const tpl = TEMPLATES.get(id);
    const words = [tpl?.adviceAboveThreshold, tpl?.adviceAboveThresholdRu, ...(OLD_GOAL_WORDS[id] ?? [])].filter((x): x is string => !!x);
    if (words.some((w) => norm(w) === n)) return id;
  }
  return null;
};
/** Once (Nov 8 2026): a test started from an old weekly-goal plan asked its own copy of the
 *  question ("Внести 3 тренировки…?") next to hers. It moves onto her question with the goal,
 *  and the copy is put away. */
export const migrateGoalTests = async (): Promise<void> => {
  const list = getExperiments();
  if (!list.some((x) => !x.reviewed && !x.same && goalTemplateOf(x.change))) return;
  const trackers = await getTrackers();
  const away = new Set<string>();
  const next: Experiment[] = list.map((x) => {
    if (x.reviewed || x.same) return x;
    const g = goalTemplateOf(x.change);
    const own = g ? trackers.find((t) => !t.archived && !t.id.endsWith("-test") && matchTemplateIdByTitle(t.title) === g) : undefined;
    if (!g || !own) return x;
    if (x.trackerId.endsWith("-test")) away.add(x.trackerId);
    return { ...x, same: true, trackerId: own.id, perWeek: GOALS[g] };
  });
  replaceExperiments(next);
  if (away.size) await saveTrackers(trackers.map((t) => (away.has(t.id) ? { ...t, archived: true } : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};
/** The goal a week, while the question still has the library's goal as its plan. */
export const goalOf = (tr: Tracker): number | null => {
  const id = matchTemplateIdByTitle(tr.title);
  const per = id ? GOALS[id] : undefined;
  const tpl = id ? TEMPLATES.get(id) : undefined;
  if (!per || !tpl) return null;
  const a = norm(tr.adviceAboveThreshold || "");
  return a && (a === norm(tpl.adviceAboveThreshold) || a === norm(tpl.adviceAboveThresholdRu ?? "")) ? per : null;
};
