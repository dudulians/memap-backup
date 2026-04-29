import { useState, useMemo, useEffect } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface TrendChartProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /**
   * When set, force-select these tracker IDs and pin range to 30d.
   * Used by the Connections tab → tap-a-pair → jump-to-trends flow.
   * Re-applies on every reference change so re-tapping the same pair
   * works even after the user manually fiddled with filters.
   */
  prefilterIds?: string[];
}

type TimeRange = "7d" | "30d" | "90d" | "1y";

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

// Distinct palette — assigned per tracker ID (not category) so no two lines look the same
const PALETTE = [
  "#a78bfa", // violet
  "#f87171", // red
  "#34d399", // emerald
  "#fb923c", // orange
  "#60a5fa", // blue
  "#facc15", // yellow
  "#f472b6", // pink
  "#2dd4bf", // teal
  "#818cf8", // indigo
  "#4ade80", // green
  "#e879f9", // fuchsia
  "#fbbf24", // amber
];

// 7d → dots per lane. 30d/90d → weekly bars. 1y → monthly bars.
const bucketSize = (range: TimeRange) => {
  if (range === "7d") return 1;
  if (range === "1y") return 30;
  return 7;
};

const bucketLabel = (range: TimeRange, date: Date): string => {
  if (range === "1y") return date.toLocaleDateString("en", { month: "short" });
  if (range === "7d") return date.toLocaleDateString("en", { weekday: "short", day: "numeric" });
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
};

export const TrendChart = ({ trackers, entries, prefilterIds }: TrendChartProps) => {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>("30d");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // External pre-filter (e.g. user tapped a correlation in Connections).
  // Reset selection to those IDs and pin range to 30d — short enough to
  // still see pattern shape, long enough that real co-occurrence shows.
  useEffect(() => {
    if (prefilterIds && prefilterIds.length > 0) {
      setSelectedIds(new Set(prefilterIds));
      setRange("30d");
    }
  }, [prefilterIds]);

  const days = RANGE_DAYS[range];
  const bucket = bucketSize(range);
  const isAggregated = range !== "7d";

  // Memoize derived tracker arrays so downstream useMemos (color map,
  // chart data) don't see a fresh reference on every render.
  const activeTrackers = useMemo(
    () => trackers.filter((t) => !t.archived),
    [trackers]
  );
  const visibleTrackers = useMemo(
    () =>
      selectedIds.size === 0
        ? activeTrackers
        : activeTrackers.filter((t) => selectedIds.has(t.id)),
    [activeTrackers, selectedIds]
  );

  // Sequential color assignment by stable order. Used to be a hash
  // of tracker.id which gave random palette slots — with only 3
  // trackers two could land on visually similar colours (e.g. slot
  // 0 violet + slot 8 indigo). Now slot 0 → tracker 0, slot 1 →
  // tracker 1, etc. With ≤12 trackers every line gets a unique,
  // visually distinct colour.
  const trackerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...activeTrackers].sort((a, b) => {
      const ai = a.sortIndex ?? Number.MAX_SAFE_INTEGER;
      const bi = b.sortIndex ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });
    sorted.forEach((tr, i) => {
      map.set(tr.id, PALETTE[i % PALETTE.length]);
    });
    return map;
  }, [activeTrackers]);

  const colorFor = (tracker: Tracker): string =>
    trackerColorMap.get(tracker.id) ?? PALETTE[0];

  // Index entries by `${trackerId}:${YYYY-MM-DD}` for O(1) lookup. Used by
  // both the aggregated chart (30d/90d/1y) and the strips view (7d).
  const entryMap = useMemo(() => {
    const map = new Map<string, TrackerEntry>();
    for (const e of entries) {
      map.set(`${e.trackerId}:${e.date}`, e);
    }
    return map;
  }, [entries]);

  // Aggregated chart data — each point = one bucket (week or month) with
  // the count of significant days per tracker. Only used when range !=
  // "7d" (the 7-day view uses a strips layout below, not recharts).
  // Wrapped in useMemo so legend hovers / tooltip moves don't trigger
  // rebuilds; only changes to inputs do.
  const chartData = useMemo(() => {
    if (range === "7d") return [] as Record<string, any>[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bucketCount = Math.ceil(days / bucket);
    const data: Record<string, any>[] = [];

    for (let b = bucketCount - 1; b >= 0; b--) {
      const bucketEnd = new Date(today);
      bucketEnd.setDate(today.getDate() - b * bucket);
      const bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketEnd.getDate() - bucket + 1);

      const label = bucketLabel(range, bucketEnd);
      const point: Record<string, any> = { date: label };

      for (const tracker of activeTrackers) {
        let count = 0;
        for (let d = 0; d < bucket; d++) {
          const day = new Date(bucketStart);
          day.setDate(bucketStart.getDate() + d);
          const dateStr = day.toISOString().split("T")[0];
          const entry = entryMap.get(`${tracker.id}:${dateStr}`);
          if (entry) {
            const sig = tracker.problemWhen === "yes" ? entry.value : !entry.value;
            if (sig) count++;
          }
        }
        point[tracker.id] = count;
      }
      data.push(point);
    }
    return data;
  }, [range, days, bucket, entryMap, activeTrackers]);

  // 7-day strips: list of date stamps + short weekday labels for the row
  // headers. Rebuilt only when range or entries change (entries-trigger
  // keeps it fresh if the app sits open across midnight after a save).
  const sevenDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return {
        dateStr: d.toISOString().split("T")[0],
        // 2-letter weekday is short, readable, and identical visual
        // weight regardless of locale.
        shortLabel: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
      };
    });
  }, [range, entries]);

  const toggleTracker = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Y axis ticks for aggregated mode (7 for weekly, 30 for monthly).
  const yMax = bucket;
  const countTicks = [0, Math.round(yMax / 2), yMax];

  return (
    <Card className="card-premium breathing-space animate-fade-in">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm tracking-wide uppercase text-muted-foreground">
            {t("trendChart.title")}
          </h3>
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "1y"] as TimeRange[]).map((r) => (
              <Button
                key={r}
                variant={range === r ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs rounded-full"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>

        {/* Tracker legend chips */}
        <div className="flex flex-wrap gap-2 pb-1">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-all"
            >
              {t("trendChart.showAll")}
            </button>
          )}
          {activeTrackers.map((t) => {
            const isActive = selectedIds.size === 0 || selectedIds.has(t.id);
            const color = colorFor(t);
            return (
              <button
                key={t.id}
                onClick={() => toggleTracker(t.id)}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={
                  isActive
                    ? { backgroundColor: `${color}18`, color, border: `1px solid ${color}44` }
                    : { backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #e2e8f040", opacity: 0.5 }
                }
              >
                {/* Line swatch matching chart style */}
                <span style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: isActive ? color : "#94a3b8", display: "inline-block" }} />
                  <span style={{ width: 10, height: 2, backgroundColor: isActive ? color : "#94a3b8", display: "inline-block" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: isActive ? color : "#94a3b8", display: "inline-block" }} />
                </span>
                {(() => {
                  const LIcon = getTrackerIcon(t.title, t.category);
                  return <LIcon className="h-3 w-3" strokeWidth={1.75} />;
                })()}
                <span className="truncate max-w-[80px]">{localizeTrackerTitle(t.title)}</span>
              </button>
            );
          })}
        </div>

        {/* Chart body — strips for 7d (much more readable than dots on
            lanes), recharts LineChart for aggregated 30d/90d/1y. */}
        {range === "7d" ? (
          visibleTrackers.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {t("trendChart.noTrackers")}
            </div>
          ) : (
            <div className="space-y-1.5 py-1">
              {visibleTrackers.map((tracker) => {
                const color = colorFor(tracker);
                const Icon = getTrackerIcon(tracker.title, tracker.category);
                return (
                  <div key={tracker.id} className="flex items-center gap-2">
                    {/* Row label: tracker icon + title */}
                    <div className="w-[70px] shrink-0 flex items-center gap-1.5">
                      <Icon
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                        style={{ color }}
                      />
                      <span className="text-[11px] truncate text-foreground/80">
                        {localizeTrackerTitle(tracker.title)}
                      </span>
                    </div>
                    {/* 7 day cells. Cells use the SAME semantic palette
                        as the calendar in Overview — strong (red) for
                        a significant day, balanced (green) for a
                        recorded-but-not-significant day, neutral grey
                        for a missed day. The user's read: "is this day
                        important or not?" matters more than which
                        tracker it belongs to (the tracker name + icon
                        are right next to the row already). */}
                    <div className="grid grid-cols-7 gap-1 flex-1">
                      {sevenDays.map((day) => {
                        const entry = entryMap.get(`${tracker.id}:${day.dateStr}`);
                        // Three states:
                        //   missing      → solid muted grey (no entry)
                        //   significant  → red (strong) — problem signal
                        //   not-sig.     → green (balanced) — recorded
                        //                  but not the "problem" answer
                        if (!entry) {
                          return (
                            <div
                              key={day.dateStr}
                              className="h-7 rounded-md bg-muted-foreground/15"
                            />
                          );
                        }
                        const sig =
                          tracker.problemWhen === "yes" ? entry.value : !entry.value;
                        return (
                          <div
                            key={day.dateStr}
                            className={cn(
                              "h-7 rounded-md",
                              sig ? "bg-strong/70" : "bg-balanced/70",
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Day labels row */}
              <div className="flex items-center gap-2 pt-1.5">
                <div className="w-[70px] shrink-0" />
                <div className="grid grid-cols-7 gap-1 flex-1">
                  {sevenDays.map((day) => (
                    <div
                      key={day.dateStr}
                      className="text-[10px] text-center text-muted-foreground"
                    >
                      {day.shortLabel}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, yMax]}
                  ticks={countTicks}
                  tickFormatter={(v) => `${v}d`}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    fontSize: "11px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    maxHeight: "120px",
                    overflowY: "auto",
                    padding: "6px 10px",
                  }}
                  itemStyle={{ padding: "1px 0" }}
                  wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
                  // Pin tooltip to the top of the chart (Y = 0). Without
                  // this, recharts repositions the tooltip vertically to
                  // hover near each data point — when the user pans
                  // horizontally between dates of varying values the
                  // tooltip visibly "jitters" up and down. X still
                  // tracks the cursor naturally.
                  position={{ y: 0 }}
                  // Disable the tooltip's own slide animation. It made
                  // the box feel laggy on iOS when moving fast.
                  isAnimationActive={false}
                  formatter={(value: any, name: string) => {
                    const tracker = activeTrackers.find((t) => t.id === name);
                    if (!tracker || value === null || value === 0) return [null, null];
                    return [`${value}d`, localizeTrackerTitle(tracker.title)];
                  }}
                  filterNull
                />
                {visibleTrackers.map((tracker) => {
                  const color = colorFor(tracker);
                  return (
                    <Line
                      key={tracker.id}
                      type="monotone"
                      dataKey={tracker.id}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: color }}
                      activeDot={{ r: 5, fill: color }}
                      connectNulls
                      name={tracker.id}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          {range === "7d"
            ? t("trendChart.footerStrips")
            : range === "1y"
              ? t("trendChart.footerAggYear")
              : t("trendChart.footerAggWeek")}
        </p>
      </div>
    </Card>
  );
};
