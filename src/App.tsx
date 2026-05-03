import { Moon, Rss, Sun } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { Button } from "@/components/ui/button";
import { parseApiError, parseSearchResult } from "@/lib/schemas";
import { applyTheme, getInitialTheme, type Theme } from "@/lib/theme";
import type { SearchResult } from "../shared/types";

// Lazy load the ResultDisplay component to reduce initial bundle size
const ResultDisplay = lazy(() =>
  import("@/components/ResultDisplay").then((module) => ({
    default: module.ResultDisplay,
  })),
);

function App() {
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
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
    <div className="app-shell relative flex min-h-screen flex-col overflow-hidden transition-colors duration-300">
      <div className="app-hero-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
      <div className="layout-container relative flex h-full grow flex-col">
        <header className="app-header flex items-center justify-between whitespace-nowrap border-b px-5 py-3 backdrop-blur-xl sm:px-10">
          <div className="flex items-center gap-3">
            <div className="app-accent-box flex size-9 items-center justify-center rounded-lg border shadow-sm">
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
              <p className="app-accent-text mb-3 text-sm font-medium">
                Discover publishable feeds faster
              </p>
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
                RSS / Atom Feed Discovery
              </h1>
              <p className="app-muted mx-auto mt-4 max-w-2xl text-base leading-7">
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
