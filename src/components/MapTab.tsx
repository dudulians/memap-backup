// The Map tab (Aurora UX, Nov 1 2026): replaces Patterns in the bottom bar.
// Your questions as islands on a ball you roll; tap an island to open its
// own Findings / Calendar / Charts / Limits (the old Patterns, just for that
// island). "All" opens Patterns for every question, so nothing is lost.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { buildIslands, buildRoutes, IslandId, mapPic } from "@/lib/islands";
import { WorldMap } from "./WorldMap";
import { PatternsTab } from "./PatternsTab";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export const MapTab = () => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<IslandId | "all" | null>(null);

  useEffect(() => {
    const load = async () => {
      const [ts, es] = await Promise.all([getTrackers(), getEntries()]);
      setTrackers(ts);
      setEntries(es);
      setLoaded(true);
    };
    load();
    window.addEventListener("memap-settings-changed", load);
    return () => window.removeEventListener("memap-settings-changed", load);
  }, []);

  const islands = useMemo(() => buildIslands(trackers, entries), [trackers, entries]);
  const routes = useMemo(() => buildRoutes(trackers, entries, islands), [trackers, entries, islands]);
  const island = open && open !== "all" ? islands.find((i) => i.id === open) : undefined;

  return (
    <div className="relative h-full">
      {loaded && <WorldMap islands={islands} routes={routes} onOpen={setOpen} />}
      {loaded && islands.length > 0 && (
        <button type="button" onClick={() => setOpen("all")}
          className="absolute left-3 top-3 z-[2] h-11 rounded-2xl bg-white/70 px-4 text-[15px] font-bold text-foreground shadow-sm backdrop-blur">
          {t("map.all")}
        </button>
      )}
      {loaded && islands.length === 0 && (
        <div className="absolute left-4 right-4 top-16 z-[2] rounded-[22px] bg-white/90 p-4 text-center shadow-lg">
          <p className="text-[19px] font-bold leading-tight">{t("map.emptyTitle")}</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{t("map.emptyBody")}</p>
        </div>
      )}
      <BottomSheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }} className="h-[88vh]" ariaTitle={island ? t(`map.island.${island.id}`) : t("map.all")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex items-center gap-3 pb-2 pr-10 pt-1">
            {island && <img src={mapPic("icon_" + island.def.icon)} alt="" className="h-12 w-12" />}
            <div className="min-w-0">
              {island && <p className="text-xs font-extrabold uppercase tracking-wider text-primary">{t(island.weather ? `map.weather.${island.weather}` : "map.weather.none")}</p>}
              <h2 className="text-[22px] font-bold tracking-tight">{island ? t(`map.island.${island.id}`) : t("map.all")}</h2>
            </div>
          </div>
          {open && <PatternsTab key={open} focusIds={island?.trackerIds} />}
        </div>
      </BottomSheet>
    </div>
  );
};
