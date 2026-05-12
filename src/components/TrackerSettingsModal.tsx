import { useState, useEffect } from "react";
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
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { Check, X } from "lucide-react";

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
  const [thresholdRaw, setThresholdRaw] = useState<string>("10");
  const [periodDaysRaw, setPeriodDaysRaw] = useState<string>("30");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
      setPeriodDaysRaw(String(tracker.periodDays));
      setThresholdRaw(String(tracker.threshold));
      setErrors({});
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

  // Tracker icon for the header — matches the visual language of
  // ReflectionSheet / TrackerDetails so all tracker-scoped sheets feel
  // like one family.
  const TIcon = tracker ? getTrackerIcon(tracker.title, tracker.category) : null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      className="h-[92vh] flex flex-col"
      ariaTitle={tracker ? localizeTrackerTitle(tracker.title) : t("trackerSettings.title")}
    >
      {/* Sticky header — gives the sheet a clear identity (which tracker
          is being edited) without competing with the global X button
          provided by BottomSheet. */}
      <div className="px-6 pt-3 pb-4 flex-shrink-0 border-b border-border/30">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {t("trackerSettings.title")}
        </p>
        {tracker && (
          <h2 className="flex items-center gap-2 mt-1 text-lg font-semibold pr-10">
            {TIcon && <TIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />}
            <span className="truncate">{localizeTrackerTitle(tracker.title)}</span>
          </h2>
        )}
      </div>

      {/* Scrollable body — same paddings and section rhythm as
          ReflectionSheet / SettingsModal sub-screens.
          `overscroll-y-contain` kills the iOS rubber-band overscroll
          inside the body. Without it, pulling down on a scrolled
          form gives an elastic "pull-to-refresh"-style bounce that
          fights with vaul's drag-to-close gesture from the handle.
          With `overscroll-contain` the body just stops at scrollTop=0
          / bottom — no bounce, no fake pull-to-refresh feel — and
          vaul cleanly takes over the gesture. */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-6 py-5 space-y-6">
        {/* Question Text */}
        <div className="space-y-2">
          <Label htmlFor="questionText">{t("trackerSettings.questionText")}</Label>
          <Textarea
            id="questionText"
            placeholder={t("trackerSettings.questionTextPh")}
            value={formData.questionText}
            onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
            rows={3}
            className={errors.questionText ? "border-destructive" : ""}
          />
          {errors.questionText && (
            <p className="text-xs text-destructive">{errors.questionText}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("trackerSettings.questionHelp")}
          </p>
        </div>

        {/* Answer Type */}
        {/* Тип ответа field removed in 1.7+ — only boolean (Да/Нет)
            is currently supported, so the dropdown showed a single
            disabled option. The user pointed out it was clutter.
            If we ever add scale/count/note answer types, restore. */}

        {/* Period + Threshold */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="periodDays">{t("addTracker.fieldPeriod")}</Label>
            <Input
              id="periodDays"
              type="number"
              min={1}
              value={periodDaysRaw}
              onChange={(e) => {
                setPeriodDaysRaw(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1) setFormData({ ...formData, periodDays: n });
              }}
              className={errors.periodDays ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">{t("addTracker.fieldPeriodHelp")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="threshold">{t("addTracker.fieldThreshold")}</Label>
            <Input
              id="threshold"
              type="number"
              min={1}
              value={thresholdRaw}
              onChange={(e) => {
                setThresholdRaw(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1) setFormData({ ...formData, threshold: n });
              }}
              className={errors.threshold ? "border-destructive" : ""}
            />
            {errors.threshold && <p className="text-xs text-destructive">{errors.threshold}</p>}
            <p className="text-xs text-muted-foreground">{t("addTracker.fieldThresholdHelp")}</p>
          </div>
        </div>

        {/* Polarity — visual Yes/No colour toggle. Same component
            as the Custom-form in AddTrackerModal (1.7+). Selected
            button is GREEN (good answer); unselected is RED (signal).
            problemWhen wiring inverted: tap "Да" → problemWhen="no"
            since the SIGNAL fires on the No answer. */}
        <div className="space-y-2">
          <Label>{t("addTracker.fieldConcern")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("addTracker.fieldConcernDesc")}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {(["yes", "no"] as const).map((answerKey) => {
              const isGood =
                (answerKey === "yes" && formData.problemWhen === "no") ||
                (answerKey === "no" && formData.problemWhen === "yes");
              return (
                <button
                  key={answerKey}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      problemWhen: answerKey === "yes" ? "no" : "yes",
                    })
                  }
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium transition-all"
                  style={
                    isGood
                      ? {
                          borderColor: "hsl(var(--balanced))",
                          background: "hsl(var(--balanced) / 0.12)",
                          color: "hsl(var(--balanced))",
                        }
                      : {
                          borderColor: "hsl(var(--strong) / 0.4)",
                          background: "hsl(var(--strong) / 0.06)",
                          color: "hsl(var(--strong))",
                        }
                  }
                >
                  {isGood ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  )}
                  {answerKey === "yes" ? t("common.yes") : t("common.no")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme (cluster) — replaces the old "Категория (Поток
            жизни)" dropdown. User picks a life-area theme; we
            derive Tracker.category for color/stats from a fixed
            map. Same UX as the Custom form in AddTrackerModal. */}
        <div className="space-y-2">
          <Label htmlFor="cluster">{t("trackerSettings.categoryLabel")}</Label>
          <Select
            value={formData.cluster ?? ""}
            onValueChange={(value) => {
              const derivedCategory = CLUSTER_TO_CATEGORY[value] ?? formData.category;
              setFormData({ ...formData, cluster: value, category: derivedCategory });
            }}
          >
            <SelectTrigger id="cluster" className="bg-background">
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
          <p className="text-xs text-muted-foreground">
            {t("trackerSettings.categoryHelp")}
          </p>
        </div>

        {/* Advice / Reflection */}
        <div className="space-y-2">
          <Label htmlFor="adviceAboveThreshold">{t("trackerSettings.adviceLabel")}</Label>
          <Textarea
            id="adviceAboveThreshold"
            placeholder={t("trackerSettings.advicePh")}
            value={formData.adviceAboveThreshold}
            onChange={(e) => setFormData({ ...formData, adviceAboveThreshold: e.target.value })}
            rows={3}
            className={errors.adviceAboveThreshold ? "border-destructive" : ""}
          />
          {errors.adviceAboveThreshold && (
            <p className="text-xs text-destructive">{errors.adviceAboveThreshold}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("trackerSettings.adviceHelp")}
          </p>
        </div>
      </div>

      {/* Sticky footer — actions always reachable, safe-area aware so
          the Save button never sits on the iOS home indicator. */}
      <div
        className="flex-shrink-0 px-6 pt-3 border-t border-border/30 bg-background"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !periodDaysRaw || !thresholdRaw}
            style={{
              background: 'linear-gradient(135deg, hsl(var(--curious)), hsl(var(--fun)))'
            }}
          >
            {saving ? t("common.saving") : t("trackerSettings.saveChanges")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};
