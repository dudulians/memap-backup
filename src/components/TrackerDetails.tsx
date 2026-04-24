import { useState, useEffect, useRef } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getEntries, saveEntries } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lightbulb, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { MonthlyCalendar } from "@/components/MonthlyCalendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/uuid";

interface TrackerDetailsProps {
  tracker: Tracker;
  trackers?: Tracker[];
  currentIndex?: number;
  onBack: () => void;
  onNavigateTracker?: (direction: "prev" | "next") => void;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
}

type TabType = "questions" | "calendar";

export const TrackerDetails = ({ 
  tracker, 
  trackers,
  currentIndex,
  onBack, 
  onNavigateTracker,
  selectedDate, 
  onDateSelect 
}: TrackerDetailsProps) => {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("questions");
  const tabSwipeStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveSelectedDate = selectedDate || new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const data = await getEntries();
    setEntries(data);
    setLoading(false);
  };

  const getCurrentEntry = () => {
    return entries.find(
      (e) => e.trackerId === tracker.id && e.date === effectiveSelectedDate
    );
  };

  const handleBulkAnswer = async (dates: string[], value: boolean | null) => {
    let updatedEntries = [...entries];
    for (const date of dates) {
      const existingIndex = updatedEntries.findIndex(
        (e) => e.trackerId === tracker.id && e.date === date
      );
      if (value === null) {
        if (existingIndex !== -1) updatedEntries.splice(existingIndex, 1);
      } else if (existingIndex !== -1) {
        updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], value };
      } else {
        updatedEntries.push({ id: uuid(), trackerId: tracker.id, date, value });
      }
    }
    setEntries(updatedEntries);
    await saveEntries(updatedEntries);
  };

  const handleAnswer = async (value: boolean) => {
    const existingEntry = getCurrentEntry();

    if (existingEntry) {
      const updatedEntries = entries.map((e) =>
        e.id === existingEntry.id ? { ...e, value } : e
      );
      setEntries(updatedEntries);
      await saveEntries(updatedEntries);
    } else {
      const newEntry: TrackerEntry = {
        id: uuid(),
        trackerId: tracker.id,
        date: effectiveSelectedDate,
        value,
      };
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      await saveEntries(updatedEntries);
    }
  };

  // Swipe handlers for tab switching
  const handleTabSwipeStart = (e: React.TouchEvent) => {
    tabSwipeStartX.current = e.touches[0].clientX;
  };

  const handleTabSwipeEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - tabSwipeStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeTab === "calendar") {
        setActiveTab("questions");
      } else if (diff < 0 && activeTab === "questions") {
        setActiveTab("calendar");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Calculate stats for warning
  const trackerEntries = entries.filter(e => e.trackerId === tracker.id);
  const significantCount = trackerEntries.filter(e => 
    tracker.problemWhen === "yes" ? e.value === true : e.value === false
  ).length;
  const showWarning = significantCount >= tracker.threshold;
  
  const categoryColor = getCategoryColor(tracker.category);
  const Icon = getTrackerIcon(tracker.title, tracker.category);

  const canGoPrev = trackers && currentIndex !== undefined && currentIndex > 0;
  const canGoNext = trackers && currentIndex !== undefined && currentIndex < trackers.length - 1;

  // Format selected date for display
  const selectedDateDisplay = effectiveSelectedDate 
    ? format(new Date(effectiveSelectedDate + "T00:00:00"), "d MMMM yyyy")
    : format(new Date(), "d MMMM yyyy");

  const currentEntry = getCurrentEntry();
  const currentAnswer = currentEntry?.value;

  return (
    <div
      ref={containerRef}
      className="space-y-4 pb-20 animate-fade-in"
    >
      {/* Navigation header */}
      {onBack && (
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={onBack} className="rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          {trackers && trackers.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateTracker?.("prev")}
                disabled={!canGoPrev}
                className="h-8 w-8 rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {(currentIndex ?? 0) + 1} / {trackers.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateTracker?.("next")}
                disabled={!canGoNext}
                className="h-8 w-8 rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tracker header card */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
            >
              <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            </div>
            {tracker.title}
          </CardTitle>
          <p className="text-xs font-medium" style={{ color: `hsl(var(--${categoryColor}))` }}>
            {tracker.category}
          </p>
        </CardHeader>
      </Card>

      {/* Tab Selector */}
      <div className="flex items-center bg-muted/50 rounded-full p-1">
        <button
          onClick={() => setActiveTab("questions")}
          className={cn(
            "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
            activeTab === "questions"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Questions
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={cn(
            "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
            activeTab === "calendar"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Calendar
        </button>
      </div>

      {/* Tab Content */}
      <div
        onTouchStart={handleTabSwipeStart}
        onTouchEnd={handleTabSwipeEnd}
      >
        {activeTab === "questions" && (
          <div className="space-y-4 animate-fade-in">
            {/* Selected date indicator */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                You are filling in for: <span className="font-medium">{selectedDateDisplay}</span>
              </p>
            </div>

            {/* Question Card with Swipe and Buttons */}
            <QuestionSwipeCard
              tracker={tracker}
              currentAnswer={currentAnswer}
              onAnswer={handleAnswer}
            />

            {/* Swipe hint */}
            <p className="text-xs text-center text-muted-foreground">
              ← Swipe left for No · Swipe right for Yes →
            </p>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-4 animate-fade-in">
            {/* Calendar-only view */}
            <Card className="card-premium">
              <CardContent className="pt-4">
                <MonthlyCalendar
                  trackerId={tracker.id}
                  entries={entries}
                  problemWhen={tracker.problemWhen}
                  selectedDate={effectiveSelectedDate}
                  onDateSelect={onDateSelect}
                  onBulkAnswer={handleBulkAnswer}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {showWarning && (
        <Card className="card-premium border-l-4 border-l-primary animate-fade-in">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Lightbulb className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <CardTitle className="text-lg text-primary mb-2">
                  Reflection Suggested
                </CardTitle>
                <p className="text-sm text-foreground">
                  {tracker.adviceAboveThreshold}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

// Question card with swipe gesture and Yes/No buttons
interface QuestionSwipeCardProps {
  tracker: Tracker;
  currentAnswer: boolean | undefined;
  onAnswer: (value: boolean) => void;
}

const SWIPE_THRESHOLD = 100;

const QuestionSwipeCard = ({ tracker, currentAnswer, onAnswer }: QuestionSwipeCardProps) => {
  // If "yes" is the significant/problematic answer, yes=red and no=green; otherwise inverted
  const yesIsSignificant = tracker.problemWhen === "yes";
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX.current;
    setSwipeX(diff);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isSwiping) return;
    setIsSwiping(false);

    if (swipeX > SWIPE_THRESHOLD) {
      onAnswer(true);
    } else if (swipeX < -SWIPE_THRESHOLD) {
      onAnswer(false);
    }

    setSwipeX(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    setIsSwiping(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      setSwipeX(diff);
    };

    const handleMouseUp = () => {
      setIsSwiping(false);
      
      if (swipeX > SWIPE_THRESHOLD) {
        onAnswer(true);
      } else if (swipeX < -SWIPE_THRESHOLD) {
        onAnswer(false);
      }
      
      setSwipeX(0);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const getSwipeOpacity = () => {
    return Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);
  };

  return (
    <div className="relative">
      {/* Swipe indicators — color follows significance direction */}
      <div
        className={`absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-4 rounded-l-2xl transition-opacity pointer-events-none ${yesIsSignificant ? "bg-balanced/20" : "bg-strong/20"}`}
        style={{ opacity: swipeX < 0 ? getSwipeOpacity() : 0 }}
      >
        <div className={`flex items-center gap-2 font-medium ${yesIsSignificant ? "text-balanced" : "text-strong"}`}>
          <X className="h-6 w-6" />
          <span>No</span>
        </div>
      </div>
      <div
        className={`absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-4 rounded-r-2xl transition-opacity pointer-events-none ${yesIsSignificant ? "bg-strong/20" : "bg-balanced/20"}`}
        style={{ opacity: swipeX > 0 ? getSwipeOpacity() : 0 }}
      >
        <div className={`flex items-center gap-2 font-medium ${yesIsSignificant ? "text-strong" : "text-balanced"}`}>
          <span>Yes</span>
          <Check className="h-6 w-6" />
        </div>
      </div>

      {/* Main card */}
      <Card
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        className={cn(
          "card-premium overflow-hidden cursor-pointer select-none transition-transform duration-200"
        )}
        style={{
          transform: `translateX(${swipeX}px)`,
        }}
      >
        <CardContent className="p-5">
          <p className="text-base leading-relaxed mb-5">
            {tracker.questionText}
          </p>

          {/* Current answer indicator */}
          {currentAnswer !== undefined && (
            <div className="mb-4 flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                  currentAnswer === true
                    ? yesIsSignificant ? "bg-strong/10 text-strong" : "bg-balanced/10 text-balanced"
                    : yesIsSignificant ? "bg-balanced/10 text-balanced" : "bg-strong/10 text-strong"
                )}
              >
                {currentAnswer === true ? (
                  <><Check className="h-3 w-3" />Yes</>
                ) : (
                  <><X className="h-3 w-3" />No</>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Current answer</span>
            </div>
          )}

          {/* Yes/No Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={(e) => { e.stopPropagation(); onAnswer(false); }}
              className={cn(
                "flex-1 rounded-full border transition-all",
                currentAnswer === false
                  ? yesIsSignificant
                    ? "bg-balanced text-balanced-foreground border-balanced hover:bg-balanced/90"
                    : "bg-strong text-strong-foreground border-strong hover:bg-strong/90"
                  : yesIsSignificant
                    ? "border-border hover:bg-balanced/10 hover:text-balanced hover:border-balanced"
                    : "border-border hover:bg-strong/10 hover:text-strong hover:border-strong"
              )}
            >
              <X className="h-5 w-5 mr-2" />
              No
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={(e) => { e.stopPropagation(); onAnswer(true); }}
              className={cn(
                "flex-1 rounded-full border transition-all",
                currentAnswer === true
                  ? yesIsSignificant
                    ? "bg-strong text-strong-foreground border-strong hover:bg-strong/90"
                    : "bg-balanced text-balanced-foreground border-balanced hover:bg-balanced/90"
                  : yesIsSignificant
                    ? "border-border hover:bg-strong/10 hover:text-strong hover:border-strong"
                    : "border-border hover:bg-balanced/10 hover:text-balanced hover:border-balanced"
              )}
            >
              <Check className="h-5 w-5 mr-2" />
              Yes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
