import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Malu } from "./mw/Malu";
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
import { DoorPickerScreen, DoorFlow, OwnFlow, CuriousFlow, PickResult, Finish } from "./DoorOnboarding";

const TOUR_SEEN_KEY = "memap_tour_seen";
const INTERVIEW_KEY = "memap_interview";

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

// 1.8.0: language (first install only) → doors, then one of three short
// paths (DoorOnboarding.tsx). The five-screen interview (gender, focus,
// context, goal, starter pack) and the coach tour after it are gone.
type Step = "language" | "doors" | "door" | "own" | "curious";

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const [step, setStep] = useState<Step>(() => (hasExplicitLanguage() ? "doors" : "language"));
  const [doors, setDoors] = useState<Door[]>([]);

  useEffect(() => {
    if (open) {
      setStep(hasExplicitLanguage() ? "doors" : "language");
      setDoors([]);
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

  const onPick = (r: PickResult) => {
    if (r.kind === "own") return setStep("own");
    if (r.kind === "curious") return setStep("curious");
    setDoors(r.ids.map((id) => getDoor(id)).filter((d): d is Door => !!d));
    setStep("door");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-background mw-room">
      <div className="relative z-10 h-full w-full overflow-y-auto">
        {step === "language" && (
          <div className="min-h-full flex items-center justify-center px-5 py-8">
            <LanguagePickerScreen onNext={() => setStep("doors")} />
          </div>
        )}
        {step === "doors" && <DoorPickerScreen onPick={onPick} />}
        {step === "door" && doors.length > 0 && (
          <DoorFlow doors={doors} onBack={() => setStep("doors")} onFinish={finish} />
        )}
        {step === "own" && <OwnFlow onBack={() => setStep("doors")} onFinish={finish} />}
        {step === "curious" && <CuriousFlow onBack={() => setStep("doors")} onFinish={finish} />}
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
      <Malu pose="wave" size={150} bob className="-mb-3" />
      <h1 className="mw-display text-[30px] text-center mb-6">{t("language.title")}</h1>
      <div className="w-full max-w-[320px] space-y-3 mb-8">
        {SUPPORTED_LANGUAGES.map((lng) => {
          const isSelected = picked === lng.code;
          return (
            <button
              key={lng.code}
              onClick={() => handlePick(lng.code)}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              aria-pressed={isSelected}
              className="mw-choice min-h-[64px]"
            >
              <div className="flex-1 min-w-0">{lng.native}</div>
              {isSelected && <Check className="h-6 w-6 shrink-0" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          setLanguage(picked);
          onNext();
        }}
        data-onb-interactive
        className="mw-btn w-full max-w-[320px]"
      >
        {t("common.next")}
      </button>
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
