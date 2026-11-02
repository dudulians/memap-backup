// "Predict" (src/lib/predict.ts): guess how up to three of tonight's
// questions will go, then, once answered, see how well you know your days.
// Same full-screen frame as GuessGame. Never a loss: a miss "surprised you".
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { localizeTrackerQuestion } from "@/lib/trackerLocalize";
import { isoLocal } from "@/lib/doors";
import { mapPic } from "@/lib/islands";
import { guessesFor, markRevealed, saveGuesses, type PredictState } from "@/lib/predict";
import { Pressable } from "@/components/ui/pressable";

export const PredictGame = ({ state, trackers, entries, onClose }: {
  state: Extract<PredictState, { stage: "guess" | "reveal" }>;
  trackers: Tracker[];
  entries: TrackerEntry[];
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [guesses, setGuesses] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const question = (id: string) => {
    const tr = trackers.find((x) => x.id === id);
    return tr ? localizeTrackerQuestion(tr.questionText, tr.title) : "";
  };
  const forTomorrow = state.date !== isoLocal(new Date());

  // Reveal: what she guessed next to what she answered.
  const result = useMemo(() => {
    if (state.stage !== "reveal") return null;
    const g = guessesFor(state.date);
    if (!g) return null;
    const by = new Map(entries.filter((e) => e.date === state.date).map((e) => [e.trackerId, e.value]));
    const rows = state.ids.map((id) => ({ id, guess: g.guesses[id], real: by.get(id) }));
    return { rows, hit: rows.filter((r) => r.guess === r.real).length };
  }, [state, entries]);

  const pick = (id: string, v: boolean) => {
    haptics.tap();
    const next = { ...guesses, [id]: v };
    setGuesses(next);
    if (state.ids.every((x) => x in next)) {
      saveGuesses(state.date, next);
      haptics.success();
      setSaved(true);
    }
  };
  const close = () => {
    if (state.stage === "reveal") markRevealed(state.date);
    onClose();
  };
  const yn = (v: boolean | undefined) => (v === undefined ? "–" : v ? t("common.yes") : t("common.no"));

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={close} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("predict.title")}</p>
        {state.stage === "guess" ? (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{t(forTomorrow ? "predict.askTomorrow" : "predict.askTonight")}</p>
            <div className="mt-6 space-y-3">
              {state.ids.map((id) => (
                <div key={id} className="surface rounded-[22px] px-5 py-4">
                  <p className="text-[18px] font-semibold leading-snug">{question(id)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {[false, true].map((v) => (
                      <button key={String(v)} type="button" disabled={saved} onClick={() => pick(id, v)} aria-pressed={guesses[id] === v}
                        className={cn("h-12 rounded-2xl border-[1.5px] text-[17px] font-semibold transition-colors",
                          guesses[id] === v ? "border-[hsl(262_40%_60%)] bg-[hsl(262_40%_60%/0.14)] font-bold" : "border-foreground/[0.14] bg-foreground/[0.04]")}>
                        {v ? t("common.yes") : t("common.no")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {saved && (
              <div className="mt-auto flex flex-col items-center pt-8 text-center animate-fade-in">
                <img src={mapPic("sparkles")} alt="" width={44} height={44} className="mb-3" />
                <p className="text-[20px] font-bold">{t("predict.saved")}</p>
                <p className="mt-1 text-[16px] font-medium text-muted-foreground">{t(forTomorrow ? "predict.seeTomorrow" : "predict.seeTonight")}</p>
                <Pressable tone="teal" haptic="none" onClick={close} className="mt-6 h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                  {t("path.continue")}
                </Pressable>
              </div>
            )}
          </>
        ) : result && (
          <>
            <p className="mt-2 text-[30px] font-bold leading-tight tracking-tight">{t("predict.score", { k: result.hit, count: result.rows.length })}</p>
            <p className="mt-1 text-[17px] font-medium text-muted-foreground">
              {result.hit === result.rows.length ? t("predict.allRight") : result.hit === 0 ? t("predict.allSurprise") : t("predict.someRight")}
            </p>
            <div className="mt-6 space-y-2.5">
              {result.rows.map((r) => {
                const right = r.guess === r.real;
                return (
                  <div key={r.id} className="surface flex items-start gap-3 rounded-[20px] px-4 py-3.5">
                    <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      right ? "bg-[hsl(var(--coin-teal))] text-white" : "bg-[hsl(262_40%_60%/0.16)] text-[hsl(262_40%_52%)]")}>
                      {right ? <Check className="h-4 w-4" strokeWidth={3} /> : <Sparkles className="h-4 w-4" strokeWidth={2.2} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold leading-snug">{question(r.id)}</span>
                      <span className="mt-0.5 block text-[15px] font-medium text-muted-foreground">
                        {t("predict.row", { guess: yn(r.guess), real: yn(r.real) })}{right ? "" : ` · ${t("predict.surprised")}`}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-auto flex flex-col items-center pt-8">
              <Pressable tone="teal" haptic="none" onClick={() => { haptics.success(); close(); }} className="h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("path.continue")}
              </Pressable>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
