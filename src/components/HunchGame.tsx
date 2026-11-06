// "Your hunch" (src/lib/hunches.ts), the day's game step since her note on
// Guess ("ненужный никому вопрос"). What does she think is behind one of her
// hard questions? Since Nov 3 2026 she ticks one or more (her note: "иногда
// несколько вариантов, а можно отметить только один, и игра закрывается…
// упростила бы интерфейс и позволила бы множественный выбор"): ones she
// already answers, ones that become new questions, or her own idea. MeMap
// checks each as she answers and shows them together when there are enough
// days. First, checked hunches, if any are ready. Counts only, never a cause.
import { answerPhrase, cap } from "@/lib/answerPhrases";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, Lightbulb, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { playSparkle, playTick, preloadSounds } from "@/lib/feedback";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { getLanguage } from "@/lib/i18n";
import { ensureTemplates } from "@/lib/doors";
import { islandOf } from "@/lib/islands";
import { addQuestionToIsland } from "@/lib/ownIslands";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { HUNCH_DAYS, addHunches, hunchDoneToday, hunchTarget, markHunchDay, markHunchSeen, readyHunches, suspectsFor, type Suspect } from "@/lib/hunches";
import { Pressable } from "@/components/ui/pressable";

const keyOf = (s: Suspect) => (s.kind === "tracked" ? s.tracker.id : `tpl:${s.template.id}`);

/** "a, b and c" in her language. */
const listOf = (xs: string[], lang: string) => {
  try {
    const LF = (Intl as unknown as { ListFormat: new (l: string, o: { type: string }) => { format: (x: string[]) => string } }).ListFormat;
    return new LF(lang, { type: "conjunction" }).format(xs);
  } catch {
    return xs.join(", ");
  }
};

export const HunchGame = ({ trackers, entries, onClose }: { trackers: Tracker[]; entries: TrackerEntry[]; onClose: () => void }) => {
  const { t } = useTranslation();
  const lang = getLanguage();
  const ru = lang === "ru";
  const ready = useMemo(() => readyHunches(trackers, entries), [trackers, entries]);
  const target = useMemo(() => hunchTarget(trackers, entries), [trackers, entries]);
  const suspects = useMemo(() => (target ? suspectsFor(target, trackers) : []), [target, trackers]);
  const [stage, setStage] = useState<"result" | "ask" | "checking">(ready.length > 0 ? "result" : "ask");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [ownOpen, setOwnOpen] = useState(false);
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const [noted, setNoted] = useState<{ names: string[]; added: string[] }>({ names: [], added: [] });

  useEffect(() => { preloadSounds("pop1", "sparkle"); }, []);
  // Checked hunches: sparkles if she was onto something.
  const anyOnto = ready.some((r) => r.result.onto);
  useEffect(() => {
    if (stage !== "result" || ready.length === 0) return;
    if (anyOnto) { haptics.sparkle(); playSparkle(); } else haptics.soft();
  }, [stage, ready, anyOnto]);

  const name = (id: string) => localizeTrackerTitle(trackers.find((x) => x.id === id)?.title ?? "");
  const sName = (s: Suspect) => (s.kind === "tracked" ? localizeTrackerTitle(s.tracker.title) : ru ? s.template.titleRu : s.template.title);
  const x = target ? answerPhrase(t, target, true) : "";
  const tr = (id: string) => trackers.find((y) => y.id === id);
  const avatar = avatarUrl(getAvatar());
  const ownText = own.trim();
  const count = chosen.size + (ownText ? 1 : 0);

  const toggle = (s: Suspect) => {
    const k = keyOf(s);
    const on = !chosen.has(k);
    haptics.tap();
    playTick(on);
    setChosen((c) => {
      const n = new Set(c);
      if (on) n.add(k); else n.delete(k);
      return n;
    });
  };
  const check = async () => {
    if (!target || busy || count === 0) return;
    setBusy(true);
    try {
      const picked = suspects.filter((s) => chosen.has(keyOf(s)));
      const ids: string[] = [];
      const names: string[] = [];
      const added: string[] = [];
      for (const s of picked) if (s.kind === "tracked") { ids.push(s.tracker.id); names.push(sName(s)); }
      // Ones she doesn't answer yet become questions, so MeMap can check them.
      const fresh = picked.filter((s): s is Extract<Suspect, { kind: "template" }> => s.kind === "template");
      if (fresh.length > 0) {
        const made = await ensureTemplates(fresh.map((s) => s.template.id));
        made.forEach((id, i) => { ids.push(id); names.push(sName(fresh[i])); added.push(sName(fresh[i])); });
      }
      if (ownText) {
        const label = ownText.replace(/[?？]+$/, "");
        ids.push(await addQuestionToIsland(ownText, islandOf(target), false));
        names.push(label);
        added.push(label);
      }
      if (added.length > 0) window.dispatchEvent(new Event("memap-settings-changed"));
      addHunches(target.id, ids);
      haptics.success();
      playSparkle(0.4);
      setNoted({ names, added });
      setStage("checking");
    } finally {
      setBusy(false);
    }
  };
  const notNow = () => { haptics.tap(); markHunchDay(); onClose(); };
  const big = (children: ReactNode, onClick: () => void, disabled = false) => (
    <Pressable tone="teal" haptic="none" onClick={onClick} disabled={disabled} className="h-[58px] w-full rounded-2xl disabled:opacity-50" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">{children}</Pressable>
  );
  const tick = (on: boolean) => (
    <span aria-hidden="true" className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
      on ? "border-[hsl(var(--coin-teal))] bg-[hsl(var(--coin-teal))] text-white" : "border-foreground/20")}>
      {on && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
  const picked = "pick-on";

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

        {/* Hunches she made earlier about one question, now checked. */}
        {stage === "result" && ready.length > 0 && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{name(ready[0].hunch.target)}</p>
            <div className="mt-5 space-y-3">
              {ready.map(({ hunch, result }) => (
                <div key={hunch.id} className="surface rounded-[22px] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-[19px] font-bold leading-snug">
                      {cap(answerPhrase(t, tr(hunch.suspect), true))}{result.nextDay ? ` ${t("map.nextDay")}` : ""}
                    </p>
                    <span className={cn("shrink-0 rounded-full px-3 py-1 text-[13px] font-bold",
                      result.onto ? "bg-foreground/[0.06] text-[hsl(var(--coin-teal))]" : "bg-foreground/[0.06] text-muted-foreground")}>
                      {t(result.onto ? "hunch.ontoShort" : "hunch.notShort")}
                    </span>
                  </div>
                  <p className="mt-2 text-[16px] font-semibold leading-snug">{t("hunch.withIt", { b: answerPhrase(t, tr(hunch.target), tr(hunch.target)?.problemWhen === "yes"), k: result.k, count: result.n })}</p>
                  <p className="text-[15px] font-medium leading-snug text-muted-foreground">{t("hunch.withoutIt", { k: result.k0, count: result.n0 })}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
            <div className="mt-6 flex items-center gap-3">
              {avatar && <img src={avatar} alt="" width={56} height={56} className="object-contain" />}
              <p className="text-[20px] font-bold leading-snug">{anyOnto ? t("hunch.onto") : t("hunch.notYet")}</p>
            </div>
            <div className="mt-auto pt-8">
              {big(hunchDoneToday() ? t("path.continue") : t("hunch.next"), () => {
                haptics.success();
                ready.forEach((r) => markHunchSeen(r.hunch.id));
                if (hunchDoneToday() || !target) onClose(); else setStage("ask");
              })}
            </div>
          </>
        )}

        {/* Today's hunch: tick one or more, then check. */}
        {stage === "ask" && target && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
              {t(target.problemWhen === "yes" ? "hunch.askHard" : "hunch.askGood", { x })}
            </p>
            <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("hunch.pickMany")}</p>
            <div className="mt-5 space-y-2.5">
              {suspects.map((s) => {
                const on = chosen.has(keyOf(s));
                return (
                  <button key={keyOf(s)} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(s)}
                    className={cn("surface flex min-h-14 w-full items-center gap-3 rounded-2xl px-5 py-3 text-left transition-[transform,box-shadow] active:scale-[0.99]", on && picked)}>
                    <span className="min-w-0 flex-1 text-[17px] font-semibold leading-snug">{sName(s)}</span>
                    {s.kind === "template" && <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">{t("hunch.newQ")}</span>}
                    {tick(on)}
                  </button>
                );
              })}
              {ownOpen ? (
                <label className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl px-5", ownText ? cn("surface", picked) : "border border-foreground/[0.14] bg-foreground/[0.04]")}>
                  <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder={t("hunch.ownPlaceholder")} maxLength={70} autoFocus
                    aria-label={t("hunch.ownIdea")} className="h-12 min-w-0 flex-1 bg-transparent text-[17px] font-semibold outline-none placeholder:font-medium" />
                  {tick(!!ownText)}
                </label>
              ) : (
                <button type="button" onClick={() => { haptics.tap(); setOwnOpen(true); }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-5 text-left text-[17px] font-semibold text-muted-foreground">
                  <Pencil className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                  {t("hunch.ownIdea")}
                </button>
              )}
            </div>
            <div className="mt-auto space-y-1 pt-8">
              {big(<>{t("hunch.check")}{count > 1 ? ` · ${count}` : ""}</>, check, count === 0 || busy)}
              <button type="button" onClick={notNow} className="h-12 w-full text-[15px] font-semibold text-muted-foreground">{t("path.skip")}</button>
            </div>
          </>
        )}

        {/* Noted: MeMap checks them as she answers. */}
        {stage === "checking" && target && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
            {avatar && <img src={avatar} alt="" width={84} height={84} className="mb-3 object-contain" />}
            <p className="text-[26px] font-bold leading-tight tracking-tight">{t("hunch.noted")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {noted.names.map((n) => (
                <span key={n} className="rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-[15px] font-bold">{n}</span>
              ))}
            </div>
            <p className="mt-2 text-[17px] font-semibold text-muted-foreground">→ {x}</p>
            <p className="mt-4 text-[17px] font-medium leading-snug text-muted-foreground">{t("hunch.afterDays", { count: HUNCH_DAYS })}</p>
            {noted.added.length > 0 && (
              <p className="mt-2 text-[15px] font-medium leading-snug text-muted-foreground">{t("hunch.addedQs", { list: listOf(noted.added, lang) })}</p>
            )}
            <div className="mt-8 w-full max-w-sm">{big(t("path.continue"), onClose)}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
