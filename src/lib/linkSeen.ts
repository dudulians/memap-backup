// Links the person has gone through (her note, Nov 14 2026: «когда ты возвращаешься опять на список линков… не очень
// понятно, это та же старая или какая-то новая… подсвечивать галочкой, что она… отработана»). A link counts as seen
// once its card was walked to the last step (or opened, when it has one step). Kept on the phone only.
import type { Tracker, TrackerEntry } from "@/types/tracker";
import type { TFunction } from "i18next";
import { computeCorrelations } from "./correlations";
import { finishedExperiments, runningExperiments, type Experiment } from "./experiments";
import { linkOf, linkWorthShowing, LINKS_TOP } from "./islands";
import { answerPhrase, cap } from "./answerPhrases";
import { cardQuestion } from "./cardText";
import { ideaTarget } from "./topicIdeas";
import { ideaOf } from "./testWords";

const KEY = "memap_links_seen";

/** One link: its two questions (any order) and whether it is a next-day link. */
export const linkSeenKey = (a: string, b: string, nextDay: boolean) => `${[a, b].sort().join("|")}|${nextDay ? 1 : 0}`;

const read = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
export const linkSeen = (key: string) => read().includes(key);
export const markLinkSeen = (key: string) => {
  const all = read();
  if (all.includes(key)) return;
  try { localStorage.setItem(KEY, JSON.stringify([...all, key].slice(-300))); } catch { /* private mode */ }
};

/** Where a link stands for the person: a try running from it, a try done, gone through, or new. */
export type LinkMark = { kind: "trying"; x: Experiment } | { kind: "tried"; x: Experiment } | { kind: "seen" } | null;
export const linkMark = (a: string, b: string, nextDay: boolean): LinkMark => {
  const pair = [a, b].sort().join("|");
  const run = runningExperiments().find((x) => x.link === pair);
  if (run) return { kind: "trying", x: run };
  const done = [...finishedExperiments()].reverse().find((x) => x.link === pair);
  if (done) return { kind: "tried", x: done };
  return linkSeen(linkSeenKey(a, b, nextDay)) ? { kind: "seen" } : null;
};

/** Where each try came from, said wherever the try shows (her note, Nov 14 2026: «должно быть… объяснено, в чем
 *  отличие между действием… в связях, и действием… с иконки… я уже не понимаю, что с чем связано»): a try is one
 *  thing wherever it was started, and says it came from a link (its two answers) or from When to act (its question). */
export const tryFromLines = (t: TFunction, xs: Experiment[], trackers: Tracker[], entries: TrackerEntry[]): Map<string, string> => {
  const out = new Map<string, string>();
  if (!xs.length) return out;
  const withLink = xs.some((x) => !!x.link);
  const links = withLink ? computeCorrelations(trackers.filter((y) => !y.archived && y.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing) : [];
  const q = (id: string) => trackers.find((y) => y.id === id);
  for (const x of xs) {
    if (x.link) {
      const c = links.find((y) => [y.trackerA.id, y.trackerB.id].sort().join("|") === x.link);
      // a same-day link claims no order (her rule since v139): no arrow between its two answers
      if (c) { const l = linkOf(c); out.set(x.id, t(c.lag !== 0 ? "tryFrom.link" : "tryFrom.linkSame", { a: cap(answerPhrase(t, l.first, l.firstYes)), b: cap(answerPhrase(t, l.second, l.secondYes)) })); continue; }
      const [a, b] = x.link.split("|").map(q);
      if (a && b) { out.set(x.id, t("tryFrom.linkSame", { a: cardQuestion(a), b: cardQuestion(b) })); continue; }
      out.set(x.id, t("tryFrom.linkPlain"));
      continue;
    }
    const from = x.from ? q(x.from) : undefined;
    if (from) { out.set(x.id, t("tryFrom.act", { q: cardQuestion(from) })); continue; }
    // picked on an island: the question there it is for (her note, Nov 15 2026: «к чему это?»)
    const target = ideaTarget(ideaOf(x.change), x.island, trackers, entries);
    if (target) out.set(x.id, t("experiment.forWhat", { what: cap(answerPhrase(t, target, target.problemWhen === "yes")) }));
  }
  return out;
};
