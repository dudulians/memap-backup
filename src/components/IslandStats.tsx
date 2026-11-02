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
import { GROWTH_AT, ITEMS, growthLand, itemEarned, itemProgress, type GrowthKind, type WorldFacts } from "@/lib/growth";
import { currentExperiment, experimentDay, EXPERIMENT_DAYS } from "@/lib/experiments";
import { IslandPicture } from "@/components/IslandPicture";
import { haptics } from "@/lib/haptics";

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

export const IslandStats = ({ island, routes, trackers, growth = [], days = 0, onTest }: {
  island: Island; routes: Route[]; trackers: Tracker[];
  growth?: GrowthKind[]; days?: number; onTest?: () => void;
}) => {
  const { t } = useTranslation();
  const title = useTitles(trackers);
  const mine = routes.filter((r) => r.a === island.id || r.b === island.id).slice(0, 2);
  // What grows next on this island, by days answered.
  const next = (["house", "flowers", "flag"] as const).find((k) => !growth.includes(k));
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
              <img src={mapPic(growthPic(k))} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
              {t(`growth.${k}`)}
            </p>
          ))}
          {next && <p className="mt-1.5 text-[14px] font-medium text-muted-foreground">{t(`growth.next.${next}`, { count: Math.max(1, GROWTH_AT[next] - days) })}</p>}
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
