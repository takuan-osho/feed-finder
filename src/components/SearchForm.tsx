"use client";

import { err, ok, Result } from "neverthrow";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SearchFormProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function SearchForm({
  onSubmit,
  isLoading = false,
  error,
}: SearchFormProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Focus management for error handling (WCAG 2.2 Focus Not Obscured)
  useEffect(() => {
    if (validationError && errorRef.current) {
      // Focus the error message for screen readers
      errorRef.current.focus();
    }
  }, [validationError]);

  const validateUrlSafe = (input: string): Result<string, string> => {
    if (!input.trim()) {
      return err("URLを入力してください");
    }

    // Basic URL validation using URL API - allow with or without protocol
    const trimmed = input.trim();
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const testUrl = hasProtocol ? trimmed : `https://${trimmed}`;

    try {
      // Throws on invalid URLs
      new URL(testUrl);
      return ok(testUrl);
    } catch {
      return err(
        "有効なURLを入力してください（例: example.com または https://example.com）",
      );
    }
  };

  const validateUrl = (input: string): boolean => {
    const result = validateUrlSafe(input);

    if (result.isErr()) {
      setValidationError(result.error);
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validateUrl(url);

    if (!isValid) {
      return;
    }

    // Normalize URL - add https if no protocol
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    onSubmit(normalizedUrl);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);

    // Clear validation error when user starts typing
    if (validationError && value.trim()) {
      setValidationError(null);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-[#182734] border-[#314d68]">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="sr-only">フィード検索フォーム</legend>
            <label
              htmlFor="url-input"
              className="block text-sm font-medium text-white"
            >
              ウェブサイトのURL
            </label>
            <Input
              ref={inputRef}
              id="url-input"
              type="url"
              placeholder="example.com または https://example.com"
              value={url}
              onChange={handleUrlChange}
              disabled={isLoading}
              className="w-full bg-[#182734] border-[#314d68] text-white placeholder:text-[#90aecb] focus:border-[#0b80ee] focus:ring-1 focus:ring-[#0b80ee] focus:outline-none"
              aria-describedby={
                validationError
                  ? "url-error"
                  : error
                    ? "submit-error"
                    : "url-help"
              }
              aria-invalid={validationError ? "true" : "false"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
            />
          </fieldset>

          {validationError && (
            <Alert
              variant="destructive"
              className="bg-red-950 border-red-800"
              role="alert"
              ref={errorRef}
              tabIndex={-1}
            >
              <AlertDescription id="url-error" className="text-red-200">
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert
              variant="destructive"
              className="bg-red-950 border-red-800"
              role="alert"
            >
              <AlertDescription id="submit-error" className="text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full bg-[#0b80ee] hover:bg-[#0b80ee]/80 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0b80ee] focus:ring-offset-2 focus:ring-offset-[#182734]"
            aria-describedby="url-help"
            aria-label={
              isLoading
                ? "フィード検索を実行中です"
                : "入力されたURLでフィードを検索"
            }
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === " ") &&
                !isLoading &&
                url.trim()
              ) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          >
            {isLoading ? "検索中..." : "フィードを検索"}
          </Button>
        </form>

        <aside className="mt-4 text-sm text-[#90aecb]">
          <p id="url-help">
            このツールは、指定されたウェブサイトのRSS/Atomフィードを自動検索します。
          </p>
        </aside>
      </CardContent>
    </Card>
  );
}
