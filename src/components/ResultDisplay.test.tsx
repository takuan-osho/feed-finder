import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
      expect(
        screen.getByRole("button", {
          name: "Open RSS reader options for Example Feed (https://example.com/feed.xml)",
        }),
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

    it("should generate unique labelledby targets across result displays", () => {
      render(
        <>
          <ResultDisplay result={successResult} />
          <ResultDisplay result={successResult} />
        </>,
      );

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

  describe("RSS reader links", () => {
    const successResult: SearchResult = {
      success: true,
      feeds: [
        {
          url: "https://example.com/feed.xml?tag=日本語&format=atom",
          title: "Example Feed",
          type: "RSS",
          discoveryMethod: "meta-tag",
        },
      ],
      searchedUrl: "https://example.com",
      totalFound: 1,
    };

    it("should toggle RSS reader links for a feed", () => {
      render(<ResultDisplay result={successResult} />);

      const readerOptionsButton = screen.getByRole("button", {
        name: "Open RSS reader options for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
      });

      expect(readerOptionsButton).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("region", {
          name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
        }),
      ).not.toBeInTheDocument();

      fireEvent.click(readerOptionsButton);

      expect(readerOptionsButton).toHaveAttribute("aria-expanded", "true");
      expect(
        screen.getByRole("region", {
          name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
        }),
      ).toBeInTheDocument();
      const readerLinksRegion = screen.getByRole("region", {
        name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
      });
      expect(within(readerLinksRegion).getAllByRole("link")).toHaveLength(5);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

      fireEvent.click(readerOptionsButton);

      expect(readerOptionsButton).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("region", {
          name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
        }),
      ).not.toBeInTheDocument();
    });

    it("should render safe external reader links", () => {
      render(<ResultDisplay result={successResult} />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Open RSS reader options for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
        }),
      );

      const feedlyLink = screen.getByRole("link", {
        name: "Open Example Feed (https://example.com/feed.xml?tag=日本語&format=atom) in Feedly in a new tab",
      });
      const inoreaderLink = screen.getByRole("link", {
        name: "Open Example Feed (https://example.com/feed.xml?tag=日本語&format=atom) in Inoreader in a new tab",
      });

      expect(feedlyLink).toHaveAttribute(
        "href",
        "https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed.xml%3Ftag%3D%E6%97%A5%E6%9C%AC%E8%AA%9E%26format%3Datom",
      );
      expect(inoreaderLink).toHaveAttribute(
        "href",
        "https://www.inoreader.com?add_feed=https%3A%2F%2Fexample.com%2Ffeed.xml%3Ftag%3D%E6%97%A5%E6%9C%AC%E8%AA%9E%26format%3Datom",
      );

      const readerLinksRegion = screen.getByRole("region", {
        name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
      });
      for (const link of within(readerLinksRegion).getAllByRole("link")) {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
    });

    it("should close RSS reader links when Escape is pressed", () => {
      render(<ResultDisplay result={successResult} />);

      const readerOptionsButton = screen.getByRole("button", {
        name: "Open RSS reader options for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
      });
      fireEvent.click(readerOptionsButton);

      fireEvent.keyDown(readerOptionsButton, { key: "Escape" });

      expect(readerOptionsButton).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("region", {
          name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
        }),
      ).not.toBeInTheDocument();
      expect(readerOptionsButton).toHaveFocus();
    });

    it("should close RSS reader links when Escape is pressed from a reader link", () => {
      render(<ResultDisplay result={successResult} />);

      const readerOptionsButton = screen.getByRole("button", {
        name: "Open RSS reader options for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
      });
      fireEvent.click(readerOptionsButton);

      const feedlyLink = screen.getByRole("link", {
        name: "Open Example Feed (https://example.com/feed.xml?tag=日本語&format=atom) in Feedly in a new tab",
      });
      feedlyLink.focus();
      fireEvent.keyDown(feedlyLink, { key: "Escape" });

      expect(readerOptionsButton).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("region", {
          name: "RSS reader links for Example Feed (https://example.com/feed.xml?tag=日本語&format=atom)",
        }),
      ).not.toBeInTheDocument();
      expect(readerOptionsButton).toHaveFocus();
    });

    it("should keep RSS reader options independent for feeds with the same title", () => {
      const duplicateTitleResult: SearchResult = {
        success: true,
        feeds: [
          {
            url: "https://example.com/feed.xml",
            title: "Latest posts",
            type: "RSS",
            discoveryMethod: "meta-tag",
          },
          {
            url: "https://example.net/feed.xml",
            title: "Latest posts",
            type: "RSS",
            discoveryMethod: "common-path",
          },
        ],
        searchedUrl: "https://example.com",
        totalFound: 2,
      };

      render(<ResultDisplay result={duplicateTitleResult} />);

      const firstReaderOptionsButton = screen.getByRole("button", {
        name: "Open RSS reader options for Latest posts (https://example.com/feed.xml)",
      });
      const secondReaderOptionsButton = screen.getByRole("button", {
        name: "Open RSS reader options for Latest posts (https://example.net/feed.xml)",
      });

      fireEvent.click(firstReaderOptionsButton);

      const firstReaderLinks = screen.getByRole("region", {
        name: "RSS reader links for Latest posts (https://example.com/feed.xml)",
      });
      expect(
        screen.queryByRole("region", {
          name: "RSS reader links for Latest posts (https://example.net/feed.xml)",
        }),
      ).not.toBeInTheDocument();
      expect(
        within(firstReaderLinks).getByRole("link", {
          name: "Open Latest posts (https://example.com/feed.xml) in Feedly in a new tab",
        }),
      ).toHaveAttribute(
        "href",
        "https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed.xml",
      );

      fireEvent.click(secondReaderOptionsButton);

      const secondReaderLinks = screen.getByRole("region", {
        name: "RSS reader links for Latest posts (https://example.net/feed.xml)",
      });
      expect(
        within(secondReaderLinks).getByRole("link", {
          name: "Open Latest posts (https://example.net/feed.xml) in Feedly in a new tab",
        }),
      ).toHaveAttribute(
        "href",
        "https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fexample.net%2Ffeed.xml",
      );
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

    it("should not copy directly from repeated keydown events", () => {
      render(<ResultDisplay result={successResult} />);

      const copyButton = screen.getByLabelText(
        /Copy the URL of Example Feed to the clipboard/,
      );

      fireEvent.keyDown(copyButton, { key: "Enter" });
      fireEvent.keyDown(copyButton, { key: "Enter", repeat: true });
      fireEvent.keyDown(copyButton, { key: " ", repeat: true });

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
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

    it("should not open directly from repeated Enter keydown events", () => {
      render(<ResultDisplay result={successResult} />);

      const openButton = screen.getByLabelText(
        /Open the feed for Example Feed in a new tab/,
      );

      fireEvent.keyDown(openButton, { key: "Enter" });
      fireEvent.keyDown(openButton, { key: "Enter", repeat: true });

      expect(mockOpen).not.toHaveBeenCalled();
    });

    it("should not open directly from repeated Space keydown events", () => {
      render(<ResultDisplay result={successResult} />);

      const openButton = screen.getByLabelText(
        /Open the feed for Example Feed in a new tab/,
      );

      fireEvent.keyDown(openButton, { key: " " });
      fireEvent.keyDown(openButton, { key: " ", repeat: true });

      expect(mockOpen).not.toHaveBeenCalled();
    });
  });
});
