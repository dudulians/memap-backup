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
import { IDEAS } from "@/lib/experiments";
import { LEGACY_IDEA_NAMES } from "@/lib/ideaNames";

const norm = (s: string) => s.trim().toLowerCase().replace(/[.?!？]+$/, "").replace(/\s+/g, " ");
const ideaKeys = () => [...new Set(Object.values(IDEAS).flat())];

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

/** A test's name (her plan) in today's language; her own words stay hers. */
export const testNameOf = (change: string): string => {
  const k = ideaOf(change);
  return k ? i18n.t(`experiment.idea.${k}.change`) : localizeTrackerAdvice(change.trim());
};

/** The evening question for a plan: the idea's own question, else "Did you do this: “…”?" */
export const testQuestionOf = (change: string): string => {
  const k = ideaOf(change);
  return k ? i18n.t(`experiment.idea.${k}.q`) : i18n.t("experiment.planQ", { plan: testNameOf(change) });
};

/** Plans that are a weekly goal for the question itself: how many a week. The rule of
 *  the question matches the goal (fewer than that in 7 days → time to act). */
export const GOALS: Record<string, number> = { exercised: 3, "strength-training": 2, "time-in-nature": 2 };
const TEMPLATES = new Map(LIFE_STREAMS.flatMap((s) => s.templates).map((t) => [t.id, t]));
/** The goal a week, while the question still has the library's goal as its plan. */
export const goalOf = (tr: Tracker): number | null => {
  const id = matchTemplateIdByTitle(tr.title);
  const per = id ? GOALS[id] : undefined;
  const tpl = id ? TEMPLATES.get(id) : undefined;
  if (!per || !tpl) return null;
  const a = norm(tr.adviceAboveThreshold || "");
  return a && (a === norm(tpl.adviceAboveThreshold) || a === norm(tpl.adviceAboveThresholdRu ?? "")) ? per : null;
};
