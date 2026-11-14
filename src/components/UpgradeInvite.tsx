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
import { buildIslands, buildRoutes, linkWorthShowing, LINKS_TOP, mapPic, type Island, type Route } from "@/lib/islands";
import { computeCorrelations } from "@/lib/correlations";
import { countedDays } from "@/lib/pathSteps";
import { isoLocal } from "@/lib/doors";
import { haptics } from "@/lib/haptics";
import { Tracker } from "@/types/tracker";
import { Pressable } from "@/components/ui/pressable";
import { track } from "@/lib/analytics";
import { startOldTour } from "@/components/OldUserTour";

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

/** Where the switch was made (Nov 11 2026, her ask to see who stays, who goes back and why). */
export type SwitchFrom = "invite" | "settings" | "card" | "tour";
export const switchToNew = (from: SwitchFrom = "invite") => {
  track("ui_switched", { to: "new", from });
  try {
    localStorage.setItem("memap_ui", "new");
    // the path starts today only the first time; coming back keeps her weeks and reports (QA, Nov 8 2026)
    if (!localStorage.getItem("memap_path_start")) localStorage.setItem("memap_path_start", isoLocal(new Date()));
    localStorage.setItem(KEY, "accepted");
    // the first time: the old users' onboarding opens in the new look (Nov 8 2026)
    startOldTour();
  } catch { /* stays classic; nothing lost */ }
  window.location.reload();
};

export const switchToOld = (from: SwitchFrom = "settings") => {
  track("ui_switched", { to: "classic", from });
  try {
    localStorage.setItem("memap_ui", "classic");
    localStorage.setItem(KEY, declined());
  } catch { /* stays new */ }
  window.location.reload();
};

export const UpgradeInvite = () => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"hidden" | "invite">("hidden");
  const [data, setData] = useState<{ trackers: Tracker[]; islands: Island[]; routes: Route[]; days: number; links: number } | null>(null);

  useEffect(() => {
    let seen = true;
    try { seen = !askAgain(localStorage.getItem(KEY)); } catch { /* keep hidden */ }
    if (seen) return;
    let again = false;
    try { again = (localStorage.getItem(KEY) ?? "").startsWith("declined"); } catch { /* first time */ }
    const id = window.setTimeout(async () => {
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      if (trackers.filter((tr) => !tr.archived).length === 0) return;
      const islands = buildIslands(trackers, entries);
      // links: the same count as the World tile, not only the routes drawn between islands (old-user walk, Nov 14 2026:
      // the invite said 2, the World a minute later 6)
      setData({ trackers, islands, routes: buildRoutes(trackers, entries, islands), days: countedDays(trackers, entries).length, links: computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing).length });
      setStage("invite");
      // the invite, and whether it's the second ask (two weeks after a "Not now")
      track("ui_invite_shown", { again });
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  if (stage === "hidden" || !data) return null;
  const later = () => {
    track("ui_invite_later");
    try { localStorage.setItem(KEY, declined()); } catch { /* shows again next launch */ }
    setStage("hidden");
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end bg-[rgba(12,38,50,0.32)] backdrop-blur-[2px] animate-fade-in" role="dialog" aria-modal="true">
      <div className="w-full rounded-t-[28px] bg-[hsl(200_40%_96%)] px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-6 text-center text-[hsl(205_40%_18%)]">
        <div className="flex justify-center gap-1">
          {data.islands.slice(0, 5).map((i) => <img key={i.id} src={mapPic("icon_" + i.def.icon)} alt="" width={44} height={44} />)}
        </div>
        <p className="mt-4 text-[26px] font-bold leading-tight tracking-tight">{t("upgrade.worldTitle")}</p>
        {/* their own numbers (board 45: "ask, not force") */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([[data.days, "upgrade.tileDays"], [data.islands.length, "upgrade.tileIslands"], [data.links, "upgrade.tileLinks"]] as const).map(([n, k]) => (
            <div key={k} className="rounded-[18px] bg-white px-2 py-3 shadow-[0_8px_20px_-14px_rgba(16,42,56,0.3)]">
              <p className="text-[28px] font-bold leading-none tabular-nums">{n}</p>
              <p className="mt-1.5 text-[14px] font-semibold text-[hsl(205_20%_40%)]">{t(k, { count: n })}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[16px] font-medium text-[hsl(205_20%_40%)]">{t("upgrade.nothingLost")}</p>
        <Pressable tone="teal" haptic="none" onClick={() => { haptics.success(); switchToNew("invite"); }} className="mt-5 h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
          {t("upgrade.showMe")}
        </Pressable>
        <button type="button" onClick={later} className="mt-2 h-12 w-full text-[16px] font-semibold text-[hsl(205_20%_40%)]">{t("upgrade.notNow")}</button>
      </div>
    </div>,
    document.body,
  );
};
