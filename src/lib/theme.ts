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
  return "aurora-light"; // default for new & unset users
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
