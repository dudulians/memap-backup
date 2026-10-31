import { getUiMode } from "./uiMode";

export type AppTheme =
  | "classic" | "aurora" | "aurora-light" | "liquid" | "terra" | "pop" | "hush"
  | "malu" | "malu-night";

const THEME_KEY = "memap_theme";
const LEGACY_THEMES: AppTheme[] = ["classic", "liquid", "terra", "pop", "hush"];

export const getTheme = (): AppTheme => {
  const stored = localStorage.getItem(THEME_KEY);
  // Malu's world (1.9): the new screens have their own day and night.
  // 1.8.0 wrote "aurora" for every new install (it was the default, not
  // a choice), so both 1.8.0 looks map to the day notebook; only an
  // explicit "malu-night" opens on navy. The five older themes stay as
  // they are (Settings offers them as a third option).
  if (getUiMode() === "new") {
    if (stored === "malu-night") return "malu-night";
    if (stored === "malu" || stored === "aurora-light" || stored === "aurora") return "malu";
    if (stored && (LEGACY_THEMES as string[]).includes(stored)) return stored as AppTheme;
    return "malu";
  }
  if (stored === "classic") return "classic";
  if (stored === "aurora") return "aurora";
  if (stored === "liquid") return "liquid";
  if (stored === "terra") return "terra";
  if (stored === "pop") return "pop";
  if (stored === "hush") return "hush";
  // Unset theme. Since 1.8.0 new installs open in dark aurora, the
  // same look as the store page, Instagram and the mockups. People who
  // already finished onboarding before 1.8.0 and never picked a theme
  // keep the light one they've been seeing, so nobody's app flips
  // colour after an update.
  if (localStorage.getItem("memap_tour_seen") === "true") return "aurora-light";
  return "aurora";
};

// 1.8.0 offers only dark and light. Anyone who picked one of the five
// older themes keeps it, and Settings shows it as a third option, so
// trying dark or light isn't a one-way door. Remembered the first time
// it's read while still active.
const LEGACY_THEME_KEY = "memap_legacy_theme";

export const getLegacyTheme = (): AppTheme | null => {
  try {
    const current = getTheme();
    if (LEGACY_THEMES.includes(current)) {
      localStorage.setItem(LEGACY_THEME_KEY, current);
      return current;
    }
    const saved = localStorage.getItem(LEGACY_THEME_KEY) as AppTheme | null;
    return saved && LEGACY_THEMES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

// Called when onboarding finishes. Freezes the default for this
// install so getTheme() stops depending on the tour flag.
export const persistDefaultTheme = (): void => {
  if (localStorage.getItem(THEME_KEY)) return;
  localStorage.setItem(THEME_KEY, getTheme());
};

// Internal: track theme switches for product analytics. Defined as a
// dynamic import so this file stays free of analytics dependency
// for any future test harness.
const trackThemeChange = (to: AppTheme): void => {
  void import("./analytics")
    .then((m) => {
      m.track("theme_changed", { to });
      m.setUserProperty("theme", to);
    })
    .catch(() => {
      /* analytics module load failure — ignore, theme still applied */
    });
};

export const applyTheme = (theme: AppTheme): void => {
  document.documentElement.setAttribute("data-theme", theme);
};

export const setTheme = (theme: AppTheme): void => {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event("memap-theme-changed"));
  trackThemeChange(theme);
};
