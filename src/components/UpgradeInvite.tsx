// Old users meet the new MeMap (Aurora, plan §3.8; her ask: "хочу чтоб
// людям сказали — хотите попробовать новую версию? если что вернёте назад
// старую… и онбординг что нового"). Shown once over the classic screens,
// from outside src/classic (which stays untouched). "Try it" builds their
// map from their own data in three cards, then opens it. Their path starts
// at Week 1, with earlier days folded into one chip. "Old look" in the new
// Settings goes back any time; both versions share the same storage.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getEntries, getTrackers } from "@/lib/storage";
import { buildIslands, buildRoutes, mapPic, type Island, type Route } from "@/lib/islands";
import { countedDays } from "@/lib/pathSteps";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { isoLocal } from "@/lib/doors";
import { haptics } from "@/lib/haptics";
import { Tracker } from "@/types/tracker";
import { Pressable } from "@/components/ui/pressable";

const KEY = "memap_upgrade_invite";
/** Whoever said no (or went back to the old look) is asked again two weeks
 *  later, so the new look is never lost for good (Nov 6 2026). */
const ASK_AGAIN_DAYS = 14;
const declined = () => `declined:${isoLocal(new Date())}`;
const askAgain = (v: string | null): boolean => {
  if (!v) return true;
  const at = v.startsWith("declined:") ? v.slice(9) : v === "declined" ? null : undefined;
  if (at === undefined) return false; // accepted
  if (at === null) return false; // an older "no" without a date: stays as it was
  return (Date.now() - new Date(at + "T00:00:00").getTime()) / 86_400_000 >= ASK_AGAIN_DAYS;
};

export const switchToNew = () => {
  try {
    localStorage.setItem("memap_ui", "new");
    localStorage.setItem("memap_path_start", isoLocal(new Date()));
    localStorage.setItem("memap_open_tab", "patterns");
    localStorage.setItem(KEY, "accepted");
  } catch { /* stays classic; nothing lost */ }
  window.location.reload();
};

export const switchToOld = () => {
  try {
    localStorage.setItem("memap_ui", "classic");
    localStorage.setItem(KEY, declined());
  } catch { /* stays new */ }
  window.location.reload();
};

export const UpgradeInvite = () => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"hidden" | "invite" | "building">("hidden");
  const [data, setData] = useState<{ trackers: Tracker[]; islands: Island[]; routes: Route[]; days: number } | null>(null);

  useEffect(() => {
    let seen = true;
    try { seen = !askAgain(localStorage.getItem(KEY)); } catch { /* keep hidden */ }
    if (seen) return;
    const id = window.setTimeout(async () => {
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      if (trackers.filter((tr) => !tr.archived).length === 0) return;
      const islands = buildIslands(trackers, entries);
      setData({ trackers, islands, routes: buildRoutes(trackers, entries, islands), days: countedDays(trackers, entries).length });
      setStage("invite");
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  if (stage === "hidden" || !data) return null;
  const later = () => {
    try { localStorage.setItem(KEY, declined()); } catch { /* shows again next launch */ }
    setStage("hidden");
  };
  const title = (id: string) => {
    const tr = data.trackers.find((x) => x.id === id);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };
  const route = data.routes[0];
  const rules = data.trackers.filter((tr) => !tr.archived && tr.threshold > 0).length;
  const active = data.trackers.filter((tr) => !tr.archived && tr.source !== "play").length;

  return createPortal(
    stage === "invite" ? (
      <div className="fixed inset-0 z-[80] flex items-end bg-[rgba(12,38,50,0.32)] backdrop-blur-[2px] animate-fade-in" role="dialog" aria-modal="true">
        <div className="w-full rounded-t-[28px] bg-[hsl(200_40%_96%)] px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-6 text-center text-[hsl(205_40%_18%)]">
          <div className="flex justify-center gap-1">
            {data.islands.slice(0, 4).map((i) => <img key={i.id} src={mapPic("icon_" + i.def.icon)} alt="" width={44} height={44} />)}
          </div>
          <p className="mt-4 text-[26px] font-bold leading-tight tracking-tight">{t("upgrade.title")}</p>
          <p className="mt-2 text-[17px] font-medium text-[hsl(205_20%_40%)]">{t("upgrade.line")}</p>
          <Pressable tone="teal" haptic="medium" onClick={() => setStage("building")} className="mt-6 h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
            {t("upgrade.try")}
          </Pressable>
          <button type="button" onClick={later} className="mt-2 h-12 w-full text-[16px] font-semibold text-[hsl(205_20%_40%)]">{t("upgrade.notNow")}</button>
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[hsl(200_40%_96%)] px-6 pb-8 pt-[max(env(safe-area-inset-top),24px)] text-[hsl(205_40%_18%)] animate-fade-in" role="dialog" aria-modal="true">
        <p className="mt-6 text-[28px] font-bold leading-tight tracking-tight">{t("upgrade.building")}</p>
        <p className="mt-1 text-[17px] font-medium text-[hsl(205_20%_40%)]">{t("upgrade.fromDays", { count: data.days })}</p>
        <div className="mt-6 space-y-3">
          <div className="rounded-[20px] bg-white px-5 py-4 shadow-[0_10px_24px_-14px_rgba(16,42,56,0.25)] animate-fade-in">
            <div className="flex flex-wrap gap-1">
              {data.islands.slice(0, 6).map((i) => <img key={i.id} src={mapPic("icon_" + i.def.icon)} alt="" width={36} height={36} />)}
            </div>
            <p className="mt-2 text-[18px] font-bold">{t("upgrade.islands", { count: active, k: data.islands.length })}</p>
          </div>
          <div className="rounded-[20px] bg-white px-5 py-4 shadow-[0_10px_24px_-14px_rgba(16,42,56,0.25)] animate-fade-in [animation-delay:250ms]">
            <img src={mapPic("sailboat")} alt="" width={40} height={40} />
            <p className="mt-2 text-[18px] font-bold">
              {route ? `${t("upgrade.firstLink")}: ${title(route.first)} → ${title(route.second)}` : t("upgrade.linksLater")}
            </p>
          </div>
          <div className="rounded-[20px] bg-white px-5 py-4 shadow-[0_10px_24px_-14px_rgba(16,42,56,0.25)] animate-fade-in [animation-delay:500ms]">
            <img src={mapPic("lighthouse")} alt="" width={40} height={40} />
            <p className="mt-2 text-[18px] font-bold">{t("upgrade.lighthouses", { count: rules })}</p>
          </div>
        </div>
        <div className="mt-auto pt-8">
          <Pressable tone="teal" haptic="none" onClick={() => { haptics.success(); switchToNew(); }} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
            {t("upgrade.open")}
          </Pressable>
          <p className="mt-3 text-center text-[15px] font-medium text-[hsl(205_20%_40%)]">{t("upgrade.back")}</p>
        </div>
      </div>
    ),
    document.body,
  );
};
