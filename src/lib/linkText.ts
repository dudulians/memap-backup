// A link in words, with the answers that really went together (Nov 6 2026, her note:
// "После «Был(а) на свежем воздухе» на следующий день было «Чувствовал(а) усталость»
// — 11 из 16": she had answered NO walk, and it read as if the walk brought the
// tiredness). Each side says its real answer ("without", "no" — linkOf in islands.ts
// picks them), and the other days are told too, so a coincidence looks like one.
import type { TFunction } from "i18next";
import type { Route } from "@/lib/islands";

type Title = (id: string) => string;

/** "Short sleep → Headache", "Without “30 minutes outside” → Felt drained",
 *  "Felt anxious → without “Slept 7+ hours”". */
export const linkArrow = (t: TFunction, r: Route, title: Title): string =>
  `${r.firstYes ? title(r.first) : t("link.without", { q: title(r.first) })} → ${r.secondYes ? title(r.second) : t("link.withoutLow", { q: title(r.second) })}`;

/** The full sentence: after / on days with (or without) the first, the second came k of n times. */
export const linkSentence = (t: TFunction, r: Route, title: Title): string =>
  t(`link.${r.nextDay ? "afterNextDay" : "sameDay"}${!r.firstYes ? "Without" : !r.secondYes ? "Not" : ""}`, { first: title(r.first), second: title(r.second), k: r.k, count: r.n });

/** The other days, for comparison: "On other days: 3 of 24." */
export const linkOther = (t: TFunction, r: Route): string => t("link.other", { k: r.other.k, count: r.other.n });
