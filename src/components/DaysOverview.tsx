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
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, isoLocal } from "@/lib/doors";
import { isHardAnswer, isNeutralQuestion, mapPic } from "@/lib/islands";
import { litTrackers } from "@/lib/lighthouses";
import { answeredEvenings, SHAPING_EVENINGS } from "@/lib/actionPoints";
import { haptics } from "@/lib/haptics";
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

export const DaysOverview = ({ trackers, entries, onOpen }: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onOpen: (section: "overview" | "trends" | "signals") => void;
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
  const { i18n } = useTranslation();
  const ru = i18n.language === "ru";
  const cal = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 21);
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = isoLocal(d);
      return { iso, n: d.getDate(), future: d > now, today: iso === isoLocal(now), look: d > now ? ("none" as const) : dayLook(iso) };
    });
  }, [dayLook]);
  const weekdays = useMemo(() => cal.slice(0, 7).map((c) => format(new Date(c.iso + "T00:00:00"), "EEEEE", ru ? { locale: ruLocale } : undefined).toUpperCase()), [cal, ru]);
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

  const W = 70, H = 38;
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

  const card = "surface flex min-w-0 flex-1 flex-col items-start rounded-[18px] px-2.5 pb-2.5 pt-2 text-left active:scale-[0.98] transition-transform";
  const wide = "surface flex min-w-0 flex-[1.55] flex-col items-start rounded-[18px] px-2.5 pb-2.5 pt-2 text-left active:scale-[0.98] transition-transform";
  const open = (s: "overview" | "trends" | "signals") => { haptics.tap(); onOpen(s); };

  return (
    <div className="flex gap-2.5 px-4">
      <button type="button" className={wide} onClick={() => open("overview")} data-tour="calendar">
        <span className="text-[13px] font-bold leading-tight">{t("overviewCards.calendar")}</span>
        <span className="mt-1 grid w-full grid-cols-7 justify-items-center gap-x-[2px] gap-y-[3px]" aria-hidden="true">
          {weekdays.map((w, i) => <span key={`w${i}`} className="text-[8px] font-bold leading-none text-muted-foreground">{w}</span>)}
          {cal.map((c, i) => {
            const on = fill * 28 > i;
            const real = c.future ? "none" : settle > 0 ? month[i] : "calm";
            const coloured = on && (real === "hard" || real === "calm");
            const bg = !on || c.future ? "transparent"
              : real === "hard" ? "hsl(var(--strong))"
              : real === "calm" ? "hsl(var(--balanced))"
              : "hsl(var(--foreground) / 0.07)";
            return (
              <span key={c.iso} className={cn("flex h-[15px] w-[15px] items-center justify-center rounded-full text-[8px] font-bold tabular-nums leading-none", coloured ? "text-white" : "text-muted-foreground", c.today && "ring-[1.5px] ring-foreground/40")}
                style={{ background: bg, transform: on ? "scale(1)" : "scale(0.6)", transition: "transform 200ms ease-out, background-color 300ms" }}>{c.n}</span>
            );
          })}
        </span>
      </button>
      <button type="button" className={card} onClick={() => open("trends")} data-tour="chart">
        <span className="text-[13px] font-bold leading-tight">{t("overviewCards.chart")}</span>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-1.5 overflow-visible" aria-hidden="true">
          <path d={d} fill="none" stroke="hsl(var(--data-a))" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={len.current} strokeDashoffset={len.current * (1 - ease(wave))} />
          {toReal >= 1 && pts.map(([x, y], i) => i === pts.length - 1 && <circle key={i} cx={x} cy={y} r={3.5} fill="hsl(var(--data-a))" />)}
        </svg>
        <span className="mt-1 text-[12px] font-semibold leading-tight text-muted-foreground">{t("overviewCards.hardPerWeek")}</span>
      </button>
      <button type="button" className={card} onClick={() => open("signals")} data-tour="actions">
        <span className="text-[13px] font-bold leading-tight">{t("overviewCards.lighthouses")}</span>
        <span className="mt-1 flex items-center gap-1.5">
          <img src={mapPic("lighthouse")} alt="" width={28} height={36} className={lit > 0 ? "drop-shadow-[0_0_8px_hsl(44_96%_60%/0.8)]" : "opacity-60 grayscale"} />
          <span className="text-[20px] font-bold tabular-nums">{lit}</span>
        </span>
        <span className="mt-1 text-[12px] font-semibold leading-tight text-muted-foreground">{lit === 0 && shaping ? t("overviewCards.shaping") : t("overviewCards.litOf", { count: rules })}</span>
      </button>
    </div>
  );
};
