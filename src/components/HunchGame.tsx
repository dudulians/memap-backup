// "Your hunch" (src/lib/hunches.ts), the day's game step since her note on
// Guess ("ненужный никому вопрос"). What does she think is behind one of her
// hard questions? She picks a suspect she already answers, one she can add
// as a question, or writes her own; MeMap checks it as she answers and
// shows the result when there are enough days. First, a checked hunch, if
// one is ready. Counts only, never a cause.
import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Lightbulb, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { getLanguage } from "@/lib/i18n";
import { ensureTemplates } from "@/lib/doors";
import { islandOf } from "@/lib/islands";
import { addQuestionToIsland } from "@/lib/ownIslands";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { HUNCH_DAYS, addHunch, hunchDoneToday, hunchTarget, markHunchDay, markHunchSeen, readyHunch, suspectsFor, type Suspect } from "@/lib/hunches";
import { Pressable } from "@/components/ui/pressable";

export const HunchGame = ({ trackers, entries, onClose }: { trackers: Tracker[]; entries: TrackerEntry[]; onClose: () => void }) => {
  const { t } = useTranslation();
  const ru = getLanguage() === "ru";
  const ready = useMemo(() => readyHunch(trackers, entries), [trackers, entries]);
  const target = useMemo(() => hunchTarget(trackers, entries), [trackers, entries]);
  const suspects = useMemo(() => (target ? suspectsFor(target, trackers) : []), [target, trackers]);
  const [stage, setStage] = useState<"result" | "ask" | "add" | "own" | "checking">(ready ? "result" : "ask");
  const [picked, setPicked] = useState<Suspect | null>(null);
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const [suspectName, setSuspectName] = useState("");

  const name = (id: string) => localizeTrackerTitle(trackers.find((x) => x.id === id)?.title ?? "");
  const sName = (s: Suspect) => (s.kind === "tracked" ? localizeTrackerTitle(s.tracker.title) : ru ? s.template.titleRu : s.template.title);
  const sQuestion = (s: Suspect) => (s.kind === "tracked" ? s.tracker.questionText : ru ? s.template.questionTextRu : s.template.questionText);
  const x = target ? localizeTrackerTitle(target.title) : "";
  const avatar = avatarUrl(getAvatar());

  const pick = (s: Suspect) => {
    haptics.tap();
    setPicked(s);
    setSuspectName(sName(s));
    if (s.kind === "tracked" && target) { addHunch(target.id, s.tracker.id); haptics.success(); setStage("checking"); }
    else setStage("add");
  };
  const addAndCheck = async () => {
    if (!target || busy) return;
    setBusy(true);
    let id: string | undefined;
    if (stage === "own") {
      if (!own.trim()) { setBusy(false); return; }
      id = await addQuestionToIsland(own.trim(), islandOf(target), false);
      setSuspectName(own.trim().replace(/[?？]+$/, ""));
    } else if (picked?.kind === "template") {
      id = (await ensureTemplates([picked.template.id]))[0];
      window.dispatchEvent(new Event("memap-settings-changed"));
    }
    if (id) addHunch(target.id, id);
    haptics.success();
    setBusy(false);
    setStage("checking");
  };
  const notNow = () => { haptics.tap(); markHunchDay(); onClose(); };
  const big = (children: ReactNode, onClick: () => void) => (
    <Pressable tone="teal" haptic="none" onClick={onClick} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">{children}</Pressable>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          <Lightbulb className="h-4 w-4 text-[hsl(var(--coin-gold))]" strokeWidth={2.4} />
          {stage === "result" ? t("hunch.checkedKicker") : t("hunch.title")}
        </p>

        {/* A hunch she made earlier, now checked. */}
        {stage === "result" && ready && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
              {name(ready.hunch.suspect)} → {name(ready.hunch.target)}{ready.result.nextDay ? ` ${t("map.nextDay")}` : ""}
            </p>
            <div className="surface mt-5 rounded-[22px] px-5 py-4">
              <p className="text-[18px] font-bold leading-snug">{t("hunch.withIt", { b: name(ready.hunch.target), k: ready.result.k, count: ready.result.n })}</p>
              <p className="mt-1 text-[16px] font-semibold leading-snug text-muted-foreground">{t("hunch.withoutIt", { k: ready.result.k0, count: ready.result.n0 })}</p>
              <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
            </div>
            <div className="mt-6 flex items-center gap-3">
              {avatar && <img src={avatar} alt="" width={56} height={56} className="object-contain" />}
              <p className="text-[20px] font-bold leading-snug">{ready.result.onto ? t("hunch.onto") : t("hunch.notYet")}</p>
            </div>
            <div className="mt-auto pt-8">
              {big(hunchDoneToday() ? t("path.continue") : t("hunch.next"), () => {
                haptics.success();
                markHunchSeen(ready.hunch.id);
                if (hunchDoneToday() || !target) onClose(); else setStage("ask");
              })}
            </div>
          </>
        )}

        {/* Today's hunch. */}
        {stage === "ask" && target && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
              {t(target.problemWhen === "yes" ? "hunch.askHard" : "hunch.askGood", { x })}
            </p>
            <div className="mt-5 space-y-2.5">
              {suspects.map((s) => (
                <button key={s.kind === "tracked" ? s.tracker.id : s.template.id} type="button" onClick={() => pick(s)}
                  className="surface flex min-h-14 w-full items-center gap-3 rounded-2xl px-5 py-3 text-left active:scale-[0.99] transition-transform">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-semibold leading-snug">{sName(s)}</span>
                    {s.kind === "tracked" && <span className="block text-[14px] font-medium text-muted-foreground">{t("hunch.youAsk")}</span>}
                  </span>
                  {s.kind === "template" && <Plus className="h-5 w-5 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />}
                </button>
              ))}
              <button type="button" onClick={() => { haptics.tap(); setStage("own"); }}
                className="flex min-h-14 w-full items-center rounded-2xl border-2 border-dashed border-foreground/15 px-5 text-left text-[17px] font-semibold text-muted-foreground">
                {t("hunch.ownIdea")}
              </button>
            </div>
            <button type="button" onClick={notNow} className="mt-auto h-12 pt-6 text-[15px] font-semibold text-muted-foreground">{t("path.skip")}</button>
          </>
        )}

        {/* A suspect she doesn't answer yet: add it to check. */}
        {(stage === "add" || stage === "own") && target && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{t("hunch.toCheck")}</p>
            {stage === "add" && picked ? (
              <p className="mt-2 text-[17px] font-medium leading-snug text-muted-foreground">{t("hunch.addLine", { q: sQuestion(picked) })}</p>
            ) : (
              <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder={t("hunch.ownPlaceholder")} maxLength={70} autoFocus
                className="mt-4 h-14 w-full rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-5 text-[17px] outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
            )}
            <div className={cn("mt-auto space-y-2 pt-8")}>
              {big(t("hunch.addCheck"), addAndCheck)}
              <button type="button" onClick={() => { haptics.tap(); setStage("ask"); }} className="h-12 w-full text-[15px] font-semibold text-muted-foreground">{t("common.back")}</button>
            </div>
          </>
        )}

        {/* Noted: MeMap checks it as she answers. */}
        {stage === "checking" && target && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
            {avatar && <img src={avatar} alt="" width={84} height={84} className="mb-3 object-contain" />}
            <p className="text-[26px] font-bold leading-tight tracking-tight">{t("hunch.noted")}</p>
            <p className="mt-2 text-[17px] font-medium leading-snug text-muted-foreground">
              {t("hunch.checkingLine", { a: suspectName, b: x, count: HUNCH_DAYS })}
            </p>
            <div className="mt-8 w-full max-w-sm">{big(t("path.continue"), onClose)}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
