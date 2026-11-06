// "Steady, or depends on the day?" (board 64, Nov 6 2026 — her original idea: "правда ли я
// этого хочу, или это приходит только в дни, когда плохо сплю, ругаюсь…"). For a thought
// she tracks (quitting, moving): how often it came on hard days around it vs other days.
// Counts only, never a verdict on the wish; "the decision is yours".
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getDoor, getDoorState } from "@/lib/doors";
import { isHardAnswer } from "@/lib/islands";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import type { Tracker, TrackerEntry } from "@/types/tracker";

const MIN_DAYS = 7;

export const SteadyCard = ({ trackers, entries }: { trackers: Tracker[]; entries: TrackerEntry[] }) => {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const door = getDoorState();
    if (!door || getDoor(door.id)?.branch !== "thought") return null;
    const main = trackers.find((x) => x.id === door.trackerId && !x.archived);
    if (!main) return null;
    const ctx = door.contextTrackerIds.map((id) => trackers.find((x) => x.id === id && !x.archived)).filter((x): x is Tracker => !!x);
    const byDay = new Map<string, Map<string, unknown>>();
    for (const e of entries) { if (!byDay.has(e.date)) byDay.set(e.date, new Map()); byDay.get(e.date)!.set(e.trackerId, e.value); }
    const days = [...byDay.entries()].filter(([, m]) => typeof m.get(main.id) === "boolean");
    const rows = ctx.map((c) => {
      const hard = days.filter(([, m]) => m.has(c.id) && isHardAnswer(c, m.get(c.id)));
      return { c, k: hard.filter(([, m]) => m.get(main.id) === true).length, n: hard.length };
    }).filter((r) => r.n > 0);
    const calm = days.filter(([, m]) => !ctx.some((c) => m.has(c.id) && isHardAnswer(c, m.get(c.id))));
    const hardAny = days.filter(([, m]) => ctx.some((c) => m.has(c.id) && isHardAnswer(c, m.get(c.id))));
    const rate = (xs: typeof days) => (xs.length ? xs.filter(([, m]) => m.get(main.id) === true).length / xs.length : 0);
    const other = { k: calm.filter(([, m]) => m.get(main.id) === true).length, n: calm.length };
    const total = days.filter(([, m]) => m.get(main.id) === true).length;
    let verdict: "early" | "hard" | "steady" | "mixed" = "mixed";
    if (days.length < MIN_DAYS) verdict = "early";
    else if (hardAny.length >= 3 && calm.length >= 3 && rate(hardAny) - rate(calm) >= 0.25 && rate(calm) <= 0.5) verdict = "hard";
    else if (total / days.length >= 0.6 && (calm.length === 0 || rate(calm) >= 0.5)) verdict = "steady";
    return { main, rows, other, verdict, answered: days.length };
  }, [trackers, entries]);
  if (!data) return null;
  const label = (c: Tracker) => (c.problemWhen === "no" ? t("link.without", { q: localizeTrackerTitle(c.title) }) : localizeTrackerTitle(c.title));
  const bar = (k: number, n: number, strong = false) => (
    <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-foreground/[0.08]">
      <i className={cn("block h-full rounded-full bg-[hsl(var(--data-a))]", !strong && "opacity-60")} style={{ width: `${n ? Math.round((k / n) * 100) : 0}%` }} />
    </span>
  );
  return (
    <div className="surface mb-4 rounded-[20px] px-4 py-3.5">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("steady.kicker")}</p>
      <p className="mt-1 text-[18px] font-bold leading-snug">{t("steady.when", { q: localizeTrackerTitle(data.main.title) })}</p>
      {data.rows.map((r) => (
        <div key={r.c.id} className="mt-2.5">
          <div className="flex justify-between gap-3 text-[15px] font-bold"><span className="min-w-0 truncate">{label(r.c)}</span><span className="shrink-0 tabular-nums text-muted-foreground">{t("steady.kOf", { k: r.k, count: r.n })}</span></div>
          {bar(r.k, r.n, true)}
        </div>
      ))}
      <div className="mt-2.5">
        <div className="flex justify-between gap-3 text-[15px] font-semibold text-muted-foreground"><span>{t("steady.other")}</span><span className="tabular-nums">{t("steady.kOf", { k: data.other.k, count: data.other.n })}</span></div>
        {bar(data.other.k, data.other.n)}
      </div>
      <div className="mt-3 rounded-[14px] bg-[hsl(var(--data-a)/0.12)] px-3 py-2.5">
        <p className="text-[16px] font-bold">{t(`steady.v.${data.verdict}`, { count: Math.max(0, MIN_DAYS - data.answered) })}</p>
        <p className="mt-0.5 text-[14px] font-semibold text-muted-foreground">{t(`steady.vLine.${data.verdict}`)}</p>
      </div>
      <p className="mt-2 text-center text-[13px] font-semibold text-muted-foreground">{t("steady.yours")}</p>
    </div>
  );
};
