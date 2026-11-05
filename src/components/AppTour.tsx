// "Look around" (her note, Nov 5 2026): after the first questions the app walks
// her through the real pages — the World map, its calendar, chart and action
// points, Notes, You — and lights up where each thing lives, with a small
// example picture, instead of telling her in a pop-up ("надо показать, где
// конкретно это лежит… красивой инфографикой"). Started by the path's "Look
// around" step (memap-start-tour); done or skipped = that step is done.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getDoorState } from "@/lib/doors";
import { getEntries, getTrackers } from "@/lib/storage";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { art, artOf, STAGE_AT, LADDER_WIDTH } from "@/lib/globeArt";
import { islandOf, mapPicFor, type IslandId } from "@/lib/islands";
import { countedDays, markDiscovered } from "@/lib/pathSteps";
import type { Tracker } from "@/types/tracker";

type Tab = "cards" | "patterns" | "notes";
interface Stop {
  id: "world" | "links" | "calendar" | "chart" | "actions" | "notes" | "you" | "end";
  tab: Tab;
  /** what lights up (none: the card stands in the middle) */
  target?: string;
}
const STOPS: Stop[] = [
  { id: "world", tab: "patterns", target: '[data-tour="world"]' },
  { id: "links", tab: "patterns", target: '[data-tour="world"]' },
  { id: "calendar", tab: "patterns", target: '[data-tour="calendar"]' },
  { id: "chart", tab: "patterns", target: '[data-tour="chart"]' },
  { id: "actions", tab: "patterns", target: '[data-tour="actions"]' },
  { id: "notes", tab: "notes", target: '[data-tour="tab-notes"]' },
  { id: "you", tab: "cards", target: '[data-coachmark="settings-button"]' },
  { id: "end", tab: "cards" },
];

// --- the little pictures ---------------------------------------------------------

const Example = () => {
  const { t } = useTranslation();
  return <span className="absolute left-2.5 top-2.5 rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("tour.example")}</span>;
};
const Box = ({ children, example }: { children: ReactNode; example?: boolean }) => (
  <div className={cn("relative mt-3 overflow-hidden rounded-[18px] bg-foreground/[0.035] px-3 pb-3", example ? "pt-10" : "pt-3")}>
    {example && <Example />}
    {children}
  </div>
);
const Dots = ({ k, n }: { k: number; n: number }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < k ? "hsl(var(--coin-gold))" : "hsl(var(--foreground) / 0.12)" }} />)}
      </div>
      <p className="mt-1 text-[14px] font-semibold text-muted-foreground">{t("tour.yours", { k: Math.min(k, n), n })}</p>
    </div>
  );
};

/** Her island at its four stages, growing. */
const Growth = ({ island }: { island: IslandId }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <div className="grid grid-cols-4 items-end gap-1">
        {([1, 2, 3, 4] as const).map((s) => (
          <div key={s} className="flex flex-col items-center">
            <span className="flex h-[46px] w-full items-end justify-center">
              <img aria-hidden="true" className="art-day block max-h-full object-contain" style={{ width: `${LADDER_WIDTH[s]}%` }} src={art(artOf(island, STAGE_AT[s - 1]), false)} alt="" />
              <img aria-hidden="true" className="art-night block max-h-full object-contain" style={{ width: `${LADDER_WIDTH[s]}%` }} src={art(artOf(island, STAGE_AT[s - 1]), true)} alt="" />
            </span>
            <span className="mt-1 text-[12px] font-semibold text-muted-foreground">{s === 1 ? t("path.ladderStart") : t("path.ladderAt", { count: STAGE_AT[s - 1] })}</span>
          </div>
        ))}
      </div>
    </Box>
  );
};

const Links = ({ pair, days }: { pair: [string, string]; days: number }) => {
  const { t } = useTranslation();
  const chip = (text: string) => <span className="surface max-w-[42%] rounded-[14px] px-2.5 py-1.5 text-center text-[14px] font-bold leading-tight">{text}</span>;
  return (
    <>
      <Box example>
        <div className="flex items-center justify-between gap-1">
          {chip(pair[0])}
          <span className="relative flex flex-1 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-x-1 top-1/2 border-t-[3px] border-dotted border-[hsl(var(--coin-teal))]" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Link2 className="h-4 w-4" strokeWidth={2.4} /></span>
          </span>
          {chip(pair[1])}
        </div>
        <p className="mt-2 text-center text-[14px] font-bold text-[hsl(var(--coin-teal))]">{t("tour.links.sample", { k: 4, n: 5 })}</p>
      </Box>
      <Dots k={days} n={10} />
    </>
  );
};

const Month = () => {
  const HARD = new Set([2, 3, 9, 15, 16, 22]);
  return (
    <Box example>
      <div className="mx-auto grid w-fit grid-cols-7 gap-1.5" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="h-5 w-5 rounded-full" style={{ background: i > 23 ? "hsl(var(--foreground) / 0.1)" : HARD.has(i) ? "hsl(var(--strong))" : "hsl(var(--balanced) / 0.75)" }} />
        ))}
      </div>
    </Box>
  );
};

const Weeks = ({ days }: { days: number }) => {
  const { t } = useTranslation();
  const pts = [5, 4, 5, 3, 2, 2].map((y, i) => [16 + i * 50, 92 - y * 15] as const);
  return (
    <>
      <Box example>
        <svg viewBox="0 0 282 96" className="w-full" aria-hidden="true">
          <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="hsl(var(--strong))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5.5" fill="hsl(var(--strong))" />)}
        </svg>
        <p className="text-center text-[14px] font-bold text-muted-foreground">{t("tour.chart.sample")}</p>
      </Box>
      <Dots k={days} n={14} />
    </>
  );
};

const Rule = () => {
  const { t } = useTranslation();
  return (
    <Box example>
      <div className="flex items-center gap-3">
        <img aria-hidden="true" className="h-14 w-14 object-contain" src={mapPicFor("lighthouse", false)} alt="" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-snug">{t("tour.actions.sample")}</p>
          <div className="mt-1.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < 3 ? "hsl(var(--strong))" : "hsl(var(--foreground) / 0.12)" }} />)}
          </div>
        </div>
      </div>
    </Box>
  );
};

const NoteExample = () => {
  const { t } = useTranslation();
  return (
    <Box example>
      <div className="surface rounded-[14px] px-3 py-2.5">
        <p className="text-[13px] font-bold text-muted-foreground">{t("tour.notes.sampleDay")}</p>
        <p className="mt-0.5 text-[15px] font-semibold leading-snug">{t("tour.notes.sample")}</p>
      </div>
    </Box>
  );
};

const Treasures = () => (
  <Box>
    <div className="flex items-end justify-around" aria-hidden="true">
      {["hot_air_balloon", "camera", "bicycle", "books"].map((p) => <img key={p} className="h-12 w-12 object-contain" src={mapPicFor(p, false)} alt="" />)}
    </div>
  </Box>
);

// --- the tour -----------------------------------------------------------------------

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const findTarget = async (sel: string): Promise<HTMLElement | null> => {
  for (let i = 0; i < 40; i++) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.getBoundingClientRect().width > 0) return el;
    await wait(60);
  }
  return null;
};

export const AppTour = () => {
  const { t } = useTranslation();
  const [at, setAt] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [data, setData] = useState<{ trackers: Tracker[]; days: number } | null>(null);

  useEffect(() => {
    const start = async () => {
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      setData({ trackers, days: countedDays(trackers, entries).length });
      setAt(0);
    };
    window.addEventListener("memap-start-tour", start);
    return () => window.removeEventListener("memap-start-tour", start);
  }, []);

  // go to the stop's page, find what lights up, keep it measured
  useEffect(() => {
    if (at === null) return;
    const stop = STOPS[at];
    let alive = true, el: HTMLElement | null = null;
    setRect(null);
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: stop.tab } }));
    if (stop.tab === "patterns") window.dispatchEvent(new CustomEvent("memap-set-map-view", { detail: "map" }));
    (async () => {
      await wait(stop.tab === "patterns" ? 450 : 250);
      if (!stop.target) return;
      el = await findTarget(stop.target);
      if (!alive || !el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: r.height > window.innerHeight * 0.5 ? "start" : "center", behavior: "smooth" });
      await wait(380);
      if (alive) setRect(el.getBoundingClientRect());
    })();
    const re = () => { if (el && alive) setRect(el.getBoundingClientRect()); };
    const iv = window.setInterval(re, 400);
    window.addEventListener("resize", re);
    return () => { alive = false; window.clearInterval(iv); window.removeEventListener("resize", re); };
  }, [at]);

  const door = getDoorState();
  const main = useMemo(() => (data && door ? data.trackers.find((x) => x.id === door.trackerId) : undefined), [data, door]);
  const island: IslandId = main ? islandOf(main) : "me";
  const pair = useMemo<[string, string]>(() => {
    if (main && door && data) {
      const byId = new Map(data.trackers.map((x) => [x.id, x]));
      const ctx = door.contextTrackerIds.map((id) => byId.get(id)).find((x) => x && x.problemWhen === main.problemWhen);
      if (ctx) return [localizeTrackerTitle(ctx.title), localizeTrackerTitle(main.title)];
    }
    return [t("tour.links.a"), t("tour.links.b")];
  }, [main, door, data, t]);

  if (at === null || !data) return null;
  const stop = STOPS[at];
  const last = at === STOPS.length - 1;
  const finish = () => {
    markDiscovered("tour");
    setAt(null);
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } }));
    window.dispatchEvent(new CustomEvent("memap-tour-done"));
  };
  const next = () => { haptics.tap(); if (last) finish(); else setAt(at + 1); };

  const title = stop.id === "calendar"
    ? t(door ? `path.daysLabel.${door.id}` : "path.daysLabel.any")
    : stop.id === "actions" ? t("overviewCards.lighthouses")
    : stop.id === "notes" ? t("common.notes")
    : stop.id === "you" ? t("map.you")
    : t(`tour.${stop.id}.title`);
  const visual = stop.id === "world" ? <Growth island={island} />
    : stop.id === "links" ? <Links pair={pair} days={data.days} />
    : stop.id === "calendar" ? <Month />
    : stop.id === "chart" ? <Weeks days={data.days} />
    : stop.id === "actions" ? <Rule />
    : stop.id === "notes" ? <NoteExample />
    : stop.id === "you" ? <Treasures />
    : null;

  // the card goes where there's room: under the light, over it, or at the bottom
  const vh = window.innerHeight, pad = 8;
  const hole = rect && stop.target ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const CARD_H = 330;
  const place: React.CSSProperties = !hole ? { top: "50%", transform: "translateY(-50%)" }
    : hole.y + hole.h + CARD_H + 16 < vh ? { top: hole.y + hole.h + 14 }
    : hole.y - CARD_H - 16 > 0 ? { bottom: vh - hole.y + 14 }
    : { bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" };

  return createPortal(
    <div className="tour fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
      {hole
        ? <div className="tour-hole" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        : <div className="tour-dim" />}
      <div data-tour-card className="tour-card surface fixed left-4 right-4 mx-auto max-w-[380px] rounded-[24px] px-5 pb-4 pt-4" style={place}>
        <p className="text-[22px] font-bold leading-tight tracking-tight">{title}</p>
        <p className="mt-1 text-[16px] font-semibold leading-snug text-muted-foreground">{t(`tour.${stop.id}.line`)}</p>
        {visual}
        {/* where she is in the tour, then Skip and Next on their own line (Russian words are long) */}
        <div className="mt-3.5 flex justify-center gap-1.5" aria-hidden="true">
          {STOPS.map((_, i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i === at ? "hsl(var(--coin-teal))" : "hsl(var(--foreground) / 0.15)" }} />)}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          {!last ? <button type="button" onClick={() => { haptics.tap(); finish(); }} className="h-11 px-1 text-[15px] font-semibold text-muted-foreground">{t("tour.skip")}</button> : <span />}
          <button type="button" onClick={next} className="raised-btn is-small shrink-0 gap-1 px-6">
            {last ? t("tour.gotIt") : t("tour.next")} {!last && <ArrowRight className="h-4 w-4" strokeWidth={2.6} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
