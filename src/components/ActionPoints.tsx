// Action points (her note, Nov 3 2026: "слишком много всего написано, пока
// поймёшь, что делать, уже тяжело… первым делом писать action point, потом,
// возможно, объяснение почему, и можно нажать и посмотреть подробнее").
// Nov 5 2026 (WORLD-BIBLE "Решения 5 ноября" #5): a reached rule is a card
// with the action first, big; one quiet line says why; then three choices:
//   I'll try    — a week's test of it starts (ExperimentSheet), and the count
//                 starts again from today;
//   Show        — the days behind it, as dots, and her plan and rule to change;
//   Not for me  — another plan (her island's small daily ideas, or her own),
//                 or turn it off.
// No "all calm" before there is data: "Your world is still taking shape"
// until a week of evenings. Gold, never red; no alarms.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, FlaskConical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { ruleCount } from "@/lib/lighthouses";
import { ruleKeyOf } from "@/lib/rules";
import { islandOf, mapPic, type IslandId } from "@/lib/islands";
import { getDoorState, isoLocal } from "@/lib/doors";
import { localizeTrackerAdvice, localizeTrackerTitle } from "@/lib/trackerLocalize";
import { answeredEvenings, countFromToday, patchTracker, SHAPING_EVENINGS } from "@/lib/actionPoints";
import { currentExperiment, experimentDay, EXPERIMENT_DAYS, ideasFor } from "@/lib/experiments";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RuleChips } from "@/components/RuleChips";
import { ExperimentSheet } from "@/components/ExperimentSheet";

/** "I'll try": the week's test to start, for the screen that holds the sheets. */
export interface TryAction { island: IslandId; plan: string; trackerId: string; k: number }

const TEAL = "hsl(var(--coin-teal))";
const quietBtn = "quiet-btn w-full";

/** Door questions go by their door name ("Fights with my partner"). */
const useName = () => {
  const { t } = useTranslation();
  const door = getDoorState();
  return (tr: Tracker) => {
    const id = door?.trackerId === tr.id ? door.id : door?.extra?.find((x) => x.trackerId === tr.id)?.id;
    return id ? t(`doors.${id}.name`) : localizeTrackerTitle(tr.title);
  };
};
const planOf = (tr: Tracker) => (tr.adviceAboveThreshold ? localizeTrackerAdvice(tr.adviceAboveThreshold) : "");

/** How far an action point is: one dot per day her rule needs, the days
 *  that came filled in the hard-day colour (her notes, Nov 5 2026: an orange
 *  bar in the list and purple dots inside didn't match, "не разобраться";
 *  then "то кружками, то квадратиками" — a day is always a dot). The same
 *  meter in the list, on the card and in Show; in Show its filled dots are
 *  the dark dots of the last days under it. */
const RuleMeter = ({ k, n, className }: { k: number; n: number; className?: string }) => {
  const { t } = useTranslation();
  const done = k >= n;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex min-w-0 flex-1 items-center gap-1" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="aspect-square min-w-0 max-w-3 flex-1 rounded-full" style={{ background: i < k ? "hsl(var(--strong))" : "hsl(var(--foreground) / 0.1)" }} />
        ))}
      </span>
      <span className={cn("shrink-0 text-[14px] font-bold tabular-nums", done ? "text-[hsl(var(--strong))]" : "text-muted-foreground")}>
        {t(done ? "rules.meterDone" : "rules.meterOf", { k, count: n })}
      </span>
    </span>
  );
};

export const ActionPoints = ({ trackers, entries, onTry }: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** opens the week's test outside this sheet (the Map); else it opens here */
  onTry?: (x: TryAction) => void;
}) => {
  const { t } = useTranslation();
  const name = useName();
  const [sheet, setSheet] = useState<{ id: string; mode: "show" | "change" } | null>(null);
  const [trying, setTrying] = useState<TryAction | null>(null);
  const rows = trackers
    .filter((tr) => !tr.archived && tr.threshold > 0)
    .map((tr) => ({ tr, k: ruleCount(tr, entries) }))
    .map((r) => ({ ...r, lit: r.k >= r.tr.threshold }));
  const lit = rows.filter((r) => r.lit);
  const watching = rows.filter((r) => !r.lit).sort((a, b) => b.k / b.tr.threshold - a.k / a.tr.threshold);
  /** the question under the plan; a good one is counted when it's missing */
  const label = (tr: Tracker) => (tr.problemWhen === "no" ? t("rules.without", { name: name(tr) }) : name(tr));
  const why = (tr: Tracker, k: number) => t(tr.problemWhen === "no" ? "rules.whyGood" : "rules.whyHard", { name: name(tr), k, count: tr.periodDays });
  const evenings = answeredEvenings(trackers, entries);
  // The week's test running now (one at a time).
  const test = currentExperiment();
  const testDay = test ? experimentDay(test) : 0;
  const testLine = testDay > EXPERIMENT_DAYS ? t("rules.testDone") : t("rules.testing", { k: testDay, count: EXPERIMENT_DAYS });
  const current = rows.find((r) => r.tr.id === sheet?.id);
  const open = (id: string, mode: "show" | "change") => { haptics.tap(); setSheet({ id, mode }); };
  const tryIt = (tr: Tracker, k: number) => {
    haptics.tap();
    const x: TryAction = { island: islandOf(tr), plan: planOf(tr), trackerId: tr.id, k };
    if (onTry) onTry(x); else setTrying(x);
  };

  if (rows.length === 0) {
    return (
      <div className="surface rounded-[22px] px-5 py-5 animate-fade-in">
        <p className="text-[18px] font-bold leading-snug">{t("rules.noneTitle")}</p>
        <p className="mt-1 text-[15px] font-medium text-muted-foreground">{t("rules.noneLine")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* The test she is trying this week. */}
      {test && (
        <div className="surface flex items-center gap-3 rounded-[22px] px-4 py-3.5">
          <span className="icon-dot h-11 w-11">
            <FlaskConical className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold leading-snug">{test.change}</span>
            <span className="block text-[14px] font-semibold" style={{ color: TEAL }}>{testLine}</span>
          </span>
        </div>
      )}

      {lit.length === 0 && (evenings < SHAPING_EVENINGS ? (
        // Too early to say anything is calm (GPT review, Nov 5 2026).
        <div className="surface rounded-[22px] px-5 py-4">
          <p className="text-[19px] font-bold leading-snug">{t("rules.shaping")}</p>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: SHAPING_EVENINGS }, (_, i) => (
              <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < evenings ? "hsl(var(--coin-gold))" : "hsl(var(--foreground) / 0.1)" }} />
            ))}
          </div>
          <p className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("rules.evenings", { k: evenings, count: SHAPING_EVENINGS })}</p>
        </div>
      ) : (
        <p className="surface rounded-[22px] px-5 py-4 text-[18px] font-bold">{t("rules.nothingNow")}</p>
      ))}

      {lit.length > 0 && <p className="px-1 pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.timeToAct")}</p>}
      {lit.map(({ tr, k }) => {
        const plan = planOf(tr);
        return (
          <div key={tr.id} className="surface rounded-[22px] px-4 pb-4 pt-4">
            <div className="flex items-start gap-3">
              <img src={mapPic("lighthouse")} alt="" width={40} height={46} className="h-11 w-10 shrink-0 object-contain drop-shadow-[0_0_8px_hsl(44_96%_60%/0.7)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-bold leading-snug">{plan || name(tr)}</p>
                {plan && <p className="mt-1 truncate text-[14px] font-medium text-muted-foreground">{label(tr)}</p>}
                <RuleMeter k={k} n={tr.threshold} className="mt-2" />
              </div>
            </div>
            {!plan ? (
              <button type="button" onClick={() => open(tr.id, "change")} className="raised-btn is-small mt-4 w-full justify-center">{t("rules.noPlan")}</button>
            ) : test ? (
              // One test at a time: this one waits.
              <p className="mt-3.5 flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-muted-foreground">
                <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                {testDay > EXPERIMENT_DAYS ? t("rules.afterTestDone") : t("rules.afterTest", { count: EXPERIMENT_DAYS - testDay + 1 })}
              </p>
            ) : (
              <button type="button" onClick={() => tryIt(tr, k)} className="raised-btn is-small mt-4 w-full justify-center">{t("rules.try")}</button>
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => open(tr.id, "show")} className={quietBtn}>{t("rules.show")}</button>
              <button type="button" onClick={() => open(tr.id, "change")} className={quietBtn}>{t("rules.notForMe")}</button>
            </div>
          </div>
        );
      })}

      {watching.length > 0 && (
        <>
          <p className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.watching")}</p>
          <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
            {watching.map(({ tr, k }) => {
              const mine = test?.from === tr.id;
              return (
                <button key={tr.id} type="button" onClick={() => open(tr.id, "show")} className="block w-full px-4 py-3 text-left">
                  <span className="block truncate text-[16px] font-semibold">{planOf(tr) || name(tr)}</span>
                  <span className={cn("mt-0.5 flex items-center gap-1 truncate text-[13px] font-medium", !mine && "text-muted-foreground")} style={mine ? { color: TEAL } : undefined}>
                    {mine && <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />}
                    {mine ? testLine : planOf(tr) ? label(tr) : ""}
                  </span>
                  <RuleMeter k={k} n={tr.threshold} className="mt-2" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {current && sheet?.mode === "show" && (
        <ShowSheet key={current.tr.id} tracker={current.tr} k={current.k} entries={entries} name={name(current.tr)} onClose={() => setSheet(null)} />
      )}
      {current && sheet?.mode === "change" && (
        <ChangeSheet key={current.tr.id} tracker={current.tr} k={current.k} name={name(current.tr)} why={why(current.tr, current.k)} onClose={() => setSheet(null)} />
      )}
      {trying && (
        <ExperimentSheet mode="pick" island={trying.island} plan={trying.plan} from={{ trackerId: trying.trackerId, k: trying.k }}
          trackers={trackers} entries={entries} onClose={() => setTrying(null)} />
      )}
    </div>
  );
};

/** "Show": the days behind an action point, then her plan and rule to change. */
const ShowSheet = ({ tracker, k, entries, name, onClose }: { tracker: Tracker; k: number; entries: TrackerEntry[]; name: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(planOf(tracker));
  const [rule, setRule] = useState({ threshold: tracker.threshold, periodDays: tracker.periodDays });
  // The rule's own window (ruleCount): the last periodDays days and today.
  // Filled = a day that counts (the hard-day colour, as on the calendar).
  const days = useMemo(() => {
    const now = new Date();
    const hit = tracker.problemWhen === "yes";
    const byDate = new Map(entries.filter((e) => e.trackerId === tracker.id).map((e) => [e.date, e.value]));
    return Array.from({ length: tracker.periodDays + 1 }, (_, i) => {
      const iso = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - tracker.periodDays + i));
      const v = byDate.get(iso);
      const before = !!tracker.cycleStartDate && iso < tracker.cycleStartDate;
      return { iso, look: v === undefined ? "none" : before ? "before" : v === hit ? "hit" : "other" };
    });
  }, [tracker, entries]);
  const changed = () => plan !== planOf(tracker) || rule.threshold !== tracker.threshold || rule.periodDays !== tracker.periodDays;
  const keep = (x: Tracker): Tracker => ({ ...x, ...rule, adviceAboveThreshold: rule.threshold ? plan.trim() : x.adviceAboveThreshold });
  const close = async () => {
    if (changed()) await patchTracker(tracker.id, keep);
    onClose();
  };
  // "Done": she did it; the count starts again from today.
  const did = async () => {
    haptics.success();
    await countFromToday(tracker.id, k, keep(tracker));
    onClose();
  };
  const lit = tracker.threshold > 0 && k >= tracker.threshold;
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) close(); }} className="h-auto max-h-[88vh]" ariaTitle={t("rules.title")}>
      <div className="flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto px-5 pb-8">
        <div className="pr-10 pt-1">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{name}</p>
          <p className="mt-2 text-[30px] font-bold leading-tight tracking-tight tabular-nums">
            {k >= tracker.threshold
              ? t(tracker.problemWhen === "no" ? "rules.bigDoneWithout" : "rules.bigDone", { k, count: tracker.periodDays })
              : t(tracker.problemWhen === "no" ? "rules.bigOfWithout" : "rules.bigOf", { k, count: tracker.threshold })}
          </p>
          <RuleMeter k={k} n={tracker.threshold} className="mt-3" />
          <p className="mt-2 text-[15px] font-medium leading-snug text-muted-foreground">{t("rules.ruleLine", { n: tracker.threshold, count: tracker.periodDays })}</p>
          <p className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
            {t(tracker.problemWhen === "no" ? "rules.dotsGood" : "rules.dotsHard", { count: tracker.periodDays })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
            {days.map((d) => (
              <span key={d.iso} className="h-3 w-3 rounded-full" style={{
                background: d.look === "hit" ? "hsl(var(--strong))" : d.look === "other" ? "hsl(var(--balanced) / 0.75)" : "hsl(var(--foreground) / 0.08)",
                opacity: d.look === "before" ? 0.45 : 1,
              }} />
            ))}
          </div>
          {tracker.cycleStartDate && days.some((d) => d.look === "before") && (
            <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("rules.countedFrom")}</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[16px] font-bold">{t("rules.plan")}</p>
          <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} maxLength={120} placeholder={t("rules.planPh")}
            className="w-full resize-none rounded-2xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 py-3 text-[18px] font-semibold leading-snug outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
        </div>
        <RuleChips hard={tracker.problemWhen !== "no"} value={ruleKeyOf(rule)} customLabel={t("rules.custom", { n: rule.threshold, count: rule.periodDays })}
          onChange={(_, r) => setRule(r)} plan={plan} onPlan={setPlan} showPlan={false} />
        {lit && (
          <button type="button" onClick={did}
            className="quiet-btn h-12 w-full text-[16px]">
            <RotateCcw className="h-5 w-5" strokeWidth={2.4} /> {t("rules.didIt")}
          </button>
        )}
        <button type="button" onClick={close} className="raised-btn w-full justify-center">{t("common.done")}</button>
      </div>
    </BottomSheet>
  );
};

/** "Not for me" (or no plan yet): another plan, or turn it off. */
const ChangeSheet = ({ tracker, name, why, onClose }: { tracker: Tracker; k: number; name: string; why: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const had = planOf(tracker);
  // Small everyday ideas from the question's island (the week's-test ideas).
  const ideas = ideasFor(islandOf(tracker)).map((id) => t(`experiment.idea.${id}.change`)).filter((s) => s !== had);
  const [pick, setPick] = useState<string | null>(null);
  const [own, setOwn] = useState("");
  const next = pick ?? own.trim();
  const save = async () => {
    if (!next) return;
    haptics.success();
    await patchTracker(tracker.id, (x) => ({ ...x, adviceAboveThreshold: next }));
    onClose();
  };
  const off = async () => {
    haptics.tap();
    await patchTracker(tracker.id, (x) => ({ ...x, threshold: 0 }));
    onClose();
  };
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) onClose(); }} className="h-auto max-h-[88vh]" ariaTitle={t(had ? "rules.instead" : "rules.plan")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8">
        <div className="pr-10 pt-1">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{name}</p>
          <p className="mt-1 text-[15px] font-medium leading-snug text-muted-foreground">{why}</p>
          <p className="mt-3 text-[24px] font-bold leading-tight tracking-tight">{t(had ? "rules.instead" : "rules.plan")}</p>
        </div>
        <div className="mt-4 space-y-2.5">
          {ideas.map((s) => {
            const on = pick === s;
            return (
              <button key={s} type="button" onClick={() => { haptics.tap(); setPick(on ? null : s); setOwn(""); }} aria-pressed={on}
                className={cn("surface flex min-h-14 w-full items-center gap-3 rounded-2xl px-5 py-3 text-left text-[17px] outline-none transition-shadow duration-150 active:scale-[0.99]", on ? "pick-on font-bold" : "font-semibold")}>
                <span className="min-w-0 flex-1">{s}</span>
                <span aria-hidden="true" className={cn("tick", on && "is-on")}>
                  {on && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
          <input value={own} onChange={(e) => { setOwn(e.target.value); setPick(null); }} placeholder={t("experiment.own")} maxLength={90}
            aria-label={t("rules.plan")}
            className={cn("h-14 w-full rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-5 text-[17px] outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]", own.trim() && "pick-on")} />
        </div>
        <button type="button" onClick={save} disabled={!next} className="raised-btn mt-6 w-full justify-center">{t("common.save")}</button>
        <button type="button" onClick={off} className="mt-3 h-12 w-full text-[16px] font-semibold text-muted-foreground">{t("rules.turnOff")}</button>
      </div>
    </BottomSheet>
  );
};
