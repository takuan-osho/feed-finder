// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(resolve(rootDir, "index.html"), "utf8");

describe("index.html is compatible with the Content-Security-Policy", () => {
  it("has no inline scripts (script-src 'self' would block them)", () => {
    const scriptTags = indexHtml.match(/<script\b[^>]*>/gi) ?? [];

    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag).toMatch(/\ssrc=/);
    }
  });

  it("has no inline event handler attributes", () => {
    expect(indexHtml).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("does not reference third-party origins", () => {
    expect(indexHtml).not.toMatch(/(?:href|src)=["'](?:https?:)?\/\//i);
  });

  it("loads the theme bootstrap script from the same origin", () => {
    expect(indexHtml).toContain('<script src="/theme-init.js"></script>');
    expect(existsSync(resolve(rootDir, "public/theme-init.js"))).toBe(true);
  });
});
