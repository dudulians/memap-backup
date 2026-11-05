// "Look around" (her note, Nov 5 2026): after the first questions the app walks
// her through the real pages — the World map, its calendar, chart and action
// points, Notes, You — and lights up where each thing lives, with a small
// example picture, instead of telling her in a pop-up ("надо показать, где
// конкретно это лежит… красивой инфографикой"). Started by the path's "Look
// around" step (memap-start-tour); done or skipped = that step is done.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getDoorState } from "@/lib/doors";
import { getEntries, getTrackers } from "@/lib/storage";
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
  /** her own island on the map ("main"), or it and its nearest island with a
   *  link drawn between them ("pair") — her note, Nov 5 2026: the light was on
   *  the whole map, "на другое что-то указывало" */
  isle?: "main" | "pair";
}
const STOPS: Stop[] = [
  { id: "world", tab: "patterns", isle: "main" },
  { id: "links", tab: "patterns", isle: "pair" },
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
// The pictures fill in live once the card is up (her note, Nov 5 2026: "чтобы это
// интерактивно заполнялось красиво… мы же это умеем"). Only opacity, transform and
// a line's dash move; with reduced motion everything is simply there.
const still = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const delay = (s: number): React.CSSProperties => ({ animationDelay: `${s}s` });
/** a number counting up to `to` */
const useCount = (to: number, delay: number, step = 280) => {
  const [n, setN] = useState(() => (still() ? to : 0));
  useEffect(() => {
    if (still()) return;
    let k = 0;
    let timer = window.setTimeout(function tick() { k += 1; setN(k); if (k < to) timer = window.setTimeout(tick, step); }, delay);
    return () => window.clearTimeout(timer);
  }, [to, delay, step]);
  return n;
};
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

/** Only how far hers is: the link itself is being drawn on her map, island to
 *  island, so the card stays small and clear of it. */
const Links = ({ days }: { days: number }) => <Dots k={days} n={10} from={1.6} />;
/** "4 of 5 times", counting up under the link on the map. */
const LinkCount = ({ from }: { from: number }) => {
  const { t } = useTranslation();
  const k = useCount(4, from * 1000, 280);
  return k > 0 ? <span className="tour-link-count">{t("tour.links.sample", { k, n: 5 })}</span> : null;
};

/** A month filling in, day by day. */
const Month = () => {
  const HARD = new Set([2, 3, 9, 15, 16, 22]);
  return (
    <Box example>
      <div className="mx-auto grid w-fit grid-cols-7 gap-1.5" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => i > 23
          ? <span key={i} className="h-5 w-5 rounded-full" style={{ background: "hsl(var(--foreground) / 0.1)" }} />
          : <span key={i} className="tour-pop h-5 w-5 rounded-full" style={{ background: HARD.has(i) ? "hsl(var(--strong))" : "hsl(var(--balanced) / 0.75)", ...delay(0.3 + i * 0.045) }} />)}
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

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const frames = (n: number) => new Promise<void>((r) => { const go = (k: number) => (k <= 0 ? r() : requestAnimationFrame(() => go(k - 1))); go(n); });
const findTarget = async (sel: string): Promise<HTMLElement | null> => {
  for (let i = 0; i < 60; i++) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.getBoundingClientRect().width > 0) return el;
    await wait(40);
  }
  return null;
};
const MAP_VIEW = "memap_map_view";
type Pt = { x: number; y: number };
const centre = (el: HTMLElement): Pt => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 }; };
/** an island on the map with its name under it */
const isleRects = (els: HTMLElement[]): DOMRect[] => els.flatMap((e) => {
  const lab = e.querySelector<HTMLElement>(".planet-label");
  return lab ? [e.getBoundingClientRect(), lab.getBoundingClientRect()] : [e.getBoundingClientRect()];
});
const union = (rs: DOMRect[]): DOMRect => {
  const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
  const rr = Math.max(...rs.map((r) => r.right)), b = Math.max(...rs.map((r) => r.bottom));
  return new DOMRect(l, t, rr - l, b - t);
};

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
  const [data, setData] = useState<{ trackers: Tracker[]; days: number } | null>(null);
  const shown = useRef(false);
  const target = useRef<HTMLElement | null>(null);
  const viewBefore = useRef<string | null>(null);

  useEffect(() => {
    const start = async () => {
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      try { viewBefore.current = localStorage.getItem(MAP_VIEW); } catch { viewBefore.current = null; }
      const door = getDoorState(), main = door ? trackers.find((x) => x.id === door.trackerId) : undefined;
      mainIsle.current = main ? islandOf(main) : null;
      setData({ trackers, days: countedDays(trackers, entries).length });
      setAt(0);
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
      if (!alive) return;
      if (stop.tab === "patterns") {
        try { localStorage.setItem(MAP_VIEW, "map"); } catch { /* the globe has no cards; the event below still asks */ }
        window.dispatchEvent(new CustomEvent("memap-set-map-view", { detail: "map" }));
      }
      window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: stop.tab } }));
      let r: DOMRect | null = null, link: { a: Pt; b: Pt } | undefined, isle: IslandId | undefined;
      target.current = null; placed.current = [];
      let els: HTMLElement[] = [];
      await frames(2);
      if (stop.isle) {
        // her island on the map (and, for a link, the nearest one to it)
        await findTarget("[data-isle]");
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
      } else if (stop.target) {
        const el = await findTarget(stop.target);
        if (el) els = [el];
      }
      if (!alive) return;
      if (els.length) {
        const b = union(isleRects(els));
        if (b.top < 70 || b.bottom > window.innerHeight - 90) els[0].scrollIntoView({ block: b.height > window.innerHeight * 0.5 ? "start" : "center" });
        await frames(2); await wait(120);
        if (!alive) return;
        r = union(isleRects(els));
        target.current = els[0]; placed.current = els;
        if (els.length === 2) link = { a: centre(els[0]), b: centre(els[1]) };
      }
      setView({ at, rect: r, link, isle });
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
      if (els.length) setView((v) => (v ? { ...v, rect: union(isleRects(els)), link: els.length === 2 ? { a: centre(els[0]), b: centre(els[1]) } : undefined } : v));
    };
    window.addEventListener("resize", re);
    return () => window.removeEventListener("resize", re);
  }, []);

  const door = getDoorState();
  const main = useMemo(() => (data && door ? data.trackers.find((x) => x.id === door.trackerId) : undefined), [data, door]);
  const island: IslandId = view?.isle ?? (main ? islandOf(main) : "me");

  if (at === null || !data) return null;
  const finish = () => {
    markDiscovered("tour");
    setAt(null); setView(null); setMoving(true); setLit(false); shown.current = false; target.current = null;
    // her own Map | Globe choice back
    if (viewBefore.current === "globe") {
      try { localStorage.setItem(MAP_VIEW, "globe"); } catch { /* stays on the map */ }
      window.dispatchEvent(new CustomEvent("memap-set-map-view", { detail: "globe" }));
    }
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

  const title = stop.id === "calendar"
    ? t(door ? `path.daysLabel.${door.id}` : "path.daysLabel.any")
    : stop.id === "actions" ? t("overviewCards.lighthouses")
    : stop.id === "notes" ? t("common.notes")
    : stop.id === "you" ? t("map.you")
    : t(`tour.${stop.id}.title`);
  const visual = stop.id === "world" ? <Growth island={island} />
    : stop.id === "links" ? <Links days={data.days} />
    : stop.id === "calendar" ? <Month />
    : stop.id === "chart" ? <Weeks days={data.days} />
    : stop.id === "actions" ? <Rule />
    : stop.id === "notes" ? <NoteExample />
    : stop.id === "you" ? <Treasures />
    : null;

  // the card goes where there's room: under the light, over it, or at the bottom
  const vh = window.innerHeight, pad = 8, rect = view.rect;
  const hole = rect && (stop.target || stop.isle) ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  // the link drawn on the map, dot by dot, from her island to the next one
  const linkDots = (() => {
    const l = view.link;
    if (!l) return null;
    const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, len = Math.hypot(dx, dy) || 1;
    const c = { x: (l.a.x + l.b.x) / 2 - (dy / len) * len * 0.16, y: (l.a.y + l.b.y) / 2 + (dx / len) * len * 0.16 };
    const pt = (u: number) => ({ x: (1 - u) ** 2 * l.a.x + 2 * (1 - u) * u * c.x + u * u * l.b.x, y: (1 - u) ** 2 * l.a.y + 2 * (1 - u) * u * c.y + u * u * l.b.y });
    const n = Math.max(5, Math.round(len / 17));
    const dots = Array.from({ length: n + 1 }, (_, i) => pt(i / n)).filter((p) => Math.hypot(p.x - l.a.x, p.y - l.a.y) > 54 && Math.hypot(p.x - l.b.x, p.y - l.b.y) > 54);
    return { dots, mid: pt(0.5) };
  })();
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
        <p className="mt-1 text-[16px] font-semibold leading-snug text-muted-foreground">{t(`tour.${stop.id}.line`)}</p>
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
