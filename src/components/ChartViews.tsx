// Charts without the web (her note, Nov 2 2026: "я люблю графики, но когда
// очень много вопросов, там паутина какая-то… показывались какие-то
// отдельные, где предполагаемые связи есть"). Two calm views:
//   Links         — one card per link found: just its two lines, and the
//                   link in words ("After A, B next day · 14 of 18 times");
//   Each question — one small chart per question, busiest first.
// Nov 3 2026 (her note: tapping a chart jumped to a different style, and both
// were too thin): one style everywhere — smooth thick lines with a soft fill,
// in the app's colours — and the full chart is the same chart, bigger, with
// dates, 8 weeks or 6 months, and a finger to read any week.
import { linkOf, linkWorthShowing } from "@/lib/islands";
import { linkArrow, trackerLookup } from "@/lib/linkText";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
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

const WEEKS = 8;
const LONG = 26;
// a pair's two lines: the data colours (index.css --data-a/--data-b)
const PAIR_A = "var(--data-a)";
const PAIR_B = "var(--data-b)";

/** The end of week w (0 = oldest of n), as a date. */
const weekEnd = (w: number, n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1 - w) * 7);
  return d;
};

/** Days a week the question "came" (yes for a hard question, no for a good one), oldest week first. */
const weekly = (tracker: Tracker, entries: TrackerEntry[], n = WEEKS): number[] => {
  const counts = Array.from({ length: n }, () => new Set<string>());
  const hit = tracker.problemWhen === "yes";
  const today = new Date();
  const start = (w: number) => isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (w * 7 + 6)));
  const end = (w: number) => isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - w * 7));
  for (const e of entries) {
    if (e.trackerId !== tracker.id || e.value !== hit) continue;
    for (let w = 0; w < n; w++) if (e.date >= start(w) && e.date <= end(w)) counts[n - 1 - w].add(e.date);
  }
  return counts.map((s) => s.size);
};

/** A smooth line through the points that never overshoots (monotone cubic). */
export const smooth = (p: [number, number][]) => {
  const n = p.length;
  if (n < 2) return "";
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  tg[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / m[i], b = tg[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); tg[i] = k * a * m[i]; tg[i + 1] = k * b * m[i]; }
  }
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${p[i][0] + h},${p[i][1] + tg[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - tg[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
};

const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 300));
    ro.observe(el);
    setW(el.clientWidth || 300);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

type Series = { color: string; values: number[]; label?: string };

/** The one chart look: smooth thick lines, a soft fill under the first, the
 *  latest week marked. Big: dates under it and a finger to read any week. */
const Chart = ({ series, height, big = false }: { series: Series[]; height: number; big?: boolean }) => {
  const { i18n, t } = useTranslation();
  const [ref, W] = useWidth();
  const n = series[0]?.values.length ?? WEEKS;
  const padX = big ? 30 : 8, padTop = 10, padBottom = big ? 30 : 8;
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX - 8);
  const y = (v: number) => padTop + (1 - v / 7) * (height - padTop - padBottom);
  const [at, setAt] = useState<number | null>(null);
  const id = useMemo(() => `c${Math.random().toString(36).slice(2, 8)}`, []);
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const day = (d: Date) => d.toLocaleDateString(lang, { day: "numeric", month: "short" });
  const read = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - padX) / (W - padX - 8)) * (n - 1));
    const k = Math.max(0, Math.min(n - 1, i));
    if (k !== at) { haptics.tap(); setAt(k); }
  };
  return (
    <>
    {/* The week she touched, on its own line above the chart (never over the controls). */}
    {big && (
      <div className="mt-3 flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-0.5 text-[14px] font-semibold" aria-live="polite">
        {at === null ? (
          <span className="text-muted-foreground">{t("charts.touch")}</span>
        ) : (
          <>
            <span className="text-muted-foreground">{t("charts.weekTo", { day: day(weekEnd(at, n)) })}</span>
            {series.map((s, k) => (
              <span key={k} className="inline-flex min-w-0 items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `hsl(${s.color})` }} />
                <span className="truncate">{t("charts.days", { count: s.values[at] })}{s.label && series.length > 1 ? ` · ${s.label}` : ""}</span>
              </span>
            ))}
          </>
        )}
      </div>
    )}
    <div ref={ref} className="relative mt-2 w-full select-none" style={{ height, touchAction: big ? "pan-y" : undefined }}
      onPointerDown={big ? (e) => read(e.clientX) : undefined} onPointerMove={big ? (e) => { if (e.buttons || e.pointerType === "touch") read(e.clientX); } : undefined}>
      <svg width={W} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
        <defs>
          {series.map((s, k) => (
            <linearGradient key={k} id={`${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={`hsl(${s.color})`} stopOpacity={0.28} />
              <stop offset="1" stopColor={`hsl(${s.color})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {[0, 3.5, 7].map((v) => (
          <line key={v} x1={padX} x2={W - 8} y1={y(v)} y2={y(v)} stroke="hsl(var(--foreground) / 0.07)" strokeWidth={1.5} strokeDasharray={v === 0 ? undefined : "3 6"} />
        ))}
        {big && (
          <>
            <text x={padX - 8} y={y(7) + 4} textAnchor="end" className="fill-muted-foreground text-[12px] font-semibold">7</text>
            <text x={padX - 8} y={y(0) + 4} textAnchor="end" className="fill-muted-foreground text-[12px] font-semibold">0</text>
            {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted-foreground text-[12px] font-semibold">
                {i === n - 1 ? t("charts.now") : day(weekEnd(i, n))}
              </text>
            ))}
          </>
        )}
        {series.map((s, k) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          const line = smooth(pts);
          return (
            <g key={k}>
              {k === 0 && <path d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-${k})`} />}
              <path d={line} fill="none" stroke={`hsl(${s.color})`} strokeWidth={big ? 4.5 : 4} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={big ? 6 : 5} fill={`hsl(${s.color})`} stroke="hsl(var(--surface))" strokeWidth={2.5} />
            </g>
          );
        })}
        {big && at !== null && (
          <g>
            <line x1={x(at)} x2={x(at)} y1={padTop} y2={y(0)} stroke="hsl(var(--foreground) / 0.25)" strokeWidth={1.5} />
            {series.map((s, k) => <circle key={k} cx={x(at)} cy={y(s.values[at])} r={6} fill={`hsl(${s.color})`} stroke="hsl(var(--surface))" strokeWidth={2.5} />)}
          </g>
        )}
      </svg>
    </div>
    </>
  );
};

const Legend = ({ series }: { series: Series[] }) => (
  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] font-semibold">
    {series.map((s, k) => (
      <span key={k} className="inline-flex min-w-0 items-center gap-1.5">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `hsl(${s.color})` }} />
        <span className="truncate">{s.label}</span>
      </span>
    ))}
  </p>
);

export const ChartViews = ({ trackers, entries, focusIds, pair = false }: { trackers: Tracker[]; entries: TrackerEntry[]; focusIds?: string[]; pair?: boolean }) => {
  const { t } = useTranslation();
  const live = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);
  const mine = useMemo(() => (focusIds ? live.filter((tr) => focusIds.includes(tr.id)) : live), [live, focusIds]);
  const name = (id: string) => localizeTrackerTitle(live.find((x) => x.id === id)?.title ?? "");

  // Links found (on this island, if it's one island's charts), read like the map's.
  const links = useMemo(() => {
    const ids = new Set(mine.map((x) => x.id));
    const of = trackerLookup(live);
    return computeCorrelations(live, entries, 12)
      .filter(linkWorthShowing)
      .filter((c) => !focusIds || (pair ? ids.has(c.trackerA.id) && ids.has(c.trackerB.id) : ids.has(c.trackerA.id) || ids.has(c.trackerB.id)))
      .map((c) => {
        const l = linkOf(c);
        const route = { ...l, a: "other" as const, b: "other" as const, first: l.first.id, second: l.second.id };
        return { a: l.first, b: l.second, nextDay: l.nextDay, k: l.k, n: l.n, arrow: linkArrow(t, route, of) };
      })
      .slice(0, 5);
  }, [live, mine, entries, focusIds, pair, t]);

  // Each question, busiest first; only ones with answers.
  const singles = useMemo(() => mine
    .map((tr) => ({ tr, values: weekly(tr, entries), answered: entries.some((e) => e.trackerId === tr.id) }))
    .filter((x) => x.answered)
    .sort((p, q) => q.values.reduce((s, v) => s + v, 0) - p.values.reduce((s, v) => s + v, 0)), [mine, entries]);

  const [view, setView] = useState<"links" | "each">(links.length > 0 ? "links" : "each");
  // The full chart: which questions, and how far back.
  const [detail, setDetail] = useState<{ ids: string[]; title: string; sub?: string } | null>(() => {
    if (!pair || focusIds?.length !== 2) return null;
    const l = links[0];
    return l ? { ids: [l.a.id, l.b.id], title: `${l.arrow}${l.nextDay ? ` ${t("map.nextDay")}` : ""}`, sub: t("map.timesOf", { k: l.k, count: l.n }) } : { ids: focusIds, title: focusIds.map(name).join(" · ") };
  });
  const [long, setLong] = useState(false);

  const colorOf = (tr: Tracker, k: number, pair: boolean) => (pair ? (k === 0 ? PAIR_A : PAIR_B) : islandHsl(islandOf(tr)));

  if (detail) {
    const n = long ? LONG : WEEKS;
    const series = detail.ids.map((id, k) => {
      const tr = live.find((x) => x.id === id)!;
      return { color: colorOf(tr, k, detail.ids.length > 1), values: weekly(tr, entries, n), label: name(id) };
    });
    return (
      <div className="animate-fade-in">
        <button type="button" onClick={() => { haptics.tap(); setDetail(null); }}
          className="mb-2 inline-flex h-10 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("charts.back")}
        </button>
        <div className="surface rounded-[24px] px-4 pb-4 pt-4">
          <p className="text-[19px] font-bold leading-snug">{detail.title}</p>
          {detail.sub && <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{detail.sub}</p>}
          <div className="seg mt-3" role="tablist">
            {[false, true].map((v) => (
              <button key={String(v)} type="button" role="tab" aria-selected={long === v} onClick={() => { haptics.tap(); setLong(v); }}
                className={cn("chip", long === v && "is-on")}>
                {t(v ? "charts.months6" : "charts.weeks8")}
              </button>
            ))}
          </div>
          <Chart series={series} height={230} big />
          {series.length > 1 && <Legend series={series} />}
          <p className="mt-3 text-[14px] font-medium text-muted-foreground">{t("charts.daysAWeekShort")}</p>
        </div>
      </div>
    );
  }

  const card = "surface block w-full rounded-[22px] px-4 py-3.5 text-left active:scale-[0.99] transition-transform";
  return (
    <div className="animate-fade-in">
      <div className="seg" role="tablist">
        {(["links", "each"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { haptics.tap(); setView(v); }}
            className={cn("chip", view === v && "is-on")}>
            {t(`charts.${v}`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[14px] font-medium text-muted-foreground">{t("charts.daysAWeek")}</p>

      {view === "links" && (
        <div className="mt-3 space-y-3">
          {links.length === 0 && <p className="surface rounded-[22px] px-4 py-4 text-[16px] font-semibold">{t("charts.noLinks")}</p>}
          {links.map((l, i) => {
            const title = `${l.arrow}${l.nextDay ? ` ${t("map.nextDay")}` : ""}`;
            const sub = t("map.timesOf", { k: l.k, count: l.n });
            const series = [
              { color: PAIR_A, values: weekly(l.a, entries), label: name(l.a.id) },
              { color: PAIR_B, values: weekly(l.b, entries), label: name(l.b.id) },
            ];
            return (
              <button key={i} type="button" className={card} onClick={() => { haptics.tap(); setDetail({ ids: [l.a.id, l.b.id], title, sub }); }}>
                <p className="text-[17px] font-bold leading-snug">{title}</p>
                <p className="text-[14px] font-medium text-muted-foreground">{sub}</p>
                <Chart series={series} height={96} />
                <Legend series={series} />
              </button>
            );
          })}
        </div>
      )}

      {view === "each" && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {singles.map(({ tr, values }) => (
            <button key={tr.id} type="button" className={cn(card, "px-3.5")}
              onClick={() => { haptics.tap(); setDetail({ ids: [tr.id], title: localizeTrackerTitle(tr.title) }); }}>
              <p className="line-clamp-2 min-h-[40px] text-[15px] font-bold leading-tight">{localizeTrackerTitle(tr.title)}</p>
              <Chart series={[{ color: islandHsl(islandOf(tr)), values }]} height={64} />
              <p className="mt-1 text-[13px] font-semibold text-muted-foreground">{t("charts.thisWeek", { count: values[WEEKS - 1] })}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
