import { useState, useEffect } from "react";
import { AnswerWordsFields, cleanWords, type AnswerWords } from "./AnswerWordsFields";
import { templateIdOf } from "@/lib/answerPhrases";
import { Tracker } from "@/types/tracker";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { localizeTrackerQuestion, localizeTrackerAdvice, localizeTrackerTitle, localizeGroupTitle } from "@/lib/trackerLocalize";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDoorState } from "@/lib/doors";

// Same mapping as AddTrackerModal — when user picks a Theme
// (cluster), we derive the structural Tracker.category for stats
// and color. Kept local to avoid creating yet another shared
// constants file for two callsites.
const CLUSTER_TO_CATEGORY: Record<string, Tracker["category"]> = {
  partner: "Connections",
  parenting: "Connections",
  health: "Health",
  habits: "Health",
  state: "Emotions",
  "big-decisions": "Voice",
  "external-events": "Social",
  expat: "Voice",
};

// Reverse hint — for trackers stored BEFORE the cluster field
// existed. Best-guess single cluster from the category enum, so
// the "Theme" dropdown isn't empty when editing legacy data.
// Many-to-one collisions resolved to the most common case
// (e.g., Connections defaults to "partner" rather than
// "parenting" because partner is more universal).
const inferClusterFromCategory = (
  category: Tracker["category"],
): string | undefined => {
  switch (category) {
    case "Connections": return "partner";
    case "Health":      return "health";
    case "Emotions":    return "state";
    case "Voice":       return "big-decisions";
    case "Social":      return "external-events";
    case "Curious":     return "habits";
    case "Body":        return "health";
    case "Fun":         return "state";
    default:            return undefined;
  }
};

interface TrackerSettingsModalProps {
  open: boolean;
  onClose: () => void;
  tracker: Tracker | null;
  onSave: (updatedTracker: Tracker) => Promise<void>;
}

const trackerSettingsSchema = z.object({
  questionText: z.string().trim().max(200, "Question must be less than 200 characters"),
  answerType: z.enum(["boolean", "scale", "count", "note"]),
  periodDays: z.number().min(1).max(365),
  threshold: z.number().min(1),
  problemWhen: z.enum(["yes", "no"]),
  category: z.enum(["Emotions", "Body", "Connections", "Voice", "Health", "Curious", "Fun", "Social"]),
  cluster: z.string().optional(),
  adviceAboveThreshold: z.string().trim().max(500, "Advice must be less than 500 characters"),
});

export const TrackerSettingsModal = ({ open, onClose, tracker, onSave }: TrackerSettingsModalProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    questionText: "",
    answerType: "boolean" as Tracker["answerType"],
    periodDays: 30,
    threshold: 10,
    problemWhen: "yes" as "yes" | "no",
    category: "Curious" as Tracker["category"],
    cluster: undefined as string | undefined,
    adviceAboveThreshold: "",
  });
  const [words, setWords] = useState<AnswerWords>({});
  const [thresholdRaw, setThresholdRaw] = useState<string>("10");
  const [periodDaysRaw, setPeriodDaysRaw] = useState<string>("30");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Theme and advice fold under "More settings" (1.8.0).
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (tracker) {
      // Localize stored EN strings into the active language for editing.
      // Trackers seeded before the i18n rollout (or by template-pickers that
      // hadn't been wired through localize* yet) are stored as English text
      // even when the user is on Russian. Showing the raw English in the edit
      // form would be confusing — and saving without changes would lock that
      // English in. Prefer the localized text on load; the user can still edit.
      setFormData({
        questionText: localizeTrackerQuestion(tracker.questionText, tracker.title),
        answerType: tracker.answerType,
        periodDays: tracker.periodDays,
        threshold: tracker.threshold,
        problemWhen: tracker.problemWhen,
        category: tracker.category,
        // Trackers created before the cluster field existed (1.6
        // and earlier) have no cluster set. Best-guess from their
        // existing category so the Theme dropdown isn't empty.
        cluster: tracker.cluster ?? inferClusterFromCategory(tracker.category),
        adviceAboveThreshold: localizeTrackerAdvice(tracker.adviceAboveThreshold),
      });
      setWords(tracker.words ?? {});
      setPeriodDaysRaw(String(tracker.periodDays));
      setThresholdRaw(String(tracker.threshold));
      setErrors({});
      setMoreOpen(false);
    }
  }, [tracker]);

  const handleSave = async () => {
    if (!tracker) return;

    try {
      const questionTextToValidate = formData.questionText.trim() || tracker.questionText;
      const validated = trackerSettingsSchema.parse({
        ...formData,
        questionText: questionTextToValidate,
      });

      if (validated.threshold > validated.periodDays) {
        setErrors({ threshold: t("trackerSettings.thresholdGtPeriod") });
        return;
      }

      setErrors({});
      setSaving(true);

      const updatedTracker: Tracker = {
        ...tracker,
        ...validated,
        words: templateIdOf(tracker) ? tracker.words : cleanWords(words),
      };

      await onSave(updatedTracker);

      toast({
        title: t("trackerSettings.updated"),
        description: t("trackerSettings.updatedDesc"),
      });

      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  // Door questions go by their door name, same as everywhere else.
  const name = (() => {
    if (!tracker) return t("trackerSettings.title");
    const door = getDoorState();
    const id = door?.trackerId === tracker.id ? door.id : door?.extra?.find((x) => x.trackerId === tracker.id)?.id;
    return id ? t(`doors.${id}.name`) : localizeTrackerTitle(tracker.title);
  })();

  // 1.8.0: the question, "Yes is Good / Bad" and the limit as one
  // sentence; theme and advice under "More settings". The help lines
  // under every field are gone.
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      className="h-[92vh] flex flex-col"
      ariaTitle={name}
    >
      <div className="px-6 pt-3 pb-3 flex-shrink-0">
        <h2 className="text-[21px] font-bold tracking-tight pr-10 truncate">{name}</h2>
      </div>

      {/* `overscroll-y-contain` stops the iOS rubber-band inside the
          body, which otherwise fights vaul's drag-to-close. */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-6 py-3 space-y-7">
        <div className="space-y-2">
          <Textarea
            id="questionText"
            aria-label={t("trackerSettings.questionText")}
            placeholder={t("trackerSettings.questionTextPh")}
            value={formData.questionText}
            onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
            rows={2}
            className={cn("rounded-2xl text-[17px] leading-snug", errors.questionText && "border-destructive")}
          />
          {errors.questionText && (
            <p className="text-sm text-destructive">{errors.questionText}</p>
          )}
        </div>

        {/* her own question: her answers in words, for links (library ones have theirs) */}
        {tracker && !templateIdOf(tracker) && <AnswerWordsFields value={words} onChange={setWords} />}

        {/* "Yes" is… Good / Bad. Good → the signal is a No day. */}
        <div>
          <p className="text-[19px] font-semibold">{t("addTracker.yesIs")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {([["good", "no"], ["bad", "yes"]] as const).map(([key, problemWhen]) => {
              const on = formData.problemWhen === problemWhen;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData({ ...formData, problemWhen })}
                  aria-pressed={on}
                  className={cn(
                    "h-[52px] rounded-2xl border-[1.5px] text-[17px] transition-colors",
                    on ? "border-foreground bg-foreground/15 font-bold" : "border-foreground/[0.18] bg-foreground/[0.05] font-medium",
                  )}
                >
                  {t(`addTracker.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* The limit as one sentence: "[8] days with Yes in [30] days" */}
        <div>
          <p className="text-[19px] font-semibold">{t("addTracker.limit")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-base">
            <Input
              id="threshold"
              type="number"
              inputMode="numeric"
              aria-label={t("addTracker.fieldThreshold")}
              min={1}
              value={thresholdRaw}
              onChange={(e) => {
                setThresholdRaw(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1) setFormData({ ...formData, threshold: n });
              }}
              className={cn("w-[68px] h-11 rounded-xl text-center text-base", errors.threshold && "border-destructive")}
            />
            <span>
              {t("addTracker.limitDaysWith", {
                count: formData.threshold,
                answer: formData.problemWhen === "yes" ? t("common.yes") : t("common.no"),
              })}
            </span>
            <Input
              id="periodDays"
              type="number"
              inputMode="numeric"
              aria-label={t("addTracker.fieldPeriod")}
              min={1}
              value={periodDaysRaw}
              onChange={(e) => {
                setPeriodDaysRaw(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1) setFormData({ ...formData, periodDays: n });
              }}
              className={cn("w-[68px] h-11 rounded-xl text-center text-base", errors.periodDays && "border-destructive")}
            />
            <span>{t("addTracker.limitDays", { count: formData.periodDays })}</span>
          </div>
          {errors.threshold && <p className="mt-2 text-sm text-destructive">{errors.threshold}</p>}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex items-center gap-1.5 text-base font-semibold text-muted-foreground"
          >
            {t("addTracker.moreSettings")}
            <ChevronDown className={cn("h-5 w-5 transition-transform", moreOpen && "rotate-180")} />
          </button>
          {moreOpen && (
            <div className="mt-4 space-y-5 animate-fade-in">
              {/* Theme (cluster): category is derived from it */}
              <div className="space-y-1.5">
                <Label htmlFor="cluster">{t("trackerSettings.categoryLabel")}</Label>
                <Select
                  value={formData.cluster ?? ""}
                  onValueChange={(value) => {
                    const derivedCategory = CLUSTER_TO_CATEGORY[value] ?? formData.category;
                    setFormData({ ...formData, cluster: value, category: derivedCategory });
                  }}
                >
                  <SelectTrigger id="cluster" className="h-12 rounded-xl text-base bg-background">
                    <SelectValue placeholder={t("addTracker.themePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {LIFE_STREAMS.map((stream) => (
                      <SelectItem key={stream.id} value={stream.id}>
                        {localizeGroupTitle(stream.title)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adviceAboveThreshold">{t("addTracker.fieldAdvice")}</Label>
                <Textarea
                  id="adviceAboveThreshold"
                  placeholder={t("trackerSettings.advicePh")}
                  value={formData.adviceAboveThreshold}
                  onChange={(e) => setFormData({ ...formData, adviceAboveThreshold: e.target.value })}
                  rows={3}
                  className={cn("rounded-xl text-base", errors.adviceAboveThreshold && "border-destructive")}
                />
                {errors.adviceAboveThreshold && (
                  <p className="text-sm text-destructive">{errors.adviceAboveThreshold}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: safe-area aware so Save never sits on the home indicator */}
      <div
        className="flex-shrink-0 px-6 pt-3 bg-background"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <Button
          onClick={handleSave}
          disabled={saving || !periodDaysRaw || !thresholdRaw}
          className="w-full h-[54px] rounded-full text-[17px] font-semibold"
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </BottomSheet>
  );
};
