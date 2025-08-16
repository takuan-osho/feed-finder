import { lazy, Suspense, useState } from "react";
import type { SearchResult } from "@/components/ResultDisplay";
import { SearchForm } from "@/components/SearchForm";

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

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "フィード検索中にエラーが発生しました");
        return;
      }

      setSearchResult(data);
    } catch {
      setError(
        "フィード検索中にエラーが発生しました。しばらく後にもう一度お試しください。",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#101a23] text-white">
      <div className="layout-container flex h-full grow flex-col">
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#223649] px-10 py-3">
          <div className="flex items-center gap-4 text-white">
            <div className="size-4">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z"
                  fill="currentColor"
                ></path>
              </svg>
            </div>
            <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
              FeedFinder
            </h2>
          </div>
          <nav className="flex flex-1 justify-end gap-8">
            <ul className="flex items-center gap-9">
              <li>
                <a
                  className="text-white text-sm font-medium leading-normal"
                  href="#"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  className="text-white text-sm font-medium leading-normal"
                  href="#"
                >
                  About
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <main className="px-10 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1 space-y-8">
            <section className="text-center">
              <h1 className="text-white tracking-light text-[28px] font-bold leading-tight">
                RSS・Atomフィード検索
              </h1>
              <p className="text-[#90aecb] mt-2 text-base">
                ウェブサイトのURLを入力して、RSSやAtomフィードを自動検索します
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
                  className="text-center text-[#90aecb]"
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
