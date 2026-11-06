// A link in words, with the answers that really went together (Nov 6 2026, her note:
// "После «Был(а) на свежем воздухе» на следующий день было «Чувствовал(а) усталость»
// — 11 из 16": she had answered NO walk, and it read as if the walk brought the
// tiredness). Each side says its real answer ("short night", "no anxiety" — linkOf in
// islands.ts picks them), and the other days are told too, so a coincidence looks
// like one. The words come from answerPhrases.ts (her note, Nov 6 2026: titles glued
// into «В дни без «Спал(а) 7+ часов» было «Приступ мигрени»» "выглядит жутко").
import type { TFunction } from "i18next";
import type { Route } from "@/lib/islands";
import { answerClause, answerPhrase, cap, oftenWord } from "@/lib/answerPhrases";
import type { Tracker } from "@/types/tracker";

/** A question by its id (the link's two sides). */
export type TrackerOf = (id: string) => Tracker | undefined;
export const trackerLookup = (trackers: Tracker[]): TrackerOf => {
  const m = new Map(trackers.map((x) => [x.id, x]));
  return (id) => m.get(id);
};

/** "Short night → migraine", "No time outside → drained all day",
 *  "Anxiety → short night". */
export const linkArrow = (t: TFunction, r: Route, of: TrackerOf): string =>
  `${cap(answerPhrase(t, of(r.first), r.firstYes))} → ${answerPhrase(t, of(r.second), r.secondYes)}`;

/** Short and exact, for the specialist's report: "Short night → migraine the next day — 4 of 5 times." */
export const linkShort = (t: TFunction, r: Route, of: TrackerOf): string =>
  t(r.nextDay ? "link.lineNextDay" : "link.lineSameDay", { first: cap(answerPhrase(t, of(r.first), r.firstYes)), second: answerPhrase(t, of(r.second), r.secondYes), k: r.k, count: r.n });

/** The link as a person would say it (her note, Nov 6 2026): "On days when you sleep
 *  under 7 hours, you almost always get a migraine — 9 of 10 times." /
 *  «Если ты пьёшь кофе после 14:00, на следующий день ты обычно спишь меньше 7 часов». */
export const linkSentence = (t: TFunction, r: Pick<Route, "first" | "second" | "firstYes" | "secondYes" | "nextDay" | "k" | "n">, of: TrackerOf): string =>
  t(r.nextDay ? "link.sayNextDay" : "link.saySameDay", {
    cause: answerClause(t, of(r.first), r.firstYes, "cause"),
    result: answerClause(t, of(r.second), r.secondYes, "result", oftenWord(t, r.k, r.n)),
    k: r.k, count: r.n,
  });

/** The other days, for comparison: "On other days: 3 of 24." */
export const linkOther = (t: TFunction, r: Route): string => t("link.other", { k: r.other.k, count: r.other.n });
