import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedResult, SearchResult } from "../../shared/types";
import { ResultDisplay } from "./ResultDisplay";

describe("ResultDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  describe("null/empty states", () => {
    it("should render nothing when result is null and no error", () => {
      const { container } = render(<ResultDisplay result={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("error state rendering", () => {
    it("should display error alert when error prop is provided", () => {
      render(<ResultDisplay result={null} error="Network error occurred" />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("aria-live", "assertive");
      expect(screen.getByText(/An error occurred:/)).toBeInTheDocument();
      expect(screen.getByText(/Network error occurred/)).toBeInTheDocument();
    });

    it("should have destructive styling for error alerts", () => {
      render(<ResultDisplay result={null} error="Test error" />);

      const alert = screen.getByRole("alert");
      expect(alert.className).toContain("bg-red-50");
      expect(alert.className).toContain("border-red-200");
    });
  });

  describe("no feeds found state", () => {
    const noFeedsResult: SearchResult = {
      success: true,
      feeds: [],
      searchedUrl: "https://example.com",
      totalFound: 0,
    };

    it("should display info message when no feeds are found", () => {
      render(<ResultDisplay result={noFeedsResult} />);

      const status = screen.getByRole("status");
      expect(status).toBeInTheDocument();
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(screen.getByText(/No feeds were found/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Could not discover any RSS \/ Atom feeds for https:\/\/example.com/,
        ),
      ).toBeInTheDocument();
    });

    it("should display optional message when provided", () => {
      const resultWithMessage: SearchResult = {
        ...noFeedsResult,
        message: "Try checking the site directly.",
      };
      render(<ResultDisplay result={resultWithMessage} />);

      expect(
        screen.getByText(/Try checking the site directly./),
      ).toBeInTheDocument();
    });

    it("should show no feeds message when success is false", () => {
      const failedResult: SearchResult = {
        success: false,
        feeds: [],
        searchedUrl: "https://example.com",
        totalFound: 0,
      };
      render(<ResultDisplay result={failedResult} />);

      expect(screen.getByText(/No feeds were found/)).toBeInTheDocument();
    });
  });

  describe("feeds found state", () => {
    const mockFeeds: FeedResult[] = [
      {
        url: "https://example.com/feed.xml",
        title: "Example RSS Feed",
        type: "RSS",
        description: "An example RSS feed for testing",
        discoveryMethod: "meta-tag",
      },
      {
        url: "https://example.com/atom.xml",
        title: "Example Atom Feed",
        type: "Atom",
        discoveryMethod: "common-path",
      },
    ];

    const successResult: SearchResult = {
      success: true,
      feeds: mockFeeds,
      searchedUrl: "https://example.com",
      totalFound: 2,
    };

    it("should display success message with feed count", () => {
      render(<ResultDisplay result={successResult} />);

      expect(screen.getByText(/Found 2 feed\(s\)/)).toBeInTheDocument();
      expect(
        screen.getByText(/Searched: https:\/\/example.com/),
      ).toBeInTheDocument();
    });

    it("should render all feed cards", () => {
      render(<ResultDisplay result={successResult} />);

      expect(screen.getByText("Example RSS Feed")).toBeInTheDocument();
      expect(screen.getByText("Example Atom Feed")).toBeInTheDocument();
    });

    it("should render duplicate feed URLs as separate cards", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const duplicateUrlResult: SearchResult = {
        success: true,
        feeds: [
          {
            url: "https://example.com/feed.xml",
            title: "Primary Feed",
            type: "RSS",
            discoveryMethod: "meta-tag",
          },
          {
            url: "https://example.com/feed.xml",
            title: "Fallback Feed",
            type: "RSS",
            discoveryMethod: "common-path",
          },
        ],
        searchedUrl: "https://example.com",
        totalFound: 2,
      };

      try {
        render(<ResultDisplay result={duplicateUrlResult} />);

        expect(screen.getByText("Primary Feed")).toBeInTheDocument();
        expect(screen.getByText("Fallback Feed")).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining("Encountered two children with the same key"),
          expect.anything(),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it("should display feed type badges correctly", () => {
      render(<ResultDisplay result={successResult} />);

      const rssBadge = screen.getByText("RSS");
      const atomBadge = screen.getByText("Atom");

      expect(rssBadge.className).toContain("bg-orange-100");
      expect(atomBadge.className).toContain("bg-blue-100");
    });

    it("should display discovery method correctly", () => {
      render(<ResultDisplay result={successResult} />);

      expect(
        screen.getByText("Discovered via HTML meta tag"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Discovered via common path"),
      ).toBeInTheDocument();
    });

    it("should display feed description when provided", () => {
      render(<ResultDisplay result={successResult} />);

      expect(
        screen.getByText("An example RSS feed for testing"),
      ).toBeInTheDocument();
    });

    it("should display feed URLs", () => {
      render(<ResultDisplay result={successResult} />);

      expect(
        screen.getByText("https://example.com/feed.xml"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("https://example.com/atom.xml"),
      ).toBeInTheDocument();
    });

    it("should use URL as title when title is not provided", () => {
      const feedWithoutTitle: FeedResult = {
        url: "https://example.com/untitled.xml",
        type: "RSS",
        discoveryMethod: "common-path",
      };
      const result: SearchResult = {
        success: true,
        feeds: [feedWithoutTitle],
        searchedUrl: "https://example.com",
        totalFound: 1,
      };

      render(<ResultDisplay result={result} />);

      const title = screen.getByRole("heading", { level: 3 });
      expect(title.textContent).toBe("https://example.com/untitled.xml");
    });
  });

  describe("accessibility", () => {
    const successResult: SearchResult = {
      success: true,
      feeds: [
        {
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          type: "RSS",
          discoveryMethod: "meta-tag",
        },
      ],
      searchedUrl: "https://example.com",
      totalFound: 1,
    };

    it("should have proper aria-label on result section", () => {
      render(<ResultDisplay result={successResult} />);

      const section = screen.getByTestId("result-display");
      expect(section).toHaveAttribute("aria-label", "Search results");
    });

    it("should have list role on feed container", () => {
      render(<ResultDisplay result={successResult} />);

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
    });

    it("should have listitem role on each feed card", () => {
      render(<ResultDisplay result={successResult} />);

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(1);
    });

    it("should have accessible button labels", () => {
      render(<ResultDisplay result={successResult} />);

      expect(
        screen.getByLabelText(/Open the feed for Example Feed in a new tab/),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Copy the URL of Example Feed to the clipboard/),
      ).toBeInTheDocument();
    });

    it("should have group role on action buttons", () => {
      render(<ResultDisplay result={successResult} />);

      const group = screen.getByRole("group", { name: "Feed actions" });
      expect(group).toBeInTheDocument();
    });

    it("should have aria-live on status messages", () => {
      render(<ResultDisplay result={successResult} />);

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("should generate unique labelledby targets for URL-like titles", () => {
      const collidingTitleResult: SearchResult = {
        success: true,
        feeds: [
          {
            url: "https://example.com/feed.xml",
            title: "First Feed",
            type: "RSS",
            discoveryMethod: "meta-tag",
          },
          {
            url: "https://example-com/feed-xml",
            title: "Second Feed",
            type: "RSS",
            discoveryMethod: "common-path",
          },
        ],
        searchedUrl: "https://example.com",
        totalFound: 2,
      };

      render(<ResultDisplay result={collidingTitleResult} />);

      const articles = document.querySelectorAll("article[aria-labelledby]");
      const labelledbyValues = Array.from(articles).map((article) =>
        article.getAttribute("aria-labelledby"),
      );

      expect(new Set(labelledbyValues).size).toBe(labelledbyValues.length);
      labelledbyValues.forEach((labelledby) => {
        expect(labelledby).toBeTruthy();
        expect(document.getElementById(labelledby!)).toBeTruthy();
      });
    });
  });

  describe("URL copy functionality", () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      vi.useFakeTimers();
      Object.assign(navigator, { clipboard: mockClipboard });
      mockClipboard.writeText.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const successResult: SearchResult = {
      success: true,
      feeds: [
        {
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          type: "RSS",
          discoveryMethod: "meta-tag",
        },
      ],
      searchedUrl: "https://example.com",
      totalFound: 1,
    };

    it("should copy URL to clipboard when copy button is clicked", async () => {
      render(<ResultDisplay result={successResult} />);

      const copyButton = screen.getByLabelText(
        /Copy the URL of Example Feed to the clipboard/,
      );
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
      );
    });

    it("should show copied state after successful copy", async () => {
      render(<ResultDisplay result={successResult} />);

      const copyButton = screen.getByLabelText(
        /Copy the URL of Example Feed to the clipboard/,
      );
      fireEvent.click(copyButton);

      await vi.waitFor(() => {
        expect(screen.getByText("Copied")).toBeInTheDocument();
      });

      expect(copyButton.className).toContain("bg-emerald-100");

      vi.advanceTimersByTime(2000);

      await vi.waitFor(() => {
        expect(screen.getByText("Copy URL")).toBeInTheDocument();
      });
    });

    it("should handle keyboard activation for copy button", () => {
      render(<ResultDisplay result={successResult} />);

      const copyButton = screen.getByLabelText(
        /Copy the URL of Example Feed to the clipboard/,
      );

      fireEvent.keyDown(copyButton, { key: "Enter" });
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
      );
    });
  });

  describe("open feed functionality", () => {
    const mockOpen = vi.fn();

    beforeEach(() => {
      vi.spyOn(window, "open").mockImplementation(mockOpen);
      mockOpen.mockClear();
    });

    const successResult: SearchResult = {
      success: true,
      feeds: [
        {
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          type: "RSS",
          discoveryMethod: "meta-tag",
        },
      ],
      searchedUrl: "https://example.com",
      totalFound: 1,
    };

    it("should open feed in new tab when open button is clicked", () => {
      render(<ResultDisplay result={successResult} />);

      const openButton = screen.getByLabelText(
        /Open the feed for Example Feed in a new tab/,
      );
      fireEvent.click(openButton);

      expect(mockOpen).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("should handle keyboard activation for open button", () => {
      render(<ResultDisplay result={successResult} />);

      const openButton = screen.getByLabelText(
        /Open the feed for Example Feed in a new tab/,
      );

      fireEvent.keyDown(openButton, { key: "Enter" });
      expect(mockOpen).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("should handle space key activation for open button", () => {
      render(<ResultDisplay result={successResult} />);

      const openButton = screen.getByLabelText(
        /Open the feed for Example Feed in a new tab/,
      );

      fireEvent.keyDown(openButton, { key: " " });
      expect(mockOpen).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });
});
