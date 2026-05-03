import { Moon, Rss, Sun } from "lucide-react";
import { type CSSProperties, lazy, Suspense, useEffect, useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { Button } from "@/components/ui/button";
import { parseApiError, parseSearchResult } from "@/lib/schemas";
import type { SearchResult } from "../shared/types";

// Lazy load the ResultDisplay component to reduce initial bundle size
const ResultDisplay = lazy(() =>
  import("@/components/ResultDisplay").then((module) => ({
    default: module.ResultDisplay,
  })),
);

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "feed-finder-theme";

const themeVariables: Record<Theme, Record<string, string>> = {
  light: {
    "--app-bg": "#f8fafc",
    "--app-text": "#020617",
    "--app-muted": "#475569",
    "--app-placeholder": "#94a3b8",
    "--app-border": "rgb(226 232 240 / 0.85)",
    "--app-header-bg": "rgb(255 255 255 / 0.82)",
    "--app-surface": "rgb(255 255 255 / 0.92)",
    "--app-surface-solid": "#ffffff",
    "--app-control-bg": "rgb(255 255 255 / 0.92)",
    "--app-control-hover": "#f1f5f9",
    "--app-input-bg": "rgb(248 250 252 / 0.85)",
    "--app-input-border": "#e2e8f0",
    "--app-input-shadow": "rgb(226 232 240 / 0.6)",
    "--app-code-bg": "#f8fafc",
    "--app-card-shadow": "rgb(226 232 240 / 0.6)",
    "--app-button-bg": "#0d9488",
    "--app-button-hover": "#0f766e",
    "--app-button-text": "#ffffff",
    "--app-button-shadow": "rgb(13 148 136 / 0.2)",
    "--app-accent": "#0f766e",
    "--app-accent-soft": "#f0fdfa",
    "--app-accent-border": "#99f6e4",
    "--app-focus": "#14b8a6",
    "--app-focus-soft": "rgb(20 184 166 / 0.2)",
    "--app-hero-glow":
      "radial-gradient(circle at 50% 0%, rgb(20 184 166 / 0.18), transparent 58%)",
  },
  dark: {
    "--app-bg": "#0b1118",
    "--app-text": "#ffffff",
    "--app-muted": "#cbd5e1",
    "--app-placeholder": "#64748b",
    "--app-border": "rgb(255 255 255 / 0.1)",
    "--app-header-bg": "rgb(11 17 24 / 0.82)",
    "--app-surface": "rgb(255 255 255 / 0.06)",
    "--app-surface-solid": "#111c27",
    "--app-control-bg": "rgb(255 255 255 / 0.05)",
    "--app-control-hover": "rgb(255 255 255 / 0.1)",
    "--app-input-bg": "#0d1823",
    "--app-input-border": "rgb(255 255 255 / 0.1)",
    "--app-input-shadow": "transparent",
    "--app-code-bg": "#0b1118",
    "--app-card-shadow": "rgb(0 0 0 / 0.2)",
    "--app-button-bg": "#0ea5e9",
    "--app-button-hover": "#38bdf8",
    "--app-button-text": "#020617",
    "--app-button-shadow": "rgb(14 165 233 / 0.2)",
    "--app-accent": "#7dd3fc",
    "--app-accent-soft": "rgb(56 189 248 / 0.1)",
    "--app-accent-border": "rgb(56 189 248 / 0.35)",
    "--app-focus": "#38bdf8",
    "--app-focus-soft": "rgb(56 189 248 / 0.2)",
    "--app-hero-glow":
      "radial-gradient(circle at 50% 0%, rgb(56 189 248 / 0.2), transparent 58%)",
  },
};

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const isDark = theme === "dark";

    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    for (const [name, value] of Object.entries(themeVariables[theme])) {
      document.documentElement.style.setProperty(name, value);
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      const response = await fetch("/api/search-feeds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        setError(parseApiError(data));
        return;
      }

      const validatedResult = parseSearchResult(data);
      setSearchResult(validatedResult);
    } catch {
      setError(
        "An error occurred while searching for feeds. Please try again later.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="app-shell relative flex min-h-screen flex-col overflow-hidden transition-colors duration-300"
      style={
        {
          ...themeVariables[theme],
          backgroundColor: "var(--app-bg)",
          color: "var(--app-text)",
        } as CSSProperties
      }
    >
      <div
        className="app-hero-glow pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{ backgroundImage: "var(--app-hero-glow)" }}
      />
      <div className="layout-container relative flex h-full grow flex-col">
        <header
          className="app-header flex items-center justify-between whitespace-nowrap border-b px-5 py-3 backdrop-blur-xl sm:px-10"
          style={{
            backgroundColor: "var(--app-header-bg)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="app-accent-box flex size-9 items-center justify-center rounded-lg border shadow-sm"
              style={{
                backgroundColor: "var(--app-accent-soft)",
                borderColor: "var(--app-accent-border)",
                color: "var(--app-accent)",
              }}
            >
              <Rss className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-normal">
              FeedFinder
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="app-control size-10 rounded-lg border shadow-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--app-control-bg)",
              borderColor: "var(--app-border)",
              color: "var(--app-muted)",
            }}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            aria-pressed={theme === "dark"}
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark" ? "light" : "dark",
              )
            }
          >
            {theme === "dark" ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </Button>
        </header>
        <main className="flex flex-1 justify-center px-5 py-10 sm:px-10 lg:px-40">
          <div className="layout-content-container flex max-w-[960px] flex-1 flex-col space-y-8">
            <section className="mx-auto max-w-3xl text-center">
              <p
                className="app-accent-text mb-3 text-sm font-medium"
                style={{ color: "var(--app-accent)" }}
              >
                Discover publishable feeds faster
              </p>
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
                RSS / Atom Feed Discovery
              </h1>
              <p
                className="app-muted mx-auto mt-4 max-w-2xl text-base leading-7"
                style={{ color: "var(--app-muted)" }}
              >
                Enter a website URL to automatically discover its RSS and Atom
                feeds
              </p>
            </section>

            <section>
              <SearchForm
                onSubmit={handleSearch}
                isLoading={isLoading}
                error={error}
              />
            </section>

            <Suspense
              fallback={
                <div
                  className="app-muted text-center"
                  style={{ color: "var(--app-muted)" }}
                  role="status"
                  aria-live="polite"
                >
                  Loading...
                </div>
              }
            >
              <ResultDisplay result={searchResult} error={error} />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
