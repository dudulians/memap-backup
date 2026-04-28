import { useState, useRef, useCallback } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Check, X, Trash2 } from "lucide-react";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { localizeTrackerTitle, localizeTrackerQuestion } from "@/lib/trackerLocalize";

interface SwipeableTrackerCardProps {
  tracker: Tracker;
  selectedDateEntry: TrackerEntry | undefined;
  onAnswer: (trackerId: string, value: boolean) => void;
  onOpenDetails: (tracker: Tracker) => void;
  onDelete?: (tracker: Tracker) => void;
  dragHandleProps?: any;
  isDragging?: boolean;
  showButtons?: boolean;
  compact?: boolean;
}

// 60 px is the smallest distance the user has to drag before the swipe
// "commits". Was 100 — that worked fine on a 414 pt phone with Tinder-
// style finger placement, but the user reported having to drag almost
// half-way across the card AND arc her finger downward to register a
// swipe-right. 60 px (~15 % of typical card width) reads as a deliberate
// flick without requiring a full diagonal motion.
const SWIPE_THRESHOLD = 60;

const isHapticEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem("memap_session_settings");
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    // Haptics are now their own setting. Fall back to soundEnabled
    // for users who upgrade from the combined-toggle era so we don't
    // silently flip vibration back on against their wishes.
    if (typeof parsed?.hapticsEnabled === "boolean") {
      return parsed.hapticsEnabled;
    }
    return parsed?.soundEnabled !== false;
  } catch {
    return true;
  }
};

export const SwipeableTrackerCard = ({
  tracker,
  selectedDateEntry,
  onAnswer,
  onOpenDetails,
  onDelete,
  dragHandleProps,
  isDragging,
  showButtons = true,
  compact = false,
}: SwipeableTrackerCardProps) => {
  const { t } = useTranslation();
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showDeleteBar, setShowDeleteBar] = useState(false);
  const startX = useRef(0);
  const currentDx = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const activePointerId = useRef<number | null>(null);
  // Only call setPointerCapture AFTER movement crosses a threshold. If we
  // capture on pointerdown, iOS Safari steals the synthesized click on nearby
  // buttons for taps anywhere in this zone and neighboring siblings.
  const hasCaptured = useRef(false);
  const CAPTURE_THRESHOLD = 8;

  const Icon = getTrackerIcon(tracker.title, tracker.category);
  const categoryColor = getCategoryColor(tracker.category);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (onDelete) {
        // Vibrate if available
        if (isHapticEnabled() && navigator.vibrate) navigator.vibrate(30);
        setShowDeleteBar(true);
      }
    }, 500);
  }, [onDelete]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore gestures that started on the drag handle or buttons
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-drag-handle]")) return;
    if (activePointerId.current !== null) return;

    activePointerId.current = e.pointerId;
    // NOTE: do NOT setPointerCapture here — only after the user clearly swipes.
    hasCaptured.current = false;
    startX.current = e.clientX;
    currentDx.current = 0;
    setIsSwiping(true);
    setSwipeX(0);
    startLongPress();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    currentDx.current = dx;
    if (Math.abs(dx) > 10) clearLongPress();
    // Promote to captured pointer only once horizontal motion is unambiguous.
    if (!hasCaptured.current && Math.abs(dx) > CAPTURE_THRESHOLD) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
      hasCaptured.current = true;
    }
    setSwipeX(dx);
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    if (hasCaptured.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
    hasCaptured.current = false;
    clearLongPress();
    const dx = currentDx.current;
    activePointerId.current = null;
    setIsSwiping(false);
    setSwipeX(0);
    currentDx.current = 0;

    if (dx > SWIPE_THRESHOLD) {
      onAnswer(tracker.id, true);
    } else if (dx < -SWIPE_THRESHOLD) {
      onAnswer(tracker.id, false);
    }
  };

  const getSwipeOpacity = () => {
    return Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);
  };

  const isAnswered = selectedDateEntry !== undefined;
  const currentAnswer = selectedDateEntry?.value;
  const yesIsSignificant = tracker.problemWhen === "yes";

  // Fire-once latch: whichever of pointerup/click arrives first wins.
  // iOS Safari sometimes skips the synthesized click; desktop fires both.
  const answerLatch = useRef(false);
  const fireAnswer = (e: React.SyntheticEvent, value: boolean) => {
    e.stopPropagation();
    if (answerLatch.current) return;
    answerLatch.current = true;
    onAnswer(tracker.id, value);
    setTimeout(() => { answerLatch.current = false; }, 0);
  };

  return (
    <div className="relative">
      {/* Swipe indicators */}
      <div
        className={`absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-4 rounded-l-2xl transition-opacity ${yesIsSignificant ? "bg-balanced/20" : "bg-strong/20"}`}
        style={{ opacity: swipeX < 0 ? getSwipeOpacity() : 0 }}
      >
        <div className={`flex items-center gap-2 font-medium ${yesIsSignificant ? "text-balanced" : "text-strong"}`}>
          <X className="h-6 w-6" />
          <span>{t("common.no")}</span>
        </div>
      </div>
      <div
        className={`absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-4 rounded-r-2xl transition-opacity ${yesIsSignificant ? "bg-strong/20" : "bg-balanced/20"}`}
        style={{ opacity: swipeX > 0 ? getSwipeOpacity() : 0 }}
      >
        <div className={`flex items-center gap-2 font-medium ${yesIsSignificant ? "text-strong" : "text-balanced"}`}>
          <span>{t("common.yes")}</span>
          <Check className="h-6 w-6" />
        </div>
      </div>

      {/* Main card */}
      <Card
        ref={cardRef}
        style={{
          transform: `translateX(${swipeX}px)`,
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onDelete) {
            if (isHapticEnabled() && navigator.vibrate) navigator.vibrate(30);
            setShowDeleteBar(true);
          }
        }}
        className={cn(
          "card-premium animate-fade-in overflow-hidden select-none",
          isDragging && "shadow-2xl opacity-50",
          // Only animate the snap-back AFTER release — during active
          // drag the card follows the finger 1:1. With the transition
          // always on, every pointermove triggered a 200 ms tween, so
          // the card visibly trailed the finger and the user had to
          // overshoot (or arc diagonally) to "convince" the gesture
          // it had crossed the threshold.
          !isSwiping && "transition-transform duration-200"
        )}
      >
        {/* Swipe-capture zone — everything here reacts to horizontal drag.
            Buttons below live OUTSIDE this zone so taps are never stolen. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onClick={() => {
            if (didLongPress.current) {
              didLongPress.current = false;
              return;
            }
            if (!isSwiping && Math.abs(currentDx.current) < 10) onOpenDetails(tracker);
          }}
          style={{ touchAction: "pan-y" }}
          className={cn("cursor-pointer", compact ? "p-3" : "p-4", showButtons && "pb-0")}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex items-center justify-center rounded-xl shrink-0",
                compact ? "w-9 h-9" : "w-11 h-11"
              )}
              style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
            >
              <Icon
                className={cn(compact ? "h-4 w-4" : "h-5 w-5")}
                strokeWidth={1.75}
                style={{ color: `hsl(var(--${categoryColor}-foreground, var(--foreground)))` }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={cn("font-medium mb-1 leading-snug", compact ? "text-sm" : "text-base")}>{localizeTrackerTitle(tracker.title)}</h3>
              <p className={cn("text-muted-foreground/80 leading-relaxed line-clamp-2", compact ? "text-xs" : "text-sm")}>
                {localizeTrackerQuestion(tracker.questionText)}
              </p>
            </div>
            {dragHandleProps && (
              <button
                {...dragHandleProps}
                data-drag-handle
                className="touch-none cursor-grab active:cursor-grabbing p-1 hover:bg-muted/40 rounded-lg transition-colors flex-shrink-0 opacity-40 hover:opacity-100"
                aria-label={t("swipeCard.dragToReorder")}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        {/* end swipe-capture zone */}

        <div className={cn(compact ? "px-3 pb-3" : "px-4 pb-4")}>
          {/* Yes/No Buttons — outside the swipe zone so taps always register */}
          {showButtons && (
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => fireAnswer(e, false)}
                onClick={(e) => fireAnswer(e, false)}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "flex-1 rounded-full border-2 transition-all",
                  currentAnswer === false
                    ? yesIsSignificant
                      ? "bg-balanced text-balanced-foreground border-balanced font-semibold hover:bg-balanced/90"
                      : "bg-strong text-strong-foreground border-strong font-semibold hover:bg-strong/90"
                    : "bg-background border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <X className="h-4 w-4 mr-1.5" />
                {t("common.no")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => fireAnswer(e, true)}
                onClick={(e) => fireAnswer(e, true)}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "flex-1 rounded-full border-2 transition-all",
                  currentAnswer === true
                    ? yesIsSignificant
                      ? "bg-strong text-strong-foreground border-strong font-semibold hover:bg-strong/90"
                      : "bg-balanced text-balanced-foreground border-balanced font-semibold hover:bg-balanced/90"
                    : "bg-background border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <Check className="h-4 w-4 mr-1.5" />
                {t("common.yes")}
              </Button>
            </div>
          )}

          {/* Answer indicator (shown when buttons are hidden) */}
          {!showButtons && isAnswered && (
            <div className="mt-3 flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                  currentAnswer === true
                    ? yesIsSignificant ? "bg-strong/10 text-strong" : "bg-balanced/10 text-balanced"
                    : yesIsSignificant ? "bg-balanced/10 text-balanced" : "bg-strong/10 text-strong"
                )}
              >
                {currentAnswer === true ? (
                  <>
                    <Check className="h-3 w-3" />
                    {t("common.yes")}
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    {t("common.no")}
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{t("swipeCard.swipeToChange")}</span>
            </div>
          )}

          {/* Swipe hint for unanswered (when no buttons) */}
          {!showButtons && !isAnswered && (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              {t("swipeCard.swipeHint")}
            </div>
          )}
        </div>

        {/* Long-press delete bar */}
        {showDeleteBar && onDelete && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-border/50 animate-fade-in">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteBar(false);
                onDelete(tracker);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t("common.delete")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteBar(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
