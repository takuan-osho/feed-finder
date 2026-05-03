import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getInitialTheme,
  THEME_COLORS,
  THEME_STORAGE_KEY,
} from "./theme";

function mockColorSchemePreference(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ensureMetaThemeColor(initialContent = "#ffffff") {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((node) => node.remove());

  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", initialContent);
  document.head.appendChild(meta);
  return meta;
}

describe("theme module", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((node) => node.remove());
    mockColorSchemePreference(false);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("getInitialTheme", () => {
    it("returns saved 'light' when localStorage has it", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(getInitialTheme()).toBe("light");
    });

    it("returns saved 'dark' when localStorage has it", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(getInitialTheme()).toBe("dark");
    });

    it("ignores invalid localStorage values and falls back to system preference", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
      mockColorSchemePreference(true);
      expect(getInitialTheme()).toBe("dark");
    });

    it("returns 'dark' when system prefers dark and no theme is saved", () => {
      mockColorSchemePreference(true);
      expect(getInitialTheme()).toBe("dark");
    });

    it("returns 'light' when system prefers light and no theme is saved", () => {
      mockColorSchemePreference(false);
      expect(getInitialTheme()).toBe("light");
    });
  });

  describe("applyTheme", () => {
    beforeEach(() => {
      ensureMetaThemeColor();
    });

    it("adds the 'dark' class on the html element for dark theme", () => {
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes the 'dark' class on the html element for light theme", () => {
      document.documentElement.classList.add("dark");
      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("sets data-theme to the active theme", () => {
      applyTheme("dark");
      expect(document.documentElement.dataset["theme"]).toBe("dark");
    });

    it("sets colorScheme style to the active theme", () => {
      applyTheme("light");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("syncs meta[name=theme-color] for dark theme", () => {
      applyTheme("dark");
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute("content")).toBe(THEME_COLORS.dark);
    });

    it("syncs meta[name=theme-color] for light theme", () => {
      applyTheme("light");
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute("content")).toBe(THEME_COLORS.light);
    });

    it("does not throw when meta[name=theme-color] is missing", () => {
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((node) => node.remove());
      expect(() => applyTheme("dark")).not.toThrow();
    });

    it("persists the theme to localStorage", () => {
      applyTheme("dark");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });
  });
});
