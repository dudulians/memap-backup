import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasExplicitLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  EXPLICIT_LANGUAGE_KEY,
} from "@/lib/i18n";
import { track } from "@/lib/analytics";
import {
  requestNotificationPermissionDetailed,
  getNotificationSettings,
  saveNotificationSettings,
  scheduleNotification,
} from "@/lib/notifications";
import { persistDefaultTheme } from "@/lib/theme";
import { getDoor, Door } from "@/lib/doors";
import { markOnboarded } from "@/lib/pathSteps";
import type { Finish } from "./DoorOnboarding";
import { OwnV7, QuestionsV7, TopicV7, ValueV7, WelcomeV7, type V7Pick, type V7Setup } from "./OnboardingV7";
import { isoLocal } from "@/lib/doors";

const TOUR_SEEN_KEY = "memap_tour_seen";
const INTERVIEW_KEY = "memap_interview";

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

// Onboarding v2 (Nov 5 2026, boards 49/50): one line with the language in a corner →
// "something keeps happening" or "I want more good days" (or just looking) → the list →
// the promise in her words, her first island from a cloud → the first answer and that
// day's questions (DoorOnboarding) → the first light → who sails with her → Today.
// v7 (Nov 6 2026, boards 70–75): welcome → one topic (or your own, or start simple) →
// your daily questions → what you'll discover → the first real check-in on Today.
type Step = "welcome" | "topic" | "own" | "questions" | "value";

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const [step, setStep] = useState<Step>("welcome");
  // where people stop in onboarding (2.0 funnel)
  useEffect(() => { track("onboarding_screen", { screen: String(step) }); }, [step]);
  const [pick, setPick] = useState<V7Pick | null>(null);
  const [setup, setSetup] = useState<V7Setup | null>(null);

  useEffect(() => {
    if (open) {
      setStep("welcome");
      setPick(null);
      setSetup(null);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Every path ends here. The coach tour and "Ideas of the day" are off
  // for everyone now. `reminders: false` = the reminder was switched off
  // on the last screen, so no permission prompt.
  const finish = useCallback<Finish>(({ path, reminders }) => {
    persistDefaultTheme();
    try {
      localStorage.setItem("memap_coachmark_seen", "true");
      localStorage.setItem("memap_ideas_dismissed", "true");
    } catch {
      // ignore
    }
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    // what onboarding made is today's own set; questions added later are "New questions"
    markOnboarded();
    track("onboarding_completed", { path });
    document.body.style.overflow = "";
    if (!reminders) {
      onClose();
      return;
    }
    // The moment of highest intent for the iOS permission prompt. On
    // denial we skip quietly; Settings still has the switch. Fire and
    // forget so onboarding closes even while the dialog is up.
    requestNotificationPermissionDetailed()
      .then((result) => {
        if (!result.granted) return;
        const next = { ...getNotificationSettings(), enabled: true };
        saveNotificationSettings(next);
        return scheduleNotification(next);
      })
      .catch(() => {
        // Best-effort — notification setup must never block onboarding.
      });
    onClose();
  }, [onClose]);

  // the first real check-in happens on Today's own cards, right after onboarding closes
  const start = (day: "today" | "yesterday" | "tonight") => {
    if (!setup) return;
    try { localStorage.setItem("memap_first_day_pick", day); localStorage.setItem("memap_first_day_at", isoLocal(new Date())); } catch { /* ignore */ }
    finish({ path: pick?.kind === "own" ? "own" : pick?.kind === "simple" ? "curious" : "door", reminders: false });
    window.setTimeout(() => {
      if (day === "tonight") { window.dispatchEvent(new Event("memap-world-waiting")); return; }
      const d = new Date(); if (day === "yesterday") d.setDate(d.getDate() - 1);
      window.dispatchEvent(new CustomEvent("memap-first-checkin", { detail: { date: isoLocal(d), ids: setup.ids } }));
    }, 350);
  };

  if (!open) return null;

  return (
    <div className="onb fixed inset-0 z-[100] overflow-hidden bg-background">
      <div className="relative z-10 h-full w-full overflow-y-auto">
        {step === "welcome" && <WelcomeV7 onStart={() => setStep("topic")} onSimple={() => { setPick({ kind: "simple" }); setStep("questions"); }} />}
        {step === "topic" && <TopicV7 initial={pick?.kind === "door" ? pick.id : null} onBack={() => setStep("welcome")} onOwn={() => setStep("own")} onPick={(id) => { setPick({ kind: "door", id }); setStep("questions"); }} />}
        {step === "own" && <OwnV7 onBack={() => setStep("topic")} onDone={(text) => { setPick({ kind: "own", text }); setStep("questions"); }} />}
        {step === "questions" && pick && <QuestionsV7 key={JSON.stringify(pick)} pick={pick} onBack={() => setStep(pick.kind === "simple" ? "welcome" : pick.kind === "own" ? "own" : "topic")} onDone={(s) => { setSetup(s); setStep("value"); }} />}
        {step === "value" && setup && pick && <ValueV7 setup={setup} pickKind={pick.kind} onBack={() => setStep("questions")} onStart={start} />}
      </div>
    </div>
  );
};

// --- Language picker (first install only) -----------------------------

const LanguagePickerScreen = ({ onNext }: { onNext: () => void }) => {
  const { t, i18n } = useTranslation();
  const current = (i18n.language || "en").slice(0, 2) as SupportedLanguage;
  const [picked, setPicked] = useState<SupportedLanguage>(current === "ru" ? "ru" : "en");

  const handlePick = (lng: SupportedLanguage) => {
    setPicked(lng);
    setLanguage(lng);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Languages className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-bold text-center mb-5">{t("language.title")}</h1>
      <div className="w-full max-w-[320px] space-y-2.5 mb-6">
        {SUPPORTED_LANGUAGES.map((lng) => {
          const isSelected = picked === lng.code;
          return (
            <button
              key={lng.code}
              onClick={() => handlePick(lng.code)}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-full text-left rounded-2xl px-4 py-4 flex items-center gap-3 transition-all border",
                isSelected ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-card border-border/50 hover:border-border",
              )}
            >
              <div className="flex-1 min-w-0 text-lg font-medium">{lng.native}</div>
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
        onClick={() => {
          setLanguage(picked);
          onNext();
        }}
        data-onb-interactive
        className="rounded-full px-8 h-[52px] text-[17px] shadow-lg shadow-primary/20"
      >
        {t("common.next")}
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
};

// --- Exports --------------------------------------------------------

export const shouldShowTour = (): boolean => {
  return localStorage.getItem(TOUR_SEEN_KEY) !== "true";
};

export const resetTourSeen = () => {
  // Freeze the current theme first: an unset theme depends on the tour
  // flag (see getTheme), and replaying the tour must not recolour the app.
  persistDefaultTheme();
  localStorage.removeItem(TOUR_SEEN_KEY);
  // Also forget the explicit-language flag so a replayed tour starts from
  // the language picker, same as a brand-new install. The active language
  // itself (LANGUAGE_KEY) stays — we don't want to yank the UI into English
  // while the user is reading their own Settings page in Russian.
  localStorage.removeItem(EXPLICIT_LANGUAGE_KEY);
  // Old interview answers (focus, kids, partner…) are no longer collected.
  // Keep only `pol`, which Russian copy still uses.
  try {
    const pol = JSON.parse(localStorage.getItem(INTERVIEW_KEY) || "{}")?.pol;
    if (pol) localStorage.setItem(INTERVIEW_KEY, JSON.stringify({ pol }));
    else localStorage.removeItem(INTERVIEW_KEY);
  } catch {
    localStorage.removeItem(INTERVIEW_KEY);
  }
};
