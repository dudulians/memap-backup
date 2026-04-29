import { Tracker, TrackerEntry } from "@/types/tracker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { AlertCircle } from "lucide-react";
import { getEntries } from "@/lib/storage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle, localizeTrackerQuestion } from "@/lib/trackerLocalize";

interface DuplicateTrackerDialogProps {
  open: boolean;
  onClose: () => void;
  existingTracker: Tracker | null;
  onOpenExisting: () => void;
  onCreateAnyway: () => void;
}

export const DuplicateTrackerDialog = ({
  open,
  onClose,
  existingTracker,
  onOpenExisting,
  onCreateAnyway,
}: DuplicateTrackerDialogProps) => {
  const { t } = useTranslation();
  const [trackingDays, setTrackingDays] = useState(0);

  useEffect(() => {
    if (existingTracker) {
      calculateTrackingDays();
    }
  }, [existingTracker]);

  const calculateTrackingDays = async () => {
    if (!existingTracker) return;
    
    const entries = await getEntries();
    const trackerEntries = entries.filter(e => e.trackerId === existingTracker.id);
    
    if (trackerEntries.length > 0) {
      setTrackingDays(trackerEntries.length);
    } else {
      // Calculate days since creation
      const createdDate = new Date(existingTracker.createdAt);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setTrackingDays(diffDays);
    }
  };

  if (!existingTracker) return null;

  const categoryColor = getCategoryColor(existingTracker.category);
  const Icon = getTrackerIcon(existingTracker.title, existingTracker.category);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">{t("duplicate.title")}</DialogTitle>
              <DialogDescription className="mt-1.5">
                {t("duplicate.desc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Padding inside the preview card so the icon + text don't
            press against the rounded corners (24 px radius from
            card-premium). Without it, the icon's top-left visibly
            poked out beyond the card's curve and the right-edge text
            ran flush against the rim — the user's "icon lies a bit
            outside, text runs past the panel" complaint. */}
        <Card className="card-premium mt-4 p-4">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
              >
                <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-base break-words">{localizeTrackerTitle(existingTracker.title)}</h3>
                <p className="text-xs uppercase tracking-wider mt-1" style={{ color: `hsl(var(--${categoryColor}))` }}>
                  {t(`categories.${existingTracker.category}` as const)}
                </p>
                <p className="text-sm text-muted-foreground mt-2 font-playful break-words">
                  {localizeTrackerQuestion(existingTracker.questionText)}
                </p>
              </div>
            </div>

            <div className="pt-3">
              <p className="text-xs text-muted-foreground">
                {trackingDays === 1
                  ? t("duplicate.trackingForOne")
                  : t("duplicate.trackingForMany", { count: trackingDays })}
              </p>
            </div>
          </div>
        </Card>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-6">
          <Button
            variant="ghost"
            onClick={onCreateAnyway}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            {t("duplicate.createAnother")}
          </Button>
          <Button
            onClick={onOpenExisting}
            className="w-full sm:w-auto order-1 sm:order-2"
            style={{
              background: `linear-gradient(135deg, hsl(var(--${categoryColor})), hsl(var(--${categoryColor}-secondary)))`
            }}
          >
            {t("duplicate.openExisting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
