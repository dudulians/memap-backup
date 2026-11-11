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
import { answerClause, answerPhrase, cap, oftenWord } from "@/lib/answerPhrases";
import { calmOf, mostlyCount } from "@/lib/findingForms";
import type { Tracker } from "@/types/tracker";

/** A question by its id (the link's two sides). */
export type TrackerOf = (id: string) => Tracker | undefined;
export const trackerLookup = (trackers: Tracker[]): TrackerOf => {
  const m = new Map(trackers.map((x) => [x.id, x]));
  return (id) => m.get(id);
};

type Sides = Pick<Route, "first" | "second" | "firstYes" | "secondYes" | "nextDay" | "k" | "n"> & { mostly?: Route["mostly"] };
type Counts = Pick<Route, "k" | "n"> & { other?: { k: number; n: number }; mostly?: Route["mostly"] };

/** The link as a person would say it, with how often ("usually", "often": oftenWord). The sides are the
 *  answers that really went together (answerSentences.ts), the cause first. The same day says nothing about
 *  what came first: "On days you sleep under 7 hours, you usually have a headache" /
 *  «В дни, когда ты спишь меньше 7 часов, обычно болит голова»; the next day: "The day after you drink
 *  alcohol, you often feel anxious" / «Если ты пьёшь алкоголь, на следующий день часто бывает тревога». */
export const linkHeadPlain = (t: TFunction, r: Sides, of: TrackerOf): string =>
  cap(t(r.nextDay ? "link.sayNextDay" : "link.saySameDay", {
    cause: answerClause(t, of(r.first), r.firstYes, "cause"),
    result: answerClause(t, of(r.second), r.secondYes, "result", oftenWord(t, r.k, r.n)),
  }));

/** The headline. When most of the days with what it says came on such days and the other days are calm (her pick,
 *  Nov 11 2026; findingForms.mostlyOf), it starts from that thing: "You mostly argue with your partner on days you
 *  feel drained after work" / «Вы с партнёром в основном ссоритесь в дни, когда после работы не остаётся сил»;
 *  from 9 of 10: "…almost only on days…". Otherwise the plain sentence. */
export const linkHead = (t: TFunction, r: Sides, of: TrackerOf): string => {
  if (!r.mostly) return linkHeadPlain(t, r, of);
  const cause = answerClause(t, of(r.first), r.firstYes, "cause");
  if (r.mostly === "almostOnly") return cap(t(r.nextDay ? "link.onlyNextDay" : "link.onlySameDay", { cause, result: answerClause(t, of(r.second), r.secondYes, "result") }));
  return cap(t(r.nextDay ? "link.mostlyNextDay" : "link.mostlySameDay", { cause, result: answerClause(t, of(r.second), r.secondYes, "result", t("link.advMostly")) }));
};

/** The numbers a link counts: of the days with the cause, how many had it ("12 of 16"); a "mostly" link counts from
 *  what it says ("12 of 14 times": of all those days, how many were such days). */
export const linkNumbers = (r: Counts): { k: number; n: number } =>
  r.mostly && r.other ? mostlyCount({ first: "", second: "", firstYes: true, secondYes: true, nextDay: false, k: r.k, n: r.n, other: r.other }) : { k: r.k, n: r.n };

/** One link leading into the next, told as one story (her pick, Nov 11 2026): "On days you sleep under 7 hours, you
 *  usually feel drained after work. On those days you usually argue with your partner." */
export const chainText = (t: TFunction, l1: Sides, l2: Sides, of: TrackerOf): string =>
  `${linkHeadPlain(t, l1, of)}. ${cap(t(l2.nextDay ? "link.chainNextDay" : "link.chainSameDay", { result: answerClause(t, of(l2.second), l2.secondYes, "result", oftenWord(t, l2.k, l2.n)) }))}`;

/** Two or three links into the same answer, as one sentence (her note, Nov 11 2026: words first, numbers on tap):
 *  "You most often have a headache on days you have your period or you feel stressed". */
export const twoThingsText = (t: TFunction, ls: Sides[], of: TrackerOf): string => {
  const causes = ls.map((l) => answerClause(t, of(l.first), l.firstYes, "cause"));
  const joined = causes.length > 1 ? `${causes.slice(0, -1).join(", ")} ${t("link.or")} ${causes[causes.length - 1]}` : causes[0];
  const l = ls[0];
  return cap(t(l.nextDay ? "link.twoNextDay" : "link.twoSameDay", { causes: joined, result: answerClause(t, of(l.second), l.secondYes, "result", t("link.advMostOften")) }));
};
/** Its lines on tap: "Period day: 7 of 10 times". */
export const twoThingsLine = (t: TFunction, l: Sides, of: TrackerOf): string =>
  t("link.twoLine", { what: cap(answerPhrase(t, of(l.first), l.firstYes)), times: linkTimes(t, l.k, l.n) });

/** "11 of 17 times"; all of them: "every time — 6 of 6" (never "always" alone). */
export const linkTimes = (t: TFunction, k: number, n: number): string =>
  n > 0 && k === n ? t("link.everyTime", { k, n }) : t("link.times", { k, count: n });

/** The big number on a link's sheet: "11 of 17 times", "Every time — 15 of 15". Capitalised; "15 of 15" stays on
 *  one line and the dash never starts one (it may wrap after the dash: a whole line at that size can be too wide). */
export const linkTimesBig = (t: TFunction, k: number, n: number): string =>
  cap(linkTimes(t, k, n)).replace(/(\d+) (\S+) (\d+)/, "$1 $2 $3").replace(/ — /, " — ");

/** "on other days 4 of 20"; calm ones in words (her numbers, Nov 11 2026): "on other days almost never: 2 of 44"
 *  (empty when there are none to tell). */
export const linkOtherDays = (t: TFunction, r: Counts): string => {
  if (!r.other || r.other.n <= 0) return "";
  const calm = calmOf(r.other.k, r.other.n);
  return calm ? t("link.otherDaysWord", { word: t(`link.calm.${calm}`), k: r.other.k, n: r.other.n }) : t("link.otherDays", { k: r.other.k, n: r.other.n });
};

/** The count line under the headline: "11 of 17 times · on other days 4 of 20". Each part stays
 *  on one line (a narrow card broke it as "on other days 14 / of 45"); it wraps only at the dot. */
export const linkCount = (t: TFunction, r: Counts): string => {
  const { k, n } = linkNumbers(r);
  // a line of its own: "Every time — 15 of 15 · …" starts with a capital (Nov 10 2026: "every time — …" in the list)
  return [cap(linkTimes(t, k, n)), linkOtherDays(t, r)].filter(Boolean).map((x) => x.replace(/ /g, " ")).join(" · ");
};
