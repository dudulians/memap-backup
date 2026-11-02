// The Map tab (Aurora UX; Nov 1 2026, made clear Nov 2 after her note:
// "накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). A calm flat map of her islands with a legend for the weather
// signs; tap an island for its stats first, then its Findings / Calendar /
// Charts / Limits (the old Patterns, just for that island). "World" shows
// the same for everything. One view only: the rolling globe is gone (her
// note, Nov 2: two ways into the map were confusing).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { buildIslands, buildRoutes, IslandId, islandName, isOwnIsland, mapPic } from "@/lib/islands";
import { getOwnIslands, MAX_OWN } from "@/lib/ownIslands";
import { isoLocal } from "@/lib/doors";
import { litTrackers } from "@/lib/lighthouses";
import { getNotes } from "@/lib/notes";
import { guessedRightTotal } from "@/lib/predict";
import { ITEMS, growthOf, islandDays, itemEarned, worldFacts, type ItemId } from "@/lib/growth";
import { ExperimentSheet } from "./ExperimentSheet";
import { haptics } from "@/lib/haptics";
import { IslandsMap } from "./IslandsMap";
import { WorldMap } from "./WorldMap";
import { IslandStats, WorldStats } from "./IslandStats";
import { PatternsTab } from "./PatternsTab";
import { IslandEditor } from "./IslandEditor";
import { NewIslandSheet } from "./NewIslandSheet";
import { DaysOverview } from "./DaysOverview";
import { IslandQuestions } from "./IslandQuestions";
import { BottomSheet } from "@/components/ui/bottom-sheet";

type Only = "overview" | "trends" | "signals";
export const MapTab = ({ initialOpen = null, onOpened }: { initialOpen?: "all" | Only | null; onOpened?: () => void } = {}) => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<IslandId | "all" | null>(initialOpen === "all" ? "all" : null);
  // Her own island being made (null id) or changed.
  const [editor, setEditor] = useState<{ id: IslandId | null } | null>(null);
  // One switch: the flat map or the rolling globe (her note: one place to switch).
  const [view, setView] = useState<"map" | "globe">("map");
  // Calendar / chart / lighthouses straight away, no tabs inside (her note).
  const [only, setOnly] = useState<Only | null>(initialOpen && initialOpen !== "all" ? initialOpen : null);
  // "+ New island": topics first, then their questions; or her own.
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    if (!initialOpen) return;
    if (initialOpen === "all") setOpen("all");
    else setOnly(initialOpen);
    onOpened?.();
  }, [initialOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Her world grows with what she does (src/lib/growth.ts).
  const [notesCount, setNotesCount] = useState(0);
  useEffect(() => { getNotes().then((n) => setNotesCount(n.length)).catch(() => undefined); }, []);
  const growth = useMemo(() => {
    const days = islandDays(trackers, entries);
    return Object.fromEntries(islands.map((i) => [i.id, growthOf(i.id, days.get(i.id) ?? 0)]));
  }, [islands, trackers, entries]);
  const facts = useMemo(() => worldFacts(trackers, entries, islands, routes, notesCount, guessedRightTotal(entries)), [trackers, entries, islands, routes, notesCount]);
  const items: ItemId[] = useMemo(() => ITEMS.filter((it) => itemEarned(it.id, facts)).map((it) => it.id), [facts]);
  const [testFor, setTestFor] = useState<IslandId | null>(null);
  // Islands with a lit lighthouse (a rule she set was reached).
  const lit = useMemo(() => {
    const on = litTrackers(trackers, entries);
    return new Set(islands.filter((i) => i.trackerIds.some((id) => on.has(id))).map((i) => i.id));
  }, [islands, trackers, entries]);

  return (
    <div ref={boxRef} className={`map-sea relative h-full overscroll-contain ${view === "globe" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}
      style={view === "globe" ? undefined : { paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>
      {/* The header stays at the top (her note): the name, this week's
          summary, and a small Map | Globe switch. */}
      <div className="map-head sticky top-0 z-[6] px-4 pb-2.5 pt-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[26px] font-bold leading-tight tracking-tight">{t("map.title")}</h2>
          {loaded && islands.length > 0 && (
            <div className="inline-flex shrink-0 rounded-full bg-foreground/[0.06] p-0.5" role="tablist" aria-label={t("map.viewAria")}>
              {(["map", "globe"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { haptics.tap(); setView(v); }}
                  className={`h-8 rounded-full px-3.5 text-[14px] font-bold transition-colors ${view === v ? "surface text-foreground" : "text-muted-foreground"}`}>
                  {v === "map" ? t("map.flat") : t("map.globe")}
                </button>
              ))}
            </div>
          )}
        </div>
        {loaded && islands.length > 0 && (
          <button type="button" onClick={() => { haptics.tap(); setOpen("all"); }}
            className="-ml-0.5 mt-0.5 inline-flex h-8 items-center gap-0.5 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">
            {t("map.summary")} <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
          </button>
        )}
      </div>

      {view === "globe" ? (
        // The globe runs to the bottom of the screen, under the tab bar.
        loaded && (
          <div className="relative min-h-0 flex-1">
            <WorldMap islands={islands} routes={routes} growth={growth} onOpen={setOpen} />
          </div>
        )
      ) : (
        <>
          {/* Calendar, chart, lighthouses: on view, each opens straight to itself. */}
          {loaded && islands.length > 0 && (
            <div className="mt-3">
              <DaysOverview trackers={trackers} entries={entries} onOpen={setOnly} />
            </div>
          )}
          {loaded && islands.length > 0 && (
            <div className="mt-3">
              <IslandsMap islands={islands} routes={routes} trackers={trackers} entries={entries} width={width} fill={fill} lit={lit} growth={growth} items={items} onOpen={setOpen} />
            </div>
          )}
          {loaded && (
            <button type="button" onClick={() => { haptics.tap(); setNewOpen(true); }}
              className="mx-auto mt-2 flex h-12 items-center gap-2 rounded-full border-2 border-dashed border-foreground/20 bg-white/40 px-5 text-[16px] font-bold text-foreground/80">
              <Plus className="h-5 w-5" strokeWidth={2.4} /> {t("islands.new")}
            </button>
          )}
        </>
      )}

      {loaded && islands.length === 0 && (
        <div className="absolute left-4 right-4 top-16 z-[2] rounded-[22px] bg-white/90 p-4 text-center shadow-lg">
          <p className="text-[19px] font-bold leading-tight">{t("map.emptyTitle")}</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{t("map.emptyBody")}</p>
        </div>
      )}
      <BottomSheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }} className="h-[88vh]" ariaTitle={island ? islandName(t, island.id) : t("map.summary")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex items-center gap-3 pb-3 pr-10 pt-1">
            <img src={mapPic(island ? "icon_" + island.def.icon : "icon_growth")} alt="" className="h-12 w-12" />
            <h2 className="min-w-0 flex-1 truncate text-[24px] font-bold tracking-tight">{island ? islandName(t, island.id) : t("map.summary")}</h2>
            {island && isOwnIsland(island.id) && (
              <button type="button" onClick={() => setEditor({ id: island.id })} aria-label={t("islands.edit")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground">
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
          {island ? (
            <>
              {island.trackerIds.length > 0 && (
                <IslandStats island={island} routes={routes} trackers={trackers} growth={growth[island.id] ?? []}
                  days={islandDays(trackers, entries).get(island.id) ?? 0} onTest={() => { const id = island.id; setOpen(null); window.setTimeout(() => setTestFor(id), 250); }} />
              )}
              <IslandQuestions key={island.id} island={island} islands={islands} trackers={trackers} />
            </>
          ) : open === "all" ? (
            <WorldStats islands={islands} routes={routes} trackers={trackers} entries={entries} facts={facts} />
          ) : null}
          {island && island.trackerIds.length > 0 && <PatternsTab key={open} focusIds={island.trackerIds} />}
        </div>
      </BottomSheet>
      {/* Calendar / chart / lighthouses for everything, straight away. */}
      <BottomSheet open={!!only} onOpenChange={(o) => { if (!o) setOnly(null); }} className="h-[88vh]"
        ariaTitle={only ? t(only === "overview" ? "overviewCards.calendar" : only === "trends" ? "overviewCards.chart" : "overviewCards.lighthouses") : ""}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <h2 className="pb-3 pr-10 pt-1 text-[24px] font-bold tracking-tight">
            {only && t(only === "overview" ? "overviewCards.calendar" : only === "trends" ? "overviewCards.chart" : "overviewCards.lighthouses")}
          </h2>
          {only && <PatternsTab key={only} only={only} />}
        </div>
      </BottomSheet>
      {testFor && (
        <ExperimentSheet mode="pick" island={testFor} trackers={trackers} entries={entries} onClose={() => setTestFor(null)} />
      )}
      {newOpen && (
        <NewIslandSheet islands={islands} trackers={trackers} canOwn={canMake} onClose={() => setNewOpen(false)}
          onMakeOwn={() => { setNewOpen(false); setEditor({ id: null }); }}
          onCreated={(id) => { setNewOpen(false); setOpen(id); }} />
      )}
      {editor && (
        <IslandEditor editId={editor.id} islands={islands} onClose={() => setEditor(null)}
          onOpenIsland={(id) => { setEditor(null); setOpen(id); }} />
      )}
    </div>
  );
};
