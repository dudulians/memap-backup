// Stats first (Aurora, plan §3.5; her ask: "при нажатии на остров
// отражалась статистика, плюс общая статистика мира"). Every number has its
// words next to it; nothing floats. Island: this week's weather and how it
// compares with her usual, hard days, days answered, what came up most, its
// links. World: days, streak, chests, each island's week, strongest links.
// Nov 2 2026 (her progress ideas): the island shows what has grown on it and
// why, what grows next, and its test of one change; the world shows her
// special items as a shelf (earned in colour, the rest with how far along).
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { islandName, mapPic, type Island, type Route } from "@/lib/islands";
import { islandHsl } from "@/lib/islandColors";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { countedDays, getChests } from "@/lib/pathSteps";
import { eveningStreak } from "@/lib/eveningPath";
import { FlaskConical } from "lucide-react";
import { GROWTH_AT, ITEMS, growthLand, homeWord, itemEarned, itemProgress, type GrowthKind, type WorldFacts } from "@/lib/growth";
import { currentExperiment, experimentDay, EXPERIMENT_DAYS } from "@/lib/experiments";
import { IslandPicture } from "@/components/IslandPicture";
import { haptics } from "@/lib/haptics";
import { isoLocal } from "@/lib/doors";

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

const LinkLine = ({ r, title }: { r: Route; title: (id: string) => string }) => {
  const { t } = useTranslation();
  return (
    <div className="surface rounded-[20px] px-4 py-3">
      <p className="text-[16px] font-bold leading-snug">
        {title(r.first)} → {title(r.second)}{r.nextDay ? ` ${t("map.nextDay")}` : ""}
      </p>
      <p className="mt-0.5 text-[14px] font-medium text-muted-foreground">{t("map.timesOf", { k: r.k, count: r.n })}</p>
    </div>
  );
};

/** The picture of a growth piece (the island's own landmark aside). */
const growthPic = (k: GrowthKind) => growthLand([k]).front[0]?.[0] ?? growthLand([k]).back[0]?.[0] ?? "";

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
      <button type="button" onClick={() => { haptics.medium(); window.dispatchEvent(new CustomEvent("memap-answer-now", { detail: { ids, title: name } })); }}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-[16px] font-bold text-white active:scale-[0.98] transition-transform">
        {t("islands.answerNow")}
      </button>
    </div>
  );
};

export const IslandStats = ({ island, routes, trackers, growth = [], days = 0, onTest, islands = [], entries = [] }: {
  island: Island; routes: Route[]; trackers: Tracker[];
  growth?: GrowthKind[]; days?: number; onTest?: () => void;
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
    .slice(0, 2);
  // What grows next on this island, by days answered.
  const next = (["house", "flowers", "flag"] as const).find((k) => !growth.includes(k));
  // "house" reads "tent" on an island that already has a house.
  const word = (k: GrowthKind) => (k === "house" ? homeWord(island.def.land) : k);
  const test = currentExperiment();
  return (
    <div className="space-y-3 pb-4">
      {/* What has grown here, and what grows next. */}
      <div className="surface flex items-center gap-3 rounded-[20px] px-3 py-3">
        <IslandPicture id={island.id} width={112} growth={growth} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("growth.title")}</p>
          {growth.length === 0 && <p className="mt-1 text-[15px] font-semibold leading-snug">{t("growth.nothingYet")}</p>}
          {growth.map((k) => (
            <p key={k} className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold leading-snug">
              <img src={mapPic(k === "house" && homeWord(island.def.land) === "tent" ? "camping_tent" : growthPic(k))} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
              {t(`growth.${word(k)}`)}
            </p>
          ))}
          {next && <p className="mt-1.5 text-[14px] font-medium text-muted-foreground">{t(`growth.next.${word(next)}`, { count: Math.max(1, GROWTH_AT[next] - days) })}</p>}
        </div>
      </div>
      {test && test.island === island.id ? (
        <div className="surface flex items-center gap-3 rounded-[20px] px-4 py-3">
          <FlaskConical className="h-6 w-6 shrink-0 text-[hsl(152_36%_44%)]" strokeWidth={2.2} />
          <div className="min-w-0">
            <p className="text-[16px] font-bold leading-snug">{test.change}</p>
            <p className="text-[14px] font-medium text-muted-foreground">{t("experiment.dayOf", { k: Math.min(experimentDay(test), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS })}</p>
          </div>
        </div>
      ) : !test && onTest ? (
        <button type="button" onClick={() => { haptics.tap(); onTest(); }}
          className="surface flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left active:scale-[0.99] transition-transform">
          <FlaskConical className="h-6 w-6 shrink-0 text-[hsl(152_36%_44%)]" strokeWidth={2.2} />
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-snug">{t("experiment.here")}</span>
            <span className="block text-[14px] font-medium text-muted-foreground">{t("experiment.hereLine")}</span>
          </span>
        </button>
      ) : null}
      <div className="surface flex items-center gap-3 rounded-[20px] px-4 py-3">
        {island.weather ? (
          <img src={mapPic(WEATHER_PIC[island.weather])} alt="" width={44} height={44} className="object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="text-[19px] font-bold leading-tight">{t(island.weather ? `map.legend.${island.weather}` : "map.tooEarly")}</p>
          {island.usual && <p className="text-[15px] font-medium text-muted-foreground">{t(`map.usual.${island.usual}`)}</p>}
        </div>
      </div>
      <div className="flex gap-3">
        <Tile n={island.hardDays} label={t("map.hardDays")} />
        <Tile n={`${island.answeredDays}/7`} label={t("map.answeredDays")} />
      </div>
      {island.top && (
        <div className="surface rounded-[20px] px-4 py-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.mostOften")}</p>
          <p className="mt-0.5 text-[17px] font-bold">{title(island.top.trackerId)} · {t("map.days", { count: island.top.days })}</p>
        </div>
      )}
      {mine.length > 0 && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.links")}</p>
          {mine.map((r, i) => <LinkLine key={i} r={r} title={title} />)}
          <p className="text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
        </>
      )}
      {maybe.length > 0 && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.maybeTitle")}</p>
          {maybe.map(({ o, both }) => (
            <div key={o.id} className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-foreground/15 px-4 py-3">
              <img src={mapPic("icon_" + o.def.icon)} alt="" width={30} height={30} />
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-snug">{islandName(t, island.id)} ↔ {islandName(t, o.id)}?</p>
                <p className="text-[14px] font-medium leading-snug text-muted-foreground">
                  {t(both >= 21 ? "map.noLinkYet" : "map.checking")} · {t("map.bothDays", { count: both })}
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export const WorldStats = ({ islands, routes, trackers, entries, facts }: { islands: Island[]; routes: Route[]; trackers: Tracker[]; entries: TrackerEntry[]; facts?: WorldFacts }) => {
  const { t } = useTranslation();
  const title = useTitles(trackers);
  const days = countedDays(trackers, entries);
  const chests = Object.keys(getChests()).length;
  return (
    <div className="space-y-3 pb-4">
      <div className="flex gap-3">
        <Tile n={days.length} label={t("map.daysCounted")} />
        <Tile n={eveningStreak(days)} label={t("map.inARow")} />
        <Tile n={chests} label={t("map.chests")} />
      </div>
      {/* Her special items: earned ones in colour, the rest with how far along. */}
      {facts && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("items.shelf")}</p>
          <div className="surface grid grid-cols-3 gap-y-3 rounded-[20px] px-2 py-3">
            {ITEMS.map((it) => {
              const got = itemEarned(it.id, facts);
              const [k, n] = itemProgress(it.id, facts);
              return (
                <div key={it.id} className="flex flex-col items-center px-1 text-center">
                  <img src={mapPic(it.pic)} alt="" width={52} height={52} className={`h-[52px] w-[52px] object-contain ${got ? "" : "opacity-30 grayscale"}`} />
                  <p className={`mt-1 text-[13px] font-bold leading-tight ${got ? "" : "text-muted-foreground"}`}>{t(`items.${it.id}.name`)}</p>
                  <p className="text-[12px] font-medium leading-tight text-muted-foreground">{got ? t(`items.${it.id}.how`) : `${t(`items.${it.id}.how`)} · ${k}/${n}`}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.thisWeek")}</p>
      <div className="surface space-y-3 rounded-[20px] px-4 py-3.5">
        {islands.map((isl) => (
          <div key={isl.id} className="flex items-center gap-3">
            <img src={mapPic("icon_" + isl.def.icon)} alt="" width={30} height={30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[16px] font-bold">{islandName(t, isl.id)}</span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-muted-foreground">{t("map.daysOf7", { k: isl.answeredDays })}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${(isl.answeredDays / 7) * 100}%`, background: `hsl(${islandHsl(isl.id)})` }} />
              </div>
            </div>
            {isl.weather && <img src={mapPic(WEATHER_PIC[isl.weather])} alt={t(`map.legend.${isl.weather}`)} width={28} height={28} className="object-contain" />}
          </div>
        ))}
      </div>
      {routes.length > 0 && (
        <>
          <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("map.links")}</p>
          {routes.slice(0, 3).map((r, i) => <LinkLine key={i} r={r} title={title} />)}
          <p className="text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
        </>
      )}
    </div>
  );
};
