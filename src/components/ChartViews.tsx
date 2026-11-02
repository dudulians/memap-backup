// Charts without the web (her note, Nov 2 2026: "я люблю графики, но когда
// очень много вопросов, там паутина какая-то… показывались какие-то
// отдельные, где предполагаемые связи есть"). Two calm views:
//   Links         — one card per link found: just its two lines, and the
//                   link in words ("After A, B next day · 14 of 18 times");
//   Each question — one small chart per question, busiest first.
// Every line is days a week over the last 8 weeks. Tap a card for the full
// chart with only those lines (TrendChart).
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { isoLocal } from "@/lib/doors";
import { islandOf } from "@/lib/islands";
import { islandHsl } from "@/lib/islandColors";
import { TrendChart } from "@/components/TrendChart";

const WEEKS = 8;
const PAIR_B = "322 34% 58%";

/** Days a week the question "came" (yes for a hard question, no for a good one), oldest week first. */
const weekly = (tracker: Tracker, entries: TrackerEntry[]): number[] => {
  const counts = Array.from({ length: WEEKS }, () => new Set<string>());
  const hit = tracker.problemWhen === "yes";
  const today = new Date();
  const start = (w: number) => isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (w * 7 + 6)));
  const end = (w: number) => isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - w * 7));
  for (const e of entries) {
    if (e.trackerId !== tracker.id || e.value !== hit) continue;
    for (let w = 0; w < WEEKS; w++) if (e.date >= start(w) && e.date <= end(w)) counts[WEEKS - 1 - w].add(e.date);
  }
  return counts.map((s) => s.size);
};

/** A small line chart: days a week (0–7), 8 weeks. */
const Lines = ({ series, height = 74 }: { series: { color: string; values: number[] }[]; height?: number }) => {
  const W = 300, H = height, pad = 6;
  const x = (i: number) => pad + (i / (WEEKS - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / 7) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ height: H }} aria-hidden="true" preserveAspectRatio="none">
      {[0, 3.5, 7].map((v) => <line key={v} x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="hsl(var(--foreground) / 0.07)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      {series.map((s, k) => (
        <g key={k}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={`hsl(${s.color})`} strokeWidth={3}
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={x(WEEKS - 1)} cy={y(s.values[WEEKS - 1])} r={4} fill={`hsl(${s.color})`} />
        </g>
      ))}
    </svg>
  );
};

export const ChartViews = ({ trackers, entries, focusIds }: { trackers: Tracker[]; entries: TrackerEntry[]; focusIds?: string[] }) => {
  const { t } = useTranslation();
  const live = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);
  const mine = useMemo(() => (focusIds ? live.filter((tr) => focusIds.includes(tr.id)) : live), [live, focusIds]);
  const name = (id: string) => localizeTrackerTitle(live.find((x) => x.id === id)?.title ?? "");

  // Links found (on this island, if it's an island's charts), read like the map's.
  const links = useMemo(() => {
    const ids = new Set(mine.map((x) => x.id));
    return computeCorrelations(live, entries, 8)
      .filter((c) => !focusIds || ids.has(c.trackerA.id) || ids.has(c.trackerB.id))
      .map((c) => {
        const flip = c.lag === -1;
        const a = flip ? c.trackerB : c.trackerA;
        const b = flip ? c.trackerA : c.trackerB;
        const { bothYes, aYesBNo, aNoBYes } = c.counts;
        return { a, b, nextDay: c.lag !== 0, k: bothYes, n: flip ? bothYes + aNoBYes : bothYes + aYesBNo };
      })
      .filter((l) => l.k >= 3 && l.k / Math.max(1, l.n) >= 0.3)
      .slice(0, 5);
  }, [live, mine, entries, focusIds]);

  // Each question, busiest first; only ones with answers.
  const singles = useMemo(() => mine
    .map((tr) => ({ tr, values: weekly(tr, entries), answered: entries.some((e) => e.trackerId === tr.id) }))
    .filter((x) => x.answered)
    .sort((p, q) => q.values.reduce((s, v) => s + v, 0) - p.values.reduce((s, v) => s + v, 0)), [mine, entries]);

  const [view, setView] = useState<"links" | "each">(links.length > 0 ? "links" : "each");
  const [detail, setDetail] = useState<string[] | null>(null);

  if (detail) {
    return (
      <div className="animate-fade-in">
        <button type="button" onClick={() => { haptics.tap(); setDetail(null); }}
          className="mb-3 inline-flex h-10 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("charts.back")}
        </button>
        <TrendChart trackers={live} entries={entries} prefilterIds={detail} roomy />
      </div>
    );
  }

  const card = "surface block w-full rounded-[22px] px-4 py-3.5 text-left active:scale-[0.99] transition-transform";
  return (
    <div className="animate-fade-in">
      <div className="inline-flex rounded-full bg-foreground/[0.06] p-0.5" role="tablist">
        {(["links", "each"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { haptics.tap(); setView(v); }}
            className={cn("h-9 rounded-full px-4 text-[15px] font-bold transition-colors", view === v ? "surface text-foreground" : "text-muted-foreground")}>
            {t(`charts.${v}`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[14px] font-medium text-muted-foreground">{t("charts.daysAWeek")}</p>

      {view === "links" && (
        <div className="mt-3 space-y-3">
          {links.length === 0 && <p className="surface rounded-[22px] px-4 py-4 text-[16px] font-semibold">{t("charts.noLinks")}</p>}
          {links.map((l, i) => (
            <button key={i} type="button" className={card} onClick={() => { haptics.tap(); setDetail([l.a.id, l.b.id]); }}>
              <p className="text-[16px] font-bold leading-snug">{name(l.a.id)} → {name(l.b.id)}{l.nextDay ? ` ${t("map.nextDay")}` : ""}</p>
              <p className="text-[14px] font-medium text-muted-foreground">{t("map.timesOf", { k: l.k, count: l.n })}</p>
              <Lines series={[{ color: "var(--coin-teal)", values: weekly(l.a, entries) }, { color: PAIR_B, values: weekly(l.b, entries) }]} />
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--coin-teal))]" />{name(l.a.id)}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${PAIR_B})` }} />{name(l.b.id)}</span>
              </p>
            </button>
          ))}
          {links.length > 0 && <p className="text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>}
        </div>
      )}

      {view === "each" && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {singles.map(({ tr, values }) => (
            <button key={tr.id} type="button" className={cn(card, "px-3.5")} onClick={() => { haptics.tap(); setDetail([tr.id]); }}>
              <p className="line-clamp-2 min-h-[40px] text-[15px] font-bold leading-tight">{localizeTrackerTitle(tr.title)}</p>
              <Lines series={[{ color: islandHsl(islandOf(tr)), values }]} height={56} />
              <p className="mt-1 text-[13px] font-semibold text-muted-foreground">{t("charts.thisWeek", { count: values[WEEKS - 1] })}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
