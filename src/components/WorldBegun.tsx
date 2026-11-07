// The end of onboarding v7 (Nov 6 2026; board 74 screens 6–7, board 75): after the first
// real check-in, "Your world has begun" — her topic's island appears, honestly at its first
// stage, with the ladder and the evenings to the next one; then a reminder as a sheet.
// "Tonight" (daytime onboarding): "Your world is waiting" + the reminder. All "Not sure":
// nothing saved, no reward. Events: memap-world-begun {date}, memap-world-waiting.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { getEntries, getTrackers } from "@/lib/storage";
import { getDoorState } from "@/lib/doors";
import { art, artOf, islandEvenings, toNextStage } from "@/lib/globeArt";
import { islandName, islandOf, mapPicFor, type IslandId } from "@/lib/islands";
import { getNotificationSettings, requestNotificationPermissionDetailed, saveNotificationSettings, scheduleNotification } from "@/lib/notifications";
import { GrowthLadder } from "./IslandStats";

type Shown = { kind: "begun"; island: IslandId; days: number; date: string } | { kind: "waiting" } | { kind: "nothing"; date: string; ids?: string[] };
const TIMES = ["20:00", "21:00", "22:00"];

const Reminder = ({ onDone, inline = false }: { onDone: () => void; inline?: boolean }) => {
  const { t } = useTranslation();
  const [time, setTime] = useState(() => { const s = getNotificationSettings().time; return TIMES.includes(s) ? s : "21:00"; });
  const [other, setOther] = useState(false);
  const turnOn = async () => {
    haptics.tap();
    track("onboarding_reminder", { on: true, time });
    try {
      const r = await requestNotificationPermissionDetailed();
      if (r.granted) { const next = { ...getNotificationSettings(), enabled: true, time }; saveNotificationSettings(next); await scheduleNotification(next); }
    } catch { /* never blocks */ }
    onDone();
  };
  return (
    <div className={cn(inline ? "surface mt-5 rounded-[22px] px-4 py-4" : "")}>
      <p className="text-[22px] font-bold leading-tight">{t("onb7.remindTitle")}</p>
      <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{t("onb7.remindLine")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {TIMES.map((x) => (
          <button key={x} type="button" aria-pressed={!other && time === x} onClick={() => { haptics.tap(); setOther(false); setTime(x); }}
            className={cn("surface h-12 rounded-[16px] text-[17px] font-bold tabular-nums", !other && time === x && "pick-on")}>{x}</button>
        ))}
        {other ? (
          <input type="time" value={time} onChange={(e) => setTime(e.target.value || "21:00")} aria-label={t("onb7.remindOther")}
            className="surface pick-on h-12 rounded-[16px] px-3 text-center text-[17px] font-bold outline-none" />
        ) : (
          <button type="button" onClick={() => { haptics.tap(); setOther(true); }} className="surface h-12 rounded-[16px] text-[17px] font-bold">{t("onb7.remindOther")}</button>
        )}
      </div>
      <button type="button" onClick={() => void turnOn()} className="raised-btn mt-4 w-full justify-center">{t("onb7.remindOn")}</button>
      <button type="button" onClick={() => { haptics.tap(); track("onboarding_reminder", { on: false }); onDone(); }} className="mt-1 h-11 w-full text-[16px] font-bold text-muted-foreground">{t("onb7.notNow")}</button>
    </div>
  );
};

export const WorldBegun = () => {
  const { t } = useTranslation();
  const [shown, setShown] = useState<Shown | null>(null);
  const [sheet, setSheet] = useState(false);
  /** the reminder was offered; and the tour waits for it ("Show me around" tapped first) */
  const asked = useRef(false), tourAfter = useRef(false);

  useEffect(() => {
    const begun = async (e: Event) => {
      const { date, ids } = (e as CustomEvent<{ date: string; ids?: string[] }>).detail ?? {};
      const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
      const saved = entries.filter((x) => x.date === date && typeof x.value === "boolean");
      if (saved.length === 0) { setShown({ kind: "nothing", date, ids }); track("world_begun", { saved: 0 }); return; }
      const door = getDoorState();
      const main = trackers.find((x) => x.id === door?.trackerId) ?? trackers.find((x) => x.id === saved[0].trackerId);
      const island = main ? islandOf(main) : ("other" as IslandId);
      const days = islandEvenings(trackers, entries).get(island) ?? 1;
      setShown({ kind: "begun", island, days, date });
      track("world_begun", { saved: saved.length, island });
      // the reminder comes after the joy, not instead of it
      asked.current = false; tourAfter.current = false;
      if (!getNotificationSettings().enabled) window.setTimeout(() => { if (!asked.current) { asked.current = true; setSheet(true); } }, 1600);
    };
    const waiting = () => { setShown({ kind: "waiting" }); track("world_waiting"); };
    window.addEventListener("memap-world-begun", begun);
    window.addEventListener("memap-world-waiting", waiting);
    return () => { window.removeEventListener("memap-world-begun", begun); window.removeEventListener("memap-world-waiting", waiting); };
  }, []);

  if (!shown) return null;
  const close = () => { setSheet(false); setShown(null); };
  // her note, Nov 6 2026: after onboarding nothing showed Today and its steps. Every
  // ending goes on to Today and the tour of it, then the World ("Look around").
  const closeAndTour = () => {
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } }));
    window.dispatchEvent(new CustomEvent("memap-start-tour"));
    window.setTimeout(close, 320);
  };
  const left = shown.kind === "begun" ? toNextStage(shown.days) : null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background animate-fade-in" role="dialog" aria-modal="true"
      aria-label={shown.kind === "begun" ? t("onb7.begunTitle") : shown.kind === "waiting" ? t("onb7.waitTitle") : t("onb7.nothingTitle")}>
      <div aria-hidden="true" className="memap-sea-bg memap-path-bg pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-5 pb-safe pt-safe">
        <div className="relative mx-auto mt-10 flex h-[230px] w-full items-end justify-center" aria-hidden="true">
          {shown.kind === "begun" && <span className="world-begun-glow absolute left-1/2 top-[44%] h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full" />}
          {shown.kind === "begun" && <img src={mapPicFor("sparkles", false)} alt="" className="world-begun-spark absolute left-[18%] top-[12%] w-8" />}
          <span className={cn("relative block", shown.kind === "begun" ? "world-begun-rise w-[52%]" : "w-[46%] opacity-90")}>
            <img className="art-day block w-full" src={art(shown.kind === "begun" ? artOf(shown.island, shown.days) : "cloud_island_03", false)} alt="" />
            <img className="art-night block w-full" src={art(shown.kind === "begun" ? artOf(shown.island, shown.days) : "cloud_island_03", true)} alt="" />
          </span>
        </div>
        {shown.kind === "begun" && (
          <>
            <h1 className="mt-6 text-center text-[30px] font-bold leading-tight tracking-tight">{t("onb7.begunTitle")}</h1>
            <p className="mt-2 text-center text-[17px] font-semibold leading-snug text-muted-foreground">{t("onb7.begunLine", { island: islandName(t, shown.island) })}</p>
            <div className="mt-5"><GrowthLadder island={shown.island} days={shown.days} /></div>
            {left !== null && <p className="text-center text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("onb7.begunNext", { count: left })}</p>}
            <div className="min-h-6 flex-1" />
            <button type="button" onClick={() => {
              haptics.tap();
              // the reminder is asked once, before the tour, even when the button comes first
              if (!asked.current && !getNotificationSettings().enabled) { asked.current = true; tourAfter.current = true; setSheet(true); return; }
              closeAndTour();
            }}
              className="raised-btn mb-5 w-full justify-center">{t("onb7.showAround")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button>
          </>
        )}
        {shown.kind === "waiting" && (
          <>
            <h1 className="mt-6 text-center text-[29px] font-bold leading-tight tracking-tight">{t("onb7.waitTitle")}</h1>
            <p className="mt-2 text-center text-[17px] font-semibold leading-snug text-muted-foreground">{t("onb7.waitLine")}</p>
            {getNotificationSettings().enabled
              ? <><div className="min-h-6 flex-1" /><button type="button" onClick={() => { haptics.tap(); closeAndTour(); }} className="raised-btn mb-5 w-full justify-center">{t("onb7.showAround")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button></>
              : <Reminder inline onDone={closeAndTour} />}
          </>
        )}
        {shown.kind === "nothing" && (
          <>
            <h1 className="mt-6 text-center text-[29px] font-bold leading-tight tracking-tight">{t("onb7.nothingTitle")}</h1>
            <p className="mt-2 text-center text-[17px] font-semibold leading-snug text-muted-foreground">{t("onb7.nothingLine")}</p>
            <div className="min-h-6 flex-1" />
            <button type="button" onClick={() => { haptics.tap(); const d = shown; close(); window.dispatchEvent(new CustomEvent("memap-first-checkin", { detail: { date: d.date, ids: d.ids } })); }}
              className="mb-1 h-11 w-full text-[16px] font-bold text-muted-foreground">{t("onb7.answerAgain")}</button>
            <button type="button" onClick={() => { haptics.tap(); closeAndTour(); }} className="raised-btn mb-5 w-full justify-center">{t("onb7.showAround")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button>
          </>
        )}
      </div>
      {/* the reminder as a sheet over the reward */}
      {sheet && shown.kind === "begun" && (
        <div className="fixed inset-0 z-[95] flex items-end bg-[rgba(14,24,60,.32)] animate-fade-in" onClick={() => setSheet(false)}>
          <div className="w-full rounded-t-[28px] bg-white px-5 pb-safe pt-3 dark:bg-[hsl(var(--surface))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/15" />
            <Reminder onDone={() => { if (tourAfter.current) closeAndTour(); else setSheet(false); }} />
          </div>
        </div>
      )}
    </div>
  );
};
