// Applies the stored or preferred color theme before first paint.
// This is a separate same-origin file (not an inline script) so that the
// Content-Security-Policy in public/_headers can use script-src 'self'.
(() => {
  const storageKey = "feed-finder-theme";
  const lightThemeColor = "#f8fafc";
  const darkThemeColor = "#0b1118";

  try {
    const storedTheme = localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const theme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : prefersDark
          ? "dark"
          : "light";

    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        theme === "dark" ? darkThemeColor : lightThemeColor,
      );
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
