// "Test one change" (src/lib/experiments.ts): pick an island and one small
// change, try it for 7 days; then see how that island's hard days went on
// days with the change and without. Counts only, never a verdict. Same
// full-screen frame as the games.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { buildIslands, islandName, mapPic, type IslandId } from "@/lib/islands";
import { islandHsl } from "@/lib/islandColors";
import { EXPERIMENT_DAYS, experimentResult, finishExperiment, ideasFor, startExperiment, type Experiment } from "@/lib/experiments";
import { IslandPicture } from "@/components/IslandPicture";
import { Pressable } from "@/components/ui/pressable";

export const ExperimentSheet = ({ mode, experiment, trackers, entries, island: startIsland, onClose }: {
  mode: "pick" | "result";
  experiment?: Experiment | null;
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** island to suggest first (from an island's sheet) */
  island?: IslandId;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const islands = useMemo(() => buildIslands(trackers, entries).filter((i) => i.trackerIds.length > 0), [trackers, entries]);
  // The stormiest island first: that's where a change can show.
  const first = startIsland ?? [...islands].sort((a, b) => b.hardDays - a.hardDays)[0]?.id;
  const [island, setIsland] = useState<IslandId | undefined>(first);
  const [idea, setIdea] = useState<string | null>(null);
  const [own, setOwn] = useState("");
  const [started, setStarted] = useState<Experiment | null>(null);

  const change = idea ? t(`experiment.idea.${idea}.change`) : own.trim();
  const question = idea ? t(`experiment.idea.${idea}.q`) : own.trim() ? `${own.trim().replace(/[?？]+$/, "")}?` : "";
  const start = async () => {
    if (!island || !change) return;
    haptics.rise();
    setStarted(await startExperiment(island, change, question));
  };

  const result = useMemo(() => (mode === "result" && experiment ? experimentResult(experiment, trackers, entries) : null), [mode, experiment, trackers, entries]);
  // The result screen: a garden grew.
  useEffect(() => { if (result) haptics.sparkle(); }, [result]);
  const finish = async (keep: boolean) => {
    if (!experiment) return;
    haptics.success();
    await finishExperiment(experiment.id, keep);
    onClose();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          <FlaskConical className="h-4 w-4 text-[hsl(152_36%_44%)]" strokeWidth={2.4} />{t("experiment.title")}
        </p>

        {mode === "pick" && !started && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{t("experiment.ask", { count: EXPERIMENT_DAYS })}</p>
            {/* Which island */}
            <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 scrollbar-hide">
              {islands.map((isl) => (
                <button key={isl.id} type="button" onClick={() => { haptics.tap(); setIsland(isl.id); setIdea(null); }} aria-pressed={island === isl.id}
                  className={cn("inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] pl-1.5 pr-4 text-[15px] font-semibold",
                    island === isl.id ? "font-bold" : "border-foreground/[0.14] bg-foreground/[0.04]")}
                  style={island === isl.id ? { borderColor: `hsl(${islandHsl(isl.id)})`, background: `hsl(${islandHsl(isl.id)} / 0.14)` } : undefined}>
                  <img src={mapPic("icon_" + isl.def.icon)} alt="" width={28} height={28} />
                  {islandName(t, isl.id)}
                </button>
              ))}
            </div>
            {/* Which change */}
            {island && (
              <div className="mt-4 space-y-2.5">
                {ideasFor(island).map((k) => (
                  <button key={k} type="button" onClick={() => { haptics.tap(); setIdea(k); setOwn(""); }} aria-pressed={idea === k}
                    className={cn("surface flex min-h-14 w-full items-center rounded-2xl px-5 py-3 text-left text-[17px] font-semibold",
                      idea === k && "ring-2 ring-[hsl(152_36%_44%)]")}>
                    {t(`experiment.idea.${k}.change`)}
                  </button>
                ))}
                <input value={own} onChange={(e) => { setOwn(e.target.value); setIdea(null); }} placeholder={t("experiment.own")} maxLength={60}
                  className="h-14 w-full rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-5 text-[17px] outline-none focus:ring-2 focus:ring-[hsl(152_36%_44%)]" />
              </div>
            )}
            <div className="mt-auto pt-8">
              <p className="mb-3 text-center text-[15px] font-medium text-muted-foreground">{t("experiment.how")}</p>
              <Pressable tone="teal" haptic="none" onClick={start} disabled={!island || !change} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("experiment.start")}
              </Pressable>
            </div>
          </>
        )}

        {mode === "pick" && started && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
            <IslandPicture id={started.island as IslandId} width={170} />
            <p className="mt-4 text-[26px] font-bold leading-tight tracking-tight">{t("experiment.started")}</p>
            <p className="mt-2 text-[17px] font-medium text-muted-foreground">{t("experiment.startedLine", { island: islandName(t, started.island as IslandId), count: EXPERIMENT_DAYS })}</p>
            <Pressable tone="teal" haptic="none" onClick={onClose} className="mt-8 h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("path.continue")}
            </Pressable>
          </div>
        )}

        {mode === "result" && experiment && result && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{experiment.change}</p>
            <p className="mt-1 text-[17px] font-medium text-muted-foreground">{t("experiment.didDays", { k: result.did, count: EXPERIMENT_DAYS })}</p>
            <div className="surface mt-5 rounded-[22px] px-5 py-4">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("experiment.hardOn", { island: islandName(t, experiment.island as IslandId) })}</p>
              <p className="mt-2 text-[19px] font-bold leading-snug">{t("experiment.withIt", { k: result.withChange[0], count: result.withChange[1] })}</p>
              <p className="mt-1 text-[17px] font-semibold leading-snug text-muted-foreground">{t("experiment.withoutIt", { k: result.without[0], count: result.without[1] })}</p>
              {(result.withChange[1] < 3 || result.without[1] < 2) && <p className="mt-2 text-[14px] font-medium text-muted-foreground">{t("experiment.few")}</p>}
              <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <img src={mapPic("orange_tree")} alt="" width={64} height={56} className="object-contain" />
              <p className="text-[17px] font-semibold leading-snug">{t("experiment.garden", { island: islandName(t, experiment.island as IslandId) })}</p>
            </div>
            <div className="mt-auto space-y-2 pt-8">
              <Pressable tone="teal" haptic="none" onClick={() => finish(true)} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("experiment.keep")}
              </Pressable>
              <button type="button" onClick={() => finish(false)} className="h-12 w-full text-[16px] font-semibold text-muted-foreground">{t("experiment.stop")}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
