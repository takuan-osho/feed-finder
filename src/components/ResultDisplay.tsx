"use client";

import { CheckCircle, Copy, ExternalLink, Info, XCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface FeedResult {
  url: string;
  title?: string;
  type: "RSS" | "Atom";
  description?: string;
  discoveryMethod: "meta-tag" | "common-path";
}

export interface SearchResult {
  success: boolean;
  feeds: FeedResult[];
  searchedUrl: string;
  totalFound: number;
  message?: string;
}

interface ResultDisplayProps {
  result: SearchResult | null;
  error?: string | null;
}

export function ResultDisplay({ result, error }: ResultDisplayProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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
        className="bg-red-950 border-red-800 max-w-2xl mx-auto"
        role="alert"
        aria-live="assertive"
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="text-red-200">
          <strong>エラーが発生しました:</strong> {error}
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
        className="bg-[#182734] border-[#314d68] max-w-2xl mx-auto"
        role="status"
        aria-live="polite"
      >
        <Info className="h-4 w-4 text-[#90aecb]" aria-hidden="true" />
        <AlertDescription className="text-[#90aecb]">
          <strong>フィードが見つかりませんでした</strong>
          <br />
          {result.searchedUrl} からRSS/Atomフィードを発見できませんでした。
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
      className="w-full max-w-2xl mx-auto space-y-4"
      data-testid="result-display"
      aria-label="検索結果"
    >
      <header>
        <Alert
          className="bg-green-950 border-green-800"
          role="status"
          aria-live="polite"
        >
          <CheckCircle className="h-4 w-4 text-green-400" aria-hidden="true" />
          <AlertDescription className="text-green-200">
            <strong>{result.totalFound}個のフィードが見つかりました</strong>
            <br />
            検索対象: {result.searchedUrl}
          </AlertDescription>
        </Alert>
      </header>

      <ul className="space-y-3" role="list">
        {result.feeds.map((feed, index) => (
          <li key={`${feed.url}-${index}`} role="listitem">
            <FeedCard
              feed={feed}
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
  onCopyUrl: (url: string) => void;
  onOpenFeed: (url: string) => void;
  copiedUrl: string | null;
}

function FeedCard({ feed, onCopyUrl, onOpenFeed, copiedUrl }: FeedCardProps) {
  const isUrlCopied = copiedUrl === feed.url;
  const discoveryMethodText =
    feed.discoveryMethod === "meta-tag"
      ? "HTML メタタグから発見"
      : "一般的なパスから発見";

  return (
    <article
      className="bg-[#182734] border border-[#314d68] hover:border-[#0b80ee]/50 transition-colors duration-200 rounded-lg"
      aria-labelledby={`feed-title-${feed.url.replace(/[^a-zA-Z0-9]/g, "-")}`}
    >
      <header className="p-6 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3
              id={`feed-title-${feed.url.replace(/[^a-zA-Z0-9]/g, "-")}`}
              className="text-white text-lg leading-tight truncate"
            >
              {feed.title || feed.url}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${
                  feed.type === "RSS"
                    ? "bg-orange-900 text-orange-200"
                    : "bg-blue-900 text-blue-200"
                }`}
                aria-label={`フィードタイプ: ${feed.type}`}
              >
                {feed.type}
              </span>
              <span
                className="text-xs text-[#90aecb]"
                aria-label={`発見方法: ${discoveryMethodText}`}
              >
                {discoveryMethodText}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 pb-6">
        {feed.description && (
          <p className="text-sm text-[#90aecb] mb-3 line-clamp-2">
            {feed.description}
          </p>
        )}

        <div className="space-y-2">
          <div className="p-2 bg-[#101a23] rounded border border-[#314d68]">
            <code className="text-xs text-[#90aecb] break-all">{feed.url}</code>
          </div>

          <div
            className="flex gap-2"
            role="group"
            aria-label="フィードアクション"
          >
            <Button
              onClick={() => onOpenFeed(feed.url)}
              variant="outline"
              size="sm"
              className="flex-1 bg-[#182734] border-[#314d68] text-white hover:bg-[#314d68] hover:text-white"
              aria-label={`${feed.title || feed.url}のフィードを新しいタブで開く`}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              フィードを開く
            </Button>

            <Button
              onClick={() => onCopyUrl(feed.url)}
              variant="outline"
              size="sm"
              className={`flex-1 transition-colors duration-200 ${
                isUrlCopied
                  ? "bg-green-900 border-green-700 text-green-200 hover:bg-green-800"
                  : "bg-[#182734] border-[#314d68] text-white hover:bg-[#314d68] hover:text-white"
              }`}
              aria-label={`${feed.title || feed.url}のURLをクリップボードにコピー`}
            >
              {isUrlCopied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  URLをコピー
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
