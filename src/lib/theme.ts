import { Result } from "neverthrow";

export const THEME_STORAGE_KEY = "feed-finder-theme";

export const THEME_COLORS = {
  light: "#f8fafc",
  dark: "#0b1118",
} as const;

export type Theme = keyof typeof THEME_COLORS;

const safeGetStoredTheme = Result.fromThrowable(
  () => window.localStorage.getItem(THEME_STORAGE_KEY),
  () => null,
);

const safeSetStoredTheme = Result.fromThrowable(
  (theme: Theme) => window.localStorage.setItem(THEME_STORAGE_KEY, theme),
  () => undefined,
);

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedThemeResult = safeGetStoredTheme();
  const storedTheme = storedThemeResult.isOk() ? storedThemeResult.value : null;
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  if (typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset["theme"] = theme;
  root.style.colorScheme = theme;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);

  safeSetStoredTheme(theme);
}
