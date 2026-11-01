// The Map tab (Aurora UX; Nov 1 2026, made clear Nov 2 after her note:
// "накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). A calm flat map of her islands with a legend for the weather
// signs; tap an island for its stats first, then its Findings / Calendar /
// Charts / Limits (the old Patterns, just for that island). "World" shows
// the same for everything. The rolling globe stays one tap away, for beauty.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe2, Map as MapIcon } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { buildIslands, buildRoutes, IslandId, mapPic } from "@/lib/islands";
import { haptics } from "@/lib/haptics";
import { WorldMap } from "./WorldMap";
import { IslandsMap, WeatherLegend } from "./IslandsMap";
import { IslandStats, WorldStats } from "./IslandStats";
import { PatternsTab } from "./PatternsTab";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export const MapTab = ({ initialOpen = null, onOpened }: { initialOpen?: "all" | null; onOpened?: () => void } = {}) => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<IslandId | "all" | null>(initialOpen);
  const [globe, setGlobe] = useState(false);
  useEffect(() => { if (initialOpen) { setOpen(initialOpen); onOpened?.(); } }, [initialOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.min(el.clientWidth - 32, 440));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const islands = useMemo(() => buildIslands(trackers, entries), [trackers, entries]);
  const routes = useMemo(() => buildRoutes(trackers, entries, islands), [trackers, entries, islands]);
  const island = open && open !== "all" ? islands.find((i) => i.id === open) : undefined;

  return (
    <div ref={boxRef} className="map-sea relative h-full overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>
      {globe ? (
        loaded && <WorldMap islands={islands} routes={routes} onOpen={setOpen} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 px-4 pt-3">
            <div className="min-w-0">
              <h2 className="text-[26px] font-bold leading-tight tracking-tight">{t("map.title")}</h2>
              <p className="text-[15px] font-semibold text-muted-foreground">{t("map.thisWeek")}</p>
            </div>
            {loaded && islands.length > 0 && (
              <button type="button" onClick={() => { haptics.tap(); setOpen("all"); }}
                className="surface mt-1 inline-flex h-11 shrink-0 items-center gap-2 rounded-full pl-2 pr-4 text-[15px] font-bold text-foreground">
                <img src={mapPic("icon_travel")} alt="" width={28} height={28} />
                {t("map.world")}
              </button>
            )}
          </div>
          {loaded && islands.length > 0 && <div className="mt-3"><WeatherLegend /></div>}
          {loaded && islands.length > 0 && (
            <div className="mt-2">
              <IslandsMap islands={islands} routes={routes} trackers={trackers} width={width} onOpen={setOpen} />
            </div>
          )}
        </>
      )}

      {/* The rolling globe, for beauty: one round button. */}
      {loaded && islands.length > 0 && (
        <button type="button" onClick={() => { haptics.tap(); setGlobe((g) => !g); }} aria-label={globe ? t("map.flat") : t("map.globe")}
          className="surface fixed right-4 z-[3] flex h-12 w-12 items-center justify-center rounded-full text-foreground"
          style={{ bottom: "calc(6.75rem + env(safe-area-inset-bottom, 0px))" }}>
          {globe ? <MapIcon className="h-5 w-5" strokeWidth={2} /> : <Globe2 className="h-5 w-5" strokeWidth={2} />}
        </button>
      )}

      {loaded && islands.length === 0 && (
        <div className="absolute left-4 right-4 top-16 z-[2] rounded-[22px] bg-white/90 p-4 text-center shadow-lg">
          <p className="text-[19px] font-bold leading-tight">{t("map.emptyTitle")}</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{t("map.emptyBody")}</p>
        </div>
      )}
      <BottomSheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }} className="h-[88vh]" ariaTitle={island ? t(`map.island.${island.id}`) : t("map.world")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex items-center gap-3 pb-3 pr-10 pt-1">
            <img src={mapPic(island ? "icon_" + island.def.icon : "icon_travel")} alt="" className="h-12 w-12" />
            <h2 className="text-[24px] font-bold tracking-tight">{island ? t(`map.island.${island.id}`) : t("map.world")}</h2>
          </div>
          {island ? (
            <IslandStats island={island} routes={routes} trackers={trackers} />
          ) : open === "all" ? (
            <WorldStats islands={islands} routes={routes} trackers={trackers} entries={entries} />
          ) : null}
          {open && <PatternsTab key={open} focusIds={island?.trackerIds} />}
        </div>
      </BottomSheet>
    </div>
  );
};
