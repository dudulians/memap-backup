// A link between two islands, opened from its dotted route on the Map or the
// Globe (her note, Nov 5 2026, WORLD-BIBLE "Решения 5 ноября" #4): which two
// questions, how many times out of how many, and, honestly, that this is what
// happened together in her days, not proof of a cause.
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { islandName, type IslandId, type Route } from "@/lib/islands";
import { linkArrow, linkOther, linkSentence } from "@/lib/linkText";
import { art, artOf } from "@/lib/globeArt";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";
import { Tracker } from "@/types/tracker";

/** A counted day's colour: hard red, good green, neutral indigo. */
const dot = (hard: boolean | null, a = 1) => (hard === null ? `hsl(var(--data-a) / ${a})` : hard ? `hsl(var(--strong) / ${a})` : `hsl(var(--balanced) / ${a})`);

export const LinkSheet = ({ route, trackers, days, onClose, onChart }: {
  route: Route | null;
  trackers: Tracker[];
  /** evenings answered on each island: its picture at its stage */
  days: Record<string, number>;
  onClose: () => void;
  /** the two questions on the chart */
  onChart: (ids: string[]) => void;
}) => {
  const { t } = useTranslation();
  const title = (id: string) => {
    const tr = trackers.find((x) => x.id === id);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };
  const pic = (id: IslandId) => {
    const name = artOf(id, days[id] ?? 0);
    return (
      <span aria-hidden="true" className="block w-[96px]">
        <img className="art-day block w-full" src={art(name, false)} alt="" />
        <img className="art-night block w-full" src={art(name, true)} alt="" />
      </span>
    );
  };
  const r = route;
  return (
    <BottomSheet open={!!r} onOpenChange={(o) => { if (!o) onClose(); }} ariaTitle={t("link.title")}>
      {r && (
        <div className="px-5 pb-8 pt-1">
          {/* the two islands and the dotted route between them */}
          {r.a === r.b ? (
            <div className="flex flex-col items-center">
              <svg aria-hidden="true" width="96" height="28" className="-mb-1">
                {Array.from({ length: 9 }, (_, i) => { const u = 0.1 + (i / 8) * 0.8, x = 6 + u * 84, y = 26 - Math.sin(u * Math.PI) * 22; return <circle key={i} className="planet-route" cx={x} cy={y} r={2.6} />; })}
              </svg>
              {pic(r.a)}<span className="mt-1 text-[14px] font-bold">{islandName(t, r.a)} · {t("link.onIsland")}</span>
            </div>
          ) : (
          <div className="flex items-end justify-center gap-1">
            <div className="flex flex-col items-center">{pic(r.a)}<span className="mt-1 text-[14px] font-bold">{islandName(t, r.a)}</span></div>
            <svg aria-hidden="true" width="74" height="40" className="mb-8 shrink-0">
              {Array.from({ length: 7 }, (_, i) => {
                const u = (i + 0.5) / 7, x = 6 + u * 62, y = 30 - Math.sin(u * Math.PI) * 18, e = Math.min(1, Math.min(u, 1 - u) / 0.2);
                return <circle key={i} className="planet-route" cx={x} cy={y} r={2 + 1.6 * e} opacity={0.4 + 0.6 * e} />;
              })}
            </svg>
            <div className="flex flex-col items-center">{pic(r.b)}<span className="mt-1 text-[14px] font-bold">{islandName(t, r.b)}</span></div>
          </div>
          )}

          <p className="mt-5 text-[22px] font-bold leading-snug tracking-tight">
            {linkArrow(t, r, title)}
            {r.nextDay && <span className="ml-2 inline-flex h-7 translate-y-[-2px] items-center rounded-full bg-[hsl(var(--data-a)/0.14)] px-2.5 align-middle text-[14px] font-bold text-[hsl(var(--strong))]">{t("map.nextDay")}</span>}
          </p>

          {/* k of n, as dots: filled = it came */}
          <p className="mt-4 text-[34px] font-bold leading-none tracking-tight tabular-nums">{t("map.timesOf", { k: r.k, count: r.n })}</p>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
            {Array.from({ length: Math.min(r.n, 40) }, (_, i) => (
              <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < r.k ? dot(r.secondHard) : r.secondHard === null ? "hsl(var(--foreground) / 0.12)" : dot(!r.secondHard, 0.7) }} />
            ))}
          </div>
          <p className="mt-3 text-[16px] font-medium leading-snug text-muted-foreground">
            {linkSentence(t, r, title)}
          </p>
          {/* the other days, so a coincidence looks like one */}
          <p className="mt-1 text-[16px] font-bold leading-snug">{linkOther(t, r)}</p>

          <p className="surface mt-4 rounded-[18px] px-4 py-3 text-[15px] font-semibold leading-snug text-foreground/80">{t("link.honest")}</p>

          <button type="button" onClick={() => { haptics.tap(); onChart([r.first, r.second]); }}
            className="raised-btn mt-6 w-full justify-center">
            <BarChart3 className="h-5 w-5" strokeWidth={2.4} /> {t("link.chart")}
          </button>
        </div>
      )}
    </BottomSheet>
  );
};
