import { useMemo, useState, useEffect } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card } from "@/components/ui/card";
import { getCategoryColor } from "@/lib/categoryHelpers";
import { Lightbulb, LineChart as LineChartIcon, AlertTriangle, Sparkles, Info, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  computeCorrelations,
  isHighlySignificant,
  lookupShortLabel,
  trackerPolarity,
  correlationFrame,
} from "@/lib/correlations";
import { markCorrelationSeen } from "@/lib/appRating";
import { track } from "@/lib/analytics";

// Smart ratio formatter — converts 3.0× style to "3 раза" / "3 times"
// natural language. Russian needs раз / раза agreement (1 раз, 2-4
// раза, 5+ раз, 11-14 раз, decimals always раза). Rounding rules:
//   ≥1.75 → round to integer (1.75-2.4 → 2, 2.5-3.4 → 3, etc.)
//   1.0-1.74 → "1.5" (any sub-2 ratio above the visibility threshold
//                      is dramatic enough to read as "one and a half")
//   ≥9.5 → round to integer (cap floor irrelevant)
const formatRatioDisplay = (ratio: number, isRu: boolean): string => {
  const r = ratio >= 1 ? ratio : 1 / ratio;
  let intVal: number | null = null;
  let displayNum: string;
  if (r >= 1.75) {
    intVal = Math.round(r);
    displayNum = String(intVal);
  } else {
    displayNum = isRu ? "1,5" : "1.5";
  }
  if (!isRu) return `${displayNum} times`;
  // Russian раз/раза agreement
  let word = "раза";
  if (intVal !== null) {
    const m100 = intVal % 100;
    const m10 = intVal % 10;
    if (m100 >= 11 && m100 <= 14) word = "раз";
    else if (m10 === 1) word = "раз";
    else if (m10 >= 2 && m10 <= 4) word = "раза";
    else word = "раз";
  }
  return `в ${displayNum} ${word}`;
};

const capitalizeFirst = (s: string): string =>
  s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;

interface CorrelationInsightsProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** Tap a correlation card → jump to Trends tab pre-filtered on the pair. */
  onSelectPair?: (ids: [string, string]) => void;
}

export const CorrelationInsights = ({ trackers, entries, onSelectPair }: CorrelationInsightsProps) => {
  const { t, i18n } = useTranslation();
  const isRu = (i18n.language || "en").startsWith("ru");
  // "How we compute connections" modal — opened from the (i) icon
  // next to the section heading. Explains the math in plain language
  // and carries the disclaimer (correlations ≠ causation, this is a
  // conversation starter not a diagnosis).
  const [explainerOpen, setExplainerOpen] = useState(false);
  // Per-card expand state for the "facts" detail block. Conclusion
  // is shown up-top as the headline read; facts (% of days etc.)
  // hide behind a "Подробнее" toggle so the card scans cleanly.
  // Keyed by correlation index (re-built each render — fine for 5
  // items max).
  const [expandedFacts, setExpandedFacts] = useState<Record<number, boolean>>({});

  const correlations = useMemo(
    () => computeCorrelations(trackers, entries, 5),
    [trackers, entries],
  );

  // Once the user has seen at least one real correlation, record it
  // as a "value moment" — this is one of the gates for the App Store
  // rating prompt. Also emit analytics so we can answer "what % of
  // active users ever see a correlation?". Both no-op repeatedly —
  // the marker is localStorage-gated; the analytics track() is fine
  // to call multiple times (Mixpanel will record one per session).
  useEffect(() => {
    if (correlations.length > 0) {
      markCorrelationSeen();
      track("correlation_viewed", { count: correlations.length });
    }
  }, [correlations.length]);

  if (correlations.length === 0) {
    return (
      <Card className="card-premium breathing-space animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{t("correlations.title")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("correlations.empty")}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-premium breathing-space animate-fade-in">
      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-medium text-sm tracking-wide uppercase text-muted-foreground">
                {t("correlations.heading")}
              </h3>
              <button
                type="button"
                onClick={() => setExplainerOpen(true)}
                className="p-0.5 rounded-full hover:bg-muted/50 transition-colors"
                aria-label={t("correlations.explainerOpen")}
              >
                <Info className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              </button>
            </div>
            {/* Inline disclaimer right under the heading. Short — full
                version lives in the (i) modal. The point is to make
                sure even users who never tap the icon see at a glance
                that these are co-occurrences, not diagnoses. */}
            <p className="text-[11px] text-muted-foreground/90 mt-1 leading-snug">
              {t("correlations.miniDisclaimer")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {correlations.map((c, idx) => {
            const colorA = getCategoryColor(c.trackerA.category);
            const colorB = getCategoryColor(c.trackerB.category);
            const aTitle = localizeTrackerTitle(c.trackerA.title);
            const bTitle = localizeTrackerTitle(c.trackerB.title);

            const interactive = !!onSelectPair;
            const handleTap = () => {
              if (onSelectPair) onSelectPair([c.trackerA.id, c.trackerB.id]);
            };

            // EARLY-stage card — observation without correlation claim.
            // Same visual container as emerging/stable (bg-muted/20 +
            // border-border/50), so the section feels homogenous. The
            // only differentiator is the stage badge (🌱 vs 🌿 vs 🌳).
            // Earlier version used a lighter bg + category-coloured
            // text — user feedback: cards looked ghostly and were hard
            // to read against the wallpaper bg.
            //
            // Three elements: the pair (foreground text, readable),
            // dots + co-occurrence count, stage badge + shared-days
            // counter. No conclusion line — we genuinely don't have
            // enough data to claim a pattern.
            if (c.stage === "early") {
              const dotCount = Math.min(c.counts.bothYes, 5);
              return (
                <div
                  key={idx}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={interactive ? handleTap : undefined}
                  onKeyDown={
                    interactive
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleTap();
                          }
                        }
                      : undefined
                  }
                  className={
                    "p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5 transition-all" +
                    (interactive
                      ? " cursor-pointer hover:bg-muted/30 hover:border-border active:scale-[0.99]"
                      : "")
                  }
                >
                  {/* Pair header — foreground colour (full contrast),
                      readable in any theme. Category info is conveyed
                      via the dot colour below, not the title. */}
                  <h4 className="font-semibold text-sm leading-snug text-foreground">
                    <span>{aTitle}</span>
                    <span className="text-muted-foreground/70 mx-1.5">·</span>
                    <span>{bTitle}</span>
                  </h4>

                  {/* Dots + count of shared yes-yes days. Dots use
                      tracker-A category colour as a subtle hue cue;
                      capped at 5 visually, exact count in text. */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: dotCount }).map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: `hsl(var(--${colorA}))` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("correlations.earlyObservation", { count: c.counts.bothYes })}
                    </span>
                  </div>

                  {/* Stage badge + shared-days counter. Same row + same
                      sizes as the badge row on emerging/stable cards
                      to keep visual rhythm. */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerging/20 text-emerging"
                      title={t("correlations.stageEarlyHint")}
                    >
                      🌱 {t("correlations.stageEarly")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("correlations.sharedDays", { count: c.sharedDays })}
                    </span>
                  </div>
                </div>
              );
            }

            // Polarity-aware framing. We pick a frame based on:
            //   - polarity of A and B (good/bad/neutral, derived
            //     from problemWhen and the neutral-template list)
            //   - sign of phi (positive = together, negative = apart)
            // Frame drives the HEADLINE wording. The conclusion line
            // below stays the same regardless (just shows ratio
            // direction). For pairs where either tracker is neutral
            // OR shortLabel metadata is missing, headline falls back
            // to the safe generic "Возможная связь".
            const labelA = lookupShortLabel(c.trackerA.title);
            const labelB = lookupShortLabel(c.trackerB.title);
            const polA = trackerPolarity(c.trackerA);
            const polB = trackerPolarity(c.trackerB);
            const frame = correlationFrame(polA, polB, c.phi);
            const haveBothLabels = labelA && labelB;

            // Pick the frame-specific headline key, OR fall back to
            // the generic label when we can't write a confident
            // semantic frame.
            let headline: string | null = null;
            if (haveBothLabels && frame !== "fallback") {
              const aLabel = capitalizeFirst(isRu ? labelA.ru : labelA.en);
              const bLabel = isRu ? labelB.ru : labelB.en;
              const key =
                frame === "co-presence"
                  ? "correlations.headlineCoPresence"
                  : frame === "opposite"
                    ? "correlations.headlineOpposite"
                    : "correlations.headlineUnexpected";
              headline = t(key, { a: aLabel, b: bLabel });
            } else if (haveBothLabels) {
              headline = t("correlations.headlinePossibleLink");
            }

            const aYes = c.counts.bothYes + c.counts.aYesBNo;       // total days A=yes
            const aNo = c.counts.aNoBYes + c.counts.bothNo;          // total days A=no
            const bYesGivenAYes = c.counts.bothYes;                  // out of aYes
            const bYesGivenANo = c.counts.aNoBYes;                   // out of aNo
            const pctWithA = aYes > 0 ? Math.round((bYesGivenAYes / aYes) * 100) : 0;
            const pctWithoutA = aNo > 0 ? Math.round((bYesGivenANo / aNo) * 100) : 0;

            const positive = c.phi > 0;
            // "Strong" pattern label requires BOTH strong phi AND a
            // strengthLbl (mild/moderate/strong) was the old visible
            // label. Replaced by c.stage (early/emerging/stable) which
            // takes sample size into account too. Kept the robust ✓
            // marker — chi² < 0.01 within an already-confirmed pattern
            // still means something.
            const robust = isHighlySignificant(c.chiSquare);
            const ratioStr = formatRatioDisplay(c.riskRatio, isRu);

            // Pick the conclusion line.
            //
            // Extreme cases (0% or 100% prevalence in one group) → use
            // natural-language variants. The previous code piped 0 /
            // Infinity into formatRatioDisplay which rendered "Infinity"
            // in the UI (the "Infinity раз реже" bug). For wide gaps
            // (Δ ≥ 40 percentage points) we also prefer the natural
            // form over "N times more/less", which gets clunky at
            // extreme values.
            //
            // Order matters — more specific cases first.
            let conclusionKey: string;
            const conclusionParams: Record<string, string> = {
              a: aTitle,
              b: bTitle,
            };
            const gap = pctWithA - pctWithoutA; // positive → B more with A

            if (pctWithA === 0 && pctWithoutA >= 30) {
              conclusionKey = "correlations.naturalBNeverWithA";
            } else if (pctWithoutA === 0 && pctWithA >= 30) {
              conclusionKey = "correlations.naturalBOnlyWithA";
            } else if (pctWithA === 100 && pctWithoutA <= 70) {
              conclusionKey = "correlations.naturalBAlwaysWithA";
            } else if (positive && gap >= 40) {
              conclusionKey = "correlations.naturalBMoreOftenWithA";
            } else if (!positive && gap <= -40) {
              conclusionKey = "correlations.naturalBLessOftenWithA";
            } else {
              // Mid-gap ratios — keep the "in N times" wording which
              // gives a magnitude sense humans can compare.
              conclusionKey = positive
                ? "correlations.timesMore"
                : "correlations.timesLess";
              conclusionParams.ratio = ratioStr;
            }

            // Lag → human label
            const lagLabel =
              c.lag === 0
                ? t("correlations.lagSameDay")
                : c.lag === 1
                  ? t("correlations.lagAPredictsB")
                  : t("correlations.lagBPredictsA");

            return (
              <div
                key={idx}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive ? handleTap : undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTap();
                        }
                      }
                    : undefined
                }
                className={
                  "p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5 transition-all" +
                  (interactive
                    ? " cursor-pointer hover:bg-muted/30 hover:border-border active:scale-[0.99]"
                    : "")
                }
              >
                {/* Headline — only when both trackers have curated
                    shortLabels and a confident frame. Reads as a
                    heading the user can scan in one second. */}
                {headline && (
                  <h4 className="font-semibold text-sm leading-snug">
                    {headline}
                  </h4>
                )}

                {/* CONCLUSION — the only thing always visible. The
                    user asked (1.7+) to make the conclusion the
                    main read and tuck everything else (chips, raw
                    %, co-absence note) behind a "Подробнее" toggle.
                    This is the headline read in one sentence.

                    Key + params chosen above based on extremes /
                    gap size — see conclusionKey logic. */}
                <div className="text-base font-medium leading-snug text-foreground">
                  {t(conclusionKey, conclusionParams)}
                </div>

                {/* Expandable detail — chips, raw %, optional
                    co-absence note. Collapsed by default; "Подробнее"
                    expands it; "Свернуть" collapses it back. */}
                {expandedFacts[idx] ? (
                  <div className="space-y-2 pt-1 border-t border-border/30">
                    {/* Chips inside details — show which two
                        trackers, with lag note if applicable. */}
                    <div className="flex items-center gap-1.5 text-xs flex-wrap pt-2">
                      <span
                        className="px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `hsl(var(--${colorA}) / 0.15)`,
                          color: `hsl(var(--${colorA}))`,
                        }}
                      >
                        {aTitle}
                      </span>
                      <span className="text-muted-foreground/60">·</span>
                      <span
                        className="px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `hsl(var(--${colorB}) / 0.15)`,
                          color: `hsl(var(--${colorB}))`,
                        }}
                      >
                        {bTitle}
                      </span>
                      {c.lag !== 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          · {lagLabel}
                        </span>
                      )}
                    </div>
                    {/* Symmetric percentage facts. The user can see
                        49% vs 16% directly — no need for a separate
                        "absence" note since the contrast tells the
                        story. */}
                    <div className="text-sm leading-snug space-y-1 text-muted-foreground tabular-nums">
                      <div>
                        {t("correlations.factWith", {
                          a: aTitle,
                          b: bTitle,
                          n: bYesGivenAYes,
                          total: aYes,
                          percent: pctWithA,
                        })}
                      </div>
                      <div>
                        {t("correlations.factWithout", {
                          a: aTitle,
                          b: bTitle,
                          n: bYesGivenANo,
                          total: aNo,
                          percent: pctWithoutA,
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedFacts((prev) => ({ ...prev, [idx]: false }));
                      }}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("correlations.hideDetails")}
                      <ChevronDown className="h-3 w-3 rotate-180 transition-transform" strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFacts((prev) => ({ ...prev, [idx]: true }));
                    }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("correlations.showDetails")}
                    <ChevronDown className="h-3 w-3 transition-transform" strokeWidth={2} />
                  </button>
                )}

                {/* Bottom row: strength + sample size + open Trends */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Stage badge — replaces the older mild/moderate/
                        strong label. "Заметная связь" for emerging,
                        "Устойчивый паттерн" for stable. The robust ✓
                        marker stays — it signals chi² < 0.01 within
                        an already-confirmed pattern. */}
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        c.stage === "stable"
                          ? "bg-balanced/20 text-balanced"
                          : "bg-emerging/20 text-emerging"
                      }`}
                    >
                      {c.stage === "stable" ? "🌳" : "🌿"}
                      {" "}
                      {t(c.stage === "stable" ? "correlations.stageStable" : "correlations.stageEmerging")}
                      {robust && " ✓"}
                    </span>
                    {/* Semantic verdict — only shown when we have an
                        actual judgment. For "unknown" pairs (at least
                        one custom user-typed tracker) we show NO
                        badge; we honestly don't know whether the
                        pair is expected or coincidence, so we let
                        the data speak for itself. */}
                    {c.semanticVerdict === "expected" && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-primary/10 text-primary">
                        <Sparkles className="h-2.5 w-2.5" />
                        {t("correlations.expected")}
                      </span>
                    )}
                    {c.semanticVerdict === "unexpected" && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-500/10"
                        style={{ color: "hsl(35 90% 45%)" }}
                        title={t("correlations.unexpectedHint")}
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {t("correlations.unexpected")}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t("correlations.sharedDays", { count: c.sharedDays })}
                    </span>
                  </div>
                  {interactive && (
                    <span className="flex items-center gap-1 text-[10px] text-primary font-medium shrink-0">
                      <LineChartIcon className="h-3 w-3" strokeWidth={2} />
                      {t("correlations.viewInTrends")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explainer modal — opened from the (i) icon next to the
          heading. Holds the long-form explanation and the disclaimer
          (correlation ≠ causation, talk to doctor not us). Body uses
          plain Russian/English, no statistical jargon — only mentions
          chi-square in passing as "тест значимости". */}
      <Dialog open={explainerOpen} onOpenChange={setExplainerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("correlations.explainerTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("correlations.explainerTitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-foreground/85">
            <p>{t("correlations.explainerBody1")}</p>
            <p>{t("correlations.explainerBody2")}</p>
            <div className="rounded-xl bg-muted/40 border border-border/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.25} />
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  {t("correlations.disclaimerHeading")}
                </p>
              </div>
              <p className="text-xs leading-relaxed">{t("correlations.disclaimerBody")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
