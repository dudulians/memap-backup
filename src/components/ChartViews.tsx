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
import { answerPhrase, cap, templateIdOf } from "@/lib/answerPhrases";
import { linkOf, linkWorthShowing, LINKS_TOP } from "@/lib/islands";
import { linkCount, linkHead, trackerLookup } from "@/lib/linkText";
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
import { art, artOf } from "@/lib/globeArt";
import { islandDays } from "@/lib/growth";
import { ExampleBox, standIn } from "./Examples";

const WEEKS = 8;
const LONG = 26;
// a pair's two lines: indigo and the buttons' teal, neutral (her note, Nov 12 2026: rose means "hard"; orange was off
// the palette, QA Nov 8)
const PAIR_A = "var(--data-a)";
const PAIR_B = "var(--pair-b)";

/** The end of week w (0 = oldest of n), as a date. */
const weekEnd = (w: number, n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1 - w) * 7);
  return d;
};

/** Days a week the question "came" (yes for a hard question, no for a good one; a link's own answer when given),
 *  oldest week first. */
export const weekly = (tracker: Tracker, entries: TrackerEntry[], n = WEEKS, hit = tracker.problemWhen === "yes"): number[] => {
  const counts = Array.from({ length: n }, () => new Set<string>());
  const today = new Date();
  const start = (w: number) => isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (w * 7 + 6)));
  const end = (w: number) => isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - w * 7));
  for (const e of entries) {
    if (e.trackerId !== tracker.id || e.value !== hit) continue;
    for (let w = 0; w < n; w++) if (e.date >= start(w) && e.date <= end(w)) counts[n - 1 - w].add(e.date);
  }
  return counts.map((s) => s.size);
};

/** Every day of the last n weeks, oldest week first, Monday… as the weeks above: did it come that day. */
export const dayMarks = (tracker: Tracker, entries: TrackerEntry[], n = WEEKS, hit = tracker.problemWhen === "yes"): (boolean | undefined)[][] => {
  const byDate = new Map(entries.filter((e) => e.trackerId === tracker.id).map((e) => [e.date, e.value] as const));
  const today = new Date();
  return Array.from({ length: n }, (_, w) => Array.from({ length: 7 }, (_, i) => {
    const v = byDate.get(isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((n - 1 - w) * 7 + 6 - i))));
    return v === undefined ? undefined : v === hit;
  }));
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

export type Series = { color: string; values: number[]; label?: string; days?: (boolean | undefined)[][]; pic?: string };

/** The one chart look (her pick, Nov 12 2026, the store session's mock-up B): thin lines that bend without
 *  overshooting, a soft shadow and a light wash in each line's own colour, the scale ends at the data (three quiet
 *  hairlines), the latest week marked. Big: dates under it, a finger to read any week, and every day of the weeks as
 *  small upright marks under the lines (a line of "days a week" can't show whether it was the SAME days; days with
 *  both are joined by a pale capsule). */
export const Chart = ({ series, height, big = false, at = null, onAt }: { series: Series[]; height: number; big?: boolean; at?: number | null; onAt?: (k: number) => void }) => {
  const { i18n, t } = useTranslation();
  const [ref, W] = useWidth();
  const n = series[0]?.values.length ?? WEEKS;
  const padX = big ? 44 : 8, padTop = 10, padBottom = big ? 30 : 8;
  const top = Math.max(...series.flatMap((s) => s.values), 0);
  const MAX = big ? Math.max(4, Math.ceil(top / 2) * 2) : Math.max(2, top);
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX - 10);
  const y = (v: number) => padTop + (1 - v / MAX) * (height - padTop - padBottom);
  const id = useMemo(() => `c${Math.random().toString(36).slice(2, 8)}`, []);
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const day = (d: Date) => d.toLocaleDateString(lang, { day: "numeric", month: "short" });
  const read = (clientX: number) => {
    const el = ref.current;
    if (!el || !onAt) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left - padX) / (W - padX - 10)) * (n - 1))));
    if (k !== at) { haptics.tap(); onAt(k); }
  };
  // the days under the lines: 7 marks a week, centred on the week's point
  const BW = 4.4, BH = 12, GAP = 1.5, ROWGAP = 7, WK = 7 * BW + 6 * GAP;
  const rows = big ? series.filter((s) => s.days) : [];
  const stripH = rows.length ? rows.length * BH + (rows.length - 1) * ROWGAP : 0;
  return (
    <div ref={ref} className="relative mt-2 w-full select-none" style={{ touchAction: big ? "pan-y" : undefined }}
      onPointerDown={big ? (e) => read(e.clientX) : undefined} onPointerMove={big ? (e) => { if (e.buttons || e.pointerType === "touch") read(e.clientX); } : undefined}>
      <svg width={W} height={height} className="block overflow-visible" aria-hidden="true">
        <defs>
          {series.map((s, k) => (
            <g key={k}>
              <linearGradient id={`${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: `hsl(${s.color})` }} stopOpacity={0.16} />
                <stop offset="1" style={{ stopColor: `hsl(${s.color})` }} stopOpacity={0} />
              </linearGradient>
              <filter id={`${id}-s${k}`} x="-10%" y="-30%" width="120%" height="180%">
                <feDropShadow dx="0" dy={big ? 5 : 3} stdDeviation={big ? 3 : 2} style={{ floodColor: `hsl(${s.color})` }} floodOpacity={0.28} />
              </filter>
            </g>
          ))}
        </defs>
        {[0, MAX / 2, MAX].map((v) => (
          <line key={v} x1={big ? padX - 14 : padX} x2={W - 4} y1={y(v)} y2={y(v)} stroke="hsl(var(--foreground) / 0.08)" strokeWidth={1} />
        ))}
        {big && (
          <>
            {[0, MAX / 2, MAX].map((v) => (
              <text key={v} x={padX - 22} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11.5px] font-medium tabular-nums">{v}</text>
            ))}
            {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} className="fill-muted-foreground text-[11.5px] font-medium">
                {i === n - 1 ? t("charts.now") : day(weekEnd(i, n))}
              </text>
            ))}
          </>
        )}
        {series.map((s, k) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          const line = smooth(pts);
          return <path key={`w${k}`} d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-${k})`} />;
        })}
        {series.map((s, k) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          return (
            <g key={k}>
              <path d={smooth(pts)} fill="none" stroke={`hsl(${s.color})`} strokeWidth={big ? 3 : 2.5} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${id}-s${k})`} />
              <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={big ? 5 : 4} fill={`hsl(${s.color})`} stroke="hsl(var(--surface))" strokeWidth={2} />
            </g>
          );
        })}
        {big && at !== null && (
          <g>
            <line x1={x(at)} x2={x(at)} y1={padTop} y2={y(0)} stroke="hsl(var(--foreground) / 0.22)" strokeWidth={1.5} />
            {series.map((s, k) => <circle key={k} cx={x(at)} cy={y(s.values[at])} r={5.5} fill={`hsl(${s.color})`} stroke="hsl(var(--surface))" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {rows.length > 0 && n <= WEEKS && (
        <div data-chart-days className="mt-4">
          <p className="mb-2.5 text-[12.5px] font-medium text-muted-foreground">{t("charts.everyDay")}</p>
          <svg width={W} height={stripH + 6} viewBox={`0 -3 ${W} ${stripH + 6}`} className="block overflow-visible" aria-hidden="true">
            {rows[0].days!.map((wk, w) => wk.map((_, i) => {
              const cx = x(w) - WK / 2 + i * (BW + GAP) + BW / 2;
              const all = rows.length > 1 && rows.every((r) => r.days![w][i] === true);
              return (
                <g key={`${w}-${i}`}>
                  {all && <rect x={cx - BW / 2 - 2} y={-3} width={BW + 4} height={stripH + 6} rx={BW / 2 + 2} style={{ fill: `hsl(${rows[rows.length - 1].color} / 0.2)` }} />}
                  {rows.map((r, k) => {
                    const v = r.days![w][i];
                    return <rect key={k} x={cx - BW / 2} y={k * (BH + ROWGAP)} width={BW} height={BH} rx={BW / 2} style={{ fill: v ? `hsl(${r.color})` : v === false ? "hsl(var(--foreground) / 0.1)" : "hsl(var(--foreground) / 0.04)" }} />;
                  })}
                </g>
              );
            }))}
            {rows.map((r, k) => r.pic ? <image key={`p${k}`} href={r.pic} x={-2} y={k * (BH + ROWGAP) - 6} width={24} height={24} /> : null)}
          </svg>
        </div>
      )}
    </div>
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

/** Made-up lines over 8 weeks inside the dashed "Example" frame: a link's two lines, or one question's line. */
const ExampleLinkChart = ({ one = false }: { one?: boolean }) => {
  const { t } = useTranslation();
  const a = standIn("slept-enough"), b = standIn("felt-stressed");
  if (!a || !b) return null;
  const series = [
    { color: PAIR_A, values: [4, 5, 3, 4, 3, 2, 2, 1], label: cap(answerPhrase(t, a, false)) },
    { color: PAIR_B, values: [3, 4, 3, 3, 2, 2, 1, 1], label: cap(answerPhrase(t, b, true)) },
  ].slice(0, one ? 1 : 2);
  return (
    <ExampleBox kind={one ? "chart-one" : "chart"} line={t("examples.chart")}>
      <Chart series={series} height={110} />
      <Legend series={series} />
    </ExampleBox>
  );
};

export const ChartViews = ({ trackers, entries, focusIds, pair = false }: { trackers: Tracker[]; entries: TrackerEntry[]; focusIds?: string[]; pair?: boolean }) => {
  const { t, i18n } = useTranslation();
  const live = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);
  const mine = useMemo(() => (focusIds ? live.filter((tr) => focusIds.includes(tr.id)) : live), [live, focusIds]);
  const name = (id: string) => localizeTrackerTitle(live.find((x) => x.id === id)?.title ?? "");
  // less than two weeks of answered days
  const fewDays = useMemo(() => { const ids = new Set(mine.map((x) => x.id)); return new Set(entries.filter((e) => ids.has(e.trackerId)).map((e) => e.date)).size < 14; }, [mine, entries]);
  /** the answer a line counts (weekly counts the hard one), in its own words: "Short night" */
  const hardWord = (tr: Tracker) => (templateIdOf(tr) ? cap(answerPhrase(t, tr, tr.problemWhen === "yes")) : localizeTrackerTitle(tr.title));

  // Links found (on this island, if it's one island's charts), read like the map's.
  const links = useMemo(() => {
    const ids = new Set(mine.map((x) => x.id));
    const of = trackerLookup(live);
    return computeCorrelations(live, entries, LINKS_TOP)
      .filter(linkWorthShowing)
      .filter((c) => !focusIds || (pair ? ids.has(c.trackerA.id) && ids.has(c.trackerB.id) : ids.has(c.trackerA.id) || ids.has(c.trackerB.id)))
      .map((c) => {
        const l = linkOf(c);
        const route = { ...l, a: "other" as const, b: "other" as const, first: l.first.id, second: l.second.id };
        return { a: l.first, b: l.second, aYes: l.firstYes, bYes: l.secondYes, nextDay: l.nextDay, k: l.k, n: l.n, arrow: linkHead(t, route, of), count: linkCount(t, route) };
      })
      .slice(0, 5);
  }, [live, mine, entries, focusIds, pair, t]);

  // Each question, busiest first; only ones with answers.
  const singles = useMemo(() => mine
    .map((tr) => ({ tr, values: weekly(tr, entries), answered: entries.some((e) => e.trackerId === tr.id) }))
    .filter((x) => x.answered)
    .sort((p, q) => q.values.reduce((s, v) => s + v, 0) - p.values.reduce((s, v) => s + v, 0)), [mine, entries]);

  // the links' charts live in Links (her note, Nov 12 2026: «пусть чарты с линками сидят в линках, а в My Days просто
  // чарты по каждому вопросу»): a link's "Chart" opens its own chart here; the list shows each question
  const view = "each" as "links" | "each";
  const setView = (_v: "links" | "each") => undefined;
  // The full chart: which questions, and how far back.
  const [detail, setDetail] = useState<{ ids: string[]; yes?: boolean[]; title: string; sub?: string } | null>(() => {
    if (!pair || focusIds?.length !== 2) return null;
    const l = links[0];
    return l ? { ids: [l.a.id, l.b.id], yes: [l.aYes, l.bYes], title: l.arrow, sub: l.count } : { ids: focusIds, title: focusIds.map(name).join(" · ") };
  });
  const [long, setLong] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const isleDays = useMemo(() => islandDays(trackers, entries), [trackers, entries]);
  /** a question's island as on the globe, at its stage: it names the line */
  const picOf = (tr: Tracker) => { const isle = islandOf(tr); return art(artOf(isle, isleDays.get(isle) ?? 0), false); };

  const colorOf = (tr: Tracker, k: number, pair: boolean) => (pair ? (k === 0 ? PAIR_A : PAIR_B) : islandHsl(islandOf(tr)));

  if (detail) {
    const n = long ? LONG : WEEKS;
    const series: Series[] = detail.ids.map((id, k) => {
      const tr = live.find((x) => x.id === id)!;
      // the answer the link counts ("short night": the no of Slept 7+ hours); a question alone: its hard answer
      const hit = detail.yes ? detail.yes[k] : tr.problemWhen === "yes";
      return {
        color: colorOf(tr, k, detail.ids.length > 1), values: weekly(tr, entries, n, hit), // a link chart has no day bars: the link shows them already (her note, Nov 12 2026: «палочки дублируются»)
        days: detail.ids.length > 1 ? undefined : dayMarks(tr, entries, WEEKS, hit), pic: picOf(tr),
        label: detail.yes ? cap(answerPhrase(t, tr, detail.yes[k])) : detail.ids.length > 1 ? hardWord(tr) : name(id),
      };
    });
    // "12 of 14 times" large, the other days under it (the mock-up B)
    const [times, ...rest] = (detail.sub ?? "").split(" · ");
    const pickLong = (v: boolean) => { haptics.tap(); setLong(v); setAt(null); };
    return (
      <div className="animate-fade-in">
        {/* a link's own chart (its "See the days") goes back to the link from the sheet's top, not to a list (Nov 10 2026) */}
        {!pair && (
          <button type="button" onClick={() => { haptics.tap(); setDetail(null); setAt(null); }}
            className="mb-2 inline-flex h-10 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {t("charts.back")}
          </button>
        )}
        <div data-chart-detail className="surface rounded-[26px] px-5 pb-5 pt-5">
          <p className="text-[20px] font-bold leading-snug tracking-tight">{detail.title}</p>
          {/* the lines named by their islands (no row of legend dots) */}
          <div className="mt-4 flex flex-col gap-1.5">
            {series.map((s, k) => (
              <p key={k} data-chart-key className="flex min-w-0 items-center gap-2.5 text-[15.5px] font-semibold">
                <img src={s.pic} alt="" aria-hidden="true" className="-my-1.5 h-10 w-10 shrink-0 object-contain" />
                <span className="h-0 w-[22px] shrink-0 rounded-full border-t-[2.5px]" style={{ borderColor: `hsl(${s.color})` }} />
                <span className="truncate">{s.label}</span>
              </p>
            ))}
          </div>
          {/* "Days a week" and the period on one line; a touched week reads here instead */}
          <div className="mt-4 flex min-h-[34px] items-center justify-between gap-3" aria-live="polite">
            {at === null ? (
              <span className="text-[12.5px] font-medium text-muted-foreground">{t("charts.daysAWeekShort")}</span>
            ) : (
              <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 text-[13px] font-semibold">
                <span className="text-muted-foreground">{t("charts.weekTo", { day: weekEnd(at, n).toLocaleDateString(i18n.language?.startsWith("ru") ? "ru-RU" : "en-US", { day: "numeric", month: "short" }) })}</span>
                {series.map((s, k) => (
                  <span key={k} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: `hsl(${s.color})` }} />{t("charts.days", { count: s.values[at] })}</span>
                ))}
              </span>
            )}
            <div className="seg shrink-0" role="tablist">
              {[false, true].map((v) => (
                <button key={String(v)} type="button" role="tab" aria-selected={long === v} onClick={() => pickLong(v)} className={cn("chip", long === v && "is-on")}>
                  {t(v ? "charts.months6" : "charts.weeks8")}
                </button>
              ))}
            </div>
          </div>
          <Chart series={series} height={190} big at={at} onAt={setAt} />
          {detail.sub && (
            <p data-chart-count className="mt-5 text-[15.5px] font-semibold leading-snug">
              <span className="block text-[17px] font-extrabold">{times}</span>
              {rest.length > 0 && <span className="mt-0.5 block font-medium text-muted-foreground">{rest.join(" · ")}</span>}
            </p>
          )}
        </div>
      </div>
    );
  }

    const card = "surface block w-full rounded-[22px] px-4 py-3.5 text-left active:scale-[0.99] transition-transform";
  return (
    <div className="animate-fade-in">
      {/* no Links / Each switch: a link's chart opens from the link (her note, Nov 12 2026) */}
      <p className="text-[14px] font-medium text-muted-foreground">{t("charts.daysAWeek")}</p>

      {view === "links" && (
        <div className="mt-3 space-y-3">
          {links.length === 0 && <p className="surface rounded-[22px] px-4 py-4 text-[16px] font-semibold">{t("charts.noLinks")}</p>}
          {/* what a link's chart will look like, marked as an example (her note, Nov 10 2026) */}
          {links.length === 0 && <ExampleLinkChart />}
          {links.map((l, i) => {
            // the headline, its count under it; the lines are named by the answer they count (QA, Nov 8 2026:
            // "Slept enough (7+ hours)" under "you usually sleep under 7 hours")
            const title = l.arrow, sub = l.count;
            const series = [
              { color: PAIR_A, values: weekly(l.a, entries, WEEKS, l.aYes), label: cap(answerPhrase(t, l.a, l.aYes)) },
              { color: PAIR_B, values: weekly(l.b, entries, WEEKS, l.bYes), label: cap(answerPhrase(t, l.b, l.bYes)) },
            ];
            return (
              <button key={i} type="button" className={card} onClick={() => { haptics.tap(); setDetail({ ids: [l.a.id, l.b.id], yes: [l.aYes, l.bYes], title, sub }); }}>
                <p className="text-[17px] font-bold leading-snug">{title}</p>
                <p className="mt-0.5 text-[14px] font-medium text-muted-foreground">{sub}</p>
                <Chart series={series} height={96} />
                <Legend series={series} />
              </button>
            );
          })}
        </div>
      )}

      {/* the first weeks draw flat lines: what one will look like, marked as an example (her note, Nov 10 2026) */}
      {view === "each" && fewDays && <div className="mt-3"><ExampleLinkChart one /></div>}
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
