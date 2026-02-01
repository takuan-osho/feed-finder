import { z } from "zod";

/**
 * Zod schema for FeedResult
 * Matches the shared/types.ts FeedResult interface
 */
export const FeedResultSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  type: z.enum(["RSS", "Atom"]),
  description: z.string().optional(),
  discoveryMethod: z.enum(["meta-tag", "common-path"]),
});

/**
 * Zod schema for SearchResult
 * Matches the shared/types.ts SearchResult interface
 */
export const SearchResultSchema = z.object({
  success: z.boolean(),
  feeds: z.array(FeedResultSchema),
  searchedUrl: z.string(),
  totalFound: z.number().int().nonnegative(),
  message: z.string().optional(),
});

/**
 * Zod schema for API error response
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
});

/**
 * Type-safe parse function for SearchResult
 * Returns the parsed result or throws with a user-friendly message
 */
export function parseSearchResult(data: unknown) {
  const result = SearchResultSchema.safeParse(data);
  if (!result.success) {
    console.error("Invalid API response:", result.error.flatten());
    throw new Error("サーバーからの応答が不正な形式でした");
  }
  return result.data;
}

/**
 * Type-safe parse function for API error
 */
export function parseApiError(data: unknown): string {
  const result = ApiErrorSchema.safeParse(data);
  if (result.success) {
    return result.data.error;
  }
  return "予期しないエラーが発生しました";
}
