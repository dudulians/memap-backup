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

// Russia's time zones (IANA), to tell a phone in Russia from a Russian-language
// phone elsewhere.
const RU_ZONES = new Set([
  "Europe/Moscow", "Europe/Kaliningrad", "Europe/Samara", "Europe/Volgograd", "Europe/Kirov", "Europe/Astrakhan",
  "Europe/Saratov", "Europe/Ulyanovsk", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk", "Asia/Barnaul",
  "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk", "Asia/Khandyga",
  "Asia/Vladivostok", "Asia/Ust-Nera", "Asia/Magadan", "Asia/Sakhalin", "Asia/Srednekolymsk", "Asia/Kamchatka", "Asia/Anadyr",
]);
/** The phone looks like it is in Russia: a region RU in its locales, or a Russian time zone. */
export const phoneInRussia = (): boolean => {
  try {
    const locales = [...(navigator.languages ?? []), navigator.language, Intl.DateTimeFormat().resolvedOptions().locale].filter(Boolean);
    if (locales.some((l) => /[-_]RU\b/i.test(l))) return true;
    return RU_ZONES.has(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return false;
  }
};
/** Someone who already used the app keeps the old rule (the phone's language), so
 *  nobody's language flips after an update. */
const hasHistory = (): boolean => {
  try {
    const t = localStorage.getItem("memap_trackers");
    return !!t && t !== "[]";
  } catch {
    return false;
  }
};
// First language for a new install (her note, Nov 6 2026): English everywhere, except
// a Russian-language phone in Russia. Other languages are behind the globe button.
detector.addDetector({
  name: "memapRegion",
  lookup() {
    try {
      const ru = (navigator.language || "").toLowerCase().startsWith("ru");
      if (hasHistory()) return ru ? "ru" : "en";
      return ru && phoneInRussia() ? "ru" : "en";
    } catch {
      return "en";
    }
  },
  cacheUserLanguage() {},
});
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
      order: ["memapStorage", "memapRegion"],
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
