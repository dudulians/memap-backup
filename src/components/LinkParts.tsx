// One look for a link wherever it opens (her pick, Nov 12 2026: «уйдём от этих плашек розовых… сделаем текстом»;
// the sheet she liked when a link was found: the sentence, "13 of 15 times", the dots; then "What comes first?" and
// what else to watch; the chart only as a small link at the side). Used by the Links list (FindingsView) and the
// globe's link sheet (LinkSheet).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Check, Plus } from "lucide-react";
import { islandName, type IslandId, type Route } from "@/lib/islands";
import { linkNumbers, linkOtherDays, linkTimesBig, type TrackerOf } from "@/lib/linkText";
import { getLinkOrder, setLinkOrder } from "@/lib/linkOrder";
import { art, artOf } from "@/lib/globeArt";
import { RELATED_QUESTIONS } from "@/lib/relatedQuestions";
import { answerPhrase, cap, templateIdOf } from "@/lib/answerPhrases";
import { ensureTemplates, findTemplate } from "@/lib/doors";
import { templateQuestion } from "@/lib/cardText";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { Tracker } from "@/types/tracker";

/** An island as on the globe, at its stage (day and night pictures). */
const Pic = ({ id, days, w = 92 }: { id: IslandId; days: number; w?: number }) => {
  const name = artOf(id, days);
  return (
    <span aria-hidden="true" className="block" style={{ width: w }}>
      <img className="art-day block w-full" src={art(name, false)} alt="" />
      <img className="art-night block w-full" src={art(name, true)} alt="" />
    </span>
  );
};

/** The link's two islands with their names and the dotted route between; one island with "A link on the … island". */
export const LinkIsles = ({ r, days }: { r: Pick<Route, "a" | "b">; days: Record<string, number> }) => {
  const { t } = useTranslation();
  if (r.a === r.b) return (
    <span data-link-isles className="flex flex-col items-center">
      <svg aria-hidden="true" width="96" height="28" className="-mb-1">
        {Array.from({ length: 9 }, (_, i) => { const u = 0.1 + (i / 8) * 0.8, x = 6 + u * 84, y = 26 - Math.sin(u * Math.PI) * 22; return <circle key={i} className="planet-route" cx={x} cy={y} r={2.6} />; })}
      </svg>
      <Pic id={r.a} days={days[r.a] ?? 0} />
      <span className="mt-1 text-[14px] font-bold">{t("link.onIslandOf", { island: islandName(t, r.a) })}</span>
    </span>
  );
  return (
    <span data-link-isles className="flex items-end justify-center gap-1">
      <span className="flex flex-col items-center"><Pic id={r.a} days={days[r.a] ?? 0} /><span data-isle-name className="mt-1 text-[14px] font-bold">{islandName(t, r.a)}</span></span>
      <svg aria-hidden="true" width="74" height="40" className="mb-8 shrink-0">
        {Array.from({ length: 7 }, (_, i) => {
          const u = (i + 0.5) / 7, x = 6 + u * 62, y = 30 - Math.sin(u * Math.PI) * 18, e = Math.min(1, Math.min(u, 1 - u) / 0.2);
          return <circle key={i} className="planet-route" cx={x} cy={y} r={2 + 1.6 * e} opacity={0.4 + 0.6 * e} />;
        })}
      </svg>
      <span className="flex flex-col items-center"><Pic id={r.b} days={days[r.b] ?? 0} /><span data-isle-name className="mt-1 text-[14px] font-bold">{islandName(t, r.b)}</span></span>
    </span>
  );
};

/** k of n as dots: filled = it came (hard rose, good green, neutral indigo), the rest grey. */
export const LinkDots = ({ k, n, hard }: { k: number; n: number; hard: boolean | null }) => {
  const on = hard === null ? "hsl(var(--data-a))" : hard ? "hsl(var(--strong))" : "hsl(var(--balanced))";
  return (
    <div data-link-dots className="mt-2.5 flex flex-wrap gap-1.5" aria-hidden="true">
      {Array.from({ length: Math.min(n, 40) }, (_, i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < k ? on : "hsl(var(--foreground) / 0.12)" }} />)}
    </div>
  );
};

/** A row of days: one answer's last days as dots (filled = it came), the rows one under another so the days that came
 *  together line up (her question, Nov 12 2026: why one link had dots and "two things" not). */
export type DayRow = { label: string; days: (boolean | undefined)[]; color: string; main?: boolean };
/** One day: filled colour = it was, soft grey = it wasn't (answered), an empty ring = no answer that day. */
const DayDot = ({ v, color }: { v: boolean | undefined; color: string }) => (
  <span data-day={v === true ? "yes" : v === false ? "no" : "none"} className="h-3.5 w-3.5 rounded-full"
    style={v === undefined ? { boxShadow: "inset 0 0 0 1.5px hsl(var(--foreground) / 0.22)" } : { background: v ? color : "hsl(var(--foreground) / 0.13)" }} />
);
export const DayRows = ({ rows }: { rows: DayRow[] }) => {
  const { t } = useTranslation();
  const color = rows[0]?.color ?? "hsl(var(--strong))";
  return (
    <div data-day-rows className="mt-3">
      <div className="space-y-3">
        {rows.map((r, n) => (
          <div key={n}>
            <p className={cn("mb-1.5 truncate text-[14px]", r.main ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground")}>{r.label}</p>
            <div className="flex items-center justify-between" aria-hidden="true">
              {r.days.map((v, i) => <DayDot key={i} v={v} color={r.color} />)}
            </div>
          </div>
        ))}
      </div>
      {/* what a dot means (her question, Nov 12 2026: grey read as "not filled in") */}
      <p data-day-key className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><DayDot v={true} color={color} />{t("link.dayYes")}</span>
        <span className="inline-flex items-center gap-1.5"><DayDot v={false} color={color} />{t("link.dayNo")}</span>
        <span className="inline-flex items-center gap-1.5"><DayDot v={undefined} color={color} />{t("link.dayNone")}</span>
      </p>
    </div>
  );
};

/** "13 of 15 times" large with a small "Chart" at its side, the dots (k of n, or the days in rows), and the other days
 *  in words. */
export const LinkNumbers = ({ r, onChart, rows }: { r: Pick<Route, "k" | "n" | "other" | "mostly" | "secondHard">; onChart?: () => void; rows?: DayRow[] }) => {
  const { t } = useTranslation();
  const { k, n } = linkNumbers(r);
  const other = linkOtherDays(t, r);
  return (
    <div data-link-numbers>
      <div className="flex items-baseline justify-between gap-3">
        <p data-link-times className="text-[30px] font-bold leading-[1.1] tracking-tight tabular-nums">{linkTimesBig(t, k, n)}</p>
        {onChart && (
          <button type="button" data-link-chart onClick={() => { haptics.tap(); onChart(); }}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 text-[15px] font-bold text-[hsl(var(--coin-teal))]">
            <BarChart3 className="h-4 w-4" strokeWidth={2.4} />{t("link.chartShort")}
          </button>
        )}
      </div>
      {rows ? <DayRows rows={rows} /> : <LinkDots k={k} n={n} hard={r.secondHard} />}
      {other && <p data-link-other className="mt-2.5 text-[16px] font-bold leading-snug">{cap(other)}</p>}
    </div>
  );
};

/** More likely causes of both, not asked yet (for "Not sure"): first those both questions' lists name. */
const watchFor = (a: Tracker, b: Tracker, tracked: Set<string>): string[] => {
  const ta = templateIdOf(a), tb = templateIdOf(b);
  const la = (ta && RELATED_QUESTIONS[ta]) || [], lb = (tb && RELATED_QUESTIONS[tb]) || [];
  const ok = (id: string) => { if (tracked.has(id) || id === ta || id === tb) return false; const f = findTemplate(id); return !!f && !f.template.quiet && !f.template.sensitive && !f.template.askOnly; };
  const both = la.filter((id) => lb.includes(id) && ok(id));
  return [...new Set([...both, ...la.filter(ok), ...lb.filter(ok)])].slice(0, 2);
};

/** "What comes first, do you think?" (her idea, Nov 12 2026): the person's answer orders the link (linkOrder.ts);
 *  "Not sure" offers what else may bring both. */
export const OrderAsk = ({ r, of, tracked }: { r: Pick<Route, "first" | "second" | "firstYes" | "secondYes">; of: TrackerOf; tracked: Set<string> }) => {
  const { t } = useTranslation();
  const a = of(r.first), b = of(r.second);
  const [chosen, setChosen] = useState(() => (a && b ? getLinkOrder(a.id, b.id) : null));
  const [editing, setEditing] = useState(false);
  const [watchKept, setWatchKept] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  if (!a || !b) return null;
  const pick = (v: string, choice: "first" | "second" | "unsure") => { haptics.tap(); setChosen(v); setEditing(false); setLinkOrder(a.id, b.id, v); track("link_order_answered", { choice }); };
  const firstOf = (id: string) => (id === a.id ? answerPhrase(t, a, r.firstYes) : answerPhrase(t, b, r.secondYes));
  // the app's picked row (one look kit): a teal ring and a tick, never a tinted ground (her note, Nov 12 2026: the
  // first version, small grey chips under the dots, "я вообще не увидела этот вопрос")
  const row = (on: boolean) => cn("flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-[16px] outline-none active:scale-[0.99]", on ? "surface pick-on font-bold" : "bg-foreground/[0.05] font-semibold");
  const tick = (on: boolean) => <span aria-hidden="true" className={cn("tick", on && "is-on")}>{on && <Check className="h-4 w-4" strokeWidth={3} />}</span>;
  // the list stays as it was when "Not sure" was picked: an added question keeps its row, ticked
  const watch = chosen === "unsure" ? [...new Set([...watchKept, ...watchFor(a, b, tracked)])].slice(0, Math.max(2, watchKept.length)) : [];
  const addWatch = async (id: string) => {
    if (added.includes(id)) return;
    haptics.success();
    setWatchKept((k) => (k.includes(id) ? k : [...k, ...watch.filter((x) => !k.includes(x))]));
    setAdded((x) => [...x, id]);
    track("notit_watch_added");
    await ensureTemplates([id]);
  };
  const watchList = watch.length > 0 && (
    <div data-watch-list className="mt-4">
      <p className="text-[16px] font-bold leading-snug">{t("link.orderWatch")}</p>
      <div className="mt-2 space-y-2">
        {watch.map((id) => { const f = findTemplate(id); if (!f) return null; const on = added.includes(id); return (
          <button key={id} type="button" data-watch={id} aria-pressed={on} onClick={() => void addWatch(id)} className={row(on)}>
            <span className="min-w-0 flex-1">{templateQuestion(f.template)}</span>
            {on ? tick(true) : <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Plus className="h-4 w-4" strokeWidth={3} /></span>}
          </button>
        ); })}
      </div>
      {added.length > 0 && <p data-watch-added className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("tipDay.added")}</p>}
    </div>
  );
  // answered: one picked row says what was chosen and what it did; "Change" opens the three rows again
  if (chosen && !editing) return (
    <div data-order-ask data-order-done className="mt-4 mb-1">
      <div className="surface pick-on flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2.5">
        <span aria-hidden="true" className="tick is-on"><Check className="h-4 w-4" strokeWidth={3} /></span>
        <span data-order-mine className="min-w-0 flex-1 text-[16px] font-bold leading-snug">{chosen === "unsure" ? t("link.orderMineUnsure") : t("link.orderMine", { what: firstOf(chosen) })}</span>
        <button type="button" data-order-change onClick={() => { haptics.tap(); setEditing(true); }} className="shrink-0 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("link.orderChange")}</button>
      </div>
      {chosen !== "unsure" && <p className="mt-1.5 text-[14px] font-semibold text-muted-foreground">{t("link.orderEffect")}</p>}
      {watchList}
    </div>
  );
  return (
    <div data-order-ask className="mt-5 mb-1">
      <p className="text-[19px] font-extrabold leading-snug tracking-tight">{t("link.orderAsk")}</p>
      <div className="mt-2.5 space-y-2">
        <button type="button" data-order="first" aria-pressed={chosen === a.id} onClick={() => pick(a.id, "first")} className={row(chosen === a.id)}><span className="min-w-0 flex-1">{cap(t("link.orderFirst", { what: answerPhrase(t, a, r.firstYes) }))}</span>{tick(chosen === a.id)}</button>
        <button type="button" data-order="second" aria-pressed={chosen === b.id} onClick={() => pick(b.id, "second")} className={row(chosen === b.id)}><span className="min-w-0 flex-1">{cap(t("link.orderFirst", { what: answerPhrase(t, b, r.secondYes) }))}</span>{tick(chosen === b.id)}</button>
        <button type="button" data-order="unsure" aria-pressed={chosen === "unsure"} onClick={() => pick("unsure", "unsure")} className={row(chosen === "unsure")}><span className="min-w-0 flex-1">{t("link.orderUnsure")}</span>{tick(chosen === "unsure")}</button>
      </div>
    </div>
  );
};

/** The library questions the person already has (not offered again under "Not sure"). */
export const trackedTemplates = (trackers: Tracker[]) => new Set(trackers.filter((x) => !x.archived).map((x) => templateIdOf(x)).filter((x): x is string => !!x));
