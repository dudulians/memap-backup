// The end of a 2-week test in plain words (her note, Nov 11 2026: "у нас нет там более человеческой фразы? типа:
// отлично, кажется прогулки помогают, вы стали меньше ссориться. Хочу, чтобы люди человеческие вещи читали").
// One line names the test and says what changed in the question that changed most: "Looks like walks together
// help: you argue with your partner less often", the count under it. Never a cause: "Looks like" and the count.
// Where the words don't fit (her own question, a line that reads badly), the old plain line stays.
import type { TFunction } from "i18next";
import type { Tracker } from "@/types/tracker";
import { getLanguage } from "@/lib/i18n";
import { answerClause, answerPhrase, cap, templateIdOf } from "@/lib/answerPhrases";
import { S } from "@/lib/answerSentences";
import { verdictOf, type Experiment, type ExperimentResult } from "@/lib/experiments";
import { ideaOf } from "@/lib/testWords";
import { IDEA_SHORT } from "@/lib/ideaShorts";

/** Questions whose "yes" sentence reads badly with "more often / less often", or that no change of hers can move
 *  (the weather, the neighbours, a bill): checked by eye in the table of all of them, Nov 11 2026. */
const NO_OFTEN_BOTH = ["felt-overwhelmed-parenting", "unfair-chores", "ate-sweets", "hard-to-poop", "pooped-today", "period-day",
  "morning-libido", "didnt-want-to-work", "didnt-understand-locals", "pet-skipped-food", "long-commute", "travel-or-night-away",
  "hot-day", "weather-change", "noisy-neighbors", "construction-nearby", "transport-issue", "internet-down", "financial-issue",
  "heard-bad-news", "dealt-with-paperwork"];
export const NO_OFTEN: Record<"en" | "ru", Set<string>> = {
  en: new Set([...NO_OFTEN_BOTH, "calm-day"]),
  ru: new Set([...NO_OFTEN_BOTH, "burned-out-after-work", "felt-fatigued"]),
};

const ru = () => getLanguage() === "ru";

/** The question's "yes" said with how often: "you argue with your partner less often", «вы реже ссоритесь с партнёром». */
export const oftenSentence = (t: TFunction, tr: Tracker, more: boolean): string | null => {
  const id = templateIdOf(tr);
  if (!id || !S[id] || NO_OFTEN[ru() ? "ru" : "en"].has(id)) return null;
  // Russian puts the word where "~" is ("вы ~ссоритесь"); a clause without one can't take it
  if (ru() && !S[id][2].split("|").pop()!.includes("~")) return null;
  const word = t(more ? "experiment.oftenMore" : "experiment.oftenLess");
  const s = ru() ? answerClause(t, tr, true, "result", word) : `${answerClause(t, tr, true, "result")} ${word}`;
  return s.replace(/\s+/g, " ").trim() || null;
};

/** "walks together help" → "walks together don't help"; «прогулки вместе помогают» → «… не помогают». */
const notHelping = (short: string): string | null => {
  if (/ helps$/.test(short)) return short.replace(/ helps$/, " doesn't help");
  if (/ help$/.test(short)) return short.replace(/ help$/, " don't help");
  if (/ помогает$/.test(short)) return short.replace(/ помогает$/, " не помогает");
  if (/ помогают$/.test(short)) return short.replace(/ помогают$/, " не помогают");
  return null;
};

/** The test's short name with its verb ("walks together help"), in today's language, if it has one. */
export const ideaShort = (change: string): string | null => {
  const k = ideaOf(change);
  const s = k ? IDEA_SHORT[k] : undefined;
  return s ? s[ru() ? 1 : 0] : null;
};

export interface ResultWords {
  /** the first line: "Looks like walks together help: you argue with your partner less often." or the plain verdict */
  head: string;
  /** the head said it in a sentence (then `count` is its count) */
  human: boolean;
  /** under a human head: "2 of 14 days during the test, 8 of 14 in the two weeks before." */
  count?: string;
  /** under a plain head: the question that changed most, "You argue with your partner less often: 2 of 14 …" */
  most?: string;
}

export const resultWords = (t: TFunction, x: Experiment, r: ExperimentResult, trackers: Tracker[]): ResultWords => {
  const v = verdictOf(r);
  const plain: ResultWords = { head: t(`experiment.verdict.${v}`), human: false };
  const m = r.most, tr = m ? trackers.find((y) => y.id === m.trackerId) : undefined;
  if (!m || !tr) return plain;
  // the "yes" days on each side, so the count says what the sentence says
  const yes = ([k, n]: [number, number]) => (m.hardYes ? k : n - k);
  const ya = yes(m.a), yb = yes(m.b);
  const more = ya / m.a[1] > yb / m.b[1];
  const better = m.hardYes ? !more : more;
  const sentence = oftenSentence(t, tr, more);
  if (!sentence) {
    return { ...plain, most: t(m.by === "with" ? "experiment.mostWith" : "experiment.mostBefore", { what: answerPhrase(t, tr, m.hardYes), a: m.a[0], b: m.a[1], c: m.b[0], d: m.b[1] }) };
  }
  const count = t(m.by === "with" ? "experiment.countWith" : "experiment.countBefore", { a: ya, b: m.a[1], c: yb, d: m.b[1] });
  const base = v.replace("Before", "");
  if ((base === "better" && better) || (base === "worse" && !better)) {
    const short = ideaShort(x.change);
    const what = better ? short ?? t("experiment.itHelps") : (short && notHelping(short)) ?? t("experiment.itNoHelp");
    return { head: t("experiment.looks", { what, how: sentence }), human: true, count };
  }
  return { ...plain, most: t("experiment.mostLine", { how: cap(sentence), count }) };
};

/** Praise for the effort only, never for the result (her pick A, Nov 11 2026): 10–13 of 14 "Well done!",
 *  7–9 "Good effort!", fewer: just the count. All 14 has its own line. */
export const praiseFor = (t: TFunction, did: number): string | null =>
  did >= 10 ? t("experiment.praiseGood") : did >= 7 ? t("experiment.praiseOk") : null;
