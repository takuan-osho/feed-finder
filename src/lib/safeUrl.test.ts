import { describe, expect, it } from "vitest";

import { isHttpUrl } from "./safeUrl";

describe("isHttpUrl", () => {
  it.each(["https://example.com/feed.xml", "http://example.com/feed.xml"])(
    "should accept %s",
    (url) => {
      expect(isHttpUrl(url)).toBe(true);
    },
  );

  it.each([
    "javascript:alert(document.domain)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/feed.xml",
    "blob:https://example.com/0000",
    "not-a-valid-url",
    "/relative/feed.xml",
    "",
  ])("should reject %j", (url) => {
    expect(isHttpUrl(url)).toBe(false);
  });
});
