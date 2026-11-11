// Stats first (Aurora, plan §3.5; her ask: "при нажатии на остров
// отражалась статистика, плюс общая статистика мира"). Every number has its
// words next to it; nothing floats. Island: this week's weather and how it
// compares with her usual, hard days, days answered, what came up most, its
// links. World: days, streak, chests, each island's week, strongest links.
// Nov 2 2026 (her progress ideas): the world shows her special items as a
// shelf (earned in colour, the rest with how far along).
// Nov 3 2026 (her notes: "куча всего, дублируется", "flowers 7 days here —
// непонятно", "often · as usual — что это?"): the island says its week in
// one plain sentence; Calendar / Chart / Action points open the Map's own
// sheets filtered to it; growth is one line.
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { islandName, mapPic, mapPicFor, type Island, type IslandId, type Route } from "@/lib/islands";
import { linkCount, linkHead, trackerLookup, type TrackerOf } from "@/lib/linkText";
import { LADDER_WIDTH, STAGE_AT, art, artOf, stageOf } from "@/lib/globeArt";
import { islandHsl } from "@/lib/islandColors";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { countedDays, getChests } from "@/lib/pathSteps";
import { eveningStreak } from "@/lib/eveningPath";
import { BarChart3, CalendarDays, FlaskConical, ChevronRight } from "lucide-react";
import { GROWTH_AT, ITEMS, growthLand, homeWord, itemProgress, keptTreasures, markTreasuresSeen, owned, unseenTreasures, type GrowthKind, type ItemId, type PlacedTreasure, type WorldFacts } from "@/lib/growth";
import { playSparkle } from "@/lib/feedback";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { experimentDay, EXPERIMENT_DAYS, runningExperiments } from "@/lib/experiments";
import { testNameOf } from "@/lib/testWords";
import { answerPhrase, cap, templateIdOf } from "@/lib/answerPhrases";
import { haptics } from "@/lib/haptics";
import { isoLocal } from "@/lib/doors";
import { last7Range } from "@/lib/weekRange";
import { isPlayful, usePlayful } from "@/lib/playful";

const WEATHER_PIC = { storm: "thunder_cloud", clouds: "partly_cloudy", sun: "sun" } as const;

const Tile = ({ n, label }: { n: number | string; label: string }) => (
  <div className="surface flex-1 rounded-[20px] px-4 py-3">
    <p className="text-[28px] font-bold leading-none tabular-nums">{n}</p>
    <p className="mt-1.5 text-[14px] font-semibold leading-tight text-muted-foreground">{label}</p>
  </div>
);

const useTitles = (trackers: Tracker[]) => (id: string) => {
  const tr = trackers.find((x) => x.id === id);
  return tr ? localizeTrackerTitle(tr.title) : "";
};

const LinkLine = ({ r, of }: { r: Route; of: TrackerOf }) => {
  const { t } = useTranslation();
  return (
    // it looks like a card, so it opens the link's own card (QA, Nov 8 2026: the tiles didn't open)
    <button type="button" onClick={() => { haptics.tap(); window.dispatchEvent(new CustomEvent("memap-open-link", { detail: { a: r.a, b: r.b } })); }}
      className="surface flex w-full items-center gap-2 rounded-[20px] px-4 py-3 text-left active:scale-[0.99] transition-transform">
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug">{linkHead(t, r, of)}</span>
        <span className="mt-0.5 block text-[14px] font-medium text-muted-foreground">{linkCount(t, r)}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
    </button>
  );
};

/** Her questions here that wait for today's answer, and where they are on Today. */
export const AnswerNow = ({ island, trackers, entries }: { island: Island; trackers: Tracker[]; entries: TrackerEntry[] }) => {
  const { t } = useTranslation();
  const today = isoLocal(new Date());
  const done = new Set(entries.filter((e) => e.date === today).map((e) => e.trackerId));
  const ids = island.trackerIds.filter((id) => trackers.some((tr) => tr.id === id && !tr.archived) && !done.has(id));
  if (ids.length === 0) return null;
  const name = islandName(t, island.id);
  return (
    <div className="surface rounded-[20px] px-4 py-3.5">
      <p className="text-[17px] font-bold leading-snug">{t("islands.answerTitle", { count: ids.length })}</p>
      <p className="mt-0.5 text-[14px] font-medium leading-snug text-muted-foreground">{t("islands.answerWhere", { name })}</p>
      <button type="button" onClick={() => { haptics.medium(); window.dispatchEvent(new CustomEvent("memap-answer-now", { detail: { ids, title: name, island: island.id } })); }}
        className="raised-btn is-small mt-3 w-full justify-center">
        {t("islands.answerNow")}
      </button>
    </div>
  );
};

/** All four stages of an island in a row, so she sees what it grows into
 *  (her note, Nov 5 2026: "надо обязательно показать, как будет выглядеть,
 *  когда его разовьют полностью"). Passed and now in full colour, the one now
 *  ringed, the ones ahead pale, each with the evening it opens at. */
export const GrowthLadder = ({ island, days }: { island: IslandId; days: number }) => {
  const { t } = useTranslation();
  const now = stageOf(days);
  return (
    <div className="surface mb-3 grid grid-cols-4 gap-1.5 rounded-[20px] px-2 pb-2.5 pt-2.5" aria-label={t(`path.stage${now}`)}>
      {([1, 2, 3, 4] as const).map((s) => {
        const name = artOf(island, STAGE_AT[s - 1]), ahead = s > now;
        return (
          <div key={s} className="flex flex-col items-center text-center">
            <span className={cn("relative block w-full rounded-[14px] px-1 py-1.5", s === now && "surface pick-on", ahead && "opacity-50 saturate-50")}>
              {/* each stage a step bigger, standing on the same line */}
              <span className="flex h-[50px] items-end justify-center">
                <img aria-hidden="true" className="art-day block max-h-full object-contain" style={{ width: `${LADDER_WIDTH[s]}%` }} src={art(name, false)} alt="" />
                <img aria-hidden="true" className="art-night block max-h-full object-contain" style={{ width: `${LADDER_WIDTH[s]}%` }} src={art(name, true)} alt="" />
              </span>
              {s === 4 && <img aria-hidden="true" className="absolute left-[22%] top-[4%] w-[15%]" src={mapPicFor("marker_flag", false)} alt="" />}
            </span>
            <span className={cn("mt-1 text-[12px] font-bold leading-tight", ahead && "text-muted-foreground")}>{t(`path.stage${s}`)}</span>
            <span className="text-[11px] font-semibold leading-tight text-muted-foreground">{s === 1 ? t("path.ladderStart") : t("path.ladderAt", { count: STAGE_AT[s - 1] })}</span>
          </div>
        );
      })}
    </div>
  );
};

/** This week on an island, in one plain sentence, and why its weather is
 *  what it is (her ask via the GPT review, Nov 5 2026): the rule in a line,
 *  then the questions whose answers made the hard days. */
export const IslandWeek = ({ island, trackers }: { island: Island; trackers: Tracker[] }) => {
  const { t, i18n } = useTranslation();
  const title = useTitles(trackers);
  const early = island.answeredDays < 3;
  const line = early
    ? t("isle.early")
    : t("isle.hardWeek", { count: island.weekHard, n: island.weekAnswered, range: last7Range(i18n.language ?? "en") });
  return (
    <div className="px-1 pb-1">
      {/* "too early" sits in its own card, not between two (QA, Nov 8 2026) */}
      <div className={cn("flex items-center gap-3", early && "surface rounded-[18px] px-4 py-3")}>
        {island.weather && !early && (
          <img src={mapPic(WEATHER_PIC[island.weather])} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
        )}
        <p className="text-[17px] font-semibold leading-snug">{line}</p>
      </div>
      {island.weather && !early && (
        <div className="surface mt-2.5 rounded-[18px] px-4 py-3">
          <p className="text-[15px] font-bold leading-snug">{t(`isle.why.${island.weather}`)}</p>
          {/* the hard answer in words, "No compliment from partner · 5 days" (her note, Nov 11 2026: the question's
              name and "No" in quotes read like a form); her own question keeps its name and the answer */}
          {island.hardBy.slice(0, 3).map((h) => {
            const tr = trackers.find((x) => x.id === h.trackerId);
            const words = !!tr && (!!templateIdOf(tr) || !!(tr.problemWhen === "yes" ? tr.words?.yes : tr.words?.no));
            return (
              <p key={h.trackerId} data-hard-row className="mt-1.5 flex items-center gap-2 text-[15px] font-medium leading-snug">
                <span className="min-w-0 flex-1 leading-snug">{words ? cap(answerPhrase(t, tr, tr!.problemWhen === "yes")) : title(h.trackerId)}</span>
                <span className="shrink-0 rounded-full bg-[hsl(var(--data-a)/0.14)] px-2 py-0.5 text-[13px] font-bold text-[hsl(var(--strong))]">
                  {words ? t("isle.days", { count: h.days }) : t("isle.ansDays", { ans: tr?.problemWhen === "yes" ? t("common.yes") : t("common.no"), count: h.days })}
                </span>
              </p>
            );
          })}
          {/* "a yes to a hard question…" only where a row still says yes / no */}
          {island.hardBy.slice(0, 3).some((h) => { const tr = trackers.find((x) => x.id === h.trackerId); return !tr || !(templateIdOf(tr) || (tr.problemWhen === "yes" ? tr.words?.yes : tr.words?.no)); }) && (
            <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground">{t("isle.hardDay")}</p>
          )}
        </div>
      )}
    </div>
  );
};

export type IslandView = "overview" | "trends" | "signals";

/** Under the questions: this island's calendar, chart and action points; its
 *  links; its test; one line on how it grows. */
export const IslandMore = ({ island, routes, trackers, growth = [], days = 0, onTest, onView, islands = [], entries = [] }: {
  island: Island; routes: Route[]; trackers: Tracker[];
  growth?: GrowthKind[]; days?: number; onTest?: () => void;
  onView: (v: IslandView) => void;
  /** for "maybe linked" (islands with no link found yet) */
  islands?: Island[]; entries?: TrackerEntry[];
}) => {
  const { t } = useTranslation();
  const title = useTitles(trackers);
  const mine = routes.filter((r) => r.a === island.id || r.b === island.id).slice(0, 2);
  // Islands it might be linked with: no link found yet, both answered.
  const linked = new Set(routes.flatMap((r) => (r.a === island.id ? [r.b] : r.b === island.id ? [r.a] : [])));
  const daysOf = (ids: string[]) => new Set(entries.filter((e) => ids.includes(e.trackerId)).map((e) => e.date));
  const here = daysOf(island.trackerIds);
  const maybe = islands
    .filter((o) => o.id !== island.id && !linked.has(o.id) && o.trackerIds.length > 0)
    .map((o) => ({ o, both: [...daysOf(o.trackerIds)].filter((d) => here.has(d)).length }))
    .filter((x) => x.both > 0)
    .sort((p, q) => q.both - p.both)
    .slice(0, 1);
  // this island's own test: tests on other islands run side by side (Nov 7 2026)
  const tests = runningExperiments().filter((x) => x.island === island.id);
  const view = (v: IslandView, icon: React.ReactNode, label: string) => (
    <button type="button" onClick={() => { haptics.tap(); onView(v); }}
      className="surface flex h-[68px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold active:scale-[0.98] transition-transform">
      {icon}{label}
    </button>
  );
  return (
    <div className="space-y-3 pb-4 pt-1">
      <div className="grid grid-cols-3 gap-2">
        {view("overview", <CalendarDays className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />, t("overviewCards.calendar"))}
        {view("trends", <BarChart3 className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />, t("overviewCards.chart"))}
        {view("signals", <img src={mapPic("lighthouse")} alt="" width={20} height={24} className="h-6 w-5 object-contain" />, t("overviewCards.lighthouses"))}
      </div>
      {(mine.length > 0 || maybe.length > 0) && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.links")}</p>
          {mine.map((r, i) => <LinkLine key={i} r={r} of={trackerLookup(trackers)} />)}
          {maybe.map(({ o, both }) => (
            <div key={o.id} className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-foreground/15 px-4 py-3">
              <img src={mapPic("icon_" + o.def.icon)} alt="" width={28} height={28} />
              <p className="min-w-0 text-[15px] font-semibold leading-snug">
                {t(both >= 21 ? "map.noLinkBetween" : "map.checkingBetween", { a: islandName(t, island.id), b: islandName(t, o.id) })}
              </p>
            </div>
          ))}
        </>
      )}
      {tests.map((x) => (
        <div key={x.id} className="surface flex items-center gap-3 rounded-[20px] px-4 py-3">
          <FlaskConical className="h-6 w-6 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />
          <div className="min-w-0">
            <p className="text-[16px] font-bold leading-snug">{testNameOf(x.change)}</p>
            <p className="text-[14px] font-medium text-muted-foreground">{experimentDay(x) > EXPERIMENT_DAYS ? t("experiment.stepSub") : t("experiment.dayOf", { k: experimentDay(x), count: EXPERIMENT_DAYS })}</p>
          </div>
        </div>
      ))}
      {onTest ? (
        <button type="button" onClick={() => { haptics.tap(); onTest(); }}
          className="surface flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left active:scale-[0.99] transition-transform">
          <FlaskConical className="h-6 w-6 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-snug">{t("experiment.here")}</span>
            <span className="block text-[14px] font-medium text-muted-foreground">{t("experiment.hereLine")}</span>
          </span>
        </button>
      ) : null}
    </div>
  );
};

/** The treasures on this island (Nov 5 2026): the ones she has, since when
 *  and for what; the next one to come, pale, with how far along it is. */
export const IslandTreasures = ({ placed, facts, onAll }: { placed?: PlacedTreasure[]; facts: WorldFacts; onAll: () => void }) => {
  const { t, i18n } = useTranslation();
  if (!placed?.length) return null;
  const kept = keptTreasures();
  const when = (iso?: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString(i18n.language, { day: "numeric", month: "long" }) : "");
  return (
    <div className="surface rounded-[20px] px-4 py-3.5">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("items.here")}</p>
      {placed.map((p) => {
        const [k, n] = itemProgress(p.id, facts);
        return (
          <div key={p.id} className="mt-2.5 flex items-center gap-3">
            <img src={mapPic(p.pic)} alt="" width={48} height={48} className={cn("h-12 w-12 shrink-0 object-contain", p.ghost && "opacity-40 grayscale")} />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[17px] font-bold leading-snug">
                {t(`items.${p.id}.name`)}
                {p.ghost && <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[12px] font-bold text-muted-foreground">{t("items.next")}</span>}
              </span>
              <span className="block text-[14px] font-medium leading-snug text-muted-foreground">
                {p.ghost ? t("items.toGet", { how: t(`items.${p.id}.how`), k, count: n }) : kept[p.id] && kept[p.id] !== "-" ? t("items.got", { how: t(`items.${p.id}.how`), date: when(kept[p.id]) }) : t(`items.${p.id}.how`)}
              </span>
            </span>
          </div>
        );
      })}
      <p className="mt-3 text-[14px] font-semibold leading-snug text-muted-foreground">{t("items.restInYou", { you: t("map.you") })}</p>
      <button type="button" onClick={() => { haptics.tap(); onAll(); }} className="quiet-btn mt-2 h-11 w-full">{t("items.all")}</button>
    </div>
  );
};

export const WorldStats = ({ islands, routes, trackers, entries, facts }: { islands: Island[]; routes: Route[]; trackers: Tracker[]; entries: TrackerEntry[]; facts?: WorldFacts }) => {
  const { t } = useTranslation();
  const title = useTitles(trackers);
  const days = countedDays(trackers, entries);
  const chests = Object.keys(getChests()).length;
  // Monday to Sunday of this calendar week, and the days since the first answer
  const today = isoLocal(new Date());
  // the last 7 days, today last: the same days as the weather and the island sheets (QA re-check, Nov 9 2026)
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return isoLocal(d); });
  const { i18n } = useTranslation();
  const dayLetter = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(i18n.language?.startsWith("ru") ? "ru-RU" : "en-US", { weekday: "short" }).slice(0, 2);
  const first = entries.reduce<string | null>((m, e) => (m === null || e.date < m ? e.date : m), null);
  const withUs = first ? Math.round((Date.parse(today + "T12:00:00") - Date.parse(first + "T12:00:00")) / 86_400_000) + 1 : 0;
  // "Games and rewards" off (Nov 9 2026): no streak tile, no treasure shelf
  const playful = usePlayful();
  // a treasure that came since she last looked says "New", once
  const [fresh] = useState<ItemId[]>(() => (facts && isPlayful() ? unseenTreasures(facts) : []));
  useEffect(() => {
    if (!facts || !isPlayful()) return;
    markTreasuresSeen(facts);
    if (fresh.length) { haptics.sparkle(); playSparkle(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3 pb-4">
      <div className="flex gap-3">
        <Tile n={days.length} label={t("map.daysCounted")} />
        {playful && <Tile n={eveningStreak(days)} label={t("map.inARow")} />}
        <Tile n={chests} label={t("map.chests")} />
      </div>
      {/* Her special items: earned ones in colour, the rest with how far along. */}
      {facts && playful && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("items.shelf")}</p>
          <div className="surface grid grid-cols-3 gap-y-3 rounded-[20px] px-2 py-3">
            {ITEMS.map((it) => {
              const got = owned(it.id, facts);
              const [k, n] = itemProgress(it.id, facts);
              const isNew = fresh.includes(it.id);
              return (
                <div key={it.id} className={cn("relative flex flex-col items-center px-1 text-center", isNew && "treasure-new")}>
                  {isNew && <span className="absolute -top-1 right-1 rounded-full bg-foreground px-2 py-0.5 text-[12px] font-bold text-background">{t("items.new")}</span>}
                  <img src={mapPic(it.pic)} alt="" width={52} height={52} className={`h-[52px] w-[52px] object-contain ${got ? "" : "opacity-30 grayscale"}`} />
                  <p className={`mt-1 text-[13px] font-bold leading-tight ${got ? "" : "text-muted-foreground"}`}>{t(`items.${it.id}.name`)}</p>
                  <p className="text-[12px] font-medium leading-tight text-muted-foreground">{got ? t(`items.${it.id}.how`) : t("items.toGet", { how: t(`items.${it.id}.how`), k, count: n })}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* the calendar week, since Monday, the same "this week" as the island sheets (her note 5,
          Nov 8 2026); days are dots, coloured by meaning: hard rose, good green */}
      <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.thisCalWeek", { range: last7Range(i18n.language ?? "en") })}</p>
      {withUs > 0 && <p className="-mt-1 text-[15px] font-bold leading-snug">{t("map.withUs", { count: withUs, date: new Date(first + "T12:00:00").toLocaleDateString(i18n.language?.startsWith("ru") ? "ru-RU" : "en-US", { month: "long", day: "numeric" }) })}</p>}
      <div className="surface space-y-3 rounded-[20px] px-4 py-3.5">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="w-[30px] shrink-0" />
          <div className="flex flex-1 justify-between px-[3px]">
            {week.map((d) => <span key={d} className="w-4 text-center text-[11px] font-bold uppercase text-muted-foreground">{dayLetter(d)}</span>)}
          </div>
          <span className="w-[28px] shrink-0" />
        </div>
        {islands.map((isl) => (
          <div key={isl.id} className="flex items-center gap-3">
            <img src={mapPic("icon_" + isl.def.icon)} alt="" width={30} height={30} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold">{islandName(t, isl.id)}</span>
              <div className="mt-1 flex justify-between px-[3px]" role="img" aria-label={t("map.daysOf7", { k: isl.weekAnswered })}>
                {week.map((d) => {
                  const v = isl.weekDays?.[d];
                  return <span key={d} className="h-4 w-4 rounded-full" style={v === undefined
                    ? { border: `2px solid hsl(var(--foreground) / ${d > today ? 0.08 : 0.16})` }
                    : { background: v ? "hsl(var(--strong))" : "hsl(var(--balanced))" }} />;
                })}
              </div>
            </div>
            {isl.weather ? <img src={mapPic(WEATHER_PIC[isl.weather])} alt={t(`map.legend.${isl.weather}`)} width={28} height={28} className="object-contain" /> : <span className="w-[28px] shrink-0" />}
          </div>
        ))}
      </div>
      {routes.length > 0 && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.links")}</p>
          {routes.slice(0, 3).map((r, i) => <LinkLine key={i} r={r} of={trackerLookup(trackers)} />)}
        </>
      )}
    </div>
  );
};
