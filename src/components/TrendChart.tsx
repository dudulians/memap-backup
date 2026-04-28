import { useState, useMemo } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
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

// Each tracker gets its own horizontal lane (0.9 at top → 0.1 at bottom)
const laneY = (index: number, total: number): number => {
  if (total === 1) return 0.5;
  return 0.9 - (index / (total - 1)) * 0.8;
};

export const TrendChart = ({ trackers, entries }: TrendChartProps) => {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>("30d");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Heavy compute: bucket/dot rebuild on every input change. Wrapping in
  // useMemo means we only re-run when entries / range / filters / trackers
  // actually change — not on every render (legend hover, tooltip move, etc.).
  // Inside, we also build an O(1) lookup Map for entries instead of doing
  // entries.find() per cell (was O(M·N): days × trackers × entries).
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Map of `${trackerId}:${YYYY-MM-DD}` → entry. Built once per memo.
    const entryMap = new Map<string, TrackerEntry>();
    for (const e of entries) {
      entryMap.set(`${e.trackerId}:${e.date}`, e);
    }

    if (isAggregated) {
      // Aggregated: each point = one bucket (week or month). Count of
      // significant days per tracker in that bucket.
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
    }

    // Dot mode (7d): significant day → lane position, null otherwise.
    const data: Record<string, any>[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en", { weekday: "short", day: "numeric" });
      const point: Record<string, any> = { date: label };

      visibleTrackers.forEach((tracker, idx) => {
        const entry = entryMap.get(`${tracker.id}:${dateStr}`);
        if (entry) {
          const sig = tracker.problemWhen === "yes" ? entry.value : !entry.value;
          point[tracker.id] = sig ? laneY(idx, visibleTrackers.length) : null;
        } else {
          point[tracker.id] = null;
        }
      });
      data.push(point);
    }
    return data;
  }, [isAggregated, days, bucket, range, entries, activeTrackers, visibleTrackers]);

  const toggleTracker = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Y axis for dot mode
  const dotTicks = visibleTrackers.map((_, i) => laneY(i, visibleTrackers.length));
  const dotTickFormatter = (v: number) => {
    const idx = visibleTrackers.findIndex(
      (_, i) => Math.abs(laneY(i, visibleTrackers.length) - v) < 0.02
    );
    return idx >= 0 ? localizeTrackerTitle(visibleTrackers[idx].title).slice(0, 2) : "";
  };

  // Y axis for aggregated mode
  const yMax = bucket; // 7 for weekly, 30 for monthly
  const countTicks = [0, Math.round(yMax / 2), yMax];

  const tooltipUnit = range === "1y" ? "days this month" : "days this week";

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

        {/* Chart */}
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
                interval={isAggregated ? "preserveStartEnd" : 0}
              />
              <YAxis
                tick={{ fontSize: isAggregated ? 10 : 13 }}
                tickLine={false}
                axisLine={false}
                domain={isAggregated ? [0, yMax] : [0, 1]}
                ticks={isAggregated ? countTicks : dotTicks}
                tickFormatter={
                  isAggregated ? (v) => `${v}d` : dotTickFormatter
                }
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
                formatter={(value: any, name: string) => {
                  const tracker = activeTrackers.find((t) => t.id === name);
                  if (!tracker || value === null) return [null, null];
                  if (isAggregated && value === 0) return [null, null];
                  const label = localizeTrackerTitle(tracker.title);
                  return isAggregated
                    ? [`${value}d`, label]
                    : ["✓", label];
                }}
                filterNull
              />
              {visibleTrackers.map((tracker) => {
                const color = colorFor(tracker);
                return isAggregated ? (
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
                ) : (
                  <Line
                    key={tracker.id}
                    type="linear"
                    dataKey={tracker.id}
                    stroke="none"
                    strokeWidth={0}
                    dot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                    activeDot={{ r: 7, fill: color, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false}
                    name={tracker.id}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          {isAggregated
            ? range === "1y"
              ? t("trendChart.footerAggYear")
              : t("trendChart.footerAggWeek")
            : t("trendChart.footerDots")}
        </p>
      </div>
    </Card>
  );
};
