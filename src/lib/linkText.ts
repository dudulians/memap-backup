// A link in words, with the answers that really went together (Nov 6 2026, her note:
// "После «Был(а) на свежем воздухе» на следующий день было «Чувствовал(а) усталость»
// — 11 из 16": she had answered NO walk, and it read as if the walk brought the
// tiredness). Each side says its real answer ("short night", "no anxiety" — linkOf in
// islands.ts picks them), and the other days are told too, so a coincidence looks
// like one. The words come from answerPhrases.ts (her note, Nov 6 2026: titles glued
// into «В дни без «Спал(а) 7+ часов» было «Приступ мигрени»» "выглядит жутко").
//
// Two short parts, never a sentence (her note, Nov 9 2026, about "When you say yes when you
// mean no, the next day you often have a headache — 11 of 17 times": "как меня бесит эта
// формулировка… так сложно читается"):
//   headline  "Forced yes → headache the next day" / "Short night and headache often come together"
//   count     "11 of 17 times · on other days 4 of 20" / "every time — 6 of 6 · on other days 0 of 9"
import type { TFunction } from "i18next";
import type { Route } from "@/lib/islands";
import { answerPhrase, cap } from "@/lib/answerPhrases";
import { getLanguage } from "@/lib/i18n";
import type { Tracker } from "@/types/tracker";

/** A question by its id (the link's two sides). */
export type TrackerOf = (id: string) => Tracker | undefined;
export const trackerLookup = (trackers: Tracker[]): TrackerOf => {
  const m = new Map(trackers.map((x) => [x.id, x]));
  return (id) => m.get(id);
};

type Sides = Pick<Route, "first" | "second" | "firstYes" | "secondYes" | "nextDay" | "k" | "n">;
type Counts = Pick<Route, "k" | "n"> & { other?: { k: number; n: number } };

/** One side, as a headline word: English drops a leading "a"/"an" ("a forced yes" → "forced yes"). */
const side = (t: TFunction, tr: Tracker | undefined, yes: boolean): string => {
  const p = answerPhrase(t, tr, yes);
  return getLanguage() === "ru" ? p : p.replace(/^an? (?=\S)/i, "");
};

/** A thing, not a happening: "short night", «головная боль» — fits "A and B often come together".
 *  Not her own question with its answer, not «без …», not a clause («родитель плохо спал», «хочется
 *  уволиться», "meds missed"): «Без тренировки и сильная усталость…» reads as "without both". */
const nounLike = (p: string, ru: boolean): boolean => {
  if (/[:«»“”"]/.test(p)) return false;
  if (ru) return !/^(без|в|во|с|со|по|у|сверх|ночью|всё|по-настоящему)\s/i.test(p)
    && !/(^|\s)(не|нет|ни|ел|хорошо|здоров|поровну|обычно|сильнее|в порядке)(?=\s|$)/i.test(p)
    && !/[а-яё]{2,}(ал|ял|ил|ел|ыл|ул|ла|ло|ли|ся|сь|ет|ёт|ит|ут|ют|ят|на|ны|но|ты|ен|ан)(?=[\s,]|$)/i.test(p);
  return !/\b(raised|held|felt|taken|missed|done|kept|put|called|wrote|ate|slept|moved|skipped|refused|stumbled|fell|limping|walking|confused|clear|fine|healthy|okay|well|poorly|steady|on time|not)\b/i.test(p);
};

/** The headline: "Forced yes → headache the next day". The same day, no arrow (it says nothing
 *  about what came first): "Short night and headache often come together"; when a side is not a
 *  plain thing: «Без тренировки — и сильная усталость в тот же день». */
export const linkHead = (t: TFunction, r: Sides, of: TrackerOf): string => {
  const a = side(t, of(r.first), r.firstYes), b = side(t, of(r.second), r.secondYes);
  if (r.nextDay) return t("link.headNextDay", { first: cap(a), second: b });
  const ru = getLanguage() === "ru";
  if (!nounLike(a, ru) || !nounLike(b, ru)) return t("link.headSameDayThen", { first: cap(a), second: b });
  // "often" only when it came on at least half of those days; else "more than usual" (the count says how much)
  const often = r.n > 0 && r.k * 2 >= r.n;
  return t(often ? "link.headSameDay" : "link.headSameDayMore", { first: cap(a), second: b });
};

/** "11 of 17 times"; all of them: "every time — 6 of 6" (never "always" alone). */
export const linkTimes = (t: TFunction, k: number, n: number): string =>
  n > 0 && k === n ? t("link.everyTime", { k, n }) : t("link.times", { k, count: n });

/** "on other days 4 of 20" (empty when there are none to tell). */
export const linkOtherDays = (t: TFunction, r: Counts): string =>
  r.other && r.other.n > 0 ? t("link.otherDays", { k: r.other.k, n: r.other.n }) : "";

/** The count line under the headline: "11 of 17 times · on other days 4 of 20". Each part stays
 *  on one line (a narrow card broke it as "on other days 14 / of 45"); it wraps only at the dot. */
export const linkCount = (t: TFunction, r: Counts): string =>
  [linkTimes(t, r.k, r.n), linkOtherDays(t, r)].filter(Boolean).map((x) => x.replace(/ /g, " ")).join(" · ");
