// Correlation engine — replaces the naive phi-only approach with a
// statistically defensible one. Five upgrades from the original:
//   1. Chi-square significance test (p < 0.05) — reject random noise.
//   2. Adaptive minimum sample size by phi strength — small samples
//      need bigger effects to be trusted.
//   3. Lag analysis — also checks "A on day N predicts B on day N+1"
//      and the reverse, picks the strongest significant lag.
//   4. Semantic flag — `isExpected` true if the pair is in our curated
//      RELATED_QUESTIONS knowledge graph; false flags it as
//      "watch out, might be coincidence" in the UI.
//   5. Raw counts + risk ratio — the result carries the actual numbers
//      ("12 days with X, 9 had Y; 18 without X, 2 had Y") so the UI
//      can show evidence instead of an abstract score.
//
// All math is done locally over the user's stored entries — no
// external service, no analytics, no data leaves the device.

import { Tracker, TrackerEntry } from "@/types/tracker";
import { RELATED_QUESTIONS, matchTemplateIdByTitle } from "./relatedQuestions";
import { LIFE_STREAMS } from "./lifeStreams";

// Look up a tracker title against the curated library and return its
// shortLabel (RU + EN forms) if the matched template has metadata.
// Used by the Correlation Insights UI to render natural-language
// headlines like "Алкоголь и головная боль: возможная связь" instead
// of the safe but stiff fallback "При «X»: «Y»...". Top-15 templates
// are annotated by hand (see lifeStreams.ts shortLabel field).
export interface TrackerInsightLabel {
  /** Lowercase noun phrase, EN. e.g. "alcohol", "headaches". */
  en: string;
  /** Lowercase noun phrase, RU. e.g. "алкоголь", "головная боль". */
  ru: string;
}
export const lookupShortLabel = (
  trackerTitle: string,
): TrackerInsightLabel | null => {
  const id = matchTemplateIdByTitle(trackerTitle);
  if (!id) return null;
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.id === id) {
        if (tpl.shortLabel && tpl.shortLabelRu) {
          return { en: tpl.shortLabel, ru: tpl.shortLabelRu };
        }
        return null;
      }
    }
  }
  return null;
};

// Whether either tracker in a pair is a sensitive template (intimacy,
// libido, ex). Used to hide correlations involving sensitive
// templates unless the user has opted in via Settings → "Show
// sensitive topics" (writes localStorage memap_show_sensitive=true).
const isSensitiveTrackerTitle = (trackerTitle: string): boolean => {
  const id = matchTemplateIdByTitle(trackerTitle);
  if (!id) return false;
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.id === id) return tpl.sensitive === true;
    }
  }
  return false;
};

const userOptedIntoSensitive = (): boolean => {
  try {
    return localStorage.getItem("memap_show_sensitive") === "true";
  } catch {
    return false;
  }
};

// ─── Polarity-aware framing helpers ─────────────────────────────────
//
// Each tracker has a semantic polarity — what does "Yes" actually
// mean for the user's wellbeing?
//   "good"    — Yes is the desired state (slept enough, exercised,
//               felt happy). problemWhen === "no" because it's a
//               PROBLEM when the user answered No.
//   "bad"     — Yes is the unwanted event (headache, argued, drank
//               alcohol). problemWhen === "yes".
//   "neutral" — Yes is just a thought or aspiration, neither good
//               nor bad: "wanted a child", "thought about emigrating",
//               "missed an ex". These have problemWhen === "yes" too
//               (the THRESHOLD signal is "this thought repeats often")
//               but they're not negative events. Listed by template id
//               below so the framing engine doesn't accidentally write
//               "Wanted a child × Joy: bad-bad pattern" — that would
//               be tone-deaf.
//
// Polarity drives WHICH headline template to pick (e.g. "they go
// together" vs "X may reduce Y" vs "unexpected pattern"). When
// polarity can't be confidently assigned we fall back to the safe
// generic "Possible connection" headline.
const NEUTRAL_TEMPLATE_IDS = new Set<string>([
  "wanted-child",
  "thought-about-emigrating",
  "wanted-leave-job",
  "thought-divorce",
  "wanted-life-change",
  "wanted-pet",
  "wanted-learn-new",
  "thought-career-change",
  "thought-about-someone-else",
  "missed-ex",
  "thought-about-going-back",
  "thought-third-country",
]);

export type TrackerPolarity = "good" | "bad" | "neutral";

export const trackerPolarity = (tracker: Tracker): TrackerPolarity => {
  const id = matchTemplateIdByTitle(tracker.title);
  if (id && NEUTRAL_TEMPLATE_IDS.has(id)) return "neutral";
  // problemWhen is the structural truth: a problem is signalled when
  // the user answered Yes (-> "bad") or No (-> "good").
  return tracker.problemWhen === "yes" ? "bad" : "good";
};

// Frame type derived from (polarity A, polarity B, phi sign). Drives
// which headline copy the UI uses. Five buckets total — kept tight so
// a single string per language stays readable for each.
//   "co-presence"  — same polarity + positive phi: both move together
//                     (sleep & joy go together; alcohol & headache
//                     show up on the same days).
//   "opposite"     — different polarity (one good, one bad) + negative
//                     phi: protective / disruptor pattern (exercise
//                     on days with less anxiety; arguments on days
//                     without joy).
//   "unexpected"   — anything else where both polarities are non-
//                     neutral but the phi direction goes against
//                     intuition. Framed with curiosity, not certainty.
//   "fallback"     — at least one tracker is neutral, or no metadata,
//                     so we don't claim a semantic interpretation.
export type CorrelationFrame =
  | "co-presence"
  | "opposite"
  | "unexpected"
  | "fallback";

export const correlationFrame = (
  polA: TrackerPolarity,
  polB: TrackerPolarity,
  phi: number,
): CorrelationFrame => {
  if (polA === "neutral" || polB === "neutral") return "fallback";
  const samePolarity = polA === polB;
  if (phi > 0 && samePolarity) return "co-presence";
  if (phi < 0 && !samePolarity) return "opposite";
  return "unexpected";
};

export type Lag = -1 | 0 | 1;

export interface CorrelationResult {
  trackerA: Tracker;
  trackerB: Tracker;
  /** Lag: 0 = same day, +1 = A predicts B's value the next day,
   *  -1 = B's value yesterday correlates with A today. */
  lag: Lag;
  /** Phi coefficient, signed. Positive = A and B move together; negative = inverse. */
  phi: number;
  /** Chi-square statistic with Yates' continuity correction. */
  chiSquare: number;
  /** Number of (lag-aligned) day pairs where both were answered. */
  sharedDays: number;
  /** Risk ratio: P(B=yes | A=yes) / P(B=yes | A=no). >1 means B is more
   *  likely when A is yes. Used for the "X times more likely" UI text. */
  riskRatio: number;
  /** Semantic verdict on the pair:
   *  - "expected"   — pair is in our curated RELATED_QUESTIONS graph,
   *                   correlation is the kind we'd actually predict.
   *  - "unexpected" — both trackers are recognised templates but the
   *                   pair is NOT in the graph — likely coincidence.
   *  - "unknown"    — at least one tracker is genuinely custom and
   *                   we can't make a judgment. UI hides the badge. */
  semanticVerdict: "expected" | "unexpected" | "unknown";
  /** Raw 2x2 counts for the UI to display "9/12 days had X" framing. */
  counts: {
    bothYes: number; // A=yes, B=yes
    aYesBNo: number; // A=yes, B=no
    aNoBYes: number; // A=no,  B=yes
    bothNo: number;  // A=no,  B=no
  };
  /** Maturity stage of this observation (1.7.3+):
   *  - "early"    — preliminary co-occurrence noticed (≥3 bothYes days),
   *                 but data too thin to claim a real pattern. UI shows
   *                 dots + "we noticed this" framing, NO claim.
   *  - "emerging" — passes statistical filters, 7-14 shared days. UI
   *                 shows the standard conclusion + a "notable link" label.
   *  - "stable"   — passes filters AND ≥15 shared days. UI shows the full
   *                 card with expandable facts + "stable pattern" label.
   *  Lets us include "we see something forming" observations without
   *  promising a confirmed pattern. */
  stage: "early" | "emerging" | "stable";
}

// Chi-square critical values for 1 degree of freedom:
//   p = 0.05  → χ² ≥ 3.841
//   p = 0.01  → χ² ≥ 6.635
// We use 3.841 as the significance threshold ("p < 0.05") and label
// stronger results as "highly significant" in the UI.
const CHI2_P05 = 3.841;
const CHI2_P01 = 6.635;

/**
 * Adaptive minimum |phi| — small samples need bigger effects to be
 * worth showing. Numbers calibrated against simulation: at the listed
 * sample size, |phi| values BELOW the threshold occur > 5 % of the
 * time by random chance even when no real correlation exists.
 */
const minPhiForSample = (n: number): number => {
  if (n < 7) return Infinity; // too little data to claim anything
  if (n < 15) return 0.55;
  if (n < 30) return 0.4;
  if (n < 60) return 0.3;
  return 0.25;
};

/** Build a date → tracker_id → boolean lookup. */
const buildDateMap = (entries: TrackerEntry[]): Map<string, Map<string, boolean>> => {
  const map = new Map<string, Map<string, boolean>>();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, new Map());
    map.get(e.date)!.set(e.trackerId, e.value);
  }
  return map;
};

/** Add `days` days to a YYYY-MM-DD string (local-date math, no UTC drift). */
const shiftDate = (yyyymmdd: string, days: number): string => {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

/** Pearson's chi-square statistic with Yates' continuity correction
 *  for a 2×2 contingency table. */
const yatesChiSquare = (
  n11: number,
  n10: number,
  n01: number,
  n00: number,
): number => {
  const n = n11 + n10 + n01 + n00;
  if (n === 0) return 0;
  const rowA = n11 + n10;
  const rowB = n01 + n00;
  const colA = n11 + n01;
  const colB = n10 + n00;
  if (rowA === 0 || rowB === 0 || colA === 0 || colB === 0) return 0;
  const numerator = Math.pow(Math.abs(n11 * n00 - n10 * n01) - n / 2, 2) * n;
  const denom = rowA * rowB * colA * colB;
  return numerator / denom;
};

/** Phi coefficient (signed) for a 2×2 table. Same sign convention as
 *  Pearson r: positive when both yes/no align, negative when they
 *  oppose. */
const phiCoefficient = (
  n11: number,
  n10: number,
  n01: number,
  n00: number,
): number => {
  const rowA = n11 + n10;
  const rowB = n01 + n00;
  const colA = n11 + n01;
  const colB = n10 + n00;
  const denom = Math.sqrt(rowA * rowB * colA * colB);
  if (denom === 0) return 0;
  return (n11 * n00 - n10 * n01) / denom;
};

/** Risk ratio: P(B=yes | A=yes) / P(B=yes | A=no).
 *  >1 → B is more likely with A; <1 → less likely. */
const riskRatio = (n11: number, n10: number, n01: number, n00: number): number => {
  const probBGivenA = n11 + n10 > 0 ? n11 / (n11 + n10) : 0;
  const probBGivenNotA = n01 + n00 > 0 ? n01 / (n01 + n00) : 0;
  if (probBGivenNotA === 0) {
    // Avoid divide-by-zero. Conventionally use a small floor or report
    // Infinity; we'll report a large but finite ratio so the UI doesn't
    // break, plus a flag could be added later.
    return probBGivenA > 0 ? 99 : 1;
  }
  return probBGivenA / probBGivenNotA;
};

interface PairStats {
  lag: Lag;
  sharedDays: number;
  phi: number;
  chiSquare: number;
  riskRatio: number;
  counts: CorrelationResult["counts"];
}

/** For one tracker pair (a, b) and one lag, walk the shared dates and
 *  compute the 2×2 stats. */
const computePairLag = (
  a: Tracker,
  b: Tracker,
  lag: Lag,
  dateMap: Map<string, Map<string, boolean>>,
): PairStats | null => {
  let n11 = 0, n10 = 0, n01 = 0, n00 = 0;
  let shared = 0;

  for (const [date, perTracker] of dateMap) {
    const aVal = perTracker.get(a.id);
    if (aVal === undefined) continue;
    // For lag = +1 we pair A on `date` with B on `date+1`.
    // For lag = 0 same-day. For lag = -1 with B on day before.
    const bDate = lag === 0 ? date : shiftDate(date, lag);
    const bMap = dateMap.get(bDate);
    if (!bMap) continue;
    const bVal = bMap.get(b.id);
    if (bVal === undefined) continue;

    shared++;
    if (aVal && bVal) n11++;
    else if (aVal && !bVal) n10++;
    else if (!aVal && bVal) n01++;
    else n00++;
  }

  if (shared < 7) return null;
  return {
    lag,
    sharedDays: shared,
    phi: phiCoefficient(n11, n10, n01, n00),
    chiSquare: yatesChiSquare(n11, n10, n01, n00),
    riskRatio: riskRatio(n11, n10, n01, n00),
    counts: { bothYes: n11, aYesBNo: n10, aNoBYes: n01, bothNo: n00 },
  };
};

// Cluster id for a given template id — walks LIFE_STREAMS once.
// Used by the semantic verdict to upgrade "unknown" to "expected"
// when a custom tracker's saved cluster matches the library
// template's cluster.
const clusterIdForTemplateId = (tplId: string): string | null => {
  for (const stream of LIFE_STREAMS) {
    if (stream.templates.some((t) => t.id === tplId)) return stream.id;
  }
  return null;
};

/** Three-way verdict on the (a, b) pair semantics:
 *  - "expected"   in two cases:
 *      (a) both trackers map to template ids AND the pair (either
 *          direction) is in RELATED_QUESTIONS;
 *      (b) one is library-matched and the other is custom but
 *          carries a `cluster` field equal to the library tracker's
 *          cluster — softer signal but useful (1.7+).
 *  - "unexpected" if both trackers map to template ids BUT the pair
 *                 is not in the graph — likely coincidence.
 *  - "unknown"    fallback when we can't determine semantically. */
const pairSemanticVerdict = (
  a: Tracker,
  b: Tracker,
  phi: number,
): "expected" | "unexpected" | "unknown" => {
  // POLARITY CHECK FIRST (1.7.3+).
  //
  // Earlier version only checked the curated RELATED_QUESTIONS graph,
  // which flagged "good thing × bad thing inverse correlation" as
  // "unexpected" if the specific pair wasn't in the graph. But that's
  // the most expected relationship in the world: a good event and a
  // bad event SHOULD inversely correlate.
  //
  // New rule: if both trackers have non-neutral polarity, check
  // whether the observed phi sign matches what polarity logic
  // predicts:
  //   same polarity (pos×pos OR neg×neg) → positive phi expected
  //   opposite polarity (pos×neg)        → negative phi expected
  // Sign-match → "expected" regardless of graph membership.
  // Sign-mismatch → flow through to the graph for a second opinion.
  const polA = trackerPolarity(a);
  const polB = trackerPolarity(b);
  if (polA !== "neutral" && polB !== "neutral") {
    const samePolarity = polA === polB;
    const expectedPhiPositive = samePolarity;
    const observedPhiPositive = phi > 0;
    if (expectedPhiPositive === observedPhiPositive) {
      return "expected";
    }
    // Sign mismatch — could still be a real curated unexpected pair,
    // fall through to graph check.
  }

  const idA = matchTemplateIdByTitle(a.title);
  const idB = matchTemplateIdByTitle(b.title);

  // Both library-matched — use the curated graph as authoritative.
  if (idA && idB) {
    const aRelated = RELATED_QUESTIONS[idA] ?? [];
    if (aRelated.includes(idB)) return "expected";
    const bRelated = RELATED_QUESTIONS[idB] ?? [];
    if (bRelated.includes(idA)) return "expected";
    return "unexpected";
  }

  // Mixed pair: one library-matched, one custom-with-cluster. If
  // the custom tracker's cluster matches the library template's
  // cluster, that's an "expected" pair semantically — they belong
  // to the same theme. Custom user typed e.g. "Шумит сосед сверху"
  // and tagged the Theme as "Внешние события" → noisy-neighbors
  // template lives in the same cluster → expected pair.
  const libId = idA ?? idB;
  const customTracker = idA ? b : a;
  if (libId && customTracker.cluster) {
    const libCluster = clusterIdForTemplateId(libId);
    if (libCluster && libCluster === customTracker.cluster) {
      return "expected";
    }
  }

  return "unknown";
};

/**
 * Top-level: walk all active tracker pairs, compute stats at three
 * lags, return only correlations that are STATISTICALLY significant
 * (chi² > 3.84, |phi| above sample-adjusted threshold). Returns at
 * most `topN` results, sorted by absolute phi descending.
 */
export const computeCorrelations = (
  trackers: Tracker[],
  entries: TrackerEntry[],
  topN: number = 5,
): CorrelationResult[] => {
  const active = trackers.filter((t) => !t.archived);
  if (active.length < 2) return [];

  const dateMap = buildDateMap(entries);
  const out: CorrelationResult[] = [];

  // Sensitive opt-in flag — read once per call. When false (default),
  // pairs that include a sensitive template (intimacy/libido/ex) are
  // suppressed from the insights view. User can opt in via Settings.
  const includeSensitive = userOptedIntoSensitive();

  // Minimum-occurrence guards. Without these, a "0/2 vs 5/58" pair
  // could pass chi-square + phi but be a meaningless statistical
  // accident on top of rare events. We require:
  //   - both A=Yes AND A=No to have happened ≥ 5 times each
  //   - B=Yes (the outcome we're connecting to) ≥ 3 times total
  // GPT-suggested values, calibrated for our 30-90 day windows.
  const MIN_X_OCCURRENCES = 5;
  const MIN_Y_OCCURRENCES = 3;

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      // Sensitive gate. If either tracker is a sensitive template
      // and the user hasn't opted in, skip the pair entirely — even
      // the headline with sensitive titles would be intrusive on
      // the main Patterns surface.
      if (
        !includeSensitive &&
        (isSensitiveTrackerTitle(a.title) || isSensitiveTrackerTitle(b.title))
      ) {
        continue;
      }

      // Try all three lags. Pick the strongest *significant* one for
      // this pair — we only show one direction per pair to keep the UI
      // tight.
      // Two-pass collection (1.7.3+):
      //   - STRICT candidates pass full stats filter → become "emerging"
      //     (or "stable" later, based on sharedDays).
      //   - EARLY candidates only need ≥3 co-occurrence days. They never
      //     become "emerging" / "stable" — UI shows them as observations
      //     without a correlation claim.
      // We collect both, pick best lag for each tier separately, prefer
      // the strict one if available.
      const strictCandidates: PairStats[] = [];
      const earlyCandidates: PairStats[] = [];
      // Early-tier gate (tightened in 1.7.3 after user feedback that
      // pairs like "headache × stomach 5 days out of 59" surfaced as
      // early patterns even when those 5 co-occurrences were
      // essentially random chance):
      //   - bothYes ≥ 5    (was 3 — 3 felt like coincidence, not a
      //                     trend, even to non-statistical users)
      //   - sharedDays ≥ 7 (was 3 — need at least a week of overlap)
      //   - lift ≥ 1.5     (observed co-occurrences must be at least
      //                     1.5× what independence would predict)
      const MIN_EARLY_BOTH_YES = 5;
      const MIN_EARLY_SHARED = 7;
      const MIN_EARLY_LIFT = 1.5;

      for (const lag of [0, 1, -1] as Lag[]) {
        const stat = computePairLag(a, b, lag, dateMap);
        if (!stat) continue;

        // Strict filter — emerging / stable tier
        const aYes = stat.counts.bothYes + stat.counts.aYesBNo;
        const aNo = stat.counts.aNoBYes + stat.counts.bothNo;
        const bYes = stat.counts.bothYes + stat.counts.aNoBYes;
        const passesStrict =
          stat.chiSquare >= CHI2_P05 &&
          Math.abs(stat.phi) >= minPhiForSample(stat.sharedDays) &&
          aYes >= MIN_X_OCCURRENCES &&
          aNo >= MIN_X_OCCURRENCES &&
          bYes >= MIN_Y_OCCURRENCES;

        if (passesStrict) {
          strictCandidates.push(stat);
        } else {
          // Early observation gate. Lift = observed / expected, where
          // expected = aYes × bYes / sharedDays under the null
          // hypothesis of independence. Lift ≥ 1.5 means the pair
          // co-occurs at least 50 % more often than chance would
          // predict — enough signal to surface, not yet enough to
          // claim "correlation".
          const expectedBothYes =
            stat.sharedDays > 0 ? (aYes * bYes) / stat.sharedDays : 0;
          const lift =
            expectedBothYes > 0
              ? stat.counts.bothYes / expectedBothYes
              : stat.counts.bothYes > 0
              ? Infinity
              : 0;
          if (
            stat.counts.bothYes >= MIN_EARLY_BOTH_YES &&
            stat.sharedDays >= MIN_EARLY_SHARED &&
            lift >= MIN_EARLY_LIFT
          ) {
            earlyCandidates.push(stat);
          }
        }
      }

      if (strictCandidates.length === 0 && earlyCandidates.length === 0) continue;

      // Pick best lag from whichever tier is available, preferring strict.
      const usingStrict = strictCandidates.length > 0;
      const candidates = usingStrict ? strictCandidates : earlyCandidates;
      candidates.sort((x, y) => {
        const px = Math.abs(x.phi) + (x.lag === 0 ? 0.01 : 0);
        const py = Math.abs(y.phi) + (y.lag === 0 ? 0.01 : 0);
        return py - px;
      });
      const best = candidates[0];

      // Stage assignment:
      //   strict + ≥15 shared days → stable
      //   strict + <15 shared days → emerging
      //   otherwise (early tier)   → early
      const stage: "early" | "emerging" | "stable" = usingStrict
        ? best.sharedDays >= 15
          ? "stable"
          : "emerging"
        : "early";

      out.push({
        trackerA: a,
        trackerB: b,
        lag: best.lag,
        phi: best.phi,
        chiSquare: best.chiSquare,
        sharedDays: best.sharedDays,
        riskRatio: best.riskRatio,
        semanticVerdict: pairSemanticVerdict(a, b, best.phi),
        counts: best.counts,
        stage,
      });
    }
  }

  // Sort: stable first, emerging next, early last. Within each tier,
  // sort by absolute phi with semantic-verdict tiebreaker (same logic
  // as before for the strict tier; early tier sorts by bothYes count
  // since phi may be noisy on tiny samples).
  const stageRank = (s: "early" | "emerging" | "stable") =>
    s === "stable" ? 0 : s === "emerging" ? 1 : 2;
  out.sort((x, y) => {
    const rankDiff = stageRank(x.stage) - stageRank(y.stage);
    if (rankDiff !== 0) return rankDiff;
    if (x.stage === "early") {
      return y.counts.bothYes - x.counts.bothYes;
    }
    const bumpX = x.semanticVerdict === "expected" ? 0.02 : x.semanticVerdict === "unexpected" ? -0.02 : 0;
    const bumpY = y.semanticVerdict === "expected" ? 0.02 : y.semanticVerdict === "unexpected" ? -0.02 : 0;
    return Math.abs(y.phi) + bumpY - (Math.abs(x.phi) + bumpX);
  });
  return out.slice(0, topN);
};

/** Strength label for the UI: weak / moderate / strong. */
export const phiStrengthLabel = (phi: number): "mild" | "moderate" | "strong" => {
  const a = Math.abs(phi);
  if (a >= 0.5) return "strong";
  if (a >= 0.35) return "moderate";
  return "mild";
};

/** Highly-significant flag: chi² ≥ 6.64 → p < 0.01 → robust. */
export const isHighlySignificant = (chiSquare: number): boolean => chiSquare >= CHI2_P01;
