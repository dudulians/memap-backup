import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  generateStarterPack,
  hasMeaningfulInterviewSignal,
  GeneratedStarter,
} from "@/lib/starterGenerator";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { track } from "@/lib/analytics";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import {
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
} from "@/lib/trackerLocalize";

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
  | "hobbies"
  | "environment";
type Goal = "patterns" | "habit" | "understand" | "doctor";
const ALL_GOALS: Goal[] = ["patterns", "habit", "understand", "doctor"];

interface InterviewAnswers {
  pol?: Pol;
  age?: AgeRange;
  focus?: FocusArea[];
  hasKids?: boolean;
  hasPets?: boolean;
  hasPartner?: boolean;
  // "Are you currently living in a country where you weren't born?"
  // Gates the entire `expat` cluster (Жизнь за границей) — without
  // this filter, generic users would see "spoke local language" /
  // "missed home country" templates as irrelevant noise.
  isExpat?: boolean;
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

// Five universal starter templates from the library — used to seed
// new accounts when the user skips onboarding or the personalised
// generator produced nothing. Reused via library template ids so
// the seeded trackers carry full library metadata (proper questions
// with qualifying details, advice text, cluster, polarity) instead
// of the bespoke short titles ("Сон", "Радость") we used to mint
// — those didn't match library templates and felt orphaned. Five
// different clusters → varied picture from day one.
const DEFAULT_STARTER_TEMPLATE_IDS: string[] = [
  "slept-enough",      // Health cluster — sleep is the fundamental factor
  "felt-anxious",      // Inner state — most-reported daily problem
  "exercised",         // Health cluster — active habit
  "felt-close-to-partner", // Partner cluster — relationship signal
  "felt-happy",        // Inner state — positive baseline
];

type TFn = (key: string) => string;

// Seed the user's tracker list with the 5 universal defaults. Used by
// both the top-right "Skip all" button AND the StackReveal stub on
// step 4. De-dupes by title (case-insensitive) so replaying the tour
// doesn't pile up duplicates.
//
// Reworked in 1.7+: pulls from LIFE_STREAMS by template id so the
// seeded trackers are real library entries with full metadata
// (cluster, polarity, advice, qualifying questions). Previously
// minted short ad-hoc trackers like "Сон" / "Спал ли я больше 7
// часов" that didn't exist in the library — user got confused
// editing them later because they had no template back-reference.
const seedDefaultTrackers = async (_t: TFn) => {
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
    DEFAULT_STARTER_TEMPLATE_IDS.forEach((tplId, i) => {
      // Find the canonical template + its cluster.
      let canonical: typeof LIFE_STREAMS[0]["templates"][0] | null = null;
      let clusterId: string | undefined;
      for (const stream of LIFE_STREAMS) {
        const found = stream.templates.find((tpl) => tpl.id === tplId);
        if (found) {
          canonical = found;
          clusterId = stream.id;
          break;
        }
      }
      if (!canonical) return;
      const localizedTitle = localizeTrackerTitleRaw(canonical.title);
      const localizedQuestion = localizeTrackerQuestionRaw(canonical.questionText);
      const localizedAdvice = localizeTrackerAdviceRaw(canonical.adviceAboveThreshold);
      if (existingTitles.has(localizedTitle.trim().toLowerCase())) return;
      additions.push({
        id: `${Date.now()}-${tplId}-${i}`,
        title: localizedTitle,
        category: canonical.category,
        subcategory: canonical.subcategory,
        cluster: clusterId,
        questionText: localizedQuestion,
        answerType: canonical.answerType,
        periodDays: canonical.periodDays,
        threshold: canonical.threshold,
        problemWhen: canonical.problemWhen,
        adviceAboveThreshold: localizedAdvice,
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

// Seed the user's tracker list with a personalised pack derived from
// interview answers. Falls back to seedDefaultTrackers when the pack is
// empty (e.g. no meaningful interview signal). De-dupes by title.
const seedGeneratedTrackers = async (
  pack: GeneratedStarter[],
  t: TFn
): Promise<void> => {
  if (pack.length === 0) {
    await seedDefaultTrackers(t);
    return;
  }
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
    pack.forEach((meta, i) => {
      if (existingTitles.has(meta.title.trim().toLowerCase())) return;
      additions.push({
        id: `${Date.now()}-gen-${i}`,
        title: meta.title,
        category: meta.category,
        subcategory: meta.subcategory,
        questionText: meta.questionText,
        answerType: "boolean",
        periodDays: meta.periodDays,
        threshold: meta.threshold,
        problemWhen: meta.problemWhen,
        adviceAboveThreshold: meta.adviceAboveThreshold,
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
    console.error("seedGeneratedTrackers failed:", e);
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
      // Step flow:
      //   -1 = Language picker (only on first install)
      //   -2 = Welcome / mission intro (always shown after language is set)
      //    0 = About you (gender) — first counted interview step
      //  1-4 = Focus / Context / Goal / Stack reveal
      // Welcome step intentionally uses a negative number so the progress
      // dots (gated on `step >= 0`) skip it — it's an intro, not a
      // collected answer.
      setStep(hasExplicitLanguage() ? -2 : -1);
      setAnswers(readInterview());
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    track("onboarding_completed");
    document.body.style.overflow = "";
    onClose();
  }, [onClose]);

  // Update one or more answer fields and persist. Spreads the new patch
  // over the existing answers so we never lose previous selections when
  // the user advances through the interview.
  //
  // When `pol` changes we dispatch `memap-pol-changed` so anything that
  // caches the user's gender (e.g. the i18n polishRu post-processor)
  // can invalidate and re-render gender-correct copy on the next tick.
  const patchAnswers = useCallback((patch: Partial<InterviewAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      writeInterview(next);
      if (Object.prototype.hasOwnProperty.call(patch, "pol")) {
        try {
          window.dispatchEvent(new Event("memap-pol-changed"));
        } catch {
          // ignore — non-DOM environments
        }
      }
      return next;
    });
  }, []);

  // Skip-all safety net (top-right X). If the interview already has
  // meaningful signal (focus, context, or goal answers), seed a
  // personalised pack derived from those answers; otherwise fall back to
  // the universal-5 default seed. Either way, un-dismisses Ideas of the
  // Day and finishes. Reads fresh interview state from localStorage so
  // it picks up answers persisted by the in-flight component state.
  const skipSetup = useCallback(async () => {
    const fresh = readInterview();
    if (hasMeaningfulInterviewSignal(fresh)) {
      const pack = generateStarterPack(fresh, 5);
      await seedGeneratedTrackers(pack, t);
    } else {
      await seedDefaultTrackers(t);
    }
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
          {step === -1 && <LanguagePickerScreen onNext={() => setStep(-2)} />}
          {step === -2 && <WelcomeScreen onNext={() => setStep(0)} />}
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
              answers={answers}
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
              {/* Single-line label only — was showing native + EN
                  name as a subtitle, but for English they were
                  identical so it rendered as one line; for Russian
                  it was two ("Русский" + "Russian") which made the
                  buttons different heights. User flagged this as
                  visually broken. Drop the redundant transliteration
                  — users recognize their own language name. */}
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium">{lng.native}</div>
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

// --- Screen -2: Welcome / mission ------------------------------------
// Sits between Language pick and About-you. NOT counted in progress dots
// (those gate on step >= 0). Pure intro — names the product positioning
// in 5 sentences so the user knows what they signed up for before
// answering interview questions.

const WelcomeScreen = ({ onNext }: { onNext: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Brain className="h-6 w-6" strokeWidth={1.75} />
      </div>

      <h1 className="font-serif text-2xl font-medium text-center mb-2">
        {t("onboarding.welcome.title")}
      </h1>

      {/* Tagline-first layout (1.7.2): the slogan is the brand
          promise — putting it ABOVE the explanation gives it the
          weight it deserves. Was buried after a long body
          paragraph. body2 is reserved for future use, currently
          empty — render conditionally to avoid an empty <p>. */}
      <div className="space-y-3 max-w-[340px] mb-6 text-center">
        <p className="font-serif text-xl font-medium text-foreground leading-snug">
          {t("onboarding.welcome.tagline")}
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          {t("onboarding.welcome.body1")}
        </p>
        {t("onboarding.welcome.body2") && (
          <p className="text-sm text-foreground/80 leading-relaxed">
            {t("onboarding.welcome.body2")}
          </p>
        )}
      </div>

      <Button
        size="lg"
        onClick={onNext}
        data-onb-interactive
        className="rounded-full px-8 shadow-lg shadow-primary/20"
      >
        {t("onboarding.welcome.cta")}
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

      <div className="flex flex-wrap justify-center gap-2 mb-3">
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

      {/* Age question removed in 1.6 — was a +1 weak nudge in scoring,
          adding friction to onboarding for almost no tailoring value.
          The pol (gender) question stays because Russian verb gender
          actually depends on it (polishRu uses pol at display time). */}

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
  "environment",
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
  key: "kids" | "partner" | "expat";
  field: "hasKids" | "hasPartner" | "isExpat";
}

// Pets removed in 1.6 — the new template library has no pet-care
// templates (no "walked the dog", "fed the cat" etc), and the only
// pet-related template is "wanted-pet" in Big Decisions, which fits
// people WITHOUT pets. So asking "got pets?" was at best useless and
// at worst inverted the relevance. Removed to shorten the interview.
//
// Expat added in 1.7 — the expat cluster (20 templates about local
// language, paperwork, homesickness) is HARD-gated by this answer.
// Default = unset = hidden. Only people who flip it to Yes see those
// templates anywhere in the app (generator, AddTrackerModal). This
// is symmetric with how hasKids and hasPartner work as hard filters.
const CONTEXT_ROWS: ContextRow[] = [
  { key: "kids", field: "hasKids" },
  { key: "partner", field: "hasPartner" },
  { key: "expat", field: "isExpat" },
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

// --- Screen 4: Stack reveal -----------------------------------------
// Generates a personalised 5-card pack from interview answers and shows
// the user the chosen titles + questions before seeding. If interview is
// empty (user skipped everything), falls back to the universal-5 set so
// there's always something to show.

const StackRevealScreen = ({
  answers,
  onBack,
  onFinish,
}: {
  answers: InterviewAnswers;
  onBack: () => void;
  onFinish: () => void;
}) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);

  // Initial pack + whether we have a real (interview-driven) generator
  // available. If the interview produced no signal, we fall through to
  // the universal DEFAULT_STARTERS — those are fixed 5, so there's
  // nothing to regenerate, and the regenerate button is hidden in that
  // branch. Stable across the lifetime of this step (we don't want
  // re-running interview answers to swap the pack mid-review).
  const { initialPack, hasGenerator } = useMemo(() => {
    const generated = generateStarterPack(answers, 5);
    if (generated.length > 0) {
      return { initialPack: generated, hasGenerator: true };
    }
    const fallback: GeneratedStarter[] = DEFAULT_STARTERS.map((meta) => ({
      title: t(`onboarding.defaultStarters.${meta.titleKey}`),
      questionText: t(`onboarding.defaultStarters.${meta.questionKey}`),
      category: meta.category,
      periodDays: 30,
      threshold: 10,
      problemWhen: meta.problemWhen,
      adviceAboveThreshold: "",
    }));
    return { initialPack: fallback, hasGenerator: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pack is mutable now — × removes a card, "Сгенерировать другие"
  // refills empty slots with the next-best non-shown templates.
  const [currentPack, setCurrentPack] = useState<GeneratedStarter[]>(initialPack);
  // Titles ever shown (lowercase, trimmed). Passed to generateStarterPack
  // as excludeTitles so the regenerate flow can't bring the same card back.
  const [seenTitles, setSeenTitles] = useState<Set<string>>(
    () => new Set(initialPack.map((s) => s.title.toLowerCase().trim())),
  );
  // Cap regenerations so the user can't sit in onboarding forever. 3
  // regenerations × up to 5 new cards each = ~15 distinct templates seen,
  // which is more than enough to find ones that fit.
  const [regenerationCount, setRegenerationCount] = useState(0);
  // Set when the last regenerate call returned zero new cards (pool is
  // exhausted given the current excludes + diversity caps). Hides the
  // button so the user doesn't keep tapping a no-op.
  const [generatorExhausted, setGeneratorExhausted] = useState(false);
  const MAX_REGENERATIONS = 3;

  const removeAt = (index: number) => {
    setCurrentPack((prev) => prev.filter((_, i) => i !== index));
  };

  const regeneratePack = () => {
    if (!hasGenerator) return;
    if (regenerationCount >= MAX_REGENERATIONS) return;
    const needed = 5 - currentPack.length;
    if (needed <= 0) return;
    const newCards = generateStarterPack(answers, needed, Array.from(seenTitles));
    if (newCards.length === 0) {
      setGeneratorExhausted(true);
      return;
    }
    setCurrentPack((prev) => [...prev, ...newCards]);
    setSeenTitles((prev) => {
      const next = new Set(prev);
      newCards.forEach((c) => next.add(c.title.toLowerCase().trim()));
      return next;
    });
    setRegenerationCount((c) => c + 1);
  };

  const canRegenerate =
    hasGenerator &&
    !generatorExhausted &&
    currentPack.length < 5 &&
    regenerationCount < MAX_REGENERATIONS;

  const handleGo = async () => {
    if (creating) return;
    setCreating(true);
    try {
      if (currentPack.length > 0) {
        await seedGeneratedTrackers(currentPack, t);
      }
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
      <p className="text-sm text-muted-foreground text-center mb-5 max-w-[320px]">
        {t("onboarding.stackReveal.subtitle")}
      </p>

      <div className="w-full max-w-[360px] space-y-2 mb-5">
        {currentPack.map((row, i) => {
          const Icon = getTrackerIcon(row.title, row.category);
          const colorVar = getCategoryColor(row.category);
          return (
            <div
              key={row.title}
              className="rounded-2xl bg-muted/30 p-3 flex items-start gap-3 animate-fade-in"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `hsl(var(--${colorVar}) / 0.15)`,
                  color: `hsl(var(--${colorVar}-foreground, var(--foreground)))`,
                }}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-snug">
                  {row.title}
                </div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                  {row.questionText}
                </div>
              </div>
              {/* Remove this card before any of them get added. The
                  user gets full control over the starter pack — if a
                  suggestion doesn't fit, just × it. The regenerate
                  button below offers a replacement. */}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t("onboarding.stackReveal.removeCard")}
                className="shrink-0 -mt-1 -mr-1 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                data-onb-interactive
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
      {currentPack.length === 0 && (
        <p className="text-xs text-muted-foreground text-center mb-3 max-w-[300px]">
          {t("onboarding.stackReveal.allRemoved")}
        </p>
      )}

      {/* Regenerate button — appears whenever we have empty slots and
          there are still un-shown templates to suggest. Caps at 3
          regenerations so onboarding stays bounded. Hidden when the
          pool is exhausted or limit hit so the user isn't tempted to
          tap a no-op. The fallback path (no interview signal) doesn't
          have a generator to fall back on, so the button is hidden
          there too. */}
      {canRegenerate && (
        <Button
          variant="outline"
          size="sm"
          onClick={regeneratePack}
          data-onb-interactive
          className="rounded-full mb-3 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {t("onboarding.stackReveal.regenerate")}
        </Button>
      )}

      <Button
        size="lg"
        onClick={handleGo}
        disabled={creating}
        data-onb-interactive
        className="rounded-full px-8 shadow-lg shadow-primary/20 disabled:shadow-none"
      >
        {creating
          ? t("onboarding.stackReveal.preparing")
          : currentPack.length === 0
            ? t("onboarding.stackReveal.ctaSkip")
            : t("onboarding.stackReveal.ctaWithCount", {
                count: currentPack.length,
                defaultValue: t("onboarding.stackReveal.cta"),
              })}
        {!creating && <ArrowRight className="h-4 w-4 ml-1.5" />}
      </Button>

      {/* The most important card is the one YOU write. Templates are
          starter ideas — but the real value is in tracking what you
          personally keep noticing. We surface this prominently below
          the starter pack so users don't think the templates ARE the
          product. Examples are deliberately personal and specific
          (not generic "track your habits" filler). */}
      <div className="mt-6 mb-2 max-w-[360px] w-full px-4">
        <div className="text-[11px] text-center text-muted-foreground/80 leading-relaxed">
          <p className="font-medium text-foreground/70 mb-1.5">
            {t("onboarding.stackReveal.customHint")}
          </p>
          <p className="italic">
            {t("onboarding.stackReveal.customExamples")}
          </p>
        </div>
      </div>

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
