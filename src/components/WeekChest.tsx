// A week's report (her note, Nov 4 2026: "уберём сундук, назовём это репортом
// … это не подарок, не сундук"): no chest, no drum roll; the same cards.
// Before: opening a week's chest (Aurora step 6, plan §3.4; her ask: "сундук недели
// с картой внутри"). Ready → the lid opens on "A map of your week" with
// counts from her own days → "You earned: a bridge" → "Put it on my map".
// What it showed is saved when opened and reopens as is.
// Nov 2 2026 (her: "скучно, что награда — это репорт, надо инсайт + какие-то
// новые приколы"): it opens card by card — the insight, the week in
// numbers — then what grew in her world since the
// last chest (a house, a bridge, a special item…), next week's mission and
// a new title.
import { linkSentence, trackerLookup } from "@/lib/linkText";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, Crown, FileBarChart2, FlaskConical, Lightbulb, Link2, Share2, Sparkles, Target, X } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { playSparkle, playThump, preloadSounds } from "@/lib/feedback";
import { buildIslands, buildRoutes, isNightMap, islandName, mapPic, type IslandId } from "@/lib/islands";
import { art, artOf, islandEvenings, stageOf } from "@/lib/globeArt";
import { getNotes } from "@/lib/notes";
import { ITEMS, islandDays, itemProgress, lastWorld, nextMission, owned, placeTreasures, syncTreasures, worldFacts, type ItemId } from "@/lib/growth";
import { ExperimentSheet } from "@/components/ExperimentSheet";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { getDoor, getDoorState } from "@/lib/doors";
import { factLine } from "@/lib/echo";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { chestContent, type ChestStat } from "@/lib/weekChest";
import { getChests, rewardFor, saveChest, titleFor, type ChestRecord } from "@/lib/pathSteps";
import { isoLocal } from "@/lib/doors";
import { useCount } from "@/lib/spotlight";

// The report fills in live as each card lands (Nov 6 2026, from the hooks list:
// "a live week report"): the numbers count up, the week's days pop in as dots, what
// grew comes in one by one.
const KofN = ({ k, n, delay }: { k: number; n: number; delay: number }) => {
  const { t } = useTranslation();
  const v = useCount(k, delay * 1000, Math.max(60, Math.round(700 / Math.max(1, k))));
  return <span className="tabular-nums">{t("path.chest.kOfN", { k: v, count: n })}</span>;
};
const WeekDots = ({ k, n, calm, delay }: { k: number; n: number; calm?: boolean; delay: number }) => (
  <span className="mt-1.5 flex gap-1.5" aria-hidden="true">
    {Array.from({ length: n }, (_, i) => (
      <span key={i} className="tour-pop h-3.5 w-3.5 rounded-full" style={{ animationDelay: `${delay + i * 0.07}s`, background: i < k ? (calm ? "hsl(var(--balanced) / 0.85)" : "hsl(var(--strong))") : "hsl(var(--foreground) / 0.12)" }} />
    ))}
  </span>
);
import { Pressable } from "@/components/ui/pressable";
import { track } from "@/lib/analytics";

export const WeekChest = ({
  week,
  dates,
  trackers,
  entries,
  onClose,
  onPlaced,
}: {
  week: number;
  dates: string[];
  trackers: Tracker[];
  entries: TrackerEntry[];
  onClose: () => void;
  /** After "Put it on my map": show it there. */
  onPlaced: () => void;
}) => {
  const { t } = useTranslation();
  const [rec, setRec] = useState<ChestRecord | null>(() => getChests()[week] ?? null);
  // Cards shown so far; an already opened chest shows them all.
  const [shown, setShown] = useState(() => (getChests()[week] ? 99 : 1));
  const [testOpen, setTestOpen] = useState(false);

  const label = (s: ChestStat) => {
    if (s.door) {
      const door = getDoorState();
      const d = door ? getDoor(door.id) : undefined;
      if (d) return t(`doors.${d.id}.name`);
    }
    const tr = trackers.find((x) => x.id === s.trackerId);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };

  const open = async () => {
    track("report_opened", { week: week + 1 });
    haptics.soft();
    preloadSounds("sparkle", "thump");
    // Her world now, to say what grew since the last chest.
    const islands = buildIslands(trackers, entries);
    const routes = buildRoutes(trackers, entries, islands);
    const days = islandDays(trackers, entries);
    const notes = await getNotes().then((n) => n.length).catch(() => 0);
    const facts = worldFacts(trackers, entries, islands, routes, notes);
    syncTreasures(facts);
    // where each treasure stands (so the report can say which island)
    const hosts = placeTreasures({ islands: islands.map((i) => i.id), days: Object.fromEntries(days), facts, routes, trackers });
    const hostOf = (id: string) => [...hosts.entries()].find(([, list]) => list.some((x) => x.id === id && !x.ghost))?.[0];
    // islands that reached a new stage this week (their pictures on the map)
    const was = islandEvenings(trackers, entries.filter((e) => e.date < dates[0]));
    const now = islandEvenings(trackers, entries);
    const world = {
      growth: islands.map((i) => `${i.id}:stage${stageOf(now.get(i.id) ?? 0)}`),
      items: ITEMS.filter((it) => owned(it.id, facts)).map((it) => it.id as string),
      bridges: routes.slice(0, 3).map((r) => `${r.a}|${r.b}`),
    };
    const before = lastWorld();
    const fresh = {
      growth: islands.filter((i) => stageOf(now.get(i.id) ?? 0) > stageOf(was.get(i.id) ?? 0)).map((i) => `${i.id}:stage${stageOf(now.get(i.id) ?? 0)}`),
      itemIslands: Object.fromEntries(ITEMS.map((it) => [it.id, hostOf(it.id)]).filter(([, h]) => !!h)),
      items: world.items.filter((g) => !before.items.includes(g)),
      bridges: world.bridges.filter((g) => !before.bridges.includes(g)),
    };
    const m = nextMission(facts, [...days.values()].filter((d) => d >= 3).length);
    const mission = { id: m.id, n: m.id === "testRunning" ? m.day : m.id === "notes" ? m.left : m.id === "streak" ? m.goal : undefined };
    // The two items she's closest to, for "next up" when nothing new grew.
    const nextUp = ITEMS.filter((it) => !owned(it.id, facts))
      .map((it) => ({ id: it.id, p: itemProgress(it.id, facts) }))
      .sort((a, b) => b.p[0] / b.p[1] - a.p[0] / a.p[1]).slice(0, 2)
      .map((x) => `${x.id}:${x.p[0]}/${x.p[1]}`);
    const c = chestContent(trackers, entries, dates);
    const lines = [
      ...(c.main ? [{ label: label(c.main), k: c.main.k, n: c.main.n, main: true, calm: c.main.k === 0 }] : []),
      ...c.rows.map((r) => ({ label: label(r), k: r.k, n: r.n })),
    ];
    const name = (id: string) => localizeTrackerTitle(trackers.find((x) => x.id === id)?.title ?? "");
    const insight = c.insight
      ? linkSentence(t, { first: c.insight.a, second: c.insight.b, firstYes: true, secondYes: true, nextDay: c.insight.nextDay, k: c.insight.k, n: c.insight.n }, trackerLookup(trackers))
      : undefined;
    const next: ChestRecord = {
      openedAt: isoLocal(new Date()),
      lines,
      fact: c.fact ? factLine(t, c.fact) : undefined,
      reward: rewardFor(week),
      insight,
      insightOther: c.insight ? t("game.withoutA", { k: c.insight.otherK, count: c.insight.otherN }) : undefined,
      insightEarly: !!c.insight && c.insight.n < 6,
      title: titleFor(week),
      world,
      mission,
      fresh,
      nextUp,
    };
    saveChest(week, next);
    setRec(next);
    setShown(1);
  };

  const place = () => {
    if (!rec) return;
    haptics.success();
    const next = { ...rec, placed: true };
    saveChest(week, next);
    setRec(next);
    onPlaced();
  };
  // a new treasure: straight to her shelf in You
  const toTreasures = () => {
    if (!rec) return;
    haptics.success();
    const next = { ...rec, placed: true };
    saveChest(week, next);
    setRec(next);
    onClose();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("memap-open-you")), 250);
  };
  const hasTreasure = !!rec?.fresh?.items.length;

  const early = (
    <span className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-foreground/15 px-2.5 text-[13px] font-semibold text-muted-foreground">
      <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
      {t("path.chest.early")}
    </span>
  );
  const kicker = (icon: ReactNode, text: string) => (
    <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{icon}{text}</p>
  );

  /** One line of "what grew": its picture, what it is, where or why. */
  const row = (pic: string, what: string, sub: string, special = false, muted = false, src?: string) => (
    <div key={`${pic}${what}${sub}`} className="mt-3 flex items-center gap-3">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${special ? "bg-[hsl(var(--coin-gold)/0.16)]" : "bg-foreground/[0.04]"}`}>
        {pic === "link"
          ? <Link2 className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
          : <img src={src ?? mapPic(pic)} alt="" className={`max-h-11 max-w-11 object-contain ${muted ? "opacity-40 grayscale" : ""}`} draggable={false} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-bold leading-snug">{what}</span>
        <span className="block text-[14px] font-medium leading-snug text-muted-foreground">{sub}</span>
      </span>
    </div>
  );

  /** The cards, in the order they open. */
  const cards = (r: ChestRecord): ReactNode[] => {
    const out: ReactNode[] = [];
    // 1. The insight: the strongest link so far, else the door's early clue,
    //    else her topic's count.
    const main = r.lines.find((l) => l.main);
    out.push(
      <div className="surface rounded-[22px] px-5 py-4 text-left">
        {kicker(<Lightbulb className="h-4 w-4 text-[hsl(var(--coin-gold))]" strokeWidth={2.4} />, t("path.chest.insight"))}
        <p className="mt-2 text-[20px] font-bold leading-snug">
          {r.insight ?? r.fact ?? (main ? `${main.label}: ${t("path.chest.kOfN", { k: main.k, count: main.n })}` : t("path.chest.calm"))}
        </p>
        {r.insight && r.insightOther && <p className="mt-1 text-[16px] font-medium leading-snug text-muted-foreground">{r.insightOther}</p>}
        {(r.insight ? r.insightEarly : !!r.fact) && early}
      </div>,
    );
    // 2. The week in numbers.
    out.push(
      <div className="surface rounded-[22px] px-5 py-4 text-left">
        {kicker(null, t("path.chest.inNumbers"))}
        {r.lines.length === 0 && <p className="mt-2 text-[17px] font-semibold">{t("path.chest.calm")}</p>}
        {r.lines.map((l, i) => (
          <div key={i} className={i > 0 ? "mt-3 border-t border-foreground/[0.06] pt-3" : "mt-2"}>
            {l.calm && <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[hsl(var(--coin-teal))]">{t("path.chest.calm")}</p>}
            <p className={l.main ? "text-[19px] font-bold leading-tight" : "text-[17px] font-semibold leading-tight"}>
              {l.label}: <KofN k={l.k} n={l.n} delay={0.3 + i * 0.35} />
            </p>
            {l.n <= 14 && <WeekDots k={l.k} n={l.n} calm={l.calm} delay={0.3 + i * 0.35} />}
          </div>
        ))}
      </div>,
    );
    // 4. What grew in her world since the last chest (real progress only).
    const fresh = r.fresh;
    if (fresh) {
      const rows: ReactNode[] = [];
      // Special items first (the rarest), then each island's new pieces, then bridges.
      // treasures first (the rarest), with the island they stand on
      fresh.items.forEach((id) => {
        const it = ITEMS.find((x) => x.id === id);
        const host = fresh.itemIslands?.[id] as IslandId | undefined;
        if (it) rows.push(row(it.pic, t(`items.${id}.name`), host ? t("items.onIsland", { how: t(`items.${id}.how`), island: islandName(t, host) }) : t(`items.${id}.how`), true));
      });
      // islands that grew a stage (an older report kept other growth words: skip those)
      fresh.growth.forEach((g) => {
        const [id, st] = g.split(":") as [IslandId, string];
        const n = Number(st.replace("stage", ""));
        if (!n) return;
        const evenings = islandEvenings(trackers, entries).get(id) ?? 0;
        rows.push(row(id, islandName(t, id), t(`path.stage${n}`), false, false, art(artOf(id, evenings), isNightMap())));
      });
      // a link is the dotted route on the map (no bridge)
      if (fresh.bridges.length > 0) {
        const names = fresh.bridges.map((b) => b.split("|").map((x) => islandName(t, x as IslandId)).join(" ↔ "));
        rows.push(row("link", t("path.chest.links", { count: fresh.bridges.length }), names.join(", ")));
      }
      if (rows.length > 5) {
        const more = rows.length - 4;
        rows.splice(4, rows.length, <p key="more" className="mt-3 text-[15px] font-semibold text-muted-foreground">{t("path.chest.moreOnMap", { count: more })}</p>);
      }
      out.push(
        <div className="surface rounded-[22px] px-5 py-4 text-left">
          {kicker(<Sparkles className="h-4 w-4 text-[hsl(var(--coin-gold))]" strokeWidth={2.4} />, rows.length ? t("path.chest.grew") : t("path.chest.nextUp"))}
          {rows.length > 0 ? rows.map((x, i) => <div key={i} className="tour-pop" style={{ animationDelay: `${0.25 + i * 0.22}s` }}>{x}</div>) : (r.nextUp ?? []).map((x) => {
            const [id, p] = x.split(":") as [ItemId, string];
            const it = ITEMS.find((y) => y.id === id);
            const [pk, pn] = p.split("/");
            return it ? row(it.pic, t(`items.${id}.name`), pn ? t("items.toGet", { how: t(`items.${id}.how`), k: pk, count: Number(pn) }) : t(`items.${id}.how`), false, true) : null;
          })}
        </div>,
      );
    }
    // 5. Next week's mission.
    if (r.mission) {
      const id = r.mission.id;
      out.push(
        <div className="surface rounded-[22px] px-5 py-4 text-left">
          {kicker(<Target className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />, t("mission.title"))}
          <p className="mt-2 text-[20px] font-bold leading-snug">{t(`mission.${id}`, { count: r.mission.n, goal: r.mission.n })}</p>
          <p className="mt-1 text-[15px] font-medium text-muted-foreground">{t(`mission.${id}Line`, { day: r.mission.n })}</p>
          {id === "test" && (
            <button type="button" onClick={() => { haptics.tap(); setTestOpen(true); }}
              className="raised-btn is-small mt-3 px-5">
              <FlaskConical className="h-4 w-4" strokeWidth={2.4} /> {t("mission.choose")}
            </button>
          )}
        </div>,
      );
    }
    // 6. A new title.
    out.push(
      <div className="surface rounded-[22px] px-5 py-4 text-left">
        {kicker(null, t("path.chest.rewards"))}
        {!r.fresh && (
          <div className="mt-3 flex items-center gap-3">
            <img src={mapPic(r.reward)} alt="" width={56} height={56} className="h-14 w-14 object-contain" draggable={false} />
            <p className="text-[17px] font-semibold leading-snug">{t("path.chest.earned", { item: t(`path.reward.${r.reward}`) })}</p>
          </div>
        )}
        {r.title && (
          <div className={r.fresh ? "mt-3 flex items-center gap-3" : "mt-3 flex items-center gap-3 border-t border-foreground/[0.06] pt-3"}>
            {/* The title is hers: her avatar wears the crown. */}
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-gold)/0.18)] text-[hsl(var(--coin-gold))]">
              {avatarUrl(getAvatar()) ? (
                <>
                  <img src={avatarUrl(getAvatar())!} alt="" className="h-12 w-12 object-contain" />
                  <Crown className="absolute -right-1 -top-2 h-5 w-5 fill-[hsl(var(--coin-gold))]" strokeWidth={2.2} />
                </>
              ) : <Crown className="h-7 w-7" strokeWidth={2.2} />}
            </span>
            <p className="text-[17px] font-semibold leading-snug">{t("path.chest.newTitle", { title: t(`path.titles.${r.title}`) })}</p>
          </div>
        )}
      </div>,
    );
    return out;
  };

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-10 text-center">
        {!rec ? (
          <>
            <div className="flex flex-1 flex-col items-center justify-center">
              <span aria-hidden="true" className="report-badge"><FileBarChart2 className="h-14 w-14" strokeWidth={2} /></span>
              <p className="mt-6 text-[30px] font-bold tracking-tight">{t("path.chest.ready")}</p>
              <p className="mt-1 text-[17px] font-medium text-muted-foreground">{t("path.weekN", { n: week + 1 })}</p>
            </div>
            <Pressable tone="gold" haptic="none" onClick={open} className="h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("path.chest.open")}
            </Pressable>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="report-badge is-small mt-1"><FileBarChart2 className="h-9 w-9" strokeWidth={2} /></span>
            <p className="mt-2 text-[28px] font-bold tracking-tight">{t("path.chest.mapOfWeek")}</p>
            {cards(rec).slice(0, shown).map((card, i) => (
              <div key={i} className="chest-card mt-4 w-full max-w-sm">{card}</div>
            ))}
            <div className="mt-6 w-full max-w-sm">
              {shown < cards(rec).length ? (
                <Pressable tone="gold" haptic="none" onClick={() => {
                  // The world-grew card sparkles, the others land.
                  const nextIsWorld = !!rec.fresh && shown === cards(rec).length - (rec.mission ? 3 : 2);
                  if (nextIsWorld) { haptics.sparkle(); playSparkle(); } else { haptics.land(); playThump(); }
                  setShown((n) => n + 1);
                }} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                  {t("path.chest.next")}
                </Pressable>
              ) : (
                // Nothing is promised a place on the map that isn't drawn: a
                // new treasure goes to her shelf, the rest to the map.
                <>
                <Pressable tone="gold" haptic="none" onClick={hasTreasure ? toTreasures : place} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                  {hasTreasure ? t("path.chest.seeTreasures") : t("path.chest.seeMap")}
                </Pressable>
                {/* her week as a picture to share (Nov 6 2026) */}
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("memap-share-world", { detail: { from: "report" } }))}
                  className="quiet-btn mt-3 h-12 w-full justify-center gap-2 text-[16px]">
                  <Share2 className="h-5 w-5" strokeWidth={2.4} /> {t("share.button")}
                </button>
                </>
              )}
            </div>
          </>
        )}
        {testOpen && <ExperimentSheet mode="pick" trackers={trackers} entries={entries} onClose={() => setTestOpen(false)} />}
      </div>
    </div>,
    document.body,
  );
};
