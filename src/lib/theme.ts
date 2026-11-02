export type AppTheme = "classic" | "aurora" | "aurora-light" | "liquid" | "terra" | "pop" | "hush";

const THEME_KEY = "memap_theme";

export const getTheme = (): AppTheme => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "classic") return "classic";
  if (stored === "aurora") return "aurora";
  if (stored === "liquid") return "liquid";
  if (stored === "terra") return "terra";
  if (stored === "pop") return "pop";
  if (stored === "hush") return "hush";
  if (stored === "aurora-light") return "aurora-light";
  // Unset theme: Aurora Light for everyone (her pick, Oct 31 2026: "возьмём
  // аврору лайт мою тему"). Dark Aurora stays one tap away in Settings.
  // Before this, a stored "aurora-light" wasn't read back at all, so
  // picking Light in Settings didn't stick for new-flow users.
  return "aurora-light";
};

// 1.8.0 offers only dark and light. Anyone who picked one of the five
// older themes keeps it, and Settings shows it as a third option, so
// trying dark or light isn't a one-way door. Remembered the first time
// it's read while still active.
const LEGACY_THEME_KEY = "memap_legacy_theme";
const LEGACY_THEMES: AppTheme[] = ["classic", "liquid", "terra", "pop", "hush"];

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

/** Night or day on the new screens: dark Aurora with her night pack, or Aurora Light. */
export const isNight = (): boolean => getTheme() === "aurora";
export const toggleNight = (): void => setTheme(isNight() ? "aurora-light" : "aurora");

export const setTheme = (theme: AppTheme): void => {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event("memap-theme-changed"));
  trackThemeChange(theme);
};
