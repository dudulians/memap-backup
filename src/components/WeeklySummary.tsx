import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Calendar, Flame, Target } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WeeklySummaryProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
}

export const WeeklySummary = ({ trackers, entries }: WeeklySummaryProps) => {
  const { t } = useTranslation();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getWeekEntries = (weeksAgo: number) => {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - weeksAgo * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    return entries.filter((e) => {
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      return d >= weekStart && d <= weekEnd;
    });
  };

  const thisWeek = getWeekEntries(0);
  const lastWeek = getWeekEntries(1);

  // Unique days tracked this week
  const thisWeekDays = new Set(thisWeek.map((e) => e.date)).size;
  const lastWeekDays = new Set(lastWeek.map((e) => e.date)).size;

  // Significant days this week
  const thisWeekSignificant = thisWeek.filter((e) => {
    const tracker = trackers.find((t) => t.id === e.trackerId);
    if (!tracker) return false;
    return tracker.problemWhen === "yes" ? e.value : !e.value;
  }).length;

  // Streak: consecutive days with any entry up to today
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (entries.some((e) => e.date === dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  // Completion rate: answered / (active trackers * 7)
  const activeTrackers = trackers.filter((t) => !t.archived);
  const maxAnswers = activeTrackers.length * 7;
  const completionRate = maxAnswers > 0 ? Math.round((thisWeek.length / maxAnswers) * 100) : 0;

  const daysTrend = thisWeekDays - lastWeekDays;

  const TrendIcon = daysTrend > 0 ? TrendingUp : daysTrend < 0 ? TrendingDown : Minus;
  const trendColor =
    daysTrend > 0
      ? "text-balanced"
      : daysTrend < 0
      ? "text-strong"
      : "text-muted-foreground";

  return (
    <Card className="card-premium breathing-space animate-fade-in overflow-hidden">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm tracking-wide uppercase text-muted-foreground">
            {t("weekly.thisWeek")}
          </h3>
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>
              {t("weekly.vsLastWeek", { diff: daysTrend > 0 ? `+${daysTrend}` : daysTrend })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-2xl bg-muted/30">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{thisWeekDays}</p>
            <p className="text-[10px] text-muted-foreground">{t("weekly.daysActive")}</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-muted/30">
            <Flame className="h-4 w-4 mx-auto mb-1 text-connections" />
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-[10px] text-muted-foreground">{t("weekly.dayStreak")}</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-muted/30">
            <Target className="h-4 w-4 mx-auto mb-1 text-health" />
            <p className="text-2xl font-bold">{completionRate}%</p>
            <p className="text-[10px] text-muted-foreground">{t("weekly.completion")}</p>
          </div>
        </div>

        {thisWeekSignificant > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {t("weekly.significantAnswers", { count: thisWeekSignificant })}
          </p>
        )}
      </div>
    </Card>
  );
};
