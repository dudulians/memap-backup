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
import { isoLocal } from "@/lib/doors";
import { mapPic } from "@/lib/islands";
import { litTrackers } from "@/lib/lighthouses";
import { haptics } from "@/lib/haptics";
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

  // The last 28 days: answered, hard (a problem question answered YES), empty.
  const month = useMemo(() => {
    const ids = new Set(live.map((tr) => tr.id));
    const hardIds = new Set(live.filter((tr) => tr.problemWhen === "yes").map((tr) => tr.id));
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (27 - i));
      const iso = isoLocal(d);
      const es = entries.filter((e) => e.date === iso && ids.has(e.trackerId));
      return es.length === 0 ? "none" : es.some((e) => e.value && hardIds.has(e.trackerId)) ? "hard" : "calm";
    });
  }, [live, entries]);

  // Hard days per week, the last 8 weeks (oldest first).
  const weeks = useMemo(() => Array.from({ length: 8 }, (_, w) => {
    const hardIds = new Set(live.filter((tr) => tr.problemWhen === "yes").map((tr) => tr.id));
    const days = new Set<string>();
    for (let d = 0; d < 7; d++) {
      const day = new Date();
      day.setDate(day.getDate() - ((7 - w) * 7 + d));
      const iso = isoLocal(day);
      if (entries.some((e) => e.date === iso && e.value && hardIds.has(e.trackerId))) days.add(iso);
    }
    return days.size;
  }), [live, entries]);

  const lit = useMemo(() => litTrackers(trackers, entries).size, [trackers, entries]);
  const rules = live.filter((tr) => tr.threshold > 0).length;

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

  const card = "surface flex min-w-0 flex-1 flex-col items-start rounded-[18px] px-2.5 pb-2.5 pt-2 text-left active:scale-[0.98] transition-transform";
  const open = (s: "overview" | "trends" | "signals") => { haptics.tap(); onOpen(s); };

  return (
    <div className="flex gap-2.5 px-4">
      <button type="button" className={card} onClick={() => open("overview")}>
        <span className="text-[13px] font-bold leading-tight">{t("overviewCards.calendar")}</span>
        <span className="mt-1.5 grid grid-cols-7 gap-[3px]" aria-hidden="true">
          {month.map((m, i) => {
            const on = fill * 28 > i;
            const real = settle > 0 ? m : "calm";
            const bg = !on ? "hsl(var(--foreground) / 0.07)"
              : real === "hard" ? "hsl(var(--coin-gold))"
              : real === "calm" ? "hsl(var(--coin-teal))"
              : "hsl(var(--foreground) / 0.07)";
            return <span key={i} className="h-[10px] w-[10px] rounded-[3px] transition-colors duration-300" style={{ background: bg, transform: on ? "scale(1)" : "scale(0.6)", transition: "transform 200ms ease-out, background-color 300ms" }} />;
          })}
        </span>
      </button>
      <button type="button" className={card} onClick={() => open("trends")}>
        <span className="text-[13px] font-bold leading-tight">{t("overviewCards.chart")}</span>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-1.5 overflow-visible" aria-hidden="true">
          <path d={d} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={len.current} strokeDashoffset={len.current * (1 - ease(wave))} />
          {toReal >= 1 && pts.map(([x, y], i) => i === pts.length - 1 && <circle key={i} cx={x} cy={y} r={3.5} fill="hsl(var(--coin-teal))" />)}
        </svg>
        <span className="mt-1 text-[12px] font-semibold leading-tight text-muted-foreground">{t("overviewCards.hardPerWeek")}</span>
      </button>
      <button type="button" className={card} onClick={() => open("signals")}>
        <span className="text-[13px] font-bold leading-tight">{t("overviewCards.lighthouses")}</span>
        <span className="mt-1 flex items-center gap-1.5">
          <img src={mapPic("lighthouse")} alt="" width={28} height={36} className={lit > 0 ? "drop-shadow-[0_0_8px_hsl(44_96%_60%/0.8)]" : "opacity-60 grayscale"} />
          <span className="text-[20px] font-bold tabular-nums">{lit}</span>
        </span>
        <span className="mt-1 text-[12px] font-semibold leading-tight text-muted-foreground">{lit > 0 ? t("overviewCards.litOf", { count: rules }) : t("overviewCards.noneLit", { count: rules })}</span>
      </button>
    </div>
  );
};
