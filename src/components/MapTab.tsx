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
import { art, artOf, stageOf, toNextStage } from "@/lib/globeArt";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { firstLinkState } from "@/lib/firstLink";
import { growSeen } from "@/lib/growMoment";
import { grewToday } from "@/lib/globeArt";
import { buildIslands, buildRoutes, IslandId, islandName, isOwnIsland, linkWorthShowing, mapPic, type Route } from "@/lib/islands";
import { computeCorrelations } from "@/lib/correlations";
import { currentExperiment, experimentOver, type Experiment } from "@/lib/experiments";
import { getDoorState } from "@/lib/doors";
import { getOwnIslands, MAX_OWN } from "@/lib/ownIslands";
import { isoLocal } from "@/lib/doors";
import { litTrackers } from "@/lib/lighthouses";
import { getNotes } from "@/lib/notes";
import { ITEMS, gardenTrees, growthOf, islandDays, owned, placeTreasures, syncTreasures, worldFacts, type ItemId } from "@/lib/growth";
import { ExperimentSheet } from "./ExperimentSheet";
import type { TryAction } from "./ActionPoints";
import { avatarDeclined, avatarUrl, getAvatar } from "@/lib/avatar";
import { islandOf } from "@/lib/islands";
import { haptics } from "@/lib/haptics";
import { PlanetMap } from "./PlanetMap";
import { LinkSheet } from "./LinkSheet";
import { PlanetGlobe } from "./PlanetGlobe";
import { AnswerNow, GrowthLadder, IslandMore, IslandTreasures, IslandWeek, type IslandView } from "./IslandStats";
import { PatternsTab } from "./PatternsTab";
import { IslandEditor } from "./IslandEditor";
import { NewIslandSheet } from "./NewIslandSheet";
import { DaysOverview } from "./DaysOverview";
import { IslandQuestions } from "./IslandQuestions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { track } from "@/lib/analytics";

type Only = "overview" | "trends" | "signals" | "findings";
export const MapTab = ({ initialOpen = null, initialIsland = null, onOpened }: {
  initialOpen?: "all" | Only | null;
  /** back from answering an island's questions on Today: its sheet again */
  initialIsland?: string | null;
  onOpened?: () => void;
} = {}) => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpenRaw] = useState<IslandId | null>(null);
  const setOpen = (id: IslandId | null) => { if (id) track("island_opened", { island: id.startsWith("own-") ? "own" : id }); setOpenRaw(id); };
  // Her own island being made (null id) or changed.
  const [editor, setEditor] = useState<{ id: IslandId | null } | null>(null);
  // One switch: the flat map or the rolling globe (her note: one place to
  // switch); remembered, so she comes back to the one she left.
  const [view, setView] = useState<"map" | "globe">(() => {
    try { return localStorage.getItem("memap_map_view") === "globe" ? "globe" : "map"; } catch { return "map"; }
  });
  // the tour shows the flat map (its calendar, chart and action points live there)
  useEffect(() => {
    const set = (e: Event) => { const v = (e as CustomEvent).detail; if (v === "map" || v === "globe") setView(v); };
    window.addEventListener("memap-set-map-view", set);
    return () => window.removeEventListener("memap-set-map-view", set);
  }, []);
  // Calendar / chart / lighthouses straight away, no tabs inside (her note).
  const [only, setOnly] = useState<Only | null>(initialOpen && initialOpen !== "all" ? initialOpen : null);
  // Which island the calendar / chart / action points show (null: all).
  const [onlyIsland, setOnlyIsland] = useState<IslandId | null>(null);
  // a link's card (from its route), and the two questions it shows on the chart
  const [link, setLinkRaw] = useState<Route | null>(null);
  const setLink = (r: Route | null) => { if (r) track("link_opened", { next_day: r.nextDay }); setLinkRaw(r); };
  const [onlyIds, setOnlyIds] = useState<string[] | null>(null);
  // "+ New island": topics first, then their questions; or her own.
  const [newOpen, setNewOpen] = useState(false);
  // A sheet opened from elsewhere (a step on Today): closing it goes back there.
  const fromOutside = useRef(false);
  useEffect(() => {
    if (!initialOpen) return;
    // her week and treasures live in You now; its close takes her back (Index)
    if (initialOpen === "all") window.dispatchEvent(new CustomEvent("memap-open-you", { detail: { trip: true } }));
    else { fromOutside.current = true; setOnly(initialOpen); }
    onOpened?.();
  }, [initialOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!initialIsland) return;
    setOpen(initialIsland as IslandId);
    onOpened?.();
  }, [initialIsland]); // eslint-disable-line react-hooks/exhaustive-deps
  const tripDone = () => {
    if (!fromOutside.current) return;
    fromOutside.current = false;
    window.dispatchEvent(new Event("memap-trip-done"));
  };

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
  // the first link moment's "Open it": the link's own card
  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail as { a: string; b: string } | undefined;
      if (!d) return;
      window.setTimeout(() => setLink(routes.find((r) => (r.a === d.a && r.b === d.b) || (r.a === d.b && r.b === d.a)) ?? null), 200);
    };
    window.addEventListener("memap-open-link", open);
    return () => window.removeEventListener("memap-open-link", open);
  }, [routes]);
  // "See the island" after it grew: its card
  useEffect(() => {
    const open = (e: Event) => { const d = (e as CustomEvent).detail as { island: IslandId } | undefined; if (d) window.setTimeout(() => setOpen(d.island), 200); };
    window.addEventListener("memap-open-island", open);
    return () => window.removeEventListener("memap-open-island", open);
  }, []);
  // an island that grew today and hasn't been seen growing: its moment (after a first link's)
  useEffect(() => {
    if (!loaded || entries.length === 0 || firstLinkState(routes, true).route) return;
    const g = grewToday(trackers, entries).find((x) => x.stage >= 2 && !growSeen(x.island, x.stage));
    if (!g) return;
    const id = window.setTimeout(() => window.dispatchEvent(new CustomEvent("memap-grow-moment", { detail: g })), 700);
    return () => window.clearTimeout(id);
  }, [loaded, routes, trackers, entries]);
  // opening World the day her first link is found plays its moment (once)
  useEffect(() => {
    if (!loaded || entries.length === 0) return;
    if (!firstLinkState(routes, true).route) return;
    const id = window.setTimeout(() => window.dispatchEvent(new CustomEvent("memap-link-moment")), 650);
    return () => window.clearTimeout(id);
  }, [loaded, routes, entries.length]);
  const island = open ? islands.find((i) => i.id === open) : undefined;
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
  // evenings answered on each island: her own islands grow on the globe
  const dayCount = useMemo(() => Object.fromEntries(islandDays(trackers, entries)) as Record<string, number>, [trackers, entries]);
  const facts = useMemo(() => worldFacts(trackers, entries, islands, routes, notesCount), [trackers, entries, islands, routes, notesCount]);
  // her treasures, each on its island, on the Map and the Globe alike (Nov 5 2026)
  const treasures = useMemo(() => (loaded ? placeTreasures({ islands: islands.map((i) => i.id), days: dayCount, facts, routes, trackers }) : new Map()),
    [loaded, islands, dayCount, facts, routes, trackers]);
  const garden = useMemo(() => gardenTrees(islands.map((i) => i.id)), [islands]);
  useEffect(() => { if (loaded) syncTreasures(facts); }, [facts, loaded]);
  const items: ItemId[] = useMemo(() => ITEMS.filter((it) => owned(it.id, facts)).map((it) => it.id), [facts]);
  const [testFor, setTestFor] = useState<IslandId | null>(null);
  // What helps: a finished try's result
  const [helpsResult, setHelpsResult] = useState<Experiment | null>(null);
  // "I'll try" on an action point: the Action points sheet steps aside for the
  // week's test, and comes back after it (Nov 5 2026).
  const [trying, setTrying] = useState<TryAction | null>(null);
  // Her avatar sails by the island she answered last (her note: the avatar
  // was only an icon in the corner).
  const [avatarPic, setAvatarPic] = useState<string | null>(() => avatarUrl(getAvatar()));
  useEffect(() => {
    const sync = () => setAvatarPic(avatarUrl(getAvatar()));
    window.addEventListener("memap-avatar-changed", sync);
    return () => window.removeEventListener("memap-avatar-changed", sync);
  }, []);
  const near = useMemo(() => {
    const last = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
    const tr = last && trackers.find((x) => x.id === last.trackerId);
    return tr ? islandOf(tr) : undefined;
  }, [entries, trackers]);
  const you = { pic: avatarPic, declined: avatarDeclined(), near };
  // Islands with a lit lighthouse (a rule she set was reached).
  const lit = useMemo(() => {
    const on = litTrackers(trackers, entries);
    return new Set(islands.filter((i) => i.trackerIds.some((id) => on.has(id))).map((i) => i.id));
  }, [islands, trackers, entries]);

  // her topic's island: lit on the map (board 76 A)
  const mainIsland = useMemo(() => {
    const id = getDoorState()?.trackerId;
    const tr = id ? trackers.find((x) => x.id === id && !x.archived) : undefined;
    return tr ? islandOf(tr) : null;
  }, [trackers]);
  // every link worth showing, not only the ones drawn between islands
  const linkCount = useMemo(() => computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, 12).filter(linkWorthShowing).length, [trackers, entries]);
  const onHelps = () => {
    const x = currentExperiment();
    if (x && experimentOver(x)) { setHelpsResult(x); return; }
    if (x) { setOpen(x.island as IslandId); return; }
    const first = mainIsland && islands.some((i) => i.id === mainIsland) ? mainIsland : islands.find((i) => i.trackerIds.length > 0)?.id;
    if (first) setTestFor(first);
  };
  const onlyTitle = (o: Only) => t(o === "findings" ? "world4.links" : o === "signals" ? "world4.whenToAct" : "world4.myDays");

  return (
    <div ref={boxRef} className={`map-sea relative h-full overscroll-contain ${view === "globe" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}
      style={view === "globe" ? { background: "transparent" } : { paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>
      {/* The header stays at the top (her note): the name, this week's
          summary, and a small Map | Globe switch. */}
      <div className="map-head sticky top-0 z-[6] px-4 pb-2.5 pt-3" style={view === "globe" ? { background: "transparent" } : undefined}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[26px] font-bold leading-tight tracking-tight">{t("map.title")}</h2>
          {loaded && islands.length > 0 && (
            <div className="seg shrink-0" role="tablist" aria-label={t("map.viewAria")}>
              {(["map", "globe"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { haptics.tap(); setView(v); track("map_view_changed", { view: v }); try { localStorage.setItem("memap_map_view", v); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent("memap-map-view", { detail: v })); }}
                  className={`chip ${view === v ? "is-on" : ""}`}>
                  {v === "map" ? t("map.flat") : t("map.globe")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "globe" ? (
        // The globe (her painted planet, Nov 4 2026) fills the whole tab: her sky
        // runs behind the header, the ball under the tab bar.
        loaded && (
          <div className="absolute inset-0">
            <PlanetGlobe sky={false} islands={islands} routes={routes} avatar={avatarPic} lit={lit} days={dayCount} treasures={treasures} garden={garden} onOpen={setOpen}
              onLink={(a, b) => setLink(routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) ?? null)}
              paused={!!open || !!only || newOpen || !!editor || !!testFor || !!trying || !!link} onNewIsland={() => setNewOpen(true)} />
          </div>
        )
      ) : (
        <>
          {/* Calendar, chart, lighthouses: on view, each opens straight to itself. */}
          {loaded && islands.length > 0 && (
            <div className="mt-3">
              <DaysOverview trackers={trackers} entries={entries} links={linkCount} onHelps={onHelps} onOpen={(v) => { setOnlyIsland(null); setOnly(v); }} />
            </div>
          )}
          {loaded && islands.length > 0 && (
            <div className="mt-3" data-tour="world">
              <PlanetMap islands={islands} routes={routes} width={width} lit={lit} main={mainIsland} days={dayCount} avatar={avatarPic} treasures={treasures} garden={garden} onOpen={setOpen} onLink={setLink}
                onNewIsland={islands.length < 9 ? () => setNewOpen(true) : undefined} onYou={() => window.dispatchEvent(new CustomEvent("memap-open-you"))} />
            </div>
          )}
          {/* the ring has its own place for a new island; this one is for a full map */}
          {loaded && islands.length >= 9 && (
            <button type="button" onClick={() => { haptics.tap(); setNewOpen(true); }}
              className="surface mx-auto mt-2 flex h-12 items-center gap-2 rounded-full px-5 text-[16px] font-bold">
              <Plus className="h-5 w-5" strokeWidth={2.4} /> {t("islands.new")}
            </button>
          )}
        </>
      )}

      {/* No island yet, in the new look (her note, Nov 4 2026): her cloud island
          waiting to be explored, one line, one button. */}
      {loaded && islands.length === 0 && (
        <div className="absolute inset-x-0 top-0 bottom-28 z-[2] flex flex-col items-center justify-center px-6 text-center">
          <img aria-hidden="true" className="art-day w-[170px]" src={art("cloud_island_03", false)} alt="" />
          <img aria-hidden="true" className="art-night w-[170px]" src={art("cloud_island_03", true)} alt="" />
          <p className="mt-3 text-[26px] font-bold leading-tight tracking-tight">{t("map.emptyTitle")}</p>
          <p className="mt-2 max-w-xs text-[16px] font-medium leading-snug text-muted-foreground">{t("map.emptyBody")}</p>
          <button type="button" onClick={() => { haptics.tap(); setNewOpen(true); }} className="raised-btn mt-7">
            <Plus className="h-5 w-5" strokeWidth={2.6} /> {t("islands.new")}
          </button>
        </div>
      )}
      <BottomSheet open={!!open && loaded} onOpenChange={(o) => { if (!o) { setOpen(null); tripDone(); } }} className="h-[88vh]" ariaTitle={island ? islandName(t, island.id) : t("map.summary")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex items-center gap-3 pb-3 pr-10 pt-1">
            {/* the island as it stands now, and how far its next stage is (WORLD-BIBLE, "Рост острова") */}
            {island ? (
              <span aria-hidden="true" className="w-[76px] shrink-0">
                <img className="art-day block w-full" src={art(artOf(island.id, dayCount[island.id] ?? 0), false)} alt="" />
                <img className="art-night block w-full" src={art(artOf(island.id, dayCount[island.id] ?? 0), true)} alt="" />
              </span>
            ) : <img src={mapPic("icon_growth")} alt="" className="h-12 w-12" />}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[24px] font-bold tracking-tight">{island ? islandName(t, island.id) : t("map.summary")}</h2>
              {island && (() => { const n = dayCount[island.id] ?? 0, left = toNextStage(n); return (
                <p className="truncate text-[15px] font-semibold text-muted-foreground">{t(`path.stage${stageOf(n)}`)} · {left === null ? t("path.fullyGrown") : t("path.toNext", { count: left })}</p>
              ); })()}
            </div>
            {island && isOwnIsland(island.id) && (
              <button type="button" onClick={() => setEditor({ id: island.id })} aria-label={t("islands.edit")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground">
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
          {island ? (
            <>
              {/* In order (her note: "куча всего, дублируется"): this week in
                  words, what to answer today, the questions, then this
                  island's calendar / chart / action points, links, test, growth. */}
              <GrowthLadder island={island.id} days={dayCount[island.id] ?? 0} />
              <IslandTreasures placed={treasures.get(island.id)} facts={facts}
                onAll={() => { setOpen(null); window.setTimeout(() => window.dispatchEvent(new CustomEvent("memap-open-you")), 260); }} />
              {island.trackerIds.length > 0 && <IslandWeek island={island} trackers={trackers} />}
              <div className="mb-1 mt-2"><AnswerNow island={island} trackers={trackers} entries={entries} /></div>
              <IslandQuestions key={island.id} island={island} islands={islands} trackers={trackers} />
              {island.trackerIds.length > 0 && (
                <IslandMore island={island} routes={routes} trackers={trackers} growth={growth[island.id] ?? []} islands={islands} entries={entries}
                  days={islandDays(trackers, entries).get(island.id) ?? 0}
                  onTest={() => { const id = island.id; fromOutside.current = false; setOpen(null); window.setTimeout(() => setTestFor(id), 250); }}
                  onView={(v: IslandView) => { const id = island.id; setOpen(null); window.setTimeout(() => { setOnlyIsland(id); setOnly(v); }, 250); }} />
              )}
            </>
          ) : null}
        </div>
      </BottomSheet>
      {/* Calendar / chart / lighthouses for everything, straight away. */}
      <BottomSheet open={!!only} onOpenChange={(o) => { if (!o) { setOnly(null); setOnlyIds(null); tripDone(); } }} className="h-[88vh]"
        ariaTitle={only ? onlyTitle(only) : ""}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <h2 className="pb-2 pr-10 pt-1 text-[24px] font-bold tracking-tight">{only && onlyTitle(only)}</h2>
          {/* My days holds both the calendar and the chart (her note, Nov 6 2026) */}
          {(only === "overview" || only === "trends") && (
            <div className="seg mb-3 w-full" role="tablist" aria-label={t("world4.myDays")}>
              {(["overview", "trends"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={only === v} onClick={() => { haptics.tap(); setOnly(v); }} className={`chip flex-1 ${only === v ? "is-on" : ""}`}>
                  {t(v === "overview" ? "overviewCards.calendar" : "overviewCards.chart")}
                </button>
              ))}
            </div>
          )}
          {/* All islands, or one. */}
          <div className="-mx-4 mb-3 flex shrink-0 gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide" role="tablist" aria-label={t("map.filterAria")}>
            {[null, ...islands.filter((i) => i.trackerIds.length > 0).map((i) => i.id)].map((id) => {
              const on = onlyIsland === id;
              const isl = id ? islands.find((i) => i.id === id) : undefined;
              return (
                <button key={id ?? "all"} type="button" role="tab" aria-selected={on} onClick={() => { haptics.tap(); setOnlyIsland(id); }}
                  className={`chip ${isl ? "has-icon" : ""} ${on ? "is-on" : ""}`}>
                  {isl && <img src={mapPic("icon_" + isl.def.icon)} alt="" width={28} height={28} />}
                  {isl ? islandName(t, isl.id) : t("map.allIslands")}
                </button>
              );
            })}
          </div>
          {only && (
            <PatternsTab key={`${only}-${onlyIsland ?? "all"}-${onlyIds?.join() ?? ""}`} only={only}
              focusIds={onlyIds ?? (onlyIsland ? islands.find((i) => i.id === onlyIsland)?.trackerIds : undefined)}
              onTry={(x) => { setOnly(null); window.setTimeout(() => setTrying(x), 250); }} />
          )}
        </div>
      </BottomSheet>
      <LinkSheet route={link} trackers={trackers} days={dayCount} onClose={() => setLink(null)}
        onChart={(ids) => { setLink(null); setOnlyIsland(null); setOnlyIds(ids); window.setTimeout(() => setOnly("trends"), 250); }} />
      {helpsResult && (
        <ExperimentSheet mode="result" experiment={helpsResult} trackers={trackers} entries={entries} onClose={() => setHelpsResult(null)} />
      )}
      {testFor && (
        <ExperimentSheet mode="pick" island={testFor} trackers={trackers} entries={entries} onClose={() => setTestFor(null)} />
      )}
      {trying && (
        <ExperimentSheet mode="pick" island={trying.island} plan={trying.plan} from={{ trackerId: trying.trackerId, k: trying.k }}
          trackers={trackers} entries={entries} onClose={() => { setTrying(null); window.setTimeout(() => setOnly("signals"), 150); }} />
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
