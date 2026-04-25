import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "@/locales/en";
import ru from "@/locales/ru";
import { polishRu, getPol } from "./genderPolish";

// Two separate keys on purpose:
//   LANGUAGE_KEY       — mirror of the active i18next language (may be
//                        auto-written by changeLanguage/detector). We don't
//                        treat its presence as "user chose a language".
//   EXPLICIT_KEY       — written ONLY by our setLanguage() when the user
//                        taps a language button. This is what the onboarding
//                        uses to decide whether to show the language picker.
export const LANGUAGE_KEY = "memap_language";
export const EXPLICIT_LANGUAGE_KEY = "memap_language_chosen";

export type SupportedLanguage = "en" | "ru";

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; native: string }[] = [
  { code: "en", name: "English", native: "English" },
  { code: "ru", name: "Russian", native: "Русский" },
];

const detector = new LanguageDetector();
detector.addDetector({
  name: "memapStorage",
  lookup() {
    try {
      const stored = localStorage.getItem(LANGUAGE_KEY);
      if (stored === "en" || stored === "ru") return stored;
    } catch {
      // ignore
    }
    return undefined;
  },
  cacheUserLanguage(lng: string) {
    try {
      localStorage.setItem(LANGUAGE_KEY, lng);
    } catch {
      // ignore
    }
  },
});

// Post-processor: resolves the bracketed gender suffixes used in Russian
// source strings (e.g. "сделал(а)") according to the user's `pol`
// answer captured during onboarding. English strings and Russian
// strings without brackets pass through untouched. See
// `src/lib/genderPolish.ts` for the full rules.
const polishRuPostProcessor = {
  type: "postProcessor" as const,
  name: "polishRu",
  process(value: string, _key: string | string[], _options: unknown, translator: { language?: string }): string {
    if (typeof value !== "string") return value;
    const lang = translator?.language || i18n.language;
    if (typeof lang === "string" && lang.startsWith("ru")) {
      return polishRu(value, getPol());
    }
    return value;
  },
};

void i18n
  .use(detector)
  .use(initReactI18next)
  .use(polishRuPostProcessor)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "ru"],
    interpolation: { escapeValue: false },
    // Run polishRu after every t() lookup. It's a no-op for non-RU
    // languages and for strings without bracket patterns.
    postProcess: ["polishRu"],
    detection: {
      order: ["memapStorage", "navigator"],
      // No auto-cache on detection. We only want LANGUAGE_KEY + EXPLICIT_LANGUAGE_KEY
      // written when the user explicitly picks via setLanguage().
      caches: [],
    },
    returnNull: false,
  });

export const getLanguage = (): SupportedLanguage => {
  const lng = (i18n.language || "en").slice(0, 2);
  return lng === "ru" ? "ru" : "en";
};

export const setLanguage = (lng: SupportedLanguage): void => {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(LANGUAGE_KEY, lng);
    localStorage.setItem(EXPLICIT_LANGUAGE_KEY, "1");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("memap-language-changed"));
};

/**
 * True only once the user has explicitly picked a language via our UI.
 * Presence of LANGUAGE_KEY alone is NOT enough — the detector may have
 * written it from navigator language on first run.
 */
export const hasExplicitLanguage = (): boolean => {
  try {
    return localStorage.getItem(EXPLICIT_LANGUAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export default i18n;
