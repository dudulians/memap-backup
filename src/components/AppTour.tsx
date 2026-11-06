// "Look around" (her note, Nov 5 2026): after the first questions the app walks
// her through the real pages — the World map, its calendar, chart and action
// points, Notes, You — and lights up where each thing lives, with a small
// example picture, instead of telling her in a pop-up ("надо показать, где
// конкретно это лежит… красивой инфографикой"). Started by the path's "Look
// around" step (memap-start-tour); done or skipped = that step is done.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Link2, Spline, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getDoorState, isoLocal } from "@/lib/doors";
import { getEntries, getTrackers } from "@/lib/storage";
import { art, artOf, STAGE_AT, LADDER_WIDTH } from "@/lib/globeArt";
import { islandOf, mapPicFor, type IslandId } from "@/lib/islands";
import { countedDays, markDiscovered, pathModel } from "@/lib/pathSteps";
import { centre, curveDots, findTarget, focusGlobe, frames, isleRects, still, union, useCount, wait, type Pt } from "@/lib/spotlight";
import type { Tracker } from "@/types/tracker";
import { track } from "@/lib/analytics";

type Tab = "cards" | "patterns" | "notes";
interface Stop {
  id: "week" | "steps" | "world" | "links" | "calendar" | "chart" | "actions" | "helps" | "notes" | "you" | "end";
  tab: Tab;
  /** what lights up (none: the card stands in the middle) */
  target?: string;
  /** her own island on the map ("main"), or it and its nearest island with a
   *  link drawn between them ("pair") — her note, Nov 5 2026: the light was on
   *  the whole map, "на другое что-то указывало" */
  isle?: "main" | "pair";
  /** Today's path: the step before, the one to do now and the next */
  steps?: boolean;
}
// Her note, Nov 6 2026: after onboarding nothing said that Today is there and has steps,
// and the tour went My days (top row) → a link on the map → back up to the row. Now:
// Today first (the week's part, then the steps), then the World's row left to right,
// then down to her island on the map, then Notes and You. It starts by itself after
// "Your world has begun".
const STOPS: Stop[] = [
  { id: "week", tab: "cards", target: '[data-tour="week"]' },
  { id: "steps", tab: "cards", steps: true },
  { id: "calendar", tab: "patterns", target: '[data-tour="calendar"]' },
  { id: "links", tab: "patterns", target: '[data-tour="links-card"]' },
  { id: "actions", tab: "patterns", target: '[data-tour="actions"]' },
  { id: "helps", tab: "patterns", target: '[data-tour="helps"]' },
  { id: "world", tab: "patterns", isle: "main" },
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
// The pictures fill in live once the card is up (her note, Nov 5 2026: "чтобы это
// интерактивно заполнялось красиво… мы же это умеем"). Only opacity, transform and
// a line's dash move; with reduced motion everything is simply there.
const delay = (s: number): React.CSSProperties => ({ animationDelay: `${s}s` });
/** words typed letter by letter */
const useTyped = (text: string, delay: number, speed = 34) => {
  const [n, setN] = useState(() => (still() ? text.length : 0));
  useEffect(() => {
    if (still()) { setN(text.length); return; }
    setN(0);
    let k = 0;
    let timer = window.setTimeout(function tick() { k += 1; setN(k); if (k < text.length) timer = window.setTimeout(tick, speed); }, delay);
    return () => window.clearTimeout(timer);
  }, [text, delay, speed]);
  return text.slice(0, n);
};

const Dots = ({ k, n, from = 0.5 }: { k: number; n: number; from?: number }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => i < k
          ? <span key={i} className="tour-pop h-3 w-3 rounded-full" style={{ background: "hsl(var(--coin-gold))", ...delay(from + i * 0.12) }} />
          : <span key={i} className="h-3 w-3 rounded-full" style={{ background: "hsl(var(--foreground) / 0.12)" }} />)}
      </div>
      <p className="mt-1 text-[14px] font-semibold text-muted-foreground">{t("tour.yours", { k: Math.min(k, n), n })}</p>
    </div>
  );
};

/** Her island growing, stage after stage. */
const Growth = ({ island }: { island: IslandId }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <div className="grid grid-cols-4 items-end gap-1">
        {([1, 2, 3, 4] as const).map((s) => (
          <div key={s} className="tour-pop flex flex-col items-center" style={delay(0.3 + (s - 1) * 0.38)}>
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

/** Two islands and the dots between them, drawn in the card (the light stays on the
 *  row's Links tile, so the tour doesn't jump down to the map and back), then how far
 *  hers is. */
const Links = ({ days }: { days: number }) => {
  const { t } = useTranslation();
  const k = useCount(4, 1050, 280);
  const dots = Array.from({ length: 9 }, (_, i) => { const u = (i + 1) / 10; return { x: 62 + u * 158, y: 64 - Math.sin(u * Math.PI) * 26 }; });
  const isle = (name: string, label: string, left: boolean) => (
    <span className={cn("absolute bottom-0 flex w-[92px] flex-col items-center", left ? "left-0" : "right-0")}>
      <span className="block w-[64px]" aria-hidden="true">
        <img className="art-day block w-full" src={art(name, false)} alt="" />
        <img className="art-night block w-full" src={art(name, true)} alt="" />
      </span>
      <span className="mt-0.5 max-w-full truncate text-[13px] font-bold">{label}</span>
    </span>
  );
  return (
    <>
      <Box example>
        <div className="relative mx-auto h-[104px] w-[282px] max-w-full">
          <svg viewBox="0 0 282 104" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {dots.map((p, i) => <circle key={i} className="tour-pop" style={delay(0.3 + i * 0.07)} cx={p.x} cy={p.y} r="3.6" fill="hsl(var(--data-a))" />)}
          </svg>
          {isle("19_grassy_terraces", t("tour.links.a"), true)}
          {isle("09_waterfall", t("tour.links.b"), false)}
          <span className="tour-pop absolute left-1/2 top-[2px] flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] font-extrabold text-[hsl(var(--data-a))] shadow-sm dark:bg-[hsl(var(--surface))]" style={delay(1)}>
            <Link2 className="h-3.5 w-3.5" strokeWidth={2.8} /><span className="tabular-nums">{t("tour.links.sample", { k: Math.max(1, k), n: 5 })}</span>
          </span>
        </div>
      </Box>
      <Dots k={days} n={10} from={1.6} />
    </>
  );
};

/** The month's 4 parts, one a week; this week's is lit (board 68). */
const WeekParts = ({ part }: { part: number }) => {
  const { t } = useTranslation();
  const pics = [
    <span key="d" className="grid grid-cols-3 gap-[3px]">{[0, 0, 1, 0, 1, 0].map((h, i) => <i key={i} className="block h-[7px] w-[7px] rounded-full" style={{ background: h ? "hsl(var(--strong))" : "hsl(var(--balanced))" }} />)}</span>,
    <Spline key="l" className="h-6 w-6 text-[hsl(var(--data-a))]" strokeWidth={2.6} />,
    <img key="a" src={mapPicFor("lighthouse", false)} alt="" className="h-7 w-auto" />,
    <Sprout key="h" className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />,
  ];
  return (
    <Box>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {pics.map((pic, i) => (
          <div key={i} className={cn("tour-pop flex flex-col items-center rounded-[14px] px-1 pb-1.5 pt-2 text-center", i === part ? "bg-white shadow-sm ring-2 ring-[hsl(var(--coin-teal))] dark:bg-[hsl(var(--surface))]" : "opacity-70")} style={delay(0.25 + i * 0.22)}>
            <span className="flex h-7 items-center">{pic}</span>
            <span className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">{t("how.week", { n: i + 1 })}</span>
            <span className="text-[12.5px] font-bold leading-tight">{t(`path.title${i}`)}</span>
          </div>
        ))}
      </div>
    </Box>
  );
};

/** What the lights mean: done, the one to do now, later. */
const StepsLegend = () => {
  const { t } = useTranslation();
  const one = (look: ReactNode, label: string, i: number) => (
    <span className="tour-pop flex items-center gap-2" style={delay(0.25 + i * 0.2)}>{look}<span className="text-[14px] font-bold">{label}</span></span>
  );
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1" aria-hidden="true">
      {one(<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--coin-gold))] text-white"><Check className="h-4 w-4" strokeWidth={3.2} /></span>, t("tour.steps.done"), 0)}
      {one(<span className="h-7 w-7 rounded-full bg-[hsl(var(--coin-teal))] ring-[3px] ring-[hsl(var(--coin-teal)/0.25)] ring-offset-2" />, t("tour.steps.now"), 1)}
      {one(<span className="h-7 w-7 rounded-full border border-foreground/10 bg-white dark:bg-[hsl(var(--surface))]" />, t("tour.steps.later"), 2)}
    </div>
  );
};
/** "4 of 5 times", counting up under the link on the map. */
const LinkCount = ({ from }: { from: number }) => {
  const { t } = useTranslation();
  const k = useCount(4, from * 1000, 280);
  return k > 0 ? <span className="tour-link-count">{t("tour.links.sample", { k, n: 5 })}</span> : null;
};

/** A month filling in, day by day: a real calendar, weekdays and dates (her
 *  note, Nov 6 2026: "дотс как календарь с датами"). */
const Month = () => {
  const { i18n } = useTranslation();
  const HARD = new Set([2, 3, 9, 15, 16, 22]);
  const days = i18n.language === "ru" ? ["П", "В", "С", "Ч", "П", "С", "В"] : ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Box example>
      <div className="mx-auto grid w-fit grid-cols-7 gap-x-1.5 gap-y-1" aria-hidden="true">
        {days.map((d, i) => <span key={`d${i}`} className="text-center text-[11px] font-bold text-muted-foreground">{d}</span>)}
        {Array.from({ length: 28 }, (_, i) => i > 23
          ? <span key={i} className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-muted-foreground" style={{ background: "hsl(var(--foreground) / 0.06)" }}>{i + 1}</span>
          : <span key={i} className="tour-pop flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: HARD.has(i) ? "hsl(var(--strong))" : "hsl(var(--balanced) / 0.85)", ...delay(0.3 + i * 0.045) }}>{i + 1}</span>)}
      </div>
    </Box>
  );
};

/** The line drawing itself, week by week. */
const Weeks = ({ days }: { days: number }) => {
  const { t } = useTranslation();
  const pts = [5, 4, 5, 3, 2, 2].map((y, i) => [16 + i * 50, 92 - y * 15] as const);
  return (
    <>
      <Box example>
        <svg viewBox="0 0 282 96" className="w-full" aria-hidden="true">
          <polyline className="tour-draw" pathLength={1} points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="hsl(var(--strong))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map(([x, y], i) => <circle key={i} className="tour-pop" style={delay(0.35 + i * 0.22)} cx={x} cy={y} r="5.5" fill="hsl(var(--strong))" />)}
        </svg>
        <p className="text-center text-[14px] font-bold text-muted-foreground">{t("tour.chart.sample")}</p>
      </Box>
      <Dots k={days} n={14} from={1.6} />
    </>
  );
};

/** Three hard nights fill the meter, then the lighthouse lights up. */
const Rule = () => {
  const { t } = useTranslation();
  return (
    <Box example>
      <div className="flex items-center gap-3">
        <span className="relative h-14 w-14 shrink-0">
          <span className="tour-glow absolute -inset-2 rounded-full" style={delay(1.15)} />
          <img aria-hidden="true" className="relative h-14 w-14 object-contain" src={mapPicFor("lighthouse", false)} alt="" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-snug">{t("tour.actions.sample")}</p>
          <div className="mt-1.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => i < 3
              ? <span key={i} className="tour-pop h-3 w-3 rounded-full" style={{ background: "hsl(var(--strong))", ...delay(0.4 + i * 0.22) }} />
              : <span key={i} className="h-3 w-3 rounded-full" style={{ background: "hsl(var(--foreground) / 0.12)" }} />)}
          </div>
        </div>
      </div>
    </Box>
  );
};

/** One small change, two weeks: the days fill in. */
const Try = () => {
  const { t } = useTranslation();
  return (
    <Box example>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--coin-teal)/0.14)]">
          <Sprout className="h-7 w-7 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-snug">{t("tour.helps.sample")}</p>
          <div className="mt-1.5 flex items-center gap-[3px]" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => i < 5
              ? <span key={i} className="tour-pop h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--coin-teal))", ...delay(0.4 + i * 0.18) }} />
              : <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--foreground) / 0.12)" }} />)}
          </div>
          <p className="mt-1 text-[13px] font-bold text-muted-foreground">{t("tour.helps.day")}</p>
        </div>
      </div>
    </Box>
  );
};

/** A note being written. */
const NoteExample = () => {
  const { t } = useTranslation();
  const text = useTyped(t("tour.notes.sample"), 450);
  return (
    <Box example>
      <div className="surface rounded-[14px] px-3 py-2.5">
        <p className="text-[13px] font-bold text-muted-foreground">{t("tour.notes.sampleDay")}</p>
        <p className="mt-0.5 min-h-[22px] text-[15px] font-semibold leading-snug">{text}<span className="tour-caret" aria-hidden="true" /></p>
      </div>
    </Box>
  );
};

/** Treasures coming one by one. */
const Treasures = () => (
  <Box>
    <div className="flex items-end justify-around" aria-hidden="true">
      {["hot_air_balloon", "camera", "bicycle", "house", "moon_and_stars"].map((p, i) => <img key={p} className="tour-pop h-11 w-11 object-contain" style={delay(0.3 + i * 0.2)} src={mapPicFor(p, false)} alt="" />)}
    </div>
  </Box>
);

// --- the tour -----------------------------------------------------------------------

export const AppTour = () => {
  const { t } = useTranslation();
  const [at, setAt] = useState<number | null>(null);
  /** what's on screen: the stop and where its place is (null: nothing to light up) */
  const [view, setView] = useState<{ at: number; rect: DOMRect | null; link?: { a: Pt; b: Pt }; isle?: IslandId } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(330);
  const mainIsle = useRef<IslandId | null>(null);
  const placed = useRef<HTMLElement[]>([]);
  /** between stops: the card and the light are faded out */
  const [moving, setMoving] = useState(true);
  /** the place is lit (it stays lit when the next stop shows the same place) */
  const [lit, setLit] = useState(false);
  const [data, setData] = useState<{ trackers: Tracker[]; days: number; week: number; today: boolean } | null>(null);
  const shown = useRef(false);
  const target = useRef<HTMLElement | null>(null);
  const viewBefore = useRef<string | null>(null);

  useEffect(() => {
    const start = async () => {
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      const door = getDoorState(), main = door ? trackers.find((x) => x.id === door.trackerId) : undefined;
      mainIsle.current = main ? islandOf(main) : null;
      const counted = countedDays(trackers, entries);
      setData({ trackers, days: counted.length, week: pathModel(trackers, entries).week, today: counted.includes(isoLocal(new Date())) });
      // the tour is the "Look around" step: done as it starts, so Today's lit step is
      // the one after it while the tour shows the path
      markDiscovered("tour");
      window.dispatchEvent(new CustomEvent("memap-path-refresh"));
      setAt(0);
      track("tour_started");
    };
    window.addEventListener("memap-start-tour", start);
    return () => window.removeEventListener("memap-start-tour", start);
  }, []);

  // A move between stops (her note, Nov 5 2026: "сначала появляется пояснение, потом
  // резко показывается где это, всё с лагом"): the dim stays; the card and the light
  // fade out; the page changes under the dim and is scrolled at once (no smooth
  // scroll to measure in the middle of); the place is measured once settled; then
  // the light opens there and the card fades in beside it. Nothing moves while seen.
  useEffect(() => {
    if (at === null) return;
    const stop = STOPS[at];
    let alive = true;
    const same = shown.current && !!stop.target && STOPS[at - 1]?.target === stop.target && !stop.isle;
    setMoving(true);
    if (!same) setLit(false);
    (async () => {
      // the card fades out fully before anything changes place (CSS: .2s)
      if (shown.current) await wait(same ? 210 : 230);
      // the first stop: Today's path is still gliding to its new step (the tour marks
      // "Look around" done as it starts), so measure once it has settled
      else await wait(650);
      if (!alive) return;
      window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: stop.tab } }));
      let r: DOMRect | null = null, link: { a: Pt; b: Pt } | undefined, isle: IslandId | undefined;
      target.current = null; placed.current = [];
      let els: HTMLElement[] = [];
      await frames(2);
      if (stop.isle) {
        // her island on the map (and, for a link, the nearest one to it)
        await findTarget("[data-isle]");
        // the globe turns her island to face her first
        if (mainIsle.current) await focusGlobe([mainIsle.current]);
        const all = [...document.querySelectorAll<HTMLElement>("[data-isle]")];
        const mine = all.find((e) => e.dataset.isle === mainIsle.current) ?? all[0];
        if (mine) {
          els = [mine];
          isle = mine.dataset.isle as IslandId;
          if (stop.isle === "pair") {
            const m = centre(mine), d = (e: HTMLElement) => { const c = centre(e); return Math.hypot(c.x - m.x, c.y - m.y); };
            const near = all.filter((e) => e !== mine).sort((p, q) => d(p) - d(q))[0];
            if (near) els.push(near);
          }
        }
      } else if (stop.steps) {
        // the step to do now (with its Start bubble) and the next one
        const cur = await findTarget(".path-node.disc-current") ?? await findTarget("[data-path-stop]");
        if (cur) {
          const next = document.querySelector<HTMLElement>(`[data-path-stop="${Number(cur.dataset.pathStop) + 1}"]`);
          els = next ? [cur, next] : [cur];
        }
      } else if (stop.target) {
        const el = await findTarget(stop.target);
        if (el) els = [el];
      }
      if (!alive) return;
      // a light on the path with its name under it and (now) its Start bubble
      const rectsOf = (es: HTMLElement[]) => stop.steps
        ? es.flatMap((e) => [e, ...e.parentElement!.querySelectorAll<HTMLElement>(":scope > .path-label, :scope > .path-start")].map((x) => x.getBoundingClientRect()))
        : isleRects(es);
      if (els.length) {
        const b = union(rectsOf(els));
        const main = els[0].closest("main");
        if (stop.steps && main) {
          // her step a bit below the middle, so the card fits over it
          const c = els[0].getBoundingClientRect();
          main.scrollTop += c.top + c.height / 2 - window.innerHeight * 0.6;
        } else if (b.top < 70 || b.bottom > window.innerHeight - 90) els[0].scrollIntoView({ block: b.height > window.innerHeight * 0.5 ? "start" : "center" });
        await frames(2); await wait(120);
        if (!alive) return;
        r = union(rectsOf(els));
        target.current = els[0]; placed.current = els;
        if (stop.isle === "pair" && els.length === 2) link = { a: centre(els[0]), b: centre(els[1]) };
      }
      setView({ at, rect: r, link, isle });
      track("tour_stop_viewed", { stop: stop.id, index: at });
      shown.current = true;
      await frames(2);
      if (!alive) return;
      setLit(true); setMoving(false);
    })();
    return () => { alive = false; };
  }, [at]);
  // the card's own height, measured while it's still invisible, so it's placed right
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [view]);
  // a turned phone or a resized window: measure again (nothing else moves the page under the dim)
  useEffect(() => {
    const re = () => {
      const els = placed.current;
      if (els.length) setView((v) => (v ? { ...v, rect: union(isleRects(els)), link: v.link && els.length === 2 ? { a: centre(els[0]), b: centre(els[1]) } : undefined } : v));
    };
    window.addEventListener("resize", re);
    return () => window.removeEventListener("resize", re);
  }, []);

  const door = getDoorState();
  const main = useMemo(() => (data && door ? data.trackers.find((x) => x.id === door.trackerId) : undefined), [data, door]);
  const island: IslandId = view?.isle ?? (main ? islandOf(main) : "me");

  if (at === null || !data) return null;
  const finish = () => {
    track("tour_finished", { completed: view?.at === STOPS.length - 1, at: view ? STOPS[view.at].id : "start" });
    markDiscovered("tour");
    setAt(null); setView(null); setMoving(true); setLit(false); shown.current = false; target.current = null;
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } }));
    window.dispatchEvent(new CustomEvent("memap-tour-done"));
  };
  // the dim alone until the first place is ready
  if (!view) {
    return createPortal(<div className="tour fixed inset-0 z-[90]" role="dialog" aria-modal="true"><div className="tour-veil tour-plain" /></div>, document.body);
  }
  const stop = STOPS[view.at];
  const last = view.at === STOPS.length - 1;
  const next = () => { if (moving) return; haptics.tap(); if (last) finish(); else setAt(view.at + 1); };

  const part = data.week % 4;
  const title = stop.id === "week" ? `${t("path.weekN", { n: data.week + 1 })} · ${t(`path.title${part}`)}`
    : stop.id === "calendar"
    ? t(door ? `path.daysLabel.${door.id}` : "path.daysLabel.any")
    : stop.id === "links" ? t("world4.links")
    : stop.id === "actions" ? t("world4.whenToAct")
    : stop.id === "helps" ? t("world4.whatHelps")
    : stop.id === "notes" ? t("common.notes")
    : stop.id === "you" ? t("map.you")
    : t(`tour.${stop.id}.title`);
  const visual = stop.id === "week" ? <WeekParts part={part} />
    : stop.id === "steps" ? <StepsLegend />
    : stop.id === "world" ? <Growth island={island} />
    : stop.id === "links" ? <Links days={data.days} />
    : stop.id === "calendar" ? <Month />
    : stop.id === "chart" ? <Weeks days={data.days} />
    : stop.id === "actions" ? <Rule />
    : stop.id === "helps" ? <Try />
    : stop.id === "notes" ? <NoteExample />
    : stop.id === "you" ? <Treasures />
    : null;

  // the card goes where there's room: under the light, over it, or at the bottom
  const vh = window.innerHeight, pad = 8, rect = view.rect;
  // kept on screen (the path's first step sits under the header)
  const hole = rect && (stop.target || stop.isle || stop.steps)
    ? (() => {
      const vw = window.innerWidth, x = Math.max(4, rect.left - pad), right = Math.min(vw - 4, rect.right + pad);
      const y = Math.max(4, rect.top - pad), bottom = Math.min(vh - 4, rect.bottom + pad);
      return { x, y, w: right - x, h: bottom - y };
    })()
    : null;
  // the link drawn on the map, dot by dot, from her island to the next one
  const linkDots = view.link ? curveDots(view.link.a, view.link.b) : null;
  const TOP = 52, BOTTOM = 92, GAP = 14;
  const below = hole ? vh - BOTTOM - (hole.y + hole.h) - GAP : 0, above = hole ? hole.y - TOP - GAP : 0;
  const place: React.CSSProperties = !hole ? { top: "50%", transform: "translateY(-50%)" }
    : below >= cardH ? { top: hole.y + hole.h + GAP }
    : above >= cardH ? { bottom: vh - hole.y + GAP }
    : below >= above ? { bottom: BOTTOM } : { top: TOP };

  return createPortal(
    <div className="tour fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
      {/* one dim for the whole tour; the place opens in it (an SVG mask), so the
          page never flashes between stops */}
      <svg className="tour-veil" aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && <rect className={cn("tour-cut", lit && "is-open")} x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={22} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" className="tour-shade" mask="url(#tour-mask)" />
      </svg>
      {hole && <div className={cn("tour-ring", lit && "is-on")} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
      {linkDots && lit && (
        <div key={view.at} aria-hidden="true">
          <svg className="tour-link">
            {linkDots.dots.map((p, i) => <circle key={i} className="tour-pop" style={delay(0.25 + i * 0.06)} cx={p.x} cy={p.y} r="4.5" />)}
          </svg>
          <span className="tour-link-chip tour-pop" style={{ left: linkDots.mid.x - 18, top: linkDots.mid.y - 18, ...delay(0.3 + linkDots.dots.length * 0.06) }}><Link2 className="h-4 w-4" strokeWidth={2.6} /></span>
          <span className="tour-link-under" style={{ left: linkDots.mid.x, top: linkDots.mid.y + 24 }}><LinkCount from={0.5 + linkDots.dots.length * 0.06} /></span>
        </div>
      )}
      <div className="fixed left-4 right-4 mx-auto max-w-[380px]" style={place}>
      <div ref={cardRef} data-tour-card className={cn("tour-card surface rounded-[24px] px-5 pb-4 pt-4", moving && "is-moving")}>
        <p className="text-[22px] font-bold leading-tight tracking-tight">{title}</p>
        <p className="mt-1 text-[16px] font-semibold leading-snug text-muted-foreground">{t(stop.id === "end" && !data.today ? "tour.end.lineTonight" : `tour.${stop.id}.line`)}</p>
        {visual}
        {/* where she is in the tour, then Skip and Next on their own line (Russian words are long) */}
        <div className="mt-3.5 flex justify-center gap-1.5" aria-hidden="true">
          {STOPS.map((_, i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i === view.at ? "hsl(var(--coin-teal))" : "hsl(var(--foreground) / 0.15)" }} />)}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          {!last ? <button type="button" onClick={() => { if (moving) return; haptics.tap(); finish(); }} className="h-11 px-1 text-[15px] font-semibold text-muted-foreground">{t("tour.skip")}</button> : <span />}
          <button type="button" onClick={next} className="raised-btn is-small shrink-0 gap-1 px-6">
            {last ? t("tour.gotIt") : t("tour.next")} {!last && <ArrowRight className="h-4 w-4" strokeWidth={2.6} />}
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
};
