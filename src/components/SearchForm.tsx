"use client";

import { useState } from "react";
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

  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setValidationError("URLを入力してください");
      return false;
    }

    // Basic URL validation - allow with or without protocol
    const urlPattern =
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})(\/[a-zA-Z0-9_.-]*)*\/?$/i;
    const hasProtocol = /^https?:\/\//i.test(input);
    const testUrl = hasProtocol ? input : `https://${input}`;

    if (!urlPattern.test(testUrl)) {
      setValidationError(
        "有効なURLを入力してください（例: example.com または https://example.com）",
      );
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateUrl(url)) {
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
          <div className="space-y-2">
            <label
              htmlFor="url-input"
              className="block text-sm font-medium text-white"
            >
              ウェブサイトのURL
            </label>
            <Input
              id="url-input"
              type="url"
              placeholder="example.com または https://example.com"
              value={url}
              onChange={handleUrlChange}
              disabled={isLoading}
              className="w-full bg-[#182734] border-[#314d68] text-white placeholder:text-[#90aecb] focus:border-[#0b80ee] focus:ring-1 focus:ring-[#0b80ee]"
              aria-describedby={
                validationError
                  ? "url-error"
                  : error
                    ? "submit-error"
                    : undefined
              }
              aria-invalid={validationError ? "true" : "false"}
            />
          </div>

          {validationError && (
            <Alert variant="destructive" className="bg-red-950 border-red-800">
              <AlertDescription id="url-error" className="text-red-200">
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="bg-red-950 border-red-800">
              <AlertDescription id="submit-error" className="text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full bg-[#0b80ee] hover:bg-[#0b80ee]/80 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "検索中..." : "フィードを検索"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-[#90aecb]">
          <p>
            このツールは、指定されたウェブサイトのRSS/Atomフィードを自動検索します。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
