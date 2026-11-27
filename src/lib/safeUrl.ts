import { Result } from "neverthrow";

const HTTP_PROTOCOLS = ["http:", "https:"];

const safeParseUrl = Result.fromThrowable(
  (url: string) => new URL(url),
  () => null,
);

/**
 * Returns true only for absolute http: / https: URLs.
 *
 * Feed URLs come from pages the user does not control. Use this before a URL
 * is opened or navigated to, so that schemes such as `javascript:` or `data:`
 * can never run in this origin.
 */
export function isHttpUrl(url: string): boolean {
  const result = safeParseUrl(url);
  return result.isOk() && HTTP_PROTOCOLS.includes(result.value.protocol);
}
