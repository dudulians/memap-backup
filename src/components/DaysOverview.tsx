// Calendar, chart and lighthouses on view (Aurora, Nov 2 2026; her note:
// "календари и чарты и действия наблюдения слишком спрятаны… сразу
// показывала бы мультики и инфографикой, как заполнится календарь и график
// волной, а потом уже в статику как есть"). Three small cards at the top of
// the Map. Each first plays how it fills (the month fills cell by cell, the
// line runs as a wave), then settles on her real days. Tap opens the full
// one. Reduce Motion: the real state at once.
// Nov 3 2026 (her brief): about 12% more compact, less empty space.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, isoLocal } from "@/lib/doors";
import { isHardAnswer, isNeutralQuestion, mapPic } from "@/lib/islands";
import { litTrackers } from "@/lib/lighthouses";
import { answeredEvenings, SHAPING_EVENINGS } from "@/lib/actionPoints";
import { haptics } from "@/lib/haptics";
import { Spline, Sprout } from "lucide-react";
import { currentExperiment, experimentDay, EXPERIMENT_DAYS, finishedExperiments } from "@/lib/experiments";
import { testNameOf } from "@/lib/testWords";
import { cn } from "@/lib/utils";
import { smooth } from "./ChartViews";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 0..1 over `ms`, once, after mount. */
const useProgress = (ms: number, delay = 0) => {
  const [p, setP] = useState(() => (reduced() ? 1 : 0));
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      setP(k);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, delay]);
  return p;
};
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

/** The 4 parts of the app as a light row over the map (her pick, Nov 6 2026,
 *  board 76 A): My days (calendar + chart) · Links · When to act · What helps. */
export const DaysOverview = ({ trackers, entries, onOpen, links = 0, onHelps }: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onOpen: (section: "overview" | "trends" | "signals" | "findings") => void;
  /** links found now (linkWorthShowing) */
  links?: number;
  /** What helps: the try now, or pick one */
  onHelps?: () => void;
}) => {
  const { t } = useTranslation();
  const live = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);

  // What a day was (Nov 6 2026, the colours turned red / green: "any hard answer"
  // made nearly every day red with many questions): her main question decides
  // when it was answered; otherwise most of the day's answers do.
  const dayLook = useMemo(() => {
    // wishes and decisions have no good or bad answer: they don't colour a day
    const byId = new Map(live.filter((tr) => !isNeutralQuestion(tr)).map((tr) => [tr.id, tr]));
    const main = getDoorState()?.trackerId;
    const byDay = new Map<string, TrackerEntry[]>();
    for (const e of entries) if (byId.has(e.trackerId)) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    return (iso: string): "none" | "hard" | "calm" => {
      const es = byDay.get(iso) ?? [];
      if (es.length === 0) return "none";
      const m = main ? es.find((e) => e.trackerId === main) : undefined;
      if (m) return isHardAnswer(byId.get(m.trackerId)!, m.value) ? "hard" : "calm";
      const hard = es.filter((e) => isHardAnswer(byId.get(e.trackerId)!, e.value)).length;
      return hard * 2 > es.length ? "hard" : "calm";
    };
  }, [live, entries]);

  // The last 4 weeks as a calendar (her note, Nov 6 2026: "дотс как календарь с
  // датами"): Monday first, the date in each day; days after today stay empty.
  const cal = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 21);
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = isoLocal(d);
      return { iso, n: d.getDate(), future: d > now, today: iso === isoLocal(now), look: d > now ? ("none" as const) : dayLook(iso) };
    });
  }, [dayLook]);
  const month = cal.map((c) => c.look);

  // Hard days per week, the last 8 weeks (oldest first), by the same rule.
  const weeks = useMemo(() => Array.from({ length: 8 }, (_, w) => {
    let n = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date();
      day.setDate(day.getDate() - ((7 - w) * 7 + d));
      if (dayLook(isoLocal(day)) === "hard") n++;
    }
    return n;
  }), [dayLook]);

  const lit = useMemo(() => litTrackers(trackers, entries).size, [trackers, entries]);
  const rules = live.filter((tr) => tr.threshold > 0).length;
  // No "all calm" before a week of evenings (Nov 5 2026): it's still taking shape.
  const shaping = useMemo(() => answeredEvenings(trackers, entries) < SHAPING_EVENINGS, [trackers, entries]);

  // Calendar: cells fill one by one (as if every day were answered), then
  // turn into her real days.
  const fill = useProgress(900, 150);
  const settle = useProgress(500, 1250);
  // Chart: a wave runs across, then eases into her real line.
  const wave = useProgress(1100, 300);
  const toReal = useProgress(700, 1500);

  const W = 88, H = 38;
  const max = Math.max(4, ...weeks);
  const pts = weeks.map((v, i) => {
    const x = (i / (weeks.length - 1)) * W;
    const waveY = H / 2 + Math.sin(i * 1.3 + 0.6) * (H / 3);
    const realY = H - 4 - (v / max) * (H - 8);
    const y = waveY + (realY - waveY) * ease(toReal);
    return [x, y] as const;
  });
  // The same smooth line as the Charts (her Nov 3 note: one style everywhere).
  const d = smooth(pts.map(([x, y]) => [x, y] as [number, number]));
  const len = useRef(260);

  // the last 2 weeks, oldest first: a picture, no dates (her v74 rule for this card)
  const twoWeeks = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return dayLook(isoLocal(d));
  }), [dayLook]);
  const test = currentExperiment();
  const tried = finishedExperiments().length;
  const card = "surface flex min-w-0 flex-1 flex-col items-start rounded-[16px] px-2 pb-2 pt-1.5 text-left active:scale-[0.97] transition-transform";
  const open = (s: "overview" | "trends" | "signals" | "findings") => { haptics.tap(); onOpen(s); };
  const head = (k: string) => <span className="line-clamp-2 min-h-[30px] text-[12.5px] font-bold leading-[1.2]">{t(k)}</span>;
  const sub = (s: string) => <span className="mt-0.5 line-clamp-2 w-full break-words text-[11px] font-semibold leading-[1.2] text-muted-foreground">{s}</span>;

  return (
    <div className="flex gap-1.5 px-4">
      <button type="button" className={card} onClick={() => open("overview")} data-tour="calendar">
        {head("world4.myDays")}
        <span className="mt-1 grid grid-cols-7 gap-[2.5px]" aria-hidden="true">
          {twoWeeks.map((m, i) => {
            const on = fill * 14 > i;
            const real = settle > 0 ? m : "calm";
            const bg = !on ? "hsl(var(--foreground) / 0.07)" : real === "hard" ? "hsl(var(--strong))" : real === "calm" ? "hsl(var(--balanced))" : "hsl(var(--foreground) / 0.08)";
            return <span key={i} className="h-[7px] w-[7px] rounded-full" style={{ background: bg, transition: "background-color 300ms" }} />;
          })}
        </span>
        {sub(t("world4.last2weeks"))}
      </button>
      <button type="button" className={card} onClick={() => open("findings")} data-tour="links-card">
        {head("world4.links")}
        <span className="mt-1 flex h-[17px] items-center gap-1 text-[17px] font-bold tabular-nums">
          <Spline className="h-4 w-4 text-[hsl(var(--data-a))]" strokeWidth={2.6} />{links}
        </span>
        {sub(links > 0 ? t("world4.found") : t("world4.soon"))}
      </button>
      <button type="button" className={card} onClick={() => open("signals")} data-tour="actions">
        {head("world4.whenToAct")}
        <span className="mt-1 flex h-[17px] items-center gap-1 text-[17px] font-bold tabular-nums">
          <img src={mapPic("lighthouse")} alt="" width={14} height={18} className={lit > 0 ? "drop-shadow-[0_0_6px_hsl(44_96%_60%/0.9)]" : "opacity-60 grayscale"} />{lit}
        </span>
        {sub(lit === 0 && shaping ? t("world4.shaping") : t("world4.ofRules", { count: rules }))}
      </button>
      <button type="button" className={card} onClick={() => { haptics.tap(); onHelps?.(); }} data-tour="helps">
        {head("world4.whatHelps")}
        <span className="mt-1 flex h-[17px] items-center gap-1 text-[15px] font-bold tabular-nums">
          <Sprout className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />
          {test ? `${Math.min(experimentDay(test), EXPERIMENT_DAYS)}/${EXPERIMENT_DAYS}` : tried}
        </span>
        {sub(test ? testNameOf(test.change) : tried > 0 ? t("world4.tried", { count: tried }) : t("world4.tryOne"))}
      </button>
    </div>
  );
};
