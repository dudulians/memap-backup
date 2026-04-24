import { Tracker, TrackerEntry } from "@/types/tracker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { AlertCircle } from "lucide-react";
import { getEntries } from "@/lib/storage";
import { useEffect, useState } from "react";

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
              <DialogTitle className="text-lg">You're already tracking this</DialogTitle>
              <DialogDescription className="mt-1.5">
                This tracker is already on your map. You can keep using the existing one or create a new copy.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Card className="card-premium mt-4">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
              >
                <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-base">{existingTracker.title}</h3>
                <p className="text-xs uppercase tracking-wider mt-1" style={{ color: `hsl(var(--${categoryColor}))` }}>
                  {existingTracker.category}
                </p>
                <p className="text-sm text-muted-foreground mt-2 font-playful">
                  {existingTracker.questionText}
                </p>
              </div>
            </div>
            
            <div className="pt-3">
              <p className="text-xs text-muted-foreground">
                You've been tracking this for{" "}
                <span className="font-medium text-foreground">
                  {trackingDays} {trackingDays === 1 ? "day" : "days"}
                </span>
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
            Create another anyway
          </Button>
          <Button
            onClick={onOpenExisting}
            className="w-full sm:w-auto order-1 sm:order-2"
            style={{
              background: `linear-gradient(135deg, hsl(var(--${categoryColor})), hsl(var(--${categoryColor}-secondary)))`
            }}
          >
            Open existing tracker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
