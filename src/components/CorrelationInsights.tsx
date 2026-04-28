import { useMemo } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card } from "@/components/ui/card";
import { getCategoryColor } from "@/lib/categoryHelpers";
import { Lightbulb, ArrowRight, LineChart as LineChartIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";

interface CorrelationInsightsProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** Tap a correlation card → jump to Trends tab pre-filtered on the pair. */
  onSelectPair?: (ids: [string, string]) => void;
}

interface Correlation {
  trackerA: Tracker;
  trackerB: Tracker;
  correlation: number;
  direction: "positive" | "negative";
  message: string;
  sharedDays: number;
}

export const CorrelationInsights = ({ trackers, entries, onSelectPair }: CorrelationInsightsProps) => {
  const { t } = useTranslation();
  const correlations = useMemo(() => {
    const activeTrackers = trackers.filter((t) => !t.archived);
    if (activeTrackers.length < 2) return [];

    // Build a map of date -> tracker answers
    const dateMap = new Map<string, Map<string, boolean>>();
    for (const entry of entries) {
      if (!dateMap.has(entry.date)) {
        dateMap.set(entry.date, new Map());
      }
      dateMap.get(entry.date)!.set(entry.trackerId, entry.value);
    }

    const results: Correlation[] = [];

    // Check all pairs
    for (let i = 0; i < activeTrackers.length; i++) {
      for (let j = i + 1; j < activeTrackers.length; j++) {
        const a = activeTrackers[i];
        const b = activeTrackers[j];

        // Find days where both were answered
        let bothYes = 0;
        let bothNo = 0;
        let aYesBNo = 0;
        let aNoBYes = 0;
        let sharedDays = 0;

        for (const [, trackerMap] of dateMap) {
          const aVal = trackerMap.get(a.id);
          const bVal = trackerMap.get(b.id);
          if (aVal === undefined || bVal === undefined) continue;

          sharedDays++;
          if (aVal && bVal) bothYes++;
          else if (!aVal && !bVal) bothNo++;
          else if (aVal && !bVal) aYesBNo++;
          else aNoBYes++;
        }

        // Need at least 7 shared days for meaningful correlation
        if (sharedDays < 7) continue;

        const agreement = (bothYes + bothNo) / sharedDays;
        const disagreement = (aYesBNo + aNoBYes) / sharedDays;

        // Simple phi coefficient approximation
        const total = sharedDays;
        const n11 = bothYes;
        const n00 = bothNo;
        const n10 = aYesBNo;
        const n01 = aNoBYes;

        const rowA = n11 + n10;
        const rowB = n01 + n00;
        const colA = n11 + n01;
        const colB = n10 + n00;

        const denom = Math.sqrt(rowA * rowB * colA * colB);
        if (denom === 0) continue;

        const phi = (n11 * n00 - n10 * n01) / denom;
        const absPhi = Math.abs(phi);

        // Only show correlations above threshold
        if (absPhi < 0.25) continue;

        const isPositive = phi > 0;

        const aTitle = localizeTrackerTitle(a.title);
        const bTitle = localizeTrackerTitle(b.title);
        let message: string;
        if (isPositive) {
          if (absPhi > 0.5) {
            message = t("correlations.posStrong", { a: aTitle, b: bTitle });
          } else {
            message = t("correlations.posMild", { a: aTitle, b: bTitle });
          }
        } else {
          if (absPhi > 0.5) {
            message = t("correlations.negStrong", { a: aTitle, b: bTitle });
          } else {
            message = t("correlations.negMild", { a: aTitle, b: bTitle });
          }
        }

        results.push({
          trackerA: a,
          trackerB: b,
          correlation: phi,
          direction: isPositive ? "positive" : "negative",
          message,
          sharedDays,
        });
      }
    }

    // Sort by strength
    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 5);
  }, [trackers, entries, t]);

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
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm tracking-wide uppercase text-muted-foreground">
              {t("correlations.heading")}
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          {correlations.map((c, idx) => {
            const colorA = getCategoryColor(c.trackerA.category);
            const colorB = getCategoryColor(c.trackerB.category);
            const strength = Math.abs(c.correlation);
            const strengthLabel =
              strength > 0.5 ? t("correlations.strong") : strength > 0.35 ? t("correlations.moderate") : t("correlations.mild");

            const interactive = !!onSelectPair;
            // Tap → tell parent to switch to Trends with this pair
            // pre-selected. Whole card is tappable for a generous touch
            // target (premium feel, no tiny "open" button).
            const handleTap = () => {
              if (onSelectPair) {
                onSelectPair([c.trackerA.id, c.trackerB.id]);
              }
            };
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
                  "p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-2 transition-all" +
                  (interactive
                    ? " cursor-pointer hover:bg-muted/30 hover:border-border active:scale-[0.99]"
                    : "")
                }
              >
                {/* Tracker pair visualization */}
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `hsl(var(--${colorA}) / 0.15)`,
                      color: `hsl(var(--${colorA}))`,
                    }}
                  >
                    {localizeTrackerTitle(c.trackerA.title)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `hsl(var(--${colorB}) / 0.15)`,
                      color: `hsl(var(--${colorB}))`,
                    }}
                  >
                    {localizeTrackerTitle(c.trackerB.title)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {c.message}
                </p>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      c.direction === "positive"
                        ? "bg-balanced/20 text-balanced"
                        : "bg-strong/20 text-strong"
                    }`}
                  >
                    {strengthLabel} {c.direction === "positive" ? "↑↑" : "↑↓"}
                  </span>
                  {interactive ? (
                    <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                      <LineChartIcon className="h-3 w-3" strokeWidth={2} />
                      {t("correlations.viewInTrends")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {t("correlations.sharedDays", { count: c.sharedDays })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
