import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  X,
  ChevronRight,
  Check,
  Sparkles,
  Users,
  Briefcase,
  Brain,
  Moon,
  Heart,
  Target,
  Smile,
  Globe2,
  ArrowRight,
  ArrowLeft,
  MessageSquareWarning,
  Flame,
  BedDouble,
  TrendingUp,
  CheckSquare,
  Sliders,
  LayoutGrid,
  Bell,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tracker } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissionDetailed,
  scheduleNotification,
} from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";

const TOUR_SEEN_KEY = "memap_tour_seen";

// --- Content --------------------------------------------------------

type ThemeId =
  | "state"
  | "people"
  | "work"
  | "sleep"
  | "close"
  | "voice"
  | "joy"
  | "env";

interface ThemeDef {
  id: ThemeId;
  icon: typeof Brain;
  title: string;
  subtitle: string;
}

const THEMES: ThemeDef[] = [
  { id: "state", icon: Brain, title: "My state", subtitle: "stress · mood · energy" },
  { id: "people", icon: Users, title: "People around", subtitle: "rudeness · support" },
  { id: "work", icon: Briefcase, title: "Work", subtitle: "pressure · deadlines" },
  { id: "sleep", icon: Moon, title: "Sleep & body", subtitle: "sleep · movement" },
  { id: "close", icon: Heart, title: "Loved ones", subtitle: "partner · family" },
  { id: "voice", icon: Target, title: "Voice & limits", subtitle: "speak up · say no" },
  { id: "joy", icon: Smile, title: "Joy", subtitle: "what recharges you" },
  { id: "env", icon: Globe2, title: "Environment", subtitle: "place · atmosphere" },
];

interface StarterDef {
  id: string;
  title: string;
  question: string;
  category: Tracker["category"];
  problemWhen: "yes" | "no";
}

const STARTERS_BY_THEME: Record<ThemeId, StarterDef[]> = {
  state: [
    { id: "stress", title: "Stress", question: "Did I feel stressed today?", category: "Emotions", problemWhen: "yes" },
    { id: "lonely", title: "Loneliness", question: "Did I feel lonely today?", category: "Emotions", problemWhen: "yes" },
  ],
  people: [
    { id: "rude", title: "Rudeness from others", question: "Was someone rude to me today?", category: "Social", problemWhen: "yes" },
    { id: "toxic", title: "Toxic conversation", question: "Did I have a toxic conversation today?", category: "Social", problemWhen: "yes" },
  ],
  work: [
    { id: "overload", title: "Overload", question: "Did I feel overloaded by work today?", category: "Voice", problemWhen: "yes" },
    { id: "deadlines", title: "Deadline pressure", question: "Did deadlines pressure me today?", category: "Voice", problemWhen: "yes" },
  ],
  sleep: [
    { id: "sleep", title: "Sleep", question: "Did I sleep well last night?", category: "Health", problemWhen: "no" },
    { id: "move", title: "Movement", question: "Did I move my body enough today?", category: "Body", problemWhen: "no" },
  ],
  close: [
    { id: "time-close", title: "Time with loved ones", question: "Did I spend quality time with someone close?", category: "Connections", problemWhen: "no" },
  ],
  voice: [
    { id: "voice", title: "My voice", question: "Did I say what I wanted to say today?", category: "Voice", problemWhen: "no" },
  ],
  joy: [
    { id: "joy", title: "Joy", question: "Was there something today that recharged me?", category: "Fun", problemWhen: "no" },
  ],
  env: [
    { id: "space", title: "My space", question: "Was my space comfortable today?", category: "Curious", problemWhen: "no" },
  ],
};

// Always pre-added as the first starter — referenced by the calendar example
const UNIVERSAL_STARTER: StarterDef = {
  id: "headache",
  title: "Headache",
  question: "Did I have a headache today?",
  category: "Body",
  problemWhen: "yes",
};

const HERO_EXAMPLES = [
  { icon: BedDouble, text: "Did I have a headache today?" },
  { icon: Heart, text: "Did I argue with my partner today?" },
  { icon: MessageSquareWarning, text: "Was someone rude to me today?" },
];

// Fuller pool used on other screens / future rotation
const LIFE_EXAMPLES = [
  "Did I argue with my partner today?",
  "Did I skip a meal today?",
  "Did I scroll in bed before sleep?",
  "Did work drain me today?",
  "Was I overwhelmed today?",
  "Did I spend time with someone I love?",
];

// --- Component ------------------------------------------------------

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

// 8 steps total. Flow:
//   0 Hero  -> 1 Swipe practice -> 2 Calendar+multi-select
//   3 Action Point -> 4 Trend   -> 5 Add Tracker demo
//   6 Theme picker  -> 7 Starter trackers
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOTAL_STEPS = 8;

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const [step, setStep] = useState<Step>(0);
  const [selectedThemes, setSelectedThemes] = useState<Set<ThemeId>>(new Set());
  const [uncheckedStarters, setUncheckedStarters] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedThemes(new Set());
      setUncheckedStarters(new Set());
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    document.body.style.overflow = "";
    onClose();
  }, [onClose]);

  // Skip-setup safety net: user bailed without creating anything via the
  // theme/starter screens. Make sure they still have *something* to
  // explore so Today isn't a dead end:
  //   1) un-dismiss Ideas of the Day so suggestions show up,
  //   2) pre-add the Headache tracker (same one the calendar demo uses).
  const skipSetup = useCallback(async () => {
    try {
      localStorage.setItem("memap_ideas_dismissed", "false");
    } catch {
      // ignore
    }
    try {
      const existing = await getTrackers();
      const alreadyHasHeadache = existing.some(
        (t) => t.title.trim().toLowerCase() === UNIVERSAL_STARTER.title.toLowerCase()
      );
      if (!alreadyHasHeadache) {
        const now = new Date().toISOString();
        const today = new Date().toISOString().split("T")[0];
        const seed: Tracker = {
          id: `${Date.now()}-headache-seed`,
          title: UNIVERSAL_STARTER.title,
          category: UNIVERSAL_STARTER.category,
          questionText: UNIVERSAL_STARTER.question,
          answerType: "boolean",
          periodDays: 30,
          threshold: 10,
          problemWhen: UNIVERSAL_STARTER.problemWhen,
          adviceAboveThreshold: "",
          createdAt: now,
          sortIndex: existing.length,
          cycleStartDate: today,
        };
        await saveTrackers([...existing, seed]);
      }
    } catch {
      // ignore — finish anyway
    }
    finish();
  }, [finish]);

  const toggleTheme = (id: ThemeId) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStarter = (id: string) => {
    setUncheckedStarters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const themeStarters = Array.from(selectedThemes).flatMap(
    (t) => STARTERS_BY_THEME[t]
  );
  // Headache is always first so the calendar example on step 2 has context
  const suggestedStarters: StarterDef[] = [UNIVERSAL_STARTER, ...themeStarters];

  const selectedStarters = suggestedStarters.filter(
    (s) => !uncheckedStarters.has(s.id)
  );

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const existing = await getTrackers();
      const now = new Date().toISOString();
      const today = new Date().toISOString().split("T")[0];
      const baseSort = existing.length;

      const newTrackers: Tracker[] = selectedStarters.map((s, i) => ({
        id: `${Date.now()}-${s.id}-${i}`,
        title: s.title,
        category: s.category,
        questionText: s.question,
        answerType: "boolean",
        periodDays: 30,
        threshold: 10,
        problemWhen: s.problemWhen,
        adviceAboveThreshold: "",
        createdAt: now,
        sortIndex: baseSort + i,
        cycleStartDate: today,
      }));

      await saveTrackers([...existing, ...newTrackers]);
      finish();
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />

      {/* Progress */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-safe">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i).map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-500",
                  i === step
                    ? "w-6 bg-primary"
                    : i < step
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={finish}
            style={{ touchAction: "manipulation" }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 -mr-2"
          >
            Skip all
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content — min-h trick lets short screens center vertically while
          tall ones grow naturally and stay scrollable from the top. */}
      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-5 py-16">
        {step === 0 && <HeroScreen onNext={() => setStep(1)} onSkipStep={() => setStep(1)} />}
        {step === 1 && <SwipeScreen onDone={() => setStep(2)} onBack={() => setStep(0)} onSkipStep={() => setStep(2)} />}
        {step === 2 && <CalendarScreen onNext={() => setStep(3)} onBack={() => setStep(1)} onSkipStep={() => setStep(3)} />}
        {step === 3 && <ActionPointScreen onNext={() => setStep(4)} onBack={() => setStep(2)} onSkipStep={() => setStep(4)} />}
        {step === 4 && <PatternScreen onNext={() => setStep(5)} onBack={() => setStep(3)} onSkipStep={() => setStep(5)} />}
        {step === 5 && <AddTrackerScreen onNext={() => setStep(6)} onBack={() => setStep(4)} onSkipStep={() => setStep(6)} />}
        {step === 6 && (
          <ThemePickerScreen
            selected={selectedThemes}
            onToggle={toggleTheme}
            onBack={() => setStep(5)}
            onNext={() => setStep(7)}
            onSkipSetup={skipSetup}
          />
        )}
        {step === 7 && (
          <StarterScreen
            starters={suggestedStarters}
            unchecked={uncheckedStarters}
            onToggle={toggleStarter}
            selectedCount={selectedStarters.length}
            onBack={() => setStep(6)}
            onStart={handleCreate}
            creating={creating}
            onSkipSetup={skipSetup}
          />
        )}
        </div>
      </div>
    </div>
  );
};

// --- Skip-this-step button ------------------------------------------

const SkipStepButton = ({ onSkip }: { onSkip: () => void }) => (
  <button
    type="button"
    onClick={onSkip}
    data-onb-interactive
    style={{ touchAction: "manipulation" }}
    className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors py-1.5 px-2"
  >
    Skip this
    <ChevronRight className="h-3 w-3" />
  </button>
);

// Small standalone Back button used on interior screens that don't have a
// Back/Next row of their own.
const BackStepButton = ({ onBack }: { onBack: () => void }) => (
  <button
    type="button"
    onClick={onBack}
    data-onb-interactive
    style={{ touchAction: "manipulation" }}
    className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors py-1.5 px-2"
  >
    <ArrowLeft className="h-3 w-3" />
    Back
  </button>
);

// --- Screen 1: Hero -------------------------------------------------

const HeroScreen = ({ onNext, onSkipStep }: { onNext: () => void; onSkipStep: () => void }) => {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center animate-fade-in">
      <div className="relative w-full h-[240px] mb-8">
        {HERO_EXAMPLES.map((ex, i) => {
          const Icon = ex.icon;
          return (
            <div
              key={i}
              className="absolute left-1/2 w-[85%] card-premium px-4 py-3.5 flex items-center gap-3"
              style={{
                top: `${i * 56}px`,
                transform: `translateX(calc(-50% + ${(i - 1) * 10}px)) rotate(${(i - 1) * 2}deg)`,
                opacity: 0,
                animation: `heroFadeIn 0.6s ease-out ${0.15 + i * 0.25}s forwards`,
                zIndex: HERO_EXAMPLES.length - i,
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-medium text-left leading-snug">{ex.text}</span>
            </div>
          );
        })}
      </div>

      <h1 className="font-serif text-3xl font-medium mb-3 tracking-tight">
        You're not just <span className="italic">you</span>
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px] mb-8">
        MeMap tracks what shapes you — inside and around you
      </p>

      <Button
        size="lg"
        onClick={onNext}
        data-onb-interactive
        className="rounded-full px-8 shadow-lg shadow-primary/20"
      >
        Try it
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>

      <SkipStepButton onSkip={onSkipStep} />

      <style>{`
        @keyframes heroFadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
};

// --- Screen 2: Swipe / tap practice ---------------------------------

interface PracticeCard {
  question: string;
  expected: "yes" | "no";
  hint: string;
}

// Two practice cards — headache + argument with partner. The "swipes
// break on card 2" bug is prevented by key={cardIdx} (full remount)
// and deferred pointer capture.
const PRACTICE_CARDS: PracticeCard[] = [
  {
    question: "Did I feel happy today?",
    expected: "yes",
    hint: "Swipe right — or tap Yes",
  },
  {
    question: "Did I argue with my partner today?",
    expected: "yes",
    hint: "Swipe right — or tap Yes",
  },
];

const SWIPE_THRESHOLD = 80;

const SwipeScreen = ({ onDone, onBack, onSkipStep }: { onDone: () => void; onBack: () => void; onSkipStep: () => void }) => {
  const [cardIdx, setCardIdx] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState<"yes" | "no" | null>(null);
  const startX = useRef<number | null>(null);
  const currentDx = useRef(0);
  const advancingRef = useRef(false);
  // Deferred-capture: only grab the pointer once the user clearly intends
  // to drag (>8px of movement). Capturing immediately on pointerdown made
  // iOS swallow subsequent taps on the next card.
  const hasCaptured = useRef(false);
  const CAPTURE_THRESHOLD = 8;

  const card = PRACTICE_CARDS[cardIdx];
  const isLast = cardIdx === PRACTICE_CARDS.length - 1;

  const handleAnswer = useCallback(
    (answer: "yes" | "no") => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      setSuccess(answer);
      if (navigator.vibrate) navigator.vibrate(30);
      window.setTimeout(() => {
        if (isLast) {
          onDone();
          return;
        }
        setCardIdx((i) => i + 1);
        setSwipeX(0);
        setSuccess(null);
        startX.current = null;
        currentDx.current = 0;
        hasCaptured.current = false;
        advancingRef.current = false;
      }, 140);
    },
    [isLast, onDone]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (advancingRef.current) return;
    startX.current = e.clientX;
    currentDx.current = 0;
    hasCaptured.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null || advancingRef.current) return;
    const dx = e.clientX - startX.current;
    currentDx.current = dx;
    // Only claim the pointer once the gesture is clearly a drag. Before
    // that, let the browser deliver taps normally.
    if (!hasCaptured.current && Math.abs(dx) > CAPTURE_THRESHOLD) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      hasCaptured.current = true;
    }
    if (hasCaptured.current) {
      setSwipeX(dx);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    if (hasCaptured.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    const dx = currentDx.current;
    const wasCaptured = hasCaptured.current;
    startX.current = null;
    currentDx.current = 0;
    hasCaptured.current = false;
    setDragging(false);
    if (advancingRef.current) return;
    // Only treat it as a swipe if we ever committed to a drag. Otherwise
    // it was a tap that should do nothing (Yes/No buttons handle taps).
    if (wasCaptured && dx > SWIPE_THRESHOLD) {
      handleAnswer("yes");
    } else if (wasCaptured && dx < -SWIPE_THRESHOLD) {
      handleAnswer("no");
    } else {
      setSwipeX(0);
    }
  };

  const displayX = success === "yes" ? 320 : success === "no" ? -320 : swipeX;
  const rightColor = success === "yes";
  const leftColor = success === "no";

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        Answer in one tap
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-10 max-w-[300px]">
        Yes, No, or swipe. One gesture — the day is logged.
      </p>

      <div className="relative w-full h-[280px] flex items-center justify-center overflow-hidden">
        {/* Left indicator */}
        <div
          className="absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-4 rounded-l-2xl bg-strong/20 transition-opacity pointer-events-none"
          style={{
            opacity: leftColor
              ? 1
              : displayX < 0
              ? Math.min(Math.abs(displayX) / SWIPE_THRESHOLD, 1)
              : 0,
          }}
        >
          <div className="flex items-center gap-1.5 text-strong font-medium text-sm">
            <X className="h-5 w-5" /> No
          </div>
        </div>
        {/* Right indicator */}
        <div
          className="absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-4 rounded-r-2xl bg-balanced/20 transition-opacity pointer-events-none"
          style={{
            opacity: rightColor
              ? 1
              : displayX > 0
              ? Math.min(displayX / SWIPE_THRESHOLD, 1)
              : 0,
          }}
        >
          <div className="flex items-center gap-1.5 text-balanced font-medium text-sm">
            Yes <Check className="h-5 w-5" />
          </div>
        </div>

        <Card
          // Remount fully between cards so no pointer state, capture,
          // or listener carries over from the previous question.
          key={cardIdx}
          data-onb-interactive
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "card-premium w-[92%] min-h-[240px] px-6 py-10 flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing",
            success && "ring-2",
            success === "yes" && "ring-balanced",
            success === "no" && "ring-strong"
          )}
          style={{
            transform: `translateX(${displayX}px) rotate(${displayX * 0.03}deg)`,
            transition: dragging ? "none" : "transform 0.35s ease-out, opacity 0.35s ease-out",
            opacity: success ? 0 : 1,
            touchAction: "pan-y",
          }}
        >
          <p className="text-xl font-medium text-center leading-snug">
            {card.question}
          </p>
        </Card>
      </div>

      {/* Yes / No buttons */}
      <div className="flex items-center gap-3 w-full max-w-[320px] mt-8">
        <Button
          variant="outline"
          size="lg"
          onPointerUp={() => handleAnswer("no")}
          onClick={() => handleAnswer("no")}
          disabled={!!success}
          data-onb-interactive
          style={{ touchAction: "manipulation" }}
          className={cn(
            "flex-1 rounded-full border-border/70",
            success === "no" && "bg-strong/15 border-strong/60 text-strong-foreground"
          )}
        >
          <X className="h-4 w-4 mr-1.5" />
          No
        </Button>
        <Button
          variant="outline"
          size="lg"
          onPointerUp={() => handleAnswer("yes")}
          onClick={() => handleAnswer("yes")}
          disabled={!!success}
          data-onb-interactive
          style={{ touchAction: "manipulation" }}
          className={cn(
            "flex-1 rounded-full border-border/70",
            success === "yes" && "bg-balanced/15 border-balanced/60 text-balanced-foreground"
          )}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Yes
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6 h-4">
        {success ? "Saved. Nice." : card.hint}
      </p>

      {PRACTICE_CARDS.length > 1 && (
        <div className="mt-2 text-[10px] text-muted-foreground/70">
          {cardIdx + 1} / {PRACTICE_CARDS.length}
        </div>
      )}

      <SkipStepButton onSkip={onSkipStep} />
      <BackStepButton onBack={onBack} />
    </div>
  );
};

// --- Screen 3: Calendar preview -------------------------------------

interface CalendarExample {
  title: string;
  sigLabel: string;
  caption: string;
  significantDays: number[];
}

const CALENDAR_EXAMPLES: CalendarExample[] = [
  {
    title: "Headache · April",
    sigLabel: "Headache days",
    caption: "Show your doctor exactly how often it hit",
    significantDays: [3, 7, 8, 14, 19, 22],
  },
  {
    title: "Drinks · April",
    sigLabel: "Drinking days",
    caption: "See honestly how often you actually drink",
    significantDays: [2, 5, 6, 12, 13, 18, 19, 20],
  },
  {
    title: "Argument with partner · April",
    sigLabel: "Argument days",
    caption: "Notice the rhythm — are fights stacking up?",
    significantDays: [4, 9, 11, 15, 17, 21, 23],
  },
];

const CalendarScreen = ({ onNext, onBack, onSkipStep }: { onNext: () => void; onBack: () => void; onSkipStep: () => void }) => {
  // Simulated April 2026: 30 days, starts Wed (offset=2)
  const firstOffset = 2;
  const daysInMonth = 30;
  const todayDay = 24;

  // Auto-rotate through 3 calendar examples so the user sees the tool
  // works for many life situations, not just one.
  const [exampleIdx, setExampleIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setExampleIdx((i) => (i + 1) % CALENDAR_EXAMPLES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);
  const example = CALENDAR_EXAMPLES[exampleIdx];
  const significantSet = new Set(example.significantDays);
  const tracked = 24;
  const significant = example.significantDays.length;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        See the full picture
      </h2>
      <p
        key={example.caption}
        className="text-sm text-muted-foreground text-center mb-6 max-w-[340px] mx-auto leading-relaxed min-h-[40px] animate-fade-in"
      >
        {example.caption}
      </p>

      <Card className="card-premium p-5 mb-4 relative">
        <div className="flex items-center justify-between mb-4 gap-2">
          <span
            key={example.title}
            className="text-xs font-medium tracking-wide uppercase text-muted-foreground truncate animate-fade-in"
          >
            {example.title}
          </span>
          {/* Multi-select coach-mark — pulsing ring draws the eye */}
          <div className="relative shrink-0">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
              <CheckSquare className="h-3 w-3" />
              Select multiple
            </div>
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: "2px solid hsl(var(--primary))",
                opacity: 0.45,
                animation: "calPing 2.2s ease-out 0.4s infinite",
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="text-center py-2.5 rounded-xl bg-muted/40">
            <div className="font-serif text-2xl font-medium leading-none">{tracked}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
              Days tracked
            </div>
          </div>
          <div className="text-center py-2.5 rounded-xl bg-strong/10">
            <div key={significant} className="font-serif text-2xl font-medium leading-none text-strong animate-fade-in">
              {significant}
            </div>
            <div
              key={example.sigLabel}
              className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 animate-fade-in"
            >
              {example.sigLabel}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[10px] text-muted-foreground text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstOffset }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const sig = significantSet.has(d);
            const future = d > todayDay;
            const isToday = d === todayDay;
            return (
              <div key={d} className="aspect-square flex items-center justify-center">
                <div
                  className={cn(
                    "w-[82%] h-[82%] rounded-full flex items-center justify-center text-[10px] font-medium transition-all",
                    future && "border border-dashed border-muted-foreground/25 text-muted-foreground/40",
                    !future && sig && "bg-strong/70 text-strong-foreground",
                    !future && !sig && "bg-balanced/70 text-balanced-foreground",
                    isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  )}
                >
                  {d}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-strong/70" />
            <span>Significant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-balanced/70" />
            <span>Balanced</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-3">
        <CheckSquare className="h-3.5 w-3.5" />
        <span>
          Tap <span className="font-medium text-foreground">Select multiple</span> to fill past days you forgot
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-3">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>
          Find this in the <span className="font-medium text-foreground">Patterns</span> tab
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-6 text-center">
        <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>
          Tap any day to <span className="font-medium text-foreground">add a note</span> — "felt dizzy", "late night", anything.
        </span>
      </div>

      <div className="flex flex-col items-center">
        <Button
          size="lg"
          onClick={onNext}
          data-onb-interactive
          className="rounded-full px-8 shadow-lg shadow-primary/20"
        >
          Next
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
        <SkipStepButton onSkip={onSkipStep} />
        <BackStepButton onBack={onBack} />
      </div>

      <style>{`
        @keyframes calPing {
          0%   { transform: scale(1);    opacity: 0.5; }
          70%  { transform: scale(1.25); opacity: 0;   }
          100% { transform: scale(1.25); opacity: 0;   }
        }
      `}</style>
    </div>
  );
};

// --- Screen 4: Pattern preview --------------------------------------

const PatternScreen = ({ onNext, onBack, onSkipStep }: { onNext: () => void; onBack: () => void; onSkipStep: () => void }) => {
  const seriesA = [5, 6, 7, 7, 4, 4, 7]; // Deadline pressure days/week
  const seriesB = [4, 5, 6, 6, 3, 4, 6]; // Poor sleep days/week
  const max = 7;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 22;
  const W = 300;
  const H = 160;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const step = plotW / (seriesA.length - 1);
  const xAt = (i: number) => PAD_L + i * step;
  const yAt = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const pathA = seriesA.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`).join(" ");
  const pathB = seriesB.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`).join(" ");
  const xLabels = ["Mar 27", "", "Apr 3", "", "Apr 10", "", "Apr 17"];
  const yTicks = [0, 4, 7];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        MeMap finds the links
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-[320px]">
        In a week you'll see what shapes what — no guessing
      </p>

      <Card className="card-premium w-full p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Trend & Correlation
          </span>
          <span className="text-[10px] text-muted-foreground">30d</span>
        </div>

        {/* Chip legend like TrendChart */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <div
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              backgroundColor: "#fb923c18",
              color: "#fb923c",
              border: "1px solid #fb923c44",
            }}
          >
            <span className="flex items-center gap-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fb923c]" />
              <span className="w-2 h-[1.5px] bg-[#fb923c]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#fb923c]" />
            </span>
            <span>Deadline pressure</span>
          </div>
          <div
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              backgroundColor: "#60a5fa18",
              color: "#60a5fa",
              border: "1px solid #60a5fa44",
            }}
          >
            <span className="flex items-center gap-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" />
              <span className="w-2 h-[1.5px] bg-[#60a5fa]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" />
            </span>
            <span>Poor sleep</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="onbLineA" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="onbLineB" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>

          {/* Y gridlines + labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="#94a3b8"
                strokeOpacity="0.18"
                strokeDasharray="3 3"
              />
              <text
                x={PAD_L - 6}
                y={yAt(t) + 3}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
              >
                {t}d
              </text>
            </g>
          ))}

          {/* X labels */}
          {xLabels.map((label, i) =>
            label ? (
              <text
                key={i}
                x={xAt(i)}
                y={H - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {label}
              </text>
            ) : null
          )}

          {/* Lines */}
          <path
            d={pathA}
            fill="none"
            stroke="url(#onbLineA)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: "drawLine 1.3s ease-out 0.2s forwards",
            }}
          />
          <path
            d={pathB}
            fill="none"
            stroke="url(#onbLineB)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: "drawLine 1.3s ease-out 0.5s forwards",
            }}
          />

          {/* Dots on each point */}
          {seriesA.map((v, i) => (
            <circle
              key={`a-${i}`}
              cx={xAt(i)}
              cy={yAt(v)}
              r="3"
              fill="#fb923c"
              style={{
                opacity: 0,
                animation: `patternFadeIn 0.25s ease ${1.3 + i * 0.06}s forwards`,
              }}
            />
          ))}
          {seriesB.map((v, i) => (
            <circle
              key={`b-${i}`}
              cx={xAt(i)}
              cy={yAt(v)}
              r="3"
              fill="#60a5fa"
              style={{
                opacity: 0,
                animation: `patternFadeIn 0.25s ease ${1.6 + i * 0.06}s forwards`,
              }}
            />
          ))}
        </svg>
      </Card>

      {/* Insight card */}
      <div
        className="card-premium w-full px-4 py-3 mb-4 flex items-start gap-2.5"
        style={{ opacity: 0, animation: "patternFadeIn 0.5s ease 2.2s forwards" }}
      >
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs leading-relaxed pt-0.5">
          <span className="font-medium text-foreground">Pattern detected. </span>
          <span className="text-muted-foreground">
            When deadlines pressured you, your sleep got worse.
          </span>
        </p>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-6">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>
          Find this in the <span className="font-medium text-foreground">Patterns</span> tab
        </span>
      </div>

      <div className="flex flex-col items-center">
        <Button
          size="lg"
          onClick={onNext}
          data-onb-interactive
          className="rounded-full px-8 shadow-lg shadow-primary/20"
        >
          Got it
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
        <SkipStepButton onSkip={onSkipStep} />
        <BackStepButton onBack={onBack} />
      </div>

      <style>{`
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes patternFadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
};

// --- Screen 3: Action Point (reflection trigger) --------------------

const ACTION_POINT_EXAMPLES = [
  {
    tracker: "Headache",
    icon: BedDouble,
    summary: "Headache hit you 4 times this week",
    action: "Consider getting checked by a doctor",
    highlight: "4 times this week",
  },
  {
    tracker: "Argument with partner",
    icon: Heart,
    summary: "5 arguments with your partner in 2 weeks",
    action: "Maybe talk to a couples therapist?",
    highlight: "5 arguments in 2 weeks",
  },
  {
    tracker: "Drinks",
    icon: Flame,
    summary: "You drank 6 days this week",
    action: "Think about your lifestyle choices",
    highlight: "6 days this week",
  },
];

const ActionPointScreen = ({ onNext, onBack, onSkipStep }: { onNext: () => void; onBack: () => void; onSkipStep: () => void }) => {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        Action points
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-5 max-w-[340px]">
        When a tracker crosses your threshold, MeMap creates an{" "}
        <span className="font-medium text-foreground">Action Point</span> —
        a reflection prompt with a concrete next step.
      </p>

      {/* Example Action Point cards — real-looking stack */}
      <div className="w-full space-y-3 mb-5">
        {ACTION_POINT_EXAMPLES.map((ex, i) => {
          const Icon = ex.icon;
          const isFirst = i === 0;
          return (
            <div key={ex.tracker} className="relative">
              <Card
                className="card-premium p-4 border-l-4"
                style={{
                  borderLeftColor: "hsl(var(--strong))",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "hsl(var(--strong) / 0.12)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "hsl(var(--strong))" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Action point · {ex.tracker}
                    </div>
                    <p className="text-xs leading-snug mb-2">
                      <span className="font-medium">{ex.summary.replace(ex.highlight, "")}</span>
                      <span className="text-strong font-medium">{ex.highlight}</span>
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-medium">
                        <Sparkles className="h-3 w-3" />
                        {ex.action}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              {isFirst && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    border: "2px solid hsl(var(--strong))",
                    opacity: 0.3,
                    animation: "circlePing 2.6s ease-out 0.5s infinite",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-muted-foreground text-center mb-5">
        Find them on <span className="font-medium text-foreground">Today</span> and in the <span className="font-medium text-foreground">Patterns</span> tab.
      </div>

      {/* Notifications hint card */}
      <Card className="card-premium w-full p-4 mb-6 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium mb-1">Turn on notifications</div>
          <p className="text-xs text-muted-foreground leading-snug">
            Get a daily reminder to answer your questions, and an instant alert when an Action Point appears. You can enable this in <span className="font-medium text-foreground">Settings</span> (or at the end of this tour).
          </p>
        </div>
      </Card>

      <Button
        size="lg"
        onClick={onNext}
        data-onb-interactive
        className="rounded-full px-8 shadow-lg shadow-primary/20"
      >
        Got it
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
      <SkipStepButton onSkip={onSkipStep} />
      <BackStepButton onBack={onBack} />

      <style>{`
        @keyframes circlePing {
          0%   { transform: scale(1);    opacity: 0.5; }
          70%  { transform: scale(1.35); opacity: 0;   }
          100% { transform: scale(1.35); opacity: 0;   }
        }
      `}</style>
    </div>
  );
};

// --- Screen 5: Add Tracker demo (template vs custom) ----------------

const AddTrackerScreen = ({ onNext, onBack, onSkipStep }: { onNext: () => void; onBack: () => void; onSkipStep: () => void }) => {
  const sampleTemplates = [
    { title: "Headache", question: "Did I have a headache today?", category: "Body" },
    { title: "Argument with partner", question: "Did I argue with my partner today?", category: "Connections" },
  ];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-1.5">
        Add anything. Anytime.
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-4 max-w-[320px] mx-auto">
        Tap <span className="font-medium text-foreground">+</span> — pick a template or write your own.
      </p>

      {/* Mock "Add Tracker" sheet */}
      <div className="relative card-premium p-3.5 mb-4">
        {/* Pulsing "+" icon */}
        <div className="absolute -top-4 right-5">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: "2px solid hsl(var(--primary))",
                opacity: 0.4,
                animation: "circlePing 2.2s ease-out 0.3s infinite",
              }}
            />
          </div>
        </div>

        {/* Tabs mock */}
        <div className="flex rounded-lg bg-muted/40 p-1 mb-3 text-xs font-medium mt-1">
          <div className="flex-1 text-center py-1.5 rounded-md bg-background shadow-sm">
            <LayoutGrid className="h-3 w-3 inline mr-1" />
            Template
          </div>
          <div className="flex-1 text-center py-1.5 text-muted-foreground">
            <Sliders className="h-3 w-3 inline mr-1" />
            Custom
          </div>
        </div>

        <div className="space-y-1.5 mb-2">
          {sampleTemplates.map((t, i) => (
            <div
              key={t.title}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/50 bg-card"
              // No fade-in animation here — keyframe lives only on
              // PatternScreen and this card would stay invisible otherwise.
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="text-xs font-medium truncate">{t.title}</div>
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 shrink-0">{t.category}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{t.question}</div>
              </div>
              <div className="shrink-0 h-6 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-muted-foreground text-center pt-1">
          …or switch to <span className="font-medium text-foreground">Custom</span> for your own question, period & threshold.
        </div>
      </div>

      {/* Compact Custom-tab preview — shows the user that period, threshold
          and "what counts as concerning" are all tweakable. Uses tiny rows
          so the whole page still fits without scrolling. */}
      <div className="card-premium p-3 mb-4">
        <div className="flex rounded-lg bg-muted/40 p-1 mb-2.5 text-[11px] font-medium">
          <div className="flex-1 text-center py-1 text-muted-foreground">
            <LayoutGrid className="h-3 w-3 inline mr-1" />
            Template
          </div>
          <div className="flex-1 text-center py-1 rounded-md bg-background shadow-sm">
            <Sliders className="h-3 w-3 inline mr-1" />
            Custom
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">Question</span>
            <span className="flex-1 truncate text-foreground">Did I feel energetic today?</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">Period</span>
            <span className="px-2 py-0.5 rounded bg-muted/50 text-foreground font-medium">30 days</span>
            <span className="text-[10px] text-muted-foreground/70">how far we look back</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">Threshold</span>
            <span className="px-2 py-0.5 rounded bg-muted/50 text-foreground font-medium">10 days</span>
            <span className="text-[10px] text-muted-foreground/70">action point trigger</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">Concerning</span>
            <span className="px-2 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground">Yes</span>
            <span className="px-2 py-0.5 rounded bg-strong/15 text-strong border border-strong/40 font-medium">No</span>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground mt-2 leading-snug">
          You decide what counts as a <span className="text-foreground font-medium">concerning</span> answer — e.g. "No" to <em>Did I feel energetic</em>.
        </div>
      </div>

      <div className="flex flex-col items-center">
        <Button
          size="lg"
          onClick={onNext}
          data-onb-interactive
          className="rounded-full px-8 shadow-lg shadow-primary/20"
        >
          Let's set it up
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
        <SkipStepButton onSkip={onSkipStep} />
        <BackStepButton onBack={onBack} />
      </div>

      <style>{`
        @keyframes circlePing {
          0%   { transform: scale(1);    opacity: 0.5; }
          70%  { transform: scale(1.35); opacity: 0;   }
          100% { transform: scale(1.35); opacity: 0;   }
        }
      `}</style>
    </div>
  );
};

// --- Screen 6: Theme picker -----------------------------------------

const ThemePickerScreen = ({
  selected,
  onToggle,
  onBack,
  onNext,
  onSkipSetup,
}: {
  selected: Set<ThemeId>;
  onToggle: (id: ThemeId) => void;
  onBack: () => void;
  onNext: () => void;
  onSkipSetup: () => void;
}) => {
  const canContinue = selected.size >= 1;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        What's in focus right now?
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-[320px] mx-auto">
        Pick any that feel relevant — we'll shape a starter
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {THEMES.map((t) => {
          const isSelected = selected.has(t.id);
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onToggle(t.id)}
              className={cn(
                "relative rounded-2xl p-3.5 text-left transition-all duration-200 border",
                isSelected
                  ? "bg-primary/10 border-primary/40 shadow-sm"
                  : "bg-card border-border/50 hover:border-border"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors",
                  isSelected ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="text-sm font-medium leading-tight">{t.title}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                {t.subtitle}
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center">
        <Button
          onClick={onNext}
          disabled={!canContinue}
          size="lg"
          data-onb-interactive
          className="rounded-full px-8 shadow-lg shadow-primary/20 disabled:shadow-none"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>

        {/* Skip setup: bails out without building a starter kit. Safety net
            kicks in (headache seed + Ideas of the Day). */}
        <button
          type="button"
          onClick={onSkipSetup}
          data-onb-interactive
          style={{ touchAction: "manipulation" }}
          className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors py-1.5 px-2"
        >
          Skip — set it up later
          <ChevronRight className="h-3 w-3" />
        </button>
        <BackStepButton onBack={onBack} />
      </div>
    </div>
  );
};

// --- Screen 5: Starter trackers -------------------------------------

const StarterScreen = ({
  starters,
  unchecked,
  onToggle,
  selectedCount,
  onBack,
  onStart,
  creating,
  onSkipSetup,
}: {
  starters: StarterDef[];
  unchecked: Set<string>;
  onToggle: (id: string) => void;
  selectedCount: number;
  onBack: () => void;
  onStart: () => void;
  creating: boolean;
  onSkipSetup: () => void;
}) => {
  // Mirror the exact logic from SettingsModal so the two stay in sync.
  // Initial state is read from localStorage so if the user already enabled
  // notifications in Settings, this toggle starts "on".
  const { toast } = useToast();
  const [notifOn, setNotifOn] = useState<boolean>(() => {
    try {
      return getNotificationSettings().enabled;
    } catch {
      return false;
    }
  });
  const [notifRequesting, setNotifRequesting] = useState(false);

  const handleToggleNotif = async () => {
    if (notifRequesting || creating) return;

    if (notifOn) {
      // Turn off
      const current = getNotificationSettings();
      const next = { ...current, enabled: false };
      saveNotificationSettings(next);
      setNotifOn(false);
      try { await scheduleNotification(next); } catch { /* ignore */ }
      return;
    }

    // Turn on — ask for permission first (must happen inside user gesture)
    setNotifRequesting(true);
    try {
      const result = await requestNotificationPermissionDetailed();
      if (!result.granted) {
        const messages: Record<string, { title: string; description: string }> = {
          "insecure-origin": {
            title: "Use the installed app for notifications",
            description: "Browsers block notifications on plain HTTP. Open MeMap from the installed app or via HTTPS.",
          },
          unsupported: {
            title: "Browser can't do notifications",
            description: "Open MeMap in the installed app to get reminders.",
          },
          denied: {
            title: "Permission denied",
            description: "Enable notifications for MeMap in your device settings.",
          },
          unknown: {
            title: "Couldn't enable notifications",
            description: "Something went wrong. Try again.",
          },
        };
        const msg = messages[result.reason ?? "unknown"] ?? messages.unknown;
        toast({ ...msg, variant: "destructive" });
        return;
      }
      const current = getNotificationSettings();
      const next = { ...current, enabled: true };
      saveNotificationSettings(next);
      setNotifOn(true);
      try { await scheduleNotification(next); } catch { /* ignore */ }
      toast({
        title: "Notifications on",
        description: `Daily reminder at ${next.time}.`,
      });
    } finally {
      setNotifRequesting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        Your starter
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-[320px] mx-auto">
        Headache is pre-added so you can see it on your calendar right away. Tweak the rest.
      </p>

      <div className="space-y-2 mb-6">
        {starters.map((s) => {
          const isOn = !unchecked.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={cn(
                "w-full text-left rounded-2xl p-3.5 flex items-start gap-3 transition-all border",
                isOn
                  ? "bg-card border-primary/30"
                  : "bg-muted/30 border-transparent opacity-50"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all",
                  isOn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted border border-border"
                )}
              >
                {isOn && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {s.question}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Notification permission card */}
      <button
        type="button"
        onClick={handleToggleNotif}
        disabled={notifRequesting || creating}
        data-onb-interactive
        style={{ touchAction: "manipulation" }}
        className={cn(
          "w-full text-left rounded-2xl p-3.5 mb-5 flex items-start gap-3 transition-all border",
          notifOn
            ? "bg-primary/5 border-primary/40"
            : "bg-card border-border hover:bg-muted/40"
        )}
      >
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
            notifOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            Allow notifications
            {notifOn && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                On
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Daily session reminders and Action Point alerts so you never miss a check-in.
          </div>
        </div>
        <div
          className={cn(
            "w-10 h-6 rounded-full relative shrink-0 transition-colors mt-1",
            notifOn ? "bg-primary" : "bg-muted border border-border"
          )}
        >
          <div
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all",
              notifOn ? "left-[18px]" : "left-0.5"
            )}
          />
        </div>
      </button>

      <div className="flex flex-col items-center">
        <Button
          onClick={onStart}
          disabled={selectedCount === 0 || creating}
          size="lg"
          data-onb-interactive
          className="rounded-full px-8 shadow-lg shadow-primary/20 disabled:shadow-none"
        >
          {creating ? "Creating..." : `Start (${selectedCount})`}
          {!creating && <ArrowRight className="h-4 w-4 ml-1.5" />}
        </Button>

        <button
          type="button"
          onClick={onSkipSetup}
          disabled={creating}
          data-onb-interactive
          style={{ touchAction: "manipulation" }}
          className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors py-1.5 px-2 disabled:opacity-40"
        >
          Skip — set it up later
          <ChevronRight className="h-3 w-3" />
        </button>
        <BackStepButton onBack={onBack} />
      </div>
    </div>
  );
};

// --- Exports --------------------------------------------------------

export const shouldShowTour = (): boolean => {
  return localStorage.getItem(TOUR_SEEN_KEY) !== "true";
};

export const resetTourSeen = () => {
  localStorage.removeItem(TOUR_SEEN_KEY);
};
