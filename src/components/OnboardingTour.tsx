import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Languages,
  Sparkles,
  Repeat,
  Brain,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tracker } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import {
  hasExplicitLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  EXPLICIT_LANGUAGE_KEY,
} from "@/lib/i18n";

const TOUR_SEEN_KEY = "memap_tour_seen";
const INTERVIEW_KEY = "memap_interview";

// --- Interview state -----------------------------------------------

type Pol = "male" | "female" | "neutral";
type AgeRange = "18-25" | "26-35" | "36-45" | "46-55" | "55+";
type FocusArea =
  | "stress"
  | "sleep"
  | "relationships"
  | "work"
  | "body"
  | "mood"
  | "energy"
  | "money"
  | "hobbies";
type Goal = "patterns" | "habit" | "understand" | "doctor";
const ALL_GOALS: Goal[] = ["patterns", "habit", "understand", "doctor"];

interface InterviewAnswers {
  pol?: Pol;
  age?: AgeRange;
  focus?: FocusArea[];
  hasKids?: boolean;
  hasPets?: boolean;
  hasPartner?: boolean;
  // Goal is now multi-select — users may have several reasons at once.
  goal?: Goal[];
}

const readInterview = (): InterviewAnswers => {
  try {
    const raw = localStorage.getItem(INTERVIEW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as InterviewAnswers;
    return {};
  } catch {
    return {};
  }
};

const writeInterview = (answers: InterviewAnswers) => {
  try {
    localStorage.setItem(INTERVIEW_KEY, JSON.stringify(answers));
  } catch {
    // ignore storage failures — partial answers aren't critical
  }
};

// --- Default starter trackers ---------------------------------------
// These replace the old Headache-first universal seed. We use the same
// 5 universal trackers everywhere we previously seeded Headache: top-right
// "Skip all", and the StackReveal stub (which Part B will later replace
// with personalised generation).

interface DefaultStarterMeta {
  id: string;
  titleKey: string;
  questionKey: string;
  category: Tracker["category"];
  problemWhen: "yes" | "no";
}

// Five universal starters covering five DIFFERENT life domains, so the
// new user gets a varied picture from day one rather than five flavours
// of "how I feel" or "how I sleep".
const DEFAULT_STARTERS: DefaultStarterMeta[] = [
  { id: "sleep",      titleKey: "sleepTitle",      questionKey: "sleepQ",      category: "Health",      problemWhen: "no"  },
  { id: "stress",     titleKey: "stressTitle",     questionKey: "stressQ",     category: "Emotions",    problemWhen: "yes" },
  { id: "move",       titleKey: "moveTitle",       questionKey: "moveQ",       category: "Body",        problemWhen: "no"  },
  { id: "connection", titleKey: "connectionTitle", questionKey: "connectionQ", category: "Connections", problemWhen: "no"  },
  { id: "joy",        titleKey: "joyTitle",        questionKey: "joyQ",        category: "Fun",         problemWhen: "no"  },
];

type TFn = (key: string) => string;

// Seed the user's tracker list with the 5 universal defaults. Used by
// both the top-right "Skip all" button AND the StackReveal stub on
// step 4. De-dupes by title (case-insensitive) so replaying the tour
// doesn't pile up duplicates.
const seedDefaultTrackers = async (t: TFn) => {
  try {
    localStorage.setItem("memap_ideas_dismissed", "false");
  } catch {
    // ignore
  }
  try {
    const existing = await getTrackers();
    const existingTitles = new Set(
      existing.map((x) => x.title.trim().toLowerCase())
    );
    const now = new Date().toISOString();
    const today = new Date().toISOString().split("T")[0];
    const baseSort = existing.length;
    const additions: Tracker[] = [];
    DEFAULT_STARTERS.forEach((meta, i) => {
      const title = t(`onboarding.defaultStarters.${meta.titleKey}`);
      const question = t(`onboarding.defaultStarters.${meta.questionKey}`);
      if (existingTitles.has(title.trim().toLowerCase())) return;
      additions.push({
        id: `${Date.now()}-${meta.id}-${i}`,
        title,
        category: meta.category,
        questionText: question,
        answerType: "boolean",
        periodDays: 30,
        threshold: 10,
        problemWhen: meta.problemWhen,
        adviceAboveThreshold: "",
        createdAt: now,
        sortIndex: baseSort + i,
        cycleStartDate: today,
      });
    });
    if (additions.length > 0) {
      await saveTrackers([...existing, ...additions]);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("seedDefaultTrackers failed:", e);
  }
};

// --- Component ------------------------------------------------------

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

// Steps. Language (-1) appears only for users who haven't picked a
// language yet. 0..4 are the personalisation interview + StackReveal
// stub. (Step 5 / FirstSwipe lands in Part C.)
//   -1 Language -> 0 AboutYou -> 1 Focus -> 2 Context -> 3 Goal
//   -> 4 StackReveal (stub)  [-> 5 FirstSwipe — TODO Part C]
type Step = -1 | 0 | 1 | 2 | 3 | 4;
const TOTAL_STEPS = 5;

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(() => (hasExplicitLanguage() ? 0 : -1));
  const [answers, setAnswers] = useState<InterviewAnswers>(() => readInterview());

  useEffect(() => {
    if (open) {
      setStep(hasExplicitLanguage() ? 0 : -1);
      setAnswers(readInterview());
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

  // Update one or more answer fields and persist. Spreads the new patch
  // over the existing answers so we never lose previous selections when
  // the user advances through the interview.
  const patchAnswers = useCallback((patch: Partial<InterviewAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      writeInterview(next);
      return next;
    });
  }, []);

  // Skip-all safety net (top-right X). Seeds the 5 default trackers,
  // un-dismisses Ideas of the Day, finishes. Same logic StackReveal
  // uses on step 4 — kept in one place via seedDefaultTrackers.
  const skipSetup = useCallback(async () => {
    await seedDefaultTrackers(t);
    finish();
  }, [finish, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />

      {/* Progress — hidden on the language step (pre-tour). */}
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

      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-5 py-8">
          {step === -1 && <LanguagePickerScreen onNext={() => setStep(0)} />}
          {step === 0 && (
            <AboutYouScreen
              answers={answers}
              onPatch={patchAnswers}
              onNext={() => setStep(1)}
              onSkipStep={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <FocusScreen
              answers={answers}
              onPatch={patchAnswers}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
              onSkipStep={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <ContextScreen
              answers={answers}
              onPatch={patchAnswers}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              onSkipStep={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <GoalScreen
              answers={answers}
              onPatch={patchAnswers}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              onSkipStep={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StackRevealScreen
              onBack={() => setStep(3)}
              onFinish={finish}
            />
          )}
          {/* TODO Part C: step === 5 && <FirstSwipeScreen … /> */}
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

// --- Reusable chip --------------------------------------------------
// Pill-shaped tappable chip used by AboutYou / Focus / Context / Goal.
// Selected state uses primary tint, deselected stays low-contrast so
// the active answer is the only thing the eye lands on.

const Chip = ({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    data-onb-interactive
    style={{ touchAction: "manipulation" }}
    className={cn(
      "rounded-full px-4 py-2 text-sm font-medium transition-all border",
      selected
        ? "bg-primary/15 border-primary/50 text-foreground shadow-sm"
        : "bg-card border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
      className
    )}
  >
    {children}
  </button>
);

// --- Screen -1: Language picker -------------------------------------
// (unchanged from previous tour — just re-imported.)

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

// --- Screen 0: About You --------------------------------------------

const POL_OPTIONS: Pol[] = ["male", "female", "neutral"];
const AGE_OPTIONS: AgeRange[] = ["18-25", "26-35", "36-45", "46-55", "55+"];

const AboutYouScreen = ({
  answers,
  onPatch,
  onNext,
  onSkipStep,
}: {
  answers: InterviewAnswers;
  onPatch: (patch: Partial<InterviewAnswers>) => void;
  onNext: () => void;
  onSkipStep: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        {t("onboarding.aboutYou.title")}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {t("onboarding.aboutYou.subtitle")}
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-5">
        {POL_OPTIONS.map((p) => (
          <Chip
            key={p}
            selected={answers.pol === p}
            onClick={() => onPatch({ pol: p })}
          >
            {t(`onboarding.aboutYou.${p}`)}
          </Chip>
        ))}
      </div>

      <div className="text-xs uppercase tracking-wide text-muted-foreground text-center mb-2">
        {t("onboarding.aboutYou.ageLabel")}
      </div>
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {AGE_OPTIONS.map((a) => (
          <Chip
            key={a}
            selected={answers.age === a}
            onClick={() => onPatch({ age: a })}
          >
            {a}
          </Chip>
        ))}
      </div>

      <NavRow onSkip={onSkipStep} onNext={onNext} />
    </div>
  );
};

// --- Screen 1: Focus ------------------------------------------------

const FOCUS_OPTIONS: FocusArea[] = [
  "stress",
  "sleep",
  "relationships",
  "work",
  "body",
  "mood",
  "energy",
  "money",
  "hobbies",
];

const FocusScreen = ({
  answers,
  onPatch,
  onBack,
  onNext,
  onSkipStep,
}: {
  answers: InterviewAnswers;
  onPatch: (patch: Partial<InterviewAnswers>) => void;
  onBack: () => void;
  onNext: () => void;
  onSkipStep: () => void;
}) => {
  const { t } = useTranslation();
  const selected = answers.focus ?? [];

  const toggle = (id: FocusArea) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onPatch({ focus: next });
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        {t("onboarding.focus.title")}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {t("onboarding.focus.subtitle")}
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {FOCUS_OPTIONS.map((id) => (
          <Chip
            key={id}
            selected={selected.includes(id)}
            onClick={() => toggle(id)}
          >
            {t(`onboarding.focus.${id}`)}
          </Chip>
        ))}
      </div>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />
    </div>
  );
};

// --- Screen 2: Context ----------------------------------------------

interface ContextRow {
  key: "kids" | "pets" | "partner";
  field: "hasKids" | "hasPets" | "hasPartner";
}

const CONTEXT_ROWS: ContextRow[] = [
  { key: "kids", field: "hasKids" },
  { key: "pets", field: "hasPets" },
  { key: "partner", field: "hasPartner" },
];

const ContextScreen = ({
  answers,
  onPatch,
  onBack,
  onNext,
  onSkipStep,
}: {
  answers: InterviewAnswers;
  onPatch: (patch: Partial<InterviewAnswers>) => void;
  onBack: () => void;
  onNext: () => void;
  onSkipStep: () => void;
}) => {
  const { t } = useTranslation();

  const setRow = (field: ContextRow["field"], value: boolean | undefined) => {
    // toggle off if user re-taps the same answer
    const current = answers[field];
    const next = current === value ? undefined : value;
    onPatch({ [field]: next } as Partial<InterviewAnswers>);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        {t("onboarding.context.title")}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {t("onboarding.context.subtitle")}
      </p>

      <div className="space-y-3 mb-3">
        {CONTEXT_ROWS.map((row) => {
          const value = answers[row.field];
          return (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                {t(`onboarding.context.${row.key}`)}
              </span>
              <div className="flex gap-2 shrink-0">
                <Chip
                  selected={value === true}
                  onClick={() => setRow(row.field, true)}
                  className="px-4 py-1.5"
                >
                  {t("onboarding.context.yes")}
                </Chip>
                <Chip
                  selected={value === false}
                  onClick={() => setRow(row.field, false)}
                  className="px-4 py-1.5"
                >
                  {t("onboarding.context.no")}
                </Chip>
              </div>
            </div>
          );
        })}
      </div>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />
    </div>
  );
};

// --- Screen 3: Goal -------------------------------------------------

const GOAL_OPTIONS: { id: Goal; icon: typeof Sparkles }[] = [
  { id: "patterns", icon: Sparkles },
  { id: "habit", icon: Repeat },
  { id: "understand", icon: Brain },
  { id: "doctor", icon: Stethoscope },
];

const GoalScreen = ({
  answers,
  onPatch,
  onBack,
  onNext,
  onSkipStep,
}: {
  answers: InterviewAnswers;
  onPatch: (patch: Partial<InterviewAnswers>) => void;
  onBack: () => void;
  onNext: () => void;
  onSkipStep: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-md mx-auto flex flex-col animate-fade-in">
      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        {t("onboarding.goal.title")}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {t("onboarding.goal.subtitle")}
      </p>

      <div className="space-y-2 mb-3">
        {GOAL_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const current = answers.goal ?? [];
          const isSelected = current.includes(opt.id);
          const toggle = () => {
            const next = isSelected
              ? current.filter((g) => g !== opt.id)
              : [...current, opt.id];
            onPatch({ goal: next });
          };
          return (
            <button
              key={opt.id}
              type="button"
              onClick={toggle}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-full text-left rounded-2xl p-3 flex items-start gap-3 transition-all border",
                isSelected
                  ? "bg-primary/10 border-primary/40 shadow-sm"
                  : "bg-card border-border/50 hover:border-border"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isSelected
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/60 text-muted-foreground"
                )}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {t(`onboarding.goal.${opt.id}.title`)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {t(`onboarding.goal.${opt.id}.subtitle`)}
                </div>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <NavRow onBack={onBack} onSkip={onSkipStep} onNext={onNext} />
    </div>
  );
};

// --- Screen 4: Stack reveal (STUB for Part A) -----------------------
// Part A: always seeds the 5 default trackers, regardless of interview
// answers. Part B will replace this with personalised generation +
// animated card reveal.

const StackRevealScreen = ({
  onBack,
  onFinish,
}: {
  onBack: () => void;
  onFinish: () => void;
}) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);

  const handleGo = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await seedDefaultTrackers(t);
    } finally {
      setCreating(false);
      onFinish();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Sparkles className="h-6 w-6" strokeWidth={1.75} />
      </div>

      <h2 className="font-serif text-2xl font-medium text-center mb-2">
        {t("onboarding.stackReveal.title")}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-[320px]">
        {t("onboarding.stackReveal.subtitle")}
      </p>

      <Button
        size="lg"
        onClick={handleGo}
        disabled={creating}
        data-onb-interactive
        className="rounded-full px-8 shadow-lg shadow-primary/20 disabled:shadow-none"
      >
        {creating ? t("onboarding.stackReveal.preparing") : t("onboarding.stackReveal.cta")}
        {!creating && <ArrowRight className="h-4 w-4 ml-1.5" />}
      </Button>

      <NavRow onBack={creating ? undefined : onBack} />
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
  // Forget previous interview answers too so the new tour starts blank.
  localStorage.removeItem(INTERVIEW_KEY);
  // And re-arm the post-onboarding coachmark walkthrough.
  localStorage.removeItem("memap_coachmark_seen");
};
