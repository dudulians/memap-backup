// The Map tab (Aurora UX; Nov 1 2026, made clear Nov 2 after her note:
// "накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). A calm flat map of her islands with a legend for the weather
// signs; tap an island for its stats first, then its Findings / Calendar /
// Charts / Limits (the old Patterns, just for that island). "World" shows
// the same for everything. One view only: the rolling globe is gone (her
// note, Nov 2: two ways into the map were confusing).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { buildIslands, buildRoutes, IslandId, islandName, isOwnIsland, mapPic } from "@/lib/islands";
import { getOwnIslands, MAX_OWN } from "@/lib/ownIslands";
import { isoLocal } from "@/lib/doors";
import { litTrackers } from "@/lib/lighthouses";
import { haptics } from "@/lib/haptics";
import { IslandsMap, WeatherLegend } from "./IslandsMap";
import { IslandStats, WorldStats } from "./IslandStats";
import { PatternsTab } from "./PatternsTab";
import { IslandEditor } from "./IslandEditor";
import { IslandQuestions } from "./IslandQuestions";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export const MapTab = ({ initialOpen = null, onOpened }: { initialOpen?: "all" | null; onOpened?: () => void } = {}) => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<IslandId | "all" | null>(initialOpen);
  // Her own island being made (null id) or changed.
  const [editor, setEditor] = useState<{ id: IslandId | null } | null>(null);
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
    window.addEventListener("memap-islands-changed", load);
    return () => {
      window.removeEventListener("memap-settings-changed", load);
      window.removeEventListener("memap-islands-changed", load);
    };
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
  // How much of each island is answered today: a calm ring by its name.
  const fill = useMemo(() => {
    const today = isoLocal(new Date());
    const done = new Set(entries.filter((e) => e.date === today).map((e) => e.trackerId));
    return Object.fromEntries(islands.map((i) => [i.id, i.trackerIds.length ? i.trackerIds.filter((id) => done.has(id)).length / i.trackerIds.length : 0]));
  }, [islands, entries]);
  const canMake = getOwnIslands().length < MAX_OWN;
  // Islands with a lit lighthouse (a rule she set was reached).
  const lit = useMemo(() => {
    const on = litTrackers(trackers, entries);
    return new Set(islands.filter((i) => i.trackerIds.some((id) => on.has(id))).map((i) => i.id));
  }, [islands, trackers, entries]);

  return (
    <div ref={boxRef} className="map-sea relative h-full overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>
      {/* One view only (her note: two ways into the map were confusing). */}
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
              <IslandsMap islands={islands} routes={routes} trackers={trackers} width={width} fill={fill} lit={lit} onOpen={setOpen} />
            </div>
          )}
          {loaded && canMake && (
            <button type="button" onClick={() => { haptics.tap(); setEditor({ id: null }); }}
              className="mx-auto mt-2 flex h-12 items-center gap-2 rounded-full border-2 border-dashed border-foreground/20 bg-white/40 px-5 text-[16px] font-bold text-foreground/80">
              <Plus className="h-5 w-5" strokeWidth={2.4} /> {t("islands.new")}
            </button>
          )}
      </>

      {loaded && islands.length === 0 && (
        <div className="absolute left-4 right-4 top-16 z-[2] rounded-[22px] bg-white/90 p-4 text-center shadow-lg">
          <p className="text-[19px] font-bold leading-tight">{t("map.emptyTitle")}</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{t("map.emptyBody")}</p>
        </div>
      )}
      <BottomSheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }} className="h-[88vh]" ariaTitle={island ? islandName(t, island.id) : t("map.world")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex items-center gap-3 pb-3 pr-10 pt-1">
            <img src={mapPic(island ? "icon_" + island.def.icon : "icon_travel")} alt="" className="h-12 w-12" />
            <h2 className="min-w-0 flex-1 truncate text-[24px] font-bold tracking-tight">{island ? islandName(t, island.id) : t("map.world")}</h2>
            {island && isOwnIsland(island.id) && (
              <button type="button" onClick={() => setEditor({ id: island.id })} aria-label={t("islands.edit")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground">
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
          {island ? (
            <>
              {island.trackerIds.length > 0 && <IslandStats island={island} routes={routes} trackers={trackers} />}
              <IslandQuestions key={island.id} island={island} islands={islands} trackers={trackers} />
            </>
          ) : open === "all" ? (
            <WorldStats islands={islands} routes={routes} trackers={trackers} entries={entries} />
          ) : null}
          {open && (open === "all" || (island && island.trackerIds.length > 0)) && <PatternsTab key={open} focusIds={island?.trackerIds} />}
        </div>
      </BottomSheet>
      {editor && (
        <IslandEditor editId={editor.id} islands={islands} onClose={() => setEditor(null)}
          onOpenIsland={(id) => { setEditor(null); setOpen(id); }} />
      )}
    </div>
  );
};
