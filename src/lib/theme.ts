export type AppTheme = "classic" | "aurora" | "aurora-light";

const THEME_KEY = "memap_theme";

export const getTheme = (): AppTheme => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "classic") return "classic";
  if (stored === "aurora") return "aurora";
  return "aurora-light"; // default for new & unset users
};

export const applyTheme = (theme: AppTheme): void => {
  document.documentElement.setAttribute("data-theme", theme);
};

export const setTheme = (theme: AppTheme): void => {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event("memap-theme-changed"));
};
