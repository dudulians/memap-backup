// The first link moment (Nov 6 2026, her pick: "First link moment"). The day her
// first link is found, the app takes her to her map and shows it happening: the
// two islands light up, the link is drawn between them dot by dot, the count goes
// up to how often it came, the camera (the first-link treasure) appears on the
// island, and the card says the link in her own questions' words. Started from the
// path's "Your first link!" step, or by opening World the day it's found
// (memap-link-moment). Once: src/lib/firstLink.ts.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getEntries, getTrackers } from "@/lib/storage";
import { buildIslands, buildRoutes, mapPicFor, type Route } from "@/lib/islands";
import { linkArrow, linkSentence } from "@/lib/linkText";
import { firstLinkState, markFirstLinkSeen } from "@/lib/firstLink";
import { MAP_VIEW, centre, curveDots, findTarget, frames, isleRects, union, useCount, wait, type Pt } from "@/lib/spotlight";
import { track } from "@/lib/analytics";

const delay = (s: number): React.CSSProperties => ({ animationDelay: `${s}s` });

/** "k of n times", counting up under the link */
const Count = ({ k, n, from }: { k: number; n: number; from: number }) => {
  const { t } = useTranslation();
  // about a second and a half whatever the number (17 of 20 must not take five)
  const v = useCount(k, from * 1000, Math.max(45, Math.round(1300 / Math.max(1, k))));
  return v > 0 ? <span className="tour-link-count">{t("tour.links.sample", { k: v, n })}</span> : null;
};

interface Shown { route: Route; titles: [string, string]; rect: DOMRect; a: Pt; b: Pt; aRect: DOMRect }

export const LinkMoment = () => {
  const { t } = useTranslation();
  const [shown, setShown] = useState<Shown | null>(null);
  const [lit, setLit] = useState(false);
  /** the words come once the moment has played on the map (it's seen whole first) */
  const [cardOn, setCardOn] = useState(false);
  const cardTimer = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const viewBefore = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(300);

  useEffect(() => {
    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      const routes = buildRoutes(trackers, entries, buildIslands(trackers, entries));
      const { route } = firstLinkState(routes, entries.length > 0);
      if (!route) { busy.current = false; return; }
      // her map, flat (the globe turns): the link is drawn on it
      try { viewBefore.current = localStorage.getItem(MAP_VIEW); localStorage.setItem(MAP_VIEW, "map"); } catch { viewBefore.current = null; }
      window.dispatchEvent(new CustomEvent("memap-set-map-view", { detail: "map" }));
      window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }));
      await frames(2);
      const ea = await findTarget(`[data-isle="${route.a}"]`);
      const eb = document.querySelector<HTMLElement>(`[data-isle="${route.b}"]`);
      if (!ea || !eb) { busy.current = false; return; }
      let r = union(isleRects([ea, eb]));
      if (r.top < 70 || r.bottom > window.innerHeight - 90) {
        ea.scrollIntoView({ block: "center" });
        await frames(2); await wait(120);
        r = union(isleRects([ea, eb]));
      }
      // no room for the card over or under the two islands: scroll her map so it fits
      // under them (nothing of the two islands, nor the camera, under the card)
      const vh = window.innerHeight, CARD = 300, room = (rr: DOMRect) => ({ above: rr.top - 8 - 52 - 14, below: vh - 92 - (rr.bottom + 8) - 14 });
      const sea = ea.closest<HTMLElement>(".map-sea");
      if (sea && room(r).above < CARD && room(r).below < CARD) {
        sea.scrollBy({ top: Math.max(0, r.bottom + 8 - (vh - 92 - 14 - CARD)) });
        await frames(2); await wait(80);
        r = union(isleRects([ea, eb]));
      }
      const byId = new Map(trackers.map((x) => [x.id, x]));
      const of = (id: string) => byId.get(id);
      // the map's own drawn links step back while this one is drawn; the camera that
      // stands on the island (the first-link treasure) glows instead of a second one
      document.documentElement.classList.add("link-moment-on");
      ea.querySelector(".it-camera")?.classList.add("link-moment-new");
      setShown({ route, titles: [linkArrow(t, route, of), linkSentence(t, route, of)], rect: r, a: centre(ea), b: centre(eb), aRect: ea.getBoundingClientRect() });
      await frames(2);
      setLit(true);
      haptics.success();
      cardTimer.current = window.setTimeout(() => setCardOn(true), 2300);
    };
    window.addEventListener("memap-link-moment", run);
    return () => window.removeEventListener("memap-link-moment", run);
  }, []);
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [shown]);

  if (!shown) return null;
  const { route } = shown;
  const close = (open: boolean) => {
    haptics.tap();
    track("first_link_seen", { action: open ? "open" : "close", next_day: route.nextDay });
    markFirstLinkSeen();
    document.documentElement.classList.remove("link-moment-on");
    document.querySelectorAll(".link-moment-new").forEach((el) => el.classList.remove("link-moment-new"));
    window.clearTimeout(cardTimer.current);
    setLit(false); setCardOn(false); setShown(null); busy.current = false;
    if (open) {
      window.dispatchEvent(new CustomEvent("memap-open-link", { detail: { a: route.a, b: route.b } }));
    } else if (viewBefore.current === "globe") {
      try { localStorage.setItem(MAP_VIEW, "globe"); } catch { /* stays flat */ }
      window.dispatchEvent(new CustomEvent("memap-set-map-view", { detail: "globe" }));
    }
  };

  const vh = window.innerHeight, pad = 8, r = shown.rect;
  const hole = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  const { dots, mid } = curveDots(shown.a, shown.b);
  const chipAt = Math.min(1, 0.35 + dots.length * 0.07);
  const TOP = 52, BOTTOM = 92, GAP = 14;
  const below = vh - BOTTOM - (hole.y + hole.h) - GAP, above = hole.y - TOP - GAP;
  const place: React.CSSProperties = below >= cardH ? { top: hole.y + hole.h + GAP }
    : above >= cardH ? { bottom: vh - hole.y + GAP }
    : below >= above ? { bottom: BOTTOM } : { top: TOP };
  const sentence = shown.titles[1];

  return createPortal(
    <div className="tour fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={t("firstLink.title")}>
      <svg className="tour-veil" aria-hidden="true">
        <defs>
          <mask id="link-moment-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect className={cn("tour-cut", lit && "is-open")} x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={22} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" className="tour-shade" mask="url(#link-moment-mask)" />
      </svg>
      <div className={cn("tour-ring", lit && "is-on")} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
      {lit && (
        <div aria-hidden="true">
          <svg className="tour-link">
            {dots.map((p, i) => <circle key={i} className="tour-pop" style={delay(0.35 + i * 0.07)} cx={p.x} cy={p.y} r="4.5" />)}
          </svg>
          <span className="tour-link-chip tour-pop" style={{ left: mid.x - 18, top: mid.y - 18, ...delay(chipAt) }}><Link2 className="h-4 w-4" strokeWidth={2.6} /></span>
          <span className="tour-link-under" style={{ left: mid.x, top: mid.y + 24 }}><Count k={route.k} n={route.n} from={chipAt + 0.25} /></span>
        </div>
      )}
      <div className="fixed left-4 right-4 mx-auto max-w-[380px]" style={place}>
        <div ref={cardRef} className={cn("tour-card surface rounded-[24px] px-5 pb-4 pt-4", !cardOn && "is-moving")}>
          <p className="text-[24px] font-bold leading-tight tracking-tight">{t("firstLink.title")}</p>
          <p className="mt-1.5 text-[16px] font-semibold leading-snug text-muted-foreground">{sentence}</p>
          <div className="mt-3 flex items-center gap-2.5 rounded-[16px] bg-foreground/[0.035] px-3 py-2">
            <img aria-hidden="true" className="h-9 w-9 object-contain" src={mapPicFor("camera", false)} alt="" />
            <span className="text-[15px] font-bold">{t("firstLink.treasure")}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => close(false)} className="h-11 px-1 text-[15px] font-semibold text-muted-foreground">{t("firstLink.close")}</button>
            <button type="button" onClick={() => close(true)} className="raised-btn is-small shrink-0 px-6">{t("firstLink.open")}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
