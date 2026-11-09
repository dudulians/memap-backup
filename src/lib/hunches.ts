// "Your hunch" (her note, Nov 2 2026: "шаг Guess дурацкий, там ненужный
// никому вопрос… как думаешь, от чего у тебя то-то или когда чаще то-то?
// человек отвечает, и мы добавляем это как вопрос для контроля, если
// пользователь захочет"). Once a day MeMap asks what she thinks is behind
// one of her hard questions; the suspects come from the app's curated map of
// related questions (relatedQuestions.ts), or her own idea. A suspect she
// doesn't ask yet can be added as a question, so MeMap can check the hunch;
// after enough days with both answered it says whether she was onto
// something. Counts only, never a cause. Stored on the phone.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, isoLocal } from "@/lib/doors";
import { getSuspectTemplateIds, getTemplatesByIds, matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import type { LifeStreamTemplate } from "@/lib/lifeStreams";
import { track } from "@/lib/analytics";

const KEY = "memap_hunches";
const DAY_KEY = "memap_hunch_day";
/** Days with both answered before a hunch is checked. */
export const HUNCH_DAYS = 10;

export interface Hunch {
  id: string;
  /** the question she wonders about */
  target: string;
  /** what she thinks is behind it (a question she answers) */
  suspect: string;
  made: string;
  /** when she looked at the result */
  seen?: string;
}

export const getHunches = (): Hunch[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Hunch[];
  } catch {
    return [];
  }
};
const save = (list: Hunch[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* the hunch just isn't kept */ }
};
/** Her hunch about one question: one or more suspects, each checked on its own. */
export const addHunches = (target: string, suspects: string[]) => {
  const today = isoLocal(new Date());
  const now = Date.now();
  const rest = getHunches().filter((h) => !(h.target === target && suspects.includes(h.suspect)));
  save([...rest, ...suspects.map((suspect, i) => ({ id: `${now}-${i}`, target, suspect, made: today }))]);
  markHunchDay();
  track("hunch_made", { suspects: suspects.length });
};
export const markHunchSeen = (id: string) => save(getHunches().map((h) => (h.id === id ? { ...h, seen: isoLocal(new Date()) } : h)));

/** One hunch a day (made, or "not now"). */
export const hunchDoneToday = () => {
  try { return localStorage.getItem(DAY_KEY) === isoLocal(new Date()); } catch { return false; }
};
export const markHunchDay = () => {
  try { localStorage.setItem(DAY_KEY, isoLocal(new Date())); } catch { /* asks again, harmless */ }
};

const live = (trackers: Tracker[]) => trackers.filter((t) => !t.archived && t.source !== "play");

/** What to wonder about today: her hard questions that came up most in the
 *  last 30 days, a different one of the top three each day; else her
 *  topic's question; else any. */
export const hunchTarget = (trackers: Tracker[], entries: TrackerEntry[]): Tracker | null => {
  const act = live(trackers);
  if (act.length < 2) return null;
  const since = isoLocal(new Date(Date.now() - 30 * 86_400_000));
  // how often each question's HARD answer came (persona walks, Nov 9 2026: a "Slept 7+" question was
  // counted by its good days)
  const byId = new Map(act.map((t) => [t.id, t]));
  const yes = new Map<string, number>();
  for (const e of entries) { const t = byId.get(e.trackerId); if (t && e.date >= since && e.value === (t.problemWhen === "yes")) yes.set(e.trackerId, (yes.get(e.trackerId) ?? 0) + 1); }
  // her own topics first (QA, Nov 8 2026: a Migraines person got "…days when you feel lonely?")
  const door = getDoorState();
  const mine = [door?.trackerId, ...(door?.extra ?? []).map((x) => x.trackerId)].map((id) => act.find((t) => t.id === id)).find((t) => !!t && (yes.get(t.id) ?? 0) > 0);
  if (mine) return mine;
  const top = act.filter((t) => (yes.get(t.id) ?? 0) > 0)
    .sort((a, b) => (yes.get(b.id) ?? 0) - (yes.get(a.id) ?? 0)).slice(0, 3);
  if (top.length > 0) return top[Math.floor(Date.now() / 86_400_000) % top.length];
  return act.find((t) => t.id === door?.trackerId) ?? act.find((t) => t.problemWhen === "yes") ?? act[0];
};

export type Suspect = { kind: "tracked"; tracker: Tracker } | { kind: "template"; template: LifeStreamTemplate };

/** Suspects for a question: related ones she already answers first, then
 *  related ones she could add. A question of her own gets her other
 *  questions as suspects. */
export const suspectsFor = (target: Tracker, trackers: Tracker[]): Suspect[] => {
  const act = live(trackers).filter((t) => t.id !== target.id);
  const tid = matchTemplateIdByTitle(target.title);
  if (!tid) return act.slice(0, 5).map((tracker) => ({ kind: "tracked" as const, tracker }));
  const byTemplate = new Map(act.map((t) => [matchTemplateIdByTitle(t.title), t]));
  // what may lead to THIS question, in its own order (content review, Nov 9 2026: lists mixed in
  // questions that only follow it, e.g. a short night as a suspect for itself)
  const tpls = getTemplatesByIds(getSuspectTemplateIds(tid)).filter((tpl) => !tpl.sensitive && tpl.id !== tid);
  const tracked = tpls.filter((tpl) => byTemplate.has(tpl.id)).map((tpl) => ({ kind: "tracked" as const, tracker: byTemplate.get(tpl.id)! }));
  const fresh = tpls.filter((tpl) => !byTemplate.has(tpl.id)).map((template) => ({ kind: "template" as const, template }));
  return [...tracked.slice(0, 3), ...fresh].slice(0, 6);
};

export interface HunchResult {
  /** target on days with the suspect: k of n; without: k0 of n0 */
  k: number; n: number; k0: number; n0: number;
  nextDay: boolean;
  /** enough days to say */
  ready: boolean;
  /** clearly more often with the suspect */
  onto: boolean;
}

/** How the target went on days with the suspect and without, since the
 *  hunch (same day, or the next day if that shows more). */
export const hunchResult = (h: Hunch, trackers: Tracker[], entries: TrackerEntry[]): HunchResult | null => {
  const target = trackers.find((t) => t.id === h.target);
  if (!target) return null;
  const hit = target.problemWhen === "yes";
  // the suspect by its HARD side too: her guess "short night" is a "no" to "Slept 7+" (persona walk,
  // Nov 9 2026: the app compared 7+ hour nights and said her short-night hunch was confirmed)
  const sus = trackers.find((t) => t.id === h.suspect);
  const sHit = sus ? sus.problemWhen === "yes" : true;
  const s = new Map<string, boolean>();
  const tg = new Map<string, boolean>();
  for (const e of entries) {
    if (e.date < h.made) continue;
    if (e.trackerId === h.suspect && typeof e.value === "boolean") s.set(e.date, e.value === sHit);
    if (e.trackerId === h.target) tg.set(e.date, e.value === hit);
  }
  const next = (d: string) => {
    const x = new Date(d + "T12:00:00");
    x.setDate(x.getDate() + 1);
    return isoLocal(x);
  };
  const count = (shift: boolean) => {
    let k = 0, n = 0, k0 = 0, n0 = 0;
    for (const [d, sv] of s) {
      const t = tg.get(shift ? next(d) : d);
      if (t === undefined) continue;
      if (sv) { n++; if (t) k++; } else { n0++; if (t) k0++; }
    }
    return { k, n, k0, n0 };
  };
  const same = count(false);
  const nd = count(true);
  const gap = (c: { k: number; n: number; k0: number; n0: number }) => (c.n ? c.k / c.n : 0) - (c.n0 ? c.k0 / c.n0 : 0);
  const useNext = gap(nd) > gap(same) + 0.1;
  const c = useNext ? nd : same;
  const ready = c.n + c.n0 >= HUNCH_DAYS && c.n >= 2 && c.n0 >= 2;
  return { ...c, nextDay: useNext, ready, onto: ready && c.k >= 3 && gap(c) >= 0.25 };
};

/** Hunches whose results are ready and not yet seen, about one question
 *  (the first that has any), so they're shown together. */
export const readyHunches = (trackers: Tracker[], entries: TrackerEntry[]): { hunch: Hunch; result: HunchResult }[] => {
  const ready: { hunch: Hunch; result: HunchResult }[] = [];
  for (const h of getHunches()) {
    if (h.seen) continue;
    const result = hunchResult(h, trackers, entries);
    if (result?.ready) ready.push({ hunch: h, result });
  }
  return ready.filter((r) => r.hunch.target === ready[0]?.hunch.target);
};
/** A hunch whose result is ready and not yet seen. */
export const readyHunch = (trackers: Tracker[], entries: TrackerEntry[]) => readyHunches(trackers, entries)[0] ?? null;

/** Hunches still being checked: days with both answered so far. */
export const checking = (trackers: Tracker[], entries: TrackerEntry[]) =>
  getHunches().filter((h) => !h.seen).map((h) => {
    const r = hunchResult(h, trackers, entries);
    return { hunch: h, days: r ? r.n + r.n0 : 0 };
  });
