import { useState, useRef, useEffect, useCallback } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronRight, SkipForward, Sparkles } from "lucide-react";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { TEMPLATE_GROUPS } from "@/lib/templateGroups";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { playSwipeSound, triggerHaptic as runHaptic } from "@/lib/feedback";

interface DailySessionProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  selectedDate: string;
  onAnswer: (trackerId: string, value: boolean) => Promise<void>;
  onClose: () => void;
  onComplete: () => void;
}

interface SessionQuestion {
  tracker: Tracker;
  existingAnswer?: boolean;
  isNew?: boolean;
  templateId?: string;
}

// Session settings from localStorage
const getSessionSettings = () => {
  const data = localStorage.getItem("memap_session_settings");
  const fallback = { includeSuggestedQuestions: true, soundEnabled: true, lastRecommendationDate: null as string | null };
  if (!data) return fallback;
  try { return { ...fallback, ...JSON.parse(data) }; } catch { return fallback; }
};

const patchSessionSettings = (updates: Record<string, unknown>) => {
  const current = getSessionSettings();
  localStorage.setItem("memap_session_settings", JSON.stringify({ ...current, ...updates }));
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Sound feedback — delegates to the shared feedback module, which uses a
// single long-lived AudioContext and a smooth envelope so the tones don't
// sound harsh. Respects the sound/vibration toggle in Settings.
const playFeedbackSound = (type: "yes" | "no" | "skip") => {
  const settings = getSessionSettings();
  if (!settings.soundEnabled) return;
  playSwipeSound(type);
};

// Haptic feedback — uses native @capacitor/haptics on iOS/Android (required
// on iOS since `navigator.vibrate` is a no-op there), falls back to the
// Web Vibration API in browsers.
const triggerHaptic = (type: "light" | "medium" | "heavy") => {
  const settings = getSessionSettings();
  if (!settings.soundEnabled) return;
  runHaptic(type);
};

export const DailySession = ({
  trackers,
  entries,
  selectedDate,
  onAnswer,
  onClose,
  onComplete,
}: DailySessionProps) => {
  const settings = getSessionSettings();
  
  // Build the deck of unanswered questions + new suggestions
  const buildDeck = useCallback((): SessionQuestion[] => {
    const existingTrackerIds = new Set(trackers.map(t => t.id));
    
    // Step 1: Get unanswered questions from active trackers
    const unansweredQuestions = trackers
      .filter(tracker => !tracker.archived)
      .map(tracker => {
        const existingEntry = entries.find(
          e => e.trackerId === tracker.id && e.date === selectedDate
        );
        return {
          tracker,
          existingAnswer: existingEntry?.value,
          isNew: false,
        };
      })
      .filter(q => q.existingAnswer === undefined);

    // Step 2: Add new suggested questions if enabled and not yet shown today.
    // Only inject suggestions when the user is answering for *today* —
    // "try this new pattern" doesn't make sense when back-filling a past date.
    let newQuestions: SessionQuestion[] = [];
    const isTodaySession = selectedDate === todayLocal();
    if (isTodaySession && settings.includeSuggestedQuestions && settings.lastRecommendationDate !== todayLocal()) {
      const allTemplates = TEMPLATE_GROUPS.flatMap(group => group.templates);
      const existingTitles = new Set(trackers.map(t => t.title.toLowerCase().trim()));

      const availableTemplates = allTemplates.filter(
        t => !existingTitles.has(t.title.toLowerCase().trim())
      );

      // Shuffle and take at most 1 per day
      const shuffled = availableTemplates.sort(() => Math.random() - 0.5);
      const selectedTemplates = shuffled.slice(0, 1);

      newQuestions = selectedTemplates.map(template => ({
        tracker: {
          id: `new-${template.id}`,
          title: template.title,
          questionText: template.questionText,
          category: template.category,
          subcategory: template.subcategory,
          periodDays: template.periodDays,
          threshold: template.threshold,
          problemWhen: template.problemWhen,
          adviceAboveThreshold: template.adviceAboveThreshold,
          answerType: "boolean" as const,
          createdAt: new Date().toISOString(),
        },
        isNew: true,
        templateId: template.id,
      }));
    }

    return [...unansweredQuestions, ...newQuestions];
  }, [trackers, entries, selectedDate, settings.includeSuggestedQuestions]);

  const [deck] = useState<SessionQuestion[]>(() => buildDeck());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [newPatternsAdded, setNewPatternsAdded] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "down" | null>(null);
  const [completed, setCompleted] = useState(false);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const activePointerId = useRef<number | null>(null);
  const currentDx = useRef(0);
  const currentDy = useRef(0);
  const isAnimatingRef = useRef(false);

  // Record the date the moment a suggestion card is first shown
  useEffect(() => {
    if (deck[currentIndex]?.isNew) {
      patchSessionSettings({ lastRecommendationDate: todayLocal() });
    }
  }, [currentIndex]);

  const handleDisableRecommendations = () => {
    patchSessionSettings({ includeSuggestedQuestions: false });
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const currentQuestion = deck[currentIndex];
  const totalQuestions = deck.length;
  const progress = totalQuestions > 0 ? ((currentIndex) / totalQuestions) * 100 : 100;

  // Lock body scroll when session is active
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, []);

  useEffect(() => {
    if (totalQuestions === 0) {
      setCompleted(true);
    }
  }, [totalQuestions]);

  const handleAnswer = (value: boolean) => {
    if (isAnimatingRef.current || !currentQuestion) return;

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection(value ? "right" : "left");

    // Play sound and haptic
    playFeedbackSound(value ? "yes" : "no");
    triggerHaptic("medium");
    setAnsweredCount(prev => prev + 1);

    // Kick off persistence in the background — never await it here,
    // so a failure or slow write can't lock the session.
    (async () => {
      try {
        if (currentQuestion.isNew) {
          // Suggested question: create the tracker and save the answer
          // regardless of Yes/No. Previously we only saved on Yes, so a
          // No answer was silently thrown away and the user wondered
          // why they even answered it.
          const newTracker: Tracker = {
            ...currentQuestion.tracker,
            id: uuid(),
            createdAt: new Date().toISOString(),
          };
          const existingTrackers = await getTrackers();
          await saveTrackers([...existingTrackers, newTracker]);
          await onAnswer(newTracker.id, value);
          setNewPatternsAdded(prev => prev + 1);
        } else {
          await onAnswer(currentQuestion.tracker.id, value);
        }
      } catch (err) {
        console.error("DailySession: save failed", err);
      }
    })();

    // Advance the UI on a fixed animation timer — independent of the save.
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
        triggerConfetti();
      }
      setSwipeDirection(null);
      setIsAnimating(false);
      isAnimatingRef.current = false;
      setDragX(0);
      setDragY(0);
      currentDx.current = 0;
      currentDy.current = 0;
    }, 300);
  };

  const handleSkip = () => {
    if (isAnimatingRef.current || !currentQuestion) return;

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection("down");
    
    // Play sound and haptic
    playFeedbackSound("skip");
    triggerHaptic("light");
    
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
        if (answeredCount > 0) {
          triggerConfetti();
        }
      }
      setSwipeDirection(null);
      setIsAnimating(false);
      isAnimatingRef.current = false;
      setDragX(0);
      setDragY(0);
      currentDx.current = 0;
      currentDy.current = 0;
    }, 200);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#DDA0DD'],
    });
  };

  // Unified pointer handlers (mouse + touch + pen)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnimatingRef.current) return;
    const target = e.target as HTMLElement;
    // Let buttons & interactive controls handle their own clicks
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;
    if (activePointerId.current !== null) return;

    activePointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    currentDx.current = 0;
    currentDy.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const dx = e.clientX - touchStartX.current;
    const dy = e.clientY - touchStartY.current;
    currentDx.current = dx;
    currentDy.current = dy;
    setDragX(dx);
    setDragY(dy);
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    activePointerId.current = null;

    const dx = currentDx.current;
    const dy = currentDy.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > 80 && absX > absY) {
      if (dx > 0) handleAnswer(true); else handleAnswer(false);
    } else if (dy > 80 && absY > absX) {
      handleSkip();
    } else {
      setDragX(0);
      setDragY(0);
      currentDx.current = 0;
      currentDy.current = 0;
    }
  };

  if (completed) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-semibold">Session completed!</h1>
            <p className="text-muted-foreground">
              {deck.length === 0
                ? "All caught up — nothing to answer today"
                : answeredCount > 0
                ? `You answered ${answeredCount} question${answeredCount !== 1 ? 's' : ''} today`
                : "Session complete — see you tomorrow"}
            </p>
            {newPatternsAdded > 0 && (
              <p className="text-sm text-primary">
                {newPatternsAdded} new pattern{newPatternsAdded !== 1 ? 's' : ''} added
              </p>
            )}
            <Button
              onClick={onComplete}
              className="rounded-full px-8"
              size="lg"
            >
              Back to Today
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const categoryColor = getCategoryColor(currentQuestion.tracker.category);
  // When "yes" is the problem signal → Yes = red/strong, No = green/balanced. Flip otherwise.
  const yesIsSignificant = currentQuestion.tracker.problemWhen === "yes";
  const yesColorClass = yesIsSignificant ? "strong" : "balanced";
  const noColorClass = yesIsSignificant ? "balanced" : "strong";

  return (
    <div
      className="fixed inset-0 bg-background z-50 flex flex-col"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">
            Question {currentIndex + 1} of {totalQuestions}
          </p>
          {selectedDate !== todayLocal() && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Filling in for {(() => {
                const d = new Date(selectedDate + "T00:00:00");
                return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              })()}
            </p>
          )}
        </div>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 flex-shrink-0">
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Full-screen card area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div 
          className={cn(
            "w-full max-w-md transition-transform duration-300",
            swipeDirection === "right" && "translate-x-[120%] rotate-12",
            swipeDirection === "left" && "-translate-x-[120%] -rotate-12",
            swipeDirection === "down" && "translate-y-[120%] opacity-50",
            isAnimating && !swipeDirection && "opacity-0"
          )}
          style={{
            transform: !isAnimating && (dragX || dragY) 
              ? `translateX(${dragX}px) translateY(${Math.max(0, dragY)}px) rotate(${dragX * 0.03}deg)` 
              : undefined
          }}
        >
          {/* Swipe indicators */}
          <div className="relative">
            {dragX > 50 && (
              <div className={cn(
                "absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full px-4 py-2 rounded-full font-semibold animate-fade-in z-10",
                yesIsSignificant ? "bg-strong text-strong-foreground" : "bg-balanced text-balanced-foreground"
              )}>
                Yes ✓
              </div>
            )}
            {dragX < -50 && (
              <div className={cn(
                "absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full px-4 py-2 rounded-full font-semibold animate-fade-in z-10",
                yesIsSignificant ? "bg-balanced text-balanced-foreground" : "bg-strong text-strong-foreground"
              )}>
                No ✗
              </div>
            )}
            {dragY > 50 && (
              <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 translate-y-full bg-muted text-muted-foreground px-4 py-2 rounded-full font-semibold animate-fade-in z-10">
                Skip ↓
              </div>
            )}

            <Card className="card-premium overflow-hidden shadow-lg">
              <CardContent className="p-6 space-y-6">
                {/* New badge + disable link */}
                {currentQuestion.isNew && (
                  <div className="flex flex-col items-center gap-1">
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      <Sparkles className="h-3 w-3 mr-1" />
                      New suggestion
                    </Badge>
                    <button
                      onClick={handleDisableRecommendations}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      Don't show these
                    </button>
                  </div>
                )}

                {/* Category badge */}
                <div className="flex items-center justify-center">
                  <Badge
                    variant="secondary"
                    className="text-xs px-3 py-1"
                    style={{ 
                      backgroundColor: `hsl(var(--${categoryColor}) / 0.15)`,
                      color: `hsl(var(--${categoryColor}))`
                    }}
                  >
                    {(() => {
                      const QIcon = getTrackerIcon(currentQuestion.tracker.title, currentQuestion.tracker.category);
                      return <QIcon className="h-3.5 w-3.5 mr-1.5 inline-block" strokeWidth={1.75} />;
                    })()}
                    {currentQuestion.tracker.title} · {currentQuestion.tracker.category}
                  </Badge>
                </div>

                {/* Question */}
                <div className="text-center py-12">
                  <p className="text-xl font-medium leading-relaxed">
                    {currentQuestion.tracker.questionText}
                  </p>
                </div>

                {/* Swipe hints */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4">
                  <span>← No</span>
                  <span className="text-center">↓ Skip</span>
                  <span>Yes →</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="p-4 space-y-3 flex-shrink-0 bg-background border-t">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleAnswer(false)}
            disabled={isAnimating}
            className={cn(
              "rounded-full border-2",
              noColorClass === "strong"
                ? "border-strong/50 hover:bg-strong/10 text-strong"
                : "border-balanced/60 hover:bg-balanced/10 text-balanced"
            )}
          >
            No
          </Button>
          <Button
            size="lg"
            onClick={() => handleAnswer(true)}
            disabled={isAnimating}
            className={cn(
              "rounded-full",
              yesColorClass === "strong"
                ? "bg-strong hover:bg-strong/90 text-strong-foreground"
                : "bg-balanced hover:bg-balanced/90 text-balanced-foreground"
            )}
          >
            Yes
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={handleSkip}
          disabled={isAnimating}
          className="w-full text-muted-foreground"
        >
          <SkipForward className="h-4 w-4 mr-2" />
          Skip this question
        </Button>
      </div>
    </div>
  );
};
