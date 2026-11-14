// "All about…" on the World (Nov 14 2026, her note: the pages of one thing «вполне себе ничего такие и могут быть одними
// из главных… может быть, дополнительную какую-то ввести кнопку… но… чтобы ещё больше не перегрузить»): one button at
// the top of the World opens every question, by island; a tap opens its page (ThingSheet). Each row says only what is
// there: links, time to act, a try running. Nothing new is counted here.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations } from "@/lib/correlations";
import { islandName, linkWorthShowing, LINKS_TOP, mapPic, type IslandId } from "@/lib/islands";
import { litTrackers } from "@/lib/lighthouses";
import { runningExperiments } from "@/lib/experiments";
import { cardQuestion } from "@/lib/cardText";
import { haptics } from "@/lib/haptics";

export const ThingsList = ({ open, islands, trackers, entries, onClose, onPick }: {
  open: boolean;
  islands: { id: IslandId; def: { icon: string }; trackerIds: string[] }[];
  trackers: Tracker[]; entries: TrackerEntry[];
  onClose: () => void;
  onPick: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const data = useMemo(() => {
    if (!open) return null;
    const live = trackers.filter((x) => !x.archived && x.source !== "play");
    const links = computeCorrelations(live, entries, LINKS_TOP).filter(linkWorthShowing);
    const nLinks = new Map<string, number>();
    links.forEach((c) => [c.trackerA.id, c.trackerB.id].forEach((id) => nLinks.set(id, (nLinks.get(id) ?? 0) + 1)));
    const lit = litTrackers(trackers, entries);
    const running = runningExperiments();
    const trying = new Set<string>();
    running.forEach((x) => { if (x.from) trying.add(x.from); x.link?.split("|").forEach((id) => trying.add(id)); });
    const byId = new Map(live.map((x) => [x.id, x]));
    // what has something to show first, inside each island
    const weight = (id: string) => (trying.has(id) ? 4 : 0) + (lit.has(id) ? 2 : 0) + ((nLinks.get(id) ?? 0) > 0 ? 1 : 0);
    const groups = islands
      .map((isl) => ({ isl, rows: isl.trackerIds.map((id) => byId.get(id)).filter((x): x is Tracker => !!x).sort((a, b) => weight(b.id) - weight(a.id)) }))
      .filter((g) => g.rows.length > 0);
    return { groups, nLinks, lit, trying };
  }, [open, islands, trackers, entries]);

  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-auto max-h-[88vh]" ariaTitle={t("thing.listTitle")}>
      <div data-things-list className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
        <h2 className="pb-3 pr-10 pt-1 text-[24px] font-bold tracking-tight">{t("thing.listTitle")}</h2>
        {data?.groups.map(({ isl, rows }) => (
          <div key={isl.id} className="mb-3">
            <p className="flex items-center gap-2 px-1 pb-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              <img src={mapPic("icon_" + isl.def.icon)} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
              {islandName(t, isl.id)}
            </p>
            <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
              {rows.map((tr) => {
                const n = data.nLinks.get(tr.id) ?? 0;
                const bits = [
                  data.trying.has(tr.id) ? t("link.tryNow") : null,
                  data.lit.has(tr.id) ? t("thing.listAct") : null,
                  n > 0 ? t("thing.listLinks", { count: n }) : null,
                ].filter(Boolean);
                return (
                  <button key={tr.id} type="button" data-things-row={tr.id} onClick={() => { haptics.tap(); onPick(tr.id); }}
                    className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold leading-snug">{cardQuestion(tr)}</span>
                      {bits.length > 0 && <span className="mt-0.5 block text-[14px] font-semibold text-[hsl(var(--coin-teal))]">{bits.join(" · ")}</span>}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
};
