// "Worth watching" (her note, Nov 8 2026: "давай добавим какие-то советы или статьи… что мы думаем
// будет полезно понаблюдать"): one short tip a day on the path, about a question from the library
// she doesn't ask yet, about one she does ask (TIP_ABOUT), and a button that adds the question. (Its source was shown under it until Nov 10 2026; now
// it stays in observeTipsData.ts for checks only.)
import { Tracker } from "@/types/tracker";
import { findTemplate, isoLocal } from "@/lib/doors";
import { templateIdOf } from "@/lib/answerPhrases";
import { OBSERVE_TIPS } from "@/lib/observeTipsData";
import { MINIMAL_MEDICINE, QUIET_TIPS } from "@/lib/medicalArchive";

export interface ObserveTip {
  id: string;
  templateId: string;
  en: { title: string; line: string };
  ru: { title: string; line: string };
  /** where it comes from: kept for checks, not shown in the app (her content audit, Nov 10 2026) */
  source: { name: string; url: string };
  /** how the tip was checked; "held" = not shown until a directly relevant source is found */
  review?: {
    status: "rewritten" | "needs-source-check" | "held"; limits?: string; date?: string;
    /** the source check (Nov 10 2026): does it resolve and support the copy, and what limits it */
    source?: "VERIFIED" | "PARTIAL" | "MISMATCH" | "UNVERIFIED"; sourceNote?: string;
  };
}
/** held for its source, or about an illness or a medicine while "minimum medicine" is on (medicalArchive.ts) */
const shown = (x: ObserveTip) => x.review?.status !== "held" && !(MINIMAL_MEDICINE && QUIET_TIPS.has(x.templateId));

const KEY = "memap_observe_tip";
/** `for`: her question (tracker id) the tip is about */
interface TipState { day: string; id: string; done?: "added" | "later"; used: string[]; for?: string }
const read = (): TipState | null => {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); return s && typeof s.day === "string" ? { used: [], ...s } : null; } catch { return null; }
};
const write = (s: TipState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* the tip just shows again */ } };

/**
 * What each tip's own words are about: the questions of hers it is for (her note, Nov 10 2026: a
 * late-coffee tip "потому что это может affect sleep" — "у меня что, есть вопрос про сон?"). Until then
 * a tip came by island (Body & habits holds coffee, water and sport alike) and, with no match, the first
 * tip in the list came anyway. The cause graph (relatedQuestions.ts) is not enough on its own: it ties late
 * coffee to the stomach too, while this tip talks about sleep. No question of hers here = no tip that day.
 */
const SLEEP = ["slept-enough", "woke-at-night", "felt-recovered", "bed-before-midnight", "slow-to-fall-asleep", "woke-too-early", "sleep-aid"];
const MOOD = ["felt-happy", "felt-depressed", "felt-calm", "calm-day", "felt-angry", "cried-today"];
const HEAD = ["headache", "migraine", "headache-stopped-me"];
const KIDS = ["felt-overwhelmed-parenting", "ran-out-of-patience", "yelled-at-kid"];
export const TIP_ABOUT: Record<string, string[]> = {
  "coffee-late": SLEEP,
  "same-wake-time": SLEEP,
  "racing-thoughts-in-bed": SLEEP,
  "saw-daylight": SLEEP,
  "slept-enough": [...MOOD, "had-energy", "felt-fatigued"], // sleep and how you feel the next day
  "hobby-time": MOOD,
  "time-in-nature": MOOD,
  "felt-grateful": MOOD,
  "drank-water": [...HEAD, "felt-fatigued", "had-energy"], // tiredness and headaches
  "felt-fatigued": [...SLEEP, "felt-stressed", "had-energy"], // sleep and stress can bring tiredness
  "napped": SLEEP,
  "drank-alcohol": SLEEP,
  "caffeine-4-plus": ["felt-anxious", "panic-attack", "felt-calm"],
  "skipped-meal": HEAD,
  "ate-late": ["heartburn"],
  "walked-a-lot": ["exercised", "outside-30min"],
  "exercised": [...MOOD, "had-energy"],
  "trained-hard": [...SLEEP, "exercised"],
  "screens-before-bed": SLEEP,
  "social-media-hour": [...MOOD, "felt-lonely", "felt-anxious"],
  "doomscrolled-news": [...MOOD, "felt-anxious"],
  "felt-stressed": [...MOOD, "felt-anxious", "had-energy", "felt-fatigued"], // a hard day and the day after
  "many-interruptions": ["felt-stressed", "main-thing-done", "focus-hour", "felt-angry", "calm-day"],
  "burned-out-after-work": [...KIDS, "snapped-at-loved-ones", "didnt-want-to-work", "worked-overtime"],
  "meditated": ["felt-stressed", "felt-calm", "calm-day", "felt-anxious"],
  "saw-friends": ["felt-lonely", "isolated-at-home"],
  "deep-conversation": ["felt-lonely", "felt-lonely-with-partner", "felt-close-to-partner"],
  "argued-with-partner": ["felt-close-to-partner", "partner-irritated-me", "felt-lonely-with-partner", "good-time-together"],
  "got-help-with-kids": [...KIDS, "time-for-myself"],
  "took-painkiller": HEAD,
  "neck-pain": HEAD,
  "period-day": HEAD,
  "stomach-issues": ["felt-stressed"],
  "smoked": ["smoked-hookah"], // nicotine and sleep: not for someone who doesn't smoke
  "procrastinated": ["main-thing-done", "focus-hour", "didnt-want-to-work", "felt-useless"],
  "less-caffeine-than-usual": [...HEAD, "felt-fatigued", "had-energy"],
};

const reasonsFor = (mine: Tracker[]) => {
  const ids = new Map<string, string>(); // her template id → her tracker id
  for (const t of mine) { const id = templateIdOf(t); if (id && !ids.has(id)) ids.set(id, t.id); }
  const out = new Map<string, { trackerId: string; rank: number }>();
  for (const [tip, about] of Object.entries(TIP_ABOUT)) {
    const rank = about.findIndex((q) => ids.has(q));
    if (rank >= 0) out.set(tip, { trackerId: ids.get(about[rank])!, rank });
  }
  return out;
};

/** Today's tip and whether it was looked at: the same one all day, never about a question she asks,
 *  always about one she does. */
export const tipForToday = (trackers: Tracker[], today = isoLocal(new Date())): { tip: ObserveTip; done: boolean } | null => {
  const mine = trackers.filter((t) => !t.archived);
  const asked = new Set(mine.map(templateIdOf).filter(Boolean) as string[]);
  const reasons = reasonsFor(mine);
  const s = read();
  const byId = (id: string) => OBSERVE_TIPS.find((x) => x.id === id);
  if (s?.day === today) {
    const tip = byId(s.id);
    if (tip && shown(tip) && (s.done || (!asked.has(tip.templateId) && reasons.has(tip.templateId)))) return { tip, done: !!s.done };
  }
  const used = new Set(s?.used ?? []);
  // the period tip only for someone who already watches a cycle
  const cycle = mine.some((t) => /period|cycle|pms|месячн|цикл|пмс/i.test(t.title));
  // in the list's order (sleep first), each one once before any comes again
  const fits = OBSERVE_TIPS
    .filter((x) => shown(x) && !asked.has(x.templateId) && reasons.has(x.templateId) && findTemplate(x.templateId) && (x.templateId !== "period-day" || cycle));
  if (fits.length === 0) return null;
  const fresh = fits.filter((x) => !used.has(x.id));
  const pool = fresh.length > 0 ? fresh : fits;
  const tip = pool[0];
  write({ day: today, id: tip.id, used: fresh.length > 0 ? [...used] : [], for: reasons.get(tip.templateId)!.trackerId });
  return { tip, done: false };
};

/** Her question today's tip is about (tracker id), for "Because you watch". */
export const tipFor = (tipId: string): string | null => {
  const s = read();
  return s && s.id === tipId ? s.for ?? null : null;
};

/** She read today's tip: added its question, or "not now". */
export const markTip = (id: string, done: "added" | "later") => {
  const s = read();
  const used = new Set(s?.used ?? []); used.add(id);
  write({ day: isoLocal(new Date()), id, done, used: [...used], for: s?.id === id ? s.for : undefined });
  window.dispatchEvent(new Event("memap-settings-changed"));
};
