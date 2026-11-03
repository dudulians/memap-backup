// Action points in plain words (her note, Nov 3 2026: "не поняла, как делать
// threshold… сколько дней мне нужно, не очень понимаю механику"). A rule is
// one of three choices, not two number fields: time to act when it happens
// 3 days in a week, 10 days in a month, or never. With it goes her plan:
// what she'll do then. That plan is the action point.
import { Tracker } from "@/types/tracker";

export type RuleKey = "week3" | "month10" | "off";
export const RULES: Record<RuleKey, { threshold: number; periodDays: number }> = {
  week3: { threshold: 3, periodDays: 7 },
  month10: { threshold: 10, periodDays: 30 },
  off: { threshold: 0, periodDays: 30 },
};
export const RULE_KEYS: RuleKey[] = ["week3", "month10", "off"];

/** Which of the three a question's rule is (null: an older custom one). */
export const ruleKeyOf = (t: Pick<Tracker, "threshold" | "periodDays">): RuleKey | null => {
  if (!t.threshold) return "off";
  return RULE_KEYS.find((k) => k !== "off" && RULES[k].threshold === t.threshold && RULES[k].periodDays === t.periodDays) ?? null;
};
