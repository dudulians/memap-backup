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
  // Unset theme. Since 1.8.0 new installs open in dark aurora, the
  // same look as the store page, Instagram and the mockups. People who
  // already finished onboarding before 1.8.0 and never picked a theme
  // keep the light one they've been seeing, so nobody's app flips
  // colour after an update.
  if (localStorage.getItem("memap_tour_seen") === "true") return "aurora-light";
  return "aurora";
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
