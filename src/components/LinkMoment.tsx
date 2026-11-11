// The first link moment (Nov 6 2026, her pick: "First link moment"). The day her
// first link is found, the app takes her to her map and shows it happening: the
// two islands light up, the link is drawn between them dot by dot, the count goes
// up to how often it came, the camera (the first-link treasure) appears on the
// island, and the card says the link in her own questions' words. Started from the
// path's "Your first link!" step, or by opening World the day it's found
// (memap-link-moment). Once: src/lib/firstLink.ts.
// Since Nov 11 2026 it plays on the open globe, as in reel 16 «Целый мир» (her "Да, добавляем"): the globe turns to
// the two islands, a warm light runs along the route, both islands light up, the link's sign comes at the end
// (PlanetGlobe, "memap-route-light"); then the card. No dimmed box, no count pill over the labels.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getEntries, getTrackers } from "@/lib/storage";
import { buildIslands, buildRoutes, type Route } from "@/lib/islands";
import { linkCount, linkHead } from "@/lib/linkText";
import { firstLinkState, markFirstLinkSeen } from "@/lib/firstLink";
import { findTarget, focusGlobe, frames, isleRects, union, wait } from "@/lib/spotlight";
import { track } from "@/lib/analytics";

interface Shown { route: Route; titles: [string, string]; rect: DOMRect }

export const LinkMoment = () => {
  const { t } = useTranslation();
  const [shown, setShown] = useState<Shown | null>(null);
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
      window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }));
      await frames(2);
      await findTarget(`[data-isle="${route.a}"]`);
      await focusGlobe([route.a, route.b]);
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
      // the camera that stands on the island (the first-link treasure) glows
      ea.querySelector(".it-camera")?.classList.add("link-moment-new");
      setShown({ route, titles: [linkHead(t, route, of), linkCount(t, route)], rect: r });
      await frames(2);
      // the light along the route, on the open globe (it is turned to them already)
      window.dispatchEvent(new CustomEvent("memap-route-light", { detail: { a: route.a, b: route.b, fresh: true, focus: false } }));
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
    setCardOn(false); setShown(null); busy.current = false;
    if (open) {
      window.dispatchEvent(new CustomEvent("memap-open-link", { detail: { a: route.a, b: route.b } }));
    } else if (viewBefore.current === "globe") {
    }
  };

  const vh = window.innerHeight, pad = 8, r = shown.rect;
  const hole = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  const TOP = 52, BOTTOM = 92, GAP = 14;
  const below = vh - BOTTOM - (hole.y + hole.h) - GAP, above = hole.y - TOP - GAP;
  const place: React.CSSProperties = below >= cardH ? { top: hole.y + hole.h + GAP }
    : above >= cardH ? { bottom: vh - hole.y + GAP }
    : below >= above ? { bottom: BOTTOM } : { top: TOP };
  const [head, count] = shown.titles;

  return createPortal(
    <div data-link-moment className="tour fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={t("firstLink.title")}>
      <div className="fixed left-4 right-4 mx-auto max-w-[380px]" style={place}>
        <div ref={cardRef} className={cn("tour-card surface rounded-[24px] px-5 pb-4 pt-4", !cardOn && "is-moving")}>
          <p className="text-[24px] font-bold leading-tight tracking-tight">{t("firstLink.title")}</p>
          <p className="mt-1.5 text-[17px] font-bold leading-snug">{head}</p>
          <p className="mt-0.5 text-[15px] font-medium leading-snug text-muted-foreground">{count}</p>
          <div className="mt-3 flex items-center gap-2.5 rounded-[16px] bg-foreground/[0.035] px-3 py-2">
            {/* a link sign: a link is never a gift, and the camera picture here read as one (Nov 10 2026) */}
            <Link2 aria-hidden="true" className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
            <span className="text-[15px] font-bold">{t("firstLink.found")}</span>
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
