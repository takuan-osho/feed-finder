"use client";

import { err, Result } from "neverthrow";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
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
      return err("Please enter a URL");
    }

    // Basic URL validation using URL API - allow with or without protocol
    const trimmed = input.trim();
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const testUrl = hasProtocol ? trimmed : `https://${trimmed}`;

    const safeCreateUrl = Result.fromThrowable(
      () => new URL(testUrl),
      () =>
        "Please enter a valid URL (e.g., example.com or https://example.com)",
    );

    return safeCreateUrl().map(() => testUrl);
  };

  const submitUrl = (input: string): void => {
    const result = validateUrlSafe(input);

    if (result.isErr()) {
      setValidationError(result.error);
      return;
    }

    setValidationError(null);
    onSubmit(result.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitUrl(url);
  };

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);

    // Clear validation error when user starts typing
    if (validationError && value.trim()) {
      setValidationError(null);
    }
  };

  const handleUrlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submitUrl(url);
    }
  };

  const handleSubmitKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      !isLoading &&
      url.trim() &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      submitUrl(url);
    }
  };

  return (
    <Card className="app-surface mx-auto w-full max-w-3xl border shadow-xl backdrop-blur">
      <CardContent className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <fieldset className="space-y-2.5">
            <legend className="sr-only">Feed search form</legend>
            <label htmlFor="url-input" className="block text-sm font-semibold">
              Website URL
            </label>
            <Input
              id="url-input"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="example.com or https://example.com"
              value={url}
              onChange={handleUrlChange}
              disabled={isLoading}
              className="app-input h-12 w-full rounded-lg border px-4 shadow-inner transition-colors focus:ring-2 focus:outline-none"
              aria-describedby={
                validationError
                  ? "url-error"
                  : error
                    ? "submit-error"
                    : "url-help"
              }
              aria-invalid={validationError ? "true" : "false"}
              onKeyDown={handleUrlKeyDown}
            />
          </fieldset>

          {validationError && (
            <Alert
              variant="destructive"
              className="border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
              ref={errorRef}
              tabIndex={-1}
            >
              <AlertDescription
                id="url-error"
                className="text-red-800 dark:text-red-100"
              >
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert
              variant="destructive"
              className="border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <AlertDescription
                id="submit-error"
                className="text-red-800 dark:text-red-100"
              >
                {error}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="app-primary-button h-12 w-full rounded-lg px-4 py-2 font-semibold shadow-lg transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-describedby="url-help"
            aria-label={
              isLoading
                ? "Searching for feeds"
                : "Search feeds for the entered URL"
            }
            onKeyDown={handleSubmitKeyDown}
          >
            {isLoading ? "Searching..." : "Search feeds"}
          </Button>
        </form>

        <aside className="app-muted mt-5 border-t border-[var(--app-border)] pt-4 text-sm leading-6">
          <p id="url-help" className="max-w-2xl">
            This tool automatically discovers RSS / Atom feeds for the website
            you specify.
          </p>
        </aside>
      </CardContent>
    </Card>
  );
}
