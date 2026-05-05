"use client";

import { CheckCircle, Copy, ExternalLink, Info, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FeedResult, SearchResult } from "../../shared/types";

interface ResultDisplayProps {
  result: SearchResult | null;
  error?: string | null;
}

export function ResultDisplay({ result, error }: ResultDisplayProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const resultId = useId();

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleOpenFeed = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (error) {
    return (
      <Alert
        variant="destructive"
        className="mx-auto max-w-3xl border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100"
        role="alert"
        aria-live="assertive"
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="text-red-800 dark:text-red-100">
          <strong>An error occurred:</strong> {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return null;
  }

  if (!result.success || result.feeds.length === 0) {
    return (
      <Alert
        className="app-surface app-muted mx-auto max-w-3xl border shadow-lg"
        role="status"
        aria-live="polite"
      >
        <Info className="app-accent-text h-4 w-4" aria-hidden="true" />
        <AlertDescription className="app-muted">
          <strong>No feeds were found</strong>
          <br />
          Could not discover any RSS / Atom feeds for {result.searchedUrl}.
          {result.message && (
            <>
              <br />
              {result.message}
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-3xl space-y-4"
      data-testid="result-display"
      aria-label="Search results"
    >
      <header>
        <Alert
          className="border-emerald-200 bg-emerald-50 text-emerald-950 shadow-lg shadow-emerald-100/60 dark:border-emerald-400/25 dark:bg-emerald-950/35 dark:text-emerald-100 dark:shadow-black/20"
          role="status"
          aria-live="polite"
        >
          <CheckCircle
            className="h-4 w-4 text-emerald-600 dark:text-emerald-300"
            aria-hidden="true"
          />
          <AlertDescription className="text-emerald-900 dark:text-emerald-100">
            <strong>Found {result.totalFound} feed(s)</strong>
            <br />
            Searched: {result.searchedUrl}
          </AlertDescription>
        </Alert>
      </header>

      <ul className="space-y-3" role="list">
        {result.feeds.map((feed, index) => (
          <li key={`${feed.url}-${index}`} role="listitem">
            <FeedCard
              feed={feed}
              titleId={`${resultId}-feed-${index}-title`}
              onCopyUrl={handleCopyUrl}
              onOpenFeed={handleOpenFeed}
              copiedUrl={copiedUrl}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface FeedCardProps {
  feed: FeedResult;
  titleId: string;
  onCopyUrl: (url: string) => void;
  onOpenFeed: (url: string) => void;
  copiedUrl: string | null;
}

function FeedCard({
  feed,
  titleId,
  onCopyUrl,
  onOpenFeed,
  copiedUrl,
}: FeedCardProps) {
  const isUrlCopied = copiedUrl === feed.url;
  const discoveryMethodText =
    feed.discoveryMethod === "meta-tag"
      ? "Discovered via HTML meta tag"
      : "Discovered via common path";

  return (
    <article
      className="app-surface rounded-lg border shadow-lg transition-colors duration-200 hover:border-[var(--app-accent-border)]"
      aria-labelledby={titleId}
    >
      <header className="p-6 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3
              id={titleId}
              className="app-text truncate text-lg font-semibold leading-tight"
            >
              {feed.title || feed.url}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  feed.type === "RSS"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
                aria-label={`Feed type: ${feed.type}`}
              >
                {feed.type}
              </span>
              <span
                className="app-muted text-xs"
                aria-label={`Discovery method: ${discoveryMethodText}`}
              >
                {discoveryMethodText}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 pb-6">
        {feed.description && (
          <p className="app-muted mb-3 line-clamp-2 text-sm leading-6">
            {feed.description}
          </p>
        )}

        <div className="space-y-2">
          <div className="app-code-block rounded border p-3">
            <code className="app-muted break-all text-xs">{feed.url}</code>
          </div>

          <div
            className="grid gap-2 sm:grid-cols-2"
            role="group"
            aria-label="Feed actions"
          >
            <Button
              type="button"
              onClick={() => onOpenFeed(feed.url)}
              variant="outline"
              size="sm"
              className="app-control border focus:outline-none focus:ring-2 focus:ring-offset-2"
              aria-label={`Open the feed for ${feed.title || feed.url} in a new tab`}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open feed
            </Button>

            <Button
              type="button"
              onClick={() => onCopyUrl(feed.url)}
              variant="outline"
              size="sm"
              className={`transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isUrlCopied
                  ? "border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-900/60 dark:text-emerald-100 dark:hover:bg-emerald-800/70"
                  : "app-control border"
              }`}
              aria-label={`Copy the URL of ${feed.title || feed.url} to the clipboard`}
            >
              {isUrlCopied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
