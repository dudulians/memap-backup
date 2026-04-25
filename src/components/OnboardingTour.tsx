import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  X,
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
  Languages,
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
import {
  hasExplicitLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  EXPLICIT_LANGUAGE_KEY,
} from "@/lib/i18n";

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

// Built from translations inside components that need labels. Static icon
// map keeps the list declarative without hardcoding English strings.
const THEME_META: { id: ThemeId; icon: typeof Brain }[] = [
  { id: "state", icon: Brain },
  { id: "people", icon: Users },
  { id: "work", icon: Briefcase },
  { id: "sleep", icon: Moon },
  { id: "close", icon: Heart },
  { id: "voice", icon: Target },
  { id: "joy", icon: Smile },
  { id: "env", icon: Globe2 },
];

const useThemes = (): ThemeDef[] => {
  const { t } = useTranslation();
  return THEME_META.map((m) => ({
    id: m.id,
    icon: m.icon,
    title: t(`onboarding.themes.${m.id}.title`),
    subtitle: t(`onboarding.themes.${m.id}.subtitle`),
  }));
};

interface StarterDef {
  id: string;
  title: string;
  question: string;
  category: Tracker["category"];
  problemWhen: "yes" | "no";
}

// Static catalogue. Titles/questions come from i18n at render/creation
// time via buildStarter() so trackers are saved in the user's current
// language. problemWhen / category stay static because they're logic, not copy.
interface StarterMeta {
  id: string;
  titleKey: string;      // i18n key under onboarding.starters
  questionKey: string;   // i18n key under onboarding.starters
  category: Tracker["category"];
  problemWhen: "yes" | "no";
}

const STARTER_META_BY_THEME: Record<ThemeId, StarterMeta[]> = {
  state: [
    { id: "stress", titleKey: "stressTitle", questionKey: "stressQ", category: "Emotions", problemWhen: "yes" },
    { id: "lonely", titleKey: "lonelyTitle", questionKey: "lonelyQ", category: "Emotions", problemWhen: "yes" },
  ],
  people: [
    { id: "rude", titleKey: "rudeTitle", questionKey: "rudeQ", category: "Social", problemWhen: "yes" },
    { id: "toxic", titleKey: "toxicTitle", questionKey: "toxicQ", category: "Social", problemWhen: "yes" },
  ],
  work: [
    { id: "overload", titleKey: "overloadTitle", questionKey: "overloadQ", category: "Voice", problemWhen: "yes" },
    { id: "deadlines", titleKey: "deadlinesTitle", questionKey: "deadlinesQ", category: "Voice", problemWhen: "yes" },
  ],
  sleep: [
    { id: "sleep", titleKey: "sleepTitle", questionKey: "sleepQ", category: "Health", problemWhen: "no" },
    { id: "move", titleKey: "moveTitle", questionKey: "moveQ", category: "Body", problemWhen: "no" },
  ],
  close: [
    { id: "time-close", titleKey: "closeTitle", questionKey: "closeQ", category: "Connections", problemWhen: "no" },
  ],
  voice: [
    { id: "voice", titleKey: "voiceTitle", questionKey: "voiceQ", category: "Voice", problemWhen: "no" },
  ],
  joy: [
    { id: "joy", titleKey: "joyTitle", questionKey: "joyQ", category: "Fun", problemWhen: "no" },
  ],
  env: [
    { id: "space", titleKey: "spaceTitle", questionKey: "spaceQ", category: "Curious", problemWhen: "no" },
  ],
};

const UNIVERSAL_STARTER_META: StarterMeta = {
  id: "headache",
  titleKey: "headacheTitle",
  questionKey: "headacheQ",
  category: "Body",
  problemWhen: "yes",
};

type TFn = (key: string) => string;

const buildStarter = (meta: StarterMeta, t: TFn): StarterDef => ({
  id: meta.id,
  title: t(`onboarding.starters.${meta.titleKey}`),
  question: t(`onboarding.starters.${meta.questionKey}`),
  category: meta.category,
  problemWhen: meta.problemWhen,
});

// Hero example texts come from i18n (see HeroScreen). Icons stay here
// because they're UI metadata, not copy.

// --- Component ------------------------------------------------------

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

// Steps. Language (-1) appears only for users who haven't picked a
// language yet. 0..7 are the real tour. Flow:
//   -1 Language -> 0 Hero -> 1 Swipe -> 2 Calendar -> 3 Action Point
//   -> 4 Trend -> 5 Add Tracker -> 6 Themes -> 7 Starter
type Step = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOTAL_STEPS = 8;

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(() => (hasExplicitLanguage() ? 0 : -1));
  const [selectedThemes, setSelectedThemes] = useState<Set<ThemeId>>(new Set());
  const [uncheckedStarters, setUncheckedStarters] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(hasExplicitLanguage() ? 0 : -1);
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
      const seedStarter = buildStarter(UNIVERSAL_STARTER_META, t);
      const alreadyHasHeadache = existing.some(
        (x) => x.title.trim().toLowerCase() === seedStarter.title.toLowerCase()
      );
      if (!alreadyHasHeadache) {
        const now = new Date().toISOString();
        const today = new Date().toISOString().split("T")[0];
        const seed: Tracker = {
          id: `${Date.now()}-headache-seed`,
          title: seedStarter.title,
          category: seedStarter.category,
          questionText: seedStarter.question,
          answerType: "boolean",
          periodDays: 30,
          threshold: 10,
          problemWhen: seedStarter.problemWhen,
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
  }, [finish, t]);

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

  const themeStarterMetas = Array.from(selectedThemes).flatMap(
    (id) => STARTER_META_BY_THEME[id]
  );
  // Headache is always first so the calendar example on step 2 has context
  const suggestedStarters: StarterDef[] = [
    UNIVERSAL_STARTER_META,
    ...themeStarterMetas,
  ].map((m) => buildStarter(m, t));

  const selectedStarters = suggestedStarters.filter(
    (s) => !uncheckedStarters.has(s.id)
  );

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    // Mirror skipSetup: un-dismiss Ideas of the Day so TodayTab has something
    // to show even if tracker-creation silently fails below.
    try {
      localStorage.setItem("memap_ideas_dismissed", "false");
    } catch {
      /* ignore */
    }
    try {
      const existing = await getTrackers();
      const now = new Date().toISOString();
      const today = new Date().toISOString().split("T")[0];
      const baseSort = existing.length;

      // De-dupe selected starters by id in case the same starter meta ever
      // appears more than once (e.g. universal + theme overlap). Identical
      // ids would give identical React keys downstream and risk odd behaviour.
      const seenIds = new Set<string>();
      const uniqueStarters = selectedStarters.filter((s) => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      const newTrackers: Tracker[] = uniqueStarters.map((s, i) => ({
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
    } catch (e) {
      // Don't strand the user on the starter screen if persistence fails —
      // log and finish anyway so they land on Today.
      // eslint-disable-next-line no-console
      console.error("onboarding handleCreate failed:", e);
    } finally {
      setCreating(false);
      finish();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />

      {/* Progress — hidden on the language step (pre-tour) so that screen
          feels like a clean entrance, then shown for the 8 real steps. */}
      {step >= 0 && (
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
              onClick={skipSetup}
              style={{ touchAction: "manipulation" }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 -mr-2"
            >
              {t("onboarding.skipAll")}
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Content — min-h trick lets short screens center vertically while
          tall ones grow naturally and stay scrollable from the top. */}
      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-5 py-8">
        {step === -1 && <LanguagePickerScreen onNext={() => setStep(0)} />}
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

// --- Unified nav row ------------------------------------------------
// One consistent layout across every inner screen:
//   [ Back ]        [ Skip ]          [  Next  ]
// The Next pill is the only emphasised element; Back/Skip are thin
// low-contrast links so the eye doesn't bounce between steps.
interface NavRowProps {
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

const NavRow = ({
  onBack,
  onSkip,
  skipLabel,
  onNext,
  nextLabel,
  nextDisabled = false,
}: NavRowProps) => {
  const { t } = useTranslation();
  const skipText = skipLabel ?? t("onboarding.skipThis");
  const nextText = nextLabel ?? t("common.next");
  return (
  <div className="w-full max-w-[360px] mx-auto mt-4 flex items-center justify-between gap-2">
    {onBack ? (
      <button
        type="button"
        onClick={onBack}
        data-onb-interactive
        style={{ touchAction: "manipulation" }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors py-2 px-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("common.back")}
      </button>
    ) : (
      <span className="w-10" />
    )}

    {onSkip ? (
      <button
        type="button"
        onClick={onSkip}
        data-onb-interactive
        style={{ touchAction: "manipulation" }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors py-2 px-2 text-center"
      >
        {skipText}
      </button>
    ) : (
      <span />
    )}

    {onNext ? (
      <Button
        size="lg"
        onClick={onNext}
        disabled={nextDisabled}
        data-onb-interactive
        className="rounded-full px-6 shadow-lg shadow-primary/20 disabled:shadow-none"
      >
        {nextText}
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    ) : (
      <span className="w-10" />
    )}
  </div>
  );
};

// --- Screen -1: Language picker -------------------------------------
// Shown only for users who haven't yet chosen a language. Selecting one
// persists it immediately (setLanguage writes localStorage + switches
// i18next), then the tour advances into Hero in the chosen language.

const LanguagePickerScreen = ({ onNext }: { onNext: () => void }) => {
  const { t, i18n } = useTranslation();
  const current = (i18n.language || "en").slice(0, 2) as SupportedLanguage;
  const [picked, setPicked] = useState<SupportedLanguage>(current === "ru" ? "ru" : "en");

  const handlePick = (lng: SupportedLanguage) => {
    setPicked(lng);
    setLanguage(lng);
  };

  const handleContinue = () => {
    setLanguage(picked);
    onNext();
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Languages className="h-6 w-6" strokeWidth={1.75} />
      </div>

      <h1 className="font-serif text-xl font-medium text-center mb-2">
        {t("language.title")}
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-5 max-w-[320px]">
        {t("language.subtitle")}
      </p>

      <div className="w-full max-w-[320px] space-y-2 mb-5">
        {SUPPORTED_LANGUAGES.map((lng) => {
          const isSelected = picked === lng.code;
          return (
            <button
              key={lng.code}
              onClick={() => handlePick(lng.code)}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-full text-left rounded-2xl p-3 flex items-center gap-3 transition-all border",
                isSelected
                  ? "bg-primary/10 border-primary/40 shadow-sm"
                  : "bg-card border-border/50 hover:border-border"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium">{lng.native}</div>
                {lng.native !== lng.name && (
                  <div className="text-xs text-muted-foreground mt-0.5">{lng.name}</div>
                )}
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        onClick={handleContinue}
        data-onb-interactive
        className="rounded-full px-8 shadow-lg shadow-primary/20"
      >
        {t("common.next")}
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
};

// --- Screen 1: Hero -------------------------------------------------

const HeroScreen = ({ onNext, onSkipStep }: { onNext: () => void; onSkipStep: () => void }) => {
  const { t } = useTranslation();
  const heroExamples = [
    { icon: BedDouble, text: t("onboarding.hero.example1") },
    { icon: Heart, text: t("onboarding.hero.example2") },
    { icon: MessageSquareWarning, text: t("onboarding.hero.example3") },
  ];
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center animate-fade-in">
      <div className="relative w-full h-[180px] mb-5">
        {heroExamples.map((ex, i) => {
          const Icon = ex.icon;
          return (
            <div
              key={i}
              className="absolute left-1/2 w-[85%] card-premium px-3 py-2.5 flex items-center gap-3"
              style={{
                top: `${i * 46}px`,
                transform: `translateX(calc(-50% + ${(i - 1) * 10}px)) rotate(${(i - 1) * 2}deg)`,
                opacity: 0,
                animation: `heroFadeIn 0.6s ease-out ${0.15 + i * 0.25}s forwards`,
                zIndex: heroExamples.length - i,
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

      <h1 className="font-serif text-2xl font-medium mb-2 tracking-tight">
        {t("onboarding.hero.title1")}<span className="italic">{t("onboarding.hero.titleYou")}</span>
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px] mb-4">
        {t("onboarding.hero.subtitle")}
      </p>

      <NavRow onSkip={onSkipStep} onNext={onNext} nextLabel={t("common.tryIt")} />

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

const SWIPE_THRESHOLD = 80;

const SwipeScreen = ({ onDone, onBack, onSkipStep }: { onDone: () => void; onBack: () => void; onSkipStep: () => void }) => {
  const { t } = useTranslation();
  // Two practice cards — rebuilt per render so they follow the active
  // language. The "swipes break on card 2" bug is prevented by
  // key={cardIdx} (full remount) and deferred pointer capture.
  const PRACTICE_CARDS: PracticeCard[] = [
    { question: t("onboarding.swipe.card1"), expected: "yes", hint: t("onboarding.swipe.hint") },
    { question: t("onboarding.swipe.card2"), expected: "yes", hint: t("onboarding.swipe.hint") },
  ];
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
      <h2 className="font-serif text-xl font-medium text-center mb-2">
        {t("onboarding.swipe.title")}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-5 max-w-[300px]">
        {t("onboarding.swipe.subtitle")}
      </p>

      <div className="relative w-full h-[200px] flex items-center justify-center overflow-hidden">
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
            <X className="h-5 w-5" /> {t("common.no")}
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
            {t("common.yes")} <Check className="h-5 w-5" />
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
            "card-premium w-[92%] min-h-[170px] px-5 py-6 flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing",
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
          <p className="text-lg font-medium text-center leading-snug">
            {card.question}
          </p>
        </Card>
      </div>

      {/* Yes / No buttons */}
      <div className="flex items-center gap-3 w-full max-w-[320px] mt-4">
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
          {t("common.no")}
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
          {t("common.yes")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3 h-4">
        {success ? t("common.saved") : card.hint}
      </p>

      {PRACTICE_CARDS.length > 1 && (
        <div className="mt-2 text-[10px] text-muted-foreground/70">
          {cardIdx + 1} / {PRACTICE_CARDS.length}
        </div>
      )}

      <NavRow onBack={onBack} onSkip={onSkipStep} />
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

const CALENDAR_EXAMPLE_DAYS: number[][] = [
  [3, 7, 8, 14, 19, 22],
  [2, 5, 6, 12, 13, 18, 19, 20],
  [4, 9, 11, 15, 17, 21, 23],
];

const CalendarScreen = ({ onNext, onBack, onSkipStep }: { onNext: () => void; onBack: () => void; onSkipStep: () => void }) => {
  const { t } = useTranslation();
  // Simulated April 2026: 30 days, starts Wed (offset=2)
  const firstOffset = 2;
  const daysInMonth = 30;
  const todayDay = 24;
  // Localised examples — titles/captions follow the active language.
  const CALENDAR_EXAMPLES: CalendarExample[] = [
    {
      title: t("onboarding.calendar.cardTitleHeadache"),
      sigLabel: t("onboarding.calendar.sigHeadache"),
      caption: t("onboarding.calendar.captionHeadache"),
      significantDays: CALENDAR_EXAMPLE_DAYS[0],
    },
    {
      title: t("onboarding.calendar.cardTitleDrinks"),
      sigLabel: t("onboarding.calendar.sigDrinks"),
      caption: t("onboarding.calendar.captionDrinks"),
      significantDays: CALENDAR_EXAMPLE_DAYS[1],
    },
    {
      title: t("onboarding.calendar.cardTitleArgue"),
      sigLabel: t("onboarding.calendar.sigArgue"),
      caption: t("onboarding.calendar.captionArgue"),
      significantDays: CALENDAR_EXAMPLE_DAYS[2],
    },
  ];

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
      <h2 className="font-serif text-xl font-medium text-center mb-1">
        {t("onboarding.calendar.title")}
      </h2>
      <p
        key={example.caption}
        className="text-xs text-muted-foreground text-center mb-3 max-w-[340px] mx-auto leading-relaxed min-h-[32px] animate-fade-in"
      >
        {example.caption}
      </p>

      <Card className="card-premium p-3 mb-3 relative">
        <div className="flex items-center justify-between mb-2 gap-2">
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
              {t("onboarding.calendar.selectMultiple")}
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

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="text-center py-1.5 rounded-xl bg-muted/40">
            <div className="font-serif text-xl font-medium leading-none">{tracked}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {t("onboarding.calendar.daysTracked")}
            </div>
          </div>
          <div className="text-center py-1.5 rounded-xl bg-strong/10">
            <div key={significant} className="font-serif text-xl font-medium leading-none text-strong animate-fade-in">
              {significant}
            </div>
            <div
              key={example.sigLabel}
              className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 animate-fade-in"
            >
              {example.sigLabel}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-muted-foreground text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
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

        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-strong/70" />
            <span>{t("onboarding.calendar.significantLabel")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-balanced/70" />
            <span>{t("onboarding.calendar.balancedLabel")}</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
        <CheckSquare className="h-3.5 w-3.5" />
        <span>
          {(() => {
            const raw = t("onboarding.calendar.hintMulti", {
              label: `__LBL__${t("onboarding.calendar.selectMultiple")}__LBL__`,
            });
            const parts = raw.split("__LBL__");
            return parts.map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-medium text-foreground">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
          })()}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>
          {(() => {
            const raw = t("onboarding.calendar.hintPatterns", {
              tab: `__TAB__${t("common.patterns")}__TAB__`,
            });
            const parts = raw.split("__TAB__");
            return parts.map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-medium text-foreground">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
          })()}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-2 text-center">
        <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>
          {(() => {
            const raw = t("onboarding.calendar.hintNotes", {
              addNote: `__ADD__${t("onboarding.calendar.addNote")}__ADD__`,
            });
            const parts = raw.split("__ADD__");
            return parts.map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-medium text-foreground">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
          })()}
        </span>
      </div>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />

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
  const { t } = useTranslation();
  const seriesA = [5, 6, 7, 7, 4, 4, 7]; // Deadline pressure days/week
  const seriesB = [4, 5, 6, 6, 3, 4, 6]; // Poor sleep days/week
  const max = 7;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 22;
  const W = 300;
  const H = 120;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const step = plotW / (seriesA.length - 1);
  const xAt = (i: number) => PAD_L + i * step;
  const yAt = (v: number) => PAD_T + plotH - (v / max) * plotH;
  // Catmull-Rom → cubic Bézier so the chart looks like the Patterns tab
  // (soft arcs) instead of a jagged Excel line chart.
  const smoothPath = (values: number[]) => {
    const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    if (pts.length < 2) return "";
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };
  const pathA = smoothPath(seriesA);
  const pathB = smoothPath(seriesB);
  const xLabels = ["Mar 27", "", "Apr 3", "", "Apr 10", "", "Apr 17"];
  const yTicks = [0, 4, 7];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <h2 className="font-serif text-xl font-medium text-center mb-1">
        {t("onboarding.pattern.title")}
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-3 max-w-[320px]">
        {t("onboarding.pattern.subtitle")}
      </p>

      <Card className="card-premium w-full p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            {t("onboarding.pattern.trendLabel")}
          </span>
          <span className="text-[10px] text-muted-foreground">30d</span>
        </div>

        {/* Chip legend like TrendChart */}
        <div className="flex flex-wrap gap-1.5 mb-2">
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
            <span>{t("onboarding.pattern.legendA")}</span>
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
            <span>{t("onboarding.pattern.legendB")}</span>
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
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="#94a3b8"
                strokeOpacity="0.18"
                strokeDasharray="3 3"
              />
              <text
                x={PAD_L - 6}
                y={yAt(tick) + 3}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
              >
                {tick}d
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
        className="card-premium w-full px-3 py-2 mb-2 flex items-start gap-2.5"
        style={{ opacity: 0, animation: "patternFadeIn 0.5s ease 2.2s forwards" }}
      >
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs leading-relaxed pt-0.5">
          <span className="font-medium text-foreground">{t("onboarding.pattern.insightTitle")}</span>
          <span className="text-muted-foreground">
            {t("onboarding.pattern.insightBody")}
          </span>
        </p>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-2">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>
          {(() => {
            const raw = t("onboarding.calendar.hintPatterns", {
              tab: `__TAB__${t("common.patterns")}__TAB__`,
            });
            return raw.split("__TAB__").map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-medium text-foreground">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
          })()}
        </span>
      </div>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />

      <style>{`
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes patternFadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
};

// --- Screen 3: Action Point (reflection trigger) --------------------

const ACTION_POINT_ICONS = [BedDouble, Heart, Flame];
const ACTION_POINT_META = [
  { trackerKey: "starters.headacheTitle", prefix: "example1" },
  { trackerKey: "starters.argueTitle", prefix: "example2" },
  { trackerKey: "starters.drinksTitle", prefix: "example3" },
] as const;

const ActionPointScreen = ({ onNext, onBack, onSkipStep }: { onNext: () => void; onBack: () => void; onSkipStep: () => void }) => {
  const { t } = useTranslation();
  // Hard-coded fallback tracker labels since we reuse starter names where
  // possible and fall back to trackerFallback entries otherwise.
  const examples = [
    {
      tracker: t("onboarding.starters.headacheTitle"),
      icon: BedDouble,
      summary: t("onboarding.action.example1Summary"),
      action: t("onboarding.action.example1Action"),
      highlight: t("onboarding.action.example1Highlight"),
    },
    {
      tracker: t("onboarding.addTracker.tplArgueTitle"),
      icon: Heart,
      summary: t("onboarding.action.example2Summary"),
      action: t("onboarding.action.example2Action"),
      highlight: t("onboarding.action.example2Highlight"),
    },
    {
      tracker: t("onboarding.calendar.cardTitleDrinks").split(" · ")[0],
      icon: Flame,
      summary: t("onboarding.action.example3Summary"),
      action: t("onboarding.action.example3Action"),
      highlight: t("onboarding.action.example3Highlight"),
    },
  ];
  // Kept as a stable ref for React key stability across renders.
  void ACTION_POINT_ICONS;
  void ACTION_POINT_META;
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <h2 className="font-serif text-xl font-medium text-center mb-1">
        {t("onboarding.action.title")}
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-3 max-w-[340px]">
        {(() => {
          const raw = t("onboarding.action.subtitle", {
            actionPoint: `__AP__${t("onboarding.action.actionPoint")}__AP__`,
          });
          return raw.split("__AP__").map((p, i) =>
            i % 2 === 1 ? (
              <span key={i} className="font-medium text-foreground">{p}</span>
            ) : (
              <span key={i}>{p}</span>
            )
          );
        })()}
      </p>

      {/* Example Action Point cards — real-looking stack */}
      <div className="w-full space-y-2 mb-3">
        {examples.map((ex, i) => {
          const Icon = ex.icon;
          const isFirst = i === 0;
          return (
            <div key={ex.tracker} className="relative">
              <Card
                className="card-premium p-2.5 border-l-4"
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
                      {t("onboarding.action.actionPoint")} · {ex.tracker}
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

      <div className="text-[11px] text-muted-foreground text-center mb-2">
        {(() => {
          const raw = t("onboarding.action.findOn", {
            today: `__T__${t("common.today")}__T__`,
            patterns: `__P__${t("common.patterns")}__P__`,
          });
          return raw
            .split(/__T__|__P__/)
            .map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-medium text-foreground">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
        })()}
      </div>

      {/* Notifications hint card */}
      <Card className="card-premium w-full p-2.5 mb-2 flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium mb-0.5">{t("onboarding.action.notifTitle")}</div>
          <p className="text-xs text-muted-foreground leading-snug">
            {(() => {
              const raw = t("onboarding.action.notifBody", {
                settings: `__S__${t("common.settings")}__S__`,
              });
              return raw.split("__S__").map((p, i) =>
                i % 2 === 1 ? (
                  <span key={i} className="font-medium text-foreground">{p}</span>
                ) : (
                  <span key={i}>{p}</span>
                )
              );
            })()}
          </p>
        </div>
      </Card>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />

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
  const { t } = useTranslation();
  const sampleTemplates = [
    { title: t("onboarding.addTracker.tplHeadacheTitle"), question: t("onboarding.addTracker.tplHeadacheQ"), category: "Body" },
    { title: t("onboarding.addTracker.tplArgueTitle"), question: t("onboarding.addTracker.tplArgueQ"), category: "Connections" },
  ];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-xl font-medium text-center mb-1">
        {t("onboarding.addTracker.title")}
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-3 max-w-[320px] mx-auto">
        {(() => {
          const raw = t("onboarding.addTracker.subtitle", { plus: "__PLUS__+__PLUS__" });
          return raw.split("__PLUS__").map((p, i) =>
            i % 2 === 1 ? (
              <span key={i} className="font-medium text-foreground">{p}</span>
            ) : (
              <span key={i}>{p}</span>
            )
          );
        })()}
      </p>

      {/* Mock "Add Tracker" sheet */}
      <div className="relative card-premium p-2.5 mb-2.5">
        {/* Pulsing "+" icon */}
        <div className="absolute -top-3 right-4">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
        <div className="flex rounded-lg bg-muted/40 p-1 mb-2 text-xs font-medium mt-0.5">
          <div className="flex-1 text-center py-1 rounded-md bg-background shadow-sm">
            <LayoutGrid className="h-3 w-3 inline mr-1" />
            {t("onboarding.addTracker.tabTemplate")}
          </div>
          <div className="flex-1 text-center py-1 text-muted-foreground">
            <Sliders className="h-3 w-3 inline mr-1" />
            {t("onboarding.addTracker.tabCustom")}
          </div>
        </div>

        <div className="space-y-1.5 mb-2">
          {sampleTemplates.map((tpl) => (
            <div
              key={tpl.title}
              className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/50 bg-card"
              // No fade-in animation here — keyframe lives only on
              // PatternScreen and this card would stay invisible otherwise.
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="text-xs font-medium truncate">{tpl.title}</div>
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 shrink-0">{tpl.category}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{tpl.question}</div>
              </div>
              <div className="shrink-0 h-6 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {t("onboarding.addTracker.add")}
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-muted-foreground text-center pt-1">
          {(() => {
            const raw = t("onboarding.addTracker.switchHint", {
              custom: `__C__${t("onboarding.addTracker.tabCustom")}__C__`,
            });
            return raw.split("__C__").map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-medium text-foreground">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
          })()}
        </div>
      </div>

      {/* Compact Custom-tab preview — shows the user that period, threshold
          and "what counts as concerning" are all tweakable. Uses tiny rows
          so the whole page still fits without scrolling. */}
      <div className="card-premium p-2.5 mb-2">
        <div className="flex rounded-lg bg-muted/40 p-1 mb-2 text-[11px] font-medium">
          <div className="flex-1 text-center py-1 text-muted-foreground">
            <LayoutGrid className="h-3 w-3 inline mr-1" />
            {t("onboarding.addTracker.tabTemplate")}
          </div>
          <div className="flex-1 text-center py-1 rounded-md bg-background shadow-sm">
            <Sliders className="h-3 w-3 inline mr-1" />
            {t("onboarding.addTracker.tabCustom")}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">{t("onboarding.addTracker.rowQuestion")}</span>
            <span className="flex-1 truncate text-foreground">{t("onboarding.addTracker.rowQuestionExample")}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">{t("onboarding.addTracker.rowPeriod")}</span>
            <span className="px-2 py-0.5 rounded bg-muted/50 text-foreground font-medium">{t("onboarding.addTracker.rowPeriodValue")}</span>
            <span className="text-[10px] text-muted-foreground/70">{t("onboarding.addTracker.rowPeriodHelp")}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">{t("onboarding.addTracker.rowThreshold")}</span>
            <span className="px-2 py-0.5 rounded bg-muted/50 text-foreground font-medium">{t("onboarding.addTracker.rowThresholdValue")}</span>
            <span className="text-[10px] text-muted-foreground/70">{t("onboarding.addTracker.rowThresholdHelp")}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-[70px] text-muted-foreground shrink-0">{t("onboarding.addTracker.rowConcerning")}</span>
            <span className="px-2 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground">{t("common.yes")}</span>
            <span className="px-2 py-0.5 rounded bg-strong/15 text-strong border border-strong/40 font-medium">{t("common.no")}</span>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground mt-2 leading-snug">
          {(() => {
            const raw = t("onboarding.addTracker.concerningHelp", {
              concerning: `__C__${t("onboarding.addTracker.concerningWord")}__C__`,
              q: `__Q__${t("onboarding.addTracker.rowQuestionExample")}__Q__`,
            });
            return raw.split(/__C__|__Q__/).map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="text-foreground font-medium">{p}</span>
              ) : (
                <span key={i}>{p}</span>
              )
            );
          })()}
        </div>
      </div>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />


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
  const { t } = useTranslation();
  const themes = useThemes();
  const canContinue = selected.size >= 1;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-xl font-medium text-center mb-1">
        {t("onboarding.themes.title")}
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-3 max-w-[320px] mx-auto">
        {t("onboarding.themes.subtitle")}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {themes.map((th) => {
          const isSelected = selected.has(th.id);
          const Icon = th.icon;
          return (
            <button
              key={th.id}
              onClick={() => onToggle(th.id)}
              className={cn(
                "relative rounded-2xl p-2.5 text-left transition-all duration-200 border",
                isSelected
                  ? "bg-primary/10 border-primary/40 shadow-sm"
                  : "bg-card border-border/50 hover:border-border"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 transition-colors",
                  isSelected ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="text-sm font-medium leading-tight">{th.title}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                {th.subtitle}
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

      <NavRow
        onBack={onBack}
        onSkip={onSkipSetup}
        skipLabel={t("onboarding.skipSetupLater")}
        onNext={onNext}
        nextDisabled={!canContinue}
      />
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
  const { t } = useTranslation();
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
            title: t("permissions.insecureOriginTitle"),
            description: t("permissions.insecureOriginDesc"),
          },
          unsupported: {
            title: t("permissions.unsupportedTitle"),
            description: t("permissions.unsupportedDesc"),
          },
          denied: {
            title: t("permissions.deniedTitle"),
            description: t("permissions.deniedDesc"),
          },
          unknown: {
            title: t("permissions.unknownTitle"),
            description: t("permissions.unknownDesc"),
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
        title: t("settings.notificationsEnabled"),
        description: t("settings.notificationsEnabledDesc", { time: next.time }),
      });
    } finally {
      setNotifRequesting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-xl font-medium text-center mb-1">
        {t("onboarding.starter.title")}
      </h2>
      <p className="text-xs text-muted-foreground text-center mb-3 max-w-[320px] mx-auto">
        {t("onboarding.starter.subtitle")}
      </p>

      <div className="space-y-1.5 mb-3">
        {starters.map((s) => {
          const isOn = !unchecked.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={cn(
                "w-full text-left rounded-2xl p-2.5 flex items-start gap-3 transition-all border",
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
          "w-full text-left rounded-2xl p-2.5 mb-2 flex items-start gap-3 transition-all border",
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
            {t("onboarding.starter.allowNotifications")}
            {notifOn && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                {t("onboarding.starter.notifOn")}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {t("onboarding.starter.notifHelp")}
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

      <NavRow
        onBack={creating ? undefined : onBack}
        onSkip={creating ? undefined : onSkipSetup}
        skipLabel={t("onboarding.skipSetupLater")}
        onNext={onStart}
        nextLabel={creating ? t("onboarding.starter.creating") : t("onboarding.starter.startCount")}
        nextDisabled={selectedCount === 0 || creating}
      />
    </div>
  );
};

// --- Exports --------------------------------------------------------

export const shouldShowTour = (): boolean => {
  return localStorage.getItem(TOUR_SEEN_KEY) !== "true";
};

export const resetTourSeen = () => {
  localStorage.removeItem(TOUR_SEEN_KEY);
  // Also forget the explicit-language flag so a replayed tour starts from
  // the language picker, same as a brand-new install. The active language
  // itself (LANGUAGE_KEY) stays — we don't want to yank the UI into English
  // while the user is reading their own Settings page in Russian.
  localStorage.removeItem(EXPLICIT_LANGUAGE_KEY);
};
