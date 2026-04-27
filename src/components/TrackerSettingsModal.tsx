import { useState, useEffect } from "react";
import { Tracker } from "@/types/tracker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { localizeTrackerQuestion, localizeTrackerAdvice } from "@/lib/trackerLocalize";

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
        questionText: localizeTrackerQuestion(tracker.questionText),
        answerType: tracker.answerType,
        periodDays: tracker.periodDays,
        threshold: tracker.threshold,
        problemWhen: tracker.problemWhen,
        category: tracker.category,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("trackerSettings.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
          <div className="space-y-2">
            <Label htmlFor="answerType">{t("trackerSettings.answerType")}</Label>
            <Select
              value={formData.answerType}
              onValueChange={(value) => setFormData({ ...formData, answerType: value as Tracker["answerType"] })}
            >
              <SelectTrigger id="answerType" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="boolean">{t("trackerSettings.answerBool")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("trackerSettings.answerTypeHelp")}
            </p>
          </div>

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

          {/* Concerning answer */}
          <div className="space-y-2">
            <Label>{t("addTracker.fieldConcern")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("addTracker.fieldConcernDesc")}
            </p>
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors hover:bg-muted/30"
                style={formData.problemWhen === "yes" ? { borderColor: "hsl(var(--strong))", background: "hsl(var(--strong) / 0.05)" } : {}}>
                <input
                  type="radio"
                  name="problemWhen"
                  value="yes"
                  checked={formData.problemWhen === "yes"}
                  onChange={() => setFormData({ ...formData, problemWhen: "yes" })}
                  className="h-4 w-4 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{t("addTracker.yesConcerning")}</p>
                  <p className="text-xs text-muted-foreground">{t("addTracker.yesConcerningDesc")}</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors hover:bg-muted/30"
                style={formData.problemWhen === "no" ? { borderColor: "hsl(var(--strong))", background: "hsl(var(--strong) / 0.05)" } : {}}>
                <input
                  type="radio"
                  name="problemWhen"
                  value="no"
                  checked={formData.problemWhen === "no"}
                  onChange={() => setFormData({ ...formData, problemWhen: "no" })}
                  className="h-4 w-4 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{t("addTracker.noConcerning")}</p>
                  <p className="text-xs text-muted-foreground">{t("addTracker.noConcerningDesc")}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">{t("trackerSettings.categoryLabel")}</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value as Tracker["category"] })}
            >
              <SelectTrigger id="category" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="Emotions">{t("trackerSettings.categoryEmotions")}</SelectItem>
                <SelectItem value="Body">{t("trackerSettings.categoryBody")}</SelectItem>
                <SelectItem value="Connections">{t("trackerSettings.categoryConnections")}</SelectItem>
                <SelectItem value="Voice">{t("trackerSettings.categoryVoice")}</SelectItem>
                <SelectItem value="Health">{t("trackerSettings.categoryHealth")}</SelectItem>
                <SelectItem value="Curious">{t("trackerSettings.categoryCurious")}</SelectItem>
                <SelectItem value="Fun">{t("trackerSettings.categoryFun")}</SelectItem>
                <SelectItem value="Social">{t("trackerSettings.categorySocial")}</SelectItem>
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

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
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
      </DialogContent>
    </Dialog>
  );
};
