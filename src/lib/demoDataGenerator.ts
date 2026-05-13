// Curated demo data generator — used for App Store screenshots /
// preview recordings / marketing assets. Four themed packs, each
// engineered to surface NON-OBVIOUS correlations that demonstrate
// what the app catches. The "alcohol + headache" obvious pair was
// the v1 demo; users already know that, so it doesn't sell the
// product. These packs reveal patterns the user wouldn't have
// noticed themselves — which is the actual value proposition.
//
// Each pack:
//   - Picks 8 curated template ids
//   - Engineers per-day entries so 4-5 STABLE patterns + 1-2
//     EMERGING + 1 FRESH (last-21-days-only) surface in Insights
//   - Includes at least one LAG-+1 or LAG--1 pattern to showcase
//     the engine's "the day after / the day before" framing
//
// Packs:
//   A — "Self-care" (parenting + boundaries) — yelling at kids
//       traces back to skipping personal time
//   B — "Quiet burnout" (work / boundaries) — saying yes when you
//       meant no cascades into evening burnout + impulse spending
//   C — "Body knows" (somatic / suppressed emotion) — suppressed
//       boundaries surface as headache the next day
//   D — "Behind the fight" (relationships) — arguments and
//       drinking are SYMPTOMS, root is loneliness + comparison +
//       bottled-up "no"s

import type { Tracker, TrackerEntry } from "@/types/tracker";
import { LIFE_STREAMS } from "./lifeStreams";
import {
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
} from "./trackerLocalize";
import { uuid } from "./uuid";

const NUM_DAYS = 60;
const FRESH_WINDOW = 21;

export type DemoPackId =
  | "self-care"
  | "burnout"
  | "body"
  | "behind-fight"
  | "showcase";

interface DemoPack {
  id: DemoPackId;
  templateIds: string[];
  // Build the engineered per-day series. Returns Map<templateId,
  // (boolean | undefined)[]> where each array is length NUM_DAYS,
  // dates[0] oldest, dates[N-1] today. `undefined` means "no entry
  // generated for this day" — used by the Showcase pack to make
  // one tracker appear as a "newcomer" with limited history, so
  // its correlations surface as 🌿 emerging (sharedDays < 15)
  // instead of 🌳 stable.
  script: () => Map<string, (boolean | undefined)[]>;
}

const buildTrackerFromTemplate = (tplId: string): Tracker | null => {
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.id === tplId) {
        return {
          id: uuid(),
          title: localizeTrackerTitleRaw(tpl.title),
          category: tpl.category,
          subcategory: tpl.subcategory,
          questionText: localizeTrackerQuestionRaw(tpl.questionText),
          answerType: tpl.answerType,
          periodDays: tpl.periodDays,
          threshold: tpl.threshold,
          problemWhen: tpl.problemWhen,
          adviceAboveThreshold: localizeTrackerAdviceRaw(tpl.adviceAboveThreshold),
          createdAt: new Date().toISOString(),
          cluster: stream.id,
        };
      }
    }
  }
  return null;
};

const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dateNDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoLocal(d);
};

const clamp01 = (v: number) => Math.max(0.02, Math.min(0.98, v));

// Bernoulli with bias. Used inline for readability inside the
// per-pack engineerScript() functions.
const r = (p: number): boolean => Math.random() < clamp01(p);

// PACK A — Self-care for parents.
// Insight: yelling at kid traces back to "I didn't take care of
// myself first". Personal time + good sleep are protective.
const packSelfCare: DemoPack = {
  id: "self-care",
  templateIds: [
    "yelled-at-kid",
    "ran-out-of-patience",
    "felt-bad-parent",
    "kept-morning-promise",   // ≈ "self-care morning routine"
    "slept-enough",
    "felt-fatigued",
    "saw-friends",
    "felt-happy",
  ],
  script: () => {
    const N = NUM_DAYS;
    const selfCare: boolean[] = [];  // kept-morning-promise
    const sawFriends: boolean[] = [];
    for (let i = 0; i < N; i++) {
      selfCare.push(r(0.45));
      sawFriends.push(r(0.32));
    }

    const slept: boolean[] = [];
    for (let i = 0; i < N; i++) slept.push(r(selfCare[i] ? 0.85 : 0.5));

    const fatigued: boolean[] = [];
    for (let i = 0; i < N; i++) fatigued.push(r(slept[i] ? 0.15 : 0.8));

    const yelled: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.08;
      if (!selfCare[i]) p += 0.55; // THE insight
      if (fatigued[i]) p += 0.15;
      yelled.push(r(p));
    }
    const ranOutPatience: boolean[] = [];
    for (let i = 0; i < N; i++) ranOutPatience.push(r(yelled[i] ? 0.85 : 0.15));
    const feltBadParent: boolean[] = [];
    for (let i = 0; i < N; i++) feltBadParent.push(r(yelled[i] ? 0.7 : 0.05));

    // Happy: boosted by self-care AND by saw-friends in last 21 days
    // only (the fresh-stage demo pair).
    const happy: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.4;
      if (selfCare[i]) p += 0.35;
      if (yelled[i]) p -= 0.3;
      if (i >= N - FRESH_WINDOW && sawFriends[i]) p += 0.45;
      happy.push(r(p));
    }

    return new Map<string, boolean[]>([
      ["yelled-at-kid", yelled],
      ["ran-out-of-patience", ranOutPatience],
      ["felt-bad-parent", feltBadParent],
      ["kept-morning-promise", selfCare],
      ["slept-enough", slept],
      ["felt-fatigued", fatigued],
      ["saw-friends", sawFriends],
      ["felt-happy", happy],
    ]);
  },
};

// PACK B — Quiet burnout (work + boundaries).
// Insight: saying yes when you meant no cascades into evening
// burnout + next-day impulse spending. Recognition + creative
// work are the antidote.
const packBurnout: DemoPack = {
  id: "burnout",
  templateIds: [
    "said-yes-when-meant-no",
    "burned-out-after-work",
    "compared-on-social",
    "felt-useless",
    "impulse-spending",
    "got-recognition",
    "did-creative-work",
    "felt-fulfilled-at-work",
  ],
  script: () => {
    const N = NUM_DAYS;
    const saidYes: boolean[] = [];
    const compared: boolean[] = [];
    const gotRecognition: boolean[] = [];
    const didCreative: boolean[] = [];
    for (let i = 0; i < N; i++) {
      saidYes.push(r(0.3));
      compared.push(r(0.32));
      gotRecognition.push(r(0.22));
      didCreative.push(r(0.42));
    }

    const burnedOut: boolean[] = [];
    for (let i = 0; i < N; i++) burnedOut.push(r(saidYes[i] ? 0.8 : 0.2));

    const feltUseless: boolean[] = [];
    for (let i = 0; i < N; i++) feltUseless.push(r(compared[i] ? 0.78 : 0.12));

    // Lag +1: yesterday's burnout → today's impulse spending.
    const impulse: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.12;
      if (i > 0 && burnedOut[i - 1]) p += 0.55;
      impulse.push(r(p));
    }

    // Fulfilled boosted by recognition, plus by creative-work in the
    // recent window only (the fresh-stage pair).
    const fulfilled: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.3;
      if (gotRecognition[i]) p += 0.55;
      if (i >= N - FRESH_WINDOW && didCreative[i]) p += 0.5;
      fulfilled.push(r(p));
    }

    return new Map<string, boolean[]>([
      ["said-yes-when-meant-no", saidYes],
      ["burned-out-after-work", burnedOut],
      ["compared-on-social", compared],
      ["felt-useless", feltUseless],
      ["impulse-spending", impulse],
      ["got-recognition", gotRecognition],
      ["did-creative-work", didCreative],
      ["felt-fulfilled-at-work", fulfilled],
    ]);
  },
};

// PACK C — Body knows (somatic / suppressed emotion).
// Insight: suppressed "no"s show up as headache + back pain the
// next day. Anxiety + missed sunlight feed the loop.
const packBody: DemoPack = {
  id: "body",
  templateIds: [
    "headache",
    "said-yes-when-meant-no",
    "felt-anxious",
    "back-or-neck-pain",
    "ate-sweets",
    "outside-30min",
    "had-energy",
    "slept-enough",
  ],
  script: () => {
    const N = NUM_DAYS;
    const saidYes: boolean[] = [];
    const outside: boolean[] = [];
    for (let i = 0; i < N; i++) {
      saidYes.push(r(0.28));
      outside.push(r(0.5));
    }

    const slept: boolean[] = [];
    for (let i = 0; i < N; i++) slept.push(r(0.65));

    // Anxious: high baseline, less when slept well, more when
    // skipped sunlight (small effect).
    const anxious: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.3;
      if (!slept[i]) p += 0.2;
      anxious.push(r(p));
    }

    // Headache: lag +1 from suppressed "no". When saidYes yesterday,
    // 70 % headache today. Baseline 8 %.
    const headache: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.08;
      if (i > 0 && saidYes[i - 1]) p += 0.62;
      headache.push(r(p));
    }

    // Back pain: same-day boost when anxious. Suppression also
    // contributes.
    const backPain: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.12;
      if (anxious[i]) p += 0.5;
      if (saidYes[i]) p += 0.2;
      backPain.push(r(p));
    }

    // Sweets cravings: opposite of sleep + boosted by anxiety.
    const sweets: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.3;
      if (!slept[i]) p += 0.4;
      if (anxious[i]) p += 0.15;
      sweets.push(r(p));
    }

    // Energy: boosted by outside-30min, especially in last 21 days
    // (fresh pair). Tanked by no-sleep.
    const energy: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.4;
      if (slept[i]) p += 0.25;
      if (i >= N - FRESH_WINDOW && outside[i]) p += 0.45;
      energy.push(r(p));
    }

    return new Map<string, boolean[]>([
      ["headache", headache],
      ["said-yes-when-meant-no", saidYes],
      ["felt-anxious", anxious],
      ["back-or-neck-pain", backPain],
      ["ate-sweets", sweets],
      ["outside-30min", outside],
      ["had-energy", energy],
      ["slept-enough", slept],
    ]);
  },
};

// PACK D — Behind the fight (relationships).
// Insight: arguments + drinking aren't random — they trace to
// loneliness + social comparison + bottled-up "no"s. Includes
// lag --1 ("argument the day after a suppressed no") and lag +1
// ("anxiety the morning after drinking") to showcase the engine's
// lag awareness.
const packBehindFight: DemoPack = {
  id: "behind-fight",
  templateIds: [
    "argued-with-partner",
    "drank-alcohol",
    "said-yes-when-meant-no",
    "compared-on-social",
    "felt-lonely",
    "called-parent",
    "felt-anxious",
    "slept-enough",
  ],
  script: () => {
    const N = NUM_DAYS;
    const saidYes: boolean[] = [];
    const compared: boolean[] = [];
    const calledParent: boolean[] = [];
    for (let i = 0; i < N; i++) {
      saidYes.push(r(0.27));
      compared.push(r(0.3));
      calledParent.push(r(0.35));
    }

    // Lonely: high when no parent call, low when parent call.
    const lonely: boolean[] = [];
    for (let i = 0; i < N; i++) lonely.push(r(calledParent[i] ? 0.15 : 0.55));

    // Argued: lag +1 from yesterday's suppressed "no". So the engine
    // catches "argued the day after said-yes-when-meant-no".
    const argued: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.08;
      if (i > 0 && saidYes[i - 1]) p += 0.65;
      argued.push(r(p));
    }

    // Drank: lag +1 from social-compare (compared yesterday →
    // drank today). Same-day boost from loneliness.
    const drank: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.1;
      if (i > 0 && compared[i - 1]) p += 0.55;
      if (lonely[i]) p += 0.35;
      drank.push(r(p));
    }

    // Anxious: lag +1 from drinking (hangxiety — morning after).
    const anxious: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.18;
      if (i > 0 && drank[i - 1]) p += 0.6;
      anxious.push(r(p));
    }

    // Slept: hurt by argued same day, boosted by called-parent in
    // last 21 days (the fresh-stage pair — social warmth → better
    // sleep, emerging recently).
    const slept: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.65;
      if (argued[i]) p -= 0.45;
      if (i >= N - FRESH_WINDOW && calledParent[i]) p += 0.3;
      slept.push(r(p));
    }

    return new Map<string, boolean[]>([
      ["argued-with-partner", argued],
      ["drank-alcohol", drank],
      ["said-yes-when-meant-no", saidYes],
      ["compared-on-social", compared],
      ["felt-lonely", lonely],
      ["called-parent", calledParent],
      ["felt-anxious", anxious],
      ["slept-enough", slept],
    ]);
  },
};

// PACK E — Showcase. Engineered specifically for App Store screens
// where we want ALL four maturity stages visible on one Patterns
// screen:
//   🌳 Stable — full-60-days strong correlations
//   🌿 Emerging — one tracker is a "newcomer" with only the last 12
//                 days of entries, so any pair involving it has
//                 sharedDays = 12 < 15 → emerging (strict passes,
//                 maturity capped by sample size).
//   🆕 Fresh — pair that correlates ONLY in the last 21 days.
//   🌱 Early — rare-event pair: aYes = 4 fails MIN_X_OCCURRENCES,
//              so strict rejects, but concordance still passes
//              (bothYes=4 > aYesBNo+aNoBYes=0).
const packShowcase: DemoPack = {
  id: "showcase",
  templateIds: [
    "felt-anxious",
    "slept-enough",
    "exercised",
    "felt-happy",
    "outside-30min",
    "felt-fatigued",
    "heard-bad-news",
    "did-creative-work",
  ],
  script: () => {
    const N = NUM_DAYS;
    // Two latent axes: bad day + active day. Each tracker derives
    // from these so the resulting correlations are clean and
    // predictable.
    const badDay: boolean[] = [];
    const exercised: boolean[] = [];
    const outside: boolean[] = [];
    for (let i = 0; i < N; i++) {
      badDay.push(r(0.35));
      exercised.push(r(0.45));
      outside.push(r(0.45));
    }

    // Rare event: heard-bad-news fires on exactly 4 fixed days
    // spaced across the window. aYes = 4 < MIN_X_OCCURRENCES (5),
    // so strict will reject any pair involving this tracker. But
    // each event day forces anxious → concordance passes → 🌱 early.
    const heardBadNewsDays = new Set([7, 22, 38, 51]);
    const heardBadNews: boolean[] = [];
    for (let i = 0; i < N; i++) heardBadNews.push(heardBadNewsDays.has(i));

    // Anxious: high on badDay, forced on heard-bad-news days.
    const anxious: boolean[] = [];
    for (let i = 0; i < N; i++) {
      if (heardBadNews[i]) {
        anxious.push(true);
        continue;
      }
      let p = 0.18;
      if (badDay[i]) p += 0.55;
      anxious.push(r(p));
    }

    // Slept-enough: anti-correlated with anxious + badDay.
    const slept: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.7;
      if (anxious[i]) p -= 0.45;
      if (badDay[i]) p -= 0.15;
      slept.push(r(p));
    }

    // Fatigued: opposite of slept.
    const fatigued: boolean[] = [];
    for (let i = 0; i < N; i++) fatigued.push(r(slept[i] ? 0.15 : 0.75));

    // Happy: boosted by exercise. In the LAST 21 days only, also
    // boosted by outside — that's the 🆕 fresh pair (full history
    // wouldn't surface it; the recent-window pass will).
    const happy: boolean[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0.4;
      if (exercised[i]) p += 0.45;
      if (badDay[i]) p -= 0.3;
      if (i >= N - FRESH_WINDOW && outside[i]) p += 0.4;
      happy.push(r(p));
    }

    // 🌿 EMERGING tracker: did-creative-work has entries ONLY for
    // the last 12 days. Any pair involving it has sharedDays = 12,
    // so even a strong correlation lands as emerging (strict
    // passes, but sample < 15). Strongly correlates with happy in
    // those 12 days.
    const creativeStart = N - 12;
    const didCreative: (boolean | undefined)[] = [];
    for (let i = 0; i < N; i++) {
      if (i < creativeStart) {
        didCreative.push(undefined);
      } else {
        // Heavily correlate with happy in the 12-day window
        didCreative.push(happy[i] ? r(0.85) : r(0.15));
      }
    }

    return new Map<string, (boolean | undefined)[]>([
      ["felt-anxious", anxious],
      ["slept-enough", slept],
      ["exercised", exercised],
      ["felt-happy", happy],
      ["outside-30min", outside],
      ["felt-fatigued", fatigued],
      ["heard-bad-news", heardBadNews],
      ["did-creative-work", didCreative],
    ]);
  },
};

const PACKS: Record<DemoPackId, DemoPack> = {
  "self-care": packSelfCare,
  burnout: packBurnout,
  body: packBody,
  "behind-fight": packBehindFight,
  showcase: packShowcase,
};

export const DEMO_PACK_IDS: DemoPackId[] = [
  "showcase",       // first — it's the "all features visible" one
  "self-care",
  "burnout",
  "body",
  "behind-fight",
];

export interface DemoDataResult {
  newTrackers: Tracker[];
  newEntries: TrackerEntry[];
  trackerCount: number;
  daysCount: number;
  generatedCount: number;
  pack: DemoPackId;
}

/**
 * Build the demo state for the chosen pack. REPLACES the entire
 * trackers + entries payload — callers should pass the result
 * straight to saveTrackers + saveEntries. Existing data is wiped.
 */
export const generateDemoData = (packId: DemoPackId): DemoDataResult => {
  const pack = PACKS[packId];
  if (!pack) {
    throw new Error(`Unknown demo pack: ${packId}`);
  }

  const trackers: Tracker[] = [];
  const idToTracker = new Map<string, Tracker>();
  for (const tplId of pack.templateIds) {
    const t = buildTrackerFromTemplate(tplId);
    if (!t) continue;
    trackers.push(t);
    idToTracker.set(tplId, t);
  }

  // dates[0] = oldest, dates[N-1] = today.
  const dates: string[] = [];
  for (let i = NUM_DAYS - 1; i >= 0; i--) dates.push(dateNDaysAgo(i));
  const oldestDate = dates[0];

  const script = pack.script();
  const entries: TrackerEntry[] = [];
  for (const tplId of pack.templateIds) {
    const tracker = idToTracker.get(tplId);
    const series = script.get(tplId);
    if (!tracker || !series) continue;
    for (let i = 0; i < NUM_DAYS; i++) {
      const v = series[i];
      // `undefined` means "newcomer tracker — no entry generated
      // for this day". Used by the Showcase pack so one tracker
      // has only the last 12 days of data → its correlations
      // surface as 🌿 emerging.
      if (v === undefined) continue;
      entries.push({
        id: uuid(),
        trackerId: tracker.id,
        date: dates[i],
        value: v,
      });
    }
  }

  const newTrackers = trackers.map((t, idx) => ({
    ...t,
    cycleStartDate: oldestDate,
    sortIndex: idx,
  }));

  return {
    newTrackers,
    newEntries: entries,
    trackerCount: newTrackers.length,
    daysCount: NUM_DAYS,
    generatedCount: entries.length,
    pack: packId,
  };
};
