// The Map tab (Aurora UX; Nov 1 2026, made clear Nov 2 after her note:
// "накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). A calm flat map of her islands with a legend for the weather
// signs; tap an island for its stats first, then its Findings / Calendar /
// Charts / Limits (the old Patterns, just for that island). "World" shows
// the same for everything. One view only: the rolling globe is gone (her
// note, Nov 2: two ways into the map were confusing).
import { TipCard, tipSeen, tourCompleted } from "./Tips";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus } from "lucide-react";
import { art, artOf, stageOf, toNextStage } from "@/lib/globeArt";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { firstLinkState } from "@/lib/firstLink";
import { growSeen } from "@/lib/growMoment";
import { grewToday } from "@/lib/globeArt";
import { buildIslands, buildRoutes, IslandId, islandName, isOwnIsland, linkWorthShowing, LINKS_TOP, mapPic, type Route } from "@/lib/islands";
import { computeCorrelations } from "@/lib/correlations";
import { currentExperiment, experimentOver, runningExperiments, type Experiment } from "@/lib/experiments";
import { getDoorState } from "@/lib/doors";
import { getOwnIslands, MAX_OWN } from "@/lib/ownIslands";
import { isoLocal } from "@/lib/doors";
import { litTrackers } from "@/lib/lighthouses";
import { getNotes } from "@/lib/notes";
import { ITEMS, gardenTrees, growthOf, islandDays, owned, placeTreasures, syncTreasures, worldFacts, type ItemId } from "@/lib/growth";
import { ExperimentSheet } from "./ExperimentSheet";
import { WhatHelps, type TryAction } from "./ActionPoints";
import { avatarDeclined, avatarUrl, getAvatar } from "@/lib/avatar";
import { islandOf } from "@/lib/islands";
import { haptics } from "@/lib/haptics";
import { PlanetMap } from "./PlanetMap";
import { LinkSheet } from "./LinkSheet";
import { PlanetGlobe } from "./PlanetGlobe";
import { AnswerNow, GrowthLadder, IslandMore, IslandTreasures, IslandWeek, type IslandView } from "./IslandStats";
import { IslandAsOnGlobe } from "./IslandAsOnGlobe";
import { PatternsTab } from "./PatternsTab";
import { reopenLink } from "./FindingsView";
import { ChevronLeft } from "lucide-react";
import { IslandEditor } from "./IslandEditor";
import { NewIslandSheet } from "./NewIslandSheet";
import { ThingSheet } from "./ThingSheet";
import { DaysOverview } from "./DaysOverview";
import { SteadyCard } from "./SteadyCard";
import { IslandQuestions } from "./IslandQuestions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { track } from "@/lib/analytics";
import { markGlowSeen } from "@/lib/glowHints";
import { usePlayful } from "@/lib/playful";

/** "linkchart": a link's own chart, opened from the link, shown in Links (not in My Days; her note, Nov 12 2026) */
type Only = "overview" | "trends" | "signals" | "findings" | "linkchart";
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
    // a link's "See the days": both questions on the chart (QA: it opened one question's calendar under "Links");
    // back (or closing the chart) returns to that link in the list (her note, Nov 10 2026)
    const linkDays = (e: Event) => { const ids = (e as CustomEvent).detail as string[]; if (!ids?.length) return; backTo.current = { links: ids }; setOnlyIsland(null); setOnlyIds(ids); setOnly("linkchart"); };
    window.addEventListener("memap-link-days", linkDays);
    return () => { window.removeEventListener("memap-set-map-view", set); window.removeEventListener("memap-link-days", linkDays); };
  }, []);
  // Calendar / chart / lighthouses straight away, no tabs inside (her note).
  const [only, setOnly] = useState<Only | null>(initialOpen && initialOpen !== "all" ? initialOpen : null);
  // Which island the calendar / chart / action points show (null: all).
  const [onlyIsland, setOnlyIsland] = useState<IslandId | null>(null);
  // a link's card (from its route), and the two questions it shows on the chart
  const [link, setLinkRaw] = useState<Route | null>(null);
  const setLink = (r: Route | null) => { if (r) track("link_opened", { next_day: r.nextDay }); setLinkRaw(r); };
  const [onlyIds, setOnlyIds] = useState<string[] | null>(null);
  // The link a chart was opened from ("See the days"): from the Links list or from a link's own sheet. Back, or
  // closing the chart, goes to that link again (her note, Nov 10 2026: "когда перешла по ссылке посмотреть график,
  // то обратно уже не смогла выйти на эту связь").
  const backTo = useRef<{ links?: string[]; route?: Route } | null>(null);
  const backToLink = () => {
    const b = backTo.current;
    backTo.current = null;
    if (!b) return false;
    if (b.links) { reopenLink(b.links); setOnlyIds(null); setOnly("findings"); return true; }
    if (b.route) { const r = b.route; setOnly(null); setOnlyIds(null); window.setTimeout(() => setLink(r), 250); return true; }
    return false;
  };
  // "+ New island": topics first, then their questions; or her own.
  const [newOpen, setNewOpen] = useState(false);
  // A sheet opened from elsewhere (a step on Today): closing it goes back there.
  const fromOutside = useRef(false);
  useEffect(() => {
    if (!initialOpen) return;
    // her week and treasures live in You now; its close takes her back (Index)
    if (initialOpen === "all") window.dispatchEvent(new CustomEvent("memap-open-you", { detail: { trip: true } }));
    else { fromOutside.current = true; backTo.current = null; setOnlyIsland(null); setOnlyIds(null); setOnly(initialOpen); }
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
  // the first link moment's "See" (and a link under an island): the link in Links, open, with its "What comes
  // first?" (her note, Nov 12 2026: from the moment only charts could be reached, the question only from the map)
  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail as { a: string; b: string } | undefined;
      if (!d) return;
      setOpenRaw(null);
      const r = routes.find((x) => (x.a === d.a && x.b === d.b) || (x.a === d.b && x.b === d.a));
      if (!r) return;
      reopenLink([r.first, r.second]);
      window.setTimeout(() => { setOnlyIds(null); setOnly("findings"); }, 200);
    };
    window.addEventListener("memap-open-link", open);
    return () => window.removeEventListener("memap-open-link", open);
  }, [routes]);
  // the globe's own link sheet, as a tap on its dotted route opens it (the tests open it by this event)
  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail as { a: string; b: string } | undefined;
      const r = d && routes.find((x) => (x.a === d.a && x.b === d.b) || (x.a === d.b && x.b === d.a));
      if (r) { setOpenRaw(null); window.setTimeout(() => setLink(r), 200); }
    };
    window.addEventListener("memap-open-link-sheet", open);
    return () => window.removeEventListener("memap-open-link-sheet", open);
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
  // words typed in "Why?" are kept as notes but aren't a note written: not counted (Nov 10 2026)
  useEffect(() => { getNotes().then((n) => setNotesCount(n.filter((x) => !x.reasonFor).length)).catch(() => undefined); }, []);
  const growth = useMemo(() => {
    const days = islandDays(trackers, entries);
    return Object.fromEntries(islands.map((i) => [i.id, growthOf(i.id, days.get(i.id) ?? 0)]));
  }, [islands, trackers, entries]);
  // evenings answered on each island: her own islands grow on the globe
  const dayCount = useMemo(() => Object.fromEntries(islandDays(trackers, entries)) as Record<string, number>, [trackers, entries]);
  const facts = useMemo(() => worldFacts(trackers, entries, islands, routes, notesCount), [trackers, entries, islands, routes, notesCount]);
  // her treasures, each on its island, on the Map and the Globe alike (Nov 5 2026)
  // none with "Games and rewards" off (Nov 9 2026)
  const playful = usePlayful();
  const treasures = useMemo(() => (loaded && playful ? placeTreasures({ islands: islands.map((i) => i.id), days: dayCount, facts, routes, trackers }) : new Map()),
    [loaded, playful, islands, dayCount, facts, routes, trackers]);
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
  const linkCount = useMemo(() => computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing).length, [trackers, entries]);
  // What helps opens its own sheet (Nov 8 2026: it opened a test's island, and an empty "Week summary"
  // when that island wasn't there)
  const [helpsOpen, setHelpsOpen] = useState(false);
  // a test's push opens its own card (Nov 12 2026)
  const [helpsFocus, setHelpsFocus] = useState<string | null>(null);
  // a part opened from anywhere stops glowing (glowHints.ts)
  useEffect(() => { if (only) markGlowSeen(only === "trends" ? "overview" : only === "linkchart" ? "findings" : only); }, [only]);
  useEffect(() => { if (helpsOpen) markGlowSeen("helps"); }, [helpsOpen]);
  const onHelps = () => setHelpsOpen(true);
  // "See" under a done task (Nov 10 2026): from When to act straight to What helps, where it is now kept
  useEffect(() => {
    const go = (e: Event) => { backTo.current = null; setOnly(null); setOnlyIds(null); setHelpsFocus((e as CustomEvent).detail?.id ?? null); window.setTimeout(() => setHelpsOpen(true), 250); };
    window.addEventListener("memap-open-helps", go);
    return () => window.removeEventListener("memap-open-helps", go);
  }, []);
  // "What to try" under a link (LinkTry, Nov 13 2026): the try picker on that island; closing it goes back to that
  // link, open, where a started try now shows
  const [linkTry, setLinkTry] = useState<{ island: IslandId; link: string; ids: string[] } | null>(null);
  useEffect(() => {
    const go = (e: Event) => {
      const d = (e as CustomEvent).detail as { island: IslandId; link: string; ids: string[] } | undefined;
      if (!d) return;
      backTo.current = null; setLinkRaw(null); setOnly(null); setOnlyIds(null);
      window.setTimeout(() => setLinkTry(d), 250);
    };
    window.addEventListener("memap-link-try", go);
    return () => window.removeEventListener("memap-link-try", go);
  }, []);
  // the page of one thing, opened from its question on an island; its rows open their own places, and closing them
  // or it leads back (island → thing → place)
  const [thing, setThing] = useState<string | null>(null);
  useEffect(() => {
    const go = (e: Event) => { const id = (e as CustomEvent).detail?.id as string | undefined; if (!id) return; setOpenRaw(null); window.setTimeout(() => setThing(id), 250); };
    window.addEventListener("memap-open-thing", go);
    return () => window.removeEventListener("memap-open-thing", go);
  }, []);
  const fromThing = (f: () => void) => { setThing(null); window.setTimeout(f, 250); };
  // "Share" on the World: the PDF report or the picture (both moved here from the avatar, Nov 13 2026)
  const [shareOpen, setShareOpen] = useState(false);
  const shareGo = (name: string, detail?: unknown) => { haptics.tap(); setShareOpen(false); window.setTimeout(() => window.dispatchEvent(new CustomEvent(name, { detail })), 280); };
  const pickTest = () => {
    const first = mainIsland && islands.some((i) => i.id === mainIsland) ? mainIsland : islands.find((i) => i.trackerIds.length > 0)?.id;
    if (first) setTestFor(first);
  };
  // no tour walked (variant C, or skipped): the World says once what it is; the globe's "turn me" line waits for it
  const [worldTip, setWorldTip] = useState(() => !tourCompleted() && !tipSeen("block:world"));
  const onlyTitle = (o: Only) => t(o === "findings" || o === "linkchart" ? "world4.links" : o === "signals" ? "world4.whenToAct" : "world4.myDays");

  return (
    <div ref={boxRef} className="map-sea relative flex h-full flex-col overflow-hidden overscroll-contain" style={{ background: "transparent" }}>
      {/* The header stays at the top (her note): the name, this week's
          summary, and a small Map | Globe switch. */}
      {/* Globe only (her note, Nov 7 2026, v81 try; the flat map, PlanetMap.tsx, stays in
          the code to go back to): the header, the World's 4 parts on top, and her globe in
          the room under them with everything the map had — her topic's island lit, the
          links inside one island, a new island at hand, zoom by hand. */}
      <div className="map-head relative z-[6] px-4 pb-2.5 pt-3" style={{ background: "transparent" }}>
        <h2 className="min-w-0 truncate text-[26px] font-bold leading-tight tracking-tight">{t("map.title")}</h2>
      </div>
      {loaded && islands.length > 0 && (
        <div className="relative z-[6] mt-1">
          <DaysOverview trackers={trackers} entries={entries} links={linkCount} onHelps={onHelps} onOpen={(v) => { backTo.current = null; setOnlyIsland(null); setOnly(v); }} />
          {worldTip && <TipCard id="block:world" onClose={() => setWorldTip(false)} className="mx-4 mt-2 !bg-background shadow-[0_14px_30px_-12px_rgba(16,42,56,0.35)]" title={t("tour.world.title")} line={t("tour.world.line")} />}
        </div>
      )}
      {/* the k/n signs of links inside one island are off on the globe: they sat on the
          islands (her note, Nov 7 2026); those links are in Links */}
      {loaded && islands.length > 0 && (
        <div className="absolute inset-0 z-0" data-tour="world">
          <PlanetGlobe sky={false} below quietHint={worldTip} islands={islands} routes={routes} avatar={avatarPic} lit={lit} main={mainIsland} days={dayCount} treasures={treasures} garden={garden} onOpen={setOpen}
            onLink={(a, b) => setLink(routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) ?? null)}
            paused={!!open || !!only || newOpen || !!editor || !!testFor || !!trying || !!linkTry || !!link} onNewIsland={() => setNewOpen(true)} onShare={() => setShareOpen(true)} />
        </div>
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
      <BottomSheet open={helpsOpen} onOpenChange={(o) => { if (!o) setHelpsOpen(false); }} className="h-auto max-h-[88vh]" ariaTitle={t("world4.whatHelps")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <h2 className="pb-3 pr-10 pt-1 text-[24px] font-bold tracking-tight">{t("world4.whatHelps")}</h2>
          {!tourCompleted() && <TipCard id="block:helps" className="mb-3" title={t("world4.whatHelps")} line={t("tour.helps.line")} />}
          <WhatHelps trackers={trackers} entries={entries} focusId={helpsFocus} onFocused={() => setHelpsFocus(null)}
            onResult={(x) => { setHelpsOpen(false); window.setTimeout(() => setHelpsResult(x), 250); }}
            onPick={() => { setHelpsOpen(false); window.setTimeout(pickTest, 250); }} />
        </div>
      </BottomSheet>
      {/* an island's sheet only when the island is there (never an empty one) */}
      <BottomSheet open={!!island && loaded} onOpenChange={(o) => { if (!o) { setOpen(null); tripDone(); } }} className="h-[88vh]" ariaTitle={island ? islandName(t, island.id) : t("map.summary")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex items-center gap-3 pb-3 pr-10 pt-1">
            {/* the island as it stands now, and how far its next stage is (WORLD-BIBLE, "Рост острова") */}
            {island ? (
              // the island exactly as on the globe, with its treasures (Nov 11 2026)
              <IslandAsOnGlobe island={island.id} days={dayCount[island.id] ?? 0} className="w-[76px] shrink-0"
                treasures={treasures.get(island.id)} garden={garden.get(island.id)} lit={lit.has(island.id)} />
            ) : <img src={mapPic("icon_growth")} alt="" className="h-12 w-12" />}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[24px] font-bold tracking-tight">{island ? islandName(t, island.id) : t("map.summary")}</h2>
              {island && (() => { const n = dayCount[island.id] ?? 0, left = toNextStage(n); return (
                <p className="text-[15px] font-semibold leading-snug text-muted-foreground">{left === null ? t("path.stageFull", { stage: t(`path.stage${stageOf(n)}`) }) : t("path.stageLine", { stage: t(`path.stage${stageOf(n)}`), count: left })}</p>
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
              <GrowthLadder island={island.id} days={dayCount[island.id] ?? 0}
                real={{ treasures: treasures.get(island.id), garden: garden.get(island.id), lit: lit.has(island.id) }} />
              {playful && <IslandTreasures placed={treasures.get(island.id)} facts={facts}
                onAll={() => { setOpen(null); window.setTimeout(() => window.dispatchEvent(new CustomEvent("memap-open-you")), 260); }} />}
              {island.trackerIds.length > 0 && <IslandWeek island={island} trackers={trackers} />}
              <div className="mb-1 mt-2"><AnswerNow island={island} trackers={trackers} entries={entries} /></div>
              <IslandQuestions key={island.id} island={island} islands={islands} trackers={trackers} />
              {island.trackerIds.length > 0 && (
                <IslandMore island={island} routes={routes} trackers={trackers} growth={growth[island.id] ?? []} islands={islands} entries={entries}
                  days={islandDays(trackers, entries).get(island.id) ?? 0}
                  onTest={() => { const id = island.id; fromOutside.current = false; setOpen(null); window.setTimeout(() => setTestFor(id), 250); }}
                  onView={(v: IslandView) => { const id = island.id; setOpen(null); window.setTimeout(() => { backTo.current = null; setOnlyIsland(id); setOnly(v); }, 250); }} />
              )}
            </>
          ) : null}
        </div>
      </BottomSheet>
      {/* Calendar / chart / lighthouses for everything, straight away. */}
      <BottomSheet open={!!only} onOpenChange={(o) => { if (!o) { if ((only === "overview" || only === "trends" || only === "linkchart") && backToLink()) return; backTo.current = null; setOnly(null); setOnlyIds(null); tripDone(); } }} className="h-[88vh]"
        ariaTitle={only ? onlyTitle(only) : ""}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          {backTo.current && (only === "overview" || only === "trends" || only === "linkchart") && (
            <button type="button" data-back-to-link onClick={() => { haptics.tap(); backToLink(); }}
              className="-ml-1 mb-1 flex h-10 items-center gap-1 self-start pr-3 text-[16px] font-bold text-[hsl(var(--coin-teal))]">
              <ChevronLeft className="h-5 w-5" strokeWidth={2.6} />{t("map.backToLink")}
            </button>
          )}
          {/* tighter top (her note, Nov 10 2026: the calendar didn't fit in My days) */}
          <h2 className="pb-1.5 pr-10 text-[24px] font-bold tracking-tight">{only && onlyTitle(only)}</h2>
          {only && only !== "linkchart" && !tourCompleted() && (
            <TipCard id={`block:${only === "trends" ? "overview" : only}`} className="mb-3" title={null}
              line={t(only === "findings" ? "tips.inLinks" : only === "signals" ? "tour.actions.line" : "tips.inMonth")} />
          )}
          {/* My days holds both the calendar and the chart (her note, Nov 6 2026) */}
          {(only === "overview" || only === "trends") && (
            <div className="seg mb-2 w-full" role="tablist" aria-label={t("world4.myDays")}>
              {(["overview", "trends"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={only === v} onClick={() => { haptics.tap(); setOnly(v); }} className={`chip flex-1 ${only === v ? "is-on" : ""}`}>
                  {t(v === "overview" ? "overviewCards.calendar" : "overviewCards.chart")}
                </button>
              ))}
            </div>
          )}
          {/* All islands, or one (not over a link's own chart). */}
          <div className={`-mx-4 mb-2 shrink-0 gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide ${only === "linkchart" ? "hidden" : "flex"}`} role="tablist" aria-label={t("map.filterAria")}>
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
          {/* a thought she tracks: steady, or depends on the day? (board 64) */}
          {only === "findings" && !onlyIsland && <SteadyCard trackers={trackers} entries={entries} />}
          {only && (
            <PatternsTab key={`${only}-${onlyIsland ?? "all"}-${onlyIds?.join() ?? ""}`} only={only === "linkchart" ? "trends" : only} pair={!!onlyIds}
              focusIds={onlyIds ?? (onlyIsland ? islands.find((i) => i.id === onlyIsland)?.trackerIds : undefined)}
              onTry={(x) => { backTo.current = null; setOnly(null); window.setTimeout(() => setTrying(x), 250); }} />
          )}
        </div>
      </BottomSheet>
      <BottomSheet open={shareOpen} onOpenChange={(o) => { if (!o) setShareOpen(false); }} className="h-auto" ariaTitle={t("map.share")}>
        <div data-share-sheet className="flex flex-col gap-2.5 px-4 pb-10">
          <h2 className="pb-1 pr-10 pt-1 text-[24px] font-bold tracking-tight">{t("map.share")}</h2>
          <button type="button" data-share="report" onClick={() => shareGo("memap-doctor-report")} className="surface flex min-h-[64px] w-full flex-col justify-center rounded-[20px] px-4 py-3 text-left active:scale-[0.99]">
            <span className="text-[17px] font-bold leading-snug">{t("map.shareReport")}</span>
            <span className="text-[14px] font-semibold text-muted-foreground">{t("map.shareReportLine")}</span>
          </button>
          <button type="button" data-share="picture" onClick={() => shareGo("memap-share-world", { from: "you" })} className="surface flex min-h-[64px] w-full flex-col justify-center rounded-[20px] px-4 py-3 text-left active:scale-[0.99]">
            <span className="text-[17px] font-bold leading-snug">{t("map.sharePicture")}</span>
            <span className="text-[14px] font-semibold text-muted-foreground">{t("map.sharePictureLine")}</span>
          </button>
        </div>
      </BottomSheet>
      <ThingSheet tracker={thing ? trackers.find((x) => x.id === thing) ?? null : null} trackers={trackers} entries={entries}
        onClose={() => { const tr = trackers.find((x) => x.id === thing); setThing(null); if (tr) window.setTimeout(() => setOpen(islandOf(tr)), 250); }}
        onDays={(id) => fromThing(() => { backTo.current = null; setOnlyIsland(null); setOnlyIds([id]); setOnly("overview"); })}
        onLinks={(id, pair) => fromThing(() => { backTo.current = null; if (pair) reopenLink(pair); setOnlyIsland(null); setOnlyIds([id]); setOnly("findings"); })}
        onAct={() => fromThing(() => { backTo.current = null; setOnlyIsland(null); setOnlyIds(null); setOnly("signals"); })}
        onTry={(isl) => fromThing(() => setTestFor(isl))} />
      <LinkSheet route={link} trackers={trackers} entries={entries} days={dayCount} onClose={() => setLink(null)}
        onChart={(ids) => { if (link) backTo.current = { route: link }; setLink(null); setOnlyIsland(null); setOnlyIds(ids); window.setTimeout(() => setOnly("linkchart"), 250); }} />
      {helpsResult && (
        <ExperimentSheet mode="result" experiment={helpsResult} trackers={trackers} entries={entries} onClose={() => setHelpsResult(null)} />
      )}
      {testFor && (
        <ExperimentSheet mode="pick" island={testFor} trackers={trackers} entries={entries} onClose={() => setTestFor(null)} />
      )}
      {linkTry && (
        <ExperimentSheet mode="pick" island={linkTry.island} link={linkTry.link} trackers={trackers} entries={entries}
          onClose={() => { const ids = linkTry.ids; setLinkTry(null); reopenLink(ids); window.setTimeout(() => setOnly("findings"), 150); }} />
      )}
      {trying && (
        <ExperimentSheet mode="pick" island={trying.island} plan={trying.plan} from={{ trackerId: trying.trackerId, k: trying.k }}
          trackers={trackers} entries={entries} onClose={() => { const started = runningExperiments().find((x) => x.from === trying.trackerId); setTrying(null); window.setTimeout(() => { if (started) { setHelpsFocus(started.id); setHelpsOpen(true); } else setOnly("signals"); }, 150); }} />
      )}
      {newOpen && (
        <NewIslandSheet islands={islands} trackers={trackers} canOwn={canMake} onClose={() => setNewOpen(false)}
          onMakeOwn={() => { setNewOpen(false); setEditor({ id: null }); }}
          onCreated={(id) => { setNewOpen(false); setOpen(id); }} />
      )}
      {editor && (
        <IslandEditor editId={editor.id} days={editor.id ? dayCount[editor.id] ?? 0 : 0} islands={islands} onClose={() => setEditor(null)}
          onOpenIsland={(id) => { setEditor(null); setOpen(id); }} />
      )}
    </div>
  );
};
