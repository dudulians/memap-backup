// Action points (her note, Nov 3 2026: "слишком много всего написано, пока
// поймёшь, что делать, уже тяжело… первым делом писать action point, потом,
// возможно, объяснение почему, и можно нажать и посмотреть подробнее").
// A reached rule is a card that says the action first, big; one quiet line
// under it says why. The rest wait below in one short list. Tap any for the
// details: her plan, when it's time to act (three plain choices), and "I did
// it, count again". Gold, never red; no alarms.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { ruleCount } from "@/lib/lighthouses";
import { ruleKeyOf } from "@/lib/rules";
import { mapPic } from "@/lib/islands";
import { getDoorState, isoLocal } from "@/lib/doors";
import { localizeTrackerAdvice, localizeTrackerTitle } from "@/lib/trackerLocalize";
import { clearThresholdNotification } from "@/lib/notifications";
import { uuid } from "@/lib/uuid";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RuleChips } from "@/components/RuleChips";

/** Door questions go by their door name ("Fights with my partner"). */
const useName = () => {
  const { t } = useTranslation();
  const door = getDoorState();
  return (tr: Tracker) => {
    const id = door?.trackerId === tr.id ? door.id : door?.extra?.find((x) => x.trackerId === tr.id)?.id;
    return id ? t(`doors.${id}.name`) : localizeTrackerTitle(tr.title);
  };
};

const save = async (id: string, patch: (t: Tracker) => Tracker) => {
  const all = await getTrackers();
  await saveTrackers(all.map((t) => (t.id === id ? patch(t) : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};

export const ActionPoints = ({ trackers, entries }: { trackers: Tracker[]; entries: TrackerEntry[] }) => {
  const { t } = useTranslation();
  const name = useName();
  const [open, setOpen] = useState<string | null>(null);
  const rows = trackers
    .filter((tr) => !tr.archived && tr.threshold > 0)
    .map((tr) => ({ tr, k: ruleCount(tr, entries) }))
    .map((r) => ({ ...r, lit: r.k >= r.tr.threshold }));
  const lit = rows.filter((r) => r.lit);
  const watching = rows.filter((r) => !r.lit).sort((a, b) => b.k / b.tr.threshold - a.k / a.tr.threshold);
  const plan = (tr: Tracker) => (tr.adviceAboveThreshold ? localizeTrackerAdvice(tr.adviceAboveThreshold) : "");
  const why = (tr: Tracker, k: number) => t(tr.problemWhen === "no" ? "rules.whyGood" : "rules.whyHard", { name: name(tr), k, count: tr.periodDays });
  const current = rows.find((r) => r.tr.id === open);

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
      {lit.length === 0 && (
        <p className="surface rounded-[22px] px-5 py-4 text-[17px] font-bold">{t("rules.allCalm")}</p>
      )}
      {lit.map(({ tr, k }) => (
        <button key={tr.id} type="button" onClick={() => { haptics.tap(); setOpen(tr.id); }}
          className="surface flex w-full items-center gap-3 rounded-[22px] px-4 py-4 text-left ring-2 ring-[hsl(var(--coin-gold)/0.7)] active:scale-[0.99] transition-transform">
          <img src={mapPic("lighthouse")} alt="" width={40} height={46} className="h-11 w-10 shrink-0 object-contain drop-shadow-[0_0_8px_hsl(44_96%_60%/0.7)]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold uppercase tracking-[0.08em] text-[hsl(32_70%_40%)] dark:text-[hsl(44_90%_70%)]">{t("rules.timeToAct")}</span>
            <span className={cn("mt-0.5 block text-[19px] font-bold leading-snug", !plan(tr) && "text-[hsl(var(--coin-teal))]")}>{plan(tr) || t("rules.noPlan")}</span>
            <span className="mt-1 block text-[14px] font-medium leading-snug text-muted-foreground">{why(tr, k)}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
        </button>
      ))}

      {watching.length > 0 && (
        <>
          <p className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.watching")}</p>
          <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
            {watching.map(({ tr, k }) => (
              <button key={tr.id} type="button" onClick={() => { haptics.tap(); setOpen(tr.id); }} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{plan(tr) || name(tr)}</span>
                  <span className="mt-0.5 block truncate text-[13px] font-medium text-muted-foreground">{why(tr, k)}</span>
                </span>
                <span className="h-2 w-14 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                  <span className="block h-full rounded-full bg-[hsl(var(--coin-gold))]" style={{ width: `${Math.min(100, (k / tr.threshold) * 100)}%` }} />
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {current && (
        <ActionPointSheet key={current.tr.id} tracker={current.tr} k={current.k} entries={entries} name={name(current.tr)} onClose={() => setOpen(null)} />
      )}
    </div>
  );
};

/** The details of one action point: her plan, when it's time to act, and "I did it". */
const ActionPointSheet = ({ tracker, k, name, onClose }: { tracker: Tracker; k: number; entries: TrackerEntry[]; name: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(tracker.adviceAboveThreshold ? localizeTrackerAdvice(tracker.adviceAboveThreshold) : "");
  const [rule, setRule] = useState({ threshold: tracker.threshold, periodDays: tracker.periodDays });
  const close = async () => {
    const changed = plan !== (tracker.adviceAboveThreshold ? localizeTrackerAdvice(tracker.adviceAboveThreshold) : "")
      || rule.threshold !== tracker.threshold || rule.periodDays !== tracker.periodDays;
    if (changed) await save(tracker.id, (x) => ({ ...x, ...rule, adviceAboveThreshold: rule.threshold ? plan.trim() : x.adviceAboveThreshold }));
    onClose();
  };
  // "I did it": the count starts again from today (the old count is kept).
  const again = async () => {
    haptics.success();
    const today = isoLocal(new Date());
    const cycle: ReflectionCycle = {
      id: uuid(), startDate: tracker.cycleStartDate ?? tracker.createdAt.split("T")[0], endDate: today,
      periodDays: tracker.periodDays, threshold: tracker.threshold, significantDays: k, totalTrackedDays: k,
    };
    await save(tracker.id, (x) => ({ ...x, ...rule, adviceAboveThreshold: rule.threshold ? plan.trim() : x.adviceAboveThreshold, cycleStartDate: today, cycles: [...(x.cycles ?? []), cycle] }));
    clearThresholdNotification(tracker.id);
    onClose();
  };
  const lit = tracker.threshold > 0 && k >= tracker.threshold;
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) close(); }} className="h-auto max-h-[88vh]" ariaTitle={t("rules.title")}>
      <div className="flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto px-5 pb-8">
        <div className="pr-10 pt-1">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{name}</p>
          <p className="mt-1 text-[15px] font-medium text-muted-foreground">{t(tracker.problemWhen === "no" ? "rules.whyGood" : "rules.whyHard", { name, k, count: tracker.periodDays })}</p>
        </div>
        <div className="space-y-2">
          <p className="text-[16px] font-bold">{t("rules.plan")}</p>
          <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} maxLength={120} placeholder={t("rules.planPh")}
            className="w-full resize-none rounded-2xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 py-3 text-[18px] font-semibold leading-snug outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
        </div>
        <RuleChips hard={tracker.problemWhen !== "no"} value={ruleKeyOf(rule)} customLabel={t("rules.custom", { n: rule.threshold, count: rule.periodDays })}
          onChange={(_, r) => setRule(r)} plan={plan} onPlan={setPlan} showPlan={false} />
        {lit && (
          <button type="button" onClick={again}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--coin-teal))] text-[16px] font-bold text-white active:scale-[0.98] transition-transform">
            <RotateCcw className="h-5 w-5" strokeWidth={2.4} /> {t("rules.didIt")}
          </button>
        )}
        <button type="button" onClick={close} className="h-12 w-full rounded-full bg-foreground/[0.06] text-[16px] font-semibold">{t("common.done")}</button>
      </div>
    </BottomSheet>
  );
};
