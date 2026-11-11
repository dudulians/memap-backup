// A link in words, with the answers that really went together (Nov 6 2026, her note:
// "После «Был(а) на свежем воздухе» на следующий день было «Чувствовал(а) усталость»
// — 11 из 16": she had answered NO walk, and it read as if the walk brought the
// tiredness). Each side says its real answer ("short night", "no anxiety" — linkOf in
// islands.ts picks them), and the other days are told too, so a coincidence looks
// like one. The words come from answerPhrases.ts (her note, Nov 6 2026: titles glued
// into «В дни без «Спал(а) 7+ часов» было «Приступ мигрени»» "выглядит жутко").
//
// A sentence, and the count on its own line under it. History: Nov 9 2026 her note about "When you say
// yes when you mean no, the next day you often have a headache — 11 of 17 times" ("как меня бесит эта
// формулировка… так сложно читается") made links two short parts ("Unwanted yes → headache the next day");
// Nov 11 2026 those "резали глаза" ("коротко и по делу, но что-то не то"), and after a page of real
// examples she chose sentences again ("Да, ставь"). What changed against the old sentences: the count is
// never glued on with a dash, and the opening is short ("The day after…", "On days you…"):
//   sentence  "The day after you agree to something you don't really want, you often have a headache"
//             «В дни, когда времени для себя нет, ты обычно срываешься на ребёнка»
//   count     "11 of 17 times · on other days 4 of 20" / "Every time — 6 of 6 · on other days 0 of 9"
import type { TFunction } from "i18next";
import type { Route } from "@/lib/islands";
import { answerClause, cap, oftenWord } from "@/lib/answerPhrases";
import type { Tracker } from "@/types/tracker";

/** A question by its id (the link's two sides). */
export type TrackerOf = (id: string) => Tracker | undefined;
export const trackerLookup = (trackers: Tracker[]): TrackerOf => {
  const m = new Map(trackers.map((x) => [x.id, x]));
  return (id) => m.get(id);
};

type Sides = Pick<Route, "first" | "second" | "firstYes" | "secondYes" | "nextDay" | "k" | "n">;
type Counts = Pick<Route, "k" | "n"> & { other?: { k: number; n: number } };

/** The link as a person would say it, with how often ("usually", "often": oftenWord). The sides are the
 *  answers that really went together (answerSentences.ts), the cause first. The same day says nothing about
 *  what came first: "On days you sleep under 7 hours, you usually have a headache" /
 *  «В дни, когда ты спишь меньше 7 часов, обычно болит голова»; the next day: "The day after you drink
 *  alcohol, you often feel anxious" / «Если ты пьёшь алкоголь, на следующий день часто бывает тревога». */
export const linkHead = (t: TFunction, r: Sides, of: TrackerOf): string =>
  cap(t(r.nextDay ? "link.sayNextDay" : "link.saySameDay", {
    cause: answerClause(t, of(r.first), r.firstYes, "cause"),
    result: answerClause(t, of(r.second), r.secondYes, "result", oftenWord(t, r.k, r.n)),
  }));

/** "11 of 17 times"; all of them: "every time — 6 of 6" (never "always" alone). */
export const linkTimes = (t: TFunction, k: number, n: number): string =>
  n > 0 && k === n ? t("link.everyTime", { k, n }) : t("link.times", { k, count: n });

/** The big number on a link's sheet: "11 of 17 times", "Every time — 15 of 15". Capitalised; "15 of 15" stays on
 *  one line and the dash never starts one (it may wrap after the dash: a whole line at that size can be too wide). */
export const linkTimesBig = (t: TFunction, k: number, n: number): string =>
  cap(linkTimes(t, k, n)).replace(/(\d+) (\S+) (\d+)/, "$1 $2 $3").replace(/ — /, " — ");

/** "on other days 4 of 20" (empty when there are none to tell). */
export const linkOtherDays = (t: TFunction, r: Counts): string =>
  r.other && r.other.n > 0 ? t("link.otherDays", { k: r.other.k, n: r.other.n }) : "";

/** The count line under the headline: "11 of 17 times · on other days 4 of 20". Each part stays
 *  on one line (a narrow card broke it as "on other days 14 / of 45"); it wraps only at the dot. */
export const linkCount = (t: TFunction, r: Counts): string =>
  // a line of its own: "Every time — 15 of 15 · …" starts with a capital (Nov 10 2026: "every time — …" in the list)
  [cap(linkTimes(t, r.k, r.n)), linkOtherDays(t, r)].filter(Boolean).map((x) => x.replace(/ /g, " ")).join(" · ");
