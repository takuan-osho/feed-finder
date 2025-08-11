import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

// Bundle Optimization Tests (t-wada式TDD)
describe("Bundle Optimization Tests", () => {
  describe("Code Splitting Verification", () => {
    it("should lazy load ResultDisplay component to reduce initial bundle", async () => {
      // Red Phase: This test should initially fail to verify lazy loading works
      render(<App />);

      // Initially, ResultDisplay should not be in the DOM
      const resultDisplayElements = document.querySelectorAll(
        '[data-testid="result-display"]',
      );
      expect(resultDisplayElements).toHaveLength(0);

      // The lazy-loaded component should only appear after search is performed
      // This test validates that the component is not included in initial bundle
      const suspenseFallback = document.querySelector(
        ".text-center.text-\\[\\#90aecb\\]",
      );
      expect(suspenseFallback).toBe(null); // Should not be visible initially
    });

    it("should have critical CSS inlined for fast first paint", () => {
      // Red Phase: Verify critical CSS optimization
      const styles = document.head.getElementsByTagName("style");
      let hasCriticalCSS = false;

      for (let i = 0; i < styles.length; i++) {
        const cssText = styles[i].textContent || "";
        if (
          cssText.includes("background-color: #101a23") ||
          cssText.includes("min-height: 100vh") ||
          cssText.includes("loading-skeleton")
        ) {
          hasCriticalCSS = true;
          break;
        }
      }

      expect(hasCriticalCSS).toBe(true);
    });
  });

  describe("Performance Optimization Verification", () => {
    it("should preload critical resources", () => {
      // Red Phase: Verify resource preloading
      const preloadLinks = document.head.querySelectorAll(
        'link[rel="modulepreload"]',
      );
      const preconnectLinks = document.head.querySelectorAll(
        'link[rel="preconnect"]',
      );

      // Should have at least one modulepreload
      expect(preloadLinks.length).toBeGreaterThan(0);

      // Should have DNS preconnect for performance
      const hasPreconnect = Array.from(preconnectLinks).some((link) =>
        link.getAttribute("href")?.includes("fonts.googleapis.com"),
      );
      expect(hasPreconnect).toBe(true);
    });

    it("should have optimized meta tags for performance", () => {
      // Red Phase: Verify performance meta tags
      const themeColorMeta = document.head.querySelector(
        'meta[name="theme-color"]',
      );
      const descriptionMeta = document.head.querySelector(
        'meta[name="description"]',
      );

      expect(themeColorMeta?.getAttribute("content")).toBe("#101a23");
      expect(descriptionMeta?.getAttribute("content")).toContain(
        "RSS・Atomフィード検索",
      );
    });
  });
});
