// Never suggest what her own answers say she already does (her note, Nov 10 2026: "drained" 20 days, slept well 20
// days, and MeMap says "try to sleep better" — "вы дебилы, я же отмечал, что сплю хорошо, откуда эта рекомендация?").
// A change that one of her questions measures counts as already done when that question got its good answer on most
// of her recent answers. Such a change isn't offered; a plan that is one says so on its card.
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { templateIdOf } from "@/lib/answerPhrases";
import { isoLocal } from "@/lib/doors";

/** A ready change → the library questions that measure it (their good answer = doing it). Only where the question
 *  really says the same thing ("Walk 20 minutes" ← "Did you walk a lot?"), not a looser cousin. */
export const IDEA_MEASURES: Record<string, string[]> = {
  // sleep
  bed23: ["bed-before-midnight", "slept-enough"], bed8h: ["slept-enough"], windDown30: ["bed-before-midnight", "slept-enough"],
  sameWake: ["same-wake-time"], sameSleepTimes: ["same-wake-time"], phoneAway: ["screens-before-bed"],
  noPhoneMorning: ["phone-free-morning"], chargeOutside: ["phone-free-morning"],
  // movement and light
  walk20: ["walked-a-lot", "exercised"], walkAfterLunch: ["walked-a-lot"], walkPartWay: ["walked-a-lot"], walkAfterMeals: ["walked-a-lot"],
  stretch: ["stretched"], stretchShower: ["stretched"], strength10: ["strength-training"], sweatWorkout: ["exercised"],
  outsideMorning: ["saw-daylight", "outside-30min"], morningLight: ["saw-daylight"], walkingCall: ["outside-30min"],
  // water and food
  water: ["drank-water"], waterMeals: ["drank-water"], bottleNear: ["drank-water"], bottleTwice: ["drank-water"], waterWaking: ["drank-water"],
  regularMeals: ["skipped-meal", "ate-by-2pm"], lunchBy1: ["ate-by-2pm"], breakfast2h: ["ate-by-2pm"], snackBag: ["skipped-meal"],
  dinnerEarly: ["ate-late"], noSweetsEvening: ["ate-sweets"], fruitDessert: ["ate-sweets"],
  vegOne: ["ate-vegetables"], fruitVegMeals: ["ate-vegetables"], vegNeverSkip: ["ate-vegetables"], halfPlateVeg: ["ate-vegetables"],
  cookOne: ["cooked-myself"], lunchFromHome: ["ate-fast-food"],
  // coffee
  noCoffee14: ["coffee-late"], coffeeByNoon: ["coffee-late"], decafAfternoon: ["coffee-late"], coffeeLess: ["caffeine-4-plus"], decafOne: ["caffeine-4-plus"],
  // screens and news
  socialLimit: ["social-media-hour"], newsOnce: ["doomscrolled-news"], noNewsEvening: ["doomscrolled-news"],
  // mind, people, learning
  breathe: ["meditated"], meditate5: ["meditated"], hobby20: ["hobby-time"], learn15: ["studied-language", "practiced-skill"],
  outAmongPeople: ["isolated-at-home"], pillsWithHabit: ["took-meds"],
};

const DAYS = 14;
const MIN_ANSWERS = 5;
const SHARE = 0.7;

export interface Doing { trackerId: string; k: number; n: number }

/** Her answers say she already does this change: the measuring question with its good answer on at least 70% of at
 *  least 5 answered days in the last two weeks (the best such question), else null. */
export const alreadyDoing = (idea: string | null | undefined, trackers: Tracker[], entries: TrackerEntry[], now = new Date()): Doing | null => {
  const ids = idea ? IDEA_MEASURES[idea] : undefined;
  if (!ids) return null;
  const from = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1)));
  const to = isoLocal(now);
  let best: Doing | null = null;
  for (const tr of trackers) {
    if (tr.archived || !ids.includes(templateIdOf(tr) ?? "")) continue;
    const good = tr.problemWhen !== "yes";
    const byDay = new Map<string, boolean>();
    for (const e of entries) if (e.trackerId === tr.id && e.date >= from && e.date <= to && typeof e.value === "boolean") byDay.set(e.date, e.value);
    const n = byDay.size, k = [...byDay.values()].filter((v) => v === good).length;
    if (n >= MIN_ANSWERS && k / n >= SHARE && (!best || k / n > best.k / best.n)) best = { trackerId: tr.id, k, n };
  }
  return best;
};
