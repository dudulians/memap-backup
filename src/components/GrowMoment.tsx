// An island growing in front of her (Nov 6 2026, from the hooks list: "the island
// grows before your eyes"). The day an island reaches its next stage, the app takes
// her to her map: the island lights up, its old picture fades away while the new one
// swells in with a burst, then the card says what it grew into and what comes next.
// Started from the path's "grew" step or the toast (memap-grow-moment), or by opening
// World that day (MapTab), once per island and stage.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { ASPECT, LADDER_WIDTH, STAGE_AT, STAGE_SCALE, art, artOf, toNextStage, islandEvenings, type Stage } from "@/lib/globeArt";
import { islandName, isNightMap, mapPicFor, type IslandId } from "@/lib/islands";
import { getEntries, getTrackers } from "@/lib/storage";
import { findTarget, focusGlobe, frames, isleRects, union, wait } from "@/lib/spotlight";
import { markGrowSeen } from "@/lib/growMoment";
import { track } from "@/lib/analytics";

interface Shown { island: IslandId; stage: Stage; days: number; rect: DOMRect; art: DOMRect }

export const GrowMoment = () => {
  const { t } = useTranslation();
  const [shown, setShown] = useState<Shown | null>(null);
  const [lit, setLit] = useState(false);
  const [cardOn, setCardOn] = useState(false);
  const busy = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const viewBefore = useRef<string | null>(null);
  const isleEl = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(300);

  useEffect(() => {
    const run = async (e: Event) => {
      const d = (e as CustomEvent).detail as { island: IslandId; stage: Stage } | undefined;
      if (!d || busy.current || d.stage < 2) return;
      busy.current = true;
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      const days = islandEvenings(trackers, entries).get(d.island) ?? 0;
      window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }));
      await frames(2);
      await findTarget(`[data-isle="${d.island}"]`);
      await focusGlobe([d.island]);
      const el = await findTarget(`[data-isle="${d.island}"]`);
      if (!el) { busy.current = false; return; }
      let r = union(isleRects([el]));
      if (r.top < 70 || r.bottom > window.innerHeight - 90) { el.scrollIntoView({ block: "center" }); await frames(2); await wait(120); r = union(isleRects([el])); }
      const pic = el.querySelector<HTMLElement>(".island-art:not([style*='display: none'])") ?? el;
      isleEl.current = el;
      el.classList.add("grow-pulse");
      setShown({ island: d.island, stage: d.stage, days, rect: r, art: (pic.getBoundingClientRect().width ? pic : el).getBoundingClientRect() });
      await frames(2);
      setLit(true);
      haptics.success();
      timer.current = window.setTimeout(() => setCardOn(true), 1700);
    };
    window.addEventListener("memap-grow-moment", run);
    return () => window.removeEventListener("memap-grow-moment", run);
  }, []);
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [shown]);

  if (!shown) return null;
  const close = (open: boolean) => {
    haptics.tap();
    track("island_grew_seen", { stage: shown.stage, action: open ? "open" : "close" });
    markGrowSeen(shown.island, shown.stage);
    window.clearTimeout(timer.current);
    isleEl.current?.classList.remove("grow-pulse");
    const island = shown.island;
    setLit(false); setCardOn(false); setShown(null); busy.current = false;
    window.dispatchEvent(new Event("memap-grow-seen"));
    if (open) window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island } }));
  };

  // the old picture, the size it stood at, fading off the new one
  const night = isNightMap();
  const oldName = artOf(shown.island, STAGE_AT[shown.stage - 2]);
  const a = shown.art, k = STAGE_SCALE[(shown.stage - 1) as Stage] / STAGE_SCALE[shown.stage];
  const oldW = a.width * k, oldH = oldW * (ASPECT[oldName] ?? 0.55);
  const oldBox = { left: a.left + (a.width - oldW) / 2, top: a.bottom - oldH, width: oldW };
  const vh = window.innerHeight, pad = 10, r = shown.rect;
  const hole = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  const TOP = 52, BOTTOM = 92, GAP = 14;
  const below = vh - BOTTOM - (hole.y + hole.h) - GAP, above = hole.y - TOP - GAP;
  const place: React.CSSProperties = below >= cardH ? { top: hole.y + hole.h + GAP } : above >= cardH ? { bottom: vh - hole.y + GAP } : below >= above ? { bottom: BOTTOM } : { top: TOP };
  const left = toNextStage(shown.days);
  const name = islandName(t, shown.island);

  return createPortal(
    <div className="tour fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={t("growMoment.title", { island: name })}>
      <svg className="tour-veil" aria-hidden="true">
        <defs>
          <mask id="grow-moment-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect className={cn("tour-cut", lit && "is-open")} x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={24} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" className="tour-shade" mask="url(#grow-moment-mask)" />
      </svg>
      <div className={cn("tour-ring", lit && "is-on")} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
      {lit && (
        <div aria-hidden="true">
          <img className="grow-old" src={art(oldName, night)} alt="" style={oldBox} />
          <span className="grow-burst" style={{ left: a.left + a.width / 2, top: a.top + a.height * 0.55 }} />
          <img className="grow-spark tour-pop" src={mapPicFor("sparkles", night)} alt="" style={{ left: a.right - a.width * 0.2, top: a.top - 6, animationDelay: "0.9s" }} />
        </div>
      )}
      <div className="fixed left-4 right-4 mx-auto max-w-[380px]" style={place}>
        <div ref={cardRef} className={cn("tour-card surface rounded-[24px] px-5 pb-4 pt-4", !cardOn && "is-moving")}>
          <p className="text-[24px] font-bold leading-tight tracking-tight">{t("growMoment.title", { island: name })}</p>
          <p className="mt-1 text-[16px] font-semibold text-muted-foreground">{left === null ? t("path.stageFull", { stage: t(`path.stage${shown.stage}`) }) : t("path.stageLine", { stage: t(`path.stage${shown.stage}`), count: left })}</p>
          {/* the four stages, the one now ringed */}
          <div className="mt-3 grid grid-cols-4 items-end gap-1 rounded-[16px] bg-foreground/[0.035] px-2 py-2" aria-hidden="true">
            {([1, 2, 3, 4] as const).map((s) => (
              <span key={s} className={cn("flex h-[44px] items-end justify-center rounded-[12px]", s === shown.stage && "pick-on", s > shown.stage && "opacity-45 saturate-50")}>
                <img className="max-h-full object-contain" style={{ width: `${LADDER_WIDTH[s]}%` }} src={art(artOf(shown.island, STAGE_AT[s - 1]), night)} alt="" />
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => close(false)} className="h-11 px-1 text-[15px] font-semibold text-muted-foreground">{t("firstLink.close")}</button>
            <button type="button" onClick={() => close(true)} className="raised-btn is-small shrink-0 px-6">{t("growMoment.see")}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
