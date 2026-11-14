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
import { answerClause, answerPhrase, cap, oftenWord, ownText, wordsIdOf } from "@/lib/answerPhrases";
import { calmOf, mostlyCount } from "@/lib/findingForms";
import type { Tracker } from "@/types/tracker";

/** A question by its id (the link's two sides). */
export type TrackerOf = (id: string) => Tracker | undefined;
export const trackerLookup = (trackers: Tracker[]): TrackerOf => {
  const m = new Map(trackers.map((x) => [x.id, x]));
  return (id) => m.get(id);
};

type Sides = Pick<Route, "first" | "second" | "firstYes" | "secondYes" | "nextDay" | "k" | "n"> & { mostly?: Route["mostly"]; together?: boolean; other?: { k: number; n: number } };
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
  if (r.together && !r.nextDay) return linkFallText(t, r, of);
  if (!r.mostly) return linkHeadPlain(t, r, of);
  const cause = answerClause(t, of(r.first), r.firstYes, "cause");
  if (r.mostly === "almostOnly") return cap(t(r.nextDay ? "link.onlyNextDay" : "link.onlySameDay", { cause, result: answerClause(t, of(r.second), r.secondYes, "result") }));
  return cap(t(r.nextDay ? "link.mostlyNextDay" : "link.mostlySameDay", { cause, result: answerClause(t, of(r.second), r.secondYes, "result", t("link.advMostly")) }));
};

/** The same day with no order claimed (her pick, Nov 12 2026; linkOrder.ts): when the days fall, not what led to
 *  what. "The days you argue with your partner mostly fall on days you feel drained after work" / «Дни, когда вы с
 *  партнёром ссоритесь, в основном приходятся на дни, когда после работы не остаётся сил»; plain: "The days you sleep
 *  under 7 hours usually fall on days you have a headache". Both sides as days ("cause" clauses). */
export const linkFallText = (t: TFunction, r: Sides, of: TrackerOf): string => {
  // two typed questions with no short words (her pick, Nov 12 2026): the questions as typed, the answers named
  // once ("The days you answer “yes” to … fall on days you answer “yes” to …" read clumsily)
  const A = of(r.first), B = of(r.second);
  const bare = (x: Tracker | undefined, yes: boolean): x is Tracker => !!x && !wordsIdOf(x) && !(yes ? x.words?.yes : x.words?.no);
  if (bare(A, r.firstYes) && bare(B, r.secondYes)) {
    const adv = r.mostly === "almostOnly" ? oftenWord(t, 9, 10) : r.mostly ? t("link.advMostly") : oftenWord(t, r.k, r.n);
    if (r.firstYes && r.secondYes) return cap(t("link.ownTogetherYes", { a: ownText(A), b: ownText(B), adv }));
    return cap(t("link.ownTogether", { x: t(r.firstYes ? "link.yes" : "link.no"), a: ownText(A), y: t(r.secondYes ? "link.yes" : "link.no"), b: ownText(B), adv }));
  }
  const a = answerClause(t, of(r.first), r.firstYes, "cause"), b = answerClause(t, of(r.second), r.secondYes, "cause");
  if (r.mostly === "almostOnly") return cap(t("link.fallOnly", { a: b, b: a }));
  if (r.mostly) return cap(t("link.fallMostly", { a: b, b: a }));
  return cap(t("link.fallPlain", { a, b, adv: oftenWord(t, r.k, r.n) }));
};

/** The short line under a link's two tags: "Mostly the same days", "Usually the same days"; the next day: "Usually". */
export const linkWhen = (t: TFunction, r: Sides): string => {
  if (r.nextDay) return cap(oftenWord(t, r.k, r.n));
  if (r.mostly === "almostOnly") return t("link.sameOnly");
  if (r.mostly) return t("link.sameMostly");
  const q = r.n ? r.k / r.n : 0;
  return t(`link.same.${r.n > 0 && r.k === r.n ? "all" : q >= 0.9 ? 0 : q >= 0.7 ? 1 : q >= 0.5 ? 2 : 3}`);
};

/** The calm half in words (her note via the store work, Nov 12 2026: "в остальные дни ты чувствуешь себя отлично"):
 *  "On other days almost never"; empty when the other days are not calm. */
export const linkCalmLine = (t: TFunction, r: Counts): string => {
  if (!r.other || r.other.n <= 0) return "";
  const calm = calmOf(r.other.k, r.other.n);
  return calm ? t("link.otherCalm", { word: t(`link.calm.${calm}`) }) : "";
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
  // the same day with no order: when the days fall ("The days you argue… most often fall on days you feel drained
  // after work or you sleep under 7 hours")
  if (!l.nextDay && ls.some((x) => x.together)) return cap(t("link.twoFall", { causes: joined, result: answerClause(t, of(l.second), l.secondYes, "cause") }));
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

// --- The key words lit (her pick on the prototype, Nov 12 2026) ---------------------------------------------------
/** A sentence in parts: the two answers carry their side ("a" = the link's first, "b" = its second), lit in the pair's
 *  colours (indigo, lilac) like the link's two lines and rows of days. */
export type Seg = { text: string; side?: "a" | "b" };
const MA = "\u0001", MB = "\u0003", ME = "\u0002";
/** Which parameter of each sentence is which side of the link. */
const SIDES: Record<string, Record<string, "a" | "b">> = {
  "link.sayNextDay": { cause: "a", result: "b" }, "link.saySameDay": { cause: "a", result: "b" },
  "link.mostlySameDay": { cause: "a", result: "b" }, "link.mostlyNextDay": { cause: "a", result: "b" },
  "link.onlySameDay": { cause: "a", result: "b" }, "link.onlyNextDay": { cause: "a", result: "b" },
  "link.fallPlain": { a: "a", b: "b" }, "link.fallMostly": { a: "b", b: "a" }, "link.fallOnly": { a: "b", b: "a" },
  "link.ownTogetherYes": { a: "a", b: "b" }, "link.ownTogether": { a: "a", b: "b" },
  "link.twoSameDay": { result: "a", causes: "b" }, "link.twoNextDay": { result: "a", causes: "b" }, "link.twoFall": { result: "a", causes: "b" },
};
const marking = (t: TFunction): TFunction => ((key: string, opts?: Record<string, unknown>) => {
  const sides = SIDES[key];
  if (!sides || !opts) return (t as unknown as (k: string, o?: unknown) => string)(key, opts);
  const o: Record<string, unknown> = { ...opts };
  for (const [k, side] of Object.entries(sides)) if (typeof o[k] === "string") o[k] = (side === "a" ? MA : MB) + o[k] + ME;
  return (t as unknown as (k: string, o?: unknown) => string)(key, o);
}) as unknown as TFunction;
/** "you usually" stays unlit: the answer itself is what lights up. */
const LEAD = /^(?:(?:you|ты|вы)\s+)?(?:(?:almost always|almost never|almost only|usually|often|mostly|always|never|more often|почти всегда|почти никогда|обычно|часто|всегда|никогда|чаще|в основном)\s+)?/i;
const toSegs = (s: string): Seg[] => {
  const out: Seg[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i), j = rest.search(/[\u0001\u0003]/);
    if (j < 0) { out.push({ text: rest }); break; }
    if (j > 0) out.push({ text: rest.slice(0, j) });
    const side: "a" | "b" = rest[j] === MA ? "a" : "b";
    const end = s.indexOf(ME, i + j);
    const inner = s.slice(i + j + 1, end < 0 ? s.length : end);
    const lead = LEAD.exec(inner)?.[0] ?? "";
    if (lead) out.push({ text: lead });
    if (inner.length > lead.length) out.push({ text: inner.slice(lead.length), side });
    i = end < 0 ? s.length : end + 1;
  }
  // the capital a mark took from the sentence's start
  const first = out.find((x) => x.text.trim());
  if (first) first.text = first.text.replace(/^(\s*)(\S)/, (_m, sp: string, ch: string) => sp + ch.toLocaleUpperCase());
  return out.filter((x) => x.text);
};
/** The link's headline in parts (linkHead), its two answers marked. */
export const linkHeadSegs = (t: TFunction, r: Sides, of: TrackerOf): Seg[] => toSegs(linkHead(marking(t), r, of));
/** "Two things" in parts: the answer they come with is "a", the things "b". */
export const twoThingsSegs = (t: TFunction, ls: Sides[], of: TrackerOf): Seg[] => toSegs(twoThingsText(marking(t), ls, of));
