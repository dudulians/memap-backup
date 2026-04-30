import { useMemo } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card } from "@/components/ui/card";
import { getCategoryColor } from "@/lib/categoryHelpers";
import { Lightbulb, ArrowRight, LineChart as LineChartIcon, AlertTriangle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import {
  computeCorrelations,
  phiStrengthLabel,
  isHighlySignificant,
} from "@/lib/correlations";

interface CorrelationInsightsProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** Tap a correlation card → jump to Trends tab pre-filtered on the pair. */
  onSelectPair?: (ids: [string, string]) => void;
}

export const CorrelationInsights = ({ trackers, entries, onSelectPair }: CorrelationInsightsProps) => {
  const { t, i18n } = useTranslation();
  const isRu = (i18n.language || "en").startsWith("ru");

  const correlations = useMemo(
    () => computeCorrelations(trackers, entries, 5),
    [trackers, entries],
  );

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
            const aTitle = localizeTrackerTitle(c.trackerA.title);
            const bTitle = localizeTrackerTitle(c.trackerB.title);

            const aYes = c.counts.bothYes + c.counts.aYesBNo;       // total days A=yes
            const aNo = c.counts.aNoBYes + c.counts.bothNo;          // total days A=no
            const bYesGivenAYes = c.counts.bothYes;                  // out of aYes
            const bYesGivenANo = c.counts.aNoBYes;                   // out of aNo

            const positive = c.phi > 0;
            const strengthLbl = phiStrengthLabel(c.phi);
            const robust = isHighlySignificant(c.chiSquare);

            // Risk-ratio framing: when ratio > 1, B is more likely
            // when A=yes; when < 1, less likely. Pick the bigger-than-1
            // direction for cleaner phrasing ("X times more likely")
            // regardless of which way phi happens to be signed.
            const ratio = c.riskRatio;
            const ratioForDisplay = ratio >= 1 ? ratio : 1 / ratio;
            const ratioStr = ratioForDisplay >= 10
              ? `${Math.round(ratioForDisplay)}`
              : ratioForDisplay.toFixed(1);

            // Lag → human label
            const lagLabel =
              c.lag === 0
                ? t("correlations.lagSameDay")
                : c.lag === 1
                  ? t("correlations.lagAPredictsB")
                  : t("correlations.lagBPredictsA");

            const interactive = !!onSelectPair;
            const handleTap = () => {
              if (onSelectPair) onSelectPair([c.trackerA.id, c.trackerB.id]);
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
                  "p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5 transition-all" +
                  (interactive
                    ? " cursor-pointer hover:bg-muted/30 hover:border-border active:scale-[0.99]"
                    : "")
                }
              >
                {/* Tracker pair + lag arrow */}
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `hsl(var(--${colorA}) / 0.15)`,
                      color: `hsl(var(--${colorA}))`,
                    }}
                  >
                    {aTitle}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
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

                {/* Raw evidence — the heart of the new design. Show
                    actual day counts so the user judges the pattern,
                    not an abstract score. */}
                <div className="text-xs leading-relaxed space-y-1 text-foreground/80 tabular-nums">
                  <div>
                    {t("correlations.factWith", {
                      a: aTitle,
                      bYes: bYesGivenAYes,
                      total: aYes,
                      bTitle: bTitle.toLowerCase(),
                    })}
                  </div>
                  <div className="text-muted-foreground">
                    {t("correlations.factWithout", {
                      a: aTitle.toLowerCase(),
                      bYes: bYesGivenANo,
                      total: aNo,
                      bTitle: bTitle.toLowerCase(),
                    })}
                  </div>
                  <div className="font-medium pt-0.5" style={{ color: "hsl(var(--strong))" }}>
                    {positive
                      ? t("correlations.timesMore", { ratio: ratioStr })
                      : t("correlations.timesLess", { ratio: ratioStr })}
                  </div>
                </div>

                {/* Bottom row: strength + sample size + open Trends */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        positive
                          ? "bg-balanced/20 text-balanced"
                          : "bg-strong/20 text-strong"
                      }`}
                    >
                      {t(`correlations.${strengthLbl}`)}
                      {robust && " ✓"}
                    </span>
                    {!c.isExpected && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-500/10"
                        style={{ color: "hsl(35 90% 45%)" }}
                        title={t("correlations.unexpectedHint")}
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {t("correlations.unexpected")}
                      </span>
                    )}
                    {c.isExpected && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-primary/10 text-primary">
                        <Sparkles className="h-2.5 w-2.5" />
                        {t("correlations.expected")}
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
    </Card>
  );
};
