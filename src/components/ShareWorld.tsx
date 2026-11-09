// "Share my world" (Nov 6 2026): a story-size picture of her islands and counts,
// shown first, then sent to the share sheet. Opened from You and from the week's
// report (memap-share-world).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { getEntries, getTrackers } from "@/lib/storage";
import { getNotes } from "@/lib/notes";
import { buildIslands, buildRoutes, islandName, isNightMap } from "@/lib/islands";
import { islandEvenings } from "@/lib/globeArt";
import { ITEMS, owned, worldFacts } from "@/lib/growth";
import { pathModel } from "@/lib/pathSteps";
import { isPlayful } from "@/lib/playful";
import { drawShareCard, shareCard } from "@/lib/shareCard";

export const ShareWorld = () => {
  const { t } = useTranslation();
  const [img, setImg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("you");

  useEffect(() => {
    const go = async (e: Event) => {
      setFrom(((e as CustomEvent).detail as { from?: string } | undefined)?.from ?? "you");
      setImg(null); setOpen(true);
      const [trackers, entries, notes] = await Promise.all([getTrackers(), getEntries(), getNotes()]);
      const islands = buildIslands(trackers, entries), routes = buildRoutes(trackers, entries, islands);
      const ev = islandEvenings(trackers, entries);
      const f = worldFacts(trackers, entries, islands, routes, notes.filter((n) => !n.reasonFor).length); // "Why?" words aren't notes written
      const m = pathModel(trackers, entries);
      const treasures = ITEMS.filter((it) => owned(it.id, f)).length;
      const list = islands.map((i) => ({ id: i.id, name: islandName(t, i.id), days: ev.get(i.id) ?? 0 })).sort((a, b) => b.days - a.days);
      const url = await drawShareCard({
        islands: list,
        title: t("share.title"),
        sub: t("share.sub", { week: m.week + 1, count: f.days }),
        // no treasure count with "Games and rewards" off (Nov 9 2026)
        stats: [t("share.evenings", { count: f.days }), t("share.links", { count: routes.length }), ...(isPlayful() ? [t("share.treasures", { count: treasures })] : [])],
        footer: t("share.footer"),
        night: isNightMap(),
      });
      setImg(url);
    };
    window.addEventListener("memap-share-world", go);
    return () => window.removeEventListener("memap-share-world", go);
  }, [t]);

  const send = async () => {
    if (!img) return;
    haptics.tap();
    track("world_shared", { from });
    try { await shareCard(img, `memap-world-${new Date().toISOString().slice(0, 10)}.png`, t("share.text")); } catch { /* cancelled */ }
  };

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && setOpen(false)} ariaTitle={t("share.button")}>
      <div className="flex flex-col items-center px-5 pb-6">
        <h2 className="self-start pr-10 text-[24px] font-bold tracking-tight">{t("share.button")}</h2>
        <div className="mt-3 aspect-[9/16] w-[62%] overflow-hidden rounded-[22px] bg-foreground/[0.05] shadow-[0_18px_40px_-20px_rgba(30,40,90,.5)]">
          {img ? <img src={img} alt={t("share.title")} className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse" />}
        </div>
        <p className="mt-3 text-center text-[15px] font-semibold text-muted-foreground">{t("share.private")}</p>
        <button type="button" disabled={!img} onClick={send} className="raised-btn mt-4 w-full justify-center gap-2">
          <Share2 className="h-5 w-5" strokeWidth={2.4} /> {t("share.send")}
        </button>
      </div>
    </BottomSheet>
  );
};
